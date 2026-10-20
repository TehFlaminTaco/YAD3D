import * as THREE from 'three';
import { TILE, WALL_H, CHUNK, KIND, DV } from '../shared/config.js';
import { terrainMaterial } from './materials.js';

class Acc {
  constructor() {
    this.pos = []; this.uv = []; this.layer = []; this.sx = []; this.sz = []; this.mul = []; this.tint = [];
    this.index = []; this.nv = 0;
  }

  /** p: 4x[x,y,z]; uv: 4x[u,v]; s: 4x[x,z] light sample points */
  quad(p, uv, layer, s, mul, tint = [1, 1, 1]) {
    for (let i = 0; i < 4; i++) {
      this.pos.push(p[i][0], p[i][1], p[i][2]);
      this.uv.push(uv[i][0], uv[i][1]);
      this.layer.push(layer);
      this.sx.push(s[i][0]);
      this.sz.push(s[i][1]);
      this.mul.push(mul);
      this.tint.push(tint[0], tint[1], tint[2]);
    }
    const b = this.nv;
    this.index.push(b, b + 1, b + 2, b, b + 2, b + 3);
    this.nv += 4;
  }

  get empty() { return this.nv === 0; }
}

const UV_FULL = [[0, 0], [1, 0], [1, 1], [0, 1]];
const GRILLE_INSET = 0.08;                  // metres behind the glass face, so the two never fight for the same pixels

/** Vertical quad on tile (c, r), `off` metres from the tile centre along normal direction d. */
function face(acc, c, r, d, off, layer, mul, y0 = 0, y1 = WALL_H, inset = 0) {
  const [nx, nz] = DV[d];
  const rx = nz, rz = -nx;                    // viewer-right when looking at the face
  const cx = c * TILE + TILE / 2 + nx * off, cz = r * TILE + TILE / 2 + nz * off;
  const hw = TILE / 2 - inset;
  const lx = cx - rx * hw, lz = cz - rz * hw, rrx = cx + rx * hw, rrz = cz + rz * hw;
  const v0 = 1 - y0 / WALL_H, v1 = 1 - y1 / WALL_H;
  const so = 0.4;
  acc.quad(
    [[lx, y0, lz], [rrx, y0, rrz], [rrx, y1, rrz], [lx, y1, lz]],
    [[0, v0], [1, v0], [1, v1], [0, v1]],
    layer,
    [[lx + nx * so, lz + nz * so], [rrx + nx * so, rrz + nz * so], [rrx + nx * so, rrz + nz * so], [lx + nx * so, lz + nz * so]],
    mul,
  );
}

export class LevelMesh {
  constructor(world, assets, extras = {}) {
    this.world = world;
    this.assets = assets;
    this.extras = extras;
    this.group = new THREE.Group();
    this.chunks = new Map();            // key -> {meshes: [...]}
    this.opaqueMat = terrainMaterial(assets.terrainTex, false);
    this.glassMat = terrainMaterial(assets.terrainTex, true);
    this.tmp = [0, 0, 0];
    this.lf = null;
    this.tableAt = new Map();
    for (const t of extras.tables || []) this.tableAt.set(t.r * world.W + t.c, t);
    this.build();
  }

  glassVariant(tag) {
    const { world } = this;
    let v = world.variants.findIndex((x) => x.glass && x.name === tag);
    if (v < 0) v = world.variants.findIndex((x) => x.glass);
    return v;
  }

  build() {
    const { W, H } = this.world;
    for (let cy = 0; cy * CHUNK < H; cy++) for (let cx = 0; cx * CHUNK < W; cx++) this.buildChunk(cx, cy);
  }

  disposeChunk(key) {
    const old = this.chunks.get(key);
    if (!old) return;
    for (const m of old.meshes) {
      this.group.remove(m.mesh);
      m.mesh.geometry.dispose();
    }
    this.chunks.delete(key);
  }

