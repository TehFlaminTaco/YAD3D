import { HIDE } from '../shared/looks.js';
import { moveProp } from '../shared/propdata.js';
import { fitsSlot } from '../shared/items.js';
import { detach, place, recalc, shiftItem } from './inventory.js';
import { timeText } from './closets.js';

const REACH = 2.6;                // how close you must be to handcuff, grab, strip or stuff someone
const DRAG = 1.5;                 // how far behind you a person you hold trails
const HAUL_ITEM = 0.9;            // how far behind you a loose item you drag trails
const HAUL_LOSE = 3.4;            // how far past its own size you can get from a dragged structure before you lose your grip on it
const HAUL_GAP = 0.3;             // clear space a dragged structure keeps between itself and you
const DRAG_SLOW = 0.45;           // how much one point of drag_slowdown costs you (a locker's 1.5 is about two fifths of your speed)
const POCKET_DELAY = 4;           // POCKET_STRIP_DELAY: 40 ds
const ALERT = "You're handcuffed and can't act. Use the Resist button to attempt to break free.";

// the strip window, in SS13's order (human.dm show_inv): slot, label, and the flags_inv bit that hides it
const STRIP_SLOTS = [
  ['back', 'Back', 0], ['head', 'Head', 0], ['mask', 'Mask', HIDE.MASK], ['neck', 'Neck', HIDE.NECK], ['glasses', 'Eyes', HIDE.EYES],
  ['ears', 'Ears', HIDE.EARS], ['suit', 'Exosuit', 0], ['suit_store', 'Suit Storage', HIDE.SUITSTORE], ['shoes', 'Shoes', HIDE.SHOES],
  ['gloves', 'Gloves', HIDE.GLOVES], ['uniform', 'Uniform', HIDE.JUMPSUIT], ['belt', 'Belt', 0], ['id', 'ID', 0],
];
const HAND_NAMES = ['Left hand', 'Right hand'];
const POCKET_NAMES = { lpocket: 'left', rpocket: 'right' };

const a = (n) => (/^[aeiou]/i.test(n) ? 'an ' : 'a ') + n;

const MALE = { He: 'He', he: 'he', His: 'His', his: 'his', him: 'him' };
const FEMALE = { He: 'She', he: 'she', His: 'Her', his: 'her', him: 'her' };

/**
 * What people can do to each other's bodies: handcuffs, grabbing and dragging, resisting, the strip window, and what examining
 * someone tells you. The rules, delays and messages are SS13's (handcuffs.dm, living.dm, living_defense.dm, human.dm, examine.dm).
 */
export class People {
  constructor(sim) { this.sim = sim; }

  pron(o) { return o.look?.g === 'f' ? FEMALE : MALE; }

  /** Within reach of each other with nothing solid between (this only works for two people on one grid: a doorway between grids is walked through, not reached over). */
  near(m, o, reach = REACH) {
    return m.grid === o.grid && !!m.grid && Math.hypot(o.x - m.x, o.z - m.z) <= reach && m.grid.world.los(m.x, m.z, o.x, o.z);
  }

  /** Throw everything `o` holds onto the floor at their feet. */
  dropHeld(o) {
    for (const i of [0, 1]) {
      const it = o.hands[i];
      if (!it) continue;
      detach(this.sim, it);
      place(this.sim, it, o.grid, o.x + (this.sim.rand() - 0.5) * 0.9, o.z + (this.sim.rand() - 0.5) * 0.9);
    }
  }

