import { TILE, KIND, INTENTS, EYE, THROW_KICK } from '../shared/config.js';
import { floatState } from '../shared/movement.js';
import { stackKey, stackInfo, plural } from '../shared/stacks.js';
import { clamp } from '../shared/util.js';
import { storageReason, fitsSlot, describeState } from '../shared/items.js';
import {
  attach, detach, place, pickup, dropFromHand, swapHands, quickEquip, equipTo, storeIn, takeToHand, moveItem, carried,
  recalc, internalsSource, allItems, consume, mergeStack, stackNote,
} from './inventory.js';

const REACH = 3.2;

// what spills out of lockers, by class path
const LOOT = [
  ['emcloset', ['/obj/item/tank/internals/emergency_oxygen', '/obj/item/clothing/mask/breath', '/obj/item/tank/internals/emergency_oxygen']],
  ['firecloset', ['/obj/item/extinguisher', '/obj/item/clothing/head/hardhat']],
  ['toolcloset', ['/obj/item/storage/toolbox/mechanical', '/obj/item/crowbar', '/obj/item/weldingtool', '/obj/item/flashlight']],
  ['l3closet', ['/obj/item/clothing/suit/space/emergency', '/obj/item/clothing/head/helmet/space/emergency']],
  ['radiation', ['/obj/item/clothing/suit/space/emergency', '/obj/item/clothing/head/helmet/space/emergency', '/obj/item/geiger_counter']],
  ['engineering', ['/obj/item/clothing/gloves/color/yellow', '/obj/item/clothing/head/hardhat', '/obj/item/wrench', '/obj/item/stack/sheet/metal']],
  ['medical', ['/obj/item/storage/firstaid/regular', '/obj/item/stack/medical/bruise_pack', '/obj/item/stack/medical/ointment']],
  ['security', ['/obj/item/melee/baton', '/obj/item/flashlight', '/obj/item/stock_parts/cell/high']],
  ['captain', ['/obj/item/gun/energy/e_gun', '/obj/item/stock_parts/cell/high']],
  ['crate', ['/obj/item/stack/sheet/metal', '/obj/item/stack/sheet/metal', '/obj/item/weldingtool', '/obj/item/stock_parts/cell']],
  ['rack', ['/obj/item/crowbar', '/obj/item/wrench']],
  ['closet', ['/obj/item/flashlight', '/obj/item/storage/box']],
];

const VEND = [
  ['cola', '/obj/item/reagent_containers/food/drinks/soda_cans/cola', 'a can of space cola'],
  ['snack', '/obj/item/reagent_containers/food/snacks/chips', 'a bag of chips'],
  ['coffee', '/obj/item/reagent_containers/food/drinks/coffee', 'a cup of coffee'],
  ['medical', '/obj/item/reagent_containers/hypospray/medipen', 'a medipen'],
  ['wallmed', '/obj/item/reagent_containers/hypospray/medipen', 'a medipen'],
  ['engivend', '/obj/item/clothing/head/hardhat', 'a hard hat'],
  ['tool', '/obj/item/screwdriver', 'a screwdriver'],
];

const COMPUTER_TYPES = [
  ['crew', 'crew'], ['atmos', 'atmos'], ['station_alert', 'alerts'], ['communications', 'comms'], ['monitor', 'power'],
  ['security', 'records'], ['secure_data', 'records'], ['med_data', 'records'], ['cargo', 'cargo'], ['arcade', 'arcade'],
  ['emergency_shuttle', 'shuttle'], ['shuttle', 'pod'],
];

const a = (n) => (/^[aeiou]/i.test(n) ? 'an ' : 'a ') + n;

export class Actions {
  constructor(sim) { this.sim = sim; }

  // ------------------------------------------------------------------ keys
  key(c, msg) {
    const sim = this.sim, m = c.mob;
    if (!m || m.dead || !m.humanoid) return;
    if (m.cuffed && !['swap', 'intent', 'resist'].includes(msg.k)) { sim.people.restrained(m); return; }
    switch (msg.k) {
      case 'swap': swapHands(m); break;
      case 'drop': if (!m.busy) dropFromHand(sim, m); break;
      case 'equip': quickEquip(sim, m); break;
      case 'activate': this.activate(m); break;
      case 'throw': m.throwMode = !m.throwMode; m.dirty = true; break;
      case 'intent': m.intent = INTENTS[clamp(msg.v | 0, 0, 3)]; m.dirty = true; break;
      case 'internals': this.toggleInternals(m); break;
      case 'light': this.toggleLight(m); break;
      case 'jet': this.toggleJetpack(m); break;
      case 'mag': this.toggleMagboots(m); break;
      case 'resist': if (!sim.people.resist(m) && m.busy) this.cancelBusy(m, 'stop'); break;
      case 'pull': sim.people.release(m); break;
      default: break;
    }
    c.selfJson = '';
  }

  toggleInternals(m) {
    const sim = this.sim;
    if (m.internals) { m.internals = false; sim.tell(m, 'notice', 'You are no longer running on internals.'); sim.sound('hiss', m, 0.4); return; }
    if (!m.worn.mask?.def.internals) { sim.tell(m, 'warning', 'You are not wearing a suitable mask or helmet.'); return; }
    const src = internalsSource(m);
    if (!src) { sim.tell(m, 'warning', 'You have no tank to connect to.'); return; }
    m.internals = true;
    sim.tell(m, 'notice', 'You are now running on internals.');
    sim.sound('hiss', m, 0.5);
  }

  /** jetpack.dm: toggle_jetpack(). The one on your back; its stabilizers are always on (let go of the keys and it brakes you). */
  toggleJetpack(m) {
    const sim = this.sim, jp = m.worn.back?.def.jetpack ? m.worn.back : null;
    if (!jp) { sim.tell(m, 'warning', 'You have no jetpack on your back.'); return; }
    m.jetOn = !m.jetOn;
    sim.tell(m, 'notice', `You turn the jetpack ${m.jetOn ? 'on' : 'off'}.`);
    sim.sound('hiss', m, 0.3);
    m.dirty = true;
  }

