import { N, S, E, W, DV, OPP } from '../shared/config.js';
import { GAS_IDS, Mix, ONE_ATMOSPHERE, O2STANDARD, N2STANDARD, CELL_VOLUME, MINIMUM_HEAT_CAPACITY, molesAt, kpaOf } from '../shared/gases.js';
import { SHAPES, PIPE_SLOTS, PIPE_HIDDEN, JUNCTION_DIR } from '../shared/pipedata.js';
import { makeDevice } from './pipedev.js';

const PROCESS = 0.5;                                                   // seconds between one run of the air machinery and the next (SSair)
const norm = (p) => (p || '').replace(/^\/?(obj\/)?/, '');
const isHE = (kind) => kind === 'he' || kind === 'junction';

/**
 * A pipeline (datum_pipeline.dm): the pipes that are joined end to end, with the nodes of every machine that is on them. It is one volume of gas, its pipes' 35 litres an end; each machine node on it has
 * a volume of its own (`airs`), and `reconcile` shares the gas out between all of them by volume, as the DM does.
 */
export class Pipeline {
  constructor(id) {
    this.id = id;
    this.air = new Mix(0);
    this.slots = [];                                                   // its pipes (see PipeNet.slot)
    this.ports = [];                                                   // the machine nodes on it
    this.devs = new Set();
    this.update = true;                                                // its gas needs sharing out again (something took from it or gave to it)
  }
}

/**
 * The pipes and pipe machines of one grid (atmosphere machinery: `code/modules/atmospherics/machinery/`). A pipe is a byte in `world.pipe` for each of three piping layers; a machine is a prop with a
 * `Device` (pipedev.js). They are joined as `atmosinit` does it (each end looks at the tile beyond for something that opens back at it, on its own layer or on a layer adaptor), the joined ones
 * make pipelines, and every half second the pipelines share their gas out and the machines move some.
 */
export class PipeNet {
  constructor(sim, grid) {
    this.sim = sim; this.grid = grid; this.world = grid.world;
    this.n = this.world.n;
    this.devices = [];
    this.devAt = new Map();                                            // tile -> the machines on it
    this.lines = [];
    this.lineOf = new Int32Array(this.n * PIPE_SLOTS).fill(-1);        // the pipeline of each pipe (by slot)
    this.adj = new Map();                                              // slot -> what it joins: other slots, and machine ports
    this.acc = 0;
    this.t = 0;
    this.timers = [];                                                  // things that happen a little later (a valve that takes a second to turn)
    for (const it of grid.props.interact) {
      const path = norm(it.path);
      const dev = makeDevice(this, it, path);
      if (!dev) continue;
      this.devices.push(dev);
      const i = dev.i;
      if (!this.devAt.has(i)) this.devAt.set(i, []);
      this.devAt.get(i).push(dev);
      it.mach = dev;
    }
    this.link();
    this.assemble();
    for (const d of this.devices) d.start?.();
    this.charge();
    const controlled = this.devices.filter((d) => d.controlled);
    if (controlled.length) {                                           // the rooms' air is made by these now, and the air alarms speak to them
      const probes = new Map();
      for (const d of controlled) if (!probes.has(d.area)) probes.set(d.area, d.i);
      grid.atmos.real = true;
      grid.atmos.probes = probes;
    }
  }

  /**
   * The air supply starts charged. (In the DM the atmospherics pumps fill the distribution pipes in the first minutes of a round; here the shift starts with them full, as if they had been:
   * a room that is breached in the first minutes would otherwise have nothing to refill it.)
   */
  charge() {
    for (const line of this.lines) {
      if (![...line.devs].some((d) => d.isVent && d.controlled)) continue;
      const moles = molesAt(ONE_ATMOSPHERE, line.air.vol);
      line.air.g.o2 = moles * O2STANDARD; line.air.g.n2 = moles * N2STANDARD;
      line.update = true;
    }
  }

  /** An air alarm set a room's mode: every vent and scrubber in it that listens to the alarms does what the mode says. */
  applyMode(area, mode) {
    for (const d of this.devices) if (d.controlled && d.area === area) { d.applyMode(mode); d.touch(); }
  }

