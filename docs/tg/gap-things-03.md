# gap-things-03, part 1: ChemMaster 3000, and the shared machine, computer, frame and board rules

Summary:
- Covers the ChemMaster 3000 (`/obj/machinery/chem_master`, x4 on BoxStation) and its CondiMaster child, plus the parents and build pieces the other sections use.
- Parents: `/obj/machinery` (`code/game/machinery/_machinery.dm:86`) and `/obj/machinery/computer` (`code/game/machinery/computer/_computer.dm:1`). Every computer and the chute and door timer inherit from them.
- Build pieces: computer frame (`code/game/machinery/computer/buildandrepair.dm:1`), machine frame (`code/game/machinery/constructable_frame.dm:25`), circuit boards (`code/game/objects/items/circuitboards/circuitboard.dm:6`).
- Destroyed and deconstructed machines run the same drop code (`deconstruct`); destruction only halves the frame's health. A beaker left in a ChemMaster is deleted, not dropped.
- All numbers are raw DM values; delays are deciseconds (ds). Power is the DM literal (brief unit: W).

## Shared parent: `/obj/machinery`   (code/game/machinery/_machinery.dm:86)

- Base class for every machine. Defaults on the type:

| var | value | file:line |
|---|---|---|
| `max_integrity` | 200 | code/game/machinery/_machinery.dm:93 |
| `anchored` | TRUE | code/game/machinery/_machinery.dm:98 |
| `use_power` | IDLE_POWER_USE (= 1) | code/game/machinery/_machinery.dm:102, code/__DEFINES/machines.dm:22 |
| `idle_power_usage` | 0 | code/game/machinery/_machinery.dm:106 |
| `active_power_usage` | 0 | code/game/machinery/_machinery.dm:107 |
| `panel_open` | FALSE | code/game/machinery/_machinery.dm:113 |
| `component_parts` | null (list only for frame-built machines) | code/game/machinery/_machinery.dm:112 |
| `circuit` | null (subtypes set their own board) | code/game/machinery/_machinery.dm:122 |
| `processing_flags` | START_PROCESSING_ON_INIT | code/game/machinery/_machinery.dm:119 |

- Armor: if the subtype sets no `armor`, Initialize sets melee 25, bullet 10, laser 10, energy 0, bomb 0, bio 0, rad 0, fire 50, acid 70 (`code/game/machinery/_machinery.dm:136-137`).
- `process()` returns PROCESS_KILL unless the subtype overrides it (`code/game/machinery/_machinery.dm:181-182`). A subtype with no `process()` never ticks.
- Initialize with a circuit: `circuit = new circuit` then `circuit.apply_default_parts(src)` (`code/game/machinery/_machinery.dm:141-143`). This is how mapped machines get their parts.
- Destroy: removes from `GLOB.machines`, `dropContents()` (contents go to the turf, `code/game/machinery/_machinery.dm:171`, `:201-210`), then every entry of `component_parts` is qdel'd, not dropped (`code/game/machinery/_machinery.dm:172-175`).
- Damage: `take_damage` calls `obj_break` when `obj_integrity <= integrity_failure * max_integrity` and `obj_destruction` at 0 (`code/game/objects/obj_defense.dm:17-21`). `integrity_failure` defaults to 0 on objs (`code/game/objects/objs.dm:19`), so a machine that does not set it never breaks from damage.
- `obj_destruction` calls `deconstruct(FALSE)`, except acid (`acid_melt`) and fire (`burn`) (`code/game/objects/obj_defense.dm:252-258`).
- `obj_break` sets `BROKEN` in `machine_stat` and plays nothing; it is skipped when `NODECONSTRUCT_1` is set (`code/game/machinery/_machinery.dm:422-429`).
- `deconstruct(disassembled)` (`code/game/machinery/_machinery.dm:402-410`): if not `NODECONSTRUCT_1`: `on_deconstruction()`; if `component_parts` is non-empty, `spawn_frame(disassembled)` and every part is moved to `loc`; then `qdel(src)`. The `disassembled` flag only changes the frame's health (below).
- `spawn_frame` (`code/game/machinery/_machinery.dm:412-420`): new `/obj/structure/frame/machine` at `loc`, same anchored state, `state = 2`, `icon_state = "box_1"`; if not disassembled, `obj_integrity = max_integrity * 0.5`.
- EMP (`code/game/machinery/_machinery.dm:187-191`): if `use_power` and not `NOPOWER|BROKEN` and no `EMP_PROTECT_SELF`: `use_power(7500/severity)` and an emp effect.
- Power draw: `auto_use_power` (`code/game/machinery/_machinery.dm:238-245`) draws `idle_power_usage` when `use_power == 1`, `active_power_usage` when 2, only if `powered()`.
- Interaction gate `can_interact` (`code/game/machinery/_machinery.dm:250-280`): refused when `NOPOWER|BROKEN` (unless `INTERACT_MACHINE_OFFLINE`), when the panel is open (unless `INTERACT_MACHINE_OPEN`), for silicons without `INTERACT_MACHINE_ALLOW_SILICON`, and for living users not adjacent or incapacitated.

### Generic tools on any `/obj/machinery` (used by ChemMaster and inherited where not overridden)

| held tool | proc | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|---|
| screwdriver | `default_deconstruction_screwdriver` (`code/game/machinery/_machinery.dm:447-459`) | not `NODECONSTRUCT_1` | 0 (only `play_tool_sound`, `:449`) | "You open the maintenance hatch of [src]." (`:453`) / "You close the maintenance hatch of [src]." (`:457`) | toggles `panel_open`; icon swaps to the open/closed state names passed in |
| crowbar | `default_deconstruction_crowbar` (`code/game/machinery/_machinery.dm:396-400`) | `panel_open` (or ignore_panel), not `NODECONSTRUCT_1` | 0 | none (sound only, `:399`) | `deconstruct(TRUE)` |
| wrench | `default_unfasten_wrench(user, I, time = 20)` (`code/game/machinery/_machinery.dm:475-492`) | floor under it, or already anchored (`:469-473`) | 20 (`:475`) | "You begin [anchored ? "un" : ""]securing [src]..." (`:481`), "You [anchored ? "un" : ""]secure [src]." (`:486`), refusal "[src] needs to be on the floor to be secured!" (`:471`) | toggles `anchored` |

## Shared parent: `/obj/machinery/computer`   (code/game/machinery/computer/_computer.dm:1)

- Desktop consoles. Defaults on the type:

| var | value | file:line |
|---|---|---|
| `name` | "computer" | code/game/machinery/computer/_computer.dm:2 |
| `density` | TRUE | code/game/machinery/computer/_computer.dm:5 |
| `use_power` | IDLE_POWER_USE | code/game/machinery/computer/_computer.dm:6 |
| `idle_power_usage` | 300 | code/game/machinery/computer/_computer.dm:7 |
| `active_power_usage` | 300 | code/game/machinery/computer/_computer.dm:8 |
| `max_integrity` | 200 | code/game/machinery/computer/_computer.dm:9 |
| `integrity_failure` | 0.5 (breaks at 100 of 200) | code/game/machinery/computer/_computer.dm:10 |
| `armor` | melee 0, bullet 0, laser 0, energy 0, bomb 0, bio 0, rad 0, fire 40, acid 20 | code/game/machinery/computer/_computer.dm:11 |
| `icon_keyboard` / `icon_screen` | "generic_key" / "generic" | code/game/machinery/computer/_computer.dm:13-14 |
| `time_to_screwdrive` | 20 (ds) | code/game/machinery/computer/_computer.dm:15 |

- No `circuit` on the parent. A computer with no `circuit` cannot be taken apart, cannot break and drops nothing (see Gotchas on the pod console, part 4).
- Initialize (`code/game/machinery/computer/_computer.dm:18-24`): `power_change()`; a board passed to `new` replaces `circuit`.
- `power_change` (`code/game/machinery/computer/_computer.dm:51-56`): light `brightness_on` (1) when powered, off when `NOPOWER`.
- Destroy: `QDEL_NULL(circuit)` (`code/game/machinery/computer/_computer.dm:26-28`).
- Process: `process()` returns 0 when `NOPOWER|BROKEN` (`code/game/machinery/computer/_computer.dm:30-33`).
- Screwdriver (`screwdriver_act`, `code/game/machinery/computer/_computer.dm:58-65`):

| held tool | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| screwdriver | `circuit` set, not `NODECONSTRUCT_1` | 20 (`time_to_screwdrive`, `:63`) | "You start to disconnect the monitor..." (`:62`) | `deconstruct(TRUE, user)` (`:64`) |
| screwdriver | no `circuit` | none | none | nothing happens; the tool is still consumed (`:65` returns TRUE) |

- Other tools: `_computer.dm` has no wrench, welder or crowbar handler (no `default_unfasten_wrench` call), so a computer stays anchored from `/obj/machinery` (`code/game/machinery/_machinery.dm:98`) (inferred from the absence of a handler in this file).
- `obj_break` (`code/game/machinery/computer/_computer.dm:77-83`): returns at once when there is no `circuit` (`:78-79`); otherwise plays `sound/effects/glassbr3.ogg` at 100 and turns the light off.
- `play_attack_sound` (`code/game/machinery/computer/_computer.dm:67-75`): `sound/effects/glasshit.ogg` at 75 normally, `sound/effects/hit_on_shattered_glass.ogg` at 70 when BROKEN; burn hits play `sound/items/welder.ogg` at 100.
- EMP (`code/game/machinery/computer/_computer.dm:85-95`): severity 1, `prob(50)` to `obj_break("energy")`; severity 2, `prob(10)`.
- `deconstruct(disassembled, user)` (`code/game/machinery/computer/_computer.dm:96-121`):
  - `on_deconstruction()` first (`:97`).
  - If `circuit` (and not `NODECONSTRUCT_1`): new `/obj/structure/frame/computer` at `loc`, `setDir(dir)`, `circuit` moved into it, anchored TRUE (`:100-103`).
  - BROKEN: "The broken glass falls out." to the user (`:106`) or the shatter sound (`:108`); two `/obj/item/shard` on `drop_location()` (`:109-110`); frame `state = 3`, `icon_state = "3"` (`:111-112`).
  - Not broken: "You disconnect the monitor." (`:115`); frame `state = 4`, `icon_state = "4"` (`:116-117`).
  - `circuit = null` (`:118`), then every `obj` in `contents` moves to `loc` (`:119-120`), then `qdel(src)` (`:121`).
  - No `circuit`: no frame, no shards, only the `contents` move out.

## Build piece: `/obj/structure/frame`   (code/game/machinery/constructable_frame.dm:1)

- Base frame. `max_integrity = 250` (`code/game/machinery/constructable_frame.dm:6`), `density = TRUE` (`:5`), `state = 1` (`:8`), `circuit` (`:7`).
- `deconstruct` (`code/game/machinery/constructable_frame.dm:16-22`): always `new /obj/item/stack/sheet/metal(loc, 5)` (`:18`), `circuit` moved to `loc` if set (`:19-21`), then `qdel`. Only the `NODECONSTRUCT_1` check guards it.
- Floor-made frames: the RCD's `RCD_MACHINE` mode makes `/obj/structure/frame/machine` at `state = 2`, anchored (`code/game/turfs/open/floor.dm:294-300`); `RCD_COMPUTER` makes a computer frame at `state = 1` (`code/game/turfs/open/floor.dm:302-308`).

### Metal-sheet recipes that make frames   (code/game/objects/items/stacks/sheets/sheet_types.dm:17)

| recipe | product | sheets | time (raw stack-recipe value) | file:line |
|---|---|---|---|---|
| "computer frame" | `/obj/structure/frame/computer` | 5 metal | 25 | code/game/objects/items/stacks/sheets/sheet_types.dm:50 |
| "machine frame" | `/obj/structure/frame/machine` | 5 metal | 25 | code/game/objects/items/stacks/sheets/sheet_types.dm:52 |

## Build piece: `/obj/structure/frame/machine`   (code/game/machinery/constructable_frame.dm:25)

- Frame for any board-driven machine. Holds `req_components` (copied from the board), `components` (parts put in), `circuit`. `examine` lists what is still required (`code/game/machinery/constructable_frame.dm:31-49`).
- `deconstruct` (`code/game/machinery/constructable_frame.dm:274-281`): `state >= 2` gives `/obj/item/stack/cable_coil` x5 (`:277`); every `components` entry moves to `loc` (`:278-280`); then the base frame deconstruct (metal x5, circuit if set).

| state (icon) | item | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|---|
| 1 ("box_0") | `/obj/item/stack/cable_coil` x5 | `tool_start_check(amount=5)` | 20, `use_tool(... amount=5)` (`code/game/machinery/constructable_frame.dm:83-88`) | "You start to add cables to the frame..." (`:87`), "You add cables to the frame." (`:89`) | state 2, "box_1" (`:90-91`) |
| 1 | screwdriver | frame not anchored | 40 (`:97`) | "You start to disassemble the frame..." (`:96`), "You disassemble the frame." (`:99`) | 5 metal sheet (`:100`), frame deleted |
| 1 | wrench | any | 40 (`:106`) | "You start [anchored ? "un" : ""]securing [src]..." (`:105`) | toggles anchored (`:109`) |
| 2 ("box_1") | wrench | any | 40 (`:115`) | "You start [anchored ? "un" : ""]securing [src]..." (`:114`) | toggles anchored (`:117`) |
| 2 | `/obj/item/circuitboard/machine` | board has `build_path`; anchored if `needs_anchored` (`:125-127`) | 0 | "You add the circuit board to the frame." (`:131`) | `circuit` set, `state = 3`, "box_2", `req_components` copied (`:132-136`) |
| 2 | wirecutter | any | 0 (`play_tool_sound`) | "You remove the cables." (`:146`) | state 1, cable coil x5 on `drop_location()` (`:147-149`) |
| 3 ("box_2") | crowbar | any | 0 | "You remove the circuit board." or "You remove the circuit board and other components." (`:160`, `:162`) | state 2, board and parts dropped (`:153-169`) |
| 3 | wrench | `!circuit.needs_anchored` | 40 (`:173`) | "You start [anchored ? "un" : ""]securing [src]..." (`:172`) | toggles anchored (`:175`) |
| 3 | screwdriver | every `req_components` count is 0 | 0 (`play_tool_sound`, `:185`) | none | builds `new circuit.build_path(loc)`, parts moved in, `RefreshParts()`, frame deleted (`:186-200`) |
| 3 | any item in `req_components` | `isitem(P)`, count > 0 (`:244-268`) | 0; stacks use `min(round(amount), count)` | "You add [P] to [src]." (`:261`, `:265`); refusal "You cannot add that to the machine!" (`:269`) | count decremented, part added to `components` |
| 3 | part replacer (RPED) | `istype(... /obj/item/storage/part_replacer)` (`:203-242`) | 0 | "[part.name] applied." (`:239`) | fills requirements from the replacer |

- Frame refused items: a circuit board in state 1 gives "The frame needs wiring first!" (`:78`) or "This frame does not accept circuit boards of this type!" (`:81`). Any other item in state 1 is ignored.

## Circuit board base: `/obj/item/circuitboard`   (code/game/objects/items/circuitboards/circuitboard.dm:6)

- `custom_materials = list(/datum/material/glass=1000)` (`code/game/objects/items/circuitboards/circuitboard.dm:13`), `w_class = WEIGHT_CLASS_SMALL` (`:14`), `grind_results = list(/datum/reagent/silicon = 20)` (`:15`), `build_path = null` (`:16`).
- Used only by the frames above; a board's `build_path` is the machine it makes.

## Circuit board for machines: `/obj/item/circuitboard/machine`   (code/game/objects/items/circuitboards/circuitboard.dm:26)

- `needs_anchored = TRUE` default (`code/game/objects/items/circuitboards/circuitboard.dm:27`); `req_components` (`:28`) and `def_components` (`:31`) define the parts list.
- `apply_default_parts(M)` (`code/game/objects/items/circuitboards/circuitboard.dm:35-56`): `M.component_parts = list(src)` (the board is part 1), then each `req_components` entry is created (stacks with an amount, other items once per count), `def_components` swaps a type if set, then `M.RefreshParts()` (`:56`).

## Circuit board for computers: `/obj/item/circuitboard/computer`   (no own definition; subtypes listed by their own sections)

- Subtypes of `/obj/item/circuitboard`, not `/obj/item/circuitboard/machine`, so `apply_default_parts` does nothing for them (`code/game/objects/items/circuitboards/circuitboard.dm:18-19`) and the computer frame accepts them (`code/game/machinery/computer/buildandrepair.dm:36`).

## Computer frame: `/obj/structure/frame/computer`   (code/game/machinery/computer/buildandrepair.dm:1)

