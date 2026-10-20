# gap-things-04 part 1: incinerator airlock consoles and the igniter

Summary of this shard (14 map-placed machines, all located by `tgwhere`, none NOT FOUND; source `_src/tg2020`):
1. Families: incinerator airlock consoles (2), igniter (1), tachyon-doppler research array (1), kitchen machines (3), gateway (1), gravity generator (1), gulag reclaimer and teleporter (2), laptop vendor, library scanner, magnetic controller (3).
2. Base class `/obj/machinery` (`code/game/machinery/_machinery.dm:86`) gives `max_integrity = 200`, `anchored = TRUE`, IDLE power use and a default armor list; most entries here inherit that.
3. No type in this part has a construction frame or circuit board; none of them drops parts when broken or deconstructed.
4. Airlock consoles drive a radio-linked cycling program; the igniter is a remote-switched heater; neither has a wrench or screwdriver handler, so a wrench only hits them.
5. Numbers below are raw (deciseconds, watts as the brief labels them, kPa); unit labels are noted where the DM is silent.

## Shared base: embedded airlock console `/obj/machinery/embedded_controller/radio/airlock_controller`  (`code/game/machinery/embedded_controller/airlock_controller.dm:196`)

Parent chain: `/obj/machinery/embedded_controller/radio` (`code/game/machinery/embedded_controller/embedded_controller_base.dm:63`) -> `/obj/machinery/embedded_controller` (`embedded_controller_base.dm:20`) -> `/obj/machinery` (`code/game/machinery/_machinery.dm:86`).

- What it is: a wall console that runs an airlock cycling program (`/datum/computer/file/embedded_program/airlock_controller`, `airlock_controller.dm:8`) for a chamber with an interior door, an exterior door, a vent pump and a pressure sensor. Every part is matched by a radio tag string, not by object reference.
- Key vars (base, set on the type):
  - `icon = 'icons/obj/airlock_machines.dmi'` (`airlock_controller.dm:197`), `icon_state = "airlock_control_standby"` (`:198`)
  - `name = "airlock console"` (`:200`), `density = FALSE` (`:201`)
  - `frequency = FREQ_AIRLOCK_CONTROL` = `1449` (`:203`; `code/__DEFINES/radio.dm:81`)
  - `power_channel = AREA_USAGE_ENVIRON` = `3` (`:204`; `code/__DEFINES/machines.dm:5`)
  - Unset on the base, set per subtype: `id_tag`, `exterior_door_tag`, `interior_door_tag`, `airpump_tag`, `sensor_tag`, `sanitize_external` (`airlock_controller.dm:207-212`)
  - `on = TRUE` (inherited, `embedded_controller_base.dm:26`); `program` is `null` until the mapload Initialize below.
- Program states (`airlock_controller.dm:2-6`): `AIRLOCK_STATE_INOPEN` = -2, `AIRLOCK_STATE_PRESSURIZE` = -1, `AIRLOCK_STATE_CLOSED` = 0, `AIRLOCK_STATE_DEPRESSURIZE` = 1, `AIRLOCK_STATE_OUTOPEN` = 2.
- Pressure thresholds (`airlock_controller.dm`): "pressurised" when `sensor_pressure >= ONE_ATMOSPHERE*0.95` (`:85`); depressurise target `ONE_ATMOSPHERE*0.05` (`:137`), or `ONE_ATMOSPHERE*0.01` when `sanitize_external` (`:138-139`). `ONE_ATMOSPHERE` = `101.325` (`code/__DEFINES/atmospherics.dm:18`). Inferred arithmetic: 96.25875 kPa, 5.06625 kPa and 1.01325 kPa.

### Interactions (base; every subtype below inherits them)

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| empty hand, click (`attack_hand`) | `_try_interact` -> `can_interact` (`_machinery.dm:250-280`, fails when NOPOWER or BROKEN, or when not adjacent) | none | none | `interact` -> `ui_interact` (`embedded_controller_base.dm:28-34`): opens a popup titled `name` with content `return_text()` |
| popup link `command=cycle_interior` (label "Open Interior Airlock") | state CLOSED (`airlock_controller.dm:293`) | none | `<A href='?src=[REF(src)];command=cycle_interior'>Open Interior Airlock</A>` (`:293`) | `Topic` (`embedded_controller_base.dm:45-54`) -> `receive_user_command("cycle_interior")` -> target INOPEN (`airlock_controller.dm:55-56`) |
| popup link `command=cycle_exterior` (label "Open Exterior Airlock") | state CLOSED (`:294`) | none | `...command=cycle_exterior'>Open Exterior Airlock</A>` (`:294`) | target OUTOPEN (`airlock_controller.dm:53-54`) |
| popup link `command=cycle_closed` (labels "Close Interior Airlock" / "Close Exterior Airlock") | state INOPEN (`:287`) or OUTOPEN (`:300`) | none | `Close Interior Airlock` (`:287`), `Close Exterior Airlock` (`:300`) | target CLOSED (`airlock_controller.dm:51-52`) |
| popup link `command=cycle_exterior` (label "Cycle to Exterior Airlock") | state INOPEN (`:287`) | none | `Cycle to Exterior Airlock` (`:287`) | target OUTOPEN |
| popup link `command=cycle_interior` (label "Cycle to Interior Airlock") | state OUTOPEN (`:299`) | none | `Cycle to Interior Airlock` (`:299`) | target INOPEN |
| popup link `command=abort` (label "Abort Cycling") | state PRESSURIZE (`:290`) or DEPRESSURIZE (`:296`) | none | `Abort Cycling` (`:290`, `:296`) | target CLOSED (`airlock_controller.dm:57-58`) |
| radio signal, tag = `id_tag`, `command` = `"cycle"` | any state | none | none | target OUTOPEN if state < CLOSED, else INOPEN (`airlock_controller.dm:41-47`) |
| any item hit (`attackby` not overridden) | `/obj/attackby` (`code/_onclick/item_attack.dm:58-59`) then `I.attack_obj` (`:109-116`) | none | `"<span class='danger'>You hit [src] with [I]!</span>"` when `I.force` is set (`item_attack.dm:122-127`) | `take_damage(I.force, I.damtype, "melee", 1)` (`item_attack.dm:128`) |
| wrench (`TOOL_WRENCH`) | no wrench handler: `tool_act` -> `wrench_act` only sends `COMSIG_ATOM_WRENCH_ACT` (`code/game/atoms.dm:1117-1127`, `:1160-1161`) and returns 0, so the chain goes on (`code/_onclick/item_attack.dm:10-20`) | - | none | an ordinary hit: `attackby` -> `attack_obj` -> `attacked_by` (`item_attack.dm:58-59`, `:109-128`) |

Status text in the popup, verbatim (`return_text`, `airlock_controller.dm:268-315`):
- INOPEN: `Interior Airlock Open<BR><span class='good'>Chamber Pressurized</span>` (`:288`)
- PRESSURIZE: `Cycling to Interior Airlock<BR><span class='average'>Chamber Pressurizing</span>` (`:291`)
- CLOSED: no status line is set, so the popup shows `Inactive<BR>&nbsp;` (default at `:276`, CLOSED case at `:292-294` sets only the buttons)
- DEPRESSURIZE: `Cycling to Exterior Airlock<BR><span class='average'>Chamber Depressurizing</span>` (`:297`)
- OUTOPEN: `Exterior Airlock Open<BR><span class='bad'>Chamber Depressurized</span>` (`:301`)
- Readout rows: `Chamber Pressure`, `Control Pump`, `Interior Door`, `Exterior Door`, each with `kPa` after the pressure (`:305-310`).

### Program cycle logic (`airlock_controller.dm:60-193`, runs each machine tick via `embedded_controller/process`, `embedded_controller_base.dm:56-61`)

| state | what happens each tick | file:line |
|---|---|---|
| INOPEN (-2) | target above: interior `closed` -> CLOSED, else post `secure_close` to interior door. Otherwise pump off if not off. | `:63-81` |
| PRESSURIZE (-1) | target below: if pressure >= 0.95 atm: interior `open` -> INOPEN, else `secure_open` to interior door; if below: pump on (`power = 1`, or `stabilize = 1` when siphoning, nothing when releasing). Target above: -> CLOSED. | `:83-106` |
| CLOSED (0) | target above: interior `closed` -> DEPRESSURIZE, else `secure_close` interior. Target below: exterior `closed` -> PRESSURIZE, else `secure_close` exterior. Equal: pump off. | `:108-134` |
| DEPRESSURIZE (1) | target pressure 0.05 atm (0.01 if `sanitize_external`). At or below it: target above -> exterior `open` -> OUTOPEN, else `secure_open` exterior; target below -> CLOSED. Above it and not sanitising with target below -> CLOSED. Otherwise pump on (`purge = 1` when releasing, `power = 1` unless siphoning). | `:136-165` |
| OUTOPEN (2) | target below: exterior `closed` -> DEPRESSURIZE if `sanitize_external`, else CLOSED; else `secure_close` exterior. Equal: pump off. | `:167-187` |

Outbound signals go to the door and pump tags with `"command" = "secure_close"` / `"secure_open"` (door) or `"power"` / `"stabilize"` / `"purge"` (pump) (`airlock_controller.dm:71-103`, `:114-165`). Radio transmit: `post_signal` sets `TRANSMISSION_RADIO` and sends on `radio_connection` (`embedded_controller_base.dm:75-80`).

### Construction / deconstruction / drops / health / power (base)

- Construction chain: none on the type. `circuit` is unset (`_machinery.dm:122`), `component_parts` is `null` (`:112`), no frame exists. Placed by the map only.
- Deconstruction chain: none. There is no screwdriver, crowbar or wrench handler; the machine `deconstruct()` only runs qdel and spawns a frame if `component_parts` is set (`_machinery.dm:402-410`), which it is not.
- Drops: (a) destroyed: `obj_destruction` -> `deconstruct(FALSE)` (`code/game/objects/obj_defense.dm:252-258`) -> qdel only; nothing stays behind. (b) disassembled: not possible.
- Health: `max_integrity = 200` (`_machinery.dm:93`). `integrity_failure` is `0` (`code/game/objects/objs.dm:19`), so damage never sets BROKEN (`obj_defense.dm:17-18`); the console is only destroyed at 0 integrity (`obj_defense.dm:20-21`).
- Armor: none set on the type, so the machinery default applies (`_machinery.dm:136-137`): `melee 25, bullet 10, laser 10, energy 0, bomb 0, bio 0, rad 0, fire 50, acid 70`.
- `damage_deflection = 0` (`objs.dm:21`).
- Power: `use_power = IDLE_POWER_USE` (`_machinery.dm:102`; `IDLE_POWER_USE` = 1, `code/__DEFINES/machines.dm:22`); `idle_power_usage = 0` and `active_power_usage = 0` inherited (`_machinery.dm:106-107`), so the console draws no set amount. Channel = environment (`airlock_controller.dm:204`). The DM comment does not state the unit.
- EMP: `/obj/machinery/emp_act` runs `use_power(7500/severity)` when `use_power` is set and `machine_stat` is 0 (`_machinery.dm:187-191`) (unit not stated).

### Gotchas (base)

- The program exists only for a console placed by the map: `Initialize(mapload)` returns before creating `program` when `!mapload` (`airlock_controller.dm:243-244`). A console made in play has no program, shows `----` for all readings, and its buttons do nothing because `Topic` checks `if(program)` (`embedded_controller_base.dm:49-50`).
- Tags must match exactly. `receive_signal` only accepts a signal whose `tag` equals `sensor_tag`, `exterior_door_tag`, `interior_door_tag`, `airpump_tag` or `id_tag` (`airlock_controller.dm:20-41`); a missing door or pump leaves the program waiting (inferred from the state machine).
- Both incinerator consoles set `sanitize_external = TRUE`, so the depressurise target is 1.01325 kPa instead of 5.06625 kPa (`airlock_controller.dm:138-139`). Cycling from the exterior side (OUTOPEN) toward the interior sends the program to DEPRESSURIZE once the exterior door reports `closed` (`:169-171`).
- The console's radio connection is set to frequency `1449` in `Initialize` (`embedded_controller_base.dm:71-73`, `airlock_controller.dm:203`).
- The program's `process()` returns 1 after updating `memory["processing"]` (`airlock_controller.dm:189-193`), which drives the icon: `airlock_control_process` when processing, `airlock_control_standby` when idle, `airlock_control_off` when `on` is false or no program (`:258-265`).

### Subtypes (each path written out; only the tags and name differ)

| path | in-game name | type def | pump tag | id tag (controller) | interior door tag | exterior door tag | sensor tag | sanitize_external |
|---|---|---|---|---|---|---|---|---|
| `/obj/machinery/embedded_controller/radio/airlock_controller/incinerator_toxmix` | Incinerator Access Console | `airlock_controller.dm:214` | `"toxmix_airlock_pump"` (`code/__DEFINES/atmospherics.dm:323`) | `"toxmix_airlock_controller"` (`:325`) | `"toxmix_airlock_interior"` (`:326`) | `"toxmix_airlock_exterior"` (`:327`) | `"toxmix_airlock_sensor"` (`:324`) | TRUE (`airlock_controller.dm:220`) |
| `/obj/machinery/embedded_controller/radio/airlock_controller/incinerator_atmos` | Incinerator Access Console | `airlock_controller.dm:223` | `"atmos_incinerator_airlock_pump"` (`atmospherics.dm:333`) | `"atmos_incinerator_airlock_controller"` (`:335`) | `"atmos_incinerator_airlock_interior"` (`:336`) | `"atmos_incinerator_airlock_exterior"` (`:337`) | `"atmos_incinerator_airlock_sensor"` (`:334`) | TRUE (`airlock_controller.dm:229`) |

Both subtypes inherit everything in the base sections above: icon, frequency 1449, power channel 3, max_integrity 200, armor defaults, no construction. The tag values come from the `#define`s in `atmospherics.dm` (lines 321-327 and 330-337), the same ones the map uses for its doors, pumps and sensors.

Per subtype:
- `/obj/machinery/embedded_controller/radio/airlock_controller/incinerator_toxmix`  (`airlock_controller.dm:214`): name `Incinerator Access Console` (`:215`); the only differences from the base are the tags above.
- `/obj/machinery/embedded_controller/radio/airlock_controller/incinerator_atmos`  (`airlock_controller.dm:223`): name `Incinerator Access Console` (`:224`); the only differences from the base are the tags above.

---

## Igniter family

### igniter (toxmix)  `/obj/machinery/igniter/incinerator_toxmix`   (`code/game/machinery/igniter.dm:16`)

- What it is: a floor-mounted igniter that heats the tile it stands on when switched on; it is wired to the toxmix incinerator by the shared id `"toxmix_igniter"`.
- Parent `/obj/machinery/igniter` (`igniter.dm:1`) vars, inherited unless said otherwise:
  - `name = "igniter"` (`igniter.dm:2`), `desc = "It's useful for igniting plasma."` (`:3`)
  - `icon = 'icons/obj/stationobjs.dmi'`, `icon_state = "igniter0"` (`:4-5`), `plane = FLOOR_PLANE` (`:6`)
  - `use_power = IDLE_POWER_USE` (`:7`), `idle_power_usage = 2` (`:8`), `active_power_usage = 4` (`:9`)
  - `max_integrity = 300` (`:10`)
  - `armor = list("melee" = 50, "bullet" = 30, "laser" = 70, "energy" = 50, "bomb" = 20, "bio" = 0, "rad" = 0, "fire" = 100, "acid" = 70)` (`:11`)
  - `resistance_flags = FIRE_PROOF` (`:12`); `var/id = null` (`:13`); `var/on = FALSE` (`:14`)
