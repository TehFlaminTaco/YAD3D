// Walls and girders, as walls.dm / reinf_walls.dm / girders.dm have them (tgstation 2d6c10c1). Shared by the server (the rules) and the client (names, art).

/** A reinforced wall's `d_state` (code/__DEFINES/construction.dm). A plain wall has no states: it is welded or it is gone. */
export const RW = { INTACT: 0, SUPPORT_LINES: 1, COVER: 2, CUT_COVER: 3, ANCHOR_BOLTS: 4, SUPPORT_RODS: 5, SHEATH: 6 };

/** A girder's `state`. */
export const GIRDER = { NORMAL: 0, REINF_STRUTS: 1, REINF: 2, DISPLACED: 3 };

/** The wall variants of the map that can be taken apart. `sheet` and `amount` are what dismantling leaves (sheet_type, sheet_amount), `girder` the girder state left standing. */
export const WALLS = {
  wall: { name: 'wall', reinf: false, sheet: '/obj/item/stack/sheet/metal', amount: 2, girder: GIRDER.NORMAL, slice: 100, hp: 400 },
  reinforced_wall: { name: 'reinforced wall', reinf: true, sheet: '/obj/item/stack/sheet/plasteel', amount: 1, girder: GIRDER.REINF, slice: 100, hp: 900 },
};

/** Which sprite (`level.structs`) and name a girder is drawn with, by state. */
export function girderLook(state) {
  if (state === GIRDER.DISPLACED) return { sprite: 'displaced', name: 'displaced girder' };
  if (state === GIRDER.REINF || state === GIRDER.REINF_STRUTS) return { sprite: 'reinforced', name: 'reinforced girder' };
  return { sprite: 'girder', name: 'girder' };
}

export const GIRDER_DESC = 'A large structural assembly made out of metal; It requires a layer of metal before it can be considered a wall.';

// ds, from the DM: what each step takes
export const T = {
  GIRDER_UNSECURE: 40, GIRDER_SECURE: 40, GIRDER_DISASSEMBLE: 40, STRUTS: 40, GRILLE: 40,
  PLATING: 40, REINFORCE: 60, FINISH_RWALL: 50,
};
