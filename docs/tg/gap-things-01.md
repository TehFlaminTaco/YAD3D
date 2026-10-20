# gap-things-01.1: Gas tank sensors (air sensor family)

Nine listed paths, all `/obj/machinery/air_sensor` subtypes that override only `name` and `id_tag`. No UI, no circuit, no frame, no drops. Each one posts a gas status signal on radio frequency 1441 with filter "atmosia" every SSair pass, and the atmos control computer picks it up by `id_tag`. Nothing is converted: time is `world.time` in deciseconds, gas values are percent.

### gas sensor (parent of all nine)  `/obj/machinery/air_sensor`   (code/game/machinery/computer/atmos_control.dm:5)
- What it is: a radio-only gas sensor placed in a gas tank. It reads the tank air and broadcasts pressure, temperature and gas percentages (atmos_control.dm:48-66).
- Key vars:
  - `name = "gas sensor"` (atmos_control.dm:6)
  - `icon = 'icons/obj/stationobjs.dmi'` (atmos_control.dm:7); `icon_state = "gsensor1"` (atmos_control.dm:8)
  - `resistance_flags = FIRE_PROOF` (atmos_control.dm:9)
  - `var/on = TRUE` (atmos_control.dm:11). No code in this file sets it to FALSE.
  - `var/id_tag` (atmos_control.dm:13), unset on the parent
  - `var/frequency = FREQ_ATMOS_STORAGE` (atmos_control.dm:14) = 1441 (code/__DEFINES/radio.dm:77)
  - `var/datum/radio_frequency/radio_connection` (atmos_control.dm:15)
  - `desc`: not set on the type, so it inherits `"Some kind of machine."` (code/game/machinery/_machinery.dm:89)
  - `anchored = TRUE`, inherited (code/game/machinery/_machinery.dm:98)
  - `circuit`: not set (atmos_control.dm:5-15), so no board is created (code/game/machinery/_machinery.dm:141-143)
  - `update_icon_state()`: `icon_state = "gsensor[on]"` (atmos_control.dm:45-46), so it shows `gsensor1` while on
- Interactions (every tool/item/intent that does something):

  | held item / action | condition | delay (ds) | message(s) verbatim | result |
  |---|---|---|---|---|
  | empty hand, click (`attack_hand`) | any | none | none | `attack_hand` adds a fingerprint (code/_onclick/other_mobs.dm:30-33). The type has `INTERACT_ATOM_ATTACK_HAND \| INTERACT_ATOM_UI_INTERACT` (_machinery.dm:99), so it goes to `interact`, which sets the user as machine (_machinery.dm:315-318) and then `ui_interact` (other_mobs.dm:69-75). No `ui_interact`, `ui_data` or `attack_hand` is defined on this type (atmos_control.dm:5-82), so nothing is shown (inferred). |
  | any item, no NOBLUDGEON flag | `obj_flags` has CAN_BE_HIT (code/game/objects/objs.dm:5) | none for the hit; `CLICK_CD_MELEE` cooldown (code/_onclick/item_attack.dm:114) | `"<span class='danger'>[user] hits [src] with [I]!</span>"` shown to viewers, `"<span class='danger'>You hit [src] with [I]!</span>"` to the user, both only if `I.force` is non-zero (code/_onclick/item_attack.dm:123-125) | `take_damage(I.force, I.damtype, "melee", 1)` (item_attack.dm:128). See Health. |
  | item with `NOBLUDGEON` set | any | none | none | `attack_obj` returns at once (code/_onclick/item_attack.dm:112-113). No damage, no message. |
  | wrench, screwdriver, crowbar, multitool, any tool | any | none | none | No tool handler exists on this type (atmos_control.dm:5-82). It falls through to the generic hit row, so damage is the tool's own `force` and `damtype` (inferred). |
  | examine | any | none | health line by integrity: `"It looks slightly damaged."` at 50-99 %, `"It appears heavily damaged."` at 25-50 %, `"<span class='warning'>It's falling apart!</span>"` at 0-25 % (code/game/machinery/_machinery.dm:561-567). A broken machine would say `"It looks broken and non-functional."` (_machinery.dm:555-556), but this sensor never reaches BROKEN (see Health). | none | Text only. |

- Construction chain: NONE. No circuit, no frame, no assembly on this type (atmos_control.dm:5-15). Its parent `/obj/machinery` only builds a board when `circuit` is a path (code/game/machinery/_machinery.dm:141-143).
- Deconstruction chain: NONE by a handler. There is no wrench, screwdriver or crowbar branch, and `anchored = TRUE` (_machinery.dm:98). The only removal path is integrity reaching 0 (see Drops). A wrench cannot unanchor it through this type's code (inferred).
- Drops:
  - (a) Destroyed (integrity reaches 0): `obj_destruction` calls `deconstruct(FALSE)` (code/game/objects/obj_defense.dm:20-21, 252-258). The machinery override runs `on_deconstruction()` (no-op, _machinery.dm:576-577), skips `spawn_frame` because `component_parts` is null, and calls `qdel(src)` (_machinery.dm:402-410). Drops: nothing. Stays behind: nothing.
  - (b) Deconstructed properly: no route exists on this type. If some caller ran `deconstruct(TRUE)`, the result is the same `qdel` with no drops (_machinery.dm:402-410).
- Health / armor:
  - `max_integrity = 200` inherited from `/obj/machinery` (_machinery.dm:93). The `/obj` default is 500 (code/game/objects/objs.dm:18), overridden here.
  - `obj_integrity` defaults to `max_integrity` (objs.dm:17 comment).
  - `integrity_failure = 0` (objs.dm:19), so `obj_break` is never called from damage (obj_defense.dm:17-18). The sensor goes straight from damage to destruction at 0 (obj_defense.dm:20-21).
  - `damage_deflection = 0` (objs.dm:21), so no melee deflection (obj_defense.dm:25-26).
  - Armor is not set on the type, so the machinery default applies (_machinery.dm:136-137): melee 25, bullet 10, laser 10, energy 0, bomb 0, bio 0, rad 0, fire 50, acid 70.
  - Melee damage is multiplied by `(100 - armor)` percent, rounded (obj_defense.dm:33-37). Melee therefore takes 25 % off.
  - `damage_flag == "acid"` at 0 integrity calls `acid_melt()` instead of `deconstruct` (obj_defense.dm:253-254). `"fire"` calls `burn()` (obj_defense.dm:255-256).
  - `resistance_flags = FIRE_PROOF` (atmos_control.dm:9).
