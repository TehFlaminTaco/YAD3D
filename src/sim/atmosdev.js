import { TILE } from '../shared/config.js';
import {
  Mix, CELL_VOLUME, ONE_ATMOSPHERE, GAS_IDS, GAS_NAME, CANISTERS, CANISTER_VOLUME, canisterMix, pumpGas, releaseGas, danger, AIR_MODES, AIR_MODE, airModeName,
} from '../shared/gases.js';
import { CH } from '../shared/power.js';
import { esc } from '../shared/util.js';
import { toolJob } from './tooljob.js';
import { detach, place, putInHands } from './inventory.js';

const PROCESS = 0.5;                       // seconds between one run of a machine's atmospherics and the next (SSair's wait is five ticks)
const norm = (p) => (p || '').replace(/^\/?(obj\/)?/, '');
const a_ = (name) => `the ${name}`;
const bar = (frac, n = 20) => '█'.repeat(Math.round(Math.max(0, Math.min(1, frac)) * n)) + '░'.repeat(n - Math.round(Math.max(0, Math.min(1, frac)) * n));

const CAN_MIN = ONE_ATMOSPHERE / 10, CAN_MAX = ONE_ATMOSPHERE * 10;                 // canister.dm can_min_release_pressure, can_max_release_pressure
const CAN_HEAT_LIMIT = 5000, CAN_PRESSURE_LIMIT = 50000;                               // canister.dm heat_limit, pressure_limit
const PUMP_MIN = ONE_ATMOSPHERE / 10, PUMP_MAX = ONE_ATMOSPHERE * 25;               // pump.dm PUMP_MIN_PRESSURE, PUMP_MAX_PRESSURE
const SCRUB_DEFAULT = ['tox', 'co2', 'n2o', 'bz', 'h2o'];                           // scrubber.dm: what a new one scrubs (the DM's list, as far as the game has the gases)

/** How the analyzer writes a temperature (scanners.dm: `[round(T - T0C)] °C ([round(T, 0.01)] K)`). */
export const tempText = (t) => `${Math.round(t - 273.15)} °C (${Math.round(t * 100) / 100} K)`;

/**
 * What the gas analyzer says of a mixture (scanners.dm atmosanalyzer_scan): moles, volume, pressure, each gas's share, the temperature. `name` is how the thing is called ("the canister").
 */
export function scanMix(sim, m, mix, name) {
  sim.chat.visible(m, `${m.name} uses the analyzer on ${name}.`, 'notice', 8, m);
  sim.tell(m, 'notice', `You use the analyzer on ${name}.`);
  sim.tell(m, 'notice', `Results of analysis of ${name}.`);
  const total = mix.total();
  if (total > 0) {
    sim.tell(m, 'info', `Moles: ${Math.round(total * 100) / 100} mol`);
    sim.tell(m, 'info', `Volume: ${mix.vol} L`);
    sim.tell(m, 'info', `Pressure: ${Math.round(mix.pressure() * 100) / 100} kPa`);
    for (const id of GAS_IDS) {
      const mol = mix.g[id];
      if (mol > 0) sim.tell(m, 'info', `${GAS_NAME[id]}: ${Math.round(mol / total * 10000) / 100} % (${Math.round(mol * 100) / 100} mol)`);
    }
    sim.tell(m, 'info', `Temperature: ${tempText(mix.t)}`);
  } else sim.tell(m, 'info', `${name[0].toUpperCase()}${name.slice(1)} is empty!`);
  return true;
}

/** An analyzer used in the hand (analyzer.dm attack_self): what the air of the tile you stand on is. */
export function scanAir(sim, m) {
  const g = m.grid, a = g.atmos, [c, r] = m.tile;
  const e = a.gasesAt(c, r, m.l | 0);
  const total = e.pressure;
  sim.tell(m, 'info', 'Results:');
  sim.tell(m, Math.abs(total - ONE_ATMOSPHERE) < 10 ? 'info' : 'warning', `Pressure: ${Math.round(total * 100) / 100} kPa`);
  if (total <= 0) return true;
  const row = (id, ok) => sim.tell(m, ok ? 'info' : 'warning', `${GAS_NAME[id]}: ${Math.round(e[id] / total * 10000) / 100} % (${Math.round(kpaToMoles(e[id]) * 100) / 100} mol)`);
  row('n2', Math.abs(e.n2 / total - 0.79) < 0.2);
  row('o2', Math.abs(e.o2 / total - 0.21) < 0.02);
  row('co2', e.co2 / total <= 0.01);
  row('tox', e.tox / total <= 0.005);
  for (const id of ['n2o', 'bz', 'h2o']) if (e[id] > 0) row(id, false);
  sim.tell(m, 'info', `Temperature: ${tempText(e.temperature)}`);
  return true;
}
const kpaToMoles = (kpa) => kpa * CELL_VOLUME / (8.31 * 293.15);

