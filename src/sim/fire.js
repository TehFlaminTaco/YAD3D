import { CELL_VOLUME, T0C, MINIMUM_HEAT_CAPACITY, CELL_MOLES_PER_KPA, GAS_IDS } from '../shared/gases.js';
import { E, S } from '../shared/config.js';
import { CH } from '../shared/power.js';

// code/__DEFINES/atmospherics.dm, reactions.dm
const FIRE_MINIMUM_TEMPERATURE_TO_EXIST = 100 + T0C, FIRE_MINIMUM_TEMPERATURE_TO_SPREAD = 150 + T0C;
const FIRE_SPREAD_RADIOSITY_SCALE = 0.85, FIRE_GROWTH_RATE = 40000;
const PLASMA_MINIMUM_BURN_TEMPERATURE = 100 + T0C, PLASMA_UPPER_TEMPERATURE = 1370 + T0C;
const OXYGEN_BURN_RATE_BASE = 1.4, PLASMA_OXYGEN_FULLBURN = 10, PLASMA_BURN_RATE_DELTA = 9, FIRE_PLASMA_ENERGY_RELEASED = 3000000;
const MINIMUM_MOLE_COUNT = 0.01;
const CYCLE = 0.5;                                 // seconds between one SSair cycle and the next
const IGNITER_EVERY = 2;                           // igniter.dm process: every machine tick
const SPARKER_COOLDOWN = 5;                        // igniter.dm sparker: 50 deciseconds between sparks
const BUTTON_COOLDOWN = 3;                         // doorcontrol.dm control/igniter: 30 deciseconds
const the = (it) => `the ${it.name}`;

/** The igniter (igniter.dm): on, and with power, it sets its tile alight every two seconds (1000 K over 500 litres); a hand, or the ignition switch with its id, switches it. */
class Igniter {
  constructor(fire, g, it) {
    this.fire = fire; this.g = g; this.it = it;
    this.id = it.id && it.id !== 'null' ? it.id : null;
    this.on = /\/on(\/|$)/.test(it.path || '');
    this.v = this.on ? 1 : 0;
    it.mach = this;
  }
  get tile() { return this.g.world.idx(this.it.c, this.it.r, this.it.l | 0); }
  get powered() { return this.g.power.powered(this.g.world.areaIdx[this.tile], CH.EQUIP); }
  variant() { return this.on && this.powered ? 1 : 0; }
  touch() {
    const v = this.variant();
    if (v === this.v) return;
    this.v = v;
    this.g.emit({ e: 'pv', i: this.it.idx, v });
  }
  toggle() { this.on = !this.on; this.touch(); }
  click(c, m, held) {
    if (held) return false;
    this.toggle();                                                                  // attack_hand: it is switched, with no word said
    this.fire.sim.sound('beep', { grid: this.g, x: this.it.x, z: this.it.z, l: this.it.l | 0 }, 0.3);
    return true;
  }
}

/** The wall-mounted igniter (igniter.dm sparker): a spark that lights its tile, once every five seconds; a screwdriver cuts it off or joins it again. */
class Sparker {
  constructor(fire, g, it) {
    this.fire = fire; this.g = g; this.it = it;
    this.id = it.id && it.id !== 'null' ? it.id : null;
    this.disable = false; this.last = -1e9;
    it.mach = this;
  }
  get tile() { return this.g.world.idx(this.it.c, this.it.r, this.it.l | 0); }
  get powered() { return this.g.power.powered(this.g.world.areaIdx[this.tile], CH.EQUIP); }
  ignite() {
    const sim = this.fire.sim, it = this.it;
    if (!this.powered || this.disable || sim.time < this.last + SPARKER_COOLDOWN) return false;
    this.last = sim.time;
    sim.sound('sparks', { grid: this.g, x: it.x, z: it.z, l: it.l | 0 }, 0.6);
    this.fire.expose(this.g, this.tile, 1000, 2500);
    return true;
  }
  click(c, m, held) {
    const sim = this.fire.sim;
    if (held?.def.tool !== 'screwdriver') return false;
    this.disable = !this.disable;
    sim.chat.visible(m, `${m.name} ${this.disable ? 'disables' : 'reconnects'} ${the(this.it)}!`, 'notice', 10, m);
    sim.tell(m, 'notice', this.disable ? `You disable the connection to ${the(this.it)}.` : `You fix the connection to ${the(this.it)}.`);
    sim.sound('screwdriver', { grid: this.g, x: this.it.x, z: this.it.z, l: this.it.l | 0 }, 0.6);
    return true;
  }
}

/**
 * Plasma combustion (reactions.dm plasmafire): in a mixture at or over 373 kelvin with plasma and oxygen, plasma burns into carbon dioxide (and a quarter as much water vapor) using up 1.4 less
 * the temperature scale of oxygen for each, and gives off 3 million joules a mole: the mixture is that much hotter. The burn rate grows with the temperature (from nothing at 373 K to full at 1643 K)
 * and is limited by the plasma and by the oxygen. Returns how much fire there was (`fire` of the reaction results: what a hotspot's size is made from); `air` is changed.
 */
