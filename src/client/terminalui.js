const MAP_COLORS = { B: '#ff2a1a', W: '#3d6b55', G: '#2a8ab8', T: '#c04ad9', 4: '#1f9d5a', 3: '#7ab83a', 2: '#d9a21b', 1: '#c0501f', 0: '#3a0d0d' };
const GLASS = '#03110a';

/** A console: a steel bezel round a green CRT, with a row of numbered keys under the glass.
 *  The server owns the program and sends {title, sub, html, buttons}; we draw it and relay key presses. */
export class TermUI {
  constructor(game) {
    this.game = game;
    this.open = false;
    const root = document.createElement('div');
    root.className = 'screen';
    root.id = 'term-screen';
    root.innerHTML = `<div class="term panel-frame">
      <div class="hd"><span id="term-title"></span><span id="term-sub"></span></div>
      <div class="term-crt crt"><div class="body scroll" id="term-body"></div></div>
      <div class="ft" id="term-ft"></div></div>`;
    document.body.appendChild(root);
    this.root = root;
    this.title = root.querySelector('#term-title');
    this.sub = root.querySelector('#term-sub');
    this.body = root.querySelector('#term-body');
    this.ft = root.querySelector('#term-ft');
    this.buttons = [];
    this.mapData = null;
    this.html = null;
    this.keySig = null;
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
    if (!was) { this.game.input.releaseAll(); this.game.enterHands(true); this.html = null; this.keySig = null; }
    this.title.textContent = ev.title;
    this.sub.textContent = ev.sub || '';
    // Live programs refresh every second: only touch the glass when the text actually changed, so a selection,
    // the scroll position and the map canvas survive the refresh.
    if (ev.html !== this.html) {
      const top = this.body.scrollTop;
      this.body.innerHTML = ev.html;
      this.body.scrollTop = top;
      this.html = ev.html;
    }
    this.buttons = ev.buttons;
    const sig = JSON.stringify(ev.buttons);
    if (sig !== this.keySig) {
      this.keySig = sig;
      this.ft.textContent = '';
      ev.buttons.forEach((b, i) => this.ft.appendChild(this.key(i < 9 ? String(i + 1) : '', b.l, { idx: i }, b.d)));
      this.ft.appendChild(this.key('Esc', 'Close', { close: 1 }));
    }
    if (ev.map) this.mapData = ev.map;
    if (this.mapData) this.drawMap();
  }

  /** One steel key: a green legend ("1", "Esc") and a label. */
  key(legend, label, data, disabled = false) {
    const el = document.createElement('button');
    if (legend) { const k = document.createElement('kbd'); k.textContent = legend; el.appendChild(k); }
    el.appendChild(document.createTextNode(label));
    Object.assign(el.dataset, data);
    el.disabled = !!disabled;
    return el;
  }

  press(idx) {
    const b = this.buttons[idx];
    if (!b || b.d) return;
    const el = this.ft.querySelector(`button[data-idx="${idx}"]`);
    if (el) { el.classList.add('down'); setTimeout(() => el.classList.remove('down'), 110); }
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
    this.html = null;
    this.root.classList.remove('on');
    this.game.panelsChanged();
  }

  drawMap() {
    const cv = this.body.querySelector('#map-cv');
    if (!cv) return;
    const { w, h, data, x0, y0 } = this.mapData;
    const cx = cv.getContext('2d');
    const S = Math.max(1, Math.floor(Math.min(cv.width / w, cv.height / h)));
    cx.fillStyle = GLASS;
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
    const px = Math.round((g.pred.x / 2 - x0) * S), pz = Math.round((g.pred.z / 2 - y0) * S);
    cx.fillStyle = '#000';
    cx.fillRect(px - 3, pz - 3, 7, 7);
    cx.fillStyle = '#fff';
    cx.fillRect(px - 2, pz - 2, 5, 5);
  }
}
