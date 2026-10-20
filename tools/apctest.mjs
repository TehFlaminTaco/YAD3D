// An APC taken apart and put together again: its cover, board, cell, wiring and frame: node tools/apctest.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSimData } from '../src/sim/load.js';
import { initPhysics } from '../src/shared/physics.js';
import { Sim } from '../src/sim/sim.js';
import { Replica } from '../src/client/state.js';
import { SIM_DT, TILE, DV } from '../src/shared/config.js';
import { CH } from '../src/shared/power.js';
import { APC_STATES, cellMax } from '../src/shared/powerdata.js';
import { attach, detach } from '../src/sim/inventory.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = loadSimData(root);
await initPhysics();
let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) pass++; else { fail++; console.log('  FAIL:', name); } };
const section = (name, fn) => { console.log(name); fn(); };
const V = (s) => APC_STATES.indexOf(s);

function round() {
  const sim = new Sim(DATA, { bots: 0 });
  const inbox = [];
  const A = sim.addClient('Alice', (m) => inbox.push(m));
  sim.handle(A, { t: 'lobby', op: 'job', id: 'station_engineer' });
  sim.handle(A, { t: 'lobby', op: 'ready', v: true });
  sim.handle(A, { t: 'lobby', op: 'start' });
  const step = (sec) => { for (let k = 0; k < sec / SIM_DT; k++) sim.step(SIM_DT); };
  const g = sim.station, a = A.mob, ps = g.powersim, w = g.world;
  const events = () => inbox.filter((m) => m.t === 'ev').flatMap((m) => m.list);
  const msgs = () => events().filter((e) => e.e === 'msg').map((e) => e.text);
  const empty = () => { if (a.hands[a.active]) detach(sim, a.hands[a.active]); };
  const hold = (p, extra = {}) => {
    empty();
    const it = sim.newItem(p, extra);
    attach(sim, it, { t: 'hand', mob: a, i: a.active });
    return it;
  };
  const tick = (n = 1) => { for (let k = 0; k < n; k++) ps.tick(true); ps.flush(); };
  /** A click on `target`, and the work it starts waited out. */
  const clickAt = (target, o = {}) => {
    inbox.length = 0; a.cool = 0; a.busy = null; a.stunned = 0;
    sim.handle(A, { t: 'click', target, yaw: 0, pitch: 0, alt: !!o.alt });
    step(o.wait ?? 0.1);
  };
  const click = (x, o) => clickAt({ k: 'prop', g: g.id, idx: x.rec.idx }, o);
  const stand = (x) => { a.grid = g; a.x = (x.c + 0.5) * TILE; a.z = (x.r + 0.5) * TILE; a.l = 0; a.vx = a.vz = 0; a.cool = 0; a.stunned = 0; };
  const main = () => [...ps.cables.nets.values()].sort((p, q) => q.tiles - p.tiles)[0];
  const apcs = ps.machines.apc.filter((x) => x.net === main() && w.floorType(x.tile)?.k === 'plating');
  sim.rand = () => 0.99;                                                    // (no shocks and no luck: the shock tests ask for them)
  return { sim, A, a, g, ps, w, inbox, step, events, msgs, hold, empty, tick, click, clickAt, stand, main, apcs };
}

const floorItems = (sim, prefix) => [...sim.floor.values()].filter((f) => f.item.path.startsWith(prefix));

section('power cells', () => {
  ok(cellMax('/obj/item/stock_parts/cell') === 1000 && cellMax('/obj/item/stock_parts/cell/high') === 10000 && cellMax('/obj/item/stock_parts/cell/high/plus') === 15000 && cellMax('/obj/item/stock_parts/cell/upgraded/plus') === 5000, 'a power cell holds what cell.dm says');
  ok(cellMax('/obj/item/stock_parts/cell/high/empty') === 10000 && cellMax('/obj/item/stock_parts/cell/crap') === 500, 'and the variants too');
});