export function plasmaFire(air) {
  const g = air.g;
  if (air.t < FIRE_MINIMUM_TEMPERATURE_TO_EXIST || g.tox < MINIMUM_MOLE_COUNT || g.o2 < MINIMUM_MOLE_COUNT) return 0;
  const oldCap = air.heatCapacity(), t = air.t;
  const scale = t > PLASMA_UPPER_TEMPERATURE ? 1 : (t - PLASMA_MINIMUM_BURN_TEMPERATURE) / (PLASMA_UPPER_TEMPERATURE - PLASMA_MINIMUM_BURN_TEMPERATURE);
  let fire = 0, energy = 0;
  if (scale > 0) {
    const oxygenRate = OXYGEN_BURN_RATE_BASE - scale;
    let rate = g.o2 > g.tox * PLASMA_OXYGEN_FULLBURN ? (g.tox * scale) / PLASMA_BURN_RATE_DELTA : (scale * (g.o2 / PLASMA_OXYGEN_FULLBURN)) / PLASMA_BURN_RATE_DELTA;
    if (rate > MINIMUM_HEAT_CAPACITY) {
      rate = Math.min(rate, g.tox, g.o2 / oxygenRate);                    // (matter is conserved)
      g.tox -= rate; g.o2 -= rate * oxygenRate;
      g.co2 += rate; g.h2o += rate * 0.25;
      energy += FIRE_PLASMA_ENERGY_RELEASED * rate;
      fire += rate * (1 + oxygenRate);
    }
  }
  if (energy > 0) {
    const cap = air.heatCapacity();
    if (cap > MINIMUM_HEAT_CAPACITY) air.t = (t * oldCap + energy) / cap;
  }
  return fire;
}

/**
 * Fire on the tiles of the station (LINDA_fire.dm hotspots, and the reaction in each tile's air). Every half second every tile that is hot enough and holds plasma and oxygen burns in
 * itself; a **hotspot** (a small fire that something started: a lit welding tool, an igniter, another fire) takes the share of the tile's gas it covers, heats it to its own temperature, lets
 * it react, and is as big as the fire it made; once it fills the tile it **spreads**: it exposes each neighbouring tile to 85% of the tile's temperature. A hotspot dies when it has nothing to burn
 * or is under 373 K. What fire does to people is the heat of the air (body temperature, body.js); what it looks like is the `fire` event and `level.fireSprites`.
 */
export class Fire {
  constructor(sim) {
    this.sim = sim;
    this.acc = 0;
    this.igniterAcc = 0;
  }

  /** hotspot_expose: tile `i` of grid `g` is exposed to `temperature` kelvin over `volume` litres: a fire starts if it holds plasma and oxygen and that is hot enough (or a fire already there grows, with `sustain`). */
  expose(g, i, temperature, volume, sustain = false) {
    const a = g.atmos;
    if (!a.isCell[i] || g.world.airBlock[i]) return;
    const moles = (k) => a.arrs[k][i] * CELL_MOLES_PER_KPA;
    const oxy = moles(GAS_IDS.indexOf('o2'));
    if (oxy < 0.5) return;
    const tox = moles(GAS_IDS.indexOf('tox'));
    const fires = (g.fires ??= new Map()), f = fires.get(i);
    if (f) {
      if (sustain && tox > 0.5) { if (f.temp < temperature) f.temp = temperature; if (f.vol < volume) f.vol = volume; }
      return;
    }
    if (temperature > PLASMA_MINIMUM_BURN_TEMPERATURE && tox > 0.5) {
      const born = { vol: volume * 25, temp: temperature, just: true, st: 1 };
      fires.set(i, born);
      (g.fireOn ??= new Set()).add(i);
      this.burn(g, i, born);                                                // (Initialize -> perform_exposure: it burns what it covers at once, while `just_spawned`)
    }
  }

  /** perform_exposure, the part for a hotspot that does not fill its tile (or is new): it takes its share of the tile's gas, heats it to its own temperature and lets it react; it is as big as the fire that made. */
  burn(g, i, f) {
    const cell = g.atmos.cell(i);
    const affected = cell.remove(Math.min(1, f.vol / CELL_VOLUME) * cell.total());
    affected.t = f.temp;
    const fire = plasmaFire(affected);
    f.temp = affected.t;
    f.vol = fire * FIRE_GROWTH_RATE;
    cell.merge(affected);
  }

  /** The same for a point in the grid's frame (what holds a flame there: a welding tool in a hand). */
  exposeAt(g, x, z, l, temperature, volume) {
    const w = g.world, c = Math.floor(x / 2), r = Math.floor(z / 2);
    if (w.inb(c, r, l)) this.expose(g, w.idx(c, r, l), temperature, volume);
  }

