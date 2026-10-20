// The power grid: cables, networks, APCs, SMES, generators, and what they do to the station: node tools/powertest.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSimData } from '../src/sim/load.js';
import { initPhysics } from '../src/shared/physics.js';
import { Sim } from '../src/sim/sim.js';
import { Replica } from '../src/client/state.js';
import { SIM_DT, TILE, KIND } from '../src/shared/config.js';
import { CH, lightMode } from '../src/shared/power.js';
import { SMESRATE, SOLAR_GEN_RATE, CELLRATE } from '../src/shared/powerdata.js';
import { attach } from '../src/sim/inventory.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = loadSimData(root);
await initPhysics();
let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) pass++; else { fail++; console.log('  FAIL:', name); } };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const section = (name, fn) => { console.log(name); fn(); };

function round(opts = {}) {
  const sim = new Sim(DATA, { bots: 0, ...opts });
  const inbox = [];
  const A = sim.addClient('Alice', (m) => inbox.push(m));
  sim.handle(A, { t: 'lobby', op: 'job', id: 'station_engineer' });
  sim.handle(A, { t: 'lobby', op: 'ready', v: true });
  sim.handle(A, { t: 'lobby', op: 'start' });
  const step = (sec) => { for (let k = 0; k < sec / SIM_DT; k++) sim.step(SIM_DT); };
  const g = sim.station, ps = g.powersim, w = g.world;
  const tick = (n = 1) => { for (let k = 0; k < n; k++) ps.tick(true); };
  const main = () => [...ps.cables.nets.values()].sort((a, b) => b.tiles - a.tiles)[0];
  return { sim, A, a: A.mob, inbox, step, g, ps, w, tick, main, M: ps.machines };
}

/** A bare-plating tile with a cable on it (the maintenance tunnels have them), and a free tile beside it to stand on. */
function platingCable(w) {
  for (let i = 0; i < w.n; i++) {
    if (w.cable[i] !== 1 || w.kind[i] !== KIND.FLOOR || w.floorType(i)?.k !== 'plating' || w.solid[i]) continue;
    const c = i % w.W, r = Math.floor(i / w.W);
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const j = w.idx(c + dc, r + dr);
      if (w.kind[j] === KIND.FLOOR && !w.solid[j] && w.cable[j] !== 1 && !w.doorAt.has(j)) return { i, c, r, stand: [c + dc, r + dr] };
    }
  }
  return null;
}

section('the map\'s power, as data', () => {
  const { g, ps, w, M } = round();
  ok(w.cable.reduce((n, v) => n + v, 0) === 2778, 'the station has 2,778 cable tiles');
  ok(M.apc.length === 119 && M.smes.length === 13 && M.terminal.length === 13 && M.solar.length === 240 && M.tracker.length === 4 && M.solarControl.length === 4 && M.pacman.length === 2 && M.collector.length === 6, 'and its machines: 119 APCs, 13 SMES with 13 terminals, 240 solar panels, 4 trackers, 4 solar controls, 2 PACMANs, 6 collectors');
  const sizes = [...ps.cables.nets.values()].map((n) => n.tiles).sort((x, y) => y - x);
  ok(sizes[0] === 2251 && sizes.length === 45, `one main network of ${sizes[0]} tiles and ${sizes.length - 1} smaller ones (the solar fields, the SMES terminals, the engine)`);
  ok(M.apc.every((a) => a.net), 'every APC is on a network');
  const coll = M.collector[0].net;
  ok(M.collector.every((c) => c.net === coll) && M.smes.filter((s) => s.inNet === coll).length === 3 && M.smes.every((s) => s.net !== coll), "the engine's six collectors share a network with the three engineering SMES's terminals, which put it onto the station's");
  ok(M.smes.every((s) => !s.broken && s.termTile >= 0 && s.net) && M.smes.filter((s) => s.inNet && s.inNet !== s.net).length === 12, "every SMES found its terminal, and its input side is a network of its own (the cable under it does not join its terminal's): 12 of 13 are wired in");
  ok(M.apc.every((a) => g.world.areas[a.areaIdx]), 'each APC controls an area');
  const lit = [];
  for (let a = 0; a < w.areas.length; a++) if (w.areas[a].c !== 'space' && ps.base[a * 3 + 1] > 0 && !ps.apcOf(a)) lit.push(w.areas[a].n);
  ok(lit.length === 0, `every area with lights has an APC (${lit.join(', ')})`);
  const tot = [0, 1, 2].map((k) => { let s = 0; for (let a = 0; a < w.areas.length; a++) s += ps.base[a * 3 + k]; return s; });
  ok(tot[1] > 50000 && tot[1] < 90000 && tot[0] > 30000, `the rooms draw about what the DM says (equipment ${tot[0]} W, lighting ${tot[1]} W, environment ${tot[2]} W)`);
  ok(g.power.metered.some((v) => v) && !round().sim.grids.get(2)?.power.metered.some((v) => v), 'the station is metered, a shuttle is not');
});

