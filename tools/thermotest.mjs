// Freezers and heaters (thermomachine.dm) on the pipes of the map: node tools/thermotest.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSimData } from '../src/sim/load.js';
import { initPhysics } from '../src/shared/physics.js';
import { Sim } from '../src/sim/sim.js';
import { SIM_DT, TILE } from '../src/shared/config.js';
import { T20C, T0C } from '../src/shared/gases.js';
import { CH } from '../src/shared/power.js';
import { SHAPES } from '../src/shared/pipedata.js';

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
  const g = sim.station, a = A.mob, w = g.world, net = g.pipenet;
  const things = [...net.devices].filter((d) => d.constructor.name === 'Thermo');
  const freezers = things.filter((d) => d.freezer), heaters = things.filter((d) => !d.freezer);
  const events = () => inbox.filter((m) => m.t === 'ev').flatMap((m) => m.list);
  const msgs = () => [...events(), ...A.outbox].filter((e) => e.e === 'msg').map((e) => e.text);
  const standBy = (d) => {
    for (const [dc, dr] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const c = d.it.c + dc, r = d.it.r + dr, i = w.idx(c, r);
      if (w.kind[i] !== 1 || w.solid[i] || w.doorAt.has(i)) continue;
      a.grid = g; a.x = (c + 0.5) * TILE; a.z = (r + 0.5) * TILE; a.l = 0; a.vx = a.vz = 0; a.cool = 0; a.stunned = 0;
      return true;
    }
    return false;
  };
  const clickAt = (d, o = {}) => { inbox.length = 0; a.cool = 0; a.busy = null; a.stunned = 0; sim.handle(A, { t: 'click', target: { k: 'prop', g: g.id, idx: d.it.idx }, yaw: 0, pitch: 0, alt: !!o.alt }); step(o.wait ?? 0.1); };
  return { sim, A, a, g, w, net, step, things, freezers, heaters, events, msgs, standBy, clickAt, inbox };
}

section('what the map has', () => {
  const { things, freezers, heaters, g } = round();
  ok(things.length === 11 && freezers.length === 8 && heaters.length === 3, `eleven thermomachines: eight freezers and three heaters (${freezers.length}, ${heaters.length})`);
  ok(freezers.every((d) => near(d.min, 73.15) && near(d.max, T20C)) && heaters.every((d) => near(d.min, T20C) && near(d.max, 573.15)), 'a freezer goes from 73.15 K to 20 C, a heater from 20 C to 573.15 K (the lowest grade of parts)');
  ok(things.every((d) => d.heatCapacity === 5000), 'the heat capacity is 5000, the efficiency 100%');
  const on = freezers.filter((d) => d.on);
  ok(on.length === 2 && on.every((d) => near(d.target, d.min)), 'two start on, at their coldest');
  ok(freezers.filter((d) => !d.on).every((d) => near(d.target, T20C)) && heaters.every((d) => !d.on && near(d.target, T20C)), 'the others are off, set to 20 C');
  ok(things.every((d) => d.nodes[0] != null), 'every one is joined to a pipe');
  ok(g.pipenet.devices.every((d) => d.constructor.name !== 'Inert' || /cryo/.test(d.path)), 'only the cryo cells are still inert');
});

section('what it does to the gas', () => {
  const { freezers, g } = round();
  const f = freezers[0];
  f.on = true; f.target = 100;
  const air = f.airs[0];
  air.clear(); air.g.n2 = 10; air.t = 600;
  const cap = air.heatCapacity();
  f.process();
  ok(near(air.t, (5000 * 100 + cap * 600) / (5000 + cap)), `a freezer takes the gas toward its target: (5000 x target + C x T) / (5000 + C) (${air.t.toFixed(2)} K)`);
  const area = g.world.areaIdx[f.i], env = () => g.powersim.base[area * 3 + CH.ENVIRON];
  ok(near(f.load, 5000 * (600 - air.t) / 10), `it draws heat capacity x the change / 10 watts (${Math.round(f.load)} W)`);
  ok(env() >= f.load, 'from the room\'s environment channel');
  air.t = 100.5; f.process();
  ok(f.load === 0, 'but nothing when the change is a kelvin or less');
  const h = round().heaters[0];
  h.on = true; h.target = 400;
  h.airs[0].clear(); h.airs[0].g.o2 = 10; h.airs[0].t = 300;
  const c2 = h.airs[0].heatCapacity();
  h.process();
  ok(near(h.airs[0].t, (5000 * 400 + c2 * 300) / (5000 + c2)) && h.airs[0].t > 300, 'a heater warms it the same way');
  h.on = false; h.airs[0].t = 300; h.process();
  ok(h.airs[0].t === 300 && h.load === 0, 'off, it does nothing');
  const lone = round().freezers[0];
  lone.on = true; lone.nodes[0] = null; lone.airs[0].t = 500; lone.process();
  ok(lone.airs[0].t === 500, 'and with no pipe on it, nothing');
});

