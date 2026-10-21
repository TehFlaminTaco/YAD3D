/**
 * Gas, the way atmospherics.dm and gas_mixture.dm count it: moles in a volume at a temperature. A room's air is kept as moles per tile in a form that is easy to spread about
 * (`Atmos`: the pressure the gas would make at `T20C`, and a temperature of its own); a canister, a tank, a pump or a scrubber holds `Mix`es, moles in litres at a temperature `t`.
 * Both turn into each other with PV = nRT, and the transfers between them are `pump_gas_to` and `release_gas_to` of the DM. Gases of different temperatures that are mixed
 * end up at the temperature their heat (moles x specific heat x temperature) makes together.
 */
export const R_IDEAL_GAS_EQUATION = 8.31;            // code/__DEFINES/atmospherics.dm:16
export const ONE_ATMOSPHERE = 101.325;               //   :18
export const T20C = 293.15;                          //   :26
export const CELL_VOLUME = 2500;                     // litres in a tile                                    :41
export const O2STANDARD = 0.21, N2STANDARD = 0.79;   //   :33, :35
export const TANK_DEFAULT_RELEASE_PRESSURE = 16;     // what internals breathe at (tank_types: distribute_pressure)

/** The gases there are: our id, the DM's name for it (gas_types.dm). */
export const GASES = [
  ['o2', 'Oxygen'], ['n2', 'Nitrogen'], ['tox', 'Plasma'], ['co2', 'Carbon Dioxide'], ['n2o', 'Nitrous Oxide'], ['bz', 'BZ'], ['h2o', 'Water Vapor'],
];
export const GAS_IDS = GASES.map((g) => g[0]);
export const GAS_NAME = Object.fromEntries(GASES);
/** J per mole per kelvin (gas_types.dm specific_heat). */
export const SPECIFIC_HEAT = { o2: 20, n2: 20, tox: 200, co2: 30, n2o: 40, bz: 20, h2o: 40 };
export const TCMB = 2.7;                             // the temperature of space                            :20
export const T0C = 273.15;                           //   :24
export const MINIMUM_HEAT_CAPACITY = 0.0003;         //   :43

const RT = R_IDEAL_GAS_EQUATION * T20C;
/** Moles that make `kpa` in `litres` at `t` kelvin (20 degrees if not said), and the pressure `moles` make there. */
export const molesAt = (kpa, litres, t = T20C) => kpa * litres / (R_IDEAL_GAS_EQUATION * t);
export const kpaOf = (moles, litres, t = T20C) => moles * R_IDEAL_GAS_EQUATION * t / litres;
/** How many moles a tile holds for each kPa of pressure. */
export const CELL_MOLES_PER_KPA = CELL_VOLUME / RT;

/** A gas mixture in a container (gas_mixture.dm), moles of each gas in `vol` litres at `t` kelvin. */
export class Mix {
  constructor(vol, g = {}, t = T20C) {
    this.vol = vol;
    this.t = t;
    this.g = {};
    for (const id of GAS_IDS) this.g[id] = g[id] || 0;
  }

  total() { let s = 0; for (const id of GAS_IDS) s += this.g[id]; return s; }
  pressure() { return this.vol > 0 ? kpaOf(this.total(), this.vol, this.t) : 0; }
  /** The partial pressure of one gas. */
  pp(id) { return this.vol > 0 ? kpaOf(this.g[id], this.vol, this.t) : 0; }
  copy() { return new Mix(this.vol, this.g, this.t); }
  clear() { for (const id of GAS_IDS) this.g[id] = 0; }
  /** J per kelvin (heat_capacity). */
  heatCapacity() { let s = 0; for (const id of GAS_IDS) s += this.g[id] * SPECIFIC_HEAT[id]; return s; }
  /** J (thermal_energy: temperature x heat capacity). */
  thermalEnergy() { return this.t * this.heatCapacity(); }

