import { TILE, KIND, SLOTS } from '../shared/config.js';
import { attach, detach, place, recalc } from './inventory.js';
import { stackInfo } from '../shared/stacks.js';
import { qmul, qFromAxisAngle, qYaw, qTwistY, tfClone } from '../shared/math3.js';
import { makeBlueprint } from '../shared/blueprint.js';

const MAX_ITEMS = 25;             // most things one spawn makes (a stack counts as one thing with that many in it)
const MAX_STACK = 50;
const PETS = { corgi: 'Ian', cat: 'Runtime', monkey: 'Pun Pun' };
const LEVELS = ['green', 'blue', 'red'];

/** The two-deck grid of the debug menu: a room with a stair (>) up to a floor that has a hole (the blank squares) over its west end, where the stair is. */
const DECKS = [
  ['###########', '#.........#', '#.L.....L.#', '#.S.>.....#', '#.L.....L.#', '#.........#', '###########'],
  ['###########', '#    .....#', '#    ..L..#', '#    .....#', '#    ..L..#', '#    .....#', '###########'],
];

const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
const int = (v, lo, hi, d = lo) => Math.min(hi, Math.max(lo, Math.round(num(v, d))));

/**
 * The debug menu's other half: spawn things, heal, teleport, cause trouble. Only works when the sim was started with
 * `debug: true` (the server's --debug flag, or ?debug in a local round); otherwise every {t: 'dbg'} message is ignored.
 * Whatever a client sends is checked here, because a client is never to be trusted even with this.
 */
export class Debug {
  constructor(sim) { this.sim = sim; }

  get on() { return !!this.sim.opts.debug; }

  handle(c, msg) {
    if (!this.on || !msg || typeof msg.op !== 'string') return;
    const ops = this.ops;
    if (Object.hasOwn(ops, msg.op)) ops[msg.op].call(this, c, msg);
  }

  say(c, text) { this.sim.tellClient(c, 'notice', `[Debug] ${text}`); }

  // ------------------------------------------------------------------ where things go
  /** The grid an operation is about: the one you stand on, or the station if you are a ghost. */
  grid(c) { return c.mob?.grid || this.sim.station; }

  /** (x, z) of you in `grid(c)`'s frame: your body, or where your ghost is over that grid. */
  at(c) {
    if (c.mob) return [c.mob.x, c.mob.z];
    const p = this.grid(c).localPoint([c.ghost.x, c.ghost.y, c.ghost.z]);
    return [p[0], p[2]];
  }

  /** A free spot at or near (x, z) of grid `g` for something the size of a person, or null if there is none within a few metres. */
  spotNear(g, x, z) {
    const w = g.world;
    if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
    for (let rad = 0; rad <= 6; rad += 0.5) {
      for (let k = 0; k < (rad ? 12 : 1); k++) {
        const a = k * Math.PI / 6, nx = x + Math.cos(a) * rad, nz = z + Math.sin(a) * rad;
        if (!w.collides(nx, nz, 0.34)) return [nx, nz];
      }
    }
    return null;
  }

  /** Where a spawn goes: the point you are looking at (the client works it out), or just in front of you. */
  target(c, msg) {
    const g = this.grid(c), w = g.world;
    if (msg.where === 'look' && Array.isArray(msg.at) && msg.at.every(Number.isFinite)) {
      const [x, z] = msg.at;
      if (w.inb(Math.floor(x / TILE), Math.floor(z / TILE))) return this.spotNear(g, x, z) || this.at(c);
    }
    const [x, z] = this.at(c), m = c.mob;
    if (!m) return [x, z];
    return this.spotNear(g, x - Math.sin(m.yaw) * 1.0, z - Math.cos(m.yaw) * 1.0) || [x, z];
  }

  /** Move a body or a ghost; people lose their grip on things and leave lockers. */
  teleport(c, who, g, x, z) {
    const sim = this.sim;
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    if (!who) { const p = g.worldPoint(x, 0, z); c.ghost.x = p[0]; c.ghost.y = p[1]; c.ghost.z = p[2]; c.ghost.map = g.map; return; }
    const spot = this.spotNear(g, x, z);
    if (!spot) return;
    if (who.inside) { const it = who.inside; it.mobs.splice(it.mobs.indexOf(who), 1); who.inside = null; }
    sim.people.release(who);
    if (who.pulledBy) sim.people.release(who.pulledBy);
    who.grid = g; who.map = g.map; who.l = 0;
    who.x = spot[0]; who.z = spot[1]; who.vx = who.vz = 0;
    who.dirty = true;
  }

