import { TILE, KIND, SIM_DT, SNAP_EVERY, INTEREST } from '../shared/config.js';
import { decodeGrid } from '../shared/leveldata.js';
import { GameMap } from '../shared/gamemap.js';
import { tfPoint, tfClone } from '../shared/math3.js';
import { settle, frameYaw } from '../shared/frames.js';
import { ItemDB, makeItemData } from '../shared/items.js';
import { Jobs } from '../shared/jobs.js';
import { stepMovement, floatState } from '../shared/movement.js';
import { clamp, rng } from '../shared/util.js';
import { Mob } from './mob.js';
import { GridSim } from './gridsim.js';
import { GridPhysics, IMPACT_MIN } from './physics.js';
import { Shuttles } from './shuttle.js';
import { ChatSys } from './chatsys.js';
import { Round } from './round.js';
import { Director } from './director.js';
import { Terminals } from './terminals.js';
import { Actions } from './actions.js';
import { Closets } from './closets.js';
import { People } from './people.js';
import { Windows } from './windows.js';
import { Walls } from './walls.js';
import { Stacks } from './stacks.js';
import { Floors } from './floors.js';
import { GIRDER } from '../shared/walls.js';
import { Debug } from './debug.js';
import { Looks, WORN_SLOTS } from '../shared/looks.js';
import { AI } from './ai.js';
import { attach, place, recalc, internalsSource, spaceSafe, moveSlow, serializeInv } from './inventory.js';

const JET_BURN = 3;          // a jetpack's gas used per second of thrust (a full tank: five minutes)

let clientSeq = 1;

/** A connected player (or local single player). */
export class SimClient {
  constructor(sim, name, send) {
    this.id = clientSeq++;
    this.sim = sim;
    this.name = name || 'Guest ' + this.id;
    this.send = send;
    this.state = 'lobby';          // lobby | playing | ghost
    this.mob = null;
    this.ghost = { x: 0, y: 0, z: 0, vx: 0, vz: 0, yaw: 0, pitch: 0, grid: null, map: null };      // an observer floats in a map's void: map coordinates
    this.job = 'assistant';
    this.look = null;              // the character they designed (sanitised), or null for a random one
    this.ready = false;
    this.outbox = [];
    this.known = new Set();        // mob ids this client has been told about
    this.inputs = [];
    this.lastSeq = 0;
    this.budget = 0.3;
    this.selfJson = '';
    this.term = null;
    this.latejoined = false;
  }

  /** Where this player is: their body, or their ghost. Both have { grid, map, x, y, z }, so distances work whichever it is. */
  get at() { return this.mob || this.ghost; }
  get map() { return this.sim.mapOf(this.at); }
}

/**
 * The authoritative game simulation. Pure logic: runs unchanged inside the Node server and inside the
 * browser (single player). Talks to clients only through messages (see handle() and the events it emits).
 *
 * The world is a set of maps, each a space of grids (the station, a shuttle, an escape pod...). Every grid keeps its own tiles, air, power,
 * doors and props in its own frame; anything standing on one (a person, an item, a door) has `.grid` and coordinates in that frame, and
 * `sim.dist(a, b)` / `sim.worldPos(a)` are the only places that know about where grids are.
 */
export class Sim {
  constructor(data, opts = {}) {
    this.opts = { bots: 14, autostart: 0, god: false, ...opts };
    this.level = data.level;
    this.rects = data.rects;
    this.time = 0;
    this.tick = 0;
    this.rand = rng(Date.now() & 0xffff);
    this.db = new ItemDB(data.level.itemdefs, data.contents || {});
    this.looks = new Looks(data.chars);
    this.jobs = new Jobs(data.jobsJson);
    this.maps = new Map();               // id -> GameMap
    this.grids = new Map();              // id -> GridSim
    this.gridSeq = 1;
    this.physics = new GridPhysics(this);   // the grids as rigid bodies (throws unless `await initPhysics()` has been done)
    this.shuttles = new Shuttles(this);     // flights of grids that are not docked
    this.station = null;                 // the main grid; the director's meteors and the round's hull checks are about this one
    this.builtSeq = 1;                   // ids of what players have built, over all grids
    this.chat = new ChatSys(this);
    this.terminals = new Terminals(this);
    this.actions = new Actions(this);
    this.ai = new AI(this);
    this.round = new Round(this);
    this.director = new Director(this);
    this.compat = {};                    // how often a compatibility path was taken (the migration to explicit grids; tests keep this at zero)

    this.items = new Map();             // id -> item instance (everything that exists)
    this.floor = new Map();             // id -> {item, grid, x, y, z, c, r}
    this.itemSeq = 1;
    this.mobs = new Map();
    this.clients = new Map();
    this.flickerUntil = 0;

    this.people = new People(this);
    this.windows = new Windows(this);
    this.walls = new Walls(this);
    this.stacks = new Stacks(this);
    this.floors = new Floors(this);
    this.debug = new Debug(this);
    this.closets = new Closets(this, data.closets);       // each grid's closets are set up as it is added, after its floor items: closed closets swallow what lies on them

    const mapId = data.level.map;
    const def = data.level.maps[mapId];
    const map = this.addMap(mapId, def.name);
    this.defaultMap = map;
    for (const pl of def.grids) this.addGrid(pl.bp, { map, kind: pl.kind, name: pl.name, tf: { p: pl.p, q: pl.q }, quiet: true });
    this.relink(map);
    this.physics.warm();
    this.docks = def.docks || {};        // where a shuttle that arrives later (the emergency shuttle) is held: { name: { bp, kind, name, p, q } }
  }

