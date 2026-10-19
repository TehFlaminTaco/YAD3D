import { TILE, KIND, DV, OPP, N, S, E, W } from './config.js';

/**
 * Tile grid + collision + queries. Game space: x = col * TILE, z = row * TILE, y up; north is -z.
 */
export class World {
  constructor(assets) {
    const { level, w, h } = assets;
    this.W = w;
    this.H = h;
    this.level = level;
    this.kind = assets.kind;
    this.roof = assets.roof;
    this.areaIdx = assets.area;
    this.floorCell = assets.floor;
    this.wallVar = assets.wall;
    this.areas = level.areas;
    this.variants = level.walls;

    const n = w * h;
    this.glass = new Uint8Array(n);          // wall-like block that is see-through (window)
    this.solid = new Uint8Array(n);          // blocks movement (walls, dense props, closed doors)
    this.edge = new Uint8Array(n);           // thin blockers on tile edges (bit per direction)
    this.edgeGlass = new Uint8Array(n);      // which of those edges are glass (for rays)
    this.tableH = new Float32Array(n);       // surface height of tables (items rest on them)
    this.doorAt = new Map();                 // tile index -> Door
    this.airBlock = new Uint8Array(n);       // blocks gas (walls, windows, closed doors)
    this.hit = null;                         // what the last raycast stopped at

    this.hp = new Map();                     // destructible tile -> hit points
    this.breached = new Set();               // tiles opened to space during play
    this.patchVariant = Math.max(0, this.variants.findIndex((v) => !v.glass && /reinforced/.test(v.name)));
    if (this.patchVariant < 0) this.patchVariant = 0;

    for (let i = 0; i < n; i++) {
      const k = this.kind[i];
      if (k === KIND.WALL) {
        const v = this.wallVar[i];
        if (v !== 0xffff && this.variants[v].glass) {
          this.glass[i] = 1;
          this.hp.set(i, this.variants[v].name === 'pwindow' ? 90 : this.variants[v].name === 'rwindow' ? 70 : 30);
        } else {
          this.hp.set(i, v !== 0xffff && /reinforced/.test(this.variants[v].name) ? 900 : 400);
        }
        this.solid[i] = 1;
        this.airBlock[i] = 1;
      } else if (k === KIND.SPACE) {
        this.solid[i] = 1;
      }
    }
  }

  /** Open a hull tile to space (window shattered / wall blown out). */
  setBreach(c, r) {
    const i = r * this.W + c;
    this.kind[i] = KIND.SPACE;
    this.glass[i] = 0;
    this.solid[i] = 1;
    this.airBlock[i] = 0;
    this.hp.delete(i);
    this.breached.add(i);
  }

  /** Weld a breach shut with a reinforced plate. */
  setPatched(c, r) {
    const i = r * this.W + c;
    this.kind[i] = KIND.WALL;
    this.wallVar[i] = this.patchVariant;
    this.glass[i] = 0;
    this.solid[i] = 1;
    this.airBlock[i] = 1;
    this.hp.set(i, 500);
    this.breached.delete(i);
  }

  idx(c, r) { return r * this.W + c; }
  inb(c, r) { return c >= 0 && r >= 0 && c < this.W && r < this.H; }
  tileOf(x) { return Math.floor(x / TILE); }

  kindAt(c, r) { return this.inb(c, r) ? this.kind[r * this.W + c] : KIND.SPACE; }
  isWallLike(c, r) { return this.kindAt(c, r) === KIND.WALL; }
  opaque(c, r) { const i = r * this.W + c; return this.inb(c, r) && this.kind[i] === KIND.WALL && !this.glass[i]; }
  walkable(c, r) { return this.inb(c, r) && !this.solid[r * this.W + c]; }
  areaAt(c, r) { return this.areas[this.areaIdx[r * this.W + c]]; }

  /** Mark a thin blocker on the `d` edge of tile (c, r) (mirrored on the neighbour). */
  addEdge(c, r, d, glass = false) {
    if (!this.inb(c, r)) return;
    const i = r * this.W + c;
    this.edge[i] |= d;
    if (glass) this.edgeGlass[i] |= d;
    const [dc, dr] = DV[d];
    if (this.inb(c + dc, r + dr)) {
      const j = (r + dr) * this.W + (c + dc);
      this.edge[j] |= OPP[d];
      if (glass) this.edgeGlass[j] |= OPP[d];
    }
  }

  removeEdge(c, r, d) {
    const i = r * this.W + c;
    this.edge[i] &= ~d;
    this.edgeGlass[i] &= ~d;
    const [dc, dr] = DV[d];
    if (this.inb(c + dc, r + dr)) {
      const j = (r + dr) * this.W + (c + dc);
      this.edge[j] &= ~OPP[d];
      this.edgeGlass[j] &= ~OPP[d];
    }
  }

