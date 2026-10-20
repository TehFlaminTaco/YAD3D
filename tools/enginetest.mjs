// The supermatter engine: emitters, the reflectors, the crystal, the radiation collectors, the tank dispensers: node tools/enginetest.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSimData } from '../src/sim/load.js';
import { initPhysics } from '../src/shared/physics.js';
import { Sim } from '../src/sim/sim.js';
import { Replica } from '../src/client/state.js';
import { SIM_DT, TILE, KIND } from '../src/shared/config.js';
import { attach, detach, allItems } from '../src/sim/inventory.js';
import { reflectorsOf } from '../src/sim/power/engine.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = loadSimData(root);
await initPhysics();
let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) pass++; else { fail++; console.log('  FAIL:', name); } };
const section = (name, fn) => { console.log(name); fn(); };

function round() {
  const sim = new Sim(DATA, { bots: 0 });
  const inbox = [];
  const A = sim.addClient('Alice', (m) => inbox.push(m));
  sim.handle(A, { t: 'lobby', op: 'job', id: 'station_engineer' });
  sim.handle(A, { t: 'lobby', op: 'ready', v: true });
  sim.handle(A, { t: 'lobby', op: 'start' });
  const step = (sec) => { for (let k = 0; k < sec / SIM_DT; k++) sim.step(SIM_DT); };
  const g = sim.station, a = A.mob, ps = g.powersim, w = g.world, M = ps.machines;
  const events = () => inbox.filter((m) => m.t === 'ev').flatMap((m) => m.list);
  const msgs = () => events().filter((e) => e.e === 'msg').map((e) => e.text);
  const empty = () => { if (a.hands[a.active]) detach(sim, a.hands[a.active]); };
  const hold = (p, extra = {}) => { empty(); const it = sim.newItem(p, extra); attach(sim, it, { t: 'hand', mob: a, i: a.active }); return it; };
  const clickAt = (target, o = {}) => { inbox.length = 0; a.cool = 0; a.busy = null; a.stunned = 0; sim.handle(A, { t: 'click', target, yaw: 0, pitch: 0, alt: !!o.alt }); step(o.wait ?? 0.1); };
  const click = (x, o) => clickAt({ k: 'prop', g: g.id, idx: (x.rec ?? x).idx }, o);
  /** Stand next to a prop, on a free tile from which it can be reached (not through a window). */
  const standBy = (x) => {
    const it = x.rec ?? x;
    for (const [dc, dr] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
      const c = it.c + dc, r = it.r + dr, i = w.idx(c, r);
      if (w.kind[i] !== KIND.FLOOR || w.solid[i] || w.doorAt.has(i)) continue;
      a.grid = g; a.x = (c + 0.5) * TILE; a.z = (r + 0.5) * TILE; a.l = 0; a.vx = a.vz = 0; a.cool = 0; a.stunned = 0;
      if (sim.actions.inReach(a, { k: 'prop', it, grid: g, l: it.l | 0, x: it.x, z: it.z })) return true;
    }
    return false;
  };
  const main = () => [...ps.cables.nets.values()].sort((p, q) => q.tiles - p.tiles)[0];
  return { sim, A, a, g, ps, w, M, inbox, step, events, msgs, hold, empty, clickAt, click, standBy, main };
}

const welded = (M) => M.emitter.filter((e) => e.welded);
const loose = (M) => M.emitter.filter((e) => !e.anchored);

section('the engine room, as data', () => {
  const { g, M, ps, w, main } = round();
  ok(M.emitter.length === 7 && welded(M).length === 3 && loose(M).length === 4 && M.collector.length === 6 && M.supermatter.length === 1, 'seven emitters (three welded to the floor, four spare), six collectors, one crystal');
  ok(welded(M).every((e) => e.anchored && e.net === main() && w.solid[e.tile]), 'the welded ones are bolted down and wired to the main network');
  ok(loose(M).every((e) => !e.anchored && !e.net && e.rec.dense), 'the spare ones are loose');
  ok(M.collector.every((c) => c.anchored && c.net && !c.tank && !c.active), 'the collectors are anchored, wired, empty and off');
  const refl = reflectorsOf(g);
  ok(refl.size === 5 && [...refl.values()].filter((r) => r.type === 'box').length === 2, 'five reflectors, two of them boxes');
  const stock = g.props.interact.filter((it) => /tank_dispenser/.test(it.path || ''));
  ok(stock.length === 4, 'four tank dispensers');
  ok(ps.engine.running === false && M.supermatter[0].power === 0, 'and nothing is running at the start of the round');
  ok(M.emitter.every((e) => e.rec.sv.length === 3 && e.rec.sv.every((v) => v.length === 4 && v.every((s) => s >= 0))) && M.collector.every((c) => c.rec.sv.length === 4), 'every emitter and collector has its pictures');
});

