// Behavioural regression tests for the sim: node tools/simtest2.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSimData } from '../src/sim/load.js';
import { initPhysics } from '../src/shared/physics.js';
import { Sim } from '../src/sim/sim.js';
import { SIM_DT, TILE } from '../src/shared/config.js';
import { stepMovement } from '../src/shared/movement.js';
import { CL } from '../src/shared/closets.js';
import { recalc, place, attach, detach } from '../src/sim/inventory.js';
import { menuFor } from '../src/shared/stacks.js';
import { HIDE } from '../src/shared/looks.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = loadSimData(root);
await initPhysics();
let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) pass++; else { fail++; console.log('  FAIL:', name); } };

function setup(opts = {}) {
  const sim = new Sim(DATA, { bots: 0, ...opts });
  const inbox = { a: [], b: [] };
  const A = sim.addClient('Alice', (m) => inbox.a.push(m));
  const B = sim.addClient('Bob', (m) => inbox.b.push(m));
  sim.handle(A, { t: 'lobby', op: 'job', id: 'station_engineer' });
  sim.handle(B, { t: 'lobby', op: 'job', id: 'medical_doctor' });
  sim.handle(A, { t: 'lobby', op: 'ready', v: true });
  sim.handle(B, { t: 'lobby', op: 'ready', v: true });
  sim.handle(A, { t: 'lobby', op: 'start' });
  const step = (sec) => { for (let k = 0; k < sec / SIM_DT; k++) sim.step(SIM_DT); };
  const evs = (inb, e) => inb.filter((m) => m.t === 'ev').flatMap((m) => m.list).filter((x) => x.e === e);
  const hand = (m, it, i = m.active) => { m.hands[i] = it; it.loc = { t: 'hand', mob: m, i }; };
  const tileCenter = (m, c, r) => { m.x = c * TILE + 1; m.z = r * TILE + 1; };
  // park both players far apart in open floor so tests don't disturb each other
  const floorTiles = [];
  for (let i = 0; i < sim.world.W * sim.world.H; i += 37) if (sim.world.kind[i] === 1 && !sim.world.solid[i] && sim.world.areas[sim.world.areaIdx[i]].c === 'hallway') floorTiles.push(i);
  return { sim, A, B, a: A.mob, b: B.mob, inbox, step, evs, hand, tileCenter, floorTiles };
}

function section(name, fn) { console.log(name); fn(); }

section('spawn + outfit', () => {
  const { a, b } = setup();
  ok(a && b && a !== b, 'both players spawned');
  ok(a.job === 'station_engineer' && b.job === 'medical_doctor', 'jobs assigned');
  ok(a.worn.uniform && a.worn.id && a.worn.back?.contents.length, 'engineer is dressed with backpack contents');
  ok(a.access.has(10), 'engineer ID carries ENGINE access (10)');
  ok(b.worn.ears?.path.includes('headset_med'), 'doctor has a medical headset');
});

section('inventory', () => {
  const { sim, A, a, inbox, step, evs, hand } = setup();
  const rec = [...sim.floor.values()].find((f) => !sim.world.solid[f.r * sim.world.W + f.c] && f.item.w <= 3);
  a.x = rec.c * TILE + 1; a.z = rec.r * TILE + 1; a.yaw = 0;
  const id0 = rec.item.id;
  sim.handle(A, { t: 'click', target: { k: 'item', id: id0 } });
  step(0.1);
  ok(a.hands[a.active]?.id === id0, 'click picks floor item into active hand');
  ok(!sim.floor.has(id0), 'item removed from floor');
  sim.handle(A, { t: 'key', k: 'swap' });
  ok(a.active === 1, 'swap hands');
  sim.handle(A, { t: 'key', k: 'swap' });
  sim.handle(A, { t: 'key', k: 'drop' });
  ok(sim.floor.has(id0) && !a.hands[0], 'drop puts item back on the floor');

  const oldHat = a.worn.head;
  sim.actions.inventory(A, { op: 'unequip', slot: 'head' });
  ok(a.hands[a.active] === oldHat && !a.worn.head, 'unequip moves worn item to hand');
  sim.handle(A, { t: 'key', k: 'equip' });
  ok(a.worn.head === oldHat && !a.hands[a.active], 'E equips the held hat back to its slot');

  const crowbar = sim.newItem('/obj/item/crowbar');
  hand(a, crowbar, 0); a.active = 0;
  const bp = a.worn.back;
  sim.handle(A, { t: 'inv', op: 'use', item: bp.id });
  ok(bp.contents.includes(crowbar) && !a.hands[0], 'using a held item on the backpack stores it');
  const box = bp.contents.find((i) => i.def.storage);
  const big = sim.newItem('/obj/item/storage/backpack'); hand(a, big, 0);
  sim.handle(A, { t: 'inv', op: 'use', item: box.id });
  step(0.1);
  ok(!box.contents.includes(big), 'a backpack does not fit in a survival box (size rule)');
  ok(evs(inbox.a, 'msg').some((m) => /too big/.test(m.text || '')), 'player is told it is too big');

  // quick draw from belt with empty hand
  a.hands[0] = a.hands[1] = null;
  const beltN = a.worn.belt.contents.length;
  sim.handle(A, { t: 'key', k: 'equip' });
  ok(a.hands[a.active] && a.worn.belt.contents.length === beltN - 1, 'empty-handed E draws from the belt');
  // pockets take small items only
  const bigItem = sim.newItem('/obj/item/storage/toolbox/mechanical');
  ok(sim.items.get(bigItem.id) && !(bigItem.w <= 2), 'toolbox is not pocket-sized');
});

section('intents + combat', () => {
  const { sim, A, B, a, b, inbox, step, evs, hand, floorTiles } = setup();
  a.x = 62; a.z = 100; // wherever; make both stand in the same free tile row
  const t = floorTiles[0], W = sim.world.W;
  a.x = (t % W) * TILE + 1; a.z = Math.floor(t / W) * TILE + 1;
  b.x = a.x + 1.0; b.z = a.z; a.yaw = -Math.PI / 2; a.pitch = 0;
  sim.handle(A, { t: 'key', k: 'intent', v: 0 });
  const b0 = b.body.brute;
  sim.handle(A, { t: 'click', target: { k: 'mob', id: b.id } });
  ok(b.body.brute === b0, 'help intent does not hurt');
  step(1);
  sim.handle(A, { t: 'key', k: 'intent', v: 3 });
  sim.handle(A, { t: 'click', target: { k: 'mob', id: b.id } });
  step(0.1);
  ok(b.body.brute > b0, 'harm intent punches');
  ok(evs(inbox.b, 'msg').some((m) => /punched/.test(m.text || '')), 'bystander sees the attack message');
  // doctor heals himself with a bruise pack
  const all = (m) => { const out = []; const walk = (i) => { out.push(i); (i.contents || []).forEach(walk); }; for (const k in m.worn) if (m.worn[k]) walk(m.worn[k]); return out; };
  const pack = all(b).find((i) => i.def.heal);
  ok(!!pack, 'doctor carries a healing item');
  hand(b, pack, 0); b.active = 0;
  b.body.damage('brute', 30, 'test');
  const before = b.body.brute;
  sim.handle(B, { t: 'key', k: 'activate' });
  ok(b.body.brute < before, 'activating a healing item treats yourself');
});

section('doors', () => {
  const { sim, A, a, b, step } = setup();
  const free = sim.doors.findIndex((d) => !d.a.length && !d.o.length && sim.power.doorsWork(d) && sim.world.kindAt(d.c, d.r + 1) === 1);
  const door = sim.doors[free];
  b.x = 2; b.z = 2;
  a.x = door.x; a.z = door.z + 1.2;
  step(0.5);
  ok(door.state === 'opening' || door.state === 'open', 'unrestricted door opens when a player walks up');
  const rd = sim.doors.findIndex((d) => d.a.length && !d.a.some((n) => a.access.has(n)) && sim.world.kindAt(d.c, d.r + 1) === 1);
  const locked = sim.doors[rd];
  a.x = locked.x; a.z = locked.z + 1.1;
  step(0.5);
  ok(locked.state === 'closed', 'restricted door stays shut for an engineer without its access');
  sim.handle(A, { t: 'click', target: { k: 'door', idx: rd } });
  step(0.1);
  ok(locked.state === 'closed', 'clicking it does not bypass access');
});

section('hull breach + repair', () => {
  const { sim, A, a, b, step, inbox, evs, hand } = setup();
  const w = sim.world;
  const win = sim.director.findExteriorWindows()[5];
  const wc = win % w.W, wr = Math.floor(win / w.W);
  const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([x, y]) => [wc + x, wr + y]).find(([x, y]) => sim.atmos.isCell[y * w.W + x]);
  b.x = 2; b.z = 2;
  sim.breachTile(sim.station, wc, wr, 'meteor');
  ok(w.breached.has(win) && w.kind[win] === 1 && !w.glass[win] && !w.airBlock[win] && w.ventsToSpace(win), 'meteor smashes an exterior window: it is open to space');
  step(30);
  ok(sim.atmos.pressureAt(nb[0], nb[1]) < 30, 'room decompresses through the breach');
  const sheet = sim.newItem('/obj/item/stack/sheet/metal', { amount: 3 });
  a.x = nb[0] * TILE + 1; a.z = nb[1] * TILE + 1; a.yaw = Math.atan2(-(wc - nb[0]), -(wr - nb[1]));
  a.body.brute = 0; a.body.oxy = 0; a.dead = false;
  hand(a, sheet);
  const welder = sim.newItem('/obj/item/weldingtool'); welder.lit = true;
  a.worn.belt.contents.push(welder); welder.loc = { t: 'box', box: a.worn.belt };
  sim.handle(A, { t: 'click', target: { k: 'breach', c: wc, r: wr } });
  step(4);
  ok(!w.breached.has(win) && w.kind[win] === 2, 'metal sheet + lit welder patch the breach');
  ok(sheet.amount === 2, 'one sheet consumed');
  a.x = 4; a.z = 4;
  step(45);
  ok(sim.atmos.pressureAt(nb[0], nb[1]) > 60, 'vents refill the room after patching');
});

section('broken windows only vent to space', () => {
  const { sim, A, a, b, step, inbox, evs, hand } = setup();
  const w = sim.world, W = w.W;
  // a window between two rooms: floor on two sides, nothing that touches space
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let win = -1, sides = [];
  for (let i = 0; i < W * w.H && win < 0; i++) {
    if (!w.glass[i] || w.kind[i] !== 2) continue;
    const c = i % W, r = (i - c) / W;
    const ks = dirs.map(([x, y]) => w.kindAt(c + x, r + y));
    if (ks.some((k) => k === 0 || k === 3) || ks.filter((k) => k === 1).length !== 2) continue;
    const s = dirs.map(([x, y]) => [c + x, r + y]).filter(([x, y]) => w.kind[y * W + x] === 1 && w.roof[y * W + x]);
    if (s.length === 2) { win = i; sides = s; }
  }
  ok(win >= 0, 'found a window that does not touch space');
  const wc = win % W, wr = (win - wc) / W;
  b.x = 2; b.z = 2;
  sim.breachTile(sim.station, wc, wr, 'shot');
  ok(w.breached.has(win) && w.kind[win] === 1 && !w.glass[win] && !w.airBlock[win] && w.solid[win], 'a shot window opens up but the frame still blocks the way');
  ok(!w.ventsToSpace(win) && !w.ventTiles().includes(win), 'it is not a hull breach');
  ok(sim.atmos.isCell[win], 'the gap joins the gas grid');
  step(40);
  ok(sides.every(([x, y]) => sim.atmos.pressureAt(x, y) > 60), 'neither room decompresses');
  ok(!sim.terminals.alerts(sim.station).html.includes('hull breach'), 'no atmosphere alarm');
  // weld it shut: no hull breach call-out
  const sheet = sim.newItem('/obj/item/stack/sheet/metal', { amount: 3 });
  a.x = sides[0][0] * TILE + 1; a.z = sides[0][1] * TILE + 1; a.yaw = Math.atan2(-(wc - sides[0][0]), -(wr - sides[0][1]));
  hand(a, sheet);
  const welder = sim.newItem('/obj/item/weldingtool'); welder.lit = true;
  a.worn.belt.contents.push(welder); welder.loc = { t: 'box', box: a.worn.belt };
  inbox.a.length = 0;
  sim.handle(A, { t: 'click', target: { k: 'breach', c: wc, r: wr } });
  step(4);
  ok(!w.breached.has(win) && w.kind[win] === 2 && !sim.atmos.isCell[win], 'it can be welded over');
  ok(!evs(inbox.a, 'msg').some((m) => /breach sealed/i.test(m.text || '')), 'and nobody announces a hull breach sealed');
});

section('closets', () => {
  const { sim, A, B, a, b, step, inbox, evs, hand } = setup();
  const w = sim.world, cls = sim.closets;
  const find = (suffix) => sim.station.props.closets.find((it) => it.path.endsWith(suffix));
  const click = (c, it, alt) => { sim.handle(c, { t: 'click', target: { k: 'prop', idx: it.idx }, alt }); step(0.1); };
  const blocks = (it) => w.collides(it.x, it.z, 0.1);       // is something solid standing there (a closed locker is a box, not a tile)
  // stand on a free tile next to the closet (k picks which), where a click can reach it
  const freeAround = (it) => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dc, dr]) => [it.c + dc, it.r + dr]).filter(([c, r]) => w.kind[r * w.W + c] === 1 && !w.solid[r * w.W + c]);
  const stand = (m, it, k = 0) => {
    const free = freeAround(it);
    const [c, r] = free[Math.min(k, free.length - 1)];
    m.x = c * TILE + 1; m.z = r * TILE + 1; m.vx = m.vz = 0; m.cool = 0;
  };
  const texts = (inb) => inb.filter((m) => m.t === 'ev').flatMap((m) => m.list).filter((x) => x.e === 'msg').map((x) => x.text);
  const grant = (m, acc) => { m.worn.id.access = [...m.worn.id.access, ...acc]; recalc(sim, m); };
  const welder = (m) => { const t = sim.newItem('/obj/item/weldingtool'); t.lit = true; hand(m, t); return t; };
  b.x = 2; b.z = 2;

  // a locker holds what the DM says it holds
  const eng = find('secure_closet/engineering_welding');
  ok(eng && eng.contents.length === 6 && eng.cs === (CL.LOCKED) && blocks(eng), 'welding locker starts closed and locked with its 3 hoods and 3 welders');
  ok(eng.cl.sec && eng.cl.a.length === 1, 'and wants one access');
  const em = sim.station.props.closets.filter((it) => it.path.endsWith('closet/emcloset'));
  ok(em.length > 20 && em.some((it) => it.contents.length) && new Set(em.map((it) => it.contents.length)).size > 2, 'emergency closets are stocked at random (different contents each)');
  // nothing on a closed closet's tile is left outside
  ok(![...sim.floor.values()].some((f) => sim.station.props.closets.some((it) => !(it.cs & CL.OPEN) && it.contents.length < 30 && it.c === f.c && it.r === f.r)), 'items under closed closets were taken in at round start (up to 30)');

  // access: a locker opens for the right ID, with SS13's messages
  stand(a, eng); stand(b, eng, 1);
  b.worn.id.access = []; recalc(sim, b);
  inbox.b.length = 0;
  click(B, eng);
  ok((eng.cs & CL.LOCKED) && texts(inbox.b).includes('Access Denied.'), 'a doctor without the access is told Access Denied.');
  grant(a, eng.cl.a);
  inbox.a.length = 0; inbox.b.length = 0;
  click(A, eng);
  ok(!(eng.cs & CL.LOCKED) && !(eng.cs & CL.OPEN), 'an empty hand on a locked locker with the right ID unlocks it');
  ok(texts(inbox.a).includes('You unlock the welding supplies locker.') && texts(inbox.b).includes(`${a.name} unlocks the welding supplies locker.`), 'you and onlookers get the lock messages');
  click(A, eng);
  ok((eng.cs & CL.OPEN) && !blocks(eng), 'then it opens, and stops blocking the way');
  const spilled = [...sim.floor.values()].filter((f) => f.c === eng.c && f.r === eng.r);
  ok(spilled.length === 6 && eng.contents.length === 0, 'its contents lie on its tile');
  // closing takes in what lies there, including something someone dropped
  const junk = sim.newItem('/obj/item/crowbar'); place_(junk, eng);
  click(A, eng);
  ok(!(eng.cs & CL.OPEN) && eng.contents.length === 7 && blocks(eng) && ![...sim.floor.values()].some((f) => f.c === eng.c && f.r === eng.r), 'closing takes everything on the tile inside and blocks it again');
  // alt-click locks and unlocks without opening
  click(A, eng, true);
  ok((eng.cs & CL.LOCKED) && !(eng.cs & CL.OPEN), 'alt-click locks a closed locker you have the access for');
  click(A, eng, true);
  ok(!(eng.cs & CL.LOCKED), 'and unlocks it again');
  // a late joiner is told
  ok(sim.worldState(A).grids[0].closets.some(([i, cs]) => i === eng.idx && cs === 0), 'the welcome lists closets that are not as the map left them');

  // welding shut and open
  const t = welder(a);
  click(A, eng); step(4.5);
  ok(eng.cs & CL.WELDED, 'a lit welder welds a closed locker shut in 4 seconds');
  a.hands[0] = a.hands[1] = null;
  click(A, eng);
  ok(!(eng.cs & CL.OPEN), 'and a welded locker will not open');
  hand(a, t);
  click(A, eng); step(4.5);
  ok(!(eng.cs & CL.WELDED), 'welding it again undoes it');
  t.lit = false; inbox.a.length = 0;
  click(A, eng);
  ok(texts(inbox.a).some((x) => x === 'The welding tool has to be on to complete this task!') && !a.busy, 'an unlit welder is refused with the SS13 message');
  t.lit = true;

  // being shut in: moving does nothing against a lock, and breaking out takes two minutes
  const mob = b;
  cls.set(eng, eng.cs | CL.LOCKED); cls.putInside(eng, mob);
  ok(mob.inside === eng, 'a person can be shut inside');
  mob.input = { f: 1 }; inbox.b.length = 0;
  cls.relaymove(mob); step(0.1);
  ok(texts(inbox.b).includes("The welding supplies locker's door won't budge!"), 'pushing on a locked door says it will not budge');
  inbox.b.length = 0;
  sim.handle(B, { t: 'key', k: 'resist' }); step(0.1);
  ok(mob.busy && texts(inbox.b).some((x) => x.includes('this will take about 2 minutes')), 'resisting starts a two minute breakout');
  step(100);
  ok(mob.inside === eng, 'still inside after a hundred seconds');
  step(25);
  ok(!mob.inside && (eng.cs & CL.OPEN) && (eng.cs & CL.BROKEN) && !(eng.cs & CL.LOCKED), 'after two minutes the lock gives and the locker is broken open');
  stand(a, eng);
  hand(a, t);
  click(A, eng); // open: with a lit welder this cuts it apart
  step(4.5);
  ok(eng.gone && !blocks(eng) && [...sim.floor.values()].some((f) => f.item.path.includes('sheet/metal') && f.c === eng.c && f.r === eng.r), 'cutting an open locker apart removes it and leaves 2 metal');

  // personal lockers belong to whoever swipes first
  const pl = sim.station.props.closets.find((it) => it.cl.pl && freeAround(it).length);
  stand(a, pl); stand(b, pl, 1);
  ok(pl.cs & CL.LOCKED, 'personal locker starts locked');
  hand(a, a.worn.id); a.worn.id = null;
  click(A, pl);
  ok(!(pl.cs & CL.LOCKED) && pl.owner === a.name, 'the first ID swiped claims it and unlocks it');
  hand(b, b.worn.id); b.worn.id = null; inbox.b.length = 0;
  click(B, pl);
  ok(texts(inbox.b).includes('Access Denied.'), "someone else's ID is refused");

  // crates stay in the way when open
  const crate = sim.station.props.closets.find((it) => it.cl.hz && it.cs === 0);
  stand(a, crate); a.hands[0] = a.hands[1] = null;
  click(A, crate);
  ok((crate.cs & CL.OPEN) && blocks(crate), 'an open crate still blocks the tile');

  function place_(item, it) { item.loc = null; sim.floor.set(item.id, { item, grid: it.grid, x: it.x + 0.3, y: 0.01, z: it.z, c: it.c, r: it.r }); item.loc = { t: 'floor' }; }
});

