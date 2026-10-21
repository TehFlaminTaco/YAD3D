# Machinery Construction, Deconstruction, and Components

Generic machinery is the foundation of station systems. All machines inherit from `/obj/machinery`, which manages power draw, component parts, anchoring, maintenance panels, and damage states. Machines are built from frames by installing a circuit board, adding components, and finalizing assembly with a screwdriver. When deconstructed, machines disassemble back to frames and components.

---

## Machine Base Class and Power  `/obj/machinery`  (code/game/machinery/_machinery.dm:86)

- Core gameplay object for all interactive station systems (doors, lights, vendors, labs, etc.).
- Key vars:
  - `machine_stat` (bitflag): BROKEN (0x1) when damaged beyond `max_integrity`, NOPOWER (0x2) when area has no power, MAINT (0x4) during maintenance, EMPED (0x8) temporarily broken by EMP (code/game/machinery/_machinery.dm:101)
  - `use_power` (int): NO_POWER_USE (0), IDLE_POWER_USE (1), or ACTIVE_POWER_USE (2) (code/game/machinery/_machinery.dm:102)
  - `idle_power_usage` (watts): power draw when operating in standby, default 0 (code/game/machinery/_machinery.dm:106)
  - `active_power_usage` (watts): power draw when actively in use, default 0 (code/game/machinery/_machinery.dm:107)
  - `power_channel` (int): AREA_USAGE_EQUIP (1), AREA_USAGE_LIGHT (2), or AREA_USAGE_ENVIRON (3) (code/game/machinery/_machinery.dm:108)
  - `max_integrity` = 200 (code/game/machinery/_machinery.dm:93)
  - `anchored` = TRUE (code/game/machinery/_machinery.dm:98)
  - `component_parts` (list): null by default; populated when built from a frame (code/game/machinery/_machinery.dm:112)
  - `panel_open` = FALSE: whether maintenance panel is open (code/game/machinery/_machinery.dm:113)
  - `state_open` = FALSE: whether the machine itself is open (code/game/machinery/_machinery.dm:114)

- Power and damage flow:
  - `auto_use_power()` (code/game/machinery/_machinery.dm:238): checks `powered(power_channel)`, then calls `use_power(idle_power_usage)` if use_power=1 or `use_power(active_power_usage)` if use_power≥2; returns 1 if powered, 0 if not.
  - `power_change()` (code/game/machinery/_machinery.dm:63): called by area when power state changes; updates machine_stat NOPOWER flag.
  - `obj_break(damage_flag)` (code/game/machinery/_machinery.dm:422): when obj_integrity ≤ 0 and machine not already broken, sets machine_stat |= BROKEN, sends signal COMSIG_MACHINERY_BROKEN, calls update_icon().
  - `emp_act(severity)` (code/game/machinery/_machinery.dm:187): if use_power is on and not broken, calls `use_power(7500/severity)` and spawns temp EMP visual.

- Interactions:
  | action | condition | delay (ds) | message | result |
  | --- | --- | --- | --- | --- |
  | screwdriver on panel | any state | 50 | "You open/close the maintenance hatch of [src]." | toggles panel_open, updates icon |
  | crowbar on maintenance panel | panel_open or damage present | 50 | (automatic) | calls deconstruct(TRUE) |
  | wrench to anchor/unanchor | on floor/indestructible turf | 20 ds (20) | "You begin un/securing [src]..." | toggles anchored, then "You un/secure [src]." |

- `RefreshParts()` (code/game/machinery/_machinery.dm:386): placeholder proc; frame-based machines override to recalculate stats from component_parts list.
- `is_operational()` (code/game/machinery/_machinery.dm:247): returns !(machine_stat & (NOPOWER|BROKEN|MAINT)).
- `deconstruct(disassembled = TRUE)` (code/game/machinery/_machinery.dm:402): if NODECONSTRUCT_1 flag not set, calls on_deconstruction(), spawns machine frame at state 2 (half broken), moves component_parts to ground, then deletes self.
- `spawn_frame(disassembled)` (code/game/machinery/_machinery.dm:412): creates new /obj/structure/frame/machine at loc, copies anchored state; if not fully disassembled (FALSE), sets frame obj_integrity to 50% of max; transfers fingerprints; sets state=2 and icon_state="box_1".

---

## Machine Frame and Assembly  `/obj/structure/frame/machine`  (code/game/machinery/constructable_frame.dm:25)

