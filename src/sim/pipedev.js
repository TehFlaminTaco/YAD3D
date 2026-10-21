import { N, S, E, W, OPP } from '../shared/config.js';
import { Mix, GAS_IDS, GAS_NAME, ONE_ATMOSPHERE, CELL_VOLUME, molesAt, kpaOf, pumpGas, O2STANDARD, N2STANDARD, AIR_MODE } from '../shared/gases.js';
import { CH } from '../shared/power.js';
import { turnCW } from '../shared/pipedata.js';
import { esc } from '../shared/util.js';

const MAX_OUTPUT_PRESSURE = 4500, MAX_TRANSFER_RATE = 200;                    // atmospherics.dm
const EXT_BOUND = 1, INT_BOUND = 2;
const TANK_PRESSURE = 25 * ONE_ATMOSPHERE;                                     // unary/tank.dm AIR_CONTENTS: what a pressure tank starts with
const IDS = { plasma: 'tox', water_vapor: 'h2o' };                             // the DM's gas ids -> ours
const gasId = (s) => IDS[s] || s;
const BAD = ['co2', 'tox', 'h2o', 'n2o', 'bz'];                                // what a scrubber set to filter every foul gas takes out (airalarm.dm CONTAMINATED)
const bar = (frac, n = 20) => '█'.repeat(Math.round(Math.max(0, Math.min(1, frac)) * n)) + '░'.repeat(n - Math.round(Math.max(0, Math.min(1, frac)) * n));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * A pipe machine: it has one `Mix` (its own `airs`) and one port for every pipe end it has, and `process()` moves gas between them, the room it stands in, and the pipelines the ports are on.
 * Everything it does is the DM's `process_atmos` (code/modules/atmospherics/machinery/components/). Clicks, the console and the picture it shows are on the same pattern as every machine (`it.mach`).
 */
export class Device {
  constructor(net, it, path, vols) {
    this.net = net; this.sim = net.sim; this.grid = net.grid; this.it = it; this.path = path;
    this.ly = it.ly || 2;
    this.d = it.d || S;
    this.i = this.grid.world.idx(it.c, it.r, it.l | 0);
    this.name = it.name;
    this.on = false; this.v = 0; this.rev = 0;
    this.airs = vols.map((v) => new Mix(v));
    this.ports = vols.map((_, k) => ({ dev: this, k, link: null }));
    this.parents = [];
    this.nodes = [];
    this.mv = it.mv || {};
    this.load = 0;
  }

  nodeDirs() { return [this.d]; }
  get area() { return this.grid.world.areaIdx[this.i]; }
  /** Does it have power? (Everything here is on the environment channel; pipes, ports and tanks need none.) */
  get operational() { return this.noPower || this.grid.power.powered(this.area, this.channel ?? CH.ENVIRON); }
  get linked() { return this.nodes.every((n) => n !== null && n !== undefined); }
  updateParents() { for (const p of this.parents) if (p) p.update = true; }
  /** The air of the room it stands in as something that can be taken from and given to (null where there is none). */
  room() { const a = this.grid.atmos, i = this.i; return a.isCell[i] && !this.grid.world.airBlock[i] ? a.cell(i) : null; }

  variant() { return 0; }
  start() { this.v = this.variant(); }
  touch() {
    this.rev++;
    const v = this.variant();
    if (v === this.v) return;
    this.v = v;
    this.grid.emit({ e: 'pv', i: this.it.idx, v });
  }

  /** What it draws from its room's environment power while it runs (watts). */
  setLoad(w) {
    const ps = this.grid.powersim;
    if (!ps?.base || w === this.load) return;
    ps.base[this.area * 3 + CH.ENVIRON] += w - this.load;
    this.load = w;
  }

  process() {}
  examine() { return []; }
  click() { return false; }
  console() { return null; }

  /** Why a wrench cannot take it off its pipe, if it cannot (the DM's `can_unwrench` overrides): one that is running, or a connector with a machine on it. */
  unwrenchRefusal() {
    const the = `the ${this.name}`;
    if (this.isConnector && this.device) return `You cannot unwrench ${the}, detach ${this.device.name ? `the ${this.device.name}` : 'it'} first!`;
    if (!this.isConnector && !this.isValve && this.on && this.operational) return `You cannot unwrench ${the}, turn it off first!`;
    return null;
  }

