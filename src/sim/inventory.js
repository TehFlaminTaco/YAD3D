import { SLOTS, TILE } from '../shared/config.js';
import { describeState, storageReason, fitsSlot, EQUIP_ORDER } from '../shared/items.js';

/**
 * SS13 inventory rules, server side. An item lives in exactly one place (item.loc):
 *   {t:'floor'} | {t:'hand', mob, i} | {t:'slot', mob, slot} | {t:'box', box} | {t:'closet', cl}
 * Worn slots: uniform suit shoes gloves glasses ears mask head neck belt id back lpocket rpocket suit_store.
 */

export function rootMob(item) {
  let it = item;
  for (let k = 0; k < 6 && it; k++) {
    const l = it.loc;
    if (!l) return null;
    if (l.t === 'hand' || l.t === 'slot') return l.mob;
    if (l.t === 'box') it = l.box; else return null;
  }
  return null;
}

/** Is `item` something this mob is carrying (hands, worn, or inside what they carry)? */
export function carried(mob, item) { return rootMob(item) === mob; }

export function detach(sim, item) {
  const l = item.loc;
  if (!l) return;
  if (l.t === 'hand') l.mob.hands[l.i] = null;
  else if (l.t === 'slot') l.mob.worn[l.slot] = null;
  else if (l.t === 'box') l.box.contents.splice(l.box.contents.indexOf(item), 1);
  else if (l.t === 'closet') l.cl.contents.splice(l.cl.contents.indexOf(item), 1);
  else if (l.t === 'floor') { sim.floor.delete(item.id); sim.emit({ e: 'item-', id: item.id }); }
  item.loc = null;
  const m = l.mob || (l.t === 'box' ? rootMob(l.box) : null);
  if (m) recalc(sim, m);
}

export function attach(sim, item, loc) {
  if (loc.t === 'hand') loc.mob.hands[loc.i] = item;
  else if (loc.t === 'slot') loc.mob.worn[loc.slot] = item;
  else if (loc.t === 'box') loc.box.contents.push(item);
  else if (loc.t === 'closet') loc.cl.contents.push(item);
  item.loc = loc;
  const m = loc.mob || (loc.t === 'box' ? rootMob(loc.box) : null);
  if (m) recalc(sim, m);
}

/** Put an item on the floor at (x, z). */
export function place(sim, item, x, z, y) {
  const c = Math.floor(x / TILE), r = Math.floor(z / TILE);
  const i = r * sim.world.W + c;
  const yy = y ?? (sim.world.tableH[i] > 0 ? sim.world.tableH[i] + 0.01 : 0.01);
  const rec = { item, x, y: yy, z, c, r };
  sim.floor.set(item.id, rec);
  item.loc = { t: 'floor' };
  sim.emit({ e: 'item+', id: item.id, s: item.sprite, n: item.name, x, y: yy, z });
  return rec;
}

/** Derived state: access, internals validity, suit flags. */
export function recalc(sim, mob) {
  if (!mob.humanoid) return;
  const acc = new Set();
  const addId = (it) => { if (it && it.def.id && it.access) for (const a of it.access) acc.add(a); };
  addId(mob.worn.id);
  addId(mob.hands[0]); addId(mob.hands[1]);
  mob.access = acc;
  if (mob.internals && !internalsSource(mob)) mob.internals = false;
  mob.dirty = true;
}

/** The tank internals would breathe from: worn/held directly in suit storage, back, belt, pockets or hands. */
export function internalsSource(mob) {
  if (!mob.worn.mask?.def.internals) return null;
  const cands = [mob.worn.suit_store, mob.worn.back, mob.worn.belt, mob.worn.lpocket, mob.worn.rpocket, mob.hands[0], mob.hands[1]];
  for (const it of cands) if (it && it.def.tank && it.gas > 0) return it;
  return null;
}