  /** The index of the pipe in slot `k` (0 to 3, see pipedata.js) of tile `i`: what `world.pipe`, `pipeCol` and `pipeLy` are indexed by. */
  slot(k, i) { return k * this.n + i; }
  tileOf(slot) { return slot % this.n; }
  layerOf(slot) { return this.world.pipeLy[slot]; }
  /** The slot of the pipe of piping layer `ly` on tile `i`, or -1. */
  slotAt(i, ly) {
    const w = this.world;
    for (let k = 0; k < PIPE_SLOTS; k++) if (w.pipe[this.slot(k, i)] && w.pipeLy[this.slot(k, i)] === ly) return this.slot(k, i);
    return -1;
  }

  /** Can what `x` is accept `t` joining it from direction `dxt`? Only the heat exchangers care (they join their own kind; a junction takes an ordinary pipe on its back and a heat-exchanger on its front). */
  heOk(x, dxt, t) {
    if (x.he === 'he') return isHE(t.he);
    if (x.he === 'junction') return OPP[dxt] === x.jdir ? !isHE(t.he) : isHE(t.he);
    return true;
  }

  /**
   * What `x` (a pipe or a machine node, on tile `i`, piping layer `x.ly`) finds when it looks out in direction `dir` (`atmosinit` / `connection_check`): the first thing on the tile beyond that opens back
   * towards it and is on its layer (or is a layer adaptor, which is on all of them): a pipe slot, a machine's port, or null.
   */
  find(i, dir, x) {
    const w = this.world, c = i % w.W, r = Math.floor(i / w.W), [dc, dr] = DV[dir];
    if (!w.inb(c + dc, r + dr)) return null;
    const t = w.idx(c + dc, r + dr), back = OPP[dir];
    for (let k = 0; k < PIPE_SLOTS; k++) {
      const s = this.slot(k, t), byte = w.pipe[s];
      if (!byte) continue;
      const sh = SHAPES[byte & 31];
      if (!(sh.mask & back)) continue;
      const T = { all: sh.kind === 'layer', ly: w.pipeLy[s], he: sh.kind, jdir: JUNCTION_DIR[byte & 31] };
      if (!(x.all || T.all || x.ly === T.ly)) continue;
      if (!this.heOk(x, dir, T) || !this.heOk(T, back, x)) continue;
      return s;
    }
    for (const dev of this.devAt.get(t) || []) {
      if (!(x.all || dev.ly === x.ly)) continue;
      const k = dev.nodeDirs().indexOf(back);
      if (k >= 0) return dev.ports[k];
    }
    return null;
  }

  edge(a, b) {
    for (const [p, q] of [[a, b], [b, a]]) {
      if (typeof p !== 'number') continue;
      let s = this.adj.get(p);
      if (!s) this.adj.set(p, s = new Set());
      s.add(q);
    }
  }

  /** Work out what every pipe end and every machine node joins. */
  link() {
    const w = this.world, n = this.n;
    this.adj.clear();
    for (const d of this.devices) d.nodes = d.ports.map(() => null);
    for (let k = 0; k < PIPE_SLOTS; k++) {
      for (let i = 0; i < n; i++) {
        const s = this.slot(k, i), byte = w.pipe[s];
        if (!byte) continue;
        const sh = SHAPES[byte & 31], x = { all: sh.kind === 'layer', ly: w.pipeLy[s], he: sh.kind, jdir: JUNCTION_DIR[byte & 31] };
        for (const dir of [N, S, E, W]) {
          if (!(sh.mask & dir)) continue;
          const nb = this.find(i, dir, x);
          if (nb !== null) this.edge(s, nb);
        }
      }
    }
    for (const dev of this.devices) {
      const dirs = dev.nodeDirs(), x = { all: false, ly: dev.ly, he: 'dev' };
      for (let k = 0; k < dirs.length; k++) {
        const nb = this.find(dev.i, dirs[k], x);
        dev.ports[k].link = nb;
        dev.nodes[k] = nb;
        if (typeof nb === 'number') this.edge(nb, dev.ports[k]);
      }
    }
  }

