import { CH } from './power.js';

/**
 * The numbers of the power system, from the DM (file:line on each), shared by the sim and by whatever shows them.
 * Power ticks are SSmachines' (every 2 s, `wait = 20`); one cell unit is 1 kJ (`DisplayEnergy`).
 */
export const TICK = 2;                       // s: one power tick
export const CELLRATE = 0.002;               // conversion ratio between a watt-tick and kilojoule      code/_globalvars/misc.dm:11
export const CHARGELEVEL = 0.001;            // how much of a cell an APC charges it by per tick at most   code/_globalvars/misc.dm:12
export const SMESRATE = 0.05;                // rate of internal charge to external power                 code/modules/power/smes.dm:4
export const SOLAR_GEN_RATE = 1500;          // W a panel makes in full sun                               code/modules/power/solar.dm:1

/** The cells an APC may hold (cell.dm): [max charge units]. */
export const CELLS = {
  upgraded: 2500,                            // the APC default                                           apc.dm:68, cell.dm:206-211
  'upgraded/plus': 5000,                     // highcap/five_k                                            apc.dm:118
  high: 10000,                               // highcap/ten_k                                             apc.dm:121, cell.dm:249-252
  'high/plus': 15000,                        // highcap/fifteen_k                                         apc.dm:124, cell.dm:256-257
};

/** What a lamp draws when it is on: 20 W per unit of its brightness, a tube is 8 and a bulb 4 (lighting.dm:392, 214, 257). */
export const LIGHT_WATTS = { tube: 160, bulb: 80, floor: 80 };

/**
 * What standing machines draw from their room's channels when the channel is on, by the start of the DM path (the props the map has that are not lights):
 * [path prefix, channel, watts]. Idle usage where the machine sits idle; the DM files are in the notes. The first match wins.
 */
export const USE = [
  ['machinery/computer', CH.EQUIP, 300],                 // computer/_computer.dm:7
  ['machinery/camera', CH.EQUIP, 10],                    // camera.dm:10-12 (always active)
  ['machinery/status_display', CH.EQUIP, 10],            // status_display.dm:26
  ['machinery/cell_charger', CH.EQUIP, 5],               // cell_charger.dm:7
  ['machinery/recharger', CH.EQUIP, 4],                  // recharger.dm:7
  ['machinery/firealarm', CH.ENVIRON, 2],                // firealarm.dm:24
  ['machinery/airalarm', CH.ENVIRON, 4],
  ['machinery/gravity_generator', CH.ENVIRON, 3000],     // gravitygenerator.dm:114
];

/** The engine (until it is built properly) makes this much between its six collectors, while it is running. */
export const ENGINE_WATTS = 240000;

/** The sun: it goes round `base_rotation` degrees a minute, between half as fast and twice as fast, either way (sun.dm). */
export const SUN_STEP_DEG = 6;
export const SUN_PERIOD = 60;

/** The matches above want the path without its leading `/obj/`. */
export const norm = (p) => (p || '').replace(/^\/?(obj\/)?/, '');