  /** magboots.dm attack_self(): the mag-pulse traction system. */
  toggleMagboots(m) {
    const sim = this.sim;
    if (!m.worn.shoes?.def.magboots) { sim.tell(m, 'warning', 'You are not wearing magboots.'); return; }
    m.magOn = !m.magOn;
    sim.tell(m, 'notice', `You ${m.magOn ? 'enable' : 'disable'} the mag-pulse traction system.`);
    sim.sound('beep', m, 0.3);
    m.dirty = true;
  }

  lightItem(m) {
    const cands = [m.hands[0], m.hands[1], m.worn.head, m.worn.belt, m.worn.lpocket, m.worn.rpocket, m.worn.suit_store];
    for (const it of cands) if (it && it.def.light) return it;
    return null;
  }

  toggleLight(m) {
    const sim = this.sim;
    const it = this.lightItem(m);
    if (!it) { sim.tell(m, 'warning', 'You have no light source.'); return; }
    m.lightOn = !m.lightOn;
    sim.sound('beep', m, 0.3);
    sim.tell(m, 'notice', m.lightOn ? `You turn on the ${it.name}.` : `You turn off the ${it.name}.`);
  }

  /** Use the item in the active hand on yourself / its own function (SS13 'Z'). */
  activate(m) {
    const sim = this.sim;
    const it = m.held;
    if (!it) { sim.tell(m, 'notice', 'You have nothing in your hand.'); return; }
    const d = it.def;
    if (stackInfo(it.path)) return sim.stacks.open(m, it);               // a stack: what it can make, and taking some out
    if (d.light) return this.toggleLight(m);
    if (d.tool === 'welder') {
      if (it.fuel <= 0) { sim.tell(m, 'warning', 'The welding tool is out of fuel.'); return; }
      it.lit = !it.lit; m.dirty = true;
      sim.sound(it.lit ? 'welder_on' : 'beep', m, 0.5);
      sim.tell(m, 'notice', it.lit ? 'You turn on the welding tool.' : 'You turn off the welding tool.');
      return;
    }
    if (d.tray) { it.on = !it.on; m.dirty = true; sim.sound('beep', m, 0.3); return; }           // the T-ray scanner (t_scanner.dm attack_self: no message)
    if (d.storage) {
      if (m.openContainers.has(it.id)) m.openContainers.delete(it.id); else m.openContainers.add(it.id);
      m.dirty = true; return;
    }
    if (d.tank) return this.toggleInternals(m);
    if (d.cell) return this.recharge(m, it);
    if (d.scanner) return this.scan(m, m);
    if (d.heal) return this.heal(m, m, it);
    if (d.consume) return this.eat(m, it);
    if (d.extinguisher) return this.spray(m, it);
    sim.tell(m, 'notice', 'Nothing happens.');
  }

  // ------------------------------------------------------------------ clicking
  /**
   * What a click's target refers to, with the grid it is on (`grid`) and its place in that grid's frame (`x`, `z`). Targets that are
   * indexes or tiles belong to the grid the client names (`t.g`), else the one you are standing on; items and people know their own.
   */
  resolve(m, t) {
    const sim = this.sim;
    if (!t || t.k === 'none') return null;
    const g = sim.grids.get(t.g) || m.grid;
    switch (t.k) {
      case 'item': { const rec = sim.floor.get(t.id); return rec ? { k: 'item', rec, grid: rec.grid, l: rec.l, x: rec.x, z: rec.z } : undefined; }
      case 'door': { const d = g.doors[t.idx]; return d ? { k: 'door', d, idx: t.idx, grid: g, l: d.l, x: d.x, z: d.z } : undefined; }
      case 'fdoor': { const f = g.firedoors.list[t.idx]; return f ? { k: 'fdoor', f, grid: g, l: f.l, x: f.x, z: f.z } : undefined; }
      case 'prop': { const it = g.props.interact[t.idx]; return it ? { k: 'prop', it, grid: g, l: it.l, x: it.x, z: it.z } : undefined; }
      case 'mob': { const o = sim.mobs.get(t.id); return o && o !== m ? { k: 'mob', o, grid: o.grid, l: o.l, x: o.x, z: o.z } : undefined; }
      case 'breach': { const i = g.world.idx(t.c, t.r); return g.world.breached.has(i) ? { k: 'breach', c: t.c, r: t.r, grid: g, x: t.c * TILE + 1, z: t.r * TILE + 1 } : undefined; }
      case 'window': case 'pane': {
        const th = sim.windows.thing(g, t);
        return th ? { k: t.k, c: t.c, r: t.r, d: t.d, grid: g, x: th.x, z: th.z } : undefined;
      }
      case 'floor': { const th = sim.floors.floor(g, t); return th ? { k: 'floor', c: t.c, r: t.r, grid: g, x: th.x, z: th.z } : undefined; }
      case 'light': return sim.lights.thing(g, t) || undefined;
      case 'wall': { const th = sim.walls.wall(g, t); return th ? { k: 'wall', c: t.c, r: t.r, grid: g, x: th.x, z: th.z } : undefined; }
      case 'built': { const th = sim.walls.girder(g, t); return th ? { k: 'built', id: t.id, grid: g, x: th.x, z: th.z } : undefined; }
      default: return undefined;
    }
  }

  inReach(m, t) {
    if ((t.l | 0) !== (m.l | 0) && t.grid === m.grid) return false;                // not through a floor
    const d = this.sim.dist(m, t);
    if (d > REACH + (t.k === 'mob' ? 0.5 : t.k === 'window' || t.k === 'pane' || t.k === 'breach' || t.k === 'wall' || t.k === 'built' || t.k === 'floor' || t.k === 'light' ? 1.3 : 0)) return false;       // a window's middle is a metre behind its face
    if (t.k === 'door' || t.k === 'breach' || t.k === 'window' || t.k === 'pane' || t.k === 'wall' || t.k === 'light' || (t.k === 'prop' && t.it.kind === 'wm')) return true;
    if (t.grid !== m.grid) return true;               // across a doorway between two grids there are no tiles to look along: arm's length is all that counts
    const wd = m.grid.world.raycast(m.x, m.z, t.x - m.x, t.z - m.z, d, 'shot', m.l | 0);
    return wd >= d - 0.8;
  }

