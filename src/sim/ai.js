import { TILE, KIND } from '../shared/config.js';
import { rng } from '../shared/util.js';

const FIRST = ['Alex', 'Ben', 'Cass', 'Dana', 'Eli', 'Fay', 'Gus', 'Hale', 'Ines', 'Jo', 'Kit', 'Lena', 'Milo', 'Nora', 'Otis', 'Pia', 'Quinn', 'Rex', 'Sol', 'Tess', 'Uma', 'Vic', 'Wren', 'Yuri', 'Zed', 'Marta', 'Ivo', 'Bram'];
const LAST = ['Okafor', 'Reyes', 'Voss', 'Lindqvist', 'Tanaka', 'Mercer', 'Dube', 'Kowalski', 'Haddad', 'Novak', 'Ashby', 'Petrov', 'Singh', 'Moreau', 'Brandt', 'Ito', 'Calloway', 'Duarte'];

// idle chatter, per department. Plain station talk, the kind of thing people actually type.
const SAY = {
  engineering: ['anyone got a spare multitool?', 'the engine\'s humming a bit weird.', 'who took my welder', 'don\'t touch the SMES.', 'I\'ve got a bad feeling about this wiring.'],
  medical: ['medbay is stocked if anyone needs a patch up.', 'who keeps leaving bodies in the hallway', 'please stop punching each other.', 'we\'re out of ointment. again.'],
  security: ['stay out of maint, it\'s a mess back there.', 'nobody shoot the windows, thanks.', 'reminder: security is not a taxi.'],
  science: ['it\'s not a leak, it\'s a controlled release.', 'who touched the beaker', 'toxins is fine. mostly.'],
  cargo: ['crates are in the bay.', 'shuttle\'s late again.', 'whatever you ordered, it isn\'t here.'],
  service: ['bar\'s open.', 'we\'re out of everything except cheese.', 'honk', 'anyone want food?'],
  command: ['everything is under control.', 'department heads, check in please.', 'has anyone seen my ID?'],
  general: ['is it cold in here or is it me?', 'did you hear that thumping?', 'I just got here. where am I?', 'does anybody know where the bar is?'],
};
const SCREAM = ['AAAAH!', 'CARP!', 'GET IT OFF ME', 'HELP!', 'IT\'S IN HERE!', 'oh god oh god'];
const DEPT = (job) => {
  const t = (job || '').toLowerCase();
  if (/engineer|atmos/.test(t)) return 'engineering';
  if (/medical|chemist|virolog|paramedic|psycholog/.test(t)) return 'medical';
  if (/security|warden|detective/.test(t)) return 'security';
  if (/scientist|roboticist|geneticist|research/.test(t)) return 'science';
  if (/cargo|quartermaster|miner/.test(t)) return 'cargo';
  if (/captain|head_of|chief|research_director/.test(t)) return 'command';
  if (/bartender|cook|botanist|janitor|clown|mime|chaplain|lawyer|curator/.test(t)) return 'service';
  return 'general';
};

/** Behaviour for every mob that isn't driven by a player: crew NPCs, carp, pets. */
export class AI {
  constructor(sim) {
    this.sim = sim;
    this.rand = rng(4242);
    this.budget = 0;
  }

  randomName() { return FIRST[Math.floor(this.rand() * FIRST.length)] + ' ' + LAST[Math.floor(this.rand() * LAST.length)]; }

  spawnCarp(x, z) {
    const sim = this.sim;
    if (!sim.level.mobs.carp) return null;
    const m = sim.newMob({ kind: 'carp', set: 'carp', name: 'space carp', x, z, speed: 3.1, hp: 26, hostile: true, breathes: false, regen: 0 });
    m.state = 'hunt';
    return m;
  }

