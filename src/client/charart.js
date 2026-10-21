import { HIDE } from '../shared/looks.js';

const CELL = 32;
const PER_GROUP = 6;                 // four directions (S, N, E, W), then lying down alive, then dead

/**
 * People are not baked sprites: this stacks the layered SS13 art (assets/chars.png, see tools/build_chars.py) into a
 * sprite for each direction, in SS13's own layer order, tinted by skin, hair and eye colour and with whatever the person
 * wears hiding what SS13 says it hides. Composed people live in a reserved strip of the sprite atlas (`DynAtlas`), so the
 * normal sprite batches draw them like anything else.
 */
export class CharArt {
  constructor(chars, charsImg, atlas) {
    this.meta = chars;
    this.img = charsImg;
    this.atlas = atlas;                                    // DynAtlas
    this.skin = Object.fromEntries(chars.skin.map((s) => [s.n, s.hex]));
    this.byName = {};
    for (const k of ['hair', 'facial', 'underwear', 'undershirt', 'socks']) this.byName[k] = new Map(chars[k].map((e) => [e.n, e.c]));
    const mk = () => { const c = document.createElement('canvas'); c.width = c.height = CELL; return c; };
    this.work = mk();                                      // the person being stacked up
    this.tmp = mk();                                       // one layer, tinted
    this.wctx = this.work.getContext('2d', { willReadFrequently: true });
    this.tctx = this.tmp.getContext('2d');
    this.groups = new Map();                               // appearance key -> {g, ref, set}
  }

  /** One cell of the sheet, drawn onto `ctx` (optionally multiplied by a colour). */
  layer(ctx, base, di, color) {
    if (base < 0) return;
    const cols = this.meta.cols, i = base + di;
    const sx = (i % cols) * CELL, sy = Math.floor(i / cols) * CELL;
    if (!color) { ctx.drawImage(this.img, sx, sy, CELL, CELL, 0, 0, CELL, CELL); return; }
    const t = this.tctx;
    t.globalCompositeOperation = 'source-over';
    t.clearRect(0, 0, CELL, CELL);
    t.drawImage(this.img, sx, sy, CELL, CELL, 0, 0, CELL, CELL);
    t.globalCompositeOperation = 'multiply';
    t.fillStyle = color;
    t.fillRect(0, 0, CELL, CELL);
    t.globalCompositeOperation = 'destination-in';        // multiply filled the empty pixels too: keep only the layer's own
    t.drawImage(this.img, sx, sy, CELL, CELL, 0, 0, CELL, CELL);
    ctx.drawImage(this.tmp, 0, 0);
  }

  /** Stack one direction (0 S, 1 N, 2 E, 3 W) of an appearance onto `ctx`. Layer order is SS13's, bottom to top. */
  paint(ctx, ap, di) {
    const m = this.meta, l = ap.l, o = ap.o || {}, h = ap.h || 0;
    const skin = this.skin[l.sk] || '#ffe0d1';
    const sx = l.g === 'f' ? 'f' : 'm';
    ctx.clearRect(0, 0, CELL, CELL);
    // body parts, tinted by skin tone
    for (const part of ['r_leg', 'l_leg', 'chest_' + sx, 'r_arm', 'l_arm', 'r_hand', 'l_hand', 'head_' + sx]) this.layer(ctx, m.body[part], di, skin);
    // BODY_LAYER: socks, underwear, undershirt, eyes
    this.layer(ctx, this.byName.socks.get(l.s) ?? -1, di);
    this.layer(ctx, this.byName.underwear.get(l.u) ?? -1, di);
    this.layer(ctx, this.byName.undershirt.get(l.t) ?? -1, di);
    if (!(h & HIDE.EYES)) this.layer(ctx, m.eyes, di, l.e);
    const worn = (slot, hideBit) => { if (o[slot] !== undefined && !(h & hideBit)) this.layer(ctx, o[slot], di); };
    worn('uniform', HIDE.JUMPSUIT);
    worn('gloves', HIDE.GLOVES);
    worn('shoes', HIDE.SHOES);
    worn('ears', HIDE.EARS);
    worn('suit', 0);
    worn('glasses', HIDE.EYES);
    worn('belt', 0);
    worn('suit_store', HIDE.SUITSTORE);
    worn('neck', HIDE.NECK);
    worn('back', 0);
    if (!(h & HIDE.HAIR)) this.layer(ctx, this.byName.hair.get(l.h) ?? -1, di, l.hc);
    if (!(h & HIDE.FACIALHAIR)) this.layer(ctx, this.byName.facial.get(l.f) ?? -1, di, l.fc);
    worn('mask', HIDE.MASK);
    worn('head', 0);
    if (o.cuffs !== undefined) this.layer(ctx, o.cuffs, di);                      // HANDCUFF_LAYER, over the clothes
    if (o.lh !== undefined) this.layer(ctx, o.lh, di);                            // HANDS_LAYER: what is held, over everything
    if (o.rh !== undefined) this.layer(ctx, o.rh, di);
  }

  /** A fresh 32x32 canvas of one direction, for the character screen and the first-person body. */
  portrait(ap, di) {
    const c = document.createElement('canvas');
    c.width = c.height = CELL;
    this.paint(c.getContext('2d'), ap, di);
    return c;
  }

