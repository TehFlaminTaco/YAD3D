import { KIND } from '../shared/config.js';

const pad = (v) => String(v).padStart(2, '0');

/**
 * Your PDA (Tab), if you carry one: station time, where you are, an atmospheric scan and a map that fills in as
 * you explore. This is where the information the old HUD used to throw at you now lives.
 */
export class PDA {
  constructor(game) {
    this.game = game;
    this.open = false;
    const root = document.createElement('div');
    root.id = 'pda';
    root.className = 'panel-frame';
    root.innerHTML = `
      <div class="pda-top"><span class="pda-brand">Thinktronic PDA</span><span class="pda-owner"></span></div>
      <div class="pda-screen crt">
        <div class="pda-lines"><div class="pda-time"></div><div class="pda-loc"></div><div class="pda-air"></div></div>
        <canvas class="pda-map" width="560" height="360"></canvas>
      </div>
      <div class="pda-foot">Tab to put it away</div>`;
    document.body.appendChild(root);
    this.root = root;
    this.$ = (c) => root.querySelector('.' + c);
    this.seen = null;
    this.seenAcc = 0;
  }

  /** The PDA you carry (hands first, then worn, then inside things you wear), or null. */
  find() {
    const inv = this.game.self?.inv;
    if (!inv) return null;
    for (const [, e] of this.game.invIndex) if (e.it.tg?.split(' ').includes('pda')) return e.it;
    return null;
  }

  toggle() { if (this.open) this.close(); else this.show(); }

  show() {
    const g = this.game;
    if (this.open) return;
    if (g.phase === 'playing') {
      const p = this.find();
      if (!p) { g.hud.say("You don't have a PDA.", 'warning'); return; }
      this.root.querySelector('.pda-owner').textContent = p.n;
      g.audio.play('beep', { vol: 0.3 });
    } else if (g.phase === 'ghost') {
      this.root.querySelector('.pda-owner').textContent = 'observer';
    } else return;
    this.open = true;
    this.root.classList.add('on');
    g.enterHands(true);
    this.draw();
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.root.classList.remove('on');
    this.game.panelsChanged();
  }

  /** Reveal tiles near the player (with line of sight) so the map fills in as you explore. */
  updateSeen(dt) {
    const g = this.game;
    if (g.phase !== 'playing') return;
    const w = g.myGrid().world;
    if (!this.seen) this.seen = new Uint8Array(w.W * w.H);
    this.seenAcc += dt;
    if (this.seenAcc < 0.35) return;
    this.seenAcc = 0;
    const pc = Math.floor(g.pred.x / 2), pr = Math.floor(g.pred.z / 2);
    const R = 9;
    for (let r = pr - R; r <= pr + R; r++) {
      for (let c = pc - R; c <= pc + R; c++) {
        if (!w.inb(c, r)) continue;
        const dx = c - pc, dr = r - pr;
        if (dx * dx + dr * dr > R * R) continue;
        const i = w.idx(c, r);
        if (this.seen[i]) continue;
        if (Math.abs(dx) + Math.abs(dr) <= 2 || w.los(g.pred.x, g.pred.z, (c + 0.5) * 2, (r + 0.5) * 2)) this.seen[i] = 1;
      }
    }
  }

  update(dt) {
    this.updateSeen(dt);
    if (!this.open) return;
    if (this.game.phase === 'playing' && !this.find()) { this.close(); return; }
    this.drawAcc = (this.drawAcc || 0) + dt;
    if (this.drawAcc > 0.25) { this.drawAcc = 0; this.draw(); }
  }

  draw() {
    const g = this.game, rep = g.rep, w = g.myGrid().world;
    // station time: shifts start at noon, like SS13's clock
    const t = Math.floor(rep.roundClock);
    const hh = 12 + Math.floor(t / 3600), mm = Math.floor(t / 60) % 60;
    this.$('pda-time').textContent = `Station time ${pad(hh)}:${pad(mm)}`;
    const pc = Math.floor(g.pred.x / 2), pr = Math.floor(g.pred.z / 2);
    this.$('pda-loc').textContent = 'Location: ' + (w.areaAt(pc, pr)?.n || 'unknown');
    const e = rep.env;
    this.$('pda-air').textContent = g.phase === 'playing'
      ? `Air: ${e.p.toFixed(0)} kPa, oxygen ${e.p > 0.5 ? Math.round(e.o2 / e.p * 100) : 0}%${e.tox > 0.3 ? ', toxins present' : ''}`
      : '';
    if (!this.seen) this.seen = new Uint8Array(w.W * w.H);
    const cv = this.$('pda-map'), cx = cv.getContext('2d');
    const all = g.phase === 'ghost';
    let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
    for (let r = 0; r < w.H; r++) for (let c = 0; c < w.W; c++) if (all ? w.kind[w.idx(c, r)] !== KIND.SPACE : this.seen[w.idx(c, r)]) { x0 = Math.min(x0, c); x1 = Math.max(x1, c); y0 = Math.min(y0, r); y1 = Math.max(y1, r); }
    if (x1 < 0) { x0 = pc - 20; x1 = pc + 20; y0 = pr - 15; y1 = pr + 15; }
    x0 = Math.min(x0, pc - 12); x1 = Math.max(x1, pc + 12); y0 = Math.min(y0, pr - 9); y1 = Math.max(y1, pr + 9);
    const S = Math.max(2, Math.floor(Math.min(cv.width / (x1 - x0 + 3), cv.height / (y1 - y0 + 3))));
    cx.fillStyle = '#04120a'; cx.fillRect(0, 0, cv.width, cv.height);
    const ox = Math.floor((cv.width - (x1 - x0 + 1) * S) / 2), oy = Math.floor((cv.height - (y1 - y0 + 1) * S) / 2);
    for (let r = y0; r <= y1; r++) {
      for (let c = x0; c <= x1; c++) {
        const i = w.idx(c, r);
        if (!all && !this.seen[i]) continue;
        const k = w.kind[i];
        if (w.doorAt.get(i)) cx.fillStyle = '#c8e84a';
        else if (k === KIND.WALL) cx.fillStyle = w.glass[i] ? '#3fa0c8' : '#3fe07a';
        else if (k === KIND.FLOOR || k === KIND.LATTICE) cx.fillStyle = w.solid[i] ? '#145a32' : '#0b2c19';
        else continue;
        cx.fillRect(ox + (c - x0) * S, oy + (r - y0) * S, S, S);
      }
    }
    for (const i of w.breached) { if (!all && !this.seen[i]) continue; cx.fillStyle = w.ventsToSpace(i) ? '#ff3a2a' : '#e8a030'; cx.fillRect(ox + ((i % w.W) - x0) * S - 1, oy + (Math.floor(i / w.W) - y0) * S - 1, S + 2, S + 2); }
    const px = ox + (g.pred.x / 2 - x0) * S, pz = oy + (g.pred.z / 2 - y0) * S;
    cx.save(); cx.translate(px, pz); cx.rotate(-g.yaw);
    cx.fillStyle = (performance.now() / 400) % 2 < 1 ? '#ffffff' : '#bfffd8';
    cx.beginPath(); cx.moveTo(0, -S * 1.8); cx.lineTo(S * 1.1, S); cx.lineTo(-S * 1.1, S); cx.closePath(); cx.fill(); cx.restore();
  }
}
