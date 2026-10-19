// Behavioural regression tests for the sim: node tools/simtest2.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSimData } from '../src/sim/load.js';
import { Sim } from '../src/sim/sim.js';
import { SIM_DT, TILE } from '../src/shared/config.js';
import { CL } from '../src/shared/closets.js';
import { recalc, place } from '../src/sim/inventory.js';
import { HIDE } from '../src/shared/looks.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = loadSimData(root);
let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) pass++; else { fail++; console.log('  FAIL:', name); } };

function setup() {
  const sim = new Sim(DATA, { bots: 0 });
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
  sim.breachTile(wc, wr, 'meteor');
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
  sim.breachTile(wc, wr, 'shot');
  ok(w.breached.has(win) && w.kind[win] === 1 && !w.glass[win] && !w.airBlock[win] && w.solid[win], 'a shot window opens up but the frame still blocks the way');
  ok(!w.ventsToSpace(win) && !w.ventTiles().includes(win), 'it is not a hull breach');
  ok(sim.atmos.isCell[win], 'the gap joins the gas grid');
  step(40);
  ok(sides.every(([x, y]) => sim.atmos.pressureAt(x, y) > 60), 'neither room decompresses');
  ok(!sim.terminals.alerts().html.includes('hull breach'), 'no atmosphere alarm');
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
  const find = (suffix) => cls.list.find((it) => it.path.endsWith(suffix));
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
  const em = cls.list.filter((it) => it.path.endsWith('closet/emcloset'));
  ok(em.length > 20 && em.some((it) => it.contents.length) && new Set(em.map((it) => it.contents.length)).size > 2, 'emergency closets are stocked at random (different contents each)');
  // nothing on a closed closet's tile is left outside
  ok(![...sim.floor.values()].some((f) => cls.list.some((it) => !(it.cs & CL.OPEN) && it.contents.length < 30 && it.c === f.c && it.r === f.r)), 'items under closed closets were taken in at round start (up to 30)');

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
  ok(sim.worldState(A).closets.some(([i, cs]) => i === eng.idx && cs === 0), 'the welcome lists closets that are not as the map left them');

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
  const pl = cls.list.find((it) => it.cl.pl && freeAround(it).length);
  stand(a, pl); stand(b, pl, 1);
  ok(pl.cs & CL.LOCKED, 'personal locker starts locked');
  hand(a, a.worn.id); a.worn.id = null;
  click(A, pl);
  ok(!(pl.cs & CL.LOCKED) && pl.owner === a.name, 'the first ID swiped claims it and unlocks it');
  hand(b, b.worn.id); b.worn.id = null; inbox.b.length = 0;
  click(B, pl);
  ok(texts(inbox.b).includes('Access Denied.'), "someone else's ID is refused");

  // crates stay in the way when open
  const crate = cls.list.find((it) => it.cl.hz && it.cs === 0);
  stand(a, crate); a.hands[0] = a.hands[1] = null;
  click(A, crate);
  ok((crate.cs & CL.OPEN) && blocks(crate), 'an open crate still blocks the tile');

  function place_(item, it) { item.loc = null; sim.floor.set(item.id, { item, x: it.x + 0.3, y: 0.01, z: it.z, c: it.c, r: it.r }); item.loc = { t: 'floor' }; }
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
  const cl = sim.closets.list.find((it) => it.path.endsWith('closet/emcloset') && !(it.cs & 1));
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
  // a closet with three free tiles in a row on one side of it (room to drag it along)
  const lineOf = (it) => [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dc, dr]) => [1, 2, 3].every((k) => free(it.c + dc * k, it.r + dr * k)));
  const spot = (m, x, z) => { m.x = x; m.z = z; m.vx = m.vz = 0; m.cool = 0; m.stunned = 0; };
  const tileSpot = (m, c, r) => spot(m, c * TL + TL / 2, r * TL + TL / 2);
  const ctrlClick = (c, target) => { sim.handle(c, { t: 'click', target, ctrl: true }); step(0.1); };
  const blocks = (it) => w.collides(it.x, it.z, 0.1);
  /** Walk `m` along (dx, dz) for `metres`, a quarter metre at a time, letting the world react. */
  const walk = (m, dx, dz, metres) => { for (let k = 0; k < metres / 0.25; k++) { m.x += dx * 0.25; m.z += dz * 0.25; step(0.05); } };
  const lockers = sim.closets.list.filter((it) => it.path.endsWith('closet/emcloset') && !it.anc && !(it.cs & CL.OPEN) && lineOf(it));
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
  ok(sim.people.moved().some((m) => m[0] === lk.idx && Math.abs(m[1] - lk.x) < 1e-6), 'someone who joins later is told it moved');
  const late = [];
  sim.addClient('Carol', (m) => late.push(m));
  ok(late.find((m) => m.t === 'welcome').moved.some((m) => m[0] === lk.idx && Math.abs(m[1] - lk.x) < 1e-6 && Math.abs(m[2] - lk.z) < 1e-6), 'the welcome carries moved structures');

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
  const brig = sim.closets.list.find((it) => it.anc && open(it));
  const rack = sim.props.interact.find((it) => it.path === 'structure/rack' && open(it));
  const chair = sim.props.interact.find((it) => it.path === 'structure/chair' && it.anc && open(it));
  const tank = sim.props.interact.find((it) => it.path === 'structure/reagent_dispensers/fueltank' && !it.anc && open(it));
  const crate = sim.closets.list.find((it) => it.path === 'structure/closet/crate' && !it.anc && open(it));
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
  place(sim, bar, a.x + 0.5, a.z, 0.01);
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
  const { place: placeFn } = { place: (it, x, z) => { sim.floor.set(it.id, { item: it, x, y: 0, z, c: Math.floor(x / 2), r: Math.floor(z / 2) }); it.loc = { t: 'floor' }; } };
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

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
