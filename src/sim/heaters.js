import { T20C, T0C, TCMB } from '../shared/gases.js';
import { cellMax } from '../shared/powerdata.js';
import { place, putInHands, consume } from './inventory.js';
import { esc } from '../shared/util.js';

// spaceheater.dm, with the lowest grade of parts (a micro laser and a capacitor of rating 1)
const HEATING_POWER = 40000;                       // J a process: laser x 40,000
const EFFICIENCY = 20000;                          // (capacitor + 1) x 10,000: joules of heat for each unit of charge
const TEMPERATURE_TOLERANCE = 1;
const MEDIAN = 30 + T0C, RANGE = 30;               // settableTemperatureMedian, settableTemperatureRange (capacitor x 30)
const MIN_TARGET = Math.max(MEDIAN - RANGE, TCMB), MAX_TARGET = MEDIAN + RANGE;
const PROCESS = 2;                                 // SSmachines
const MODES = ['off', 'standby', 'heat', 'cool'];
const isCell = (it) => !!it && !!it.def.cell && it.path.startsWith('/obj/item/stock_parts/cell');
const the = (it) => `the ${it.name}`;
const The = (it) => `The ${it.name}`;

/**
 * A space heater (spaceheater.dm): a loose machine with a power cell of its own (it uses no area power) that heats or cools the air of the tile it stands on, towards a target temperature,
 * 40 kJ at the most every two seconds, using up a unit of charge for every 20 kJ. Its hatch is opened with a screwdriver to set the target or change the cell.
 */
class SpaceHeater {
  constructor(heaters, g, it) {
    this.heaters = heaters; this.g = g; this.it = it;
    this.on = false; this.mode = 1;                                 // MODES[mode]: off / standby / heat / cool, what it is doing
    this.setMode = 'auto';                                          // what it is allowed to do: auto, heat or cool
    this.target = T20C;
    this.panelOpen = false;
    this.cell = { charge: cellMax('/obj/item/stock_parts/cell'), max: cellMax('/obj/item/stock_parts/cell'), path: '/obj/item/stock_parts/cell' };
    this.v = 0; this.rev = 0;
    it.mach = this;
  }

  get sim() { return this.heaters.sim; }
  get tile() { return this.g.world.idx(Math.floor(this.it.x / 2), Math.floor(this.it.z / 2), this.it.l | 0); }
  get at() { return { grid: this.g, x: this.it.x, z: this.it.z, l: this.it.l | 0 }; }
  air() { const a = this.g.atmos, i = this.tile; return a.isCell[i] && !this.g.world.airBlock[i] ? i : -1; }

  /** Which of its eight pictures: off, standby, heating or cooling, and the same with the hatch open. */
  variant() { return (this.on ? this.mode : 0) + (this.panelOpen ? 4 : 0); }
  touch() {
    this.rev++;
    const v = this.variant();
    if (v === this.v) return;
    this.v = v;
    this.g.emit({ e: 'pv', i: this.it.idx, v });
  }

  /** process(): every two seconds while it is on. */
  process() {
    if (!this.on) return;
    if (!(this.cell && this.cell.charge > 0)) { this.on = false; this.touch(); return; }
    const i = this.air(), a = this.g.atmos;
    if (i < 0) { if (this.mode !== 1) { this.mode = 1; this.touch(); } return; }
    const temp = a.temp[i];
    let mode = 1;
    if (this.setMode !== 'cool' && temp < this.target - TEMPERATURE_TOLERANCE) mode = 2;
    else if (this.setMode !== 'heat' && temp > this.target + TEMPERATURE_TOLERANCE) mode = 3;
    if (mode !== this.mode) { this.mode = mode; this.touch(); }
    if (mode === 1) return;
    const cap = a.heatCap(i);
    if (!(cap > 0)) return;
    const required = Math.min(Math.abs(temp - this.target) * cap, HEATING_POWER);
    if (required < 1) return;
    a.heat(i, mode === 3 ? -required : required);
    this.cell.charge = Math.max(0, this.cell.charge - required / EFFICIENCY);
  }

  examine() {
    const out = [`${The(this.it)} is ${this.on ? 'on' : 'off'}, and the hatch is ${this.panelOpen ? 'open' : 'closed'}.`];
    out.push(this.cell ? `The charge meter reads ${Math.round(100 * this.cell.charge / this.cell.max)}%.` : 'There is no power cell installed.');
    out.push(`The status display reads: Temperature range at ${RANGE}°C. Heating power at ${HEATING_POWER * 0.001}kJ. Power consumption at ${Math.round(EFFICIENCY * -0.0025 + 150)}%.`);
    return out;
  }