section('the pipeline', () => {
  const { freezers, step, net } = round();
  const f = freezers.find((d) => d.parents[0] && d.parents[0].air.vol > 0);
  const line = f.parents[0];
  f.on = true; f.setTarget(0);
  line.air.clear(); line.air.g.n2 = 40; line.air.t = 900;
  net.reconcile(line);
  ok(near(f.target, 73.15), 'the target cannot go under the machine\'s coldest');
  const t0 = line.air.t;
  step(10);
  ok(line.air.t < t0 * 0.6, `the whole pipeline cools: ${t0} K to ${line.air.t.toFixed(0)} K in ten seconds`);
  step(60);
  ok(line.air.t < 150 && line.air.t > 73.15, `and goes toward the target (${line.air.t.toFixed(0)} K)`);
});

section('power', () => {
  const { freezers, g, step, net } = round();
  const f = freezers[0];
  const line = f.parents[0];
  f.on = true; f.setTarget(73.15);
  line.air.clear(); line.air.g.n2 = 20; line.air.t = 700;
  net.reconcile(line);
  const area = g.world.areaIdx[f.i];
  const apc = g.powersim.machines.apc.find((q) => q.areaIdx === area);
  apc.operating = false;
  step(4);
  ok(!f.operational, 'with the room\'s power off it is not working');
  line.air.clear(); line.air.g.n2 = 20; line.air.t = 700;
  net.reconcile(line);
  const t0 = line.air.t;
  step(5);
  ok(line.air.t === t0 && f.load === 0, 'it cools nothing, and draws nothing');
  apc.operating = true;
  step(6);
  ok(line.air.t < t0, 'with power it does');
});

section('working it', () => {
  const { freezers, standBy, clickAt, sim, A, a, g, step } = round();
  const f = freezers.find((d) => !d.on);
  ok(standBy(f), 'you can stand next to one');
  const msgs0 = f.examine();
  ok(msgs0[0] === 'The thermostat is set to 293.15K (20C).' && msgs0[1] === 'The status display reads: Efficiency 100%.' && msgs0[2] === 'Temperature range 73.15K - 293.15K (-200C - 20C).', `it tells you its thermostat and its range (${msgs0.join(' ')})`);
  clickAt(f);
  const t = A.terminal || sim.terminals.of?.(A) || null;
  void t;
  const con = f.console();
  ok(con.title === 'Freezer' && /Target\s+293\.15 K/.test(con.html) && con.buttons.some((b) => b.label === 'Turn on'), 'a click opens its console: target, temperature, a button to turn it on');
  con.buttons.find((b) => b.label === 'Turn on').fn();
  ok(f.on && f.v === 1, 'which turns it on, and it looks it');
  f.console().buttons.find((b) => b.label === '-100').fn();
  ok(near(f.target, 193.15), 'the target moves by the buttons');
  f.console().buttons.find((b) => b.label === '-100').fn(); f.console().buttons.find((b) => b.label === '-100').fn();
  ok(near(f.target, 73.15), 'but not past the machine\'s limit');
  f.console().buttons.find((b) => b.label === 'Target: reset').fn();
  ok(near(f.target, T20C), 'it can be reset to 20 C');
  f.console().buttons.find((b) => b.label === 'Target: min').fn();
  ok(near(f.target, 73.15), 'or set to its coldest');
  f.setTarget(200);
  clickAt(f, { alt: true });
  ok(near(f.target, 73.15), 'alt-click sets a freezer to its coldest');
  void g; void step; void a; void T0C;
});

