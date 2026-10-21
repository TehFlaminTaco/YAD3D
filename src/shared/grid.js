import { World } from './world.js';
import { VoidWorld } from './voidworld.js';
import { buildPropData } from './propdata.js';
import { DoorCore } from './door.js';
import { tfClone, tfIdentity, tfPoint, tfInvPoint, tfDir } from './math3.js';

/**
 * A grid: one independent tile map (a station, a shuttle, an escape pod) that floats in a map as a rigid body. Both sides build the same:
 * the tile store (`world`), the props and doors derived from the blueprint in a fixed order (so `props.interact[i]` and `doors[i]` mean the
 * same thing on the server and on every client), and the pose.
 *
 * Everything on a grid (people, items, doors, props) has its coordinates in the grid's own frame: x = col * TILE, z = row * TILE. Only
 * `worldPoint` / `localPoint` know where the grid is. That is the whole of "a grid's movement never directly affects its inhabitants": moving
 * the grid changes `tf`, and nothing local changes at all.
 */
export class Grid {
  /** `decoded` is `decodeGrid(level, bp)`; `o`: { id, kind, name, tf } with tf = { p: [x, y, z], q: [x, y, z, w] } in the map's coordinates. */
  constructor(decoded, rects, o = {}) {
    this.id = o.id;
    this.bp = decoded.bp;
    this.kind = o.kind || 'station';            // station | shuttle | pod | ...
    this.name = o.name || decoded.bp;
    this.level = decoded.level;
    this.rects = rects;                         // the sprite rectangles props are built with (also for props made while the game runs)
    this.spawns = decoded.spawns;               // where jobs start: [{ job, x, y }] in tiles
    this.map = null;                            // set by GameMap.add
    this.tf = o.tf ? tfClone(o.tf) : tfIdentity();
    this.home = tfClone(this.tf);               // where it is docked (or was put): where a flight home ends
    this.docked = o.docked !== false;           // held in its place (the station, a docked shuttle): it lies against its neighbours (see GameMap.relink); false = flying free
    this.vel = [0, 0, 0];                       // m/s, in the map's coordinates
    this.ang = [0, 0, 0];                       // rad/s
    this.buf = [];                              // (client) snapshots of its pose, to draw it between
    this.world = decoded.void ? new VoidWorld(decoded) : new World(decoded);
    this.world.grid = this;
    this.props = buildPropData(this.world, rects, decoded.props, decoded.level);
    this.doors = this.props.doors.map((p, i) => this.makeDoor(p, i));
  }

  /**
   * Props made while the game runs (a machine fastened down, a structure put up): `specs` are records like the level's own (`{k, x, y, l, d, s, p, ...}`, x and y the tile), built by the
   * same code and appended to the same lists, so both sides count them alike (the server sends the specs, in order, and a late joiner gets them all). Returns what was added
   * (`props.added`: `interact`, `statics`, `doors`, `lights`...).
   */
  addProps(specs) {
    buildPropData(this.world, this.rects, specs, this.level, this.props);
    const added = this.props.added;
    for (const p of added.doors) this.doors.push(this.makeDoor(p, this.doors.length));
    return added;
  }

  /** A door for prop record `p`, number `idx` in this grid's own list (clients and server count them the same way). */
  makeDoor(p, idx) {
    const d = new DoorCore(this.world, p, p.fr.length - 2);
    d.grid = this;
    d.idx = idx;
    return d;
  }

  /** The box of tiles that are not open space, [c0, r0, c1, r1] inclusive (cached: a grid does not grow beyond its array), or null for an empty grid. */
  bounds() {
    if (this._bounds !== undefined) return this._bounds;
    const w = this.world;
    let c0 = w.W, r0 = w.H, c1 = -1, r1 = -1;
    for (let r = 0; r < w.H; r++) for (let c = 0; c < w.W; c++) {
      let any = false;
      for (let l = 0; l < w.levels && !any; l++) any = w.kind[w.idx(c, r, l)] !== 0;
      if (!any) continue;
      if (c < c0) c0 = c; if (c > c1) c1 = c; if (r < r0) r0 = r; if (r > r1) r1 = r;
    }
    return (this._bounds = c1 < 0 ? null : [c0, r0, c1, r1]);
  }

  /** Is it tipped off level (turned about a horizontal axis as well as, or instead of, the vertical)? A level grid can lie against another and be walked onto across a seam. */
  get tilted() { const q = this.tf.q; return Math.abs(q[0]) > 1e-6 || Math.abs(q[2]) > 1e-6; }

  get gravityOn() { return this.world.gravityOn; }
  set gravityOn(v) { this.world.gravityOn = !!v; }

  /** A point in this grid's frame ([x, y, z]) -> its map's coordinates. */
  worldPoint(x, y, z) { return tfPoint(this.tf, [x, y, z]); }
  /** A point in the map's coordinates -> this grid's frame. */
  localPoint(p) { return tfInvPoint(this.tf, p); }
  /** A direction in this grid's frame -> the map's. */
  worldDir(d) { return tfDir(this.tf, d); }
}
