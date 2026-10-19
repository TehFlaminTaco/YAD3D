import { TILE } from '../shared/config.js';
import { CL, setClosetState } from '../shared/closets.js';
import { detach, place } from './inventory.js';

const ITEM_CAP = 30;            // storage_capacity: items a locker will take
const MOB_CAP = 3;              // mob_storage_capacity
const NOBUDGE_COOLDOWN = 5;     // seconds between "door won't budge" messages

export const timeText = (s) => (s >= 60 && s % 60 === 0 ? `${s / 60} minute${s === 60 ? '' : 's'}` : `${s} second${s === 1 ? '' : 's'}`);
const the = (it) => `the ${it.name}`;

/**
 * Closets, lockers and crates (SS13 /obj/structure/closet, closets.dm). Each is a record from buildPropData
 * (`sim.props.closets`) with live state `cs` (see shared/closets.js), `contents` (items) and `mobs` (people inside).
 */
export class Closets {
  constructor(sim, data = {}) {
    this.sim = sim;
    this.data = data;
    this.list = sim.props.closets;
    for (const it of this.list) this.init(it);
  }

  init(it) {
    it.contents = [];
    it.mobs = [];
    it.owner = null;                              // personal lockers: whose ID claimed it
    it.broken = false;
    this.populate(it);
    if (it.cs & CL.OPEN) { this.dump(it, null); return; }
    // anything lying on a closed closet's tile when the round starts is inside it (closets.dm take_contents on mapload)
    for (const rec of [...this.sim.floor.values()]) {
      if (it.contents.length >= ITEM_CAP) break;
      if (this.under(it, rec)) this.store(it, rec.item);
    }
  }

  /** Is this floor item lying where the closet stands (a free-standing box, so not a matter of tiles)? */
  under(it, rec) { return Math.abs(rec.x - it.x) < 0.8 && Math.abs(rec.z - it.z) < 0.8; }

  /** PopulateContents(): rows are [item path, count, chance %, stack amount] or {pick: [[weight, rows]]}. */
  populate(it) {
    const sim = this.sim;
    const run = (rows) => {
      for (const row of rows) {
        if (!Array.isArray(row)) {
          let r = sim.rand() * row.pick.reduce((a, [w]) => a + w, 0);
          for (const [w, sub] of row.pick) { r -= w; if (r <= 0) { run(sub); break; } }
          continue;
        }
        const [path, n, pr, amt] = row;
        for (let k = 0; k < n; k++) {
          if (it.contents.length >= ITEM_CAP || sim.rand() * 100 >= pr) continue;
          this.store(it, sim.newItem(path, amt ? { amount: amt } : {}));
        }
      }
    };
    run(this.data['/obj/' + it.path] || []);
  }

  store(it, item) {
    detach(this.sim, item);
    item.loc = { t: 'closet', cl: it };
    it.contents.push(item);
  }

  /** Everyone is told the new state; each side applies it to the tile with setClosetState. */
  set(it, cs, gone = false) {
    setClosetState(this.sim.world, it, cs, gone);
    this.sim.emit({ e: 'cl', i: it.idx, cs, g: gone ? 1 : 0 });
  }

  /** `self` is shown to the actor, `others` to everyone who can see them, `heard` to those who can only hear. */
  say(m, self, others, kind = 'notice', heard = null) {
    const sim = this.sim;
    if (self && m) sim.tell(m, kind, self);
    if (others) sim.chat.visible(m, others, kind, 12, m);
    if (heard) sim.chat.heard(m, heard, 'notice', 10, m);
  }

  allowed(m, it) {
    const { a, o } = it.cl;
    if (!a.length && !o.length) return true;
    const have = m.access;
    if (a.length && !a.every((x) => have.has(x))) return false;
    if (o.length && !o.some((x) => have.has(x))) return false;
    return true;
  }

