import { SLOT_LABEL, INTENTS } from '../shared/config.js';
import { drawIcon } from './icons.js';

const LEFT = ['head', 'glasses', 'mask', 'ears', 'neck'];
const RIGHT = ['suit', 'uniform', 'gloves', 'shoes', 'suit_store'];
const BELT = ['back', 'belt', 'id', 'lpocket', 'rpocket'];
const SLOT_ICON = { lpocket: 'pocket', rpocket: 'pocket', suit_store: 'suit_storage' };
const PARTS = ['chest', 'head', 'l_arm', 'r_arm', 'l_leg', 'r_leg'];

/**
 * Looking yourself over (I): everything you wear on SS13's paper doll, how hurt you are on SS13's health doll,
 * and the intent / internals / throw toggles. Drag items onto a slot to wear them, onto a bag to stow them.
 */
export class BodyPanel {
  constructor(game) {
    this.game = game;
    this.open = false;
    const root = document.createElement('div');
    root.id = 'body';
    root.className = 'panel-frame';
    const col = (list) => list.map((s) => `<div class="slot" data-slot="${s}"><canvas width="32" height="32"></canvas><b></b></div>`).join('');
    root.innerHTML = `
      <div class="bp-head"><span class="bp-name"></span><span class="bp-job"></span></div>
      <div class="bp-main">
        <div class="bp-col">${col(LEFT)}</div>
        <div class="bp-mid"><canvas class="bp-doll" width="32" height="32"></canvas><div class="bp-cond"></div></div>
        <div class="bp-col">${col(RIGHT)}</div>
      </div>
      <div class="bp-row">${col(BELT)}</div>
      <div class="bp-acts">
        ${INTENTS.map((k, i) => `<button class="act" data-act="intent" data-v="${i}" title="${k} (${i + 1})"></button>`).join('')}
        <button class="act" data-act="internals" title="Internals (V)"></button>
        <button class="act wide" data-act="throw" title="Throw mode (R)"></button>
        <button class="act wide" data-act="drop" title="Drop (Q)"></button>
        <button class="act wide" data-act="resist" title="Resist (B)"></button>
        <button class="act" data-act="pull" title="Stop pulling (P)"></button>
      </div>`;
    document.body.appendChild(root);
    this.root = root;
    this.slots = {};
    for (const el of root.querySelectorAll('.slot')) {
      const s = el.dataset.slot;
      el.style.backgroundImage = `url(${game.ui.art.url(SLOT_ICON[s] || s)})`;
      this.slots[s] = { el, cv: el.firstChild, cnt: el.lastChild, key: null };
    }
    this.doll = root.querySelector('.bp-doll');
    this.cond = root.querySelector('.bp-cond');
    root.querySelector('.bp-acts').addEventListener('click', (e) => {
      const b = e.target.closest('.act');
      if (!b) return;
      const a = b.dataset.act;
      if (a === 'intent') game.key('intent', +b.dataset.v);
      else game.key(a === 'internals' ? 'internals' : a);
    });
    this.dollKey = '';
  }

  toggle() { if (this.open) this.close(); else this.show(); }

  show() {
    if (this.open || this.game.phase !== 'playing') return;
    this.open = true;
    this.root.classList.add('on');
    this.game.enterHands(true);
    this.render();
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.root.classList.remove('on');
    this.game.panelsChanged();
  }

  render() {
    const g = this.game, s = g.self;
    if (!this.open || !s?.inv) return;
    const inv = s.inv, a = g.assets, art = g.ui.art;
    this.root.querySelector('.bp-name').textContent = s.name;
    this.root.querySelector('.bp-job').textContent = g.rep.jobMap[s.job]?.title || '';
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
    // actions, drawn with SS13's own buttons
    const acts = this.root.querySelectorAll('.act');
    acts.forEach((b) => {
      const act = b.dataset.act;
      let icon = act === 'intent' ? INTENTS[+b.dataset.v] : act === 'internals' ? (inv.internals ? 'internal1' : 'internal0')
        : act === 'throw' ? (inv.throwMode ? 'act_throw_on' : 'act_throw_off') : act === 'drop' ? 'act_drop' : act === 'pull' ? 'pull' : 'act_resist';
      if (b._icon !== icon) { b._icon = icon; b.style.backgroundImage = `url(${art.url(icon)})`; }
      b.classList.toggle('on', act === 'intent' && INTENTS[+b.dataset.v] === inv.intent);
      if (act === 'pull') b.style.visibility = s.pulling ? '' : 'hidden';          // SS13 draws nothing for the pull button while you pull nothing
    });
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
