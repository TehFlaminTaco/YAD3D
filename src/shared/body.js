import { clamp } from './util.js';

export const DMG_TYPES = ['brute', 'burn', 'tox', 'oxy'];

/**
 * SS13-style damage model: four damage pools; health = max - sum. Below 0 you're critical, below
 * -DEATH_AT you die. Breathing + pressure rules are applied in tick() from the local atmosphere.
 */
export class Body {
  constructor(opts = {}) {
    this.max = opts.max ?? 100;
    this.deathAt = opts.deathAt ?? 40;
    this.brute = 0; this.burn = 0; this.tox = 0; this.oxy = 0;
    this.dead = false;
    this.breathless = 0;          // seconds without breathable air
    this.stun = 0;
    this.breathes = opts.breathes ?? true;
    this.hurtFlash = 0;
    this.lastHit = null;
    this.critTime = 0;
    this.regen = opts.regen ?? 0.03;
  }

  get health() { return this.max - this.brute - this.burn - this.tox - this.oxy; }
  get crit() { return !this.dead && this.health <= 0; }
  get alive() { return !this.dead; }
  get fraction() { return clamp(this.health / this.max, -1, 1); }

  damage(type, amount, src) {
    if (this.dead || amount <= 0) return 0;
    this[type] = clamp(this[type] + amount, 0, this.max * 2);
    this.hurtFlash = Math.min(1, this.hurtFlash + amount / 25);
    this.lastHit = src || type;
    this.check();
    return amount;
  }

  heal(type, amount) {
    if (this.dead) return;
    this[type] = Math.max(0, this[type] - amount);
  }

  check() {
    if (!this.dead && this.health <= -this.deathAt) this.die();
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.onDeath?.(this.lastHit);
  }

  /**
   * env: {pressure, o2, tox, safeSuit, internals}
   * internals => breathing from a tank regardless of ambient air.
   */
  tick(dt, env) {
    if (this.dead) return;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 1.8);
    this.stun = Math.max(0, this.stun - dt);
    if (this.breathes) {
      const ambientOk = env.o2 >= 16 && env.pressure >= 30;
      const ok = env.internals || ambientOk;
      if (ok) {
        this.breathless = Math.max(0, this.breathless - dt * 2);
        this.oxy = Math.max(0, this.oxy - dt * 6);
      } else {
        this.breathless += dt;
        if (this.breathless > 2.5) this.damage('oxy', dt * (this.crit ? 2.2 : 3.4));
      }
      if (!env.internals && env.tox > 1.5) this.damage('tox', dt * Math.min(3, env.tox * 0.4));
    }
    if (!env.safeSuit && env.pressure < 32) {
      this.damage('brute', dt * clamp((32 - env.pressure) / 32, 0, 1) * 3.2, 'pressure');
    }
    if (env.heat) this.damage('burn', dt * env.heat);
    if (this.crit) {
      this.critTime += dt;
      this.damage('oxy', dt * 0.6);       // bleed out slowly
    } else {
      this.critTime = 0;
      if (this.regen && this.health > 10 && env.pressure > 60) { this.heal('brute', dt * this.regen); this.heal('burn', dt * this.regen); this.heal('tox', dt * this.regen * 2); }
    }
    this.check();
  }
}