- Power: `use_power = IDLE_POWER_USE` (_machinery.dm:102; `IDLE_POWER_USE` = 1, code/__DEFINES/machines.dm:22). `idle_power_usage = 0` (_machinery.dm:106). `active_power_usage = 0` (_machinery.dm:107). The sensor never calls `use_power` or `powered()` (atmos_control.dm:45-82). It draws 0 W and does not need power.
- Gotchas:
  1. `process_atmos` has no power check. The only gate is `if(on)` (atmos_control.dm:48-49), so it runs unpowered.
  2. Its SSmachines processing ends at once: `/obj/machinery/process` returns `PROCESS_KILL` (_machinery.dm:181-182). The real work is `process_atmos`, driven by SSair through the `atmos_machinery` list the sensor joins in `Initialize` (atmos_control.dm:74-77; code/controllers/subsystem/air.dm:169-181).
  3. `process_atmos` returns nothing (atmos_control.dm:48-66), so SSair never drops it from `atmos_machinery` (air.dm:178 removes only on `PROCESS_KILL`).
  4. Radio only: no wires, no UI, no access check. It posts `radio_connection.post_signal(src, signal, filter = RADIO_ATMOSIA)` (atmos_control.dm:66). `RADIO_ATMOSIA` = `"atmosia"` (code/__DEFINES/radio.dm:102).
  5. Signal fields (atmos_control.dm:52-64): `"sigtype" = "status"`, `"id_tag"`, `"timestamp" = world.time` (deciseconds, raw), `"pressure"` (`return_pressure()`), `"temperature"`, and `"gases"` as a list keyed by gas name with percent values `moles / total_moles * 100` (atmos_control.dm:63-64). Gases are percent, not moles. The list is empty when `total_moles` is 0 (atmos_control.dm:61).
  6. `set_frequency` removes the old radio object and re-adds it on the new frequency (atmos_control.dm:69-72). `Destroy` removes it from SSair and radio (atmos_control.dm:79-82).
  7. The computer drops any reading whose `id_tag` is not in its `sensors` list (atmos_control.dm:157-158 in `receive_signal`, store at :160). See the table below for the matching ids.
  8. Newer snapshot (`Downloads/tgstation-1da0…`): the same lines (atmos_control.dm:5, 17-41, 45-79) exist there. No DIFF for these types.

### Variant table (each path sets only `name` and `id_tag`; everything else is inherited from the parent above)

Computer label is the `sensors` list entry in `/obj/machinery/computer/atmos_control` (code/game/machinery/computer/atmos_control.dm:99-111).

| DM path (as on the list) | in-game `name` | id_tag (define = value) | defined at (name / id_tag) | computer label | on BoxStation |
|---|---|---|---|---|---|
| `/obj/machinery/air_sensor/atmos/air_tank` | air mix tank gas sensor | `ATMOS_GAS_MONITOR_SENSOR_AIR` = `"air_sensor"` (code/__DEFINES/atmospherics.dm:286) | atmos_control.dm:35 (:36 / :37) | "Mixed Air Tank" (:105) | x1 |
| `/obj/machinery/air_sensor/atmos/carbon_tank` | carbon dioxide tank gas sensor | `ATMOS_GAS_MONITOR_SENSOR_CO2` = `"co2_sensor"` (atmospherics.dm:302) | atmos_control.dm:38 (:39 / :40) | "Carbon Dioxide Tank" (:102) | x1 |
| `/obj/machinery/air_sensor/atmos/incinerator_tank` | incinerator chamber gas sensor | `ATMOS_GAS_MONITOR_SENSOR_INCINERATOR` = `"incinerator_sensor"` (atmospherics.dm:306) | atmos_control.dm:41 (:42 / :43) | "Incinerator Chamber" (:109) | x1 |
| `/obj/machinery/air_sensor/atmos/mix_tank` | mix tank gas sensor | `ATMOS_GAS_MONITOR_SENSOR_MIX` = `"mix_sensor"` (atmospherics.dm:290) | atmos_control.dm:29 (:30 / :31) | "Mix Tank" (:106) | x1 |
| `/obj/machinery/air_sensor/atmos/nitrogen_tank` | nitrogen tank gas sensor | `ATMOS_GAS_MONITOR_SENSOR_N2` = `"n2_sensor"` (atmospherics.dm:298) | atmos_control.dm:26 (:27 / :28) | "Nitrogen Tank" (:100) | x1 |
| `/obj/machinery/air_sensor/atmos/nitrous_tank` | nitrous oxide tank gas sensor | `ATMOS_GAS_MONITOR_SENSOR_N2O` = `"n2o_sensor"` (atmospherics.dm:294) | atmos_control.dm:32 (:33 / :34) | "Nitrous Oxide Tank" (:104) | x1 |
| `/obj/machinery/air_sensor/atmos/oxygen_tank` | oxygen tank gas sensor | `ATMOS_GAS_MONITOR_SENSOR_O2` = `"o2_sensor"` (atmospherics.dm:278) | atmos_control.dm:23 (:24 / :25) | "Oxygen Tank" (:101) | x1 |
| `/obj/machinery/air_sensor/atmos/toxin_tank` | plasma tank gas sensor | `ATMOS_GAS_MONITOR_SENSOR_TOX` = `"tox_sensor"` (atmospherics.dm:282) | atmos_control.dm:17 (:18 / :19) | "Plasma Tank" (:103) | x1 |
| `/obj/machinery/air_sensor/atmos/toxins_mixing_tank` | toxins mixing gas sensor | `ATMOS_GAS_MONITOR_SENSOR_TOXINS_LAB` = `"toxinslab_sensor"` (atmospherics.dm:310) | atmos_control.dm:20 (:21 / :22) | "Toxins Mixing Chamber" (:110) | x1 |