  // ------------------------------------------------------------------ handcuffs
  /** Click someone with handcuffs (any intent): three seconds standing still next to them, and they are cuffed. */
  cuff(m, o, held) {
    const sim = this.sim;
    if (o === m || o.kind !== 'human' || o.cuffed || o.inside || !this.near(m, o)) return;
    const name = held.name;
    sim.chat.visible(o, `${m.name} is trying to put ${name} on ${o.name}!`, 'danger', 12, [o]);
    sim.tell(o, 'danger', `${m.name} is trying to put ${name} on you!`);
    sim.sound(held.def.cuff === 30 ? 'cablecuff' : 'cuff', m, 0.5);
    const ox = o.x, oz = o.z;
    sim.actions.startTimed(m, `putting ${name} on ${o.name}`, 3,
      () => !o.cuffed && !o.inside && this.near(m, o) && Math.hypot(o.x - ox, o.z - oz) < 0.4 && m.held === held,
      () => {
        detach(sim, held);
        held.loc = { t: 'cuffs', mob: o };
        o.cuffed = held;
        this.dropHeld(o);
        this.release(o);                                  // cuffed hands let go of whoever they hold
        if (o.busy) sim.actions.cancelBusy(o, 'invalid');
        o.apDirty = true; o.dirty = true;
        sim.chat.visible(o, `${m.name} handcuffs ${o.name}.`, 'notice', 12, [o]);
        sim.tell(o, 'danger', `${m.name} handcuffs you.`);
      }, null, { start: null, stop: () => `You fail to handcuff ${o.name}!` });
  }

  /** B while cuffed: try to work them off (a minute for handcuffs, you have to stand still). */
  resistCuffs(m) {
    const sim = this.sim, item = m.cuffed;
    if (!item) return;
    if (m.busy) { sim.tell(m, 'warning', `You're already attempting to remove ${item.name}!`); return; }
    const t = item.def.cuff ?? 60;
    const sx = m.x, sz = m.z;
    sim.chat.visible(m, `${m.name} attempts to remove ${item.name}!`, 'warning', 12, [m]);
    sim.actions.startTimed(m, `removing ${item.name}`, t,
      () => m.cuffed === item && Math.hypot(m.x - sx, m.z - sz) < 0.3,
      () => {
        sim.chat.visible(m, `${m.name} manages to remove ${item.name}!`, 'danger', 12);
        sim.tell(m, 'notice', `You successfully remove ${item.name}.`);
        this.uncuff(m, m.x + (sim.rand() - 0.5) * 0.6, m.z + (sim.rand() - 0.5) * 0.6);
      }, null, {
        start: `You attempt to remove ${item.name}... (This will take around ${timeText(t)} and you need to stand still.)`,
        stop: () => (m.cuffed === item ? `You fail to remove ${item.name}!` : null),
        keep: true,
      });
  }

  /** Take the cuffs off and leave them on the floor. */
  uncuff(o, x, z) {
    const item = o.cuffed;
    if (!item) return;
    detach(this.sim, item);
    place(this.sim, item, o.grid, x ?? o.x, z ?? o.z);
    o.apDirty = true; o.dirty = true;
  }

  /** What a handcuffed person is told when they try to use their hands (and at most every few seconds). */
  restrained(m) {
    if (!m.cuffed) return false;
    if ((m.cuffMsgAt || 0) <= this.sim.time) { m.cuffMsgAt = this.sim.time + 4; this.sim.tell(m, 'warning', ALERT); }
    return true;
  }

