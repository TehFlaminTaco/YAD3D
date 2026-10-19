import { drawIcon } from './icons.js';

const DRAG_START = 6;          // pixels the pointer must travel before a press becomes a drag

/**
 * Hands mode: the cursor is your hand. Click to use what you hold on whatever is under the cursor; press on
 * anything you can carry (lying in the world, in your hands, in a bag, on your body) and drag it somewhere else:
 * a hand, a slot, a bag, a spot on the floor or a table, a person (to use it on them), or off into the distance
 * (to throw it). Right-click examines.
 */
export class DragDrop {
  constructor(game) {
    this.game = game;
    this.pending = null;
    this.drag = null;
    const ghost = document.createElement('canvas');
    ghost.id = 'drag-ghost';
    ghost.width = ghost.height = 32;
    document.body.appendChild(ghost);
    this.ghost = ghost;
    document.addEventListener('pointerdown', (e) => this.down(e));
    addEventListener('pointermove', (e) => this.move(e));
    addEventListener('pointerup', (e) => this.up(e));
    document.addEventListener('contextmenu', (e) => this.context(e));
  }

  enabled() {
    const g = this.game;
    return g.mode === 'hands' && g.phase === 'playing' && g.self && !g.self.dead && !g.self.crit;
  }

  uiCell(el) { return el && el.closest ? el.closest('#hands [data-hand], #bags .cell, #body .slot') : null; }