/**
 * The portable atmospherics (portable_atmospherics.dm): things that stand on a tile, hold gas of their own, and exchange it with the tile's air or with a gas tank put in them. They are
 * loose (dragged by hand), each run twice a second by `AtmosDevices`. Each has a click (a tank in the hand goes in; Alt-click takes it out; a gas analyzer reads it; the rest is its own).
 */
class Portable {
  constructor(dev, it, vol) {
    this.dev = dev; this.sim = dev.sim; this.grid = dev.grid; this.it = it;
    this.mix = new Mix(vol);
    this.holding = null;                     // a tank (an item with a `mix`) in the connector
    this.hp = 250;                           // max_integrity
    this.broken = false;
    this.port = null;                        // the connector port (a pipe machine) it is fastened to
    this.rev = 0;                            // changes with every change of state (a timed job notices the machine was worked on)
    this.v = 0;                              // which of its pictures it shows
    this.name = it.name;
    this.shootable = false;
  }

  get at() { return { grid: this.grid, x: this.it.x, z: this.it.z, l: this.it.l | 0 }; }
  get tile() { return this.grid.world.idx(Math.floor(this.it.x / TILE), Math.floor(this.it.z / TILE), this.it.l | 0); }
  /** The air of the tile it stands on, or null where there is none (a catwalk over space). */
  air() { const a = this.grid.atmos, i = this.tile; return a.isCell[i] && !this.grid.world.airBlock[i] ? a.cell(i) : null; }
  /** Space: what whatever is let out where there is no air goes into. */
  vacuum() { return new Mix(CELL_VOLUME); }
  variant() { return 0; }
  analyzable() { return this.mix; }
  process() {}
  console() { return null; }
  touch() {
    this.rev++;
    const v = this.variant();
    if (v === this.v) return;
    this.v = v;
    this.grid.emit({ e: 'pv', i: this.it.idx, v });
  }

  /** The connector port on its tile, if there is one for it to be fastened to. */
  portHere() {
    const net = this.grid.pipenet, i = this.tile;
    return (net?.devAt.get(i) || []).find((d) => d.isConnector) ?? null;
  }

  /** portable_atmospherics.dm connect(): fastened to a port it shares its gas with the pipes, and it cannot be moved. */
  connect(port) {
    if (this.port || !port || port.device) return false;
    this.port = port; port.device = this;
    const it = this.it;
    this.sim.anchoring.set(this.grid, it, true);
    if (port.parents[0]) { port.parents[0].update = true; this.grid.pipenet.reconcile(port.parents[0]); }
    this.touch();
    return true;
  }

  disconnect() {
    if (!this.port) return false;
    const port = this.port, it = this.it;
    this.port = null; port.device = null;
    this.sim.anchoring.set(this.grid, it, false);
    if (port.parents[0]) port.parents[0].update = true;
    this.touch();
    return true;
  }

  /** portable_atmospherics.dm replace_tank: what is in it comes out into the user's hands; `tank` (if any) goes in. */
  replaceTank(m, tank) {
    if (this.holding) { putInHands(this.sim, m, this.holding); this.holding = null; }
    if (tank) this.holding = tank;
    this.touch();
  }

  examine() {
    const out = [];
    if (this.holding) out.push(`${this.The()} contains ${a_(this.holding.name)}. Alt-click ${a_(this.name)} to remove it.`, `Click ${a_(this.name)} with another gas tank to hot swap ${a_(this.holding.name)}.`);
    return out;
  }
  The() { return `The ${this.name}`; }

