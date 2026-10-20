import { KIND } from '../../shared/config.js';
import { cellMax } from '../../shared/powerdata.js';
import { attach, consume, place } from '../inventory.js';
import { toolJob } from '../tooljob.js';
import { shock } from './cables.js';

const isCoil = (it) => !!it && it.path.startsWith('/obj/item/stack/cable_coil');
const isBoard = (it) => !!it && it.path.startsWith('/obj/item/electronics/apc');
const isFrame = (it) => !!it && it.path.startsWith('/obj/item/wallframe/apc');
const isCell = (it) => !!it && !!it.def.cell && it.path.startsWith('/obj/item/stock_parts/cell');
const the = (a) => `the ${a.name}`;

/**
 * A click on an APC (apc.dm attackby, crowbar_act, screwdriver_act, wirecutter_act, welder_act, attack_hand, togglelock; terminal.dm dismantle). Taking one apart, and putting it
 * together, goes in the DM's order, with its messages and delays:
 *   crowbar: open the cover (it is locked until the board is out, "The cover is locked and cannot be opened!"), close it again, or take the board out (the wires have to be off first)
 *   screwdriver: expose the wires; with the cover open, take the cell out, or screw the board down or loose; wirecutters: cut the terminal off (a coil of ten comes back)
 *   a power cell goes in with the cover open (and the board screwed down); an APC board goes in; ten lengths of cable wire it up; a welder cuts the empty frame from the wall
 *   an APC frame (a metal sheet recipe) replaces a wrecked one or a missing cover, and goes back on the wall where the APC was
 *   an ID or alt-click locks the interface; an empty hand takes the cell out when the cover is open, else it opens the console.
 * Returns true: the click was the APC's.
 */
