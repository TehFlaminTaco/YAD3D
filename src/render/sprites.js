import * as THREE from 'three';

/**
 * One draw call for thousands of sprite quads. Per-instance data lives in 5 vec4 attributes
 * (see SPRITE_VERT in materials.js). Modes: 0 billboard, 1 fixed vertical, 2 ceiling, 3 floor.
 */
export class SpriteBatch {
  constructor(capacity, material) {
    this.cap = capacity;
    this.n = 0;
    this.A = new Float32Array(capacity * 4);
    this.B = new Float32Array(capacity * 4);
    this.UV = new Float32Array(capacity * 4);
    this.C = new Float32Array(capacity * 4);
    this.D = new Float32Array(capacity * 4);
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0]), 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.attr = {};
    for (const [name, arr] of [['iA', this.A], ['iB', this.B], ['iUV', this.UV], ['iC', this.C], ['iD', this.D]]) {
      const a = new THREE.InstancedBufferAttribute(arr, 4);
      a.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute(name, a);
      this.attr[name] = a;
    }
    g.instanceCount = 0;
    this.geometry = g;
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.frustumCulled = false;
    this.dirty = new Set();
  }

  /** o: {x,y,z, mode, w,h, ox,oy, rect, yaw, tint, alpha, emit} */
  add(o) {
    if (this.n >= this.cap) throw new Error('SpriteBatch full');
    const id = this.n++;
    const t = o.tint || [1, 1, 1];
    this.A.set([o.x, o.y, o.z, o.mode || 0], id * 4);
    this.B.set([o.w, o.h, o.ox || 0, o.oy || 0], id * 4);
    const r = o.rect;
    this.UV.set(r ? [r.u0, r.v0, r.u1, r.v1] : [0, 0, 0, 0], id * 4);
    this.C.set([t[0], t[1], t[2], o.alpha === undefined ? 1 : o.alpha], id * 4);
    this.D.set([o.yaw || 0, o.emit || 0, 0, 0], id * 4);
    for (const k of ['iA', 'iB', 'iUV', 'iC', 'iD']) this.dirty.add(k);
    return id;
  }

  setRect(id, rect, w, h, ox, oy) {
    this.UV.set([rect.u0, rect.v0, rect.u1, rect.v1], id * 4);
    this.dirty.add('iUV');
    if (w !== undefined) { this.B.set([w, h, ox, oy], id * 4); this.dirty.add('iB'); }
  }
  setPos(id, x, y, z) { this.A[id * 4] = x; this.A[id * 4 + 1] = y; this.A[id * 4 + 2] = z; this.dirty.add('iA'); }
  setYaw(id, yaw) { this.D[id * 4] = yaw; this.dirty.add('iD'); }
  setTint(id, r, g, b) { const i = id * 4; this.C[i] = r; this.C[i + 1] = g; this.C[i + 2] = b; this.dirty.add('iC'); }
  setAlpha(id, a) { this.C[id * 4 + 3] = a; this.dirty.add('iC'); }
  setHighlight(id, v) { this.D[id * 4 + 2] = v; this.dirty.add('iD'); }
  setEmit(id, v) { this.D[id * 4 + 1] = v; this.dirty.add('iD'); }
  getPos(id, out) { out.x = this.A[id * 4]; out.y = this.A[id * 4 + 1]; out.z = this.A[id * 4 + 2]; return out; }

  clear() { this.n = 0; this.geometry.instanceCount = 0; }

  flush() {
    this.geometry.instanceCount = this.n;
    for (const k of this.dirty) this.attr[k].needsUpdate = true;
    this.dirty.clear();
  }
}