- Intermediate structure representing a machine under construction.
- States and build sequence:
  1. **State 1** ("box_0"): bare metal frame, anchored optional.
     - Tool: cable_coil (5 units) → delay 20 (ds) → state 2 ("box_1"), message: "You add cables to the frame."
     - Tool: screwdriver, not anchored → delay 40 (ds) → disassemble to 5× metal sheet
     - Tool: wrench → toggle anchored; delay 40 (ds)
  
  2. **State 2** ("box_1"): wiring installed, circuit board not yet inserted.
     - Tool: circuit board (machine type) → on placement, delay 0, message: "You add the circuit board to the frame." → state 3, circuit stored, icon_state="box_2", components list created, req_components copied from board, state=3
     - Tool: wire cutters → delay 0, message: "You remove the cables." → state 1 ("box_0"), drops 5× cable_coil
     - Tool: wrench → toggle anchored; delay 40 (ds)

  3. **State 3** ("box_2"): circuit installed, components required.
     - `req_components` (list): keyed by component path (/obj/item/stock_parts/capacitor, etc.), value = number needed; examined shows "It requires X Y, and Z..."; when all ≥0, fully assembled.
     - Tool: crowbar on circuit board → ejects circuit, all components drop, state→2 ("box_1"), message: "You remove the circuit board." or "You remove the circuit board and other components."
     - Tool: screwdriver, when all req_components ≤ 0 → creates new machine at circuit.build_path, transfers all components from frame.contents to new_machine.component_parts, calls new_machine.on_construction() and new_machine.RefreshParts(), deletes frame.
     - Manual component insertion (any tool item matching a req_component type):
       - Non-stack item: transferred to frame; req_components[type]--; message: "You add [P] to [src]."
       - Stack item: consumed amount = min(stack amount, req_components[type]); creates new stack in frame; message: "You add [P] to [src]."
     - RPED (rapid part exchange device) auto-upgrade: when adjacent and RPED.works_from_distance or adjacent, frame.exchange_parts() called; swaps old parts for higher-rating ones in RPED inventory; message: "[part.name] applied." (code/game/machinery/constructable_frame.dm:203–242)
     - Tool: wrench, if circuit.needs_anchored = FALSE → toggle anchored; delay 40 (ds)

- Deconstruction: `deconstruct(disassembled)` (code/game/machinery/constructable_frame.dm:274): drops 5× cable_coil if state≥2, forces all components to ground, then calls parent to drop 5× metal sheet.

---

## Circuit Boards — Base Class  `/obj/item/circuitboard`  (code/game/objects/items/circuitboards/circuitboard.dm:6)

- Small, portable blueprint item defining machine build requirements.
- Key vars:
  - `build_path` (path): path to the machine to create (/obj/machinery/..., etc.); null if unset (code/game/objects/items/circuitboards/circuitboard.dm:16)

### Machine Circuit Board — Subclass  `/obj/item/circuitboard/machine`  (code/game/objects/items/circuitboards/circuitboard.dm:26)

- Subtype for machine boards specifically.
- Key vars:
  - `needs_anchored` = TRUE (bool): if TRUE, frame must be anchored before board insertion (code/game/objects/items/circuitboards/circuitboard.dm:27)
  - `req_components` (list): keyed by component type path (e.g., /obj/item/stock_parts/capacitor), value = count required; example: `list(/obj/item/stock_parts/matter_bin = 5)` (code/game/objects/items/circuitboards/circuitboard.dm:28)
  - `def_components` (list, optional): alternate component paths for when machine is first created; e.g., `list(/obj/item/stock_parts/matter_bin = /obj/item/stock_parts/matter_bin/super)` (code/game/objects/items/circuitboards/circuitboard.dm:31)

- When machine spawned with board in circuit var:
  - `apply_default_parts(machine)` (code/game/objects/items/circuitboards/circuitboard.dm:35): adds board itself to machine.component_parts, then for each req_component, if def_components override exists use that type else use req_component type; spawn count copies (or amount for stacks) and add to component_parts, then call machine.RefreshParts() (code/game/objects/items/circuitboards/circuitboard.dm:35–56).

---

## Stock Parts — Tiers and Ratings  (code/modules/research/stock_parts.dm)

All stock parts inherit from `/obj/item/stock_parts` (code/modules/research/stock_parts.dm:123); w_class=WEIGHT_CLASS_SMALL.

