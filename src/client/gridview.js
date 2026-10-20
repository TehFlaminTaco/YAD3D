import * as THREE from 'three';
import { TILE, WALL_H, PX, KIND, DV } from '../shared/config.js';
import { ITEM_SCALE } from '../shared/propdata.js';
import { lightMode } from '../shared/power.js';
import { closetSprite } from '../shared/closets.js';
import { girderLook } from '../shared/walls.js';
import { tfCompose, tfInverse } from '../shared/math3.js';
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

/**
 * The picture of one grid: its terrain mesh, the sprite batches for its props, doors, built structures and floor items, and its light.
 * Everything is placed in the grid's own frame and lives in a group whose matrix the `WorldView` sets every frame, so a grid can sit (and,
 * later, move) anywhere in the map. Mobs are not here: they are drawn by the `WorldView`, in whichever frame the camera is in.
 */
export class GridView {
  constructor(scene, assets, grid, opts = {}) {
    this.scene = scene;
    this.assets = assets;
    this.grid = grid;
    this.items = opts.items || new Map();         // the replica's floor items (id -> record): what is lit by this grid's light is the ones on it
    this.rects = assets.rects;
    const { world, props } = grid;
    const big = world.n > 20000;
    const mat = spriteMaterial(assets.spriteTex);
    this.stat = new SpriteBatch(big ? 20000 : Math.max(400, props.statics.length * 2 + 200), mat);
    this.dyn = new SpriteBatch(big ? 3000 : Math.max(300, (props.doors.length + props.fdoors.length) * 2 + 200), mat);
    this.itemB = new SpriteBatch(big ? 6000 : 900, mat);
    this.group = new THREE.Group();
    this.group.matrixAutoUpdate = false;
    this.lit = [];                               // sprites whose tint follows the light field
    this.facing = [];                            // statics that show a different picture from each side
    this.lightScale = 1;
    this.flicker = null;
    this.ambient = opts.fullbright ? [0.85, 0.85, 0.85] : AMBIENT;
    this.tmpC = [0, 0, 0];
    this.tosses = [];

    this.lightField = new LightField(world);
    this.levelMesh = new LevelMesh(world, assets, { tables: props.tables, panes: props.panes });
    this.group.add(this.levelMesh.group, this.stat.mesh, this.dyn.mesh, this.itemB.mesh);
    scene.add(this.group);
    this.addStatics(props.statics);
    for (const it of props.closets) this.setClosetView(it);     // the welcome may have told us some are open

    this.doorViews = [];
    for (const d of grid.doors) this.addDoorView(d);
    this.fdoorViews = grid.fdoors.map((f) => this.addFdoorView(f));
    this.mirrors = this.addMirrors();
    this.builtView = new Map();                  // built structure id -> its sprite slot
    this.builtFree = [];
    for (const b of grid.built) this.addBuilt(b);
    this.itemSlot = new Map();                   // item id -> sprite id
    this.itemFree = [];
    this.coverSeen = grid.world.covered.slice();
    this.rebuildLights();
  }

  get id() { return this.grid.id; }

  /** Put this grid in the scene: its pose relative to the grid the scene is drawn in (the one the player stands on). */
  place(frame) {
    const m = this.group.matrix;
    if (frame === this.grid) { m.identity(); return; }
    const t = tfCompose(tfInverse(frame.tf), this.grid.tf);
    m.compose(new THREE.Vector3(...t.p), new THREE.Quaternion(...t.q), new THREE.Vector3(1, 1, 1));
  }

  dispose() {
    this.scene.remove(this.group);
    for (const ch of [...this.levelMesh.chunks.keys()]) this.levelMesh.disposeChunk(ch);
    for (const m of this.mirrors) { m.mesh.geometry.dispose(); m.mat.dispose(); }
    for (const b of [this.stat, this.dyn, this.itemB]) b.geometry.dispose();
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
    for (const it of this.grid.props.interact) {
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
      this.group.add(mesh);
      out.push({ it, mesh, mat, n, r, cx, cz, cy });
    }
    return out;
  }

  /** `cam` and `camYaw` are in this grid's frame; `mine` is your own mob's view (its sprite set draws the reflection), if it is in sight. */
  updateMirrors(mine, cam, camYaw) {
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
    const yaw = f.yaw ?? 0;
    // a firelock in an airlock's doorway is drawn a little to one side of it: two closed doors in one plane would flicker through each other
    const off = this.grid.world.doorAt.has(f.i) ? 0.2 : 0;
    const fx = f.x + Math.sin(yaw) * off, fz = f.z + Math.cos(yaw) * off;
    const id = this.dyn.add({ x: fx, y: 0, z: fz, mode: 1, w: rc.w * PX, h: rc.h * PX * SY, ox: (rc.ox + rc.w / 2 - rc.fw / 2) * PX, oy: (rc.fh - rc.oy - rc.h) * PX * SY, yaw, rect: rc, alpha: f.closed ? 1 : 0 });
    this.lit.push({ batch: this.dyn, id, sx: f.x, sz: f.z });
    return { f, id };
  }