  // ------------------------------------------------------------------ grabs, pulling, resisting
  /** Grab intent on someone: hold them; again for a firmer grip; a third time (three seconds) by the neck. */
  grab(m, o) {
    const sim = this.sim;
    if (o === m || o.evacuated || o.inside || !this.near(m, o)) return;
    const their = m.look?.g === 'f' ? 'her' : 'his';
    if (m.pulling !== o) {
      if (m.pulling || m.hauling) this.release(m);
      if (o.pulledBy) {
        sim.chat.visible(o, `${m.name} pulls ${o.name} from ${o.pulledBy.name}'s grip.`, 'danger', 12, [m, o]);
        sim.tell(o, 'danger', `${m.name} pulls you from ${o.pulledBy.name}'s grip.`);
        sim.tell(m, 'notice', `You pull ${o.name} from ${o.pulledBy.name}'s grip!`);
        this.release(o.pulledBy);
      }
      m.pulling = o; o.pulledBy = m; m.grab = 0;
      m.cool = 1;
      sim.sound('grab', m, 0.5);
      sim.chat.visible(o, `${m.name} grabs ${o.name} passively!`, 'warning', 12, [m, o]);
      sim.tell(o, 'warning', `${m.name} grabs you passively!`);
      sim.tell(m, 'notice', `You grab ${o.name} passively!`);
      return;
    }
    if (m.grab === 0) {                                  // the first tightening is instant
      m.grab = 1; m.cool = 1;
      sim.sound('grab', m, 0.5);
      sim.chat.visible(o, `${m.name} grabs ${o.name} aggressively!`, 'danger', 12, [m, o]);
      sim.tell(o, 'danger', `${m.name} grabs you aggressively!`);
      sim.tell(m, 'danger', `You grab ${o.name} aggressively!`);
      this.dropHeld(o);
      this.release(o);
      return;
    }
    if (m.grab === 1) {
      sim.chat.visible(o, `${m.name} starts to tighten ${their} grip on ${o.name}!`, 'danger', 12, [m, o]);
      sim.tell(o, 'danger', `${m.name} starts to tighten ${their} grip on you!`);
      sim.tell(m, 'danger', `You start to tighten your grip on ${o.name}!`);
      const ox = o.x, oz = o.z;
      sim.actions.startTimed(m, `tightening your grip on ${o.name}`, 3,
        () => m.pulling === o && m.grab === 1 && this.near(m, o) && Math.hypot(o.x - ox, o.z - oz) < 0.5,
        () => {
          if (m.intent !== 'grab') { sim.tell(m, 'warning', 'You must be on grab intent to upgrade your grab further!'); return; }
          m.grab = 2;
          sim.sound('grab', m, 0.5);
          sim.chat.visible(o, `${m.name} grabs ${o.name} by the neck!`, 'danger', 12, [m, o]);
          sim.tell(o, 'danger', `${m.name} grabs you by the neck!`);
          sim.tell(m, 'danger', `You grab ${o.name} by the neck!`);
          o.x = m.x - Math.sin(m.yaw) * 0.7; o.z = m.z - Math.cos(m.yaw) * 0.7;      // they are pulled down in front of you
          if (m.grid.world.collides(o.x, o.z, 0.28)) { o.x = m.x; o.z = m.z; }
        }, null, { start: null, stop: null });
    }
  }

  /** Let go (the P key). */
  release(m) {
    if (m.hauling) {
      const it = m.hauling.it;
      if (it) it.draggedBy = null;
      m.hauling = null; m.dirty = true;
      if (it) this.eject(m, it);
    }
    const o = m.pulling;
    if (!o) return;
    o.pulledBy = null;
    o.downed = false;
    m.pulling = null;
    m.grab = 0;
    m.dirty = true; o.dirty = true;
  }

  /** B (or trying to walk) while someone holds you: a passive hold lets go at once, tighter ones are a roll of the dice. */
  resistGrab(o) {
    const sim = this.sim, p = o.pulledBy;
    if (!p || o.cuffed) return;
    if ((o.resistAt || 0) > sim.time) return;
    o.resistAt = sim.time + 2;                           // CLICK_CD_RESIST
    if (p.grab === 0) { this.release(p); return; }
    if (sim.rand() * 100 < 60 / p.grab) {                // BASE_GRAB_RESIST_CHANCE over the grab state
      sim.chat.visible(o, `${o.name} breaks free of ${p.name}'s grip!`, 'danger', 12, [o, p]);
      sim.tell(o, 'danger', `You break free of ${p.name}'s grip!`);
      sim.tell(p, 'warning', `${o.name} breaks free of your grip!`);
      this.release(p);
    } else {
      sim.chat.visible(o, `${o.name} struggles as they fail to break free of ${p.name}'s grip!`, 'danger', 12, [o, p]);
      sim.tell(o, 'warning', `You struggle as you fail to break free of ${p.name}'s grip!`);
      sim.tell(p, 'danger', `${o.name} struggles as they fail to break free of your grip!`);
    }
  }

