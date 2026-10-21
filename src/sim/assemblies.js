import { S } from '../shared/config.js';
import { ACCESS_REGIONS } from '../shared/accessdata.js';
import { esc } from '../shared/util.js';
import { detach, place } from './inventory.js';
import { toolJob } from './tooljob.js';

const WIRES = 0, ELECTRONICS = 1, SCREWDRIVER = 2;                                   // door_assembly.dm: what an assembly needs next (AIRLOCK_ASSEMBLY_NEEDS_...)
const MATERIAL_AMT = 4;                                                              // material_amt: the metal sheets an assembly comes apart into
const isGlass = (item) => /^\/obj\/item\/stack\/sheet\/(rglass|glass)/.test(item.path);

/**
 * Airlocks put together and taken apart (door_assembly.dm, airlock.dm deconstruct, airlock_electronics.dm). An assembly (`/obj/structure/door_assembly`, made of four metal sheets from the stack
 * menu) is a prop with `it.asm = {id, state, glass, heat, electronics}`: a wrench bolts it down, a cable wires it, the airlock electronics go in, a screwdriver finishes it (the airlock appears,
 * with the access the electronics were set to), a crowbar takes the electronics out, a welder takes it apart. A finished airlock with its panel open and welded shut and no power is taken apart
 * with a crowbar (`takeApart`): it becomes an assembly that needs electronics, and the electronics come out with the access the door had.
 */
export class Assemblies {
  constructor(sim) { this.sim = sim; }

  table(g) { return g.level.assemblies || {}; }

  /** The pictures: [plain, glass]. */
  variant(it) { return it.asm.glass ? 1 : 0; }

  /** What changed on an assembly: its name, its picture. */
  refresh(it) {
    const sim = this.sim, a = it.asm, t = this.table(it.grid)[a.id];
    const first = a.state === WIRES ? (it.anc ? 'secured ' : '') : a.state === ELECTRONICS ? 'wired ' : 'near finished ';
    sim.renameProp(it.grid, it, `${first}${a.heat ? 'heat-proofed ' : ''}${a.glass ? 'window ' : ''}${t.base} assembly`);
    const v = this.variant(it);
    if ((it.pv | 0) !== v) { it.pv = v; it.grid.emit({ e: 'pv', i: it.idx, v }); }
  }

  /** The assemblies in glass (a joiner is told which picture, see Sim.gridState). */
  pv(g) { return g.props.interact.filter((it) => it.asm && !it.gone && it.asm.glass).map((it) => [it.idx, 1]); }

  /** A new assembly of kind `id` on tile (c, r) of grid `g` (the stack menu). */
  build(g, id, c, r, over = {}) {
    const t = this.table(g)[id];
    if (!t) return null;
    const spec = { k: 'sprite', x: c, y: r, l: 0, d: S, n: `${t.base} assembly`, p: 'structure/door_assembly', s: t.s, sv: [t.s, t.gs ?? t.s], den: 1, anc: 0, bb: 1 };
    const [it] = this.sim.addProps(g, [spec]);
    it.asm = { id, state: WIRES, glass: false, heat: false, electronics: null, name: null, ...over };
    if (over.anc) this.sim.anchoring.set(g, it, true);
    this.refresh(it);
    return it;
  }

