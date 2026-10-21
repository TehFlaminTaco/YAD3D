import { KIND, TILE } from '../shared/config.js';
import { allItems } from './inventory.js';

// code/__DEFINES/radiation.dm
const BACKGROUND = 9;                                      // RAD_BACKGROUND_RADIATION: harmless, and the strength a wave stops at
const MOB_COEFFICIENT = 0.2;                               // RAD_MOB_COEFFICIENT
const SKIN_PROTECTION = 1 / MOB_COEFFICIENT + BACKGROUND;  // RAD_MOB_SKIN_PROTECTION: a wave weaker than this does nothing to a mob
const LOSS_PER_TICK = 0.5, TOX_COEFFICIENT = 0.08, OVERDOSE_REDUCTION = 1e-6;
const BURN_THRESHOLD = 1000, BURN_BASE = 1.1, BURN_GRADIENT = 10000;
const MOB_SAFE = 500, MOB_KNOCKDOWN = 2000, MOB_KNOCKDOWN_PROB = 0.01, MOB_KNOCKDOWN_AMOUNT = 3;
const LIFE_TICK = 2;                                       // seconds between one `Life()` and the next
const LEVELS = [9, 100, 400, 800, 1500];                   // geiger_counter.dm RAD_LEVEL_NORMAL ... RAD_LEVEL_CRITICAL
const SMOOTHING = 5, GRACE = 2;                            // RAD_MEASURE_SMOOTHING, RAD_GRACE_PERIOD
const MAX_STEPS = 90;                                      // (a wave with no falloff only stops when walls have weakened it below 9: the station is not this wide)
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];           // east, west, south, north of the map (+z is south)

const burnCurve = (x) => Math.log(1 + (x - BURN_THRESHOLD) / BURN_GRADIENT) / Math.log(BURN_BASE);

/**
 * Radiation (radiation.dm, radiation_wave.dm, rad_insulation.dm, living.dm rad_act, life.dm handle_mutations_and_radiation, geiger_counter.dm). A **pulse** (the supermatter makes one about once a second)
 * is four waves, one in each direction, that spread a tile at a time: a tile `s` steps away gets `intensity / s²`, and the wave stops when that is under 9. Walls and windows do not stop a wave, they weaken it a
 * little (the weaker, the further out: `intensity *= 1 - (1 - insulation) / width` for each one in the front of the wave). Everyone a wave reaches (and every Geiger counter they carry) is hit with its strength.
 * A person hit with over 14 gets `0.2 × (strength - 9)` radiation (less what their clothes stop: `rd` in the item's data, the armor's "rad"), burns above 1000, and carries what they have
 * (losing half a unit every two seconds): over 500 it poisons them, over 2000 it sometimes knocks them down.
 */
export class Radiation {
  constructor(sim) {
    this.sim = sim;
    this.geigers = new Set();                              // the Geiger counters that are switched on
  }

  // ------------------------------------------------------------------ the waves
  /** How much of a wave the tile `i` lets through (rad_insulation): walls 0.7, reinforced 0.6, a window 0.9, a reinforced one 0.6, a radiation collector 0.5; 1 for everything else. */
  insulation(g, i) {
    const w = g.world;
    if (w.kind[i] === KIND.WALL) {
      if (w.glass[i]) return w.windowKey(i) === 'window' ? 0.9 : 0.6;
      return w.wallKey(i) === 'reinforced_wall' ? 0.6 : 0.7;
    }
    return g.radShield?.has(i) ? 0.5 : 1;
  }

  /** The tiles with a radiation collector on them (they are RAD_EXTREME_INSULATION). */
  shields(g) {
    if (!g.radShield) g.radShield = new Set(g.powersim.machines.collector.map((k) => k.tile));
    return g.radShield;
  }

  /**
   * Work out a pulse: for each of the four directions the strength of the wave at each step (`strength[k][s]`, s from 1). Insulation along the way is applied the way the DM does it: after a step has
   * been radiated, every insulating tile in its front makes the whole wave weaker.
   */
  waves(g, c0, r0, l, intensity, rangeMod = 1) {
    const w = g.world, out = [];
    this.shields(g);
    for (let k = 0; k < 4; k++) {
      const [dx, dz] = DIRS[k], vertical = dx === 0;
      let I = intensity;
      const str = [intensity];                             // (index 0: the source tile)
      for (let s = 1; s <= MAX_STEPS; s++) {
        const strength = s > 1 ? I / Math.max(rangeMod * s, 1) ** 2 : I;
        if (strength < BACKGROUND) break;
        str[s] = strength;
        const reach = vertical ? s - 1 : s, width = 1 + 2 * reach;
        const fc = c0 + dx * s, fr = r0 + dz * s;
        for (let j = -reach; j <= reach; j++) {
          const c = vertical ? fc + j : fc, r = vertical ? fr : fr + j;
          if (!w.inb(c, r, l)) continue;
          const ins = this.insulation(g, w.idx(c, r, l));
          if (ins !== 1) I *= 1 - (1 - ins) / width;
        }
      }
      out.push(str);
    }
    return out;
  }