export function apcClick(a, c, m, held, alt) {
  const ps = a.ps, sim = ps.sim, g = ps.grid, w = g.world;
  if (!a.frame) return true;
  const say = (text, kind = 'notice') => sim.tell(m, kind, text);
  const others = (text) => sim.chat.visible(m, text, 'notice', 10, m);
  const at = { grid: g, x: a.rec.x, z: a.rec.z, l: a.rec.l | 0 };
  const th = { grid: g, x: a.rec.x, z: a.rec.z, l: a.rec.l | 0, reach: 3.6, alive: () => a.frame, state: () => a.rev };
  const tool = held?.def.tool;
  const bare = () => { const k = w.kind[a.tile]; return k === KIND.LATTICE || (k === KIND.FLOOR && w.floorType(a.tile)?.k !== 'tile' && w.floorType(a.tile)?.k !== 'engine'); };
  const job = (label, ds, o) => toolJob(sim, m, th, held, a.rev, { label, ds, ...o });
  const drop = (item) => { const [x, z] = sim.actions.frontOf(a.rec, m, 0.8); return place(sim, item, g, x, z, undefined, a.rec.l | 0); };
  const give = (item) => {                                                 // put_in_hands
    const free = m.hands[m.active] ? (m.hands[1 - m.active] ? -1 : 1 - m.active) : m.active;
    if (free >= 0) attach(sim, item, { t: 'hand', mob: m, i: free }); else place(sim, item, g, m.x, m.z, undefined, m.l | 0);
  };

  // ---- the lock: an ID, or alt-click (togglelock)
  if (alt || held?.def.id) {
    if (a.opened) say('You must close the cover to swipe an ID card!', 'warning');
    else if (a.panelOpen) say('You must close the panel!', 'warning');
    else if (a.broken || a.maint) say('Nothing happens!', 'warning');
    else if (sim.terminals.engineAccess(m)) { a.locked = !a.locked; say(`You ${a.locked ? 'lock' : 'unlock'} the APC interface.`); }
    else say('Access denied.', 'warning');
    return true;
  }

  // ---- the cell goes in
  if (isCell(held) && a.opened) {
    if (a.cell) say('There is a power cell already installed!', 'warning');
    else if (a.maint) say('There is no connector for your power cell!', 'warning');
    else {
      a.cell = { charge: Math.min(held.charge ?? cellMax(held.path), cellMax(held.path)), max: cellMax(held.path), path: held.path };
      consume(sim, held);
      a.chargecount = 0;
      others(`${m.name} inserts the power cell to ${a.name}!`);
      say('You insert the power cell.');
      sim.sound('pickup', at, 0.5);
      a.touch();
    }
    return true;
  }

  // ---- ten lengths of cable make the terminal
  if (isCoil(held) && a.opened) {
    if (!bare()) say('You must remove the floor plating in front of the APC first!', 'warning');
    else if (a.terminal) say('This APC is already wired!', 'warning');
    else if (!a.electronics) say('There is nothing to wire!', 'warning');
    else if ((held.amount ?? 1) < 10) say('You need ten lengths of cable for APC!', 'warning');
    else {
      others(`${m.name} adds cables to the APC frame.`);
      sim.sound('pickup', at, 0.6);
      job('adding cables to the APC frame', 20, {
        start: 'You start adding cables to the APC frame...',
        done: () => {
          if ((held.amount ?? 1) < 10 || a.terminal || !a.opened || !a.electronics) return;
          if (sim.rand() < 0.5 && shock(sim, m, ps.cables.net(a.tile), 1, 'power cable')) { sim.sound('sparks', at, 0.8); return; }
          sim.floors.use(m, held, 10);
          say('You add cables to the APC frame.');
          a.terminal = true;
          a.touch();
        },
      });
    }
    return true;
  }

  // ---- the board goes in
  if (isBoard(held) && a.opened) {
    if (a.electronics) say(`There is already a board inside ${the(a)}!`, 'warning');
    else if (a.broken) say('You cannot put the board inside, the frame is damaged!', 'warning');
    else {
      others(`${m.name} inserts the power control board into ${the(a)}.`);
      sim.sound('pickup', at, 0.6);
      job('inserting the power control board', 10, {
        start: 'You start to insert the power control board into the frame...',
        done: () => {
          if (a.electronics) return;
          a.electronics = 1;
          a.locked = false;
          say('You place the power control board inside the frame.');
          consume(sim, held);
          a.touch();
        },
      });
    }
    return true;
  }

  // ---- a frame replaces what is wrecked
  if (isFrame(held) && a.opened) {
    if (!(a.broken || a.opened === 2)) { say('You found no reason for repairing this APC!', 'warning'); return true; }
    if (!a.broken && a.opened === 2) {                                       // only the cover is gone
      others(`${m.name} replaces missing APC's cover.`);
      job('replacing the APC cover', 20, {
        start: "You begin to replace APC's cover...",
        done: () => { say("You replace missing APC's cover."); consume(sim, held); a.opened = 1; a.touch(); },
      });
      return true;
    }
    if (a.electronics) { say('You cannot repair this APC until you remove the electronics still inside!', 'warning'); return true; }
    others(`${m.name} replaces the damaged APC frame with a new one.`);
    job('replacing the APC frame', 50, {
      start: 'You begin to replace the damaged APC frame...',
      done: () => { say('You replace the damaged APC frame with a new one.'); consume(sim, held); a.broken = false; if (a.opened === 2) a.opened = 1; a.touch(); },
    });
    return true;
  }

  // ---- tools
  if (tool === 'crowbar') {
    if (a.opened) {
      if (a.electronics === 1) {
        if (a.terminal) { say('Disconnect the wires first!', 'warning'); return true; }
        sim.sound('crowbar', at, 0.9);
        job('removing the power control board', 50, {
          sfx: 'crowbar', start: 'You attempt to remove the power control board...',
          done: () => {
            if (a.electronics !== 1) return;
            a.electronics = 0;
            if (a.broken) { others(`${m.name} breaks the power control board inside ${a.name}!`); say('You break the charred power control board and remove the remains.'); }
            else {
              others(`${m.name} removes the power control board from ${a.name}!`);
              say('You remove the power control board.');
              drop(sim.newItem('/obj/item/electronics/apc'));
            }
            a.touch();
          },
        });
        return true;
      }
      if (a.opened !== 2) { a.opened = 0; a.coverlocked = true; sim.sound('crowbar', at, 0.6); a.touch(); }
      return true;
    }
    if (!a.broken) {
      if (a.coverlocked && !a.maint) say('The cover is locked and cannot be opened!', 'warning');
      else if (a.panelOpen) say('Exposed wires prevents you from opening it!', 'warning');
      else { a.opened = 1; sim.sound('crowbar', at, 0.6); a.touch(); }
    }
    return true;
  }

  if (tool === 'screwdriver') {
    if (a.opened) {
      if (a.cell) {
        const name = sim.newItem(a.cell.path).name;
        others(`${m.name} removes the ${name} from ${a.name}!`);
        say(`You remove the ${name}.`);
        place(sim, a.cellItem(), g, m.x, m.z, undefined, m.l | 0);               // (it lands at your feet)
        a.cell = null; a.charging = 0;
        a.touch();
      } else if (a.electronics === 1) { a.electronics = 2; sim.sound('screwdriver', at, 0.9); say('You screw the circuit electronics into place.'); a.touch(); }
      else if (a.electronics === 2) { a.electronics = 1; sim.sound('screwdriver', at, 0.9); say('You unfasten the electronics.'); a.touch(); }
      else say('There is nothing to secure!', 'warning');
    } else {
      a.panelOpen = !a.panelOpen;
      sim.sound('screwdriver', at, 0.9);
      say(`The wires have been ${a.panelOpen ? 'exposed' : 'unexposed'}.`);
      a.touch();
    }
    return true;
  }

  if (tool === 'wirecutters') {
    if (a.terminal && a.opened) {
      if (!bare()) { say('You must first expose the power terminal!', 'warning'); return true; }
      others(`${m.name} dismantles the power terminal from ${the(a)}.`);
      job('cutting the cables', 50, {
        sfx: 'wirecutter', start: 'You begin to cut the cables...', valid: () => a.opened === 1 || a.opened === 2,
        done: () => {
          if (!a.terminal || !a.opened) return;
          if (sim.rand() < 0.5 && shock(sim, m, ps.cables.net(a.tile), 1, 'power terminal')) { sim.sound('sparks', at, 0.8); return; }
          sim.stacks.spawn(g, '/obj/item/stack/cable_coil', 10, ...sim.actions.frontOf(a.rec, m, 0.8));
          say('You cut the cables and dismantle the power terminal.');
          a.terminal = false;
          a.touch();
        },
      });
    }
    return true;
  }

  if (tool === 'welder') {
    if (a.opened && !a.electronics && !a.terminal) {
      if (!sim.actions.welderReady(m, held, 3)) return true;
      others(`${m.name} welds ${the(a)}.`);
      job('welding the APC frame', 50, {
        sfx: 'welder', start: 'You start welding the APC frame...', valid: () => held.lit,
        done: () => {
          held.fuel = Math.max(0, held.fuel - 3); m.dirty = true;
          if (a.broken || a.opened === 2) {
            sim.stacks.spawn(g, '/obj/item/stack/sheet/metal', 1, ...sim.actions.frontOf(a.rec, m, 0.8));
            others(`${m.name} cuts ${the(a)} apart with the ${held.name}.`);
            say('You disassembled the broken APC frame.');
          } else {
            drop(sim.newItem('/obj/item/wallframe/apc'));
            others(`${m.name} cuts ${the(a)} from the wall with the ${held.name}.`);
            say('You cut the APC frame from the wall.');
          }
          a.takeOffWall();
        },
      });
    }
    return true;
  }

  // ---- hands: the cell, or the console
  if (!held) {
    if (a.opened) {
      if (a.cell) {
        const name = sim.newItem(a.cell.path).name;
        others(`${m.name} removes the ${name} from ${a.name}!`);
        say(`You remove the ${name}.`);
        give(a.cellItem());
        a.cell = null; a.charging = 0;
        a.touch();
      }
      return true;
    }
    if (a.maint || a.broken) return true;                                       // no board, no interface
    sim.terminals.open(c, 'apc', { machine: a, area: a.areaIdx, grid: g });
    return true;
  }
  if (tool) return true;                                                        // (a wrench or a multitool does nothing here)
  sim.terminals.open(c, 'apc', { machine: a, area: a.areaIdx, grid: g });         // anything else: as before, the console
  return true;
}

