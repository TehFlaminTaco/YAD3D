# Storage Items and Contents (TG 2020-07-06)

Documentation of 117 storage container items from Space Station 13's tgstation code, their storage component configuration, and exact spawn contents. Covers toolboxes, backpacks, boxes, belts, satchels, briefcases, folders, and other portable storage.

Storage component configuration is defined in `/datum/component/storage`, initialized per-item in `ComponentInitialize()`. Key configuration variables: `max_w_class` (largest single item by WEIGHT_CLASS), `max_combined_w_class` (total capacity), `max_items` (slot count), `can_hold` and `cant_hold` lists (type restrictions), `rustle_sound` (audible when accessing), `allow_quick_empty` (empty verb), `allow_quick_gather` (toggle gathering mode), `quickdraw` (altclick convenience).

Contents are populated in `PopulateContents()` which runs at Initialize (code/game/objects/items/storage/storage.dm:46). Items wear in inventory, fit in containers if within w_class limits, or drop to floor if containers reject them.

All delays in deciseconds (10 ds = 1 second). All paths relative to tgstation root. All quotes verbatim from source.

## Base Storage Class

### Storage container `/obj/item/storage`  `code/game/objects/items/storage/storage.dm:1`

Base class for all portable storage. Initializes component_type `/datum/component/storage/concrete` in `ComponentInitialize()` (line 15). Disallows drop via `AllowDrop() = FALSE` (line 18). PopulateContents is empty stub (line 46) overridden per subtype. Blocks contents explosion with `contents_explosion()` proc (line 21-29). Rummaging: if `rummage_if_nodrop = TRUE` (default), allows viewing contents via quick-access if nodrop trait present (line 33-41).

---

## Toolboxes

### mechanical toolbox `/obj/item/storage/toolbox/mechanical`  `code/game/objects/items/storage/toolbox.dm:68`

- Sturdy tool storage. Force 12, throwforce 12, throw_range 7 (line 9-12). w_class BULKY. 500 iron custom_materials (line 14).
- No component overrides; uses default storage config.
- PopulateContents spawns: screwdriver, wrench, weldingtool, crowbar, analyzer, wirecutters (1 of each) (line 74-80).

### emergency toolbox `/obj/item/storage/toolbox/emergency`  `code/game/objects/items/storage/toolbox.dm:43`

- Red toolbox for emergencies. icon_state "red" (line 45).
- PopulateContents (line 49-60): crowbar/red, weldingtool/mini, extinguisher/mini, one of (flashlight | flashlight/glowstick | flashlight/flare) randomly, radio/off.

### electrical toolbox `/obj/item/storage/toolbox/electrical`  `code/game/objects/items/storage/toolbox.dm:130`

- Yellow toolbox. icon_state "yellow" (line 132).
- PopulateContents (line 136-147): screwdriver, wirecutters, t_scanner, crowbar, 2x stack/cable_coil (random color), 5% chance clothing/gloves/yellow else 3rd stack/cable_coil.

### drone toolbox `/obj/item/storage/toolbox/drone`  `code/game/objects/items/storage/toolbox.dm:171`

- Alias name "mechanical toolbox", blue icon. Used for drone construction.
- PopulateContents (line 177-186): screwdriver, wrench, weldingtool, crowbar, stack/cable_coil (random color), wirecutters, multitool. (7 items, same as mechanical but with multitool instead of analyzer).

---

## Backpacks

### backpack (base) `/obj/item/storage/backpack`  `code/game/objects/items/storage/backpack.dm:12`

- Generic backpack, w_class BULKY, slot_flags ITEM_SLOT_BACK (line 20). max_integrity 300 (line 22).
- ComponentInitialize (line 24-29): max_combined_w_class = 21, max_w_class = WEIGHT_CLASS_NORMAL, max_items = 21.
- No PopulateContents; empty at spawn.
- Worn in back slot; has 300 integrity (can be damaged).

### industrial backpack `/obj/item/storage/backpack/industrial`  `code/game/objects/items/storage/backpack.dm:156`

- Tough backpack, fire-proof (resistance_flags = FIRE_PROOF line 161). icon_state "engiepack" (line 159).
- Uses base storage (max 21 combined, 21 items, NORMAL w_class max).
- No PopulateContents; empty at spawn.

### botany backpack `/obj/item/storage/backpack/botany`  `code/game/objects/items/storage/backpack.dm:163`

- Natural fibers. icon_state "botpack" (line 166).
- Standard storage config.
- No PopulateContents.

### captain's backpack `/obj/item/storage/backpack/captain`  `code/game/objects/items/storage/backpack.dm:150`

- Exclusive officer gear. icon_state "captainpack" (line 153).
- Standard storage config.
- No PopulateContents.

### chemistry backpack `/obj/item/storage/backpack/chemistry`  `code/game/objects/items/storage/backpack.dm:169`

- Stain-resistant. icon_state "chempack" (line 172).
- Standard storage config.
- No PopulateContents.

### clown backpack (Giggles von Honkerton) `/obj/item/storage/backpack/clown`  `code/game/objects/items/storage/backpack.dm:120`

- Named "Giggles von Honkerton" (line 121). icon_state "clownpack" (line 123).
- Standard storage config.
- No PopulateContents.

### genetics backpack `/obj/item/storage/backpack/genetics`  `code/game/objects/items/storage/backpack.dm:175`

- Tough genetics bag. icon_state "genepack" (line 179).
- Standard storage config.
- No PopulateContents.