section('the station starts lit', () => {
  const { g, ps, step, main, M } = round();
  step(10);
  ok(ps.status() === 'normal', 'power is normal');
  ok(M.apc.every((a) => a.chan.every((v) => v === 3) && a.operating), 'every APC has all three channels on');
  ok(M.apc.every((a) => a.percent > 88), 'and a charged cell');
  ok(main().viewavail > 100000 && main().viewload > 50000, `the main network makes ${Math.round(main().viewavail)} W and uses ${Math.round(main().viewload)} W`);
  const L = g.props.lights[0];
  ok(lightMode(L, g.power, g.world.areas).on, 'a lamp is lit');
});

section('a cut isolates exactly what it cuts off', () => {
  const { g, ps, w, M, tick, main } = round();
  const apc = M.apc.find((a) => a.net === main() && w.areas[a.areaIdx].c !== 'engine');
  const before = main().tiles, i = apc.tile, c = i % w.W, r = Math.floor(i / w.W);
  const nets = ps.cables.nets.size;
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = w.idx(c + dc, r + dr); if (w.cable[j] === 1) ps.cables.set(j, false); }
  ps.assign();
  ok(apc.net && apc.net.tiles === 1 && main().tiles < before && ps.cables.nets.size > nets, 'cutting all round an APC\'s tile leaves it alone on a network of one');
  tick(2);
  ok(apc.main === 0, 'it sees no power on its line');
  const cell = apc.cell.charge;
  tick(5);
  ok(apc.cell.charge < cell && g.power.powered(apc.areaIdx, CH.LIGHT), 'and runs its room from the cell');
  // join it again
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = w.idx(c + dc, r + dr); if (w.cable[j] !== 1 && w.cable[j - 0] === 0) { /* leave */ } }
  ps.cables.set(w.idx(c + 1, r), true); ps.cables.set(w.idx(c - 1, r), true); ps.cables.set(w.idx(c, r + 1), true); ps.cables.set(w.idx(c, r - 1), true);
  ps.assign();
  ok(apc.net.tiles > 1, 'laying cable beside it joins it to what it touches');
});