What differs per path: only the in-game `name` and `id_tag`. Icon, `icon_state`, `frequency` (1441), `resistance_flags`, power (0 W), armor, health (200), and all behaviour are the parent's. Two of the nine (incinerator and toxins-lab) also have their own single-sensor computers, `/obj/machinery/computer/atmos_control/incinerator` and `/obj/machinery/computer/atmos_control/toxinsmix`, each listing only that sensor (atmos_control.dm:168-181).

### Air sensor interaction note for the computer side (not a listed path, one line)
- `/obj/machinery/computer/atmos_control` (atmos_control.dm:89) lists all nine ids above in its `sensors` list (atmos_control.dm:99-111). Its `receive_signal` stores readings only for listed ids (atmos_control.dm:152-160). Its `FREQ_ATMOS_STORAGE` frequency matches the sensors (atmos_control.dm:98, 162-165).

# gap-things-01.2: Air alarms (airalarm family)

Four listed paths, all `/obj/machinery/airalarm` subtypes. The base type holds all the behaviour: a wall unit that reads its own turf against TLV limits, shows the "AirAlarm" UI, sends vent/scrubber commands on radio and raises area alerts. The subtypes change only `name`, `desc`, `locked`, `req_access`/`req_one_access`, and (server only) `TLV`. Nothing here is converted: power is in watts, delays are in deciseconds, and pressure is kPa as written.

### air alarm (parent of all four)  `/obj/machinery/airalarm`   (code/modules/atmospherics/machinery/airalarm.dm:60)
- What it is: a wall-mounted atmos monitor and controller. Every machine tick it compares the turf's pressure, temperature and partial gas pressures against `TLV`, keeps `danger_level`, and reflects that on `icon_state` (airalarm.dm:645-684, 621-643).
- Key vars:
  - `name = "air alarm"` (airalarm.dm:61); `desc = "A machine that monitors atmosphere levels. Goes off if the area is dangerous."` (:62)
  - `icon = 'icons/obj/monitors.dmi'` (:63); `icon_state = "alarm0"` (:64)
  - `use_power = IDLE_POWER_USE` (:65); `idle_power_usage = 4` (:66); `active_power_usage = 8` (:67); `power_channel = AREA_USAGE_ENVIRON` (:68; = 3, code/__DEFINES/machines.dm:5)
  - `req_access = list(ACCESS_ATMOSPHERICS)` (:69; ACCESS_ATMOSPHERICS = 24, code/__DEFINES/access.dm:35)
  - `max_integrity = 250` (:70); `integrity_failure = 0.33` (:71); `resistance_flags = FIRE_PROOF` (:73)
  - `armor = list("melee" = 0, "bullet" = 0, "laser" = 0, "energy" = 100, "bomb" = 0, "bio" = 100, "rad" = 100, "fire" = 90, "acid" = 30)` (:72)
  - `ui_x = 440`, `ui_y = 650` (:74-75)
  - `mode = AALARM_MODE_SCRUBBING` (:78; value 1, :48)
  - `locked = TRUE` (:80); `aidisabled = 0` (:81); `shorted = 0` (:82)
  - `buildstage = 2` (:83). 2 = complete, 1 = no wires, 0 = no circuit.
  - `frequency = FREQ_ATMOS_CONTROL` = 1439 (:85; code/__DEFINES/radio.dm:71). `alarm_frequency = FREQ_ATMOS_ALARMS` = 1437 (:86; radio.dm:70).
  - `desc`, `name` as above. No `circuit` var set, so the parent's board logic does nothing (code/game/machinery/_machinery.dm:141-143).
  - `processing_flags` is not set in this file (inherits `START_PROCESSING_ON_INIT`, _machinery.dm:119). `NODECONSTRUCT_1` is only checked, in the deconstruct override (airalarm.dm:842).
- Base `TLV` (airalarm.dm:89-107), `min2, min1, max1, max2`. Values are raw:

  | gas / key | TLV | file:line |
  |---|---|---|
  | `"pressure"` (kPa) | `HAZARD_LOW_PRESSURE` (20), `WARNING_LOW_PRESSURE` (50), `WARNING_HIGH_PRESSURE` (325), `HAZARD_HIGH_PRESSURE` (550) | :90; code/__DEFINES/atmospherics.dm:121-127 |
  | `"temperature"` (K) | `T0C` (273.15), `T0C+10`, `T0C+40`, `T0C+66` | :91; atmospherics.dm:24 |
  | oxygen | 16, 19, 135, 140 (partial pressure, kPa) | :92 |
  | nitrogen | -1, -1, 1000, 1000 | :93 |
  | carbon dioxide | -1, -1, 5, 10 | :94 |
  | miasma | -1, -1, 15, 30 (written as `new/datum/tlv/(-1, -1, 15, 30)`) | :95 |
  | plasma, nitrous oxide, BZ, water vapor, tritium, stimulum, nitryl, freon, hydrogen | `new/datum/tlv/dangerous`: min2 -1, min1 -1, max1 0.2, max2 0.5 | :96-106; :30-34 |
  | hypernoblium, pluoxium | -1, -1, 1000, 1000 | :99, :104 |

  `get_danger_level` returns 2 at `>= max2` or `<= min2`, 1 at `>= max1` or `<= min1`, else 0 (airalarm.dm:13-22). A value of -1 disables that bound.