  // ------------------------------------------------------------------ open / close
  open(m, it, force = false) {
    if (it.gone || (it.cs & CL.OPEN)) return false;
    if (!force && (it.cs & (CL.WELDED | CL.LOCKED))) return false;
    this.set(it, (it.cs | CL.OPEN) & ~(CL.WELDED | CL.LOCKED));
    this.sim.sound('closet_open', it.x, it.z, 0.8);
    this.dump(it, m);
    return true;
  }

  close(m, it) {
    if (it.gone || !(it.cs & CL.OPEN)) return false;
    this.take(it);
    this.set(it, it.cs & ~CL.OPEN);
    this.sim.sound('closet_close', it.x, it.z, 0.9);
    return true;
  }

  toggle(m, it) { return (it.cs & CL.OPEN) ? this.close(m, it) : this.open(m, it); }

  /** Everything inside comes out onto the closet's tile. */
  dump(it, opener) {
    const sim = this.sim;
    const items = it.contents.splice(0);
    for (const item of items) {
      item.loc = null;
      const x = it.x + (sim.rand() - 0.5) * (TILE - 0.9), z = it.z + (sim.rand() - 0.5) * (TILE - 0.9);
      place(sim, item, x, z);
    }
    for (const mob of it.mobs.splice(0)) {
      mob.inside = null;
      const [x, z] = this.exitSpot(it, mob, opener);
      mob.x = x; mob.z = z; mob.vx = mob.vz = 0;
      mob.dirty = true;
    }
  }

  /** Where someone leaving the closet stands: its own tile, or beside it if the open closet still blocks (crates). */
  exitSpot(it, mob, opener) {
    const w = this.sim.world;
    if (!it.cl.dopen) return [it.x, it.z];
    const first = opener && opener !== mob ? Math.atan2(opener.z - it.z, opener.x - it.x) : 0;
    for (let k = 0; k < 8; k++) {
      const a = first + k * Math.PI / 4;
      const x = it.x + Math.cos(a) * TILE, z = it.z + Math.sin(a) * TILE;
      if (!w.collides(x, z, 0.36)) return [x, z];
    }
    return [it.x, it.z];
  }

  /** Closing takes in whatever is on the tile: items (up to 30) and people (up to 3; crates only take the dead). */
  take(it) {
    const sim = this.sim;
    for (const rec of [...sim.floor.values()]) {
      if (it.contents.length >= ITEM_CAP) break;
      if (this.under(it, rec)) this.store(it, rec.item);
    }
    for (const mob of sim.mobs.values()) {
      if (it.mobs.length >= MOB_CAP) break;
      if (mob.kind !== 'human' || mob.inside || mob.evacuated || (it.cl.hz && !mob.dead)) continue;
      if (Math.abs(mob.x - it.x) >= 0.7 || Math.abs(mob.z - it.z) >= 0.7) continue;
      this.putInside(it, mob);
    }
  }

  putInside(it, mob) {
    if (mob.busy) this.sim.actions.cancelBusy(mob, 'invalid');
    mob.inside = it;
    mob.x = it.x; mob.z = it.z; mob.vx = mob.vz = 0;
    mob.dirty = true;
    it.mobs.push(mob);
  }

  // ------------------------------------------------------------------ locking
  togglelock(m, it, silent = false) {
    const sim = this.sim;
    if (!it.cl.sec) return false;
    if (it.broken) { sim.tell(m, 'warning', `The ${it.name} is broken!`); return false; }
    if (!this.allowed(m, it)) { if (!silent) sim.tell(m, 'danger', 'Access Denied.'); return false; }
    const locked = !(it.cs & CL.LOCKED);
    this.set(it, locked ? it.cs | CL.LOCKED : it.cs & ~CL.LOCKED);
    this.say(m, `You ${locked ? '' : 'un'}lock ${the(it)}.`, `${m.name} ${locked ? '' : 'un'}locks ${the(it)}.`);
    return true;
  }