section('an APC as the map has it', () => {
  const { apcs, w } = round();
  const x = apcs[0];
  ok(apcs.length >= 10, `there are APCs on plating on the main network (${apcs.length})`);
  ok(x.frame && x.opened === 0 && x.coverlocked && x.locked && !x.panelOpen && x.electronics === 2 && x.terminal && !!x.cell && !x.maint && !x.broken, 'closed, locked, whole, wired, with its cell and its board screwed down');
  ok(x.v === 0 && w.areas[x.areaIdx], 'and it shows its closed picture');
  ok(x.examine().join(' ') === 'The cover is closed. Alt-Click the APC to unlock the interface.', 'which is how it reads when examined');
  ok(x.rec.sv.length === APC_STATES.length && x.rec.sv.every((s) => s >= 0), 'every one of its pictures is in the level data');
});

section('the lock, the panel and the cover', () => {
  const { apcs, a, click, msgs, hold, stand, events, g } = round();
  const x = apcs[0];
  stand(x);
  a.access = new Set([11]);
  hold('/obj/item/card/id');
  click(x);
  ok(!x.locked && msgs().includes('You unlock the APC interface.'), 'an ID with engineering access unlocks the interface');
  click(x, { alt: true });
  ok(x.locked && msgs().includes('You lock the APC interface.'), 'and alt-click locks it again');
  a.access = new Set();
  click(x);
  ok(msgs().includes('Access denied.') && x.locked, 'with no access, "Access denied."');
  a.access = new Set([11]);
  hold('/obj/item/crowbar');
  click(x);
  ok(msgs().includes('The cover is locked and cannot be opened!') && x.opened === 0, 'a locked cover will not open');
  hold('/obj/item/screwdriver');
  click(x);
  ok(x.panelOpen && msgs().includes('The wires have been exposed.') && x.v === V('apcewires'), 'a screwdriver exposes the wires, and it shows');
  hold('/obj/item/crowbar');
  x.coverlocked = false;
  click(x);
  ok(msgs().includes('Exposed wires prevents you from opening it!') && x.opened === 0, 'which keep the cover from opening');
  hold('/obj/item/screwdriver');
  click(x);
  ok(!x.panelOpen && msgs().includes('The wires have been unexposed.'), 'and put away again');
  hold('/obj/item/crowbar');
  click(x);
  ok(x.opened === 1 && x.v === V('apc2'), 'unlocked, the crowbar opens the cover (a picture with a cell in it)');
  ok(events().some((e) => e.e === 'pv' && e.i === x.rec.idx && e.v === V('apc2') && e.g === g.id), 'and everyone is told');
  ok(x.examine().join(' ').startsWith('The cover is open and the power cell is installed.'), 'examined: "The cover is open and the power cell is installed."');
  click(x);
  ok(x.opened === 0 && x.coverlocked && x.v === 0, 'the crowbar shuts it, and shutting it locks it again');
});

section('the cover lock is on the console', () => {
  const { sim, A, apcs, g, a, step, inbox } = round();
  const x = apcs[0];
  a.access = new Set([11]);
  x.locked = false;
  inbox.length = 0;
  sim.terminals.open(A, 'apc', { machine: x, grid: g });
  step(0.2);
  const html = () => inbox.filter((m) => m.t === 'ev').flatMap((m) => m.list).filter((e) => e.e === 'term' && !e.close).pop();
  const k = html().buttons.findIndex((b) => b.l.startsWith('Cover lock'));
  ok(k >= 0 && /Cover lock +Engaged/.test(html().html), 'the console says the cover is locked');
  sim.handle(A, { t: 'term', op: 'act', idx: k });
  step(0.2);
  ok(x.coverlocked === false && /Disengaged/.test(html().html), 'and its button unlocks it');
});

