import { TILE, KIND } from '../shared/config.js';
import { rng } from '../shared/util.js';
import { between } from '../shared/frames.js';

const STRIKE_TIMES = [75, 215, 380, 560];
const AUTO_CALL_AT = 600;
const DOCK_SECONDS = 95;
const FLIGHT_LEAD = 20;                // seconds before it docks that the emergency shuttle appears, far out, and starts its approach
const APPROACH = 150;                  // metres it flies in from (and out to)
const FLIGHT_SECONDS = 16;             // about how long that flight takes (for the announcement's estimate)
const TRANSIT_SECONDS = 60;            // in bluespace, between the station's map and Central Command's
const CENTCOM_SECONDS = 120;           // docked at Central Command, doors open, before the round ends

// real SS13 alert level texts
const LEVEL_TEXT = {
  blue: ['Attention! Security level elevated to blue:', 'The station has received reliable information about possible hostile activity on the station. Security staff may have weapons visible, random searches are permitted.'],
  red: ['Attention! Security level elevated to red:', 'There is an immediate serious threat to the station. Security may have weapons unholstered at all times. Random searches are allowed and advised.'],
};

/** Ghosts that are in the map `g` is in (watching it from the void) and not aboard it: they follow it when it jumps. */
function hyperspaceFollowers(sim, g) {
  return [...sim.clients.values()].filter((c) => c.state === 'ghost' && c.ghost.map === g.map);
}

/**
 * The incident director. Runs the shift: meteor strikes blow out windows, the grid trips, carp pour in through
 * the holes, the crew can call the shuttle, and it docks, waits and leaves. Announcements use SS13's own wording.
 */
export class Director {
  constructor(sim) {
    this.sim = sim;
    this.rand = rng(99);
    this.reset();
  }

  reset() {
    this.strikes = 0;
    this.pending = null;
    this.carpTimer = 0;
    this.evacState = 'idle';          // idle | called | docked | departed (on its way: `leg`) | centcom (docked there: the round ends when `evacTimer` runs out)
    this.evacTimer = 0;
    this.leg = null;                  // while departed: out (flying away from the station) | transit (in bluespace, `legTimer` left) | in (flying in to Central Command)
    this.legTimer = 0;
    this.level = 'green';
    this.news = ['Station News: A meteor shower is forecast for this sector. Crew are advised to stay near airtight doors.'];
    this.stats = { patched: 0, carpKilled: 0, delaminated: 0 };
    this.windows = null;
    this.evacGrid = null;             // the emergency shuttle, from the moment it appears (flying in) until it is gone: a grid of its own
    this.approach = null;             // the way out from the station along which it comes and goes: a unit vector in the map
    this.seams = [];                  // where it can be boarded: [{ door, tile: [c, r] on the station, at: [x, z] the door in the station's frame }]
    this.alerted = false;
  }

  get t() { return this.sim.round.time; }

  start() {
    this.reset();
    this.windows = this.findExteriorWindows();
  }

  /** The incident director is about the station: its windows, its hull, its air. (Other grids get their own trouble later.) */
  get grid() { return this.sim.station; }

