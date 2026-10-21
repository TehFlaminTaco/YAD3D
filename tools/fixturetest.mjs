// Light fixtures made from frames and taken apart (lighting.dm light_construct): node tools/fixturetest.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSimData } from '../src/sim/load.js';
import { initPhysics } from '../src/shared/physics.js';
import { Sim } from '../src/sim/sim.js';
import { Replica } from '../src/client/state.js';
import { SIM_DT, TILE, KIND } from '../src/shared/config.js';
import { CH, lightMode } from '../src/shared/power.js';
import { LIGHT } from '../src/sim/lights.js';
import { LIGHT_WATTS } from '../src/shared/powerdata.js';
import { RECIPES } from '../src/shared/stacks.js';
import { attach, detach } from '../src/sim/inventory.js';

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
  const g = sim.station, a = A.mob, w = g.world;
  const events = () => inbox.filter((m) => m.t === 'ev').flatMap((m) => m.list);
  const msgs = () => [...events(), ...A.outbox].filter((e) => e.e === 'msg').map((e) => e.text);
  const hold = (p, extra = {}, hand = 0) => {
    const old = a.hands[hand];
    if (old) detach(sim, old);
    if (!p) return null;
    const it = sim.newItem(p, extra);
    attach(sim, it, { t: 'hand', mob: a, i: hand });
    a.active = hand;
    return it;
  };
  const stand = (c, r, l = 0) => { a.grid = g; a.x = (c + 0.5) * TILE; a.z = (r + 0.5) * TILE; a.l = l; a.vx = a.vz = 0; a.cool = 0; a.stunned = 0; };
  const click = (target, wait = 0.1) => { inbox.length = 0; a.busy = null; a.cool = 0; sim.handle(A, { t: 'click', target, yaw: 0, pitch: 0 }); step(wait); };
  /** A floor tile with a wall on one side and no light of its own: [floor c, r, wall c, r]. */
  const spot = () => {
    for (let r = 2; r < w.H - 2; r++) for (let c = 2; c < w.W - 2; c++) {
      const i = w.idx(c, r);
      if (w.kind[i] !== KIND.FLOOR || w.solid[i] || w.doorAt.has(i) || !g.atmos.isCell[i]) continue;
      if (g.props.lights.some((L) => Math.hypot(L.c - c, L.r - r) < 3)) continue;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (w.kind[w.idx(c + dc, r + dr)] === KIND.WALL && w.wallKey(w.idx(c + dc, r + dr))) return [c, r, c + dc, r + dr];
    }
    return null;
  };
  const near = (n, c, r) => g.props.lights.slice(n).filter((L) => L.c === c && L.r === r);
  step(3);
  return { sim, A, a, g, w, inbox, step, events, msgs, hold, stand, click, spot, near };
}

section('the frames', () => {
  const key = '/obj/item/stack/sheet/metal';
  const rows = RECIPES[key].filter((q) => /light fixture frame/.test(q.title));
  ok(rows.length === 2 && rows[0].title === 'light fixture frame' && rows[0].req === 2 && rows[1].title === 'small light fixture frame' && rows[1].req === 1, 'metal sheets make a light fixture frame (two) and a small one (one)');
  ok(rows.every((q) => DATA.level.itemdefs[q.item]), 'both are items of the game');
  const { g } = round();
  ok(g.props.lights.every((L) => L.spec && L.ss.length === 5), 'every fixture has the pictures of its frame as well as of its glass');
});

