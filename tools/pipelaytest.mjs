// Taking pipes up and laying them: a wrench on a pipe, the fittings, the pipe dispenser and the rapid pipe dispenser: node tools/pipelaytest.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSimData } from '../src/sim/load.js';
import { initPhysics } from '../src/shared/physics.js';
import { Sim } from '../src/sim/sim.js';
import { Replica } from '../src/client/state.js';
import { SIM_DT, TILE, KIND, N, S, E, W } from '../src/shared/config.js';
import { ONE_ATMOSPHERE, molesAt } from '../src/shared/gases.js';
import { attach, detach } from '../src/sim/inventory.js';
import { SHAPE, SHAPES, PIPE_SLOTS, PIPE_HIDDEN, RECIPES, pipeShape, pipeOfShape, turnCW } from '../src/shared/pipedata.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = loadSimData(root);
await initPhysics();
let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) pass++; else { fail++; console.log('  FAIL:', name); } };
const section = (name, fn) => { console.log(name); fn(); };

function round() {
  const sim = new Sim(DATA, { bots: 0 });
  const inbox = [], last = {};
  const A = sim.addClient('Alice', (m) => { inbox.push(m); if (m.t === 'ev') for (const e of m.list) if (e.e === 'term' && !e.close) last.term = e; });
  sim.handle(A, { t: 'lobby', op: 'job', id: 'station_engineer' });
  sim.handle(A, { t: 'lobby', op: 'ready', v: true });
  sim.handle(A, { t: 'lobby', op: 'start' });
  const step = (sec) => { for (let k = 0; k < sec / SIM_DT; k++) sim.step(SIM_DT); };
  const g = sim.station, a = A.mob, w = g.world, net = g.pipenet;
  a.invulnerable = true;
  const events = () => inbox.filter((m) => m.t === 'ev').flatMap((m) => m.list);
  const msgs = () => events().filter((e) => e.e === 'msg').map((e) => e.text);
  const empty = () => { if (a.hands[a.active]) detach(sim, a.hands[a.active]); };
  const hold = (p, extra = {}) => { empty(); const it = sim.newItem(p, extra); attach(sim, it, { t: 'hand', mob: a, i: a.active }); return it; };
  const clickAt = (target, o = {}) => { inbox.length = 0; a.cool = 0; a.busy = null; a.stunned = 0; sim.handle(A, { t: 'click', target, yaw: 0, pitch: 0, alt: !!o.alt }); step(o.wait ?? 0.1); };
  const clickTile = (c, r, o) => clickAt({ k: 'floor', g: g.id, c, r }, o);
  const click = (it, o) => clickAt({ k: 'prop', g: g.id, idx: it.idx }, o);
  const clickItem = (item, o) => clickAt({ k: 'item', id: item.id }, o);
  const standBy = (c, r) => {
    for (const [dc, dr] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
      const cc = c + dc, rr = r + dr, i = w.idx(cc, rr);
      if (w.kind[i] !== KIND.FLOOR || w.solid[i] || w.doorAt.has(i) || net.devAt.has(i)) continue;
      a.grid = g; a.x = (cc + 0.5) * TILE; a.z = (rr + 0.5) * TILE; a.l = 0; a.vx = a.vz = 0; a.cool = 0; a.stunned = 0;
      return true;
    }
    return false;
  };
  const term = () => last.term;
  const press = (label) => { const k = term().buttons.findIndex((b) => b.l.replace(/^> /, '').startsWith(label)); sim.handle(A, { t: 'term', op: 'act', idx: k }); step(0.1); return k; };
  /** A tile in the open (bare plating) with exactly this one pipe on it, and floor to stand on beside it. */
  const lonePipe = (pred = () => true) => {
    for (let i = 0; i < w.n; i++) {
      const ex = sim.pipefit.exposed(g, i);
      if (ex.length !== 1 || [0, 1, 2, 3].filter((k) => w.pipe[net.slot(k, i)]).length !== 1 || net.devAt.has(i) || g.props.interact.some((p) => !p.gone && p.c === i % w.W && p.r === Math.floor(i / w.W))) continue;
      const c = i % w.W, r = Math.floor(i / w.W), s = ex[0];
      if (!pred(w.pipe[s] & 31, c, r, s)) continue;
      if (standBy(c, r)) return { i, c, r, s, byte: w.pipe[s] };
    }
    return null;
  };
  const fitting = (re = /fitting/) => [...sim.floor.values()].find((rec) => rec.item.fit && re.test(rec.item.name));
  return { sim, A, a, g, w, net, inbox, step, events, msgs, empty, hold, clickAt, clickTile, click, clickItem, standBy, term, press, lonePipe, fitting };
}

