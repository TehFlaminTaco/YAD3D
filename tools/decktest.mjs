// Stacked decks: a grid of two floors, walked, fallen through, breathed in and looked at from a client: node tools/decktest.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSimData } from '../src/sim/load.js';
import { initPhysics } from '../src/shared/physics.js';
import { Sim } from '../src/sim/sim.js';
import { Replica } from '../src/client/state.js';
import { SIM_DT, TILE, DECK_H, KIND } from '../src/shared/config.js';
import { stepMovement } from '../src/shared/movement.js';
import { place } from '../src/sim/inventory.js';
import { LightField } from '../src/render/lighting.js';
import { makeBlueprint, withGrids } from './gridkit.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = loadSimData(root);
await initPhysics();
let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) pass++; else { fail++; console.log('  FAIL:', name); } };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const section = (name, fn) => { console.log(name); fn(); };

// Two decks. The west half of the upper deck is a hole through to the room below; a stair on the lower deck climbs east onto the upper floor.
const DECKS = [
  [
    '#########',
    '#.......#',
    '#.......#',
    '#..>....#',
    '#.......#',
    '#.......#',
    '#########',
  ],
  [
    '#########',
    '#   ....#',
    '#   ....#',
    '#   ....#',
    '#   ....#',
    '#   ....#',
    '#########',
  ],
];
const EAST = -Math.PI / 2, WEST = Math.PI / 2;

function setup() {
  const data = withGrids(DATA, { decks: makeBlueprint(DATA.level, DECKS) }, [{ bp: 'decks', kind: 'shuttle', p: [400, 0, 400], q: [0, 0, 0, 1] }]);
  const sim = new Sim(data, { bots: 0 });
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
  const D = [...sim.grids.values()].find((g) => g.bp === 'decks');
  const stand = (m, c, r, l = 0) => { m.grid = D; m.map = D.map; m.x = c * TILE + 1; m.z = r * TILE + 1; m.l = l; m.vx = m.vz = 0; m.cool = 0; m.stunned = 0; };
  let seq = 5000;
  /** Walk player `m` of client `C` along `yaw` for `sec` seconds, half a second of input at a time. */
  const walk = (C, m, yaw, sec) => {
    for (let t = 0; t < sec - 1e-9; t += 0.5) {
      const list = Array.from({ length: 10 }, () => ({ seq: seq++, dt: 0.05, f: 1, b: 0, l: 0, r: 0, run: 0, yaw, pitch: 0, g: m.grid.id }));
      sim.handle(C, { t: 'input', list });
      step(0.5);
    }
  };
  const said = (inb) => evs(inb, 'msg').map((e) => e.text || '');
  return { sim, data, A, B, a: A.mob, b: B.mob, inbox, step, evs, said, D, stand, walk };
}

section('the model', () => {
  const { D } = setup();
  const w = D.world, WH = w.W * w.H;
  ok(w.levels === 2 && w.n === 9 * 7 * 2 && w.kind.length === w.n && w.stairs.length === w.n, 'a grid with two decks has twice the tiles, in every array');
  ok(w.kindAt(5, 2, 1) === KIND.FLOOR && w.kindAt(2, 2, 1) === KIND.SPACE && w.kindAt(2, 2, 0) === KIND.FLOOR, 'the upper floor is there, and over the west half there is a hole');
  ok(w.stairs[w.idx(3, 3, 0)] === 4 && w.stairs[w.idx(3, 3, 1)] === 0, 'the stair climbs east from its tile');
  ok(w.idx(2, 3, 1) === WH + w.idx(2, 3, 0) && w.levelOf(w.idx(2, 3, 1)) === 1, 'a tile of the upper deck is a deck\'s worth of indexes up');
  ok(w.hasGravity(5 * TILE + 1, 2 * TILE + 1, 1) === true && w.hasGravity(2 * TILE + 1, 2 * TILE + 1, 1) === false, 'there is gravity on the upper floor and none over the hole');
  ok(w.restDeck(5, 2, 1) === 1 && w.restDeck(2, 2, 1) === 0, 'something dropped over the floor stays on it; over the hole it comes to rest below');
  ok(D.bounds()[2] === 8, 'the grid is as big as its decks');
  const flat = new Sim(withGrids(DATA, {}, []), { bots: 0 });
  ok(flat.station.world.levels === 1 && flat.station.world.stairs.length === flat.station.world.n, 'a grid of one deck is as it was');
});