  /** The B key for a person: out of a locker, out of a grip, out of cuffs. Returns true if it did something. */
  resist(m) {
    if (m.inside) { this.sim.closets.resist(m, m.inside); return true; }
    if (!m.cuffed && m.pulledBy) { this.resistGrab(m); return true; }
    if (m.cuffed) { this.resistCuffs(m); return true; }
    return false;
  }

  /** Every tick: who is downed by a neck grab, people trailing behind whoever holds them, windows to close. */
  update() {
    const sim = this.sim;
    for (const m of sim.mobs.values()) {
      if (m.humanoid) m.downed = !!(m.pulledBy && m.pulledBy.grab >= 2);
      if (m.hauling) this.haul(m);
      const o = m.pulling;
      if (!o) continue;
      if (m.dead || m.stunned > 0 || m.cuffed || m.inside || o.inside || o.evacuated || !sim.mobs.has(o.id) || m.grid !== o.grid) { this.release(m); continue; }
      const d = Math.hypot(m.x - o.x, m.z - o.z);
      if (d > DRAG) {
        const k = (d - DRAG) / d, pos = { x: o.x, z: o.z };
        m.grid.world.move(pos, (m.x - o.x) * k, (m.z - o.z) * k, 0.28);
        o.x = pos.x; o.z = pos.z;
      }
      if (Math.hypot(m.x - o.x, m.z - o.z) > 3.4) this.release(m);       // they could not keep up
    }
    for (const c of sim.clients.values()) {
      if (!c.strip) continue;
      const m = c.mob, o = sim.mobs.get(c.strip);
      if (!m || !o || m.dead || m.stunned > 0 || m.cuffed || !this.near(m, o, REACH + 0.8)) this.closeStrip(c);
    }
  }

  // ------------------------------------------------------------------ dragging (Ctrl+click: SS13's pull)
  /**
   * Take hold of something to drag it behind you, or let go of it: a person (a plain passive hold, nothing tighter), a loose
   * item, or a structure that is not bolted down. SS13 says nothing when you can't; it only plays the grab sound when you can.
   */
  drag(m, t) {
    const sim = this.sim;
    if (t.k === 'mob') {
      if (m.pulling === t.o) this.release(m); else this.grab(m, t.o);
      return;
    }
    let h = null;
    if (t.k === 'item') {
      const rec = t.rec;
      if (rec.y > 0.05) return;                          // lying on a table
      h = { k: 'item', id: rec.item.id, name: rec.item.name };
    } else if (t.k === 'prop') {
      const it = t.it;
      if (!['prop', 'closet'].includes(it.kind) || it.anc || it.gone || it.kind === 'container') return;
      h = { k: 'prop', it, name: it.name };
    } else return;
    const cur = m.hauling;
    if (cur && cur.k === h.k && (cur.id === h.id && h.id !== undefined || cur.it === h.it && h.it)) { this.release(m); return; }
    this.release(m);
    if (h.it?.draggedBy) this.release(h.it.draggedBy);   // an object cannot be dragged by two people
    for (const o of sim.mobs.values()) if (o.hauling && h.k === 'item' && o.hauling.id === h.id) this.release(o);
    if (h.it) h.it.draggedBy = m;
    m.hauling = h;
    m.cool = 0.4;
    m.dirty = true;
    sim.sound('grab', m, 0.5);
  }

  /** Where you can get to while holding someone or something: the multiplier on your speed. */
  dragSlow(m) {
    const h = m.hauling;
    if (h) return h.it?.ds ? 1 / (1 + h.it.ds * DRAG_SLOW) : 1;
    const o = m.pulling;
    // a person who is down is a dead weight unless you hold them up (living_movement.dm update_pull_movespeed)
    if (o && (o.dead || o.stunned > 0 || o.downed) && m.grab < 1) return 1 / (1 + 1.5 * DRAG_SLOW);
    return 1;
  }

