/**
 * A blueprint (one grid's map in the level data's own format: `level.grids[name]`) made from a picture, for tests and for grids that are made while the game runs.
 * `rows` is a list of strings (one deck), or a list of those (a list of decks, the first at the bottom). Every string of a deck has the same length.
 *
 *   #  wall                .  floor (plating, a hallway, with a roof)      (space)  open space; on a deck above the first, a hole through to the one below
 *   D  a door on a floor tile (copied from the station's own: anyone may pass)
 *   L  a ceiling light on a floor tile (copied from the station's own)
 *   S  a start point for `o.spawnJob`, on a floor tile
 *   ^ v > <  a stair, a floor tile that climbs north / south / east / west (leaving it that way takes you up a deck, onto the tile in front of it on the deck above:
 *            the tile above the stair itself should be open space)
 */
const b64 = (bytes) => {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const b64u16 = (arr) => b64(new Uint8Array(new Uint16Array(arr).buffer));

const STAIRS = { '^': 1, v: 2, '>': 4, '<': 8 };      // the direction bits of config.js: N, S, E, W

export function makeBlueprint(level, rows, o = {}) {
  const decks = Array.isArray(rows[0]) ? rows : [rows];
  const h = decks[0].length, w = decks[0][0].length, levels = decks.length, wh = w * h, n = wh * levels;
  const wallVar = level.walls.findIndex((v) => v.name === 'reinforced_wall');
  const hallway = level.areas.findIndex((a) => a.c === 'hallway');
  const space = level.areas.findIndex((a) => a.c === 'space');
  const allProps = Object.values(level.grids).flatMap((g) => g.props);
  const door = allProps.find((p) => p.k === 'door' && !(p.a && p.a.length) && !(p.o && p.o.length));          // any plain door of the level's own
  const light = allProps.find((p) => p.k === 'light' && p.lt === 'tube');                                      // and a tube light
  const kind = new Uint8Array(n), roof = new Uint8Array(n), stairs = new Uint8Array(n), area = new Array(n).fill(space), floor = new Array(n).fill(0xffff), wall = new Array(n).fill(0xffff);
  const props = [], spawns = [];
  decks.forEach((rows2, l) => {
    if (rows2.length !== h) throw new Error('decks of different sizes');
    rows2.forEach((row, r) => {
      if (row.length !== w) throw new Error('ragged rows');
      [...row].forEach((ch, c) => {
        const i = l * wh + r * w + c;
        if (ch === '#') { kind[i] = 2; wall[i] = wallVar; area[i] = hallway; roof[i] = 1; return; }
        if (ch === ' ') return;
        kind[i] = 1; floor[i] = level.terrain.plating; area[i] = hallway; roof[i] = 1;
        if (STAIRS[ch]) stairs[i] = STAIRS[ch];
        if (ch === 'D') props.push({ ...door, x: c, y: r, l });
        if (ch === 'L' && light) props.push({ ...light, x: c, y: r, l });
        if (ch === 'S') spawns.push({ job: o.spawnJob || 'assistant', x: c, y: r, l });
      });
    });
  });
  const bp = { w, h, kind: b64(kind), roof: b64(roof), area: b64u16(area), floor: b64u16(floor), wall: b64u16(wall), props, spawns };
  if (levels > 1) bp.levels = levels;
  if (stairs.some((v) => v)) bp.stairs = b64(stairs);
  return bp;
}