  static key(ap) { return JSON.stringify(ap); }

  /**
   * Sprite ids for someone (`{d: [[S], [N], [E], [W]], dead}`, the shape the baked mob sets have). Sets are shared between
   * people who look alike and counted; give them back with `release`.
   */
  acquire(ap) {
    const key = CharArt.key(ap);
    let rec = this.groups.get(key);
    if (!rec) {
      const g = this.atlas.alloc();
      if (g < 0) return null;                              // the strip is full: show nothing rather than a wrong person
      for (let di = 0; di < 4; di++) { this.paint(this.wctx, ap, di); this.atlas.put(g, di, this.work); }
      this.paint(this.wctx, ap, 0);
      this.atlas.putLying(g, this.work);
      const s = this.atlas.sprites(g);
      rec = { key, g, ref: 0, set: { d: [[s[0]], [s[1]], [s[2]], [s[3]]], lie: s[4], dead: s[5] } };
      this.groups.set(key, rec);
    }
    rec.ref++;
    return rec.set;
  }

  release(set) {
    if (!set) return;
    for (const rec of this.groups.values()) {
      if (rec.set !== set) continue;
      if (--rec.ref <= 0) { this.atlas.free(rec.g); this.groups.delete(rec.key); }
      return;
    }
  }
}

/**
 * The strip at the bottom of the sprite atlas where composed people live. Each person takes five cells; every cell has a
 * permanent entry in `rects`, so a sprite id never changes meaning while someone is on screen.
 */
export class DynAtlas {
  constructor(canvas, rects, top, texture) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d', { willReadFrequently: true });
    this.rects = rects;
    this.top = top;                                         // first pixel row of the strip
    this.cols = Math.floor(canvas.width / CELL);
    this.rows = Math.floor((canvas.height - top) / CELL);
    this.count = Math.floor(this.cols * this.rows / PER_GROUP);
    this.texture = texture;
    this.first = rects.length;                              // sprite id of group 0, cell 0
    for (let k = 0; k < this.count * PER_GROUP; k++) rects.push(this.blank(k));
    this.free_ = Array.from({ length: this.count }, (_, i) => this.count - 1 - i);
    this.dirty = false;
  }

  blank(k) {
    const x = (k % this.cols) * CELL, y = this.top + Math.floor(k / this.cols) * CELL;
    return { x, y, w: 0, h: 0, ox: 0, oy: 0, fw: CELL, fh: CELL, avg: [128, 128, 128], u0: 0, v0: 0, u1: 0, v1: 0 };
  }

  alloc() { return this.free_.length ? this.free_.pop() : -1; }
  free(g) { this.free_.push(g); }
  sprites(g) { return [0, 1, 2, 3, 4, 5].map((k) => this.first + g * PER_GROUP + k); }

  /** Copy a 32x32 canvas into cell `k` of group `g` and set its sprite rectangle to the opaque part (like the baked sprites). */
  put(g, k, src) {
    const idx = g * PER_GROUP + k;
    const r = this.rects[this.first + idx];
    const cx = (idx % this.cols) * CELL, cy = this.top + Math.floor(idx / this.cols) * CELL;
    this.ctx.clearRect(cx, cy, CELL, CELL);
    this.ctx.drawImage(src, cx, cy);
    const d = this.ctx.getImageData(cx, cy, CELL, CELL).data;
    let x0 = CELL, y0 = CELL, x1 = -1, y1 = -1;
    for (let y = 0; y < CELL; y++) {
      for (let x = 0; x < CELL; x++) {
        if (d[(y * CELL + x) * 4 + 3] === 0) continue;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
    }
    if (x1 < 0) { x0 = y0 = 0; x1 = y1 = 0; }
    r.x = cx + x0; r.y = cy + y0; r.w = x1 - x0 + 1; r.h = y1 - y0 + 1; r.ox = x0; r.oy = y0;
    const W = this.cv.width, H = this.cv.height;
    r.u0 = r.x / W; r.v0 = r.y / H; r.u1 = (r.x + r.w) / W; r.v1 = (r.y + r.h) / H;
    this.dirty = true;
  }

  /** SS13 shows the dead as the sprite turned on its side, a little greyed. */
  putLying(g, src) {
    const turned = document.createElement('canvas');
    turned.width = turned.height = CELL;
    const c = turned.getContext('2d');
    c.translate(CELL / 2, CELL / 2);
    c.rotate(-Math.PI / 2);
    c.drawImage(src, -CELL / 2, -CELL / 2);
    const grey = document.createElement('canvas');
    grey.width = grey.height = CELL;
    const t = grey.getContext('2d');
    t.drawImage(turned, 0, 0);
    t.globalCompositeOperation = 'multiply';
    t.fillStyle = '#c8c8d8';
    t.fillRect(0, 0, CELL, CELL);
    t.globalCompositeOperation = 'destination-in';        // multiply coloured the empty pixels too
    t.drawImage(turned, 0, 0);
    this.put(g, 4, turned);                                // knocked down, alive
    this.put(g, 5, grey);                                  // dead
  }

  /** Push what changed to the GPU (once per frame at most). */
  flush() {
    if (!this.dirty) return;
    this.dirty = false;
    this.texture.needsUpdate = true;
  }
}