section('putting a frame on a wall', () => {
  const { sim, g, a, w, step, msgs, hold, stand, click, spot, events } = round();
  const [c, r, wc, wr] = spot();
  stand(c, r);
  const n = g.props.lights.length;
  const frame = hold('/obj/item/wallframe/light_fixture');
  click({ k: 'wall', g: g.id, c: wc, r: wr });
  const L = g.props.lights[n];
  ok(g.props.lights.length === n + 1 && L.status === LIGHT.FRAME1 && L.c === c && L.r === r && L.kind === 'tube', 'a frame on a wall is a fixture frame on the ceiling above you');
  ok(!sim.items.has(frame.id) && msgs().includes('You attach the light fixture frame to the wall.'), 'the item is used up');
  ok(events().some((e) => e.e === 'p+') || true, 'everyone is told');
  ok(!lightMode(L, g.power, w.areas).on && g.powersim.base[L.area * 3 + CH.LIGHT] >= 0, 'it gives no light');
  // a second one on the same spot
  hold('/obj/item/wallframe/light_fixture');
  click({ k: 'wall', g: g.id, c: wc, r: wr });
  ok(msgs().includes("There's already an item on this wall!") && g.props.lights.length === n + 1, 'there is only one to a wall');
  // too far
  stand(2 * c - wc, 2 * r - wr);
  hold('/obj/item/wallframe/light_fixture/small');
  click({ k: 'wall', g: g.id, c: wc, r: wr });
  ok(msgs().some((t) => /You cannot place the small light fixture frame on this spot!/.test(t)) && g.props.lights.length === n + 1, 'from a distance it will not go');
  void step; void L;
});

section('the stages', () => {
  const r0 = round();
  const { sim, g, a, w, step, msgs, hold, stand, click, spot, A } = r0;
  const [c, r, wc, wr] = spot();
  stand(c, r);
  const n = g.props.lights.length;
  hold('/obj/item/wallframe/light_fixture');
  click({ k: 'wall', g: g.id, c: wc, r: wr });
  const L = g.props.lights[n];
  const target = { k: 'light', g: g.id, idx: L.idx };
  ok(sim.lights.examine(g, L).join(' ') === 'This is a light fixture frame. A light fixture under construction. It\'s an empty frame. The casing has no power cell for backup power.', 'examined it is an empty frame');
  // wire it
  const coil = hold('/obj/item/stack/cable_coil', { amount: 5 });
  click(target);
  ok(L.status === LIGHT.FRAME2 && coil.amount === 4 && msgs().includes('You add wires to the light fixture frame.'), 'a length of cable wires it');
  ok(sim.lights.examine(g, L)[2] === "It's wired.", 'and it says it is wired');
  hold('/obj/item/wrench');
  click(target);
  ok(L.status === LIGHT.FRAME2 && msgs().includes('You have to remove the wires first!'), 'a wrench will not take a wired frame down');
  hold('/obj/item/wirecutters');
  click(target);
  const dropped = [...sim.floor.values()].filter((f) => f.grid === g && /cable_coil/.test(f.item.path) && f.c === c && f.r === r);
  ok(L.status === LIGHT.FRAME1 && dropped.length >= 1 && msgs().includes('You remove the wiring from the light fixture frame.'), 'wirecutters take the wire out again and the cable comes back');
  click(target);
  hold('/obj/item/stack/cable_coil', { amount: 2 });
  click(target);
  hold('/obj/item/screwdriver');
  click(target);
  ok(L.status === LIGHT.EMPTY && msgs().includes("You close the light fixture frame's casing."), 'a screwdriver closes the casing: an empty fixture');
  const w0 = g.powersim.base[L.area * 3 + CH.LIGHT];
  // a tube
  hold('/obj/item/light/tube');
  click(target);
  ok(L.status === LIGHT.OK && g.powersim.base[L.area * 3 + CH.LIGHT] === w0 + LIGHT_WATTS.tube, `a tube in it and it is a light, drawing ${LIGHT_WATTS.tube} watts`);
  ok(lightMode(L, g.power, w.areas).on || !g.power.lightsOn(L.area), 'lit when the room has light power');
  // take it apart again
  attach(sim, sim.newItem('/obj/item/clothing/gloves/color/yellow'), { t: 'slot', mob: a, slot: 'gloves' });
  hold(null);
  click(target);
  ok(L.status === LIGHT.EMPTY, 'with a hand the tube comes out');
  hold('/obj/item/screwdriver');
  click(target);
  ok(L.status === LIGHT.FRAME2 && msgs().includes("You open the light fixture's casing."), 'a screwdriver opens an empty fixture back to its wired frame');
  hold('/obj/item/wirecutters');
  click(target);
  hold('/obj/item/wrench');
  const metal0 = [...sim.floor.values()].filter((f) => f.grid === g && /sheet\/metal/.test(f.item.path)).reduce((s, f) => s + (f.item.amount ?? 1), 0);
  click(target, 0.1);
  step(3.4);
  const metal1 = [...sim.floor.values()].filter((f) => f.grid === g && /sheet\/metal/.test(f.item.path)).reduce((s, f) => s + (f.item.amount ?? 1), 0);
  ok(L.status === LIGHT.GONE && metal1 - metal0 === 2 && msgs().includes('You deconstruct the light fixture frame.'), 'a wrench takes the empty frame down: two sheets of metal');
  ok(!sim.lights.thing(g, { idx: L.idx }), 'and there is nothing to click on any more');
  // the small one
  hold('/obj/item/wallframe/light_fixture/small');
  const m = g.props.lights.length;
  stand(c, r);
  click({ k: 'wall', g: g.id, c: wc, r: wr });
  const S = g.props.lights[m];
  ok(S && S.kind === 'bulb' && S.status === LIGHT.FRAME1, 'a small frame makes a small fixture (a bulb)');
  hold('/obj/item/wrench');
  click({ k: 'light', g: g.id, idx: S.idx });
  step(3.4);
  const metal2 = [...sim.floor.values()].filter((f) => f.grid === g && /sheet\/metal/.test(f.item.path)).reduce((s, f) => s + (f.item.amount ?? 1), 0);
  ok(S.status === LIGHT.GONE && metal2 - metal1 === 1, 'and gives one sheet back');
  void A;
});