  /** What its gas does when it is taken away: it goes out into the room. */
  release() { for (const mix of this.airs) this.net.spill(this.i, mix); }
}

/** A row of console buttons that nudge a number: -100 -10 -1 +1 +10 +100. */
const nudges = (get, set, lo, hi, steps = [100, 10, 1]) => [
  ...steps.map((s) => ({ label: `-${s}`, fn: () => set(clamp(Math.round(get() - s), lo, hi)) })),
  ...steps.slice().reverse().map((s) => ({ label: `+${s}`, fn: () => set(clamp(Math.round(get() + s), lo, hi)) })),
];
const onOff = (on) => (on ? '<span class="c">On</span>' : '<span class="w">Off</span>');

/** The air vent (vent_pump.dm): lets gas out of the pipe into the room, or takes the room's into the pipe, up to a pressure. An air alarm sets it. */
class VentPump extends Device {
  constructor(net, it, path, rest) {
    super(net, it, path, [rest.includes('high_volume') ? 1000 : 200]);
    const siphon = rest.includes('siphon'), big = rest.includes('high_volume');
    this.on = rest.includes('on') || rest.includes('atmos');
    this.out = !siphon;                                                                    // pump_direction RELEASING
    this.checks = this.mv.pressure_checks ?? (siphon ? INT_BOUND : EXT_BOUND);
    this.ext = this.mv.external_pressure_bound ?? (siphon ? 0 : ONE_ATMOSPHERE);
    this.int = siphon ? (big ? 2000 : 4000) : 0;
    this.welded = false;
    this.isVent = true;
    this.controlled = !rest.includes('atmos');                                             // (the atmospherics room's own vents are not on the air alarms' frequency)
    if (big) this.channel = CH.EQUIP;
    this.name = this.name || (big ? 'large air vent' : 'air vent');
  }

  variant() {
    if (this.welded) return 4;
    const run = this.nodes[0] != null && this.on && this.operational;
    return (this.out ? 0 : 2) + (run ? 1 : 0);
  }

  process() {
    if (!this.operational) return;
    if (this.nodes[0] == null) this.on = false;
    if (!this.on || this.welded) return;
    const air = this.airs[0], env = this.room();
    if (!env) return;
    const envP = env.pressure();
    if (this.out) {
      let delta = 10000;
      if (this.checks & EXT_BOUND) delta = Math.min(delta, this.ext - envP);
      if (this.checks & INT_BOUND) delta = Math.min(delta, air.pressure() - this.int);
      if (delta > 0) env.merge(air.remove(molesAt(delta, CELL_VOLUME)));
    } else {
      let delta = 10000;
      if (this.checks & EXT_BOUND) delta = Math.min(delta, envP - this.ext);
      if (this.checks & INT_BOUND) delta = Math.min(delta, this.int - air.pressure());
      if (delta > 0) air.merge(env.remove(molesAt(delta, air.vol)));
    }
    this.updateParents();
  }

  /** What the room's air alarm tells it (airalarm.dm apply_mode). */
  applyMode(mode) {
    const M = AIR_MODE;
    switch (mode) {
      case M.SCRUBBING: case M.CONTAMINATED: this.on = true; this.checks = EXT_BOUND; this.ext = ONE_ATMOSPHERE; break;
      case M.VENTING: this.on = true; this.checks = EXT_BOUND; this.ext = ONE_ATMOSPHERE * 2; break;
      case M.REFILL: this.on = true; this.checks = EXT_BOUND; this.ext = ONE_ATMOSPHERE * 3; break;
      case M.FLOOD: this.on = true; this.checks = INT_BOUND; this.int = 0; break;
      default: this.on = false;                                                         // Panic Siphon, Cycle, Siphon, Off
    }
  }

  examine() { return this.welded ? ['It seems welded shut.'] : []; }

  click(c, m, held) {
    if (held) return false;
    this.sim.terminals.open(c, 'portable', { machine: this, grid: this.grid, name: this.name });
    return true;
  }

