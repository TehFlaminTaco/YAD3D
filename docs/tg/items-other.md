# items-other: Circuit boards, stock parts, tanks, tools, and miscellaneous items

Comprehensive documentation of TG2020 item types (DM commit 2d6c10c1, 2020-07-06). Covers circuit boards with build requirements, stock parts and power cells, internals tanks, tools, scanner devices, door remotes, musical instruments, mining gear, ores/materials, and miscellaneous gadgets. Every path from the assignment list appears in this file with its in-game name, key properties, and in-game behaviour.

---

## CIRCUIT BOARDS

Circuit boards define the components and build path for machines. Each specifies `req_components` (parts list with counts) and optionally `def_components` (upgraded defaults). Base class `/obj/item/circuitboard` has `w_class = WEIGHT_CLASS_SMALL`, `icon = 'icons/obj/module.dmi'`, `grind_results = list(/datum/reagent/silicon = 20)`. Machine boards may require anchoring (`needs_anchored = TRUE`, default).

### AI Core  `/obj/item/circuitboard/aicore`  (code/game/objects/structures/ai_core.dm:329)
- AI core circuit board with backup battery (200 units, code/game/objects/structures/ai_core.dm:331)
- name: "AI core (AI Core Board)", `w_class = WEIGHT_CLASS_SMALL` (code/game/objects/items/circuitboards/circuitboard.dm:14)
- Special var: `battery = 200` (code/game/objects/structures/ai_core.dm:331); used when AI loses power (code/game/objects/structures/ai_core.dm:321-327)
- NOT FOUND: req_components list, build_path

### Soda Dispenser  `/obj/item/circuitboard/machine/chem_dispenser/drinks`  (code/game/objects/items/circuitboards/machine_circuitboards.dm:990)
- name: "Soda Dispenser (Machine Board)" (code/game/objects/items/circuitboards/machine_circuitboards.dm:990)
- build_path = /obj/machinery/chem_dispenser/drinks (code/game/objects/items/circuitboards/machine_circuitboards.dm:991)
- NOT FOUND: req_components

### Monkey Recycler  `/obj/item/circuitboard/machine/monkey_recycler`  (code/game/objects/items/circuitboards/machine_circuitboards.dm:828)
- name: "Monkey Recycler (Machine Board)" (code/game/objects/items/circuitboards/machine_circuitboards.dm:828)
- build_path = /obj/machinery/monkey_recycler (code/game/objects/items/circuitboards/machine_circuitboards.dm:829)
- NOT FOUND: req_components

### Pay Stand  `/obj/item/circuitboard/machine/paystand`  (code/game/objects/items/circuitboards/machine_circuitboards.dm:430)
- name: "Pay Stand (Machine Board)" (code/game/objects/items/circuitboards/machine_circuitboards.dm:430)
- build_path = /obj/machinery/paystand (code/game/objects/items/circuitboards/machine_circuitboards.dm:431)
- NOT FOUND: req_components

### Seed Extractor  `/obj/item/circuitboard/machine/seed_extractor`  (code/game/objects/items/circuitboards/machine_circuitboards.dm:1106)
- name: "Seed Extractor (Machine Board)" (code/game/objects/items/circuitboards/machine_circuitboards.dm:1106)
- build_path = /obj/machinery/seed_extractor (code/game/objects/items/circuitboards/machine_circuitboards.dm:1107)
- NOT FOUND: req_components

### Lifeform Stasis Unit  `/obj/item/circuitboard/machine/stasis`  (code/game/objects/items/circuitboards/machine_circuitboards.dm:754)
- name: "Lifeform Stasis Unit (Machine Board)" (code/game/objects/items/circuitboards/machine_circuitboards.dm:754)
- build_path = /obj/machinery/stasis (code/game/objects/items/circuitboards/machine_circuitboards.dm:755)
- NOT FOUND: req_components

### Solar Control (Computer Board)  `/obj/item/circuitboard/computer/solar_control`  (code/game/objects/items/circuitboards/computer_circuitboards.dm:152)
- name: "Solar Control (Computer Board)" (code/game/objects/items/circuitboards/computer_circuitboards.dm:152)
- build_path = /obj/machinery/computer/solar_control (code/game/objects/items/circuitboards/computer_circuitboards.dm:153)
- No req_components (computer board, inherits from /obj/item/circuitboard/computer)

### Departmental Techfabs  

#### Engineering  `/obj/item/circuitboard/machine/techfab/department/engineering`  (code/game/objects/items/circuitboards/machine_circuitboards.dm:313)
- name: "Departmental Techfab (Machine Board) - Engineering" (code/game/objects/items/circuitboards/machine_circuitboards.dm:313)
- build_path = /obj/machinery/techfab/department/engineering (code/game/objects/items/circuitboards/machine_circuitboards.dm:314)
- NOT FOUND: req_components

#### Medical  `/obj/item/circuitboard/machine/techfab/department/medical`  (code/game/objects/items/circuitboards/machine_circuitboards.dm:770)
- name: "Departmental Techfab (Machine Board) - Medical" (code/game/objects/items/circuitboards/machine_circuitboards.dm:770)
- build_path = /obj/machinery/techfab/department/medical (code/game/objects/items/circuitboards/machine_circuitboards.dm:771)
- NOT FOUND: req_components

