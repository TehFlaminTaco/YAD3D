import RAPIER from '../../vendor/rapier3d-compat.mjs';

/**
 * The grids' rigid-body engine, behind a small adapter so the engine can be swapped (Box3D was the other candidate). Rapier is a
 * WebAssembly module, so it has to be started once, asynchronously, before the first `PhysicsWorld` is made:
 *
 *     await initPhysics();      // server start, tests, the in-browser host
 *     new Sim(...)              // stays synchronous
 *
 * One world per map; one body per grid (never per person: people walk in their grid's own tile frame). Everything is in metres and
 * zero gravity. Bodies are named by the caller's ids, vectors are [x, y, z] and rotations [x, y, z, w] (see math3.js).
 */
let R = null;

export async function initPhysics() {
  if (R) return;
  await RAPIER.init();
  R = RAPIER;
}
export const physicsReady = () => !!R;

const TYPES = () => ({ dynamic: R.RigidBodyType.Dynamic, fixed: R.RigidBodyType.Fixed, kinematic: R.RigidBodyType.KinematicPositionBased });
const v3 = (a) => ({ x: a[0], y: a[1], z: a[2] });
const q4 = (a) => ({ x: a[0], y: a[1], z: a[2], w: a[3] });

/** Contact force events below this (newtons, summed over a contact pair) are not reported: grids resting against each other are not collisions. */
const CONTACT_THRESHOLD = 2000;

export class PhysicsWorld {
  constructor() {
    if (!R) throw new Error('physics is not started: await initPhysics() before making a Sim');
    this.world = new R.World({ x: 0, y: 0, z: 0 });
    this.events = new R.EventQueue(true);
    this.bodies = new Map();               // id -> { rb, cols: [], type }
    this.owner = new Map();                // collider handle -> body id
  }

  /**
   * o: { type: 'dynamic' | 'fixed' | 'kinematic', p, q, v, w, lock: { y, rx, rz } (true = cannot move / turn that way), damping: [lin, ang] }.
   * `lock.y` pins the body to its plane, `lock.rx` / `lock.rz` stop it tipping; together they leave only slides in x, z and a turn about y.
   */
  addBody(id, o = {}) {
    this.removeBody(id);
    const type = o.type || 'dynamic';
    const desc = new R.RigidBodyDesc(TYPES()[type]).setTranslation(...(o.p || [0, 0, 0])).setRotation(q4(o.q || [0, 0, 0, 1]));
    if (o.v) desc.setLinvel(...o.v);
    if (o.w) desc.setAngvel(v3(o.w));
    if (o.lock) desc.enabledTranslations(true, !o.lock.y, true).enabledRotations(!o.lock.rx, true, !o.lock.rz);
    if (o.damping) desc.setLinearDamping(o.damping[0]).setAngularDamping(o.damping[1]);
    desc.setCcdEnabled(true);
    const rb = this.world.createRigidBody(desc);
    const rec = { rb, cols: [], type };
    this.bodies.set(id, rec);
    return rec;
  }

  removeBody(id) {
    const rec = this.bodies.get(id);
    if (!rec) return;
    for (const c of rec.cols) this.owner.delete(c.handle);
    this.world.removeRigidBody(rec.rb);
    this.bodies.delete(id);
  }

  /**
   * Replace the body's shape with these boxes: [{ c: [x, y, z] centre, h: [hx, hy, hz] half-size, d: density }] in the body's own frame.
   * The body's mass and centre of mass follow from them.
   */
  setBoxes(id, boxes) {
    const rec = this.bodies.get(id);
    if (!rec) return;
    for (const c of rec.cols) { this.owner.delete(c.handle); this.world.removeCollider(c, false); }
    rec.cols = [];
    for (const b of boxes) {
      const d = R.ColliderDesc.cuboid(b.h[0], b.h[1], b.h[2]).setTranslation(b.c[0], b.c[1], b.c[2]).setDensity(b.d ?? 1)
        .setFriction(0.3).setRestitution(0.1)
        .setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(CONTACT_THRESHOLD);
      const col = this.world.createCollider(d, rec.rb);
      rec.cols.push(col);
      this.owner.set(col.handle, id);
    }
  }