  /** What every one of them does with a click; the machine's own `use` gets what is left. Returns true when it was dealt with. */
  click(c, m, held, alt) {
    const sim = this.sim, it = this.it;
    if (it.gone) return false;
    if (alt) {
      if (!this.holding) return false;
      sim.tell(m, 'notice', `You remove ${a_(this.holding.name)} from ${a_(this.name)}.`);
      this.replaceTank(m, null);
      this.afterTank(m, true);
      return true;
    }
    if (held && (held.def.tank || held.def.plasmaTank)) {                                  // attackby: a gas tank
      if (this.broken) return true;
      detach(sim, held);
      sim.tell(m, 'notice', this.holding ? `In one smooth motion you pop ${a_(this.holding.name)} out of ${a_(this.name)}'s connector and replace it with ${a_(held.name)}.` : `You insert ${a_(held.name)} into ${a_(this.name)}.`);
      this.replaceTank(m, held);
      this.afterTank(m, false);
      sim.sound('pickup', this.at, 0.4);
      return true;
    }
    if (held?.def.analyzer) return scanMix(sim, m, this.analyzable(), a_(this.name));
    if (held?.def.tool === 'wrench') {                                                         // attackby: fasten it to the port under it, or take it off
      if (this.broken) return true;
      const what = a_(this.name);
      if (this.port) {
        this.disconnect();
        sim.sound('wrench', this.at, 0.5);
        sim.tell(m, 'notice', `You unfasten ${what} from the port.`);
        sim.chat.visible(m, `${m.name} disconnects ${what}.`, 'notice', 8, m);
        return true;
      }
      const port = this.portHere();
      if (!port) { sim.tell(m, 'notice', 'Nothing happens.'); return true; }
      if (!this.connect(port)) { sim.tell(m, 'notice', `${this.name[0].toUpperCase()}${this.name.slice(1)} failed to connect to the port.`); return true; }
      sim.sound('wrench', this.at, 0.5);
      sim.tell(m, 'notice', `You fasten ${what} to the port.`);
      sim.chat.visible(m, `${m.name} connects ${what}.`, 'notice', 8, m);
      return true;
    }
    return false;
  }

  /** The tank changed: a machine that gives to it or takes from it stops, or goes on (replace_tank's close_valve). */
  afterTank() {}

  /** An explosion near: `heavy` it is destroyed (what it holds goes into the air), `light` it is only hurt. */
  blast(heavy) { if (heavy) this.destroy(); }

  /** ex_act / Destroy: what it holds is let out into the air, and it is gone. */
  destroy() {
    const it = this.it;
    if (it.gone) return;
    this.disconnect();
    const air = this.air();
    const gas = this.mix.remove(this.mix.total());
    if (air) air.merge(gas);
    if (this.holding) { place(this.sim, this.holding, this.grid, it.x, it.z, undefined, it.l | 0); this.holding = null; }
    it.gone = true;
    this.grid.world.boxDrop(it);
    this.grid.emit({ e: 'pg', i: it.idx });
  }
}

/**
 * The canister (canister.dm): 1000 litres of gas, a valve and a release pressure. With the valve open it lets gas out to the tank in it (or into the room) until the tank (or the tile) is at
 * its release pressure, and never more than half way to its own pressure. Shot or burnt through it breaks open and all its gas goes into the room; a welder cuts it apart (breaking it first).
 */
export class Canister extends Portable {
  constructor(dev, it, kind) {
    super(dev, it, CANISTER_VOLUME);
    this.kind = kind;
    this.desc = (CANISTERS[kind] ?? CANISTERS['']).desc;
    this.mix = canisterMix(kind);
    this.valve = false;
    this.release = ONE_ATMOSPHERE;           // release_pressure
    this.shootable = true;
  }

  /** Which of its twenty-one pictures: broken; else with or without a tank in it, and the lamp for how full it is, then the same with a port (canister.dm update_overlays). */
  variant() {
    if (this.broken) return 10;
    const p = this.mix.pressure();
    const lvl = p >= 40 * ONE_ATMOSPHERE ? 3 : p >= 10 * ONE_ATMOSPHERE ? 2 : p >= 5 * ONE_ATMOSPHERE ? 1 : p >= 10 ? 0 : -1;
    return (this.port ? 11 : 0) + (this.holding ? 5 : 0) + lvl + 1;
  }