- Subtype `/obj/machinery/igniter/incinerator_toxmix`: `id = INCINERATOR_TOXMIX_IGNITER` = `"toxmix_igniter"` (`igniter.dm:17`; `code/__DEFINES/atmospherics.dm:321`). Name, desc, icon and every number above are inherited (not overridden). Map placed x1 on BoxStation.

#### Interactions

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| empty hand, click (`attack_hand`) | none checked by the igniter itself (see gotchas) | none (no delay) | none | `add_fingerprint`, `use_power(50)`, `on = !(on)`, `update_icon()` (`igniter.dm:29-37`) |
| ignition controller `/obj/item/assembly/control/igniter`, `attack_self` -> `activate()` (`code/modules/assembly/doorcontrol.dm:105`) | `cooldown` FALSE; `id` equal to the igniter's `id` (`:113-114`) | cooldown 30 (`:119`, `addtimer(..., 30)`) | none | for each igniter with the same id: `M.use_power(50)`, `M.on = !M.on`, `M.icon_state = "igniter[M.on]"` (`:113-117`) |
| ignition switch `/obj/machinery/button/ignition/incinerator/toxmix` (`code/game/machinery/buttons.dm:254-255`) | the button's `device_type = /obj/item/assembly/control/igniter` (`buttons.dm:245`) and `device.pulsed()` (`buttons.dm:178`) | as the controller row | none in the handler (the switch's own desc at `buttons.dm:252` reads `A remote control switch for the combustion chamber's igniter.`) | same as the controller row (path inferred: `pulsed()` -> `activate()`) |
| any item hit (`attackby` not overridden) | `/obj/attackby` -> `I.attack_obj` (`code/_onclick/item_attack.dm:58-59`) | none | `"<span class='danger'>You hit [src] with [I]!</span>"` when `I.force` (`item_attack.dm:122-127`) | `take_damage(I.force, I.damtype, "melee", 1)` (`item_attack.dm:128`); melee armor 50 halves melee damage (`obj_defense.dm:24-37`) |
| wrench | no wrench handler: `tool_act` -> `wrench_act` only sends `COMSIG_ATOM_WRENCH_ACT` (`code/game/atoms.dm:1117-1127`, `:1160-1161`) and returns 0, so the chain goes on (`code/_onclick/item_attack.dm:10-20`) | - | none | an ordinary hit: `attackby` -> `attack_obj` -> `attacked_by` (`item_attack.dm:58-59`, `:109-128`) |

#### Construction / deconstruction chain

- Construction: none on the type or its parent. No `circuit`, no frame, no `attackby`, no `on_construction`. The `/obj/item/assembly/igniter` item (`code/modules/assembly/igniter.dm:6`) is a separate hand-held item, not a build step for this machine (inferred).
- Deconstruction: none. The igniter has no crowbar, screwdriver or wrench handler, so those tools only hit it (see the table).

#### Drops

- (a) Destroyed: `obj_destruction` -> `deconstruct(FALSE)` (`obj_defense.dm:252-258`) -> machinery `deconstruct` with no `component_parts`, so only qdel (`_machinery.dm:402-410`). Nothing stays behind. A `"fire"` hit calls `burn()` instead (`obj_defense.dm:255-256`); `"acid"` calls `acid_melt()` (`:253-254`).
- (b) Deconstructed properly: not possible.

#### Health / armor

- `max_integrity = 300` (`igniter.dm:10`). `integrity_failure = 0` (`objs.dm:19`), so no BROKEN state from damage (`obj_defense.dm:17`). `damage_deflection = 0` (`objs.dm:21`).
- Armor (`igniter.dm:11`): melee 50, bullet 30, laser 70, energy 50, bomb 20, bio 0, rad 0, fire 100, acid 70. `resistance_flags = FIRE_PROOF` (`:12`).

#### Power

- `use_power = IDLE_POWER_USE` (`igniter.dm:7`); `idle_power_usage = 2` (`:8`); `active_power_usage = 4` (`:9`). Unit not stated in the DM (the brief says watts).
- Each toggle draws `use_power(50)`, both by hand (`igniter.dm:35`) and by remote (`doorcontrol.dm:115`).
- `process()` heats while on and not NOPOWER: `location.hotspot_expose(1000,500,1)` on a turf (`igniter.dm:39-44`). Processing starts on init by default (`_machinery.dm:119`, `:145-146`).
- Channel: default equipment (`_machinery.dm:108`, `AREA_USAGE_EQUIP` = 1).

#### Gotchas

- The hand toggle is not gated by power or by `can_interact`. `attack_hand` returns early only if `..()` is TRUE (`igniter.dm:30-32`), and the atom path returns the result of `_try_interact`, which is FALSE when `can_interact` fails (`other_mobs.dm:40-45`; `_machinery.dm:250-258` for NOPOWER or BROKEN). `datum/ui_interact` returns FALSE (`code/modules/tgui/external.dm:23-24`). So a dead igniter still flips `on` and spends `use_power(50)` (read from the code path; not run).
- `process()` checks only `NOPOWER`, not `BROKEN` (`igniter.dm:40`). A broken but powered igniter still heats when on.
- Remote toggling sets `icon_state` directly and does not call `update_icon()` (`doorcontrol.dm:117`).
- Shuttle docking changes the id: `connect_to_shuttle` sets `id = "[idnum][id]"` (`igniter.dm:56-57`).
- The wall sparker `/obj/machinery/sparker/toxmix` (`igniter.dm:72-73`) shares the same id and is fired by the same remote (`doorcontrol.dm:109-111`). As written, `sparker/powered()` returns FALSE whenever `disable` is FALSE (`igniter.dm:93-96`), and `ignite()` returns early when `disable` is TRUE (`:116-120`), so the wall sparker never sparks in this snapshot (read from the code; not run). Not on this shard's list; noted because it changes what the remote does.
- The igniter does not open any UI; there is no message at all on toggle.

## Tachyon-doppler research array family

### tachyon-doppler array (base)  `/obj/machinery/doppler_array`   (`code/game/machinery/doppler_array.dm:3`)

- What it is: a directional sensor dish that records explosions within 150 tiles in the direction it faces, announces them over `say`, and can print each record on paper or keep it in a TGUI list.
- Key vars (`doppler_array.dm`): `name = "tachyon-doppler array"` (`:4`); `desc` begins "A highly precise directional sensor array which measures the release of quants from decaying tachyons." (`:5`); `icon_state = "tdoppler"` (`:7`); `density = TRUE` (`:8`); `verb_say = "states coldly"` (`:9`); `ui_x = 500`, `ui_y = 225` (`:10-11`); `cooldown = 10` (`:12`, ds between announcements); `max_dist = 150` (`:14`); `record_number = 1` (`:16`); `printer_ready = 0` (`:18`, set in Initialize); `records = list()` (`:20`).
- Parent: `/obj/machinery` (`_machinery.dm:86`): `max_integrity = 200` (`_machinery.dm:93`), default armor (`_machinery.dm:136-137`), `anchored = TRUE` (`:98`), `use_power = IDLE_POWER_USE` (`:102`), `idle_power_usage = 0`, `active_power_usage = 0`, `power_channel = AREA_USAGE_EQUIP` (`:106-108`).
- `Initialize` (`doppler_array.dm:22-25`): registers `sense_explosion` on `SSdcs` for `COMSIG_GLOB_EXPLOSION` (`:24`) and sets `printer_ready = world.time + PRINTER_TIMEOUT` (`:25`, `#define PRINTER_TIMEOUT 40` at `:1`, so 40 ds).
- `ComponentInitialize` (`:27-29`): `AddComponent(/datum/component/simple_rotation, ROTATION_ALTCLICK | ROTATION_CLOCKWISE, null, null, CALLBACK(src,.proc/rot_message))`.
- Data record `/datum/data/tachyon_record` (`:31-37`): `name = "Log Recording"`, `timestamp`, `coordinates`, `displacement`, `factual_radius`, `theory_radius`.
- Printed paper `/obj/item/paper/record_printout` (`:93-115`): `name = "paper - Log Recording"` (`:94`); on print the name becomes `"paper - [record.name]"` (`:100`) and the body is `<h2>[record.name]</h2>` followed by `<li>Timestamp: [record.timestamp]</li>`, `<li>Coordinates: [record.coordinates]</li>`, `<li>Displacement: [record.displacement] seconds</li>`, `<li>Epicenter Radius: ...</li>`, `<li>Outer Radius: ...</li>`, `<li>Shockwave Radius: ...</li>` (`:102-108`); theory rows `Theoretical Epicenter Radius` / `Theoretical Outer Radius` / `Theoretical Shockwave Radius` only if `theory_radius` is non-empty (`:110-113`).

#### Interactions

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| empty hand, click (`attack_hand` -> `ui_interact`) | `can_interact` (`_machinery.dm:250-280`: NOPOWER or BROKEN blocks it) | none | none | opens TGUI `TachyonArray` with the window size `ui_x` x `ui_y` (`doppler_array.dm:39-44`) |
| TGUI action `delete_record` (`ref`) | record must be in `records` (`:72-75`) | none | none | removes the record from `records` (`:75`) |
| TGUI action `print_record` (`ref`) | record in `records` (`:78-81`) | `printer_ready` gate (`:87`); reset to `world.time + 40` on a print (`:88`) | `"<span class='warning'>[src] is busy right now.</span>"` when not ready (`:91`) | new `/obj/item/paper/record_printout` at `loc` (`:89`) |
| wrench (`TOOL_WRENCH`) when `!anchored` and not in space | `I.tool_behaviour == TOOL_WRENCH` (`:118`); `!anchored && !isinspace()` (`:119`) | none (no `use_tool` delay; tool sound `I.play_tool_sound(src)`, `:127`) | `"<span class='notice'>You fasten [src].</span>"` (`:122`) | `anchored = TRUE`, `power_change()` (`:120-121`) |
| wrench when `anchored` | `else if(anchored)` (`:123`) | none | `"<span class='notice'>You unfasten [src].</span>"` (`:126`) | `anchored = FALSE`, `power_change()` (`:124-125`) |
| wrench when not anchored and in space | neither branch matches (`:119`, `:123`) | none | none (tool sound still plays, `:127`) | nothing (inferred from the branch structure) |
| alt-click, or the "Rotate Clockwise" verb | `simple_rotation` `default_can_be_rotated` returns `!AM.anchored` (`code/datums/components/rotation.dm:134-136`), so an anchored array cannot be turned; `default_can_user_rotate` needs a living user who can `canUseTopic` at BE_CLOSE (`rotation.dm:129-132`) | none | `"<span class='notice'>You adjust [src]'s dish to face to the [dir2text(dir)].</span>"` (`doppler_array.dm:132`), sound `'sound/items/screwdriver2.ogg'` at 50 (`:133`) | `dir` turned clockwise by -90 (`rotation.dm:120-121`, `:126`) |
| any other item hit | `/obj/attackby` (`code/_onclick/item_attack.dm:58-59`) | none | `"<span class='danger'>You hit [src] with [I]!</span>"` when `I.force` (`item_attack.dm:122-127`) | `take_damage(I.force, I.damtype, "melee", 1)` (`item_attack.dm:128`) |

Screwdriver and crowbar: no handler on this type (`doppler_array.dm:117-129` only handles the wrench), so they fall through `attackby` and hit it (`code/_onclick/item_attack.dm:58-59`).

#### Explosion detection (`sense_explosion`, `doppler_array.dm:135-180`)

Checks in order, each returning FALSE (no record) on failure:

| check | code | file:line |
|---|---|---|
| power (machine not NOPOWER) | `if(machine_stat & NOPOWER) return FALSE` | `:137-138` |
| same z level as the epicenter | `if(zone.z != epicenter.z) return FALSE` | `:139-141` |
| announcement cooldown | `if(next_announce > world.time) return FALSE`, then `next_announce = world.time + cooldown` (cooldown = 10 ds) | `:143-145` |
| distance (`get_dist`, tiles, inferred) | `if(distance > max_dist) return FALSE` (`max_dist` = 150) | `:150-151` |
| facing direction | `if(!(direct & dir)) return FALSE` | `:152-153` |

Record fields written on success: `R.name = "Log Recording #[record_number]"` (`:156`), `timestamp = station_time_timestamp()` (`:157`), `coordinates = "[epicenter.x], [epicenter.y]"` (`:158`), `displacement = took` (`:159`), `factual_radius` keys `epicenter_radius` = `devastation_range`, `outer_radius` = `heavy_impact_range`, `shockwave_radius` = `light_impact_range` (`:160-162`). `record_number++` and `records += R` (`:178-179`).

Messages, said one by one with `say(message)` (`:164-176`), verbatim:
- `"Explosive disturbance detected."` (`:164`)
- `"Epicenter at: grid ([epicenter.x], [epicenter.y]). Temporal displacement of tachyons: [took] seconds."` (`:165`)
- `"Factual: Epicenter radius: [devastation_range]. Outer radius: [heavy_impact_range]. Shockwave radius: [light_impact_range]."` (`:166`)
- Only if the bomb was capped (`devastation_range < orig_dev_range` or the other two smaller, `:169`): `"Theoretical: Epicenter radius: [orig_dev_range]. Outer radius: [orig_heavy_range]. Shockwave radius: [orig_light_range]."` (`:170`), and `theory_radius` is filled from the `orig_*` values (`:171-173`).

#### Research subtype: `/obj/machinery/doppler_array/research`  (`doppler_array.dm:195`)

- `name = "tachyon-doppler research array"` (`:196`); `desc = "A specialized tachyon-doppler bomb detection array that uses the results of the highest yield of explosions for research."` (`:197`); `var/datum/techweb/linked_techweb` (`:198`).
- Overrides `sense_explosion` (`:200-237`): calls `. = ..()` first and returns if that was FALSE (`:202-204`), so every base gate above applies.
- Not linked by itself: `if(!istype(linked_techweb)) say("Warning: No linked research system!")` (`:205-207`).

#### Research subtype: `/obj/machinery/doppler_array/research/science`  (`doppler_array.dm:239`)

- Inherits everything above, including name `tachyon-doppler research array` and desc from `/research` (`:196-197`).
- Only override: `Initialize()` (`:239-241`) calls `. = ..()` and sets `linked_techweb = SSresearch.science_tech` (`:241`). This is the only type in the family that links to the science tech web.
- Map placed x1 on BoxStation.

Point calculation (`doppler_array.dm:209-237`), with `orig_light_range` (the uncapped shockwave range):

| step | condition | result | file:line |
|---|---|---|---|
| too small | `orig_light_range < 10` | `say("Explosion not large enough for research calculations.")`, return | `:211-213` |
| formula | `orig_light_range < 4500` | `point_gain = (83300 * orig_light_range) / (orig_light_range + 3000)` | `:214-215` |
| cap | otherwise | `point_gain = TECHWEB_BOMB_POINTCAP` = 50000 (`code/__DEFINES/research.dm:78`) | `:216-217` |
| new record high | `point_gain > linked_techweb.largest_bomb_value` and (`point_gain <= 50000` or stored largest < 50000) | store new largest, `point_gain -= old largest`, `point_gain = min(point_gain, 50000)` | `:220-225` |
| capped record | new record high but the two conditions above fail | `largest_bomb_value = 50000`, `point_gain = 1000` | `:226-228` |
| already captured | `point_gain <= largest_bomb_value` | `say("Data already captured. Aborting.")`, return | `:235-237` |
| payout | science account exists | `D.adjust_money(point_gain)` (`:231`), `linked_techweb.add_point_type(TECHWEB_POINT_TYPE_DEFAULT, point_gain)` (`:232`), `say("Explosion details and mixture analyzed and sold to the highest bidder for [point_gain] cr, with a reward of [point_gain] points.")` (`:233`) | `:229-233` |

The science account is `SSeconomy.get_dep_account(ACCOUNT_SCI)` (`:229`; `ACCOUNT_SCI "SCI"`, `code/__DEFINES/economy.dm:19`). If it does not exist, no money and no points are given and no message is said (the `if(D)` at `:230` has no else).