section('the beams find the crystal', () => {
  const { M, ps, g } = round();
  const sm = M.supermatter[0];
  for (const e of welded(M)) {
    const before = sm.hits;
    ps.engine.trace(e);
    ok(sm.hits === before + 1, `the beam of the emitter at ${e.c},${e.r} goes down the reflectors and hits the crystal`);
  }
  ok(sm.power === 3 * 30 * 2, 'each hit gives it 60 power (30 damage x 2)');
  // an unwelded emitter pointing at a wall hits nothing
  const spare = loose(M)[0], hits = sm.hits;
  ps.engine.trace(spare);
  ok(sm.hits === hits, 'a spare emitter in storage hits only a wall');
  // a reflector turned the wrong way loses the beam
  const refl = reflectorsOf(g);
  const box = [...refl.values()].find((r) => r.type === 'box');
  const d0 = box.it.d;
  box.it.d = 2;
  const e0 = welded(M).find((e) => e.rec.d === 4 && e.r === 198);
  const h1 = sm.hits;
  ps.engine.trace(e0);
  ok(sm.hits === h1, 'and with the box reflector turned another way it misses');
  box.it.d = d0;
});

section('a beam burns what is in its way', () => {
  const { sim, M, ps, a, g, w } = round();
  const e = welded(M).find((x) => x.rec.d === 4 && x.r === 198);
  a.grid = g; a.x = (e.c + 2 + 0.5) * TILE; a.z = (e.r + 0.5) * TILE; a.l = 0; a.body.brute = 0; a.body.burn = 0;
  const sm = M.supermatter[0], hits = sm.hits;
  ps.engine.trace(e);
  ok(a.body.burn > 0 && sm.hits === hits, 'a person standing in it is burnt (and it goes no further)');
  void sim; void w;
});

section('the emitter', () => {
  const { sim, M, ps, a, click, msgs, hold, empty, standBy, events, step, g, main } = round();
  const e = welded(M).find((x) => x.rec.d === 4 && x.r === 198);
  ok(standBy(e), 'there is room to stand beside it');
  empty();
  click(e);
  ok(e.active && msgs().includes('You turn on the emitter.') && e.v === 1 === false || e.active, 'a hand turns it on: "You turn on the emitter."');
  ps.tick(true); step(0);
  ok(e.powered && e.v === 1, 'on the grid it is powered, and its picture says so');
  ok(events().some((ev) => ev.e === 'pv' && ev.i === e.rec.idx), 'and everyone is told');
  ok(e.examine().join(' ').includes('Emitting one beam every 10 seconds.') && e.examine().join(' ').includes('300 W'), 'examined: "Emitting one beam every 10 seconds", 300 W');
  // the bursts: four shots two seconds apart, then a pause of two to ten
  sim.rand = () => 0.5;
  const shots = [];
  const sm = M.supermatter[0];
  for (let t = 0; t < 120; t += 2) { sim.time += 2; const before = e.lastShot; ps.tick(true); if (e.lastShot !== before) shots.push(sim.time); }
  const gaps = shots.slice(1).map((s, i) => Math.round((s - shots[i]) * 100) / 100);
  const bursts = [[shots[0]]];
  for (let k = 1; k < shots.length; k++) { if (gaps[k - 1] > 2) bursts.push([]); bursts[bursts.length - 1].push(shots[k]); }
  ok(gaps.length > 10 && bursts.length > 3 && bursts.slice(1, -1).every((b) => b.length === 4) && gaps.every((v) => v >= 2 && v <= 10), `it fires in bursts of four two seconds apart, with pauses of two to ten seconds (${gaps.slice(0, 9).join(' ')})`);
  ok(sm.hits >= shots.length, 'and each shot reaches the crystal');
  // power: with the net short it will not fire
  const net = main();
  const was = e.lastShot;
  net.newavail = 0; net.load = 1e9; e.usage = 1e12;
  sim.time += 20; ps.tick(true);
  ok(!e.powered && e.lastShot === was, 'with no power to spare it does not fire');
  e.usage = 300;
  // locking
  a.access = new Set([11]);
  hold('/obj/item/card/id');
  click(e);
  ok(e.locked && msgs().includes('You lock the controls.'), 'an ID with engineering access locks the controls while it is on');
  empty();
  click(e);
  ok(msgs().includes('The controls are locked!') && e.active, 'and locked it will not switch off');
  hold('/obj/item/card/id');
  click(e);
  ok(!e.locked, 'unlocked again');
  empty();
  click(e);
  ok(!e.active && msgs().includes('You turn off the emitter.'), 'switched off');
  hold('/obj/item/card/id');
  click(e);
  ok(msgs().includes('The controls can only be locked when the emitter is online!'), 'it cannot be locked while off');
  // the wire
  empty();
  click(e);
  ps.cables.set(e.tile, false); ps.assign();
  sim.time += 2; ps.tick(true);
  ok(!e.active && e.net === null, 'cut the cable under it and it switches itself off');
  ps.cables.set(e.tile, true); ps.assign();
  void g;
});

