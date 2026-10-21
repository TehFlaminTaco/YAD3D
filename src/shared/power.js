/**
 * What every room is told about its power, the same on the server and on the clients. An APC (src/sim/power/) decides it; this is what the lights, doors, vents and consoles read.
 *
 * A room (an area) has three channels, as in SS13: equipment, lighting and environment. Each channel is 0 off, 1 off (auto), 2 on, 3 on (auto): it is *on* from 2 up, and the
 * APC flips the auto ones as its cell runs down. The breaker (`operating`) is the APC's own switch for all three. A room with nobody to meter it (a shuttle, Central Command)
 * has all the power it wants.
 */
export const CH = { EQUIP: 0, LIGHT: 1, ENVIRON: 2 };

export class AreaPower {
  constructor(world, metered = false) {
    const n = world.areas.length;
    this.world = world;
    this.n = n;
    this.metered = new Uint8Array(n).fill(metered ? 1 : 0);        // needs power from an APC (else it has all it wants)
    this.operating = new Uint8Array(n).fill(1);                   // the APC's breaker
    this.chan = new Uint8Array(n * 3).fill(3);                    // equipment, lighting, environment
    this.main = new Uint8Array(n).fill(2);                        // what the APC sees on its line: 0 nothing, 1 not enough, 2 enough (apc.dm main_status)
    this.lightSwitch = new Uint8Array(n).fill(1);                 // the wall switch
  }

  /** Does room `a` have power on channel `ch`? */
  powered(a, ch) { return !this.metered[a] || (this.operating[a] === 1 && this.chan[a * 3 + ch] >= 2); }

  /** Vents and airlocks run on the environment channel. */
  areaPowered(a) { return this.powered(a, CH.ENVIRON); }
  doorsWork(door) { return this.powered(this.world.areaIdx[door.i], CH.ENVIRON); }

  /** Are the lights of room `a` on: power on the lighting channel, and the switch on the wall. */
  lightsOn(a) { return this.powered(a, CH.LIGHT) && this.lightSwitch[a] === 1; }

  /** Put an APC's word about room `a` in: its breaker, its three channels and its line. Returns true if anything changed. */
  set(a, operating, eq, li, en, main) {
    const c = this.chan, b = a * 3;
    const same = this.operating[a] === operating && c[b] === eq && c[b + 1] === li && c[b + 2] === en && this.main[a] === main;
    this.operating[a] = operating; c[b] = eq; c[b + 1] = li; c[b + 2] = en; this.main[a] = main;
    return !same;
  }
}

/**
 * Is this lamp lit, and how. On when its room has lighting power and the switch is on. In a room with no power at all a few dim red lamps in the corridors keep a route
 * visible (the lamps' own cells: light.dm emergency lights), and nothing else is lit.
 */
export function lightMode(L, power, areas) {
  const a = L.area;
  if (L.status) return { on: false };                               // broken, burnt out or taken out
  if (power.lightsOn(a)) return { on: true, scale: 1, tint: null };
  if (!power.powered(a, CH.LIGHT)) {
    const cat = areas[a].c;
    if (L.kind === 'tube' && (cat === 'hallway' || cat === 'engine') && ((L.c + L.r) % 3 === 0)) return { on: true, scale: 0.28, tint: [1, 0.15, 0.1] };
  }
  return { on: false };
}
