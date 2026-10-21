import { TICK, LIGHT_WATTS, USE, norm, SUN_STEP_DEG, SUN_PERIOD } from '../../shared/powerdata.js';
import { CH } from '../../shared/power.js';
import { KIND } from '../../shared/config.js';
import { Cables } from './powernet.js';
import { Apc, Smes, Solar, Tracker, SolarControl, Pacman, Terminal } from './machines.js';
import { EngineSim, Emitter, Collector, Supermatter } from './engine.js';

const CELL_OF = { 'five_k': 'upgraded/plus', 'ten_k': 'high', 'fifteen_k': 'high/plus' };

/** The sun (sun.dm): it starts anywhere, goes round at between half and twice 6 degrees a minute, one way or the other. */
export class Sun {
  constructor(rand) {
    this.azimuth = Math.floor(rand() * 360);
    this.mod = Math.round((0.5 + rand() * 1.5) * 100) / 100 * (rand() < 0.5 ? -1 : 1);
    this.acc = 0;
  }
  update(dt) {
    this.acc += dt;
    while (this.acc >= SUN_PERIOD) {
      this.acc -= SUN_PERIOD;
      this.azimuth = ((this.azimuth + this.mod * SUN_STEP_DEG) % 360 + 360) % 360;
    }
  }
}

/**
 * The power of one grid as the server runs it: its cable networks, the machines on them (APCs, SMES, generators), and what each room draws. `update(dt)` runs a power tick
 * every 2 s: generators and the engine add to their networks, every APC reads its room's load and takes it, the SMES store the spare, and each network is reset.
 * What the rooms are told is in `grid.power` (an AreaPower), which clients are sent too.
 */
export class PowerSim {
  constructor(sim, grid) {
    this.sim = sim;
    this.grid = grid;
    this.world = grid.world;
    this.power = grid.power;
    this.cables = new Cables(this.world);
    this.acc = 0;
    this.engine = new EngineSim(this);                     // the supermatter engine: emitters, its reflectors, the crystal, the collectors (engine.js)
    this.machines = { apc: [], smes: [], solar: [], tracker: [], solarControl: [], pacman: [], collector: [], terminal: [], emitter: [], supermatter: [] };
    this.base = new Float32Array(this.world.areas.length * 3);        // what each room draws on each channel when all of it is on
    this.changed = new Set();
    if (grid.kind === 'station') this.build();
  }