  // ------------------------------------------------------------------ the operations
  get ops() {
    return this._ops || (this._ops = {
      // -- spawning
      spawn: this.spawn, mob: this.spawnMob, delete: this.remove,
      // -- me
      heal: this.heal, revive: this.revive, god: this.god, noclip: this.noclip, speed: this.speed, access: this.access, outfit: this.outfit,
      // -- going places
      tp: this.tp, area: this.goArea, goto: this.goMob, bring: this.bring, who: this.who,
      // -- the station
      map: this.mapOp, alert: this.alert, power: this.power, strike: this.strike, carp: this.carp, shuttle: this.shuttle, doors: this.doors,
      repair: this.repair, round: this.round, skip: this.skip, gravity: this.gravity, space: this.space, grid: this.gridOp,
      // -- what the network test uses
      kill: this.kill, finish: this.finish, tile: this.tile, noop() {},
    });
  }

  spawn(c, msg) {
    const sim = this.sim;
    const path = typeof msg.path === 'string' ? msg.path : '';
    if (!Object.hasOwn(sim.db.defs, path)) { this.say(c, 'No such item.'); return; }
    const info = stackInfo(path);
    const stack = !!info || (sim.db.behavior(path).stack || 0) > 1;
    const n = int(msg.n, 1, stack ? (info?.max ?? MAX_STACK) : MAX_ITEMS, 1);
    const items = stack ? [sim.newItem(path, { amount: n })] : Array.from({ length: n }, () => sim.newItem(path));
    const m = c.mob;
    const g = this.grid(c);
    const [x, z] = this.target(c, msg);
    let hands = 0;
    for (const it of items) {
      if (msg.where === 'hand' && m?.humanoid) {
        const free = m.hands[m.active] ? (m.hands[1 - m.active] ? -1 : 1 - m.active) : m.active;
        if (free >= 0) { attach(sim, it, { t: 'hand', mob: m, i: free }); hands++; continue; }
      }
      place(sim, it, g, x + (sim.rand() - 0.5) * 0.8, z + (sim.rand() - 0.5) * 0.8);
    }
    sim.sound('ping', { grid: g, x, z }, 0.4);
    this.say(c, `Spawned ${stack ? '' : n > 1 ? n + ' x ' : ''}${items[0].name}${stack && n > 1 ? ' (' + n + ')' : ''}${hands ? ' in your hand' : ''}.`);
  }

  spawnMob(c, msg) {
    const sim = this.sim, g = this.grid(c);
    const [x, z] = this.target(c, msg);
    const kind = String(msg.kind);
    if (kind === 'carp') {
      if (!sim.ai.spawnCarp(g, x, z)) { this.say(c, 'This level has no carp.'); return; }
      this.say(c, 'A space carp appears.');
    } else if (PETS[kind]) {
      if (!sim.level.mobs[kind]) { this.say(c, `This level has no ${kind}.`); return; }
      sim.newMob({ kind: 'pet', set: kind, name: PETS[kind], grid: g, x, z, speed: 1.6, hp: 30, pet: true, regen: 0 });
      this.say(c, `${PETS[kind]} appears.`);
    } else if (kind === 'crew') {
      const job = sim.jobs.byId[msg.job];
      if (!job) { this.say(c, 'No such job.'); return; }
      const m = sim.spawnCrew(job, null);
      m.grid = g; m.map = g.map; m.l = 0; m.x = x; m.z = z; m.home = [Math.floor(x / TILE), Math.floor(z / TILE)];
      this.say(c, `${m.name} the ${job.title} appears.`);
    } else this.say(c, 'No such creature.');
  }