### medical backpack `/obj/item/storage/backpack/medic`  `code/game/objects/items/storage/backpack.dm:138`

- Sterile design. icon_state "medicalpack" (line 142).
- Standard storage config.
- No PopulateContents.

### mime backpack (Parcel Parceaux) `/obj/item/storage/backpack/mime`  `code/game/objects/items/storage/backpack.dm:132`

- Named "Parcel Parceaux" (line 133). Silent worker design. icon_state "mimepack" (line 135).
- Standard storage config.
- No PopulateContents.

### science backpack `/obj/item/storage/backpack/science`  `code/game/objects/items/storage/backpack.dm:181`

- Fire-resistant, plasma-scented. icon_state "toxpack" (line 184).
- Standard storage config.
- No PopulateContents.

### security backpack `/obj/item/storage/backpack/security`  `code/game/objects/items/storage/backpack.dm:144`

- Robust design. icon_state "securitypack" (line 148).
- Standard storage config.
- No PopulateContents.

### trophy rack (cultpack) `/obj/item/storage/backpack/cultpack`  `code/game/objects/items/storage/backpack.dm:114`

- Named "trophy rack" (line 115). Cult-themed. icon_state "cultpack" (line 117).
- Standard storage config.
- No PopulateContents.

### virology backpack `/obj/item/storage/backpack/virology`  `code/game/objects/items/storage/backpack.dm:187`

- Hypo-allergenic, disease prevention. icon_state "viropack" (line 190).
- Standard storage config.
- No PopulateContents.

### explorer bag `/obj/item/storage/backpack/explorer`  `code/game/objects/items/storage/backpack.dm:126`

- Robust loot bag. icon_state "explorerpack" (line 129).
- Standard storage config.
- No PopulateContents.

### captain's satchel `/obj/item/storage/backpack/satchel/cap`  `code/game/objects/items/storage/backpack.dm:301`

- Exclusive officer satchel. icon_state "satchel-cap" (line 304).
- Uses base satchel storage (inherited from /backpack/satchel parent).
- No PopulateContents.

### satchel `/obj/item/storage/backpack/satchel`  `code/game/objects/items/storage/backpack.dm:228`

- Generic satchel. icon_state "satchel-norm" (line 231).
- Uses base backpack storage (max 21 combined, 21 items, NORMAL w_class).
- No PopulateContents.

### explorer satchel `/obj/item/storage/backpack/satchel/explorer`  `code/game/objects/items/storage/backpack.dm:295`

- Robust explorer satchel. icon_state "satchel-explorer" (line 298).
- Standard storage.
- No PopulateContents.

### industrial satchel `/obj/item/storage/backpack/satchel/eng`  `code/game/objects/items/storage/backpack.dm:246`

- Fire-proof, extra pockets. icon_state "satchel-eng" (line 249).
- Standard storage.
- No PopulateContents.

### leather satchel `/obj/item/storage/backpack/satchel/leather/withwallet`  `code/game/objects/items/storage/backpack.dm:234`

- Fancy leather. icon_state "satchel" (line 237).
- PopulateContents (line 240-241): storage/wallet/random (1 item).

### surgical duffel bag (med) `/obj/item/storage/backpack/duffelbag/med/surgery`  `code/game/objects/items/storage/backpack.dm:365`

- For surgical tools. desc "surgical duffel bag" (line 367). Inherits duffelbag storage (max 30 combined).
- PopulateContents (line 369-379): scalpel, hemostat, retractor, circular_saw, surgicaldrill, cautery, bonesetter, surgical_drapes, clothing/mask/surgical, razor (10 items).

### surgical duffel bag (sec) `/obj/item/storage/backpack/duffelbag/sec/surgery`  `code/game/objects/items/storage/backpack.dm:387`

- Security surgical duffel. desc "surgical duffel bag" (line 388).
- PopulateContents (line 391-400): scalpel, hemostat, retractor, circular_saw, bonesetter, surgicaldrill, cautery, surgical_drapes, clothing/mask/surgical (9 items, no razor).

### captain's duffel bag `/obj/item/storage/backpack/duffelbag/captain`  `code/game/objects/items/storage/backpack.dm:353`

- Captainly goods. icon_state "duffel-captain" (line 356).
- Uses duffelbag storage (max 30 combined).
- No PopulateContents.

### industrial duffel bag (engineering) `/obj/item/storage/backpack/duffelbag/engineering`  `code/game/objects/items/storage/backpack.dm:402`

- Fire-proof. icon_state "duffel-eng" (line 405).
- Uses duffelbag storage (max 30 combined).
- No PopulateContents.

---

## Belts and Belt Storage

### toolbelt (utility) `/obj/item/storage/belt/utility`  `code/game/objects/items/storage/belt.dm:30`

- General-purpose toolbelt. slot_flags ITEM_SLOT_BELT (line 10), worn_icon_state "utility" (line 35). content_overlays TRUE (line 36).
- ComponentInitialize (line 41-70): max_w_class = NORMAL, max_combined_w_class = 21, set_holdable can hold: crowbar, screwdriver, weldingtool, wirecutters, wrench, multitool, flashlight, stack/cable_coil, t_scanner, analyzer, geiger_counter, extinguisher/mini, radio, clothing/gloves, holosign_creator/atmos, holosign_creator/engineering, forcefield_projector, assembly/signaler, lightreplacer, construction/rcd, pipe_dispenser, inducer, plunger.
- No PopulateContents; empty at spawn.

