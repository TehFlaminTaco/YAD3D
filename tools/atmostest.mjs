// Atmospherics without pipes: gases, tanks that hold them, canisters, portable pumps and scrubbers, the gas analyzer, air alarms and their modes: node tools/atmostest.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSimData } from '../src/sim/load.js';
import { initPhysics } from '../src/shared/physics.js';
import { Sim } from '../src/sim/sim.js';
import { Replica } from '../src/client/state.js';
import { SIM_DT, TILE, KIND } from '../src/shared/config.js';
import { attach, detach, place, internalsSource } from '../src/sim/inventory.js';
import { Canister, Pump, Scrubber } from '../src/sim/atmosdev.js';
import {
  Mix, molesAt, pumpGas, releaseGas, breathOf, canisterMix, ONE_ATMOSPHERE, CELL_MOLES_PER_KPA, AIR_MODE, danger,
} from '../src/shared/gases.js';
import { breathRate } from '../src/shared/items.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = loadSimData(root);
await initPhysics();
let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) pass++; else { fail++; console.log('  FAIL:', name); } };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const section = (name, fn) => { console.log(name); fn(); };

function round(job = 'station_engineer', opts = {}) {
  const sim = new Sim(DATA, { bots: 0, ...opts });
  const inbox = [];
  const A = sim.addClient('Alice', (m) => inbox.push(m));
  sim.handle(A, { t: 'lobby', op: 'job', id: job });
  sim.handle(A, { t: 'lobby', op: 'ready', v: true });
  sim.handle(A, { t: 'lobby', op: 'start' });
  const step = (sec) => { for (let k = 0; k < sec / SIM_DT; k++) sim.step(SIM_DT); };
  const g = sim.station, a = A.mob, w = g.world, at = g.atmos, dev = g.atmosdev;
  const events = () => inbox.filter((m) => m.t === 'ev').flatMap((m) => m.list);
  const msgs = () => events().filter((e) => e.e === 'msg').map((e) => e.text);
  const empty = () => { if (a.hands[a.active]) detach(sim, a.hands[a.active]); };
  const hold = (p, extra = {}) => { empty(); const it = sim.newItem(p, extra); attach(sim, it, { t: 'hand', mob: a, i: a.active }); return it; };
  const clickAt = (target, o = {}) => { inbox.length = 0; a.cool = 0; a.busy = null; a.stunned = 0; sim.handle(A, { t: 'click', target, yaw: 0, pitch: 0, alt: !!o.alt }); step(o.wait ?? 0.1); };
  const click = (x, o) => clickAt({ k: 'prop', g: g.id, idx: (x.it ?? x).idx }, o);
  const standBy = (x) => {
    const it = x.it ?? x;
    for (const [dc, dr] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
      const c = it.c + dc, r = it.r + dr, i = w.idx(c, r);
      if (w.kind[i] !== KIND.FLOOR || w.solid[i] || w.doorAt.has(i)) continue;
      a.grid = g; a.x = (c + 0.5) * TILE; a.z = (r + 0.5) * TILE; a.l = 0; a.vx = a.vz = 0; a.cool = 0; a.stunned = 0;
      if (sim.actions.inReach(a, { k: 'prop', it, grid: g, l: it.l | 0, x: it.x, z: it.z })) return true;
    }
    return false;
  };
  const can = (kind) => dev.list.filter((m) => m instanceof Canister && m.kind === kind);
  /** The last console the sim sent her, and a press of one of its buttons by the start of its label. */
  const term = () => inbox.filter((m) => m.t === 'ev').flatMap((m) => m.list).filter((e) => e.e === 'term' && !e.close).pop();
  const press = (label) => { const k = term().buttons.findIndex((b) => b.l.replace(/^\* /, '').startsWith(label)); sim.handle(A, { t: 'term', op: 'act', idx: k }); step(0.1); return k; };
  return { sim, A, a, g, w, at, dev, inbox, step, events, msgs, empty, hold, clickAt, click, standBy, can, term, press };
}

const sumOf = (arr) => { let s = 0; for (let i = 0; i < arr.length; i++) s += arr[i]; return s; };