section('what a pipe is made of', () => {
  ok(pipeShape('simple', N) === SHAPE.SIMPLE_NS && pipeShape('simple', S) === SHAPE.SIMPLE_NS && pipeShape('simple', E) === SHAPE.SIMPLE_EW && pipeShape('simple', W) === SHAPE.SIMPLE_EW, 'a straight pipe facing north or south is vertical, east or west horizontal');
  ok(pipeShape('simple', N | E) === SHAPE.BEND_NE && pipeShape('simple', S | W) === SHAPE.BEND_SW, 'facing a diagonal it is a bend');
  ok(pipeShape('manifold', S) === SHAPE.MANIFOLD_S && pipeShape('manifold4w', S) === SHAPE.MANIFOLD4, 'manifolds');
  let allBack = true;
  for (const [kind, d] of [['simple', N], ['simple', E], ['simple', N | E], ['simple', S | E], ['simple', N | W], ['simple', S | W], ['manifold', N], ['manifold', S], ['manifold', E], ['manifold', W], ['manifold4w', S]]) {
    const back = pipeOfShape(pipeShape(kind, d));
    if (back.kind !== kind || pipeShape(back.kind, back.d) !== pipeShape(kind, d)) allBack = false;
  }
  ok(allBack, 'every plain pipe turns into a fitting that makes the same pipe again');
  ok(turnCW(N) === E && turnCW(E) === S && turnCW(S) === W && turnCW(W) === N && turnCW(N | E) === (S | E) && turnCW(S | W) === (N | W), 'a quarter turn clockwise, diagonals too');
  const { g } = round();
  ok(RECIPES.every((r) => r.id && r.label && (r.pipe || r.dev || r.meter)) && ['pipe/simple', 'pipe/manifold', 'pipe/manifold4w'].every((k) => g.level.fittings[k]?.pipe), 'the recipes and the level have the pipes\' pictures');
  ok(RECIPES.filter((r) => r.dev).every((r) => [1, 2, 3].every((ly) => g.level.fittingTypes[r.dev]?.[ly])), 'and a machine of each kind on each layer');
  ok([1, 2, 3].every((ly) => Array.from({ length: 11 }, (_, k) => k + 1).every((code) => g.level.pipeSprites[`${code}-${ly}-0`] !== undefined)), 'a picture for every plain pipe on every layer');
});

section('a wrench takes a pipe up', () => {
  const { sim, a, g, w, net, step, msgs, events, hold, clickTile, lonePipe, fitting } = round();
  const L = lonePipe((code) => code === SHAPE.SIMPLE_NS || code === SHAPE.SIMPLE_EW);
  ok(!!L, 'a lone pipe in the open');
  const ly = w.pipeLy[L.s], line = net.lines[net.lineOf[L.s]], room0 = g.atmos.cell(L.i).pressure();
  line.air.g.o2 += 50;                                                                       // some gas in it
  hold('/obj/item/wrench');
  clickTile(L.c, L.r, { wait: 0.3 });
  ok(msgs().includes('You begin to unfasten the pipe...') && w.pipe[L.s] === L.byte, 'it begins: "You begin to unfasten the pipe..."');
  step(2.3);
  ok(msgs().includes('You unfasten the pipe.') && w.pipe[L.s] === 0, 'after two seconds: "You unfasten the pipe." and it is gone');
  const ev = events().find((e) => e.e === 'pipe');
  ok(ev && ev.s === L.s && ev.b === 0, 'everyone is told');
  ok(g.pipeLog.get(L.s)?.[0] === 0, 'and the grid keeps it for joiners');
  const rec = fitting();
  ok(rec && rec.item.name === 'pipe fitting' && rec.item.fit.p === 'pipe/simple' && rec.item.fit.ly === ly && rec.c === L.c && rec.r === L.r, 'a pipe fitting lies on its tile, on the same layer');
  ok(g.atmos.cell(L.i).pressure() > room0, 'the gas it held went out into the room');
  ok(net.lineOf[L.s] === -1, 'it is no part of a pipeline now');
  void sim; void a;
});

