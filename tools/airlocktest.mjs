// Airlock panels and wires, bolts, power, shocks, welding and a crowbar: node tools/airlocktest.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSimData } from '../src/sim/load.js';
import { initPhysics } from '../src/shared/physics.js';
import { Sim } from '../src/sim/sim.js';
import { SIM_DT, TILE, KIND } from '../src/shared/config.js';
import { attach, detach } from '../src/sim/inventory.js';
import { WIRES, COLORS } from '../src/sim/airlocks.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = loadSimData(root);
await initPhysics();
let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) pass++; else { fail++; console.log('  FAIL:', name); } };
const section = (name, fn) => { console.log(name); fn(); };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function round() {
  const sim = new Sim(DATA, { bots: 0 });
  const inbox = [], last = {};
  const A = sim.addClient('Alice', (m) => { inbox.push(m); if (m.t === 'ev') for (const e of m.list) if (e.e === 'term' && !e.close) last.term = e; });
  sim.handle(A, { t: 'lobby', op: 'job', id: 'station_engineer' });
  sim.handle(A, { t: 'lobby', op: 'ready', v: true });
  sim.handle(A, { t: 'lobby', op: 'start' });
  const step = (sec) => { for (let k = 0; k < sec / SIM_DT; k++) sim.step(SIM_DT); };
  const g = sim.station, a = A.mob, w = g.world, al = sim.airlocks;
  a.invulnerable = true;
  const events = () => inbox.filter((m) => m.t === 'ev').flatMap((m) => m.list);
  const msgs = () => events().filter((e) => e.e === 'msg').map((e) => e.text);
  const empty = () => { if (a.hands[a.active]) detach(sim, a.hands[a.active]); };
  const hold = (p, extra = {}) => { empty(); const it = sim.newItem(p, extra); attach(sim, it, { t: 'hand', mob: a, i: a.active }); return it; };
  const clickAt = (target, o = {}) => { inbox.length = 0; a.cool = 0; a.busy = null; a.stunned = 0; sim.handle(A, { t: 'click', target, yaw: 0, pitch: 0, alt: !!o.alt }); step(o.wait ?? 0.1); };
  const click = (d, o) => clickAt({ k: 'door', g: g.id, idx: d.idx }, o);
  const term = () => last.term;
  const press = (label) => { const k = term().buttons.findIndex((b) => b.l === label); sim.handle(A, { t: 'term', op: 'act', idx: k }); step(0.1); return k; };
  /** A closed airlock with floor on both sides to stand on, and (if asked) with an access requirement. */
  const door = (needs) => {
    for (const d of g.doors) {
      if (d.state !== 'closed' || d.gone || !/airlock|door/i.test(d.name) || /fire|window/i.test(d.name)) continue;
      if (needs !== undefined && !!(d.a.length || d.o.length) !== needs) continue;
      for (const [dc, dr] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const c = d.c + dc, r = d.r + dr, i = w.idx(c, r);
        if (w.kind[i] === KIND.FLOOR && !w.solid[i] && !w.doorAt.has(i)) return { d, c, r };
      }
    }
    return null;
  };
  const stand = (c, r) => { a.grid = g; a.x = (c + 0.5) * TILE; a.z = (r + 0.5) * TILE; a.l = 0; a.vx = a.vz = 0; a.cool = 0; a.stunned = 0; a.access = new Set(a.access); };
  const wire = (name) => cap(al.colorOf.get(name));
  return { sim, A, a, g, w, al, inbox, step, events, msgs, empty, hold, clickAt, click, term, press, door, stand, wire };
}

section('the wires', () => {
  const { al } = round();
  ok(WIRES.length === 14 && al.colorOf.size === 16 && al.wireOf.size === 16, 'fourteen wires and two duds, each its own colour');
  ok(new Set([...al.colorOf.values()]).size === 16 && [...al.colorOf.values()].every((c) => COLORS.includes(c)), 'sixteen different colours');
});

section('the maintenance panel', () => {
  const { sim, a, al, step, msgs, hold, click, term, door, stand } = round();
  const { d, c, r } = door();
  stand(c, r);
  hold('/obj/item/screwdriver');
  click(d);
  ok(msgs().includes('You open the maintenance panel of the airlock.') && al.state(d).panel, 'a screwdriver opens it: "You open the maintenance panel of the airlock."');
  click(d);
  ok(msgs().includes('You close the maintenance panel of the airlock.') && !al.state(d).panel, 'and closes it');
  hold('/obj/item/wirecutters');
  click(d);
  ok(!term() || term().title !== `${d.name[0].toUpperCase()}${d.name.slice(1)} Wires`, 'wirecutters on a door with its panel shut do not open the wires');
  hold('/obj/item/screwdriver'); click(d);
  hold('/obj/item/wirecutters'); click(d);
  ok(term() && /Wires$/.test(term().title) && term().buttons.length === 32, 'with it open they show the wires: sixteen colours, cut and pulse');
  ok(term().html.includes('The door bolts look up.') && term().html.includes('The test light is on.') && term().html.includes('The AI connection light is on.') && term().html.includes('The check wiring light is off.') && term().html.includes('The timer is powered on.') && term().html.includes('The speed light is on.') && term().html.includes('The emergency light is off.'), 'and the status lights');
  void sim; void a; void step;
});