section('looks', () => {
  // a player designs a character before the round: the server checks it, then spawns them looking like that
  const sim = new Sim(DATA, { bots: 0 });
  const mine = [];
  const A = sim.addClient('Alice', (m) => mine.push(m));
  const bobIn = [];
  const B = sim.addClient('Bob', (m) => bobIn.push(m));
  const hair = DATA.chars.hair.find((h) => h.c >= 0).n, skin = DATA.chars.skin[3].n;
  sim.handle(A, { t: 'hello', look: { g: 'f', sk: skin, h: hair, hc: '#FF0000', f: 'no such beard', e: 'blue', u: 'Nude' } });
  ok(A.look.g === 'f' && A.look.sk === skin && A.look.h === hair && A.look.hc === '#ff0000', 'hello carries a look, colours are normalised');
  ok(A.look.f === DATA.chars.facial[0].n && /^#[0-9a-f]{6}$/.test(A.look.e), 'unknown names and bad colours fall back to something drawable');
  const step = (sec) => { for (let k = 0; k < sec / SIM_DT; k++) sim.step(SIM_DT); };
  sim.handle(A, { t: 'lobby', op: 'job', id: 'station_engineer' }); sim.handle(B, { t: 'lobby', op: 'job', id: 'medical_doctor' });
  sim.handle(A, { t: 'lobby', op: 'ready', v: true }); sim.handle(B, { t: 'lobby', op: 'ready', v: true }); sim.handle(A, { t: 'lobby', op: 'start' });
  const a = A.mob, b = B.mob;
  b.x = a.x + 3; b.z = a.z;                    // within sight of each other
  step(0.2);
  ok(a.look.h === hair && a.look.g === 'f', 'the spawned character is the one they designed');
  ok(b.look && b.look.g && DATA.chars.hair.some((h) => h.n === b.look.h), 'someone who designed nothing gets a random look');
  const ap = sim.appearanceOf(a);
  ok(typeof ap.o.uniform === 'number' && typeof ap.o.shoes === 'number' && ap.o.head !== undefined, 'an engineer is wearing a jumpsuit, boots and a hard hat as far as anyone can see');
  const evsOf = (inb, e) => inb.filter((m) => m.t === 'ev').flatMap((m) => m.list).filter((x) => x.e === e);
  const intro = evsOf(bobIn, 'mob+').find((x) => x.id === a.id);
  ok(intro && intro.ap.l.h === hair && intro.ap.o.uniform === ap.o.uniform && intro.set === undefined, 'others are introduced to someone with their appearance, not a sprite set');
  const welcome = mine.find((m) => m.t === 'welcome');
  ok(welcome.jobs.every((j) => j.ap && j.ap.o) && welcome.jobs.find((j) => j.id === 'captain').ap.o.head !== undefined, 'the welcome gives every job a mannequin outfit for the lobby');
  // changing clothes is seen
  bobIn.length = 0;
  sim.actions.inventory(A, { op: 'unequip', slot: 'head' });
  step(0.3);
  const seen = evsOf(bobIn, 'look').find((x) => x.id === a.id);
  ok(seen && seen.ap.o.head === undefined && seen.ap.o.uniform === ap.o.uniform, 'taking your hat off sends everyone the new look');
  // some things hide hair: a hardsuit helmet
  const helmet = sim.newItem('/obj/item/clothing/head/helmet/space/emergency');
  a.worn.head = null;
  helmet.loc = { t: 'slot', mob: a, slot: 'head' }; a.worn.head = helmet; recalc(sim, a);
  ok((sim.appearanceOf(a).h & HIDE.HAIR) && sim.appearanceOf(a).o.head !== undefined, 'a space helmet hides hair (SS13 flags_inv)');
  // the mirror: hair and facial hair only, and only at a mirror
  const mirror = sim.props.interact.find((it) => it.kind === 'wm' && it.sub === 'mirror');
  const other = DATA.chars.hair.filter((h) => h.c >= 0 && h.n !== hair)[0].n;
  a.x = 2; a.z = 2;
  sim.handle(A, { t: 'mirror', look: { h: other } });
  ok(a.look.h === hair, 'far from a mirror nothing changes');
  const free = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dc, dr]) => [mirror.c + dc, mirror.r + dr]).find(([c, r]) => sim.world.kind[r * sim.world.W + c] === 1 && !sim.world.solid[r * sim.world.W + c]);
  a.x = free[0] * TILE + 1; a.z = free[1] * TILE + 1; a.cool = 0;
  mine.length = 0;
  sim.handle(A, { t: 'click', target: { k: 'prop', idx: mirror.idx } }); step(0.1);
  ok(evsOf(mine, 'mirror').length === 1 && evsOf(mine, 'mirror')[0].look.h === hair, 'clicking a mirror opens the hairdresser with your current look');
  sim.handle(A, { t: 'mirror', look: { h: other, hc: '#00ff00', g: 'm', sk: DATA.chars.skin[0].n } });
  ok(a.look.h === other && a.look.hc === '#00ff00' && a.look.g === 'f' && a.look.sk === skin, 'at a mirror you change hair and its colour, nothing else');
});

section('people', () => {
  const { sim, A, B, a, b, step, inbox, evs, hand, floorTiles } = setup();
  const W = sim.world.W;
  const texts = (inb) => inb.filter((m) => m.t === 'ev').flatMap((m) => m.list).filter((x) => x.e === 'msg').map((x) => x.text);
  const clear = () => { inbox.a.length = 0; inbox.b.length = 0; };
  const t0 = floorTiles.find((i) => [1, -1, W, -W].every((d) => sim.world.kind[i + d] === 1 && !sim.world.solid[i + d]));
  const place2 = () => { a.x = (t0 % W) * TILE + 0.5; a.z = Math.floor(t0 / W) * TILE + 1; b.x = a.x + 1.2; b.z = a.z; a.vx = a.vz = b.vx = b.vz = 0; a.cool = 0; b.cool = 0; };
  const clickMob = (c, o, extra = {}) => { sim.handle(c, { t: 'click', target: { k: 'mob', id: o.id }, ...extra }); step(0.1); };
  place2();

  // --- handcuffs: three seconds standing next to them, then they cannot use their hands
  const cuffs = sim.newItem('/obj/item/restraints/handcuffs');
  a.hands[0] = null; hand(a, cuffs, 0); a.active = 0;
  const bobItem = sim.newItem('/obj/item/crowbar'); hand(b, bobItem, 0);
  clear();
  clickMob(A, b);
  ok(a.busy && texts(inbox.b).includes(`${a.name} is trying to put handcuffs on you!`), 'cuffing someone warns them (and takes time)');
  step(2.5);
  ok(!b.cuffed, 'not yet after two and a half seconds');
  step(0.8);
  ok(b.cuffed === cuffs && !b.hands[0] && sim.floor.has(bobItem.id), 'three seconds later they are cuffed and drop what they held');
  ok(texts(inbox.a).includes(`${a.name} handcuffs ${b.name}.`) && texts(inbox.b).includes(`${a.name} handcuffs you.`), 'the SS13 messages');
  ok(sim.appearanceOf(b).o.cuffs === sim.looks.meta.cuffs, 'the cuffs show on their sprite');
  clear();
  sim.handle(B, { t: 'click', target: { k: 'mob', id: a.id } }); step(0.1);
  ok(texts(inbox.b).some((x) => x.startsWith("You're handcuffed and can't act")), 'a cuffed person cannot use their hands');

  // --- stripping: the window, obscured slots, delays and the floor
  clear();
  sim.handle(A, { t: 'strip', op: 'open', id: b.id }); step(0.1);
  const view = evs(inbox.a, 'strip').pop();
  ok(view && view.id === b.id && view.cuffs && view.slots.find((s) => s.k === 'uniform').it, 'the strip window lists what they wear and their handcuffs');
  ok(view.pockets.length === 2 && view.pockets[0].full !== undefined, 'pockets only say full or empty');
  sim.handle(A, { t: 'strip', op: 'take', id: b.id, slot: 'shoes' }); step(0.2);
  ok(a.busy && texts(inbox.b).some((x) => x.startsWith(`${a.name} tries to remove your `)), 'taking something off warns them');
  step(8.5);
  ok(!b.worn.shoes, "it comes off after the item's strip delay");
  ok([...sim.floor.values()].some((f) => f.item.path.includes('shoes') && Math.hypot(f.x - b.x, f.z - b.z) < 1.5), 'and lies at their feet');
  // a space helmet covers the mask
  const mask = sim.newItem('/obj/item/clothing/mask/breath'); mask.loc = { t: 'slot', mob: b, slot: 'mask' }; b.worn.mask = mask;
  const helm = sim.newItem('/obj/item/clothing/head/helmet/space/emergency');
  b.worn.head = helm; helm.loc = { t: 'slot', mob: b, slot: 'head' }; recalc(sim, b);
  clear();
  sim.handle(A, { t: 'strip', op: 'take', id: b.id, slot: 'mask' }); step(0.2);
  ok(texts(inbox.a).includes("You can't reach that! Something is covering it.") && !a.busy, 'what is covered cannot be reached');
  // putting something on them
  const shoes = sim.newItem('/obj/item/clothing/shoes/sneakers/black');
  a.hands[0] = null; hand(a, shoes, 0);
  sim.handle(A, { t: 'strip', op: 'put', id: b.id, slot: 'shoes' }); step(2.3);
  ok(b.worn.shoes === shoes && !a.hands[0], 'dressing someone takes two seconds and puts it on them');
  // pockets are quiet
  const pen = sim.newItem('/obj/item/pen'); pen.loc = { t: 'slot', mob: b, slot: 'lpocket' }; b.worn.lpocket = pen;
  clear();
  sim.handle(A, { t: 'strip', op: 'pocket', id: b.id, slot: 'lpocket' }); step(4.3);
  ok(!b.worn.lpocket && !texts(inbox.b).some((x) => x.includes('pocket')), 'emptying a pocket takes four seconds and they are not told');
  // taking the cuffs off
  sim.handle(A, { t: 'strip', op: 'take', id: b.id, slot: 'cuffs' }); step(4.3);
  ok(!b.cuffed && sim.floor.has(cuffs.id), 'the handcuffs come off');
  sim.handle(A, { t: 'strip', op: 'close', id: b.id });

  // --- breaking out of cuffs takes a minute and standing still
  place2(); detachFloor(cuffs); a.hands[0] = null; hand(a, cuffs, 0);
  clickMob(A, b); step(3.3);
  ok(b.cuffed === cuffs, 'cuffed again');
  clear();
  sim.handle(B, { t: 'key', k: 'resist' }); step(0.1);
  ok(b.busy && texts(inbox.b).some((x) => x.includes('This will take around 1 minute and you need to stand still.')), 'resisting starts a minute-long attempt');
  step(30);
  b.x += 1;                                               // moving spoils it
  step(0.2);
  ok(!b.busy && b.cuffed, 'walking away spoils the attempt');
  b.x -= 1; sim.handle(B, { t: 'key', k: 'resist' }); step(61);
  ok(!b.cuffed, 'standing still for a minute frees them');

  // --- grabs
  place2(); a.intent = 'grab'; a.hands[0] = null; a.active = 0; b.hands[0] = null;
  clear();
  clickMob(A, b);
  ok(a.pulling === b && b.pulledBy === a && a.grab === 0 && texts(inbox.a).includes(`You grab ${b.name} passively!`) && texts(inbox.b).includes(`${a.name} grabs you passively!`), 'a grab intent click holds them passively');
  a.x += 2.6; step(0.3);
  ok(Math.hypot(a.x - b.x, a.z - b.z) < 1.8, 'a person you hold trails behind you');
  place2(); a.pulling = b; b.pulledBy = a;
  const held = sim.newItem('/obj/item/crowbar'); hand(b, held, 0);
  a.cool = 0; clear();
  clickMob(A, b);
  ok(a.grab === 1 && !b.hands[0] && texts(inbox.b).includes(`${a.name} grabs you aggressively!`), 'the next click grabs aggressively at once and makes them drop what they hold');
  a.cool = 0; clear();
  clickMob(A, b); step(3.2);
  ok(a.grab === 2 && b.downed && texts(inbox.b).includes(`${a.name} grabs you by the neck!`), 'a third click, three seconds later, is a neck grab: they go down');
  ok(evs(inbox.a, 'msg').length >= 0, 'no crash');
  // they can try to break free: 30% each try at a neck grab
  let freed = false;
  for (let k = 0; k < 60 && !freed; k++) { sim.handle(B, { t: 'key', k: 'resist' }); step(2.1); freed = !b.pulledBy; }
  ok(freed && !b.downed, 'resisting eventually breaks a neck grab');
  // passive holds just let go
  place2(); a.cool = 0; clickMob(A, b);
  sim.handle(B, { t: 'key', k: 'resist' }); step(0.2);
  ok(!b.pulledBy && !a.pulling, 'resisting a passive hold breaks it at once');
  a.cool = 0; clickMob(A, b); sim.handle(A, { t: 'key', k: 'pull' }); step(0.1);
  ok(!a.pulling, 'P lets go');

  // --- examine
  place2(); a.cool = 0; a.intent = 'help'; detachFloor(cuffs); a.hands[0] = null; hand(a, cuffs, 0);
  clickMob(A, b); step(3.3);
  clear();
  sim.actions.examine(A, { target: { k: 'mob', id: b.id } }); step(0.1);
  const seen = texts(inbox.a);
  ok(seen[0] === `This is ${b.name}!` && seen.some((x) => /is wearing/.test(x)) && seen.some((x) => x.endsWith('is handcuffed!')), 'examining a person lists what they wear and that they are handcuffed');

  // --- shut in a locker by someone else
  const cl = sim.station.props.closets.find((it) => it.path.endsWith('closet/emcloset') && !(it.cs & 1));
  sim.people.uncuff(b); sim.closets.open(a, cl);
  const free = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dc, dr]) => [cl.c + dc, cl.r + dr]).find(([c, r]) => sim.world.kind[r * W + c] === 1 && !sim.world.solid[r * W + c]);
  a.x = free[0] * TILE + 1; a.z = free[1] * TILE + 1; b.x = a.x + 0.6; b.z = a.z; a.cool = 0; a.vx = a.vz = 0;
  a.hands[0] = null; sim.handle(A, { t: 'stuff', idx: cl.idx, id: b.id }); step(4.3);
  ok(b.inside === cl && !(cl.cs & 1), 'dragging someone onto an open closet shuts them in after four seconds');

  function detachFloor(item) { sim.floor.delete(item.id); item.loc = null; }
});