section('the cell', () => {
  const { apcs, a, click, msgs, hold, empty, stand, tick, g } = round();
  const x = apcs[0];
  stand(x);
  x.coverlocked = false;
  hold('/obj/item/crowbar'); click(x);
  ok(x.opened === 1, 'the cover is open');
  const charge = x.cell.charge, cellPath = x.cell.path;
  empty();
  click(x);
  const cellItem = a.hands.find((h) => h && h.path === cellPath);
  ok(!!cellItem && cellItem.charge === charge && x.cell === null && x.v === V('apc1'), 'an empty hand takes the cell out (with the charge it had), and the picture is the empty one');
  ok(msgs().some((t) => /^You remove the .*power cell.*\.$/.test(t)), '"You remove the power cell."');
  tick(2);
  ok(!g.power.powered(x.areaIdx, CH.LIGHT) && !g.power.powered(x.areaIdx, CH.EQUIP) && x.alarm, 'with no cell the room goes dark');
  const other = hold('/obj/item/stock_parts/cell/high');
  other.charge = 1234;
  click(x);
  ok(x.cell && x.cell.charge === 1234 && x.cell.max === 10000 && x.cell.path === '/obj/item/stock_parts/cell/high' && msgs().includes('You insert the power cell.') && x.v === V('apc2'), 'a cell goes in with what it holds (and its own size)');
  tick(2);
  ok(g.power.powered(x.areaIdx, CH.LIGHT) && g.power.powered(x.areaIdx, CH.EQUIP), 'and the room has its power again');
  hold('/obj/item/stock_parts/cell');
  click(x);
  ok(msgs().includes('There is a power cell already installed!'), 'a second cell: "There is a power cell already installed!"');
  hold('/obj/item/screwdriver');
  click(x);
  ok(x.cell === null && msgs().some((t) => /^You remove the high-capacity power cell\.$/.test(t)), 'a screwdriver takes it out too');
});

section('taking an APC apart, and putting it up again', () => {
  const { sim, apcs, a, ps, click, clickAt, msgs, hold, empty, stand, tick, g, events } = round();
  const x = apcs[0];
  stand(x);
  x.coverlocked = false;
  hold('/obj/item/crowbar'); click(x);
  empty(); click(x);                                                          // (the cell comes out)
  ok(x.opened === 1 && x.cell === null, 'the cover is open and the cell is out');
  hold('/obj/item/screwdriver');
  click(x);
  ok(x.electronics === 1 && x.maint && msgs().includes('You unfasten the electronics.') && x.v === V('apcmaint'), 'a screwdriver unfastens the board (it needs maintenance: "apcmaint")');
  ok(x.examine().join(' ').startsWith('The cover is open and the power cell is missing.'), 'examined: the cover is open and the power cell is missing');
  hold('/obj/item/stock_parts/cell');
  click(x);
  ok(msgs().includes('There is no connector for your power cell!'), 'with the board loose there is no connector for a cell');
  hold('/obj/item/crowbar');
  click(x);
  ok(msgs().includes('Disconnect the wires first!') && x.electronics === 1, 'the board will not come out while it is wired');
  hold('/obj/item/wirecutters');
  click(x, { wait: 5.5 });
  ok(!x.terminal && msgs().includes('You cut the cables and dismantle the power terminal.'), 'wirecutters cut the terminal off (5 s)');
  const coils = floorItems(sim, '/obj/item/stack/cable_coil').reduce((n, f) => n + (f.item.amount ?? 1), 0);
  ok(coils === 10, `and ten lengths of cable come back (${coils})`);
  tick(2);
  ok(x.net === null, 'an APC with no terminal is on no network');
  hold('/obj/item/crowbar');
  click(x, { wait: 5.5 });
  ok(x.electronics === 0 && msgs().includes('You remove the power control board.') && floorItems(sim, '/obj/item/electronics/apc').length > 0, 'the crowbar takes the board out (5 s), and it lies on the floor');
  const wd = hold('/obj/item/weldingtool');
  wd.lit = true; wd.fuel = 20;
  click(x, { wait: 5.5 });
  ok(!x.frame && x.v === -1 && wd.fuel === 17 && msgs().includes('You cut the APC frame from the wall.') && floorItems(sim, '/obj/item/wallframe/apc').length === 1, 'a welder cuts the frame from the wall (5 s, 3 fuel) and it is an APC frame on the floor');
  ok(events().some((e) => e.e === 'pv' && e.i === x.rec.idx && e.v === -1), 'and the wall mount vanishes for everyone');
  tick(2);
  ok(!g.power.powered(x.areaIdx, CH.LIGHT) && !g.power.powered(x.areaIdx, CH.ENVIRON), 'its room has no power at all');
  const maintNote = x.examine();
  ok(maintNote.length === 0 || maintNote[0].startsWith('The cover'), 'a frame with nothing in it reads as one');
  // ---- and back up again
  const [fdx, fdz] = DV[x.rec.sd];
  const wall = { k: 'wall', g: g.id, c: x.c + fdx, r: x.r + fdz };
  const frame = floorItems(sim, '/obj/item/wallframe/apc')[0].item;
  detach(sim, frame);
  empty();
  attach(sim, frame, { t: 'hand', mob: a, i: a.active });
  clickAt(wall);
  ok(x.frame && x.opened === 1 && x.electronics === 0 && !x.terminal && !x.cell && !x.operating && msgs().includes('You attach the APC frame to the wall.') && x.v === V('apcmaint'), 'the frame goes back on the wall: cover open, no board, no wiring, no cell, its breaker off');
  ok(x.examine().join(' ').startsWith("It's not wired up. The electronics aren't installed."), 'examined: not wired up, no electronics');
  hold('/obj/item/wallframe/apc');
  clickAt(wall);
  ok(msgs().includes('This area already has an APC!'), 'a second frame: "This area already has an APC!"');
  hold('/obj/item/electronics/apc');
  click(x, { wait: 1.5 });
  ok(x.electronics === 1 && !x.locked && msgs().includes('You place the power control board inside the frame.'), 'a power control board goes in (1 s)');
  hold('/obj/item/stack/cable_coil', { amount: 12 });
  click(x, { wait: 2.5 });
  const coil = a.hands[a.active];
  ok(x.terminal && coil.amount === 2 && msgs().includes('You add cables to the APC frame.'), 'ten lengths of cable wire it up (2 s)');
  hold('/obj/item/screwdriver');
  click(x);
  ok(x.electronics === 2 && !x.maint && msgs().includes('You screw the circuit electronics into place.'), 'a screwdriver secures the board');
  const cell = hold('/obj/item/stock_parts/cell/upgraded');
  click(x);
  ok(!!x.cell && x.cell.charge === cellMax(cell.path) && x.v === V('apc2'), 'a cell goes in (a new one is full)');
  hold('/obj/item/crowbar');
  click(x);
  ok(x.opened === 0 && x.v === 0, 'the crowbar shuts the cover');
  tick(2);
  ok(!g.power.powered(x.areaIdx, CH.LIGHT), 'it is built, but its breaker is off: the room is still dark');
  a.access = new Set([11]);
  x.locked = false;
  x.operating = true; x.publish(true); ps.flush();
  tick(3);
  ok(x.main === 2 && g.power.powered(x.areaIdx, CH.LIGHT) && g.power.powered(x.areaIdx, CH.ENVIRON), 'with the breaker on it takes its power from the grid and the room is lit again');
  void ps;
});