  // ------------------------------------------------------------------ building it from the map
  build() {
    const w = this.world, g = this.grid, M = this.machines, areas = w.areas;
    const add = (kind, m, it) => { M[kind].push(m); if (it) it.mach = m; return m; };
    for (const p of g.props.machines) {
      if (p.t === 'terminal') add('terminal', new Terminal(this, p.i, p));
      else if (p.t === 'solar') add('solar', new Solar(this, p.i, p));
      else if (p.t === 'tracker') add('tracker', new Tracker(this, p.i, p));
    }
    for (const it of g.props.interact) {
      const i = w.idx(it.c, it.r, it.l | 0), path = norm(it.path);
      if (it.kind === 'wm' && it.sub === 'apc') {
        const ai = it.as ? areas.findIndex((a) => a.p === it.as) : -1;
        const m = add('apc', new Apc(this, i, it, ai >= 0 ? ai : w.areaIdx[i], CELL_OF[path.split('/').pop()] || 'upgraded'), it);
        m.name = it.name;
      } else if (path.startsWith('machinery/power/smes')) {
        const capacity = it.sk ?? 3.33e6;                                          // five empty high-capacity cells (smes.dm RefreshParts: 50000 / 15000 x 1e6)
        const charge = it.sc ?? (path.endsWith('engineering') ? 1.5e6 : 0);        // smes.dm:424: engineering starts with some charge
        add('smes', new Smes(this, i, it, { capacity, charge }), it);
      } else if (path.startsWith('machinery/power/port_gen/pacman')) add('pacman', new Pacman(this, i, it), it);
      else if (path.startsWith('machinery/power/rad_collector')) add('collector', new Collector(this, i, it), it);
      else if (path.startsWith('machinery/power/emitter')) add('emitter', new Emitter(this, i, it), it);
      else if (path.startsWith('machinery/power/supermatter_crystal')) add('supermatter', new Supermatter(this, i, it), it);
      else if (path === 'machinery/power/solar_control') add('solarControl', new SolarControl(this, i, it), it);
    }
    // an SMES finds its terminal on a tile beside it that faces it (smes.dm Initialize); with none it is broken
    const terminals = new Map(M.terminal.map((t) => [t.tile, t]));
    const DV = { 1: [0, -1], 2: [0, 1], 4: [1, 0], 8: [-1, 0] }, OPP = { 1: 2, 2: 1, 4: 8, 8: 4 };
    for (const s of M.smes) {
      for (const d of [1, 2, 4, 8]) {
        const t = terminals.get(w.idx(s.c + DV[d][0], s.r + DV[d][1]));
        if (t && t.dir === OPP[d]) { s.termTile = t.tile; this.cables.block(s.tile, t.tile); break; }       // (its cable does not join its terminal's)
      }
      if (s.termTile < 0) s.broken = true;
    }
    // what each room draws: its lamps, and the machines in it that use power
    const base = this.base;
    for (const L of g.props.lights) base[L.area * 3 + CH.LIGHT] += LIGHT_WATTS[L.kind] ?? 80;
    for (const it of g.props.interact) {
      const path = norm(it.path);
      const row = USE.find(([prefix]) => path.startsWith(prefix));
      if (row) base[w.areaIdx[w.idx(it.c, it.r, it.l | 0)] * 3 + row[1]] += row[2];
    }
    for (let a = 0; a < areas.length; a++) this.power.metered[a] = areas[a].c === 'space' ? 0 : 1;
    this.assign();
    for (let k = 0; k < 3; k++) this.tick(true);          // a few ticks before anybody looks: the first has no supply to read
  }

  /** The networks are (re)made: tell each what SMES put power on it, and each solar control what panels it turns. */
  assign() {
    if (this.cables.dirty) this.cables.rebuild();
    for (const net of this.cables.nets.values()) net.smes = [];
    for (const s of this.machines.smes) { const n = s.net; if (n && !s.broken) n.smes.push(s); }
    for (const c of this.machines.solarControl) { c.panels = []; c.tracker = null; }
    const byNet = new Map(this.machines.solarControl.map((c) => [c.net?.id, c]));
    for (const s of this.machines.solar) { s.control = byNet.get(s.net?.id) || null; if (s.control) s.control.panels.push(s); }
    for (const t of this.machines.tracker) { const c = byNet.get(t.net?.id); if (c) c.tracker = t; }
  }

  // ------------------------------------------------------------------ what rooms draw
  /** [equipment, lighting, environment] watts room `a` draws now: what is on in it, on the channels that are on. */
  areaUse(a) {
    const b = this.base, p = this.power, out = [0, 0, 0];
    if (p.powered(a, CH.EQUIP)) out[0] = b[a * 3];
    if (p.powered(a, CH.LIGHT) && p.lightSwitch[a] === 1) out[1] = b[a * 3 + 1];
    if (p.powered(a, CH.ENVIRON)) out[2] = b[a * 3 + 2];
    return out;
  }

  /** An APC's word about a room: store it, and note it to be sent. */
  setArea(a, op, eq, li, en, mn, force = false) {
    if (this.power.set(a, op, eq, li, en, mn) || force) this.changed.add(a);
  }

  /** The wall switch of room `a`. */
  setSwitch(a, on) {
    this.power.lightSwitch[a] = on ? 1 : 0;
    this.changed.add(a);
    this.flush();
  }