  /** Each tick: what you drag keeps up with you. Items trail; a structure steps into the tile you just left. */
  haul(m) {
    const sim = this.sim, w = m.grid.world, h = m.hauling;
    if (m.dead || m.stunned > 0 || m.cuffed || m.inside) { this.release(m); return; }
    if (h.k === 'item') {
      const rec = sim.floor.get(h.id);
      if (!rec || rec.grid !== m.grid) { this.release(m); return; }
      const d = Math.hypot(m.x - rec.x, m.z - rec.z);
      if (d > HAUL_LOSE) { this.release(m); return; }
      if (d > HAUL_ITEM) {
        const k = (d - HAUL_ITEM) / d, pos = { x: rec.x, z: rec.z };
        w.move(pos, (m.x - rec.x) * k, (m.z - rec.z) * k, 0.15);
        if (pos.x !== rec.x || pos.z !== rec.z) shiftItem(sim, rec, pos.x, pos.z);
      }
      return;
    }
    const it = h.it;
    const d = Math.hypot(m.x - it.x, m.z - it.z);
    if (it.gone || it.anc || it.grid !== m.grid || d > it.half + HAUL_LOSE) { this.release(m); return; }
    const want = it.half + 0.32 + HAUL_GAP;                  // how far its middle trails yours
    if (d > want) this.towProp(m, it, (m.x - it.x) * (d - want) / d, (m.z - it.z) * (d - want) / d);
  }

  /** Can the structure `it` stand at (x, z): clear of walls, other boxes and anyone's body (except the one who drags it)? */
  propFits(m, it, x, z) {
    if (it.grid.world.collides(x, z, it.half, it)) return false;
    for (const o of this.sim.mobs.values()) {
      if (o === m || o.inside || o.evacuated || o.dead || o.grid !== it.grid) continue;
      if (Math.abs(o.x - x) < it.half + 0.3 && Math.abs(o.z - z) < it.half + 0.3) return false;
    }
    return true;
  }

  /** Put a dragged structure at (x, z) (turned toward where it went) and tell everyone. */
  placeProp(it, x, z, face) {
    moveProp(it.grid.world, it, x, z, face);
    for (const o of it.mobs || []) { o.x = it.x; o.z = it.z; o.dirty = true; }
    it.grid.emit({ e: 'pm', i: it.idx, x, z, d: it.d });
  }

  /** Slide a dragged structure by (dx, dz), along walls and other things, never into anyone's body. */
  towProp(m, it, dx, dz) {
    const mm = (v) => Math.round(v * 1000) / 1000;
    let nx = it.x, nz = it.z;
    if (this.propFits(m, it, mm(it.x + dx), mm(it.z + dz))) { nx = mm(it.x + dx); nz = mm(it.z + dz); }
    else {
      if (dx && this.propFits(m, it, mm(it.x + dx), it.z)) nx = mm(it.x + dx);
      if (dz && this.propFits(m, it, nx, mm(it.z + dz))) nz = mm(it.z + dz);
    }
    const sx = nx - it.x, sz = nz - it.z;
    if (!sx && !sz) return;
    // it turns to face the way it is going (SS13 sets a moved thing's dir to the direction of the move)
    const face = Math.abs(sx) > Math.abs(sz) * 1.2 ? (sx > 0 ? 4 : 8) : Math.abs(sz) > Math.abs(sx) * 1.2 ? (sz > 0 ? 2 : 1) : it.d;
    this.placeProp(it, nx, nz, face);
  }

