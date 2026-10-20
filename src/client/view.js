import * as THREE from 'three';
import { PX, CENTER_H } from '../shared/config.js';
import { facingTo, pointTo } from '../shared/frames.js';
import { rng } from '../shared/util.js';
import { GridView, viewIndex } from './gridview.js';

export { viewIndex };

/**
 * Everything you can see: a `GridView` for every grid of the map, the people, the stars, the highlight and the effects. Reads the Replica, never
 * writes it.
 *
 * The scene is drawn in one frame (`frame`): the grid the player stands on, so that its picture sits at the origin and the other grids are placed relative
 * to it, or, floating free, a `Frame` as turned as you are (you keep the up of the grid you left). Each grid's picture draws its own people, standing upright
 * on it: how they face is worked out from where the camera is in that grid's frame, so it still follows where you are looking from.
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

    this.mobViews = new Map();
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
    for (const mv of this.mobViews.values()) if (mv.gv === v) { mv.gv = null; mv.id = -1; }              // whoever was drawn in it gets a place in another's picture when next seen
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
    this.mobViews.set(m.id, { m, id: -1, gv: null, set, chars, anim: Math.random() * 4 });       // (it gets a place in a grid's picture when it is first drawn: see seat)
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
    this.unseat(v);
    this.mobViews.delete(mid);
    if (v.chars) this.assets.charart.release(v.set);
    if (this.target && this.target.k === 'mob' && this.target.id === mid) this.target = null;
  }

  /** Pick the smoothed position for rendering time `rt` from the mob's snapshot buffer. */
  interpolate(m, rt) {
    const b = m.buf;
    if (!b.length) return;
    if (rt <= b[0].t) { m.g = b[0].g; m.x = b[0].x; m.z = b[0].z; m.yaw = b[0].yaw; m.y = b[0].y; return; }
    const last = b[b.length - 1];
    if (rt >= last.t) { m.g = last.g; m.x = last.x; m.z = last.z; m.yaw = last.yaw; m.y = last.y; return; }
    for (let i = b.length - 2; i >= 0; i--) {
      if (b[i].t <= rt) {
        const a = b[i], c = b[i + 1];
        if (a.g !== c.g) { m.g = c.g; m.x = c.x; m.z = c.z; m.yaw = c.yaw; m.y = c.y; return; }      // stepped onto another grid: no blending between two frames
        m.g = a.g;
        const k = (rt - a.t) / Math.max(1e-4, c.t - a.t);
        m.x = a.x + (c.x - a.x) * k; m.z = a.z + (c.z - a.z) * k; m.y = a.y + (c.y - a.y) * k;
        let dy = c.yaw - a.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        m.yaw = a.yaw + dy * k;
        return;
      }
    }
  }

  /** Where someone's feet are in the scene's frame (set by `updateMobs` each frame): { x, y, z }. */
  mobPose(m) { return m.fx === undefined ? { x: m.x, y: 0, z: m.z } : { x: m.fx, y: m.fy, z: m.fz }; }

  /** Give a mob a place in the sprite batch of the grid it is on (it may have just walked onto another). */
  seat(v, gv) {
    if (v.gv === gv) return;
    this.unseat(v);
    v.gv = gv;
    const free = gv.mobFree.pop();
    v.id = free !== undefined ? free : gv.mobB.add({ x: 0, y: 0, z: 0, mode: 0, w: 2, h: 2, rect: this.rects[0] });
    gv.mobB.setAlpha(v.id, 1);
  }

  unseat(v) {
    if (!v.gv) return;
    v.gv.mobB.setAlpha(v.id, 0);
    v.gv.mobFree.push(v.id);
    v.gv = null; v.id = -1;
  }

  updateMobs(dt, rt, selfId) {
    const t = this.tmpC;
    for (const [mid, v] of this.mobViews) {
      const m = v.m;
      if (mid === selfId) { if (v.gv) v.gv.mobB.setAlpha(v.id, 0); continue; }
      this.interpolate(m, rt);
      const gv = this.views.get(m.g);
      if (!gv) { if (v.gv) v.gv.mobB.setAlpha(v.id, 0); continue; }                    // on a grid we have not been told about
      this.seat(v, gv);
      const B = gv.mobB, cam = gv.cam, void_ = gv.grid.kind === 'void';
      const feet = void_ ? (m.y || 0) - CENTER_H : 0;                                  // (floating, a body is placed by its middle)
      const [fx, fy, fz] = this.toFrame(m.g, m.x, feet, m.z);                           // where that is in the scene, for whatever is drawn over it
      m.fx = fx; m.fy = fy; m.fz = fz;
      let sid, still;
      if ((m.dead || m.lying) && (m.dead ? v.set.dead : v.set.lie ?? v.set.dead) >= 0) still = sid = m.dead ? v.set.dead : v.set.lie ?? v.set.dead;       // dead, stunned or held down: on their side
      else {
        const di = viewIndex(-Math.sin(m.yaw), -Math.cos(m.yaw), m.x - cam.x, m.z - cam.z, Math.cos(cam.yaw), -Math.sin(cam.yaw));     // all in the grid's own frame
        const frames = v.set.d[di];
        v.anim += m.speed * dt * 1.6;
        sid = frames[Math.floor(v.anim) % frames.length];
        still = frames[0];
      }
      const rc = this.rects[sid];
      if (!rc) continue;
      const bob = m.speed > 0.3 && !m.dead ? Math.abs(Math.sin(v.anim * Math.PI)) * 0.05 : 0;
      B.setAlpha(v.id, 1);
      B.setPos(v.id, m.x, feet + bob, m.z);
      // feet on the floor; only carp float
      const lift = m.kind === 'carp' ? (rc.fh - rc.oy - rc.h) * PX : 0;
      B.setRect(v.id, rc, rc.w * PX, rc.h * PX, (rc.ox + rc.w / 2 - rc.fw / 2) * PX, lift);
      v.top = lift + (this.rects[still] ?? rc).h * PX;       // where the picture ends, for speech to sit on (the standing frame: a walk cycle must not shake it)
      gv.lightField.sample(m.x, m.z, t);
      B.setTint(v.id, Math.min(1.3, t[0] + 0.05), Math.min(1.3, t[1] + 0.05), Math.min(1.3, t[2] + 0.05));
      v.hi = this.target && this.target.k === 'mob' && this.target.id === mid ? 1 : 0;
      B.setHighlight(v.id, v.hi);
    }
    for (const gv of this.views.values()) gv.mobB.flush();
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
   * `frame` is what the scene is drawn in (a grid, or a `Frame` when you float free); `cam`, `camYaw` and `camPitch` are in its frame. Each grid is put where
   * it is relative to it, and shown the camera in its own frame.
   */
  update(dt, now, rt, cam, camYaw, camPitch, selfId, frame) {
    this.frame = frame;
    const mine = this.mobViews.get(selfId);
    for (const v of this.views.values()) {
      v.place(frame);
      if (v.grid === frame) { v.cam = { x: cam.x, y: cam.y, z: cam.z, yaw: camYaw }; v.update(dt, now, cam, camYaw, mine); continue; }
      const [x, y, z] = pointTo(frame, v.grid, cam.x, cam.y, cam.z);
      const yaw = facingTo(frame, v.grid, camYaw, camPitch).yaw;
      v.cam = { x, y, z, yaw };
      v.update(dt, now, v.cam, yaw, mine);
    }
    this.updateMobs(dt, rt, selfId);
    for (let i = this.beams.length - 1; i >= 0; i--) {
      if (now >= this.beams[i].until) { this.scene.remove(this.beams[i].line); this.beams[i].line.geometry.dispose(); this.beams.splice(i, 1); }
    }
    this.stars.position.copy(cam);
    const fq = frame.tf.q;
    this.stars.quaternion.set(-fq[0], -fq[1], -fq[2], fq[3]);          // the stars are fixed in the map: in the frame of a grid that turns, they turn the other way
  }
}