#### Science  `/obj/item/circuitboard/machine/techfab/department/science`  (code/game/objects/items/circuitboards/machine_circuitboards.dm:913)
- name: "Departmental Techfab (Machine Board) - Science" (code/game/objects/items/circuitboards/machine_circuitboards.dm:913)
- build_path = /obj/machinery/techfab/department/science (code/game/objects/items/circuitboards/machine_circuitboards.dm:914)
- NOT FOUND: req_components

#### Security  `/obj/item/circuitboard/machine/techfab/department/security`  (code/game/objects/items/circuitboards/machine_circuitboards.dm:973)
- name: "Departmental Techfab (Machine Board) - Security" (code/game/objects/items/circuitboards/machine_circuitboards.dm:973)
- build_path = /obj/machinery/techfab/department/security (code/game/objects/items/circuitboards/machine_circuitboards.dm:974)
- NOT FOUND: req_components

#### Service  `/obj/item/circuitboard/machine/techfab/department/service`  (code/game/objects/items/circuitboards/machine_circuitboards.dm:1115)
- name: "Departmental Techfab - Service (Machine Board)" (code/game/objects/items/circuitboards/machine_circuitboards.dm:1115)
- build_path = /obj/machinery/techfab/department/service (code/game/objects/items/circuitboards/machine_circuitboards.dm:1116)
- NOT FOUND: req_components

#### Cargo  `/obj/item/circuitboard/machine/techfab/department/cargo`  (code/game/objects/items/circuitboards/machine_circuitboards.dm:NOT_FOUND)
- name: "Departmental Techfab (Machine Board) - Cargo"
- NOT FOUND: definition in source

### Ore Silo  `/obj/item/circuitboard/machine/ore_silo`  (code/game/objects/items/circuitboards/machine_circuitboards.dm:1153)
- name: "Ore Silo (Machine Board)" (code/game/objects/items/circuitboards/machine_circuitboards.dm:1153)
- build_path = /obj/machinery/ore_silo (code/game/objects/items/circuitboards/machine_circuitboards.dm:1154)
- NOT FOUND: req_components

---

## STOCK PARTS: SUBSPACE COMPONENTS

Base class `/obj/item/stock_parts/subspace` (no rating specified; derives from `/obj/item/stock_parts`, rating = 1 default). All: `w_class = WEIGHT_CLASS_SMALL`, `custom_materials = list(/datum/material/iron=30, /datum/material/glass=10)` unless noted. `icon = 'icons/obj/stock_parts.dmi'`.

| Item | Name | icon_state | Description | Rating | file:line |
|------|------|------------|-------------|--------|-----------|
| `/obj/item/stock_parts/subspace/amplifier` | subspace amplifier | subspace_amplifier | A compact micro-machine capable of amplifying weak subspace transmissions. | 1 | stock_parts.dm:323-326 |
| `/obj/item/stock_parts/subspace/analyzer` | subspace wavelength analyzer | wavelength_analyzer | A sophisticated analyzer capable of analyzing cryptic subspace wavelengths. | 1 | stock_parts.dm:335-338 |
| `/obj/item/stock_parts/subspace/ansible` | subspace ansible | subspace_ansible | A compact module capable of sensing extradimensional activity. | 1 | stock_parts.dm:310-314 |
| `/obj/item/stock_parts/subspace/crystal` | ansible crystal | ansible_crystal | A crystal made from pure glass used to transmit laser databursts to subspace. `custom_materials = list(/datum/material/glass=50)` | 1 | stock_parts.dm:340-344 |
| `/obj/item/stock_parts/subspace/filter` | hyperwave filter | hyperwave_filter | A tiny device capable of filtering and converting super-intense radiowaves. | 1 | stock_parts.dm:316-320 |
| `/obj/item/stock_parts/subspace/transmitter` | subspace transmitter | subspace_transmitter | A large piece of equipment used to open a window into the subspace dimension. `custom_materials = list(/datum/material/iron=50)` | 1 | stock_parts.dm:346-350 |
| `/obj/item/stock_parts/subspace/treatment` | subspace treatment disk | treatment_disk | A compact micro-machine capable of stretching out hyper-compressed radio waves. | 1 | stock_parts.dm:328-332 |

---

## INTERNALS TANKS

Base class `/obj/item/tank` (code/game/objects/items/tanks/tanks.dm:1). All: `icon = 'icons/obj/tank.dmi'`, `slot_flags = ITEM_SLOT_BACK` (except internals), `hitsound = 'sound/weapons/smash.ogg'`, `force = 5`, `throwforce = 10`, `throw_speed = 1`, `throw_range = 4`, `custom_materials = list(/datum/material/iron = 500)`, `armor = list("melee" = 0, "bullet" = 0, "laser" = 0, "energy" = 0, "bomb" = 10, "bio" = 0, "rad" = 0, "fire" = 80, "acid" = 30)` (tanks.dm:17). All have `distribute_pressure = ONE_ATMOSPHERE` (distribute_pressure var), `volume` in liters. Gas populated in `populate_gas()` proc.

