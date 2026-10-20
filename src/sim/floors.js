import { TILE, KIND } from '../shared/config.js';
import { consume } from './inventory.js';
import { toolJob } from './tooljob.js';

const isRods = (it) => it?.def.sheet === 'rods';
const isTile = (it) => !!it?.def.tile;

/**
 * Floors, plating, tiles, lattice and catwalks: floor.dm, plating.dm, reinf_floor.dm, lattice.dm and space.dm (tgstation 2d6c10c1).
 * A tile floor is pried up with a crowbar (at once) and leaves its tile and plating; plating takes a tile again (at once) or two rods
 * (30 ds) that make it a reinforced floor, which a wrench (30 ds) takes back to plating and two rods. Over space, a rod makes a lattice,
 * another a catwalk, wirecutters cut either away, and a plasteel tile on either makes plating. Messages are the DM's.
 */
export class Floors {
  constructor(sim) { this.sim = sim; }

  /** The tile behind a `floor` target. */
  floor(g, t) {
    const w = g.world;
    if (!w.inb(t.c, t.r)) return null;
    const i = w.idx(t.c, t.r), kind = w.kind[i];
    if (kind === KIND.WALL) return null;
    return { k: 'floor', grid: g, c: t.c, r: t.r, i, name: w.floorName(i), x: t.c * TILE + 1, z: t.r * TILE + 1, reach: 4.8, alive: () => true, state: () => w.kind[i] * 10000 + w.ft[i] * 10 + w.lat[i] };
  }

  /** A tile changed: the air, the clients, and the lattice around it that is drawn from what stands next to it. */
  changed(g, c, r) {
    const sim = this.sim, w = g.world;
    const around = w.latticeAround(c, r);
    sim.tileChanged(g, c, r);
    for (const i of around) if (i !== w.idx(c, r)) sim.emitTile(g, i);
  }

  /** The plating a floor is taken down to. */
  toPlating(g, c, r) {
    const w = g.world;
    w.setFloor(c, r, w.floorTypeId('plating'), w.level.terrain.plating);
    this.changed(g, c, r);
  }

  at(th) { return [th.x + (this.sim.rand() - 0.5) * 0.8, th.z + (this.sim.rand() - 0.5) * 0.8]; }

  use(m, item, n) {
    item.amount -= n;
    if (item.amount <= 0) consume(this.sim, item);
  }

