import { N, S, E, W } from '../shared/config.js';
import { USE, norm } from '../shared/powerdata.js';
import { detach, place } from './inventory.js';
import { toolJob } from './tooljob.js';

const FACE = { [S]: 0, [N]: 1, [E]: 2, [W]: 3 };
const isBoard = (it) => !!it && it.path.startsWith('/obj/item/circuitboard');
const isCoil = (it) => !!it && it.path.startsWith('/obj/item/stack/cable_coil');
const isGlass = (it) => !!it && it.path === '/obj/item/stack/sheet/glass';

/**
 * Computer frames (buildandrepair.dm `frame/computer`) and the computers that come apart into them (`computer/deconstruct`). A frame is a prop made while the game runs, with `it.frame`:
 * `{kind: 'computer', state, circuit}`. States: 0 loose, 1 wrenched down (a board goes in), 2 the board screwed in (cable), 3 wired (glass), 4 glazed (a screwdriver connects the monitor, and it
 * is the computer the board makes). The boards are the game's `level.boards` (what each makes) and every computer of the map knows its own (`level.computerBoards`), so a computer can be
 * unscrewed back to a frame and built again; a new computer looks like one of its kind already on the station.
 */
export class Frames {
  constructor(sim) { this.sim = sim; }

  get level() { return this.sim.level; }

  /** The computer frame a stack recipe puts down at tile (c, r) turned to face `d` (and, from a computer taken apart, in a later `state` with its board). */
  buildComputer(g, c, r, d, o = {}) {
    const fr = this.level.frames?.computer;
    if (!fr) return null;
    const sv = fr[FACE[d] ?? 0];
    const spec = { k: 'sprite', x: c, y: r, l: o.l | 0, d, n: 'computer frame', p: 'structure/frame/computer', s: sv[0], sv, den: 1, anc: 0, bb: 1 };
    const [it] = this.sim.addProps(g, [spec]);
    it.frame = { kind: 'computer', state: 0, circuit: null };
    if (o.state) this.set(it, o.state);
    if (o.anchored) this.sim.anchoring.set(g, it, true);
    if (o.circuit) { it.frame.circuit = o.circuit; this.sim.items.set(o.circuit.id, o.circuit); o.circuit.loc = { t: 'frame' }; }
    return it;
  }

  /** The frame is in another state: everyone sees its picture change. */
  set(it, state) {
    it.frame.state = state;
    if ((it.pv | 0) !== state) { it.pv = state; it.grid.emit({ e: 'pv', i: it.idx, v: state }); }
  }

  /** The frames that are not in their first state (a joiner is told which picture, see Sim.gridState). */
  pv(g) { return g.props.interact.filter((it) => it.frame && !it.gone && it.frame.state).map((it) => [it.idx, it.frame.state]); }

  /** What a board makes, if there is such a computer on the station to copy. */
  template(g, board) {
    const info = this.level.boards?.[board];
    if (!info?.bp) return null;
    const tpl = g.props.interact.find((q) => q.spec && q.spec.p === info.bp && q.kind !== 'wm');
    return tpl ? { info, tpl } : null;
  }

  /** A computer's board (its path), if it has one. */
  boardOf(it) { return it.kind === 'prop' ? this.level.computerBoards?.[norm(it.path)] ?? null : null; }

  /** The power a computer draws goes on or off the room's load. */
  use(g, it, sign) {
    const row = USE.find(([prefix]) => norm(it.path).startsWith(prefix)), w = g.world;
    if (row) g.powersim.base[w.areaIdx[w.idx(it.c, it.r, it.l | 0)] * 3 + row[1]] += sign * row[2];
  }