  /**
   * You can walk through what you drag, so when you let go you may be standing in it. Then the two of you move apart until you are clear:
   * half the way each if there is room, otherwise whoever can move does.
   */
  eject(m, it) {
    const w = it.grid.world, need = it.half + 0.32 + 0.02;
    const overlap = (x0, z0, x1, z1) => Math.abs(x0 - x1) < need - 0.02 && Math.abs(z0 - z1) < need - 0.02;
    if (it.gone || !overlap(m.x, m.z, it.x, it.z)) return;
    const mm = (v) => Math.round(v * 1000) / 1000;
    const dirs = [];
    const dx = m.x - it.x, dz = m.z - it.z, len = Math.hypot(dx, dz);
    dirs.push(len > 0.01 ? [dx / len, dz / len] : [Math.sin(m.yaw), Math.cos(m.yaw)]);     // straight apart (behind you if you are exactly on it)
    for (let k = 0; k < 8; k++) dirs.push([Math.cos(k * Math.PI / 4), Math.sin(k * Math.PI / 4)]);
    for (const [ux, uz] of dirs) {
      let t = 0.05;
      while (t < 2.4 && overlap(m.x + ux * t, m.z + uz * t, it.x, it.z)) t += 0.05;       // how far apart they must end up along this line
      for (const [kb, ki] of [[0.5, 0.5], [1, 0], [0, 1]]) {
        const bx = mm(m.x + ux * t * kb), bz = mm(m.z + uz * t * kb), px = mm(it.x - ux * t * ki), pz = mm(it.z - uz * t * ki);
        if (w.collides(bx, bz, 0.32, it) || (ki && !this.propFits(m, it, px, pz)) || overlap(bx, bz, px, pz)) continue;
        if (kb) { m.x = bx; m.z = bz; m.vx = m.vz = 0; m.dirty = true; }
        if (ki) this.placeProp(it, px, pz, it.d);
        return;
      }
    }
  }

  /** Late joiners need every structure that is not where the map put it. */
  moved(g) {
    return g.props.interact.filter((it) => it.x0 !== undefined && (it.x !== it.x0 || it.z !== it.z0 || it.d !== it.d0)).map((it) => [it.idx, it.x, it.z, it.d]);
  }

  // ------------------------------------------------------------------ the strip window
  /** Which slots of `o` are covered by their clothes right now. */
  hidden(o) { return this.sim.appearanceOf(o).h; }

  itemRef(it) { return it ? { id: it.id, n: it.name, s: it.sprite } : null; }

  view(o) {
    const h = this.hidden(o);
    return {
      e: 'strip', id: o.id, name: o.name,
      hands: [0, 1].map((i) => ({ k: 'hand' + i, l: HAND_NAMES[i], it: this.itemRef(o.hands[i]) })),
      slots: STRIP_SLOTS.map(([k, l, bit]) => ({ k, l, it: this.itemRef(o.worn[k]), ob: !!(bit && (h & bit)) })),
      pockets: [{ k: 'lpocket', l: 'Left pocket', full: !!o.worn.lpocket }, { k: 'rpocket', l: 'Right pocket', full: !!o.worn.rpocket }],
      cuffs: o.cuffed ? this.itemRef(o.cuffed) : null,
    };
  }

  openStrip(m, o) {
    const sim = this.sim, c = m.client;
    if (!c || o === m || o.kind !== 'human' || m.cuffed || m.inside || m.dead) return;
    if (!this.near(m, o)) { sim.tell(m, 'warning', `You can't reach ${o.name}.`); return; }
    c.strip = o.id;
    sim.emit(this.view(o), { to: c });
  }

  closeStrip(c) {
    if (!c.strip) return;
    c.strip = null;
    this.sim.emit({ e: 'strip', close: 1 }, { to: c });
  }

  refresh(c) {
    const o = c.strip && this.sim.mobs.get(c.strip);
    if (o) this.sim.emit(this.view(o), { to: c });
  }

  /** Messages from the client's strip window: {op: open | close | take | put | pocket, id, slot}. */
  handle(c, msg) {
    const sim = this.sim, m = c.mob;
    if (!m || m.dead || m.inside) return;
    if (msg.op === 'close') { c.strip = null; return; }
    const o = sim.mobs.get(msg.id);
    if (!o || o.kind !== 'human' || o === m) return;
    if (msg.op === 'open') { this.openStrip(m, o); return; }
    if (c.strip !== o.id || m.cuffed || m.stunned > 0 || m.busy) return;
    if (!this.near(m, o)) { this.closeStrip(c); return; }
    const slot = String(msg.slot || '');
    if (msg.op === 'take') this.take(c, m, o, slot);
    else if (msg.op === 'put') this.put(c, m, o, slot);
    else if (msg.op === 'pocket') this.pocket(c, m, o, slot);
  }

