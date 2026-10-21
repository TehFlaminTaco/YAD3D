# Building and Tearing Down: Walls, Floors, Girders

The station shell consists of layered turfs (walls, floors, plating) built from the ground up via girders and framing. Deconstruction is step-wise and often reversible. Space becomes buildable by placing rods (lattice), then tiles. Atmosphere follows turfs via `ChangeTurf`/`ScrapeAway` and the `CHANGETURF_INHERIT_AIR` flag.

---

### Plain Wall  `/turf/closed/wall`  (code/game/turfs/closed/walls.dm:3)

A solid metal barrier with no internal states; deconstructs in one step.

- **What it is:** Separates rooms. Baseturfs to `/turf/open/floor/plating`.
- **Key vars:**
  - `sheet_type = /obj/item/stack/sheet/metal` (walls.dm:20)
  - `sheet_amount = 2` (walls.dm:21)
  - `girder_type = /obj/structure/girder` (walls.dm:22)
  - `slicing_duration = 100` (walls.dm:19; default time in deciseconds)
- **Deconstruction:** Welder tool only
  | Tool | Delay | Message | Result |
  | --- | --- | --- | --- |
  | Welder | 100 ds | "You begin slicing through the outer plating..." → "You remove the outer plating." | Calls `dismantle_wall()` |
- **Drops on deconstruction:** 2× `/obj/item/stack/sheet/metal` + 1× `/obj/structure/girder` (walls.dm:71-73, `break_wall()` proc)
- **Drops on destruction (explosion/devastation):** 2× metal sheets + 1× additional metal sheet if no girder type (walls.dm:75-78, `devastate_wall()` proc)
- **Gotchas:** `ScrapeAway()` called after deconstruction (walls.dm:69) drops air/atmosphere if not on space turf; outer plating is welded ("firmly in place" hint, walls.dm:50)

---

### Reinforced Wall  `/turf/closed/wall/r_wall`  (code/game/turfs/closed/wall/reinf_walls.dm:1)

A multi-step deconstruction turf with seven states tracked in `d_state`. Each step has a reverse action and can fail/be reversed mid-construction.

- **What it is:** Toughened wall with grille, support lines, cover, bolts, rods, and sheath.
- **Key vars:**
  - `d_state = INTACT` (reinf_walls.dm:9; one of INTACT, SUPPORT_LINES, COVER, CUT_COVER, ANCHOR_BOLTS, SUPPORT_RODS, SHEATH)
  - `sheet_type = /obj/item/stack/sheet/plasteel` (reinf_walls.dm:11)
  - `sheet_amount = 1` (reinf_walls.dm:12)
  - `girder_type = /obj/structure/girder/reinforced` (reinf_walls.dm:13)
  - `hardness = 10` (reinf_walls.dm:10; easier to break than plain wall)
  - `explosion_block = 2` (reinf_walls.dm:14; blocks more explosion force)
  - `rad_insulation = RAD_HEAVY_INSULATION` (reinf_walls.dm:15)
- **Deconstruction chain** (each state → tool → delay → message → next state):
  | d_state | Tool | Delay | Message (user) | Next | Reverse? |
  | --- | --- | --- | --- | --- | --- |
  | INTACT (0) | Wirecutter | 0 ds | "You cut the outer grille." | SUPPORT_LINES | No play_tool_sound |
  | SUPPORT_LINES (1) | Screwdriver | 40 ds | "You begin unsecuring the support lines..." → "You unsecure the support lines." | COVER | Yes: 40 ds → INTACT |
  | SUPPORT_LINES (1) | Wirecutter | 0 ds | "You repair the outer grille." | INTACT | (reverse only) |
  | COVER (2) | Welder | 60 ds | "You begin slicing through the metal cover..." → "You press firmly on the cover, dislodging it." | CUT_COVER | Yes: 60 ds → COVER |
  | COVER (2) | Screwdriver | 40 ds | "You begin securing the support lines..." → "The support lines have been secured." | SUPPORT_LINES | (reverse) |
  | CUT_COVER (3) | Crowbar | 100 ds | "You struggle to pry off the cover..." → "You pry off the cover." | ANCHOR_BOLTS | Yes: 20 ds → CUT_COVER |
  | CUT_COVER (3) | Welder | 60 ds | "You begin welding the metal cover back to the frame..." → "The metal cover has been welded securely to the frame." | COVER | (reverse) |
  | ANCHOR_BOLTS (4) | Wrench | 40 ds | "You start loosening the anchoring bolts..." → "You remove the bolts anchoring the support rods." | SUPPORT_RODS | Yes: 40 ds → ANCHOR_BOLTS |
  | ANCHOR_BOLTS (4) | Crowbar | 20 ds | "You start to pry the cover back into place..." → "The metal cover has been pried back into place." | CUT_COVER | (reverse) |
  | SUPPORT_RODS (5) | Welder | 100 ds | "You begin slicing through the support rods..." → "You slice through the support rods." | SHEATH | Yes: 100 ds → SUPPORT_RODS |
  | SUPPORT_RODS (5) | Wrench | 40 ds | "You start tightening the bolts..." → "You tighten the bolts anchoring the support rods." | ANCHOR_BOLTS | (reverse) |
  | SHEATH (6) | Crowbar | 100 ds | "You struggle to pry off the outer sheath..." → "You pry off the outer sheath." → calls `dismantle_wall()` | — (final) | Yes: 100 ds → SHEATH |
  | SHEATH (6) | Welder | 100 ds | "You begin welding the support rods back together..." → "You weld the support rods back together." | SUPPORT_RODS | (reverse) |

