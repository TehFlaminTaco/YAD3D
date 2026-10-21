import { paintHand, spriteColor, HAND_W, HAND_H } from './art.js';

const SKINS = [[241, 200, 165], [226, 178, 140], [198, 143, 102], [160, 108, 72], [122, 75, 46]];
const POSE = { help: 'open', disarm: 'push', grab: 'claw', harm: 'fist' };

/**
 * Your two hands at the bottom of the view, holding whatever you hold. The active hand is raised; empty hands
 * show your intent (open palm, shove, grab, fist); throw mode cocks the arm back. They are also drag sources and
 * drop targets in hands mode, so you can pull things out of them and drop things into them.
 */
export class Hands {
  constructor(game) {
    this.game = game;
    const root = document.createElement('div');
    root.id = 'hands';
    document.body.appendChild(root);
    this.root = root;
    this.h = [0, 1].map((i) => {
      const el = document.createElement('div');
      el.className = 'hand ' + (i ? 'right' : 'left');
      el.dataset.hand = i;
      el.innerHTML = `<div class="hand-anim"><canvas width="${HAND_W}" height="${HAND_H}"></canvas></div>`;
      root.appendChild(el);
      const cv = el.querySelector('canvas');
      const sp = { x: { x: 0, v: 0 }, y: { x: 30, v: 0 }, r: { x: 0, v: 0 }, sx: { x: 1, v: 0 }, sy: { x: 1, v: 0 } };
      return { el, anim: el.firstChild, cv, ctx: cv.getContext('2d'), key: '', item: null, sp };
    });
    this.lastYaw = 0; this.lastPitch = 0;
    this.light = 1;
    this.recent = new Map();            // item id -> {x, y, t}: where a floor item was on screen when it vanished
    this.skin = SKINS[0];
  }

  setOwner(name) {
    let h = 0;
    for (const ch of name || '') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    this.skin = SKINS[h % SKINS.length];
  }