export function spaceSafe(mob) { return !!(mob.worn.suit?.def.spaceSuit && mob.worn.head?.def.spaceHelmet); }
export function moveSlow(mob) { return mob.worn.suit?.def.slow ?? 1; }
export function armorOf(mob) { return mob.worn.suit?.def.armor ?? 0; }
export function allItems(mob) {
  const out = [];
  const walk = (it) => { out.push(it); if (it.contents) it.contents.forEach(walk); };
  for (const h of mob.hands) if (h) walk(h);
  for (const s of SLOTS) if (mob.worn[s]) walk(mob.worn[s]);
  return out;
}

// ---------------------------------------------------------------- operations
const NOTICE = (sim, mob, text, k = 'warning') => sim.tell(mob, k, text);

/** Pick a floor item up into the active hand (or the other one if the active hand is busy). */
export function pickup(sim, mob, rec) {
  const free = mob.hands[mob.active] ? (mob.hands[1 - mob.active] ? -1 : 1 - mob.active) : mob.active;
  if (free < 0) { NOTICE(sim, mob, 'Your hands are full.'); return false; }
  const it = rec.item;
  detach(sim, it);
  attach(sim, it, { t: 'hand', mob, i: free });
  sim.sound('pickup', mob.x, mob.z, 0.7);
  return true;
}

export function dropFromHand(sim, mob, hand = mob.active) {
  const it = mob.hands[hand];
  if (!it) return false;
  detach(sim, it);
  let x = mob.x - Math.sin(mob.yaw) * 0.9, z = mob.z - Math.cos(mob.yaw) * 0.9;
  if (sim.world.collides(x, z, 0.2)) { x = mob.x; z = mob.z; }
  place(sim, it, x, z);
  sim.sound('drop', mob.x, mob.z, 0.7);
  return true;
}

export function swapHands(mob) { mob.active = 1 - mob.active; mob.dirty = true; }

/** SS13 "equip" (E): wear the held item in its slot, or stow it; with empty hands, draw from belt/suit storage. */
export function quickEquip(sim, mob) {
  const it = mob.held;
  if (!it) {
    const src = [mob.worn.belt, mob.worn.suit_store, mob.worn.back];
    for (const s of src) {
      if (!s) continue;
      if (s.contents?.length) { const c = s.contents[0]; detach(sim, c); attach(sim, c, { t: 'hand', mob, i: mob.active }); sim.sound('equip', mob.x, mob.z, 0.6); return true; }
      if (s.def.tank === undefined && !s.def.storage && s !== mob.worn.back) { detach(sim, s); attach(sim, s, { t: 'hand', mob, i: mob.active }); return true; }
    }
    NOTICE(sim, mob, 'You have nothing to draw.', 'notice');
    return false;
  }
  for (const slot of EQUIP_ORDER) {
    if (!it.slots.includes(slot) || mob.worn[slot]) continue;
    return equipTo(sim, mob, it, slot);
  }
  for (const slot of ['lpocket', 'rpocket']) if (!mob.worn[slot] && fitsSlot(it, slot)) return equipTo(sim, mob, it, slot);
  for (const slot of ['back', 'belt']) {
    const box = mob.worn[slot];
    if (box?.def.storage && !storageReason(box, it)) return storeIn(sim, mob, box, it);
  }
  NOTICE(sim, mob, `You are unable to equip the ${it.name}.`);
  return false;
}

export function equipTo(sim, mob, item, slot) {
  if (!fitsSlot(item, slot)) { NOTICE(sim, mob, `The ${item.name} does not fit there.`); return false; }
  if (mob.worn[slot]) { NOTICE(sim, mob, `You are already wearing something there.`); return false; }
  detach(sim, item);
  attach(sim, item, { t: 'slot', mob, slot });
  sim.sound('equip', mob.x, mob.z, 0.6);
  return true;
}