- **Deconstruction hints** (examine): Show current d_state with descriptions of next action needed (reinf_walls.dm:17-32)
- **Drops on final deconstruction:** 1× `/obj/item/stack/sheet/plasteel` + 2× `/obj/item/stack/sheet/metal` (reinf_walls.dm:34-36, `devastate_wall()` override)
- **Icon state change:** When d_state ≠ INTACT, icon updates to "r_wall-[d_state]" and smoothing disabled (reinf_walls.dm:196-204)
- **Gotchas:** 
  - Wirecutter does not use `use_tool()` delay, just `play_tool_sound()` (reinf_walls.dm:58, 76)
  - All other tools use `use_tool()` with delay parameter (reinf_walls.dm:67, 87, 108, 131, 154, etc.)
  - `ScrapeAway()` called only on final step (reinf_walls.dm:180, inside `dismantle_wall()`)
  - Hull/radiation protection remains while intact

---

### Girder  `/obj/structure/girder`  (code/game/objects/structures/girders.dm:1)

A frame structure placed atop turfs and built into walls. Four states control how it can be moved and what materials are added.

- **What it is:** Lightweight frame that becomes a wall when metal/plasteel sheets are applied. Can be displaced and disassembled.
- **Key vars:**
  - `state = GIRDER_NORMAL` (girders.dm:7; GIRDER_NORMAL=0, GIRDER_REINF_STRUTS=1, GIRDER_REINF=2, GIRDER_DISPLACED=3, GIRDER_DISASSEMBLED=4)
  - `max_integrity = 200` (girders.dm:11)
  - `anchored = TRUE` (girders.dm:5, except GIRDER_DISPLACED)
  - `can_displace = TRUE` (girders.dm:9)
  - `girderpasschance = 20` (girders.dm:8; projectiles pass through at 20% chance)
- **State transitions (screwdriver/wrench/wirecutter):**
  | State | Tool | Delay | Message | Result |
  | --- | --- | --- | --- | --- |
  | GIRDER_NORMAL | Wrench | 40 ds | "You start unsecuring the girder..." → "You unsecure the girder." | Creates new `/obj/structure/girder/displaced` at loc, deletes self |
  | GIRDER_DISPLACED | Wrench | 40 ds | "You start securing the girder..." → "You secure the girder." | Creates new GIRDER_NORMAL at loc, deletes self |
  | GIRDER_DISPLACED | Screwdriver | 40 ds | "You start to disassemble the girder..." (visible_message) → "You disassemble the girder." | Drops 2× metal sheets, deletes self (girders.dm:223-234) |
  | GIRDER_REINF (2) | Screwdriver | 40 ds | "You start unsecuring support struts..." → "You unsecure the support struts." | → GIRDER_REINF_STRUTS (girders.dm:237-244) |
  | GIRDER_REINF_STRUTS (1) | Screwdriver | 40 ds | "You start securing support struts..." → "You secure the support struts." | → GIRDER_REINF (girders.dm:246-253) |
  | GIRDER_REINF_STRUTS (1) | Wirecutter | 40 ds | "You start removing the inner grille..." → "You remove the inner grille." | Drops 1× plasteel sheet, creates new GIRDER_NORMAL (girders.dm:256-266) |

