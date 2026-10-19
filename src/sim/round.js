import { greeting } from '../shared/jobs.js';

// who gets a slot first when the crew is filled out with NPCs
const BOT_ORDER = ['captain', 'chief_engineer', 'head_of_security', 'research_director', 'chief_medical_officer', 'head_of_personnel', 'quartermaster',
  'station_engineer', 'atmospheric_technician', 'medical_doctor', 'security_officer', 'scientist', 'cargo_technician', 'bartender', 'cook', 'janitor',
  'botanist', 'chemist', 'geneticist', 'roboticist', 'paramedic', 'detective', 'warden', 'lawyer', 'chaplain', 'clown', 'mime', 'shaft_miner',
  'virologist', 'curator', 'psychologist', 'assistant'];

/**
 * The shape of a round, as in SS13: lobby (pick a job, ready up) -> roundstart (jobs assigned, crew spawned, empty
 * slots filled by NPCs) -> in progress (late join from arrivals, ghosts for the dead) -> shuttle -> round-end report.
 */
export class Round {
  constructor(sim) {
    this.sim = sim;
    this.state = 'lobby';
    this.countdown = null;
    this.time = 0;
    this.taken = {};
    this.endedAt = 0;
    this.endTimer = 0;
  }

  publicState() {
    const sim = this.sim;
    return {
      state: this.state, countdown: this.countdown === null ? null : Math.ceil(this.countdown), time: Math.floor(this.time),
      players: [...sim.clients.values()].map((c) => ({ id: c.id, name: c.name, ready: c.ready, st: c.state })),
      taken: this.taken,
    };
  }

  broadcast() { this.sim.emit({ e: 'round', ...this.publicState() }); }

  onJoin(c) {
    c.state = 'lobby';
    const sim = this.sim;
    sim.tellClient(c, 'notice', 'Welcome to Space Station 13.');
    sim.chat.systemAll('notice', `${c.name} has joined the game.`);
    this.broadcast();
  }

  onLeave(c) { this.broadcast(); if (this.state === 'lobby' && !this.sim.clients.size) this.countdown = null; }

  free(job, late) {
    const slots = late ? (job.id === 'assistant' ? 99 : job.total < 0 ? 99 : job.total) : this.sim.jobs.slots(job);
    return slots - (this.taken[job.id] || 0);
  }

  handle(c, msg) {
    const sim = this.sim;
    switch (msg.op) {
      case 'job': if (sim.jobs.byId[msg.id]) { c.job = msg.id; this.broadcast(); } break;
      case 'ready':
        if (this.state !== 'lobby') return;
        c.ready = !!msg.v;
        if (c.ready && sim.opts.autostart > 0 && this.countdown === null) this.countdown = sim.opts.autostart;
        if (![...sim.clients.values()].some((x) => x.ready)) this.countdown = null;
        this.broadcast();
        break;
      case 'start': if (this.state === 'lobby') { c.ready = true; this.start(); } break;
      case 'latejoin': if (this.state === 'playing' && c.state === 'lobby') this.lateJoin(c, msg.id); break;
      case 'observe': if (c.state === 'lobby') { c.state = 'ghost'; sim.tellClient(c, 'notice', 'You are now observing.'); this.broadcast(); } break;
      case 'lobby': if (c.state === 'ghost' && !c.mob && !c.deadMob) { c.state = 'lobby'; this.broadcast(); } break;
      default: break;
    }
  }

  update(dt) {
    const sim = this.sim;
    if (this.state === 'lobby') {
      if (this.countdown !== null) {
        this.countdown -= dt;
        if (this.countdown <= 0) this.start();
      }
    } else if (this.state === 'playing') {
      this.time += dt;
      // everyone who could be playing has died or left: wrap it up
      const humans = [...sim.clients.values()];
      if (humans.length && !this.wrapping && humans.every((c) => !c.mob || c.mob.dead || c.mob.evacuated) && humans.some((c) => c.deadMob || c.escaped)) {
        this.wrapping = true;
        this.wrapAt = this.time + 8;
      }
      if (this.wrapping && this.time > this.wrapAt && this.state === 'playing') sim.director.finish('wipe');
    } else if (this.state === 'ending') {
      this.endTimer += dt;
    }
  }

