import * as THREE from 'three';
import { TILE, WALL_H, PX, KIND, DV } from '../shared/config.js';
import { ITEM_SCALE } from '../shared/propdata.js';
import { lightMode } from '../shared/power.js';
import { rng } from '../shared/util.js';
import { closetSprite } from '../shared/closets.js';
import { LevelMesh } from '../render/level.js';
import { LightField } from '../render/lighting.js';
import { SpriteBatch } from '../render/sprites.js';
import { spriteMaterial } from '../render/materials.js';

const SY = WALL_H / TILE;                       // doors are drawn taller than a 32px tile is wide
const AMBIENT = [0.045, 0.045, 0.06];

const MIRROR_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
/* The glass is an oval inside the sprite's frame; the picture is the image's sprite placed on it (uSpr: its left, bottom,
   right and top in metres from the glass centre) and anything outside the glass or the sprite is discarded. */
const MIRROR_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec4 uSpr;
uniform vec4 uUv;
uniform vec2 uSize;
uniform float uFlip;
uniform vec3 uTint;
varying vec2 vUv;
void main() {
  vec2 e = (vUv - 0.5) * 2.0 / vec2(0.857, 0.895);
  if (dot(e, e) > 1.0) discard;
  vec2 p = (vUv - 0.5) * uSize;
  vec2 s = (p - uSpr.xy) / (uSpr.zw - uSpr.xy);
  if (s.x < 0.0 || s.x > 1.0 || s.y < 0.0 || s.y > 1.0) discard;
  float sx = uFlip > 0.5 ? 1.0 - s.x : s.x;
  vec4 t = texture2D(uMap, vec2(mix(uUv.x, uUv.z, clamp(sx, 0.001, 0.999)), mix(uUv.w, uUv.y, clamp(s.y, 0.001, 0.999))));
  if (t.a < 0.45) discard;
  gl_FragColor = vec4(t.rgb * uTint, 1.0);
}
`;

/**
 * Which of a thing's four pictures (0 front, 1 back, 2 faces your right, 3 faces your left: SS13's S, N, E, W) you should see,
 * given the way it faces (fx, fz), where it is from the camera (vx, vz) and the camera's right (camRx, camRz).
 */
export function viewIndex(fx, fz, vx, vz, camRx, camRz) {
  const dot = (fx * vx + fz * vz) / (Math.hypot(vx, vz) || 1);
  const side = fx * camRx + fz * camRz;
  return dot > 0.62 ? 1 : dot < -0.62 ? 0 : side > 0 ? 2 : 3;
}

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
    this.facing = [];                            // statics that show a different picture from each side
    this.lightScale = 1;
    this.flicker = null;
    this.ambient = opts.fullbright ? [0.85, 0.85, 0.85] : AMBIENT;

    this.lightField = new LightField(world);
    this.tmpC = [0, 0, 0];
    this.levelMesh = new LevelMesh(world, assets, { tables: props.tables, panes: props.panes });
    scene.add(this.levelMesh.group, this.stat.mesh, this.dyn.mesh, this.itemB.mesh);
    this.addStatics(props.statics);
    for (const it of props.closets) this.setClosetView(it);     // the welcome may have told us some are open

    this.doorViews = [];
    for (const d of rep.doors) this.addDoorView(d);
    this.fdoorViews = rep.fdoors.map((f) => this.addFdoorView(f));
    this.mirrors = this.addMirrors();

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
      if (s.lit) this.lit.push(s.litRef = { batch: this.stat, id: s.id, sx: s.lit[0], sz: s.lit[1] });
      s.dx = s.x; s.dz = s.z;                           // where it is drawn right now (it slides when dragged)
      if (s.views) { s.vi = -1; this.facing.push(s); }
    }
  }

  /** Show a closet as its state says: closed, locked, welded or open (or gone). */
  setClosetView(it) {
    const rc = this.rects[closetSprite(it)];
    if (!it.st || !rc) return;
    this.stat.setRect(it.st.id, rc, rc.w * PX, rc.h * PX, (rc.ox + rc.w / 2 - rc.fw / 2) * PX, 0);
    this.stat.setAlpha(it.st.id, it.gone ? 0 : 1);
  }

  // ------------------------------------------------------------------ mirrors
  /**
   * A mirror shows you as you would be if you stood as far behind the glass as you stand in front of it: the same
   * sprite you would be drawn with there (so it turns as you turn), projected from your eye onto the glass, which is what
   * sets its size and how far it slides sideways as you move along the wall, and cut to the oval of the glass.
   */
  addMirrors() {
    const out = [];
    for (const it of this.rep.props.interact) {
      if (it.kind !== 'wm' || it.sub !== 'mirror' || !it.st) continue;
      const st = it.st;
      const n = { x: Math.sin(st.yaw), z: Math.cos(st.yaw) };          // out of the wall, into the room
      const r = { x: n.z, z: -n.x };                                   // along the wall
      const cx = st.x + r.x * (st.ox || 0) + n.x * 0.012, cz = st.z + r.z * (st.ox || 0) + n.z * 0.012;
      const cy = st.y + st.h / 2;
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uMap: { value: this.assets.spriteTex }, uSpr: { value: new THREE.Vector4() }, uUv: { value: new THREE.Vector4() },
          uSize: { value: new THREE.Vector2(st.w, st.h) }, uFlip: { value: 0 }, uTint: { value: new THREE.Vector3(1, 1, 1) },
        },
        vertexShader: MIRROR_VERT, fragmentShader: MIRROR_FRAG, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(st.w, st.h), mat);
      mesh.position.set(cx, cy, cz);
      mesh.rotation.y = st.yaw;
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      out.push({ it, mesh, mat, n, r, cx, cz, cy });
    }
    return out;
  }

  updateMirrors(selfId, cam, camYaw) {
    const mine = this.mobViews.get(selfId);
    const ok = mine && mine.chars && !mine.m.dead;
    const camRx = Math.cos(camYaw), camRz = -Math.sin(camYaw);          // the camera's right
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);               // the way you face
    for (const m of this.mirrors) {
      const dc = (cam.x - m.cx) * m.n.x + (cam.z - m.cz) * m.n.z;       // how far in front of the glass you are
      if (!ok || dc < 0.3 || dc > 5.5) { m.mesh.visible = false; continue; }
      const ix = cam.x - 2 * dc * m.n.x, iz = cam.z - 2 * dc * m.n.z;   // where the image of your feet is, behind the glass
      const fdn = fx * m.n.x + fz * m.n.z;
      const gx = fx - 2 * fdn * m.n.x, gz = fz - 2 * fdn * m.n.z;       // the image faces the mirrored way
      const vx = ix - cam.x, vz = iz - cam.z, vl = Math.hypot(vx, vz) || 1;
      const dot = (gx * vx + gz * vz) / vl, side = gx * camRx + gz * camRz;
      const di = dot > 0.62 ? 1 : dot < -0.62 ? 0 : side > 0 ? 2 : 3;   // same choice of sprite as for anyone else
      const rc = this.rects[mine.set.d[di][0]];
      if (!rc || !rc.w) { m.mesh.visible = false; continue; }
      // the image stands up facing your eye; project its corners through your eye onto the plane of the glass
      const ox = (rc.ox + rc.w / 2 - rc.fw / 2) * PX, hw = rc.w * PX / 2, H = rc.h * PX;
      const onGlass = (x, z, y) => {
        const t = dc / (dc - ((x - m.cx) * m.n.x + (z - m.cz) * m.n.z));
        return [((cam.x + (x - cam.x) * t - m.cx) * m.r.x + (cam.z + (z - cam.z) * t - m.cz) * m.r.z), cam.y + (y - cam.y) * t - m.cy];
      };
      const [l0, yFoot] = onGlass(ix + camRx * (ox - hw), iz + camRz * (ox - hw), 0);
      const [l1] = onGlass(ix + camRx * (ox + hw), iz + camRz * (ox + hw), 0);
      const [, yHead] = onGlass(ix + camRx * ox, iz + camRz * ox, H);
      const u = m.mat.uniforms;
      u.uSpr.value.set(Math.min(l0, l1), yFoot, Math.max(l0, l1), yHead);
      u.uUv.value.set(rc.u0, rc.v0, rc.u1, rc.v1);
      u.uFlip.value = di < 2 ? 1 : 0;                                   // front and back views swap left and right in a mirror
      this.lightField.sample(m.cx + m.n.x, m.cz + m.n.z, this.tmpC);
      const t = this.tmpC;
      u.uTint.value.set(Math.min(1.15, t[0] * 0.9), Math.min(1.15, t[1] * 0.97), Math.min(1.2, t[2] * 1.08));
      m.mesh.visible = true;
    }
  }

  // ------------------------------------------------------------------ things that get dragged about
  /** A structure was dragged (its record already says where): the picture eases over to the new spot. */
  propMoved(it) {
    const s = it?.st;
    if (!s || s.id === undefined) return;
    if (s.litRef) { s.litRef.sx = s.x; s.litRef.sz = s.z; }
    (this.slides ||= new Set()).add(s);
  }

  updateSlides(dt) {
    if (!this.slides?.size) return;
    const k = 1 - Math.exp(-dt * 22);
    for (const s of this.slides) {
      const done = Math.abs(s.x - s.dx) < 0.002 && Math.abs(s.z - s.dz) < 0.002;
      s.dx = done ? s.x : s.dx + (s.x - s.dx) * k;
      s.dz = done ? s.z : s.dz + (s.z - s.dz) * k;
      this.stat.setPos(s.id, s.dx, s.y, s.dz);
      if (done) {
        this.slides.delete(s);
        this.lightField.sample(s.x, s.z, this.tmpC);
        const t = this.tmpC;
        this.stat.setTint(s.id, Math.min(1.35, t[0]), Math.min(1.35, t[1]), Math.min(1.35, t[2]));
      }
    }
  }

  // ------------------------------------------------------------------ things with four sides
  /** Chairs, consoles and the like: each turns the picture of the side you are looking at (see viewIndex). */
  updateFacing(cam, camYaw) {
    const camRx = Math.cos(camYaw), camRz = -Math.sin(camYaw);
    for (const s of this.facing) {
      const f = DV[s.face] || DV[2];
      const vi = viewIndex(f[0], f[1], s.x - cam.x, s.z - cam.z, camRx, camRz);
      if (vi === s.vi) continue;
      s.vi = vi;
      const rc = this.rects[s.views[vi]];
      if (rc) this.stat.setRect(s.id, rc, rc.w * PX, rc.h * PX, (rc.ox + rc.w / 2 - rc.fw / 2) * PX, 0);
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

  /** A floor item sprite slot (reusing freed ones). */
  allocItemSprite(rc, x, y, z) {
    const o = {
      x, y, z, mode: 0, w: rc.w * PX * ITEM_SCALE, h: rc.h * PX * ITEM_SCALE,
      ox: (rc.ox + rc.w / 2 - rc.fw / 2) * PX * ITEM_SCALE, oy: 0, rect: rc,
    };
    const free = this.itemFree.pop();
    if (free === undefined) return this.itemB.add(o);
    this.itemB.setPos(free, x, y, z);
    this.itemB.setRect(free, rc, o.w, o.h, o.ox, o.oy);
    this.itemB.setAlpha(free, 1);
    this.itemB.setHighlight(free, 0);
    return free;
  }

  /** Something thrown: fly a copy of it along an arc from a to b, then show the real one where it landed. */
  addToss(id, a, b, now) {
    const it = this.rep.items.get(id);
    const rc = it && this.rects[it.s];
    if (!rc) return;
    const sid = this.allocItemSprite(rc, a[0], a[1], a[2]);
    this.itemB.setTint(sid, 1, 1, 1);
    this.hideItem(id, true);
    const dist = Math.hypot(b[0] - a[0], b[2] - a[2]);
    (this.tosses ||= []).push({ id, sid, a, b, t0: now, dur: Math.max(0.18, Math.min(0.7, dist / 10)), arc: 0.25 + Math.sqrt(dist) * 0.22 });
  }

  updateTosses(now) {
    if (!this.tosses?.length) return;
    for (let i = this.tosses.length - 1; i >= 0; i--) {
      const T = this.tosses[i];
      const k = Math.min(1, (now - T.t0) / T.dur);
      const x = T.a[0] + (T.b[0] - T.a[0]) * k, z = T.a[2] + (T.b[2] - T.a[2]) * k;
      const y = T.a[1] + (T.b[1] - T.a[1]) * k + 4 * T.arc * k * (1 - k);
      this.itemB.setPos(T.sid, x, y, z);
      if (k >= 1) {
        this.itemB.setAlpha(T.sid, 0);
        this.itemFree.push(T.sid);
        this.hideItem(T.id, false);
        this.tosses.splice(i, 1);
      }
    }
  }

  /** A loose item was dragged along the floor. */
  moveItem(itemId) {
    const id = this.itemSlot.get(itemId), it = this.rep.items.get(itemId);
    if (id === undefined || !it) return;
    this.itemB.setPos(id, it.x, it.y, it.z);
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
    const chars = !!m.ap;                          // people are composed from layers; carp and pets are baked sets
    const set = chars ? this.assets.charart.acquire(m.ap) : this.assets.level.mobs[m.set];
    if (!set) return;
    const free = this.mobFree.pop();
    const id = free !== undefined ? free : this.dyn.add({ x: 0, y: 0, z: 0, mode: 0, w: 2, h: 2, rect: this.rects[0] });
    this.dyn.setAlpha(id, 1);
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
    this.dyn.setAlpha(v.id, 0);
    this.mobFree.push(v.id);
    this.mobViews.delete(mid);
    if (v.chars) this.assets.charart.release(v.set);
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
      if ((m.dead || m.lying) && (m.dead ? v.set.dead : v.set.lie ?? v.set.dead) >= 0) sid = m.dead ? v.set.dead : v.set.lie ?? v.set.dead;       // dead, stunned or held down: on their side
      else {
        const di = viewIndex(-Math.sin(m.yaw), -Math.cos(m.yaw), m.x - cam.x, m.z - cam.z, camRx, camRz);
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
    this.assets.charart.atlas.flush();
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
    this.updateSlides(dt);
    this.updateFacing(cam, camYaw);
    this.updateMobs(dt, rt, cam, camYaw, selfId);
    this.updateMirrors(selfId, cam, camYaw);
    this.updateTosses(now);
    this.updateFlicker(now);
    for (let i = this.beams.length - 1; i >= 0; i--) {
      if (now >= this.beams[i].until) { this.scene.remove(this.beams[i].line); this.beams[i].line.geometry.dispose(); this.beams.splice(i, 1); }
    }
    this.stars.position.copy(cam);
    this.stat.flush(); this.dyn.flush(); this.itemB.flush();
    void rep;
  }
}