  click(c, m, held) {
    const sim = this.sim, it = this.it;
    const say = (text, kind = 'notice') => sim.tell(m, kind, text);
    const others = (text) => sim.chat.visible(m, text, 'notice', 10, m);
    if (isCell(held)) {                                                           // attackby: a power cell goes in, with the hatch open
      if (!this.panelOpen) say('The hatch must be open to insert a power cell!', 'warning');
      else if (this.cell) say('There is already a power cell inside!', 'warning');
      else {
        this.cell = { charge: Math.min(held.charge ?? cellMax(held.path), cellMax(held.path)), max: cellMax(held.path), path: held.path };
        consume(sim, held);
        others(`${m.name} inserts a power cell into ${the(it)}.`);
        say(`You insert the power cell into ${the(it)}.`);
        this.touch();
      }
      return true;
    }
    if (held?.def.tool === 'screwdriver') {
      this.panelOpen = !this.panelOpen;
      others(`${m.name} ${this.panelOpen ? 'opens' : 'closes'} the hatch on ${the(it)}.`);
      say(`You ${this.panelOpen ? 'open' : 'close'} the hatch on ${the(it)}.`);
      sim.sound('screwdriver', this.at, 0.7);
      this.touch();
      return true;
    }
    if (held) return false;                                                       // (a wrench is the anchoring's)
    sim.terminals.open(c, 'portable', { machine: this, grid: this.g, name: this.it.name });
    return true;
  }

  console(c) {
    const i = this.air(), a = this.g.atmos, cur = i >= 0 ? a.temp[i] : null;
    const status = !this.on ? '<span class="w">Off</span>' : `<span class="c">${MODES[this.mode] === 'standby' ? 'Standby' : MODES[this.mode] === 'heat' ? 'Heating' : 'Cooling'}</span>`;
    const set = (t) => { if (this.panelOpen) { this.target = Math.max(MIN_TARGET, Math.min(MAX_TARGET, Math.round(t + T0C))); this.touch(); } };
    return {
      title: 'Space Heater', live: true,
      html: `<span class="h">${esc(this.it.name)}</span>   <span class="d">hatch ${this.panelOpen ? 'open' : 'closed'}</span>\n\nPower             ${this.on ? '<span class="c">On</span>' : '<span class="w">Off</span>'}   ${status}\nAllowed           ${this.setMode === 'auto' ? 'Auto' : this.setMode === 'heat' ? 'Heat only' : 'Cool only'}\nPower cell        ${this.cell ? `${Math.round(100 * this.cell.charge / this.cell.max)}%` : '<span class="b">none</span>'}\nTarget            ${Math.round(this.target - T0C)} °C  <span class="d">(${Math.round(MIN_TARGET - T0C)} to ${Math.round(MAX_TARGET - T0C)}${this.panelOpen ? '' : ', open the hatch to set it'})</span>\nRoom              ${cur === null ? 'N/A' : `${Math.round(cur - T0C)} °C`}`,
      buttons: [
        { label: this.on ? 'Turn off' : 'Turn on', fn: () => { this.on = !this.on; this.mode = 1; this.sim.chat.visible(c.mob, `${c.mob.name} switches ${this.on ? 'on' : 'off'} ${the(this.it)}.`, 'notice', 10, c.mob); this.sim.tell(c.mob, 'notice', `You switch ${this.on ? 'on' : 'off'} ${the(this.it)}.`); this.touch(); } },
        ...['auto', 'heat', 'cool'].map((mode) => ({ label: `Mode: ${mode}`, disabled: this.setMode === mode, fn: () => { this.setMode = mode; this.touch(); } })),
        ...(this.panelOpen ? [-10, -1, 1, 10].map((s) => ({ label: s > 0 ? `+${s}` : `${s}`, fn: () => set(this.target - T0C + s) })) : []),
        { label: 'Eject cell', disabled: !(this.panelOpen && this.cell), fn: () => this.eject(c.mob) },
      ],
    };
  }

  /** The power cell comes out into your hands. */
  eject(m) {
    if (!(this.panelOpen && this.cell)) return;
    const item = this.sim.newItem(this.cell.path);
    item.charge = this.cell.charge;
    this.cell = null;
    if (m) putInHands(this.sim, m, item); else place(this.sim, item, this.g, this.it.x, this.it.z, undefined, this.it.l | 0);
    this.touch();
  }
}

/** The space heaters of the map: loose machines that stand about. */
export class SpaceHeaters {
  constructor(sim) {
    this.sim = sim;
    this.acc = 0;
  }

  attach(g) {
    g.heaterList = [];
    for (const it of g.props.interact) if (/^machinery\/space_heater/.test((it.path || '').replace(/^\//, ''))) g.heaterList.push(new SpaceHeater(this, g, it));
  }

  update(dt) {
    this.acc += dt;
    if (this.acc < PROCESS) return;
    this.acc -= PROCESS;
    for (const g of this.sim.grids.values()) for (const h of g.heaterList || []) if (h.on && !h.it.gone) h.process();
  }
}
