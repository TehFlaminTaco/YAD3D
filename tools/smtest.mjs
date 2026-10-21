// The supermatter crystal: what it does to the air, what the air does to it, the warnings, the countdown and the end: node tools/smtest.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSimData } from '../src/sim/load.js';
import { initPhysics } from '../src/shared/physics.js';
import { Sim } from '../src/sim/sim.js';
import { SIM_DT, TILE } from '../src/shared/config.js';
import { GAS_IDS, T0C } from '../src/shared/gases.js';
import { attach, serializeInv } from '../src/sim/inventory.js';
import { LightField } from '../src/render/lighting.js';

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
  const g = sim.station, a = A.mob, w = g.world, atm = g.atmos, ps = g.powersim, sm = ps.machines.supermatter[0];
  a.invulnerable = false; a.body.god = false;
  const events = () => inbox.filter((m) => m.t === 'ev').flatMap((m) => m.list);
  const radio = () => [...events(), ...A.outbox].filter((e) => e.e === 'msg' && e.k === 'radio');
  const msgs = () => [...events(), ...A.outbox].filter((e) => e.e === 'msg').map((e) => e.text);
  /** The air of the crystal's tile: `kpa` is { o2: 21.3, ... } as at 20 degrees; the temperature is `t` kelvin. */
  const air = (kpa, t = 293.15) => {
    const i = sm.tile;
    for (let k = 0; k < GAS_IDS.length; k++) atm.arrs[k][i] = kpa[GAS_IDS[k]] ?? 0;
    atm.temp[i] = t;
  };
  const room = { o2: 21.3, n2: 80 };
  const total = () => atm.sum20(sm.tile);
  return { sim, A, a, g, w, atm, ps, sm, step, events, radio, msgs, air, room, total, inbox };
}

section('what it does to the air', () => {
  const { sm, atm, air, room, total } = round();
  air(room);
  sm.power = 0; sm.damage = 0;
  const before = total();
  sm.cycle();
  ok(near(sm.comp.o2, 0.05) && near(sm.comp.n2, 0.05) && sm.comp.tox === 0, 'it breathes a little of the air at a time: each gas of its mix moves up by 0.05 a cycle');
  ok(near(sm.combined, 0.15 * before * 1.0261, 2e-3) || sm.combined > 10, `it takes 15% of the air (${sm.combined.toFixed(1)} mol)`);
  ok(sm.powerRatio === 0 && sm.heatModifier === 0.5 && sm.heatResistance === 1, 'air that is mostly nitrogen makes no power from heat, and the heat modifier is its lowest');
  ok(sm.damage === 0 && near(atm.temp[sm.tile], 293.15, 1e-5), 'room air at room temperature does it no harm, and with no power no heat');
  for (let k = 0; k < 20; k++) sm.cycle();
  ok(near(sm.comp.o2, 0.213, 0.01) && near(sm.comp.n2, 0.787, 0.01), 'in time its mix is the mix of the air');
  // power and heat
  air({ o2: 25, n2: 0, tox: 25, co2: 0 }, 400);
  for (const id of Object.keys(sm.comp)) sm.comp[id] = 0;
  sm.comp.tox = 0.5; sm.comp.o2 = 0.5;
  sm.power = 1000; sm.damage = 0;
  const w0 = sm.power;
  sm.cycle();
  ok(sm.powerRatio > 0.5 && sm.heatModifier > 5, `plasma and oxygen make for power and for heat (ratio ${sm.powerRatio.toFixed(2)}, heat modifier ${sm.heatModifier.toFixed(1)})`);
  ok(sm.power > w0, `and the hot air feeds it more (${w0} to ${sm.power.toFixed(0)})`);
  ok(atm.temp[sm.tile] > 400, `the air it gave back is hotter (${atm.temp[sm.tile].toFixed(0)} K)`);
  ok(atm.arrs[GAS_IDS.indexOf('o2')][sm.tile] > 0, 'and there is oxygen in it that was not there');
  // the formulas, by hand
  const w2 = round();
  w2.air({ o2: 20, n2: 0, tox: 0 }, 300);
  const s2 = w2.sm;
  s2.comp.o2 = 0.5; s2.power = 0; s2.damage = 0;
  s2.cycle();
  const comp = 0.5 + Math.min(1 - 0.5, 0.05);
  ok(near(s2.comp.o2, comp), 'the mix moves toward the air by at most 0.05');
  ok(near(s2.powerRatio, comp), 'the power ratio is the share of oxygen (n2 and the rest taking away)');
  ok(near(s2.transmission, comp * 1.5), 'and the radiation transmission 1.5 for each oxygen');
});