  console() {
    const press = (key, label, lo, hi) => [
      { label: `${label}: min`, fn: () => { this[key] = lo; } },
      ...nudges(() => this[key], (v) => { this[key] = v; }, lo, hi),
      { label: `${label}: max`, fn: () => { this[key] = hi; } },
    ];
    return {
      title: 'Air Vent', live: true,
      html: `<span class="h">${esc(this.name)}</span>\n\nPower             ${onOff(this.on)}${this.operational ? '' : '  <span class="b">(no power)</span>'}${this.welded ? '  <span class="w">welded shut</span>' : ''}\nMode              ${this.out ? 'Releasing' : 'Siphoning'}\nPressure checks   ${(this.checks & EXT_BOUND ? 'External ' : '') + (this.checks & INT_BOUND ? 'Internal' : '') || 'None'}\nExternal bound    ${Math.round(this.ext)} kPa\nInternal bound    ${Math.round(this.int)} kPa\nPipe pressure     ${Math.round(this.airs[0].pressure())} kPa`,
      buttons: [
        { label: this.on ? 'Turn off' : 'Turn on', fn: () => { this.on = !this.on; this.touch(); } },
        { label: this.out ? 'Siphon' : 'Release', fn: () => { this.out = !this.out; this.touch(); } },
        { label: 'External check', fn: () => { this.checks ^= EXT_BOUND; } },
        { label: 'Internal check', fn: () => { this.checks ^= INT_BOUND; } },
        ...press('ext', 'External', 0, ONE_ATMOSPHERE * 50),
        ...press('int', 'Internal', 0, ONE_ATMOSPHERE * 50),
      ],
    };
  }
}

/** The air scrubber (vent_scrubber.dm): takes the gases it filters out of its room's air into the pipe; or siphons everything. Wide, it works on the tiles round it too. */
class Scrubber extends Device {
  constructor(net, it, path, rest) {
    super(net, it, path, [200]);
    this.on = rest.includes('on');
    this.scrubbing = true;
    this.filters = new Set(['co2']);
    this.rate = 200;
    this.widenet = false;
    this.welded = false;
    this.controlled = true;
    this.name = this.name || 'air scrubber';
  }

  variant() {
    if (this.welded) return 4;
    if (this.nodes[0] == null || !this.on || !this.operational) return 0;
    return this.scrubbing ? (this.widenet ? 2 : 1) : 3;
  }

  /** The tiles round it that its air can reach (GetAtmosAdjacentTurfs with alldir: the four beside it, and a corner when both its sides are open). */
  adjacent() {
    const w = this.grid.world, a = this.grid.atmos, it = this.it, l = it.l | 0, out = [];
    const open = (c, r) => w.inb(c, r, l) && a.isCell[w.idx(c, r, l)] && !w.airBlock[w.idx(c, r, l)];
    for (const [dc, dr] of [[0, -1], [0, 1], [1, 0], [-1, 0]]) if (open(it.c + dc, it.r + dr)) out.push(w.idx(it.c + dc, it.r + dr, l));
    for (const [dc, dr] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) if (open(it.c + dc, it.r + dr) && open(it.c + dc, it.r) && open(it.c, it.r + dr)) out.push(w.idx(it.c + dc, it.r + dr, l));
    return out;
  }

  scrub(env) {
    const air = this.airs[0];
    if (air.pressure() >= 50 * ONE_ATMOSPHERE) return;
    if (this.scrubbing) {
      let any = false;
      for (const id of this.filters) if (env.pp(id) > 0) { any = true; break; }
      if (any) {
        const removed = env.remove(Math.min(1, this.rate / env.vol) * env.total());
        air.merge(removed.removeGases([...this.filters]));
        env.merge(removed);
      }
    } else air.merge(env.remove(env.total() * (this.rate / env.vol)));
    this.updateParents();
  }

  process() {
    const power = this.operational && !this.welded && this.on && this.nodes[0] != null;
    this.drawPower(power);
    if (this.welded || !this.operational) return;
    if (this.nodes[0] == null || !this.on) { this.on = false; return; }
    const here = this.room();
    if (here) this.scrub(here);
    if (this.widenet) { const a = this.grid.atmos; for (const i of this.adjacent()) this.scrub(a.cell(i)); }
  }