section('cutting and pulsing needs the right tool', () => {
  const { sim, a, al, msgs, hold, click, press, door, stand, wire } = round();
  const { d, c, r } = door();
  stand(c, r);
  hold('/obj/item/screwdriver'); click(d);
  hold('/obj/item/wirecutters'); click(d);
  hold('/obj/item/crowbar');
  press(`${wire('bolts')}: Cut`);
  ok(msgs().includes('You need wirecutters!') && !d.bolted, 'with the wrong thing in your hand: "You need wirecutters!"');
  press(`${wire('bolts')}: Pulse`);
  ok(msgs().includes('You need a multitool!'), '"You need a multitool!"');
  hold('/obj/item/wirecutters');
  press(`${wire('bolts')}: Cut`);
  ok(d.bolted && al.isCut(d, 'bolts'), 'wirecutters cut the bolts wire: the bolts fall');
  hold('/obj/item/multitool');
  press(`${wire('bolts')}: Pulse`);
  ok(d.bolted, 'a cut wire cannot be pulsed');
  hold('/obj/item/wirecutters');
  press(`${wire('bolts')}: Mend`);
  ok(d.bolted && !al.isCut(d, 'bolts'), 'mending it does not raise them');
  hold('/obj/item/multitool');
  press(`${wire('bolts')}: Pulse`);
  ok(!d.bolted, 'pulsing it raises them (the door has power)');
  press(`${wire('bolts')}: Pulse`);
  ok(d.bolted, 'and drops them again');
  void sim; void a;
});

section('power', () => {
  const { sim, a, g, al, step, msgs, hold, click, press, door, stand, wire } = round();
  const { d, c, r } = door(false);
  stand(c, r);
  hold('/obj/item/screwdriver'); click(d);
  hold('/obj/item/wirecutters'); click(d);
  ok(al.hasPower(d), 'the door has power');
  hold('/obj/item/multitool');
  press(`${wire('power1')}: Pulse`);
  const s = al.state(d);
  ok(s.mainLost > 59 && s.mainLost <= 60 && s.backupLost > 9 && s.backupLost <= 10 && !al.hasPower(d), 'a pulse on a power wire: it loses its main power for a minute (the backup for ten seconds)');
  step(10.5);
  ok(s.backupLost <= 0 && al.hasPower(d), 'the backup comes back first, and the door runs on it');
  step(50);
  ok(s.mainLost <= 0.1 && al.hasPower(d), 'the main power is back after a minute');
  hold('/obj/item/wirecutters');
  press(`${wire('power1')}: Cut`);
  press(`${wire('backup1')}: Cut`);
  const mid = s.mainLost;
  ok(!al.hasPower(d) && mid > 59 && s.backupLost > 59, 'cut a power wire and a backup wire: no power');
  step(30);
  ok(s.mainLost >= mid - 0.2 && s.backupLost > 59, 'it does not come back while they are cut');
  hold('/obj/item/crowbar'); a.intent = 'help'; click(d);
  ok(d.state === 'opening' || d.state === 'open', 'a crowbar then opens it by hand');
  void sim; void g; void a; void msgs;
});

section('a door with no power', () => {
  const { sim, a, al, msgs, hold, click, door, stand } = round();
  const { d, c, r } = door(false);
  stand(c, r);
  hold('/obj/item/crowbar');
  click(d);
  ok(msgs().includes("The airlock's motors resist your efforts to force it!") && d.state === 'closed', 'with power a crowbar does nothing: "The airlock\'s motors resist your efforts to force it!"');
  al.loseMain(d); al.loseBackup(d);
  ok(!al.hasPower(d), 'the power is gone');
  d.bolted = true;
  click(d);
  ok(msgs().includes("The airlock's bolts prevent it from being forced!") && d.state === 'closed', 'bolted: "The airlock\'s bolts prevent it from being forced!"');
  d.bolted = false; d.welded = true;
  click(d);
  ok(msgs().includes("It's welded, it won't budge!") && d.state === 'closed', 'welded: "It\'s welded, it won\'t budge!"');
  d.welded = false;
  click(d);
  ok(d.state === 'opening' || d.state === 'open', 'otherwise a crowbar forces it open at once');
  void sim;
});

