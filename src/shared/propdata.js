import { TILE, WALL_H, PX, DIR_YAW, DV, OPP, DECK_H } from './config.js';
import { hash2, hexToRgb, rng } from './util.js';
import { CL, closetSprite, setClosetState } from './closets.js';

const WM_Y = {
  apc: 1.45, airalarm: 1.7, firealarm: 1.55, light_switch: 1.3, intercom: 1.65, extinguisher_cabinet: 1.3,
  camera: 2.2, button: 1.35, newscaster: 1.6, status_display: 2.05, ai_status_display: 2.05, requests_console: 1.4,
  sign: 1.85, noticeboard: 1.5, mirror: 1.5, vending: 1.4, sink: 1.0, shower: 1.9, keycard_auth: 1.4, misc: 1.5,
};
export const TABLE_H = 0.92;

/**
 * How big the box is that blocks you for a free-standing thing of this visible width (half-width, metres): a locker is not
 * two metres wide, so you can stand right beside one. Never the whole tile (a tank is nearly that wide, so 0.95).
 */
export function blockHalf(widthM) {
  return Math.round(Math.min(0.95, Math.max(0.45, widthM / 2 + 0.1)) * 20) / 20;
}
/**
 * Which way a door or firelock stands: yaw 0 means its plane runs along x (a door in an east-west wall), PI / 2 along z. The plane's two ends
 * meet walls (best) or other doors in the same line, and people pass through the two sides, which are open floor. A lone firelock in a corridor
 * has no wall beside it, so the open floor on both sides decides; an unclear one looks two tiles out before it gives up.
 */
export function doorYaw(world, c, r, doorTiles, l = 0) {
  const wall = (cc, rr) => world.isWallLike(cc, rr, l);
  const door = (cc, rr) => world.inb(cc, rr, l) && doorTiles.has(world.idx(cc, rr, l));
  const open = (cc, rr) => world.inb(cc, rr, l) && !wall(cc, rr) && !door(cc, rr);
  const ends = (a, b) => 3 * (wall(a[0], a[1]) + wall(b[0], b[1])) + (door(a[0], a[1]) + door(b[0], b[1]));
  const sides = (a, b) => open(a[0], a[1]) + open(b[0], b[1]);
  const sx = ends([c - 1, r], [c + 1, r]) + sides([c, r - 1], [c, r + 1]);          // plane along x
  const sz = ends([c, r - 1], [c, r + 1]) + sides([c - 1, r], [c + 1, r]);          // plane along z
  if (sx !== sz) return sx > sz ? 0 : Math.PI / 2;
  const fx = wall(c - 2, r) + wall(c + 2, r), fz = wall(c, r - 2) + wall(c, r + 2);
  return fz > fx ? Math.PI / 2 : 0;
}

export const ITEM_SCALE = 0.5;               // SS13 item icons are drawn big for a top-down view; shrink them for first person

/**
 * Derive every prop-related list from the level's prop records. Pure data (no rendering): the server
 * uses it for simulation, the client for building sprites. Also sets collision flags on the world.
 * Call with `prev` to append to an existing set. Order is deterministic, so indexes agree on both sides.
 */