  /** personal.dm attackby: swiping an ID claims an unclaimed personal locker, and its owner can lock and unlock it. */
  swipePersonal(m, it, card) {
    const sim = this.sim;
    if (it.broken) { sim.tell(m, 'danger', 'It appears to be broken.'); return; }
    if (!card.owner) return;
    if (this.allowed(m, it) || !it.owner || it.owner === card.owner) {
      this.set(it, it.cs ^ CL.LOCKED);
      if (!it.owner) it.owner = card.owner;
    } else sim.tell(m, 'danger', 'Access Denied.');
  }

  // ------------------------------------------------------------------ clicking one
  click(c, m, it, held, alt = false) {
    const sim = this.sim;
    if (it.gone || m.inside) return;
    const welder = held?.def.tool === 'welder';
    if (it.cs & CL.OPEN) {
      if (welder) return this.cutApart(m, it, held);
      if (!held && m.pulling) return this.stuff(m, it, m.pulling);       // someone in your grip goes in
      if (held) {                                    // put what you hold down on the closet's floor
        const x = it.x + (sim.rand() - 0.5) * (TILE - 0.9), z = it.z + (sim.rand() - 0.5) * (TILE - 0.9);
        detach(sim, held);
        place(sim, held, x, z);
        sim.sound('drop', it.x, it.z, 0.6);
        return;
      }
      this.close(m, it);
      return;
    }
    if (welder && !it.cl.nw) return this.weld(m, it, held);
    if (alt) { if (it.cl.sec && !held) this.togglelock(m, it); return; }
    if (held?.def.id) {
      if (it.cl.pl) this.swipePersonal(m, it, held); else this.togglelock(m, it);
      return;
    }
    // an empty hand opens it, and if it will not open that is the lock's business (closets.dm attack_hand).
    // SS13 only lets an empty hand do this; clicking with some other item opens it here too, so you need not drop things first.
    if (!this.open(m, it) && !held) this.togglelock(m, it);
  }

  weld(m, it, tool) {
    const acts = this.sim.actions;
    if (!acts.welderReady(m, tool)) return;
    const welded = !!(it.cs & CL.WELDED);
    acts.startTimed(m, `${welded ? 'unwelding' : 'welding'} the ${it.name}`, 4,
      () => !it.gone && !(it.cs & CL.OPEN) && tool.lit && m.held === tool && Math.hypot(m.x - it.x, m.z - it.z) < 3.4,
      () => {
        const now = !(it.cs & CL.WELDED);
        this.set(it, now ? it.cs | CL.WELDED : it.cs & ~CL.WELDED);
        this.say(m, `You ${now ? 'weld' : 'unwelded'} ${the(it)} with the ${tool.name}.`, `${m.name} ${now ? 'welds shut' : 'unwelded'} ${the(it)}.`, 'notice', 'You hear welding.');
      }, 'welder', { start: `You begin ${welded ? 'unwelding' : 'welding'} ${the(it)}...` });
  }

  cutApart(m, it, tool) {
    const sim = this.sim, acts = sim.actions;
    if (!acts.welderReady(m, tool)) return;
    acts.startTimed(m, `cutting ${the(it)} apart`, 4,
      () => !it.gone && (it.cs & CL.OPEN) && tool.lit && m.held === tool && Math.hypot(m.x - it.x, m.z - it.z) < 3.4,
      () => {
        this.say(m, `You cut ${the(it)} apart with the ${tool.name}.`, `${m.name} slices apart ${the(it)}.`, 'notice', 'You hear welding.');
        this.dump(it, m);
        this.set(it, it.cs, true);
        const sheets = sim.newItem('/obj/item/stack/sheet/metal', { amount: 2 });
        place(sim, sheets, it.x, it.z);
      }, 'welder', { start: `You begin cutting ${the(it)} apart...` });
  }