section('an APC runs down as the DM says', () => {
  const { g, ps, w, M, tick } = round();
  const apc = M.apc.find((a) => a.net && ps.base[a.areaIdx * 3 + 1] > 0);
  const i = apc.tile, c = i % w.W, r = Math.floor(i / w.W);
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = w.idx(c + dc, r + dr); ps.cables.set(j, false); }
  ps.assign();
  apc.cell.charge = apc.cell.max * 0.25;
  tick(8);                                                            // the longterm count falls below zero
  ok(apc.chan[0] === 1 && apc.chan[1] === 3 && apc.chan[2] === 3, 'below 30% the equipment goes off (auto) and the rest stays');
  ok(!g.power.powered(apc.areaIdx, CH.EQUIP) && g.power.powered(apc.areaIdx, CH.LIGHT), 'its room has no equipment power but still has light');
  apc.cell.charge = apc.cell.max * 0.1;
  tick(2);
  ok(apc.chan[1] === 1 && apc.chan[2] === 3, 'below 15% the lighting goes as well, the environment stays');
  apc.cell.charge = 0;
  tick(2);
  ok(apc.chan.every((v) => v <= 1) && !g.power.powered(apc.areaIdx, CH.ENVIRON) && apc.alarm, 'an empty cell turns everything off, and sounds the alarm');
  const L = g.props.lights.find((x) => x.area === apc.areaIdx);
  ok(!lightMode(L, g.power, w.areas).on || L.kind === 'tube', 'its lamps are dark (bar the few red ones in a corridor)');
  // power comes back: the cell charges and the channels with it
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) ps.cables.set(w.idx(c + dc, r + dr), true);
  ps.assign();
  tick(40);
  ok(apc.cell.charge > 0 && apc.chan.every((v) => v === 3), 'when the line is back the cell charges and the channels come on');
});

section('the SMES', () => {
  const { M, tick } = round();
  const s = M.smes.find((x) => x.percent > 90 && x.net && x.inNet);
  const net = s.net;
  s.inputAttempt = false;
  s.charge = 1e6; s.outputLevel = 50000;
  net.newavail = 0;
  const c0 = s.charge;
  s.outputting = true;
  s.process();
  ok(near(s.outputUsed, 50000) && near(c0 - s.charge, 50000 * SMESRATE, 1e-6) && near(net.newavail, 50000), 'it outputs its set level, at SMESRATE of charge a watt');
  net.netexcess = 20000;
  s.restore(net);
  ok(near(s.outputUsed, 30000) && near(s.charge, c0 - 50000 * SMESRATE + 20000 * SMESRATE, 1e-6), 'and takes back what the network did not use');
  s.charge = 0;
  s.process();
  ok(!s.outputting && s.outputUsed === 0, 'with no charge it stops outputting');
  s.charge = 0; s.inputAttempt = true; s.inputting = true; s.inputLevel = 50000;
  const tn = s.inNet; tn.avail = 80000; tn.load = 0;
  s.process();
  ok(near(s.charge, 50000 * SMESRATE, 1e-6) && near(tn.load, 50000), 'it charges from the spare power on its terminal side, up to its input level');
  void tick;
});

section('solar panels, and the PACMAN', () => {
  const { ps, M, tick, sim, A, a } = round();
  // on the map the arrays are not joined to the control rooms (the cable has a gap in the middle of each): until they are, they make nothing anyone gets
  const ctl = M.solarControl[0];
  ok(ctl.panels.length === 0, 'the solar arrays are not wired to their controls, as the map has them');
  const cluster = M.solar[0];
  ctl.panels = M.solar.filter((p) => p.net === cluster.net);
  for (const p of ctl.panels) p.control = ctl;
  ctl.track = 0; ctl.azimuth = sim.sun.azimuth;
  const net = cluster.net; net.newavail = 0;
  for (const s of ctl.panels) s.process();
  ok(near(ctl.gen, ctl.panels.length * SOLAR_GEN_RATE) && ctl.panels.length === 10 && near(net.newavail, 10 * SOLAR_GEN_RATE), `panels facing the sun make ${SOLAR_GEN_RATE} W each (${ctl.panels.length} of them)`);
  ctl.gen = 0; ctl.azimuth = (sim.sun.azimuth + 180) % 360;
  for (const s of ctl.panels) s.process();
  ok(ctl.gen === 0, 'and none with their backs to it');
  ctl.tracker = M.tracker[0]; ctl.track = 2; ctl.update(2);
  ok(near(ctl.azimuth, sim.sun.azimuth), 'with a tracker on its network the control follows the sun');
  ctl.gen = 0;
  const pg = M.pacman[0];
  ps.cables.set(pg.tile, true); ps.assign();                         // (wrenched down on a cable)
  pg.sheets = 3; ok(pg.toggle() && pg.active, 'a PACMAN with fuel starts');
  const n2 = pg.net; n2.newavail = 0;
  pg.process();
  ok(near(n2.newavail, 10000), 'and makes 10 kW');
  for (let k = 0; k < 1200; k++) { pg.process(); if (!pg.active) break; }
  ok(!pg.active && pg.sheets === 0, 'then stops when the plasma is used up');
  ok(!pg.toggle(), 'it will not start without fuel');
  void ps; void tick; void A; void a;
});