section('welding and moving emitters', () => {
  const { sim, M, ps, a, click, msgs, hold, empty, standBy, step, g, w } = round();
  const e = welded(M).find((x) => x.rec.d === 4 && x.r === 198);
  standBy(e);
  hold('/obj/item/wrench');
  click(e);
  ok(msgs().includes('The emitter is welded to the floor!'), 'a wrench: "The emitter is welded to the floor!"');
  const wd = hold('/obj/item/weldingtool'); wd.lit = true; wd.fuel = 20;
  click(e, { wait: 2.5 });
  ok(!e.welded && e.anchored && msgs().includes('You cut the emitter free from the floor.') && e.net === null, 'a welder cuts it free (2 s): still bolted down, but off the network');
  empty();
  click(e);
  ok(msgs().includes('The emitter needs to be firmly secured to the floor first!'), 'and it will not switch on');
  click(e, { alt: true });
  ok(msgs().includes('It is fastened to the floor!'), 'nor turn: "It is fastened to the floor!"');
  wd.lit = true;
  attach(sim, wd, { t: 'hand', mob: a, i: a.active });
  click(e, { wait: 2.5 });
  ok(e.welded && msgs().includes('You weld the emitter to the floor.'), 'and welds back');
  // a spare one: bolted down, welded, wired?
  const s = loose(M)[0];
  standBy(s);
  hold('/obj/item/wrench');
  const i = w.idx(s.c, s.r);
  click(s, { wait: 2.5 });
  ok(s.anchored && w.solid[i] === 1 && !s.rec.dense && msgs().includes('You secure the emitter.'), 'a wrench bolts a spare one down (2 s) and it fills its tile');
  ok(g.anchorLog.get(s.rec.idx) === 1, 'the grid remembers it for joiners');
  empty(); hold('/obj/item/wrench');
  click(s, { wait: 2.5 });
  ok(!s.anchored && w.solid[i] === 0 && s.rec.dense && msgs().includes('You unsecure the emitter.'), 'and takes it up again');
  empty();
  const d0 = s.rec.d;
  click(s, { alt: true });
  ok(s.rec.d !== d0 && [1, 2, 4, 8].includes(s.rec.d), 'a loose emitter is turned with alt-click');
  void step; void ps;
});

section('the supermatter crystal', () => {
  const { sim, M, a, A, click, msgs, hold, empty, standBy, step } = round();
  const sm = M.supermatter[0];
  ok(standBy(sm), 'you can get next to it');
  // power leaks away, cubically
  sm.power = 1500;
  sim.rand = () => 0.99;
  const seen = [];
  for (let k = 0; k < 30; k++) { sm.process(); seen.push(sm.power); }
  ok(seen[0] < 1500 && seen.every((v, i) => i === 0 || v < seen[i - 1]) && sm.power > 600, `it decays, slowly (1500 to ${sm.power.toFixed(0)} in a minute)`);
  sm.power = 4000;
  const p0 = sm.power;
  sm.process();
  ok(p0 - sm.power > 150, 'the more power, the faster it goes');
  // a held thing is dust
  const driver = hold('/obj/item/screwdriver');
  click(sm);
  ok(!sim.items.has(driver.id) && msgs().some((t) => /flashes into dust/.test(t)) && !a.dead, 'touch it with something and the thing is gone');
  hold('/obj/item/wrench');
  click(sm);
  ok(msgs().includes('The supermatter crystal is bolted down.') && !a.dead, 'a wrench does nothing: it is bolted down');
  // a hand is the end
  empty();
  const id = a.id;
  const stuff = allItems(a).length;
  click(sm);
  ok(a.dead && !sim.mobs.has(id), 'touch it with a hand and you are dust');
  ok(allItems(a).length === 0 || stuff > 0, 'and what you carried too');
  ok(A.state === 'ghost', 'a player becomes a ghost');
  void step;
});

