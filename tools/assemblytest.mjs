// Airlocks put together and taken apart: the assembly, the electronics, the finished door, a door taken apart: node tools/assemblytest.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSimData } from '../src/sim/load.js';
import { initPhysics } from '../src/shared/physics.js';
import { Sim } from '../src/sim/sim.js';
import { Replica } from '../src/client/state.js';
import { SIM_DT, TILE, KIND } from '../src/shared/config.js';
import { attach, detach } from '../src/sim/inventory.js';
import { RECIPES } from '../src/shared/stacks.js';
import { ACCESS_REGIONS } from '../src/shared/accessdata.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = loadSimData(root);
await initPhysics();
let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) pass++; else { fail++; console.log('  FAIL:', name); } };
const section = (name, fn) => { console.log(name); fn(); };
const METAL = '/obj/item/stack/sheet/metal';

function round() {
  const sim = new Sim(DATA, { bots: 0 });
  const inbox = [], last = {};
  const A = sim.addClient('Alice', (m) => { inbox.push(m); if (m.t === 'ev') for (const e of m.list) if (e.e === 'term' && !e.close) last.term = e; });
  sim.handle(A, { t: 'lobby', op: 'job', id: 'station_engineer' });
  sim.handle(A, { t: 'lobby', op: 'ready', v: true });
  sim.handle(A, { t: 'lobby', op: 'start' });
  const step = (sec) => { for (let k = 0; k < sec / SIM_DT; k++) sim.step(SIM_DT); };
  const g = sim.station, a = A.mob, w = g.world, al = sim.airlocks, as = sim.assemblies;
  a.invulnerable = true;
  const events = () => inbox.filter((m) => m.t === 'ev').flatMap((m) => m.list);
  const msgs = () => events().filter((e) => e.e === 'msg').map((e) => e.text);
  const empty = () => { for (const h of [0, 1]) if (a.hands[h]) detach(sim, a.hands[h]); };
  const hold = (p, extra = {}) => { empty(); const it = sim.newItem(p, extra); attach(sim, it, { t: 'hand', mob: a, i: a.active }); return it; };
  const clickAt = (target, o = {}) => { inbox.length = 0; a.cool = 0; a.busy = null; a.stunned = 0; sim.handle(A, { t: 'click', target, yaw: 0, pitch: 0, alt: !!o.alt }); step(o.wait ?? 0.1); };
  const click = (it, o) => clickAt({ k: 'prop', g: g.id, idx: it.idx }, o);
  const clickDoor = (d, o) => clickAt({ k: 'door', g: g.id, idx: d.idx }, o);
  const term = () => last.term;
  const press = (label) => { const k = term().buttons.findIndex((b) => b.l === label || b.l.startsWith(label)); sim.handle(A, { t: 'term', op: 'act', idx: k }); step(0.1); return k; };
  /** Open hallway floor with open floor in front of it (north of it), and with nothing on it. */
  const spot = () => {
    for (let i = 0; i < w.W * w.H; i++) {
      const c = i % w.W, r = Math.floor(i / w.W);
      if (r < 4 || w.kind[i] !== KIND.FLOOR || w.solid[i] || w.areas[w.areaIdx[i]].c !== 'hallway') continue;
      const f = w.idx(c, r - 1);
      if (w.kind[f] === KIND.FLOOR && !w.solid[f] && !w.dyn[f] && !w.doorAt.has(f) && !g.built.at(c, r - 1) && !g.props.interact.some((p) => !p.gone && p.c === c && p.r === r - 1)) return { c, r, f: [c, r - 1] };
    }
    return null;
  };
  const stand = (s) => { a.grid = g; a.x = s.c * TILE + 1; a.z = s.r * TILE + 1.4; a.l = 0; a.vx = a.vz = 0; a.yaw = 0; a.pitch = 0; a.busy = null; a.stunned = 0; a.cool = 0; };
  const near = (it) => { a.grid = g; a.x = it.x; a.z = it.z + 2; a.l = 0; a.vx = a.vz = 0; a.cool = 0; a.stunned = 0; };
  const onFloor = (re, at) => [...sim.floor.values()].filter((rec) => re.test(rec.item.path) && (!at || (rec.c === at.c && rec.r === at.r)));
  return { sim, A, a, g, w, al, as, inbox, step, events, msgs, empty, hold, clickAt, click, clickDoor, term, press, spot, stand, near, onFloor };
}

