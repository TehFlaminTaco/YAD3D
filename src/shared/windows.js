// Windows and grilles, as window.dm / grille.dm have them (tgstation 2d6c10c1). Shared by the server (the rules) and the client (names).

/**
 * A window's `state` var (code/__DEFINES/construction.dm) plus our own bits:
 * a plain window is just anchored or not; a reinforced one goes SECURE -> BOLTS_HEATED -> BOLTS_OUT -> POPPED -> BARS_CUT -> OUT_OF_FRAME.
 */
export const WS = {
  OUT_OF_FRAME: 0, BARS_CUT: 4, POPPED: 5, BOLTS_OUT: 6, BOLTS_HEATED: 7, SECURE: 8,
  STATE: 15,              // mask: the DM state
  UNANCHORED: 16,         // not screwed to the floor (and then it does not seal: window.dm CanAtmosPass)
  GRILLE_LOOSE: 32,       // on a tile with no window: the grille's anchoring screws are out
};

/** What each window variant of the map is. `sheet` is what it is made of, and what taking it apart gives back. */
export const WINDOWS = {
  window: { name: 'window', reinf: false, sheet: '/obj/item/stack/sheet/glass', hp: 30 },
  rwindow: { name: 'reinforced window', reinf: true, sheet: '/obj/item/stack/sheet/rglass', hp: 70 },
  pwindow: { name: 'plasma window', reinf: false, sheet: '/obj/item/stack/sheet/plasmaglass', hp: 90 },
};

export const DECON_SPEED = 30;            // window.dm decon_speed (ds): screwing to / unscrewing from the floor, taking apart
export const GLASS_PER_WINDOW = 2;        // glass_amount of a full-tile window; grille.dm needs and uses two sheets
export const WELD_REPAIR = 40;            // ds to weld a damaged window whole again (window.dm attackby)
export const HEAT_BOLTS = 150;            // ds to heat the security screws of a reinforced window (harm intent)
export const BOLTS_COOL = 300;            // ds before they cool off again
export const PLACE_WINDOW = 20;           // ds to place a window on a grille (grille.dm do_after)

/** Which of our sheet items builds which window (grille.dm attackby). Plasma reinforced glass has no window in this map. */
export const SHEET_TO_WINDOW = {
  '/obj/item/stack/sheet/glass': 'window',
  '/obj/item/stack/sheet/rglass': 'rwindow',
  '/obj/item/stack/sheet/plasmaglass': 'pwindow',
};
