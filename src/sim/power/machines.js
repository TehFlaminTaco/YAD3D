import { CELLRATE, CHARGELEVEL, SMESRATE, SOLAR_GEN_RATE, CELLS, APC_STATES } from '../../shared/powerdata.js';
import { CH } from '../../shared/power.js';
import { place } from '../inventory.js';
import { consume } from '../inventory.js';
import { apcClick } from './apckit.js';

/** How the DM writes a power (unsorted.dm DisplayPower): W, kW, MW, GW. */
export function displayPower(w) {
  if (w < 1000) return `${Math.round(w)} W`;
  if (w < 1e6) return `${Math.round(w * 0.001 * 1000) / 1000} kW`;
  if (w < 1e9) return `${Math.round(w * 1e-6 * 1000) / 1000} MW`;
  return `${Math.round(w * 1e-9 * 10000) / 10000} GW`;
}
/** And an energy in cell units (DisplayEnergy: a unit is a kilojoule). */
export function displayEnergy(u) { return displayPower(u * 1000).replace(' W', ' J').replace(' kW', ' kJ').replace(' MW', ' MJ').replace(' GW', ' GJ'); }

/**
 * A machine on the grid: it sits on a tile, and its network is the one the cable on that tile belongs to. One with several pictures (an APC with its cover open, a running
 * emitter) says which in `variant()`, and `touch()` tells everyone when that changed (the `pv` event: the prop record's `sv` lists the pictures).
 */
export class Machine {
  constructor(ps, tile, rec) {
    this.ps = ps; this.tile = tile; this.rec = rec;
    this.c = rec.c; this.r = rec.r;
    this.broken = false;
    this.rev = 0;                                         // counts changes, so a timed job notices the machine was worked on meanwhile
    this.v = 0;                                           // which picture it shows
  }

  get net() { return this.ps.cables.net(this.tile); }
  get area() { return this.ps.world.areaIdx[this.tile]; }
  process() {}
  click() { return false; }
  variant() { return 0; }

  touch() {
    this.rev++;
    const v = this.variant();
    if (v === this.v) return;
    this.v = v;
    this.ps.grid.emit({ e: 'pv', i: this.rec.idx, v });
  }
}

/** The underfloor connector an SMES takes its power in through (terminal.dm): only a place on the map. */
export class Terminal extends Machine {
  constructor(ps, tile, rec) { super(ps, tile, rec); this.dir = rec.d; }
}

/**
 * The APC (apc.dm): a cell, a breaker and three channels for one room. Each power tick it reads the room's load, draws it from the cell (and the grid, if there is any spare),
 * charges the cell from the rest, and sets the room's channels: all on while the cell is healthy, lighting and equipment going off as it runs down (below 30%, 15%, 0).
 * `process` is apc.dm process() line by line.
 */
export class Apc extends Machine {
  constructor(ps, tile, rec, areaIdx, cellType) {
    super(ps, tile, rec);
    this.areaIdx = areaIdx;
    this.name = rec.n || 'APC';
    const max = CELLS[cellType] || CELLS.upgraded;
    this.cellType = CELLS[cellType] ? cellType : 'upgraded';
    this.cell = { charge: max * 0.9, max, path: `/obj/item/stock_parts/cell/${this.cellType}` };               // start_charge 90 (apc.dm:67)
    this.frame = true;                                    // it hangs on the wall (cut away with a welder, put back with an APC frame)
    this.opened = 0;                                      // the cover: 0 closed, 1 open, 2 gone (APC_COVER_*)
    this.coverlocked = true;
    this.panelOpen = false;                               // the wires exposed (a screwdriver on the closed cover)
    this.electronics = 2;                                 // the board: 0 missing, 1 installed, 2 secured (APC_ELECTRONICS_*)
    this.terminal = true;                                 // wired to its terminal: without one it has no line (main 0)
    this.v = 0;                                           // which picture it shows (index into APC_STATES, -1 for no frame)
    this.operating = true;
    this.chan = [3, 3, 3];                               // equipment, lighting, environment
    this.charging = 0;                                    // 0 not, 1 charging, 2 fully charged
    this.chargemode = true;
    this.main = 0;
    this.longtermpower = 10;
    this.chargecount = 0;
    this.failureTimer = 0;
    this.shorted = false;
    this.locked = true;
    this.lastused = [0, 0, 0];
    this.alarm = false;                                   // the Station Alerts console: this APC has a power alarm
  }

