// Grids: two grids (and two maps) in one real Sim, and a real client replica, to show that nothing leaks between them: node tools/gridtest.mjs
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadSimData } from '../src/sim/load.js';
import { Sim } from '../src/sim/sim.js';
import { Replica } from '../src/client/state.js';
import { SIM_DT, TILE } from '../src/shared/config.js';
import { place } from '../src/sim/inventory.js';
import { qYaw, tfPoint } from '../src/shared/math3.js';
import { makeBlueprint, withGrids } from './gridkit.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = loadSimData(root);
let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) pass++; else { fail++; console.log('  FAIL:', name); } };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const section = (name, fn) => { console.log(name); fn(); };

const ROOM = [
  '#######',
  '#.....#',
  '#..S..#',
  '###D###',
  '#.....#',
  '#.....#',
  '#######',
];
const BP = { room: makeBlueprint(DATA.level, ROOM, { spawnJob: 'testjob' }) };

/** The station, plus the room turned a quarter-turn and standing `at` (world coordinates) in the same map. */
function setup(at = [300, 0, 300], opts = {}) {
  const data = withGrids(DATA, BP, [{ bp: 'room', kind: 'shuttle', p: at, q: qYaw(Math.PI / 2) }]);
  const sim = new Sim(data, { bots: 0, ...opts });
  const inbox = { a: [], b: [] };
  const A = sim.addClient('Alice', (m) => inbox.a.push(m));
  const B = sim.addClient('Bob', (m) => inbox.b.push(m));
  sim.handle(A, { t: 'lobby', op: 'job', id: 'station_engineer' });
  sim.handle(B, { t: 'lobby', op: 'job', id: 'medical_doctor' });
  sim.handle(A, { t: 'lobby', op: 'ready', v: true });
  sim.handle(B, { t: 'lobby', op: 'ready', v: true });
  sim.handle(A, { t: 'lobby', op: 'start' });
  const step = (sec) => { for (let k = 0; k < sec / SIM_DT; k++) sim.step(SIM_DT); };
  const evs = (inb, e) => inb.filter((m) => m.t === 'ev').flatMap((m) => m.list).filter((x) => x.e === e);
  const [station, room] = [...sim.grids.values()];
  const put = (m, g, c, r) => { m.grid = g; m.map = g.map; m.x = c * TILE + 1; m.z = r * TILE + 1; m.vx = m.vz = 0; };
  return { sim, data, A, B, a: A.mob, b: B.mob, inbox, step, evs, station, room, put };
}

section('two grids in one map', () => {
  const { sim, station, room } = setup();
  ok(sim.grids.size === 2 && station.id !== room.id, 'the sim has two grids with their own ids');
  ok(station.map === room.map && sim.maps.size === 1 && sim.station === station, 'they are in one map, and the first is the station');
  ok(room.kind === 'shuttle' && room.bp === 'room' && room.world.W === 7 && room.world.H === 7, 'the second is built from its own blueprint, at its own size');
  ok(room.world !== station.world && room.world.kind !== station.world.kind && station.world.W === 255, 'each has its own tile arrays');
  const before = station.world.kind[station.world.idx(1, 1)];
  room.world.kind[room.world.idx(1, 1)] = 2;
  ok(station.world.kind[station.world.idx(1, 1)] === before, 'changing a tile of one leaves the other alone');
  ok(room.doors.length === 1 && station.doors.length > 100 && room.doors[0].grid === room && room.doors[0].idx === 0, 'doors are listed per grid, and know their grid');
  ok(room.props.interact.every((it) => it.grid === room) && station.props.interact.every((it) => it.grid === station), 'so do props');
  ok(room.world.doorAt.size === 1 && room.world.doorAt.get(room.world.idx(3, 3)) === room.doors[0], 'a door is found by tile in its own grid');
  ok(sim.spawnPoints().some((s) => s.grid === room && s.job === 'testjob') && sim.spawnPoints().filter((s) => s.grid === station).length > 100, 'start points come from every grid');
  ok(near(room.atmos.pressureAt(1, 1), 101.3, 0.2) && room.atmos.pressureAt(0, 0) === 0, 'the room is filled with air; its walls are not');
});

