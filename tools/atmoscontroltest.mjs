// The atmospherics monitoring computers and their gas sensors: node tools/atmoscontroltest.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSimData } from '../src/sim/load.js';
import { initPhysics } from '../src/shared/physics.js';
import { Sim } from '../src/sim/sim.js';
import { SIM_DT, TILE, KIND } from '../src/shared/config.js';

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
  sim.handle(A, { t: 'lobby', op: 'job', id: 'atmospheric_technician' });
  sim.handle(A, { t: 'lobby', op: 'ready', v: true });
  sim.handle(A, { t: 'lobby', op: 'start' });
  const step = (sec) => { for (let k = 0; k < sec / SIM_DT; k++) sim.step(SIM_DT); };
  const g = sim.station, a = A.mob, w = g.world, ac = sim.atmoscontrol;
  a.invulnerable = true;
  const term = () => last.term;
  const press = (label) => { let k = term().buttons.findIndex((b) => b.l === label); if (k < 0) k = term().buttons.findIndex((b) => b.l.startsWith(label)); sim.handle(A, { t: 'term', op: 'act', idx: k }); step(0.1); return k; };
  const consoles = (re) => g.props.interact.filter((it) => !it.gone && re.test((it.path || '').replace(/^\//, '')));
  const open = (it) => {
    for (const [dc, dr] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const c = it.c + dc, r = it.r + dr, i = w.idx(c, r);
      if (w.kind[i] !== KIND.FLOOR || w.solid[i] || w.doorAt.has(i)) continue;
      a.grid = g; a.x = (c + 0.5) * TILE; a.z = (r + 0.5) * TILE; a.l = 0; a.vx = a.vz = 0; a.cool = 0; a.stunned = 0;
      sim.handle(A, { t: 'click', target: { k: 'prop', g: g.id, idx: it.idx }, yaw: 0, pitch: 0 }); step(0.2);
      return true;
    }
    return false;
  };
  return { sim, A, a, g, w, ac, step, term, press, consoles, open };
}

section('which computer is which', () => {
  const { ac, consoles } = round();
  const all = consoles(/^machinery\/computer\/atmos_control/);
  ok(all.length === 11, 'the map has eleven (the central ones, seven tanks, the incinerator and the toxins mixing room)');
  ok(all.filter((it) => ac.kindOf(it.path)?.type === 'atmostank').length === 7, 'seven tank consoles');
  ok(ac.kindOf('machinery/computer/atmos_control')?.only === null && ac.kindOf('machinery/computer/atmos_control/incinerator').only[0] === 'incinerator_tank' && ac.kindOf('machinery/computer/atmos_control/toxinsmix').only[0] === 'toxins_mixing_tank', 'the central one lists them all, the others one each');
  ok(ac.kindOf('machinery/computer/monitor') === null && ac.kindOf('machinery/computer/atmos_alert') === null, 'and nothing else is one');
});

section('the sensors', () => {
  const { g, ac } = round();
  const keys = ['nitrogen_tank', 'oxygen_tank', 'carbon_tank', 'toxin_tank', 'nitrous_tank', 'air_tank', 'mix_tank', 'loop:distro_loop', 'loop:atmos_waste_loop', 'incinerator_tank', 'toxins_mixing_tank'];
  ok(keys.every((k) => ac.sensor(g, k)), 'every sensor and loop meter is on the map');
  const n2 = ac.read(g, 'nitrogen_tank'), o2 = ac.read(g, 'oxygen_tank'), air = ac.read(g, 'air_tank');
  ok(n2.pressure > 90000 && n2.shares.length === 1 && n2.shares[0][0] === 'Nitrogen' && Math.round(n2.shares[0][1]) === 100, 'the nitrogen tank: tens of thousands of kPa of nitrogen');
  ok(o2.shares[0][0] === 'Oxygen' && ac.read(g, 'carbon_tank').shares[0][0] === 'Carbon Dioxide' && ac.read(g, 'toxin_tank').shares[0][0] === 'Plasma' && ac.read(g, 'nitrous_tank').shares[0][0] === 'Nitrous Oxide', 'oxygen, carbon dioxide, plasma and nitrous oxide in theirs');
  ok(air.shares.length === 2 && Math.abs(air.shares[0][1] - 80) < 1 && Math.abs(air.shares[1][1] - 20) < 1, 'the air tank: 80% nitrogen and 20% oxygen');
  const loop = ac.read(g, 'loop:distro_loop');
  ok(loop && Math.abs(loop.pressure - 101.3) < 5 && loop.shares[0][0] === 'Nitrogen', 'the distribution loop: an atmosphere of air');
  ok(ac.read(g, 'mix_tank').pressure === 0 && ac.read(g, 'mix_tank').shares.length === 0, 'an empty tank reads nothing');
});

section('the central computer', () => {
  const { g, term, consoles, open } = round();
  const c = consoles(/^machinery\/computer\/atmos_control$/)[0];
  ok(open(c) && term()?.title === 'Atmospherics Monitoring', 'a click opens it');
  const html = term().html;
  ok(['Nitrogen Tank', 'Oxygen Tank', 'Carbon Dioxide Tank', 'Plasma Tank', 'Nitrous Oxide Tank', 'Mixed Air Tank', 'Mix Tank', 'Distribution Loop', 'Atmos Waste Loop', 'Incinerator Chamber', 'Toxins Mixing Chamber'].every((n) => html.includes(n)), 'it lists every sensor by name');
  ok(/Pressure\s+9\d{4}\.\d kPa/.test(html) && /Nitrogen\s+100\.0 %/.test(html) && !html.includes('no signal'), 'with pressures and shares');
  ok(term().buttons.length === 0 && term().live, 'a monitor: no controls, and it follows the readings');
  void g;
});

section('a tank console works the injector and the vent', () => {
  const { g, ac, step, term, press, consoles, open } = round();
  const c = consoles(/^machinery\/computer\/atmos_control\/tank\/nitrogen_tank$/)[0];
  ok(open(c) && term()?.title === 'Nitrogen Supply Control', 'the nitrogen console');
  const { input, output } = ac.io(g, 'nitrogen_tank');
  ok(!!input && !!output, 'it finds its injector and its vent');
  const in0 = input.on, out0 = output.on, rate0 = input.rate, int0 = output.int;
  ok(/Input\s+on\s+rate 200 L\/s/.test(term().html.replace(/<[^>]*>/g, '')), 'the screen says what they are doing');
  press('Input: turn');
  ok(input.on === !in0, 'a button toggles the injector');
  press('Input: turn');
  ok(input.on === in0, 'and back');
  press('Output: turn');
  ok(output.on === !out0, 'the vent too');
  press('Output: turn');
  press('Rate -10');
  ok(input.rate === rate0 - 10, 'the injector\'s rate goes down ten');
  press('Rate +100');
  ok(input.rate === Math.min(200, rate0 - 10 + 100), 'and up a hundred (to 200 at most)');
  press('Pressure -1000');
  ok(output.int === Math.max(0, int0 - 1000), 'the vent\'s internal bound goes down a thousand');
  for (let k = 0; k < 6; k++) press('Pressure +1000');
  ok(output.int === 4500, 'to 4500 at most');
  step(1);
  ok(term().html.includes('pressure 4500 kPa'), 'and the screen follows');
});

section('the others', () => {
  const { g, term, consoles, open } = round();
  const inc = consoles(/atmos_control\/incinerator$/)[0], tox = consoles(/atmos_control\/toxinsmix$/)[0];
  ok(open(inc) && term().title === 'Incinerator Air Control' && term().html.includes('Incinerator Chamber') && !term().html.includes('Nitrogen Tank'), 'the incinerator console shows its chamber only');
  ok(open(tox) && term().title === 'Toxins Mixing Air Control' && term().html.includes('Toxins Mixing Chamber'), 'and the toxins mixing room its own');
  void g;
});

section('the engineering console', () => {
  const { sim, g, term, press, consoles, open, step } = round();
  const c = consoles(/^machinery\/modular_computer\/console\/preset\/engineering$/)[0];
  ok(!!c && open(c) && term()?.title === 'Engineering Console', 'the engineering computer has a menu');
  ok(['Power Monitoring', 'Alarm Monitoring', 'Supermatter Monitoring'].every((l) => term().buttons.some((b) => b.l === l)), 'of three programs');
  press('Power Monitoring');
  ok(term().title === 'Power Monitor' && term().buttons.some((b) => b.l === 'Main menu'), 'the power monitor, with a way back');
  press('Main menu'); press('Alarm Monitoring');
  ok(term().title === 'Station Alerts', 'the alarms');
  press('Main menu'); press('Supermatter Monitoring');
  ok(term().title === 'Supermatter Monitoring' && /Chamber pressure/.test(term().html) && /Emitters\s+\d\/\d firing/.test(term().html) && /Collectors\s+\d\/\d on/.test(term().html), 'and the supermatter: the chamber, the emitters, the collectors');
  const sm = g.powersim.machines.supermatter[0];
  sm.power = 5000; step(1.1);
  ok(/Relative EER\s+\S+/.test(term().html), 'the power of the crystal');
  void sim;
});

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