section('the metal menu', () => {
  const rows = RECIPES[METAL].filter((r) => r.build?.startsWith('asm:'));
  ok(rows.length === 17 && rows.every((r) => r.req === 4 && r.time === 50 && r.onFloor && r.onePerTurf), 'seventeen airlock assemblies, four sheets and five seconds each');
  const { g } = round();
  ok(rows.every((r) => g.level.assemblies[r.build.slice(4)]), 'and the level has the pictures of each');
});

section('making an assembly, bolting it down, wiring it', () => {
  const { sim, a, g, w, step, msgs, events, hold, click, spot, stand } = round();
  const s = spot();
  stand(s);
  const sheets = hold(METAL, { amount: 8 });
  const ri = RECIPES[METAL].findIndex((r) => r.build === 'asm:standard');
  const n0 = g.props.interact.length;
  sim.stacks.make(a, sheets, ri, 1);
  step(5.3);
  const it = g.props.interact[n0];
  ok(it?.asm && it.path === 'structure/door_assembly' && it.name === 'airlock assembly' && sheets.amount === 4, 'four sheets make an airlock assembly in front of you');
  ok(it.dense && !it.anc && events().some((e) => e.e === 'p+'), 'a loose body, everyone is told');
  // a wrench bolts it down
  hold('/obj/item/wrench');
  a.x = it.x; a.z = it.z + 2;
  click(it, { wait: 0.3 });
  ok(msgs().includes('You start to secure the airlock assembly to the floor...'), 'a wrench: "You start to secure the airlock assembly to the floor..."');
  step(4.3);
  ok(it.anc && msgs().includes('You secure the airlock assembly.') && it.name === 'secured airlock assembly' && w.solid[w.idx(it.c, it.r)] === 1, '"You secure the airlock assembly.": bolted down, it fills its tile, "secured airlock assembly"');
  ok(events().some((e) => e.e === 'pn' && e.i === it.idx && e.n === 'secured airlock assembly'), 'everyone is told its name');
  // cable
  const coil = hold('/obj/item/stack/cable_coil', { amount: 5 });
  click(it, { wait: 0.3 });
  ok(msgs().includes('You start to wire the airlock assembly...'), 'a cable: "You start to wire the airlock assembly..."');
  step(4.3);
  ok(it.asm.state === 1 && coil.amount === 4 && msgs().includes('You wire the airlock assembly.') && it.name === 'wired airlock assembly', '"You wire the airlock assembly.": one piece used, "wired airlock assembly"');
  // wirecutters take it back
  hold('/obj/item/wirecutters');
  click(it, { wait: 0.3 }); step(4.3);
  ok(it.asm.state === 0 && msgs().includes('You cut the wires from the airlock assembly.') && sim.floor.size > 0, 'wirecutters take the wires out again: "You cut the wires from the airlock assembly."');
  void s;
});

