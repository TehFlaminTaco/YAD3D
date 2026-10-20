import { TILE } from '../shared/config.js';
import { RW, GIRDER, WALLS, girderLook, GIRDER_DESC, T } from '../shared/walls.js';
import { place, consume } from './inventory.js';
import { toolJob } from './tooljob.js';

const isMetal = (it) => !!it?.path?.startsWith('/obj/item/stack/sheet/metal');
const isPlasteel = (it) => !!it?.path?.startsWith('/obj/item/stack/sheet/plasteel');

/**
 * A reinforced wall, step by step (reinf_walls.dm try_decon). Each entry: the tool, the delay in ds (0 = at once), SS13's "begin" line,
 * its result line, and the state it leads to (`dismantle`: the wall comes down). A welder step needs the torch lit.
 */
const RSTEPS = {
  [RW.INTACT]: [
    { tool: 'wirecutters', ds: 0, done: 'You cut the outer grille.', to: RW.SUPPORT_LINES },
  ],
  [RW.SUPPORT_LINES]: [
    { tool: 'screwdriver', ds: 40, begin: 'You begin unsecuring the support lines...', done: 'You unsecure the support lines.', to: RW.COVER, label: 'unsecuring the support lines' },
    { tool: 'wirecutters', ds: 0, done: 'You repair the outer grille.', to: RW.INTACT },
  ],
  [RW.COVER]: [
    { tool: 'welder', ds: 60, begin: 'You begin slicing through the metal cover...', done: 'You press firmly on the cover, dislodging it.', to: RW.CUT_COVER, label: 'slicing through the cover' },
    { tool: 'screwdriver', ds: 40, begin: 'You begin securing the support lines...', done: 'The support lines have been secured.', to: RW.SUPPORT_LINES, label: 'securing the support lines' },
  ],
  [RW.CUT_COVER]: [
    { tool: 'crowbar', ds: 100, begin: 'You struggle to pry off the cover...', done: 'You pry off the cover.', to: RW.ANCHOR_BOLTS, label: 'prying off the cover' },
    { tool: 'welder', ds: 60, begin: 'You begin welding the metal cover back to the frame...', done: 'The metal cover has been welded securely to the frame.', to: RW.COVER, label: 'welding the cover back' },
  ],
  [RW.ANCHOR_BOLTS]: [
    { tool: 'wrench', ds: 40, begin: 'You start loosening the anchoring bolts which secure the support rods to their frame...', done: 'You remove the bolts anchoring the support rods.', to: RW.SUPPORT_RODS, label: 'loosening the anchoring bolts' },
    { tool: 'crowbar', ds: 20, begin: 'You start to pry the cover back into place...', done: 'The metal cover has been pried back into place.', to: RW.CUT_COVER, label: 'prying the cover back' },
  ],
  [RW.SUPPORT_RODS]: [
    { tool: 'welder', ds: 100, begin: 'You begin slicing through the support rods...', done: 'You slice through the support rods.', to: RW.SHEATH, label: 'slicing through the support rods' },
    { tool: 'wrench', ds: 40, begin: 'You start tightening the bolts which secure the support rods to their frame...', done: 'You tighten the bolts anchoring the support rods.', to: RW.ANCHOR_BOLTS, label: 'tightening the bolts' },
  ],
  [RW.SHEATH]: [
    { tool: 'crowbar', ds: 100, begin: 'You struggle to pry off the outer sheath...', done: 'You pry off the outer sheath.', to: 'dismantle', label: 'prying off the sheath' },
    { tool: 'welder', ds: 100, begin: 'You begin welding the support rods back together...', done: 'You weld the support rods back together.', to: RW.SUPPORT_RODS, label: 'welding the support rods' },
  ],
};

// examine(): deconstruction_hints(), with the <b>/<i> marks taken off
const RHINTS = {
  [RW.INTACT]: 'The outer grille is fully intact.',
  [RW.SUPPORT_LINES]: 'The outer grille has been cut, and the support lines are screwed securely to the outer cover.',
  [RW.COVER]: 'The support lines have been unscrewed, and the metal cover is welded firmly in place.',
  [RW.CUT_COVER]: 'The metal cover has been sliced through, and is connected loosely to the girder.',
  [RW.ANCHOR_BOLTS]: 'The outer cover has been pried away, and the bolts anchoring the support rods are wrenched in place.',
  [RW.SUPPORT_RODS]: 'The bolts anchoring the support rods have been loosened, but are still welded firmly to the girder.',
  [RW.SHEATH]: 'The support rods have been sliced through, and the outer sheath is connected loosely to the girder.',
};

const SOUND = { welder: 'welder', screwdriver: 'screwdriver', crowbar: 'crowbar', wrench: 'wrench', wirecutters: 'wirecutter' };

/**
 * Taking walls down and putting them up again: walls.dm, reinf_walls.dm and girders.dm (tgstation 2d6c10c1).
 * A plain wall is cut through with a welder (100 ds) and leaves two metal sheets and a girder on bare plating; a reinforced one takes seven
 * steps and leaves a plasteel sheet and a reinforced girder. A girder is unbolted, plated with two metal sheets, reinforced with plasteel
 * and so on. Messages and delays are the DM's.
 */
