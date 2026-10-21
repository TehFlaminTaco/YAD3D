import * as THREE from 'three';

const RUNE_LIFE = 5;             // seconds a line of speech hangs over someone's head
const RUNE_RANGE = 18;           // metres
const RUNE_GAP = 0.12;           // metres between the top of someone's picture and their words
const RUNE_EDGE = 6;             // pixels kept clear at the top of the screen
const nameColor = (name) => {
  let h = 0;
  for (const ch of name || '') h = (h * 33 + ch.charCodeAt(0)) >>> 0;
  return `hsl(${h % 360}, 70%, 78%)`;
};

/**
 * The little that is left on screen: a crosshair (when looking around), the name of what you point at, the
 * progress of whatever you are busy doing, and speech floating over people's heads (SS13 runechat).
 */
export class Hud {
  constructor(game) {
    this.game = game;
    const root = document.createElement('div');
    root.id = 'hud';
    root.className = 'hidden';
    root.innerHTML = `
      <div id="runechat"></div>
      <div id="cross"></div><div id="hover"></div>
      <div id="progress"><i></i></div>
      <div id="ghostbar"></div>
      <div id="toast"></div>`;
    document.body.appendChild(root);
    this.root = root;
    const $ = (id) => root.querySelector('#' + id);
    this.el = { cross: $('cross'), hover: $('hover'), progress: $('progress'), runechat: $('runechat'), ghost: $('ghostbar'), toast: $('toast') };
    this.cache = {};
    this.speakers = new Map();      // mob id -> {box, lines: [{el, born}]}
    this.dead = false;
    this.v = new THREE.Vector3();
    this.toastUntil = 0;
  }

  show(v) { this.root.classList.toggle('hidden', !v); }
  say(text, cls = 'notice') { this.game.chat.add({ k: cls, text }); }
  flash() { this.game.fx.flash(0.8); }

  onPhase(phase) {
    this.root.classList.toggle('ghost', phase === 'ghost');
    if (phase !== 'ghost') this.dead = false;
    this.renderGhostBar();
  }

  onGhost(ev) {
    this.dead = !ev.escaped;
    this.renderGhostBar();
  }

  renderGhostBar() {
    if (this.game.phase !== 'ghost') { this.el.ghost.style.display = 'none'; return; }
    this.el.ghost.style.display = 'block';
    this.el.ghost.textContent = this.dead ? 'You are dead. Only other ghosts can hear you.' : 'You are observing. Press I to go back to the lobby.';
  }

  /** A short line of text at the bottom of the screen (mode changes, how-to hints). */
  toast(text, sec = 2.5) {
    if (this.game.panelOpen) return;
    this.el.toast.textContent = text;
    this.el.toast.classList.add('on');
    this.toastUntil = this.game.time + sec;
  }

  progress(frac, label) {
    const p = this.el.progress;
    if (frac === undefined || frac < 0) { p.style.display = 'none'; return; }
    p.style.display = 'block';
    p.title = label || '';
    p.firstChild.style.width = Math.round(frac * 100) + '%';
  }

  // ---------------------------------------------------------------- runechat
  addBubble(id, text) {
    // not your own: your head is the camera, and your mob's record is never moved (you are predicted), so it would hang where you spawned
    if (id === this.game.rep.you?.id) return;
    let sp = this.speakers.get(id);
    if (!sp) {
      const box = document.createElement('div');
      box.className = 'rune';
      this.el.runechat.appendChild(box);
      const m = this.game.rep.mobs.get(id);
      sp = { box, lines: [], color: nameColor(m?.n) };
      this.speakers.set(id, sp);
    }
    const line = document.createElement('div');
    line.textContent = text;
    line.style.color = sp.color;
    sp.box.appendChild(line);
    sp.lines.push({ el: line, born: this.game.time, life: RUNE_LIFE + text.length * 0.03 });
    while (sp.lines.length > 3) sp.lines.shift().el.remove();
  }

  updateRunes() {
    const g = this.game;
    for (const [id, sp] of this.speakers) {
      for (let i = sp.lines.length - 1; i >= 0; i--) {
        const L = sp.lines[i], age = g.time - L.born;
        if (age > L.life) { L.el.remove(); sp.lines.splice(i, 1); continue; }
        const o = age > L.life - 0.6 ? (L.life - age) / 0.6 : Math.min(1, age * 6);
        L.el.style.opacity = o.toFixed(2);
      }
      const m = g.rep.mobs.get(id);
      if (!sp.lines.length || !m) { sp.box.remove(); this.speakers.delete(id); continue; }
      const dist = Math.hypot(m.x - g.pred.x, m.z - g.pred.z);
      // sits just above the top of the picture as it is drawn (a corgi, a person lying down and a carp are not 2 m tall)
      const mp = g.view.mobPose(m);                                          // (where their feet are in the scene: not the same as `m.x, m.z` when you float free, turned as you are)
      this.v.set(mp.x, mp.y + (g.view.mobViews.get(id)?.top ?? 1.8) + RUNE_GAP, mp.z).project(g.camera);
      const vis = this.v.z < 1 && Math.abs(this.v.x) < 1.1 && this.v.y > -1.1 && this.v.y < 3 && dist < RUNE_RANGE && m.g === g.pred.g && g.myGrid().world.los(g.pred.x, g.pred.z, m.x, m.z);
      sp.box.style.display = vis ? 'block' : 'none';
      if (!vis) continue;
      // up close the head is above the top of the screen: keep the words on it
      const px = (this.v.x + 1) / 2 * innerWidth, py = (1 - this.v.y) / 2 * innerHeight;
      const y = py < RUNE_EDGE + sp.box.offsetHeight ? RUNE_EDGE + sp.box.offsetHeight : py;
      sp.box.style.transform = `translate(-50%, -100%) translate(${px.toFixed(0)}px, ${y.toFixed(0)}px)`;
    }
  }

  // ---------------------------------------------------------------- per frame
  update() {
    const g = this.game, e = this.el;
    if (this.toastUntil && (g.time > this.toastUntil || g.panelOpen)) { this.toastUntil = 0; e.toast.classList.remove('on'); }
    if (this.root.classList.contains('hidden')) return;
    this.updateRunes();
    const look = g.mode === 'look';
    const showCross = look && g.phase === 'playing';
    if (this.cache.cross !== showCross) { this.cache.cross = showCross; e.cross.style.display = showCross ? 'block' : 'none'; }
    if (this.cache.hot !== !!g.target) { this.cache.hot = !!g.target; e.cross.classList.toggle('hot', !!g.target); }
    // name of the thing under the crosshair / cursor
    const t = look ? g.target : (g.dnd.drag ? null : g.cursorTarget);
    const name = g.phase === 'playing' && t ? t.name : '';
    if (this.cache.hover !== name) { this.cache.hover = name; e.hover.textContent = name; e.hover.style.display = name ? 'block' : 'none'; }
    const ax = look ? innerWidth / 2 : g.mouse.x + 18, ay = look ? innerHeight / 2 + 22 : g.mouse.y + 20;
    const pos = `translate(${Math.round(ax)}px, ${Math.round(ay)}px)${look ? ' translateX(-50%)' : ''}`;
    if (name && this.cache.pos !== pos) { this.cache.pos = pos; e.hover.style.transform = pos; }
    const pp = `translate(${Math.round(look ? innerWidth / 2 : g.mouse.x)}px, ${Math.round(look ? innerHeight / 2 + 48 : g.mouse.y + 44)}px) translateX(-50%)`;
    if (this.cache.pp !== pp) { this.cache.pp = pp; e.progress.style.transform = pp; }
  }
}