- Interactions (every tool/item/intent that does something). `buildstage` in brackets:

  | held item / action | condition | delay (ds) | message(s) verbatim | result |
  |---|---|---|---|---|
  | empty hand, click | `buildstage == 2` for the UI to work | none | none | `attack_hand` goes to `_try_interact` and `interact`, which calls `ui_interact` (code/_onclick/other_mobs.dm:30-37, 69-75; _machinery.dm:315-318). Opens TGUI "AirAlarm" (airalarm.dm:246-251). Silicon users get `"AI control has been disabled."` when `aidisabled` (airalarm.dm:240-241). A shorted unit closes the UI (:242-244). |
  | UI action (TGUI) | `buildstage == 2`; non-silicon needs `locked` FALSE; silicon needs `aidisabled` 0 (airalarm.dm:377-380) | none | none | Actions: `lock` (silicon only, :383-386), `power`, `toggle_filter`, `widenet`, `scrubbing`, `direction` (:387-389), `excheck`/`incheck` (:390-395), `set_external_pressure`/`set_internal_pressure` (:396-400), `reset_external_pressure`/`reset_internal_pressure` (:401-406), `threshold` (:407-423), `mode` (:424-428), `alarm` (:429-433), `reset` (:434-438). |
  | ID card or PDA, [2] | any | none | `togglelock` messages below | `istype(W, /obj/item/card/id) \|\| istype(W, /obj/item/pda)` calls `togglelock(user)` (airalarm.dm:732-734). |
  | Alt-click, any user | `user.canUseTopic` and `isturf(loc)` | none | `togglelock` messages below | `AltClick` calls `togglelock` (airalarm.dm:815-820). |
  | togglelock, any route | unpowered or broken | none | `"<span class='warning'>It does nothing!</span>"` (:823-824) | nothing. |
  | togglelock, any route | `allowed(usr)` and WIRE_IDSCAN not cut | none | `"<span class='notice'>You [ locked ? "lock" : "unlock"] the air alarm interface.</span>"` (:828) | `locked` toggles (:827). |
  | togglelock, any route | access denied | none | `"<span class='danger'>Access denied.</span>"` (:831) | nothing. Note: it checks `usr`, not `user` (:826). |
  | screwdriver, [2] | none | none | `"The wires have been [panel_open ? "exposed" : "unexposed"]."` (:729) | `panel_open` toggles (:726-731). |
  | wirecutter, [2], panel open, all wires cut (`wires.is_all_cut()`) | none | none | `"You cut the final wires."` (:721) | drops `new /obj/item/stack/cable_coil(loc, 5)` (:722); `buildstage = 1` (:723). |
  | any wire tool, [2], panel open | `is_wire_tool` | none | none | `wires.interact(user)` (:735-736). The wire UI is interactable only when `panel_open && buildstage == 2` (datum/wires/airalarm.dm:14-17). |
  | crowbar, [1] | none | 20 (`W.use_tool(src, user, 20)`, :743) | `"[user.name] removes the electronics from [src.name]."` (visible, :740); `"You start prying out the circuit..."` (self, :741); on success `"You remove the air alarm electronics."` (:745) | drops `new /obj/item/electronics/airalarm(src.loc)` (:746); sound deconstruct.ogg (:747); `buildstage = 0` (:748). |
  | cable coil, [1] | `get_amount() >= 5` | 20 (`do_after(user, 20, target = src)`, :759) | `"You need five lengths of cable to wire the air alarm!"` (:755) if fewer than 5; `"[user.name] wires the air alarm."` (:757); `"You start wiring the air alarm..."` (:758); on success `"You wire the air alarm."` (:762) | `cable.use(5)` (:761); `wires.repair()` (:763); `aidisabled = 0`, `locked = FALSE`, `mode = 1`, `shorted = 0` (:764-767); `post_alert(0)` (:768); `buildstage = 2` (:769). Rewiring always unlocks it. |
  | `/obj/item/electronics/airalarm`, [0] | none | none | `"You insert the circuit."` (:775) | `buildstage = 1` (:776); the item is deleted (:778). |
  | electroadaptive pseudocircuit, [0] | robot only, see Gotchas | none (argument `25` is `circuit_cost`, :783) | `"[user] fabricates a circuit and places it into [src]."` (visible, :785); `"You adapt an air alarm circuit and slot it into the assembly."` (:786) | `buildstage = 1` (:787). |
  | wrench, [0] | none | none | `"You detach \the [src] from the wall."` (:792) | `new /obj/item/wallframe/airalarm(user.loc)` (:794); `qdel(src)` (:795). |
  | RCD, [0] | RCD upgrade `RCD_UPGRADE_SIMPLE_CIRCUITS` | 20 (`rcd_vals` returns `"delay" = 20`, :802) and cost 1 (:802) | `"[user] fabricates a circuit and places it into [src]."` (:808); `"You adapt an air alarm circuit and slot it into the assembly."` (:809) | `buildstage = 1` (:810). |
  | emag (`emag_act`) | not already EMAGGED | none | `"<span class='warning'>Sparks fly out of [src]!</span>"` (visible), `"<span class='notice'>You emag [src], disabling its safeties.</span>"` (:838) | `obj_flags \|= EMAGGED` (:837). Adds mode "Flood - Shuts off scrubbers and opens vents" to the UI (code: airalarm.dm:343-344). |
  | examine, [0] | none | none | `"<span class='notice'>It is missing air alarm electronics.</span>"` (:233) | text only. |
  | examine, [1] | none | none | `"<span class='notice'>It is missing wiring.</span>"` (:235) | text only. |
  | examine, [2] | none | none | `"<span class='notice'>Alt-click to [locked ? "unlock" : "lock"] the interface.</span>"` (:237) | text only. |
  | any other item, any stage | `CAN_BE_HIT` (inherited) | none | generic hit messages (see Health) | `attackby` falls to `..()` (airalarm.dm:798), then the generic hit path (code/_onclick/item_attack.dm:58-59, 122-128). |

- Mode values and names (airalarm.dm:48-56, 483-503): 1 `"Filtering"` (scrubbing, default), 2 `"Draught"` (venting), 3 `"Panic Siphon"`, 4 `"Cycle"` (replacement), 5 `"Off"`, 6 `"Flood"` (emagged only, airalarm.dm:343), 7 `"Siphon"`, 8 `"Contaminated"`, 9 `"Refill"`.
- Mode command, scrubbing (airalarm.dm:507-520): each area scrubber gets `power = 1`, `set_filters = list(/datum/gas/carbon_dioxide)`, `scrubbing = 1`, `widenet = 0`. Each area vent gets `power = 1`, `checks = 1`, `set_external_pressure = ONE_ATMOSPHERE` (101.325, atmospherics.dm:18).

