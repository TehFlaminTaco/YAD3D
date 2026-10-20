// World scale: one SS13 tile = 2 m (so a 32px sprite is 2 m and 1 px = 6.25 cm).
export const TILE = 2;
export const PX = TILE / 32;
export const WALL_H = 2.5;
export const EYE = 1.45;
export const PLAYER_R = 0.32;
export const REACH = 2.6;

// ---- zero gravity (SS13 Process_Spacemove, in metres)
export const GRIP_REACH = 0.9;        // how far past your body you can reach to hold on to a wall, a locker, a window frame
export const DRIFT_MAX = 4;           // m/s: the fastest you can coast
export const THROW_KICK = 2.2;        // m/s you are pushed the other way by throwing something with nothing to brace on
export const WIND_PUSH = 3;           // how hard escaping air shoves you while you float (m/s gained per m/s of wind, per second)

// BYOND direction bitflags
export const N = 1, S = 2, E = 4, W = 8;
export const OPP = { 1: 2, 2: 1, 4: 8, 8: 4 };
// direction -> (dcol, drow) in game space (row grows southwards)
export const DV = { 1: [0, -1], 2: [0, 1], 4: [1, 0], 8: [-1, 0] };
// yaw of a fixed quad whose normal points along the given direction (yaw 0 => +z/south)
export const DIR_YAW = { 1: Math.PI, 2: 0, 4: Math.PI / 2, 8: -Math.PI / 2 };

export const KIND = { SPACE: 0, FLOOR: 1, WALL: 2, LATTICE: 3 };

export const CHUNK = 16;
export const RENDER_HEIGHT = 540;     // internal render height (px); upscaled with nearest-neighbour
export const FOG_FAR = 46;

// ---- SS13 inventory
export const SLOTS = ['uniform', 'suit', 'shoes', 'gloves', 'glasses', 'ears', 'mask', 'head', 'neck', 'belt', 'id', 'back', 'lpocket', 'rpocket', 'suit_store'];
export const SLOT_LABEL = {
  uniform: 'Uniform', suit: 'Suit', shoes: 'Shoes', gloves: 'Gloves', glasses: 'Glasses', ears: 'Ears', mask: 'Mask', head: 'Head',
  neck: 'Neck', belt: 'Belt', id: 'ID', back: 'Back', lpocket: 'L. Pocket', rpocket: 'R. Pocket', suit_store: 'Suit Storage',
};
export const INTENTS = ['help', 'disarm', 'grab', 'harm'];

// ---- simulation timing
export const SIM_HZ = 20;
export const SIM_DT = 1 / SIM_HZ;
export const SNAP_EVERY = 2;          // snapshots at 10 Hz
export const INTEREST = 52;           // metres: mobs further than this aren't replicated