  get area() { return this.areaIdx; }                    // (the room it controls: not always the one its tile is in)
  get percent() { return this.cell ? 100 * this.cell.charge / this.cell.max : 0; }
  get net() { return this.terminal && this.frame ? this.ps.cables.net(this.tile) : null; }
  get maint() { return this.electronics !== 2; }         // machine_stat & MAINT: no board, or not screwed down

  /** Which of its pictures it shows (apc.dm update_icon). */
  variant() {
    if (!this.frame) return -1;
    const cell = !!this.cell;
    let s;
    if (this.opened === 1) s = this.broken || this.maint ? 'apcmaint' : cell ? 'apc2' : 'apc1';
    else if (this.opened === 2) s = `${cell ? 'apc2' : 'apc1'}${this.broken ? '-b' : ''}-nocover`;
    else if (this.broken) s = 'apc-b';
    else if (this.panelOpen) s = 'apcewires';
    else s = 'apc0';
    return APC_STATES.indexOf(s);
  }

  /** apc.dm set_broken: the breaker falls open, the frame is wrecked, and its room goes dark. */
  setBroken() {
    if (this.broken || !this.frame) return false;
    this.operating = false;
    this.broken = true;
    this.publish(true);
    this.ps.sim.sound('sparks', { grid: this.ps.grid, x: this.rec.x, z: this.rec.z, l: this.rec.l | 0 }, 0.8);
    this.touch();
    return true;
  }

  /** apc.dm Destroy: the frame is cut from the wall; its cell goes with it and its room is left with no power from it. */
  takeOffWall() {
    this.frame = false; this.operating = false; this.cell = null; this.charging = 0; this.opened = 1;
    this.publish(true);
    this.touch();
  }

  /** Whole again, as the map had it, with a full cell and the breaker on (the debug menu's repair). */
  restore() {
    this.frame = true; this.opened = 0; this.coverlocked = true; this.panelOpen = false; this.electronics = 2; this.terminal = true;
    this.broken = false; this.shorted = false; this.operating = true; this.failureTimer = 0; this.chan = [3, 3, 3];
    this.cell = { charge: CELLS[this.cellType], max: CELLS[this.cellType], path: `/obj/item/stock_parts/cell/${this.cellType}` };
    this.publish(true);
    this.touch();
  }

  /** A new APC on its wall (apc.dm New with building): cover open, no board, no cell, no wiring, the breaker off. */
  putOnWall() {
    this.frame = true; this.opened = 1; this.coverlocked = true; this.panelOpen = false; this.electronics = 0; this.terminal = false;
    this.cell = null; this.broken = false; this.shorted = false; this.operating = false; this.locked = true; this.failureTimer = 0;
    this.charging = 0; this.chargecount = 0; this.longtermpower = 10; this.chan = [3, 3, 3];
    this.publish(true);
    this.touch();
  }

  /** What the cell is as an item (it keeps its charge). */
  cellItem() {
    const it = this.ps.sim.newItem(this.cell.path);
    it.charge = this.cell.charge;
    return it;
  }

  /** apc.dm examine(). */
  examine() {
    if (!this.frame) return [];
    if (this.broken) return [];
    const out = [];
    if (this.opened) {
      if (this.electronics && this.terminal) out.push(`The cover is ${this.opened === 2 ? 'removed' : 'open'} and the power cell is ${this.cell ? 'installed' : 'missing'}.`);
      else out.push(`It's ${this.terminal ? '' : 'not '}wired up.`, `The electronics are${this.electronics ? '' : "n't"} installed.`);
    } else if (this.maint) out.push("The cover is closed. Something is wrong with it. It doesn't work.");
    else out.push('The cover is closed.');
    out.push(`Alt-Click the APC to ${this.locked ? 'unlock' : 'lock'} the interface.`);
    return out;
  }

  /** apc.dm autoset: val 0 off, 1 off (auto), 2 on, 3 on (auto); on 0 off, 1 on, 2 auto-off. */
  static autoset(val, on) {
    if (on === 0) return val === 2 ? 0 : val === 3 ? 1 : val;
    if (on === 1) return val === 1 ? 3 : val;
    if (on === 2) return val === 3 ? 1 : val;
    return val;
  }

