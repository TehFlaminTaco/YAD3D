import { vlen, vsub, vscale, tfClone, tfPoint } from '../shared/math3.js';
import { TILE, KIND } from '../shared/config.js';

const VMAX = 14;                    // m/s: how fast a shuttle cruises
const AMAX = 4;                     // m/s^2: how hard its engines push (and brake)
const TAU = 0.25;                   // seconds: how quickly it settles onto the speed it wants
const ARRIVE_DIST = 0.06;           // metres off the mark and
const ARRIVE_SPEED = 0.2;           // m/s: close and slow enough that it is held exactly there

/**
 * Flying grids. A flight takes a grid to a pose in its map: the engines (a force on its body each step) speed it up to a cruise, hold it there and brake it
 * so it stops on the mark; then it is put exactly on the mark and, if it is to dock, held there. Nothing else about a grid's motion is scripted: the
 * rest is the physics (a grid that runs into another one is stopped by it and the hit is reported, see Sim.gridImpact).
 */
export class Shuttles {
  constructor(sim) {
    this.sim = sim;
    this.flights = new Map();         // grid id -> { to: pose, dock, vmax, amax, done }
  }

  flying(g) { return this.flights.has(g.id); }

  /**
   * Let `g` go (if it is docked) and send it to `to` ({p, q}; it keeps the way it faces: it is flown straight there). `o.dock`: hold it there when it arrives;
   * `o.done(g)` runs on arrival; `o.vmax`, `o.amax` for a slower or gentler flight.
   */
  fly(g, to, o = {}) {
    if (g.docked) this.sim.undock(g);
    this.flights.set(g.id, { to: tfClone(to), dock: !!o.dock, vmax: o.vmax ?? VMAX, amax: o.amax ?? AMAX, done: o.done || null });
  }

  /**
   * A direction (a unit vector in the map, along an axis) in which `g` can move `dist` metres without any of its walls or floors meeting another grid's,
   * or null. (Lattice and open space are not in the way. Not every shuttle can leave every way: some sit in a notch of the station.) `at` ({map, tf}) asks it of
   * another place than where the grid is: if it stood at `tf` in `map`.
   */
  clearDirection(g, dist = 60, at = null) {
    const w = g.world, tiles = [], map = at?.map || g.map, tf = at?.tf || g.tf, others = map.solids.filter((o) => o !== g);
    for (let r = 0; r < w.H; r++) for (let c = 0; c < w.W; c++) if (w.kind[w.idx(c, r)] !== KIND.SPACE) tiles.push(tfPoint(tf, [c * TILE + 1, 0, r * TILE + 1]));
    for (const d of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) {
      let clear = true;
      for (let m = 1; m <= dist && clear; m++) {
        for (const p of tiles) {
          const q = [p[0] + d[0] * m, 0, p[2] + d[2] * m];
          for (const o of others) {
            const l = o.localPoint(q), k = o.world.kindAt(Math.floor(l[0] / TILE), Math.floor(l[2] / TILE));
            if (k !== KIND.SPACE && k !== KIND.LATTICE) { clear = false; break; }
          }
          if (!clear) break;
        }
      }
      if (clear) return d;
    }
    return null;
  }

  /** Stop flying where it is (it drifts on at the speed it has, as anything in space does). */
  cancel(g) {
    this.flights.delete(g.id);
    this.sim.physics.thrust(g, [0, 0, 0]);
  }

  /** Brake to a stop where it is. */
  halt(g) { this.cancel(g); this.sim.physics.setVel(g, [0, 0, 0], [0, 0, 0]); }

  /** Everything that is flying is pushed one step towards where it is going. */
  update() {
    const sim = this.sim;
    for (const [id, f] of [...this.flights]) {
      const g = sim.grids.get(id);
      if (!g) { this.flights.delete(id); continue; }
      const m = sim.physics.mass(g);
      const e = vsub(f.to.p, g.tf.p); e[1] = 0;
      const d = vlen(e), v = g.vel;
      if (d < ARRIVE_DIST && Math.hypot(v[0], v[2]) < ARRIVE_SPEED) {
        this.flights.delete(id);
        sim.physics.thrust(g, [0, 0, 0]);
        if (f.dock) sim.dock(g, f.to); else sim.physics.place(g, f.to);
        f.done?.(g);
        continue;
      }
      // the speed it wants along the way to the mark: the cruise, or what it can still stop from
      const want = Math.min(f.vmax, Math.sqrt(2 * f.amax * 0.5 * Math.max(d - ARRIVE_DIST, 0)) + 0.15);
      const dir = d > 1e-6 ? vscale(e, 1 / d) : [0, 0, 0];
      let a = [(dir[0] * want - v[0]) / TAU, 0, (dir[2] * want - v[2]) / TAU];
      const al = vlen(a);
      if (al > f.amax) a = vscale(a, f.amax / al);
      sim.physics.thrust(g, vscale(a, m));
    }
  }
}