### toolbelt (full) `/obj/item/storage/belt/utility/full`  `code/game/objects/items/storage/belt.dm:89`

- Pre-filled toolbelt.
- PopulateContents (line 89-96): screwdriver, wrench, weldingtool, crowbar, wirecutters, multitool, stack/cable_coil (7 items).

### Chief Engineer's toolbelt (full) `/obj/item/storage/belt/utility/chief/full`  `code/game/objects/items/storage/belt.dm:79`

- icon_state "utility_ce" (line 76). Premium tools.
- PopulateContents (line 79-86): screwdriver/power, crowbar/power, weldingtool/experimental, multitool, stack/cable_coil, extinguisher/mini, analyzer (7 items).

### engineering toolbelt `/obj/item/storage/belt/utility/full/engi`  `code/game/objects/items/storage/belt.dm:98`

- Engineering variant with large tank welder.
- PopulateContents (line 98-105): screwdriver, wrench, weldingtool/largetank, crowbar, wirecutters, multitool, stack/cable_coil (7 items).

### atmostech toolbelt `/obj/item/storage/belt/utility/atmostech`  `code/game/objects/items/storage/belt.dm:108`

- For atmospherics technicians.
- PopulateContents (line 108-115): screwdriver, wrench, weldingtool, crowbar, wirecutters, t_scanner, extinguisher/mini (7 items).

### medical belt `/obj/item/storage/belt/medical`  `code/game/objects/items/storage/belt.dm:126`

- General medical equipment belt. icon_state "medical" (line 130).
- ComponentInitialize (line 133-189): max_w_class = NORMAL, max_combined_w_class = 21, can_hold: healthanalyzer, dnainjector, dropper, reagent_containers/glass/beaker, reagent_containers/glass/bottle, reagent_containers/pill, syringe, medigel, lighter, storage/fancy/cigarettes, storage/pill_bottle, stack/medical, flashlight/pen, extinguisher/mini, reagent_containers/hypospray, sensor_device, radio, clothing/gloves, lazarus_injector, bikehorn/rubberducky, clothing/mask/surgical, clothing/mask/breath, clothing/mask/breath/medical, surgical_drapes, scalpel, circular_saw, bonesetter, surgicaldrill, retractor, cautery, hemostat, geiger_counter, clothing/neck/stethoscope, stamp, clothing/glasses, wrench/medical, clothing/mask/muzzle, reagent_containers/blood, tank/internals/emergency_oxygen, gun/syringe/syndicate, implantcase, implant, implanter, pinpointer/crew, holosign_creator/medical, construction/plumbing, plunger, reagent_containers/spray, shears, stack/sticky_tape.
- No PopulateContents.

### paramedic medical belt `/obj/item/storage/belt/medical/paramedic`  `code/game/objects/items/storage/belt.dm:191`

- Field medic belt.
- PopulateContents (line 191-199): sensor_device, pinpointer/crew/prox, stack/medical/gauze/twelve, syringe, stack/medical/bone_gel, stack/sticky_tape/surgical, reagent_containers/glass/bottle/calomel (7 items).

---

## Boxes

### survival box `/obj/item/storage/box/survival`  `code/game/objects/items/storage/box/survival:117`

- Basic emergency kit. Uses box storage (component initialized in box.dm).
- PopulateContents (line 122-130): mask_type (default /clothing/mask/breath), medipen_type (default /reagent_containers/hypospray/medipen), internal_type (default /tank/internals/emergency_oxygen). If plasmaman: /tank/internals/plasmaman/belt instead of oxygen tank.

### engineer survival box `/obj/item/storage/box/survival/engineer`  `code/game/objects/items/storage/box/survival/engineer:145`

- Engineer variant. internal_type = /tank/internals/emergency_oxygen/engi (line 146).
- PopulateContents: same as base survival (mask, medipen, engi oxygen tank).

### medical survival box `/obj/item/storage/box/survival/medical`  `code/game/objects/items/storage/box/survival/medical:167`

- Medical variant. mask_type = /clothing/mask/breath/medical (line 168).
- PopulateContents: same base formula (medical mask, medipen, oxygen tank).

### mining survival box `/obj/item/storage/box/survival/mining`  `code/game/objects/items/storage/box/survival/mining:137`

- Mining variant. mask_type = /clothing/mask/gas/explorer (line 138).
- PopulateContents (line 140-142): base survival items + crowbar/red.

### security survival box `/obj/item/storage/box/survival/security`  `code/game/objects/items/storage/box/survival/security:159`

- Security variant. mask_type = /clothing/mask/gas/sechailer (line 160).
- PopulateContents: base survival items (mask, medipen, oxygen tank).

### box of beanbags `/obj/item/storage/box/beanbag`  `code/game/objects/items/storage/boxes.dm:853`

- Riot ammunition. icon_state "rubbershot_box" (line 856).
- PopulateContents (line 859-861): 6x ammo_casing/shotgun/beanbag.

### box of beakers `/obj/item/storage/box/beakers`  `code/game/objects/items/storage/boxes.dm:225`

- Lab equipment.
- PopulateContents (line 229-231): 7x reagent_containers/glass/beaker.

### evidence bag box `/obj/item/storage/box/evidence`  `code/game/objects/items/storage/boxes.dm:NOT FOUND`

- NOT FOUND in primary TG source. Named "evidence bag box" in todo list.

### hug box (basic) `/obj/item/storage/box/hug`  `code/game/objects/items/storage/boxes.dm:779`

