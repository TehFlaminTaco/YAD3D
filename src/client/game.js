import * as THREE from 'three';
import { TILE, EYE, REACH, RENDER_HEIGHT, KIND } from '../shared/config.js';
import { stepMovement, floatState } from '../shared/movement.js';
import { WINDOWS } from '../shared/windows.js';
import { WALLS, girderLook } from '../shared/walls.js';
import { clamp } from '../shared/util.js';
import { Input } from './input.js';
import { Replica } from './state.js';
import { WorldView } from './view.js';
import { AudioSys } from './audio.js';
import { U } from '../render/materials.js';
import { uiScale } from './art.js';
import { Hud } from './hud.js';
import { ChatUI } from './chatui.js';
import { Hands } from './hands.js';
import { Bags } from './bags.js';
import { InvHud } from './invhud.js';
import { PDA } from './pda.js';
import { ScreenFX } from './effects.js';
import { DragDrop } from './dnd.js';
import { TermUI } from './terminalui.js';
import { Lobby } from './lobby.js';
import { Screens } from './screens.js';
import { CharEditor } from './charedit.js';
import { BodyView } from './bodyview.js';
import { StripWindow } from './strip.js';
import { DebugMenu } from './debugmenu.js';

const SEND_EVERY = 0.045;             // seconds between input batches
const INTERP_DELAY = 0.13;            // remote mobs are drawn this far in the past
const DROP_REACH = 3.0;               // how far from you a dragged thing can be set down (the server allows a little more)
const HINT_KEY = 'yad3d.handsHint';

/**
 * The client: renders the replicated world, turns keyboard and mouse into input messages and click targets,
 * predicts our own movement, and hosts the UI. All rules are enforced by whoever hosts the round.
 *
 * Two ways to use the mouse: LOOK (pointer captured, crosshair, click what you aim at) and HANDS (Space: the
 * pointer is free and is your hand; point at anything, click it, drag things between the world, your hands,
 * your bags and your body). Opening the inventory, a bag, the PDA or a console switches to hands by itself.
 */
export class Game {
  constructor(canvas, assets, conn, opts = {}, art) {
    this.canvas = canvas;
    this.assets = assets;
    this.conn = conn;
    this.opts = opts;
    this.time = 0;
    this.phase = 'connecting';          // connecting | lobby | playing | ghost
    this.mode = 'look';                 // look | hands
    this.rep = null;
    this.view = null;
    this.ui = { art, S: uiScale() };

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(0x000000, 1);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, 16 / 9, 0.08, 140);
    this.camera.rotation.order = 'YXZ';

