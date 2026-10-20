import { TILE } from '../shared/config.js';
import { WS, WINDOWS, DECON_SPEED, GLASS_PER_WINDOW, WELD_REPAIR, HEAT_BOLTS, BOLTS_COOL, PLACE_WINDOW, SHEET_TO_WINDOW } from '../shared/windows.js';
import { place, consume } from './inventory.js';
import { toolJob } from './tooljob.js';

const PANE_HP = 25;

/**
 * Taking windows and grilles apart and putting them back, the way window.dm and grille.dm do it (tgstation 2d6c10c1).
 *
 * A window and its grille are separate things. A window is a whole glass tile (target `window`) or a thin pane on a tile edge (`pane`);
 * when its glass is gone (smashed or taken apart) the tile is a `breach` record: the grille may still stand on it (it blocks you
 * until you cut it), or it has been cut and the tile is open floor. Nothing is named "broken window": that was never an object.
 *
 * Messages are window.dm's, with `[src]` as "the window" and `\the [I]` as "the screwdriver". Delays are its deciseconds.
 */
export class Windows {
  constructor(sim) { this.sim = sim; this.timers = []; }

  update() {
    const now = this.sim.time;
    for (let k = this.timers.length - 1; k >= 0; k--) if (this.timers[k].at <= now) { const t = this.timers.splice(k, 1)[0]; t.fn(); }
  }

  // ------------------------------------------------------------------ what a click means
  /** The window behind a target record, with accessors that hide the tile / pane difference; null if it is gone. */
  thing(t) {
    const sim = this.sim, w = sim.world;
    if (t.k === 'window') {
      const i = t.r * w.W + t.c;
      if (!w.glass[i]) return null;
      const info = WINDOWS[w.windowKey(i)] || WINDOWS.window;
      return {
        k: 'window', c: t.c, r: t.r, i, info, name: info.name, amount: GLASS_PER_WINDOW, x: t.c * TILE + 1, z: t.r * TILE + 1, reach: 4.8,
        alive: () => !!w.glass[i], ws: () => w.ws[i], hp: () => w.hp.get(i) ?? info.hp, maxHp: info.hp,
        setState: (st, anchored) => { w.setWindowState(i, st, anchored); sim.tileChanged(t.c, t.r); },
        heal: () => w.hp.set(i, info.hp),
        remove: () => { w.setBreach(t.c, t.r); sim.tileChanged(t.c, t.r); },
      };
    }
    if (t.k === 'pane') {
      const p = sim.props.paneIdx.get((t.r * w.W + t.c) * 16 + t.d);
      if (!p || p.dead) return null;
      const info = WINDOWS[p.tag] || WINDOWS.window;
      if (p.ws === undefined) p.ws = info.reinf ? WS.SECURE : WS.OUT_OF_FRAME;
      return {
        k: 'pane', p, c: p.c, r: p.r, i: p.r * w.W + p.c, info, name: info.name, amount: 1, x: p.c * TILE + 1, z: p.r * TILE + 1, reach: 3.8,
        alive: () => !p.dead, ws: () => p.ws, hp: () => p.hp, maxHp: PANE_HP,
        setState: (st, anchored) => { p.ws = (st & WS.STATE) | (anchored ? 0 : WS.UNANCHORED); },
        heal: () => { p.hp = PANE_HP; },
        remove: () => sim.removePane(p),
      };
    }
    return null;
  }

  tell(m, text, others) {
    this.sim.tell(m, 'notice', text);
    if (others) this.sim.chat.visible(m, others, 'notice', 10, m);
  }

  /** One timed step: `done` runs if the window is still as it was, you still hold the tool and stand close. */
  job(m, th, held, expect, o) { toolJob(this.sim, m, { ...th, state: th.ws }, held, expect, o); }

