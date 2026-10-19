/**
 * Station power. States: 'normal', 'battery' (generators down, APC cells draining), 'out'.
 * Areas have an APC breaker and a light switch. The same lightMode() drives server vents/doors and
 * client lighting, so both sides agree on which lamps are lit.
 */
export function lightMode(L, state, areaOn, areaLights, areas) {
  const a = L.area;
  if (!areaLights[a] || !areaOn[a]) return { on: false };
  if (state === 'normal') return { on: true, scale: 1, tint: null };
  if (state === 'battery') return { on: true, scale: 0.5, tint: [1, 0.72, 0.6] };
  // blackout: a few dim red emergency lamps in corridors keep routes visible
  const cat = areas[a].c;
  if (L.kind === 'tube' && (cat === 'hallway' || cat === 'engine') && ((L.c + L.r) % 3 === 0)) return { on: true, scale: 0.28, tint: [1, 0.15, 0.1] };
  return { on: false };
}

export class Power {
  constructor(world, apcAreas) {
    const n = world.areas.length;
    this.world = world;
    this.state = 'normal';
    this.battery = 1;
    this.drain = 1 / 300;                      // roughly five minutes of emergency cells
    this.areaOn = new Uint8Array(n).fill(1);
    this.areaLights = new Uint8Array(n).fill(1);
    this.hasApc = new Uint8Array(n);
    for (const a of apcAreas) this.hasApc[a] = 1;
    this.restartStep = 0;
    this.lockoutUntil = 0;
    this.onState = null;
  }

  areaPowered(a) { return this.state !== 'out' && !!this.areaOn[a]; }
  doorsWork(door) { return this.areaPowered(this.world.areaIdx[door.i]); }

  setState(s) {
    if (this.state === s) return;
    const prev = this.state;
    this.state = s;
    if (s === 'battery') this.battery = Math.max(this.battery, 0.8);
    this.onState?.(s, prev);
  }

  update(dt) {
    if (this.state === 'battery') {
      this.battery -= this.drain * dt;
      if (this.battery <= 0) { this.battery = 0; this.setState('out'); }
    }
  }
}