section('walking, stairs, falling', () => {
  const { sim, B, b, inbox, step, evs, said, D, stand, walk } = setup();
  const w = D.world;
  // up the stair: walk east along the middle of the room, over the stair, and out of it
  stand(b, 1, 3);
  walk(B, b, EAST, 2.4);
  ok(b.l === 1 && b.x > 4 * TILE && Math.abs(b.z - (3 * TILE + 1)) < 0.4, 'walking off the end of the stair takes you up onto the upper floor');
  ok(b.grid === D && b.body.brute === 0, 'and it is not a fall');
  // the upper deck is its own place: its walls are in the way, the lower deck's are not
  walk(B, b, EAST, 3);
  ok(b.l === 1 && b.x < 8 * TILE && !w.collides(b.x, b.z, 0.32, null, false, 1), 'on the upper deck its east wall stops you');
  // walking back west goes into the hole over the stair: you come down onto it, and it takes the fall
  inbox.b.length = 0;
  walk(B, b, WEST, 2.2);
  ok(b.l === 0 && b.body.brute === 0 && b.stunned === 0, 'stepping off the upper floor above the stair puts you on the stair, and nothing hurts');
  ok(!said(inbox.b).some((t) => /crash/.test(t)), 'with no crash to read about');
  // anywhere else the hole is a fall
  stand(b, 5, 2, 1);
  b.body.brute = 0;
  inbox.b.length = 0;
  walk(B, b, WEST, 2);
  step(0.1);
  ok(b.l === 0 && b.x < 4 * TILE, 'walking west on the upper floor drops you through the hole');
  const hurt = 5 ** 1.5;
  ok(Math.abs(b.body.brute - hurt) < 0.6, `and it hurts as TG says, (5 * decks) ** 1.5 = ${hurt.toFixed(1)} brute (${b.body.brute.toFixed(1)})`);
  ok(b.stunned > 2.5, 'and knocks you down for five seconds a deck (some of it is spent by the time we look)');
  ok(said(inbox.b).includes('You crash into the floor with a sickening noise!'), 'the message is the one living.dm sends you');
  void sim; void evs;
});

section('somebody watching', () => {
  const { A, B, a, b, inbox, said, D, stand, walk } = setup();
  stand(a, 6, 4, 0);
  stand(b, 5, 2, 1);
  inbox.a.length = 0;
  walk(B, b, WEST, 2);
  const t = said(inbox.a);
  ok(t.some((x) => /^Bob falls through the open space!$/.test(x)) || t.some((x) => /falls through the open space!/.test(x)), 'someone nearby is told what they saw');
  ok(t.some((x) => /crashes into the floor with a sickening noise!/.test(x)), 'and how it ended');
  void A; void D;
});