  // ------------------------------------------------------------------ maps and grids
  addMap(id, name) {
    const map = new GameMap(id, name);
    this.maps.set(id, map);
    return map;
  }

  /** Bring a grid into being in `o.map` at pose `o.tf`: its tiles, its air and power, its map's girders, the items that lie about on it, its closets. */
  addGrid(bp, o = {}) {
    const map = o.map || this.defaultMap;
    const g = new GridSim(this, decodeGrid(this.level, bp), { id: this.gridSeq++, kind: o.kind, name: o.name, tf: o.tf, docked: o.docked });
    this.grids.set(g.id, g);
    map.add(g);
    this.physics.add(g);
    if (!this.station && g.kind === 'station') this.station = g;
    for (const gd of g.props.girders) g.built.add({ id: this.builtSeq++, k: 'girder', c: gd.c, r: gd.r, st: GIRDER.NORMAL, grid: g });
    for (const it of g.props.items) {
      const item = this.newItem(it.path || '/obj/item', { name: it.name, sprite: it.sprite });
      place(this, item, g, it.x, it.z, it.y);
    }
    this.closets.initGrid(g);
    if (!o.quiet) {
      this.relink(map);
      g.emit({ e: 'grid+', ...this.gridState(g) });            // everyone in the map is told (a client that is just joining gets it in its welcome too)
    }
    return g;
  }

  /**
   * A grid leaves its map (a shuttle departs). Whatever lay on its floor goes with it; people on it are the caller's business (they have already
   * been taken off, or counted as escaped). The grid object stays alive for anything that still refers to it.
   */
  removeGrid(g) {
    const map = g.map;
    this.shuttles.flights.delete(g.id);
    this.physics.remove(g);
    for (const [id, rec] of [...this.floor]) if (rec.grid === g) { this.floor.delete(id); this.items.delete(id); }
    g.emit({ e: 'grid-' });
    map.remove(g);
    this.grids.delete(g.id);
    this.relink(map);
  }

  /** Work out again which grids of a map lie over which (they moved, came or went), and redo the air of any whose space is not space any more. */
  relink(map) {
    for (const g of map.relink()) g.atmos.buildTopology(false);
  }

  /** A grid is let go (a shuttle undocks): it is a free body now, and no longer lies against the station. */
  undock(g) {
    if (!g.docked) return;
    g.docked = false;
    this.physics.setDocked(g, false);
    this.relink(g.map);
    g.emit({ e: 'grid~', docked: false, tf: tfClone(g.tf) });
  }

  /** A grid is held at `pose` (exactly there, standing still): it lies against its neighbours again. */
  dock(g, pose = g.tf) {
    g.docked = true;
    this.physics.setDocked(g, true, pose);
    this.relink(g.map);
    g.emit({ e: 'grid~', docked: true, tf: tfClone(g.tf) });
  }

  /** Two grids have hit each other, hard (`force` in newtons): everyone near either feels it. No damage: they are only bumped. */
  gridImpact(a, b, force) {
    if (!a || !b || force < IMPACT_MIN || this.time - Math.max(a.lastImpact || -9, b.lastImpact || -9) < 1) return;
    a.lastImpact = b.lastImpact = this.time;
    const amt = Math.min(1, force / 400000);
    for (const g of [a, b]) {
      const at = { grid: g, x: g.world.W * TILE / 2, z: g.world.H * TILE / 2 };
      this.shake(at, amt, 80);
      this.sound('explosion_far', at, Math.min(1, 0.4 + amt));
    }
  }

  /** How much to turn a facing given in grid `from`'s frame to have it in grid `to`'s. */
  frameYaw(from, to) { return frameYaw(from, to); }

  /** After a body has moved: if it has walked onto another grid (through a docking door, say), it belongs to that grid now. */
  settleMob(m) {
    if (!m.grid) return false;
    const r = settle(m.grid, m);
    if (!r) return false;
    m.grid = r.grid;
    m.dirty = true;
    return true;
  }

  // The station's parts, for code that has not yet been told which grid it is about (the tests, and what is still being moved over).
  get world() { return this.useStation('world').world; }
  get props() { return this.useStation('props').props; }
  get doors() { return this.useStation('doors').doors; }
  get atmos() { return this.useStation('atmos').atmos; }
  get power() { return this.useStation('power').power; }
  get nav() { return this.useStation('nav').nav; }
  get firedoors() { return this.useStation('firedoors').firedoors; }
  get built() { return this.useStation('built').built; }
  get tileLog() { return this.useStation('tileLog').tileLog; }
  useStation(what) { this.compat[what] = (this.compat[what] || 0) + 1; return this.station; }

  // ------------------------------------------------------------------ where things are
  /** The map something is in: its grid's, or its own for a body floating in the void. */
  mapOf(at) { return at.grid ? at.grid.map : at.map || null; }

