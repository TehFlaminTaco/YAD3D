import { Grid } from '../shared/grid.js';
import { AreaPower } from '../shared/power.js';
import { PowerSim } from './power/powersim.js';
import { Atmos } from '../shared/atmos.js';
import { Nav } from '../shared/nav.js';
import { BuiltSet } from '../shared/built.js';
import { FireDoors } from './firedoors.js';
import { AtmosDevices } from './atmosdev.js';

/**
 * A grid as the server runs it: the shared `Grid` (tiles, props, doors, pose) plus everything that is simulated per grid. Each grid has its own
 * air, its own power (cables, networks, APCs), its own walking map, its own firelocks and its own list of what players have built on it,
 * and its own record of how its tiles changed since the round began (so a late joiner can catch up).
 */
export class GridSim extends Grid {
  constructor(sim, decoded, o) {
    super(decoded, sim.rects, o);
    this.sim = sim;
    const w = this.world;
    this.anchorLog = new Map();                 // props bolted down or loose since the map made them: idx -> 1 or 0 (a joiner is told)
    this.power = new AreaPower(w, false);       // what each room is told about its power (the station's rooms are metered by their APCs: see PowerSim)
    this.powersim = new PowerSim(sim, this);    // the cables, the networks and the machines on them
    this.atmos = new Atmos(w, this.power);
    this.nav = new Nav(w);
    this.firedoors = new FireDoors(sim, this);
    this.atmosdev = new AtmosDevices(sim, this);   // the canisters, pumps and scrubbers standing about, and the air alarms
    this.built = new BuiltSet(w);
    this.tileLog = [];                         // tile events since the round began, for late joiners
    this.deadPanes = [];                       // thin windows smashed or taken apart: [c, r, d]
  }

  /** Tell the sim an event happened on this grid (its events carry the grid's id). */
  emit(ev, scope) { return this.sim.emit({ g: this.id, ...ev }, scope); }
}