#### Drops, health, power

- Construction chain: none. No `circuit`, no frame, no `component_parts` (`_machinery.dm:112`, `:122`).
- Deconstruction chain: none (no crowbar or screwdriver handler; the wrench only anchors).
- Drops: (a) destroyed: `obj_destruction` -> `deconstruct(FALSE)` (`code/game/objects/obj_defense.dm:252-258`) -> qdel, nothing left (`_machinery.dm:402-410`). (b) disassembled: not possible. The records list is lost with the object.
- Health: `max_integrity = 200` (`_machinery.dm:93`), `integrity_failure = 0` (`objs.dm:19`) so no BROKEN state from damage (`obj_defense.dm:17`).
- Armor: machinery default (`_machinery.dm:136-137`): `melee 25, bullet 10, laser 10, energy 0, bomb 0, bio 0, rad 0, fire 50, acid 70`.
- Power: `use_power = IDLE_POWER_USE` (`_machinery.dm:102`); `idle_power_usage` and `active_power_usage` not set on the type, so 0 (`_machinery.dm:106-107`). Unit not stated. `powered()` returns FALSE when not anchored, otherwise the area power (`doppler_array.dm:182-185`). Channel `AREA_USAGE_EQUIP` (`_machinery.dm:108`).
- Icon: BROKEN -> `"<state>-broken"`, powered -> `<state>`, else `"<state>-off"` (`doppler_array.dm:187-193`).

#### Gotchas

- The array must be anchored to count as powered (`doppler_array.dm:182-185`), and it must be anchored to be turned (`rotation.dm:134-136`). An unanchored array shows its `-off` icon but still records explosions, because `sense_explosion` checks only `NOPOWER` (`doppler_array.dm:137`) (read from the code).
- The announcement cooldown (`next_announce`) is set before the distance and direction checks (`doppler_array.dm:143-145` vs `:150-153`), so an explosion out of range or behind the dish still uses up the 10 ds cooldown.
- Only explosions in the facing direction are recorded (`doppler_array.dm:152-153`), so placement and rotation decide what it sees.
- The `COMSIG_GLOB_EXPLOSION` signal goes to every array on the map; the z-level, cooldown, range and direction checks run per array (`doppler_array.dm:24`, `:137-153`).
- `printer_ready` starts at `world.time + 40` at Initialize (`doppler_array.dm:25`), so printing is blocked for the first 40 ds after the array is created and for 40 ds after each print.
- The research array only adds points for explosions that pass every base check (`doppler_array.dm:202-204`) and with a valid light range of at least 10 (`:211`).
- The research subtype alone (`/obj/machinery/doppler_array/research`, `:195`) has no tech web link and warns on every accepted explosion (`:205-207`).
- Record titles count upward from 1 on each array (`:16`, `:156`); the list is per object, not saved anywhere.

## Kitchen machinery: food cart and ice cream vat

### food cart  `/obj/machinery/food_cart`   (`code/modules/food_and_drinks/kitchen_machinery/food_cart.dm:5`)

- What it is: a movable hot-dog stand that stores snacks, keeps a 200-unit drink reservoir and a 100-unit mixer, and serves food and glasses through a browser popup.
- Key vars (`food_cart.dm`):
  - `name = "food cart"` (`:6`), `desc = "New generation hot dog stand."` (`:7`)
  - `icon = 'icons/obj/kitchen.dmi'`, `icon_state = "foodcart"` (`:8-9`)
  - `density = TRUE` (`:10`), `anchored = FALSE` (`:11`), `use_power = NO_POWER_USE` (`:12`)
  - `food_stored = 0` (`:13`), `glasses = 0` (`:14`), `portion = 10` (`:15`), `selected_drink` (`:16`), `stored_food = list()` (`:17`), `mixer` (`:18`)
  - Defines: `STORAGE_CAPACITY 30` (`:1`), `LIQUID_CAPACIY 200` (`:2`, spelled that way in the source), `MIXER_CAPACITY 100` (`:3`)
- `Initialize` (`:20-24`): `create_reagents(LIQUID_CAPACIY, OPENCONTAINER | NO_REACT)` (`:22`); `mixer = new /obj/item/reagent_containers(src, MIXER_CAPACITY)` with `mixer.name = "Mixer"` (`:23-24`).
- Parent `/obj/machinery` (`_machinery.dm:86`): `max_integrity = 200` (`_machinery.dm:93`), default armor (`_machinery.dm:136-137`). Nothing overridden.

#### Interactions (`attackby`, `food_cart.dm:62-105`)

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| wrench (`TOOL_WRENCH`) | `default_unfasten_wrench(user, O, 0)` (`:63-64`); needs a floor if unanchored (`_machinery.dm:469-473`, "needs to be on the floor to be secured!") | 0 (`:64`; the `time` argument is 0, so the "You begin" line is skipped, `_machinery.dm:480-481`) | `"<span class='notice'>You [anchored ? "un" : ""]secure [src].</span>"` (`_machinery.dm:486`) | toggles `anchored` (`_machinery.dm:487`); returns TRUE (`food_cart.dm:65`) |
| empty drinking glass (`/obj/item/reagent_containers/food/drinks/drinkingglass`) | `!DG.reagents.total_volume` (`:68`) | none | `"<span class='notice'>[src] accepts the drinking glass, sterilizing it.</span>"` (`:71`) | glass deleted (`:69`), `glasses++` (`:70`) |
| drinking glass with liquid in it | none matched | none | none | nothing happens (no `else` branch; `updateDialog()` at `:105`) |
| food snack (`/obj/item/reagent_containers/food/snacks`) | `isFull()` FALSE (`:73`) | none | when full: `"<span class='warning'>[src] is at full capacity.</span>"` (`:74`) | moved into the cart (`user.transferItemToLoc`, `:77`); `stored_food[sanitize(S.name)]` +1, or set to 1 (`:79-82`) |
| sheet of glass (`/obj/item/stack/sheet/glass`) | `G.get_amount() >= 1` (`:85`) | none | `"<span class='notice'>[src] accepts a sheet of glass.</span>"` (`:88`) | `G.use(1)` (`:86`), `glasses += 4` (`:87`) |
| serving tray (`/obj/item/storage/bag/tray`) | per snack in the tray (`:91`); `isFull()` checked per snack (`:92`) | none | when full: `"<span class='warning'>[src] is at full capacity.</span>"` (`:93`) | each snack taken with `COMSIG_TRY_STORAGE_TAKE` (`:96`) and counted in `stored_food` (`:97-100`) |
| any drainable item (`O.is_drainable()`) | (`:101`) | none | none | returns without acting (`:102`) |
| anything else | (`:103`) | none | normal attack chain (`code/_onclick/item_attack.dm:58-59`) | `. = ..()` (`:104`) |

#### Browser UI and the `Topic` actions

- `ui_interact` (`:30-57`) opens a browser popup `"Food Cart"`, size `500, 350` (`:55`), title strings verbatim: `STORED INGREDIENTS AND DRINKS`, `Remaining glasses:`, `Portion:`, `Purge`, `Pour in a glass`, `Add to the mixer`, `MIXER CONTENTS`, `Transfer back`, `STORED FOOD`, `Dispense`, `Refresh`, `Close` (`:33-53`).
- `Topic` (`:107-154`), each link verbatim in its `href`:

| link | condition | effect | message(s) verbatim | file:line |
|---|---|---|---|---|
| `disposeI=<reagent>` (Purge) | none | `reagents.del_reagent` | none | `:111-112` |
| `dispense=<name>` (Dispense) | `stored_food[...]-- <= 0` (`:115`) | when the count is 0 or less it is set to 0 and nothing moves; otherwise the count drops by one and the first matching item in `contents` moves to `drop_location()` (`:116-121`) | none | `:114-122` |
| `portion=1` | none | `input("How much drink do you want to dispense per glass?")`, clamped 0 to 50 | the prompt text above | `:124-128` |
| `pour=<reagent>` / `m_pour=<reagent>` | `glasses-- > 0` | creates a drinking glass at `loc` and moves `portion` units from the cart or the mixer | `"<span class='warning'>There are no glasses left!</span>"` (`:132`) when none | `:130-139` |
| `mix=<reagent>` (Add to the mixer) | none | `reagents.trans_id_to(mixer, ..., portion)` | `"<span class='warning'>[mixer] is full!</span>"` (`:143`); `[mixer]` is the item named `Mixer` | `:141-143` |
| `transfer=<reagent>` (Transfer back) | none | `mixer.reagents.trans_id_to(src, ..., portion)` | `"<span class='warning'>[src] is full!</span>"` (`:147`) | `:145-147` |
| `close=1` | none | `usr.unset_machine()`, `usr << browse(null,"window=foodcart")` | none | `:151-153` |

#### Construction chain

- None on the type. No `circuit`, no frame, and no build recipe in the source (search of `code/` for `food_cart` finds only `food_cart.dm` itself).
- To place it, a wrench sets `anchored` (see the table above), which takes 0 ds.

#### Deconstruction chain

- None with a tool. There is no screwdriver, crowbar or `attackby` branch for deconstruction; the only route is destruction, which goes through `deconstruct(FALSE)` (`code/game/objects/obj_defense.dm:252-258`).

#### Drops

- (a) Destroyed: `deconstruct()` is overridden and ignores `disassembled`: `new /obj/item/stack/sheet/metal(loc, 4)` (`food_cart.dm:156-159`), then `qdel`. Then `Destroy()` runs `QDEL_NULL(mixer)` (`:26-28`) and the machinery `Destroy` runs `dropContents()` (`_machinery.dm:171`, `:201-210`), so any items inside the cart are moved to the floor. Reagents and the `stored_food` counts are lost (inferred from the code).
- (b) Disassembled: not possible; same result as (a).

#### Health / armor / power

- `max_integrity` 200 (inherited, `_machinery.dm:93`); `integrity_failure` 0 (`objs.dm:19`), so it never enters a broken state from damage.
- Armor: machinery default (`_machinery.dm:136-137`): `melee 25, bullet 10, laser 10, energy 0, bomb 0, bio 0, rad 0, fire 50, acid 70`.
- Power: `NO_POWER_USE` (`food_cart.dm:12`), so none.

#### Gotchas

- `isFull()` is never true. `food_stored` is declared (`:13`) and read (`:60`) but never written, so `STORAGE_CAPACITY` (30, `:1`) is never enforced.
- A drinking glass that still holds liquid is refused with no message at all (`:66-71`).
- One sheet of glass gives four glasses (`:87`).
- The cart is placed unanchored (`:11`) and can be pushed until a wrench on a floor tile anchors it.
- Pouring and mixing use the player's `portion` (default 10, `:15`), which the player sets in a prompt (`:125`).

---

### ice cream vat  `/obj/machinery/icecream_vat`   (`code/modules/food_and_drinks/kitchen_machinery/icecream_vat.dm:9`)

- What it is: a reagent vat that makes scoops and cones from its own stock, scoops ice cream into `snacks/icecream` items, and takes a beaker.
- Key vars (`icecream_vat.dm`):
  - `name = "ice cream vat"` (`:10`); `desc = "Ding-aling ding dong. Get your Nanotrasen-approved ice cream!"` (`:11`)
  - `icon = 'icons/obj/kitchen.dmi'`, `icon_state = "icecream_vat"` (`:12-13`)
  - `density = TRUE` (`:14`), `anchored = FALSE` (`:15`), `use_power = NO_POWER_USE` (`:16`), `layer = BELOW_OBJ_LAYER` (`:17`), `max_integrity = 300` (`:18`)
  - `product_types = list()` (`:19`), `dispense_flavour = ICECREAM_VANILLA` (`:20`), `flavour_name = "vanilla"` (`:21`), `beaker = null` (`:22`)
  - Defines (`:1-7`): `ICECREAM_VANILLA 1`, `ICECREAM_CHOCOLATE 2`, `ICECREAM_STRAWBERRY 3`, `ICECREAM_BLUE 4`, `ICECREAM_CUSTOM 5`, `CONE_WAFFLE 6`, `CONE_CHOC 7`
  - `icecream_vat_reagents` (static, `:23-31`): 6 units each of `consumable/milk`, `flour`, `sugar`, `ice`, `coco`, `vanilla`, `berryjuice` and `ethanol/singulo`.
- `Initialize` (`:69-75`): pads `product_types` to 7 entries of 5 each (`:71-72`, 35 items in total); `create_reagents(100, NO_REACT | OPENCONTAINER)` (`:73`); adds the 48 units of the static list (`:74-75`).
- Parent `/obj/machinery`: armor default applies (not set, `_machinery.dm:136-137`).

#### Recipes (`get_ingredient_list`, `icecream_vat.dm:33-48`)

| product (`make` id) | ingredients | file:line |
|---|---|---|
| vanilla (1, default branch) | milk, ice, vanilla | `:47-48` |
| chocolate (2) | milk, ice, coco | `:36` |
| strawberry (3) | milk, ice, berryjuice | `:38` |
| blue (4) | milk, ice, singulo | `:40` |
| custom (5) | milk, ice | `:42` |
| waffle cone (6) | flour, sugar | `:44` |
| chocolate cone (7) | flour, sugar, coco | `:46` |

`make` (`:153-170`): needs `amount * 3` of each ingredient (`:154`, `:156`); on success removes `amount * 3` of each (`:161-162`) and adds `amount` to `product_types[make_type]` (`:163`).

#### Interactions

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| `snacks/icecream` item (an ice cream cone) | `!I.ice_creamed` (`:110`) and `product_types[dispense_flavour] > 0` (`:111`) | none | `"[icon2html(src, viewers(src))] <span class='info'>[user] scoops delicious [flavour_name] ice cream into [I].</span>"` (`:112`) | `product_types[dispense_flavour] -= 1` (`:113`); `add_ice_cream(flavour_name, beaker.reagents)` if the beaker has volume, else `add_ice_cream(flavour_name)` (`:114-117`); sugar topped up to 10 (`:118-119`); `updateDialog()` (`:120`) |
| same, none left | | none | `"<span class='warning'>There is not enough ice cream left!</span>"` (`:122`) | none |
| same, already scooped | `I.ice_creamed` set | none | `"<span class='warning'>[O] already has ice cream in it!</span>"` (`:124`) | none |
| open reagent container (`/obj/item/reagent_containers`, not `ABSTRACT`, `is_open_container()`) | (`:126`) | none | `"<span class='notice'>You add [B] to [src].</span>"` (`:132`) | `user.transferItemToLoc(B, src)`, `replace_beaker(user, B)` (`:129-131`); the old beaker, if any, goes to the user's hands (`:299-301`) |
| drainable item (`is_drainable()`) | (`:136`) | none | none | returns without acting (`:137`) |
| anything else, including a wrench | (`:138`) | none | normal attack chain (`item_attack.dm:58-59`) | `..()`; a wrench therefore hits the vat rather than anchoring it |
| Alt-click | `can_interact` and `canUseTopic(src, BE_CLOSE, ...)` (`:292`) | none | none | `replace_beaker(user)` (`:294`): the beaker goes to the user's hands (`:299-301`) |

Browser actions (`Topic`, `:172-210`):

