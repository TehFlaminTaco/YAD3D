import { World } from './world.js';
import { KIND, TILE, PLAYER_R, GRIP_REACH, VOID_LIMIT } from './config.js';
import { pointVelocity } from './math3.js';

/**
 * The tile store of a map's void: the empty space between its grids. A body that is on no grid (it has walked or been thrown off the side of one) is in
 * the void, and its coordinates are the map's own. The void has no tiles: there is no gravity, nothing to stand on, no air; the only things in the way are
 * the map's grids, which are listed in `neighbors` (the same records a docked grid keeps for the grids against it, but for every grid in the map, moving
 * or not: `GameMap.linkVoid` makes them again whenever one moves). So collision, picking a handhold, and looking along a line all go through each
 * grid, in its own frame, with its own tiles.
 */
export class VoidWorld extends World {
  get isVoid() { return true; }

  inb() { return false; }
  hasGravity() { return false; }

  /** Nothing of its own is in the way (and no wall at the edge of nothing): `World.collides` goes on to the grids. */
  collidesTiles() { return false; }

  collides(x, z, h, ignore = null) {
    if (Math.abs(x) + h > VOID_LIMIT || Math.abs(z) + h > VOID_LIMIT) return true;
    return super.collides(x, z, h, ignore);
  }

  /** The grid (a record of `neighbors`) that has lattice within a tile, or something solid within arm's reach, of (x, z): what you could hold on to. Null in open void. */
  grip(x, z, ignore = null) {
    const reach = PLAYER_R + GRIP_REACH;
    for (const nb of this.neighbors) {
      const [x0, z0, x1, z1] = nb.rect;
      if (x < x0 - TILE || x > x1 + TILE || z < z0 - TILE || z > z1 + TILE) continue;
      const lx = nb.a * x + nb.b * z + nb.tx, lz = nb.c * x + nb.d * z + nb.tz, c = Math.floor(lx / TILE), r = Math.floor(lz / TILE);
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (nb.world.kindAt(c + dc, r + dr) === KIND.LATTICE) return nb;
      if (nb.world.collidesTiles(lx, lz, reach, ignore, false)) return nb;
    }
    return null;
  }

  hasGrip(x, z, ignore = null) { return !!this.grip(x, z, ignore); }

  /** How fast what you are holding on to is going, where you are: [vx, vz] in the map's coordinates (you steer relative to it), or null when you are holding nothing. */
  holdVelocity(x, z, ignore = null) {
    const nb = this.grip(x, z, ignore);
    if (!nb) return null;
    const v = pointVelocity(nb.grid.vel, nb.grid.ang, nb.grid.tf.p, [x, 0, z]);
    return [v[0], v[2]];
  }

  /** The first thing along the ray in any grid: its distance (or `maxDist`). A grid's own raycast reads a start outside its array as blocked, so each ray is joined to the grid where it enters it. */
  raycast(ox, oz, dx, dz, maxDist, mode = 'sight') {
    const len = Math.hypot(dx, dz);
    if (len === 0) return maxDist;
    dx /= len; dz /= len;
    let best = maxDist;
    this.hit = null;
    for (const nb of this.neighbors) {
      const lx = nb.a * ox + nb.b * oz + nb.tx, lz = nb.c * ox + nb.d * oz + nb.tz;
      const ldx = nb.a * dx + nb.b * dz, ldz = nb.c * dx + nb.d * dz;
      const nw = nb.world, bx = nw.W * TILE, bz = nw.H * TILE;
      let t0 = 0, t1 = best;
      for (const [p, d, hi] of [[lx, ldx, bx], [lz, ldz, bz]]) {         // where the ray is inside the grid's array (slab test)
        if (Math.abs(d) < 1e-9) { if (p < 0 || p > hi) { t1 = -1; break; } continue; }
        let a = -p / d, b = (hi - p) / d;
        if (a > b) [a, b] = [b, a];
        t0 = Math.max(t0, a); t1 = Math.min(t1, b);
      }
      if (t1 < t0 || t0 >= best) continue;
      const e = t0 > 0 ? t0 + 1e-4 : 0;
      const d = e + nw.raycast(lx + ldx * e, lz + ldz * e, ldx, ldz, best - e, mode);
      if (d < best) best = d;
    }
    return best;                                           // (`hit` stays null: what was hit is a tile of a grid, and is in that grid's numbering, not ours)
  }
}