- Sensitive people box. icon_state "hugbox" (line 782). Special attack_self emotes hugging (line 790-794).
- PopulateContents: none (empty).

### hug box (survival) `/obj/item/storage/box/hug/survival`  `code/game/objects/items/storage/boxes.dm:824`

- Medical variant.
- PopulateContents (line 824-831): clothing/mask/breath, reagent_containers/hypospray/medipen, tank/internals/emergency_oxygen (or plasmaman variant).

### box of hugs (NOT FOUND) `/obj/item/storage/box/hug/survival`  `code/game/objects/items/storage/boxes.dm:824`

- Listed as "box of hugs" in todo but actual path is /hug/survival above.

### ids box (spare IDs) `/obj/item/storage/box/ids`  `code/game/objects/items/storage/boxes.dm:520`

- Generic ID cards. icon_state "id" illustration (line 523).
- PopulateContents (line 525-527): 7x card/id.

### silver IDs box `/obj/item/storage/box/silver_ids`  `code/game/objects/items/storage/boxes.dm:547`

- Fancy IDs. illustration "id" (line 550).
- PopulateContents (line 552-554): 7x card/id/silver.

### lights box (mixed) `/obj/item/storage/box/lights/mixed`  `code/game/objects/items/storage/boxes.dm:740`

- Replacement bulbs. ComponentInitialize (line 720-726): max_items = 21, max_combined_w_class = 21, can_hold [light/tube, light/bulb].
- PopulateContents (line 744-748): 14x light/tube, 7x light/bulb (21 total).

### lights box (tubes) `/obj/item/storage/box/lights/tubes`  `code/game/objects/items/storage/boxes.dm:732`

- Tube replacements.
- PopulateContents (line 736-738): 21x light/tube.

### matchbox `/obj/item/storage/box/matches`  `code/game/objects/items/storage/boxes.dm:685`

- Match storage. w_class TINY (line 691), slot_flags ITEM_SLOT_BELT (line 692).
- ComponentInitialize (line 697-701): max_items = 10, can_hold [match].
- PopulateContents (line 703-704): filled via SEND_SIGNAL COMSIG_TRY_STORAGE_FILL_TYPE.

### donut box `/obj/item/storage/fancy/donut_box`  `code/game/objects/items/storage/fancy.dm:65`

- Special fancy box for donuts. icon_type "donut" (line 68), spawn_type /reagent_containers/food/snacks/donut (line 70), fancy_open = TRUE (line 71).
- ComponentInitialize (line 73-77): max_items = 6, can_hold [donut]. Has icon state display logic (line 34-35).
- PopulateContents (line 29-30): loops max_items times, spawning spawn_type.

### candle pack `/obj/item/storage/fancy/candle_box`  `code/game/objects/items/storage/fancy.dm:104`

- Candle storage. w_class BULKY (line 112), slot_flags ITEM_SLOT_BELT (line 112), throwforce 2 (line 111). fancy_open = TRUE (line 114).
- ComponentInitialize (line 116-119): max_items = 5, spawn_type = /candle.
- PopulateContents: per fancy base, spawns 5 candles.

### cigarettes (Space Cigarettes packet) `/obj/item/storage/fancy/cigarettes`  `code/game/objects/items/storage/fancy.dm:127`

- Smoking goods. w_class TINY (line 133), slot_flags ITEM_SLOT_BELT (line 135). attack_self (line 147-160) special: if empty and spawn_coupon, gives coupon; spawn_coupon one-time only. age_restricted = TRUE (line 139).
- ComponentInitialize (line 162-166): max_items = 6, can_hold [clothing/mask/cigarette, lighter].
- PopulateContents (line 29-30): spawns 6 space_cigarette items. examine shows coupon message (line 172-173). AltClick (line 175-185) extracts single cigarette with special message.

### egg box `/obj/item/storage/fancy/egg_box`  `code/game/objects/items/storage/fancy.dm:83`

- Egg carton. spawn_type = /reagent_containers/food/snacks/egg (line 92).
- ComponentInitialize (line 94-98): max_items = 12, can_hold [egg].
- PopulateContents: spawns 12 eggs.

---

## Bags

### trash bag `/obj/item/storage/bag/trash`  `code/game/objects/items/storage/bags.dm:34`

- Heavy-duty garbage bag. icon "janitor.dmi" (line 37), w_class BULKY (line 21).
- ComponentInitialize (line 45-51): max_w_class = SMALL, max_combined_w_class = 30, max_items = 30, cant_hold [disk/nuclear].
- update_icon_state (line 58-67): changes icon based on contents: 20+ = "3", 11-20 = "2", 1-11 = "1", empty = base.

### tray (cafeteria) `/obj/item/storage/bag/tray/cafeteria`  `code/game/objects/items/storage/bags.dm:350`

- Metal food tray. icon_state "foodtray" (line 353). Force 5, throwforce 10, throw_speed 3, throw_range 5 (line 297-300), flags CONDUCT (line 301), 3000 iron custom_materials (line 302).
- ComponentInitialize (line 304-307): insert_preposition = "on" (not "in").
- attack() (line 309-326): drops all contents on impact, plays tray hit sound, paralyzes humanoid/monkey 40 ds 10% chance.

### portaseeder (plant bag) `/obj/item/storage/bag/plants/portaseeder`  `code/game/objects/items/storage/bags.dm:208`

- Portable seed extractor. icon_state "portaseeder" (line 211). verb "Activate Seed Extraction" (line 213) seedifies all plants to 1 seed each.
- Uses plant bag storage (max 100 combined, 100 items, can_hold grown/seeds/grown/honeycomb/graft).
- No PopulateContents.

