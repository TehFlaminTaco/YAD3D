import { TILE, KIND } from '../shared/config.js';
import { GIRDER, girderLook } from '../shared/walls.js';
import { RECIPES, stackKey, stackInfo, menuFor } from '../shared/stacks.js';
import { place, attach, consume } from './inventory.js';

const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.floor(+v || 0)));

/**
 * What you can do with a stack (stack.dm): open its menu with Z, make things from it, take some of it out, and merge it with another of
 * its kind (that part is `mergeStack` in inventory.js, used when you pick one up or click one with another in your hand).
 */
export class Stacks {
  constructor(sim) { this.sim = sim; }

  // ------------------------------------------------------------------ stacks lying about
  /**
   * Make `amount` of a stack at (x, z) on `grid`: split into stacks of at most max_amount, and joined to any of its kind already on that tile
   * (stack.dm Initialize). Returns the items made or grown.
   */
  spawn(grid, path, amount, x, z) {
    const sim = this.sim, info = stackInfo(path), out = [];
    if (!info) { const it = sim.newItem(path); place(sim, it, grid, x, z); return [it]; }
    const key = stackKey(path), c = Math.floor(x / TILE), r = Math.floor(z / TILE);
    let left = amount;
    for (const f of sim.floor.values()) {
      if (left <= 0) break;
      if (f.grid !== grid || f.c !== c || f.r !== r || stackKey(f.item.path) !== key) continue;
      const move = Math.min(left, info.max - (f.item.amount ?? 1));
      if (move > 0) { f.item.amount = (f.item.amount ?? 1) + move; left -= move; out.push(f.item); }
    }
    while (left > 0) {
      const n = Math.min(left, info.max);
      const it = sim.newItem(path, { amount: n });
      place(sim, it, grid, x, z);
      out.push(it);
      left -= n;
    }
    return out;
  }

  // ------------------------------------------------------------------ the menu
  /** Z with a stack in your hand: tell the client what it can make. */
  open(m, item) {
    const info = stackInfo(item.path);
    if (!info || !m.client) return;
    const key = stackKey(item.path);
    m.client.outbox.push({ e: 'stack', id: item.id, name: item.name, amount: item.amount ?? 1, one: info.one, recipes: menuFor(key, item.amount ?? 1, info.one) });
  }

  close(m) { if (m.client) m.client.outbox.push({ e: 'stack', close: 1 }); }

  /** A message from the stack window: {op: 'make', item, i, mult} | {op: 'take', item, n} | {op: 'close'}. */
  handle(c, msg) {
    const m = c.mob;
    if (!m || m.dead || m.stunned > 0 || m.body.crit || m.cuffed || !m.humanoid) return;
    const item = this.sim.items.get(msg.item);
    if (!item || !stackInfo(item.path)) return;
    if (msg.op === 'make') { if (m.held === item) this.make(m, item, clampInt(msg.i, 0, 99), clampInt(msg.mult, 1, 99)); }
    else if (msg.op === 'take') this.take(m, item, clampInt(msg.n, 0, 9999));
  }

  // ------------------------------------------------------------------ taking some out
  /** change_stack(): `n` of them become a stack of their own, in your free hand or at your feet. */
  take(m, item, n) {
    const sim = this.sim, held = [m.hands[0], m.hands[1]].includes(item);
    if (!held || n <= 0) return;
    n = Math.min(n, item.amount ?? 1);
    const free = m.hands[m.active] === item ? (m.hands[1 - m.active] ? -1 : 1 - m.active) : (m.hands[m.active] ? (m.hands[1 - m.active] ? -1 : 1 - m.active) : m.active);
    item.amount -= n;
    const part = sim.newItem(item.path, { amount: n });
    if (free >= 0) attach(sim, part, { t: 'hand', mob: m, i: free }); else place(sim, part, m.grid, m.x - Math.sin(m.yaw) * 0.6, m.z - Math.cos(m.yaw) * 0.6);
    if (item.amount <= 0) consume(sim, item);
    sim.tell(m, 'notice', `You take ${n} sheets out of the stack.`);
    if (m.held && stackInfo(m.held.path)) this.open(m, m.held); else this.close(m);
  }

  // ------------------------------------------------------------------ making things
  /** The tile in front of you, where a structure goes (the DM builds it under your feet; here you would be standing inside it). */
  frontTile(m) {
    const x = m.x - Math.sin(m.yaw) * TILE, z = m.z - Math.cos(m.yaw) * TILE;
    return [Math.floor(x / TILE), Math.floor(z / TILE)];
  }

