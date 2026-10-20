import { TILE, KIND } from './config.js';
import { qToYaw } from './math3.js';

/**
 * Which grid a body belongs to. A body's position is in the frame of the grid it is on; it belongs to that grid while its middle is over one of
 * its tiles. When it walks (through a door, say) to where a neighbouring grid's tiles are, it moves to that grid: its position, velocity and
 * facing are put into the new grid's frame, so that in the map it has not moved at all.
 *
 * `st` is { x, z, vx, vz, yaw? } in `grid`'s frame, and is rewritten in place. Returns null when nothing changed, else { grid, dyaw }: the grid it is on
 * now and how much its facing turned (add `dyaw` to anything else the caller keeps in the old frame, like a camera).
 *
 * Shared by the server (authoritative) and the client (prediction), so the two agree on the instant a body changes grid.
 */
export function settle(grid, st) {
  const w = grid.world;
  const c = Math.floor(st.x / TILE), r = Math.floor(st.z / TILE);
  if (w.inb(c, r) && w.kind[w.idx(c, r)] !== KIND.SPACE) return null;                   // still over this grid's own floor or walls
  for (const nb of w.neighbors) {
    const [x0, z0, x1, z1] = nb.rect;
    if (st.x < x0 || st.x > x1 || st.z < z0 || st.z > z1) continue;
    const x = nb.a * st.x + nb.b * st.z + nb.tx, z = nb.c * st.x + nb.d * st.z + nb.tz;
    const nw = nb.world, cc = Math.floor(x / TILE), rr = Math.floor(z / TILE);
    if (!nw.inb(cc, rr) || nw.kind[nw.idx(cc, rr)] === KIND.SPACE) continue;
    const vx = nb.a * st.vx + nb.b * st.vz, vz = nb.c * st.vx + nb.d * st.vz;            // the linear part only: a velocity has no origin
    st.x = x; st.z = z; st.vx = vx; st.vz = vz;
    if (st.yaw !== undefined) st.yaw += nb.dyaw;
    return { grid: nb.grid, dyaw: nb.dyaw };
  }
  return null;
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
