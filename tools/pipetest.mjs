// Pipes: the map's pipes as data, the network they make, and the vents, pumps, valves, filters and mixers on it: node tools/pipetest.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSimData } from '../src/sim/load.js';
import { initPhysics } from '../src/shared/physics.js';
import { Sim } from '../src/sim/sim.js';
import { Replica } from '../src/client/state.js';
import { SIM_DT, TILE } from '../src/shared/config.js';
import { SHAPES, PIPE_SLOTS, isHidden, pipeSpriteKey } from '../src/shared/pipedata.js';
import { Mix, molesAt, ONE_ATMOSPHERE, CELL_MOLES_PER_KPA, GAS_IDS } from '../src/shared/gases.js';
import { AIR_MODE } from '../src/shared/gases.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = loadSimData(root);
await initPhysics();
let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) pass++; else { fail++; console.log('  FAIL:', name); } };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const section = (name, fn) => { console.log(name); fn(); };

const t0 = Date.now();
const sim = new Sim(DATA, { bots: 0 });
const built = Date.now() - t0;
const g = sim.station, w = g.world, at = g.atmos, net = g.pipenet;
const step = (sec) => { for (let k = 0; k < sec / SIM_DT; k++) sim.step(SIM_DT); };
const cycles = (n) => { for (let k = 0; k < n; k++) { net.t += 0; net.update(0.5); } };      // (n half-second runs of the air machinery, without the rest of the world)
const molesOf = (m) => m.total();
const kind = (d) => d.constructor.name;
const byKind = (name) => net.devices.filter((d) => kind(d) === name);
/** Every gas in the pipeline `l`, its pipes and the nodes of the machines on it, as moles (what must not change when gas only moves about). */
const lineMoles = (l) => l.air.total() + l.ports.reduce((s, p) => s + p.dev.airs[p.k].total(), 0);