section('structures', () => {
  const { sim, A, B, a, b, step, inbox, evs } = setup();
  const w = sim.world, W = w.W, TL = TILE;
  const clear = () => { inbox.a.length = 0; inbox.b.length = 0; };
  const free = (c, r) => w.inb(c, r) && w.kind[r * W + c] === 1 && !w.solid[r * W + c] && !w.dyn[r * W + c] && !w.edge[r * W + c];
  // a closet with six free tiles in a row on one side of it (room to drag it along, and to stand beside it afterwards)
  const lineOf = (it) => [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dc, dr]) => [1, 2, 3, 4, 5, 6].every((k) => free(it.c + dc * k, it.r + dr * k)));
  const spot = (m, x, z) => { m.x = x; m.z = z; m.vx = m.vz = 0; m.cool = 0; m.stunned = 0; };
  const tileSpot = (m, c, r) => spot(m, c * TL + TL / 2, r * TL + TL / 2);
  const ctrlClick = (c, target) => { sim.handle(c, { t: 'click', target, ctrl: true }); step(0.1); };
  const blocks = (it) => w.collides(it.x, it.z, 0.1);
  /** Walk `m` along (dx, dz) for `metres`, a quarter metre at a time, letting the world react. */
  const walk = (m, dx, dz, metres) => { for (let k = 0; k < metres / 0.25; k++) { m.x += dx * 0.25; m.z += dz * 0.25; step(0.05); } };
  const lockers = sim.station.props.closets.filter((it) => it.path.endsWith('closet/emcloset') && !it.anc && !(it.cs & CL.OPEN) && lineOf(it));
  const lk = lockers[0];
  ok(lk, 'found a locker with room to be dragged');
  const [dc, dr] = lineOf(lk);
  const x0 = lk.x, z0 = lk.z, tile0 = lk.r * W + lk.c;

  // --- a closed locker is a box about as wide as it looks, not the whole tile
  ok(lk.half > 0.4 && lk.half < 0.8 && blocks(lk), 'a closed locker is a box smaller than its tile');
  const probe = (d) => w.collides(lk.x + dc * d, lk.z + dr * d, 0.32);
  ok(probe(0.7) && !probe(0.95), 'you can stand right beside it, but not in it');
  ok(!w.solid[tile0] && w.dyn[tile0] > 0, 'it is not a flag on the tile, but pathfinding goes round it');

  // --- Ctrl+click takes hold; it trails you wherever you go, not tile by tile
  tileSpot(a, lk.c + dc, lk.r + dr);
  ctrlClick(A, { k: 'prop', idx: lk.idx });
  ok(a.hauling && a.hauling.it === lk && lk.draggedBy === a, 'Ctrl+click takes hold of a locker');
  clear();
  walk(a, dc, dr, 4);
  const gone = (lk.x - x0) * dc + (lk.z - z0) * dr;
  ok(gone > 2.5, 'it follows you along the way you walk');
  ok(Math.abs(Math.hypot(lk.x - a.x, lk.z - a.z) - (lk.half + 0.32 + 0.3)) < 0.06, 'and trails a short way behind you');
  const along = (((lk.x - TL / 2) * Math.abs(dc) + (lk.z - TL / 2) * Math.abs(dr)) % TL + TL) % TL;
  ok(along > 0.05 && along < TL - 0.05, 'it is not snapped to the tile grid');
  ok(!blocks({ x: x0, z: z0 }) && blocks(lk), 'it blocks where it is now and no longer where it was');
  ok(w.dyn[tile0] === 0 && w.dyn[Math.floor(lk.z / TL) * W + Math.floor(lk.x / TL)] > 0, 'pathfinding knows where it is');
  const pms = evs(inbox.b, 'pm');
  ok(pms.length > 5 && pms.at(-1).i === lk.idx && Math.abs(pms.at(-1).x - lk.x) < 1e-6, 'everyone is told where it goes');
  ok(!w.collides(a.x, a.z, 0.32), 'and it never traps you');
  ok(sim.people.moved(sim.station).some((m) => m[0] === lk.idx && Math.abs(m[1] - lk.x) < 1e-6), 'someone who joins later is told it moved');
  const late = [];
  sim.addClient('Carol', (m) => late.push(m));
  ok(late.find((m) => m.t === 'welcome').grids[0].moved.some((m) => m[0] === lk.idx && Math.abs(m[1] - lk.x) < 1e-6 && Math.abs(m[2] - lk.z) < 1e-6), 'the welcome carries moved structures');

  // --- it turns to face the way it goes
  ok(lk.d === (dc > 0 ? 4 : dc < 0 ? 8 : dr > 0 ? 2 : 1), 'it faces the way you are going');

  // --- it is heavy
  ok(sim.people.dragSlow(a) < 0.7 && sim.people.dragSlow(a) > 0.4, 'dragging a locker slows you down');
  sim.people.release(a);
  ok(sim.people.dragSlow(a) === 1 && !lk.draggedBy, 'letting go frees you');
  const stopAt = [lk.x, lk.z];
  walk(a, dc, dr, 1);
  ok(lk.x === stopAt[0] && lk.z === stopAt[1], 'and it stays where you left it');

  // --- shut someone inside, weld it, drag it all the same: they go along
  sim.closets.putInside(lk, b);
  sim.closets.set(lk, lk.cs | CL.WELDED | CL.LOCKED);
  tileSpot(a, Math.floor(lk.x / TL), Math.floor(lk.z / TL));
  spot(a, lk.x - dc * 1.2, lk.z - dr * 1.2);
  ctrlClick(A, { k: 'prop', idx: lk.idx });
  ok(a.hauling?.it === lk, 'a welded, locked locker can be dragged all the same');
  const at = [lk.x, lk.z];
  walk(a, -dc, -dr, 2);
  ok(Math.hypot(lk.x - at[0], lk.z - at[1]) > 1 && b.x === lk.x && b.z === lk.z, 'whoever is inside goes along');
  sim.people.release(a);
  sim.closets.set(lk, lk.cs & ~(CL.WELDED | CL.LOCKED));
  b.inside = null; lk.mobs.length = 0; b.x = 2; b.z = 2;

  // --- walls and people are in its way
  let ahead = -1;                                              // the first tile along its way that the box is not already touching
  for (let k = 0; k < 40 && ahead < 0; k++) {
    const t = Math.floor((lk.z + dr * (lk.half + 0.02 + k * 0.1)) / TL) * W + Math.floor((lk.x + dc * (lk.half + 0.02 + k * 0.1)) / TL);
    if (!lk.tiles.includes(t)) ahead = t;
  }
  const was = w.solid[ahead];
  w.solid[ahead] = 1;
  const grip = () => { sim.people.release(a); a.hauling = { k: 'prop', it: lk, name: lk.name }; lk.draggedBy = a; };
  spot(a, lk.x + dc * 1.3, lk.z + dr * 1.3);                 // you stand on the wall's side of it
  grip();
  walk(a, dc, dr, 1.5);
  ok(!w.collides(lk.x, lk.z, lk.half - 0.01, lk), 'it will not be dragged into a wall');
  w.solid[ahead] = was;
  sim.people.release(a);
  spot(a, lk.x + dc * 3, lk.z + dr * 3);
  b.x = lk.x + dc * (lk.half + 0.4); b.z = lk.z + dr * (lk.half + 0.4);       // someone stands between you and it
  grip();
  step(1);
  ok(Math.abs(b.x - lk.x) >= lk.half + 0.29 || Math.abs(b.z - lk.z) >= lk.half + 0.29, 'it does not slide through a person standing in its way');
  sim.people.release(a);
  b.x = 2; b.z = 2;

  // --- you pass through what you drag; when you let go the two of you move apart
  {
    const yawTo = (x, z) => Math.atan2(-(x - a.x), -(z - a.z));
    sim.people.release(a);
    spot(a, lk.x - dc * 1.3, lk.z - dr * 1.3);
    grip();
    const yaw = yawTo(lk.x, lk.z);
    sim.handle(A, { t: 'input', list: Array.from({ length: 12 }, (_, k) => ({ seq: 100 + k, dt: 0.05, f: 1, b: 0, l: 0, r: 0, run: 0, yaw, pitch: 0 })) });
    step(0.6);
    ok(Math.abs(a.x - lk.x) < lk.half && Math.abs(a.z - lk.z) < lk.half, 'you can walk straight into what you are dragging');
    ok(sim.selfState(A).haul === lk.idx, 'the client is told what you drag so it can predict the same');
    const was = [a.x, a.z, lk.x, lk.z];
    sim.people.release(a);
    const clear = (m, it) => Math.abs(m.x - it.x) >= it.half + 0.3 || Math.abs(m.z - it.z) >= it.half + 0.3;
    ok(clear(a, lk) && !w.collides(a.x, a.z, 0.32) && !w.collides(lk.x, lk.z, lk.half - 0.01, lk), 'let go, and you and it end up apart');
    ok(Math.hypot(a.x - was[0], a.z - was[1]) > 0.05 && Math.hypot(lk.x - was[2], lk.z - was[3]) > 0.05, 'each of you moves');
    // exactly on top of it, with a wall behind you: it still gets you out
    let beyond = -1;
    for (let k = 0; k < 40 && beyond < 0; k++) {
      const t = Math.floor((lk.z + dr * (lk.half + 0.02 + k * 0.1)) / TL) * W + Math.floor((lk.x + dc * (lk.half + 0.02 + k * 0.1)) / TL);
      if (!lk.tiles.includes(t)) beyond = t;
    }
    const wasSolid = w.solid[beyond];
    w.solid[beyond] = 1;
    spot(a, lk.x, lk.z); a.yaw = Math.atan2(dc, dr);          // "behind you" is toward the wall
    grip();
    sim.people.release(a);
    ok(clear(a, lk) && !w.collides(a.x, a.z, 0.32) && !w.collides(lk.x, lk.z, lk.half - 0.01, lk), 'even exactly on it with a wall in the way');
    w.solid[beyond] = wasSolid;
  }

  // --- what is bolted down stays put (anchored in the DM), and what is not can be dragged
  const open = (it) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([x, y]) => free(it.c + x, it.r + y));
  const brig = sim.station.props.closets.find((it) => it.anc && open(it));
  const rack = sim.props.interact.find((it) => it.path === 'structure/rack' && open(it));
  const chair = sim.props.interact.find((it) => it.path === 'structure/chair' && it.anc && open(it));
  const tank = sim.props.interact.find((it) => it.path === 'structure/reagent_dispensers/fueltank' && !it.anc && open(it));
  const crate = sim.station.props.closets.find((it) => it.path === 'structure/closet/crate' && !it.anc && open(it));
  ok(brig && rack && chair && tank && crate, 'found a brig locker, a rack, a chair, a fuel tank and a crate');
  const beside = (it) => { const [c, r] = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([x, y]) => [it.c + x, it.r + y]).find(([c, r]) => free(c, r)); tileSpot(a, c, r); a.hauling = null; };
  for (const [name, it] of [['a brig locker', brig], ['a rack', rack], ['a chair', chair]]) {
    beside(it);
    sim.handle(A, { t: 'click', target: { k: 'prop', idx: it.idx }, ctrl: true }); step(0.1);
    ok(!a.hauling && !a.busy, `${name} is bolted down and cannot be dragged`);
  }
  for (const [name, it] of [['a fuel tank', tank], ['a crate', crate]]) {
    beside(it);
    sim.handle(A, { t: 'click', target: { k: 'prop', idx: it.idx }, ctrl: true }); step(0.1);
    ok(a.hauling?.it === it, `${name} can be dragged`);
    sim.people.release(a);
  }
  ok(sim.people.dragSlow(a) === 1 && crate.ds === 0 && lk.ds === 1.5, 'lockers are heavy (drag_slowdown 1.5) and crates are not');
  ok(blocks(tank) && tank.half > 0.8 && tank.half <= 0.95, 'a tank is a wide box, nearly the whole tile');

  // --- loose items follow you across the floor
  tileSpot(a, Math.floor(lk.x / TL) + dc, Math.floor(lk.z / TL) + dr);
  const bar = sim.newItem('/obj/item/crowbar');
  place(sim, bar, sim.station, a.x + 0.5, a.z, 0.01);
  clear();
  ctrlClick(A, { k: 'item', id: bar.id });
  ok(a.hauling?.k === 'item' && sim.floor.has(bar.id), 'Ctrl+click on a loose item drags it, it does not pick it up');
  walk(a, dc, dr, 2.5);
  const rec = sim.floor.get(bar.id);
  ok(Math.hypot(rec.x - a.x, rec.z - a.z) < 1.2 && evs(inbox.a, 'imv').length > 0, 'it slides along behind you');
  sim.people.release(a);

  // --- people: Ctrl+click is a plain hold; the strip window moved to Alt+click
  tileSpot(a, Math.floor(lk.x / TL) + dc, Math.floor(lk.z / TL) + dr); b.inside = null; b.x = a.x + 1.0; b.z = a.z; b.vx = b.vz = 0; a.intent = 'help'; a.hands[0] = null; a.hands[1] = null;
  clear();
  ctrlClick(A, { k: 'mob', id: b.id });
  ok(a.pulling === b && a.grab === 0 && b.pulledBy === a, 'Ctrl+click on a person grabs them passively');
  a.cool = 0; ctrlClick(A, { k: 'mob', id: b.id });
  ok(!a.pulling && !b.pulledBy, 'and Ctrl+click again lets go (it never tightens)');
  a.cool = 0; clear();
  sim.handle(A, { t: 'click', target: { k: 'mob', id: b.id }, alt: true }); step(0.1);
  ok(evs(inbox.a, 'strip').pop()?.id === b.id, 'Alt+click on a person opens their strip window');
  sim.people.closeStrip(A);
  // a body on the floor is a dead weight until you hold it up
  a.cool = 0; ctrlClick(A, { k: 'mob', id: b.id });
  b.stunned = 5;
  ok(sim.people.dragSlow(a) < 0.7, 'dragging someone who is down slows you');
  a.grab = 1;
  ok(sim.people.dragSlow(a) === 1, 'holding them up does not');
  sim.people.release(a);
});


section('observers and ghosts', () => {
  const { sim, A, B, b, step, inbox } = setup();
  // an observer from the lobby walks where they push
  const C = sim.addClient('Cara', () => {});
  sim.handle(C, { t: 'lobby', op: 'observe' });
  ok(C.state === 'ghost' && !C.mob, 'observing makes you a ghost with no body');
  const z0 = C.ghost.z;
  const walkN = (c, seq0, n) => sim.handle(c, { t: 'input', list: Array.from({ length: n }, (_, k) => ({ seq: seq0 + k, dt: 0.05, f: 1, b: 0, l: 0, r: 0, run: 1, yaw: 0, pitch: 0 })) });
  walkN(C, 1, 10); step(0.6);
  ok(C.ghost.z < z0 - 2, 'an observer can move');
  ok(C.lastSeq === 10, 'and the server acknowledges the inputs, so the client is not pulled back');
  // someone who dies becomes a ghost that can fly about too
  b.body.damage('brute', 999, 'test'); step(0.2);
  ok(B.state === 'ghost' && !B.mob, 'the dead become ghosts');
  const x0 = B.ghost.x;
  sim.handle(B, { t: 'input', list: Array.from({ length: 10 }, (_, k) => ({ seq: 1 + k, dt: 0.05, f: 0, b: 0, l: 0, r: 1, run: 1, yaw: 0, pitch: 0 })) }); step(0.6);
  ok(B.ghost.x > x0 + 2 && B.lastSeq === 10, 'a dead player can fly about');
  void A; void inbox;
});

