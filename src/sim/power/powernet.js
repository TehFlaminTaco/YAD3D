/**
 * The cables of a grid, and the networks they make (powernet.dm, cable.dm). In this TG a cable joins every cable beside it (`Connect_cable`), so a network is
 * a set of cable tiles touching each other, and cutting one splits it, laying one joins what it touches. Machines sit on a cable tile and belong to its network.
 *
 * A network is run in "power ticks" (SSmachines, every 2 s): machines add to `newavail` (what is made) and to `load` (what is used) while the tick runs, reading `avail`
 * (what was made last tick); `reset()` at the end of the tick turns `newavail` into `avail`, gives a surplus back to the SMES that output it, and smooths what a monitor shows.
 */
export class Net {
  constructor(id) {
    this.id = id;
    this.tiles = 0;                  // cable tiles in it
    this.avail = 0;                  // W made last tick
    this.newavail = 0;               // W made this tick
    this.load = 0;                   // W used this tick so far
    this.delayedload = 0;
    this.netexcess = 0;              // avail - load, as the tick ended
    this.viewavail = 0;              // the same, smoothed for a monitor
    this.viewload = 0;
    this.smes = [];                  // the SMES that put power onto it (their output side is in it)
    this.history = [];               // [avail, load] samples for the monitor
    this.sample = 0;
  }

  /** What is left to take (powernet.dm surplus): clamp(avail - load, 0, avail). */
  surplus() { return Math.max(0, Math.min(this.avail, this.avail - this.load)); }

  addAvail(w) { this.newavail += w; }
  addLoad(w) { this.load += w; }

  /** End of a tick (powernet.dm reset). */
  reset(dt) {
    this.netexcess = this.avail - this.load;
    if (this.netexcess > 100 && this.smes.length) for (const s of this.smes) s.restore(this);
    this.viewavail = Math.round(0.8 * this.viewavail + 0.2 * this.avail);
    this.viewload = Math.round(0.8 * this.viewload + 0.2 * this.load);
    this.sample += dt;
    if (this.sample >= 5) {                                           // the power monitor's graph: a point every five seconds, a minute of them
      this.sample = 0;
      this.history.push([this.avail, this.load]);
      if (this.history.length > 60) this.history.shift();
    }
    this.load = this.delayedload;
    this.delayedload = 0;
    this.avail = this.newavail;
    this.newavail = 0;
  }
}

/** The cable network of one grid. `world.cable` says where there is cable; this works out which of it is joined. */
export class Cables {
  constructor(world) {
    this.world = world;
    this.netOf = new Int32Array(world.n).fill(-1);
    this.nets = new Map();
    this.seq = 1;
    this.dirty = true;
    this.blocked = new Set();        // pairs of neighbouring tiles whose cables do not join (an SMES and its terminal: cable.dm Connect_cable)
  }

  /** The cables on tiles `i` and `j` do not join, though they touch. */
  block(i, j) { this.blocked.add(Math.min(i, j) * 4194304 + Math.max(i, j)); }
  joined(i, j) { return !this.blocked.has(Math.min(i, j) * 4194304 + Math.max(i, j)); }

  has(i) { return this.world.cable[i] === 1; }

  /** The network of the cable on tile `i`, or null if there is none. */
  net(i) { return i >= 0 ? this.nets.get(this.netOf[i]) || null : null; }

  /** Cable is laid on tile `i` (or cut from it): the networks are worked out again at the next tick. */
  set(i, on) {
    if ((this.world.cable[i] === 1) === on) return false;
    this.world.cable[i] = on ? 1 : 0;
    this.dirty = true;
    return true;
  }

  /** Flood-fill the cable tiles into networks. A new network keeps what the old one it grew out of had made (so cutting a cable is not a blackout in itself). */
  rebuild() {
    const w = this.world, { W, H } = w, WH = W * H, cable = w.cable, old = this.netOf, olds = this.nets;
    const netOf = new Int32Array(w.n).fill(-1), nets = new Map();
    const stack = [];
    for (let s = 0; s < w.n; s++) {
      if (cable[s] !== 1 || netOf[s] >= 0) continue;
      const net = new Net(this.seq++);
      const prev = olds.get(old[s]);
      if (prev) { net.avail = prev.avail; net.newavail = prev.newavail; net.viewavail = prev.viewavail; net.viewload = prev.viewload; net.history = prev.history.slice(); }
      nets.set(net.id, net);
      netOf[s] = net.id; stack.push(s);
      while (stack.length) {
        const i = stack.pop();
        net.tiles++;
        const l = Math.floor(i / WH), rem = i - l * WH, c = rem % W, r = (rem - c) / W;
        const blocked = this.blocked.size > 0;
        if (c > 0 && cable[i - 1] === 1 && netOf[i - 1] < 0 && (!blocked || this.joined(i, i - 1))) { netOf[i - 1] = net.id; stack.push(i - 1); }
        if (c + 1 < W && cable[i + 1] === 1 && netOf[i + 1] < 0 && (!blocked || this.joined(i, i + 1))) { netOf[i + 1] = net.id; stack.push(i + 1); }
        if (r > 0 && cable[i - W] === 1 && netOf[i - W] < 0 && (!blocked || this.joined(i, i - W))) { netOf[i - W] = net.id; stack.push(i - W); }
        if (r + 1 < H && cable[i + W] === 1 && netOf[i + W] < 0 && (!blocked || this.joined(i, i + W))) { netOf[i + W] = net.id; stack.push(i + W); }
      }
    }
    this.netOf = netOf;
    this.nets = nets;
    this.dirty = false;
  }
}