  process() {
    if (this.broken) return;
    if (this.valve) {
      const out = this.holding ? this.holding.mix : (this.air() || this.vacuum());
      releaseGas(this.mix, out, this.release);
    }
    // too hot or too full burns it (canister.dm process_atmos: take_damage(clamp(heat / limit x pressure / limit, 5, 50)), with no armour against it)
    const p = this.mix.pressure(), t = this.mix.t;
    if (t > CAN_HEAT_LIMIT || p > CAN_PRESSURE_LIMIT) {
      this.hp -= Math.max(5, Math.min(50, (t / CAN_HEAT_LIMIT) * (p / CAN_PRESSURE_LIMIT)));
      if (this.hp <= 250 * 0.4) { this.breakOpen(); return; }
    }
    if (this.valve) this.touch();
  }

  afterTank(m, closeValve) { if (closeValve) this.valve = false; this.touch(); }

  examine() { return [`This canister is tier 1.`, ...super.examine()]; }

  /** canister_break: the gas goes into the room, the tank drops out, and it is a wreck you can walk over. */
  breakOpen() {
    if (this.broken) return false;
    const it = this.it, sim = this.sim;
    this.disconnect();
    this.broken = true; this.valve = false;
    const air = this.air();
    const gas = this.mix.remove(this.mix.total());
    if (air) air.merge(gas);
    if (this.holding) { place(sim, this.holding, this.grid, it.x, it.z, undefined, it.l | 0); this.holding = null; }
    it.dense = false;
    this.grid.world.boxSet(it);
    this.grid.emit({ e: 'pd', i: it.idx, d: 0 });
    sim.sound('spray', this.at, 0.4);
    this.touch();
    return true;
  }

  /** A shot or a blow: it has armour 50 against all of them, 250 integrity, and breaks at 40% of it (integrity_failure). */
  hit(amount) {
    if (this.broken) return;
    this.hp -= amount * 0.5;
    if (this.hp <= 250 * 0.4) this.breakOpen();
  }

  blast(heavy) { if (heavy) this.destroy(); else this.breakOpen(); }
  destroy() { super.destroy(); }

  click(c, m, held, alt) {
    const sim = this.sim, it = this.it;
    if (super.click(c, m, held, alt)) return true;
    if (held?.def.tool === 'welder' && m.intent !== 'harm') {                                        // welder_act
      if (!sim.actions.welderReady(m, held)) return true;
      if (this.mix.pressure() > 300) sim.tell(m, 'warning', `The ${this.name} meter shows high pressure inside!`);
      sim.tell(m, 'notice', `You begin cutting the ${this.name} apart...`);
      const th = { grid: this.grid, x: it.x, z: it.z, l: it.l | 0, reach: 3.6, alive: () => !it.gone, state: () => this.rev };
      toolJob(sim, m, th, held, this.rev, {
        label: `cutting the ${this.name} apart`, ds: 30, sfx: 'welder', start: null,
        valid: () => held.lit,
        done: () => {
          this.breakOpen();
          sim.stacks.spawn(this.grid, '/obj/item/stack/sheet/metal', 10, it.x, it.z);              // deconstruct(TRUE), tier 1
          it.gone = true;
          this.grid.world.boxDrop(it);
          this.grid.emit({ e: 'pg', i: it.idx });
        },
      });
      return true;
    }
    if (held) return false;
    sim.terminals.open(c, 'portable', { machine: this, grid: this.grid, name: this.name });
    return true;
  }

  console(c) {
    const p = this.mix.pressure(), step = (d) => () => { this.release = Math.max(CAN_MIN, Math.min(CAN_MAX, Math.round(this.release + d))); this.touch(); };
    const h = this.holding;
    return {
      title: 'Canister', live: true,
      html: `<span class="h">${esc(this.name)}</span>   <span class="d">${esc(this.desc)}</span>\n\nTank pressure     ${Math.round(p)} kPa  ${bar(p / (90 * ONE_ATMOSPHERE))}\nPort              ${this.port ? '<span class="c">Connected</span>' : '<span class="w">Disconnected</span>'}\nRelease pressure  ${Math.round(this.release)} kPa  <span class="d">(${Math.round(CAN_MIN)} to ${Math.round(CAN_MAX)})</span>\nValve             ${this.valve ? '<span class="c">Open</span>' : '<span class="w">Closed</span>'}\nHolding tank      ${h ? `${esc(h.name)}   ${Math.round(h.mix.pressure())} kPa` : '<span class="d">none</span>'}`,
      buttons: [
        { label: this.valve ? 'Close valve' : 'Open valve', fn: () => { this.valve = !this.valve; this.touch(); } },
        { label: 'Release: min', fn: () => { this.release = CAN_MIN; } }, { label: '-100', fn: step(-100) }, { label: '-10', fn: step(-10) }, { label: '-1', fn: step(-1) },
        { label: '+1', fn: step(1) }, { label: '+10', fn: step(10) }, { label: '+100', fn: step(100) },
        { label: 'Release: max', fn: () => { this.release = CAN_MAX; } }, { label: 'Release: reset', fn: () => { this.release = ONE_ATMOSPHERE; } },
        { label: 'Eject tank', disabled: !h, fn: () => { this.replaceTank(c.mob, null); this.valve = false; this.touch(); } },
      ],
    };
  }
}

