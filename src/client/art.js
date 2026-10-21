// Pixel-art toolkit for the UI: SS13's own HUD icons (assets/ui.png), procedurally drawn metal frames and
// cursors, and the first-person hands. Everything is drawn at 1x and scaled up with nearest-neighbour.

const loadImage = (url) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });

export const hex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export const shade = (c, k) => (k >= 0 ? c.map((v) => v + (255 - v) * k) : c.map((v) => v * (1 + k)));
export const parseHex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** UI pixel scale: 1 art pixel = S screen pixels. */
export function uiScale() { return Math.max(2, Math.min(5, Math.round(innerHeight / 270))); }

export class UiArt {
  static async load() {
    const [json, img] = await Promise.all([fetch('assets/ui.json').then((r) => r.json()), loadImage('assets/ui.png')]);
    const a = new UiArt();
    a.tiles = json.tiles;
    a.overlays = json.overlays;
    a.img = img;
    a.cache = new Map();
    return a;
  }

  has(name) { return !!this.tiles[name]; }

  /** Draw a HUD icon into ctx at (dx, dy), `s` times bigger. */
  draw(ctx, name, dx = 0, dy = 0, s = 1) {
    const t = this.tiles[name];
    if (!t) return;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.img, t[0], t[1], t[2], t[3], dx, dy, t[2] * s, t[3] * s);
  }

  /** A data: URL for an icon (used as CSS backgrounds), cached. */
  url(name) {
    const k = 'u:' + name;
    if (!this.cache.has(k)) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 32;
      this.draw(cv.getContext('2d'), name);
      this.cache.set(k, cv.toDataURL());
    }
    return this.cache.get(k);
  }

  /** 9-slice metal plate in the spirit of Marathon's HUD: bevelled steel with rivets. */
  frameURL(kind = 'steel') {
    const k = 'f:' + kind;
    if (this.cache.has(k)) return this.cache.get(k);
    const N = 12;
    const cv = document.createElement('canvas');
    cv.width = cv.height = N;
    const c = cv.getContext('2d');
    const P = kind === 'dark'
      ? { out: '#07090b', hi: '#4a525a', base: '#171b20', lo: '#0d1013', rivet: '#5c656e', rivetLo: '#0b0d10' }
      : { out: '#08090b', hi: '#9aa3ab', base: '#3b424a', lo: '#22272d', rivet: '#c5ccd2', rivetLo: '#14171a' };
    const px = (x, y, col) => { c.fillStyle = col; c.fillRect(x, y, 1, 1); };
    c.fillStyle = P.base; c.fillRect(0, 0, N, N);
    for (let i = 0; i < N; i++) { px(i, 0, P.out); px(i, N - 1, P.out); px(0, i, P.out); px(N - 1, i, P.out); }
    for (let i = 1; i < N - 1; i++) { px(i, 1, P.hi); px(1, i, P.hi); px(i, N - 2, P.lo); px(N - 2, i, P.lo); }
    // inner groove
    for (let i = 3; i < N - 3; i++) { px(i, 3, P.lo); px(3, i, P.lo); }
    for (const [x, y] of [[2, 2], [N - 4, 2], [2, N - 4], [N - 4, N - 4]]) { px(x, y, P.rivet); px(x + 1, y + 1, P.rivetLo); px(x + 1, y, P.base); }
    const u = cv.toDataURL();
    this.cache.set(k, u);
    return u;
  }

  /** Pixel-art hand cursors: 'point', 'open' (something to grab), 'grab' (holding), 'use', 'throw'. */
  cursor(kind) {
    const k = 'c:' + kind;
    if (this.cache.has(k)) return this.cache.get(k);
    let css;
    if (kind === 'throw') {
      const cv = document.createElement('canvas'); cv.width = cv.height = 64;
      this.draw(cv.getContext('2d'), 'throw_target', 0, 0, 2);
      css = `url(${cv.toDataURL()}) 32 32, crosshair`;
    } else {
      const art = CURSORS[kind] || CURSORS.point;
      const S = 2, h = art.length, w = art[0].length;
      const cv = document.createElement('canvas'); cv.width = w * S; cv.height = h * S;
      const c = cv.getContext('2d');
      const pal = { '#': '#0a0b0d', 'o': '#f2e6d8', 'x': '#c9b8a6', '+': '#ffffff' };
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const ch = art[y][x];
        if (pal[ch]) { c.fillStyle = pal[ch]; c.fillRect(x * S, y * S, S, S); }
      }
      const hot = kind === 'point' || kind === 'use' ? [5 * S, 0] : [8 * S, 7 * S];
      css = `url(${cv.toDataURL()}) ${hot[0]} ${hot[1]}, default`;
    }
    this.cache.set(k, css);
    return css;
  }
}

