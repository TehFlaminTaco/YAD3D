import { GAS_IDS, GAS_NAME, ONE_ATMOSPHERE } from '../shared/gases.js';
import { esc } from '../shared/util.js';

const MAX_TRANSFER_RATE = 200, MAX_OUTPUT_PRESSURE = 4500;                         // atmospherics.dm
const norm = (p) => (p || '').replace(/^\/?(obj\/)?/, '');
const bar = (frac, n = 20) => '█'.repeat(Math.round(Math.max(0, Math.min(1, frac)) * n)) + '░'.repeat(n - Math.round(Math.max(0, Math.min(1, frac)) * n));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** The sensors in the gas tanks (`air_sensor/atmos/<name>`): what each reads, and its name on the central computer (atmos_control.dm sensors). */
const SENSORS = ['nitrogen_tank', 'oxygen_tank', 'carbon_tank', 'toxin_tank', 'nitrous_tank', 'air_tank', 'mix_tank', 'loop:distro_loop', 'loop:atmos_waste_loop', 'incinerator_tank', 'toxins_mixing_tank'];
const NAMES = {
  nitrogen_tank: 'Nitrogen Tank', oxygen_tank: 'Oxygen Tank', carbon_tank: 'Carbon Dioxide Tank', toxin_tank: 'Plasma Tank', nitrous_tank: 'Nitrous Oxide Tank', air_tank: 'Mixed Air Tank', mix_tank: 'Mix Tank',
  'loop:distro_loop': 'Distribution Loop', 'loop:atmos_waste_loop': 'Atmos Waste Loop', incinerator_tank: 'Incinerator Chamber', toxins_mixing_tank: 'Toxins Mixing Chamber',
};
/** The tank consoles (`computer/atmos_control/tank/<name>`): their title, the sensor, what they call the tank, and the names of the injector (`<io>_input`) and vent (`<io>_output`) they work. */
const TANKS = {
  oxygen_tank: { title: 'Oxygen Supply Control', sensor: 'oxygen_tank', label: 'Oxygen Tank', io: 'oxygen' },
  toxin_tank: { title: 'Plasma Supply Control', sensor: 'toxin_tank', label: 'Plasma Tank', io: 'toxin' },
  air_tank: { title: 'Mixed Air Supply Control', sensor: 'air_tank', label: 'Air Mix Tank', io: 'air' },
  mix_tank: { title: 'Gas Mix Tank Control', sensor: 'mix_tank', label: 'Gas Mix Tank', io: 'mix' },
  nitrous_tank: { title: 'Nitrous Oxide Supply Control', sensor: 'nitrous_tank', label: 'Nitrous Oxide Tank', io: 'nitrous' },
  nitrogen_tank: { title: 'Nitrogen Supply Control', sensor: 'nitrogen_tank', label: 'Nitrogen Tank', io: 'nitrogen' },
  carbon_tank: { title: 'Carbon Dioxide Supply Control', sensor: 'carbon_tank', label: 'Carbon Dioxide Tank', io: 'carbon' },
};

/**
 * The atmospherics monitoring computers (code/game/machinery/computer/atmos_control.dm) and the gas sensors they listen to. A sensor reads the air of the tile it stands on (a gas chamber's) or, for the
 * two loop meters, the pipeline under them: pressure and the share of each gas. The central computer lists all of them; the tank consoles show one and **control its injector and vent**
 * (on or off, the injector's rate, the vent's internal pressure bound); the incinerator and toxins-mixing consoles show their chamber's sensor.
 */
export class AtmosControl {
  constructor(sim) { this.sim = sim; }

  /** The computer kind and what it is for from the path of the computer prop: `{type: 'atmoscontrol' | 'atmostank', tank?, only?}`, or null if it is not one of these. */
  kindOf(path) {
    const p = norm(path);
    let m = p.match(/^machinery\/computer\/atmos_control\/tank\/(\w+)/);
    if (m && TANKS[m[1]]) return { type: 'atmostank', tank: m[1] };
    if (/^machinery\/computer\/atmos_control\/incinerator/.test(p)) return { type: 'atmoscontrol', only: ['incinerator_tank'], title: 'Incinerator Air Control' };
    if (/^machinery\/computer\/atmos_control\/toxinsmix/.test(p)) return { type: 'atmoscontrol', only: ['toxins_mixing_tank'], title: 'Toxins Mixing Air Control' };
    m = p.match(/^machinery\/computer\/atmos_control$/);
    return m ? { type: 'atmoscontrol', only: null, title: 'Atmospherics Monitoring' } : null;
  }

  /** The sensor `key` of grid `g`: the prop (air_sensor) or loop meter. */
  sensor(g, key) {
    const re = key.startsWith('loop:') ? new RegExp(`^machinery/meter/atmos/${key.slice(5)}$`) : new RegExp(`^machinery/air_sensor/atmos/${key}$`);
    return g.props.interact.find((it) => !it.gone && re.test(norm(it.path))) || null;
  }