/**
 * The portable air pump (pump.dm): 1000 litres of its own. Switched on it moves gas, to `target` kPa: out of its tank (or itself, with no tank) into the tile (or into itself, with a tank);
 * or, on In, out of the tile (or the tank) into itself (or the tank). It is how a room is emptied or a tank filled from the air.
 */
export class Pump extends Portable {
  constructor(dev, it) {
    super(dev, it, 1000);
    this.on = false; this.out = true; this.target = ONE_ATMOSPHERE;
  }
  variant() { return (this.port ? 4 : 0) + (this.on ? 2 : 0) + (this.holding ? 1 : 0); }

  process() {
    if (!this.on || this.broken) return;
    const room = this.air() || this.vacuum();
    let src, dst;
    if (this.out) { src = this.holding ? this.holding.mix : this.mix; dst = this.holding ? this.mix : room; }
    else { src = this.holding ? this.mix : room; dst = this.holding ? this.holding.mix : this.mix; }
    pumpGas(src, dst, this.target);
    this.touch();
  }

  afterTank(m, closeValve) { if (closeValve) this.on = false; this.touch(); }

  click(c, m, held, alt) {
    if (super.click(c, m, held, alt)) return true;
    if (held) return false;
    this.sim.terminals.open(c, 'portable', { machine: this, grid: this.grid, name: this.name });
    return true;
  }

  console(c) {
    const p = this.mix.pressure(), step = (d) => () => { this.target = Math.max(PUMP_MIN, Math.min(PUMP_MAX, Math.round(this.target + d))); };
    const h = this.holding;
    return {
      title: 'Portable Air Pump', live: true,
      html: `<span class="h">${esc(this.name)}</span>\n\nPower             ${this.on ? '<span class="c">On</span>' : '<span class="w">Off</span>'}\nPort              ${this.port ? '<span class="c">Connected</span>' : '<span class="w">Disconnected</span>'}\nMode              ${this.out ? 'Out' : 'In'}\nTarget pressure   ${Math.round(this.target)} kPa  <span class="d">(${Math.round(PUMP_MIN)} to ${Math.round(PUMP_MAX)})</span>\nPump pressure     ${Math.round(p)} kPa  ${bar(p / PUMP_MAX)}\nHolding tank      ${h ? `${esc(h.name)}   ${Math.round(h.mix.pressure())} kPa` : '<span class="d">none</span>'}`,
      buttons: [
        { label: this.on ? 'Turn off' : 'Turn on', fn: () => { this.on = !this.on; this.touch(); } },
        { label: this.out ? 'Mode: in' : 'Mode: out', fn: () => { this.out = !this.out; } },
        { label: 'Target: min', fn: () => { this.target = PUMP_MIN; } }, { label: '-100', fn: step(-100) }, { label: '-10', fn: step(-10) }, { label: '-1', fn: step(-1) },
        { label: '+1', fn: step(1) }, { label: '+10', fn: step(10) }, { label: '+100', fn: step(100) },
        { label: 'Target: max', fn: () => { this.target = PUMP_MAX; } }, { label: 'Target: reset', fn: () => { this.target = ONE_ATMOSPHERE; } },
        { label: 'Eject tank', disabled: !h, fn: () => { this.replaceTank(c.mob, null); this.on = false; this.touch(); } },
      ],
    };
  }
}

/**
 * The portable air scrubber (scrubber.dm) and the huge one: switched on it takes `volume_rate` litres at a time of the tile's air (or the tank's), keeps the gases it is set to filter
 * and hands the rest back, until it holds 80 atmospheres (200 for the huge one). The huge one is bolted down, needs the room's power, and cleans the tiles round it too.
 */
