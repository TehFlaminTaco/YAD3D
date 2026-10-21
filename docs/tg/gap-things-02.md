# gap-things-02, part 1: incinerator sensor, vent buttons, ignition button

Five list entries from the BoxStation incinerator (combustion chamber) family. Shared parents are documented once below, then each path gets its own entry. Paths are relative to `_src/tg2020`. Numbers are raw source values (deciseconds, no conversion).

File key (short names used in the citations below): `_machinery.dm` = code/game/machinery/_machinery.dm; `airlock_control.dm` = code/game/machinery/airlock_control.dm; `buttons.dm` = code/game/machinery/buttons.dm; `igniter.dm` = code/game/machinery/igniter.dm; `poddoor.dm` = code/game/machinery/doors/poddoor.dm; `airlock_controller.dm` = code/game/machinery/embedded_controller/airlock_controller.dm; `objs.dm` = code/game/objects/objs.dm; `obj_defense.dm` = code/game/objects/obj_defense.dm; `apc_frame.dm` = code/game/objects/items/apc_frame.dm; `doorcontrol.dm` = code/modules/assembly/doorcontrol.dm; `assembly.dm` = code/modules/assembly/assembly.dm; `access.dm` = code/modules/jobs/access.dm; `power.dm` = code/modules/power/power.dm; `atmospherics.dm` = code/__DEFINES/atmospherics.dm; `radio.dm` = code/__DEFINES/radio.dm; `machines.dm` = code/__DEFINES/machines.dm.

## Shared parent: /obj/machinery  (code/game/machinery/_machinery.dm:86)

- Key vars (inherited unless a child says otherwise): `max_integrity = 200` (_machinery.dm:93; the `/obj` default is 500, code/game/objects/objs.dm:18); `integrity_failure = 0` (objs.dm:19); `damage_deflection = 0` (objs.dm:21); `anchored = TRUE` (_machinery.dm:98); `use_power = IDLE_POWER_USE` (_machinery.dm:102); `idle_power_usage = 0` (_machinery.dm:106); `active_power_usage = 0` (_machinery.dm:107); `power_channel = AREA_USAGE_EQUIP` (_machinery.dm:108); `panel_open = FALSE` (_machinery.dm:113); `component_parts = null` (_machinery.dm:112).
- Default armor, applied only when a type sets none (_machinery.dm:136-137): melee 25, bullet 10, laser 10, energy 0, bomb 0, bio 0, rad 0, fire 50, acid 70.
- Initialize adds the machine to `GLOB.machines` (_machinery.dm:139) and starts processing on `SSmachines` when `START_PROCESSING_ON_INIT` is set (_machinery.dm:145-146, 154-156). The comment at _machinery.dm:120 says this fires roughly every 2 seconds.
- Destroy: `dropContents()` moves every atom in `contents` to the turf (_machinery.dm:171, 201-210). `component_parts` are qdel'd (_machinery.dm:172-175).
- `deconstruct(disassembled)` (_machinery.dm:402-410): a frame is spawned only when `component_parts` is non-empty (_machinery.dm:405-406); then `qdel(src)`. None of the five entries has `component_parts`, so no frame is ever spawned for them.
- Damage (code/game/objects/obj_defense.dm:15-21): damage breaks the object only when `integrity_failure` is non-zero (obj_defense.dm:17). With `integrity_failure = 0` the `BROKEN` flag (`obj_break`, _machinery.dm:422-429) is never set, and integrity 0 goes straight to `obj_destruction` (obj_defense.dm:252-258), which calls `deconstruct(FALSE)`.
- Screwdriver helper `default_deconstruction_screwdriver` (_machinery.dm:447-459): sound at volume 50 (_machinery.dm:449); "You open the maintenance hatch of [src]." (_machinery.dm:453); "You close the maintenance hatch of [src]." (_machinery.dm:457).
- Examine damage text (_machinery.dm:560-567): 50-99 "It looks slightly damaged."; 25-50 "It appears heavily damaged."; 0-25 "<span class='warning'>It's falling apart!</span>".
- `use_power(amount, chan)` passes the number to the area (code/modules/power/power.dm:96-102). The source gives no unit for these numbers.

## Shared parent: /obj/machinery/airlock_sensor  (code/game/machinery/airlock_control.dm:87)

Key vars (parent):
- `icon = 'icons/obj/airlock_machines.dmi'` (airlock_control.dm:88); `icon_state = "airlock_sensor_off"` (:89); `name = "airlock sensor"` (:90); `resistance_flags = FIRE_PROOF` (:91).
- `power_channel = AREA_USAGE_ENVIRON` (:93), which is 3 (code/__DEFINES/machines.dm:5).
- `var/id_tag`, `var/master_tag` (:95-96), unset on the parent; `frequency = FREQ_AIRLOCK_CONTROL` (:97), which is 1449 (code/__DEFINES/radio.dm:81).
- `on = TRUE` (:101); `alert = FALSE` (:102).
- `desc` is not set, so it inherits "Some kind of machine." (code/game/machinery/_machinery.dm:89).
- `AIRLOCK_CONTROL_RANGE` is 5 (airlock_control.dm:1). The radio filter is `RADIO_AIRLOCK` = "airlock" (code/__DEFINES/radio.dm:103).

Interactions (parent, inherited by the sensor child):

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| attack_hand, no item | after parent `attack_hand` check | none | none | posts `{"tag": master_tag, "command": "cycle"}` via `radio_connection.post_signal`, range `AIRLOCK_CONTROL_RANGE`, filter `RADIO_AIRLOCK` (airlock_control.dm:125-134); `flick("airlock_sensor_cycle", src)` (:135) |
| any item | none defined | - | none | airlock_control.dm defines no `attackby` for the sensor (lines 87-165 read in full) |
| machine tick (`process`) | `on` TRUE | none | none | `pressure = round(air_sample.return_pressure(), 0.1)` (:139-140); `alert = (pressure < ONE_ATMOSPHERE*0.8)` (:141; `ONE_ATMOSPHERE` = 101.325, code/__DEFINES/atmospherics.dm:18, so the threshold is 81.06); posts `{"tag", "timestamp" = world.time, "pressure" = num2text(pressure)}` (:143-149); `update_icon()` every tick, even when `on` is FALSE (:151) |
| `set_frequency` (Initialize) | always | none | none | `SSradio.add_object(src, frequency, RADIO_AIRLOCK)` (:153-160) |
| Destroy | always | none | none | `SSradio.remove_object(src, frequency)` (:162-164), then parent Destroy |

- Icon states (`update_icon_state`, airlock_control.dm:116-123): on and alert gives "airlock_sensor_alert" (:119); on and not alert gives "airlock_sensor_standby" (:121); off gives "airlock_sensor_off" (:123).
- The sensor has no `receive_signal`. The only `receive_signal` in airlock_control.dm is on `/obj/machinery/door/airlock` (airlock_control.dm:10).

Construction chain: none. No frame, wallframe or circuit board in the tree lists `/obj/machinery/airlock_sensor`. A grep of `code/` for `airlock_sensor` (excluding the `INCINERATOR_*` define names) matches only code/game/machinery/airlock_control.dm.

Deconstruction chain: none. No tool handling is defined for the sensor.

Drops: none. `deconstruct` and Destroy leave nothing behind (empty `contents`, no `component_parts`; _machinery.dm:171, 402-410).

Health / armor: `max_integrity = 200` (_machinery.dm:93). No `armor` is set on the sensor, so the default list at _machinery.dm:137 applies. `integrity_failure = 0`, `damage_deflection = 0` (objs.dm:19, 21).

Power: `use_power = IDLE_POWER_USE` (_machinery.dm:102) with `idle_power_usage = 0` and `active_power_usage = 0` (_machinery.dm:106-107), on `AREA_USAGE_ENVIRON` (airlock_control.dm:93). The sensor draws 0 by its own definition.

Gotchas (parent):
- The cycle command has no access check and no cooldown (airlock_control.dm:125-135).
- While `on` is TRUE the pressure signal is posted on every machine tick (airlock_control.dm:137-149).

## Shared parent: /obj/machinery/button  (code/game/machinery/buttons.dm:1), with /obj/machinery/button/door (buttons.dm:183) and /obj/machinery/button/ignition (buttons.dm:240)

Key vars:
- `name = "button"` (buttons.dm:2); `desc = "A remote control switch."` (:3); `icon = 'icons/obj/stationobjs.dmi'` (:4); `icon_state = "doorctrl"` (:5); `skin = "doorctrl"` (:6); `power_channel = AREA_USAGE_ENVIRON` (:7).
- `var/obj/item/assembly/device` (:8); `var/obj/item/electronics/airlock/board` (:9); `device_type = null` (:10); `id = null` (:11); `initialized_button = 0` (:12).
- `armor = list("melee" = 50, "bullet" = 50, "laser" = 50, "energy" = 50, "bomb" = 10, "bio" = 100, "rad" = 100, "fire" = 90, "acid" = 70)` (:13).
- `use_power = IDLE_POWER_USE` (:14); `idle_power_usage = 2` (:15); `resistance_flags = LAVA_PROOF | FIRE_PROOF` (:16). `max_integrity` is not set here, so it is 200 (_machinery.dm:93).
- `/obj/machinery/button/door`: `name = "door button"` (buttons.dm:184); `desc = "A door remote control switch."` (:185); `normaldoorcontrol = FALSE` (:186); `specialfunctions = OPEN` (:187); `sync_doors = TRUE` (:188).
- `/obj/machinery/button/ignition`: `name = "ignition switch"` (buttons.dm:241); `desc = "A remote control switch for a mounted igniter."` (:242); `icon_state = "launcher"` (:243); `skin = "launcher"` (:244); `device_type = /obj/item/assembly/control/igniter` (:245).

Initialize (buttons.dm:21-44):
- If `built`: `setDir`, pixel offsets, `panel_open = TRUE`, `update_icon()` (buttons.dm:23-28).
- If not `built` and there is no device and `device_type` is set: `device = new device_type(src)` (buttons.dm:31-32).
- `src.check_access(null)` (buttons.dm:34).
- If `req_access` or `req_one_access` is non-empty: `board = new(src)` and the board gets the access list (`board.one_access = 1` when only `req_one_access` is used) (buttons.dm:36-42).
- `setup_device()` (buttons.dm:44).
- Base `setup_device` (buttons.dm:124-128): if `id` is set and the device is an `/obj/item/assembly/control`, `A.id = id`; then `initialized_button = 1`.
- Door `setup_device` (buttons.dm:193-203): if there is no device, creates `/obj/item/assembly/control/airlock` when `normaldoorcontrol`, otherwise `/obj/item/assembly/control` with `C.sync_doors = sync_doors` (buttons.dm:194-202); then calls the base.

Interactions (shared by every button entry below):

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| Screwdriver (TOOL_SCREWDRIVER) | panel open, or `allowed(user)` | none (instant) | "You open the maintenance hatch of [src]." / "You close the maintenance hatch of [src]." (_machinery.dm:453, 457) | toggles `panel_open`; icon becomes "button-open" or skin (buttons.dm:64-67; _machinery.dm:447-459) |
| Screwdriver | panel closed and not `allowed(user)` | none | "<span class='alert'>Maintenance Access Denied.</span>"; `flick("[skin]-denied", src)` (buttons.dm:68-70) | nothing |
| `/obj/item/assembly` (any) | panel open, no device | none | "You add [W] to the button." (buttons.dm:79); "<span class='warning'>\The [W] is stuck to you!</span>" if the transfer fails (:76) | `W` becomes `device` (buttons.dm:74-79) |
| `/obj/item/electronics/airlock` | panel open, no board | none | "You add [W] to the button." (buttons.dm:90); stuck message as above (:83) | `board = W`; `req_one_access` (if `one_access`) or `req_access` is copied from the board (buttons.dm:81-89) |
| Wrench (TOOL_WRENCH) | panel open, no device and no board | `use_tool` 40 (buttons.dm:95); `play_tool_sound` (:94) | "You start unsecuring the button frame..." (:93), then "You unsecure the button frame." (:96) | `new /obj/item/wallframe/button(get_turf(src))` (:97); `playsound(loc, 'sound/items/deconstruct.ogg', 50, TRUE)` (:98); `qdel(src)` (:99) |
| Any other item, intent not INTENT_HARM, not NOBLUDGEON | panel closed | none | none | calls `attack_hand(user)` (buttons.dm:104-105) |
| Any item, INTENT_HARM or NOBLUDGEON | panel closed | none | none | parent `attackby` (buttons.dm:106-107) |
| `attack_hand` | panel open and device or board present | none | "You remove electronics from the button frame." (:153) | device is `forceMove`d to the drop location (:144-146); board is moved out and `req_access`/`req_one_access` are cleared (:147-151) in the same press |
| `attack_hand` | panel open, nothing inside | none | "You change the button frame's front panel." (:160) | skin toggles `doorctrl` <-> `launcher` (buttons.dm:155-160) |
| `attack_hand` | `machine_stat & (NOPOWER|BROKEN)` | none | none | returns, nothing happens (buttons.dm:163-164) |
| `attack_hand` | `device.next_activate > world.time` | none | none | returns (buttons.dm:166-167); never true for control devices, see Gotchas |
| `attack_hand` | `!allowed(user)` | none | "<span class='alert'>Access Denied.</span>"; `flick("[skin]-denied", src)` (buttons.dm:169-171) | nothing |
| `attack_hand` | allowed, powered, not broken | none | none | `use_power(5)` (buttons.dm:174); `icon_state = "[skin]1"` (:175); `device.pulsed()` (:177-178); `SEND_GLOBAL_SIGNAL(COMSIG_GLOB_BUTTON_PRESSED, src)` (:179); `update_icon` after 15 ds (:181) |
| `emag_act` | not already `EMAGGED` | none | none (`playsound(src, "sparks", 100, TRUE)`, buttons.dm:114) | `req_access` and `req_one_access` are emptied; `EMAGGED` set (buttons.dm:109-115) |
| `attack_ai` / `attack_robot` | panel closed | none | none | `attack_hand(user)` (buttons.dm:117-122); panel open does nothing |

