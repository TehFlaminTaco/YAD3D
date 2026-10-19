import { TILE, KIND, N, S, E, W } from './config.js';

const STD_O2 = 21.3, STD_N2 = 80.0;
const K = 0.2;            // fraction of the pressure difference exchanged per pass
const PASSES = 7;
const TICK = 0.22;

/**
 * Gas simulation on the tile grid: o2/n2/tox partial pressures (kPa) diffuse between open neighbouring
 * tiles; space tiles are sinks. Closed doors / walls / glass panes block flow; breaches and open external
 * airlocks vent the station. Vents (powered) slowly top rooms up toward a breathable mixture.
 */
export class Atmos {
  constructor(world, power) {
    this.power = power;
    this.world = world;
    const n = world.W * world.H;
    this.o2 = new Float32Array(n);
    this.n2 = new Float32Array(n);
    this.tox = new Float32Array(n);
    this.isCell = new Uint8Array(n);
    this.acc = 0;
    this.pairs = new Int32Array(0);
    this.sinkCells = new Set();
    this.vents = new Int32Array(0);
    this.areaStats = new Map();
    this.statAcc = 0;
    this.ventsOn = true;
    this.leaking = 0;

    this.buildTopology(true);
  }

  /** (Re)derive which tiles hold gas, who neighbours whom, vents and leak points. */
  buildTopology(initial = false, fillNew = null) {
    const { world } = this;
    const { W, H } = world;
    const n = W * H;
    this.isCell.fill(0);
    for (let i = 0; i < n; i++) if (world.kind[i] === KIND.FLOOR) this.isCell[i] = 1;
    const pairs = [], vents = [];
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        const i = r * W + c;
        if (!this.isCell[i]) continue;
        const indoor = world.roof[i] === 1;
        if (initial && indoor) { this.o2[i] = STD_O2; this.n2[i] = STD_N2; }
        if (fillNew && fillNew.has(i)) { this.o2[i] = STD_O2; this.n2[i] = STD_N2; this.tox[i] = 0; }
        if (c + 1 < W && this.isCell[i + 1]) pairs.push(i, i + 1, E);
        if (r + 1 < H && this.isCell[i + W]) pairs.push(i, i + W, S);
        if (indoor && (c & 3) === 1 && (r & 3) === 1) vents.push(i);
      }
    }
    this.pairs = Int32Array.from(pairs);
    this.vents = Int32Array.from(vents);
    this.sinkCells.clear();
    for (let i = 0; i < n; i++) if (this.isCell[i]) this.scanSinks(i % W, Math.floor(i / W));
  }

  /** A cell touching a space tile (breach, open exterior airlock) leaks into it. */
  scanSinks(c, r) {
    const { world } = this;
    const i = r * world.W + c;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nr = r + dr;
      if (!world.inb(nc, nr)) continue;
      const k = world.kind[nr * world.W + nc];
      if (k === KIND.SPACE || k === KIND.LATTICE) { this.sinkCells.add(i); return; }
    }
  }

  pressureAt(c, r) {
    const i = r * this.world.W + c;
    return this.o2[i] + this.n2[i] + this.tox[i];
  }
  o2At(c, r) { return this.o2[r * this.world.W + c]; }
  toxAt(c, r) { return this.tox[r * this.world.W + c]; }
  pressureWorld(x, z) { return this.pressureAt(Math.floor(x / TILE), Math.floor(z / TILE)); }

  /** Tile opened to space: register sinks on its neighbours. */
  onBreach(c, r) {
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nr = r + dr;
      if (this.world.inb(nc, nr) && this.isCell[nr * this.world.W + nc]) this.sinkCells.add(nr * this.world.W + nc);
    }
  }

  /** Re-derive sinks after a patch. */
  rescanSinks(c, r) {
    const { world } = this;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const nc = c + dc, nr = r + dr;
      if (!world.inb(nc, nr)) continue;
      const i = nr * world.W + nc;
      this.sinkCells.delete(i);
      if (this.isCell[i]) this.scanSinks(nc, nr);
    }
  }

  /** Pressure-driven push (m/s) felt at a world position. */
  windAt(x, z) {
    const c = Math.floor(x / TILE), r = Math.floor(z / TILE);
    const { world } = this;
    if (!world.inb(c, r)) return null;
    const p = (cc, rr) => {
      if (!world.inb(cc, rr)) return this.pressureAt(c, r);
      const i = rr * world.W + cc;
      const k = world.kind[i];
      if (k === KIND.SPACE || k === KIND.LATTICE) return world.airBlock[i] ? this.pressureAt(c, r) : 0;
      if (!this.isCell[i] || world.airBlock[i]) return this.pressureAt(c, r);
      return this.o2[i] + this.n2[i] + this.tox[i];
    };
    const gx = p(c + 1, r) - p(c - 1, r), gz = p(c, r + 1) - p(c, r - 1);
    const mag = Math.hypot(gx, gz);
    if (mag < 8) return null;
    const sp = Math.min(5, (mag - 8) * 0.075);
    return [-gx / mag * sp, -gz / mag * sp];
  }

  addGas(c, r, o2, n2, tox) {
    const i = r * this.world.W + c;
    if (!this.isCell[i]) return;
    this.o2[i] += o2; this.n2[i] += n2; this.tox[i] += tox;
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
  }

  step() {
    const { world } = this;
    const { airBlock, edge } = world;
    const o2 = this.o2, n2 = this.n2, tox = this.tox;
    const pairs = this.pairs;
    const power = this.power;
    for (let pass = 0; pass < PASSES; pass++) {
      for (let k = 0; k < pairs.length; k += 3) {
        const a = pairs[k], b = pairs[k + 1];
        if (airBlock[a] || airBlock[b]) continue;
        const dir = pairs[k + 2];
        if (edge[a] & dir) continue;
        let d = (o2[a] - o2[b]) * K; o2[a] -= d; o2[b] += d;
        d = (n2[a] - n2[b]) * K; n2[a] -= d; n2[b] += d;
        d = (tox[a] - tox[b]) * K; tox[a] -= d; tox[b] += d;
      }
      for (const i of this.sinkCells) {
        if (airBlock[i]) continue;
        const f = 0.32;
        o2[i] *= 1 - f; n2[i] *= 1 - f; tox[i] *= 1 - f;
      }
    }
    // vents refill powered rooms
    if (this.ventsOn) {
      for (let k = 0; k < this.vents.length; k++) {
        const i = this.vents[k];
        if (airBlock[i]) continue;
        if (!power.areaPowered(world.areaIdx[i])) continue;
        const p = o2[i] + n2[i] + tox[i];
        if (p < STD_O2 + STD_N2 - 0.5) {
          o2[i] += (STD_O2 - o2[i]) * 0.28;
          n2[i] += (STD_N2 - n2[i]) * 0.28;
        }
      }
    }
    // gas can't pool in solid cells (closed doors keep what they had; walls none)
    this.leaking = this.sinkCells.size;
  }

  computeAreaStats() {
    const { world } = this;
    const sum = new Map(), cnt = new Map();
    for (let i = 0; i < world.W * world.H; i += 3) {
      if (!this.isCell[i]) continue;
      const a = world.areaIdx[i];
      sum.set(a, (sum.get(a) || 0) + this.o2[i] + this.n2[i] + this.tox[i]);
      cnt.set(a, (cnt.get(a) || 0) + 1);
    }
    for (const [a, s] of sum) this.areaStats.set(a, s / cnt.get(a));
  }
}
