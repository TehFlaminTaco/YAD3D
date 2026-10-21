// What is bolted down and what can be dragged, and what a wrench does about it: node tools/anchortest.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSimData } from '../src/sim/load.js';
import { initPhysics } from '../src/shared/physics.js';
import { Sim } from '../src/sim/sim.js';
import { Replica } from '../src/client/state.js';
import { SIM_DT, TILE, KIND } from '../src/shared/config.js';
import { attach, detach } from '../src/sim/inventory.js';

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
  const g = sim.station, a = A.mob, w = g.world;
  const events = () => inbox.filter((m) => m.t === 'ev').flatMap((m) => m.list);
  const msgs = () => events().filter((e) => e.e === 'msg').map((e) => e.text);
  const empty = () => { if (a.hands[a.active]) detach(sim, a.hands[a.active]); };
  const hold = (p, extra = {}) => { empty(); const it = sim.newItem(p, extra); attach(sim, it, { t: 'hand', mob: a, i: a.active }); return it; };
  const clickAt = (target, o = {}) => { inbox.length = 0; a.cool = 0; a.busy = null; a.stunned = 0; sim.handle(A, { t: 'click', target, yaw: 0, pitch: 0, alt: !!o.alt }); step(o.wait ?? 0.1); };
  const click = (it, o) => clickAt({ k: 'prop', g: g.id, idx: it.idx }, o);
  const standBy = (it) => {
    for (const [dc, dr] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
      const c = it.c + dc, r = it.r + dr, i = w.idx(c, r);
      if (w.kind[i] !== KIND.FLOOR || w.solid[i] || w.doorAt.has(i)) continue;
      a.grid = g; a.x = (c + 0.5) * TILE; a.z = (r + 0.5) * TILE; a.l = 0; a.vx = a.vz = 0; a.cool = 0; a.stunned = 0;
      if (sim.actions.inReach(a, { k: 'prop', it, grid: g, l: it.l | 0, x: it.x, z: it.z })) return true;
    }
    return false;
  };
  /** Ctrl+click: try to drag it. */
  const drag = (it) => { a.hauling = null; a.pulling = null; sim.people.drag(a, { k: 'prop', it, grid: g }); const got = a.hauling?.it === it; a.hauling = null; if (it.draggedBy === a) it.draggedBy = null; return got; };
  const find = (re, f = () => true) => g.props.interact.find((it) => it.kind === 'prop' && re.test((it.path || '').replace(/^\//, '')) && f(it));
  return { sim, A, a, g, w, inbox, step, events, msgs, hold, empty, clickAt, click, standBy, drag, find };
}

section('the pipe machines are bolted down', () => {
  const { g, find, drag, sim } = round();
  const pipes = g.props.interact.filter((it) => it.kind === 'prop' && /^machinery\/(atmospherics\/components|meter)/.test((it.path || '').replace(/^\//, '')));
  ok(pipes.length > 590 && pipes.every((it) => it.anc), `every vent, scrubber, pump, valve, filter, mixer, injector, connector and meter is anchored (${pipes.length})`);
  const vent = find(/vent_pump/), meter = find(/^machinery\/meter/), valve = find(/binary\/valve/);
  ok(!drag(vent) && !drag(meter) && !drag(valve), 'and none of them can be dragged');
  const loose = g.props.interact.filter((it) => it.kind === 'prop' && !it.anc && !it.gone && it.mach && /atmospherics\/components/.test(it.path || ''));
  ok(loose.length === 0, 'no pipe machine is loose');
  void sim;
});

section('what the map leaves loose is loose', () => {
  const { find, drag, g } = round();
  for (const [re, name] of [[/canister$/, 'a canister'], [/portable_atmospherics\/pump/, 'a portable pump'], [/portable_atmospherics\/scrubber$/, 'a portable scrubber'], [/space_heater/, 'a space heater'], [/fueltank/, 'a fuel tank'], [/shieldwallgen/, 'a shield wall generator'], [/port_gen/, 'a PACMAN'], [/emitter$/, 'a spare emitter']]) {
    const it = find(re);
    ok(it && !it.anc && it.dense && drag(it), `${name} is loose, and can be dragged`);
  }
  for (const [re, name] of [[/tank_dispenser$/, 'a tank dispenser'], [/portable_atmospherics\/scrubber\/huge/, 'a huge scrubber'], [/emitter\/welded/, 'a welded emitter'], [/rad_collector/, 'a collector'], [/supermatter/, 'the crystal'], [/atmospherics\/components\/unary\/tank/, 'a pressure tank'], [/power\/smes/, 'an SMES'], [/machinery\/vending/, 'a vending machine']]) {
    const it = find(re);
    ok(it && it.anc && !drag(it), `${name} is bolted down, and cannot be dragged`);
  }
  void g;
});

section('a wrench frees and bolts down what the DM says it does', () => {
  const { sim, w, g, a, find, click, msgs, hold, standBy, drag, events, step } = round();
  const heater = find(/space_heater/);
  ok(standBy(heater), 'room to stand by a space heater');
  hold('/obj/item/wrench');
  const i = w.idx(heater.c, heater.r);
  click(heater, { wait: 0.3 });
  ok(msgs().includes('You begin securing the space heater...') && !heater.anc, 'a wrench begins securing it');
  step(2.3);
  ok(heater.anc && !heater.dense && w.solid[i] === 1 && msgs().includes('You secure the space heater.'), 'and after two seconds it is bolted down: it fills its tile');
  ok(events().some((e) => e.e === 'pa' && e.i === heater.idx && e.a === 1), 'everyone is told');
  ok(!drag(heater), 'now it cannot be dragged');
  ok(g.anchorLog.get(heater.idx) === 1, 'and a joiner will be told');
  click(heater, { wait: 0.3 });
  ok(msgs().includes('You begin unsecuring the space heater...'), 'the wrench again begins to free it');
  step(2.3);
  ok(!heater.anc && heater.dense && w.solid[i] === 0 && msgs().includes('You unsecure the space heater.'), 'and it is loose again: a box of its own');
  ok(drag(heater), 'which can be dragged');
  // walking away stops it
  click(heater, { wait: 0.3 });
  a.x += 30; step(0.5);
  ok(!heater.anc && !a.busy, 'walking away stops it');
  standBy(heater);
  // something bolted down in the map comes loose
  const td = find(/tank_dispenser$/);
  standBy(td);
  const j = w.idx(td.c, td.r);
  hold('/obj/item/wrench');
  ok(td.anc && w.solid[j] === 1, 'a tank dispenser starts bolted down');
  click(td, { wait: 0.3 }); step(2.3);
  ok(!td.anc && td.dense && w.solid[j] === 0 && msgs().includes('You unsecure the tank dispenser.'), 'a wrench frees it (the DM: tank_dispenser.dm)');
  ok(drag(td), 'and it can be dragged');
  click(td, { wait: 0.3 }); step(2.3);
  ok(td.anc && w.solid[j] === 1, 'and bolts it down again');
  // no delay
  const cart = find(/food_cart/);
  standBy(cart);
  hold('/obj/item/wrench');
  click(cart, { wait: 0.2 });
  ok(cart.anc && msgs().includes('You secure the food cart.'), 'a food cart is bolted at once (food_cart.dm: no delay)');
  const sg = find(/machinery\/shieldgen/);
  standBy(sg); hold('/obj/item/wrench');
  click(sg, { wait: 0.2 });
  ok(sg.anc && msgs().some((t) => /^You secure the .* to the floor!$/.test(t)), 'a shield generator has its own words');
  click(sg, { wait: 0.2 });
  ok(!sg.anc && msgs().some((t) => /^You unsecure the .* from the floor!$/.test(t)), 'and frees with them');
  void sim;
});

section('and what it does not', () => {
  const { find, click, msgs, hold, standBy, step } = round();
  const tank = find(/fueltank/);
  standBy(tank); hold('/obj/item/wrench');
  click(tank, { wait: 0.3 }); step(2.5);
  ok(!tank.anc && !msgs().some((t) => /securing/.test(t)), 'a fuel tank cannot be wrenched down (only the plumbed ones can)');
  const vend = find(/machinery\/vending/);
  standBy(vend); hold('/obj/item/wrench');
  click(vend, { wait: 0.3 }); step(2.5);
  ok(vend.anc, 'a vending machine does not come loose without its panel open');
  const col = find(/rad_collector/);
  standBy(col); hold('/obj/item/wrench');
  click(col, { wait: 0.3 }); step(2.5);
  ok(col.anc, 'a collector stays put');
});

section('a wrench on a prop with no body of its own changes nothing in the world', () => {
  const { sim, g, w, find, standBy, hold, click, step } = round();
  const ch = find(/cell_charger/);
  const i = w.idx(ch.c, ch.r);
  const solid0 = w.solid[i], boxes0 = (w.boxes.get(i) || []).length;
  standBy(ch); hold('/obj/item/wrench');
  click(ch, { wait: 0.3 }); step(2.3);
  ok(!ch.anc && w.solid[i] === solid0 && (w.boxes.get(i) || []).length === boxes0, 'a charger standing on a table: it is free to drag, and its tile is as it was');
  click(ch, { wait: 0.3 }); step(2.3);
  ok(ch.anc && w.solid[i] === solid0, 'and bolted down again');
  void sim; void g;
});

section('the PACMAN', () => {
  const { sim, ps, M, w, find, standBy, hold, empty, click, msgs, step, a, g } = (() => { const r = round(); return { ...r, ps: r.g.powersim, M: r.g.powersim.machines }; })();
  const pg = M.pacman[0];
  standBy(pg.rec);
  ok(!pg.anchored && pg.net === null, 'a PACMAN starts loose and on no network');
  hold('/obj/item/wrench');
  click(pg.rec, { wait: 0.2 });
  ok(pg.anchored && msgs().includes('You secure the generator to the floor.') && w.solid[w.idx(pg.rec.c, pg.rec.r)] === 1, 'a wrench bolts it down at once');
  ps.cables.set(pg.tile, true); ps.assign();
  ok(pg.net !== null, 'and it is on the cable under it');
  pg.sheets = 5; pg.toggle();
  click(pg.rec, { wait: 0.2 });
  ok(pg.anchored && pg.active, 'while it is running a wrench does nothing');
  pg.toggle();
  click(pg.rec, { wait: 0.2 });
  ok(!pg.anchored && msgs().includes('You unsecure the generator from the floor.') && pg.net === null, 'switched off, a wrench frees it');
  empty();
  void sim; void find; void a; void g;
});

section('canisters and pumps on ports', () => {
  const { g, a, w, find, standBy, hold, click, msgs, drag, step } = round();
  const dev = [...g.pipenet.devs ?? []];
  const can = g.props.interact.find((it) => it.kind === 'prop' && /portable_atmospherics\/canister/.test(it.path || '') && it.mach && it.mach.portHere?.());
  ok(!!can, 'a canister stands on a connector port');
  standBy(can);
  hold('/obj/item/wrench');
  ok(drag(can), 'unfastened it can be dragged');
  click(can, { wait: 0.3 }); step(0.3);
  ok(can.anc && msgs().some((t) => /^You fasten the .* to the port\.$/.test(t)), 'a wrench fastens it to the port');
  ok(!drag(can) && w.solid[w.idx(can.c, can.r)] === 1, 'and now it cannot be dragged');
  click(can, { wait: 0.3 });
  ok(!can.anc && drag(can) && msgs().some((t) => /^You unfasten the .* from the port\.$/.test(t)), 'a wrench takes it off again, and it is loose');
  const pump = find(/portable_atmospherics\/pump/, (it) => !it.mach?.portHere?.());
  standBy(pump); hold('/obj/item/wrench');
  click(pump, { wait: 0.3 });
  ok(!pump.anc && msgs().includes('Nothing happens.'), 'a pump with no port under it: "Nothing happens."');
  void a; void dev;
});

section('the clients', () => {
  const { sim, A, g, w, find, standBy, hold, click, step } = round();
  const heater = find(/space_heater/);
  standBy(heater); hold('/obj/item/wrench');
  click(heater, { wait: 0.3 }); step(2.3);
  const late = [];
  sim.addClient('Bob', (m) => late.push(m));
  const welcome = late.find((m) => m.t === 'welcome');
  const gs = welcome.grids.find((q) => q.g === g.id);
  ok(gs.pa.some(([i, v]) => i === heater.idx && v === 1), 'a joiner is told what was bolted down');
  const rep = new Replica({ level: DATA.level, rects: DATA.rects }, { ...welcome, you: A.id });
  const rg = rep.grids.get(g.id);
  const rit = rg.props.interact[heater.idx];
  ok(rit.anc === true && rg.world.solid[rg.world.idx(heater.c, heater.r)] === 1, 'and the replica has it solid');
  const vent = find(/vent_pump/);
  ok(rg.props.interact[vent.idx].anc === true, 'with the pipe machines bolted down on the client too');
  void w;
});

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