- `name = "computer frame"` (`:2`), `icon_state = "0"`, `state = 0` (`:3-4`). Inherits `max_integrity = 250` (`code/game/machinery/constructable_frame.dm:6`).
- Used for every computer section in this shard. States:

| state | item | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|---|
| 0 (empty) | wrench | any | 20 (`:12`) | "You start wrenching the frame into place..." (`:11`), "You wrench the frame into place." (`:13`) | anchored TRUE, state 1 (`:14-15`) |
| 0 | welder | `tool_start_check(amount=0)` | 20 (`:22`) | "You start deconstructing the frame..." (`:21`), "You deconstruct the frame." (`:23`) | 5 metal sheet dropped, frame deleted (`:24-26`) |
| 1 (anchored, "0") | wrench | any | 20 (`:31`) | "You start to unfasten the frame..." (`:30`), "You unfasten the frame." (`:32`) | anchored FALSE, state 0 (`:33-34`) |
| 1 | `/obj/item/circuitboard/computer` | no `circuit` yet | 0 | "You place [P] inside the frame." (`:40`) | `circuit` set, icon "1" (`:41-42`) |
| 1 | screwdriver | `circuit` set | 0 | "You screw [circuit] into place." (`:51`) | state 2, icon "2" (`:52-53`) |
| 1 | crowbar | `circuit` set | 0 | "You remove [circuit]." (`:57`) | board dropped, `circuit = null`, state 1, icon "0" (`:58-62`) |
| 2 ("2") | screwdriver | `circuit` set | 0 | "You unfasten the circuit board." (`:67`) | state 1, icon "1" (`:68-69`) |
| 2 | `/obj/item/stack/cable_coil` x5 | `tool_start_check(amount=5)` | 20, `amount=5` (`:75`) | "You start adding cables to the frame..." (`:74`), "You add cables to the frame." (`:78`) | state 3, icon "3" (`:79-80`) |
| 3 ("3") | wirecutter | any | 0 | "You remove the cables." (`:85`) | state 2, cable coil x5 on `drop_location()` (`:86-89`) |
| 3 | `/obj/item/stack/sheet/glass` x2 | `tool_start_check(amount=2)` | 20, `amount=2` (`:97`) | "You start to put in the glass panel..." (`:96`), "You put in the glass panel." (`:100`) | state 4, icon "4" (`:101-102`) |
| 4 ("4") | crowbar | any | 0 | "You remove the glass panel." (`:107`) | state 3, glass x2 dropped (`:108-111`) |
| 4 | screwdriver | any | 0 | "You connect the monitor." (`:115`) | `new circuit.build_path (loc, circuit)`, frame deleted (`:116-119`) |

- Damage state of the frame: `/obj/structure/frame/computer/deconstruct` drops 2 shards if state 4 (`code/game/machinery/computer/buildandrepair.dm:127-129`), cable coil x5 if state >= 3 (`:130-131`), then the base frame deconstruct (metal x5 plus any circuit).
- The frame is made by 5 metal sheets, 25 ds (`code/game/objects/items/stacks/sheets/sheet_types.dm:50`) or by the RCD in `RCD_COMPUTER` mode (`code/game/turfs/open/floor.dm:302-308`).

## Computer deconstruction chain (all computers with a `circuit`)

1. Screwdriver, 20 ds (`code/game/machinery/computer/_computer.dm:63`). Working console becomes frame state 4 holding the board and glass. Broken console becomes frame state 3 plus 2 shards (`code/game/machinery/computer/_computer.dm:104-112`).
2. Crowbar at frame state 4: glass x2 back, frame state 3 (`code/game/machinery/computer/buildandrepair.dm:105-112`).
3. Wirecutter at state 3: cable coil x5 back, frame state 2 (`code/game/machinery/computer/buildandrepair.dm:83-90`).
4. Screwdriver at state 2: frame state 1 (`code/game/machinery/computer/buildandrepair.dm:65-70`).
5. Crowbar at state 1: board back, frame state 1 with `circuit = null` (`code/game/machinery/computer/buildandrepair.dm:55-63`).
6. Wrench, 20 ds, then welder, 20 ds: metal x5 back, frame gone (`code/game/machinery/computer/buildandrepair.dm:29-35`, `:21-26`).

## Computer destruction (integrity 0)

- `take_damage` breaks the computer first at `obj_integrity <= 100` (`code/game/objects/obj_defense.dm:17-18`), then destroys it at 0 (`:20-21`) through `deconstruct(FALSE)` (`code/game/objects/obj_defense.dm:252-258`). So a destroyed computer with a board is BROKEN: 2 shards, frame state 3, no glass (`code/game/machinery/computer/_computer.dm:104-112`).

## ChemMaster 3000   `/obj/machinery/chem_master`   (code/modules/reagents/chemistry/machinery/chem_master.dm:1)

- Splits reagents between a loaded beaker (source), a 100-unit buffer (`create_reagents(100)`, `code/modules/reagents/chemistry/machinery/chem_master.dm:26`), and a pill bottle. Makes pills, patches, bottles and condiment packs/bottles from the buffer.
- Placed on BoxStation: x4 (`docs/tg/_todo3/gap-things-03.txt`, list entry 1).
- Key vars (inherits `/obj/machinery`, see above):

| var | value | file:line |
|---|---|---|
| `name` | "ChemMaster 3000" | code/modules/reagents/chemistry/machinery/chem_master.dm:2 |
| `desc` | "Used to separate chemicals and distribute them in a variety of forms." | code/modules/reagents/chemistry/machinery/chem_master.dm:3 |
| `density` | TRUE | code/modules/reagents/chemistry/machinery/chem_master.dm:4 |
| `layer` | BELOW_OBJ_LAYER | code/modules/reagents/chemistry/machinery/chem_master.dm:5 |
| `icon` / `icon_state` | 'icons/obj/chemical.dmi' / "mixer0" | code/modules/reagents/chemistry/machinery/chem_master.dm:6-7 |
| `use_power` | IDLE_POWER_USE | code/modules/reagents/chemistry/machinery/chem_master.dm:8 |
| `idle_power_usage` | 20 | code/modules/reagents/chemistry/machinery/chem_master.dm:9 |
| `resistance_flags` | FIRE_PROOF \| ACID_PROOF | code/modules/reagents/chemistry/machinery/chem_master.dm:10 |
| `circuit` | /obj/item/circuitboard/machine/chem_master | code/modules/reagents/chemistry/machinery/chem_master.dm:11 |
| `ui_x` / `ui_y` | 465 / 550 | code/modules/reagents/chemistry/machinery/chem_master.dm:12-13 |
| `beaker` / `bottle` | null / null | code/modules/reagents/chemistry/machinery/chem_master.dm:15-16 |
| `mode` | 1 = buffer is moved into the beaker; 0 = buffer reagent is discarded | code/modules/reagents/chemistry/machinery/chem_master.dm:17, `:234-239` |
| `condi` | FALSE | code/modules/reagents/chemistry/machinery/chem_master.dm:18 |
| `chosenPillStyle` | 1 | code/modules/reagents/chemistry/machinery/chem_master.dm:19 |
| `useramount` | 30 (last used amount, unused by the DM here) | code/modules/reagents/chemistry/machinery/chem_master.dm:22 |

- Buffer size: `RefreshParts` sets `reagents.maximum_volume` to the sum of `reagents.maximum_volume` of every `/obj/item/reagent_containers/glass/beaker` in `component_parts` (`code/modules/reagents/chemistry/machinery/chem_master.dm:44-47`). The standard beaker's desc says "It can hold up to 50 units." (`code/modules/reagents/reagent_containers/glass.dm:114`), so two beakers give 100 (inferred from that desc).
- Initialize also builds `pillStyles` ids and class names from the pill spritesheet (`code/modules/reagents/chemistry/machinery/chem_master.dm:25-37`).

### Interactions (held item / action)

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| open reagent container (`istype(I, /obj/item/reagent_containers)`, `is_open_container()`, not `ABSTRACT`) | panel closed (`code/modules/reagents/chemistry/machinery/chem_master.dm:105-107`) | 0 | "You add [B] to [src]." (`:115`) | `replace_beaker(user, B)`: old beaker to the user's hands, new one set (`:136-145`); item moved with `transferItemToLoc` (`:112`) |
| open reagent container | panel open | 0 | "You can't use the [src.name] while its panel is opened!" (`:108`) | refused |
| `/obj/item/storage/pill_bottle` | `!condi` and no bottle loaded (`:118-119`) | 0 | "You add [I] into the dispenser slot." (`:125`) | `bottle = I`, moved in (`:122-124`) |
| `/obj/item/storage/pill_bottle` | bottle already loaded | 0 | "A pill bottle is already loaded into [src]!" (`:120`) | refused |
| screwdriver | any | 0 | "You open the maintenance hatch of [src]." / "You close the maintenance hatch of [src]." (`code/game/machinery/_machinery.dm:453`, `:457`) | panel toggle; icon "mixer0_nopower" when open (`code/modules/reagents/chemistry/machinery/chem_master.dm:97`) |
| wrench | floor | 20 (`code/game/machinery/_machinery.dm:475`, call at `chem_master.dm:103`) | "You begin securing [src]..." / "You secure [src]." | toggles anchored |
| crowbar | panel open | 0 | none | `deconstruct(TRUE)` (`code/modules/reagents/chemistry/machinery/chem_master.dm:100`) |
| Alt-click | `can_interact` and `canUseTopic(src, BE_CLOSE, ...)` (`:132`) | 0 | none | `replace_beaker(user)`: beaker to hands (`:134`, `:140`) |
| any other item | none | none | none | `..()` (`:127-128`), default item behaviour |

### UI actions (`ui_act`, `code/modules/reagents/chemistry/machinery/chem_master.dm:202-384`)

No delays. Each is an instant state change.

| action | params | result | file:line |
|---|---|---|---|
| `eject` | none | beaker to the user's hands (`replace_beaker(usr)`) | code/modules/reagents/chemistry/machinery/chem_master.dm:206-208 |
| `ejectPillBottle` | none | bottle to `drop_location()` with `adjust_item_drop_location` (`:213-214`); refused if none (`:211-212`) | code/modules/reagents/chemistry/machinery/chem_master.dm:210-216 |
| `transfer` | `id`, `amount` (-1 = prompt "Enter the amount you want to transfer:", `:226-228`), `to` | to "buffer": `beaker.reagents.trans_id_to(src, reagent, amount)` (`:231-233`); to "beaker" with mode 1: buffer to beaker (`:234-236`); to "beaker" with mode 0: buffer reagent removed (`:237-239`). Refused for null or <= 0 (`:229-230`) | code/modules/reagents/chemistry/machinery/chem_master.dm:218-240 |
| `toggleMode` | none | `mode = !mode` | code/modules/reagents/chemistry/machinery/chem_master.dm:242-244 |
| `pillStyle` | `id` | `chosenPillStyle = id` | code/modules/reagents/chemistry/machinery/chem_master.dm:246-249 |
| `create` | `type`, `amount`, `volume`, `name` | see below | code/modules/reagents/chemistry/machinery/chem_master.dm:251-361 |
| `analyze` | `id` | `analyzeVars`: state from `reagent_state` 1 Solid, 2 Liquid, 3 Gas; `metaRate = metabolization_rate * (60 / P)` with `var/const/P = 3` (`:374-375`, the comment there says "seconds"); `overD`, `addicD` | code/modules/reagents/chemistry/machinery/chem_master.dm:364-378 |
| `goScreen` | `screen` | `screen = params["screen"]` | code/modules/reagents/chemistry/machinery/chem_master.dm:380-382 |