- **Building walls on girders (adding sheets):**
  | Current State | Material | Amount | Delay | Message | Result |
  | --- | --- | --- | --- | --- | --- |
  | GIRDER_NORMAL | Metal sheets | 2 | 40 ds (20 ds w/ TRAIT_QUICK_BUILD) | "You start adding plating..." → "You add the plating." | `T.PlaceOnTop(/turf/closed/wall)` (girders.dm:108-121) |
  | GIRDER_DISPLACED | Metal sheets | 2 | 20 ds (14 ds w/ trait) | "You start building a false wall..." → "You create a false wall. Push on it to open or close the passage." | Creates `/obj/structure/falsewall` (girders.dm:94-106) |
  | GIRDER_NORMAL | Plasteel sheets | 1 | 60 ds (42 ds w/ trait) | "You start reinforcing the girder..." → "You reinforce the girder." | Creates `/obj/structure/girder/reinforced` (girders.dm:152-164) |
  | GIRDER_DISPLACED | Plasteel sheets | 2 | 20 ds | "You start building a reinforced false wall..." → "You create a reinforced false wall. Push it to open or close the passage." | Creates `/obj/structure/falsewall/reinforced` (girders.dm:123-136) |
  | GIRDER_REINF (2) | Plasteel sheets | 1 | 50 ds (35 ds w/ trait) | "You start finalizing the reinforced wall..." → "You fully reinforce the wall." | `T.PlaceOnTop(/turf/closed/wall/r_wall)` (girders.dm:138-151) |

- **Other tools:**
  - Plasmacutter: 40 ds "You start slicing apart the girder..." → "You slice apart the girder." → Drops 2× metal sheets, deletes self (girders.dm:39-45)
  - Rods: Can be inserted into girder as pipes (girders.dm:208-213)
  - Examine: Hints about bolts/screws/grille depending on state (girders.dm:15-28)

- **Deconstruction (when broken):** Random pick of `/obj/item/stack/rods` or `/obj/item/stack/sheet/metal` (girders.dm:301-305)
- **Gotchas:**
  - `TRAIT_QUICK_BUILD` reduces delay to 70% (multiply delay by 0.7)
  - All sheet additions use `do_after()` delay (can be interrupted)
  - Displaced girders: `anchored = FALSE`, `state = GIRDER_DISPLACED`, `girderpasschance = 25`, `max_integrity = 120` (girders.dm:311-316)
  - Reinforced girders cannot be displaced (`can_displace = FALSE` on subtypes like cult/bronze) and have `max_integrity = 350`, `girderpasschance = 0` (girders.dm:319-325)

---

### Reinforced Girder  `/obj/structure/girder/reinforced`  (code/game/objects/structures/girders.dm:319)

Subtype of girder locked in GIRDER_REINF state; no projectile pass-through.

- **What it is:** Intermediate frame for reinforced wall construction.
- **Key vars:**
  - `state = GIRDER_REINF` (overridden; girders.dm:322)
  - `max_integrity = 350` (girders.dm:324)
  - `girderpasschance = 0` (girders.dm:323)
- **Transitions:** Same as parent (screwdriver unsecure/secure support struts, wirecutter removes inner grille)
- **Deconstruction:** Same random pick as parent girder

---

### Plasteel Floor  `/turf/open/floor/plasteel`  (code/game/turfs/open/floor/plasteel_floor.dm:1)

Intact floor tile that can be broken, burnt, pried up, or replaced.

- **What it is:** Standard station flooring; when damaged or pried, reverts to plating.
- **Key vars:**
  - `floor_tile = /obj/item/stack/tile/plasteel` (plasteel_floor.dm:3)
  - `icon_state = "floor"` (plasteel_floor.dm:2)
  - `intact = 1` (floor.dm:18, parent class)
  - `broken = 0, burnt = 0` (floor.dm:19-20, parent)