  /**
   * A click on a window with `held` (maybe nothing) in hand. Returns true if the window dealt with it; false means it was
   * only a hit (harm intent, a swing at the glass) and the caller should carry on as for any other attack.
   */
  click(m, t, held) {
    const sim = this.sim;
    const th = this.thing(t);
    if (!th) return true;
    const tool = held?.def.tool;
    const the = `the ${th.name}`, theI = held ? `the ${held.name}` : '';
    const st = th.ws() & WS.STATE, anchored = !(th.ws() & WS.UNANCHORED);
    const reinf = th.info.reinf;

    if (!held) {
      if (m.intent === 'harm') return false;
      sim.sound('glass_hit', th.x, th.z, 0.5);
      this.tell(m, `You knock on ${the}.`, `${m.name} knocks on ${the}.`);
      m.cool = 0.5;
      return true;
    }

    // a reinforced window that is fastened into its frame: the long way round (window.dm window/reinforced/attackby)
    if (reinf && st >= WS.BARS_CUT) {
      switch (st) {
        case WS.SECURE:
          if (tool === 'welder' && m.intent === 'harm') {
            if (!sim.actions.welderReady(m, held)) return true;
            this.job(m, th, held, WS.SECURE, {
              label: 'heating the security screws', ds: HEAT_BOLTS, sfx: 'welder',
              start: `You begin heating the security screws on ${the}...`, others: `${m.name} holds ${theI} to the security screws on ${the}...`,
              valid: () => held.lit,
              done: () => {
                th.setState(WS.BOLTS_HEATED, true);
                sim.tell(m, 'notice', 'The security bolts are glowing white hot and look ready to be removed.');
                this.timers.push({ at: sim.time + BOLTS_COOL / 10, fn: () => {
                  if (!th.alive() || th.ws() !== WS.BOLTS_HEATED) return;
                  th.setState(WS.SECURE, true);
                  sim.chat.visible({ x: th.x, z: th.z }, `The bolts on ${the} look like they've cooled off...`, 'notice', 8);
                } });
              },
            });
            return true;
          }
          break;
        case WS.BOLTS_HEATED:
          if (tool === 'screwdriver') {
            this.job(m, th, held, WS.BOLTS_HEATED, {
              label: 'removing the screws', ds: 50, sfx: 'screwdriver',
              start: 'You dig into the heated screws hard and they start turning...', others: `${m.name} digs into the heated security screws and starts removing them...`,
              done: () => { th.setState(WS.BOLTS_OUT, true); sim.tell(m, 'notice', 'The screws come out, and a gap forms around the edge of the pane.'); },
            });
            return true;
          }
          break;
        case WS.BOLTS_OUT:
          if (tool === 'crowbar') {
            this.job(m, th, held, WS.BOLTS_OUT, {
              label: 'prying the window', ds: 40, sfx: 'crowbar',
              start: `You wedge ${theI} into the gap in the frame and start prying...`, others: `${m.name} wedges ${theI} into the gap in the frame and starts prying...`,
              done: () => { th.setState(WS.POPPED, true); sim.tell(m, 'notice', 'The panel pops out of the frame, exposing some thin metal bars that looks like they can be cut.'); },
            });
            return true;
          }
          break;
        case WS.POPPED:
          if (tool === 'wirecutters') {
            this.job(m, th, held, WS.POPPED, {
              label: 'cutting the exposed bars', ds: 20, sfx: 'wirecutter',
              start: `You start cutting the exposed bars on ${the}`, others: `${m.name} starts cutting the exposed bars on ${the}...`,
              done: () => { th.setState(WS.BARS_CUT, true); sim.tell(m, 'notice', 'The panels falls out of the way exposing the frame bolts.'); },
            });
            return true;
          }
          break;
        case WS.BARS_CUT:
          if (tool === 'wrench') {
            this.job(m, th, held, WS.BARS_CUT, {
              label: 'unfastening the window', ds: 40, sfx: 'wrench',
              start: 'You start unfastening the bolts from the frame...', others: `${m.name} starts unfastening ${the} from the frame...`,
              done: () => { th.setState(WS.OUT_OF_FRAME, false); sim.tell(m, 'notice', 'You unscrew the bolts from the frame and the window pops loose.'); },
            });
            return true;
          }
          break;
        default: break;
      }
      // the base attackby only goes on to its own tool jobs below a bolted frame; welding it whole is the one exception
      if (!(tool === 'welder' && m.intent === 'help')) return false;
    }

    // welding a damaged window whole again
    if (tool === 'welder' && m.intent === 'help') {
      if (th.hp() >= th.maxHp) { sim.tell(m, 'warning', `${the[0].toUpperCase()}${the.slice(1)} is already in good condition!`); return true; }
      if (!sim.actions.welderReady(m, held)) return true;
      this.job(m, th, held, th.ws(), {
        label: 'repairing the window', ds: WELD_REPAIR, sfx: 'welder', start: `You begin repairing ${the}...`,
        valid: () => held.lit,
        done: () => { th.heal(); sim.tell(m, 'notice', `You repair ${the}.`); },
      });
      return true;
    }

    // base window.dm attackby: screw it to the floor or off it, take it apart, lever a reinforced one back into its frame
    if (tool === 'screwdriver') {
      this.job(m, th, held, th.ws(), {
        label: anchored ? 'unscrewing the window' : 'screwing the window down', ds: DECON_SPEED, sfx: 'screwdriver',
        start: `You begin to ${anchored ? 'unscrew the window from' : 'screw the window to'} the floor...`,
        done: () => {
          th.setState(st, !anchored);
          sim.tell(m, 'notice', `You ${!anchored ? 'fasten the window to' : 'unfasten the window from'} the floor.`);
          if (!anchored && th.k === 'window' && sim.world.ventsToSpace(th.i)) sim.director.onPatched(true);      // an outside window that seals again
        },
      });
      return true;
    }
    if (tool === 'wrench' && !anchored) {
      this.job(m, th, held, th.ws(), {
        label: 'taking the window apart', ds: DECON_SPEED, sfx: 'wrench', start: `You begin to disassemble ${the}...`,
        done: () => {
          const sheets = sim.newItem(th.info.sheet, { amount: th.amount });
          place(sim, sheets, m.x, m.z);
          sim.sound('pickup', m.x, m.z, 0.6);
          th.remove();
          sim.tell(m, 'notice', `You successfully disassemble ${the}.`);
        },
      });
      return true;
    }
    if (tool === 'crowbar' && reinf && st === WS.OUT_OF_FRAME && anchored) {
      this.job(m, th, held, th.ws(), {
        label: 'levering the window', ds: 100, sfx: 'crowbar', start: 'You begin to lever the window into the frame...',
        done: () => { th.setState(WS.SECURE, true); sim.tell(m, 'notice', 'You pry the window into the frame.'); },
      });
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------------ the grille (and what is left of the tile)
  /** A click on a smashed or taken-apart window tile: the grille, or open floor where it used to be. Returns false when this is not for us. */
  clickGrille(m, t, held) {
    const sim = this.sim, w = sim.world;
    const i = t.r * w.W + t.c;
    if (!w.breached.has(i)) return true;
    const x = t.c * TILE + 1, z = t.r * TILE + 1;
    const grille = !!w.grille[i];
    const tool = held?.def.tool;

    if (grille && tool === 'wirecutters') {            // grille.dm: deconstruct(): two rods, no delay, no message
      sim.sound('wirecutter', x, z, 0.9);
      w.removeGrille(t.c, t.r);
      sim.tileChanged(t.c, t.r);
      place(sim, sim.newItem('/obj/item/stack/rods', { amount: 2 }), x, z);
      return true;
    }
    if (grille && tool === 'screwdriver') {
      sim.sound('screwdriver', x, z, 0.9);
      w.ws[i] ^= WS.GRILLE_LOOSE;
      const fastened = !(w.ws[i] & WS.GRILLE_LOOSE);
      this.tell(m, `You ${fastened ? 'fasten the grille to' : 'unfasten the grille from'} the floor.`, `${m.name} ${fastened ? 'fastens' : 'unfastens'} the grille.`);
      sim.tileChanged(t.c, t.r);
      return true;
    }
    if (!grille && held?.def.sheet === 'rods') {       // the stack recipe: grille, 2 rods, time 10, one per turf
      if ((held.amount ?? 1) < 2) { sim.tell(m, 'warning', `You haven't got enough ${held.name} to build the grille!`); return true; }
      sim.actions.startTimed(m, 'building a grille', 1, () => w.breached.has(i) && !w.grille[i] && m.held === held && Math.hypot(m.x - x, m.z - z) < 4.2, () => {
        held.amount -= 2;
        if (held.amount <= 0) consume(sim, held);
        w.addGrille(t.c, t.r);
        sim.tileChanged(t.c, t.r);
      }, null, { start: 'You start building a grille...' });
      sim.chat.visible(m, `${m.name} starts building a grille.`, 'notice', 10, m);
      return true;
    }
    const kind = held && Object.entries(SHEET_TO_WINDOW).find(([path]) => held.path.startsWith(path))?.[1];     // glass/fifty is glass too
    if (grille && held?.def.sheet && ['glass', 'rglass', 'plasmaglass'].includes(held.def.sheet)) {
      if (!kind) return false;
      if ((held.amount ?? 1) < GLASS_PER_WINDOW) { sim.tell(m, 'warning', 'You need at least two sheets of glass for that!'); return true; }
      if (w.ws[i] & WS.GRILLE_LOOSE) { sim.tell(m, 'warning', 'The grille needs to be fastened to the floor first!'); return true; }
      sim.tell(m, 'notice', 'You start placing the window...');
      sim.actions.startTimed(m, 'placing the window', PLACE_WINDOW / 10, () => w.breached.has(i) && w.grille[i] && !(w.ws[i] & WS.GRILLE_LOOSE) && m.held === held && Math.hypot(m.x - x, m.z - z) < 4.2, () => {
        if (!w.restoreWindow(t.c, t.r, kind)) return;
        held.amount -= GLASS_PER_WINDOW;
        if (held.amount <= 0) consume(sim, held);
        sim.tileChanged(t.c, t.r);
        sim.tell(m, 'notice', `You place the ${WINDOWS[kind].name} on the grille.`);
      }, null, { start: null });
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------------ what a broken window leaves (window.dm spawnDebris)
  /** One shard (two for a full-tile window), and rods if it was reinforced (two for a full-tile one, else one). */
  spill(x, z, key, fulltile) {
    const sim = this.sim, info = WINDOWS[key] || WINDOWS.window;
    const at = () => [x + (sim.rand() - 0.5) * 0.9, z + (sim.rand() - 0.5) * 0.9];
    for (let n = fulltile ? 2 : 1; n > 0; n--) place(sim, sim.newItem('/obj/item/shard'), ...at());
    if (info.reinf) place(sim, sim.newItem('/obj/item/stack/rods', { amount: fulltile ? 2 : 1 }), ...at());
  }

  // ------------------------------------------------------------------ examine
  /** window.dm examine(), and grille.dm's. */
  examine(t) {
    const sim = this.sim, w = sim.world;
    if (t.k === 'breach') {
      const i = t.r * w.W + t.c;
      if (!w.breached.has(i)) return [];
      if (!w.grille[i]) return ['The floor is clear. There is nothing left of the window or its grille.'];
      return ['A flimsy framework of metal rods.', w.ws[i] & WS.GRILLE_LOOSE
        ? 'The anchoring screws are unscrewed. The rods look like they could be cut through.'
        : "It's secured in place with screws. The rods look like they could be cut through."];
    }
    const th = this.thing(t);
    if (!th) return [];
    const st = th.ws() & WS.STATE, anchored = !(th.ws() & WS.UNANCHORED);
    const out = [th.info.reinf ? 'A window that is reinforced with metal rods.' : 'A window.'];
    if (th.info.reinf) {
      if (anchored && st === 0) out.push('The window is out of the frame, but could be pried in. It is screwed to the floor.');
      else if (!anchored) out.push('The window is unscrewed from the floor, and could be deconstructed by wrenching.');
      switch (st) {
        case WS.SECURE: out.push("It's been screwed in with one way screws, you'd need to heat them to have any chance of backing them out."); break;
        case WS.BOLTS_HEATED: out.push("The screws are glowing white hot, and you'll likely be able to unscrew them now."); break;
        case WS.BOLTS_OUT: out.push('The screws have been removed, revealing a small gap you could fit a prying tool in.'); break;
        case WS.POPPED: out.push('The main plate of the window has popped out of the frame, exposing some bars that look like they can be cut.'); break;
        case WS.BARS_CUT: out.push('The main pane can be easily moved out of the way to reveal some bolts holding the frame in.'); break;
        default: break;
      }
    } else out.push(anchored ? 'The window is screwed to the floor.' : 'The window is unscrewed from the floor, and could be deconstructed by wrenching.');
    return out;
  }
}