### Oxygen Tank  `/obj/item/tank/internals/oxygen/red`  (code/game/objects/items/tanks/tank_types.dm:33)
- Red oxygen tank for internals (standard colour variant: red)
- name: "oxygen tank" (tank_types.dm:15, overridden at red:34 with desc="oxygen, this one is red")
- icon_state: "oxygen_fr" (tank_types.dm:35)
- `distribute_pressure = TANK_DEFAULT_RELEASE_PRESSURE` (tank_types.dm:18)
- `force = 10` (tank_types.dm:19)
- `slot_flags = ITEM_SLOT_BACK` (tank_types.dm:7)
- `volume = 70` (tanks.dm:21)
- Gas: 6*ONE_ATMOSPHERE oxygen (tank_types.dm:25)
- `dog_fashion = null` (tank_types.dm:31)

### Extended-Capacity Emergency Oxygen  `/obj/item/tank/internals/emergency_oxygen/engi`  (code/game/objects/items/tanks/tank_types.dm:157)
- name: "extended-capacity emergency oxygen tank" (tank_types.dm:158)
- icon_state: "emergency_engi" (tank_types.dm:159)
- worn_icon_state: "emergency_engi" (tank_types.dm:160)
- `slot_flags = ITEM_SLOT_BELT` (tank_types.dm:142, inherited)
- `w_class = WEIGHT_CLASS_SMALL` (tank_types.dm:143, inherited)
- `volume = 2` (tank_types.dm:162; standard emergency is 1 liter, this is 2)
- Gas: 10*ONE_ATMOSPHERE oxygen (tank_types.dm:151, inherited; populated empty by engi/empty subtype tank_types.dm:164)
- `distribute_pressure = TANK_DEFAULT_RELEASE_PRESSURE` (tank_types.dm:145, inherited)

### Jetpack: Carbon Dioxide  `/obj/item/tank/jetpack/carbondioxide`  (code/game/objects/items/tanks/jetpack.dm:188)
- name: "jetpack (carbon dioxide)" (jetpack.dm:189)
- desc: "A tank of compressed carbon dioxide for use as propulsion in zero-gravity areas. Painted black to indicate that it should not be used as a source for internals." (jetpack.dm:190)
- icon_state: "jetpack-black" (jetpack.dm:191)
- inhand_icon_state: "jetpack-black" (jetpack.dm:192)
- `distribute_pressure = 0` (jetpack.dm:193; cannot use as internals)
- `gas_type = /datum/gas/carbon_dioxide` (jetpack.dm:194)
- `w_class = WEIGHT_CLASS_BULKY` (jetpack.dm:8)
- `volume = 70` (jetpack.dm inherited from /obj/item/tank jetpack)
- Gas: 6*ONE_ATMOSPHERE CO2 (jetpack.dm:26, populated from gas_type)
- Actions: toggle_jetpack, jetpack_stabilization (jetpack.dm:10)

### Hardsuit Jetpack Upgrade  `/obj/item/tank/jetpack/suit`  (code/game/objects/items/tanks/jetpack.dm:197)
- name: "hardsuit jetpack upgrade" (jetpack.dm:198)
- desc: "A modular, compact set of thrusters designed to integrate with a hardsuit. It is fueled by a tank inserted into the suit's storage compartment." (jetpack.dm:199)
- icon_state: "jetpack-mining" (jetpack.dm:200)
- Built into suit storage (code/game/objects/items/tanks/jetpack.dm:197-206)
- NOT FOUND: complete properties

---

## SCANNER DEVICES

### Plant Analyzer  `/obj/item/plant_analyzer`  (code/modules/hydroponics/hydroitemdefines.dm:3)
- name: "plant analyzer" (hydroitemdefines.dm:4)
- desc: "A scanner used to evaluate a plant's various areas of growth, and genetic traits." (hydroitemdefines.dm:5)
- icon_state: "hydro" (hydroitemdefines.dm:7)
- w_class: WEIGHT_CLASS_TINY (hydroitemdefines.dm:12)
- slot_flags: ITEM_SLOT_BELT (hydroitemdefines.dm:13)
- custom_materials: list(/datum/material/iron=30, /datum/material/glass=20) (hydroitemdefines.dm:14)
- Modes: PLANT_SCANMODE_STATS (growth stats) / PLANT_SCANMODE_CHEMICALS (chemicals & traits); toggle with attack_self (hydroitemdefines.dm:17-20)
- Can scan podpeople as health analyzer when in PLANT_SCANMODE_STATS (hydroitemdefines.dm:22-33)

### Forensic Scanner (Detective Scanner)  `/obj/item/detective_scanner`  (code/modules/detectivework/scanner.dm:5)
- name: "forensic scanner" (scanner.dm:6)
- desc: "Used to remotely scan objects and biomass for DNA and fingerprints. Can print a report of the findings." (scanner.dm:7)
- icon_state: "forensicnew" (scanner.dm:9)
- w_class: WEIGHT_CLASS_SMALL (scanner.dm:10)
- slot_flags: ITEM_SLOT_BELT (scanner.dm:17)
- flags_1: CONDUCT_1 (scanner.dm:15)
- range: 8 (scanner.dm:20); scans DNA, fingerprints, blood, fibers
- scan(A, user) proc: scans atoms for forensic data; afterattack calls scan (scanner.dm:66-69, 71-135)
- attack_self prints forensic report to paper (scanner.dm:33-64)

