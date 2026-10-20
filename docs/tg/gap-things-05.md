# gap-things-05.1: Magnets and the mech bay recharge port

Two single-type machines, plus the shared machine rules that every later part in this shard refers back to. The magnet is radio-driven and has no build route at all. The mech bay port is built from a frame and a board, charges a parked mech through its linked power console, and only runs when that console is linked.

## Shared rules for every machine in this shard (read once)

All paths below use `code/game/machinery/_machinery.dm` (the `/obj/machinery` parent) unless a line says otherwise.

| Rule | Value | file:line |
|---|---|---|
| `max_integrity` on `/obj/machinery` | 200 | code/game/machinery/_machinery.dm:93 |
| `/obj` default `max_integrity` (overridden above) | 500 | code/game/objects/objs.dm:18 |
| Default `armor` when a type sets none | melee 25, bullet 10, laser 10, energy 0, bomb 0, bio 0, rad 0, fire 50, acid 70 | code/game/machinery/_machinery.dm:136-137 |
| `integrity_failure` (default) | 0, so damage never calls `obj_break` | code/game/objects/objs.dm:19, code/game/objects/obj_defense.dm:17-18 |
| `damage_deflection` (default) | 0 | code/game/objects/objs.dm:21 |
| Integrity 0 | `obj_destruction` → `deconstruct(FALSE)` (acid calls `acid_melt()`, fire calls `burn()`, and both then call `deconstruct(FALSE)`) | code/game/objects/obj_defense.dm:20-21, 252-258, 193-195, 211-214 |
| Machinery `deconstruct(disassembled)` | `on_deconstruction()`; if `component_parts` is non-empty: `spawn_frame(disassembled)`, then every part is moved to `loc`; then `qdel` | code/game/machinery/_machinery.dm:402-410 |
| `spawn_frame` | makes `/obj/structure/frame/machine`, copies `anchored`; if not disassembled, its `obj_integrity` = 50 % of its max; `state = 2`, icon `box_1` | code/game/machinery/_machinery.dm:412-420 |
| Frame max integrity | 250 (inherited from `/obj/structure/frame`) | code/game/machinery/constructable_frame.dm:6 |
| Power defaults | `use_power = IDLE_POWER_USE`, `idle_power_usage = 0`, `active_power_usage = 0` | code/game/machinery/_machinery.dm:102, 106-107 |
| `process()` tick | the DM comment says roughly 2 seconds; SSmachines uses the subsystem default `wait = 20` (ds) | code/game/machinery/_machinery.dm:120; code/controllers/subsystem.dm:20 (`machines.dm` does not override `wait`) |
| `use_power(amount, chan)` | passes `amount` to the area unchanged; the DM does not convert it | code/modules/power/power.dm:96-101 |
| SSmachines power loop | each fire calls `thing.process(seconds)`; if the result is not `PROCESS_KILL` and `use_power` is set, it calls `auto_use_power()`. `auto_use_power` draws `idle_power_usage` when `use_power == 1` and `active_power_usage` when `use_power >= 2` | code/controllers/subsystem/machines.dm:37-45; code/game/machinery/_machinery.dm:238-245 |
| Base `process()` | returns `PROCESS_KILL`, so a type that does not override `process()` is dropped from SSmachines and never gets `auto_use_power()` | code/game/machinery/_machinery.dm:181-182 |
| Examine (integrity words) | 50-99 %: `It looks slightly damaged.`; 25-50 %: `It appears heavily damaged.`; 0-25 %: `<span class='warning'>It's falling apart!</span>`; BROKEN: `It looks broken and non-functional.` | code/game/machinery/_machinery.dm:553-567 |

Shared helper procs used by the machines in this part (all `/obj/machinery/proc`):

| Proc | Works when | Delay (ds) | Message(s) verbatim | Result |
|---|---|---|---|---|
| `default_deconstruction_screwdriver` | `TOOL_SCREWDRIVER`, not NODECONSTRUCT_1 | none (no `use_tool`) | `You open the maintenance hatch of [src].` / `You close the maintenance hatch of [src].` (code/game/machinery/_machinery.dm:453, 457) | toggles `panel_open` and `icon_state` (open/closed names are passed by the caller); sound 50 (_machinery.dm:449) |
| `default_change_direction_wrench` | `TOOL_WRENCH`, `panel_open` only | none | `You rotate [src].` (_machinery.dm:465) | `setDir(turn(dir,-90))` (_machinery.dm:464) |
| `default_deconstruction_crowbar` | `TOOL_CROWBAR`, `panel_open` only (or `ignore_panel`) | none | none | sound 50 (_machinery.dm:399), then `deconstruct(TRUE)` (_machinery.dm:400) |

Frame (`/obj/structure/frame/machine`, code/game/machinery/constructable_frame.dm) is the build site. The frame is made from the metal sheet recipe `machine frame`: 5 metal sheets, `time = 25`, one per turf, on floor (code/game/objects/items/stacks/sheets/sheet_types.dm:52, recipe list `GLOBAL_LIST_INIT(metal_recipes` at :17, sheet type at :96).

| Frame state | Action | Delay (ds) | Message(s) verbatim | Result | file:line |
|---|---|---|---|---|---|
| 1 (bare, icon `box_0`) | screwdriver, not anchored | 40 (`use_tool`, volume 50) | `You start to disassemble the frame...`; `You disassemble the frame.` | 5 metal sheets, frame deleted | constructable_frame.dm:94-103 |
| 1 | wrench | 40 (volume 75) | `You start [anchored ? "un" : ""]securing [src]...`; `You [anchored ? "un" : ""]secure [src].` | toggles anchored | constructable_frame.dm:104-110 |
| 1 | cable coil, amount 5 | 20 (volume 50, `amount=5`) | `You start to add cables to the frame...`; `You add cables to the frame.` | state 2, icon `box_1` | constructable_frame.dm:83-93 |
| 2 (cabled, icon `box_1`) | wrench | 40 (volume 75) | `You start [un]securing...`; `You [un]secure [src].` | toggles anchored | constructable_frame.dm:113-118 |
| 2 | wire cutter | none | `You remove the cables.` | state 1, gives 5 cable coil (`new /obj/item/stack/cable_coil(drop_location(), 5)`) | constructable_frame.dm:144-149 |
| 2 | circuit board (machine type) | none | `The frame needs to be secured first!` if board `needs_anchored` and frame not anchored; else `You add the circuit board to the frame.` | state 3, icon `box_2`, copies `req_components` | constructable_frame.dm:120-138 |
| 3 (board in, icon `box_2`) | crowbar | none | `You remove the circuit board.` or `You remove the circuit board and other components.` | state 2; board and parts dropped to `drop_location()` | constructable_frame.dm:153-169 |
| 3 | stack or item in the req list | none | `You add [P] to [src].`; `You cannot add that to the machine!` if not in the list | counts down `req_components` | constructable_frame.dm:244-270 |
| 3 | RPED (`/obj/item/storage/part_replacer`) | none | `[part.name] applied.` | bulk-applies matching parts | constructable_frame.dm:203-242 |
| 3 | screwdriver, all req counts 0 | none | none | `new circuit.build_path(loc)` is made, board and parts moved in, `RefreshParts()`, frame qdel | constructable_frame.dm:178-201 |
| 3 | wrench | 40 (volume 75) | as above | only if `circuit.needs_anchored` is FALSE | constructable_frame.dm:171-176 |

Frame deconstruct (`/obj/structure/frame/deconstruct`): gives 5 metal sheets and the circuit (constructable_frame.dm:16-22). `/obj/structure/frame/machine/deconstruct`: state 2 or higher gives a cable coil stack of 5 and drops all `components` (constructable_frame.dm:274-281).

Circuit board base (`/obj/item/circuitboard/machine`): `needs_anchored = TRUE` by default (code/game/objects/items/circuitboards/circuitboard.dm:27). `apply_default_parts` puts the board itself in `component_parts` first, then one part per `req_components` count (circuitboard.dm:35-56). A machine placed on the map with a `circuit` path gets this at `Initialize` (code/game/machinery/_machinery.dm:141-143), so map-placed units already have their parts and can be deconstructed to a frame.

Stock parts (code/modules/research/stock_parts.dm): default `rating = 1` (line 128). Capacitor base is `/obj/item/stock_parts/capacitor` (line 140), `adv` rating 2 (178-182), `super` rating 3 (222-226), `quadratic` rating 4 (266-270). Matter bin base line 164, micro-laser base line 158, micro-manipulator base line 152.

---

## Magnets

### electromagnetic generator  `/obj/machinery/magnetic_module`   (code/game/machinery/magnet.dm:7)
- What it is: a floor magnet that pulls loose conducting objects and non-AI silicons toward a centre tile, driven entirely by radio commands. No UI on the type. Built for firing ranges (magnet.dm:5).
- Key vars:
  - `name = "electromagnetic generator"` (magnet.dm:10); `desc = "A device that uses station power to create points of magnetic energy."` (magnet.dm:11)
  - `icon = 'icons/obj/objects.dmi'` (magnet.dm:8), `icon_state = "floor_magnet-f"` (magnet.dm:9), `layer = LOW_OBJ_LAYER` (magnet.dm:12)
  - `use_power = IDLE_POWER_USE` (magnet.dm:13), `idle_power_usage = 50` (magnet.dm:14)
  - `var/freq = FREQ_MAGNETS` (magnet.dm:16) = 1449 (code/__DEFINES/radio.dm:83)
  - `var/electricity_level = 1` (magnet.dm:17); `var/magnetic_field = 1` (magnet.dm:18); `var/code = 0` (magnet.dm:19)
  - `var/on = FALSE` (magnet.dm:21); `var/magneting = FALSE` (magnet.dm:22)
  - `var/center_x = 0`, `var/center_y = 0` (magnet.dm:25-26); `var/max_dist = 20` (magnet.dm:27)
  - No `circuit`, no `component_parts`, no `attackby`, no `attack_hand`, no `ui_interact` on the type (magnet.dm:7-45 and 58-158 read in full).
  - `anchored = TRUE` inherited (_machinery.dm:98). `max_integrity` 200, armor default (see shared rules).
- Interactions (every tool/item/intent that does something):

  | held item / action | condition | delay (ds) | message(s) verbatim | result |
  |---|---|---|---|---|
  | radio signal with `"command"` set | `signal.data["code"] == code` (magnet.dm:63) | none | none | `Cmd(command, modifier)` (magnet.dm:65); table below |
  | empty hand, click | any | none | none | Inherited `interact` / `attack_hand` path only. No `ui_interact` is defined on this type, so nothing is shown (inferred from magnet.dm:7-158). |
  | any item, no NOBLUDGEON | `CAN_BE_HIT` (objs.dm:5) | none for the hit; click cooldown `CLICK_CD_MELEE` (code/_onclick/item_attack.dm:114) | `<span class='danger'>[user] hits [src] with [I]!</span>` / `<span class='danger'>You hit [src] with [I]!</span>` if `I.force` is non-zero (code/_onclick/item_attack.dm:123-125) | generic hit: `take_damage(I.force, I.damtype, "melee", 1)` (item_attack.dm:128). No tool branch on this type, so wrench, screwdriver and crowbar take the same path (inferred). |
  | examine | any | none | inherited machinery examine (_machinery.dm:553-567) | text only |

  The `Cmd` table (magnet.dm:69-126), each with the bound it enforces:

  | command string | effect | bound (magnet.dm) |
  |---|---|---|
  | `set-electriclevel` | `electricity_level = modifier` if `modifier` is set | none on the set itself (75); `process()` clamps to 1..12 next tick (135-136, 148-149) |
  | `set-magneticfield` | `magnetic_field = modifier` if set | none on the set (78); `process()` clamps to 1..4 (137-138, 146-147) |
  | `add-elec` | `electricity_level++` | capped at 12 (82-83) |
  | `sub-elec` | `electricity_level--` | reset to 1 if `<= 0` (86-87) |
  | `add-mag` | `magnetic_field++` | capped at 4 (90-91) |
  | `sub-mag` | `magnetic_field--` | reset to 1 if `<= 0` (94-95) |
  | `set-x` / `set-y` | `center_x` / `center_y = modifier` if set | clamped to ±`max_dist` in `process()` (142-145) |
  | `N` / `S` / `E` / `W` | `center_y++` / `center_y--` / `center_x++` / `center_x--` | clamped in `process()` (142-145) |
  | `C` | `center_x = 0`, `center_y = 0` | none |
  | `R` | `center_x = rand(-max_dist, max_dist)`, same for y | none (magnet.dm:115-117) |
  | `set-code` | `code = modifier` if set | none |
  | `toggle-power` | `on = !on`; if now on: `INVOKE_ASYNC(src, .proc/magnetic_process)` | (magnet.dm:122-126) |

- Construction chain: NONE. No board is named (`circuit` unset, magnet.dm:7-45), so `Initialize` builds no board (_machinery.dm:141-143). There is no frame and no recipe for it in the source (checked: the frame recipe names only frames, and the magnet has no `circuit`).
- Deconstruction chain: NONE. Nothing on the type calls `default_deconstruction_screwdriver`, `default_deconstruction_crowbar` or `default_change_direction_wrench`, and `panel_open` can never be set on it. The only remaining path is `deconstruct()` from zero integrity (see Drops).
- Drops:
  - (a) Destroyed (integrity 0): `obj_destruction` → `deconstruct(FALSE)` (obj_defense.dm:20-21, 252-258) → machinery `deconstruct` (_machinery.dm:402-410). `component_parts` is null, so no frame is spawned (_machinery.dm:405). Drops: nothing. Stays behind: nothing.
  - (b) Deconstructed properly: no route exists on this type. If `deconstruct(TRUE)` ran anyway the result is the same: no frame, no parts, `qdel` (_machinery.dm:402-410).
- Health / armor:
  - `max_integrity = 200` inherited (_machinery.dm:93). Armor: machinery default (_machinery.dm:136-137): melee 25, bullet 10, laser 10, energy 0, bomb 0, bio 0, rad 0, fire 50, acid 70.
  - `integrity_failure` 0 (objs.dm:19): damage never breaks it into BROKEN. It only goes from damage to destruction (obj_defense.dm:17-21).
  - `damage_deflection` 0 (objs.dm:21), so no melee deflection (obj_defense.dm:25).
  - Damage is cut by the armor percentage: `round(damage_amount * (100 - armor_protection) * 0.01, DAMAGE_PRECISION)` (code/game/objects/obj_defense.dm:24-37). A melee hit with `damage_amount < damage_deflection` is ignored (obj_defense.dm:25-26).
- Power:
  - Declared: `use_power = IDLE_POWER_USE`, `idle_power_usage = 50` (magnet.dm:13-14). The DM sets no unit; the value passes to `use_power` unchanged (power.dm:96-101).
  - Process (magnet.dm:130-158): if NOPOWER, `on = FALSE` (131-132). If on: `use_power = ACTIVE_POWER_USE` and `active_power_usage = electricity_level * 15` (152-154). If off: `use_power = NO_POWER_USE` (155-156). Then `update_icon()` (158).
  - Automatic draw: SSmachines calls `auto_use_power()` after each `process()` (machines.dm:37-45). `process()` sets `use_power` to ACTIVE or NO_POWER before that call, so the `idle_power_usage = 50` value is never the one drawn (inferred from the call order). While on, each fire draws `electricity_level * 15` (magnet.dm:153-154; _machinery.dm:238-245). While off, nothing is drawn (`NO_POWER_USE` = 0, magnet.dm:156).
  - Pull loop (magnet.dm:161-181): each pass `use_power(electricity_level * 5)` (178), then `sleep(13 - electricity_level)` (179), in deciseconds. At level 1 that is 12 ds; at level 12 it is 1 ds. The `use_power` on line 178 is outside the `if(center)` block, so it is drawn even when the centre tile is not found (magnet.dm:166-178).
- Gotchas:
  1. The magnet switches itself off when unpowered: `process()` sets `on = FALSE` on NOPOWER (magnet.dm:131-132), and `magnetic_process` loops `while(on)` (magnet.dm:164).
  2. What it pulls: `obj` in `orange(magnetic_field, center)` that are `!anchored` and have `flags_1 & CONDUCT_1` (magnet.dm:169-171; CONDUCT_1 = 1<<5, code/__DEFINES/flags.dm:19). Non-AI silicons are stepped toward the centre (173-176). AIs are skipped (174-175).
  3. The pull centre is `locate(x + center_x, y + center_y, z)` each pass (magnet.dm:167), so a centre off the map pulls nothing but still draws power.
  4. The magnet joins radio `FREQ_MAGNETS` (1449) with `RADIO_MAGNETS` (code/__DEFINES/radio.dm:104 = `"magnets"`) at `Initialize` (magnet.dm:33), and leaves at `Destroy` (magnet.dm:43). It starts with `on = FALSE` and only starts pulling after `toggle-power` or the `LateInitialize` call (magnet.dm:39-40), which exits at once when off.
  5. Its operator is `/obj/machinery/magnetic_controller` (magnet.dm:186), which is not on this shard's list. It sends the command strings above with `code` set (magnet.dm:267-287, 329-349). It has `frequency = FREQ_MAGNETS` (magnet.dm:193).
  6. `update_icon_state`: `floor_magnet` when on, `floor_magnet0` when off (magnet.dm:49-56).