  /** Make the pipelines: each set of pipes and ports that are joined is one. `keep` has the gas (by slot) of the pipes that were there before, so a rebuilt network keeps what it held. */
  assemble(keep = null) {
    const w = this.world, n = this.n;
    this.lines = [];
    this.lineOf.fill(-1);
    for (const d of this.devices) { d.parents = d.ports.map(() => null); }
    const inLine = new Set();
    const grow = (start) => {
      const line = new Pipeline(this.lines.length);
      this.lines.push(line);
      let volume = 0;
      const todo = [start], seen = new Set([start]);
      while (todo.length) {
        const x = todo.pop();
        if (typeof x === 'number') {
          line.slots.push(x);
          this.lineOf[x] = line.id;
          volume += SHAPES[w.pipe[x] & 31].vol;
          if (keep?.has(x)) line.air.merge(keep.get(x));
          for (const y of this.adj.get(x) || []) if (!seen.has(y)) { seen.add(y); todo.push(y); }
        } else {
          line.ports.push(x); line.devs.add(x.dev);
          x.dev.parents[x.k] = line;
          inLine.add(x);
          if (x.link !== null && x.link !== undefined && !seen.has(x.link) && typeof x.link !== 'number') { seen.add(x.link); todo.push(x.link); }
        }
      }
      line.air.vol = volume;
      line.update = true;
    };
    for (let s = 0; s < n * PIPE_SLOTS; s++) if (w.pipe[s] && this.lineOf[s] < 0) grow(s);
    for (const d of this.devices) for (const p of d.ports) if (!inLine.has(p)) grow(p);
  }

  /** Share out the gas of the pipeline `start` and of everything open to it (an open valve, a connector with a machine on it): by volume, so every mixture is the same pressure (pipeline.dm reconcile_air). */
  reconcile(start) {
    const GL = [], PL = [start], seen = new Set([start]);
    for (let k = 0; k < PL.length; k++) {
      const P = PL[k];
      GL.push(P.air);
      for (const p of P.ports) GL.push(p.dev.airs[p.k]);
      for (const dev of P.devs) {
        if (dev.isValve && dev.on) for (const q of dev.parents) if (q && !seen.has(q)) { seen.add(q); PL.push(q); }
        if (dev.isConnector && dev.device) GL.push(dev.device.mix);
      }
    }
    let V = 0, E = 0, C = 0;
    const tot = {};
    for (const id of GAS_IDS) tot[id] = 0;
    for (const m of GL) { V += m.vol; for (const id of GAS_IDS) tot[id] += m.g[id]; const c = m.heatCapacity(); E += c * m.t; C += c; }
    if (V <= 0) return;
    for (const m of GL) { const f = m.vol / V; for (const id of GAS_IDS) m.g[id] = tot[id] * f; }
    if (C > MINIMUM_HEAT_CAPACITY) { const t = E / C; for (const m of GL) m.t = t; }                  // (and they are all at the temperature their heat makes)
  }

  /** What each pipe holds, by slot (its share of its pipeline's gas by volume): the gas a rebuilt network keeps (`assemble(keep)`). */
  snapshot() {
    const w = this.world, keep = new Map();
    for (const line of this.lines) {
      const tot = line.air.vol;
      if (!(tot > 0)) continue;
      for (const s of line.slots) {
        const vol = SHAPES[w.pipe[s] & 31].vol, m = new Mix(vol, {}, line.air.t);
        for (const id of GAS_IDS) m.g[id] = line.air.g[id] * vol / tot;
        keep.set(s, m);
      }
    }
    return keep;
  }

  /** The network changed (a machine put down or taken off): join everything again, keeping the gas the pipes hold. */
  rebuild() {
    const keep = this.snapshot();
    this.link();
    this.assemble(keep);
  }

  /** The slot a new pipe of piping layer `ly` goes in on tile `i`: its own layer's, or the fourth (a pipe that crosses another on the same layer); -1 if both are taken. */
  freeSlot(i, ly) {
    for (const k of [ly - 1, PIPE_SLOTS - 1]) if (k >= 0 && !this.world.pipe[this.slot(k, i)]) return this.slot(k, i);
    return -1;
  }