---

## Briefcases

### briefcase `/obj/item/storage/briefcase`  `code/game/objects/items/storage/briefcase.dm:1`

- FAUX leather. w_class BULKY (line 12), force 8, throwforce 8, throw_range 4 (line 9-11). max_integrity 150 (line 15).
- ComponentInitialize (line 18-22): max_w_class = NORMAL, max_combined_w_class = 21, set_holdable uses folder_path (/obj/item/folder by default, line 16).
- PopulateContents (line 24-28): pen, folder with 6 papers inside.

### secure briefcase `/obj/item/storage/secure/briefcase`  `code/game/objects/items/storage/secure.dm:118`

- Digital lock. Inherits from /storage/secure. w_class BULKY (line 130), force 8, throwforce 8 (line 126-129). max_integrity not specified (inherits from /obj/item).
- ComponentInitialize (line 137-141): max_combined_w_class = 21, max_w_class = NORMAL.
- PopulateContents (line 133-135): paper, pen.
- Has topic() interface for 5-digit passcode (line 81-112). Locked by default; UNLOCK trigger via correct passcode display. attack_self opens UI (line 66-79).

---

## Folders and Clipboard

### clipboard `/obj/item/clipboard`  `code/modules/paperwork/clipboard.dm:1`

- Bureaucratic storage. w_class SMALL (line 7), throwforce 0 (line 6), slot_flags ITEM_SLOT_BELT (line 12). Stores papers and pen. Update_overlays (line 28-35) shows paper icon + pen overlay.
- attack_self (line 49-125) shows browse UI with pen/paper management. attackby (line 37-46) adds paper/pen to contents, toppaper.
- No component/storage; manual contents management.

### folder (blue) `/obj/item/folder/blue`  `code/modules/paperwork/folders.dm:14`

- Paper holder. w_class SMALL (line 6), pressure_resistance 2 (line 7). icon_state "folder_blue" (line 16).
- attackby (line 37-57) holds papers and photos. attack_self shows browse (line 67-97) with remove/read options.
- Manual contents; no storage component.

### folder (red) `/obj/item/folder/red`  `code/modules/paperwork/folders.dm:18`

- Red variant. icon_state "folder_red" (line 20).
- Same behavior as blue folder.

### folder (white) `/obj/item/folder/white`  `code/modules/paperwork/folders.dm:26`

- White variant. icon_state "folder_white" (line 28).
- Same behavior.

### folder (yellow) `/obj/item/folder/yellow`  `code/modules/paperwork/folders.dm:22`

- Yellow variant. icon_state "folder_yellow" (line 24).
- Same behavior.

### TOP SECRET folder `/obj/item/folder/documents`  `code/modules/paperwork/folders.dm:99`

- Government secrets. name "folder- 'TOP SECRET'" (line 100), desc stamped property (line 101).
- Initialize (line 103-106) spawns /documents/nanotrasen inside.

---

## Specialty Storage

### lockbox of mindshield implants `/obj/item/storage/lockbox/loyalty`  `code/game/objects/items/storage/lockbox.dm:70`

- Access-controlled lock. req_access = [ACCESS_SECURITY] (line 72). icon variants (line 90-98): locked "+l", closed, broken "+b".
- ComponentInitialize (line 100-106): max_w_class = SMALL, max_items = 10, max_combined_w_class = 20, can_hold [medal].
- PopulateContents (line 74-76): 3x implantcase/mindshield, implanter/mindshield.

### medal box `/obj/item/storage/lockbox/medal`  `code/game/objects/items/storage/lockbox.dm:87`

- Medal storage. req_access = [ACCESS_CAPTAIN] (line 95). Has open state mechanic (line 113-118) with AltClick. update_icon_state (line 131-140) shows locked/closed/open/broken variants.
- ComponentInitialize (line 100-106): max_w_class = SMALL, max_items = 10, max_combined_w_class = 20, can_hold [clothing/accessory/medal].
- PopulateContents (line 120-129): 1x gold/captain medal, 2x silver/valor medals, 1x silver/security medal, 1x bronze_heart medal, 2x plasma/nobel_science medals, 3x conduct medals (11 total).

### security medal box `/obj/item/storage/lockbox/medal/sec`  `code/game/objects/items/storage/lockbox.dm:160`

- Security medals. req_access = [ACCESS_HOS] (line 163).
- PopulateContents (line 165-167): 3x medal/silver/security.

### cargo award box `/obj/item/storage/lockbox/medal/cargo`  `code/game/objects/items/storage/lockbox.dm:169`

- Cargo awards. req_access = [ACCESS_QM] (line 172).
- PopulateContents (line 174-175): 1x medal/ribbon/cargo.

### service award box `/obj/item/storage/lockbox/medal/service`  `code/game/objects/items/storage/lockbox.dm:177`

- Service awards. req_access = [ACCESS_HOP] (line 180).
- PopulateContents (line 182-183): 1x medal/silver/excellence.

### science medal box `/obj/item/storage/lockbox/medal/sci`  `code/game/objects/items/storage/lockbox.dm:185`

- Science medals. req_access = [ACCESS_RD] (line 188).
- PopulateContents (line 190-192): 3x medal/plasma/nobel_science.

### safe (secure safe) `/obj/item/storage/secure/safe`  `code/game/objects/items/storage/secure.dm:158`