  /** apc.dm setsubsystem: what a channel switch asks for (1 is "off") becomes. */
  setsubsystem(val) {
    if (this.cell && this.cell.charge > 0) return val === 1 ? 0 : val;
    return val === 3 ? 1 : 0;
  }

  process() {
    const ps = this.ps;
    if (!this.frame) return;
    if (this.broken) { this.publish(); return; }
    if (this.maint) return;                              // (apc.dm process: in maintenance it does nothing, and its room stays as it was)
    if (this.failureTimer > 0) { this.failureTimer--; this.publish(true); return; }
    this.lastused = ps.areaUse(this.areaIdx);
    const used = this.lastused[0] + this.lastused[1] + this.lastused[2];
    const net = this.net;
    const excess = net ? net.surplus() : 0;
    this.main = net && net.avail > 0 ? 2 : 0;             // (main_status 1, "excess < load", can never happen: surplus() is clamped at 0)
    const cell = this.cell;
    let alarm = false;
    if (cell && !this.shorted) {
      const cellused = Math.min(cell.charge, CELLRATE * used);
      cell.charge -= cellused;
      if (excess > used) {                               // spare power: the cell gets back what it just gave
        cell.charge = Math.min(cell.max, cell.charge + cellused);
        net.addLoad(cellused / CELLRATE);
      } else if (cell.charge / CELLRATE + excess >= used) {          // the cell and the grid together can cover it
        cell.charge = Math.min(cell.max, cell.charge + CELLRATE * excess);
        if (net) net.addLoad(excess);
        this.charging = 0;
      } else {                                           // not enough to run the last tick: the auto channels go off
        this.charging = 0; this.chargecount = 0;
        for (let k = 0; k < 3; k++) this.chan[k] = Apc.autoset(this.chan[k], 0);
      }
      if (this.charging && this.longtermpower < 10) this.longtermpower += 1;
      else if (this.longtermpower > -10) this.longtermpower -= 2;
      const pct = this.percent;
      if (cell.charge <= 0) { for (let k = 0; k < 3; k++) this.chan[k] = Apc.autoset(this.chan[k], 0); alarm = true; }
      else if (pct < 15 && this.longtermpower < 0) { this.chan[0] = Apc.autoset(this.chan[0], 2); this.chan[1] = Apc.autoset(this.chan[1], 2); this.chan[2] = Apc.autoset(this.chan[2], 1); alarm = true; }
      else if (pct < 30 && this.longtermpower < 0) { this.chan[0] = Apc.autoset(this.chan[0], 2); this.chan[1] = Apc.autoset(this.chan[1], 1); this.chan[2] = Apc.autoset(this.chan[2], 1); alarm = true; }
      else { for (let k = 0; k < 3; k++) this.chan[k] = Apc.autoset(this.chan[k], 1); }
      if (this.chargemode && this.charging === 1 && this.operating) {      // trickle-charge the cell
        if (excess > 0) {
          const ch = Math.min(excess * CELLRATE, cell.max * CHARGELEVEL);
          net.addLoad(ch / CELLRATE);
          cell.charge = Math.min(cell.max, cell.charge + ch);
        } else { this.charging = 0; this.chargecount = 0; }
      }
      if (cell.charge >= cell.max) { cell.charge = cell.max; this.charging = 2; }
      if (this.chargemode) {
        if (!this.charging) {
          if (excess > cell.max * CHARGELEVEL) this.chargecount++; else this.chargecount = 0;
          if (this.chargecount === 10) { this.chargecount = 0; this.charging = 1; }
        }
      } else { this.charging = 0; this.chargecount = 0; }
    } else {                                              // no cell: everything off
      this.charging = 0; this.chargecount = 0;
      for (let k = 0; k < 3; k++) this.chan[k] = Apc.autoset(this.chan[k], 0);
      alarm = true;
    }
    this.alarm = alarm;
    this.publish();
  }

  /** apc.dm update(): tell the room. */
  publish(force = false) {
    const on = this.operating && !this.shorted && !this.failureTimer && !this.broken && this.frame ? 1 : 0;
    this.ps.setArea(this.areaIdx, on, this.chan[0], this.chan[1], this.chan[2], this.main, force);
  }

  /** The grid fails for `sec` power ticks (apc.dm energy_fail). */
  energyFail(ticks) { this.failureTimer = Math.max(this.failureTimer, Math.round(ticks)); this.publish(true); }