section('gases, as the DM counts them', () => {
  ok(near(CELL_MOLES_PER_KPA * ONE_ATMOSPHERE, 104.0, 0.5), 'a tile is 104 moles at one atmosphere (MOLES_CELLSTANDARD)');
  const air = canisterMix('air');
  ok(near(air.pressure(), 0.5 * 90 * ONE_ATMOSPHERE, 1e-6) && near(air.total(), 1871.7, 0.1) && near(air.g.o2 / air.total(), 0.21, 1e-9), 'an air canister is half of 90 atmospheres in 1000 litres, 21% oxygen');
  ok(canisterMix('').total() === 0 && canisterMix('toxins').g.tox > 1800 && canisterMix('water_vapor').pressure() > 9000, 'the plain canister is empty, a plasma one is plasma, a water vapor one is full (filled 1)');
  const m = new Mix(70, { o2: 10, n2: 30 }), taken = m.remove(8);
  ok(near(taken.total(), 8, 1e-9) && near(m.total(), 32, 1e-9) && near(taken.g.n2 / taken.g.o2, 3, 1e-9) && taken.vol === 70, 'remove() takes in proportion and conserves moles');
  const tank = new Mix(70), can = canisterMix('oxygen');
  ok(releaseGas(can, tank, 101.325) && near(tank.pressure(), 101.325, 1e-6), 'release_gas_to fills a tank to the pressure asked for');
  const p0 = can.pressure();
  ok(!releaseGas(can, tank, 101.325) && can.pressure() === p0, 'and stops there');
  ok(!releaseGas(new Mix(1000, { o2: molesAt(8, 1000) }), new Mix(70), 101), 'a source with less than 10 kPa to spare releases nothing');
  const room = new Mix(2500, { n2: molesAt(1000, 2500) }), pipe = new Mix(1000), n0 = room.total();
  ok(pumpGas(room, pipe, 500) && near(pipe.pressure(), 500, 1e-6) && near(room.total() + pipe.total(), n0, 1e-9), 'pump_gas_to moves gas until the receiver is at its target, and loses none');
  ok(!pumpGas(room, pipe, 500), 'and then it has nothing to do');
  const breath = breathOf(new Mix(70, { o2: molesAt(600, 70) }));
  ok(near(breath.pressure, 16, 1e-9) && near(breath.o2, 16, 1e-9) && breath.tox === 0, 'a breath from a full oxygen tank is 16 kPa of oxygen (tank_default_release_pressure)');
  ok(danger('o2', 10) === 2 && danger('o2', 17) === 1 && danger('o2', 21) === 0 && danger('co2', 7) === 1 && danger('co2', 11) === 2 && danger('tox', 0.3) === 1 && danger('pressure', 15) === 2 && danger('pressure', 101) === 0, 'the air alarm thresholds (TLV) are the DM\'s');
});

section('tanks hold gas', () => {
  const { sim } = round();
  const o2 = sim.newItem('/obj/item/tank/internals/oxygen'), em = sim.newItem('/obj/item/tank/internals/emergency_oxygen');
  ok(near(o2.mix.pressure(), 6 * ONE_ATMOSPHERE, 1e-6) && near(o2.mix.total(), 17.47, 0.01) && o2.mix.vol === 70, 'an oxygen tank is 6 atmospheres of oxygen in 70 litres (17.5 moles)');
  ok(near(em.mix.pressure(), 10 * ONE_ATMOSPHERE, 1e-6) && em.mix.vol === 1, 'an emergency tank is 10 atmospheres in a litre');
  const engi = sim.newItem('/obj/item/tank/internals/emergency_oxygen/engi'), dbl = sim.newItem('/obj/item/tank/internals/emergency_oxygen/double');
  ok(engi.mix.vol === 2 && dbl.mix.vol === 8, 'the extended and double ones are two and eight litres');
  const an = sim.newItem('/obj/item/tank/internals/anesthetic');
  ok(near(an.mix.g.n2o / an.mix.total(), 0.79, 1e-9) && near(an.mix.g.o2 / an.mix.total(), 0.21, 1e-9) && near(an.mix.pressure(), 3 * ONE_ATMOSPHERE, 1e-6), 'the anesthetic tank is three atmospheres, 79% nitrous oxide');
  const pl = sim.newItem('/obj/item/tank/internals/plasma'), plf = sim.newItem('/obj/item/tank/internals/plasma/full');
  ok(near(pl.mix.g.tox, 8.735, 0.01) && near(plf.mix.pressure(), 10 * ONE_ATMOSPHERE, 1e-6), 'a plasma tank is three atmospheres of plasma (8.7 moles); the full one ten');
  ok(sim.newItem('/obj/item/tank/internals/oxygen/empty').mix.total() === 0 && sim.newItem('/obj/item/tank/internals/emergency_oxygen/empty').mix.total() === 0, 'the empty ones are empty');
  ok(near(o2.mix.total() / breathRate(o2.def), 1500, 1e-6) && near(em.mix.total() / breathRate(em.def), 300, 1e-6), 'a full tank still lasts as long as it did (25 minutes, 5 minutes)');
  ok(/^\(\d+ kPa\)$/.test(sim.actions.itemText(o2).slice(-1)[0]), 'its state reads as a pressure: "(608 kPa)"');
});

