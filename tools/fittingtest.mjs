// A wrench takes a pipe machine off its pipe and puts a fitting down again: node tools/fittingtest.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSimData } from '../src/sim/load.js';
import { initPhysics } from '../src/shared/physics.js';
import { Sim } from '../src/sim/sim.js';
import { Replica } from '../src/client/state.js';
import { SIM_DT, TILE, KIND, N, S, E, W } from '../src/shared/config.js';
import { attach, detach, place, shiftItem } from '../src/sim/inventory.js';
import { FACE_INDEX, turnCW } from '../src/shared/pipedata.js';
import { describeState } from '../src/shared/items.js';

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
  const g = sim.station, a = A.mob, w = g.world, net = g.pipenet;
  const events = () => inbox.filter((m) => m.t === 'ev').flatMap((m) => m.list);
  const msgs = () => events().filter((e) => e.e === 'msg').map((e) => e.text);
  const empty = () => { if (a.hands[a.active]) detach(sim, a.hands[a.active]); };
  const hold = (p, extra = {}) => { empty(); const it = sim.newItem(p, extra); attach(sim, it, { t: 'hand', mob: a, i: a.active }); return it; };
  const clickAt = (target, o = {}) => { inbox.length = 0; a.cool = 0; a.busy = null; a.stunned = 0; sim.handle(A, { t: 'click', target, yaw: 0, pitch: 0, alt: !!o.alt }); step(o.wait ?? 0.1); };
  const click = (it, o) => clickAt({ k: 'prop', g: g.id, idx: it.idx }, o);
  const clickItem = (item, o) => clickAt({ k: 'item', id: item.id }, o);
  const standAt = (c, r) => {
    for (const [dc, dr] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1], [0, 0], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
      const cc = c + dc, rr = r + dr, i = w.idx(cc, rr);
      if (w.kind[i] !== KIND.FLOOR || w.solid[i] || w.doorAt.has(i)) continue;
      a.grid = g; a.x = (cc + 0.5) * TILE; a.z = (rr + 0.5) * TILE; a.l = 0; a.vx = a.vz = 0; a.cool = 0; a.stunned = 0;
      return true;
    }
    return false;
  };
  const find = (re, f = () => true) => g.props.interact.find((it) => it.kind === 'prop' && !it.gone && re.test((it.path || '').replace(/^\//, '')) && f(it));
  const fitOf = (it) => [...sim.floor.values()].find((rec) => rec.item.fit && rec.c === it.c && rec.r === it.r);
  const total = () => net.lines.reduce((s, l) => s + l.air.total(), 0);
  return { sim, A, a, g, w, net, inbox, step, events, msgs, hold, empty, clickAt, click, clickItem, standAt, find, fitOf, total };
}

section('the map knows what a machine becomes', () => {
  const { g, find } = round();
  const fit = g.level.fittings;
  const want = ['unary/vent_pump', 'unary/vent_scrubber', 'unary/portables_connector', 'binary/pump', 'binary/valve', 'trinary/filter', 'trinary/mixer', 'machinery/meter'];
  for (const k of want) ok(Object.keys(fit).some((p) => p.includes(k)), `a fitting for ${k}`);
  ok(Object.values(fit).filter((t) => !t.pipe).every((t) => t.n && t.sv.length && t.s.length === 4 && t.s.every((s) => s >= 0)), 'each machine has a name, its own pictures, and four fitting pictures (one for each way it is turned)');
  ok(!Object.keys(fit).some((p) => /unary\/tank|thermomachine|cryo|dp_vent/.test(p)), 'tanks, thermomachines, cryo cells and the dp vent are not among them (the DM does not let a wrench take them off)');
  const vent = find(/vent_pump/);
  ok(!!g.level.fittings[vent.path.replace(/^\//, '')], 'the fitting table is keyed by the prop path');
});

section('a wrench takes a vent off its pipe', () => {
  const { sim, g, net, a, find, click, msgs, hold, standAt, step, events, fitOf, total } = round();
  const vent = find(/vent_pump/, (it) => it.mach?.operational && it.mach.nodes[0]);
  const dev = vent.mach;
  ok(standAt(vent.c, vent.r), 'room to stand by a vent');
  hold('/obj/item/wrench');
  dev.on = true;
  click(vent);
  ok(msgs().includes('You cannot unwrench the air vent, turn it off first!') && !vent.gone, 'one that is running: "turn it off first!"');
  dev.on = false;
  click(vent, { wait: 0.3 });
  ok(msgs().includes('You begin to unfasten the air vent...') && !vent.gone, 'switched off: "You begin to unfasten the air vent..."');
  step(2.3);
  ok(vent.gone && msgs().includes('You unfasten the air vent.'), 'after two seconds it is off');
  ok(!net.devices.includes(dev) && !net.devAt.get(dev.i)?.includes(dev) && vent.mach === null, 'no longer part of the network');
  ok(events().some((e) => e.e === 'pg' && e.i === vent.idx) && g.props.interact.includes(vent), 'everyone is told it is gone (its record stays in the list)');
  const rec = fitOf(vent);
  ok(rec && rec.item.path === '/obj/item/pipe' && rec.item.name === 'air vent fitting', 'a fitting lies on its tile: "air vent fitting"');
  ok(rec.item.fit.p === vent.path.replace(/^\//, '') && rec.item.fit.d === vent.d && rec.item.fit.ly === vent.ly, 'which remembers what it was, which way it faced, and its piping layer');
  ok(describeState(rec.item) === 'facing ' + ({ [N]: 'north', [S]: 'south', [E]: 'east', [W]: 'west' })[rec.item.fit.d], 'it says which way it faces');
  void sim;
});

section('a fitting is turned in the hand', () => {
  const { sim, a, g, find, click, hold, standAt, step, fitOf } = round();
  const vent = find(/vent_pump/, (it) => it.mach?.nodes[0]);
  standAt(vent.c, vent.r); vent.mach.on = false;
  hold('/obj/item/wrench'); click(vent, { wait: 0.3 }); step(2.3);
  const rec = fitOf(vent), item = rec.item, t = g.level.fittings[item.fit.p];
  ok(item.sprite === t.s[FACE_INDEX[item.fit.d]], 'its picture is the fitting turned the way it faces');
  detach(sim, item); sim.items.delete(item.id);
  const held = sim.newItem('/obj/item/pipe', { name: item.name, sprite: item.sprite, fit: { ...item.fit } });
  sim.sim = sim; a.cool = 0; a.hands[a.active] && detach(sim, a.hands[a.active]);
  attach(sim, held, { t: 'hand', mob: a, i: a.active });
  const d0 = held.fit.d, seen = [d0];
  for (let k = 0; k < 4; k++) { sim.actions.activate(a); seen.push(held.fit.d); }
  ok(seen[1] === turnCW(d0) && seen[2] === turnCW(turnCW(d0)) && seen[4] === d0 && new Set(seen).size === 4, 'activating it turns it a quarter, clockwise: four turns and it is as it was');
  ok(held.sprite === t.s[FACE_INDEX[held.fit.d]], 'and the picture follows');
});

section('a wrench on a fitting fastens it down', () => {
  const { sim, a, g, w, net, find, click, clickItem, hold, standAt, step, msgs, events, fitOf, total } = round();
  const vent = find(/vent_pump/, (it) => it.mach?.nodes[0]);
  const dev = vent.mach, d0 = vent.d, n0 = g.props.interact.length;
  standAt(vent.c, vent.r); dev.on = false;
  hold('/obj/item/wrench'); click(vent, { wait: 0.3 }); step(2.3);
  const rec = fitOf(vent), item = rec.item;
  ok(net.devAt.get(w.idx(vent.c, vent.r)) === undefined || !net.devAt.get(w.idx(vent.c, vent.r)).length, 'the tile has no machine on it now');
  standAt(vent.c, vent.r);
  clickItem(item);
  const made = g.props.interact[n0];
  ok(made && made !== vent && made.c === vent.c && made.r === vent.r && made.path === vent.path && made.anc && !made.gone, 'it is a new prop on the same tile, bolted down');
  ok(msgs().includes('You fasten the air vent fitting.') && !sim.items.has(item.id) && !fitOf(vent), 'the fitting is used up: "You fasten the air vent fitting."');
  ok(events().some((e) => e.e === 'p+' && e.sp.length === 1), 'everyone is told of the new prop');
  const nd = made.mach;
  ok(nd && net.devices.includes(nd) && net.devAt.get(nd.i)?.includes(nd), 'the network has its machine');
  ok(nd.d === d0 && nd.nodes[0] != null && nd.parents[0], 'which faces the way it did and is joined to the same pipe');
  ok(nd.on === false, 'and is off');
  // the picture follows the machine
  ok(made.st && made.st.rect === made.sv[made.pv || 0] || made.sv.includes(made.st?.rect), 'with its own picture');
  void a;
});

section('turned another way, it is built that way', () => {
  const { sim, a, g, find, click, clickItem, hold, standAt, step, fitOf } = round();
  const vent = find(/vent_pump/, (it) => it.mach?.nodes[0]);
  const n0 = g.props.interact.length;
  standAt(vent.c, vent.r); vent.mach.on = false;
  hold('/obj/item/wrench'); click(vent, { wait: 0.3 }); step(2.3);
  const rec = fitOf(vent), item = rec.item;
  const was = item.fit.d;
  item.fit.d = turnCW(item.fit.d);
  standAt(vent.c, vent.r); clickItem(item);
  const made = g.props.interact[n0];
  ok(made && made.d === turnCW(was) && made.mach.d === turnCW(was), 'it faces the way the fitting did');
  ok(made.mach.nodes[0] == null, 'and, facing away from its pipe, is joined to nothing');
  void sim; void a;
});

section('what stops it being put down', () => {
  const { sim, a, g, w, net, find, click, clickItem, hold, standAt, step, msgs, fitOf } = round();
  const A = find(/vent_pump/, (it) => it.mach?.nodes[0]);
  const B = find(/vent_scrubber/, (it) => it.mach?.nodes[0] && (it.c !== A.c || it.r !== A.r));
  standAt(B.c, B.r); B.mach.on = false;
  hold('/obj/item/wrench'); click(B, { wait: 0.3 }); step(2.3);
  const item = fitOf(B).item;
  // onto the tile of the vent: a machine already there, on the same layer and the same way
  shiftItem(sim, sim.floor.get(item.id), (A.c + 0.5) * TILE, (A.r + 0.5) * TILE);
  const rec = sim.floor.get(item.id);
  standAt(A.c, A.r); item.fit.ly = A.ly; item.fit.d = A.d;
  const nA = g.props.interact.length;
  clickItem(item);
  ok(msgs().includes('There is already a pipe at that location!') && g.props.interact.length === nA && sim.items.has(item.id), 'on a vent facing the same way, on its layer: "There is already a pipe at that location!"');
  // a bare tile: it is not a pipe, but any room will do for a vent (it just joins nothing)
  const bare = (() => { for (let i = 0; i < w.n; i++) { const c = i % w.W, r = Math.floor(i / w.W); if (w.kind[i] === KIND.FLOOR && !w.solid[i] && !w.doorAt.has(i) && w.areas[w.areaIdx[i]].c === 'hallway' && ![...net.devAt.keys()].includes(i) && ![0, 1, 2, 3].some((k) => w.pipe[net.slot(k, i)]) && !g.props.interact.some((p) => !p.gone && p.c === c && p.r === r)) return [c, r]; } })();
  shiftItem(sim, rec, (bare[0] + 0.5) * TILE, (bare[1] + 0.5) * TILE);
  standAt(bare[0], bare[1]);
  item.fit.ly = 2;
  const n1 = g.props.interact.length;
  clickItem(item);
  const made = g.props.interact[n1];
  ok(made && made.c === bare[0] && made.r === bare[1] && made.mach && made.mach.nodes[0] == null && !sim.items.has(item.id), 'on a tile with no pipes it is built all the same, joined to nothing');
  void a;
});

section('a connector wants its tile to itself', () => {
  const { sim, a, g, net, find, click, clickItem, hold, standAt, step, msgs, fitOf } = round();
  const conn = find(/portables_connector/, (it) => it.mach?.nodes[0]);
  const vent = find(/vent_pump/, (it) => it.mach?.nodes[0]);
  standAt(conn.c, conn.r);
  hold('/obj/item/wrench'); click(conn, { wait: 0.3 }); step(2.3);
  const citem = fitOf(conn)?.item;
  ok(!!citem && citem.name === 'connector port fitting' || !!citem, 'a connector port comes off as a fitting');
  shiftItem(sim, sim.floor.get(citem.id), (vent.c + 0.5) * TILE, (vent.r + 0.5) * TILE);
  standAt(vent.c, vent.r);
  const n = g.props.interact.length;
  clickItem(citem);
  ok(msgs().includes('Something is hogging the tile!') && g.props.interact.length === n, 'onto a tile that has a machine on it: "Something is hogging the tile!"');
  void a; void net;
});

section('the pipes keep their gas when a machine comes off and goes on', () => {
  const { net, find, total } = round();
  const vent = find(/vent_pump/, (it) => it.mach?.nodes[0]), dev = vent.mach;
  const before = total();
  net.unadopt(dev);
  const mid = total();
  ok(Math.abs(mid - before) < 1e-6 * before, 'taken off, the pipes hold what they held');
  const back = net.adopt(vent);
  ok(back && back.nodes[0] != null && Math.abs(total() - before) < 1e-6 * before, 'put back, the same, and it is joined again');
});

section('a connector with a machine on it will not come off', () => {
  const { sim, a, g, find, click, hold, standAt, msgs } = round();
  const conn = find(/portables_connector/, (it) => it.mach?.nodes[0] && g.props.interact.some((p) => p.mach?.port === it.mach));
  void conn;
  const canister = find(/portable_atmospherics\/canister$/);
  const port = find(/portables_connector/, (it) => it.mach?.nodes[0]);
  ok(!!port && typeof port.mach.unwrenchRefusal === 'function', 'a connector can say why it will not come off');
  port.mach.device = { name: 'canister' };
  standAt(port.c, port.r);
  hold('/obj/item/wrench'); click(port);
  ok(msgs().includes('You cannot unwrench the connector port, detach the canister first!') && !port.gone, 'with a canister on it: "You cannot unwrench the connector port, detach the canister first!"');
  void sim; void a; void canister;
});

section('a meter goes on a pipe', () => {
  const { sim, a, g, w, net, find, click, clickItem, hold, standAt, step, msgs, fitOf } = round();
  const meter = find(/^machinery\/meter/);
  standAt(meter.c, meter.r);
  hold('/obj/item/wrench'); click(meter, { wait: 0.3 });
  ok(msgs().includes('You begin to unfasten the gas flow meter...'), 'a meter takes four seconds: it begins');
  step(2.3); ok(!meter.gone, 'and not two');
  step(2);
  ok(meter.gone, 'but four');
  const item = fitOf(meter)?.item;
  ok(item && item.path === '/obj/item/pipe_meter' && item.name === 'meter', 'it comes off as "meter"');
  const bare = (() => { for (let i = 0; i < w.n; i++) { const c = i % w.W, r = Math.floor(i / w.W); if (w.kind[i] === KIND.FLOOR && !w.solid[i] && !w.doorAt.has(i) && ![0, 1, 2, 3].some((k) => w.pipe[net.slot(k, i)]) && !g.props.interact.some((p) => !p.gone && p.c === c && p.r === r)) return [c, r]; } })();
  const rec = sim.floor.get(item.id);
  shiftItem(sim, rec, (bare[0] + 0.5) * TILE, (bare[1] + 0.5) * TILE);
  standAt(bare[0], bare[1]);
  const n = g.props.interact.length;
  clickItem(item);
  ok(msgs().includes('You need to fasten it to a pipe!') && g.props.interact.length === n && sim.items.has(item.id), 'on a bare floor: "You need to fasten it to a pipe!"');
  shiftItem(sim, rec, (meter.c + 0.5) * TILE, (meter.r + 0.5) * TILE);
  standAt(meter.c, meter.r);
  clickItem(item);
  const made = g.props.interact[n];
  ok(msgs().includes('You fasten the meter to the pipe.') && made && made.mach && net.devices.includes(made.mach) && !sim.items.has(item.id), 'back on its pipe: "You fasten the meter to the pipe."');
  ok(made.mach.reading() !== null, 'and it reads the pipe');
  void a;
});

section('the clients', () => {
  const { sim, A, g, w, inbox, find, click, clickItem, hold, standAt, step, fitOf } = round();
  const vent = find(/vent_pump/, (it) => it.mach?.nodes[0]);
  const scr = find(/vent_scrubber/, (it) => it.mach?.nodes[0]);
  standAt(vent.c, vent.r); vent.mach.on = false; scr.mach.on = false;
  hold('/obj/item/wrench'); click(vent, { wait: 0.3 }); step(2.3);
  const n0 = g.props.interact.length;
  clickItem(fitOf(vent).item);
  const made = g.props.interact[n0];
  step(0.2);
  const late = [];
  sim.addClient('Bob', (m) => late.push(m));
  const welcome = late.find((m) => m.t === 'welcome');
  const gs = welcome.grids.find((q) => q.g === g.id);
  ok(gs.ps.length >= 1 && gs.gone.includes(vent.idx), 'a joiner is told of the new prop and that the old one is gone');
  const rep = new Replica({ level: DATA.level, rects: DATA.rects }, { ...welcome, you: A.id });
  const rg = rep.grids.get(g.id);
  ok(rg.props.interact.length === g.props.interact.length, 'with the same number of props');
  const mine = rg.props.interact[made.idx];
  ok(mine && !mine.gone && mine.path === made.path && mine.c === made.c && mine.anc && rg.props.interact[vent.idx].gone, 'the new one built, the old one gone');
  ok(mine.d === made.d && mine.ly === made.ly, 'facing the same way, on the same layer');
  void inbox; void w;
});

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
