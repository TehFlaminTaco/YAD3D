import { TILE, KIND } from '../shared/config.js';
import { World } from '../shared/world.js';
import { DoorCore } from '../shared/door.js';
import { buildPropData, moveProp } from '../shared/propdata.js';
import { setClosetState } from '../shared/closets.js';

/**
 * The client's copy of the world: the same tile grid, doors and prop tables the server has (built from the
 * same level data by the same code), kept in step by the events the server sends. No game rules live here.
 */
export class Replica {
  constructor(assets, welcome) {
    this.assets = assets;
    this.level = assets.level;
    this.rects = assets.rects;
    const world = this.world = new World(assets);
    this.props = buildPropData(world, this.rects, this.level.props, this.level);
    this.doors = this.props.doors.map((p) => new DoorCore(world, p, p.fr.length - 2));
    this.fdoors = this.props.fdoors.map((p, idx) => ({
      idx, c: p.x, r: p.y, i: p.y * world.W + p.x, x: p.x * TILE + TILE / 2, z: p.y * TILE + TILE / 2, closed: false, name: p.n || 'firelock', s: p.s,
    }));
    const na = world.areas.length;
    this.power = { state: 'normal', battery: 1, areaOn: new Uint8Array(na).fill(1), areaLights: new Uint8Array(na).fill(1) };
    this.items = new Map();                  // floor items: id -> {id, s, n, x, y, z}
    this.mobs = new Map();                   // id -> {id, n, job, set, kind, x, z, yaw, flags, speed, buf}
    this.round = welcome.round;
    this.roundAt = performance.now();
    this.jobs = welcome.jobs;
    this.me = welcome.you;
    this.name = welcome.name;
    this.self = null;                        // private state: inventory, vitals, access
    this.you = null;                         // last authoritative position
    this.env = { p: 101, o2: 21, tox: 0, area: 0 };
    this.alert = 'green';
    this.evacApplied = false;
    this.listeners = {};
    this.applyWelcome(welcome);
  }

  on(type, fn) { (this.listeners[type] ||= []).push(fn); }
  emit(type, ev) { const l = this.listeners[type]; if (l) for (const fn of l) fn(ev); }

  // ------------------------------------------------------------------ initial state
  applyWelcome(w) {
    this.power.state = w.power.state; this.power.battery = w.power.battery;
    w.areaOn.forEach((v, i) => { this.power.areaOn[i] = v; });
    w.areaLights.forEach((v, i) => { this.power.areaLights[i] = v; });
    for (const ev of w.tiles) this.setTile(ev);
    for (const [c, r, d] of w.panes) this.killPane(c, r, d);
    for (const [i, cs, g] of w.closets || []) this.setCloset(i, cs, !!g);
    for (const [i, x, z, d] of w.moved || []) this.moveProp(i, x, z, d);
    if (w.evac) this.applyEvac(true);
    w.doors.forEach((st, i) => { if (st !== 'closed') this.doors[i]?.setState(st); });
    w.fdoors.forEach((c, i) => { if (c && this.fdoors[i]) this.setFdoor(this.fdoors[i], true); });
    for (const [id, s, n, x, y, z] of w.items) this.items.set(id, { id, s, n, x, y, z });
  }

  // ------------------------------------------------------------------ helpers
  setTile(ev) {
    const w = this.world, i = ev.i;
    w.kind[i] = ev.kind; w.wallVar[i] = ev.wall; w.glass[i] = ev.glass; w.solid[i] = ev.solid; w.airBlock[i] = ev.air;
    w.floorCell[i] = ev.floor; w.roof[i] = ev.roof; w.areaIdx[i] = ev.area;
    if (ev.brk) w.breached.add(i); else w.breached.delete(i);
  }

  setCloset(i, cs, gone) {
    const it = this.props.interact[i];
    if (it?.kind === 'closet') setClosetState(this.world, it, cs, gone);
  }

  moveProp(i, x, z, d) {
    const it = this.props.interact[i];
    if (it) moveProp(this.world, it, x, z, d);
  }

  killPane(c, r, d) {
    const p = this.props.paneIdx.get((r * this.world.W + c) * 16 + d);
    if (!p || p.dead) return null;
    p.dead = true;
    this.world.removeEdge(c, r, d);
    return p;
  }

  setFdoor(f, closed) {
    const { world } = this;
    f.closed = closed;
    const d = world.doorAt.get(f.i);
    if (closed) { world.solid[f.i] = 1; world.airBlock[f.i] = 1; }
    else { world.solid[f.i] = d && !d.passable ? 1 : 0; world.airBlock[f.i] = d && !d.isOpen ? 1 : 0; }
  }

