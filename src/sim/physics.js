import { TILE } from '../shared/config.js';
import { PhysicsWorld, physicsReady } from '../shared/physics.js';
import { tfClone, qrot, vsub, vcross } from '../shared/math3.js';

const DENSITY = 50;                 // kg per cubic metre of hull: a tile (4 m^3) is 200 kg, so a hundred-tile shuttle is 20 tonnes
const HEIGHT = 1;                   // how tall a grid's solid is for the physics (grids are flat for now; stage 4 makes this the deck's height)
const INSET = 0.12;                 // metres each box is drawn in from the tiles' edge: two hulls docked flush are not exactly touching, so a grid slides out of its slot and back in without catching
const REBUILD_EVERY = 1;            // seconds: a grid whose tiles changed gets its shape made again at most this often
const IMPACT_MIN = 30000;           // newtons of contact force that count as a collision between two grids

/**
 * The grids as rigid bodies: one physics world per map, one body per grid, its tiles as boxes. A docked grid is a fixed body (nothing moves it); a
 * flying one is dynamic and is pushed by `thrust` (see shuttle.js). Bodies are kept in their plane (they slide in x, z and turn about the vertical axis).
 * Each step the poses of the moving ones are written back to the grids, which is all the rest of the game ever reads: people on a grid are in its frame
 * and are not bodies at all, so nothing a grid does can move them.
 */
export class GridPhysics {
  constructor(sim) {
    if (!physicsReady()) throw new Error('physics is not started: await initPhysics() before making a Sim');
    this.sim = sim;
    this.worlds = new Map();          // map id -> PhysicsWorld
    this.shape = new Map();           // grid id -> a string that says what its boxes are (so an unchanged shape is not rebuilt)
    this.dirty = new Map();           // grid id -> sim time it may be rebuilt
    this.impactAt = new Map();        // grid id -> sim time of its last reported collision
  }

  world(map) {
    let w = this.worlds.get(map.id);
    if (!w) this.worlds.set(map.id, w = new PhysicsWorld());
    return w;
  }

  /** The solid of a grid as boxes: every tile that is not open space, merged into as few rectangles as it will go ({c: centre, h: half size, d: density}). */
  boxesOf(g) {
    const w = g.world, open = new Map(), out = [];
    const flush = (key) => { const b = open.get(key); open.delete(key); out.push(b); };
    for (let r = 0; r <= w.H; r++) {
      const runs = [];
      if (r < w.H) {
        let c = 0;
        while (c < w.W) {
          while (c < w.W && w.kind[w.idx(c, r)] === 0) c++;
          const c0 = c;
          while (c < w.W && w.kind[w.idx(c, r)] !== 0) c++;
          if (c > c0) runs.push([c0, c - 1]);
        }
      }
      const seen = new Set();
      for (const [c0, c1] of runs) {                       // a run directly under one of the same width goes on the same box
        const key = c0 + ',' + c1;
        seen.add(key);
        const b = open.get(key);
        if (b && b.r1 === r - 1) b.r1 = r;
        else { if (b) flush(key); open.set(key, { c0, c1, r0: r, r1: r }); }
      }
      for (const key of [...open.keys()]) if (!seen.has(key)) flush(key);
    }
    return out.map((b) => ({
      c: [(b.c0 + b.c1 + 1) * TILE / 2, HEIGHT / 2, (b.r0 + b.r1 + 1) * TILE / 2],
      h: [(b.c1 - b.c0 + 1) * TILE / 2 - INSET, HEIGHT / 2, (b.r1 - b.r0 + 1) * TILE / 2 - INSET],
      d: DENSITY,
    }));
  }

  add(g) {
    const w = this.world(g.map);
    w.addBody(g.id, { type: g.docked ? 'fixed' : 'dynamic', p: g.tf.p, q: g.tf.q, v: g.vel, w: g.ang, lock: g.free3d ? null : { y: true, rx: true, rz: true } });
    this.setShape(g);
  }

  remove(g) {
    for (const w of this.worlds.values()) w.removeBody(g.id);
    this.shape.delete(g.id); this.dirty.delete(g.id);
  }

  setShape(g) {
    const boxes = this.boxesOf(g), key = JSON.stringify(boxes);
    this.dirty.delete(g.id);
    if (this.shape.get(g.id) === key) return;
    this.shape.set(g.id, key);
    this.world(g.map).setBoxes(g.id, boxes);
  }

  /** The tiles of `g` changed (something was built or taken down): its shape is made again soon. */
  touch(g) { if (!this.dirty.has(g.id)) this.dirty.set(g.id, this.sim.time + REBUILD_EVERY); }

  mass(g) { return this.world(g.map).mass(g.id); }

  /** The first step builds the engine's own structures (about 80 ms for the station): do it now, not in the first tick of the round. */
  warm() { for (const w of this.worlds.values()) w.step(1e-4); }

  /** Hold the grid where it is (`docked`) or let it go. Docking puts it exactly on `pose` first. */
  setDocked(g, on, pose = null) {
    const w = this.world(g.map);
    if (pose) { g.tf = tfClone(pose); g.vel = [0, 0, 0]; g.ang = [0, 0, 0]; }
    w.setType(g.id, on ? 'fixed' : 'dynamic');
    if (on || pose) w.setPose(g.id, g.tf.p, g.tf.q, true);
  }

  /** Let a grid tip over and move in all three directions (`on`), or hold it level in its plane again: only the turn about the vertical is free by default. */
  setFree3d(g, on) {
    g.free3d = !!on;
    this.world(g.map).setLocks(g.id, on ? {} : { y: true, rx: true, rz: true });
  }

  /** Put it somewhere, standing still. */
  place(g, pose) {
    g.tf = tfClone(pose); g.vel = [0, 0, 0]; g.ang = [0, 0, 0];
    this.world(g.map).setPose(g.id, g.tf.p, g.tf.q, true);
  }

  thrust(g, f, t) { this.world(g.map).thrust(g.id, f, t); }
  setVel(g, v, w) { this.world(g.map).setVel(g.id, v, w); }

  step(dt) {
    const sim = this.sim;
    for (const [id, at] of this.dirty) if (sim.time >= at) { const g = sim.grids.get(id); if (g) this.setShape(g); else this.dirty.delete(id); }
    for (const [mid, w] of this.worlds) {
      const hits = w.step(dt);
      let any = false;
      for (const g of sim.grids.values()) {
        if (g.docked || g.map.id !== mid) continue;
        const p = w.pose(g.id);
        if (!p) continue;
        // the grid's own velocity is that of its origin (the point `tf.p` that everything on it is placed from), not of its centre of mass: a body leaving it needs `v + w x r` from there
        const v = vsub(p.v, vcross(p.w, qrot(p.q, w.centerOfMass(g.id))));
        const moved = p.p.some((x, i) => Math.abs(x - g.tf.p[i]) > 1e-5) || p.q.some((x, i) => Math.abs(x - g.tf.q[i]) > 1e-6) || v.some((x, i) => Math.abs(x - g.vel[i]) > 1e-4) || p.w.some((x, i) => Math.abs(x - g.ang[i]) > 1e-5);
        g.tf.p = p.p; g.tf.q = p.q; g.vel = v; g.ang = p.w;
        if (moved || g.poseSeq === undefined) { g.poseSeq = sim.tick; any = true; }               // clients are only told a pose that has changed
      }
      if (any) sim.maps.get(mid)?.linkVoid();
      for (const h of hits) sim.gridImpact(sim.grids.get(h.a), sim.grids.get(h.b), h.force);
    }
  }
}

export { IMPACT_MIN };
