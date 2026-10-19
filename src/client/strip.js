import { drawIcon } from './icons.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

/**
 * Going through someone's things (SS13's strip window): what they hold and wear, one button each. Click something to take it
 * off them, click an empty slot to put what you are holding on them. Pockets only say whether they are full. Opened by the
 * server when you Alt+click a person or drag them onto your hands; it follows them and closes if they get away.
 */
export class StripWindow {
  constructor(game) {
    this.game = game;
    const root = document.createElement('div');
    root.id = 'strip';
    root.className = 'panel-frame';
    root.innerHTML = '<div class="st-hd"><span id="st-name"></span><button id="st-x" title="Close (Esc)">x</button></div><div class="st-body crt" id="st-body"></div>';
    document.body.appendChild(root);
    this.root = root;
    this.body = root.querySelector('#st-body');
    this.id = 0;
    this.open_ = false;
    root.querySelector('#st-x').onclick = () => this.close();
  }

  get open() { return this.open_; }

  /** A `strip` event from the server: the whole picture of that person right now (or {close: 1}). */
  show(ev) {
    if (ev.close) { this.hide(); return; }
    const g = this.game;
    const was = this.open_;
    this.id = ev.id;
    this.open_ = true;
    this.root.style.display = 'block';
    this.root.querySelector('#st-name').textContent = ev.name;
    this.body.textContent = '';
    const row = (label, content) => {
      const r = el('div', 'st-row');
      r.appendChild(el('span', 'st-lab', label));
      r.appendChild(content);
      this.body.appendChild(r);
    };
    const send = (op, slot) => g.send({ t: 'strip', op, id: ev.id, slot });
    const holding = () => g.self?.inv?.hands[g.self.inv.active];
    const slotButton = (s) => {
      if (s.ob) return el('span', 'st-ob', 'Obscured');
      const b = el('button', s.it ? 'full' : 'empty');
      if (s.it) {
        const cv = el('canvas', 'st-ico');
        cv.width = cv.height = 32;
        drawIcon(cv, g.assets, s.it.s);
        b.title = s.it.n;
        b.append(cv, el('span', '', s.it.n));
        b.onclick = () => send('take', s.k);
      } else {
        b.textContent = 'Empty';
        b.onclick = () => { if (holding()) send('put', s.k); else g.hud.say('You are not holding anything to put on them.', 'warning'); };
      }
      return b;
    };
    for (const h of ev.hands) {
      const b = h.it ? slotButton({ it: h.it, k: h.k }) : el('span', 'st-ob', 'Empty');
      row(h.l, b);
    }
    for (const s of ev.slots) row(s.l, slotButton(s));
    for (const p of ev.pockets) {
      const b = el('button', p.full ? 'full' : 'empty', p.full ? 'Full' : 'Empty');
      b.onclick = () => send('pocket', p.k);
      row(p.l, b);
    }
    if (ev.cuffs) {
      const b = el('button', 'full', 'Remove');
      b.onclick = () => send('take', 'cuffs');
      row('Handcuffed', b);
    }
    if (!was) { g.input.releaseAll(); g.enterHands(true); }
  }

  hide() {
    if (!this.open_) return;
    this.open_ = false;
    this.root.style.display = 'none';
    this.game.panelsChanged();
  }

  close() {
    if (!this.open_) return;
    this.game.send({ t: 'strip', op: 'close', id: this.id });
    this.hide();
  }
}