  buildChunk(cx, cy) {
    const { world, assets } = this;
    const { W, H } = world;
    const lvl = assets.level.terrain;
    const key = cy * 1000 + cx;
    this.disposeChunk(key);
    const ao = new Acc(), ag = new Acc();
    const c0 = cx * CHUNK, r0 = cy * CHUNK;
    const c1 = Math.min(W, c0 + CHUNK), r1 = Math.min(H, r0 + CHUNK);
    for (let r = r0; r < r1; r++) {
      for (let c = c0; c < c1; c++) {
        const i = r * W + c;
        const k = world.kind[i];
        if (k === KIND.FLOOR || k === KIND.LATTICE) {
          this.floorQuad(ao, c, r, world.floorCell[i]);
          if (k === KIND.FLOOR && world.roof[i]) this.ceilingQuad(ao, c, r, lvl.ceiling);
          if (world.breached.has(i) && world.grille[i]) this.grillePanels(ao, c, r, world.variants[world.wallVar[i]]);   // the window is gone, the grille is not (until it is cut)
          const tb = this.tableAt.get(i);
          if (tb) this.tableBox(ao, this.tableAt, tb, c, r);
        } else if (k === KIND.WALL) {
          this.wallBlock(ao, ag, c, r, i);
        }
      }
    }
    for (const p of this.extras.panes || []) {
      if (p.dead) continue;
      if (p.c >= c0 && p.c < c1 && p.r >= r0 && p.r < r1) {
        const v = this.glassVariant(p.tag);
        if (v >= 0) face(ag, p.c, p.r, p.d, TILE / 2, world.variants[v].cells[3], 0.9);
      }
    }
    if (!ao.empty || !ag.empty) {
      const ch = this.makeChunk(ao, ag);
      this.chunks.set(key, ch);
      if (this.lf) this.relightChunk(ch, this.lf);
    }
  }

