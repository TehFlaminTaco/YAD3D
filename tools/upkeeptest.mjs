// Engineering upkeep: lights that break and are put right, welder fuel and the tanks, the T-ray scanner: node tools/upkeeptest.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSimData } from '../src/sim/load.js';
import { initPhysics } from '../src/shared/physics.js';
import { Sim } from '../src/sim/sim.js';
import { Replica } from '../src/client/state.js';
import { SIM_DT, TILE } from '../src/shared/config.js';
import { CH, lightMode } from '../src/shared/power.js';
import { LIGHT_WATTS } from '../src/shared/powerdata.js';
import { LIGHT } from '../src/sim/lights.js';
import { attach, detach, allItems } from '../src/sim/inventory.js';

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
  const g = sim.station, a = A.mob;
  const events = () => inbox.filter((m) => m.t === 'ev').flatMap((m) => m.list);
  const msgs = () => events().filter((e) => e.e === 'msg').map((e) => e.text);
  const hold = (p, hand = 0) => {
    const old = a.hands[hand];
    if (old) detach(sim, old);
    const it = sim.newItem(p);
    attach(sim, it, { t: 'hand', mob: a, i: hand });
    a.active = hand;
    return it;
  };
  const stand = (x, z, l = 0) => { a.grid = g; a.x = x; a.z = z; a.l = l; a.vx = a.vz = 0; a.cool = 0; a.stunned = 0; };
  const click = (target) => { inbox.length = 0; a.cool = 0; sim.handle(A, { t: 'click', target, yaw: 0, pitch: 0 }); step(0.1); };
  step(5);
  return { sim, A, a, g, inbox, step, events, msgs, hold, stand, click };
}

section('light fixtures', () => {
  const { sim, g, a, step, events, msgs, hold, stand, click } = round();
  const L = g.props.lights.find((x) => x.kind === 'tube' && g.power.lightsOn(x.area));
  ok(!!L, 'there are lit tube fixtures');
  stand(L.x, L.z, L.l | 0);
  const lamp = { k: 'light', g: g.id, idx: L.idx };
  const watts = () => g.powersim.base[L.area * 3 + CH.LIGHT];
  const w0 = watts();
  ok(L.status === LIGHT.OK && lightMode(L, g.power, g.world.areas).on, 'a fixture starts whole, and lit');
  // take it out with bare hands: it is lit and you have no gloves
  const b0 = a.body.burn;
  click(lamp);
  ok(msgs().includes('You try to remove the light tube, but you burn your hand on it!') && a.body.burn > b0 && L.status === LIGHT.OK, 'a lit lamp burns your bare hand, and stays');
  const gl = sim.newItem('/obj/item/clothing/gloves/color/yellow');
  attach(sim, gl, { t: 'slot', mob: a, slot: 'gloves' });
  click(lamp);
  const tube = a.hands.find((h) => h && h.path === '/obj/item/light/tube');
  ok(msgs().includes('You remove the light tube.') && L.status === LIGHT.EMPTY && !!tube, 'with gloves you take the tube out, into your hand');
  ok(watts() === w0 - LIGHT_WATTS.tube && !lightMode(L, g.power, g.world.areas).on, 'the room draws less and the fixture is dark');
  const ev = events().filter((e) => e.e === 'light');
  ok(ev.length === 1 && ev[0].i === L.idx && ev[0].st === LIGHT.EMPTY, 'and everyone is told');
  // an empty fixture, with an empty hand
  a.active = 1 - a.hands.indexOf(tube);
  click(lamp);
  ok(msgs().includes('There is no tube in this light!'), 'an empty fixture has nothing to take out');
  // put it back
  a.active = a.hands.indexOf(tube);
  click(lamp);
  ok(msgs().includes('You insert the light tube.') && L.status === LIGHT.OK && watts() === w0 && lightMode(L, g.power, g.world.areas).on, 'putting the tube back lights it again');
  // a bulb will not go in
  hold('/obj/item/light/bulb');
  click(lamp);
  ok(msgs().includes('There is a tube already inserted!'), 'a fixture that has its tube does not take another');
  sim.lights.setStatus(g, L, LIGHT.BROKEN);
  click(lamp);
  ok(msgs().includes('This type of light requires a tube!') && L.status === LIGHT.BROKEN, 'and a bulb does not fit a tube fixture');
  // break and replace
  sim.lights.setStatus(g, L, LIGHT.OK);
  ok(sim.lights.breakLight(g, L) && L.status === LIGHT.BROKEN && !lightMode(L, g.power, g.world.areas).on && watts() === w0 - LIGHT_WATTS.tube, 'a smashed lamp is dark and uses nothing');
  hold('/obj/item/light/tube', 0);
  hold('/obj/item/light/bulb', 1);
  a.active = 0;
  click(lamp);
  ok(msgs().includes('You replace the light tube.') && L.status === LIGHT.OK && !!a.hands.find((h) => h && h.path === '/obj/item/light/tube/broken'), 'a new tube replaces it, and the broken one comes out');
  ok(sim.lights.burnOut(g, L) && L.status === LIGHT.BURNED && !lightMode(L, g.power, g.world.areas).on, 'a lamp can burn out');
  const old = sim.lights.item(L);
  ok(old.status === LIGHT.BURNED && old.desc === 'A burnt-out light tube.', 'and the tube that comes out says so');
  // a hit with something breaks it sometimes
  sim.lights.setStatus(g, L, LIGHT.OK);
  a.intent = 'harm';
  let smashed = false;
  for (let k = 0; k < 60 && !smashed; k++) {
    hold('/obj/item/crowbar');
    click(lamp);
    smashed = L.status === LIGHT.BROKEN;
  }
  ok(smashed, 'hitting a lamp with a crowbar breaks it in the end');
  void step;
});