  /** What a sensor reads: `{pressure, shares: [[gas name, percent]...]}`, or null if there is none (taken away). */
  read(g, key) {
    const it = this.sensor(g, key);
    if (!it) return null;
    let pressure = 0, parts = {};
    if (key.startsWith('loop:')) {
      const dev = it.mach, air = dev ? g.pipenet.airAt(dev.i, dev.pipeLayer()) : null;
      if (!air) return null;
      pressure = air.pressure();
      const tot = GAS_IDS.reduce((s, id) => s + air.g[id], 0);
      if (tot > 0) for (const id of GAS_IDS) parts[id] = air.g[id] / tot * 100;
    } else {
      const gas = g.atmos.gasesAt(it.c, it.r, it.l | 0);
      pressure = gas.pressure;
      const tot = GAS_IDS.reduce((s, id) => s + (gas[id] || 0), 0);
      if (tot > 0) for (const id of GAS_IDS) parts[id] = (gas[id] || 0) / tot * 100;
    }
    const shares = GAS_IDS.filter((id) => parts[id] > 0.05).sort((a, b) => parts[b] - parts[a]).map((id) => [GAS_NAME[id], parts[id]]);
    return { pressure, shares };
  }

  block(g, key, label) {
    const r = this.read(g, key);
    if (!r) return `<span class="h">${esc(label)}</span>\n  <span class="w">no signal</span>\n`;
    const rows = r.shares.map(([n, pct]) => `  ${esc(n).padEnd(16)} ${pct.toFixed(1).padStart(6)} %`).join('\n');
    return `<span class="h">${esc(label)}</span>\n  Pressure         ${r.pressure.toFixed(1).padStart(8)} kPa   Temperature  293.15 K\n${rows || '  (empty)'}\n`;
  }

  // ------------------------------------------------------------------ the consoles
  console(c, t) {
    const g = t.grid, kind = this.kindOf(t.ctx.path);
    if (!kind) return { title: 'Atmospherics', html: 'No signal.', buttons: [] };
    if (kind.type === 'atmostank') return this.tankConsole(g, kind.tank);
    const keys = kind.only || SENSORS;
    return {
      title: kind.title, live: true,
      html: `<span class="h">${esc(kind.title.toUpperCase())}</span>\n\n${keys.map((k) => this.block(g, k, NAMES[k])).join('\n')}`,
      buttons: [],
    };
  }

  /** The injector and the vent of a tank (the devices with `<io>_input` and `<io>_output` in their path). */
  io(g, tank) {
    const T = TANKS[tank], devs = g.pipenet.devices;
    const input = devs.find((d) => d.rate !== undefined && new RegExp(`atmos/${T.io}_input$`).test(norm(d.path)));
    const output = devs.find((d) => d.isVent && new RegExp(`atmos/${T.io}_output$`).test(norm(d.path)));
    return { input, output };
  }

  tankConsole(g, tank) {
    const T = TANKS[tank], { input, output } = this.io(g, tank), sim = this.sim;
    const onoff = (d) => (d ? (d.on ? '<span class="c">on</span>' : '<span class="w">off</span>') : '<span class="d">not connected</span>');
    const r = this.read(g, T.sensor), nudge = (get, set, lo, hi, steps) => [
      ...steps.map((s) => ({ label: `-${s}`, disabled: false, fn: () => set(clamp(Math.round(get() - s), lo, hi)) })),
      ...steps.slice().reverse().map((s) => ({ label: `+${s}`, disabled: false, fn: () => set(clamp(Math.round(get() + s), lo, hi)) })),
    ];
    const buttons = [];
    if (input) {
      buttons.push({ label: input.on ? 'Input: turn off' : 'Input: turn on', fn: () => { input.on = !input.on; input.touch(); } });
      buttons.push(...nudge(() => input.rate, (v) => { input.rate = v; }, 0, MAX_TRANSFER_RATE, [100, 10, 1]).map((b) => ({ ...b, label: `Rate ${b.label}` })));
    }
    if (output) {
      buttons.push({ label: output.on ? 'Output: turn off' : 'Output: turn on', fn: () => { output.on = !output.on; output.touch(); } });
      buttons.push(...nudge(() => output.int, (v) => { output.int = v; }, 0, MAX_OUTPUT_PRESSURE, [1000, 100, 10]).map((b) => ({ ...b, label: `Pressure ${b.label}` })));
    }
    void sim; void ONE_ATMOSPHERE;
    return {
      title: T.title, live: true,
      html: `<span class="h">${esc(T.title.toUpperCase())}</span>\n\n${this.block(g, T.sensor, T.label)}\n  Tank pressure   ${bar((r?.pressure ?? 0) / 100000)}\n\nInput    ${onoff(input)}${input ? `   rate ${Math.round(input.rate)} L/s` : ''}\nOutput   ${onoff(output)}${output ? `   pressure ${Math.round(output.int)} kPa` : ''}`,
      buttons,
    };
  }
}