  /** Let the body tip and rise (no locks: `{}`), or keep it in its plane again (`{ y, rx, rz: true }`). */
  setLocks(id, lock = {}) {
    const rec = this.bodies.get(id);
    if (!rec) return;
    rec.rb.setEnabledTranslations(true, !lock.y, true, true);
    rec.rb.setEnabledRotations(!lock.rx, true, !lock.rz, true);
  }

  setType(id, type) {
    const rec = this.bodies.get(id);
    if (!rec || rec.type === type) return;
    rec.type = type;
    rec.rb.setBodyType(TYPES()[type], true);
  }

  /** Put the body somewhere (a teleport for fixed and dynamic ones; a kinematic one is carried there on the next step). */
  setPose(id, p, q, zeroVel = false) {
    const rec = this.bodies.get(id);
    if (!rec) return;
    if (rec.type === 'kinematic') { rec.rb.setNextKinematicTranslation(v3(p)); rec.rb.setNextKinematicRotation(q4(q)); }
    else { rec.rb.setTranslation(v3(p), true); rec.rb.setRotation(q4(q), true); }
    if (zeroVel) { rec.rb.setLinvel({ x: 0, y: 0, z: 0 }, true); rec.rb.setAngvel({ x: 0, y: 0, z: 0 }, true); }
  }

  setVel(id, v, w) {
    const rec = this.bodies.get(id);
    if (!rec) return;
    if (v) rec.rb.setLinvel(v3(v), true);
    if (w) rec.rb.setAngvel(v3(w), true);
  }

  /** A steady force and torque (world frame) on the body, from now until it is changed: an engine burning. */
  thrust(id, f, t = [0, 0, 0]) {
    const rec = this.bodies.get(id);
    if (!rec) return;
    rec.rb.resetForces(false); rec.rb.resetTorques(false);
    rec.rb.addForce(v3(f), true); rec.rb.addTorque(v3(t), true);
  }

  impulse(id, j, point = null) {
    const rec = this.bodies.get(id);
    if (!rec) return;
    if (point) rec.rb.applyImpulseAtPoint(v3(j), v3(point), true); else rec.rb.applyImpulse(v3(j), true);
  }

  /** { p, q, v, w } of the body now (world frame of its map), or null. */
  pose(id) {
    const rec = this.bodies.get(id);
    if (!rec) return null;
    const rb = rec.rb, p = rb.translation(), q = rb.rotation(), v = rb.linvel(), w = rb.angvel();
    return { p: [p.x, p.y, p.z], q: [q.x, q.y, q.z, q.w], v: [v.x, v.y, v.z], w: [w.x, w.y, w.z] };
  }

  mass(id) { return this.bodies.get(id)?.rb.mass() ?? 0; }
  /** The centre of mass in the body's own frame. */
  centerOfMass(id) { const c = this.bodies.get(id)?.rb.localCom(); return c ? [c.x, c.y, c.z] : [0, 0, 0]; }

  /**
   * Advance the world by dt. Returns the collisions that were hard enough to matter:
   * [{ a, b, force, dir }] (the two bodies' ids, summed contact force in newtons, the direction of the strongest part of it).
   */
  step(dt) {
    this.world.timestep = dt;
    this.world.step(this.events);
    const out = [];
    this.events.drainContactForceEvents((e) => {
      const a = this.owner.get(e.collider1()), b = this.owner.get(e.collider2());
      if (a === undefined || b === undefined || a === b) return;
      const d = e.maxForceDirection();
      out.push({ a, b, force: e.totalForceMagnitude(), dir: [d.x, d.y, d.z] });
    });
    return out;
  }

  free() { this.world.free(); this.bodies.clear(); this.owner.clear(); }
}