  /** stripPanelUnequip: take something off them (or out of their hands, or their handcuffs), which lands on the floor. */
  take(c, m, o, slot) {
    const sim = this.sim;
    const hand = /^hand([01])$/.exec(slot);
    const item = hand ? o.hands[+hand[1]] : slot === 'cuffs' ? o.cuffed : o.worn[slot];
    if (!item) return;
    const bit = STRIP_SLOTS.find((s) => s[0] === slot)?.[2] || 0;
    if (bit && (this.hidden(o) & bit)) { sim.tell(m, 'warning', "You can't reach that! Something is covering it."); return; }
    const delay = slot === 'cuffs' ? 4 : item.def.sd ?? 4;
    sim.chat.visible(o, `${m.name} tries to remove ${o.name}'s ${item.name}.`, 'warning', 12, [m, o]);
    sim.tell(o, 'danger', `${m.name} tries to remove your ${item.name}.`);
    sim.tell(m, 'danger', `You try to remove ${o.name}'s ${item.name}...`);
    const ox = o.x, oz = o.z;
    sim.actions.startTimed(m, `taking off ${o.name}'s ${item.name}`, delay,
      () => this.near(m, o) && Math.hypot(o.x - ox, o.z - oz) < 0.4 && c.strip === o.id,
      () => {
        const still = hand ? o.hands[+hand[1]] === item : slot === 'cuffs' ? o.cuffed === item : o.worn[slot] === item;
        if (!still) return;
        if (slot === 'cuffs') this.uncuff(o, o.x + (sim.rand() - 0.5) * 0.6, o.z + (sim.rand() - 0.5) * 0.6);
        else { detach(sim, item); place(sim, item, o.grid, o.x + (sim.rand() - 0.5) * 0.6, o.z + (sim.rand() - 0.5) * 0.6); }
        o.dirty = true;
        this.refresh(c);
      }, null, { start: null, stop: null });
  }

  /** stripPanelEquip: put what you are holding on them. */
  put(c, m, o, slot) {
    const sim = this.sim, item = m.held;
    if (!item) return;
    if (!STRIP_SLOTS.some((s) => s[0] === slot)) return;
    const bit = STRIP_SLOTS.find((s) => s[0] === slot)[2];
    if (o.worn[slot] || !fitsSlot(item, slot) || (bit && (this.hidden(o) & bit))) { sim.tell(m, 'warning', `The ${item.name} doesn't fit in that place!`); return; }
    const delay = item.def.ed ?? 2;
    sim.chat.visible(o, `${m.name} tries to put ${a(item.name)} on ${o.name}.`, 'notice', 12, [m, o]);
    sim.tell(o, 'notice', `${m.name} tries to put ${a(item.name)} on you.`);
    sim.tell(m, 'notice', `You try to put ${a(item.name)} on ${o.name}...`);
    const ox = o.x, oz = o.z;
    sim.actions.startTimed(m, `putting ${a(item.name)} on ${o.name}`, delay,
      () => this.near(m, o) && Math.hypot(o.x - ox, o.z - oz) < 0.4 && c.strip === o.id && m.held === item && !o.worn[slot],
      () => {
        detach(sim, item);
        item.loc = { t: 'slot', mob: o, slot };
        o.worn[slot] = item;
        recalc(sim, o);
        sim.sound('equip', o, 0.6);
        o.dirty = true;
        this.refresh(c);
      }, null, { start: null, stop: null });
  }