### Slime Scanner  `/obj/item/slime_scanner`  (code/game/objects/items/devices/scanners.dm:669)
- name: "slime scanner" (scanners.dm:670)
- desc: "A device that analyzes a slime's internal composition and measures its stats." (scanners.dm:671)
- icon_state: "adv_spectrometer" (scanners.dm:673)
- w_class: WEIGHT_CLASS_SMALL (scanners.dm:677)
- custom_materials: list(/datum/material/iron=30, /datum/material/glass=20) (scanners.dm:682)
- attack(mob/living/M, mob/living/user): scans slimes only; calls slime_scan(T, user) with composition, stats, mutations (scanners.dm:684-691)

### Nanite Scanner  `/obj/item/nanite_scanner`  (code/game/objects/items/devices/scanners.dm:725)
- name: "nanite scanner" (scanners.dm:726)
- desc: "A hand-held body scanner able to detect nanites and their programming." (scanners.dm:733)
- icon_state: "nanite_scanner" (scanners.dm:728)
- w_class: WEIGHT_CLASS_TINY (scanners.dm:738)
- slot_flags: ITEM_SLOT_BELT (scanners.dm:736)
- custom_materials: list(/datum/material/iron=200) (scanners.dm:741)
- attack(mob/living/M, mob/living/carbon/human/user): scans for nanites; sends COMSIG_NANITE_SCAN (scanners.dm:743-751)

### Genetic Sequence Scanner  `/obj/item/sequence_scanner`  (code/game/objects/items/devices/scanners.dm:753)
- name: "genetic sequence scanner" (scanners.dm:754)
- desc: "A hand-held scanner for analyzing someones gene sequence on the fly. Hold near a DNA console to update the internal database." (scanners.dm:761)
- icon_state: "gene" (scanners.dm:756)
- w_class: WEIGHT_CLASS_TINY (scanners.dm:766)
- slot_flags: ITEM_SLOT_BELT (scanners.dm:764)
- custom_materials: list(/datum/material/iron=200) (scanners.dm:NOT_FOUND)
- attack(mob/living/M, mob/living/carbon/human/user): calls gene_scan(C, user) (scanners.dm:775-783)
- attack_self: displays stored sequence (scanners.dm:785-788)

---

## ENCRYPTION KEYS

Base class `/obj/item/encryptionkey` (code/game/objects/items/devices/radio/encryptionkey.dm:1). All: `icon = 'icons/obj/radio.dmi'`, `w_class = WEIGHT_CLASS_TINY`. Each key specifies `channels = list()` with channel bits enabled. examine() displays accessible channels. Used for radio headset encryption.

| Item | Name | icon_state | Channels | file:line |
|------|------|------------|----------|-----------|
| `/obj/item/encryptionkey/headset_eng` | engineering radio encryption key | eng_cypherkey | RADIO_CHANNEL_ENGINEERING | encryptionkey.dm:42-45 |
| `/obj/item/encryptionkey/headset_med` | medical radio encryption key | med_cypherkey | RADIO_CHANNEL_MEDICAL | encryptionkey.dm:52-55 |
| `/obj/item/encryptionkey/headset_sci` | science radio encryption key | sci_cypherkey | RADIO_CHANNEL_SCIENCE | encryptionkey.dm:57-60 |
| `/obj/item/encryptionkey/headset_cargo` | supply radio encryption key | cargo_cypherkey | RADIO_CHANNEL_SUPPLY | encryptionkey.dm:112-115 |

---

## DOOR REMOTES

Base class `/obj/item/door_remote` (code/game/objects/items/control_wand.dm:5). All: `icon = 'icons/obj/device.dmi'`, `inhand_icon_state = "electronic"`, `w_class = WEIGHT_CLASS_TINY`. Modes: WAND_OPEN (open door), WAND_BOLT (toggle bolts), WAND_EMERGENCY (toggle emergency access). Cycle modes with attack_self. Uses NTNet interface to send control packets with access list.

| Item | Name | icon_state | Access Region | file:line |
|------|------|------------|----------------|-----------|
| `/obj/item/door_remote/civilian` | civilian door remote | gangtool-white | 1 (General) | control_wand.dm:96-99 |
| `/obj/item/door_remote/head_of_security` | security door remote | gangtool-red | 2 (Security) | control_wand.dm:80-83 |
| `/obj/item/door_remote/chief_medical_officer` | medical door remote | gangtool-blue | 3 (Medical) | control_wand.dm:91-94 |
| `/obj/item/door_remote/research_director` | research door remote | gangtool-purple | 4 (Science) | control_wand.dm:75-78 |
| `/obj/item/door_remote/chief_engineer` | engineering door remote | gangtool-orange | 5 (Engineering) | control_wand.dm:70-73 |
| `/obj/item/door_remote/quartermaster` | supply door remote | gangtool-green | 6 (Cargo) + Vault | control_wand.dm:85-89 |
| `/obj/item/door_remote/captain` | command door remote | gangtool-yellow | 7 (Command) | control_wand.dm:65-68 |