section('a wrecked APC', () => {
  const { sim, apcs, a, ps, click, msgs, hold, stand, tick, g, events, step } = round();
  const x = apcs[1];
  stand(x);
  ok(x.setBroken() && x.broken && !x.operating && x.v === V('apc-b'), 'a wrecked APC shows its wrecked picture');
  ok(x.examine().length === 0, 'and has nothing to say for itself');
  tick(2);
  ok(!g.power.powered(x.areaIdx, CH.LIGHT) && !g.power.powered(x.areaIdx, CH.ENVIRON), 'its room goes dark');
  step(0.1);
  ok(events().some((e) => e.e === 'pv' && e.i === x.rec.idx && e.v === V('apc-b')), 'and everyone saw it');
  a.hands[a.active] && detach(sim, a.hands[a.active]);
  click(x);
  ok(!events().some((e) => e.e === 'term'), 'no console opens from it');
  x.opened = 1; x.touch();
  ok(x.v === V('apcmaint'), 'open, it shows "apcmaint"');
  hold('/obj/item/electronics/apc');
  click(x);
  ok(msgs().includes('There is already a board inside the APC!') || x.electronics === 2, 'it still has its board');
  hold('/obj/item/wallframe/apc');
  click(x);
  ok(msgs().includes('You cannot repair this APC until you remove the electronics still inside!'), 'a new frame will not go on until the old board is out');
  x.electronics = 0;
  hold('/obj/item/electronics/apc');
  click(x);
  ok(msgs().includes('You cannot put the board inside, the frame is damaged!'), 'and a board will not go into a damaged frame');
  hold('/obj/item/wallframe/apc');
  click(x, { wait: 5.5 });
  ok(!x.broken && msgs().includes('You replace the damaged APC frame with a new one.') && x.v === V('apcmaint'), 'a new APC frame replaces it (5 s)');
  hold('/obj/item/wallframe/apc');
  click(x);
  ok(msgs().includes('You found no reason for repairing this APC!'), 'a whole one needs no frame: "You found no reason for repairing this APC!"');
  x.opened = 2; x.touch();
  ok(x.v === V(x.cell ? 'apc2-nocover' : 'apc1-nocover'), 'with its cover knocked off it shows that');
  hold('/obj/item/wallframe/apc');
  click(x, { wait: 2.5 });
  ok(x.opened === 1 && msgs().includes("You replace missing APC's cover."), 'a frame puts the cover back (2 s)');
  void ps;
});