  /** stack.dm building_checks(): why this cannot be built there, or null. */
  why(m, item, R, mult, tile) {
    const sim = this.sim, w = m.grid.world, built = m.grid.built, info = stackInfo(item.path);
    const amount = item.amount ?? 1;
    if (amount < R.req * mult) {
      const the = `the ${item.name}`;
      return R.req * mult > 1 ? `You haven't got enough ${the} to build the ${R.req * mult} ${R.title}s!` : `You haven't got enough ${the} to build the ${R.title}!`;
    }
    void info;
    if (!R.build) return null;
    const [c, r] = tile;
    if (!w.inb(c, r)) return `The ${R.title} must be constructed on the floor!`;
    const i = w.idx(c, r);
    if (R.onePerTurf && built.at(c, r)) return `There is another ${R.title} here!`;
    if (R.onFloor) {
      if (w.kind[i] !== KIND.FLOOR) return `The ${R.title} must be constructed on the floor!`;
      const blocker = built.at(c, r) ? girderLook(built.at(c, r).st).name : w.doorAt.has(i) ? 'door' : (w.solid[i] || w.dyn[i]) ? 'thing' : null;
      if (blocker) return `Theres a ${blocker} here. You cant make a ${R.title} here!`;
    }
    if (!w.los(m.x, m.z, c * TILE + TILE / 2, r * TILE + TILE / 2)) return `The ${R.title} must be constructed on the floor!`;
    return null;
  }

  make(m, item, ri, mult) {
    const sim = this.sim, key = stackKey(item.path), R = (RECIPES[key] || [])[ri];
    if (!R) return;
    if (R.maxRes > 1 && mult > Math.round(R.maxRes / (R.res || 1))) return;
    const tile = this.frontTile(m);
    const bad = this.why(m, item, R, mult, tile);
    if (bad) { sim.tell(m, 'warning', bad); return; }
    const finish = () => {
      const again = this.why(m, item, R, mult, tile);
      if (again) { sim.tell(m, 'warning', again); return; }
      this.use(m, item, R.req * mult);
      if (R.item) this.give(m, R.item, (R.res || 1) * mult);
      else if (R.build === 'girder') {
        const [c, r] = tile;
        sim.addBuilt(m.grid, 'girder', c, r, GIRDER.NORMAL);
        this.moveOut(m, c, r);
      }
      if (m.held && stackInfo(m.held.path)) this.open(m, m.held); else this.close(m);
    };
    if (R.time) {
      sim.actions.startTimed(m, `building ${/^[aeiou]/i.test(R.title) ? 'an' : 'a'} ${R.title}`, R.time / 10, () => m.held === item && Math.hypot(m.x - (tile[0] * TILE + TILE / 2), m.z - (tile[1] * TILE + TILE / 2)) < 3.6 && !this.why(m, item, R, mult, tile), finish, null, { start: `You start building ${/^[aeiou]/i.test(R.title) ? 'an' : 'a'} ${R.title}...` });
      sim.chat.visible(m, `${m.name} starts building ${/^[aeiou]/i.test(R.title) ? 'an' : 'a'} ${R.title}.`, 'notice', 10, m);
      this.close(m);
    } else finish();
  }

  /** Use up `n` of the stack (a stack that is used up is gone). */
  use(m, item, n) {
    item.amount -= n;
    if (item.amount <= 0) consume(this.sim, item);
  }

  /** A new stack of `path` for you: into your free hand, else onto the floor at your feet (put_in_hands). */
  give(m, path, amount) {
    const sim = this.sim;
    const free = m.hands[m.active] ? (m.hands[1 - m.active] ? -1 : 1 - m.active) : m.active;
    if (free >= 0) attach(sim, sim.newItem(path, { amount }), { t: 'hand', mob: m, i: free });
    else this.spawn(m.grid, path, amount, m.x - Math.sin(m.yaw) * 0.6, m.z - Math.cos(m.yaw) * 0.6);
  }

  /** Something solid went up where you stand a little (the tile in front reaches back): step back out of it. */
  moveOut(m, c, r) {
    const R = 0.32, x0 = c * TILE, z0 = r * TILE, x1 = x0 + TILE, z1 = z0 + TILE;
    if (m.x + R <= x0 || m.x - R >= x1 || m.z + R <= z0 || m.z - R >= z1) return;
    const dx = Math.sin(m.yaw), dz = Math.cos(m.yaw);        // back, away from where you face
    for (let k = 1; k <= 12; k++) {
      const x = m.x + dx * 0.1 * k, z = m.z + dz * 0.1 * k;
      if (!m.grid.world.collides(x, z, R)) { m.x = x; m.z = z; m.vx = m.vz = 0; return; }
    }
  }
}