  /** What the room's air alarm tells it (airalarm.dm apply_mode). */
  applyMode(mode) {
    const M = AIR_MODE;
    switch (mode) {
      case M.SCRUBBING: case M.REFILL: this.on = true; this.filters = new Set(['co2']); this.scrubbing = true; this.widenet = false; break;
      case M.CONTAMINATED: this.on = true; this.filters = new Set(BAD); this.scrubbing = true; this.widenet = true; break;
      case M.PANIC: case M.REPLACEMENT: this.on = true; this.widenet = true; this.scrubbing = false; break;
      case M.VENTING: case M.SIPHON: this.on = true; this.widenet = false; this.scrubbing = false; break;
      default: this.on = false;                                                         // Off, Flood
    }
  }

  /** auto_use_power: ten watts and ten for each gas it filters (sixty siphoning), many times that when it works the tiles round it too. */
  drawPower(on) {
    if (!on) { this.setLoad(0); return; }
    let amount = this.scrubbing ? 10 + 10 * this.filters.size : 60;
    if (this.widenet) { const n = this.adjacent().length; amount += amount * (n * (n / 2)); }
    this.setLoad(amount);
  }

  examine() { return this.welded ? ['It seems welded shut.'] : []; }

  click(c, m, held) {
    if (held) return false;
    this.sim.terminals.open(c, 'portable', { machine: this, grid: this.grid, name: this.name });
    return true;
  }

  console() {
    return {
      title: 'Air Scrubber', live: true,
      html: `<span class="h">${esc(this.name)}</span>\n\nPower             ${onOff(this.on)}${this.operational ? '' : '  <span class="b">(no power)</span>'}${this.welded ? '  <span class="w">welded shut</span>' : ''}\nMode              ${this.scrubbing ? 'Scrubbing' : 'Siphoning'}${this.widenet ? '  (wide)' : ''}\nPipe pressure     ${Math.round(this.airs[0].pressure())} kPa\nFilters           <span class="d">${[...this.filters].map((id) => GAS_NAME[id]).join(', ') || 'none'}</span>`,
      buttons: [
        { label: this.on ? 'Turn off' : 'Turn on', fn: () => { this.on = !this.on; this.touch(); } },
        { label: this.scrubbing ? 'Siphon' : 'Scrub', fn: () => { this.scrubbing = !this.scrubbing; this.touch(); } },
        { label: this.widenet ? 'Narrow' : 'Widen', fn: () => { this.widenet = !this.widenet; this.touch(); } },
        ...GAS_IDS.map((id) => ({ label: `${this.filters.has(id) ? '[x]' : '[ ]'} ${GAS_NAME[id]}`, fn: () => { if (this.filters.has(id)) this.filters.delete(id); else this.filters.add(id); } })),
      ],
    };
  }
}

/** The connector port (portables_connector.dm): a canister, a pump or a scrubber wrenched onto it shares its gas with the pipe. */
class Connector extends Device {
  constructor(net, it, path) {
    super(net, it, path, [0]);
    this.noPower = true;
    this.isConnector = true;
    this.device = null;                                                                    // the portable machine fastened to it
    this.name = this.name || 'connector port';
  }
  process() { if (this.device) this.updateParents(); }
}

/** The air injector (outlet_injector.dm): lets the pipe's gas into the room at a rate in litres a second. */
class Injector extends Device {
  constructor(net, it, path, rest) {
    super(net, it, path, [200]);
    this.on = rest.includes('on') || rest.includes('atmos');
    this.rate = this.mv.volume_rate ?? (rest.includes('atmos') ? 200 : 50);
    this.name = this.name || 'air injector';
  }
  variant() { return this.nodes[0] != null && this.on && this.operational ? 1 : 0; }
  process() {
    if (!this.on || !this.operational) return;
    const air = this.airs[0], env = this.room();
    if (!env) return;
    env.merge(air.remove(molesAt(air.pressure(), this.rate)));
    this.updateParents();
  }
  click(c, m, held) {
    if (held) return false;
    this.sim.terminals.open(c, 'portable', { machine: this, grid: this.grid, name: this.name });
    return true;
  }
  console() {
    return {
      title: 'Air Injector', live: true,
      html: `<span class="h">${esc(this.name)}</span>\n\nPower             ${onOff(this.on)}\nTransfer rate     ${Math.round(this.rate)} L/s  <span class="d">(0 to ${MAX_TRANSFER_RATE})</span>\nPipe pressure     ${Math.round(this.airs[0].pressure())} kPa`,
      buttons: [
        { label: this.on ? 'Turn off' : 'Turn on', fn: () => { this.on = !this.on; this.touch(); } },
        ...nudges(() => this.rate, (v) => { this.rate = v; }, 0, MAX_TRANSFER_RATE),
        { label: 'Rate: max', fn: () => { this.rate = MAX_TRANSFER_RATE; } },
      ],
    };
  }
}

