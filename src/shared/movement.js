import { PLAYER_R, DRIFT_MAX, WIND_PUSH, KIND, TILE, VOID_R, DV } from './config.js';
import { qrot, lookDir, vlen, vscale } from './math3.js';

export const WALK_SPEED = 3.4;
export const RUN_SPEED = 5.6;

/**
 * Where this body stands on gravity (SS13 has_gravity + Process_Spacemove): `floating` = no gravity under it (magboots only help on a real
 * floor), `held` = it can steer anyway (gravity, a jetpack, or something within reach to push off), `adrift` = floating with nothing to hold.
 */
export function floatState(world, st, ctx = {}) {
  const l = st.l | 0;                                                  // the deck you are on (0 on a grid of one deck)
  const floating = !ctx.noclip && !world.hasGravity(st.x, st.z, l)
    && !(ctx.mag && world.kindAt(Math.floor(st.x / TILE), Math.floor(st.z / TILE), l) === KIND.FLOOR);
  const held = !floating || !!ctx.jet || world.hasGrip(st.x, st.z, ctx.ignore, ctx.free, st.y, l);
  return { floating, held, adrift: floating && !held };
}

/** Is tile (c, r) of deck l something to stand on, and clear (a floor or a grating that nothing solid is on)? */
function standable(world, c, r, l) {
  if (!world.inb(c, r, l)) return false;
  const i = world.idx(c, r, l);
  const k = world.kind[i];
  return (k === KIND.FLOOR || k === KIND.LATTICE) && !world.solid[i];
}

/**
 * Stairs (TG's /obj/structure/stairs): leaving a stair tile in the direction it climbs takes you to the deck above, onto the tile in front of it, if that is a place to
 * stand. `mx, mz` is the step you are about to take. Returns true when it took you up (and moved you: the step is done).
 */
function stairStep(world, st, mx, mz) {
  const l = st.l | 0;
  if (l + 1 >= world.levels) return false;
  const c = Math.floor(st.x / TILE), r = Math.floor(st.z / TILE);
  if (!world.inb(c, r, l)) return false;
  const d = world.stairs[world.idx(c, r, l)];
  if (!d) return false;
  const [dc, dr] = DV[d];
  const nx = st.x + mx, nz = st.z + mz;
  if (Math.floor(nx / TILE) !== c + dc || Math.floor(nz / TILE) !== r + dr) return false;       // not leaving it the way it climbs
  if (!standable(world, c + dc, r + dr, l + 1) || world.collidesTiles(nx, nz, PLAYER_R, null, true, l + 1)) return false;
  st.x = nx; st.z = nz; st.l = l + 1;
  return true;
}

/**
 * Falling: over an open tile on a deck above the first (a hole: the air down to the deck below) you drop, as far as the air goes (zFall: `turf.dm`). `st.fell` is how
 * many decks, for the one who handles the landing (the server: damage; `0` the rest of the time), and `st.landed` is what they came down on (`stairs`: a stair tile
 * takes the fall, `stairs.dm intercept_zImpact`, so walking down them is not a fall to be hurt by). The server and the client's prediction do the same.
 */
function fallStep(world, st) {
  st.fell = 0; st.landed = null;
  const l = st.l | 0;
  if (l <= 0) return;
  const c = Math.floor(st.x / TILE), r = Math.floor(st.z / TILE);
  if (!world.inb(c, r, l) || world.kind[world.idx(c, r, l)] !== KIND.SPACE) return;
  let to = l - 1;
  while (to > 0 && world.kind[world.idx(c, r, to)] === KIND.SPACE) to--;
  st.fell = l - to;
  st.landed = world.stairs[world.idx(c, r, to)] ? 'stairs' : 'floor';
  st.l = to;
}

/**
 * One step of walking on the deck: up a stair if that is where it goes, else slide along the walls, then fall if the deck has a hole under where it ends up. Players
 * (`stepMovement`) and the NPCs that walk (`ai.js`) both do this. Returns true if something was in the way.
 */
export function walkStep(world, st, mx, mz, h, ignore = null, free = false, stairs = true) {
  const multi = world.levels > 1;
  if (multi && stairs && stairStep(world, st, mx, mz)) { fallStep(world, st); return false; }
  const blocked = world.move(st, mx, mz, h, ignore, free);
  if (multi) fallStep(world, st);
  return blocked;
}

/**
 * One movement step, shared by the server (authoritative) and the client (prediction).
 * st: {x, z, vx, vz}   inp: {f, b, l, r, run, yaw}
 * ctx: {slow, wind:[x,z]|null, noclip, ignore: a box to walk through (the thing you are dragging),
 *       jet: a jetpack is on, mag: magboots are on, limp: out cold, dead or held (no steering; in zero gravity you keep drifting),
 *       free: the edge of the grid is no wall (a player may float off it, see frames.js settle)}
 *
 * Gravity follows SS13's Process_Spacemove: with gravity you walk. Without it you can only steer while you have something to hold
 * (a wall, a locker, a window frame, lattice) or a jetpack; otherwise you coast at the speed you had until you bump into
 * something or get hold of it.
 */
