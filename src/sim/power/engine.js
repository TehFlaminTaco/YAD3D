import { TILE, KIND } from '../../shared/config.js';
import { setPropAnchored } from '../../shared/propdata.js';
import { detach, place, consume } from '../inventory.js';
import { toolJob } from '../tooljob.js';
import { Machine, displayPower } from './machines.js';

/**
 * The engine, simplified: no gas, no temperature, no delamination (the air model has none of them). Emitters fire beams (down the reflectors of the engine room) at the supermatter
 * crystal; each hit gives it power (supermatter.dm bullet_act: damage x bullet_energy); that power leaks away (process_atmos: cubic in the power) as radiation, which the radiation
 * collectors turn into stored energy and then watts (collector.dm), if they hold a plasma tank and are switched on. The collectors are what puts power on the cable.
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
          setPropAnchored(g.world, it, anchoring);
          g.anchorLog.set(it.idx, it.anc ? 1 : 0);
          g.emit({ e: 'pa', i: it.idx, a: it.anc ? 1 : 0 });
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
    if (!(this.tank.plasma > 0)) {                                                     // out of fuel: the tank pops out
      this.ps.sim.sound('ping', { grid: this.ps.grid, x: this.rec.x, z: this.rec.z, l: this.rec.l | 0 }, 0.6);
      this.eject();
      this.out = 0;
      return;
    }
    this.tank.plasma = Math.max(0, this.tank.plasma - PLASMA_DRAIN);
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
 * The supermatter crystal (supermatter.dm), the part of it that makes power: emitter hits add to `power`, which leaks away (power -= min((power / 500)^3, 0.83 power), four times in
 * every power tick as in the DM's atmos ticks) and half the time sends a radiation pulse at the collectors. Touch it and you are dust.
 */
export class Supermatter extends Machine {
  constructor(ps, tile, rec) {
    super(ps, tile, rec);
    this.name = 'supermatter crystal';
    this.power = 0;
    this.hits = 0;
  }

  /** bullet_act: an emitter beam hit it. */
  hit(damage) { this.power += damage * BULLET_ENERGY; this.hits++; }

  process() {
    const sim = this.ps.sim, collectors = this.ps.machines.collector;
    for (let k = 0; k < 4; k++) {
      if (sim.rand() < 0.5 && this.power > 0) {
        const strength = this.power * RAD_AT_COLLECTOR;
        for (const c of collectors) c.radAct(strength);
      }
      this.power = Math.max(this.power - Math.min((this.power / 500) ** 3, this.power * 0.83), 0);
    }
  }

  /** Consume(): whatever it touches is gone. */
  dust(m, vis, mine) {
    const sim = this.ps.sim, at = { grid: this.ps.grid, x: this.rec.x, z: this.rec.z, l: this.rec.l | 0 };
    sim.chat.visible(m, vis ?? `${m.name} reaches out and touches the ${this.name}, inducing a resonance... their body starts to glow and burst into flames before flashing into dust!`, 'danger', 14, m);
    sim.tell(m, 'danger', mine ?? 'You reach out and touch the supermatter crystal. Everything starts burning and all you can hear is ringing. Your last thought is "That was not a wise decision."');
    sim.sound('zzzt', at, 1);
    sim.dust(m, 'supermatter');
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
    return true;
  }

  examine() { return []; }
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