/** The pressure tank (unary/tank.dm): 10,000 litres of one gas at 25 atmospheres, on a pipe. */
class Tank extends Device {
  constructor(net, it, path, rest) {
    super(net, it, path, [10000]);
    this.noPower = true;
    const kind = rest[0] || '';
    const mix = { air: { o2: O2STANDARD, n2: N2STANDARD }, toxins: { tox: 1 }, oxygen: { o2: 1 }, nitrogen: { n2: 1 }, carbon_dioxide: { co2: 1 } }[kind];
    if (mix) { const total = molesAt(TANK_PRESSURE, 10000); for (const [id, share] of Object.entries(mix)) this.airs[0].g[id] = total * share; }
    this.name = this.name || 'pressure tank';
  }
  examine() { return [`The pressure gauge reads ${Math.round(this.airs[0].pressure())} kPa.`]; }
}

/** A machine that sits on a pipe and does nothing here (a thermomachine and a cryo cell need temperature, which the game has not): its node is joined to the network all the same. */
class Inert extends Device {
  constructor(net, it, path, rest) {
    super(net, it, path, [200]);
    this.noPower = true;
  }
}

/** The gas pump (binary/pump.dm): moves gas from its input node to its output until the output is at its target pressure. */
class Pump extends Device {
  constructor(net, it, path, rest) {
    super(net, it, path, [200, 200]);
    this.on = rest.includes('on');
    this.target = this.mv.target_pressure ?? ONE_ATMOSPHERE;
    this.name = this.name || 'gas pump';
  }
  nodeDirs() { return [OPP[this.d], this.d]; }
  variant() { return this.on && this.operational ? 1 : 0; }
  process() {
    if (!this.on || !this.operational) return;
    if (pumpGas(this.airs[0], this.airs[1], this.target)) this.updateParents();
  }
  click(c, m, held) {
    if (held) return false;
    this.sim.terminals.open(c, 'portable', { machine: this, grid: this.grid, name: this.name });
    return true;
  }
  console() {
    return {
      title: 'Gas Pump', live: true,
      html: `<span class="h">${esc(this.name)}</span>\n\nPower             ${onOff(this.on)}${this.operational ? '' : '  <span class="b">(no power)</span>'}\nTarget pressure   ${Math.round(this.target)} kPa  <span class="d">(0 to ${MAX_OUTPUT_PRESSURE})</span>\nInput             ${Math.round(this.airs[0].pressure())} kPa\nOutput            ${Math.round(this.airs[1].pressure())} kPa  ${bar(this.airs[1].pressure() / MAX_OUTPUT_PRESSURE)}`,
      buttons: [
        { label: this.on ? 'Turn off' : 'Turn on', fn: () => { this.on = !this.on; this.touch(); } },
        ...nudges(() => this.target, (v) => { this.target = v; }, 0, MAX_OUTPUT_PRESSURE, [1000, 100, 10, 1]),
        { label: 'Target: max', fn: () => { this.target = MAX_OUTPUT_PRESSURE; } },
        { label: 'Target: reset', fn: () => { this.target = ONE_ATMOSPHERE; } },
      ],
    };
  }
}

/** The manual and digital valve (binary/valve.dm): open, it makes the two pipelines it joins one; shut, it is a break in the pipe. It takes a second to turn. */
class Valve extends Device {
  constructor(net, it, path, rest) {
    super(net, it, path, [200, 200]);
    this.noPower = !rest.includes('digital');
    this.digital = rest.includes('digital');
    this.on = rest.includes('on');
    this.isValve = true;
    this.d = { [S]: N, [W]: E }[this.d] ?? this.d;                                           // (PIPING_CARDINAL_AUTONORMALIZE)
    this.switching = false;
    this.name = this.name || (this.digital ? 'digital valve' : 'manual valve');
  }
  nodeDirs() { return [OPP[this.d], this.d]; }
  variant() { return this.digital && !this.operational ? 2 : this.on ? 1 : 0; }