  spawnPets() {
    const sim = this.sim, w = sim.world;
    const find = (re) => {
      for (let tries = 0; tries < 4000; tries++) {
        const i = Math.floor(this.rand() * w.W * w.H);
        if (w.kind[i] !== KIND.FLOOR || w.solid[i]) continue;
        if (re.test(w.areas[w.areaIdx[i]].n)) return i;
      }
      return -1;
    };
    for (const [set, name, re] of [['corgi', 'Ian', /Personnel|Hall/i], ['cat', 'Runtime', /Medbay|Medical/i], ['monkey', 'Pun Pun', /Bar|Kitchen|Botany|Cafeteria|Garden/i]]) {
      if (!sim.level.mobs[set]) continue;
      const i = find(re);
      if (i < 0) continue;
      sim.newMob({ kind: 'pet', set, name, x: (i % w.W) * TILE + 1, z: Math.floor(i / w.W) * TILE + 1, speed: 1.6, hp: 30, pet: true, regen: 0 });
    }
  }

  update(dt) {
    const sim = this.sim;
    this.budget = 3;
    for (const m of sim.mobs.values()) {
      m.speedNow = m.client ? m.speedNow : 0;
      if (m.client || m.dead || m.ssd || m.evacuated || m.inside) continue;
      m.fear = Math.max(0, m.fear - dt);
      if (m.stunned > 0 || m.body.crit) continue;
      if (m.kind === 'carp') this.thinkCarp(m, dt); else this.thinkCivil(m, dt);
    }
  }

  // -------------------------------------------------------------- hostile fauna
  thinkCarp(m, dt) {
    const sim = this.sim;
    let tgt = null, bd = 18;
    for (const o of sim.mobs.values()) {
      if (o === m || o.dead || o.kind !== 'human' || o.evacuated || o.inside) continue;
      const d = Math.hypot(o.x - m.x, o.z - m.z);
      if (d < bd && (d < 4 || sim.world.los(m.x, m.z, o.x, o.z))) { bd = d; tgt = o; }
    }
    if (tgt) {
      m.state = 'hunt';
      if (bd < 1.5) {
        m.yaw = Math.atan2(-(tgt.x - m.x), -(tgt.z - m.z));
        if (m.cool <= 0) {
          m.cool = 1.15;
          sim.sound('bite', m.x, m.z, 0.9);
          sim.hurt(tgt, 7 + Math.random() * 3, 'brute', 'space carp');
          sim.chat.visible(m, `The space carp bites ${tgt.name}!`, 'danger', 12);
        }
        return;
      }
      if (sim.world.los(m.x, m.z, tgt.x, tgt.z) && bd < 9) { this.steer(m, tgt.x, tgt.z, m.speed, dt); m.path = null; return; }
      m.repath -= dt;
      if (m.repath <= 0 || !m.path) {
        m.repath = 1.2;
        if (this.budget > 0) { this.budget--; m.path = sim.nav.path(m.tile[0], m.tile[1], Math.floor(tgt.x / TILE), Math.floor(tgt.z / TILE), null, 2500); m.pathIdx = 0; }
      }
      if (m.path) this.follow(m, dt, m.speed);
      return;
    }
    this.wander(m, dt, 8, m.speed * 0.5);
  }