  /** Tell the clients about every room whose power changed. */
  flush() {
    for (const a of this.changed) this.grid.emit(this.areaEvent(a));
    this.changed.clear();
  }

  areaEvent(a) {
    const p = this.power, b = a * 3;
    return { e: 'area', a, op: p.operating[a], ch: [p.chan[b], p.chan[b + 1], p.chan[b + 2]], mn: p.main[a], sw: p.lightSwitch[a] };
  }

  // ------------------------------------------------------------------ the tick
  update(dt) {
    for (const s of this.machines.supermatter) s.update(dt);                     // (its final countdown counts seconds)
    if (!this.machines.apc.length && !this.machines.smes.length) return;
    this.acc += dt;
    let n = 0;
    while (this.acc >= TICK && n++ < 3) { this.acc -= TICK; this.tick(); }
    if (this.acc > TICK) this.acc = 0;
  }

  tick(quiet = false) {
    const M = this.machines;
    if (this.cables.dirty) this.assign();
    for (const c of M.solarControl) { c.update(TICK); c.lastGen = c.gen; c.gen = 0; }
    for (const s of M.solar) s.process();
    for (const g of M.pacman) g.process();
    for (const e of M.emitter) e.process();
    for (const s of M.supermatter) s.process();
    for (const c of M.collector) c.process();
    for (const a of M.apc) a.process();
    for (const s of M.smes) s.process();
    for (const net of this.cables.nets.values()) net.reset(TICK);
    if (!quiet) this.flush();
    else this.changed.clear();
  }

  /** Something blows up at tile (c, r): the cables within `radius` tiles are cut, the nearer the likelier. Returns how many. */
  blast(c, r, radius, l = 0) {
    const w = this.world;
    let n = 0;
    for (let dr = -radius; dr <= radius; dr++) for (let dc = -radius; dc <= radius; dc++) {
      const d = Math.hypot(dc, dr);
      if (d > radius || !w.inb(c + dc, r + dr, l)) continue;
      const i = w.idx(c + dc, r + dr, l);
      if (w.cable[i] === 1 && this.sim.rand() < 1 - d / (radius + 1) * 0.7) {
        this.cables.set(i, false);
        this.grid.emit({ e: 'cable', i, on: 0 });
        n++;
      }
    }
    let wrecked = 0;
    for (const a of this.machines.apc) {                                          // (an APC in a wall the blast reaches is wrecked: set_broken)
      const d = Math.hypot(a.c - c, a.r - r);
      if (d <= radius - 1 && (a.rec.l | 0) === l && this.sim.rand() < 0.6 - d * 0.15 && a.setBroken()) wrecked++;
    }
    if (n && !wrecked) this.sim.sound('sparks', { grid: this.grid, x: c * 2 + 1, z: r * 2 + 1 }, 0.9);
    return n;                                                                     // (the cables it cut)
  }

  // ------------------------------------------------------------------ what the rest of the game asks
  /** How the station's power stands: normal, degraded (some room is short or on its cell), or out (most are dark). */
  status() {
    const apcs = this.machines.apc;
    if (!apcs.length) return 'normal';
    const p = this.power;
    let live = 0, good = 0;
    for (const a of apcs) {
      if (p.powered(a.areaIdx, CH.LIGHT) && p.powered(a.areaIdx, CH.EQUIP)) live++;
      if (a.main === 2 && a.chan.every((v) => v >= 2) && a.operating && !a.alarm) good++;
    }
    if (live < apcs.length * 0.25) return 'out';
    return good >= apcs.length * 0.9 ? 'normal' : 'degraded';
  }

  /** The APC controlling room `a`, if there is one. */
  apcOf(a) { return this.machines.apc.find((x) => x.areaIdx === a) || null; }

  /** The welcome's word about every room's power. */
  state() {
    const p = this.power;
    return { mt: [...p.metered], op: [...p.operating], ch: [...p.chan], mn: [...p.main], sw: [...p.lightSwitch] };
  }
}

export { KIND };