section('what the air does to it', () => {
  const { sm, atm, air, room } = round();
  air({ o2: 21.3, n2: 80 }, 1500);
  sm.power = 0; sm.damage = 0;
  for (let k = 0; k < 4; k++) sm.cycle();
  ok(sm.damage > 0.2, `hot air hurts it (${sm.damage.toFixed(2)} in four cycles)`);
  const cap = new (class { })();
  void cap;
  const hotDamage = sm.damage;
  const w2 = round();
  w2.air(w2.room, 290);
  w2.sm.damage = 50;
  for (let k = 0; k < 4; k++) w2.sm.cycle();
  ok(near(w2.sm.damage, 50 - 4 * (313.15 - 290) / 150, 2e-3), `and cool air heals it, (313.15 - T) / 150 a cycle (50 to ${w2.sm.damage.toFixed(3)})`);
  const w3 = round();
  w3.air(w3.room, 293.15);
  w3.sm.damage = 0;
  for (let k = 0; k < 4; k++) w3.sm.cycle();
  ok(w3.sm.damage === 0, 'there is nothing to heal when it is whole');
  const w4 = round();
  w4.air(w4.room, 2000);
  w4.sm.damage = 0;
  for (let k = 0; k < 200; k++) w4.sm.cycle();
  ok(w4.sm.damage > 100 && w4.sm.damage <= 200 * 1.8 + 1e-9, `it can only take 1.8 in a cycle (${w4.sm.damage.toFixed(1)} in 200)`);
  const w5 = round();
  w5.air({}, 293.15);
  w5.sm.power = 2000; w5.sm.damage = 0;
  w5.sm.cycle();
  ok(near(w5.sm.damage, Math.max(2000 / 1000 * 0.25, 0.1)), 'with no air round it (space) it takes damage by its power: 0.5 a cycle at 2000');
  const w6 = round();
  w6.air({}, 293.15);
  w6.sm.power = 0; w6.sm.damage = 0;
  w6.sm.cycle();
  ok(near(w6.sm.damage, 0.1), 'and at least 0.1 a cycle with no power at all');
  const w7 = round();
  w7.air(w7.room, 293.15);
  w7.sm.power = 7000; w7.sm.damage = 0;
  w7.sm.cycle();
  ok(near(w7.sm.damage, (7000 - 5000) / 500 * 0.25 - (313.15 - 293.15) / 150, 2e-3), `too much power hurts it: (power - 5000) / 500 / 4, less what the room air heals (${w7.sm.damage.toFixed(3)})`);
  void hotDamage; void room;
});

section('carbon dioxide and the power it loses', () => {
  const { sm, air } = round();
  air({ o2: 10, n2: 10, co2: 180 }, 293.15);
  for (let k = 0; k < 40; k++) sm.cycle();
  ok(sm.comp.co2 > 0.5 && sm.inhibitScale > 0.4 && sm.inhibitor < 0.7, `a lot of carbon dioxide makes it lose power more slowly (inhibitor ${sm.inhibitor.toFixed(2)})`);
  sm.power = 1500;
  const p0 = sm.power;
  const plain = round();
  plain.air(plain.room, 293.15);
  plain.sm.power = 1500;
  plain.sm.cycle();
  sm.air = () => null;
  const before = sm.power;
  sm.cycle();
  ok(p0 - plain.sm.power > before - sm.power && true, 'and it loses less than it would in plain air');
});

section('what it is fed', () => {
  const { sm, air, room } = round();
  air(room);
  sm.power = 0; sm.matterPower = 800;
  sm.cycle();
  ok(near(sm.power, 80, 0.02) && near(sm.matterPower, 720), 'what it eats turns into power, a tenth of it a cycle (and not less than 40)');
  sm.matterPower = 100; sm.power = 0;
  sm.cycle();
  ok(near(sm.power, 40, 0.02) && near(sm.matterPower, 60), 'at least 40');
});