  /** [x, y, z] in the map's coordinates of something standing in a grid's frame (or floating in the void, where they already are). */
  worldPos(at) {
    const y = at.y || 0;
    return at.grid ? tfPoint(at.grid.tf, [at.x, y, at.z]) : [at.x, y, at.z];
  }

  /**
   * How far apart two things are, in metres: Infinity when they are in different maps; on the same grid it is the distance across the
   * deck (height does not count, as it never has); between grids it is the true distance between where they are in the map.
   */
  dist(a, b) {
    if (a.grid && a.grid === b.grid) return Math.hypot(a.x - b.x, a.z - b.z);
    if (this.mapOf(a) !== this.mapOf(b)) return Infinity;
    const p = this.worldPos(a), q = this.worldPos(b);
    return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  }

  sameGrid(a, b) { return !!a.grid && a.grid === b.grid; }

  /** The grid a request (a click target, a message) is about: the one it names, else the one its sender stands on. */
  gridFor(id, c) { return (id !== undefined && this.grids.get(id)) || c?.mob?.grid || null; }

  /** Everyone's start points: [{ grid, job, x, y }] (tiles). */
  spawnPoints() {
    const out = [];
    for (const g of this.grids.values()) for (const s of g.spawns) out.push({ grid: g, job: s.job, x: s.x, y: s.y });
    return out;
  }

  // ------------------------------------------------------------------ ids / items
  newItem(path, extra = {}) {
    const it = makeItemData(this.db, path, extra);
    if (extra.sprite !== undefined && extra.sprite >= 0) it.sprite = extra.sprite;
    it.id = this.itemSeq++;
    it.loc = null;
    this.items.set(it.id, it);
    if (it.contents) for (const p of this.db.startingContents(path)) { const c = this.newItem(p); c.loc = { t: 'box', box: it }; it.contents.push(c); }
    return it;
  }

  // ------------------------------------------------------------------ events
  /**
   * scope: undefined = everyone; {to: client}; {near: {at, r}} (anyone within r metres of `at`: a body, an item record, a door...);
   * {ghosts: true}. An event with a `g` is about that grid, so only players in the grid's map get it.
   */
  emit(ev, scope) {
    const map = ev.g !== undefined ? this.grids.get(ev.g)?.map : null;
    for (const c of this.clients.values()) {
      if (map && c.map !== map) continue;
      if (scope) {
        if (scope.to && scope.to !== c) continue;
        if (scope.near && this.dist(c.at, scope.near.at) > scope.near.r) continue;
        if (scope.ghosts && c.state !== 'ghost') continue;
      }
      c.outbox.push(ev);
    }
  }

  tellClient(client, k, text, extra) { client.outbox.push({ e: 'msg', k, text, ...extra }); }
  tell(mob, k, text) { if (mob.client) this.tellClient(mob.client, k, text); }

  /** A sound at `at` (a body, an item record, a door... anything with a grid and x, z), heard within 40 m. Sent in the map's coordinates. */
  sound(name, at, v = 1) {
    const p = this.worldPos(at);
    this.emit({ e: 'snd', n: name, x: p[0], z: p[2], v }, { near: { at, r: 40 } });
  }
  soundTo(client, name, v = 1) { client.outbox.push({ e: 'snd', n: name, v }); }
  shake(at, amt, r = 36) { this.emit({ e: 'shake', a: amt }, { near: { at, r } }); }

  /**
   * A grid's gravity goes on or off (the generator, or the debug menu). Like gravitygenerator.dm's shake_everyone():
   * everybody's camera shakes and they hear the alert. Nobody is told in words; you find out when your feet leave the floor.
   */
  setGravity(g, on) {
    on = !!on;
    if (g.world.gravityOn === on) return false;
    g.world.gravityOn = on;
    g.emit({ e: 'grav', on });
    g.emit({ e: 'shake', a: 0.5 });
    g.emit({ e: 'snd', n: 'terminal_alert', v: 1 });
    return true;
  }

  // ------------------------------------------------------------------ clients
  addClient(name, send) {
    const c = new SimClient(this, name, send);
    this.clients.set(c.id, c);
    const sps = this.spawnPoints();
    const sp = sps.find((s) => s.job === 'latejoin') || sps.find((s) => s.job === 'assistant');
    const p = sp.grid.worldPoint(sp.x * TILE + 1, 0, sp.y * TILE + 1);
    c.ghost.x = p[0]; c.ghost.y = p[1]; c.ghost.z = p[2]; c.ghost.map = sp.grid.map;
    send({ t: 'welcome', you: c.id, ...this.worldState(c) });
    this.round.onJoin(c);
    return c;
  }

  removeClient(c) {
    this.clients.delete(c.id);
    if (c.mob) { c.mob.client = null; c.mob.ssd = true; c.mob.input = { f: 0, b: 0, l: 0, r: 0, run: 0, yaw: c.mob.yaw }; }
    this.chat.systemAll('notice', `${c.name} has disconnected.`);
    this.round.onLeave(c);
  }

