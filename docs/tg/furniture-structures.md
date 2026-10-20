# Furniture and Loose Structures

Loose structures that are decorative or seating, from tables to sinks to mirrors. Excludes closets/crates/lockers (done) and machinery that requires power. Includes tables, chairs/stools/beds, racks, signs, sinks, mirrors, extinguisher cabinets, reagent dispensers (fuel/water tanks), showers, toilets, and other loose furnishings commonly found on BoxStation.

---

### Table  `/obj/structure/table`  (code/game/objects/structures/tables_racks.dm:15)

- Anchored metal table with metal legs; you sit/place items on it
- Key vars: density = TRUE, anchored = TRUE, max_integrity = 100, can hold items you drag onto it (pixel-positioned), climbable
- Interactions:
  | held item / action | condition | delay (ds) | message(s) verbatim | result |
  |---|---|---|---|---|
  | Screwdriver | deconstruction_ready = TRUE | 20 | "You start disassembling [src]..." → (success) "You start disassembling [src]..." | deconstruct(TRUE) drops frame and metal sheet |
  | Wrench | deconstruction_ready = TRUE | 40 | "You start deconstructing [src]..." | deconstruct(TRUE, 1) drops rods instead of frame |
  | Any item (not INTENT_HARM) | player adjacent | — | silently | item placed on table, pixel_x/pixel_y set from click |
  | Drag another mob onto | INTENT_HELP, player adjacent, not buckled | 35 (do_after) | "[user] begins to place [pushed_mob] onto [src]..." | mob.set_resting(TRUE, TRUE), placed on table |
- Construction chain: NOT FOUND (tables must be built from table_frame)
- Deconstruction chain:
  - Step 1 (via screwdriver, 20 ds): drops /obj/structure/table_frame, drops buildstack (metal sheet)
  - Step 2 (via wrench, 40 ds): bypasses frame drop, drops framestack (/obj/item/stack/rods x2 by default) instead of frame
- Drops: when destroyed/broken: depends on deconstruction_ready flag; when destroyed (disassembled=FALSE): nothing; when deconstructed (disassembled=TRUE): new table_frame at loc UNLESS wrench_disassembly=1, then new framestack; buildstack (default /obj/item/stack/sheet/metal x1) always drops
- Health / armor: max_integrity = 100, integrity_failure = 0.33 (broken below 33%), armor = none listed, no special damage types listed
- Power: none
- Gotchas: climbable (players can climb onto it); deconstruction_ready defaults to 1 (can be deconstructed immediately); smooth = SMOOTH_TRUE (connects visually to adjacent tables); pass_flags = LETPASSTHROW (items can be thrown over density); can place items via click with pixel positioning

### Glass Table  `/obj/structure/table/glass`  (code/game/objects/structures/tables_racks.dm:283)

- Transparent table that breaks when stepped on by living mobs
- Key vars: max_integrity = 70, armor = high fire/acid, buildstack = /obj/item/stack/sheet/glass, debris = list of frame + shard
- Interactions:
  | held item / action | condition | delay (ds) | message(s) verbatim | result |
  |---|---|---|---|---|
  | Crossed (mob walks onto it) | not NODECONSTRUCT, mob has gravity, mob_size > SMALL, not flying | — | "[src] breaks!" | table_shatter() drops debris and deletes table |
  | thrown onto (mid-air) | — | 5 (addtimer) | — | check_break() runs 5 ds later |
- Construction chain: NOT FOUND
- Deconstruction chain: same as parent table
- Drops: when deconstructed properly: glass sheet + table_frame; when broken (disassembled=FALSE): table_frame + shard
- Health / armor: max_integrity = 70, armor = melee/bullet/laser/energy/bomb = 0, fire = 80, acid = 100; ACID_PROOF flag
- Power: none
- Gotchas: stepping on it with sufficient weight (MOB_SIZE > SMALL, has gravity, not flying) causes breakage; shard thrown at crossing mob with throw_impact()

### Wooden Table  `/obj/structure/table/wood`  (code/game/objects/structures/tables_racks.dm:361)

- Wooden table; same structure as metal but flammable
- Key vars: max_integrity = 70, buildstack = /obj/item/stack/sheet/mineral/wood, FLAMMABLE
- Interactions: same as parent table
- Drops: wooden sheets instead of metal
- Health / armor: max_integrity = 70, FLAMMABLE flag set
- Power: none
- Gotchas: FLAMMABLE; narsie_act() does not convert it

### Reinforced Table  `/obj/structure/table/reinforced`  (code/game/objects/structures/tables_racks.dm:465)

