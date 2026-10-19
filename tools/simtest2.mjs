// Behavioural regression tests for the sim: node tools/simtest2.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSimData } from '../src/sim/load.js';
import { Sim } from '../src/sim/sim.js';
import { SIM_DT, TILE } from '../src/shared/config.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = loadSimData(root);
let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) pass++; else { fail++; console.log('  FAIL:', name); } };

function setup() {
  const sim = new Sim(DATA, { bots: 0 });
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
  const hand = (m, it, i = m.active) => { m.hands[i] = it; it.loc = { t: 'hand', mob: m, i }; };
  const tileCenter = (m, c, r) => { m.x = c * TILE + 1; m.z = r * TILE + 1; };
  // park both players far apart in open floor so tests don't disturb each other
  const floorTiles = [];
  for (let i = 0; i < sim.world.W * sim.world.H; i += 37) if (sim.world.kind[i] === 1 && !sim.world.solid[i] && sim.world.areas[sim.world.areaIdx[i]].c === 'hallway') floorTiles.push(i);
  return { sim, A, B, a: A.mob, b: B.mob, inbox, step, evs, hand, tileCenter, floorTiles };
}

function section(name, fn) { console.log(name); fn(); }

section('spawn + outfit', () => {
  const { a, b } = setup();
  ok(a && b && a !== b, 'both players spawned');
  ok(a.job === 'station_engineer' && b.job === 'medical_doctor', 'jobs assigned');
  ok(a.worn.uniform && a.worn.id && a.worn.back?.contents.length, 'engineer is dressed with backpack contents');
  ok(a.access.has(10), 'engineer ID carries ENGINE access (10)');
  ok(b.worn.ears?.path.includes('headset_med'), 'doctor has a medical headset');
});

section('inventory', () => {
  const { sim, A, a, inbox, step, evs, hand } = setup();
  const rec = [...sim.floor.values()].find((f) => !sim.world.solid[f.r * sim.world.W + f.c] && f.item.w <= 3);
  a.x = rec.c * TILE + 1; a.z = rec.r * TILE + 1; a.yaw = 0;
  const id0 = rec.item.id;
  sim.handle(A, { t: 'click', target: { k: 'item', id: id0 } });
  step(0.1);
  ok(a.hands[a.active]?.id === id0, 'click picks floor item into active hand');
  ok(!sim.floor.has(id0), 'item removed from floor');
  sim.handle(A, { t: 'key', k: 'swap' });
  ok(a.active === 1, 'swap hands');
  sim.handle(A, { t: 'key', k: 'swap' });
  sim.handle(A, { t: 'key', k: 'drop' });
  ok(sim.floor.has(id0) && !a.hands[0], 'drop puts item back on the floor');

  const oldHat = a.worn.head;
  sim.actions.inventory(A, { op: 'unequip', slot: 'head' });
  ok(a.hands[a.active] === oldHat && !a.worn.head, 'unequip moves worn item to hand');
  sim.handle(A, { t: 'key', k: 'equip' });
  ok(a.worn.head === oldHat && !a.hands[a.active], 'E equips the held hat back to its slot');

  const crowbar = sim.newItem('/obj/item/crowbar');
  hand(a, crowbar, 0); a.active = 0;
  const bp = a.worn.back;
  sim.handle(A, { t: 'inv', op: 'use', item: bp.id });
  ok(bp.contents.includes(crowbar) && !a.hands[0], 'using a held item on the backpack stores it');
  const box = bp.contents.find((i) => i.def.storage);
  const big = sim.newItem('/obj/item/storage/backpack'); hand(a, big, 0);
  sim.handle(A, { t: 'inv', op: 'use', item: box.id });
  step(0.1);
  ok(!box.contents.includes(big), 'a backpack does not fit in a survival box (size rule)');
  ok(evs(inbox.a, 'msg').some((m) => /too big/.test(m.text || '')), 'player is told it is too big');

  // quick draw from belt with empty hand
  a.hands[0] = a.hands[1] = null;
  const beltN = a.worn.belt.contents.length;
  sim.handle(A, { t: 'key', k: 'equip' });
  ok(a.hands[a.active] && a.worn.belt.contents.length === beltN - 1, 'empty-handed E draws from the belt');
  // pockets take small items only
  const bigItem = sim.newItem('/obj/item/storage/toolbox/mechanical');
  ok(sim.items.get(bigItem.id) && !(bigItem.w <= 2), 'toolbox is not pocket-sized');
});

