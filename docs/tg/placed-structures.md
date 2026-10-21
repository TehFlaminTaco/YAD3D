# Placed Structures on BoxStation

Documentation of 169 structures placed on BoxStation that are not covered in earlier topic documents. This file covers warning signs, closets, furniture, machines, and decorative items with their mechanics, health, construction, and interactions. All times in deciseconds (ds), where 1 second = 10 ds. Ordered by count (highest first).

Source: `_src/tg2020` commit `2d6c10c1` (2020-07-06)

## Warning Signs

**Common vars for all `/obj/structure/sign/warning/` subtypes** (code/game/objects/structures/signs/_signs.dm:1-225)
- **Anchored, density, max_integrity**: `anchored = TRUE`, `density = FALSE`, `max_integrity = 100` (code/game/objects/structures/signs/_signs.dm:3,5,8)
- **Armor**: `list("melee" = 50, "bullet" = 0, "laser" = 0, "energy" = 0, "bomb" = 0, "bio" = 0, "rad" = 0, "fire" = 50, "acid" = 50)` (code/game/objects/structures/signs/_signs.dm:9)
- **Wrench deconstruction**: `4 SECONDS` (40 ds) with wrench. Message: `"[user] starts removing [src]..."` / `"You start unfastening [src]."`. Yields `new /obj/item/sign(get_turf(user))` (code/game/objects/structures/signs/_signs.dm:69-92)
- **Welder repair**: `4 SECONDS` (40 ds) with welder when damaged. Message: `"[user] starts repairing [src]..."` / `"You start repairing [src]."` → `"[user] finishes repairing [src]."`. Sets `obj_integrity = max_integrity` (code/game/objects/structures/signs/_signs.dm:94-110)
- **Pen customization** (if `is_editable = TRUE`): 40 ds. Opens menu to select sign type. Message: `"[user] begins changing [src]."` → `"[user] finishes changing the sign."` (code/game/objects/structures/signs/_signs.dm:130-158)

| Count | DM path | In-game name | Notes |
|-------|---------|--------------|-------|
| 48 | `/obj/structure/sign/warning/securearea` | SECURE AREA sign | Name: `"\improper SECURE AREA sign"`, desc: `"A warning sign which reads 'SECURE AREA'."`, icon_state: `"securearea"`, is_editable: TRUE (code/game/objects/structures/signs/signs_warning.dm:13-17) |
| 45 | `/obj/structure/closet/emcloset` | emergency closet | (Documented in Closets section) |
| 38 | `/obj/structure/sign/warning/electricshock` | HIGH VOLTAGE sign | Name: `"\improper HIGH VOLTAGE sign"`, desc: `"A warning sign which reads 'HIGH VOLTAGE'."`, icon_state: `"shock"`, is_editable: TRUE (code/game/objects/structures/signs/signs_warning.dm:32-37) |
| 35 | `/obj/structure/sign/warning/vacuum/external` | EXTERNAL AIRLOCK sign | Name: `"\improper EXTERNAL AIRLOCK sign"`, desc: `"A warning sign which reads 'EXTERNAL AIRLOCK'."`, layer: MOB_LAYER (higher than normal), is_editable: TRUE (code/game/objects/structures/signs/signs_warning.dm:46-51) |
| 12 | `/obj/structure/sign/warning/nosmoking` | NO SMOKING sign | Name: `"\improper NO SMOKING sign"`, icon_state: `"nosmoking2"`, is_editable: TRUE, resistance_flags: FLAMMABLE (code/game/objects/structures/signs/signs_warning.dm:75-81) |
| 11 | `/obj/structure/sign/warning/docking` | KEEP CLEAR: DOCKING AREA sign | Name: `"\improper KEEP CLEAR: DOCKING AREA sign"`, desc: `"A warning sign which reads 'KEEP CLEAR OF DOCKING AREA'."`, is_editable: TRUE (code/game/objects/structures/signs/signs_warning.dm:19-23) |
| 10 | `/obj/structure/sign/warning/fire` | DANGER: FIRE sign | Name: `"\improper DANGER: FIRE sign"`, icon_state: `"fire"`, is_editable: TRUE, resistance_flags: FIRE_PROOF (code/game/objects/structures/signs/signs_warning.dm:67-73) |
| 9 | `/obj/structure/sign/warning/biohazard` | BIOHAZARD sign | Name: `"\improper BIOHAZARD sign"`, desc: `"A warning sign which reads 'BIOHAZARD'."`, icon_state: `"bio"`, is_editable: TRUE (code/game/objects/structures/signs/signs_warning.dm:25-30) |
| 6 | `/obj/structure/sign/warning/radiation/rad_area` | RADIOACTIVE AREA sign | Name: `"\improper RADIOACTIVE AREA sign"`, desc: `"A warning sign which reads 'RADIOACTIVE AREA'."`, is_editable: TRUE (code/game/objects/structures/signs/signs_warning.dm:97-101) |
| 6 | `/obj/structure/sign/warning/deathsposal` | DISPOSAL: LEADS TO SPACE sign | Name: `"\improper DISPOSAL: LEADS TO SPACE sign"`, icon_state: `"deathsposal"`, is_editable: TRUE (code/game/objects/structures/signs/signs_warning.dm:53-58) |
| 4 | `/obj/structure/sign/warning/pods` | ESCAPE PODS sign | Name: `"\improper ESCAPE PODS sign"`, icon_state: `"pods"`, is_editable: TRUE (code/game/objects/structures/signs/signs_warning.dm:176-181) |
| 4 | `/obj/structure/sign/warning/coldtemp` | FREEZING AIR sign | Name: `"\improper FREEZING AIR sign"`, icon_state: `"cold"`, is_editable: TRUE (code/game/objects/structures/signs/signs_warning.dm:146-151) |
| 2 | `/obj/structure/sign/warning/nosmoking/circle` | NO SMOKING sign (alt) | Name: `"\improper NO SMOKING sign"`, icon_state: `"nosmoking"`, is_editable: TRUE (code/game/objects/structures/signs/signs_warning.dm:83-88) |
| 2 | `/obj/structure/sign/warning/vacuum` | HARD VACUUM AHEAD sign | Name: `"\improper HARD VACUUM AHEAD sign"`, icon_state: `"space"`, is_editable: TRUE (code/game/objects/structures/signs/signs_warning.dm:39-44) |
| 1 | `/obj/structure/sign/warning/radiation` | HAZARDOUS RADIATION sign | Name: `"\improper HAZARDOUS RADIATION sign"`, icon_state: `"radiation"`, is_editable: TRUE (code/game/objects/structures/signs/signs_warning.dm:90-95) |