section('the electronics', () => {
  const { sim, a, step, hold, empty, term, press } = round();
  const e = hold('/obj/item/electronics/airlock');
  ok(e.def.airlockElectronics, 'airlock electronics know what they are');
  sim.actions.activate(a); step(0.1);
  ok(term() && term().title === 'Airlock Electronics' && /No access is required/.test(term().html), 'activating them opens a menu: no access asked for');
  ok(term().buttons.length === 3 + ACCESS_REGIONS.length, 'clear all, grant all, requires one, and a region each');
  press('Engineering');
  ok(term().buttons.some((b) => b.l === '[ ] Atmospherics') && term().buttons[0].l === 'Back', 'a region lists its accesses');
  press('[ ] Atmospherics');
  ok(e.acc.list.length === 1 && term().buttons.some((b) => b.l === '[x] Atmospherics') && /Requires ALL of 1 access/.test(term().html), 'one is set: "Requires ALL of 1 access"');
  press('Grant region');
  ok(e.acc.list.length >= 10, 'a region at a time');
  press('Back');
  press('Requires one');
  ok(e.acc.one === true && /Requires ONE of/.test(term().html), 'one of them will do');
  press('Clear all');
  ok(e.acc.list.length === 0 && !e.acc.one, 'cleared');
  empty();
});

section('finishing the airlock', () => {
  const { sim, A, a, g, w, al, as, inbox, step, msgs, events, hold, empty, click, spot, stand, term, press, near, onFloor } = round();
  const s = spot(); stand(s);
  const it = as.build(g, 'eng', s.f[0], s.f[1]);
  ok(it.name === 'engineering airlock assembly', 'an engineering assembly is named so');
  // set up: bolt, wire, electronics
  sim.anchoring.set(g, it, true); it.asm.state = 1; as.refresh(it);
  near(it);
  const e = hold('/obj/item/electronics/airlock');
  sim.actions.activate(a); step(0.1);
  press('Engineering'); press('[ ] Engineering'); press('Back'); press('Requires one'); press('Engineering'); press('[ ] Atmospherics');
  empty();
  hold('/obj/item/electronics/airlock', { acc: { list: e.acc.list.slice(), one: true } });
  const held = a.hands[a.active];
  click(it, { wait: 0.3 });
  ok(msgs().includes('You start to install electronics into the airlock assembly...') && it.asm.state === 1, 'electronics: "You start to install electronics into the airlock assembly..."');
  step(4.3);
  ok(it.asm.state === 2 && msgs().includes('You install the airlock electronics.') && it.name === 'near finished engineering airlock assembly' && !a.hands.includes(held), '"You install the airlock electronics.": "near finished engineering airlock assembly", out of the hand');
  // glass
  const glass = hold('/obj/item/stack/sheet/glass', { amount: 3 });
  click(it, { wait: 0.3 }); step(4.3);
  ok(it.asm.glass && glass.amount === 2 && it.pv === 1 && it.name === 'near finished window engineering airlock assembly' && msgs().includes('You install regular glass windows into the airlock assembly.'), 'a glass sheet: "You install regular glass windows into the airlock assembly." and the picture is the window one');
  ok(events().some((e) => e.e === 'pv' && e.i === it.idx && e.v === 1), 'everyone is told');
  // the crowbar takes the electronics out
  hold('/obj/item/crowbar');
  click(it, { wait: 0.3 }); step(4.3);
  ok(it.asm.state === 1 && msgs().includes('You remove the airlock electronics.') && onFloor(/electronics\/airlock/, it).length === 1, 'a crowbar: "You remove the airlock electronics." and they lie on the floor');
  const lying = onFloor(/electronics\/airlock/, it)[0].item;
  ok(lying === held && lying.acc.one && lying.acc.list.length >= 1, 'with the access that was set');
  // and back in
  detach(sim, lying); sim.floor.delete(lying.id); attach(sim, lying, { t: 'hand', mob: a, i: a.active });
  click(it, { wait: 0.3 }); step(4.3);
  ok(it.asm.state === 2, 'put back');
  // the screwdriver
  const nd = g.doors.length, n0 = g.props.interact.length;
  hold('/obj/item/screwdriver');
  click(it, { wait: 0.3 });
  ok(msgs().includes('You start finishing the airlock...'), 'a screwdriver: "You start finishing the airlock..."');
  step(4.3);
  const d = g.doors[nd];
  ok(it.gone && msgs().includes('You finish the airlock.') && d && !d.gone, '"You finish the airlock.": the assembly is gone and there is a door');
  ok(d.c === s.f[0] && d.r === s.f[1] && d.name === 'engineering airlock' && d.glass && d.o.length === lying.acc.list.length && d.a.length === 0, 'on its tile, an engineering airlock with windows, that opens for any one of the accesses');
  ok(d.state === 'closed' && w.doorAt.get(w.idx(d.c, d.r)) === d && w.solid[w.idx(d.c, d.r)] === 1, 'closed, and in the way');
  ok(events().some((e) => e.e === 'p+' && e.sp.some((p) => p.k === 'door')), 'everyone is told of the door');
  void A; void inbox; void al; void term;
});