  /** What a joining client needs to know about one grid: which it is, and how it has changed since the map made it. */
  gridState(g) {
    return {
      g: g.id, bp: g.bp, kind: g.kind, name: g.name, tf: tfClone(g.tf), docked: g.docked,
      power: { state: g.power.state, battery: g.power.battery },
      areaOn: [...g.power.areaOn], areaLights: [...g.power.areaLights],
      doors: g.doors.map((d) => d.state), fdoors: g.firedoors.list.map((f) => (f.closed ? 1 : 0)),
      tiles: g.tileLog, panes: g.deadPanes, closets: this.closets.changed(g), moved: this.people.moved(g),
      gravity: g.world.gravityOn, built: [...g.built].map((b) => [b.id, b.k, b.c, b.r, b.st]),
    };
  }

  /** Everything a joining client needs to build its view of the world. */
  worldState(c) {
    const map = c.map;
    return {
      name: this.level.name,
      map: map.id,
      round: this.round.publicState(),
      grids: [...map.grids.values()].map((g) => this.gridState(g)),
      items: [...this.floor.values()].filter((f) => f.grid.map === map).map((f) => [f.item.id, f.item.sprite, f.item.name, f.x, f.y, f.z, f.grid.id]),
      debug: !!this.opts.debug,
      jobs: this.jobs.list.map((j) => ({ id: j.id, title: j.title, color: j.color, supervisors: j.supervisors, slots: this.jobs.slots(j), total: j.id === 'assistant' ? 99 : j.total, ap: this.outfitPreview(j) })),
    };
  }

  // ------------------------------------------------------------------ main loop
  step(dt = SIM_DT) {
    this.time += dt;
    this.tick++;
    this.round.update(dt);
    this.applyPlayerInputs(dt);
    this.people.update();
    this.updateDoors(dt);
    for (const g of this.grids.values()) g.firedoors.update(dt);
    this.windows.update();
    for (const g of this.grids.values()) { g.atmos.update(dt); g.power.update(dt); }
    this.shuttles.update(dt);
    this.physics.step(dt);
    this.ai.update(dt);
    this.tickBodies(dt);
    this.actions.update(dt);
    this.director.update(dt);
    this.updateGhosts(dt);
    this.terminals.update(dt);
    if (this.tick % SNAP_EVERY === 0) this.sendSnapshots();
    this.flush();
  }

  flush() {
    for (const c of this.clients.values()) {
      if (c.outbox.length) { c.send({ t: 'ev', list: c.outbox }); c.outbox = []; }
    }
  }

  // ------------------------------------------------------------------ player movement (authoritative)
  applyPlayerInputs(dt) {
    for (const c of this.clients.values()) {
      c.budget = Math.min(0.5, c.budget + dt);
      const m = c.mob;
      if (!m) { if (c.state !== 'ghost' && c.state !== 'lobby') c.inputs.length = 0; continue; }      // observers and ghosts have no body: updateGhosts moves them
      let moved = false;
      while (c.inputs.length) {
        let inp = c.inputs.shift();
        c.lastSeq = inp.seq;
        let d = clamp(inp.dt || 0.016, 0.001, 0.06);
        if (d > c.budget) d = c.budget;
        if (d <= 0) continue;
        c.budget -= d;
        const yaw = this.yawIn(m, inp.yaw, inp.g);
        inp = { ...inp, yaw };
        m.yaw = yaw; m.pitch = clamp(inp.pitch || 0, -1.5, 1.5);
        m.input = inp;
        if (m.inside) { m.vx = m.vz = 0; if (inp.f || inp.b || inp.l || inp.r) this.closets.relaymove(m); continue; }
        if (m.downed || (m.pulledBy && m.pulledBy.grab >= 1)) { this.limp(m, d); if (inp.f || inp.b || inp.l || inp.r) this.people.resistGrab(m); continue; }
        if (m.dead || m.stunned > 0 || m.body.crit) { this.limp(m, d); continue; }
        const run = inp.run && !(m.body.health < 30);
        const ctx = this.moveCtx(m);
        m.speedNow = stepMovement(m, { f: inp.f, b: inp.b, l: inp.l, r: inp.r, run, yaw: inp.yaw }, m.grid.world, d, ctx);
        if (m.jetOn && (inp.f || inp.b || inp.l || inp.r) && floatState(m.grid.world, m, { ...ctx, jet: false }).floating) this.burnJetpack(m, d);
        this.settleMob(m);
        moved = true;
      }
      void moved;
    }
  }

  /** A facing the client made in grid `g`'s frame (it names it as `inp.g`) in the frame of the grid `m` is on now (they differ for the instant after a handover). */
  yawIn(m, yaw, g) {
    const from = g !== undefined && g !== m.grid?.id ? this.grids.get(g) : null;
    return from && m.grid && from.map === m.grid.map ? yaw + this.frameYaw(from, m.grid) : yaw;
  }

  /** How much slower (or, in debug, faster) than normal this body moves: its suit, what it drags, the debug speed. */
  moveFactor(m) { return moveSlow(m) * this.people.dragSlow(m) * (m.dbgSpeed ?? 1); }

  /** What `stepMovement` needs to know about a body (the client predicts with the same things, see Game.predictCtx). */
  moveCtx(m) {
    return { slow: this.moveFactor(m) * (m.body.crit ? 0.35 : 1), wind: m.grid.atmos.windAt(m.x, m.z), ignore: m.hauling?.it, noclip: m.noclip, jet: !!m.jetOn, mag: !!m.magOn };
  }