// 16x16 cursors: '#' outline, 'o' fill, 'x' shade
const CURSORS = {
  point: [
    '.....##.........',
    '....#oo#........',
    '....#oo#........',
    '....#oo#........',
    '....#oo####.....',
    '....#oo#oo###...',
    '.##.#oo#oo#oo##.',
    '#oo##oooooo#oo#.',
    '#ooo#ooooooooo#.',
    '.#oooooooooooo#.',
    '..#ooooooooooo#.',
    '..#oooooooooox#.',
    '...#oooooooox#..',
    '....#ooooooox#..',
    '.....#oooooo#...',
    '.....########...',
  ],
  open: [
    '......##........',
    '...##.#o#.##....',
    '..#oo##o##oo#...',
    '..#oo#oo#oo#.##.',
    '...#oo#oo#oo#oo#',
    '...#oo#oo#oo#oo#',
    '.##.#oooooo#oo#.',
    '#oo##ooooooooo#.',
    '#ooo#ooooooooo#.',
    '.#oooooooooooo#.',
    '..#ooooooooooo#.',
    '..#oooooooooox#.',
    '...#oooooooox#..',
    '....#ooooooox#..',
    '.....#oooooo#...',
    '.....########...',
  ],
  grab: [
    '................',
    '................',
    '................',
    '................',
    '....##.##.##....',
    '...#oo#oo#oo##..',
    '..##oo#oo#oo#o#.',
    '.#oo#ooooooooo#.',
    '.#oooooooooooo#.',
    '..#ooooooooooo#.',
    '..#oooooooooox#.',
    '..#ooooooooooo#.',
    '...#oooooooox#..',
    '....#ooooooox#..',
    '.....#oooooo#...',
    '.....########...',
  ],
};
CURSORS.use = CURSORS.point;

// ------------------------------------------------------------------ first-person hands
export const HAND_W = 64, HAND_H = 72;

/**
 * Paint one hand (HAND_W x HAND_H art pixels) into ctx. Right hand; the caller mirrors it for the left.
 * Held items are drawn at twice the hand's pixel size: they are closer to your eye than SS13 ever showed them.
 * o: {pose: 'hold'|'open'|'push'|'claw'|'fist', skin:[r,g,b], sleeve:[r,g,b]|null, item:{img,rect}|null}
 */
export function paintHand(ctx, o) {
  ctx.clearRect(0, 0, HAND_W, HAND_H);
  if (o.pose === 'hold' && o.item) {
    const r = o.item.rect;
    const k = 2, iw = r.w * k, ih = r.h * k;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(o.item.img, r.x, r.y, r.w, r.h, Math.round(32 - iw / 2), Math.max(0, 52 - ih), iw, ih);
  }
  ctx.save();
  ctx.translate(8, 12);
  paintHandBody(ctx, o);
  ctx.restore();
}