export class Walls {
  constructor(sim) { this.sim = sim; }

  // ------------------------------------------------------------------ what is being clicked
  wall(t) {
    const sim = this.sim, w = sim.world, i = t.r * w.W + t.c, key = w.wallKey(i);
    if (!key) return null;
    const info = WALLS[key];
    return { k: 'wall', c: t.c, r: t.r, i, key, info, name: info.name, x: t.c * TILE + 1, z: t.r * TILE + 1, reach: 4.8, alive: () => w.wallKey(i) === key, state: () => w.ws[i] };
  }

  girder(t) {
    const sim = this.sim;
    const rec = sim.built.get(t.id);
    if (!rec || rec.k !== 'girder') return null;
    return { k: 'built', rec, id: rec.id, c: rec.c, r: rec.r, name: girderLook(rec.st).name, x: rec.c * TILE + 1, z: rec.r * TILE + 1, reach: 4.8, alive: () => sim.built.get(rec.id) === rec, state: () => rec.st };
  }

  tell(m, text, others) {
    this.sim.tell(m, 'notice', text);
    if (others) this.sim.chat.visible(m, others, 'warning', 10, m);
  }

  // ------------------------------------------------------------------ walls
  /** A click on a wall with `held` (maybe nothing). False: it was only a hit (harm intent) for the caller to carry on with. */
  clickWall(m, t, held) {
    const sim = this.sim, th = this.wall(t);
    if (!th) return true;
    const tool = held?.def.tool;
    if (!held) {
      if (m.intent === 'harm') return false;
      sim.tell(m, 'notice', 'You push the wall but nothing happens!');
      sim.sound('punch', th.x, th.z, 0.25);
      m.cool = 0.5;
      return true;
    }
    if (!th.info.reinf) {
      if (tool !== 'welder') return false;
      if (!sim.actions.welderReady(m, held)) return true;
      toolJob(sim, m, th, held, 0, {
        label: 'slicing through the wall', ds: th.info.slice, sfx: 'welder', start: 'You begin slicing through the outer plating...',
        valid: () => held.lit,
        done: () => { sim.tell(m, 'notice', 'You remove the outer plating.'); this.dismantle(th); },
      });
      return true;
    }
    const state = sim.world.ws[th.i];
    const step = (RSTEPS[state] || []).find((s) => s.tool === tool);
    if (!step) return false;
    if (tool === 'welder' && !sim.actions.welderReady(m, held)) return true;
    const finish = () => {
      sim.tell(m, 'notice', step.done);
      if (step.to === 'dismantle') this.dismantle(th); else sim.world.ws[th.i] = step.to;
    };
    if (!step.ds) {                                       // wirecutters on the outer grille: at once
      sim.sound(SOUND[tool], th.x, th.z, 0.9);
      finish();
      return true;
    }
    toolJob(sim, m, th, held, state, { label: step.label, ds: step.ds, sfx: SOUND[tool], start: step.begin, valid: tool === 'welder' ? () => held.lit : undefined, done: finish });
    return true;
  }

  /** dismantle_wall(): the sheets, then the girder, on bare plating. */
  dismantle(th) {
    const sim = this.sim, w = sim.world;
    const sheet = sim.newItem(th.info.sheet, { amount: th.info.amount });
    place(sim, sheet, th.x + (sim.rand() - 0.5) * 0.8, th.z + (sim.rand() - 0.5) * 0.8);
    w.dismantleWall(th.c, th.r, w.level.terrain.plating);
    sim.tileChanged(th.c, th.r);
    sim.addBuilt('girder', th.c, th.r, th.info.girder);
    sim.sound('welder', th.x, th.z, 1);
  }

