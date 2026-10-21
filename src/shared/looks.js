/**
 * How a person looks. A *look* is what the player chooses (body, skin, hair, underwear...); an *outfit* is what they are
 * wearing right now. Together they are an *appearance* (`ap`), which the server sends and every client composes into
 * sprites with the layered art in assets/chars.png (see tools/build_chars.py and src/client/charart.js).
 *
 *   look   {g: 'm'|'f', sk, h, hc, f, fc, e, u, t, s}   skin tone name, hair style name, hair colour, facial hair name and
 *                                                        colour, eye colour, underwear / undershirt / socks names
 *   ap     {l: look, o: {slot: base cell}, h: hide flags}
 */
export const WORN_SLOTS = ['uniform', 'suit', 'shoes', 'gloves', 'glasses', 'ears', 'mask', 'head', 'neck', 'belt', 'back', 'suit_store'];

/** SS13's own flags_inv bits (code/__DEFINES/inventory.dm): what a worn item covers up. */
export const HIDE = { GLOVES: 1, SUITSTORE: 2, JUMPSUIT: 4, SHOES: 8, MASK: 16, EARS: 32, EYES: 64, FACE: 128, HAIR: 256, FACIALHAIR: 512, NECK: 1024 };

export const HAIR_COLORS = ['#090806', '#2a1c12', '#4a2d1a', '#71482a', '#a0713b', '#c9a35a', '#e6cf8b', '#b5382a', '#d8d8d8', '#8c8c8c', '#3c2f6b', '#2e6b4b'];
export const EYE_COLORS = ['#3a5fa0', '#2f7a3a', '#6b4423', '#3f2a1c', '#7a7a7a', '#8a5a2b', '#1f4f66', '#9b7a2b'];

const HEX = /^#[0-9a-f]{6}$/;
const GENDER = { m: 'M', f: 'F' };

/** The option tables (from chars.json) plus the rules for turning player input into a valid look. */
export class Looks {
  constructor(meta) {
    this.meta = meta;
    this.cats = { sk: meta.skin.map((e) => ({ n: e.n })), h: meta.hair, f: meta.facial, u: meta.underwear, t: meta.undershirt, s: meta.socks };
  }

  /** The names for one option, optionally only those that suit a body type. */
  names(cat, g = null) {
    return this.cats[cat].filter((e) => !g || !e.g || e.g === 'N' || e.g === GENDER[g]).map((e) => e.n);
  }

  /** Make any input into a look the art can draw: unknown names fall back to the first (usually "none"). */
  sanitize(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const pick = (cat, fallback) => {
      const list = this.cats[cat];
      return list.some((e) => e.n === r[cat]) ? r[cat] : fallback ?? list[0].n;
    };
    const col = (k, d) => (typeof r[k] === 'string' && HEX.test(r[k].toLowerCase()) ? r[k].toLowerCase() : d);
    return {
      g: r.g === 'f' ? 'f' : 'm',
      sk: pick('sk', 'caucasian1'),
      h: pick('h', this.cats.h.find((e) => e.n === 'Short Hair')?.n),
      hc: col('hc', HAIR_COLORS[2]),
      f: pick('f'),
      fc: col('fc', col('hc', HAIR_COLORS[2])),
      e: col('e', EYE_COLORS[0]),
      u: pick('u'),
      t: pick('t'),
      s: pick('s'),
    };
  }

  /** A random look for crew who nobody designed (SS13's random_character). */
  random(rand) {
    const one = (arr) => arr[Math.floor(rand() * arr.length)];
    const g = rand() < 0.5 ? 'm' : 'f';
    const real = (cat) => this.cats[cat].filter((e) => e.c >= 0 && (!e.g || e.g === 'N' || e.g === GENDER[g])).map((e) => e.n);
    const hc = one(HAIR_COLORS);
    return this.sanitize({
      g,
      sk: one(this.cats.sk).n,
      h: one(real('h')),
      hc,
      f: g === 'm' && rand() < 0.3 ? one(real('f')) : this.cats.f[0].n,
      fc: hc,
      e: one(EYE_COLORS),
      u: one(real('u')),
      t: rand() < 0.5 ? one(real('t')) : this.cats.t[0].n,
      s: rand() < 0.3 ? one(real('s')) : this.cats.s[0].n,
    });
  }

  /** What someone wears: `bySlot` maps a slot to the item path in it; `hands` is what is in the left and right hand, `{p: item path, on: it is lit}` or null. */
  outfit(bySlot, hands = []) {
    const o = {};
    let h = 0;
    for (const slot of WORN_SLOTS) {
      const e = bySlot[slot] && this.meta.worn[bySlot[slot]]?.[slot];
      if (e) { o[slot] = e[0]; h |= e[1] || 0; }
    }
    for (let k = 0; k < 2; k++) {                                            // what is held: the picture for that hand (a lit welding tool's own)
      const held = hands[k];
      const e = held && ((held.on && this.meta.handOn?.[held.p]) || this.meta.hand?.[held.p]);
      if (e && e[k] >= 0) o[k ? 'rh' : 'lh'] = e[k];
    }
    return { o, h };
  }

  appearance(look, bySlot, hands = []) {
    return { l: look, ...this.outfit(bySlot, hands) };
  }
}
