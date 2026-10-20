import { TILE, KIND } from '../shared/config.js';

/**
 * Per-tile RGB light field: each source floods through open tiles (8-neighbour) with a quadratic
 * falloff. Surfaces sample it bilinearly, so walls/floors/sprites share one cheap lighting model.
 */
export class LightField {
  constructor(world) {
    this.world = world;
    const n = world.W * world.H * world.levels;                 // (a layer for every deck: light does not pass from one to another)
    this.r = new Float32Array(n);
    this.g = new Float32Array(n);
    this.b = new Float32Array(n);
    this.stamp = new Int32Array(n);
    this.stampId = 0;
    this.queue = new Int32Array(4096);
  }

  clear(ambient = [0.04, 0.04, 0.05]) {
    this.r.fill(ambient[0]);
    this.g.fill(ambient[1]);
    this.b.fill(ambient[2]);
  }

  /** Add a point light at tile-space position (cx, cz) (tile units, centre of tile = c + 0.5) on deck `l`. */
  addSource(cx, cz, color, radius, strength = 1, l = 0) {
    const w = this.world;
    const W = w.W, base = l * W * w.H;
    const sc = Math.floor(cx), sr = Math.floor(cz);
    if (!w.inb(sc, sr, l)) return;
    const id = ++this.stampId;
    const q = this.queue;
    let head = 0, tail = 0;
    q[tail++] = base + sr * W + sc;
    this.stamp[base + sr * W + sc] = id;
    const R2 = radius * radius;
    while (head < tail) {
      const i = q[head++];
      const c = (i - base) % W, r = ((i - base) - c) / W;
      const dx = c + 0.5 - cx, dz = r + 0.5 - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 > R2) continue;
      const f = 1 - Math.sqrt(d2) / radius;
      const v = strength * f * f;
      this.r[i] += color[0] * v;
      this.g[i] += color[1] * v;
      this.b[i] += color[2] * v;
      if (w.opaque(c, r, l) && i !== base + sr * W + sc) continue;   // walls receive light but do not pass it on
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dc && !dr) continue;
          const nc = c + dc, nr = r + dr;
          if (nc < 0 || nr < 0 || nc >= W || nr >= w.H) continue;
          const ni = base + nr * W + nc;
          if (this.stamp[ni] === id) continue;
          // do not let light slip diagonally between two walls
          if (dc && dr && w.opaque(c + dc, r, l) && w.opaque(c, r + dr, l)) continue;
          this.stamp[ni] = id;
          if (tail < q.length) q[tail++] = ni;
        }
      }
    }
  }

  /** Walls take the brightest value of their open neighbours so bilinear sampling doesn't darken edges. */
  finalize() {
    const w = this.world;
    const W = w.W, H = w.H;
    const kind = w.kind;
    for (let l = 0; l < w.levels; l++) {
      const base = l * W * H;
      for (let r = 0; r < H; r++) {
        for (let c = 0; c < W; c++) {
          const i = base + r * W + c;
          if (kind[i] !== KIND.WALL || !w.opaque(c, r, l)) continue;
          let br = 0, bg = 0, bb = 0;
          for (let k = 0; k < 4; k++) {
            const nc = c + (k === 0 ? 1 : k === 1 ? -1 : 0), nr = r + (k === 2 ? 1 : k === 3 ? -1 : 0);
            if (!w.inb(nc, nr, l)) continue;
            const j = base + nr * W + nc;
            if (kind[j] === KIND.WALL && w.opaque(nc, nr, l)) continue;
            if (this.r[j] > br) br = this.r[j];
            if (this.g[j] > bg) bg = this.g[j];
            if (this.b[j] > bb) bb = this.b[j];
          }
          this.r[i] = Math.max(this.r[i], br);
          this.g[i] = Math.max(this.g[i], bg);
          this.b[i] = Math.max(this.b[i], bb);
        }
      }
    }
  }

  /** Bilinear sample at world (x, z) on deck `l`; writes into out[0..2]. */
  sample(x, z, out, l = 0) {
    const w = this.world;
    const u = x / TILE - 0.5, v = z / TILE - 0.5;
    let c0 = Math.floor(u), r0 = Math.floor(v);
    const fu = u - c0, fv = v - r0;
    const W = w.W, H = w.H, base = (l | 0) * W * H;
    const cA = c0 < 0 ? 0 : c0 >= W ? W - 1 : c0, cB = c0 + 1 < 0 ? 0 : c0 + 1 >= W ? W - 1 : c0 + 1;
    const rA = r0 < 0 ? 0 : r0 >= H ? H - 1 : r0, rB = r0 + 1 < 0 ? 0 : r0 + 1 >= H ? H - 1 : r0 + 1;
    const i00 = base + rA * W + cA, i10 = base + rA * W + cB, i01 = base + rB * W + cA, i11 = base + rB * W + cB;
    const w00 = (1 - fu) * (1 - fv), w10 = fu * (1 - fv), w01 = (1 - fu) * fv, w11 = fu * fv;
    out[0] = this.r[i00] * w00 + this.r[i10] * w10 + this.r[i01] * w01 + this.r[i11] * w11;
    out[1] = this.g[i00] * w00 + this.g[i10] * w10 + this.g[i01] * w01 + this.g[i11] * w11;
    out[2] = this.b[i00] * w00 + this.b[i10] * w10 + this.b[i01] * w01 + this.b[i11] * w11;
    return out;
  }
}
