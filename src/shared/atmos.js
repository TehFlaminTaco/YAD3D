import { TILE, KIND, N, S, E, W } from './config.js';
import { GAS_IDS, Mix, CELL_VOLUME, CELL_MOLES_PER_KPA, AIR_MODE } from './gases.js';

const STD_O2 = 21.3, STD_N2 = 80.0;
const K = 0.2;            // fraction of the pressure difference exchanged per pass
const PASSES = 7;
const TICK = 0.22;
// What a room's vents and scrubbers do in one pass, as a share of what is at the vent (the game has no pipes: each vent cell stands for a vent pump and a scrubber, and the
// room's own diffusion spreads what they do). There is a vent every fourth tile each way, so these are tuned for a room to be cleaned of plasma on Contaminated in about half
// a minute, and emptied by a Panic Siphon in about twenty seconds.
const SCRUB = 0.05, SIPHON = 0.12, PANIC = 0.3;
const BAD = ['tox', 'co2', 'n2o', 'bz', 'h2o'];                       // what a scrubber set to Contaminated filters out (everything but air)
const THIN = ['co2'];                                                 // and what it filters by default (the air alarm's Filtering mode)

/**
 * Gas simulation on the tile grid: o2/n2/tox partial pressures (kPa) diffuse between open neighbouring
 * tiles; space tiles are sinks. Closed doors / walls / glass panes block flow; a smashed window lets air through
 * and vents the station only if it touches space, and so do open external airlocks. Vents (powered) slowly top rooms up toward a breathable mixture.
 */
export class Atmos {
  constructor(world, power) {
    this.power = power;
    this.world = world;
    const n = world.n;
    this.o2 = new Float32Array(n);
    this.n2 = new Float32Array(n);
    this.tox = new Float32Array(n);
    this.co2 = new Float32Array(n);
    this.n2o = new Float32Array(n);
    this.bz = new Float32Array(n);
    this.h2o = new Float32Array(n);                    // partial pressures in kPa, per tile (`GAS_IDS` order)
    this.arrs = GAS_IDS.map((id) => this[id]);
    this.hot = GAS_IDS.map((id) => id === 'o2' || id === 'n2' || id === 'tox');         // which gases are in the air anywhere (the others are skipped until somebody lets one out)
    this.mode = new Uint8Array(world.areas.length).fill(AIR_MODE.SCRUBBING);          // what each room's air alarm has its vents and scrubbers doing
    this.isCell = new Uint8Array(n);
    this.acc = 0;
    this.pairs = new Int32Array(0);
    this.sinkCells = new Set();
    this.vents = new Int32Array(0);
    this.areaStats = new Map();
    this.statAcc = 0;
    this.pruneAcc = 0;
    this.ventsOn = true;
    this.real = false;                                 // the room's vents and scrubbers are machines on pipes (PipeNet), not the stand-ins `ventsAndScrubbers` makes of them
    this.probes = null;                                // room -> a tile of it to read its pressure by, when `real`
    this.leaking = 0;

    this.buildTopology(true);
  }

  /** (Re)derive which tiles hold gas, who neighbours whom, vents and leak points. */
  buildTopology(initial = false, fillNew = null) {
    const { world } = this;
    const { W, H, levels } = world;
    const WH = W * H, n = world.n;
    this.isCell.fill(0);
    for (let i = 0; i < n; i++) {
      const k = world.kind[i];
      // a floor holds air; so does the open air over a floor on a deck above the first (a hole through to the deck below: one room, two decks high)
      if (k === KIND.FLOOR || (i >= WH && k === KIND.SPACE && !world.covered[i] && this.isCell[i - WH])) this.isCell[i] = 1;
    }
    const pairs = [], vents = [];
    for (let l = 0; l < levels; l++) {
      for (let r = 0; r < H; r++) {
        for (let c = 0; c < W; c++) {
          const i = l * WH + r * W + c;
          if (!this.isCell[i]) continue;
          const indoor = world.roof[i] === 1;
          if (initial && indoor) { this.o2[i] = STD_O2; this.n2[i] = STD_N2; }
          if (fillNew && fillNew.has(i)) { this.o2[i] = STD_O2; this.n2[i] = STD_N2; this.tox[i] = 0; }
          if (c + 1 < W && this.isCell[i + 1]) pairs.push(i, i + 1, E);
          if (r + 1 < H && this.isCell[i + W]) pairs.push(i, i + W, S);
          if (l + 1 < levels && this.isCell[i + WH] && world.kind[i + WH] === KIND.SPACE) pairs.push(i, i + WH, 0);      // up through the open air above it
          if (indoor && (c & 3) === 1 && (r & 3) === 1 && !world.breached.has(i)) vents.push(i);
        }
      }
    }
    this.pairs = Int32Array.from(pairs);
    this.vents = Int32Array.from(vents);
    if (initial) {                                                                      // the floors that do not start with ordinary air (airless ones, the gas chambers)
      for (const [c, r, g] of world.gasInit || []) {
        if (!world.inb(c, r)) continue;
        const i = world.idx(c, r);
        if (!this.isCell[i]) continue;
        for (let k = 0; k < GAS_IDS.length; k++) { const v = g[GAS_IDS[k]] || 0; this.arrs[k][i] = v; if (v) this.hot[k] = true; }
      }
    }
    this.sinkCells.clear();
    for (let i = 0; i < n; i++) if (this.isCell[i]) { const l = Math.floor(i / WH), rem = i - l * WH; this.scanSinks(rem % W, Math.floor(rem / W), l); }
  }