| link | effect | message(s) verbatim | file:line |
|---|---|---|---|
| `select=<n>` | sets `dispense_flavour` and `flavour_name` | `"<span class='notice'>[usr] sets [src] to dispense [flavour_name] flavoured ice cream.</span>"` (`:178`) | `:175-178` |
| `cone=<6 or 7>` | if `product_types >= 1`: decrements it, creates a `snacks/icecream` at `loc`, sets its cone type | `"<span class='info'>[usr] dispenses a crunchy [cone_name] cone from [src].</span>"` (`:187`); else `"<span class='warning'>There are no [cone_name] cones left!</span>"` (`:189`) | `:180-189` |
| `make=<n>&amount=<1 or 5>` | calls `make` (see above) | `"<span class='info'>[user] whips up some [flavour] icecream.</span>"` or `"<span class='info'>[user] cooks up some [flavour] cones.</span>"` (`:166`, `:168`); on lack of ingredients `"<span class='warning'>You don't have the ingredients to make this!</span>"` (`:170`) | `:191-194` |
| `disposeI=<type>` | `reagents.del_reagent(text2path(...))` | none | `:196-197` |
| `refill=1` | `RefillFromBeaker()`: moves each beaker reagent that is in the vat list, with `say("Internalizing reagent.")` and `playsound` `'sound/items/drink.ogg'` at 25 for each (`:145-148`) | `"Internalizing reagent."` (`:147`) | `:199-200` |
| `refresh=1` / `close=1` | redraw; close unsets the machine and browses `window=icecreamvat` | none | `:204-209` |

- `ui_interact` (`:77-105`): browser popup `"Icecream Vat"`, size `700, 500` (`:103`). Headings verbatim: `ICE CREAM`, `Dispensing: [flavour_name] icecream`, `CONES`, `BEAKER CONTENT` (only with a beaker), `VAT CONTENT`. Links: `Select`, `Make`, `x5`, `Dispense`, `Refill from beaker`, `Purge`, `Refresh`, `Close`. Units: "scoops left" for vanilla, "dollops left" for strawberry, chocolate, blue and custom, "cones left" for cones (`:82-89`).

#### Construction chain

- None on the type. No `circuit`, no frame, and no build recipe (a search of `code/` for `icecream_vat` finds only `icecream_vat.dm`).

#### Deconstruction chain

- None with a tool. `attackby` has no screwdriver, crowbar or wrench branch; the only route is destruction (`obj_defense.dm:252-258`).

#### Drops

- (a) Destroyed: `deconstruct()` is overridden: `new /obj/item/stack/sheet/metal(loc, 4)` (`icecream_vat.dm:285-288`), then `qdel`. Then the machinery `Destroy` runs `dropContents()` (`_machinery.dm:171`, `:201-210`), so an inserted beaker and any other item in `contents` are moved to the floor. Reagents in the vat and the `product_types` stock are lost (inferred from the code).
- (b) Disassembled: not possible; same result as (a).

#### Health / armor / power

- `max_integrity = 300` (`icecream_vat.dm:18`); `integrity_failure` 0 (`objs.dm:19`).
- Armor: not set on the type, so the machinery default applies (`_machinery.dm:136-137`).
- Power: `NO_POWER_USE` (`icecream_vat.dm:16`), so none.

#### Gotchas

- The vat is placed unanchored (`:15`) and has no wrench branch, so a wrench hits it (`:136-139`, `item_attack.dm:58-59`) and cannot anchor it (inferred from the absence of a handler).
- Scooping an ice cream item consumes one scoop of the chosen flavour (`:113`), but does not change the cone counts (cones are only taken by the `cone=` link, `:184`).
- The `make` cost is three times the amount of each ingredient (`:154`); a `x5` order therefore takes 15 of each ingredient and gives 5 items (`:161-163`).
- The vat passes its beaker reagents to `add_ice_cream` for every flavour (`icecream_vat.dm:114-115`), but only the `custom` branch of the item's `add_ice_cream` (`icecream_vat.dm:240`, `:263-271`) uses them; the other flavours add their fixed 3 units of flavouring (`:245`, `:249`, `:253`, `:257`) and ignore the beaker.

## Gibber family

### gibber  `/obj/machinery/gibber`   (`code/modules/food_and_drinks/kitchen_machinery/gibber.dm:1`)

- What it is: a frame-built grinder. A grabbed carbon mob is stuffed inside, the gibber is switched on by an empty-hand click, and after `gibtime` ds the mob is gibbed into meat slabs, a skin and gib decals.
- Key vars (`gibber.dm`):
  - `name = "gibber"` (`:2`), `desc = "The name isn't descriptive enough?"` (`:3`)
  - `icon = 'icons/obj/kitchen.dmi'`, `icon_state = "grinder"` (`:4-5`), `density = TRUE` (`:6`)
  - `use_power = IDLE_POWER_USE` (`:7`), `idle_power_usage = 2` (`:8`), `active_power_usage = 500` (`:9`)
  - `circuit = /obj/item/circuitboard/machine/gibber` (`:10`)
  - `operating = FALSE` (`:12`), `dirty = FALSE` (`:13`; declared and read at `:43` only, never set in this file), `gibtime = 40` (`:14`, ds), `meat_produced = 0` (`:15`), `ignore_clothing = FALSE` (`:16`)
- `Initialize` (`:19-21`): `add_overlay("grjam")`.
- `RefreshParts` (`:23-31`), run at build time (`constructable_frame.dm:199`) and when a map-placed machine gets its default parts (`circuitboard.dm:56`):
  - `gibtime = 40` (`:24`)
  - each `stock_parts/matter_bin` adds its `rating` to `meat_produced` (`:26-27`)
  - each `stock_parts/manipulator`: `gibtime -= 5 * M.rating` (`:29`); if `M.rating >= 2`, `ignore_clothing = TRUE` (`:30-31`)
  - Default part rating is `1` (`code/modules/research/stock_parts.dm:128`). With one basic bin and one basic manipulator this gives `meat_produced = 1` and `gibtime = 35` (inferred arithmetic).
- Parent `/obj/machinery`: `max_integrity 200` (`_machinery.dm:93`), default armor (`_machinery.dm:136-137`), `anchored = TRUE` (`_machinery.dm:98`) by default.
- Circuit board `/obj/item/circuitboard/machine/gibber` (`code/game/objects/items/circuitboards/machine_circuitboards.dm:1040-1047`): `name = "Gibber (Machine Board)"` (`:1041`), `icon_state = "service"` (`:1042`), `build_path = /obj/machinery/gibber` (`:1043`), `req_components = list(/obj/item/stock_parts/matter_bin = 1, /obj/item/stock_parts/manipulator = 1)` (`:1044-1046`), `needs_anchored = FALSE` (`:1047`).
- Map placed x1 on BoxStation. Placed machines get their board and parts from `apply_default_parts` (`machinery Initialize`, `_machinery.dm:141-143`; `circuitboard.dm:35-56`).

#### Interactions

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| empty hand, click, not pulling anybody (`attack_hand` -> `startgibbing`, `:63-104`, `:138-148`) | `!operating` (`:139`); `occupant` set (`:141`) | `use_power(1000)` (`:144`); the gibbing runs `gibtime` ds (`:203`) | no occupant: `"<span class='hear'>You hear a loud metallic grinding sound.</span>"` (`:142`); started: `"<span class='hear'>You hear a loud squelchy grinding sound.</span>"` (`:145`) and sound `'sound/machines/juicer.ogg'` 50 (`:146`) | `operating = TRUE` (`:147`), icon update (`:148`), shake animation with a `loop = 200` (`:150-151`) |
| empty hand, click, while `operating` | `operating` (`:69`) | none | `"<span class='danger'>It's locked and running.</span>"` (`:70`) | none |
| click while `NOPOWER` or `BROKEN` | `machine_stat & (NOPOWER|BROKEN)` (`:67`) | none | none | returns silently (`:68`) |
| click while not anchored | `!anchored` (`:73`) | none | `"<span class='warning'>[src] cannot be used unless bolted to the ground!</span>"` (`:74`) | none |
| grab (`INTENT_GRAB`) a living mob with the mob pulled | `user.pulling && user.a_intent == INTENT_GRAB && isliving(user.pulling)` (`:77`) | none | not a carbon: `"<span class='warning'>This item is not suitable for the gibber!</span>"` (`:80`) | none |
| same, subject is buckled or has buckled mobs | `C.buckled || C.has_buckled_mobs()` (`:83`) | none | `"<span class='warning'>[C] is attached to something!</span>"` (`:84`) | none |
| same, subject has abiotic items and `!ignore_clothing` | any held or equipped item without `TRAIT_NODROP` (`:87-89`) | none | `"<span class='warning'>Subject may not have abiotic items on!</span>"` (`:90`) | none |
| same, all checks pass | | `do_after(user, gibtime, target = src)` (`:97`) | start: `"<span class='danger'>[user] starts to put [C] into the gibber!</span>"` (`:93`); on success: `"<span class='danger'>[user] stuffs [C] into the gibber!</span>"` (`:99`) | `C.forceMove(src)`, `occupant = C`, `update_icon()` (`:100-102`) |
| wrench (`TOOL_WRENCH`) | `default_unfasten_wrench(user, P)` with the default `time = 20` (`_machinery.dm:475-492`); needs a floor if unanchored (`:469-473`) | 20 (`_machinery.dm:475`, `:485`) | `"<span class='notice'>You begin [anchored ? "un" : ""]securing [src]...</span>"` (`_machinery.dm:481`), then `"<span class='notice'>You [anchored ? "un" : ""]secure [src].</span>"` (`:486`) | `setAnchored(!anchored)` (`:487`), sound `'sound/items/deconstruct.ogg'` 50 (`:488`) |
| screwdriver (`TOOL_SCREWDRIVER`) | `!NODECONSTRUCT` (`_machinery.dm:448`) | none | `"<span class='notice'>You open the maintenance hatch of [src].</span>"` (`_machinery.dm:453`) / `"...You close the maintenance hatch of [src].</span>"` (`:457`) | `panel_open` toggled; icon `grinder_open` / `grinder` (`gibber.dm:107`, `_machinery.dm:450-456`) |
| crowbar (`TOOL_CROWBAR`), panel closed, machine not operational | `default_pry_open`: `!(state_open || panel_open || is_operational() || NODECONSTRUCT)` (`_machinery.dm:390`) | none | `"<span class='notice'>[usr] pries open \the [src].</span>"` and `"<span class='notice'>You pry open \the [src].</span>"` (`_machinery.dm:393`) | `open_machine()` (`_machinery.dm:394`): the occupant is dropped (`:193-199`) |
| crowbar, panel open | `default_deconstruction_crowbar`: `(panel_open || ignore_panel)` and `!NODECONSTRUCT` (`_machinery.dm:397`) | none | none in the chain | `deconstruct(TRUE)` (`_machinery.dm:400`): see Drops |
| any other item | `attackby` falls through to `..()` (`gibber.dm:118-119`) | none | normal attack chain (`item_attack.dm:58-59`) | damage through the armor (`item_attack.dm:122-128`) |
| walk away while inside (`relaymove`) or resist (`container_resist`) | occupant inside | none | none | `go_out()` (`gibber.dm:57-61`) |
| verb "empty gibber" (`set name = "empty gibber"`, `set src in oview(1)`) | `!usr.incapacitated()` (`:128`) | none | none | `go_out()`, `add_fingerprint` (`:123-132`) |

`go_out()` (`gibber.dm:134-136`): `dropContents()` and `update_icon()`.

#### What the gibbing does (`startgibbing`, `gibber.dm:138-204`)

- Sets the occupant's `death(1)` and `ghostize()` and qdels the occupant (`:200-202`). The name on each slab is `"[sourcename] [newmeat.name]"` (`:186`); the skin type comes from the species (`:167-171`) or from the carbon's `type_of_meat`, `gib_type` (`:173-176`); monkeys give `/obj/item/stack/sheet/animalhide/monkey`, aliens `/obj/item/stack/sheet/animalhide/xeno` (`:177-180`). The default meat is `/obj/item/reagent_containers/food/snacks/meat/slab/human` (`:160`), the default gib is `/obj/effect/decal/cleanable/blood/gibs` (`:159`).
- Nutriment per slab is `sourcenutriment / meat_produced`, where `sourcenutriment = mob_occupant.nutrition / 15` (`:158`, `:189`). The occupant's reagents are split across the slabs (`:190-191`).
- `addtimer(CALLBACK(src, .proc/make_meat, ...), gibtime)` (`:203`) runs `make_meat` after `gibtime` ds.
- `make_meat` (`:205-224`): `playsound` `'sound/effects/splat.ogg'` 50 (`:206`); `operating = FALSE` (`:207`); skin thrown with `throw_at(pick(nearby_turfs), meat_produced, 3)` (`:210-212`); each slab forceMoved to `loc` and thrown (`:213-216`); gib decals placed on non-dense turfs in view (`:217-220`); `pixel_x` reset, `operating = FALSE`, `update_icon()` (`:222-224`).

#### Construction chain (frame-built, the only way to make a new gibber)

Step 0. Frame. Stack recipe `"machine frame"`: `/obj/structure/frame/machine`, 5 metal sheets, `time = 25`, one per turf, on floor (`code/game/objects/items/stacks/sheets/sheet_types.dm:52`; the list is `GLOB.metal_recipes`, `:17`; the metal sheet uses it at `:133-135`). The frame has `max_integrity = 250` (`code/game/machinery/constructable_frame.dm:6`), `state = 1`, `icon_state = "box_0"` (`:4`, `:8`).

| state | step | tool / item | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|---|
| 1 | anchor | wrench (`TOOL_WRENCH`) | 40 (`constructable_frame.dm:106`) | `"You start [anchored ? "un" : ""]securing [src]..."` (`:105`); `"You [anchored ? "un" : ""]secure [src]."` (`:108`) | `setAnchored(!anchored)` (`:109`) |
| 1 | disassemble | screwdriver, only when unanchored (`:94`) | 40 (`:97`) | `"[user] disassembles the frame."` (`:95`); `"You disassemble the frame."` (`:99`) | returns 5 metal (`:100`) and qdels the frame (`:102`) |
| 1 -> 2 | add cables | cable coil, amount 5 (`:83-84`) | 20, volume 50, amount 5 (`:87-88`) | `"You start to add cables to the frame..."` (`:87`); `"You add cables to the frame."` (`:89`) | `state = 2`, `icon_state = "box_1"` (`:90-91`) |
| 2 | anchor | wrench | 40, volume 75 (`:115`) | as state 1 (`:114`, `:116`) | `setAnchored(!anchored)` (`:117`) |
| 2 -> 1 | remove cables | wirecutter (`TOOL_WIRECUTTER`) | none | `"You remove the cables."` (`:146`) | `state = 1`, `icon_state = "box_0"`, 5 cable coil returned (`:147-149`) |
| 2 -> 3 | insert circuit board | `/obj/item/circuitboard/machine/gibber` | none | `"You add the circuit board to the frame."` (`:131`); unanchored is allowed because `needs_anchored = FALSE` (`:125`, `machine_circuitboards.dm:1047`) | `circuit = B`, `icon_state = "box_2"`, `state = 3`, `req_components` copied from the board (`:132-136`) |
| 2 | (board check) | a board with no `build_path` | none | `"<span class'warning'>This circuitboard seems to be broken.</span>"` (`:123`, the tag typo is in the source) | none |
| 3 | add parts | 1 `/obj/item/stock_parts/matter_bin` and 1 `/obj/item/stock_parts/manipulator` (any rating) | none | `"You add [P] to [src]."` (`:265`); a wrong part: `"You cannot add that to the machine!"` (`:269`) | `components` gets the part, `req_components[I]--` (`:266-267`) |
| 3 | add parts (part replacer) | `/obj/item/storage/part_replacer` with contents (`:203`) | none | `"[part.name] applied."` per part (`:239`) | parts taken, best rating first (`:212`) |
| 3 | remove board | crowbar (`TOOL_CROWBAR`) | none | `"You remove the circuit board."` (`:160`) or `"You remove the circuit board and other components."` (`:162`) | `state = 2`, board and components dropped, `icon_state = "box_1"` (`:153-168`) |
| 3 | anchor | wrench, only if `!circuit.needs_anchored` (`:171`) | 40 (`:173`) | as state 1 | `setAnchored(!anchored)` (`:175`) |
| 3 -> machine | finish | screwdriver, only when every `req_components` count is 0 (`:179-184`) | none | none (only `P.play_tool_sound(src)`, `:185`) | `new circuit.build_path(loc)` (`:186`), board attached as `new_machine.circuit` (`:189`), `setAnchored(anchored)` (`:190`), `on_construction()` (`:191`), frame components moved in (`:195-197`), `RefreshParts()` (`:199`), frame qdeled (`:200`) |

