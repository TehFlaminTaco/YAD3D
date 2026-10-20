// Grids: two grids (and two maps) in one real Sim, and a real client replica, to show that nothing leaks between them: node tools/gridtest.mjs
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadSimData } from '../src/sim/load.js';
import { initPhysics } from '../src/shared/physics.js';
import { Sim } from '../src/sim/sim.js';
import { Replica } from '../src/client/state.js';
import { SIM_DT, TILE } from '../src/shared/config.js';
import { place } from '../src/sim/inventory.js';
import { qYaw, qToYaw, tfPoint } from '../src/shared/math3.js';
import { KIND } from '../src/shared/config.js';
import { makeBlueprint, withGrids } from './gridkit.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = loadSimData(root);
await initPhysics();
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

// ---------------------------------------------------------------------------------------------------- the real level: shuttles docked at the station
/** A real round: the level's own map (the station and every shuttle docked at it), one player (an engineer) and `bots` NPCs. */
function realRound(bots = 0, opts = {}) {
  const sim = new Sim(DATA, { bots, ...opts });
  const inbox = [];
  const A = sim.addClient('Alice', (m) => inbox.push(m));
  sim.handle(A, { t: 'lobby', op: 'job', id: 'station_engineer' });
  sim.handle(A, { t: 'lobby', op: 'ready', v: true });
  sim.handle(A, { t: 'lobby', op: 'start' });
  const step = (sec) => { for (let k = 0; k < sec / SIM_DT; k++) sim.step(SIM_DT); };
  return { sim, A, a: A.mob, inbox, step };
}

/** Each door of a shuttle that opens onto the station: { grid, door, tile: the station tile beside it, back: the station tile behind that (to start a walk from), at: the door in the map }. */
function seamsOf(sim) {
  const st = sim.station, w = st.world, out = [];
  for (const g of sim.grids.values()) {
    if (g === st) continue;
    for (const door of g.doors) {
      const p = g.worldPoint(door.x, 0, door.z), c0 = Math.floor(p[0] / TILE), r0 = Math.floor(p[2] / TILE);
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const c = c0 + dc, r = r0 + dr, bc = c + dc, br = r + dr;
        if (w.kindAt(c, r) === KIND.FLOOR && w.kindAt(bc, br) === KIND.FLOOR && !w.solid[w.idx(bc, br)] && !w.dyn[w.idx(bc, br)] && !w.edge[w.idx(bc, br)]) { out.push({ grid: g, door, tile: [c, r], back: [bc, br], at: p }); break; }
      }
    }
  }
  return out;
}

const degrees = (g) => Math.round(qToYaw(g.tf.q) * 180 / Math.PI);

/** A direction (a unit vector in the map) along which a docked grid can fly away from the station without touching any of its walls or floors for 60 m (lattice is fine: it is not solid) (not every shuttle can leave every way: the arrival shuttle sits in a notch). */
function awayOf(sim, g) {
  const w = sim.station.world, tiles = [];
  for (let r = 0; r < g.world.H; r++) for (let c = 0; c < g.world.W; c++) if (g.world.kind[g.world.idx(c, r)] !== KIND.SPACE) tiles.push(g.worldPoint(c * TILE + 1, 0, r * TILE + 1));
  for (const d of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) {
    let clear = true;
    for (let m = 1; m <= 60 && clear; m++) for (const p of tiles) { const k = w.kindAt(Math.floor((p[0] + d[0] * m) / TILE), Math.floor((p[2] + d[2] * m) / TILE)); if (k !== KIND.SPACE && k !== KIND.LATTICE) { clear = false; break; } }
    if (clear) return d;
  }
  throw new Error(`${g.bp} cannot leave any way`);
}
const along = (p, v, m) => [p[0] + v[0] * m, 0, p[2] + v[2] * m];