section('too much pressure', () => {
  const { sim, a, g, w, net, step, msgs, hold, clickTile, lonePipe } = round();
  const L = lonePipe();
  const line = net.lines[net.lineOf[L.s]];
  const px = a.x, pz = a.z;
  line.air.g.o2 = molesAt(600, line.air.vol);                                                // well over two atmospheres above the room
  const over = line.air.pressure() - g.atmos.cell(L.i).pressure();
  ok(over > 2 * ONE_ATMOSPHERE, `a pipe well over two atmospheres above the room (${Math.round(over)} kPa)`);
  hold('/obj/item/wrench');
  clickTile(L.c, L.r, { wait: 0.3 });
  ok(msgs().includes('As you begin unwrenching the pipe a gush of air blows in your face... maybe you should reconsider?'), 'the warning: "a gush of air blows in your face... maybe you should reconsider?"');
  step(2.3);
  ok(msgs().includes('The pressure sends you flying!') && w.pipe[L.s] === 0, 'and when it comes off: "The pressure sends you flying!"');
  ok(Math.hypot(a.x - px, a.z - pz) > 0.5 || a.stunned > 0, 'the user is thrown away from it');
  ok(g.atmos.cell(L.i).pressure() > 20, 'the pipe\'s gas is out in the room');
  void sim;
});

section('under the floor tiles', () => {
  const { sim, a, g, w, net, step, msgs, hold, clickTile, standBy } = round();
  let found = null;
  for (let i = 0; i < w.n && !found; i++) {
    for (let k = 0; k < PIPE_SLOTS; k++) {
      const s = net.slot(k, i);
      if (w.pipe[s] && (w.pipe[s] & PIPE_HIDDEN) && w.kind[i] === KIND.FLOOR && w.floorType(i)?.k === 'tile' && !net.devAt.has(i)) { found = { i, s, c: i % w.W, r: Math.floor(i / w.W) }; break; }
    }
  }
  ok(!!found && sim.pipefit.exposed(g, found.i).length === 0, 'a pipe under a floor tile is not one you can reach');
  standBy(found.c, found.r); hold('/obj/item/wrench');
  const before = w.pipe[found.s];
  clickTile(found.c, found.r, { wait: 0.3 }); step(2.3);
  ok(w.pipe[found.s] === before && !msgs().some((t) => /unfasten/.test(t)), 'a wrench there does nothing to it');
  void a;
});