section('the boxes of lights', () => {
  const { sim, g } = round();
  const mixed = sim.newItem('/obj/item/storage/box/lights/mixed');
  ok(mixed.contents.filter((i) => i.path === '/obj/item/light/tube').length === 14 && mixed.contents.filter((i) => i.path === '/obj/item/light/bulb').length === 7, 'a box of replacement lights holds 14 tubes and 7 bulbs');
  ok(sim.newItem('/obj/item/storage/box/lights/tubes').contents.length === 21 && sim.newItem('/obj/item/storage/box/lights/bulbs').contents.length === 21, 'the boxes of tubes and of bulbs hold 21');
  const boxes = [...sim.floor.values()].filter((r) => r.item.path.startsWith('/obj/item/storage/box/lights'));
  const stocked = [...g.props.items].length;
  ok(boxes.length >= 3 && boxes.every((r) => r.item.contents.length > 0), `the replacement lights on the map are full (${boxes.length} boxes of ${stocked} things)`);
  ok(g.props.lights.every((L) => L.ss && L.ss.length === 3 && L.status === 0), 'every fixture starts whole, and has its three other pictures');
});

section('blasts smash lamps', () => {
  const { sim, g } = round();
  const L = g.props.lights[10];
  const n = sim.lights.blast(g, L.c, L.r, 5);
  ok(n > 0 && g.props.lights.some((x) => x.status === LIGHT.BROKEN), `lamps near an explosion break (${n})`);
  ok(g.props.lights.filter((x) => x.status).length === n, 'and no others');
});

section('welding fuel and the tanks', () => {
  const { sim, A, g, a, step, msgs, hold, stand, click, events } = round();
  const w = hold('/obj/item/weldingtool');
  ok(w.fuel > 0 && !w.lit, `a welder starts with fuel (${w.fuel}) and off`);
  const full = w.fuel;
  sim.handle(A, { t: 'key', k: 'activate' });
  ok(w.lit === true, 'activating it lights it');
  step(28);
  ok(w.fuel === full - 1, 'lit, it burns a unit of fuel every 26 seconds');
  w.fuel = 1;
  step(28);
  ok(w.fuel === 0 && !w.lit, 'and goes out when it runs dry');
  // a tank with room to stand beside it
  let tank = null, spot = null;
  for (const it of g.props.interact) {
    if (it.kind !== 'prop' || !/reagent_dispensers\/fueltank/.test(it.path || '')) continue;
    for (const [dx, dz] of [[-1.3, 0], [1.3, 0], [0, -1.3], [0, 1.3]]) {
      if (!g.world.collides(it.x + dx, it.z + dz, 0.3, null, false, it.l | 0)) { tank = it; spot = [it.x + dx, it.z + dz]; break; }
    }
    if (tank) break;
  }
  ok(!!tank && !!spot, 'the map has a fuel tank with room to stand beside it');
  stand(spot[0], spot[1], tank.l | 0);
  const target = { k: 'prop', g: g.id, idx: tank.idx };
  w.fuel = 5; w.lit = false;
  click(target);
  ok(w.fuel === full && tank.units === 1000 - (full - 5) && /^You refill the .+\.$/.test(msgs().find((t) => /refill/.test(t)) || ''), 'an unlit welder is refilled from the tank, up to its limit');
  click(target);
  ok(msgs().some((t) => /is already full!$/.test(t)), 'not when it is full');
  w.lit = true; w.fuel = 10; a.hp = 100;
  const hurt0 = a.body.brute + a.body.burn;
  click(target);
  ok(tank.gone && msgs().includes('That was stupid of you.') && (a.body.brute + a.body.burn > hurt0 || a.dead), 'refilling with it lit is a mistake: the tank goes up, and hurts you');
  ok(events().some((e) => e.e === 'pg' && e.i === tank.idx), 'everyone is told it is gone');
  ok(!g.world.boxes.get(g.world.idx(tank.c, tank.r, tank.l | 0))?.includes(tank), 'and it no longer blocks the tile');
});

