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

  [Symbol.iterator]() { return this.grids.values(); }
}
