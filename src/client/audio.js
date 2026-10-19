import { rng } from '../shared/util.js';

/** WebAudio wrapper: positional one-shots (the server says what and where), looping ambience, a vacuum low-pass, heartbeat. */
export class AudioSys {
  constructor() {
    this.listener = { x: 0, z: 0, yaw: 0 };
    this.ctx = null;
    this.manifest = null;
    this.buffers = new Map();
    this.pending = new Map();
    this.lastPlayed = new Map();
    this.rand = rng(Date.now() & 0xffff);
    this.muted = false;
    this.ambNode = null;
    this.ambName = '';
    this.ambCat = '';
    this.heartAcc = 0;
    this.master = null;
    this.filter = null;
    this.muffle = 0;
    fetch('assets/sound/manifest.json').then((r) => r.json()).then((m) => { this.manifest = m; }).catch(() => {});
  }

  /** Must be called from a user gesture. */
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 22000;
      this.master.connect(this.filter);
      this.filter.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.8;
    return this.muted;
  }

  async buffer(file) {
    if (this.buffers.has(file)) return this.buffers.get(file);
    if (this.pending.has(file)) return this.pending.get(file);
    const p = (async () => {
      try {
        const r = await fetch('assets/sound/' + file);
        const ab = await r.arrayBuffer();
        const b = await new Promise((res, rej) => this.ctx.decodeAudioData(ab, res, rej));
        this.buffers.set(file, b);
        return b;
      } catch { return null; }
    })();
    this.pending.set(file, p);
    return p;
  }

  /** opts: {x, z, vol, rate, loop, minGap} */
  play(name, opts = {}) {
    if (!this.ctx || !this.manifest || this.muted) return null;
    const files = this.manifest[name];
    if (!files) return null;
    const now = this.ctx.currentTime;
    const gap = opts.minGap ?? 0.05;
    if (now - (this.lastPlayed.get(name) || -9) < gap) return null;
    this.lastPlayed.set(name, now);
    let vol = opts.vol ?? 1;
    let pan = 0;
    if (opts.x !== undefined) {
      const p = this.listener;
      const dx = opts.x - p.x, dz = opts.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > 38) return null;
      vol *= 1 / (1 + d * d * 0.012);
      if (d > 0.5) {
        const yaw = p.yaw;
        const rx = Math.cos(yaw), rz = -Math.sin(yaw);
        pan = Math.max(-1, Math.min(1, (dx * rx + dz * rz) / d)) * 0.8;
      }
    }
    if (vol < 0.01) return null;
    const file = files[Math.floor(this.rand() * files.length)];
    this.buffer(file).then((buf) => {
      if (!buf) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = (opts.rate ?? 1) * (1 + (this.rand() - 0.5) * (opts.jitter ?? 0.06));
      src.loop = !!opts.loop;
      const g = this.ctx.createGain();
      g.gain.value = vol;
      let node = g;
      src.connect(g);
      if (this.ctx.createStereoPanner && pan) {
        const sp = this.ctx.createStereoPanner();
        sp.pan.value = pan;
        g.connect(sp);
        node = sp;
      }
      node.connect(this.master);
      src.start();
      if (opts.onStart) opts.onStart(src, g);
    });
    return true;
  }

  // ---- convenience wrappers
  footstep(sprint, surface = 'floor', x, z) {
    const set = surface === 'catwalk' ? 'step_catwalk' : surface === 'plating' ? 'step_plating' : 'step_floor';
    const opts = { vol: sprint ? 0.5 : 0.32, minGap: 0.12 };
    if (x !== undefined) { opts.x = x; opts.z = z; opts.vol *= 0.7; opts.minGap = 0.06; }
    this.play(set, opts);
  }

  setMuffle(f) {
    if (!this.ctx) return;
    this.filter.frequency.setTargetAtTime(22000 - f * 21500, this.ctx.currentTime, 0.15);
  }

  /** Per-frame: ambience by area category, heartbeat. ctx: {cat, vac, power, hpFrac, dead} */
  update(dt, c) {
    if (!this.ctx || !this.manifest || this.muted) return;
    let set = 'amb_station';
    if (c.vac) set = 'amb_space';
    else if (c.cat === 'maintenance') set = 'amb_maint';
    else if (c.cat === 'engine' || c.cat === 'tcommsat') set = 'amb_tech';
    if (c.power === 'out' && !c.vac) set = 'amb_maint';
    if (set !== this.ambName || !this.ambNode) {
      if (!this.ambBusy) this.startAmbient(set);
    }
    if (c.hpFrac < 0.35 && !c.dead) {
      this.heartAcc -= dt;
      if (this.heartAcc <= 0) { this.heartAcc = c.hpFrac < 0.15 ? 0.7 : 1.1; this.play('heart_fast', { vol: 0.6, jitter: 0 }); }
    }
  }

  startAmbient(set) {
    const files = this.manifest[set];
    if (!files) return;
    this.ambBusy = true;
    const file = files[Math.floor(this.rand() * files.length)];
    this.buffer(file).then((buf) => {
      this.ambBusy = false;
      if (!buf) return;
      const old = this.ambNode;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      g.gain.linearRampToValueAtTime(0.32, this.ctx.currentTime + 2.5);
      src.connect(g);
      g.connect(this.master);
      src.start();
      src.onended = () => { if (this.ambNode && this.ambNode.src === src) this.ambNode = null; };
      this.ambNode = { src, g };
      this.ambName = set;
      if (old) {
        old.g.gain.cancelScheduledValues(this.ctx.currentTime);
        old.g.gain.setValueAtTime(old.g.gain.value, this.ctx.currentTime);
        old.g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 2.5);
        setTimeout(() => { try { old.src.stop(); } catch { /* ended */ } }, 2700);
      }
    });
  }
}