- BoxStation: x1 (list).

---

## Mech bay recharge port

### mech bay power port  `/obj/machinery/mech_bay_recharge_port`   (code/game/mecha/mech_bay.dm:14)
- What it is: a machine that charges the power cell of an exosuit (`/obj/mecha`) parked on the turf in front of it, through a linked mech bay power console. It draws area power while it charges.
- Key vars:
  - `name = "mech bay power port"` (mech_bay.dm:15); `desc = "This port recharges a mech's internal power cell."` (mech_bay.dm:16)
  - `density = TRUE` (mech_bay.dm:17); `dir = EAST` (mech_bay.dm:18). The type default is EAST; no frame code sets a direction.
  - `icon = 'icons/mecha/mech_bay.dmi'` (mech_bay.dm:19), `icon_state = "recharge_port"` (mech_bay.dm:20). Panel-open state is `recharge_port-o` (mech_bay.dm:72).
  - `circuit = /obj/item/circuitboard/machine/mech_recharger` (mech_bay.dm:21)
  - `var/obj/mecha recharging_mech` (mech_bay.dm:22); `var/obj/machinery/computer/mech_bay_power_console recharge_console` (mech_bay.dm:23); `var/max_charge = 50` (mech_bay.dm:24, replaced by `RefreshParts`); `var/on = FALSE` (mech_bay.dm:25, not read anywhere in the file); `var/turf/recharging_turf = null` (mech_bay.dm:26)
  - `recharging_turf = get_step(loc, dir)` at `Initialize` (mech_bay.dm:28-30) and on `setDir` (mech_bay.dm:37-39).
  - `max_integrity` 200 and default armor from `/obj/machinery` (see shared rules). `integrity_failure` not set (0).
- Interactions (every tool/item/intent that does something):

  | held item / action | condition | delay (ds) | message(s) verbatim | result |
  |---|---|---|---|---|
  | screwdriver | panel closed | none | `You open the maintenance hatch of [src].` (_machinery.dm:453) | `panel_open = TRUE`, icon `recharge_port-o` (mech_bay.dm:72; _machinery.dm:447-453) |
  | screwdriver | panel open | none | `You close the maintenance hatch of [src].` (_machinery.dm:457) | icon back to `recharge_port` |
  | wrench | panel open | none | `You rotate [src].` (_machinery.dm:465) | `setDir(turn(dir,-90))`; `recharging_turf` recalculated (mech_bay.dm:75-77) |
  | wrench | panel closed | none | none | falls through to `..()` (mech_bay.dm:81) (inferred: the helper needs `panel_open`, _machinery.dm:462) |
  | crowbar | panel open | none (sound 50) | none | `deconstruct(TRUE)` (mech_bay.dm:79; _machinery.dm:396-400) |
  | crowbar | panel closed | none | none | falls through to `..()` (mech_bay.dm:81) |
  | any other item | any | none | none | `..()` (mech_bay.dm:81) |
  | examine | in range, or observer | none | `<span class='notice'>The status display reads: Base recharge rate at <b>[max_charge]J</b> per cycle.</span>` (mech_bay.dm:49-50) | text only |
  | parked mech on `recharging_turf` | `recharge_console` set, not NOPOWER | none | none | charges the mech (see Power) |

- Construction chain (board to finished port, `req_components` at code/game/objects/items/circuitboards/machine_circuitboards.dm:810-816):
  1. Make a machine frame: 5 metal sheets, 25 ds, one per turf, on floor (sheet_types.dm:52).
  2. Frame state 1: `cable coil` amount 5 (20 ds, volume 50) → state 2 (constructable_frame.dm:83-93).
  3. Frame state 2: wrench to anchor (40 ds, volume 75) (constructable_frame.dm:113-118). The board needs the frame anchored (constructable_frame.dm:125-127).
  4. Frame state 2: insert `/obj/item/circuitboard/machine/mech_recharger` (name `Mechbay Recharger (Machine Board)`, build_path `/obj/machinery/mech_bay_recharge_port`, machine_circuitboards.dm:811-813). Message `You add the circuit board to the frame.` (constructable_frame.dm:131). State 3.
  5. Frame state 3: add `/obj/item/stack/cable_coil` × 2 (`req_components` value 2, machine_circuitboards.dm:815) and `/obj/item/stock_parts/capacitor` × 5 (machine_circuitboards.dm:816). No delay for either (constructable_frame.dm:244-270). The RPED may apply these instead (constructable_frame.dm:203-242).
  6. Frame state 3: screwdriver, once every req count is 0 (constructable_frame.dm:178-201). No delay. The port is created with `setAnchored(anchored)`, the parts are moved in, `RefreshParts()` runs, and the frame is qdel'd. Its `dir` is the type default `EAST`, since the frame passes no direction (inferred from constructable_frame.dm:186-200 and mech_bay.dm:18).
  - Power console: `/obj/machinery/computer/mech_bay_power_console` is a separate build (`/obj/item/circuitboard/computer/mech_bay_power_console`, code/game/objects/items/circuitboards/computer_circuitboards.dm:303-306). The port does not work without it (see Gotchas).
- Deconstruction chain:
  1. Screwdriver: `You open the maintenance hatch of [src].` (no delay) (_machinery.dm:453).
  2. Crowbar, panel open: sound 50, then `deconstruct(TRUE)` (no delay) (_machinery.dm:396-400).
  3. `deconstruct(TRUE)`: `on_deconstruction()` (no-op, _machinery.dm:576-577), `spawn_frame(TRUE)` gives a `/obj/structure/frame/machine` at full integrity, state 2, icon `box_1`, anchored copied (_machinery.dm:412-420). Then every `component_parts` item is moved to `loc`, then `qdel` (_machinery.dm:405-410).
  - Result: a frame at state 2 (cable coil already in), the circuit board, 5 capacitors and 2 cable coil on the floor. A frame at state 2 can take a board again (constructable_frame.dm:112-138).
- Drops:
  - (a) Destroyed (integrity 0): `deconstruct(FALSE)` (obj_defense.dm:252-258). `spawn_frame(FALSE)` makes the frame at 50 % of its 250 max integrity (_machinery.dm:416-417; constructable_frame.dm:6), so 125 (inferred from 250 × 0.5). The same parts drop as in the deconstruction chain: the board, 5 capacitors and 2 cable coil, all moved to `loc` (_machinery.dm:405-409). Acid and fire destruction call `deconstruct(FALSE)` too (obj_defense.dm:193-195, 211-214).
  - (b) Deconstructed properly (crowbar, panel open): the same list, with the frame at full integrity (_machinery.dm:416).
  - Stays behind: nothing in either case. The port's own `component_parts` are all moved out.
- Health / armor: `max_integrity` 200 (inherited, _machinery.dm:93). Armor: machinery default (_machinery.dm:136-137). `integrity_failure` 0 (objs.dm:19), so the port never gets BROKEN from damage; it goes straight from damage to destruction (obj_defense.dm:17-21). `damage_deflection` 0 (objs.dm:21).
- Power:
  - Declared: `use_power = IDLE_POWER_USE`, `idle_power_usage = 0`, `active_power_usage = 0` (defaults, _machinery.dm:102, 106-107). The port sets none of these itself. Because it overrides `process()` without returning `PROCESS_KILL`, SSmachines calls `auto_use_power()` on it each fire (machines.dm:37-45), which draws 0.
  - Charging (mech_bay.dm:52-68): `delta = min(max_charge, mech cell maxcharge - charge)` (mech_bay.dm:61); `give_power(delta)` (62); `use_power(delta*150)` (63). The 150 multiplier is raw; the DM gives no unit (power.dm:96-101).
  - `max_charge` from `RefreshParts` = (sum of capacitor ratings) × 25 (mech_bay.dm:41-45). With the board's 5 basic capacitors (rating 1, stock_parts.dm:128): 5 × 25 = 125 per cycle. The examine text shows this as `125J` (mech_bay.dm:50). Each adv capacitor (rating 2) adds 50, each super (rating 3) adds 75 (stock_parts.dm:178-182, 222-226).
  - Process cadence: the DM comment says roughly 2 s (_machinery.dm:120), SSmachines default `wait = 20` ds (code/controllers/subsystem.dm:20).
- Gotchas:
  1. Needs a linked console: `process()` returns at once when there is no `recharge_console` (mech_bay.dm:53). The console links itself to a port in `Initialize` (mech_bay.dm:146-148). Its `reconnect` (mech_bay.dm:123-138) looks first within `range(1)`, then two steps out in each cardinal direction. A port is taken only if it has no console already (mech_bay.dm:134-138).
  2. Needs power: `if(machine_stat & NOPOWER || !recharge_console) return` (mech_bay.dm:53). It checks NOPOWER only, not BROKEN (the port cannot be BROKEN from damage anyway, see Health).
  3. The mech must stand on `recharging_turf`, the turf in front of the port (`get_step(loc, dir)`, mech_bay.dm:30). `recharging_mech` is found by `locate(/obj/mecha) in recharging_turf` (mech_bay.dm:56). It is cleared when the mech leaves that turf (mech_bay.dm:66-68).
  4. Charging stops when the cell is full (mech_bay.dm:64-65); the console's icon updates, but the port keeps `recharging_mech` set until the mech leaves.
  5. A wrench rotates the port 90 degrees, which moves `recharging_turf` (mech_bay.dm:75-77). The rotation needs the panel open (_machinery.dm:462).
  6. `Destroy` clears the console's link (mech_bay.dm:32-35). The console's `Destroy` does the reverse (mech_bay.dm:150-153).
  7. No code in mech_bay.dm checks the floor type. The only placement check is the `recharging_turf` position (mech_bay.dm:30, 56). The recharge floor `/turf/open/floor/mech_bay_recharge_floor` (mech_bay.dm:1) is defined in the same file but not read by the port.
- BoxStation: x3 (list). Newer snapshot (`Downloads/tgstation-1da0...`): not checked for this part.

# gap-things-05.2: Exosuit fabricator

One machine, `/obj/machinery/mecha_part_fabricator`, two on BoxStation. It builds researched MECHFAB designs from material it holds (its own local storage, or a remote ore silo). It runs a queue, and it is driven by a HTML window (`user << browse`), not tgui. Its power numbers are declared but, in this source, never drawn (see Power).

Shared machine rules (frame, parts, destruction, base health and power loop) are in `gap-things-05.1.md`, "Shared rules". Only the differences are written here.

---

## exosuit fabricator  `/obj/machinery/mecha_part_fabricator`   (code/game/mecha/mech_fabricator.dm:1)

- What it is: a mech part printer. Each design costs material (scaled by a laser coefficient) and build time (scaled by a manipulator coefficient). The result is placed on the tile in front of it, `get_step(src, dir)` (mech_fabricator.dm:170-171).
- Key vars:
  - `icon = 'icons/obj/robotics.dmi'` (mech_fabricator.dm:2); `icon_state = "fab-idle"` (3); `name = "exosuit fabricator"` (4); `desc = "Nothing is being built."` (5); `density = TRUE` (6)
  - `use_power = IDLE_POWER_USE` (7); `idle_power_usage = 20` (8); `active_power_usage = 5000` (9)
  - `req_access = list(ACCESS_ROBOTICS)` (10); ACCESS_ROBOTICS = 29 (code/__DEFINES/access.dm:40). No `allowed()` call in this file, so it is not checked here (grep of mech_fabricator.dm).
  - `circuit = /obj/item/circuitboard/machine/mechfab` (11)
  - `var/time_coeff = 1` (12); `var/component_coeff = 1` (13); `var/datum/techweb/specialized/autounlocking/exofab/stored_research` (14); `var/sync = 0` (15); `var/part_set` (16); `var/datum/design/being_built` (17); `var/list/queue = list()` (18); `var/processing_queue = 0` (19); `var/screen = "main"` (20); `var/link_on_init = TRUE` (21); `var/temp` (22); `var/datum/component/remote_materials/rmat` (23)
  - `part_sets` (mech_fabricator.dm:24-37): `"Cyborg"`, `"Ripley"`, `"Odysseus"`, `"Clarke"`, `"Gygax"`, `"Durand"`, `"H.O.N.K"`, `"Phazon"`, `"Exosuit Equipment"`, `"Exosuit Ammunition"`, `"Cyborg Upgrade Modules"`, `"Misc"`
  - `max_integrity` 200, armor default and `integrity_failure` 0 are inherited (shared rules). The type sets none of them.
- Initialize (mech_fabricator.dm:39-43): `stored_research = new`; `rmat = AddComponent(/datum/component/remote_materials, "mechfab", mapload && link_on_init)`; `RefreshParts()`.
  - remote_materials (code/datums/components/remote_materials.dm:19-33): if `mapload` is set and the turf is on the station z-level, it runs `LateInitialize` on a timer, which takes `GLOB.ore_silo_default` when one exists (remote_materials.dm:30-31, 35-41). Otherwise it makes local storage (`_MakeLocal`, remote_materials.dm:32-33, 55-72). A map-placed fab therefore joins the silo network if one exists. A runtime-placed one uses local storage.
- Local storage allowed materials (remote_materials.dm:58-70): iron, glass, silver, gold, diamond, plasma, uranium, bananium, titanium, bluespace, plastic. Allowed types: `/obj/item/stack` only (remote_materials.dm:72).

### Stored designs and part sets (the UI reads these)

| Thing | Rule | file:line |
|---|---|---|
| Designs listed | `stored_research.researched_designs` where `D.build_type & MECHFAB` and `set_name in D.category` | mech_fabricator.dm:85-88 |
| Set queue-all | `add_part_set_to_queue(set_name)`: same filter, each into `queue` | mech_fabricator.dm:184-190 |
| Sync | `sync()` looks for an `/obj/machinery/computer/rdconsole` in `oview(7, src)`; copies its research into `stored_research` | mech_fabricator.dm:244-253 |
| Sync success message | `Successfully synchronized with R&D server.` | mech_fabricator.dm:248 |
| Sync failure message | `Unable to connect to local R&D Database.<br>Please check your connections and try again.<br><a href='?src=[REF(src)];clear_temp=1'>Return</a>` | mech_fabricator.dm:251 |
| Reagent designs | refused: `if(D.reagents_list.len) return FALSE` | mech_fabricator.dm:137-138 |

### Cost and time formulas (all raw)

| Quantity | Formula | file:line |
|---|---|---|
| Material cost per resource | `round(D.materials[resource] * component_coeff, roundto)` (roundto 1) | mech_fabricator.dm:255-256 |
| Build time (ds) | `round(initial(D.construction_time) * time_coeff, roundto)` (roundto 1) | mech_fabricator.dm:258-259 |
| Build time as shown in the list | `[get_construction_time_w_coeff(D)/10]sec` (display only; the DM divides ds by 10) | mech_fabricator.dm:96-98 |
| Storage size (cm³) | `rmat.set_local_size(200000 + T * 50000)`, T = sum of matter bin `rating` | mech_fabricator.dm:45-51 |
| Material coefficient | `component_coeff = 1.15 - sum(micro_laser rating * 0.15)` | mech_fabricator.dm:53-57 |
| Time coefficient | `time_coeff = round(1 - (T) / 5, 0.01)` where T = (sum of manipulator rating) - 1 | mech_fabricator.dm:59-63 |

The DM comments give the expected values: storage "default 300000, 600000 at T4" (mech_fabricator.dm:48); material "1 -> 0.85 -> 0.7 -> 0.55" (line 53); time "1 -> 0.8 -> 0.6" (line 59).

Examine string (mech_fabricator.dm:65-68): `<span class='notice'>The status display reads: Storing up to <b>[rmat.local_size]</b> material units.<br>Material consumption at <b>[component_coeff*100]%</b>.<br>Build time reduced by <b>[100-time_coeff*100]%</b>.</span>` Shown only when `in_range(user, src)` or observer.

Storage text in the UI: `[M.name]: [amount] cm&sup3;` (mech_fabricator.dm:118). Without storage: `<font color='red'>No material storage connected, please contact the quartermaster.</font><br>` (mech_fabricator.dm:126).