With the parts missing, the screwdriver does nothing at all (`:178-201`, the `component_check` is 0 and there is no else).

#### Deconstruction chain (of a built or placed gibber)

1. Screwdriver: opens the maintenance hatch (no delay; see the Interactions table). Needed before the crowbar step.
2. Crowbar with the hatch open: `deconstruct(TRUE)` (`_machinery.dm:396-400`). See Drops.
3. Wrench: unanchors in 20 ds (`_machinery.dm:475-487`), needs a floor if unanchored.
4. Crowbar with the hatch closed and the gibber not operational: pries it open and drops the occupant (`_machinery.dm:389-395`).

#### Drops

For the BoxStation gibber (map placed, so `component_parts` holds the board, the bin and the manipulator from `apply_default_parts`, `circuitboard.dm:39-54`):

- (a) Destroyed (`obj_destruction` -> `deconstruct(FALSE)`, `code/game/objects/obj_defense.dm:252-258`): `on_deconstruction()` (empty for this type, `_machinery.dm:576-577`); `spawn_frame(FALSE)` creates `/obj/structure/frame/machine` with `state = 2`, `icon_state = "box_1"`, `obj_integrity = max_integrity * 0.5` (125 of 250, `_machinery.dm:412-420`, `constructable_frame.dm:6`); then the board (`circuit`), the micro-manipulator and the matter bin are moved to `loc` (`_machinery.dm:406-409`).
- (b) Deconstructed with the crowbar (panel open): the same, but the frame is at full integrity (`_machinery.dm:416-417` only when `!disassembled`).
- The occupant is dropped by `dropContents()` in `Destroy` (`_machinery.dm:171`, `:201-210`); a mob still inside is moved out alive, not gibbed (inferred from the code).