/** A pod (they are sealed: a shuttle like the arrival one is open at one end, and would vent when it flew off) and the middle of a floor tile in it. */
function aPod(sim) {
  const g = [...sim.grids.values()].find((x) => x.kind === 'pod'), w = g.world;
  for (let i = 0; i < w.n; i++) if (w.kind[i] === KIND.FLOOR && !w.solid[i] && !w.doorAt.has(i)) return { g, x: (i % w.W) * TILE + 1, z: Math.floor(i / w.W) * TILE + 1 };
  throw new Error('no floor in the pod');
}

section('shuttles are docked grids', () => {
  const { sim, a } = realRound();
  const st = sim.station;
  const shuttles = [...sim.grids.values()].filter((g) => g !== st);
  ok(shuttles.length === 9 && shuttles.filter((g) => g.kind === 'pod').length === 4, 'the level docks five shuttles and four pods, each a grid of its own');
  ok(shuttles.every((g) => g.map === st.map && g.world.W < 20 && g.world.gravityOn), 'in the station\'s map, small, each with its own gravity');
  const turned = new Set(shuttles.map(degrees));
  ok(turned.has(0) && turned.has(90) && (turned.has(-90) || turned.has(270)), 'some are turned a quarter turn either way, as the dock needs');
  ok(st.world.neighbors.length === 9 && shuttles.every((g) => g.world.neighbors.length === 1 && g.world.neighbors[0].grid === st), 'each lies against the station and the station against each');
  const cov = (g) => { let n1 = 0, n2 = 0; for (const v of g.world.covered) { if (v === 1) n1++; else if (v === 2) n2++; } return [n1, n2]; };
  const [floorCov, wallCov] = cov(st);
  ok(floorCov > 50 && wallCov > 100, 'the station\'s space under them is covered: floor and wall');
  ok(shuttles.every((g) => cov(g)[0] > 0), 'and so is each one\'s space where the station is');
  const p = shuttles[0].worldPoint(15, 0, 15);
  ok(st.world.isOpenSpace(0, 0) && !st.world.isOpenSpace(Math.floor(p[0] / TILE), Math.floor(p[2] / TILE)), 'covered space is not open space');
  ok(a.grid === st && a.map === st.map, 'the player starts on the station');
  ok(shuttles.every((g) => { let best = 0; for (let i = 0; i < g.world.n; i++) if (g.atmos.isCell[i]) best = Math.max(best, g.atmos.pressureAt(i % g.world.W, Math.floor(i / g.world.W))); return best > 90; }), 'each has its own air');
});

section('the air does not leak at a docking seam', () => {
  const { sim, step } = realRound();
  const st = sim.station, seams = seamsOf(sim);
  ok(seams.length >= 8, `found the docking doors (${seams.length})`);
  const sm = seams.find((s) => s.grid.bp === 'arrival_box');
  const press = (g, c, r) => g.atmos.pressureAt(c, r);
  // open both doors of a seam and wait: the station corridor and the shuttle keep their air (nothing vents into the space between)
  const sDoor = st.world.doorAt.get(st.world.idx(...sm.tile));
  sim.openDoor(sDoor, null, true); sim.openDoor(sm.door, null, true);
  step(20);
  ok(press(st, ...sm.back) > 95, 'the station corridor beside it stays pressurized');
  const dc = Math.floor(sm.door.x / TILE), dr = Math.floor(sm.door.z / TILE);
  ok(press(sm.grid, dc, dr) > 95, 'and so does the shuttle with its door open');
  ok(!st.world.ventTiles().length && !sm.grid.world.ventTiles().length, 'neither has a hull breach');
  // a shuttle that empties does not pull the station's air after it
  sm.grid.atmos.o2.fill(0); sm.grid.atmos.n2.fill(0);
  step(5);
  ok(press(st, ...sm.back) > 90, 'the station\'s air stays when the shuttle\'s is gone');
});

