# Windows and Grilles

Windows are modular wall structures built in layers: a grille (metal framework) sits on the tile, and windows (glass panes) sit on the grille. Deconstructing a window removes only the glass; the grille stays. Smashing a window leaves both grille and shards behind. The window state machine tracks construction stage: unanchored, anchored to floor, or (for reinforced) bolted into frame with heated rods exposed. This document explains why "deconstructing a window leaves something behind"—the grille is independent and requires separate removal.

---

### Window  `/obj/structure/window`  (code/game/objects/structures/window.dm:1)

- Standard window pane, typically directional (blocks one cardinal direction).
- Key vars: `anchored = TRUE` (initially; tile smoothing sets to 0), `state = WINDOW_OUT_OF_FRAME`, `max_integrity = 25`, `reinf = FALSE`, `heat_resistance = 800`, `decon_speed = 30 (ds)`, `glass_type = /obj/item/stack/sheet/glass`, `glass_amount = 1`, `fulltile = FALSE` (code/game/objects/structures/window.dm:10-25)
- Armor: `melee = 0, bullet = 0, laser = 0, energy = 0, bomb = 0, bio = 0, rad = 0, fire = 80, acid = 100` (line 13)

**Window state machine:**
- `WINDOW_OUT_OF_FRAME` (0): window not inserted; can wrench/disassemble (line 22)
- `WINDOW_IN_FRAME` (1): pried into frame (reinforced only) (line 23)
- `WINDOW_SCREWED_TO_FRAME` (2): screwed to frame (reinforced only) (line 24)
- `anchored = TRUE`: attached to floor with screwdriver
- `anchored = FALSE`: detached, ready to wrench away

**Interactions (plain window):**
| held item | condition | delay (ds) | message verbatim | result |
|-----------|-----------|-----------|------------------|--------|
| Welder (INTENT_HELP) | `obj_integrity < max_integrity` | 40 | "You begin repairing [src]..." then "You repair [src]." | sets `obj_integrity = max_integrity` |
| Screwdriver | any | 30 | "You begin to [anchored ? "unscrew the window from":"screw the window to"] the floor..." then "You [anchored ? "fasten the window to":"unfasten the window from"] the floor." | toggles `anchored` |
| Wrench | `anchored = FALSE` | 30 | "You begin to disassemble [src]..." then "You successfully disassemble [src]." | drops glass sheets, calls `qdel(src)` (line 187-195) |
| Crowbar | `reinf && state == WINDOW_OUT_OF_FRAME && anchored` | 100 | "You begin to lever the window into the frame..." then "You pry the window into the frame." | reinforced only (line 196-201) |

**Deconstruction:**
- Proper deconstruction (wrench while unanchored): calls `deconstruct(TRUE)` implicitly; spawns `glass_amount` sheets of `glass_type` to user's location (code/game/objects/structures/window.dm:189-195). The grille below remains on the tile.
- Breaking (damage to zero integrity): calls `deconstruct(FALSE)`; plays break sound, spawns shards and decal only (code/game/objects/structures/window.dm:250-258, 261-268).

**Drops (via spawnDebris, line 261-268):**
- Proper deconstruction: glass sheets only. No rods, no shards. The grille stays.
- Breaking: `new /obj/item/shard(location)`, `new /obj/effect/decal/cleanable/glass(location)`. If `fulltile`, adds second shard. If `reinf`, adds 1 or 2 rods depending on fulltile. Grille stays.

**Health / armor:** `max_integrity = 25` (line 10); armor above; no damage_deflection (plain). Takes damage from heat (> T0C + 800 = 1073 K): `round(exposed_volume / 100)` BURN damage per temperature_expose call (line 333).

**Power:** none.

**Gotchas:** 
- `can_be_reached()` proc (line 226): checks if user is on the correct side of the window direction; fulltile windows cannot be reached from any direction.
- `fulltile = FALSE`: directional, only blocks if player approaches from `dir`. `fulltile = TRUE`: blocks all directions, dir set to FULLTILE_WINDOW_DIR (NORTHEAST, line 67 construction.dm).
- Windows are `anchored = TRUE` on Initialize but can be toggled (line 8, 206-208). Unanchored windows cannot be rotated (line 272).
- RCD can deconstruct at cost 5, delay 20 (rcd_act, line 78-84).