  /** Thrusting uses the jetpack's gas; when it is gone the engines cut out. */
  burnJetpack(m, d) {
    const jp = m.worn.back;
    if (!jp?.def.jetpack) { m.jetOn = false; return; }
    jp.gas = Math.max(0, jp.gas - d * JET_BURN);
    if (jp.gas <= 0) { m.jetOn = false; m.dirty = true; this.tell(m, 'warning', "You feel your jetpack's engines cut out."); }
  }

  /** A body that cannot act: it stops where it is, unless there is no gravity to stop it, then it keeps drifting. */
  limp(m, d) {
    if (m.grid.world.hasGravity(m.x, m.z)) { m.vx = m.vz = 0; return; }
    m.speedNow = stepMovement(m, { yaw: m.yaw }, m.grid.world, d, { ...this.moveCtx(m), limp: true });
    this.settleMob(m);
  }

  updateGhosts(dt) {
    for (const c of this.clients.values()) {
      if (c.state !== 'ghost' && c.state !== 'lobby') { continue; }
      const g = c.ghost;
      while (c.inputs.length) {
        const inp = c.inputs.shift();
        c.lastSeq = inp.seq;
        g.yaw = inp.yaw; g.pitch = inp.pitch || 0;
        stepMovement(g, inp, null, clamp(inp.dt || 0.016, 0.001, 0.06), { noclip: true });      // a ghost passes through everything: it needs no tiles
      }
    }
  }

  // ------------------------------------------------------------------ doors
  updateDoors(dt) {
    const players = [...this.clients.values()].filter((c) => c.mob && !c.mob.dead).map((c) => c.mob);
    for (const g of this.grids.values()) {
      for (const d of g.doors) {
        if (d.state === 'closed') {
          for (const m of players) {
            if (this.dist(m, d) < 1.8 && d.allows(m) && g.power.doorsWork(d)) { this.openDoor(d, m); break; }
          }
          continue;
        }
        const res = d.tick(dt);
        if (res) g.emit({ e: 'door', i: d.idx, st: res });
        if (d.state === 'open' && res === 'open') d.holdUntil = this.time + 3.2;
        if (d.state === 'open' && this.time > d.holdUntil) {
          if (!g.power.doorsWork(d)) d.holdUntil = this.time + 1;
          else if (!this.occupied(d)) this.closeDoor(d); else d.holdUntil = this.time + 0.8;
        }
      }
    }
  }

  occupied(d) {
    for (const m of this.mobs.values()) if (!m.dead && this.dist(m, d) < 1.5) return true;
    return false;
  }

  openDoor(d, by, force = false) {
    if (!force && (d.bolted || d.welded || !d.grid.power.doorsWork(d))) return false;
    if (!d.open()) return false;
    d.grid.emit({ e: 'door', i: d.idx, st: 'opening' });
    this.sound('door_open', d, 0.9);
    return true;
  }

  closeDoor(d) {
    if (!d.close()) return false;
    d.grid.emit({ e: 'door', i: d.idx, st: 'closing' });
    this.sound('door_close', d, 0.9);
    return true;
  }

  // ------------------------------------------------------------------ bodies
  tickBodies(dt) {
    for (const m of this.mobs.values()) {
      if (m.dead) continue;
      m.cool = Math.max(0, m.cool - dt);
      m.stunned = Math.max(0, m.stunned - dt);
      const [c, r] = m.tile;
      const a = m.grid?.atmos;                                       // in the void there is no air at all
      let internals = false;
      if (m.humanoid && m.internals) {
        const src = internalsSource(m);
        if (src) { internals = true; src.gas = Math.max(0, src.gas - dt); if (src.gas <= 0) { m.internals = false; this.tell(m, 'danger', 'Your air tank runs dry!'); } }
      }
      m.body.tick(dt, {
        pressure: a ? a.pressureAt(c, r) : 0, o2: a ? a.o2At(c, r) : 0, tox: a ? a.toxAt(c, r) : 0,
        safeSuit: m.kind === 'carp' || (m.humanoid && spaceSafe(m)), internals: internals || m.kind === 'carp',
      });
    }
  }

  onMobDeath(m, cause) {
    m.dead = true;
    m.vx = m.vz = 0;
    this.sound('bodyfall', m, 0.8);
    if (m.kind === 'human') {
      this.chat.visible(m, `${m.name} seizes up and falls limp, their eyes dead and lifeless...`, 'danger', 8);
      this.chat.systemAll('deadsay', `${m.name} (${this.jobs.get(m.job)?.title || 'crew'}) has died at ${m.grid?.world.areaAt(...m.tile)?.n || 'an unknown location'}.`);
    }
    if (m.client) this.round.onPlayerDeath(m.client, cause);
    this.director.onMobDeath(m);
  }

