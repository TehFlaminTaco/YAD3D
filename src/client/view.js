import * as THREE from 'three';
import { TILE, WALL_H, PX, KIND } from '../shared/config.js';
import { ITEM_SCALE } from '../shared/propdata.js';
import { lightMode } from '../shared/power.js';
import { rng } from '../shared/util.js';
import { LevelMesh } from '../render/level.js';
import { LightField } from '../render/lighting.js';
import { SpriteBatch } from '../render/sprites.js';
import { spriteMaterial } from '../render/materials.js';

const SY = WALL_H / TILE;                       // doors are drawn taller than a 32px tile is wide
const AMBIENT = [0.045, 0.045, 0.06];

/** Everything you can see: terrain mesh, sprite batches (props, doors, items, mobs), lights. Reads the Replica, never writes it. */
export class WorldView {
  constructor(scene, assets, rep, opts = {}) {
    this.scene = scene;
    this.assets = assets;
    this.rep = rep;
    this.rects = assets.rects;
    const { world, props } = rep;
    const mat = spriteMaterial(assets.spriteTex);
    this.stat = new SpriteBatch(20000, mat);
    this.dyn = new SpriteBatch(3000, mat);
    this.itemB = new SpriteBatch(6000, mat);
    this.lit = [];                               // sprites whose tint follows the light field
    this.lightScale = 1;
    this.flicker = null;
    this.ambient = opts.fullbright ? [0.85, 0.85, 0.85] : AMBIENT;

    this.lightField = new LightField(world);
    this.tmpC = [0, 0, 0];
    this.levelMesh = new LevelMesh(world, assets, { tables: props.tables, panes: props.panes });
    scene.add(this.levelMesh.group, this.stat.mesh, this.dyn.mesh, this.itemB.mesh);
    this.addStatics(props.statics);

    this.doorViews = [];
    for (const d of rep.doors) this.addDoorView(d);
    this.fdoorViews = rep.fdoors.map((f) => this.addFdoorView(f));

    this.itemSlot = new Map();                   // item id -> sprite id
    this.itemFree = [];
    for (const it of rep.items.values()) this.addItem(it);

    this.mobViews = new Map();
    this.mobFree = [];
    this.target = null;
    this.beams = [];
    this.addStars();
    this.rebuildLights();
  }