- Heavy table requiring welder first; deconstruction_ready = FALSE initially (locked)
- Key vars: max_integrity = 200, armor = melee 10, bullet/laser 30, energy 100, buildstack = /obj/item/stack/sheet/plasteel, deconstruction_ready = 0
- Interactions:
  | held item / action | condition | delay (ds) | message(s) verbatim | result |
  |---|---|---|---|---|
  | Welder | deconstruction_ready = TRUE | 50 | "You start strengthening the reinforced table..." → "[user] strengthen[s] the table." | sets deconstruction_ready = 0 (re-locks) |
  | Welder | deconstruction_ready = FALSE | 50 | "You start weakening the reinforced table..." → "You weaken the table." | sets deconstruction_ready = 1 (unlocks) |
  | Screwdriver/Wrench | deconstruction_ready = TRUE | as parent | as parent | normal table deconstruction |
- Health / armor: max_integrity = 200, armor high across melee/bullet/laser, integrity_failure = 0.25
- Power: none
- Gotchas: must unlock with welder (50 ds) before screwdriver/wrench work; welding while unlocked re-locks it

### Rack  `/obj/structure/rack`  (code/game/objects/structures/tables_racks.dm:569)

- Storage shelf for items; lighter than tables
- Key vars: density = TRUE, anchored = TRUE, max_integrity = 20, layer = TABLE_LAYER
- Interactions:
  | held item / action | condition | delay (ds) | message(s) verbatim | result |
  |---|---|---|---|---|
  | Wrench | INTENT != HELP | — | (tool sound) | deconstruct(TRUE) → new /obj/item/rack_parts at loc |
  | Kick (attack_hand) | user has 2+ legs, standing | — | "[user] kicks [src]." | damage = 4-8 BRUTE |
  | Drag item onto (not attack_hand) | — | — | silently | item moves to rack turf |
- Construction chain: NOT FOUND (built from rack_parts)
- Deconstruction chain: Step 1 (wrench): drops rack_parts (one item)
- Drops: deconstruct(TRUE) → new /obj/item/rack_parts; deconstruct(FALSE) → just deleted with no drop; density = FALSE when deconstructed
- Health / armor: max_integrity = 20, no armor listed
- Power: none
- Gotchas: very low health (20); can be kicked by any living mob with 2+ legs; rack_parts must be used to rebuild

### Rack Parts  `/obj/item/rack_parts`  (code/game/objects/structures/tables_racks.dm:656)

- Dismantled rack; can be reassembled or turned into metal sheet
- Key vars: name = "rack parts", custom_materials = /datum/material/iron = 2000
- Interactions:
  | held item / action | condition | delay (ds) | message(s) verbatim | result |
  |---|---|---|---|---|
  | Wrench | — | (tool sound) | — | new /obj/item/stack/sheet/metal at user.loc, delete rack_parts |
  | attack_self | building = FALSE | 50 (do_after) | "You start constructing a rack..." → "[user] assembles \a [R]." | new /obj/structure/rack at user.loc, delete rack_parts |
- Drop: item → metal sheet (wrench) or structure (self-assembly)
- Gotchas: building flag prevents repeat assembly while in progress

---

### Chair  `/obj/structure/chair`  (code/game/objects/structures/beds_chairs/chair.dm:1)

- Standard metal chair; can buckle mobs sitting
- Key vars: anchored = TRUE, can_buckle = TRUE, buckle_lying = 0 (sitting, not lying), max_integrity = 250, custom_materials = /datum/material/iron = 2000
- Interactions:
  | held item / action | condition | delay (ds) | message(s) verbatim | result |
  |---|---|---|---|---|
  | Wrench | not NODECONSTRUCT | — | (tool sound) | deconstruct() drops buildstack (/obj/item/stack/sheet/metal x1) |
  | Shock Kit (special item) | — | — | (deconstruct sound) | new /obj/structure/chair/e_chair, SK becomes part, old chair deleted |
  | Alt-click (rotate) | user adjacent, not buckled | — | silently | setDir(turn(dir,-90)), rotates chair |
  | Drag mob onto (buckle) | mob standing on chair | — | "[user] begins to place [carried_mob] onto [src]..." | buckles mob, lying = 0, sets layer per dir |
- Construction chain: NOT FOUND
- Deconstruction chain: Step 1 (wrench): drops buildstack
- Drops: deconstruct(disassembled=TRUE) → buildstack (/obj/item/stack/sheet/metal x1)
- Health / armor: max_integrity = 250, no armor listed
- Power: none
- Gotchas: simple_rotation component added (ROTATION_ALTCLICK | ROTATION_CLOCKWISE); buckle_lying = 0 means people sit, not lay; layer changes to ABOVE_MOB_LAYER if dir == NORTH and has buckled mobs