section('what a tank breathes', () => {
  const { sim, a } = round();
  if (a.worn.mask) detach(sim, a.worn.mask);
  const mask = sim.newItem('/obj/item/clothing/mask/breath');
  attach(sim, mask, { t: 'slot', mob: a, slot: 'mask' });
  a.body.max = 100000;                                                              // (so that nothing kills her before the numbers are read)
  const breathe = (tank, secs) => {
    a.worn.suit_store = tank; a.internals = true;
    a.body.oxy = 0; a.body.tox = 0; a.body.breathless = 0; a.body.co2time = 0; a.stunned = 0;
    const had = tank.mix.total();
    for (let k = 0; k < secs / SIM_DT; k++) sim.step(SIM_DT);
    return had - tank.mix.total();
  };
  const full = sim.newItem('/obj/item/tank/internals/oxygen');
  const used = breathe(full, 10);
  ok(a.body.oxy < 1 && a.internals && near(used, 10 * breathRate(full.def), 0.002), `an oxygen tank keeps her alive, and ${used.toFixed(3)} moles of it are used in ten seconds`);
  const n2 = sim.newItem('/obj/item/tank/internals/generic'); n2.mix.g.n2 = molesAt(600, 70);
  breathe(n2, 10);
  ok(a.body.oxy > 5, 'a tank of nitrogen does not (suffocation)');
  const an = sim.newItem('/obj/item/tank/internals/anesthetic');
  breathe(an, 3);
  ok(a.stunned > 5, 'breathing from the anesthetic tank puts her to sleep');
  const co = sim.newItem('/obj/item/tank/internals/generic'); co.mix.g.o2 = molesAt(180, 70); co.mix.g.co2 = molesAt(420, 70);
  breathe(co, 14);
  ok(a.body.co2time > 12, 'a breath that is mostly carbon dioxide starts to hurt after twelve seconds');
  const pl = sim.newItem('/obj/item/tank/internals/generic'); pl.mix.g.tox = molesAt(600, 70);
  breathe(pl, 4);
  ok(a.body.tox > 1, 'plasma burns the lungs');
  const dry = sim.newItem('/obj/item/tank/internals/emergency_oxygen/empty');
  a.worn.suit_store = dry;
  ok(internalsSource(a) === null, 'an empty tank is no internals source');
  const plasma = sim.newItem('/obj/item/tank/internals/plasma');
  a.worn.suit_store = plasma;
  ok(internalsSource(a) === null, 'nor is a plasma tank');
});

