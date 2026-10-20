import { TILE, KIND, LEAVE_CAP, ENTER_MAX, CENTER_H, VOID_R, WALL_H, DECK_H } from './config.js';
import { qTwistY, qTilt, pointVelocity, tfInvDir, tfPoint, tfInvPoint, tfDir, tfIdentity, reorient } from './math3.js';

/** A place to put a facing and a point in, that is not a grid: just a pose in the map (the scene is drawn in one when you float free, turned the way you are). Same calls as a `Grid` has. */
export class Frame {
  constructor(tf = tfIdentity()) { this.tf = tf; }
  worldPoint(x, y, z) { return tfPoint(this.tf, [x, y, z]); }
  localPoint(p) { return tfInvPoint(this.tf, p); }
  worldDir(d) { return tfDir(this.tf, d); }
}

/**
 * Which grid a body belongs to. A body's position is in the frame of the grid it is on; it belongs to that grid while its middle is over one of
 * its tiles. When it walks (through a door, say) to where a neighbouring grid's tiles are, it moves to that grid: its position, velocity and
 * facing are put into the new grid's frame, so that in the map it has not moved at all.
 *
 * A body that is on no grid is in its map's void (`map.void`, a grid of no tiles whose frame is the map's own coordinates, in three dimensions: `st.y` is the
 * height of its middle, `st.vy`, and `st.q` the turn it keeps from the grid it left, so that its up is still that grid's up). Leaving a grid for the void (a
 * player walks off the side of a moving shuttle, or past the edge of the station) carries the grid's speed with it, `v_grid + w x r` at the place it left from,
 * so it drifts on at the speed it had, as anything does in space; arriving on a grid takes the grid's speed away again. Only a `free` body (a player's) may
 * leave: the edge of a grid is a wall to everyone else.
 *
 * `st` is { x, z, vx, vz, yaw?, pitch?, y?, vy?, q? } in `grid`'s frame, and is rewritten in place (the facing turns with the frame: you still look the same way in
 * the map). Returns null when nothing changed, else { grid, qFrom, qTo, dyaw, impact }: the grid it is on now, the turns of the frame it was in and the frame it
 * is in (to put a facing someone else keeps across: `reorient(qFrom, qTo, yaw, pitch)`), how much a level facing turned (`dyaw`), how hard it hit a grid it
 * arrived on too fast (m/s over `ENTER_MAX`, else 0), and, arriving, how far above standing height it was (`lift`).
 *
 * Shared by the server (authoritative) and the client (prediction), so the two agree on the instant a body changes grid.
 */
export function settle(grid, st, free = false) {
  const w = grid.world;
  if (w.isVoid) return arrive(grid, st);
  const c = Math.floor(st.x / TILE), r = Math.floor(st.z / TILE), l = st.l | 0;
  const inb = w.inb(c, r, l);
  if (inb && w.kind[w.idx(c, r, l)] !== KIND.SPACE) return null;                        // still over this grid's own floor or walls
  if (inb && l > 0) return null;                                                        // an open tile above the first deck is a hole in the floor (you fall through it), not the edge of the grid
  for (const nb of w.neighbors) {                                                       // a docked grid against this one: through the door
    if (l > 0) break;
    const [x0, z0, x1, z1] = nb.rect;
    if (st.x < x0 || st.x > x1 || st.z < z0 || st.z > z1) continue;
    const x = nb.a * st.x + nb.b * st.z + nb.tx, z = nb.c * st.x + nb.d * st.z + nb.tz;
    const nw = nb.world, cc = Math.floor(x / TILE), rr = Math.floor(z / TILE);
    if (!nw.inb(cc, rr) || nw.kind[nw.idx(cc, rr)] === KIND.SPACE) continue;
    const vx = nb.a * st.vx + nb.b * st.vz, vz = nb.c * st.vx + nb.d * st.vz;            // the linear part only: a velocity has no origin
    st.x = x; st.z = z; st.vx = vx; st.vz = vz;
    if (st.yaw !== undefined) st.yaw += nb.dyaw;
    return { grid: nb.grid, qFrom: grid.tf.q, qTo: nb.grid.tf.q, dyaw: nb.dyaw, impact: 0 };
  }
  // over open space: a grid that is held in place has it as part of its own frame (it cannot go anywhere), one that is flying does not; off the edge of the array is nobody's
  if (free && (!inb || !grid.docked)) return depart(grid, st);
  return null;
}

/** The facing in `st` (if it has one), said in a frame turned by `qTo` instead of `qFrom`. */
function turnFacing(st, qFrom, qTo) {
  if (st.yaw === undefined) return;
  const f = reorient(qFrom, qTo, st.yaw, st.pitch || 0);
  st.yaw = f.yaw;
  if (st.pitch !== undefined) st.pitch = f.pitch;
}