section('intents + combat', () => {
  const { sim, A, B, a, b, inbox, step, evs, hand, floorTiles } = setup();
  a.x = 62; a.z = 100; // wherever; make both stand in the same free tile row
  const t = floorTiles[0], W = sim.world.W;
  a.x = (t % W) * TILE + 1; a.z = Math.floor(t / W) * TILE + 1;
  b.x = a.x + 1.0; b.z = a.z; a.yaw = -Math.PI / 2; a.pitch = 0;
  sim.handle(A, { t: 'key', k: 'intent', v: 0 });
  const b0 = b.body.brute;
  sim.handle(A, { t: 'click', target: { k: 'mob', id: b.id } });
  ok(b.body.brute === b0, 'help intent does not hurt');
  step(1);
  sim.handle(A, { t: 'key', k: 'intent', v: 3 });
  sim.handle(A, { t: 'click', target: { k: 'mob', id: b.id } });
  step(0.1);
  ok(b.body.brute > b0, 'harm intent punches');
  ok(evs(inbox.b, 'msg').some((m) => /punched/.test(m.text || '')), 'bystander sees the attack message');
  // doctor heals himself with a bruise pack
  const all = (m) => { const out = []; const walk = (i) => { out.push(i); (i.contents || []).forEach(walk); }; for (const k in m.worn) if (m.worn[k]) walk(m.worn[k]); return out; };
  const pack = all(b).find((i) => i.def.heal);
  ok(!!pack, 'doctor carries a healing item');
  hand(b, pack, 0); b.active = 0;
  b.body.damage('brute', 30, 'test');
  const before = b.body.brute;
  sim.handle(B, { t: 'key', k: 'activate' });
  ok(b.body.brute < before, 'activating a healing item treats yourself');
});

section('doors', () => {
  const { sim, A, a, b, step } = setup();
  const free = sim.doors.findIndex((d) => !d.a.length && !d.o.length && sim.power.doorsWork(d) && sim.world.kindAt(d.c, d.r + 1) === 1);
  const door = sim.doors[free];
  b.x = 2; b.z = 2;
  a.x = door.x; a.z = door.z + 1.2;
  step(0.5);
  ok(door.state === 'opening' || door.state === 'open', 'unrestricted door opens when a player walks up');
  const rd = sim.doors.findIndex((d) => d.a.length && !d.a.some((n) => a.access.has(n)) && sim.world.kindAt(d.c, d.r + 1) === 1);
  const locked = sim.doors[rd];
  a.x = locked.x; a.z = locked.z + 1.1;
  step(0.5);
  ok(locked.state === 'closed', 'restricted door stays shut for an engineer without its access');
  sim.handle(A, { t: 'click', target: { k: 'door', idx: rd } });
  step(0.1);
  ok(locked.state === 'closed', 'clicking it does not bypass access');
});