  // ------------------------------------------------------------------ girders
  clickGirder(m, t, held) {
    const sim = this.sim, th = this.girder(t);
    if (!th) return true;
    if (!held) return true;
    const rec = th.rec, st = rec.st, tool = held.def.tool, the = `the ${th.name}`;
    const job = (expect, o) => toolJob(sim, m, th, held, expect, o);

    if (tool === 'wrench') {
      if (st === GIRDER.DISPLACED) {
        job(st, { label: 'securing the girder', ds: T.GIRDER_SECURE, sfx: 'wrench', start: 'You start securing the girder...',
          done: () => { sim.setBuilt(rec, GIRDER.NORMAL); sim.tell(m, 'notice', 'You secure the girder.'); } });
        return true;
      }
      if (st === GIRDER.NORMAL) {
        job(st, { label: 'unsecuring the girder', ds: T.GIRDER_UNSECURE, sfx: 'wrench', start: 'You start unsecuring the girder...',
          done: () => { sim.setBuilt(rec, GIRDER.DISPLACED); sim.tell(m, 'notice', 'You unsecure the girder.'); } });
        return true;
      }
      return false;
    }
    if (tool === 'screwdriver') {
      if (st === GIRDER.DISPLACED) {
        job(st, { label: 'disassembling the girder', ds: T.GIRDER_DISASSEMBLE, sfx: 'screwdriver', start: 'You start to disassemble the girder...',
          others: `${m.name} disassembles the girder.`,
          done: () => {
            sim.tell(m, 'notice', 'You disassemble the girder.');
            this.spill(rec, '/obj/item/stack/sheet/metal', 2);
            sim.removeBuilt(rec);
          } });
        return true;
      }
      if (st === GIRDER.REINF) {
        job(st, { label: 'unsecuring the support struts', ds: T.STRUTS, sfx: 'screwdriver', start: 'You start unsecuring support struts...',
          done: () => { sim.setBuilt(rec, GIRDER.REINF_STRUTS); sim.tell(m, 'notice', 'You unsecure the support struts.'); } });
        return true;
      }
      if (st === GIRDER.REINF_STRUTS) {
        job(st, { label: 'securing the support struts', ds: T.STRUTS, sfx: 'screwdriver', start: 'You start securing support struts...',
          done: () => { sim.setBuilt(rec, GIRDER.REINF); sim.tell(m, 'notice', 'You secure the support struts.'); } });
        return true;
      }
      return false;
    }
    if (tool === 'wirecutters') {
      if (st !== GIRDER.REINF_STRUTS) return false;
      job(st, { label: 'removing the inner grille', ds: T.GRILLE, sfx: 'wirecutter', start: 'You start removing the inner grille...',
        done: () => {
          sim.tell(m, 'notice', 'You remove the inner grille.');
          this.spill(rec, '/obj/item/stack/sheet/plasteel', 1);
          sim.setBuilt(rec, GIRDER.NORMAL);
        } });
      return true;
    }

    // sheets: plate it into a wall, or reinforce it (girders.dm attackby)
    if (isMetal(held) && st !== GIRDER.DISPLACED) {
      if ((held.amount ?? 1) < 2) { sim.tell(m, 'warning', 'You need two sheets of metal to finish a wall!'); return true; }
      job(st, { label: 'adding plating', ds: T.PLATING, sfx: null, start: 'You start adding plating...',
        valid: () => (held.amount ?? 1) >= 2,
        done: () => {
          held.amount -= 2;
          if (held.amount <= 0) consume(sim, held);
          sim.tell(m, 'notice', 'You add the plating.');
          this.plate(rec, 'wall');
        } });
      return true;
    }
    if (isPlasteel(held) && st !== GIRDER.DISPLACED) {
      if ((held.amount ?? 1) < 1) return true;
      if (st === GIRDER.REINF) {
        job(st, { label: 'finalizing the wall', ds: T.FINISH_RWALL, sfx: null, start: 'You start finalizing the reinforced wall...',
          valid: () => (held.amount ?? 1) >= 1,
          done: () => {
            held.amount -= 1;
            if (held.amount <= 0) consume(sim, held);
            sim.tell(m, 'notice', 'You fully reinforce the wall.');
            this.plate(rec, 'reinforced_wall');
          } });
      } else {
        job(st, { label: 'reinforcing the girder', ds: T.REINFORCE, sfx: null, start: 'You start reinforcing the girder...',
          valid: () => (held.amount ?? 1) >= 1,
          done: () => {
            held.amount -= 1;
            if (held.amount <= 0) consume(sim, held);
            sim.tell(m, 'notice', 'You reinforce the girder.');
            sim.setBuilt(rec, GIRDER.REINF);
          } });
      }
      return true;
    }
    void the;
    return false;
  }

  /** The girder is plated: it goes, and the tile becomes a wall. */
  plate(rec, key) {
    const sim = this.sim;
    sim.removeBuilt(rec);
    sim.world.buildWall(rec.c, rec.r, key);
    sim.tileChanged(rec.c, rec.r);
    sim.sound('pickup', rec.c * TILE + 1, rec.r * TILE + 1, 0.8);
  }

  spill(rec, path, amount) {
    const sim = this.sim;
    place(sim, sim.newItem(path, { amount }), rec.c * TILE + 1 + (sim.rand() - 0.5) * 0.6, rec.r * TILE + 1 + (sim.rand() - 0.5) * 0.6);
  }

  // ------------------------------------------------------------------ examine
  examine(t) {
    const sim = this.sim;
    if (t.k === 'wall') {
      const th = this.wall(t);
      if (!th) return [];
      if (!th.info.reinf) return ['A huge chunk of metal used to separate rooms.', 'The outer plating is welded firmly in place.'];
      return ['A huge chunk of reinforced metal used to separate rooms.', RHINTS[sim.world.ws[th.i]] || RHINTS[RW.INTACT]];
    }
    const th = this.girder(t);
    if (!th) return [];
    const out = [GIRDER_DESC];
    switch (th.rec.st) {
      case GIRDER.REINF: out.push('The support struts are screwed in place.'); break;
      case GIRDER.REINF_STRUTS: out.push('The support struts are unscrewed and the inner grille is intact.'); break;
      case GIRDER.NORMAL: out.push('The bolts are wrenched in place.'); break;
      case GIRDER.DISPLACED: out.push(`The bolts are loosened, but the screws are holding the ${th.name} together.`); break;
      default: break;
    }
    return out;
  }
}