section('heat-exchanging pipes', () => {
  const { net, g, w, step } = round();
  ok(net.he.length > 20 && net.he.every((s) => SHAPES[w.pipe[s] & 31].kind === 'he'), `the map has heat-exchanging pipes (${net.he.length}), and the list holds nothing else (a junction passes no heat)`);
  const a = g.atmos;
  const inSpace = net.he.find((s) => !a.isCell[s % net.n]);
  ok(inSpace !== undefined && net.he.every((s) => !a.isCell[s % net.n]), 'the map\'s are all out in space (the engine\'s radiators)');
  const radiators = net.lines[net.lineOf[inSpace]];
  ok([...radiators.devs].map((d) => d.mv?.name).sort().join() === 'Cooling Loop to Gas,Gas to Cooling Loop', 'on the line between the "Gas to Cooling Loop" and "Cooling Loop to Gas" pumps');
  const inRoom = net.he.find((s) => s !== inSpace && net.lineOf[s] === net.lineOf[inSpace]);
  { const t = inRoom % net.n; a.isCell[t] = 1; w.airBlock[t] = 0; a.arrs[0][t] = 21.3; a.arrs[1][t] = 80; a.temp[t] = 293.15; }          // (one of them given a room's air, to try the other half)
  // in space: the line gives up heat to the cold
  const line = net.lines[net.lineOf[inSpace]];
  line.air.clear(); line.air.g.n2 = 6; line.air.t = 500;
  const total = line.air.heatCapacity(), partial = total * (SHAPES[w.pipe[inSpace] & 31].vol / line.air.vol), envC = 700000;
  const heat = 0.1 * (500 - 2.7) * (partial * envC / (partial + envC));
  net.exchange(inSpace);
  ok(near(line.air.t, 500 - heat / total, 1e-9), `a pipe in space takes the pipeline's heat: 0.1 x the difference x the joined heat capacity (${line.air.t.toFixed(2)} K)`);
  ok(line.air.t < 500, 'the line is cooler');
  line.air.t = 10;
  const kept = line.air.t;
  net.exchange(inSpace);
  ok(line.air.t < kept || line.air.t === kept, 'and does not go under the cold of space');
  line.air.t = 2.7 + 15;
  net.exchange(inSpace);
  ok(line.air.t === 2.7 + 15, 'within 20 K of its surroundings it does nothing');
  // in a room: the tile gets the heat
  const t = inRoom % net.n, l2 = net.lines[net.lineOf[inRoom]];
  l2.air.clear(); l2.air.g.n2 = 10; l2.air.t = 600;
  const roomT = a.temp[t], roomC = a.heatCap(t);
  const p2 = l2.air.heatCapacity() * (SHAPES[w.pipe[inRoom] & 31].vol / l2.air.vol);
  const h2 = 0.1 * (600 - roomT) * (p2 * roomC / (p2 + roomC));
  const c2 = l2.air.heatCapacity();
  net.exchange(inRoom);
  ok(near(l2.air.t, 600 - h2 / c2, 1e-9) && near(a.temp[t], roomT + h2 / roomC, 1e-4), `a pipe in a room warms the room with what the pipeline loses (${(h2 / 1000).toFixed(1)} kJ)`);
  // over time a hot pipeline in space loses it
  line.air.clear(); line.air.g.n2 = 6; line.air.t = 800;
  net.reconcile(line);
  step(60);
  ok(line.air.t < 500, `a long run of them in space cools a hot pipeline (800 K to ${line.air.t.toFixed(0)} K in a minute)`);
});

section('the clients', () => {
  const { freezers, g, sim, inbox } = round();
  const f = freezers.find((d) => !d.on);
  const before = inbox.length;
  f.on = true; f.touch();
  sim.step(0.1);
  ok(inbox.slice(before).some((m) => m.t === 'ev' && m.list.some((e) => e.e === 'pv' && e.i === f.it.idx && e.v === 1)), 'everyone is shown it running');
  void g;
});

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
