import { esc } from '../shared/util.js';
import { shock } from './power/cables.js';
import { toolJob } from './tooljob.js';

/** The wires of an airlock (`datum/wires/airlock`): fourteen that do something, and two duds (`add_duds(2)`). */
export const WIRES = ['power1', 'power2', 'backup1', 'backup2', 'open', 'bolts', 'idscan', 'ai', 'shock', 'safety', 'timing', 'light', 'zap1', 'zap2'];
const DUDS = ['dud0', 'dud1'];
/** The colours a wire can be (`randomize` in _wires.dm). The wires get one each, shuffled once a round: every airlock has the same ones. */
export const COLORS = ['blue', 'brown', 'crimson', 'cyan', 'gold', 'grey', 'green', 'magenta', 'orange', 'pink', 'purple', 'red', 'silver', 'violet', 'white', 'yellow'];

const MAIN_LOST = 60, BACKUP_LOST = 60, BACKUP_MIN = 10, ELECTRIFY_TEMP = 30;        // airlock.dm loseMainPower / loseBackupPower, MACHINE_DEFAULT_ELECTRIFY_TIME
const DOOR_CRUSH_DAMAGE = 15;                                                        // mobs.dm

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * What a player can do to an airlock's insides (airlock.dm, door.dm, `datum/wires/airlock`): the maintenance panel (a screwdriver), the wires behind it (wirecutters cut and mend them, a multitool pulses
 * them: a console lists them by colour, and the status lights say what the door is doing), bolts, power that is lost and comes back, electrification, the safeties, the timer, a welder shutting it, a
 * crowbar forcing it when it has no power. The state is on the server (`state(door)`); the door itself (`DoorCore`) only knows what the clients draw: its state, whether it is bolted or welded.
 */