### Chair, Wooden  `/obj/structure/chair/wood`  (code/game/objects/structures/beds_chairs/chair.dm:132)

- Wooden chair
- Key vars: max_integrity = 70, buildstackamount = 3 (more expensive than metal), buildstacktype = /obj/item/stack/sheet/mineral/wood, FLAMMABLE
- Drops: wooden sheets x3
- Gotchas: FLAMMABLE; narsie_act() does nothing

### Chair, Comfy  `/obj/structure/chair/comfy`  (code/game/objects/structures/beds_chairs/chair.dm:149)

- Padded chair with armrests; colored variants (brown, beige, black, teal, lime)
- Key vars: max_integrity = 70, FLAMMABLE, buildstackamount = 2, item_chair = null (cannot be picked up), color = rgb(255,255,255) default, mutable_appearance for armrest
- Interactions: armrest overlay appears when buckled
- Drops: buildstack (metal x2)
- Gotchas: item_chair = null prevents pickup via MouseDrop; armrest is drawn as overlay

### Chair, Comfy Shuttle  `/obj/structure/chair/comfy/shuttle`  (code/game/objects/structures/beds_chairs/chair.dm:201)

- Secure shuttle seat
- Key vars: buildstacktype = /obj/item/stack/sheet/mineral/titanium
- Drops: titanium sheets x2

### Chair, Office  `/obj/structure/chair/office`  (code/game/objects/structures/beds_chairs/chair.dm:210)

- Rolling office chair (not anchored); can move around
- Key vars: anchored = FALSE, buildstackamount = 5, item_chair = null
- Interactions: playsound('sound/effects/roll.ogg') when moved with gravity
- Gotchas: not anchored, movable; high buildstack cost (5 sheets)

### Stool  `/obj/structure/chair/stool`  (code/game/objects/structures/beds_chairs/chair.dm:227)

- Small seat without backrest; cannot buckle
- Key vars: can_buckle = FALSE, name = "stool", buildstackamount = 1, item_chair = /obj/item/chair/stool (can be picked up)
- Interactions: MouseDrop onto user removes stool structure and creates /obj/item/chair/stool in user hands
- Drops: buildstack (metal x1)
- Gotchas: can be picked up via MouseDrop; low health and buildstack

### Chair Item  `/obj/item/chair`  (code/game/objects/structures/beds_chairs/chair.dm:258)

- Chair placed on ground; can be wielded as weapon or planted
- Key vars: w_class = WEIGHT_CLASS_HUGE, force = 8, throwforce = 10, throw_range = 3, break_chance = 5, hitsound = 'sound/items/trayhit1.ogg'
- Interactions:
  | action | condition | delay (ds) | message | result |
  |---|---|---|---|---|
  | attack_self | — | — | — | plant(user) → places chair structure on ground |
  | afterattack (on target) | prob(break_chance) | — | "[user] smashes \the [src] to pieces against \the [target]" | smash() → drops partial buildstack (buildstackamount - 1) |
  | hit_reaction (block) | prob(hit_reaction_chance) | — | "[owner] fends off [attack_text] with [src]!" | blocks attack if unarmed |
- Gotchas: break_chance = 5 (5% chance to break on attack); wood chairs have break_chance = 50 (much more fragile); stools have break_chance = 0 (unbreakable)

---

### Bed  `/obj/structure/bed`  (code/game/objects/structures/beds_chairs/bed.dm:10)

- Standard medical/bunk bed
- Key vars: anchored = TRUE, can_buckle = TRUE, buckle_lying = 90 (lying down), max_integrity = 100, buildstacktype = /obj/item/stack/sheet/metal, buildstackamount = 2, FLAMMABLE
- Interactions:
  | held item / action | condition | delay (ds) | message(s) verbatim | result |
  |---|---|---|---|---|
  | Wrench | not NODECONSTRUCT | — | (tool sound) | deconstruct(TRUE) drops buildstack |
- Construction chain: NOT FOUND
- Deconstruction chain: Step 1 (wrench): drops buildstack
- Drops: deconstruct(disassembled=TRUE) → buildstack (metal x2)
- Health / armor: max_integrity = 100, FLAMMABLE
- Power: none
- Gotchas: buckle_lying = 90 means buckling mobs lie down (different from chairs); bolts = TRUE (examined as "held together by bolts")

### Roller Bed  `/obj/structure/bed/roller`  (code/game/objects/structures/beds_chairs/bed.dm:49)