  /** A click on a floor, plating, lattice or open space with `held`. Returns false when nothing here answers to it. */
  click(m, t, held) {
    const sim = this.sim, g = t.grid, w = g.world, th = this.floor(g, t);
    if (!th || !held) return true;
    const { c, r, i } = th, tool = held.def.tool, kind = w.kind[i];
    const level = w.level;

    // ---- open space
    if (kind === KIND.SPACE) {
      if (isRods(held)) {
        this.use(m, held, 1);
        w.makeLattice(c, r);
        sim.sound('drop', th, 0.6);
        sim.tell(m, 'notice', 'You construct a lattice.');
        this.changed(g, c, r);
        return true;
      }
      if (held.path.startsWith('/obj/item/stack/tile/plasteel')) {
        sim.tell(m, 'warning', 'The plating is going to need some support! Place metal rods first.');
        return true;
      }
      return false;
    }

    // ---- lattice and catwalk
    if (kind === KIND.LATTICE) {
      if (tool === 'wirecutters') {
        const catwalk = w.lat[i] === 2;
        sim.tell(m, 'notice', `Slicing ${catwalk ? 'catwalk' : 'lattice'} joints ...`);
        sim.sound('wirecutter', th, 0.9);
        w.clearLattice(c, r);
        sim.stacks.spawn(g, '/obj/item/stack/rods', catwalk ? 2 : 1, ...this.at(th));
        this.changed(g, c, r);
        return true;
      }
      if (isRods(held)) {
        if (w.lat[i] === 2) { sim.tell(m, 'warning', 'There is already a catwalk here!'); return true; }
        this.use(m, held, 1);
        w.makeLattice(c, r, true);
        sim.sound('drop', th, 0.6);
        sim.tell(m, 'notice', 'You construct a catwalk.');
        this.changed(g, c, r);
        return true;
      }
      if (held.path.startsWith('/obj/item/stack/tile/plasteel')) {
        this.use(m, held, 1);
        w.lat[i] = 0;
        w.setFloor(c, r, w.floorTypeId('plating'), level.terrain.plating);
        sim.sound('drop', th, 0.6);
        sim.tell(m, 'notice', 'You build a floor.');
        this.changed(g, c, r);
        return true;
      }
      return false;
    }

    // ---- a floor
    if (kind !== KIND.FLOOR) return false;
    const type = w.floorType(i);
    if (!type) return false;                      // the shuttle and the like: not ours to take apart

    if (type.k === 'engine') {
      if (tool !== 'wrench') return false;
      toolJob(sim, m, th, held, th.state(), {
        label: 'removing the rods', ds: 30, sfx: 'wrench', start: 'You begin removing rods...',
        done: () => {
          if (type.tile) sim.stacks.spawn(g, type.tile, 2, ...this.at(th));
          this.toPlating(g, c, r);
        },
      });
      return true;
    }

    if (type.k === 'tile') {
      if (tool === 'crowbar') {                   // pry_tile(): at once
        sim.sound('crowbar', th, 0.8);
        sim.tell(m, 'notice', 'You remove the floor tile.');
        if (type.tile && level.itemdefs[type.tile]) sim.stacks.spawn(g, type.tile, 1, ...this.at(th));
        this.toPlating(g, c, r);
        return true;
      }
      if (isTile(held)) {                         // try_replace_tile(): needs a crowbar in the other hand
        const tile = level.tiles[this.baseTile(held.path)];
        if (!tile || tile.ft === w.ft[i]) return true;
        const crowbar = [m.hands[0], m.hands[1]].find((h) => h?.def.tool === 'crowbar');
        if (!crowbar) return true;
        sim.sound('crowbar', th, 0.8);
        if (type.tile && level.itemdefs[type.tile]) sim.stacks.spawn(g, type.tile, 1, ...this.at(th));
        this.toPlating(g, c, r);
        this.lay(m, th, held);
        return true;
      }
      return false;
    }

    // plating
    if (isTile(held)) { this.lay(m, th, held); return true; }
    if (isRods(held)) {
      if ((held.amount ?? 1) < 2) { sim.tell(m, 'warning', 'You need two rods to make a reinforced floor!'); return true; }
      toolJob(sim, m, th, held, th.state(), {
        label: 'reinforcing the floor', ds: 30, sfx: null, start: 'You begin reinforcing the floor...',
        valid: () => (held.amount ?? 1) >= 2,
        done: () => {
          this.use(m, held, 2);
          w.setFloor(c, r, w.floorTypeId('engine'), level.terrain.engine);
          sim.sound('pickup', th, 0.8);
          sim.tell(m, 'notice', 'You reinforce the floor.');
          this.changed(g, c, r);
        },
      });
      return true;
    }
    return false;
  }

  /** A tile item's path with its sub-types folded in (carpet/blue is its own; anything else is the registered entry it starts with). */
  baseTile(path) {
    const tiles = this.sim.level.tiles;
    return Object.keys(tiles).filter((k) => path.startsWith(k)).sort((p, q) => q.length - p.length)[0];
  }

  /** plating.dm attackby: a tile goes down at once. */
  lay(m, th, held) {
    const sim = this.sim, w = th.grid.world, tile = w.level.tiles[this.baseTile(held.path)];
    if (!tile) return;
    this.use(m, held, 1);
    w.setFloor(th.c, th.r, tile.ft, tile.cell);
    sim.sound('drop', th, 0.6);
    this.changed(th.grid, th.c, th.r);
  }

  // ------------------------------------------------------------------ examine
  examine(g, t) {
    const th = this.floor(g, t);
    if (!th) return [];
    const w = g.world, kind = w.kind[th.i];
    if (kind === KIND.SPACE) return ['Space.'];
    if (kind === KIND.LATTICE) {
      return w.lat[th.i] === 2
        ? ['A catwalk for easier EVA maneuvering and cable placement.', 'The supporting rods look like they could be cut.']
        : ['A lightweight support lattice. These hold our station together.', "The rods look like they could be cut. There's space for more rods or a tile."];
    }
    const type = w.floorType(th.i);
    if (type?.k === 'plating') return ['There are a few attachment holes for a new tile or reinforcement rods.'];
    if (type?.k === 'engine') return ['Extremely sturdy.', 'The reinforcement rods are wrenched firmly in place.'];
    return [`This is ${/^[aeiou]/i.test(th.name) ? 'an' : 'a'} ${th.name}.`];
  }
}