  /** A click on a computer frame (clickProp). Returns true if it was ours. */
  click(m, it, held) {
    if (!it.frame || it.gone || !held) return false;
    const sim = this.sim, g = it.grid, f = it.frame, tool = held.def.tool;
    const at = { grid: g, x: it.x, z: it.z, l: it.l | 0 };
    const state = () => `${f.state}${it.anc ? 'a' : ''}${f.circuit ? 'c' : ''}`;
    const job = (label, ds, sfx, done, o = {}) => toolJob(sim, m, { grid: g, x: it.x, z: it.z, l: it.l | 0, reach: 3.6, alive: () => !it.gone, state }, held, state(), { label, ds, sfx, start: o.start ?? null, valid: o.valid, done });
    const say = (text, kind = 'notice') => sim.tell(m, kind, text);
    const drop = (path, n) => sim.stacks.spawn(g, path, n, it.x, it.z);
    switch (f.state) {
      case 0:
        if (tool === 'wrench') {
          say('You start wrenching the frame into place...');
          job('wrenching the frame into place', 20, 'wrench', () => { say('You wrench the frame into place.'); sim.anchoring.set(g, it, true); this.set(it, 1); });
          return true;
        }
        if (tool === 'welder') {
          if (!sim.actions.welderReady(m, held)) return true;
          say('You start deconstructing the frame...');
          job('deconstructing the frame', 20, 'welder', () => { say('You deconstruct the frame.'); drop('/obj/item/stack/sheet/metal', 5); sim.removeProp(g, it); }, { valid: () => held.lit });
          return true;
        }
        break;
      case 1:
        if (tool === 'wrench') {
          say('You start to unfasten the frame...');
          job('unfastening the frame', 20, 'wrench', () => { say('You unfasten the frame.'); sim.anchoring.set(g, it, false); this.set(it, 0); });
          return true;
        }
        if (isBoard(held) && !f.circuit) {
          if (!held.path.startsWith('/obj/item/circuitboard/computer') || !this.template(g, held.path)) { say('This frame does not accept circuit boards of this type!', 'warning'); return true; }
          detach(sim, held);
          held.loc = { t: 'frame' };
          f.circuit = held;
          sim.sound('pickup', at, 0.5);
          say(`You place the ${held.name} inside the frame.`);
          return true;
        }
        if (tool === 'screwdriver' && f.circuit) {
          sim.sound('screwdriver', at, 0.8);
          say(`You screw the ${f.circuit.name} into place.`);
          this.set(it, 2);
          return true;
        }
        if (tool === 'crowbar' && f.circuit) {
          sim.sound('crowbar', at, 0.8);
          say(`You remove the ${f.circuit.name}.`);
          this.dropBoard(it);
          return true;
        }
        break;
      case 2:
        if (tool === 'screwdriver') { sim.sound('screwdriver', at, 0.8); say('You unfasten the circuit board.'); this.set(it, 1); return true; }
        if (isCoil(held)) {
          if ((held.amount ?? 1) < 5) { say('You need five lengths of cable for the frame!', 'warning'); return true; }
          say('You start adding cables to the frame...');
          job('adding cables to the frame', 20, null, () => {
            if (f.state !== 2 || (held.amount ?? 1) < 5) return;
            sim.stacks.use(m, held, 5);
            say('You add cables to the frame.');
            this.set(it, 3);
          });
          return true;
        }
        break;
      case 3:
        if (tool === 'wirecutters') { sim.sound('wirecutter', at, 0.9); say('You remove the cables.'); drop('/obj/item/stack/cable_coil', 5); this.set(it, 2); return true; }
        if (isGlass(held)) {
          if ((held.amount ?? 1) < 2) { say('You need two sheets of glass for the frame!', 'warning'); return true; }
          sim.sound('pickup', at, 0.5);
          say('You start to put in the glass panel...');
          job('putting in the glass panel', 20, null, () => {
            if (f.state !== 3 || (held.amount ?? 1) < 2) return;
            sim.stacks.use(m, held, 2);
            say('You put in the glass panel.');
            this.set(it, 4);
          });
          return true;
        }
        break;
      case 4:
        if (tool === 'crowbar') { sim.sound('crowbar', at, 0.8); say('You remove the glass panel.'); drop('/obj/item/stack/sheet/glass', 2); this.set(it, 3); return true; }
        if (tool === 'screwdriver') { sim.sound('screwdriver', at, 0.8); say('You connect the monitor.'); this.finish(it); return true; }
        break;
      default: break;
    }
    return false;
  }

  /** The board comes out onto the floor. */
  dropBoard(it) {
    const f = it.frame, b = f.circuit;
    if (!b) return;
    f.circuit = null;
    this.sim.items.set(b.id, b);
    place(this.sim, b, it.grid, it.x, it.z, undefined, it.l | 0);
    if (f.state > 1) this.set(it, 1);
  }

  /** The monitor is connected: the frame is the computer its board makes. */
  finish(it) {
    const sim = this.sim, g = it.grid, f = it.frame, board = f.circuit;
    const made = board && this.template(g, board.path);
    if (!made) return;
    const { info, tpl } = made, c = it.c, r = it.r, d = it.d;
    sim.items.delete(board.id);
    sim.removeProp(g, it);
    const spec = { ...tpl.spec, x: c, y: r, l: it.l | 0, d, n: info.cn || tpl.spec.n, anc: 1 };
    const [comp] = sim.addProps(g, [spec]);
    if (comp) { comp.name = info.cn || comp.name; sim.anchoring.set(g, comp, true); this.use(g, comp, 1); }
  }

  /** A screwdriver on a computer (computer.dm screwdriver_act): it is unscrewed from the wall, to a frame with its board and glass in. Returns true if it was ours. */
  disconnect(m, it, held) {
    const sim = this.sim, g = it.grid, board = this.boardOf(it);
    if (!board || held?.def.tool !== 'screwdriver' || it.gone) return false;
    sim.tell(m, 'notice', 'You start to disconnect the monitor...');
    toolJob(sim, m, { grid: g, x: it.x, z: it.z, l: it.l | 0, reach: 3.6, alive: () => !it.gone, state: () => 1 }, held, 1, {
      label: 'disconnecting the monitor', ds: 20, sfx: 'screwdriver', start: null,
      done: () => {
        if (it.gone) return;
        const circuit = sim.newItem(board);
        this.use(g, it, -1);
        const c = it.c, r = it.r, d = it.d, l = it.l | 0;
        sim.removeProp(g, it);
        this.buildComputer(g, c, r, d, { l, state: 4, anchored: true, circuit });
        sim.tell(m, 'notice', 'You disconnect the monitor.');
      },
    });
    return true;
  }

  examine(it) {
    const f = it.frame;
    return [`This is a computer frame.`, f.state >= 1 && !f.circuit ? 'There is no circuit board in it.' : f.circuit ? `The ${f.circuit.name} is in it.` : ''].filter(Boolean);
  }
}