---

### Reinforced Window  `/obj/structure/window/reinforced`  (code/game/objects/structures/window.dm:362)

- Window with embedded rods; much harder to deconstruct.
- Overrides: `name = "reinforced window"`, `reinf = TRUE`, `max_integrity = 75`, `heat_resistance = 1600`, `damage_deflection = 11`, `state = RWINDOW_SECURE`, `glass_type = /obj/item/stack/sheet/rglass`, `armor: melee = 80, bullet = 0, laser = 0, energy = 0, bomb = 25, bio = 100, rad = 100, fire = 80, acid = 100` (line 362-375).

**Reinforced window state machine:** More complex. Starts at `RWINDOW_SECURE` (8).
- `RWINDOW_SECURE` (8): bolts are one-way screws; heat with welder to proceed.
- `RWINDOW_BOLTS_HEATED` (7): screws glowing; use screwdriver to extract (line 390-397).
- `RWINDOW_BOLTS_OUT` (6): screws removed, gap visible; use crowbar to pry (line 398-405).
- `RWINDOW_POPPED` (5): pane popped out, bars exposed; use wirecutter (line 406-413).
- `RWINDOW_BARS_CUT` (4): bars cut; use wrench on bolts (line 414-422).
- `WINDOW_OUT_OF_FRAME` (0): final state after wrench; window is loose (line 420).

**Tool sequence for reinforced window (code/game/objects/structures/window.dm:379-423):**
| step | tool | delay (ds) | message | new state |
|------|------|-----------|---------|-----------|
| 1 | Welder (INTENT_HARM) | 150 | "You begin heating the security screws on \the [src]..." then "The security bolts are glowing white hot and look ready to be removed." | RWINDOW_BOLTS_HEATED (7) |
| 2 | Screwdriver | 50 | "You dig into the heated security screws and starts removing them..." then "The screws come out, and a gap forms around the edge of the pane." | RWINDOW_BOLTS_OUT (6) |
| 3 | Crowbar | 40 | "You wedge \the [I] into the gap in the frame and starts prying..." then "The panel pops out of the frame, exposing some thin metal bars that looks like they can be cut." | RWINDOW_POPPED (5) |
| 4 | Wirecutter | 20 | "You start cutting the exposed bars on \the [src]..." then "The panels falls out of the way exposing the frame bolts." | RWINDOW_BARS_CUT (4) |
| 5 | Wrench | 40 | "You start unfastening \the [src] from the frame..." then "You unscrew the bolts from the frame and the window pops loose." | WINDOW_OUT_OF_FRAME (0), `anchored = FALSE` |

The bolts cool after 300 ds (3 seconds) if not immediately screwdrivered (line 388).

**Drops:** Reinforced window drops `glass_amount` sheets of reinforced glass (rglass) when properly deconstructed; drops shards + rods (1 or 2) when broken (line 266).

**Health / armor:** `max_integrity = 75`, `damage_deflection = 11`, armor above.

**Gotchas:**
- Cannot be deconstructed until `state == RWINDOW_SECURE` or lower (NOT `state >= RWINDOW_FRAME_BOLTED`; line 180 prevents tool use if `reinf && state >= RWINDOW_FRAME_BOLTS`).
- Examine messages vary by state (line 430-442).
- Plasma reinforced variant (line 504-548) uses identical state machine but longer timers: welder 180 ds, screwdriver 80 ds, crowbar 50 ds, wirecutter 30 ds, wrench 50 ds (line 510-543).

---

### Plasma Window  `/obj/structure/window/plasma`  (code/game/objects/structures/window.dm:457)

- Advanced window material, heat and blast resistant.
- Overrides: `name = "plasma window"`, `reinf = FALSE`, `max_integrity = 200`, `heat_resistance = 25000`, `glass_type = /obj/item/stack/sheet/plasmaglass`, `armor: melee = 80, bullet = 5, laser = 0, energy = 0, bomb = 45, bio = 100, rad = 100, fire = 99, acid = 100` (line 457-467).
- `spawnDebris()` variant: drops `/obj/item/shard/plasma` instead of plain shards (line 469-476).

