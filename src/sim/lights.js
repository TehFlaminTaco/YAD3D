import { TILE, REACH } from '../shared/config.js';
import { LIGHT_WATTS } from '../shared/powerdata.js';
import { CH } from '../shared/power.js';
import { attach, place, consume } from './inventory.js';

/** A fixture's state (lighting.dm LIGHT_*): the glass in it, or not. */
export const LIGHT = { OK: 0, EMPTY: 1, BROKEN: 2, BURNED: 3 };

const isLight = (it) => !!it && it.path.startsWith('/obj/item/light/');
const fitOf = (it) => (it.path.startsWith('/obj/item/light/bulb') ? 'bulb' : 'tube');

/**
 * Light fixtures that break and are put right (lighting.dm: attackby, attack_hand, break_light_tube, burn_out). A fixture holds a tube or a bulb whole, broken or burnt out, or nothing.
 * You put one in by clicking with a light, take it out with your hand (it burns it while the lamp is lit, unless you wear gloves), and hit it with something to break it.
 */
export class Lights {
  constructor(sim) { this.sim = sim; }

  fitting(L) { return L.kind === 'bulb' ? 'bulb' : 'tube'; }
  watts(L) { return L.status === LIGHT.OK ? (LIGHT_WATTS[L.kind] ?? 80) : 0; }
  lit(g, L) { return L.status === LIGHT.OK && g.power.lightsOn(L.area); }

  /** The thing a click names. */
  thing(g, t) {
    const L = g.props.lights[t.idx];
    return L ? { k: 'light', L, grid: g, l: L.l, x: L.x, z: L.z } : null;
  }

  /** A fixture gets a new state: the room's load, the pictures and the lamps change. */
  setStatus(g, L, status) {
    if (L.status === status) return;
    const ps = g.powersim, b = L.area * 3 + CH.LIGHT;
    ps.base[b] = Math.max(0, ps.base[b] - this.watts(L));
    L.status = status;
    ps.base[b] += this.watts(L);
    g.emit({ e: 'light', i: L.idx, st: status });
  }

  /** break_light_tube: the glass is smashed (sparks and a crash if the lamp was on). */
  breakLight(g, L, quiet = false) {
    if (L.status === LIGHT.EMPTY || L.status === LIGHT.BROKEN) return false;
    const was = this.lit(g, L);
    this.setStatus(g, L, LIGHT.BROKEN);
    if (!quiet) this.sim.sound(was ? 'sparks' : 'glass_break', { grid: g, x: L.x, z: L.z }, 0.8);
    return true;
  }

  /** burn_out: it goes dark with no bang. */
  burnOut(g, L) {
    if (L.status !== LIGHT.OK) return false;
    this.setStatus(g, L, LIGHT.BURNED);
    return true;
  }

  /** Something blows up at (c, r): the fixtures nearby may break, the nearer the likelier. */
  blast(g, c, r, radius) {
    let n = 0;
    for (const L of g.props.lights) {
      const d = Math.hypot(L.c - c, L.r - r);
      if (d <= radius && this.sim.rand() < 1 - d / (radius + 1) * 0.5 && this.breakLight(g, L)) n++;
    }
    return n;
  }

  /** The tube or bulb that is in a fixture, as an item. */
  item(L) {
    const sim = this.sim, kind = this.fitting(L);
    const broken = L.status === LIGHT.BROKEN;
    const it = sim.newItem(broken ? `/obj/item/light/${kind}/broken` : `/obj/item/light/${kind}`, { status: L.status, sprite: sim.level.lightItems[kind][L.status === LIGHT.OK ? 0 : L.status === LIGHT.BROKEN ? 1 : 2] });
    if (L.status === LIGHT.BURNED) it.desc = `A burnt-out light ${kind}.`;
    else if (broken) it.desc = `A broken light ${kind}.`;
    return it;
  }

  /** What an item in a fixture's place stands for: its state. */
  statusOf(it) { return it.status ?? (it.path.endsWith('/broken') ? LIGHT.BROKEN : LIGHT.OK); }

  click(m, t, held) {
    const sim = this.sim, g = t.grid, L = t.L, fit = this.fitting(L);
    if (isLight(held)) {                                              // attackby: put it in
      if (L.status === LIGHT.OK) { sim.tell(m, 'warning', `There is a ${fit} already inserted!`); return true; }
      if (fitOf(held) !== fit) { sim.tell(m, 'warning', `This type of light requires a ${fit}!`); return true; }
      const old = L.status !== LIGHT.EMPTY ? this.item(L) : null;
      const st = this.statusOf(held);
      consume(sim, held);
      if (old) {
        this.takeOut(m, old, g, L);
        sim.tell(m, 'notice', `You replace the light ${fit}.`);
      } else sim.tell(m, 'notice', `You insert the light ${fit}.`);
      this.setStatus(g, L, st);
      sim.sound('pickup', { grid: g, x: L.x, z: L.z }, 0.5);
      return true;
    }
    if (!held) {                                                      // attack_hand: take it out
      if (L.status === LIGHT.EMPTY) { sim.tell(m, 'warning', `There is no ${fit} in this light!`); return true; }
      if (this.lit(g, L) && !m.worn.gloves) {
        sim.tell(m, 'warning', `You try to remove the light ${fit}, but you burn your hand on it!`);
        sim.hurt(m, 5, 'burn', 'light');
        return true;
      }
      sim.tell(m, 'notice', `You remove the light ${fit}.`);
      this.takeOut(m, this.item(L), g, L);
      this.setStatus(g, L, LIGHT.EMPTY);
      return true;
    }
    if (m.intent === 'harm') {                                        // hit it: take_damage -> prob(damage * 5) break_light_tube
      const force = Math.max(held.force || 3, 3);
      sim.chat.visible(m, `${m.name} hits the light with the ${held.name}.`, 'danger', 10, m);
      if (this.sim.rand() < Math.min(1, force * 5 / 100)) this.breakLight(g, L);
      else sim.sound('glass_hit', { grid: g, x: L.x, z: L.z }, 0.7);
      m.cool = 0.5;
      return true;
    }
    return false;
  }

  /** The glass comes out into the hand that is free, or onto the floor under the fixture. */
  takeOut(m, it, g, L) {
    const sim = this.sim;
    const hand = m.hands[m.active] ? (m.hands[1 - m.active] ? -1 : 1 - m.active) : m.active;
    if (hand >= 0) attach(sim, it, { t: 'hand', mob: m, i: hand });
    else place(sim, it, g, L.x, L.z, undefined, L.l | 0);
  }

  examine(g, L) {
    const fit = this.fitting(L), out = [`This is a light fixture.`];
    switch (L.status) {
      case LIGHT.OK: out.push(`It is turned ${this.lit(g, L) ? 'on' : 'off'}.`); break;
      case LIGHT.EMPTY: out.push(`The ${fit} has been removed.`); break;
      case LIGHT.BURNED: out.push(`The ${fit} is burnt out.`); break;
      default: out.push(`The ${fit} has been smashed.`);
    }
    return out;
  }
}

export { TILE, REACH };