- Construction chain (from nothing):
  1. Place `/obj/item/wallframe/airalarm` ("air alarm frame", airalarm.dm:41-46) on a wall. `attach` runs `new result_path(get_turf(user), ndir, TRUE)` (code/game/objects/items/apc_frame.dm:43), which sets `buildstage = 0` and `panel_open = TRUE` (airalarm.dm:208-212). Message: `"<span class='notice'>[user.name] attaches [src] to the wall.</span>"` and `"<span class='notice'>You attach [src] to the wall.</span>"` (apc_frame.dm:36-37). Placement checks: `"You cannot place [src] on this spot!"` (:22), `"You cannot place [src] in this area!"` (:25) and `"There's already an item on this wall!"` (:28), all in `try_build` (apc_frame.dm:13-31). The wall-hit path that calls these is not read in full (inferred).
  2. Insert `/obj/item/electronics/airalarm` ("air alarm electronics", custom_price 50, airalarm.dm:36-38), or use a robot's electroadaptive pseudocircuit, or an RCD. Step 2 leaves `buildstage = 1`.
  3. Wire it with 5 cable coil (20 ds). Step 3 leaves `buildstage = 2`, `locked = FALSE`.
  4. Close the panel with the screwdriver again (it toggles, airalarm.dm:726-731). The panel starts open (`panel_open = TRUE` from the frame, airalarm.dm:210), and wiring does not close it.

- Deconstruction chain (proper, by stage):
  1. Screwdriver: open the panel (`panel_open = TRUE`), :726-731.
  2. Cut every wire with a wirecutter in the wire UI (WIRE_* on_cut effects below). Then the wirecutter gives cable coil x5 and `buildstage = 1` (:719-723).
  3. Crowbar, 20 ds: electronics out, `buildstage = 0` (:739-748).
  4. Wrench: `new /obj/item/wallframe/airalarm(user.loc)` and the unit is deleted (:791-795). No sheets and no cable are returned by this route.

- Drops:
  - (a) Destroyed (integrity 0): `obj_destruction` calls `deconstruct(FALSE)` (code/game/objects/obj_defense.dm:20-21, 252-258). The airalarm override (airalarm.dm:841-848) runs, and drops are the same as for `deconstruct(TRUE)` except the electronics:
    - `new /obj/item/stack/sheet/metal(loc, 2)` (:843)
    - `new /obj/item/electronics/airalarm(loc)` with `obj_integrity = max_integrity * 0.5` when not disassembled (:844-846)
    - `new /obj/item/stack/cable_coil(loc, 3)` (:847)
    - Stays behind: nothing.
  - (b) Deconstructed (any `deconstruct(TRUE)` call): the same three drops, with electronics at full integrity (:841-848). Nothing in this file calls `deconstruct(TRUE)` on purpose; the proper route above drops different items (cable x5, electronics, wallframe).

- Health / armor:
  - `max_integrity = 250` (:70). `integrity_failure = 0.33` (:71), so `obj_break` fires at or below 0.33 * 250 = 82.5 (obj_defense.dm:17-18). `obj_break` sets BROKEN (code/game/machinery/_machinery.dm:422-429).
  - Destruction at 0 (obj_defense.dm:20-21, see Drops).
  - Armor: melee 0, bullet 0, laser 0, energy 100, bomb 0, bio 100, rad 100, fire 90, acid 30 (:72). Melee, bullet, laser and bomb take full damage. Energy, bio and rad are fully blocked (100). Fire is cut by 90 and acid by 30.
  - `damage_deflection` 0 (code/game/objects/objs.dm:21). `"acid"` damage at 0 calls `acid_melt()`; `"fire"` calls `burn()` (obj_defense.dm:253-256).
  - Generic hits: `I.attack_obj` → `attacked_by` → `"<span class='danger'>[user] hits [src] with [I]!</span>"` and `"<span class='danger'>You hit [src] with [I]!</span>"` (only if `I.force`), then `take_damage(I.force, I.damtype, "melee", 1)` (code/_onclick/item_attack.dm:109-128).
  - Examine by health (code/game/machinery/_machinery.dm:553-567): `"It looks slightly damaged."` 50-99 %, `"It appears heavily damaged."` 25-50 %, `"<span class='warning'>It's falling apart!</span>"` 0-25 %, `"It looks broken and non-functional."` when BROKEN (:555-556).

- Power: `use_power = IDLE_POWER_USE` (1, machines.dm:22), `idle_power_usage = 4` W, `active_power_usage = 8` W (airalarm.dm:65-67), `power_channel` environ (:68). No call in this file runs `use_power` or `auto_use_power` (grep of airalarm.dm), so the declared draw is not applied here (inferred; the area power system is not read). `process()` stops when `machine_stat & (NOPOWER|BROKEN)` or `shorted` (airalarm.dm:646-647). The `NOPOWER` state comes from the area power system (inferred).