- Access rule (code/modules/jobs/access.dm:3-30, 67-90): `allowed(user)` is TRUE when there is no `req_access` and no `req_one_access`. Otherwise the held item or the worn ID must carry every entry of `req_access`, or any one entry of `req_one_access`.

Construction chain (the button family, from the frame):
1. `/obj/item/wallframe/button` (buttons.dm:285-290): name "button frame" (:286), desc "Used for building buttons." (:287), `result_path = /obj/machinery/button` (:289), `custom_materials = list(/datum/material/iron = MINERAL_MATERIAL_AMOUNT)` (:290).
2. Place it: no tool and no delay. Refusals: "You cannot place [src] on this spot!" (code/game/objects/items/apc_frame.dm:22); "You cannot place [src] in this area!" (apc_frame.dm:25); "There's already an item on this wall!" (apc_frame.dm:28).
3. Attach (apc_frame.dm:33-56): `playsound(src.loc, 'sound/machines/click.ogg', 75, TRUE)` (:35); "[user.name] attaches [src] to the wall." / "You attach [src] to the wall." / "You hear clicking." (:36-38); `new result_path(get_turf(user), ndir, TRUE)` (:43) gives a built button with `panel_open = TRUE` (buttons.dm:23-28); the frame is qdel'd (apc_frame.dm:56).
4. A built button has no device (base `device_type` is null) and no board. Add an assembly and an airlock electronics board with the panel open (table above), then close the panel with the screwdriver.

Deconstruction chain (the incinerator buttons are map-placed, so this is the only way to get a frame back):
1. Screwdriver, if `allowed(user)`: opens the panel (buttons.dm:64-67).
2. `attack_hand` on the open panel: device and board come out in one press (buttons.dm:142-153).
3. Wrench, 40 ds: "You start unsecuring the button frame..." then "You unsecure the button frame." The frame drops (buttons.dm:92-99).

Drops:
- (a) Destroyed (integrity 0): `obj_destruction` calls `deconstruct(FALSE)` (obj_defense.dm:252-258). Button has no `deconstruct` override, so it is the machinery path (_machinery.dm:402-410): no frame, `qdel`, then Destroy's `dropContents` moves the device and the board onto the turf (_machinery.dm:171, 201-210). **No `/obj/item/wallframe/button` is dropped.**
- (b) Deconstructed properly: device and board are removed by hand first (buttons.dm:144-151), then the wrench drops `/obj/item/wallframe/button` at the button's turf (buttons.dm:97). The device and board are left lying on the floor.

Health / armor: `max_integrity` 200 (_machinery.dm:93). `armor` as listed in the key vars (buttons.dm:13): melee 50, bullet 50, laser 50, energy 50, bomb 10, bio 100, rad 100, fire 90, acid 70. `integrity_failure = 0` and `damage_deflection = 0` (objs.dm:19, 21). `resistance_flags = LAVA_PROOF | FIRE_PROOF` (buttons.dm:16).

Power: `use_power = IDLE_POWER_USE` (buttons.dm:14), `idle_power_usage = 2` (buttons.dm:15), channel `AREA_USAGE_ENVIRON` (buttons.dm:7). Each press calls `use_power(5)` (buttons.dm:174). The source gives no unit; the numbers pass through unchanged (code/modules/power/power.dm:96-102). Unpowered or broken buttons ignore presses silently (buttons.dm:163-164).

Gotchas (button family):
- Access is checked at press time only (buttons.dm:169). The board inside the button carries the same access list the type was built with (buttons.dm:36-42).
- Any non-harm item used on a closed button presses it (buttons.dm:104-105).
- The spam guard `device.next_activate` never blocks control devices. The base `activate()` sets `next_activate = world.time + 30` (code/modules/assembly/assembly.dm:77-80), but every control type overrides `activate()` without calling the parent (code/modules/assembly/doorcontrol.dm:16, 42, 78, 105, 125, 140). Spam is limited only by each control's own `cooldown` (see each entry).
- The press is delivered by `device.pulsed()`, which runs `activate()` with `INVOKE_ASYNC` (code/modules/assembly/assembly.dm:58-63; `wire_type` defaults to `WIRE_RECEIVE | WIRE_PULSE`, assembly.dm:26). The button does not wait for the target.
- `emag_act` clears access (buttons.dm:109-115).

---

## Entries

### airlock sensor  `/obj/machinery/airlock_sensor/incinerator_toxmix`   (code/game/machinery/airlock_control.dm:104)
- What it is: the toxmix combustion chamber's airlock sensor. It reports the pressure of the air on its own turf and sends a "cycle" command to its controller when clicked.
- Key vars (child): `id_tag = INCINERATOR_TOXMIX_AIRLOCK_SENSOR` = "toxmix_airlock_sensor" (airlock_control.dm:105; code/__DEFINES/atmospherics.dm:324). `master_tag = INCINERATOR_TOXMIX_AIRLOCK_CONTROLLER` = "toxmix_airlock_controller" (airlock_control.dm:106; atmospherics.dm:325).
- Name, icon, power, frequency: inherited from the parent block above (`name` "airlock sensor", airlock_control.dm:90).
- Controller it talks to: `/obj/machinery/embedded_controller/radio/airlock_controller/incinerator_toxmix` (code/game/machinery/embedded_controller/airlock_controller.dm:214). It is named "Incinerator Access Console" (:215) and uses `id_tag = INCINERATOR_TOXMIX_AIRLOCK_CONTROLLER` (:218) and `sensor_tag = INCINERATOR_TOXMIX_AIRLOCK_SENSOR` (:221). The sensor's `master_tag` must equal the controller's `id_tag`, and the controller's `sensor_tag` must equal the sensor's `id_tag`.
- Interactions, Construction, Deconstruction, Drops, Health, Power: as in the parent block above. Nothing extra is defined for this child.
- Gotchas: it is the only sensor for the toxmix chamber. It has no tool path to remove it, and destroying it leaves nothing behind.

### combustion chamber vent control  `/obj/machinery/button/door/incinerator_vent_toxmix`   (code/game/machinery/buttons.dm:205)
- What it is: a door button that opens or closes the toxmix combustion chamber vent.
- Key vars (child): `name = "combustion chamber vent control"` (buttons.dm:206). `id = INCINERATOR_TOXMIX_VENT` = "toxmix_vent" (buttons.dm:207; atmospherics.dm:322). `req_access = list(ACCESS_TOXINS)` (buttons.dm:208).
- Inherited: `desc` "A door remote control switch." (buttons.dm:185); `device` is `/obj/item/assembly/control` with `id = "toxmix_vent"` and `sync_doors = TRUE` (buttons.dm:200-202, 124-128); `board` is created at Initialize because `req_access` is set (buttons.dm:36-42).
- Interactions: the shared button table above. Press (`attack_hand`, allowed): `device.pulsed()` runs the control's `activate()` (code/modules/assembly/doorcontrol.dm:16-26). For every `/obj/machinery/door/poddoor` in `GLOB.machines` with the same id, it opens the door if it is closed (`M.density`) or closes it if open (doorcontrol.dm:21-25). `sync_doors` means the direction is taken once from the first matching door and applied to all of them (doorcontrol.dm:23). Cooldown: `addtimer(VARSET_CALLBACK(src, cooldown, FALSE), 10)` = 10 ds (doorcontrol.dm:26).
- Target door: `/obj/machinery/door/poddoor/incinerator_toxmix` = "combustion chamber vent", id `INCINERATOR_TOXMIX_VENT` (code/game/machinery/doors/poddoor.dm:44-46).
- Construction, Deconstruction, Drops, Health, Power: as in the parent block above.
- Gotchas: needs toxins access (ACCESS_TOXINS, buttons.dm:208). Map-only: no construction path.

### turbine vent control  `/obj/machinery/button/door/incinerator_vent_atmos_main`   (code/game/machinery/buttons.dm:210)
- What it is: a door button for the turbine (atmos main) vent of the incinerator.
- Key vars (child): `name = "turbine vent control"` (buttons.dm:211). `id = INCINERATOR_ATMOS_MAINVENT` = "atmos_incinerator_mainvent" (buttons.dm:212; atmospherics.dm:331). `req_one_access = list(ACCESS_ATMOSPHERICS, ACCESS_MAINT_TUNNELS)` (buttons.dm:213).
- Interactions: as the toxmix vent button (control cooldown 10 ds, doorcontrol.dm:26). Target: `/obj/machinery/door/poddoor/incinerator_atmos_main`, name "turbine vent", id `INCINERATOR_ATMOS_MAINVENT` (code/game/machinery/doors/poddoor.dm:48-50).
- Access: any one of ACCESS_ATMOSPHERICS or ACCESS_MAINT_TUNNELS, by held item or ID (access.dm:86-90).
- Construction, Deconstruction, Drops, Health, Power: as in the parent block above.
- Gotchas: `req_one_access` means any one of two accesses opens it; `board.one_access` is set (buttons.dm:40-41).

### combustion chamber vent control  `/obj/machinery/button/door/incinerator_vent_atmos_aux`   (code/game/machinery/buttons.dm:215)
- What it is: a door button for the combustion chamber (atmos aux) vent.
- Key vars (child): `name = "combustion chamber vent control"` (buttons.dm:216). `id = INCINERATOR_ATMOS_AUXVENT` = "atmos_incinerator_auxvent" (buttons.dm:217; atmospherics.dm:332). `req_one_access = list(ACCESS_ATMOSPHERICS, ACCESS_MAINT_TUNNELS)` (buttons.dm:218).
- Interactions: as the toxmix vent button (control cooldown 10 ds, doorcontrol.dm:26). Target: `/obj/machinery/door/poddoor/incinerator_atmos_aux`, name "combustion chamber vent", id `INCINERATOR_ATMOS_AUXVENT` (code/game/machinery/doors/poddoor.dm:52-54).
- Access: any one of ACCESS_ATMOSPHERICS or ACCESS_MAINT_TUNNELS (access.dm:86-90).
- Construction, Deconstruction, Drops, Health, Power: as in the parent block above.
- Gotchas: same name as the toxmix vent button (buttons.dm:206 and 216 both say "combustion chamber vent control"). The id and access differ, so they are not interchangeable.

### combustion chamber ignition switch  `/obj/machinery/button/ignition/incinerator/toxmix`   (code/game/machinery/buttons.dm:254)
- What it is: a remote switch that fires the toxmix combustion chamber's igniter and sparker.
- Key vars (child): `id = INCINERATOR_TOXMIX_IGNITER` = "toxmix_igniter" (buttons.dm:255; atmospherics.dm:321). `name` "combustion chamber ignition switch" and `desc` "A remote control switch for the combustion chamber's igniter." come from the `/obj/machinery/button/ignition/incinerator` parent (buttons.dm:250-252). `icon_state` and `skin` are "launcher" (buttons.dm:243-244).
- Access: none. No `req_access` or `req_one_access` is set on the type, so `allowed()` is always TRUE (access.dm:76-77), and no board is created (buttons.dm:36).
- Device: `/obj/item/assembly/control/igniter` (doorcontrol.dm:101; `device_type` at buttons.dm:245), created in Initialize (buttons.dm:31-32) and given `id = "toxmix_igniter"` (buttons.dm:124-128).
- Interactions: the shared button table. Press: `device.pulsed()` runs `/obj/item/assembly/control/igniter` `activate()` (doorcontrol.dm:105-119):
  - for each `/obj/machinery/sparker` with the same id, `INVOKE_ASYNC(M, ignite)` (doorcontrol.dm:109-111). The toxmix sparker is `/obj/machinery/sparker/toxmix` with `id = INCINERATOR_TOXMIX_IGNITER` (code/game/machinery/igniter.dm:72-73);
  - for each `/obj/machinery/igniter` with the same id: `M.use_power(50)` (doorcontrol.dm:115), `M.on = !M.on` (:116), `icon_state = "igniter[M.on]"` (:117);
  - cooldown: `addtimer(VARSET_CALLBACK(src, cooldown, FALSE), 30)` = 30 ds (doorcontrol.dm:119).
- Target igniter: `/obj/machinery/igniter/incinerator_toxmix` (code/game/machinery/igniter.dm:16-17). It has `use_power = IDLE_POWER_USE`, `idle_power_usage = 2`, `active_power_usage = 4` (igniter.dm:7-9), `max_integrity = 300` (igniter.dm:10), `armor` melee 50, bullet 30, laser 70, energy 50, bomb 20, bio 0, rad 0, fire 100, acid 70 (igniter.dm:11), `resistance_flags = FIRE_PROOF` (igniter.dm:12). While on, its `process` calls `location.hotspot_expose(1000,500,1)` on its turf (igniter.dm:39-44).
- Construction, Deconstruction, Drops, Health, Power: as in the parent block above, but the device is an igniter control, so the Drops line (a) releases `/obj/item/assembly/control/igniter` from the button when it is destroyed.
- Gotchas: anyone can fire it (no access). The igniter cooldown is 30 ds (doorcontrol.dm:119), not the 10 ds of the door controls. The sparker and igniter are separate machines with the same id; the sparker's `ignite` proc is not documented here.