### Capacitor
- **Tier 1**: `/obj/item/stock_parts/capacitor`, rating=1 (code/modules/research/stock_parts.dm:140)
- **Tier 2**: `/obj/item/stock_parts/capacitor/adv`, rating=2 (code/modules/research/stock_parts.dm:178)
- **Tier 3**: `/obj/item/stock_parts/capacitor/super`, rating=3 (code/modules/research/stock_parts.dm:222)
- **Tier 4**: `/obj/item/stock_parts/capacitor/quadratic`, rating=4 (code/modules/research/stock_parts.dm:266)

### Scanning Module
- **Tier 1**: `/obj/item/stock_parts/scanning_module`, rating=1 (code/modules/research/stock_parts.dm:146)
- **Tier 2**: `/obj/item/stock_parts/scanning_module/adv`, rating=2 (code/modules/research/stock_parts.dm:185)
- **Tier 3**: `/obj/item/stock_parts/scanning_module/phasic`, rating=3 (code/modules/research/stock_parts.dm:229)
- **Tier 4**: `/obj/item/stock_parts/scanning_module/triphasic`, rating=4 (code/modules/research/stock_parts.dm:273)

### Manipulator
- **Tier 1**: `/obj/item/stock_parts/manipulator`, rating=1 (code/modules/research/stock_parts.dm:152)
- **Tier 2**: `/obj/item/stock_parts/manipulator/nano`, rating=2 (code/modules/research/stock_parts.dm:192)
- **Tier 3**: `/obj/item/stock_parts/manipulator/pico`, rating=3 (code/modules/research/stock_parts.dm:236)
- **Tier 4**: `/obj/item/stock_parts/manipulator/femto`, rating=4 (code/modules/research/stock_parts.dm:280)

### Micro-Laser
- **Tier 1**: `/obj/item/stock_parts/micro_laser`, rating=1 (code/modules/research/stock_parts.dm:158)
- **Tier 2**: `/obj/item/stock_parts/micro_laser/high`, rating=2 (code/modules/research/stock_parts.dm:199)
- **Tier 3**: `/obj/item/stock_parts/micro_laser/ultra`, rating=3 (code/modules/research/stock_parts.dm:243)
- **Tier 4**: `/obj/item/stock_parts/micro_laser/quadultra`, rating=4 (code/modules/research/stock_parts.dm:287)

### Matter Bin
- **Tier 1**: `/obj/item/stock_parts/matter_bin`, rating=1 (code/modules/research/stock_parts.dm:164)
- **Tier 2**: `/obj/item/stock_parts/matter_bin/adv`, rating=2 (code/modules/research/stock_parts.dm:206)
- **Tier 3**: `/obj/item/stock_parts/matter_bin/super`, rating=3 (code/modules/research/stock_parts.dm:250)
- **Tier 4**: `/obj/item/stock_parts/matter_bin/bluespace`, rating=4 (code/modules/research/stock_parts.dm:294)

### Electrolite
- **Tier 1**: `/obj/item/stock_parts/electrolite`, rating=1 (code/modules/research/stock_parts.dm:170)
- **Tier 2**: `/obj/item/stock_parts/electrolite/adv`, rating=2 (code/modules/research/stock_parts.dm:213)
- **Tier 3**: `/obj/item/stock_parts/electrolite/super`, rating=3 (code/modules/research/stock_parts.dm:257)
- **Tier 4**: `/obj/item/stock_parts/electrolite/bluespace`, rating=4 (code/modules/research/stock_parts.dm:301)

Part upgrades via RPED: `exchange_parts(user, RPED)` (code/game/machinery/_machinery.dm:501) replaces a component if the new part has higher `get_part_rating()` than the old; sends message "[old] replaced with [new]."; plays sound; returns TRUE.

---

## Electronics Items — Used in Machines and Devices

### Airlock Electronics  `/obj/item/electronics/airlock`  (code/game/machinery/doors/airlock_electronics.dm:1)

- Installed in airlocks to configure access levels.
- Key vars:
  - `accesses` (list): list of access IDs the door allows (code/game/machinery/doors/airlock_electronics.dm:6)
  - `one_access` = 0 (bool): if TRUE, only one access is required; if FALSE (default), all accesses required (code/game/machinery/doors/airlock_electronics.dm:8)
  - `unres_sides` = 0 (bitflag): sides of door that open without access check (code/game/machinery/doors/airlock_electronics.dm:10)

