import { detach, putInHands } from './inventory.js';

const CAPACITY = 10;            // tank_dispenser.dm TANK_DISPENSER_CAPACITY
const PATH = { plasma: '/obj/item/tank/internals/plasma', oxygen: '/obj/item/tank/internals/oxygen' };

/**
 * The tank dispensers (tank_dispenser.dm): ten oxygen tanks and ten plasma tanks (the `/oxygen` one has no plasma, the `/plasma` one no oxygen). A console hands them out; a tank put
 * back is kept as it is and handed out again.
 */
export class Dispensers {
  constructor(sim) { this.sim = sim; }

  stock(it) {
    if (!it.stock) {
      const p = (it.path || '').replace(/^\//, '');
      it.stock = { oxygen: p.endsWith('/plasma') ? 0 : CAPACITY, plasma: p.endsWith('/oxygen') ? 0 : CAPACITY, back: { oxygen: [], plasma: [] } };
    }
    return it.stock;
  }

  click(c, m, it, held) {
    const sim = this.sim, s = this.stock(it);
    const kind = held?.def.plasmaTank ? 'plasma' : held && held.path.startsWith(PATH.oxygen) ? 'oxygen' : null;
    if (held && kind) {                                                    // attackby: a tank goes back
      if (s[kind] >= CAPACITY) sim.tell(m, 'notice', `The tank dispenser can't hold any more of the ${held.name}.`);
      else {
        detach(sim, held);
        s.back[kind].push(held);
        s[kind]++;
        sim.tell(m, 'notice', `You put the ${held.name} in the tank dispenser.`);
        sim.sound('pickup', it, 0.5);
      }
      return;
    }
    if (held) {
      if (held.def.tool === 'wrench' || m.intent === 'harm') return;
      sim.tell(m, 'notice', `The ${held.name} does not fit into the tank dispenser.`);
      return;
    }
    sim.terminals.open(c, 'dispenser', { it, grid: it.grid });
  }

  take(c, it, kind) {
    const sim = this.sim, s = this.stock(it), m = c.mob;
    if (!m || s[kind] <= 0) return;
    s[kind]--;
    putInHands(sim, m, s.back[kind].pop() ?? sim.newItem(PATH[kind]));
    sim.sound('pickup', it, 0.4);
  }

  console(c, t) {
    const it = t.ctx.it, s = this.stock(it);
    return {
      title: 'Tank Dispenser', live: true,
      html: `<span class="h">Tank dispenser</span>\n\nPlasma tanks     ${s.plasma}\nOxygen tanks     ${s.oxygen}`,
      buttons: [
        { label: `Plasma (${s.plasma})`, disabled: s.plasma <= 0, fn: () => this.take(c, it, 'plasma') },
        { label: `Oxygen (${s.oxygen})`, disabled: s.oxygen <= 0, fn: () => this.take(c, it, 'oxygen') },
      ],
    };
  }
}
