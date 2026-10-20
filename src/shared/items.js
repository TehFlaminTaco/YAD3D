/**
 * Item database. Sprite, name, description, size class (w), allowed worn slots (sl) and melee force (f)
 * come from the real SS13 item definitions (level.itemdefs). Behaviour is a small prefix table below.
 */
const TOOLS = ['/obj/item/screwdriver', '/obj/item/wrench', '/obj/item/weldingtool', '/obj/item/crowbar', '/obj/item/wirecutters', '/obj/item/multitool',
  '/obj/item/stack/cable_coil', '/obj/item/t_scanner', '/obj/item/flashlight', '/obj/item/extinguisher', '/obj/item/analyzer', '/obj/item/geiger_counter'];
const MED = ['/obj/item/stack/medical', '/obj/item/reagent_containers', '/obj/item/healthanalyzer', '/obj/item/tank/internals/emergency', '/obj/item/clothing/mask/breath'];
const SEC = ['/obj/item/melee/baton', '/obj/item/restraints', '/obj/item/assembly/flash', '/obj/item/gun/energy', '/obj/item/stock_parts/cell', '/obj/item/flashlight'];

export const BEHAVIORS = [
  ['/obj/item/restraints/handcuffs/cable/zipties', { cuff: 45 }],
  ['/obj/item/restraints/handcuffs/cable', { cuff: 30 }],
  ['/obj/item/restraints/handcuffs', { cuff: 60 }],
  ['/obj/item/crowbar', { tool: 'crowbar' }],
  ['/obj/item/wrench', { tool: 'wrench' }],
  ['/obj/item/screwdriver', { tool: 'screwdriver' }],
  ['/obj/item/wirecutters', { tool: 'wirecutters' }],
  ['/obj/item/weldingtool', { tool: 'welder', fuel: 20 }],
  ['/obj/item/multitool', { tool: 'multitool' }],
  ['/obj/item/t_scanner', { tool: 'scanner' }],
  ['/obj/item/flashlight', { light: true }],
  ['/obj/item/clothing/head/hardhat', { light: true }],
  ['/obj/item/storage/backpack/duffelbag', { storage: { max: 30, wmax: 3 } }],
  ['/obj/item/storage/backpack', { storage: { max: 21, wmax: 3 } }],
  ['/obj/item/storage/toolbox', { storage: { max: 14, wmax: 3 } }],
  ['/obj/item/storage/belt/utility', { storage: { items: 7, wmax: 3, only: TOOLS } }],
  ['/obj/item/storage/belt/security', { storage: { items: 6, wmax: 3, only: SEC } }],
  ['/obj/item/storage/belt/medical', { storage: { items: 7, wmax: 3, only: MED } }],
  ['/obj/item/storage/belt', { storage: { items: 7, wmax: 3 } }],
  ['/obj/item/storage/firstaid', { storage: { max: 14, wmax: 2, only: MED } }],
  ['/obj/item/storage/box', { storage: { max: 14, wmax: 2 } }],
  ['/obj/item/extinguisher', { extinguisher: true, charges: 10 }],
  ['/obj/item/fireaxe', { breaks: true, reach: 2.6, cooldown: 0.9 }],
  ['/obj/item/melee/baton', { stun: 5, cooldown: 0.7 }],
  ['/obj/item/gun/energy/laser', { gun: { dmg: 22, type: 'burn', shots: 14, cooldown: 0.45, snd: 'laser' } }],
  ['/obj/item/gun/energy', { gun: { dmg: 16, type: 'burn', shots: 12, cooldown: 0.4, snd: 'laser' } }],
  ['/obj/item/stack/medical/bruise_pack', { heal: { brute: 28 }, stack: 6 }],
  ['/obj/item/stack/medical/ointment', { heal: { burn: 28 }, stack: 6 }],
  ['/obj/item/reagent_containers/hypospray/medipen', { heal: { brute: 15, burn: 15, tox: 15, oxy: 30 }, stack: 1, single: true }],
  ['/obj/item/healthanalyzer', { scanner: true }],
  ['/obj/item/tank/jetpack', { jetpack: { cap: 900 } }],             // propellant, not air: a carbon dioxide jetpack is not for breathing
  ['/obj/item/clothing/shoes/magboots', { magboots: true }],
  ['/obj/item/tank/internals/emergency_oxygen', { tank: { cap: 300 } }],
  ['/obj/item/tank/internals', { tank: { cap: 1500 } }],
  ['/obj/item/clothing/mask/breath', { internals: true }],
  ['/obj/item/clothing/mask/gas', { internals: true }],
  ['/obj/item/clothing/suit/space/hardsuit', { spaceSuit: true, slow: 0.85, armor: 0.35 }],
  ['/obj/item/clothing/suit/space', { spaceSuit: true, slow: 0.78 }],
  ['/obj/item/clothing/head/helmet/space', { spaceHelmet: true }],
  ['/obj/item/clothing/suit/armor', { armor: 0.3 }],
  ['/obj/item/clothing/gloves/color/yellow', { insulated: true }],
  ['/obj/item/card/id', { id: true }],
  ['/obj/item/radio/headset', { headset: true }],
  ['/obj/item/pda', { pda: true }],
  ['/obj/item/stock_parts/cell', { cell: true }],
  ['/obj/item/stack/sheet/metal', { sheet: 'metal', stack: 10 }],
  ['/obj/item/stack/sheet/plasteel', { sheet: 'metal', stack: 10 }],
  ['/obj/item/stack/sheet/glass', { sheet: 'glass', stack: 10 }],
  ['/obj/item/stack/sheet/rglass', { sheet: 'rglass', stack: 10 }],
  ['/obj/item/stack/sheet/plasmaglass', { sheet: 'plasmaglass', stack: 10 }],
  ['/obj/item/stack/sheet/plasmarglass', { sheet: 'plasmarglass', stack: 10 }],
  ['/obj/item/stack/rods', { sheet: 'rods', stack: 1 }],
  ['/obj/item/stack/tile', { stack: 1, tile: true }],
  ['/obj/item/stack/cable_coil', { stack: 30 }],
  ['/obj/item/reagent_containers/food/drinks', { consume: { msg: 'You take a swig.' } }],
  ['/obj/item/reagent_containers/food/snacks', { consume: { heal: 3, msg: 'You eat it.' } }],
];