  click(c, msg) {
    const sim = this.sim, m = c.mob;
    if (!m || m.dead || m.body.crit || m.stunned > 0 || !m.humanoid || m.inside) return;
    if (m.cuffed) { sim.people.restrained(m); return; }
    if (msg.yaw !== undefined) { m.yaw = sim.yawIn(m, msg.yaw, msg.yg); m.pitch = clamp(msg.pitch || 0, -1.5, 1.5); }
    if (m.busy) { this.cancelBusy(m, 'interrupt'); return; }
    if (m.cool > 0) return;
    const held = m.held;
    if (m.throwMode && held) { m.throwMode = false; m.dirty = true; this.throwItem(m, held); return; }
    const t = this.resolve(m, msg.target);
    if (t === undefined) return;                      // target vanished
    if (t && !this.inReach(m, t)) { if (t.k !== 'mob' || !held?.def.gun) return; }
    if (!t) return this.clickAir(m, held);
    c.selfJson = '';
    if (msg.ctrl && ['mob', 'item', 'prop'].includes(t.k)) return sim.people.drag(m, t);        // Ctrl+click is SS13's pull
    switch (t.k) {
      case 'item': return this.clickItem(m, t.rec, held);
      case 'door': return this.clickDoor(m, t.d, held);
      case 'fdoor': t.grid.firedoors.manualOpen(t.f, m); return;
      case 'prop': return this.clickProp(c, m, t.it, held, !!msg.alt);
      case 'mob': return this.clickMob(m, t.o, held, !!msg.alt);
      case 'breach': return this.clickBreachTile(m, t, held);
      case 'window': case 'pane': if (sim.windows.click(m, t, held)) return; return this.clickAir(m, held);
      case 'floor': if (sim.floors.click(m, t, held)) return; return this.clickAir(m, held);
      case 'wall': if (sim.walls.clickWall(m, t, held)) return; return this.clickAir(m, held);
      case 'built': if (sim.walls.clickGirder(m, t, held)) return; return this.clickAir(m, held);
      case 'light': if (sim.lights.click(m, t, held)) return; return this.clickAir(m, held);
      default: return;
    }
  }

  clickAir(m, held) {
    if (held?.def.gun) return this.fire(m, held);
    if (m.intent === 'harm') return this.swing(m, held);
  }

  clickItem(m, rec, held) {
    const sim = this.sim;
    // a stack in your hand and another of its kind on the floor: the floor one joins yours (stack.dm attackby)
    if (held && stackInfo(held.path) && stackKey(held.path) === stackKey(rec.item.path)) {
      if (mergeStack(sim, rec.item, held)) { stackNote(sim, m, held); sim.sound('pickup', m, 0.5); }
      return;
    }
    // a held container takes the item in
    if (held?.def.storage && m.intent === 'help') {
      const why = storageReason(held, rec.item);
      if (!why) { detach(sim, rec.item); attach(sim, rec.item, { t: 'box', box: held }); sim.sound('equip', m, 0.5); return; }
    }
    pickup(sim, m, rec);
  }

  clickDoor(m, d, held) {
    const sim = this.sim, power = d.grid.power;
    if (held?.def.tool === 'crowbar' && d.state === 'closed' && !power.doorsWork(d) && !d.bolted) {
      this.startTimed(m, 'prying the door open', 2.8, () => d.state === 'closed' && sim.dist(m, d) < 3.2 && m.held === held, () => {
        d.pried = true; sim.openDoor(d, m, true); sim.sound('door_forced', d, 0.9);
        sim.tell(m, 'notice', 'You pry the door open.');
      }, 'crowbar');
      return;
    }
    if (!power.doorsWork(d)) {
      sim.tell(m, 'warning', 'The airlock has no power.');
      return;
    }
    if (d.bolted) { sim.tell(m, 'warning', "The airlock's bolts prevent it from being opened."); sim.sound('door_denied', d, 0.7); return; }
    if (d.state === 'open' || d.state === 'opening') { sim.closeDoor(d); return; }
    if (!d.allows(m)) {
      sim.sound('door_denied', d, 0.8);
      sim.tell(m, 'warning', 'Access denied.');
      return;
    }
    sim.openDoor(d, m);
  }

  /** A smashed or taken-apart window: the grille's tools first (wirecutters, screwdriver, rods, glass), then a metal plate welded over the hole. */
  clickBreachTile(m, t, held) {
    const sim = this.sim;
    if (sim.windows.clickGrille(m, t, held)) return;
    if (held?.def.sheet === 'metal') return this.clickBreach(m, t, held);
    const lines = sim.windows.examine(t.grid, t);
    if (lines.length) sim.tell(m, 'info', lines.join(' '));
  }

  clickBreach(m, t, held) {
    const sim = this.sim;
    if (held?.def.sheet !== 'metal') { sim.tell(m, 'warning', 'You need a sheet of metal and a lit welding tool to patch this.'); return; }
    const welders = allItems(m).filter((i) => i.def.tool === 'welder');
    const welder = welders.find((i) => i.lit) || welders[0];
    if (!welder) { sim.tell(m, 'warning', 'You need a welding tool to weld the plate on.'); return; }
    if (!welder.lit) { sim.tell(m, 'warning', 'You need to turn the welding tool on first.'); return; }
    if (welder.fuel < 4) { sim.tell(m, 'warning', 'You need more welding fuel to complete this task.'); return; }
    this.startTimed(m, 'welding the plate', 3.2, () => t.grid.world.breached.has(t.grid.world.idx(t.c, t.r)) && m.held === held && welder.lit && sim.dist(m, t) < 3.6, () => {
      welder.fuel -= 4;
      held.amount = (held.amount ?? 1) - 1;
      if (held.amount <= 0) consume(sim, held);
      sim.patchBreach(t.grid, t.c, t.r);
      sim.tell(m, 'notice', 'You weld the plate over the hole.');
    }, 'welder');
  }

