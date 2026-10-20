// Small synthetic grids for tests: an ASCII picture becomes a blueprint in the level data's own format, so the real Sim and the real client
// replica can load it (`level.grids[name]`) and put it in a map at any pose. Used by tools/gridtest.mjs.
//
//   #  wall                .  floor (plating, a hallway, with a roof)      (space)  open space
//   D  a door on a floor tile (copied from the station's own: anyone may pass)
//   S  a start point for `o.spawnJob`, on a floor tile

const b64 = (bytes) => Buffer.from(bytes).toString('base64');
const b64u16 = (arr) => b64(new Uint8Array(new Uint16Array(arr).buffer));

/** A blueprint from `rows` (strings of the same length). `level` is the real level data (for its art indexes and a door to copy). */
export function makeBlueprint(level, rows, o = {}) {
  const h = rows.length, w = rows[0].length, n = w * h;
  const wallVar = level.walls.findIndex((v) => v.name === 'reinforced_wall');
  const hallway = level.areas.findIndex((a) => a.c === 'hallway');
  const space = level.areas.findIndex((a) => a.c === 'space');
  const door = level.grids.station.props.find((p) => p.k === 'door' && !(p.a && p.a.length) && !(p.o && p.o.length));
  const kind = new Uint8Array(n), roof = new Uint8Array(n), area = new Array(n).fill(space), floor = new Array(n).fill(0xffff), wall = new Array(n).fill(0xffff);
  const props = [], spawns = [];
  rows.forEach((row, r) => {
    if (row.length !== w) throw new Error('ragged rows');
    [...row].forEach((ch, c) => {
      const i = r * w + c;
      if (ch === '#') { kind[i] = 2; wall[i] = wallVar; area[i] = hallway; roof[i] = 1; return; }
      if (ch === ' ') return;
      kind[i] = 1; floor[i] = level.terrain.plating; area[i] = hallway; roof[i] = 1;
      if (ch === 'D') props.push({ ...door, x: c, y: r });
      if (ch === 'S') spawns.push({ job: o.spawnJob || 'assistant', x: c, y: r });
    });
  });
  return { w, h, kind: b64(kind), roof: b64(roof), area: b64u16(area), floor: b64u16(floor), wall: b64u16(wall), props, spawns };
}

/**
 * `data` (what loadSimData returns) with extra blueprints, and the level's own map holding the station and `placements` [{ bp, kind, p, q }]
 * (not the shuttles the real level docks, unless `keepShuttles`: a test of grids wants the grids it made). `maps` adds whole new maps:
 * { id: { name, grids: [placements] } }.
 */
export function withGrids(data, blueprints, placements = [], maps = {}, keepShuttles = false) {
  const level = { ...data.level, grids: { ...data.level.grids, ...blueprints }, maps: { ...data.level.maps } };
  const base = level.maps[level.map];
  level.maps[level.map] = { ...base, grids: [...base.grids.filter((g) => keepShuttles || g.kind === 'station'), ...placements] };
  for (const [id, m] of Object.entries(maps)) level.maps[id] = m;
  return { ...data, level };
}