  findExteriorWindows() {
    const w = this.grid.world;
    const out = [];
    for (let i = 0; i < w.n; i++) {
      if (!w.glass[i] || w.kind[i] !== KIND.WALL) continue;
      const c = i % w.W, r = (i - c) / w.W;
      let space = false, floor = false;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = w.kindAt(c + dc, r + dr);
        if (w.isOpenSpace(c + dc, r + dr)) space = true;
        if (k === KIND.FLOOR && w.roof[w.idx(c + dc, r + dr)]) floor = true;
      }
      if (space && floor) out.push(i);
    }
    return out;
  }

  setLevel(l) {
    if (this.level === l) return;
    this.level = l;
    this.sim.emit({ e: 'alert', level: l });
    if (LEVEL_TEXT[l]) this.sim.chat.announce(LEVEL_TEXT[l][0], LEVEL_TEXT[l][1]);
  }

  autoRadio(channel, text, who = 'Automated Announcement System', verb = 'announces') {
    const sim = this.sim;
    for (const c of sim.clients.values()) {
      const m = c.mob;
      if (c.state !== 'ghost' && (!m || m.dead || !sim.chat.channelsOf(m).includes(channel))) continue;
      c.outbox.push({ e: 'msg', k: 'radio', ch: channel, name: who, text, verb, chname: channel === 'common' ? 'Common' : channel[0].toUpperCase() + channel.slice(1), color: '#2681a5' });
    }
  }

  update(dt) {
    const sim = this.sim;
    if (sim.round.state !== 'playing') return;
    const t = this.t;
    if (!this.windows) this.windows = this.findExteriorWindows();
    if (this.evacState === 'departed' || this.evacState === 'centcom') { this.updateEvac(dt); return; }          // the station's troubles are behind it

    if (this.strikes < STRIKE_TIMES.length && !this.pending && t > STRIKE_TIMES[this.strikes] - 18) this.scheduleStrike();
    if (this.pending && t >= this.pending.at) this.doStrike();

    const g = this.grid, holes = g.world.ventTiles();
    if (holes.length > 0) {
      this.carpTimer -= dt;
      const alive = [...sim.mobs.values()].filter((m) => m.kind === 'carp' && !m.dead).length;
      if (this.carpTimer <= 0 && alive < 5) {
        this.carpTimer = 38 + this.rand() * 20;
        const i = holes[Math.floor(this.rand() * holes.length)];
        const w = g.world;
        const c = i % w.W, r = Math.floor(i / w.W);
        let sx = c * TILE + 1, sz = r * TILE + 1;
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (g.atmos.isCell[w.idx(c + dc, r + dr)]) { sx += dc * TILE; sz += dr * TILE; break; }
        }
        const n = 1 + (this.rand() < 0.4 ? 1 : 0);
        for (let k = 0; k < n; k++) sim.ai.spawnCarp(g, sx + (this.rand() - 0.5), sz + (this.rand() - 0.5));
        if (!this.carpWarned) { this.carpWarned = true; this.autoRadio('engineering', 'Unidentified lifesigns detected near the hull breach.'); this.npcReact('carp'); }
      }
    }

    if (this.evacState === 'idle' && t > AUTO_CALL_AT) this.callShuttle('auto');
    this.updateEvac(dt);
  }

  // ------------------------------------------------------------------ meteors
  scheduleStrike() {
    const sim = this.sim, g = this.grid, w = g.world;
    if (!this.windows.length) { this.strikes++; return; }
    // pick a window; the first one lands somewhere a player can hear it
    const refs = [...sim.clients.values()].filter((c) => c.mob && c.mob.grid === g).map((c) => c.mob);
    const first = this.strikes === 0;
    let best = null, bs = 1e9;
    for (let k = 0; k < 40; k++) {
      const i = this.windows[Math.floor(this.rand() * this.windows.length)];
      if (w.breached.has(i)) continue;
      const c = i % w.W, r = Math.floor(i / w.W);
      let score = this.rand() * 100;
      if (first && refs.length) {
        const m = refs[0];
        score = Math.abs(Math.hypot(c * TILE - m.x, r * TILE - m.z) / TILE - 24);
      }
      if (score < bs) { bs = score; best = i; }
    }
    if (best === null) { this.strikes++; return; }
    const c = best % w.W, r = Math.floor(best / w.W);
    let room = w.areaAt(c, r).n;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (g.atmos.isCell[w.idx(c + dc, r + dr)]) { room = w.areaAt(c + dc, r + dr).n; break; }
    this.pending = { at: this.t + 18, i: best, room };
    sim.chat.announce('Meteor Alert', 'Meteors have been detected on collision course with the station.');
    if (this.level === 'green') this.setLevel('blue');
    this.news.push('Meteors detected on a collision course with the station.');
  }

  doStrike() {
    const sim = this.sim, g = this.grid, w = g.world;
    const s = this.pending;
    this.pending = null;
    this.strikes++;
    const c = s.i % w.W, r = Math.floor(s.i / w.W);
    if (!w.breached.has(s.i)) sim.breachTile(g, c, r, 'meteor');
    this.setLevel('red');
    this.autoRadio('engineering', `Hull breach detected in ${s.room}.`);
    this.news.push(`Hull breach at ${s.room}. Reports of something with teeth nearby.`);
    const at = { grid: g, x: c * TILE + 1, z: r * TILE + 1 };
    for (const m of sim.mobs.values()) {
      if (m.dead) continue;
      const d = sim.dist(m, at);
      if (d < 6) sim.hurt(m, 14 * (1 - d / 6) + 4, 'brute', 'meteor shrapnel');
    }
    g.powersim.blast(c, r, 3);                                                // the cables it hits are cut
    sim.lights.blast(g, c, r, 4);                                             // and the lamps near it smashed
    this.carpTimer = 22;
    this.npcReact('breach', s.room);
  }

  // ------------------------------------------------------------------ crew chatter (NPCs react like players would)
  npcReact(kind, arg) {
    const sim = this.sim;
    const crew = [...sim.mobs.values()].filter((m) => m.kind === 'human' && !m.client && !m.dead && sim.chat.channelsOf(m).length);
    const pick = (re) => { const l = crew.filter((m) => re.test(m.job || '')); return l[Math.floor(this.rand() * l.length)]; };
    let who, text, ch = 'common';
    if (kind === 'breach') { who = pick(/engineer|atmos/) || crew[0]; text = `hull breach in ${arg}!! get a welder and some metal over there`; ch = 'engineering'; }
    else if (kind === 'power') { who = pick(/engineer/) || crew[0]; text = 'engine\'s down. someone get to the power monitor, I\'m on my way'; ch = 'engineering'; }
    else if (kind === 'carp') { who = pick(/security/) || crew[0]; text = 'there\'s carp coming in through the breach. close the doors!'; ch = 'common'; }
    if (who && text) setTimeout(() => sim.chat.npcRadio(who, text, ch), 1500 + this.rand() * 2500);
  }

  // ------------------------------------------------------------------ callbacks
  onMobDeath(m) {
    if (m.kind === 'carp') this.stats.carpKilled++;
  }

  onPatched(venting = true) {
    this.stats.patched++;
    if (!venting) return;
    this.autoRadio('engineering', 'Hull breach sealed.');
    this.news.push('Atmospherics: a breach was patched.');
  }

  // ------------------------------------------------------------------ shuttle
  canCallShuttle() {
    const sim = this.sim;
    if (this.evacState !== 'idle') return { ok: false, why: 'An emergency shuttle has already been called.' };
    if (this.grid.world.ventTiles().length > 0 || this.grid.powersim.status() !== 'normal' || this.t > 240) return { ok: true };
    return { ok: false, why: 'Central Command will not authorize an evacuation at this time.' };
  }

  callShuttle(who, caller) {
    const sim = this.sim;
    if (who !== 'auto') { const c = this.canCallShuttle(); if (!c.ok) return c.why; }
    this.evacState = 'called';
    this.evacTimer = who === 'auto' ? 150 : 120;
    sim.chat.announce('Priority Announcement', `The emergency shuttle has been called. ${this.level === 'red' ? 'Red Alert state confirmed: Dispatching priority shuttle. ' : ''}It will arrive in ${this.fmtTime(this.evacTimer)}.`);
    this.setLevel('red');
    this.news.push('The emergency shuttle is on its way.');
    return 'The shuttle has been called.';
  }

  fmtTime(s) { const m = Math.floor(s / 60), r = Math.round(s % 60); return `${m ? m + ' minute' + (m > 1 ? 's' : '') : ''}${m && r ? ' and ' : ''}${r ? r + ' seconds' : ''}`; }

  updateEvac(dt) {
    if (this.evacState === 'called') {
      this.evacTimer -= dt;
      if (!this.evacGrid && this.evacTimer <= FLIGHT_LEAD) this.startFlight();
      if (!this.evacGrid && this.evacTimer <= 0) this.dockShuttle();
    } else if (this.evacState === 'docked') {
      this.evacTimer -= dt;
      this.boarding();
      if (this.evacTimer <= 0) this.depart();
    } else if (this.evacState === 'departed') {
      this.sealDoors();
      if (this.leg === 'transit') { this.legTimer -= dt; if (this.legTimer <= 0) this.jumpToCentcom(); }
    } else if (this.evacState === 'centcom') {
      this.evacTimer -= dt;
      if (this.evacTimer <= 0) this.finish('shuttle');
    }
  }

  /**
   * The emergency shuttle appears, far out along the way it will dock from, and flies in: a grid of its own, a rigid body, pushed by its engines and
   * stopped on its mark. It is held there (docked) when it arrives, which is when the crew can board.
   */
  startFlight() {
    const sim = this.sim, dock = sim.docks.emergency, to = { p: dock.p, q: dock.q };
    const g = sim.addGrid(dock.bp, { kind: dock.kind, name: dock.name, tf: to, quiet: true, docked: false });
    this.evacGrid = g;
    this.seams = this.findSeams();
    this.approach = this.awayFromStation(g);
    sim.physics.place(g, { p: [dock.p[0] + this.approach[0] * APPROACH, dock.p[1], dock.p[2] + this.approach[2] * APPROACH], q: dock.q });
    sim.relink(g.map);
    g.emit({ e: 'grid+', ...sim.gridState(g) });
    sim.shuttles.fly(g, to, { dock: true, done: () => this.arrived() });
  }

  /** The way out from the station at a shuttle's doors: from the station tile beside each to the door, on average, as a unit vector in the map. */
  awayFromStation(eg) {
    const st = this.grid;
    let ax = 0, az = 0;
    for (const s of this.seams) {
      const d = eg.worldPoint(s.door.x, 0, s.door.z), t = st.worldPoint(s.tile[0] * TILE + TILE / 2, 0, s.tile[1] * TILE + TILE / 2);
      ax += d[0] - t[0]; az += d[2] - t[2];
    }
    const l = Math.hypot(ax, az) || 1;
    return [ax / l, 0, az / l];
  }

  /** At once: it is docked now (a debug command, and what the flight ends in). */
  dockShuttle() {
    const sim = this.sim, dock = sim.docks.emergency, to = { p: dock.p, q: dock.q };
    if (this.evacGrid) { sim.shuttles.cancel(this.evacGrid); sim.dock(this.evacGrid, to); }
    else {
      this.evacGrid = sim.addGrid(dock.bp, { kind: dock.kind, name: dock.name, tf: to });
      this.seams = this.findSeams();
      this.approach = this.awayFromStation(this.evacGrid);
    }
    this.arrived();
  }

  arrived() {
    const sim = this.sim;
    this.evacState = 'docked';
    this.evacTimer = DOCK_SECONDS;
    sim.chat.announce('Priority Announcement', `The Emergency Shuttle has docked with the station. You have ${this.fmtTime(DOCK_SECONDS)} to board the Emergency Shuttle.`);
    sim.emit({ e: 'snd', n: 'explosion_far', v: 0.6 });
    sim.emit({ e: 'shake', a: 0.4 });
  }

  /** Each of the shuttle's doors that opens onto a floor tile of `host` (the station, or Central Command): where people get on, or off. */
  findSeams(host = this.grid) {
    const g = host, eg = this.evacGrid, w = g.world, out = [];
    for (const door of eg.doors) {
      const [x, z] = between(eg, g, door.x, door.z);
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const c = Math.floor(x / TILE) + dc, r = Math.floor(z / TILE) + dr;
        if (w.inb(c, r) && w.kind[w.idx(c, r)] === KIND.FLOOR) { out.push({ door, tile: [c, r], at: [x, z] }); break; }
      }
    }
    return out;
  }

  inShuttle(m) { return !!this.evacGrid && m.grid === this.evacGrid; }

  /** NPCs run for the shuttle: to the station tile at its nearest door, then in through it. Whoever is aboard has escaped. */
  boarding() {
    const sim = this.sim;
    for (const m of sim.mobs.values()) {
      if (m.dead || m.kind !== 'human' || m.evacuated || m.client) continue;
      if (this.inShuttle(m)) { this.settleAboard(m); continue; }
      if (m.grid !== this.grid || !this.seams.length) continue;
      if (!m.evacOrdered) {
        m.evacOrdered = true;
        const seam = this.seams.reduce((a, b) => (Math.hypot(b.at[0] - m.x, b.at[1] - m.z) < Math.hypot(a.at[0] - m.x, a.at[1] - m.z) ? b : a));
        const path = m.grid.nav.path(m.tile[0], m.tile[1], seam.tile[0], seam.tile[1], m, 6000);
        if (path) { m.path = path; m.pathIdx = 0; m.state = 'walk'; m.seam = seam; }
      }
      if (m.seam && !m.path && !m.boardTo && Math.hypot(m.x - m.seam.at[0], m.z - m.seam.at[1]) < 3.4) m.boardTo = m.seam;       // at the door: through it
    }
  }

  /** An NPC has got on the shuttle: it stays there (it wanders about it, and goes where it goes), no longer on its way to the door. */
  settleAboard(m) {
    if (m.boarded) return;
    m.boarded = true; m.boardTo = null; m.seam = null; m.path = null; m.state = 'idle';
    const eg = this.evacGrid, w = eg.world, free = [];
    for (let i = 0; i < w.n; i++) if (w.kind[i] === KIND.FLOOR && !w.solid[i] && !w.doorAt.has(i)) free.push(i);
    const i = free[Math.floor(this.rand() * free.length)] ?? 0;
    m.home = [i % w.W, Math.floor(i / w.W)];                          // (it wanders round the tile it went to, on the shuttle's own map of walkable tiles)
  }

  /**
   * The shuttle leaves the station: its doors seal, it flies out along the way it came, jumps to bluespace (a map of its own: stars and a shuttle), spends a minute there,
   * and jumps out again at Central Command, where it flies in and docks. Everyone and everything aboard goes with it. The round ends when it has been there a while.
   */
  depart() {
    const sim = this.sim;
    this.evacState = 'departed';
    this.leg = 'out';
    sim.loadMap('centcom');                                           // (made now, while the doors are sealing, not in the tick of the jump)
    for (const c of sim.clients.values()) if (c.mob && !c.mob.dead && this.inShuttle(c.mob)) sim.tellClient(c, 'notice', 'The shuttle doors seal.');
    this.sealDoors();
    const eta = Math.round((FLIGHT_SECONDS * 2 + TRANSIT_SECONDS) / 10) * 10;
    sim.chat.announce('Priority Announcement', `The Emergency Shuttle has left the station. Estimate ${this.fmtTime(eta)} until the shuttle docks at Central Command.`);
    const dock = sim.docks.emergency, a = this.approach || [1, 0, 0];
    sim.shuttles.fly(this.evacGrid, { p: [dock.p[0] + a[0] * APPROACH, dock.p[1], dock.p[2] + a[2] * APPROACH], q: dock.q }, { done: (g) => this.jumpToHyperspace(g) });
  }

  /** The shuttle's doors are shut and bolted while it flies, so nobody steps out into the void; they open again at Central Command. */
  sealDoors() {
    const sim = this.sim;
    for (const d of this.evacGrid.doors) {
      d.bolted = true;
      if (d.state !== 'closed' && d.state !== 'closing' && !sim.occupied(d)) sim.closeDoor(d);
    }
  }

  /** A jump through bluespace, for whoever is aboard: a flash, a crack and a shake. */
  bluespace(g) {
    const sim = this.sim;
    for (const c of sim.clients.values()) if (c.at.grid === g) { c.outbox.push({ e: 'jump' }); sim.soundTo(c, 'explosion_far', 0.9); }
  }

  jumpToHyperspace(g) {
    const sim = this.sim;
    this.bluespace(g);
    sim.moveGrid(g, this.hyperspace(), { p: [0, 0, 0], q: [0, 0, 0, 1] });
    this.leg = 'transit';
    this.legTimer = TRANSIT_SECONDS;
  }

  jumpToCentcom() {
    const sim = this.sim, g = this.evacGrid, cc = sim.loadMap('centcom'), dock = sim.mapDocks.get('centcom').emergency, to = { p: dock.p, q: dock.q };
    const d = sim.shuttles.clearDirection(g, APPROACH, { map: cc, tf: to }) || [1, 0, 0];             // it comes in from where the way is clear
    const from = hyperspaceFollowers(sim, g);
    this.bluespace(g);
    sim.moveGrid(g, cc, { p: [dock.p[0] + d[0] * APPROACH, dock.p[1], dock.p[2] + d[2] * APPROACH], q: dock.q });
    for (const c of from) { const p = g.worldPoint(g.world.W * TILE / 2, 0, g.world.H * TILE / 2); c.ghost.map = cc; c.ghost.x = p[0]; c.ghost.y = p[1]; c.ghost.z = p[2]; }       // (anyone watching from there comes too)
    this.leg = 'in';
    sim.shuttles.fly(g, to, { dock: true, done: () => this.arrivedAtCentcom() });
  }

  /** The shuttle is docked at Central Command: the doors open onto it, and the clock to the end of the round starts. */
  arrivedAtCentcom() {
    const sim = this.sim, g = this.evacGrid;
    this.evacState = 'centcom';
    this.leg = null;
    this.evacTimer = CENTCOM_SECONDS;
    for (const d of g.doors) d.bolted = false;
    const host = sim.maps.get('centcom').solids.find((x) => x.kind === 'centcom');
    this.seams = this.findSeams(host);
    for (const s of this.seams) {
      sim.openDoor(s.door, null, true);
      const shutters = host.world.doorAt.get(host.world.idx(s.tile[0], s.tile[1]));                       // (the dock's shutters, on the complex's side, are shut until it docks)
      if (shutters) sim.openDoor(shutters, null, true);
    }
    sim.chat.announce('Priority Announcement', `The Emergency Shuttle has docked with Central Command. The round will end in ${this.fmtTime(CENTCOM_SECONDS)}.`);
    sim.emit({ e: 'snd', n: 'explosion_far', v: 0.6 }, { near: { at: { grid: g, x: g.world.W * TILE / 2, z: g.world.H * TILE / 2 }, r: 200 } });
    sim.emit({ e: 'shake', a: 0.4 }, { near: { at: { grid: g, x: g.world.W * TILE / 2, z: g.world.H * TILE / 2 }, r: 200 } });
  }

  /** On to the next leg now (the debug menu, and the tests): out -> the jump to bluespace -> the jump to Central Command -> docked there. */
  skipLeg() {
    const g = this.evacGrid;
    if (this.evacState !== 'departed' || !g) return;
    if (this.leg === 'out') { this.sim.shuttles.cancel(g); this.jumpToHyperspace(g); }
    else if (this.leg === 'transit') this.jumpToCentcom();
    else if (this.leg === 'in') { const dock = this.sim.mapDocks.get('centcom').emergency; this.sim.shuttles.cancel(g); this.sim.dock(g, { p: dock.p, q: dock.q }); this.arrivedAtCentcom(); }
  }

  /** Has this person got home: alive, and aboard the shuttle or at Central Command? (Or sent off in a pod.) */
  escaped(m) {
    const cc = this.sim.maps.get('centcom');
    return !!m.evacuated || (!m.dead && !!cc && this.sim.mapOf(m) === cc);
  }

  /** The map the emergency shuttle crosses on its way to Central Command: nothing in it but the shuttle. */
  hyperspace() {
    return this.sim.maps.get('hyperspace') || this.sim.addMap('hyperspace', 'Hyperspace');
  }

  launchPod(c) {
    const sim = this.sim, m = c.mob;
    if (!m || m.dead) return 'There is nobody in the pod.';
    if (this.evacState === 'idle') return 'The escape pods are locked until an evacuation is called.';
    m.evacuated = true; c.escaped = true;
    c.mob = null; c.state = 'ghost';
    const p = sim.worldPos(m);
    c.ghost.x = p[0]; c.ghost.y = p[1]; c.ghost.z = p[2]; c.ghost.map = sim.mapOf(m);
    sim.emit({ e: 'snd', n: 'explosion_far', v: 0.8 }, { to: c });
    sim.tellClient(c, 'notice', 'The escape pod launches. You are now observing.');
    c.outbox.push({ e: 'ghost', cause: null, escaped: true });
    return 'launched';
  }

  finish(kind) {
    if (this.sim.round.state !== 'playing') return;
    this.sim.round.end(kind);
  }

  // ------------------------------------------------------------------ info for terminals / news
  newsItems() { return this.news.length ? this.news.slice(-6) : ['All quiet on the station.']; }
}