  /** Axis-aligned box (half-size `h`) vs tiles + thin edges. */
  collides(x, z, h) {
    const c0 = Math.floor((x - h) / TILE), c1 = Math.floor((x + h) / TILE);
    const r0 = Math.floor((z - h) / TILE), r1 = Math.floor((z + h) / TILE);
    const T = TILE, th = 0.07;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (!this.inb(c, r)) return true;
        const i = r * this.W + c;
        if (this.solid[i]) return true;
        const e = this.edge[i];
        if (e) {
          const x0 = c * T, z0 = r * T, x1 = x0 + T, z1 = z0 + T;
          if ((e & N) && x + h > x0 && x - h < x1 && z + h > z0 - th && z - h < z0 + th) return true;
          if ((e & S) && x + h > x0 && x - h < x1 && z + h > z1 - th && z - h < z1 + th) return true;
          if ((e & W) && z + h > z0 && z - h < z1 && x + h > x0 - th && x - h < x0 + th) return true;
          if ((e & E) && z + h > z0 && z - h < z1 && x + h > x1 - th && x - h < x1 + th) return true;
        }
      }
    }
    return false;
  }

  /** Slide an entity with half-size h by (dx, dz); returns true if blocked on either axis. */
  move(pos, dx, dz, h) {
    let blocked = false;
    if (dx !== 0) {
      if (!this.collides(pos.x + dx, pos.z, h)) pos.x += dx; else blocked = true;
    }
    if (dz !== 0) {
      if (!this.collides(pos.x, pos.z + dz, h)) pos.z += dz; else blocked = true;
    }
    return blocked;
  }

  /**
   * Grid DDA. Returns distance to the first blocking tile along the ray (or maxDist).
   * mode 'sight': walls + closed doors block; glass does not.   mode 'shot': glass blocks too.
   */
  raycast(ox, oz, dx, dz, maxDist, mode = 'sight') {
    const len = Math.hypot(dx, dz);
    if (len === 0) return maxDist;
    dx /= len; dz /= len;
    let c = Math.floor(ox / TILE), r = Math.floor(oz / TILE);
    const stepC = dx > 0 ? 1 : -1, stepR = dz > 0 ? 1 : -1;
    const tDeltaC = dx !== 0 ? Math.abs(TILE / dx) : Infinity;
    const tDeltaR = dz !== 0 ? Math.abs(TILE / dz) : Infinity;
    let tMaxC = dx !== 0 ? ((dx > 0 ? (c + 1) * TILE - ox : ox - c * TILE) / Math.abs(dx)) : Infinity;
    let tMaxR = dz !== 0 ? ((dz > 0 ? (r + 1) * TILE - oz : oz - r * TILE) / Math.abs(dz)) : Infinity;
    let t = 0;
    for (let guard = 0; guard < 512; guard++) {
      if (!this.inb(c, r)) return t;
      const i = r * this.W + c;
      if (this.blocksRay(i, mode)) { this.hit = { kind: 'tile', i, c, r }; return t; }
      let dir;
      if (tMaxC < tMaxR) { t = tMaxC; tMaxC += tDeltaC; c += stepC; dir = stepC > 0 ? W : E; }
      else { t = tMaxR; tMaxR += tDeltaR; r += stepR; dir = stepR > 0 ? N : S; }
      if (t >= maxDist) return maxDist;
      // thin edges crossed between tiles
      const pi = (dir === W || dir === E) ? this.idx(c - stepC, r) : this.idx(c, r - stepR);
      const e = this.edge[pi];
      if (e) {
        const crossed = (dir === W) ? E : (dir === E) ? W : (dir === N) ? S : N;
        if ((e & crossed) && (mode === 'shot' || !(this.edgeGlass[pi] & crossed))) { this.hit = { kind: 'edge', i: pi, bit: crossed }; return t; }
      }
    }
    return maxDist;
  }

  blocksRay(i, mode) {
    const k = this.kind[i];
    if (k === KIND.WALL) return mode === 'shot' || !this.glass[i];
    if (k === KIND.SPACE) return false;
    const d = this.doorAt.get(i);
    if (d && d.blocksSight()) return true;
    return false;
  }

  /** Line of sight between two points (ignores glass). */
  los(x0, z0, x1, z1) {
    const dx = x1 - x0, dz = z1 - z0;
    const dist = Math.hypot(dx, dz);
    if (dist < 1e-4) return true;
    return this.raycast(x0, z0, dx, dz, dist, 'sight') >= dist - 1e-3;
  }
}