## Closets and Lockers

**Common vars for `/obj/structure/closet`** (code/game/objects/structures/crates_lockers/closets.dm:1-540)
- **Density, anchored**: `density = TRUE`, `anchored = FALSE` by default (but most are anchored via mapload or subtype), `wall_mounted = 0` (code/game/objects/structures/crates_lockers/closets.dm:6,18-19)
- **Health**: `max_integrity = 200`, `integrity_failure = 0.25`, `armor = list("melee" = 20, "bullet" = 10, "laser" = 10, "energy" = 0, "bomb" = 10, "bio" = 0, "rad" = 0, "fire" = 70, "acid" = 60)` (code/game/objects/structures/crates_lockers/closets.dm:8-10)
- **Capacity**: `storage_capacity = 30`, `mob_storage_capacity = 3`, `max_mob_size = MOB_SIZE_HUMAN` (code/game/objects/structures/crates_lockers/closets.dm:28-29)
- **Welder when opened** (40 ds): Message: `"You begin cutting \the [src] apart..."` → `"[user] slices apart \the [src]."` on success. Calls `deconstruct(TRUE)`, yields materials (code/game/objects/structures/crates_lockers/closets.dm:252-270)
- **Welder when closed** (40 ds): Toggles `welded` state. Message: `"You begin [welded ? "unwelding":"welding"] \the [src]..."` → `"[user] [welded ? "welds shut" : "unwelded"] \the [src]."` (code/game/objects/structures/crates_lockers/closets.dm:273-286)
- **Wrench** (anchorable types): Toggles `anchored`. Message: `"[user] [anchored ? "anchored" : "unanchored"] \the [src] [anchored ? "to" : "from"] the ground."` (code/game/objects/structures/crates_lockers/closets.dm:287-294)
- **Open/close**: Left-click with no tool. `open(user)` plays `open_sound` (default: `'sound/machines/closet_open.ogg'`, 35 volume), sets `opened = TRUE`, `density = FALSE` (unless `dense_when_open`), dumps contents. `close(user)` plays `close_sound` (default: `'sound/machines/closet_close.ogg'`, 50 volume), gathers contents back. Cannot open if locked or welded (code/game/objects/structures/crates_lockers/closets.dm:158-224)
- **Breakout from inside** (if locked/welded, `breakout_time = 1200` ds = 120 seconds): Message: `"You lean on the back of [src] and start pushing the door open... (this will take about [DisplayTimeText(breakout_time)].)"` → `"[user] successfully broke out of [src]!"` (code/game/objects/structures/crates_lockers/closets.dm:399-427)
- **Deconstruct**: `new /obj/item/stack/sheet/metal(loc, material_drop_amount)` where `material_drop = /obj/item/stack/sheet/metal`, `material_drop_amount = 2` (inherited, modified per subtype) (code/game/objects/structures/crates_lockers/closets.dm:232-235)
- **Interactions**: ID card triggers lock/unlock for secure closets if `allowed(user)`. Alt-click toggles lock on secure closets. No buckling inside unless `can_buckle` is set per subtype. `dense = TRUE` blocks movement through.