section('walking on and off a docked shuttle', () => {
  const { sim, A, a, step } = realRound();
  const st = sim.station, seams = seamsOf(sim);
  const done = new Set(); let seq = 0;
  a.access = new Set(Array.from({ length: 300 }, (_, i) => i));                      // the docks of cargo and mining are not for engineers
  for (const sm of seams) {
    // one walk per shuttle (and per kind of turn), straight at the shuttle's door from two tiles back
    const key = sm.grid.bp + degrees(sm.grid);
    if (done.has(key)) continue;
    done.add(key);
    a.grid = st; a.map = st.map; a.x = sm.back[0] * TILE + 1; a.z = sm.back[1] * TILE + 1; a.vx = a.vz = 0; a.dirty = true;
    const yawWorld = Math.atan2(-(sm.at[0] - a.x), -(sm.at[2] - a.z));
    const worldYaw = () => a.yaw + qToYaw(a.grid.tf.q);
    let last = sim.worldPos(a), jump = 0;
    const speeds = [];
    let yawSeen = null, yawDrift = 0;
    for (let q = 0; q < 280 && a.grid !== sm.grid; q++) {                             // up to 14 seconds of walking, one input a tick, always facing the same way in the world
      sim.handle(A, { t: 'input', list: [{ seq: ++seq, dt: 0.05, f: 1, b: 0, l: 0, r: 0, run: 0, yaw: yawWorld - qToYaw(a.grid.tf.q), pitch: 0, g: a.grid.id }] });
      step(0.05);
      const w = sim.worldPos(a);
      jump = Math.max(jump, Math.hypot(w[0] - last[0], w[2] - last[2]));
      last = w;
      speeds.push(Math.hypot(a.vx, a.vz));
      const wy = worldYaw();
      yawSeen ??= wy;
      yawDrift = Math.max(yawDrift, Math.abs(Math.atan2(Math.sin(wy - yawSeen), Math.cos(wy - yawSeen))));
    }
    const tag = `${sm.grid.bp} (turned ${degrees(sm.grid)})`;
    ok(a.grid === sm.grid, `${tag}: walking through its door puts you on it`);
    ok(jump < 0.25, `${tag}: your place in the map never jumps (largest step ${jump.toFixed(3)} m: a walking pace is 0.17)`);
    ok(Math.hypot(a.vx, a.vz) > 2 && Math.max(...speeds) < 4.2, `${tag}: and you keep your speed`);
    ok(yawDrift < 0.05, `${tag}: and face the same way in the map (${yawDrift.toFixed(3)} rad off)`);
    const c = Math.floor(a.x / TILE), r = Math.floor(a.z / TILE), gw = sm.grid.world;
    ok(gw.inb(c, r) && gw.kind[gw.idx(c, r)] === KIND.FLOOR, `${tag}: onto its floor`);
    // and back out again
    for (let q = 0; q < 280 && a.grid !== st; q++) {
      sim.handle(A, { t: 'input', list: [{ seq: ++seq, dt: 0.05, f: 1, b: 0, l: 0, r: 0, run: 0, yaw: yawWorld + Math.PI - qToYaw(a.grid.tf.q), pitch: 0, g: a.grid.id }] });
      step(0.05);
    }
    ok(a.grid === st, `${tag}: and turning round, back out onto the station`);
  }
  ok(done.size >= 6, `walked through ${done.size} different docks`);
});

section('an input made in the old frame, just after a handover', () => {
  const { sim, A, a, step } = realRound();
  const st = sim.station, sm = seamsOf(sim).find((s) => s.grid.bp === 'mining_large');     // turned a quarter
  a.grid = sm.grid; a.map = st.map; a.x = 9; a.z = 9; a.vx = a.vz = 0;
  // the client made this facing in the station's frame (north); the server has already moved the player to the shuttle's, which is turned
  const yawStation = 0, expect = yawStation + sim.frameYaw(st, sm.grid);
  sim.handle(A, { t: 'input', list: [{ seq: 1, dt: 0.05, f: 0, b: 0, l: 0, r: 0, run: 0, yaw: yawStation, pitch: 0, g: st.id }] });
  step(0.1);
  ok(Math.abs(Math.atan2(Math.sin(a.yaw - expect), Math.cos(a.yaw - expect))) < 1e-9, 'it is turned into the frame the player is in now');
  sim.handle(A, { t: 'input', list: [{ seq: 2, dt: 0.05, f: 0, b: 0, l: 0, r: 0, run: 0, yaw: 0.7, pitch: 0, g: sm.grid.id }] });
  step(0.1);
  ok(near(a.yaw, 0.7, 1e-9), 'one made in this frame is taken as it is');
});

