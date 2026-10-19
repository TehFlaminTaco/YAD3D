// Decode the packed level.json into typed arrays. Works in the browser and in Node.
function b64(s) {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(s, 'base64'));
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function decodeLevel(level) {
  const { w, h } = level;
  const n = w * h;
  const u16 = (s) => { const u = b64(s); return new Uint16Array(u.buffer, u.byteOffset, u.length >> 1); };
  const kind = b64(level.kind);
  const roof = b64(level.roof);
  const area = u16(level.area);
  const floor = u16(level.floor);
  const wall = u16(level.wall);
  if (kind.length !== n || area.length !== n) throw new Error('level arrays do not match grid size');
  return { level, w, h, kind, roof, area, floor, wall };
}

export function makeRects(sprJson) {
  return sprJson.rects.map((r) => ({
    x: r[0], y: r[1], w: r[2], h: r[3], ox: r[4], oy: r[5], fw: r[6], fh: r[7], avg: [r[8], r[9], r[10]],
    u0: r[0] / sprJson.w, v0: r[1] / sprJson.h, u1: (r[0] + r[2]) / sprJson.w, v1: (r[1] + r[3]) / sprJson.h,
  }));
}