- Mobile bed that folds into item form
- Key vars: anchored = FALSE, icon_state = "down", foldabletype = /obj/item/roller (folded form)
- Interactions:
  | action | condition | delay (ds) | message(s) verbatim | result |
  |---|---|---|---|---|
  | MouseDrop (onto user) | user adjacent, user human, not buckled | — | "[usr] collapses \the [src.name]." | new /obj/item/roller at turf, placed in user hands, bed deleted |
  | Crossed (someone steps on it) | — | — | (roll sound) | playsound('sound/effects/roll.ogg') |
  | Dock with robo roller (on attackby) | robo roller not loaded | — | "[user] collect[s] [src]." | bed forceMove into robo roller, robo.loaded = bed |
- Drops: when MouseDropped by user → /obj/item/roller item
- Health / armor: max_integrity = 100 (inherited), not anchored
- Power: none
- Gotchas: density = TRUE when has buckled mob, FALSE when empty (blocks/unblocks movement); icon_state changes "down"/"up" based on occupancy; can dock with robo roller items

### Roller Bed Item  `/obj/item/roller`  (code/game/objects/structures/beds_chairs/bed.dm:106)

- Collapsed roller bed item; portable stretcher
- Key vars: w_class = WEIGHT_CLASS_NORMAL, foldabletype (default nothing)
- Interactions:
  | action | condition | delay (ds) | message(s) verbatim | result |
  |---|---|---|---|---|
  | attack_self (in inventory) | — | — | — | deploy_roller(user, user.loc) → new /obj/structure/bed/roller |
  | afterattack (on floor) | proximity, open turf | — | — | deploy_roller(user, target) → new /obj/structure/bed/roller at target |
- Drops: activating → /obj/structure/bed/roller at location
- Gotchas: robo variant (robo dock for emergency ejection) starts with loaded = new /obj/structure/bed/roller inside; transfers to robo as persistent storage

---

### Rack Parts → combined with Rack above

---

### Sign (Structure)  `/obj/structure/sign/blank`  (code/game/objects/structures/signs/_signs.dm:19)

- Wall-mounted plastic sign backing; editable with pen
- Key vars: anchored = TRUE, opacity = 0, density = FALSE, max_integrity = 100, custom_materials = /datum/material/plastic = 2000, is_editable = TRUE, buildable_sign = TRUE
- Interactions:
  | held item / action | condition | delay (ds) | message(s) verbatim | result |
  |---|---|---|---|---|
  | Wrench | buildable_sign = TRUE | 40 (4 SECONDS) | "[user] starts removing [src]..." → "You start unfastening [src]." → "[user] unfastens [src]." | unwrenches sign → /obj/item/sign with name/desc/icon_state transferred, structure deleted |
  | Welder | obj_integrity < max_integrity | 40 (4 SECONDS) | "[user] starts repairing [src]..." → "[user] finishes repairing [src]." | obj_integrity = max_integrity |
  | Pen | is_editable = TRUE | 40 (4 SECONDS do_after) | "[user] begins changing [src]." → "[user] finishes changing the sign." | input() for editable_sign_types, new sign of chosen type spawned at same pixel location |
  | attack_hand | — | — | — | examinate(user) |
- Construction chain: NOT FOUND
- Deconstruction chain: wrench-removal (not true deconstruction) → /obj/item/sign item at user turf
- Drops: when deconstructed by wrench: /obj/item/sign item
- Health / armor: max_integrity = 100, armor = melee/fire/acid 50
- Power: none
- Gotchas: buildable_sign = TRUE allows unwrenching; is_editable = TRUE allows pen customization; sign_change_name used for UI category; many subtypes with fixed icon_states (warning, department, map, etc.) are not editable (is_editable = FALSE in those types)

### Sign Item  `/obj/item/sign`  (code/game/objects/structures/signs/_signs.dm:26)

- Portable sign; can be placed on walls or floor
- Key vars: w_class = WEIGHT_CLASS_NORMAL, custom_materials = /datum/material/plastic = 2000, sign_path = /obj/structure/sign/blank (default), is_editable = TRUE
- Interactions:
  | action | condition | delay (ds) | message(s) verbatim | result |
  |---|---|---|---|---|
  | afterattack (on wall) | proximity, wall turf | — | — | new sign_path structure placed at user turf, pixel-shifted toward wall, placed_sign.setDir(dir toward wall) |
  | Pen | is_editable = TRUE | 40 (4 SECONDS do_after) | "You begin changing [src]." → "You finish changing the sign." | input() popup, name/desc/icon_state/sign_path updated to new type |
  | Welder (repair) | obj_integrity < max_integrity | 40 (4 SECONDS) | "[user] starts repairing [src]..." → "[user] finishes repairing [src]." | obj_integrity = max_integrity |
