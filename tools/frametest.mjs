// Computer frames and circuit boards (buildandrepair.dm, _computer.dm): node tools/frametest.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSimData } from '../src/sim/load.js';
import { initPhysics } from '../src/shared/physics.js';
import { Sim } from '../src/sim/sim.js';
import { Replica } from '../src/client/state.js';
import { SIM_DT, TILE, KIND, N, S, E, W } from '../src/shared/config.js';
import { CH } from '../src/shared/power.js';
import { RECIPES } from '../src/shared/stacks.js';
import { attach, detach, allItems } from '../src/sim/inventory.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = loadSimData(root);
await initPhysics();
let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) pass++; else { fail++; console.log('  FAIL:', name); } };
const section = (name, fn) => { console.log(name); fn(); };

function round() {
  const sim = new Sim(DATA, { bots: 0 });
  const inbox = [];
  const last = {};
  const A = sim.addClient('Alice', (m) => { inbox.push(m); if (m.t === 'ev') for (const e of m.list) if (e.e === 'term' && !e.close) last.term = e; });
  sim.handle(A, { t: 'lobby', op: 'job', id: 'station_engineer' });
  sim.handle(A, { t: 'lobby', op: 'ready', v: true });
  sim.handle(A, { t: 'lobby', op: 'start' });
  const step = (sec) => { for (let k = 0; k < sec / SIM_DT; k++) sim.step(SIM_DT); };
  const g = sim.station, a = A.mob, w = g.world;
  const events = () => inbox.filter((m) => m.t === 'ev').flatMap((m) => m.list);
  const msgs = () => [...events(), ...A.outbox].filter((e) => e.e === 'msg').map((e) => e.text);
  const hold = (p, extra = {}, hand = 0) => {
    const old = a.hands[hand];
    if (old) detach(sim, old);
    if (!p) return null;
    const it = sim.newItem(p, extra);
    attach(sim, it, { t: 'hand', mob: a, i: hand });
    a.active = hand;
    return it;
  };
  const stand = (c, r, l = 0) => { a.grid = g; a.x = (c + 0.5) * TILE; a.z = (r + 0.5) * TILE; a.l = l; a.vx = a.vz = 0; a.cool = 0; a.stunned = 0; };
  const click = (target, wait = 0.1) => { inbox.length = 0; a.busy = null; a.cool = 0; sim.handle(A, { t: 'click', target, yaw: 0, pitch: 0 }); step(wait); };
  const prop = (it) => ({ k: 'prop', g: g.id, idx: it.idx });
  /** An open floor tile with free tiles round it. */
  const spot = () => {
    for (let r = 4; r < w.H - 4; r++) for (let c = 4; c < w.W - 4; c++) {
      let good = true;
      for (let dr = -2; dr <= 2 && good; dr++) for (let dc = -2; dc <= 2; dc++) { const i = w.idx(c + dc, r + dr); if (w.kind[i] !== KIND.FLOOR || w.solid[i] || w.doorAt.has(i) || !g.atmos.isCell[i]) { good = false; break; } }
      if (good && !g.props.interact.some((q) => Math.hypot(q.c - c, q.r - r) < 3)) return [c, r];
    }
    return null;
  };
  const floorOf = (re, c, r) => [...sim.floor.values()].filter((f) => f.grid === g && re.test(f.item.path) && f.c === c && f.r === r);
  step(3);
  return { sim, A, a, g, w, inbox, step, events, msgs, hold, stand, click, prop, spot, floorOf, last };
}

