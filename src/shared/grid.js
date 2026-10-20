import { World } from './world.js';
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
    this.spawns = decoded.spawns;               // where jobs start: [{ job, x, y }] in tiles
    this.evac = decoded.evac;                   // the emergency shuttle's overlay, until shuttles are grids of their own
    this.map = null;                            // set by GameMap.add
    this.tf = o.tf ? tfClone(o.tf) : tfIdentity();
    this.vel = [0, 0, 0];                       // m/s, in the map's coordinates
    this.ang = [0, 0, 0];                       // rad/s
    this.world = new World(decoded);
    this.world.grid = this;
    this.props = buildPropData(this.world, rects, decoded.props, decoded.level);
    this.doors = this.props.doors.map((p, i) => this.makeDoor(p, i));
  }

  /** A door for prop record `p`, number `idx` in this grid's own list (clients and server count them the same way). */
  makeDoor(p, idx) {
    const d = new DoorCore(this.world, p, p.fr.length - 2);
    d.grid = this;
    d.idx = idx;
    return d;
  }

  /** Doors made from props added later (the evacuation overlay, for now); the numbering carries on. */
  addDoors(protos) {
    for (const p of protos) this.doors.push(this.makeDoor(p, this.doors.length));
  }

  get gravityOn() { return this.world.gravityOn; }
  set gravityOn(v) { this.world.gravityOn = !!v; }

  /** A point in this grid's frame ([x, y, z]) -> its map's coordinates. */
  worldPoint(x, y, z) { return tfPoint(this.tf, [x, y, z]); }
  /** A point in the map's coordinates -> this grid's frame. */
  localPoint(p) { return tfInvPoint(this.tf, p); }
  /** A direction in this grid's frame -> the map's. */
  worldDir(d) { return tfDir(this.tf, d); }
}