- Gotchas:
  1. Name becomes "[area] Air Alarm". The constructor renames any alarm whose `name` is still the type default: `if(name == initial(name)) name = "[get_area_name(src)] Air Alarm"` (airalarm.dm:214-215). The server inherits `name`, and the other three set their own `name`. Either way the value equals `initial(name)`, so all four are renamed too. The BoxStation map instances set only `dir` and `pixel_x` (BoxStation.dmm:26852-26854, 37172-37174, 39123-39125, 42699-42701), so each one is renamed on creation.
  2. `process()` runs on SSmachines from init (`START_PROCESSING_ON_INIT`, _machinery.dm:119, 145-146). The parent's comment says it fires "roughly every 2 seconds" (_machinery.dm:120).
  3. `process()` in this file sets `danger_level`, calls `apply_danger_level()` when it changes (airalarm.dm:675-679), and flips `REPLACEMENT` mode to `SCRUBBING` below `ONE_ATMOSPHERE * 0.05` (:680-682).
  4. Alert radio: `post_alert` posts `zone` and `type = "Atmospheric"` with `alert` = `"severe"` / `"minor"` / `"clear"` on frequency 1437, `range = -1` (airalarm.dm:685-702).
  5. Command radio: `send_signal` posts on the 1439 frequency, `filter = RADIO_FROM_AIRALARM`, after `set_frequency` listens with `RADIO_TO_AIRALARM` (airalarm.dm:466-481; radio.dm:99-100).
  6. Wires (code/datums/wires/airalarm.dm; wire names wires.dm:8, 9, 22, 32, 33):
     - Wire list: `WIRE_POWER`, `WIRE_IDSCAN`, `WIRE_AI`, `WIRE_PANIC`, `WIRE_ALARM`, plus 3 duds (`add_duds(3)`, datum/wires/airalarm.dm:6-11).
     - Pulse `WIRE_POWER`: short for 1200 (ds) via `addtimer` then `reset` (datum/wires/airalarm.dm:30-34). `WIRE_IDSCAN`: toggles `locked` (:35-36). `WIRE_AI`: disables AI control for 100 (ds) (:37-40). `WIRE_PANIC`: toggles mode 1 <-> 3 (:41-47). `WIRE_ALARM`: clears the area alert (:48-52).
     - Cut `WIRE_POWER`: `shock(usr, 50)` (50 is the percent chance, airalarm.dm:453-464), `shorted = !mend` (datum/wires/airalarm.dm:57-60). Cut `WIRE_IDSCAN` (not mended): `locked = TRUE` (:61-63). Cut `WIRE_AI`: `aidisabled = mend` (:64-65). Cut `WIRE_PANIC` (not mended, not shorted): mode 3 (:66-69). Cut `WIRE_ALARM`: raises a severe alert (`post_alert(2)`, :70-74).
     - Status text: `"The interface light is [A.locked ? "red" : "green"]."`, `"The short indicator is [A.shorted ? "lit" : "off"]."`, `"The AI connection light is [!A.aidisabled ? "on" : "off"]."` (datum/wires/airalarm.dm:19-25).
  7. Electrocution: `shock()` only fires with `prob(prb)`, is skipped when NOPOWER, and sparks are always made (airalarm.dm:453-464).
  8. The electroadaptive pseudocircuit only works on cyborgs. `adapt_circuit` returns without effect for any non-robot (code/game/objects/items/devices/electroadaptive_pseudocircuit.dm:25-27), so a human's `P.adapt_circuit(user, 25)` (airalarm.dm:783-784) silently does nothing. Cost is 25 cell charge (electroadaptive_pseudocircuit.dm:31).
  9. `togglelock` uses `allowed(usr)` (airalarm.dm:826). `allowed` with empty `req_access` and empty `req_one_access` is TRUE for everyone (code/modules/jobs/access.dm:3-6, 67-91).
  10. `aidisabled` and `shorted` both stop the unit: `ui_status` closes the UI when shorted (airalarm.dm:242-244), and `process()` returns early (:646-647).
  11. `EMAGGED` is sent to the UI as `emagged` (airalarm.dm:257) and adds the Flood entry to the mode list (:343-344). Nothing else in this file reads it, and the emag does not change `req_access`.

### Variant table (each path sets only what is listed; everything else is the parent's)

BoxStation placements: x1 each (from the list). Map entries are in `_maps/map_files/BoxStation/BoxStation.dmm`.

| DM path (as on the list) | in-game `name` (as typed) | `locked` | `req_access` / `req_one_access` | `TLV` | `desc` | BoxStation map entry |
|---|---|---|---|---|---|---|
| `/obj/machinery/airalarm/server` | air alarm (inherited, :61; renamed on creation, :214-215) | TRUE (inherited, :80) | `req_access = list(ACCESS_ATMOSPHERICS)` (inherited, :69) | all `new/datum/tlv/no_checks` (:110-127; `no_checks` is -1 for all bounds, :24-28), so `get_danger_level` is 0 for every key (:13-22) | inherited (:62) | BoxStation.dmm:26852, `dir = 4`, `pixel_x = -22` |
| `/obj/machinery/airalarm/engine` | engine air alarm (:155) | FALSE (:156) | `req_access = null` (:157), `req_one_access = list(ACCESS_ATMOSPHERICS, ACCESS_ENGINE)` (:158; ACCESS_ENGINE = 10, access.dm:20) | inherited base TLV (:89-107) | inherited (:62) | BoxStation.dmm:39123, `dir = 4`, `pixel_x = -23` |
| `/obj/machinery/airalarm/mixingchamber` | chamber air alarm (:161) | FALSE (:162) | `req_access = null` (:163), `req_one_access = list(ACCESS_ATMOSPHERICS, ACCESS_TOXINS)` (:164; ACCESS_TOXINS = 8, access.dm:16) | inherited base TLV | inherited (:62) | BoxStation.dmm:42699, `dir = 4`, `pixel_x = -24` |
| `/obj/machinery/airalarm/all_access` | all-access air alarm (:167) | FALSE (:169) | `req_access = null` (:170), `req_one_access = null` (:171), so no access check at all (access.dm:76-77) | inherited base TLV | "This particular atmos control unit appears to have no access restrictions." (:168) | BoxStation.dmm:37172, `dir = 8`, `pixel_x = 24` |

Notes on the table:
- The server's `name` is "air alarm" (inherited), so it gets the area-name rename like the rest. The other three keep their own `name` string, but that string is also `initial(name)`, so they are renamed too (airalarm.dm:214-215).
- `req_access = null` followed by `gen_access()` sets an empty list (code/modules/jobs/access.dm:54-64), so the `null` in the subtype does not mean "no restriction" by itself. "No restriction" comes from both lists being empty (access.dm:76-77).
- `locked` for the other three subtypes starts FALSE, so their UI is open at round start. The server starts locked (airalarm.dm:80).
- Excluded from this entry (not on the list, read for context only): `unlocked` (:151-152), `kitchen_cold_room` (:130-149), `syndicate` (:173-174), `away` (:176-177), `directional/*` (:179-194).