---

### Fulltile Windows  `/obj/structure/window/fulltile`  (code/game/objects/structures/window.dm:587)

- Covers entire tile; blocks all directions; no directional checking.
- Overrides: `fulltile = TRUE`, `dir = FULLTILE_WINDOW_DIR` (NORTHEAST), `max_integrity = 50`, `glass_amount = 2`, `smooth = SMOOTH_TRUE`, `flags_1 = PREVENT_CLICK_UNDER_1` (line 587-596). Merges with adjacent fulltile windows.
- Normal glass fulltile: max_integrity = 50, 2 sheets (line 591).
- Reinforced fulltile: max_integrity = 150, state = RWINDOW_SECURE (line 630-641).
- Plasma fulltile: max_integrity = 300, 2 sheets (line 601-610).
- Reinforced plasma fulltile: max_integrity = 1000, state = RWINDOW_SECURE (line 615-624).

---

### Grille  `/obj/structure/grille`  (code/game/objects/structures/grille.dm:1)

- Metal framework that anchors windows; windows sit on top of grilles. Grilles can exist alone.
- Key vars: `anchored = TRUE`, `max_integrity = 50`, `armor = list("melee" = 50, "bullet" = 70, "laser" = 70, "energy" = 100, "bomb" = 10, bio = 100, rad = 100, fire = 0, acid = 0)`, `integrity_failure = 0.4`, `rods_type = /obj/item/stack/rods`, `rods_amount = 2`, `rods_broken = TRUE`, `grille_type = null`, `broken_type = /obj/structure/grille/broken` (line 1-18).

**Grille state machine:**
- `anchored = TRUE`: fastened to floor, conducts electricity, shocks on touch (50% chance, 70 damage) (line 230-247, line 79).
- `anchored = FALSE`: unfastened; cannot shock even if cable below (line 231).
- `broken = FALSE`: normal grille, density = TRUE (line 29).
- `broken = TRUE`: pre-broken grille state, density = FALSE, obj_integrity = 20, `rods_amount = 1`, `rods_broken = FALSE`, `grille_type = /obj/structure/grille` (line 271-279).

**Interactions:**
| held item | condition | delay (ds) | message | result |
|-----------|-----------|-----------|---------|--------|
| Wirecutter | any | instant | none | calls `deconstruct()` (line 133-136) |
| Screwdriver | `anchored || isturf(loc)` | instant | "[user] [anchored ? "fastens" : "unfastens"] [src]." | toggles `anchored` (line 137-143) |
| Rods stack | `broken = TRUE` | instant | "[user] rebuilds the broken grille." | creates new `grille_type`, uses 1 rod, qdels broken grille (line 144-152) |
| Glass sheet (x2) | `broken = FALSE && anchored` | 20 | "You start placing the window..." then "You place [WD] on [src]." | creates window on grille, consumes 2 sheets (line 155-193). Glasstype determines window: plasmarglass → plasma/reinforced/fulltile, plasmaglass → plasma/fulltile, rglass → reinforced/fulltile, titaniumglass → shuttle, plastitaniumglass → plastitanium, else → normal fulltile (line 175-186). Window created with `state = 0` (WINDOW_OUT_OF_FRAME), `anchored = FALSE` (line 190).
| Shard or melee | `!broken` | instant | "You hit [src]." or "[user] mangles [src]." | calls `shock()` first; if not shocked, deals 5-10 BRUTE (hand), 20 BRUTE (alien), variable (animal) (line 99-115) |

**Electricity interaction:** If cable under grille tile and `anchored = TRUE`:
- 50% chance to shock attacker for 70 damage (line 79, 230-247, 134).
- Bumping, attacking, or taking thrown objects can trigger shock.
- No shock if unanchored (line 231).
- No shock if already broken (line 231).

**Deconstruction:**
- Wirecutter or RCD: calls `deconstruct(TRUE)` (proper) → drops `rods_amount` rods (default 2) to drop_location; no grille variant created (line 210-217).
- Damage to zero (obj_break): creates broken grille (`new broken_type(src.loc)`), drops `rods_broken` rods (default 1), qdels original (line 219-224).

