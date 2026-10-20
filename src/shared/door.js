const FPS = 14;

/**
 * Door state machine shared by server (authoritative) and client (animation + collision flags).
 * The server calls open()/close(); the client mirrors state via setState() and just animates.
 */
export class DoorCore {
  constructor(world, proto, frames = 0) {
    this.world = world;
    this.c = proto.x; this.r = proto.y;
    this.i = proto.y * world.W + proto.x;
    this.name = proto.n || 'airlock';
    this.a = proto.a || [];             // all of these access numbers are required
    this.o = proto.o || [];             // any one of these is enough
    this.glass = !!proto.glass;
    this.type = proto.t || 'public';
    this.proto = proto;
    this.x = proto.x * 2 + 1;
    this.z = proto.y * 2 + 1;
    this.yaw = proto.yaw ?? 0;           // worked out with the rest of the props (doorYaw in shared/propdata.js)
    this.anim = Math.max(1, frames);     // opening frame count (for timing)
    this.state = 'closed';
    this.t = 0;
    this.bolted = false;
    this.welded = false;
    this.pried = false;
    this.holdUntil = 0;
    world.doorAt.set(this.i, this);
    this.applyFlags();
  }

  get dur() { return this.anim / FPS; }
  get passable() { return this.state === 'open' || (this.state === 'opening' && this.t > 0.55); }
  get isOpen() { return this.state === 'open'; }
  blocksSight() { return this.state !== 'open' && !this.glass; }

  applyFlags() {
    const w = this.world;
    w.solid[this.i] = this.passable ? 0 : 1;
    w.airBlock[this.i] = this.state === 'open' ? 0 : 1;
  }

  /** Is `who` ({access:Set<number>}) allowed through? */
  allows(who) {
    if (this.bolted || this.welded) return false;
    if (!this.a.length && !this.o.length) return true;
    if (!who || !who.access) return false;
    if (this.a.length && !this.a.every((n) => who.access.has(n))) return false;
    if (this.o.length && !this.o.some((n) => who.access.has(n))) return false;
    return true;
  }

  /** Server-side state changes; return true if the state changed. */
  open() {
    if (this.state === 'open' || this.state === 'opening') return false;
    this.state = 'opening'; this.t = 0; this.applyFlags();
    return true;
  }

  close() {
    if (this.state === 'closed' || this.state === 'closing') return false;
    this.state = 'closing'; this.t = 0; this.applyFlags();
    return true;
  }

  /** Client side: adopt the server's state. */
  setState(st) {
    this.state = st; this.t = 0;
    if (st === 'open') this.t = 1;
    this.applyFlags();
  }

  /** Advance animation. Returns the new state if a transition completed ('open'|'closed'), else null. */
  tick(dt) {
    if (this.state === 'opening') {
      this.t += dt / this.dur;
      if (this.t >= 1) { this.state = 'open'; this.t = 1; this.applyFlags(); return 'open'; }
      this.applyFlags();
    } else if (this.state === 'closing') {
      this.t += dt / this.dur;
      if (this.t >= 1) { this.state = 'closed'; this.t = 0; this.applyFlags(); return 'closed'; }
      this.applyFlags();
    }
    return null;
  }
}