export class Airlocks {
  constructor(sim) {
    this.sim = sim;
    this.live = new Set();                                                           // doors with a timer running (power lost, electrified)
    const order = WIRES.concat(DUDS), pool = COLORS.slice();
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(sim.rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    this.colorOf = new Map();                                                        // wire -> its colour, this round
    this.wireOf = new Map();                                                         // colour -> its wire
    for (const wire of order) { const k = Math.floor(sim.rand() * pool.length), c = pool.splice(k, 1)[0]; this.colorOf.set(wire, c); this.wireOf.set(c, wire); }
    this.states = new WeakMap();
  }

  /** The things about a door only the server knows. */
  state(d) {
    let s = this.states.get(d);
    if (!s) {
      s = { panel: false, cut: new Set(), mainLost: 0, backupLost: 0, electrified: 0, safe: true, autoclose: true, normalspeed: true, lights: true, emergency: false, ai: 0, shockAt: -9 };
      this.states.set(d, s);
    }
    return s;
  }

  isCut(d, wire) { return this.state(d).cut.has(wire); }
  electrified(d) { return this.state(d).electrified !== 0; }
  /** airlock.dm hasPower: the room has power for it, and it has not lost both its main and its backup. */
  hasPower(d) { const s = this.state(d); return d.grid.power.doorsWork(d) && !(s.mainLost > 0 && s.backupLost > 0); }

  // ------------------------------------------------------------------ power, bolts, shocks
  loseMain(d) {
    const s = this.state(d);
    if (s.mainLost <= 0) { s.mainLost = MAIN_LOST; if (s.backupLost < BACKUP_MIN) s.backupLost = BACKUP_MIN; }
    this.live.add(d);
  }
  loseBackup(d) { const s = this.state(d); if (s.backupLost < BACKUP_LOST) s.backupLost = BACKUP_LOST; this.live.add(d); }
  regainMain(d) { this.state(d).mainLost = 0; }
  regainBackup(d) { this.state(d).backupLost = 0; }

  bolt(d) {
    if (d.bolted) return;
    d.bolted = true;
    this.sim.sound('door_bolt', d, 0.5);
    this.sim.chat.heard(d, 'You hear a click from the bottom of the door.', 'notice', 5);
  }
  unbolt(d) {
    if (!d.bolted) return;
    d.bolted = false;
    this.sim.sound('door_unbolt', d, 0.5);
    this.sim.chat.heard(d, 'You hear a click from the bottom of the door.', 'notice', 5);
  }

  /** airlock.dm set_electrified: `seconds` (0 not, -1 for good). */
  electrify(d, seconds) {
    this.state(d).electrified = seconds;
    if (seconds > 0) this.live.add(d);
  }

  /** airlock.dm shock: the user is shocked with probability `prb` percent if the door has power and has not shocked someone this second. */
  shockUser(m, d, prb) {
    const sim = this.sim, s = this.state(d);
    if (!m?.humanoid || !this.hasPower(d) || sim.time - s.shockAt < 1 || sim.rand() * 100 >= prb) return false;
    sim.sound('sparks', d, 0.6);
    const g = d.grid, apc = g.powersim.apcOf(g.world.areaIdx[d.i]);
    if (!shock(sim, m, apc?.net ?? null, 1, 'airlock')) return false;
    s.shockAt = sim.time;
    return true;
  }

  /** Each tick: what is running down. */
  update(dt) {
    for (const d of this.live) {
      const s = this.state(d);
      if (s.mainLost > 0 && !this.isCut(d, 'power1') && !this.isCut(d, 'power2')) s.mainLost = Math.max(0, s.mainLost - dt);
      if (s.backupLost > 0 && !this.isCut(d, 'backup1') && !this.isCut(d, 'backup2')) s.backupLost = Math.max(0, s.backupLost - dt);
      if (s.electrified > 0) { s.electrified -= dt; if (s.electrified <= 0) s.electrified = 0; }
      if (s.aiBack && this.sim.time >= s.aiBack) { s.ai = s.ai === 1 ? 0 : s.ai === 2 ? -1 : s.ai; s.aiBack = 0; }
      if (s.mainLost <= 0 && s.backupLost <= 0 && s.electrified === 0 && !s.aiBack) this.live.delete(d);
    }
  }

  /** How long an open door waits before it shuts (`autoclose_in(normalspeed ? 150 : 15)` deciseconds, shorter here: doors are quicker in this game); null if it does not shut by itself. */
  holdTime(d) { const s = this.state(d); return s.autoclose ? (s.normalspeed ? 3.2 : 0.6) : null; }

  /** A player came up to a closed door that would open for them (`bumpopen`): an electrified one shocks instead. Returns false if it should not open now. */
  bump(d, m) {
    if (!this.electrified(d)) return true;
    this.shockUser(m, d, 100);
    return false;
  }

  /** A door shuts on someone (door.dm crush). */
  crush(d) {
    const sim = this.sim;
    for (const m of sim.mobs.values()) {
      if (m.dead || m.grid !== d.grid || (m.l | 0) !== (d.l | 0) || sim.dist(m, d) > 1.5) continue;
      sim.chat.visible(m, `The ${d.name} closes on ${m.name}, crushing ${m.humanoid ? 'them' : 'it'}!`, 'danger', 10, m);
      sim.tell(m, 'danger', `The ${d.name} closes on you and crushes you!`);
      sim.hurt(m, DOOR_CRUSH_DAMAGE, 'brute', d.name);
      if (m.humanoid) m.stunned = Math.max(m.stunned, 10);
    }
  }

  // ------------------------------------------------------------------ the wires
  /** datum/wires cut: a wire is cut, or mended if it was cut. */
  cut(d, wire, m) {
    const s = this.state(d), mend = s.cut.has(wire);
    if (mend) s.cut.delete(wire); else s.cut.add(wire);
    const cut = (w) => s.cut.has(w);
    switch (wire) {
      case 'power1': case 'power2':                                                   // cut to lose power, repair both to get it back
        if (mend && !cut('power1') && !cut('power2')) this.regainMain(d); else this.loseMain(d);
        if (m) this.shockUser(m, d, 50);
        break;
      case 'backup1': case 'backup2':
        if (mend && !cut('backup1') && !cut('backup2')) this.regainBackup(d); else this.loseBackup(d);
        if (m) this.shockUser(m, d, 50);
        break;
      case 'bolts': if (!mend) this.bolt(d); break;                                   // cut to drop the bolts, mending does nothing
      case 'ai': s.ai = mend ? (s.ai === 1 ? 0 : s.ai === 2 ? -1 : s.ai) : (s.ai === 0 ? 1 : s.ai === -1 ? 2 : s.ai); break;
      case 'shock': if (mend) { if (s.electrified) this.electrify(d, 0); } else if (s.electrified !== -1) this.electrify(d, -1); break;
      case 'safety': s.safe = mend; break;
      case 'timing': s.autoclose = mend; if (s.autoclose && d.isOpen) this.sim.closeDoor(d); break;
      case 'idscan': d.noId = !mend; break;
      case 'light': s.lights = mend; break;
      case 'zap1': case 'zap2': if (m) this.shockUser(m, d, 50); break;
      default: break;
    }
  }

  /** datum/wires pulse (a cut wire does nothing). */
  pulse(d, wire, m) {
    const sim = this.sim, s = this.state(d);
    if (s.cut.has(wire)) return;
    switch (wire) {
      case 'power1': case 'power2': this.loseMain(d); break;
      case 'backup1': case 'backup2': this.loseBackup(d); break;
      case 'open':                                                                    // opens the door (if it asks for no ID, or none is needed): or shuts it
        if (!d.noId && (d.a.length || d.o.length)) break;
        if (d.state === 'closed') sim.openDoor(d, null); else if (d.isOpen) this.close(d);
        break;
      case 'bolts': if (!d.bolted) this.bolt(d); else if (this.hasPower(d)) this.unbolt(d); break;
      case 'idscan': if (this.hasPower(d) && d.state === 'closed') { sim.sound('door_denied', d, 0.8); s.emergency = false; } break;
      case 'ai': s.ai = s.ai === 0 ? 1 : s.ai === -1 ? 2 : s.ai; s.aiBack = sim.time + 1; this.live.add(d); break;          // (the connection light goes out for a second)
      case 'shock': if (!s.electrified) this.electrify(d, ELECTRIFY_TEMP); break;
      case 'safety': s.safe = !s.safe; if (d.isOpen) this.close(d); break;
      case 'timing': s.normalspeed = !s.normalspeed; break;
      case 'light': s.lights = !s.lights; break;
      default: break;
    }
  }

  /** Shut a door by hand or wire: the same as `close()` in the DM (it does nothing if it is bolted or welded; `safe` ones wait for whoever is in the way). */
  close(d) {
    if (d.bolted || d.welded || !d.isOpen) return false;
    if (this.state(d).safe && this.sim.occupied(d)) return false;
    return this.sim.closeDoor(d);
  }

  /** What the wires say (airlock.dm get_status). */
  status(d) {
    const s = this.state(d);
    return [
      `The door bolts ${d.bolted ? 'have fallen!' : 'look up.'}`,
      `The test light is ${this.hasPower(d) ? 'on' : 'off'}.`,
      `The AI connection light is ${s.ai ? 'off' : 'on'}.`,
      `The check wiring light is ${s.safe ? 'off' : 'on'}.`,
      `The timer is powered ${s.autoclose ? 'on' : 'off'}.`,
      `The speed light is ${s.normalspeed ? 'on' : 'off'}.`,
      `The emergency light is ${s.emergency ? 'on' : 'off'}.`,
    ];
  }

  // ------------------------------------------------------------------ clicks
  /** A click on a door with something in the hand (`Actions.clickDoor`, first). Returns true if it was ours. */
  click(m, d, held) {
    const sim = this.sim, s = this.state(d), the = `the ${d.name}`;
    if (this.electrified(d) && this.shockUser(m, d, held ? 75 : 100)) return true;      // attackby / attack_hand: a live door shocks whoever touches it
    if (!held) return false;
    const tool = held.def.tool;
    if (tool === 'screwdriver') {
      s.panel = !s.panel;
      sim.tell(m, 'notice', `You ${s.panel ? 'open' : 'close'} the maintenance panel of the airlock.`);
      sim.sound('screwdriver', d, 0.7);
      return true;
    }
    if ((tool === 'wirecutters' || tool === 'multitool') && s.panel) {
      sim.terminals.open(m.client, 'portable', { machine: { console: () => this.wiresConsole(m.client, d) }, grid: d.grid, name: `${d.name} wires` });
      return true;
    }
    if (tool === 'welder' && m.intent !== 'help') return this.weld(m, d, held, the);
    if (tool === 'welder') { sim.tell(m, 'notice', 'The airlock doesn\'t need repairing.'); return true; }
    if (tool === 'crowbar' && m.intent !== 'harm') return this.crowbar(m, d, held);
    return false;
  }

  weld(m, d, held, the) {
    const sim = this.sim;
    if (d.state !== 'closed') return true;
    if (!held.lit || held.fuel <= 0) { sim.tell(m, 'warning', `The ${held.name} has to be on to complete this task!`); return true; }
    const was = d.welded;
    sim.chat.visible(m, `${m.name} begins ${was ? 'unwelding' : 'welding'} the airlock.`, 'notice', 10, m);
    sim.tell(m, 'notice', `You begin ${was ? 'unwelding' : 'welding'} the airlock...`);
    const th = { grid: d.grid, x: d.x, z: d.z, l: d.l | 0, reach: 3.2, alive: () => d.state === 'closed', state: () => (d.welded ? 1 : 0) };
    toolJob(sim, m, th, held, was ? 1 : 0, {
      label: `${was ? 'unwelding' : 'welding'} the airlock`, ds: 40, sfx: 'welder', start: null, valid: () => held.lit,
      done: () => {
        d.welded = !was;
        sim.chat.visible(m, `${m.name} ${d.welded ? 'welds shut' : 'unwelds'} ${the}.`, 'notice', 10, m);
        sim.tell(m, 'notice', `You ${d.welded ? 'weld the airlock shut' : 'unweld the airlock'}.`);
      },
    });
    return true;
  }

  /** door.dm / airlock.dm try_to_crowbar, without the jaws of life. */
  crowbar(m, d, held) {
    const sim = this.sim, s = this.state(d);
    if (s.panel && !d.emagged && d.state === 'closed' && d.welded && !this.hasPower(d) && !d.bolted && sim.assemblies?.takeApart) return sim.assemblies.takeApart(m, d, held);
    if (d.state !== 'closed' && d.state !== 'open') return true;
    if (d.bolted) { sim.tell(m, 'warning', "The airlock's bolts prevent it from being forced!"); return true; }
    if (d.welded) { sim.tell(m, 'warning', "It's welded, it won't budge!"); return true; }
    if (this.hasPower(d)) { sim.tell(m, 'warning', "The airlock's motors resist your efforts to force it!"); return true; }
    if (d.state === 'closed') { d.pried = true; sim.openDoor(d, m, true); } else sim.closeDoor(d);
    sim.sound('door_forced', d, 0.9);
    return true;
  }

  // ------------------------------------------------------------------ the wires console
  wiresConsole(c, d) {
    const sim = this.sim, s = this.state(d), m = c.mob;
    if (!s.panel) return { title: 'Airlock Wires', html: '<span class="h">Airlock Wires</span>\n\nThe maintenance panel is closed.', buttons: [] };
    const colors = COLORS.slice().sort();
    const buttons = [], rows = [];
    for (const col of colors) {
      const wire = this.wireOf.get(col), cut = s.cut.has(wire);
      rows.push(`${cap(col).padEnd(10)} ${cut ? '<span class="w">cut</span>' : '<span class="c">intact</span>'}`);
      buttons.push({ label: `${cap(col)}: ${cut ? 'Mend' : 'Cut'}`, fn: () => this.act(c, d, 'cut', wire, col) });
      buttons.push({ label: `${cap(col)}: Pulse`, fn: () => this.act(c, d, 'pulse', wire, col) });
    }
    void m;
    return { title: `${cap(d.name)} Wires`, live: true, html: `<span class="h">${esc(cap(d.name))} wires</span>\n\n${rows.join('\n')}\n\n${this.status(d).map(esc).join('\n')}`, buttons };
  }

  /** A button of the console: cutting needs wirecutters in the hand, pulsing a multitool (`datum/wires ui_act`). */
  act(c, d, what, wire, col) {
    const sim = this.sim, m = c.mob, s = this.state(d);
    if (!m || !s.panel) return;
    const held = m.held;
    if (this.electrified(d) && this.shockUser(m, d, 100)) return;                    // (interactable(): a live door shocks whoever reaches in)
    if (what === 'cut') {
      if (held?.def.tool !== 'wirecutters') { sim.tell(m, 'warning', 'You need wirecutters!'); return; }
      sim.sound('wirecutter', d, 0.3);
      this.cut(d, wire, m);
    } else {
      if (held?.def.tool !== 'multitool') { sim.tell(m, 'warning', 'You need a multitool!'); return; }
      sim.sound('beep', d, 0.3);
      this.pulse(d, wire, m);
    }
    void col;
  }

  examine(d) {
    const s = this.state(d), out = [];
    if (d.welded) out.push('It seems to be welded shut.');
    if (d.bolted) out.push('The bolts are down.');
    if (s.panel) out.push('Its wires are exposed!');
    return out;
  }
}