    this.input = new Input(canvas);
    if (opts.nolock) this.input.force();
    this.input.guard = () => this.inWorld();
    // what the page may not swallow (Ctrl+W closes the tab whatever we do): ask before leaving a round. Not in headless runs.
    addEventListener('beforeunload', (e) => { if (this.inWorld() && !this.input.forced) { e.preventDefault(); e.returnValue = ''; } });
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) navigator.keyboard?.unlock?.(); });
    this.audio = new AudioSys();
    this.pred = { x: 0, z: 0, vx: 0, vz: 0 };
    this.corr = { x: 0, z: 0 };
    this.yaw = 0;
    this.pitch = 0;
    this.seq = 0;
    this.pending = [];
    this.sendBuf = [];
    this.sendAcc = 0;
    this.wind = null;
    this.bob = 0;
    this.stepAcc = 0;
    this.moving = 0;
    this.floating = false;                // no gravity under you (set each frame in playerUpdate)
    this.shakeAmt = 0;
    this.target = null;                 // what the crosshair is on (look mode)
    this.cursorTarget = null;           // what the pointer is on (hands mode)
    this.mouse = { x: innerWidth / 2, y: innerHeight / 2, overCanvas: false };
    this.holdT = 0;
    this.lobbyYaw = 0;
    this.access = new Set();
    this.invIndex = new Map();          // item id -> {it, where} for everything you carry
    this.autoHands = false;             // hands mode was entered by opening a panel, not by Space
    this.tmpV = new THREE.Vector3();
    this.tmpC = [0, 0, 0];

    this.fx = new ScreenFX(this);
    this.hud = new Hud(this);
    this.hands = new Hands(this);
    this.bodyview = new BodyView(this);       // your own body, in the 3D scene
    this.bags = new Bags(this);
    this.inv = new InvHud(this);
    this.pda = new PDA(this);
    this.chat = new ChatUI(this);
    this.term = new TermUI(this);
    this.lobby = new Lobby(this);
    this.screens = new Screens(this);
    this.charedit = new CharEditor(this);
    this.strip = new StripWindow(this);
    this.debugMenu = new DebugMenu(this);
    this.dnd = new DragDrop(this);
    this.hands.show(false);

    const root = document.documentElement.style;
    for (const k of ['point', 'open', 'grab', 'throw']) root.setProperty('--cur-' + k, art.cursor(k));
    root.setProperty('--frame', `url(${art.frameURL('steel')})`);
    root.setProperty('--frame-dark', `url(${art.frameURL('dark')})`);
    root.setProperty('--slot-bg', `url(${art.url('template')})`);

    this.resize();
    addEventListener('resize', () => this.resize());
    canvas.addEventListener('click', () => {
      this.audio.ensure();
      if (this.mode === 'look' && !this.input.locked && this.inWorld()) this.input.lock();
    });
    this.input.onLockChange = (locked) => {
      if (locked) this.applyMode('look');
      else if (this.mode === 'look' && this.inWorld()) this.applyMode('hands');      // Esc frees the mouse: you get your hand
    };
  }

  // ---------------------------------------------------------------- setup
  send(msg) { this.conn.send(msg); }

  resize() {
    const h = Math.min(RENDER_HEIGHT, Math.max(240, Math.floor(innerHeight / (innerHeight > 900 ? 2 : 1.6))));
    const aspect = innerWidth / innerHeight;
    this.renderer.setSize(Math.round(h * aspect), h, false);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.ui.S = uiScale();
    document.documentElement.style.setProperty('--s', this.ui.S);
    this.ui.P = Math.max(1, Math.floor(innerHeight / 360));
    this.ui.H = Math.max(3, innerHeight / 150);          // hands are drawn big: they are right in front of your face
    document.documentElement.style.setProperty('--p', this.ui.P);
    document.documentElement.style.setProperty('--h', this.ui.H.toFixed(2));
  }

  /** Your skin tone changed what your hands look like. */
  ownLookChanged() {
    const mine = this.myAppearance(), hex = mine && this.assets.chars.skin.find((k) => k.n === mine.l.sk)?.hex;
    if (hex) { this.hands.setSkin(hex); this.hands.render(); }
  }

  /** What you are wearing, as the server last told us (for the mirror's mannequin). */
  myAppearance() {
    const m = this.rep?.you ? this.rep.mobs.get(this.rep.you.id) : null;
    return m?.ap || null;
  }

  /** Called once the server's welcome arrives: build the replica and everything that draws it. */
  onWelcome(w) {
    document.getElementById('boot')?.remove();
    const rep = this.rep = new Replica(this.assets, w);
    this.view = new WorldView(this.scene, this.assets, rep, this.opts);
    this.me = w.you;
    rep.on('fdoor', (ev) => this.view.setFdoor(rep.fdoors[ev.i]));
    rep.on('cl', (ev) => this.view.setClosetView(rep.props.interact[ev.i]));
    rep.on('tile', (ev) => this.view.tilesChanged([[ev.i % rep.world.W, Math.floor(ev.i / rep.world.W)]]));
    rep.on('pane', (ev) => this.view.tilesChanged([[ev.c, ev.r]]));
    rep.on('bs+', (ev) => this.view.addBuilt(rep.built.get(ev.id)));
    rep.on('bs~', (ev) => this.view.updateBuilt(rep.built.get(ev.id)));
    rep.on('bs-', (ev) => this.view.removeBuilt(ev.id));
    rep.on('evac', (ev) => this.view.onEvac(ev));
    rep.on('pm', (ev) => this.view.propMoved(rep.props.interact[ev.i]));
    rep.on('imv', (ev) => this.view.moveItem(ev.id));
    rep.on('item+', (ev) => this.view.addItem(rep.items.get(ev.id)));
    rep.on('item-', (ev) => { this.noteVanished(rep.lastRemoved); this.view.removeItem(ev.id); });
    rep.on('mob+', (ev) => { this.view.addMob(rep.mobs.get(ev.id)); if (ev.id === rep.you?.id) this.ownLookChanged(); });
    rep.on('mob-', (ev) => this.view.removeMob(ev.id));
    rep.on('look', (ev) => { this.view.refreshMob(ev.id); if (ev.id === rep.you?.id) this.ownLookChanged(); });
    rep.on('strip', (ev) => this.strip.show(ev));
    rep.on('dbg', (ev) => this.debugMenu.reply(ev));
    rep.on('mirror', (ev) => this.charedit.show({ mode: 'mirror', look: ev.look, outfit: () => this.myAppearance(), onChange: (look) => this.send({ t: 'mirror', look }) }));
    rep.on('power', () => this.view.rebuildLights());
    rep.on('area', () => this.view.rebuildLights());
    rep.on('flicker', (ev) => this.view.flickerLights(ev.s, this.time));
    rep.on('self', (ev) => this.onSelf(ev));
    rep.on('msg', (ev) => this.chat.add(ev));
    rep.on('snd', (ev) => this.audio.play(ev.n, { x: ev.x, z: ev.z, vol: ev.v }));
    rep.on('beam', (ev) => this.view.addBeam(ev.a, ev.b, ev.col, this.time));
    rep.on('prog', (ev) => this.hud.progress(ev.f, ev.label));
    rep.on('term', (ev) => this.term.event(ev));
    rep.on('round', () => this.lobby.update());
    rep.on('report', (ev) => this.screens.showReport(ev));
    rep.on('ghost', (ev) => this.hud.onGhost(ev));
    rep.on('shake', (ev) => this.shake(ev.a));
    rep.on('hurt', (ev) => { this.fx.flash(Math.min(1, 0.4 + ev.a / 20)); this.shake(Math.min(0.5, ev.a / 25)); });
    rep.on('bubble', (ev) => this.hud.addBubble(ev.id, ev.text));
    rep.on('toss', (ev) => this.view.addToss(ev.id, ev.a, ev.b, this.time));
    for (const m of rep.mobs.values()) this.view.addMob(m);
    this.phase = rep.myState === 'ghost' ? 'ghost' : 'lobby';
    this.lobby.update();
  }

  /** Our own inventory and vitals changed. */
  onSelf(s) {
    this.access = new Set(s.access);
    this.debugMenu.sync();
    this.invIndex.clear();
    if (s.inv) {
      const walk = (it, where) => {
        if (!it) return;
        this.invIndex.set(it.id, { it, where });
        if (it.c) for (const c of it.c) walk(c, { t: 'box', id: it.id });
      };
      s.inv.hands.forEach((it, i) => walk(it, { t: 'hand', i }));
      for (const k in s.inv.worn) walk(s.inv.worn[k], { t: 'slot', slot: k });
    }
    const before = this.bags.openIds.length;
    const mine = this.myAppearance(), hex = mine && this.assets.chars.skin.find((k) => k.n === mine.l.sk)?.hex;
    if (hex) this.hands.setSkin(hex); else this.hands.setOwner(s.name);
    this.hands.root.classList.toggle('cuffed', !!s.cuffed);
    this.hands.render();
    this.bags.render();
    this.inv.render();
    // a bag opened from the keyboard (Z on a held backpack) needs a free hand to use it
    if (this.bags.openIds.length > before && this.mode === 'look') this.enterHands(true);
    if (!this.bags.openIds.length && before) this.panelsChanged();
  }

  /** A floor item vanished: if it was near and on screen, remember where, so it can fly into a hand. */
  noteVanished(it) {
    if (!it || this.phase !== 'playing') return;
    if (Math.hypot(it.x - this.pred.x, it.z - this.pred.z) > REACH + 1.5) return;
    this.tmpV.set(it.x, it.y + 0.2, it.z).project(this.camera);
    if (this.tmpV.z > 1) return;
    this.hands.noteVanished(it.id, (this.tmpV.x + 1) / 2 * innerWidth, (1 - this.tmpV.y) / 2 * innerHeight);
  }

  onSnap(s) {
    const rep = this.rep;
    if (!rep) return;
    rep.applySnap(s, this.time);
    const you = s.you;
    this.wind = you.wind || null;
    const phase = you.id ? 'playing' : rep.myState === 'ghost' ? 'ghost' : 'lobby';
    if (phase !== this.phase) this.setPhase(phase, you);
    if (this.inWorld()) this.reconcile(you, s.ack);
    else { this.pred.x = you.x; this.pred.z = you.z; }
  }

  setPhase(phase, you) {
    const was = this.phase;
    this.phase = phase;
    this.pred.x = you.x; this.pred.z = you.z; this.pred.vx = you.vx || 0; this.pred.vz = you.vz || 0;
    this.corr.x = this.corr.z = 0;
    this.pending = []; this.sendBuf = [];
    if (phase === 'playing' && was !== 'playing') {
      if (was === 'lobby') this.chat.clearOlderThan(this.time - 1.5);
      this.audio.ensure();
    }
    if (phase === 'lobby') this.debugMenu.close();
    this.inv.setVisible(phase === 'playing');
    if (phase !== 'playing') { this.bags.closeAll(); this.term.hide(); if (phase !== 'ghost') this.pda.close(); }
    this.hud.show(this.inWorld());
    this.hands.show(phase === 'playing');
    this.lobby.update();
    this.hud.onPhase(phase);
    if (this.inWorld()) { if (this.mode === 'look' && !this.input.locked) this.applyMode(this.input.forced ? 'look' : 'hands'); } else this.input.unlock();
  }

  get self() { return this.rep?.self; }
  inWorld() { return this.phase === 'playing' || this.phase === 'ghost'; }

  // ---------------------------------------------------------------- look / hands
  applyMode(m) {
    this.mode = m;
    document.body.classList.toggle('handsmode', m === 'hands');
    if (m === 'hands') {
      this.cursorTarget = null;
      let n = 0;
      try { n = +(localStorage.getItem(HINT_KEY) || 0); localStorage.setItem(HINT_KEY, n + 1); } catch { /* private mode */ }
      if (n < 4 && this.inWorld()) this.hud.toast('Space to look around again');
    } else {
      this.cursorTarget = null;
      this.dnd.pending = null;
    }
  }

  /** Free the pointer. `auto`: because a panel opened (it will be captured again when the panels close). */
  enterHands(auto = false) {
    if (this.mode === 'hands') return;
    this.autoHands = auto;
    this.applyMode('hands');
    this.input.unlock();
  }

  enterLook() {
    this.autoHands = false;
    if (!this.inWorld()) return;
    if (this.input.forced) this.applyMode('look');
    else this.input.lock();
  }

  get panelOpen() { return this.pda.open || this.term.open || this.screens.reportOpen || this.screens.helpOpen || this.charedit.open || this.strip.open || this.debugMenu.open; }

  /** A panel closed: if it was the reason we freed the pointer, capture it again. */
  panelsChanged() {
    if (this.mode === 'hands' && this.autoHands && !this.panelOpen && !this.bags.openIds.length) this.enterLook();
  }

  /** Escape: close the top-most thing that is open. */
  closeTop() {
    if (this.charedit.open) return this.charedit.close();
    if (this.debugMenu.open) return this.debugMenu.close();
    if (this.strip.open) return this.strip.close();
    if (this.term.open) return this.term.close();
    if (this.screens.helpOpen) return this.screens.toggleHelp();
    if (this.pda.open) return this.pda.close();
    if (this.inv.open) return this.inv.close();
    if (this.bags.openIds.length) return this.bags.closeAll();
    return null;
  }

  // ---------------------------------------------------------------- prediction
  predictCtx() {
    const s = this.self;
    if (this.phase === 'ghost') return { noclip: true };
    return { slow: (s?.slow ?? 1) * (s?.crit ? 0.35 : 1), wind: this.wind, noclip: !!s?.dbg?.noclip, ignore: s?.haul >= 0 ? this.rep.props.interact[s.haul] : null, jet: !!s?.jet, mag: !!s?.mag };   // you pass through what you drag
  }

  frozen() {
    const s = this.self;
    return this.phase === 'playing' && !!s && (s.dead || s.crit || s.stunned || s.inside);
  }

  stepPred(inp, dt) {
    if (this.frozen()) {
      // out cold: stop where you are, unless there is no gravity to stop you (then you drift, like the server says)
      if (this.rep.world.hasGravity(this.pred.x, this.pred.z) || this.self.inside) this.pred.vx = this.pred.vz = 0;
      else stepMovement(this.pred, { yaw: inp.yaw }, this.rep.world, dt, { ...this.predictCtx(), limp: true });
      return;
    }
    stepMovement(this.pred, inp, this.rep.world, dt, this.predictCtx());
  }

  reconcile(you, ack) {
    const p = this.pred;
    this.pending = this.pending.filter((i) => i.seq > ack);
    const ox = p.x, oz = p.z;
    p.x = you.x; p.z = you.z; p.vx = you.vx || 0; p.vz = you.vz || 0;
    this.wind = you.wind || null;
    for (const inp of this.pending) this.stepPred(inp, inp.dt);
    const ex = ox - p.x, ez = oz - p.z;
    if (ex * ex + ez * ez > 9) { this.corr.x = this.corr.z = 0; } else { this.corr.x += ex; this.corr.z += ez; }
  }

  readMovement(dt) {
    const input = this.input;
    const typing = this.chat.isOpen;
    const [mdx, mdy] = input.takeMouse();
    if (this.mode === 'look' && input.locked && !typing) {
      this.yaw -= mdx * input.sensitivity;
      this.pitch = clamp(this.pitch - mdy * input.sensitivity, -1.45, 1.45);
    }
    if (!typing) {
      const turn = (input.isDown('ArrowLeft') ? 1 : 0) - (input.isDown('ArrowRight') ? 1 : 0);
      this.yaw += turn * 2.2 * dt;
      this.pitch = clamp(this.pitch + ((input.isDown('ArrowUp') ? 1 : 0) - (input.isDown('ArrowDown') ? 1 : 0)) * 1.6 * dt, -1.45, 1.45);
    }
    if (typing) return { f: 0, b: 0, l: 0, r: 0, run: 0 };
    const hp = this.self?.hp?.[0] ?? 100;
    return {
      f: input.isDown('KeyW') ? 1 : 0, b: input.isDown('KeyS') ? 1 : 0, l: input.isDown('KeyA') ? 1 : 0, r: input.isDown('KeyD') ? 1 : 0,
      run: (input.isDown('ShiftLeft') || input.isDown('ShiftRight')) && hp >= 30 ? 1 : 0,
    };
  }

  playerUpdate(dt) {
    const mv = this.readMovement(dt);
    const inp = { seq: ++this.seq, dt: Math.min(0.06, dt), ...mv, yaw: this.yaw, pitch: this.pitch };
    this.stepPred(inp, inp.dt);
    this.pending.push(inp);
    if (this.pending.length > 120) this.pending.shift();
    this.sendBuf.push(inp);
    this.sendAcc += dt;
    if (this.sendAcc >= SEND_EVERY) this.flushInputs();
    // feet off the floor (no gravity here): no footsteps, no walking bob; the camera sways instead (placeCamera)
    this.floating = this.phase === 'playing' && floatState(this.rep.world, this.pred, this.predictCtx()).floating;
    const sp = this.floating ? 0 : Math.hypot(this.pred.vx, this.pred.vz);
    this.moving = sp;
    if (this.phase === 'playing') {
      this.bob += sp * dt * (mv.run ? 1.5 : 1.7);
      this.stepAcc += sp * dt;
      if (this.stepAcc > (mv.run ? 2.6 : 2.0) && sp > 1) {
        this.stepAcc = 0;
        const w = this.rep.world;
        const c = Math.floor(this.pred.x / TILE), r = Math.floor(this.pred.z / TILE);
        const surface = w.kindAt(c, r) === KIND.LATTICE ? 'catwalk' : w.areaAt(c, r)?.c === 'maintenance' ? 'plating' : 'floor';
        this.audio.footstep(!!mv.run, surface);
        this.hands.step(!!mv.run);
      }
    }
    const k = Math.exp(-12 * dt);
    this.corr.x *= k; this.corr.z *= k;
  }

  flushInputs() {
    if (!this.sendBuf.length) return;
    this.send({ t: 'input', list: this.sendBuf.map((i) => ({ seq: i.seq, dt: +i.dt.toFixed(4), f: i.f, b: i.b, l: i.l, r: i.r, run: i.run, yaw: +i.yaw.toFixed(4), pitch: +i.pitch.toFixed(4) })) });
    this.sendBuf = [];
    this.sendAcc = 0;
  }

  // ---------------------------------------------------------------- picking
  /** Camera ray through the screen point (x, y), in CSS pixels. */
  rayAt(x, y) {
    const v = this.tmpV.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1, 0.5).unproject(this.camera);
    const o = this.camera.position.clone();
    const d = v.clone().sub(o).normalize();
    return { o, d };
  }

  lookRay() {
    const d = new THREE.Vector3();
    this.camera.getWorldDirection(d);
    return { o: this.camera.position.clone(), d };
  }

  /** Whatever the ray (o, d) points at within reach. Mirrors what the server will accept. */
  findTarget(o, f) {
    const rep = this.rep, world = rep.world;
    const px = this.pred.x, pz = this.pred.z;
    let best = null, bs = 1e9;
    const consider = (ref, x, y0, z, rad, extra) => {
      const y1 = extra.y1 ?? y0;
      let bestPerp = 1e9;
      for (let k = 0; k < 4; k++) {
        const y = y0 + (y1 - y0) * (k / 3);
        const dx = x - o.x, dy = y - o.y, dz = z - o.z;
        const t = dx * f.x + dy * f.y + dz * f.z;
        if (t < 0) continue;
        const perp = Math.hypot(dx - f.x * t, dy - f.y * t, dz - f.z * t);
        if (perp < bestPerp) bestPerp = perp;
      }
      const hd = Math.hypot(x - px, z - pz);
      if (bestPerp > rad || hd > REACH + rad) return;
      // doors are big, forgiving targets: a person or thing standing in front of one wins over it
      const score = (bestPerp / rad + hd * 0.08) * (extra.bias ?? 1);
      if (score >= bs) return;
      if (!extra.through) {
        const wd = world.raycast(px, pz, x - px, z - pz, hd, 'shot');
        if (wd < hd - 0.55) return;
      }
      bs = score;
      best = { ...ref, d: hd, ...extra };
    };
    const maxD2 = (REACH + 1.5) * (REACH + 1.5);
    const near = (x, z) => { const dx = x - px, dz = z - pz; return dx * dx + dz * dz <= maxD2; };
    for (const it of rep.items.values()) {
      if (!near(it.x, it.z)) continue;
      consider({ k: 'item', id: it.id }, it.x, it.y, it.z, 0.45, { y1: it.y + 0.4, name: it.n });
    }
    for (let i = 0; i < rep.doors.length; i++) {
      const d = rep.doors[i];
      if (!near(d.x, d.z)) continue;
      consider({ k: 'door', idx: i }, d.x, 0.2, d.z, 1.05, { y1: 2.2, name: d.name, through: true, bias: 2 });
    }
    for (const fd of rep.fdoors) {
      if (!fd.closed || !near(fd.x, fd.z)) continue;
      consider({ k: 'fdoor', idx: fd.idx }, fd.x, 0.2, fd.z, 1.05, { y1: 2.2, name: 'firelock', through: true, bias: 2 });
    }
    for (const it of rep.props.interact) {
      if (it.gone || !near(it.x, it.z)) continue;
      if (it.kind === 'wm') consider({ k: 'prop', idx: it.idx }, it.x, it.y0, it.z, 0.7, { y1: it.y1, name: it.name, through: true, prop: it });
      else consider({ k: 'prop', idx: it.idx }, it.x, it.y0 + 0.1, it.z, it.half ? Math.min(0.9, it.half + 0.1) : 0.9, { y1: Math.max(it.y0 + 1.0, it.y1), name: it.name, prop: it });   // as wide as the thing really is
    }
    for (const b of rep.built) {
      const bx = b.c * TILE + TILE / 2, bz = b.r * TILE + TILE / 2;
      if (near(bx, bz)) consider({ k: 'built', id: b.id }, bx, 0.1, bz, 0.95, { y1: 1.7, name: girderLook(b.st).name });
    }
    for (const m of rep.mobs.values()) {
      if (m.id === rep.you?.id || !near(m.x, m.z)) continue;
      consider({ k: 'mob', id: m.id }, m.x, 0.1, m.z, m.dead ? 0.8 : 0.7, { y1: m.dead ? 0.4 : 1.6, name: m.n, mob: m });
    }
    if (!best) {
      // what is left of a window (its grille, or just the floor) and windows themselves: TG has no "broken window" object
      const br = this.breachAlong(o, f);
      if (br) best = { k: 'breach', c: br.c, r: br.r, name: rep.world.grille[br.r * rep.world.W + br.c] ? 'grille' : 'floor', d: 2 };
      else best = this.windowAlong(o, f);
    }
    return best;
  }

  /** Is the item in your active hand one of the tools that work on walls and windows? */
  holdingTool() {
    const inv = this.self?.inv;
    const tg = inv?.hands?.[inv.active]?.tg;
    return !!tg && /(?:^| )(?:welder|screwdriver|crowbar|wrench|wirecutters)(?: |$)/.test(tg);
  }

  /** The window (a whole glass tile, or a thin pane on a tile's edge) the ray reaches first, if nothing else is in the way. */
  windowAlong(o, f) {
    const w = this.rep.world, reach = REACH + 0.6;
    const t = w.raycast(o.x, o.z, f.x, f.z, reach, 'shot');
    const h = w.hit;
    if (t >= reach || !h) return null;
    if (h.kind === 'tile') {
      if (!w.glass[h.i]) {
        // a wall is a target only while you hold something that works on it, so it does not label every corridor
        const key = w.wallKey(h.i);
        return key && this.holdingTool() ? { k: 'wall', c: h.c, r: h.r, name: WALLS[key].name, d: t } : null;
      }
      if (w.breached.has(h.i)) return null;
      return { k: 'window', c: h.c, r: h.r, name: WINDOWS[w.windowKey(h.i)]?.name || 'window', d: t };
    }
    if (h.kind === 'edge') {
      const p = this.rep.props.paneIdx.get(h.i * 16 + h.bit);
      if (!p || p.dead) return null;
      return { k: 'pane', c: p.c, r: p.r, pd: p.d, name: WINDOWS[p.tag]?.name || 'window', d: t };
    }
    return null;
  }

  breachAlong(o, f) {
    const w = this.rep.world;
    const hl = Math.hypot(f.x, f.z) || 1;
    for (let t = 0.6; t < 3.4; t += 0.25) {
      const x = o.x + f.x / hl * t, z = o.z + f.z / hl * t;
      const c = Math.floor(x / TILE), r = Math.floor(z / TILE);
      const i = r * w.W + c;
      if (w.breached.has(i)) return { c, r };
      if (w.solid[i] && !w.breached.has(i)) return null;
    }
    return null;
  }

  /**
   * Where the ray (o, d) meets a surface you could put something on: a table top or the floor. `ok` when it is
   * within reach, in sight and not inside something solid.
   */
  floorPoint(o, d) {
    const w = this.rep.world;
    if (d.y > -0.02) return null;
    const tileH = (x, z) => { const c = Math.floor(x / TILE), r = Math.floor(z / TILE); return w.inb(c, r) ? w.tableH[r * w.W + c] : 0; };
    let hit = null;
    // table tops first: step along the ray until it drops below table height over a table
    const tFloor = -o.y / d.y;
    for (let t = 0; t < tFloor; t += 0.1) {
      const y = o.y + d.y * t;
      const x = o.x + d.x * t, z = o.z + d.z * t;
      const th = tileH(x, z);
      if (th > 0 && y <= th) { const tt = (th - o.y) / d.y; hit = { x: o.x + d.x * tt, y: th, z: o.z + d.z * tt }; break; }
    }
    if (!hit) hit = { x: o.x + d.x * tFloor, y: 0, z: o.z + d.z * tFloor };
    const hd = Math.hypot(hit.x - o.x, hit.z - o.z);
    const wall = hd > 0.05 ? w.raycast(o.x, o.z, hit.x - o.x, hit.z - o.z, hd, 'shot') : hd;
    if (wall < hd - 0.05) return { ...hit, ok: false, blocked: true };
    const c = Math.floor(hit.x / TILE), r = Math.floor(hit.z / TILE);
    if (!w.inb(c, r)) return { ...hit, ok: false };
    const i = r * w.W + c, k = w.kind[i];
    const reach = Math.hypot(hit.x - this.pred.x, hit.z - this.pred.z);
    const ok = reach <= DROP_REACH && (k === KIND.FLOOR || k === KIND.LATTICE) && (w.tableH[i] > 0 || !w.collides(hit.x, hit.z, 0.08));
    return { ...hit, ok, reach };
  }

  ref(t) {
    if (!t) return { k: 'none' };
    switch (t.k) {
      case 'item': case 'mob': return { k: t.k, id: t.id };
      case 'breach': case 'window': case 'wall': return { k: t.k, c: t.c, r: t.r };
      case 'built': return { k: 'built', id: t.id };
      case 'pane': return { k: 'pane', c: t.c, r: t.r, d: t.pd };
      default: return { k: t.k, idx: t.idx };
    }
  }

  /** SS13 click: use what is in your active hand on `t` (or swing / shoot along `dir` at nothing). */
  clickWorld(t, dir, mods = {}) {
    const yaw = Math.atan2(-dir.x, -dir.z), pitch = Math.asin(clamp(dir.y, -1, 1));
    this.send({ t: 'click', target: this.ref(t), yaw: +yaw.toFixed(4), pitch: +pitch.toFixed(4), ...(mods.alt ? { alt: 1 } : {}), ...(mods.ctrl ? { ctrl: 1 } : {}) });
    const inv = this.self?.inv;
    if (!inv) return;
    const held = inv.hands[inv.active];
    if (inv.throwMode && held) this.hands.bump(inv.active, 'throw');
    else if (t && t.k === 'item' && !held) this.hands.bump(inv.active, 'catch');
    else this.hands.bump(inv.active, inv.intent === 'harm' || (t && t.k === 'mob' && inv.intent !== 'help') ? 'swing' : 'use');
  }

  examineTarget(t) { if (t) this.send({ t: 'examine', target: this.ref(t) }); }
  key(k, v) {
    this.send({ t: 'key', k, v });
    if (k === 'swap') this.hands.bump(this.self?.inv?.active ?? 0, 'swap');
  }

  shake(a) { this.shakeAmt = Math.min(1.2, this.shakeAmt + a); }

  /** Fullscreen, with the keyboard locked so that Ctrl+W, Ctrl+T, Ctrl+N and Ctrl+Tab reach the game instead of closing it (Chromium; elsewhere it is just fullscreen). */
  toggleFullscreen() {
    if (document.fullscreenElement) { document.exitFullscreen?.(); return; }
    const p = document.documentElement.requestFullscreen?.();
    if (p?.then) p.then(() => navigator.keyboard?.lock?.(['KeyW', 'KeyT', 'KeyN', 'Tab', 'PageUp', 'PageDown'])).catch(() => {});
  }

  // ---------------------------------------------------------------- keys
  handleKeys() {
    const input = this.input;
    if (input.pressed('F2')) this.hud.say(this.audio.toggleMute() ? 'Sound muted.' : 'Sound on.', 'notice');
    if (input.pressed('F1')) this.screens.toggleHelp();
    if (input.pressed('F4')) this.toggleFullscreen();
    if (input.pressed('F3') && this.inWorld() && this.rep?.debug) this.debugMenu.toggle();
    if (!this.inWorld()) { input.takeClicks(); return; }
    if (this.chat.isOpen) { input.takeClicks(); return; }
    if (input.pressed('Escape')) this.closeTop();
    if (input.pressed('Space')) { if (this.mode === 'hands') this.enterLook(); else this.enterHands(false); }
    if (input.pressed('Tab')) this.pda.toggle();
    if (input.pressed('KeyT')) this.chat.open('say');
    else if (input.pressed('KeyY')) this.chat.open('whisper');
    else if (input.pressed('KeyM')) this.chat.open('me');
    else if (input.pressed('KeyO')) this.chat.open('ooc');
    else if (input.pressed('Enter')) this.chat.open('say');
    if (input.pressed('Slash')) this.chat.open('say', ';');
    if (this.phase === 'ghost') {
      if (input.pressed('KeyI')) this.send({ t: 'lobby', op: 'lobby' });
      input.takeClicks();
      return;
    }
    if (input.pressed('KeyI')) this.inv.toggle();
    if (this.term.open) {
      for (let k = 1; k <= 9; k++) if (input.pressed('Digit' + k)) this.term.press(k - 1);
    } else {
      for (let k = 1; k <= 4; k++) if (input.pressed('Digit' + k)) this.key('intent', k - 1);
    }
    if (input.pressed('KeyX')) this.key('swap');
    if (input.pressed('KeyQ')) this.key('drop');
    if (input.pressed('KeyE')) this.key('equip');
    if (input.pressed('KeyZ')) { this.key('activate'); this.hands.bump(this.self?.inv?.active, 'use'); }
    if (input.pressed('KeyR')) this.key('throw');
    if (input.pressed('KeyV')) this.key('internals');
    if (input.pressed('KeyF')) this.key('light');
    if (input.pressed('KeyJ')) this.key('jet');
    if (input.pressed('KeyK')) this.key('mag');
    if (input.pressed('KeyB')) this.key('resist');
    if (input.pressed('KeyP')) this.key('pull');
    // look mode: the crosshair is the hand
    const clicks = input.takeClicks();
    if (this.mode !== 'look' || this.panelOpen) { this.holdT = 0; return; }
    const dir = this.lookRay().d;
    for (const c of clicks) {
      const b = c % 10, mod = Math.floor(c / 10);
      if (b === 0) this.clickWorld(this.target, dir, { alt: mod === 1, ctrl: mod === 2 });
      else if (b === 2) this.examineTarget(this.target);
    }
    // holding the button keeps swinging
    if (input.buttons.has(0) && !clicks.length && this.self?.inv?.intent === 'harm') {
      this.holdT += 1;
      if (this.holdT > 14) { this.holdT = 8; this.clickWorld(this.target, dir); }
    } else this.holdT = 0;
  }

  // ---------------------------------------------------------------- frame
  frame(dt) {
    this.time += dt;
    this.conn.update(dt);
    for (const m of this.conn.poll()) this.handle(m);
    if (this.conn.closed && !this.disconnected) { this.disconnected = true; this.screens.showReset({ text: 'Connection to the server was lost.', auto: false }); }
    if (!this.rep) { this.renderer.clear(); return; }
    const rep = this.rep;
    rep.tick(dt);
    this.handleKeys();

    if (this.inWorld()) this.playerUpdate(dt);
    else { this.lobbyYaw += dt * 0.1; this.yaw = this.lobbyYaw; this.pitch = -0.04; this.input.takeMouse(); this.input.takeClicks(); }

    this.placeCamera(dt);
    const cam = this.camera;
    cam.updateMatrixWorld(true);

    // what are we pointing at?
    const playing = this.phase === 'playing' && !this.self?.dead && !this.chat.isOpen;
    this.target = playing && this.mode === 'look' ? this.findTarget(...Object.values(this.lookRay())) : null;
    this.cursorTarget = playing && this.mode === 'hands' && this.mouse.overCanvas && !this.dnd.drag ? this.findTarget(...Object.values(this.rayAt(this.mouse.x, this.mouse.y))) : null;
    this.view.setTarget(this.mode === 'look' ? this.target : this.cursorTarget);
    this.updateDragPreview();
    this.updateCursor();

    this.view.update(dt, this.time, this.time - INTERP_DELAY, cam.position, this.yaw, this.phase === 'playing' ? rep.you?.id : -1);
    U.uCam.value.copy(cam.position);
    const dir = new THREE.Vector3(); cam.getWorldDirection(dir);
    U.uCamDir.value.copy(dir);
    U.uCamRight.value.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const torch = this.phase === 'playing' && this.self?.inv?.light && !this.self.dead;
    U.uFlash.value = torch ? 1 : 0;
    U.uTime.value = this.time;

    this.audio.listener.x = this.pred.x; this.audio.listener.z = this.pred.z; this.audio.listener.yaw = this.yaw;
    const c = Math.floor(this.pred.x / TILE), r = Math.floor(this.pred.z / TILE);
    const area = rep.world.areaAt(c, r);
    const vac = rep.env.p < 30;
    this.audio.setMuffle(this.phase === 'playing' ? (vac && !this.self?.suit ? 1 : vac ? 0.5 : 0) : 0);
    this.audio.update(dt, { cat: area ? area.c : 'space', vac, power: rep.power.state, hpFrac: (this.self?.hp?.[0] ?? 100) / (this.self?.hp?.[1] || 100), dead: !!this.self?.dead });
    this.footsteps(dt);

    if (this.phase === 'playing') {
      this.view.lightField.sample(this.pred.x, this.pred.z, this.tmpC);
      const lum = (this.tmpC[0] + this.tmpC[1] + this.tmpC[2]) / 3;
      this.bodyview.update(dt, { pitch: this.pitch, moving: this.moving, show: this.mode === 'look' && !this.panelOpen && !this.self?.inside, cam: this.camera.position, yaw: this.yaw, light: lum });
      this.hands.update(dt, { moving: this.moving, light: Math.max(lum * 1.4, torch ? 0.95 : 0), crouch: this.self?.crit ? 1 : 0 });
    }
    this.hud.update(dt);
    this.fx.update(dt);
    this.chat.update(dt);
    this.pda.update(dt);
    this.screens.update(dt);
    if (!this.opts.norender) this.renderer.render(this.scene, cam);
    this.input.endFrame();
  }

  /** While dragging over the world: highlight who you would use it on, or mark where it would land. */
  updateDragPreview() {
    const d = this.dnd.drag;
    if (!d || !this.mouse.overCanvas || this.phase !== 'playing') { this.view.setDropMarker(null, this.time); return; }
    const { o, d: dir } = this.rayAt(this.mouse.x, this.mouse.y);
    const src = d.kind === 'world' ? null : this.invIndex.get(d.id)?.where;
    const t = src?.t === 'hand' ? this.findTarget(o, dir) : null;
    if (t && t.k !== 'item') { this.view.setTarget(t); this.view.setDropMarker(null, this.time); return; }
    const fp = this.floorPoint(o, dir);
    this.view.setDropMarker(fp && !fp.blocked ? fp : null, this.time);
  }

  /** The pointer shows what a click would do: point, an open hand over things to pick up, a target in throw mode. */
  updateCursor() {
    if (this.mode !== 'hands') return;
    const inv = this.self?.inv;
    const t = this.cursorTarget;
    const kind = inv?.throwMode && inv.hands[inv.active] ? 'throw' : t && t.k === 'item' ? 'open' : 'point';
    if (this.curKind !== kind) { this.curKind = kind; this.canvas.style.cursor = `var(--cur-${kind})`; }
  }

  placeCamera(dt) {
    const cam = this.camera;
    const s = this.self;
    let eye = EYE;
    let roll = 0;
    if (this.phase === 'playing' && s) {
      if (s.crit) { eye = 0.62; roll = Math.sin(this.time * 1.3) * 0.06; }
    } else if (this.phase === 'ghost') eye = 1.7 + Math.sin(this.time * 1.2) * 0.06;
    else if (this.phase === 'lobby') eye = 1.5;
    const moving = this.phase === 'playing' ? Math.min(1, this.moving / 5) : 0;
    let bobY = Math.sin(this.bob * 2.0) * moving * 0.035;
    const bobX = Math.cos(this.bob) * moving * 0.02;
    if (this.floating && this.phase === 'playing') {            // adrift: slow breathing sway instead of a walking bob
      bobY += Math.sin(this.time * 0.9) * 0.03;
      roll += Math.sin(this.time * 0.6) * 0.012;
    }
    const px = this.pred.x + this.corr.x, pz = this.pred.z + this.corr.z;
    cam.position.set(px + Math.cos(this.yaw) * bobX, eye + bobY, pz - Math.sin(this.yaw) * bobX);
    cam.rotation.order = 'YXZ';
    cam.rotation.set(this.pitch, this.yaw, roll);
    if (this.shakeAmt > 0.001) {
      cam.rotation.z += (Math.random() - 0.5) * this.shakeAmt * 0.05;
      cam.rotation.x += (Math.random() - 0.5) * this.shakeAmt * 0.04;
      this.shakeAmt *= Math.pow(0.02, dt);
    }
  }

  /** Other people's footsteps, so you can hear someone coming. */
  footsteps(dt) {
    if (this.phase !== 'playing') return;
    for (const m of this.rep.mobs.values()) {
      if (m.dead || m.speed < 1 || m.kind !== 'human' || m.id === this.rep.you?.id) continue;
      const dx = m.x - this.pred.x, dz = m.z - this.pred.z;
      if (dx * dx + dz * dz > 14 * 14) continue;
      m.stepAcc = (m.stepAcc || 0) + m.speed * dt;
      if (m.stepAcc > (m.speed > 3.8 ? 2.6 : 2.0)) { m.stepAcc = 0; this.audio.footstep(m.speed > 3.8, 'floor', m.x, m.z); }
    }
  }

  // ---------------------------------------------------------------- messages
  handle(m) {
    switch (m.t) {
      case 'welcome': this.onWelcome(m); break;
      case 'snap': this.onSnap(m); break;
      case 'ev': for (const ev of m.list) this.rep?.apply(ev); break;
      case 'reset': this.screens.showReset(m); break;
      case 'kick': this.screens.showReset({ text: m.text || 'You have been disconnected.' }); break;
      default: break;
    }
  }

  start() {
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      try { this.frame(dt); } catch (e) { console.error(e); }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