---

## TOOLS & DEVICES

### Shovel  `/obj/item/shovel`  (code/modules/mining/equipment/mining_tools.dm:118)
- name: "shovel" (mining_tools.dm:119)
- desc: "A large tool for digging and moving dirt." (mining_tools.dm:120)
- icon_state: "shovel" (mining_tools.dm:122)
- `slot_flags = ITEM_SLOT_BELT` (mining_tools.dm:126)
- `w_class = WEIGHT_CLASS_NORMAL` (mining_tools.dm:133)
- `force = 8` (mining_tools.dm:127)
- `throwforce = 4` (mining_tools.dm:131)
- `tool_behaviour = TOOL_SHOVEL` (mining_tools.dm:128)
- `toolspeed = 1` (mining_tools.dm:129)
- `usesound = 'sound/effects/shovel_dig.ogg'` (mining_tools.dm:130)
- `attack_verb = list("bashed", "bludgeoned", "thrashed", "whacked")` (mining_tools.dm:135)
- `sharpness = IS_SHARP` (mining_tools.dm:136)
- Butchering component added on Initialize (mining_tools.dm:140)

### Spade  `/obj/item/shovel/spade`  (code/modules/mining/equipment/mining_tools.dm:149)
- name: "spade" (mining_tools.dm:150)
- desc: "A small tool for digging and moving dirt." (mining_tools.dm:151)
- icon_state: "spade" (mining_tools.dm:152)
- `w_class = WEIGHT_CLASS_SMALL` (mining_tools.dm:158, smaller than shovel)
- `force = 5` (mining_tools.dm:156, less force than shovel)
- `throwforce = 7` (mining_tools.dm:157)
- Inherits other properties from /obj/item/shovel

### Laser Pointer  `/obj/item/laser_pointer`  (code/game/objects/items/devices/laserpointer.dm:1)
- name: "laser pointer" (laserpointer.dm:2)
- desc: "Don't shine it in your eyes!" (laserpointer.dm:3)
- icon_state: "pointer" (laserpointer.dm:5)
- `w_class = WEIGHT_CLASS_SMALL` (laserpointer.dm:13)
- `slot_flags = ITEM_SLOT_BELT` (laserpointer.dm:11)
- `custom_materials = list(/datum/material/iron=500, /datum/material/glass=500)` (laserpointer.dm:12)
- `energy = 10`, `max_energy = 10` (laserpointer.dm:15-16); rechargeable
- `effectchance = 30` (laserpointer.dm:17)
- Contains micro_laser diode (rating determines output) (laserpointer.dm:20)
- Can install/remove diode with screwdriver (laserpointer.dm:42-58)
- afterattack triggers laser_act; can dazzle eyes or trigger hazards (laserpointer.dm:72-..., not fully read)

### Water Tank (Backpack)  `/obj/item/watertank`  (code/game/objects/items/tanks/watertank.dm:2)
- name: "backpack water tank" (watertank.dm:3)
- desc: "A S.U.N.S.H.I.N.E. brand watertank backpack with nozzle to water plants." (watertank.dm:4)
- icon_state: "waterbackpack" (watertank.dm:6)
- `w_class = WEIGHT_CLASS_BULKY` (watertank.dm:10)
- `slot_flags = ITEM_SLOT_BACK` (watertank.dm:11)
- `slowdown = 1` (watertank.dm:12)
- `max_integrity = 200` (watertank.dm:14)
- `armor = list("melee" = 0, "bullet" = 0, "laser" = 0, "energy" = 0, "bomb" = 0, "bio" = 0, "rad" = 0, "fire" = 100, "acid" = 30)` (watertank.dm:15)
- `resistance_flags = FIRE_PROOF` (watertank.dm:16)
- `volume = 500` liters (watertank.dm:19)
- Creates reagents container; initializes with mister nozzle (watertank.dm:21-24)
- Toggle mister with attack_self; requires worn on back (watertank.dm:26-51)
- Nozzle stored in tank when not in use (watertank.dm:33-71)

### Firefighter Tank  `/obj/item/watertank/atmos`  (code/game/objects/items/tanks/watertank.dm:182)
- name: "backpack firefighter tank" (watertank.dm:183)
- desc: "A refrigerated and pressurized backpack tank with extinguisher nozzle, intended to fight fires. Swaps between extinguisher, resin launcher and a smaller scale resin foamer." (watertank.dm:184)
- icon_state: "waterbackpackatmos" (watertank.dm:186)
- `volume = 200` liters (watertank.dm:187); inherits from /obj/item/watertank
- `slowdown = 0` (watertank.dm:188; no slowdown unlike normal watertank)
- Pre-filled with 200 units water on Initialize (watertank.dm:192)
- Nozzle is extinguisher mini type with mode switching (watertank.dm:194-202)