export class Scrubber extends Portable {
  constructor(dev, it, huge) {
    super(dev, it, huge ? 50000 : 1000);
    this.huge = huge;
    this.on = false;
    this.rate = huge ? 1500 : 1000;          // volume_rate
    this.over = (huge ? 200 : 80) * ONE_ATMOSPHERE;
    this.filters = new Set(SCRUB_DEFAULT);
    if (huge) this.name = 'huge air scrubber';
  }

  variant() { return this.huge ? (this.on ? 1 : 0) : (this.port ? 4 : 0) + (this.on ? 2 : 0) + (this.holding ? 1 : 0); }
  get anchored() { return !!this.it.anc; }

  /** Is the room's power on (the huge one is a machine on the equipment channel)? */
  get operational() {
    if (!this.huge) return true;
    const w = this.grid.world, a = w.areaIdx[this.tile];
    return this.grid.power.powered(a, CH.EQUIP);
  }

  scrub(mixture) {
    if (this.mix.pressure() >= this.over) return;
    const take = Math.min(1, this.rate / mixture.vol) * mixture.total();
    if (take <= 0) return;
    const filtering = mixture.remove(take);
    const filtered = filtering.removeGases([...this.filters]);
    this.mix.merge(filtered);
    mixture.merge(filtering);
  }

  process() {
    if (this.huge && (!this.anchored || !this.operational)) { if (this.on) { this.on = false; this.setLoad(false); this.touch(); } return; }
    if (!this.on || this.broken) return;
    if (this.holding) { this.scrub(this.holding.mix); this.touch(); return; }
    const air = this.air();
    if (air) this.scrub(air);
    if (this.huge) {                                                                              // GetAtmosAdjacentTurfs(alldir = TRUE)
      const w = this.grid.world, a = this.grid.atmos, c0 = Math.floor(this.it.x / TILE), r0 = Math.floor(this.it.z / TILE), l = this.it.l | 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dc && !dr) continue;
        if (!w.inb(c0 + dc, r0 + dr, l)) continue;
        const i = w.idx(c0 + dc, r0 + dr, l);
        if (a.isCell[i] && !w.airBlock[i]) this.scrub(a.cell(i));
      }
    }
    this.touch();
  }

  /** The huge one draws 500 W of the room's equipment power while it runs (and 10 idling): idle_power_usage 10, active_power_usage 500. */
  setLoad(on) {
    const ps = this.grid.powersim;
    if (!this.huge || !ps?.base) return;
    const k = this.grid.world.areaIdx[this.tile] * 3 + CH.EQUIP, want = on ? 490 : 0;
    ps.base[k] += want - (this.load || 0);
    this.load = want;
  }

  afterTank(m, closeValve) { if (closeValve) this.on = false; this.touch(); }

  examine() {
    return [...super.examine(), ...(this.huge ? [this.anchored ? 'It is bolted to the floor.' : 'It is not bolted to the floor.'] : [])];
  }

  click(c, m, held, alt) {
    const sim = this.sim, it = this.it;
    if (this.huge && held?.def.tool === 'wrench') {                                              // default_unfasten_wrench
      const anchoring = !this.anchored;
      sim.tell(m, 'notice', `You begin ${anchoring ? '' : 'un'}securing ${a_(this.name)}...`);
      const th = { grid: this.grid, x: it.x, z: it.z, l: it.l | 0, reach: 3.6, alive: () => !it.gone, state: () => this.rev };
      toolJob(sim, m, th, held, this.rev, {
        label: `${anchoring ? '' : 'un'}securing the ${this.name}`, ds: 20, sfx: 'wrench', start: null,
        done: () => {
          sim.tell(m, 'notice', `You ${anchoring ? '' : 'un'}secure ${a_(this.name)}.`);
          sim.anchoring.set(this.grid, it, anchoring);
          if (!anchoring) { this.on = false; this.setLoad(false); }
          sim.sound('pickup', this.at, 0.6);
          this.touch();
        },
      });
      return true;
    }
    if (super.click(c, m, held, alt)) return true;
    if (held) return false;
    sim.terminals.open(c, 'portable', { machine: this, grid: this.grid, name: this.name });
    return true;
  }

  console(c) {
    const p = this.mix.pressure(), h = this.holding;
    const rows = GAS_IDS.map((id) => ({ label: `${this.filters.has(id) ? '[x]' : '[ ]'} ${GAS_NAME[id]}`, fn: () => { if (this.filters.has(id)) this.filters.delete(id); else this.filters.add(id); } }));
    return {
      title: this.huge ? 'Huge Air Scrubber' : 'Portable Air Scrubber', live: true,
      html: `<span class="h">${esc(this.name)}</span>\n\nPower             ${this.on ? '<span class="c">On</span>' : '<span class="w">Off</span>'}${this.huge && !this.operational ? '  <span class="b">(no power)</span>' : ''}\nPort              ${this.port ? '<span class="c">Connected</span>' : '<span class="w">Disconnected</span>'}\nPressure          ${Math.round(p)} kPa  ${bar(p / this.over)}\nHolding tank      ${h ? `${esc(h.name)}   ${Math.round(h.mix.pressure())} kPa` : '<span class="d">none</span>'}\n\nFilters           <span class="d">${[...this.filters].map((id) => GAS_NAME[id]).join(', ') || 'none'}</span>`,
      buttons: [
        { label: this.on ? 'Turn off' : 'Turn on', disabled: this.huge && (!this.anchored || !this.operational), fn: () => { this.on = !this.on; this.setLoad(this.on); this.touch(); } },
        ...rows,
        { label: 'Eject tank', disabled: !h, fn: () => { this.replaceTank(c.mob, null); this.on = false; this.touch(); } },
      ],
    };
  }

  destroy() { this.setLoad(false); super.destroy(); }
}