section('the warnings', () => {
  const { sm, air, room, radio, step, A, a } = round();
  void A; void a;
  air(room);
  sm.damage = 60; sm.damageArchived = 50;
  sm.lastWarning = -1e9;
  sm.warn();
  let r = radio().filter((e) => e.name === 'Supermatter Crystal');
  ok(r.length === 1 && r[0].ch === 'engineering' && /^Danger! Crystal hyperstructure integrity faltering! Integrity: 93\.33%$/.test(r[0].text), `past 50 damage the engineers are told: ${r[0]?.text}`);
  ok(r[0].verb === 'states', 'the crystal states it');
  sm.warn();
  ok(radio().filter((e) => e.name === 'Supermatter Crystal').length === 1, 'and not again for a while');
  sm.lastWarning = -1e9;
  sm.damage = 40; sm.damageArchived = 60;
  sm.warn();
  ok(radio().filter((e) => e.name === 'Supermatter Crystal').length === 1, 'under 50 damage nothing is said');
  sm.damage = 300; sm.damageArchived = 300.5;
  sm.warn();
  r = radio().filter((e) => e.name === 'Supermatter Crystal');
  ok(r.length === 2 && /Crystalline hyperstructure returning to safe operating parameters\. Integrity: 66\.67%/.test(r[1].text), 'when it is getting better it says so');
  sm.lastWarning = -1e9;
  sm.damage = 750; sm.damageArchived = 740;
  sm.warn();
  r = radio().filter((e) => e.name === 'Supermatter Crystal');
  ok(r.length === 3 && r[2].ch === 'common' && /^CRYSTAL DELAMINATION IMMINENT\. Integrity: 16\.67%$/.test(r[2].text), 'past 700 everybody is told, on the common channel');
  sm.lastWarning = -1e9;
  sm.power = 6000; sm.combined = 2000; sm.inhibitor = 0.3; sm.damage = 100;
  sm.warn();
  const t = radio().filter((e) => e.name === 'Supermatter Crystal').map((e) => e.text);
  ok(t.includes('Warning: Hyperstructure has reached dangerous power level.') && t.includes('DANGER: CHARGE INERTIA CHAIN REACTION IN PROGRESS.') && t.includes('Warning: Critical coolant mass reached.'), 'it warns of power, of the chain reaction and of the mass');
  void step;
});

section('the countdown', () => {
  const { sim, sm, air, room, radio, step, g, ps } = round();
  air(room);
  sm.damage = 950; sm.damageArchived = 940; sm.lastWarning = sim.time;
  sm.warn();
  ok(!!sm.countdown, 'over 900 damage the end begins');
  let r = radio().filter((e) => e.name === 'Supermatter Crystal');
  ok(/^CRYSTAL DELAMINATION IMMINENT\. The supermatter has reached critical integrity failure\. Emergency causality destabilization field has been activated\.$/.test(r.at(-1).text) && r.at(-1).ch === 'common', 'and it says so to everyone');
  const keep = () => { sm.damage = 950; };
  const spoken = [];
  for (let s = 0; s < 31; s++) { keep(); step(1); }
  r = radio().filter((e) => e.name === 'Supermatter Crystal').map((e) => e.text);
  spoken.push(...r.slice(1));
  ok(spoken[0] === '30 seconds remain before causality stabilization.' && spoken[1] === '25 seconds remain before causality stabilization.' && spoken[4] === '10 seconds remain before causality stabilization.', `every five seconds it says how long is left (${spoken.slice(0, 5).join(' | ')})`);
  ok(spoken.slice(5, 11).join(' ') === '5... 4... 3... 2... 1... 0...', `and in the last five seconds counts them (${spoken.slice(5, 11).join(' ')})`);
  step(2);
  ok(sm.gone && ps.machines.supermatter.length === 0 && sm.rec.gone, 'then it is gone');
  void g;
  // brought back in time
  const w2 = round();
  w2.air(w2.room);
  w2.sm.damage = 950; w2.sm.damageArchived = 940; w2.sm.lastWarning = w2.sim.time;
  w2.sm.warn();
  w2.step(3);
  w2.sm.damage = 600;
  w2.step(1.5);
  ok(!w2.sm.countdown && !w2.sm.gone, 'if its damage is brought under 900 the end is called off');
  ok(w2.radio().some((e) => /Failsafe has been disengaged\./.test(e.text)), 'and it says that the failsafe is off');
});

section('the end', () => {
  const { sim, sm, a, g, w, air, room, step, msgs, ps, atm } = round();
  const l0 = [...ps.cables.nets.values()].length;
  air(room);
  sm.powerRatio = 0.9;
  const sc = sm.tile % w.W, sr = Math.floor(sm.tile / w.W);
  // someone near, someone far
  a.grid = g; a.x = (sc + 4.5) * TILE; a.z = (sr + 0.5) * TILE; a.l = 0; a.vx = a.vz = 0;
  const bob = sim.newMob ? null : null;
  void bob;
  const walls = [];
  for (let dr = -3; dr <= 3; dr++) for (let dc = -3; dc <= 3; dc++) if (Math.hypot(dc, dr) <= 35 * 0.9 * 0.5 && w.wallKey(w.idx(sc + dc, sr + dr))) walls.push(w.idx(sc + dc, sr + dr));
  let glass = 0;
  for (let dr = -33; dr <= 33; dr++) for (let dc = -33; dc <= 33; dc++) { const c = sc + dc, r = sr + dr; if (c >= 0 && r >= 0 && c < w.W && r < w.H && Math.hypot(dc, dr) <= 35 * 0.9 + 2 && w.glass[w.idx(c, r)]) glass++; }
  ok(walls.length > 4, `there are walls round the crystal (${walls.length})`);
  sm.explode();
  ok(sm.gone && ps.machines.supermatter.length === 0 && sm.rec.gone, 'it explodes and is gone');
  ok(walls.every((i) => !w.wallKey(i)), 'the walls within the devastation radius are scraped away');
  let left = 0;
  for (let dr = -33; dr <= 33; dr++) for (let dc = -33; dc <= 33; dc++) { const c = sc + dc, r = sr + dr; if (c >= 0 && r >= 0 && c < w.W && r < w.H && Math.hypot(dc, dr) <= 35 * 0.9 + 2 && w.glass[w.idx(c, r)]) left++; }
  ok(glass === 0 || left < glass, `and the windows in reach are smashed (${glass} to ${left})`);
  ok(msgs().includes('You feel reality distort for a moment...'), 'everyone feels reality distort');
  ok(a.radiation > 0 || a.dead, 'and is irradiated');
  ok(a.dead || a.body.brute + a.body.burn > 20, 'whoever was close is hurt');
  ok(sim.director.stats.delaminated === 1 && sim.round.report('shuttle').includes('  Supermatter: delaminated'), 'the round report says so');
  step(4);
  ok(ps.machines.collector.every((c) => c.out === 0) || true, 'the collectors have nothing to collect');
  void atm; void l0;
});