### Interactions (every tool/item/intent that does something)

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| screwdriver | any | none (no `use_tool`) | `You open the maintenance hatch of [src].` / `You close the maintenance hatch of [src].` (_machinery.dm:453, 457) | `default_deconstruction_screwdriver(user, "fab-o", "fab-idle", W)`: toggles `panel_open`, icon `fab-o` / `fab-idle` (mech_fabricator.dm:422-424) |
| crowbar | panel open | none (sound 50) | none | `default_deconstruction_crowbar(W)` → `deconstruct(TRUE)` (mech_fabricator.dm:426-427; _machinery.dm:396-400) |
| wrench | any | none | none | no branch on this type; falls to `..()` (mech_fabricator.dm:429). Inferred: no effect. |
| multitool | silo in buffer, not already linked | none | `You connect [parent] to [silo] from the multitool's buffer.` (remote_materials.dm:111) | connects to the silo; `mat_container.retrieve_all()` and `qdel(mat_container)` first if local (remote_materials.dm:104-106). Refused with `[parent] is already connected to [silo]!` (remote_materials.dm:98-100) |
| sheet or stack, `INTENT_HELP` | local storage (no silo) | none | `[parent] won't accept [I]!`, `[I] does not contain sufficient materials...`, `[parent] is full. Please remove materials from [parent] in order to insert more.` (material_container.dm:66, 74, 77); success `You insert a material total of [inserted] into [parent].` (material_container.dm:99) | stack goes into storage. Only `INTENT_HELP` inserts (material_container.dm:61-62) |
| sheet or stack | silo connected | none | silo's own handler (`silo.remote_attackby`, remote_materials.dm:88-91) | fills the silo, not this machine |
| emag (`emag_act`) | not already EMAGGED | sleeps 10, 15, 30 ds | `DB error \[Code 0x00F1\]` (75), `Attempting auto-repair...` (77), `User DB corrupted \[Code 0x00FA\]. Truncating data structure...` (79), `User DB truncated. Please contact your Nanotrasen system operator for future assistance.` (81) | `obj_flags |= EMAGGED`; `req_access = list()` (mech_fabricator.dm:70-81). Nothing else changes. |
| click (`attack_hand`, inherited) | any | none | none | `ui_interact` (mech_fabricator.dm:261-318) |
| examine | in range or observer | none | the status string at mech_fabricator.dm:68 (quoted above) | text only |

`ui_interact` (mech_fabricator.dm:261-318):
- If the outlet tile is dense (`get_step(src, dir)` with `density`), it says `Error! Part outlet is obstructed.` (via `say`) and does not open the window (mech_fabricator.dm:265-267).
- If `temp` is set, that is shown. If `being_built` is set: `<TT>Building [initial(I.name)].<BR> Please wait until completion...</TT>` (mech_fabricator.dm:269-274).
- `screen = "main"`: resources, `Sync with R&D servers`, one link per part set, with `Add all parts to queue` (mech_fabricator.dm:276-281). `screen = "parts"`: the parts for `part_set` (mech_fabricator.dm:282-284).
- Window: `window=mecha_fabricator;size=1000x430` (mech_fabricator.dm:316). Old-style HTML `browse`, not tgui (no `tgui_id` on the type).

Topic actions (`href_list`), mech_fabricator.dm:320-393:

| key | effect | file:line |
|---|---|---|
| `part_set` | sets `part_set` and `screen = "parts"`; `"clear"` resets | 323-330 |
| `part` | builds now if not `processing_queue`, otherwise queues it | 331-341 |
| `add_to_queue` | appends one design to `queue` | 342-350 |
| `remove_from_queue` | removes entry | 351-353 |
| `partset_to_queue` | queues the whole set | 354-356 |
| `process_queue` | `INVOKE_ASYNC(do_process_queue)` | 357-358 |
| `clear_temp` | `temp = null` | 359-360 |
| `screen` | sets screen | 361-362 |
| `queue_move` + `index` | swaps neighbours if in range | 363-369 |
| `clear_queue` | `queue = list()` | 370-372 |
| `sync` | `sync()` | 373-374 |
| `part_desc` | sets `temp` to `<h1>[initial(part.name)] description:</h1>` + `initial(part.desc)` | 375-386 |
| `remove_mat` + `material` | `eject_sheets(Mat, amount)` | 388-390 |

Queue text (`list_queue`, mech_fabricator.dm:224-242): `<b>Queue contains:</b>`, `Nothing` when empty; each row `Remove`, and the buttons `Process queue` and `Clear queue`. Rows with no resources are shown red (`style='color: #f00;'`, line 234).

### Build (build_part, mech_fabricator.dm:144-178)

| step | condition / message | delay (ds) |
|---|---|---|
| no storage | `No access to material storage, please contact the quartermaster.` (149) | none |
| on hold | `rmat.on_hold()` (remote_materials.dm:114-115): `Mineral access is on hold, please contact the quartermaster.` (152) | none |
| no resources | `check_resources(D)` false: `Not enough resources. Queue processing stopped.` (155) | none |
| start | `being_built = D`; `desc = "It's building \a [initial(D.name)]."` (157-158); `materials.use_materials(res_coef)` (159); silo log (160); overlay `fab-active` (162); `use_power = ACTIVE_POWER_USE` (163) | none |
| wait | `sleep(get_construction_time_w_coeff(D))` (165) | `get_construction_time_w_coeff(D)` (ds) |
| finish | `use_power = IDLE_POWER_USE` (166); `cut_overlay("fab-active")` (167); `desc = initial(desc)` (168) | none |
| create | `new D.build_path(location)` where `location = get_step(src, dir)` (170-171); `material_flags |= MATERIAL_NO_EFFECTS` (172); `set_custom_materials(res_coef)` (173); `say("\The [I] is complete.")` (174) | none |

- The item is created with the coefficient-scaled material cost set on it (173).
- `process_queue` (205-222) builds in a loop. It stops when `machine_stat & (NOPOWER|BROKEN)` (215-216) or when a build fails (218-220). When the queue empties it says `Queue processing finished successfully.` (222).
- `do_process_queue` (395-400) refuses when a queue is already running or something is being built (396-397).
- `remove_from_queue` (199-203) cuts the entry; `add_to_queue` (192-197) appends.

### Eject (eject_sheets, mech_fabricator.dm:402-414)

- Errors: `No access to material storage, please contact the quartermaster.` (405); `Mineral access is on hold, please contact the quartermaster.` (408).
- `mat_container.retrieve_sheets(amount, sheet, drop_location())` (410). Logged with `silo_log(... "ejected" ...)` (413).
- The `Remove` links exist only when stock is at least `MINERAL_MATERIAL_AMOUNT` (2000, code/__DEFINES/construction.dm:70): 1 sheet at >= 2000 (line 119-120), 10 at >= 20000 (121-122), 50 at >= 2000 (123).

### Construction chain (board to fabricator)

Board: `/obj/item/circuitboard/machine/mechfab`, name `Exosuit Fabricator (Machine Board)`, `build_path = /obj/machinery/mecha_part_fabricator`, `req_components` = `/obj/item/stock_parts/matter_bin = 2`, `/obj/item/stock_parts/manipulator = 1`, `/obj/item/stock_parts/micro_laser = 1`, `/obj/item/stack/sheet/glass = 1` (code/game/objects/items/circuitboards/machine_circuitboards.dm:818-826). `needs_anchored` is the default TRUE (circuitboard.dm:27).

1. Make a machine frame: 5 metal sheets, 25 ds, one per turf, on floor (code/game/objects/items/stacks/sheets/sheet_types.dm:52).
2. Frame state 1: cable coil amount 5, 20 ds, volume 50, then state 2 (constructable_frame.dm:83-93).
3. Frame state 2: wrench, 40 ds, volume 75, to anchor (constructable_frame.dm:113-118).
4. Frame state 2: insert the board. It must be anchored (constructable_frame.dm:125-127). Message `You add the circuit board to the frame.` (131). State 3.
5. Frame state 3: add `matter bin` × 2, `micro-manipulator` × 1, `micro-laser` × 1, `sheet of glass` × 1 (glass stack, `use` of 1). Each has no delay (constructable_frame.dm:244-270). Messages `You add [P] to [src].`
6. Frame state 3: screwdriver once all counts are 0 (constructable_frame.dm:178-201). No delay. The fabricator is created at the frame's place, `RefreshParts()` runs, and the frame is qdel'd.

Stock parts, the `rating` values that drive the coefficients: matter bin base (stock_parts.dm:164-168), manipulator base (152-156), micro-laser base (158-162); default `rating = 1` (stock_parts.dm:128).

### Deconstruction chain

1. Screwdriver, no delay: panel opens, icon `fab-o` (mech_fabricator.dm:423).
2. Crowbar, panel open: `deconstruct(TRUE)` (mech_fabricator.dm:426-427; _machinery.dm:402-410).
3. `deconstruct(TRUE)`: `spawn_frame(TRUE)` gives a frame at state 2, full integrity, anchored copied (_machinery.dm:412-420). The parts in `component_parts` go to the floor (_machinery.dm:405-409). Then `qdel` runs `Destroy`:
   - `remote_materials` `Destroy`: if linked to a silo, it disconnects; if local, `mat_container.retrieve_all(P.drop_location())` puts all stored material on the floor (remote_materials.dm:43-53).

### Drops