# gap-things-02, part 2: power cell charger

One list entry. Paths relative to `_src/tg2020`. File key as in part 1, plus: `constructable_frame.dm` = code/game/machinery/constructable_frame.dm; `circuitboard.dm` = code/game/objects/items/circuitboards/circuitboard.dm; `machine_circuitboards.dm` = code/game/objects/items/circuitboards/machine_circuitboards.dm; `stock_parts.dm` = code/modules/research/stock_parts.dm; `cell_charger.dm` = code/game/machinery/cell_charger.dm; `sheet_types.dm` = code/game/objects/items/stacks/sheets/sheet_types.dm.

Parent: `/obj/machinery` (code/game/machinery/_machinery.dm:86). The inherited machine rules are in part 1.

### cell charger  `/obj/machinery/cell_charger`   (code/game/machinery/cell_charger.dm:1)
- What it is: a wall/floor machine that holds one power cell and charges it from the area's equipment channel. BoxStation has 13 (list count).
- Key vars: `name = "cell charger"` (cell_charger.dm:2); `desc = "It charges power cells."` (:3); `icon = 'icons/obj/power.dmi'` (:4); `icon_state = "ccharger"` (:5); `pass_flags = PASSTABLE` (:11); `var/obj/item/stock_parts/cell/charging = null` (:12); `var/charge_rate = 500` (:13).
- Power vars: `use_power = IDLE_POWER_USE` (:6); `idle_power_usage = 5` (:7); `active_power_usage = 60` (:8); `power_channel = AREA_USAGE_EQUIP` (:9), which is 0 (code/game/machinery/_machinery.dm:24).
- Circuit: `circuit = /obj/item/circuitboard/machine/cell_charger` (cell_charger.dm:10). Initialize makes a fresh board and calls `apply_default_parts` (_machinery.dm:141-143).
- `max_integrity` is inherited as 200 (_machinery.dm:93). No `armor` is set, so the default list applies (_machinery.dm:136-137). `integrity_failure` and `damage_deflection` are 0 (objs.dm:19, 21). No `resistance_flags` set.

Interactions:

| held item / action | condition | delay (ds) | message(s) verbatim | result (file:line) |
|---|---|---|---|---|
| `/obj/item/stock_parts/cell` | panel closed (`!panel_open`), not broken, anchored, no cell inside, area has power (`a.power_equip != 0`) | none | "<span class='notice'>[user] inserts a cell into [src].</span>" and "<span class='notice'>You insert a cell into [src].</span>" (cell_charger.dm:57) | cell moved into the charger (`transferItemToLoc`, :53) and set as `charging` (:56); `update_icon()` (:58) |
| `/obj/item/stock_parts/cell` | `machine_stat & BROKEN` | none | "<span class='warning'>[src] is broken!</span>" (:38) | refused, returns (:39) |
| `/obj/item/stock_parts/cell` | not anchored | none | "<span class='warning'>[src] isn't attached to the ground!</span>" (:41) | refused (:42) |
| `/obj/item/stock_parts/cell` | a cell is already inside | none | "<span class='warning'>There is already a cell in the charger!</span>" (:44) | refused (:45) |
| `/obj/item/stock_parts/cell` | the location's area has no APC (`a.power_equip == 0`) | none | "<span class='warning'>[src] blinks red as you try to insert the cell!</span>" (:51) | refused (:52). The source comment reads "There's no APC in this area, don't try to cheat power!" (:50) |
| `/obj/item/stock_parts/cell` | `!isarea(loc.loc)` | none | none | returns silently (:48-49) |
| `/obj/item/stock_parts/cell` | panel open | none | none | the cell branch is skipped; falls to the else branch (:59-66), so nothing is inserted |
| Screwdriver (TOOL_SCREWDRIVER) | no cell inside (`!charging`) | none (instant) | "You open the maintenance hatch of [src]." / "You close the maintenance hatch of [src]." (_machinery.dm:453, 457) | toggles `panel_open`; icon becomes the same `icon_state` open/closed (cell_charger.dm:60; _machinery.dm:447-459) |
| Screwdriver | cell inside | none | none | the `!charging` gate fails (cell_charger.dm:60); falls through to `..()` (:66). Nothing happens |
| Crowbar (TOOL_CROWBAR) | panel open (`panel_open \|\| ignore_panel`) | none; sound `play_tool_sound(src, 50)` (_machinery.dm:399) | none | `deconstruct(TRUE)` (cell_charger.dm:62; _machinery.dm:396-400). **No `!charging` gate on this line**, so it also works with a cell inside |
| Wrench (TOOL_WRENCH) | no cell inside (`!charging`), can be unfastened (on a floor, or already anchored; _machinery.dm:469-473) | 20 (default `time = 20`, _machinery.dm:475); sound 50 (_machinery.dm:482) | "You begin unsecuring cell charger..." / "You unsecure cell charger." when anchored (rendered from _machinery.dm:481, 486); "You begin securing cell charger..." / "You secure cell charger." when not anchored | toggles `anchored`; `playsound(src, 'sound/items/deconstruct.ogg', 50, TRUE)` (_machinery.dm:488); cell_charger.dm:64 |
| Wrench | cell inside | none | none | the `!charging` gate fails (cell_charger.dm:64); falls through to `..()` |
| `attack_hand` | a cell inside | none | "<span class='notice'>[user] removes [charging] from [src].</span>" / "<span class='notice'>You remove [charging] from [src].</span>" (cell_charger.dm:92) | cell `put_in_hands` (:89); `add_fingerprint` (:90); `removecell()` (:94): `charging.update_icon()`, `charging = null`, `update_icon()` (:77-80) |
| `attack_hand` | no cell inside | none | none | returns (cell_charger.dm:86-87). The parent `attack_hand` runs first (:83-85) |
| `attack_tk` | a cell inside | none | "<span class='notice'>You telekinetically remove [charging] from [src].</span>" (cell_charger.dm:101) | cell moved to `loc` (:100); `removecell()` (:103) |
| `attack_ai` | any | none | none | does nothing (cell_charger.dm:105-106) |
| `emp_act(severity)` | not `BROKEN\|NOPOWER`, and not `EMP_PROTECT_CONTENTS` | none | none | `charging.emp_act(severity)` (cell_charger.dm:108-115) |

Examine text (cell_charger.dm:27-33):
- "There's [charging ? "a" : "no"] cell in the charger." (:29)
- "Current charge: [round(charging.percent(), 1)]%." when a cell is inside (:31)
- "<span class='notice'>The status display reads: Charge rate at <b>[charge_rate]J</b> per cycle.</span>" when in range or an observer (:32-33). The source gives the unit as J per cycle here.

Charging loop (cell_charger.dm:122-131, machine `process`, every machine tick; the comment at _machinery.dm:120 says about 2 seconds):
- Returns when there is no cell, not anchored, or `BROKEN|NOPOWER` (:123-124). Returns when the cell is at 100% (:126-127).
- Otherwise `use_power(charge_rate)` (:128) and `charging.give(charge_rate)` (:129). The source comment on :129 reads "//this is 2558, efficient batteries exist".
- `update_icon()` (:131).
- `charge_rate` is 500 (:13), recalculated in `RefreshParts` as `500 * rating` for each capacitor in `component_parts` (cell_charger.dm:117-120). Capacitor ratings: base 1 (stock_parts.dm:128 base, :140 capacitor), advanced 2 (stock_parts.dm:182), super 3 (stock_parts.dm:226), quadratic 4 (stock_parts.dm:270).

Overlays (cell_charger.dm:15-25): with a cell, the cell's icon is drawn, plus "ccharger-on"; when not broken or unpowered, "ccharger-o[newlevel]" where `newlevel = round(charging.percent() * 4 / 100)` (:24-25).

Construction chain (the charger is frame-built: `circuit` is set, so it is not a wallframe):
1. 5 × `/obj/item/stack/sheet/metal`: stack recipe "machine frame", `/obj/structure/frame/machine`, 5 sheets, `time = 25` (ds), `one_per_turf`, `on_floor` (sheet_types.dm:52; list `GLOBAL_LIST_INIT(metal_recipes)` at sheet_types.dm:17). The frame is `name = "machine frame"` (constructable_frame.dm:26), `max_integrity = 250` (constructable_frame.dm:6), `state = 1` (:8), icon "box_0" (:4).
2. Frame state 1: wrench, `use_tool` 40, `volume=75` (constructable_frame.dm:105-106): "You start securing machine frame..." then "You secure machine frame." (:108). This sets `anchored` (:109). The messages use the frame's name.
   - Optional: screwdriver on a non-anchored frame in state 1 disassembles it: "[user] disassembles the frame." / "You start to disassemble the frame..." / "You hear banging and clanking." (:95-96), `use_tool` 40, `volume=50` (:97), "You disassemble the frame." (:99), returns 5 metal sheets (:100), `qdel` (:102).
3. Frame state 1: 5 cable coils (`tool_start_check(user, amount=5)`, constructable_frame.dm:84). "You start to add cables to the frame..." (:87), `use_tool` 20, `volume=50`, `amount=5` (:88). "You add cables to the frame." (:89). `state = 2`, icon "box_1" (:90-91).
4. Frame state 2: insert `/obj/item/circuitboard/machine/cell_charger` (machine_circuitboards.dm:188). `build_path` must be set (constructable_frame.dm:122). Needs-anchored check: `!anchored && B.needs_anchored` (:125-127), which does not block this board because `needs_anchored = FALSE` (machine_circuitboards.dm:193). "You add the circuit board to the frame." (:131) with sound 'sound/items/deconstruct.ogg' 50 (:130). `state = 3`, icon "box_2" (:133-134). `req_components = B.req_components.Copy()` = `{/obj/item/stock_parts/capacitor: 1}` (machine_circuitboards.dm:192; constructable_frame.dm:136).
   - Also in state 2: wrench 40 (constructable_frame.dm:113-117) toggles anchoring. Wirecutters: "You remove the cables." and 5 cable coils come back, `state = 1` (:144-150).
5. Frame state 3: insert a capacitor of any tier (`istype(P, /obj/item/stock_parts/capacitor)`): "You add [P] to [src]." (constructable_frame.dm:265), `req_components[I]--` (:267). A part replacer (RPED) can apply parts in one use: "[part.name] applied." (:239). Crowbar in state 3 takes the circuit back out (:153-169). The wrench is allowed in state 3 only because `!circuit.needs_anchored` (:171).
6. Frame state 3: screwdriver, only when every `req_components` count is 0 (constructable_frame.dm:178-185). No message is sent in this path. `new circuit.build_path(loc)` makes the charger (:186). Its `circuit` is set (:189) and it takes `anchored` from the frame (:190). Every object in the frame (board and capacitor) becomes `component_parts` (:192-197). `RefreshParts()` (:199) sets `charge_rate`. The frame is qdel'd (:200).

