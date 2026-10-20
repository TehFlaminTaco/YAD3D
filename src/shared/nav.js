import { TILE, KIND } from './config.js';

/** A* on the tile grid. Closed doors count as passable when the walker can open them. */
export class Nav {
  constructor(world) {
    this.world = world;
    const n = world.W * world.H;
    this.g = new Float32Array(n);
    this.stamp = new Int32Array(n);
    this.from = new Int32Array(n);
    this.id = 0;
    this.heap = [];
  }

  passable(c, r, who) {
    const w = this.world;
    if (!w.inb(c, r)) return false;
    const i = w.idx(c, r);
    if (w.dyn[i]) return false;                                   // a locker or tank stands there
    if (w.solid[i]) {
      const d = w.doorAt.get(i);
      if (d && who && d.allows(who)) return true;
      return false;
    }
    return w.kind[i] === KIND.FLOOR || w.kind[i] === KIND.LATTICE;
  }

  edgeBlocked(c, r, nc, nr) {
    const w = this.world;
    const e = w.edge[w.idx(c, r)];
    if (!e) return false;
    if (nc > c) return !!(e & 4);
    if (nc < c) return !!(e & 8);
    if (nr > r) return !!(e & 2);
    return !!(e & 1);
  }

  /** Returns array of [c, r] tiles from (after) start to goal, or null. */
  path(sc, sr, gc, gr, who, maxNodes = 3500) {
    const w = this.world;
    const W = w.W;
    if (!this.passable(gc, gr, who)) return null;
    const id = ++this.id;
    const heap = this.heap;
    heap.length = 0;
    const push = (f, i) => {
      heap.push([f, i]);
      let k = heap.length - 1;
      while (k > 0) {
        const p = (k - 1) >> 1;
        if (heap[p][0] <= heap[k][0]) break;
        [heap[p], heap[k]] = [heap[k], heap[p]];
        k = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let k = 0;
        for (;;) {
          const l = 2 * k + 1, r2 = l + 1;
          let m = k;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r2 < heap.length && heap[r2][0] < heap[m][0]) m = r2;
          if (m === k) break;
          [heap[m], heap[k]] = [heap[k], heap[m]];
          k = m;
        }
      }
      return top;
    };
    const start = sr * W + sc, goal = gr * W + gc;
    this.g[start] = 0; this.stamp[start] = id; this.from[start] = -1;
    push(Math.abs(sc - gc) + Math.abs(sr - gr), start);
    let nodes = 0;
    while (heap.length && nodes++ < maxNodes) {
      const [, i] = pop();
      if (i === goal) {
        const out = [];
        for (let k = goal; k !== start; k = this.from[k]) out.push([k % W, Math.floor(k / W)]);
        return out.reverse();
      }
      const c = i % W, r = (i - c) / W;
      for (let d = 0; d < 4; d++) {
        const nc = c + (d === 0 ? 1 : d === 1 ? -1 : 0), nr = r + (d === 2 ? 1 : d === 3 ? -1 : 0);
        if (!this.passable(nc, nr, who) || this.edgeBlocked(c, r, nc, nr)) continue;
        const ni = nr * W + nc;
        const ng = this.g[i] + 1;
        if (this.stamp[ni] === id && this.g[ni] <= ng) continue;
        this.stamp[ni] = id; this.g[ni] = ng; this.from[ni] = i;
        push(ng + Math.abs(nc - gc) + Math.abs(nr - gr), ni);
      }
    }
    return null;
  }

  /** Random reachable-looking floor tile near (c, r). */
  randomTileNear(c, r, radius, rand, who) {
    for (let k = 0; k < 14; k++) {
      const nc = c + Math.round((rand() * 2 - 1) * radius), nr = r + Math.round((rand() * 2 - 1) * radius);
      if (this.passable(nc, nr, who) && !this.world.solid[nr * this.world.W + nc]) return [nc, nr];
    }
    return null;
  }
}