  /** The strength of a pulse's waves at a point `(x, z)`: from the waves worked out for the pulse's centre tile `(c0, r0)`. */
  at(waves, c0, r0, x, z) {
    const dc = Math.floor(x / TILE) - c0, dr = Math.floor(z / TILE) - r0;
    const s = Math.max(Math.abs(dc), Math.abs(dr));
    if (s === 0) return waves[0][0];
    const k = Math.abs(dc) >= Math.abs(dr) ? (dc > 0 ? 0 : 1) : (dr > 0 ? 2 : 3);       // (a corner belongs to the east and west waves)
    return waves[k][s] ?? 0;
  }

  /** A radiation pulse of `intensity` from a point of grid `g`: everyone in reach (and their Geiger counters) is hit. */
  pulse(g, x, z, l, intensity, rangeMod = 1) {
    if (!(intensity >= BACKGROUND)) return;
    const sim = this.sim, c0 = Math.floor(x / TILE), r0 = Math.floor(z / TILE), waves = this.waves(g, c0, r0, l, intensity, rangeMod);
    for (const m of sim.mobs.values()) {
      if (m.dead || m.grid !== g || (m.l | 0) !== l) continue;
      const s = this.at(waves, c0, r0, m.x, m.z);
      if (s <= 0) continue;
      for (const it of allItems(m)) if (it.geiger?.on) this.geigerHit(it, s);
      this.radAct(m, s);
    }
    for (const rec of sim.floor.values()) {                              // (counters lying about)
      if (rec.item.geiger?.on && rec.grid === g && (rec.l | 0) === l) { const s = this.at(waves, c0, r0, rec.x, rec.z); if (s > 0) this.geigerHit(rec.item, s); }
    }
  }

  // ------------------------------------------------------------------ the person
  /** What their clothes stop, percent (getarmor(null, "rad"): the armor of what covers each part of the body, averaged over the six; a suit and a uniform cover five of them, a helmet and a mask the head). */
  armor(m) {
    if (!m.humanoid) return 0;
    const rd = (it) => it?.rd ?? 0, wn = m.worn;
    return Math.min(100, (5 * (rd(wn.suit) + rd(wn.uniform)) + rd(wn.head) + rd(wn.mask)) / 6);
  }

  /** living.dm rad_act: a wave of `strength` reaches them. */
  radAct(m, strength) {
    if (!m.body || m.dead) return;
    if (!strength || strength < SKIN_PROTECTION) return;
    const amount = strength - BACKGROUND, blocked = this.armor(m), hit = (100 - blocked) / 100;
    if (amount > BURN_THRESHOLD) this.sim.hurt(m, burnCurve(amount) * hit, 'burn', 'radiation');
    m.radiation = (m.radiation || 0) + Math.max(amount * MOB_COEFFICIENT / Math.max(1, (m.radiation || 0) ** 2 * OVERDOSE_REDUCTION) * hit, 0);
  }

  /** Once a tick (every two seconds, as `Life()`): it wears off, it poisons, it sometimes knocks them down. */
  life(m) {
    if (!m.radiation) return;
    const sim = this.sim;
    m.radiation -= Math.min(m.radiation, LOSS_PER_TICK);
    if (m.radiation > MOB_SAFE) sim.hurt(m, Math.log(m.radiation - MOB_SAFE) * TOX_COEFFICIENT, 'tox', 'radiation');
    if (m.radiation > MOB_KNOCKDOWN && sim.rand() < MOB_KNOCKDOWN_PROB && m.stunned <= 0) {
      sim.chat.visible(m, `${m.name} collapses!`, 'danger', 10, m);
      sim.tell(m, 'warning', 'You feel weak.');
      m.stunned = Math.max(m.stunned, MOB_KNOCKDOWN_AMOUNT);
    }
  }

  /** From `tickBodies`. */
  tick(m, dt) {
    if (!m.radiation) { m.radT = 0; return; }
    m.radT = (m.radT || 0) + dt;
    while (m.radT >= LIFE_TICK) { m.radT -= LIFE_TICK; this.life(m); }
  }

