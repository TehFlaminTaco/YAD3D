import { SLOT_LABEL, INTENTS } from '../shared/config.js';
import { drawIcon } from './icons.js';

// SS13's own layout: the slots you reach for all the time are always on screen at the bottom left, the rest of what you wear is behind the
// blank button above them (I). The doll and internals are at the right edge; intents, throw, drop and resist at the bottom right.
const KEY = ['back', 'belt', 'id', 'lpocket', 'rpocket'];
const GRID = [                                  // [slot or null for blank, slot...] rows of the equipment grid, top to bottom
  [null, 'head', 'ears'],
  ['glasses', 'mask', 'neck'],
  ['uniform', 'suit', 'gloves'],
];
const LOW = ['shoes', 'suit_store'];            // the grid's bottom row, next to the button that opens it
const SLOT_ICON = { lpocket: 'pocket', rpocket: 'pocket', suit_store: 'suit_storage' };
const PARTS = ['chest', 'head', 'l_arm', 'r_arm', 'l_leg', 'r_leg'];
const STORE = 'yad3d.equipment';

const slotHtml = (s) => `<div class="slot" data-slot="${s}"><canvas width="32" height="32"></canvas><b></b></div>`;

/**
 * The inventory HUD while you play: your key slots (back, belt, ID, both pockets), the equipment grid behind a button (I), SS13's health
 * doll and internals, the intent buttons and throw / drop / resist. Everything is drawn with SS13's own icons. Slots take drags like the
 * old body panel did: onto a slot to wear something, onto a bag to stow it, onto your hands to hold it.
 */
export class InvHud {
  constructor(game) {
    this.game = game;
    this.open = false;                          // the equipment grid is showing
    this.visible = false;
    this.dollKey = '';
    const mk = (id, html) => { const e = document.createElement('div'); e.id = id; e.innerHTML = html; document.body.appendChild(e); return e; };
    this.slotsEl = mk('slots', `
      <div class="eq">${GRID.map((row) => row.map((s) => (s ? slotHtml(s) : '<div class="blank"></div>')).join('')).join('')}</div>
      <div class="eq-low"><button class="eqt" title="Equipment (I)"></button>${LOW.map(slotHtml).join('')}</div>
      <div class="key">${KEY.map(slotHtml).join('')}</div>`);
    this.gaugesEl = mk('gauges', `
      <div class="doll-box"><canvas class="doll" width="32" height="32"></canvas><div class="cond"></div></div>
      <button class="act" data-act="internals" title="Internals (V)"></button>
      <button class="act" data-act="pull" title="Stop pulling (P)"></button>`);
    this.actsEl = mk('acts', `
      <div class="acts-top"><button class="act half top" data-act="throw" title="Throw mode (R)"></button></div>
      <div class="acts-mid"><button class="act half bot" data-act="drop" title="Drop (Q)"></button><button class="act half bot" data-act="resist" title="Resist (B)"></button></div>
      <div class="acts-int">${INTENTS.map((k, i) => `<button class="act" data-act="intent" data-v="${i}" title="${k} (${i + 1})"></button>`).join('')}</div>`);
    this.slots = {};
    for (const el of this.slotsEl.querySelectorAll('.slot')) {
      const s = el.dataset.slot;
      el.style.backgroundImage = `url(${game.ui.art.url(SLOT_ICON[s] || s)})`;
      this.slots[s] = { el, cv: el.firstChild, cnt: el.lastChild, key: null };
    }
    this.toggleBtn = this.slotsEl.querySelector('.eqt');
    this.toggleBtn.onclick = () => this.toggle();
    this.doll = this.gaugesEl.querySelector('.doll');
    this.cond = this.gaugesEl.querySelector('.cond');
    const press = (e) => {
      const b = e.target.closest('.act');
      if (!b) return;
      const a = b.dataset.act;
      if (a === 'intent') game.key('intent', +b.dataset.v);
      else game.key(a);
    };
    this.gaugesEl.addEventListener('click', press);
    this.actsEl.addEventListener('click', press);
    try { if (localStorage.getItem(STORE) === '1') this.open = true; } catch { /* private window */ }
    this.syncOpen();
  }

  /** On screen while you play (not as a ghost, not in the lobby). */
  setVisible(v) {
    this.visible = v;
    for (const e of [this.slotsEl, this.gaugesEl, this.actsEl]) e.classList.toggle('on', v);
    if (v) this.render();
  }

