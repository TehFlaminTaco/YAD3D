// Decode the packed level.json into typed arrays. Works in the browser and in Node.
function b64(s) {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(s, 'base64'));
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** The blueprint name of a map's void: not in the level data, it has no tiles (a single empty one, so the arrays that every grid has are there). */
export const VOID_BP = 'void';

/**
 * One grid's own map, ready to build a `World` and its props from: the blueprint `bp` of `level.grids`. Every call makes fresh arrays, so two
 * grids built from one blueprint (four escape pods) do not share tiles. `level` itself is what all grids share (art, areas, item definitions).
 */
export function decodeGrid(level, bp) {
  if (bp === VOID_BP) return { bp, level, w: 1, h: 1, levels: 1, kind: new Uint8Array(1), roof: new Uint8Array(1), area: new Uint16Array(1), floor: new Uint16Array(1), wall: new Uint16Array(1).fill(0xffff), ft: new Uint8Array(1), lat: new Uint8Array(1), props: [], spawns: [], void: true };
  const g = level.grids?.[bp];
  if (!g) throw new Error(`no grid blueprint "${bp}" in the level data`);
  const { w, h } = g;
  const levels = g.levels ?? 1;                              // stacked decks: every array holds deck 0's tiles, then deck 1's, ...
  const n = w * h * levels;
  const u16 = (s) => { const u = b64(s); return new Uint16Array(u.buffer, u.byteOffset, u.length >> 1); };
  const kind = b64(g.kind);
  const roof = b64(g.roof);
  const area = u16(g.area);
  const floor = u16(g.floor);
  const wall = u16(g.wall);
  const ft = g.ft ? b64(g.ft) : new Uint8Array(n);          // what kind of floor (index + 1 into level.floorTypes)
  const lat = g.lat ? b64(g.lat) : new Uint8Array(n);       // lattice over space: 1 lattice, 2 catwalk
  const stairs = g.stairs ? b64(g.stairs) : new Uint8Array(n);   // a stair tile: the direction (N S E W bit) you go up
  if (kind.length !== n || area.length !== n) throw new Error(`grid "${bp}": arrays do not match its size`);
  return { bp, level, w, h, levels, kind, roof, area, floor, wall, ft, lat, stairs, props: g.props, spawns: g.spawns || [] };
}

export function makeRects(sprJson) {
  return sprJson.rects.map((r) => ({
    x: r[0], y: r[1], w: r[2], h: r[3], ox: r[4], oy: r[5], fw: r[6], fh: r[7], avg: [r[8], r[9], r[10]],
    u0: r[0] / sprJson.w, v0: r[1] / sprJson.h, u1: (r[0] + r[2]) / sprJson.w, v1: (r[1] + r[3]) / sprJson.h,
  }));
}