section('what happens on one grid stays on it', () => {
  const { sim, A, inbox, step, evs, station, room } = setup();
  const pStation = station.atmos.pressureAt(60, 60), pRoom = room.atmos.pressureAt(1, 1);
  room.atmos.o2.fill(0); room.atmos.n2.fill(0);
  step(2);
  ok(station.atmos.pressureAt(60, 60) === pStation && room.atmos.pressureAt(1, 1) < pRoom, 'emptying the room does not touch the station air');
  inbox.a.length = 0;
  room.power.setState('out');
  step(0.2);
  const pw = evs(inbox.a, 'power');
  ok(room.power.state === 'out' && station.power.state === 'normal', 'the room loses power, the station does not');
  ok(pw.length === 1 && pw[0].g === room.id, 'and the event says which grid it was');
  ok(!room.power.doorsWork(room.doors[0]) && station.power.doorsWork(station.doors[0]), 'so its doors stop working and the station\'s do not');
  inbox.a.length = 0;
  sim.setGravity(room, false);
  step(0.1);
  ok(room.world.gravityOn === false && station.world.gravityOn === true, 'the room has its own gravity');
  ok(evs(inbox.a, 'grav').some((e) => e.g === room.id && e.on === false), 'announced for that grid');
  ok(room.world.hasGravity(5, 5) === false && station.world.hasGravity(60 * TILE + 1, 60 * TILE + 1) !== undefined, 'hasGravity reads the right grid');
  void A;
});

section('where things are', () => {
  const { sim, a, b, put, station, room } = setup([300, 0, 300]);
  // the room is turned a quarter: its local (x, z) is world (300 + z, 300 - x)
  put(b, room, 3, 4);
  const w = sim.worldPos(b);
  ok(near(w[0], 300 + b.z, 1e-9) && near(w[2], 300 - b.x, 1e-9) && w[1] === 0, 'a body on a turned grid is where the grid\'s pose puts it');
  const back = room.localPoint(w);
  ok(near(back[0], b.x, 1e-9) && near(back[2], b.z, 1e-9), 'and the grid\'s frame maps it back');
  put(a, station, 40, 40);
  const wa = sim.worldPos(a);
  ok(near(wa[0], a.x) && near(wa[2], a.z), 'the station sits at the origin of the map');
  ok(near(sim.dist(a, b), Math.hypot(wa[0] - w[0], wa[1] - w[1], wa[2] - w[2]), 1e-9), 'distance between grids is the distance between where they are in the map');
  const c2 = { grid: station, x: a.x + 3, z: a.z + 4 };
  ok(near(sim.dist(a, c2), 5), 'on one grid it is plain distance across the deck');
  ok(sim.sameGrid(a, c2) && !sim.sameGrid(a, b), 'same grid / different grid');
  const away = sim.addMap('away', 'Away Mission');
  const g3 = sim.addGrid('room', { map: away, kind: 'away', tf: { p: [300, 0, 300], q: [0, 0, 0, 1] } });
  const m3 = sim.newMob({ kind: 'carp', set: 'carp', name: 'far carp', grid: g3, x: 3, z: 3, hp: 20 });
  ok(sim.mapOf(m3) === away && sim.mapOf(a) === sim.station.map && sim.dist(a, m3) === Infinity, 'things in different maps are infinitely far apart');
  const g4 = sim.addGrid('room', { map: away, kind: 'away', tf: { p: [330, 0, 300], q: [0, 0, 0, 1] } });
  ok(sim.gridSeq === 5 && g3.id !== g4.id && g3.world !== g4.world && g3.world.W === 7, 'one blueprint can be a grid twice (their tiles are separate)');
  const f = { grid: g4, x: 1, z: 1 };
  ok(near(sim.dist(m3, f), 30 - 0, 1e-9) || near(sim.dist(m3, f), Math.hypot(30 + (1 - 3), 0 + (1 - 3)), 1e-9), 'two grids in the away map measure against each other');
});

