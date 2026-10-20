import { TILE, KIND, SIM_DT, SNAP_EVERY, INTEREST, SLOTS } from '../shared/config.js';
import { decodeLevel } from '../shared/leveldata.js';
import { World } from '../shared/world.js';
import { Atmos } from '../shared/atmos.js';
import { Power } from '../shared/power.js';
import { Nav } from '../shared/nav.js';
import { DoorCore } from '../shared/door.js';
import { ItemDB, makeItemData } from '../shared/items.js';
import { Jobs } from '../shared/jobs.js';
import { buildPropData } from '../shared/propdata.js';
import { stepMovement, floatState } from '../shared/movement.js';
import { clamp, rng } from '../shared/util.js';
import { Mob } from './mob.js';
import { FireDoors } from './firedoors.js';
import { ChatSys } from './chatsys.js';
import { Round } from './round.js';
import { Director } from './director.js';
import { Terminals } from './terminals.js';
import { Actions } from './actions.js';
import { Closets } from './closets.js';
import { People } from './people.js';
import { Windows } from './windows.js';
import { Debug } from './debug.js';
import { Looks, WORN_SLOTS } from '../shared/looks.js';
import { AI } from './ai.js';
import { attach, detach, place, recalc, internalsSource, spaceSafe, moveSlow, serializeInv, rootMob } from './inventory.js';

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
    this.ghost = { x: 0, z: 0, vx: 0, vz: 0, yaw: 0, pitch: 0 };
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
  get x() { return this.mob ? this.mob.x : this.ghost.x; }
  get z() { return this.mob ? this.mob.z : this.ghost.z; }
}

/**
 * The authoritative game simulation. Pure logic: runs unchanged inside the Node server and inside the
 * browser (single player). Talks to clients only through messages (see handle() and the events it emits).
 */