section('taking a finished airlock apart', () => {
  const { sim, a, g, w, al, step, msgs, hold, clickDoor, near, onFloor, events } = round();
  const d = g.doors.find((x) => x.state === 'closed' && !x.gone && x.a.length && !x.glass && /airlock|engineering/i.test(x.name) && w.kind[w.idx(x.c, x.r + 1)] === KIND.FLOOR);
  ok(!!d, 'a door with an access requirement');
  const need = d.a.slice();
  near(d);
  hold('/obj/item/crowbar'); a.intent = 'help';
  clickDoor(d, { wait: 0.3 });
  ok(msgs().includes("The airlock's motors resist your efforts to force it!"), 'a crowbar does nothing to a door with power');
  hold('/obj/item/screwdriver'); clickDoor(d);
  al.loseMain(d); al.loseBackup(d);
  hold('/obj/item/crowbar'); clickDoor(d, { wait: 0.3 });
  ok((d.state === 'opening' || d.state === 'open') && !msgs().some((t) => /electronics/.test(t)), 'with the panel open and no power a crowbar only forces it: it is not welded shut');
  step(1.5); clickDoor(d, { wait: 0.1 }); step(1.5);
  ok(d.state === 'closed', 'and shuts it again');
  const welder = hold('/obj/item/weldingtool'); welder.lit = true; a.intent = 'harm';
  clickDoor(d, { wait: 0.3 }); step(4.3);
  ok(d.welded, 'welded shut');
  a.intent = 'help';
  hold('/obj/item/crowbar');
  clickDoor(d, { wait: 0.3 });
  ok(msgs().includes('You start to remove electronics from the airlock assembly...'), 'a crowbar: "You start to remove electronics from the airlock assembly..."');
  step(4.3);
  ok(d.gone && msgs().includes('You remove the airlock electronics.') && w.doorAt.get(w.idx(d.c, d.r)) === undefined, '"You remove the airlock electronics.": the door is gone');
  ok(events().some((e) => e.e === 'door-' && e.i === d.idx), 'everyone is told');
  const asm = g.props.interact.find((it) => it.asm && !it.gone && it.c === d.c && it.r === d.r);
  ok(asm && asm.asm.state === 1 && asm.anc && /airlock assembly/.test(asm.name), 'an airlock assembly stands in its place: bolted down and wired, wanting electronics');
  const lying = onFloor(/electronics\/airlock/, asm)[0]?.item;
  ok(lying && lying.acc.one === false && lying.acc.list.join() === need.join(), 'and the electronics lie there, set to what the door asked for');
  ok(w.solid[w.idx(d.c, d.r)] === 1 && w.airBlock[w.idx(d.c, d.r)] === 0, 'a body in the way, but air passes');
  void sim;
});

