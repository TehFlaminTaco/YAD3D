import { TILE, KIND, PLAYER_R, LEAVE_CAP, ENTER_MAX } from './config.js';
import { qToYaw, pointVelocity, tfInvDir } from './math3.js';

/**
 * Which grid a body belongs to. A body's position is in the frame of the grid it is on; it belongs to that grid while its middle is over one of
 * its tiles. When it walks (through a door, say) to where a neighbouring grid's tiles are, it moves to that grid: its position, velocity and
 * facing are put into the new grid's frame, so that in the map it has not moved at all.
 *
 * A body that is on no grid is in its map's void (`map.void`, a grid of no tiles whose frame is the map's own coordinates). Leaving a grid for the void
 * (a player walks off the side of a moving shuttle, or past the edge of the station) carries the grid's speed with it, `v_grid + w x r` at the
 * place it left from, so it drifts on at the speed it had, as anything does in space; arriving on a grid takes the grid's speed away again. Only a
 * `free` body (a player's) may leave: the edge of a grid is a wall to everyone else.
 *
 * `st` is { x, z, vx, vz, yaw? } in `grid`'s frame, and is rewritten in place. Returns null when nothing changed, else { grid, dyaw, impact }: the grid it is on
 * now, how much its facing turned (add `dyaw` to anything else the caller keeps in the old frame, like a camera), and how hard it hit a grid it arrived on
 * too fast (m/s over `ENTER_MAX`, else 0).
 *
 * Shared by the server (authoritative) and the client (prediction), so the two agree on the instant a body changes grid.
 */
export function settle(grid, st, free = false) {
  const w = grid.world;
  if (w.isVoid) return arrive(grid, st);
  const c = Math.floor(st.x / TILE), r = Math.floor(st.z / TILE);
  const inb = w.inb(c, r);
  if (inb && w.kind[w.idx(c, r)] !== KIND.SPACE) return null;                           // still over this grid's own floor or walls
  for (const nb of w.neighbors) {                                                       // a docked grid against this one: through the door
    const [x0, z0, x1, z1] = nb.rect;
    if (st.x < x0 || st.x > x1 || st.z < z0 || st.z > z1) continue;
    const x = nb.a * st.x + nb.b * st.z + nb.tx, z = nb.c * st.x + nb.d * st.z + nb.tz;
    const nw = nb.world, cc = Math.floor(x / TILE), rr = Math.floor(z / TILE);
    if (!nw.inb(cc, rr) || nw.kind[nw.idx(cc, rr)] === KIND.SPACE) continue;
    const vx = nb.a * st.vx + nb.b * st.vz, vz = nb.c * st.vx + nb.d * st.vz;            // the linear part only: a velocity has no origin
    st.x = x; st.z = z; st.vx = vx; st.vz = vz;
    if (st.yaw !== undefined) st.yaw += nb.dyaw;
    return { grid: nb.grid, dyaw: nb.dyaw, impact: 0 };
  }
  // over open space: a grid that is held in place has it as part of its own frame (it cannot go anywhere), one that is flying does not; off the edge of the array is nobody's
  if (free && (!inb || !grid.docked)) return depart(grid, st);
  return null;
}

/** Off a grid into the void. */
function depart(grid, st) {
  const v = grid.map?.void;
  if (!v) return null;
  const p = grid.worldPoint(st.x, 0, st.z);
  const lv = grid.worldDir([st.vx, 0, st.vz]);
  const pv = pointVelocity(grid.vel, grid.ang, grid.tf.p, p);
  let vx = lv[0] + pv[0], vz = lv[2] + pv[2];
  const s = Math.hypot(vx, vz);
  if (s > LEAVE_CAP) { vx *= LEAVE_CAP / s; vz *= LEAVE_CAP / s; }
  const dyaw = qToYaw(grid.tf.q) - qToYaw(v.tf.q);
  st.x = p[0]; st.z = p[2]; st.vx = vx; st.vz = vz;
  if (st.yaw !== undefined) st.yaw += dyaw;
  return { grid: v, dyaw, impact: 0 };
}

/** A body in the void: onto a grid if it is over its floor (or, for one that is held in place, anywhere in its array), else free of anything that has moved into it. */
function arrive(vg, st) {
  const w = vg.world;
  let pick = null, spare = null;
  for (const nb of w.neighbors) {
    const [x0, z0, x1, z1] = nb.rect;
    if (st.x < x0 || st.x > x1 || st.z < z0 || st.z > z1) continue;
    const x = nb.a * st.x + nb.b * st.z + nb.tx, z = nb.c * st.x + nb.d * st.z + nb.tz;
    const nw = nb.world, cc = Math.floor(x / TILE), rr = Math.floor(z / TILE);
    if (!nw.inb(cc, rr)) continue;
    const i = nw.idx(cc, rr);
    if (nw.kind[i] !== KIND.SPACE) { if (!nw.solid[i]) { pick = nb; break; } continue; }           // (a wall is not something to arrive on: see unstick)
    if (!spare && nb.grid.docked) spare = nb;
  }
  const nb = pick || spare;
  if (!nb) { unstick(w, st); return null; }
  const G = nb.grid, p = [st.x, 0, st.z];
  const pv = pointVelocity(G.vel, G.ang, G.tf.p, p);
  const rel = tfInvDir(G.tf, [st.vx - pv[0], 0, st.vz - pv[2]]);                           // what it is doing as seen from the grid
  let impact = 0;
  const s = Math.hypot(rel[0], rel[2]);
  if (pick && s > ENTER_MAX) { impact = s - ENTER_MAX; rel[0] *= ENTER_MAX / s; rel[2] *= ENTER_MAX / s; }
  st.x = nb.a * st.x + nb.b * st.z + nb.tx; st.z = nb.c * p[0] + nb.d * p[2] + nb.tz;
  st.vx = rel[0]; st.vz = rel[2];
  if (st.yaw !== undefined) st.yaw += nb.dyaw;
  return { grid: G, dyaw: nb.dyaw, impact };
}

/** A grid that moves can end up on top of a body floating in the void: it is put in the nearest clear spot (it keeps its speed). Nothing to do if it is clear. */
function unstick(w, st) {
  if (!w.collides(st.x, st.z, PLAYER_R)) return;
  for (let d = 0.25; d <= 4; d += 0.25) {
    for (let k = 0; k < 16; k++) {
      const a = k * Math.PI / 8, x = st.x + Math.cos(a) * d, z = st.z + Math.sin(a) * d;
      if (w.collides(x, z, PLAYER_R)) continue;
      st.x = x; st.z = z;
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

/** How much to add to a facing given in `from`'s frame to have it in `to`'s (grids turn about the vertical axis only, for now). */
export function frameYaw(from, to) {
  return qToYaw(from.tf.q) - qToYaw(to.tf.q);
}
