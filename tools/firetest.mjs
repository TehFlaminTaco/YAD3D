// Plasma fire: the reaction, hotspots that start, grow and spread, what starts them: node tools/firetest.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSimData } from '../src/sim/load.js';
import { initPhysics } from '../src/shared/physics.js';
import { Sim } from '../src/sim/sim.js';
import { Replica } from '../src/client/state.js';
import { SIM_DT, TILE } from '../src/shared/config.js';
import { Mix, T20C, CELL_VOLUME, CELL_MOLES_PER_KPA } from '../src/shared/gases.js';
import { plasmaFire } from '../src/sim/fire.js';
import { attach, detach } from '../src/sim/inventory.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = loadSimData(root);
await initPhysics();
let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) pass++; else { fail++; console.log('  FAIL:', name); } };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e * Math.max(1, Math.abs(b));
const section = (name, fn) => { console.log(name); fn(); };

function round() {
  const sim = new Sim(DATA, { bots: 0 });
  const inbox = [];
  const A = sim.addClient('Alice', (m) => inbox.push(m));
  sim.handle(A, { t: 'lobby', op: 'job', id: 'station_engineer' });
  sim.handle(A, { t: 'lobby', op: 'ready', v: true });
  sim.handle(A, { t: 'lobby', op: 'start' });
  const step = (sec) => { for (let k = 0; k < sec / SIM_DT; k++) sim.step(SIM_DT); };
  const g = sim.station, a = A.mob, w = g.world, atm = g.atmos, fire = sim.fire;
  a.invulnerable = false; a.body.god = false;
  const events = () => inbox.filter((m) => m.t === 'ev').flatMap((m) => m.list);
  const room = () => {
    for (let i = 0; i < w.n; i++) {
      const c = i % w.W, r = Math.floor(i / w.W);
      if (w.areas[w.areaIdx[i]].c !== 'hallway' || !atm.isCell[i]) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dc, dr]) => atm.isCell[w.idx(c + dc, r + dr)] && !w.airBlock[w.idx(c + dc, r + dr)])) return { c, r, i };
    }
    return null;
  };
  /** Plasma and oxygen on a tile and the ones round it. */
  const fill = (s, tox = 20, o2 = 60, around = true) => {
    const cells = around ? [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] : [[0, 0]];
    for (const [dc, dr] of cells) atm.addGases(s.c + dc, s.r + dr, { tox, o2 });
  };
  return { sim, A, a, g, w, atm, fire, step, room, fill, events, inbox };
}

section('the reaction', () => {
  const cold = new Mix(CELL_VOLUME, { tox: 5, o2: 20 }, 350);
  ok(plasmaFire(cold) === 0 && cold.g.tox === 5, 'under 373 kelvin nothing burns');
  const none = new Mix(CELL_VOLUME, { tox: 5 }, 800);
  ok(plasmaFire(none) === 0 && none.t === 800, 'no oxygen, no fire');
  const hot = new Mix(CELL_VOLUME, { tox: 1, o2: 10 }, 600);
  const cap0 = hot.heatCapacity();
  const scale = (600 - 373.15) / (1643.15 - 373.15), rate = 1 * scale / 9, oxygenRate = 1.4 - scale;
  const fireAmount = plasmaFire(hot);
  ok(near(hot.g.tox, 1 - rate) && near(hot.g.o2, 10 - rate * oxygenRate) && near(hot.g.co2, rate) && near(hot.g.h2o, rate * 0.25), 'plasma burns into carbon dioxide (and a quarter as much water vapor), using 1.4 less the temperature scale of oxygen for each');
  ok(near(fireAmount, rate * (1 + oxygenRate)), 'and the fire made is the plasma burnt times one plus that');
  ok(near(hot.t, (600 * cap0 + 3e6 * rate) / hot.heatCapacity()), 'with three million joules a mole of heat');
  ok(hot.t > 700, `which is ${(hot.t - 600).toFixed(0)} kelvin hotter`);
  const lean = new Mix(CELL_VOLUME, { tox: 10, o2: 2 }, 1700);
  plasmaFire(lean);
  ok(lean.g.o2 >= -1e-9 && lean.g.tox > 0, 'it never uses more than there is of either');
  const t0 = new Mix(CELL_VOLUME, { tox: 2, o2: 30 }, 1800);
  const f2 = plasmaFire(t0);
  ok(near(f2 / (1 + (1.4 - 1)), 2 / 9, 1e-9), 'at the top temperature a ninth of the plasma burns in a go (scale 1)');
});