section('a blast wrecks the APCs it reaches', () => {
  const { sim, apcs, ps, w } = round();
  sim.rand = () => 0;
  const x = apcs[2];
  const far = apcs.find((y) => Math.hypot(y.c - x.c, y.r - x.r) > 8);
  const cut = ps.blast(x.c, x.r, 3);
  ok(x.broken && x.v === V('apc-b'), `an APC in the blast is wrecked (the blast also cut ${cut} cables)`);
  ok(!far.broken, 'one far away is not');
  void w;
});

section('cutting cable gives a coil of one', () => {
  const { sim, a, g, w, ps, click, clickAt, hold, stand, msgs, apcs } = round();
  void click; void apcs;
  // a bare cable tile with a free tile beside it
  let t = null;
  for (let i = 0; i < w.n && !t; i++) {
    if (w.cable[i] !== 1 || w.floorType(i)?.k !== 'plating' || w.solid[i]) continue;
    const c = i % w.W, r = Math.floor(i / w.W);
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = w.idx(c + dc, r + dr); if (!w.solid[j] && w.cable[j] !== 1 && !w.doorAt.has(j)) { t = { i, c, r, s: [c + dc, r + dr] }; break; } }
  }
  stand({ c: t.s[0], r: t.s[1] });
  ps.cables.net(t.i).avail = 0;
  hold('/obj/item/wirecutters');
  clickAt({ k: 'floor', g: g.id, c: t.c, r: t.r });
  const coils = floorItems(sim, '/obj/item/stack/cable_coil');
  ok(coils.length === 1 && (coils[0].item.amount ?? 1) === 1 && msgs().includes('You cut the cable.'), 'a cut cable leaves one length of cable, not a whole coil');
  void a;
});

section('the clients hear of it', () => {
  const { sim, A, apcs, g, a, tick, step } = round();
  const x = apcs[3];
  x.coverlocked = false;
  x.opened = 1; x.touch();
  const y = apcs[4];
  y.takeOffWall();
  tick(1);
  const late = [];
  sim.addClient('Bob', (m) => late.push(m));
  const welcome = late.find((m) => m.t === 'welcome');
  const gs = welcome.grids.find((q) => q.g === g.id);
  ok(gs.pv.some(([i, v]) => i === x.rec.idx && v === V('apc2')) && gs.pv.some(([i, v]) => i === y.rec.idx && v === -1), 'a joiner is told which APCs are open and which are gone');
  const rep = new Replica({ level: DATA.level, rects: DATA.rects }, { ...welcome, you: A.id });
  const rg = rep.grids.get(g.id);
  ok(rg.props.interact[x.rec.idx].pv === V('apc2') && rg.props.interact[y.rec.idx].pv === -1, 'the replica has them so');
  const inbox = [];
  A.send = (m) => inbox.push(m);
  void a; void step;
  const ev = { e: 'pv', g: g.id, i: x.rec.idx, v: V('apc1') };
  rep.apply(ev);
  ok(rg.props.interact[x.rec.idx].pv === V('apc1'), 'and applies a change');
});

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