  syncOpen() {
    this.slotsEl.classList.toggle('open', this.open);
    this.toggleBtn.classList.toggle('on', this.open);
  }

  toggle() { if (this.open) this.close(); else this.show(); }

  /** Show the rest of what you wear (and free the mouse so you can use it). */
  show() {
    if (this.open || !this.visible) return;
    this.open = true;
    try { localStorage.setItem(STORE, '1'); } catch { /* ignore */ }
    this.syncOpen();
    this.game.enterHands(true);
    this.game.bags.render();
    this.render();
  }

  close() {
    if (!this.open) return;
    this.open = false;
    try { localStorage.setItem(STORE, '0'); } catch { /* ignore */ }
    this.syncOpen();
    this.game.bags.render();
    this.game.panelsChanged();
  }

  /** How far up the screen the slots reach, so bag windows can stack above them. */
  topEdge() { return this.visible ? innerHeight - this.slotsEl.getBoundingClientRect().top : 0; }

  render() {
    const g = this.game, s = g.self;
    if (!this.visible || !s?.inv) return;
    const inv = s.inv, a = g.assets, art = g.ui.art;
    for (const k in this.slots) {
      const sl = this.slots[k], it = inv.worn[k];
      const key = it ? `${it.id}:${it.s}:${it.c ? it.c.length : ''}` : '';
      if (sl.key === key) continue;
      sl.key = key;
      drawIcon(sl.cv, a, it ? it.s : -1);
      sl.el.classList.toggle('full', !!it);
      sl.el.dataset.item = it ? it.id : '';
      sl.cnt.textContent = it?.c ? it.c.length : '';
      sl.el.title = it ? `${it.n}${it.st ? ' (' + it.st + ')' : ''}` : SLOT_LABEL[k];
    }
    // the buttons, drawn with SS13's own icons
    for (const b of [...this.gaugesEl.querySelectorAll('.act'), ...this.actsEl.querySelectorAll('.act')]) {
      const act = b.dataset.act;
      const icon = act === 'intent' ? INTENTS[+b.dataset.v] : act === 'internals' ? (inv.internals ? 'internal1' : 'internal0')
        : act === 'throw' ? (inv.throwMode ? 'act_throw_on' : 'act_throw_off') : act === 'drop' ? 'act_drop' : act === 'pull' ? 'pull' : 'act_resist';
      if (b._icon !== icon) { b._icon = icon; b.style.backgroundImage = `url(${art.url(icon)})`; }
      b.classList.toggle('on', act === 'intent' && INTENTS[+b.dataset.v] === inv.intent);
      if (act === 'pull') b.style.visibility = s.pulling ? '' : 'hidden';          // SS13 draws nothing for the pull button while you pull nothing
    }
    // health doll
    const [hp, max, brute, burn, tox, oxy] = s.hp;
    const dmg = brute + burn;
    const lvl = s.dead ? -1 : dmg < 5 ? 0 : dmg < 20 ? 1 : dmg < 35 ? 2 : dmg < 50 ? 3 : dmg < 65 ? 4 : 5;
    const dkey = `${lvl}`;
    if (dkey !== this.dollKey) {
      this.dollKey = dkey;
      const c = this.doll.getContext('2d');
      c.clearRect(0, 0, 32, 32);
      if (lvl < 0) art.draw(c, 'healthdoll_DEAD');
      else {
        art.draw(c, 'healthdoll_OVERLAY');
        if (lvl > 0) for (const p of PARTS) art.draw(c, p + lvl);
      }
    }
    this.cond.textContent = condition(s, hp / max, brute, burn, tox, oxy);
  }
}

/** How you'd describe yourself after a once-over, SS13-style. */
function condition(s, frac, brute, burn, tox, oxy) {
  if (s.dead) return 'You are dead.';
  const out = [];
  if (s.crit) out.push('You are barely conscious.');
  if (brute > 30) out.push('You are covered in deep bruises and cuts.');
  else if (brute > 5) out.push('You have some bruising.');
  if (burn > 25) out.push('Your skin is badly burned.');
  else if (burn > 5) out.push('You have a few burns.');
  if (oxy > 25) out.push('You can barely breathe.');
  else if (oxy > 8) out.push('You feel short of breath.');
  if (tox > 15) out.push('You feel sick.');
  if (!out.length) out.push(frac > 0.95 ? 'You feel fine.' : 'You have a few scrapes.');
  return out.join(' ');
}
