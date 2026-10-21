// Props made and taken away while the game runs: node tools/runtimetest.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSimData } from '../src/sim/load.js';
import { initPhysics } from '../src/shared/physics.js';
import { Sim } from '../src/sim/sim.js';
import { Replica } from '../src/client/state.js';
import { SIM_DT, TILE, KIND } from '../src/shared/config.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = loadSimData(root);
await initPhysics();
let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) pass++; else { fail++; console.log('  FAIL:', name); } };
const section = (name, fn) => { console.log(name); fn(); };

function round() {
  const sim = new Sim(DATA, { bots: 0 });
  const inbox = [];
  const A = sim.addClient('Alice', (m) => inbox.push(m));
  sim.handle(A, { t: 'lobby', op: 'job', id: 'station_engineer' });
  sim.handle(A, { t: 'lobby', op: 'ready', v: true });
  sim.handle(A, { t: 'lobby', op: 'start' });
  const step = (sec) => { for (let k = 0; k < sec / SIM_DT; k++) sim.step(SIM_DT); };
  const g = sim.station, w = g.world;
  const events = () => inbox.filter((m) => m.t === 'ev').flatMap((m) => m.list);
  /** A free floor tile in a hallway, away from everything. */
  const freeTile = () => {
    for (let i = 0; i < w.n; i++) {
      if (w.kind[i] === KIND.FLOOR && !w.solid[i] && !w.doorAt.has(i) && w.areas[w.areaIdx[i]].c === 'hallway' && ![...g.props.interact].some((it) => it.c === i % w.W && it.r === Math.floor(i / w.W))) return [i % w.W, Math.floor(i / w.W)];
    }
    return null;
  };
  return { sim, A, g, w, inbox, step, events, freeTile };
}

section('a prop made while the game runs', () => {
  const { sim, g, w, events, step, freeTile } = round();
  const canister = g.props.interact.find((it) => /portable_atmospherics\/canister$/.test(it.path || ''));
  ok(!!canister?.spec, 'a prop remembers the record it was made from');
  const [c, r] = freeTile();
  const spec = { ...canister.spec, x: c, y: r, l: 0 };
  const n0 = g.props.interact.length, s0 = g.props.statics.length;
  const made = sim.addProps(g, [spec]);
  step(0.1);
  ok(made.length === 1 && made[0].idx === n0 && g.props.interact.length === n0 + 1 && g.props.statics.length === s0 + 1, 'the record is appended: the next index, one more sprite');
  ok(made[0].c === c && made[0].r === r && made[0].path === canister.path && made[0].st && made[0].st.rect === spec.s, 'on its tile, with its picture');
  ok(made[0].dense && w.boxes.get(w.idx(c, r))?.includes(made[0]), 'a loose thing is a box of its own on the tile');
  const ev = events().find((e) => e.e === 'p+');
  ok(ev && ev.g === g.id && ev.sp.length === 1 && ev.sp[0].x === c, 'everyone is told, with the record');
  ok(g.propLog.length === 1, 'and the grid keeps it for joiners');
  // a bolted-down one fills its tile
  const [c2, r2] = (() => { for (let i = 0; i < w.n; i++) { const cc = i % w.W, rr = Math.floor(i / w.W); if (w.kind[i] === KIND.FLOOR && !w.solid[i] && !w.doorAt.has(i) && w.areas[w.areaIdx[i]].c === 'hallway' && (cc !== c || rr !== r)) { if (![...g.props.interact].some((it) => it.c === cc && it.r === rr)) return [cc, rr]; } } })();
  const tank = g.props.interact.find((it) => /atmospherics\/components\/unary\/tank/.test(it.path || ''));
  const made2 = sim.addProps(g, [{ ...tank.spec, x: c2, y: r2, l: 0 }]);
  ok(made2[0].anc && w.solid[w.idx(c2, r2)] === 1, 'a bolted one fills its tile');
  // take them away
  events().length;
  sim.removeProp(g, made[0]); sim.removeProp(g, made2[0]); step(0.1);
  ok(made[0].gone && !(w.boxes.get(w.idx(c, r)) || []).includes(made[0]) && made2[0].gone && w.solid[w.idx(c2, r2)] === 0, 'taken away: gone, and the tile is free again');
  ok(events().filter((e) => e.e === 'pg').length >= 2 && g.props.interact.length === n0 + 2, 'everyone is told; the records stay in the lists (their indexes are never used again)');
});

section('a joiner and the replica', () => {
  const { sim, A, g, w, inbox, step, freeTile } = round();
  const canister = g.props.interact.find((it) => /portable_atmospherics\/canister$/.test(it.path || ''));
  const [c, r] = freeTile();
  const made = sim.addProps(g, [{ ...canister.spec, x: c, y: r, l: 0 }]);
  step(0.2);
  const rep0 = new Replica({ level: DATA.level, rects: DATA.rects }, { ...inbox.find((m) => m.t === 'welcome'), you: A.id });
  // a client that was there from the start hears the event
  const evs = inbox.filter((m) => m.t === 'ev').flatMap((m) => m.list).filter((e) => e.e === 'p+');
  const seen = rep0.grids.get(g.id);
  const n = seen.props.interact.length;
  for (const e of evs) rep0.apply(e);
  ok(seen.props.interact.length === n + 1 || seen.props.interact.length === g.props.interact.length, 'a client that was there hears of it and builds it');
  const late = [];
  sim.addClient('Bob', (m) => late.push(m));
  const welcome = late.find((m) => m.t === 'welcome');
  const gs = welcome.grids.find((q) => q.g === g.id);
  ok(gs.ps.length === 1, 'the welcome carries the props made since the map');
  const rep = new Replica({ level: DATA.level, rects: DATA.rects }, { ...welcome, you: A.id });
  const rg = rep.grids.get(g.id);
  ok(rg.props.interact.length === g.props.interact.length, 'a joiner has the same number of props');
  const mine = rg.props.interact[made[0].idx];
  ok(mine && mine.path === made[0].path && mine.c === c && mine.r === r && mine.dense === true && rg.world.boxes.get(w.idx(c, r))?.includes(mine), 'and the same one at the same index, as a box on the tile');
  ok(rg.props.statics.length === g.props.statics.length, 'with the same sprites');
  sim.removeProp(g, made[0]);
  const late2 = [];
  sim.addClient('Cy', (m) => late2.push(m));
  const w2 = late2.find((m) => m.t === 'welcome').grids.find((q) => q.g === g.id);
  ok(w2.gone.includes(made[0].idx) && w2.ps.length === 1, 'a prop taken away is told as gone, and its record is still counted');
});

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