section('a pipe fitting goes back on', () => {
  const { sim, a, g, w, net, step, msgs, events, hold, clickTile, clickItem, lonePipe, fitting } = round();
  const L = lonePipe((code) => code === SHAPE.SIMPLE_NS || code === SHAPE.SIMPLE_EW);
  const lines0 = net.lines.length, ly = w.pipeLy[L.s];
  hold('/obj/item/wrench'); clickTile(L.c, L.r, { wait: 0.3 }); step(2.3);
  const rec = fitting(), item = rec.item;
  // a quarter turn in the hand, then down again
  detach(sim, item); sim.items.delete(item.id);
  const held = sim.pipefit.newFitting(g, { ...item.fit });
  empty();
  attach(sim, held, { t: 'hand', mob: a, i: a.active });
  const d0 = held.fit.d;
  sim.actions.activate(a);
  ok(held.fit.d === turnCW(d0), 'turned in the hand: a quarter clockwise');
  sim.actions.activate(a);
  ok(held.fit.d === turnCW(turnCW(d0)) && held.sprite === g.level.fittings['pipe/simple'].s[held.fit.d], 'and again; the picture follows');
  sim.actions.activate(a); sim.actions.activate(a);
  detach(sim, held);
  // put it on the floor where the pipe was and fasten it with a wrench
  const fl = sim.newItem('/obj/item/pipe', { name: held.name, sprite: held.sprite, fit: { ...held.fit } });
  placeAt(sim, fl, g, L);
  hold('/obj/item/wrench');
  const nPipes = [0, 1, 2, 3].filter((k) => w.pipe[net.slot(k, L.i)]).length;
  clickItem(fl);
  ok(msgs().includes(`You fasten the ${fl.name}.`) || msgs().includes('You fasten the pipe fitting.'), '"You fasten the pipe fitting."');
  const now = [0, 1, 2, 3].map((k) => net.slot(k, L.i)).filter((s) => w.pipe[s]);
  ok(now.length === nPipes + 1, 'a pipe is on the tile again');
  const s2 = now.find((s) => w.pipe[s] && w.pipeLy[s] === ly);
  ok(s2 !== undefined && (w.pipe[s2] & PIPE_HIDDEN) !== 0 && (w.pipe[s2] & 31) === pipeShape('simple', held.fit.d), 'the shape the fitting faced, of the same layer, lying under the floor tile like the rest');
  ok(events().some((e) => e.e === 'pipe' && e.b === w.pipe[s2]) && !sim.items.has(fl.id), 'everyone is told, and the fitting is used up');
  ok(net.lineOf[s2] >= 0 && net.lines.length === lines0, 'and it is a part of its pipeline again (the network is as it was)');
  function empty() { if (a.hands[a.active]) detach(sim, a.hands[a.active]); }
});

section('what stops a pipe going down', () => {
  const { sim, a, g, w, net, msgs, hold, clickItem, lonePipe } = round();
  const L = lonePipe((code) => code === SHAPE.SIMPLE_NS);
  const ly = w.pipeLy[L.s];
  hold('/obj/item/wrench');
  const same = sim.newItem('/obj/item/pipe', { name: 'pipe fitting', sprite: 0, fit: { p: 'pipe/simple', n: 'pipe', d: N, ly } });
  placeAt(sim, same, g, L);
  clickItem(same);
  ok(msgs().includes('There is already a pipe at that location!') && sim.items.has(same.id), 'one that joins the same way, on the same layer: "There is already a pipe at that location!"');
  const other = sim.newItem('/obj/item/pipe', { name: 'pipe fitting', sprite: 0, fit: { p: 'pipe/simple', n: 'pipe', d: N, ly: ly === 1 ? 2 : 1 } });
  placeAt(sim, other, g, L);
  clickItem(other);
  ok(!sim.items.has(other.id) && [0, 1, 2, 3].filter((k) => w.pipe[net.slot(k, L.i)]).length === 2, 'on another layer it goes down beside it');
  const cross = sim.newItem('/obj/item/pipe', { name: 'pipe fitting', sprite: 0, fit: { p: 'pipe/simple', n: 'pipe', d: E, ly } });
  placeAt(sim, cross, g, L);
  clickItem(cross);
  ok(!sim.items.has(cross.id) && [0, 1, 2, 3].filter((k) => w.pipe[net.slot(k, L.i)]).length === 3, 'across it on the same layer: it crosses');
  void a;
});

