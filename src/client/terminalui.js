const MAP_COLORS = { B: '#ff2a1a', W: '#3d6b55', G: '#2a8ab8', T: '#c04ad9', 4: '#1f9d5a', 3: '#7ab83a', 2: '#d9a21b', 1: '#c0501f', 0: '#3a0d0d' };

/** Green-phosphor console. The server owns the program and sends {title, html, buttons}; we draw it and relay button presses. */
export class TermUI {
  constructor(game) {
    this.game = game;
    this.open = false;
    const root = document.createElement('div');
    root.className = 'screen';
    root.id = 'term-screen';
    root.innerHTML = `<div class="term">
      <div class="hd"><span id="term-title"></span><span id="term-sub"></span></div>
      <div class="body" id="term-body"></div>
      <div class="ft" id="term-ft"></div></div>`;
    document.body.appendChild(root);
    this.root = root;
    this.title = root.querySelector('#term-title');
    this.sub = root.querySelector('#term-sub');
    this.body = root.querySelector('#term-body');
    this.ft = root.querySelector('#term-ft');
    this.buttons = [];
    this.mapData = null;
    this.ft.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.close) this.close();
      else this.press(+b.dataset.idx);
    });
  }

  event(ev) {
    if (ev.close) { this.hide(); return; }
    const was = this.open;
    this.open = true;
    this.root.classList.add('on');
    if (!was) { this.game.input.releaseAll(); this.game.enterHands(true); }
    this.title.textContent = ev.title;
    this.sub.textContent = ev.sub || '';
    const top = this.body.scrollTop;
    this.body.innerHTML = ev.html;
    this.body.scrollTop = top;
    this.buttons = ev.buttons;
    this.ft.textContent = '';
    ev.buttons.forEach((b, i) => {
      const el = document.createElement('button');
      el.textContent = `${i + 1}. ${b.l}`;
      el.dataset.idx = i;
      el.disabled = b.d;
      this.ft.appendChild(el);
    });
    const x = document.createElement('button');
    x.textContent = 'Esc. Close';
    x.dataset.close = 1;
    this.ft.appendChild(x);
    if (ev.map) this.mapData = ev.map;
    if (this.mapData) this.drawMap();
  }

  press(idx) {
    const b = this.buttons[idx];
    if (!b || b.d) return;
    this.game.send({ t: 'term', op: 'act', idx });
  }

  close() {
    if (!this.open) return;
    this.game.send({ t: 'term', op: 'close' });
    this.hide();
  }

  hide() {
    if (!this.open) return;
    this.open = false;
    this.mapData = null;
    this.root.classList.remove('on');
    this.game.panelsChanged();
  }

  drawMap() {
    const cv = this.body.querySelector('#map-cv');
    if (!cv) return;
    const { w, h, data, x0, y0 } = this.mapData;
    const cx = cv.getContext('2d');
    const S = Math.max(1, Math.floor(Math.min(cv.width / w, cv.height / h)));
    cx.fillStyle = '#020b07';
    cx.fillRect(0, 0, cv.width, cv.height);
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const ch = data[r * w + c];
        if (ch === ' ') continue;
        cx.fillStyle = MAP_COLORS[ch] || '#222';
        cx.fillRect(c * S, r * S, S, S);
      }
    }
    const g = this.game;
    const px = (g.pred.x / 2 - x0) * S, pz = (g.pred.z / 2 - y0) * S;
    cx.fillStyle = '#fff';
    cx.fillRect(px - 2, pz - 2, 5, 5);
  }
}
