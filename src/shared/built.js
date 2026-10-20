import { KIND } from './config.js';

/**
 * Things the players build at run time and that are not part of the map (girders now; table frames, machine frames later): a record per
 * thing, `{id, k, c, r, st}` (kind, tile, state). Both sides keep one in step through the `bs+` / `bs~` / `bs-` events. Each is dense and
 * takes its tile's `solid` while it stands there. At most one to a tile, which is what the DM's `one_per_turf` recipes ask for anyway.
 */
export class BuiltSet {
  constructor(world) {
    this.world = world;
    this.byId = new Map();
    this.byTile = new Map();
  }

  add(rec) {
    const { world } = this;
    const i = world.idx(rec.c, rec.r);
    this.byId.set(rec.id, rec);
    this.byTile.set(i, rec);
    world.solid[i] = 1;
    return rec;
  }

  remove(id) {
    const rec = this.byId.get(id);
    if (!rec) return null;
    const { world } = this;
    const i = world.idx(rec.c, rec.r);
    this.byId.delete(id);
    if (this.byTile.get(i) === rec) this.byTile.delete(i);
    if (world.kind[i] !== KIND.WALL) world.solid[i] = 0;          // the tile is walkable again unless something else stands there
    return rec;
  }

  get(id) { return this.byId.get(id); }
  at(c, r) { return this.byTile.get(r * this.world.W + c); }
  [Symbol.iterator]() { return this.byId.values(); }
  get size() { return this.byId.size; }
}