section('welding a door shut', () => {
  const { sim, a, step, msgs, hold, click, door, stand } = round();
  const { d, c, r } = door();
  stand(c, r);
  const welder = hold('/obj/item/weldingtool');
  a.intent = 'harm';
  click(d);
  ok(!d.welded, 'a cold welder does nothing');
  ok(msgs().includes('The welding tool has to be on to complete this task!') || msgs().some((t) => /has to be on/.test(t)), 'it has to be on');
  welder.lit = true; a.intent = 'help';
  click(d);
  ok(msgs().includes("The airlock doesn't need repairing.") && !d.welded, 'in help intent a welder is for repairs: "The airlock doesn\'t need repairing."');
  a.intent = 'harm';
  click(d, { wait: 0.3 });
  ok(msgs().includes('You begin welding the airlock...') && !d.welded, 'in any other intent it welds: "You begin welding the airlock..."');
  step(4.3);
  ok(d.welded && msgs().includes('You weld the airlock shut.'), 'after four seconds: "You weld the airlock shut."');
  a.access = new Set([...Array(100).keys()]);
  click(d);
  ok(d.state === 'closed', 'a welded door does not open');
  click(d, { wait: 0.3 });
  ok(msgs().includes('You begin unwelding the airlock...'), 'and the welder takes it off');
  step(4.3);
  ok(!d.welded && msgs().includes('You unweld the airlock.'), '"You unweld the airlock."');
  void sim;
});

section('shocks', () => {
  const { sim, a, g, al, step, hold, click, press, door, stand, wire, msgs } = round();
  const { d, c, r } = door();
  stand(c, r);
  const apc = g.powersim.apcOf(g.world.areaIdx[d.i]);
  ok(!!apc?.net, 'the room\'s APC is on a network');
  apc.net.avail = Math.max(apc.net.avail, 80000);
  hold('/obj/item/screwdriver'); click(d);
  hold('/obj/item/wirecutters'); click(d);
  const hp0 = a.body.health;
  a.invulnerable = false; a.body.god = false;
  press(`${wire('shock')}: Cut`);
  ok(al.electrified(d) && al.state(d).electrified === -1, 'cutting the shock wire electrifies the door for good');
  if (a.hands[a.active]) detach(sim, a.hands[a.active]);
  a.stunned = 0; step(1.1);
  const hp1 = a.body.health;
  click(d);
  ok(a.body.health < hp1 && a.stunned > 0 && d.state === 'closed', 'a bare hand on it is shocked for certain (and it does not open)');
  void hp0;
  hold('/obj/item/crowbar'); a.intent = 'help'; a.stunned = 0; step(1.1);
  al.state(d).electrified = 0;
  click(d);
  ok(!al.electrified(d) && msgs().includes("The airlock's motors resist your efforts to force it!"), 'mended it is only a door');
  void g;
});

section('the door at work', () => {
  const { sim, a, g, al, step, hold, click, press, door, stand, wire, msgs } = round();
  const { d, c, r } = door(true);
  a.access = new Set();
  stand(c, r);
  hold('/obj/item/screwdriver'); click(d);
  hold('/obj/item/multitool');
  click(d);
  hold('/obj/item/wirecutters'); click(d);
  hold('/obj/item/multitool');
  press(`${wire('open')}: Pulse`);
  ok(d.state === 'closed', 'a pulse on the open wire does not open a door that wants an ID');
  hold('/obj/item/wirecutters');
  press(`${wire('idscan')}: Cut`);
  ok(d.noId && d.allows(a), 'cut the ID scanner wire and anyone may go through');
  hold('/obj/item/multitool');
  press(`${wire('open')}: Pulse`);
  ok(d.state === 'opening' || d.state === 'open', 'then the open wire opens it');
  step(1);
  hold('/obj/item/wirecutters');
  press(`${wire('timing')}: Cut`);
  ok(!al.state(d).autoclose && al.holdTime(d) === null, 'cutting the timing wire stops it shutting by itself');
  step(10);
  ok(d.state === 'open', 'it stays open');
  hold('/obj/item/multitool');
  press(`${wire('timing')}: Pulse`);
  ok(al.state(d).normalspeed === true, 'a pulse on the timing wire does nothing while it is cut');
  hold('/obj/item/wirecutters');
  press(`${wire('timing')}: Mend`);
  step(5);
  ok(d.state === 'closed' || d.state === 'closing', 'mended, it closes');
  step(1);
  // the safeties: cut them and it crushes
  hold('/obj/item/wirecutters');
  press(`${wire('safety')}: Cut`);
  ok(!al.state(d).safe, 'the safety wire cut: the check wiring light is on');
  void sim; void g; void msgs;
});

section('a door that crushes', () => {
  const { sim, a, g, al, step, door, stand } = round();
  const { d } = door();
  a.invulnerable = false; a.body.god = false;
  al.state(d).safe = false;
  sim.openDoor(d, null, true);
  step(1.5);
  ok(d.state === 'open', 'open');
  a.grid = g; a.x = d.x; a.z = d.z; a.l = d.l | 0; a.vx = a.vz = 0;
  const hp0 = a.body.health;
  sim.closeDoor(d);
  step(1.5);
  ok(a.body.health <= hp0 - 14 && a.stunned > 5, 'a door with its safeties cut closes on someone: 15 damage and ten seconds on the floor');
  void stand;
});

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