  /** Rebuild every chunk touching the 3x3 neighbourhood of the given tiles. */
  rebuildTiles(list) {
    const keys = new Set();
    for (const [c, r] of list) {
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const cc = c + dc, rr = r + dr;
        if (this.world.inb(cc, rr)) keys.add(Math.floor(rr / CHUNK) * 1000 + Math.floor(cc / CHUNK));
      }
    }
    for (const k of keys) this.buildChunk(k % 1000, Math.floor(k / 1000));
  }

  floorQuad(acc, c, r, cell) {
    if (cell === 0xffff) return;
    const x0 = c * TILE, z0 = r * TILE, x1 = x0 + TILE, z1 = z0 + TILE;
    acc.quad([[x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1]], UV_FULL, cell,
      [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], 1);
  }

  ceilingQuad(acc, c, r, layer) {
    const x0 = c * TILE, z0 = r * TILE, x1 = x0 + TILE, z1 = z0 + TILE;
    acc.quad([[x0, WALL_H, z0], [x1, WALL_H, z0], [x1, WALL_H, z1], [x0, WALL_H, z1]], UV_FULL, layer,
      [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], 0.72);
  }

  /** A window's grille: a see-through panel just inside each side the glass would face (or did, once it is smashed). */
  grillePanels(acc, c, r, variant) {
    if (variant?.gr === undefined) return;
    const { world } = this;
    for (const d of [1, 2, 4, 8]) {
      const [dc, dr] = DV[d];
      if (!world.inb(c + dc, r + dr) || world.kind[(r + dr) * world.W + c + dc] === KIND.WALL) continue;
      face(acc, c, r, d, TILE / 2 - GRILLE_INSET, variant.gr, 0.9);
    }
  }

  tableBox(acc, tableAt, tb, c, r) {
    const { world } = this;
    const T = TILE, h = tb.h, ins = 0.05;
    const x0 = c * T + ins, x1 = c * T + T - ins, z0 = r * T + ins, z1 = r * T + T - ins;
    const col = tb.rgb;
    const side = [col[0] * 0.55, col[1] * 0.55, col[2] * 0.55];
    // top fill (sprite sits just above)
    acc.quad([[x0, h, z0], [x1, h, z0], [x1, h, z1], [x0, h, z1]], UV_FULL, this.assets.level.terrain.flat,
      [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], 1, col);
    const hasT = (dc, dr) => tableAt.has((r + dr) * world.W + (c + dc));
    const sides = [
      [0, -1, [[x0, 0, z0], [x1, 0, z0], [x1, h, z0], [x0, h, z0]], [x0, z0 - 0.3]],
      [0, 1, [[x1, 0, z1], [x0, 0, z1], [x0, h, z1], [x1, h, z1]], [x0, z1 + 0.3]],
      [1, 0, [[x1, 0, z0], [x1, 0, z1], [x1, h, z1], [x1, h, z0]], [x1 + 0.3, z0]],
      [-1, 0, [[x0, 0, z1], [x0, 0, z0], [x0, h, z0], [x0, h, z1]], [x0 - 0.3, z0]],
    ];
    for (const [dc, dr, p, s] of sides) {
      if (hasT(dc, dr)) continue;
      acc.quad(p, UV_FULL, this.assets.level.terrain.flat, [s, s, s, s], 0.85, side);
    }
  }

  wallBlock(ao, ag, c, r, i) {
    const { world } = this;
    const v = world.wallVar[i];
    if (v === 0xffff) return;
    const variant = world.variants[v];
    const glass = variant.glass;
    const open = [];
    for (const d of [1, 2, 4, 8]) {
      const [dc, dr] = DV[d];
      const nc = c + dc, nr = r + dr;
      if (!world.inb(nc, nr)) continue;
      const nk = world.kind[nr * world.W + nc];
      if (glass) { if (nk !== KIND.WALL) open.push(d); }
      else if (nk !== KIND.WALL || world.glass[nr * world.W + nc]) open.push(d);       // including space: you can float out and look back at the hull
    }
    const conn = (cc, rr) => (glass ? world.kind[rr * world.W + cc] === KIND.WALL && world.inb(cc, rr)
      : world.inb(cc, rr) && world.opaque(cc, rr));
    const cellFor = (d) => {
      const [nx, nz] = DV[d];
      const rx = nz, rz = -nx;
      const L = conn(c - rx, r - rz) ? 1 : 0, R = conn(c + rx, r + rz) ? 2 : 0;
      return variant.cells[L | R];
    };
    if (glass) {
      // a glass block is a full tile: the real floor (and ceiling) shows through it, not space
      this.floorQuad(ao, c, r, world.floorCell[i]);
      if (world.roof[i]) this.ceilingQuad(ao, c, r, this.assets.level.terrain.ceiling);
      for (const d of open) face(ag, c, r, d, TILE / 2, cellFor(d), 0.9);
      this.grillePanels(ao, c, r, variant);
    } else {
      for (const d of open) face(ao, c, r, d, TILE / 2, cellFor(d), d === 1 || d === 2 ? 0.92 : 0.8);
    }
  }

  makeChunk(ao, ag) {
    const out = { meshes: [] };
    for (const [acc, mat, name] of [[ao, this.opaqueMat, 'opaque'], [ag, this.glassMat, 'glass']]) {
      if (acc.empty) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(acc.pos), 3));
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(acc.uv), 2));
      g.setAttribute('aLayer', new THREE.BufferAttribute(new Float32Array(acc.layer), 1));
      const light = new THREE.BufferAttribute(new Float32Array(acc.nv * 3).fill(0.3), 3);
      light.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute('aLight', light);
      g.setIndex(new THREE.BufferAttribute(new Uint32Array(acc.index), 1));
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, mat);
      mesh.renderOrder = name === 'glass' ? 2 : 0;
      this.group.add(mesh);
      const rec = {
        mesh, light, nv: acc.nv,
        sx: new Float32Array(acc.sx), sz: new Float32Array(acc.sz),
        mul: new Float32Array(acc.mul), tint: new Float32Array(acc.tint),
      };
      out.meshes.push(rec);
    }
    return out;
  }

  relightChunk(ch, lf) {
    const t = this.tmp;
    for (const m of ch.meshes) {
      const a = m.light.array;
      for (let j = 0; j < m.nv; j++) {
        lf.sample(m.sx[j], m.sz[j], t);
        const k = m.mul[j];
        a[j * 3] = Math.min(1.4, t[0] * k * m.tint[j * 3]);
        a[j * 3 + 1] = Math.min(1.4, t[1] * k * m.tint[j * 3 + 1]);
        a[j * 3 + 2] = Math.min(1.4, t[2] * k * m.tint[j * 3 + 2]);
      }
      m.light.needsUpdate = true;
    }
  }

  /** Recompute all vertex lighting from the light field. */
  relight(lf) {
    this.lf = lf;
    for (const ch of this.chunks.values()) this.relightChunk(ch, lf);
  }
}