  toggle() {
    if (this.on) { this.on = false; this.touch(); return; }
    this.on = true;
    this.touch();
    this.updateParents();
    if (this.parents[0]) this.net.reconcile(this.parents[0]);
  }

  click(c, m, held) {
    if (held) return false;
    if (this.digital && !this.operational) { this.sim.tell(m, 'warning', 'The valve has no power.'); return true; }
    if (this.switching) return true;
    this.switching = true;
    this.sim.sound('beep', { grid: this.grid, x: this.it.x, z: this.it.z, l: this.it.l | 0 }, 0.4);
    this.net.later(1, () => { this.switching = false; this.toggle(); });
    return true;
  }
}

/** The dual-port air vent (binary/dp_vent_pump.dm): a vent with an input and an output. */
class DPVent extends Device {
  constructor(net, it, path, rest) {
    super(net, it, path, rest.includes('high_volume') ? [1000, 1000] : [200, 200]);
    this.on = rest.includes('on');
    this.out = true;
    this.ext = ONE_ATMOSPHERE; this.inMin = 0; this.outMax = 0; this.checks = EXT_BOUND;
    this.name = this.name || (rest.includes('high_volume') ? 'large dual-port air vent' : 'dual-port air vent');
  }
  nodeDirs() { return [OPP[this.d], this.d]; }
  variant() { return !this.on || !this.operational ? 0 : this.out ? 1 : 2; }
  process() {
    if (!this.on) return;
    const [a1, a2] = this.airs, env = this.room();
    if (!env) return;
    if (this.out) {                                                                         // input -> room
      let delta = 10000;
      if (this.checks & 1) delta = Math.min(delta, this.ext - env.pressure());
      if (this.checks & 2) delta = Math.min(delta, a1.pressure() - this.inMin);
      if (delta > 0 && a1.total() > 0) { env.merge(a1.remove(molesAt(delta, CELL_VOLUME))); if (this.parents[0]) this.parents[0].update = true; }
    } else {                                                                                // room -> output
      let delta = 10000;
      if (this.checks & 1) delta = Math.min(delta, env.pressure() - this.ext);
      if (this.checks & 2) delta = Math.min(delta, this.outMax - a2.pressure());
      if (delta > 0) { a2.merge(env.remove(molesAt(delta, a2.vol))); if (this.parents[1]) this.parents[1].update = true; }
    }
  }
}