  /** A cell touching a space tile (breach, open exterior airlock) leaks into it. (On a deck above the first, open air that holds air is part of the room, not space.) */
  scanSinks(c, r, l = 0) {
    const { world } = this;
    const i = world.idx(c, r, l);
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nr = r + dr;
      if (!world.inb(nc, nr, l)) continue;
      const j = world.idx(nc, nr, l);
      const k = world.kind[j];
      if ((world.isOpenSpace(nc, nr, l) && !this.isCell[j]) || k === KIND.LATTICE || (world.breached.has(j) && world.ventsToSpace(j))) { this.sinkCells.add(i); return; }
    }
  }

  // (off the edge of the array, and in the void, there is no air at all)
  /** The pressure of all the gases together in tile index `i`. */
  total(i) {
    return this.o2[i] + this.n2[i] + this.tox[i] + this.co2[i] + this.n2o[i] + this.bz[i] + this.h2o[i];
  }
  pressureAt(c, r, l = 0) {
    if (!this.world.inb(c, r, l)) return 0;
    return this.total(this.world.idx(c, r, l));
  }
  o2At(c, r, l = 0) { return this.world.inb(c, r, l) ? this.o2[this.world.idx(c, r, l)] : 0; }
  toxAt(c, r, l = 0) { return this.world.inb(c, r, l) ? this.tox[this.world.idx(c, r, l)] : 0; }
  /** Every gas's partial pressure at a tile: { o2, n2, tox, co2, n2o, bz, h2o, pressure } (all 0 off the array). */
  gasesAt(c, r, l = 0) {
    const out = { pressure: 0 };
    const i = this.world.inb(c, r, l) ? this.world.idx(c, r, l) : -1;
    for (let k = 0; k < GAS_IDS.length; k++) { out[GAS_IDS[k]] = i >= 0 ? this.arrs[k][i] : 0; out.pressure += out[GAS_IDS[k]]; }
    return out;
  }

  /** The air of tile index `i` as something a pump or a scrubber can take from and give to (see gases.js): 2500 litres. */
  cell(i) { return new CellMix(this, i); }
  pressureWorld(x, z, l = 0) { return this.pressureAt(Math.floor(x / TILE), Math.floor(z / TILE), l); }

  /**
   * Tile (c, r) changed: a window was smashed or a breach welded shut (it joins or leaves the gas grid, and what it held is gone), or the floor was changed (a tile laid or prised up:
   * it is the same room's air, so it keeps its gas).
   */
  tileChanged(c, r, l = 0) {
    const i = this.world.idx(c, r, l);
    const was = this.isCell[i];
    this.buildTopology(false);
    if (!(was && this.isCell[i])) for (const arr of this.arrs) arr[i] = 0;
  }

  /** Pressure-driven push (m/s) felt at a world position on deck `l`. */
  windAt(x, z, l = 0) {
    const c = Math.floor(x / TILE), r = Math.floor(z / TILE);
    const { world } = this;
    if (!world.inb(c, r, l)) return null;
    const p = (cc, rr) => {
      if (!world.inb(cc, rr, l)) return this.pressureAt(c, r, l);
      const i = world.idx(cc, rr, l);
      const k = world.kind[i];
      if (world.isOpenSpace(cc, rr, l) || k === KIND.LATTICE) return world.airBlock[i] ? this.pressureAt(c, r, l) : 0;
      if (!this.isCell[i] || world.airBlock[i]) return this.pressureAt(c, r, l);
      return this.total(i);
    };
    const gx = p(c + 1, r) - p(c - 1, r), gz = p(c, r + 1) - p(c, r - 1);
    const mag = Math.hypot(gx, gz);
    if (mag < 8) return null;
    const sp = Math.min(5, (mag - 8) * 0.075);
    return [-gx / mag * sp, -gz / mag * sp];
  }

  addGas(c, r, o2, n2, tox, l = 0) {
    if (!this.world.inb(c, r, l)) return;
    const i = this.world.idx(c, r, l);
    if (!this.isCell[i]) return;
    this.o2[i] += o2; this.n2[i] += n2; this.tox[i] += tox;
  }

  /** Let gas out into a tile: `kpa` is how much each gas adds to its pressure ({ co2: 40 }). A tile that holds no air (a wall, space) takes none. */
  addGases(c, r, kpa, l = 0) {
    if (!this.world.inb(c, r, l)) return false;
    const i = this.world.idx(c, r, l);
    if (!this.isCell[i]) return false;
    for (let k = 0; k < GAS_IDS.length; k++) {
      const v = kpa[GAS_IDS[k]];
      if (v) { this.arrs[k][i] += v; this.hot[k] = true; }
    }
    return true;
  }

  update(dt) {
    this.acc += dt;
    if (this.acc >= TICK) {
      this.acc = 0;
      this.step();
    }
    this.statAcc += dt;
    if (this.statAcc > 1.0) {
      this.statAcc = 0;
      this.computeAreaStats();
    }
    this.pruneAcc += dt;
    if (this.pruneAcc > 6) { this.pruneAcc = 0; this.prune(); }
  }

  step() {
    const { world } = this;
    const { airBlock, edge } = world;
    const arrs = this.arrs.filter((_, k) => this.hot[k]);
    const pairs = this.pairs;
    for (let pass = 0; pass < PASSES; pass++) {
      for (let k = 0; k < pairs.length; k += 3) {
        const a = pairs[k], b = pairs[k + 1];
        if (airBlock[a] || airBlock[b]) continue;
        const dir = pairs[k + 2];
        if (edge[a] & dir) continue;
        for (let g = 0; g < arrs.length; g++) { const arr = arrs[g], d = (arr[a] - arr[b]) * K; arr[a] -= d; arr[b] += d; }
      }
      for (const i of this.sinkCells) {
        if (airBlock[i]) continue;
        const f = 0.32;
        for (let g = 0; g < arrs.length; g++) arrs[g][i] *= 1 - f;
      }
    }
    this.ventsAndScrubbers();
    // gas can't pool in solid cells (closed doors keep what they had; walls none)
    this.leaking = this.sinkCells.size;
  }

  /**
   * The vent pumps and scrubbers of every room that has power, doing what its air alarm says (airalarm.dm apply_mode): Filtering scrubs carbon dioxide and keeps the room at an
   * atmosphere; Contaminated scrubs every foul gas (widely); Draught and Refill siphon or scrub while the vents make two or three atmospheres; Siphon and Panic Siphon take everything
   * out and shut the vents; Off stops both; Flood (emagged) runs the vents with no limit. A vent cell that is not powered, or sealed, does nothing.
   */
  ventsAndScrubbers() {
    const { world, power } = this, { airBlock } = world, areaIdx = world.areaIdx;
    const o2 = this.o2, n2 = this.n2;
    const ok = this._ok || (this._ok = new Int8Array(world.areas.length));
    ok.fill(-1);
    for (let k = 0; !this.real && k < this.vents.length; k++) {
      const i = this.vents[k];
      if (airBlock[i]) continue;
      const a = areaIdx[i];
      if (ok[a] < 0) ok[a] = power.areaPowered(a) ? 1 : 0;
      if (!ok[a]) continue;
      const mode = this.mode[a];
      // the scrubber: which gases, and how much of them
      switch (mode) {
        case AIR_MODE.SCRUBBING: case AIR_MODE.REFILL: this.scrub(i, THIN, SCRUB); break;
        case AIR_MODE.CONTAMINATED: this.scrub(i, BAD, PANIC); break;
        case AIR_MODE.VENTING: case AIR_MODE.SIPHON: this.scrub(i, GAS_IDS, SIPHON); break;
        case AIR_MODE.PANIC: case AIR_MODE.REPLACEMENT: this.scrub(i, GAS_IDS, PANIC); break;
        default: break;
      }
      // the vent: refills toward `target` atmospheres while it is below it (not at all in the modes that siphon, nor Off)
      if (!this.ventsOn) continue;
      let target = 0;
      switch (mode) {
        case AIR_MODE.SCRUBBING: case AIR_MODE.CONTAMINATED: target = 1; break;
        case AIR_MODE.VENTING: target = 2; break;
        case AIR_MODE.REFILL: target = 3; break;
        case AIR_MODE.FLOOD: target = 5; break;
        default: break;
      }
      if (!target) continue;
      const tO2 = STD_O2 * target, tN2 = STD_N2 * target;
      if (this.total(i) < tO2 + tN2 - 0.5) {
        o2[i] += (tO2 - o2[i]) * 0.28;
        n2[i] += (tN2 - n2[i]) * 0.28;
      }
    }
    // a room that was being cycled has no air left: the alarm goes back to filtering and the vents fill it again (airalarm.dm process)
    const cyc = this.cycling;
    if (cyc && cyc.size) {
      for (const a of [...cyc]) {
        const i = this.areaProbe(a);
        if (i >= 0 && this.total(i) < 5.07) { this.mode[a] = AIR_MODE.SCRUBBING; cyc.delete(a); this.onMode?.(a); }
      }
    }
  }

  /** A scrubber at tile index `i`: `frac` of each of the listed gases there goes (into the pipes: they lead nowhere here). */
  scrub(i, ids, frac) {
    for (const id of ids) { const k = GAS_IDS.indexOf(id); if (this.hot[k]) this.arrs[k][i] -= this.arrs[k][i] * frac; }
  }

  /** Some air cell in room `a`, to read its pressure by (the first vent in it), or -1. */
  areaProbe(a) {
    if (this.probes) return this.probes.get(a) ?? -1;
    const idx = this._probe || (this._probe = new Map());
    if (!idx.size) for (let k = 0; k < this.vents.length; k++) { const ar = this.world.areaIdx[this.vents[k]]; if (!idx.has(ar)) idx.set(ar, this.vents[k]); }
    return idx.get(a) ?? -1;
  }

  /** Set a room's mode (its air alarm did): Cycle is watched until the room is empty. */
  setMode(a, mode) {
    this.mode[a] = mode;
    const cyc = this.cycling || (this.cycling = new Set());
    if (mode === AIR_MODE.REPLACEMENT) cyc.add(a); else cyc.delete(a);
  }

  /** The gases that nobody has let out for a while are left out of the diffusion again (it is slow, and the arrays are big). */
  prune() {
    for (let k = 3; k < this.arrs.length; k++) {
      if (!this.hot[k]) continue;
      const arr = this.arrs[k];
      let any = false;
      for (let i = 0; i < arr.length; i++) if (arr[i] > 1e-3) { any = true; break; }
      if (!any) { arr.fill(0); this.hot[k] = false; }
    }
  }

  computeAreaStats() {
    const { world } = this;
    const sum = new Map(), cnt = new Map();
    for (let i = 0; i < world.n; i += 3) {
      if (!this.isCell[i]) continue;
      const a = world.areaIdx[i];
      sum.set(a, (sum.get(a) || 0) + this.total(i));
      cnt.set(a, (cnt.get(a) || 0) + 1);
    }
    for (const [a, s] of sum) this.areaStats.set(a, s / cnt.get(a));
  }
}