section('the map\'s pipes, as data', () => {
  let pipes = 0, hidden = 0;
  const layers = [0, 0, 0, 0];
  for (let s = 0; s < w.n * PIPE_SLOTS; s++) if (w.pipe[s]) { pipes++; layers[w.pipeLy[s]]++; if (isHidden(w.pipe[s])) hidden++; }
  ok(pipes === 4578, `${pipes} pipes (the map has 4,578)`);
  ok(layers.slice(1).join() === '1995,631,1952', `on the three layers: ${layers.slice(1).join(', ')} (the scrubbers' layer 1, the air supply on 3)`);
  ok(hidden > 3500 && hidden < pipes, `${hidden} of them lie under the floor tiles`);
  let stacked = 0;
  for (let i = 0; i < w.n; i++) if (w.pipe[3 * w.n + i]) stacked++;
  ok(stacked === 32, 'thirty-two pipes cross another on their layer and have the fourth slot');
  ok([...new Set([...w.pipe].filter(Boolean).map((b) => b & 31))].every((c) => SHAPES[c]), 'every shape is one the table knows');
  const lvl = DATA.level;
  let missing = 0;
  for (let s = 0; s < w.n * PIPE_SLOTS; s++) if (w.pipe[s] && !(lvl.pipeSprites[pipeSpriteKey(w.pipe[s], w.pipeLy[s], w.pipeCol[s])] >= 0)) missing++;
  ok(missing === 0, 'and every one has a picture');
  const parts = g.props.interact.filter((it) => /^machinery\/atmospherics\/components\//.test(it.path || ''));
  const count = (re) => parts.filter((it) => re.test(it.path)).length;
  ok(parts.length === 619 - 52 && count(/unary\/vent_pump/) === 197 && count(/unary\/vent_scrubber/) === 188 && count(/portables_connector/) === 54 && count(/binary\/pump/) === 54, 'the vents, scrubbers, connector ports and pumps the map has');
  ok(count(/binary\/valve/) === 15 && count(/trinary\/filter/) === 14 && count(/trinary\/mixer/) === 4 && count(/outlet_injector/) === 16 && count(/unary\/tank/) === 10 && count(/thermomachine/) === 11, 'and its valves, filters, mixers, injectors, tanks and thermomachines');
  ok(g.props.interact.filter((it) => /^machinery\/meter/.test(it.path || '')).length === 52, 'fifty-two gas flow meters');
  ok(parts.filter((it) => it.flat).every((it) => it.sv.length >= 1 && it.sv.every((s) => s >= 0)) && parts.every((it) => it.mach), 'every part has its pictures and its machine');
  ok(built < 2500, `the whole sim, pipes and all, is made in ${built} ms`);
});

section('what joins what', () => {
  ok(net.devices.length === 619, 'six hundred and nineteen machines on or beside pipes');
  const open = net.devices.filter((d) => d.ports.some((p) => p.link == null)).map((d) => `${kind(d)}@${d.it.c},${d.it.r}`).sort();
  ok(open.join() === 'Scrubber@172,157,Tank@144,175', `only two have a node on nothing, and the map has them so (${open.join(' ')})`);
  const big = [...net.lines].sort((p, q) => q.slots.length - p.slots.length);
  ok(big[0].slots.length > 2000 && big[1].slots.length > 1800 && big[2].slots.length < 100, `two great networks, the scrubbers' (${big[0].slots.length} pipes) and the supply (${big[1].slots.length}), then the small loops of the atmospherics room and the engine`);
  const scrub = big[0], supply = big[1];
  ok([...scrub.devs].filter((d) => kind(d) === 'Scrubber').length >= 180 && [...supply.devs].filter((d) => kind(d) === 'VentPump').length >= 165, 'every scrubber is on the one and every air vent on the other');
  ok(scrub !== supply && scrub.air.vol > 140000 && supply.air.vol > 140000, 'which are two, of a hundred and forty thousand litres each');
  ok(net.lines.every((l) => l.air.vol >= 0) && net.lines.every((l) => l.slots.every((s) => net.lineOf[s] === l.id)), 'every pipe is on the line that says so');
  // two pipes cross at (128, 172): green east to west, the scrubbers' pipe north to south, and they do not join
  const t = w.idx(128, 172), here = [];
  for (let k = 0; k < PIPE_SLOTS; k++) if (w.pipe[k * w.n + t]) here.push(k * w.n + t);
  ok(here.length === 2 && net.lineOf[here[0]] !== net.lineOf[here[1]], 'a pipe that crosses another does not join it');
  // a scrubber on layer 1 beside a pipe on layer 2 is not joined to it
  const lone = byKind('Scrubber').find((d) => d.it.c === 172 && d.it.r === 157);
  ok(lone.ly === 1 && lone.ports[0].link == null && lone.parents[0].slots.length === 0, 'a layer 1 scrubber beside a layer 2 pipe is on its own');
  // the layer adaptors join the layers
  const lay = [];
  for (let s = 0; s < w.n * PIPE_SLOTS; s++) if (w.pipe[s] && SHAPES[w.pipe[s] & 31].kind === 'layer') lay.push(s);
  ok(lay.length === 11 && lay.every((s) => (net.adj.get(s)?.size ?? 0) >= 2), 'eleven layer adaptors, each joined to what it sits between');
  const mixed = lay.filter((s) => { const L = net.lines[net.lineOf[s]]; return new Set(L.slots.map((x) => w.pipeLy[x])).size > 1; });
  ok(mixed.length > 0, 'and some of them make one line of pipes of two layers');
  // the heat exchangers only join their own kind
  const he = [];
  for (let s = 0; s < w.n * PIPE_SLOTS; s++) if (w.pipe[s] && SHAPES[w.pipe[s] & 31].kind === 'he') he.push(s);
  ok(he.length > 60 && he.every((s) => [...(net.adj.get(s) || [])].every((q) => typeof q !== 'number' || ['he', 'junction'].includes(SHAPES[w.pipe[q] & 31].kind))), 'a heat exchanger pipe is joined to heat exchanger pipes, junctions and nothing else');
});

section('the gas in the pipes', () => {
  const [scrub, supply] = [...net.lines].sort((p, q) => q.slots.length - p.slots.length);
  ok(near(supply.air.pressure(), ONE_ATMOSPHERE, 0.01) && near(supply.air.g.o2 / supply.air.total(), 0.21, 0.001), 'the air supply starts charged: an atmosphere of air');
  ok(scrub.air.total() === 0, 'the scrubbers\' pipes start empty');
  // one reconcile shares gas out by volume
  const l = supply, before = lineMoles(l);
  net.reconcile(l);
  const p = l.air.pressure();
  ok(l.ports.every((q) => near(q.dev.airs[q.k].pressure(), p, 0.01)) && near(lineMoles(l), before, 1e-6), 'sharing it out makes every node the same pressure and loses none');
  const tank = byKind('Tank').find((d) => /\/air$/.test(d.path) || /tank\/air/.test(d.path));
  ok(near(tank.airs[0].pressure(), 25 * ONE_ATMOSPHERE, 0.5) && tank.airs[0].vol === 10000 && near(tank.airs[0].g.o2 / tank.airs[0].total(), 0.2, 0.01), 'a pressure tank of air is 10,000 litres at twenty-five atmospheres');
  // the gas chambers of the atmospherics room, and floors that start with no air
  const chamber = (c, r) => at.gasesAt(c, r);
  ok(chamber(130, 177).o2 > 90000 && chamber(126, 177).n2 > 90000 && chamber(140, 163).tox > 60000 && chamber(140, 167).co2 > 40000 && chamber(140, 159).n2o > 5000, 'the oxygen, nitrogen, plasma, carbon dioxide and nitrous oxide chambers are full of them');
  const air = chamber(134, 177);
  ok(near(air.o2 / (air.o2 + air.n2), 0.2, 0.01) && air.pressure > 10000, 'and the air chamber of air');
  ok(chamber(140, 155).pressure === 0 && chamber(62, 99).pressure === 0, 'a vacuum floor and an airless one start with nothing');
  const qm = g.atmosdev.alarms.find((al) => w.areas[al.area].n === "Quartermaster's Office");
  let sum = 0, cnt = 0;
  for (let i = 0; i < w.n; i++) if (at.isCell[i] && w.areaIdx[i] === qm.area) { sum += at.total(i); cnt++; }
  ok(near(sum / cnt, 101.3, 0.5), 'and ordinary floors with an atmosphere');
  ok(at.real && at.probes.size > 80, `the station's rooms have real vents and scrubbers (${at.probes.size} of them have), and so Atmos does not make stand-ins of them`);
  ok([...sim.grids.values()].filter((x) => x !== g).every((x) => !x.atmos.real), 'a shuttle, which has no pipes, keeps its stand-ins');
});

section('devices', () => {
  /** A pipeline with nothing on it that lets gas out into a room or takes it from one. */
  const shut = (l) => ![...l.devs].some((d) => ['VentPump', 'Scrubber', 'Injector', 'DPVent'].includes(kind(d)));
  /** Switch off whatever else works on these pipelines, so that what is measured is what the one machine does. */
  const quiet = (lines, keep) => { for (const l of lines) for (const d of l.devs) if (d !== keep && 'on' in d && !d.isValve) d.on = false; };
  // a pump on a short run
  const pump = byKind('Pump').find((d) => d.parents[0] && d.parents[1] && d.parents[0] !== d.parents[1] && d.parents.every((l) => l.slots.length > 4 && l.slots.length < 90 && shut(l)));
  const [A, B] = pump.parents;
  quiet([A, B], pump);
  const clear = (l) => { for (const id of GAS_IDS) l.air.g[id] = 0; for (const p of l.ports) p.dev.airs[p.k].clear(); };
  clear(A); clear(B);
  A.air.g.o2 = molesAt(600, A.air.vol); A.update = true; B.update = true;
  pump.on = true; pump.target = 250;
  const m0 = lineMoles(A) + lineMoles(B);
  cycles(240);
  const pb = B.air.pressure();
  ok(pb > 200 && pb < 260, `a gas pump moves gas until the pipe on its output is at its target (${pb.toFixed(0)} of 250 kPa)`);
  ok(near(lineMoles(A) + lineMoles(B), m0, m0 * 1e-9), 'and no gas is lost');
  pump.on = false; const mb = B.air.total();
  cycles(10);
  ok(near(B.air.total(), mb, 1e-6), 'off, it moves none');
  // a valve
  const valve = byKind('Valve').find((d) => d.parents[0] !== d.parents[1] && d.parents.every((l) => l.slots.length > 2 && l.slots.length < 200 && shut(l)) && !d.on && !d.digital);
  const [V1, V2] = valve.parents;
  clear(V1); clear(V2);
  V1.air.g.n2 = molesAt(400, V1.air.vol); V1.update = true;
  cycles(10);
  ok(V2.air.total() === 0, 'a shut valve is a break in the pipe');
  const vm = lineMoles(V1) + lineMoles(V2);
  valve.toggle();
  ok(valve.on && near(V1.air.pressure(), V2.air.pressure(), 0.01) && near(lineMoles(V1) + lineMoles(V2), vm, vm * 1e-9), 'opened, it makes the two pipes one pressure and loses no gas');
  ok(V1.air.pressure() < 400 && V1.air.pressure() > 0, `(${V1.air.pressure().toFixed(0)} kPa each)`);
  valve.toggle();
  cycles(4);
  ok(!valve.on, 'and shut again');
  // a filter
  const filter = byKind('Filter').find((d) => d.linked && d.parents.every((p) => p && p.slots.length > 1 && p.slots.length < 200 && shut(p)) && new Set(d.parents).size === 3);
  const [F1, F2, F3] = filter.parents;
  quiet([F1, F2, F3], filter);
  for (const l of [F1, F2, F3]) clear(l);
  F1.air.g.o2 = molesAt(200, F1.air.vol) * 0.5; F1.air.g.co2 = molesAt(200, F1.air.vol) * 0.5; F1.update = true;
  const fm = F1.air.total();
  filter.type = 'co2'; filter.on = true;
  cycles(200);
  ok(F2.air.g.co2 > 0 && F2.air.g.o2 === 0 && F3.air.g.o2 > 0, 'a filter set to carbon dioxide sends it one way and the rest the other');
  ok(near(lineMoles(F1) + lineMoles(F2) + lineMoles(F3), fm, fm * 1e-9), 'and loses none');
  filter.on = false;
  // a mixer
  const mixer = byKind('Mixer').find((d) => d.linked && new Set(d.parents).size === 3 && d.parents.every((p) => p.slots.length < 400 && shut(p)));
  const [M1, M2, M3] = mixer.parents;
  quiet([M1, M2, M3], mixer);
  for (const l of [M1, M2, M3]) clear(l);
  const vol = (l) => l.air.vol + l.ports.reduce((s, p) => s + p.dev.airs[p.k].vol, 0);              // (some of a mixer's lines are no more than the nodes of the machines that meet there)
  M1.air.g.o2 = molesAt(500, vol(M1)); M2.air.g.n2 = molesAt(500, vol(M2)); M1.update = M2.update = true;
  mixer.on = true; mixer.c1 = 0.25; mixer.target = 200;
  cycles(200);
  const o2 = [M3.air, ...M3.ports.map((p) => p.dev.airs[p.k])].reduce((s, m) => s + m.g.o2, 0), all = lineMoles(M3);
  ok(all > 0 && near(o2 / all, 0.25, 0.03), `a mixer set to a quarter from node 1 makes a quarter of its output so (${(o2 / all * 100).toFixed(1)}%)`);
  mixer.on = false;
});

section('vents, scrubbers and injectors', () => {
  const room = (c) => { const out = []; for (let i = 0; i < w.n; i++) if (at.isCell[i] && w.areaIdx[i] === w.areaIdx[c]) out.push(i); return out; };
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
  const vent = byKind('VentPump').find((d) => d.controlled && at.isCell[d.i] && d.parents[0].slots.length > 1000 && room(d.i).length < 30 && byKind('VentPump').filter((e) => e.area === d.area).length === 1 && sealed(d.area));
  const cells = room(vent.i);
  const moles = () => cells.reduce((s, i) => s + at.total(i), 0) * CELL_MOLES_PER_KPA;
  for (const i of cells) for (const arr of at.arrs) arr[i] = 0;
  vent.parents[0].update = true;
  const m0 = moles(), pipe0 = vent.parents[0].air.total();
  step(10);
  const got = moles() - m0;
  ok(got > 40 && got < 200, `an air vent lets the pipe's gas into an empty room (${got.toFixed(0)} moles in 10 s)`);
  ok(vent.parents[0].air.total() < pipe0, 'and the pipe has less');
  vent.out = false; vent.checks = 1; vent.ext = 0;
  for (const i of cells) { at.o2[i] = 50; }
  const room0 = moles();
  step(10);
  ok(moles() < room0 - 20, 'set to siphon, it takes the room\'s air into the pipe');
  vent.out = true; vent.ext = ONE_ATMOSPHERE;
  // power: no environment power, no vent
  g.power.powered = () => false;
  const L = vent.parents[0];
  step(3);
  const before = lineMoles(L);
  step(5);
  ok(near(lineMoles(L), before, before * 1e-9), 'a vent in a room with no power does nothing');
  delete g.power.powered;
  // a scrubber
  const sc = byKind('Scrubber').find((d) => d.controlled && at.isCell[d.i] && d.nodes[0] != null);
  at.addGases(sc.it.c, sc.it.r, { co2: 30, tox: 20 }, sc.it.l | 0);
  const co2 = at.co2[sc.i], tox = at.tox[sc.i], w0 = sc.parents[0].air.g.co2 + sc.airs[0].g.co2;
  sc.on = true; sc.process();
  ok(at.co2[sc.i] < co2 * 0.95 && near(at.tox[sc.i], tox, 1e-3) && sc.parents[0].air.g.co2 + sc.airs[0].g.co2 > w0, 'a scrubber takes carbon dioxide out of its tile into the pipe, and leaves plasma');
  const power = sc.load;
  ok(near(power, 20, 1e-9), 'and draws twenty watts of environment power (ten, and ten for the gas it filters)');
  sc.widenet = true; sc.process();
  ok(sc.load > 100, 'a wide one draws a great deal more');
  sc.widenet = false; sc.on = false; sc.process();
  ok(sc.load === 0, 'and none when it is off');
  // an injector
  const inj = byKind('Injector').find((d) => d.on && at.isCell[d.i]);
  inj.airs[0].g.n2 = molesAt(900, inj.airs[0].vol);
  const here0 = at.total(inj.i);
  inj.process();
  ok(at.total(inj.i) > here0 && inj.airs[0].g.n2 < molesAt(900, inj.airs[0].vol), 'an air injector puts the pipe\'s gas into the room');
  // meters
  const meter = byKind('Meter').find((d) => d.reading() > 90);
  ok(/^The pressure gauge reads \d+(\.\d+)? kPa; 293\.15 K \(20 °C\)\.$/.test(meter.examine()[0]) && meter.variant() >= 1, 'a gas flow meter reads its pipe');
});

section('the vents are the air alarms\'', () => {
  const room = g.atmosdev.alarms.find((al) => { const ds = net.devices.filter((d) => d.controlled && d.area === al.area); return ds.some((d) => d.isVent) && ds.some((d) => !d.isVent); });
  const ds = net.devices.filter((d) => d.controlled && d.area === room.area);
  room.setMode(AIR_MODE.OFF);
  ok(ds.every((d) => !d.on), 'Off turns the room\'s vents and scrubbers off');
  room.setMode(AIR_MODE.REFILL);
  ok(ds.filter((d) => d.isVent).every((d) => d.on && near(d.ext, 3 * ONE_ATMOSPHERE, 1e-9)), 'Refill turns the vents on at three atmospheres');
  room.setMode(AIR_MODE.SCRUBBING);
  ok(ds.filter((d) => d.isVent).every((d) => near(d.ext, ONE_ATMOSPHERE, 1e-9)), 'and Filtering back to one');
  const atmosVent = byKind('VentPump').find((d) => !d.controlled);
  ok(atmosVent && atmosVent.on, 'the atmospherics room\'s own vents are not on the alarms');
  // an alarm that is turned off in one room does not touch another
  const other = g.atmosdev.alarms.find((al) => al.area !== room.area);
  const od = net.devices.filter((d) => d.controlled && d.area === other.area);
  room.setMode(AIR_MODE.OFF);
  ok(od.every((d) => d.on === true || !d.welded), 'a room\'s alarm speaks only to that room');
  room.setMode(AIR_MODE.SCRUBBING);
});

section('what clients are told', () => {
  const late = [];
  const A = sim.addClient('Alice', (m) => late.push(m));
  const welcome = late.find((m) => m.t === 'welcome');
  const gs = welcome.grids.find((q) => q.g === g.id);
  const on = byKind('Pump').find((d) => d.on);
  ok(gs.pv.some(([i, v]) => i === on.it.idx && v === 1), 'a joiner is told which machines are not showing their first picture (a pump that starts on)');
  const rep = new Replica({ level: DATA.level, rects: DATA.rects }, { ...welcome, you: A.id });
  const rg = rep.grids.get(g.id);
  ok(rg.world.pipe.length === w.pipe.length && rg.world.pipe.every((b, i) => b === w.pipe[i]) && rg.world.pipeLy.every((b, i) => b === w.pipeLy[i]), 'the client has every pipe');
  ok(rg.props.interact[on.it.idx].pv === 1 && rg.props.interact[on.it.idx].flat === true, 'and the pump as a flat picture, on');
  const v = byKind('Valve').find((d) => !d.digital);
  late.length = 0;
  v.toggle();
  step(0.1);
  ok(late.filter((m) => m.t === 'ev').flatMap((m) => m.list).some((e) => e.e === 'pv' && e.i === v.it.idx && e.v === v.v), 'a valve turned is told to everyone');
  void A;
});

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