/** The gas filter (trinary/filter.dm): takes a share of what comes in at node 1, sends the gas it filters out of it to node 2 and the rest to node 3. */
class Filter extends Device {
  constructor(net, it, path, rest) {
    super(net, it, path, [200, 200, 200]);
    this.on = rest.includes('on') || rest.includes('atmos');
    this.flipped = rest.includes('flipped');
    this.rate = MAX_TRANSFER_RATE;
    const last = rest[rest.length - 1];
    this.type = gasId(this.mv.filter_type ?? (rest.includes('atmos') && GAS_IDS.includes(gasId(last)) ? gasId(last) : null)) || null;
    this.name = this.name || 'gas filter';
  }
  nodeDirs() { const a = [OPP[this.d], turnCW(this.d), this.d]; return this.flipped ? [a[2], a[1], a[0]] : a; }
  variant() { return this.on && this.linked && this.operational ? 1 : 0; }
  process() {
    if (!this.on || !this.linked || !this.operational) return;
    const [a1, a2, a3] = this.airs;
    if (a3.pressure() >= MAX_OUTPUT_PRESSURE) return;
    const ratio = this.rate / a1.vol;
    if (ratio <= 0 || a1.total() <= 0) return;
    const removed = a1.remove(a1.total() * Math.min(1, ratio));
    if (this.type && removed.g[this.type] > 0) {
      const filtered = removed.removeGases([this.type]);
      (a2.pressure() < MAX_OUTPUT_PRESSURE ? a2 : a1).merge(filtered);
    }
    a3.merge(removed);
    this.updateParents();
  }
  click(c, m, held) {
    if (held) return false;
    this.sim.terminals.open(c, 'portable', { machine: this, grid: this.grid, name: this.name });
    return true;
  }
  console() {
    return {
      title: 'Gas Filter', live: true,
      html: `<span class="h">${esc(this.name)}</span>\n\nPower             ${onOff(this.on)}${this.operational ? '' : '  <span class="b">(no power)</span>'}\nTransfer rate     ${Math.round(this.rate)} L/s  <span class="d">(0 to ${MAX_TRANSFER_RATE})</span>\nFiltering         ${this.type ? GAS_NAME[this.type] : '<span class="d">nothing</span>'}`,
      buttons: [
        { label: this.on ? 'Turn off' : 'Turn on', fn: () => { this.on = !this.on; this.touch(); } },
        ...nudges(() => this.rate, (v) => { this.rate = v; }, 0, MAX_TRANSFER_RATE),
        { label: 'Rate: max', fn: () => { this.rate = MAX_TRANSFER_RATE; } },
        { label: `${this.type ? '[ ]' : '[x]'} Nothing`, fn: () => { this.type = null; } },
        ...GAS_IDS.map((id) => ({ label: `${this.type === id ? '[x]' : '[ ]'} ${GAS_NAME[id]}`, fn: () => { this.type = id; } })),
      ],
    };
  }
}

/** The gas mixer (trinary/mixer.dm): takes gas from nodes 1 and 2 in the shares it is set to and puts the mixture out of node 3, up to a pressure. */
class Mixer extends Device {
  constructor(net, it, path, rest) {
    super(net, it, path, [200, 200, 300]);
    const air = rest.includes('airmix'), inv = rest.includes('inverse');
    this.on = rest.includes('on') || air;
    this.flipped = rest.includes('flipped');
    this.target = air ? MAX_OUTPUT_PRESSURE : ONE_ATMOSPHERE;
    this.c1 = air ? (inv ? O2STANDARD : N2STANDARD) : 0.5;
    this.name = this.name || (air ? 'air mixer' : 'gas mixer');
  }
  get c2() { return 1 - this.c1; }
  nodeDirs() { const a = [OPP[this.d], turnCW(this.d), this.d]; return this.flipped ? [a[2], a[1], a[0]] : a; }
  variant() { return this.on && this.linked && this.operational ? 1 : 0; }
  process() {
    if (!this.on || (!this.linked && !this.operational)) return;
    const [a1, a2, out] = this.airs;
    if (out.pressure() >= this.target) return;
    const general = molesAt(this.target - out.pressure(), out.vol);
    let t1 = this.c1 * general, t2 = this.c2 * general;
    const m1 = a1.total(), m2 = a2.total();
    if (!this.c2) { t1 = Math.min(t1, m1); t2 = 0; }
    else if (!this.c1) { t2 = Math.min(t2, m2); t1 = 0; }
    else {
      if (t2 <= 0 || t1 <= 0) return;
      if (m1 < t1 || m2 < t2) { const k = Math.min(m1 / t1, m2 / t2); t1 *= k; t2 *= k; }
    }
    if (t1) { out.merge(a1.remove(t1)); if (this.parents[0]) this.parents[0].update = true; }
    if (t2) { out.merge(a2.remove(t2)); if (this.parents[1]) this.parents[1].update = true; }
    if (this.parents[2]) this.parents[2].update = true;
  }
  click(c, m, held) {
    if (held) return false;
    this.sim.terminals.open(c, 'portable', { machine: this, grid: this.grid, name: this.name });
    return true;
  }
  console() {
    const pct = (v) => Math.round(v * 100);
    return {
      title: 'Gas Mixer', live: true,
      html: `<span class="h">${esc(this.name)}</span>\n\nPower             ${onOff(this.on)}${this.operational ? '' : '  <span class="b">(no power)</span>'}\nTarget pressure   ${Math.round(this.target)} kPa  <span class="d">(0 to ${MAX_OUTPUT_PRESSURE})</span>\nNode 1            ${pct(this.c1)} %\nNode 2            ${pct(this.c2)} %\nOutput            ${Math.round(this.airs[2].pressure())} kPa`,
      buttons: [
        { label: this.on ? 'Turn off' : 'Turn on', fn: () => { this.on = !this.on; this.touch(); } },
        ...nudges(() => this.target, (v) => { this.target = v; }, 0, MAX_OUTPUT_PRESSURE, [1000, 100, 10, 1]),
        { label: 'Target: max', fn: () => { this.target = MAX_OUTPUT_PRESSURE; } },
        { label: 'Node 1: -10', fn: () => { this.c1 = clamp(Math.round(this.c1 * 100 - 10) / 100, 0, 1); } },
        { label: 'Node 1: +10', fn: () => { this.c1 = clamp(Math.round(this.c1 * 100 + 10) / 100, 0, 1); } },
        { label: 'Node 1: -1', fn: () => { this.c1 = clamp(Math.round(this.c1 * 100 - 1) / 100, 0, 1); } },
        { label: 'Node 1: +1', fn: () => { this.c1 = clamp(Math.round(this.c1 * 100 + 1) / 100, 0, 1); } },
      ],
    };
  }
}

