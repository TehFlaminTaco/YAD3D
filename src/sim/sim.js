import { TILE, KIND, SIM_DT, SNAP_EVERY, INTEREST, DECK_H } from '../shared/config.js';
import { decodeGrid, VOID_BP } from '../shared/leveldata.js';
import { GameMap } from '../shared/gamemap.js';
import { tfPoint, tfClone } from '../shared/math3.js';
import { settle, frameYaw } from '../shared/frames.js';
import { ItemDB, makeItemData, spriteOf } from '../shared/items.js';
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
import { Sun } from './power/powersim.js';
import { Lights } from './lights.js';
import { Tanks } from './tanks.js';
import { AI } from './ai.js';
import { attach, detach, place, recalc, internalsSource, spaceSafe, moveSlow, serializeInv, allItems, TANK_EMPTY } from './inventory.js';

const THERMAL_PART = [0.3, 0.15, 0.15, 0.15, 0.05, 0.15, 0.05];       // THERMAL_PROTECTION_HEAD, CHEST, GROIN, LEGS, FEET, ARMS, HANDS: what share of the body each is
import { breathRate } from '../shared/items.js';
import { breathOf, GAS_IDS } from '../shared/gases.js';
import { Dispensers } from './dispensers.js';
import { Anchoring } from './anchoring.js';
import { PipeFittings } from './pipefit.js';
import { PipeKit } from './pipekit.js';
import { Airlocks } from './airlocks.js';
import { Assemblies } from './assemblies.js';
import { AtmosControl } from './atmoscontrol.js';
import { Radiation } from './radiation.js';
import { Fire } from './fire.js';
import { SpaceHeaters } from './heaters.js';

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
    this.mapSeen = null;           // the map the client's picture of the world is of (it is sent the whole of another when it moves to one)
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
    this.madeBlueprints = new Set();        // the names of blueprints made while the game runs (the debug menu's deck test): grids built from them are sent to the clients with their blueprint
    this.rects = data.rects;
    this.time = 0;
    this.tick = 0;
    this.rand = rng(Date.now() & 0xffff);
    this.sun = new Sun(this.rand);          // where the sun is (the solar panels turn to it)
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
    this.lights = new Lights(this);
    this.tanks = new Tanks(this);
    this.dispensers = new Dispensers(this);
    this.anchoring = new Anchoring(this);
    this.pipefit = new PipeFittings(this);
    this.pipekit = new PipeKit(this);
    this.airlocks = new Airlocks(this);
    this.assemblies = new Assemblies(this);
    this.atmoscontrol = new AtmosControl(this);
    this.radiation = new Radiation(this);
    this.fire = new Fire(this);
    this.heaters = new SpaceHeaters(this);
    this.debug = new Debug(this);
    this.closets = new Closets(this, data.closets);       // each grid's closets are set up as it is added, after its floor items: closed closets swallow what lies on them

    const mapId = data.level.map;
    const def = data.level.maps[mapId];
    const map = this.addMap(mapId, def.name, { void: false });
    this.defaultMap = map;
    for (const pl of def.grids) this.addGrid(pl.bp, { map, kind: pl.kind, name: pl.name, tf: { p: pl.p, q: pl.q }, quiet: true });
    this.ensureVoid(map);                // after the real grids, which keep the first ids
    this.relink(map);
    this.physics.warm();
    this.docks = def.docks || {};        // where a shuttle that arrives later (the emergency shuttle) is held: { name: { bp, kind, name, p, q } }
    this.mapDocks = new Map([[mapId, this.docks]]);          // the same for every map that has been made (`loadMap`)
  }

  // ------------------------------------------------------------------ maps and grids
  /** A new map (a separate space of grids). It has its void from the start (see `ensureVoid`), unless the caller is about to fill it with grids first (`o.void === false`). */
  addMap(id, name, o = {}) {
    const map = new GameMap(id, name);
    this.maps.set(id, map);
    if (o.void !== false) this.ensureVoid(map);
    return map;
  }

  /**
   * A map of the level data that is not the round's own (Central Command), made the first time it is wanted: its grids at their places, its void, its docks. Nobody is in it
   * until something is carried there (`moveGrid`), so nothing is announced.
   */
  loadMap(id) {
    const have = this.maps.get(id);
    if (have) return have;
    const def = this.level.maps[id];
    if (!def) throw new Error(`no map "${id}" in the level data`);
    const map = this.addMap(id, def.name, { void: false });
    for (const pl of def.grids) this.addGrid(pl.bp, { map, kind: pl.kind, name: pl.name, tf: { p: pl.p, q: pl.q }, quiet: true });
    this.ensureVoid(map);
    this.relink(map);
    this.physics.warm();                 // (a world's first step is the slow one)
    this.mapDocks.set(id, def.docks || {});
    return map;
  }

  /**
   * The grid that stands for a map's empty space (kind 'void', no tiles, the map's own coordinates): what a body that is on no grid (it has floated off one)
   * is "on". Never drawn as terrain, never a physics body, never moves.
   */
  ensureVoid(map) {
    return map.void || this.addGrid(VOID_BP, { map, kind: 'void', name: 'Space', quiet: true });
  }

  /** Bring a grid into being in `o.map` at pose `o.tf`: its tiles, its air and power, its map's girders, the items that lie about on it, its closets. */
  addGrid(bp, o = {}) {
    const map = o.map || this.defaultMap;
    const g = new GridSim(this, decodeGrid(this.level, bp), { id: this.gridSeq++, kind: o.kind, name: o.name, tf: o.tf, docked: o.docked });
    this.grids.set(g.id, g);
    map.add(g);
    if (g.kind !== 'void') this.physics.add(g);
    if (!this.station && g.kind === 'station') this.station = g;
    for (const gd of g.props.girders) g.built.add({ id: this.builtSeq++, k: 'girder', c: gd.c, r: gd.r, st: GIRDER.NORMAL, grid: g });
    for (const it of g.props.items) {
      const item = this.newItem(it.path || '/obj/item', { name: it.name, sprite: it.sprite });
      place(this, item, g, it.x, it.z, it.y, it.l);
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

  /**
   * A grid, with whoever and whatever is on it, goes to another map and stands at `pose` there (let go, at rest). People aboard see it as nothing but the world around
   * them changing: they are sent the new map whole at the next snapshot. Everyone else in the old map sees the grid go, and everyone in the new one sees it come.
   */
  moveGrid(g, map, pose = g.tf) {
    const from = g.map;
    this.shuttles.flights.delete(g.id);
    const aboard = [...this.clients.values()].filter((c) => c.at.grid === g);
    g.emit({ e: 'grid-' }, { except: aboard });
    this.physics.remove(g);
    map.add(g);
    g.tf = tfClone(pose); g.home = tfClone(pose); g.vel = [0, 0, 0]; g.ang = [0, 0, 0]; g.poseSeq = undefined;
    this.physics.add(g);
    if (from !== map) this.relink(from);
    this.relink(map);
    g.emit({ e: 'grid+', ...this.gridState(g) });
    return g;
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
    for (const m of this.mobs.values()) if (m.grid === g) this.settleMob(m);          // anyone standing out on its open space is in the void now (it is not part of a held grid's frame any more)
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

  /**
   * After a body has moved: if it has walked onto another grid (through a docking door, say), it belongs to that grid now; if a player has gone off the
   * edge of one it floats in the map's void (with the grid's speed), and one that meets a grid too fast is stopped by it, hard.
   */
  settleMob(m) {
    if (!m.grid) return false;
    if (m.fell) this.zImpact(m);                                         // came down through a hole in a deck (stepMovement moved it down and counted)
    const r = settle(m.grid, m, !!m.client);
    if (!r) return false;
    m.grid = r.grid;
    m.dirty = true;
    if (r.impact > 0) this.hullImpact(m, r.grid, r.impact);
    return true;
  }

  /**
   * Landing from a fall through `m.fell` decks (turf.dm zImpact, living.dm ZImpactDamage): everyone near sees it, and it takes (5 * decks) ** 1.5 brute damage and is
   * knocked down for 5 seconds a deck, unless it came down on stairs, which take the fall (stairs.dm intercept_zImpact: no message, no hurt).
   */
  zImpact(m) {
    const levels = m.fell, how = m.landed;
    m.fell = 0; m.landed = null;
    m.dirty = true;
    if (how === 'stairs') return;
    const w = m.grid.world, c = Math.floor(m.x / TILE), r = Math.floor(m.z / TILE);
    const floor = `the ${w.floorName(w.idx(c, r, m.l | 0)) || 'floor'}`;
    this.chat.visible(m, `${m.name} falls through the open space!`, 'danger', 12);
    this.chat.visible(m, `${m.name} crashes into ${floor}!`, 'danger', 12);
    if (m.humanoid) {
      this.tell(m, 'danger', `You crash into ${floor} with a sickening noise!`);
      this.chat.visible(m, `${m.name} crashes into ${floor} with a sickening noise!`, 'danger', 12, m);
    }
    this.sound('bodyfall', m, 0.9);
    this.hurt(m, (levels * 5) ** 1.5, 'brute', 'fall');
    m.stunned = Math.max(m.stunned, levels * 5);
  }

  /** Someone has arrived on grid `g` `over` m/s faster (relative to it) than a body can take: it stops them, like landing from a height. */
  hullImpact(m, g, over) {
    this.sound('punch', m, Math.min(1, 0.4 + over * 0.05));
    this.tell(m, 'danger', `You crash into the ${g.name} with a sickening noise!`);
    this.chat.visible(m, `${m.name} crashes into the ${g.name} with a sickening noise!`, 'danger', 12, m);
    this.hurt(m, over * 1.5, 'brute', 'impact');
    m.stunned = Math.max(m.stunned, Math.min(3, over * 0.25));
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
    if (a.grid && a.grid === b.grid) {
      const dl = (a.l | 0) - (b.l | 0);
      return dl ? Math.hypot(a.x - b.x, a.z - b.z, dl * DECK_H) : Math.hypot(a.x - b.x, a.z - b.z);                  // (a floor between you is more than distance)
    }
    if (this.mapOf(a) !== this.mapOf(b)) return Infinity;
    const p = this.worldPos(a), q = this.worldPos(b);
    return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  }

  sameGrid(a, b) { return !!a.grid && a.grid === b.grid; }

  /** The grid a request (a click target, a message) is about: the one it names, else the one its sender stands on. */
  gridFor(id, c) { return (id !== undefined && this.grids.get(id)) || c?.mob?.grid || null; }

  /** Everyone's start points: [{ grid, job, x, y }] (tiles), in the map the round is played in. */
  spawnPoints() {
    const out = [];
    for (const g of this.grids.values()) if (g.map === this.defaultMap) for (const s of g.spawns) out.push({ grid: g, job: s.job, x: s.x, y: s.y, l: s.l | 0 });
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
   * {ghosts: true}; {except: [clients]}. An event with a `g` is about that grid, so only players in the grid's map get it.
   */
  emit(ev, scope) {
    const map = ev.g !== undefined ? this.grids.get(ev.g)?.map : null;
    for (const c of this.clients.values()) {
      if (map && c.map !== map) continue;
      if (scope) {
        if (scope.to && scope.to !== c) continue;
        if (scope.except && scope.except.includes(c)) continue;
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
    c.mapSeen = c.map;
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
      ...(this.madeBlueprints.has(g.bp) ? { def: this.level.grids[g.bp] } : {}),                     // (a blueprint made while the game runs is sent whole: the clients' level data does not have it)
      pw: g.powersim.state(),
      lights: g.props.lights.filter((L) => L.status).map((L) => [L.idx, L.status]),                 // the fixtures that are not whole
      gone: g.props.interact.filter((it) => it.gone && it.kind !== 'closet').map((it) => it.idx),    // things that were blown up
      pv: [...Object.values(g.powersim.machines).flat().filter((a) => a.rec?.idx !== undefined && a.v !== 0).map((a) => [a.rec.idx, a.v]), ...g.atmosdev.pv(), ...g.pipenet.pv(), ...this.assemblies.pv(g)],      // machines that show another picture (an APC open, an emitter running, a canister with a tank in it)
      pd: g.atmosdev.pd(),                                                                         // canisters broken open: no longer in the way
      ps: g.propLog,                                                                               // props made while the game runs
      pi: [...g.pipeLog].map(([s, v]) => [s, ...v]),                                               // pipes laid or taken up
      pn: [...g.nameLog],                                                                          // props that were renamed
      dg: [...g.doorGone],                                                                         // doors taken away
      fire: this.fire.state(g),                                                                    // the fires burning on tiles
      pa: [...g.anchorLog],                                                                        // props bolted down or freed
      doors: g.doors.map((d) => d.state), fdoors: g.firedoors.list.map((f) => (f.closed ? 1 : 0)),
      tiles: g.tileLog, panes: g.deadPanes, closets: this.closets.changed(g), moved: this.people.moved(g),
      gravity: g.world.gravityOn, built: [...g.built].map((b) => [b.id, b.k, b.c, b.r, b.st]),
    };
  }

  /** What a client needs to know to build its picture of the map it is in: its grids and what lies on them. (Sent whole when it joins and when it moves to another map.) */
  mapState(c) {
    const map = c.map;
    return {
      name: this.level.name,
      map: map.id,
      grids: [...map.grids.values()].map((g) => this.gridState(g)),
      items: [...this.floor.values()].filter((f) => f.grid.map === map).map((f) => [f.item.id, spriteOf(f.item), f.item.name, f.x, f.y, f.z, f.grid.id, f.l | 0]),
    };
  }

  /** Everything a joining client needs to build its view of the world. */
  worldState(c) {
    return {
      ...this.mapState(c),
      round: this.round.publicState(),
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
    this.radiation.update(dt);
    for (const g of this.grids.values()) g.firedoors.update(dt);
    this.windows.update();
    this.sun.update(dt);
    for (const g of this.grids.values()) { g.atmos.update(dt); g.powersim.update(dt); g.atmosdev.update(dt); g.pipenet.update(dt); }
    this.fire.update(dt);
    this.heaters.update(dt);
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
        m.speedNow = stepMovement(m, { f: inp.f, b: inp.b, l: inp.l, r: inp.r, run, yaw: inp.yaw, pitch: m.pitch }, m.grid.world, d, ctx);
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
    return { slow: this.moveFactor(m) * (m.body.crit ? 0.35 : 1), wind: m.grid.atmos.windAt(m.x, m.z, m.l | 0), ignore: m.hauling?.it, noclip: m.noclip, jet: !!m.jetOn, mag: !!m.magOn, free: !!m.client };
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
    m.speedNow = stepMovement(m, { yaw: m.yaw, pitch: m.pitch }, m.grid.world, d, { ...this.moveCtx(m), limp: true });
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
        stepMovement(g, inp, null, clamp(inp.dt || 0.016, 0.001, 0.06), { noclip: true, ghost: true });      // a ghost passes through everything, and goes where it looks: it needs no tiles
      }
    }
  }

  // ------------------------------------------------------------------ doors
  updateDoors(dt) {
    const players = [...this.clients.values()].filter((c) => c.mob && !c.mob.dead).map((c) => c.mob);
    const al = this.airlocks;
    al.update(dt);
    for (const g of this.grids.values()) {
      for (const d of g.doors) {
        if (d.gone) continue;
        if (d.state === 'closed') {
          for (const m of players) {
            if (this.dist(m, d) < 1.8 && d.allows(m) && al.hasPower(d) && !al.isCut(d, 'open')) { if (al.bump(d, m)) this.openDoor(d, m); break; }
          }
          continue;
        }
        const res = d.tick(dt);
        if (res) g.emit({ e: 'door', i: d.idx, st: res });
        if (res === 'closed' && !al.state(d).safe) al.crush(d);
        const hold = al.holdTime(d);
        if (d.state === 'open' && res === 'open') d.holdUntil = this.time + (hold ?? 1e9);
        if (d.state === 'open' && hold !== null && this.time > d.holdUntil) {
          if (!al.hasPower(d)) d.holdUntil = this.time + 1;
          else if (!al.state(d).safe || !this.occupied(d)) this.closeDoor(d); else d.holdUntil = this.time + 0.8;
        }
      }
    }
  }

  occupied(d) {
    for (const m of this.mobs.values()) if (!m.dead && this.dist(m, d) < 1.5) return true;
    return false;
  }

  openDoor(d, by, force = false) {
    if (d.gone) return false;
    if (!force && (d.bolted || d.welded || !this.airlocks.hasPower(d) || this.airlocks.isCut(d, 'open'))) return false;
    if (!d.open()) return false;
    d.grid.emit({ e: 'door', i: d.idx, st: 'opening' });
    this.sound('door_open', d, 0.9);
    return true;
  }

  closeDoor(d) {
    if (d.gone || !d.close()) return false;
    d.grid.emit({ e: 'door', i: d.idx, st: 'closing' });
    this.sound('door_close', d, 0.9);
    return true;
  }

  // ------------------------------------------------------------------ bodies
  tickBodies(dt) {
    for (const m of this.mobs.values()) {
      if (m.dead) continue;
      this.radiation.tick(m, dt);
      m.cool = Math.max(0, m.cool - dt);
      m.stunned = Math.max(0, m.stunned - dt);
      const [c, r] = m.tile;
      const a = m.grid?.atmos;                                       // in the void there is no air at all
      const env = a ? a.gasesAt(c, r, m.l | 0) : Object.fromEntries([['pressure', 0], ['temperature', 2.7], ...GAS_IDS.map((id) => [id, 0])]);
      if (!m.humanoid) env.temperature = undefined;                  // (only people keep a body temperature)
      let internals = false, breath = null;
      if (m.humanoid && m.internals) {
        const src = internalsSource(m);
        if (src) {                                                   // what is breathed is what the tank holds (at the pressure internals give it), and it is used up
          internals = true;
          breath = breathOf(src.mix);
          src.mix.remove(breathRate(src.def) * dt);
          if (src.mix.total() <= TANK_EMPTY) { m.internals = false; this.tell(m, 'danger', 'Your air tank runs dry!'); }
        }
      }
      m.body.tick(dt, { ...env, breath, safeSuit: m.kind === 'carp' || (m.humanoid && spaceSafe(m)), internals: internals || m.kind === 'carp', insulation: m.humanoid ? (T, now) => this.insulation(m, T, now) : undefined });
      if (m.humanoid && m.body.tempAlert !== m.tempShown) {          // the alert on the screen (alert.dm hot / cold)
        m.tempShown = m.body.tempAlert;
        if (m.tempShown === 'hot') this.tell(m, 'warning', "You're flaming hot! Get somewhere cooler and take off any insulating clothing like a fire suit.");
        else if (m.tempShown === 'cold') this.tell(m, 'warning', "You're freezing cold! Get somewhere warmer and take off any insulating clothing like a space suit.");
      }
      if (m.kind === 'human' && !m.body.dead) {                      // nitrous oxide (lungs.dm: over 1 kPa you are knocked out for a bit, over 5 you sleep)
        const pp = (breath || (internals ? null : env))?.n2o || 0;
        if (pp > 5) m.stunned = Math.max(m.stunned, 20);
        else if (pp > 1) m.stunned = Math.max(m.stunned, 6);
      }
    }
  }

  /**
   * How much of the heat (or the cold) of `T` kelvin their clothes keep out, 0 to 1 (carbon.dm get_heat_protection / get_cold_protection): the body parts that something they wear covers and
   * that is good against that temperature (`th` of the item: the hottest it takes, the parts, the coldest, the parts), added up by how much of the body each is. A suit and a helmet for space keep out all cold.
   * `now` is their body temperature: it is heat that is meant if `T` is above it.
   */
  insulation(m, T, now) {
    const heat = T > now;
    if (!heat && spaceSafe(m)) return 1;
    let mask = 0;
    for (const it of Object.values(m.worn)) {
      const th = it?.th;
      if (!th) continue;
      if (heat) { if (th[0] >= T) mask |= th[1]; } else if (th[2] <= Math.max(T, 2.7)) mask |= th[3];
    }
    let s = 0;
    for (let k = 0; k < 7; k++) if (mask & (1 << k)) s += THERMAL_PART[k];
    return s;
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

  /**
   * Turned to dust (the supermatter): dead, and nothing of them left: not the body, not what they carried. A player becomes a ghost as for any death. People who are
   * invulnerable (the debug menu's god mode) are not touched.
   */
  dust(m, cause = 'dust') {
    if (!m || m.body.god) return false;
    if (!m.dead) m.body.damage('brute', 9999, cause);
    for (const it of allItems(m)) { detach(this, it); this.items.delete(it.id); }
    this.people.release(m);
    if (m.pulledBy) this.people.release(m.pulledBy);
    if (m.inside) m.inside.mobs.splice(m.inside.mobs.indexOf(m), 1);
    for (const o of this.clients.values()) if (o.strip === m.id) this.people.closeStrip(o);
    this.mobs.delete(m.id);
    return true;
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

  /**
   * Something blows up at (x, z) of grid `g` (explosion(dev, heavy, light): `heavy` and `light` are radii in tiles): people near it are burnt and thrown about, cables
   * are cut, lamps smashed, and everyone within earshot feels it.
   */
  explosion(g, x, z, o = {}) {
    const dev = (o.dev ?? 0) * TILE, heavy = (o.heavy ?? 0) * TILE, light = (o.light ?? 0) * TILE, at = { grid: g, x, z, l: o.l | 0 };
    this.sound('explosion', at, 1);
    this.shake(at, 0.8, 60);
    for (const m of this.mobs.values()) {
      if (m.dead || m.grid !== g) continue;
      const d = Math.hypot(m.x - x, m.z - z);
      if (d <= dev) { this.hurt(m, 500, 'brute', 'explosion'); continue; }                  // (devastation: nothing is left of them)
      if (d <= heavy) { this.hurt(m, 60 * (1 - d / (heavy + 0.01) * 0.4), 'brute', 'explosion'); this.hurt(m, 25, 'burn', 'explosion'); m.stunned = Math.max(m.stunned, 3); }
      else if (d <= light) this.hurt(m, 30 * (1 - (d - heavy) / (light - heavy + 0.01)), 'brute', 'explosion');
    }
    const c = Math.floor(x / TILE), r = Math.floor(z / TILE);
    g.powersim.blast(c, r, Math.ceil(heavy / TILE) + 1, o.l | 0);
    g.atmosdev.blast(c, r, o.heavy ?? 0, o.light ?? 0, o.l | 0);
    this.lights.blast(g, c, r, Math.ceil(light / TILE));
    if (o.dev) this.devastate(g, c, r, o.dev, o.heavy ?? 0);
  }

  /** What a big explosion does to the hull: walls within `dev` tiles are scraped down to plating (ScrapeAway), windows within `heavy` tiles smash. */
  devastate(g, c0, r0, dev, heavy) {
    const w = g.world, reach = Math.ceil(Math.max(dev, heavy));
    for (let dr = -reach; dr <= reach; dr++) for (let dc = -reach; dc <= reach; dc++) {
      const c = c0 + dc, r = r0 + dr, d = Math.hypot(dc, dr);
      if (c < 0 || r < 0 || c >= w.W || r >= w.H) continue;
      const i = w.idx(c, r);
      if (d <= dev && w.wallKey(i)) { w.dismantleWall(c, r, w.level.terrain.plating); this.tileChanged(g, c, r); }
      else if (d <= heavy && w.glass[i]) this.breachTile(g, c, r, 'explosion');
    }
  }

  /**
   * Make props while the game runs (the specs are level prop records: see Grid.addProps). Everyone is told, and whoever joins later; returns the new records, which have their
   * indexes in `props.interact` from here on. Other things that count props (the pipe network, the power machines) are told by the caller.
   */
  addProps(g, specs) {
    const added = g.addProps(specs);
    g.propLog.push(...specs);
    g.emit({ e: 'p+', sp: specs });
    this.physics.touch(g);
    return added.interact;
  }

  /** A prop is taken away (it stays in the lists, hidden: its index is never used again). Everyone is told. */
  /** A prop has another name now (an airlock assembly that was wired): everyone is told, and whoever joins. */
  renameProp(g, it, name) {
    if (it.name === name) return;
    it.name = name;
    g.nameLog.set(it.idx, name);
    g.emit({ e: 'pn', i: it.idx, n: name });
  }

  /** A door is put up (an airlock finished) from a level door record: returns the door. */
  addDoor(g, spec) {
    this.addProps(g, [spec]);
    const d = g.doors[g.doors.length - 1];
    g.atmos.tileChanged(d.c, d.r, d.l | 0);
    return d;
  }

  /** A door is taken away (an airlock taken apart): its tile is open floor again, everyone is told. */
  removeDoor(g, d) {
    if (!g.removeDoor(d.idx)) return;
    g.doorGone.add(d.idx);
    g.emit({ e: 'door-', i: d.idx });
    g.atmos.tileChanged(d.c, d.r, d.l | 0);
    this.physics.touch(g);
  }

  removeProp(g, it) {
    if (it.gone) return;
    it.gone = true;
    g.world.boxDrop(it);
    if (it.bh && it.anc) g.world.solid[g.world.idx(it.c, it.r, it.l | 0)] = 0;
    g.emit({ e: 'pg', i: it.idx });
    this.physics.touch(g);
  }

  /** The wall switch of a room's lights. */
  setLightSwitch(g, a, on) { g.powersim.setSwitch(a, on); }

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
    const m = this.newMob({ kind: 'human', name, job: job.id, look, grid: p.grid, l: p.l, x: p.x * TILE + TILE / 2, z: p.y * TILE + TILE / 2, speed: 1.7 + this.rand() * 0.5, hp: 100 });
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
      const hands = m.hands.map((it) => (it ? { p: it.path, on: !!it.lit } : null));        // what they hold (a lit welding tool looks lit in the hand)
      m.ap = this.looks.appearance(m.look, by, hands);
      if (m.cuffed) m.ap.o.cuffs = this.looks.meta.cuffs;
      m.apDirty = false;
      m.apRev = (m.apRev || 0) + 1;
    }
    return m.ap;
  }

  /** The clothes someone starts a job in, for the lobby's mannequin. */
  outfitPreview(job) {
    return this.looks.outfit(job.outfit || {});
  }

  /**
   * Tell everyone about anybody who has changed clothes, hair or what they hold since the last snapshot. Compared with what was last sent, not with what was last worked out:
   * anything that asks for an appearance (the strip window does) works it out again and clears the dirty flag, and the change must still go out.
   */
  sendLookChanges() {
    for (const m of this.mobs.values()) {
      if (!m.look) continue;
      const ap = this.appearanceOf(m);
      if (m.apSentRev === m.apRev) continue;
      const key = JSON.stringify(ap);
      if (m.apSent !== undefined && key !== m.apSent) this.emit({ e: 'look', id: m.id, ap });
      m.apSent = key; m.apSentRev = m.apRev;
    }
  }

  sendSnapshots() {
    this.sendLookChanges();
    const mobsArr = [...this.mobs.values()];
    for (const c of this.clients.values()) {
      const here = c.at, map = c.map;
      if (c.mapSeen !== map) {                                           // it has moved to another map (its grid was carried there, or it was sent): it is told the whole of that one
        c.mapSeen = map;
        c.known.clear(); c.poses = new Map();
        c.send({ t: 'map', ...this.mapState(c) });
      }
      const list = [];
      const seen = new Set();
      for (const m of mobsArr) {
        if (m.evacuated || (m.inside && m !== c.mob)) continue;       // nobody sees someone shut in a locker
        if (this.mapOf(m) !== map) continue;
        if (m !== c.mob && this.dist(m, here) > INTEREST) continue;
        seen.add(m.id);
        if (!c.known.has(m.id)) { c.known.add(m.id); c.outbox.push({ e: 'mob+', id: m.id, n: m.name, job: m.job, set: m.set, kind: m.kind, ap: m.look ? this.appearanceOf(m) : undefined }); }
        const flags = (m.dead ? 1 : 0) | (m.body.crit ? 2 : 0) | (m.speedNow > 3.8 ? 8 : 0) | (m.stunned > 0 || m.downed ? 16 : 0) | (Math.min(15, m.l | 0) << 8);        // (bits 8 to 11: its deck)
        const row = [m.id, m.grid ? m.grid.id : 0, +m.x.toFixed(2), +m.z.toFixed(2), +m.yaw.toFixed(2), flags, +(m.speedNow || 0).toFixed(1)];
        if (m.grid?.kind === 'void') row.push(+m.y.toFixed(2));                       // floating, it has a height as well
        list.push(row);
      }
      for (const id of [...c.known]) if (!seen.has(id)) { c.known.delete(id); c.outbox.push({ e: 'mob-', id }); }
      const snap = { t: 'snap', tick: this.tick, ack: c.lastSeq, mobs: list };
      const moved = this.movedGrids(c, map);
      if (moved.length) snap.grids = moved;
      const m = c.mob;
      if (m) {
        const [tc, tr] = m.tile, g = m.grid;
        snap.you = { g: g.id, x: +m.x.toFixed(3), z: +m.z.toFixed(3), vx: +m.vx.toFixed(2), vz: +m.vz.toFixed(2), id: m.id };
        if (m.l) snap.you.l = m.l;
        if (g.kind === 'void') Object.assign(snap.you, { y: +m.y.toFixed(3), vy: +m.vy.toFixed(2), q: m.q.map((v) => +v.toFixed(5)) });          // floating: its height, and which way is up
        const ml = m.l | 0;
        const e = g.atmos.gasesAt(tc, tr, ml);
        snap.env = { p: +e.pressure.toFixed(1), o2: +e.o2.toFixed(1), tox: +e.tox.toFixed(2), co2: +e.co2.toFixed(2), n2o: +e.n2o.toFixed(2), area: g.world.inb(tc, tr, ml) ? g.world.areaIdx[g.world.idx(tc, tr, ml)] : 0 };
        const wind = g.atmos.windAt(m.x, m.z, ml);
        if (wind) snap.you.wind = [+wind[0].toFixed(2), +wind[1].toFixed(2)];
        const self = this.selfState(c);
        const json = JSON.stringify(self);
        if (json !== c.selfJson) { c.selfJson = json; c.outbox.push({ e: 'self', ...self }); }
      } else {
        snap.you = { g: map.void.id, x: +c.ghost.x.toFixed(2), y: +c.ghost.y.toFixed(2), z: +c.ghost.z.toFixed(2), vx: 0, vz: 0, ghost: true };      // a ghost floats in the void, in the map's own coordinates
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
      tray: m.humanoid && allItems(m).some((i) => i.def.tray && i.on),
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