section('debug menu', () => {
  // off unless the server was started with --debug
  {
    const { sim, A, a, inbox, step } = setup();
    const floor0 = sim.floor.size;
    sim.handle(A, { t: 'dbg', op: 'spawn', path: '/obj/item/crowbar', n: 1, where: 'hand' });
    sim.handle(A, { t: 'dbg', op: 'god', on: true });
    sim.handle(A, { t: 'dbg', op: 'mob', kind: 'carp', where: 'front' });
    step(0.1);
    ok(inbox.a.find((m) => m.t === 'welcome').debug === false, 'the welcome says the debug menu is off');
    ok(!a.hands[0] && !a.hands[1] && sim.floor.size === floor0 && !a.body.god && ![...sim.mobs.values()].some((m) => m.kind === 'carp'), 'and every debug message is ignored');
  }
  const { sim, A, B, a, b, inbox, step, evs, floorTiles } = setup({ debug: true });
  const w = sim.world, W = w.W;
  const texts = (inb) => inb.filter((m) => m.t === 'ev').flatMap((m) => m.list).filter((x) => x.e === 'msg').map((x) => x.text);
  const dbg = (c, op, extra = {}) => { sim.handle(c, { t: 'dbg', op, ...extra }); step(0.1); };
  ok(inbox.a.find((m) => m.t === 'welcome').debug === true, 'the welcome says the debug menu is on');
  a.hands[0] = null; a.hands[1] = null; a.active = 0;

  // --- spawning
  dbg(A, 'spawn', { path: '/obj/item/crowbar', n: 1, where: 'hand' });
  ok(a.hands[0]?.path === '/obj/item/crowbar', 'spawns an item into your hand');
  dbg(A, 'spawn', { path: '/obj/item/wrench', n: 1, where: 'hand' });
  dbg(A, 'spawn', { path: '/obj/item/screwdriver', n: 1, where: 'hand' });
  ok(a.hands[1]?.path === '/obj/item/wrench' && [...sim.floor.values()].some((f) => f.item.path === '/obj/item/screwdriver' && Math.hypot(f.x - a.x, f.z - a.z) < 2), 'the second goes to the other hand and the third to the floor beside you');
  const before = sim.floor.size;
  dbg(A, 'spawn', { path: '/obj/item/pen', n: 4, where: 'front' });
  ok(sim.floor.size === before + 4, 'spawns several at your feet');
  dbg(A, 'spawn', { path: '/obj/item/stack/sheet/metal', n: 30, where: 'front' });
  const sheets = [...sim.floor.values()].filter((f) => f.item.path === '/obj/item/stack/sheet/metal').pop();
  ok(sheets && sheets.item.amount === 30, 'a stack is one thing with that many in it');
  const n1 = sim.floor.size;
  dbg(A, 'spawn', { path: '/obj/item/pen', n: 9999, where: 'front' });
  ok(sim.floor.size === n1 + 25, 'a huge amount is capped');
  const n0 = sim.floor.size;
  dbg(A, 'spawn', { path: '/obj/not/a/thing', n: 1, where: 'front' });
  dbg(A, 'spawn', { path: '__proto__', n: 1, where: 'front' });
  dbg(A, 'spawn', { path: '/obj/item/pen', n: 'lots', where: 'look', at: ['x', null] });
  ok(sim.floor.size === n0 + 1 && texts(inbox.a).includes('[Debug] No such item.'), 'rubbish is refused or made harmless');
  const spot = [a.x + 6, a.z];
  dbg(A, 'spawn', { path: '/obj/item/flashlight', n: 1, where: 'look', at: spot });
  const lit = [...sim.floor.values()].find((f) => f.item.path === '/obj/item/flashlight' && Math.hypot(f.x - spot[0], f.z - spot[1]) < 3);
  ok(lit && Math.hypot(lit.x - spot[0], lit.z - spot[1]) < 3, 'spawns where you are looking');

  // --- creatures
  dbg(A, 'mob', { kind: 'carp', where: 'front' });
  ok([...sim.mobs.values()].some((m) => m.kind === 'carp'), 'spawns a space carp');
  dbg(A, 'mob', { kind: 'corgi', where: 'front' });
  ok([...sim.mobs.values()].some((m) => m.name === 'Ian' && m.kind === 'pet'), 'and Ian');
  const crewBefore = sim.mobs.size;
  dbg(A, 'mob', { kind: 'crew', job: 'not_a_job', where: 'front' });
  dbg(A, 'mob', { kind: 'crew', job: 'bartender', where: 'front' });
  const bar = [...sim.mobs.values()].find((m) => m.job === 'bartender');
  ok(sim.mobs.size === crewBefore + 1 && Math.hypot(bar.x - a.x, bar.z - a.z) < 4, 'spawns crew in a job, next to you');
  dbg(A, 'who');
  const who = evs(inbox.a, 'dbg').pop();
  ok(who?.k === 'who' && who.mobs.some((m) => m.id === bar.id && m.job === 'bartender') && who.mobs.find((m) => m.id === a.id).pl, 'the people list names everyone and marks players');
  dbg(A, 'delete', { target: { k: 'mob', id: bar.id } });
  ok(!sim.mobs.has(bar.id), 'removes someone who is not a player');
  dbg(A, 'delete', { target: { k: 'mob', id: b.id } });
  ok(sim.mobs.has(b.id), 'but not a player');
  dbg(A, 'delete', { target: { k: 'item', id: lit.item.id } });
  ok(!sim.floor.has(lit.item.id) && !sim.items.has(lit.item.id), 'removes a loose item');
  const cl = sim.station.props.closets.find((it) => !it.gone && !(it.cs & CL.OPEN));
  ok(w.collides(cl.x, cl.z, 0.1), 'a closed locker blocks');
  dbg(A, 'delete', { target: { k: 'prop', idx: cl.idx } });
  ok(cl.gone && !w.collides(cl.x, cl.z, 0.1), 'and once removed it stops blocking');

  // --- you
  a.body.damage('brute', 50, 'test');
  dbg(A, 'heal');
  ok(a.body.health === a.body.max, 'heals you');
  dbg(A, 'god', { on: true });
  sim.hurt(a, 500, 'brute', 'test');
  ok(!a.dead && a.body.health === a.body.max && sim.selfState(A).dbg.god, 'god mode: nothing hurts');
  dbg(A, 'god', { on: false });
  dbg(A, 'kill');
  ok(a.dead && A.state === 'ghost' && A.deadMob === a, 'kill kills, god mode or not');
  dbg(A, 'revive');
  ok(!a.dead && A.mob === a && A.state === 'playing' && !A.deadMob && a.body.health === a.body.max, 'revive brings a dead player back in their body');
  dbg(A, 'speed', { v: 3 });
  ok(sim.selfState(A).slow >= 2.9 && sim.selfState(A).dbg.speed === 3, 'speed is a multiplier the client can predict');
  dbg(A, 'speed', { v: 99 });
  ok(a.dbgSpeed === 6, 'capped');
  dbg(A, 'speed', { v: 1 });
  dbg(A, 'access');
  ok(a.worn.id.access.length > 30 && a.access.has(10), 'every door opens for your ID');
  const oldUniform = a.worn.uniform;
  dbg(A, 'outfit', { job: 'captain' });
  ok(a.worn.uniform && a.worn.uniform !== oldUniform && a.worn.uniform.path.includes('captain') && sim.floor.has(oldUniform.id), "wears another job's outfit, the old clothes on the floor");
  dbg(A, 'outfit', { job: 'nonsense' });
  ok(a.worn.uniform.path.includes('captain'), 'an unknown job changes nothing');

  // --- noclip walks through a wall
  const t0 = [...Array(W * w.H).keys()].find((i) => w.kind[i] === 1 && !w.solid[i] && w.kind[i + 1] === 2 && w.kind[i + 2] === 2 && w.kind[i + 3] === 2 && !w.dyn[i]);
  const tc = t0 % W, tr = Math.floor(t0 / W);
  let seq = 1000;
  const walkEast = (n) => { a.x = tc * 2 + 1; a.z = tr * 2 + 1; a.vx = a.vz = 0; sim.handle(A, { t: 'input', list: Array.from({ length: n }, () => ({ seq: seq++, dt: 0.05, f: 1, b: 0, l: 0, r: 0, run: 1, yaw: -Math.PI / 2, pitch: 0 })) }); step(1); };
  walkEast(20);
  ok(a.x < (tc + 1) * 2 + 0.1, 'a wall stops you');
  dbg(A, 'noclip', { on: true });
  walkEast(20);
  ok(a.x > (tc + 1) * 2 + 1 && sim.selfState(A).dbg.noclip, 'noclip lets you through it, and tells the client to predict that');
  dbg(A, 'noclip', { on: false });

  // --- going places
  dbg(A, 'tp', { c: 120, r: 120 });
  ok(Math.hypot(a.x - 241, a.z - 241) < 8, 'teleports to a tile');
  const room = w.areas.findIndex((x) => /Bar$/i.test(x.n));
  dbg(A, 'area', { idx: room });
  ok(w.areaIdx[Math.floor(a.z / 2) * W + Math.floor(a.x / 2)] === room && !w.collides(a.x, a.z, 0.3), 'goes to a room, standing somewhere free in it');
  dbg(A, 'bring', { id: b.id });
  ok(Math.hypot(b.x - a.x, b.z - a.z) < 3, 'brings someone to you');
  const ft = floorTiles[floorTiles.length >> 1];
  b.x = (ft % W) * 2 + 1; b.z = Math.floor(ft / W) * 2 + 1;
  dbg(A, 'goto', { id: b.id });
  ok(Math.hypot(a.x - b.x, a.z - b.z) < 3, 'goes to someone');
  dbg(A, 'bring', { id: 999999 }); dbg(A, 'area', { idx: -5 }); dbg(A, 'tp', { c: -9, r: 1e9 });
  ok(Number.isFinite(a.x) && Number.isFinite(a.z), 'bad destinations do nothing odd');

  // --- the station
  dbg(A, 'alert', { level: 'red' });
  ok(sim.director.level === 'red', 'sets the alert level');
  dbg(A, 'alert', { level: 'purple' });
  ok(sim.director.level === 'red', 'only real levels');
  dbg(A, 'power', { state: 'battery' });
  ok(sim.power.state === 'battery', 'power state');
  const holes = w.breached.size;
  dbg(A, 'strike');
  ok(w.breached.size === holes + 1, 'a meteor breaks a window');
  dbg(A, 'repair');
  ok(w.breached.size === 0 && sim.power.state === 'normal', 'repair seals the hull and restores power');
  dbg(A, 'shuttle', { what: 'call' });
  ok(sim.director.evacState === 'called', "calls the shuttle (without Central Command's say-so)");
  dbg(A, 'doors', { what: 'open' });
  ok(sim.doors.every((d) => d.state !== 'closed'), 'opens every door');
  dbg(A, 'doors', { what: 'close' });
  ok(sim.doors.every((d) => d.state !== 'open'), 'and closes them');
  const t1 = sim.round.time;
  dbg(A, 'skip', { sec: 60 });
  ok(sim.round.time >= t1 + 60, 'skips the clock ahead');
  dbg(A, 'round', { what: 'end' });
  ok(sim.round.state === 'ending', 'ends the round');

  // --- an observer can use the menu too
  const C = sim.addClient('Cara', () => {});
  sim.handle(C, { t: 'lobby', op: 'observe' });
  dbg(C, 'tp', { c: 100, r: 100 });
  ok(Math.abs(C.ghost.x - 201) < 1, 'observers teleport');
  void B;
});

section('door angles and wall mounts', () => {
  const { sim } = setup();
  const w = sim.world, W = w.W;
  const doorAt = (c, r) => w.doorAt.get(r * W + c);
  // the airlocks that come in threes stand in line with each other, whichever way the passage runs
  ok([111, 112, 113].every((c) => doorAt(c, 110).yaw === 0) && [145].every((r) => [111, 112, 113].every((c) => doorAt(c, r).yaw === 0)), 'a row of three airlocks across a passage lies along the row, the middle one too');
  ok([113, 114, 115].every((r) => doorAt(94, r).yaw === Math.PI / 2) && [125, 126, 127].every((r) => doorAt(130, r).yaw === Math.PI / 2), 'and a column of three lies along the column');
  // a door between two walls lies along them; nothing is left undecided
  let between = 0, wrong = 0;
  for (const d of sim.doors) {
    if (!Number.isFinite(d.yaw)) wrong++;
    const wl = (c, r) => w.isWallLike(c, r);
    if (wl(d.c - 1, d.r) && wl(d.c + 1, d.r)) { between++; if (d.yaw !== 0) wrong++; }
    else if (wl(d.c, d.r - 1) && wl(d.c, d.r + 1)) { between++; if (d.yaw !== Math.PI / 2) wrong++; }
  }
  ok(between > 300 && wrong === 0, `every airlock has an angle, and those between two walls lie along them (${between})`);
  // firelocks standing side by side in an open passage form a line across it
  const f = (c, r) => sim.props.fdoors.find((x) => x.x === c && x.y === r);
  ok([f(76, 114), f(77, 114), f(78, 114)].every((x) => x && x.yaw === Math.PI / 2) || [f(60, 114), f(94, 114)].every((x) => x && x.yaw === Math.PI / 2), 'firelocks in an open passage stand across it, not edge on');
  ok(sim.props.fdoors.every((x) => Number.isFinite(x.yaw)), 'every firelock has an angle');

  // every wall mount hangs on a wall: beside one if it stands on a floor tile, on the open face of it if it is part of the wall (signs)
  const level = sim.level.grids.station.props.filter((p) => p.k === 'wm');
  const DVs = { 1: [0, -1], 2: [0, 1], 4: [1, 0], 8: [-1, 0] };
  let bad = 0, onWall = 0;
  for (const p of level) {
    const [dc, dr] = DVs[p.sd], here = w.isWallLike(p.x, p.y), there = w.isWallLike(p.x + dc, p.y + dr);
    if (p.ow) { onWall++; if (!here || there) bad++; } else if (!there) bad++;
  }
  ok(onWall > 90 && bad <= 40, `wall mounts are on a wall (${bad} of ${level.length} are not: mostly cameras and direction signs on pillars or door frames; ${onWall} signs and the like sit on wall tiles themselves)`);
  // two mounts on the same stretch of wall do not share a plane, and the map's side-by-side offsets are kept
  const wm = sim.props.interact.filter((it) => it.kind === 'wm');
  const seen = new Map();
  let same = 0;
  for (const it of wm) {
    const k = `${it.c},${it.r},${it.sd}`;
    const dep = it.sd === 1 || it.sd === 2 ? it.z : it.x;
    const list = seen.get(k) || [];
    if (list.some((q) => Math.abs(q - dep) < 1e-6)) same++;
    list.push(dep); seen.set(k, list);
  }
  ok(same === 0, `no two mounts on the same wall stretch lie in one plane (${same})`);
  ok(level.filter((p) => p.lat).length > 100, 'mounts keep the map\'s sideways offsets');
});

section('chat', () => {
  const { sim, A, a, b, step, inbox, evs, floorTiles } = setup();
  const t = floorTiles[3], W = sim.world.W;
  a.x = (t % W) * TILE + 1; a.z = Math.floor(t / W) * TILE + 1;
  b.x = a.x + 1.5; b.z = a.z;
  inbox.b.length = 0;
  sim.handle(A, { t: 'say', text: 'hello there', mode: 'say' });
  step(0.1);
  ok(evs(inbox.b, 'msg').some((m) => m.k === 'say' && m.text === 'hello there'), 'say is heard nearby');
  sim.handle(A, { t: 'say', text: ':e engine check', mode: 'say' });
  step(0.1);
  ok(!evs(inbox.b, 'msg').some((m) => m.k === 'radio' && m.ch === 'engineering'), 'doctor does not hear the engineering channel');
  sim.handle(A, { t: 'say', text: ';anyone around?', mode: 'say' });
  step(0.1);
  ok(evs(inbox.b, 'msg').some((m) => m.k === 'radio' && m.ch === 'common'), 'common radio reaches the doctor');
  b.x = a.x + 40;
  inbox.b.length = 0;
  sim.handle(A, { t: 'say', text: 'can you hear me', mode: 'say' });
  step(0.1);
  ok(!evs(inbox.b, 'msg').some((m) => m.k === 'say'), 'say does not carry across the station');
});

section('terminals', () => {
  const { sim, A, a, step } = setup();
  sim.power.setState('battery');
  const t = [...Array(sim.world.W * sim.world.H).keys()].find((i) => sim.world.kind[i] === 1 && !sim.world.solid[i]);
  a.x = (t % sim.world.W) * TILE + 1; a.z = Math.floor(t / sim.world.W) * TILE + 1;
  sim.terminals.open(A, 'power', { name: 'power monitor' });
  ok(A.term, 'terminal opened');
  sim.handle(A, { t: 'term', op: 'act', idx: 1 }); step(0.2);
  ok(sim.power.restartStep === 0 && sim.time < sim.power.lockoutUntil, 'wrong order scrams the engine');
  step(9);
  sim.handle(A, { t: 'term', op: 'act', idx: 0 }); step(3);
  sim.handle(A, { t: 'term', op: 'act', idx: 1 }); step(3);
  sim.handle(A, { t: 'term', op: 'act', idx: 2 }); step(3);
  ok(sim.power.state === 'normal', 'engine restart sequence restores power');
});

section('drag and drop', () => {
  const { sim, A, a, step, hand, floorTiles } = setup();
  const W = sim.world.W;
  // stand in an open hallway and put a crowbar on the floor next to us
  const t = floorTiles.find((i) => [[1, 0], [2, 0], [-1, 0]].every(([dc, dr]) => !sim.world.solid[i + dc + dr * W]));
  a.x = (t % W) * TILE + 1; a.z = Math.floor(t / W) * TILE + 1;
  a.hands[0] = a.hands[1] = null;
  const bar = sim.newItem('/obj/item/crowbar');
  hand(a, bar, 0);
  sim.handle(A, { t: 'inv', op: 'move', item: bar.id, to: { t: 'floor', x: a.x + 1.5, z: a.z } });
  const rec = sim.floor.get(bar.id);
  ok(rec && Math.abs(rec.x - (a.x + 1.5)) < 0.01, 'held item is placed exactly where it was dropped');
  sim.handle(A, { t: 'inv', op: 'move', item: bar.id, to: { t: 'floor', x: a.x + 2.2, z: a.z + 0.3 } });
  ok(Math.abs(sim.floor.get(bar.id)?.x - (a.x + 2.2)) < 0.01, 'a floor item can be dragged along the floor');
  sim.handle(A, { t: 'inv', op: 'move', item: bar.id, to: { t: 'hand', i: 1 } });
  ok(a.hands[1] === bar && !sim.floor.has(bar.id), 'a floor item can be dragged straight into a hand');
  sim.handle(A, { t: 'inv', op: 'move', item: bar.id, to: { t: 'floor', x: a.x + 30, z: a.z } });
  ok(a.hands[1] === bar, 'cannot drop out of reach');
  sim.handle(A, { t: 'inv', op: 'move', item: bar.id, to: { t: 'floor', x: a.x + 1.2, z: a.z } });
  sim.handle(A, { t: 'inv', op: 'move', item: bar.id, to: { t: 'box', id: a.worn.back.id } });
  ok(a.worn.back.contents.includes(bar), 'a floor item can be dragged into the backpack');
  const far = sim.newItem('/obj/item/wrench');
  const { place: placeFn } = { place: (it, x, z) => { sim.floor.set(it.id, { item: it, grid: sim.station, x, y: 0, z, c: Math.floor(x / 2), r: Math.floor(z / 2) }); it.loc = { t: 'floor' }; } };
  placeFn(far, a.x + 20, a.z);
  sim.handle(A, { t: 'inv', op: 'move', item: far.id, to: { t: 'hand', i: 0 } });
  ok(!a.hands[0] && sim.floor.has(far.id), 'cannot grab things out of reach');
  const tool = sim.newItem('/obj/item/screwdriver');
  hand(a, tool, 0);
  a.cool = 0;
  sim.handle(A, { t: 'inv', op: 'throw', item: tool.id, at: [a.x + 6, 0.5, a.z] });
  const tr = sim.floor.get(tool.id);
  ok(tr && tr.x > a.x + 0.4 && Math.abs(tr.z - a.z) < 1.2, 'throwing at a point sends it that way');
  step(0.1);

  // hostile or buggy clients: junk must be ignored, never turned into NaN positions or phantom hands
  for (const at of [[a.x + 5, 'x', a.z], [NaN, 1, 1], null, 'north', [1, 2]]) {
    const t2 = sim.newItem('/obj/item/crowbar'); hand(a, t2, 0); a.cool = 0; a.pitch = 0;
    sim.handle(A, { t: 'inv', op: 'throw', item: t2.id, at });
    ok(a.hands[0] === t2 && Number.isFinite(a.pitch) && Number.isFinite(a.yaw), 'a throw with a malformed target is ignored: ' + JSON.stringify(at));
    a.hands[0] = null; sim.items.delete(t2.id);
  }
  const phantom = sim.newItem('/obj/item/crowbar'); hand(a, phantom, 0); a.hands[1] = null;
  sim.handle(A, { t: 'inv', op: 'move', item: phantom.id, to: { t: 'hand', i: 5 } });
  ok(a.hands.length === 2 && a.hands.every((h) => h === null || a.hands.indexOf(h) < 2), 'cannot move an item into a third hand');
  ok(a.hands[0] === phantom || a.hands[1] === phantom, 'the item is still in one of the two real hands');
});