  /** A pipe in `slot` changed (laid or taken up): everyone is told, and the grid keeps it for whoever joins. */
  changed(slot) {
    const w = this.world, b = w.pipe[slot], c = w.pipeCol[slot], y = w.pipeLy[slot];
    this.grid.pipeLog.set(slot, [b, c, y]);
    this.grid.emit({ e: 'pipe', s: slot, b, c, y });
  }

  /** Lay a pipe of shape `code` (it lies under the floor tiles, as the DM's pipes do) on piping layer `ly`, colour `col`, on tile `i`. Returns its slot, or -1 if there is no room. */
  addPipe(i, ly, code, col = 0) {
    const s = this.freeSlot(i, ly);
    if (s < 0) return -1;
    const w = this.world;
    w.pipe[s] = code | PIPE_HIDDEN; w.pipeCol[s] = col; w.pipeLy[s] = ly;
    this.changed(s);
    this.rebuild();
    return s;
  }

  /** Take the pipe in `slot` away. What it held goes out into the room (`releaseAirToTurf`); the rest of its pipeline keeps its gas. */
  removePipe(slot) {
    const w = this.world, keep = this.snapshot(), held = keep.get(slot);
    keep.delete(slot);
    if (held) this.spill(this.tileOf(slot), held);
    w.pipe[slot] = 0; w.pipeCol[slot] = 0; w.pipeLy[slot] = 0;
    this.changed(slot);
    this.link();
    this.assemble(keep);
  }

  /** Let the gas of `mix` out into the room on tile `i`. */
  spill(i, mix) {
    const w = this.world, wh = w.W * w.H, rem = i % wh, kpa = {};
    for (const id of GAS_IDS) kpa[id] = kpaOf(mix.g[id], CELL_VOLUME);
    this.grid.atmos.addGases(rem % w.W, Math.floor(rem / w.W), kpa, Math.floor(i / wh), mix.t);
    mix.clear();
  }

  /** A prop record that came after the network was made (a machine fastened down): its device joins. Returns it, or null for a prop that is not a pipe machine. */
  adopt(it) {
    const dev = makeDevice(this, it, norm(it.path));
    if (!dev) return null;
    this.devices.push(dev);
    if (!this.devAt.has(dev.i)) this.devAt.set(dev.i, []);
    this.devAt.get(dev.i).push(dev);
    it.mach = dev;
    this.rebuild();
    dev.start?.();
    return dev;
  }

  /** A machine is taken off its pipes. */
  unadopt(dev) {
    const k = this.devices.indexOf(dev);
    if (k >= 0) this.devices.splice(k, 1);
    const at = this.devAt.get(dev.i);
    if (at) { const j = at.indexOf(dev); if (j >= 0) at.splice(j, 1); if (!at.length) this.devAt.delete(dev.i); }
    if (dev.it.mach === dev) dev.it.mach = null;
    this.rebuild();
  }

  /** The gas of the pipe on tile `i`, layer `ly`: its whole pipeline's (meters read it). */
  airAt(i, ly) { const s = this.slotAt(i, ly), l = s >= 0 ? this.lineOf[s] : -1; return l >= 0 ? this.lines[l].air : null; }

  later(sec, fn) { this.timers.push({ at: this.t + sec, fn }); }

  /** The pictures that are not the first (for a client that joins). */
  pv() { return this.devices.filter((d) => d.v !== 0).map((d) => [d.it.idx, d.v]); }

  update(dt) {
    this.t += dt;
    for (let k = this.timers.length - 1; k >= 0; k--) if (this.timers[k].at <= this.t) this.timers.splice(k, 1)[0].fn();
    this.acc += dt;
    while (this.acc >= PROCESS) {
      this.acc -= PROCESS;
      for (const line of this.lines) if (line.update) { line.update = false; this.reconcile(line); }
      for (const d of this.devices) d.process();
    }
  }
}