section('a shot fuel tank', () => {
  const { sim, A, g, a, msgs, hold, stand, events, step } = round();
  const w = g.world;
  let tank = null, from = null;
  for (const it of g.props.interact) {
    if (it.kind !== 'prop' || !/reagent_dispensers\/fueltank/.test(it.path || '')) continue;
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const x = it.x + dx * 4, z = it.z + dz * 4;
      if (!w.collides(x, z, 0.3, null, false, it.l | 0) && w.raycast(x, z, -dx, -dz, 4, 'shot', it.l | 0) >= 4 - 1e-3) { tank = it; from = [x, z, dx, dz]; break; }
    }
    if (tank) break;
  }
  ok(!!tank, 'a fuel tank with a clear line to it');
  stand(from[0], from[1], tank.l | 0);
  a.yaw = Math.atan2(from[2], from[3]); a.pitch = 0;
  hold('/obj/item/gun/energy/laser');
  a.cool = 0;
  sim.handle(A, { t: 'click', target: { k: 'none' } });
  step(0.2);
  ok(tank.gone === true, 'a laser through it blows it up');
  ok(events().some((e) => e.e === 'pg' && e.i === tank.idx), 'and everyone is told');
  void msgs;
});

section('the T-ray scanner', () => {
  const { sim, A, a, step } = round();
  const t = allItems(a).find((i) => i.def.tray);
  ok(!!t && !t.on, 'the engineer has one in a pocket, off');
  ok(sim.selfState(A).tray === false, 'and the client is not told to show the cables');
  detach(sim, t);
  if (a.hands[0]) detach(sim, a.hands[0]);
  attach(sim, t, { t: 'hand', mob: a, i: 0 });
  a.active = 0;
  sim.handle(A, { t: 'key', k: 'activate' });
  step(0.2);
  ok(t.on === true && sim.selfState(A).tray === true, 'activating it turns it on, and the client is told');
  sim.handle(A, { t: 'key', k: 'activate' });
  ok(t.on === false && sim.selfState(A).tray === false, 'and off again');
});

section('the clients hear of it', () => {
  const { sim, g, A, inbox, step, events } = round();
  const L = g.props.lights[3];
  const tank = g.props.interact.find((it) => it.kind === 'prop' && /reagent_dispensers\/fueltank/.test(it.path || ''));
  sim.lights.setStatus(g, L, LIGHT.BURNED);
  sim.tanks.boom(tank);
  step(0.2);
  const late = [];
  sim.addClient('Bob', (m) => late.push(m));
  const welcome = late.find((m) => m.t === 'welcome');
  const gs = welcome.grids.find((x) => x.g === g.id);
  ok(gs.lights.some(([i, st]) => i === L.idx && st === LIGHT.BURNED) && gs.gone.includes(tank.idx), 'a joiner is told which lamps are out and which tanks are gone');
  const rep = new Replica({ level: DATA.level, rects: DATA.rects }, { ...welcome, you: A.id });
  const rg = rep.grids.get(g.id);
  ok(rg.props.lights[L.idx].status === LIGHT.BURNED && rg.props.interact[tank.idx].gone === true, 'and the replica has them so');
  const L2 = g.props.lights.find((x) => !x.status);
  inbox.length = 0;
  sim.lights.setStatus(g, L2, LIGHT.BROKEN);
  step(0.2);
  const ev = events().filter((e) => e.e === 'light');
  ok(ev.length === 1 && ev[0].g === g.id, 'a lamp breaking is one event');
  rep.apply(ev[0]);
  ok(rg.props.lights[L2.idx].status === LIGHT.BROKEN, 'which the replica applies');
  void TILE;
});

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
