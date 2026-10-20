import * as THREE from 'three';
import { PX } from '../shared/config.js';
import { frameYaw, pointTo } from '../shared/frames.js';
import { rng } from '../shared/util.js';
import { GridView, viewIndex } from './gridview.js';
import { SpriteBatch } from '../render/sprites.js';
import { spriteMaterial } from '../render/materials.js';

export { viewIndex };

/**
 * Everything you can see: a `GridView` for every grid of the map, the people, the stars, the highlight and the effects. Reads the Replica, never
 * writes it.
 *
 * The scene is drawn in the frame of one grid, the one the player stands on (`frame`): its picture sits at the origin and the other grids are placed
 * relative to it. People are drawn here, not in their grid's view, in that same frame: someone on a shuttle is turned into your grid's coordinates
 * each frame, so the way they face still follows where you are looking from.
 */
export class WorldView {
  constructor(scene, assets, rep, opts = {}) {
    this.scene = scene;
    this.assets = assets;
    this.rep = rep;
    this.rects = assets.rects;
    this.opts = opts;
    this.frame = rep.station;                    // the grid the scene is drawn in
    this.views = new Map();                      // grid id -> GridView
    this.itemView = new Map();                   // item id -> the GridView it is drawn in
    for (const g of rep.grids.values()) this.addGrid(g);
    for (const it of rep.items.values()) this.addItem(it);

    this.mobB = new SpriteBatch(3000, spriteMaterial(assets.spriteTex));
    scene.add(this.mobB.mesh);
    this.mobViews = new Map();
    this.mobFree = [];
    this.tmpC = [0, 0, 0];
    this.target = null;
    this.beams = [];
    this.addStars();
  }

  // ------------------------------------------------------------------ grids
  addGrid(g) {
    if (this.views.has(g.id)) return this.views.get(g.id);
    const v = new GridView(this.scene, this.assets, g, { ...this.opts, items: this.rep.items });
    this.views.set(g.id, v);
    return v;
  }

  /** A grid has gone: its picture too (its items with it). */
  removeGrid(id) {
    const v = this.views.get(id);
    if (!v) return;
    for (const [iid, iv] of [...this.itemView]) if (iv === v) this.itemView.delete(iid);
    v.dispose();
    this.views.delete(id);
  }

  viewOf(gid) { return this.views.get(gid); }

  /** The grids lie differently against each other now (one came or went): redraw what that changes. */
  coverChanged() { for (const v of this.views.values()) v.refreshCovered(); }

  /** A point of grid `gid`'s frame ([x, y, z]) in the scene's frame. */
  toFrame(gid, x, y, z) {
    const g = this.rep.grids.get(gid);
    if (!g || g === this.frame) return [x, y, z];
    return pointTo(g, this.frame, x, y, z);
  }