section('a docked hull is solid from the station\'s side too', () => {
  const { sim } = realRound();
  const st = sim.station, w = st.world;
  const mid = (c, r) => [c * TILE + 1, r * TILE + 1];
  let wallT = null, floorT = null, openT = null;
  for (let r = 0; r < w.H; r++) for (let c = 0; c < w.W; c++) {
    const i = w.idx(c, r);
    if (w.kind[i] !== KIND.SPACE) continue;
    if (w.covered[i] === 2 && !wallT) wallT = [c, r];
    if (w.covered[i] === 1 && !floorT) {
      const nb = w.neighbors.find((n) => { const [x, z] = mid(c, r); const q = n.world; const bc = Math.floor((n.a * x + n.b * z + n.tx) / TILE), br = Math.floor((n.c * x + n.d * z + n.tz) / TILE); return q.inb(bc, br) && q.kind[q.idx(bc, br)] === KIND.FLOOR; });
      const [x, z] = mid(c, r);
      if (nb && !nb.world.collidesTiles(nb.a * x + nb.b * z + nb.tx, nb.c * x + nb.d * z + nb.tz, 0.3, null, false)) floorT = [c, r];
    }
    if (!w.covered[i] && !openT) openT = [c, r];
  }
  ok(wallT && floorT && openT, 'found space under a docked wall, under a docked floor, and open');
  ok(w.collides(...mid(...wallT), 0.3), 'the space under a docked wall blocks you');
  ok(!w.collides(...mid(...floorT), 0.3), 'under a docked floor (nothing in the way) it does not');
  ok(!w.collides(...mid(...openT), 0.3), 'open space is not solid');
  // the station's own tiles still block as before, and the edge of the map is a wall
  ok(w.collides(-0.1, 100, 0.3), 'and the edge of the array is a wall');
});

section('the emergency shuttle comes and goes', () => {
  const { sim, A, inbox, step } = realRound(10);
  const st = sim.station, d = sim.director;
  const before = sim.grids.size;
  ok(!d.evacGrid && sim.docks.emergency?.bp === 'emergency_box', 'it is not there until it arrives, and the map says where it docks');
  inbox.length = 0;
  d.dockShuttle();
  step(0.1);
  const eg = d.evacGrid;
  ok(eg && sim.grids.size === before + 1 && eg.map === st.map && eg.kind === 'shuttle', 'docking adds it as a grid of the map');
  const added = inbox.filter((m) => m.t === 'ev').flatMap((m) => m.list).filter((e) => e.e === 'grid+');
  ok(added.length === 1 && added[0].g === eg.id && added[0].bp === 'emergency_box' && added[0].tf.p.length === 3, 'everyone is told, with its blueprint and pose');
  ok(st.world.neighbors.some((n) => n.grid === eg) && eg.world.neighbors.length === 1, 'it lies against the station');
  ok(d.seams.length >= 2 && d.seams.every((s) => st.world.kindAt(...s.tile) === KIND.FLOOR), 'and its doors open onto station floor');
  // a client that joins now is told about it too, and builds it
  const late = []; const C = sim.addClient('Cara', (m) => late.push(m));
  const w2 = late.find((m) => m.t === 'welcome');
  ok(w2.grids.some((g) => g.g === eg.id), 'a later joiner\'s welcome lists it');
  const rep = new Replica({ level: DATA.level, rects: DATA.rects }, { ...w2, you: C.id });
  ok(rep.grids.has(eg.id) && rep.station.world.neighbors.length === st.world.neighbors.length, 'and the replica has it, linked like the server');
  // the crew run for it (NPCs), and whoever is aboard has escaped
  // one of them is standing two tiles from a door: she walks to it, through it and is aboard
  const npc = [...sim.mobs.values()].find((m) => m.kind === 'human' && !m.client && !m.dead);
  const seam = d.seams[0], back = [seam.tile[0] + (seam.tile[0] - Math.floor(seam.at[0] / TILE)), seam.tile[1] + (seam.tile[1] - Math.floor(seam.at[1] / TILE))];
  npc.grid = st; npc.x = back[0] * TILE + 1; npc.z = back[1] * TILE + 1; npc.path = null; npc.evacOrdered = false; npc.boardTo = null;
  npc.access = new Set(Array.from({ length: 300 }, (_, i) => i));
  step(25);
  ok(npc.evacuated && npc.grid === eg, 'an NPC beside a door of it walks through and boards');
  step(60);
  const boarded = [...sim.mobs.values()].filter((m) => m.kind === 'human' && !m.client && m.evacuated);
  ok(boarded.length >= 2 && boarded.every((m) => m.grid === eg), `and others make their way there (${boarded.length} aboard)`);
  // it leaves: the grid goes, with everyone aboard
  late.length = 0;
  d.depart();
  step(40);
  ok(!sim.grids.has(eg.id) && !st.map.grids.has(eg.id) && st.world.neighbors.length === 9, 'departing removes it from the map');
  const evs = late.filter((m) => m.t === 'ev').flatMap((m) => m.list);
  const gone = evs.filter((e) => e.e === 'grid-');
  ok(gone.length === 1 && gone[0].g === eg.id, 'and everyone is told');
  for (const ev of evs) rep.apply(ev);
  ok(!rep.grids.has(eg.id) && rep.station.world.neighbors.length === 9, 'the replica follows');
  ok(boarded.every((m) => m.evacuated) && sim.round.state === 'ending', 'the people aboard stay escaped and the round ends');
  void A;
});