For a frame-built gibber (the board is not in `component_parts`, because the frame code sets `new_machine.circuit = circuit` and moves only the frame's components into `component_parts`, `constructable_frame.dm:186-198`):

- (a) and (b) drop the stock parts and a state-2 frame, but not the board. Nothing else in the code moves `circuit` (`_machinery.dm` mentions `circuit` only at `:122`, `:141-143`). The board is left in nullspace (inferred from the code; not run).

#### Health / armor / power

- `max_integrity 200` (`_machinery.dm:93`), `integrity_failure 0` (`objs.dm:19`), so no BROKEN state from damage. Destroyed at 0 (`obj_defense.dm:20-21`).
- Armor: machinery default (`_machinery.dm:136-137`): `melee 25, bullet 10, laser 10, energy 0, bomb 0, bio 0, rad 0, fire 50, acid 70`.
- Power: `use_power = IDLE_POWER_USE` (`gibber.dm:7`); `idle_power_usage = 2` (`:8`); `active_power_usage = 500` (`:9`); `use_power(1000)` per gibbing (`:144`). Unit not stated in the DM (the brief says watts). Channel default equipment (`_machinery.dm:108`).

#### Gotchas

- Anchoring is required to use it (`gibber.dm:73-75`), and anchoring needs a floor (`_machinery.dm:469-473`).
- A dead gibber (NOPOWER or BROKEN) gives no message on click; it simply returns (`gibber.dm:67-68`).
- Abiotic items block grabbing unless the manipulator rating is 2 or more (`:30-31`, `:87-91`); a rating 2 manipulator is the only way to set `ignore_clothing`.
- `gibtime` is used both for the grab `do_after` (`:97`) and for the gibbing timer (`:203`), so the base time is 35 ds with basic parts and 40 ds with none (`:24`, `:29`).
- The `examine` text shows `gibtime*0.1` seconds (`:36`); the DM converts for display only, and the variable stays in ds.
- `meat_produced` is the sum of matter-bin ratings (`:27`), so one basic bin gives one slab.
- The screwdriver/crowbar/wrench order matters: `default_deconstruction_screwdriver`, then `default_pry_open`, then `default_unfasten_wrench`, then `default_deconstruction_crowbar` (`gibber.dm:106-119`).
- A part swap made with a part replacer goes through `exchange_parts`, which calls `RefreshParts()` (`_machinery.dm:501-538`), so `gibtime`, `meat_produced` and `ignore_clothing` update without a rebuild (the swap path itself is in `_machinery.dm:501-538`).

## Gulag family: equipment reclaimer and labor camp teleporter

Both machines are used with the labor camp teleporter console `/obj/machinery/computer/prisoner/gulag_teleporter_computer` (`code/game/machinery/computer/prisoner/gulag_teleporter.dm:2`). That console is not on this shard's list; its teleport sequence is written out here because the teleporter does nothing on its own.

### equipment reclaimer station  `/obj/machinery/gulag_item_reclaimer`   (`code/game/machinery/gulag_item_reclaimer.dm:1`)

- What it is: a security-access terminal that keeps the belongings stripped from a prisoner and hands them back when the prisoner's sentence is served (or to security staff).
- Key vars (`gulag_item_reclaimer.dm`):
  - `name = "equipment reclaimer station"` (`:2`), `desc = "Used to reclaim your items after you finish your sentence at the labor camp."` (`:3`)
  - `icon = 'icons/obj/terminals.dmi'`, `icon_state = "dorm_taken"` (`:4-5`)
  - `req_access = list(ACCESS_SECURITY)` (`:6`), `density = FALSE` (`:7`)
  - `use_power = IDLE_POWER_USE` (`:8`), `idle_power_usage = 100` (`:9`), `active_power_usage = 2500` (`:10`)
  - `ui_x = 325`, `ui_y = 400` (`:11-12`)
  - `stored_items = list()` (`:13`, mob -> list of items), `linked_teleporter = null` (`:14`)
- Parent `/obj/machinery`: `max_integrity 200` (`_machinery.dm:93`), default armor (`_machinery.dm:136-137`), `anchored = TRUE` (`_machinery.dm:98`).
- No circuit board, no frame, no build recipe in the source (search of `code/` for `gulag_item_reclaimer` finds only `gulag_item_reclaimer.dm` and the teleporter's `locate` at `gulag_teleporter.dm:114`).

#### Interactions

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| empty hand, click (`ui_interact`, `:30-35`) | `can_interact` (`_machinery.dm:250-280`) | none | none | opens TGUI `GulagItemReclaimer`, size `ui_x` x `ui_y` (325 x 400) |
| TGUI `release_items` (`mobref`) | `H != usr && !allowed(usr)` refuses (`:73-76`) | none | `"<span class='warning'>Access denied.</span>"` (`:75`) when refused | `drop_items(H)` (`:77`), returns TRUE (`:78`) |
| TGUI state `can_reclaim` (`ui_data`) | `allowed(user)` (`:41-42`), or a prisoner ID with `P.points >= P.goal` (`:44-48`) | none | none | the release buttons are enabled for that user |
| a stored mob that no longer exists (`QDELETED`) | checked on each `ui_data` (`:52-56`) | none | `"Alert! Unable to locate vital signals of a previously processed prisoner. Ejecting equipment!"` (`:54`, said with `say`) | `drop_items(thismob)` (`:55`) |
| emag (`emag_act`) | `EMAGGED` not already set (`:25-26`) | none | none | `req_access = list()` (`:27`), `EMAGGED` flag set (`:28`); the code comment says "emagging lets anyone reclaim all the items" (`:25`) |
| any item hit | no `attackby` on the type; `/obj/attackby` -> `attack_obj` (`code/_onclick/item_attack.dm:58-59`) | none | `"<span class='danger'>You hit [src] with [I]!</span>"` when `I.force` (`item_attack.dm:122-127`) | damage through armor (`item_attack.dm:128`); no tool path (no wrench, screwdriver or crowbar branch, `atoms.dm:1160-1161`) |

`drop_items(user)` (`:80-88`): moves every item in `stored_items[user]` to `drop_location()` and removes the mob from `stored_items`.

#### Construction / deconstruction / drops

- Construction chain: none (no `circuit`, no frame, no recipe).
- Deconstruction chain: none with a tool; destruction only.
- Drops: (a) destroyed: `Destroy()` moves every object in `contents` to `get_turf(src)` (`gulag_item_reclaimer.dm:16-19`), clears the teleporter's link (`:20-21`), then the machinery `Destroy` runs (`_machinery.dm:168-176`). `stored_items` (the list of who owns what) is lost. There is no frame; `deconstruct()` finds no `component_parts` (`_machinery.dm:402-410`). (b) disassembled: not possible.

#### Health / armor / power

- `max_integrity 200` (`_machinery.dm:93`), `integrity_failure 0` (`objs.dm:19`).
- Armor: machinery default (`_machinery.dm:136-137`).
- Power: `use_power = IDLE_POWER_USE` (`:8`), `idle_power_usage = 100` (`:9`), `active_power_usage = 2500` (`:10`). Unit not stated in the DM. The default channel is equipment (`_machinery.dm:108`).

#### Gotchas

- Items are kept in the reclaimer's `contents` and in `stored_items[mob]` (`gulag_teleporter.dm:132-143`), so both lists have to stay in step; `drop_items` removes from both (`gulag_item_reclaimer.dm:85-88`).
- The reclaimer's access is `ACCESS_SECURITY` (`:6`); a prisoner ID can also release, once its points reach the goal (`:44-48`).
- The emag is one-shot (`:25-26`), and it removes all access checks for everyone (`:27`).

---

### labor camp teleporter  `/obj/machinery/gulag_teleporter`   (`code/game/machinery/gulag_teleporter.dm:9`)

- What it is: a bluespace-teleporter pod, shaped as a chair with a door. A prisoner goes in, the console strips and jumpsuits them, and sends them to a beacon.
- Key vars (`gulag_teleporter.dm`):
  - `name = "labor camp teleporter"` (`:10`), `desc = "A bluespace teleporter used for teleporting prisoners to the labor camp."` (`:11`)
  - `icon = 'icons/obj/machines/implantchair.dmi'`, `icon_state = "implantchair"` (`:12-13`)
  - `state_open = FALSE` (`:14`), `density = TRUE` (`:15`)
  - `use_power = IDLE_POWER_USE` (`:16`), `idle_power_usage = 200` (`:17`), `active_power_usage = 5000` (`:18`)
  - `circuit = /obj/item/circuitboard/machine/gulag_teleporter` (`:19`)
  - `locked = FALSE` (`:20`), `message_cooldown` (`:21`), `breakout_time = 600` (`:22`, ds)
  - `jumpsuit_type = /obj/item/clothing/under/rank/prisoner` (`:23`), `shoes_type = /obj/item/clothing/shoes/sneakers/orange` (`:24`)
  - `linked_reclaimer` (`:25`)
  - `telegulag_required_items` (static typecache, `:26-33`): `/obj/item/implant`, `/obj/item/clothing/suit/space/eva/plasmaman`, `/obj/item/clothing/under/plasmaman`, `/obj/item/clothing/head/helmet/space/plasmaman`, `/obj/item/tank/internals`, `/obj/item/clothing/mask/breath`, `/obj/item/clothing/mask/gas`. These stay on the prisoner.
- `Initialize` (`:35-37`): `locate_reclaimer()`, which runs `linked_reclaimer = locate(/obj/machinery/gulag_item_reclaimer)` (`:114`) with no location, so it links to the first reclaimer in the world, and sets the reclaimer's `linked_teleporter` back (`:115-116`).
- Parent `/obj/machinery`: armor default (`_machinery.dm:136-137`); `max_integrity 200` (`_machinery.dm:93`).
- Map placed x1 on BoxStation. Board: `/obj/item/circuitboard/machine/gulag_teleporter` (`gulag_teleporter.dm:161-168`): `name = "labor camp teleporter (Machine Board)"` (`:162`), `build_path = /obj/machinery/gulag_teleporter` (`:163`), `req_components = list(/obj/item/stack/ore/bluespace_crystal = 2, /obj/item/stock_parts/scanning_module, /obj/item/stock_parts/manipulator)` (`:164-167`), `def_components = list(/obj/item/stack/ore/bluespace_crystal = /obj/item/stack/ore/bluespace_crystal/artificial)` (`:168`). `needs_anchored` stays at its default TRUE (`code/game/objects/items/circuitboards/circuitboard.dm:27`).

#### Interactions (the pod)

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| empty hand, click (`interact`, `:44-49`) | `can_interact` (`_machinery.dm:250-280`) | none | `"<span class='warning'>[src] is locked!</span>"` (`:47`) when locked | `toggle_open()` (`:49`) |
| `toggle_open` (`:118-128`) | `panel_open` refuses (`:119-121`) | none | `"<span class='notice'>Close the maintenance panel first.</span>"` (`:120`) | opens if closed and unlocked (`:126-127`), closes if open (`:123-125`) |
| screwdriver, only when empty (`attackby`, `:55-57`) | `!occupant` (`:55`) | none | `"<span class='notice'>You open the maintenance hatch of [src].</span>"` / `"<span class='notice'>You close the maintenance hatch of [src].</span>"` (`_machinery.dm:453`, `:457`) | panel toggled (`_machinery.dm:447-459`), `update_icon()` (`:56`) |
| crowbar, panel open | `default_deconstruction_crowbar`, `panel_open` required (`_machinery.dm:396-400`) | none | none | `deconstruct(TRUE)` (see Drops) |
| crowbar or pry, panel closed, not operational | `default_pry_open` (`_machinery.dm:389-395`); `is_operational()` must be FALSE | none | `"<span class='notice'>[usr] pries open \the [src].</span>"` and `"<span class='notice'>You pry open \the [src].</span>"` (`_machinery.dm:393`) | `open_machine()` (`_machinery.dm:394`) |
| wrench | no wrench branch (`gulag_teleporter.dm:54-65`), so the chain falls through to the attack chain (`item_attack.dm:10-20`) | - | `"<span class='danger'>You hit [src] with [I]!</span>"` when `I.force` (`item_attack.dm:124-125`) | damage (`item_attack.dm:128`) |
| relaymove from inside (`:86-94`) | returns unless the mob is conscious (`:87-88`); when locked, the message has a cooldown (`:90-91`) | 50 (cooldown, `:91`) | `"<span class='warning'>[src]'s door won't budge!</span>"` (`:92`) | `open_machine()` if not locked (`:94`) |
| container_resist from inside (`:96-111`) | not locked: `open_machine()` (`:97-99`); locked: breakout | `breakout_time` 600 (`:22`, `:105`) | `"<span class='notice'>You see [user] kicking against the door of [src]!</span>"` (visible, `:102`); `"<span class='notice'>You lean on the back of [src] and start pushing the door open... (this will take about [DisplayTimeText(breakout_time)].)</span>"` (`:103`); `"<span class='hear'>You hear a metallic creaking from [src].</span>"` (`:104`); on success `"<span class='warning'>[user] successfully broke out of [src]!</span>"` (`:109`) and `"<span class='notice'>You successfully break out of [src]!</span>"` (`:110`) | `locked = FALSE` (`:108`), `open_machine()` (`:111`); a failed breakout (not conscious, moved, or unlocked) returns (`:106-107`) |

`updateUsrDialog` is overridden to do nothing (`:51-52`), so the pod has no classic UI; all its remote control is from the console.

#### Console-driven actions on the pod (`gulag_teleporter.dm` console, `code/game/machinery/computer/prisoner/gulag_teleporter.dm`)

| console action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| `toggle_open` (`:102-107`) | `teleporter.locked` refuses | none | `"<span class='alert'>The teleporter must be unlocked first.</span>"` (`:104`) | `teleporter.toggle_open()` (`:106`) |
| `teleporter_lock` (`:108-113`) | `teleporter.state_open` refuses | none | `"<span class='alert'>The teleporter must be closed first.</span>"` (`:110`) | `locked = !locked` (`:112`) |
| `scan_teleporter` / `scan_beacon` (`:82-87`) | none | none | none | `findteleporter()` (`:124-130`): a cardinal neighbour that `is_operational()`; `findbeacon()` = `locate(/obj/structure/gulag_beacon)` (`:132-133`) |
| `teleport` (`:114-118`) | `teleporter` and `beacon` set | `addtimer(..., 5)` (`:117`) | see teleport sequence below | `teleport(usr)` |
| `handle_id` / `set_goal` (`:88-101`) | ID inserted or removed; goal clamped 0 to 1000 (`:100`), default 200 when 0 (`:98-99`, `default_goal` `:12`) | none | `Access denied.` for a user without `allowed` (`:79`) | |

Teleport sequence (`teleport(mob/user)`, `:135-156`):

1. No ID: `"Warning: Unable to transfer prisoner without a valid Prisoner ID inserted!"` (`:137`) and return.
2. Goal unset: `contained_id.goal = default_goal` (`:140-142`) and `"[contained_id]'s ID card goal defaulting to [contained_id.goal] points."` (`:143`).
3. `teleporter.handle_prisoner(contained_id, temporary_record)` (`:145`): strips the occupant (`gulag_teleporter.dm:130-145`), gives the jumpsuit and orange sneakers (`:152-155`), equips the ID (`:156-157`), sets the record to `"Incarcerated"` (`:158-159`).
4. `playsound(src, 'sound/weapons/emitter.ogg', 50, TRUE)` (`:146`), the prisoner is moved to the beacon's turf (`:147`), `Paralyze(40)` (`:148`, ds).
5. `"<span class='warning'>The teleportation makes you a little dizzy.</span>"` (`:149`); sparks effect (`:150`), `playsound(src, "sparks", 50, TRUE)` (`:151`).
6. The pod is unlocked if locked (`:152-153`), `teleporter.toggle_open()` (`:154`, which opens it now that it is unlocked), `contained_id = null`, `temporary_record = null` (`:155-156`).

`strip_occupant()` (`gulag_teleporter.dm:130-145`): each item that is not in `telegulag_required_items` is removed. Handcuffs are dropped on the pod's turf (`:137-139`). Others go into the linked reclaimer's `stored_items[occupant]` and `contents` (`:141-143`); with no reclaimer linked they go into the pod (`:144-145`).

#### Construction chain (frame-built)

Uses the generic machine frame (see the gibber part of this shard: 5 metal, `sheet_types.dm:52`; `constructable_frame.dm:25`). Board: `circuitboard/machine/gulag_teleporter`, which needs anchoring (`needs_anchored` TRUE).

| state | step | tool / item | delay (ds) | result |
|---|---|---|---|---|
| 1 | anchor | wrench | 40 (`constructable_frame.dm:106`) | `setAnchored(!anchored)` (`:109`) |
| 1 -> 2 | cables | cable coil x5 | 20 (`:88`) | `state = 2` (`:90`) |
| 2 | board | the teleporter board; refused if the frame is not anchored (`:125-127`) | none | `state = 3` (`:134`), `req_components` copied from the board (`:136`) |
| 3 | parts | 2 natural `/obj/item/stack/ore/bluespace_crystal`, 1 `/obj/item/stock_parts/scanning_module`, 1 `/obj/item/stock_parts/manipulator` (`circuitboard.dm` `def_components` is not used for frames, `constructable_frame.dm:136`) | none | parts added as in the gibber part |
| 3 | finish | screwdriver when every count is 0 (`constructable_frame.dm:178-201`) | none | `new /obj/machinery/gulag_teleporter(loc)` with the board and parts (`:186-200`) |

Wrench in state 3 is refused because the board needs anchoring (`constructable_frame.dm:171`).

#### Deconstruction chain

1. Screwdriver while empty: opens the hatch (`_machinery.dm:447-459`).
2. Crowbar with the hatch open: `deconstruct(TRUE)` (`_machinery.dm:396-400`).
3. Pry open with the hatch closed when not operational (`_machinery.dm:389-395`).

#### Drops

- Placed (BoxStation) pod: `component_parts` holds the board, the artificial bluespace crystal stack (from `def_components`, `circuitboard.dm:47-51`), the scanning module and the manipulator. (a) Destroyed: `spawn_frame(FALSE)` gives a state-2 frame at half integrity (`_machinery.dm:412-420`), then all parts move to the floor (`:406-409`). (b) Deconstructed (crowbar, hatch open): the same, at full frame integrity (`:416-417`). A prisoner still inside is moved out by `dropContents()` (`:171`, `:201-210`).
- Frame-built pod: the board is not in `component_parts` (see the gibber part), so it is not dropped.

#### Health / armor / power

- `max_integrity 200` (`_machinery.dm:93`), `integrity_failure 0` (`objs.dm:19`); armor default (`_machinery.dm:136-137`).
- Power: `idle_power_usage = 200` (`gulag_teleporter.dm:17`), `active_power_usage = 5000` (`:18`), `use_power = IDLE_POWER_USE` (`:16`). Unit not stated in the DM. The EMP default is `use_power(7500/severity)` when `use_power` is set and `machine_stat` is 0 (`_machinery.dm:187-191`).

#### Gotchas

- The pod does not teleport anyone on its own; the console does (`gulag_teleporter.dm` console, `:135-156`). Without a console, the pod is only a door.
- Locking: the lock can only change while the pod is closed (`:109-111`), and the console will not open a locked pod (`:103-105`). A locked pod is therefore opened from the console only after unlocking, or by the occupant's breakout.
- Breakout takes `breakout_time` 600 ds (`:22`, `:105`) and unlocks the pod (`:108`).
- A panel-open pod refuses to open (`:119-121`) and the screwdriver is blocked while someone is inside (`:55`).
- The occupant is stripped of everything except the required items (`:26-33`, `:134-145`). Handcuffs fall to the floor (`:137-139`).
- The pod's link to a reclaimer is made once at Initialize, by a global `locate` (`:114`); a reclaimer built later is not linked to an existing pod (inferred from `Initialize` only).
- The beacon `/obj/structure/gulag_beacon` is INDESTRUCTIBLE and anchored (`gulag_teleporter.dm:171-177`).
- Cooldown on the "door won't budge" message: 50 ds (`:90-91`).

## Misc machines: computer vendor, library scanner, magnetic control console

### computer vendor  `/obj/machinery/lapvend`   (`code/modules/modular_computers/laptop_vendor.dm:3`)

- What it is: a vendor that builds a laptop or tablet to order from hardware options, takes payment (cash, holochips or an ID card), fabricates the device and ejects it. Parent `/obj/machinery` (no intermediate type).
- Key vars (`laptop_vendor.dm:3-31`):
  - `name = "computer vendor"` (`:4`); `desc = "A vending machine with microfabricator capable of dispensing various NT-branded computers."` (`:5`)
  - `icon = 'icons/obj/vending.dmi'`, `icon_state = "robotics"`, `layer = 2.9`, `density = TRUE` (`:6-9`)
  - `fabricated_laptop` and `fabricated_tablet`, both `null` until fabricated (`:12-13`)
  - `state` (0 select device type, 1 select loadout, 2 payment, 3 thank-you screen; comment on `:16`), `devtype` (0 none, 1 laptop, 2 tablet; `:17`), `total_price = 0` (`:18`), `credits = 0` (`:19`)
  - Loadout, all defaulting to the basic option (`:22-28`): `dev_cpu = 1`, `dev_battery = 1`, `dev_disk = 1`, `dev_netcard = 0`, `dev_apc_recharger = 0`, `dev_printer = 0`, `dev_card = 0`
  - `ui_x = 500`, `ui_y = 400` (`:30-31`)
- `reset_order()` (`:34-50`): `state = 0`, `devtype = 0`, qdels any unbought device, and resets every loadout var to its default.
- Map placed x1 on BoxStation. Power: no `use_power` or idle/active value is set on the type, so the draw is 0 (`_machinery.dm:102`, `:106-107`), but the UI refuses to open when `BROKEN | NOPOWER | MAINT` (`laptop_vendor.dm:228-231`).

#### Interactions

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| empty hand, click (`ui_interact`, `:227-236`) | not `BROKEN`, `NOPOWER` or `MAINT` (`:228-231`, otherwise closes and returns FALSE) | none | none | opens TGUI `ComputerFabricator`, title `Personal Computer Vendor`, size 500 x 400 |
| TGUI `pick_device` (`pick` = 1 laptop or 2 tablet) | `state == 0` (`:178-179`) | none | none | `devtype` set, `state = 1`, price recalculated (`:180-182`) |
| TGUI `clean_order` | none | none | none | `reset_order()` (`:184-186`) |
| TGUI `purchase` | none | none | see `try_purchase` below | `try_purchase()` (`:187-189`) |
| TGUI `confirm_order` | `state == 1` and `devtype` set (`:190-191`) | none | none | `state = 2`, "Wait for ID swipe for payment processing" (`:193-195`) |
| TGUI `hw_cpu`, `hw_battery`, `hw_disk`, `hw_netcard`, `hw_tesla`, `hw_nanoprint`, `hw_card` | same as `confirm_order` (`:190-191`) | none | none | sets the matching `dev_*` var and recalculates (`:197-224`) |
| cash (`/obj/item/stack/spacecash`) | any state | none | `"<span class='info'><span class='name'>[user]</span> inserts [c.value] cr into [src].</span>"` (`:244`) | `credits += c.value` (`:243`), the cash is qdeled (`:245`) |
| holochip (`/obj/item/holochip`) | any state | none | `"<span class='info'>[user] inserts a [HC.credits] cr holocredit chip into [src].</span>"` (`:250`) | `credits += HC.credits` (`:249`), the chip is qdeled (`:251`) |
| ID card (`/obj/item/card/id`) | `state == 2` only; otherwise returns silently (`:254-255`) | none | `"Insufficient credits on card to purchase!"` (`:260`, said) or `"[target_credits] cr has been deposited from your account."` (`:263`, said) | `target_credits = total_price - credits` (`:258`); `account.adjust_money(-target_credits)` (`:259`); on success `credits += target_credits` (`:262`) |

`try_purchase()` (`:295-311`), only in state 2:
- `process_payment()` (`:268-273`): if `total_price > credits`, says `"Insufficient credits."` (`:270`) and returns FALSE (`:271`).
- On success: `fabricate_and_recalc_price(1)` builds the device inside the vendor (`:298-299`); a laptop goes to `loc` (`:301`), a tablet likewise (`:304`); `credits -= total_price` (`:306`); says `"Enjoy your new product!"` (`:307`); `state = 3` (`:308`); `addtimer(CALLBACK(src, .proc/reset_order), 100)` (`:309`, 100 ds, then the vendor resets).

#### Pricing and fabrication (`fabricate_and_recalc_price`, `:52-166`)

Prices are in credits (`cr`), raw.

| device | option | price added | fabricated part (file:line) |
|---|---|---|---|
| laptop (`devtype` 1) | base | 99 (`:60`) | `/obj/item/modular_computer/laptop/buildable` (`:57`), battery `/obj/item/computer_hardware/battery` (`:58`) |
| laptop | cpu 1 (default) | 0 | `processor_unit/small` (`:64`) |
| laptop | cpu 2 | +299 (`:68`) | `processor_unit` (`:67`) |
| laptop | battery 1 (basic) | 0 | `stock_parts/cell/computer` (`:72`) |
| laptop | battery 2 (upgraded, "1100C") | +199 (`:76`) | `stock_parts/cell/computer/advanced` (`:75`) |
| laptop | battery 3 (advanced, "1500C") | +499 (`:80`) | `stock_parts/cell/computer/super` (`:79`) |
| laptop | disk 1 (basic, 128GQ) | 0 | `computer_hardware/hard_drive` (`:84`) |
| laptop | disk 2 (256GQ) | +99 (`:88`) | `hard_drive/advanced` (`:87`) |
| laptop | disk 3 (512GQ) | +299 (`:92`) | `hard_drive/super` (`:91`) |
| laptop | netcard 1 (short range) | +99 (`:97`) | `computer_hardware/network_card` (`:96`) |
| laptop | netcard 2 (long range) | +299 (`:101`) | `network_card/advanced` (`:100`) |
| laptop | APC recharger ("tesla") | +399 (`:103`) | `computer_hardware/recharger/apc_recharger` (`:105`) |
| laptop | printer | +99 (`:107`) | `computer_hardware/printer/mini` (`:109`) |
| laptop | ID card slot | +199 (`:111`) | `computer_hardware/card_slot` (`:113`) |
| tablet (`devtype` 2) | base | 199 (`:123`) | `new(src)` of the declared `/obj/item/modular_computer/tablet` (`:119`), battery and `processor_unit/small` (`:120-121`) |
| tablet | battery 1 (basic, "300C") | 0 | `stock_parts/cell/computer/nano` (`:127`) |
| tablet | battery 2 ("500C") | +199 (`:131`) | `stock_parts/cell/computer/micro` (`:130`) |
| tablet | battery 3 ("750C") | +499 (`:135`) | `stock_parts/cell/computer` (`:134`) |
| tablet | disk 1 (32GQ) | 0 | `hard_drive/micro` (`:139`) |
| tablet | disk 2 (64GQ) | +99 (`:143`) | `hard_drive/small` (`:142`) |
| tablet | disk 3 (128GQ) | +299 (`:147`) | `hard_drive` (`:146`) |
| tablet | netcard 1 | +99 (`:152`) | `network_card` (`:151`) |
| tablet | netcard 2 | +299 (`:156`) | `network_card/advanced` (`:155`) |
| tablet | printer | +99 (`:158`) | `computer_hardware/printer` (`:160`) |
| tablet | ID card slot | +199 (`:162`) | `computer_hardware/card_slot` (`:164`) |

The tablet has no CPU choice and no APC recharger option (the tablet branch, `:122-165`, never reads `dev_cpu` or `dev_apc_recharger`).

#### Construction / deconstruction / drops / health

- Construction chain: none (no circuit, no frame, no recipe). The devices are built only on purchase.
- Deconstruction chain: none; destruction only (`deconstruct` is not overridden, `_machinery.dm:402-410`).
- Drops: (a) destroyed: no `component_parts`, so no frame (`_machinery.dm:402-410`). Items inside the vendor (an unbought `fabricated_laptop` or `fabricated_tablet`, created with `new(src)`, `laptop_vendor.dm:57`, `:119`) move to the floor through the machinery `Destroy` `dropContents()` (`_machinery.dm:171`, `:201-210`). The stored `credits` are lost (inferred). (b) disassembled: not possible.
- Health: `max_integrity 200` (`_machinery.dm:93`), `integrity_failure 0` (`objs.dm:19`); default armor (`_machinery.dm:136-137`).

#### Gotchas

- Price and parts are recalculated on every option click (`ui_act`, `:197-224`), but the device is only fabricated in `try_purchase` (`:298-299`); `fabricate_and_recalc_price(FALSE)` is free of side effects.
- A purchase is paid from the vendor's `credits` first; an ID card is only charged in state 2 (`:254-262`), and only the shortfall `total_price - credits` is taken (`:258`).
- The ID branch has no null check on `account` (`:257-259`); a card with no registered account would error (inferred from the code; not run).
- If `credits` exceed the price, `target_credits` is negative and `adjust_money(-target_credits)` adds to the card (`:258-259`, inferred from the arithmetic; not run).
- After `state = 3` the vendor resets 100 ds later (`:308-309`); until then it does not accept a new order.

---

### scanner control interface  `/obj/machinery/libraryscanner`   (`code/modules/library/lib_machines.dm:538`)

- What it is: the scanner that holds a book and remembers the last scanned book for the library archive. Parent `/obj/machinery` (no intermediate type).
- Key vars (`lib_machines.dm:538-544`): `name = "scanner control interface"` (`:539`), `icon = 'icons/obj/library.dmi'`, `icon_state = "bigscanner"` (`:540-541`), `desc = "It servers the purpose of scanning stuff."` (`:542`), `density = TRUE` (`:543`), `var/obj/item/book/cache` ("Last scanned book", `:544`).
- Power: none set on the type (`use_power` default IDLE, idle and active 0, `_machinery.dm:102`, `:106-107`).
- Map placed x1 on BoxStation.

#### Interactions

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| book (`/obj/item/book`) | none | none | none | `transferItemToLoc(O, src)` (`:546-549`) |
| any other item | none | none | normal attack chain (`code/_onclick/item_attack.dm:58-59`) | `return ..()` (`:550-551`) |
| empty hand, click (`attack_hand`, `:553-571`) | none; the popup opens even when `_try_interact` refuses (inferred: `attack_hand` only returns early when `.` is TRUE, `:554-556`) | none | `"<FONT color=#005500>Data stored in memory.</FONT><BR>"` (`:560`) or `"No data stored in memory.<BR>"` (`:562`); links `[Scan]` (`:563`), and when cached `[Clear Memory]` and `[Remove Book]` (`:565`) | opens browser popup `new(user, "scanner", name, 600, 400)` (`:568`) |
| `scan=1` | none | none | none | the first book in `contents` becomes `cache` (`:579-582`) |
| `clear=1` | none | none | none | `cache = null` (`:583-584`) |
| `eject=1` | none | none | none | every book in `contents` moves to `drop_location()` (`:585-587`); `cache` is not cleared |

#### Construction / deconstruction / drops / health

- Construction chain: none. Deconstruction chain: none (no tool branch; the book binder is a different machine, `lib_machines.dm:596`).
- Drops: destroyed: contents (books) move to the floor through `dropContents()` (`_machinery.dm:171`, `:201-210`); `cache` is lost. No frame (`_machinery.dm:402-410`).
- Health: `max_integrity 200` (`_machinery.dm:93`); default armor (`_machinery.dm:136-137`).

#### Gotchas

- `eject` leaves `cache` pointing at a book that is now outside the scanner, so the page still reads "Data stored in memory." (`:560`, `:585-587`).
- `scan` only caches the first book in `contents` (`:579-582`); `eject` removes all of them.
- The scanner does not read the book itself in this file. The data is used by the archive console, outside this shard.

---

### magnetic control console  `/obj/machinery/magnetic_controller`   (`code/game/machinery/magnet.dm:186`)

- What it is: a radio remote for electromagnetic generators (`/obj/machinery/magnetic_module`, `magnet.dm:7`). It can switch the generators, change their power or field, and broadcast a movement path (`w;e;e;w;s;n;n;s` by default) to them.
- Key vars (`magnet.dm`):
  - `name = "magnetic control console"` (`:187`); `icon = 'icons/obj/airlock_machines.dmi'`, `icon_state = "airlock_control_standby"` (`:188-189`); `density = FALSE` (`:190`)
  - `use_power = IDLE_POWER_USE` (`:191`), `idle_power_usage = 45` (`:192`); no active value
  - `frequency = FREQ_MAGNETS` = `1449` (`:193`; `code/__DEFINES/radio.dm:83`), `code = 0` (`:194`), `magnets = list()` (`:195`)
  - `title = "Magnetic Control Console"` (`:196`), `autolink = 0` (`:197`, "if set to 1, can't probe for other magnets!")
  - `pathpos = 1` (`:199`), `path = "w;e;e;w;s;n;n;s"` (`:200`), `speed = 1` (`:201`, "lowest = 1, highest = 10"), `rpath = list()` (`:202`)
  - `moving = 0` (`:204`), `looping = 0` (`:205`), `radio_connection` (`:207`)
- Map placed x1 on BoxStation.
- `Initialize` (`:210-219`): if `autolink`, copies every magnetic module with the same `freq` and `code` from `GLOB.machines` (`:212-216`); if `path`, `filter_path()` (`:217-218`); `radio_connection = SSradio.add_object(src, frequency, RADIO_MAGNETS)` (`:219`, `RADIO_MAGNETS` = `"magnets"`, `code/__DEFINES/radio.dm:104`).
- `Destroy` (`:221-225`): `SSradio.remove_object`, `magnets = null`, `rpath = null`.
- `process` (`:227-231`): if `magnets` is empty and `autolink` is set, rescans for modules.

#### Interactions

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| empty hand, click (`ui_interact`, `:233-256`) | `can_interact` (`_machinery.dm:250-280`) | none | none | opens a browser window `window=magnet;size=400x500` (`:256`), content lists the modules (if any), speed, path and moving state (`:251-253`) |
| `radio-op=togglepower` / `minuselec` / `pluselec` / `minusmag` / `plusmag` (`Topic`, `:264-289`) | none | none | none | posts a radio signal on `RADIO_MAGNETS` with `command` `toggle-power`, `sub-elec`, `add-elec`, `sub-mag`, `add-mag` and the `code` (`:267`, `:270-285`, `:287`) |
| `operation=plusspeed` (`:293-296`) | none | none | none | `speed++`, capped at 10 (`:296`) |
| `operation=minusspeed` (`:297-300`) | none | none | none | `speed--`, floor 1 (`:299-300`) |
| `operation=setpath` (`:301-308`) | none | none | prompt `"Please define a new path!"` (`:302`) | if non-empty: `moving = 0`, `pathpos = 1`, `filter_path()` (`:303-307`) |
| `operation=togglemoving` (`:309-313`) | none | none | none | `moving = !moving`; when set, `INVOKE_ASYNC(src, .proc/MagnetMove)` |
| `operation=setfreq`, `operation=probe` | no branch in `Topic` (the switch at `:291-316` has only the four above) | none | the links shown at `:238-240` | nothing happens as written |

`MagnetMove()` (`:317-357`): while `moving` and the path is non-empty (`:321`):
- stops on `BROKEN | NOPOWER` (`:323-324`);
- wraps `pathpos` to 1 past the end (`:331-332`);
- the character, uppercased, must be one of `N`, `S`, `E`, `W`, `C`, `R` (`:336`), else the signal is qdeled and the loop breaks (`:340-341`);
- `command` is set to the character (`:343`), `pathpos++` (`:346`), the signal is broadcast on `RADIO_MAGNETS` (`:349`);
- then waits `sleep(1)` at speed 10, else `sleep(12-speed)` (`:351-354`, ds). Speed 1 waits 11 ds; speed 9 waits 3 ds.
- Comments at `:337-339`: `N, S, E, W` directional, `C` centre, `R` random within the field.

`filter_path()` (`:359-378`): drops `;`, `&`, `*` and spaces, keeps up to 50 characters (`:363`, `:377`).

#### Construction / deconstruction / drops / health / power

- Construction chain: none on the type (no circuit, no frame, no recipe). Deconstruction chain: none (no tool branch).
- Drops: destroyed: contents move to the floor (`_machinery.dm:171`, `:201-210`); the module list and path are lost. No frame.
- Health: `max_integrity 200` (`_machinery.dm:93`); default armor (`_machinery.dm:136-137`).
- Power: `use_power = IDLE_POWER_USE` (`magnet.dm:191`), `idle_power_usage = 45` (`:192`). Unit not stated in the DM. `MagnetMove` draws nothing itself; the generators draw their own power (`magnetic_module` `use_power(electricity_level * 5)`, `magnet.dm:178`, the generator's own block, not on this shard).

#### Gotchas

- The `Frequency`, `Code` and `Probe Generators` links do nothing as written: `Topic` has no `setfreq` or `probe` branch (`:238-240`, `:291-316`). The frequency and code can only be set by the variables.
- `moving` is never cleared when `MagnetMove` stops on a bad character (`:336-341`) or on power loss (`:323-324`), so the page keeps showing "Enabled" while nothing moves until the toggle is clicked twice (read from the code; not run).
- `FREQ_MAGNETS` is `1449` (`radio.dm:83`), the same number as `FREQ_AIRLOCK_CONTROL` (`radio.dm:81`) used by the incinerator airlock consoles of part 1. The magnets use the `"magnets"` filter (`radio.dm:104`); the airlock consoles do not. Whether they interfere depends on the radio filter rules, which were not read.
- The default path `w;e;e;w;s;n;n;s` is parsed to 8 characters (`:200`, `:359-378`).

## Station gateway and gravity generator

### gateway (home)  `/obj/machinery/gateway/centerstation`   (`code/modules/awaymissions/gateway.dm:229`)

- What it is: the station's end of a bluespace gate. It is the global home gate (`GLOB.the_gateway`, `gateway.dm:2`) and can be linked to away gates; stepping into its open portal sends a mob or object to the other gate's turf.
- Parent `/obj/machinery/gateway` (`gateway.dm:143`). Key vars there:
  - `name = "gateway"` (`:144`); `desc = "A mysterious gateway built by unknown hands, it allows for faster than light travel to far-flung locations."` (`:145`)
  - `icon = 'icons/obj/machines/gateway.dmi'`, `icon_state = "off"` (`:146-147`)
  - `resistance_flags = INDESTRUCTIBLE | LAVA_PROOF | FIRE_PROOF | UNACIDABLE | ACID_PROOF` (`:148`)
  - 3 by 2 footprint: `pixel_x = -32`, `pixel_y = -32`, `bound_height = 64`, `bound_width = 96`, `bound_x = -32`, `bound_y = 0` (`:150-156`); `density = TRUE` (`:157`)
  - `use_power = IDLE_POWER_USE` (`:159`), `idle_power_usage = 100` (`:160`), `active_power_usage = 5000` (`:161`)
  - `calibrated = TRUE` (`:163`); `destination_type = /datum/gateway_destination/gateway` (`:165`); `destination_name = "Unknown Gateway"` (`:167`); `destination`, `target`, `portal` (`:169-173`)
- Centerstation overrides (`:229-231`): `destination_type = /datum/gateway_destination/gateway/home` (`:230`), `destination_name = "Home Gateway"` (`:231`).
- `Initialize` (`:175-178`, base): `generate_destination()` (`:180-184`: `destination = new destination_type`, name, `target_gateway = src`, added to `GLOB.gateway_destinations`, `:184`), `update_icon()`. Centerstation `Initialize` (`:233-236`): if `GLOB.the_gateway` is unset, it becomes this gate. `Destroy` (`:238-241`) clears `GLOB.the_gateway` if it is this gate.
- Map placed x1 on BoxStation.

#### Interactions

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| multitool (`multitool_act`, `:243-249`) | already calibrated (the default, `:163`) | none | `"<span class='alert'>The gate is already calibrated, there is no work for you to do here.</span>"` (`:245`) | nothing; returns TRUE (`:249`), which stops the attack chain |
| multitool, not calibrated | `calibrated` FALSE (no code in this tree sets it FALSE on this type, see gotchas) | none | `"<span class='boldnotice'>Recalibration successful!</span>: \black This gate's systems have been fine tuned. Travel to this gate will now be on target."` (`:247`, verbatim with the stray `\black`) | `calibrated = TRUE` (`:248`) |
| empty hand, click | no `ui_interact` or `attack_hand` override on this type; the centerstation's `interact` does nothing | none | none | nothing (the away variant overrides `interact`, `:256`, not this type) |
| step into the open portal (`/obj/effect/gateway_portal_bumper`, `:130-137`) | the bumper exists only while the gate is active (`generate_bumper`, `:209-211`); `Bumped` acts only when the mob is on the SOUTH side (`get_dir(src,AM) == SOUTH`, `:136`) | none | none | `gateway.Transfer(AM)` (`:137`) |
| `Transfer(AM)` (`:222-226`) | `target` set and `target.incoming_pass_check(AM)` (`:223`) | none | see the home destination below | `AM.forceMove(target.get_target_turf())` (`:225`), `target.post_transfer(AM)` (`:226`) |

Activation (`activate(D)`, `:213-220`): requires `powered()` and no current `target` (`:214`); sets `target = D`; `target.activate(destination)` (`:217`); `generate_bumper()` (`:218`); `use_power = ACTIVE_POWER_USE` (`:219`); `update_icon()` (`:220`, icon `"on"`, `:202`). Dialling is done from the gateway control console (`:269-318`), which this shard did not read.

Deactivate (`:186-192`): `target = null`, `dest.deactivate(src)`, `QDEL_NULL(portal)` (`:190`), `use_power = IDLE_POWER_USE` (`:191`), `update_icon()`.

`process` (`:194-199`): if `NOPOWER` and `use_power` is non-zero, and a target is set, it deactivates and returns.

Home destination `/datum/gateway_destination/gateway/home` (`:95-117`):
- `incoming_pass_check` (`:97-111`): refuses a living mob with an exile implant, and says `"Rejecting [AM]: Exile implant detected in contained lifeform."` (`:104`) or `"Rejecting [AM]: Exile implant detected in close proximity lifeform."` (`:109`) for contained or buckled mobs. For the mob itself, `check_exile_implant` says `"<span class='userdanger'>The station gate has detected your exile implant and is blocking your entry.</span>"` (`:115`) and returns TRUE (`:116`).
- Arrival turf for a gate-to-gate link: `get_step(target_gateway.portal, SOUTH)` (`:87-88`); `post_transfer` sets the mob to face SOUTH on the next tick (`:90-92`) and sets a move delay of `world.time + 5` for a mob with a client (`:37-40`, base).

Availability of a destination (`:75-85`, `is_availible` and `get_availible_reason`), verbatim reasons: `"Exit gateway malfunction. Manual recalibration required."` (`:81`) when not calibrated; `"Exit gateway in use."` (`:83`) when a target is set; `"Exit gateway unpowered."` (`:85`) when not powered; default `"Unreachable"` (`:23`); `"Connection desynchronized. Recalibration in progress."` (`:25`) during `wait`.

#### Construction / deconstruction / drops / health / power

- Construction chain: none (placed by the map; no circuit, no frame, no recipe).
- Deconstruction chain: none. The gate is `INDESTRUCTIBLE` (`:148`), so `take_damage` returns at once (`code/game/objects/obj_defense.dm:9-10`), and the destruction path is never reached.
- Drops: none.
- Health: `INDESTRUCTIBLE`. An item hit still shows the hit message when the item has force (`code/_onclick/item_attack.dm:122-127`), but no damage is applied (inferred from `take_damage`).
- Power: `use_power = IDLE_POWER_USE` (`:159`), `idle_power_usage = 100` (`:160`), `active_power_usage = 5000` (`:161`); the draw switches to active while a link is open (`:219`) and back to idle on deactivate (`:191`). Unit not stated in the DM (the brief says watts). No `power_channel` is set, so the default equipment channel applies (`_machinery.dm:108`).

#### Gotchas

- `process` drops an open link when the gate loses power (`:195-197`). The away variant has `use_power = NO_POWER_USE` (`:254`), so its `process` never drops a link.
- `calibrated` is only ever set TRUE in this file (`:163`, `:248`), so the malfunction reason at `:81` cannot happen unless something else sets the variable (inferred from a search of `code/`; the teleporter's own `calibrated` variables are a different machine).
- The portal bumper exists only while the gate is active and is deleted on deactivate (`:190`, `:209-211`).
- Exile-implanted people are refused at the home gate only (`:97-117`); away gates have no such check in the code read.

---

### gravitational generator (station main)  `/obj/machinery/gravity_generator/main/station`   (`code/modules/power/gravitygenerator.dm:95`)

- What it is: the station's gravity generator. It is a 3 by 3 machine: one main part plus eight `/obj/machinery/gravity_generator/part` pieces (`:141-159`). Once charged, it gives gravity on every station z-level (`:371-387`). It can be knocked out by explosions and repaired with four tools. It cannot be destroyed or deconstructed.
- Type line: `/obj/machinery/gravity_generator/main/station` has no bare definition line; the type is introduced by its `Initialize` proc at `gravitygenerator.dm:95` (the line `tgwhere` reports). The `admin` variant at `:104` is spawned by admins and is not on this shard.
- Parent chain: abstract `/obj/machinery/gravity_generator` (`:21`) -> `/obj/machinery/gravity_generator/main` (`:111`) -> `/main/station`.
- Key vars:
  - Abstract (`:21-29`): `name = "gravitational generator"` (`:22`), `desc = "A device which produces a graviton field when set up."` (`:23`), `icon = 'icons/obj/machines/gravity_generator.dmi'` (`:24`), `density = TRUE` (`:25`), `move_resist = INFINITY` (`:26`), `use_power = NO_POWER_USE` (`:27`), `resistance_flags = INDESTRUCTIBLE | LAVA_PROOF | FIRE_PROOF | UNACIDABLE | ACID_PROOF` (`:28`), `sprite_number = 0` (`:29`)
  - Main (`:111-129`): `icon_state = "on_8"` (`:112`), `idle_power_usage = 0` (`:113`), `active_power_usage = 3000` (`:114`), `power_channel = AREA_USAGE_ENVIRON` (`:115`), `sprite_number = 8` (`:116`), `use_power = IDLE_POWER_USE` (`:117`), `interaction_flags_machine = INTERACT_MACHINE_ALLOW_SILICON | INTERACT_MACHINE_OFFLINE` (`:118`), `ui_x = 400`, `ui_y = 165` (`:119-120`), `on = TRUE` (`:121`), `breaker = TRUE` (`:122`), `parts` (`:123`), `middle` (`:124`), `charging_state = POWER_IDLE` (`:125`), `charge_count = 100` (`:126`), `current_overlay` (`:127`), `broken_state = 0` (`:128`), `setting = 1` (`:129`)
  - Defines: `POWER_IDLE 0`, `POWER_UP 1`, `POWER_DOWN 2` (`:8-10`); `GRAV_NEEDS_SCREWDRIVER 0`, `GRAV_NEEDS_WELDING 1`, `GRAV_NEEDS_PLASTEEL 2`, `GRAV_NEEDS_WRENCH 3` (`:12-15`); `GLOBAL_LIST_EMPTY(gravity_generators)` (`:6`).
- `Initialize` (`:95-99`): `. = ..()`, `setup_parts()` (`:97`), `middle.add_overlay("activated")` (`:98`), `update_list()` (`:99`).
- `setup_parts` (`:141-159`): walks the 3 by 3 block of turfs from `(x-1, y+2)` to `(x+1, y)` (`:143-144`), skips the own turf (`:148`), and creates a `/obj/machinery/gravity_generator/part` on each other turf (`:150`). The part with `count == 5` is the middle (`:151-152`). The top three (`count <= 3`) get `density = FALSE` and `layer = WALL_OBJ_LAYER` (`:153-155`). Each part gets `sprite_number = count` and `main_part = src` (`:156-157`).
- Map placed x1 on BoxStation (the station generator).

#### Interactions (main part; the 8 parts forward to it)

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| empty hand, click (`ui_interact`, `:225-230`) | `can_interact` passes even when BROKEN or NOPOWER, because of `INTERACT_MACHINE_OFFLINE` (`_machinery.dm:251`; `gravitygenerator.dm:118`) | none | none | opens TGUI `GravityGenerator`, 400 by 165 |
| TGUI `gentoggle` (`ui_act`, `:243-252`) | none | none | none (investigate log only, `:250`) | `breaker = !breaker` (`:249`); `set_power()` (`:251`) |
| part click or hit (`:77-84`) | forwarded to main | - | - | `main_part.attackby(I, user)` (`:78`), `main_part.attack_hand(user)` (`:84`) |
| screwdriver, `broken_state` 0 (`attackby`, `:190-197`) | the generator is BROKEN | none | `"<span class='notice'>You secure the screws of the framework.</span>"` (`:193`) | `broken_state++` (`:195`); sound (`:194`) |
| welder, `broken_state` 1 (`:198-204`) | `I.tool_behaviour == TOOL_WELDER` | 0 (`use_tool(src, user, 0, volume=50, amount=1)`, `:200`) | `"<span class='notice'>You mend the damaged framework.</span>"` (`:201`) | `broken_state++` (`:202`) |
| plasteel, `broken_state` 2 (`:205-216`) | 10 or more sheets of `/obj/item/stack/sheet/plasteel` (`:208`) | none | `"<span class='notice'>You add the plating to the framework.</span>"` (`:210`); when short: `"<span class='warning'>You need 10 sheets of plasteel!</span>"` (`:215`) | 10 sheets used (`:209`), sound `'sound/machines/click.ogg'` 75 (`:211`), `broken_state++` (`:212`) |
| wrench, `broken_state` 3 (`:217-222`) | `I.tool_behaviour == TOOL_WRENCH` | none | `"<span class='notice'>You secure the plating to the framework.</span>"` (`:219`) | sound (`:220`), `set_fix()` (`:221`) |
| any other item | falls through (`return ..()`, `:223`) | - | normal attack chain (`code/_onclick/item_attack.dm:58-59`) | - |

#### Power and charging (`set_power` `:267-276`, `set_state` `:279-301`, `process` `:305-345`)

- `set_power`: charging goes to POWER_UP if the breaker is on and the machine has power and is not BROKEN, otherwise POWER_DOWN (`:269-275`).
- `process` (`:305-345`): returns at once if BROKEN (`:306-307`). While charging, `charge_count` moves by 2 per call (`:314-317`), up to 100 (`:309-310`, then `set_state(1)`) or down to 0 (`:311-312`, then `set_state(0)`).
- Every fourth step of the count, with a 75% chance, it plays `'sound/effects/empulse.ogg'` at 100 (`:319-320`). With a 25% chance per call it pulses radiation (`:323-324`; `pulse_radiation` is `radiation_pulse(src, 200)`, `:347-348`).
- Overlay on the middle part by charge: 0 to 20 none, 21 to 40 `"startup"`, 41 to 60 `"idle"`, 61 to 80 `"activating"`, 81 to 100 `"activated"` (`:327-343`).
- Frequency: `SSmachines` calls `process()` roughly every 2 seconds (`_machinery.dm:120`), so a full charge is about 50 calls, roughly 100 s (inferred).
- `set_state(new_state)` (`:279-301`): `charging_state = POWER_IDLE` (`:280`), `on = new_state` (`:281`), `use_power = ACTIVE_POWER_USE` when on, IDLE when off (`:282`). When the round is running it sets an alert on a change of gravity: if turning on and `gravity_in_level()` was FALSE, it says `"The gravity generator was brought online [ADMIN_VERBOSEJMP(src)]"` (`:290`) to admins; if turning off and gravity was TRUE, `"The gravity generator was brought offline with no backup generator. [ADMIN_VERBOSEJMP(src)]"` (`:295`). Then `update_list()` (`:298`), and `shake_everyone()` (`:300-301`).
- `shake_everyone` (`:351-361`): calls `update_gravity` for mobs on the level, `shake_camera(M, 15, 1)` (`:360`), and `playsound_local` of `'sound/effects/alert.ogg'` at 100 (`:361`).
- `update_list` (`:371-387`): when on, adds the generator to `GLOB.gravity_generators` for every `ZTRAIT_STATION` level (`:376-380`, `:384-385`); when off, removes it (`:386-387`).
- `gravity_in_level` (`:363-369`): the length of the list for the turf's z-level, which is TRUE when any generator is on.

#### Breakage and repair (`set_broken` `:165-175`, `set_fix` `:177-185`)

- `set_broken`: every part is set broken (`:167-169`), the middle loses its overlays (`:170`), `charge_count = 0` (`:171`), `breaker = FALSE` (`:172`), `set_power()` (`:173`), `set_state(0)` (`:174`). The base sets BROKEN through `obj_break` (`:58-59`; `code/game/machinery/_machinery.dm:422-429`).
- `set_fix`: parts are fixed (`:179-181`), `broken_state = FALSE` (`:182`), `update_icon()`, `set_power()` (`:184`). The base clears BROKEN (`:61-63`).
- What breaks it: an explosion of severity 1 (`:34-36`); a blob hit, 20% chance (`:38-40`). Tesla explosive zap deletes it (`:42-45`).

#### Construction / deconstruction / drops / health

- Construction chain: none for players. The station spawn creates the parts (`setup_parts`, `:141-159`); the `admin` variant (`:104-105`) is spawned by admins.
- Deconstruction chain: none. The only "rebuild" is the repair sequence above.
- Drops: none. `main` `Destroy` (`:131-139`) logs, sets `on = FALSE`, updates `GLOB.gravity_generators` (`update_list`), and qdels the parts. A parts `Destroy` (`:64-68`) qdels the main part. Nothing is spawned.
- Health: `INDESTRUCTIBLE` (`:28`), so `take_damage` returns (`code/game/objects/obj_defense.dm:9-10`). `max_integrity` and armor have no effect. Moving it deletes it: `Move()` calls `qdel(src)` (`:54-56`), with `move_resist = INFINITY` (`:26`).

#### Power

- Idle draw 0 (`:113`), active draw 3000 (`:114`) once on (`:282`). Channel: environment (`:115`). Admin variant: `NO_POWER_USE` (`:105`). Unit not stated in the DM (the brief says watts).

#### Gotchas

- `Initialize` sets `on = TRUE` (`:121`) and `charge_count = 100` (`:126`) but does not call `set_state`, so `use_power` stays IDLE (`:117`) and the 3000 active draw does not start until a state change (inferred from the code).
- A repaired generator stays off: `set_broken` set `breaker = FALSE` (`:172`) and `set_fix` does not turn it back on, so someone must switch the breaker on in the UI (`:248-251`).
- Each on/off change shakes every station mob and plays the alert (`:300-301`, `:351-361`).
- The generator is INDESTRUCTIBLE, so the only ways to stop it are the breaker, power loss (`:269`), a severity-1 explosion or a blob hit (`:34-40`), or an explosive tesla zap (`:42-45`).
- `connected_parts()` (`:162-163`) and `change_setting()` (`:389-392`) have no callers in the tree (inferred from a search of `code/`).

---

## Minimum viable port (whole shard, at most 10)

- Incinerator airlock console: the 5-state cycle (`airlock_controller.dm:60-193`), the 0.95 atm, 0.05 atm and 0.01 atm (sanitise) thresholds (`:85`, `:137-139`), tags wired by name (`code/__DEFINES/atmospherics.dm:321-347`), and popup strings verbatim (`airlock_controller.dm:286-300`).
- Igniter: hand click toggles `on` and costs `use_power(50)`; on and powered it heats its tile with `hotspot_expose(1000,500,1)` (`igniter.dm:29-44`), idle 2 and active 4 (`:8-9`), and a remote toggle by matching id (`doorcontrol.dm:113-117`).
- Tachyon-doppler array: 150-tile, facing-only explosion sensing with a 10 ds cooldown (`doppler_array.dm:14`, `:143-153`); records and paper printouts with a 40 ds printer (`:1`, `:87-88`); research points by the formula, capped at 50000 (`:214-217`, `code/__DEFINES/research.dm:78`).
- Kitchen: food cart (wrench anchors at 0 ds, glass and snack storage, drinks from a 200-unit reservoir with `portion = 10`, a 100-unit mixer, `food_cart.dm:1-24`, `:62-154`) and ice cream vat (7 stock types of 5, recipes at 3 times per ingredient, scoop and cone dispense, `icecream_vat.dm:33-75`, `:107-210`).
- Gibber and the machine frame: anchored; grab a carbon for `gibtime` ds (35 with basic parts); meat slabs equal to the matter-bin rating; 500 active power and 1000 per gibbing (`gibber.dm:14`, `:23-31`, `:97`, `:144`, `:203`); the frame build from 5 metal (`sheet_types.dm:52`), cable coil x5 (`constructable_frame.dm:83-91`), anchor, board, parts, screwdriver (`:74-201`).
- Labor camp teleporter and reclaimer: pod plus console; teleport after 5 ds, paralysis 40 ds, strip to the reclaimer, jumpsuit and sneakers, record set to `Incarcerated`, breakout 600 ds (`gulag_teleporter.dm:22`, `:130-159`; console `computer/prisoner/gulag_teleporter.dm:114-156`).
- Computer vendor: the order state machine (pick, loadout, confirm, pay, fabricate, reset after 100 ds) and the price table (`laptop_vendor.dm:52-166`, `:295-311`); magnetic controller (path string, speed 1 to 10 with `sleep(12-speed)` ds, radio broadcast on 1449 with filter `"magnets"`, `magnet.dm:200-201`, `:351-354`, `radio.dm:83`, `:104`); library scanner (one cached book, Scan, Clear, Remove, `lib_machines.dm:553-587`).
- Gateway (home): the portal bumper that transfers mobs to the linked gate's turf (`gateway.dm:130-137`, `:222-226`), the home destination's exile check (`:97-117`), calibration by multitool (`:243-249`), and the 5000 active power (`:161`, `:219`).
- Gravity generator: the 3 by 3 layout with 8 parts (`gravitygenerator.dm:141-159`), the breaker and charge at ±2 per process call from 0 to 100 (`:267-345`), gravity on all station levels (`:371-387`), the four-step repair (`:189-223`), and the alert and shake on change (`:279-301`).

## NOT FOUND / open questions

- NOT FOUND: none. `tgwhere` located all 14 paths.
- `tgwhere` tool note: for `/obj/machinery/gateway` it prints `code/modules/antagonists/swarmer/swarmer.dm:322` and for `/obj/machinery/gravity_generator` it prints `:274`. Both are `swarmer_act` / proc lines in other files, not the type definitions. The base types are at `code/modules/awaymissions/gateway.dm:143` and `code/modules/power/gravitygenerator.dm:21`, which is what this file documents.
- The same tool prints the gravity station type at its `Initialize` proc line (`gravitygenerator.dm:95`), because the type has no bare definition line. That is what is documented.
- Igniter hand toggle with no power (`igniter.dm:29-37`): the code path flips `on` even when `can_interact` fails. Not run; confirm in game.
- Wall sparker `/obj/machinery/sparker` (`igniter.dm:93-120`): as written it never sparks (`powered()` is FALSE while enabled; `ignite()` returns while disabled). Not on this shard's list; confirm in game.
- Frame-built gibber and labor camp teleporter: the board stays in `circuit`, not `component_parts`, so destruction does not drop it (`constructable_frame.dm:186-198`, `_machinery.dm:402-410`). Confirm in game whether the board is recoverable.
- Computer vendor card payment with no registered account (`laptop_vendor.dm:257-259`), and with credits above the price (`:258-259`): no guard in the code. Not run.
- Magnetic controller links `setfreq` and `probe` have no handler (`magnet.dm:238-240`); possibly dead UI.
- Library scanner `cache` is not cleared on eject (`lib_machines.dm:585-587`); possibly intended.
- Gravity generator: `connected_parts()` and `change_setting()` have no callers (`gravitygenerator.dm:162-163`, `:389-392`); dead code as far as this tree shows.
- Gateway: the centerstation's `calibrated` can only become TRUE in this tree (`gateway.dm:163`, `:248`); the malfunction branch is unreachable here.
- Not checked: the newer snapshot in `Downloads` (no DIFF lines written); the gateway control console (`gateway.dm:269-318`) and the labor camp console's ID handling (`id_insert`, in the computer base) were not read.

## Coverage

- List entries: 14 (`docs/tg/_todo3/gap-things-04.txt`, lines 2-15).
- Documented with real data: 14.
- NOT FOUND: 0.
- Paths not located by `tgwhere`: none (all 14 printed a file:line).

