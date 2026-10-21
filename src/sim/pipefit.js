import { S, OPP, TILE, KIND } from '../shared/config.js';
import { ONE_ATMOSPHERE } from '../shared/gases.js';
import { SHAPES, PIPE_SLOTS, fittingSpec, fixedDir, turnCW, pipeShape, pipeOfShape, isHidden, FACE_INDEX, DIR_NAME } from '../shared/pipedata.js';
import { detach, place } from './inventory.js';
import { toolJob } from './tooljob.js';

const norm = (p) => (p || '').replace(/^\/?(obj\/)?/, '');
const THERE = 'There is already a pipe at that location!';

/** The directions a pipe machine of this path built facing `d` joins (unary: one; binary: both ends of its line; trinary: three). */
function nodeMask(path, d) {
  if (/\/trinary\//.test(path)) return OPP[d] | turnCW(d) | d;
  if (/\/binary\//.test(path)) return OPP[d] | d;
  return d;
}

/**
 * Pipe fittings (construction.dm, atmosmachinery.dm wrench_act): a wrench takes a pipe machine (or a pipe) off its place, leaving a **fitting** (`/obj/item/pipe`, `/obj/item/pipe_meter`) that remembers what it
 * was and how it was set; the fitting is turned in the hand (`attack_self`: a quarter turn clockwise) and a wrench on it where it lies fastens it down on that tile, joining whatever pipes are there.
 * The pictures are the machine's own (`level.fittings[path]`, see tools/build_level.py); a pipe's fitting is `level.fittings['pipe/simple']` and so on. `fit` is `{p: that key, n, d, ly, mv}`.
 */
export class PipeFittings {
  constructor(sim) { this.sim = sim; }

  table(g) { return g.level.fittings || {}; }
  isPipe(fit) { return fit.p.startsWith('pipe/'); }

  /** The picture of a fitting `t` (a row of `level.fittings`) facing `d`. */
  faceSprite(t, d) { return Array.isArray(t.s) ? t.s[FACE_INDEX[d] ?? 0] : t.s[d] ?? Object.values(t.s)[0]; }

  /** A fitting item for `fit`. */
  newFitting(g, fit) {
    const t = this.table(g)[fit.p], meter = !!t.meter;
    return this.sim.newItem(meter ? '/obj/item/pipe_meter' : '/obj/item/pipe', { name: meter ? 'meter' : `${t.n} fitting`, sprite: this.faceSprite(t, fit.d), fit });
  }

  /** The fitting a machine becomes. */
  fitting(it, t) {
    const d = it.d ?? S;
    return this.newFitting(it.grid, { p: norm(it.path), n: it.name, d, ly: it.ly, ...(it.mv && Object.keys(it.mv).length ? { mv: it.mv } : {}) });
  }

  /** A wrench on a pipe machine (clickProp). Returns true if it was ours. */
  unfasten(m, it, held) {
    const dev = it.mach, g = it.grid;
    const t = this.table(g)[norm(it.path)];
    if (!dev || !t || it.gone || dev.it !== it) return false;
    const sim = this.sim, the = `the ${it.name}`;
    const refusal = dev.unwrenchRefusal?.();
    if (refusal) { sim.tell(m, 'warning', refusal); return true; }
    sim.tell(m, 'notice', `You begin to unfasten ${the}...`);                          // (a machine's own return_air() is its room's, so unlike a pipe it never blows back: atmosmachinery.dm wrench_act)
    const th = { grid: g, x: it.x, z: it.z, l: it.l | 0, reach: 3.6, alive: () => !it.gone && it.mach === dev, state: () => 1 };
    toolJob(sim, m, th, held, 1, {
      label: `unfastening the ${it.name}`, ds: t.meter ? 40 : 20, sfx: 'wrench', start: null,
      done: () => {
        if (it.gone || it.mach !== dev) return;
        sim.chat.visible(m, `${m.name} unfastens ${the}.`, 'notice', 10, m);
        sim.tell(m, 'notice', `You unfasten ${the}.`);
        const item = this.fitting(it, t);
        dev.release?.();
        g.pipenet.unadopt(dev);
        sim.removeProp(g, it);
        place(sim, item, g, it.x, it.z, undefined, it.l | 0);
      },
    });
    return true;
  }

  /** The pipes on tile `i` that can be seen (and so reached): not the ones under a floor tile. Highest piping layer first. */
  exposed(g, i) {
    const w = g.world, net = g.pipenet, out = [];
    for (let k = 0; k < PIPE_SLOTS; k++) {
      const s = net.slot(k, i), byte = w.pipe[s];
      if (!byte || !pipeOfShape(byte)) continue;
      if (isHidden(byte) && w.kind[i] === KIND.FLOOR && w.floorType(i)?.k !== 'plating') continue;
      out.push(s);
    }
    return out.sort((a, b) => w.pipeLy[b] - w.pipeLy[a]);
  }

  /** A wrench on a bit of floor with a pipe showing on it (`Actions.click`, a `floor` target). Returns true if it was ours. */
  takeUp(m, t, held) {
    const g = t.grid, w = g.world, net = g.pipenet, l = t.l | 0, i = w.idx(t.c, t.r, l);
    const [s] = this.exposed(g, i);
    if (s === undefined) return false;
    const sim = this.sim, byte = w.pipe[s], what = pipeOfShape(byte), tt = this.table(g)[`pipe/${what.kind}`];
    if (!tt) return false;
    const the = `the ${tt.n}`, x = (t.c + 0.5) * TILE, z = (t.r + 0.5) * TILE;
    const line = net.lines[net.lineOf[s]], room = g.atmos.isCell[i] ? g.atmos.cell(i).pressure() : 0;
    const pressure = (line?.air.pressure() ?? 0) - room;
    const unsafe = pressure > 2 * ONE_ATMOSPHERE;
    sim.tell(m, 'notice', `You begin to unfasten ${the}...`);
    if (unsafe) sim.tell(m, 'warning', `As you begin unwrenching ${the} a gush of air blows in your face... maybe you should reconsider?`);
    const th = { grid: g, x, z, l, reach: 3.6, alive: () => w.pipe[s] === byte, state: () => 1 };
    toolJob(sim, m, th, held, 1, {
      label: `unfastening the ${tt.n}`, ds: 20, sfx: 'wrench', start: null,
      done: () => {
        if (w.pipe[s] !== byte) return;
        sim.chat.visible(m, `${m.name} unfastens ${the}.`, 'notice', 10, m);
        sim.tell(m, 'notice', `You unfasten ${the}.`);
        if (unsafe) this.blowBack(m, { x, z }, pressure);                              // (before the pipe is gone: it is what the gas pushes out of)
        const ly = w.pipeLy[s], col = w.pipeCol[s];
        net.removePipe(s);
        const item = this.newFitting(g, { p: `pipe/${what.kind}`, n: tt.n, d: what.d, ly, ...(col ? { col } : {}) });
        place(sim, item, g, x, z, undefined, l);
      },
    });
    return true;
  }

  /**
   * unsafe_pressure_release (atmosmachinery.dm): the user is thrown clear, away from the pipe (a random way if they stand on it), `pressure / 250` tiles; a wall in the way stops them hard.
   */
  blowBack(m, it, pressure) {
    const sim = this.sim, w = m.grid.world;
    sim.chat.visible(m, `${m.name} is sent flying by pressure!`, 'danger', 12, m);
    sim.tell(m, 'danger', 'The pressure sends you flying!');
    let dx = Math.sign(m.x - it.x) * (Math.abs(m.x - it.x) >= Math.abs(m.z - it.z)), dz = Math.sign(m.z - it.z) * (Math.abs(m.z - it.z) > Math.abs(m.x - it.x));
    if (!dx && !dz) { const a = Math.floor(sim.rand() * 4) * Math.PI / 2; dx = Math.round(Math.cos(a)); dz = Math.round(Math.sin(a)); }
    const want = pressure / 250 * TILE, got = Math.min(want, w.raycast(m.x, m.z, dx, dz, want + 0.6, 'shot', m.l | 0) - 0.4);
    const hitWall = got < want - 1e-3, run = Math.max(0, got);
    m.x += dx * run; m.z += dz * run;
    sim.settleMob(m);
    m.dirty = true;
    m.stunned = Math.max(m.stunned, 1.5);
    if (hitWall) sim.hurt(m, Math.min(15, 3 + pressure / 150), 'brute', 'pressure');
  }

  /** attack_self on a fitting: a quarter turn clockwise (the picture follows). */
  rotate(m, item) {
    const fit = item.fit, t = this.table(m.grid)[fit.p];
    if (!t || t.meter) return;
    fit.d = turnCW(fit.d);
    item.sprite = this.faceSprite(t, fit.d);
    m.dirty = true;
    this.sim.sound('pickup', m, 0.3);
  }

  /** Is there room on tile `i` for a pipe machine of this kind (`path`) facing `d` on layer `ly`? Returns what is wrong with it, or null. (construction.dm wrench_act) */
  machineRefusal(g, i, path, d, ly) {
    const net = g.pipenet, w = g.world, mask = nodeMask(path, d), here = net.devAt.get(i) || [];
    const single = (p) => /portables_connector/.test(p);                               // PIPING_ONE_PER_TURF: a connector wants the tile to itself
    if (here.some((x) => x.isConnector || single(x.path)) || (single(path) && here.length)) return 'Something is hogging the tile!';
    for (const x of here) if (x.ly === ly && x.nodeDirs().reduce((a, b) => a | b, 0) & mask) return THERE;      // a machine already there, on the same layer, joining a way this one would
    for (let k = 0; k < PIPE_SLOTS; k++) {                                              // and the pipes
      const s = net.slot(k, i), byte = w.pipe[s];
      if (!byte) continue;
      const sh = SHAPES[byte & 31];
      if ((w.pipeLy[s] === ly || sh.kind === 'layer') && (sh.mask & mask)) return THERE;
    }
    return null;
  }

  /** Is there room on tile `i` for a pipe of shape `code` on layer `ly`? */
  pipeRefusal(g, i, code, ly) {
    const net = g.pipenet, w = g.world, mask = SHAPES[code].mask;
    for (const x of net.devAt.get(i) || []) if (x.ly === ly && x.nodeDirs().reduce((a, b) => a | b, 0) & mask) return THERE;
    for (let k = 0; k < PIPE_SLOTS; k++) {
      const s = net.slot(k, i), byte = w.pipe[s];
      if (!byte) continue;
      const sh = SHAPES[byte & 31];
      if ((w.pipeLy[s] === ly || sh.kind === 'layer') && (sh.mask & mask)) return THERE;
    }
    return net.freeSlot(i, ly) < 0 ? THERE : null;
  }

  /**
   * Put what `fit` describes on tile (c, r) of deck `l` of grid `g`: a pipe is laid, a machine is built and joined (off), a meter goes on its pipe. Returns the message of what stops it, or null when it is done.
   * (A fitting fastened with a wrench, and the rapid pipe dispenser, both come here.)
   */
  put(g, c, r, l, fit) {
    const sim = this.sim, w = g.world, net = g.pipenet, i = w.idx(c, r, l), t = this.table(g)[fit.p];
    if (!t) return 'It does not fit anywhere here.';
    if (this.isPipe(fit)) {
      const code = pipeShape(fit.p.slice(5), fit.d), why = this.pipeRefusal(g, i, code, fit.ly);
      if (why) return why;
      return net.addPipe(i, fit.ly, code, fit.col || 0) < 0 ? THERE : null;
    }
    if (t.meter) {                                                                      // pipe_meter wrench_act: on a pipe of its layer
      if (net.slotAt(i, fit.ly) < 0) return 'You need to fasten it to a pipe!';
      const [it] = sim.addProps(g, [fittingSpec(g.level, fit, c, r, l, S)]);
      net.adopt(it);
      return null;
    }
    const d = fixedDir(fit.p, fit.d), why = this.machineRefusal(g, i, fit.p, d, fit.ly);
    if (why) return why;
    const [it] = sim.addProps(g, [fittingSpec(g.level, fit, c, r, l, d)]);
    const dev = net.adopt(it);
    if (!dev) { sim.removeProp(g, it); return 'It does not fit anywhere here.'; }
    if (!dev.isConnector) { dev.on = false; dev.touch(); }                              // a new one is off (a valve closed) until someone sets it going
    return null;
  }

  /** A wrench on a fitting lying on the floor (clickItem): it is fastened down on its tile. Returns true if it was ours. */
  fasten(m, rec) {
    const item = rec.item, fit = item.fit;
    if (!fit) return false;
    const sim = this.sim, g = rec.grid, l = rec.l | 0;
    const at = { grid: g, x: rec.x, z: rec.z, l };
    const why = this.put(g, rec.c, rec.r, l, fit);
    if (why) { sim.tell(m, 'warning', why); return true; }
    const meter = !!this.table(g)[fit.p]?.meter;
    detach(sim, item); sim.items.delete(item.id);
    sim.sound('wrench', at, 0.8);
    sim.chat.visible(m, `${m.name} fastens ${meter ? 'the meter' : `the ${item.name}`}.`, 'notice', 10, m);
    sim.tell(m, 'notice', meter ? 'You fasten the meter to the pipe.' : `You fasten the ${item.name}.`);
    return true;
  }

  describe(fit) { return `facing ${DIR_NAME[fit.d] ?? 'south'}`; }
}