**Drops:**
- Proper deconstruction: `new rods_type(drop_location(), rods_amount)` — 2 rods, metal stack (line 214-216).
- Breaking: `new broken_type(src.loc)` (broken grille on same tile) + `new rods_type(drop_location(), rods_broken)` — 1 rod (line 221-223).

**Health / armor:** `max_integrity = 50`, armor above.

**Broken grille variant** (line 271-279): Pre-placed broken grille; not density (can walk through), low integrity (20), drops only 1 rod on deconstruction.

**Gotchas:**
- Grille STAYS when window is deconstructed (window only removed). Player must separately wirecutter or RCD the grille (this answers the user's question).
- Grille STAYS when window is smashed (window breaks into shards, grille untouched).
- To clear a tile: deconstruct window (removes glass), then deconstruct grille (removes framework).
- Can construct window on grille by placing 2 glass sheets (any valid type) on it; grille must be anchored first.
- Damage reduction: melee = 50, bullet = 70, laser = 70, energy = 100 (nearly immune to energy/laser; weak to melee).
- RCD: deconstruct cost 5, delay 20; can also construct window on grille with mode WINDOWGRILLE (line 49-73).

---

### Glass Shard  `/obj/item/shard`  (code/game/objects/items/stacks/sheets/glass.dm:236)

- Item dropped when window is smashed (broken).
- Key vars: `w_class = WEIGHT_CLASS_TINY`, `force = 5`, `throwforce = 10`, `max_integrity = 40`, `sharpness = IS_SHARP`, armor (as item), embedding (65% chance) (line 236-256).
- Randomized on spawn: icon_state picked from "large", "medium", "small" with random pixel offset (line 268-278).
- Caltrop component: damages feet if walked on (line 266).
- Cannot be placed in storage normally; lightreplacer can use it.
- Welder act (line 331-343): smelt 1 shard to 1 glass sheet; prints "You add the newly-formed [NG.name] to the stack."

**Plasma shard variant** (`/obj/item/shard/plasma`, line 352-360): dropped from plasma windows; `force = 6`, `throwforce = 11`, different material composition (plasma + glass).

---

### Rod Stack  `/obj/item/stack/rods`  (code/game/objects/items/stacks/rods.dm:9)

- Metal rod stack; used in grille construction and as reinforcement.
- Key vars: `w_class = WEIGHT_CLASS_NORMAL`, `force = 9`, `throwforce = 10`, `max_amount = 50` (line 9-26).
- Recipes (GLOB.rod_recipes, line 1-7):
  - grille: 2 rods, 10 (ds), on_floor
  - table frame: 2 rods, 10 (ds)
  - railing: 3 rods, 18 (ds)
- Welder interaction (line 48-63): 2 rods + welder → 1 metal sheet (0 ds), printed "You shape [src] into metal with [W]." Rods consumed.

---

### Glass Sheets  `/obj/item/stack/sheet/glass` and `/obj/item/stack/sheet/rglass`

**Plain glass** (`/obj/item/stack/sheet/glass`, line 16):
- Name: "glass sheet" (singular).
- Recipes (GLOB.glass_recipes, line 11-14):
  - Directional window: 1 sheet, 0 (ds), on_floor
  - Fulltile window: 2 sheets, 0 (ds), on_floor
- Custom material: glass = MINERAL_MATERIAL_AMOUNT (2000) (line 22).
- Attackby (line 47-73): combine with cable coil (5 lengths + 1 sheet → wired glass) or rods (1 rod + 1 sheet → reinforced glass).

**Reinforced glass** (`/obj/item/stack/sheet/rglass`, line 134):
- Name: "reinforced glass sheet" (singular).
- Created by: 1 rod + 1 glass sheet (via glass.attackby, line 59-71).
- Recipes (GLOB.reinforced_glass_recipes, line 126-131):
  - Windoor frame: 5 sheets, 0 (ds), on_floor
  - Directional reinforced window: 1 sheet, 0 (ds)
  - Fulltile reinforced window: 2 sheets, 0 (ds)
- Custom material: iron = MINERAL_MATERIAL_AMOUNT * 0.5, glass = MINERAL_MATERIAL_AMOUNT (line 140).

**Plasma glass** (`/obj/item/stack/sheet/plasmaglass`, line 82):
- Recipes (GLOB.pglass_recipes, line 77-80): directional plasma window (1 sheet), fulltile plasma window (2 sheets).
- Custom material: plasma = MINERAL_MATERIAL_AMOUNT * 0.5, glass = MINERAL_MATERIAL_AMOUNT (line 88).

**Reinforced plasma glass** (`/obj/item/stack/sheet/plasmarglass`, line 179):
- Recipes (GLOB.prglass_recipes, line 174-177): directional reinforced plasma window (1 sheet), fulltile reinforced plasma window (2 sheets).
- Created by: 1 rod + 1 plasma glass sheet (line 105-114).
- Custom material: plasma = MINERAL_MATERIAL_AMOUNT * 0.5, glass = MINERAL_MATERIAL_AMOUNT, iron = MINERAL_MATERIAL_AMOUNT * 0.5 (line 185).

---

### Window Spawners  `/obj/effect/spawner/structure/window*`  (code/game/objects/effects/spawners/structure.dm:21-357)

- One-time spawners that create pre-placed window + grille on map load.

**Normal window spawner** (line 21-25): spawns `list(/obj/structure/grille, /obj/structure/window/fulltile)`.

**Hollow window spawner variants:**
- Hollow (line 28-31): 1 grille + 1 fulltile + 3 directional windows (north, east, west).
- Hollow/end (line 33-46): varies by direction; e.g., NORTH spawns N, E, W directional (line 39).
- Hollow/middle (line 48-57): 1 grille + 1 window + 1 directional (varies by dir).
- Hollow/directional (line 59-80): 1 grille + directional windows matching the spawner's dir (line 64-79).

**Reinforced variants** (line 84-141): identical structure, using `/obj/structure/window/reinforced/fulltile` and reinforced directionals.

**Plasma variants** (line 239-296): use `/obj/structure/window/plasma` types.

**Reinforced plasma variants** (line 300-357): use `/obj/structure/window/plasma/reinforced` types.

All spawners spawn grille + window(s) and qdel themselves on Initialize (line 11-16).

---

## Minimum viable port

1. **Window state machine:** Track `anchored`, `state`, and tool sequence (screw/pry/weld/crowbar/wrench for plain; heat/screw/pry/cut/wrench for reinforced).
2. **Deconstruction vs breaking:** `deconstruct(TRUE)` drops glass sheets; `deconstruct(FALSE)` drops shards + decal only. Both leave grille.
3. **Grille independence:** Wirecutter removes grille; window removal does not. Answer to "why does deconstructing a window leave something behind": grille is separate object.
4. **Glass + rods crafting:** Glass + rods → reinforced glass (1:1 ratio, instant).
5. **Window placement on grille:** 2 sheets + grille → window (20 ds, grille must be anchored). Glasstype determines window subtype.
6. **Electricity:** Anchored grille with cable below shocks attackers (50% chance, 70 damage).
7. **Directional vs fulltile:** Fulltile blocks all directions, no rotation; directional only blocks one side, can rotate.
8. **Reinforced complexity:** Multi-stage deconstruction (5 steps, ~260 ds total) vs plain single-stage (30 ds).
9. **Fulltile variants:** Double the glass cost; higher integrity; merge visually.
10. **RCD:** Can deconstruct windows/grilles (20-40 ds, cost 5) or construct windows on grilles (20-40 ds, cost 8-12).

---

## NOT FOUND / open questions

- `valid_window_location()` proc: Used in line 277 to validate rotation; definition NOT FOUND in window.dm or directly visible. Inferred: checks that the target direction on the grille does not already have a window.
- `is_glass_sheet()` proc (line 155 grille.dm): Definition NOT FOUND. Inferred: checks if item is any glass sheet type.
- Shuttle window variants (`/obj/structure/window/shuttle`, `/obj/structure/window/plasma/reinforced/plastitanium`): Not fully detailed in this document; see window.dm lines 663-714.
- Paperframe window (line 716-799): Fragile wood/paper variant, not covered in depth.
- Damage_deflection mechanic: How the 11-21 point deflection actually reduces damage not specified in code examined.
