import { clamp } from './util.js';

export const DMG_TYPES = ['brute', 'burn', 'tox', 'oxy'];

// code/__DEFINES/atmospherics.dm, mobs.dm
export const BODYTEMP_NORMAL = 310.15;
export const BODYTEMP_HEAT_DAMAGE_LIMIT = BODYTEMP_NORMAL + 30, BODYTEMP_COLD_DAMAGE_LIMIT = BODYTEMP_NORMAL - 40;
const AUTORECOVERY_DIVISOR = 11, AUTORECOVERY_MINIMUM = 12, HEAT_DIVISOR = 15, COLD_DIVISOR = 15, HEATING_MAX = 30, COOLING_MAX = -100;
const COLD_DAMAGE = [[200, 0.5], [120, 1.5], [0, 3]];            // COLD_DAMAGE_LEVEL_1, 2 and 3 from 200 and 120 kelvin down
const LIFE = 2;                                                    // seconds between one Life() and the next

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
    this.god = false;             // debug: nothing hurts
    this.temp = BODYTEMP_NORMAL;  // body temperature, kelvin
    this.thermT = 0;
    this.tempAlert = null;        // 'hot' or 'cold' while the body is beyond what it takes
  }

  get health() { return this.max - this.brute - this.burn - this.tox - this.oxy; }
  get crit() { return !this.dead && this.health <= 0; }
  get alive() { return !this.dead; }
  get fraction() { return clamp(this.health / this.max, -1, 1); }

  damage(type, amount, src) {
    if (this.dead || amount <= 0 || this.god) return 0;
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

  /**
   * Body temperature, every two seconds (species.dm handle_environment, natural_bodytemperature_stabilization, adjust_bodytemperature, handle_body_temperature): the body tries to keep to 310 kelvin, and
   * takes up a fifteenth of the difference to the air's temperature (at most 30 a step warming, 100 cooling), less what the clothes keep out (`env.insulation(T, now)`: 0 to 1); too hot (over 360)
   * or too cold (under 270) it burns. `env.temperature` is the air's (space is 2.7).
   */
  thermal(dt, env) {
    this.thermT += dt;
    while (this.thermT >= LIFE) { this.thermT -= LIFE; this.thermalStep(env); }
  }

  thermalStep(env) {
    const areatemp = env.temperature ?? 293.15, ins = env.insulation || (() => 0);
    let tb = this.temp;
    const normal = BODYTEMP_NORMAL;
    if (!this.dead) {
      const diff = normal - tb;
      let nat = 0;
      if (tb <= BODYTEMP_COLD_DAMAGE_LIMIT) nat = Math.max(diff / AUTORECOVERY_DIVISOR, AUTORECOVERY_MINIMUM);
      else if (tb < normal) nat = Math.max(diff / AUTORECOVERY_DIVISOR, Math.min(diff, AUTORECOVERY_MINIMUM / 4));
      else if (tb > normal && tb <= BODYTEMP_HEAT_DAMAGE_LIMIT) nat = Math.min(diff / AUTORECOVERY_DIVISOR, Math.max(diff, -(AUTORECOVERY_MINIMUM / 4)));
      else if (tb >= BODYTEMP_HEAT_DAMAGE_LIMIT) nat = Math.min(diff / AUTORECOVERY_DIVISOR, -AUTORECOVERY_MINIMUM);
      const prot = ins(tb + nat, tb);
      nat = tb < normal ? (prot + 1) * nat : (1 / (prot + 1)) * nat;
      tb += nat;
    }
    let amount = (areatemp - tb) * (1 - ins(tb + (areatemp - tb), tb));                   // adjust_bodytemperature(use_insulation, use_steps)
    amount = amount > 0 ? Math.min(amount / HEAT_DIVISOR, HEATING_MAX) : Math.max(amount / COLD_DIVISOR, COOLING_MAX);
    tb = Math.max(0, tb + amount);
    this.temp = tb;
    if (tb > BODYTEMP_HEAT_DAMAGE_LIMIT) {
      this.tempAlert = 'hot';
      this.damage('burn', Math.max(Math.log2(tb - normal) - 5, 0), 'heat');
    } else if (tb < BODYTEMP_COLD_DAMAGE_LIMIT) {
      this.tempAlert = 'cold';
      for (const [from, dmg] of COLD_DAMAGE) if (tb >= from) { this.damage('burn', dmg, 'cold'); break; }
    } else this.tempAlert = null;
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
    if (env.temperature !== undefined) this.thermal(dt, env);
    if (this.breathes) {
      // what is breathed: the tank's gas when internals are on and give one (`env.breath`, partial pressures in kPa), else the room's air (a carp breathes nothing in particular)
      const b = env.breath || env;
      const ambientOk = env.o2 >= 16 && env.pressure >= 30;
      const ok = env.breath ? b.o2 >= 16 : (env.internals || ambientOk);
      if (ok) {
        this.breathless = Math.max(0, this.breathless - dt * 2);
        this.oxy = Math.max(0, this.oxy - dt * 6);
      } else {
        this.breathless += dt;
        if (this.breathless > 2.5) this.damage('oxy', dt * (this.crit ? 2.2 : 3.4));
      }
      const tox = env.breath ? b.tox : env.internals ? 0 : env.tox;
      if (tox > 1.5) this.damage('tox', dt * Math.min(3, tox * 0.4));
      const co2 = env.breath ? b.co2 : env.internals ? 0 : (env.co2 || 0);          // lungs.dm: over 10 kPa for 12 s, and then it hurts (3 a breath, 8 after 30 s)
      if (co2 > 10) {
        this.co2time = (this.co2time || 0) + dt;
        if (this.co2time > 12) this.damage('oxy', dt * (this.co2time > 30 ? 5.5 : 1.5));
      } else this.co2time = 0;
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
