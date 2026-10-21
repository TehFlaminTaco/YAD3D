import { TILE } from '../shared/config.js';

const kindOf = (path) => {
  const p = (path || '').replace(/^\/?(obj\/)?/, '');
  if (p.startsWith('structure/reagent_dispensers/fueltank')) return 'fuel';
  if (p.startsWith('structure/reagent_dispensers/watertank')) return p.endsWith('/high') ? 'water+' : 'water';
  return null;
};

const MAX_FUEL = 20;                 // a welding tool's tank (weldingtool.dm max_fuel)
const WATER_PER_CHARGE = 5;          // the extinguisher holds 50 units of water (extinguisher.dm max_water); the game counts it in charges of five

/**
 * The tanks you fill things from (reagent_dispenser.dm): a fuel tank refills a welding tool (unless it is lit: "That was stupid of you", and the tank goes up), a water
 * tank an extinguisher. Each holds 1000 units (the high-capacity water tank 100000). A fuel tank that is shot, burnt or blown up goes up too (`boom`).
 */
export class Tanks {
  constructor(sim) { this.sim = sim; }

  isTank(it) { return !!kindOf(it.path); }
  isFuel(it) { return kindOf(it.path) === 'fuel'; }

  units(it) {
    if (it.units === undefined) it.units = kindOf(it.path) === 'water+' ? 100000 : 1000;
    return it.units;
  }

  click(m, it, held) {
    const sim = this.sim, kind = kindOf(it.path);
    if (!kind || it.gone) return false;
    if (kind === 'fuel' && held?.def.tool === 'welder') {
      if (this.units(it) <= 0) { sim.tell(m, 'warning', `The ${it.name} is out of fuel!`); return true; }
      if (held.lit) {
        sim.chat.visible(m, `${m.name} catastrophically fails at refilling their ${held.name}!`, 'danger', 12, m);
        sim.tell(m, 'danger', 'That was stupid of you.');
        this.boom(it);
        return true;
      }
      if (held.fuel >= MAX_FUEL) { sim.tell(m, 'warning', `Your ${held.name} is already full!`); return true; }
      const take = Math.min(MAX_FUEL - held.fuel, this.units(it));
      held.fuel += take; it.units -= take;
      sim.chat.visible(m, `${m.name} refills their ${held.name}.`, 'notice', 8, m);
      sim.tell(m, 'notice', `You refill the ${held.name}.`);
      sim.sound('spray', it, 0.5);
      m.dirty = true;
      return true;
    }
    if ((kind === 'water' || kind === 'water+') && held?.def.extinguisher) {
      const cap = held.def.charges;
      if (held.charges >= cap) { sim.tell(m, 'warning', `The ${held.name} is already full!`); return true; }
      const units = Math.min((cap - held.charges) * WATER_PER_CHARGE, this.units(it));
      if (units <= 0) { sim.tell(m, 'warning', `The ${it.name} is empty!`); return true; }
      held.charges = Math.min(cap, held.charges + units / WATER_PER_CHARGE);
      it.units -= units;
      sim.tell(m, 'notice', `The ${held.name} has been refilled by ${units} units.`);
      sim.sound('spray', it, 0.5);
      m.dirty = true;
      return true;
    }
    return false;
  }

  /** reagent_dispenser.dm fueltank boom: explosion(0, 1, 5, flame_range 5). The tank is gone. */
  boom(it) {
    const sim = this.sim, g = it.grid;
    it.gone = true;
    g.world.boxDrop(it);
    g.emit({ e: 'pg', i: it.idx });
    sim.explosion(g, it.x, it.z, { heavy: 1, light: 5, l: it.l | 0 });
  }

  /** The tank is hit hard (a shot, a blow): a fuel tank blows up. */
  damaged(it) { if (kindOf(it.path) === 'fuel' && !it.gone && this.units(it) > 0) this.boom(it); }

  examine(it) {
    const kind = kindOf(it.path);
    if (kind === 'fuel') return [this.units(it) > 0 ? 'A tank full of industrial welding fuel. Do not consume.' : 'It is empty.'];
    return [];
  }
}

export { TILE };