  clickProp(c, m, it, held, alt = false) {
    const sim = this.sim;
    const g = it.grid, area = g.world.areaIdx[g.world.idx(it.c, it.r)];
    if (it.kind === 'closet') return sim.closets.click(c, m, it, held, alt);
    if (it.mach && it.mach.click(c, m, held, alt)) return;                        // a machine with its own rules (the power machines: src/sim/power/)
    if (it.gone) return;
    if (sim.tanks.click(m, it, held)) return;                                     // a fuel or water tank: refill from it
    if (it.kind === 'container') return this.openContainer(m, it);
    if (it.kind === 'wm') {
      switch (it.sub) {
        case 'light_switch': sim.setLightSwitch(g, area, !g.power.lightSwitch[area]); sim.sound('terminal_key', it, 0.5); return;
        case 'apc': sim.terminals.open(c, 'apc', { area, grid: g }); return;
        case 'airalarm': sim.terminals.open(c, 'airalarm', { area, grid: g }); return;
        case 'requests_console': sim.terminals.open(c, 'rc', { area, grid: g }); return;
        case 'newscaster': sim.terminals.open(c, 'news', { area, grid: g }); return;
        case 'status_display': case 'ai_status_display': sim.terminals.open(c, 'status', { area, grid: g }); return;
        case 'firealarm': sim.sound('alarm', it, 0.6); g.firedoors.fireAlarm(45); sim.chat.visible(m, `${m.name} pulls the fire alarm.`, 'notice', 10); return;
        case 'button': sim.sound('terminal_key', it, 0.6); return;
        case 'mirror': if (m.look) c.outbox.push({ e: 'mirror', look: m.look }); return;
        default: return this.examineProp(m, it);
      }
    }
    const p = it.path || '';
    if (/computer/.test(p)) {
      let type = 'generic';
      for (const [k, v] of COMPUTER_TYPES) if (p.includes(k)) { type = v; break; }
      sim.terminals.open(c, type, { name: it.name, area, grid: g });
      return;
    }
    if (/vending/.test(p)) {
      if (m.vendUntil > sim.time) return;
      m.vendUntil = sim.time + 1.4;
      let pick = null;
      for (const [k, path, label] of VEND) if (p.includes(k)) { pick = { path, label }; break; }
      if (!pick) pick = { path: '/obj/item/reagent_containers/food/snacks/chips', label: 'a bag of chips' };
      const item = sim.newItem(pick.path);
      sim.sound('vend', it, 0.8);
      const [vx, vz] = this.frontOf(it, m, 1.1);
      place(sim, item, it.grid, vx, vz, undefined, it.l);
      sim.tell(m, 'notice', `The ${it.name} dispenses ${pick.label}.`);
      return;
    }
    this.examineProp(m, it);
  }

  /** A floor spot just in front of a prop, on the side `m` is standing. */
  frontOf(it, m, dist) {
    const dx = m.x - it.x, dz = m.z - it.z, dl = Math.hypot(dx, dz) || 1;
    const x = it.x + dx / dl * dist, z = it.z + dz / dl * dist;
    return it.grid.world.collides(x, z, 0.12) ? [m.x, m.z] : [x, z];
  }

  openContainer(m, it) {
    const sim = this.sim;
    if (it.opened) { sim.tell(m, 'notice', `The ${it.name} is empty.`); return; }
    it.opened = true;
    sim.sound('closet_open', it, 0.8);
    const path = it.path || '';
    let list = ['/obj/item/flashlight'];
    for (const [k, l] of LOOT) if (path.includes(k)) { list = l; break; }
    // contents tumble out on the side the door opens towards (the opener's side)
    const dx = m.x - it.x, dz = m.z - it.z, dl = Math.hypot(dx, dz) || 1;
    const fx = dx / dl, fz = dz / dl;
    let n = 0;
    for (const ip of list) {
      if (Math.random() < 0.18) continue;
      const item = sim.newItem(ip);
      const side = (Math.random() - 0.5) * 1.1, fwd = 1.15 + Math.random() * 0.35;
      let x = it.x + fx * fwd - fz * side, z = it.z + fz * fwd + fx * side;
      if (it.grid.world.collides(x, z, 0.12)) { x = it.x + fx * 1.2; z = it.z + fz * 1.2; }
      if (it.grid.world.collides(x, z, 0.12)) { x = m.x; z = m.z; }
      place(sim, item, it.grid, x, z, undefined, it.l);
      n++;
    }
    sim.tell(m, 'notice', n ? `You open the ${it.name}.` : `You open the ${it.name}. It is empty.`);
  }

  // ------------------------------------------------------------------ mobs & combat
  clickMob(m, o, held, alt = false) {
    const sim = this.sim;
    if (alt) return sim.people.openStrip(m, o);                  // Alt+click: go through their things (SS13 drags them onto you)
    if (held?.def.cuff) return sim.people.cuff(m, o, held);      // handcuffs work on any intent
    if (o.dead) {
      if (m.intent === 'grab') return sim.people.grab(m, o);
      if (m.intent === 'help') {
        if (o.worn?.id && !m.hands.every(Boolean)) {
          const id = o.worn.id; detach(sim, id); takeToHand(sim, m, id);
          sim.tell(m, 'notice', `You take ${o.name}'s ID card.`);
        } else sim.tell(m, 'notice', `${o.name} is dead.`);
      }
      return;
    }
    switch (m.intent) {
      case 'help':
        if (held?.def.heal) return this.heal(m, o, held);
        if (held?.def.scanner) return this.scan(m, o);
        sim.chat.visible(m, `${m.name} hugs ${o.name} to make them feel better!`, 'notice', 8);
        o.fear = Math.max(0, o.fear - 1);
        return;
      case 'grab': return sim.people.grab(m, o);
      case 'disarm': {
        m.cool = 0.6;
        sim.sound('miss', o, 0.5);
        o.stunned = Math.max(o.stunned, 1.0);
        if (o.humanoid && o.held && Math.random() < 0.6) {
          const it = o.held; detach(sim, it);
          place(sim, it, o.grid, o.x + (Math.random() - 0.5), o.z + (Math.random() - 0.5), undefined, o.l);
          sim.chat.visible(m, `${m.name} has disarmed ${o.name}!`, 'danger', 10);
        } else sim.chat.visible(m, `${m.name} has pushed ${o.name}!`, 'warning', 10);
        o.fear = 6; o.target = m;
        return;
      }
      default: return this.attackMob(m, o, held);
    }
  }