/** Take a worn item (or one inside a container) into the active hand. */
export function takeToHand(sim, mob, item) {
  const free = mob.hands[mob.active] ? (mob.hands[1 - mob.active] ? -1 : 1 - mob.active) : mob.active;
  if (free < 0) { NOTICE(sim, mob, 'Your hands are full.'); return false; }
  detach(sim, item);
  attach(sim, item, { t: 'hand', mob, i: free });
  return true;
}

export function storeIn(sim, mob, box, item) {
  const why = storageReason(box, item);
  if (why) { NOTICE(sim, mob, `The ${item.name} ${why}.`); return false; }
  detach(sim, item);
  attach(sim, item, { t: 'box', box });
  sim.sound('equip', mob.x, mob.z, 0.5);
  return true;
}

/** Generic UI move: item -> hand i | slot | container | floor. */
export function moveItem(sim, mob, item, to) {
  if (!item || !carried(mob, item)) return false;
  if (to.t === 'hand') {
    const i = to.i === 1 ? 1 : 0;                       // there are two hands
    if (mob.hands[i]) { NOTICE(sim, mob, 'That hand is already holding something.'); return false; }
    detach(sim, item); attach(sim, item, { t: 'hand', mob, i }); return true;
  }
  if (to.t === 'slot') return equipTo(sim, mob, item, to.slot);
  if (to.t === 'box') {
    const box = sim.items.get(to.id);
    if (!box || !carried(mob, box)) return false;
    return storeIn(sim, mob, box, item);
  }
  if (to.t === 'floor') {
    detach(sim, item);
    let x = mob.x - Math.sin(mob.yaw) * 0.9, z = mob.z - Math.cos(mob.yaw) * 0.9;
    if (sim.world.collides(x, z, 0.2)) { x = mob.x; z = mob.z; }
    place(sim, item, x, z);
    return true;
  }
  return false;
}

export function consume(sim, item) {
  detach(sim, item);
  sim.items.delete(item.id);
  if (item.contents) for (const c of item.contents) sim.items.delete(c.id);
}

// ---------------------------------------------------------------- replication
// short type tags the client uses to pick a pose for the item in your hand, find your PDA, draw a helmet visor...
function tagsOf(it) {
  const d = it.def, t = [];
  if (d.pda) t.push('pda');
  if (d.id) t.push('id');
  if (d.storage) t.push('bag');
  if (d.gun) t.push('gun');
  if (d.tank) t.push('tank');
  if (d.light) t.push('light');
  if (d.tool) t.push(d.tool);
  if (d.heal) t.push('med');
  if (d.consume) t.push('food');
  if (d.spaceHelmet) t.push('helmet');
  if (d.spaceSuit) t.push('spacesuit');
  if (d.internals) t.push('mask');
  if (d.headset) t.push('headset');
  if (d.sheet) t.push('sheet');
  if (d.cell) t.push('cell');
  if (d.stun || d.breaks || (it.force || 0) >= 9) t.push('weapon');
  return t.join(' ');
}

export function serializeItem(it, depth = 0) {
  const o = { id: it.id, n: it.name, s: it.sprite, w: it.w, st: describeState(it) };
  const tg = tagsOf(it);
  if (tg) o.tg = tg;
  if (it.def.stack > 1 || it.amount !== undefined) o.amt = it.amount;
  if (it.lit) o.lit = 1;
  if (it.contents && depth < 3) {
    o.c = it.contents.map((c) => serializeItem(c, depth + 1));
    const st = it.def.storage;
    o.cap = st.items ? { n: st.items } : { w: st.max, used: it.contents.reduce((a, c) => a + c.w, 0) };
  }
  return o;
}

export function serializeInv(mob) {
  const worn = {};
  for (const s of SLOTS) worn[s] = mob.worn[s] ? serializeItem(mob.worn[s]) : null;
  return {
    hands: mob.hands.map((h) => (h ? serializeItem(h) : null)), active: mob.active, worn,
    intent: mob.intent, throwMode: mob.throwMode, internals: mob.internals, light: mob.lightOn, open: [...mob.openContainers],
  };
}