section('a grid moving does not touch its inhabitants', () => {
  const { sim, step, b, put, room } = setup([300, 0, 300]);
  put(b, room, 3, 4);
  b.vx = 1.5; b.vz = -0.5; b.yaw = 0.3;
  const kept = { x: b.x, z: b.z, vx: b.vx, vz: b.vz, yaw: b.yaw, grid: b.grid };
  const w0 = sim.worldPos(b);
  room.tf.p = [310, 2, 280];
  room.tf.q = qYaw(1.1);
  room.vel = [5, 0, 1]; room.ang = [0, 0.5, 0];
  step(1);
  ok(b.x === kept.x && b.z === kept.z && b.vx === kept.vx && b.vz === kept.vz && b.yaw === kept.yaw && b.grid === kept.grid, 'position, velocity and facing in the grid\'s frame are exactly as they were');
  const w1 = sim.worldPos(b), expect = tfPoint(room.tf, [b.x, 0, b.z]);
  ok(w1[0] !== w0[0] && near(w1[0], expect[0], 1e-9) && near(w1[2], expect[2], 1e-9), 'only where the frame is drawn changed');
});

section('clicks and items are per grid', () => {
  const { sim, B, b, evs, inbox, step, put, station, room } = setup([300, 0, 300]);
  put(b, room, 3, 4);
  b.yaw = Math.PI;                                           // facing the door, north
  const d = room.doors[0], dStation = station.doors[0];
  ok(d.state === 'closed' && dStation.state === 'closed', 'both doors start closed');
  sim.handle(B, { t: 'click', target: { k: 'door', g: room.id, idx: 0 } });
  step(0.2);
  ok(d.state !== 'closed' && dStation.state === 'closed', 'a click names a grid, and opens that grid\'s door 0 and not the station\'s');
  ok(evs(inbox.b, 'door').some((e) => e.g === room.id && e.i === 0), 'and the door event carries the grid');
  ok(room.world.solid[room.world.idx(3, 3)] === 0 || d.state === 'opening', 'the door\'s tile frees up in its own grid');
  // a click that names no grid means the one you stand on
  b.cool = 0; d.close(); step(1);
  sim.handle(B, { t: 'click', target: { k: 'door', idx: 0 } });
  step(0.2);
  ok(d.state !== 'closed', 'no grid named: the grid you are standing on');
  // items on the floor of one grid
  const it = sim.newItem('/obj/item/crowbar');
  const rec = place(sim, it, room, 4, 9);
  ok(rec.grid === room && sim.floor.get(it.id) === rec, 'an item put down on a grid is on that grid');
  step(0.05);
  ok(evs(inbox.b, 'item+').some((e) => e.id === it.id && e.g === room.id), 'and the event says so');
  b.cool = 0;
  sim.handle(B, { t: 'click', target: { k: 'item', id: it.id } });
  step(0.2);
  ok(b.hands.some((h) => h && h.id === it.id) && !sim.floor.has(it.id), 'it can be picked up from there');
  let threw = false;
  try { place(sim, sim.newItem('/obj/item/crowbar'), null, 1, 1); } catch { threw = true; }
  ok(threw, 'putting something down without saying where is an error, not the station');
});