  hurt(m, amount, type = 'brute', src) {
    if (m.dead) return;
    const dmg = amount * (1 - (m.humanoid ? (m.worn.suit?.def.armor ?? 0) : 0));
    m.body.damage(type, dmg, src);
    m.fear = 6;
    if (m.client) { this.emit({ e: 'hurt', a: dmg }, { to: m.client }); this.shake(m, Math.min(0.5, dmg / 25), 0.1); }
    if (m.humanoid && !m.dead) this.sound((m.name.charCodeAt(0) % 2) ? 'pain_m' : 'pain_f', m, 0.8);
  }

  // ------------------------------------------------------------------ hull & world changes
  tileEvent(g, i, extra = {}) {
    const w = g.world;
    return { e: 'tile', g: g.id, i, kind: w.kind[i], wall: w.wallVar[i], glass: w.glass[i], solid: w.solid[i], air: w.airBlock[i], floor: w.floorCell[i], roof: w.roof[i], area: w.areaIdx[i], brk: w.breached.has(i) ? 1 : 0, gr: w.grille[i], ws: w.ws[i], ft: w.ft[i], lat: w.lat[i], ...extra };
  }

  /** Something is built on a tile (a girder). Everyone is told; it is dense and takes the tile's `solid`. */
  addBuilt(g, k, c, r, st = 0) {
    const rec = g.built.add({ id: this.builtSeq++, k, c, r, st, grid: g });
    g.emit({ e: 'bs+', id: rec.id, k, c, r, st });
    return rec;
  }

  /** A built thing changes state (a girder unbolted or reinforced: another picture, another name). */
  setBuilt(rec, st) {
    rec.st = st;
    rec.grid.emit({ e: 'bs~', id: rec.id, st });
  }

  removeBuilt(rec) {
    if (!rec.grid.built.remove(rec.id)) return;
    rec.grid.emit({ e: 'bs-', id: rec.id });
  }

  /** A tile's glass, grille or anchoring changed: tell the air and the clients. (A smashed window is `breachTile`: it is also loud.) */
  tileChanged(g, c, r) {
    g.atmos.tileChanged(c, r);
    this.physics.touch(g);
    this.emitTile(g, g.world.idx(c, r));
  }

  /** Tell everyone how tile `i` of `g` is now (and keep it for those who join later). */
  emitTile(g, i) {
    const ev = this.tileEvent(g, i);
    g.tileLog.push(ev); this.emit(ev);
  }

  /** A window shatters. Only one that touches space is a hull breach (loud, everything flickers). It leaves shards (and rods) on the floor and its grille standing. */
  breachTile(g, c, r, cause) {
    const w = g.world;
    const i = w.idx(c, r);
    w.setBreach(c, r);
    this.tileChanged(g, c, r);
    const at = { grid: g, x: c * TILE + 1, z: r * TILE + 1 };
    this.windows.spill(g, at.x, at.z, w.windowKey(i), true);
    this.sound('glass_break', at, 1);
    if (cause === 'meteor') { this.sound('meteor', at, 1); this.sound('explosion', at, 0.8); this.sound('wind', at, 0.9); }
    if (w.ventsToSpace(i)) {
      this.shake(at, 0.6, 40);
      this.flicker(g, 0.9);
    } else this.shake(at, 0.25, 12);
  }

  patchBreach(g, c, r) {
    const w = g.world;
    const i = w.idx(c, r);
    const venting = w.ventsToSpace(i);
    w.setPatched(c, r);
    g.atmos.tileChanged(c, r);
    const ev = this.tileEvent(g, i);
    g.tileLog.push(ev); this.emit(ev);
    this.sound('welder', { grid: g, x: c * TILE + 1, z: r * TILE + 1 }, 0.8);
    this.director.onPatched(venting);
  }

  /** Damage a window (tile) or a thin pane; shatters when hit points run out. `hit` is a world.hit record from `g`'s tiles. */
  damageHull(g, hit, dmg) {
    const w = g.world;
    if (hit.kind === 'tile') {
      const i = hit.i;
      if (!w.glass[i]) return null;
      const hp = (w.hp.get(i) ?? 30) - dmg;
      const c = i % w.W, r = Math.floor(i / w.W);
      this.sound('glass_hit', { grid: g, x: c * TILE, z: r * TILE }, 0.8);
      if (hp <= 0) { this.breachTile(g, c, r, 'shot'); return 'shatter'; }
      w.hp.set(i, hp);
      return hp < 15 ? 'crack2' : 'crack';
    }
    const pane = g.props.paneIdx.get(hit.i * 16 + hit.bit);
    if (!pane || pane.dead) return null;
    pane.hp -= dmg;
    this.sound('glass_hit', { grid: g, x: pane.c * TILE, z: pane.r * TILE }, 0.8);
    if (pane.hp <= 0) { this.shatterPane(g, pane); return 'shatter'; }
    return 'crack';
  }

  shatterPane(g, p) {
    this.removePane(g, p);
    const at = { grid: g, x: p.c * TILE + 1, z: p.r * TILE + 1 };
    this.sound('glass_break', at, 1);
    this.windows.spill(g, at.x, at.z, p.tag, false);
  }

  /** A thin window is gone (smashed, or taken apart: then it leaves nothing but its glass sheet). */
  removePane(g, p) {
    p.dead = true;
    g.world.removeEdge(p.c, p.r, p.d);
    g.deadPanes.push([p.c, p.r, p.d]);
    g.emit({ e: 'pane', c: p.c, r: p.r, d: p.d });
  }