/**
 * An air alarm (airalarm.dm): it has a mode (what the room's vents and scrubbers do, `Atmos.mode`) and a lock. Its interface shows what the air round it is, with the alarm's
 * thresholds (TLV) for how bad each reading is, and while it is unlocked (an ID with Atmospherics access, in the hand, or Alt-click) the modes can be changed.
 */
export class AirAlarm {
  constructor(dev, it) {
    this.dev = dev; this.sim = dev.sim; this.grid = dev.grid; this.it = it;
    this.area = this.grid.world.areaIdx[this.grid.world.idx(it.c, it.r, it.l | 0)];
    this.mode = AIR_MODE.SCRUBBING;
    this.locked = true;
    this.rev = 0;
    this.name = it.name || 'air alarm';
  }

  /** ACCESS_ATMOSPHERICS is 24. */
  allowed(m) { return m.access.has(24); }

  /** The air this alarm reads: its own tile if it holds air, else the one beside it. */
  readAt() {
    const w = this.grid.world, a = this.grid.atmos, it = this.it, l = it.l | 0;
    const own = w.idx(it.c, it.r, l);
    if (a.isCell[own]) return a.gasesAt(it.c, it.r, l);
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (w.inb(it.c + dc, it.r + dr, l) && a.isCell[w.idx(it.c + dc, it.r + dr, l)]) return a.gasesAt(it.c + dc, it.r + dr, l);
    return a.gasesAt(it.c, it.r, l);
  }

  dangerOf(e) {
    let d = danger('pressure', e.pressure);
    for (const id of GAS_IDS) d = Math.max(d, danger(id, e[id]));
    return d;
  }

  setMode(mode) {
    this.mode = mode;
    this.grid.atmos.setMode(this.area, mode);
    this.grid.pipenet?.applyMode(this.area, mode);
    this.rev++;
  }

  examine() { return [`Alt-Click the air alarm to ${this.locked ? 'unlock' : 'lock'} the interface.`]; }

  togglelock(m) {
    if (this.allowed(m)) { this.locked = !this.locked; this.sim.tell(m, 'notice', `You ${this.locked ? 'lock' : 'unlock'} the air alarm interface.`); this.sim.sound('terminal_key', { grid: this.grid, x: this.it.x, z: this.it.z, l: this.it.l | 0 }, 0.4); }
    else this.sim.tell(m, 'danger', 'Access denied.');
  }

  click(c, m, held, alt) {
    if (alt || held?.def.id) { this.togglelock(m); return true; }
    if (held) return false;
    this.sim.terminals.open(c, 'airalarm', { machine: this, area: this.area, grid: this.grid });
    return true;
  }