  // ------------------------------------------------------------------ the assembly
  /** A click on an assembly (clickProp). Returns true if it was ours. */
  click(m, it, held) {
    if (!it.asm || it.gone || !held) return false;
    const sim = this.sim, g = it.grid, a = it.asm, t = this.table(g)[a.id], tool = held.def.tool, the = 'the airlock assembly';
    const at = { grid: g, x: it.x, z: it.z, l: it.l | 0 };
    const job = (label, ds, sfx, ok, o = {}) => toolJob(sim, m, { grid: g, x: it.x, z: it.z, l: it.l | 0, reach: 3.6, alive: () => !it.gone, state: () => `${a.state}${a.glass ? 'g' : ''}${it.anc ? 'a' : ''}` }, held, `${a.state}${a.glass ? 'g' : ''}${it.anc ? 'a' : ''}`, { label, ds, sfx, start: o.start ?? null, valid: o.valid, done: ok });
    const msg = (others, self) => { sim.chat.visible(m, others, 'notice', 10, m); sim.tell(m, 'notice', self); };

    if (tool === 'welder' && (a.glass || !it.anc)) {
      if (!held.lit || held.fuel <= 0) { sim.tell(m, 'warning', `The ${held.name} has to be on to complete this task!`); return true; }
      if (a.glass) {
        msg(`${m.name} welds the glass panel out of the airlock assembly.`, 'You start to weld the glass panel out of the airlock assembly...');
        job('welding the glass panel out', 40, 'welder', () => {
          sim.tell(m, 'notice', 'You weld the glass panel out.');
          sim.stacks.spawn(g, a.heat ? '/obj/item/stack/sheet/rglass' : '/obj/item/stack/sheet/glass', 1, it.x, it.z);
          a.glass = false; a.heat = false;
          this.refresh(it);
        }, { valid: () => held.lit });
      } else {
        sim.chat.visible(m, `${m.name} disassembles the airlock assembly.`, 'warning', 10, m);
        sim.tell(m, 'notice', 'You start to disassemble the airlock assembly...');
        job('disassembling the airlock assembly', 40, 'welder', () => {
          sim.tell(m, 'notice', 'You disassemble the airlock assembly.');
          this.dismantle(it, true);
        }, { valid: () => held.lit });
      }
      return true;
    }
    if (tool === 'wrench') {
      if (!it.anc) {
        if (g.world.doorAt.has(g.world.idx(it.c, it.r, it.l | 0))) { sim.tell(m, 'warning', 'There is another door here!'); return true; }
        sim.chat.visible(m, `${m.name} secures the airlock assembly to the floor.`, 'notice', 10, m);
        sim.tell(m, 'notice', 'You start to secure the airlock assembly to the floor...');
        sim.chat.heard(it, 'You hear wrenching.', 'notice', 6, m);
        job('securing the airlock assembly', 40, 'wrench', () => {
          sim.tell(m, 'notice', 'You secure the airlock assembly.');
          sim.anchoring.set(g, it, true);
          this.refresh(it);
        });
      } else {
        sim.chat.visible(m, `${m.name} unsecures the airlock assembly from the floor.`, 'notice', 10, m);
        sim.tell(m, 'notice', 'You start to unsecure the airlock assembly from the floor...');
        sim.chat.heard(it, 'You hear wrenching.', 'notice', 6, m);
        job('unsecuring the airlock assembly', 40, 'wrench', () => {
          sim.tell(m, 'notice', 'You unsecure the airlock assembly.');
          sim.anchoring.set(g, it, false);
          this.refresh(it);
        });
      }
      return true;
    }
    if (held.path.startsWith('/obj/item/stack/cable_coil') && a.state === WIRES && it.anc) {
      msg(`${m.name} wires the airlock assembly.`, 'You start to wire the airlock assembly...');
      job('wiring the airlock assembly', 40, 'wirecutter', () => {
        sim.stacks.use(m, held, 1);
        a.state = ELECTRONICS;
        sim.tell(m, 'notice', 'You wire the airlock assembly.');
        this.refresh(it);
      });
      return true;
    }
    if (tool === 'wirecutters' && a.state === ELECTRONICS) {
      msg(`${m.name} cuts the wires from the airlock assembly.`, 'You start to cut the wires from the airlock assembly...');
      job('cutting the wires from the airlock assembly', 40, 'wirecutter', () => {
        a.state = WIRES;
        sim.tell(m, 'notice', 'You cut the wires from the airlock assembly.');
        sim.stacks.spawn(g, '/obj/item/stack/cable_coil', 1, it.x, it.z);
        this.refresh(it);
      });
      return true;
    }
    if (held.def.airlockElectronics && a.state === ELECTRONICS) {
      sim.sound('screwdriver', at, 0.7);
      msg(`${m.name} installs the electronics into the airlock assembly.`, 'You start to install electronics into the airlock assembly...');
      job('installing the airlock electronics', 40, null, () => {
        if (m.held !== held) return;
        detach(sim, held);
        held.loc = { t: 'assembly' };
        a.electronics = held;
        a.state = SCREWDRIVER;
        sim.tell(m, 'notice', 'You install the airlock electronics.');
        this.refresh(it);
      });
      return true;
    }
    if (tool === 'crowbar' && a.state === SCREWDRIVER) {
      msg(`${m.name} removes the electronics from the airlock assembly.`, 'You start to remove electronics from the airlock assembly...');
      job('removing the airlock electronics', 40, 'crowbar', () => {
        sim.tell(m, 'notice', 'You remove the airlock electronics.');
        a.state = ELECTRONICS;
        this.dropElectronics(it, a.electronics);
        a.electronics = null;
        this.refresh(it);
      });
      return true;
    }
    if (isGlass(held) && !a.glass && t.gs != null) {
      const heat = held.path.startsWith('/obj/item/stack/sheet/rglass');
      sim.sound('crowbar', at, 1);
      msg(`${m.name} adds ${held.name} to the airlock assembly.`, `You start to install ${held.name} into the airlock assembly...`);
      job('installing glass in the airlock assembly', 40, null, () => {
        sim.stacks.use(m, held, 1);
        a.glass = true; a.heat = heat;
        sim.tell(m, 'notice', heat ? `You install ${held.name} windows into the airlock assembly.` : 'You install regular glass windows into the airlock assembly.');
        this.refresh(it);
      });
      return true;
    }
    if (tool === 'screwdriver' && a.state === SCREWDRIVER) {
      msg(`${m.name} finishes the airlock.`, 'You start finishing the airlock...');
      job('finishing the airlock', 40, 'screwdriver', () => {
        if (!a.electronics) return;
        sim.tell(m, 'notice', 'You finish the airlock.');
        this.finish(it);
      });
      return true;
    }
    return false;
  }

