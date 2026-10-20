import { TILE, KIND, DV, OPP, N, S, E, W, PLAYER_R, GRIP_REACH, WALL_H, DECK_H, DECK_THICK } from './config.js';
import { WS, WINDOWS } from './windows.js';
import { WALLS, RW } from './walls.js';

/**
 * One grid's tile store + collision + queries. Its own coordinates: x = col * TILE, z = row * TILE, y up; north is -z. Where the grid is
 * in its map (and which way it faces) is the `Grid`'s business; nothing in here knows. `levels` stacked decks share the arrays
 * (`idx(c, r, l)`: deck 0's tiles, then deck 1's, ...; deck `l` stands `DECK_H * l` above deck 0). A body on deck `l` has `st.l`; everything below that takes a
 * deck takes it last and defaults to 0, so a grid of one deck (all of them, so far) is read exactly as before. On a deck above the first, open space (`SPACE`) is a
 * hole: open air down to the deck below, and what is over it falls.
 */
export class World {
  constructor(assets) {
    const { level, w, h } = assets;
    this.W = w;
    this.H = h;
    this.levels = assets.levels ?? 1;
    this.n = w * h * this.levels;
    this.grid = null;                        // the Grid this is the tile store of (set by Grid)
    this.level = level;
    this.kind = assets.kind;
    this.roof = assets.roof;
    this.areaIdx = assets.area;
    this.floorCell = assets.floor;
    this.wallVar = assets.wall;
    this.ft = assets.ft;                     // what kind of floor each tile is (1 + index into level.floorTypes; 0 none)
    this.lat = assets.lat;                   // lattice over space: 1 lattice, 2 catwalk
    this.cable = assets.cab || new Uint8Array(w * h * (assets.levels ?? 1));         // a power cable under the tile (1): the network is made of these (src/sim/power/powernet.js)
    this.stairs = assets.stairs || new Uint8Array(w * h * (assets.levels ?? 1));   // stairs: the direction (N S E W bit) you leave the tile in to go up one deck
    this.areas = level.areas;
    this.variants = level.walls;

    const n = this.n;
    this.glass = new Uint8Array(n);          // wall-like block that is see-through (window)
    this.solid = new Uint8Array(n);          // blocks movement (walls, dense props, closed doors)
    this.boxes = new Map();                  // tile index -> the free-standing things (lockers, tanks) whose box touches it
    this.bcount = new Uint8Array(n);         // how many dense boxes touch the tile (so collides can skip most tiles quickly)
    this.dyn = new Uint8Array(n);            // how many dense boxes have their middle in the tile (pathfinding goes round them)
    this.edge = new Uint8Array(n);           // thin blockers on tile edges (bit per direction)
    this.edgeGlass = new Uint8Array(n);      // which of those edges are glass (for rays)
    this.tableH = new Float32Array(n);       // surface height of tables (items rest on them)
    this.doorAt = new Map();                 // tile index -> Door
    this.airBlock = new Uint8Array(n);       // blocks gas (walls, windows, closed doors)
    this.grille = new Uint8Array(n);         // a grille stands here (under every window, and still there when the glass is gone)
    this.ws = new Uint8Array(n);             // a window's state, see shared/windows.js (WS)
    this.hit = null;                         // what the last raycast stopped at

    this.hp = new Map();                     // destructible tile -> hit points
    this.breached = new Set();               // windows smashed during play (open frames; see ventsToSpace)
    this.holes = new Set();                  // walls taken down during play (open tiles; a hull breach too if they touch space)
    this.patchVariant = Math.max(0, this.variants.findIndex((v) => !v.glass && /reinforced/.test(v.name)));
    if (this.patchVariant < 0) this.patchVariant = 0;

    for (let i = 0; i < n; i++) {
      const k = this.kind[i];
      if (k === KIND.WALL) {
        const v = this.wallVar[i];
        if (v !== 0xffff && this.variants[v].glass) {
          this.glass[i] = 1;
          const win = WINDOWS[this.variants[v].name];
          this.hp.set(i, win ? win.hp : 30);
          this.grille[i] = this.variants[v].gr !== undefined ? 1 : 0;      // every spawner window has one
          this.ws[i] = win?.reinf ? WS.SECURE : WS.OUT_OF_FRAME;           // in the map they are fastened down
        } else {
          this.hp.set(i, v !== 0xffff && /reinforced/.test(this.variants[v].name) ? 900 : 400);
        }
        this.solid[i] = 1;
        this.airBlock[i] = 1;
      }
      // open space is not solid: you can float out into it (the edge of the map is the wall, see collides)
    }
    this.gravityOn = true;                   // this grid's gravity generator (debug menu / generator machine)
    this.neighbors = [];                     // other grids of the map that lie over this one's open space (see GameMap.relink): what the body can also bump into, and walk onto
    this.covered = new Uint8Array(n);        // open-space tiles another grid lies over: not space while it is docked (nothing leaks, the shuttle is there)
  }