  /** remove(amount): take `moles` out, in the proportions it holds; what comes out is its own mixture (of the same volume and the same temperature). */
  remove(moles) {
    const t = this.total(), out = new Mix(this.vol, {}, this.t);
    if (t <= 0 || moles <= 0) return out;
    const f = Math.min(1, moles / t);
    for (const id of GAS_IDS) { const m = this.g[id] * f; out.g[id] = m; this.g[id] -= m; }
    return out;
  }

  /** All of the listed gases, and nothing else (what a scrubber filters out). */
  removeGases(ids) {
    const out = new Mix(this.vol, {}, this.t);
    for (const id of ids) { out.g[id] += this.g[id]; this.g[id] = 0; }
    return out;
  }

  /** merge(): the gas of `other` is added, and the temperature is what the heat of both makes. */
  merge(other) {
    const c1 = this.heatCapacity(), c2 = other.heatCapacity();
    if (c2 > 0) {
      if (c1 > MINIMUM_HEAT_CAPACITY) { if (this.t !== other.t) this.t = (this.t * c1 + other.t * c2) / (c1 + c2); } else this.t = other.t;
    }
    for (const id of GAS_IDS) this.g[id] += other.g[id];
  }

  /** The mix at `t` kelvin has had `joules` put into it (or taken out, if negative): it is warmer (or colder). Returns the new temperature. */
  heat(joules) {
    const c = this.heatCapacity();
    if (c > MINIMUM_HEAT_CAPACITY) this.t = Math.max(TCMB, this.t + joules / c);
    return this.t;
  }

  /** A mix from a canister or tank's state in a save: { o2: kPa, ... } (as if at `t`). */
  static fill(vol, kpaByGas, t = T20C) {
    const m = new Mix(vol, {}, t);
    for (const id of GAS_IDS) if (kpaByGas[id]) m.g[id] = molesAt(kpaByGas[id], vol, t);
    return m;
  }
}

/** gas_mixture.dm pump_gas_to: move gas from `src` into `out` until `out` is at `target` kPa. (Anything with `vol`, `t`, `total()`, `pressure()`, `remove()` and `merge()` will do.) */
export function pumpGas(src, out, target) {
  const start = out.pressure();
  if (target - start < 0.01) return false;
  if (src.total() > 0) {
    out.merge(src.remove((target - start) * out.vol / (R_IDEAL_GAS_EQUATION * (src.t || T20C))));
    return true;
  }
  return false;
}

/** gas_mixture.dm release_gas_to: let gas out of `src` into `out` up to `target` kPa, never above what `src` has and never without 10 kPa to push it. */
export function releaseGas(src, out, target) {
  const outP = out.pressure(), inP = src.pressure();
  if (outP >= Math.min(target, inP - 10)) return false;
  if (src.total() > 0) {
    const delta = Math.min(target - outP, (inP - outP) / 2);
    out.merge(src.remove(delta * out.vol / (R_IDEAL_GAS_EQUATION * (src.t || T20C))));
    return true;
  }
  return false;
}

/** The gas a breath is made of when it comes from `mix` through internals (tanks.dm remove_air_volume at the tank's release pressure): the partial pressure of each gas in it, in kPa, and its temperature. */
export function breathOf(mix) {
  const p = mix.pressure(), t = mix.total();
  const out = { pressure: Math.min(TANK_DEFAULT_RELEASE_PRESSURE, p), temperature: mix.t };
  for (const id of GAS_IDS) out[id] = t > 0 ? out.pressure * mix.g[id] / t : 0;
  return out;
}