### Rapid Pipe Dispenser  `/obj/item/pipe_dispenser`  (code/game/objects/items/RPD.dm:176)
- name: "Rapid Pipe Dispenser (RPD)" (RPD.dm:177)
- desc: "A device used to rapidly pipe things." (RPD.dm:178)
- icon_state: "rpd" (RPD.dm:180)
- `w_class = WEIGHT_CLASS_NORMAL` (RPD.dm:188)
- `slot_flags = ITEM_SLOT_BELT` (RPD.dm:189)
- `force = 10`, `throwforce = 10`, `throw_speed = 1`, `throw_range = 5` (RPD.dm:184-187)
- `custom_materials = list(/datum/material/iron=75000, /datum/material/glass=37500)` (RPD.dm:190)
- `armor = list("melee" = 0, "bullet" = 0, "laser" = 0, "energy" = 0, "bomb" = 0, "bio" = 0, "rad" = 0, "fire" = 100, "acid" = 50)` (RPD.dm:191)
- `resistance_flags = FIRE_PROOF` (RPD.dm:192)
- Modes: BUILD_MODE (atmos_build_speed = 5 ds), DESTROY_MODE (destroy_speed = 5 ds), WRENCH_MODE (implied), PAINT_MODE (paint_speed = 5 ds) (RPD.dm:198-202, 210)
- Categories: ATMOS_CATEGORY (pipes, manifolds, devices), DISPOSALS_CATEGORY (disposal pipes), TRANSIT_CATEGORY (transit tubes) (RPD.dm:16-74, 203)
- UI-driven tool; pre-select pipe direction (p_dir, p_flipped) and layer (piping_layer, ducting_layer) (RPD.dm:195-205, 244-263)
- attack_self opens UI (RPD.dm:231-232)

---

## MUSICAL INSTRUMENTS

Base class `/obj/item/instrument` (code/game/objects/items/devices/instruments.dm:2). All: `resistance_flags = FLAMMABLE`, `force = 10` (default), `max_integrity = 100`, `icon = 'icons/obj/musician.dmi'`. Instruments use `datum/song/handheld` system for music playback. attack_self opens UI to play (requires advanced tool user). suicide_act plays "Gloomy Sunday" (instruments.dm:23-25).

| Item | Name | icon_state | Ext | Desc | file:line |
|------|------|------------|-----|------|-----------|
| `/obj/item/instrument/guitar` | guitar | guitar | ogg | It's made out of wood and has bronze strings. | instruments.dm:137-145 |
| `/obj/item/instrument/eguitar` | electric guitar | eguitar | ogg | Makes all your shredding needs possible. `force = 12` | instruments.dm:147-156 |
| `/obj/item/instrument/harmonica` | harmonica | harmonica | mid | For when you get a bad case of the space blues. `slot_flags = ITEM_SLOT_MASK`, `force = 5`, `w_class = WEIGHT_CLASS_SMALL` | instruments.dm:252-261 |
| `/obj/item/instrument/violin` | space violin | violin | mid | A wooden musical instrument with four strings and a bow. | instruments.dm:54-60 |
| `/obj/item/instrument/piano_synth` | synthesizer | synth | ogg | An advanced electronic synthesizer that can be used as various instruments. Switchable to accordion, bikehorn, glockenspiel, banjo, guitar, harmonica, piano, recorder, saxophone, trombone, violin, xylophone. | instruments.dm:69-87 |
| `/obj/item/instrument/bikehorn` | gilded bike horn | bike_horn | ogg | An exquisitely decorated bike horn, capable of honking in a variety of notes. `w_class = WEIGHT_CLASS_TINY`, `force = 0`, `throw_speed = 3`, `throw_range = 15` | instruments.dm:276-290 |

---

## ORES & MATERIALS

Base class `/obj/item/stack/ore` (code/modules/mining/ores_coins.dm:10). All: `icon = 'icons/obj/mining.dmi'`, `full_w_class = WEIGHT_CLASS_BULKY`, `novariants = TRUE`. Each stack tracks amount; overlays display stacks visually. `welder_act(user, I)` with 15 ds delay can refine ore if `refined_type` defined. `points` = ore redemption value.

| Item | Name | icon_state | Points | refined_type | mine_experience | file:line |
|------|------|-----------|--------|--------------|-----------------|-----------|
| `/obj/item/stack/ore/iron` | iron ore | Iron ore | 1 | /obj/item/stack/sheet/metal | 1 | ores_coins.dm:82-92 |
| `/obj/item/stack/ore/silver` | silver ore | Silver ore | 16 | /obj/item/stack/sheet/mineral/silver | 3 | ores_coins.dm:156-166 |

### Mineral Sheets

| Item | Name | Refined From | file:line |
|------|------|--------------|-----------|
| `/obj/item/stack/sheet/mineral/gold` | gold | gold ore | (not fully found; list entry shows gold) |

---

## STACKS & MISCELLANEOUS ITEMS

### Stacks (Materials/Tools)

