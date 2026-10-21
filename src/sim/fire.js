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
      fires.set(i, { vol: volume * 25, temp: temperature, just: true, st: 1 });
      (g.fireOn ??= new Set()).add(i);
    }
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

  /** The igniters of the map (`machinery/igniter`; those that start on are `igniter/on`): a lit one with power exposes its tile to 1000 kelvin (igniter.dm process). */
  igniters(g) {
    if (!g.igniterList) g.igniterList = g.props.interact.filter((it) => /^\/?machinery\/igniter/.test(it.path || ''));
    for (const it of g.igniterList) {
      if (it.gone) continue;
      it.ign ??= { on: /\/on(\/|$)/.test(it.path) };
      if (!it.ign.on || !g.power.powered(g.world.areaIdx[g.world.idx(it.c, it.r, it.l | 0)], CH.EQUIP)) continue;
      this.expose(g, g.world.idx(it.c, it.r, it.l | 0), 1000, 500);
    }
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
      } else {
        const affected = cell.remove(Math.min(1, f.vol / CELL_VOLUME) * cell.total());
        affected.t = f.temp;
        const fire = plasmaFire(affected);
        f.temp = affected.t;
        f.vol = fire * FIRE_GROWTH_RATE;
        cell.merge(affected);
      }
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