/** The gas flow meter (meter.dm): reads the pressure of the pipe it is on. Its picture is the gauge's. */
class Meter extends Device {
  constructor(net, it, path) {
    super(net, it, path, []);
    this.channel = CH.ENVIRON;
    this.name = this.name || 'gas flow meter';
  }
  nodeDirs() { return []; }
  /** Which of the pipes on its tile it reads: the one on its layer, else any. */
  pipeLayer() {
    for (const ly of [this.ly, 2, 1, 3]) if (this.net.slotAt(this.i, ly) >= 0) return ly;
    return 0;
  }
  reading() { const ly = this.pipeLayer(), air = ly ? this.net.airAt(this.i, ly) : null; return air ? air.pressure() : null; }
  variant() {
    const p = this.operational ? this.reading() : null;
    if (p === null || p <= 0.15 * ONE_ATMOSPHERE) return 0;
    const atm = ONE_ATMOSPHERE, r = (x) => Math.round(x);
    if (p <= 1.8 * atm) return clamp(r(p / (atm * 0.3) + 0.5), 1, 6);
    if (p <= 30 * atm) return 6 + clamp(r(p / (atm * 5) - 0.35) + 1, 1, 6);
    if (p <= 59 * atm) return 12 + clamp(r(p / (atm * 5) - 6) + 1, 1, 6);
    return 19;
  }
  process() { this.touch(); }
  status() {
    const p = this.reading();
    return p === null ? 'The connect error light is blinking.' : `The pressure gauge reads ${Math.round(p * 100) / 100} kPa; 293.15 K (20 °C).`;
  }
  examine() { return [this.status()]; }
  click(c, m, held) { if (held) return false; if (this.operational) this.sim.tell(m, 'info', this.status()); return true; }
}

/** The machine a path of the map is, or null. */
export function makeDevice(net, it, path) {
  if (path.startsWith('machinery/meter')) return new Meter(net, it, path);
  const C = 'machinery/atmospherics/components/';
  if (!path.startsWith(C)) return null;
  const seg = path.slice(C.length).split('/'), kind = seg[0], name = seg[1], rest = seg.slice(2);
  if (kind === 'unary') {
    switch (name) {
      case 'vent_pump': return new VentPump(net, it, path, rest);
      case 'vent_scrubber': return new Scrubber(net, it, path, rest);
      case 'portables_connector': return new Connector(net, it, path);
      case 'outlet_injector': return new Injector(net, it, path, rest);
      case 'tank': return new Tank(net, it, path, rest);
      default: return new Inert(net, it, path, rest);
    }
  }
  if (kind === 'binary') {
    switch (name) {
      case 'pump': return new Pump(net, it, path, rest);
      case 'valve': return new Valve(net, it, path, rest);
      case 'dp_vent_pump': return new DPVent(net, it, path, rest);
      default: return null;
    }
  }
  if (kind === 'trinary') {
    if (name === 'filter') return new Filter(net, it, path, rest);
    if (name === 'mixer') return new Mixer(net, it, path, rest);
  }
  return null;
}