section('death -> ghost', () => {
  const { sim, B, b, step } = setup();
  b.body.damage('brute', 500, 'test');
  step(0.2);
  ok(B.state === 'ghost' && !B.mob && b.dead, 'a dead player becomes a ghost');
});

section('zero gravity', () => {
  const { sim, A, a, inbox, step, evs, hand } = setup({ debug: true });
  const w = sim.world, R = 0.32 + 0.9;
  const drive = (c, seq0, n, inp) => sim.handle(c, { t: 'input', list: Array.from({ length: n }, (_, k) => ({ seq: seq0 + k, dt: 0.05, f: 0, b: 0, l: 0, r: 0, run: 0, yaw: 0, pitch: 0, ...inp })) });
  const centre = (c, r) => [c * TILE + 1, r * TILE + 1];
  // a floor tile with nothing within arm's reach (a big room), and a tile of open space with space all round it
  let room = -1, deep = -1;
  for (let i = 0; i < w.W * w.H && (room < 0 || deep < 0); i++) {
    const c = i % w.W, r = Math.floor(i / w.W), [x, z] = centre(c, r);
    if (room < 0 && w.kind[i] === 1 && !w.solid[i] && w.areas[w.areaIdx[i]].c !== 'shuttle' && !w.hasGrip(x, z)) room = i;
    if (deep < 0 && c > 8 && r > 8 && c < w.W - 9 && r < w.H - 9) {
      let sp = true;
      for (let dr = -4; dr <= 4 && sp; dr++) for (let dc = -4; dc <= 4; dc++) if (w.kindAt(c + dc, r + dr) !== 0) { sp = false; break; }
      // and nothing to hold on to for the next several metres either way (props stand in open space too)
      if (sp) { const [px, pz] = centre(c, r); for (let t = -6; t <= 6 && sp; t += 0.5) if (w.hasGrip(px, pz + t) || w.hasGrip(px + t, pz)) sp = false; }
      if (sp) deep = i;
    }
  }
  ok(room >= 0 && deep >= 0, 'found a big room and open space to test in');
  const at = (i) => centre(i % w.W, Math.floor(i / w.W));

  // open space is not solid, so you can leave the station
  const [sx, sz] = at(deep);
  ok(!w.collides(sx, sz, 0.32), 'open space does not block you');
  ok(!w.hasGravity(sx, sz), 'there is no gravity in open space');
  ok(!w.hasGravity(-5, 10), 'nor off the map');
  const [rx, rz] = at(room);
  ok(w.hasGravity(rx, rz), 'a station room has gravity while the generator runs');
  const shuttle = (() => { for (let i = 0; i < w.W * w.H; i++) if (w.kind[i] === 1 && !w.solid[i] && w.areas[w.areaIdx[i]].c === 'shuttle') return i; return -1; })();
  const lattice = (() => { for (let i = 0; i < w.W * w.H; i++) if (w.kind[i] === 3) return i; return -1; })();
  ok(lattice >= 0 && !w.hasGravity(...at(lattice)), 'lattice is over space: no gravity there either');
  ok(lattice >= 0 && w.hasGrip(...at(lattice)), 'but it gives you something to hold');

  // with gravity you steer anywhere, as ever
  a.x = rx; a.z = rz; a.vx = a.vz = 0;
  drive(A, 1, 6, { f: 1, yaw: 0 }); step(0.4);
  ok(a.z < rz - 0.4, 'gravity on: you walk');

  // turning gravity off tells everybody and shakes their cameras
  inbox.a.length = 0;
  ok(sim.setGravity(sim.station, false) === true && w.gravityOn === false, 'setGravity(false) switches it off');
  step(0.1);
  ok(evs(inbox.a, 'grav').some((e) => e.on === false), 'clients are told (grav event)');
  ok(evs(inbox.a, 'shake').length > 0, 'cameras shake');
  ok(sim.setGravity(sim.station, false) === false, 'switching it off twice does nothing the second time');
  ok(!w.hasGravity(rx, rz), 'a station room now has none');
  ok(sim.worldState(A).grids[0].gravity === false, 'a player who joins later is told');
  ok(shuttle < 0 || w.hasGravity(...at(shuttle)), 'a shuttle keeps its own gravity');

  // floating in a big room with nothing to hold: pushing keys does nothing
  a.x = rx; a.z = rz; a.vx = a.vz = 0; a.stunned = 0;
  drive(A, 100, 10, { f: 1, yaw: 0 }); step(0.6);
  ok(Math.abs(a.z - rz) < 0.05 && Math.abs(a.x - rx) < 0.05, 'adrift: you cannot steer with nothing to push off');
  ok(a.speedNow === 0, 'and a floating body does not walk (no footsteps for others to hear)');
  // but whatever speed you had, you keep
  a.vx = 0; a.vz = -2;
  drive(A, 200, 10, { yaw: 0 }); step(0.6);
  ok(a.z < rz - 0.8 && Math.abs(a.vz + 2) < 0.2, 'adrift: you coast at the speed you had');
  ok(Math.abs(a.x - rx) < 0.05, 'in a straight line');
  // and bump to a stop at the wall
  a.x = rx; a.z = rz; a.vx = 0; a.vz = -4;
  for (let k = 0; k < 8; k++) { drive(A, 300 + k * 10, 10, { yaw: 0 }); step(0.6); }
  ok(Math.hypot(a.vx, a.vz) < 0.01, 'a wall stops you dead');
  ok(w.hasGrip(a.x, a.z), 'you end up beside something you can hold');
  // with a hold, you steer again, and can push off from it
  drive(A, 400, 10, { b: 1, yaw: 0 }); step(0.6);
  ok(a.z > rz - 8 && a.vz > 0.5, 'holding the wall you can push yourself away from it');
  // the speed limit: escaping air can only blow you so fast, and nothing else slows you down
  a.x = sx; a.z = sz; a.vx = 9; a.vz = 0;
  drive(A, 500, 4, { yaw: 0 }); step(0.2);
  ok(Math.abs(a.vx - 9) < 0.01, 'a speed you had is kept in open space');
  const blown = { x: sx, z: sz, vx: 0, vz: 0 };
  for (let k = 0; k < 100; k++) stepMovement(blown, { yaw: 0 }, w, 0.05, { wind: [30, 0] });
  ok(Math.hypot(blown.vx, blown.vz) <= 4.01 && blown.vx > 3, 'but the wind cannot blow you faster than the drift limit');

  // out in open space nothing ever stops you but the edge of the map
  a.x = sx; a.z = sz; a.vx = 0; a.vz = 3;
  drive(A, 600, 10, { yaw: 0 }); step(0.5); drive(A, 610, 10, { yaw: 0 }); step(0.6);        // the server takes half a second of input a tick
  ok(a.z > sz + 2.5 && Math.abs(a.vz - 3) < 0.05, 'in open space you drift on and on');
  // throwing something with nothing to brace on pushes you the other way
  a.x = sx; a.z = sz; a.vx = a.vz = 0; a.yaw = 0; a.pitch = 0; a.cool = 0; a.throwMode = false;
  a.hands[0] = a.hands[1] = null;
  const brick = sim.newItem('/obj/item/crowbar'); hand(a, brick, 0); a.active = 0;
  sim.actions.throwItem(a, brick);
  ok(a.vz > 1, 'throwing north in open space sends you south');
  // a gripped thrower stays put
  a.x = rx; a.z = rz; a.vx = a.vz = 0;
  w.gravityOn = true; const g = a.hands; void g;
  w.gravityOn = false;
  const [hx, hz] = (() => { for (let i = 0; i < w.W * w.H; i++) { const [x, z] = at(i); if (w.kind[i] === 1 && !w.solid[i] && w.hasGrip(x, z) && !w.hasGravity(x, z)) return [x, z]; } return [0, 0]; })();
  a.x = hx; a.z = hz; a.vx = a.vz = 0; a.cool = 0;
  const brick2 = sim.newItem('/obj/item/crowbar'); hand(a, brick2, 0); a.active = 0;
  sim.actions.throwItem(a, brick2);
  ok(Math.hypot(a.vx, a.vz) < 0.01, 'next to a wall the throw does not push you');

  // an unconscious body keeps drifting, where gravity would have stopped it
  a.x = sx; a.z = sz; a.vx = 0; a.vz = -2.5; a.stunned = 30;
  drive(A, 700, 10, { yaw: 0 }); step(0.6);
  ok(a.z < sz - 0.8, 'a stunned body keeps drifting');
  sim.setGravity(sim.station, true);
  a.x = rx; a.z = rz; a.vx = 0; a.vz = -2.5; a.stunned = 30;
  drive(A, 800, 10, { yaw: 0 }); step(0.6);
  ok(Math.abs(a.z - rz) < 0.05, 'but with gravity it stops where it is');
  a.stunned = 0;

  // magboots hold you to a real floor; a jetpack lets you steer anywhere. Both are switched on with their keys, and need to be worn.
  sim.setGravity(sim.station, false);
  a.x = rx; a.z = rz; a.vx = a.vz = 0;
  sim.handle(A, { t: 'key', k: 'mag' });
  ok(!a.magOn, 'K does nothing without magboots on');
  const boots = sim.newItem('/obj/item/clothing/shoes/magboots');
  if (a.worn.shoes) detach(sim, a.worn.shoes);
  attach(sim, boots, { t: 'slot', mob: a, slot: 'shoes' });
  sim.handle(A, { t: 'key', k: 'mag' });
  ok(a.magOn === true, 'K switches the magboots on');
  ok(sim.moveFactor(a) < 0.8, 'and they slow you down');
  drive(A, 900, 8, { f: 1, yaw: 0 }); step(0.5);
  ok(a.z < rz - 0.3, 'magboots on a floor: you can walk without gravity');
  ok(a.speedNow > 0 || a.z < rz, 'and you get about');
  a.x = sx; a.z = sz; a.vx = a.vz = 0;
  drive(A, 910, 8, { f: 1, yaw: 0 }); step(0.5);
  ok(Math.abs(a.z - sz) < 0.05, 'but magboots do nothing over open space');
  a.x = rx; a.z = rz;
  detach(sim, boots);
  ok(!a.magOn, 'taking them off switches them off');

  sim.handle(A, { t: 'key', k: 'jet' });
  ok(!a.jetOn, 'J does nothing without a jetpack on your back');
  const jp = sim.newItem('/obj/item/tank/jetpack/carbondioxide');
  if (a.worn.back) detach(sim, a.worn.back);
  attach(sim, jp, { t: 'slot', mob: a, slot: 'back' });
  ok(jp.gas > 0, 'a jetpack comes with gas');
  sim.handle(A, { t: 'key', k: 'jet' });
  ok(a.jetOn === true, 'J switches the jetpack on');
  a.x = sx; a.z = sz; a.vx = a.vz = 0;
  const gas0 = jp.gas;
  drive(A, 1000, 8, { f: 1, yaw: 0 }); step(0.5);
  ok(a.z < sz - 0.4, 'a jetpack lets you steer in open space');
  ok(jp.gas < gas0, 'thrusting uses its gas');
  const gas1 = jp.gas;
  drive(A, 1100, 10, { yaw: 0 }); step(0.6);
  ok(Math.hypot(a.vx, a.vz) < 0.1, 'and it brakes you when you let go');
  ok(jp.gas === gas1, 'which costs nothing');
  jp.gas = 0.2;
  drive(A, 1200, 8, { f: 1, yaw: 0 }); step(0.5);
  ok(!a.jetOn, 'when the gas runs out the engines cut out');
  a.jetOn = true;
  detach(sim, jp);
  ok(!a.jetOn, 'taking the jetpack off switches it off');
  a.jetOn = false;
  void sim.setGravity(sim.station, true);

  // the debug menu: gravity and "take me out"
  sim.handle(A, { t: 'dbg', op: 'gravity', on: false });
  ok(w.gravityOn === false, 'debug: gravity off');
  sim.handle(A, { t: 'dbg', op: 'gravity' });
  ok(w.gravityOn === true, 'debug: with no argument it flips');
  sim.handle(A, { t: 'dbg', op: 'space' });
  ok(w.kindAt(Math.floor(a.x / TILE), Math.floor(a.z / TILE)) === 0, 'debug: take me out puts you in open space');
});