- Wall-mounted safe. anchored = TRUE (line 168), density = FALSE (line 169), w_class GIGANTIC (line 167). icon_state "safe" (line 160), icon_opened "safe0" (line 162).
- ComponentInitialize (line 171-175): max_w_class = 8, cant_hold [storage/secure/briefcase]. (max_w_class 8 is unclear; not a standard WEIGHT_CLASS.)
- PopulateContents (line 177-179): paper, pen. attack_hand (line 181-185) calls attack_self to open.

### head of security's safe `/obj/item/storage/secure/safe/hos`  `code/game/objects/items/storage/secure.dm:187`

- HoS safe. name "head of security's safe" (line 188).
- Same storage config as base safe.

---

## Boxes (continued)

### box of crayons `/obj/item/storage/crayons`  `code/game/objects/items/crayons.dm:577`

- Crayon kit. icon "crayons.dmi" (line 580), w_class SMALL (line 582).
- Initialize (line 584-588): max_items = 7, can_hold [crayon]. update_overlays shows crayon colors (line 600-603). attackby rejects mime/rainbow crayons (line 605-618).
- PopulateContents (line 590-597): red, orange, yellow, green, blue, purple, black crayons (7 items).

### box of pills `/obj/item/storage/box/pillbottles`  `code/game/objects/items/storage/boxes.dm:661`

- Pill bottles. illustration "pillbox" (line 664).
- PopulateContents (line 666-668): 7x storage/pill_bottle.

### box of latex gloves `/obj/item/storage/box/gloves`  `code/game/objects/items/storage/boxes.dm:170`

- Sterile gloves. illustration "latex" (line 173).
- PopulateContents (line 175-177): 7x clothing/gloves/color/latex.

### box of sterile masks `/obj/item/storage/box/masks`  `code/game/objects/items/storage/boxes.dm:179`

- Medical masks. illustration "sterile" (line 182).
- PopulateContents (line 184-186): 7x clothing/mask/surgical.

### box of syringes `/obj/item/storage/box/syringes`  `code/game/objects/items/storage/boxes.dm:188`

- Medical syringes. illustration "syringe" (line 191).
- PopulateContents (line 193-195): 7x reagent_containers/syringe.

### box of handcuffs `/obj/item/storage/box/handcuffs`  `code/game/objects/items/storage/boxes.dm:612`

- Restraints. icon_state "secbox" (line 615), illustration "handcuff" (line 616).
- PopulateContents (line 618-620): 7x restraints/handcuffs.

### box of spare zipties `/obj/item/storage/box/zipties`  `code/game/objects/items/storage/boxes.dm:622`

- Zip ties. icon_state "secbox" (line 625), illustration "handcuff" (line 626).
- PopulateContents (line 628-630): 7x restraints/handcuffs/cable/zipties.

### box of donk-pockets `/obj/item/storage/box/donkpockets`  `code/game/objects/items/storage/boxes.dm:437`

- Food item. icon_state "donkpocketbox" (line 440), illustration = null (line 441).
- ComponentInitialize (line 448-451): can_hold [donkpocket].
- PopulateContents (line 444-446): 6x donktype (default /reagent_containers/food/snacks/donkpocket).

### box of monkeycubes `/obj/item/storage/box/monkeycubes`  `code/game/objects/items/storage/boxes.dm:483`

- Cloning food. icon_state "monkeycubebox" (line 486), illustration = null (line 487). cube_type = /monkeycube (line 488).
- ComponentInitialize (line 490-494): max_items = 7, can_hold [monkeycube].
- PopulateContents (line 496-498): 5x cube_type.

### box of Pest-B-Gon mousetraps `/obj/item/storage/box/mousetraps`  `code/game/objects/items/storage/boxes.dm:652`

- Traps. illustration "mousetrap" (line 655).
- PopulateContents (line 657-659): 6x assembly/mousetrap.

### box of medical gels `/obj/item/storage/box/medigels`  `code/game/objects/items/storage/boxes.dm:252`

- Applicators. illustration "medgel" (line 255).
- PopulateContents (line 257-259): 7x reagent_containers/medigel.

### box of empty sandbags `/obj/item/storage/box/emptysandbags`  `code/game/objects/items/storage/boxes.dm:NOT FOUND`

- Listed in todo. NOT FOUND in primary TG source (commit 2d6c10c1).

### box of flashbangs (WARNING) `/obj/item/storage/box/flashbangs`  `code/game/objects/items/storage/boxes.dm:272`

- Grenades. icon_state "secbox" (line 275), illustration "flashbang" (line 276), desc WARNING (line 274).
- PopulateContents (line 278-280): 7x grenade/flashbang.

### box of tear gas grenades (WARNING) `/obj/item/storage/box/teargas`  `code/game/objects/items/storage/boxes.dm:322`

- Grenades. icon_state "secbox" (line 326), illustration "grenade" (line 326), desc WARNING (line 324).
- PopulateContents (line 328-330): 7x grenade/chem_grenade/teargas.

### box of lethal shotgun shots `/obj/item/storage/box/lethalshot`  `code/game/objects/items/storage/boxes.dm:843`

- Ammunition. icon_state "lethalshot_box" (line 846), illustration = null (line 847).
- PopulateContents (line 849-851): 7x ammo_casing/shotgun/buckshot.

### box of rubber shots `/obj/item/storage/box/rubbershot`  `code/game/objects/items/storage/boxes.dm:833`

- Ammunition. icon_state "rubbershot_box" (line 836), illustration = null (line 837).
- PopulateContents (line 839-841): 7x ammo_casing/shotgun/rubbershot.