Deconstruction chain (the charger's own tool path):
1. Remove the cell first: `attack_hand` puts it in hands (cell_charger.dm:82-94). Screwdriver and wrench are both refused while a cell is inside (:60, :64).
2. Screwdriver: opens the hatch (_machinery.dm:447-459).
3. Crowbar with the hatch open: `deconstruct(TRUE)` (cell_charger.dm:62; _machinery.dm:396-400). The charger then spawns the frame and drops its parts (see Drops).
4. Wrench (no cell): unfastens the charger, 20 ds (cell_charger.dm:64; _machinery.dm:475-492). This is not a deconstruction. It leaves the machine in place, unanchored.
5. The state-2 frame that is left behind can be taken further: wirecutters give back 5 cable coils and state 1 (constructable_frame.dm:144-150). In state 1, an unanchored frame can be disassembled to 5 metal sheets (constructable_frame.dm:94-102).

Drops:
- (a) Destroyed (integrity 0): `obj_destruction` calls `deconstruct(FALSE)` (obj_defense.dm:252-258). The charger's own `deconstruct()` override (cell_charger.dm:68-71) moves the cell to `drop_location()` and then calls `..()`. The parent `deconstruct` (_machinery.dm:402-410) runs `spawn_frame` (_machinery.dm:412-420), moves every `component_parts` object to `loc` (the circuit board and the capacitor, _machinery.dm:407-408), then `qdel`s the charger. `Destroy` calls `QDEL_NULL(charging)` (cell_charger.dm:73-75), which deletes the cell that was just moved to the floor (inferred from the code order; not run). Result: a `/obj/structure/frame/machine` in state 2 with `box_1` icon, at 50% integrity when `disassembled` is FALSE (_machinery.dm:416-417, :419-420), plus the capacitor and the circuit board on the floor. The cell is lost. The cell is also not recovered by any other path.
- (b) Properly deconstructed (cell removed first, hatch opened, crowbar): the same frame at full integrity (`disassembled` TRUE), the same board and capacitor on the floor, and no cell.
- (c) Crowbar with a cell still inside: same result as (b), but the cell is deleted (cell_charger.dm:62 has no `!charging` check; cell_charger.dm:68-75).
- `disassembled` note: the `deconstruct()` override takes no argument (cell_charger.dm:68), and its `..()` passes none. Whether the parent sees FALSE on destruction depends on BYOND forwarding the caller's arguments to `..()` (inferred: yes, which makes the half-integrity frame of (a) correct).

Health / armor: `max_integrity` 200 (_machinery.dm:93). Default armor from `/obj/machinery/Initialize`: melee 25, bullet 10, laser 10, energy 0, bomb 0, bio 0, rad 0, fire 50, acid 70 (_machinery.dm:137). `integrity_failure = 0`, `damage_deflection = 0` (objs.dm:19, 21). `obj_break` is only called when `integrity_failure` is set (obj_defense.dm:17), so damage never sets `BROKEN` on this charger; integrity 0 destroys it.

Power: `use_power = IDLE_POWER_USE`, `idle_power_usage = 5`, `active_power_usage = 60` (cell_charger.dm:6-8), on `AREA_USAGE_EQUIP` (cell_charger.dm:9). The per-cycle draw while charging is `use_power(charge_rate)` = 500 with the base capacitor (cell_charger.dm:128; examine text cell_charger.dm:33 says J per cycle). A basic capacitor gives 500, advanced 1000, super 1500, quadratic 2000 (`500 * rating`, cell_charger.dm:117-120).

Gotchas:
- A cell can only go in where the area has an APC: `a.power_equip == 0` refuses it with "blinks red" (cell_charger.dm:50-51).
- Not anchored means no insert and no charging (cell_charger.dm:40-41, :123).
- Charging stops at 100% (cell_charger.dm:126-127), and it does not draw power then.
- The crowbar path has no cell check (cell_charger.dm:62), so a cell inside is deleted when the charger is taken apart.
- The cell is deleted, not dropped, on destruction (inferred from cell_charger.dm:68-75).
- Screwdriver and wrench are refused while a cell is inside (cell_charger.dm:60, :64). Empty the charger first.
- Its board is part of `component_parts` (circuitboard.dm:35-39), so a deconstructed charger gives the board back, unlike a bare machine.
- `attack_ai` does nothing (cell_charger.dm:105-106).
- A broken charger refuses cells and does not charge (cell_charger.dm:37-39, :123).

# gap-things-02, part 3: autolathe

One list entry. Paths relative to `_src/tg2020`. File key as in parts 1-2, plus: `autolathe.dm` = code/game/machinery/autolathe.dm; `material_container.dm` = code/datums/components/material_container.dm; `item_attack.dm` = code/_onclick/item_attack.dm; `wires/autolathe.dm` = code/datums/wires/autolathe.dm; `_techweb.dm` = code/modules/research/techweb/_techweb.dm; `designs.dm` = code/modules/research/designs.dm; `construction.dm` = code/__DEFINES/construction.dm; `wires.dm` = code/__DEFINES/wires.dm.

Parent: `/obj/machinery` (code/game/machinery/_machinery.dm:86). Inherited machine rules are in part 1.

### autolathe  `/obj/machinery/autolathe`   (code/game/machinery/autolathe.dm:5)
- What it is: a machine that turns stored rigid materials (metal, glass and similar) into items, using the designs its own techweb knows. Designs are picked from a HTML menu. BoxStation has 1 (list count).
- Key vars: `name = "autolathe"` (autolathe.dm:6); `desc = "It produces items using metal and glass."` (:7); `icon_state = "autolathe"` (:8); `density = TRUE` (:9); `layer = BELOW_OBJ_LAYER` (:14); `circuit = /obj/item/circuitboard/machine/autolathe` (:13).
- Power vars: `use_power = IDLE_POWER_USE` (:10); `idle_power_usage = 10` (:11); `active_power_usage = 100` (:12); `power_channel` inherited `AREA_USAGE_EQUIP` (_machinery.dm:108).
- Tuning vars: `prod_coeff = 1` (:27, recalculated by RefreshParts); `base_price = 25` (:34) and `hacked_price = 50` (:35) are declared here and are not referenced anywhere in autolathe.dm.
- Categories (menu tabs, :37-48): "Tools", "Electronics", "Construction", "T-Comm", "Security", "Machinery", "Medical", "Misc", "Dinnerware", "Imported".
- Health / armor: `max_integrity` inherited 200 (_machinery.dm:93). No `armor` is set, so the default list applies (_machinery.dm:136-137): melee 25, bullet 10, laser 10, energy 0, bomb 0, bio 0, rad 0, fire 50, acid 70. `integrity_failure` and `damage_deflection` are 0 (objs.dm:19, 21).
- Material store: `Initialize` adds a `material_container` component for the `MAT_CATEGORY_RIGID` materials, max 0 at first, `_show_on_examine` TRUE, no `allowed_types`, and `AfterMaterialInsert` as the after-insert callback (autolathe.dm:50-51). Its capacity is set in `RefreshParts` (see Power).
- Wires: `wires = new /datum/wires/autolathe(src)` (autolathe.dm:54). `Destroy` does `QDEL_NULL(wires)` (:58-60).
- Techweb: `stored_research = new /datum/techweb/specialized/autounlocking/autolathe` (autolathe.dm:55), which has `design_autounlock_buildtypes = AUTOLATHE` and `allowed_buildtypes = AUTOLATHE` (_techweb.dm:375-377). The list of makeable designs comes from this techweb. Individual designs are not listed in this entry.
- Materials stored for examine: "The status display reads: Storing up to <b>[materials.max_amount]</b> material units.<br>Material consumption at <b>[prod_coeff*100]%</b>." (autolathe.dm:256-260, only when in range or an observer).

Interactions:

| held item / action | condition | delay (ds) | message(s) verbatim | result (file:line) |
|---|---|---|---|---|
| any item | `busy` | none | "<span class=\"alert\">The autolathe is busy. Please wait for completion of previous operation.</span>" (autolathe.dm:89-90) | returns TRUE; nothing else happens (:91) |
| Screwdriver (TOOL_SCREWDRIVER) | not busy | none (instant) | "You open the maintenance hatch of [src]." / "You close the maintenance hatch of [src]." (_machinery.dm:453, 457) | `default_deconstruction_screwdriver(user, "autolathe_t", "autolathe", O)` (autolathe.dm:93-95; _machinery.dm:447-459). **No access check here**, unlike buttons |
| Crowbar (TOOL_CROWBAR) | panel open | none; sound 50 (_machinery.dm:399) | none | `default_deconstruction_crowbar(O)` gives `deconstruct(TRUE)` (autolathe.dm:97-98; _machinery.dm:396-400) |
| wire tool (`is_wire_tool`) | panel open | none | none | `wires.interact(user)` (autolathe.dm:100-102). The wires are interactable only when the panel is open (wires/autolathe.dm:13-16) |
| any item, `INTENT_HARM` | not busy | none | none | `return ..()` (autolathe.dm:104-105), so the machine is hit as an object |
| any item | `machine_stat` set (unpowered or broken) | none | none | returns TRUE, silently (autolathe.dm:107-108) |
| `/obj/item/disk/design_disk` | not busy, powered | `do_after(user, 14.4, target = src)` (autolathe.dm:116) | "<span class='notice'>[user] begins to load \the [O] in \the [src]...</span>" (:111-112 as "[user] begins to load \the [O] in \the [src]..."); "<span class='notice'>You begin to load a design from \the [O]...</span>"; "<span class='hear'>You hear the chatter of a floppy drive.</span>" (:113) | `busy = TRUE` (:114); each blueprint in `D.blueprints` is added to `stored_research` (:117-119); `busy = FALSE` (:120). No message when it finishes |
| Metal, glass or other rigid-material item (material stack or item) | `user.a_intent == INTENT_HELP`, not busy, powered, not a wire tool, not a design disk | none | "<span class='warning'>[parent] won't accept [I]!</span>" (material_container.dm:66) when the type is refused or the item is a hologram or has no-redemption flags; "<span class='warning'>[I] does not contain sufficient materials to be accepted by [parent].</span>" (:74); "<span class='warning'>[parent] is full. Please remove materials from [parent] in order to insert more.</span>" (:77); on success "<span class='notice'>You insert a material total of [inserted] into [parent].</span>" (:99) | the item is qdel'd (:100); `AfterMaterialInsert` runs (:101-102; autolathe.dm:126-136). The insert path is reached only because `autolathe.dm:123` calls `return ..()`, which sends `COMSIG_PARENT_ATTACKBY` (item_attack.dm:53-56) |
| Topic `make` (UI link) | not busy; design is researched (`isDesignResearchedID`, autolathe.dm:154-156) | `time` (see Construction) | "<span class=\"alert\">Not enough materials for this operation.</span>" when short (autolathe.dm:200); "<span class=\"alert\">The autolathe is busy. Please wait for completion of previous operation.</span>" (:211) | `busy = TRUE`; `use_power(power)`; `icon_state = "autolathe_n"`; `addtimer(make_item, time)` (autolathe.dm:193-198) |
| Topic `search` | not busy | none | none | filters researched designs by name with `findtext` (autolathe.dm:202-209) |
| Topic `menu` / `category` | not busy | none | none | sets `screen` (1 main, 2 category, 3 search; autolathe.dm:1-3, :142-148) |

Menu (ui_interact, autolathe.dm:62-82): does nothing when `!is_operational()` (:64-65). When `shocked` is set and the machine has power, `shock(user, 50)` runs first (:67-68). The window is a `datum/browser` titled with the machine name, 400 by 500 (:80). Each design link shows "linkOff" when `disabled` or `can_build(D)` is false (autolathe.dm:298-299, 332-333).

Construction chain (frame-built; the autolathe has `circuit` set, so it is not a wallframe):
1. 5 × metal sheet, stack recipe "machine frame" (sheet_types.dm:52, `GLOBAL_LIST_INIT(metal_recipes)` at sheet_types.dm:17). Time 25 ds, `one_per_turf`, `on_floor`. Makes `/obj/structure/frame/machine` in state 1 (constructable_frame.dm:8, 25; icon "box_0" :4; `max_integrity = 250` :6).
2. Frame state 1, wrench, 40 ds, `volume=75`: "You start securing machine frame..." then "You secure machine frame." (constructable_frame.dm:104-110). The frame must be anchored before the board goes in (step 4).
3. Frame state 1, 5 cable coils, `tool_start_check(user, amount=5)` (constructable_frame.dm:83-85). "You start to add cables to the frame..." (:87). `use_tool` 20 ds, `volume=50`, `amount=5` (:88). "You add cables to the frame." (:89). `state = 2`, icon "box_1" (:90-91).
4. Frame state 2, circuit board `/obj/item/circuitboard/machine/autolathe` (machine_circuitboards.dm:46). Refused with "The frame needs to be secured first!" if not anchored (constructable_frame.dm:125-127), because `needs_anchored` defaults to TRUE (circuitboard.dm:27) and this board does not override it. Then: sound 'sound/items/deconstruct.ogg' 50 (:130); "You add the circuit board to the frame." (:131); `state = 3`, icon "box_2" (:133-134); `req_components` copied from the board (:136).
   - Board `req_components` (machine_circuitboards.dm:50-53): `/obj/item/stock_parts/matter_bin = 3`, `/obj/item/stock_parts/manipulator = 1`, `/obj/item/stack/sheet/glass = 1`.
5. Frame state 3, add parts: each matter bin and the manipulator is inserted with "You add [P] to [src]." (constructable_frame.dm:265-267). The glass is taken as a stack, `min(round(S.get_amount()), req)` sheets (:247-261), with the same message. A part replacer can apply parts in one use: "[part.name] applied." (:239). Crowbar in state 3 takes the circuit and the other parts back out (:153-169). The wrench is allowed in state 3 only if `!circuit.needs_anchored` (:171), which is not the case for this board.
6. Frame state 3, screwdriver, only when every `req_components` count is 0 (constructable_frame.dm:178-185). No message is sent in this path. `new circuit.build_path(loc)` makes the autolathe (:186). Its `circuit` is set (:189), anchored state is copied (:190), the frame's objects become `component_parts` (:192-197), then `RefreshParts()` runs (:199) and the frame is qdel'd (:200).

Deconstruction chain (player):
1. Screwdriver: opens the hatch, no access check (autolathe.dm:93-95).
2. Crowbar with the hatch open: `deconstruct(TRUE)` (autolathe.dm:97-98; _machinery.dm:396-400). `on_deconstruction` runs first (see Drops).
3. A wire tool (`is_wire_tool`) on the open hatch: the wires menu (autolathe.dm:100-102). This does not remove anything.
- The busy gate (autolathe.dm:89-91) applies to the screwdriver and crowbar too, so a running job blocks deconstruction.

Drops:
- On_deconstruction (`autolathe.dm:84-86`), which runs for both destroyed and deconstructed machines (_machinery.dm:402-404): `materials.retrieve_all()` dumps everything stored as whole sheets onto the turf (material_container.dm:234-238; `retrieve_sheets` uses `get_turf(parent)` at :216-217). Sheets are capped at `MAX_STACK_SIZE` (50) per stack (material_container.dm:221-228; construction.dm:72). Any remainder under one sheet is kept in the store and lost.
- (a) Destroyed (integrity 0): `obj_destruction` calls `deconstruct(FALSE)` (obj_defense.dm:252-258). Then `spawn_frame(FALSE)` (_machinery.dm:412-420): a `/obj/structure/frame/machine` at 50% integrity in state 2, icon "box_1" (_machinery.dm:416-420). Then every `component_parts` object is moved to the floor (_machinery.dm:407-408): the circuit board (`apply_default_parts` puts the board first in `component_parts`, circuitboard.dm:39), 3 matter bins, 1 manipulator, and the glass stack (1 sheet by default).
- (b) Properly deconstructed (hatch open, crowbar): the same drops, with the frame at full integrity (the half-integrity line, _machinery.dm:416-417, is skipped).
- The stored materials are dumped in both cases (on_deconstruction), so nothing is lost there.
- The design disk is not consumed: the disk-loading branch never deletes it (autolathe.dm:110-121). Designs already learned are held by the machine's own techweb (autolathe.dm:55), which has no drop path in this file.

Power (per the source, the numbers pass straight to `use_power`; no unit is written):
- Idle `idle_power_usage = 10` and active `active_power_usage = 100` (autolathe.dm:10-12), with `use_power = IDLE_POWER_USE` (autolathe.dm:10).
- Starting a job: `power = max(2000, (total_amount) * multiplier / 5)`, where `total_amount` is the sum of the design's material amounts (autolathe.dm:164-170). `use_power(power)` runs in Topic (autolathe.dm:195) **and again** in `make_item` (autolathe.dm:220). The full job draws the number twice.
- Inserting metal: `use_power(min(1000, amount_inserted / 100))` (autolathe.dm:135). Inserting a bluespace crystal: `use_power(MINERAL_MATERIAL_AMOUNT / 10)` (autolathe.dm:127-128), where `MINERAL_MATERIAL_AMOUNT` is 2000 (construction.dm:70), so 200.
- Capacity: `materials.max_amount = T`, where `T` is the sum of `matter_bin.rating * 75000` over the bins (autolathe.dm:246-250). The base bin has rating 1 (stock_parts.dm:128), so three base bins give 225000.
- Consumption coefficient: `prod_coeff = min(1, max(0, 1.2 - sum(manipulator.rating * 0.2)))` (autolathe.dm:251-254). One base manipulator gives 1.0; tier 2 gives 0.8. The source comment reads "Coeff going 1 -> 0,8 -> 0,6 -> 0,4" (:254). The rating of a manipulator is inherited from stock_parts (stock_parts.dm:128).

Making items (Topic `make`, autolathe.dm:150-200; `make_item`, autolathe.dm:217-243):
- Multiplier is `clamp(multiplier, 1, 50)` (autolathe.dm:158-160).
- Stack designs ignore `prod_coeff` (autolathe.dm:164). Other designs use `prod_coeff` (:164).
- Materials needed: `being_built.materials[MAT] * coeff * multiplier` per material (autolathe.dm:177-179). Category-type materials ask the player to pick one: "Choose [used_material]" (:186).
- Time in ds: stacks 32 (autolathe.dm:197); others `(32 * coeff * multiplier) ** 0.8` (:197).
- `make_item`: stacks are made as one stack of `multiplier` (autolathe.dm:224-227). Other items are made one at a time for `multiplier` copies at `drop_location()` (autolathe.dm:219, 229-231), each with `autolathe_crafted(src)`. Custom materials are applied with `set_custom_materials(picked, 1 / multiplier)` (:233-234). An award is given for a non-glass, non-iron custom material (:235-238). `icon_state = "autolathe"`, `busy = FALSE` (:241-242).

Gotchas:
- Materials go in only when the autolathe is powered and not broken (autolathe.dm:107-108), not busy (:89-91), and with the player on help intent (material_container.dm:61).
- The glass branch in `AfterMaterialInsert` tests the machine's own `custom_materials` (autolathe.dm:129), not the inserted item. This type does not set that var, so glass most likely takes the metal branch: `flick("autolathe_o")` and the metal power cost (autolathe.dm:129-135). Inferred from the code; not run.
- The power draw happens twice per job (autolathe.dm:195 and :220).
- A disabled autolathe (wire) only greys out the links (autolathe.dm:298-299, 332-333). Topic does not check `disabled` (autolathe.dm:138-143).
- The wires (wires/autolathe.dm:6-9) are HACK, DISABLE, SHOCK and ZAP, with `add_duds(6)` (:10). Pulsing HACK toggles `hacked` (adds the "hacked" design category, autolathe.dm:416-424); DISABLE toggles `disabled`; SHOCK toggles `shocked`. Each reset after 60 ds (wires/autolathe.dm:28-36, reset at autolathe.dm:391-401). Cutting ZAP calls `shock(usr, 50)` (wires/autolathe.dm:47-48).
- Cutting the wires: `on_cut` has two `case WIRE_HACK` labels (wires/autolathe.dm:41 and :43). The second, presumably meant for WIRE_SHOCK, is never reached, so cutting the high-voltage wire does not set `shocked` (inferred from the labels).
- While `shocked` is set, every UI open runs `shock(user, 50)`: a 50% chance of sparks and `electrocute_mob(user, get_area(src), src, 0.7, TRUE)` (autolathe.dm:67-68, 403-414).
- `attackby` returns early for everything while `busy` (autolathe.dm:89-91), so a design disk cannot be loaded during a job either.
- The UI state `screen` is per-machine (autolathe.dm:33), not per user.

# gap-things-02, part 4: augment manipulator, book binder

Two list entries. Paths relative to `_src/tg2020`. File key as in parts 1-3, plus: `aug_manipulator.dm` = code/game/machinery/aug_manipulator.dm; `lib_machines.dm` = code/modules/library/lib_machines.dm.

Neither type sets any power variable, so both inherit `use_power = IDLE_POWER_USE`, `idle_power_usage = 0`, `active_power_usage = 0` (_machinery.dm:102, 106, 107). Neither has a circuit board, a frame, or a construction path (a grep of `code/` for each type name matches only its own file). Both use the `/obj/machinery` defaults from part 1 for everything not listed here.

### augment manipulator  `/obj/machinery/aug_manipulator`   (code/game/machinery/aug_manipulator.dm:1)
- What it is: a machine that holds one robotic body part and lets a player pick a cosmetic style for it, then ejects it. The name is "augment manipulator" (`\improper` is a DM text flag and does not change the displayed name). BoxStation has 1 (list count).
- Key vars: `name = "\improper augment manipulator"` (aug_manipulator.dm:2); `desc = "A machine for custom fitting augmentations, with in-built spraypainter."` (:3); `icon = 'icons/obj/pda.dmi'` (:4); `icon_state = "pdapainter"` (:5); `density = TRUE` (:6); `obj_integrity = 200` (:7); `max_integrity = 200` (:8); `var/obj/item/bodypart/storedpart` (:9); `style_list_icons` = "standard" → 'icons/mob/augmentation/augments.dmi', "engineer" → 'icons/mob/augmentation/augments_engineer.dmi', "security" → 'icons/mob/augmentation/augments_security.dmi', "mining" → 'icons/mob/augmentation/augments_mining.dmi' (:11).
- Armor: no `armor` is set, so the default list from `_machinery.dm:137` applies. `integrity_failure` and `damage_deflection` are 0 (objs.dm:19, 21).
- Icon states: "pdapainter" when powered (:27-28); "pdapainter-off" unpowered (:29-30); "pdapainter-broken" when `BROKEN` (:23-25); overlay "pdapainter-closed" while a part is inside (:34-35).

Interactions:

| held item / action | condition | delay (ds) | message(s) verbatim | result (file:line) |
|---|---|---|---|---|
| Wrench (TOOL_WRENCH) | `default_unfasten_wrench`: on floor or anchored (`can_be_unfasten_wrench`, _machinery.dm:469-473) | 20 (default `time`, _machinery.dm:475); sound 50 (_machinery.dm:482) | "You begin [un]securing augment manipulator..." (_machinery.dm:481), then "You [un]secure augment manipulator." (:486) | toggles `anchored` (:487); sound 'sound/items/deconstruct.ogg' 50 (:488); then `power_change()` (aug_manipulator.dm:56-58) |
| `/obj/item/bodypart` with `status != BODYPART_ROBOTIC` | none | none | "<span class='warning'>The machine only accepts cybernetics!</span>" (aug_manipulator.dm:62-64) | refused |
| robotic `/obj/item/bodypart` | `storedpart` already set | none | "<span class='warning'>There is already something inside!</span>" (:65-67) | refused |
| robotic `/obj/item/bodypart` | `storedpart` empty | none | none | `O = user.get_active_held_item()`; moved in with `transferItemToLoc` (:69-71); `storedpart = O` (:72); `add_fingerprint` (:73); `update_icon()` (:74) |
| Welder (TOOL_WELDER), intent not harm | `obj_integrity < max_integrity` | `tool_start_check(amount=0)`; `use_tool` 40, `volume=50` (aug_manipulator.dm:76-85) | "<span class='notice'>[user] begins repairing [src].</span>" / "<span class='notice'>You begin repairing [src]...</span>" / "<span class='hear'>You hear welding.</span>" (:81-83) | only if the machine is `BROKEN` does the repair happen: "<span class='notice'>You repair [src].</span>" (:88), flag cleared, `obj_integrity = max(obj_integrity, max_integrity)` (:89-90). If not `BROKEN`, it returns silently after the weld (:86-87). See Gotchas |
| Welder, `obj_integrity >= max_integrity` | none | none | "<span class='notice'>[src] does not need repairs.</span>" (:93) | nothing |
| any other item, or welder on harm intent | none | none | none | `return ..()` (:94-95) |
| `attack_hand` | `storedpart` set | input "Select style." (:104) | none | the chosen style's icon file is set on the part (`storedpart.icon = style_list_icons[augstyle]`, :111); then `eject_part(user)` (:112). Requires `in_range(src, user)` (:107-108) |
| `attack_hand` | `storedpart` empty | none | "<span class='warning'>\The [src] is empty!</span>" (:115) | nothing. `attack_hand` checks the parent first (:98-100) |
| Alt-click | `user.canUseTopic(src, !issilicon(user))` (:127) | none | "<span class='warning'>[src] is empty!</span>" when empty (:123) | `eject_part(user)` (:130) |
| `examine` | `storedpart` set | none | "<span class='notice'>Alt-click to eject the limb.</span>" (:15-16) | none |

`eject_part` (aug_manipulator.dm:117-123): moves `storedpart` to `get_turf(src)`, clears it, and calls `update_icon()`.

Construction chain: none. No frame, no circuit board, no wallframe. Placed on the map only.

Deconstruction chain: none by tool. `attackby` handles only the wrench (unfasten), robotic parts, and the welder (repair). There is no screwdriver or crowbar branch (aug_manipulator.dm:55-95), so the machine cannot be taken apart with tools. It leaves only by being destroyed.

Drops:
- (a) Destroyed (integrity 0): `obj_destruction` calls `deconstruct(FALSE)` (obj_defense.dm:252-258). The machinery `deconstruct` calls `on_deconstruction` first (_machinery.dm:402-404). That moves `storedpart` to `loc` and clears it (aug_manipulator.dm:41-44). No frame is spawned (`component_parts` is empty, _machinery.dm:405). Then `qdel`, and `Destroy` calls `QDEL_NULL(storedpart)` (aug_manipulator.dm:37-39), which finds nothing. Result: the stored robotic part lies on the floor, the machine is gone.
- (b) No tool deconstruction exists (see above).

Health / armor: `obj_integrity = 200`, `max_integrity = 200` (aug_manipulator.dm:7-8). Armor is the default list from `_machinery.dm:137`: melee 25, bullet 10, laser 10, energy 0, bomb 0, bio 0, rad 0, fire 50, acid 70. `integrity_failure = 0` (objs.dm:19), so damage never sets `BROKEN` (obj_defense.dm:17).

Power: none (inherits idle 0 and active 0, _machinery.dm:106-107). The machine draws no power by its own definition. Its icon reads `powered()` (aug_manipulator.dm:27).

Gotchas:
- No access check and no cost anywhere in the interactions above.
- The welder repair branch can only ever repair a `BROKEN` machine (aug_manipulator.dm:86-90). `BROKEN` is set only through `obj_break`, which is called only when `integrity_failure` is non-zero (obj_defense.dm:17). With this type's `integrity_failure = 0`, the weld spends 40 ds and does nothing. This is inferred from the code; not run.
- Only robotic parts go in (aug_manipulator.dm:62).
- The style menu changes the part's icon for good (aug_manipulator.dm:111), and the part stays in that style after it is ejected.
- The insert takes the active held item, not the item that was clicked (aug_manipulator.dm:69).

### book binder  `/obj/machinery/bookbinder`   (code/modules/library/lib_machines.dm:596)
- What it is: a machine that takes one sheet of paper and prints it as a bound book (`/obj/item/book`) after a random wait. BoxStation has 1 (list count).
- Key vars: `name = "book binder"` (lib_machines.dm:597); `icon = 'icons/obj/library.dmi'` (:598); `icon_state = "binder"` (:599); `desc = "Only intended for binding paper products."` (:600); `density = TRUE` (:601); `var/busy = FALSE` (:602).
- No `armor`, `max_integrity`, `resistance_flags`, or power var is set on the type. The `/obj/machinery` defaults apply (part 1).

Interactions:

| held item / action | condition | delay (ds) | message(s) verbatim | result (file:line) |
|---|---|---|---|---|
| `/obj/item/paper` | `machine_stat` set | none | none | returns, the paper is not taken (lib_machines.dm:604-606, 613-614) |
| `/obj/item/paper` | `busy` | none | "<span class='warning'>The book binder is busy. Please wait for completion of previous operation.</span>" (:615-616) | refused |
| `/obj/item/paper` | not busy and powered | none to load; then `sleep(rand(200,400))` (:623) | "<span class='notice'>[user] loads some paper into [src].</span>" / "<span class='notice'>You load some paper into [src].</span>" (:620); audible "<span class='hear'>[src] begins to hum as it warms up its printing drums.</span>" (:621) | `busy = TRUE` (:622); the paper is `transferItemToLoc`'d into the machine (:618); after the wait `busy = FALSE` (:624) |
| paper, after the wait, still powered | none | none | "<span class='notice'>[src] whirs as it prints and binds a new book.</span>" (:626-627) | `new /obj/item/book(src.loc)` (:628); `B.dat = P.info` (:629); `B.name = "Print Job #" + "[rand(100, 999)]"` (:630); `B.icon_state = "book[rand(1,7)]"` (:631); `qdel(P)` (:632) |
| paper, after the wait, no longer powered or broken | none | none | none | `P.forceMove(drop_location())` (:633-634); the paper comes back unprinted |
| Wrench (TOOL_WRENCH) | `default_unfasten_wrench` (floor or anchored) | 20 (default `time`, _machinery.dm:475) | "You begin [un]securing book binder..." / "You [un]secure book binder." (rendered from _machinery.dm:481, 486) | toggles `anchored` (_machinery.dm:487); `return 1` (lib_machines.dm:607-608) |
| any other item | none | none | none | `return ..()` (:609-610) |

Construction chain: none. No frame, no circuit board, no wallframe (lib_machines.dm:596-635 only).

Deconstruction chain: none by tool. Only the wrench is handled. Nothing else takes it apart.

Drops:
- (a) Destroyed (integrity 0): `obj_destruction` calls `deconstruct(FALSE)` (obj_defense.dm:252-258). There is no `on_deconstruction` or frame for this type, so `deconstruct` (_machinery.dm:402-410) only runs `qdel`. Destroy's `dropContents()` moves whatever is inside (`contents`) to the floor (_machinery.dm:171, 201-210). So paper that is in the middle of a print job drops to the floor. Nothing else is left behind.
- (b) No proper deconstruction exists. The wrench only unanchors it.

Health / armor: `max_integrity` inherited 200 (_machinery.dm:93). `armor` defaults (_machinery.dm:137). `integrity_failure = 0`, `damage_deflection = 0` (objs.dm:19, 21).

Power: none set. Inherits idle 0 and active 0 (_machinery.dm:106-107). The machine draws no power by its own definition.

Gotchas:
- `bind_book` calls `sleep(rand(200,400))` (lib_machines.dm:623), so 200 to 400 ds (20 to 40 seconds) of the player's attack call is spent inside the proc. The result is random.
- Only paper (`/obj/item/paper`) goes in. The book copies the paper's text (`P.info`, :629) but not its name. The book's name is always "Print Job #" plus a random number 100 to 999 (:630).
- The `busy` check comes before the paper is taken (:615-618), so a second sheet is refused while one is printing.
- When unpowered or broken the paper is refused before the job starts (:613-614). If the machine loses power during the wait, the paper comes back unprinted (:633-634).
- No access check. `desc` says "Only intended for binding paper products." (:600), and nothing enforces that beyond the paper type check.

# gap-things-02, part 5: booze dispenser

One list entry, a child of the chem dispenser family. Paths relative to `_src/tg2020`. File key as in parts 1-4, plus: `chem_dispenser.dm` = code/modules/reagents/chemistry/machinery/chem_dispenser.dm; `cell.dm` = code/modules/power/cell.dm.

Parents: `/obj/machinery/chem_dispenser` (chem_dispenser.dm:14) is the base, `/obj/machinery/chem_dispenser/drinks` (chem_dispenser.dm:440) is the soda/booze parent, and `/obj/machinery/chem_dispenser/drinks/beer` (chem_dispenser.dm:504) is the entry. The machine is TGUI (`ChemDispenser`, chem_dispenser.dm:174-181). Inherited machine rules are in part 1.

### booze dispenser  `/obj/machinery/chem_dispenser/drinks/beer`   (code/modules/reagents/chemistry/machinery/chem_dispenser.dm:504)
- What it is: a dispenser that fills an open container (beaker or glass) from a fixed list of alcoholic drinks, drawing on its internal power cell. BoxStation has 2 (list count).
- Key vars (beer child): `name = "booze dispenser"` (chem_dispenser.dm:505); `desc = "Contains a large reservoir of the good stuff."` (:506); `icon = 'icons/obj/chemical.dmi'` (:507); `icon_state = "booze_dispenser"` (:508); `circuit = /obj/item/circuitboard/machine/chem_dispenser/drinks/beer` (:509); `upgrade_reagents = null` (:531).
- Key vars (inherited from `/obj/machinery/chem_dispenser/drinks`, chem_dispenser.dm:440-452): `has_panel_overlay = FALSE` (:445), so no panel overlay is drawn; `amount = 10` (:446), the default dispense amount; `pixel_y = 6` (:447); `layer = WALL_OBJ_LAYER` (:448); `working_state = null` and `nopower_state = null` (:450-451), so there is no work or no-power flick; `pass_flags = PASSTABLE` (:452).
- Key vars (inherited from `/obj/machinery/chem_dispenser`, chem_dispenser.dm:14-37): `density = TRUE` (:17); `use_power = IDLE_POWER_USE` (:20); `idle_power_usage = 40` (:21); `interaction_flags_machine = INTERACT_MACHINE_OPEN | INTERACT_MACHINE_ALLOW_SILICON | INTERACT_MACHINE_OFFLINE` (:22), so the UI opens even when the machine is offline; `resistance_flags = FIRE_PROOF | ACID_PROOF` (:23); `circuit = /obj/item/circuitboard/machine/chem_dispenser` (:24, overridden by the drinks and beer children); `ui_x = 565`, `ui_y = 620` (:25-26); `powerefficiency = 0.1` (:29); `recharge_amount = 10` (:31); `beaker = null` (:37).
- Dispensable reagents (chem_dispenser.dm:510-530), 19 entries: `consumable/ethanol/beer`, `kahlua`, `whiskey`, `wine`, `vodka`, `gin`, `rum`, `tequila`, `vermouth`, `cognac`, `ale`, `absinthe`, `hcider`, `creme_de_menthe`, `creme_de_cacao`, `creme_de_coconut`, `triple_sec`, `sake`, `applejack`.
- Emagged reagents (chem_dispenser.dm:532-538), added by `emag_act`: `consumable/ethanol`, `iron`, `toxin/minttoxin`, `consumable/ethanol/atomicbomb`, `consumable/ethanol/fernet`.
- Health / armor: `max_integrity` 200 (inherited, _machinery.dm:93). No `armor` is set, so the default list applies (_machinery.dm:137): melee 25, bullet 10, laser 10, energy 0, bomb 0, bio 0, rad 0, fire 50, acid 70. `integrity_failure = 0`, `damage_deflection = 0` (objs.dm:19, 21).

Interactions:

| held item / action | condition | delay (ds) | message(s) verbatim | result (file:line) |
|---|---|---|---|---|
| Wrench (TOOL_WRENCH) | `default_unfasten_wrench` (floor or anchored) | 20 (default `time`, _machinery.dm:475) | "You begin unsecuring booze dispenser..." / "You unsecure booze dispenser." when anchored (rendered from _machinery.dm:481, 486) | toggles `anchored` (_machinery.dm:487); the attack returns (chem_dispenser.dm:331-332) |
| Screwdriver (TOOL_SCREWDRIVER) | none, no access check | none | "You open the maintenance hatch of booze dispenser." / "You close the maintenance hatch of booze dispenser." (rendered from _machinery.dm:453, 457) | toggles `panel_open` (_machinery.dm:447-459); `update_icon()` (chem_dispenser.dm:333-334) |
| Crowbar (TOOL_CROWBAR) | `panel_open` | none; sound 50 (_machinery.dm:399) | none | `deconstruct(TRUE)` (chem_dispenser.dm:336-337; _machinery.dm:396-400). See Drops |
| Open reagent container (`/obj/item/reagent_containers`, `is_open_container()`, not `ABSTRACT`) | none; the harm-intent check does not apply to this branch | none | "You add [B] to [src]." (chem_dispenser.dm:344) | `transferItemToLoc` (:341); `replace_beaker(user, B)` (:343): the old beaker goes to the user's hands (:392-396); `updateUsrDialog()` (:345) |
| Any other item, intent not harm, not an emag card | none | none | "<span class='warning'>You can't load [I] into [src]!</span>" (chem_dispenser.dm:347) | `return ..()` (:348) |
| Emag card, or any item on harm intent | none | none | none | `return ..()` (:349-350) |
| `emag_act` (emag) | not already `EMAGGED` | none | "<span class='notice'>You short out [src]'s safeties.</span>" (chem_dispenser.dm:149); if already emagged, "<span class='warning'>[src] has no functional safeties to emag.</span>" (:147) | `dispensable_reagents |= emagged_reagents` (:150); `obj_flags |= EMAGGED` (:151) |
| AltClick | `can_interact(user)` and `canUseTopic(src, BE_CLOSE, FALSE, NO_TK)` (chem_dispenser.dm:407-410) | none | none | `replace_beaker(user)` (:411): old beaker to hands. The drinks children also rotate on AltClick (`simple_rotation`, chem_dispenser.dm:415); the source does not say which runs first |
| UI `amount` | `is_operational()` and a beaker present | none | none | `amount = target` if `target` is in `beaker.possible_transfer_amounts` (chem_dispenser.dm:228-235) |
| UI `dispense` | `is_operational()`, a cell present, not recording | none | "[src] says: Not enough energy to complete operation!" when the cell is too low (chem_dispenser.dm:248, by `say`) | with a beaker, and the reagent in `dispensable_reagents`: `actual = min(amount, (cell.charge * powerefficiency) * 10, free)` (:245); `cell.use(actual / powerefficiency)` (:247); `R.add_reagent(reagent, actual)` (:250). Without a beaker or with a non-dispensable reagent, nothing happens (:242) |
| UI `remove` | `is_operational()`, not recording | none | none | `beaker.reagents.remove_all(amount)` if `amount` is in `possible_transfer_amounts` (chem_dispenser.dm:256-263) |
| UI `eject` | none, **not gated by `is_operational()`** | none | none | `replace_beaker(usr)` (chem_dispenser.dm:264-266) |
| UI `dispense_recipe` | `is_operational()`, a cell present | none | as `dispense` | each saved reagent is dispensed the same way; a non-dispensable reagent returns silently (chem_dispenser.dm:267-292) |
| UI `clear_recipes` | `is_operational()` | none | `alert("Clear all recipes?")`, Yes or No (:296) | clears `saved_recipes` (:298) |
| UI `record_recipe` / `cancel_recording` | `is_operational()` | none | none | start or drop the recording (:300-304, :324-328) |
| UI `save_recording` | `is_operational()`; name entered | none | on an unknown reagent: "<span class='warning'>[src] buzzes.</span>" and "<span class='hear'>You hear a faint buzz.</span>" (chem_dispenser.dm:317); "<span class='danger'>[src] cannot find <b>[reagent]</b>!</span>" (:318); `playsound(src, 'sound/machines/buzz-two.ogg', 50, TRUE)` (:319) | stores `saved_recipes[name]` (:321) and clears the recording (:322) |

- UI data (chem_dispenser.dm:183-222): energy shown as `cell.charge * powerefficiency`, max as `cell.maxcharge * powerefficiency`; the current beaker's contents and volumes; the dispensable list. While hallucinating, 5% of names are replaced (:215-216).
- Examine (chem_dispenser.dm:102-109): "<span class='notice'>[src]'s maintenance hatch is open!</span>" when the panel is open. In range or as an observer: "Recharging <b>[recharge_amount]</b> power units per interval." and "Power efficiency increased by <b>[round((powerefficiency*1000)-100, 1)]%</b>."
- Recharge (chem_dispenser.dm:111-120, the machine's `process`). The counter goes up on each call. On the fifth call (when the counter is at 4), if operational, `cell.give(recharge_amount)` runs and `use_power(250 * recharge_amount)` runs if any charge was given (:115-117). The counter then resets. The machine's process period is about 2 seconds (_machinery.dm:120 comment), so one interval is about 10 seconds (inferred).

Construction chain (frame-built; the board is a child of the chem board, so it inherits its requirements):
1. 5 × metal sheet, stack recipe "machine frame" (sheet_types.dm:52, `GLOBAL_LIST_INIT(metal_recipes)` at sheet_types.dm:17). Makes a `/obj/structure/frame/machine` in state 1 (constructable_frame.dm:8, 25). Full steps are in part 3, steps 1-3 (metal, wrench to anchor, five cable coils to state 2).
2. Frame state 2, circuit board `/obj/item/circuitboard/machine/chem_dispenser/drinks/beer` (machine_circuitboards.dm:995-998, "Booze Dispenser (Machine Board)"; `build_path = /obj/machinery/chem_dispenser/drinks/beer`, :998). It inherits `req_components` and `needs_anchored` from `/obj/item/circuitboard/machine/chem_dispenser` (machine_circuitboards.dm:616-627), and the child does not override them. "You add the circuit board to the frame." (constructable_frame.dm:131). `needs_anchored = FALSE` (machine_circuitboards.dm:627), so the frame does not need to be anchored first (constructable_frame.dm:125).
   - Required parts (machine_circuitboards.dm:620-625): `/obj/item/stock_parts/matter_bin = 2`, `/obj/item/stock_parts/capacitor = 1`, `/obj/item/stock_parts/manipulator = 1`, `/obj/item/stack/sheet/glass = 1`, `/obj/item/stock_parts/cell = 1`.
3. Frame state 3: each part is inserted with "You add [P] to [src]." (constructable_frame.dm:265). The glass is taken as a stack (:247-261). A part replacer can apply parts in one use: "[part.name] applied." (:239). Any `/obj/item/stock_parts/cell` satisfies the cell requirement (`istype`). `def_components` (machine_circuitboards.dm:626, the high-capacity cell) is not applied on this path, because `apply_default_parts` runs only for map-placed machines (_machinery.dm:141-143).
4. Frame state 3, screwdriver, when all counts are 0: `new circuit.build_path(loc)` (constructable_frame.dm:186), parts moved into `component_parts` (:192-197), `RefreshParts()` (:199), frame qdel'd (:200). No message is sent on this path (:178-185).

Deconstruction chain:
1. Beaker out: the UI `eject`, AltClick, or the destruction path below. The beaker is not removed by a tool.
2. Screwdriver: opens the hatch (chem_dispenser.dm:333-335).
3. Crowbar with the hatch open: `deconstruct(TRUE)` (chem_dispenser.dm:336-337; _machinery.dm:396-400). `on_deconstruction` runs first (see Drops).

Drops:
- `on_deconstruction` (chem_dispenser.dm:400-405), which runs for both destroyed and deconstructed machines (_machinery.dm:402-404): `cell = null`, then the beaker, if any, is `forceMove`d to `drop_location()` (:402-404). Then the parent deconstruct runs.
- (a) Destroyed (integrity 0): `obj_destruction` calls `deconstruct(FALSE)` (obj_defense.dm:252-258). `spawn_frame(FALSE)` makes a `/obj/structure/frame/machine` at 50% integrity, state 2, icon "box_1" (_machinery.dm:412-420). Then every object in `component_parts` goes to the floor (_machinery.dm:405-409): the circuit board (put in `component_parts` by `apply_default_parts`, circuitboard.dm:39), 2 matter bins, the capacitor, the manipulator, the glass stack, and the cell (which `on_deconstruction` detached from `cell` but which is still in `component_parts`). Then `qdel`, and `Destroy` finds `beaker` and `cell` already null (chem_dispenser.dm:97-100). Nothing is deleted.
- (b) Deconstructed (hatch open, crowbar): the same items. The frame is at full integrity (the half-integrity line, _machinery.dm:416-417, is skipped).

Power:
- Idle `idle_power_usage = 40` (chem_dispenser.dm:21), on the default `AREA_USAGE_EQUIP` channel (_machinery.dm:108). The source gives no unit.
- Recharge: `recharge_amount = 10` (chem_dispenser.dm:31), multiplied by each capacitor's rating (`RefreshParts`, chem_dispenser.dm:376-383), so 10 with a base capacitor. Each recharge uses `250 * recharge_amount` = 2500 (chem_dispenser.dm:117).
- Dispensing draws from the internal cell, not the area: `cell.use(actual / powerefficiency)` (chem_dispenser.dm:247). With `powerefficiency` 0.1 (chem_dispenser.dm:29), each reagent unit costs 10 cell units (inferred from :245-247).
- `powerefficiency = round(0.0666666 + 0.0166666666 × Σ matter-bin rating, 0.01)` (chem_dispenser.dm:377-381, :387). Two base bins give 0.1.
- The map-placed machine gets `cell/high` from `def_components` (machine_circuitboards.dm:626; circuitboard.dm:47-48), `maxcharge = 10000` (cell.dm:249-252). The energy display max is therefore `10000 * 0.1 = 1000` (chem_dispenser.dm:186-187).

Gotchas:
- Only the 19 listed reagents can be dispensed. Anything else is ignored silently (chem_dispenser.dm:242, 276).
- The dispense amount is capped by the beaker's `possible_transfer_amounts` for `amount` (chem_dispenser.dm:232), and by the free space in the beaker (:244, :282).
- No beaker, no dispense, and no message (chem_dispenser.dm:242, 279-280).
- The UI opens when the machine is offline (`INTERACT_MACHINE_OFFLINE`, chem_dispenser.dm:22), and `eject` works without power (chem_dispenser.dm:264-266). Only dispensing, `amount`, `remove` and recipes need power.
- The emag adds the five emagged reagents to `dispensable_reagents` for good (chem_dispenser.dm:150). The reagent list is stored on the instance.
- `upgrade_reagents = null` (chem_dispenser.dm:531), so a tier 4 manipulator adds nothing (chem_dispenser.dm:384-386).
- While unpowered the recharge stops and the counter is not reset (chem_dispenser.dm:113-114), so the recharge starts again at once when power returns (inferred).
- No access check on any control. The screwdriver and the wrench work for anyone.

# gap-things-02, part 6: announcement system, blackbox recorder, bluespace gigabeacon, ticket counter button

Four list entries. Paths relative to `_src/tg2020`. File key as in parts 1-5, plus: `announcement_system.dm` = code/game/machinery/announcement_system.dm; `message_server.dm` = code/game/machinery/telecomms/machines/message_server.dm; `Beacon.dm` = code/game/machinery/Beacon.dm; `beacon.dm` = code/game/objects/items/devices/beacon.dm; `ticketmachine.dm` = code/modules/paperwork/ticketmachine.dm; `arrivals.dm` = code/modules/shuttle/arrivals.dm; `_job.dm` = code/modules/jobs/job_types/_job.dm; `game.dm` (helpers) = code/__HELPERS/game.dm.

Parent for all four: `/obj/machinery` (code/game/machinery/_machinery.dm:86), except the ticket counter button, whose parent is `/obj/machinery/button` (buttons.dm:1; see part 1 for that block).

### Automated Announcement System  `/obj/machinery/announcement_system`   (code/game/machinery/announcement_system.dm:3)
- What it is: a wall-mounted speaker that announces arrivals, new heads and broken arrivals shuttles over a silicon radio headset. BoxStation has 1 (list count). The list name "Automated Announcement System" comes from `name = "\improper Automated Announcement System"` (announcement_system.dm:5).
- Key vars: `density = TRUE` (:4); `desc = "An automated announcement system that handles minor announcements over the radio."` (:6); `icon = 'icons/obj/machines/telecomms.dmi'` (:7); `icon_state = "AAS_On"` (:8); `verb_say = "coldly states"`, `verb_ask = "queries"`, `verb_exclaim = "alarms"` (:10-12); `circuit = /obj/item/circuitboard/machine/announcement_system` (:17).
- Power: `idle_power_usage = 20` (:14); `active_power_usage = 50` (:15). The file never calls `use_power`, so only the idle figure is drawn (through `auto_use_power`, _machinery.dm:238-244, inferred). Channel `AREA_USAGE_EQUIP` (inherited, _machinery.dm:108).
- Messages (vars): `arrival = "%PERSON has signed up as %RANK"` (:20), `arrivalToggle = 1` (:21); `newhead = "%PERSON, %RANK, is the department head."` (:22), `newheadToggle = 1` (:23). Light overlays `"Light_Green"` (:25), `"Light_Pink"` (:26), `"Error_Red"` (:27).
- `radio = new /obj/item/radio/headset/silicon/ai(src)` in Initialize (:32), and `GLOB.announcement_systems += src` (:31).
- Health / armor: `max_integrity` 200 (inherited, _machinery.dm:93). No `armor` is set, so the default list applies (_machinery.dm:137). `integrity_failure = 0` (objs.dm:19), so damage never sets `BROKEN`; `act_up` sets it directly (see below).

Interactions:

| held item / action | condition | delay (ds) | message(s) verbatim | result (file:line) |
|---|---|---|---|---|
| Screwdriver (TOOL_SCREWDRIVER) | none, no access check | none; `play_tool_sound` at default volume (:59) | "<span class='notice'>You [panel_open ? "open" : "close"] the maintenance hatch of [src].</span>" (:61) | toggles `panel_open` (:60); `update_icon()` (:62). Note: this message is written here, not the `_machinery.dm` helper |
| Crowbar (TOOL_CROWBAR) | `panel_open` | none; sound 50 (_machinery.dm:399) | none | `default_deconstruction_crowbar(P)` gives `deconstruct(TRUE)` (:63-64; _machinery.dm:396-400) |
| Multitool (TOOL_MULTITOOL) | `panel_open` and `BROKEN` | none | "<span class='notice'>You reset [src]'s firmware.</span>" (:66) | clears `BROKEN` (:67); `update_icon()` (:68) |
| Any other item | none | none | none | `return ..()` (:69-70) |
| `ui_act` (TGUI "AutomatedAnnouncement", 500 x 225, :98-103) | `usr.canUseTopic` (:117); not `BROKEN` | none | when `BROKEN`: "<span class='warning'>[src] buzzes.</span>" and "<span class='hear'>You hear a faint buzz.</span>", plus `playsound(src.loc, 'sound/machines/buzz-two.ogg', 50, TRUE)` (:119-121) | returns with no change |
| `ui_act` `ArrivalText` | not `BROKEN` | none | none | `arrival = trim(html_encode(newText), MAX_MESSAGE_LEN)` if not empty (:124-130); `log_game` (:130) |
| `ui_act` `NewheadText` | not `BROKEN` | none | none | `newhead` set the same way (:131-137); `log_game` (:137) |
| `ui_act` `NewheadToggle` / `ArrivalToggle` | not `BROKEN` | none | none | flips `newheadToggle` / `arrivalToggle`, `update_icon()` (:138-143) |
| `attack_ai` / `attack_robot` | `canUseTopic` (:150) | none | "<span class='warning'>[src]'s firmware appears to be malfunctioning!</span>" when `BROKEN` (:152-154) | opens the UI with `interact(user)` (:155); `attack_robot` calls `attack_ai` (:146-147) |
| `emp_act` | not `NOPOWER\|BROKEN`, and not `EMP_PROTECT_SELF` (:166) | none | none | `act_up()` (:167) |
| `emag_act` | not already `EMAGGED` (:170) | none | none | sets `EMAGGED` (:172); `act_up()` (:173) |

- `act_up` (:157-162): `obj_break()` must succeed, which sets `BROKEN` (_machinery.dm:422-429). Then `arrival` becomes one of three random error strings and `newhead` one of three (:161-162). The strings are quoted in the source.
- `announce(message_type, user, rank, list/channels)` (:77-94): returns unless `is_operational()`. `"ARRIVAL"` uses `arrival` when `arrivalToggle` is set; `"NEWHEAD"` uses `newhead` when `newheadToggle` is set; `"ARRIVALS_BROKEN"` sends "The arrivals shuttle has been damaged. Docking for repairs..." (:88). `CompileText` replaces `%PERSON` and `%RANK` (:72-75). With no channels it talks on the radio's default channel; otherwise once per channel (:90-94).
- Callers: a new head at round start, `_job.dm:149-151`; the arrivals shuttle damaged, `arrivals.dm:82-85`; a late-joining crew member, `game.dm` helpers lines 522-528 ("ARRIVAL").

Construction chain (frame-built, `circuit` set):
1. 5 × metal, "machine frame" (sheet_types.dm:52), state 1 frame (constructable_frame.dm:25). Steps 2-3 as in part 3 (wrench to anchor, five cable coils to state 2).
2. Frame state 2: circuit board `/obj/item/circuitboard/machine/announcement_system` (machine_circuitboards.dm:38-44, "Announcement System (Machine Board)"; `build_path = /obj/machinery/announcement_system`, :41). `needs_anchored` is not overridden, so it stays TRUE (circuitboard.dm:27). The frame must be anchored (constructable_frame.dm:125-127). Then "You add the circuit board to the frame." (constructable_frame.dm:131); state 3.
   - Required parts (machine_circuitboards.dm:42-44): `/obj/item/stack/cable_coil = 2`, `/obj/item/stack/sheet/glass = 1`.
3. Frame state 3: cable coil and glass are taken as stacks (constructable_frame.dm:247-261). Each adds "You add [P] to [src]." (:261).
4. Frame state 3, screwdriver when all counts are 0: the machine is built (constructable_frame.dm:178-200), no message on this path.

Deconstruction chain:
1. Screwdriver: opens the hatch, with the custom message above (announcement_system.dm:57-62).
2. Crowbar with the hatch open: `deconstruct(TRUE)` (announcement_system.dm:63-64).

Drops:
- Map-placed machines get their board and parts from `apply_default_parts` (circuitboard.dm:35-56, _machinery.dm:141-143): the board, 2 cable coils (a stack of 2) and 1 glass sheet are in `component_parts`.
- (a) Destroyed (integrity 0): `obj_destruction` calls `deconstruct(FALSE)` (obj_defense.dm:252-258). `spawn_frame(FALSE)` makes a frame at 50% integrity, state 2 (_machinery.dm:412-420). The board, the cable stack and the glass stack are moved to the floor (_machinery.dm:405-409). Then `qdel`, and `Destroy` runs `QDEL_NULL(radio)` (announcement_system.dm:52-55), so **the internal AI headset is deleted, not dropped**.
- (b) Deconstructed (hatch open, crowbar): the same, with the frame at full integrity.

Health / armor: `max_integrity` 200 (inherited). Default armor from `_machinery.dm:137` (melee 25, bullet 10, laser 10, energy 0, bomb 0, bio 0, rad 0, fire 50, acid 70). `integrity_failure = 0`, `damage_deflection = 0` (objs.dm:19, 21).

Gotchas:
- Anyone with a screwdriver can open the hatch; the UI has no access check, only the `canUseTopic` check (announcement_system.dm:117, 150).
- EMP or the emag call `act_up` and scramble both messages (announcement_system.dm:164-173). The emag can be used only once (`EMAGGED` check, :170).
- `ArrivalText` and `NewheadText` are not checked against the list of allowed text, so any player at the UI can change the announcement text (:124-137).
- While `BROKEN` the UI buzzes and does nothing (:119-122). A multitool with the hatch open clears the state (:65-68).

### blackbox recorder  `/obj/machinery/blackbox_recorder`   (code/game/machinery/telecomms/machines/message_server.dm:9)
- What it is: a decorative cabinet that holds the blackbox item (`/obj/item/blackbox`, the traitor theft item), and shows whether the tapes are spinning. BoxStation has 1 (list count).
- Key vars: `icon = 'icons/obj/stationobjs.dmi'` (:10); `icon_state = "blackbox"` (:11); `name = "Blackbox Recorder"` (:12); `density = TRUE` (:13); `use_power = IDLE_POWER_USE` (:14); `idle_power_usage = 10` (:15); `active_power_usage = 100` (:16); `var/obj/item/stored` (:18).
- `armor = list("melee" = 25, "bullet" = 10, "laser" = 10, "energy" = 0, "bomb" = 0, "bio" = 0, "rad" = 0, "fire" = 50, "acid" = 70)` (:17) — the same values as the machine default (_machinery.dm:137).
- `Initialize` creates the blackbox inside the machine: `stored = new /obj/item/blackbox(src)` (:20-22).
- Blackbox item (message_server.dm:62-70): `name = "\proper the blackbox"` (:63); `desc = "A strange relic, capable of recording data on extradimensional vertices. It lives inside the blackbox recorder for safe keeping."` (:64); `icon_state = "blackcube"` (:66); `w_class = WEIGHT_CLASS_BULKY` (:69); `resistance_flags = INDESTRUCTIBLE | LAVA_PROOF | FIRE_PROOF | ACID_PROOF` (:70).

Interactions:

| held item / action | condition | delay (ds) | message(s) verbatim | result (file:line) |
|---|---|---|---|---|
| `attack_hand` | `stored` set | none | "<span class='notice'>You remove the blackbox from [src]. The tapes stop spinning.</span>" (:29) | `user.put_in_hands(stored)`; `stored = null` (:27-28); `update_icon()` (:30) |
| `attack_hand` | `stored` empty | none | "<span class='warning'>It seems that the blackbox is missing...</span>" (:33) | nothing (:34) |
| Blackbox item | `HAS_TRAIT(I, TRAIT_NODROP)` or the item cannot leave the hand | none | "<span class='warning'>[I] is stuck to your hand!</span>" (:38-39) | refused (:40) |
| Blackbox item | not stuck | none | "<span class='notice'>[user] clicks [I] into [src]!</span>" (:41); "<span class='notice'>You press the device into [src], and it clicks into place. The tapes begin spinning again.</span>" (:42) | `playsound(src, 'sound/machines/click.ogg', 50, TRUE)` (:43); `stored = I` (:44); `update_icon()` (:45) |
| Any other item | none | none | none | `return ..()` (:47) |

- `update_icon` (:55-60): with no blackbox, icon "blackbox_b" (tapes stopped); with one, "blackbox" (tapes spinning).

Construction chain: none. No circuit board, frame, or wallframe refers to the type (a grep for the type name finds only `message_server.dm`).

Deconstruction chain: none by tool. No wrench, screwdriver or crowbar branch is defined in the file.

Drops:
- (a) Destroyed (integrity 0): `Destroy` moves the blackbox out first, `stored.forceMove(loc)`, and spawns an oil puddle, `new /obj/effect/decal/cleanable/oil(loc)` (message_server.dm:49-53). Then the parent `Destroy`. There is no frame and no `component_parts`. The blackbox is indestructible, so it comes out intact.
- (b) No proper deconstruction exists.

Health / armor: `max_integrity` 200 (inherited, _machinery.dm:93). `armor` as in the key vars above. `integrity_failure = 0` (objs.dm:19).

Power: `use_power = IDLE_POWER_USE`, `idle_power_usage = 10`, `active_power_usage = 100` (message_server.dm:14-16). The file never calls `use_power`, so only the idle figure is ever drawn (inferred, same as the announcement system).

Gotchas:
- Anyone can take the blackbox out with a click, with no access check (message_server.dm:24-31).
- A blackbox removed from the cabinet is a "traitor theft item" (message_server.dm:8 comment). Nothing in this file stops a player carrying it away.
- The `TRAIT_NODROP` check is the only restriction on putting the blackbox back (:38).

### bluespace gigabeacon  `/obj/machinery/bluespace_beacon`   (code/game/machinery/Beacon.dm:1)
- What it is: a floor machine that keeps an invisible tracking beacon (`/obj/item/beacon`, a teleporter target) on its own turf. The description says it "draws power from bluespace", but nothing in the file draws power. BoxStation has 1 (list count).
- Key vars: `icon = 'icons/obj/objects.dmi'` (Beacon.dm:3); `icon_state = "floor_beaconf"` (:4); `name = "bluespace gigabeacon"` (:5); `desc = "A device that draws power from bluespace and creates a permanent tracking beacon."` (:6); `layer = LOW_OBJ_LAYER` (:7); `use_power = IDLE_POWER_USE` (:8); `idle_power_usage = 0` (:9); `var/obj/item/beacon/Beacon` (:10).
- Initialize (:12-18): `Beacon = new(T)` on the machine's turf (:14-15); `Beacon.invisibility = INVISIBILITY_MAXIMUM` (:16); `AddElement(/datum/element/undertile, TRAIT_T_RAY_VISIBLE)` (:18).
- Destroy (:20-22): `QDEL_NULL(Beacon)`.
- Process (:24-30): if `Beacon` is gone, it makes a new invisible one on `loc` (:25-28); otherwise, if the beacon is not on `loc`, it moves it there (:29-30).
- Tracking beacon item (devices/beacon.dm:1-20): `name = "\improper tracking beacon"` (:2); `desc = "A beacon used by a teleporter."` (:3); `enabled = TRUE` (:9); added to `GLOB.teleportbeacons` on Initialize (:14-15) and removed on Destroy (:19-20).

Interactions: none. The file defines no `attackby`, `attack_hand` or `ui_interact`. The machine has no interaction at all.

Construction chain: none. No circuit board or frame refers to the type. `/obj/item/circuitboard/machine/bluespace_beacon` is not defined (a `tgwhere` search finds only the parent type, circuitboard.dm:26).

Deconstruction chain: none by tool.

Drops:
- Destroyed: `deconstruct` (inherited from `/obj/machinery`, _machinery.dm:402-410) runs `qdel`. `Destroy` deletes the tracking beacon (Beacon.dm:20-22). Nothing else is dropped, and no frame is made (no `component_parts`).
- Deconstructed: no path.

Health / armor: `max_integrity` 200 (inherited, _machinery.dm:93). Default armor (_machinery.dm:137). `integrity_failure = 0`.

Power: `use_power = IDLE_POWER_USE` with `idle_power_usage = 0` (Beacon.dm:8-9). It draws nothing by its own definition.

Gotchas:
- The tracking beacon has `invisibility = INVISIBILITY_MAXIMUM` (Beacon.dm:16, 28), so players cannot see or click it. The machine's `process` puts it back within one machine tick if it is deleted (Beacon.dm:24-28). The beacon follows the machine if the machine moves (Beacon.dm:29-30).
- Destroying the gigabeacon removes its teleporter target for good (`QDEL_NULL`, Beacon.dm:20-22; `GLOB.teleportbeacons` removal, beacon.dm:19-20). Nothing rebuilds it except the machine itself, which is gone.
- The machine itself sits on `LOW_OBJ_LAYER` (Beacon.dm:7). The `undertile` element with `TRAIT_T_RAY_VISIBLE` is added in Initialize (Beacon.dm:18).

### ticket counter button  `/obj/machinery/button/ticket_machine`   (code/modules/paperwork/ticketmachine.dm:64)
- What it is: a button that, when pressed, calls the next ticket on the linked ticket machine. It is a child of the button base in part 1 (buttons.dm:1). BoxStation has 1 (list count).
- Key vars (child): `name = "increment ticket counter"` (ticketmachine.dm:65); `desc = "Use this button after you've served someone to tell the next person to come forward."` (:66); `device_type = /obj/item/assembly/control/ticket_machine` (:67); `req_access = list()` (:68), so no access is needed; `id = "ticket_machine_default"` (:69).
- Inherited from the button base: `armor`, `use_power`, `idle_power_usage`, `resistance_flags`, `max_integrity` (buttons.dm:13-16; _machinery.dm:93), as in part 1. The `req_access` is empty, so `allowed()` is always TRUE (access.dm:76-77), and no board is created (buttons.dm:36).
- Initialize (ticketmachine.dm:71-75): after the parent, `device.id = id` on the controller.
- Controller device: `/obj/item/assembly/control/ticket_machine` (ticketmachine.dm:89-92), with `linked` (the ticket machine it drives, :92). `LateInitialize` finds a `/obj/machinery/ticket_machine` whose `id` matches (:98-108).

Interactions:

| held item / action | condition | delay (ds) | message(s) verbatim | result (file:line) |
|---|---|---|---|---|
| `attack_hand` (press) | powered and not broken (buttons.dm:163-164); `allowed` always TRUE | `device.pulsed()` runs at once (buttons.dm:177-178) | none | `use_power(5)` (buttons.dm:174); `icon_state` flicker; `device.pulsed()` |
| controller `activate()` | not on cooldown; `linked` set (ticketmachine.dm:111-114) | cooldown 10 ds (ticketmachine.dm:117) | none (the next line of text is from `increment`) | `linked.increment()` (:116) |
| `increment()` on the ticket machine (ticketmachine.dm:50-62) | `current_number <= ticket_number` (:51-52) | none | "<span class='notice'>\the [ticket] disperses!</span>" when the served ticket is removed, unless `EMAGGED` (:53-54); "Now serving ticket #[current_number]!" via `say` (:59); "<span class='notice'>\the [ticket] vibrates!</span>" for the next ticket, unless `EMAGGED` (:60-61) | sound 'sound/misc/announce_dig.ogg' 50, `FALSE` (:58); `current_number++` (:57); `update_icon()` (:62) |
| Multitool, with a buffer that is not a ticket machine | `M.buffer` set and not a `/obj/machinery/ticket_machine` (ticketmachine.dm:80-82) | none | none | `return`, nothing linked |
| Multitool, otherwise (ticketmachine.dm:77-88) | none | none | "<span class='warning'>You've linked [src] to [controller.linked].</span>" (:87) | `controller.linked = M.buffer` (:84); button `id = null` and controller `id = null` (:85-86). The link is by object, not by id |

- The `increment` path uses `say()`, so the message is spoken by the ticket machine, not shown as text on the button.

Construction chain: none for the button. It is a map-placed button. Its wallframe is the plain button frame (`/obj/item/wallframe/button`, buttons.dm:285-290), which builds a plain button, not a ticket button (buttons.dm:289).

Deconstruction chain: as in part 1 (the button family). Screwdriver opens the panel. With the panel open, `attack_hand` takes the controller out (`device`, buttons.dm:144-146) and then the wrench, 40 ds, gives back the wallframe (buttons.dm:92-99). No board is present to remove (no `req_access`, buttons.dm:36).

Drops:
- Destroyed: `deconstruct(FALSE)` (obj_defense.dm:252-258). The machinery path moves `device` (the controller) to the floor (`dropContents`, _machinery.dm:171, 201-210). No wallframe is dropped.
- Deconstructed properly: the controller comes out by hand first (buttons.dm:144-146), then the wrench drops `/obj/item/wallframe/button` (buttons.dm:97).

Health / armor: as the button base (`max_integrity` 200, buttons.dm:13 armor, `integrity_failure = 0`).

Power: `idle_power_usage = 2` with `use_power = IDLE_POWER_USE` (buttons.dm:14-15); each press `use_power(5)` (buttons.dm:174), on `AREA_USAGE_ENVIRON` (buttons.dm:7). The numbers are passed through unchanged; the source gives no unit.

Gotchas:
- The button needs power (`NOPOWER|BROKEN` returns silently, buttons.dm:163-164).
- The spam guard in the button base (`device.next_activate`, buttons.dm:166-167) never blocks this controller; its `activate()` override does not set `next_activate`. The 10 ds cooldown on the controller is the only limit (ticketmachine.dm:111-117; assembly.dm:77-80, inferred).
- A multitool with an empty buffer passes the buffer check (ticketmachine.dm:81) and still runs the link code, which sets `linked` to `null`, clears both ids, and prints "You've linked [src] to ." (inferred from the code; not run).
- With `EMAGGED` on the ticket machine, the "disperses" and "vibrates" messages are not sent (ticketmachine.dm:53, 60). This is inferred from the flags alone; the emag path is not traced here.

## Coverage

- List entries in `_todo3/gap-things-02.txt`: 14 (all in parts 1 to 6).
- Documented from real data: 14.
- NOT FOUND: 0.
- Paths located with `tools/tgwhere.py` but with no own definition in the output: none for the type paths. Two `tgwhere` lines are not list entries and are noted in the text instead:
  - `/obj/item/circuitboard/machine/blackbox_recorder`: NO OWN DEFINITION, nearest ancestor `/obj/item/circuitboard/machine` (circuitboard.dm:26). No such board exists in the tree (grep of `code/` finds no reference).
  - `/obj/item/circuitboard/machine/bluespace_beacon`: NO OWN DEFINITION, nearest ancestor `/obj/item/circuitboard/machine` (circuitboard.dm:26). Same result.
  - `/obj/machinery/embedded_controller/radio/airlock/incinerator_toxmix` (in part 1, a related controller and not a list entry): NO OWN DEFINITION, nearest ancestor `/obj/machinery/embedded_controller/radio` (code/game/machinery/embedded_controller/embedded_controller_base.dm:63). The real type is `/obj/machinery/embedded_controller/radio/airlock_controller/incinerator_toxmix` (airlock_controller.dm:214).
  - `/obj/machinery/chem_dispenser` `tgwhere` result pointed at code/modules/antagonists/swarmer/swarmer.dm:286; the base type is defined at code/modules/reagents/chemistry/machinery/chem_dispenser.dm:14, which is the location used.