  setFdoor(f) {
    const v = this.fdoorViews[f.idx];
    if (v) { this.dyn.setAlpha(v.id, f.closed ? 1 : 0); this.relightSprites(); }
  }

  // ------------------------------------------------------------------ things players build (girders)
  builtRect(rec) { return this.rects[this.assets.level.structs?.[girderLook(rec.st).sprite]]; }

  addBuilt(rec) {
    const rc = rec && this.builtRect(rec);
    if (!rc) return;
    const x = rec.c * TILE + TILE / 2, z = rec.r * TILE + TILE / 2, w = rc.w * PX, h = rc.h * PX, ox = (rc.ox + rc.w / 2 - rc.fw / 2) * PX;
    const free = this.builtFree.pop();
    let id;
    if (free !== undefined) {
      id = free;
      this.dyn.setPos(id, x, 0, z); this.dyn.setRect(id, rc, w, h, ox, 0); this.dyn.setAlpha(id, 1); this.dyn.setHighlight(id, 0);
    } else id = this.dyn.add({ x, y: 0, z, mode: 0, w, h, ox, oy: 0, yaw: 0, rect: rc });
    const lit = { batch: this.dyn, id, sx: x, sz: z };
    this.lit.push(lit);
    this.lightField.sample(x, z, this.tmpC);
    this.dyn.setTint(id, Math.min(1.35, this.tmpC[0]), Math.min(1.35, this.tmpC[1]), Math.min(1.35, this.tmpC[2]));
    this.builtView.set(rec.id, { id, lit });
  }

  /** A built thing changed state: another picture. */
  updateBuilt(rec) {
    const v = rec && this.builtView.get(rec.id), rc = rec && this.builtRect(rec);
    if (v && rc) this.dyn.setRect(v.id, rc, rc.w * PX, rc.h * PX, (rc.ox + rc.w / 2 - rc.fw / 2) * PX, 0);
  }

  removeBuilt(id) {
    const v = this.builtView.get(id);
    if (!v) return;
    this.dyn.setAlpha(v.id, 0);
    this.builtFree.push(v.id);
    const k = this.lit.indexOf(v.lit);
    if (k >= 0) this.lit.splice(k, 1);
    this.builtView.delete(id);
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
  addToss(it, a, b, now) {
    const rc = it && this.rects[it.s];
    if (!rc) return;
    const sid = this.allocItemSprite(rc, a[0], a[1], a[2]);
    this.itemB.setTint(sid, 1, 1, 1);
    this.hideItem(it.id, true);
    const dist = Math.hypot(b[0] - a[0], b[2] - a[2]);
    this.tosses.push({ id: it.id, sid, a, b, t0: now, dur: Math.max(0.18, Math.min(0.7, dist / 10)), arc: 0.25 + Math.sqrt(dist) * 0.22 });
  }

  updateTosses(now) {
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
  moveItem(it) {
    const id = it && this.itemSlot.get(it.id);
    if (id === undefined) return;
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

  removeItem(itemId) {
    const id = this.itemSlot.get(itemId);
    if (id === undefined) return;
    this.itemSlot.delete(itemId);
    this.itemB.setAlpha(id, 0);
    this.itemFree.push(id);
  }

  highlightItem(itemId, on) {
    const id = this.itemSlot.get(itemId);
    if (id !== undefined) this.itemB.setHighlight(id, on ? 1 : 0);
  }

  // ------------------------------------------------------------------ lighting
  rebuildLights() {
    const { grid, lightField: lf } = this;
    const { world, props, power } = grid;
    lf.clear(this.ambient);
    for (let i = 0; i < world.n; i++) {
      const k = world.kind[i];
      if ((k === KIND.SPACE && !world.covered[i]) || k === KIND.LATTICE) { lf.r[i] = 0.11; lf.g[i] = 0.12; lf.b[i] = 0.16; }
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
      const it = this.items.get(iid);
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
  /** Another grid has come or gone against this one (a shuttle docked): the tiles it covers are drawn, and lit, differently. */
  refreshCovered() {
    const w = this.grid.world, now = w.covered, tiles = [];
    for (let i = 0; i < now.length; i++) if (now[i] !== this.coverSeen[i]) tiles.push([i % w.W, Math.floor(i / w.W)]);
    this.coverSeen = now.slice();
    if (tiles.length) this.tilesChanged(tiles);
  }

  tilesChanged(tiles) {
    this.levelMesh.rebuildTiles(tiles);
    this.rebuildLights();
  }

  // ------------------------------------------------------------------ per frame
  /** `cam` (a {x, y, z}) and `camYaw` are in this grid's own frame. */
  update(dt, now, cam, camYaw, mine) {
    for (const v of this.doorViews) {
      const f = this.doorFrame(v.d);
      if (f !== v.frame) { v.frame = f; const rc = this.rects[v.d.proto.fr[f]]; if (rc) this.setDoorRect(this.dyn, v.id, rc); }
    }
    this.updateSlides(dt);
    this.updateFacing(cam, camYaw);
    this.updateMirrors(mine, cam, camYaw);
    this.updateTosses(now);
    this.updateFlicker(now);
    this.stat.flush(); this.dyn.flush(); this.itemB.flush();
  }
}
