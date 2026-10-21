import { N, S, E, W, OPP } from './config.js';

/**
 * Pipes, as data both sides read (atmospherics: `code/modules/atmospherics/machinery/pipes/`). A pipe is a byte per tile per piping layer: its shape, and whether it lies under
 * the floor tiles (`HIDDEN`); another byte says what colour it is. Layer 1, 2 and 3 are what `piping_layer` is in the DM (the map keeps the scrubbers on 1, the air supply on 3).
 */
export const PIPE_LAYERS = 3;
/** Pipe slots per tile: one for each piping layer, and a fourth for a pipe that crosses another on the same layer (the map has a few: a pipe going east to west over one going north to south). */
export const PIPE_SLOTS = 4;
export const PIPE_HIDDEN = 32;

/** The shapes (`pipe_shape` in tools/build_level.py makes these from the map's paths): the directions each joins, and its volume in litres (35 for each of its ends: pipe.dm New). */
export const SHAPE = {
  SIMPLE_NS: 1, SIMPLE_EW: 2, BEND_NE: 3, BEND_SE: 4, BEND_NW: 5, BEND_SW: 6,
  MANIFOLD_N: 7, MANIFOLD_S: 8, MANIFOLD_E: 9, MANIFOLD_W: 10, MANIFOLD4: 11, LAYER_NS: 12, LAYER_EW: 13,
  HE_NS: 14, HE_EW: 15, HE_NE: 16, HE_SE: 17, HE_NW: 18, HE_SW: 19, HEJ_N: 20, HEJ_S: 21, HEJ_E: 22, HEJ_W: 23,
};
const ALL = N | S | E | W;
const rows = [
  null,
  [N | S, 70, 'simple'], [E | W, 70, 'simple'], [N | E, 70, 'simple'], [S | E, 70, 'simple'], [N | W, 70, 'simple'], [S | W, 70, 'simple'],
  [ALL & ~N, 105, 'manifold'], [ALL & ~S, 105, 'manifold'], [ALL & ~E, 105, 'manifold'], [ALL & ~W, 105, 'manifold'], [ALL, 140, 'manifold'],
  [N | S, 260, 'layer'], [E | W, 260, 'layer'],
  [N | S, 70, 'he'], [E | W, 70, 'he'], [N | E, 70, 'he'], [S | E, 70, 'he'], [N | W, 70, 'he'], [S | W, 70, 'he'],
  [N | S, 70, 'junction'], [N | S, 70, 'junction'], [E | W, 70, 'junction'], [E | W, 70, 'junction'],
];
export const SHAPES = rows.map((r, code) => (r ? { code, mask: r[0], vol: r[1], kind: r[2] } : null));
/** The way a heat-exchanging junction's heat-exchanging end faces (its `dir`): the other end joins an ordinary pipe. */
export const JUNCTION_DIR = { 20: N, 21: S, 22: E, 23: W };

export const PIPE_COLORS = [
  ['general', null], ['yellow', '#ffc600'], ['cyan', '#00fff9'], ['green', '#1eff00'], ['orange', '#ff8119'], ['purple', '#8000b6'],
  ['dark', '#454545'], ['brown', '#b26438'], ['violet', '#400080'], ['scrubbers', '#ff0000'], ['supply', '#0000ff'], ['supplymain', '#822bff'], ['heat exchanging', '#404040'],
];

export const shapeOf = (byte) => SHAPES[byte & 31] ?? null;
export const isHidden = (byte) => (byte & PIPE_HIDDEN) !== 0;

/** Direction turned by `deg` (BYOND turn(): positive is anticlockwise as seen on the map). */
const CW = { [N]: E, [E]: S, [S]: W, [W]: N };
export const turnCW = (d) => CW[d];
export const turnCCW = (d) => ({ [N]: W, [W]: S, [S]: E, [E]: N })[d];
export { OPP };

/** How far a picture drawn facing south is turned about the vertical (the floor sprites' `yaw`) to face `d`: east -90 degrees, north 180, west 90. */
const FACE = { [S]: 0, [E]: -Math.PI / 2, [N]: Math.PI, [W]: Math.PI / 2 };
export const turnBetween = (from, to) => (FACE[to] ?? 0) - (FACE[from] ?? 0);

/** The way a built machine faces when its fitting faces `d` (construction.dm fixed_dir): a binary one (a pump, a valve) is built facing north or east whichever way the fitting was turned. */
export const fixedDir = (path, d) => (/\/binary\//.test(path) ? ({ [S]: N, [W]: E })[d] ?? d : d);

export const DIR_NAME = { [N]: 'north', [S]: 'south', [E]: 'east', [W]: 'west' };
/** The index of a direction among a fitting's four pictures (south, north, east, west). */
export const FACE_INDEX = { [S]: 0, [N]: 1, [E]: 2, [W]: 3 };

/**
 * The level prop record of a machine put down on tile (c, r) of deck `l` from its fitting `fit` (`{p, n, d, mv, ly}`: what it was and how it was set): the pictures are the machine's own, drawn
 * facing south and turned to face `d`.
 */
export function fittingSpec(level, fit, c, r, l, d) {
  const t = level.fittings?.[fit.p];
  if (!t) return null;
  return {
    k: 'sprite', x: c, y: r, l, d, n: fit.n, p: fit.p, s: t.sv[0], sv: t.sv, flat: 1, ly: fit.ly, den: 0, cont: 0, anc: 1, rot: t.meter ? 0 : turnBetween(t.bd, d), ...(fit.mv ? { mv: fit.mv } : {}),
  };
}

/** The key of a pipe's picture in `level.pipeSprites`. */
export const pipeSpriteKey = (code, layer, col) => `${code & 31}-${layer}-${col}`;

/**
 * Put the map's pipes in arrays, a byte per tile and slot (`pipe[slot * n + i]`: slot 0 to 2 are layers 1 to 3, slot 3 a second pipe on a layer that has one): the shape (0 none), `pipeCol` its
 * colour and `pipeLy` its layer. `list` is `[col, row, layer, code, colour]` for every pipe (the level data); `idx(col, row)` the tile's index.
 */
export function pipeArrays(list, n, idx) {
  const pipe = new Uint8Array(n * PIPE_SLOTS), pipeCol = new Uint8Array(n * PIPE_SLOTS), pipeLy = new Uint8Array(n * PIPE_SLOTS);
  for (const [c, r, layer, code, col] of list || []) {
    const t = idx(c, r);
    let k = layer - 1;
    if (pipe[k * n + t]) k = PIPE_SLOTS - 1;
    pipe[k * n + t] = code; pipeCol[k * n + t] = col; pipeLy[k * n + t] = layer;
  }
  return { pipe, pipeCol, pipeLy };
}