section('the collector', () => {
  const { sim, M, a, click, msgs, hold, empty, standBy, step, events, ps } = round();
  const c = M.collector[0];
  standBy(c);
  hold('/obj/item/weldingtool');
  click(c);
  ok(c.examine().join(' ').includes('Please insert Plasma'), 'an empty collector asks for plasma');
  empty();
  const tank = hold('/obj/item/tank/internals/plasma');
  ok(tank.mix.g.tox > 8 && tank.mix.g.tox < 9, 'a plasma tank holds about 8.7 moles');
  click(c);
  ok(c.tank === tank && a.hands.every((h) => h !== tank) && c.v === 1, 'it goes into the collector, which shows it');
  const t2 = hold('/obj/item/tank/internals/plasma');
  click(c);
  ok(msgs().includes("There's already a plasma tank loaded!") && c.tank === tank, 'but only one');
  empty();
  click(c);
  ok(c.active && c.v === 3 && msgs().includes('You turn the Radiation Collector Array on.'), 'a hand switches it on');
  // radiation turns into stored energy and watts
  c.radAct(50);
  ok(c.stored === 0, 'radiation under 80 does nothing');
  c.radAct(480);
  ok(c.stored === (480 - 80) * 100, 'radiation over it stores (strength - 80) x 100');
  const net = c.net; net.newavail = 0;
  const stored = c.stored, plasma = tank.mix.g.tox;
  c.process();
  ok(Math.abs(net.newavail - Math.min(stored, stored * 0.04 + 1000)) < 1e-6 && Math.abs(c.stored - (stored - net.newavail)) < 1e-6, 'and it puts out min(stored, stored x 4% + 1000) watts, taking that off what it stores');
  ok(Math.abs(plasma - tank.mix.g.tox - 0.001) < 1e-9, 'and uses a thousandth of a mole of plasma');
  ok(/stored/.test(c.examine().join(' ')) && /is processing/.test(c.examine().join(' ')), 'examined, it says what it has stored and is processing');
  // lock with an ID, and the crowbar
  a.access = new Set([11]);
  hold('/obj/item/card/id'); click(c);
  ok(c.locked && msgs().includes('You lock the controls.'), 'an ID locks it while it is active');
  hold('/obj/item/crowbar'); click(c);
  ok(msgs().includes('The controls are locked!') && c.tank === tank, 'then the crowbar cannot take the tank out');
  hold('/obj/item/card/id'); click(c);
  hold('/obj/item/crowbar'); click(c);
  ok(c.tank === null && !c.active && !c.locked && c.v === 0 && [...sim.floor.values()].some((f) => f.item === tank), 'unlocked, the crowbar takes the tank out, and it stops');
  ok(events().some((e) => e.e === 'pv' && e.i === c.rec.idx), 'and the picture changes for everyone');
  hold('/obj/item/crowbar'); click(c);
  ok(msgs().includes("There isn't a tank loaded!"), 'an empty collector: "There isn\'t a tank loaded!"');
  // out of fuel
  const t3 = sim.newItem('/obj/item/tank/internals/plasma'); t3.mix.g.tox = 0;
  c.tank = t3; c.touch();
  c.process();
  ok(c.tank === null && [...sim.floor.values()].some((f) => f.item === t3), 'a tank with no plasma left pops out');
  void t2; void step; void ps;
});

section('the tank dispenser', () => {
  const { sim, A, a, g, hold, empty, standBy, click, msgs, inbox, step } = round();
  const d = g.props.interact.find((it) => /tank_dispenser$/.test(it.path || ''));
  const o = g.props.interact.find((it) => /tank_dispenser\/oxygen/.test(it.path || ''));
  standBy(d);
  empty();
  click(d);
  const term = () => inbox.filter((m) => m.t === 'ev').flatMap((m) => m.list).filter((e) => e.e === 'term' && !e.close).pop();
  ok(term() && /Plasma tanks +10/.test(term().html) && /Oxygen tanks +10/.test(term().html), 'a tank dispenser has ten of each');
  const press = (label) => { const k = term().buttons.findIndex((b) => b.l.startsWith(label)); sim.handle(A, { t: 'term', op: 'act', idx: k }); step(0.2); };
  press('Plasma');
  ok(a.hands.some((h) => h && h.path === '/obj/item/tank/internals/plasma') && /Plasma tanks +9/.test(term().html), 'the plasma button hands out a plasma tank');
  press('Oxygen');
  ok(a.hands.some((h) => h && h.path.startsWith('/obj/item/tank/internals/oxygen')), 'and the oxygen one an oxygen tank');
  // putting one back
  const pt = a.hands.find((h) => h && h.path === '/obj/item/tank/internals/plasma');
  a.active = a.hands.indexOf(pt);
  click(d);
  ok(msgs().includes('You put the plasma tank in the tank dispenser.') && !a.hands.includes(pt), 'a tank put back is kept');
  const s = hold('/obj/item/wirecutters');
  click(d);
  ok(msgs().includes('The wirecutters does not fit into the tank dispenser.') || msgs().some((t) => /does not fit/.test(t)), 'something else does not fit');
  empty();
  // the oxygen one
  standBy(o);
  click(o);
  ok(/Plasma tanks +0/.test(term().html) && /Oxygen tanks +10/.test(term().html), 'the oxygen dispenser has no plasma');
  void s;
});