/**
 * An APC frame on a wall (apc_frame.dm try_build, attach): the APC of the room you are standing in, if it has none, comes back as an empty frame with its cover open: no board,
 * no cell, no wiring, and its breaker off. It goes up where the wall mount was (the map's APC places are the only ones the game knows).
 */
export function mountApcFrame(g, m, t, held) {
  const sim = g.sim, ps = g.powersim;
  if (!isFrame(held)) return false;
  let a = null, best = 3.2;                                                    // the empty mount nearest the wall that was clicked
  for (const q of ps.machines.apc) {
    const d = Math.hypot(q.rec.x - t.x, q.rec.z - t.z);
    if (!q.frame && (q.rec.l | 0) === (m.l | 0) && d < best) { a = q; best = d; }
  }
  if (!a) {
    const w = g.world, area = w.areaIdx[w.idx(Math.floor(m.x / 2), Math.floor(m.z / 2), m.l | 0)];
    sim.tell(m, 'warning', ps.machines.apc.some((q) => q.frame && q.areaIdx === area) ? 'This area already has an APC!' : 'You cannot place the APC frame on this spot!');
    return true;
  }
  if (ps.machines.apc.some((q) => q !== a && q.frame && q.areaIdx === a.areaIdx)) { sim.tell(m, 'warning', 'This area already has an APC!'); return true; }
  consume(sim, held);
  sim.sound('terminal_key', { grid: g, x: a.rec.x, z: a.rec.z, l: a.rec.l | 0 }, 0.7);
  sim.chat.visible(m, `${m.name} attaches the APC frame to the wall.`, 'notice', 10, m);
  sim.tell(m, 'notice', 'You attach the APC frame to the wall.');
  a.putOnWall();
  return true;
}