- **Interactions:**
  | Tool | Action | Message | Result |
  | --- | --- | --- | --- |
  | Crowbar | Pry (on intact floor) | "You remove the floor tile." | Calls `remove_tile()` → `make_plating()` which returns `ScrapeAway(flags = CHANGETURF_INHERIT_AIR)` (floor.dm:188-203) |
  | Tiles (any type) | Place on intact plating | — | Checks for buckled mobs, uses 1 tile, converts turf to tile's `turf_type` via `PlaceOnTop()` with CHANGETURF_INHERIT_AIR (floor.dm:69-91) |
  | Welder | On broken/burnt plating | "You fix some dents on the broken plating." | Resets `broken=FALSE, burnt=FALSE` (plating.dm:92-100) |
- **Drops on removal:** 1× `/obj/item/stack/tile/plasteel` if floor_tile set (floor.dm:201-202 spawns this)
- **Break states:** `broken_states = list("damaged1-5")`, `burnt_states = list("floorscorched1-2")` (plasteel_floor.dm:4-5)
- **Gotchas:** 
  - `make_plating()` uses `ScrapeAway()` without flags (loses air) in parent; plasteel override returns `ScrapeAway(flags = CHANGETURF_INHERIT_AIR)` (floor.dm:144-145)
  - When broken/burnt, prying removes broken state and returns normal plating without tile drop (floor.dm:192-203)
  - Intact turf checks for buckled mobs before allowing tile placement (floor.dm:70-74)

---

### Plating  `/turf/open/floor/plating`  (code/game/turfs/open/floor/plating.dm:10)

Bare metal base with attachment holes for rods or tiles; the minimum flooring.

- **What it is:** Lowest level of finished flooring; sits atop baseturfs (usually space).
- **Key vars:**
  - `intact = FALSE` (plating.dm:13)
  - `baseturfs = /turf/baseturf_bottom` (plating.dm:14; end of the chain)
  - `attachment_holes = TRUE` (plating.dm:20)
- **Building on plating:**
  | Tool | Item | Amount | Delay | Message | Result |
  | --- | --- | --- | --- | --- | --- |
  | — | Rods | 2 | 30 ds | "You begin reinforcing the floor..." → "You reinforce the floor." | `PlaceOnTop(/turf/open/floor/engine, flags = CHANGETURF_INHERIT_AIR)`, uses 2 rods (plating.dm:52-68) |
  | — | Tiles (any) | 1 | 0 (no do_after) | (places immediately) | `PlaceOnTop(W.turf_type, flags = CHANGETURF_INHERIT_AIR)`, uses 1 tile (plating.dm:69-91) |
- **Repairing damage:**
  | Tool | State | Delay | Message | Result |
  | --- | --- | --- | --- | --- |
  | Welder | broken or burnt | 0 ds | "You fix some dents on the broken plating." | Resets `broken=FALSE, burnt=FALSE` (plating.dm:92-100) |