  attackMob(m, o, held) {
    const sim = this.sim;
    const d = held?.def;
    let dmg = held ? Math.max(held.force || 0, 1) : 3 + Math.random() * 5;
    let type = 'brute';
    if (held?.def.tool === 'welder' && held.lit) { type = 'burn'; dmg = 5; }
    dmg *= 0.85 + Math.random() * 0.3;
    m.cool = d?.cooldown ?? 0.55;
    sim.hurt(o, dmg, type, m.name);
    o.fear = 6; o.target = m;
    if (d?.stun) o.stunned = Math.max(o.stunned, d.stun);
    sim.sound(d?.stun ? 'baton' : held ? 'baton' : 'punch', o, 1);
    const how = held ? `has ${d?.stun ? 'stunned' : 'hit'} ${o.name} with the ${held.name}` : `has punched ${o.name}`;
    sim.chat.visible(m, `${m.name} ${how}!`, 'danger', 12);
    if (!held) { /* fists */ }
  }

  /** Swing in front of you (harm intent, nothing targeted): hits a mob or tries to break glass. */
  swing(m, held) {
    const sim = this.sim;
    const d = held?.def;
    const reach = d?.reach ?? 2.1;
    m.cool = d?.cooldown ?? 0.55;
    const f = this.aim(m), world = m.grid.world;
    const wall = world.raycast(m.x, m.z, f.x, f.z, reach, 'shot', m.l | 0);
    const hit = this.rayMobs(m, f, Math.min(reach, wall + 0.2));
    if (hit) { if (!hit.mob.dead) this.attackMob(m, hit.mob, held); return; }
    if (wall < reach) {
      const h = world.hit;
      if (h && ((h.kind === 'tile' && world.glass[h.i]) || h.kind === 'edge')) {
        const force = held ? held.force : 0;
        if (force >= 9 || d?.breaks) {
          const r = sim.damageHull(m.grid, h, Math.max(force, 6) * 1.1);
          if (r) sim.chat.visible(m, `${m.name} smashes the glass with the ${held?.name || 'fists'}!`, 'warning', 12);
          return;
        }
        sim.sound('glass_hit', m, 0.5);
        sim.tell(m, 'notice', 'You tap the glass. It holds.');
        return;
      }
    }
    sim.sound('miss', m, 0.5);
  }

  aim(m) { return { x: -Math.sin(m.yaw) * Math.cos(m.pitch), y: Math.sin(m.pitch), z: -Math.cos(m.yaw) * Math.cos(m.pitch) }; }

  rayMobs(m, f, maxDist, ox = m.x, oy = EYE, oz = m.z) {
    let best = null, bd = maxDist;
    for (const o of this.sim.mobs.values()) {
      if (o === m || o.evacuated || o.grid !== m.grid || (o.l | 0) !== (m.l | 0)) continue;                     // (a shot does not go through a floor)
      const h = o.dead ? 0.5 : o.kind === 'carp' ? 1.0 : o.pet ? 0.9 : 1.75;
      const rad = o.dead ? 0.7 : o.kind === 'carp' ? 0.65 : 0.4;
      const mx = o.x - ox, mz = o.z - oz;
      const len2 = f.x * f.x + f.z * f.z;
      if (len2 < 1e-6) continue;
      const tt = (mx * f.x + mz * f.z) / len2;
      if (tt < 0 || tt > bd) continue;
      const cx = ox + f.x * tt - o.x, cz = oz + f.z * tt - o.z;
      if (cx * cx + cz * cz > rad * rad) continue;
      const y = oy + f.y * tt;
      if (y < 0 || y > h) continue;
      bd = tt; best = o;
    }
    return best ? { mob: best, dist: bd } : null;
  }

  /** The first fuel tank on the line of a shot, nearer than `maxDist` (reagent_dispenser.dm fueltank bullet_act: a shot tank blows up). */
  rayTanks(m, f, maxDist) {
    let best = null, bd = maxDist;
    const len2 = f.x * f.x + f.z * f.z;
    if (len2 < 1e-6) return null;
    for (const it of m.grid.props.interact) {
      if (it.gone || it.kind !== 'prop' || (it.l | 0) !== (m.l | 0) || !this.sim.tanks.isFuel(it)) continue;
      const mx = it.x - m.x, mz = it.z - m.z;
      const tt = (mx * f.x + mz * f.z) / len2;
      if (tt < 0 || tt > bd) continue;
      const cx = m.x + f.x * tt - it.x, cz = m.z + f.z * tt - it.z;
      if (cx * cx + cz * cz > 0.45 * 0.45) continue;
      const y = EYE + f.y * tt;
      if (y < 0 || y > 1.5) continue;
      bd = tt; best = it;
    }
    return best ? { it: best, dist: bd } : null;
  }

  fire(m, gun) {
    const sim = this.sim;
    const g = gun.def.gun;
    if (gun.shots <= 0) { sim.sound('beep', m, 0.4); sim.tell(m, 'warning', '*click*'); m.cool = 0.3; return; }
    gun.shots--;
    m.dirty = true;
    m.cool = g.cooldown;
    sim.sound(g.snd, m, 0.9);
    const spread = 0.012;
    const f = this.aim(m);
    const dx = f.x + (Math.random() - 0.5) * spread, dy = f.y + (Math.random() - 0.5) * spread, dz = f.z + (Math.random() - 0.5) * spread;
    const range = 60, world = m.grid.world;
    const wall = world.raycast(m.x, m.z, dx, dz, range, 'shot', m.l | 0);
    const wallHit = world.hit;
    const hit = this.rayMobs(m, { x: dx, y: dy, z: dz }, wall);
    let end = wall;
    const tank = this.rayTanks(m, { x: dx, y: dy, z: dz }, hit ? hit.dist : wall);
    if (tank) {
      end = tank.dist;
      sim.tanks.damaged(tank.it);
    } else if (hit) {
      end = hit.dist;
      sim.hurt(hit.mob, g.dmg, g.type, m.name);
      hit.mob.fear = 6; hit.mob.target = m;
      sim.sound('sparks', hit.mob, 0.5);
      sim.chat.visible(m, `${m.name} shoots ${hit.mob.name} with the ${gun.name}!`, 'danger', 14);
    } else if (wall < range && wallHit) {
      if ((wallHit.kind === 'tile' && world.glass[wallHit.i]) || wallHit.kind === 'edge') sim.damageHull(m.grid, wallHit, g.dmg * 0.8);
      else sim.sound('sparks', { grid: m.grid, x: m.x + dx * wall, z: m.z + dz * wall }, 0.4);
    }
    m.grid.emit({ e: 'beam', a: [m.x + Math.cos(m.yaw) * 0.22, EYE - 0.22, m.z - Math.sin(m.yaw) * 0.22], b: [m.x + dx * end, EYE + dy * end, m.z + dz * end], col: 0xff4040 }, { near: { at: m, r: 50 } });
  }

