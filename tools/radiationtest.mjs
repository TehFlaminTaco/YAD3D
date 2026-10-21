// Radiation: waves from the supermatter, what it does to people, what stops it, the Geiger counter: node tools/radiationtest.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSimData } from '../src/sim/load.js';
import { initPhysics } from '../src/shared/physics.js';
import { Sim } from '../src/sim/sim.js';
import { SIM_DT, TILE, KIND } from '../src/shared/config.js';
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
  const g = sim.station, a = A.mob, w = g.world, rad = sim.radiation;
  a.invulnerable = false; a.body.god = false;
  const events = () => inbox.filter((m) => m.t === 'ev').flatMap((m) => m.list);
  const msgs = () => events().filter((e) => e.e === 'msg').map((e) => e.text);
  const empty = () => { for (const h of [0, 1]) if (a.hands[h]) detach(sim, a.hands[h]); };
  const hold = (p, extra = {}) => { empty(); const it = sim.newItem(p, extra); attach(sim, it, { t: 'hand', mob: a, i: a.active }); return it; };
  const wear = (p) => { const it = sim.newItem(p); const slot = sim.db.info(p).sl[0]; const old = a.worn[slot]; if (old) detach(sim, old); attach(sim, it, { t: 'slot', mob: a, slot }); return it; };
  const at = (c, r) => { a.grid = g; a.x = (c + 0.5) * TILE; a.z = (r + 0.5) * TILE; a.l = 0; a.vx = a.vz = 0; a.stunned = 0; };
  return { sim, A, a, g, w, rad, step, msgs, inbox, events, empty, hold, wear, at };
}

section('the waves', () => {
  const { g, rad, w } = round();
  // a pulse in the middle of Engineering
  const sm = g.powersim.machines.supermatter[0];
  const c0 = Math.floor(sm.rec.x / TILE), r0 = Math.floor(sm.rec.z / TILE);
  const clear = rad.insulation; rad.insulation = () => 1;
  const open = rad.waves(g, c0, r0, 0, 3600, 1);
  ok(open[0][1] === 3600 && near(open[0][2], 900) && near(open[0][3], 400) && near(open[0][6], 100), 'with nothing in the way: strength is intensity over the steps squared (3600, 900, 400, ...)');
  ok(open[0].length === 1 + 20 && open[0][20] > 8.9 && open[0][20] < 9.1, 'and it stops at 9 (twenty steps for 3600)');
  const flat = rad.waves(g, c0, r0, 0, 3600, 0);
  ok(flat[0].length === 1 + 90 && near(flat[0][50], 3600), 'with no range modifier (the supermatter) it does not fall off at all');
  rad.insulation = () => 0.7;
  const walls = rad.waves(g, c0, r0, 0, 3600, 0);
  ok(walls[0][1] === 3600 && walls[0][2] < 3600 && walls[0][2] > walls[0][5] && walls[0][5] > walls[0][10], 'with a wall in every tile it weakens, a little less on each step');
  ok(near(walls[0][2], 3600 * (1 - 0.3 / 3) ** 3), 'by 1 - 0.3/width for each tile of the front: the first front is three tiles wide');
  rad.insulation = clear;
  // the real insulation
  const T = (c, r) => w.idx(c, r);
  let wall = null, window_ = null, rwall = null;
  for (let i = 0; i < w.n; i++) { if (w.kind[i] === KIND.WALL && !w.glass[i] && !wall && w.wallKey(i) === 'wall') wall = i; if (w.kind[i] === KIND.WALL && !w.glass[i] && !rwall && w.wallKey(i) === 'reinforced_wall') rwall = i; if (w.kind[i] === KIND.WALL && w.glass[i] && !window_) window_ = i; }
  ok(rad.insulation(g, wall) === 0.7 && rad.insulation(g, rwall) === 0.6 && [0.9, 0.6].includes(rad.insulation(g, window_)), 'walls 0.7, reinforced walls 0.6, windows 0.9 or 0.6');
  const k = g.powersim.machines.collector[0];
  rad.shields(g);
  ok(rad.insulation(g, k.tile) === 0.5, 'a radiation collector 0.5');
  const floor = (() => { for (let i = 0; i < w.n; i++) if (w.kind[i] === KIND.FLOOR && !g.radShield.has(i)) return i; })();
  ok(rad.insulation(g, floor) === 1, 'and open floor lets it all through');
});

section('what it does to a person', () => {
  const { a, rad, sim, step } = round();
  rad.radAct(a, 13.9);
  ok(!a.radiation, 'under 14 does nothing (skin protection)');
  rad.radAct(a, 109);
  const hit = 1 - rad.armor(a) / 100;
  ok(near(a.radiation, 20 * hit), 'a wave of 109 gives (109 - 9) x 0.2 = 20, less what the jumpsuit stops');
  const burn0 = a.body.burn;
  a.radiation = 0;
  rad.radAct(a, 3009);
  ok(a.body.burn - burn0 > 1.8 * hit && a.body.burn - burn0 < 2.0 && near(a.radiation, 600 * hit), 'over 1000 it also burns (about 1.9 for 3000): and 600 radiation');
  a.radiation = 3000;
  const before = a.radiation;
  rad.radAct(a, 109);
  ok(a.radiation - before < 20 / 8 + 1e-9, 'what they already carry makes more of it count for less (a ninth at 3000)');
  void sim; void step;
});