section('people on different grids', () => {
  const { sim, a, b, step, put, station, room } = setup([300, 0, 300]);
  const hearing = sim.chat;
  put(a, station, 60, 60);
  // the room is placed so that its (3, 4) tile is 1.5 m from Alice in the map
  const wa = sim.worldPos(a);
  const target = [wa[0] + 1.5, 0, wa[2]];
  const lp = room.localPoint(target);
  b.grid = room; b.map = room.map; b.x = lp[0]; b.z = lp[2];
  ok(near(sim.dist(a, b), 1.5, 1e-9), 'two people 1.5 m apart across the seam of two grids are 1.5 m apart');
  ok(hearing.canHear(a, b, 8), 'within arm\'s length they hear each other');
  const lp2 = room.localPoint([wa[0] + 6, 0, wa[2]]);
  b.x = lp2[0]; b.z = lp2[2];
  ok(!hearing.canHear(a, b, 8), 'further apart there is no line of sight between two grids, so they do not');
  const c = sim.newMob({ kind: 'human', name: 'Twin', grid: station, x: a.x + 5, z: a.z, hp: 100 });
  ok(hearing.canHear(a, c, 8), 'on one grid it is the usual line-of-sight rule');
  ok(!sim.people.near(a, b), 'handcuffs, grabs and the strip window do not reach across grids');
  // a carp does not hunt across grids
  const carp = sim.ai.spawnCarp(station, a.x + 6, a.z);
  put(b, room, 3, 4);
  const hp = b.body.brute;
  step(8);
  ok(b.body.brute === hp && carp.grid === station, 'a carp on the station does not bite someone on another grid');
});

section('maps do not meet', () => {
  const { sim, A, inbox, step, evs, room } = setup();
  const away = sim.addMap('away', 'Away Mission');
  const g3 = sim.addGrid('room', { map: away, kind: 'away', tf: { p: [0, 0, 0], q: [0, 0, 0, 1] } });
  inbox.a.length = 0;
  g3.emit({ e: 'door', i: 0, st: 'opening' });
  room.emit({ e: 'door', i: 0, st: 'opening' });
  step(0.1);
  const got = evs(inbox.a, 'door').filter((e) => e.st === 'opening');
  ok(got.length === 1 && got[0].g === room.id, 'an event about a grid in another map is not sent to players here');
  const far = sim.newMob({ kind: 'human', name: 'Away Man', grid: g3, x: 3, z: 3, hp: 100 });
  step(0.2);
  const snaps = inbox.a.filter((m) => m.t === 'snap');
  ok(snaps.length && snaps.every((s) => !s.mobs.some((row) => row[0] === far.id)), 'nor are people in it listed in their snapshots');
  void A;
});

section('the client replica', () => {
  const { sim, data, A, B, a, b, inbox, step, put, room, station } = setup([300, 0, 300]);
  room.tf.p = [a.x + 12, 0, a.z];                             // right beside Alice, so Bob is in her snapshots
  const welcome = inbox.a.find((m) => m.t === 'welcome');
  ok(welcome.grids.length === 2 && welcome.grids[1].bp === 'room' && welcome.grids[1].kind === 'shuttle' && welcome.map === 'station', 'the welcome lists the grids of the map, with their blueprints');
  ok(welcome.grids[1].tf.p[0] === 300 && welcome.grids[1].doors.length === 1, 'their poses and their state');
  const rep = new Replica({ level: data.level, rects: data.rects }, { ...welcome, you: A.id });
  ok(rep.grids.size === 2 && rep.station.id === station.id && rep.grids.get(room.id).world.W === 7, 'the replica builds the same grids from the same blueprints');
  ok(rep.grids.get(room.id).doors.length === 1 && rep.station.doors.length === station.doors.length, 'with the same doors, counted the same way');
  const feed = () => { for (const m of inbox.a.splice(0)) { if (m.t === 'ev') for (const ev of m.list) rep.apply(ev); else if (m.t === 'snap') rep.applySnap(m, 0); } };
  put(b, room, 3, 4); b.yaw = Math.PI; b.cool = 0;
  step(0.3); feed();
  const seen = rep.mobs.get(b.id);
  ok(seen && seen.g === room.id && near(seen.x, b.x, 0.01) && near(seen.z, b.z, 0.01), 'a snapshot row says which grid a person is on, and where in its frame');
  // a door event changes the right grid's door
  sim.handle(B, { t: 'click', target: { k: 'door', g: room.id, idx: 0 } });
  step(0.3); feed();
  ok(rep.grids.get(room.id).doors[0].state !== 'closed' && rep.station.doors[0].state === 'closed', 'a door event opens the door of the grid it names, in the replica');
  // a tile event is applied to its grid
  room.world.kind[room.world.idx(2, 2)] = 2;
  sim.emitTile(room, room.world.idx(2, 2));
  step(0.1); feed();
  ok(rep.grids.get(room.id).world.kind[room.world.idx(2, 2)] === 2 && station.world.kind[station.world.idx(2, 2)] !== undefined, 'a tile event is applied to its grid');
  // a person walks from one grid to the other: the replica follows without blending the two frames
  b.grid = station; b.map = station.map; b.x = a.x + 3; b.z = a.z; b.vx = b.vz = 0;
  step(0.3); feed();
  ok(rep.mobs.get(b.id).buf.at(-1).g === station.id, 'and when someone changes grid, the next snapshot says so');
  // a late joiner is told the lot
  const late = []; const C = sim.addClient('Cara', (m) => late.push(m));
  const w2 = late.find((m) => m.t === 'welcome');
  const rep2 = new Replica({ level: data.level, rects: data.rects }, { ...w2, you: C.id });
  ok(rep2.grids.get(room.id).world.kind[room.world.idx(2, 2)] === 2 && rep2.grids.get(room.id).doors[0].state !== 'closed', 'someone who joins later gets each grid as it is now');
  ok(Object.keys(rep.compat).length === 0, 'the replica never fell back on a station shortcut');
});