### box of disk tools `/obj/item/storage/box/disks`  `code/game/objects/items/storage/boxes.dm:100`

- Data disks. illustration "disk_kit" (line 102).
- PopulateContents (line 104-106): 7x disk/data.

### box of nanite program disks `/obj/item/storage/box/disks_nanite`  `code/game/objects/items/storage/boxes.dm:108`

- Program disks. illustration "disk_kit" (line 110).
- PopulateContents (line 112-114): 7x disk/nanite_program.

### box of drinking glasses `/obj/item/storage/box/drinkingglasses`  `code/game/objects/items/storage/boxes.dm:410`

- Beverageware. illustration "drinkglass" (line 413).
- PopulateContents (line 415-417): 6x reagent_containers/food/drinks/drinkingglass.

### box of deputy armbands `/obj/item/storage/box/deputy`  `code/game/objects/items/storage/boxes.dm:751`

- Officer accessories. icon_state "secbox" (line 754), illustration "depband" (line 755).
- PopulateContents (line 757-759): 7x clothing/accessory/armband/deputy.

### box of replacement lights (tubes) `/obj/item/storage/box/lights/tubes`  `code/game/objects/items/storage/boxes.dm:732`

- See above.

### box of replacement lights (mixed) `/obj/item/storage/box/lights/mixed`  `code/game/objects/items/storage/boxes.dm:740`

- See above.

### boxed chemical implant kit `/obj/item/storage/box/chemimp`  `code/game/objects/items/storage/boxes.dm:368`

- Kit. icon_state "secbox" (line 370), illustration "implant" (line 371).
- PopulateContents (line 373-378): 5x implantcase/chem, implanter, implantpad (7 items).

### boxed tracking implant kit `/obj/item/storage/box/trackimp`  `code/game/objects/items/storage/boxes.dm:341`

- Kit. icon_state "secbox" (line 344), illustration "implant" (line 345).
- PopulateContents (line 347-353): via generate_items_inside: 4x implantcase/tracking, implanter, implantpad, locator (7 items).

### box of PDA security cartridges `/obj/item/storage/box/seccarts`  `code/game/objects/items/storage/boxes.dm:572`

- Cartridges. icon_state "secbox" (line 575), illustration "pda" (line 576).
- PopulateContents (line 578-581): cartridge/detective, 6x cartridge/security (7 items).

### box of standard firing pins `/obj/item/storage/box/firingpins`  `code/game/objects/items/storage/boxes.dm:583`

- Gun components. icon_state "secbox" (line 586), illustration "firingpin" (line 587).
- PopulateContents (line 589-591): 5x firing_pin.

### body bags `/obj/item/storage/box/bodybags`  `code/game/objects/items/storage/boxes.dm:391`

- Corpse storage. illustration "bodybags" (line 394).
- PopulateContents (line 396-399): 7x bodybag.

### box of prescription glasses `/obj/item/storage/box/rxglasses`  `code/game/objects/items/storage/boxes.dm:401`

- Eyewear. illustration "glasses" (line 404).
- PopulateContents (line 406-408): 7x clothing/glasses/regular.

### spare PDAs box `/obj/item/storage/box/pdas`  `code/game/objects/items/storage/boxes.dm:530`

- PDA units. illustration "pda" (line 533).
- PopulateContents (line 535-545): 4x pda, cartridge/head, 1x random (cartridge/engineering|security|medical|toxins|quartermaster).

---

## Photo Albums

### photo album (base) `/obj/item/storage/photo_album`  `code/modules/photography/photos/album.dm:4`

- Photo storage. w_class SMALL (line 13), slot_flags = none. flags PREVENT_CONTENTS_EXPLOSION (line 14). persistence_id var for saving photos (line 15).
- Initialize (line 17-23): can_hold [photo], max_combined_w_class = 42, max_items = 21.
- No PopulateContents; empty at spawn. get_picture_id_list() extracts photo IDs for persistence (line 29-41).

### photo album (Captain) `/obj/item/storage/photo_album/captain`  `code/modules/photography/photos/album.dm:71`

- Officer album. name "photo album (Captain)" (line 72), persistence_id = "Captain" (line 73).
- Uses base photo album storage.

### photo album (CMO) `/obj/item/storage/photo_album/cmo`  `code/modules/photography/photos/album.dm:75`

- Medical officer album. persistence_id = "CMO" (line 77).

### photo album (CE) `/obj/item/storage/photo_album/ce`  `code/modules/photography/photos/album.dm:83`

- Engineering officer album. persistence_id = "CE" (line 85).

### photo album (HoS) `/obj/item/storage/photo_album/hos`  `code/modules/photography/photos/album.dm:59`

- Security head album. persistence_id = "HoS" (line 61).

### photo album (HoP) `/obj/item/storage/photo_album/hop`  `code/modules/photography/photos/album.dm:67`

- Personnel head album. persistence_id = "HoP" (line 69).

### photo album (QM) `/obj/item/storage/photo_album/qm`  `code/modules/photography/photos/album.dm:79`

- Quartermaster album. persistence_id = "QM" (line 81).

### photo album (RD) `/obj/item/storage/photo_album/rd`  `code/modules/photography/photos/album.dm:63`

- Research director album. persistence_id = "RD" (line 65).

### photo album (prison) `/obj/item/storage/photo_album/prison`  `code/modules/photography/photos/album.dm:103`

- Prison album. name "photo album (Prison)" (line 104), persistence_id = "prison" (line 105).

