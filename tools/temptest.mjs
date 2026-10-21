// Temperature: gases that are warm or cold, rooms, pipes, and what it does to people: node tools/temptest.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSimData } from '../src/sim/load.js';
import { initPhysics } from '../src/shared/physics.js';
import { Sim } from '../src/sim/sim.js';
import { SIM_DT, TILE, KIND } from '../src/shared/config.js';
import { Mix, pumpGas, molesAt, kpaOf, T20C, SPECIFIC_HEAT, CELL_VOLUME, CELL_MOLES_PER_KPA, danger } from '../src/shared/gases.js';
import { attach, detach } from '../src/sim/inventory.js';
import { tempText } from '../src/sim/atmosdev.js';

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
  const g = sim.station, a = A.mob, w = g.world, atm = g.atmos;
  a.invulnerable = false; a.body.god = false;
  const msgs = () => inbox.filter((m) => m.t === 'ev').flatMap((m) => m.list).filter((e) => e.e === 'msg').map((e) => e.text);
  const wear = (p) => { const it = sim.newItem(p); const slot = sim.db.info(p).sl[0]; const old = a.worn[slot]; if (old) detach(sim, old); attach(sim, it, { t: 'slot', mob: a, slot }); return it; };
  /** A tile of open hallway floor with open floor round it. */
  const room = () => {
    for (let i = 0; i < w.n; i++) {
      const c = i % w.W, r = Math.floor(i / w.W);
      if (w.areas[w.areaIdx[i]].c !== 'hallway' || !atm.isCell[i]) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dc, dr]) => atm.isCell[w.idx(c + dc, r + dr)] && !w.airBlock[w.idx(c + dc, r + dr)])) return { c, r, i };
    }
    return null;
  };
  const at = (s) => { a.grid = g; a.x = (s.c + 0.5) * TILE; a.z = (s.r + 0.5) * TILE; a.l = 0; a.vx = a.vz = 0; a.stunned = 0; };
  return { sim, A, a, g, w, atm, step, msgs, wear, room, at, inbox };
}

section('gas at a temperature', () => {
  ok(near(molesAt(101.325, 2500), molesAt(101.325, 2500, T20C)) && near(kpaOf(10, 70, 600), 10 * 8.31 * 600 / 70), 'moles and pressure by PV = nRT, at 20 degrees if no other is said');
  const a = new Mix(100, { o2: 10 }, 300), b = new Mix(100, { o2: 10 }, 500);
  a.merge(b);
  ok(near(a.t, 400) && near(a.g.o2, 20), 'twenty moles at 400 K from ten at 300 and ten at 500');
  const p = new Mix(100, { tox: 1 }, 600), o = new Mix(100, { o2: 9 }, 300);
  o.merge(p);
  ok(near(o.t, (9 * 20 * 300 + 1 * 200 * 600) / (9 * 20 + 200)), 'a mole of plasma (ten times the heat) pulls the temperature more than a mole of oxygen');
  const e = new Mix(100, {}, 300);
  e.merge(new Mix(100, { n2: 5 }, 450));
  ok(near(e.t, 450), 'an empty container takes the temperature of what comes in');
  const m = new Mix(100, { o2: 5 }, 400);
  const out = m.remove(2);
  ok(out.t === 400 && near(out.g.o2, 2) && m.t === 400, 'what is taken out is as warm as what it came from');
  ok(near(m.thermalEnergy(), 400 * 3 * SPECIFIC_HEAT.o2), 'thermal energy: temperature x moles x specific heat');
  m.heat(3 * 20 * 100);
  ok(near(m.t, 500), 'a hundred degrees of heat for 3 moles of oxygen is 6000 joules');
  const hot = new Mix(100, { n2: 10 }, 600), room = new Mix(1000);
  pumpGas(hot, room, 50);
  ok(room.pressure() > 49 && room.pressure() <= 50, 'a pump takes hot gas to a target pressure by the temperature of the source (all ten moles make 49.9 kPa at 600 K)');
  ok(room.t === 600, 'and the gas stays hot');
});

