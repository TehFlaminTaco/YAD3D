import { TILE, KIND, DV } from './config.js';

/** A* on the tile grid. Closed doors count as passable when the walker can open them. */
export class Nav {
  constructor(world) {
    this.world = world;
    const n = world.n;
    this.g = new Float32Array(n);
    this.stamp = new Int32Array(n);
    this.from = new Int32Array(n);
    this.id = 0;
    this.heap = [];
  }

  passable(c, r, who, l = 0) {
    const w = this.world;
    if (!w.inb(c, r, l)) return false;
    const i = w.idx(c, r, l);
    if (w.dyn[i]) return false;                                   // a locker or tank stands there
    if (w.solid[i]) {
      const d = w.doorAt.get(i);
      if (d && who && d.allows(who)) return true;
      return false;
    }
    return w.kind[i] === KIND.FLOOR || w.kind[i] === KIND.LATTICE;
  }

  edgeBlocked(c, r, nc, nr, l = 0) {
    const w = this.world;
    const e = w.edge[w.idx(c, r, l)];
    if (!e) return false;
    if (nc > c) return !!(e & 4);
    if (nc < c) return !!(e & 8);
    if (nr > r) return !!(e & 2);
    return !!(e & 1);
  }

  /**
   * The tile that stepping from (c, r) of deck `l` toward (nc, nr) leads to: [c, r, deck], or null if it leads nowhere you can walk. Up a stair (to the deck above, in
   * front of it), and down: onto a hole on an upper deck that lands on a stair, which takes the fall. Any other fall is not a way to go.
   */
  step(c, r, l, nc, nr, who) {
    const w = this.world;
    if (w.levels > 1) {
      const d = w.inb(c, r, l) ? w.stairs[w.idx(c, r, l)] : 0;                        // up: this is a stair and that is the way it climbs (you go up, whatever is in front of it on this deck)
      if (d && c + DV[d][0] === nc && r + DV[d][1] === nr && this.passable(nc, nr, who, l + 1)) return [nc, nr, l + 1];
    }
    if (this.passable(nc, nr, who, l) && !this.edgeBlocked(c, r, nc, nr, l)) return [nc, nr, l];
    if (w.levels < 2) return null;
    if (l > 0 && w.inb(nc, nr, l) && w.kind[w.idx(nc, nr, l)] === KIND.SPACE && !this.edgeBlocked(c, r, nc, nr, l)) {            // down: a hole whose bottom is a stair
      let to = l - 1;
      while (to > 0 && w.kind[w.idx(nc, nr, to)] === KIND.SPACE) to--;
      if (w.stairs[w.idx(nc, nr, to)] && this.passable(nc, nr, who, to)) return [nc, nr, to];
    }
    return null;
  }

  /** Returns array of [c, r, deck] tiles from (after) start to goal, or null. (`sl` and `gl`: the decks they are on.) */
  path(sc, sr, gc, gr, who, maxNodes = 3500, sl = 0, gl = sl) {
    const w = this.world;
    const W = w.W, WH = w.W * w.H;
    if (!this.passable(gc, gr, who, gl)) return null;
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
    const start = sl * WH + sr * W + sc, goal = gl * WH + gr * W + gc;
    this.g[start] = 0; this.stamp[start] = id; this.from[start] = -1;
    push(Math.abs(sc - gc) + Math.abs(sr - gr) + Math.abs(sl - gl), start);
    let nodes = 0;
    while (heap.length && nodes++ < maxNodes) {
      const [, i] = pop();
      if (i === goal) {
        const out = [];
        for (let k = goal; k !== start; k = this.from[k]) { const l = Math.floor(k / WH), rem = k - l * WH; out.push([rem % W, Math.floor(rem / W), l]); }
        return out.reverse();
      }
      const l = Math.floor(i / WH), rem = i - l * WH, c = rem % W, r = (rem - c) / W;
      for (let d = 0; d < 4; d++) {
        const nc = c + (d === 0 ? 1 : d === 1 ? -1 : 0), nr = r + (d === 2 ? 1 : d === 3 ? -1 : 0);
        const to = this.step(c, r, l, nc, nr, who);
        if (!to) continue;
        const ni = to[2] * WH + nr * W + nc;
        const ng = this.g[i] + 1;
        if (this.stamp[ni] === id && this.g[ni] <= ng) continue;
        this.stamp[ni] = id; this.g[ni] = ng; this.from[ni] = i;
        push(ng + Math.abs(nc - gc) + Math.abs(nr - gr) + Math.abs(to[2] - gl), ni);
      }
    }
    return null;
  }

  /** Random reachable-looking floor tile near (c, r) of deck `l`. */
  randomTileNear(c, r, radius, rand, who, l = 0) {
    for (let k = 0; k < 14; k++) {
      const nc = c + Math.round((rand() * 2 - 1) * radius), nr = r + Math.round((rand() * 2 - 1) * radius);
      if (this.passable(nc, nr, who, l) && !this.world.solid[this.world.idx(nc, nr, l)]) return [nc, nr];
    }
    return null;
  }
}