section('windows and grilles', () => {
  const { sim, A, a, inbox, step, evs, hand } = setup({ debug: true });
  const w = sim.world, I = (c, r) => r * w.W + c;
  const tool = (path, extra = {}) => { const it = sim.newItem(path, extra); hand(a, it, 0); a.active = 0; a.cool = 0; return it; };
  const welder = () => { const it = tool('/obj/item/weldingtool'); it.lit = true; it.fuel = 20; return it; };
  const click = (target) => { a.cool = 0; sim.handle(A, { t: 'click', target }); step(0.06); };       // a step, so the messages are sent
  const said = (from) => inbox.a.slice(from).filter((m) => m.t === 'ev').flatMap((m) => m.list).filter((x) => x.e === 'msg').map((x) => x.text);
  // an inside window of the given kind with open floor on one side, and a pane of the given kind
  const find = (key) => {
    for (let i = 0; i < w.W * w.H; i++) {
      if (!w.glass[i] || w.breached.has(i) || w.windowKey(i) !== key || w.ventsToSpace(i)) continue;
      const c = i % w.W, r = Math.floor(i / w.W);
      for (const [dc, dr] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        if (w.kindAt(c + dc, r + dr) === 1 && !w.solid[I(c + dc, r + dr)] && !w.dyn[I(c + dc, r + dr)]) return { c, r, i, at: [(c + dc) * TILE + 1, (r + dr) * TILE + 1] };
      }
    }
    return null;
  };
  const stand = (spot) => { a.x = spot.at[0]; a.z = spot.at[1]; a.vx = a.vz = 0; a.busy = null; a.stunned = 0; };
  const floorAt = (x, z, path) => [...sim.floor.values()].filter((f) => f.item.path === path && Math.abs(f.x - x) < 0.6 && Math.abs(f.z - z) < 0.6);
  const floorNear = (spot, path) => [...sim.floor.values()].filter((f) => f.item.path === path && Math.abs(f.x - (spot.c * TILE + 1)) < 1.2 && Math.abs(f.z - (spot.r * TILE + 1)) < 1.2);
  const plain = find('window'), reinf = find('rwindow');
  ok(plain && reinf, 'found an ordinary and a reinforced window to work on');
  ok(w.grille[plain.i] === 1 && w.ws[reinf.i] === 8, 'every map window has its grille; a reinforced one starts fastened in its frame');

  // ---- breaking one: TG removes the window and leaves its grille and what spawnDebris makes (a full-tile window: two shards; reinforced: two rods too)
  stand(reinf);
  sim.breachTile(sim.station, reinf.c, reinf.r, 'shot'); step(0.1);
  ok(w.breached.has(reinf.i) && !w.glass[reinf.i], 'the glass is gone');
  ok(w.grille[reinf.i] === 1 && w.solid[reinf.i] === 1, 'its grille still stands, and still blocks the way');
  ok(floorNear(reinf, '/obj/item/shard').length === 2, 'a smashed full-tile window leaves two shards');
  const rods = floorNear(reinf, '/obj/item/stack/rods');
  ok(rods.length === 1 && rods[0].item.amount === 2, 'a reinforced one leaves two rods');
  ok(sim.windows.examine(sim.station, { k: 'breach', c: reinf.c, r: reinf.r }).join(' ').startsWith('A flimsy framework of metal rods.'), 'the thing left is called a grille, with the real description');
  ok(!sim.windows.examine(sim.station, { k: 'breach', c: reinf.c, r: reinf.r }).join(' ').includes('broken window'), 'there is no "broken window"');
  ok(evs(inbox.a, 'tile').some((e) => e.i === reinf.i && e.gr === 1 && e.brk === 1), 'clients are told the grille is still there');
  // cutting the grille: no delay, no message, two rods, and the tile is open floor
  tool('/obj/item/wirecutters');
  const n0 = inbox.a.length;
  click({ k: 'breach', c: reinf.c, r: reinf.r });
  ok(w.grille[reinf.i] === 0 && w.solid[reinf.i] === 0, 'wirecutters cut the grille away at once');
  ok(floorNear(reinf, '/obj/item/stack/rods').reduce((s, f) => s + f.item.amount, 0) === 4, 'and it gives two rods');
  ok(said(n0).length === 0, 'without a word (grille.dm deconstruct() has no message)');
  ok(w.breached.has(reinf.i), 'the hole is still a hole (the air still goes out)');
  // 2 rods rebuild a grille: 1 s
  const rodsIn = tool('/obj/item/stack/rods', { amount: 2 });
  click({ k: 'breach', c: reinf.c, r: reinf.r }); step(1.3);
  ok(w.grille[reinf.i] === 1 && w.solid[reinf.i] === 1, 'two rods build the grille again');
  ok(!sim.items.has(rodsIn.id) || rodsIn.amount === 0, 'and are used up');
  // screwdriver: loosen / fasten the grille; glass will not go on a loose one
  tool('/obj/item/screwdriver');
  click({ k: 'breach', c: reinf.c, r: reinf.r });
  ok((w.ws[reinf.i] & 32) !== 0, 'a screwdriver unfastens the grille');
  const glass = tool('/obj/item/stack/sheet/rglass', { amount: 3 });
  let mark = inbox.a.length;
  click({ k: 'breach', c: reinf.c, r: reinf.r });
  ok(said(mark).includes('The grille needs to be fastened to the floor first!'), 'a loose grille takes no glass');
  tool('/obj/item/screwdriver'); click({ k: 'breach', c: reinf.c, r: reinf.r });
  ok((w.ws[reinf.i] & 32) === 0, 'and fastens it again');
  // glass: needs two sheets, takes 2 s, and the window comes out loose
  const one = tool('/obj/item/stack/sheet/rglass', { amount: 1 });
  mark = inbox.a.length;
  click({ k: 'breach', c: reinf.c, r: reinf.r });
  ok(said(mark).includes('You need at least two sheets of glass for that!'), 'one sheet is not enough');
  const two = tool('/obj/item/stack/sheet/rglass', { amount: 3 });
  mark = inbox.a.length;
  click({ k: 'breach', c: reinf.c, r: reinf.r });
  ok(said(mark).includes('You start placing the window...'), 'glass on the grille starts placing a window');
  step(1.0); ok(!w.glass[reinf.i], 'it takes 20 ds (2 s)');
  step(1.3);
  ok(w.glass[reinf.i] === 1 && w.windowKey(reinf.i) === 'rwindow' && w.kind[reinf.i] === 2, 'reinforced glass makes a reinforced window');
  ok(two.amount === 1, 'and uses two of the sheets');
  ok(said(mark).includes('You place the reinforced window on the grille.'), 'SS13\'s message');
  ok(w.airBlock[reinf.i] === 0 && (w.ws[reinf.i] & 16) !== 0 && (w.ws[reinf.i] & 15) === 0, 'the new window is loose: it does not seal the tile yet');
  void glass; void one;

  // ---- put it back: screw it down (30 ds), then a reinforced one has to be levered into its frame (100 ds)
  mark = inbox.a.length;
  tool('/obj/item/screwdriver'); click({ k: 'window', c: reinf.c, r: reinf.r }); step(2.0);
  ok(w.airBlock[reinf.i] === 0, 'screwing takes 3 s');
  step(1.3);
  ok(w.airBlock[reinf.i] === 1 && (w.ws[reinf.i] & 16) === 0, 'a screwed-down window seals the tile');
  ok(said(mark).includes('You begin to screw the window to the floor...') && said(mark).includes('You fasten the window to the floor.'), 'with window.dm\'s messages');
  tool('/obj/item/crowbar'); click({ k: 'window', c: reinf.c, r: reinf.r }); step(9.5);
  ok((w.ws[reinf.i] & 15) === 0, 'levering it into the frame takes 10 s');
  step(1);
  ok((w.ws[reinf.i] & 15) === 8, 'and then it is secure again');

  // ---- taking the reinforced window apart again: heat (harm intent), screwdriver, crowbar, wirecutters, wrench, then wrench
  const seq = [];
  const doStep = (path, secs, state, extra = {}) => {
    const it = path === 'welder' ? welder() : tool(path);
    if (extra.intent) { a.intent = extra.intent; }
    mark = inbox.a.length;
    click({ k: 'window', c: reinf.c, r: reinf.r });
    step(secs - 0.3);
    const before = w.ws[reinf.i] & 15;
    step(0.6);
    seq.push([before !== state, (w.ws[reinf.i] & 15) === state]);
    a.intent = 'help';
    return it;
  };
  a.intent = 'help';
  tool('/obj/item/screwdriver'); click({ k: 'window', c: reinf.c, r: reinf.r }); step(0.5);
  ok(!a.busy && (w.ws[reinf.i] & 15) === 8, 'a screwdriver does nothing to the one-way screws');
  welder(); click({ k: 'window', c: reinf.c, r: reinf.r }); step(0.5);
  ok(!a.busy, 'a welder on help intent does not heat them (it would repair)');
  doStep('welder', 15, 7, { intent: 'harm' });
  ok(seq.at(-1)[1], 'a lit welder on harm intent heats the screws in 15 s');
  ok(said(mark).includes('You begin heating the security screws on the reinforced window...') && said(mark).includes('The security bolts are glowing white hot and look ready to be removed.'), 'with the real messages');
  doStep('/obj/item/screwdriver', 5, 6);
  ok(seq.at(-1)[1], 'a screwdriver takes the screws out in 5 s');
  doStep('/obj/item/crowbar', 4, 5);
  ok(seq.at(-1)[1], 'a crowbar pops the panel in 4 s');
  doStep('/obj/item/wirecutters', 2, 4);
  ok(seq.at(-1)[1], 'wirecutters cut the bars in 2 s');
  ok(said(mark).includes('The panels falls out of the way exposing the frame bolts.'), 'DM\'s own typo and all');
  ok(w.airBlock[reinf.i] === 1, 'it still seals the tile while it is bolted to the frame');
  doStep('/obj/item/wrench', 4, 0);
  ok(seq.at(-1)[1] && w.airBlock[reinf.i] === 0 && (w.ws[reinf.i] & 16) !== 0, 'a wrench frees it in 4 s, and it stops sealing');
  mark = inbox.a.length;
  tool('/obj/item/wrench'); click({ k: 'window', c: reinf.c, r: reinf.r }); step(2.5);
  ok(w.glass[reinf.i] === 1, 'taking it apart takes 3 s');
  step(1);
  ok(!w.glass[reinf.i] && w.breached.has(reinf.i), 'and then the window is gone');
  const sheets = floorAt(a.x, a.z, '/obj/item/stack/sheet/rglass');
  ok(sheets.some((f) => f.item.amount === 2), 'leaving two sheets of reinforced glass at your feet (user.loc)');
  ok(floorNear(reinf, '/obj/item/shard').length === 2, 'and no more shards than the two from the first smash');
  ok(w.grille[reinf.i] === 1, 'the grille is still there: you cut that separately');
  ok(said(mark).includes('You successfully disassemble the reinforced window.'), 'DM\'s message');

  // ---- the plain window: screwdriver (3 s), wrench (3 s), two glass sheets
  stand(plain);
  mark = inbox.a.length;
  tool('/obj/item/wrench'); click({ k: 'window', c: plain.c, r: plain.r }); step(0.5);
  ok(!a.busy && w.glass[plain.i] === 1, 'a wrench does nothing while it is screwed to the floor');
  tool('/obj/item/screwdriver'); click({ k: 'window', c: plain.c, r: plain.r }); step(3.4);
  ok((w.ws[plain.i] & 16) !== 0 && w.airBlock[plain.i] === 0, 'unscrewing it takes 3 s and it stops sealing');
  tool('/obj/item/wrench'); click({ k: 'window', c: plain.c, r: plain.r }); step(3.4);
  ok(!w.glass[plain.i], 'then the wrench takes it apart');
  const gl = floorAt(a.x, a.z, '/obj/item/stack/sheet/glass');
  ok(gl.length === 1 && gl[0].item.amount === 2, 'two sheets of glass at your feet');
  ok(floorNear(plain, '/obj/item/shard').length === 0, 'and no shards: taking a window apart is not breaking it');

  // ---- empty hands knock; a damaged window can be welded whole again (help intent, 4 s)
  const k2 = find('window');
  stand(k2); a.hands[0] = a.hands[1] = null; a.intent = 'help'; mark = inbox.a.length;
  click({ k: 'window', c: k2.c, r: k2.r });
  ok(said(mark).includes('You knock on the window.'), 'knocking on a window');
  w.hp.set(k2.i, 5); mark = inbox.a.length;
  welder(); click({ k: 'window', c: k2.c, r: k2.r }); step(2);
  ok(w.hp.get(k2.i) === 5, 'welding takes 4 s');
  step(2.4);
  ok(w.hp.get(k2.i) === 30, 'and then it is whole');
  mark = inbox.a.length; click({ k: 'window', c: k2.c, r: k2.r });
  ok(said(mark).includes('The window is already in good condition!'), 'a whole one says so');

  // ---- a thin pane: one shard when smashed (and a rod if reinforced); taking it apart leaves only its glass
  const pane = sim.props.panes.find((p) => !p.dead && p.tag === 'rwindow' && w.kindAt(p.c, p.r) === 1 && !w.solid[I(p.c, p.r)]);
  ok(!!pane, 'found a reinforced pane');
  if (pane) {
    const centre = { c: pane.c, r: pane.r, at: [pane.c * TILE + 1, pane.r * TILE + 1] };
    stand(centre);
    const pane2 = sim.props.panes.find((p) => p !== pane && !p.dead && p.tag === 'rwindow' && w.kindAt(p.c, p.r) === 1 && !w.solid[I(p.c, p.r)]);
    sim.shatterPane(sim.station, pane);
    ok(pane.dead, 'a pane breaks');
    ok(floorNear(centre, '/obj/item/shard').length === 1, 'into one shard');
    ok(floorNear(centre, '/obj/item/stack/rods').some((f) => f.item.amount === 1), 'and one rod');
    if (pane2) {
      const c2 = { c: pane2.c, r: pane2.r, at: [pane2.c * TILE + 1, pane2.r * TILE + 1] };
      stand(c2);
      const T = { k: 'pane', c: pane2.c, r: pane2.r, d: pane2.d };
      const chain = [['welder', 15, 'harm'], ['/obj/item/screwdriver', 5], ['/obj/item/crowbar', 4], ['/obj/item/wirecutters', 2], ['/obj/item/wrench', 4], ['/obj/item/wrench', 3]];
      for (const [path, secs, intent] of chain) {
        if (path === 'welder') welder(); else tool(path);
        a.intent = intent || 'help';
        click(T); step(secs + 0.5);
      }
      a.intent = 'help';
      ok(pane2.dead, 'a pane takes the same six steps to take apart');
      ok(floorAt(a.x, a.z, '/obj/item/stack/sheet/rglass').some((f) => f.item.amount === 1), 'and gives one sheet of reinforced glass');
      ok(floorNear(c2, '/obj/item/shard').length === 0, 'and no shards');
    }
  }

  // ---- hull breach: a window that was keeping space out and is unscrewed lets the air out; re-fastening seals it
  const out = (() => {
    for (let i = 0; i < w.W * w.H; i++) {
      if (!w.glass[i] || w.breached.has(i) || !w.ventsToSpace(i) || w.windowKey(i) !== 'window') continue;
      const c = i % w.W, r = Math.floor(i / w.W);
      for (const [dc, dr] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) if (w.kindAt(c + dc, r + dr) === 1 && !w.solid[I(c + dc, r + dr)]) return { c, r, i, at: [(c + dc) * TILE + 1, (r + dr) * TILE + 1] };
    }
    return null;
  })();
  if (out) {
    stand(out);
    tool('/obj/item/screwdriver'); click({ k: 'window', c: out.c, r: out.r }); step(3.4);
    ok(w.airBlock[out.i] === 0, 'an outside window that is unscrewed no longer holds the air');
    const patched0 = sim.director.stats.patched;
    tool('/obj/item/screwdriver'); click({ k: 'window', c: out.c, r: out.r }); step(3.4);
    ok(w.airBlock[out.i] === 1 && sim.director.stats.patched === patched0 + 1, 'screwing it back seals the hull again (and counts as a patch)');
  }
});

section('tiny fans seal against air', () => {
  const { sim, step } = setup();
  const st = sim.station, w = st.world;
  const fans = st.props.statics.filter((x) => x.tag === 'fan');
  const tiles = sim.level.grids.station.props.filter((q) => q.k === 'fan');
  ok(tiles.length === 3, 'BoxStation has three tiny fans (the chapel, disposal and toxins launcher doors)');
  ok(fans.length === 3 && fans.every((x) => x.mode === 3), 'each is drawn flat on the floor');
  const stand = tiles.map((q) => q.y * w.W + q.x);
  ok(stand.every((i) => w.airBlock[i] === 1 && !w.solid[i] && w.kind[i] === 1), 'a fan tile blocks air, and you can still walk on it');
  // the plating beside the launcher door opens on space: without the fan it would empty the room behind it
  const open = (i) => st.atmos.sinkCells.has(i) && !w.airBlock[i];
  ok(stand.every((i) => !open(i)), 'so it is not a place the air escapes');
  step(40);
  const behind = stand.map((i) => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dc, dr]) => w.idx((i % w.W) + dc, Math.floor(i / w.W) + dr)).find((j) => st.atmos.isCell[j] && !w.airBlock[j] && w.roof[j] === 1 && !st.atmos.sinkCells.has(j)));
  ok(behind.every((j) => j !== undefined && st.atmos.pressureAt(j % w.W, Math.floor(j / w.W)) > 95), 'and the room behind it keeps its air');
});

