import { TILE } from '../shared/config.js';
import { Grid } from '../shared/grid.js';
import { GameMap } from '../shared/gamemap.js';
import { decodeGrid } from '../shared/leveldata.js';
import { moveProp } from '../shared/propdata.js';
import { setClosetState } from '../shared/closets.js';
import { BuiltSet } from '../shared/built.js';

/** A grid as the client holds it: the shared `Grid` (tiles, props, doors, pose) plus what the server has told us about it. */
export class GridReplica extends Grid {
  constructor(decoded, rects, o) {
    super(decoded, rects, o);
    const world = this.world;
    this.fdoors = this.props.fdoors.map((p, idx) => ({
      idx, grid: this, c: p.x, r: p.y, i: world.idx(p.x, p.y), x: p.x * TILE + TILE / 2, z: p.y * TILE + TILE / 2, closed: false, name: p.n || 'firelock', s: p.s, yaw: p.yaw,
    }));
    const na = world.areas.length;
    this.power = { state: 'normal', battery: 1, areaOn: new Uint8Array(na).fill(1), areaLights: new Uint8Array(na).fill(1) };
    this.built = new BuiltSet(world);        // girders and the like that players have built (shared/built.js)
  }
}

/**
 * The client's copy of the world: the same grids (tiles, doors, props) the server has, built from the same blueprints by the same code, kept in
 * step by the events the server sends. No game rules live here.
 */
export class Replica {
  constructor(assets, welcome) {
    this.assets = assets;
    this.level = assets.level;
    this.rects = assets.rects;
    this.map = new GameMap(welcome.map, welcome.name);
    this.grids = new Map();                  // id -> GridReplica
    this.station = null;
    this.items = new Map();                  // floor items: id -> {id, s, n, x, y, z, g}
    this.mobs = new Map();                   // id -> {id, n, job, set, kind, g, x, z, yaw, flags, speed, buf}
    this.round = welcome.round;
    this.roundAt = performance.now();
    this.jobs = welcome.jobs;
    this.me = welcome.you;
    this.name = welcome.name;
    this.debug = !!welcome.debug;            // the server was started with --debug: the debug menu exists
    this.self = null;                        // private state: inventory, vitals, access
    this.you = null;                         // last authoritative position
    this.env = { p: 101, o2: 21, tox: 0, area: 0 };
    this.alert = 'green';
    this.compat = {};                        // uses of the station shortcuts below (the move to explicit grids; stays zero once it is done)
    this.listeners = {};
    this.applyWelcome(welcome);
  }

  on(type, fn) { (this.listeners[type] ||= []).push(fn); }
  emit(type, ev) { const l = this.listeners[type]; if (l) for (const fn of l) fn(ev); }

  // The station's parts, for code that has not yet been told which grid it is about.
  get world() { return this.useStation('world').world; }
  get props() { return this.useStation('props').props; }
  get doors() { return this.useStation('doors').doors; }
  get fdoors() { return this.useStation('fdoors').fdoors; }
  get power() { return this.useStation('power').power; }
  get built() { return this.useStation('built').built; }
  useStation(what) { this.compat[what] = (this.compat[what] || 0) + 1; return this.station; }

  // ------------------------------------------------------------------ initial state
  applyWelcome(w) {
    for (const gs of w.grids) this.addGrid(gs, true);
    this.relink();
    for (const [id, s, n, x, y, z, g] of w.items) this.items.set(id, { id, s, n, x, y, z, g });
  }

  /** A grid exists: build it from its blueprint and bring it up to the state the server describes. */
  addGrid(gs, batch = false) {
    const decoded = decodeGrid(this.level, gs.bp);
    const g = new GridReplica(decoded, this.rects, { id: gs.g, kind: gs.kind, name: gs.name, tf: gs.tf });
    this.grids.set(g.id, g);
    this.map.add(g);
    if (!this.station && g.kind === 'station') this.station = g;
    g.power.state = gs.power.state; g.power.battery = gs.power.battery;
    gs.areaOn.forEach((v, i) => { g.power.areaOn[i] = v; });
    gs.areaLights.forEach((v, i) => { g.power.areaLights[i] = v; });
    g.world.gravityOn = gs.gravity !== false;
    for (const [id, k, c, r, st] of gs.built || []) g.built.add({ id, k, c, r, st, grid: g });
    for (const ev of gs.tiles) this.setTile(g, ev);
    for (const [c, r, d] of gs.panes) this.killPane(g, c, r, d);
    for (const [i, cs, gone] of gs.closets || []) this.setCloset(g, i, cs, !!gone);
    for (const [i, x, z, d] of gs.moved || []) this.moveProp(g, i, x, z, d);
    gs.doors.forEach((st, i) => { if (st !== 'closed') g.doors[i]?.setState(st); });
    gs.fdoors.forEach((c, i) => { if (c && g.fdoors[i]) this.setFdoor(g, g.fdoors[i], true); });
    if (!batch) this.relink();
    return g;
  }

  /** A grid has gone (a shuttle departed): everything on it goes with it. */
  removeGrid(id) {
    const g = this.grids.get(id);
    if (!g) return null;
    for (const [iid, it] of [...this.items]) if (it.g === id) this.items.delete(iid);
    this.map.remove(g);
    this.grids.delete(id);
    this.relink();
    return g;
  }

  /** Which grids lie over which (see GameMap.relink): needed for walking onto a docked shuttle and bumping into its hull. */
  relink() { this.map.relink(); }

