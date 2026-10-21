import { TILE, REACH } from '../shared/config.js';
import { LIGHT_WATTS } from '../shared/powerdata.js';
import { CH } from '../shared/power.js';
import { attach, place, consume } from './inventory.js';
import { toolJob } from './tooljob.js';

/**
 * A fixture's state (lighting.dm LIGHT_*): the glass in it, or not. The last three are a light fixture frame still being made (`light_construct` stage 1, an empty frame, and stage 2,
 * with its wire) and one that was taken down altogether.
 */
export const LIGHT = { OK: 0, EMPTY: 1, BROKEN: 2, BURNED: 3, FRAME1: 4, FRAME2: 5, GONE: 6 };

const isLight = (it) => !!it && it.path.startsWith('/obj/item/light/');
const isFrame = (it) => !!it && it.path.startsWith('/obj/item/wallframe/light_fixture');
const isCoil = (it) => !!it && it.path.startsWith('/obj/item/stack/cable_coil');
const the = (L) => `the ${L.status >= LIGHT.FRAME1 ? 'light fixture frame' : 'light fixture'}`;
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
    return L && L.status !== LIGHT.GONE ? { k: 'light', L, grid: g, l: L.l, x: L.x, z: L.z } : null;
  }

  /** A new fixture at tile (c, r), in `status`: it looks like the nearest of its kind and is told to everyone (and to whoever joins). Returns it. */
  add(g, kind, c, r, l, status) {
    let tpl = null, best = 1e9;
    for (const L of g.props.lights) {
      if (L.kind !== kind || !L.spec) continue;
      const d = Math.hypot(L.c - c, L.r - r);
      if (d < best) { tpl = L; best = d; }
    }
    if (!tpl) return null;
    this.sim.addProps(g, [{ ...tpl.spec, x: c, y: r, l }]);
    const L = g.props.lights[g.props.lights.length - 1];
    L.status = status;                                                // (nothing is drawn from the room until there is a lamp in it: no load to move)
    g.emit({ e: 'light', i: L.idx, st: status });
    return L;
  }

  /** A fixture frame in the hand goes on the wall that was clicked, standing in front of it (wallframe.dm try_build / attach); the fixture is the lamp up on the ceiling of the tile you stand on. */
  placeFrame(m, held, t) {
    if (!isFrame(held)) return false;
    const sim = this.sim, g = t.grid, w = g.world;
    const mc = Math.floor(m.x / TILE), mr = Math.floor(m.z / TILE), l = m.l | 0;
    if (Math.abs(mc - t.c) + Math.abs(mr - t.r) !== 1) { sim.tell(m, 'warning', `You cannot place ${held.name.startsWith('small') ? 'the small light fixture frame' : 'the light fixture frame'} on this spot!`); return true; }
    if (w.kind[w.idx(mc, mr, l)] !== 1 || w.solid[w.idx(mc, mr, l)]) { sim.tell(m, 'warning', `You cannot place the ${held.name} on this spot!`); return true; }
    if (g.props.lights.some((L) => L.status !== LIGHT.GONE && L.c === mc && L.r === mr && (L.l | 0) === l)) { sim.tell(m, 'warning', "There's already an item on this wall!"); return true; }
    const kind = held.path.endsWith('/small') ? 'bulb' : 'tube';
    if (!this.add(g, kind, mc, mr, l, LIGHT.FRAME1)) { sim.tell(m, 'warning', `You cannot place the ${held.name} on this spot!`); return true; }
    const L = g.props.lights[g.props.lights.length - 1];
    consume(sim, held);
    sim.sound('terminal_key', { grid: g, x: L.x, z: L.z, l }, 0.7);
    sim.chat.visible(m, `${m.name} attaches the ${held.name} to the wall.`, 'notice', 10, m);
    sim.tell(m, 'notice', `You attach the ${held.name} to the wall.`);
    return true;
  }

  /** The frame stages of light_construct.attackby, and the casing of an empty fixture being opened. Returns false if the click is not one of those. */
  clickFrame(m, g, L, held) {
    const sim = this.sim, fit = this.fitting(L), name = fit === 'bulb' ? 'small light fixture frame' : 'light fixture frame';
    const at = { grid: g, x: L.x, z: L.z, l: L.l | 0 }, tool = held?.def.tool;
    const say = (text, kind = 'notice') => sim.tell(m, kind, text);
    const others = (text) => sim.chat.visible(m, text, 'notice', 10, m);
    const th = { grid: g, x: L.x, z: L.z, l: L.l | 0, reach: 4.2, alive: () => L.status >= LIGHT.FRAME1 && L.status < LIGHT.GONE, state: () => L.status };
    if (L.status === LIGHT.FRAME1) {
      if (tool === 'wrench') {                                                      // deconstructing it: two sheets of metal (one for a small one)
        say(`You begin deconstructing the ${name}...`);
        toolJob(sim, m, th, held, L.status, {
          label: `deconstructing the ${name}`, ds: 30, sfx: 'wrench', start: null,
          done: () => {
            others(`${m.name} deconstructs the ${name}.`); say(`You deconstruct the ${name}.`);
            sim.stacks.spawn(g, '/obj/item/stack/sheet/metal', fit === 'bulb' ? 1 : 2, L.x, L.z);
            sim.sound('pickup', at, 0.75);
            this.setStatus(g, L, LIGHT.GONE);
          },
        });
        return true;
      }
      if (isCoil(held)) {
        if ((held.amount ?? 1) < 1) { say(`You need one length of cable to wire the ${name}!`, 'warning'); return true; }
        sim.floors.use(m, held, 1);
        others(`${m.name} adds wires to the ${name}.`); say(`You add wires to the ${name}.`);
        this.setStatus(g, L, LIGHT.FRAME2);
        return true;
      }
      return false;
    }
    if (L.status === LIGHT.FRAME2) {
      if (tool === 'wrench') { say('You have to remove the wires first!', 'warning'); return true; }
      if (tool === 'wirecutters') {
        this.setStatus(g, L, LIGHT.FRAME1);
        sim.stacks.spawn(g, '/obj/item/stack/cable_coil', 1, L.x, L.z);
        others(`${m.name} removes the wiring from the ${name}.`); say(`You remove the wiring from the ${name}.`);
        sim.sound('wirecutter', at, 0.9);
        return true;
      }
      if (tool === 'screwdriver') {                                                 // closing the casing: it is a fixture now, with nothing in it
        others(`${m.name} closes the ${name}'s casing.`); say(`You close the ${name}'s casing.`);
        sim.sound('screwdriver', at, 0.75);
        this.setStatus(g, L, LIGHT.EMPTY);
        return true;
      }
      return false;
    }
    return false;
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
    if (L.status >= LIGHT.FRAME1) return this.clickFrame(m, g, L, held);
    if (L.status === LIGHT.EMPTY && held?.def.tool === 'screwdriver') {              // attackby on an empty fixture: it comes apart as far as its wired frame
      sim.sound('screwdriver', { grid: g, x: L.x, z: L.z, l: L.l | 0 }, 0.75);
      sim.chat.visible(m, `${m.name} opens the light fixture's casing.`, 'notice', 10, m);
      sim.tell(m, 'notice', "You open the light fixture's casing.");
      this.setStatus(g, L, LIGHT.FRAME2);
      return true;
    }
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
    const fit = this.fitting(L), out = [fit === 'bulb' ? 'This is a small light fixture.' : 'This is a light fixture.'];
    if (L.status >= LIGHT.FRAME1) return [fit === 'bulb' ? 'This is a small light fixture frame.' : 'This is a light fixture frame.', 'A light fixture under construction.', L.status === LIGHT.FRAME1 ? "It's an empty frame." : "It's wired.", 'The casing has no power cell for backup power.'];
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