section('the map has them', () => {
  const { dev, can, g } = round();
  const kinds = {};
  for (const m of dev.list) if (m instanceof Canister) kinds[m.kind || 'plain'] = (kinds[m.kind || 'plain'] || 0) + 1;
  ok(dev.list.length === 89 && dev.list.filter((m) => m instanceof Pump).length === 11 && dev.list.filter((m) => m instanceof Scrubber).length === 14 && dev.list.filter((m) => m.huge).length === 2, 'sixty-four canisters, eleven portable pumps, twelve portable scrubbers and two huge ones');
  ok(kinds.air === 13 && kinds.oxygen === 12 && kinds.nitrogen === 5 && kinds.nitrous_oxide === 7 && kinds.carbon_dioxide === 4 && kinds.toxins === 7 && kinds.plain === 14 && kinds.bz === 1 && kinds.water_vapor === 1, 'of the kinds the map has');
  ok(can('air').every((m) => near(m.mix.pressure(), 4559.6, 0.1)) && can('toxins').every((m) => m.mix.g.tox > 1800 && m.mix.g.o2 === 0) && can('').every((m) => m.mix.total() === 0), 'each holds what its label says');
  ok(dev.list.every((m) => m.it.mach === m && m.it.sv?.length > 1), 'each is the machine of its prop, with its pictures');
  ok(dev.alarms.length === 130 && dev.alarms.every((al) => al.locked && al.mode === AIR_MODE.SCRUBBING && al.it.mach === al), 'a hundred and thirty air alarms, locked, filtering');
  ok(dev.list.filter((m) => m.huge).every((m) => m.anchored) && dev.list.filter((m) => !m.huge).every((m) => !m.it.anc && m.it.dense), 'the huge scrubbers are bolted down, the rest are loose and in the way');
  ok(g.props.interact.filter((it) => /portable_atmospherics\//.test(it.path || '')).every((it) => it.mach), 'nothing of the kind is left without its machine');
  ok(g.props.interact.filter((it) => /portable_atmospherics\//.test(it.path || '')).length === 89, 'and there are no more than those');
});

section('a canister fills a tank', () => {
  const { sim, A, a, g, step, can, standBy, click, clickAt, hold, msgs, events } = round();
  const c = can('oxygen')[0];
  ok(standBy(c), 'she can stand beside an oxygen canister');
  const tank = hold('/obj/item/tank/internals/oxygen/empty');
  click(c);
  ok(c.holding === tank && a.hands[a.active] === null && msgs().includes('You insert the oxygen tank into the o2 canister.'), 'a tank in the hand goes into the canister');
  ok(c.v === 9 && events().some((e) => e.e === 'pv' && e.i === c.it.idx && e.v === 9), 'and the canister shows it (the picture with a tank in it and the lamp for how full it is), to everyone');
  const before = c.mix.total() + tank.mix.total();
  c.valve = true; c.release = 600;
  step(3);
  ok(near(tank.mix.pressure(), 600, 1) && near(c.mix.total() + tank.mix.total(), before, 1e-6), 'with the valve open the tank fills to the release pressure, and no gas is made or lost');
  const had = c.mix.total();
  step(2);
  ok(near(c.mix.total(), had, 1e-9), 'and then nothing more passes');
  c.release = 1000; step(3);
  ok(near(tank.mix.pressure(), 1000, 2), 'a higher release pressure fills it further');
  clickAt({ k: 'prop', g: g.id, idx: c.it.idx }, { alt: true });
  ok(c.holding === null && a.hands[a.active] === tank && !c.valve && msgs().includes('You remove the oxygen tank from the o2 canister.'), 'Alt-click takes it out into her hand, and shuts the valve');
  const t2 = hold('/obj/item/tank/internals/emergency_oxygen/empty');
  click(c);
  const t3 = hold('/obj/item/tank/internals/emergency_oxygen/empty');
  click(c);
  ok(c.holding === t3 && a.hands.includes(t2) && msgs().some((t) => /^In one smooth motion you pop the emergency oxygen tank out of the o2 canister's connector and replace it with the emergency oxygen tank\.$/.test(t)), 'a second tank pops the first out into her hand');
  sim.handle(A, { t: 'examine', target: { k: 'prop', g: g.id, idx: c.it.idx } });
  step(0.1);
  ok(msgs().some((t) => /This canister is tier 1\. The o2 canister contains the emergency oxygen tank\. Alt-click the o2 canister to remove it\. Click the o2 canister with another gas tank to hot swap the emergency oxygen tank\.$/.test(t)), 'examining it says it is tier 1 and what is in it');
  hold('/obj/item/wrench');
  click(c);
  ok(msgs().includes('Nothing happens.'), 'a wrench does nothing (there are no pipes to connect it to)');
});

section('the canister console', () => {
  const { a, can, standBy, click, hold, term, press, empty } = round();
  const c = can('oxygen')[0];
  standBy(c); empty();
  click(c);
  const t = term();
  ok(t && t.title === 'Canister' && /Tank pressure +4560 kPa/.test(t.html) && /Release pressure +101 kPa/.test(t.html) && /Closed/.test(t.html) && /Holding tank +<span class="d">none/.test(t.html), 'an empty hand opens its console: pressure, release pressure, the valve, no tank');
  press('Open valve');
  ok(c.valve && /Open/.test(term().html), 'Open valve opens it');
  press('+100'); press('+10');
  ok(near(c.release, Math.round(101.325 + 100) + 10, 1.5), 'the release pressure goes up in steps');
  press('Release: max');
  ok(near(c.release, 1013.25, 0.01), 'to at most ten atmospheres');
  press('Release: min');
  ok(near(c.release, 10.1325, 0.01), 'and down to a tenth of one');
  press('Release: reset');
  ok(near(c.release, 101.325, 0.01), 'reset puts it back');
  const tank = hold('/obj/item/tank/internals/oxygen/empty');
  click(c);
  empty();
  click(c);
  ok(c.holding === tank && /Holding tank +oxygen tank/.test(term().html), 'with a tank in it, the console says so');
  const eject = press('Eject tank');
  ok(eject >= 0 && c.holding === null && !c.valve && a.hands.some((h) => h === tank), 'Eject tank puts it in her hands and shuts the valve');
});

section('a canister lets its gas out into the room', () => {
  const { at, step, can } = round();
  const c = can('toxins').find((m) => at.isCell[m.tile]);
  const all = () => sumOf(at.tox);
  ok(all() === 0, 'there is no plasma in the air at the start');
  const start = c.mix.total();
  c.valve = true; c.release = 200;
  step(4);
  ok(all() > 50, `with the valve open, plasma comes out into the room (${all().toFixed(1)} kPa about the tiles)`);
  ok(c.mix.total() < start, 'and the canister has less');
  const moles = c.mix.total() + all() * CELL_MOLES_PER_KPA;
  ok(near(moles, start, start * 0.01), 'and what it lost is in the room');
  c.valve = false;
  const lo = c.mix.total();
  step(2);
  ok(c.mix.total() === lo, 'shut, it lets out nothing');
});

section('a canister can be broken, and cut apart', () => {
  const { sim, g, at, step, can, standBy, hold, click, events, a } = round();
  const c = can('carbon_dioxide').find((m) => at.isCell[m.tile]);
  const co2 = () => sumOf(at.co2) * CELL_MOLES_PER_KPA;
  const was = c.mix.total();
  for (let k = 0; k < 5; k++) c.hit(22);
  ok(!c.broken, 'it takes more than five laser shots');
  for (let k = 0; k < 20 && !c.broken; k++) c.hit(22);
  step(0.1);
  ok(c.broken && c.mix.total() === 0 && c.v === 10 && !c.it.dense, 'broken open it has nothing left, shows its wreck, and can be walked over');
  ok(near(co2(), was, was * 0.01), `its gas is all in the room (${co2().toFixed(0)} of ${was.toFixed(0)} moles)`);
  ok(events().some((e) => e.e === 'pd' && e.i === c.it.idx) && events().some((e) => e.e === 'pv' && e.i === c.it.idx && e.v === 10), 'everyone is told');
  const gs = sim.gridState(g);
  ok(gs.pd.includes(c.it.idx) && gs.pv.some(([i, v]) => i === c.it.idx && v === 10), 'and so is anybody who joins later');
  const d = can('nitrogen').find((m) => at.isCell[m.tile] && !m.broken);
  ok(standBy(d), 'she stands by a nitrogen canister');
  const wl = hold('/obj/item/weldingtool'); wl.lit = true; wl.fuel = 20; a.intent = 'help';
  click(d, { wait: 0.1 });
  step(3.4);
  ok(d.it.gone && d.broken, 'a lit welder cuts it apart in three seconds');
  const metal = [...sim.floor.values()].filter((f) => f.grid === g && /sheet\/metal/.test(f.item.path) && Math.hypot(f.x - d.it.x, f.z - d.it.z) < 2.5);
  ok(metal.reduce((s, f) => s + (f.item.amount ?? 1), 0) >= 10, 'leaving ten sheets of metal');
});

section('the portable pump', () => {
  const { at, step, dev, standBy, click, hold, msgs, empty } = round();
  const p = dev.list.find((m) => m instanceof Pump && at.isCell[m.tile]);
  ok(standBy(p) && !p.on && p.out && near(p.target, ONE_ATMOSPHERE, 1e-9) && p.mix.total() === 0, 'a pump starts off, set to Out at one atmosphere, empty');
  const room = () => at.total(p.tile);
  const r0 = room();
  p.on = true; p.out = false; p.target = 800;
  step(2);
  ok(p.mix.pressure() > 100 && room() < r0, `on In, it takes the room's air into itself (${Math.round(p.mix.pressure())} kPa in it, ${room().toFixed(0)} left in the tile)`);
  const got = p.mix.total();
  p.out = true; p.target = 300;
  step(3);
  ok(p.mix.total() < got && room() > 20, 'on Out, it lets it back');
  p.on = false;
  const held = p.mix.total();
  step(1);
  ok(p.mix.total() === held, 'off, it does nothing');
  empty();
  const tank = hold('/obj/item/tank/internals/oxygen');
  click(p);
  ok(p.holding === tank && msgs().includes('You insert the oxygen tank into the portable air pump.'), 'a tank goes into a pump too');
  p.mix.clear();
  p.on = true; p.out = true; p.target = 30;
  step(2);
  ok(near(p.mix.pressure(), 30, 0.5) && tank.mix.pressure() < 300, 'on Out with a tank, it fills itself from the tank, to the target');
  p.out = false; p.target = 800;
  step(2);
  ok(p.mix.pressure() < 1 && tank.mix.pressure() > 600, 'and on In it puts it back');
});

section('scrubbers', () => {
  const { at, dev } = round();
  const s = dev.list.find((m) => m instanceof Scrubber && !m.huge && at.isCell[m.tile]);
  const i = s.tile;
  at.addGases(Math.floor(s.it.x / TILE), Math.floor(s.it.z / TILE), { tox: 30, co2: 30, n2o: 5 }, s.it.l | 0);
  const [o2, n2, tox, co2] = [at.o2[i], at.n2[i], at.tox[i], at.co2[i]];
  s.on = true;
  s.process();
  ok(at.tox[i] < tox * 0.65 && at.co2[i] < co2 * 0.65 && near(at.o2[i], o2, 1e-6) && near(at.n2[i], n2, 1e-6), 'a scrubber takes the foul gases out of the tile it stands on and leaves the air');
  ok(s.mix.g.tox > 0 && s.mix.g.co2 > 0 && s.mix.g.o2 === 0, 'and keeps them in itself');
  s.filters.delete('tox');
  const t1 = at.tox[i];
  s.process();
  ok(near(at.tox[i], t1, 1e-6) && at.co2[i] < co2 * 0.45, 'a filter switched off lets that gas be');
  s.filters.add('o2');
  const o1 = at.o2[i];
  s.process();
  ok(at.o2[i] < o1, 'any gas can be filtered, oxygen too');
  s.on = false;
  const held = s.mix.total();
  s.process();
  ok(s.mix.total() === held, 'off, it does nothing');
  s.on = true; s.mix.g.co2 = 1e6;
  const c0 = at.co2[i];
  s.process();
  ok(at.co2[i] === c0, 'and full (80 atmospheres), it takes in no more');
});

section('the portable scrubber console and its tank', () => {
  const { a, at, dev, standBy, click, hold, empty, term, press, msgs, step } = round();
  const s = dev.list.find((m) => m instanceof Scrubber && !m.huge && at.isCell[m.tile]);
  standBy(s); empty();
  click(s);
  ok(term().title === 'Portable Air Scrubber' && /Plasma/.test(term().html) && term().buttons.some((b) => /^\[x\] Plasma/.test(b.l)), 'its console lists the gases it filters');
  press('Turn on');
  ok(s.on && s.v === 2, 'Turn on switches it on, and the picture changes');
  press('[x] Plasma');
  ok(!s.filters.has('tox') && term().buttons.some((b) => /^\[ \] Plasma/.test(b.l)), 'a filter can be switched off');
  press('[ ] Oxygen');
  ok(s.filters.has('o2'), 'and on');
  const tank = hold('/obj/item/tank/internals/generic');
  tank.mix.g.co2 = molesAt(300, 70); tank.mix.g.o2 = molesAt(300, 70);
  click(s);
  ok(s.holding === tank && msgs().some((t) => /^You insert the .* into the portable air scrubber\.$/.test(t)), 'a tank goes in');
  s.on = true; s.filters = new Set(['co2']);
  step(3);
  ok(tank.mix.g.co2 < molesAt(300, 70) * 0.2 && s.mix.g.co2 > 0, 'it takes the carbon dioxide out of the tank');
  void a;
});

section('the huge scrubber', () => {
  const { g, at, w, step, dev, standBy, click, hold, msgs } = round();
  const h = dev.list.find((m) => m.huge);
  const c0 = Math.floor(h.it.x / TILE), r0 = Math.floor(h.it.z / TILE), l0 = h.it.l | 0;
  const near9 = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]];
  for (const [dc, dr] of near9) at.addGases(c0 + dc, r0 + dr, { tox: 20 }, l0);
  const around = () => near9.reduce((s, [dc, dr]) => s + (w.inb(c0 + dc, r0 + dr, l0) ? at.tox[w.idx(c0 + dc, r0 + dr, l0)] : 0), 0);
  const t0 = around();
  ok(t0 > 20, 'there is plasma about it');
  ok(h.operational, 'its room has equipment power');
  h.on = true; h.setLoad(true);
  for (let k = 0; k < 4; k++) h.process();
  ok(around() < t0 * 0.2 && h.mix.g.tox > 0 && h.on, 'switched on it cleans its own tile and the ones round it');
  g.power.powered = () => false;
  h.process();
  ok(!h.operational && !h.on, 'with the power gone it stops');
  delete g.power.powered;
  ok(standBy(h), 'she stands by it');
  hold('/obj/item/wrench');
  click(h);
  step(2.4);
  ok(!h.anchored && msgs().some((t) => /^You unsecure the huge air scrubber\.$/.test(t)), 'a wrench unbolts it');
  h.on = true; h.process();
  ok(!h.on, 'and it will not run loose');
});

section('the gas analyzer', () => {
  const { sim, a, at, can, standBy, click, clickAt, hold, msgs, g } = round('atmospheric_technician');
  ok(a.worn.rpocket?.def.analyzer, 'an atmospheric technician starts with a gas analyzer in the pocket');
  hold('/obj/item/analyzer');
  const c = can('oxygen')[0];
  standBy(c);
  click(c);
  const txt = msgs().join('\n');
  ok(/You use the analyzer on the o2 canister\./.test(txt) && /Results of analysis of the o2 canister\./.test(txt), 'on a canister it says she used it, and what it reads');
  ok(/Moles: 1871\.\d+ mol/.test(txt) && /Volume: 1000 L/.test(txt) && /Pressure: 4559\.\d+ kPa/.test(txt) && /Oxygen: 100 % \(1871\.\d+ mol\)/.test(txt) && /Temperature: 20 °C \(293\.15 K\)/.test(txt), 'its moles, volume, pressure, the gas, the temperature');
  const e = can('')[0]; standBy(e); click(e);
  ok(msgs().includes('The canister is empty!'), 'an empty canister is empty');
  a.cool = 0;
  sim.actions.activate(a);
  step0(sim);
  const air = msgs();
  ok(air.includes('Results:') && air.some((t) => /^Pressure: 10\d(\.\d+)? kPa$/.test(t)) && air.some((t) => /^Nitrogen: 78\.9\d* % \(/.test(t)) && air.some((t) => /^Oxygen: 21\.0\d* % \(/.test(t)), 'used in the hand it reads the air she stands in');
  const [tc, tr] = a.tile;
  at.addGases(tc, tr, { tox: 5, co2: 2 }, a.l | 0);
  sim.actions.activate(a);
  step0(sim);
  ok(msgs().some((t) => /^Plasma: /.test(t)) && msgs().some((t) => /^Carbon Dioxide: /.test(t)), 'with plasma and carbon dioxide in it, they are listed');
  const tank = sim.newItem('/obj/item/tank/internals/oxygen');
  place(sim, tank, g, a.x, a.z, undefined, a.l | 0);
  clickAt({ k: 'item', id: tank.id });
  ok(msgs().some((t) => /^Results of analysis of the oxygen tank\.$/.test(t)) && msgs().some((t) => /^Pressure: 607\.9\d* kPa$/.test(t)), 'on a tank on the floor it reads the tank');
});
function step0(sim) { for (let k = 0; k < 3; k++) sim.step(SIM_DT); }

section('the air alarm and its modes', () => {
  const { a, g, at, w, step, dev, click, standBy, hold, msgs } = round();
  const cellsOf = (area) => { const out = []; for (let i = 0; i < w.n; i++) if (at.isCell[i] && w.areaIdx[i] === area) out.push(i); return out; };
  const ventsOf = (area) => at.vents.filter((i) => w.areaIdx[i] === area);
  /** Is the room shut in: nothing it touches lets its air through (a closed door is a wall), and none of it leaks to space? */
  const sealed = (area) => {
    const P = at.pairs;
    for (let k = 0; k < P.length; k += 3) {
      const x = P[k], y = P[k + 1];
      if ((w.areaIdx[x] === area) === (w.areaIdx[y] === area)) continue;
      if (w.airBlock[x] || w.airBlock[y] || (w.edge[x] & P[k + 2])) continue;
      return false;
    }
    return ![...at.sinkCells].some((i) => w.areaIdx[i] === area);
  };
  const al = dev.alarms.find((x) => { const cells = cellsOf(x.area), v = ventsOf(x.area); return cells.length >= 12 && cells.length <= 60 && v.length >= 3 && (x.it.l | 0) === 0 && sealed(x.area); });
  ok(al && at.mode[al.area] === AIR_MODE.SCRUBBING, 'a room starts with its alarm on Filtering');
  const cells = cellsOf(al.area);
  const avg = () => cells.reduce((s, i) => s + at.total(i), 0) / cells.length;
  const plasma = () => cells.reduce((s, i) => s + at.tox[i], 0) / cells.length;
  console.log(`  (${w.areas[al.area].n}: ${cells.length} tiles, ${ventsOf(al.area).length} vents, ${avg().toFixed(0)} kPa)`);
  ok(standBy(al.it), 'she stands by an air alarm');
  hold('/obj/item/card/id'); a.access = new Set([24]);
  click(al, { wait: 0.1 });
  ok(!al.locked && msgs().includes('You unlock the air alarm interface.'), 'an ID with Atmospherics access unlocks it');
  a.access = new Set([10]);
  click(al, { wait: 0.1 });
  ok(!al.locked && msgs().includes('Access denied.'), 'one without access does not touch it');
  a.access = new Set([24]);
  click(al, { wait: 0.1 });
  ok(al.locked && msgs().includes('You lock the air alarm interface.'), 'and the right one locks it again');
  for (const i of cells) at.tox[i] = 10;
  at.hot[2] = true;
  const p0 = plasma();
  step(10);
  ok(plasma() > p0 * 0.9, `on Filtering the scrubbers leave plasma alone (${plasma().toFixed(1)} of ${p0.toFixed(1)} kPa left)`);
  al.setMode(AIR_MODE.CONTAMINATED);
  step(30);
  ok(plasma() < p0 * 0.2, `on Contaminated they take it out (${(plasma() / p0 * 100).toFixed(0)}% left after 30 s)`);
  al.setMode(AIR_MODE.SCRUBBING);
  step(25);
  ok(avg() > 85 && avg() < 120, `and the vents keep a room at an atmosphere (${avg().toFixed(0)} kPa)`);
  al.setMode(AIR_MODE.PANIC);
  step(40);
  ok(avg() < 15, `Panic Siphon empties the room (${avg().toFixed(1)} kPa)`);
  al.setMode(AIR_MODE.OFF);
  for (const i of cells) { for (const arr of at.arrs) arr[i] = 0; at.o2[i] = 20; }
  step(8);
  ok(near(avg(), 20, 1), 'Off stops the vents and the scrubbers');
  al.setMode(AIR_MODE.REPLACEMENT);
  step(40);
  ok(al.mode === AIR_MODE.SCRUBBING && at.mode[al.area] === AIR_MODE.SCRUBBING, 'Cycle empties the room and then goes back to Filtering');
  step(60);
  ok(avg() > 85, `and the vents fill it again (${avg().toFixed(0)} kPa)`);
  al.setMode(AIR_MODE.REFILL);
  step(60);
  ok(avg() > 250, `Refill brings a room to three atmospheres (${avg().toFixed(0)} kPa)`);
  al.setMode(AIR_MODE.VENTING);
  step(60);
  ok(avg() > 110 && avg() < 215, `Draught brings it down from three atmospheres to somewhere short of two, the siphon taking what the vents put in (${avg().toFixed(0)} kPa)`);
  g.power.areaPowered = () => false;
  al.setMode(AIR_MODE.PANIC);
  const a0 = avg();
  step(10);
  ok(near(avg(), a0, 5), 'a room whose environment power is off has vents and scrubbers that do nothing');
  delete g.power.areaPowered;
});

section('the air alarm console', () => {
  const { sim, A, at, dev, click, standBy, empty, term, press, msgs, step } = round();
  const al = dev.alarms.find((x) => at.areaProbe(x.area) >= 0 && (x.it.l | 0) === 0);
  standBy(al.it); empty();
  click(al);
  const t = term();
  ok(t && t.title === 'Air Alarm' && /Optimal/.test(t.html) && /Oxygen/.test(t.html) && /Carbon Dioxide/.test(t.html) && /locked/.test(t.html), 'an empty hand opens its console: the air, how bad it is, and that it is locked');
  ok(t.buttons.length === 8 && t.buttons.every((b) => b.d), 'all eight modes are shut while it is locked');
  al.locked = false;
  sim.terminals.render(A, true); step(0.05);
  const t2 = term();
  ok(t2.buttons.every((b) => !b.d) && t2.buttons.map((b) => b.l.replace('* ', '')).join() === 'Filtering,Contaminated,Draught,Refill,Panic Siphon,Cycle,Siphon,Off' && t2.buttons[0].l.startsWith('* '), 'and open when it is not, in the DM\'s order, with the present one starred');
  press('Siphon');
  ok(al.mode === AIR_MODE.SIPHON && at.mode[al.area] === AIR_MODE.SIPHON && msgs().includes('The air alarm is set to Siphon.'), 'pressing Siphon sets it');
  for (let i = 0; i < at.tox.length; i++) if (at.isCell[i] && dev.grid.world.areaIdx[i] === al.area) at.tox[i] += 3;
  at.hot[2] = true;
  sim.terminals.render(A, true); step(0.05);
  ok(/Plasma +<span class="b">3\.00 kPa/.test(term().html) && /DANGER/.test(term().html), 'a foul gas in the air shows up as a reading, and as danger');
});

section('what joiners and clients are told', () => {
  const { sim, g, can, A } = round();
  const c = can('oxygen')[0];
  const t = sim.newItem('/obj/item/tank/internals/oxygen/empty');
  c.holding = t; c.touch();
  const late = [];
  sim.addClient('Bob', (m) => late.push(m));
  const welcome = late.find((m) => m.t === 'welcome');
  const gs = welcome.grids.find((q) => q.g === g.id);
  ok(gs.pv.some(([i, v]) => i === c.it.idx && v === 9), 'a late joiner is told which canisters show something other than their first picture');
  const rep = new Replica({ level: DATA.level, rects: DATA.rects }, { ...welcome, you: A.id });
  const rg = rep.grids.get(g.id);
  ok(rg.props.interact[c.it.idx].pv === 9, 'the client has the picture');
  const d = can('nitrogen')[0];
  d.breakOpen();
  rep.apply({ e: 'pd', g: g.id, i: d.it.idx, d: 0 });
  ok(rg.props.interact[d.it.idx].dense === false, 'and a canister broken open is no longer in the way there');
  rep.apply({ e: 'pg', g: g.id, i: c.it.idx });
  ok(rg.props.interact[c.it.idx].gone, 'one cut apart is gone');
  const late2 = [];
  sim.addClient('Carol', (m) => late2.push(m));
  const gs2 = late2.find((m) => m.t === 'welcome').grids.find((q) => q.g === g.id);
  ok(gs2.pd.includes(d.it.idx), 'someone who joins after is told it is broken');
});

section('a blast lets the gas out', () => {
  const { sim, g, at, can } = round();
  const c = can('toxins').find((m) => at.isCell[m.tile]);
  const moles = c.mix.total();
  sim.explosion(g, c.it.x, c.it.z, { heavy: 1, light: 3 });
  ok(c.it.gone && c.mix.total() === 0 && sumOf(at.tox) * CELL_MOLES_PER_KPA > moles * 0.95, 'a canister near a blast is destroyed and its gas is in the room');
  const d = can('oxygen').find((m) => at.isCell[m.tile] && !m.it.gone);
  const far = can('nitrogen').find((m) => at.isCell[m.tile] && !m.it.gone && Math.hypot(m.it.x - d.it.x, m.it.z - d.it.z) > 8 * TILE);
  sim.explosion(g, d.it.x + 2.5 * TILE, d.it.z, { heavy: 1, light: 4 });
  ok(!d.it.gone && d.broken, 'a little further out it is only broken open');
  ok(far && !far.broken && !far.it.gone, 'and one far off is left alone');
});

section('the debug menu lets gas out', () => {
  const { sim, A, at, step } = round('station_engineer', { debug: true });
  const dbg = (op, extra = {}) => { sim.handle(A, { t: 'dbg', op, ...extra }); step(0.05); };
  dbg('gas', { gas: 'tox', kpa: 50 });
  ok(near(sumOf(at.tox), 50, 0.5), 'the gas button lets 50 kPa of plasma out');
  dbg('gas', { gas: 'co2', kpa: 30 });
  ok(near(sumOf(at.co2), 30, 0.5), 'and carbon dioxide');
  dbg('gas', { gas: 'nonsense', kpa: 30 });
  ok(near(sumOf(at.co2), 30, 0.5), 'a gas that is not one is refused');
  const i = at.tox.indexOf(Math.max(...at.tox));
  dbg('gas', {});
  ok(at.total(i) === 0, 'with no gas named it takes the air of the tile away');
});

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