section('a grid that flies', () => {
  const { sim, A, a, inbox, step } = realRound();
  const st = sim.station, { g, x: px, z: pz } = aPod(sim);
  const home = { p: [...g.home.p], q: [...g.home.q] };
  const stNeighbors = st.world.neighbors.length, covered0 = st.world.covered.slice();
  ok(g.docked && sim.physics.mass(g) > 1000 && sim.physics.mass(st) > 20 * sim.physics.mass(g), 'every grid is a body with mass (the station far more than a shuttle)');
  // somebody stands in it, moving
  a.grid = g; a.map = g.map; a.x = px; a.z = pz; a.vx = 1.2; a.vz = -0.3; a.yaw = 0.4;
  const local = { x: a.x, z: a.z, vx: a.vx, vz: a.vz, yaw: a.yaw };
  const w0 = sim.worldPos(a);
  const away = awayOf(sim, g);
  const to = { p: along(home.p, away, 60), q: [...home.q] };
  sim.shuttles.fly(g, to);
  step(0.1);
  ok(!g.docked && sim.shuttles.flying(g) && st.world.neighbors.length === stNeighbors - 1 && g.world.neighbors.length === 0, 'it is let go: no longer docked, no longer against the station');
  ok(st.world.covered.some((v, i) => v !== covered0[i]), 'and the station\'s space where it was is space again');
  step(6);
  ok(Math.hypot(g.vel[0], g.vel[2]) > 3 && Math.hypot(g.tf.p[0] - home.p[0], g.tf.p[2] - home.p[2]) > 5, 'its engines have taken it somewhere');
  const sp = Math.hypot(g.vel[0], g.vel[2]);
  ok(sp <= 14.2, `at no more than its cruise speed (${sp.toFixed(1)} m/s)`);
  ok(a.x === local.x && a.z === local.z && a.vx === local.vx && a.vz === local.vz && a.yaw === local.yaw && a.grid === g, 'the person inside has not been moved at all: nothing of theirs changed, bit for bit');
  const w1 = sim.worldPos(a);
  ok(Math.hypot(w1[0] - w0[0], w1[2] - w0[2]) > 5, 'though where they are in the map has changed with the shuttle');
  step(25);
  ok(!sim.shuttles.flying(g) && Math.hypot(g.tf.p[0] - to.p[0], g.tf.p[2] - to.p[2]) < 0.1 && Math.hypot(g.vel[0], g.vel[2]) < 0.3, 'it comes to rest on its mark');
  ok(a.x === local.x && a.vx === local.vx, 'the rider is still untouched');
  // and back home, held there exactly
  sim.shuttles.fly(g, home, { dock: true });
  step(30);
  ok(g.docked && !sim.shuttles.flying(g), 'sent home and docked, it is held');
  ok(Math.abs(g.tf.p[0] - home.p[0]) < 1e-9 && Math.abs(g.tf.p[2] - home.p[2]) < 1e-9 && g.tf.q.every((v, i) => Math.abs(v - home.q[i]) < 1e-9) && !g.vel.some((v) => v), 'exactly on its mark, standing still');
  ok(st.world.neighbors.length === stNeighbors && st.world.covered.every((v, i) => v === covered0[i]), 'and it lies against the station as before');
  ok(a.x === local.x && a.z === local.z && a.vx === local.vx && a.grid === g, 'the whole trip never touched the rider');
  void A; void inbox;
});