  flicker(g, sec) { g.emit({ e: 'flicker', s: sec }); }

  onPowerState(g, s, prev) {
    g.emit({ e: 'power', state: s, battery: g.power.battery });
    g.emit({ e: 'snd', n: s === 'normal' ? 'ping' : 'zzzt', v: 0.8 });
    this.flicker(g, 1.5);
  }

  setAreaPower(g, a, on, lights) {
    if (on !== undefined) g.power.areaOn[a] = on ? 1 : 0;
    if (lights !== undefined) g.power.areaLights[a] = lights ? 1 : 0;
    g.emit({ e: 'area', a, on: g.power.areaOn[a], lights: g.power.areaLights[a] });
  }

  // ------------------------------------------------------------------ spawning
  newMob(o) {
    const m = new Mob(this, o);
    this.mobs.set(m.id, m);
    return m;
  }

  /** Create a crew member (player-controlled if `client`, otherwise an NPC) and equip them from the job's outfit. */
  spawnCrew(job, client, o = {}) {
    const all = this.spawnPoints();
    const pts = all.filter((s) => s.job === job.id);
    const late = all.filter((s) => s.job === 'latejoin');
    let p = o.late && late.length ? late[Math.floor(this.rand() * late.length)] : pts.length ? pts[Math.floor(this.rand() * pts.length)] : late[0] || all[0];
    const name = client ? client.name : this.ai.randomName();
    const look = (client && client.look) || this.looks.random(this.rand);
    const m = this.newMob({ kind: 'human', name, job: job.id, look, grid: p.grid, x: p.x * TILE + TILE / 2, z: p.y * TILE + TILE / 2, speed: 1.7 + this.rand() * 0.5, hp: 100 });
    this.outfit(m, job);
    if (client) { client.mob = m; m.client = client; client.state = 'playing'; }
    return m;
  }

  outfit(m, job) {
    const o = job.outfit;
    const put = (slot, path, extra) => {
      if (!path) return null;
      const it = this.newItem(path, extra);
      attach(this, it, { t: 'slot', mob: m, slot });
      return it;
    };
    put('uniform', o.uniform); put('shoes', o.shoes); put('gloves', o.gloves); put('glasses', o.glasses);
    put('ears', o.ears); put('mask', o.mask); put('head', o.head); put('neck', o.neck); put('suit', o.suit);
    put('belt', o.belt); put('lpocket', o.lpocket); put('rpocket', o.rpocket); put('suit_store', o.suit_store);
    const id = put('id', o.id || '/obj/item/card/id', { name: `${m.name}'s ID Card (${job.title})` });
    if (id) { id.access = [...this.jobs.accessOf(job)]; id.owner = m.name; id.assignment = job.title; }
    const back = put('back', o.back || '/obj/item/storage/backpack');
    if (back && back.contents) {
      if (o.box) { const box = this.newItem(o.box); box.loc = { t: 'box', box: back }; back.contents.push(box); }
      for (const [path, n] of o.contents || []) for (let k = 0; k < n; k++) {
        const it = this.newItem(path); it.loc = { t: 'box', box: back }; back.contents.push(it);
      }
    }
    recalc(this, m);
    m.dirty = true;
  }

  // ------------------------------------------------------------------ snapshots
  /** What someone looks like right now: their look plus what they are wearing (cached until it changes). */
  appearanceOf(m) {
    if (m.apDirty || !m.ap) {
      const by = {};
      for (const slot of WORN_SLOTS) if (m.worn[slot]) by[slot] = m.worn[slot].path;
      m.ap = this.looks.appearance(m.look, by);
      if (m.cuffed) m.ap.o.cuffs = this.looks.meta.cuffs;
      m.apDirty = false;
    }
    return m.ap;
  }

  /** The clothes someone starts a job in, for the lobby's mannequin. */
  outfitPreview(job) {
    return this.looks.outfit(job.outfit || {});
  }

  /** Tell everyone about anybody who has changed clothes or hair since the last snapshot. */
  sendLookChanges() {
    for (const m of this.mobs.values()) {
      if (!m.look || !m.apDirty) continue;
      const before = m.ap ? JSON.stringify(m.ap) : '';
      const ap = this.appearanceOf(m);
      if (before && JSON.stringify(ap) !== before) this.emit({ e: 'look', id: m.id, ap });
    }
  }