const FALLBACK = { n: 'item', s: -1, d: '', w: 2, sl: [], f: 0 };
const SIZE_NAMES = ['', 'tiny', 'small', 'normal-sized', 'bulky', 'huge', 'gigantic'];

export class ItemDB {
  constructor(itemdefs, contents = {}) {
    this.defs = itemdefs;
    this.contents = contents;
    this.cache = new Map();
    this.prefixes = Object.keys(contents).filter((k) => k.startsWith('/')).sort((a, b) => b.length - a.length);
  }

  info(path) {
    if (this.defs[path]) return this.defs[path];
    // fall back to the nearest known ancestor (e.g. a subtype we have no sprite for)
    let p = path;
    while (p.lastIndexOf('/') > 0) {
      p = p.slice(0, p.lastIndexOf('/'));
      if (this.defs[p]) return this.defs[p];
    }
    return { ...FALLBACK, n: path.split('/').pop().replace(/_/g, ' ') };
  }

  behavior(path) {
    let b = this.cache.get(path);
    if (b) return b;
    let best = null, bl = -1;
    for (const [p, d] of BEHAVIORS) if (path.startsWith(p) && p.length > bl) { best = d; bl = p.length; }
    b = best || {};
    this.cache.set(path, b);
    return b;
  }

  startingContents(path) {
    for (const p of this.prefixes) if (path.startsWith(p)) return this.contents[p];
    return [];
  }

  sizeName(w) { return SIZE_NAMES[w] || 'normal-sized'; }
}

/** Build an item instance (caller assigns the id). */
export function makeItemData(db, path, extra = {}) {
  const info = db.info(path), def = db.behavior(path);
  const it = { id: 0, path, name: extra.name || info.n, sprite: info.s, w: info.w, slots: info.sl, force: info.f, def, ...extra };
  if (def.gun) it.shots = def.gun.shots;
  if (def.tank) it.gas = def.tank.cap;
  if (def.jetpack) it.gas = def.jetpack.cap;
  if (def.tool === 'welder') { it.fuel = def.fuel; it.lit = false; }
  if (def.charges) it.charges = def.charges;
  if (def.stack) it.amount = extra.amount ?? def.stack;
  if (def.storage) it.contents = [];
  return it;
}

export function describeState(it) {
  const d = it.def;
  if (d.gun) return `${it.shots}/${d.gun.shots} charges`;
  if (d.tank) return `${Math.round(it.gas / d.tank.cap * 100)}% air`;
  if (d.jetpack) return `${Math.round(it.gas / d.jetpack.cap * 100)}% gas`;
  if (d.tool === 'welder') return `fuel ${Math.ceil(it.fuel)}${it.lit ? ', lit' : ''}`;
  if (d.charges) return `${it.charges} charges`;
  if (it.amount !== undefined && d.stack > 1) return `x${it.amount}`;
  if (d.storage) return `${it.contents.length} item${it.contents.length === 1 ? '' : 's'}`;
  if (d.id) return it.access ? `${it.access.length} access` : '';
  return '';
}

// ---------------------------------------------------------------- storage + slot rules (SS13)
export function combinedWeight(c) { return c.contents.reduce((a, i) => a + i.w, 0); }

/** null if `item` can go into `container`, otherwise the reason (SS13-style message fragment). */
export function storageReason(container, item) {
  const st = container.def.storage;
  if (!st) return 'is not a container';
  if (item === container) return 'cannot go inside itself';
  if (item.w >= container.w) return 'is too big to fit in it';
  if (st.wmax && item.w > st.wmax) return 'is too big to fit in it';
  if (st.only && !st.only.some((p) => item.path.startsWith(p))) return 'does not belong in it';
  if (st.items && container.contents.length >= st.items) return 'has no more room';
  if (st.max && combinedWeight(container) + item.w > st.max) return 'has no more room';
  return null;
}

/** Can `item` be worn in `slot`? (Pockets take anything small.) */
export function fitsSlot(item, slot) {
  if (slot === 'lpocket' || slot === 'rpocket') return item.w <= 2 || item.slots.includes('pocket');
  return item.slots.includes(slot);
}

/** First slot an item can go in, in the order SS13's quick-equip tries them. */
export const EQUIP_ORDER = ['uniform', 'suit', 'shoes', 'gloves', 'glasses', 'ears', 'mask', 'head', 'neck', 'id', 'back', 'belt', 'suit_store'];
