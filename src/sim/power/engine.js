import { TILE, KIND } from '../../shared/config.js';
import { GAS_IDS, T0C } from '../../shared/gases.js';
import { detach, place, consume } from '../inventory.js';
import { toolJob } from '../tooljob.js';
import { Machine, displayPower } from './machines.js';

/**
 * The engine. Emitters fire beams (down the reflectors of the engine room) at the supermatter crystal; each hit gives it power (supermatter.dm bullet_act: damage x bullet_energy); that
 * power leaks away (process_atmos: cubic in the power) as radiation and heat in the air of its chamber, and the radiation collectors turn the radiation into stored energy and then
 * watts (collector.dm), if they hold a plasma tank and are switched on. The collectors are what puts power on the cable. The crystal breathes the air round it, heats it, hurts if it
 * is too hot or too full or too powerful, and delaminates when its integrity is gone: see `Supermatter`. (The heat is for the cooling loop of the engine room to carry off.)
 */

const DIR_ANGLE = { 1: 0, 2: 180, 4: 90, 8: 270, 5: 45, 6: 135, 10: 225, 9: 315 };           // dir2angle
const mod360 = (a) => ((a % 360) + 360) % 360;
const the = (m) => `the ${m.name}`;
const The = (m) => `The ${m.name}`;
const displayJoules = (j) => displayPower(j).replace(/ (k|M|G)?W$/, ' $1J');
const BEAM_DAMAGE = 30;                // the emitter's beam (beams.dm /obj/projectile/beam/emitter)
const BULLET_ENERGY = 2;               // supermatter.dm bullet_energy
const RAD_AT_COLLECTOR = 0.2;          // how much of the crystal's radiation reaches a collector (the DM's falloff over distance and walls is not modelled: tuned so a running engine makes about what the station uses twice over)
const RAD_EFFICIENCY = 80, RAD_COEFFICIENT = 100, STORED_OUT = 0.04;           // collector.dm
const CRITICAL_TEMPERATURE = 10000;     // supermatter.dm: the air this hot is a warning by itself
const PLASMA_DRAIN = 0.001;            // moles a tank loses each power tick (powerproduction_drain)

/** Which way a beam of `ang` degrees goes a tile at a time: [dc, dr], or null when it is not along a row, a column or a diagonal. */
function stepOf(ang) {
  const a = mod360(ang);
  if (a % 45) return null;
  const r = a * Math.PI / 180;
  return [Math.round(Math.sin(r)), -Math.round(Math.cos(r))];
}

/** reflector.dm auto_reflect: the new heading of a beam going `ang` that meets a reflector of `type` set at `face`, or null if it is stopped. */
function reflect(type, face, ang) {
  if (type === 'box') return face;
  const incidence = mod360(face - (ang + 180));
  if (type === 'single' && incidence > 90 && incidence < 270) return null;
  return mod360(face + incidence);
}