  /** The tiles next to `i` that its air can reach. */
  neighbours(g, i) {
    const w = g.world, edge = w.edge, out = [];
    if (i + 1 < w.n && g.atmos.isCell[i + 1] && !(edge[i] & E) && (i % w.W) + 1 < w.W) out.push(i + 1);
    if ((i % w.W) > 0 && g.atmos.isCell[i - 1] && !(edge[i - 1] & E)) out.push(i - 1);
    if (i + w.W < w.n && g.atmos.isCell[i + w.W] && !(edge[i] & S)) out.push(i + w.W);
    if (i - w.W >= 0 && g.atmos.isCell[i - w.W] && !(edge[i - w.W] & S)) out.push(i - w.W);
    return out;
  }

  update(dt) {
    this.acc += dt;
    this.igniterAcc += dt;
    if (this.acc < CYCLE) return;
    const step = this.acc; this.acc = 0;
    void step;
    const igniters = this.igniterAcc >= IGNITER_EVERY;
    if (igniters) this.igniterAcc = 0;
    for (const g of this.sim.grids.values()) {
      if (igniters) this.igniters(g);
      if (!(g.fires?.size) && !g.atmos.warm.size) continue;
      this.cycle(g);
    }
  }

  /** The grid is made: its igniters and mounted igniters (the map's `machinery/igniter`, `igniter/on` for those that start on, and `machinery/sparker`) become machines. */
  attach(g) {
    g.igniterList = []; g.sparkerList = [];
    for (const it of g.props.interact) {
      const p = (it.path || '').replace(/^\//, '');
      if (/^machinery\/igniter/.test(p)) g.igniterList.push(new Igniter(this, g, it));
      else if (/^machinery\/sparker/.test(p)) g.sparkerList.push(new Sparker(this, g, it));
    }
  }

  /** Every two seconds each lit igniter that has power exposes its tile to 1000 kelvin (igniter.dm process). */
  igniters(g) {
    for (const d of g.igniterList || []) {
      if (d.it.gone || !d.on || !d.powered) continue;
      this.expose(g, d.tile, 1000, 500);
    }
  }

  /** An ignition switch (`button/ignition`) is pressed: the mounted igniters with its id spark, the igniters with its id are switched. Returns false if it is not one. */
  button(m, it) {
    if (!/button\/ignition/.test(it.path || '')) return false;
    const sim = this.sim, g = it.grid;
    sim.sound('terminal_key', it, 0.6);
    if (sim.time < (it.cool ?? 0)) return true;
    it.cool = sim.time + BUTTON_COOLDOWN;
    if (!it.id) return true;
    for (const s of g.sparkerList || []) if (s.id === it.id) s.ignite();
    for (const d of g.igniterList || []) if (d.id === it.id && !d.it.gone) d.toggle();
    return true;
  }

  cycle(g) {
    const a = g.atmos, fires = (g.fires ??= new Map());
    const result = new Map();                                                // what each tile's own reaction made, this cycle
    // every hot tile with plasma and oxygen burns in itself
    for (const i of [...a.warm]) {
      if (a.temp[i] < FIRE_MINIMUM_TEMPERATURE_TO_EXIST || !a.isCell[i] || g.world.airBlock[i]) continue;
      const cell = a.cell(i), air = cell.remove(cell.total());
      const fire = plasmaFire(air);
      cell.merge(air);
      if (fire > 0) {
        result.set(i, fire);
        if (a.temp[i] > FIRE_MINIMUM_TEMPERATURE_TO_EXIST) this.expose(g, i, a.temp[i], CELL_VOLUME);
      }
    }
    // the hotspots
    const gone = [], on = [];
    for (const [i, f] of [...fires]) {
      if (f.just) { f.just = false; continue; }
      const cell = a.cell(i);
      const moles = (id) => a.arrs[GAS_IDS.indexOf(id)][i] * CELL_MOLES_PER_KPA;
      if (f.temp < FIRE_MINIMUM_TEMPERATURE_TO_EXIST || f.vol <= 1 || moles('o2') < 0.5 || moles('tox') < 0.5 || g.world.airBlock[i]) { fires.delete(i); gone.push(i); continue; }
      const bypassing = f.vol > CELL_VOLUME * 0.95;
      if (bypassing) {
        f.vol = (result.get(i) ?? 0) * FIRE_GROWTH_RATE;
        f.temp = a.temp[i];
      } else this.burn(g, i, f);
      let st = bypassing ? 3 : f.vol > CELL_VOLUME * 0.4 ? 2 : 1;
      if (st !== f.st) { f.st = st; on.push([i, st]); }
      if (bypassing && a.temp[i] > FIRE_MINIMUM_TEMPERATURE_TO_SPREAD) {       // radiated heat lights the tiles next to it
        const radiated = a.temp[i] * FIRE_SPREAD_RADIOSITY_SCALE;
        for (const j of this.neighbours(g, i)) if (!fires.has(j)) this.expose(g, j, radiated, CELL_VOLUME / 4);
      }
    }
    // the ones that started, the ones that went out
    if (g.fireOn?.size) { for (const i of g.fireOn) if (fires.has(i)) on.push([i, fires.get(i).st]); g.fireOn.clear(); }
    if (on.length || gone.length) g.emit({ e: 'fire', on, off: gone });
  }

  /** What a joiner is told: the fires and how big. */
  state(g) { return [...(g.fires || [])].map(([i, f]) => [i, f.st]); }
}
