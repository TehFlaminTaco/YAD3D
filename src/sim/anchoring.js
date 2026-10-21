import { setPropAnchored } from '../shared/propdata.js';
import { toolJob } from './tooljob.js';

/**
 * What a wrench fastens to the floor or frees (`default_unfasten_wrench` in `code/game/machinery/_machinery.dm`, and the DM's own variants), by the path of the prop: the delay in
 * deciseconds, and for the ones that do not ask for a delay their own messages. Every type here is one whose attackby / wrench_act in the DM really takes a wrench with nothing
 * else needed (a vending machine, a washing machine or a computer wants its panel open first, a fuel tank cannot be wrenched at all: those are not here).
 */
const WRENCHABLE = [
  [/^machinery\/space_heater/, 20],
  [/^machinery\/power\/shieldwallgen/, 0],
  [/^machinery\/shieldgen/, 0, ['You secure %s to the floor!', 'You unsecure %s from the floor!']],      // shieldgen.dm attackby: its own words
  [/^structure\/tank_dispenser/, 20],
  [/^machinery\/food_cart/, 0],
  [/^machinery\/pipedispenser/, 40],
  [/^machinery\/chem_dispenser/, 20], [/^machinery\/chem_master/, 20], [/^machinery\/reagentgrinder/, 20],
  [/^machinery\/smartfridge/, 20], [/^machinery\/microwave/, 20], [/^machinery\/deepfryer/, 20], [/^machinery\/gibber/, 20],
  [/^machinery\/processor/, 20], [/^machinery\/monkey_recycler/, 20], [/^machinery\/recycler/, 20], [/^machinery\/seed_extractor/, 20],
  [/^machinery\/hydroponics\/constructable/, 20], [/^machinery\/photocopier/, 20], [/^machinery\/pdapainter/, 20], [/^machinery\/aug_manipulator/, 20],
  [/^machinery\/medical_kiosk/, 10], [/^machinery\/bookbinder/, 20], [/^machinery\/cell_charger/, 20],
];

const norm = (p) => (p || '').replace(/^\//, '');

/**
 * Bolting things down and freeing them. A prop is `anc` when it is bolted to the floor: it cannot be dragged and (if it has a body of its own) it fills its tile; free, it is a box
 * that can be dragged about. Machines with their own rules (emitters, collectors, portable pumps and scrubbers on their ports, the PACMAN) call `set` themselves.
 */
export class Anchoring {
  constructor(sim) { this.sim = sim; }

  /** Bolt `it` down or free it, and tell everyone (and whoever joins later). The machine, if it has one, is told too (`afterAnchor`). */
  set(g, it, on) {
    setPropAnchored(g.world, it, !!on);
    g.anchorLog.set(it.idx, it.anc ? 1 : 0);
    g.emit({ e: 'pa', i: it.idx, a: it.anc ? 1 : 0 });
    it.mach?.afterAnchor?.(!!it.anc);
  }

  /** The row of the table for a prop, if a wrench does something to it. */
  row(it) {
    if (it.kind !== 'prop' || it.gone) return null;
    const p = norm(it.path);
    return WRENCHABLE.find(([re]) => re.test(p)) || null;
  }

  /** Is `it` a thing that is held in place by bolts (so that a wrench could free it)? */
  wrenchable(it) { return !!this.row(it); }

  /** A wrench on a prop (clickProp, after the machine's own rules). Returns true if it was ours. */
  wrench(m, it, held) {
    const row = this.row(it);
    if (!row) return false;
    const sim = this.sim, g = it.grid, [, ds, words] = row;
    const the = `the ${it.name}`, anchoring = !it.anc;
    const done = () => {
      if (!!it.anc !== !anchoring) return;
      this.set(g, it, anchoring);
      sim.tell(m, 'notice', words ? words[anchoring ? 0 : 1].replace('%s', the) : `You ${anchoring ? '' : 'un'}secure ${the}.`);
      sim.sound('pickup', { grid: g, x: it.x, z: it.z, l: it.l | 0 }, 0.6);
    };
    if (!ds) {                                                                         // no delay: at once
      sim.sound('wrench', { grid: g, x: it.x, z: it.z, l: it.l | 0 }, 0.8);
      done();
      return true;
    }
    sim.tell(m, 'notice', `You begin ${anchoring ? '' : 'un'}securing ${the}...`);
    const th = { grid: g, x: it.x, z: it.z, l: it.l | 0, reach: 3.6, alive: () => !it.gone, state: () => (it.anc ? 1 : 0) };
    toolJob(sim, m, th, held, it.anc ? 1 : 0, { label: `${anchoring ? '' : 'un'}securing the ${it.name}`, ds, sfx: 'wrench', start: null, done });
    return true;
  }
}