/** Off a grid into the void. */
function depart(grid, st) {
  const v = grid.map?.void;
  if (!v) return null;
  const p = grid.worldPoint(st.x, (st.y || 0) + (st.l | 0) * DECK_H + CENTER_H, st.z);    // a body floating is placed by its middle (and a body on an upper deck is that much higher)
  const lv = grid.worldDir([st.vx, 0, st.vz]);
  const pv = pointVelocity(grid.vel, grid.ang, grid.tf.p, p);
  let vx = lv[0] + pv[0], vy = lv[1] + pv[1], vz = lv[2] + pv[2];
  const s = Math.hypot(vx, vy, vz);
  if (s > LEAVE_CAP) { vx *= LEAVE_CAP / s; vy *= LEAVE_CAP / s; vz *= LEAVE_CAP / s; }
  const qFrom = grid.tf.q, qTo = qTilt(qFrom);
  turnFacing(st, qFrom, qTo);
  st.x = p[0]; st.y = p[1]; st.z = p[2]; st.vx = vx; st.vy = vy; st.vz = vz; st.q = qTo; st.l = 0;
  return { grid: v, qFrom, qTo, dyaw: qTwistY(qFrom), impact: 0 };
}

/**
 * A body in the void: onto a grid if it is over its floor, within the height of its rooms (or, for one that is held in place, anywhere in its array that is
 * about the height of a person); else clear of anything that has moved onto it.
 */
function arrive(vg, st) {
  const w = vg.world;
  st.y = st.y ?? 0; st.vy = st.vy ?? 0;
  let pick = null, spare = null, at = null;
  for (const nb of w.neighbors) {
    if (!w.near(nb, st.x, st.y, st.z, VOID_R)) continue;
    const G = nb.grid, P = G.localPoint([st.x, st.y, st.z]), nw = nb.world;
    const dl = Math.max(0, Math.min(nw.levels - 1, Math.floor(P[1] / DECK_H)));            // which of its decks (if it has more than one) the middle is level with
    const L = [P[0], P[1] - dl * DECK_H, P[2], dl];                                         // [x, height above that deck's floor, z, deck]
    const cc = Math.floor(L[0] / TILE), rr = Math.floor(L[2] / TILE);
    if (!nw.inb(cc, rr, dl)) continue;
    const i = nw.idx(cc, rr, dl);
    if (nw.kind[i] !== KIND.SPACE) {
      if (nw.solid[i] || L[1] < VOID_R || L[1] > WALL_H - VOID_R || nw.collidesTiles(L[0], L[2], VOID_R, null, false, dl)) continue;           // (a wall, or not within the height of its rooms: see unstick)
      pick = nb; at = L;
      break;
    }
    if (!spare && G.docked && !G.tilted && dl === 0 && Math.abs(L[1] - CENTER_H) < 0.6) { spare = nb; at = L; }
  }
  const nb = pick || spare;
  if (!nb) { unstick(w, st); return null; }
  const G = nb.grid, L = at, p = [st.x, st.y, st.z];
  const pv = pointVelocity(G.vel, G.ang, G.tf.p, p);
  const rel = tfInvDir(G.tf, [st.vx - pv[0], st.vy - pv[1], st.vz - pv[2]]);              // what it is doing as seen from the grid
  let impact = 0;
  const s = Math.hypot(rel[0], rel[1], rel[2]);
  if (pick && s > ENTER_MAX) { impact = s - ENTER_MAX; rel[0] *= ENTER_MAX / s; rel[2] *= ENTER_MAX / s; }
  const qFrom = st.q || [0, 0, 0, 1], qTo = G.tf.q;
  turnFacing(st, qFrom, qTo);
  st.x = L[0]; st.z = L[2]; st.y = 0; st.l = L[3]; st.vx = rel[0]; st.vz = rel[2]; st.vy = 0; st.q = [0, 0, 0, 1];                   // on the deck, feet down
  return { grid: G, qFrom, qTo, dyaw: -qTwistY(qTo), impact, lift: L[1] - CENTER_H };            // (`lift`: how far above where a person's middle is when standing, the middle was: you are put on the floor)
}

const AWAY = (() => {            // the directions to try to get clear in: along the axes, the diagonals of the faces and the corners
  const out = [];
  for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) if (x || y || z) { const l = Math.hypot(x, y, z); out.push([x / l, y / l, z / l]); }
  return out;
})();

/** A grid that moves can end up on top of a body floating in the void: it is put in the nearest clear spot (it keeps its speed). Nothing to do if it is clear. */
function unstick(w, st) {
  if (!w.collides3(st.x, st.y, st.z, VOID_R)) return;
  for (let d = 0.25; d <= 4; d += 0.25) {
    for (const a of AWAY) {
      const x = st.x + a[0] * d, y = st.y + a[1] * d, z = st.z + a[2] * d;
      if (w.collides3(x, y, z, VOID_R)) continue;
      st.x = x; st.y = y; st.z = z;
      return;
    }
  }
}

/** Where a point of `from`'s frame is in `to`'s frame (both in one map), as [x, z]. */
export function between(from, to, x, z) {
  const p = to.localPoint(from.worldPoint(x, 0, z));
  return [p[0], p[2]];
}

/** The same with a height: [x, y, z] of `from`'s frame in `to`'s. */
export function pointTo(from, to, x, y, z) {
  return to.localPoint(from.worldPoint(x, y, z));
}

/**
 * How much to add to a facing given in `from`'s frame to have it in `to`'s, when both are level (the grids turn about the vertical only): the difference of
 * their headings. For frames that are not level a facing has to be turned as a direction (`reorient`).
 */
export function frameYaw(from, to) {
  return qTwistY(from.tf.q) - qTwistY(to.tf.q);
}

/** A facing (yaw, pitch) made in frame `from`, in frame `to`: what you look along does not change (see `reorient`). */
export function facingTo(from, to, yaw, pitch = 0) {
  return reorient(from.tf.q, to.tf.q, yaw, pitch);
}