section('the clients', () => {
  const { sim, A, a, g, w, net, step, hold, clickTile, clickItem, lonePipe, fitting } = round();
  const L = lonePipe((code) => code === SHAPE.SIMPLE_NS || code === SHAPE.SIMPLE_EW);
  hold('/obj/item/wrench'); clickTile(L.c, L.r, { wait: 0.3 }); step(2.3);
  const rec = fitting();
  const late = [];
  sim.addClient('Bob', (m) => late.push(m));
  const welcome = late.find((m) => m.t === 'welcome');
  const gs = welcome.grids.find((q) => q.g === g.id);
  ok(gs.pi.some(([s, b]) => s === L.s && b === 0), 'a joiner is told the pipe is gone');
  const rep = new Replica({ level: DATA.level, rects: DATA.rects }, { ...welcome, you: A.id });
  const rg = rep.grids.get(g.id);
  ok(rg.world.pipe[L.s] === 0 && rg.world.pipe.every((b, k) => b === w.pipe[k]), 'and its world has the same pipes as ours');
  clickItem(rec.item);
  step(0.1);
  void a;
  const late2 = [];
  sim.addClient('Cy', (m) => late2.push(m));
  const rep2 = new Replica({ level: DATA.level, rects: DATA.rects }, { ...late2.find((m) => m.t === 'welcome'), you: A.id });
  const rg2 = rep2.grids.get(g.id);
  ok(rg2.world.pipe.every((b, k) => b === w.pipe[k]) && rg2.world.pipeLy.every((b, k) => b === w.pipeLy[k]), 'a later joiner sees the pipe back (all of it, every layer)');
  void net;
});

section('the pipe dispenser', () => {
  const { sim, A, a, g, step, msgs, empty, click, standBy, term, press } = round();
  const emptyAll = () => { for (const h of [0, 1]) if (a.hands[h]) detach(sim, a.hands[h]); };
  const disp = g.props.interact.find((it) => it.kind === 'prop' && /^\/?machinery\/pipedispenser$/.test(it.path || ''));
  ok(!!disp && disp.anc, 'the atmospherics room has one, bolted down');
  ok(standBy(disp.c, disp.r), 'room to stand by it');
  empty();
  click(disp);
  ok(term() && term().title === 'Pipe Dispenser' && term().buttons.length >= 16, 'a click opens it: its layer and what it makes');
  ok(term().buttons.some((b) => b.l === 'Bent Pipe') && term().buttons.some((b) => b.l === 'Meter') && term().buttons.some((b) => b.l === 'Unary Vent'), 'pipes, a bent one, machines, a meter');
  press('Layer ++');
  ok(/PIPING LAYER: <b>3<\/b>/.test(term().html), 'the layer goes up');
  press('Layer --'); press('Layer --');
  press('Pipe');
  const got = a.hands[a.active] || a.hands[1 - a.active];
  ok(got && got.name === 'pipe fitting' && got.fit.p === 'pipe/simple' && got.fit.ly === 1 && got.fit.d === S, 'a pipe: a pipe fitting on layer 1, facing south');
  emptyAll(); step(0.2); press('Bent Pipe');
  ok(![a.hands[0], a.hands[1]].some((x) => x?.fit?.d === (N | E)), 'a second one in a hurry: the dispenser is not ready');
  step(1.2);
  press('Bent Pipe');
  const bent = [a.hands[0], a.hands[1]].filter((x) => x?.fit?.d === (N | E));
  ok(bent.length >= 1, 'a bent pipe is the same pipe made facing north-east');
  step(1.2); emptyAll();
  press('Unary Vent');
  const vent = [a.hands[0], a.hands[1]].find((x) => x?.fit?.p?.includes('vent_pump'));
  ok(vent && vent.name === 'air vent fitting' && vent.fit.ly === 1, 'an air vent fitting, on layer 1');
  step(1.2); emptyAll();
  press('Meter');
  const meter = [a.hands[0], a.hands[1]].find((x) => x?.path === '/obj/item/pipe_meter');
  ok(!!meter && meter.name === 'meter', 'and a meter');
  // put one back
  sim.handle(A, { t: 'term', op: 'close' }); step(0.1);
  const keep = a.hands[a.active] || a.hands[1 - a.active];
  const slot = a.hands[a.active] ? a.active : 1 - a.active;
  if (a.active !== slot) a.active = slot;
  click(disp);
  ok(msgs().some((t) => /^You put the .* back into the pipe dispenser\.$/.test(t)) && !sim.items.has(keep.id), '"You put the ... back into the pipe dispenser."');
});