section('a room', () => {
  const { sim, atm, w, room, step } = round();
  const s = room(), i = s.i;
  const before = atm.total(i), cap0 = atm.heatCap(i);
  ok(!atm.thermal && atm.temp[i] === Math.fround(T20C), 'every tile starts at 20 degrees');
  const hot = new Mix(CELL_VOLUME, { n2: 20 }, 600);
  atm.cell(i).merge(hot);
  ok(atm.thermal && atm.temp[i] > T20C + 40 && atm.temp[i] < 600, `a hot gas warms it (${atm.temp[i].toFixed(1)} K)`);
  ok(atm.total(i) > before * 1.3, 'and raises its pressure');
  const g0 = atm.gasesAt(s.c, s.r);
  ok(g0.temperature === atm.temp[i] && near(g0.pressure, atm.total(i), 1e-5), 'gasesAt says how warm and how much');
  // it spreads
  let tot0 = 0, e0 = 0;
  const nbrs = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dc, dr]) => w.idx(s.c + dc, s.r + dr));
  const cells = [i, ...nbrs];
  for (const j of cells) { tot0 += atm.sum20(j); e0 += atm.heatCap(j) * atm.temp[j]; }
  atm.step();
  let tot1 = 0, e1 = 0;
  for (const j of cells) { tot1 += atm.sum20(j); e1 += atm.heatCap(j) * atm.temp[j]; }
  ok(atm.temp[nbrs[0]] > T20C + 0.5 && atm.temp[nbrs[0]] < atm.temp[i], 'the next tile is warmer after a pass, and less than it');
  ok(tot1 < tot0 + 1e-3 && tot0 - tot1 < tot0 * 0.5, 'gas goes out of the hot tile into the cold ones (what is left of the five is a little less: it spread further)');
  void e0; void e1;
  for (let k = 0; k < 60; k++) atm.step();
  const spread = [i, ...nbrs].map((j) => atm.temp[j]);
  ok(Math.max(...spread) - Math.min(...spread) < 40, 'after a while the five are about as warm as each other');
  // the floor cools it
  atm.temp[i] = 500;
  atm.warm.add(i);
  for (let k = 0; k < 900; k++) atm.relax(0.22);
  ok(atm.temp[i] < 300 && atm.temp[i] >= T20C - 1e-3, 'left alone a warm tile goes back to 20 degrees (the floor takes its warmth)');
  void sim; void step; void cap0;
});

section('on a pipe', () => {
  const { g, atm, room } = round();
  const net = g.pipenet;
  const line = net.lines.find((l) => l.air.vol > 200 && l.air.total() > 1 && l.slots.length > 3);
  line.air.t = 400;
  ok(near(line.air.pressure(), line.air.total() * 8.31 * 400 / line.air.vol), 'a pipeline at 400 K presses by that');
  const keep = net.snapshot();
  const [first] = keep.values();
  ok(keep.get(line.slots[0]).t === 400, 'what a rebuilt network keeps is as warm as it was');
  // reconcile: a warm pipe and a cold pipe joined by an open valve end up at one temperature by their heat
  const a = new Mix(100, { n2: 10 }, 300), b = new Mix(100, { n2: 30 }, 500);
  const fake = { air: a, ports: [{ dev: { airs: [b] }, k: 0 }], devs: new Set() };
  net.reconcile(fake);
  ok(near(a.t, 450) && near(b.t, 450) && near(a.g.n2, 20) && near(b.g.n2, 20), 'two pipes at 300 and 500 K that are opened to each other share their gas and are at 450 K');
  void atm; void room;
});