  /** SS13 has_gravity(): none over open space or lattice, otherwise whatever this grid's generator is doing (a shuttle is a grid with its own). */
  hasGravity(x, z, l = 0) {
    const c = Math.floor(x / TILE), r = Math.floor(z / TILE);
    if (!this.inb(c, r, l)) return false;
    const k = this.kind[this.idx(c, r, l)];
    if (k === KIND.SPACE || k === KIND.LATTICE) return false;
    return this.gravityOn;
  }

  /**
   * Is tile (c, r) of deck `l` open space: a space tile that no docked grid lies over (and anything off the edge of the array)? On a deck above the first a space
   * tile is a hole, and it is open space only if what is under it is too, all the way down: a hole over a room is air.
   */
  isOpenSpace(c, r, l = 0) {
    if (!this.inb(c, r, l)) return true;
    const i = this.idx(c, r, l);
    if (this.kind[i] !== KIND.SPACE || this.covered[i]) return false;
    if (l === 0) return true;
    const below = this.kind[i - this.W * this.H];
    return below === KIND.SPACE ? this.isOpenSpace(c, r, l - 1) : below === KIND.LATTICE;
  }

  /** Something to push off from (Process_Spacemove's "backup"): lattice within a tile, or a wall / locker / window frame within arm's reach. */
  hasGrip(x, z, ignore = null, free = false, y = 0, l = 0) {
    void y;
    const c = Math.floor(x / TILE), r = Math.floor(z / TILE);
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (this.kindAt(c + dc, r + dr, l) === KIND.LATTICE) return true;
    return this.collides(x, z, PLAYER_R + GRIP_REACH, ignore, free, l);          // (the edge of the array is a wall to hold, unless you may go past it)
  }

  // ------------------------------------------------------------------ decks
  /** The deck tile index `i` is on. */
  levelOf(i) { return Math.floor(i / (this.W * this.H)); }

  /** Where something dropped at (c, r) on deck `l` comes to rest: the deck itself if its tile there is a floor (or a grating), else the next one down that is, else 0. */
  restDeck(c, r, l) {
    for (let k = Math.min(l, this.levels - 1); k > 0; k--) {
      const t = this.kind[this.idx(c, r, k)];
      if (t === KIND.FLOOR || t === KIND.LATTICE || t === KIND.WALL) return k;
    }
    return 0;
  }

  /** Height of the floor of deck `l`, in the grid's frame. */
  deckY(l) { return l * DECK_H; }

  /**
   * A stair is drawn as a slope that climbs a whole deck over the length of its tile, from where you step onto it to the edge where you leave it for the deck above.
   * This is how far up that slope (m) a body at (x, z) on deck `l` is, 0 anywhere else: the eye, and the picture of whoever is climbing, follow it, so that the step up
   * at the end of the stair (the body changing deck) is no jump at all.
   */
  stairLift(x, z, l = 0) {
    if (this.levels < 2) return 0;
    const c = Math.floor(x / TILE), r = Math.floor(z / TILE);
    if (!this.inb(c, r, l)) return 0;
    const d = this.stairs[this.idx(c, r, l)];
    if (!d) return 0;
    const fx = x / TILE - c, fz = z / TILE - r;
    const t = d & E ? fx : d & W ? 1 - fx : d & S ? fz : 1 - fz;
    return Math.max(0, Math.min(1, t)) * DECK_H;
  }