/** A tile's air as a `Mix`-like thing (gases.js): taking from it and giving to it change the tile. A tile is 2500 litres; its gases are kept as partial pressures. */
export class CellMix {
  constructor(atmos, i) { this.atmos = atmos; this.i = i; this.vol = CELL_VOLUME; }
  total() { return this.atmos.total(this.i) * CELL_MOLES_PER_KPA; }
  pressure() { return this.atmos.total(this.i); }
  pp(id) { return this.atmos[id][this.i]; }
  remove(moles) {
    const a = this.atmos, i = this.i, t = this.total(), out = new Mix(this.vol);
    if (t <= 0 || moles <= 0) return out;
    const f = Math.min(1, moles / t);
    for (let k = 0; k < GAS_IDS.length; k++) { const arr = a.arrs[k], m = arr[i] * f; out.g[GAS_IDS[k]] = m * CELL_MOLES_PER_KPA; arr[i] -= m; }
    return out;
  }
  removeGases(ids) {
    const a = this.atmos, i = this.i, out = new Mix(this.vol);
    for (const id of ids) { const arr = a.arrs[GAS_IDS.indexOf(id)]; out.g[id] += arr[i] * CELL_MOLES_PER_KPA; arr[i] = 0; }
    return out;
  }
  merge(mix) {
    const a = this.atmos, i = this.i;
    for (let k = 0; k < GAS_IDS.length; k++) {
      const m = mix.g[GAS_IDS[k]];
      if (m > 0) { a.arrs[k][i] += m / CELL_MOLES_PER_KPA; a.hot[k] = true; }
    }
  }
}