- Drops: item in inventory; afterattack places structure
- Gotchas: placed horizontally on ground (90° rotation in transform); wall placement pixel-shifts based on wall direction (NORTH = +32 y, SOUTH = -32 y, EAST = +27 x, WEST = -27 x)

---

### Sink  `/obj/structure/sink`  (code/game/objects/structures/watercloset.dm:243)

- Wash station for cleaning hands/face/items; can fill containers with water
- Key vars: anchored = TRUE, density = FALSE, buildstacktype = /obj/item/stack/sheet/metal, buildstackamount = 1, busy = FALSE, dispensedreagent = /datum/reagent/water
- Interactions:
  | held item / action | condition | delay (ds) | message(s) verbatim | result |
  |---|---|---|---|---|
  | attack_hand (wash) | user carbon, adjacent, not busy | 40 | "[user] starts washing [user.p_their()] [face/hands]..." → "[user] washes [user.p_their()] [face/hands] using [src]." | if head zone selected: cleans face (COMSIG_COMPONENT_CLEAN_FACE_ACT), removes lipstick, wakes user up (drowsyness -= 2-3); else: washed() |
  | Refillable container (attackby) | container not full | — | "[user] fill[s] [RG] from [src]." | container.reagents.add_reagent(/datum/reagent/water, min(volume_space, amount_per_transfer)) |
  | Mop (attackby) | — | — | "[user] wet[s] [O] in [src]." | O.reagents.add_reagent(/datum/reagent/water, 5) |
  | Baton (active, attackby) | B.cell.charge && B.turned_on | — | "[user] shocks [user.p_them()]self..." | user.Paralyze(B.stun_time), user.stuttering = stun_time/20, B.deductcharge(), playsound |
  | Gauze stack (attackby) | — | — | "You tear off a strip of gauze and make a rag." | new /obj/item/reagent_containers/glass/rag at loc, G.use(1) |
  | Ore/glass (attackby) | /obj/item/stack/ore/glass | — | "You wet the sand in the sink and form it into a block." | new /obj/item/stack/sheet/sandblock, O.use(1) |
  | Any item (attackby, not HARM) | — | 40 | "You start washing [O]..." → "[user] washes [O] using [src]." | O.washed(), O.acid_level = 0, expose to water |
  | Wrench (attackby) | not NODECONSTRUCT | — | (tool sound) | deconstruct() → drop_materials() |
- Construction chain: NOT FOUND
- Deconstruction chain: Step 1 (wrench): drops buildstack or custom_materials
- Drops: deconstruct() → buildstack (metal x1)
- Health / armor: no max_integrity listed
- Power: none
- Gotchas: busy flag prevents concurrent washing; busy = TRUE for 40 ds during wash; dispensedreagent = water (changeable per subtype); kitchen sink subtype (icon_state "sink_alt"); puddle subtype exists (decorative)

### Kitchen Sink  `/obj/structure/sink/kitchen`  (code/game/objects/structures/watercloset.dm:384)

- Same as sink with different icon
- Key vars: icon_state = "sink_alt"

---

### Toilet  `/obj/structure/toilet`  (code/game/objects/structures/watercloset.dm:1)

- Porcelain waste disposal with lid and hidden cistern storage
- Key vars: anchored = TRUE, density = FALSE, open = 0/1 (lid up/down), cistern = 0/1 (cistern cover open/closed), w_items = total w_class stored, swirlie = mob being attacked, buildstacktype = /obj/item/stack/sheet/metal, buildstackamount = 1
- Interactions:
  | action | condition | delay (ds) | message(s) verbatim | result |
  |---|---|---|---|---|
  | attack_hand | — | — | "You slam the toilet seat onto [swirlie]'s head!" or "[user] kick[s] [src]." or toggles lid | swirlie takes 5 brute; or swirlie = null; or open = !open |
  | Grab + aggressive (attack_hand, attack) | mob on toilet, grab_state >= GRAB_AGGRESSIVE | 30 | "[user] gives [GM] a swirlie!" or "[user] slam[s] [GM] into [src]!" | do_after 30 ds, if successful: GM takes 5 oxy loss, mark swirlie = null; or GM takes 5 brute without do_after |
  | attack_hand (cistern) | cistern = TRUE, not open, CanReach | — | "You find [I] in the cistern." | pick random item from contents, move to user hands or drop, w_items -= I.w_class |
  | Crowbar (attackby) | — | 30 | "[user] [lift/replace] the lid [on/off] the cistern!" | cistern = !cistern, update icon |
  | Wrench (attackby) | not NODECONSTRUCT | — | (tool sound) | deconstruct() |
  | Item placed (attackby, cistern open) | item.w_class <= WEIGHT_CLASS_NORMAL, w_items + w_class <= WEIGHT_CLASS_HUGE | — | "You carefully place [I] into the cistern." | I.transferItemToLoc(src), w_items += I.w_class |
  | Reagent container (attackby, not cistern) | container.is_refillable() | — | "You fill [RG] from [src]. Gross." | RG.reagents.add_reagent(/datum/reagent/water, min(space, amount_per_transfer)) |