  throwItem(m, item) {
    const sim = this.sim;
    const f = this.aim(m);
    const maxd = clamp(9 - item.w * 1.3, 3, 9);
    const wall = m.grid.world.raycast(m.x, m.z, f.x, f.z, maxd, 'shot', m.l | 0);
    const hit = this.rayMobs(m, f, Math.min(maxd, wall));
    const dist = Math.min(maxd, wall) - 0.4;
    detach(sim, item);
    // floating with nothing to brace on, the throw pushes you the other way (carbon.dm throw_item: newtonian_move(get_dir(target, src)))
    if (floatState(m.grid.world, m, sim.moveCtx(m)).adrift) { m.vx -= f.x * THROW_KICK; m.vz -= f.z * THROW_KICK; }
    const x = m.x + f.x * Math.max(0.5, hit ? hit.dist - 0.5 : dist), z = m.z + f.z * Math.max(0.5, hit ? hit.dist - 0.5 : dist);
    const rec = place(sim, item, m.grid, x, z, undefined, m.l);
    // everyone nearby sees it sail from the thrower's hand to where it lands
    const hx = m.x - Math.sin(m.yaw) * 0.45 + Math.cos(m.yaw) * 0.25, hz = m.z - Math.cos(m.yaw) * 0.45 - Math.sin(m.yaw) * 0.25;
    m.grid.emit({ e: 'toss', id: item.id, l: rec.l, a: [+hx.toFixed(2), +(EYE - 0.35).toFixed(2), +hz.toFixed(2)], b: [+x.toFixed(2), +rec.y.toFixed(2), +z.toFixed(2)] }, { near: { at: m, r: 40 } });
    sim.sound('drop', rec, 0.6);
    m.cool = 0.5;
    sim.chat.visible(m, `${m.name} has thrown the ${item.name}.`, 'notice', 10);
    if (hit && !hit.mob.dead) { sim.hurt(hit.mob, Math.max(1, item.w * 2), 'brute', m.name); hit.mob.fear = 4; }
  }

  // ------------------------------------------------------------------ item uses
  heal(m, o, it) {
    const sim = this.sim;
    const h = it.def.heal;
    if (o.dead) { sim.tell(m, 'warning', `${o.name} is beyond help.`); return; }
    const b = o.body;
    let did = false;
    for (const k of ['brute', 'burn', 'tox', 'oxy']) if (h[k] && b[k] > 0.5) { b.heal(k, h[k]); did = true; }
    if (!did) { sim.tell(m, 'notice', o === m ? 'You have no injuries to treat.' : `${o.name} does not need that.`); m.cool = 0.4; return; }
    m.cool = 0.7;
    sim.sound('pickup', m, 0.5);
    sim.chat.visible(m, o === m ? `${m.name} treats their wounds with the ${it.name}.` : `${m.name} treats ${o.name} with the ${it.name}.`, 'notice', 8);
    it.amount = (it.amount ?? 1) - 1;
    if (it.amount <= 0) { consume(sim, it); sim.tell(m, 'notice', `You use up the ${it.name}.`); }
    m.dirty = true;
  }

  scan(m, o) {
    const sim = this.sim;
    const b = o.body;
    sim.tell(m, 'info', `Analyzing results for ${o.name}: Overall status: ${b.dead ? 'Deceased' : Math.round(b.health / b.max * 100) + '% healthy'}. Brute: ${Math.round(b.brute)}, burn: ${Math.round(b.burn)}, toxin: ${Math.round(b.tox)}, suffocation: ${Math.round(b.oxy)}.`);
    sim.sound('beep', m, 0.4);
    m.cool = 0.5;
  }

  eat(m, it) {
    const sim = this.sim;
    const c = it.def.consume;
    if (c.heal) m.body.heal('brute', c.heal);
    sim.tell(m, 'notice', c.msg || 'You consume it.');
    sim.sound('pickup', m, 0.4);
    consume(sim, it);
    m.cool = 0.6;
  }

  spray(m, it) {
    const sim = this.sim;
    if (it.charges <= 0) { sim.tell(m, 'warning', 'The extinguisher is empty.'); m.cool = 0.4; return; }
    it.charges--;
    sim.sound('spray', m, 0.7);
    m.cool = 0.5;
    const [c, r] = m.tile;
    m.grid.atmos.addGas(c, r, 0, 0, -m.grid.atmos.toxAt(c, r, m.l | 0) * 0.4, m.l | 0);
  }

  recharge(m, cell) {
    const sim = this.sim;
    const gun = m.hands[1 - m.active];
    if (!gun?.def.gun || gun.shots >= gun.def.gun.shots) { sim.tell(m, 'notice', 'You need an energy weapon in your other hand.'); return; }
    gun.shots = gun.def.gun.shots;
    consume(sim, cell);
    sim.sound('pickup', m, 0.6);
    sim.tell(m, 'notice', `The ${gun.name} is fully charged.`);
  }

  /** The mirror's hairdresser: from a mirror you can change your hair, facial hair and their colours (mirror.dm), nothing else. */
  mirror(c, msg) {
    const sim = this.sim, m = c.mob;
    if (!m || m.dead || !m.look || m.inside) return;
    if (!m.grid.props.interact.some((it) => it.kind === 'wm' && it.sub === 'mirror' && Math.hypot(it.x - m.x, it.z - m.z) < 3.4)) return;
    const l = sim.looks.sanitize({ ...m.look, ...msg.look });
    m.look = { ...m.look, h: l.h, hc: l.hc, f: l.f, fc: l.fc };
    m.apDirty = true;
  }

