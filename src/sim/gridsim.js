import { Grid } from '../shared/grid.js';
import { Power } from '../shared/power.js';
import { Atmos } from '../shared/atmos.js';
import { Nav } from '../shared/nav.js';
import { BuiltSet } from '../shared/built.js';
import { FireDoors } from './firedoors.js';

/**
 * A grid as the server runs it: the shared `Grid` (tiles, props, doors, pose) plus everything that is simulated per grid. Each grid has its own
 * air, its own power state and its own APCs, its own walking map, its own firelocks and its own list of what players have built on it,
 * and its own record of how its tiles changed since the round began (so a late joiner can catch up).
 */
export class GridSim extends Grid {
  constructor(sim, decoded, o) {
    super(decoded, sim.rects, o);
    this.sim = sim;
    const w = this.world;
    const apcAreas = this.props.interact.filter((it) => it.kind === 'wm' && it.sub === 'apc').map((it) => w.areaIdx[w.idx(it.c, it.r)]);
    this.power = new Power(w, apcAreas);
    this.power.onState = (s, prev) => sim.onPowerState(this, s, prev);
    this.atmos = new Atmos(w, this.power);
    this.nav = new Nav(w);
    this.firedoors = new FireDoors(sim, this);
    this.built = new BuiltSet(w);
    this.tileLog = [];                         // tile events since the round began, for late joiners
    this.deadPanes = [];                       // thin windows smashed or taken apart: [c, r, d]
  }

  /** Tell the sim an event happened on this grid (its events carry the grid's id). */
  emit(ev, scope) { return this.sim.emit({ g: this.id, ...ev }, scope); }
}