  /** Remove what you are pointing at: a loose item, someone who is not a player, or a closet. */
  remove(c, msg) {
    const sim = this.sim, t = msg.target || {};
    if (t.k === 'item') {
      const rec = sim.floor.get(t.id);
      if (!rec) return;
      detach(sim, rec.item); sim.items.delete(rec.item.id);
      this.say(c, `Removed ${rec.item.name}.`);
    } else if (t.k === 'mob') {
      const m = sim.mobs.get(t.id);
      if (!m || m.client || m === c.mob) { this.say(c, 'That is a player.'); return; }
      sim.people.release(m);
      if (m.pulledBy) sim.people.release(m.pulledBy);
      if (m.inside) m.inside.mobs.splice(m.inside.mobs.indexOf(m), 1);
      for (const o of sim.clients.values()) if (o.strip === m.id) sim.people.closeStrip(o);
      sim.mobs.delete(m.id);
      this.say(c, `Removed ${m.name}.`);
    } else if (t.k === 'prop') {
      const it = sim.gridFor(t.g, c)?.props.interact[t.idx];
      if (!it || it.kind !== 'closet' || it.gone) { this.say(c, 'Only lockers and crates can be removed.'); return; }
      sim.closets.dump(it, null);
      sim.closets.set(it, it.cs, true);
      this.say(c, `Removed the ${it.name}.`);
    }
  }

  // ------------------------------------------------------------------ me
  /** The body an operation is about: the one named by `id`, or yours. */
  subject(c, msg) { return msg.id !== undefined ? this.sim.mobs.get(msg.id) : c.mob; }

  healBody(m) {
    const b = m.body;
    b.brute = b.burn = b.tox = b.oxy = 0;
    b.breathless = 0; b.critTime = 0; b.stun = 0;
    m.stunned = 0;
    m.dirty = true;
  }

  heal(c, msg) {
    const m = this.subject(c, msg);
    if (!m || m.dead) { this.say(c, 'Nobody to heal.'); return; }
    this.healBody(m);
    this.say(c, `${m === c.mob ? 'You are' : m.name + ' is'} in perfect health.`);
  }

  revive(c, msg) {
    const sim = this.sim;
    const m = msg.id !== undefined ? sim.mobs.get(msg.id) : c.deadMob;
    if (!m || !m.dead) { this.say(c, 'Nobody to revive.'); return; }
    m.dead = false; m.body.dead = false;
    this.healBody(m);
    const owner = [...sim.clients.values()].find((o) => o.deadMob === m);
    if (owner && !owner.mob) {
      owner.mob = m; m.client = owner; owner.deadMob = null; owner.state = 'playing'; owner.selfJson = '';
      sim.round.broadcast();
    }
    this.say(c, `${m === c.mob ? 'You are' : m.name + ' is'} alive.`);
  }

  god(c, msg) {
    const m = c.mob;
    if (!m) return;
    m.body.god = msg.on !== undefined ? !!msg.on : !m.body.god;
    c.selfJson = '';
    this.say(c, `God mode ${m.body.god ? 'on' : 'off'}.`);
  }

  noclip(c, msg) {
    const m = c.mob;
    if (!m) return;
    m.noclip = msg.on !== undefined ? !!msg.on : !m.noclip;
    c.selfJson = '';
    this.say(c, `Noclip ${m.noclip ? 'on: walk through walls' : 'off'}.`);
  }

  speed(c, msg) {
    const m = c.mob;
    if (!m) return;
    m.dbgSpeed = Math.min(6, Math.max(0.25, num(msg.v, 1)));
    c.selfJson = '';
    this.say(c, `Speed x${m.dbgSpeed}.`);
  }

  access(c) {
    const sim = this.sim, m = c.mob;
    if (!m?.humanoid) return;
    let id = m.worn.id;
    if (!id) { id = sim.newItem('/obj/item/card/id', { name: `${m.name}'s ID Card` }); attach(sim, id, { t: 'slot', mob: m, slot: 'id' }); }
    id.access = [...sim.jobs.everyAccess];                                   // (every one there is, Central Command's too: the debug ID is not anybody's job)
    recalc(sim, m);
    this.say(c, `Your ID opens everything (${id.access.length} accesses).`);
  }

