import { TILE, DECK_H } from '../shared/config.js';
import { Grid } from '../shared/grid.js';
import { GameMap } from '../shared/gamemap.js';
import { decodeGrid } from '../shared/leveldata.js';
import { moveProp, setPropAnchored } from '../shared/propdata.js';
import { qslerp } from '../shared/math3.js';
import { setClosetState } from '../shared/closets.js';
import { BuiltSet } from '../shared/built.js';
import { AreaPower } from '../shared/power.js';

/** A grid as the client holds it: the shared `Grid` (tiles, props, doors, pose) plus what the server has told us about it. */
export class GridReplica extends Grid {
  constructor(decoded, rects, o) {
    super(decoded, rects, o);
    const world = this.world;
    this.fdoors = this.props.fdoors.map((p, idx) => ({
      idx, grid: this, c: p.x, r: p.y, l: p.l | 0, i: world.idx(p.x, p.y, p.l | 0), x: p.x * TILE + TILE / 2, z: p.y * TILE + TILE / 2, closed: false, name: p.n || 'firelock', s: p.s, yaw: p.yaw,
    }));
    this.power = new AreaPower(world, false);   // what the server says of each room's power (welcome, then `area` events)
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
    if (!this.station) this.station = [...this.grids.values()].find((g) => g.kind !== 'void') || null;          // a map with no station (hyperspace, an away mission): its first grid is the one to fall back on
    this.relink();
    for (const [id, s, n, x, y, z, g, l] of w.items) this.items.set(id, { id, s, n, x, y, z, g, l: l | 0 });
  }

  /** We have moved to another map (the grid we are on was carried there): everything of the old one goes, and the new is built from what the server sends. */
  switchMap(w) {
    this.map = new GameMap(w.map, w.name);
    this.grids = new Map(); this.station = null; this.items = new Map(); this.mobs = new Map();
    this.applyWelcome(w);
  }