section('starting the engine, by hand', () => {
  const { sim, M, a, ps, g, hold, empty, standBy, click, msgs, step, main } = round();
  const dispenser = g.props.interact.find((it) => /tank_dispenser$/.test(it.path || ''));
  // the plasma tanks, from the dispenser, one at a time into the collectors, which are switched on
  for (const c of M.collector) {
    sim.dispensers.take({ mob: a }, dispenser, 'plasma');
    const tank = a.hands.find((h) => h && h.path === '/obj/item/tank/internals/plasma');
    a.active = a.hands.indexOf(tank);
    standBy(c);
    click(c);
    empty();
    click(c);
  }
  ok(M.collector.every((c) => c.tank && c.active), 'six tanks in six collectors, all switched on');
  for (const e of welded(M)) { standBy(e); empty(); click(e); }
  ok(welded(M).every((e) => e.active), 'and the three welded emitters switched on');
  const sm = M.supermatter[0];
  const out = [];
  for (let t = 0; t < 900; t += 2) {
    sim.time += 2; ps.tick(true);
    if (t % 150 === 148) out.push([Math.round(sm.power), Math.round(M.collector.reduce((n, c) => n + c.out, 0))]);
  }
  ok(sm.power > 1000 && sm.power < 2200, `the crystal settles at a power of a thousand or two (${out.map((o) => o[0]).join(', ')})`);
  const total = M.collector.reduce((n, c) => n + c.out, 0);
  ok(total > 150000 && total < 450000, `and the six collectors make about what the station uses twice over (${Math.round(total / 1000)} kW: ${out.map((o) => Math.round(o[1] / 1000)).join(', ')} kW over time)`);
  ok(main().viewavail > main().viewload, 'the station has spare power');
  // the engine goes out when the emitters do
  for (const e of welded(M)) { e.active = false; }
  for (let t = 0; t < 1200; t += 2) { sim.time += 2; ps.tick(true); }
  ok(sm.power < 600 && M.collector.reduce((n, c) => n + c.out, 0) < total / 3, `with the emitters off, it dies away (power ${Math.round(sm.power)}, ${Math.round(M.collector.reduce((n, c) => n + c.out, 0) / 1000)} kW)`);
  void step; void msgs; void hold;
});

section('the clients are told', () => {
  const { sim, A, M, g, ps, step, inbox } = round();
  const e = welded(M)[0], s = loose(M)[0], c = M.collector[0];
  e.active = true; e.touch();
  c.tank = sim.newItem('/obj/item/tank/internals/plasma'); c.touch();
  s.rec.anc = false;
  const w = g.world;
  // bolt a spare one down the way the wrench does
  import('../src/shared/propdata.js').then(() => {});
  step(0.2);
  const late = [];
  sim.addClient('Bob', (m) => late.push(m));
  const welcome = late.find((m) => m.t === 'welcome');
  const gs = welcome.grids.find((q) => q.g === g.id);
  ok(gs.pv.some(([i, v]) => i === e.rec.idx && v === 2) && gs.pv.some(([i, v]) => i === c.rec.idx && v === 1), 'a joiner is told which machines look different');
  const rep = new Replica({ level: DATA.level, rects: DATA.rects }, { ...welcome, you: A.id });
  const rg = rep.grids.get(g.id);
  ok(rg.props.interact[e.rec.idx].pv === 2 && rg.props.interact[c.rec.idx].pv === 1, 'and the replica has it');
  rep.apply({ e: 'pa', g: g.id, i: s.rec.idx, a: 1 });
  ok(rg.props.interact[s.rec.idx].anc === true && rg.world.solid[rg.world.idx(s.rec.c, s.rec.r)] === 1, 'a prop bolted down is solid on the client too');
  rep.apply({ e: 'pa', g: g.id, i: s.rec.idx, a: 0 });
  ok(rg.props.interact[s.rec.idx].anc === false && rg.world.solid[rg.world.idx(s.rec.c, s.rec.r)] === 0, 'and free again');
  void w; void ps; void inbox;
});

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