export function stepMovement(st, inp, world, dt, ctx = {}) {
  if (ctx.ghost) return stepGhost(st, inp, dt);
  if (world?.isVoid && !ctx.noclip) return stepVoid(st, inp, world, dt, ctx);
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
  if (adrift && ctx.wind) {                                           // escaping air can only blow you so fast; with none, nothing slows you: you keep the speed you left a grid at (frames.js)
    const v = Math.hypot(st.vx, st.vz);
    if (v > DRIFT_MAX) { st.vx *= DRIFT_MAX / v; st.vz *= DRIFT_MAX / v; mx = st.vx * dt; mz = st.vz * dt; }
  }
  if (ctx.noclip) { st.x += mx; st.z += mz; } else {
    const ox = st.x, oz = st.z;
    walkStep(world, st, mx, mz, PLAYER_R, ctx.ignore, ctx.free, !floating);
    if (floating) {                                                 // a bump stops you dead along that axis
      if (mx && st.x === ox) st.vx = 0;
      if (mz && st.z === oz) st.vz = 0;
    }
  }
  return floating ? 0 : Math.hypot(st.vx, st.vz);       // a floating body does not walk (no steps, no walking animation)
}

/**
 * Floating in the void, in three dimensions: there is no gravity and no up to the map, so a body steers along where it looks (turned by `st.q`, the way up it has
 * kept from the grid it left) when it can push off something: a jetpack, or a grid within reach. Then it goes where it is steered, relative to what it holds
 * (the hull of a moving shuttle takes you along with it); otherwise it coasts at whatever speed it has. A bump stops you dead on that axis.
 * st: {x, y, z, vx, vy, vz, q}, y the height of the body's middle (see `CENTER_H`). Same inputs and context as `stepMovement`.
 */
export function stepVoid(st, inp, world, dt, ctx = {}) {
  const limp = !!ctx.limp;
  const fz = limp ? 0 : (inp.f ? 1 : 0) - (inp.b ? 1 : 0);
  const fx = limp ? 0 : (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
  const speed = (inp.run ? RUN_SPEED : WALK_SPEED) * (ctx.slow ?? 1);
  const q = st.q || [0, 0, 0, 1];
  const fwd = qrot(q, lookDir(inp.yaw, inp.pitch || 0)), right = qrot(q, [Math.cos(inp.yaw), 0, -Math.sin(inp.yaw)]);
  let w = [fwd[0] * fz + right[0] * fx, fwd[1] * fz + right[1] * fx, fwd[2] * fz + right[2] * fx];
  const len = vlen(w);
  if (len > 1) w = vscale(w, 1 / len);
  st.y = st.y ?? 0; st.vy = st.vy ?? 0;
  const hv = world.holdVelocity(st.x, st.z, ctx.ignore, st.y);
  if (hv || ctx.jet) {
    const k = Math.min(1, 14 * dt), base = hv || [0, 0, 0];
    st.vx += (w[0] * speed + base[0] - st.vx) * k;
    st.vy += (w[1] * speed + base[1] - st.vy) * k;
    st.vz += (w[2] * speed + base[2] - st.vz) * k;
  }
  const mx = st.vx * dt, my = st.vy * dt, mz = st.vz * dt;
  if (!world.collides3(st.x + mx, st.y, st.z, VOID_R, ctx.ignore)) st.x += mx; else st.vx = 0;
  if (!world.collides3(st.x, st.y + my, st.z, VOID_R, ctx.ignore)) st.y += my; else st.vy = 0;
  if (!world.collides3(st.x, st.y, st.z + mz, VOID_R, ctx.ignore)) st.z += mz; else st.vz = 0;
  return 0;                                                          // a floating body does not walk
}

/** A ghost flies where it looks, through everything, in three dimensions (st: {x, y, z}; y the height of its feet-plane, as for anyone, its eyes are a little above). */
export function stepGhost(st, inp, dt) {
  const fz = (inp.f ? 1 : 0) - (inp.b ? 1 : 0), fx = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
  const speed = (inp.run ? RUN_SPEED : WALK_SPEED) * 1.8;
  const fwd = lookDir(inp.yaw, inp.pitch || 0), right = [Math.cos(inp.yaw), 0, -Math.sin(inp.yaw)];
  let w = [fwd[0] * fz + right[0] * fx, fwd[1] * fz + right[1] * fx, fwd[2] * fz + right[2] * fx];
  const len = vlen(w);
  if (len > 1) w = vscale(w, 1 / len);
  st.x += w[0] * speed * dt; st.y = (st.y ?? 0) + w[1] * speed * dt; st.z += w[2] * speed * dt;
  st.vx = st.vz = st.vy = 0;
  return 0;
}