`create` details (`code/modules/reagents/chemistry/machinery/chem_master.dm:251-361`):
- Needs buffer volume > 0 (`:252-253`). `amount` clamped to 0..10 (`:261`); missing amount prompts "Max 10. Buffer content will be split evenly." (`:258-259`).
- Max units per item: pill 50 (`:269`), patch 40 (`:271`), bottle 30 (`:273`), condimentPack 10 (`:275`), condimentBottle 50 (`:277`); any other type refused (`:278-279`). Units are clamped to that max (`:287`).
- Default name is the buffer's master reagent name, with " ([vol_each]u)" added for pill and patch (`:292-296`); the name prompt is "Name:" / "Give it a name!" (`:297-301`).
- Pill: `/obj/item/reagent_containers/pill` (`:316`). Name "[name] pill" (`:319`). Icon "pill[rand(1,21)]" for the random style, else "pill[chosenPillStyle]" (`:320-323`). Style 4 gets a fixed desc (`:324-325`). Pills are created at `drop_location()` in both branches: `target_loc` and the fallback are the same location (`:307-318`), so a loaded pill bottle is not filled by `create` (inferred: the `drop_threshold` from the bottle's `max_items`, `:309-313`, only picks between two identical calls).
- Patch: `/obj/item/reagent_containers/pill/patch`, name "[name] patch" (`:330-333`).
- Bottle: `/obj/item/reagent_containers/glass/bottle`, name "[name] bottle" (`:338-341`).
- Condiment pack: `/obj/item/reagent_containers/food/condiment/pack`, name "[name] pack", desc "A small condiment pack. The label says it contains [name]." (`:346-351`).
- Condiment bottle: `/obj/item/reagent_containers/food/condiment`, name "[name] bottle" (`:355-359`).
- Each item gets `reagents.trans_to(P, vol_each, transfered_by = usr)` (`:327`, `:335`, `:343`, `:352`, `:360`).

### Construction chain (machine frame, from the board)

Mapped machines skip this (their parts are made at Initialize, `code/game/machinery/_machinery.dm:141-143`). Player-built:
1. Make a machine frame: 5 metal sheets, 25 ds (`code/game/objects/items/stacks/sheets/sheet_types.dm:52`), or RCD `RCD_MACHINE` (`code/game/turfs/open/floor.dm:294-300`). Frame state 2 when made by RCD.
2. Cable coil x5, 20 ds, frame state 1 to 2 (`code/game/machinery/constructable_frame.dm:83-91`). Needs state 1 only.
3. Wrench (optional), 40 ds (`code/game/machinery/constructable_frame.dm:113-117`). The board sets `needs_anchored = FALSE` (`code/game/objects/items/circuitboards/machine_circuitboards.dm:653`), so anchoring is not checked.
4. Insert `/obj/item/circuitboard/machine/chem_master` (`code/game/objects/items/circuitboards/machine_circuitboards.dm:644`): "You add the circuit board to the frame." (`code/game/machinery/constructable_frame.dm:131`), state 3.
5. Insert parts, instant each (`code/game/objects/items/circuitboards/machine_circuitboards.dm:649-652`): 2 x `/obj/item/reagent_containers/glass/beaker`, 1 x `/obj/item/stock_parts/manipulator`, 1 x `/obj/item/stack/sheet/glass`. Each: "You add [P] to [src]." (`code/game/machinery/constructable_frame.dm:265`).
6. Screwdriver, instant, once all counts are 0: the ChemMaster is created (`code/game/machinery/constructable_frame.dm:178-201`).

### Deconstruction chain

1. Screwdriver, 0 ds: panel open (`code/game/machinery/_machinery.dm:447-459`).
2. Crowbar, 0 ds: `deconstruct(TRUE)` (`code/game/machinery/_machinery.dm:396-400`, `code/modules/reagents/chemistry/machinery/chem_master.dm:100`).
3. Inside `deconstruct`: `on_deconstruction` runs `replace_beaker()` with no user, which returns FALSE at once (`code/modules/reagents/chemistry/machinery/chem_master.dm:136-138`, `:147-148`), so the beaker stays in `beaker`. The pill bottle (if any) is moved to `drop_location()` (`:149-152`).
4. `spawn_frame(TRUE)`: frame state 2, anchored as the machine was (`code/game/machinery/_machinery.dm:412-420`, `:405-406`).
5. Every `component_parts` entry moves to `loc`: the board, the 2 beakers, the manipulator and the glass sheet (`code/game/machinery/_machinery.dm:407-409`).
6. `qdel(src)` runs `Destroy`, which calls `QDEL_NULL(beaker)` (`code/modules/reagents/chemistry/machinery/chem_master.dm:39-42`). `QDEL_NULL` deletes the object before clearing the var (`code/__HELPERS/qdel.dm:3`). The loaded beaker is therefore deleted, with any reagents in it (inferred from steps 3 and 6).

### Drops

| case | what drops | what is deleted | frame |
|---|---|---|---|
| (a) destroyed (integrity 0, `code/game/objects/obj_defense.dm:252-258`) | board, 2 beakers, manipulator, glass sheet (from `component_parts`); pill bottle with contents (`on_deconstruction`) | loaded beaker (inferred, see step 6) | frame state 2, `obj_integrity = max * 0.5` (`code/game/machinery/_machinery.dm:416-417`) |
| (b) deconstructed properly (`code/game/machinery/_machinery.dm:402-410`) | same list as (a) | loaded beaker (inferred) | frame state 2, full health |

- Nothing is left behind except the frame. The frame can be finished or dismantled with the machine-frame rules above (cable coil back, metal x5 back).

### Health and armor

- `max_integrity` 200 (inherited, `code/game/machinery/_machinery.dm:93`). `armor` is the `/obj/machinery` default list (`code/game/machinery/_machinery.dm:137`), because the type sets none.
- `integrity_failure` is not set, so 0 (`code/game/objects/objs.dm:19`): the machine never enters BROKEN from damage. The "waitlight" overlay (`code/modules/reagents/chemistry/machinery/chem_master.dm:87-90`) only shows when `BROKEN`, which only a direct `obj_break()` call sets (inferred).
- `ex_act` (`code/modules/reagents/chemistry/machinery/chem_master.dm:49-51`): explosions of severity 3 (`EXPLODE_LIGHT`, `code/__DEFINES/combat.dm:210`) are ignored; severity 1 and 2 pass to `/obj/ex_act` (`code/game/objects/obj_defense.dm:54-69`: severity 1 is `take_damage(INFINITY, ..., "bomb")`, severity 2 is `take_damage(rand(100, 250), ...)`, both with flag `"bomb"`). Before that, `contents_explosion` queues the beaker and bottle into `SSexplosions` by severity (`code/modules/reagents/chemistry/machinery/chem_master.dm:53-70`).
- `blob_act`: `prob(50)` to `qdel(src)` (`code/modules/reagents/chemistry/machinery/chem_master.dm:92-94`).
- `FIRE_PROOF | ACID_PROOF` (`code/modules/reagents/chemistry/machinery/chem_master.dm:10`).

### Power

- `use_power = IDLE_POWER_USE`, `idle_power_usage = 20` (`code/modules/reagents/chemistry/machinery/chem_master.dm:8-9`). `active_power_usage` is 0 (inherited, `code/game/machinery/_machinery.dm:107`). The unit is whatever the game's power system uses; the brief gives it as watts.
- No `process()` override: the draw is the machine tick (`code/game/machinery/_machinery.dm:238-245`).

### Gotchas

- A beaker left in the machine is deleted on deconstruction or destruction (see Deconstruction steps 3 and 6).
- Panel open blocks the beaker slot entirely (`code/modules/reagents/chemistry/machinery/chem_master.dm:107-109`), so the beaker must be removed or the panel closed first.
- The board toggles between ChemMaster and CondiMaster with a screwdriver (`code/game/objects/items/circuitboards/machine_circuitboards.dm:655-668`), message "You change the circuit board setting to \"[new_name]\"." (`:666`).
- `condi` disables pill bottles (`code/modules/reagents/chemistry/machinery/chem_master.dm:118`). Both modes still list every `create` type (no DM-side filter).
- Bottle and beaker icons shift with `adjust_item_drop_location` pixel offsets (`code/modules/reagents/chemistry/machinery/chem_master.dm:400-418`).

### Child: CondiMaster 3000   `/obj/machinery/chem_master/condimaster`   (code/modules/reagents/chemistry/machinery/chem_master.dm:420)

- Same type with `name = "CondiMaster 3000"` (`code/modules/reagents/chemistry/machinery/chem_master.dm:421`), `desc = "Used to create condiments and other cooking supplies."` (`:422`), `condi = TRUE` (`:423`).
- Its board is the same board with `build_path` switched to this type (`code/game/objects/items/circuitboards/machine_circuitboards.dm:660-662`).
- Everything else (parts, power, armor, drops, UI) is inherited from `/obj/machinery/chem_master` (above).

# gap-things-03, part 2: Gas tank supply consoles (seven tanks)

Summary:
- Seven `/obj/machinery/computer/atmos_control/tank/*` consoles, all children of `/obj/machinery/computer/atmos_control/tank` (`code/game/machinery/computer/atmos_control.dm:187`), which is itself a child of `/obj/machinery/computer/atmos_control` (`code/game/machinery/computer/atmos_control.dm:89`).
- Each console talks on radio `FREQ_ATMOS_STORAGE` (1441) with filter `RADIO_ATMOSIA` ("atmosia"): it sends commands to one input pump and one output pump of its tank, and reads their status and its tank's sensor.
- Actions are instant (no delays). Only the screwdriver takes time: 20 ds, then the console deconstructs into a computer frame.
- Power: inherits 300 idle and 300 active from `/obj/machinery/computer` (`code/game/machinery/computer/_computer.dm:7-8`).
- Each console has its own computer board; the board name differs from the console name (table below).

## Parent: `/obj/machinery/computer/atmos_control`   (code/game/machinery/computer/atmos_control.dm:89)

- Generic atmospherics monitor. Not on the BoxStation list; its vars and procs are inherited by the tank consoles.
- Vars: `name` "atmospherics monitoring" (`code/game/machinery/computer/atmos_control.dm:90`), `desc` "Used to monitor the station's atmospherics sensors." (`:91`), `icon_screen` "tank" (`:92`), `icon_keyboard` "atmos_key" (`:93`), `circuit` = `/obj/item/circuitboard/computer/atmos_control` (`:94`), `ui_x` 400 and `ui_y` 925 (`:95-96`), `frequency = FREQ_ATMOS_STORAGE` (`:98`), `light_color = LIGHT_COLOR_CYAN` (`:115`).
- `sensors`: default list of 11 sensor ids (`code/game/machinery/computer/atmos_control.dm:99-111`): `n2_sensor` "Nitrogen Tank", `o2_sensor` "Oxygen Tank", `co2_sensor` "Carbon Dioxide Tank", `tox_sensor` "Plasma Tank", `n2o_sensor` "Nitrous Oxide Tank", `air_sensor` "Mixed Air Tank", `mix_sensor` "Mix Tank", distribution loop, waste loop, incinerator and toxins-lab sensors. Subtypes override this.
- `Initialize` adds the console to `GLOB.atmos_air_controllers` and calls `set_frequency` (`code/game/machinery/computer/atmos_control.dm:117-120`). `Destroy` removes it and calls `SSradio.remove_object` (`:122-125`).
- `ui_interact` opens TGUI "AtmosControlConsole" with the console's `name`, `ui_x`, `ui_y` (`code/game/machinery/computer/atmos_control.dm:127-132`).
- `ui_data` (`code/game/machinery/computer/atmos_control.dm:134-150`): for each sensor id in `sensors` that has data in `sensor_information`, sends `id_tag`, `long_name` (sanitized), `pressure`, `temperature`, `gases`. A sensor that has never reported is skipped (`:141-142`).
- `receive_signal` (`code/game/machinery/computer/atmos_control.dm:152-160`): stores `signal.data` under its `id_tag` if the id is one of `sensors`.
- `set_frequency` (`code/game/machinery/computer/atmos_control.dm:162-165`): removes the old radio object, adds the new one on `RADIO_ATMOSIA`.
- Radio values: `FREQ_ATMOS_STORAGE` 1441 (`code/__DEFINES/radio.dm:77`), `RADIO_ATMOSIA` "atmosia" (`code/__DEFINES/radio.dm:102`).

## Parent: `/obj/machinery/computer/atmos_control/tank`   (code/game/machinery/computer/atmos_control.dm:187)

- Shared behaviour of every tank console. Vars: `input_tag`, `output_tag` (`code/game/machinery/computer/atmos_control.dm:188-189`), `frequency = FREQ_ATMOS_STORAGE` (`:190`), `circuit = /obj/item/circuitboard/computer/atmos_control/tank` (`:191`, board "Tank Control (Computer Board)", `code/game/objects/items/circuitboards/computer_circuitboards.dm:74-76`), `input_info`, `output_info` (`:193-194`), `ui_x` 500 and `ui_y` 315 (`:196-197`).
- `reconnect(mob/user)` (`code/game/machinery/computer/atmos_control.dm:249-277`): collects the set names (the part before `_`) from every `vent_pump` and `outlet_injector` on the `_default` device list of the frequency (`:250-257`). Message if none: "No machinery detected." (`:260`), then the prompt still runs. Choice: "Select the device set: " (`:261`). On success: `input_tag = "[S]_in"`, `output_tag = "[S]_out"`, name "[uppertext(S)] Supply Control" (`:262-265`), `sensors` replaced by `"[S]_sensor" = "[S] Tank"` if a matching air sensor exists (`:266-272`). Then every injector and pump on the list gets `broadcast_status()` (`:274-277`).
- `ui_data` (`code/game/machinery/computer/atmos_control.dm:286-294`): `tank` TRUE, `inputting` from `input_info["power"]`, `inputRate` from `input_info["volume_rate"]`, `outputting` from `output_info["power"]`, `outputPressure` from `output_info["internal"]`; zeros or FALSE when unknown.
- `ui_act` (`code/game/machinery/computer/atmos_control.dm:296-322`): returns at once if `..()` or no `radio_connection`. Builds a "command" signal with `user`, sends it on `RADIO_ATMOSIA` (`:322`). Actions:

| action | params | signal sent | clamp | file:line |
|---|---|---|---|---|
| `reconnect` | none | none (calls `reconnect(usr)`) | none | code/game/machinery/computer/atmos_control.dm:301-303 |
| `input` | none | `tag` = `input_tag`, `power_toggle` TRUE | none | code/game/machinery/computer/atmos_control.dm:304-306 |
| `rate` | `rate` | `tag` = `input_tag`, `set_volume_rate` = target | 0 to `MAX_TRANSFER_RATE` (200, `code/__DEFINES/atmospherics.dm:209`) (`code/game/machinery/computer/atmos_control.dm:310`) | code/game/machinery/computer/atmos_control.dm:307-312 |
| `output` | none | `tag` = `output_tag`, `power_toggle` TRUE | none | code/game/machinery/computer/atmos_control.dm:313-315 |
| `pressure` | `pressure` | `tag` = `output_tag`, `set_internal_pressure` = target | 0 to 4500 (`code/game/machinery/computer/atmos_control.dm:319`) | code/game/machinery/computer/atmos_control.dm:316-321 |

- `receive_signal` (`code/game/machinery/computer/atmos_control.dm:324-335`): a signal whose `tag` equals `input_tag` becomes `input_info`; equal to `output_tag` becomes `output_info`; anything else goes to the parent.
- Tank consoles do not change tag strings; they only send commands to the pumps named by their tags (the pumps are other machines, not documented here).

### Per-tank values (each path is a separate console; differences are the name, tags, sensor and board)

Tag values are the defines in `code/__DEFINES/atmospherics.dm` (lines given per row). Board names are from `code/game/objects/items/circuitboards/computer_circuitboards.dm`.

| path | in-game name (`name`) | `input_tag` | `output_tag` | sensor (id: label) | circuit (board) |
|---|---|---|---|---|---|
| `/obj/machinery/computer/atmos_control/tank/oxygen_tank` | "Oxygen Supply Control" (`code/game/machinery/computer/atmos_control.dm:200`) | "o2_in" (`code/__DEFINES/atmospherics.dm:276`) | "o2_out" (`:277`) | "o2_sensor" (`:278`): "Oxygen Tank" (`code/game/machinery/computer/atmos_control.dm:203`) | `/obj/item/circuitboard/computer/atmos_control/tank/oxygen_tank` (`code/game/machinery/computer/atmos_control.dm:204`); board "Oxygen Supply Control (Computer Board)" (`code/game/objects/items/circuitboards/computer_circuitboards.dm:78-80`) |
| `/obj/machinery/computer/atmos_control/tank/toxin_tank` | "Plasma Supply Control" (`code/game/machinery/computer/atmos_control.dm:207`) | "tox_in" (`code/__DEFINES/atmospherics.dm:280`) | "tox_out" (`:281`) | "tox_sensor" (`:282`): "Plasma Tank" (`code/game/machinery/computer/atmos_control.dm:210`) | `/obj/item/circuitboard/computer/atmos_control/tank/toxin_tank` (`code/game/machinery/computer/atmos_control.dm:211`); board "Plasma Supply Control (Computer Board)" (`code/game/objects/items/circuitboards/computer_circuitboards.dm:82-84`) |
| `/obj/machinery/computer/atmos_control/tank/air_tank` | "Mixed Air Supply Control" (`code/game/machinery/computer/atmos_control.dm:214`) | "air_in" (`code/__DEFINES/atmospherics.dm:284`) | "air_out" (`:285`) | "air_sensor" (`:286`): "Air Mix Tank" (`code/game/machinery/computer/atmos_control.dm:217`) | `/obj/item/circuitboard/computer/atmos_control/tank/air_tank` (`code/game/machinery/computer/atmos_control.dm:218`); board "Mixed Air Supply Control (Computer Board)" (`code/game/objects/items/circuitboards/computer_circuitboards.dm:86-88`) |
| `/obj/machinery/computer/atmos_control/tank/mix_tank` | "Gas Mix Tank Control" (`code/game/machinery/computer/atmos_control.dm:221`) | "mix_in" (`code/__DEFINES/atmospherics.dm:288`) | "mix_out" (`:289`) | "mix_sensor" (`:290`): "Gas Mix Tank" (`code/game/machinery/computer/atmos_control.dm:224`) | `/obj/item/circuitboard/computer/atmos_control/tank/mix_tank` (`code/game/machinery/computer/atmos_control.dm:225`); board "Gas Mix Supply Control (Computer Board)" (`code/game/objects/items/circuitboards/computer_circuitboards.dm:90-92`) |
| `/obj/machinery/computer/atmos_control/tank/nitrous_tank` | "Nitrous Oxide Supply Control" (`code/game/machinery/computer/atmos_control.dm:228`) | "n2o_in" (`code/__DEFINES/atmospherics.dm:292`) | "n2o_out" (`:293`) | "n2o_sensor" (`:294`): "Nitrous Oxide Tank" (`code/game/machinery/computer/atmos_control.dm:231`) | `/obj/item/circuitboard/computer/atmos_control/tank/nitrous_tank` (`code/game/machinery/computer/atmos_control.dm:232`); board "Nitrous Oxide Supply Control (Computer Board)" (`code/game/objects/items/circuitboards/computer_circuitboards.dm:94-96`) |
| `/obj/machinery/computer/atmos_control/tank/nitrogen_tank` | "Nitrogen Supply Control" (`code/game/machinery/computer/atmos_control.dm:235`) | "n2_in" (`code/__DEFINES/atmospherics.dm:296`) | "n2_out" (`:297`) | "n2_sensor" (`:298`): "Nitrogen Tank" (`code/game/machinery/computer/atmos_control.dm:238`) | `/obj/item/circuitboard/computer/atmos_control/tank/nitrogen_tank` (`code/game/machinery/computer/atmos_control.dm:239`); board "Nitrogen Supply Control (Computer Board)" (`code/game/objects/items/circuitboards/computer_circuitboards.dm:98-100`) |
| `/obj/machinery/computer/atmos_control/tank/carbon_tank` | "Carbon Dioxide Supply Control" (`code/game/machinery/computer/atmos_control.dm:242`) | "co2_in" (`code/__DEFINES/atmospherics.dm:300`) | "co2_out" (`:301`) | "co2_sensor" (`:302`): "Carbon Dioxide Tank" (`code/game/machinery/computer/atmos_control.dm:245`) | `/obj/item/circuitboard/computer/atmos_control/tank/carbon_tank` (`code/game/machinery/computer/atmos_control.dm:246`); board "Carbon Dioxide Supply Control (Computer Board)" (`code/game/objects/items/circuitboards/computer_circuitboards.dm:102-104`) |

- The `name` and `circuit` lines for each type are at the lines in the table; each type sets only these four things (name, tags, sensors, circuit) and inherits `ui_x/ui_y`, `frequency`, `ui_act`, `receive_signal`, power and armor from the parents.
- Name is set by the type, not the board: a console rebuilt from the board gets its type's `name` back (the board name is the item's name, e.g. "Gas Mix Supply Control (Computer Board)", `code/game/objects/items/circuitboards/computer_circuitboards.dm:91`).

### Placement

- Map placements on BoxStation: `oxygen_tank`, `toxin_tank`, `air_tank`, `mix_tank`, `nitrous_tank`, `nitrogen_tank`, `carbon_tank`: x1 each (`docs/tg/_todo3/gap-things-03.txt`).