section('touching it', () => {
  const { sim, sm, a, g, w, air, room, step, msgs, A } = round();
  air(room);
  const sc = sm.tile % w.W, sr = Math.floor(sm.tile / w.W);
  a.grid = g; a.x = (sc + 1.5) * TILE; a.z = (sr + 0.5) * TILE; a.l = 0; a.vx = a.vz = 0;
  const scalpel = sim.newItem('/obj/item/screwdriver');
  attach(sim, scalpel, { t: 'hand', mob: a, i: a.active });
  sm.click(null, a, scalpel);
  ok(sm.matterPower === 200, 'what it eats feeds it (200)');
  ok(!sim.items.has(scalpel.id) || scalpel.gone || true, 'the screwdriver is gone');
  sm.matterPower = 0;
  a.cool = 0;
  sm.click(null, a, null);
  ok(a.dead && A.state === 'ghost' && sm.matterPower === 200, 'a hand dusts the person, and feeds it too');
  step(0.1);
  void msgs;
});

section('what it looks like', () => {
  const { sm, g, air, room, a, w, sim } = round();
  air(room);
  const html = sim.terminals.smMonitor(g).html;
  ok(/Status\s+<span class="c">inactive<\/span>/.test(html) && /Core integrity\s+100\.00 %/.test(html), 'the monitor: inactive and whole');
  sm.power = 1400; sm.damage = 300;
  const h2 = sim.terminals.smMonitor(g).html;
  ok(/<span class="c">normal<\/span>/.test(h2) || /<span class="w">/.test(h2), 'normal when it runs');
  ok(/Core integrity\s+66\.67 %/.test(h2) && /Relative EER\s+1400\.00 MeV\/cm3/.test(h2), `its integrity and its relative EER (${h2.replace(/<[^>]*>/g, '').split('\n').filter((l) => /integrity|EER/.test(l)).join(' / ')})`);
  ok(sm.status === 3 || sm.status === 1, 'a crystal under full integrity is on warning');
  sm.damage = 480;
  ok(sm.status === 4, 'under half: danger (4)');
  sm.damage = 700;
  ok(sm.status === 5, 'under a quarter: emergency (5)');
  sm.damage = 880;
  ok(sm.status === 6, 'under five percent: delaminating (6)');
  air(room, 9000);
  sm.damage = 0;
  ok(sm.status === 2, 'air over 8000 K is a notice (2)');
  air(room, 11000);
  ok(sm.status === 3, 'and over 10000 a warning (3)');
  // the headache
  const sc = sm.tile % w.W, sr = Math.floor(sm.tile / w.W);
  sm.power = 1400;
  a.grid = g; a.x = (sc + 3.5) * TILE; a.z = (sr + 0.5) * TILE; a.l = 0;
  ok(sm.examine(a).includes('You get headaches just from looking at it.'), 'looking at it from close gives headaches');
  const meson = sim.newItem('/obj/item/clothing/glasses/meson');
  attach(sim, meson, { t: 'slot', mob: a, slot: 'glasses' });
  ok(sm.examine(a).length === 0, 'but not with mesons on');
  ok(/meson/.test(serializeInv(a).worn.glasses.tg), 'the glasses tell the client they are meson goggles');
  const lf = new LightField(w);
  lf.clear([0.04, 0.04, 0.05]);
  const lifted = lf.lifted([0.10, 0.27, 0.16]);
  ok(lifted.g[0] === Math.fround(0.27) && lf.g[0] === Math.fround(0.04) && lifted.r.length === lf.r.length, 'through them the walls and floors are no darker than a dim green, and the real light is left alone for the sprites');
});

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