  // ------------------------------------------------------------------ the Geiger counter
  geiger(it) { return (it.geiger ??= { on: false, count: 0, current: 0, last: 0, grace: GRACE }); }

  /** Which of the five pictures an `on` counter shows (update_icon_state: the two highest bands before critical share one). */
  levelOf(count) { return count <= LEVELS[0] ? 1 : count <= LEVELS[1] ? 2 : count <= LEVELS[2] ? 3 : count <= LEVELS[4] ? 4 : 5; }

  /** The counter's picture: off, or one of five levels (geiger_counter.dm update_icon_state). */
  refresh(it) {
    const gv = this.sim.level.itemdefs[it.path]?.gv;
    if (gv) it.sprite = gv[it.geiger.on ? this.levelOf(it.geiger.count) : 0];
  }

  geigerHit(it, strength) { if (strength > BACKGROUND) this.geiger(it).current += strength; }

  /** attack_self: it is switched on or off. */
  toggle(m, it) {
    const gg = this.geiger(it);
    gg.on = !gg.on;
    if (gg.on) this.geigers.add(it); else { this.geigers.delete(it); gg.count = 0; gg.current = 0; }
    this.refresh(it);
    m.dirty = true;
    this.sim.sound('beep', m, 0.3);
    this.sim.tell(m, 'notice', `You switch ${gg.on ? 'on' : 'off'} the ${it.name}.`);
  }

  /** Every two seconds (SSobj): what the counter has heard goes into its count. */
  update(dt) {
    this.acc = (this.acc || 0) + dt;
    if (this.acc < LIFE_TICK) return;
    this.acc -= LIFE_TICK;
    for (const it of this.geigers) {
      if (!it.geiger?.on) { this.geigers.delete(it); continue; }
      const gg = it.geiger;
      gg.count -= gg.count / SMOOTHING;
      gg.count += gg.current / SMOOTHING;
      if (gg.current) { gg.grace = GRACE; gg.last = gg.current; } else { gg.grace--; if (gg.grace <= 0) gg.count = 0; }
      gg.current = 0;
      const before = it.sprite;
      this.refresh(it);
      if (it.sprite !== before) this.touch(it);
    }
  }

  /** Whoever carries it sees its picture change. */
  touch(it) { const m = it.loc?.mob; if (m) m.dirty = true; }

  /** What it says when it is looked at (geiger_counter.dm examine). */
  examine(it) {
    const gg = it.geiger;
    if (!gg?.on) return [];
    const n = gg.count;
    const line = n <= LEVELS[0] ? 'Ambient radiation level count reports that all is well.'
      : n <= LEVELS[1] ? 'Ambient radiation levels slightly above average.'
        : n <= LEVELS[2] ? 'Ambient radiation levels above average.'
          : n <= LEVELS[3] ? 'Ambient radiation levels highly above average.'
            : n <= LEVELS[4] ? 'Ambient radiation levels nearing critical level.' : 'Ambient radiation levels above critical level!';
    return ['Alt-click it to clear stored radiation levels.', line, `The last radiation amount detected was ${Math.round(gg.last * 100) / 100}`];
  }

  /** Help intent with the counter on someone or something (afterattack, then scan() two seconds later). */
  scan(m, held, target) {
    const sim = this.sim;
    sim.chat.visible(m, `${m.name} scans ${target.name ?? 'the target'} with the ${held.name}.`, 'notice', 10, m);
    sim.tell(m, 'notice', `You scan ${target.name ?? 'the target'}'s radiation levels with the ${held.name}...`);
    const done = () => {
      if (target.body) {
        if (!target.radiation) sim.tell(m, 'notice', 'Radiation levels within normal boundaries.');
        else sim.tell(m, 'danger', `Subject is irradiated. Radiation levels: ${Math.round(target.radiation)}.`);
      }
      sim.tell(m, 'notice', 'Target is free of radioactive contamination.');
    };
    sim.actions.startTimed(m, 'scanning', 2, () => m.held === held, done, null, { start: null, stop: null });
  }

  /** Alt-click: clear it. */
  flush(m, it) {
    if (!it.geiger?.on) { this.sim.tell(m, 'warning', `The ${it.name} must be on to reset its radiation level!`); return; }
    it.geiger.count = 0;
    this.refresh(it);
    m.dirty = true;
    this.sim.tell(m, 'notice', `You flush the ${it.name}'s radiation counts, resetting it to normal.`);
  }
}