  /** The electronics fall out onto the floor of the assembly's (or door's) tile. */
  dropElectronics(it, item) {
    if (!item) return;
    this.sim.items.set(item.id, item);
    place(this.sim, item, it.grid, it.x, it.z, undefined, it.l | 0);
  }

  /** deconstruct(): four metal sheets (and the glass), and the assembly is gone. */
  dismantle(it, disassembled) {
    const sim = this.sim, g = it.grid, a = it.asm;
    sim.stacks.spawn(g, '/obj/item/stack/sheet/metal', MATERIAL_AMT, it.x, it.z);
    if (a.glass) sim.stacks.spawn(g, a.heat ? '/obj/item/stack/sheet/rglass' : '/obj/item/stack/sheet/glass', 1, it.x, it.z);
    if (a.electronics) this.dropElectronics(it, a.electronics);
    sim.removeProp(g, it);
    void disassembled;
  }

  /** The screwdriver: the airlock is made (the door's access is what the electronics were set to). */
  finish(it) {
    const sim = this.sim, g = it.grid, a = it.asm, t = this.table(g)[a.id], e = a.electronics;
    const glass = a.glass && t.gfr;
    const acc = e.acc || { list: [], one: false };
    const spec = {
      k: 'door', x: it.c, y: it.r, l: it.l | 0, d: S, n: a.name || t.base, fr: glass ? t.gfr : t.fr, a: acc.one ? [] : acc.list.slice(), o: acc.one ? acc.list.slice() : [],
      glass: glass ? 1 : 0, t: t.t,
    };
    sim.removeProp(g, it);
    const d = sim.addDoor(g, spec);
    sim.airlocks.state(d).electronics = e;
    sim.airlocks.state(d).assembly = { id: a.id, heat: a.heat };
    e.loc = { t: 'door' };
    return d;
  }

  // ------------------------------------------------------------------ a finished airlock comes apart
  /** Which assembly a door is made from: the one whose pictures it has (a door of the map's own kind that is not among them is a standard one). */
  assemblyOf(g, d) {
    const ax = this.sim.airlocks.state(d).assembly;
    if (ax) return { id: ax.id, glass: !!d.glass, heat: ax.heat };
    const fr = d.proto.fr.join(',');
    for (const [id, t] of Object.entries(this.table(g))) {
      if (t.fr.join(',') === fr) return { id, glass: false, heat: false };
      if (t.gfr && t.gfr.join(',') === fr) return { id, glass: true, heat: false };
    }
    const std = this.table(g).standard;
    return { id: 'standard', glass: !!d.glass && !!std?.gfr, heat: false };
  }