  /** A click: the cover, the board, the cell and the wires (src/sim/power/apckit.js), or its console. */
  click(c, m, held, alt) { return apcClick(this, c, m, held, alt); }
}

/**
 * The SMES (smes.dm): it takes power in through its terminal (up to `inputLevel`, from whatever the network on that side has spare) and puts it out onto its own tile's
 * network (up to `outputLevel`). Charge is in units where a tick at W watts moves W * SMESRATE of it.
 */
export class Smes extends Machine {
  constructor(ps, tile, rec, o) {
    super(ps, tile, rec);
    this.name = rec.n || 'power storage unit';
    this.capacity = o.capacity;
    this.charge = Math.min(o.charge, o.capacity);
    this.inputAttempt = true; this.inputting = true; this.inputLevel = 50000; this.inputLevelMax = 200000; this.inputAvailable = 0;
    this.outputAttempt = true; this.outputting = true; this.outputLevel = 50000; this.outputLevelMax = 200000; this.outputUsed = 0;
    this.termTile = -1;
  }

  get inNet() { return this.termTile >= 0 ? this.ps.cables.net(this.termTile) : null; }
  get percent() { return 100 * this.charge / this.capacity; }

  process() {
    if (this.broken) return;
    const nin = this.inNet, nout = this.net;
    if (nin && this.inputAttempt) {
      this.inputAvailable = nin.surplus();
      if (this.inputting) {
        if (this.inputAvailable > 0) {
          const load = Math.min(Math.min((this.capacity - this.charge) / SMESRATE, this.inputLevel), this.inputAvailable);
          this.charge += load * SMESRATE;
          nin.addLoad(load);
        } else this.inputting = false;
      } else if (this.inputAvailable > 0) this.inputting = true;
    } else this.inputting = false;
    if (this.outputAttempt) {
      if (this.outputting) {
        this.outputUsed = Math.min(this.charge / SMESRATE, this.outputLevel);
        if (nout) { nout.addAvail(this.outputUsed); this.charge -= this.outputUsed * SMESRATE; } else this.outputting = false;
        if (this.outputUsed < 0.0001) this.outputting = false;
      } else if (this.charge > this.outputLevel && this.outputLevel > 0) this.outputting = true;
      else this.outputUsed = 0;
    } else this.outputting = false;
  }

  /** What the network did not use of this SMES's output goes back in (smes.dm restore). */
  restore(net) {
    if (this.broken) return;
    if (!this.outputting) { this.outputUsed = 0; return; }
    let excess = net.netexcess;
    excess = Math.min(this.outputUsed, excess);
    excess = Math.min((this.capacity - this.charge) / SMESRATE, excess);
    this.charge += excess * SMESRATE;
    net.netexcess -= excess;
    this.outputUsed -= excess;
  }

  click(c) { this.ps.sim.terminals.open(c, 'smes', { machine: this, grid: this.ps.grid }); return true; }
}

/** A solar panel (solar.dm): it makes SOLAR_GEN_RATE times the cosine of the angle between its facing and the sun, if it is in sun. */
export class Solar extends Machine {
  constructor(ps, tile, rec) { super(ps, tile, rec); this.gen = 0; }
  process() {
    if (this.broken) { this.gen = 0; return; }
    const net = this.net;
    const control = this.control;
    const az = control ? control.azimuth : 0;
    const frac = Math.max(0, Math.min(1, Math.round(Math.cos((az - this.ps.sim.sun.azimuth) * Math.PI / 180) * 100) / 100));
    this.gen = SOLAR_GEN_RATE * frac;
    if (net && this.gen > 0) { net.addAvail(this.gen); if (control) control.gen += this.gen; }
  }
}

export class Tracker extends Machine {}

/**
 * The solar control computer (solar.dm /obj/machinery/power/solar_control): it turns the panels on its network. Tracking off holds the angle set; timed turns it at a rate in
 * degrees an hour; auto follows the sun if a tracker is on the network.
 */
export class SolarControl extends Machine {
  constructor(ps, tile, rec) {
    super(ps, tile, rec);
    this.name = rec.n || 'solar panel control';
    this.azimuth = 0; this.track = 0; this.rate = 15;     // track: 0 off, 1 timed, 2 auto (SOLAR_TRACK_*, defines/power.dm:7-9)
    this.gen = 0; this.lastGen = 0;
    this.panels = []; this.tracker = null;
  }