section('the data', () => {
  const L = DATA.level;
  ok(Object.keys(L.boards).length > 40 && Object.keys(L.computerBoards).length > 40, `the game knows what each computer board makes (${Object.keys(L.boards).length}) and which board each computer has (${Object.keys(L.computerBoards).length})`);
  ok(L.computerBoards['machinery/computer/monitor'] === '/obj/item/circuitboard/computer/powermonitor' && L.boards['/obj/item/circuitboard/computer/powermonitor'].bp === 'machinery/computer/monitor', 'the power monitoring console is made from the power monitor board');
  ok(L.frames.computer.length === 4 && L.frames.computer.every((row) => row.length === 5), 'a frame has five pictures (loose to glazed) from each of the four sides');
  ok(RECIPES['/obj/item/stack/sheet/metal'].some((q) => q.title === 'computer frame' && q.req === 5 && q.time === 25), 'five sheets of metal make a computer frame, in 2.5 seconds');
  const { g, sim } = round();
  const boards = [...sim.floor.values()].filter((f) => f.grid === g && /^\/obj\/item\/circuitboard\//.test(f.item.path));
  ok(boards.length >= 50, `the tech storage racks have their circuit boards (${boards.length})`);
  const eng = boards.filter((f) => /computer\/(atmos_alert|stationalert|powermonitor)$/.test(f.item.path));
  ok(eng.length === 3 && new Set(eng.map((f) => `${f.c},${f.r}`)).size === 1, 'the three engineering boards lie together');
  ok(boards.every((f) => sim.level.itemdefs[f.item.path]), 'and each is an item of the game');
});

section('the frame from sheets of metal', () => {
  const { sim, A, g, a, step, hold, stand, spot } = round();
  const [c, r] = spot();
  stand(c, r);
  a.yaw = 0; a.pitch = 0;
  const metal = hold('/obj/item/stack/sheet/metal', { amount: 12 });
  const i = RECIPES['/obj/item/stack/sheet/metal'].findIndex((q) => q.title === 'computer frame');
  sim.handle(A, { t: 'key', k: 'activate' }); step(0.1);
  sim.handle(A, { t: 'stack', op: 'make', item: metal.id, i, mult: 1 });
  step(3);
  const it = g.props.interact.find((q) => q.frame && Math.abs(q.c - c) + Math.abs(q.r - r) === 1);
  ok(!!it && it.frame.state === 0 && !it.anc && it.name === 'computer frame', 'a computer frame stands in front of her, loose');
  ok(it && [S, N, E, W].includes(it.d) && Math.abs(it.c - c) + Math.abs(it.r - r) === 1, 'facing her (its screen towards the builder)');
  ok(metal.amount === 7, `and used five sheets (${metal.amount} left)`);
});

section('the stages', () => {
  const { sim, g, a, step, msgs, hold, stand, click, prop, spot, floorOf, w, last } = round();
  const [c, r] = spot();
  stand(c, r);
  const it = sim.frames.buildComputer(g, c, r - 1, S);
  const is = () => it.frame.state;
  // loose: wrench it down, or weld it up
  hold('/obj/item/wrench');
  click(prop(it), 2.2);
  ok(is() === 1 && it.anc && msgs().includes('You wrench the frame into place.'), 'a wrench fastens it to the floor in two seconds');
  ok(sim.frames.pv(g).some(([i, v]) => i === it.idx && v === 1), 'and it looks it');
  click(prop(it), 2.2);
  ok(is() === 0 && !it.anc && msgs().includes('You unfasten the frame.'), 'again and it is loose');
  const wl = hold('/obj/item/weldingtool'); wl.lit = true; wl.fuel = 20;
  const metal0 = floorOf(/sheet\/metal/, it.c, it.r).reduce((s, f) => s + (f.item.amount ?? 1), 0);
  const it2 = sim.frames.buildComputer(g, c + 1, r, S);
  click(prop(it2), 2.2);
  ok(it2.gone && msgs().includes('You deconstruct the frame.') && floorOf(/sheet\/metal/, it2.c, it2.r).reduce((s, f) => s + (f.item.amount ?? 1), 0) >= 5, 'a welder takes a loose frame apart: five sheets of metal');
  void metal0;
  // anchored: a board
  hold('/obj/item/wrench');
  click(prop(it), 2.2);
  const wrong = hold('/obj/item/circuitboard/machine/autolathe');
  click(prop(it));
  ok(msgs().includes('This frame does not accept circuit boards of this type!') && !it.frame.circuit, 'a machine board does not go in a computer frame');
  const board = hold('/obj/item/circuitboard/computer/powermonitor');
  click(prop(it));
  ok(it.frame.circuit === board && msgs().some((t) => /You place the .*Power Monitor \(Computer Board\) inside the frame\./.test(t)), 'a computer board does');
  hold('/obj/item/crowbar');
  click(prop(it));
  ok(!it.frame.circuit && floorOf(/circuitboard\/computer\/powermonitor/, it.c, it.r).length === 1, 'a crowbar takes it out again, onto the floor');
  hold(null);
  void wrong;
  // the board in, screwed, wired, glazed
  const b2 = hold('/obj/item/circuitboard/computer/powermonitor');
  click(prop(it));
  ok(it.frame.circuit === b2, 'she puts it back');
  hold('/obj/item/screwdriver');
  click(prop(it));
  ok(is() === 2 && msgs().some((t) => /You screw the .* into place\./.test(t)), 'a screwdriver screws it into place');
  const coil = hold('/obj/item/stack/cable_coil', { amount: 3 });
  click(prop(it));
  ok(is() === 2 && msgs().includes('You need five lengths of cable for the frame!'), 'it needs five lengths of cable');
  const coil5 = hold('/obj/item/stack/cable_coil', { amount: 8 });
  click(prop(it), 2.2);
  ok(is() === 3 && coil5.amount === 3 && msgs().includes('You add cables to the frame.'), 'five lengths wire it up');
  hold('/obj/item/wirecutters');
  click(prop(it));
  ok(is() === 2 && floorOf(/cable_coil/, it.c, it.r).reduce((s, f) => s + (f.item.amount ?? 1), 0) >= 5, 'wirecutters take the cable out: five lengths back');
  hold('/obj/item/stack/cable_coil', { amount: 5 });
  click(prop(it), 2.2);
  const glass = hold('/obj/item/stack/sheet/glass', { amount: 1 });
  click(prop(it));
  ok(is() === 3 && msgs().includes('You need two sheets of glass for the frame!'), 'two sheets of glass are needed');
  hold('/obj/item/stack/sheet/glass', { amount: 3 });
  click(prop(it), 2.2);
  ok(is() === 4 && msgs().includes('You put in the glass panel.'), 'two sheets glaze it');
  hold('/obj/item/crowbar');
  click(prop(it));
  ok(is() === 3 && floorOf(/sheet\/glass/, it.c, it.r).length >= 1, 'a crowbar takes the glass out again');
  hold('/obj/item/stack/sheet/glass', { amount: 2 });
  click(prop(it), 2.2);
  void glass; void coil; void a; void step; void w;
  // the monitor is connected
  const base = () => g.powersim.base[g.world.areaIdx[g.world.idx(it.c, it.r)] * 3 + CH.EQUIP];
  const b0 = base();
  hold('/obj/item/screwdriver');
  click(prop(it));
  ok(it.gone && msgs().includes('You connect the monitor.'), 'a screwdriver connects the monitor: the frame is gone');
  const comp = g.props.interact.find((q) => !q.gone && q.c === it.c && q.r === it.r && q.path === 'machinery/computer/monitor');
  ok(!!comp && comp.name === 'power monitoring console' && comp.anc && comp.d === S, 'and there is a power monitoring console in its place');
  ok(base() === b0 + 300, 'which draws its 300 watts');
  // it works
  const gs = sim.gridState(g);
  ok(gs.ps.length >= 2, 'it is told to anyone who joins (the frame and the computer are in the log)');
  stand(it.c, it.r + 1);
  a.cool = 0;
  hold(null);
  click(prop(comp));
  ok(last.term && /POWER|Power|power/.test(JSON.stringify(last.term)), 'and she can use it: it opens the power monitor');
});

section('taking a computer apart', () => {
  const { sim, g, a, w, step, msgs, hold, stand, click, prop, floorOf } = round();
  const comp = g.props.interact.find((q) => q.path === 'machinery/computer/station_alert' && g.atmos.isCell[w.idx(q.c, q.r)]);
  stand(comp.c, comp.r + 1);
  const used = () => g.powersim.base[w.areaIdx[w.idx(comp.c, comp.r)] * 3 + CH.EQUIP];
  const u0 = used();
  hold('/obj/item/screwdriver');
  click(prop(comp), 2.2);
  ok(comp.gone && msgs().includes('You disconnect the monitor.'), 'a screwdriver unscrews a computer in two seconds');
  const frame = g.props.interact.find((q) => q.frame && q.c === comp.c && q.r === comp.r);
  ok(frame && frame.frame.state === 4 && frame.anc && frame.frame.circuit && /circuitboard\/computer\/stationalert$/.test(frame.frame.circuit.path), 'what is left is a glazed frame with its board in it');
  ok(used() === u0 - 300, 'and the room draws 300 watts less');
  hold('/obj/item/crowbar');
  click(prop(frame));
  ok(frame.frame.state === 3 && floorOf(/sheet\/glass/, frame.c, frame.r).length >= 1, 'the glass comes out');
  hold('/obj/item/wirecutters');
  click(prop(frame));
  hold('/obj/item/screwdriver');
  click(prop(frame));
  ok(frame.frame.state === 1, 'the cable and the screws come out');
  hold('/obj/item/crowbar');
  click(prop(frame));
  ok(!frame.frame.circuit && floorOf(/circuitboard\/computer\/stationalert/, frame.c, frame.r).length === 1, 'and the board');
  // examine
  ok(sim.frames.examine(frame).join(' ') === 'This is a computer frame. There is no circuit board in it.', 'a frame says whether it has a board');
  void step;
});

section('canister frames', () => {
  const R = RECIPES['/obj/item/stack/sheet/metal'].find((q) => q.title === 'canister frame');
  ok(R && R.req === 5 && R.time === 8 && R.onFloor && R.onePerTurf, 'five sheets of metal make a canister frame, in under a second');
  ok(DATA.level.frames.canister.length === 4, 'there are four tiers of frame to draw');
  const { sim, A, g, a, step, msgs, hold, stand, click, prop, spot } = round();
  const [c, r] = spot();
  stand(c, r);
  a.yaw = 0; a.pitch = 0;
  const metal = hold('/obj/item/stack/sheet/metal', { amount: 12 });
  const i = RECIPES['/obj/item/stack/sheet/metal'].indexOf(R);
  sim.handle(A, { t: 'stack', op: 'make', item: metal.id, i, mult: 1 });
  step(2);
  const it = g.props.interact.find((q) => q.frame && q.frame.kind === 'canister');
  ok(!!it && it.name === 'Tier 0 canister frame' && metal.amount === 7, 'a canister frame stands in front of her, and cost five sheets');
  hold('/obj/item/stack/sheet/metal', { amount: 3 });
  click(prop(it));
  ok(msgs().includes('You need at least five sheets for that!') && it.frame.state === 0, 'it takes five more sheets of metal to make it tier 1');
  const m5 = hold('/obj/item/stack/sheet/metal', { amount: 6 });
  click(prop(it), 1.7);
  ok(it.frame.state === 1 && it.name === 'Tier 1 canister frame' && m5.amount === 1, 'five more sheets make it a tier 1 frame');
  hold('/obj/item/stack/sheet/plasteel', { amount: 6 });
  click(prop(it), 1.7);
  ok(it.frame.state === 1, 'plasteel does nothing yet (tier 2 canisters are not made)');
  const n0 = g.atmosdev.list.length;
  hold('/obj/item/screwdriver');
  click(prop(it), 0.8);
  const can = g.props.interact.find((q) => !q.gone && q.mach && q.name === 'Tier 1 canister' && q.c === it.c && q.r === it.r);
  ok(it.gone && !!can && g.atmosdev.list.length === n0 + 1 && can.mach.mix.total() === 0 && !can.anc, 'a screwdriver finishes it: an empty tier 1 canister, loose');
  ok(can.mach.examine()[0] === 'This canister is tier 1.', 'it is the canister of the game');
  can.mach.valve = true; can.mach.release = 500;
  can.mach.mix.g.o2 = 100;
  step(1.2);
  ok(can.mach.mix.total() < 100, 'and it works: it lets its gas out');
});

section('what the clients see', () => {
  const { sim, A, g, a, w, step, hold, stand, click, prop, spot } = round();
  const [c, r] = spot();
  stand(c, r);
  const it = sim.frames.buildComputer(g, c, r - 1, W);
  sim.frames.set(it, 3);
  const late = [];
  sim.addClient('Bob', (m) => late.push(m));
  const welcome = late.find((m) => m.t === 'welcome');
  const gs = welcome.grids.find((q) => q.g === g.id);
  ok(gs.pv.some(([i, v]) => i === it.idx && v === 3), 'a joiner is told what state the frame is in');
  const rep = new Replica({ level: DATA.level, rects: DATA.rects }, { ...welcome, you: A.id });
  const rg = rep.grids.get(g.id);
  const rit = rg.props.interact.find((q) => q.idx === it.idx);
  ok(rit && rit.path === 'structure/frame/computer' && rit.sv.length === 5, 'and builds it with its five pictures');
  void a; void w; void step; void hold; void click; void prop; void E; void N;
});

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
