import { TILE, KIND } from '../shared/config.js';
import { rng } from '../shared/util.js';

const STRIKE_TIMES = [75, 215, 380, 560];
const POWER_FAIL_AT = 150;
const AUTO_CALL_AT = 600;
const DOCK_SECONDS = 95;
const SHUTTLE_AREA = 'Emergency Shuttle';

// real SS13 alert level texts
const LEVEL_TEXT = {
  blue: ['Attention! Security level elevated to blue:', 'The station has received reliable information about possible hostile activity on the station. Security staff may have weapons visible, random searches are permitted.'],
  red: ['Attention! Security level elevated to red:', 'There is an immediate serious threat to the station. Security may have weapons unholstered at all times. Random searches are allowed and advised.'],
};

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
    this.powerFailed = false;
    this.evacState = 'idle';          // idle | called | docked | departed
    this.evacTimer = 0;
    this.level = 'green';
    this.news = ['Station News: A meteor shower is forecast for this sector. Crew are advised to stay near airtight doors.'];
    this.stats = { patched: 0, carpKilled: 0 };
    this.windows = null;
    this.dockTile = null;
    this.alerted = false;
  }

  get t() { return this.sim.round.time; }

  start() {
    this.reset();
    this.windows = this.findExteriorWindows();
  }

  findExteriorWindows() {
    const w = this.sim.world;
    const out = [];
    for (let i = 0; i < w.W * w.H; i++) {
      if (!w.glass[i] || w.kind[i] !== KIND.WALL) continue;
      const c = i % w.W, r = (i - c) / w.W;
      let space = false, floor = false;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = w.kindAt(c + dc, r + dr);
        if (k === KIND.SPACE) space = true;
        if (k === KIND.FLOOR && w.roof[(r + dr) * w.W + c + dc]) floor = true;
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

  autoRadio(channel, text, who = 'Automated Announcement System') {
    const sim = this.sim;
    for (const c of sim.clients.values()) {
      const m = c.mob;
      if (c.state !== 'ghost' && (!m || m.dead || !sim.chat.channelsOf(m).includes(channel))) continue;
      c.outbox.push({ e: 'msg', k: 'radio', ch: channel, name: who, text, verb: 'announces', chname: channel === 'common' ? 'Common' : channel[0].toUpperCase() + channel.slice(1), color: '#2681a5' });
    }
  }

  update(dt) {
    const sim = this.sim;
    if (sim.round.state !== 'playing') return;
    const t = this.t;
    if (!this.windows) this.windows = this.findExteriorWindows();

    if (!this.powerFailed && t > POWER_FAIL_AT) {
      this.powerFailed = true;
      sim.chat.announce('Critical Power Failure', 'Abnormal activity detected in the station\'s powernet. As a precautionary measure, the station\'s power will be shut off for an indeterminate duration.');
      sim.power.setState('battery');
      this.setLevel('red');
      this.news.push('Power: the engine tripped offline. Engineers are looking into it.');
      this.npcReact('power');
    }

    if (this.strikes < STRIKE_TIMES.length && !this.pending && t > STRIKE_TIMES[this.strikes] - 18) this.scheduleStrike();
    if (this.pending && t >= this.pending.at) this.doStrike();

    if (sim.world.breached.size > 0) {
      this.carpTimer -= dt;
      const alive = [...sim.mobs.values()].filter((m) => m.kind === 'carp' && !m.dead).length;
      if (this.carpTimer <= 0 && alive < 5) {
        this.carpTimer = 38 + this.rand() * 20;
        const tiles = [...sim.world.breached];
        const i = tiles[Math.floor(this.rand() * tiles.length)];
        const w = sim.world;
        const c = i % w.W, r = Math.floor(i / w.W);
        let sx = c * TILE + 1, sz = r * TILE + 1;
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (sim.atmos.isCell[(r + dr) * w.W + c + dc]) { sx += dc * TILE; sz += dr * TILE; break; }
        }
        const n = 1 + (this.rand() < 0.4 ? 1 : 0);
        for (let k = 0; k < n; k++) sim.ai.spawnCarp(sx + (this.rand() - 0.5), sz + (this.rand() - 0.5));
        if (!this.carpWarned) { this.carpWarned = true; this.autoRadio('engineering', 'Unidentified lifesigns detected near the hull breach.'); this.npcReact('carp'); }
      }
    }

    if (this.evacState === 'idle' && t > AUTO_CALL_AT) this.callShuttle('auto');
    this.updateEvac(dt);
  }

  // ------------------------------------------------------------------ meteors
  scheduleStrike() {
    const sim = this.sim, w = sim.world;
    if (!this.windows.length) { this.strikes++; return; }
    // pick a window; the first one lands somewhere a player can hear it
    const refs = [...sim.clients.values()].filter((c) => c.mob).map((c) => c.mob);
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
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (sim.atmos.isCell[(r + dr) * w.W + c + dc]) { room = w.areaAt(c + dc, r + dr).n; break; }
    this.pending = { at: this.t + 18, i: best, room };
    sim.chat.announce('Meteor Alert', 'Meteors have been detected on collision course with the station.');
    if (this.level === 'green') this.setLevel('blue');
    this.news.push('Meteors detected on a collision course with the station.');
  }

  doStrike() {
    const sim = this.sim, w = sim.world;
    const s = this.pending;
    this.pending = null;
    this.strikes++;
    const c = s.i % w.W, r = Math.floor(s.i / w.W);
    if (!w.breached.has(s.i)) sim.breachTile(c, r, 'meteor');
    this.setLevel('red');
    this.autoRadio('engineering', `Hull breach detected in ${s.room}.`);
    this.news.push(`Hull breach at ${s.room}. Reports of something with teeth nearby.`);
    const x = c * TILE + 1, z = r * TILE + 1;
    for (const m of sim.mobs.values()) {
      if (m.dead) continue;
      const d = Math.hypot(m.x - x, m.z - z);
      if (d < 6) sim.hurt(m, 14 * (1 - d / 6) + 4, 'brute', 'meteor shrapnel');
    }
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

  onPatched() {
    this.stats.patched++;
    this.autoRadio('engineering', 'Hull breach sealed.');
    this.news.push('Atmospherics: a breach was patched.');
  }

  onPowerRestored() {
    this.sim.chat.announce('Power Systems Nominal', 'Power has been restored to Space Station 13. We apologize for the inconvenience.');
    this.news.push('Power: the grid is back.');
  }

  // ------------------------------------------------------------------ shuttle
  canCallShuttle() {
    const sim = this.sim;
    if (this.evacState !== 'idle') return { ok: false, why: 'An emergency shuttle has already been called.' };
    if (sim.world.breached.size > 0 || sim.power.state !== 'normal' || this.t > 240) return { ok: true };
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
      if (this.evacTimer <= 0) this.dockShuttle();
    } else if (this.evacState === 'docked') {
      this.evacTimer -= dt;
      this.boarding();
      if (this.evacTimer <= 0) this.depart();
    }
  }

  dockShuttle() {
    const sim = this.sim;
    this.evacState = 'docked';
    this.evacTimer = DOCK_SECONDS;
    sim.applyEvac();
    // somewhere for the crew to run to
    let best = null, bd = 1e9;
    const w = sim.world;
    for (let i = 0; i < w.W * w.H; i++) {
      if (w.areas[w.areaIdx[i]].n !== SHUTTLE_AREA || w.solid[i] || w.kind[i] !== KIND.FLOOR) continue;
      const c = i % w.W, r = Math.floor(i / w.W);
      const d = Math.abs(c - 200) + Math.abs(r - 118);
      if (d < bd) { bd = d; best = [c, r]; }
    }
    this.dockTile = best;
    sim.chat.announce('Priority Announcement', `The Emergency Shuttle has docked with the station. You have ${this.fmtTime(DOCK_SECONDS)} to board the Emergency Shuttle.`);
    sim.sound('explosion_far', 0, 0, 0);
    sim.emit({ e: 'snd', n: 'explosion_far', v: 0.6 });
    sim.emit({ e: 'shake', a: 0.4 });
  }

  inShuttle(m) { return this.sim.world.areaAt(...m.tile)?.n === SHUTTLE_AREA; }

  boarding() {
    const sim = this.sim;
    const dock = this.dockTile;
    for (const m of sim.mobs.values()) {
      if (m.dead || m.kind !== 'human' || m.evacuated || m.client) continue;
      if (dock && !m.evacOrdered) {
        m.evacOrdered = true;
        const path = sim.nav.path(m.tile[0], m.tile[1], dock[0], dock[1], m, 6000);
        if (path) { m.path = path; m.pathIdx = 0; m.state = 'walk'; }
      }
      if (this.inShuttle(m)) m.evacuated = true;
    }
  }

  depart() {
    const sim = this.sim;
    this.evacState = 'departed';
    for (const c of sim.clients.values()) {
      const m = c.mob;
      if (m && !m.dead && this.inShuttle(m)) { m.evacuated = true; c.escaped = true; sim.tellClient(c, 'notice', 'The shuttle doors seal.'); }
    }
    sim.chat.announce('Priority Announcement', 'The Emergency Shuttle has left the station. Estimate 4 minutes until the shuttle docks at Central Command.');
    this.finish('shuttle');
  }

  launchPod(c) {
    const sim = this.sim, m = c.mob;
    if (!m || m.dead) return 'There is nobody in the pod.';
    if (this.evacState === 'idle') return 'The escape pods are locked until an evacuation is called.';
    m.evacuated = true; c.escaped = true;
    c.mob = null; c.state = 'ghost'; c.ghost.x = m.x; c.ghost.z = m.z;
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