  // ------------------------------------------------------------------ timed actions
  /**
   * A timed action (SS13 do_after): `valid()` is checked every tick, `done()` runs when `dur` seconds are up.
   * opts.start / opts.stop replace the "You start ..." / "You stop ..." messages (null: say nothing; stop may be a function).
   */
  startTimed(m, label, dur, valid, done, sfx, opts = {}) {
    if (m.busy) return;
    m.busy = { label, dur, t: 0, valid, done, sfx, snd: 0, prog: 0, opts };
    if (opts.start !== null) this.sim.tell(m, 'notice', opts.start ?? `You start ${label}...`);
  }

  /** SS13 tool_use_check for a welding tool: it has to be lit, and have `amount` fuel. */
  welderReady(m, tool, amount = 0) {
    if (!tool.lit || tool.fuel <= 0) { this.sim.tell(m, 'warning', `The ${tool.name} has to be on to complete this task!`); return false; }
    if (tool.fuel < amount) { this.sim.tell(m, 'warning', 'You need more welding fuel to complete this task!'); return false; }
    return true;
  }

  cancelBusy(m, why) {
    if (!m.busy) return;
    if (why !== 'done') {
      const o = m.busy.opts || {};
      const msg = o.stop === undefined ? `You stop ${m.busy.label}.` : (typeof o.stop === 'function' ? o.stop() : o.stop);
      if (msg) this.sim.tell(m, 'warning', msg);
    }
    m.busy = null;
    if (m.client) m.client.outbox.push({ e: 'prog', f: -1 });
  }

  /** A lit welding tool burns a unit of fuel every 13 power ticks, 26 s (weldingtool.dm process, WELDER_FUEL_BURN_INTERVAL); out of fuel it goes out. */
  burnWelders(dt) {
    const sim = this.sim;
    for (const m of sim.mobs.values()) {
      if (m.dead || !m.humanoid) continue;
      for (const it of allItems(m)) {
        if (it.def.tool !== 'welder' || !it.lit) continue;
        it.burn = (it.burn || 0) + dt;
        if (it.burn < 26) continue;
        it.burn = 0;
        it.fuel = Math.max(0, it.fuel - 1);
        m.dirty = true;
        if (it.fuel <= 0) { it.lit = false; sim.tell(m, 'notice', `You switch the ${it.name} off.`); sim.sound('beep', m, 0.4); }
      }
    }
  }

  update(dt) {
    const sim = this.sim;
    this.burnAcc = (this.burnAcc || 0) + dt;
    if (this.burnAcc >= 1) { this.burnWelders(this.burnAcc); this.burnAcc = 0; }
    for (const m of sim.mobs.values()) {
      const b = m.busy;
      if (!b) continue;
      if (m.dead || m.stunned > 0 || !b.valid()) { this.cancelBusy(m, 'invalid'); continue; }
      b.t += dt; b.snd -= dt;
      if (b.snd <= 0) { b.snd = 0.7; if (b.sfx) sim.sound(b.sfx, m, 0.6); }
      if (m.client && sim.tick % 2 === 0) m.client.outbox.push({ e: 'prog', f: b.t / b.dur, label: b.label });
      if (b.t >= b.dur) { m.busy = null; if (m.client) m.client.outbox.push({ e: 'prog', f: -1 }); b.done(); }
    }
  }

  // ------------------------------------------------------------------ inventory UI
  inventory(c, msg) {
    const sim = this.sim, m = c.mob;
    if (!m || m.dead || !m.humanoid) return;
    if (m.cuffed && msg.op !== 'close') { sim.tell(m, 'warning', "You can't do that right now!"); return; }
    const item = sim.items.get(msg.item);
    switch (msg.op) {
      case 'move': {
        if (!item || !msg.to) return;
        if (item.loc?.t === 'floor') { this.fromFloor(m, item, msg.to); break; }
        if (msg.to.t === 'floor' && Number.isFinite(msg.to.x)) { if (carried(m, item)) this.placeAt(m, item, msg.to.x, msg.to.z); break; }
        moveItem(sim, m, item, msg.to);
        break;
      }
      case 'throw': {
        if (!item || !carried(m, item) || m.busy || m.cool > 0 || !msg.at) return;
        this.throwAt(m, item, msg.at);
        break;
      }
      case 'take': if (item && carried(m, item)) takeToHand(sim, m, item); break;
      case 'open': if (item && carried(m, item) && item.contents) m.openContainers.add(item.id); break;
      case 'close': m.openContainers.delete(msg.item); break;
      case 'unequip': {
        const it = m.worn[msg.slot];
        if (it) takeToHand(sim, m, it);
        break;
      }
      case 'use': {
        // click a worn/stored item with the active hand: put the held item into it if it is a container, else swap into hand
        if (!item || !carried(m, item)) return;
        const held = m.held;
        if (held && item.def.storage && held !== item) { storeIn(sim, m, item, held); break; }
        if (!held) takeToHand(sim, m, item);
        break;
      }
      default: break;
    }
    m.dirty = true;
    c.selfJson = '';
  }

  // ------------------------------------------------------------------ dragging things around the world
  /** Can `m` put something down at (x, z)? Within reach, in sight, on open floor or a table top. */
  reachablePoint(m, x, z) {
    const w = m.grid.world;
    const d = Math.hypot(x - m.x, z - m.z);
    if (!Number.isFinite(d) || d > REACH) return false;
    const c = Math.floor(x / TILE), r = Math.floor(z / TILE);
    const l = m.l | 0;
    if (!w.inb(c, r, l)) return false;
    const i = w.idx(c, r, l);
    const k = w.kind[i];
    if (k !== KIND.FLOOR && k !== KIND.LATTICE) return false;
    if (w.tableH[i] <= 0 && w.collides(x, z, 0.08, null, false, l)) return false;
    if (d > 0.3 && w.raycast(m.x, m.z, x - m.x, z - m.z, d, 'shot', l) < d - 0.2) return false;
    return true;
  }

  placeAt(m, item, x, z) {
    const sim = this.sim;
    if (!this.reachablePoint(m, x, z)) { sim.tell(m, 'warning', "You can't reach there."); return false; }
    detach(sim, item);
    place(sim, item, m.grid, x, z, undefined, m.l);
    sim.sound('drop', { grid: m.grid, l: m.l, x, z }, 0.5);
    return true;
  }