  /** A grid exists: build it from its blueprint and bring it up to the state the server describes. */
  addGrid(gs, batch = false) {
    if (gs.def) this.level.grids[gs.bp] = gs.def;                          // (a blueprint made while the game runs comes with the grid)
    const decoded = decodeGrid(this.level, gs.bp);
    const g = new GridReplica(decoded, this.rects, { id: gs.g, kind: gs.kind, name: gs.name, tf: gs.tf, docked: gs.docked });
    this.grids.set(g.id, g);
    this.map.add(g);
    if (!this.station && g.kind === 'station') this.station = g;
    if (gs.pw) {
      const p = g.power;
      p.metered.set(gs.pw.mt); p.operating.set(gs.pw.op); p.chan.set(gs.pw.ch); p.main.set(gs.pw.mn); p.lightSwitch.set(gs.pw.sw);
    }
    g.world.gravityOn = gs.gravity !== false;
    if (gs.ps?.length) g.addProps(gs.ps);
    for (const [s, b, c, y] of gs.pi || []) g.setPipe(s, b, c, y);
    for (const [i, n] of gs.pn || []) if (g.props.interact[i]) g.props.interact[i].name = n;
    for (const i of gs.dg || []) g.removeDoor(i);                                   // props made while the game runs, before anything that is about props by number
    for (const [id, k, c, r, st] of gs.built || []) g.built.add({ id, k, c, r, st, grid: g });
    for (const [i, st] of gs.lights || []) if (g.props.lights[i]) g.props.lights[i].status = st;
    for (const i of gs.gone || []) { const it = g.props.interact[i]; if (it) { it.gone = true; g.world.boxDrop(it); } }
    for (const [i, v] of gs.pv || []) { const it = g.props.interact[i]; if (it) it.pv = v; }
    for (const i of gs.pd || []) { const it = g.props.interact[i]; if (it) { it.dense = false; g.world.boxSet(it); } }
    for (const [i, a] of gs.pa || []) { const it = g.props.interact[i]; if (it) setPropAnchored(g.world, it, a); }
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
      case 'item+': this.items.set(ev.id, { id: ev.id, s: ev.s, n: ev.n, x: ev.x, y: ev.y, z: ev.z, g: ev.g, l: ev.l | 0 }); break;
      case 'item-': this.lastRemoved = this.items.get(ev.id) || null; this.items.delete(ev.id); break;
      case 'cable': if (g) { g.world.cable[ev.i] = ev.on; g.cableRev = (g.cableRev || 0) + 1; } break;
      case 'light': if (g && g.props.lights[ev.i]) g.props.lights[ev.i].status = ev.st; break;
      case 'pv': { const it = g?.props.interact[ev.i]; if (it) it.pv = ev.v; break; }
      case 'pd': { const it = g?.props.interact[ev.i]; if (it) { it.dense = !!ev.d; g.world.boxSet(it); } break; }
      case 'pa': { const it = g?.props.interact[ev.i]; if (it) setPropAnchored(g.world, it, ev.a); break; }
      case 'p+': if (g) g.addProps(ev.sp); break;
      case 'pipe': if (g) g.setPipe(ev.s, ev.b, ev.c, ev.y); break;
      case 'pn': { const it = g?.props.interact[ev.i]; if (it) it.name = ev.n; break; }
      case 'door-': g?.removeDoor(ev.i); break;
      case 'pg': { const it = g?.props.interact[ev.i]; if (it) { it.gone = true; g.world.boxDrop(it); } break; }
      case 'area': if (g) { g.power.set(ev.a, ev.op, ev.ch[0], ev.ch[1], ev.ch[2], ev.mn); g.power.lightSwitch[ev.a] = ev.sw; } break;
      case 'mob+': this.mobs.set(ev.id, { id: ev.id, n: ev.n, job: ev.job, set: ev.set, ap: ev.ap, kind: ev.kind, g: 0, x: 0, z: 0, l: 0, yaw: 0, flags: 0, speed: 0, buf: [], fresh: true }); break;
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
      case 'grid~': if (g) { g.docked = !!ev.docked; g.tf = { p: [...ev.tf.p], q: [...ev.tf.q] }; g.buf = []; this.relink(); this.emit('grid~', { ...ev, grid: g }); } return;
      default: break;
    }
    this.emit(ev.e, ev);
    if (ev.e === 'mob-') this.mobs.delete(ev.id);
  }

  /** A snapshot: fresh positions for everything near us. */
  applySnap(snap, now) {
    this.you = snap.you;
    if (snap.env) this.env = snap.env;
    for (const row of snap.grids || []) {                   // flying grids: [id, p (3), q (4), v (3), w (3)]
      const g = this.grids.get(row[0]);
      if (!g || g.docked) continue;
      g.buf.push({ t: now, p: row.slice(1, 4), q: row.slice(4, 8), v: row.slice(8, 11), w: row.slice(11, 14) });
      if (g.buf.length > 6) g.buf.shift();
    }
    for (const row of snap.mobs) {
      const [id, gid, x, z, yaw, flags, speed, y] = row;                    // (y only for someone floating in the void)
      const m = this.mobs.get(id);
      if (!m) continue;
      const l = (flags >> 8) & 15;                                          // (bits 8 to 11: the deck it is on)
      m.flags = flags; m.speed = speed; m.dead = !!(flags & 1); m.crit = !!(flags & 2); m.lying = !!(flags & 16); m.l = l;
      const gw = this.grids.get(gid)?.world;
      const h = gw && gw.levels > 1 ? l * DECK_H + gw.stairLift(x, z, l) : 0;                 // how high above the first deck's floor its feet are (up the slope, on a stair)
      m.buf.push({ t: now, g: gid, x, z, yaw, y: y ?? 0, l, h });
      if (m.buf.length > 6) m.buf.shift();
      if (m.fresh) { m.fresh = false; m.g = gid; m.x = x; m.z = z; m.yaw = yaw; m.y = y ?? 0; m.l = l; m.h = h; }
    }
  }

  /** Put every flying grid where it was at render time `rt` (between the two snapshots either side of it). */
  updatePoses(rt) {
    let moved = false;
    for (const g of this.grids.values()) {
      const b = g.buf;
      if (g.docked || !b.length) continue;
      moved = true;
      let a = b[0], c = b[0], k = 0;
      if (rt >= b[b.length - 1].t) a = c = b[b.length - 1];
      else if (rt > b[0].t) {
        for (let i = b.length - 2; i >= 0; i--) if (b[i].t <= rt) { a = b[i]; c = b[i + 1]; k = (rt - a.t) / Math.max(1e-4, c.t - a.t); break; }
      }
      g.tf = { p: [a.p[0] + (c.p[0] - a.p[0]) * k, a.p[1] + (c.p[1] - a.p[1]) * k, a.p[2] + (c.p[2] - a.p[2]) * k], q: k ? qslerp(a.q, c.q, k) : [...a.q] };
      g.vel = c.v; g.ang = c.w;
    }
    if (moved) this.map.linkVoid();                            // what a body floating free can bump into is where the grids are now
  }

  /** My entry in the round's player list (lobby / playing / ghost). */
  get myState() {
    const p = this.round?.players?.find((q) => q.id === this.me);
    return p ? p.st : 'lobby';
  }

  get jobMap() { return this._jm || (this._jm = Object.fromEntries(this.jobs.map((j) => [j.id, j]))); }
}