  /** Put on a job's whole outfit; what you wore goes to the floor. */
  outfit(c, msg) {
    const sim = this.sim, m = c.mob, job = sim.jobs.byId[msg.job];
    if (!m?.humanoid || !job) { this.say(c, 'No such job.'); return; }
    for (const s of SLOTS) {
      const it = m.worn[s];
      if (!it) continue;
      detach(sim, it);
      place(sim, it, m.grid, m.x + (sim.rand() - 0.5) * 1.2, m.z + (sim.rand() - 0.5) * 1.2);
    }
    sim.outfit(m, job);
    this.say(c, `You are dressed as a ${job.title}.`);
  }

  kill(c, msg) {
    const m = this.subject(c, msg);
    if (!m || m.dead) return;
    m.body.god = false;
    m.body.damage('brute', 999, 'debug');
  }

  // ------------------------------------------------------------------ going places
  tp(c, msg) {
    const [x, z] = msg.c !== undefined ? [num(msg.c) * TILE + TILE / 2, num(msg.r) * TILE + TILE / 2] : [num(msg.x), num(msg.z)];
    const g = this.grid(c), w = g.world;
    if (!w.inb(Math.floor(x / TILE), Math.floor(z / TILE))) return;
    this.teleport(c, c.mob, g, x, z);
  }

  goArea(c, msg) {
    const g = this.grid(c), w = g.world, a = int(msg.idx, 0, w.areas.length - 1);
    const tiles = [];
    let sx = 0, sz = 0;
    for (let i = 0; i < w.W * w.H; i++) {
      if (w.areaIdx[i] !== a || w.kind[i] !== KIND.FLOOR || w.solid[i]) continue;
      const cc = i % w.W, rr = (i - cc) / w.W;
      tiles.push([cc, rr]); sx += cc; sz += rr;
    }
    if (!tiles.length) { this.say(c, `${w.areas[a].n} has no floor to stand on.`); return; }
    const mx = sx / tiles.length, mz = sz / tiles.length;
    tiles.sort((p, q) => Math.hypot(p[0] - mx, p[1] - mz) - Math.hypot(q[0] - mx, q[1] - mz));
    this.teleport(c, c.mob, g, tiles[0][0] * TILE + TILE / 2, tiles[0][1] * TILE + TILE / 2);
    this.say(c, `You are in ${w.areas[a].n}.`);
  }

  goMob(c, msg) {
    const o = this.sim.mobs.get(msg.id);
    if (o && o.grid) this.teleport(c, c.mob, o.grid, o.x + 1, o.z);
  }

  bring(c, msg) {
    const o = this.sim.mobs.get(msg.id);
    if (!o || o === c.mob) return;
    const [x, z] = this.at(c);
    this.teleport(c, o, this.grid(c), x + 1, z);
  }

  /** Everyone there is, for the menu's list. */
  who(c) {
    const sim = this.sim;
    const rows = [...sim.mobs.values()].map((m) => ({ id: m.id, n: m.name, job: m.job, kind: m.kind, dead: m.dead, pl: !!m.client, g: m.grid ? m.grid.id : 0, x: Math.round(m.x), z: Math.round(m.z) }));
    rows.sort((a, b) => (b.pl - a.pl) || a.n.localeCompare(b.n));
    sim.emit({ e: 'dbg', k: 'who', mobs: rows }, { to: c });
  }

  // ------------------------------------------------------------------ the station
  alert(c, msg) {
    if (!LEVELS.includes(msg.level)) return;
    this.sim.director.setLevel(msg.level);
    this.say(c, `Alert level ${msg.level}.`);
  }

  /** The grid, from the debug menu: `fill` (every cell and SMES full), `drain` (every one empty), `engine` (on or off), `fail` (every APC fails for half a minute, as in a grid check). */
  power(c, msg) {
    const ps = this.grid(c).powersim, M = ps.machines;
    switch (msg.what) {
      case 'fill':
        for (const a of M.apc) if (a.cell) a.cell.charge = a.cell.max;
        for (const s of M.smes) s.charge = s.capacity;
        this.say(c, 'Every cell and SMES is full.');
        break;
      case 'drain':
        for (const a of M.apc) if (a.cell) a.cell.charge = 0;
        for (const s of M.smes) s.charge = 0;
        this.say(c, 'Every cell and SMES is empty.');
        break;
      case 'engine':
        ps.engine.running = !ps.engine.running;
        this.say(c, `The engine is ${ps.engine.running ? 'running' : 'stopped'}.`);
        break;
      case 'fail':
        for (const a of M.apc) a.energyFail(15);
        this.say(c, 'Every APC fails for half a minute.');
        break;
      default: break;
    }
  }