/** What each kind of canister holds (canister.dm: `maximum_pressure` 90 atmospheres, `filled` of it, in 1000 litres), by what its path ends in. */
export const CANISTER_VOLUME = 1000;
export const CAN_MAX_PRESSURE = 90 * ONE_ATMOSPHERE;
export const CANISTERS = {
  '': { name: 'canister', desc: 'A canister for the storage of gas.', gas: null, filled: 0.5 },
  nitrogen: { name: 'n2 canister', desc: 'Nitrogen gas. Reportedly useful for something.', gas: { n2: 1 }, filled: 0.5 },
  oxygen: { name: 'o2 canister', desc: 'Oxygen. Necessary for human life.', gas: { o2: 1 }, filled: 0.5 },
  carbon_dioxide: { name: 'co2 canister', desc: 'Carbon dioxide. What the fuck is carbon dioxide?', gas: { co2: 1 }, filled: 0.5 },
  toxins: { name: 'plasma canister', desc: 'Plasma gas. The reason YOU are here. Highly toxic.', gas: { tox: 1 }, filled: 0.5 },
  nitrous_oxide: { name: 'n2o canister', desc: 'Nitrous oxide gas. Known to cause drowsiness.', gas: { n2o: 1 }, filled: 0.5 },
  air: { name: 'air canister', desc: 'Pre-mixed air.', gas: { o2: O2STANDARD, n2: N2STANDARD }, filled: 0.5 },
  bz: { name: 'BZ canister', desc: 'BZ, a powerful hallucinogenic nerve agent.', gas: { bz: 1 }, filled: 0.5 },
  water_vapor: { name: 'water vapor canister', desc: 'Water Vapor. We get it, you vape.', gas: { h2o: 1 }, filled: 1 },
};

/** A new canister's gas (canister.dm create_gas): moles = maximum_pressure x filled x volume / RT, split by the gas's share. */
export function canisterMix(kind) {
  const def = CANISTERS[kind] ?? CANISTERS[''];
  const m = new Mix(CANISTER_VOLUME);
  if (!def.gas) return m;
  const total = molesAt(CAN_MAX_PRESSURE * def.filled, CANISTER_VOLUME);
  for (const [id, share] of Object.entries(def.gas)) m.g[id] = total * share;
  return m;
}

/**
 * The air alarm's idea of safe (airalarm.dm `TLV`: min2, min1, max1, max2 in kPa; -1 is "no limit"), as `danger(id, kpa)`: 0 fine, 1 warning, 2 danger.
 */
const TLV = {
  pressure: [20, 50, 325, 550],                      // HAZARD_LOW_PRESSURE, WARNING_LOW_PRESSURE, WARNING_HIGH_PRESSURE, HAZARD_HIGH_PRESSURE
  o2: [16, 19, 135, 140],
  n2: [-1, -1, 1000, 1000],
  co2: [-1, -1, 5, 10],
  temperature: [273.15, 283.15, 313.15, 339.15],     // T0C, T0C+10, T0C+40, T0C+66
  tox: [-1, -1, 0.2, 0.5], n2o: [-1, -1, 0.2, 0.5], bz: [-1, -1, 0.2, 0.5], h2o: [-1, -1, 0.2, 0.5],         // tlv/dangerous
};
export function danger(what, v) {
  const [min2, min1, max1, max2] = TLV[what];
  if (max2 !== -1 && v >= max2) return 2;
  if (min2 !== -1 && v <= min2) return 2;
  if (max1 !== -1 && v >= max1) return 1;
  if (min1 !== -1 && v <= min1) return 1;
  return 0;
}

/** The air alarm's modes (airalarm.dm get_mode_name), in the order its menu lists them (the emagged "Flood" is not offered). */
export const AIR_MODES = [
  { id: 1, name: 'Filtering' }, { id: 8, name: 'Contaminated' }, { id: 2, name: 'Draught' }, { id: 9, name: 'Refill' },
  { id: 3, name: 'Panic Siphon' }, { id: 4, name: 'Cycle' }, { id: 7, name: 'Siphon' }, { id: 5, name: 'Off' },
];
export const AIR_MODE = { SCRUBBING: 1, VENTING: 2, PANIC: 3, REPLACEMENT: 4, OFF: 5, FLOOD: 6, SIPHON: 7, CONTAMINATED: 8, REFILL: 9 };
export const airModeName = (id) => ({ ...Object.fromEntries(AIR_MODES.map((m) => [m.id, m.name])), 6: 'Flood' })[id] || 'Filtering';