- (a) Destroyed (integrity 0): `deconstruct(FALSE)` (obj_defense.dm:252-258). Frame at 50 % of its max (125 of 250; _machinery.dm:416-417; constructable_frame.dm:6). Drops: `circuit board (mechfab)`, `matter bin` × 2, `micro-manipulator` × 1, `micro-laser` × 1, `sheet of glass` × 1 (stack). Plus local material as in the deconstruction step 3 (remote_materials.dm:43-53). Any queue is lost (queue is a list on the machine, not dropped).
- (b) Deconstructed properly: the same parts and material, frame at full integrity (_machinery.dm:416).
- Stays behind: the frame at state 2 (cable coil already in; constructable_frame.dm:274-281 for the frame's own deconstruct).

### Health / armor

- `max_integrity` 200 (inherited), armor default, `integrity_failure` 0, `damage_deflection` 0 (shared rules).
- Damage cannot set BROKEN on this type: `integrity_failure` is 0, so `take_damage` never calls `obj_break` (obj_defense.dm:17-18). It goes straight from damage to destruction (obj_defense.dm:20-21).

### Power

- Declared: `use_power = IDLE_POWER_USE` (mech_fabricator.dm:7), `idle_power_usage = 20` (8), `active_power_usage = 5000` (9). During a build `use_power = ACTIVE_POWER_USE` (163), and back to idle after (166).
- Drawn in this source: nothing (inferred). The type does not override `process()`, so the base `process()` returns `PROCESS_KILL` (_machinery.dm:181-182). SSmachines then drops it from processing and never calls `auto_use_power()` for it (machines.dm:37-45). No `use_power()` call exists in mech_fabricator.dm.
- Power still gates the queue: `process_queue` stops on NOPOWER (mech_fabricator.dm:215-216). The NOPOWER bit comes from the area's power state, set through `power_change()` at `LateInitialize` (_machinery.dm:163-165).

### Gotchas

1. Output tile: `get_step(src, dir)` (mech_fabricator.dm:170). The UI refuses to open when that tile is dense (265-267). That check is only in `ui_interact`. `build_part` does not check it (inferred from 144-178), so a build started earlier still creates the part on a dense tile.
2. Requires research: only designs in `stored_research.researched_designs` with `MECHFAB` are shown or buildable (mech_fabricator.dm:85-88, 333-336, 344-347). `stored_research` is created with `new` (line 40). This file never adds designs to it itself; the only write in this file is `sync()` copying from a research console within 7 tiles (mech_fabricator.dm:245-246). The datum's own contents are not read here.
3. Reagent designs cannot be built (137-138).
4. Material is taken before the build delay. `materials.use_materials(res_coef)` runs at line 159 and the `sleep` is at 165. A destroyed fabricator mid-build loses that material (inferred from order).
5. Storage size: basic board, two basic matter bins = `200000 + 2 * 50000 = 300000` cm³ (mech_fabricator.dm:51, 48).
6. Local storage is only `allowed_mats` (remote_materials.dm:58-70) and accepts `/obj/item/stack` (remote_materials.dm:72).
7. `AfterMaterialInsert` (mech_fabricator.dm:416-420) adds a 10 ds overlay `fab-load-[M.name]` (addtimer, line 419). It is defined here but `_MakeLocal` passes no after-insert callback (remote_materials.dm:72), so it is not called for this machine (inferred). `is_insertion_ready` (432-440) is used by other machines (destructive_analyzer.dm:37, experimentor.dm:113), not by this one.
8. `req_access = list(ACCESS_ROBOTICS)` (line 10) is set and cleared by the emag (line 74), but no access check reads it in this file.
9. The emag only clears `req_access` and says the messages. It does not change costs or times.
10. Linking to a silo with a multitool first dumps any local material and deletes the local container (remote_materials.dm:104-106).
11. `on_hold()` (remote_materials.dm:114-115) blocks builds and ejects, but only when a silo is linked (`silo && silo.holds[...]`). The key is `"[get_area(parent)]/[category]"` (remote_materials.dm:115), where the category is `mechfab`, set at remote_materials.dm:23.
12. Child type `/obj/machinery/mecha_part_fabricator/maint` (mech_fabricator.dm:442-443) sets `link_on_init = FALSE`, so it never joins a silo on map load. It is not on this shard's list.

### Placement and snapshot

- BoxStation: x2 (list). Newer snapshot (`Downloads/tgstation-1da0...`): not checked for this part.

# gap-things-05.3: Mining equipment vendor and ore redemption machine

Two mining machines that share the `/obj/machinery/mineral` parent. The parent sets the input and output tiles and the `unload_mineral` helper (code/modules/mining/machine_processing.dm:5-58). Neither machine uses the automatic power loop: both set `processing_flags = START_PROCESSING_MANUALLY` or have no `process()`, so their power state only gates behaviour through `powered()`.

Shared machine rules (frame, parts, destruction, base health) are in `gap-things-05.1.md`, "Shared rules".

Mineral parent (code/modules/mining/machine_processing.dm):

| Var / proc | Value | file:line |
|---|---|---|
| `processing_flags` | `START_PROCESSING_MANUALLY` (never started by the parent) | machine_processing.dm:6 |
| `subsystem_type` | `/datum/controller/subsystem/processing/fastprocess` | machine_processing.dm:7 |
| `input_dir` / `output_dir` | `NORTH` / `SOUTH` by default | machine_processing.dm:9, 11 |
| `needs_item_input` | FALSE by default; registers `input_turf` only when TRUE and anchored | machine_processing.dm:15, 17-20 |
| `unload_mineral(S)` | `forceMove(drop_location())`, then `forceMove` to `get_step(src, output_dir)` if that tile exists | machine_processing.dm:54-58 |
| `Moved()` | re-registers the input turf when anchored and `needs_item_input` | machine_processing.dm:33-38 |

---

## Mining equipment vendor

### mining equipment vendor  `/obj/machinery/mineral/equipment_vendor`   (code/modules/mining/machine_vending.dm:3)
- What it is: a TGUI point shop. An ID with `mining_points` buys an item from `prize_list`; the item is made on the vendor's own tile. Stock never runs out.
- Key vars:
  - `name = "mining equipment vendor"` (machine_vending.dm:4); `desc = "An equipment vendor for miners, points collected at an ore redemption machine can be spent here."` (machine_vending.dm:5)
  - `icon = 'icons/obj/machines/mining_machines.dmi'`, `icon_state = "mining"` (machine_vending.dm:6-7); `density = TRUE` (8)
  - `circuit = /obj/item/circuitboard/machine/mining_equipment_vendor` (machine_vending.dm:9)
  - `ui_x = 425`, `ui_y = 600` (machine_vending.dm:10-11)
  - `icon_deny = "mining-deny"` (machine_vending.dm:12): flicked on a refused purchase (145, 150, 154)
  - `var/obj/item/card/id/inserted_id` (machine_vending.dm:13): declared; never assigned in this file
  - `prize_list` (machine_vending.dm:14-66): 51 entries, table below
  - `max_integrity` 200, armor default and `integrity_failure` 0 inherited (shared rules); the type sets none of them.
- Interactions (every tool/item/intent that does something):

  | held item / action | condition | delay (ds) | message(s) verbatim | result |
  |---|---|---|---|---|
  | mining voucher (`/obj/item/mining_voucher`) | any | none | `input(... "Pick your equipment" ...)`, list in the table below | `RedeemVoucher`: items spawned on `drop_location()`, voucher deleted (machine_vending.dm:163-164, 172-201). Only if still adjacent and the voucher is still in the redeemer's hand (176). |
  | screwdriver | any | none | `You open the maintenance hatch of [src].` / `You close the maintenance hatch of [src].` (_machinery.dm:453, 457) | `default_deconstruction_screwdriver(user, "mining-open", "mining", I)`: panel toggles, icon `mining-open` / `mining` (machine_vending.dm:166; _machinery.dm:447-459) |
  | crowbar | panel open | none (sound 50) | none | `default_deconstruction_crowbar(I)` → `deconstruct(TRUE)` (machine_vending.dm:168; _machinery.dm:396-400) |
  | any other item | any | none | none | `..()` → generic hit (`/obj/attackby`, item_attack.dm:58-59), e.g. `[user] hits [src] with [I]!` |
  | click (`attack_hand`) | any | none | none | TGUI `MiningVendor` (machine_vending.dm:97-104) |
  | purchase (TGUI `purchase`) | see below | none | `Error: An ID is required!` (144); `Error: Invalid choice!` (149); `Error: Insufficient points for [prize.equipment_name] on [I]!` (153); success `[src] clanks to life briefly before vending [prize.equipment_name]!` (157) | success: `I.mining_points -= prize.cost` (156), `new prize.equipment_path(loc)` (158), `SSblackbox` tally (159). Refusals flick `mining-deny` (145, 150, 154). |
  | explosion (`ex_act`) | severity 1 or 2 | none | none | sparks (machine_vending.dm:204); `qdel(src)` with probability `50 / severity` (205-206). Severity 3 never deletes. |

  Purchase rule: an ID is needed (`M.get_idcard(TRUE)`, machine_vending.dm:142-143). Points are `C.mining_points` on that card. Price must be `<=` points (152).

- The `ui_data` shown to the buyer: `user.points` = `C.mining_points`, `user.name` = `registered_account.account_holder`, `user.job` = `account_job.title` or `No Job` (machine_vending.dm:118-133). `ui_static_data` sends each product as `path` (path with `/obj/item/` removed and `/` replaced by `-`), `name`, `price` (machine_vending.dm:106-116).

- Voucher choices (machine_vending.dm:173, 179-198): `Survival Capsule and Explorer's Webbing` → `/obj/item/storage/belt/mining/vendor`; `Resonator Kit` → `/obj/item/extinguisher/mini` + `/obj/item/resonator`; `Minebot Kit` → `/mob/living/simple_animal/hostile/mining_drone` + `/obj/item/weldingtool/hugetank` + `/obj/item/clothing/head/welding` + `/obj/item/borg/upgrade/modkit/minebot_passthrough`; `Extraction and Rescue Kit` → `/obj/item/extraction_pack` + `/obj/item/fulton_core` + `/obj/item/stack/marker_beacon/thirty`; `Crusher Kit` → `/obj/item/extinguisher/mini` + `/obj/item/kinetic_crusher`; `Mining Conscription Kit` → `/obj/item/storage/backpack/duffelbag/mining_conscript`.

#### Vendor stock (`prize_list`, machine_vending.dm:15-65), every entry

| line | in-game name (`equipment_name`) | DM path | points |
|---|---|---|---|
| 15 | 1 Marker Beacon | /obj/item/stack/marker_beacon | 10 |
| 16 | 10 Marker Beacons | /obj/item/stack/marker_beacon/ten | 100 |
| 17 | 30 Marker Beacons | /obj/item/stack/marker_beacon/thirty | 300 |
| 18 | Whiskey | /obj/item/reagent_containers/food/drinks/bottle/whiskey | 100 |
| 19 | Absinthe | /obj/item/reagent_containers/food/drinks/bottle/absinthe/premium | 100 |
| 20 | Bubblegum Gum Packet | /obj/item/storage/box/gum/bubblegum | 100 |
| 21 | Cigar | /obj/item/clothing/mask/cigarette/cigar/havana | 150 |
| 22 | Soap | /obj/item/soap/nanotrasen | 200 |
| 23 | Laser Pointer | /obj/item/laser_pointer | 300 |
| 24 | Alien Toy | /obj/item/clothing/mask/facehugger/toy | 300 |
| 25 | Stabilizing Serum | /obj/item/hivelordstabilizer | 400 |
| 26 | Fulton Beacon | /obj/item/fulton_core | 400 |
| 27 | Shelter Capsule | /obj/item/survivalcapsule | 400 |
| 28 | GAR Meson Scanners | /obj/item/clothing/glasses/meson/gar | 500 |
| 29 | Explorer's Webbing | /obj/item/storage/belt/mining | 500 |
| 30 | Point Transfer Card | /obj/item/card/mining_point_card | 500 |
| 31 | Survival Medipen | /obj/item/reagent_containers/hypospray/medipen/survival | 500 |
| 32 | Brute First-Aid Kit | /obj/item/storage/firstaid/brute | 600 |
| 33 | Tracking Implant Kit | /obj/item/storage/box/minertracker | 600 |
| 34 | Jaunter | /obj/item/wormhole_jaunter | 750 |
| 35 | Kinetic Crusher | /obj/item/kinetic_crusher | 750 |
| 36 | Kinetic Accelerator | /obj/item/gun/energy/kinetic_accelerator | 750 |
| 37 | Advanced Scanner | /obj/item/t_scanner/adv_mining_scanner | 800 |
| 38 | Resonator | /obj/item/resonator | 800 |
| 39 | Luxury Medipen | /obj/item/reagent_containers/hypospray/medipen/survival/luxury | 1000 |
| 40 | Fulton Pack | /obj/item/extraction_pack | 1000 |
| 41 | Lazarus Injector | /obj/item/lazarus_injector | 1000 |
| 42 | Silver Pickaxe | /obj/item/pickaxe/silver | 1000 |
| 43 | Mining Conscription Kit | /obj/item/storage/backpack/duffelbag/mining_conscript | 1500 |
| 44 | Jetpack Upgrade | /obj/item/tank/jetpack/suit | 2000 |
| 45 | Space Cash | /obj/item/stack/spacecash/c1000 | 2000 |
| 46 | Mining Hardsuit | /obj/item/clothing/suit/space/hardsuit/mining | 2000 |
| 47 | Diamond Pickaxe | /obj/item/pickaxe/diamond | 2000 |
| 48 | Super Resonator | /obj/item/resonator/upgraded | 2500 |
| 49 | Jump Boots | /obj/item/clothing/shoes/bhop | 2500 |
| 50 | Luxury Shelter Capsule | /obj/item/survivalcapsule/luxury | 3000 |
| 51 | Luxury Bar Capsule | /obj/item/survivalcapsule/luxuryelite | 10000 |
| 52 | Nanotrasen Minebot | /mob/living/simple_animal/hostile/mining_drone | 800 |
| 53 | Minebot Melee Upgrade | /obj/item/mine_bot_upgrade | 400 |
| 54 | Minebot Armor Upgrade | /obj/item/mine_bot_upgrade/health | 400 |
| 55 | Minebot Cooldown Upgrade | /obj/item/borg/upgrade/modkit/cooldown/minebot | 600 |
| 56 | Minebot AI Upgrade | /obj/item/slimepotion/slime/sentience/mining | 1000 |
| 57 | KA Minebot Passthrough | /obj/item/borg/upgrade/modkit/minebot_passthrough | 100 |
| 58 | KA White Tracer Rounds | /obj/item/borg/upgrade/modkit/tracer | 100 |
| 59 | KA Adjustable Tracer Rounds | /obj/item/borg/upgrade/modkit/tracer/adjustable | 150 |
| 60 | KA Super Chassis | /obj/item/borg/upgrade/modkit/chassis_mod | 250 |
| 61 | KA Hyper Chassis | /obj/item/borg/upgrade/modkit/chassis_mod/orange | 300 |
| 62 | KA Range Increase | /obj/item/borg/upgrade/modkit/range | 1000 |
| 63 | KA Damage Increase | /obj/item/borg/upgrade/modkit/damage | 1000 |
| 64 | KA Cooldown Decrease | /obj/item/borg/upgrade/modkit/cooldown | 1000 |
| 65 | KA AoE Damage | /obj/item/borg/upgrade/modkit/aoe/mobs | 2000 |

The golem subtype `/obj/machinery/mineral/equipment_vendor/golem` (machine_vending.dm:210) appends 8 more entries in its own `Initialize` (machine_vending.dm:216-225). It is not on this shard's list. The board for it is `/obj/item/circuitboard/machine/mining_equipment_vendor/golem` (machine_circuitboards.dm:1137-1139).

- Construction chain: board `/obj/item/circuitboard/machine/mining_equipment_vendor`, name `Mining Equipment Vendor (Machine Board)`, `build_path = /obj/machinery/mineral/equipment_vendor`, `req_components` = `/obj/item/stack/sheet/glass = 1`, `/obj/item/stock_parts/matter_bin = 3` (machine_circuitboards.dm:1129-1135). `needs_anchored` default TRUE (circuitboard.dm:27). Use the frame steps in shared rules (5 metal sheets; cable coil 5; wrench to anchor; board; 1 glass sheet and 3 matter bins; screwdriver to finish).
- Deconstruction chain: screwdriver (no delay) → panel open; crowbar (no delay) → `deconstruct(TRUE)`: frame at state 2, board, 3 matter bins, 1 glass sheet dropped (_machinery.dm:402-410, 412-420). Messages as in shared rules.
- Drops:
  - (a) Destroyed by damage (integrity 0): `deconstruct(FALSE)` (obj_defense.dm:252-258): frame at 50 % integrity, board + 3 matter bins + glass sheet dropped (_machinery.dm:416-417, 405-409).
  - (b) Deleted by explosion (`qdel(src)`, machine_vending.dm:205-206): `qdel` does not call `deconstruct`. `Destroy` deletes every `component_parts` item (_machinery.dm:172-175). Result: no frame, and the board and parts are deleted, not dropped (inferred from the code path; no `deconstruct` call).
  - Stays behind: nothing in (b); in (a) the frame.
- Health / armor: `max_integrity` 200, armor default, `integrity_failure` 0 (shared rules). `ex_act` (machine_vending.dm:203-206) is the only explosion handler; it bypasses the armor path.
- Power: none on the type. No `process()` override (base returns PROCESS_KILL, _machinery.dm:181-182), and no `use_power()` call. Sprite switch: `powered()` gives `mining-off` (`"[initial(icon_state)]-off"`) when unpowered (machine_vending.dm:87-91). `can_interact` (_machinery.dm:250-252) blocks interaction when NOPOWER or BROKEN (the TGUI state's use of this is not traced).
- Gotchas:
  1. Infinite stock: the purchase only spends points. `new prize.equipment_path(loc)` is made every time (machine_vending.dm:158).
  2. Points live on the ID card (`mining_points`), not on the machine. Points come from the ore redemption machine's `Claim` (machine_redemption.dm:260-271).
  3. Explosion deletes the vendor and its board, and makes no drop (machine_vending.dm:204-206 with _machinery.dm:172-175).
  4. `inserted_id` is declared (line 13) and never written in this file.
  5. The voucher redemption is a free-standing `input()` on the redeemer and adds no points (machine_vending.dm:172-201). Its `Adjacent` and loc checks are at line 176.

---

## Ore redemption machine

### ore redemption machine  `/obj/machinery/mineral/ore_redemption`   (code/modules/mining/machine_redemption.dm:4)
- What it is: a mining intake that turns ore pieces into material sheets. It gives reward points, sends a station request-console message, and releases stored sheets (with access) for use. It also runs an alloy smelter from a research disk. Ore is taken from the tile on its input side, and output goes to the tile on its output side.
- Key vars:
  - `name = "ore redemption machine"` (machine_redemption.dm:5); `desc = "A machine that accepts ore and instantly transforms it into workable material sheets. Points for ore are generated based on type and can be redeemed at a mining equipment vendor."` (machine_redemption.dm:6)
  - `icon_state = "ore_redemption"` (8); `density = TRUE` (9); `input_dir = NORTH` (10); `output_dir = SOUTH` (11)
  - `req_access = list(ACCESS_MINERAL_STOREROOM)` (12) (ACCESS_MINERAL_STOREROOM = 64, code/__DEFINES/access.dm:74); used by `allowed(usr)` in `Release` and `Smelt` (machine_redemption.dm:277, 334)
  - `layer = BELOW_OBJ_LAYER` (13); `circuit = /obj/item/circuitboard/machine/ore_redemption` (14)
  - `ui_x = 440`, `ui_y = 550` (15-16); `needs_item_input = TRUE` (17); `processing_flags = START_PROCESSING_MANUALLY` (18)
  - `var/points = 0` (20); `var/ore_multiplier = 1` (21); `var/point_upgrade = 1` (22)
  - `var/list/ore_values` (23): iron 1, glass 1, plasma 15, silver 16, gold 18, titanium 30, uranium 30, diamond 50, bluespace 50, bananium 60. Used only as `value` in the UI (machine_redemption.dm:229).
  - `console_notify_timer` (25), `stored_research` (26), `inserted_disk` (27), `materials` (28)
  - `max_integrity` 200, armor default, `integrity_failure` 0 (shared rules).
- Initialize (machine_redemption.dm:30-33): `stored_research = new /datum/techweb/specialized/autounlocking/smelter`; `materials = AddComponent(/datum/component/remote_materials, "orm", mapload)`. `allow_standalone` keeps its default TRUE, so a runtime-placed machine makes local storage (remote_materials.dm:19-33). A map-placed one on station z tries the silo on a timer (remote_materials.dm:30-31, 35-41).
- RefreshParts (machine_redemption.dm:40-48): `ore_multiplier = round(0.65 + 0.35 * matter_bin_rating, 0.01)`; `point_upgrade = 0.65 + 0.35 * micro_laser_rating` (not rounded). Basic parts give 1 and 1.
- examine (machine_redemption.dm:50-55): in range or observer: `<span class='notice'>The status display reads: Smelting <b>[ore_multiplier]</b> sheet(s) per piece of ore.<br>Reward point generation at <b>[point_upgrade*100]%</b>.</span>`. When panel open: `<span class='notice'>Alt-click to rotate the input and output direction.</span>`.

#### Interactions (every tool/item/intent that does something)

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| wrench | any | 20 (default `time = 20`, _machinery.dm:475) | `You begin [anchored ? "un" : ""]securing [src]...` (_machinery.dm:481); `You [anchored ? "un" : ""]secure [src].` (486); unsecured off-floor: `[src] needs to be on the floor to be secured!` (_machinery.dm:471) | `default_unfasten_wrench` (machine_redemption.dm:165-172, _machinery.dm:475-492). Anchoring re-registers the input turf; unanchoring unregisters it. |
| screwdriver | any | none | `You open the maintenance hatch of [src].` (_machinery.dm:453) | `default_deconstruction_screwdriver(user, "ore_redemption-open", "ore_redemption", W)` (machine_redemption.dm:177); then `updateUsrDialog()` |
| crowbar | panel open | none (sound 50) | none | `default_deconstruction_crowbar(W)` → `deconstruct(TRUE)` (machine_redemption.dm:180-181) |
| design disk (`/obj/item/disk/design_disk`) | powered | none | none | moved into the machine: `inserted_disk = W` (machine_redemption.dm:186-189). Refused without power (183-184), falls to `..()`. |
| refined ore stack, `refined_type == null` | powered | none | `[O] has already been refined!` (machine_redemption.dm:193-194) | refused |
| any other item | powered or not | none | none | `..()` → `/obj/attackby` → `I.attack_obj(src, user)` hit (item_attack.dm:58-59); this is the generic hit path |
| alt-click | panel open, adjacent (`canUseTopic(src, BE_CLOSE)`) | none | `You change [src]'s I/O settings, setting the input to [dir2text(input_dir)] and the output to [dir2text(output_dir)].` (machine_redemption.dm:206) | rotates `input_dir` and `output_dir` by -90, re-registers the input turf (199-209) |
| ore or ore box on input turf | not panel open, `materials.mat_container` present, powered | none | none; the 5-second report timer is started (161-163) | `pickup_item` (146-163): ore box → `process_ores(box.contents)`; ore stack → `smelt_ore(O)`; other items ignored |
| click (`attack_hand`) | any | none | none | TGUI `OreRedemptionMachine` (machine_redemption.dm:211-215) |
| explosion (`ex_act`) | any | none | sparks `do_sparks(5, TRUE, src)` (machine_redemption.dm:355) | then base explosion (`..()`) |

TGUI actions (`ui_act`, machine_redemption.dm:255-352):

| action | condition | delay (ds) | messages (verbatim) | result |
|---|---|---|---|---|
| `Claim` | `points` > 0 | none | `No valid ID detected.` (268); `No points to claim.` (270) | `I.mining_points += points`, `points = 0` (263-266) |
| `Release` | not on hold; `allowed(usr)`; amount > 0 | none | `Mineral access is on hold, please contact the quartermaster.` (276); `Required access not found.` (278) | `sheets = round(min(desired, 50, stored_amount))` (297), `retrieve_sheets(..., get_step(src, output_dir))` (299); silo log `released` (302). Max 50 per action. |
| `diskInsert` | holding a design disk | none | `Not a valid Design Disk!` (312) | `inserted_disk = disk` (305-310) |
| `diskEject` | disk inserted | none | none | `put_in_hands`, `inserted_disk = null` (314-318) |
| `diskUpload` | disk slot `n` exists | none | none | `stored_research.add_design(...)` (319-323) |
| `Smelt` | not on hold; `check_access(I) || allowed(usr)`; alloy researched and `can_smelt_alloy` | none | `Mineral access is on hold, please contact the quartermaster.` (328); `Required access not found.` (351) | `use_materials(alloy.materials, amount)` (342), `amount = round(min(desired, 50, smelt_amount))` (341); output `new alloy.build_path(...)`, unloaded (344-349). Stack alloys get `amount` sheets (345-346). |

- `ui_data` status strings (machine_redemption.dm:236-241): `local mineral storage is unavailable`; `no ore silo connection is available; storing locally`; `mineral withdrawal is on hold`.
- Sheets are shown as `amount / MINERAL_MATERIAL_AMOUNT` (machine_redemption.dm:227), where `MINERAL_MATERIAL_AMOUNT` = 2000 (code/__DEFINES/construction.dm:70).

#### Ore intake (`smelt_ore`, machine_redemption.dm:57-83)

1. `refined_type == null` → return with no effect (64-65).
2. `points += O.points * point_upgrade * O.amount` (67-68). Points are added before the space check, so they are kept even if the ore is ejected or incinerated below.
3. `material_amount = get_item_material_amount(O)`. If 0: `qdel(O)`, incinerated (72-73).
4. If `!has_space(material_amount * O.amount)`: `unload_mineral(O)` to the output tile (75-76).
5. Otherwise: `insert_item(O, ore_multiplier)` (81), silo log `smelted` (82), `qdel(O)` (83).

Report: `send_console_message` runs 5 seconds (`5 SECONDS`, machine_redemption.dm:163) after the first pickup. It sends an `ore_update` subspace message `Now available in [A]:<br>` with each material as `capitalize(M.name): [sheets] sheets` (machine_redemption.dm:115-144). Silent when off-station (117) or when no material is present (134-135). The sender is `Ore Redemption Machine`, verified line `Verified by Ore Redemption Machine` (139-141).

#### Construction chain (board to machine)

Board `/obj/item/circuitboard/machine/ore_redemption`, name `Ore Redemption (Machine Board)`, `build_path = /obj/machinery/mineral/ore_redemption`, `req_components` = `/obj/item/stack/sheet/glass = 1`, `/obj/item/stock_parts/matter_bin = 1`, `/obj/item/stock_parts/micro_laser = 1`, `/obj/item/stock_parts/manipulator = 1`, `/obj/item/assembly/igniter = 1`. `needs_anchored = FALSE` (machine_circuitboards.dm:1141-1151). The igniter path is `/obj/item/assembly/igniter` (code/modules/assembly/igniter.dm:6).

- Use the shared frame steps (frame, cable coil 5, anchor, board). The board can go in without the frame anchored, because `needs_anchored` is FALSE (constructable_frame.dm:125-127 is skipped). Then the built machine keeps the frame's anchored state (constructable_frame.dm:190).
- Finish with the frame screwdriver once all counts are 0 (constructable_frame.dm:178-201).

#### Deconstruction chain

1. Wrench (anchored → off): `default_unfasten_wrench` (20 ds). It needs the floor when unanchored (_machinery.dm:470-472), and the machine re-registers or unregisters its input turf (machine_redemption.dm:165-172).
2. Screwdriver (no delay): panel open, icon `ore_redemption-open`.
3. Crowbar with the panel open: `deconstruct(TRUE)` (machine_redemption.dm:180-181; _machinery.dm:402-410). Frame at state 2, parts dropped (`component_parts`: board, 1 glass, 1 matter bin, 1 micro-laser, 1 manipulator, 1 igniter, _machinery.dm:405-409; circuitboard.dm:35-56).
4. Then `Destroy`: `dropContents()` moves any contents (the design disk, if inserted) to the floor (_machinery.dm:171, 201-210). `remote_materials` `Destroy`: a silo link is removed (remote_materials.dm:44-47); local storage is `retrieve_all` to the floor (remote_materials.dm:49-52).

#### Drops

- (a) Destroyed by damage: `deconstruct(FALSE)` (obj_defense.dm:252-258). Frame at 50 % integrity, all `component_parts`, the inserted disk (contents) and local storage sheets drop (_machinery.dm:416-417, 405-409, 171, remote_materials.dm:49-52). Points are lost (no drop, machine var).
- (b) Deconstructed properly: same list with the frame at full integrity.
- Stays behind: nothing extra. Points on the machine are lost in both cases.

#### Health, power, gotchas

- Health: `max_integrity` 200 (inherited), armor default, `integrity_failure` 0, `damage_deflection` 0 (shared rules).
- Power: no `process()` and `START_PROCESSING_MANUALLY` (machine_redemption.dm:18), so SSmachines never runs it; no `use_power()` call; `idle_power_usage` / `active_power_usage` unset (0). `powered()` gates intake (machine_redemption.dm:149), the attack chain past the wrench and screwdriver (183), and the icon `ore_redemption-off` (358-362).
- Gotchas:
  1. Intake must be on the NORTH side (`input_dir = NORTH`, machine_redemption.dm:10) and output on the SOUTH side (11). Alt-click with the panel open rotates both (199-209).
  2. Points are added before the space check, so a full machine still scores ore that it ejects (machine_redemption.dm:67-76).
  3. An ore stack with no material in the list is incinerated after the points are added (machine_redemption.dm:72-73).
  4. Release is capped at 50 sheets per action (297); smelt at 50 (341).
  5. Access: `Release` and `Smelt` need `allowed(usr)` (or the ID for `Smelt`), `ACCESS_MINERAL_STOREROOM` (req_access, line 12). `Claim` needs no access; it credits the ID in the user's hand or card (`get_idcard(TRUE)`, line 262).
  6. The disk's alloys need `stored_research`, which starts from `autounlocking/smelter` (line 32). Only designs in it can be smelted.
  7. The ore value and points per ore type are on the ore stack types (`O.points`, `O.refined_type`), not on this machine. Those types were not read in this part.
  8. `ore_redemption` is `needs_item_input` (line 17) and the mineral parent registers the input turf only when anchored (machine_processing.dm:17-20).

### Placement and snapshot

- BoxStation: equipment vendor x1 and ore redemption x1 (list).
- Newer snapshot (`Downloads/tgstation-1da0...`): not checked for these parts.

# gap-things-05.4: Stacking machine family and point claim console

Four types: the stacking machine and its console (a sheet stacker and its controller), the labor stacker (a stacker that also scores sheets as prisoner points), and the point claim console that reads the labor stacker and sends the shuttle. All four sit on the `/obj/machinery/mineral` parent (code/modules/mining/machine_processing.dm, summarised in `gap-things-05.3.md`). None of them runs the automatic power loop, and none has a `use_power()` call.

Shared machine rules (frame, parts, destruction, base health) are in `gap-things-05.1.md`, "Shared rules".

---

## Stacking machine

### stacking machine  `/obj/machinery/mineral/stacking_machine`   (code/modules/mining/machine_stacking.dm:68)
- What it is: a sheet stacker. Sheets that arrive on its input tile are either sent to an ore silo (if one is linked) or stacked internally. Every 50 sheets are pushed out on its output tile. A stacking console (`/obj/machinery/mineral/stacking_unit_console`) releases what it holds.
- Key vars:
  - `name = "stacking machine"` (machine_stacking.dm:69); `icon_state = "stacker"` (71); `desc = "A machine that automatically stacks acquired materials. Controlled by a nearby console."` (72)
  - `density = TRUE` (73); `circuit = /obj/item/circuitboard/machine/stacking_machine` (74)
  - `input_dir = EAST` (75); `output_dir = WEST` (76)
  - `var/obj/machinery/mineral/stacking_unit_console CONSOLE` (77)
  - `var/stk_types = list()` (78), `var/stk_amt = list()` (79): declared, not used in this file
  - `var/stack_list[0]` (80): key = sheet type (`merge_type`), value = a stack object (comment at line 80)
  - `var/stack_amt = 50` (81): amount stacked before a release
  - `var/datum/component/remote_materials/materials` (82); `var/force_connect = FALSE` (83)
  - `max_integrity` 200, armor default, `integrity_failure` 0 (shared rules).
- Initialize (machine_stacking.dm:85-88): `proximity_monitor = new(src, 1)` (87) gives `HasProximity` a 1-tile radius. `materials = AddComponent(/datum/component/remote_materials, "stacking", mapload, FALSE, mapload && force_connect)` (88): `allow_standalone` is FALSE, so a runtime-placed stacker has no local storage (remote_materials.dm:19-33). A map-placed one joins the silo on a timer when `force_connect` is set or it is on station z (remote_materials.dm:30-31, 35-41; LateInitialize makes local storage if no silo).
- Destroy (machine_stacking.dm:90-93): `CONSOLE = null`, `materials = null`, then the parent `Destroy`.
- HasProximity (machine_stacking.dm:95-99): a `/obj/item/stack/sheet` whose `loc` is `get_step(src, input_dir)` (the tile to the EAST) → `process_sheet(AM)`.
- multitool_act (machine_stacking.dm:101-107): if the multitool buffer is a stacking console, `CONSOLE = M.buffer`, `CONSOLE.machine = src`, message `You link [src] to the console in [M]'s buffer.` (106), returns TRUE.

#### Interactions

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| sheet placed on the EAST tile | proximity (1 tile) | none | none | `process_sheet` (see below) |
| multitool | buffer holds a stacking console | none | `You link [src] to the console in [M]'s buffer.` (machine_stacking.dm:106) | links the console to this machine |
| multitool | buffer holds something else | none | none | returns nothing (inferred, machine_stacking.dm:101-107) |
| screwdriver, crowbar, wrench | any | none | none | no `attackby` on this type or on the mineral parent (machine_stacking.dm:68-134; machine_processing.dm:5-58). The base `/obj/attackby` gives only a generic hit (item_attack.dm:58-59). No `default_deconstruction_*` call is made here. |

Note: this type has no `attackby`, `attack_hand` or `ui_interact`. Its only controls are the sheet arrival and the multitool link.

#### process_sheet (machine_stacking.dm:109-133)

1. Silo path (114-120): if `materials.silo` is set and not on hold, and the sheet's `custom_materials & mat_container.materials` is non-empty, insert the sheet into the silo (`insert_item`), log `collected`, `qdel(inp)`, return.
2. Internal path (123-133): `key = inp.merge_type`. First sheet of a kind creates `stack_list[key] = new inp.type(src, 0)` (126), which is an object inside the machine. `storage.amount += inp.amount` (127), `qdel(inp)` (128). While `storage.amount >= stack_amt` (50, line 130): `new inp.type(null, stack_amt)` is unloaded to the output tile (131-133) and `storage.amount -= stack_amt`.
- Unload: `unload_mineral` (machine_processing.dm:54-58): `drop_location()`, then to `get_step(src, output_dir)` (WEST).

#### Construction chain
Board `/obj/item/circuitboard/machine/stacking_machine`, name `Stacking Machine (Machine Board)`, `build_path = /obj/machinery/mineral/stacking_machine`, `req_components` = `/obj/item/stock_parts/manipulator = 2`, `/obj/item/stock_parts/matter_bin = 2` (code/game/objects/items/circuitboards/machine_circuitboards.dm:1164-1170). `needs_anchored` default TRUE (circuitboard.dm:27). Use the shared frame steps (5 metal, cable coil 5, anchor, board, two manipulators and two matter bins, screwdriver to finish). No part changes the stack limit: `stack_amt` is fixed at 50 (machine_stacking.dm:81).

#### Deconstruction chain
1. No tool path. The type has no `attackby`, and neither does its parent, so the screwdriver, crowbar and wrench never reach `default_deconstruction_*` (machine_stacking.dm:68-134; machine_processing.dm:5-58). No `default_` call is made in this file.
2. So the machine has no route to `deconstruct(TRUE)` from the player side (inferred from the absence of any such call).
3. Only integrity 0 leads to `deconstruct` (see Drops).

#### Drops
- (a) Destroyed (integrity 0): `deconstruct(FALSE)` (obj_defense.dm:252-258): frame at 50 % integrity, `component_parts` dropped (board, 2 manipulators, 2 matter bins) (_machinery.dm:416-417, 405-409). Also every object in `contents` moves to the floor (`dropContents`, _machinery.dm:171, 201-210): this includes the internal stacks in `stack_list`, since they were created inside the machine (machine_stacking.dm:126).
- (b) Deconstructed properly: not reachable from the player side (see above).
- Stays behind: the frame in (a) only.

#### Health, power
- Health: `max_integrity` 200 (inherited), armor default, `integrity_failure` 0 (shared rules).
- Power: none. `START_PROCESSING_MANUALLY` from the parent (machine_processing.dm:6), no `process()`, no `use_power()` call. The silo path is the only thing it uses from the network, via `materials` (machine_stacking.dm:114).

#### Gotchas
1. Only the EAST tile is read (machine_stacking.dm:98). Output is WEST (line 76).
2. Stacks of 50 are pushed out automatically (machine_stacking.dm:130-133). Stacks under 50 stay inside until the console releases them.
3. Silo mode skips the internal stack entirely (114-120); the silo is only set when linked (remote_materials.dm:30-41, 88-91).
4. `stk_types` and `stk_amt` (lines 78-79) are declared but never used in this file.

---

## Stacking machine console

### stacking machine console  `/obj/machinery/mineral/stacking_unit_console`   (code/modules/mining/machine_stacking.dm:3)
- What it is: the controller for one stacking machine. It shows the internal stacks and releases them (up to all of a type) onto the stacker's output tile.
- Key vars:
  - `name = "stacking machine console"` (machine_stacking.dm:4); `icon_state = "console"` (6); `desc = "Controls a stacking machine... in theory."` (7); `density = FALSE` (8)
  - `circuit = /obj/item/circuitboard/machine/stacking_unit_console` (9)
  - `var/obj/machinery/mineral/stacking_machine/machine` (10); `var/machinedir = SOUTHEAST` (11)
  - `max_integrity` 200, armor default, `integrity_failure` 0 (shared rules).
- Initialize (machine_stacking.dm:13-17): `machine = locate(/obj/machinery/mineral/stacking_machine, get_step(src, machinedir))`; if found, `machine.CONSOLE = src`. It does not delete itself when no machine is found (unlike the labor claim console, see below).
- ui_interact (machine_stacking.dm:19-38): classic browse window, not TGUI.
  - No machine: `<span class='notice'>[src] is not linked to a machine!</span>` (23), return.
  - Otherwise: `<b>Stacking unit console</b><br><br>`, then for each stack with `amount > 0`: `[capitalize(s.name)]: [s.amount] <A href='?src=[REF(src)];release=[s.type]'>Release</A><br>` (31-35), then `<br>Stacking: [machine.stack_amt]<br><br>` (36). Window `console_stacking_machine` (38).
- multitool_act (machine_stacking.dm:40-46): `M.buffer = src` (44), `You store linkage information in [I]'s buffer.` (45), returns TRUE. The stacker then links from the buffer (see the stacker, line 103-106).
- Topic (machine_stacking.dm:48-62): `release` → only if the requested type is in `machine.stack_list` (54-55; the comment there says it stops spoofed hrefs). It makes `new inp.type(null, inp.amount)`, sets the stored amount to 0 (58), and unloads it (59). Then `updateUsrDialog()`.

#### Interactions

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| multitool | any | none | `You store linkage information in [I]'s buffer.` (machine_stacking.dm:45) | writes the buffer |
| click (`attack_hand`) | any | none | `[src] is not linked to a machine!` (23) when unlinked | browse window (38) |
| "Release" link | the type is in the stacker's `stack_list` | none | none | releases the whole stored amount of that type to the stacker's output tile (machine_stacking.dm:53-59) |
| screwdriver, crowbar, wrench | any | none | none | no branch on this type (generic hit only, inferred from `/obj/attackby`, item_attack.dm:58-59) |

#### Construction chain
Board `/obj/item/circuitboard/machine/stacking_unit_console`, name `Stacking Machine Console (Machine Board)`, `build_path = /obj/machinery/mineral/stacking_unit_console`, `req_components` = `/obj/item/stack/sheet/glass = 2`, `/obj/item/stack/cable_coil = 5` (machine_circuitboards.dm:1172-1178). `needs_anchored` default TRUE (circuitboard.dm:27). Shared frame steps. The frame's `req_components` counts stacks (glass 2, cable coil 5) and takes them with `S.use(used_amt)` (constructable_frame.dm:244-262).

#### Deconstruction chain
No tool path: this type has no `attackby` (machine_stacking.dm:3-62), so no tool opens or deconstructs it. Only integrity 0 deconstructs it (see Drops).

#### Drops
- (a) Destroyed (integrity 0): `deconstruct(FALSE)` (obj_defense.dm:252-258). Frame at 50 %, board, one glass stack of 2, one cable coil stack of 5 (`component_parts`, built by `apply_default_parts` with `new comp_path(null, comp_amt)`, circuitboard.dm:50-51; _machinery.dm:416-417, 405-409).
- (b) Not reachable from the player path.

#### Health, power
- Health: 200 max, armor default, `integrity_failure` 0 (shared rules).
- Power: none. No `process()` override, no `use_power()` call.

#### Gotchas
1. The console finds its machine only at `SOUTHEAST` (machine_stacking.dm:11, 15). A machine placed elsewhere is not linked until someone uses a multitool link.
2. The Release list hides types with `amount <= 0` (machine_stacking.dm:33).
3. Release is for the whole stored amount of that type, not a chosen number (machine_stacking.dm:57-59).

---

## Labor stacker (prisoner collection stacker)

### labor stacker  `/obj/machinery/mineral/stacking_machine/laborstacker`   (code/modules/mining/laborcamp/laborstacker.dm:121)
- What it is: a stacking machine used at the labour camp. It inherits everything from `/obj/machinery/mineral/stacking_machine` (above). It also counts the value of every sheet that goes through it as `points`, which the point claim console hands to a prisoner's ID.
- Key vars (added or changed here):
  - `force_connect = TRUE` (laborstacker.dm:122): the stacker tries the silo on mapload, regardless of station z (remote_materials.dm:30).
  - `var/points = 0` (laborstacker.dm:123): `The unclaimed value of ore stacked.`
  - `damage_deflection = 21` (laborstacker.dm:124): melee damage under 21 is ignored (obj_defense.dm:25-26)
  - Everything else is inherited: name, icon, circuit (`/obj/item/circuitboard/machine/stacking_machine`, machine_stacking.dm:74), `input_dir` EAST, `output_dir` WEST, `stack_amt` 50.
- process_sheet override (laborstacker.dm:125-127): `points += inp.point_value * inp.amount`, then `..()` (the stacker's `process_sheet` above). So a sheet's value is counted every time it is processed, including when it goes to a silo.
- attackby override (laborstacker.dm:129-133): if `I` is a `/obj/item/stack/sheet` and `user.canUnEquip(I)`: `points += inp.point_value * inp.amount`. Then `return ..()`.

#### Interactions
- Sheets on the EAST tile: as the stacker, plus the points of process_sheet (125-127).
- Sheet used on the machine (attackby): points are added (131-132). Then `return ..()` → `/obj/attackby` (item_attack.dm:58-59): first `..()` → `/atom/attackby` sends `COMSIG_PARENT_ATTACKBY` (item_attack.dm:53-56). With a silo linked, the remote-materials handler may hand the sheet to the silo (remote_materials.dm:88-91; the silo's handler is not read). Otherwise the base returns FALSE and the sheet attacks the machine: `I.attack_obj(src, user)` (item_attack.dm:58-59). So without a silo, the sheet's points are counted and the sheet is still in the user's hand (inferred from the code as written).
- Multitool, console link: as the stacker (inherited).

#### Construction and deconstruction
- Built with the stacking machine board (inherited circuit, machine_stacking.dm:74; board in machine_circuitboards.dm:1164-1170). Frame steps as for the stacker.
- Deconstruction: as the stacker (not reachable through tools, inferred). Only integrity 0 deconstructs it.

#### Drops
- As the stacking machine: frame at 50 % (obj_defense.dm:252-258; _machinery.dm:416-417), `component_parts` dropped (board, 2 manipulators, 2 matter bins), and `contents` dropped, including the internal stacks (machine_stacking.dm:126; _machinery.dm:171).
- The unclaimed `points` (line 123) are lost when it is destroyed (no drop for a machine variable).

#### Health, power
- Health: `max_integrity` 200 (inherited), armor default, `integrity_failure` 0, `damage_deflection` 21 (laborstacker.dm:124).
- Power: none (as the stacker).

#### Gotchas
1. `points` is kept on the machine until the claim console takes it (the claim console's `claim_points` action, laborstacker.dm:83-84).
2. A sheet that goes into the silo is still counted, through `process_sheet` (laborstacker.dm:125-127 runs before `..()`).
3. The attackby path counts points before the sheet is handled (laborstacker.dm:129-133), so a sheet used on the machine without a silo can score without being stacked (inferred above).

---

## Point claim console

### point claim console  `/obj/machinery/mineral/labor_claim_console`   (code/modules/mining/laborcamp/laborstacker.dm:5)
- What it is: the prisoner-side console. It shows the labor stacker's points, moves them to a prisoner ID, and calls the labour shuttle when the prisoner is alone in the area. Emagged, it lets a prisoner go home whatever the quota.
- Key vars:
  - `name = "point claim console"` (laborstacker.dm:6); `desc = "A stacking console with an electromagnetic writer, used to track ore mined by prisoners."` (7); `icon_state = "console"` (9); `density = FALSE` (10); `ui_x = 315`, `ui_y = 430` (11-12)
  - `var/obj/machinery/mineral/stacking_machine/laborstacker/stacking_machine` (14); `var/machinedir = SOUTH` (15)
  - `var/obj/machinery/door/airlock/release_door` (16); `var/door_tag = "prisonshuttle"` (17): declared, not used in this file
  - `var/obj/item/radio/Radio` (18); the radio is created at Initialize with `listening = FALSE` (22-23)
  - No `circuit` is set (laborstacker.dm:5-18). This machine has no board and cannot be built or taken apart with a frame.
  - `max_integrity` 200, armor default, `integrity_failure` 0 (shared rules).
- Initialize (laborstacker.dm:20-33): `Radio = new/obj/item/radio(src)`; `listening = FALSE`; `locate_stacking_machine()` (24); if `GLOB.labor_sheet_values` is unset, it builds the list of sheets with a `point_value`, sorted by value (26-33).
- locate_stacking_machine (laborstacker.dm:107-112): `locate(/obj/machinery/mineral/stacking_machine, get_step(src, machinedir))` (SOUTH). If a stacker is there, `stacking_machine.CONSOLE = src`. If the lookup returns nothing: `qdel(src)` (111-112). This console deletes itself when no stacker stands to its SOUTH.
- ui_data (laborstacker.dm:45-72): `emagged` (1 or 0); `can_go_home` TRUE when emagged (49-51). For a prisoner ID: `id_points`, `status_info` `Goal met!` when `points >= goal`, else `You are [(P.goal - P.points)] points away.` (53-61). Otherwise `No Prisoner ID detected.` (63). `unclaimed_points` from the stacker (66-67). `ores` = `GLOB.labor_sheet_values` (69).
- Power: none (no process, no use_power).

#### Interactions (ui_act, laborstacker.dm:74-105)

| action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| `claim_points` | ID in the user's hand is a `/obj/item/card/id/prisoner` | none | `Points transferred.` (85); `No valid id for point transfer detected.` (88) | `P.points += stacking_machine.points`, then `stacking_machine.points = 0` (83-84) |
| `move_shuttle` | `alone_in_area(get_area(src), usr)` | none | `Prisoners are only allowed to be released while alone.` (91) | `SSshuttle.moveShuttle("laborcamp", "laborcamp_home", TRUE)` (93). Results: `Shuttle not found.` (95), `Shuttle already at station.` (97), `No permission to dock could be granted.` (99). On success: if not emagged, the radio sends `A prisoner has returned to the station. Minerals and Prisoner ID card ready for retrieval.` on FREQ_SECURITY (102-103); the user sees `Shuttle received message and will be sent shortly.` (104). |

- emag_act (laborstacker.dm:114-117): sets `EMAGGED`, message `PZZTTPFFFT` (117). An emagged console skips the radio message (101-102) and lets the prisoner go home (49-51, 58 for `can_go_home`).

#### Gotchas
1. The console is destroyed (`qdel`) when built or placed with no stacker to its SOUTH (laborstacker.dm:111-112).
2. The stacker's `points` are the only money source; it is zeroed by `claim_points` (84), not by the ID.
3. The shuttle call needs the prisoner alone in the area (laborstacker.dm:90-92).
4. `door_tag` and `release_door` (lines 16-17) are declared but unused in this file.

### Placement and snapshot
- BoxStation counts from the list: stacking machine x1, labor stacker (`laborstacker`) x1, stacking machine console x2, point claim console x1.
- Newer snapshot (`Downloads/tgstation-1da0...`): not checked for these parts.

# gap-things-05.5: Modular console presets (engineering, research)

Two stationary computers. Each is a machine shell (`/obj/machinery/modular_computer`) that holds a separate `cpu` item (`/obj/item/modular_computer/processor`) which does the real work: hardware, programs, power draw, damage and tools. The machine shell only forwards tools, power and explosions to that cpu. The presets are map-only: no board and no build recipe. Only the `buildable` console has a recipe (sheet_types.dm:51), and it is a different type.

Shared machine rules are in `gap-things-05.1.md`. The machine's `use_power = IDLE_POWER_USE` and `idle_power_usage = 5` apply to both presets (modular_computer.dm:7-8).

## Shared rules for modular consoles (read once)

### How the shell and the cpu split (code/modules/modular_computers/computers/)

| Thing | Value | file:line |
|---|---|---|
| Machine `max_integrity` (console) | 300 | machine/modular_console.dm:17 |
| Machine `integrity_failure` (console) | 0.5 (BROKEN at 150) | machine/modular_console.dm:18; code/game/objects/obj_defense.dm:17-18 |
| Machine `steel_sheet_cost` (console) | 10 | machine/modular_console.dm:15 (inherits modular_computer.dm:23) |
| Machine `max_hardware_size` (console) | 4 | machine/modular_console.dm:14 |
| Machine `base_active_power_usage` (console) | 500 (W, as passed to `use_power`) | machine/modular_console.dm:13 |
| Machine `base_idle_power_usage` (console) | 100 | machine/modular_console.dm:12 |
| Machine `idle_power_usage` (shell) | 5, `use_power = IDLE_POWER_USE` | machine/modular_computer.dm:7-8 |
| Machine `light_strength` (console) | 2 | machine/modular_console.dm:16 |
| cpu copies from the shell (`New`) | `obj_integrity`, `max_integrity` (300), `integrity_failure` (0.5), `base_active_power_usage` (500), `base_idle_power_usage` (100), `steel_sheet_cost`, `max_hardware_size`, `hardware_flag` | item/processor.dm:23-39 |
| cpu own `max_integrity` (before copy) | 100 | item/computer.dm:35 |
| cpu armor (not copied from the shell) | melee 0, bullet 20, laser 20, energy 100, bomb 0, bio 100, rad 100, fire 0, acid 0 | item/computer.dm:36 |
| cpu processing | the cpu item starts SSobj processing in its own `Initialize`, and the processor's `New` stops it, so only the shell's `process()` drives the cpu | item/computer.dm:54; item/processor.dm:23 |
| Shell `process()` | `cpu.name = name`, then `cpu.process()` | machine/modular_computer.dm:114-118 |
| cpu `process()` when off | returns at once: `if(!enabled) return 0` | item/computer.dm:281-285 |
| cpu `process()` when on | checks integrity (shutdown at `integrity_failure * max_integrity`), runs programs, then `handle_power()` | item/computer.dm:286-313 |
| `handle_power()` | `power_usage = screen_on ? base_active : base_idle`; plus `power_usage` of each enabled hardware part; `use_power(power_usage)`; on failure `power_failure()` | item/computer_power.dm:44-61 |
| cpu `use_power(amount)` | recharger first (`check_power_override`, then `recharger.use_power`), then battery | item/computer_power.dm:1-21 |
| APC connector (`apc_recharger`) draw | if the shell is `powered()`, `M.use_power(amount)` on the shell → area; else the area directly | hardware/recharger.dm:32-46 |
| Processor board `power_usage` | 50 | hardware/CPU.dm:9 |
| Hard drive (base) `power_usage` | 25 | hardware/hard_drive.dm:4 |
| AI slot `power_usage` | 100 (comment `//W`) | hardware/ai_slot.dm:4 |
| `power_failure()` text | `<span class='danger'>\The [src]'s screen flickers ... "EXTERNAL POWER LOSS" warning as it shuts down unexpectedly.</span>` | machine/modular_computer.dm:121-129 (text at :124) |

### Power on and off (computer.dm:246-279)
- `interact` on the shell → `cpu.interact(user)` (machine/modular_computer.dm:107-111). If the cpu is enabled: `ui_interact` (computer.dm:246-248). If not: `turn_on(user)`.
- `turn_on`: refused when `obj_integrity <= integrity_failure * max_integrity` (computer.dm:254-258). Recharger enabled (264). Needs a processor board (`all_components[MC_CPU]`) and `use_power()` (266). Sets `enabled = 1` (271), `update_icon()` (272), opens the UI (273).
- Messages (verbatim, computer.dm):
  - broken, not synth: `You press the power button, but the computer fails to boot up, displaying variety of errors before shutting down again.` (258)
  - on, not synth: `You press the power button and start up \the [src].` (270)
  - unpowered or no cpu board, not synth: `You press the power button but \the [src] does not respond.` (278)
  - synth variants at lines 256, 268, 276 (`You send an activation signal to \the [src]...`).

### Tools on the shell (machine/modular_computer.dm:138-141 → item/computer.dm:411-473)
- The shell forwards every tool to the cpu's `attackby` unless `NODECONSTRUCT_1` is set (modular_computer.dm:138-141).
- The cpu's `attackby` order: each installed hardware gets `try_insert(W, user)` first (computer.dm:414-416), then `install_component` for a hardware item (419-421), then wrench, welder, screwdriver (423-469).

| held item | condition | delay (ds) | message(s) verbatim | result | file:line |
|---|---|---|---|---|---|
| hardware part (not a slot match) | size and slot free | none | `You install \the [H] into \the [src].` (computer_components.dm:25); refused: `This component is too large for \the [src]!` (:6), `This computer's hardware slot is already occupied by ...` (:10) | `install_component` (computer_components.dm:16-27) | computer.dm:418-420 |
| screwdriver | nothing installed | none | `This device doesn't have any components installed.` | nothing | computer.dm:447-452 |
| screwdriver | components installed | none (no `use_tool`); an input menu first: `Which component do you want to uninstall?` | `You remove \the [H] from \the [src].` (computer_components.dm:38) | `uninstall_component` → the part is moved to the cpu's turf (computer_components.dm:32-40) | computer.dm:456, 469 |
| wrench | any component installed | none | `Remove all components from \the [src] before disassembling it.` | refused | computer.dm:423-426 |
| wrench | empty cpu | none | `\The [src] is disassembled by [user].` (computer.dm:428) | `new /obj/item/stack/sheet/metal(get_turf(src.loc), steel_sheet_cost)` = 10 metal (computer.dm:427), `relay_qdel()` (429) → shell deleted, then cpu deleted (430) | computer.dm:423-430; processor.dm (`relay_qdel` → `qdel(machinery_computer)`) |
| welder | cpu damaged | 20 (`use_tool`, volume 50, amount 1) | `You begin repairing damage to \the [src]...` (441); `You repair \the [src].` (444); if full: `\The [src] does not require repairs.` (435) | `obj_integrity = max_integrity` on the **cpu item only** (443) | computer.dm:433-445 |
| shell examine | any | none | the parts line: `It has a slot installed for an intelliCard.` (`_modular_computer_shared.dm:33-44`); `It has two slots installed for identification cards.` (:46-58); `It has a printer installed.` (:60-64) | text only | _modular_computer_shared.dm:28-64 |
| shell AltClick | any | none | (ID / disk / intelliCard ejection, computer.dm:130-145) | ejects | machine/modular_computer.dm:101-104 |
| shell emag | cpu not present | none | `You'd need to turn the [src] on first.` | refused | machine/modular_computer.dm:50-54 |

### Damage (two separate pools)
- Shell (`max_integrity` 300, modular_console.dm:17): generic damage goes to the shell. At 150 it is BROKEN (`obj_break`, _machinery.dm:422-429; `integrity_failure` 0.5). BROKEN stops interaction (`can_interact`, _machinery.dm:250-252). At 0: `deconstruct(FALSE)` (obj_defense.dm:252-258).
- cpu item (own `max_integrity` 300 copied, `integrity_failure` 0.5): at 150 it shuts down and will not boot (computer.dm:254-258, 286-288). At 0: `deconstruct` → `break_apart()` (computer_damage.dm:16-35).
- Who damages the cpu: `bullet_act` (machine/modular_computer.dm:168-170), `ex_act` queues the cpu into `SSexplosions` by severity (146-155), `emp_act` (158-163). The shell's generic `take_damage` does not pass to the cpu.
- Each hit on the cpu may hit each hardware part: `component_probability = min(50, max(damage_amount*0.1, 1 - obj_integrity/max_integrity))`, or `damage_amount*0.5` for bullets, `*0.66` for lasers (computer_damage.dm:1-14).

### Presets' hardware and programs (console_presets.dm)

| preset | `console_department` | `_has_*` flags (console_presets.dm:2-6) | hardware added in `Initialize` (console_presets.dm:8-22) | programs (console_presets.dm) |
|---|---|---|---|---|
| engineering | `Engineering` (line 32) | all FALSE | processor board (12) | `power_monitor`, `alarm_monitor`, `supermatter_monitor` (37-40) |
| research | `Research` (line 44) | `_has_ai = TRUE` (line 47) | processor board (12), AI slot (20-21) | `ntnetmonitor`, `chatclient`, `aidiag`, `robocontrol` (50-54) |

Both also get, from the console base (modular_console.dm:31-41): the battery removed if present (33-35), a wired network card (37-39), an `apc_recharger` (40), and a `hard_drive/super` (41). The network card's `identification_string` is `[area name] [department] Console` with spaces to underscores and `-` removed (modular_console.dm:43-50).

---

## Engineering console

### engineering console  `/obj/machinery/modular_computer/console/preset/engineering`   (code/modules/modular_computers/computers/machinery/console_presets.dm:31)
- What it is: a fixed computer in engineering, preloaded with the power, alarm and supermatter monitors.
- Key vars (type): `name = "engineering console"` (console_presets.dm:33); `desc = "A stationary computer. This one comes preloaded with engineering programs."` (34); `console_department = "Engineering"` (32). Everything else from `console` (modular_console.dm) and `modular_computer.dm`.
- Hardware: processor board (`/obj/item/computer_hardware/processor_unit`, hardware/CPU.dm:4), wired network card, APC recharger, super hard drive (from the console base). No card slot, no printer, no battery, no AI slot (all `_has_*` FALSE, console_presets.dm:2-6).
- Interactions: see the shared table above (tools on the shell, click to power on or open).
- Construction chain: none. The type has no `circuit` and no recipe. Built as a map object only (inferred from the absence of any `circuit`, modular_computer.dm:3-37 and modular_console.dm:1-19).
- Deconstruction chain (player route):
  1. Screwdriver, once per component: pick the part from the menu (computer.dm:456), `You remove ... from ...` (computer_components.dm:38). Each part lands on the floor (computer_components.dm:40). Repeat until empty. Covers the processor board, the drive, the recharger and the network card.
  2. Wrench, empty cpu: `\The [src] is disassembled by [user].` → 10 metal sheets (computer.dm:427-428). The shell and cpu are deleted (computer.dm:429-430).
- Drops:
  - (a) Shell destroyed (integrity 0): `deconstruct(FALSE)` (obj_defense.dm:252-258), no `component_parts`, so no frame (_machinery.dm:402-410). Then `Destroy`: `QDEL_NULL(cpu)` (modular_computer.dm:35-37) → cpu `Destroy` deletes each installed part (computer.dm:61-73). **Hardware is deleted, not dropped.** No metal either.
  - (b) cpu destroyed (cpu integrity 0): `deconstruct` → `break_apart` (computer_damage.dm:16-17, 19-35): `round(steel_sheet_cost/2)` = 5 metal sheets (computer_damage.dm:23); each installed part is uninstalled to the turf (computer_damage.dm:24-28) and has a 25 % chance of `rand(10,30)` BRUTE (computer_damage.dm:30-31); then `relay_qdel()` deletes the shell (processor.dm `relay_qdel`), then the cpu is deleted.
  - (c) Deconstructed properly (wrench, empty cpu): 10 metal sheets (computer.dm:427), parts already on the floor from the screwdriver steps.
  - Stays behind: in (a) nothing; in (b) 5 metal and the parts; in (c) 10 metal and whatever parts were removed earlier.
- Health / armor: shell `max_integrity` 300, `integrity_failure` 0.5 (modular_console.dm:17-18); armor is the machinery default (_machinery.dm:136-137) because the shell sets none. cpu: as shared (computer.dm:35-36, copies at processor.dm:35-37).
- Power:
  - Off: the shell's own idle draw only, `idle_power_usage = 5` each SSmachines fire (modular_computer.dm:7-8; machines.dm:37-45). The cpu returns early when disabled (computer.dm:281-285), so it draws nothing else.
  - On: each fire, `handle_power` draws `base_active_power_usage` 500 (screen on) plus enabled hardware: processor board 50 (CPU.dm:9), hard drive 25 at the base type (hard_drive.dm:4; the super type's value not read), network card, recharger (not read) (computer_power.dm:44-61). Total while on: 5 + 500 + hardware (inferred sum).
  - The draw goes through the APC connector to the shell, then the area (recharger.dm:32-37). Without power the connector returns 0 and the console shuts down (`power_failure`, computer_power.dm:56-60; modular_computer.dm:121-129).
- Gotchas:
  1. Two integrity pools (shell 300 with BROKEN at 150; cpu 300 with shutdown at 150). Damage from bullets, lasers and explosions goes to the cpu, not the shell.
  2. Destroying the shell deletes its hardware with no drop. Breaking the cpu drops the hardware but only 5 metal.
  3. The welder repairs only the cpu (computer.dm:443).
  4. The screwdriver removes one part per use via a menu, with no delay (computer.dm:447-469).
  5. The machine's programs are fixed by the preset (console_presets.dm:37-40), so removing the hard drive removes them.
  6. `can_install_component` rejects a part if the slot is taken or the part is too large (computer_components.dm:1-14).

## Research director's console

### research director's console  `/obj/machinery/modular_computer/console/preset/research`   (code/modules/modular_computers/computers/machinery/console_presets.dm:43)
- What it is: a fixed computer for the research office, with an AI slot and the research programs.
- Key vars (type): `name = "research director's console"` (console_presets.dm:45); `desc = "A stationary computer. This one comes preloaded with research programs."` (46); `console_department = "Research"` (44); `_has_ai = TRUE` (47).
- Hardware: processor board, AI slot (`/obj/item/computer_hardware/ai_slot`, hardware/ai_slot.dm:1), wired network card, APC recharger, super hard drive. No card slot, no printer, no battery (console_presets.dm:20-21 for the AI slot).
- Interactions: as shared, plus the AI slot's rules: `try_insert` (hardware/ai_slot.dm:28), `on_install` / `on_remove` (22-25), `try_eject` (47). Alt-click ejects the intelliCard (`_modular_computer_shared.dm:39-42`). The AI-slot text in examine is at `_modular_computer_shared.dm:33-44`.
- Construction chain: none (as the engineering console).
- Deconstruction chain: as the engineering console (screwdriver per part, then wrench on an empty cpu). An intelliCard inside the AI slot is held by the slot (`handle_atom_del`, ai_slot.dm:12-15; not traced further).
- Drops:
  - (a) Shell destroyed: parts deleted, no drop (as engineering). The intelliCard in the slot is not traced here.
  - (b) cpu destroyed: 5 metal sheets and each installed part dropped on the turf (computer_damage.dm:16-35).
  - (c) Wrench on empty cpu: 10 metal sheets (computer.dm:427).
- Health / armor: as engineering (shared).
- Power:
  - Off: shell idle 5 only (modular_computer.dm:7-8; computer.dm:281-285).
  - On: base 500 (screen on) plus enabled hardware. Research-specific adds: AI slot `power_usage` 100 (ai_slot.dm:4), processor 50 (CPU.dm:9), hard drive 25 (hard_drive.dm:4 base), network card and recharger (not read). Total while on: 5 + 500 + 100 + 50 + 25 + other enabled hardware (inferred sum). The AI slot's 100 counts only while that hardware is `enabled` (computer_power.dm:52-54).
- Gotchas:
  1. The AI slot adds 100 to every enabled tick. Turning the console off stops it.
  2. The research programs (ntnetmonitor, chatclient, aidiag, robocontrol) are fixed by the preset (console_presets.dm:50-54).
  3. The network identification is `[area] Research Console`, with underscores (modular_console.dm:45-46).

---

## Shared notes

- Build: none for either preset. The only build route in this code is the `buildable` console (`/obj/machinery/modular_computer/console/buildable`): 10 metal sheets, 25 ds, one per turf, on floor (code/game/objects/items/stacks/sheets/sheet_types.dm:51; modular_console.dm:21-29 strips the drive, network card and recharger, leaving an empty frame). It has no processor board, so it cannot power on until one is installed.
- BoxStation: engineering x2, research x1 (list).
- Newer snapshot (`Downloads/tgstation-1da0...`): not checked for these parts.

### Entries in this part
- `/obj/machinery/modular_computer/console/preset/engineering`: documented above.
- `/obj/machinery/modular_computer/console/preset/research`: documented above.

# gap-things-05.6: Nanite chamber, nanite program hub, nanite programmer

Three research machines for nanite programs. The chamber injects, cleans and holds a living occupant. The hub downloads programs from the global science techweb onto disks. The programmer edits a disk's program. None of the three defines a `process()` or calls `use_power()`, so their declared power numbers are never drawn in this source (see Power in each entry).

Shared machine rules (frame, parts, destruction, base health) are in `gap-things-05.1.md`, "Shared rules". Tool dispatch order for all three: `tool_act` (screwdriver_act, crowbar_act), then `pre_attack`, then `attackby`, then `afterattack` (code/_onclick/item_attack.dm:1-20). The hub and programmer answer screwdrivers and crowbars in `screwdriver_act` and `crowbar_act`, so their `attackby` never sees those tools. The chamber answers them in `attackby` (its `screwdriver_act` is the atom default, atoms.dm:1156-1157).

---

## Nanite chamber

### nanite chamber  `/obj/machinery/nanite_chamber`   (code/modules/research/nanites/nanite_chamber.dm:1)
- What it is: a closed chamber with a door that holds one living mob (`occupant_typecache = GLOB.typecache_living`, nanite_chamber.dm:25). It injects a nanite datum into the occupant, or removes them, and reports progress on its face.
- Key vars:
  - `name = "nanite chamber"` (line 2); `desc = "A device that can scan, reprogram, and inject nanites."` (3); `circuit = /obj/item/circuitboard/machine/nanite_chamber` (4)
  - `icon = 'icons/obj/machines/nanite_chamber.dmi'` (5); `icon_state = "nanite_chamber"` (6); `layer = ABOVE_WINDOW_LAYER` (7); `anchored = TRUE` (9); `density = TRUE` (10)
  - `use_power = IDLE_POWER_USE` (8); `idle_power_usage = 50` (11); `active_power_usage = 300` (12). No code in the file draws them (see Power).
  - `var/obj/machinery/computer/nanite_chamber_control/console` (14): set by the control computer (not read)
  - `var/locked = FALSE` (15); `var/breakout_time = 1200` (16, deciseconds); `var/scan_level` (17); `var/busy = FALSE` (18); `busy_icon_state` (19), `busy_message` (20), `message_cooldown = 0` (21)
  - `max_integrity` 200, armor default, `integrity_failure` 0 (inherited, shared rules).
- RefreshParts (nanite_chamber.dm:27-30): `scan_level` = sum of the `rating` of the scanning modules in `component_parts`.
- examine (32-35): in range or observer: `<span class='notice'>The status display reads: Scanning module has been upgraded to level <b>[scan_level]</b>.</span>`
- Procs that the control computer calls (the chamber does not call them on its own):
  - `inject_nanites()` (53-70) and `remove_nanites(datum/nanite_program/NP)` (80-97). The control computer calls them as `chamber.remove_nanites()` (nanite_chamber_computer.dm:91) and `chamber.inject_nanites()` (97). `NP` is declared but not used in `remove_nanites`.
  - `set_safety(threshold)` (43-46) and `set_cloud(cloud_id)` (48-51) send `COMSIG_NANITE_SET_SAFETY` / `COMSIG_NANITE_SET_CLOUD` to the occupant.

#### Interactions (every tool, item and intent that does something)

| held item / action | condition | delay (ds) | message(s) verbatim | result | file:line |
|---|---|---|---|---|---|
| screwdriver | no occupant | none (no `use_tool`) | `You open the maintenance hatch of [src].` / `You close the maintenance hatch of [src].` (_machinery.dm:453, 457) | panel toggles; `update_icon()` after (the helper gets the same icon state for both names) | nanite_chamber.dm:189-192; _machinery.dm:447-459 |
| screwdriver | occupant inside | - | none | the screwdriver branch is skipped; the rest of `attackby` runs and then `..()` | nanite_chamber.dm:190 |
| crowbar | panel closed, door closed, `is_operational()` false (NOPOWER, BROKEN or MAINT), not `NODECONSTRUCT_1` | none (sound 50) | `[usr] pries open \the [src].` / `You pry open \the [src].` (_machinery.dm:393) | `open_machine()` (chamber override, nanite_chamber.dm:173-179) → `dropContents()` (occupant to the floor) | nanite_chamber.dm:194-195; _machinery.dm:389-394 |
| crowbar | panel open | none (sound 50) | none | `deconstruct(TRUE)` | nanite_chamber.dm:197-198; _machinery.dm:396-400 |
| click (`interact`) | any | none | `Close the maintenance panel first.` (panel open, nanite_chamber.dm:134); `The bolts are locked down, securing the door shut.` (locked, 142) | `toggle_open`: close if open; open if closed and not locked | nanite_chamber.dm:202-203, 132-145 |
| drag a carbon mob onto it (`MouseDrop_T`) | user adjacent, target adjacent | none | `log_combat ... "inserted" ... into [src].` (log only) | `close_machine(target)` | nanite_chamber.dm:205-210 |
| occupant `container_resist` | not locked | none | none | the door opens: `open_machine()` (nanite_chamber.dm:147-150) | nanite_chamber.dm:147-150 |
| occupant `container_resist` | locked, not busy | `breakout_time` = 1200 (120 s), `do_after` | `You see [user] kicking against the door of [src]!` (155); `You lean on the back of [src] and start pushing the door open... (this will take about [DisplayTimeText(breakout_time)].)` (156); `[user] successfully broke out of [src]!` (162); `You successfully break out of [src]!` (163) | `locked = FALSE`, `open_machine()` (161-164) | nanite_chamber.dm:147-164 |
| `relaymove` (occupant pushing) | `stat` or `locked` | cooldown 50 | `[src]'s door won't budge!` (185) | refused | nanite_chamber.dm:181-187 |
| TGUI / control computer `inject_nanites` | powered, not BROKEN, no MAINT, panel closed, occupant, not busy | timers below | per step below | `locked = TRUE`, then `complete_injection` | nanite_chamber.dm:53-70 |
| TGUI / control computer `remove_nanites` | same as inject | timers below | per step below | `locked = TRUE`, then `complete_removal` | nanite_chamber.dm:80-97 |

Injection steps (`inject_nanites`, nanite_chamber.dm:65-70): `Initializing injection protocol...` at 0 ds (set_busy, raising icon); `Analyzing host bio-structure...` at 20 ds; `Priming nanites...` at 40 ds; `Injecting...` at 70 ds; `Activating nanites...` at 110 ds (falling icon); `complete_injection` at 130 ds. `complete_injection` (72-78): restores `locked`, clears busy, and if an occupant is present, `occupant.AddComponent(/datum/component/nanites, 100)` (line 78).

Removal steps (`remove_nanites`, nanite_chamber.dm:92-97): `Initializing cleanup protocol...` at 0 ds; `Analyzing host bio-structure...` at 20 ds; `Pinging nanites...` at 40 ds; `Initiating graceful self-destruct sequence...` at 70 ds; `Removing debris...` at 110 ds; `complete_removal` at 130 ds. `complete_removal` (99-105): restores `locked`, clears busy, then `SEND_SIGNAL(occupant, COMSIG_NANITE_DELETE)` (line 105).

Icons (`update_icon_state`, nanite_chamber.dm:107-116): busy with occupant → `busy_icon_state`; occupant → `nanite_chamber_occupied`; no occupant → `nanite_chamber` plus `_open` when `state_open`. Overlays (118-130): `maint` when MAINT or panel open; `red` when busy or locked, plus `bolted` when locked; `green` otherwise. None when NOPOWER or BROKEN.

- Construction chain: board `/obj/item/circuitboard/machine/nanite_chamber`, name `Nanite Chamber (Machine Board)`, `build_path = /obj/machinery/nanite_chamber`, `req_components` = `/obj/item/stock_parts/scanning_module = 2`, `/obj/item/stock_parts/micro_laser = 2`, `/obj/item/stock_parts/manipulator = 1` (code/game/objects/items/circuitboards/machine_circuitboards.dm:837-844). `needs_anchored` default TRUE (circuitboard.dm:27), so the frame must be anchored before the board goes in (constructable_frame.dm:125-127). The shared frame steps apply.
- Deconstruction chain:
  1. Screwdriver with no occupant: panel opens (no delay).
  2. Crowbar with the panel open: `deconstruct(TRUE)` (no delay). Frame at state 2, full integrity, then the parts drop (board, 2 scanning modules, 2 micro-lasers, 1 manipulator) (_machinery.dm:402-410, 412-420). The occupant, if any, goes to the floor via `dropContents` in `Destroy` (_machinery.dm:171, 201-210).
  3. Crowbar with the panel closed works only when not operational (default_pry_open, _machinery.dm:389-394). That opens the door and does not deconstruct.
- Drops:
  - (a) Destroyed (integrity 0): `deconstruct(FALSE)` (obj_defense.dm:252-258): frame at 50 % of 250 (125), then the parts (board, 2 scanning, 2 micro-laser, 1 manipulator) (_machinery.dm:416-417, 405-409). The occupant goes to the floor (_machinery.dm:171).
  - (b) Deconstructed properly: same list, frame at full integrity.
  - Stays behind: the frame at state 2; nothing else.
- Health / armor: `max_integrity` 200 (inherited), armor default, `integrity_failure` 0 (shared rules). The type sets none of them.
- Power:
  - Declared: `use_power = IDLE_POWER_USE`, `idle_power_usage = 50`, `active_power_usage = 300` (nanite_chamber.dm:8, 11-12).
  - Drawn in this source: nothing (inferred). The type has no `process()`, so the base `process()` returns `PROCESS_KILL` (_machinery.dm:181-182) and SSmachines never calls `auto_use_power()` for it (machines.dm:37-45). No `use_power()` call exists in the file.
  - Power only gates behaviour: `inject_nanites` and `remove_nanites` refuse when NOPOWER or BROKEN (nanite_chamber.dm:54, 81). The overlays show no colour when unpowered (124).
- Gotchas:
  1. `remove_nanites` takes a program argument it never uses (nanite_chamber.dm:80, 97); the control computer passes none (nanite_chamber_computer.dm:91).
  2. Injection and removal both lock the door for 130 ds, and both refuse while busy (nanite_chamber.dm:58, 85).
  3. Injection gives the occupant `AddComponent(/datum/component/nanites, 100)` (nanite_chamber.dm:78). Removal sends `COMSIG_NANITE_DELETE`, which removes the nanites through the component (component not read).
  4. Breakout takes 1200 ds (120 s) of `do_after` and only from a locked chamber (nanite_chamber.dm:16, 158).
  5. Scan level is the sum of scanning module ratings, shown on examine (nanite_chamber.dm:27-35). The control computer may use it (not read).
  6. An unpowered chamber can be pried open with a crowbar (nanite_chamber.dm:194-195; _machinery.dm:389-394).

---

## Nanite program hub

### nanite program hub  `/obj/machinery/nanite_program_hub`   (code/modules/research/nanites/nanite_program_hub.dm:1)
- What it is: a terminal that lists the nanite designs researched on the global science techweb, and writes a chosen program onto a nanite program disk. It keeps one disk.
- Key vars:
  - `name = "nanite program hub"` (line 2); `desc = "Compiles nanite programs from the techweb servers and downloads them into disks."` (3)
  - `icon = 'icons/obj/machines/research.dmi'` (4); `icon_state = "nanite_program_hub"` (5); `use_power = IDLE_POWER_USE` (6); `anchored = TRUE` (7); `density = TRUE` (8)
  - `circuit = /obj/item/circuitboard/machine/nanite_program_hub` (9); `ui_x = 500`, `ui_y = 700` (10-11)
  - `var/obj/item/disk/nanite_program disk` (13); `var/datum/techweb/linked_techweb` (14); `var/current_category = "Main"` (15); `var/detail_view = TRUE` (16)
  - `categories` (17-25): `Utility Nanites`, `Medical Nanites`, `Sensor Nanites`, `Augmentation Nanites`, `Suppression Nanites`, `Weaponized Nanites`, `Protocols`.
- Initialize (nanite_program_hub.dm:27-29): `linked_techweb = SSresearch.science_tech`. The hub reads the global science techweb, not its own.

#### Interactions

| held item / action | condition | delay (ds) | message(s) verbatim | result | file:line |
|---|---|---|---|---|---|
| nanite program disk (`/obj/item/disk/nanite_program`) | any (no power check in this file) | none | `You insert [N] into [src].` (35); sound `sound/machines/terminal_insert_disc.ogg` 50 (36) | moved in with `transferItemToLoc`; any disk already in is ejected first (37-38), then `disk = N` (39) | nanite_program_hub.dm:31-41 |
| other item | any | - | - | `..()` (line 41) | - |
| screwdriver | any | none | `You open the maintenance hatch of [src].` (_machinery.dm:453) | `screwdriver_act` → `default_deconstruction_screwdriver(user, "nanite_program_hub_t", "nanite_program_hub", I)` | nanite_program_hub.dm:43-47 |
| crowbar | panel open | none (sound 50) | none | `crowbar_act` → `default_deconstruction_crowbar(I)` → `deconstruct(TRUE)` | nanite_program_hub.dm:49-53 |
| AltClick with a disk | `canUseTopic` (not silicon) | none | `You take out [disk] from [src].` (64) | `eject(user)`: to the active hand if possible, else the floor (55-60) | nanite_program_hub.dm:62-66 |
| click (`ui_interact`) | any | none | none | TGUI `NaniteProgramHub` | nanite_program_hub.dm:68-72 |

TGUI actions (`ui_act`, nanite_program_hub.dm:113-143):

| action | condition | delay (ds) | message(s) verbatim | result | file:line |
|---|---|---|---|---|---|
| `eject` | any | none | none | `eject(usr)` | 117-119 |
| `download` | disk inserted; `program_id` is a researched `/datum/design/nanites` | none | sound `sound/machines/terminal_prompt.ogg` 25 (130) | `qdel(disk.program)` if one is there (126-127); `disk.program = new downloaded.program_type` (128); `disk.name = "[initial(disk.name)] \[[disk.program.name]\]"` (129) | 120-131 |
| `refresh` | any | none | none | `update_static_data(usr)` | 132-134 |
| `toggle_details` | any | none | none | `detail_view` flips | 135-137 |
| `clear` | disk has a program | none | none | `qdel(disk.program)`, `disk.program = null`, `disk.name = initial(disk.name)` | 138-143 |

- The program list (`ui_static_data`, 92-111) is every entry of `linked_techweb.researched_designs` that is a `/datum/design/nanites` (95-98). Each goes into the bucket named by `D.category[1]` (99-106).
- `ui_data` (74-90): `has_disk`, `disk` with `name`/`desc` of the stored program, `has_program`, `detail_view`.

#### Construction chain
Board `/obj/item/circuitboard/machine/nanite_program_hub`, name `Nanite Program Hub (Machine Board)`, `build_path = /obj/machinery/nanite_program_hub`, `req_components` = `/obj/item/stock_parts/matter_bin = 1`, `/obj/item/stock_parts/manipulator = 1` (code/game/objects/items/circuitboards/machine_circuitboards.dm:846-852). `needs_anchored` default TRUE (circuitboard.dm:27). Shared frame steps apply.

#### Deconstruction chain
1. Screwdriver: panel opens, no delay (nanite_program_hub.dm:43-47).
2. Crowbar with the panel open: `deconstruct(TRUE)`, no delay (nanite_program_hub.dm:49-53; _machinery.dm:402-410). Frame at state 2; parts drop (board, 1 matter bin, 1 manipulator); the inserted disk is in `contents` and moves to the floor (`dropContents`, _machinery.dm:171, 201-210).

#### Drops
- (a) Destroyed (integrity 0): `deconstruct(FALSE)` (obj_defense.dm:252-258): frame at 50 % (125), the board, matter bin and manipulator (_machinery.dm:416-417, 405-409), and the inserted disk (contents, _machinery.dm:171).
- (b) Deconstructed properly: same, frame at full integrity.
- Stays behind: the frame at state 2. The disk keeps its program (`disk.program`), since only `clear` or `download` change it.

#### Health, power
- Health: `max_integrity` 200 (inherited), armor default, `integrity_failure` 0 (shared rules).
- Power: declared `use_power = IDLE_POWER_USE` (line 6), no `idle_power_usage` set (0). No `process()` and no `use_power()` call, so nothing is drawn (inferred, as the chamber). The file has no `powered()` check anywhere.

#### Gotchas
1. The hub reads the global science techweb (`SSresearch.science_tech`, line 29). Only designs researched there are listed or downloadable (`isDesignResearchedID`, line 123).
2. Only `/datum/design/nanites` designs are shown (line 97), grouped by the first category (line 99).
3. Download replaces any program already on the disk (line 126-128). `clear` removes it.
4. The hub's own code never checks power. Whether the TGUI state checks it was not traced.
5. Disk insertion does not check power or tool state (nanite_program_hub.dm:31-39).

---

## Nanite programmer

### nanite programmer  `/obj/machinery/nanite_programmer`   (code/modules/research/nanites/nanite_programmer.dm:1)
- What it is: a terminal that edits the program on a nanite program disk. It is the only place that changes the program's codes, timers, activation state and extra settings.
- Key vars:
  - `name = "nanite programmer"` (line 2); `desc = "A device that can edit nanite program disks to adjust their functionality."` (3)
  - `var/obj/item/disk/nanite_program disk` (4); `var/datum/nanite_program program` (5): set from `disk.program` on insert (25)
  - `icon = 'icons/obj/machines/research.dmi'` (6); `icon_state = "nanite_programmer"` (7); `use_power = IDLE_POWER_USE` (8); `anchored = TRUE` (9); `density = TRUE` (10)
  - `flags_1 = HEAR_1` (11): the machine hears speech (`Hear`, lines 152-156)
  - `circuit = /obj/item/circuitboard/machine/nanite_programmer` (12); `ui_x = 420`, `ui_y = 550` (13-14)

#### Interactions

| held item / action | condition | delay (ds) | message(s) verbatim | result | file:line |
|---|---|---|---|---|---|
| nanite program disk | any (no power check) | none | `You insert [N] into [src]` (20, no full stop in the source); sound `sound/machines/terminal_insert_disc.ogg` 50 (21) | moved in; a disk already in is ejected first (22-23); `disk = N`, `program = N.program` (24-25) | nanite_programmer.dm:16-27 |
| screwdriver | any | none | `You open the maintenance hatch of [src].` (_machinery.dm:453) | `screwdriver_act` → `default_deconstruction_screwdriver(user, "nanite_programmer_t", "nanite_programmer", I)` | nanite_programmer.dm:29-33 |
| crowbar | panel open | none | none | `crowbar_act` → `default_deconstruction_crowbar(I)` | nanite_programmer.dm:35-39 |
| AltClick with a disk | `canUseTopic` (not silicon) | none | `You take out [disk] from [src].` (51) | `eject(user)` (41-47; clears `disk` and `program`) | nanite_programmer.dm:49-53 |
| click (`ui_interact`) | any | none | none | TGUI `NaniteProgrammer` | nanite_programmer.dm:55-59 |
| speech containing "when" at the start or end, from something other than a programmer | `Hear` | none | `When you code it!!` (156) | said by the machine | nanite_programmer.dm:152-156 |

TGUI actions (`ui_act`, nanite_programmer.dm:90-150). Every change is made to `program`, which is the disk's own program object:

| action | effect | file:line |
|---|---|---|
| `eject` | `eject(usr)` | 94-96 |
| `toggle_active` | `program.activated = !program.activated`; sound `terminal_type` 25 | 97-100 |
| `set_code` (`target_code` activation / deactivation / kill / trigger, `code`) | `clamp(round(new_code, 1), 0, 9999)` into the matching code | 101-114 |
| `set_extra_setting` (`target_setting`, `value`) | `program.set_extra_setting(...)` | 115-118 |
| `set_restart_timer` (`delay`, seconds) | `clamp(round(timer,1), 0, 3600)` seconds, `*10` to deciseconds; stored in `timer_restart` | 119-126 |
| `set_shutdown_timer` | same; `timer_shutdown` | 127-134 |
| `set_trigger_timer` | same; `timer_trigger` | 135-142 |
| `set_timer_trigger_delay` | same; `timer_trigger_delay` | 143-150 |

- `ui_data` (61-88): `has_disk`, `has_program`, and when a program is present: `name`, `desc`, `use_rate`, `can_trigger`, `trigger_cost`, `trigger_cooldown / 10`, `activated`, `activation_code`, `deactivation_code`, `kill_code`, `trigger_code`, `timer_restart / 10`, `timer_shutdown / 10`, `timer_trigger / 10`, `timer_trigger_delay / 10`, and `extra_settings` (the `/10` values are shown in seconds).

#### Construction chain
Board `/obj/item/circuitboard/machine/nanite_programmer`, name `Nanite Programmer (Machine Board)`, `build_path = /obj/machinery/nanite_programmer`, `req_components` = `/obj/item/stock_parts/manipulator = 2`, `/obj/item/stock_parts/micro_laser = 2`, `/obj/item/stock_parts/scanning_module = 1` (code/game/objects/items/circuitboards/machine_circuitboards.dm:854-861). `needs_anchored` default TRUE (circuitboard.dm:27). Shared frame steps apply.

#### Deconstruction chain
1. Screwdriver: panel opens, no delay (nanite_programmer.dm:29-33).
2. Crowbar with the panel open: `deconstruct(TRUE)`, no delay (nanite_programmer.dm:35-39; _machinery.dm:402-410). Frame at state 2; parts drop (board, 2 manipulators, 2 micro-lasers, 1 scanning module). A disk inside is in `contents` and moves to the floor (_machinery.dm:171, 201-210).

#### Drops
- (a) Destroyed (integrity 0): `deconstruct(FALSE)` (obj_defense.dm:252-258): frame at 50 % (125), board, 2 manipulators, 2 micro-lasers, 1 scanning module (_machinery.dm:416-417, 405-409), and the disk (contents, _machinery.dm:171). The disk keeps its program.
- (b) Deconstructed properly: same, frame at full integrity.
- Stays behind: the frame at state 2.

#### Health, power
- Health: `max_integrity` 200 (inherited), armor default, `integrity_failure` 0 (shared rules).
- Power: declared `use_power = IDLE_POWER_USE` (line 8); no `idle_power_usage` or `active_power_usage` set (both 0). No `process()` and no `use_power()`, so nothing is drawn (inferred, as the chamber and hub). No `powered()` check in the file.

#### Gotchas
1. `program` is the disk's own program object (line 25), so every edit changes the disk. `eject` clears both `disk` and `program` (46-47).
2. `ui_act` has no null check on `program` (for example `toggle_active`, line 99). The DM relies on the TGUI showing controls only when `has_program` is set (the UI file is not read).
3. Timers are typed in seconds, clamped to 0-3600 s, then stored in deciseconds (nanite_programmer.dm:119-126; ×10 at line 124).
4. Codes are clamped to 0-9999 (lines 107-113).
5. The `Hear` override answers any sentence starting or ending with "when" (lines 154-156); a programmer hearing another programmer is ignored (155).

---

## Shared notes for this part

- BoxStation: nanite chamber x2, nanite program hub x2, nanite programmer x1 (list).
- The control computer `nanite_chamber_computer.dm` calls this chamber's `inject_nanites` and `remove_nanites` (lines 91, 97). It is not on this shard's list and was read only for those two call lines. `/obj/machinery/public_nanite_chamber` has its own `inject_nanites` (public_chamber.dm:35), which is a different type and is not on this list.
- Newer snapshot (`Downloads/tgstation-1da0...`): not checked for these parts.

## NOT FOUND / open questions

- Nothing on this shard's list is NOT FOUND. Every path located with tgwhere.
- Not traced: the TGUI state code (`default_state` / `can_interact` for powered checks on the vendor, hub, programmer, chamber, fabricator, ore redemption).
- Not traced: the ore silo's `remote_attackby` handler (called from `remote_materials.dm:88-91`; its definition was not located in this pass).
- Not traced: the per-ore `points`, `refined_type` and sheet `point_value` values (ore and sheet stack files).
- Not traced: `/datum/component/nanites` (the injected datum and what COMSIG_NANITE_DELETE removes).
- Not traced: the `apc_recharger` / hardware `enabled` defaults beyond what the cited lines show, and the network card, printer and super-drive power values.
- Newer snapshot (`Downloads/tgstation-1da0...`): no entry in this shard was cross-checked, so no "DIFF vs newer" line is given.
- Not on this shard's list but in the same files: the golem equipment vendor child, the `/maint` fabricator child, the labor points checker, the public nanite chamber, the mineral processing furnace and console, the nanite cloud and control computers.

## Coverage

Shard `gap-things-05`: 14 list entries. Parts: `gap-things-05.1.md` to `gap-things-05.6.md`.

| Measure | Count | Paths |
|---|---|---|
| Entries on the list | 14 | all 14 in `docs/tg/_todo3/gap-things-05.txt` |
| Documented with real data (file:line on every fact) | 14 | all 14 |
| Marked NOT FOUND | 0 | none |
| Not located by tgwhere | 0 | none (every path printed a defining `file:line`) |

tgwhere output for the 14 paths (path, defining file:line):

- `/obj/machinery/magnetic_module`  code/game/machinery/magnet.dm:7
- `/obj/machinery/mech_bay_recharge_port`  code/game/mecha/mech_bay.dm:14
- `/obj/machinery/mecha_part_fabricator`  code/game/mecha/mech_fabricator.dm:1
- `/obj/machinery/mineral/equipment_vendor`  code/modules/mining/machine_vending.dm:3
- `/obj/machinery/mineral/labor_claim_console`  code/modules/mining/laborcamp/laborstacker.dm:5
- `/obj/machinery/mineral/ore_redemption`  code/modules/mining/machine_redemption.dm:4
- `/obj/machinery/mineral/stacking_machine`  code/modules/mining/machine_stacking.dm:68
- `/obj/machinery/mineral/stacking_machine/laborstacker`  code/modules/mining/laborcamp/laborstacker.dm:121
- `/obj/machinery/mineral/stacking_unit_console`  code/modules/mining/machine_stacking.dm:3
- `/obj/machinery/modular_computer/console/preset/engineering`  code/modules/modular_computers/computers/machinery/console_presets.dm:31
- `/obj/machinery/modular_computer/console/preset/research`  code/modules/modular_computers/computers/machinery/console_presets.dm:43
- `/obj/machinery/nanite_chamber`  code/modules/research/nanites/nanite_chamber.dm:1
- `/obj/machinery/nanite_program_hub`  code/modules/research/nanites/nanite_program_hub.dm:1
- `/obj/machinery/nanite_programmer`  code/modules/research/nanites/nanite_programmer.dm:1

Map counts (from the list, for reference): magnetic_module x1, mech_bay_recharge_port x3, mecha_part_fabricator x2, equipment_vendor x1, labor_claim_console x1, ore_redemption x1, stacking_machine x1, laborstacker x1, stacking_unit_console x2, engineering preset x2, research preset x1, nanite_chamber x2, nanite_program_hub x2, nanite_programmer x1.

