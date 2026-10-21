import { N, S, E, W, OPP, TILE } from '../shared/config.js';
import { SHAPES, PIPE_SLOTS, fittingSpec, fixedDir, turnCW, FACE_INDEX, DIR_NAME } from '../shared/pipedata.js';
import { detach, place } from './inventory.js';
import { toolJob } from './tooljob.js';

const norm = (p) => (p || '').replace(/^\/?(obj\/)?/, '');

/** The directions a pipe machine of this path built facing `d` joins (unary: one; binary: both ends of its line; trinary: three). */
function nodeMask(path, d) {
  if (/\/trinary\//.test(path)) return OPP[d] | turnCW(d) | d;
  if (/\/binary\//.test(path)) return OPP[d] | d;
  return d;
}

/**
 * Pipe fittings (construction.dm, atmosmachinery.dm wrench_act): a wrench takes a pipe machine off its pipe, leaving a **fitting** (`/obj/item/pipe`, `/obj/item/pipe_meter`) that remembers what it was and
 * how it was set; the fitting is turned in the hand (`attack_self`: a quarter turn clockwise) and a wrench on it where it lies fastens it down on that tile, joining whatever pipes are there.
 * The pictures are the machine's own (`level.fittings[path]`, see tools/build_level.py).
 */
export class PipeFittings {
  constructor(sim) { this.sim = sim; }

  table(g) { return g.level.fittings || {}; }

  /** The fitting a machine becomes. */
  fitting(it, t) {
    const d = it.d ?? S;
    return this.sim.newItem(t.meter ? '/obj/item/pipe_meter' : '/obj/item/pipe', {
      name: t.meter ? 'meter' : `${t.n} fitting`,
      sprite: t.s[FACE_INDEX[d] ?? 0],
      fit: { p: norm(it.path), n: it.name, d, ly: it.ly, ...(it.mv && Object.keys(it.mv).length ? { mv: it.mv } : {}) },
    });
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

  /**
   * unsafe_pressure_release (atmosmachinery.dm): the user is thrown clear, away from the machine (a random way if they stand on it), `pressure / 250` tiles; a wall in the way stops them hard.
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
    item.sprite = t.s[FACE_INDEX[fit.d] ?? 0];
    m.dirty = true;
    this.sim.sound('pickup', m, 0.3);
  }

  /** A wrench on a fitting lying on the floor (clickItem): it is fastened down on its tile. Returns true if it was ours. */
  fasten(m, rec) {
    const item = rec.item, fit = item.fit;
    if (!fit) return false;
    const sim = this.sim, g = rec.grid, w = g.world, net = g.pipenet, t = this.table(g)[fit.p];
    if (!t) { sim.tell(m, 'warning', 'It does not fit anywhere here.'); return true; }
    const c = rec.c, r = rec.r, l = rec.l | 0, i = w.idx(c, r, l);
    const at = { grid: g, x: rec.x, z: rec.z, l };
    const done = (text) => {
      detach(sim, item); sim.items.delete(item.id);
      sim.sound('wrench', at, 0.8);
      sim.chat.visible(m, `${m.name} fastens ${t.meter ? 'the meter' : `the ${item.name}`}.`, 'notice', 10, m);
      sim.tell(m, 'notice', text);
    };
    if (t.meter) {                                                                      // pipe_meter wrench_act: on a pipe of its layer
      if (net.slotAt(i, fit.ly) < 0) { sim.tell(m, 'warning', 'You need to fasten it to a pipe!'); return true; }
      const [it] = sim.addProps(g, [fittingSpec(g.level, fit, c, r, l, S)]);
      net.adopt(it);
      done('You fasten the meter to the pipe.');
      return true;
    }
    const d = fixedDir(fit.p, fit.d), mask = nodeMask(fit.p, d);
    const here = net.devAt.get(i) || [];
    const single = (p) => /portables_connector/.test(p);                               // PIPING_ONE_PER_TURF: a connector wants the tile to itself
    if (here.some((x) => x.isConnector || single(x.path)) || (single(fit.p) && here.length)) { sim.tell(m, 'warning', 'Something is hogging the tile!'); return true; }
    for (const x of here) {                                                             // a machine already there, on the same layer, joining a way this one would
      if (x.ly === fit.ly && (nodeMask(x.path, x.d) & mask)) { sim.tell(m, 'warning', 'There is already a pipe at that location!'); return true; }
    }
    for (let k = 0; k < PIPE_SLOTS; k++) {                                              // and the pipes
      const s = net.slot(k, i), byte = w.pipe[s];
      if (!byte) continue;
      const sh = SHAPES[byte & 31];
      if ((w.pipeLy[s] === fit.ly || sh.kind === 'layer') && (sh.mask & mask)) { sim.tell(m, 'warning', 'There is already a pipe at that location!'); return true; }
    }
    const [it] = sim.addProps(g, [fittingSpec(g.level, fit, c, r, l, d)]);
    const dev = net.adopt(it);
    if (!dev) { sim.removeProp(g, it); sim.tell(m, 'warning', 'It does not fit anywhere here.'); return true; }
    if (!dev.isConnector) { dev.on = false; dev.touch(); }                              // a new one is off (a valve closed) until someone sets it going
    done(`You fasten the ${item.name}.`);
    return true;
  }

  describe(fit) { return `facing ${DIR_NAME[fit.d] ?? 'south'}`; }
}