  /** A facing in grid `gid`'s frame, in the scene's. */
  yawToFrame(gid, yaw) {
    const g = this.rep.grids.get(gid);
    return !g || g === this.frame ? yaw : yaw + frameYaw(g, this.frame);
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

  // ------------------------------------------------------------------ floor items
  addItem(it) {
    const v = this.views.get(it.g);
    if (!v) return;
    v.addItem(it);
    this.itemView.set(it.id, v);
  }

  moveItem(itemId) { const it = this.rep.items.get(itemId); this.itemView.get(itemId)?.moveItem(it); }
  hideItem(itemId, hide) { this.itemView.get(itemId)?.hideItem(itemId, hide); }
  removeItem(itemId) { this.itemView.get(itemId)?.removeItem(itemId); this.itemView.delete(itemId); }

  /** Something thrown: fly a copy of it from a to b (both in grid `gid`'s frame). */
  addToss(gid, id, a, b, now) {
    const it = this.rep.items.get(id);
    this.views.get(gid)?.addToss(it, a, b, now);
  }

  /** Where a floor item currently is, for animations. */
  itemPos(itemId) { return this.rep.items.get(itemId) || null; }

  // ------------------------------------------------------------------ mobs
  addMob(m) {
    const chars = !!m.ap;                          // people are composed from layers; carp and pets are baked sets
    const set = chars ? this.assets.charart.acquire(m.ap) : this.assets.level.mobs[m.set];
    if (!set) return;
    const free = this.mobFree.pop();
    const id = free !== undefined ? free : this.mobB.add({ x: 0, y: 0, z: 0, mode: 0, w: 2, h: 2, rect: this.rects[0] });
    this.mobB.setAlpha(id, 1);
    this.mobViews.set(m.id, { m, id, set, chars, anim: Math.random() * 4 });
  }

  /** Someone changed clothes or hair: compose them again and give the old picture back. */
  refreshMob(mid) {
    const v = this.mobViews.get(mid);
    if (!v || !v.chars || !v.m.ap) return;
    const old = v.set, fresh = this.assets.charart.acquire(v.m.ap);   // take the new picture before giving the old one back
    if (!fresh) return;
    v.set = fresh;
    this.assets.charart.release(old);
  }

  removeMob(mid) {
    const v = this.mobViews.get(mid);
    if (!v) return;
    this.mobB.setAlpha(v.id, 0);
    this.mobFree.push(v.id);
    this.mobViews.delete(mid);
    if (v.chars) this.assets.charart.release(v.set);
    if (this.target && this.target.k === 'mob' && this.target.id === mid) this.target = null;
  }

  /** Pick the smoothed position for rendering time `rt` from the mob's snapshot buffer. */
  interpolate(m, rt) {
    const b = m.buf;
    if (!b.length) return;
    if (rt <= b[0].t) { m.g = b[0].g; m.x = b[0].x; m.z = b[0].z; m.yaw = b[0].yaw; return; }
    const last = b[b.length - 1];
    if (rt >= last.t) { m.g = last.g; m.x = last.x; m.z = last.z; m.yaw = last.yaw; return; }
    for (let i = b.length - 2; i >= 0; i--) {
      if (b[i].t <= rt) {
        const a = b[i], c = b[i + 1];
        if (a.g !== c.g) { m.g = c.g; m.x = c.x; m.z = c.z; m.yaw = c.yaw; return; }      // stepped onto another grid: no blending between two frames
        m.g = a.g;
        const k = (rt - a.t) / Math.max(1e-4, c.t - a.t);
        m.x = a.x + (c.x - a.x) * k; m.z = a.z + (c.z - a.z) * k;
        let dy = c.yaw - a.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        m.yaw = a.yaw + dy * k;
        return;
      }
    }
  }

  /** Where someone is in the scene's frame (set by `updateMobs` each frame): { x, z, yaw }. */
  mobPose(m) { return m.fx === undefined ? { x: m.x, z: m.z, yaw: m.yaw } : { x: m.fx, z: m.fz, yaw: m.fyaw }; }

  updateMobs(dt, rt, cam, camYaw, selfId) {
    const camRx = Math.cos(camYaw), camRz = -Math.sin(camYaw);
    const t = this.tmpC;
    for (const [mid, v] of this.mobViews) {
      const m = v.m;
      if (mid === selfId) { this.mobB.setAlpha(v.id, 0); continue; }
      this.interpolate(m, rt);
      const gv = this.views.get(m.g);
      if (!gv) { this.mobB.setAlpha(v.id, 0); continue; }                              // on a grid we have not been told about
      const [fx, , fz] = this.toFrame(m.g, m.x, 0, m.z);
      const fyaw = this.yawToFrame(m.g, m.yaw);
      m.fx = fx; m.fz = fz; m.fyaw = fyaw;
      let sid, still;
      if ((m.dead || m.lying) && (m.dead ? v.set.dead : v.set.lie ?? v.set.dead) >= 0) still = sid = m.dead ? v.set.dead : v.set.lie ?? v.set.dead;       // dead, stunned or held down: on their side
      else {
        const di = viewIndex(-Math.sin(fyaw), -Math.cos(fyaw), fx - cam.x, fz - cam.z, camRx, camRz);
        const frames = v.set.d[di];
        v.anim += m.speed * dt * 1.6;
        sid = frames[Math.floor(v.anim) % frames.length];
        still = frames[0];
      }
      const rc = this.rects[sid];
      if (!rc) continue;
      const bob = m.speed > 0.3 && !m.dead ? Math.abs(Math.sin(v.anim * Math.PI)) * 0.05 : 0;
      this.mobB.setAlpha(v.id, 1);
      this.mobB.setPos(v.id, fx, bob, fz);
      // feet on the floor; only carp float
      const lift = m.kind === 'carp' ? (rc.fh - rc.oy - rc.h) * PX : 0;
      this.mobB.setRect(v.id, rc, rc.w * PX, rc.h * PX, (rc.ox + rc.w / 2 - rc.fw / 2) * PX, lift);
      v.top = lift + (this.rects[still] ?? rc).h * PX;       // where the picture ends, for speech to sit on (the standing frame: a walk cycle must not shake it)
      gv.lightField.sample(m.x, m.z, t);
      this.mobB.setTint(v.id, Math.min(1.3, t[0] + 0.05), Math.min(1.3, t[1] + 0.05), Math.min(1.3, t[2] + 0.05));
      v.hi = this.target && this.target.k === 'mob' && this.target.id === mid ? 1 : 0;
      this.mobB.setHighlight(v.id, v.hi);
    }
    this.assets.charart.atlas.flush();
  }

  setTarget(t) {
    const old = this.target;
    if (old && old.k === 'item') this.itemView.get(old.id)?.highlightItem(old.id, false);
    this.target = t;
    if (t && t.k === 'item') this.itemView.get(t.id)?.highlightItem(t.id, true);
  }

  // ------------------------------------------------------------------ lighting
  relightItems() { for (const v of this.views.values()) v.relightItems(); }

  // ------------------------------------------------------------------ effects
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

  /** A short-lived laser trace, from a to b (both in the scene's frame). */
  addBeam(a, b, col, now) {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...b)]);
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: col, fog: false }));
    line.frustumCulled = false;
    this.scene.add(line);
    this.beams.push({ line, until: now + 0.14 });
  }

  // ------------------------------------------------------------------ per frame
  /**
   * `frameId` is the grid the camera is in (the one you stand on); `cam` and `camYaw` are in its frame. Each grid is put where it is relative to
   * that one, and shown the camera in its own frame.
   */
  update(dt, now, rt, cam, camYaw, selfId, frameId) {
    const frame = this.rep.grids.get(frameId) || this.rep.station;
    this.frame = frame;
    const mine = this.mobViews.get(selfId);
    for (const v of this.views.values()) {
      v.place(frame);
      if (v.grid === frame) { v.update(dt, now, cam, camYaw, mine); continue; }
      const [x, y, z] = pointTo(frame, v.grid, cam.x, cam.y, cam.z);
      v.update(dt, now, { x, y, z }, camYaw + frameYaw(frame, v.grid), mine);
    }
    this.updateMobs(dt, rt, cam, camYaw, selfId);
    for (let i = this.beams.length - 1; i >= 0; i--) {
      if (now >= this.beams[i].until) { this.scene.remove(this.beams[i].line); this.beams[i].line.geometry.dispose(); this.beams.splice(i, 1); }
    }
    this.stars.position.copy(cam);
    const fq = frame.tf.q;
    this.stars.quaternion.set(-fq[0], -fq[1], -fq[2], fq[3]);          // the stars are fixed in the map: in the frame of a grid that turns, they turn the other way
    this.mobB.flush();
  }
}