- Interactions: UI (TGUI) allows selecting regions, granting/denying accesses per direction, and toggling one_access mode.

### APC Electronics  `/obj/item/electronics/apc`  (docs/tg/_ours-items.txt: 264 instances)

- (NOT FOUND: full definition not located; mentioned as placed item in BoxStation; appears to be installed in APC power units)

---

## Rapid Part Exchange Device  `/obj/item/storage/part_replacer`  (code/modules/research/stock_parts.dm:4)

- Automated tool for upgrading components in frame-based machines.
- Key vars:
  - `works_from_distance` = FALSE (bool): if TRUE, can upgrade parts without being adjacent; bluespace RPED variant sets this TRUE (code/modules/research/stock_parts.dm:13)

- Interactions: held or adjacent to frame in state 3 → insert/swap parts; held and adjacent to assembled machine with component_parts → calls `exchange_parts()` to auto-upgrade (code/modules/research/stock_parts.dm:17–34); plays upgrade sound on success.

---

## Sample Map-Placed Machines (from _ours-structures.txt)

| In-Game Name | Path | Frame Machine? | Circuit Board | Required Parts |
| --- | --- | --- | --- | --- |
| APC | /obj/machinery/power/apc (110 placed) | (inferred) | NOT FOUND | NOT FOUND |
| Air Alarm | /obj/machinery/airalarm (126 placed) | (inferred) | NOT FOUND | NOT FOUND |
| Fire Alarm | /obj/machinery/firealarm (87 placed) | (inferred) | NOT FOUND | NOT FOUND |
| Camera | /obj/machinery/camera (207 placed) | NOT FOUND | NOT FOUND | NOT FOUND |
| Door Timer | machinery/door_timer (3 placed) | (inferred) | NOT FOUND | NOT FOUND |
| Cell Charger | machinery/cell_charger (13 placed) | (inferred) | NOT FOUND | NOT FOUND |
| Chem Master | machinery/chem_master (3 placed) | (inferred) | NOT FOUND | NOT FOUND |
| SMES | machinery/power/smes (1 placed) | NOT FOUND | NOT FOUND | NOT FOUND |
| Autolathe | machinery/autolathe (1 placed) | (inferred) | NOT FOUND | NOT FOUND |
| Disposal Bin | machinery/disposal/bin (57 placed) | NOT FOUND | NOT FOUND | NOT FOUND |
| Hydroponics | machinery/hydroponics/* (16 placed total) | NOT FOUND | NOT FOUND | NOT FOUND |
| Vending Machines | machinery/vending/* (many types) | (inferred) | NOT FOUND | NOT FOUND |

---

## Minimum Viable Port

1. **Stat flags**: BROKEN, NOPOWER, MAINT, EMPED; check in can_interact() and is_operational().
2. **Power channels**: EQUIP, LIGHT, ENVIRON; select channel per machine; deduct idle/active power per tick.
3. **Frame assembly**: state 1 (cables) → state 2 (circuit board) → state 3 (components) → state 4 (finalized).
4. **Component parts list**: store in machine.component_parts; match insertion by path and count.
5. **Deconstruction**: crowbar on panel → frame at state 2; components and board drop separately.
6. **Part ratings**: higher rating = better performance; RPED replaces old with newer if available.
7. **Basic circuits and stock parts**: create circuit boards with req_components; populate machine on first spawn via apply_default_parts().
8. **Panel open / anchor state**: panel toggles maintenance; wrench toggles anchor (prerequisites: on floor/indestructible, not already in opposite state).
9. **Damage and breaking**: obj_integrity tracking, set BROKEN flag when ≤0.
10. **Repair flow**: crowbar with open panel → deconstruct; rebuild by frame assembly.

---

## NOT FOUND / Open Questions

- Full definitions for APC, Air Alarm, Fire Alarm, and other pre-placed machinery: many machines appear on the map but no circuit board or frame build recipe was found in the primary source tree (2020-07-06 snapshot). These may have been built inline in the map or added via a different init path.
- Electronics item definitions (firelock, firealarm, airalarm electronics): only airlock electronics was documented; full specs for others NOT FOUND.
- Detailed machine behavior for specific machinery (Autolathe, SMES, Chem Master, etc.): beyond scope; documented only base class and generic frame build.