  // ------------------------------------------------------------------ being inside
  /** The person inside pushes against the door (a movement key, or B). */
  relaymove(m) {
    const it = m.inside;
    if (!it || m.dead || m.body.crit || m.busy) return;
    if (it.cs & CL.LOCKED) {
      if ((m.closetMsgAt || 0) <= this.sim.time) { m.closetMsgAt = this.sim.time + NOBUDGE_COOLDOWN; this.sim.tell(m, 'warning', `The ${it.name}'s door won't budge!`); }
      return;
    }
    this.resist(m, it);
  }

  /** container_resist(): out the door if it will open, otherwise start breaking out. */
  resist(m, it) {
    const sim = this.sim;
    if (!it || (it.cs & CL.OPEN) || m.busy || m.dead) return;
    if (!(it.cs & (CL.WELDED | CL.LOCKED))) { this.open(m, it); return; }
    const t = it.cl.bt;
    this.say(m, null, `The ${it.name} begins to shake violently!`, 'warning', `You hear banging from the ${it.name}.`);
    sim.actions.startTimed(m, 'breaking out', t,
      () => m.inside === it && !(it.cs & CL.OPEN) && (it.cs & (CL.WELDED | CL.LOCKED)),
      () => {
        this.say(m, `You successfully break out of ${the(it)}!`, `${m.name} successfully broke out of ${the(it)}!`, 'danger');
        it.broken = true;
        this.set(it, (it.cs & ~(CL.WELDED | CL.LOCKED)) | CL.BROKEN);
        this.open(m, it, true);
      }, null, {
        start: `You lean on the back of ${the(it)} and start pushing the door open... (this will take about ${timeText(t)}.)`,
        stop: () => (m.inside === it ? `You fail to break out of ${the(it)}!` : null),
        keep: true,
      });
  }

  /** Drag someone onto an open closet (or click it while holding them): four seconds standing still, and they are shut in. */
  stuff(m, it, o) {
    const sim = this.sim;
    if (it.gone || !(it.cs & CL.OPEN) || !o || o === m || o.kind !== 'human' || o.inside || m.inside || m.cuffed || m.busy) return;
    if (it.mobs.length >= MOB_CAP || (it.cl.hz && !o.dead)) return;
    const close = (mob) => Math.hypot(mob.x - it.x, mob.z - it.z) < 3.6;
    if (!sim.people.near(m, o) || !close(m)) return;
    this.say(m, `You try to stuff ${o.name} into ${the(it)}.`, `${m.name} tries to stuff ${o.name} into ${the(it)}.`, 'warning', 'You hear clanging.');
    const ox = o.x, oz = o.z;
    sim.actions.startTimed(m, `stuffing ${o.name} into ${the(it)}`, 4,
      () => !it.gone && (it.cs & CL.OPEN) && !o.inside && sim.people.near(m, o) && close(m) && Math.hypot(o.x - ox, o.z - oz) < 0.4,
      () => {
        this.say(m, `You stuff ${o.name} into ${the(it)}.`, `${m.name} stuffs ${o.name} into ${the(it)}.`, 'notice', 'You hear a loud metal bang.');
        o.stunned = Math.max(o.stunned, 4);
        if (o.pulledBy) sim.people.release(o.pulledBy);
        sim.people.release(o);
        o.x = it.x; o.z = it.z;
        this.close(m, it);
      }, null, { start: null, stop: null });
  }

  /** Late joiners need every closet that is not as the map left it. */
  changed() {
    return this.list.filter((it) => it.cs !== it.cs0 || it.gone).map((it) => [it.idx, it.cs, it.gone ? 1 : 0]);
  }

  examineLines(it) {
    const out = [];
    if (it.cs & CL.WELDED) out.push("It's welded shut.");
    if (!(it.cs & CL.OPEN) && it.cl.sec) {
      if (it.cl.pl && it.owner) out.push(`Owned by ${it.owner}.`);
      out.push(`Alt-click to ${it.cs & CL.LOCKED ? 'unlock' : 'lock'}.`);
    }
    if (it.cs & CL.OPEN) out.push('The parts are welded together.');
    return out;
  }
}