  // ------------------------------------------------------------------ helpers
  setTile(g, ev) {
    const w = g.world, i = ev.i;
    w.kind[i] = ev.kind; w.wallVar[i] = ev.wall; w.glass[i] = ev.glass; w.solid[i] = ev.solid; w.airBlock[i] = ev.air;
    w.floorCell[i] = ev.floor; w.roof[i] = ev.roof; w.areaIdx[i] = ev.area;
    if (ev.brk) w.breached.add(i); else w.breached.delete(i);
    w.grille[i] = ev.gr ?? w.grille[i]; w.ws[i] = ev.ws ?? w.ws[i]; w.ft[i] = ev.ft ?? w.ft[i]; w.lat[i] = ev.lat ?? w.lat[i];
  }

  setCloset(g, i, cs, gone) {
    const it = g.props.interact[i];
    if (it?.kind === 'closet') setClosetState(g.world, it, cs, gone);
  }

  moveProp(g, i, x, z, d) {
    const it = g.props.interact[i];
    if (it) moveProp(g.world, it, x, z, d);
  }

  killPane(g, c, r, d) {
    const p = g.props.paneIdx.get(g.world.idx(c, r) * 16 + d);
    if (!p || p.dead) return null;
    p.dead = true;
    g.world.removeEdge(c, r, d);
    return p;
  }

  setFdoor(g, f, closed) {
    const { world } = g;
    f.closed = closed;
    const d = world.doorAt.get(f.i);
    if (closed) { world.solid[f.i] = 1; world.airBlock[f.i] = 1; }
    else { world.solid[f.i] = d && !d.passable ? 1 : 0; world.airBlock[f.i] = d && !d.isOpen ? 1 : 0; }
  }

  // ------------------------------------------------------------------ per-frame
  tick(dt) {
    for (const g of this.grids.values()) for (const d of g.doors) if (d.state === 'opening' || d.state === 'closing') d.tick(dt);
  }

  get roundClock() {
    if (!this.round || this.round.state !== 'playing') return this.round?.time || 0;
    return this.round.time + (performance.now() - this.roundAt) / 1000;
  }

  // ------------------------------------------------------------------ events
  apply(ev) {
    const g = ev.g !== undefined ? this.grids.get(ev.g) : null;
    switch (ev.e) {
      case 'door': g?.doors[ev.i]?.setState(ev.st); break;
      case 'fdoor': { const f = g?.fdoors[ev.i]; if (f) this.setFdoor(g, f, !!ev.c); break; }
      case 'tile': if (g) this.setTile(g, ev); break;
      case 'cl': if (g) this.setCloset(g, ev.i, ev.cs, !!ev.gn); break;
      case 'pm': if (g) this.moveProp(g, ev.i, ev.x, ev.z, ev.d); break;
      case 'imv': { const it = this.items.get(ev.id); if (it) { it.x = ev.x; it.z = ev.z; } break; }
      case 'pane': if (g) this.killPane(g, ev.c, ev.r, ev.d); break;
      case 'item+': this.items.set(ev.id, { id: ev.id, s: ev.s, n: ev.n, x: ev.x, y: ev.y, z: ev.z, g: ev.g }); break;
      case 'item-': this.lastRemoved = this.items.get(ev.id) || null; this.items.delete(ev.id); break;
      case 'power': if (g) { g.power.state = ev.state; g.power.battery = ev.battery; } break;
      case 'area': if (g) { g.power.areaOn[ev.a] = ev.on; g.power.areaLights[ev.a] = ev.lights; } break;
      case 'mob+': this.mobs.set(ev.id, { id: ev.id, n: ev.n, job: ev.job, set: ev.set, ap: ev.ap, kind: ev.kind, g: 0, x: 0, z: 0, yaw: 0, flags: 0, speed: 0, buf: [], fresh: true }); break;
      case 'look': { const m = this.mobs.get(ev.id); if (m) m.ap = ev.ap; break; }
      case 'mob-': break;                    // the view reads the mob before it is dropped (see Game.onEvent)
      case 'self': this.self = ev; break;
      case 'round': this.round = ev; this.roundAt = performance.now(); break;
      case 'alert': this.alert = ev.level; break;
      case 'grav': if (g) g.world.gravityOn = !!ev.on; break;
      case 'bs+': g?.built.add({ id: ev.id, k: ev.k, c: ev.c, r: ev.r, st: ev.st, grid: g }); break;
      case 'bs~': { const b = g?.built.get(ev.id); if (b) b.st = ev.st; break; }
      case 'bs-': g?.built.remove(ev.id); break;
      case 'grid+': if (!this.grids.has(ev.g)) { const ng = this.addGrid(ev); this.emit('grid+', { ...ev, grid: ng }); } return;
      case 'grid-': { const old = this.removeGrid(ev.g); if (old) this.emit('grid-', { ...ev, grid: old }); return; }
      default: break;
    }
    this.emit(ev.e, ev);
    if (ev.e === 'mob-') this.mobs.delete(ev.id);
  }

  /** A snapshot: fresh positions for everything near us. */
  applySnap(snap, now) {
    this.you = snap.you;
    if (snap.env) this.env = snap.env;
    for (const row of snap.mobs) {
      const [id, gid, x, z, yaw, flags, speed] = row;
      const m = this.mobs.get(id);
      if (!m) continue;
      m.flags = flags; m.speed = speed; m.dead = !!(flags & 1); m.crit = !!(flags & 2); m.lying = !!(flags & 16);
      m.buf.push({ t: now, g: gid, x, z, yaw });
      if (m.buf.length > 6) m.buf.shift();
      if (m.fresh) { m.fresh = false; m.g = gid; m.x = x; m.z = z; m.yaw = yaw; }
    }
  }

  /** My entry in the round's player list (lobby / playing / ghost). */
  get myState() {
    const p = this.round?.players?.find((q) => q.id === this.me);
    return p ? p.st : 'lobby';
  }

  get jobMap() { return this._jm || (this._jm = Object.fromEntries(this.jobs.map((j) => [j.id, j]))); }
}