section('a station on its SMES alone', () => {
  const { ps, M, step, main } = round();
  ps.engine.running = false;
  for (const c of M.solarControl) { c.track = 0; c.azimuth = 0; }
  for (let t = 0; t < 1800; t += 2) ps.tick(true);                    // half an hour
  ok(ps.status() === 'normal', 'half an hour after the engine stops, the station is still lit');
  for (const s of M.smes) s.charge = 0;
  for (let t = 0; t < 4000; t += 2) ps.tick(true);
  ok(ps.status() !== 'normal', `with the SMES empty too the rooms start to go dark (${M.apc.filter((a) => a.chan[1] <= 1).length} of ${M.apc.length} APCs have no lights)`);
  for (let t = 0; t < 12000; t += 2) ps.tick(true);
  ok(ps.status() === 'out', `and in the end they all do (${M.apc.filter((a) => a.chan[1] <= 1).length} of ${M.apc.length})`);
  ps.engine.running = true;
  for (let t = 0; t < 600; t += 2) ps.tick(true);
  ok(ps.status() !== 'out' && main().viewavail > 0, 'the engine brings it back');
  void step;
});

section('what the rooms do about it', () => {
  const { g, ps, w, M, tick } = round();
  const door = g.doors.find((d) => g.power.doorsWork(d));
  const a = w.areaIdx[door.i];
  const apc = ps.apcOf(a);
  ok(g.power.doorsWork(door), 'a door works');
  apc.operating = false; apc.publish(true); ps.flush();
  ok(!g.power.doorsWork(door) && !g.power.areaPowered(a), 'with its room\'s breaker off the door does not, and the air does not circulate there');
  apc.operating = true; apc.publish(true);
  ps.setSwitch(a, false);
  const L = g.props.lights.find((x) => x.area === a && x.kind !== 'tube') || g.props.lights.find((x) => x.area === a);
  ok(!g.power.lightsOn(a) && g.power.powered(a, CH.LIGHT), 'the wall switch puts the lights out without touching the power');
  ps.setSwitch(a, true);
  ok(g.power.lightsOn(a) && lightMode(L, g.power, w.areas).on, 'and back on');
  void M; void tick;
});

section('the clients hear of it', () => {
  const { sim, g, ps, w, M, A, inbox, step } = round();
  const late = [];
  sim.addClient('Bob', (m) => late.push(m));
  const welcome = late.find((m) => m.t === 'welcome');
  const gs = welcome.grids.find((x) => x.g === g.id);
  ok(gs.pw && gs.pw.mt.length === w.areas.length && !gs.areaOn && !gs.power, 'the welcome carries each room\'s power state');
  const rep = new Replica({ level: DATA.level, rects: DATA.rects }, { ...welcome, you: A.id });
  const rg = rep.grids.get(g.id);
  ok(rg.power.metered.every((v, i) => v === g.power.metered[i]) && rg.power.chan.every((v, i) => v === g.power.chan[i]), 'the replica has the same');
  ok(rg.world.cable.every((v, i) => v === w.cable[i]), 'and the same cables');
  const apc = M.apc[3];
  inbox.length = 0;
  apc.operating = false; apc.publish(true); ps.flush();
  step(0.2);
  const evs = inbox.filter((m) => m.t === 'ev').flatMap((m) => m.list).filter((e) => e.e === 'area' && e.a === apc.areaIdx);
  ok(evs.length === 1 && evs[0].op === 0 && evs[0].g === g.id, 'switching a breaker off is told as one event for that room');
  rep.apply(evs[0]);
  ok(!rg.power.powered(apc.areaIdx, CH.ENVIRON), 'which the replica applies');
  // cables
  const t = platingCable(w);
  inbox.length = 0;
  ps.cables.set(t.i, false); g.emit({ e: 'cable', i: t.i, on: 0 });
  step(0.2);
  const ce = inbox.filter((m) => m.t === 'ev').flatMap((m) => m.list).find((e) => e.e === 'cable');
  rep.apply(ce);
  ok(rg.world.cable[t.i] === 0, 'and a cable cut as one event the replica applies too');
});