- **Examine hints:** Shows attachment holes if intact; says reinforcement or tiling is possible (plating.dm:22-30)
- **Gotchas:**
  - `attachment_holes` controls what can be built; broken/burnt plating cannot accept tiles until welded (plating.dm:53-55)
  - `make_plating()` override returns null (does nothing; you're already at plating) (plating.dm:105-106)
  - Foam plating subtype is destructible and replaces with rods/tiles (plating.dm:108-156)

---

### Engine Floor / Reinforced Floor  `/turf/open/floor/engine`  (code/game/turfs/open/floor/reinf_floor.dm:2)

Heavily armored plating with rods embedded; cannot be broken, burnt, or tiled over. Deconstruction requires wrench.

- **What it is:** Reinforced plating (not a tile) built by placing 2 rods on plating.
- **Key vars:**
  - `name = "reinforced floor"` (reinf_floor.dm:3)
  - `icon_state = "engine"` (reinf_floor.dm:5)
  - `floor_tile = /obj/item/stack/rods` (reinf_floor.dm:8; drops 2 when deconstructed)
  - `thermal_conductivity = 0.025, heat_capacity = INFINITY` (reinf_floor.dm:6-7; very thermally inert)
  - `tiled_dirt = FALSE` (reinf_floor.dm:13; no dirt accumulation)
- **Deconstruction:**
  | Tool | Delay | Message | Result |
  | --- | --- | --- | --- |
  | Wrench | 30 ds | "You begin removing rods..." → "You remove the rods." (implied by use_tool result) | Drops 2× `/obj/item/stack/rods`, calls `ScrapeAway(flags = CHANGETURF_INHERIT_AIR)` to revert to plating (reinf_floor.dm:36-48) |
- **Resistances:**
  - `break_tile()` returns (no effect) (reinf_floor.dm:22-23)
  - `burn_tile()` returns (no effect) (reinf_floor.dm:25-26)
  - `make_plating()` returns unless forced (unplateable) (reinf_floor.dm:28-31)
  - `try_replace_tile()` returns (cannot place tiles) (reinf_floor.dm:33-34)
  - `crowbar_act()` returns (cannot pry) (reinf_floor.dm:36-37)
- **Examine hint:** "The reinforcement rods are wrenched firmly in place." (reinf_floor.dm:15-17)
- **Gotchas:**
  - RCD cannot deconstruct (no rcd_vals override, uses parent's which returns FALSE for engine floors)
  - Heat/acid resistance (thermal_conductivity much lower than plating) makes it useful for engine rooms with extreme temperatures (reinf_floor.dm:50-52)
  - Singularity pull and explosions can destroy it and drop rods or convert to plating (reinf_floor.dm:54-86)

---

### Floor Tile  `/obj/item/stack/tile/plasteel`  (code/game/objects/items/stacks/tiles/tile_types.dm:328)

Stackable item used to place flooring on plating or lattice. Holds up to 60 units.

- **What it is:** Craftable/droppable flooring unit; placed one at a time on turfs.
- **Key vars:**
  - `name = "floor tile"` (tile_types.dm:329)
  - `max_amount = 60` (tile_types.dm:13, parent class)
  - `turf_type = /turf/open/floor/plasteel` (tile_types.dm:338)
  - `custom_materials = list(/datum/material/iron=500)` (tile_types.dm:335)
  - `force = 6, throwforce = 10` (tile_types.dm:334, 336)
  - `mineralType = "metal"` (tile_types.dm:339)
- **Placing on turf:**
  - On `/turf/open/floor/plating` (unbroken): Use 1 tile → calls `PlaceOnTop(W.turf_type)` with CHANGETURF_INHERIT_AIR (floor.dm:75-87)
  - On `/turf/open/space` + lattice: Use 1 tile → deletes lattice, calls `PlaceOnTop(/turf/open/floor/plating)` (space.dm:131-143)
  - On broken/burnt plating: Warns user "This section is too damaged..." (floor.dm:90)
- **Welding into sheets:** 4 tiles + welder → `/obj/item/stack/sheet/metal` (tile_types.dm:43-86)
- **Gotchas:**
  - Other subtypes (light, mineral, etc.) have different `turf_type` and materials
  - Cannot place on intact floors (need crowbar to pry first)
  - Cannot place on engine floors or lattice without going through space (which requires lattice first)

---

### Lattice  `/obj/structure/lattice`  (code/game/objects/structures/lattice.dm:1)

A lightweight frame placed over space; required before plating can be built.

- **What it is:** Support structure for building over void; allows for temporary walkways (catwalk) or foundation for floors.
- **Key vars:**
  - `name = "lattice"` (lattice.dm:2)
  - `density = FALSE` (lattice.dm:6; can walk through, but blocks projectiles at low chance)
  - `anchored = TRUE` (lattice.dm:7)
  - `max_integrity = 50` (lattice.dm:9)
  - `number_of_mats = 1` (lattice.dm:12)
  - `build_material = /obj/item/stack/rods` (lattice.dm:13)
- **Deconstruction:**
  | Tool | Delay | Message | Result |
  | --- | --- | --- | --- |
  | Wirecutter | 0 ds | "Slicing [name] joints ..." | Calls `deconstruct()` → drops 1× rods (lattice.dm:42-44) |
- **Building on lattice:**
  - Rods on lattice with existing lattice: 1 rod + "You construct a catwalk." → Creates `/obj/structure/lattice/catwalk` (space.dm:117-123)
  - Tile on lattice: 1 tile + "You build a floor." → Deletes lattice, places `/turf/open/floor/plating` (space.dm:131-143)
  - Other items: Hands off to turf.attackby() (lattice.dm:46-47)
- **Gotchas:**
  - `canSmoothWith` includes floors and walls for visual smoothing (lattice.dm:14-17)
  - Lattice deconstruction is non-reversible; no state tracking
  - Cannot place on lattice except for catwalk (second rod) or tile (conversion)

---

### Catwalk  `/obj/structure/lattice/catwalk`  (code/game/objects/structures/lattice.dm:72)

An improved lattice with walkable surface; doubles as lattice for building on top of.

- **What it is:** Lattice variant with 2-rod cost and cable management integration.
- **Key vars:**
  - `name = "catwalk"` (lattice.dm:73)
  - `number_of_mats = 2` (lattice.dm:77; drops 2 rods on deconstruction)
  - `smooth = SMOOTH_TRUE` (lattice.dm:78; smooths with self)
  - `canSmoothWith = null` (lattice.dm:79; does not smooth with other structures)
  - `obj_flags = CAN_BE_HIT | BLOCK_Z_FALL` (lattice.dm:80)
- **Deconstruction:**
  | Tool | Result |
  | --- | --- |
  | Wirecutter | Removes all cables in turf, drops 2× rods, deletes self (lattice.dm:91-95) |
- **Gotchas:**
  - Moving or deconstructing a catwalk also destroys all cables on that turf (lattice.dm:85-88, 91-95)
  - Catwalk is still a lattice and can have tiles placed on it to become plating
  - Built by placing 1 additional rod on a lattice (already has 1 rod, add 1 more = 2 total cost)

---

### Space Turf  `/turf/open/space`  (code/game/turfs/open/space/space.dm:1)

Void; cannot support structures until lattice is placed. Building sequence: rods → lattice → (catwalk or tile) → plating/floor.

- **What it is:** Vacuum with no floor; building requires ordered steps.
- **Key vars:**
  - `intact = 0` (space.dm:5)
  - `temperature = TCMB` (2.7 K, absolute cold)
  - `plane = PLANE_SPACE, layer = SPACE_LAYER` (space.dm:16-17)
  - `CanBuildHere()` returns TRUE (space.dm:99-100)
- **Building sequence:**
  | Step | Material | Amount | Delay | Message | Result |
  | --- | --- | --- | --- | --- | --- |
  | 1 | Rods (space has no lattice) | 1 | 0 ds | "You construct a lattice." | Calls `ReplaceWithLattice()` (space.dm:124-130) |
  | 2 | Rods (space with lattice) | 1 | 0 ds | "You construct a catwalk." | Creates `/obj/structure/lattice/catwalk` (space.dm:117-123) |
  | 2 (alt) | Tiles (space with lattice, no catwalk) | 1 | 0 ds | "You build a floor." | Deletes lattice, calls `PlaceOnTop(/turf/open/floor/plating, flags = CHANGETURF_INHERIT_AIR)` (space.dm:131-143) |
- **RCD on space:**
  | Mode | Cost | Delay | Result |
  | --- | --- | --- | --- |
  | FLOORWALL (no lattice) | 3 | 0 ds | `PlaceOnTop(/turf/open/floor/plating)` |
  | FLOORWALL (with lattice) | 1 | 0 ds | `PlaceOnTop(/turf/open/floor/plating)` (assumes lattice exists) |
- **Gotchas:**
  - Cannot place tiles on bare space (need lattice first)
  - `ReplaceWithLattice()` preserves `destination_x/y/z` for transitional space turfs (space.dm:230-237)
  - No air/atmosphere in space (infinite cold vacuum)
  - Building over space does not automatically create air; floors inherit from space (no air) unless explicitly set

---

## ScrapeAway and ChangeTurf: Atmospheric Consequences

Both procs swap one turf for another and affect air composition based on flags.

### `ScrapeAway(amount=1, flags)`  (change_turf.dm:157)

Removes the top N layers of `baseturfs` and replaces turf with the next-lower baseturf type.

- **Behavior:**
  - Pops top `amount` entries from baseturfs list
  - Calls `ChangeTurf(turf_type, new_baseturfs, flags)` with the next baseturf down
  - Returns the new turf created
  - Used by: walls on final deconstruction, floors on prying/damage, girders on clearing, engines on wrench deconstruction
  
- **Atmospheric handling:**
  - Without `CHANGETURF_INHERIT_AIR` flag: Creates turf with default/fresh atmosphere (loses old air)
  - With `CHANGETURF_INHERIT_AIR` flag: Copies air from old turf to new turf before calling `ChangeTurf()`
  
- **Usage:**
  - `walls.dm`: `ScrapeAway()` (no flags) → loses air when wall removed (walls.dm:69, 287)
  - `floor.dm`: `ScrapeAway(flags = CHANGETURF_INHERIT_AIR)` → preserves room air when floor pried (floor.dm:76, 145)
  - `reinf_floor.dm`: `ScrapeAway(flags = CHANGETURF_INHERIT_AIR)` → preserves air when wrench-deconstructed (reinf_floor.dm:47)

### `ChangeTurf(path, new_baseturfs, flags)`  (change_turf.dm:59)

Creates new turf of type `path`, deletes old, transfers components and air if flagged.

- **Behavior:**
  - `qdel(src)` immediately (triggers Destroy, removes from tracking)
  - `new path(src)` at same location with old turf's coordinates
  - Transfers baseturfs or uses provided list
  - Calls `AfterChange(flags)` unless `CHANGETURF_DEFER_CHANGE`
  
- **For /turf/open** (change_turf.dm:138):
  - With `CHANGETURF_INHERIT_AIR` AND ispath(path, /turf/open):
    - Stashes old air in temp gas_mixture
    - Calls parent ChangeTurf
    - Copies stashed air to new turf
    - Triggers air system recalc
  - Without flag: New turf gets fresh/default atmosphere

- **For /turf/closed** (change_turf.dm:138-154):
  - Automatically sets `CHANGETURF_RECALC_ADJACENT` to notify neighbors of density change
  
- **Usage:**
  - `PlaceOnTop()` wrapper (not shown here) likely calls ChangeTurf with CHANGETURF_INHERIT_AIR
  - Floor tile placement: `T.PlaceOnTop(turf_type, flags = CHANGETURF_INHERIT_AIR)` (floor.dm:82, 260)
  - Space building: `PlaceOnTop(/turf/open/floor/plating, flags = CHANGETURF_INHERIT_AIR)` (space.dm:139, 226)
  - Wall removal: `ScrapeAway()` (no flags) → loses air to vacuum if baseturf is space (walls.dm:69)

- **Gotchas:**
  - Wall/closed turf removal without CHANGETURF_INHERIT_AIR creates a sudden pressure drop/explosive decompression
  - Floor removal *with* CHANGETURF_INHERIT_AIR preserves local air (more realistic)
  - Floors default to inheriting air; walls default to losing air (design choice: walls are destructive, floors are careful)

---

## Minimum Viable Port

1. **Walls:** Plain wall with single-step welder deconstruction → girder + 2 sheets. No reversible states needed.
2. **Girders:** Normal state with wrench (unsecure) and sheet application (2 metal → wall, 1 plasteel → r_wall precursor).
3. **Reinforced walls:** Simplify to 2-3 steps (grille cut, cover sliced, pried off) instead of 7 states; reverse with same tools.
4. **Plating + Engine floor:** Plating with crowbar removal (→ space). Engine floor with wrench removal (→ plating) + 2 rods dropped.
5. **Lattice + Catwalk:** Lattice on space with wirecutter deconstruction. Catwalk variant (2 mats) with cable cleanup on removal.
6. **Floor tiles:** Plasteel tile stackable; place on plating with do_after, consume 1 unit, convert to floor type.
7. **ScrapeAway/ChangeTurf:** Implement turf-layer stack (baseturfs) and CHANGETURF_INHERIT_AIR flag. Walls lose air on removal; floors preserve it.
8. **Space building:** Rods → lattice; +rod → catwalk; tile on lattice → plating. No intermediate states.
9. **RCD:** Support FLOORWALL mode on girders, space, plating; DECONSTRUCT on girders/walls.
10. **Examine hints:** Show next deconstruction tool and current state (walls, r_walls, engine floor, girders).

---

## NOT FOUND / Open Questions

- **Tool audio**: `play_tool_sound()` and `use_tool()` handle sound playback; not documented here (impl-specific).
- **Particle effects / decals**: Dent/bullet decals on walls use mutable_appearance overlays; decal cleanup in examine (walls.dm:213-215).
- **RCD electronics/upgrades**: RCD deconstruction/construction modes exist but card/circuit logic not in scope.
- **Welding/cutting speed modifiers**: TRAIT_QUICK_BUILD is applied but not all tools/contexts checked.
- **Damage types on walls**: Explosions use `severity` tiers and `hardness` checks; acid/thermal/radiation specific actions exist but not fully detailed.
- **Custom materials on girders**: Girders support mineral sheet types (iron, diamond, etc.) but material system not in scope.
- **Atmos layer stacking**: baseturfs list order and ZTRAIT_BASETURF assignment handled by SSmapping; not detailed here.