section('hull breach + repair', () => {
  const { sim, A, a, b, step, inbox, evs, hand } = setup();
  const w = sim.world;
  const win = sim.director.findExteriorWindows()[5];
  const wc = win % w.W, wr = Math.floor(win / w.W);
  const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([x, y]) => [wc + x, wr + y]).find(([x, y]) => sim.atmos.isCell[y * w.W + x]);
  b.x = 2; b.z = 2;
  sim.breachTile(wc, wr, 'meteor');
  ok(w.breached.has(win) && w.kind[win] === 0, 'meteor opens the hull');
  step(30);
  ok(sim.atmos.pressureAt(nb[0], nb[1]) < 30, 'room decompresses through the breach');
  const sheet = sim.newItem('/obj/item/stack/sheet/metal', { amount: 3 });
  a.x = nb[0] * TILE + 1; a.z = nb[1] * TILE + 1; a.yaw = Math.atan2(-(wc - nb[0]), -(wr - nb[1]));
  a.body.brute = 0; a.body.oxy = 0; a.dead = false;
  hand(a, sheet);
  const welder = sim.newItem('/obj/item/weldingtool'); welder.lit = true;
  a.worn.belt.contents.push(welder); welder.loc = { t: 'box', box: a.worn.belt };
  sim.handle(A, { t: 'click', target: { k: 'breach', c: wc, r: wr } });
  step(4);
  ok(!w.breached.has(win) && w.kind[win] === 2, 'metal sheet + lit welder patch the breach');
  ok(sheet.amount === 2, 'one sheet consumed');
  a.x = 4; a.z = 4;
  step(45);
  ok(sim.atmos.pressureAt(nb[0], nb[1]) > 60, 'vents refill the room after patching');
});

section('chat', () => {
  const { sim, A, a, b, step, inbox, evs, floorTiles } = setup();
  const t = floorTiles[3], W = sim.world.W;
  a.x = (t % W) * TILE + 1; a.z = Math.floor(t / W) * TILE + 1;
  b.x = a.x + 1.5; b.z = a.z;
  inbox.b.length = 0;
  sim.handle(A, { t: 'say', text: 'hello there', mode: 'say' });
  step(0.1);
  ok(evs(inbox.b, 'msg').some((m) => m.k === 'say' && m.text === 'hello there'), 'say is heard nearby');
  sim.handle(A, { t: 'say', text: ':e engine check', mode: 'say' });
  step(0.1);
  ok(!evs(inbox.b, 'msg').some((m) => m.k === 'radio' && m.ch === 'engineering'), 'doctor does not hear the engineering channel');
  sim.handle(A, { t: 'say', text: ';anyone around?', mode: 'say' });
  step(0.1);
  ok(evs(inbox.b, 'msg').some((m) => m.k === 'radio' && m.ch === 'common'), 'common radio reaches the doctor');
  b.x = a.x + 40;
  inbox.b.length = 0;
  sim.handle(A, { t: 'say', text: 'can you hear me', mode: 'say' });
  step(0.1);
  ok(!evs(inbox.b, 'msg').some((m) => m.k === 'say'), 'say does not carry across the station');
});

section('terminals', () => {
  const { sim, A, a, step } = setup();
  sim.power.setState('battery');
  const t = [...Array(sim.world.W * sim.world.H).keys()].find((i) => sim.world.kind[i] === 1 && !sim.world.solid[i]);
  a.x = (t % sim.world.W) * TILE + 1; a.z = Math.floor(t / sim.world.W) * TILE + 1;
  sim.terminals.open(A, 'power', { name: 'power monitor' });
  ok(A.term, 'terminal opened');
  sim.handle(A, { t: 'term', op: 'act', idx: 1 }); step(0.2);
  ok(sim.power.restartStep === 0 && sim.time < sim.power.lockoutUntil, 'wrong order scrams the engine');
  step(9);
  sim.handle(A, { t: 'term', op: 'act', idx: 0 }); step(3);
  sim.handle(A, { t: 'term', op: 'act', idx: 1 }); step(3);
  sim.handle(A, { t: 'term', op: 'act', idx: 2 }); step(3);
  ok(sim.power.state === 'normal', 'engine restart sequence restores power');
});