  addStars() {
    const n = 1800;
    const pos = new Float32Array(n * 3);
    const rand = rng(5);
    for (let i = 0; i < n; i++) {
      const u = rand() * 2 - 1, th = rand() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      pos.set([s * Math.cos(th) * 100, u * 100, s * Math.sin(th) * 100], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xbfd0ff, size: 1.6, sizeAttenuation: false, fog: false, depthWrite: false }));
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -1;
    this.scene.add(this.stars);
  }

  // ------------------------------------------------------------------ static scenery
  addStatics(list) {
    for (const s of list) {
      const rc = this.rects[s.rect];
      if (!rc) continue;
      s.id = this.stat.add({ x: s.x, y: s.y, z: s.z, mode: s.mode, w: s.w, h: s.h, ox: s.ox, oy: s.oy, yaw: s.yaw, rect: rc, emit: s.emit });
      if (s.lit) this.lit.push({ batch: this.stat, id: s.id, sx: s.lit[0], sz: s.lit[1] });
    }
  }

  // ------------------------------------------------------------------ doors
  setDoorRect(batch, id, rc) {
    batch.setRect(id, rc, rc.w * PX, rc.h * PX * SY, (rc.ox + rc.w / 2 - rc.fw / 2) * PX, (rc.fh - rc.oy - rc.h) * PX * SY);
  }

  addDoorView(d) {
    const fr = d.proto.fr;
    const id = this.dyn.add({ x: d.x, y: 0, z: d.z, mode: 1, w: TILE, h: WALL_H, yaw: d.yaw, rect: this.rects[fr[0]] });
    this.setDoorRect(this.dyn, id, this.rects[fr[0]]);
    this.lit.push({ batch: this.dyn, id, sx: d.x, sz: d.z });
    const v = { d, id, frame: 0 };
    this.doorViews.push(v);
    return v;
  }

  doorFrame(d) {
    const n = d.anim;
    switch (d.state) {
      case 'opening': return Math.min(n, Math.floor(d.t * n) + 1);
      case 'open': return n + 1;
      case 'closing': return Math.max(1, n - Math.floor(d.t * n));
      default: return 0;
    }
  }

  addFdoorView(f) {
    const rc = this.rects[f.s];
    if (!rc) return null;
    const w = this.rep.world;
    const wl = (c, r) => w.isWallLike(c, r);
    const yaw = wl(f.c - 1, f.r) && wl(f.c + 1, f.r) ? 0 : wl(f.c, f.r - 1) && wl(f.c, f.r + 1) ? Math.PI / 2 : 0;
    const id = this.dyn.add({ x: f.x, y: 0, z: f.z, mode: 1, w: rc.w * PX, h: rc.h * PX * SY, ox: (rc.ox + rc.w / 2 - rc.fw / 2) * PX, oy: (rc.fh - rc.oy - rc.h) * PX * SY, yaw, rect: rc, alpha: f.closed ? 1 : 0 });
    this.lit.push({ batch: this.dyn, id, sx: f.x, sz: f.z });
    return { f, id };
  }

  setFdoor(f) {
    const v = this.fdoorViews[f.idx];
    if (v) { this.dyn.setAlpha(v.id, f.closed ? 1 : 0); this.relightSprites(); }
  }

  // ------------------------------------------------------------------ floor items
  addItem(it) {
    const rc = this.rects[it.s];
    if (!rc) return;
    const o = {
      x: it.x, y: it.y, z: it.z, mode: 0, w: rc.w * PX * ITEM_SCALE, h: rc.h * PX * ITEM_SCALE,
      ox: (rc.ox + rc.w / 2 - rc.fw / 2) * PX * ITEM_SCALE, oy: 0, rect: rc,
    };
    const free = this.itemFree.pop();
    let id;
    if (free !== undefined) {
      id = free;
      this.itemB.setPos(id, o.x, o.y, o.z);
      this.itemB.setRect(id, rc, o.w, o.h, o.ox, o.oy);
      this.itemB.setAlpha(id, 1);
      this.itemB.setHighlight(id, 0);
    } else id = this.itemB.add(o);
    this.itemSlot.set(it.id, id);
    this.lightField.sample(it.x, it.z, this.tmpC);
    const t = this.tmpC;
    this.itemB.setTint(id, Math.min(1.35, t[0]), Math.min(1.35, t[1]), Math.min(1.35, t[2]));
  }

  /** Hide a floor item while it is being dragged (it reappears unless the server moves it). */
  hideItem(itemId, hide) {
    const id = this.itemSlot.get(itemId);
    if (id !== undefined) this.itemB.setAlpha(id, hide ? 0 : 1);
  }

  /** Where a floor item currently is, for animations. */
  itemPos(itemId) { return this.rep.items.get(itemId) || null; }

  removeItem(itemId) {
    const id = this.itemSlot.get(itemId);
    if (id === undefined) return;
    this.itemSlot.delete(itemId);
    this.itemB.setAlpha(id, 0);
    this.itemFree.push(id);
  }

  // ------------------------------------------------------------------ mobs
  addMob(m) {
    const set = this.assets.level.mobs[m.set];
    if (!set) return;
    const free = this.mobFree.pop();
    const id = free !== undefined ? free : this.dyn.add({ x: 0, y: 0, z: 0, mode: 0, w: 2, h: 2, rect: this.rects[0] });
    this.dyn.setAlpha(id, 1);
    this.mobViews.set(m.id, { m, id, set, anim: Math.random() * 4 });
  }

  removeMob(mid) {
    const v = this.mobViews.get(mid);
    if (!v) return;
    this.dyn.setAlpha(v.id, 0);
    this.mobFree.push(v.id);
    this.mobViews.delete(mid);
    if (this.target && this.target.k === 'mob' && this.target.id === mid) this.target = null;
  }

  /** Pick the smoothed position for rendering time `rt` from the mob's snapshot buffer. */
  interpolate(m, rt) {
    const b = m.buf;
    if (!b.length) return;
    if (rt <= b[0].t) { m.x = b[0].x; m.z = b[0].z; m.yaw = b[0].yaw; return; }
    const last = b[b.length - 1];
    if (rt >= last.t) { m.x = last.x; m.z = last.z; m.yaw = last.yaw; return; }
    for (let i = b.length - 2; i >= 0; i--) {
      if (b[i].t <= rt) {
        const a = b[i], c = b[i + 1];
        const k = (rt - a.t) / Math.max(1e-4, c.t - a.t);
        m.x = a.x + (c.x - a.x) * k; m.z = a.z + (c.z - a.z) * k;
        let dy = c.yaw - a.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        m.yaw = a.yaw + dy * k;
        return;
      }
    }
  }

  updateMobs(dt, rt, cam, camYaw, selfId) {
    const camRx = Math.cos(camYaw), camRz = -Math.sin(camYaw);
    const t = this.tmpC;
    for (const [mid, v] of this.mobViews) {
      const m = v.m;
      if (mid === selfId) { this.dyn.setAlpha(v.id, 0); continue; }
      this.interpolate(m, rt);
      let sid;
      if (m.dead && v.set.dead >= 0 && v.set.dead !== undefined) sid = v.set.dead;
      else {
        const vx = m.x - cam.x, vz = m.z - cam.z;
        const vl = Math.hypot(vx, vz) || 1;
        const fx = -Math.sin(m.yaw), fz = -Math.cos(m.yaw);
        const dot = (fx * vx + fz * vz) / vl;
        const side = fx * camRx + fz * camRz;
        const di = dot > 0.62 ? 1 : dot < -0.62 ? 0 : side > 0 ? 2 : 3;
        const frames = v.set.d[di];
        v.anim += m.speed * dt * 1.6;
        sid = frames[Math.floor(v.anim) % frames.length];
      }
      const rc = this.rects[sid];
      if (!rc) continue;
      const bob = m.speed > 0.3 && !m.dead ? Math.abs(Math.sin(v.anim * Math.PI)) * 0.05 : 0;
      this.dyn.setAlpha(v.id, 1);
      this.dyn.setPos(v.id, m.x, bob, m.z);
      // feet on the floor; only carp float
      this.dyn.setRect(v.id, rc, rc.w * PX, rc.h * PX, (rc.ox + rc.w / 2 - rc.fw / 2) * PX, m.kind === 'carp' ? (rc.fh - rc.oy - rc.h) * PX : 0);
      this.lightField.sample(m.x, m.z, t);
      this.dyn.setTint(v.id, Math.min(1.3, t[0] + 0.05), Math.min(1.3, t[1] + 0.05), Math.min(1.3, t[2] + 0.05));
      v.hi = this.target && this.target.k === 'mob' && this.target.id === mid ? 1 : 0;
      this.dyn.setHighlight(v.id, v.hi);
    }
  }

  setTarget(t) {
    const old = this.target;
    if (old && old.k === 'item') { const id = this.itemSlot.get(old.id); if (id !== undefined) this.itemB.setHighlight(id, 0); }
    this.target = t;
    if (t && t.k === 'item') { const id = this.itemSlot.get(t.id); if (id !== undefined) this.itemB.setHighlight(id, 1); }
  }

  // ------------------------------------------------------------------ lighting
  rebuildLights() {
    const { rep, lightField: lf } = this;
    const { world, props, power } = rep;
    lf.clear(this.ambient);
    for (let i = 0; i < world.W * world.H; i++) {
      const k = world.kind[i];
      if (k === KIND.SPACE || k === KIND.LATTICE) { lf.r[i] = 0.11; lf.g[i] = 0.12; lf.b[i] = 0.16; }
    }
    for (const L of props.lights) {
      const m = lightMode(L, power.state, power.areaOn, power.areaLights, world.areas);
      L.on = m.on;
      if (L.st && L.st.id !== undefined) this.stat.setEmit(L.st.id, m.on && this.lightScale > 0.5 ? 1 : 0);
      if (!m.on) continue;
      const col = m.tint ? [L.color[0] * m.tint[0], L.color[1] * m.tint[1], L.color[2] * m.tint[2]] : L.color;
      lf.addSource(L.x / TILE, L.z / TILE, col, L.radius, L.strength * (m.scale ?? 1) * this.lightScale);
    }
    lf.finalize();
    this.levelMesh.relight(lf);
    this.relightSprites();
    this.relightItems();
  }

  relightSprites() {
    const t = this.tmpC;
    const touched = new Set();
    for (const e of this.lit) {
      this.lightField.sample(e.sx, e.sz, t);
      e.batch.setTint(e.id, Math.min(1.35, t[0]), Math.min(1.35, t[1]), Math.min(1.35, t[2]));
      touched.add(e.batch);
    }
    for (const b of touched) b.flush();
  }

  relightItems() {
    const t = this.tmpC;
    for (const [iid, id] of this.itemSlot) {
      const it = this.rep.items.get(iid);
      if (!it) continue;
      this.lightField.sample(it.x, it.z, t);
      this.itemB.setTint(id, Math.min(1.35, t[0]), Math.min(1.35, t[1]), Math.min(1.35, t[2]));
    }
  }

  flickerLights(sec, now) { this.flicker = { until: now + sec, next: 0, on: true }; }

  updateFlicker(now) {
    const f = this.flicker;
    if (!f) return;
    if (now >= f.until) { this.flicker = null; this.lightScale = 1; this.rebuildLights(); return; }
    if (now >= f.next) {
      f.next = now + 0.1 + Math.random() * 0.18;
      f.on = !f.on;
      this.lightScale = f.on ? 1 : 0.1;
      this.rebuildLights();
    }
  }

  // ------------------------------------------------------------------ world changes
  tilesChanged(tiles) {
    this.levelMesh.rebuildTiles(tiles);
    this.rebuildLights();
  }

  onEvac(ev) {
    const { added } = ev;
    for (const t of added.tables) this.levelMesh.tableAt.set(t.r * this.rep.world.W + t.c, t);
    this.levelMesh.extras.panes = this.rep.props.panes;
    this.addStatics(added.statics);
    for (let k = this.doorViews.length; k < this.rep.doors.length; k++) this.addDoorView(this.rep.doors[k]);
    this.levelMesh.rebuildTiles(ev.tiles);
    this.rebuildLights();
  }

  /** While dragging: a ring on the floor where the thing will land (green) or the way it will be thrown (red). */
  setDropMarker(fp, now) {
    if (!this.marker) {
      const g = new THREE.RingGeometry(0.16, 0.24, 20);
      g.rotateX(-Math.PI / 2);
      this.marker = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x46e08a, transparent: true, opacity: 0.85, depthWrite: false, fog: false }));
      this.marker.renderOrder = 3;
      this.scene.add(this.marker);
    }
    const m = this.marker;
    m.visible = !!fp;
    if (!fp) return;
    m.position.set(fp.x, fp.y + 0.015, fp.z);
    m.material.color.setHex(fp.ok ? 0x46e08a : 0xff4a3b);
    const s = 1 + Math.sin(now * 10) * 0.08;
    m.scale.set(s, 1, s);
  }

  /** A short-lived laser trace. */
  addBeam(a, b, col, now) {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...b)]);
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: col, fog: false }));
    line.frustumCulled = false;
    this.scene.add(line);
    this.beams.push({ line, until: now + 0.14 });
  }

  // ------------------------------------------------------------------ per frame
  update(dt, now, rt, cam, camYaw, selfId) {
    const rep = this.rep;
    for (const v of this.doorViews) {
      const f = this.doorFrame(v.d);
      if (f !== v.frame) { v.frame = f; const rc = this.rects[v.d.proto.fr[f]]; if (rc) this.setDoorRect(this.dyn, v.id, rc); }
    }
    this.updateMobs(dt, rt, cam, camYaw, selfId);
    this.updateFlicker(now);
    for (let i = this.beams.length - 1; i >= 0; i--) {
      if (now >= this.beams[i].until) { this.scene.remove(this.beams[i].line); this.beams[i].line.geometry.dispose(); this.beams.splice(i, 1); }
    }
    this.stars.position.copy(cam);
    this.stat.flush(); this.dyn.flush(); this.itemB.flush();
    void rep;
  }
}
