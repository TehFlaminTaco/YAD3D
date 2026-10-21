import { TILE } from '../../shared/config.js';
import { displayPower } from './machines.js';

const isCoil = (it) => !!it && it.path.startsWith('/obj/item/stack/cable_coil');

/**
 * Electrocution (power.dm electrocute_mob, living_defense.dm electrocute_act): insulated gloves stop it altogether; else it burns for what the network could give
 * (powernet.get_electrocute_damage: nothing below 1 kW, 20 plus a bit from there), and knocks you down for four seconds.
 */
export function shock(sim, m, net, siemens = 1, source = 'power cable') {
  if (!m?.humanoid || m.dead) return false;
  if (m.worn.gloves?.def.insulated) return false;
  const avail = net ? net.avail : 0;
  if (avail < 1000) return false;
  const dmg = (Math.max(20, Math.min(195, 20 + Math.round(avail / 25000))) + Math.floor(sim.rand() * 11) - 5) * siemens;
  if (dmg < 1) return false;
  sim.hurt(m, dmg, 'burn', source);
  m.stunned = Math.max(m.stunned, 4);
  sim.chat.visible(m, `${m.name} was shocked by the ${source}!`, 'danger', 12, m);
  sim.tell(m, 'danger', 'You feel a powerful shock coursing through your body!');
  sim.sound('sparks', m, 0.8);
  return true;
}

/** Tell everybody a cable was cut or laid; the networks are worked out again. */
export function setCable(sim, g, i, on) {
  if (!g.powersim.cables.set(i, on)) return false;
  g.emit({ e: 'cable', i, on: on ? 1 : 0 });
  return true;
}

/**
 * Clicks on a tile with a cable on it or a cable to lay (cable.dm handlecable, cable_coil place_turf). Cables are under the floor: a tile floor hides them (intact), plating, a lattice
 * and a catwalk do not. Returns true if it answered.
 *   wirecutters: cut the cable (a coil drops); multitool: what is on it; a coil: lay one.
 */
export function cableClick(sim, m, th, held, bare) {
  const g = th.grid, w = g.world, i = th.i, ps = g.powersim;
  const has = w.cable[i] === 1;
  const tool = held.def.tool;
  if (has && bare && tool === 'wirecutters') {
    const net = ps.cables.net(i);
    if (sim.rand() < 0.5 && shock(sim, m, net)) return true;
    setCable(sim, g, i, false);
    sim.sound('wirecutter', th, 0.9);
    sim.chat.visible(m, `${m.name} cuts the cable.`, 'notice', 10, m);
    sim.tell(m, 'notice', 'You cut the cable.');
    sim.stacks.spawn(g, '/obj/item/stack/cable_coil', 1, th.x + (sim.rand() - 0.5) * 0.8, th.z + (sim.rand() - 0.5) * 0.8);
    return true;
  }
  if (has && bare && tool === 'multitool') {
    const net = ps.cables.net(i);
    if (net && net.avail > 0) sim.tell(m, 'danger', `Total power: ${displayPower(net.avail)}\nLoad: ${displayPower(net.load)}\nExcess power: ${displayPower(net.surplus())}`);
    else sim.tell(m, 'danger', 'The cable is not powered.');
    if (sim.rand() < 0.05) shock(sim, m, net, 0.2);
    return true;
  }
  if (isCoil(held)) {
    if (!bare) { sim.tell(m, 'warning', 'You can only lay cables on catwalks and plating!'); return true; }
    if (has) { sim.tell(m, 'warning', "There's already a cable at that position!"); return true; }
    if ((held.amount ?? 1) < 1) { sim.tell(m, 'warning', 'There is no cable left!'); return true; }
    if (Math.hypot(m.x - th.x, m.z - th.z) > TILE * 1.6) { sim.tell(m, 'warning', "You can't lay cable at a place that far away!"); return true; }
    setCable(sim, g, i, true);
    sim.sound('pickup', th, 0.6);
    sim.floors.use(m, held, 1);
    if (sim.rand() < 0.5 && shock(sim, m, ps.cables.net(i)) && sim.rand() < 0.5) {            // C.shock(user, 50), then prob(50): the cable falls apart, the coil is kept
      setCable(sim, g, i, false);
      sim.stacks.spawn(g, '/obj/item/stack/cable_coil', 1, th.x, th.z);
    }
    return true;
  }
  return false;
}