  console(c) {
    const e = this.readAt(), a = this.grid.atmos, m = c.mob;
    const level = this.dangerOf(e), canUse = !this.locked;
    const cls = (what, v) => ['c', 'w', 'b'][danger(what, v)];
    const row = (label, what, v, unit = 'kPa', digits = 2) => `${label.padEnd(15)}<span class="${cls(what, v)}">${v.toFixed(digits)} ${unit}</span>`;
    const lines = [row('Pressure', 'pressure', e.pressure, 'kPa', 1), ...GAS_IDS.filter((id) => ['o2', 'n2', 'co2', 'tox'].includes(id) || e[id] > 0.001).map((id) => row(GAS_NAME[id], id, e[id]))];
    const avg = a.areaStats.get(this.area);
    return {
      title: 'Air Alarm', live: true,
      html: `<span class="h">${esc(this.grid.world.areas[this.area]?.n || this.name)}</span>   <span class="d">${this.locked ? 'locked' : 'unlocked'}</span>\n\nStatus         ${level === 2 ? '<span class="b">DANGER</span>' : level === 1 ? '<span class="w">Warning</span>' : '<span class="c">Optimal</span>'}\n${lines.join('\n')}\nTemperature    <span class="${['c', 'w', 'b'][danger('temperature', e.temperature)]}">${(e.temperature - 273.15).toFixed(2)} °C</span>\nArea average   ${avg !== undefined ? avg.toFixed(1) + ' kPa' : 'n/a'}\n\nMode           ${airModeName(this.mode)}   ${this.grid.power.areaPowered(this.area) ? '' : '<span class="b">(no power)</span>'}${canUse ? '' : '\n\n<span class="w">The interface is locked.</span>'}`,
      buttons: AIR_MODES.map((md) => ({ label: `${md.id === this.mode ? '* ' : ''}${md.name}`, disabled: !canUse, fn: () => { this.setMode(md.id); this.sim.tell(m, 'notice', `The air alarm is set to ${md.name}.`); } })),
    };
  }
}

/** The atmospherics machines of one grid: canisters, pumps and scrubbers (portable, loose), and the air alarms that give its rooms' vents and scrubbers their orders. */
export class AtmosDevices {
  constructor(sim, grid) {
    this.sim = sim; this.grid = grid;
    this.list = [];                          // the portable ones
    this.alarms = [];
    this.acc = 0;
    for (const it of grid.props.interact) {
      const path = norm(it.path);
      let m = null;
      if (path.startsWith('machinery/portable_atmospherics/canister')) m = new Canister(this, it, path.slice('machinery/portable_atmospherics/canister'.length + 1).split('/')[0]);
      else if (path.startsWith('machinery/portable_atmospherics/pump')) m = new Pump(this, it);
      else if (path.startsWith('machinery/portable_atmospherics/scrubber')) m = new Scrubber(this, it, /\/huge/.test(path));
      else if (it.kind === 'wm' && it.sub === 'airalarm') { const al = new AirAlarm(this, it); this.alarms.push(al); it.mach = al; continue; }
      if (m) { this.list.push(m); it.mach = m; }
    }
    grid.atmos.onMode = (a) => { for (const al of this.alarms) if (al.area === a) al.mode = grid.atmos.mode[a]; grid.pipenet?.applyMode(a, grid.atmos.mode[a]); };
  }

  update(dt) {
    this.acc += dt;
    while (this.acc >= PROCESS) { this.acc -= PROCESS; for (const m of this.list) if (!m.it.gone) m.process(); }
  }

  /** The pictures that are not the first (for a client that joins). */
  pv() { return this.list.filter((m) => m.v !== 0).map((m) => [m.it.idx, m.v]); }
  /** The loose things that were broken open and can be walked over. */
  pd() { return this.list.filter((m) => m.broken && !m.it.gone).map((m) => m.it.idx); }

  /** Something blew up at tile (c, r) on deck `l`: what is within `heavy` tiles is destroyed, what is within `light` is hurt. */
  blast(c, r, heavy, light, l = 0) {
    for (const m of this.list) {
      if (m.it.gone || (m.it.l | 0) !== l) continue;
      const d = Math.hypot(m.it.x / TILE - (c + 0.5), m.it.z / TILE - (r + 0.5));
      if (d <= heavy) m.blast(true); else if (d <= light) m.blast(false);
    }
  }
}