  /** Station gravity on / off (no `on`: flip it). */
  gravity(c, msg) {
    const sim = this.sim, g = this.grid(c);
    const on = msg.on === undefined ? !g.world.gravityOn : !!msg.on;
    sim.setGravity(g, on);
    this.say(c, `Gravity ${on ? 'on' : 'off'}.`);
  }

  /** Put me in open space: the nearest space tile to where I stand (or the ghost's camera). */
  space(c) {
    const g = this.grid(c), w = g.world, m = c.mob;
    const [x0, z0] = this.at(c);
    const c0 = Math.floor(x0 / TILE), r0 = Math.floor(z0 / TILE);
    let best = -1, bd = Infinity;
    for (let r = Math.max(0, r0 - 40); r <= Math.min(w.H - 1, r0 + 40); r++) {
      for (let cc = Math.max(0, c0 - 40); cc <= Math.min(w.W - 1, c0 + 40); cc++) {
        const i = w.idx(cc, r);
        if (w.kind[i] !== KIND.SPACE) continue;
        // a space tile with space all round it: out of reach of the hull, and not over the map's edge
        let open = true;
        for (let dr = -1; dr <= 1 && open; dr++) for (let dc = -1; dc <= 1; dc++) if (w.kindAt(cc + dc, r + dr) !== KIND.SPACE || !w.inb(cc + dc, r + dr)) { open = false; break; }
        if (!open) continue;
        const d = (cc - c0) ** 2 + (r - r0) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
    }
    if (best < 0) { this.say(c, 'No open space nearby.'); return; }
    const x = (best % w.W) * TILE + TILE / 2, z = Math.floor(best / w.W) * TILE + TILE / 2;
    if (!m) { this.teleport(c, null, g, x, z); return; }
    if (m.inside) { m.inside.mobs.splice(m.inside.mobs.indexOf(m), 1); m.inside = null; }
    this.sim.people.release(m);
    if (m.pulledBy) this.sim.people.release(m.pulledBy);
    m.x = x; m.z = z; m.vx = m.vz = 0; m.dirty = true;
    this.say(c, 'You are in open space.');
  }

  /**
   * Fly the grids about (the debug menu's Grids tab). `what`: list | out (fly clear of whatever it sits against) | home (fly back and dock) | spin (`w`
   * rad/s about the vertical) | stop | board (put you on it). A docked grid is let go first.
   */
  gridOp(c, msg) {
    const sim = this.sim, what = String(msg.what);
    if (what === 'list') {
      const map = sim.mapOf(c.at);
      const grids = map.solids.map((g) => ({ id: g.id, bp: g.bp, kind: g.kind, name: g.name, docked: g.docked, tilted: g.tilted, flying: sim.shuttles.flying(g), sp: +Math.hypot(g.vel[0], g.vel[2]).toFixed(1), spin: +g.ang[1].toFixed(2), x: Math.round(g.tf.p[0]), z: Math.round(g.tf.p[2]) }));
      sim.emit({ e: 'dbg', k: 'grids', grids }, { to: c });
      return;
    }
    if (what === 'deck') { this.deckOp(c); return; }
    const g = sim.grids.get(int(msg.id, 0, 1e6));
    if (!g || g === sim.station) { this.say(c, 'No such grid.'); return; }
    switch (what) {
      case 'out': {
        const d = sim.shuttles.clearDirection(g, 60);
        if (!d) { this.say(c, `${g.name} has no clear way out.`); break; }
        sim.shuttles.fly(g, { p: [g.tf.p[0] + d[0] * 60, g.tf.p[1], g.tf.p[2] + d[2] * 60], q: g.tf.q });
        this.say(c, `${g.name} pulls away.`);
        break;
      }
      case 'home': sim.shuttles.fly(g, g.home, { dock: true }); this.say(c, `${g.name} heads for its dock.`); break;
      case 'spin': {
        if (g.docked) sim.undock(g);
        sim.physics.setVel(g, [...g.vel], [0, Math.max(-2, Math.min(2, num(msg.w, 0.5))), 0]);
        this.say(c, `${g.name} spins.`);
        break;
      }
      case 'stop': sim.shuttles.halt(g); this.say(c, `${g.name} stops.`); break;
      case 'tilt': {                                                                          // turn it up on its side (about the east-west axis) by `deg` degrees: a grid across the others
        if (g.docked) sim.undock(g);
        sim.physics.setFree3d(g, true);
        const deg = Math.max(-180, Math.min(180, num(msg.deg, 90)));
        sim.physics.place(g, { p: [...g.tf.p], q: qmul(qFromAxisAngle([1, 0, 0], deg * Math.PI / 180), g.tf.q) });
        sim.relink(g.map);
        g.emit({ e: 'grid~', docked: false, tf: tfClone(g.tf) });
        this.say(c, `${g.name} tips over.`);
        break;
      }
      case 'level': {
        sim.physics.setVel(g, [0, 0, 0], [0, 0, 0]);
        sim.physics.place(g, { p: [g.tf.p[0], 0, g.tf.p[2]], q: qYaw(qTwistY(g.tf.q)) });
        sim.physics.setFree3d(g, false);
        sim.relink(g.map);
        g.emit({ e: 'grid~', docked: false, tf: tfClone(g.tf) });
        this.say(c, `${g.name} rights itself.`);
        break;
      }
      case 'board': {
        const w = g.world;
        for (let i = 0; i < w.n; i++) if (w.kind[i] === KIND.FLOOR && !w.solid[i] && !w.doorAt.has(i)) { this.teleport(c, c.mob, g, (i % w.W) * TILE + 1, Math.floor(i / w.W) * TILE + 1); break; }
        break;
      }
      default: break;
    }
  }

  /** A small grid of two decks, made once, out beyond the station's edge, held where it is: somewhere to try stairs, holes and falls. You are put on it. */
  deckOp(c) {
    const sim = this.sim, name = 'debug_decks';
    if (!c.mob) { this.say(c, 'You need a body for that.'); return; }
    if (!sim.madeBlueprints.has(name)) { sim.level.grids[name] = makeBlueprint(sim.level, DECKS); sim.madeBlueprints.add(name); }
    let g = [...sim.grids.values()].find((x) => x.bp === name && x.map === sim.mapOf(c.at));
    if (!g) {
      const tf = { p: [-80, 0, 120], q: [0, 0, 0, 1] };
      g = sim.addGrid(name, { map: sim.mapOf(c.at), kind: 'shuttle', name: 'Deck Test', tf, docked: true });
      g.home = tfClone(tf);
    }
    this.teleport(c, c.mob, g, 3 * TILE + 1, 3 * TILE + 1);
    this.say(c, 'You are on the deck test grid: the stair climbs east, out of a hole in the upper floor.');
  }

  /** Go to another map: `away` (made on the first visit: a copy of a shuttle, alone in a map of its own), `centcom` (Central Command) or back `home` to where the crew arrive. A watcher goes too. */
  mapOp(c, msg) {
    const sim = this.sim, what = String(msg.what);
    let g, x, z;
    if (what === 'away') {
      let map = sim.maps.get('away');
      if (!map) {
        map = sim.addMap('away', 'Away Mission');
        const bp = sim.level.maps[sim.level.map].grids.find((p) => p.kind === 'shuttle').bp;
        sim.addGrid(bp, { map, kind: 'away', name: 'Away Mission', tf: { p: [0, 0, 0], q: [0, 0, 0, 1] } });
      }
      g = map.solids[0];
      const w = g.world;
      for (let i = 0; i < w.n; i++) if (w.kind[i] === KIND.FLOOR && !w.solid[i] && !w.doorAt.has(i)) { x = (i % w.W) * TILE + 1; z = Math.floor(i / w.W) * TILE + 1; break; }
    } else if (what === 'centcom') {
      const map = sim.loadMap('centcom'), dock = sim.mapDocks.get('centcom').emergency;
      g = map.solids[0];
      x = dock.p[0] + 3 - 12; z = dock.p[2] + 27;                                              // a few tiles inside, level with the emergency shuttle's dock (its port tile is 3 m and 27 m along from its origin)
    } else if (what === 'home') {
      const sp = sim.spawnPoints().find((s) => s.job === 'latejoin') || sim.spawnPoints()[0];
      g = sp.grid; x = sp.x * TILE + 1; z = sp.y * TILE + 1;
    } else return;
    this.teleport(c, c.mob, g, x, z);
    this.say(c, what === 'away' ? 'You are somewhere else.' : what === 'centcom' ? 'You are at Central Command.' : 'You are home.');
  }

  strike(c) {
    const d = this.sim.director;
    if (!d.windows) d.windows = d.findExteriorWindows();
    if (!d.pending) d.scheduleStrike();
    if (d.pending) d.doStrike();
    this.say(c, 'A meteor hits the hull.');
  }

  carp(c, msg) {
    const sim = this.sim, [x, z] = this.target(c, msg);
    const n = int(msg.n, 1, 8, 3);
    for (let k = 0; k < n; k++) sim.ai.spawnCarp(this.grid(c), x + (sim.rand() - 0.5) * 2, z + (sim.rand() - 0.5) * 2);
    this.say(c, `${n} space carp.`);
  }

  shuttle(c, msg) {
    const d = this.sim.director;
    switch (msg.what) {
      case 'call': this.say(c, d.callShuttle('auto')); break;
      case 'dock': if (d.evacState === 'idle' || d.evacState === 'called') d.dockShuttle(); break;
      case 'depart': if (d.evacState === 'docked') d.depart(); break;
      case 'jump': d.skipLeg(); break;
      default: break;
    }
  }

  doors(c, msg) {
    const sim = this.sim;
    const open = msg.what === 'open';
    if (!['open', 'close'].includes(msg.what)) return;
    for (const d of this.grid(c).doors) { d.bolted = false; d.welded = false; if (open) sim.openDoor(d, null, true); else sim.closeDoor(d); }
    this.say(c, `Every door ${open ? 'opens' : 'closes'}.`);
  }

  /** Weld the hull shut and bring the power back. */
  repair(c) {
    const sim = this.sim, g = this.grid(c), w = g.world;
    let n = 0;
    for (const i of [...w.breached]) { sim.patchBreach(g, i % w.W, Math.floor(i / w.W)); n++; }
    const ps = g.powersim;
    ps.engine.running = true;
    for (const a of ps.machines.apc) { if (a.cell) a.cell.charge = a.cell.max; a.operating = true; a.failureTimer = 0; a.broken = false; a.shorted = false; }
    for (const s of ps.machines.smes) s.charge = s.capacity;
    for (let a = 0; a < w.areas.length; a++) ps.setSwitch(a, true);
    this.say(c, `Hull sealed (${n} breaches), power restored.`);
  }

  round(c, msg) {
    const r = this.sim.round;
    if (msg.what === 'start' && r.state === 'lobby') { c.ready = true; r.start(); }
    else if (msg.what === 'end' && r.state === 'playing') this.sim.director.finish('shuttle');
  }

  /** Move the station's clock on (the meteors and the power failure are on timers). */
  skip(c, msg) {
    const r = this.sim.round;
    if (r.state !== 'playing') return;
    r.time += int(msg.sec, 1, 900, 60);
    this.say(c, `The round clock reads ${Math.floor(r.time / 60)}:${String(Math.floor(r.time % 60)).padStart(2, '0')}.`);
  }

  // ------------------------------------------------------------------ what the network test uses
  finish(c, msg) { this.sim.director.finish(msg.kind || 'shuttle'); }

  tile(c, msg) {
    const sp = this.sim.spawnPoints().find((s) => s.job === msg.job);
    if (sp && c.mob) this.teleport(c, c.mob, sp.grid, sp.x * TILE + TILE / 2, sp.y * TILE + TILE / 2);
  }
}