- Construction chain: NOT FOUND
- Deconstruction chain: Step 1 (wrench): drops buildstack
- Drops: deconstruct() → buildstack (metal x1); items in cistern stay in cistern until opened
- Health / armor: no max_integrity listed
- Power: none
- Gotchas: open = random(0,1) on Initialize(); lid and cistern are separate (icon_state = "toilet[open][cistern]" → 4 states); swirlie auto-nulls after do_after or if player dies; cistern storage is hidden until crowbar opens it; items max WEIGHT_CLASS_HUGE total

### Urinal  `/obj/structure/urinal`  (code/game/objects/structures/watercloset.dm:145)

- Drainage fixture; stores urinal cake by default
- Key vars: anchored = TRUE, density = FALSE, exposed = 0/1 (cap open/closed), hiddenitem = /obj/item/reagent_containers/food/snacks/urinalcake (default)
- Interactions:
  | action | condition | delay (ds) | message(s) verbatim | result |
  |---|---|---|---|---|
  | attack_hand (grab + aggressive) | user grab_state >= GRAB_AGGRESSIVE, mob on urinal | — | "[user] slams [GM] into [src]!" | GM takes 8 brute |
  | attack_hand (get item) | exposed = TRUE, hiddenitem exists | — | "You fish [hiddenitem] out of the drain enclosure." | hiddenitem to user hands or drop, hiddenitem = null |
  | Screwdriver (attackby) | — | 20 | "[user] [unscrew/screw] the cap [to/from] the drain [protector/]..." | exposed = !exposed |
  | Item placed (attackby, exposed) | exposed = TRUE, no item already stored, item.w_class <= WEIGHT_CLASS_SMALL | — | "You place [I] into the drain enclosure." | I.transferItemToLoc(src), hiddenitem = I |
- Construction chain: NOT FOUND
- Deconstruction chain: NOT FOUND
- Drops: NOT FOUND (presumed delete on break)
- Health / armor: no max_integrity listed
- Power: none
- Gotchas: exposed toggles with screwdriver (20 ds), not wrench; only stores one SMALL item at a time; hiddenitem always present initially (cake)

---

### Mirror  `/obj/structure/mirror`  (code/game/objects/structures/mirror.dm:2)

- Breakable reflective surface; allows hair/facial hair customization (UI not needed per spec)
- Key vars: anchored = TRUE, density = FALSE, max_integrity = 200, integrity_failure = 0.5, broken = FALSE, icon_state = "mirror" or "mirror_broke"
- Interactions:
  | action | condition | delay (ds) | message(s) verbatim | result |
  |---|---|---|---|---|
  | attack_hand (hair UI) | human, not broken, adjacent | — | input() for hairstyle/facial hair UI | if male: facial hair input; then hairstyle input; H.update_hair() |
  | Damage (brute/burn) | broken = FALSE, not NODECONSTRUCT | — | playsound(shatter), "[src] breaks!" | obj_break() sets icon_state = "mirror_broke", broken = TRUE, desc updated |
  | Welder (attackby) | broken = TRUE | 10 | "[user] repair[s] [src]." | broken = FALSE, icon_state = initial, desc = initial |
- Construction chain: NOT FOUND
- Deconstruction chain: Step 1 (natural break or damage): drops nothing; Step 2 (manual deconstruct via UI or code, disassembled=FALSE): new /obj/item/shard; deconstruct(disassembled=TRUE): nothing
- Drops: when destroyed (broken): /obj/item/shard; when deconstructed: nothing
- Health / armor: max_integrity = 200, integrity_failure = 0.5 (broken below 50%)
- Power: none
- Gotchas: breaking changes examine message to "Oh no, seven years of bad luck!"; broken state persists until welded (10 ds to repair); player damage sounds: hit_on_shattered_glass for both brute and burn

---

### Extinguisher Cabinet  `/obj/structure/extinguisher_cabinet`  (code/game/objects/structures/extinguisher.dm:1)