  /** A crowbar on an airlock with its panel open, welded shut, with no power and no bolts (airlock.dm try_to_crowbar, deconstruct). Returns true. */
  takeApart(m, d, held) {
    const sim = this.sim, g = d.grid;
    sim.chat.visible(m, `${m.name} removes the electronics from the airlock assembly.`, 'notice', 10, m);
    sim.tell(m, 'notice', 'You start to remove electronics from the airlock assembly...');
    const th = { grid: g, x: d.x, z: d.z, l: d.l | 0, reach: 3.2, alive: () => !d.gone, state: () => 1 };
    toolJob(sim, m, th, held, 1, {
      label: 'removing the airlock electronics', ds: 40, sfx: 'crowbar', start: null,
      done: () => {
        if (d.gone) return;
        const al = sim.airlocks.state(d), kind = this.assemblyOf(g, d);
        let e = al.electronics;
        if (!e) {
          e = sim.newItem('/obj/item/electronics/airlock');
          e.acc = d.o.length ? { list: d.o.slice(), one: true } : { list: d.a.slice(), one: false };
        }
        sim.tell(m, 'notice', 'You remove the airlock electronics.');
        sim.removeDoor(g, d);
        const it = this.build(g, kind.id, d.c, d.r, { state: ELECTRONICS, glass: kind.glass, heat: kind.heat, name: d.name !== this.table(g)[kind.id]?.base ? d.name : null, anc: true });
        if (it) this.dropElectronics(it, e);
      },
    });
    return true;
  }

  // ------------------------------------------------------------------ what a player sees
  examine(it) {
    const a = it.asm, out = [];
    out.push(`This is the ${it.name}.`);
    out.push(a.state === WIRES
      ? (it.anc ? 'The anchoring bolts are wrenched in place, but the maintenance panel lacks wiring.' : 'The assembly is welded together, but the anchoring bolts are unwrenched.')
      : a.state === ELECTRONICS ? 'The maintenance panel is wired, but the circuit slot is empty.' : 'The circuit is connected loosely to its slot, but the maintenance panel is unscrewed and open.');
    const t = this.table(it.grid)[a.id];
    if (t.gs != null) out.push(a.glass ? 'There is a small paper placard on the assembly. There are empty slots for mineral covers.' : 'There is a small paper placard on the assembly. There are empty slots for glass windows and mineral covers.');
    else out.push('There is a small paper placard on the assembly.');
    return out;
  }

  // ------------------------------------------------------------------ the electronics
  /** attack_self on airlock electronics: a menu of who may open the door. */
  electronicsOpen(m, item) {
    if (!m.client) return;
    item.acc ??= { list: [], one: false };
    const state = { view: 0 };
    this.sim.terminals.open(m.client, 'portable', { machine: { console: () => this.electronicsConsole(item, state) }, grid: m.grid, name: item.name });
  }

  electronicsConsole(item, state) {
    const acc = item.acc, has = (n) => acc.list.includes(n);
    const regions = ACCESS_REGIONS;
    const head = `<span class="h">Airlock electronics</span>\n\n${acc.list.length ? `Requires ${acc.one ? 'ONE' : 'ALL'} of ${acc.list.length} access${acc.list.length === 1 ? '' : 'es'}` : 'No access is required: it opens for anyone.'}`;
    if (state.view === 0) {
      return {
        title: 'Airlock Electronics', live: true, html: `${head}\n\nChoose a region to set its accesses.`,
        buttons: [
          { label: 'Clear all', fn: () => { acc.list = []; acc.one = false; } },
          { label: 'Grant all', fn: () => { acc.list = [...new Set(regions.flatMap((r) => r.accesses.map(([n]) => n)))]; } },
          { label: acc.one ? 'Requires one: on' : 'Requires one: off', fn: () => { acc.one = !acc.one; } },
          ...regions.map((r, k) => ({ label: `${r.name} (${r.accesses.filter(([n]) => has(n)).length}/${r.accesses.length})`, fn: () => { state.view = k + 1; } })),
        ],
      };
    }
    const r = regions[state.view - 1];
    return {
      title: 'Airlock Electronics', live: true, html: `${head}\n\n<span class="h">${esc(r.name)}</span>`,
      buttons: [
        { label: 'Back', fn: () => { state.view = 0; } },
        { label: 'Grant region', fn: () => { for (const [n] of r.accesses) if (!has(n)) acc.list.push(n); } },
        ...r.accesses.map(([n, desc]) => ({ label: `${has(n) ? '[x]' : '[ ]'} ${desc}`, fn: () => { acc.list = has(n) ? acc.list.filter((x) => x !== n) : [...acc.list, n]; } })),
      ],
    };
  }
}