section('drag and drop', () => {
  const { sim, A, a, step, hand, floorTiles } = setup();
  const W = sim.world.W;
  // stand in an open hallway and put a crowbar on the floor next to us
  const t = floorTiles.find((i) => [[1, 0], [2, 0], [-1, 0]].every(([dc, dr]) => !sim.world.solid[i + dc + dr * W]));
  a.x = (t % W) * TILE + 1; a.z = Math.floor(t / W) * TILE + 1;
  a.hands[0] = a.hands[1] = null;
  const bar = sim.newItem('/obj/item/crowbar');
  hand(a, bar, 0);
  sim.handle(A, { t: 'inv', op: 'move', item: bar.id, to: { t: 'floor', x: a.x + 1.5, z: a.z } });
  const rec = sim.floor.get(bar.id);
  ok(rec && Math.abs(rec.x - (a.x + 1.5)) < 0.01, 'held item is placed exactly where it was dropped');
  sim.handle(A, { t: 'inv', op: 'move', item: bar.id, to: { t: 'floor', x: a.x + 2.2, z: a.z + 0.3 } });
  ok(Math.abs(sim.floor.get(bar.id)?.x - (a.x + 2.2)) < 0.01, 'a floor item can be dragged along the floor');
  sim.handle(A, { t: 'inv', op: 'move', item: bar.id, to: { t: 'hand', i: 1 } });
  ok(a.hands[1] === bar && !sim.floor.has(bar.id), 'a floor item can be dragged straight into a hand');
  sim.handle(A, { t: 'inv', op: 'move', item: bar.id, to: { t: 'floor', x: a.x + 30, z: a.z } });
  ok(a.hands[1] === bar, 'cannot drop out of reach');
  sim.handle(A, { t: 'inv', op: 'move', item: bar.id, to: { t: 'floor', x: a.x + 1.2, z: a.z } });
  sim.handle(A, { t: 'inv', op: 'move', item: bar.id, to: { t: 'box', id: a.worn.back.id } });
  ok(a.worn.back.contents.includes(bar), 'a floor item can be dragged into the backpack');
  const far = sim.newItem('/obj/item/wrench');
  const { place: placeFn } = { place: (it, x, z) => { sim.floor.set(it.id, { item: it, x, y: 0, z, c: Math.floor(x / 2), r: Math.floor(z / 2) }); it.loc = { t: 'floor' }; } };
  placeFn(far, a.x + 20, a.z);
  sim.handle(A, { t: 'inv', op: 'move', item: far.id, to: { t: 'hand', i: 0 } });
  ok(!a.hands[0] && sim.floor.has(far.id), 'cannot grab things out of reach');
  const tool = sim.newItem('/obj/item/screwdriver');
  hand(a, tool, 0);
  a.cool = 0;
  sim.handle(A, { t: 'inv', op: 'throw', item: tool.id, at: [a.x + 6, 0.5, a.z] });
  const tr = sim.floor.get(tool.id);
  ok(tr && tr.x > a.x + 0.4 && Math.abs(tr.z - a.z) < 1.2, 'throwing at a point sends it that way');
  step(0.1);

  // hostile or buggy clients: junk must be ignored, never turned into NaN positions or phantom hands
  for (const at of [[a.x + 5, 'x', a.z], [NaN, 1, 1], null, 'north', [1, 2]]) {
    const t2 = sim.newItem('/obj/item/crowbar'); hand(a, t2, 0); a.cool = 0; a.pitch = 0;
    sim.handle(A, { t: 'inv', op: 'throw', item: t2.id, at });
    ok(a.hands[0] === t2 && Number.isFinite(a.pitch) && Number.isFinite(a.yaw), 'a throw with a malformed target is ignored: ' + JSON.stringify(at));
    a.hands[0] = null; sim.items.delete(t2.id);
  }
  const phantom = sim.newItem('/obj/item/crowbar'); hand(a, phantom, 0); a.hands[1] = null;
  sim.handle(A, { t: 'inv', op: 'move', item: phantom.id, to: { t: 'hand', i: 5 } });
  ok(a.hands.length === 2 && a.hands.every((h) => h === null || a.hands.indexOf(h) < 2), 'cannot move an item into a third hand');
  ok(a.hands[0] === phantom || a.hands[1] === phantom, 'the item is still in one of the two real hands');
});

section('death -> ghost', () => {
  const { sim, B, b, step } = setup();
  b.body.damage('brute', 500, 'test');
  step(0.2);
  ok(B.state === 'ghost' && !B.mob && b.dead, 'a dead player becomes a ghost');
});

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