section('what is on a deck is on that deck', () => {
  const { sim, B, b, inbox, step, evs, D, stand } = setup();
  const over = place(sim, sim.newItem('/obj/item/crowbar'), D, 2 * TILE + 1, 2 * TILE + 1, undefined, 1);
  ok(over.l === 0, 'an item put down over the hole lands on the deck below');
  const onFloor = place(sim, sim.newItem('/obj/item/crowbar'), D, 6 * TILE + 1, 2 * TILE + 1, undefined, 1);
  ok(onFloor.l === 1 && onFloor.item.loc.t === 'floor', 'one put down on the upper floor stays there');
  step(0.1);
  ok(evs(inbox.a, 'item+').some((e) => e.id === onFloor.item.id && e.l === 1) && evs(inbox.a, 'item+').some((e) => e.id === over.item.id && e.l === 0), 'and the clients are told which deck');
  // reach does not go through a floor: Bob stands on the upper deck right over an item on the lower one
  const below = place(sim, sim.newItem('/obj/item/wrench'), D, 6 * TILE + 1, 4 * TILE + 1, undefined, 0);
  stand(b, 6, 3, 1);
  b.yaw = 0;
  sim.handle(B, { t: 'click', target: { k: 'item', id: below.item.id } });
  step(0.2);
  ok(!b.hands.some((h) => h && h.id === below.item.id) && sim.floor.has(below.item.id), 'you cannot pick up what lies on the deck below you');
  sim.handle(B, { t: 'click', target: { k: 'item', id: onFloor.item.id } });
  step(0.2);
  ok(b.hands.some((h) => h && h.id === onFloor.item.id), 'but what is on your own deck, you can');
  // distance knows about floors
  ok(near(sim.dist({ grid: D, x: 5, z: 5, l: 0 }, { grid: D, x: 5, z: 5, l: 1 }), DECK_H, 1e-9), 'one deck up is a deck\'s height away');
  ok(sim.dist({ grid: D, x: 5, z: 5, l: 0 }, { grid: D, x: 8, z: 9, l: 0 }) === 5, 'on one deck it is plain distance');
  // dropping what you hold puts it on your deck
  stand(b, 6, 2, 1);
  b.hands[0] = null; b.hands[1] = null;
  const held = sim.newItem('/obj/item/crowbar'); b.hands[0] = held; held.loc = { t: 'hand', mob: b, i: 0 }; b.active = 0;
  sim.handle(B, { t: 'key', k: 'drop' });
  ok(sim.floor.get(held.id)?.l === 1, 'drop it and it lies on the deck you are on');
});

section('air', () => {
  const { D, step } = setup();
  const w = D.world, at = D.atmos, WH = w.W * w.H;
  ok(at.isCell[w.idx(5, 2, 1)] && at.isCell[w.idx(2, 2, 1)] && !at.isCell[w.idx(0, 0, 1)], 'the upper floor holds air, and so does the open air over the room below it (one room two decks high)');
  let up = 0;
  for (let k = 0; k < at.pairs.length; k += 3) if (at.pairs[k + 2] === 0 && at.pairs[k + 1] - at.pairs[k] === WH) up++;
  ok(up === 15, `air goes up and down through the hole, and only there (${up} links, the hole is 3 by 5)`);
  ok(near(at.pressureAt(5, 2, 1), 101.3, 0.2), 'the upper deck starts with air in it');
  // empty both decks. Air put in the hole comes down into the room below at once (one link); air put on the upper floor, which has a floor under it, cannot
  // reach the room below it in a tick (it would have to go round by the hole, nine steps, and a tick is seven passes)
  for (let i = 0; i < 2 * WH; i++) { at.o2[i] = 0; at.n2[i] = 0; }
  at.o2[w.idx(1, 1, 1)] = 20;
  step(0.25);
  ok(at.pressureAt(1, 1, 0) > 1, 'air from the hole sinks into the room below');
  for (let i = 0; i < 2 * WH; i++) { at.o2[i] = 0; at.n2[i] = 0; }
  at.o2[w.idx(7, 5, 1)] = 20;
  step(0.25);
  ok(at.pressureAt(7, 5, 1) < 20 && at.pressureAt(7, 5, 0) < 0.01, 'air on the upper floor does not fall through the floor (what is under it is only what crept round by the hole)');
});

section('pathfinding', () => {
  const { sim, D } = setup();
  const nav = D.nav;
  const up = nav.path(2, 3, 5, 3, null, 3500, 0, 1);
  ok(up && up.at(-1)[0] === 5 && up.at(-1)[2] === 1 && up.some(([c, r, l]) => c === 4 && r === 3 && l === 1), 'a path goes up by the stair, onto the upper floor in front of it');
  const down = nav.path(5, 3, 2, 3, null, 3500, 1, 0);
  ok(down && down.at(-1)[2] === 0 && down.some(([c, r, l]) => c === 3 && r === 3 && l === 0), 'and down again by stepping into the hole over it (the stair takes the fall)');
  ok(nav.passable(2, 2, null, 1) === false && nav.passable(2, 2, null, 0) === true, 'the hole is not somewhere to stand');
  ok(nav.step(4, 2, 1, 3, 2, null) === null, 'and a hole with no stair at the bottom is not a way down');
  // a walker follows it
  const m = sim.newMob({ kind: 'human', name: 'Walker', grid: D, l: 0, x: 2 * TILE + 1, z: 3 * TILE + 1, hp: 100, speed: 2.4 });
  m.path = up.slice(); m.pathIdx = 0; m.state = 'walk';
  for (let k = 0; k < 20 * 12 && (m.l !== 1 || m.path); k++) sim.step(SIM_DT);
  ok(m.l === 1 && Math.hypot(m.x - (5 * TILE + 1), m.z - (3 * TILE + 1)) < 1, 'someone walking that path goes up the stairs');
  ok(m.body.brute === 0, 'unhurt');
});