function paintHandBody(ctx, o) {
  const px = (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); };
  const rect = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
  const S = o.skin;
  const sk = { out: hex(shade(S, -0.72)), dk: hex(shade(S, -0.42)), lo: hex(shade(S, -0.2)), mid: hex(S), hi: hex(shade(S, 0.22)), top: hex(shade(S, 0.4)) };

  // sleeve (or bare forearm) rising from the bottom edge
  const arm = o.sleeve || S;
  const sl = { out: hex(shade(arm, -0.75)), lo: hex(shade(arm, -0.35)), mid: hex(arm), hi: hex(shade(arm, 0.2)) };
  for (let y = 45; y < 60; y++) {
    const spread = Math.floor((y - 45) / 5);
    const x0 = 15 - spread, x1 = 33 + spread;
    rect(x0, y, x1 - x0, 1, sl.mid);
    rect(x0, y, 2, 1, sl.hi);
    rect(x1 - 3, y, 3, 1, sl.lo);
    px(x0 - 1, y, sl.out); px(x1, y, sl.out);
  }
  if (o.sleeve) { rect(15, 44, 18, 2, sl.lo); rect(15, 44, 18, 1, sl.hi); px(14, 44, sl.out); px(14, 45, sl.out); px(33, 44, sl.out); px(33, 45, sl.out); }

  const pose = o.pose;

  if (pose === 'hold' || pose === 'fist') {
    const top = pose === 'fist' ? 29 : 31;
    // fist
    rect(15, top, 19, 45 - top, sk.mid);
    rect(15, top, 19, 2, sk.hi);
    rect(15, top, 2, 45 - top, sk.hi);
    rect(31, top + 2, 3, 45 - top - 2, sk.lo);
    rect(15, 42, 19, 3, sk.lo);
    for (const x of [19, 24, 29]) rect(x, top, 1, 6, sk.dk);
    for (const x of [16, 20, 25, 30]) px(x + 1, top, sk.top);
    for (let x = 15; x < 34; x++) { px(x, top - 1, sk.out); }
    for (let y = top; y < 45; y++) { px(14, y, sk.out); px(34, y, sk.out); }
    rect(16, top + 6, 17, 1, sk.lo);                    // second knuckle crease
    // thumb wrapping round the front
    rect(11, top + 4, 7, 7, sk.mid);
    rect(11, top + 4, 7, 1, sk.hi);
    rect(11, top + 10, 7, 1, sk.dk);
    for (let y = top + 4; y < top + 11; y++) px(10, y, sk.out);
    for (let x = 11; x < 18; x++) px(x, top + 3, sk.out);
    px(17, top + 5, sk.top);
  } else {
    // open hand: palm, four fingers, thumb
    const claw = pose === 'claw';
    const palm = pose === 'push' ? sk.hi : sk.mid;
    rect(16, 29, 17, 16, palm);
    rect(16, 29, 2, 16, sk.hi);
    rect(30, 29, 3, 16, sk.lo);
    rect(16, 42, 17, 3, sk.lo);
    for (let y = 29; y < 45; y++) { px(15, y, sk.out); px(33, y, sk.out); }
    const fingers = [[16, claw ? 24 : 20], [20, claw ? 22 : 17], [24, claw ? 22 : 16], [28, claw ? 24 : 19]];
    for (const [fx, fy] of fingers) {
      rect(fx, fy, 4, 30 - fy, sk.mid);
      rect(fx, fy, 1, 30 - fy, sk.hi);
      rect(fx + 3, fy + 1, 1, 29 - fy, sk.lo);
      px(fx, fy - 1, sk.out); px(fx + 1, fy - 1, sk.out); px(fx + 2, fy - 1, sk.out); px(fx + 3, fy - 1, sk.out);
      px(fx + 1, fy, sk.top);
      if (claw) { rect(fx, fy, 4, 2, sk.dk); }
      px(fx - 1, fy, sk.out);
      for (let y = fy; y < 29; y++) px(fx + 4 > 32 ? 33 : fx + 4, y, fx + 4 > 32 ? sk.out : sk.dk);
    }
    if (claw) rect(18, 31, 13, 4, sk.dk);
    // thumb
    for (let k = 0; k < 7; k++) { rect(10 + Math.floor(k / 2), 31 + k, 6, 1, sk.mid); px(9 + Math.floor(k / 2), 31 + k, sk.out); }
    rect(10, 30, 5, 1, sk.out);
    px(11, 31, sk.top);
  }
}

/** Overall colour of an item sprite (for gloves and sleeves). */
export function spriteColor(assets, spriteId) {
  const r = assets.rects[spriteId];
  return r ? r.avg.slice() : null;
}