section('no single-grid assumptions are left in the source', () => {
  // The shortcuts that mean "the station's" (sim.world, rep.doors...) exist for the tests. Nothing under src/ may use them, or a second grid
  // would silently be given the station's tiles, doors or air. Naming the station on purpose (.station) is allowed in a few places.
  const files = [];
  const walk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const f = path.join(dir, e.name); if (e.isDirectory()) walk(f); else if (f.endsWith('.js')) files.push(f); } };
  walk(path.join(root, 'src'));
  const code = (text) => text.split('\n').map((l, n) => [n + 1, l.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '')]).filter(([, l]) => l.trim() && !/^\s*\*/.test(l));
  const shortcut = /\b(?:sim|this\.sim)\.(?:world|props|doors|atmos|power|nav|firedoors|built|tileLog)\b|\b(?:rep|this\.rep|g\.rep|game\.rep|replica)\.(?:world|props|doors|fdoors|power|built)\b/;
  const getter = /\bget (?:world|props|doors|atmos|power|nav|firedoors|built|tileLog|fdoors)\(\)/;
  const named = /\.station\b/;
  // who may name the station: the sim itself, what the director, the round report, the pets and the debug menu are about, and (until the view draws every grid) the client's start-up
  const mayNameStation = new Set(['sim/sim.js', 'sim/director.js', 'sim/round.js', 'sim/ai.js', 'sim/debug.js', 'client/state.js', 'client/game.js', 'client/view.js']);
  const bad = [], loose = [];
  for (const f of files) {
    const rel = path.relative(path.join(root, 'src'), f).replace(/\\/g, '/');
    for (const [n, l] of code(fs.readFileSync(f, 'utf8'))) {
      if (shortcut.test(l) && !getter.test(l)) bad.push(`${rel}:${n}: ${l.trim().slice(0, 90)}`);
      if (named.test(l) && !mayNameStation.has(rel)) loose.push(`${rel}:${n}: ${l.trim().slice(0, 90)}`);
    }
  }
  for (const b of bad) console.log('   ', b);
  for (const b of loose) console.log('   ', b);
  ok(bad.length === 0, 'no file under src/ uses the station shortcuts (sim.world, rep.doors, ...)');
  ok(loose.length === 0, 'only the allowed places name the station');
  ok(files.length > 50, 'the scan really read the source');
});

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