section('cutting and laying cable', () => {
  const { sim, g, ps, w, A, a, step, inbox } = round();
  const t = platingCable(w);
  ok(!!t, 'there is bare plating with a cable on it');
  const stand = (c, r) => { a.grid = g; a.x = c * TILE + 1; a.z = r * TILE + 1; a.vx = a.vz = 0; a.cool = 0; a.stunned = 0; };
  const hold = (path, amount) => { const it = sim.newItem(path); if (amount) it.amount = amount; a.hands[0] = it; it.loc = { t: 'hand', mob: a, i: 0 }; a.active = 0; return it; };
  const click = () => { sim.handle(A, { t: 'click', target: { k: 'floor', g: g.id, c: t.c, r: t.r }, yaw: 0, pitch: 0 }); step(0.1); };
  const msgs = () => inbox.filter((m) => m.t === 'ev').flatMap((m) => m.list).filter((e) => e.e === 'msg').map((e) => e.text);
  stand(...t.stand);
  hold('/obj/item/wirecutters');
  const net0 = ps.cables.net(t.i);
  net0.avail = 0;                                                    // (nothing to shock with)
  inbox.length = 0;
  click();
  ok(w.cable[t.i] === 0 && msgs().includes('You cut the cable.'), 'wirecutters cut the cable on bare plating');
  ok([...sim.floor.values()].some((f) => f.item.path === '/obj/item/stack/cable_coil'), 'and a coil of cable drops');
  ok(ps.cables.dirty || !ps.cables.net(t.i), 'the networks are worked out again');
  inbox.length = 0;
  hold('/obj/item/stack/cable_coil', 5);
  ok(/(^| )coil( |$)/.test(sim.selfState(A).inv.hands[0].tg), 'a coil is tagged for the client, which aims at the floor when you hold one');
  click();
  ok(w.cable[t.i] === 1 && a.hands[0].amount === 4, 'a coil lays it again (one used)');
  inbox.length = 0;
  click();
  ok(msgs().includes("There's already a cable at that position!"), 'not twice');
  // a live cable shocks, unless the gloves are insulating
  ps.assign();
  const live = ps.cables.net(t.i); live.avail = 200000;
  a.hp = 100;
  hold('/obj/item/wirecutters');
  let hurt = false;
  for (let k = 0; k < 40 && !hurt; k++) {
    w.cable[t.i] = 1; ps.cables.dirty = true; ps.assign(); ps.cables.net(t.i).avail = 200000;
    const b0 = a.body.burn;
    click();
    hurt = a.body.burn > b0;
  }
  ok(hurt && a.stunned > 0, 'with bare hands a live cable burns you and knocks you down');
  const gl = sim.newItem('/obj/item/clothing/gloves/color/yellow');
  attach(sim, gl, { t: 'slot', mob: a, slot: 'gloves' });
  a.stunned = 0; const b1 = a.body.burn;
  for (let k = 0; k < 30; k++) { w.cable[t.i] = 1; ps.cables.dirty = true; ps.assign(); ps.cables.net(t.i).avail = 200000; hold('/obj/item/wirecutters'); click(); }
  ok(a.body.burn <= b1 && a.stunned === 0, 'insulated gloves stop it');
  void A;
});

