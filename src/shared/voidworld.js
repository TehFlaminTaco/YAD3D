import { World } from './world.js';
import { KIND, TILE, VOID_R, GRIP_REACH, VOID_LIMIT, CENTER_H } from './config.js';
import { pointVelocity } from './math3.js';

/**
 * The tile store of a map's void: the empty space between its grids. A body that is on no grid (it has walked or been thrown off the side of one) is in
 * the void, and its coordinates are the map's own, in three dimensions: the void has no up, a body in it is a ball of `VOID_R` placed by its middle. The void
 * has no tiles: there is no gravity, nothing to stand on, no air; the only things in the way are the map's grids, which are listed in `neighbors` (a record
 * for every grid in the map, moving or not, with the box it fills: `GameMap.linkVoid` makes them again whenever one moves). So collision, finding a handhold,
 * and looking along a line all go through each grid, in its own frame, with its own tiles and its own idea of which way is up.
 */
export class VoidWorld extends World {
  get isVoid() { return true; }

  inb() { return false; }
  hasGravity() { return false; }

  /** Nothing of its own is in the way (and no wall at the edge of nothing): what is in the way is a grid. */
  collidesTiles() { return false; }
  collidesTiles3() { return false; }

  /** Is the ball of radius h at (x, y, z) near the box of grid record `nb`? (a cheap first look) */
  near(nb, x, y, z, h) {
    const b = nb.box;
    return x + h > b[0] && x - h < b[3] && y + h > b[1] && y - h < b[4] && z + h > b[2] && z - h < b[5];
  }

  /** Is the ball of radius h with its middle at (x, y, z) in a grid or past the edge of the map? */
  collides3(x, y, z, h = VOID_R, ignore = null) {
    if (Math.abs(x) + h > VOID_LIMIT || Math.abs(y) + h > VOID_LIMIT || Math.abs(z) + h > VOID_LIMIT) return true;
    for (const nb of this.neighbors) {
      if (!this.near(nb, x, y, z, h)) continue;
      const p = nb.grid.localPoint([x, y, z]);
      if (nb.world.collidesTiles3(p[0], p[1], p[2], h, ignore)) return true;
    }
    return false;
  }

  /** The same for something that has only a place on the plane (an item dropped, a thing thrown): it is taken to be at the height of a person's middle. */
  collides(x, z, h, ignore = null) { return this.collides3(x, CENTER_H, z, Math.max(h, 0.12), ignore); }

  /** The grid (a record of `neighbors`) that has lattice nearby, or something solid within arm's reach, of the middle (x, y, z): what you could hold on to. Null in open void. */
  grip(x, y, z, ignore = null) {
    const reach = VOID_R + GRIP_REACH;
    for (const nb of this.neighbors) {
      if (!this.near(nb, x, y, z, reach + TILE)) continue;
      const p = nb.grid.localPoint([x, y, z]);
      if (Math.abs(p[1]) < 1.6) {
        const c = Math.floor(p[0] / TILE), r = Math.floor(p[2] / TILE);
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (nb.world.kindAt(c + dc, r + dr) === KIND.LATTICE) return nb;
      }
      if (nb.world.collidesTiles3(p[0], p[1], p[2], reach, ignore, false)) return nb;               // (walls and things, not floors and roofs: SS13 holds on to what is dense)
    }
    return null;
  }

  hasGrip(x, z, ignore = null, free = false, y = CENTER_H) { void free; return !!this.grip(x, y, z, ignore); }

  /** How fast what you are holding on to is going, where you are: [vx, vy, vz] in the map's coordinates (you steer relative to it), or null when you are holding nothing. */
  holdVelocity(x, z, ignore = null, y = CENTER_H) {
    const nb = this.grip(x, y, z, ignore);
    return nb ? pointVelocity(nb.grid.vel, nb.grid.ang, nb.grid.tf.p, [x, y, z]) : null;
  }

  /**
   * The first thing along the ray, across the plane, in any level grid: its distance (or `maxDist`). A grid's own raycast reads a start outside its array as
   * blocked, so each ray is joined to the grid where it enters it. (Heights are not looked at: this is what hearing and looking do on the deck; a grid that is tipped is skipped.)
   */
  raycast(ox, oz, dx, dz, maxDist, mode = 'sight') {
    const len = Math.hypot(dx, dz);
    if (len === 0) return maxDist;
    dx /= len; dz /= len;
    let best = maxDist;
    this.hit = null;
    for (const nb of this.neighbors) {
      if (!nb.flat) continue;
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