  /** Something lying on the floor, dragged straight into a hand, a slot, a bag, or to another spot on the floor. */
  fromFloor(m, item, to) {
    const sim = this.sim;
    const rec = sim.floor.get(item.id);
    if (!rec) return false;
    if (!this.inReach(m, { k: 'item', grid: rec.grid, l: rec.l, x: rec.x, z: rec.z })) { sim.tell(m, 'warning', "You can't reach that."); return false; }
    if (to.t === 'floor') {
      if (!this.reachablePoint(m, to.x, to.z)) { sim.tell(m, 'warning', "You can't reach there."); return false; }
      detach(sim, item);
      place(sim, item, m.grid, to.x, to.z, undefined, m.l);
      sim.sound('drop', { grid: m.grid, l: m.l, x: to.x, z: to.z }, 0.4);
      return true;
    }
    if (to.t === 'hand') {
      const i = to.i === 1 ? 1 : 0;
      if (m.hands[i]) { sim.tell(m, 'warning', 'That hand is already holding something.'); return false; }
      detach(sim, item); attach(sim, item, { t: 'hand', mob: m, i });
      sim.sound('pickup', m, 0.7);
      return true;
    }
    if (to.t === 'slot') return equipTo(sim, m, item, to.slot);
    if (to.t === 'box') {
      const box = sim.items.get(to.id);
      if (!box || !carried(m, box)) return false;
      return storeIn(sim, m, box, item);
    }
    return false;
  }

  throwAt(m, item, at) {
    if (!Array.isArray(at) || at.length < 3 || !at.slice(0, 3).every((v) => typeof v === 'number' && Number.isFinite(v))) return;
    const dx = at[0] - m.x, dy = at[1] - EYE, dz = at[2] - m.z;
    const hd = Math.hypot(dx, dz);
    if (!Number.isFinite(hd) || hd < 0.05) return;
    m.yaw = Math.atan2(-dx, -dz);
    m.pitch = clamp(Math.atan2(dy, hd), -1.2, 1.2);
    this.throwItem(m, item);
  }

  // ------------------------------------------------------------------ examine
  examine(c, msg) {
    const sim = this.sim, m = c.mob;
    const t = msg.target;
    if (!t) return;
    const lines = [];
    const g = sim.gridFor(t.g, c);
    if (t.k === 'item') {
      const it = sim.floor.get(t.id)?.item || sim.items.get(t.id);
      if (it) lines.push(...this.itemText(it));
    } else if (t.k === 'mob') {
      const o = sim.mobs.get(t.id);
      if (o && o.look && m) {                                     // people: one line each, as SS13 prints them
        for (const l of sim.people.examineLines(m, o)) sim.tellClient(c, 'info', l);
        return;
      }
      if (o) lines.push(...this.mobText(o));
    } else if (t.k === 'door') {
      const d = g?.doors[t.idx];
      if (d) {
        lines.push(`This is the ${d.name}.`);
        const need = [...d.a, ...d.o].map((n) => sim.jobs.accessName(n));
        lines.push(need.length ? `It requires ${[...new Set(need)].join(' or ')} access.` : 'It opens for anyone.');
        lines.push(g.power.doorsWork(d) ? 'The status light is green.' : 'It has no power.');
      }
    } else if (t.k === 'prop') {
      const it = g?.props.interact[t.idx];
      if (it) lines.push(...this.propText(it));
    } else if (!g) return;
    else if (t.k === 'breach' || t.k === 'window' || t.k === 'pane') lines.push(...sim.windows.examine(g, t));
    else if (t.k === 'wall' || t.k === 'built') lines.push(...sim.walls.examine(g, t));
    else if (t.k === 'floor') lines.push(...sim.floors.examine(g, t));
    else if (t.k === 'light') { const L = g.props.lights[t.idx]; if (L) lines.push(...sim.lights.examine(g, L)); }
    if (m && lines.length) sim.tellClient(c, 'info', lines.join(' '));
  }

  itemText(it) {
    const db = this.sim.db;
    const out = [`This is ${a(it.name)}.`];
    const info = db.info(it.path);
    const desc = it.desc ?? info.d;
    if (desc) out.push(desc);
    out.push(`It is ${a(db.sizeName(it.w))} item.`);
    const stack = stackInfo(it.path);
    if (stack) out.push((it.amount ?? 1) > 1 ? `There are ${plural(it.amount, stack.one)} in the stack.` : `There is ${plural(1, stack.one)} in the stack.`);
    else { const st = describeState(it); if (st) out.push(`(${st})`); }
    return out;
  }

  mobText(o) {
    const sim = this.sim;
    if (o.kind === 'carp') return [`This is a space carp. ${o.dead ? 'It is dead.' : 'It looks hungry.'}`];
    if (o.pet) return [`This is ${o.name}. ${o.dead ? 'They are dead.' : 'They look content.'}`];
    const job = sim.jobs.get(o.job);
    const out = [`This is ${o.name}, ${a(job?.title || 'crewmember')}!`];
    const wear = ['uniform', 'suit', 'head', 'mask', 'gloves', 'shoes'].map((s) => o.worn[s]).filter(Boolean).map((i) => a(i.name));
    if (wear.length) out.push(`They are wearing ${wear.slice(0, -1).join(', ')}${wear.length > 1 ? ' and ' : ''}${wear[wear.length - 1]}.`);
    const held = o.hands.filter(Boolean).map((i) => a(i.name));
    if (held.length) out.push(`They are holding ${held.join(' and ')}.`);
    if (o.dead) out.push('They are limp and unresponsive. There is no sign of life.');
    else if (o.body.crit) out.push('They are barely conscious.');
    else if (o.body.brute > 30) out.push('They have severe bruising.');
    else if (o.body.brute > 5) out.push('They have minor bruising.');
    if (o.body.burn > 10 && !o.dead) out.push('They have burns.');
    return out;
  }

  examineProp(m, it) {
    this.sim.tell(m, 'info', this.propText(it).filter(Boolean).join(' '));
  }

  propText(it) {
    const d = this.sim.level.descs[it.path] || this.sim.level.descs[(it.path || '').replace(/^\//, '')];
    const out = [`This is ${a(it.name || 'thing')}.`, d?.[1] || ''];
    if (it.kind === 'closet') out.push(...this.sim.closets.examineLines(it));
    out.push(...this.sim.tanks.examine(it));
    return out.filter(Boolean);
  }
}