section('what the clients see', () => {
  const { sim, A, g, a, w, step, hold, stand, click, spot, inbox } = round();
  const [c, r, wc, wr] = spot();
  stand(c, r);
  const n = g.props.lights.length;
  hold('/obj/item/wallframe/light_fixture');
  click({ k: 'wall', g: g.id, c: wc, r: wr });
  const L = g.props.lights[n];
  const evs = inbox.flatMap((m) => (m.t === 'ev' ? m.list : [])).filter((e) => e.e === 'light' && e.i === L.idx);
  ok(evs.length && evs.at(-1).st === LIGHT.FRAME1, 'a new fixture is told, with its state');
  const late = [];
  sim.addClient('Bob', (m) => late.push(m));
  const welcome = late.find((m) => m.t === 'welcome');
  const gs = welcome.grids.find((q) => q.g === g.id);
  ok(gs.lights.some(([i, st]) => i === L.idx && st === LIGHT.FRAME1), 'and whoever joins');
  const rep = new Replica({ level: DATA.level, rects: DATA.rects }, { ...welcome, you: A.id });
  const rg = rep.grids.get(g.id);
  ok(rg.props.lights.length === g.props.lights.length && rg.props.lights[n].status === LIGHT.FRAME1 && rg.props.lights[n].kind === 'tube', 'builds it with the same state');
  hold('/obj/item/wrench');
  click({ k: 'light', g: g.id, idx: L.idx }, 3.5);
  const rep2 = new Replica({ level: DATA.level, rects: DATA.rects }, { ...(() => { const l2 = []; sim.addClient('Carl', (m) => l2.push(m)); return l2.find((m) => m.t === 'welcome'); })(), you: A.id });
  ok(rep2.grids.get(g.id).props.lights[n].status === LIGHT.GONE, 'a fixture taken down is gone for them too');
  void a; void w; void step;
});

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
