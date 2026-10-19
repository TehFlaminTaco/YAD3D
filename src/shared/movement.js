import { PLAYER_R } from './config.js';

export const WALK_SPEED = 3.4;
export const RUN_SPEED = 5.6;

/**
 * One movement step, shared by the server (authoritative) and the client (prediction).
 * st: {x, z, vx, vz}   inp: {f, b, l, r, run, yaw}   ctx: {slow, wind:[x,z]|null, noclip, ignore: a box to walk through (the thing you are dragging)}
 */
export function stepMovement(st, inp, world, dt, ctx = {}) {
  const fz = (inp.f ? 1 : 0) - (inp.b ? 1 : 0);
  const fx = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
  const speed = (inp.run ? RUN_SPEED : WALK_SPEED) * (ctx.slow ?? 1) * (ctx.noclip ? 1.8 : 1);
  const sy = Math.sin(inp.yaw), cy = Math.cos(inp.yaw);
  // forward = (-sin, -cos); right = (cos, -sin)
  let wx = -sy * fz + cy * fx;
  let wz = -cy * fz - sy * fx;
  const len = Math.hypot(wx, wz);
  if (len > 1) { wx /= len; wz /= len; }
  const k = Math.min(1, 14 * dt);
  st.vx += (wx * speed - st.vx) * k;
  st.vz += (wz * speed - st.vz) * k;
  let mx = st.vx * dt, mz = st.vz * dt;
  if (ctx.wind) { mx += ctx.wind[0] * dt; mz += ctx.wind[1] * dt; }
  if (ctx.noclip) { st.x += mx; st.z += mz; } else world.move(st, mx, mz, PLAYER_R, ctx.ignore);
  return Math.hypot(st.vx, st.vz);
}