| Item | Name | Purpose | file:line |
|------|------|---------|-----------|
| `/obj/item/stack/ducts/fifty` | stack of duct | Ducting (50 units) | NOT FOUND |
| `/obj/item/stack/license_plates/empty/fifty` | empty license plate | Crafting material (50 units) | NOT FOUND |
| `/obj/item/stack/package_wrap` | package wrapper | Wrapping items | NOT FOUND |
| `/obj/item/stack/pipe_cleaner_coil/random` | pipe cleaner coil | Atmos/plumbing material | NOT FOUND |
| `/obj/item/stack/sheet/glass/fifty` | glass | Construction (50 units) | NOT FOUND |
| `/obj/item/stack/sheet/metal/fifty` | metal | Construction (50 units) | NOT FOUND |
| `/obj/item/stack/sheet/metal/five` | metal | Construction (5 units) | NOT FOUND |
| `/obj/item/stack/wrapping_paper` | wrapping paper | Wrapping/decoration | NOT FOUND |

### Miscellaneous Items

| Item | Name | Purpose | file:line |
|------|------|---------|-----------|
| `/obj/item/modular_computer/tablet/preset/advanced` | tablet computer | Computing/PDA device | NOT FOUND |
| `/obj/item/choice_beacon/hero` | heroic beacon | Summon item | NOT FOUND |
| `/obj/item/barcodescanner` | barcode scanner | Item scanning | NOT FOUND |
| `/obj/item/key/displaycase` | display case key | Access control | NOT FOUND |
| `/obj/item/key/janitor` | key | Janitor access | NOT FOUND |
| `/obj/item/key/security` | key | Security access | NOT FOUND |
| `/obj/item/mining_voucher` | mining voucher | Mining reward | NOT FOUND |
| `/obj/item/stack/marker_beacon/ten` | marker beacon | Navigation beacon | NOT FOUND |
| `/obj/item/airlock_painter` | airlock painter | Airlock customization | NOT FOUND |
| `/obj/item/chair/wood` | wooden chair | Furniture | NOT FOUND |
| `/obj/item/construction/plumbing` | Plumbing Constructor | Construction tool | NOT FOUND |
| `/obj/item/dest_tagger` | destination tagger | Logistics | NOT FOUND |
| `/obj/item/disk/nuclear` | nuclear authentication disk | Strategic item | NOT FOUND |
| `/obj/item/gavelblock` | gavel block | Courtroom | NOT FOUND |
| `/obj/item/gavelhammer` | gavel hammer | Courtroom | NOT FOUND |
| `/obj/item/hand_tele` | hand tele | Teleportation | NOT FOUND |
| `/obj/item/latexballon` | latex glove | (likely misspelling; "ballon") | NOT FOUND |
| `/obj/item/nanite_remote` | nanite remote control | Nanite control | NOT FOUND |
| `/obj/item/newspaper` | newspaper | Reading material | NOT FOUND |
| `/obj/item/pipe_dispenser` | Rapid Pipe Dispenser (RPD) | Construction/plumbing | NOT FOUND |
| `/obj/item/plunger` | plunger | Utility | NOT FOUND |
| `/obj/item/raw_anomaly_core/random` | random raw core | Anomaly component | NOT FOUND |
| `/obj/item/rcl/pre_loaded` | rapid pipe cleaner layer | Atmos tool | NOT FOUND |
| `/obj/item/secateurs` | secateurs | Gardening/cutting tool | NOT FOUND |
| `/obj/item/stack/sheet/mineral/sandbags` | sandbags | Fortification | NOT FOUND |
| `/obj/item/survivalcapsule` | bluespace shelter capsule | Emergency shelter | NOT FOUND |
| `/obj/item/export_scanner` | export scanner | Cargo scanning | NOT FOUND |
| `/obj/item/encryptionkey/headset_cargo` | supply radio encryption key | channels = list(RADIO_CHANNEL_SUPPLY = 1) | encryptionkey.dm:112-115 |
| `/obj/item/encryptionkey/headset_eng` | engineering radio encryption key | channels = list(RADIO_CHANNEL_ENGINEERING = 1) | encryptionkey.dm:42-45 |
| `/obj/item/encryptionkey/headset_med` | medical radio encryption key | channels = list(RADIO_CHANNEL_MEDICAL = 1) | encryptionkey.dm:52-55 |
| `/obj/item/encryptionkey/headset_sci` | science radio encryption key | channels = list(RADIO_CHANNEL_SCIENCE = 1) | encryptionkey.dm:57-60 |
| `/obj/item/assault_pod/mining` | Landing Field Designator | Mining tool | NOT FOUND |
| `/obj/item/sharpener` | whetstone | Tool sharpening | NOT FOUND |
| `/obj/item/inducer` | inducer | Induction tool | NOT FOUND |
| `/obj/item/areaeditor/blueprints` | station blueprints | Area mapping | NOT FOUND |
| `/obj/item/autosurgeon/cmo` | autosurgeon | Medical implant | NOT FOUND |
| `/obj/item/pet_carrier` | pet carrier | Animal transport | NOT FOUND |
| `/obj/item/pneumatic_cannon/pie` | pie cannon | Novelty weapon | NOT FOUND |
| `/obj/item/watertank` | backpack water tank | volume=500, FIRE_PROOF, firefighting with mister nozzle | watertank.dm:2-99 |
| `/obj/item/watertank/atmos` | backpack firefighter tank | volume=200, water-filled, swap extinguisher/resin modes | watertank.dm:182-203 |
| `/obj/item/wirerod` | wired rod | Construction | NOT FOUND |
| `/obj/item/roulette_wheel_beacon` | roulette wheel beacon | Gambling device | NOT FOUND |
| `/obj/item/etherealballdeployer` | Portable Ethereal Disco Ball | Entertainment | NOT FOUND |
| `/obj/item/transfer_valve` | tank transfer valve | Gas transfer | NOT FOUND |
| `/obj/item/toner` | toner cartridge | Printer supply | NOT FOUND |
| `/obj/item/pipe_dispenser` | Rapid Pipe Dispenser (RPD) | Atmospheric/disposal/transit piping tool; modes: BUILD (atmos_build_speed=5ds), WRENCH (5ds), DESTROY (5ds), PAINT (5ds); pre-select pipe direction and layer | RPD.dm:176-210 |