  sendSnapshots() {
    this.sendLookChanges();
    const mobsArr = [...this.mobs.values()];
    for (const c of this.clients.values()) {
      const here = c.at, map = c.map;
      const list = [];
      const seen = new Set();
      for (const m of mobsArr) {
        if (m.evacuated || (m.inside && m !== c.mob)) continue;       // nobody sees someone shut in a locker
        if (this.mapOf(m) !== map) continue;
        if (m !== c.mob && this.dist(m, here) > INTEREST) continue;
        seen.add(m.id);
        if (!c.known.has(m.id)) { c.known.add(m.id); c.outbox.push({ e: 'mob+', id: m.id, n: m.name, job: m.job, set: m.set, kind: m.kind, ap: m.look ? this.appearanceOf(m) : undefined }); }
        const flags = (m.dead ? 1 : 0) | (m.body.crit ? 2 : 0) | (m.speedNow > 3.8 ? 8 : 0) | (m.stunned > 0 || m.downed ? 16 : 0);
        list.push([m.id, m.grid ? m.grid.id : 0, +m.x.toFixed(2), +m.z.toFixed(2), +m.yaw.toFixed(2), flags, +(m.speedNow || 0).toFixed(1)]);
      }
      for (const id of [...c.known]) if (!seen.has(id)) { c.known.delete(id); c.outbox.push({ e: 'mob-', id }); }
      const snap = { t: 'snap', tick: this.tick, ack: c.lastSeq, mobs: list };
      const moved = this.movedGrids(c, map);
      if (moved.length) snap.grids = moved;
      const m = c.mob;
      if (m) {
        const [tc, tr] = m.tile, g = m.grid;
        snap.you = { g: g.id, x: +m.x.toFixed(3), z: +m.z.toFixed(3), vx: +m.vx.toFixed(2), vz: +m.vz.toFixed(2), id: m.id };
        snap.env = { p: +g.atmos.pressureAt(tc, tr).toFixed(1), o2: +g.atmos.o2At(tc, tr).toFixed(1), tox: +g.atmos.toxAt(tc, tr).toFixed(2), area: g.world.areaIdx[g.world.idx(tc, tr)] };
        const wind = g.atmos.windAt(m.x, m.z);
        if (wind) snap.you.wind = [+wind[0].toFixed(2), +wind[1].toFixed(2)];
        const self = this.selfState(c);
        const json = JSON.stringify(self);
        if (json !== c.selfJson) { c.selfJson = json; c.outbox.push({ e: 'self', ...self }); }
      } else {
        snap.you = { x: +c.ghost.x.toFixed(2), z: +c.ghost.z.toFixed(2), vx: 0, vz: 0, ghost: true };
      }
      c.send(snap);
    }
  }

  /** The poses of the grids in `map` that have moved since this client was last told (flying ones; a docked grid is told exactly when it docks). */
  movedGrids(c, map) {
    const out = [];
    c.poses ||= new Map();
    for (const g of map.grids.values()) {
      if (g.docked || g.poseSeq === undefined || c.poses.get(g.id) === g.poseSeq) continue;
      c.poses.set(g.id, g.poseSeq);
      const f = (a, n) => a.map((v) => +v.toFixed(n));
      out.push([g.id, ...f(g.tf.p, 3), ...f(g.tf.q, 5), ...f(g.vel, 3), ...f(g.ang, 4)]);
    }
    return out;
  }

  /** Private per-player state (inventory, vitals, access). */
  selfState(c) {
    const m = c.mob;
    const b = m.body;
    return {
      inv: m.humanoid ? serializeInv(m) : null,
      hp: [Math.round(b.health), b.max, Math.round(b.brute), Math.round(b.burn), Math.round(b.tox), Math.round(b.oxy)],
      crit: b.crit, dead: b.dead, stunned: m.stunned > 0, inside: m.inside ? m.inside.name : null,
      cuffed: !!m.cuffed, grabbed: m.pulledBy ? m.pulledBy.grab : -1, pulling: m.pulling ? m.pulling.name : m.hauling ? m.hauling.name : null, haul: m.hauling?.it ? m.hauling.it.idx : -1,
      job: m.job, name: m.name, access: [...m.access],
      suit: spaceSafe(m), slow: this.moveFactor(m), jet: !!m.jetOn, mag: !!m.magOn,
      ...(this.opts.debug ? { dbg: { god: !!b.god, noclip: !!m.noclip, speed: m.dbgSpeed ?? 1 } } : {}),
    };
  }

  // ------------------------------------------------------------------ message handling
  handle(c, msg) {
    switch (msg.t) {
      case 'hello':
        if (msg.name) { c.name = String(msg.name).replace(/[^\w .'-]/g, '').trim().slice(0, 24) || c.name; this.round.broadcast(); }
        if (msg.look) c.look = this.looks.sanitize(msg.look);
        break;
      case 'mirror': this.actions.mirror(c, msg); break;
      case 'strip': this.people.handle(c, msg); break;
      case 'stack': this.stacks.handle(c, msg); break;
      case 'stuff': { const g = this.gridFor(msg.g, c), it = g?.props.interact[msg.idx]; if (c.mob && it?.kind === 'closet') this.closets.stuff(c.mob, it, this.mobs.get(msg.id)); break; }
      case 'input':
        for (const inp of msg.list || [msg]) { if (c.inputs.length < 60) c.inputs.push(inp); }
        break;
      case 'click': this.actions.click(c, msg); break;
      case 'key': this.actions.key(c, msg); break;
      case 'inv': this.actions.inventory(c, msg); break;
      case 'say': this.chat.fromClient(c, msg); break;
      case 'term': this.terminals.handle(c, msg); break;
      case 'examine': this.actions.examine(c, msg); break;
      case 'lobby': this.round.handle(c, msg); break;
      case 'ghost': this.round.handle(c, msg); break;
      case 'dbg': this.debug.handle(c, msg); break;
      default: break;
    }
  }
}