export class Sim {
  constructor(data, opts = {}) {
    this.opts = { bots: 14, autostart: 0, god: false, ...opts };
    this.level = data.level;
    this.rects = data.rects;
    this.time = 0;
    this.tick = 0;
    this.rand = rng(Date.now() & 0xffff);
    const decoded = decodeLevel(data.level);
    this.world = new World(decoded);
    this.db = new ItemDB(data.level.itemdefs, data.contents || {});
    this.looks = new Looks(data.chars);
    this.jobs = new Jobs(data.jobsJson);
    this.props = buildPropData(this.world, this.rects, data.level.props, data.level);
    this.doors = this.props.doors.map((p) => new DoorCore(this.world, p, p.fr.length - 2));
    const apcAreas = this.props.interact.filter((it) => it.kind === 'wm' && it.sub === 'apc').map((it) => this.world.areaIdx[it.r * this.world.W + it.c]);
    this.power = new Power(this.world, apcAreas);
    this.power.onState = (s, prev) => this.onPowerState(s, prev);
    this.atmos = new Atmos(this.world, this.power);
    this.nav = new Nav(this.world);
    this.firedoors = new FireDoors(this);
    this.chat = new ChatSys(this);
    this.terminals = new Terminals(this);
    this.actions = new Actions(this);
    this.ai = new AI(this);
    this.round = new Round(this);
    this.director = new Director(this);

    this.items = new Map();             // id -> item instance (everything that exists)
    this.floor = new Map();             // id -> {item, x, y, z, c, r}
    this.itemSeq = 1;
    this.mobs = new Map();
    this.clients = new Map();
    this.tileLog = [];                  // breaches/patches/shuttle so late joiners can catch up
    this.deadPanes = [];
    this.evacApplied = false;
    this.flickerUntil = 0;

    for (const it of this.props.items) {
      const item = this.newItem(it.path || '/obj/item', { name: it.name, sprite: it.sprite });
      place(this, item, it.x, it.z, it.y);
    }
    this.people = new People(this);
    this.windows = new Windows(this);
    this.debug = new Debug(this);
    this.closets = new Closets(this, data.closets);       // after the floor items: closed closets swallow what lies on them
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
  /** scope: undefined = everyone; {to: client}; {near: [x, z, r]}; {ghosts: true} */
  emit(ev, scope) {
    for (const c of this.clients.values()) {
      if (scope) {
        if (scope.to && scope.to !== c) continue;
        if (scope.near) { const [x, z, r] = scope.near; if ((c.x - x) ** 2 + (c.z - z) ** 2 > r * r) continue; }
        if (scope.ghosts && c.state !== 'ghost') continue;
      }
      c.outbox.push(ev);
    }
  }

  tellClient(client, k, text, extra) { client.outbox.push({ e: 'msg', k, text, ...extra }); }
  tell(mob, k, text) { if (mob.client) this.tellClient(mob.client, k, text); }
  sound(name, x, z, v = 1) { this.emit({ e: 'snd', n: name, x, z, v }, { near: [x, z, 40] }); }
  soundTo(client, name, v = 1) { client.outbox.push({ e: 'snd', n: name, v }); }
  shake(x, z, amt, r = 36) { this.emit({ e: 'shake', a: amt }, { near: [x, z, r] }); }

  /**
   * The station's gravity goes on or off (the generator, or the debug menu). Like gravitygenerator.dm's shake_everyone():
   * everybody's camera shakes and they hear the alert. Nobody is told in words; you find out when your feet leave the floor.
   */
  setGravity(on) {
    on = !!on;
    if (this.world.gravityOn === on) return false;
    this.world.gravityOn = on;
    this.emit({ e: 'grav', on });
    this.emit({ e: 'shake', a: 0.5 });
    this.emit({ e: 'snd', n: 'terminal_alert', v: 1 });
    return true;
  }

  // ------------------------------------------------------------------ clients
  addClient(name, send) {
    const c = new SimClient(this, name, send);
    this.clients.set(c.id, c);
    const sp = this.level.spawns.find((s) => s.job === 'latejoin') || this.level.spawns.find((s) => s.job === 'assistant');
    c.ghost.x = sp.x * TILE + 1; c.ghost.z = sp.y * TILE + 1;
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

  /** Everything a joining client needs to build its view of the world. */
  worldState(c) {
    return {
      name: this.level.name,
      round: this.round.publicState(),
      power: { state: this.power.state, battery: this.power.battery },
      areaOn: [...this.power.areaOn], areaLights: [...this.power.areaLights],
      doors: this.doors.map((d) => d.state), fdoors: this.firedoors.list.map((f) => (f.closed ? 1 : 0)),
      items: [...this.floor.values()].map((f) => [f.item.id, f.item.sprite, f.item.name, f.x, f.y, f.z]),
      tiles: this.tileLog, panes: this.deadPanes, evac: this.evacApplied, closets: this.closets.changed(), moved: this.people.moved(), debug: !!this.opts.debug, gravity: this.world.gravityOn,
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
    this.firedoors.update(dt);
    this.windows.update();
    this.atmos.update(dt);
    this.power.update(dt);
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
        const inp = c.inputs.shift();
        c.lastSeq = inp.seq;
        let d = clamp(inp.dt || 0.016, 0.001, 0.06);
        if (d > c.budget) d = c.budget;
        if (d <= 0) continue;
        c.budget -= d;
        m.yaw = inp.yaw; m.pitch = clamp(inp.pitch || 0, -1.5, 1.5);
        m.input = inp;
        if (m.inside) { m.vx = m.vz = 0; if (inp.f || inp.b || inp.l || inp.r) this.closets.relaymove(m); continue; }
        if (m.downed || (m.pulledBy && m.pulledBy.grab >= 1)) { this.limp(m, d); if (inp.f || inp.b || inp.l || inp.r) this.people.resistGrab(m); continue; }
        if (m.dead || m.stunned > 0 || m.body.crit) { this.limp(m, d); continue; }
        const run = inp.run && !(m.body.health < 30);
        const ctx = this.moveCtx(m);
        m.speedNow = stepMovement(m, { f: inp.f, b: inp.b, l: inp.l, r: inp.r, run, yaw: inp.yaw }, this.world, d, ctx);
        if (m.jetOn && (inp.f || inp.b || inp.l || inp.r) && floatState(this.world, m, { ...ctx, jet: false }).floating) this.burnJetpack(m, d);
        moved = true;
      }
      void moved;
    }
  }

  /** How much slower (or, in debug, faster) than normal this body moves: its suit, what it drags, the debug speed. */
  moveFactor(m) { return moveSlow(m) * this.people.dragSlow(m) * (m.dbgSpeed ?? 1); }

  /** What `stepMovement` needs to know about a body (the client predicts with the same things, see Game.predictCtx). */
  moveCtx(m) {
    return { slow: this.moveFactor(m) * (m.body.crit ? 0.35 : 1), wind: this.atmos.windAt(m.x, m.z), ignore: m.hauling?.it, noclip: m.noclip, jet: !!m.jetOn, mag: !!m.magOn };
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
    if (this.world.hasGravity(m.x, m.z)) { m.vx = m.vz = 0; return; }
    m.speedNow = stepMovement(m, { yaw: m.yaw }, this.world, d, { ...this.moveCtx(m), limp: true });
  }

  updateGhosts(dt) {
    for (const c of this.clients.values()) {
      if (c.state !== 'ghost' && c.state !== 'lobby') { continue; }
      const g = c.ghost;
      while (c.inputs.length) {
        const inp = c.inputs.shift();
        c.lastSeq = inp.seq;
        g.yaw = inp.yaw; g.pitch = inp.pitch || 0;
        stepMovement(g, inp, this.world, clamp(inp.dt || 0.016, 0.001, 0.06), { noclip: true });
      }
    }
  }

  // ------------------------------------------------------------------ doors
  updateDoors(dt) {
    const players = [...this.clients.values()].filter((c) => c.mob && !c.mob.dead).map((c) => c.mob);
    for (let k = 0; k < this.doors.length; k++) {
      const d = this.doors[k];
      if (d.state === 'closed') {
        for (const m of players) {
          const dx = m.x - d.x, dz = m.z - d.z;
          if (dx * dx + dz * dz < 1.8 * 1.8 && d.allows(m) && this.power.doorsWork(d)) { this.openDoor(k, m); break; }
        }
        continue;
      }
      const res = d.tick(dt);
      if (res) this.emit({ e: 'door', i: k, st: res });
      if (d.state === 'open' && res === 'open') d.holdUntil = this.time + 3.2;
      if (d.state === 'open' && this.time > d.holdUntil) {
        if (!this.power.doorsWork(d)) d.holdUntil = this.time + 1;
        else if (!this.occupied(d)) this.closeDoor(k); else d.holdUntil = this.time + 0.8;
      }
    }
  }

  occupied(d) {
    for (const m of this.mobs.values()) if (!m.dead && (m.x - d.x) ** 2 + (m.z - d.z) ** 2 < 1.5 * 1.5) return true;
    return false;
  }

  openDoor(k, by, force = false) {
    const d = this.doors[k];
    if (!force && (d.bolted || d.welded || !this.power.doorsWork(d))) return false;
    if (!d.open()) return false;
    this.emit({ e: 'door', i: k, st: 'opening' });
    this.sound('door_open', d.x, d.z, 0.9);
    return true;
  }

  closeDoor(k) {
    const d = this.doors[k];
    if (!d.close()) return false;
    this.emit({ e: 'door', i: k, st: 'closing' });
    this.sound('door_close', d.x, d.z, 0.9);
    return true;
  }

  // ------------------------------------------------------------------ bodies
  tickBodies(dt) {
    for (const m of this.mobs.values()) {
      if (m.dead) continue;
      m.cool = Math.max(0, m.cool - dt);
      m.stunned = Math.max(0, m.stunned - dt);
      const [c, r] = m.tile;
      const a = this.atmos;
      let internals = false;
      if (m.humanoid && m.internals) {
        const src = internalsSource(m);
        if (src) { internals = true; src.gas = Math.max(0, src.gas - dt); if (src.gas <= 0) { m.internals = false; this.tell(m, 'danger', 'Your air tank runs dry!'); } }
      }
      m.body.tick(dt, {
        pressure: a.pressureAt(c, r), o2: a.o2At(c, r), tox: a.toxAt(c, r),
        safeSuit: m.kind === 'carp' || (m.humanoid && spaceSafe(m)), internals: internals || m.kind === 'carp',
      });
    }
  }

  onMobDeath(m, cause) {
    m.dead = true;
    m.vx = m.vz = 0;
    this.sound('bodyfall', m.x, m.z, 0.8);
    if (m.kind === 'human') {
      this.chat.visible(m, `${m.name} seizes up and falls limp, their eyes dead and lifeless...`, 'danger', 8);
      this.chat.systemAll('deadsay', `${m.name} (${this.jobs.get(m.job)?.title || 'crew'}) has died at ${this.world.areaAt(...m.tile)?.n || 'an unknown location'}.`);
    }
    if (m.client) this.round.onPlayerDeath(m.client, cause);
    this.director.onMobDeath(m);
  }

  hurt(m, amount, type = 'brute', src) {
    if (m.dead) return;
    const dmg = amount * (1 - (m.humanoid ? (m.worn.suit?.def.armor ?? 0) : 0));
    m.body.damage(type, dmg, src);
    m.fear = 6;
    if (m.client) { this.emit({ e: 'hurt', a: dmg }, { to: m.client }); this.shake(m.x, m.z, Math.min(0.5, dmg / 25), 0.1); }
    if (m.humanoid && !m.dead) this.sound((m.name.charCodeAt(0) % 2) ? 'pain_m' : 'pain_f', m.x, m.z, 0.8);
  }

  // ------------------------------------------------------------------ hull & world changes
  tileEvent(i, extra = {}) {
    const w = this.world;
    return { e: 'tile', i, kind: w.kind[i], wall: w.wallVar[i], glass: w.glass[i], solid: w.solid[i], air: w.airBlock[i], floor: w.floorCell[i], roof: w.roof[i], area: w.areaIdx[i], brk: w.breached.has(i) ? 1 : 0, gr: w.grille[i], ws: w.ws[i], ...extra };
  }

  /** A tile's glass, grille or anchoring changed: tell the air and the clients. (A smashed window is `breachTile`: it is also loud.) */
  tileChanged(c, r) {
    const i = r * this.world.W + c;
    this.atmos.tileChanged(c, r);
    const ev = this.tileEvent(i);
    this.tileLog.push(ev); this.emit(ev);
  }

  /** A window shatters. Only one that touches space is a hull breach (loud, everything flickers). It leaves shards (and rods) on the floor and its grille standing. */
  breachTile(c, r, cause) {
    const w = this.world;
    const i = r * w.W + c;
    w.setBreach(c, r);
    this.tileChanged(c, r);
    const x = c * TILE + 1, z = r * TILE + 1;
    this.windows.spill(x, z, w.windowKey(i), true);
    this.sound('glass_break', x, z, 1);
    if (cause === 'meteor') { this.sound('meteor', x, z, 1); this.sound('explosion', x, z, 0.8); this.sound('wind', x, z, 0.9); }
    if (w.ventsToSpace(i)) {
      this.shake(x, z, 0.6, 40);
      this.flicker(0.9);
    } else this.shake(x, z, 0.25, 12);
  }

  patchBreach(c, r) {
    const w = this.world;
    const i = r * w.W + c;
    const venting = w.ventsToSpace(i);
    w.setPatched(c, r);
    this.atmos.tileChanged(c, r);
    const ev = this.tileEvent(i);
    this.tileLog.push(ev); this.emit(ev);
    this.sound('welder', c * TILE + 1, r * TILE + 1, 0.8);
    this.director.onPatched(venting);
  }

  /** Damage a window (tile) or a thin pane; shatters when hit points run out. `hit` is a world.hit record. */
  damageHull(hit, dmg) {
    const w = this.world;
    if (hit.kind === 'tile') {
      const i = hit.i;
      if (!w.glass[i]) return null;
      const hp = (w.hp.get(i) ?? 30) - dmg;
      const c = i % w.W, r = Math.floor(i / w.W);
      this.sound('glass_hit', c * TILE, r * TILE, 0.8);
      if (hp <= 0) { this.breachTile(c, r, 'shot'); return 'shatter'; }
      w.hp.set(i, hp);
      return hp < 15 ? 'crack2' : 'crack';
    }
    const pane = this.props.paneIdx.get(hit.i * 16 + hit.bit);
    if (!pane || pane.dead) return null;
    pane.hp -= dmg;
    this.sound('glass_hit', pane.c * TILE, pane.r * TILE, 0.8);
    if (pane.hp <= 0) { this.shatterPane(pane); return 'shatter'; }
    return 'crack';
  }

  shatterPane(p) {
    this.removePane(p);
    this.sound('glass_break', p.c * TILE, p.r * TILE, 1);
    this.windows.spill(p.c * TILE + 1, p.r * TILE + 1, p.tag, false);
  }

  /** A thin window is gone (smashed, or taken apart: then it leaves nothing but its glass sheet). */
  removePane(p) {
    p.dead = true;
    this.world.removeEdge(p.c, p.r, p.d);
    this.deadPanes.push([p.c, p.r, p.d]);
    this.emit({ e: 'pane', c: p.c, r: p.r, d: p.d });
  }

  flicker(sec) { this.emit({ e: 'flicker', s: sec }); }

  onPowerState(s, prev) {
    this.emit({ e: 'power', state: s, battery: this.power.battery });
    this.sound(s === 'normal' ? 'ping' : 'zzzt', 0, 0, 0);
    this.emit({ e: 'snd', n: s === 'normal' ? 'ping' : 'zzzt', v: 0.8 });
    this.flicker(1.5);
  }

  setAreaPower(a, on, lights) {
    if (on !== undefined) this.power.areaOn[a] = on ? 1 : 0;
    if (lights !== undefined) this.power.areaLights[a] = lights ? 1 : 0;
    this.emit({ e: 'area', a, on: this.power.areaOn[a], lights: this.power.areaLights[a] });
  }

  /** The emergency shuttle docks: stamp its tiles into the world (and tell clients to do the same). */
  applyEvac() {
    if (this.evacApplied) return;
    this.evacApplied = true;
    const w = this.world, ov = this.level.evac;
    const changed = new Set();
    for (const [i, kind, floor, wall, area, roof] of ov.tiles) {
      w.kind[i] = kind; w.floorCell[i] = floor; w.wallVar[i] = wall; w.areaIdx[i] = area; w.roof[i] = roof;
      w.glass[i] = 0; w.solid[i] = 0; w.airBlock[i] = 0;
      if (kind === KIND.WALL) {
        w.solid[i] = 1; w.airBlock[i] = 1;
        if (wall !== 0xffff && w.variants[wall].glass) w.glass[i] = 1;
        w.hp.set(i, 600);
      }
      changed.add(i);
    }
    const before = this.doors.length;
    buildPropData(w, this.rects, ov.props, this.level, this.props);
    for (const p of this.props.added.doors) this.doors.push(new DoorCore(w, p, p.fr.length - 2));
    for (const p of this.props.added.fdoors) void p;
    this.atmos.buildTopology(false, changed);
    for (const it of this.props.added.items) {
      const item = this.newItem(it.path || '/obj/item', { name: it.name, sprite: it.sprite });
      place(this, item, it.x, it.z, it.y);
    }
    this.emit({ e: 'evac' });
    void before;
    return changed;
  }

  // ------------------------------------------------------------------ spawning
  newMob(o) {
    const m = new Mob(this, o);
    this.mobs.set(m.id, m);
    return m;
  }

  /** Create a crew member (player-controlled if `client`, otherwise an NPC) and equip them from the job's outfit. */
  spawnCrew(job, client, o = {}) {
    const pts = this.level.spawns.filter((s) => s.job === job.id);
    const late = this.level.spawns.filter((s) => s.job === 'latejoin');
    let p = o.late && late.length ? late[Math.floor(this.rand() * late.length)] : pts.length ? pts[Math.floor(this.rand() * pts.length)] : late[0] || this.level.spawns[0];
    const name = client ? client.name : this.ai.randomName();
    const look = (client && client.look) || this.looks.random(this.rand);
    const m = this.newMob({ kind: 'human', name, job: job.id, look, x: p.x * TILE + TILE / 2, z: p.y * TILE + TILE / 2, speed: 1.7 + this.rand() * 0.5, hp: 100 });
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
      const px = c.x, pz = c.z;
      const list = [];
      const seen = new Set();
      for (const m of mobsArr) {
        if (m.evacuated || (m.inside && m !== c.mob)) continue;       // nobody sees someone shut in a locker
        const dx = m.x - px, dz = m.z - pz;
        if (dx * dx + dz * dz > INTEREST * INTEREST && m !== c.mob) continue;
        seen.add(m.id);
        if (!c.known.has(m.id)) { c.known.add(m.id); c.outbox.push({ e: 'mob+', id: m.id, n: m.name, job: m.job, set: m.set, kind: m.kind, ap: m.look ? this.appearanceOf(m) : undefined }); }
        const flags = (m.dead ? 1 : 0) | (m.body.crit ? 2 : 0) | (m.speedNow > 3.8 ? 8 : 0) | (m.stunned > 0 || m.downed ? 16 : 0);
        list.push([m.id, +m.x.toFixed(2), +m.z.toFixed(2), +m.yaw.toFixed(2), flags, +(m.speedNow || 0).toFixed(1)]);
      }
      for (const id of [...c.known]) if (!seen.has(id)) { c.known.delete(id); c.outbox.push({ e: 'mob-', id }); }
      const snap = { t: 'snap', tick: this.tick, ack: c.lastSeq, mobs: list };
      const m = c.mob;
      if (m) {
        const [tc, tr] = m.tile;
        snap.you = { x: +m.x.toFixed(3), z: +m.z.toFixed(3), vx: +m.vx.toFixed(2), vz: +m.vz.toFixed(2), id: m.id };
        snap.env = { p: +this.atmos.pressureAt(tc, tr).toFixed(1), o2: +this.atmos.o2At(tc, tr).toFixed(1), tox: +this.atmos.toxAt(tc, tr).toFixed(2), area: this.world.areaIdx[tr * this.world.W + tc] };
        const wind = this.atmos.windAt(m.x, m.z);
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
      case 'stuff': { const it = this.props.interact[msg.idx]; if (c.mob && it?.kind === 'closet') this.closets.stuff(c.mob, it, this.mobs.get(msg.id)); break; }
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