section('what stops it', () => {
  const { a, rad, wear } = round();
  ok(rad.armor(a) > 0 && rad.armor(a) < 20, 'a jumpsuit stops a little');
  wear('/obj/item/clothing/suit/radiation');
  ok(rad.armor(a) > 80 && rad.armor(a) <= 100, 'a radiation suit stops most of it (it covers five of the six parts of the body)');
  wear('/obj/item/clothing/head/radiation');
  ok(rad.armor(a) === 100, 'the hood too: all of it');
  a.radiation = 0;
  rad.radAct(a, 1009);
  ok(a.radiation === 0 && a.body.burn === 0, 'a wave that would have hurt does nothing');
});

section('every two seconds', () => {
  const { sim, a, rad, step, msgs } = round();
  a.radiation = 400;
  step(2.1);
  ok(near(a.radiation, 399.5), 'it wears off, half a unit a time');
  a.radiation = 1500;
  const tox0 = a.body.tox;
  step(2.1);
  ok(a.body.tox - tox0 > 0.5 && a.body.tox - tox0 < 0.6, 'over 500 it poisons: ln(1000) x 0.08 = 0.55 a time');
  a.radiation = 5000; a.body.tox = 0; a.stunned = 0;
  const was = sim.rand; sim.rand = () => 0;
  step(2.1);
  sim.rand = was;
  ok(a.stunned > 0 && msgs().includes('You feel weak.'), 'over 2000 it sometimes knocks them down: "You feel weak."');
  void rad;
});

section('the supermatter', () => {
  const { sim, a, g, step, at, wear, hold } = round();
  const sm = g.powersim.machines.supermatter[0];
  const c0 = Math.floor(sm.rec.x / TILE), r0 = Math.floor(sm.rec.z / TILE);
  at(c0, r0 + 3);
  sm.power = 2000;
  step(4);
  ok(a.radiation > 100, `three tiles from it, a few seconds in: ${Math.round(a.radiation)} radiation`);
  const r1 = a.radiation;
  a.radiation = 0; a.body.tox = 0;
  wear('/obj/item/clothing/suit/radiation'); wear('/obj/item/clothing/head/radiation');
  sm.power = 2000;
  step(4);
  ok(a.radiation === 0, 'in a radiation suit and hood: none');
  // a long way off, through walls
  a.radiation = 0;
  for (const s of ['suit', 'head']) if (a.worn[s]) detach(sim, a.worn[s]);
  at(c0 - 40, r0);
  sm.power = 2000;
  step(4);
  ok(a.radiation < r1, `forty tiles away and through walls: less (${Math.round(a.radiation)} against ${Math.round(r1)})`);
  sm.power = 0; step(1);
  const quiet = a.radiation;
  step(4);
  ok(!(a.radiation > quiet), 'a crystal with no power gives off nothing');
  void hold;
});

section('the Geiger counter', () => {
  const { sim, a, g, step, at, hold, msgs, rad } = round();
  const gc = hold('/obj/item/geiger_counter');
  ok(gc.def.geiger && !gc.geiger, 'it is its own kind of item');
  const off = gc.sprite;
  sim.actions.activate(a); step(0.1);
  ok(gc.geiger.on && msgs().includes('You switch on the Geiger counter.') && gc.sprite !== off, 'switched on: "You switch on the Geiger counter." and the picture changes');
  const sm = g.powersim.machines.supermatter[0];
  const c0 = Math.floor(sm.rec.x / TILE), r0 = Math.floor(sm.rec.z / TILE);
  at(c0, r0 + 4);
  sm.power = 3000;
  step(6);
  ok(gc.geiger.count > 100 && gc.geiger.last > 100, `near the crystal it counts (${Math.round(gc.geiger.count)})`);
  const lines = sim.actions.itemText(gc);
  ok(lines.some((t) => /Ambient radiation level/.test(t)) && lines.some((t) => /The last radiation amount detected was/.test(t)) && lines.includes('Alt-click it to clear stored radiation levels.'), 'and says so when looked at');
  const lvl = rad.levelOf(gc.geiger.count);
  ok(lvl >= 2 && gc.sprite === sim.level.itemdefs[gc.path].gv[lvl], 'with the picture of the level');
  sm.power = 0;
  step(8);
  ok(gc.geiger.count < 5, 'it settles when the crystal is quiet (and clears after the grace period)');
  gc.geiger.count = 500;
  sim.handle(sim.clients.values().next().value, { t: 'click', target: { k: 'none' }, alt: true, yaw: 0, pitch: 0 }); step(0.1);
  ok(gc.geiger.count === 0 && msgs().some((t) => /You flush the Geiger counter's radiation counts/.test(t)), 'alt-click clears it: "You flush the Geiger counter\'s radiation counts, resetting it to normal."');
  // scanning someone
  const b = sim.newMob({ kind: 'human', name: 'Bob', job: 'assistant', look: sim.looks.random(sim.rand), grid: g, l: 0, x: a.x + 1, z: a.z, speed: 1, hp: 100 });
  a.intent = 'help'; a.cool = 0;
  sim.handle(sim.clients.values().next().value, { t: 'click', target: { k: 'mob', id: b.id }, yaw: 0, pitch: 0 });
  step(2.3);
  ok(msgs().includes('Radiation levels within normal boundaries.') && msgs().includes('Target is free of radioactive contamination.'), 'scanning someone: "Radiation levels within normal boundaries."');
  b.radiation = 321; a.cool = 0;
  sim.handle(sim.clients.values().next().value, { t: 'click', target: { k: 'mob', id: b.id }, yaw: 0, pitch: 0 });
  step(2.3);
  ok(msgs().includes('Subject is irradiated. Radiation levels: 321.'), 'one who is irradiated: "Subject is irradiated. Radiation levels: 321."');
  sim.actions.activate(a);
  ok(!gc.geiger.on && !rad.geigers.has(gc), 'switched off');
});

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