- Wall-mounted cabinet storing fire extinguisher; toggleable door
- Key vars: anchored = TRUE, density = FALSE, max_integrity = 200, integrity_failure = 0.25, stored_extinguisher = null, opened = FALSE
- Interactions:
  | action | condition | delay (ds) | message(s) verbatim | result |
  |---|---|---|---|---|
  | attack_hand (take extinguisher) | stored_extinguisher exists, opened = TRUE | — | "You take [stored_extinguisher] from [src]." | user.put_in_hands(stored_extinguisher), stored_extinguisher = null, update_icon(), if was closed: opened = 1, playsound('sound/machines/click.ogg') |
  | attack_hand (toggle) | opened = FALSE OR stored_extinguisher = null | — | — | playsound(click), opened = !opened, update_icon() |
  | attack_tk (telekinesis) | stored_extinguisher exists | — | "[user] telekinetically remove[s] [stored_extinguisher] from [src]." | stored_extinguisher.forceMove(loc), stored_extinguisher = null, opened = 1, playsound(click), update_icon() |
  | attack_paw | — | — | — | calls attack_hand |
  | AltClick (toggle) | user adjacent, user can use topic | — | — | toggle_cabinet(user) |
  | attackby (extinguisher item) | istype(I, /obj/item/extinguisher), opened = TRUE, !stored_extinguisher | — | "You place [I] in [src]." | user.transferItemToLoc(I, src), stored_extinguisher = I, update_icon() |
  | Wrench (attackby) | !stored_extinguisher | 60 (use_tool) | "You start unsecuring [name]..." → "You unsecure [name]." | deconstruct(TRUE) |
- Construction chain: NOT FOUND
- Deconstruction chain: Step 1 (wrench, empty only): new /obj/item/wallframe/extinguisher_cabinet
- Drops: deconstruct(disassembled=TRUE) → /obj/item/wallframe/extinguisher_cabinet; deconstruct(disassembled=FALSE) → /obj/item/stack/sheet/metal x2; stored extinguisher always forceMove(loc) if present
- Health / armor: max_integrity = 200, integrity_failure = 0.25
- Power: none
- Gotchas: opened = FALSE initially unless building=TRUE (during construction); damage breaks the cabinet: broken = 1, opened = 1, extinguisher ejected; icon_state changes: "extinguisher_closed"/"full"/"mini"/"empty" based on opened and stored_extinguisher type

---

### Shower  `/obj/machinery/shower`  (code/game/objects/structures/shower.dm:5)

- Water shower; adjustable temperature (NORMAL/FREEZING/BOILING); washes atoms that cross it
- Key vars: density = FALSE, use_power = NO_POWER_USE, on = FALSE, current_temperature = SHOWER_NORMAL, reaction_volume = 200, soundloop, reagent_id = /datum/reagent/water
- Interactions:
  | action | condition | delay (ds) | message(s) verbatim | result |
  |---|---|---|---|---|
  | interact (any mob, switch on/off) | — | — | — | on = !on, update_icon(), handle_mist(), if on: START_PROCESSING, soundloop.start(); else: soundloop.stop(), turf.MakeSlippery(WATER) |
  | Wrench (attackby, adjust temperature) | — | 50 | "You begin to adjust the temperature valve..." → "[user] adjusts the shower..." | cycles current_temperature: NORMAL→FREEZING→BOILING→NORMAL |
  | Analyzer (attackby) | — | — | "The water temperature seems to be [current_temperature]." | passive info |
  | Crossed (on, any atom) | on = TRUE | — | — | wash_atom(AM) |