## Interactions (all tank consoles; the parent computer's rules apply to all of them)

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| screwdriver | `circuit` set, not `NODECONSTRUCT_1` | 20 (`time_to_screwdrive`, `code/game/machinery/computer/_computer.dm:15`, `:63`) | "You start to disconnect the monitor..." (`code/game/machinery/computer/_computer.dm:62`) | `deconstruct(TRUE, user)` (`code/game/machinery/computer/_computer.dm:64`) |
| any other tool | none defined | none | none | no handler in these files (inferred) |
| attack (hit) | any | none | glass sound (`code/game/machinery/computer/_computer.dm:67-75`) | damage through `take_damage` (`code/game/objects/obj_defense.dm:3-21`) |
| attack hand / AI (use) | powered and not BROKEN | none | none | `ui_interact` opens AtmosControlConsole (`code/game/machinery/computer/atmos_control.dm:127-132`, `:279-284`) |

- UI actions: see the table in the tank parent section (reconnect, input, rate, output, pressure); all instant.

## Construction chain (each tank console)

Uses the computer frame in part 1 (`code/game/machinery/computer/buildandrepair.dm`). Board per console is the one in the table above:
1. Make a computer frame: 5 metal sheets, 25 ds (raw `time`) (`code/game/objects/items/stacks/sheets/sheet_types.dm:50`), or RCD `RCD_COMPUTER` (`code/game/turfs/open/floor.dm:302-308`).
2. Wrench, 20 ds: anchored, state 1 (`code/game/machinery/computer/buildandrepair.dm:10-15`).
3. Insert the console's own board (state 1, "You place [P] inside the frame.", `code/game/machinery/computer/buildandrepair.dm:36-42`).
4. Screwdriver, instant: state 2 (`:49-54`).
5. Cable coil x5, 20 ds: state 3 (`:71-80`).
6. Glass sheet x2, 20 ds: state 4 (`:92-103`).
7. Screwdriver, instant: "You connect the monitor.", new console built as `circuit.build_path` (`code/game/machinery/computer/buildandrepair.dm:113-120`).

## Deconstruction chain (each tank console)

1. Screwdriver, 20 ds: "You start to disconnect the monitor..." (`code/game/machinery/computer/_computer.dm:62-64`). A working console becomes frame state 4 with the board and glass (`:116-117`); a broken one becomes state 3 with 2 shards (`:104-112`).
2. Then the frame steps in part 1 (crowbar: glass back; wirecutter: cable back; screwdriver: board detach; crowbar: board back; wrench then welder: metal back).

## Drops

| case | what drops | what is left |
|---|---|---|
| (a) deconstructed by screwdriver (`code/game/machinery/computer/_computer.dm:96-121`) | frame state 4 with the board (`circuit` moved into the frame); any `obj` in `contents` moved to `loc` (`:119-120`) | the frame |
| (b) broken then deconstructed | frame state 3 with the board, 2 `/obj/item/shard` (`code/game/machinery/computer/_computer.dm:109-112`) | the frame, glass gone |
| (c) destroyed (integrity 0, `code/game/objects/obj_defense.dm:17-21`, `:252-258`) | as (b): broken first, then `deconstruct(FALSE)` | the frame |

- The tank console's `Destroy` (`code/game/machinery/computer/atmos_control.dm:122-125`) runs after `deconstruct` nulls `circuit` (`code/game/machinery/computer/_computer.dm:118`), so nothing is deleted with the board.

## Health and armor

- `max_integrity` 200, `integrity_failure` 0.5 (breaks at 100), `armor`: melee 0, bullet 0, laser 0, energy 0, bomb 0, bio 0, rad 0, fire 40, acid 20 (`code/game/machinery/computer/_computer.dm:9-11`). Fire damage uses the 40 fire rating; acid the 20 acid rating.
- Broken (`obj_break`): glass sound at 100 and light off (`code/game/machinery/computer/_computer.dm:77-83`).
- EMP: severity 1, `prob(50)` to break; severity 2, `prob(10)` (`code/game/machinery/computer/_computer.dm:85-95`).

## Power

- `use_power = IDLE_POWER_USE` (inherited, `code/game/machinery/computer/_computer.dm:6`), `idle_power_usage` 300, `active_power_usage` 300 (`code/game/machinery/computer/_computer.dm:7-8`). The DM literal is 300; the brief unit is watts.
- `process()` returns 0 when `NOPOWER|BROKEN` (`code/game/machinery/computer/_computer.dm:30-33`). `can_interact` refuses use when `NOPOWER|BROKEN` (`code/game/machinery/_machinery.dm:250-251`). `ui_act` itself checks only `radio_connection` (`code/game/machinery/computer/atmos_control.dm:297`).

## Gotchas

- `reconnect` with no machinery found still opens the prompt: "No machinery detected." (`code/game/machinery/computer/atmos_control.dm:259-260`) has no `return`, and the next line uses `IO[1]` (`:261`), which is null when the list is empty. Port it with a return.
- `reconnect` renames the console and rebuilds its `sensors` list (`code/game/machinery/computer/atmos_control.dm:263-272`). A reassigned tank console is no longer the type's default name.
- Each console only shows sensors that have reported (`code/game/machinery/computer/atmos_control.dm:141-142`); the sensor machines themselves are separate types (`code/game/machinery/computer/atmos_control.dm:23-25` for the oxygen sensor, id "o2_sensor").
- The console label for a sensor differs from the generic monitor's label for the same id (e.g. "Mix Tank" at `code/game/machinery/computer/atmos_control.dm:106` vs "Gas Mix Tank" at `:224`; "Mixed Air Tank" at `:105` vs "Air Mix Tank" at `:217`).
- Console name and board name differ: e.g. "Gas Mix Tank Control" (`code/game/machinery/computer/atmos_control.dm:221`) vs board "Gas Mix Supply Control (Computer Board)" (`code/game/objects/items/circuitboards/computer_circuitboards.dm:91`).
- Tank pumps are addressed by tag only, so a console with the wrong tag set controls nothing (inferred from `ui_act`, `code/game/machinery/computer/atmos_control.dm:304-321`).

# gap-things-03, part 3: camera-driven consoles (base construction, xenobiology)

Summary:
- Two consoles on the list: `/obj/machinery/computer/camera_advanced/base_construction` (x1 on BoxStation) and `/obj/machinery/computer/camera_advanced/xenobio` (x2 on BoxStation). Both are children of `/obj/machinery/computer/camera_advanced` (`code/game/machinery/computer/camera_advanced.dm:1`), which is a child of `/obj/machinery/computer`.
- The user does not sit at the console: it puts them into a remote camera eye (`/mob/camera/ai_eye/remote/...`) that moves over the station; their actions are buttons on that eye. Nothing here has a delay of its own except the RCD build (do_after, scaled by `delay_mod`).
- Power: inherits 300 idle and 300 active from `/obj/machinery/computer` (`code/game/machinery/computer/_computer.dm:7-8`). Use stops at once when `NOPOWER|BROKEN` (`code/game/machinery/computer/camera_advanced.dm:111-112`, `:83-85`).
- Both have computer boards; their names differ from the console names (see each entry).

## Parent: `/obj/machinery/computer/camera_advanced`   (code/game/machinery/computer/camera_advanced.dm:1)

- Vars (`code/game/machinery/computer/camera_advanced.dm:1-16`): `name` "advanced camera console" (`:2`), `desc` "Used to access the various cameras on the station." (`:3`), `icon_screen` "cameras" (`:4`), `icon_keyboard` "security_key" (`:5`), `z_lock` (`:6`), `lock_override` NONE (`:7`), `eyeobj` (`:8`), `current_user` (`:9`), `networks` = list("ss13") (`:10`), `off_action = new /datum/action/innate/camera_off` (`:11`), `jump_action = new /datum/action/innate/camera_jump` (`:12`), `actions` (`:13`), `should_supress_view_changes` TRUE (`:15`), `light_color` LIGHT_COLOR_RED (`:16`).
- Initialize (`code/game/machinery/computer/camera_advanced.dm:18-29`): lowercases `networks`; `lock_override` bits add station, mining or centcom z-levels to `z_lock` (`:23-29`).
- Destroy (`code/game/machinery/computer/camera_advanced.dm:87-93`): unsets the current user, qdels `eyeobj`, `QDEL_LIST(actions)`.
- `attack_hand` (`code/game/machinery/computer/camera_advanced.dm:107-150`):
  - refused when not `is_operational()` (`:111-112`) (so `NOPOWER`, `BROKEN` or `MAINT` stop it);
  - "The console is already in use!" when `current_user` is set (`:113-115`);
  - `can_use(user)` (`:118-119`; the abductor subtype adds a species check, `:102-105`);
  - creates the eye on first use (`:120-121`), then finds a camera spot: the console's own turf if its z is in `z_lock` and it is visible to the camera net (`:125-128`), else the first usable camera on the same network (`:129-136`); with `use_static` none it uses its own turf (`:137-141`);
  - found: `eye_initialized = TRUE`, `give_eye_control`, `setLoc` (`:142-145`); not found: `unset_machine()` (`:146-147`);
  - later uses: `give_eye_control` and `setLoc(eyeobj.loc)` (`:148-150`).
- `attack_robot` calls `attack_hand` (`code/game/machinery/computer/camera_advanced.dm:152-153`). `attack_ai` does nothing (`:155-156`): AIs cannot use these consoles.
- `give_eye_control` (`code/game/machinery/computer/camera_advanced.dm:158-167`): `GrantActions(user)`, `current_user = user`, eye name "Camera Eye ([user.name])" (`:162`), `reset_perspective(eyeobj)` (`:164`), suppress view size changes (`:166-167`).
- `remove_eye_control` (`code/game/machinery/computer/camera_advanced.dm:61-81`): removes actions, unregisters chunks, resets perspective, `unset_machine()`, plays `sound/machines/terminal_off.ogg` at 25 (`:81`).
- `check_eye` (`code/game/machinery/computer/camera_advanced.dm:83-85`): unsets the machine if `NOPOWER|BROKEN`, not adjacent (unless silicon), blind or incapacitated.
- Off action "End Camera View" (`code/game/machinery/computer/camera_advanced.dm:233-244`): calls `remove_eye_control`. Jump action "Jump To Camera" (`:246-284`): lists network cameras, prompt "Choose which camera you want to view" (`:275`), flash via `flash/static` (`:281`).
- The remote eye `/mob/camera/ai_eye/remote` (`code/game/machinery/computer/camera_advanced.dm:169-231`): `sprint` starts at 10, `acceleration` 1, `cooldown` 0 (`:172-174`). `relaymove` makes `ceil(sprint / 20)` steps (`:222-225`), then `sprint` grows by 0.5 per move up to `max_sprint` 50 (`:217`, `:228-229`). Each move sets `cooldown = world.timeofday + 5` (`:227`); if the cooldown has passed by the next move, `sprint` resets to its initial value (`:219-220`).

### Shared interactions for the two consoles

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| screwdriver | `circuit` set | 20 (`code/game/machinery/computer/_computer.dm:15`, `:63`) | "You start to disconnect the monitor..." (`code/game/machinery/computer/_computer.dm:62`) | computer deconstruct (part 1). Runs before any `attackby` (`code/_onclick/item_attack.dm:10-12`). |
| any console use (hand) | powered, not in use | none | "The console is already in use!" if in use (`code/game/machinery/computer/camera_advanced.dm:114`) | eye control |

## Construction chain (both consoles)

Uses the computer frame (part 1). Board per console:
- Base construction: `/obj/item/circuitboard/computer/base_construction`, name "circuit board (Aux Mining Base Construction Console)", build_path `/obj/machinery/computer/camera_advanced/base_construction` (`code/game/objects/items/circuitboards/computer_circuitboards.dm:111-114`).
- Xenobiology: `/obj/item/circuitboard/computer/xenobiology`, name "Xenobiology Console (Computer Board)", build_path `/obj/machinery/computer/camera_advanced/xenobio` (`code/game/objects/items/circuitboards/computer_circuitboards.dm:352-355`).
Frame steps are the computer-frame table in part 1 (`code/game/machinery/computer/buildandrepair.dm:1-120`), in the same order: wrench (20 ds), board, screwdriver, cable coil x5 (20 ds), glass x2 (20 ds), screwdriver.

## Deconstruction chain (both consoles)

Same as any computer (part 1): screwdriver 20 ds, frame state 4 with the board, then the frame steps back to metal.

## Drops (both consoles)

- Screwdriver or destruction: frame with the board, or with 2 shards if broken (`code/game/machinery/computer/_computer.dm:96-121`).
- The console's `Destroy` runs afterwards (see each entry for what is lost).

---

## Base construction console   `/obj/machinery/computer/camera_advanced/base_construction`   (code/modules/mining/aux_base_camera.dm:29)

- Remote build console for the mining base. Its eye is a construction drone; its actions drive an internal RCD.
- Placed on BoxStation: x1 (`docs/tg/_todo3/gap-things-03.txt`).
- Key vars:

| var | value | file:line |
|---|---|---|
| `name` | "base construction console" | code/modules/mining/aux_base_camera.dm:30 |
| `desc` | "An industrial computer integrated with a camera-assisted rapid construction drone." | code/modules/mining/aux_base_camera.dm:31 |
| `networks` | list("ss13") | code/modules/mining/aux_base_camera.dm:32 |
| `RCD` | internal RCD (`/obj/item/construction/rcd/internal`), set at Initialize | code/modules/mining/aux_base_camera.dm:33, `:54` |
| `circuit` | `/obj/item/circuitboard/computer/base_construction` | code/modules/mining/aux_base_camera.dm:34 |
| `off_action` | `/datum/action/innate/camera_off/base_construction`, name "Log out" | code/modules/mining/aux_base_camera.dm:35, `:160-161` |
| `jump_action` | null (no camera jump) | code/modules/mining/aux_base_camera.dm:36 |
| `fans_remaining` | 0 (4 on map-spawned consoles) | code/modules/mining/aux_base_camera.dm:42, `:60` |
| `turret_stock` | 0 (4 on map-spawned consoles) | code/modules/mining/aux_base_camera.dm:44, `:61` |
| `found_aux_console` | tracker for the auxiliary base computer | code/modules/mining/aux_base_camera.dm:45 |
| `icon_screen` / `icon_keyboard` | "mining" / "rd_key" | code/modules/mining/aux_base_camera.dm:47-48 |
| `light_color` | LIGHT_COLOR_PINK | code/modules/mining/aux_base_camera.dm:50 |

- Actions granted on use (`GrantActions`, `code/modules/mining/aux_base_camera.dm:91-124`): Switch Mode (`:94-97`), Build (`:99-102`), Select Airlock Type (`:104-107`), Select Window Type (`:109-112`), Place Tiny Fan (`:114-117`), Install Plasma Anti-Wildlife Turret (`:119-122`), plus the off action. The eye is made visible while in use (`:124`) and hidden again on release (`:126-128`).
- `CreateEye` (`code/modules/mining/aux_base_camera.dm:63-78`): the eye starts on the auxiliary base console if one exists in `/area/shuttle/auxiliary_base` (`:66-69`), else on the console (`:71-74`). Eye type `/mob/camera/ai_eye/remote/base_construction` (`:77`).
- Eye (`code/modules/mining/aux_base_camera.dm:2-22`): name "construction holo-drone" (`:3`); moves only inside its starting area or `/area/shuttle/auxiliary_base` (`:13-17`).

### Initialize (two definitions, see Gotchas)

- Definition A: `Initialize()` at `code/modules/mining/aux_base_camera.dm:52-54` creates `RCD = new(src)`.
- Definition B: `Initialize(mapload)` at `code/modules/mining/aux_base_camera.dm:56-61`: on map load sets `RCD.matter = RCD.max_matter` (`:59`), `fans_remaining = 4` (`:60`), `turret_stock = 4` (`:61`).

### Interactions

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| `/obj/item/rcd_ammo` | any | 0 | "[src] can't hold any more matter-units!" if full (`code/game/objects/items/RCD.dm:72`); else "[src] now holds [matter]/[max_matter] matter-units." (`:93`) | `RCD.attackby`: adds `min(R.ammoamt, max_matter - matter)` (`code/game/objects/items/RCD.dm:68-78`); console passes it on (`code/modules/mining/aux_base_camera.dm:81-83`) |
| `/obj/item/stack/sheet` (any sheet) | any | 0 | "You insert [amount_to_use] [S.name] sheets into [src]. " (`code/game/objects/items/RCD.dm:113`); refusal "You can't insert any more [S.name] sheets into [src]!" (`:115`) | only metal, glass, plasteel, plasma glass, rglass, rods and plasteel tiles are accepted by the RCD (`code/game/objects/items/RCD.dm:80-91`); other sheets are not used (`:102-103`) |
| screwdriver | `circuit` set | 20 | see shared table | computer deconstruct |
| off action "Log out" | eye in use | 0 | none | `remove_eye_control` (`code/modules/mining/aux_base_camera.dm:126-128`, `code/game/machinery/computer/camera_advanced.dm:61-81`) |