section('a grid that spins', () => {
  const { sim, a, step } = realRound();
  const { g, x: px, z: pz } = aPod(sim);
  a.grid = g; a.map = g.map; a.x = px; a.z = pz; a.vx = 0.7; a.vz = 0; a.yaw = 1;
  const local = { x: a.x, z: a.z, vx: a.vx, yaw: a.yaw };
  const out = { p: along(g.home.p, awayOf(sim, g), 50), q: [...g.home.q] };
  sim.shuttles.fly(g, out);
  step(30);
  sim.physics.setVel(g, [0, 0, 0], [0, 0.5, 0]);
  const w0 = sim.worldPos(a);
  const q0 = qToYaw(g.tf.q);
  step(4);
  const turned = Math.atan2(Math.sin(qToYaw(g.tf.q) - q0), Math.cos(qToYaw(g.tf.q) - q0));
  ok(Math.abs(turned - 2) < 0.1, `it turns at the rate it was set (${turned.toFixed(2)} rad in 4 s)`);
  ok(Math.abs(g.ang[1] - 0.5) < 0.01, 'and its angular velocity is read back');
  ok(a.x === local.x && a.z === local.z && a.vx === local.vx && a.yaw === local.yaw, 'the rider in a spinning grid is not touched either');
  const w1 = sim.worldPos(a);
  ok(Math.hypot(w1[0] - w0[0], w1[2] - w0[2]) > 1, 'their place in the map swings round with it');
  // the way the world position follows the grid: still what the pose says it is
  const expect = tfPoint(g.tf, [a.x, 0, a.z]);
  ok(near(w1[0], expect[0], 1e-9) && near(w1[2], expect[2], 1e-9), 'exactly where the grid\'s pose puts them');
});

section('a grid that hits another', () => {
  const { sim, step } = realRound();
  const st = sim.station, pod = [...sim.grids.values()].find((x) => x.kind === 'pod');
  const hits = [];
  const orig = sim.gridImpact.bind(sim);
  sim.gridImpact = (x, y, f) => { hits.push([x?.bp, y?.bp, f]); orig(x, y, f); };
  const away = awayOf(sim, pod), home = { p: [...pod.home.p], q: [...pod.home.q] };
  sim.shuttles.fly(pod, { p: along(home.p, away, 40), q: [...home.q] });
  step(25);
  ok(Math.hypot(pod.tf.p[0] - home.p[0] - away[0] * 40, pod.tf.p[2] - home.p[2] - away[2] * 40) < 0.2, 'it flew out and stopped');
  const hard0 = hits.filter(([, , f]) => f >= 30000).length;
  // now flown at the station, with a mark well inside the hull: it gets up to speed and hits
  sim.shuttles.fly(pod, { p: along(home.p, away, -15), q: [...home.q] });
  step(20);
  const dist = Math.hypot(pod.tf.p[0] - home.p[0], pod.tf.p[2] - home.p[2]);
  ok(dist < 1 && Math.hypot(pod.tf.p[0] - (home.p[0] - away[0] * 15), pod.tf.p[2] - (home.p[2] - away[2] * 15)) > 10, `a grid flown into another is stopped by it, not through it (it ended ${dist.toFixed(1)} m from its dock, 15 short of its mark)`);
  ok(hits.filter(([x, y, f]) => f >= 30000 && ((x === 'escape_pod_default' && y === 'station') || (y === 'escape_pod_default' && x === 'station'))).length > hard0, 'and the collision is reported, hard');
  ok(pod.lastImpact !== undefined && st.lastImpact === pod.lastImpact, 'with both grids marked as hit');
});