# gap-things-01.3: Airlock sensors (airlock_sensor family)

One listed path. The parent `/obj/machinery/airlock_sensor` (code/game/machinery/airlock_control.dm:87) is a radio sensor that reports chamber pressure every machine tick and sends a "cycle" command to its controller when a bare hand clicks it. Its subtype only sets `id_tag` and `master_tag`. There is no UI, no construction and no drops.

### airlock sensor (parent)  `/obj/machinery/airlock_sensor`   (code/game/machinery/airlock_control.dm:87)
- What it is: a wall or chamber sensor for an airlock/incinerator controller. It broadcasts the room's pressure on the airlock radio channel, and a bare-hand click asks the controller to cycle (airlock_control.dm:87-151).
- Key vars:
  - `icon = 'icons/obj/airlock_machines.dmi'` (airlock_control.dm:88); `icon_state = "airlock_sensor_off"` (:89)
  - `name = "airlock sensor"` (:90)
  - `resistance_flags = FIRE_PROOF` (:91)
  - `power_channel = AREA_USAGE_ENVIRON` (:93; = 3, code/__DEFINES/machines.dm:5)
  - `var/id_tag`, `var/master_tag` (:95-96), unset on the parent
  - `var/frequency = FREQ_AIRLOCK_CONTROL` = 1449 (:97; code/__DEFINES/radio.dm:81)
  - `var/on = TRUE` (:101); `var/alert = FALSE` (:102)
  - `desc` not set, so it inherits `"Some kind of machine."` (code/game/machinery/_machinery.dm:89); `anchored = TRUE` (_machinery.dm:98)
  - `circuit` not set, so no board (_machinery.dm:141-143)
- Interactions (every tool/item/intent that does something):

  | held item / action | condition | delay (ds) | message(s) verbatim | result |
  |---|---|---|---|---|
  | empty hand, click (`attack_hand`) | `can_interact` passes: not NOPOWER or BROKEN (_machinery.dm:251-252); panel not open (:255-257); a living user is Adjacent (:269-272) and not incapacitated (:274-275) | none | none | `attack_hand` runs the parent chain (code/_onclick/other_mobs.dm:30-37). `_try_interact` → `interact` → `ui_interact` returns FALSE because nothing overrides `/datum/proc/ui_interact` (code/modules/tgui/external.dm:23-24), so `attack_hand` does not return early. The sensor then sends `"tag" = master_tag` and `"command" = "cycle"` (airlock_control.dm:129-132), `post_signal(..., range = AIRLOCK_CONTROL_RANGE, filter = RADIO_AIRLOCK)` (:134), and `flick("airlock_sensor_cycle", src)` (:135). |
  | empty hand, click, unpowered or broken | `machine_stat & (NOPOWER\|BROKEN)` | none | none | `can_interact` fails (_machinery.dm:251-252), so no cycle is sent. |
  | silicon click (`attack_robot` / `attack_ai`) | `INTERACT_MACHINE_ALLOW_SILICON` is set by default (_machinery.dm:124) | none | none | Goes to `_try_interact` (_machinery.dm:356-375). The override that sends the cycle is only in `attack_hand`, so no cycle (inferred from the absence of silicon overrides in airlock_control.dm:87-165). |
  | any item | any | none | generic hit messages, see the air alarm entry (code/_onclick/item_attack.dm:122-125) | `attackby` falls to the generic hit path (item_attack.dm:58-59, 109-128). No item triggers the cycle. |
  | examine | any | none | health text, see the air alarm entry (code/game/machinery/_machinery.dm:553-567) | text only. |

- Construction chain: NONE. No circuit, frame or assembly (airlock_control.dm:87-102; _machinery.dm:141-143).
- Deconstruction chain: NONE. No wrench, screwdriver or crowbar handler, and `anchored = TRUE` (_machinery.dm:98).
- Drops:
  - (a) Destroyed (integrity 0): `obj_destruction` → `deconstruct(FALSE)` (code/game/objects/obj_defense.dm:20-21, 252-258) → the machinery `deconstruct` runs `on_deconstruction` (no-op), skips `spawn_frame` because `component_parts` is null, and calls `qdel` (_machinery.dm:402-410). Drops: nothing. Stays behind: nothing.
  - (b) Deconstructed properly: no route exists on this type. A `deconstruct(TRUE)` call gives the same result, with no drops (_machinery.dm:402-410).
- Health / armor:
  - `max_integrity = 200` (_machinery.dm:93), inherited. `integrity_failure = 0` (code/game/objects/objs.dm:19), so `obj_break` is never called from damage (obj_defense.dm:17-18). The sensor goes from damage straight to destruction at 0 (obj_defense.dm:20-21).
  - Armor: the machinery default (_machinery.dm:136-137): melee 25, bullet 10, laser 10, energy 0, bomb 0, bio 0, rad 0, fire 50, acid 70.
  - `resistance_flags = FIRE_PROOF` (airlock_control.dm:91).