  /**
   * A window shatters. The tile turns into open floor (the floor that was under the window) with the frame still in
   * the way, so air passes but people do not. It only vents to space if it touches space (`ventsToSpace`).
   */
  setBreach(c, r) {
    const i = this.idx(c, r);
    this.kind[i] = KIND.FLOOR;
    this.glass[i] = 0;
    this.solid[i] = this.grille[i] ? 1 : 0;        // the grille still blocks you; with no grille it is just open floor
    this.airBlock[i] = 0;
    this.ws[i] = 0;
    this.hp.delete(i);
    this.breached.add(i);
  }

  // ------------------------------------------------------------------ floors, lattice and the space between
  /** The `level.floorTypes` entry of floor tile `i` ({k: 'plating' | 'tile' | 'engine', tile, n}), or null. */
  floorType(i) { return this.ft[i] ? this.level.floorTypes[this.ft[i] - 1] : null; }

  /** What a turf is called (the DM names): floor, plating, reinforced floor, lattice, catwalk, space. */
  floorName(i) {
    switch (this.kind[i]) {
      case KIND.SPACE: return 'space';
      case KIND.LATTICE: return this.lat[i] === 2 ? 'catwalk' : 'lattice';
      case KIND.FLOOR: return this.floorType(i)?.n || 'floor';
      default: return '';
    }
  }

  /** The floor type index (+ 1) of the first type of a class: 'plating', or 'engine' (the plain reinforced floor). */
  floorTypeId(klass) {
    if (!this._fti) this._fti = {};
    if (this._fti[klass] === undefined) {
      const types = this.level.floorTypes;
      const k = types.findIndex((t) => t.k === klass && (klass !== 'engine' || t.n === 'reinforced floor'));
      this._fti[klass] = k < 0 ? 0 : k + 1;
    }
    return this._fti[klass];
  }

  /** Which of the 8 neighbours of tile (c, r) are lattice or floor (N S E W NE NW SE SW = bits 0..7): what a lattice is drawn from. */
  latticeMask(c, r) {
    let mask = 0;
    const at = (dc, dr) => { const k = this.kindAt(c + dc, r + dr); return k === KIND.LATTICE || k === KIND.FLOOR; };
    if (at(0, -1)) mask |= 1; if (at(0, 1)) mask |= 2; if (at(1, 0)) mask |= 4; if (at(-1, 0)) mask |= 8;
    if (at(1, -1)) mask |= 16; if (at(-1, -1)) mask |= 32; if (at(1, 1)) mask |= 64; if (at(-1, 1)) mask |= 128;
    return mask;
  }

  /** The cell a lattice (or catwalk) tile should be drawn with, from what is around it. */
  latticeCell(c, r) {
    const i = this.idx(c, r);
    return this.level.latCells[this.lat[i] === 2 ? 'cat' : 'lat'][this.latticeMask(c, r)];
  }

  /** Put a lattice (or, with `catwalk`, a catwalk) on a space tile. Its neighbours' pictures change too: the caller redraws them (`latticeAround`). */
  makeLattice(c, r, catwalk = false) {
    const i = this.idx(c, r);
    this.kind[i] = KIND.LATTICE;
    this.lat[i] = catwalk ? 2 : 1;
    this.ft[i] = 0;
    this.solid[i] = 0;
    this.airBlock[i] = 0;
    this.floorCell[i] = this.latticeCell(c, r);
  }

  /** The lattice is cut away: open space again. */
  clearLattice(c, r) {
    const i = this.idx(c, r);
    this.kind[i] = KIND.SPACE;
    this.lat[i] = 0;
    this.floorCell[i] = 0xffff;
  }

  /** A floor is laid (over lattice or space, or on bare plating): its type and the cell it is drawn with. */
  setFloor(c, r, ftId, cell) {
    const i = this.idx(c, r);
    this.kind[i] = KIND.FLOOR;
    this.lat[i] = 0;
    this.ft[i] = ftId;
    this.floorCell[i] = cell;
  }