section('the consoles', () => {
  const { sim, g, ps, w, M, A, a, inbox, step } = round();
  const html = () => inbox.filter((m) => m.t === 'ev').flatMap((m) => m.list).filter((e) => e.e === 'term' && !e.close).pop();
  const open = (type, ctx) => { inbox.length = 0; sim.terminals.open(A, type, { grid: g, ...ctx }); step(0.2); return html(); };
  const apc = ps.apcOf(w.areaIdx[w.idx(a.tile[0], a.tile[1])]) || M.apc[0];
  let e = open('apc', { machine: apc });
  ok(/Main breaker/.test(e.html) && /External power/.test(e.html) && /Lighting/.test(e.html) && e.buttons.length === 7, 'an APC shows its room, its line, its cell, its three channels and its cover lock');
  a.access = new Set([10, 11]);
  const press = (label) => { const k = html().buttons.findIndex((b) => b.l.startsWith(label)); sim.handle(A, { t: 'term', op: 'act', idx: k }); step(0.2); };
  apc.locked = true; a.access = new Set();
  step(1.2);                                                          // (the console draws itself again every second)
  press('Breaker off');
  ok(apc.operating, 'a locked APC does not answer to somebody without engine access');
  a.access = new Set([11]);
  step(1.2);
  press('Unlock interface');
  ok(!apc.locked, 'engine access unlocks it');
  press('Breaker off');
  ok(!apc.operating && !g.power.powered(apc.areaIdx, CH.ENVIRON), 'and the breaker turns the power of the room off');
  press('Breaker on');
  press('Lighting: next');
  ok(apc.chan[1] === 2, 'a channel goes from auto to on...');
  press('Lighting: next');
  ok(apc.chan[1] === 0, '...to off...');
  press('Lighting: next');
  ok(apc.chan[1] === 3, '...and back to auto');
  const smes = M.smes.find((s) => s.percent > 10);
  e = open('smes', { machine: smes });
  ok(/Stored energy/.test(e.html) && /Input level/.test(e.html) && /Output level/.test(e.html), 'an SMES shows its charge and its levels');
  const lvl = smes.outputLevel;
  press('Output +10 kW');
  ok(smes.outputLevel === lvl + 10000, 'and its output level goes up by ten kilowatts');
  press('Output -10 kW'); press('Output -10 kW');
  ok(smes.outputLevel === lvl - 10000, 'and down');
  for (let k = 0; k < 30; k++) press('Output +10 kW');
  ok(smes.outputLevel === smes.outputLevelMax, 'but no further than its maximum');
  e = open('solar', { machine: M.solarControl[0] });
  ok(/Generated power/.test(e.html) && /Tracking/.test(e.html), 'the solar control shows the tracking');
  press('Tracking');
  ok(M.solarControl[0].track === 1, 'and its mode changes');
  const pg = M.pacman[0]; ps.cables.set(pg.tile, true); ps.assign();
  e = open('pacman', { machine: pg });
  ok(/Plasma/.test(e.html) && /Output/.test(e.html), 'a PACMAN shows its fuel');
  e = open('power', { name: 'power monitor' });
  ok(/Supply/.test(e.html) && /power controllers/.test(e.html), 'the power monitor lists the APCs');
  const low = M.apc[5]; low.alarm = true;
  e = open('alerts', {});
  ok(/Power alarm/.test(e.html), 'the station alerts console lists power alarms');
});

section('a meteor cuts cables', () => {
  const { g, ps, w } = round();
  const t = platingCable(w);
  const had = (c, r, k) => { let n = 0; for (let dr = -k; dr <= k; dr++) for (let dc = -k; dc <= k; dc++) if (w.inb(c + dc, r + dr) && w.cable[w.idx(c + dc, r + dr)] === 1) n++; return n; };
  const before = had(t.c, t.r, 3);
  const n = ps.blast(t.c, t.r, 3);
  ok(n > 0 && had(t.c, t.r, 3) === before - n, `it cuts the cables near where it lands (${n} of ${before})`);
  void g;
});

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