/** The reflectors of a grid, by tile: `{type, face}` (the face is the way the prop is set, dir2angle). */
export function reflectorsOf(g) {
  const w = g.world, out = new Map();
  for (const it of g.props.interact) {
    const m = /^structure\/reflector\/(single|double|box)/.exec((it.path || '').replace(/^\//, ''));
    if (m) out.set(w.idx(it.c, it.r, it.l | 0), { type: m[1], it });
  }
  return out;
}

/**
 * The emitter (emitter.dm): it fires in bursts of four, two seconds apart, then waits between two and ten seconds, while it is on, welded to the floor and wired to a network that
 * has the 300 W it takes. Its beam burns what it hits (30), goes through glass and down any reflector it meets, and gives the supermatter power.
 */
export class Emitter extends Machine {
  constructor(ps, tile, rec) {
    super(ps, tile, rec);
    this.name = 'emitter';
    this.welded = !!rec.anc;                              // the map's welded ones start fixed to the floor
    this.active = false; this.powered = false; this.locked = false;
    this.fireDelay = 10; this.maxDelay = 10; this.minDelay = 2;           // seconds (RefreshParts with the basic parts)
    this.lastShot = -1e9; this.shots = 0;
    this.usage = 300;                                     // W
  }

  get anchored() { return !!this.rec.anc; }
  get net() { return this.welded ? super.net : null; }
  variant() { return !this.active ? 0 : this.powered ? 1 : 2; }

  process() {
    const sim = this.ps.sim;
    if (this.broken) return;
    const net = this.net;
    if (!this.welded || !net) { if (this.active) { this.active = false; this.powered = false; this.touch(); } return; }
    if (!this.active) return;
    if (net.surplus() >= this.usage) {
      net.addLoad(this.usage);
      if (!this.powered) { this.powered = true; this.touch(); }
    } else {
      if (this.powered) { this.powered = false; this.touch(); }
      return;
    }
    if (this.lastShot + this.fireDelay > sim.time) return;
    this.fire();
  }

  /** fire_beam(): a beam from this tile the way the emitter faces; then the burst counting (four shots two seconds apart, then a pause). */
  fire() {
    const sim = this.ps.sim, g = this.ps.grid;
    sim.sound('laser', { grid: g, x: this.rec.x, z: this.rec.z, l: this.rec.l | 0 }, 0.5);
    this.ps.engine.trace(this);
    this.lastShot = sim.time;
    if (this.shots < 3) { this.fireDelay = 2; this.shots++; }
    else { this.fireDelay = this.minDelay + sim.rand() * (this.maxDelay - this.minDelay); this.shots = 0; }
  }

  examine() {
    const out = [];
    if (this.welded) out.push("It's moored firmly to the floor. You can unsecure its moorings with a welder.");
    else if (this.anchored) out.push("It's currently anchored to the floor. You can secure its moorings with a welder, or remove it with a wrench.");
    else out.push("It's not anchored to the floor. You can secure it in place with a wrench.");
    if (!this.active) out.push('Its status display is currently turned off.');
    else if (!this.powered) out.push('Its status display is glowing faintly.');
    else out.push(`Its status display reads: Emitting one beam every ${Math.round(this.maxDelay)} seconds.`, `Power consumption at ${displayPower(this.usage)}.`);
    return out;
  }

  click(c, m, held, alt) {
    const ps = this.ps, sim = ps.sim, g = ps.grid, it = this.rec;
    const say = (text, kind = 'notice') => sim.tell(m, kind, text);
    const at = { grid: g, x: it.x, z: it.z, l: it.l | 0 };
    const th = { grid: g, x: it.x, z: it.z, l: it.l | 0, reach: 3.6, alive: () => !it.gone, state: () => this.rev };
    const tool = held?.def.tool;
    const job = (label, ds, o) => toolJob(sim, m, th, held, this.rev, { label, ds, ...o });
    if (alt) {                                                                         // simple_rotation: only while it is loose
      if (this.anchored) { say('It is fastened to the floor!', 'warning'); return true; }
      const next = { 1: 4, 4: 2, 2: 8, 8: 1 }[it.d] ?? 1;
      sim.people.placeProp(it, it.x, it.z, next);
      this.touch();
      return true;
    }
    if (held?.def.id) {                                                                // attackby: the lock
      if (!sim.terminals.engineAccess(m)) say('Access denied.', 'danger');
      else if (this.active) { this.locked = !this.locked; say(`You ${this.locked ? 'lock' : 'unlock'} the controls.`); }
      else say(`The controls can only be locked when ${the(this)} is online!`, 'warning');
      return true;
    }
    if (tool === 'wrench') {                                                           // default_unfasten_wrench
      if (this.active) { say(`Turn ${the(this)} off first!`, 'warning'); return true; }
      if (this.welded) { say(`${The(this)} is welded to the floor!`, 'warning'); return true; }
      const anchoring = !this.anchored;
      say(`You begin ${anchoring ? '' : 'un'}securing ${the(this)}...`);
      job(`${anchoring ? '' : 'un'}securing the emitter`, 20, {
        sfx: 'wrench', start: null,
        done: () => {
          say(`You ${anchoring ? '' : 'un'}secure ${the(this)}.`);
          sim.anchoring.set(g, it, anchoring);
          sim.sound('pickup', at, 0.6);
          this.touch();
        },
      });
      return true;
    }
    if (tool === 'welder') {                                                           // welder_act
      if (this.active) { say(`Turn ${the(this)} off first!`, 'warning'); return true; }
      if (!this.anchored) { say(`${The(this)} needs to be wrenched to the floor!`, 'warning'); return true; }
      if (!sim.actions.welderReady(m, held)) return true;
      const welding = !this.welded;
      sim.chat.visible(m, `${m.name} starts to ${welding ? 'weld' : 'cut'} the ${this.name} ${welding ? 'to' : 'free from'} the floor.`, 'notice', 10, m);
      job(`${welding ? 'welding the emitter to' : 'cutting the emitter free from'} the floor`, 20, {
        sfx: 'welder', start: `You start to ${welding ? 'weld' : 'cut'} ${the(this)} ${welding ? 'to' : 'free from'} the floor...`, valid: () => held.lit,
        done: () => {
          if (this.welded === welding) return;
          this.welded = welding;
          say(`You ${welding ? 'weld' : 'cut'} ${the(this)} ${welding ? 'to' : 'free from'} the floor.`);
          ps.cables.dirty = true;
          this.touch();
        },
      });
      return true;
    }
    if (held) return true;
    // attack_hand -> interact
    if (!this.welded) { say(`${The(this)} needs to be firmly secured to the floor first!`, 'warning'); return true; }
    if (!this.net) { say(`${The(this)} isn't connected to a wire!`, 'warning'); return true; }
    if (this.locked) { say('The controls are locked!', 'warning'); return true; }
    this.active = !this.active;
    say(`You turn ${this.active ? 'on' : 'off'} ${the(this)}.`);
    if (this.active) { this.shots = 0; this.fireDelay = this.maxDelay; }
    else this.powered = false;
    sim.sound('beep', at, 0.4);
    this.touch();
    return true;
  }
}

/**
 * The radiation collector (collector.dm). With a plasma tank in it and switched on, radiation from the crystal adds to what it has stored; with a tank (on or not) it puts out
 * min(stored, stored x 0.04 + 1000) watts every power tick. The tank slowly turns its plasma into tritium (we only count the plasma).
 */
export class Collector extends Machine {
  constructor(ps, tile, rec) {
    super(ps, tile, rec);
    this.name = 'Radiation Collector Array';
    this.tank = null; this.stored = 0; this.active = false; this.locked = false; this.panelOpen = false;
    this.out = 0;                                         // what it put out last tick
  }

  get anchored() { return !!this.rec.anc; }
  get net() { return this.anchored ? super.net : null; }
  variant() { return (this.tank ? 1 : 0) + (this.active ? 2 : 0); }

  /** rad_act: a pulse of `strength` from the crystal. */
  radAct(strength) {
    if (this.tank && this.active && strength > RAD_EFFICIENCY) this.stored += (strength - RAD_EFFICIENCY) * RAD_COEFFICIENT;
  }

  process() {
    if (!this.tank || this.broken) { this.out = 0; return; }
    if (!(this.tank.mix.g.tox > 0)) {                                                     // out of fuel: the tank pops out
      this.ps.sim.sound('ping', { grid: this.ps.grid, x: this.rec.x, z: this.rec.z, l: this.rec.l | 0 }, 0.6);
      this.eject();
      this.out = 0;
      return;
    }
    this.tank.mix.g.tox = Math.max(0, this.tank.mix.g.tox - PLASMA_DRAIN);
    const out = Math.min(this.stored, this.stored * STORED_OUT + 1000);
    this.out = out;
    const net = this.net;
    if (net) net.addAvail(out);
    this.stored -= out;
  }

  /** eject(): the tank comes out onto the floor in front, the controls unlock, and it stops. */
  eject(m) {
    const sim = this.ps.sim, g = this.ps.grid;
    this.locked = false;
    const tank = this.tank;
    if (!tank) return;
    this.tank = null;
    const [x, z] = m ? sim.actions.frontOf(this.rec, m, 0.9) : [this.rec.x, this.rec.z + 0.9];
    place(sim, tank, g, x, z, undefined, this.rec.l | 0);
    if (this.active) this.active = false;
    this.touch();
  }

  examine() {
    if (this.active) {
      const joules = this.stored * 2;                                                  // (stored_energy x SSmachines.wait x 0.1)
      return [`The ${this.name}'s display states that it has stored ${displayJoules(joules)}, and is processing ${displayPower(Math.min(this.stored, this.stored * STORED_OUT + 1000))}.`];
    }
    return [`The ${this.name}'s display displays the words: "Power production mode. Please insert Plasma. Use a multitool to change production modes."`];
  }

  click(c, m, held) {
    const ps = this.ps, sim = ps.sim, g = ps.grid, it = this.rec;
    const say = (text, kind = 'notice') => sim.tell(m, kind, text);
    const at = { grid: g, x: it.x, z: it.z, l: it.l | 0 };
    const tool = held?.def.tool;
    if (held?.def.plasmaTank) {                                                        // attackby: a plasma tank
      if (!this.anchored) say(`The ${this.name} needs to be secured to the floor first!`, 'warning');
      else if (this.tank) say("There's already a plasma tank loaded!", 'warning');
      else if (this.panelOpen) say('Close the maintenance panel first!', 'warning');
      else { detach(sim, held); this.tank = held; sim.sound('pickup', at, 0.5); this.touch(); }
      return true;
    }
    if (held?.def.id) {
      if (!sim.terminals.engineAccess(m)) say('Access denied.', 'danger');
      else if (this.active) { this.locked = !this.locked; say(`You ${this.locked ? 'lock' : 'unlock'} the controls.`); }
      else say(`The controls can only be locked when the ${this.name} is active!`, 'warning');
      return true;
    }
    if (tool === 'screwdriver') {
      if (this.tank) say('Remove the plasma tank first!', 'warning');
      else { this.panelOpen = !this.panelOpen; say(`You ${this.panelOpen ? 'open' : 'close'} the maintenance hatch of the ${this.name}.`); sim.sound('screwdriver', at, 0.8); }
      return true;
    }
    if (tool === 'crowbar') {
      if (this.tank) { if (this.locked) say('The controls are locked!', 'warning'); else this.eject(m); }
      else say("There isn't a tank loaded!", 'warning');
      return true;
    }
    if (tool === 'wrench') {                                                           // (it is bolted to the floor for good: the engine's own)
      say(this.tank ? 'Remove the plasma tank first!' : `The ${this.name} is bolted down.`, 'warning');
      return true;
    }
    if (held) return true;
    if (!this.anchored) return true;
    if (this.locked) { say('The controls are locked!', 'warning'); return true; }
    this.active = !this.active;
    sim.chat.visible(m, `${m.name} turns the ${this.name} ${this.active ? 'on' : 'off'}.`, 'notice', 10, m);
    say(`You turn the ${this.name} ${this.active ? 'on' : 'off'}.`);
    sim.sound('beep', at, 0.4);
    this.touch();
    return true;
  }
}

/**
 * The supermatter crystal (supermatter.dm), the `engine` one: every atmos cycle (four in a power tick, as SSair runs every half second) it takes 15% of the air of its tile,
 * works out from what it is made of (the smoothed `comp`) how much it radiates, how hot it makes it and how much plasma and oxygen it puts back, and gives it back changed. Emitter hits and
 * the heat of the air feed `power`, which leaks away cubically; too hot, too much power or too much gas hurt it (`damage`), cool air heals it. At `damage` 50 the engineers are told on the
 * Engineering channel, at 700 everyone is, and past 900 a 30 second countdown to the end begins (unless it is brought back under 900): then it explodes. Touch it and you are dust.
 * Not done: the tesla arcs and anomalies it throws at high power, its pull on things, hallucinations, the singularity and energy ball it can become.
 */
const SM_EFFICIENCY = 0.15, SM_GAS_CHANGE = 0.05;                                   // gasefficency, gas_change_rate
const SM_EXPLOSION_POINT = 900, SM_EMERGENCY_POINT = 700, SM_WARNING_POINT = 50, SM_EXPLOSION_POWER = 35;
const SM_HEAT_THRESHOLD = 40, SM_DAMAGE_HARDCAP = 0.002, SM_DAMAGE_INCREASE = 0.25;
const SM_MOLE_PENALTY = 1800, SM_MOLE_HEAT = 350, SM_POWER_PENALTY = 5000;
const SM_THERMAL_RELEASE = 5, SM_PLASMA_RELEASE = 750, SM_OXYGEN_RELEASE = 325, SM_REACTION_POWER = 0.55, SM_MATTER_CONVERSION = 10;
const SM_INHIBIT_GAS = 0.2, SM_INHIBIT_MOLES = 20, SM_INHIBIT_BOOST = 500, SM_BZ_RADIOACTIVITY = 5;
const SM_WARNING_DELAY = 60, SM_COUNTDOWN = 30;                                     // seconds
const SM_DETONATION_RADS = 200;
const SM_HEAT_PENALTY = { o2: 1, h2o: 8, tox: 15, co2: 0.1, n2: -1.5, bz: 5 };      // how much each gas adds to the heat and the waste (PLASMA_HEAT_PENALTY ...)
const SM_TRANSMIT = { o2: 1.5, h2o: 2, tox: 4, bz: -2 };                             // ... to the radiation (OXYGEN_TRANSMIT_MODIFIER ...)
const SM_RESIST = { n2o: 6 };                                                        // ... to how much heat it takes (N2O_HEAT_RESISTANCE)
const SM_POWERMIX = { o2: 1, h2o: 1, tox: 1, co2: 1, n2: -1, bz: 1 };               // gas_powermix: what makes the heat of the air into power
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const percent = (v) => String(Math.round(v * 100) / 100);

export class Supermatter extends Machine {
  constructor(ps, tile, rec) {
    super(ps, tile, rec);
    this.name = 'supermatter crystal';
    this.power = 0;                                       // "relative EER" on the monitor
    this.hits = 0;
    this.damage = 0; this.damageArchived = 0;
    this.matterPower = 0;                                 // what it was fed, turning into power
    this.comp = Object.fromEntries(GAS_IDS.map((id) => [id, 0]));                       // gas_comp: the mix it has come to, 0 to 1 each
    this.combined = 0;                                    // moles it took in last cycle
    this.powerRatio = 0; this.heatModifier = 1; this.heatResistance = 1; this.transmission = 0; this.molePenalty = 0;
    this.inhibitScale = 0; this.inhibitor = 1;
    this.lastWarning = -1e9;
    this.countdown = null;                                // {k, acc} once the end has begun
    this.gone = false;
  }

  /** get_integrity(): percent left. */
  get integrity() { return Math.max(0, Math.round((100 - this.damage / SM_EXPLOSION_POINT * 100) * 100) / 100); }

  /** The air of the crystal's tile, as the monitor reads it (null in space). */
  air() {
    const g = this.ps.grid, a = g.atmos, i = this.tile;
    return a && a.isCell[i] && !g.world.airBlock[i] ? a.cell(i) : null;
  }

  /** get_status(): 0 inactive, 1 normal, 2 notify, 3 warning, 4 danger, 5 emergency, 6 delaminating (the monitor's icons and colours). */
  get status() {
    const air = this.air(), integrity = this.integrity, t = air ? air.t : 0;
    if (integrity < 5) return 6;
    if (integrity < 25) return 5;
    if (integrity < 50) return 4;
    if (integrity < 100 || t > CRITICAL_TEMPERATURE) return 3;
    if (t > CRITICAL_TEMPERATURE * 0.8) return 2;
    return this.power > 5 ? 1 : 0;
  }

  /** bullet_act: an emitter beam hit it. */
  hit(damage) { this.power += damage * BULLET_ENERGY; this.hits++; }

  process() {
    for (let k = 0; k < 4; k++) this.cycle();
  }

  /** process_atmos() once. */
  cycle() {
    if (this.gone || !this.ps.grid.atmos) return;                                       // (the first power ticks come while the grid is still being made)
    const air = this.air(), removed = air ? air.remove(SM_EFFICIENCY * air.total()) : null, moles = removed ? removed.total() : 0;
    this.damageArchived = this.damage;
    if (!(moles > 0)) this.damage += Math.max(this.power / 1000 * SM_DAMAGE_INCREASE, 0.1);                 // in space, or with nothing round it: always at least some damage
    else this.react(air, removed, moles);
    this.irradiate();
    this.power = Math.max(this.power - Math.min((this.power / 500) ** 3 * this.inhibitor, this.power * 0.83 * this.inhibitor), 0);
    this.warn();
  }

  /** The part of process_atmos() that works on the gas it took (`removed`, `moles` of it) and puts it back into `air`. */
  react(air, removed, moles) {
    const sim = this.ps.sim, g = this.ps.grid, comp = this.comp, collectors = this.ps.machines.collector;
    // causing damage: heat, power and mass all hurt (a quarter of what the formulas say), cool air heals
    const hot = Math.max(Math.min(Math.max(moles / 200, 0.5), 1) * removed.t - (T0C + SM_HEAT_THRESHOLD) * this.heatResistance, 0);
    this.damage = Math.max(this.damage + hot * this.molePenalty / 150 * SM_DAMAGE_INCREASE, 0);
    this.damage = Math.max(this.damage + Math.max(this.power - SM_POWER_PENALTY, 0) / 500 * SM_DAMAGE_INCREASE, 0);
    this.damage = Math.max(this.damage + Math.max(this.combined - SM_MOLE_PENALTY, 0) / 80 * SM_DAMAGE_INCREASE, 0);
    if (this.combined < SM_MOLE_PENALTY) this.damage = Math.max(this.damage + Math.min(removed.t - (T0C + SM_HEAT_THRESHOLD), 0) / 150, 0);
    this.damage = Math.min(this.damageArchived + SM_DAMAGE_HARDCAP * SM_EXPLOSION_POINT, this.damage);          // (so much damage in a cycle, no more)
    // what the gas is: it moves its mix a little toward the real one each time
    this.combined = Math.max(moles, 0);
    for (const id of GAS_IDS) comp[id] += clamp(Math.max(removed.g[id] / this.combined, 0) - comp[id], -1, SM_GAS_CHANGE);
    const h2o = 1 - comp.h2o * 0.25;
    let ratio = 0, heat = 0, resist = 0, trans = 0;
    for (const id of GAS_IDS) {
      ratio += comp[id] * (SM_POWERMIX[id] ?? 0); heat += comp[id] * (SM_HEAT_PENALTY[id] ?? 0);
      resist += comp[id] * (SM_RESIST[id] ?? 0); trans += comp[id] * (SM_TRANSMIT[id] ?? 0);
    }
    this.powerRatio = clamp(ratio, 0, 1);
    this.heatModifier = Math.max(heat * h2o, 0.5);
    this.heatResistance = Math.max(resist, 1);
    this.transmission = trans * h2o;
    this.molePenalty = Math.max(this.combined / SM_MOLE_HEAT, 0.25);
    // carbon dioxide slows the power loss (the charge inertia chain reaction), more with more of it
    if (this.combined > SM_INHIBIT_MOLES && comp.co2 > SM_INHIBIT_GAS) this.inhibitScale = clamp(this.inhibitScale + clamp(comp.co2 - this.inhibitScale, -0.02, 0.02), 0, 1);
    else this.inhibitScale = clamp(this.inhibitScale - 0.05, 0, 1);
    this.inhibitor = clamp(1 - this.inhibitScale * clamp(this.combined / SM_INHIBIT_BOOST, 1, 1.5), 0, 1);
    // what it was fed turns into power, the heat of the air does too
    if (this.matterPower) {
      const taken = Math.max(this.matterPower / SM_MATTER_CONVERSION, 40);
      this.power = Math.max(this.power + taken, 0);
      this.matterPower = Math.max(this.matterPower - taken, 0);
    }
    this.power = Math.max(removed.t * (this.powerRatio > 0.8 ? 50 : 30) / T0C * this.powerRatio + this.power, 0);
    if (sim.rand() < 0.5) {
      const strength = this.power * Math.max(0, 1 + this.transmission / (10 - comp.bz * SM_BZ_RADIOACTIVITY));
      for (const c of collectors) c.radAct(strength * RAD_AT_COLLECTOR);
      sim.radiation.pulse(g, this.rec.x, this.rec.z, this.rec.l | 0, strength, 0);          // radiation_pulse(src, power): no range modifier, so no falloff with distance; only what is in the way weakens it
    }
    // heat and waste: the more it runs, the hotter the air and the more plasma and oxygen
    const energy = this.power * SM_REACTION_POWER;
    removed.t = Math.max(0, Math.min(removed.t + energy * this.heatModifier / SM_THERMAL_RELEASE, 2500 * this.heatModifier));
    removed.g.tox += Math.max(energy * this.heatModifier / SM_PLASMA_RELEASE, 0);
    removed.g.o2 += Math.max(((energy + removed.t * this.heatModifier) - T0C) / SM_OXYGEN_RELEASE, 0);
    air.merge(removed);
  }

  /** Anyone close is hit by the radiation of the crystal itself (the DM's `range(src, round((power / 100) ** 0.25))`). */
  irradiate() {
    const sim = this.ps.sim, g = this.ps.grid, range = Math.round((this.power / 100) ** 0.25), l = this.rec.l | 0;
    if (range < 1) return;
    for (const m of sim.mobs.values()) {
      if (m.dead || m.grid !== g || (m.l | 0) !== l) continue;
      const d = Math.max(Math.abs(m.tile[0] - this.c), Math.abs(m.tile[1] - this.r));
      if (d <= range) sim.radiation.radAct(m, this.power / 10 * Math.sqrt(1 / Math.max(d, 1)));
    }
  }

  /** The sound of the alarm for how bad it is. */
  alarm() {
    const s = this.status, at = { grid: this.ps.grid, x: this.rec.x, z: this.rec.z, l: this.rec.l | 0 };
    if (s >= 4) this.ps.sim.sound('alarm', at, 1);
    else if (s === 3) this.ps.sim.sound('terminal_alert', at, 0.75);
  }

  /** The crystal speaks on its radio (the Engineering channel, or the common one). */
  say(channel, text) { this.ps.sim.director.autoRadio(channel, text, 'Supermatter Crystal', 'states'); }

  /** The warnings: past 50 damage the engineers hear about it, past 700 everybody, and past 900 the end begins. */
  warn() {
    const now = this.ps.sim.time;
    if (!(this.damage > SM_WARNING_POINT)) return;
    if (now - this.lastWarning >= SM_WARNING_DELAY) {
      this.alarm();
      const ig = `Integrity: ${percent(this.integrity)}%`;
      if (this.damage > SM_EMERGENCY_POINT) {
        this.say('common', `CRYSTAL DELAMINATION IMMINENT. ${ig}`);
        this.lastWarning = now;
      } else if (this.damage >= this.damageArchived) {                                  // still going up: again in half a minute
        this.say('engineering', `Danger! Crystal hyperstructure integrity faltering! ${ig}`);
        this.lastWarning = now - SM_WARNING_DELAY / 2;
      } else {
        this.say('engineering', `Crystalline hyperstructure returning to safe operating parameters. ${ig}`);
        this.lastWarning = now;
      }
      if (this.power > SM_POWER_PENALTY) {
        this.say('engineering', 'Warning: Hyperstructure has reached dangerous power level.');
        if (this.inhibitor < 0.5) this.say('engineering', 'DANGER: CHARGE INERTIA CHAIN REACTION IN PROGRESS.');
      }
      if (this.combined > SM_MOLE_PENALTY) this.say('engineering', 'Warning: Critical coolant mass reached.');
    }
    if (this.damage > SM_EXPLOSION_POINT && !this.countdown) {                           // countdown()
      this.countdown = { k: 0, acc: 1 };
      this.say('common', 'CRYSTAL DELAMINATION IMMINENT. The supermatter has reached critical integrity failure. Emergency causality destabilization field has been activated.');
    }
  }

  /** From the simulation, every step: the countdown ticks once a second. */
  update(dt) {
    const cd = this.countdown;
    if (!cd || this.gone) return;
    cd.acc += dt;
    while (cd.acc >= 1 && this.countdown) { cd.acc -= 1; this.count(); }
  }

  /** One turn of countdown()'s loop: the failsafe is checked, and every five seconds (every second at the end) it says what is left. */
  count() {
    const cd = this.countdown;
    if (cd.k > SM_COUNTDOWN) { this.explode(); return; }
    const left = (SM_COUNTDOWN - cd.k) * 10;                                           // deciseconds
    cd.k++;
    if (this.damage < SM_EXPLOSION_POINT) {                                            // cutting it a bit close there engineers
      this.say('common', 'Crystalline hyperstructure returning to safe operating parameters. Failsafe has been disengaged.');
      this.countdown = null;
      return;
    }
    if (left % 50 !== 0 && left > 50) return;
    this.say('common', left > 50 ? `${left / 10} seconds remain before causality stabilization.` : `${left / 10}...`);
  }

  /** explode(): everybody on the station is irradiated and told, and the crystal goes up. */
  explode() {
    const sim = this.ps.sim, g = this.ps.grid, rec = this.rec, l = rec.l | 0;
    this.countdown = null;
    for (const m of sim.mobs.values()) {
      if (m.dead || m.grid !== g) continue;
      const d = Math.max(Math.abs(m.tile[0] - this.c), Math.abs(m.tile[1] - this.r));
      sim.radiation.radAct(m, SM_DETONATION_RADS * Math.sqrt(1 / (d + 1)));
      if (m.client) sim.tell(m, 'danger', 'You feel reality distort for a moment...');
    }
    const R = SM_EXPLOSION_POWER * Math.max(this.powerRatio, 0.205);
    this.gone = true;
    const arr = this.ps.machines.supermatter, k = arr.indexOf(this);
    if (k >= 0) arr.splice(k, 1);
    sim.removeProp(g, rec);
    sim.explosion(g, rec.x, rec.z, { dev: R * 0.5, heavy: R + 2, light: R + 4, l });
    sim.director.stats.delaminated++;
  }

  /** Consume(): whatever it touches is gone (a person, an item), the crystal is fed a little and everyone near is irradiated. */
  consume() {
    const sim = this.ps.sim;
    this.matterPower += 200;
    sim.radiation.pulse(this.ps.grid, this.rec.x, this.rec.z, this.rec.l | 0, 3000, 2);
  }

  dust(m, vis, mine) {
    const sim = this.ps.sim, at = { grid: this.ps.grid, x: this.rec.x, z: this.rec.z, l: this.rec.l | 0 };
    sim.chat.visible(m, vis ?? `${m.name} reaches out and touches the ${this.name}, inducing a resonance... their body starts to glow and burst into flames before flashing into dust!`, 'danger', 14, m);
    sim.tell(m, 'danger', mine ?? 'You reach out and touch the supermatter crystal. Everything starts burning and all you can hear is ringing. Your last thought is "That was not a wise decision."');
    sim.sound('zzzt', at, 1);
    if (sim.dust(m, 'supermatter')) this.consume();
  }

  click(c, m, held) {
    const sim = this.ps.sim, at = { grid: this.ps.grid, x: this.rec.x, z: this.rec.z, l: this.rec.l | 0 };
    if (!held) { this.dust(m); return true; }
    const tool = held.def.tool;
    if (tool === 'wrench') { sim.tell(m, 'warning', `The ${this.name} is bolted down.`); return true; }
    sim.chat.visible(m, `As ${m.name} touches the ${this.name} with a ${held.name}, silence fills the room...`, 'danger', 14, m);
    sim.tell(m, 'danger', `You touch the ${this.name} with the ${held.name}, and everything suddenly goes silent.\nThe ${held.name} flashes into dust as you flinch away from the ${this.name}.`);
    consume(sim, held);
    sim.sound('zzzt', at, 1);
    this.matterPower += 200;
    sim.radiation.pulse(this.ps.grid, this.rec.x, this.rec.z, this.rec.l | 0, 150, 4);
    return true;
  }

  /** examine(): without mesons it hurts to look at it from close up. */
  examine(m) {
    const range = Math.min(7, Math.round(this.power ** 0.25));
    if (!m || !m.tile || !m.humanoid || /glasses\/meson/.test(m.worn?.glasses?.path || '')) return [];
    const d = Math.max(Math.abs(m.tile[0] - this.c), Math.abs(m.tile[1] - this.r));
    return d < range ? ['You get headaches just from looking at it.'] : [];
  }
}

/**
 * Where an emitter's beam goes. From the emitter's tile, a tile at a time the way it faces: it burns the first person it meets and stops, stops at walls and shut doors (glass lets
 * it through) and at any solid thing, bounces off reflectors (a single one only on its mirrored side, a double one on both, a box always to its own heading) and is spent in the
 * supermatter crystal, which it charges.
 */
export class EngineSim {
  constructor(ps) {
    this.ps = ps;
    this.reflectors = null;
  }

  get sm() { return this.ps.machines.supermatter[0] || null; }

  trace(e) {
    const ps = this.ps, sim = ps.sim, g = ps.grid, w = g.world;
    if (!this.reflectors) this.reflectors = reflectorsOf(g);
    const l = e.rec.l | 0;
    let c = e.c, r = e.r, ang = DIR_ANGLE[e.rec.d] ?? 180;
    const pts = [[(c + 0.5) * TILE, (r + 0.5) * TILE]];
    for (let n = 0; n < 60; n++) {
      const s = stepOf(ang);
      if (!s) break;
      c += s[0]; r += s[1];
      if (!w.inb(c, r, l)) break;
      const i = w.idx(c, r, l), mid = [(c + 0.5) * TILE, (r + 0.5) * TILE];
      const sm = this.sm;
      if (sm && sm.tile === i) { pts.push(mid); sm.hit(BEAM_DAMAGE); break; }
      const ref = this.reflectors.get(i);
      if (ref) {
        const face = DIR_ANGLE[ref.it.d] ?? 0, next = reflect(ref.type, face, ang);
        pts.push(mid);
        if (next === null) break;
        ang = next;
        continue;
      }
      if (w.kind[i] === KIND.WALL) { if (!w.glass[i]) { pts.push(mid); break; } continue; }
      if (w.blocksRay(i, 'sight')) { pts.push(mid); break; }
      const who = [...sim.mobs.values()].find((m) => !m.dead && m.grid === g && (m.l | 0) === l && m.tile[0] === c && m.tile[1] === r);
      if (who) { pts.push(mid); sim.hurt(who, BEAM_DAMAGE, 'burn', 'emitter beam'); break; }
      if (w.solid[i]) { pts.push(mid); break; }
    }
    if (pts.length < 2) pts.push([pts[0][0] + 0.1, pts[0][1] + 0.1]);
    for (let k = 1; k < pts.length; k++) {
      g.emit({ e: 'beam', a: [pts[k - 1][0], 1.0, pts[k - 1][1]], b: [pts[k][0], 1.0, pts[k][1]], col: 0x40ff60 }, { near: { at: { grid: g, x: pts[k][0], z: pts[k][1], l }, r: 60 } });
    }
  }

  /** The debug menu's engine: on loads a plasma tank into every collector and switches them and the emitters on (and warms the crystal); off puts them all out. */
  set(on) {
    const ps = this.ps, sim = ps.sim, M = ps.machines;
    for (const e of M.emitter) { if (e.welded && e.net) { e.active = on; e.powered = false; e.locked = false; e.touch(); } }
    for (const c of M.collector) {
      if (on && !c.tank) { c.tank = sim.newItem('/obj/item/tank/internals/plasma'); }
      c.active = on;
      c.touch();
    }
    if (!on && this.sm) this.sm.power = 0;
    if (on && this.sm) this.sm.power = Math.max(this.sm.power, 1400);
  }

  get running() { return this.ps.machines.collector.some((c) => c.active && c.tank) && this.ps.machines.emitter.some((e) => e.active); }
}