section('flying grids reach the clients', () => {
  const { sim, A, inbox, step } = realRound();
  const { g } = aPod(sim);
  const welcome = inbox.find((m) => m.t === 'welcome');
  const rep = new Replica({ level: DATA.level, rects: DATA.rects }, { ...welcome, you: A.id });
  const rg = rep.grids.get(g.id);
  let clock = 0, snaps = 0, seen = [];
  const feed = () => { for (const m of inbox.splice(0)) { if (m.t === 'ev') for (const ev of m.list) rep.apply(ev); else if (m.t === 'snap') { rep.applySnap(m, clock); snaps++; if (m.grids) seen.push(...m.grids.map((r) => r[0])); } } };
  const run = (sec) => { for (let k = 0; k < sec / 0.05; k++) { sim.step(0.05); clock += 0.05; feed(); } };
  run(1);
  ok(!seen.includes(g.id), 'a docked grid is not in the snapshots');
  const to = { p: along(g.home.p, awayOf(sim, g), 50), q: [...g.home.q] };
  sim.shuttles.fly(g, to);
  run(0.2);
  ok(rg.docked === false && rep.station.world.neighbors.length === 8, 'the replica is told it is let go, and relinks');
  run(5);
  ok(seen.includes(g.id) && rg.buf.length > 0, 'while it moves its pose is in the snapshots');
  // drawn between two snapshots, behind the newest
  rep.updatePoses(clock - 0.13);
  const dh = (q) => Math.hypot(q[0] - g.home.p[0], q[2] - g.home.p[2]);
  ok(dh(rg.tf.p) < dh(g.tf.p) && dh(g.tf.p) - dh(rg.tf.p) < 3, `the client draws it where it was a moment ago (${dh(rg.tf.p).toFixed(2)} from home against ${dh(g.tf.p).toFixed(2)})`);
  rep.updatePoses(clock + 1);
  ok(Math.hypot(rg.tf.p[0] - g.tf.p[0], rg.tf.p[2] - g.tf.p[2]) < 0.5, 'and at the newest when it has caught up');
  const rows = seen.length;
  run(30);
  ok(!sim.shuttles.flying(g), 'it arrives');
  const before = seen.length;
  run(2);
  ok(seen.length === before, 'and nothing more is sent once it stands still');
  sim.shuttles.fly(g, { p: [...g.home.p], q: [...g.home.q] }, { dock: true });
  run(40);
  ok(g.docked && rg.docked && rg.buf.length === 0 && near(rg.tf.p[0], g.home.p[0], 1e-9) && near(rg.tf.p[2], g.home.p[2], 1e-9), 'docking tells the client exactly where it is held');
  ok(rep.station.world.neighbors.length === 9 && rg.world.neighbors.length === 1, 'and it lies against the station again, on both sides');
  void rows;
});