  update(dt) {
    if (this.track === 2 && this.tracker) this.azimuth = this.ps.sim.sun.azimuth;
    else if (this.track === 1) this.azimuth = (this.azimuth + this.rate * dt / 3600 + 360) % 360;
  }

  click(c) { this.ps.sim.terminals.open(c, 'solar', { machine: this, grid: this.ps.grid }); return true; }
}

/**
 * The PACMAN generator (port_gen.dm): wrench it down onto a cable, feed it plasma sheets and start it: it makes `powerGen * powerOutput` watts, and burns a sheet every
 * time_per_sheet / powerOutput ticks. (The overheating of the DM is not here yet.)
 */
export class Pacman extends Machine {
  constructor(ps, tile, rec) {
    super(ps, tile, rec);
    this.name = rec.n || 'P.A.C.M.A.N.-type portable generator';
    this.active = false;
    this.sheets = 0; this.maxSheets = 50; this.sheetLeft = 0; this.timePerSheet = 260; this.consumption = 1;
    this.powerGen = 10000; this.powerOutput = 1;          // 5000 x 2 x the capacitor's rating (port_gen.dm:111)
  }

  get anchored() { return !!this.rec.anc; }                                    // (port_gen.dm: it starts loose; a wrench bolts it down, and only then is it on the cable)
  get net() { return this.anchored ? super.net : null; }
  afterAnchor(on) { this.ps.cables.dirty = true; if (!on) this.active = false; this.touch(); }

  hasFuel() { return this.sheets >= 1 / (this.timePerSheet / this.powerOutput) - this.sheetLeft; }

  useFuel() {
    let needed = 1 / (this.timePerSheet * this.consumption / this.powerOutput);
    const temp = Math.min(needed, this.sheetLeft);
    needed -= temp; this.sheetLeft -= temp;
    this.sheets -= Math.round(needed);
    needed -= Math.round(needed);
    if (this.sheetLeft <= 0 && this.sheets > 0) { this.sheetLeft = 1 - needed; this.sheets--; }
  }

  toggle() {
    if (this.active) { this.active = false; return true; }
    if (this.hasFuel() && this.anchored) { this.active = true; return true; }                     // (ready_to_boot = anchored && HasFuel)
    return false;
  }

  process() {
    if (!this.active) return;
    if (!this.hasFuel() || !this.anchored) { this.active = false; return; }
    const net = this.net;
    if (net) net.addAvail(this.powerGen * this.powerOutput);
    this.useFuel();
  }

  /** The sheets come out as a stack on the floor beside it (DropFuel). */
  eject(m) {
    if (this.active || this.sheets < 1) return;
    const sim = this.ps.sim, g = this.ps.grid, it = sim.newItem('/obj/item/stack/sheet/mineral/plasma', { amount: this.sheets });
    this.sheets = 0;
    place(sim, it, g, this.rec.x, this.rec.z, undefined, this.rec.l | 0);
  }

  click(c, m, held) {
    const sim = this.ps.sim;
    if (held?.def.tool === 'wrench') {                                                            // port_gen.dm attackby: at once, and only while it is off
      if (this.active) return true;
      const on = !this.anchored;
      sim.anchoring.set(this.ps.grid, this.rec, on);
      sim.tell(m, 'notice', `You ${on ? '' : 'un'}secure the generator ${on ? 'to' : 'from'} the floor.`);
      sim.sound('pickup', { grid: this.ps.grid, x: this.rec.x, z: this.rec.z, l: this.rec.l | 0 }, 0.5);
      return true;
    }
    if (held && /stack\/sheet\/mineral\/plasma$/.test(held.path)) {      // attackby: sheets go in (port_gen.dm:178)
      const n = Math.min(this.maxSheets - this.sheets, held.amount ?? 1);
      if (n < 1) { sim.tell(m, 'notice', `The ${this.name} is full!`); return true; }
      this.sheets += n;
      held.amount = (held.amount ?? 1) - n;
      if (held.amount <= 0) consume(sim, held);
      sim.tell(m, 'notice', `You add ${n} sheets to the ${this.name}.`);
      return true;
    }
    sim.terminals.open(c, 'pacman', { machine: this, grid: this.ps.grid });
    return true;
  }
}

export const CHANNELS = ['Equipment', 'Lighting', 'Environment'];
export { CH };
