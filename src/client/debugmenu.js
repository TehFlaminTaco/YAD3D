import { drawIcon } from './icons.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const MAX_ROWS = 80;

/**
 * The debug menu (F3): spawn items and creatures, heal and cheat, teleport, and cause trouble. Only exists when the server was started with
 * --debug (or a local round with ?debug); the server ignores every {t: 'dbg'} message otherwise. Each button just sends an operation
 * (see src/sim/debug.js); the answers arrive as chat lines, and the people list as a `dbg` event.
 */
export class DebugMenu {
  constructor(game) {
    this.game = game;
    this.open_ = false;
    this.tab = 'items';
    this.q = '';
    this.pick = null;
    this.who = [];
    this.areaQ = '';
    const root = document.createElement('div');
    root.id = 'dbg';
    root.className = 'panel-frame';
    root.innerHTML = '<div class="db-hd"><span>Debug</span><label>Spawn <select id="db-where"><option value="hand">in my hand</option><option value="front">in front of me</option><option value="look">where I look</option></select></label><button id="db-x" title="Close (Esc or F3)">x</button></div><div class="db-tabs" id="db-tabs"></div><div class="db-body crt" id="db-body"></div>';
    document.body.appendChild(root);
    this.root = root;
    this.body = root.querySelector('#db-body');
    this.whereSel = root.querySelector('#db-where');
    try { this.whereSel.value = localStorage.getItem('yad3d.dbgwhere') || 'hand'; } catch { /* private window */ }
    this.whereSel.onchange = () => { try { localStorage.setItem('yad3d.dbgwhere', this.whereSel.value); } catch { /* ignore */ } };
    root.querySelector('#db-x').onclick = () => this.close();
    root.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); e.target.blur?.(); this.close(); } });
    const tabs = root.querySelector('#db-tabs');
    for (const [id, label] of [['items', 'Items'], ['mobs', 'Creatures'], ['me', 'Me'], ['go', 'Go'], ['world', 'Station']]) {
      const b = el('button', '', label);
      b.dataset.tab = id;
      b.onclick = () => { this.tab = id; this.render(); };
      tabs.appendChild(b);
    }
  }

  get open() { return this.open_; }
  get g() { return this.game; }

  toggle() { if (this.open_) this.close(); else this.show(); }

  show() {
    if (this.open_ || !this.g.rep?.debug) return;
    this.open_ = true;
    this.root.style.display = 'flex';
    this.g.input.releaseAll();
    this.g.enterHands(true);
    this.render();
  }

  close() {
    if (!this.open_) return;
    this.open_ = false;
    this.root.style.display = 'none';
    this.g.panelsChanged();
  }

  send(op, extra = {}) { this.g.send({ t: 'dbg', op, ...extra }); }

  /** Where a spawn goes: the mode, and the floor point under the crosshair for "where I look". */
  place() {
    const where = this.whereSel.value;
    const out = { where };
    if (where === 'look') {
      const ray = this.g.lookRay();
      const fp = this.g.floorPoint(ray.o, ray.d);
      if (fp && !fp.blocked) out.at = [+fp.x.toFixed(2), +fp.z.toFixed(2)];
      else out.where = 'front';
    }
    return out;
  }

  // ------------------------------------------------------------------ tabs
  render() {
    for (const b of this.root.querySelectorAll('#db-tabs button')) b.classList.toggle('on', b.dataset.tab === this.tab);
    this.body.textContent = '';
    this[`tab_${this.tab}`]();
  }

  section(title) { const h = el('div', 'db-sec', title); this.body.appendChild(h); return h; }

  row(...kids) { const r = el('div', 'db-line'); r.append(...kids); this.body.appendChild(r); return r; }

  button(label, fn, title) { const b = el('button', 'db-btn', label); if (title) b.title = title; b.onclick = fn; return b; }

  input(type, value, attrs = {}) { const i = document.createElement('input'); i.type = type; Object.assign(i, attrs); i.value = value; return i; }      // the limits first: a range's value is bent to fit them

  // -- items
  catalog() {
    if (!this._cat) {
      const defs = this.g.assets.level.itemdefs;
      this._cat = Object.entries(defs).map(([p, d]) => ({ p, n: d.n, s: d.s, lc: `${d.n} ${p}`.toLowerCase() })).sort((a, b) => a.n.localeCompare(b.n));
    }
    return this._cat;
  }

  tab_items() {
    const q = this.input('search', this.q, { placeholder: `search ${this.catalog().length} items by name or path`, className: 'db-search' });
    const list = el('div', 'db-list');
    const info = el('div', 'db-info');
    const amount = this.input('number', '1', { min: 1, max: 50, className: 'db-num', title: 'How many (a stack of sheets, coils or bandages counts as one thing with that many in it)' });
    const go = this.button('Spawn', () => {
      if (!this.pick) return;
      this.send('spawn', { path: this.pick.p, n: Math.max(1, +amount.value || 1), ...this.place() });
    });
    const refresh = () => {
      const terms = q.value.toLowerCase().split(/\s+/).filter(Boolean);
      this.q = q.value;
      list.textContent = '';
      let shown = 0, total = 0;
      for (const it of this.catalog()) {
        if (!terms.every((t) => it.lc.includes(t))) continue;
        total++;
        if (shown >= MAX_ROWS) continue;
        shown++;
        const row = el('div', 'db-item' + (this.pick?.p === it.p ? ' sel' : ''));
        const cv = el('canvas');
        cv.width = cv.height = 32;
        drawIcon(cv, this.g.assets, it.s);
        row.append(cv, el('b', '', it.n), el('i', '', it.p.replace('/obj/item/', '')));
        row.onclick = () => { this.pick = it; refresh(); };
        row.ondblclick = () => { this.pick = it; go.click(); };
        list.appendChild(row);
      }
      info.textContent = this.pick ? `Selected: ${this.pick.n}` : 'Click an item (double-click to spawn it).';
      if (total > shown) list.appendChild(el('div', 'db-more', `${total - shown} more: keep typing`));
      if (!total) list.appendChild(el('div', 'db-more', 'Nothing matches.'));
    };
    q.oninput = refresh;
    this.body.append(q, list, info);
    this.row(el('span', '', 'Amount'), amount, go);
    refresh();
    q.focus();
  }

  // -- creatures and people
  tab_mobs() {
    this.section('Spawn');
    this.row(...[['Space carp', 'carp'], ['Ian', 'corgi'], ['Runtime', 'cat'], ['Pun Pun', 'monkey']].map(([label, kind]) => this.button(label, () => this.send('mob', { kind, ...this.place() }))));
    const job = el('select');
    for (const j of [...(this.g.rep.jobs || [])].sort((a, b) => a.title.localeCompare(b.title))) job.appendChild(new Option(j.title, j.id));
    this.row(job, this.button('Spawn crew member', () => this.send('mob', { kind: 'crew', job: job.value, ...this.place() })));
    this.section('Who is here');
    this.row(this.button('Refresh', () => this.send('who')));
    const box = el('div', 'db-who');
    box.id = 'db-who';
    this.body.appendChild(box);
    this.drawWho();
    this.send('who');
  }

  drawWho() {
    const box = this.root.querySelector('#db-who');
    if (!box) return;
    box.textContent = '';
    for (const m of this.who) {
      const row = el('div', 'db-person' + (m.dead ? ' dead' : '') + (m.pl ? ' pl' : ''));
      row.append(el('b', '', m.n), el('i', '', `${m.job ? m.job.replace(/_/g, ' ') : m.kind}${m.dead ? ', dead' : ''}`));
      const acts = el('span', 'db-acts');
      const act = (label, fn, title) => acts.appendChild(this.button(label, () => { fn(); setTimeout(() => this.send('who'), 150); }, title));
      act('Go', () => this.send('goto', { id: m.id }), 'Teleport to them');
      act('Bring', () => this.send('bring', { id: m.id }), 'Teleport them to you');
      act('Heal', () => this.send('heal', { id: m.id }));
      if (m.dead) act('Revive', () => this.send('revive', { id: m.id }));
      else act('Kill', () => this.send('kill', { id: m.id }));
      if (!m.pl) act('Delete', () => this.send('delete', { target: { k: 'mob', id: m.id } }));
      row.appendChild(acts);
      box.appendChild(row);
    }
    if (!this.who.length) box.appendChild(el('div', 'db-more', 'Nobody (press Refresh).'));
  }

  // -- me
  tab_me() {
    const d = () => this.g.self?.dbg || {};
    this.section('Cheats');
    const check = (label, op, key) => {
      const c = this.input('checkbox', '');
      c.checked = !!d()[key];
      c.dataset.sync = key;
      c.onchange = () => this.send(op, { on: c.checked });
      const l = el('label', 'db-check');
      l.append(c, document.createTextNode(' ' + label));
      this.row(l);
    };
    check('God mode (nothing hurts you)', 'god', 'god');
    check('Noclip (walk through walls)', 'noclip', 'noclip');
    const speed = this.input('range', String(d().speed ?? 1), { min: 0.5, max: 4, step: 0.25 });
    const readout = el('span', 'db-val', `x${speed.value}`);
    speed.dataset.sync = 'speed';
    speed.oninput = () => { readout.textContent = `x${speed.value}`; };
    speed.onchange = () => this.send('speed', { v: +speed.value });
    this.row(el('span', '', 'Speed'), speed, readout);
    this.section('Body');
    this.row(this.button('Heal me', () => this.send('heal')), this.button('Revive me', () => this.send('revive')), this.button('Open every door (ID)', () => this.send('access'), 'Your ID gets every access'));
    const job = el('select');
    for (const j of [...(this.g.rep.jobs || [])].sort((a, b) => a.title.localeCompare(b.title))) job.appendChild(new Option(j.title, j.id));
    this.row(job, this.button('Wear its outfit', () => this.send('outfit', { job: job.value }), 'What you wear goes to the floor'));
    this.section('Pointer');
    this.row(this.button('Delete what I am looking at', () => {
      const ray = this.g.lookRay();
      const t = this.g.findTarget(ray.o, ray.d);
      if (t) this.send('delete', { target: this.g.ref(t) });
    }, 'A loose item, someone who is not a player, or a locker or crate'));
  }

  /** Keep the Me tab's switches in step with what the server says (it can change from elsewhere). */
  sync() {
    if (!this.open_ || this.tab !== 'me') return;
    const d = this.g.self?.dbg;
    if (!d) return;
    for (const c of this.body.querySelectorAll('[data-sync]')) {
      if (document.activeElement === c) continue;
      if (c.type === 'checkbox') c.checked = !!d[c.dataset.sync];
      else if (c.dataset.sync === 'speed') { c.value = String(d.speed ?? 1); c.nextSibling.textContent = `x${c.value}`; }
    }
  }

  // -- going places
  tab_go() {
    const areas = (this.g.assets.level.areas || []).map((a, i) => ({ i, n: a.n })).filter((a) => !/^space$/i.test(a.n)).sort((a, b) => a.n.localeCompare(b.n));
    const q = this.input('search', this.areaQ, { placeholder: 'find a room', className: 'db-search' });
    const list = el('div', 'db-list');
    const refresh = () => {
      this.areaQ = q.value;
      list.textContent = '';
      const t = q.value.toLowerCase();
      for (const a of areas) {
        if (t && !a.n.toLowerCase().includes(t)) continue;
        const row = el('div', 'db-item');
        row.append(el('b', '', a.n));
        row.onclick = () => this.send('area', { idx: a.i });
        list.appendChild(row);
      }
    };
    q.oninput = refresh;
    this.body.append(q, list);
    refresh();
    this.row(el('span', 'db-note', 'Click a room to go there.'));
    q.focus();
  }

  // -- the station
  tab_world() {
    const grp = (title, ...buttons) => { this.section(title); this.row(...buttons); };
    grp('Alert level', ...['green', 'blue', 'red'].map((l) => this.button(l[0].toUpperCase() + l.slice(1), () => this.send('alert', { level: l }))));
    grp('Power', this.button('Normal', () => this.send('power', { state: 'normal' })), this.button('Battery', () => this.send('power', { state: 'battery' })), this.button('Out', () => this.send('power', { state: 'out' })));
    grp('Gravity', this.button('On', () => this.send('gravity', { on: true })), this.button('Off', () => this.send('gravity', { on: false })), this.button('Take me out into space', () => this.send('space')));
    grp('Trouble', this.button('Meteor strike', () => this.send('strike')), this.button('3 carp where I look', () => this.send('carp', { n: 3, ...this.place() })));
    grp('Shuttle', this.button('Call', () => this.send('shuttle', { what: 'call' })), this.button('Dock now', () => this.send('shuttle', { what: 'dock' })), this.button('Depart (ends the round)', () => this.send('shuttle', { what: 'depart' })));
    grp('Doors', this.button('Open all', () => this.send('doors', { what: 'open' })), this.button('Close all', () => this.send('doors', { what: 'close' })));
    grp('Fix', this.button('Seal the hull, restore power', () => this.send('repair')));
    grp('Round', this.button('Start now (lobby)', () => this.send('round', { what: 'start' })), this.button('End it', () => this.send('round', { what: 'end' })), this.button('Skip ahead a minute', () => this.send('skip', { sec: 60 })));
  }

  /** An answer from the server. */
  reply(ev) {
    if (ev.k === 'who') { this.who = ev.mobs; if (this.open_ && this.tab === 'mobs') this.drawWho(); }
  }
}
