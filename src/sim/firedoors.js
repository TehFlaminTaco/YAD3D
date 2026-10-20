import { TILE } from '../shared/config.js';

/** Firelocks: slam shut when the pressure differs across them (breach) or a fire alarm is pulled. */
export class FireDoors {
  constructor(sim, grid) {
    this.sim = sim;
    this.grid = grid;
    this.acc = 0;
    this.alarmUntil = 0;
    this.list = grid.props.fdoors.map((p, idx) => ({
      idx, grid, c: p.x, r: p.y, l: p.l | 0, i: grid.world.idx(p.x, p.y, p.l | 0), x: p.x * TILE + 1, z: p.y * TILE + 1,
      closed: false, hold: 0, calm: 0, name: p.n || 'firelock',
    }));
  }

  pressure(c, r, fallback, l = 0) {
    const { world, atmos } = this.grid;
    if (!world.inb(c, r, l)) return fallback;
    const i = world.idx(c, r, l);
    if (atmos.isCell[i]) return atmos.pressureAt(c, r, l);
    const k = world.kind[i];
    return (k === 0 || k === 3) && !world.airBlock[i] ? 0 : fallback;
  }

  differential(f) {
    const here = this.grid.atmos.pressureAt(f.c, f.r, f.l);
    const pe = this.pressure(f.c + 1, f.r, here, f.l), pw = this.pressure(f.c - 1, f.r, here, f.l);
    const pn = this.pressure(f.c, f.r - 1, here, f.l), ps = this.pressure(f.c, f.r + 1, here, f.l);
    return Math.max(Math.abs(pe - pw), Math.abs(pn - ps));
  }

  setClosed(f, v) {
    if (f.closed === v) return;
    const { world } = this.grid;
    f.closed = v;
    const d = world.doorAt.get(f.i);
    if (v) { world.solid[f.i] = 1; world.airBlock[f.i] = 1; }
    else { world.solid[f.i] = d && !d.passable ? 1 : 0; world.airBlock[f.i] = d && !d.isOpen ? 1 : 0; }
    this.grid.emit({ e: 'fdoor', i: f.idx, c: v ? 1 : 0 });
    this.sim.sound(v ? 'door_close' : 'door_open', f, 0.7);
  }

  fireAlarm(sec = 45) { this.alarmUntil = this.sim.time + sec; }

  update(dt) {
    this.acc += dt;
    if (this.acc < 0.4) return;
    const step = this.acc;
    this.acc = 0;
    const sim = this.sim;
    const alarm = sim.time < this.alarmUntil;
    const near = [...sim.clients.values()];
    for (const f of this.list) {
      let active = f.closed;
      if (!active) for (const c of near) if (sim.dist(c.at, f) < 80) { active = true; break; }
      if (!active) continue;
      f.hold = Math.max(0, f.hold - step);
      const diff = this.differential(f);
      if (!f.closed) { if (f.hold <= 0 && (diff > 14 || alarm)) this.setClosed(f, true); }
      else if (diff < 4 && !alarm) { f.calm += step; if (f.calm > 4) { this.setClosed(f, false); f.calm = 0; } } else f.calm = 0;
    }
  }

  manualOpen(f, mob) {
    if (this.differential(f) > 8) { this.sim.tell(mob, 'warning', 'The firelock is blocked by a pressure differential and will not open.'); return false; }
    this.setClosed(f, false);
    f.hold = 9;
    this.alarmUntil = 0;
    return true;
  }
}