- Power: `use_power = IDLE_POWER_USE` (_machinery.dm:102; = 1, code/__DEFINES/machines.dm:22). `idle_power_usage = 0` and `active_power_usage = 0` inherited (_machinery.dm:106-107). No `use_power` or `powered()` call exists in airlock_control.dm (grep). So 0 W.
- Gotchas:
  1. `process()` has no power or `machine_stat` check (airlock_control.dm:137-151). The broadcast keeps running when the area is unpowered. Clicks do need power (_machinery.dm:251-252).
  2. `process()` never returns `PROCESS_KILL`, so it stays on SSmachines (contrast the gas sensor, which is killed on its first machine tick). It runs on SSmachines from init (`START_PROCESSING_ON_INIT`, _machinery.dm:119, 145-146).
  3. Every tick: `pressure = round(air_sample.return_pressure(), 0.1)` (airlock_control.dm:139-140), then `alert = (pressure < ONE_ATMOSPHERE*0.8)` (:141). `ONE_ATMOSPHERE` = 101.325 (code/__DEFINES/atmospherics.dm:18), so the alert threshold is 81.06 kPa (inferred arithmetic).
  4. Broadcast fields (airlock_control.dm:143-147): `"tag" = id_tag`, `"timestamp" = world.time` (raw deciseconds), `"pressure" = num2text(pressure)` (a string). It posts with `range = AIRLOCK_CONTROL_RANGE` (= 5, airlock_control.dm:1) on `RADIO_AIRLOCK` = `"airlock"` (code/__DEFINES/radio.dm:103).
  5. Icon: `"airlock_sensor_alert"` when `alert`, `"airlock_sensor_standby"` when `on` and not alert, `"airlock_sensor_off"` otherwise (airlock_control.dm:116-123). `update_icon()` runs every tick (:151).
  6. Radio: `set_frequency` runs in `Initialize` (airlock_control.dm:158-160) and `Destroy` removes it (:162-164).
  7. The cycle goes to the controller whose `id_tag` equals this sensor's `master_tag`. The matching controller is `/obj/machinery/embedded_controller/radio/airlock_controller/incinerator_atmos` (code/game/machinery/embedded_controller/airlock_controller.dm:223-230), with `id_tag = INCINERATOR_ATMOS_AIRLOCK_CONTROLLER` (:227) and `sensor_tag = INCINERATOR_ATMOS_AIRLOCK_SENSOR` (:230). Its program reads the sensor's `pressure` (airlock_controller.dm:25-27) and on `"cycle"` sets `target_state` to `AIRLOCK_STATE_OUTOPEN` if the state is below closed, else `AIRLOCK_STATE_INOPEN` (:41-47). Door motion is outside this entry and was not read.

### Variant table (only one listed path)

| DM path (as on the list) | in-game `name` | `id_tag` (define = value) | `master_tag` (define = value) | defined at | BoxStation |
|---|---|---|---|---|---|
| `/obj/machinery/airlock_sensor/incinerator_atmos` | airlock sensor (inherited, airlock_control.dm:90) | `INCINERATOR_ATMOS_AIRLOCK_SENSOR` = `"atmos_incinerator_airlock_sensor"` (code/__DEFINES/atmospherics.dm:334) | `INCINERATOR_ATMOS_AIRLOCK_CONTROLLER` = `"atmos_incinerator_airlock_controller"` (atmospherics.dm:335) | airlock_control.dm:108-110 (:109 id, :110 master) | x1 |

Context only (not on the list): `/obj/machinery/airlock_sensor/incinerator_toxmix` (airlock_control.dm:104-106; id/master `toxmix_airlock_sensor` / `toxmix_airlock_controller`, atmospherics.dm:324-325) and `/obj/machinery/airlock_sensor/incinerator_syndicatelava` (airlock_control.dm:112-114; `syndicatelava_airlock_sensor` / `syndicatelava_airlock_controller`, atmospherics.dm:344-345). Each sets only these two tags.

## NOT FOUND / open questions
- None of the 14 listed paths is NOT FOUND. `tgwhere` located all of them (see Coverage).
- Not read (outside this family): the door cycling logic behind `AIRLOCK_STATE_*` in the embedded airlock program; `atmosalert` and area alert handling; the power-state code that sets `NOPOWER`; `get_area_name`; the TGUI "AirAlarm" front end; `/datum/tlv` use outside this file.
- Air alarm power: the declared draw (4 W idle, 8 W active, airalarm.dm:66-67) is not applied by any call in airalarm.dm. Whether the area system draws it was not checked.
- Whether a human or AI can reach the air alarm's `lock` action other than through the silicon branch (airalarm.dm:383-386) was not traced further.

## Minimum viable port
- Gas sensor: a radio transmitter with `id_tag` and frequency 1441 on channel "atmosia". Every atmos tick it sends pressure, temperature and gas percentages. It has no power draw and no UI.
- Gas sensor: dies at 0 integrity (max 200) and drops nothing. Only the atmos computer's listed `id_tag`s are shown.
- Air alarm: wall unit with `max_integrity = 250`, `integrity_failure = 0.33` (breaks at 82.5), the armor table in airalarm.dm:72, and `FIRE_PROOF`.
- Air alarm: each tick compares the turf to the TLV table (airalarm.dm:89-107). `danger_level` 0/1/2 sets its icon and posts alerts on 1437.
- Air alarm: one UI with the actions in airalarm.dm:381-438 and the modes in airalarm.dm:48-56 and 483-503.
- Air alarm: locked by default, with a bare-hand or ID-card toggle that needs access. `all_access` has no access check, and the `engine` and `chamber` variants accept their own access sets.
- Air alarm build chain: frame → insert electronics → 5 cable (20 ds) → screwdriver. Proper teardown: screwdriver → cut all wires → cable x5 → crowbar (20 ds) → electronics → wrench → frame. Destroyed: metal x2, electronics at 50 %, cable x3.
- Air alarm name: "[area] Air Alarm" is set on creation (airalarm.dm:214-215).
- Airlock sensor: broadcasts pressure every tick on channel "airlock" (range 5). Alert below 81.06 kPa. Bare-hand click sends "cycle" to its master tag and needs power and adjacency.
- Airlock sensor: no drops, no construction, no power draw, unpowered broadcasts still run.

## Coverage
- Entries on the list: 14 (the list file has 15 lines: 1 header comment, 14 entries).
- Documented with real data: 14. Gas tank sensors: 9 (gap-things-01.1.md). Air alarms: 4 (gap-things-01.2.md). Airlock sensor: 1 (gap-things-01.3.md).
- Marked NOT FOUND: 0.
- Paths `tgwhere` could not locate: none. `tgwhere` located all 14 (`/obj/machinery/air_sensor/atmos/*` ×9 at `code/game/machinery/computer/atmos_control.dm:17-41`; `/obj/machinery/airalarm/{server,engine,mixingchamber,all_access}` at `code/modules/atmospherics/machinery/airalarm.dm:109, 154, 160, 166`; `/obj/machinery/airlock_sensor/incinerator_atmos` at `code/game/machinery/airlock_control.dm:108`).

