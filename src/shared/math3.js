// Vectors, quaternions and rigid transforms for grids. Plain arrays ([x, y, z], [x, y, z, w]) so they go straight into JSON snapshots and the sim
// needs no Three.js. Handedness is Three's: +y is up, a positive turn about +y is a turn to the left, and yaw 0 faces north (-z), so a
// body's forward is (-sin yaw, 0, -cos yaw) and `qYaw(yaw)` rotates local forward onto it.

export const V0 = Object.freeze([0, 0, 0]);
export const Q0 = Object.freeze([0, 0, 0, 1]);

export const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const vscale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const vcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const vlen = (a) => Math.hypot(a[0], a[1], a[2]);
export function vnorm(a) { const l = vlen(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

export function qnorm(q) {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}
export const qconj = (q) => [-q[0], -q[1], -q[2], q[3]];

/** a * b: apply b first, then a. */
export function qmul(a, b) {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

export function qFromAxisAngle(axis, ang) {
  const n = vnorm(axis), s = Math.sin(ang / 2);
  return [n[0] * s, n[1] * s, n[2] * s, Math.cos(ang / 2)];
}
export const qYaw = (yaw) => [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];

/** Rotate v by q. */
export function qrot(q, v) {
  const x = q[0], y = q[1], z = q[2], w = q[3];
  // t = 2 * cross(q.xyz, v); v' = v + w * t + cross(q.xyz, t)
  const tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]);
  return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
}
/** Rotate v by the inverse of q. */
export const qirot = (q, v) => qrot(qconj(q), v);

/** The turn of q about the vertical axis (what yaw is, when q is a pure yaw rotation). */
export function qToYaw(q) {
  // rotate the forward vector and read its heading
  const f = qrot(q, [0, 0, -1]);
  return Math.atan2(-f[0], -f[2]);
}

export function qslerp(a, b, t) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let bb = b;
  if (d < 0) { d = -d; bb = [-b[0], -b[1], -b[2], -b[3]]; }
  if (d > 0.9995) return qnorm([a[0] + (bb[0] - a[0]) * t, a[1] + (bb[1] - a[1]) * t, a[2] + (bb[2] - a[2]) * t, a[3] + (bb[3] - a[3]) * t]);
  const th = Math.acos(Math.min(1, d)), s = Math.sin(th);
  const ka = Math.sin((1 - t) * th) / s, kb = Math.sin(t * th) / s;
  return [a[0] * ka + bb[0] * kb, a[1] * ka + bb[1] * kb, a[2] * ka + bb[2] * kb, a[3] * ka + bb[3] * kb];
}

// ---- rigid transforms: { p: [x, y, z], q: [x, y, z, w] }, a frame's origin and turn in its parent's coordinates
export const tfIdentity = () => ({ p: [0, 0, 0], q: [0, 0, 0, 1] });
export const tfClone = (t) => ({ p: [t.p[0], t.p[1], t.p[2]], q: [t.q[0], t.q[1], t.q[2], t.q[3]] });
/** A point in the frame -> the parent's coordinates. */
export const tfPoint = (t, v) => vadd(t.p, qrot(t.q, v));
/** A point in the parent's coordinates -> the frame's. */
export const tfInvPoint = (t, v) => qirot(t.q, vsub(v, t.p));
/** A direction (no origin) both ways. */
export const tfDir = (t, v) => qrot(t.q, v);
export const tfInvDir = (t, v) => qirot(t.q, v);
/** a then b: b's frame sits in a's, so the result maps b-local to a's parent. */
export const tfCompose = (a, b) => ({ p: tfPoint(a, b.p), q: qnorm(qmul(a.q, b.q)) });
export const tfInverse = (t) => { const qi = qconj(t.q); return { p: vscale(qrot(qi, t.p), -1), q: qi }; };

/**
 * Where a point rigidly attached to a moving frame is moving, in the parent's coordinates: v + w x r, with `r` the point relative to the
 * frame's centre of rotation `c` (parent coordinates).
 */
export function pointVelocity(vel, ang, c, point) {
  return vadd(vel, vcross(ang, vsub(point, c)));
}

/** Advance a transform by linear velocity `v` and angular velocity `w` (both parent-frame) over dt. */
export function tfIntegrate(t, v, w, dt) {
  const ang = vlen(w) * dt;
  const q = ang > 1e-9 ? qnorm(qmul(qFromAxisAngle(w, ang), t.q)) : t.q;
  return { p: vadd(t.p, vscale(v, dt)), q };
}