section('the clients', () => {
  const { sim, data, A, a, b, inbox, step, D, stand } = setup();
  stand(b, 5, 2, 1);
  stand(a, 6, 4, 1);                                                    // Alice is on the upper deck too, so Bob is in her snapshots
  inbox.a.length = 0;
  step(0.3);
  const snap = inbox.a.filter((m) => m.t === 'snap').pop();
  const row = snap.mobs.find((r) => r[0] === b.id);
  ok(row && (row[5] >> 8) === 1, 'a person\'s snapshot row carries their deck in its flags');
  ok(snap.you.l === 1, 'and so does yours');
  const late = [];
  sim.addClient('Cara', (m) => late.push(m));
  const welcome = late.find((m) => m.t === 'welcome');
  const rep = new Replica({ level: data.level, rects: data.rects }, { ...welcome, you: A.id });
  const rg = rep.grids.get(D.id);
  ok(rg.world.levels === 2 && rg.world.kind.every((v, i) => v === D.world.kind[i]) && rg.world.stairs.every((v, i) => v === D.world.stairs[i]), 'the replica builds the same decks and stairs');
  // the same steps on the replica's tiles give the same result as on the server's (this is what prediction is)
  const sv = { x: 2 * TILE + 1, z: 3 * TILE + 1, vx: 0, vz: 0, l: 0 }, cl = { ...sv };
  for (let k = 0; k < 50; k++) {
    const inp = { f: 1, b: 0, l: 0, r: 0, run: 0, yaw: EAST };
    stepMovement(sv, inp, D.world, 0.05, { free: true });
    stepMovement(cl, inp, rg.world, 0.05, { free: true });
  }
  ok(sv.l === 1 && cl.l === 1 && near(sv.x, cl.x, 1e-9) && near(sv.z, cl.z, 1e-9), 'walking up the stair on the replica ends where it does on the server');
  // what a snapshot says about somebody on the upper deck: which, and how high that puts their feet
  rep.apply({ e: 'mob+', id: b.id, n: 'Bob', job: 'medical_doctor', set: 0, kind: 'human' });
  rep.applySnap(snap, 0);
  const rb = rep.mobs.get(b.id);
  ok(rb.l === 1 && rb.g === D.id && near(rb.h, DECK_H), 'the replica reads a person\'s deck from the flags, and their height from it');
  const lift = (x, z, l = 0) => rg.world.stairLift(x, z, l);
  ok(near(lift(3 * TILE, 3 * TILE + 1), 0) && near(lift(3 * TILE + TILE / 2, 3 * TILE + 1), DECK_H / 2) && near(lift(4 * TILE - 1e-6, 3 * TILE + 1), DECK_H, 1e-3), 'a stair is a slope: nothing where you step on, a whole deck where you leave it');
  ok(lift(5 * TILE + 1, 3 * TILE + 1) === 0 && lift(3 * TILE + 1, 3 * TILE + 1, 1) === 0, 'and flat everywhere else');
  ok(near(lift(4 * TILE - 0.01, 3 * TILE + 1), DECK_H, 0.02), 'so the eye comes out of the stair at the height of the deck it steps up onto');
  // light does not pass from one deck to the other
  const lf = new LightField(rg.world), t = [0, 0, 0];
  lf.clear([0, 0, 0]);
  lf.addSource(6.5, 2.5, [1, 1, 1], 5, 1, 1);
  lf.finalize();
  lf.sample(6 * TILE + 1, 2 * TILE + 1, t, 1);
  const up = t[0];
  lf.sample(6 * TILE + 1, 2 * TILE + 1, t, 0);
  ok(up > 0.5 && t[0] === 0, 'a light on the upper deck lights it and not the one below');
});