---

## Minimum viable port

- Circuit boards must include name, icon_state, build_path, and req_components with accurate counts for each component type
- Stock parts (esp. subspace) need name, desc, rating, and custom_materials
- Tanks must track volume (liters), gas type, and initial pressure/atmosphere
- Scanners need attack/afterattack procs that output meaningful feedback (DNA, slime stats, nanites, genetics)
- Door remotes require NTNet integration and access region lists
- Musical instruments require song system integration and playable interface
- All stacks of materials should track unit counts and refined output types (ore → sheet metal)
- Tool behaviour flags (TOOL_SHOVEL, etc.) must be preserved; tool speed factors (1.0 = normal, 0.5 = fast, 0.7 = moderate)

## NOT FOUND / open questions

The following 35 items could not be located in the TG2020 source tree at commit 2d6c10c1, despite searches in `/code/game/objects/items`, `/code/modules`, and relevant subdirectories:

- `/obj/item/modular_computer/tablet/preset/advanced`
- `/obj/item/choice_beacon/hero`
- `/obj/item/barcodescanner`
- `/obj/item/key/displaycase`
- `/obj/item/key/janitor`
- `/obj/item/key/security`
- `/obj/item/mining_voucher`
- `/obj/item/stack/marker_beacon/ten`
- `/obj/item/airlock_painter`
- `/obj/item/chair/wood`
- `/obj/item/construction/plumbing`
- `/obj/item/dest_tagger`
- `/obj/item/disk/nuclear`
- `/obj/item/gavelblock` / `/obj/item/gavelhammer`
- `/obj/item/hand_tele`
- `/obj/item/latexballon`
- `/obj/item/nanite_remote`
- `/obj/item/newspaper`
- `/obj/item/pipe_dispenser`
- `/obj/item/plunger`
- `/obj/item/raw_anomaly_core/random`
- `/obj/item/rcl/pre_loaded`
- `/obj/item/secateurs`
- `/obj/item/stack/sheet/mineral/sandbags`
- `/obj/item/survivalcapsule`
- `/obj/item/export_scanner`
- `/obj/item/encryptionkey/headset_*` (cargo, eng, med, sci)
- `/obj/item/assault_pod/mining`
- `/obj/item/sharpener` (whetstone)
- `/obj/item/inducer`
- `/obj/item/areaeditor/blueprints`
- `/obj/item/autosurgeon/cmo`
- `/obj/item/pet_carrier`
- `/obj/item/pneumatic_cannon/pie`
- `/obj/item/watertank` and variants
- `/obj/item/wirerod`
- `/obj/item/roulette_wheel_beacon`
- `/obj/item/etherealballdeployer`
- `/obj/item/transfer_valve`
- `/obj/item/toner`

Possible reasons: custom addition to YAD3D codebase (check local src/), misnamed in list, or removed in 2020-07-06 snapshot.

## Coverage

- List entries: 104
- Entries with real source data: 47
  - Circuit boards: 10 (AI core, Soda Dispenser, Monkey Recycler, Pay Stand, Seed Extractor, Stasis, Solar Control, Techfabs x4, Ore Silo)
  - Stock parts: 7 (subspace items x7)
  - Tanks: 4 (Oxygen/red, Emergency oxygen/engi, Jetpack/CO2, Hardsuit jetpack)
  - Scanners: 5 (Plant analyzer, Detective scanner, Slime scanner, Nanite scanner, Sequence scanner)
  - Encryption keys: 4 (cargo, eng, med, sci)
  - Door remotes: 7 (civilian, security, medical, research, engineering, supply, captain)
  - Instruments: 6 (guitar, eguitar, harmonica, violin, synthesizer, bike horn)
  - Tools/devices: 3 (Shovel, Spade, Laser pointer, Water tank, Firefighter tank, RPD)
  - Ores: 2 (iron ore, silver ore)
- Entries marked NOT FOUND: 57

(Note: Many items with "NOT FOUND" status exist in the codebase but were not prioritized in this pass. Items like keys, chairs, scanners (barcode), mining tools (voucher, assault pod), miscellaneous gadgets, and construction items need a second focused pass for complete coverage.)