Eye actions (each runs in the console; all are `datum/action/innate/aux_base` children, `code/modules/mining/aux_base_camera.dm:130-143`). Each starts with `check_spot()` (`:145-158`) unless noted; the console's RCD is replaced by an empty `/obj/item/construction/rcd/internal` if missing (`:142-143`).

| action (name) | delay (ds) | message(s) verbatim | result | file:line |
|---|---|---|---|---|
| Build ("Build") | `CLICK_CD_RANGE` for the user (`:184`); the RCD's own `do_after` | "You can only build within the mining base!" (`:151`), "The mining base has launched and can no longer be modified." (`:155`) on failure | finds the top object in the target turf that `rcd_vals` accepts (`:180-182`), runs `B.RCD.afterattack(rcd_target, owner, TRUE)` (`:185`), plays `sound/items/deconstruct.ogg` at 60 (`:186`) | code/modules/mining/aux_base_camera.dm:165-186 |
| Switch Mode ("Switch Mode") | none | "Build mode is now [buildmode]." (`:199`) | choices "Walls and Floors" = 1, "Airlocks" = 2, "Deconstruction" = 3, "Windows and Grilles" = 4 (`:196`), prompt "Set construction mode." (`:197`) | code/modules/mining/aux_base_camera.dm:188-199 |
| Select Airlock Type ("Select Airlock Type") | none | RCD's own prompt | `B.RCD.change_airlock_setting()` | code/modules/mining/aux_base_camera.dm:201-209 |
| Select Window Type ("Select Window Type") | none | none | `B.RCD.toggle_window_type()` | code/modules/mining/aux_base_camera.dm:212-219 |
| Place Tiny Fan ("Place Tiny Fan") | none | "[B] is out of fans!" (`:232`), "Fans may only be placed on a floor." (`:239`), "Tiny fan placed. [B.fans_remaining] remaining." (`:244`); sound `sound/machines/click.ogg` at 50 (`:245`) | spawns `/obj/structure/fans/tiny` on the eye's turf (`:242`), `fans_remaining--` (`:243`) | code/modules/mining/aux_base_camera.dm:221-245 |
| Install Plasma Anti-Wildlife Turret ("Install Plasma Anti-Wildlife Turret") | none | "Unable to construct additional turrets." (`:259`), "Location is obstructed by something. Please clear the location and try again." (`:265`), "Turret installation complete!" (`:273`); sound `sound/items/drill_use.ogg` at 65 (`:274`) | spawns `/obj/machinery/porta_turret/aux_base` (`:268`), adds it to the auxiliary base console's `turrets` if found (`:269-270`), `turret_stock--` (`:272`) | code/modules/mining/aux_base_camera.dm:247-274 |

### Internal RCD: `/obj/item/construction/rcd/internal`   (code/modules/mining/aux_base_camera.dm:23)

- Parent `/obj/item/construction/rcd` (`code/game/objects/items/RCD.dm:189`), whose `max_matter` is 160 (`:196`) and `delay_mod` 1 (`:207`).
- Own vars: `name` "internal RCD" (`code/modules/mining/aux_base_camera.dm:24`), `max_matter = 600` (`:25`), `no_ammo_message` "<span class='warning'>Internal matter exhausted. Please add additional materials.</span>" (`:26`), `delay_mod = 0.5` (`:27`). The comment there: "Roundstart consoles are filled, rebuilt cosoles start empty." (`:23`).
- Build delay: `rcd_create` gives `delay = rcd_results["delay"] * delay_mod` (`code/game/objects/items/RCD.dm:413`), i.e. half of the normal RCD delay, then `do_after(user, delay, target = A)` (`:416`). Matter cost is checked and spent (`:415`, `:420`). Cost and delay values per target are in `rcd_vals` on each target (not documented in this shard).
- `afterattack` with proximity TRUE (`code/game/objects/items/RCD.dm:505-509`): the console passes `TRUE` (`code/modules/mining/aux_base_camera.dm:185`).

### Deconstruction (base construction)

- Computer chain (part 1). The console's internal RCD is not returned: `Destroy` qdels it (`code/modules/mining/aux_base_camera.dm:87-89`) after `deconstruct` has already moved `contents` out (`code/game/machinery/computer/_computer.dm:119-120`). Any matter in it is lost (inferred).

### Drops (base construction)

- Computer drops (part 1), plus whatever was in `contents` (`code/game/machinery/computer/_computer.dm:119-120`). The internal RCD and its matter are deleted (`code/modules/mining/aux_base_camera.dm:87-89`).

### Health and armor

- Inherits `/obj/machinery/computer`: `max_integrity` 200, `integrity_failure` 0.5, armor melee 0, bullet 0, laser 0, energy 0, bomb 0, bio 0, rad 0, fire 40, acid 20 (`code/game/machinery/computer/_computer.dm:9-11`).

### Power

- 300 idle and 300 active (`code/game/machinery/computer/_computer.dm:7-8`).

### Gotchas

- Two `Initialize` definitions in one type: `Initialize()` at `code/modules/mining/aux_base_camera.dm:52` and `Initialize(mapload)` at `:56`. Which one the DM compiler keeps is not checked here. Only definition A creates `RCD`. Definition B reads `RCD.matter` (`:59`) on map load. The Build action recreates a missing RCD (`:142-143`). Port one initialiser that does both.
- The RCD accepts only metal, glass, plasteel, plasma glass, rglass, rods and plasteel tiles (`code/game/objects/items/RCD.dm:80-91`), so an inserted other sheet is not consumed.
- The eye only moves inside the base area (`code/modules/mining/aux_base_camera.dm:13-17`). Building anywhere else fails with the message above (`:151`).
- The console's name is "base construction console" but its board is "circuit board (Aux Mining Base Construction Console)" (`code/game/objects/items/circuitboards/computer_circuitboards.dm:112`).
- Set the eye to invisible when no one is using it (`code/modules/mining/aux_base_camera.dm:126-128`), so crew see the drone only while someone builds (`:124`).

---

## Xenobiology console (slime management)   `/obj/machinery/computer/camera_advanced/xenobio`   (code/modules/research/xenobiology/xenobio_camera.dm:20)

- Remote console for slimes and monkeys in xenobiology areas. Its eye picks up, places, scans and feeds slimes; monkey cubes and slime extracts are loaded into the console.
- Placed on BoxStation: x2 (`docs/tg/_todo3/gap-things-03.txt`).
- Key vars:

| var | value | file:line |
|---|---|---|
| `name` | "Slime management console" | code/modules/research/xenobiology/xenobio_camera.dm:21 |
| `desc` | "A computer used for remotely handling slimes." | code/modules/research/xenobiology/xenobio_camera.dm:22 |
| `networks` | list("ss13") | code/modules/research/xenobiology/xenobio_camera.dm:23 |
| `circuit` | `/obj/item/circuitboard/computer/xenobiology` | code/modules/research/xenobiology/xenobio_camera.dm:24 |
| `connected_recycler` | null (linked by multitool or same area) | code/modules/research/xenobiology/xenobio_camera.dm:33 |
| `stored_slimes` | list() | code/modules/research/xenobiology/xenobio_camera.dm:34, `:53` |
| `current_potion` | null (one slime potion slot) | code/modules/research/xenobiology/xenobio_camera.dm:35 |
| `max_slimes` | 5 | code/modules/research/xenobiology/xenobio_camera.dm:36 |
| `monkeys` | 0 (monkey stock, can be fractional) | code/modules/research/xenobiology/xenobio_camera.dm:37 |
| `icon_screen` / `icon_keyboard` | "slime_comp" / "rd_key" | code/modules/research/xenobiology/xenobio_camera.dm:39-40 |
| `light_color` | LIGHT_COLOR_PINK | code/modules/research/xenobiology/xenobio_camera.dm:42 |

- Initialize (`code/modules/research/xenobiology/xenobio_camera.dm:44-57`): creates the action objects, empties `stored_slimes`, and links the first monkey recycler in `GLOB.monkey_recyclers` that is in the same area (`:54-57`).
- Eye (`/mob/camera/ai_eye/remote/xenobio`, `code/modules/research/xenobiology/xenobio_camera.dm:2-18`): `visible_icon` TRUE, icon `icons/mob/cameramob.dmi`, icon_state "generic_camera" (`:3-5`); `allowed_area` is the eye's starting area name (`:8-10`); the eye can only move into an area with the same name or a `xenobiology_compatible` area (`:13-18`).
- `CreateEye` (`code/modules/research/xenobiology/xenobio_camera.dm:77-82`): eye at the console's turf, `visible_icon` TRUE, icon "generic_camera".
- `GrantActions` (`code/modules/research/xenobiology/xenobio_camera.dm:84-134`): grants the slime, feed, monkey, scan, potion and hotkey actions (`:87-120`) and registers six click signals on the user (`:122-127`); re-checks for a recycler on the same area (`:130-134`).
- `remove_eye_control` unregisters those signals (`code/modules/research/xenobiology/xenobio_camera.dm:136-143`).
- Multitool `multitool_act` links a recycler in the multitool's buffer: "You link [src] with [I.buffer] in [I] buffer." (`code/modules/research/xenobiology/xenobio_camera.dm:196-202`).

### Interactions (item in hand, console attackby)

| held item | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| `/obj/item/reagent_containers/food/snacks/monkeycube` | any | 0 | "You feed [O] to [src]. It now has [monkeys] monkey cubes stored." (`code/modules/research/xenobiology/xenobio_camera.dm:148`) | `monkeys++`, cube deleted (`:147-149`) |
| `/obj/item/storage/bag` | any | 0 | "You fill [src] with the monkey cubes stored in [O]. [src] now has [monkeys] monkey cubes stored." (`:160`), only if any cube was found | each monkeycube in the bag: `monkeys++` and deleted (`:154-158`); none found: nothing (`:159-161`) |
| `/obj/item/slimepotion/slime` | any | 0 | "You load [O] in the console's potion slot[replaced ? ", replacing the one that was there before" : ""]." (`:170`) | moved in (`:164`); an earlier potion is dropped at `drop_location()` (`:165-168`) |
| `/obj/item/slime_extract` (not yet researched, `SSresearch.slime_already_researched`) | `E.research` set, `E.Uses > 0` | 0 | "You insert [E] into a slot on the [src]. It pings and prints out some research notes worth [E.research] points!" (`:185`) | `/obj/item/research_notes` with `E.research` and "xenobiology" dropped (`:186`), marks the extract researched (`:187`), extract deleted (`:188`) |
| `/obj/item/slime_extract` | `E.research` not set | 0 | "[src] buzzes and displays a message: Invalid extract! (You shouldn't be seeing this. If you are, tell someone.)" (`:177`) | refused |
| `/obj/item/slime_extract` | `E.Uses <= 0` | 0 | "[src] buzzes and displays a message: Extract consumed - no research available." (`:181`) | refused |
| `/obj/item/slime_extract` | already researched | 0 | "[src] buzzes and displays a message: Slime extract already researched!" (`:191`) | refused |
| multitool | a recycler in the buffer | 0 | "You link [src] with [I.buffer] in [I] buffer." (`:199`) | `connected_recycler` set (`:200-201`) |
| anything else | none | none | none | `..()` (`:194`) |

Sounds: "buzz-sigh" at 50 for refusals (`:176`, `:180`, `:192`), "ping" at 50 for research (`:184`).

### Eye actions (`code/modules/research/xenobiology/xenobio_camera.dm:204-357`)