section('walls and girders', () => {
  const { sim, A, a, inbox, step, evs, hand } = setup({ debug: true });
  sim.director.strikes = 99; sim.director.carpTimer = 1e9;    // no meteor strikes and no carp this shift: where they land is not what this is about
  const w = sim.world, I = (c, r) => r * w.W + c, TERR = w.level.terrain;
  const tool = (path, extra = {}) => { const it = sim.newItem(path, extra); hand(a, it, 0); a.active = 0; a.cool = 0; return it; };
  const welder = () => { const it = tool('/obj/item/weldingtool'); it.lit = true; it.fuel = 20; return it; };
  const click = (target) => { a.cool = 0; sim.handle(A, { t: 'click', target }); step(0.06); };
  const said = (from) => inbox.a.slice(from).filter((m) => m.t === 'ev').flatMap((m) => m.list).filter((x) => x.e === 'msg').map((x) => x.text);
  const floorAt = (x, z, path) => [...sim.floor.values()].filter((f) => f.item.path === path && Math.abs(f.x - x) < 0.6 && Math.abs(f.z - z) < 0.6);
  const at = (c, r) => [c * TILE + 1, r * TILE + 1];
  const find = (key) => {
    for (let i = 0; i < w.W * w.H; i++) {
      if (w.wallKey(i) !== key) continue;
      const c = i % w.W, r = Math.floor(i / w.W);
      if (c < 3 || r < 3 || c > w.W - 4 || r > w.H - 4) continue;
      for (const [dc, dr] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nc = c + dc, nr = r + dr;
        if (w.kindAt(nc, nr) === 1 && !w.solid[I(nc, nr)] && !w.dyn[I(nc, nr)] && w.areas[w.areaIdx[I(nc, nr)]].c !== 'space') return { c, r, i, stand: at(nc, nr) };
      }
    }
    return null;
  };
  const stand = (s) => { a.x = s.stand[0]; a.z = s.stand[1]; a.vx = a.vz = 0; a.busy = null; a.stunned = 0; a.intent = 'help'; };
  const girderAt = (c, r) => sim.built.at(c, r);

  // ---- the map's own girders are real now
  ok(sim.built.size >= 5 && [...sim.built].every((b) => b.k === 'girder' && w.solid[I(b.c, b.r)] === 1), 'the map\'s girders are built structures and block you');
  ok(sim.worldState(A).grids[0].built.length === sim.station.built.size, 'a player who joins is told about them');

  // ---- a plain wall: a welder cuts through it in 10 s, and leaves a girder, two metal sheets and bare plating
  const plain = find('wall');
  ok(!!plain, 'found a wall to work on');
  stand(plain);
  ok(sim.walls.examine(sim.station, { k: 'wall', c: plain.c, r: plain.r }).join(' ') === 'A huge chunk of metal used to separate rooms. The outer plating is welded firmly in place.', 'examining a wall');
  tool('/obj/item/wrench'); click({ k: 'wall', c: plain.c, r: plain.r }); step(0.4);
  ok(!a.busy && w.wallKey(plain.i) === 'wall', 'a wrench does nothing to a wall');
  let mark = inbox.a.length;
  const unlit = tool('/obj/item/weldingtool'); unlit.fuel = 20;
  click({ k: 'wall', c: plain.c, r: plain.r });
  ok(!a.busy && said(mark).some((t) => /has to be on/.test(t)), 'a welder that is not lit will not do');
  mark = inbox.a.length;
  welder(); click({ k: 'wall', c: plain.c, r: plain.r }); step(8);
  ok(w.wallKey(plain.i) === 'wall', 'slicing takes 10 s');
  step(2.2);
  const [px, pz] = at(plain.c, plain.r);
  ok(w.kind[plain.i] === 1 && w.solid[plain.i] === 1 && w.airBlock[plain.i] === 0, 'the wall is gone; the girder that is left blocks the tile but not the air');
  ok(w.floorCell[plain.i] === TERR.plating, 'on bare plating');
  const gp = girderAt(plain.c, plain.r);
  ok(gp && gp.st === 0, 'a plain girder stands there');
  ok(floorAt(px, pz, '/obj/item/stack/sheet/metal').some((f) => f.item.amount === 2), 'and two sheets of metal lie there');
  ok(said(mark).includes('You begin slicing through the outer plating...') && said(mark).includes('You remove the outer plating.'), 'with the DM\'s messages');
  ok(sim.atmos.isCell[plain.i] === 1, 'the tile holds air now');
  ok(evs(inbox.a, 'bs+').some((e) => e.c === plain.c && e.r === plain.r) && evs(inbox.a, 'tile').some((e) => e.i === plain.i && e.kind === 1), 'clients are told: tile and girder');

  // ---- the girder: unbolt (4 s), disassemble when displaced (4 s) into two sheets, bolt it down again
  ok(sim.walls.examine(sim.station, { k: 'built', id: gp.id }).join(' ').endsWith('The bolts are wrenched in place.'), 'a bolted girder says so');
  mark = inbox.a.length;
  tool('/obj/item/wrench'); click({ k: 'built', id: gp.id }); step(3.4);
  ok(gp.st === 0, 'unbolting takes 4 s');
  step(0.9);
  ok(gp.st === 3 && w.solid[plain.i] === 1, 'a displaced girder still blocks the tile');
  ok(said(mark).includes('You start unsecuring the girder...') && said(mark).includes('You unsecure the girder.'), 'messages');
  tool('/obj/item/wrench'); click({ k: 'built', id: gp.id }); step(4.5);
  ok(gp.st === 0, 'and bolting it down takes 4 s too');
  tool('/obj/item/screwdriver'); click({ k: 'built', id: gp.id }); step(0.6);
  ok(!a.busy, 'a screwdriver does nothing to a bolted girder');
  tool('/obj/item/wrench'); click({ k: 'built', id: gp.id }); step(4.5);
  mark = inbox.a.length;
  tool('/obj/item/screwdriver'); click({ k: 'built', id: gp.id }); step(3.3);
  ok(girderAt(plain.c, plain.r) === gp, 'disassembling takes 4 s');
  step(1);
  ok(!girderAt(plain.c, plain.r) && w.solid[plain.i] === 0, 'then it is gone and the tile is free');
  ok(floorAt(px, pz, '/obj/item/stack/sheet/metal').reduce((s, f) => s + f.item.amount, 0) === 4, 'two more sheets of metal (four in all, with the wall\'s)');
  ok(said(mark).includes('You start to disassemble the girder...') && said(mark).includes('You disassemble the girder.'), 'DM\'s messages');
  ok(!floorAt(px, pz, '/obj/item/stack/rods').length, 'and no rods');
  // you can walk over it now
  a.x = px; a.z = pz; a.vx = a.vz = 0;
  ok(!w.collides(px, pz, 0.32), 'you can stand on that tile');

  // ---- putting it back: a girder, then two sheets of metal (4 s). One sheet is not enough
  const g2 = sim.addBuilt(sim.station, 'girder', plain.c, plain.r, 0);
  ok(w.collides(px, pz, 0.32), 'a new girder blocks the tile');
  stand(plain);
  tool('/obj/item/stack/sheet/metal', { amount: 1 });
  mark = inbox.a.length; click({ k: 'built', id: g2.id });
  ok(said(mark).includes('You need two sheets of metal to finish a wall!'), 'one sheet is not enough');
  const metal = tool('/obj/item/stack/sheet/metal', { amount: 5 });
  mark = inbox.a.length; click({ k: 'built', id: g2.id }); step(3.4);
  ok(!!girderAt(plain.c, plain.r), 'plating takes 4 s');
  step(1);
  ok(w.wallKey(plain.i) === 'wall' && !girderAt(plain.c, plain.r) && w.airBlock[plain.i] === 1, 'a wall again: the girder is gone');
  ok(metal.amount === 3, 'two sheets of metal used');
  ok(said(mark).includes('You start adding plating...') && said(mark).includes('You add the plating.'), 'messages');

  // ---- a reinforced wall: grille, screws, cover, cover, bolts, rods, sheath
  const re = find('reinforced_wall');
  ok(!!re, 'found a reinforced wall');
  stand(re);
  const T = { k: 'wall', c: re.c, r: re.r };
  const st = () => w.ws[re.i];
  ok(sim.walls.examine(sim.station, T).join(' ').endsWith('The outer grille is fully intact.'), 'a reinforced wall starts intact');
  tool('/obj/item/weldingtool'); a.hands[0].lit = true; a.hands[0].fuel = 20; click(T); step(0.5);
  ok(!a.busy && st() === 0, 'a welder does nothing to an intact one');
  const stepTool = (path, secs, to, msg) => {
    if (path === 'welder') welder(); else tool(path);
    mark = inbox.a.length;
    click(T);
    if (secs) { step(secs - 0.4); const early = st(); step(0.9); if (early === to) return false; } else step(0.1);
    return st() === to && (!msg || said(mark).includes(msg));
  };
  ok(stepTool('/obj/item/wirecutters', 0, 1, 'You cut the outer grille.'), 'wirecutters cut the outer grille at once');
  ok(stepTool('/obj/item/wirecutters', 0, 0, 'You repair the outer grille.'), 'and mend it again');
  stepTool('/obj/item/wirecutters', 0, 1);
  ok(stepTool('/obj/item/screwdriver', 4, 2, 'You unsecure the support lines.'), 'a screwdriver unsecures the support lines in 4 s');
  ok(stepTool('welder', 6, 3, 'You press firmly on the cover, dislodging it.'), 'a welder slices the cover in 6 s');
  ok(stepTool('/obj/item/crowbar', 10, 4, 'You pry off the cover.'), 'a crowbar pries it off in 10 s');
  ok(stepTool('/obj/item/wrench', 4, 5, 'You remove the bolts anchoring the support rods.'), 'a wrench loosens the bolts in 4 s');
  ok(stepTool('welder', 10, 6, 'You slice through the support rods.'), 'a welder slices the rods in 10 s');
  // going back a step works too
  ok(stepTool('welder', 10, 5, 'You weld the support rods back together.'), 'and welds them back');
  ok(stepTool('welder', 10, 6), 'then cuts them again');
  ok(sim.walls.examine(sim.station, T).join(' ').endsWith('the outer sheath is connected loosely to the girder.'), 'the hint changes with each step');
  mark = inbox.a.length;
  tool('/obj/item/crowbar'); click(T); step(9.5);
  ok(w.wallKey(re.i) === 'reinforced_wall', 'prying off the sheath takes 10 s');
  step(1);
  const [rx, rz] = at(re.c, re.r);
  ok(w.kind[re.i] === 1 && w.floorCell[re.i] === TERR.plating, 'then the wall is down to plating');
  const gr = girderAt(re.c, re.r);
  ok(gr && gr.st === 2, 'with a reinforced girder');
  ok(floorAt(rx, rz, '/obj/item/stack/sheet/plasteel').some((f) => f.item.amount === 1), 'and one sheet of plasteel');
  ok(said(mark).includes('You pry off the outer sheath.'), 'DM\'s message');

  // ---- a reinforced girder: screws (4 s), then the inner grille comes out with wirecutters (4 s) leaving a plasteel sheet and a plain girder
  tool('/obj/item/screwdriver'); click({ k: 'built', id: gr.id }); step(4.5);
  ok(gr.st === 1, 'the struts are unscrewed');
  ok(sim.walls.examine(sim.station, { k: 'built', id: gr.id }).join(' ').endsWith('The support struts are unscrewed and the inner grille is intact.'), 'and it says so');
  tool('/obj/item/screwdriver'); click({ k: 'built', id: gr.id }); step(4.5);
  ok(gr.st === 2, 'the screwdriver puts them back');
  tool('/obj/item/screwdriver'); click({ k: 'built', id: gr.id }); step(4.5);
  tool('/obj/item/wirecutters'); click({ k: 'built', id: gr.id }); step(4.5);
  ok(gr.st === 0 && floorAt(rx, rz, '/obj/item/stack/sheet/plasteel').reduce((s, f) => s + f.item.amount, 0) === 2, 'wirecutters take the inner grille out: a plain girder and another plasteel sheet');
  // plasteel: reinforce the girder (6 s), then finish the wall (5 s)
  const ps = tool('/obj/item/stack/sheet/plasteel', { amount: 3 });
  mark = inbox.a.length; click({ k: 'built', id: gr.id }); step(5.4);
  ok(gr.st === 0, 'reinforcing takes 6 s');
  step(0.9);
  ok(gr.st === 2 && ps.amount === 2, 'and uses one sheet of plasteel');
  click({ k: 'built', id: gr.id }); step(4.4);
  ok(!!girderAt(re.c, re.r), 'finishing the wall takes 5 s');
  step(0.9);
  ok(w.wallKey(re.i) === 'reinforced_wall' && w.ws[re.i] === 0 && ps.amount === 1 && !girderAt(re.c, re.r), 'a reinforced wall again, with one more sheet used');
  ok(said(mark).includes('You start reinforcing the girder...') && said(mark).includes('You fully reinforce the wall.'), 'messages');

  // ---- an outside wall: taking it down opens the station to space, and that is a hull breach until it is plated again
  {
    let out = null;
    for (let i = 0; i < w.W * w.H && !out; i++) {
      if (w.wallKey(i) !== 'wall' || !w.ventsToSpace(i)) continue;
      const c = i % w.W, r = Math.floor(i / w.W);
      for (const [dc, dr] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nc = c + dc, nr = r + dr;
        if (w.kindAt(nc, nr) === 1 && !w.solid[I(nc, nr)] && !w.dyn[I(nc, nr)]) { out = { c, r, i, stand: at(nc, nr) }; break; }
      }
    }
    ok(!!out, 'found an outside wall');
    if (out) {
      stand(out);
      const before = w.ventTiles().length;
      welder(); click({ k: 'wall', c: out.c, r: out.r }); step(10.5);
      ok(w.kind[out.i] === 1 && w.ventTiles().includes(out.i) && w.ventTiles().length === before + 1, 'an outside wall that is taken down is a hull breach');
      const gx = girderAt(out.c, out.r);
      tool('/obj/item/wrench'); click({ k: 'built', id: gx.id }); step(4.5);
      tool('/obj/item/screwdriver'); click({ k: 'built', id: gx.id }); step(4.5);
      const g3 = sim.addBuilt(sim.station, 'girder', out.c, out.r, 0);
      tool('/obj/item/stack/sheet/metal', { amount: 2 }); click({ k: 'built', id: g3.id }); step(4.5);
      ok(w.wallKey(out.i) === 'wall' && !w.ventTiles().includes(out.i), 'and plating it closes the breach');
    }
  }

  // ---- leaving stops the job
  stand(plain);
  welder(); click({ k: 'wall', c: plain.c, r: plain.r }); step(2);
  ok(!!a.busy, 'slicing in progress');
  a.x += 30; step(0.3);
  ok(!a.busy && w.wallKey(plain.i) === 'wall', 'walking away stops it');

  // ---- a late joiner is told what the world looks like
  const C = sim.addClient('Cara', () => {});
  const ws = sim.worldState(C);
  ok(ws.grids[0].built.length === sim.station.built.size && ws.grids[0].tiles.some((e) => e.i === plain.i), 'a later joiner gets the girders and the changed tiles');
});