  /** Your hands are the colour of your character's skin. */
  setSkin(hex) {
    const n = parseInt(hex.slice(1), 16);
    this.skin = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  show(v) { this.root.style.display = v ? 'block' : 'none'; }

  /** Remember where a floor item was on screen, so if it turns up in a hand it can fly there. */
  noteVanished(id, sx, sy) { this.recent.set(id, { x: sx, y: sy, t: performance.now() }); }

  render() {
    const g = this.game, s = g.self, inv = s?.inv;
    if (!inv) return;
    const a = g.assets;
    const gloves = inv.worn.gloves ? spriteColor(a, inv.worn.gloves.s) : null;
    const sleeve = inv.worn.suit ? spriteColor(a, inv.worn.suit.s) : inv.worn.uniform ? spriteColor(a, inv.worn.uniform.s) : null;
    const skin = gloves || this.skin;
    inv.hands.forEach((it, i) => {
      const H = this.h[i];
      const active = inv.active === i;
      const pose = it ? 'hold' : active ? POSE[inv.intent] || 'open' : 'open';
      const key = `${it ? it.id + ':' + it.s : '-'}|${pose}|${skin}|${sleeve}`;
      const prev = H.item;
      H.item = it;
      H.el.dataset.item = it ? it.id : '';
      H.el.classList.toggle('active', active);
      H.el.classList.toggle('full', !!it);
      H.el.title = '';
      if (key !== H.key) {
        H.key = key;
        paintHand(H.ctx, { pose, skin, sleeve, item: it ? { img: a.spriteImg, rect: a.rects[it.s] } : null });
      }
      if (it && (!prev || prev.id !== it.id)) {
        const from = this.recent.get(it.id);
        if (from && performance.now() - from.t < 1500) this.flyIn(it, from, i);
        else this.bump(i, 'catch');
        this.recent.delete(it.id);
      } else if (!it && prev) this.bump(i, 'drop');
    });
  }

  rect(i) { return this.h[i].el.getBoundingClientRect(); }

  /** The picked-up thing sails from where it lay into your hand. */
  flyIn(it, from, i) {
    const a = this.game.assets, r = a.rects[it.s];
    if (!r) return;
    const S = this.game.ui.H * 2;
    const cv = document.createElement('canvas');
    cv.width = r.w; cv.height = r.h;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.drawImage(a.spriteImg, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    cv.className = 'flyer';
    cv.style.width = r.w * S + 'px'; cv.style.height = r.h * S + 'px';
    document.body.appendChild(cv);
    const to = this.rect(i);
    const tx = to.left + to.width / 2 - (r.w * S) / 2, ty = to.top + to.height * 0.3 - (r.h * S) / 2;
    const fx = from.x - (r.w * S) / 2, fy = from.y - (r.h * S) / 2;
    const H = this.h[i];
    H.cv.style.visibility = 'hidden';
    cv.animate([
      { transform: `translate(${fx}px, ${fy}px) scale(0.5)`, opacity: 0.9 },
      { transform: `translate(${tx}px, ${ty}px) scale(1.4)`, opacity: 1 },
    ], { duration: 190, easing: 'cubic-bezier(.3,.6,.4,1)' }).onfinish = () => { cv.remove(); H.cv.style.visibility = ''; this.bump(i, 'catch'); };
  }

  // ---------------------------------------------------------------- springs
  // Every hand hangs on a set of loose, under-damped springs (position, tilt, squash): gestures just kick
  // them, and they wobble back. Dorky on purpose.

  /** Kick a hand's springs: x/y in art pixels per second, r in degrees per second, sx/sy in scale per second. */
  kick(i, k) {
    const H = this.h[i];
    if (!H) return;
    for (const c in k) H.sp[c].v += k[c];
  }

  /** Short gestures: 'use' (jab), 'swing' (harm), 'throw', 'swap', 'catch', 'drop', 'wiggle', 'step'. */
  bump(i, kind) {
    i = i ?? this.game.self?.inv?.active ?? 0;
    const side = i === 0 ? -1 : 1;
    switch (kind) {
      case 'use': this.kick(i, { y: -260, x: -60 * side, sy: 4.0, sx: -2.2 }); break;
      case 'swing': this.kick(i, { r: -900 * side, x: -260 * side, y: -160, sx: 2.5, sy: -1.8 }); break;
      case 'throw': this.kick(i, { y: -420, r: -700 * side, x: -150 * side, sy: 5.4, sx: -2.9 }); break;
      case 'catch': this.kick(i, { y: 260, sy: -5.0, sx: 4.0, r: 120 * side }); break;
      case 'drop': this.kick(i, { y: -150, r: 260 * side, sx: 1.4 }); break;
      case 'wiggle': this.kick(i, { r: 520 * side, sy: 1.8 }); this.kick(1 - i, { r: -200 * side }); break;
      case 'swap': this.kick(0, { y: 320, sy: -2.7 }); this.kick(1, { y: 320, sy: -2.7 }); break;
      case 'step': this.kick(i, { y: 70, sy: -1.6, sx: 0.9 }); break;
      default: break;
    }
  }

  /** A footstep: both hands jiggle, alternating. */
  step(run) {
    this.stepN = (this.stepN || 0) + 1;
    const i = this.stepN % 2;
    this.kick(i, { y: run ? 100 : 60, sy: run ? -1.3 : -0.8, sx: 0.5, r: (i ? 1 : -1) * (run ? 60 : 30) });
    this.kick(1 - i, { y: run ? 50 : 25 });
  }

  /** Per frame: springs toward where each hand wants to be, sway with the view, dim them in the dark. */
  update(dt, st) {
    const g = this.game, inv = g.self?.inv;
    if (!inv) return;
    const S = g.ui.H;
    let dy = g.yaw - this.lastYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const dp = g.pitch - this.lastPitch;
    this.lastYaw = g.yaw; this.lastPitch = g.pitch;
    const lightK = Math.exp(-6 * dt);
    this.light = this.light * lightK + st.light * (1 - lightK);
    // intent changed: the empty hand shakes itself into its new pose
    if (this.lastIntent && this.lastIntent !== inv.intent) this.bump(inv.active, 'wiggle');
    this.lastIntent = inv.intent;
    if (this.lastActive !== undefined && this.lastActive !== inv.active) this.bump(inv.active, 'catch');
    this.lastActive = inv.active;
    const h = 1 / 120;
    inv.hands.forEach((it, i) => {
      const H = this.h[i];
      const active = inv.active === i;
      const side = i === 0 ? -1 : 1;
      const cocked = active && inv.throwMode && it;
      const T = {
        x: cocked ? 6 * side : 0,
        y: (active ? 0 : 9) + (cocked ? -4 : 0) + (st.crouch || 0) * 22,
        r: cocked ? 22 * side : active ? 0 : 7 * side,
        sx: 1, sy: 1,
      };
      // looking around drags the hands behind the view, on the same springs
      H.sp.x.v += -dy * 600 * (active ? 1 : 0.8);
      H.sp.y.v += dp * 420;
      for (const c in H.sp) {
        const p = H.sp[c];
        const k = c === 'sx' || c === 'sy' ? 260 : c === 'r' ? 160 : 140;
        const damp = c === 'sx' || c === 'sy' ? 9 : 7.5;
        // small fixed substeps: same wobble at 20 fps as at 144
        for (let rem = dt; rem > 1e-5; rem -= h) {
          const hh = Math.min(rem, h);
          p.v += (k * (T[c] - p.x) - damp * p.v) * hh;
          p.x += p.v * hh;
        }
      }
      const x = Math.max(-24, Math.min(24, H.sp.x.x)) * S, y = Math.max(-30, Math.min(40, H.sp.y.x)) * S;
      const sx = Math.max(0.6, Math.min(1.5, H.sp.sx.x)), sy = Math.max(0.6, Math.min(1.5, H.sp.sy.x));
      const tr = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${H.sp.r.x.toFixed(2)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
      if (H.tr !== tr) { H.tr = tr; H.anim.style.transform = tr; }
      const b = (Math.max(0.22, Math.min(1.25, this.light)) * (active ? 1 : 0.82)).toFixed(2);
      if (H.b !== b) { H.b = b; H.cv.style.filter = `brightness(${b})`; }
    });
  }
}
