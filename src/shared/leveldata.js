// Decode the packed level.json into typed arrays. Works in the browser and in Node.
function b64(s) {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(s, 'base64'));
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * One grid's own map, ready to build a `World` and its props from: the blueprint `bp` of `level.grids`. Every call makes fresh arrays, so two
 * grids built from one blueprint (four escape pods) do not share tiles. `level` itself is what all grids share (art, areas, item definitions).
 */
export function decodeGrid(level, bp) {
  const g = level.grids?.[bp];
  if (!g) throw new Error(`no grid blueprint "${bp}" in the level data`);
  const { w, h } = g;
  const n = w * h;
  const u16 = (s) => { const u = b64(s); return new Uint16Array(u.buffer, u.byteOffset, u.length >> 1); };
  const kind = b64(g.kind);
  const roof = b64(g.roof);
  const area = u16(g.area);
  const floor = u16(g.floor);
  const wall = u16(g.wall);
  const ft = g.ft ? b64(g.ft) : new Uint8Array(n);          // what kind of floor (index + 1 into level.floorTypes)
  const lat = g.lat ? b64(g.lat) : new Uint8Array(n);       // lattice over space: 1 lattice, 2 catwalk
  if (kind.length !== n || area.length !== n) throw new Error(`grid "${bp}": arrays do not match its size`);
  return { bp, level, w, h, levels: 1, kind, roof, area, floor, wall, ft, lat, props: g.props, spawns: g.spawns || [] };
}

export function makeRects(sprJson) {
  return sprJson.rects.map((r) => ({
    x: r[0], y: r[1], w: r[2], h: r[3], ox: r[4], oy: r[5], fw: r[6], fh: r[7], avg: [r[8], r[9], r[10]],
    u0: r[0] / sprJson.w, v0: r[1] / sprJson.h, u1: (r[0] + r[2]) / sprJson.w, v1: (r[1] + r[3]) / sprJson.h,
  }));
}