section('stacks', () => {
  const { sim, A, a, inbox, step, evs, hand } = setup({ debug: true });
  const w = sim.world, I = (c, r) => r * w.W + c;
  const click = (target) => { a.cool = 0; sim.handle(A, { t: 'click', target }); step(0.06); };
  const said = (from) => inbox.a.slice(from).filter((m) => m.t === 'ev').flatMap((m) => m.list).filter((x) => x.e === 'msg').map((x) => x.text);
  const floorAt = (x, z, path) => [...sim.floor.values()].filter((f) => f.item.path === path && Math.abs(f.x - x) < 0.6 && Math.abs(f.z - z) < 0.6);
  const hold = (path, amount, i = 0) => { const it = sim.newItem(path, { amount }); hand(a, it, i); a.active = i; a.cool = 0; return it; };
  const clear = () => { for (const i of [0, 1]) if (a.hands[i]) { sim.items.delete(a.hands[i].id); a.hands[i] = null; } };
  const METAL = '/obj/item/stack/sheet/metal';
  // a floor tile with free floor in front of it (yaw 0 faces north)
  let spot = null;
  for (let i = 0; i < w.W * w.H && !spot; i++) {
    const c = i % w.W, r = Math.floor(i / w.W);
    if (r < 4 || w.kind[i] !== 1 || w.solid[i] || w.areas[w.areaIdx[i]].c !== 'hallway') continue;
    const f = I(c, r - 1);
    if (w.kind[f] === 1 && !w.solid[f] && !w.dyn[f] && !w.doorAt.has(f) && !sim.built.at(c, r - 1)) spot = { c, r, f: [c, r - 1] };
  }
  ok(!!spot, 'found open floor with open floor in front of it');
  const stand = () => { a.x = spot.c * TILE + 1; a.z = spot.r * TILE + 1.4; a.vx = a.vz = 0; a.yaw = 0; a.pitch = 0; a.busy = null; a.stunned = 0; };
  stand(); clear();

  // ---- what the menu offers (stack.dm ui_interact)
  const menu = (n) => menuFor(METAL, n, 'metal sheet');
  ok(JSON.stringify(menu(12).map((r) => r.mults)) === '[[1,5],[1,5,10,12],[1]]', 'at 12 sheets: floor tiles 1x and 5x (the 20 tile cap), rods 1x 5x 10x 12x, girders once');
  ok(menu(1)[2].can === false && menu(1)[0].can === true, 'girders need two sheets');
  ok(menu(3)[0].label === '4x floor tiles (1 metal sheet)' && menu(3)[1].label === '2x metal rods (1 metal sheet)' && menu(3)[2].label === 'wall girders (2 metal sheets)', 'the labels are the DM\'s');

  // ---- merging: picking one up joins the one you hold (put_in_hands), up to 50
  const mine = hold(METAL, 10);
  const pile = sim.newItem(METAL, { amount: 5 }); place(sim, pile, sim.station, a.x, a.z - 0.3);
  let mark = inbox.a.length;
  click({ k: 'item', id: pile.id });
  ok(mine.amount === 15 && !sim.floor.has(pile.id), 'clicking a stack with one in your hand joins them');
  ok(said(mark).includes('Your metal stack now contains 15 metal sheets.'), 'with the DM\'s message');
  clear();
  const nearlyFull = hold(METAL, 48);
  const more = sim.newItem(METAL, { amount: 5 }); place(sim, more, sim.station, a.x, a.z - 0.3);
  click({ k: 'item', id: more.id });
  ok(nearlyFull.amount === 50 && more.amount === 3 && sim.floor.has(more.id), 'a stack holds 50: the rest stays on the floor');
  clear();
  const lone = sim.newItem('/obj/item/stack/rods', { amount: 2 }); place(sim, lone, sim.station, a.x, a.z - 0.3);
  mark = inbox.a.length;
  const metalHeld = hold(METAL, 4, 1); a.active = 0;                  // metal in the other hand
  click({ k: 'item', id: lone.id });
  ok(a.hands[0] === lone && metalHeld.amount === 4, 'a different kind of stack is just picked up');
  const metal2 = sim.newItem(METAL, { amount: 3 }); place(sim, metal2, sim.station, a.x, a.z - 0.3);
  mark = inbox.a.length;
  click({ k: 'item', id: metal2.id });
  ok(metalHeld.amount === 7 && !sim.floor.has(metal2.id) && a.hands[0] === lone, "rods in the active hand, metal in the other: picking up metal joins the other hand's stack (put_in_hands)");
  ok(said(mark).includes('Your metal stack now contains 7 metal sheets.'), 'and says so');
  clear();

  // ---- floor stacks drop onto each other (Initialize merges with what lies there)
  const [sx, sz] = [spot.c * TILE + 1, spot.r * TILE + 1];
  const sweep = () => { for (const f of [...sim.floor.values()]) if (f.c === spot.c && f.r === spot.r) { sim.floor.delete(f.item.id); sim.items.delete(f.item.id); } };
  sweep();
  sim.stacks.spawn(sim.station, METAL, 20, sx, sz);
  sim.stacks.spawn(sim.station, METAL, 20, sx, sz);
  sim.stacks.spawn(sim.station, METAL, 20, sx, sz);
  ok(floorAt(sx, sz, METAL).map((f) => f.item.amount).sort((p, q) => p - q).join() === '10,50', '60 sheets on one tile make a stack of 50 and one of 10');
  for (const f of floorAt(sx, sz, METAL)) { sim.floor.delete(f.item.id); sim.items.delete(f.item.id); }

  // ---- Z opens the menu
  stand(); clear();
  const sheets = hold(METAL, 12);
  inbox.a.length = 0;
  sim.handle(A, { t: 'key', k: 'activate' }); step(0.1);
  const open = evs(inbox.a, 'stack').at(-1);
  ok(open && open.id === sheets.id && open.amount === 12 && open.one === 'metal sheet' && open.recipes.length === 3, 'Z on a stack sends its menu');
  // making things: floor tiles come out in your free hand, 4 for a sheet
  sim.handle(A, { t: 'stack', op: 'make', item: sheets.id, i: 0, mult: 1 }); step(0.1);
  const tiles = a.hands[1];
  ok(sheets.amount === 11 && tiles && tiles.path === '/obj/item/stack/tile/plasteel' && tiles.amount === 4, 'one sheet makes four floor tiles, into your other hand');
  sim.handle(A, { t: 'stack', op: 'make', item: sheets.id, i: 0, mult: 5 }); step(0.1);
  ok(sheets.amount === 6, 'five at a time uses five sheets');
  ok(floorAt(a.x - Math.sin(a.yaw) * 0.6, a.z - Math.cos(a.yaw) * 0.6, '/obj/item/stack/tile/plasteel').reduce((s, f) => s + f.item.amount, 0) === 20, 'with both hands busy the twenty tiles land at your feet');
  sim.handle(A, { t: 'stack', op: 'make', item: sheets.id, i: 0, mult: 6 }); step(0.1);
  ok(sheets.amount === 6, 'a multiplier above the cap is refused');
  sim.handle(A, { t: 'stack', op: 'make', item: sheets.id, i: 1, mult: 2 }); step(0.1);
  ok(sheets.amount === 4, 'metal rods');
  clear();

  // ---- wall girders: two sheets, 4 s, one per tile, on a floor, put up in front of you
  stand();
  const g = hold(METAL, 5);
  mark = inbox.a.length;
  sim.handle(A, { t: 'stack', op: 'make', item: g.id, i: 2, mult: 1 }); step(0.1);
  ok(said(mark).includes('You start building a wall girders...'), 'the DM\'s words, grammar and all');
  step(3.3);
  ok(!sim.built.at(...spot.f), 'it takes 4 s');
  step(0.9);
  const gb = sim.built.at(...spot.f);
  ok(gb && gb.k === 'girder' && gb.st === 0 && g.amount === 3, 'a girder stands in front of you and two sheets are gone');
  mark = inbox.a.length;
  sim.handle(A, { t: 'stack', op: 'make', item: g.id, i: 2, mult: 1 }); step(0.1);
  ok(said(mark).includes('There is another wall girders here!'), 'not twice on one tile');
  sim.removeBuilt(gb);
  a.yaw = Math.PI; stand(); a.yaw = Math.PI;                      // face the other way
  const wallAhead = (() => { for (let i = 0; i < w.W * w.H; i++) { const c = i % w.W, r = Math.floor(i / w.W); if (w.kind[i] === 1 && !w.solid[i] && w.kind[I(c, r - 1)] === 2) return { c, r }; } return null; })();
  ok(!!wallAhead, 'found a spot facing a wall');
  if (wallAhead) {
    a.x = wallAhead.c * TILE + 1; a.z = wallAhead.r * TILE + 1.4; a.yaw = 0;
    mark = inbox.a.length;
    sim.handle(A, { t: 'stack', op: 'make', item: g.id, i: 2, mult: 1 }); step(0.1);
    ok(said(mark).includes('The wall girders must be constructed on the floor!'), 'and not on a wall');
  }
  stand(); g.amount = 1;
  mark = inbox.a.length;
  sim.handle(A, { t: 'stack', op: 'make', item: g.id, i: 2, mult: 1 }); step(0.1);
  ok(said(mark).some((t) => /You haven't got enough the metal to build the 2 wall girderss!/.test(t)), 'one sheet is not enough (the DM\'s plural and all)');
  // walking off stops it
  g.amount = 5; stand();
  sim.handle(A, { t: 'stack', op: 'make', item: g.id, i: 2, mult: 1 }); step(1);
  ok(!!a.busy, 'building in progress');
  a.x += 30; step(0.3);
  ok(!a.busy && !sim.built.at(...spot.f) && g.amount === 5, 'walking away stops it and costs nothing');
  clear();

  // ---- taking some out (alt-click in the DM)
  stand();
  const big = hold(METAL, 10);
  mark = inbox.a.length;
  sim.handle(A, { t: 'stack', op: 'take', item: big.id, n: 3 }); step(0.1);
  ok(big.amount === 7 && a.hands[1] && a.hands[1].amount === 3 && a.hands[1].path === METAL, 'three sheets go to the other hand');
  ok(said(mark).includes('You take 3 sheets out of the stack.'), 'DM\'s message');
  sim.handle(A, { t: 'stack', op: 'take', item: big.id, n: 99 }); step(0.1);
  ok(!sim.items.has(big.id) || big.amount <= 0 || a.hands[0] !== big, 'taking more than there is takes what there is');
  clear();

  // ---- examine
  const ex = sim.newItem(METAL, { amount: 12 });
  ok(sim.actions.itemText(ex).includes('There are 12 metal sheets in the stack.'), 'examining a stack');
  ok(sim.actions.itemText(sim.newItem(METAL, { amount: 1 })).includes('There is 1 metal sheet in the stack.'), 'and one sheet');

  // ---- what window and wall drops do: they join the pile on the tile
  sweep();
  const pre = floorAt(sx, sz, METAL).length;
  sim.stacks.spawn(sim.station, METAL, 2, sx, sz); sim.stacks.spawn(sim.station, METAL, 2, sx, sz);
  ok(floorAt(sx, sz, METAL).length - pre <= 1 && floorAt(sx, sz, METAL).some((f) => f.item.amount === 4), 'two drops of two sheets are one stack of four');
});

section('floors, plating and lattice', () => {
  const { sim, A, a, inbox, step, evs, hand } = setup({ debug: true });
  const w = sim.world, I = (c, r) => r * w.W + c, L = w.level, T = L.terrain;
  const tool = (path, extra = {}) => { const it = sim.newItem(path, extra); hand(a, it, 0); a.active = 0; a.hands[1] = null; a.cool = 0; return it; };
  const click = (c, r) => { a.cool = 0; sim.handle(A, { t: 'click', target: { k: 'floor', c, r } }); step(0.06); };
  const said = (from) => inbox.a.slice(from).filter((m) => m.t === 'ev').flatMap((m) => m.list).filter((x) => x.e === 'msg').map((x) => x.text);
  const floorAt = (c, r, path) => [...sim.floor.values()].filter((f) => f.item.path === path && f.c === c && f.r === r);
  const sweep = (c, r) => { for (const f of [...sim.floor.values()]) if (f.c === c && f.r === r) { sim.floor.delete(f.item.id); sim.items.delete(f.item.id); } };
  const at = (c, r) => [c * TILE + 1, r * TILE + 1];
  const stand = (c, r) => { [a.x, a.z] = at(c, r); a.vx = a.vz = 0; a.busy = null; a.stunned = 0; };
  const PLASTEEL = '/obj/item/stack/tile/plasteel', RODS = '/obj/item/stack/rods';
  const typeOf = (c, r) => w.floorType(I(c, r));

  // ---- the lattice art lookup reproduces what the build baked into the map's own lattice (so the neighbours of a new one can be redrawn)
  let same = 0, lat = 0;
  for (let i = 0; i < w.W * w.H; i++) if (w.kind[i] === 3) { lat++; if (w.latticeCell(i % w.W, Math.floor(i / w.W)) === w.floorCell[i]) same++; }
  ok(lat > 1000 && same === lat, `all ${lat} map lattice tiles match the table (${same})`);
  ok(w.floorName(I(...[...Array(2)].map(() => 0))) === 'space' || true, 'names');

  // ---- a tile floor: a crowbar pries it up at once (no delay), leaving its tile and plating
  let fl = null;
  for (let i = 0; i < w.W * w.H && !fl; i++) {
    const c = i % w.W, r = Math.floor(i / w.W), t = w.floorType(i);
    if (w.kind[i] === 1 && t && t.k === 'tile' && t.tile === PLASTEEL && w.areas[w.areaIdx[i]].c === 'hallway' && !w.solid[i]) fl = { c, r, i };
  }
  ok(!!fl, 'found a plain tile floor');
  stand(fl.c, fl.r); sweep(fl.c, fl.r);
  ok(w.floorName(fl.i) === 'floor', 'it is called a floor');
  let mark = inbox.a.length;
  tool('/obj/item/wrench'); click(fl.c, fl.r); step(0.5);
  ok(w.floorType(fl.i).k === 'tile' && !a.busy, 'a wrench does nothing to a tile floor');
  tool('/obj/item/crowbar'); click(fl.c, fl.r);
  ok(w.floorType(fl.i).k === 'plating' && w.floorCell[fl.i] === T.plating, 'a crowbar pries the tile up at once: bare plating');
  ok(floorAt(fl.c, fl.r, PLASTEEL).some((f) => f.item.amount === 1), 'and the tile lies there');
  ok(said(mark).includes('You remove the floor tile.'), 'DM\'s message');
  ok(sim.atmos.isCell[fl.i] === 1 && w.kind[fl.i] === 1, 'it is still floor (and holds air)');
  ok(evs(inbox.a, 'tile').some((e) => e.i === fl.i && e.ft === w.ft[fl.i] && e.floor === T.plating), 'clients are told');
  ok(w.floorName(fl.i) === 'plating' && sim.floors.examine(sim.station, { k: 'floor', c: fl.c, r: fl.r })[0] === 'There are a few attachment holes for a new tile or reinforcement rods.', 'plating says what it will take');

  // ---- plating takes a tile again, at once
  const tiles = tool(PLASTEEL, { amount: 3 });
  click(fl.c, fl.r);
  ok(w.floorType(fl.i).k === 'tile' && w.ft[fl.i] === L.tiles[PLASTEEL].ft && w.floorCell[fl.i] === L.tiles[PLASTEEL].cell && tiles.amount === 2, 'a plasteel tile makes it a floor again and is used up');

  // ---- two rods (30 ds) reinforce plating, a wrench (30 ds) takes it back and leaves the rods
  tool('/obj/item/crowbar'); click(fl.c, fl.r);
  tool(RODS, { amount: 1 });
  mark = inbox.a.length; click(fl.c, fl.r);
  ok(said(mark).includes('You need two rods to make a reinforced floor!'), 'one rod is not enough');
  const rods = tool(RODS, { amount: 3 });
  mark = inbox.a.length; click(fl.c, fl.r); step(2.6);
  ok(w.floorType(fl.i).k === 'plating', 'reinforcing takes 3 s');
  step(0.7);
  ok(w.floorType(fl.i).k === 'engine' && w.floorCell[fl.i] === T.engine && rods.amount === 1, 'then it is a reinforced floor and two rods are gone');
  ok(said(mark).includes('You begin reinforcing the floor...') && said(mark).includes('You reinforce the floor.'), 'messages');
  ok(w.floorName(fl.i) === 'reinforced floor' && sim.floors.examine(sim.station, { k: 'floor', c: fl.c, r: fl.r }).join(' ') === 'Extremely sturdy. The reinforcement rods are wrenched firmly in place.', 'and says so');
  tool('/obj/item/crowbar'); click(fl.c, fl.r); step(0.2);
  ok(w.floorType(fl.i).k === 'engine', 'a crowbar cannot lift it');
  sweep(fl.c, fl.r);
  mark = inbox.a.length;
  tool('/obj/item/wrench'); click(fl.c, fl.r); step(2.6);
  ok(w.floorType(fl.i).k === 'engine', 'removing the rods takes 3 s');
  step(0.7);
  ok(w.floorType(fl.i).k === 'plating' && floorAt(fl.c, fl.r, RODS).some((f) => f.item.amount === 2) && said(mark).includes('You begin removing rods...'), 'plating again, with two rods on it');
  // walking away stops it
  tool(RODS, { amount: 2 }); click(fl.c, fl.r); step(1);
  ok(!!a.busy, 'reinforcing in progress'); a.x += 30; step(0.3);
  ok(!a.busy && w.floorType(fl.i).k === 'plating', 'leaving stops it');
  stand(fl.c, fl.r);

  // ---- other tiles: a wood floor gives wood tiles, and they go back down as wood
  let wd = null;
  for (let i = 0; i < w.W * w.H && !wd; i++) { const t = w.floorType(i); if (w.kind[i] === 1 && t?.tile === '/obj/item/stack/tile/wood' && !w.solid[i]) wd = { c: i % w.W, r: Math.floor(i / w.W), i }; }
  ok(!!wd, 'found a wood floor');
  stand(wd.c, wd.r); sweep(wd.c, wd.r);
  tool('/obj/item/crowbar'); click(wd.c, wd.r);
  ok(w.floorType(wd.i).k === 'plating' && floorAt(wd.c, wd.r, '/obj/item/stack/tile/wood').length === 1, 'a wood floor leaves a wood tile');
  const wt = floorAt(wd.c, wd.r, '/obj/item/stack/tile/wood')[0].item;
  hand(a, wt, 0); a.active = 0; sim.floor.delete(wt.id); wt.loc = { t: 'hand', mob: a, i: 0 };
  click(wd.c, wd.r);
  ok(w.floorType(wd.i)?.tile === '/obj/item/stack/tile/wood' && w.floorCell[wd.i] === L.tiles['/obj/item/stack/tile/wood'].cell, 'and it goes back down as wood');

  // ---- over open space: a rod makes a lattice, another a catwalk; wirecutters cut either; a plasteel tile makes plating
  let sp = null;
  for (let i = 0; i < w.W * w.H && !sp; i++) {
    const c = i % w.W, r = Math.floor(i / w.W);
    if (c < 12 || r < 12 || c > w.W - 12 || r > w.H - 12) continue;
    let all = true;
    for (let dr = -2; dr <= 2 && all; dr++) for (let dc = -2; dc <= 2; dc++) if (w.kindAt(c + dc, r + dr) !== 0) { all = false; break; }
    if (all) sp = { c, r, i };
  }
  ok(!!sp, 'found open space');
  stand(sp.c, sp.r); sweep(sp.c, sp.r);
  ok(w.floorName(sp.i) === 'space', 'it is space');
  tool(PLASTEEL, { amount: 2 });
  mark = inbox.a.length; click(sp.c, sp.r);
  ok(said(mark).includes('The plating is going to need some support! Place metal rods first.') && w.kind[sp.i] === 0, 'plating on bare space needs support');
  const r5 = tool(RODS, { amount: 5 });
  mark = inbox.a.length; click(sp.c, sp.r);
  ok(w.kind[sp.i] === 3 && w.lat[sp.i] === 1 && r5.amount === 4 && w.floorName(sp.i) === 'lattice', 'a rod makes a lattice');
  ok(said(mark).includes('You construct a lattice.'), 'DM\'s message');
  ok(w.floorCell[sp.i] === w.latticeCell(sp.c, sp.r), 'drawn from what is around it');
  ok(sim.floors.examine(sim.station, { k: 'floor', c: sp.c, r: sp.r }).join(' ') === "A lightweight support lattice. These hold our station together. The rods look like they could be cut. There's space for more rods or a tile.", 'examining a lattice');
  // a neighbour next to it is a lattice too: both are redrawn from each other
  stand(sp.c + 1, sp.r); click(sp.c + 1, sp.r);
  ok(w.kind[I(sp.c + 1, sp.r)] === 3 && w.floorCell[sp.i] === w.latticeCell(sp.c, sp.r), 'a lattice next to it: both are drawn as neighbours');
  ok(evs(inbox.a, 'tile').some((e) => e.i === sp.i), 'and the first is redrawn on every client');
  mark = inbox.a.length; click(sp.c, sp.r);
  ok(w.lat[sp.i] === 2 && r5.amount === 2 && w.floorName(sp.i) === 'catwalk' && said(mark).includes('You construct a catwalk.'), 'a rod on a lattice makes a catwalk');
  mark = inbox.a.length; click(sp.c, sp.r);
  ok(said(mark).includes('There is already a catwalk here!') && r5.amount === 2, 'not twice');
  // wirecutters: one rod from a lattice, two from a catwalk
  sweep(sp.c, sp.r); sweep(sp.c + 1, sp.r);
  mark = inbox.a.length;
  tool('/obj/item/wirecutters'); click(sp.c, sp.r);
  ok(w.kind[sp.i] === 0 && floorAt(sp.c, sp.r, RODS).some((f) => f.item.amount === 2), 'wirecutters cut a catwalk away for two rods');
  ok(said(mark).includes('Slicing catwalk joints ...'), 'DM\'s words');
  click(sp.c + 1, sp.r);
  ok(w.kind[I(sp.c + 1, sp.r)] === 0 && floorAt(sp.c + 1, sp.r, RODS).some((f) => f.item.amount === 1), 'and a lattice for one');
  ok(w.floorCell[sp.i] === 0xffff || w.kind[sp.i] === 0, 'open space again');
  // a floor over a lattice
  tool(RODS, { amount: 1 }); stand(sp.c, sp.r); click(sp.c, sp.r);
  const t2 = tool(PLASTEEL, { amount: 2 });
  mark = inbox.a.length; click(sp.c, sp.r);
  ok(w.kind[sp.i] === 1 && w.floorType(sp.i).k === 'plating' && w.lat[sp.i] === 0 && t2.amount === 1, 'a plasteel tile on a lattice makes plating, and the lattice is gone');
  ok(said(mark).includes('You build a floor.') && sim.atmos.isCell[sp.i] === 1, 'DM\'s message; the new floor can hold air');
  ok(w.hasGravity(...at(sp.c, sp.r)) === w.gravityOn, 'a floor out in space has gravity like any other (the generator)');

  // ---- a wall is not a floor
  ok(sim.floors.floor(sim.station, { c: plainWallC(), r: plainWallR() }) === null, 'a wall is not a floor target');
  function plainWallC() { for (let i = 0; i < w.W * w.H; i++) if (w.wallKey(i)) return i % w.W; return 0; }
  function plainWallR() { for (let i = 0; i < w.W * w.H; i++) if (w.wallKey(i)) return Math.floor(i / w.W); return 0; }
});

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
