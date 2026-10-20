const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

/**
 * What a stack can do (stack.dm's menu): "Amount Left", what it can make (with the 5x / 10x / 25x buttons for the things that come in
 * piles), and taking some out. Z opens it for the stack in your hand; the server sends it again after every change, or closes it when
 * the stack is gone.
 */
export class StackWindow {
  constructor(game) {
    this.game = game;
    const root = document.createElement('div');
    root.id = 'stackwin';
    root.className = 'panel-frame';
    root.innerHTML = '<div class="st-hd"><span id="sk-name"></span><button id="sk-x" title="Close (Esc)">x</button></div><div class="st-body crt" id="sk-body"></div>';
    document.body.appendChild(root);
    this.root = root;
    this.body = root.querySelector('#sk-body');
    this.id = 0;
    this.open_ = false;
    root.querySelector('#sk-x').onclick = () => this.close();
  }

  get open() { return this.open_; }

  /** A `stack` event: this stack and what it can make right now (or {close: 1}). */
  show(ev) {
    if (ev.close) { this.hide(); return; }
    const g = this.game, was = this.open_;
    this.id = ev.id;
    this.open_ = true;
    this.root.style.display = 'block';
    this.root.querySelector('#sk-name').textContent = ev.name;
    this.body.textContent = '';
    this.body.appendChild(el('div', 'sk-row sk-amount', `Amount Left: ${ev.amount}`));
    // taking some out (the DM asks "How many sheets do you wish to take out of this stack?" on Alt+click)
    const take = el('div', 'sk-row sk-take');
    take.appendChild(el('span', 'lab', 'Take out'));
    const n = el('input');
    n.type = 'number'; n.min = '1'; n.max = String(ev.amount); n.value = '1';
    const go = el('button', '', 'Take');
    go.onclick = () => g.send({ t: 'stack', op: 'take', item: ev.id, n: Math.max(1, Math.min(ev.amount, Math.floor(+n.value || 1))) });
    n.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') go.click(); };
    take.append(n, go);
    this.body.appendChild(take);
    for (const R of ev.recipes) {
      const row = el('div', 'sk-row');
      if (!R.can) { row.appendChild(el('span', 'lab dim', R.label)); this.body.appendChild(row); continue; }
      const b = el('button', '', R.label);
      b.onclick = () => g.send({ t: 'stack', op: 'make', item: ev.id, i: R.i, mult: 1 });
      row.appendChild(b);
      for (const m of R.mults.slice(1)) {
        const bm = el('button', '', `${m * R.res}x`);
        bm.onclick = () => g.send({ t: 'stack', op: 'make', item: ev.id, i: R.i, mult: m });
        row.appendChild(bm);
      }
      this.body.appendChild(row);
    }
    if (!was) { g.input.releaseAll(); g.enterHands(true); }
  }

  /** The stack is not in your hands any more: nothing to work with. */
  check() {
    if (!this.open_) return;
    const inv = this.game.self?.inv;
    if (!inv || !inv.hands.some((h) => h && h.id === this.id)) this.hide();
  }

  hide() {
    if (!this.open_) return;
    this.open_ = false;
    this.root.style.display = 'none';
    this.game.panelsChanged();
  }

  close() { this.hide(); }
}