section('the debug menu flies grids about', () => {
  const { sim, A, a, inbox, step } = realRound(0, { debug: true });
  const dbg = (op, extra = {}) => { sim.handle(A, { t: 'dbg', op, ...extra }); step(0.1); };
  const evs = () => inbox.filter((m) => m.t === 'ev').flatMap((m) => m.list);
  inbox.length = 0;
  dbg('grid', { what: 'list' });
  const list = evs().find((e) => e.e === 'dbg' && e.k === 'grids');
  ok(list && list.grids.length === 10 && list.grids.every((g) => g.docked) && list.grids.some((g) => g.kind === 'station'), 'the list has every grid of the map, all docked');
  const pod = list.grids.find((g) => g.kind === 'pod'), g = sim.grids.get(pod.id);
  const home = { p: [...g.home.p], q: [...g.home.q] };
  dbg('grid', { what: 'out', id: g.id });
  step(20);
  ok(!g.docked && Math.hypot(g.tf.p[0] - home.p[0], g.tf.p[2] - home.p[2]) > 40, 'Out lets a shuttle go and flies it clear');
  dbg('grid', { what: 'spin', id: g.id, w: 0.5 });
  step(2);
  ok(Math.abs(g.ang[1] - 0.5) < 0.02, 'Spin turns it');
  dbg('grid', { what: 'stop', id: g.id });
  step(0.5);
  ok(Math.hypot(...g.vel) < 0.01 && Math.abs(g.ang[1]) < 0.01, 'Stop stops it, and its turning');
  dbg('grid', { what: 'board', id: g.id });
  ok(a.grid === g && g.world.kind[g.world.idx(Math.floor(a.x / TILE), Math.floor(a.z / TILE))] === KIND.FLOOR, 'Board puts you on its floor');
  dbg('grid', { what: 'home', id: g.id });
  step(1);
  ok(sim.shuttles.flying(g), 'Home sets it flying back');
  void inbox;
});

section('the emergency shuttle flies in and out', () => {
  const { sim, A, inbox, step } = realRound(0);
  const st = sim.station, d = sim.director;
  inbox.length = 0;
  ok(d.callShuttle('auto') && d.evacState === 'called' && !d.evacGrid, 'called, it is on its way but not there');
  d.evacTimer = 26;
  step(5);
  ok(!d.evacGrid, 'not yet in sight');
  step(2);
  const eg = d.evacGrid;
  ok(eg && !eg.docked && sim.shuttles.flying(eg) && d.evacState === 'called', 'twenty seconds out it appears, flying');
  const dock = sim.docks.emergency;
  const far = Math.hypot(eg.tf.p[0] - dock.p[0], eg.tf.p[2] - dock.p[2]);
  ok(far > 100 && far < 160, `a good way off along the way it will come in (${far.toFixed(0)} m)`);
  const appeared = inbox.filter((m) => m.t === 'ev').flatMap((m) => m.list).filter((e) => e.e === 'grid+');
  ok(appeared.length === 1 && appeared[0].docked === false && Math.abs(Math.hypot(appeared[0].tf.p[0] - dock.p[0], appeared[0].tf.p[2] - dock.p[2]) - far) < 15, 'everyone is told, with it where it is and not docked');
  ok(Math.abs(d.approach[0]) + Math.abs(d.approach[2]) > 0.9 && st.world.neighbors.every((n) => n.grid !== eg), 'it comes in from outside, and is not against the station yet');
  let t = 0;
  while (d.evacState === 'called' && t < 40) { step(0.5); t += 0.5; }
  ok(d.evacState === 'docked' && eg.docked && t < 25, `it arrives and docks (after ${t.toFixed(1)} s)`);
  ok(near(eg.tf.p[0], dock.p[0], 1e-9) && near(eg.tf.p[2], dock.p[2], 1e-9) && eg.world.neighbors.length === 1 && st.world.neighbors.some((n) => n.grid === eg), 'exactly at its dock, against the station');
  const evs = inbox.filter((m) => m.t === 'ev').flatMap((m) => m.list);
  ok(evs.filter((e) => e.e === 'grid~' && e.g === eg.id && e.docked).length === 1, 'and the client is told it is held');
  // it leaves again
  inbox.length = 0;
  d.depart();
  step(1);
  ok(!eg.docked && sim.shuttles.flying(eg) && st.world.neighbors.every((n) => n.grid !== eg), 'departing lets it go');
  step(35);
  ok(!sim.grids.has(eg.id), 'and it is gone, far out');
  const gone = inbox.filter((m) => m.t === 'ev').flatMap((m) => m.list).filter((e) => e.e === 'grid-');
  ok(gone.length === 1 && gone[0].g === eg.id, 'with everybody told');
  void A;
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
