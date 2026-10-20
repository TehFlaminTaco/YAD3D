import { PLAYER_R, DRIFT_MAX, WIND_PUSH, KIND, TILE } from './config.js';

export const WALK_SPEED = 3.4;
export const RUN_SPEED = 5.6;

/**
 * Where this body stands on gravity (SS13 has_gravity + Process_Spacemove): `floating` = no gravity under it (magboots only help on a real
 * floor), `held` = it can steer anyway (gravity, a jetpack, or something within reach to push off), `adrift` = floating with nothing to hold.
 */
export function floatState(world, st, ctx = {}) {
  const floating = !ctx.noclip && !world.hasGravity(st.x, st.z)
    && !(ctx.mag && world.kindAt(Math.floor(st.x / TILE), Math.floor(st.z / TILE)) === KIND.FLOOR);
  const held = !floating || !!ctx.jet || world.hasGrip(st.x, st.z, ctx.ignore);
  return { floating, held, adrift: floating && !held };
}

/**
 * One movement step, shared by the server (authoritative) and the client (prediction).
 * st: {x, z, vx, vz}   inp: {f, b, l, r, run, yaw}
 * ctx: {slow, wind:[x,z]|null, noclip, ignore: a box to walk through (the thing you are dragging),
 *       jet: a jetpack is on, mag: magboots are on, limp: out cold, dead or held (no steering; in zero gravity you keep drifting)}
 *
 * Gravity follows SS13's Process_Spacemove: with gravity you walk. Without it you can only steer while you have something to hold
 * (a wall, a locker, a window frame, lattice) or a jetpack; otherwise you coast at the speed you had until you bump into
 * something or get hold of it.
 */
export function stepMovement(st, inp, world, dt, ctx = {}) {
  const limp = !!ctx.limp;
  const fz = limp ? 0 : (inp.f ? 1 : 0) - (inp.b ? 1 : 0);
  const fx = limp ? 0 : (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
  const speed = (inp.run ? RUN_SPEED : WALK_SPEED) * (ctx.slow ?? 1) * (ctx.noclip ? 1.8 : 1);
  const sy = Math.sin(inp.yaw), cy = Math.cos(inp.yaw);
  // forward = (-sin, -cos); right = (cos, -sin)
  let wx = -sy * fz + cy * fx;
  let wz = -cy * fz - sy * fx;
  const len = Math.hypot(wx, wz);
  if (len > 1) { wx /= len; wz /= len; }

  const { floating, adrift } = floatState(world, st, ctx);

  if (!adrift) {
    const k = Math.min(1, 14 * dt);
    st.vx += (wx * speed - st.vx) * k;
    st.vz += (wz * speed - st.vz) * k;
  } else if (ctx.wind) {
    st.vx += ctx.wind[0] * WIND_PUSH * dt; st.vz += ctx.wind[1] * WIND_PUSH * dt;     // blown out of the airlock: you keep going
  }
  let mx = st.vx * dt, mz = st.vz * dt;
  if (ctx.wind && !adrift) { mx += ctx.wind[0] * dt; mz += ctx.wind[1] * dt; }
  if (adrift) {
    const v = Math.hypot(st.vx, st.vz);
    if (v > DRIFT_MAX) { st.vx *= DRIFT_MAX / v; st.vz *= DRIFT_MAX / v; mx = st.vx * dt; mz = st.vz * dt; }
  }
  if (ctx.noclip) { st.x += mx; st.z += mz; } else {
    const ox = st.x, oz = st.z;
    world.move(st, mx, mz, PLAYER_R, ctx.ignore);
    if (floating) {                                                 // a bump stops you dead along that axis
      if (mx && st.x === ox) st.vx = 0;
      if (mz && st.z === oz) st.vz = 0;
    }
  }
  return floating ? 0 : Math.hypot(st.vx, st.vz);       // a floating body does not walk (no steps, no walking animation)
}
