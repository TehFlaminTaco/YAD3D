import { TILE } from './config.js';
import { qToYaw } from './math3.js';

/**
 * A map: a separate space of grids, with its own void. The station, a CentCom sector and an away mission are different maps; a grid is in
 * exactly one, and things in different maps never meet. (Called `GameMap` because `Map` is the JavaScript one.)
 *
 * The map itself is only a container and a name here; the grids carry their own pose in it (`grid.tf`, in this map's coordinates) and the
 * server gives each map its own physics world.
 */
export class GameMap {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.grids = new Map();               // grid id -> Grid
  }

  add(grid) {
    if (grid.map && grid.map !== this) grid.map.remove(grid);
    grid.map = this;
    this.grids.set(grid.id, grid);
    return grid;
  }

  remove(grid) {
    if (this.grids.delete(grid.id) && grid.map === this) grid.map = null;
  }

  /**
   * Work out which grids lie over which others' open space, and how to get from one's frame to the other's: each grid's `world.neighbors`, and which of its
   * space tiles are not space any more because another grid is there (`world.covered`: 1 floor or lattice, 2 a wall). This is what lets a body bump into a
   * docked shuttle's hull and walk through its door while its position stays in its own grid's frame, and what stops the air leaking into "space" that is
   * a shuttle. Call it whenever a grid is added, removed or moved (both sides do). Returns the grids whose covered tiles changed, so their air can be redone.
   * (Grids are turned about the vertical axis only for now, so a position on the deck maps with a 2 by 2 matrix and an offset.)
   */
  relink() {
    const gs = [...this.grids.values()];
    for (const g of gs) g.world.neighbors = [];
    const changed = [];
    for (const a of gs) {
      const aw = a.world;
      for (const b of gs) {
        if (a === b) continue;
        const bb = b.bounds();
        if (!bb) continue;
        // b's footprint in a's frame
        let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
        for (const [c, r] of [[bb[0], bb[1]], [bb[2] + 1, bb[1]], [bb[2] + 1, bb[3] + 1], [bb[0], bb[3] + 1]]) {
          const p = a.localPoint(b.worldPoint(c * TILE, 0, r * TILE));
          x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]);
        }
        if (x1 < -1 || z1 < -1 || x0 > aw.W * TILE + 1 || z0 > aw.H * TILE + 1) continue;       // not over a at all
        const o = b.localPoint(a.worldPoint(0, 0, 0)), ex = b.localPoint(a.worldPoint(1, 0, 0)), ez = b.localPoint(a.worldPoint(0, 0, 1));
        aw.neighbors.push({
          grid: b, world: b.world, rect: [x0 - 0.5, z0 - 0.5, x1 + 0.5, z1 + 0.5],
          a: ex[0] - o[0], b: ez[0] - o[0], c: ex[2] - o[2], d: ez[2] - o[2], tx: o[0], tz: o[2],     // a's (x, z) -> b's: x' = a x + b z + tx, z' = c x + d z + tz
          dyaw: qToYaw(a.tf.q) - qToYaw(b.tf.q),                                                      // a facing in a's frame -> in b's: add this
        });
      }
      // which of a's space tiles have another grid's tile over them
      const cov = new Uint8Array(aw.n);
      for (const nb of aw.neighbors) {
        const [x0, z0, x1, z1] = nb.rect, nw = nb.world;
        const c0 = Math.max(0, Math.floor(x0 / TILE)), c1 = Math.min(aw.W - 1, Math.floor(x1 / TILE));
        const r0 = Math.max(0, Math.floor(z0 / TILE)), r1 = Math.min(aw.H - 1, Math.floor(z1 / TILE));
        for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
          const i = aw.idx(c, r);
          if (aw.kind[i] !== 0) continue;
          const x = c * TILE + TILE / 2, z = r * TILE + TILE / 2;
          const bc = Math.floor((nb.a * x + nb.b * z + nb.tx) / TILE), br = Math.floor((nb.c * x + nb.d * z + nb.tz) / TILE);
          if (!nw.inb(bc, br)) continue;
          const k = nw.kind[nw.idx(bc, br)];
          if (k === 0) continue;
          cov[i] = Math.max(cov[i], k === 2 ? 2 : 1);
        }
      }
      if (cov.some((v, i) => v !== aw.covered[i])) changed.push(a);
      aw.covered = cov;
    }
    return changed;
  }

  [Symbol.iterator]() { return this.grids.values(); }
}