No ds delays are set. Each checks `GLOB.cameranet.checkTurfVis` (the eye's view) and fails with "Target is not near a camera. Cannot proceed." where it applies (e.g. `:222`, `:247`, `:273`, `:302`, `:319`, `:343`).

| action (name) | rules | message(s) verbatim | result | file:line |
|---|---|---|---|---|
| Place Slimes ("Place Slimes") | eye view | "[S] warps in!" per slime | every stored slime appears at the eye (`:216-220`) | code/modules/research/xenobiology/xenobio_camera.dm:209-222 |
| Pick up Slime ("Pick up Slime") | eye view; slime has no `ckey` (`:240`) | "[S] vanishes in a flash of light!" (`:243`) | up to `max_slimes` (5) slimes into `stored_slimes` (`:238-245`) | code/modules/research/xenobiology/xenobio_camera.dm:224-247 |
| Feed Slimes ("Feed Slimes") | needs `monkeys >= 1` | "[X] now has [X.monkeys] monkeys stored." (`:269`); refusal "[X] needs to have at least 1 monkey stored. Currently has [X.monkeys] monkeys stored." (`:271`) | spawns `/mob/living/carbon/monkey` at the eye, `monkeys--`, rounded to 0.1 (`:263-268`) | code/modules/research/xenobiology/xenobio_camera.dm:250-273 |
| Recycle Monkeys ("Recycle Monkeys") | needs `connected_recycler` | "There is no connected monkey recycler. Use a multitool to link one." (`:290`); per dead monkey "[M] vanishes as [M.p_theyre()] reclaimed for recycling!" (`:295`), "[X] now has [X.monkeys] monkeys available." (`:300`) | recycler `use_power(500)` (`:296`); `monkeys += recycler.cube_production` (`:297`); monkey deleted (`:299`) | code/modules/research/xenobiology/xenobio_camera.dm:276-302 |
| Scan Slime ("Scan Slime") | eye view | none here | `slime_scan(S, C)` for each slime at the eye (`:316-317`); `slime_scan` is `code/game/objects/items/devices/scanners.dm:693` | code/modules/research/xenobiology/xenobio_camera.dm:304-319 |
| Apply Potion ("Apply Potion") | a potion is loaded (`:334-336`), eye view | "No potion loaded." (`:335`) | `current_potion.attack(S, C)` on the first slime at the eye (`:339-341`) | code/modules/research/xenobiology/xenobio_camera.dm:321-343 |
| Hotkey Help ("Hotkey Help") | none | "<b>Click shortcuts:</b>", "Shift-click a slime to pick it up, or the floor to drop all held slimes.", "Ctrl-click a slime to scan it.", "Alt-click a slime to feed it a potion.", "Ctrl-click or a dead monkey to recycle it, or the floor to place a new monkey." (`:353-357`) | text only | code/modules/research/xenobiology/xenobio_camera.dm:345-357 |

Click shortcuts (`code/modules/research/xenobiology/xenobio_camera.dm:359-495`): slime ctrl = scan (`:393-402`), slime alt = potion (`:404-417`), slime shift = pick up, not when `ckey` is set ("The slime wiggled free!", `:432`) (`:419-438`), open turf shift = place slimes (`:441-453`), open turf ctrl = place a monkey (`:456-473`), dead monkey ctrl = recycle (`:476-495`). Each click shortcut uses the eye's `E.origin` console.

### Construction chain

- Computer chain with board `/obj/item/circuitboard/computer/xenobiology` (part 1 frame steps). Board name "Xenobiology Console (Computer Board)" (`code/game/objects/items/circuitboards/computer_circuitboards.dm:352-355`), build_path `/obj/machinery/computer/camera_advanced/xenobio`.

### Deconstruction chain

- Computer chain (part 1).

### Drops

| case | what drops | what is lost |
|---|---|---|
| screwdriver or destruction | frame with the board (`code/game/machinery/computer/_computer.dm:96-117`); every `obj` in `contents` moves to `loc` (`:119-120`) | the loaded potion (see Gotchas); the stored monkeys count |
| stored slimes | every slime in `stored_slimes` is put on `drop_location()` (`code/modules/research/xenobiology/xenobio_camera.dm:59-64`) | none |
| connected recycler | link removed (`code/modules/research/xenobiology/xenobio_camera.dm:65-67`) | none |

### Health and armor

- Inherits `/obj/machinery/computer` (`code/game/machinery/computer/_computer.dm:9-11`), as above.

### Power

- 300 idle and 300 active (`code/game/machinery/computer/_computer.dm:7-8`). The recycler's 500 per monkey is drawn from the recycler, not this console (`code/modules/research/xenobiology/xenobio_camera.dm:296`).

### Gotchas

- The loaded slime potion is deleted with the console, although `computer.deconstruct` moves it out first: `_computer.dm:119-120` moves every `obj` in `contents` to `loc`, then `Destroy` runs `QDEL_NULL(current_potion)` (`code/modules/research/xenobiology/xenobio_camera.dm:60`) on the still-set var (inferred from the two lines).
- Stored slimes (mobs, not objs) are not moved by the computer loop; `Destroy` drops them instead (`code/modules/research/xenobiology/xenobio_camera.dm:61-64`).
- Monkeys are a counter, not objects: the count is lost with the console (inferred).
- The console is "Slime management console" but its board is "Xenobiology Console (Computer Board)" (`code/game/objects/items/circuitboards/computer_circuitboards.dm:353`).
- Monkey recycler: `cube_production` default 0.2 (`code/modules/food_and_drinks/kitchen_machinery/monkeyrecycler.dm:15`) and it resets to 0 in `RefreshParts` (`:31-32`) (not on this shard's list; cited for the eye's recycle action).

# gap-things-03, part 4: medical laptop and pod control computer

Summary:
- Two computers: `/obj/machinery/computer/med_data/laptop` (x2 on BoxStation, medical records, log-in with an ID) and `/obj/machinery/computer/shuttle/pod` (x4 on BoxStation, escape pod launch; placed in the pod template, not in the BoxStation map file).
- The laptop is a child of `/obj/machinery/computer/med_data` (`code/game/machinery/computer/medical.dm:3`) and only overrides name, desc, icons and `pass_flags`; it inherits the board, access and records menu. Its board builds the desktop console, not the laptop.
- The pod console is a child of `/obj/machinery/computer/shuttle` (`code/modules/shuttle/computer.dm:1`) and has NO `circuit`: it cannot be taken apart, cannot break, and destroying it drops nothing.
- Power: 300 idle and 300 active, inherited from `/obj/machinery/computer` (`code/game/machinery/computer/_computer.dm:7-8`).
- Escape pods only launch at Code Red or when the console is emagged (`code/modules/shuttle/emergency.dm:441-447`).

---

## Parent: `/obj/machinery/computer/med_data`   (code/game/machinery/computer/medical.dm:3)

- Records console. Vars (`code/game/machinery/computer/medical.dm:3-20`): `name` "medical records console" (`:4`), `desc` "This can be used to check medical records." (`:5`), `icon_screen` "medcomp" (`:6`), `icon_keyboard` "med_key" (`:7`), `req_one_access` = list(ACCESS_MEDICAL, ACCESS_FORENSICS_LOCKERS) (`:8`), `circuit` = `/obj/item/circuitboard/computer/med_data` (`:9`), `rank`, `screen`, `active1`, `active2`, `temp`, `printing` (`:10-15`), `sortBy` "name", `order` 1 (`:17-18`), `light_color` LIGHT_COLOR_BLUE (`:20`).
- Board: "Medical Records Console (Computer Board)", `build_path` `/obj/machinery/computer/med_data` (`code/game/objects/items/circuitboards/computer_circuitboards.dm:276-279`).
- `ui_interact` (`code/game/machinery/computer/medical.dm:25-176`) opens the old HTML popup "Medical Records Console", 600 by 400 (`:173-176`). For a living user it plays `sound/machines/terminal_prompt_confirm.ogg` at 50 (`:27-28`). Shows "Log In" when not authenticated (`:170-172`); when authenticated, the menu: Search Records, List Records, Virus Database, Medbot Tracking, Record Maintenance and "{Log Out}" (`:36-45`).
- `Topic` (`code/game/machinery/computer/medical.dm:178-233`): needs `usr` in contents, or in range on a turf, or silicon, or admin ghost (`:187`). Log out (`:191-196`): clears authentication, screen and active records, plays `sound/machines/terminal_off.ogg` at 50 (`:196`).
- Log in (`code/game/machinery/computer/medical.dm:210-233`): silicon becomes rank "AI" (`:213-218`); admin ghost rank "Central Command" (`:219-224`); otherwise the ID from `get_idcard(TRUE)` must pass `check_access(I)` (`:225`) and sets `authenticated = I.registered_name`, `rank = I.assignment`, `screen = 1` (`:226-230`); else "Unauthorized access." (`:231-232`). Plays `sound/machines/terminal_on.ogg` at 50 (`:233`).
- `canUseMedicalRecordsConsole` (`code/game/machinery/computer/medical.dm:562-570`): a record may be used only when authenticated, the user can use the topic, and the record is the active one.
- `emp_act` (`code/game/machinery/computer/medical.dm:535-560`): not when `NOPOWER|BROKEN` or with `EMP_PROTECT_SELF`. For each medical record: `prob(10/severity)` changes one field (`:538-556`): name (`:541-545`), gender (`:546-547`), age (`:548-549`), blood type (`:550-551`), physical status (`:552-553`), mental status (`:554-555`); else `prob(1)` deletes the record (`:558-560`).
- No `attackby` in this file: the only tool handling is the computer's screwdriver (`code/game/machinery/computer/_computer.dm:58-65`), and the card is read at log-in (`:210-212`).

## Child: `/obj/machinery/computer/med_data/laptop`   (code/game/machinery/computer/medical.dm:572)

- Portable-looking records computer, "bolted to the table" by its own description.
- Placed on BoxStation: x2 (`docs/tg/_todo3/gap-things-03.txt`).
- Own vars (`code/game/machinery/computer/medical.dm:573-578`):

| var | value | file:line |
|---|---|---|
| `name` | "medical laptop" | code/game/machinery/computer/medical.dm:573 |
| `desc` | "A cheap Nanotrasen medical laptop, it functions as a medical records computer. It's bolted to the table." | code/game/machinery/computer/medical.dm:574 |
| `icon_state` | "laptop" | code/game/machinery/computer/medical.dm:575 |
| `icon_screen` | "medlaptop" | code/game/machinery/computer/medical.dm:576 |
| `icon_keyboard` | "laptop_key" | code/game/machinery/computer/medical.dm:577 |
| `pass_flags` | PASSTABLE | code/game/machinery/computer/medical.dm:578 |

- Everything else (board, `req_one_access`, menus, log-in, EMP, power, armor) is inherited from `/obj/machinery/computer/med_data` and `/obj/machinery/computer` above.

### Interactions (medical laptop)

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| screwdriver | `circuit` set (inherited) | 20 (`code/game/machinery/computer/_computer.dm:15`, `:63`) | "You start to disconnect the monitor..." (`:62`) | `deconstruct(TRUE, user)`; the frame gets the med_data board (see Gotchas) |
| ID card in hand or worn, has access | in range (`medical.dm:187`) | 0 | none | "Log In" succeeds (`code/game/machinery/computer/medical.dm:210-230`) |
| ID card without access | in range | 0 | "Unauthorized access." (`code/game/machinery/computer/medical.dm:232`) | refused |
| Log Out link | authenticated | 0 | none; sound `terminal_off.ogg` 50 (`code/game/machinery/computer/medical.dm:196`) | authentication cleared |
| Search / List / Maintenance / Virus DB / Medbot links | authenticated | 0 | none | screen change (`code/game/machinery/computer/medical.dm:235-240`) |

### Construction and deconstruction (medical laptop)

- Build: the computer frame chain (part 1) with board `/obj/item/circuitboard/computer/med_data`. The laptop has no board of its own: `circuit` is inherited (`code/game/machinery/computer/medical.dm:9`).
- Deconstruct: computer chain (part 1). The frame's board `build_path` is `/obj/machinery/computer/med_data` (`code/game/objects/items/circuitboards/computer_circuitboards.dm:279`), so a rebuilt laptop is the desktop "medical records console" (inferred from the frame code, part 1).

### Drops (medical laptop)

- Screwdriver: frame state 4 with the med_data board, glass inside; `contents` moved out (`code/game/machinery/computer/_computer.dm:96-121`).
- Destroyed: broken first (2 shards, frame state 3), then `deconstruct(FALSE)` (`code/game/objects/obj_defense.dm:17-21`, `:252-258`; `code/game/machinery/computer/_computer.dm:104-112`).
- Stored records are not items; they are in `GLOB.data_core` and are not dropped (inferred from the records being global lists in this file).

### Health and armor (medical laptop)

- Inherited from `/obj/machinery/computer`: `max_integrity` 200, `integrity_failure` 0.5 (breaks at 100), armor melee 0, bullet 0, laser 0, energy 0, bomb 0, bio 0, rad 0, fire 40, acid 20 (`code/game/machinery/computer/_computer.dm:9-11`).

### Power (medical laptop)

- 300 idle, 300 active (`code/game/machinery/computer/_computer.dm:7-8`); the DM literal, brief unit watts.

### Gotchas (medical laptop)

- The laptop's board builds the desktop "medical records console", not the laptop (`code/game/objects/items/circuitboards/computer_circuitboards.dm:279`). Porting the frame to laptop needs its own board.
- The laptop is "bolted to the table" in its description, but its anchored state is only the machine default (`code/game/machinery/_machinery.dm:98`); no table-bolting code is in this file (inferred).
- Log-in reads the card from the user's hands or worn ID (`code/game/machinery/computer/medical.dm:212`, `get_idcard(TRUE)`), not from a slot in the console.
- EMP can rewrite or delete records (above); records are global (`GLOB.data_core`), so this affects every console.

---

## Parent: `/obj/machinery/computer/shuttle`   (code/modules/shuttle/computer.dm:1)

- Shuttle control console. Vars (`code/modules/shuttle/computer.dm:2-11`): `name` "shuttle console" (`:2`), `desc` "A shuttle control computer." (`:3`), `icon_screen` "shuttle" (`:4`), `icon_keyboard` "tech_key" (`:5`), `light_color` LIGHT_COLOR_CYAN (`:6`), `req_access = list( )` (`:7`), `shuttleId` (`:8`), `possible_destinations` "" (`:9`), `admin_controlled` (`:10`), `no_destination_swap` 0 (`:11`).
- No `circuit` on this type: it inherits null from `/obj/machinery` (`code/game/machinery/_machinery.dm:122`). The computer's screwdriver handler therefore does nothing for shuttle consoles (`code/game/machinery/computer/_computer.dm:58-65`).
- `ui_interact` (`code/modules/shuttle/computer.dm:13-37`): status text from the shuttle (`:17`); for each stationary port whose `id` is in `possible_destinations` and that `check_dock(S, silent=TRUE)` accepts: "Send to [S.name]" link (`:19-26`); none: "Shuttle Locked" (`:27-28`); if `admin_controlled`: "Authorized personnel only" (`:29-30`) and a "Request Authorization" link (`:31`) whose href has a stray `]` (`request=1]`) and no handler in `Topic` (`:39-71`).
- `Topic` (`code/modules/shuttle/computer.dm:39-71`): refused when `allowed(usr)` is false, message "Access denied." (`:44-46`). `move`: refused if already escaped ("You've already escaped. Never going back to that place again!", `:50-52`); with `no_destination_swap`, refused in recharge or transit (`:53-59`); destination must be in `possible_destinations` or the attempt is logged (`:60-63`). Then `SSshuttle.moveShuttle(shuttleId, href_list["move"], 1)` (`:64`): 0 gives "Shuttle departing. Please stand away from the doors." (`:66`); 1 gives "Invalid shuttle requested." (`:69`); anything else gives "Unable to comply." (`:71`).
- `allowed(usr)` (`code/modules/jobs/access.dm:3-5`) returns TRUE when the object requires no access ("check if it doesn't require any access at all").
- `emag_act` (`code/modules/shuttle/computer.dm:73-78`): clears `req_access`, sets EMAGGED, "You fried the consoles ID checking system."
- `connect_to_shuttle` (`code/modules/shuttle/computer.dm:80-82`): sets `shuttleId = port.id` if still the default (or override).

## Child: `/obj/machinery/computer/shuttle/pod`   (code/modules/shuttle/emergency.dm:452)

- Escape pod control console. Placed on BoxStation: x4 (`docs/tg/_todo3/gap-things-03.txt`). Our placements come from the escape pod template, `_maps/shuttles/escape_pod_default.dmm` (line 12, `/obj/machinery/computer/shuttle/pod` with `pixel_x` offsets), not from `BoxStation.dmm`.
- Own vars (`code/modules/shuttle/emergency.dm:453-459`):

| var | value | file:line |
|---|---|---|
| `name` | "pod control computer" | code/modules/shuttle/emergency.dm:453 |
| `admin_controlled` | 1 | code/modules/shuttle/emergency.dm:454 |
| `possible_destinations` | "pod_asteroid" | code/modules/shuttle/emergency.dm:455 |
| `icon` / `icon_state` | 'icons/obj/terminals.dmi' / "dorm_available" | code/modules/shuttle/emergency.dm:456-457 |
| `light_color` | LIGHT_COLOR_BLUE | code/modules/shuttle/emergency.dm:458 |
| `density` | FALSE | code/modules/shuttle/emergency.dm:459 |

- `ComponentInitialize` adds `update_icon_blocker` (`code/modules/shuttle/emergency.dm:461-463`).
- `connect_to_shuttle` (`code/modules/shuttle/emergency.dm:471-474`): calls the parent, then if `possible_destinations` is still the default (or override), sets it to "pod_lavaland[idnum]". On BoxStation the stationary ports with those ids are `pod_lavaland1`..`pod_lavaland4` (`_maps/map_files/BoxStation/BoxStation.dmm:39586`, `:38643`, `:6287`, `:39927`). The default "pod_asteroid" id has no port on BoxStation (inferred from the grep of that id, which finds only the console).
- Pod port id: `id = "pod"` on `/obj/docking_port/mobile/pod` (`code/modules/shuttle/emergency.dm:429-435`), so the console's `shuttleId` is "pod".

### Interactions (pod control console)

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| screwdriver | no `circuit` | none | none | nothing happens; the tool is consumed (`code/game/machinery/computer/_computer.dm:58-65`) |
| emag card (`emag_act`) | not already EMAGGED | 0 | "You fry the pod's alert level checking system." (`code/modules/shuttle/emergency.dm:469`) | `obj_flags |= EMAGGED` (`:468`); the pod can then launch at any alert level (`:441`) |
| emag, already EMAGGED | | 0 | none | returns (`:466-467`) |
| Send to [pod destination] link | access (no `req_access`, `allowed` TRUE), destination in list | 0 | "Shuttle departing. Please stand away from the doors." (`code/modules/shuttle/computer.dm:66`) on success | `moveShuttle` → pod `request` (below) |

### Launch rule (the pod's `request`)

- `/obj/docking_port/mobile/pod/request(S)` (`code/modules/shuttle/emergency.dm:437-447`):
  1. The console is looked up with `getControlConsole()` (`:438`). If it is not a pod console, the parent `request` runs (`:439-440`).
  2. If `GLOB.security_level >= SEC_LEVEL_RED` (2 is `SEC_LEVEL_RED`, `code/__DEFINES/misc.dm:60`) or the console is EMAGGED (`:441`): if `launch_status == UNLAUNCHED`, sets `EARLY_LAUNCHED` and runs the parent `request` (`:442-444`).
  3. Otherwise: "Escape pods will only launch during \"Code Red\" security alert." (`:446`), returns TRUE (`:447`).
- The chain is `Topic` → `SSshuttle.moveShuttle` (`code/modules/shuttle/computer.dm:64`) → `M.request(D)` (`code/controllers/subsystem/shuttle.dm:408`); a TRUE return gives "Unable to comply." (`code/modules/shuttle/computer.dm:70-71`).
- Gotcha: when the alert is at Code Red (or EMAGGED) but `launch_status` is not UNLAUNCHED, the `if` at `:442` does not run and the proc returns no value (inferred from the structure: there is no return after `:444` in that branch). The caller then treats it as success (`code/controllers/subsystem/shuttle.dm:408` tests the result for truth).
- `cancel()` returns at once (`code/modules/shuttle/emergency.dm:449-450`): a pod cannot be recalled.
- The pod port is `width` 3, `height` 4, `dwidth` 1, `launch_status = UNLAUNCHED` (`code/modules/shuttle/emergency.dm:429-435`).
- Landing site of a pod: `/obj/docking_port/stationary/random` (`code/modules/shuttle/emergency.dm:476-503`) with `target_area` `/area/lavaland/surface/outdoors` (`:482`) and `edge_distance` 16 (`:483`); on failure it warns and is deleted (`:502-503`).

### Construction and deconstruction (pod control console)

- None. No `circuit`, so no computer frame is made (`code/game/machinery/computer/_computer.dm:96-121`, the frame branch needs `circuit`). Nothing can be built back from this console (inferred from the code path).

### Drops (pod control console)

| case | what drops | notes |
|---|---|---|
| screwdriver | nothing (`code/game/machinery/computer/_computer.dm:58-65`) | the console stays |
| broken | not possible: `obj_break` returns at once without a circuit (`code/game/machinery/computer/_computer.dm:77-79`) | the console never shows BROKEN |
| destroyed (integrity 0) | `deconstruct(FALSE)`: no frame, no shards; `obj` entries in `contents` moved to `loc` (`code/game/machinery/computer/_computer.dm:119-120`), then the console is deleted (`code/game/objects/obj_defense.dm:252-258`) | the console itself; nothing else |

### Health and armor (pod control console)

- Inherited from `/obj/machinery/computer` (`code/game/machinery/computer/_computer.dm:9-11`): `max_integrity` 200, fire 40, acid 20, other armor 0. The integrity threshold for BROKEN (0.5, `:10`) has no effect without a circuit (`:77-79`).

### Power (pod control console)

- 300 idle, 300 active (`code/game/machinery/computer/_computer.dm:7-8`); the DM literal, brief unit watts.

### Gotchas (pod control console)

- Without a circuit the pod console can be neither taken apart nor broken; it can only be destroyed outright (see drops). Port it as indestructible-by-tool, destroyed-by-damage with no drop.
- The default destination "pod_asteroid" matches no port on BoxStation; the console only works after `connect_to_shuttle` replaces it with "pod_lavaland[idnum]" (`code/modules/shuttle/emergency.dm:471-474`).
- The pod console's `possible_destinations` string is parsed with `params2list` (`code/modules/shuttle/computer.dm:15`, `:60`), so the id list is a param string.
- The "Request Authorization" href has a stray bracket (`code/modules/shuttle/computer.dm:31`) and no handler in `Topic` (`:39-71`), so it does nothing.
- The pod's refusal sends the Code Red message and then "Unable to comply." (`code/modules/shuttle/emergency.dm:446-447`, `code/modules/shuttle/computer.dm:70-71`).

# gap-things-03, part 5: delivery chute

Summary:
- One type on the list: `/obj/machinery/disposal/delivery_chute` (x2 on BoxStation), a child of `/obj/machinery/disposal` (`code/modules/recycling/disposal/bin.dm:5`), which is a machine with no circuit and no power draw of its own.
- Put items in (or walk into it) and it flushes them at once into the pipe network through a trunk pipe under it; mobs can be stuffed in by hand.
- Built from a pipe kit (`/obj/structure/disposalconstruct`), which is also what it drops when deconstructed or destroyed.
- No `process()`, so no power, no pressure charging, no tick: the bin's charge and flush logic does not run in the chute.
- Numbers are raw: flush sleeps 10 and 5 ds; wrench and screwdriver are instant; welder 20 ds (dismantle) and 8 ds (build).

## Parent: `/obj/machinery/disposal`   (code/modules/recycling/disposal/bin.dm:5)

- Shared base of the bin and the chute.
- Vars (`code/modules/recycling/disposal/bin.dm:5-26`):

| var | value | file:line |
|---|---|---|
| `icon` | 'icons/obj/atmospherics/pipes/disposal.dmi' | code/modules/recycling/disposal/bin.dm:6 |
| `density` | TRUE | code/modules/recycling/disposal/bin.dm:7 |
| `armor` | melee 25, bullet 10, laser 10, energy 100, bomb 0, bio 100, rad 100, fire 90, acid 30 | code/modules/recycling/disposal/bin.dm:8 |
| `max_integrity` | 200 | code/modules/recycling/disposal/bin.dm:9 |
| `resistance_flags` | FIRE_PROOF | code/modules/recycling/disposal/bin.dm:10 |
| `interaction_flags_machine` | INTERACT_MACHINE_OPEN \| INTERACT_MACHINE_WIRES_IF_OPEN \| INTERACT_MACHINE_ALLOW_SILICON \| INTERACT_MACHINE_OPEN_SILICON | code/modules/recycling/disposal/bin.dm:11 |
| `obj_flags` | CAN_BE_HIT \| USES_TGUI | code/modules/recycling/disposal/bin.dm:12 |
| `ui_x` / `ui_y` | 300 / 180 | code/modules/recycling/disposal/bin.dm:14-15 |
| `air_contents` | internal gas reservoir | code/modules/recycling/disposal/bin.dm:17 |
| `full_pressure` | FALSE | code/modules/recycling/disposal/bin.dm:18 |
| `pressure_charging` | TRUE (the chute sets FALSE, see below) | code/modules/recycling/disposal/bin.dm:19, `:444` |
| `flush` | 0 (flush handle) | code/modules/recycling/disposal/bin.dm:20 |
| `trunk` | null (attached trunk pipe) | code/modules/recycling/disposal/bin.dm:21 |
| `flushing` | 0 | code/modules/recycling/disposal/bin.dm:22 |
| `flush_every_ticks` | 30 | code/modules/recycling/disposal/bin.dm:23 |
| `stored` | the pipe kit, `/obj/structure/disposalconstruct` | code/modules/recycling/disposal/bin.dm:26 |

- `max_integrity` 200 and armor are inherited by the chute. `integrity_failure` is not set, so 0 (`code/game/objects/objs.dm:19`): the chute never enters BROKEN from damage.
- `SEND_PRESSURE` = 0.05 * ONE_ATMOSPHERE (`code/modules/recycling/disposal/bin.dm:3`).

### Initialize and kit link (`code/modules/recycling/disposal/bin.dm:30-47`)

- With `make_from` (a pipe kit): `setDir(make_from.dir)`, the kit moves to nullspace and becomes `stored` (`:33-36`), `pressure_charging = FALSE` (`:37`).
- Without it (map-placed): `stored = new /obj/structure/disposalconstruct(null, null, SOUTH, FALSE, src)` (`:38-39`). That kit's `pipe_type` is this machine's type (`code/modules/recycling/disposal/construction.dm:16-20`).
- `trunk_check()` (`:41`; `:49-58`): finds a trunk on `loc`; without one, `pressure_charging = FALSE` and `flush = FALSE` (`:51-53`); with one, links it (`:58`).
- Returns `INITIALIZE_HINT_LATELOAD` (`:47`). `LateInitialize` takes air from the turf (`:71-78`).

### Destroy (`code/modules/recycling/disposal/bin.dm:60-64`)

- `eject()` (`:61`, `:174-179`): every movable in the unit goes to the turf with `pipe_eject`.
- The trunk's `linked` is cleared (`:62-63`).

### Damage and power interactions (parent)

- `singularity_pull` calls `deconstruct()` when the singularity's `current_size` is at least `STAGE_FIVE` (`code/modules/recycling/disposal/bin.dm:66-69`); the kit is dropped as for any deconstruction.
- EMP and BROKEN: none defined here; `/obj/machinery` defaults apply (`code/game/machinery/_machinery.dm:187-191`).

---

## Delivery chute   `/obj/machinery/disposal/delivery_chute`   (code/modules/recycling/disposal/bin.dm:439)

- A one-way drop chute into the disposal pipes. Anything put in or walked into it is flushed through the trunk under it.
- Placed on BoxStation: x2 (`docs/tg/_todo3/gap-things-03.txt`).
- Key vars:

| var | value | file:line |
|---|---|---|
| `name` | "delivery chute" | code/modules/recycling/disposal/bin.dm:440 |
| `desc` | "A chute for big and small packages alike!" | code/modules/recycling/disposal/bin.dm:441 |
| `density` | TRUE | code/modules/recycling/disposal/bin.dm:442 |
| `icon_state` | "intake" | code/modules/recycling/disposal/bin.dm:443 |
| `pressure_charging` | FALSE ("the chute doesn't need charging and always works") | code/modules/recycling/disposal/bin.dm:444 |

- Initialize (`code/modules/recycling/disposal/bin.dm:446-450`): `trunk = locate() in loc`; if found, `trunk.linked = src`.
- No `circuit`, no `component_parts`, no `process()`: there is no board, frame or power draw on this type.

### Interactions

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| screwdriver | `!pressure_charging && !full_pressure && !flush` (`code/modules/recycling/disposal/bin.dm:82-84`) | 0 (`play_tool_sound` only, `:85`) | "You remove the screws around the power connection." (panel opening) / "You attach the screws around the power connection." (closing) (`:86`) | toggles `panel_open` (`:84`) |
| welder | `panel_open` (`:88`), `tool_start_check(amount=0)` (`:89`) | 20 (`:93`, `use_tool(src, user, 20, volume=100)`) | "You start slicing the floorweld off \the [src]..." (`:92`), "You slice the floorweld off \the [src]." (`:94`) | `deconstruct()` (`:95`); if the panel closes mid-use, nothing happens (`:93`, `&& panel_open`) |
| any item, not harm intent (`user.a_intent != INTENT_HARM`, `:98`) | item not `ABSTRACT`, hand released (`:99`) | 0 | "[user.name] places \the [I] into \the [src]." / "You place \the [I] into \the [src]." (`:109`) | `place_item_in_disposal` (chute override, `:452-455`): flushes if `I.CanEnterDisposals()`; `update_icon()`; attackby returns 1 (`:101-103`) |
| any item, harm intent | | | | `..()` (`:104-105`) |
| mob dragged onto the chute (`MouseDrop_T`, `:112-113`) | user carbon or ventcrawler, or a borg with `canDispose`; target not buckled and `mob_size <= MOB_SIZE_HUMAN` (`:116-131`) | 20 (`do_mob(user, target, 20)`, `:136`) | "[user] starts climbing into [src]." / "You start climbing into [src]..." (`:133`); "[user] starts putting [target] into [src]." (`:135`); "[target] doesn't fit inside [src]!" (`:129`) | target `forceMove` into the chute (`:139`); no flush is called here (inferred) |
| monkey or xeno (`attack_paw`) | not BROKEN (`:167`) | 0 | none | toggles `flush` (`:169`); no `process` runs on the chute, so the flag has no effect (inferred) |

- Projectiles, effects and mechs do not enter (`CanEnterDisposals` returns null: `code/modules/recycling/disposal/bin.dm:488-495`).
- Walk-ins from the chute's open side: `Bumped` (`code/modules/recycling/disposal/bin.dm:457-483`).

### Walk-in (`Bumped`, `code/modules/recycling/disposal/bin.dm:457-483`)

- Returns unless the walker `CanEnterDisposals()` (`:458`).
- Direction gate: NORTH needs `AM.loc.y == loc.y + 1`, EAST `AM.loc.x == loc.x + 1`, SOUTH `AM.loc.y == loc.y - 1`, WEST `AM.loc.x == loc.x - 1` (`:460-472`).
- Objects are moved in (`:474-476`). A mob has a 2% chance (`prob(2)`) to be refused with "You hit the edge of the chute." (`:479-481`); else it is moved in (`:482`).
- Then `flush()` (`:483`).

### Flush (parent, used by the chute; `code/modules/recycling/disposal/bin.dm:181-197`)

1. `flushing = TRUE`, `flushAnimation()` flicks "[icon_state]-flush", i.e. "intake-flush" (`:182-183`, `:204-206`).
2. `sleep(10)` (10 ds) (`:184`).
3. Sound `sound/machines/disposalflush.ogg` at 50, FALSE, FALSE (`code/modules/recycling/disposal/bin.dm:185-187`), guarded by `last_sound < world.time + 1` (`:185`).
4. `sleep(5)` (5 ds) (`:188`).
5. A `/obj/structure/disposalholder` is made, `newHolderDestination` sets `destinationTag = 1` for the chute (`:191-192`, `:500-501`), `H.init`, `H.start(src)` (`:193-195`); `flushing = FALSE`, `flush = FALSE` (`:196-197`).
- Items leave the holder at the outlet end through `expel` (`code/modules/recycling/disposal/bin.dm:208-225`): `throw_at(target, 5, 1)` per item, sound `sound/machines/hiss.ogg` at 50 (`:213`, `:222`).

### Construction chain

Built from a pipe kit (`/obj/structure/disposalconstruct`, `code/modules/recycling/disposal/construction.dm:4`, max_integrity 200 at `:12`, anchored FALSE at `:9`, density FALSE at `:10`; `pipename` = `initial(pipe_type.name)` = "delivery chute" at `:28`).
1. Get a chute kit: the RPD "Chute" entry (`code/game/objects/items/RPD.dm:56`) makes one with `new /obj/structure/disposalconstruct(A, queued_p_type, ...)` (`code/game/objects/items/RPD.dm:420`); the pipe dispenser makes one with `new (loc, p_type)` (`code/game/machinery/pipe/pipe_dispenser.dm:142`).
2. Place the kit on a tile with the floor plating removed. Refused with "You can only attach the [pipename] if the floor plating is removed!" on an intact floor (`code/modules/recycling/disposal/construction.dm:114-115`); refused on walls with "You can't build [pipename]s on walls, only disposal pipes!" (`:118-120`).
3. A trunk pipe must be on the same tile: otherwise "The [pipename] requires a trunk underneath it in order to work!" (`code/modules/recycling/disposal/construction.dm:132-141`).
4. Wrench, instant (no `use_tool`): "You attach the [pipename] to the underfloor." (`code/modules/recycling/disposal/construction.dm:143-146`); `anchored = TRUE`, `density` from the chute type, TRUE (`:144`).
5. Welder, 8 ds: "You start welding the [pipename] in place..." (`code/modules/recycling/disposal/construction.dm:156`), then `use_tool(src, user, 8, volume=50)` (`:157`); "The [pipename] has been welded in place." (`:158`); `new pipe_type(loc, src)` (`:159`), the kit becomes the chute's `stored` (`code/modules/recycling/disposal/bin.dm:33-36`). Refused unanchored: "You need to attach it to the plating first!" (`code/modules/recycling/disposal/construction.dm:162-163`).

### Deconstruction chain

1. Screwdriver, 0 ds: "You remove the screws around the power connection." (`code/modules/recycling/disposal/bin.dm:82-86`).
2. Welder, 20 ds, with the panel open: "You start slicing the floorweld off \the [src]..." then "You slice the floorweld off \the [src]." (`code/modules/recycling/disposal/bin.dm:88-95`).
3. `deconstruct()` (`code/modules/recycling/disposal/bin.dm:227-238`): `stored` (the kit) moves to `loc`, `anchored = FALSE`, `density = TRUE`, `update_icon()` (`:228-235`); every movable in the chute moves to `loc` (`:236-237`); then the machine base deconstruct, which makes no frame (no `component_parts`, `code/game/machinery/_machinery.dm:402-410`), and deletes the chute.

### Drops

| case | what drops | what stays | notes |
|---|---|---|---|
| (a) deconstructed (welder, step 2 above) | the chute kit (`stored`), any items or mobs inside (`code/modules/recycling/disposal/bin.dm:228-238`) | nothing | kit is unanchored, density TRUE |
| (b) destroyed (integrity 0, `code/game/objects/obj_defense.dm:252-258`) | `obj_destruction` calls `deconstruct(FALSE)`; the parent's `deconstruct` ignores `disassembled`, so the same kit drops (`code/modules/recycling/disposal/bin.dm:227-238`) | nothing | destruction and deconstruction give the same drop |
| (c) singularity stage 5 | `deconstruct()` (`code/modules/recycling/disposal/bin.dm:66-69`) | nothing | same as (a) |

### Health and armor

- `max_integrity` 200 (`code/modules/recycling/disposal/bin.dm:9`). Armor: melee 25, bullet 10, laser 10, energy 100, bomb 0, bio 100, rad 100, fire 90, acid 30 (`code/modules/recycling/disposal/bin.dm:8`).
- `FIRE_PROOF` (`code/modules/recycling/disposal/bin.dm:10`).
- Kit health: `max_integrity` 200 (`code/modules/recycling/disposal/construction.dm:12`), `pressure_resistance` 5 * ONE_ATMOSPHERE (`:11`).

### Power

- None. No `process()` on the chute (`code/modules/recycling/disposal/bin.dm` defines `process()` only on `/obj/machinery/disposal/bin`, line 385); the machine tick returns PROCESS_KILL for it (`code/game/machinery/_machinery.dm:181-182`). The bin's draws (`use_power(100)` at `code/modules/recycling/disposal/bin.dm:404` and `use_power(500)` at `:410`) are in the bin's process only. `idle_power_usage` and `active_power_usage` are 0 (`code/game/machinery/_machinery.dm:106-107`).

### Gotchas

- Destruction and deconstruction both leave the pipe kit (`code/modules/recycling/disposal/bin.dm:227-238`). Port it that way; there is no "destroyed chute leaves nothing".
- A chute only works with a trunk pipe on its tile (`code/modules/recycling/disposal/construction.dm:132-141`, `code/modules/recycling/disposal/bin.dm:49-58`); without one `trunk_check` sets `pressure_charging` and `flush` to FALSE, which has no visible effect on the chute because it never charges.
- The screwdriver check is `!pressure_charging && !full_pressure && !flush` (`code/modules/recycling/disposal/bin.dm:82-84`), so the panel can always be opened on a chute (its `pressure_charging` is FALSE), but not on a bin that is charging.
- A mob pushed in by hand is not flushed by the chute itself (`code/modules/recycling/disposal/bin.dm:116-146`, no `flush()` call); it leaves only when something else flushes (inferred).
- Objects that CanEnterDisposals is false for are already off the hand when the attack runs (`code/modules/recycling/disposal/bin.dm:99`); the chute then does not flush them (`:452-455`), so such an item is left where the hand code put it (inferred; the `temporarilyRemoveItemFromInventory` target is not checked here).
- The 2% walk-in refusal is per walk-in (`code/modules/recycling/disposal/bin.dm:479-481`).

# gap-things-03, part 6: door timer, minimum viable port, open questions, coverage

Summary:
- Last list entry: `/obj/machinery/door_timer` (x3 on BoxStation), a brig timer panel. Its countdown opens and closes linked brig doors, flashers and secure closets.
- Shard totals: 14 list paths, all located by `tools/tgwhere.py`, all documented; 0 NOT FOUND.
- Open questions: two duplicated `Initialize` definitions (door timer and base construction console), which the newer snapshot also has.

---

## Door timer   `/obj/machinery/door_timer`   (code/game/machinery/doors/brigdoors.dm:21)

- Brig timer panel. A TGUI panel sets a countdown in deciseconds; when it expires, the timer releases linked brig doors, closets and flashers. Starting it closes the doors and locks the closets.
- Placed on BoxStation: x3 (`docs/tg/_todo3/gap-things-03.txt`).
- Key vars (`code/game/machinery/doors/brigdoors.dm:21-41`):

| var | value | file:line |
|---|---|---|
| `name` | "door timer" | code/game/machinery/doors/brigdoors.dm:22 |
| `icon` / `icon_state` | 'icons/obj/status_display.dmi' / "frame" | code/game/machinery/doors/brigdoors.dm:23-24 |
| `desc` | "A remote control for a door." | code/game/machinery/doors/brigdoors.dm:25 |
| `req_access` | list(ACCESS_SECURITY) | code/game/machinery/doors/brigdoors.dm:26 |
| `density` | FALSE | code/game/machinery/doors/brigdoors.dm:27 |
| `id` | null (the link tag shared with doors, flashers and closets) | code/game/machinery/doors/brigdoors.dm:28 |
| `activation_time` / `timer_duration` | 0 / 0 (ds) | code/game/machinery/doors/brigdoors.dm:30-31 |
| `timing` | FALSE | code/game/machinery/doors/brigdoors.dm:33 |
| `targets` | list() | code/game/machinery/doors/brigdoors.dm:34 |
| `Radio` | `/obj/item/radio` | code/game/machinery/doors/brigdoors.dm:35 |
| `ui_x` / `ui_y` | 300 / 138 | code/game/machinery/doors/brigdoors.dm:40-41 |

- Constants (`code/game/machinery/doors/brigdoors.dm:1-9`): `CHARS_PER_LINE` 5 (`:1`), `FONT_SIZE` "5pt" (`:2`), `FONT_COLOR` "#09f" (`:3`), `FONT_STYLE` "Small Fonts" (`:4`), `MAX_TIMER` 9000 (`:5`), `PRESET_SHORT` 1200 (`:7`), `PRESET_MEDIUM` 1800 (`:8`), `PRESET_LONG` 3000 (`:9`). All timer values are deciseconds.

### Initialize (two definitions, see Open questions)

- Definition A, `code/game/machinery/doors/brigdoors.dm:43-47`: `Radio = new/obj/item/radio(src)` and `Radio.listening = 0`.
- Definition B, `code/game/machinery/doors/brigdoors.dm:49-66`: if `id != null`, collects into `targets`: brig door windows with the same id within `urange(20)` (`:52-54`), flashers with the same id (`:56-58`), secure brig closets with the same id (`:60-62`). If `targets` is empty: `obj_break()` (`:64-65`). Then `update_icon()` (`:66`).
- Definition B does not create `Radio`.

### Timer logic

- `process` (`code/game/machinery/doors/brigdoors.dm:72-79`): returns if `NOPOWER|BROKEN` (`:73-74`); while timing, when `world.time - activation_time >= timer_duration` it calls `timer_end()` (`:76-78`), and refreshes the icon (`:79`).
- `timer_start` (`code/game/machinery/doors/brigdoors.dm:83-102`): returns 0 if `NOPOWER|BROKEN` (`:84-85`); sets `activation_time = world.time` and `timing = TRUE` (`:87-88`). Brig doors that are open get `close` invoked async (`:90-93`). Brig closets: skipped if broken; an open closet must close first (`:95-99`, skipped if `close()` fails); then `locked = TRUE` and icon update (`:100-101`).
- `timer_end(forced)` (`code/game/machinery/doors/brigdoors.dm:105-132`): returns 0 if `NOPOWER|BROKEN` (`:107-108`). If not forced: `Radio.set_frequency(FREQ_SECURITY)` and `Radio.talk_into(src, "Timer has expired. Releasing prisoner.", FREQ_SECURITY)` (`:110-112`). Then `timing = FALSE`, `activation_time = null`, `set_timer(0)`, icon update (`:114-117`). Brig doors that are closed open async (`:119-122`); closets unlock unless broken or open (`:124-130`).
- `time_left(seconds)` (`code/game/machinery/doors/brigdoors.dm:135-138`): `max(0, timer_duration - (activation_time ? world.time - activation_time : 0))`; with `seconds`, divided by 10.
- `set_timer(value)` (`code/game/machinery/doors/brigdoors.dm:140-143`): clamps to 0..`MAX_TIMER` (9000); returns TRUE when unchanged.
- Radio: `FREQ_SECURITY` 1359 (`code/__DEFINES/radio.dm:66`).

### Display

- `update_icon` (`code/game/machinery/doors/brigdoors.dm:156-175`): NOPOWER shows "frame" (`:157-159`); BROKEN shows `set_picture("ai_bsod")` (`:161-162`); while timing, line 1 is `id`, line 2 is "MM:SS" from `time_left(seconds = TRUE)` (`:165-171`), replaced by "Error" when longer than `CHARS_PER_LINE` (`:169-170`); otherwise the text is cleared (`:172-174`).
- `update_display` (`code/game/machinery/doors/brigdoors.dm:188-193`): uppercases both lines, `<div>` with `FONT_SIZE`, `FONT_COLOR`, `FONT_STYLE`, centred.

### UI (`ui_interact`, `ui_data`, `ui_act`)

- `ui_interact` (`code/game/machinery/doors/brigdoors.dm:145-150`): TGUI "BrigTimer" at `ui_x` by `ui_y`.
- `ui_data` (`code/game/machinery/doors/brigdoors.dm:195-206`): `seconds` and `minutes` from `time_left(seconds = TRUE)`, `timing`, `flash_charging` (TRUE while any target flasher has `last_flash + 150 > world.time`, `:202-205`, where 150 is a ds value).
- `ui_act` (`code/game/machinery/doors/brigdoors.dm:209-244`): if `..()` returns, nothing. Any action first checks `allowed(usr)`, failing with "Access denied." (`:214-216`).

| action | params | delay (ds) | message(s) verbatim | result | file:line |
|---|---|---|---|---|---|
| `time` | `adjust` | 0 | none | `set_timer(time_left() + value)` (clamped, `:140-143`) | code/game/machinery/doors/brigdoors.dm:219-222 |
| `start` | none | 0 | none | `timer_start()` (`:224`) | code/game/machinery/doors/brigdoors.dm:223-224 |
| `stop` | none | 0 | none (`timer_end(forced = TRUE)` skips the radio, `:110-111`) | timer ends at once, doors open, closets unlock | code/game/machinery/doors/brigdoors.dm:225-226 |
| `flash` | none | 0 | none | `F.flash()` on every target flasher (`:228-229`) | code/game/machinery/doors/brigdoors.dm:227-229 |
| `preset` | `preset` = "short" / "medium" / "long" | 0 | none | `set_timer(1200 / 1800 / 3000)` (`:233-240`); if timing, `activation_time = world.time` (`:241-242`) | code/game/machinery/doors/brigdoors.dm:230-242 |

- The timer has no `attackby` and no tool handler in this file. Only the UI can change it.

### Interactions (items)

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| any item | none | none | none | no `attackby` or tool proc in `brigdoors.dm`; only the atom tool defaults apply (`code/game/atoms.dm:1156`, `:1117-1124`) |
| UI, any action | `allowed(usr)` false | 0 | "Access denied." (`code/game/machinery/doors/brigdoors.dm:215`) | refused |

### Construction chain

- None. No `circuit` is set on the type (`code/game/machinery/doors/brigdoors.dm:21-41`; inherits null from `code/game/machinery/_machinery.dm:122`). There is no board in the DM: `/obj/item/circuitboard/machine/door_timer` has no own definition (`tools/tgwhere.py`). No frame is made and no tool can start one.

### Deconstruction chain

- None: no tool handler (see Interactions), and `component_parts` is null, so `deconstruct` makes no frame (`code/game/machinery/_machinery.dm:402-410`).

### Drops

| case | what drops | what stays |
|---|---|---|
| (a) destroyed (integrity 0, `code/game/objects/obj_defense.dm:252-258`) | nothing from the board list (none exists) | nothing |
| (b) "deconstructed" (no path exists) | none | none |
| (c) `Radio` contents (only if Definition A runs) | the `/obj/item/radio` is created inside the machine (`code/game/machinery/doors/brigdoors.dm:46`); `dropContents()` on Destroy moves it to the turf (`code/game/machinery/_machinery.dm:171`, `:201-210`) | (inferred) |

### Health and armor

- `max_integrity` 200 (inherited, `code/game/machinery/_machinery.dm:93`). Armor is the `/obj/machinery` default list (`code/game/machinery/_machinery.dm:137`).
- `integrity_failure` is not set (0, `code/game/objects/objs.dm:19`): damage never breaks it; only the Initialize path (`obj_break()` at `code/game/machinery/doors/brigdoors.dm:64-65`) sets BROKEN.

### Power

- `idle_power_usage` and `active_power_usage` 0 (inherited, `code/game/machinery/_machinery.dm:106-107`): draws nothing itself. It still needs area power: `NOPOWER` stops `process` (`code/game/machinery/doors/brigdoors.dm:73-74`), `timer_start` (`:84-85`) and `timer_end` (`:107-108`).

### Gotchas

- The timer is inert until linked: `id` null leaves `targets` empty, and the Initialize path breaks it at once (`code/game/machinery/doors/brigdoors.dm:51`, `:64-65`).
- Radio warnings only come from natural expiry, not from the stop action (`code/game/machinery/doors/brigdoors.dm:110-112`).
- Presets are raw deciseconds: 1200, 1800, 3000; the cap is 9000 (`code/game/machinery/doors/brigdoors.dm:5`, `:7-9`).
- Flashers have their own 150 ds recharge that the panel reports (`code/game/machinery/doors/brigdoors.dm:203`).
- Access is `ACCESS_SECURITY` (`code/game/machinery/doors/brigdoors.dm:26`) for every action; a timer on a non-security door still needs that card.

---

## Minimum viable port

- Board-driven building: machine frame (cable coil x5 at 20 ds, board, parts instant, screwdriver instant) and computer frame (wrench 20 ds, board, screwdriver, cable coil x5 at 20 ds, glass x2 at 20 ds, screwdriver) with their states, so that a player can rebuild a console.
- Computer deconstruction: screwdriver at 20 ds gives a frame holding the board, then glass, cable and metal back in order; a broken console gives 2 shards and a frame with no glass.
- Destruction equals deconstruction (`deconstruct(FALSE)`); a destroyed computer is always broken first (2 shards), a destroyed machine's frame has half health.
- Power: computers 300 idle and 300 active (the pod console too, though it has no board); ChemMaster 20 idle; chute and door timer 0; unpowered = no process and no use.
- ChemMaster: 100-unit buffer (two beakers give 100), beaker in and out, transfer both ways, create pills (max 50 units, max 10 items), patches (40), bottles (30), condiment packs (10) and bottles (50), analyze; a beaker left in it is deleted on deconstruct or destroy.
- Seven tank consoles: name, input/output tags and sensor per type (table in part 2); power toggles, rate 0 to 200, pressure 0 to 4500, reconnect with the no-machinery message.
- Remote camera consoles: eye with the action set; base console build actions through an internal RCD (600 matter, half delay) and fan and turret stock 4; xenobio console: monkey cubes, slime potion slot, extract research, slime pick-up up to 5, monkey recycle.
- Medical laptop: ID log-in with medical or forensics access, EMP record corruption, the laptop board building the desktop console.
- Pod console: admin-controlled, launch only at Code Red or when emagged, "Unable to comply." on refusal, no circuit (destroyed without a drop).
- Delivery chute: place-and-flush (10 ds then 5 ds), trunk requirement, pipe kit dropped on destruction and deconstruction alike.
- Door timer: 9000 ds cap, presets 1200, 1800, 3000 ds, linked doors, closets and flashers within 20 tiles, radio "Timer has expired. Releasing prisoner." on FREQ_SECURITY 1359.

## NOT FOUND / open questions

- NOT FOUND: none. All 14 list paths were located by `tools/tgwhere.py` and documented.
- Duplicate `Initialize` definitions: `code/game/machinery/doors/brigdoors.dm:43` and `:49` (door timer), `code/modules/mining/aux_base_camera.dm:52` and `:56` (base construction console). The newer snapshot still has both pairs (`brigdoors.dm:41`, `:47`; `aux_base_camera.dm:52`, `:56`). Which one the DM compiler runs was not verified; the door timer's Radio and the console's RCD depend on it.
- Pod console: a second `request` after launch under Code Red or EMAGGED falls through with no return (`code/modules/shuttle/emergency.dm:441-444`); confirm in game what the caller does (inferred: treated as success).
- Pod console: whether a port should have a computer board at all, since TG has none (`code/modules/shuttle/computer.dm:1-11`).
- RCD build costs and delays for the base console's Build action are in `rcd_vals` on each target (`code/game/objects/items/RCD.dm:409-423`) and are not documented in this shard.
- Monkey recycler (`code/modules/food_and_drinks/kitchen_machinery/monkeyrecycler.dm:15`), air sensors (`code/game/machinery/computer/atmos_control.dm:5-82`) and the tank pumps are other machines, not documented here.
- The power unit in the brief is watts; the DM literals are kept as written (ChemMaster 20, computers 300).
- DIFF vs newer: none in the lines checked (ChemMaster `idle_power_usage = 20` and `create_reagents(100)`; computer `idle_power_usage = 300`, `time_to_screwdrive = 20`; flush `sleep(10)` and `sleep(5)`; timer message at `brigdoors.dm:110`). The newer door timer UI call differs in form (`ui = new(user, src, "BrigTimer", name)`, `brigdoors.dm:146`), which is not a behaviour change here.

## Coverage

- Entries on the list: 14
- Documented with real data: 14 (every path appears with its own entry, with file:line for each fact)
- NOT FOUND: 0
- Paths not located by tgwhere: none

Exact tgwhere output for each list path:
- `/obj/machinery/chem_master` - code/modules/reagents/chemistry/machinery/chem_master.dm:1
- `/obj/machinery/computer/atmos_control/tank/air_tank` - code/game/machinery/computer/atmos_control.dm:213
- `/obj/machinery/computer/atmos_control/tank/carbon_tank` - code/game/machinery/computer/atmos_control.dm:241
- `/obj/machinery/computer/atmos_control/tank/mix_tank` - code/game/machinery/computer/atmos_control.dm:220
- `/obj/machinery/computer/atmos_control/tank/nitrogen_tank` - code/game/machinery/computer/atmos_control.dm:234
- `/obj/machinery/computer/atmos_control/tank/nitrous_tank` - code/game/machinery/computer/atmos_control.dm:227
- `/obj/machinery/computer/atmos_control/tank/oxygen_tank` - code/game/machinery/computer/atmos_control.dm:199
- `/obj/machinery/computer/atmos_control/tank/toxin_tank` - code/game/machinery/computer/atmos_control.dm:206
- `/obj/machinery/computer/camera_advanced/base_construction` - code/modules/mining/aux_base_camera.dm:29
- `/obj/machinery/computer/camera_advanced/xenobio` - code/modules/research/xenobiology/xenobio_camera.dm:20
- `/obj/machinery/computer/med_data/laptop` - code/game/machinery/computer/medical.dm:572
- `/obj/machinery/computer/shuttle/pod` - code/modules/shuttle/emergency.dm:452
- `/obj/machinery/disposal/delivery_chute` - code/modules/recycling/disposal/bin.dm:439
- `/obj/machinery/door_timer` - code/game/machinery/doors/brigdoors.dm:21