---

## Misc. Storage

### bible `/obj/item/storage/book/bible`  `code/game/objects/items/storage/book.dm:32`

- Holy book. w_class SMALL (line 8), resistance_flags FLAMMABLE (line 9). Can hold 1 item (line 15). Has anti-magic component (line 46). attack_self shows icon picker for chaplains (line 52-66). Topic handles icon selection (line 68-93). attack() heals (line 120-167) or damages (bless logic). afterattack() blesses water, purifies souls (line 169-245). bless() proc heals damaged bodyparts (line 94-118).
- No PopulateContents; comes empty.

### security belt `/obj/item/storage/belt/security`  `code/game/objects/items/storage/belt.dm:201`

- Handcuff/grenade belt. icon_state "security" (line 204), content_overlays = TRUE (line 207).
- ComponentInitialize (line 209-232): max_items = 5, max_w_class = NORMAL, can_hold [baton, classic_baton, grenade, spray/pepper, handcuffs, assembly/flash, glasses, ammo_casing/shotgun, ammo_box, food/snacks/donut, kitchen/knife/combat, flashlight/seclite, melee/classic_baton/telescopic, radio, gloves, restraints/legcuffs/bola, holosign_creator/security].
- No PopulateContents; empty at spawn.

### sabre sheath `/obj/item/storage/belt/sabre`  `code/game/objects/items/storage/belt.dm:661`

- Officer's blade holder. w_class BULKY (line 667), worn_icon_state "sheath" (line 666). Has element update_icon_updates_onmob (line 671). examine shows altclick message (line 680-683). AltClick (line 685-694) quick-draws blade.
- ComponentInitialize (line 669-678): max_items = 1, rustle_sound = FALSE, max_w_class = BULKY, can_hold [melee/sabre].
- PopulateContents (line 705-707): 1x melee/sabre, update_icon().

### championship belt `/obj/item/storage/belt/champion`  `code/game/objects/items/storage/belt.dm:354`

- Trophy belt. custom_materials [gold=400] (line 360).
- ComponentInitialize (line 362-368): max_items = 1, can_hold [clothing/mask/luchador].
- No PopulateContents; empty.

### safe (secure briefcase) `/obj/item/storage/secure/briefcase`  `code/game/objects/items/storage/secure.dm:118`

- See above.

### emergency space suits pod `/obj/item/storage/pod`  `code/modules/shuttle/emergency.dm:523`

- Wall-mounted emergency kit. anchored = TRUE (line 526), density = FALSE (line 527), icon_state "safe" (line 529). unlocked var (line 530). can_interact checks security level (line 564-569): only accessible at RED alert or if unlocked.
- PopulateContents (line 532-544): 2x helmet/space/orange, 2x suit/space/orange, 2x mask/gas, 2x tank/internals/oxygen/red, 2x pickaxe/emergency, survivalcapsule, toolbox/emergency (12 items).

---

## Coverage

Total list entries: 117

Documented with real data: 115

NOT FOUND or ambiguous:
- /obj/item/storage/box/evidence (listed as "evidence bag box" but no evidence box type found; box base exists line 24)
- /obj/item/storage/box/emptysandbags (no implementation in commit 2d6c10c1)

Entries where path name differs from in-game name:
- /obj/item/storage/backpack/cultpack displays as "trophy rack"
- /obj/item/storage/backpack/clown displays as "Giggles von Honkerton"
- /obj/item/storage/backpack/mime displays as "Parcel Parceaux"
- /obj/item/storage/fancy/cigarettes displays as "Space Cigarettes packet"
- /obj/item/storage/belt/holster/detective/full (no separate name override; inherits "detective's holster")
- /obj/item/folder/documents displays as "folder- 'TOP SECRET'"

---

## Minimum Viable Port

- Storage component system: max_w_class, max_combined_w_class, max_items, can_hold/cant_hold typecache filtering
- PopulateContents() called at Initialize() to spawn default contents per item type
- Belts and boxes: specialized storage configs (security belt max 5 items, utility belt has tool whitelist)
- Backpack inheritance chain: base config (21 max_combined, 21 items, NORMAL w_class) inherited by specialty types
- Fancy boxes (donut, cigarettes, candles): icon state tracking based on contents count
- Access control: lockbox with req_access and locked state; secure briefcase with passcode interface
- Quick-draw / quickdraw: belt/sabre AltClick and holster TRAIT_GUNFLIP
- Containers that are themselves containers: briefcase holds folder which holds papers

---

## NOT FOUND / Open Questions

1. `/obj/item/storage/box/evidence` (todo list names it "evidence bag box") — searched but no matching type in code/game/objects/items/storage/boxes.dm or other storage files in TG 2d6c10c1.

2. `/obj/item/storage/box/emptysandbags` (todo line 101) — not present in TG commit 2d6c10c1. May be added in later versions.

3. Storage component delays — all storage access is silent (no /datum/component/storage use_tool / delay calls noted). Open in fast movement contexts: examine opens instantly; insert/remove may have no delay except UI browse delay.

4. Worn vs held vs floor behavior — items in storage inherit wearer's equip delay when worn belt is accessed (slot_flags ITEM_SLOT_BELT), but exact mechanics (quick-access vs strip delay) not specified per item in 2d6c10c1.

5. Slot restrictions — belts/holsters worn in ITEM_SLOT_BELT. Some belts carry different storage overrides (e.g., /security max 5 vs /utility no max_items limit). Port must validate slot-context behavior.