section('a hotspot', () => {
  const none = round(), n0 = none.room();
  none.fill(n0);
  none.fire.expose(none.g, n0.i, 300, 5);
  ok(!none.g.fires?.size, 'a spark under 373 kelvin starts nothing');
  const w3 = round(), s3 = w3.room();
  w3.atm.addGases(s3.c, s3.r, { o2: 60 });
  w3.fire.expose(w3.g, s3.i, 800, 5);
  ok(!(w3.g.fires?.size), 'nor does one with no plasma');
  const w4 = round(), s4 = w4.room();
  w4.atm.addGases(s4.c, s4.r, { tox: 20 });
  w4.atm.o2[s4.i] = 0;
  w4.fire.expose(w4.g, s4.i, 800, 5);
  ok(!(w4.g.fires?.size), 'nor one with no oxygen');
  const w2 = round(), s2 = w2.room();
  for (let dc = -2; dc <= 2; dc++) for (let dr = -2; dr <= 2; dr++) if (w2.atm.isCell[w2.w.idx(s2.c + dc, s2.r + dr)]) w2.atm.addGases(s2.c + dc, s2.r + dr, { tox: 100, o2: 100 });
  w2.fire.expose(w2.g, s2.i, 800, 5);
  ok(w2.g.fires.has(s2.i), 'a hot flame in plasma and oxygen starts a hotspot');
  let most = 0, hottest = 0;
  const watch = (sec) => { for (let k = 0; k < sec / 0.5; k++) { w2.step(0.5); most = Math.max(most, w2.g.fires.size); hottest = Math.max(hottest, w2.atm.temp[s2.i]); } };
  watch(2);
  ok(w2.events().some((e) => e.e === 'fire' && e.on.some(([i]) => i === s2.i)), 'everyone is told');
  watch(20);
  ok(hottest > 600, `it heats the tile (${hottest.toFixed(0)} K at most)`);
  ok(most > 4, `and spreads to the tiles next to it (${most} burning at once)`);
  const left = w2.atm.arrs[2][s2.i] * CELL_MOLES_PER_KPA;
  ok(left < 100 * CELL_MOLES_PER_KPA * 0.5, `the plasma is used up (${left.toFixed(1)} mol left of ${(100 * CELL_MOLES_PER_KPA).toFixed(0)})`);
  let co2 = 0;
  for (let dc = -6; dc <= 6; dc++) for (let dr = -6; dr <= 6; dr++) if (w2.atm.isCell[w2.w.idx(s2.c + dc, s2.r + dr)]) co2 += w2.atm.arrs[3][w2.w.idx(s2.c + dc, s2.r + dr)];
  ok(co2 > 2, `it made carbon dioxide (${co2.toFixed(1)} kPa of it about)`);
  watch(240);
  ok(w2.g.fires.size === 0, 'and the fire goes out when there is nothing left to burn');
  ok(w2.events().some((e) => e.e === 'fire' && e.off.length), 'everyone is told that too');
});

section('what starts a fire', () => {
  const { sim, a, g, atm, fire, step, room, fill, w } = round();
  const s = room();
  a.grid = g; a.x = (s.c + 0.5) * TILE; a.z = (s.r + 0.5) * TILE; a.l = 0;
  for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) if (atm.isCell[w.idx(s.c + dc, s.r + dr)]) atm.addGases(s.c + dc, s.r + dr, { tox: 100, o2: 100 });
  const welder = sim.newItem('/obj/item/weldingtool'); welder.lit = true;
  attach(sim, welder, { t: 'hand', mob: a, i: a.active });
  step(2.5);
  ok(g.fires?.has(s.i), 'a lit welding tool in a hand, in plasma and oxygen: a fire');
  void fire; void atm; void w;
});

section('an igniter', () => {
  const off = round(), ig0 = off.g.props.interact.find((it) => /^\/?machinery\/igniter$/.test(it.path || ''));
  for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) if (off.atm.isCell[off.w.idx(ig0.c + dc, ig0.r + dr)]) off.atm.addGases(ig0.c + dc, ig0.r + dr, { tox: 100, o2: 100 });
  off.step(4);
  ok(!off.events().some((e) => e.e === 'fire'), 'an igniter that is off does nothing');
  const { g, w, atm, step, events } = round();
  const ig = g.props.interact.find((it) => /^\/?machinery\/igniter$/.test(it.path || ''));
  const i = w.idx(ig.c, ig.r), area = w.areaIdx[i];
  for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) if (atm.isCell[w.idx(ig.c + dc, ig.r + dr)]) atm.addGases(ig.c + dc, ig.r + dr, { tox: 100, o2: 100 });
  ig.ign = { on: true };
  step(4);
  ok(!g.power.powered(area, 0) || events().some((e) => e.e === 'fire' && e.on.some(([j]) => j === i)), 'one that is on sets plasma alight on its tile (if the room has power)');
});

section('the clients', () => {
  const { sim, A, g, fire, step, room, fill, atm } = round();
  const s = room();
  fill(s);
  fire.expose(g, s.i, 800, 5);
  step(3);
  const late = [];
  sim.addClient('Bob', (m) => late.push(m));
  const welcome = late.find((m) => m.t === 'welcome');
  const gs = welcome.grids.find((q) => q.g === g.id);
  ok(gs.fire.length >= 1 && gs.fire.some(([i]) => i === s.i), 'a joiner is told what is burning');
  const rep = new Replica({ level: DATA.level, rects: DATA.rects }, { ...welcome, you: A.id });
  const rg = rep.grids.get(g.id);
  ok(rg.fireView.size === g.fires.size && [...g.fires].every(([i, f]) => rg.fireView.get(i) === f.st), 'and its world has the same fires');
  ok(DATA.level.fireSprites.length === 3 && DATA.level.fireSprites.every((f) => f.length === 6), 'there are three sizes of flame, six frames each');
  void atm;
});

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