  /** The emergency shuttle docks: stamp its tiles and props into the world (same code path as the server). */
  applyEvac(initial = false) {
    if (this.evacApplied) return;
    this.evacApplied = true;
    const w = this.world, ov = this.level.evac;
    const tiles = [];
    for (const [i, kind, floor, wall, area, roof] of ov.tiles) {
      w.kind[i] = kind; w.floorCell[i] = floor; w.wallVar[i] = wall; w.areaIdx[i] = area; w.roof[i] = roof;
      w.glass[i] = 0; w.solid[i] = 0; w.airBlock[i] = 0;
      if (kind === KIND.WALL) {
        w.solid[i] = 1; w.airBlock[i] = 1;
        if (wall !== 0xffff && w.variants[wall].glass) w.glass[i] = 1;
      } else if (kind === KIND.SPACE) w.solid[i] = 1;
      tiles.push([i % w.W, Math.floor(i / w.W)]);
    }
    buildPropData(w, this.rects, ov.props, this.level, this.props);
    for (const p of this.props.added.doors) this.doors.push(new DoorCore(w, p, p.fr.length - 2));
    this.evacTiles = tiles;
    if (!initial) this.emit('evac', { tiles, added: this.props.added });
    else this.pendingEvac = { tiles, added: this.props.added };
  }

  // ------------------------------------------------------------------ per-frame
  tick(dt) {
    for (const d of this.doors) if (d.state === 'opening' || d.state === 'closing') d.tick(dt);
  }

  get roundClock() {
    if (!this.round || this.round.state !== 'playing') return this.round?.time || 0;
    return this.round.time + (performance.now() - this.roundAt) / 1000;
  }

  // ------------------------------------------------------------------ events
  apply(ev) {
    switch (ev.e) {
      case 'door': this.doors[ev.i]?.setState(ev.st); break;
      case 'fdoor': { const f = this.fdoors[ev.i]; if (f) this.setFdoor(f, !!ev.c); break; }
      case 'tile': this.setTile(ev); break;
      case 'cl': this.setCloset(ev.i, ev.cs, !!ev.g); break;
      case 'pm': this.moveProp(ev.i, ev.x, ev.z, ev.d); break;
      case 'imv': { const it = this.items.get(ev.id); if (it) { it.x = ev.x; it.z = ev.z; } break; }
      case 'pane': this.killPane(ev.c, ev.r, ev.d); break;
      case 'item+': this.items.set(ev.id, { id: ev.id, s: ev.s, n: ev.n, x: ev.x, y: ev.y, z: ev.z }); break;
      case 'item-': this.lastRemoved = this.items.get(ev.id) || null; this.items.delete(ev.id); break;
      case 'power': this.power.state = ev.state; this.power.battery = ev.battery; break;
      case 'area': this.power.areaOn[ev.a] = ev.on; this.power.areaLights[ev.a] = ev.lights; break;
      case 'mob+': this.mobs.set(ev.id, { id: ev.id, n: ev.n, job: ev.job, set: ev.set, ap: ev.ap, kind: ev.kind, x: 0, z: 0, yaw: 0, flags: 0, speed: 0, buf: [], fresh: true }); break;
      case 'look': { const m = this.mobs.get(ev.id); if (m) m.ap = ev.ap; break; }
      case 'mob-': break;                    // the view reads the mob before it is dropped (see Game.onEvent)
      case 'self': this.self = ev; break;
      case 'round': this.round = ev; this.roundAt = performance.now(); break;
      case 'alert': this.alert = ev.level; break;
      case 'evac': this.applyEvac(); return;
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
      const [id, x, z, yaw, flags, speed] = row;
      const m = this.mobs.get(id);
      if (!m) continue;
      m.flags = flags; m.speed = speed; m.dead = !!(flags & 1); m.crit = !!(flags & 2); m.lying = !!(flags & 16);
      m.buf.push({ t: now, x, z, yaw });
      if (m.buf.length > 6) m.buf.shift();
      if (m.fresh) { m.fresh = false; m.x = x; m.z = z; m.yaw = yaw; }
    }
  }

  /** My entry in the round's player list (lobby / playing / ghost). */
  get myState() {
    const p = this.round?.players?.find((q) => q.id === this.me);
    return p ? p.st : 'lobby';
  }

  get jobMap() { return this._jm || (this._jm = Object.fromEntries(this.jobs.map((j) => [j.id, j]))); }
}
