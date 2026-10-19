import { drawIcon } from './icons.js';

const COLS = 7;

/**
 * Open containers (backpacks, boxes, belts, toolboxes...) as little windows of SS13 storage slots. Drag things in
 * and out of them, to your hands, your body, other bags or the floor. Drag a window by its strap to move it.
 */
export class Bags {
  constructor(game) {
    this.game = game;
    const root = document.createElement('div');
    root.id = 'bags';
    document.body.appendChild(root);
    this.root = root;
    this.wins = new Map();          // container id -> {el, sig}
    this.pos = new Map();           // container id -> [x, y] (moved by the player)
    this.moving = null;
    addEventListener('pointermove', (e) => this.dragMove(e));
    addEventListener('pointerup', () => { this.moving = null; });
  }

  get openIds() { return [...this.wins.keys()]; }

  render() {
    const g = this.game, inv = g.self?.inv;
    const want = inv && g.phase === 'playing' ? inv.open.filter((id) => g.invIndex.get(id)?.it.c) : [];
    for (const [id, w] of this.wins) if (!want.includes(id)) { w.el.remove(); this.wins.delete(id); }
    want.forEach((id, k) => {
      const it = g.invIndex.get(id).it;
      let w = this.wins.get(id);
      if (!w) { w = this.makeWindow(id); this.wins.set(id, w); }
      const sig = it.n + '|' + it.c.map((c) => `${c.id}:${c.s}:${c.amt ?? ''}:${c.c ? c.c.length : ''}`).join(',') + '|' + JSON.stringify(it.cap);
      if (sig !== w.sig) { w.sig = sig; this.fill(w, it); }
      this.place(id, w, k);
    });
  }

  makeWindow(id) {
    const g = this.game;
    const el = document.createElement('div');
    el.className = 'bag panel-frame';
    el.dataset.box = id;
    el.innerHTML = '<div class="bag-h"><canvas class="bag-icon" width="32" height="32"></canvas><span class="bag-n"></span><span class="bag-fill"><i></i></span><button class="bag-x" title="Close"></button></div><div class="bag-g"></div>';
    this.root.appendChild(el);
    el.querySelector('.bag-x').style.backgroundImage = `url(${g.ui.art.url('backpack_close')})`;
    el.querySelector('.bag-x').addEventListener('click', (e) => { e.stopPropagation(); g.send({ t: 'inv', op: 'close', item: id }); });
    el.querySelector('.bag-h').addEventListener('pointerdown', (e) => {
      if (e.target.closest('.bag-x')) return;
      const r = el.getBoundingClientRect();
      this.moving = { id, dx: e.clientX - r.left, dy: e.clientY - r.top };
      e.preventDefault(); e.stopPropagation();
    });
    return { el, sig: '' };
  }

  fill(w, it) {
    const g = this.game, a = g.assets;
    w.el.querySelector('.bag-n').textContent = it.n;
    drawIcon(w.el.querySelector('.bag-icon'), a, it.s);
    const cap = it.cap || {};
    const fill = w.el.querySelector('.bag-fill');
    if (cap.w) { fill.style.display = ''; fill.firstChild.style.width = Math.min(100, Math.round((cap.used / cap.w) * 100)) + '%'; fill.title = `${cap.used} / ${cap.w}`; } else fill.style.display = 'none';
    const n = cap.n ? cap.n : Math.max(COLS, it.c.length + (cap.used < cap.w ? 1 : 0));
    const grid = w.el.querySelector('.bag-g');
    grid.textContent = '';
    grid.style.gridTemplateColumns = `repeat(${Math.min(COLS, n)}, var(--cell))`;
    for (let k = 0; k < n; k++) {
      const c = it.c[k];
      const cell = document.createElement('div');
      cell.className = 'cell' + (c ? ' full' : '');
      if (c) {
        cell.dataset.item = c.id;
        cell.innerHTML = '<canvas width="32" height="32"></canvas><b></b>';
        drawIcon(cell.firstChild, a, c.s);
        cell.lastChild.textContent = c.c ? c.c.length : c.amt > 1 ? c.amt : '';
        cell.title = c.n + (c.st ? ` (${c.st})` : '');
      }
      grid.appendChild(cell);
    }
  }

  place(id, w, k) {
    const el = w.el;
    const p = this.pos.get(id);
    if (p) { el.style.left = p[0] + 'px'; el.style.top = p[1] + 'px'; el.style.bottom = 'auto'; return; }
    // default: stacked up the left side, above your left hand (the right side is where you look yourself over)
    const S = this.game.ui.S;
    el.style.left = Math.round(innerWidth * 0.025) + 'px';
    el.style.top = 'auto';
    el.style.bottom = `${Math.round(innerHeight * 0.3 + k * (el.offsetHeight + 4 * S))}px`;
  }

  dragMove(e) {
    if (!this.moving) return;
    const w = this.wins.get(this.moving.id);
    if (!w) { this.moving = null; return; }
    const x = Math.max(0, Math.min(innerWidth - 40, e.clientX - this.moving.dx));
    const y = Math.max(0, Math.min(innerHeight - 30, e.clientY - this.moving.dy));
    this.pos.set(this.moving.id, [x, y]);
    w.el.style.left = x + 'px'; w.el.style.top = y + 'px'; w.el.style.bottom = 'auto';
  }

  closeAll() { for (const id of this.openIds) this.game.send({ t: 'inv', op: 'close', item: id }); }
}