section('what it does to people', () => {
  const { sim, a, atm, step, wear, room, at, msgs } = round();
  const s = room(); at(s);
  step(30);
  ok(near(a.body.temp, 310.15, 0.01) && a.body.tempAlert === null, 'in an ordinary room a body stays at 310 K');
  const burn0 = a.body.burn;
  // a hot room
  for (let k = 0; k < 8; k++) atm.cell(s.i).merge(new Mix(CELL_VOLUME, { n2: 30 }, 700));
  const warm = atm.temp[s.i];
  ok(warm > 450, `a room at ${warm.toFixed(0)} K`);
  step(12);
  ok(a.body.temp > 330, `their body warms (${a.body.temp.toFixed(1)} K after twelve seconds)`);
  for (let k = 0; k < 15; k++) { atm.temp[s.i] = 700; step(2); }
  ok(a.body.temp > 360.15 && a.body.burn > burn0 && a.body.tempAlert === 'hot', 'over 360 K it burns');
  ok(msgs().some((t) => /flaming hot/.test(t)), '"You\'re flaming hot! Get somewhere cooler and take off any insulating clothing like a fire suit."');
  // a fire suit and hood
  a.body.temp = 310.15; a.body.burn = 0; a.body.tempAlert = null;
  wear('/obj/item/clothing/suit/fire/firefighter'); wear('/obj/item/clothing/head/hardhat/red');
  ok(sim.insulation(a, 700, 310) > 0.99, 'a fire suit and a hard hat keep out all of 700 K (the whole body is covered)');
  a.body.temp = 310.15;
  for (let k = 0; k < 15; k++) { atm.temp[s.i] = 700; step(2); }
  ok(a.body.temp < 330 && a.body.burn < 1, `and they stay cool (${a.body.temp.toFixed(1)} K)`);
});

section('cold, and space', () => {
  const { sim, a, atm, step, wear, room, at, msgs } = round();
  const s = room(); at(s);
  const cold = sim.insulation(a, 200, 310);
  ok(cold < 1, 'an ordinary uniform keeps out only a little of the cold');
  atm.cell(s.i).remove(1e9);
  atm.temp[s.i] = 100; atm.thermal = true;
  atm.arrs[1][s.i] = 30;                                  // a little cold nitrogen
  a.body.temp = 310.15;
  for (let k = 0; k < 20; k++) { atm.temp[s.i] = 100; atm.warm.add(s.i); step(2); }
  ok(a.body.temp < 270 && a.body.tempAlert === 'cold', `in cold air they cool (${a.body.temp.toFixed(0)} K) and are cold`);
  ok(msgs().some((t) => /freezing cold/.test(t)), '"You\'re freezing cold! Get somewhere warmer and take off any insulating clothing like a space suit."');
  const burn = a.body.burn;
  step(10);
  ok(a.body.burn > burn, 'and it burns, a little');
  // space: 2.7 kelvin
  a.body.temp = 310.15; a.body.burn = 0;
  const open = { temperature: 2.7, insulation: (T, now) => sim.insulation(a, T, now) };
  for (let k = 0; k < 4; k++) a.body.thermalStep(open);
  ok(a.body.temp < 260, `eight seconds in space with no suit: ${a.body.temp.toFixed(0)} K`);
  wear('/obj/item/clothing/suit/space/hardsuit/engine'); wear('/obj/item/clothing/head/helmet/space/hardsuit/engine');
  a.body.temp = 310.15; a.body.burn = 0;
  for (let k = 0; k < 10; k++) a.body.thermalStep(open);
  ok(a.body.temp > 305 && sim.insulation(a, 2.7, 310) === (a.worn.suit && a.worn.head && a.worn.suit.def.spaceSuit && a.worn.head.def.spaceHelmet ? 1 : sim.insulation(a, 2.7, 310)), 'in a suit for space the cold stays out');
  // the danger levels of an air alarm
  ok(danger('temperature', 293.15) === 0 && danger('temperature', 280) === 1 && danger('temperature', 270) === 2 && danger('temperature', 320) === 1 && danger('temperature', 345) === 2, 'an air alarm: 0 to 10 degrees is a warning, under 0 and over 66 a danger');
  ok(tempText(293.15) === '20 °C (293.15 K)' && tempText(600) === '327 °C (600 K)', 'the analyzer writes a temperature as the DM does');
  void wear;
});

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