export function buildPropData(world, rects, props, level, prev = null) {
  const grid = world.grid;                  // stamped on the records the sim looks things up by (doors, firelocks, props): they know where they stand
  const out = prev || {
    tables: [], panes: [], lights: [], items: [], interact: [], doors: [], fdoors: [], statics: [], closets: [], girders: [], machines: [],
    paneIdx: new Map(), pool: level.pool.filter((q) => q.s >= 0), lootRng: rng(1337), wmSpots: new Map(),
  };
  out.added = { tables: [], panes: [], lights: [], doors: [], statics: [], items: [], interact: [], fdoors: [], closets: [], girders: [], machines: [] };
  const center = (c, r) => [c * TILE + TILE / 2, r * TILE + TILE / 2];

  const addItem = (spriteId, name, c, r, extra = {}) => {
    const i = world.idx(c, r, extra.l | 0);
    const n = out.items.length;
    const h1 = hash2(c * 7 + n, r * 13 + 1), h2 = hash2(r * 5 + n, c * 11 + 3);
    const jx = ((h1 % 1000) / 1000 - 0.5) * (TILE - 0.9), jz = ((h2 % 1000) / 1000 - 0.5) * (TILE - 0.9);
    const [cx, cz] = center(c, r);
    const y = world.tableH[i] > 0 ? world.tableH[i] + 0.01 : 0.01;
    const it = { sprite: spriteId, name, c, r, x: cx + jx, y, z: cz + jz, ...extra, l: extra.l | 0 };
    out.items.push(it); out.added.items.push(it);
    return it;
  };

  const sprite = (o) => { const s = { ...o }; out.statics.push(s); out.added.statics.push(s); return s; };

  // pass 1: things that change world flags
  for (const p of props) {
    const l = p.l | 0;                                                   // the deck it is on
    if (p.k === 'table') {
      const i = world.idx(p.x, p.y, l);
      world.solid[i] = 1;
      world.tableH[i] = TABLE_H;
      const rc = rects[p.s].avg;
      const tb = { c: p.x, r: p.y, l, h: TABLE_H, rgb: [rc[0] / 255, rc[1] / 255, rc[2] / 255], s: p.s };
      out.tables.push(tb); out.added.tables.push(tb);
    } else if (p.k === 'fan') {
      // a fan seals its tile against air (CanAtmosPass = ATMOS_PASS_NO); the big one is also in the way
      world.airBlock[world.idx(p.x, p.y, l)] = 1;
      if (p.den) world.solid[world.idx(p.x, p.y, l)] = 1;
    } else if (p.k === 'pane') {
      world.addEdge(p.x, p.y, p.d, true, l);
      const pn = { c: p.x, r: p.y, l, d: p.d, tag: p.t, hp: 25, dead: false };
      out.panes.push(pn); out.added.panes.push(pn);
      out.paneIdx.set(world.idx(p.x, p.y, l) * 16 + p.d, pn);
      const [dc, dr] = DV[p.d];
      if (world.inb(p.x + dc, p.y + dr, l)) out.paneIdx.set(world.idx(p.x + dc, p.y + dr, l) * 16 + OPP[p.d], pn);
    }
  }

  const pool = out.pool;
  const lootRng = out.lootRng;
  for (const p of props) {
    const c = p.x, r = p.y, l = p.l | 0, yb = l * DECK_H, i = world.idx(c, r, l);     // `yb`: how far up its deck is in the grid's frame
    const [cx, cz] = center(c, r);
    switch (p.k) {
      case 'door': { const d = { ...p, i, l, grid }; out.doors.push(d); out.added.doors.push(d); break; }
      case 'fdoor': { const f = { x: c, y: r, l, s: p.s, n: p.n, grid }; out.fdoors.push(f); out.added.fdoors.push(f); break; }
      case 'mach': {                                                       // a power machine that is not a prop of its own (a terminal, a solar panel): the sim makes its machine from this
        const m = { ...p, c, r, l, i, grid };
        out.machines.push(m); out.added.machines.push(m);
        const rc = p.s !== undefined ? rects[p.s] : null;
        if (rc && p.flat) sprite({ tag: 'mach', rect: p.s, mode: 3, x: cx, y: yb + 0.03, z: cz, w: rc.w * PX, h: rc.h * PX, ox: 0, oy: 0, lit: [cx, cz, l] });
        break;
      }
      case 'wdoor': {
        const rc = rects[p.s];
        if (!rc) break;
        const [dx, dz] = DV[p.d] || [0, 1];
        const sy = 0.7;
        sprite({ tag: 'wdoor', rect: p.s, mode: 1, x: cx + dx * (TILE / 2 - 0.12), y: yb, z: cz + dz * (TILE / 2 - 0.12), w: rc.w * PX, h: rc.h * PX * sy, ox: (rc.ox + rc.w / 2 - rc.fw / 2) * PX, oy: (rc.fh - rc.oy - rc.h) * PX * sy, yaw: DIR_YAW[OPP[p.d]] ?? 0, lit: [cx, cz, l] });
        break;
      }
      case 'fan': {
        const rc = rects[p.s];
        if (!rc || p.inv) break;                                           // the invisible air blocker has no picture
        sprite({ tag: 'fan', rect: p.s, mode: 3, x: cx, y: yb + 0.02, z: cz, w: rc.w * PX, h: rc.h * PX, ox: (rc.ox + rc.w / 2 - rc.fw / 2) * PX, oy: (rc.oy + rc.h / 2 - rc.fh / 2) * PX, lit: [cx, cz, l] });
        break;
      }
      case 'table': {
        const rc = rects[p.s];
        sprite({ tag: 'table', rect: p.s, mode: 3, x: cx, y: yb + TABLE_H + 0.012, z: cz, w: rc.w * PX, h: rc.h * PX, ox: (rc.ox + rc.w / 2 - rc.fw / 2) * PX, oy: (rc.oy + rc.h / 2 - rc.fh / 2) * PX, lit: [cx, cz, l] });
        break;
      }
      case 'sprite': {
        // a girder is not scenery: it can be unbolted and plated, so it is a built structure (the sim makes the record, see shared/built.js)
        if (p.p === 'structure/girder') { const g = { c, r, l }; out.girders.push(g); out.added.girders.push(g); break; }
        const rc = rects[p.s];
        if (!rc) break;
        const w = rc.w * PX, h = rc.h * PX;
        // stand on the floor (or on the table it shares a tile with): the empty rows under an SS13 sprite are top-down depth, not height
        const y = yb + (world.tableH[i] > 0 ? world.tableH[i] + 0.005 : 0);
        // a thing that looks different from each side (a chair, a console) gets its four pictures, picked by where you stand
        const st = sprite({ tag: 'sprite', rect: p.s, mode: p.bb ? 0 : 1, x: cx, y, z: cz, w, h, ox: (rc.ox + rc.w / 2 - rc.fw / 2) * PX, oy: 0, yaw: DIR_YAW[p.d] ?? 0, lit: [cx, cz, l], ...(p.fr ? { views: p.fr, face: p.d } : {}) });
        // what is bolted down fills its tile; what is loose is a box of its own size that can be dragged about
        const loose = !!p.den && !p.anc;
        const it = { idx: out.interact.length, grid, kind: p.cont ? 'container' : 'prop', name: p.n || 'thing', path: p.p, c, r, l, x: cx, z: cz, y0: y, y1: y + Math.max(1.0, h), rad: 0.8, opened: false, st, anc: !!p.anc, ds: p.ds || 0, dense: loose, d: p.d, x0: cx, z0: cz, d0: p.d, half: loose ? blockHalf(w) : 0, sc: p.sc, sk: p.sk };
        if (loose) world.boxAdd(it); else if (p.den) world.solid[i] = 1;
        out.interact.push(it); out.added.interact.push(it);
        break;
      }
      case 'closet': {
        const cs = (p.op ? CL.OPEN : 0) | (p.lk ? CL.LOCKED : 0);
        const cl = { fr: p.fr, sec: !!p.sec, pl: !!p.pl, a: p.a || [], o: p.o || [], hz: !!p.hz, dopen: !!p.do, nw: !!p.nw, bt: p.bt ?? 120 };
        const it = { idx: out.interact.length, grid, kind: 'closet', name: p.n || 'closet', path: p.p, c, r, l, x: cx, z: cz, y0: yb, rad: 0.9, cl, cs, cs0: cs, gone: false, anc: !!p.anc, ds: p.ds || 0, x0: cx, z0: cz, d: 2, d0: 2, half: 0.55 };
        const sp = closetSprite(it);
        const rc = rects[sp];
        if (!rc) break;
        const w = rc.w * PX, h = rc.h * PX;
        it.y1 = yb + Math.max(1.0, h);
        it.half = blockHalf(rc.w * PX);
        it.st = sprite({ tag: 'closet', rect: sp, mode: 0, x: cx, y: yb, z: cz, w, h, ox: (rc.ox + rc.w / 2 - rc.fw / 2) * PX, oy: 0, yaw: 0, lit: [cx, cz, l] });
        setClosetState(world, it, cs);
        out.interact.push(it); out.added.interact.push(it);
        out.closets.push(it); out.added.closets.push(it);
        break;
      }
      case 'wm': {
        const rc = rects[p.s];
        if (!rc) break;
        const S = 0.85;
        const yc = WM_Y[p.sub] ?? WM_Y.misc;
        const [sdx, sdz] = DV[p.sd];
        const w = rc.w * PX * S, h = rc.h * PX * S;
        // two mounts on the same stretch of wall stand a hair apart (later ones in front), so they cannot flicker through each other
        const spot = `${c},${r},${l},${p.sd}`, k = out.wmSpots.get(spot) || 0;
        out.wmSpots.set(spot, k + 1);
        // on a floor tile the mount stands just in front of the wall; on a wall tile (a sign) it hangs just outside that tile's face
        const depth = p.ow ? TILE / 2 + 0.03 + 0.012 * k : TILE / 2 - 0.03 - 0.012 * k, lat = (p.lat || 0) * PX;
        const x = cx + sdx * depth + (sdx ? 0 : lat), z = cz + sdz * depth + (sdz ? 0 : lat);
        const st = sprite({ tag: 'wm', rect: p.s, mode: 1, x, y: yb + yc - h / 2, z, w, h, yaw: DIR_YAW[p.d] ?? 0, lit: [cx, cz, l], emit: p.sub === 'status_display' || p.sub === 'newscaster' ? 0.6 : 0 });
        const it = { idx: out.interact.length, grid, kind: 'wm', sub: p.sub, name: p.n || p.sub, path: p.p, c, r, l, x, z, y0: yb + yc - h / 2, y1: yb + yc + h / 2, rad: 0.6, st, sd: p.sd, as: p.as };
        out.interact.push(it); out.added.interact.push(it);
        break;
      }
      case 'light': {
        const rc = rects[p.s];
        if (!rc) break;
        const dx = (rc.ox + rc.w / 2 - rc.fw / 2) * PX, dz = (rc.oy + rc.h / 2 - rc.fh / 2) * PX;
        const st = sprite({ tag: 'light', rect: p.s, mode: 2, x: cx, y: yb + WALL_H - 0.02, z: cz, w: rc.w * PX, h: rc.h * PX, ox: dx, oy: dz, emit: 1 });
        const L = {
          c, r, l, x: cx + dx, z: cz + dz, color: hexToRgb(p.c), radius: p.lt === 'bulb' ? 4.5 : p.lt === 'floor' ? 3 : 7.5,
          strength: p.lt === 'bulb' ? 0.85 : 1.0, on: true, area: world.areaIdx[i], kind: p.lt, st,
        };
        out.lights.push(L); out.added.lights.push(L);
        break;
      }
      case 'item': addItem(p.s, p.n || 'item', c, r, { path: p.p, l }); break;
      case 'loot': {
        const count = /three|eight|two/.test(p.cat) ? 1 + Math.floor(lootRng() * 2) : 1;
        for (let k = 0; k < count; k++) {
          if (lootRng() < 0.35) continue;
          const q = pool[Math.floor(lootRng() * pool.length)];
          addItem(q.s, q.n, c, r, { path: q.p, l });
        }
        break;
      }
      default: break;
    }
  }
  // which way every door and firelock faces (needs all of them placed first: a door's neighbour may be another door)
  const doorTiles = new Set([...out.doors.map((d) => d.i), ...out.fdoors.map((f) => world.idx(f.x, f.y, f.l | 0))]);
  for (const d of out.added.doors) d.yaw = doorYaw(world, d.x, d.y, doorTiles, d.l | 0);
  for (const f of out.added.fdoors) f.yaw = doorYaw(world, f.x, f.y, doorTiles, f.l | 0);
  return out;
}

/** A loose structure (a locker, a tank) is at (x, z), turned to `d`. The server moves it and tells everyone; both sides run this. */
export function moveProp(world, it, x, z, d) {
  it.x = x; it.z = z;
  it.c = Math.floor(x / TILE); it.r = Math.floor(z / TILE);
  if (d) it.d = d;
  const st = it.st;
  if (st) {
    st.x = x; st.z = z;
    if (st.views) st.face = it.d;
    if (st.lit) st.lit = [x, z, it.l | 0];
  }
  if (!it.gone) world.boxMove(it, x, z);
}