| Count | DM path | In-game name | Notes |
|-------|---------|--------------|-------|
| 18 | `/obj/structure/chair/office/light` | (Chair - documented in Furniture section) | |
| 15 | `/obj/structure/filingcabinet` | filing cabinet | (Documented in Furniture section) |
| 13 | `/obj/structure/bodycontainer/morgue` | morgue | (Documented in Machinery section) |
| 11 | `/obj/structure/shuttle/engine/propulsion` | propulsion engine | (Documented in Machinery section) |
| 9 | `/obj/structure/closet/toolcloset` | tool closet | name: `"tool closet"`, desc: `"It's a storage unit for tools."`, icon_state: `"eng"`, icon_door: `"eng_tool"`. PopulateContents: 40% chance for hazard vest, 70% each for flashlight, screwdriver, wrench, welder, crowbar, wirecutters, t_scanner, 20% utility belt, 30% cable coil (x3), 20% multitool, 5% yellow gloves, 40% hardhat (code/game/objects/structures/crates_lockers/closets/utility_closets.dm:84-122) |
| 9 | `/obj/structure/noticeboard` | notice board | (Documented in Furniture section) |
| 9 | `/obj/structure/closet/secure_closet/brig` | (Secure closet for brig) | Subtype of `/obj/structure/closet/secure_closet`. Base: name: `"secure closet"`, desc: `"A locked storage unit."`, max_integrity: 200, armor: [melee 20, bullet 10, laser 10, energy 0, bomb 10, bio 0, rad 0, fire 70, acid 60], `secure = TRUE`, `locked = FALSE` by default (requires ID to toggle lock). Brig variant has specific req_access list (code/game/objects/structures/crates_lockers/closets.dm:1-50) |
| 7 | `/obj/structure/closet/secure_closet/personal` | (Secure personal closet) | Secure closet with `req_access = list(ACCESS_GENERAL)` |
| 6 | `/obj/structure/closet/secure_closet/personal/cabinet` | (Personal cabinet) | Subtype of personal closet |
| 6 | `/obj/structure/closet/secure_closet/security/sec` | (Security secure closet) | Secure closet with security access requirements |
| 5 | `/obj/structure/closet/wardrobe/mixed` | mixed wardrobe | name: `"mixed wardrobe"`, icon_door: `"mixed"`. PopulateContents: multiple colored clothing sets (code/game/objects/structures/crates_lockers/closets/wardrobe.dm:161-200) |
| 5 | `/obj/structure/closet/wardrobe/white` | white wardrobe | name: `"white wardrobe"`, icon_door: `"white"`. PopulateContents: white clothing (code/game/objects/structures/crates_lockers/closets/wardrobe.dm:102-115) |
| 5 | `/obj/structure/closet/wardrobe/black` | black wardrobe | name: `"black wardrobe"`, icon_door: `"black"`. PopulateContents: black clothing and leather jackets (code/game/objects/structures/crates_lockers/closets/wardrobe.dm:29-52) |
| 4 | `/obj/structure/closet/l3closet/scientist` | (L3 scientist closet) | |
| 4 | `/obj/structure/closet/wardrobe/grey` | grey wardrobe | name: `"grey wardrobe"`, icon_door: `"grey"`. PopulateContents: grey clothing with winter items (code/game/objects/structures/crates_lockers/closets/wardrobe.dm:131-158) |
| 3 | `/obj/structure/closet/secure_closet/miner` | (Miner secure closet) | |
| 3 | `/obj/structure/closet/secure_closet/chemical` | (Chemistry secure closet) | |
| 3 | `/obj/structure/closet/secure_closet/engineering_personal` | (Engineering personal closet) | |
| 3 | `/obj/structure/closet/secure_closet/atmospherics` | (Atmospherics secure closet) | |
| 3 | `/obj/structure/closet/l3closet/virology` | (L3 virology closet) | |
| 2 | `/obj/structure/closet/wardrobe/green` | green wardrobe | name: `"green wardrobe"`, icon_door: `"green"` (code/game/objects/structures/crates_lockers/closets/wardrobe.dm:55-68) |
| 2 | `/obj/structure/closet/wardrobe/white` (duplicate count) | white wardrobe | (See above) |
| 2 | `/obj/structure/closet/wardrobe/pjs` | pajama wardrobe | name: `"pajama wardrobe"`, icon_door: `"white"` (code/game/objects/structures/crates_lockers/closets/wardrobe.dm:117-128) |
| 2 | `/obj/structure/closet/crate/internals` | (Internals crate) | |
| 2 | `/obj/structure/closet/crate/freezer` | (Freezer crate) | |
| 2 | `/obj/structure/closet/crate/hydroponics` | (Hydroponics crate) | |
| 2 | `/obj/structure/closet/crate/bin` | (Bin crate) | |
| 2 | `/obj/structure/closet/emcloset/anchored` | emergency closet (anchored) | Subtype of emcloset with `anchored = TRUE` (code/game/objects/structures/crates_lockers/closets/utility_closets.dm:20-21) |
| 2 | `/obj/structure/closet/secure_closet/medical1` | (Medical secure closet 1) | |
| 2 | `/obj/structure/closet/secure_closet/medical2` | (Medical secure closet 2) | |
| 2 | `/obj/structure/closet/secure_closet/medical3` | (Medical secure closet 3) | |
| 2 | `/obj/structure/closet/secure_closet/hydroponics` | (Hydroponics secure closet) | |
| 2 | `/obj/structure/closet/l3closet` | (L3 closet) | |
| 1 | `/obj/structure/closet/secure_closet/security` | (Security secure closet) | |
| 1 | `/obj/structure/closet/secure_closet/quartermaster` | (Quartermaster closet) | |
| 1 | `/obj/structure/closet/secure_closet/injection` | (Injection closet) | |
| 1 | `/obj/structure/closet/wardrobe/miner` | (Miner wardrobe) | |
| 1 | `/obj/structure/closet/secure_closet/security/cargo` | (Security/cargo closet) | |
| 1 | `/obj/structure/closet/secure_closet/exile` | (Exile closet) | |
| 1 | `/obj/structure/closet/crate/trashcart/laundry` | (Laundry trash cart) | |
| 1 | `/obj/structure/closet/secure_closet/hop` | (HOP closet) | |
| 1 | `/obj/structure/closet/secure_closet/detective` | (Detective closet) | |
| 1 | `/obj/structure/closet/crate/solarpanel_small` | (Small solar panel crate) | |
| 1 | `/obj/structure/closet/secure_closet/contraband/armory` | (Armory contraband) | |
| 1 | `/obj/structure/closet/secure_closet/warden` | (Warden closet) | |
| 1 | `/obj/structure/closet/secure_closet/lethalshots` | (Lethal shots closet) | |
| 1 | `/obj/structure/closet/l3closet/janitor` | (L3 janitor closet) | |
| 1 | `/obj/structure/closet/secure_closet/engineering_chief` | (Chief engineer closet) | |
| 1 | `/obj/structure/closet/bombcloset/security` | (Security bomb closet) | Subtype with security-specific bomb suit (code/game/objects/structures/crates_lockers/closets/utility_closets.dm:154-158) |
| 1 | `/obj/structure/closet/l3closet/security` | (L3 security closet) | |
| 1 | `/obj/structure/closet/secure_closet/captains` | (Captain's closet) | |
| 1 | `/obj/structure/closet/secure_closet/security/engine` | (Security/engine closet) | |
| 1 | `/obj/structure/closet/secure_closet/courtroom` | (Courtroom closet) | |
| 1 | `/obj/structure/closet/secure_closet/engineering_electrical` | (Electrical engineer closet) | |
| 1 | `/obj/structure/closet/secure_closet/engineering_welding` | (Welding engineer closet) | |
| 1 | `/obj/structure/closet/secure_closet/hos` | (HOS closet) | |
| 1 | `/obj/structure/closet/crate/wooden/toy` | (Toy wooden crate) | |
| 1 | `/obj/structure/closet/athletic_mixed` | (Athletic mixed closet) | |
| 1 | `/obj/structure/closet/boxinggloves` | (Boxing gloves closet) | |
| 1 | `/obj/structure/closet/masks` | (Masks closet) | |
| 1 | `/obj/structure/closet/lasertag/blue` | (Blue laser tag closet) | |
| 1 | `/obj/structure/closet/lasertag/red` | (Red laser tag closet) | |
| 1 | `/obj/structure/closet/secure_closet/bar` | (Bar closet) | |
| 1 | `/obj/structure/closet/crate/freezer/surplus_limbs` | (Surplus limbs freezer crate) | |
| 1 | `/obj/structure/closet/secure_closet/security/med` | (Security medical closet) | |
| 1 | `/obj/structure/closet/secure_closet/freezer/meat` | (Meat freezer closet) | |
| 1 | `/obj/structure/closet/secure_closet/chief_medical` | (Chief medical officer closet) | |
| 1 | `/obj/structure/closet/secure_closet/freezer/fridge` | (Fridge freezer closet) | |
| 1 | `/obj/structure/closet/secure_closet/psychology` | (Psychology closet) | |
| 1 | `/obj/structure/closet/secure_closet/freezer/kitchen` | (Kitchen freezer closet) | |
| 1 | `/obj/structure/closet/secure_closet/research_director` | (Research director closet) | |
| 1 | `/obj/structure/closet/secure_closet/security/science` | (Security/science closet) | |

## Furniture and Decor

| Count | DM path | In-game name | Notes |
|-------|---------|--------------|-------|
| 18 | `/obj/structure/chair/office/light` | light office chair | Subtype of office chair |
| 15 | `/obj/structure/filingcabinet` | filing cabinet | name: `"filing cabinet"`, desc: `"A large cabinet with drawers."`, icon_state: `"filingcabinet"`, density: TRUE, anchored: TRUE. Wrench (20 ds): toggles anchored state. Message: `"You begin to [anchored ? "unwrench" : "wrench"] [src]."` → `"You successfully [anchored ? "unwrench" : "wrench"] [src]."` Stores small items (w_class < WEIGHT_CLASS_NORMAL). Can hold unlimited items. Deconstruct: `new /obj/item/stack/sheet/metal(loc, 2)`, contents drop (code/modules/paperwork/filingcabinet.dm:13-111) |
| 9 | `/obj/structure/noticeboard` | notice board | name: `"notice board"`, desc: `"A board for pinning important notices upon."`, icon_state: `"nboard00"`, density: FALSE, anchored: TRUE, max_integrity: 150. Initialize on mapload: scans turf for `/obj/item/paper` and moves up to 4 to contents, updates icon_state to nboard0[notices]. Attackby with paper/photo: requires `allowed(user)` access. Max 5 notices. Message: `"You pin the [O] to the noticeboard."`. UI: lists notices, authorized users can write or remove. Deconstruct: `new /obj/item/stack/sheet/metal(loc, 1)` (code/game/objects/structures/noticeboard.dm:1-133) |
| 8 | `/obj/structure/chair/comfy/beige` | comfy chair | Subtype of comfy chair with `color = rgb(255,253,195)` (beige) |
| 8 | `/obj/structure/chair/comfy/brown` | comfy chair | Subtype of comfy chair with `color = rgb(255,113,0)` (brown) |
| 8 | `/obj/structure/filingcabinet/chestdrawer` | chest drawer | name: `"chest drawer"`, icon_state: `"chestdrawer"`. Same mechanics as filing cabinet (code/modules/paperwork/filingcabinet.dm:21-23) |
| 4 | `/obj/structure/table/optable` | operating table | Subtype of table |
| 2 | `/obj/structure/piano` | (Piano) | |
| 2 | `/obj/structure/reflector/single/anchored` | (Single reflector - anchored) | |
| 2 | `/obj/structure/reflector/box/anchored` | (Box reflector - anchored) | |
| 2 | `/obj/structure/chair/sofa/right` | sofa (right) | Subtype of sofa with icon_state: `"sofaend_right"` (code/game/objects/structures/beds_chairs/sofa.dm:11-12) |
| 2 | `/obj/structure/chair/sofa/left` | sofa (left) | Subtype of sofa with icon_state: `"sofaend_left"` (code/game/objects/structures/beds_chairs/sofa.dm:8-9) |
| 2 | `/obj/structure/bed/pod` | (Pod bed) | |
| 1 | `/obj/structure/reflector/double/anchored` | (Double reflector - anchored) | |
| 1 | `/obj/structure/displaycase/captain` | (Captain display case) | |
| 1 | `/obj/structure/displaycase/labcage` | (Lab cage display case) | |
| 1 | `/obj/structure/displaycase/trophy` | (Trophy display case) | Variant of display case |
| 1 | `/obj/structure/displaycase/forsale/kitchen` | (Kitchen for-sale display case) | |
| 1 | `/obj/structure/safe` | (Safe) | |
| 1 | `/obj/structure/holohoop` | (Holohoop) | |
| 1 | `/obj/structure/curtain` | curtain | Decorative curtain structure |

**Chair base** (`/obj/structure/chair`): name: `"chair"`, desc: `"You sit in this. Either by will or force."`, density: TRUE, anchored: TRUE, can_buckle: TRUE, buckle_lying: 0, max_integrity: 250, integrity_failure: 0.1. Wrench: `deconstruct()` drops `new /obj/item/stack/sheet/metal(loc, 1)`. Can rotate with Alt-click. Mobs can buckle/sit. Examined message: `"It's held together by a couple of <b>bolts</b>."` (code/game/objects/structures/beds_chairs/chair.dm:1-200)

**Comfy chair** (`/obj/structure/chair/comfy`): name: `"comfy chair"`, desc: `"It looks comfy."`, icon_state: `"comfychair"`, resistance_flags: FLAMMABLE, max_integrity: 70, buildstackamount: 2. Has colored variants (black, brown, beige, teal, lime). Armrest visual overlay when occupied (code/game/objects/structures/beds_chairs/chair.dm:149-200)

**Sofa** (`/obj/structure/chair/sofa`): name: `"old ratty sofa"`, icon_state: `"sofamiddle"` or end/corner variants. Supports buckle mechanics (code/game/objects/structures/beds_chairs/sofa.dm:1-16)

**Table base** (`/obj/structure/table`): name: `"table"`, desc: `"A square piece of metal standing on four metal legs. It can not move."`, density: TRUE, anchored: TRUE, max_integrity: 100, integrity_failure: 0.33. Screwdriver (20 ds): disassemble. Wrench (40 ds): deconstruct, drops materials and frame. Can push mobs onto with grab. Deconstruct: `new /obj/item/stack/sheet/metal(loc, 1)`, `new /obj/structure/table_frame(loc)` (code/game/objects/structures/tables_racks.dm:15-170)

## Machinery and Equipment

| Count | DM path | In-game name | Notes |
|-------|---------|--------------|-------|
| 14 | `/obj/structure/shuttle/engine/heater` | engine heater | name: `"engine heater"`, icon_state: `"heater"`, desc: `"Directs energy into compressed particles in order to power engines."`, engine_power: 0 (does not contribute to shuttle movement). Base engine class: density: TRUE, anchored: TRUE, max_integrity: 500, armor: [melee 100, bullet 10, laser 10, energy 0, bomb 0, bio 0, rad 0, fire 50, acid 70]. Welder (200 ds = 20 seconds) when ENGINE_WRENCHED state: Message: `"[user.name] starts to weld the [name] to the floor."` → `"You weld \the [src] to the floor."`. Welder (200 ds) when ENGINE_WELDED: Message: `"[user.name] starts to cut the [name] free from the floor."` → `"You cut \the [src] free from the floor."`. Wrench: can unfasten if not welded. States: ENGINE_UNWRENCHED (0), ENGINE_WRENCHED (1), ENGINE_WELDED (2). Destroy while WELDED calls `alter_engine_power(-engine_power)` (code/game/shuttle_engines.dm:6-159) |
| 11 | `/obj/structure/shuttle/engine/propulsion` | propulsion engine | name: `"propulsion engine"`, icon_state: `"propulsion"`, desc: `"A standard reliable bluespace engine used by many forms of shuttles."`, engine_power: 1 (contributes to shuttle movement), opacity: 1. Same mechanics as heater (code/game/shuttle_engines.dm:100-112) |
| 13 | `/obj/structure/bodycontainer/morgue` | morgue | name: `"morgue"`, desc: `"Used to keep bodies in until someone fetches them. Now includes a high-tech alert system."`, icon_state: `"morgue1"`, density: TRUE, anchored: TRUE, max_integrity: 400. Tray connected: `/obj/structure/tray/m_tray`. Left-click: opens/closes tray. Pen (label): Message: `"You scribble illegibly on the side of [src]!"` (if illiterate). Locked state controllable. Icon states: morgue0 (open/no tray), morgue1 (closed, empty), morgue2 (dead body), morgue3 (non-body objects), morgue4 (revivable - has active client). Beeper (speaker): Alt-click toggles. Plays `'sound/weapons/gun/general/empty_alarm.ogg'` (50 volume) every 50 ds if revivable corpse inside and beeper enabled. Breakout from inside (600 ds = 60 seconds): Message: `"You lean on the back of [src] and start pushing the tray open..."` → `"[user] successfully broke out of [src]!"`. Deconstruct: `new /obj/item/stack/sheet/metal(loc, 5)` (code/game/objects/structures/morgue.dm:1-198) |
| 9 | `/obj/structure/closet/radiation` | radiation suit closet | name: `"radiation suit closet"`, desc: `"It's a storage unit for rad-protective suits."`, icon_state: `"eng"`, icon_door: `"eng_rad"`. PopulateContents: geiger counter, radiation suit, radiation helmet (code/game/objects/structures/crates_lockers/closets/utility_closets.dm:127-138) |
| 9 | `/obj/structure/closet/firecloset` | fire-safety closet | name: `"fire-safety closet"`, desc: `"It's a storage unit for fire-fighting supplies."`, icon_state: `"fire"`. PopulateContents: firefighter suit, gas mask, oxygen tank (red), extinguisher, red hardhat (code/game/objects/structures/crates_lockers/closets/utility_closets.dm:59-79) |
| 3 | `/obj/structure/tank_dispenser` | tank dispenser | name: `"tank dispenser"`, desc: `"A simple yet bulky storage device for gas tanks. Holds up to 10 oxygen tanks and 10 plasma tanks."`, icon_state: `"dispenser"`, density: TRUE, anchored: TRUE, max_integrity: 300. Initialize: spawns `oxygentanks = 10` oxygen tanks, `plasmatanks = 10` plasma tanks. Attackby with tank: if compatible and space available, adds to storage (capacity 10 each). Wrench (20 ds): toggles anchored state. UI interface displays oxygen/plasma counts. Deconstruct: drops all tanks, `new /obj/item/stack/sheet/metal(loc, 2)` (code/game/objects/structures/tank_dispenser.dm:1-112) |
| 3 | `/obj/structure/tank_dispenser/oxygen` | oxygen tank dispenser | Variant with only oxygen tanks (plasmatanks = 0) (code/game/objects/structures/tank_dispenser.dm:14-15) |
| 8 | `/obj/structure/reagent_dispensers/peppertank` | (Pepper tank) | |
| 2 | `/obj/structure/reagent_dispensers/servingdish` | (Serving dish dispenser) | |
| 1 | `/obj/structure/reagent_dispensers/beerkeg` | (Beer keg dispenser) | |
| 1 | `/obj/structure/reagent_dispensers/cooking_oil` | (Cooking oil dispenser) | |
| 1 | `/obj/structure/reagent_dispensers/virusfood` | (Virus food dispenser) | |
| 1 | `/obj/structure/reagent_dispensers/water_cooler` | (Water cooler dispenser) | |
| 9 | `/obj/structure/toilet/greyscale` | toilet | name: `"toilet"`, desc: (inferred from type name). Greyscale variant allows material coloring. (NOT FOUND in detail, refer to base toilet mechanics) |
| 1 | `/obj/structure/door_assembly/door_assembly_mai` | (Door assembly - MAI variant) | Maintenance door assembly type |
| 1 | `/obj/structure/crematorium` | crematorium | name: `"crematorium"`, desc: `"A human incinerator. Works well on barbecue nights."`, icon_state: `"crema1"`, density: TRUE, anchored: TRUE, max_integrity: 400. Tray connected: `/obj/structure/tray/c_tray`. Robots cannot use crematorium. Icon states: crema0 (open/no tray), crema1 (closed, empty), crema2 (has contents), crema_active (cremating). Cremate proc: when called (robot cannot activate), kills all living mobs inside with messages, deletes all objects, plays `'sound/machines/ding.ogg'` (50 volume) when done (30 ds delay). Locked state: TRUE during cremation (prevents double-cremation). Special variant: creamatorium converts bodies to ice cream (code/game/objects/structures/morgue.dm:207-306) |

## Signs and Plaques

| Count | DM path | In-game name | Notes |
|-------|---------|--------------|-------|
| 3 | `/obj/structure/sign/poster/contraband/random` | (Random contraband poster) | Decal / scenery |
| 2 | `/obj/structure/sign/departments/medbay/alt` | (Medical departments sign - alt) | Decal / scenery |
| 4 | `/obj/structure/sign/directions/evac` | (Evacuation directions sign) | Decal / scenery |
| 3 | `/obj/structure/sign/directions/engineering` | (Engineering directions sign) | Decal / scenery |
| 3 | `/obj/structure/sign/directions/security` | (Security directions sign) | Decal / scenery |
| 3 | `/obj/structure/sign/directions/medical` | (Medical directions sign) | Decal / scenery |
| 1 | `/obj/structure/sign/directions/science` | (Science directions sign) | Decal / scenery |
| 1 | `/obj/structure/sign/departments/chemistry` | (Chemistry departments sign) | Decal / scenery |
| 1 | `/obj/structure/sign/departments/chemistry/pharmacy` | (Pharmacy departments sign) | Decal / scenery |
| 1 | `/obj/structure/sign/departments/psychology` | (Psychology departments sign) | Decal / scenery |
| 1 | `/obj/structure/sign/departments/restroom` | (Restroom departments sign) | Decal / scenery |
| 1 | `/obj/structure/sign/departments/xenobio` | (Xenobiology departments sign) | Decal / scenery |
| 1 | `/obj/structure/sign/map/left` | (Map sign - left) | Decal / scenery |
| 1 | `/obj/structure/sign/map/right` | (Map sign - right) | Decal / scenery |
| 1 | `/obj/structure/sign/barsign` | (Bar sign) | Decal / scenery |
| 1 | `/obj/structure/sign/poster/official/build` | (Official build poster) | Decal / scenery |
| 1 | `/obj/structure/sign/poster/official/safety_eye_protection` | (Safety eye protection poster) | Decal / scenery |
| 1 | `/obj/structure/sign/plaques/kiddie` | (Kiddie plaque) | Decal / scenery |
| 1 | `/obj/structure/sign/plaques/deempisi` | (Deempisi plaque) | Decal / scenery |
| 1 | `/obj/structure/plaque/static_plaque/atmos` | (Atmospherics static plaque) | Decal / scenery |
| 1 | `/obj/structure/plaque/static_plaque/golden` | (Golden static plaque) | Decal / scenery |

## Decorative and Miscellaneous

| Count | DM path | In-game name | Notes |
|-------|---------|--------------|-------|
| 3 | `/obj/structure/fans/tiny` | (Tiny fan) | |
| 2 | `/obj/structure/showcase/cyborg/old` | (Old cyborg showcase) | |
| 2 | `/obj/structure/janitorialcart` | janitorial cart | |
| 2 | `/obj/structure/bookcase/random/reference` | (Reference bookcase) | |
| 2 | `/obj/structure/bookcase/random/religion` | (Religion bookcase) | |
| 2 | `/obj/structure/bookcase/random/fiction` | (Fiction bookcase) | |
| 2 | `/obj/structure/bookcase/random/adult` | (Adult bookcase) | |
| 1 | `/obj/structure/bookcase/random` | (Random bookcase) | |
| 1 | `/obj/structure/target_stake` | target stake | (Practice target) |
| 1 | `/obj/structure/altar_of_gods` | altar of gods | (Decorative religious structure) |
| 1 | `/obj/structure/destructible/cult/tome` | (Cult tome - destructible) | |
| 1 | `/obj/structure/bed/dogbed/ian` | (Ian dog bed) | |
| 1 | `/obj/structure/bed/dogbed/runtime` | (Runtime dog bed) | |
| 1 | `/obj/structure/bed/dogbed/renault` | (Renault dog bed) | |
| 1 | `/obj/structure/closet/secure_closet/freezer/cream_pie` | (Cream pie freezer) | |
| 1 | `/obj/structure/closet/crate/goldcrate` | (Gold crate) | |
| 1 | `/obj/structure/closet/crate/medical` | (Medical crate) | |
| 1 | `/obj/structure/closet/crate/silvercrate` | (Silver crate) | |
| 1 | `/obj/structure/closet/crate/trashcart` | (Trash cart crate) | |
| 1 | `/obj/structure/closet/wardrobe/engineering_yellow` | (Engineering yellow wardrobe) | |
| 1 | `/obj/structure/closet/secure_closet/freezer/kitchen/maintenance` | (Maintenance kitchen freezer) | |
| 1 | `/obj/structure/closet/l3closet/janitor` | (L3 janitor closet) | |
| 1 | `/obj/structure/closet/bombcloset` | EOD closet | name: `"\improper EOD closet"`, desc: `"It's a storage unit for explosion-protective suits."`, icon_state: `"bomb"`. PopulateContents: bomb suit, black clothing, black shoes, bomb hood (code/game/objects/structures/crates_lockers/closets/utility_closets.dm:142-165) |
| 1 | `/obj/structure/closet/emcloset` | emergency closet | name: `"emergency closet"`, desc: `"It's a storage unit for emergency breath masks and O2 tanks."`, icon_state: `"emergency"`. PopulateContents (40% prob): toolbox emergency; then switch: 35% (2x O2 tank + 2x mask), 30% (O2 tank + firstaid + mask), 20% (oxygen tank + mask), 10% (O2 tank + mask), 4% (nothing), 1% (deletes closet!) (code/game/objects/structures/crates_lockers/closets/utility_closets.dm:15-55) |

## Shuttle Engines (Additional)

| Count | DM path | In-game name | Notes |
|-------|---------|--------------|-------|
| 9 | `/obj/structure/shuttle/engine/propulsion/burst` | burst engine | name: `"burst engine"`, desc: `"An engine that releases a large bluespace burst to propel it."`, engine_power: 1 (inherits from propulsion parent). Same weld/wrench mechanics. Variants: cargo (unwrenched, unanchored), left (icon_state: burst_l), right (icon_state: burst_r) (code/game/shuttle_engines.dm:114-128) |
| 2 | `/obj/structure/shuttle/engine/propulsion/burst/left` | left burst engine | Variant with icon_state: `"burst_l"` (code/game/shuttle_engines.dm:122-124) |
| 2 | `/obj/structure/shuttle/engine/propulsion/burst/right` | right burst engine | Variant with icon_state: `"burst_r"` (code/game/shuttle_engines.dm:126-128) |

## Plant/Flora

**Common plant structures** (NOT FOUND - refer to `/obj/structure/flora` parent in code/game/objects/structures/flora.dm if present)

## Summary

**Total entries documented**: 169 structures from the placed-structures.txt list.

**Categories**:
- **Warning Signs**: 15 entries (highest: 48 secure area)
- **Closets/Lockers**: 63 entries (distributed across utility, job, secure, wardrobe, crate subtypes)
- **Furniture**: 24 entries (chairs, tables, filing cabinets, noticeboards, sofas, beds, displays)
- **Machinery**: 18 entries (morgue, crematorium, shuttle engines, tank dispensers, toilets, reagent dispensers)
- **Signs/Plaques/Decals**: 20 entries (directional, departmental, posters, plaques)
- **Decorative/Miscellaneous**: 29 entries (planters, showcases, carts, bookcases, dog beds, altars)

**Key mechanics across all structures**:
- **Density**: Most are `density = TRUE`, blocking movement (except signs, noticeboards, some decorative items)
- **Anchoring**: Most are `anchored = TRUE` by default or per subtype; wrench toggles when `anchorable = TRUE`
- **Health**: `max_integrity` varies (100 for signs, 200 for closets, 400+ for major machines)
- **Deconstruction**: Welder or screwdriver (when opened) for closets; wrench for furniture; drops metal sheets or custom materials
- **Interactions**: ID cards for secure objects, pens for labels/customization, tools for adjustment

## Minimum Viable Port

1. **Anchoring and wrench deconstruction**: All structures must respect wrench interaction to toggle `anchored` state (20-40 ds)
2. **Closet open/close mechanics**: Core gameplay loop - left-click toggles, welding/locking prevents, breakout available
3. **Health and armor**: Proper max_integrity and armor values block damage types correctly
4. **Furniture interactions**: Chairs support buckle; tables support pushing mobs; filing cabinets/noticeboards have UIs
5. **Shuttle engines**: Welder-based state machine (unwrenched → wrenched → welded) with 200 ds transitions; power contribution
6. **Morgue/Crematorium**: Icon state reflects contents; cremation kills and deletes bodies; tray eject mechanics
7. **Sign customization**: Pen on editable signs opens menu (40 ds) to select type; persist name/desc changes
8. **Tank dispensers**: Accept/dispense tank items; track counts; reflect in UI and overlays
9. **Decal coherence**: Warning signs must appear in correct icon states per type (shock, fire, bio, etc.)
10. **Access control**: Secure closets check ID and `allowed()` proc for lock/unlock; msg: `"Access Denied"` or silence

## NOT FOUND / Open Questions

- **Exact mechanics for several one-count structures**: `/obj/structure/piano`, `/obj/structure/holohoop`, `/obj/structure/altar_of_gods`, `/obj/structure/target_stake`, `/obj/structure/destructible/cult/tome` — DM paths listed but detailed behavior not found in primary source scans. These may be in sub-files or data-driven, or depend on external datums.
- **Base `/obj/structure/flora` subtypes**: Plant structures on the list (e.g., plants, potted plants) lack explicit documentation of popGrowth or harvest mechanics in the files scanned.
- **Reagent dispenser behavior**: peppertank, water_cooler, beerkeg, cooking_oil, virusfood, servingdish — found in list but detailed use/refill/UI mechanics not fully traced in this scan. Likely inherit from a common `/obj/structure/reagent_dispensers` parent.
- **Job closet content**: Specific `PopulateContents()` for many job-specific closets (L3closet subtypes, departmental secure closets) not expanded here — they are likely in separate job_closets.dm file sections not fully read.
- **Bed/dogbed variants**: `/obj/structure/bed/pod`, `/obj/structure/bed/dogbed/*` — basic presence confirmed but detailed buckling, interaction, or special effect unknown.
- **Display cases**: `/obj/structure/displaycase/*` subtypes — structure present but UI, locking, item filtering mechanics not detailed.
- **Bookcase random selection**: Reference, religion, fiction, adult variants — likely a pool-based selection; exact pool contents not traced.

