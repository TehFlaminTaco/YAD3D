// Headless soak test of the authoritative sim: node tools/simtest.mjs [minutes] [--player]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSimData } from '../src/sim/load.js';
import { Sim } from '../src/sim/sim.js';
import { SIM_DT } from '../src/shared/config.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const minutes = +(process.argv[2] || 3);
const withPlayer = process.argv.includes('--player');
const t0 = Date.now();
const sim = new Sim(loadSimData(root), { bots: 18 });
console.log('sim built in', Date.now() - t0, 'ms;', sim.doors.length, 'doors,', sim.floor.size, 'floor items');

let events = {}, msgs = [];
let client = null;
if (withPlayer) {
  client = sim.addClient('Tester', (m) => {
    if (m.t === 'ev') for (const e of m.list) { events[e.e] = (events[e.e] || 0) + 1; if (e.e === 'msg') msgs.push(e); }
  });
  sim.handle(client, { t: 'lobby', op: 'job', id: 'station_engineer' });
  sim.handle(client, { t: 'lobby', op: 'start' });
} else {
  const c = sim.addClient('Obs', () => {});
  sim.handle(c, { t: 'lobby', op: 'start' });
}
console.log('round', sim.round.state, 'mobs', sim.mobs.size, 'crew', [...sim.mobs.values()].filter((m) => m.kind === 'human').length);
if (client?.mob) {
  const m = client.mob;
  console.log('player', m.name, m.job, 'access', m.access.size, 'worn', Object.entries(m.worn).filter(([, v]) => v).map(([k, v]) => k + ':' + v.name).join(', '));
  console.log('back contents', m.worn.back?.contents.map((i) => i.name + (i.contents ? '[' + i.contents.map((j) => j.name).join(',') + ']' : '')).join(', '));
}

const ticks = Math.floor(minutes * 60 / SIM_DT);
let slow = 0, worst = 0;
for (let k = 0; k < ticks; k++) {
  const a = performance.now();
  sim.step(SIM_DT);
  const d = performance.now() - a;
  worst = Math.max(worst, d);
  if (d > 30) slow++;
  if (sim.round.state === 'ending') break;
}
const crew = [...sim.mobs.values()].filter((m) => m.kind === 'human');
console.log(`ran ${sim.round.time.toFixed(0)}s round time in ${Date.now() - t0}ms total; worst tick ${worst.toFixed(1)}ms, slow ticks ${slow}`);
console.log('state', sim.round.state, 'power', sim.power.state, 'breaches', sim.world.breached.size, 'evac', sim.director.evacState, 'carp alive', [...sim.mobs.values()].filter((m) => m.kind === 'carp' && !m.dead).length);
console.log('crew alive', crew.filter((m) => !m.dead).length, '/', crew.length, 'evacuated', crew.filter((m) => m.evacuated).length);
console.log('events to client', events);
console.log('last messages:', msgs.slice(-8).map((m) => `[${m.k}] ${m.name ? m.name + ': ' : ''}${m.text}`));
