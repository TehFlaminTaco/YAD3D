// Small synthetic grids for tests: an ASCII picture becomes a blueprint in the level data's own format, so the real Sim and the real client
// replica can load it (`level.grids[name]`) and put it in a map at any pose. Used by tools/gridtest.mjs.
//
// (the picture's legend, and how decks and stairs are drawn, are in src/shared/blueprint.js)

export { makeBlueprint } from '../src/shared/blueprint.js';

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
