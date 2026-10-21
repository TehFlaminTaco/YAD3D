import { S, TILE } from '../shared/config.js';
import { RECIPES, recipeFit, turnCW, DIR_NAME } from '../shared/pipedata.js';
import { esc } from '../shared/util.js';
import { detach, putInHands } from './inventory.js';

const LAYERS = [1, 2, 3];
const recipe = (id) => RECIPES.find((r) => r.id === id) || RECIPES[0];

/**
 * The pipe dispenser (`machinery/pipedispenser`, pipe_dispenser.dm) and the rapid pipe dispenser (`/obj/item/pipe_dispenser`, RPD.dm): where pipes come from. The big one hands out fittings
 * for the pipes and machines this game has (a layer to choose, a second to make a pipe, one and a half a meter) and takes them back (`You put the pipe fitting back into the pipe dispenser.`); the hand-held
 * one lays them: a click on a tile in Build mode puts the chosen pipe down there (half a second, `atmos_build_speed`), a click on a pipe or a pipe machine in Destroy mode takes it away
 * (`atmos_destroy_speed`: the same). Both come to `PipeFittings.put`, the same checks and the same words as a wrench on a fitting.
 */
export class PipeKit {
  constructor(sim) { this.sim = sim; }

  // ------------------------------------------------------------------ the big dispenser
  dstate(it) { return (it.pdisp ??= { ly: 2, wait: 0 }); }

  /** A click on the pipe dispenser (clickProp). */
  dispenserClick(c, m, it, held) {
    const sim = this.sim;
    if (held?.fit) {                                                       // attackby: a pipe or a meter goes back in
      detach(sim, held); sim.items.delete(held.id);
      sim.tell(m, 'notice', `You put the ${held.name} back into the ${it.name}.`);
      sim.sound('pickup', it, 0.4);
      return;
    }
    if (held) return;
    sim.terminals.open(c, 'portable', { machine: { console: () => this.dispenserConsole(c, it) }, grid: it.grid, name: it.name });
  }

  dispenserConsole(c, it) {
    const st = this.dstate(it), sim = this.sim, ready = it.anc && sim.time >= st.wait;
    return {
      title: 'Pipe Dispenser', live: true,
      html: `<span class="h">${esc(it.name)}</span>\n\nPIPING LAYER: <b>${st.ly}</b>${it.anc ? '' : '\n\n<span class="w">It is not bolted to the floor.</span>'}\n\nPipes and the machines for them: choose one.`,
      buttons: [
        { label: 'Layer --', disabled: st.ly <= LAYERS[0], fn: () => { st.ly = Math.max(LAYERS[0], st.ly - 1); } },
        { label: 'Layer ++', disabled: st.ly >= LAYERS[LAYERS.length - 1], fn: () => { st.ly = Math.min(LAYERS[LAYERS.length - 1], st.ly + 1); } },
        ...RECIPES.map((r) => ({ label: r.label, disabled: !ready || !recipeFit(it.grid.level, r, st.ly), fn: () => this.dispense(c, it, r) })),
      ],
    };
  }

  dispense(c, it, rec) {
    const sim = this.sim, m = c.mob, st = this.dstate(it), g = it.grid;
    if (!m || !it.anc || sim.time < st.wait) return;
    const fit = recipeFit(g.level, rec, st.ly);
    if (!fit) return;
    putInHands(sim, m, sim.pipefit.newFitting(g, fit));
    st.wait = sim.time + (rec.meter ? 1.5 : 1);
    sim.sound('pickup', it, 0.4);
  }

  // ------------------------------------------------------------------ the rapid pipe dispenser
  rpd(item) { return (item.rpd ??= { mode: 'build', id: recipe('pipe').id, ly: 2, d: S }); }

  /** attack_self on an RPD: its choices. */
  rpdOpen(m, item) {
    if (!m.client) return;
    this.sim.terminals.open(m.client, 'portable', { machine: { console: () => this.rpdConsole(item) }, grid: m.grid, name: item.name });
  }

  rpdConsole(item) {
    const st = this.rpd(item), sel = recipe(st.id);
    return {
      title: 'Rapid Pipe Dispenser', live: true,
      html: `<span class="h">Rapid Pipe Dispenser</span>\n\nMode      ${st.mode === 'build' ? 'Build' : 'Destroy'}\nSelected  ${esc(sel.label)}\nLayer     ${st.ly}\nFacing    ${DIR_NAME[st.d] ?? 'south'}`,
      buttons: [
        { label: `${st.mode === 'build' ? '> ' : ''}Build`, fn: () => { st.mode = 'build'; } },
        { label: `${st.mode === 'destroy' ? '> ' : ''}Destroy`, fn: () => { st.mode = 'destroy'; } },
        ...RECIPES.filter((r) => !r.fixed).map((r) => ({ label: `${st.id === r.id ? '> ' : ''}${r.label}`, fn: () => { st.id = r.id; st.d = r.d; st.mode = 'build'; } })),
        ...LAYERS.map((ly) => ({ label: `${st.ly === ly ? '> ' : ''}Layer ${ly}`, fn: () => { st.ly = ly; } })),
        { label: 'Turn', fn: () => { st.d = turnCW(st.d); } },
      ],
    };
  }

  /** A click with an RPD (Actions.click, before the target's own rules). Returns true if it was ours. */
  rpdClick(m, t, held) {
    const sim = this.sim, st = this.rpd(held), g = t.grid;
    let c, r, l = t.l | 0;
    if (t.k === 'floor') { c = t.c; r = t.r; } else if (t.k === 'prop') { c = t.it.c; r = t.it.r; l = t.it.l | 0; } else if (t.k === 'item') { c = t.rec.c; r = t.rec.r; l = t.rec.l | 0; } else return false;
    const w = g.world, i = w.idx(c, r, l), at = { grid: g, x: (c + 0.5) * TILE, z: (r + 0.5) * TILE, l };
    const near = () => m.held === held && sim.dist(m, at) < 4.8;
    if (st.mode === 'destroy') {
      const dev = t.k === 'prop' && t.it.mach && sim.pipefit.table(g)[(t.it.path || '').replace(/^\/?(obj\/)?/, '')] ? t.it.mach : null;
      const [slot] = dev ? [] : sim.pipefit.exposed(g, i);
      if (!dev && slot === undefined) return false;
      const byte = slot === undefined ? 0 : w.pipe[slot];
      sim.actions.startTimed(m, 'deconstructing', 0.5, () => near() && (dev ? dev.it.mach === dev && !dev.it.gone : w.pipe[slot] === byte), () => {
        if (dev) { dev.release?.(); g.pipenet.unadopt(dev); sim.removeProp(g, dev.it); } else g.pipenet.removePipe(slot);
        sim.sound('wrench', at, 0.6);
      }, 'wrench', { start: null });
      return true;
    }
    const fit = recipeFit(g.level, recipe(st.id), st.ly);
    if (!fit) return true;
    fit.d = st.d;
    sim.actions.startTimed(m, 'laying pipe', 0.5, near, () => {
      const why = sim.pipefit.put(g, c, r, l, fit);
      if (why) sim.tell(m, 'warning', why); else sim.sound('wrench', at, 0.6);
    }, 'wrench', { start: null });
    return true;
  }
}