section('an assembly comes apart', () => {
  const { sim, a, g, as, step, msgs, hold, click, spot, near, onFloor } = round();
  const s = spot();
  const it = as.build(g, 'standard', s.f[0], s.f[1]);
  near(it);
  const welder = hold('/obj/item/weldingtool'); welder.lit = true;
  click(it, { wait: 0.3 });
  ok(msgs().includes('You start to disassemble the airlock assembly...'), 'a welder: "You start to disassemble the airlock assembly..."');
  step(4.3);
  ok(it.gone && msgs().includes('You disassemble the airlock assembly.'), '"You disassemble the airlock assembly."');
  const sheets = onFloor(/sheet\/metal/, it);
  ok(sheets.reduce((n, rec) => n + (rec.item.amount ?? 1), 0) === 4, 'four sheets of metal');
  // one that is bolted down, a welder does not take apart; it takes the glass out
  const it2 = as.build(g, 'eng', s.f[0], s.f[1], { glass: true, anc: true });
  as.refresh(it2);
  near(it2);
  hold('/obj/item/weldingtool').lit = true;
  click(it2, { wait: 0.3 });
  ok(msgs().includes('You start to weld the glass panel out of the airlock assembly...'), 'one with glass: "You start to weld the glass panel out of the airlock assembly..."');
  step(4.3);
  ok(!it2.asm.glass && it2.pv === 0 && msgs().includes('You weld the glass panel out.') && onFloor(/sheet\/glass/, it2).length === 1, 'the glass comes out');
  hold('/obj/item/weldingtool').lit = true;
  click(it2, { wait: 0.3 });
  ok(!it2.gone, 'a bolted one is not taken apart by a welder');
  void sim; void a;
});

section('the clients', () => {
  const { sim, A, g, as, al, step, hold, click, spot, near } = round();
  const s = spot();
  const it = as.build(g, 'standard', s.f[0], s.f[1]);
  sim.anchoring.set(g, it, true); it.asm.state = 1; it.asm.glass = true; as.refresh(it);
  const e = sim.newItem('/obj/item/electronics/airlock'); e.acc = { list: [10], one: false };
  it.asm.state = 2; it.asm.electronics = e; e.loc = { t: 'assembly' };
  near(it);
  hold('/obj/item/screwdriver');
  click(it, { wait: 0.3 }); step(4.3);
  const d = g.doors[g.doors.length - 1];
  ok(d.c === s.f[0] && d.r === s.f[1] && d.glass, 'a glass airlock');
  const late = [];
  sim.addClient('Bob', (m) => late.push(m));
  const gs = late.find((m) => m.t === 'welcome').grids.find((q) => q.g === g.id);
  const rep = new Replica({ level: DATA.level, rects: DATA.rects }, { ...late.find((m) => m.t === 'welcome'), you: A.id });
  const rg = rep.grids.get(g.id);
  const rd = rg.doors[g.doors.length - 1];
  ok(rg.doors.length === g.doors.length && rd && rd.c === d.c && rd.a.join() === '10' && rd.glass, 'a joiner has the new door');
  ok(rg.props.interact[it.idx].gone && gs.gone.includes(it.idx), 'and the assembly gone');
  // take it apart again
  al.state(d).panel = true; d.welded = true; al.loseMain(d); al.loseBackup(d);
  hold('/obj/item/crowbar');
  sim.assemblies.takeApart(A.mob, d, A.mob.held);
  step(4.3);
  const late2 = [];
  sim.addClient('Cy', (m) => late2.push(m));
  const w2 = late2.find((m) => m.t === 'welcome');
  const gs2 = w2.grids.find((q) => q.g === g.id);
  const rep2 = new Replica({ level: DATA.level, rects: DATA.rects }, { ...w2, you: A.id });
  const rg2 = rep2.grids.get(g.id);
  ok(gs2.dg.includes(d.idx) && rg2.doors[d.idx].gone && !rg2.world.doorAt.has(rg2.world.idx(d.c, d.r)), 'a later joiner sees the door gone and its tile open');
  const asm2 = g.props.interact.find((p) => p.asm && !p.gone && p.c === d.c && p.r === d.r);
  ok(gs2.pn.some(([i, n]) => i === asm2.idx && /airlock assembly/.test(n)) && rg2.props.interact[asm2.idx].name === asm2.name, 'and the assembly with its name');
  ok(gs2.pv.some(([i, v]) => i === asm2.idx && v === 1), 'in glass');
});

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