  down(e) {
    if (!this.enabled() || e.button !== 0) return;
    if (e.target.closest && e.target.closest('.bag-h, button, input, #chat, .screen, #pda')) return;
    const ui = this.uiCell(e.target);
    if (ui) {
      this.pending = { kind: 'ui', el: ui, id: +ui.dataset.item || 0, x: e.clientX, y: e.clientY };
      e.preventDefault();
      return;
    }
    if (e.target === this.game.canvas) {
      const t = this.game.cursorTarget;
      this.pending = { kind: 'world', target: t, id: t && t.k === 'item' ? t.id : 0, x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
  }

  move(e) {
    const g = this.game;
    g.mouse.x = e.clientX; g.mouse.y = e.clientY;
    g.mouse.overCanvas = e.target === g.canvas;
    const p = this.pending;
    if (p && !this.drag && p.id && Math.hypot(e.clientX - p.x, e.clientY - p.y) > DRAG_START) this.start(p);
    if (this.drag) this.placeGhost(e.clientX, e.clientY);
  }

  start(p) {
    const g = this.game;
    const info = p.kind === 'world' ? g.rep.items.get(p.id) : g.invIndex.get(p.id)?.it;
    if (!info) { this.pending = null; return; }
    this.drag = { ...p, s: info.s, name: info.n || info.n };
    this.ghost.width = this.ghost.height = 32;
    this.ghost._s = undefined;
    drawIcon(this.ghost, g.assets, info.s);
    this.ghost.style.width = this.ghost.style.height = 32 * (g.ui.P + 1) + 'px';
    this.ghost.style.display = 'block';
    this.placeGhost(p.x, p.y);
    if (p.kind === 'world') g.view.hideItem(p.id, true);
    else p.el.classList.add('lifted');
    document.body.classList.add('dragging');
    g.audio.play('pickup', { vol: 0.25 });
  }

  placeGhost(x, y) {
    const w = this.ghost.offsetWidth;
    // held just above the fingertip, so you can see where it will land
    this.ghost.style.transform = `translate(${x - w / 2}px, ${y - w * 1.05}px)`;
  }

  up(e) {
    if (e.button !== 0) return;
    const p = this.pending, d = this.drag;
    this.pending = null;
    this.drag = null;
    if (d) {
      this.ghost.style.display = 'none';
      document.body.classList.remove('dragging');
      if (d.kind === 'ui') d.el.classList.remove('lifted');
      if (this.enabled()) this.drop(e, d);
      if (d.kind === 'world') setTimeout(() => this.game.view.hideItem(d.id, false), 700);
      return;
    }
    if (p && this.enabled()) this.click(p, e);
  }

  // ---------------------------------------------------------------- clicks
  click(p, e) {
    const g = this.game, inv = g.self.inv;
    const held = inv.hands[inv.active];
    const send = (m) => g.send({ t: 'inv', ...m });
    if (p.kind === 'world') { g.clickWorld(p.target, g.rayAt(e.clientX, e.clientY).d); return; }
    const el = p.el;
    const it = p.id ? g.invIndex.get(p.id)?.it : null;
    const toggle = (id) => send({ op: inv.open.includes(id) ? 'close' : 'open', item: id });
    if (el.dataset.hand !== undefined) {
      const i = +el.dataset.hand;
      if (i !== inv.active) { g.key('swap'); return; }
      if (it?.cap) toggle(it.id); else if (it) { g.key('activate'); g.hands.bump(i, 'use'); }
      return;
    }
    if (el.dataset.slot !== undefined) {
      if (!it) { if (held) send({ op: 'move', item: held.id, to: { t: 'slot', slot: el.dataset.slot } }); return; }
      if (it.cap) { if (held && held.id !== it.id) send({ op: 'use', item: it.id }); else toggle(it.id); return; }
      send({ op: 'take', item: it.id });
      return;
    }
    // an item in a bag
    if (!it) return;
    if (held && it.cap && held.id !== it.id) send({ op: 'use', item: it.id });
    else if (it.cap && !held) toggle(it.id);
    else send({ op: 'take', item: it.id });
  }

  context(e) {
    if (this.game.mode !== 'hands' || this.game.phase !== 'playing') return;
    const g = this.game;
    const ui = this.uiCell(e.target);
    if (ui) {
      e.preventDefault();
      if (+ui.dataset.item) g.send({ t: 'examine', target: { k: 'item', id: +ui.dataset.item } });
      return;
    }
    if (e.target === g.canvas) {
      e.preventDefault();
      const t = g.cursorTarget;
      if (t) g.send({ t: 'examine', target: g.ref(t) });
    }
  }

  // ---------------------------------------------------------------- drops
  drop(e, d) {
    const g = this.game, inv = g.self.inv;
    const id = d.id;
    const move = (to) => g.send({ t: 'inv', op: 'move', item: id, to });
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const cell = this.uiCell(el);
    const cellId = cell ? +cell.dataset.item || 0 : 0;
    if (cell && cellId === id) return;                                  // dropped back where it was
    // onto a container: put it inside
    if (cellId) {
      const tgt = g.invIndex.get(cellId)?.it;
      if (tgt?.cap) { move({ t: 'box', id: cellId }); g.audio.play('equip', { vol: 0.3 }); }
      else g.hud.say('There is something there already.', 'warning');
      return;
    }
    if (cell && cell.dataset.hand !== undefined) { move({ t: 'hand', i: +cell.dataset.hand }); return; }
    if (cell && cell.dataset.slot !== undefined) { move({ t: 'slot', slot: cell.dataset.slot }); return; }
    const box = el && el.closest ? el.closest('#bags [data-box]') : null;
    if (box) { if (+box.dataset.box !== id) move({ t: 'box', id: +box.dataset.box }); return; }
    if (el === g.canvas) this.dropWorld(e, d, move);
  }

  dropWorld(e, d, move) {
    const g = this.game, inv = g.self.inv;
    const src = d.kind === 'world' ? { t: 'floor' } : g.invIndex.get(d.id)?.where;
    if (!src) return;
    const { o, d: dir } = g.rayAt(e.clientX, e.clientY);
    const t = g.findTarget(o, dir);
    // a held thing dragged onto a person, door, machine or hole: use it on them
    if (src.t === 'hand' && t && t.k !== 'item') {
      if (src.i !== inv.active) g.key('swap');
      g.clickWorld(t, dir);
      return;
    }
    const fp = g.floorPoint(o, dir);
    if (fp && fp.ok) { move({ t: 'floor', x: +fp.x.toFixed(3), z: +fp.z.toFixed(3) }); g.audio.play('drop', { vol: 0.25 }); return; }
    if (src.t === 'floor') return;
    // out of reach: throw it there
    const far = fp ? [fp.x, fp.y, fp.z] : [o.x + dir.x * 9, o.y + dir.y * 9, o.z + dir.z * 9];
    g.send({ t: 'inv', op: 'throw', item: d.id, at: far.map((v) => +v.toFixed(3)) });
    g.hands.bump(src.t === 'hand' ? src.i : inv.active, 'throw');
  }
}