- Process (active): wash_atom(loc) and all contents, check_heat for living mobs (adjust_bodytemperature: freezing -80, boiling +35 + 5 fire loss)
- Construction chain: NOT FOUND
- Deconstruction chain: Step 1: new /obj/item/stack/sheet/metal x3, delete
- Drops: deconstruct() → /obj/item/stack/sheet/metal x3
- Health / armor: no max_integrity listed; use_power = NO_POWER_USE (doesn't require power)
- Power: NO_POWER_USE
- Gotchas: mist effect spawns 5 sec after turning on (if not FREEZING), disappears 25 sec after turning off; freezing temperature skips mist creation; boiling temperature causes fire damage (5 per process tick); damage from heat is per-tick while process runs; washed() and reagents.expose() called on all atoms that cross

---

### Reagent Dispensers (Base)  `/obj/structure/reagent_dispensers`  (code/modules/reagents/reagent_dispenser.dm:1)

- Bulk liquid storage; movable by default; explodes on damage if full
- Key vars: density = TRUE, anchored = FALSE (movable!), tank_volume = 1000 (default), reagent_id = /datum/reagent/water (subtype-dependent), max_integrity = 300, create_reagents(tank_volume) on init
- Interactions:
  | action | condition | delay (ds) | message(s) verbatim | result |
  |---|---|---|---|---|
  | Damage (bullet/laser) | tank_volume > 0, obj_integrity > 0 | — | "[src] ruptures!" | boom() → chem_splash(loc, 5) with reagents, delete |
  | deconstruct | disassembled = FALSE, tank_volume > 0 | — | "[src] ruptures!" | boom() |
  | deconstruct | disassembled = TRUE | — | — | delete without explosion |
- Construction chain: NOT FOUND
- Deconstruction chain: (only if disassembled=TRUE, otherwise boom): delete
- Drops: boom() causes chem_splash and deletion (no physical drops)
- Health / armor: max_integrity = 300
- Power: none
- Gotchas: anchored = FALSE (can be moved/pushed); explosion triggered by bullet/laser if full; pressure_resistance = 2*ONE_ATMOSPHERE (structural); DRAINABLE | AMOUNT_VISIBLE reagent flags set on init

### Fuel Tank  `/obj/structure/reagent_dispensers/fueltank`  (code/modules/reagents/reagent_dispenser.dm:61)

- Volatile fuel storage; explosions on any damage, fire, electricity, or projectile damage
- Key vars: reagent_id = /datum/reagent/fuel, tank_volume = 1000 (default), icon_state = "fuel"
- Interactions:
  | action | condition | delay (ds) | message(s) verbatim | result |
  |---|---|---|---|---|
  | Welder (attackby) | fuel in tank | — | (fill sound) | W.reagents.trans_to(welder, welder.max_fuel), welder icon updated |
  | Any damage (fire, bullet/laser, zap, ex_act) | — | — | — | boom() → explosion(turf, 0, 1, 5, flame_range=5), delete |
  | Blob act | — | — | — | boom() |
  | Welder attack (catastrophic fail) | welder active during refill | — | "[user] catastrophically fails at refilling [I.name]!" | boom() immediately |
- Drops: boom() causes explosion and deletion
- Gotchas: explosion parameters: 0 light, 1 medium, 5 heavy, 5 flame_range; ANY damage type triggers boom (fire_act, zap_act, ex_act, bullet_act, blob_act); active welder refill causes boom if attempted

### Water Tank  `/obj/structure/reagent_dispensers/watertank`  (code/modules/reagents/reagent_dispenser.dm:43)

- Non-explosive water storage; refillable containers use afterattack
- Key vars: reagent_id = /datum/reagent/water, tank_volume = 1000, icon_state = "water", anchored = FALSE
- Interactions: containers can refill via afterattack (standard) → reagents.trans_to(container, amount)
- Drops: none (doesn't explode)
- Gotchas: movable (anchored = FALSE)

### Water Tank, High-Capacity  `/obj/structure/reagent_dispensers/watertank/high`  (code/modules/reagents/reagent_dispenser.dm:48)

- Massive water tank
- Key vars: tank_volume = 100000 (100x normal), icon_state = "water_high"

---

## Minimum viable port

1. Tables: construction from frames (20 ds per sheet), deconstruction with screwdriver/wrench (20 ds / 40 ds), dropping materials
2. Chairs: buckle system with rotating, deconstruction dropping metal, ability to pick up small stools as items
3. Beds: buckle lying-down, roller beds that fold/unfold, storage/retrieval
4. Racks: very low health, wrench deconstruction into parts item, parts reassembly
5. Signs: wall mounting with wrench removal (40 ds), editable text with pen, hung on walls with pixel offsets
6. Sinks: washing UI for hands/face, filling refillable containers with water, washing items (40 ds)
7. Mirrors: breakage on step/damage, repair with welder (10 ds), hair customization UI (optional—spec excludes UI)
8. Extinguisher cabinet: toggling door, storing/removing extinguisher, wrench deconstruction when empty
9. Fuel tank: explosion on any damage (explosion params: 0, 1, 5, flame_range=5), refilling welders
10. Water tank: simple refillable liquid dispenser

## NOT FOUND / open questions

- Construction chain for tables (are they built from frames on-site or only placed?)
- Construction/deconstruction for mirror, urinal, toilet (wrench vs special tools)
- Deconstruction drops for shower, urinal, toilet, registry dispenser subtypes (do they drop anything?)
- Whether chairs/beds/tables use the "custom_materials" system or fixed material lists
- Specific details on sign placement wall-facing rules and pixel offset calculation
- Plaques, statues, kitchen spike, filing cabinet, dresser, noticeboard, curtain details (listed as NOT FOUND per task scope)
- Toilet cistern hidden storage max capacity (WEIGHT_CLASS_HUGE limit not clearly tied to units)