section('the rapid pipe dispenser', () => {
  const { sim, a, g, w, net, step, msgs, hold, clickTile, term, press } = round();
  // a free bit of plating with no pipe on it
  let spot = null;
  for (let i = 0; i < w.n && !spot; i++) {
    const c = i % w.W, r = Math.floor(i / w.W);
    if (w.kind[i] === KIND.FLOOR && w.floorType(i)?.k === 'plating' && ![0, 1, 2, 3].some((k) => w.pipe[net.slot(k, i)]) && !net.devAt.has(i) && !g.props.interact.some((p) => !p.gone && p.c === c && p.r === r) && !w.solid[i]) {
      spot = { i, c, r };
    }
  }
  const stand = (c, r) => { for (const [dc, dr] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const j = w.idx(c + dc, r + dr); if (w.kind[j] === KIND.FLOOR && !w.solid[j] && !w.doorAt.has(j)) { a.grid = g; a.x = (c + dc + 0.5) * TILE; a.z = (r + dr + 0.5) * TILE; a.l = 0; return true; } } return false; };
  ok(!!spot && stand(spot.c, spot.r), 'bare plating to build on');
  const rpd = hold('/obj/item/pipe_dispenser');
  ok(rpd.def.rpd, 'it is a thing of its own');
  sim.actions.activate(a); step(0.1);
  ok(term() && term().title === 'Rapid Pipe Dispenser', 'activating it opens its choices');
  ok(term().buttons.some((b) => b.l.endsWith('Destroy')) && term().buttons.some((b) => b.l === 'Turn') && !term().buttons.some((b) => b.l === 'Bent Pipe'), 'a mode, the pipes and machines, a layer and a turn (no bent pipe: it is turned)');
  press('Pipe'); press('Turn');
  ok(/Facing    west/.test(term().html), 'turned: west');
  press('Layer 3');
  clickTile(spot.c, spot.r, { wait: 0.7 });
  const s = net.slotAt(spot.i, 3);
  ok(s >= 0 && (w.pipe[s] & 31) === SHAPE.SIMPLE_EW && !msgs().length, 'a click lays it, silently, in half a second');
  clickTile(spot.c, spot.r, { wait: 0.7 });
  ok(msgs().includes('There is already a pipe at that location!'), 'a second the same: "There is already a pipe at that location!"');
  press('Destroy');
  clickTile(spot.c, spot.r, { wait: 0.7 });
  ok(net.slotAt(spot.i, 3) < 0, 'in Destroy mode a click takes it away');
  press('Build'); press('Unary Vent'); press('Layer 1');
  clickTile(spot.c, spot.r, { wait: 0.7 });
  const made = g.props.interact.filter((p) => !p.gone && p.c === spot.c && p.r === spot.r && p.mach);
  ok(made.length === 1 && /vent_pump/.test(made[0].path) && made[0].ly === 1 && made[0].mach.on === false, 'a vent: built, on layer 1, off');
  press('Destroy');
  const vent = made[0], dev = vent.mach;
  a.cool = 0; sim.handle(sim.clients.values().next().value, { t: 'click', target: { k: 'prop', g: g.id, idx: vent.idx }, yaw: 0, pitch: 0 });
  step(0.8);
  ok(vent.gone && !net.devices.includes(dev), 'and a click on the machine takes it away too');
});

function placeAt(sim, item, g, L) {
  const rec = sim.floor.get(item.id);
  if (rec) sim.floor.delete(item.id);
  item.loc = null;
  const x = (L.c + 0.5) * TILE, z = (L.r + 0.5) * TILE;
  const rec2 = { item, grid: g, x, y: 0.01, z, c: L.c, r: L.r, l: 0 };
  sim.floor.set(item.id, rec2);
  item.loc = { t: 'floor' };
  sim.items.set(item.id, item);
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
