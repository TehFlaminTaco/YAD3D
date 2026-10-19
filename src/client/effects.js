/**
 * What your body tells you instead of a health bar: SS13's own full-screen damage overlays (the red edges as you
 * get hurt, the black closing in as you suffocate, tunnel vision in crit), a flash when hit, the blue edge of
 * vacuum, a visor when you wear a helmet, and the colour draining out of the world as you weaken.
 */
export class ScreenFX {
  constructor(game) {
    this.game = game;
    const root = document.createElement('div');
    root.id = 'fx';
    root.innerHTML = '<canvas id="fx-visor"></canvas><div id="fx-vac"></div><img id="fx-oxy" alt=""><img id="fx-brute" alt=""><img id="fx-crit" alt=""><div id="fx-flash"></div>';
    document.body.appendChild(root);
    this.root = root;
    const $ = (id) => root.querySelector('#' + id);
    this.el = { visor: $('fx-visor'), vac: $('fx-vac'), oxy: $('fx-oxy'), brute: $('fx-brute'), crit: $('fx-crit'), flash: $('fx-flash') };
    this.cur = {};
    this.flashV = 0;
    this.visorKind = '';
  }

  flash(v = 0.8) { this.flashV = Math.max(this.flashV, v); }

  setImg(key, el, url) {
    if (this.cur[key] === url) return;
    this.cur[key] = url;
    if (url) { el.src = 'assets/' + url; el.style.display = 'block'; } else el.style.display = 'none';
  }

  setOp(key, el, v) {
    const s = v.toFixed(2);
    if (this.cur[key] !== s) { this.cur[key] = s; el.style.opacity = s; }
  }

  /** Helmet visor: a dark rounded frame with a glint, drawn to fit the window. */
  drawVisor(kind) {
    const cv = this.el.visor;
    if (this.visorKind === kind && cv.width === innerWidth) return;
    this.visorKind = kind;
    cv.width = innerWidth; cv.height = innerHeight;
    const c = cv.getContext('2d');
    c.clearRect(0, 0, cv.width, cv.height);
    if (!kind) { cv.style.display = 'none'; return; }
    cv.style.display = 'block';
    const W = cv.width, H = cv.height;
    if (kind === 'locker') {                              // shut in a locker: darkness and a few vent slits to look through
      c.fillStyle = 'rgba(5,7,9,0.95)';
      c.fillRect(0, 0, W, H);
      c.globalCompositeOperation = 'destination-out';
      const sw = W * 0.36, sh = Math.max(3, H / 120), gap = sh * 2.6;
      for (let k = 0; k < 7; k++) c.fillRect((W - sw) / 2, H * 0.2 + k * gap, sw, sh);
      c.globalCompositeOperation = 'source-over';
      return;
    }
    c.fillStyle = kind === 'helmet' ? 'rgba(6,8,10,0.94)' : 'rgba(4,6,8,0.55)';
    c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'destination-out';
    c.beginPath();
    const rx = W * (kind === 'helmet' ? 0.47 : 0.56), ry = H * (kind === 'helmet' ? 0.5 : 0.62);
    c.ellipse(W / 2, H * 0.47, rx, ry, 0, 0, Math.PI * 2);
    c.fill();
    c.globalCompositeOperation = 'source-over';
    if (kind === 'helmet') {
      const g = c.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, 'rgba(180,220,255,0.10)'); g.addColorStop(0.35, 'rgba(180,220,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.beginPath(); c.ellipse(W / 2, H * 0.47, rx, ry, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(90,110,130,0.55)'; c.lineWidth = Math.max(2, H / 180);
      c.beginPath(); c.ellipse(W / 2, H * 0.47, rx, ry, 0, 0, Math.PI * 2); c.stroke();
    }
  }

  update(dt) {
    const g = this.game, s = g.self, ov = g.ui.art.overlays;
    const playing = g.phase === 'playing' && s;
    this.flashV = Math.max(0, this.flashV - dt * 3);
    this.setOp('flash', this.el.flash, this.flashV * 0.55);
    if (!playing) {
      for (const k of ['oxy', 'brute', 'crit']) this.setImg(k, this.el[k], null);
      this.setOp('vac', this.el.vac, 0);
      this.drawVisor('');
      this.setFilter('');
      return;
    }
    const [hp, max, , , , oxy] = s.hp;
    const frac = Math.max(0, hp / max);
    // brute overlay: SS13 shows more red as health drops
    const bi = frac >= 0.9 ? 0 : frac >= 0.75 ? 1 : frac >= 0.6 ? 2 : frac >= 0.45 ? 3 : frac >= 0.3 ? 4 : frac >= 0.15 ? 5 : 6;
    this.setImg('brute', this.el.brute, bi ? ov.brutedamageoverlay[bi] : null);
    const oi = Math.min(10, Math.floor(oxy / 9));
    this.setImg('oxy', this.el.oxy, oi > 0 ? ov.oxydamageoverlay[oi] : null);
    const ci = s.crit ? Math.min(10, 3 + Math.floor((1 - frac) * 8)) : 0;
    this.setImg('crit', this.el.crit, ci ? ov.passage[ci] : null);
    const vac = g.rep.env.p < 30;
    this.setOp('vac', this.el.vac, vac ? (s.suit ? 0.15 : 0.6) : 0);
    const inv = s.inv;
    const head = inv?.worn.head, mask = inv?.worn.mask;
    this.drawVisor(s.inside ? 'locker' : head?.tg?.includes('helmet') ? 'helmet' : mask?.tg?.includes('mask') && inv.internals ? 'mask' : '');
    const sat = Math.max(0.15, Math.min(1, frac * 1.25));
    this.setFilter(s.crit ? `saturate(0.2) blur(${(1.5).toFixed(1)}px)` : sat < 0.99 ? `saturate(${sat.toFixed(2)})` : '');
  }

  setFilter(f) {
    if (this.cur.filter === f) return;
    this.cur.filter = f;
    this.game.canvas.style.filter = f;
  }
}
