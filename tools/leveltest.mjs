// Geometry checks for the level mesh (no WebGL needed): node tools/leveltest.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSimData } from '../src/sim/load.js';
import { decodeGrid } from '../src/shared/leveldata.js';
import { World } from '../src/shared/world.js';
import { LevelMesh } from '../src/render/level.js';
import { TILE, KIND, DV } from '../src/shared/config.js';
import fs from 'node:fs';
import { Looks, WORN_SLOTS } from '../src/shared/looks.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = loadSimData(root);
const world = new World(decodeGrid(data.level, 'station'));
const mesh = new LevelMesh(world, { level: data.level, terrainTex: null });
let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) pass++; else { fail++; console.log('  FAIL:', name); } };

const key = (x, z) => `${x.toFixed(2)},${z.toFixed(2)}`;
const INSET = 0.08;

/** Flatten every chunk's quads: floors (all y = 0) by tile, vertical faces by centre point (glass and opaque apart). */
function scan() {
  const floors = new Map(), glass = new Set(), solid = new Map();
  for (const ch of mesh.chunks.values()) {
    for (const rec of ch.meshes) {
      const pos = rec.mesh.geometry.getAttribute('position');
      const layer = rec.mesh.geometry.getAttribute('aLayer');
      const isGlass = rec.mesh.material === mesh.glassMat;
      for (let v = 0; v < pos.count; v += 4) {
        let x = 0, z = 0, ymax = 0;
        for (let k = 0; k < 4; k++) { x += pos.getX(v + k) / 4; z += pos.getZ(v + k) / 4; ymax = Math.max(ymax, pos.getY(v + k)); }
        if (isGlass) glass.add(key(x, z));
        else if (ymax === 0) floors.set(Math.floor(z / TILE) * world.W + Math.floor(x / TILE), layer.getX(v));
        else solid.set(key(x, z), layer.getX(v));
      }
    }
  }
  return { floors, glass, solid };
}

const windows = [];
for (let r = 0; r < world.H; r++) for (let c = 0; c < world.W; c++) {
  const i = r * world.W + c;
  if (world.glass[i] && world.kind[i] === KIND.WALL) windows.push([c, r, i]);
}
/** Sides of tile (c, r) that face a non-wall tile (space included), as [dc, dr]. */
const openSides = (c, r) => [1, 2, 4, 8].map((d) => DV[d]).filter(([dc, dr]) => world.inb(c + dc, r + dr) && world.kind[(r + dr) * world.W + c + dc] !== KIND.WALL);
const edge = (c, r, [dc, dr], inset = 0) => key(c * TILE + 1 + dc * (TILE / 2 - inset), r * TILE + 1 + dr * (TILE / 2 - inset));

console.log('glass windows');
{
  const { floors, glass, solid } = scan();
  let floorless = 0, missingFace = 0, thinPane = 0, noGrille = 0, missingGrille = 0, wrongGrille = 0;
  for (const [c, r, i] of windows) {
    const v = world.variants[world.wallVar[i]];
    if (floors.get(i) !== world.floorCell[i]) floorless++;
    if (glass.has(key(c * TILE + 1, r * TILE + 1))) thinPane++;
    if (v.gr === undefined) noGrille++;
    for (const s of openSides(c, r)) {
      if (!glass.has(edge(c, r, s))) missingFace++;
      if (v.gr !== undefined && !solid.has(edge(c, r, s, INSET))) missingGrille++;
      else if (v.gr !== undefined && solid.get(edge(c, r, s, INSET)) !== v.gr) wrongGrille++;
    }
  }
  ok(windows.length > 500, `level has glass tiles (${windows.length})`);
  ok(floorless === 0, `every window tile shows its own floor, not space (${floorless} without)`);
  ok(missingFace === 0, `every open side of a window is glazed at the tile edge, space side included (${missingFace} missing)`);
  ok(thinPane === 0, `no zero-thickness pane in the middle of a window tile (${thinPane})`);
  ok(noGrille === 0, `every BoxStation window has a grille (${noGrille} without)`);
  ok(missingGrille === 0 && wrongGrille === 0, `a grille panel stands just inside every glass face (${missingGrille} missing, ${wrongGrille} wrong)`);
}

console.log('smashed window');
{
  // an interior one and one that touches space
  const interior = windows.find(([c, r, i]) => !world.ventsToSpace(i) && openSides(c, r).length >= 2 && !windows.some(([c2, r2]) => Math.abs(c2 - c) + Math.abs(r2 - r) === 1));
  const exterior = windows.find(([, , i]) => [1, 2, 4, 8].some((d) => { const k = world.kindAt(i % world.W + DV[d][0], Math.floor(i / world.W) + DV[d][1]); return k === KIND.SPACE; }));
  ok(interior && exterior, 'found an interior and an exterior window');
  for (const [name, w] of [['interior', interior], ['exterior', exterior]]) {
    const [c, r, i] = w;
    const sides = openSides(c, r);
    const gr = world.variants[world.wallVar[i]].gr;
    world.setBreach(c, r);
    mesh.rebuildTiles([[c, r]]);
    const { floors, glass, solid } = scan();
    ok(sides.every((s) => !glass.has(edge(c, r, s))), `${name}: the glass is gone`);
    ok(sides.every((s) => solid.get(edge(c, r, s, INSET)) === gr), `${name}: the grille is left standing`);
    ok(floors.get(i) === mesh.floorCellFor(i, c, r, 0), `${name}: the floor shows (with a cable on it, if there is one)`);
  }
}


console.log('character art');
{
  const chars = JSON.parse(fs.readFileSync(path.join(root, 'assets/chars.json'), 'utf8'));
  const jobs = JSON.parse(fs.readFileSync(path.join(root, 'data/jobs.json'), 'utf8')).jobs;
  const bases = [chars.eyes, ...Object.values(chars.body), ...['hair', 'facial', 'underwear', 'undershirt', 'socks'].flatMap((k) => chars[k].map((e) => e.c)), ...Object.values(chars.worn).flatMap((w) => Object.values(w).map((e) => e[0]))];
  ok(bases.every((b) => b >= -1 && (b < 0 || b + 3 < chars.cells)), 'every cell group the data points at exists in the sheet');
  ok(chars.hair.length > 100 && chars.facial.length > 30 && chars.skin.length === 12, `the option lists are the real SS13 ones (${chars.hair.length} hair, ${chars.facial.length} facial)`);
  const missing = [];
  for (const j of jobs) for (const slot of WORN_SLOTS) {
    const path_ = j.outfit[slot];
    if (typeof path_ === 'string' && slot !== 'suit_store' && !chars.worn[path_]?.[slot]) missing.push(`${j.id} ${slot} ${path_}`);
  }
  ok(missing.length === 0, `every job's clothes can be drawn (${missing.slice(0, 3).join('; ')})`);
  const looks = new Looks(chars);
  let seed = 7;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const randoms = Array.from({ length: 200 }, () => looks.random(rand));
  ok(randoms.every((l) => JSON.stringify(looks.sanitize(l)) === JSON.stringify(l)), 'random looks are already valid');
  ok(new Set(randoms.map((l) => l.h)).size > 30, 'and varied');
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