  /** Pockets: you can't see what is in them, only that they are full. Emptying is stealthy: they only notice if you are caught. */
  pocket(c, m, o, slot) {
    const sim = this.sim;
    const side = POCKET_NAMES[slot];
    if (!side) return;
    const have = o.worn[slot], put = m.held;
    let delay = POCKET_DELAY;
    if (have) sim.tell(m, 'notice', `You try to empty ${o.name}'s ${side} pocket.`);
    else if (put && fitsSlot(put, slot)) { sim.tell(m, 'notice', `You try to place ${put.name} into ${o.name}'s ${side} pocket.`); delay = POCKET_DELAY / 4; }
    else return;
    const ox = o.x, oz = o.z;
    sim.actions.startTimed(m, `going through ${o.name}'s pockets`, delay,
      () => this.near(m, o) && Math.hypot(o.x - ox, o.z - oz) < 0.4 && c.strip === o.id,
      () => {
        if (have) {
          if (o.worn[slot] !== have) return;
          detach(sim, have);
          place(sim, have, o.grid, o.x + (sim.rand() - 0.5) * 0.6, o.z + (sim.rand() - 0.5) * 0.6);
        } else if (put && m.held === put && !o.worn[slot]) {
          detach(sim, put);
          put.loc = { t: 'slot', mob: o, slot };
          o.worn[slot] = put;
          recalc(sim, o);
        }
        this.refresh(c);
      }, null, {
        start: null,
        stop: () => { sim.tell(o, 'warning', `You feel your ${side} pocket being fumbled with!`); return null; },
      });
  }

  // ------------------------------------------------------------------ examine
  /** human/examine.dm: what you can see of someone, one line each. */
  examineLines(viewer, o) {
    const p = this.pron(o), out = [`This is ${o.name}!`];
    const h = this.hidden(o), w = o.worn;
    const line = (slot, text, bit = 0) => { if (w[slot] && !(bit && (h & bit))) out.push(text(a(w[slot].name))); };
    line('uniform', (n) => `${p.He} is wearing ${n}.`, HIDE.JUMPSUIT);
    line('head', (n) => `${p.He} is wearing ${n} on ${p.his} head.`);
    line('suit', (n) => `${p.He} is wearing ${n}.`);
    if (w.suit && w.suit_store && !(h & HIDE.SUITSTORE)) out.push(`${p.He} is carrying ${a(w.suit_store.name)} on ${p.his} ${w.suit.name}.`);
    line('back', (n) => `${p.He} has ${n} on ${p.his} back.`);
    o.hands.forEach((it, i) => { if (it) out.push(`${p.He} is holding ${a(it.name)} in ${p.his} ${i ? 'right' : 'left'} hand.`); });
    line('gloves', (n) => `${p.He} has ${n} on ${p.his} hands.`, HIDE.GLOVES);
    if (o.cuffed) out.push(`${p.He} is ${o.cuffed.def.cuff === 60 ? 'handcuffed' : 'restrained with cable'}!`);
    line('belt', (n) => `${p.He} has ${n} about ${p.his} waist.`);
    line('shoes', (n) => `${p.He} is wearing ${n} on ${p.his} feet.`, HIDE.SHOES);
    line('mask', (n) => `${p.He} has ${n} on ${p.his} face.`, HIDE.MASK);
    line('neck', (n) => `${p.He} is wearing ${n} around ${p.his} neck.`, HIDE.NECK);
    line('glasses', (n) => `${p.He} has ${n} covering ${p.his} eyes.`, HIDE.EYES);
    line('ears', (n) => `${p.He} has ${n} on ${p.his} ears.`, HIDE.EARS);
    line('id', (n) => `${p.He} is wearing ${n}.`);
    const b = o.body;
    if (o.dead) out.push(`${p.He} is limp and unresponsive; there are no signs of life...`);
    if (b.brute > 0.5) out.push(b.brute < 25 ? `${p.He} has minor bruising.` : b.brute < 50 ? `${p.He} has moderate bruising!` : `${p.He} has severe bruising!`);
    if (b.burn > 0.5) out.push(b.burn < 25 ? `${p.He} has minor burns.` : b.burn < 50 ? `${p.He} has moderate burns!` : `${p.He} has severe burns!`);
    if (o.pulledBy && o.pulledBy.grab) out.push(`${p.He} is restrained by ${o.pulledBy.name}'s grip.`);
    if (!o.dead) out.push(b.crit ? `${p.He} is barely conscious.` : '');
    return out.filter(Boolean);
  }
}