  start() {
    const sim = this.sim;
    this.state = 'playing';
    this.time = 0;
    this.taken = {};
    this.countdown = null;
    sim.chat.systemAll('notice', 'Welcome to Space Station 13, enjoy your stay!');
    const players = [...sim.clients.values()].filter((c) => c.state === 'lobby' && c.ready);
    players.sort(() => Math.random() - 0.5);
    for (const c of players) {
      let job = sim.jobs.get(c.job);
      if (this.free(job, false) <= 0) job = sim.jobs.get('assistant');
      this.assign(c, job, false);
    }
    // NPC crew
    const target = sim.opts.bots;
    let have = players.length;
    for (const id of BOT_ORDER) {
      if (have >= target) break;
      const job = sim.jobs.byId[id];
      if (!job) continue;
      const n = id === 'assistant' ? 3 : 1;
      for (let k = 0; k < n && have < target && this.free(job, false) > 0; k++) {
        this.taken[job.id] = (this.taken[job.id] || 0) + 1;
        sim.spawnCrew(job, null);
        have++;
      }
    }
    sim.ai.spawnPets();
    sim.director.start();
    this.broadcast();
  }

  assign(c, job, late) {
    const sim = this.sim;
    this.taken[job.id] = (this.taken[job.id] || 0) + 1;
    const m = sim.spawnCrew(job, c, { late });
    c.ready = false;
    c.deadMob = null;
    for (const [k, text] of greeting(job)) sim.tellClient(c, k, text);
    if (late) sim.director.autoRadio('common', `${c.name} has signed up as ${job.title}.`, 'Automated Announcement System');
    m.dirty = true;
    this.broadcast();
    return m;
  }

  lateJoin(c, jobId) {
    const sim = this.sim;
    const job = sim.jobs.byId[jobId] || sim.jobs.get('assistant');
    if (this.free(job, true) <= 0) { sim.tellClient(c, 'warning', `${job.title} is not available. Please try another.`); return; }
    this.assign(c, job, true);
  }

  onPlayerDeath(c, cause) {
    const sim = this.sim;
    const m = c.mob;
    c.deadMob = m;
    c.mob = null;
    m.client = null;
    c.state = 'ghost';
    c.ghost.x = m.x; c.ghost.z = m.z; c.ghost.yaw = m.yaw;
    c.outbox.push({ e: 'ghost', cause: typeof cause === 'string' ? cause : 'injuries' });
    sim.tellClient(c, 'deadsay', 'You have died.');
    this.broadcast();
  }

  /** Build the SS13-style round end report. */
  report(kind) {
    const sim = this.sim, d = sim.director;
    const lines = [];
    const crew = [...sim.mobs.values()].filter((m) => m.kind === 'human');
    const escaped = crew.filter((m) => m.evacuated);
    const dead = crew.filter((m) => m.dead && !m.evacuated);
    const left = crew.filter((m) => !m.dead && !m.evacuated);
    lines.push(kind === 'shuttle' ? 'The emergency shuttle has left the station.' : kind === 'wipe' ? 'Everyone aboard is dead or gone.' : 'The round has ended.');
    lines.push(`Round length: ${Math.floor(this.time / 60)} minutes ${Math.floor(this.time % 60)} seconds.`);
    lines.push('');
    lines.push('Station status');
    lines.push(`  Hull breaches: ${sim.world.ventTiles().length} open, ${d.stats.patched} repaired`);
    lines.push(`  Power: ${sim.power.state === 'normal' ? 'main grid online' : sim.power.state === 'battery' ? 'emergency cells only' : 'offline'}`);
    lines.push(`  Space carp killed: ${d.stats.carpKilled}`);
    lines.push('');
    lines.push(`Crew: ${crew.length} total, ${escaped.length} escaped, ${left.length} stranded on the station, ${dead.length} dead`);
    const row = (m, s) => `  ${m.name} (${sim.jobs.get(m.job)?.title || 'crew'})${m.client || m.wasPlayer ? ' [player]' : ''} - ${s}`;
    for (const m of escaped) lines.push(row(m, 'escaped'));
    for (const m of left) lines.push(row(m, 'left behind'));
    for (const m of dead) lines.push(row(m, 'died'));
    return lines;
  }

  end(kind) {
    this.state = 'ending';
    this.endTimer = 0;
    const lines = this.report(kind);
    this.sim.emit({ e: 'report', title: 'Round Over', lines, kind });
    this.broadcast();
  }
}