  /** The tiles around (c, r) that are lattice need drawing again (what is next to them changed): returns their indexes whose cell changed. */
  latticeAround(c, r) {
    const out = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const cc = c + dc, rr = r + dr;
      if (!this.inb(cc, rr)) continue;
      const i = this.idx(cc, rr);
      if (this.kind[i] !== KIND.LATTICE) continue;
      const cell = this.latticeCell(cc, rr);
      if (cell !== this.floorCell[i]) { this.floorCell[i] = cell; out.push(i); }
    }
    return out;
  }

  /** A plain or reinforced wall stands on tile (c, r): its `WALLS` key, else undefined (glass, shuttle walls, floor...). */
  wallKey(i) {
    if (this.kind[i] !== KIND.WALL || this.glass[i]) return undefined;
    const v = this.wallVar[i];
    const name = v === 0xffff ? undefined : this.variants[v]?.name;
    return WALLS[name] ? name : undefined;
  }

  /** A wall is taken down to its plating (the floor the DM's ScrapeAway leaves): open floor, nothing blocks you or the air. */
  dismantleWall(c, r, platingCell) {
    const i = this.idx(c, r);
    this.kind[i] = KIND.FLOOR;
    this.wallVar[i] = 0xffff;
    this.floorCell[i] = platingCell;
    this.glass[i] = 0;
    this.solid[i] = 0;
    this.airBlock[i] = 0;
    this.ws[i] = 0;
    this.hp.delete(i);
    this.holes.add(i);
  }

  /** A girder is plated: the tile becomes a wall (`WALLS` key) with all its layers on. */
  buildWall(c, r, key) {
    const i = this.idx(c, r);
    const v = this.variants.findIndex((x) => !x.glass && x.name === key);
    if (v < 0) return false;
    this.kind[i] = KIND.WALL;
    this.wallVar[i] = v;
    this.glass[i] = 0;
    this.solid[i] = 1;
    this.airBlock[i] = 1;
    this.ws[i] = RW.INTACT;
    this.hp.set(i, WALLS[key]?.hp ?? 400);
    this.holes.delete(i);
    return true;
  }

  /** The window variant (`WINDOWS` key) of glass tile `i`, whether it is still there or not. */
  windowKey(i) {
    const v = this.wallVar[i];
    return v === 0xffff ? undefined : this.variants[v]?.name;
  }

  /** A window's state: the DM `state` plus whether it is screwed down. An unscrewed window does not seal the tile (window.dm CanAtmosPass). */
  setWindowState(i, state, anchored) {
    this.ws[i] = (state & WS.STATE) | (anchored ? 0 : WS.UNANCHORED);
    this.airBlock[i] = anchored ? 1 : 0;
  }

  /** The grille on a tile whose window is gone is cut away (deconstruct()): open floor now. */
  removeGrille(c, r) {
    const i = this.idx(c, r);
    this.grille[i] = 0;
    this.ws[i] &= ~WS.GRILLE_LOOSE;
    if (this.breached.has(i)) this.solid[i] = 0;
  }

  /** A grille is put up again on a hole (rods, grille.dm / the stack recipe). */
  addGrille(c, r) {
    const i = this.idx(c, r);
    this.grille[i] = 1;
    this.ws[i] &= ~WS.GRILLE_LOOSE;
    if (this.breached.has(i)) this.solid[i] = 1;
  }

  /** A window is put on a grille: it stands there, loose (not screwed down), and does not seal yet. */
  restoreWindow(c, r, key) {
    const i = this.idx(c, r);
    const v = this.variants.findIndex((x) => x.glass && x.name === key);
    if (v < 0 || !this.grille[i]) return false;
    this.kind[i] = KIND.WALL;
    this.wallVar[i] = v;
    this.glass[i] = 1;
    this.solid[i] = 1;
    this.setWindowState(i, WS.OUT_OF_FRAME, false);
    this.hp.set(i, WINDOWS[key]?.hp ?? 30);
    this.breached.delete(i);
    return true;
  }

  /** True if tile `i` touches space (or lattice over space) directly: air leaves through it. A shuttle docked there is not space. */
  ventsToSpace(i) {
    const c = i % this.W, r = (i - c) / this.W;
    for (const d of [N, S, E, W]) {
      const cc = c + DV[d][0], rr = r + DV[d][1];
      if (this.isOpenSpace(cc, rr) || this.kindAt(cc, rr) === KIND.LATTICE) return true;
    }
    return false;
  }

  /** Broken windows and taken-down walls that let air out into space (the hull breaches). */
  ventTiles() {
    return [...this.breached, ...this.holes].filter((i) => this.ventsToSpace(i));
  }

  /** Weld a breach shut with a reinforced plate. */
  setPatched(c, r) {
    const i = this.idx(c, r);
    this.kind[i] = KIND.WALL;
    this.wallVar[i] = this.patchVariant;
    this.glass[i] = 0;
    this.solid[i] = 1;
    this.airBlock[i] = 1;
    this.grille[i] = 0;
    this.ws[i] = 0;
    this.hp.set(i, 500);
    this.breached.delete(i);
  }

  idx(c, r, l = 0) { return (l * this.H + r) * this.W + c; }
  inb(c, r, l = 0) { return c >= 0 && r >= 0 && c < this.W && r < this.H && l >= 0 && l < this.levels; }
  tileOf(x) { return Math.floor(x / TILE); }

  kindAt(c, r, l = 0) { return this.inb(c, r, l) ? this.kind[this.idx(c, r, l)] : KIND.SPACE; }
  isWallLike(c, r, l = 0) { return this.kindAt(c, r, l) === KIND.WALL; }
  opaque(c, r, l = 0) { const i = this.idx(c, r, l); return this.inb(c, r, l) && this.kind[i] === KIND.WALL && !this.glass[i]; }
  walkable(c, r, l = 0) { return this.inb(c, r, l) && !this.solid[this.idx(c, r, l)]; }
  areaAt(c, r, l = 0) { return this.areas[this.areaIdx[this.idx(c, r, l)]]; }

  // ------------------------------------------------------------------ free-standing things
  /*
   * A locker, tank or crate is not part of the tile grid: it is a box (`rec.x`, `rec.z`, half-width `rec.half`) that blocks you
   * while `rec.dense`, wherever it stands, so it can be dragged about smoothly. The tiles it touches list it for collision.
   */
  boxTiles(rec) {
    const T = TILE, e = 1e-4, out = [];
    const c0 = Math.floor((rec.x - rec.half) / T), c1 = Math.floor((rec.x + rec.half - e) / T);
    const r0 = Math.floor((rec.z - rec.half) / T), r1 = Math.floor((rec.z + rec.half - e) / T);
    const l = rec.l | 0;
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (this.inb(c, r, l)) out.push(this.idx(c, r, l));
    return out;
  }

  /** Start tracking a free-standing box (it blocks if `rec.dense`). */
  boxAdd(rec) {
    this.boxDrop(rec);
    rec.tiles = this.boxTiles(rec);
    rec.mid = this.idx(Math.floor(rec.x / TILE), Math.floor(rec.z / TILE), rec.l | 0);
    rec.counted = false;
    for (const i of rec.tiles) {
      let list = this.boxes.get(i);
      if (!list) this.boxes.set(i, list = []);
      list.push(rec);
    }
    this.boxSet(rec);
  }

  /** Apply `rec.dense` (it changed, or it was just added). */
  boxSet(rec) {
    if (!rec.tiles) { this.boxAdd(rec); return; }
    const want = !!rec.dense;
    if (want === !!rec.counted) return;
    rec.counted = want;
    const d = want ? 1 : -1;
    for (const i of rec.tiles) this.bcount[i] += d;
    this.dyn[rec.mid] += d;
  }

  boxDrop(rec) {
    if (!rec.tiles) return;
    if (rec.counted) { for (const i of rec.tiles) this.bcount[i]--; this.dyn[rec.mid]--; }
    for (const i of rec.tiles) {
      const list = this.boxes.get(i);
      if (!list) continue;
      const k = list.indexOf(rec);
      if (k >= 0) list.splice(k, 1);
      if (!list.length) this.boxes.delete(i);
    }
    rec.tiles = null; rec.counted = false;
  }

  /** Put a free-standing box somewhere else. */
  boxMove(rec, x, z) {
    this.boxDrop(rec);
    rec.x = x; rec.z = z;
    this.boxAdd(rec);
  }

  /** Mark a thin blocker on the `d` edge of tile (c, r) (mirrored on the neighbour). */
  addEdge(c, r, d, glass = false, l = 0) {
    if (!this.inb(c, r, l)) return;
    const i = this.idx(c, r, l);
    this.edge[i] |= d;
    if (glass) this.edgeGlass[i] |= d;
    const [dc, dr] = DV[d];
    if (this.inb(c + dc, r + dr, l)) {
      const j = this.idx(c + dc, r + dr, l);
      this.edge[j] |= OPP[d];
      if (glass) this.edgeGlass[j] |= OPP[d];
    }
  }

  removeEdge(c, r, d, l = 0) {
    const i = this.idx(c, r, l);
    this.edge[i] &= ~d;
    this.edgeGlass[i] &= ~d;
    const [dc, dr] = DV[d];
    if (this.inb(c + dc, r + dr, l)) {
      const j = this.idx(c + dc, r + dr, l);
      this.edge[j] &= ~OPP[d];
      this.edgeGlass[j] &= ~OPP[d];
    }
  }

  /**
   * Axis-aligned box (half-size `h`) vs tiles + thin edges + free-standing boxes (not `ignore`, which is the one being moved), and the same
   * in each grid that lies over this one's open space and might be in the way (a docked shuttle's hull is solid from the station's side too).
   * The edge of the array is a wall, unless `free`: the body may go past it (it leaves the grid, see frames.js `settle`).
   */
  collides(x, z, h, ignore = null, free = false, l = 0) {
    if (this.collidesTiles(x, z, h, ignore, !free, l)) return true;
    for (const nb of this.neighbors) {
      const [x0, z0, x1, z1] = nb.rect;
      if (x + h <= x0 || x - h >= x1 || z + h <= z0 || z - h >= z1) continue;      // nowhere near that grid
      if (nb.world.collidesTiles(nb.a * x + nb.b * z + nb.tx, nb.c * x + nb.d * z + nb.tz, h, ignore, false, l)) return true;
    }
    return false;
  }

  /** This grid's own tiles only. Off the edge of the array is a wall when `edgeSolid` (your own grid), and nothing at all otherwise (it is another grid's business). */
  collidesTiles(x, z, h, ignore, edgeSolid, l = 0) {
    const c0 = Math.floor((x - h) / TILE), c1 = Math.floor((x + h) / TILE);
    const r0 = Math.floor((z - h) / TILE), r1 = Math.floor((z + h) / TILE);
    const T = TILE, th = 0.07;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (!this.inb(c, r, l)) { if (edgeSolid) return true; continue; }
        const i = this.idx(c, r, l);
        if (this.solid[i]) return true;
        if (this.bcount[i]) {
          for (const b of this.boxes.get(i)) if (b !== ignore && b.dense && Math.abs(x - b.x) < b.half + h && Math.abs(z - b.z) < b.half + h) return true;
        }
        const e = this.edge[i];
        if (e) {
          const x0 = c * T, z0 = r * T, x1 = x0 + T, z1 = z0 + T;
          if ((e & N) && x + h > x0 && x - h < x1 && z + h > z0 - th && z - h < z0 + th) return true;
          if ((e & S) && x + h > x0 && x - h < x1 && z + h > z1 - th && z - h < z1 + th) return true;
          if ((e & W) && z + h > z0 && z - h < z1 && x + h > x0 - th && x - h < x0 + th) return true;
          if ((e & E) && z + h > z0 && z - h < z1 && x + h > x1 - th && x - h < x1 + th) return true;
        }
      }
    }
    return false;
  }

  /**
   * A ball of radius `h` with its middle at (x, y, z) in this grid's frame (y up from the first deck's floor), for something that is not walking on a deck but flying
   * about outside or through it: for each deck it reaches into, the walls, doors, edges and things of `collidesTiles` where it is as high as they are, the floor under it
   * (a slab at the deck: 0.1 thick on the first, `DECK_THICK` on the ones above it, which is also the ceiling of the deck below) and, on the top deck, the roof over it
   * where the tile has one.
   */
  collidesTiles3(x, y, z, h, ignore = null, slabs = true) {
    const c0 = Math.floor((x - h) / TILE), c1 = Math.floor((x + h) / TILE), r0 = Math.floor((z - h) / TILE), r1 = Math.floor((z + h) / TILE);
    for (let l = 0; l < this.levels; l++) {
      const lo = y - h - l * DECK_H, hi = y + h - l * DECK_H;                                  // the ball, in this deck's own heights
      if (hi < -(l ? DECK_THICK : 0.1) || lo > WALL_H + 0.1) continue;                           // not within reach of this deck at all
      if (hi > -0.1 && lo < WALL_H && this.collidesTiles(x, z, h, ignore, false, l)) return true;
      if (!slabs) continue;
      const slab = lo < 0 && hi > -(l ? DECK_THICK : 0.1), top = l === this.levels - 1 && hi > WALL_H && lo < WALL_H + 0.1;
      if (!slab && !top) continue;
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        if (!this.inb(c, r, l)) continue;
        const i = this.idx(c, r, l), k = this.kind[i];
        if (k === KIND.FLOOR) { if (slab) return true; if (top && this.roof[i]) return true; }
      }
    }
    return false;
  }

  /** Slide an entity with half-size h by (dx, dz) on its deck (`pos.l`); returns true if blocked on either axis. */
  move(pos, dx, dz, h, ignore = null, free = false) {
    let blocked = false;
    const l = pos.l | 0;
    if (dx !== 0) {
      if (!this.collides(pos.x + dx, pos.z, h, ignore, free, l)) pos.x += dx; else blocked = true;
    }
    if (dz !== 0) {
      if (!this.collides(pos.x, pos.z + dz, h, ignore, free, l)) pos.z += dz; else blocked = true;
    }
    return blocked;
  }

  /**
   * Grid DDA. Returns distance to the first blocking tile along the ray (or maxDist).
   * mode 'sight': walls + closed doors block; glass does not.   mode 'shot': glass blocks too.
   */
  raycast(ox, oz, dx, dz, maxDist, mode = 'sight', l = 0) {
    const len = Math.hypot(dx, dz);
    if (len === 0) return maxDist;
    dx /= len; dz /= len;
    let c = Math.floor(ox / TILE), r = Math.floor(oz / TILE);
    const stepC = dx > 0 ? 1 : -1, stepR = dz > 0 ? 1 : -1;
    const tDeltaC = dx !== 0 ? Math.abs(TILE / dx) : Infinity;
    const tDeltaR = dz !== 0 ? Math.abs(TILE / dz) : Infinity;
    let tMaxC = dx !== 0 ? ((dx > 0 ? (c + 1) * TILE - ox : ox - c * TILE) / Math.abs(dx)) : Infinity;
    let tMaxR = dz !== 0 ? ((dz > 0 ? (r + 1) * TILE - oz : oz - r * TILE) / Math.abs(dz)) : Infinity;
    let t = 0;
    for (let guard = 0; guard < 512; guard++) {
      if (!this.inb(c, r, l)) return t;
      const i = this.idx(c, r, l);
      if (this.blocksRay(i, mode)) { this.hit = { kind: 'tile', i, c, r }; return t; }
      let dir;
      if (tMaxC < tMaxR) { t = tMaxC; tMaxC += tDeltaC; c += stepC; dir = stepC > 0 ? W : E; }
      else { t = tMaxR; tMaxR += tDeltaR; r += stepR; dir = stepR > 0 ? N : S; }
      if (t >= maxDist) return maxDist;
      // thin edges crossed between tiles
      const pi = (dir === W || dir === E) ? this.idx(c - stepC, r, l) : this.idx(c, r - stepR, l);
      const e = this.edge[pi];
      if (e) {
        const crossed = (dir === W) ? E : (dir === E) ? W : (dir === N) ? S : N;
        if ((e & crossed) && (mode === 'shot' || !(this.edgeGlass[pi] & crossed))) { this.hit = { kind: 'edge', i: pi, bit: crossed }; return t; }
      }
    }
    return maxDist;
  }

  blocksRay(i, mode) {
    const k = this.kind[i];
    if (k === KIND.WALL) return mode === 'shot' || !this.glass[i];
    if (k === KIND.SPACE) return false;
    const d = this.doorAt.get(i);
    if (d && d.blocksSight()) return true;
    return false;
  }

  /** Line of sight between two points (ignores glass). */
  los(x0, z0, x1, z1, l = 0) {
    const dx = x1 - x0, dz = z1 - z0;
    const dist = Math.hypot(dx, dz);
    if (dist < 1e-4) return true;
    return this.raycast(x0, z0, dx, dz, dist, 'sight', l) >= dist - 1e-3;
  }
}