  // -------------------------------------------------------------- crew & pets
  thinkCivil(m, dt) {
    const sim = this.sim;
    // run from anything hostile
    let near = null, nd = 9;
    for (const o of sim.mobs.values()) if (!o.dead && o.hostile) { const d = Math.hypot(o.x - m.x, o.z - m.z); if (d < nd) { nd = d; near = o; } }
    if (near) {
      m.fear = 4;
      if (m.state !== 'flee') { m.state = 'flee'; if (m.humanoid && Math.random() < 0.5) sim.chat.npcSay(m, SCREAM[Math.floor(Math.random() * SCREAM.length)]); }
      const ax = m.x - near.x, az = m.z - near.z, al = Math.hypot(ax, az) || 1;
      this.steer(m, m.x + ax / al * 4, m.z + az / al * 4, m.speed * 1.5, dt);
      return;
    } else if (m.state === 'flee' && m.fear <= 0) m.state = 'idle';

    // head for air if the pressure is dropping
    const [c, r] = m.tile;
    if (sim.atmos.pressureAt(c, r) < 40 && m.humanoid) {
      let best = null, bp = sim.atmos.pressureAt(c, r);
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!sim.nav.passable(c + dc, r + dr, m)) continue;
        const pp = sim.atmos.pressureAt(c + dc, r + dr);
        if (pp > bp) { bp = pp; best = [c + dc, r + dr]; }
      }
      if (best) { this.steer(m, best[0] * TILE + 1, best[1] * TILE + 1, m.speed * 1.2, dt); return; }
    }

    // idle talk
    m.talkCool -= dt;
    if (m.humanoid && m.talkCool <= 0) {
      m.talkCool = 40 + Math.random() * 90;
      const pool = SAY[DEPT(m.job)].concat(SAY.general);
      const line = pool[Math.floor(Math.random() * pool.length)];
      const chans = sim.chat.channelsOf(m);
      if (chans.length && Math.random() < 0.35) sim.chat.npcRadio(m, line);
      else sim.chat.npcSay(m, line);
    }
    this.wander(m, dt, m.pet ? 7 : 16, m.speed * (m.pet ? 0.7 : 0.8));
  }

  wander(m, dt, radius, speed) {
    const sim = this.sim;
    if (m.state === 'idle' || !m.path) {
      m.timer -= dt;
      if (m.timer <= 0 && this.budget > 0) {
        this.budget--;
        const t = sim.nav.randomTileNear(m.home[0], m.home[1], radius, this.rand, m);
        if (t) {
          const path = sim.nav.path(m.tile[0], m.tile[1], t[0], t[1], m, 2200);
          if (path && path.length) { m.path = path; m.pathIdx = 0; m.state = 'walk'; }
        }
        m.timer = 2 + this.rand() * 7;
      }
    }
    if (m.path) this.follow(m, dt, speed);
  }

  follow(m, dt, speed) {
    const sim = this.sim;
    if (!m.path || m.pathIdx >= m.path.length) { m.path = null; if (m.state === 'walk') m.state = 'idle'; return; }
    const [tc, tr] = m.path[m.pathIdx];
    const tx = tc * TILE + 1, tz = tr * TILE + 1;
    const i = tr * sim.world.W + tc;
    const door = sim.world.doorAt.get(i);
    if (door && !door.passable) {
      if (door.state === 'closed') {
        const idx = sim.doors.indexOf(door);
        const ok = m.kind !== 'carp' && door.allows(m) && sim.power.doorsWork(door);
        if (ok && Math.hypot(tx - m.x, tz - m.z) < 2.6) sim.openDoor(idx, m); else if (!ok) { m.path = null; return; }
      }
      if (Math.hypot(tx - m.x, tz - m.z) < 1.2) return;
    }
    if (Math.hypot(tx - m.x, tz - m.z) < 0.45) { m.pathIdx++; return; }
    const blocked = this.steer(m, tx, tz, speed, dt);
    if (blocked) { m.stuck += dt; if (m.stuck > 1.5) { m.path = null; m.stuck = 0; } } else m.stuck = 0;
  }

  steer(m, tx, tz, speed, dt) {
    const sim = this.sim;
    const dx = tx - m.x, dz = tz - m.z, d = Math.hypot(dx, dz);
    if (d < 0.01) return false;
    const vx = dx / d * speed, vz = dz / d * speed;
    m.yaw = Math.atan2(-vx, -vz);
    const pos = { x: m.x, z: m.z };
    const blocked = sim.world.move(pos, vx * dt, vz * dt, 0.28);
    for (const o of sim.mobs.values()) {
      if (o === m || o.dead) continue;
      const ox = pos.x - o.x, oz = pos.z - o.z, od = Math.hypot(ox, oz);
      if (od < 0.7 && od > 0.001) { const push = (0.7 - od) * 0.5; sim.world.move(pos, ox / od * push, oz / od * push, 0.28); }
    }
    m.speedNow = Math.hypot(pos.x - m.x, pos.z - m.z) / Math.max(dt, 1e-4);
    m.x = pos.x; m.z = pos.z;
    return blocked;
  }
}