section('a grid with decks in the physics', () => {
  const { sim, D } = setup();
  const boxes = sim.physics.boxesOf(D);
  const tops = new Set(boxes.map((b) => +(b.h[1] * 2).toFixed(3)));
  ok(tops.size === 2 && tops.has(1) && tops.has(+(1 + DECK_H).toFixed(3)), 'its solid is as high as its decks are tall (one deck high where the upper deck is a hole, two where it is not)');
});

section('the deck test grid of the debug menu', () => {
  const sim = new Sim(DATA, { bots: 0, debug: true });
  const inbox = [];
  const A = sim.addClient('Alice', (m) => inbox.push(m));
  sim.handle(A, { t: 'lobby', op: 'job', id: 'station_engineer' });
  sim.handle(A, { t: 'lobby', op: 'ready', v: true });
  sim.handle(A, { t: 'lobby', op: 'start' });
  for (let k = 0; k < 20; k++) sim.step(SIM_DT);
  sim.handle(A, { t: 'dbg', op: 'grid', what: 'deck' });
  const g = A.mob.grid;
  ok(g.bp === 'debug_decks' && g.world.levels === 2 && A.mob.l === 0, 'asking for it makes a grid of two decks and puts you on it');
  sim.handle(A, { t: 'dbg', op: 'grid', what: 'deck' });
  ok([...sim.grids.values()].filter((x) => x.bp === 'debug_decks').length === 1, 'and asking again does not make another');
  const late = [];
  sim.addClient('Bob', (m) => late.push(m));
  const welcome = late.find((m) => m.t === 'welcome');
  const gs = welcome.grids.find((x) => x.bp === 'debug_decks');
  ok(gs && gs.def && gs.def.levels === 2, 'a client that joins is sent its blueprint with it');
  const rep = new Replica({ level: JSON.parse(JSON.stringify({ ...DATA.level, grids: Object.fromEntries(Object.entries(DATA.level.grids).filter(([k]) => k !== 'debug_decks')) })), rects: DATA.rects }, { ...welcome, you: A.id });
  ok(rep.grids.get(gs.g)?.world.levels === 2, 'and the replica builds it from that');
  sim.step(SIM_DT);
  for (let k = 0; k < 60; k++) {                                          // the way up: east along the middle row from the start
    sim.handle(A, { t: 'input', list: [{ seq: 100 + k, dt: 0.05, f: 1, b: 0, l: 0, r: 0, run: 0, yaw: EAST, pitch: 0, g: A.mob.grid.id }] });
    sim.step(0.05);
  }
  ok(A.mob.l === 1, 'and its stair does climb to the second deck');
});

section('a ball flying about it', () => {
  const { D } = setup();
  const w = D.world;
  const mid = (l, h) => l * DECK_H + h;
  const at = (c, r) => [c * TILE + 1, r * TILE + 1];
  ok(!w.collidesTiles3(at(2, 2)[0], mid(0, 1.0), at(2, 2)[1], 0.45), 'the air in the room below is clear');
  ok(w.collidesTiles3(at(6, 2)[0], mid(0, 2.6), at(6, 2)[1], 0.45), 'the underside of the upper floor is a ceiling there');
  ok(!w.collidesTiles3(at(2, 2)[0], mid(0, 2.6), at(2, 2)[1], 0.45), 'but not over the hole');
  ok(!w.collidesTiles3(at(2, 2)[0], mid(1, 1.0), at(2, 2)[1], 0.45), 'and a ball can go up through the hole');
  ok(!w.collidesTiles3(at(6, 2)[0], mid(1, 1.0), at(6, 2)[1], 0.45) && w.collidesTiles3(at(8, 2)[0], mid(1, 1.0), at(8, 2)[1], 0.45), 'the upper deck has its own walls and its own free air');
  ok(w.collidesTiles3(at(6, 2)[0], mid(1, 2.7), at(6, 2)[1], 0.45), 'and, being the top, a roof');
});

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
