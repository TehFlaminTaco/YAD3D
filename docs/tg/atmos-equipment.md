# Atmospherics Equipment

A player can interact with a fully simulated atmospheric system. This document covers pipes, vents, pumps, scrubbers, valves, filters, canisters, tanks, and internals. The gas simulation is separate; this describes only the machinery that the player can touch.

**Map inventory (BoxStation.dmm):** 2516 simple pipes, 412 manifolds, 183 vent pumps, 177 vent scrubbers, 53 volume pumps, 10 pressure pumps, 18 trinary devices, 11 valves, 45 portable canisters, 8 portable pumps, 8 portable scrubbers, 17 item tanks.

---

## Pipe Layer System

All atmosphere pipes exist on one of three layers (1, 2, 3) determined by `piping_layer`. Higher layers sit visually higher on the screen. Each layer can have its own independent pipe network in the same turf. Layers 1 and 3 are offset visually by ±5 pixels from the default layer 2.

- Layer 1, 2, 3 defined in code/__DEFINES/atmospherics.dm:351–353 (PIPING_LAYER_MIN, MAX, DEFAULT)
- Visual offset: 5 pixels per layer per code/__DEFINES/atmospherics.dm:354–356
- Pipes and machinery auto-connect only within their layer (connection_check, atmosmachinery.dm:139–142)

---

## Pipe: Simple  `/obj/machinery/atmospherics/pipe/simple`  (pipes/simple.dm:4)

- A 1-meter straight section of regular pipe that bends, connecting two cardinal directions.
- Key vars: `device_type = BINARY` (2 connections); `initialize_directions = SOUTH|NORTH` (auto-normalized to cardinal pairs); `pipe_flags = PIPING_CARDINAL_AUTONORMALIZE`; `piping_layer` = 2 (default, can be 1 or 3); `pipe_color` = null (grey unless mapped with color subtypes)
- Volume: 200 L per connected node (components_base.dm:22)
- Icon state changes based on connections via `update_icon()` (pipes/simple.dm:30–32): "pipe11-[layer]" when both directions connected, "pipe01-[layer]" when one, "pipe00-[layer]" when none.
- Colors available (mapping.dm:48–57): general (null), yellow, cyan, green, orange, purple, dark, brown, violet; supply (blue), scrubbers (red), supplymain (purple/amethyst).
- Construction: Dispenser drops `/obj/item/pipe/binary/bendable`, wrench with [10 ds delay](pipe_dispenser.dm:84) to anchor; pressure check occurs before placement ("too much pressure" message not found, needs wrench_act).
- Deconstruction: Wrench unwrenches with pressure check (atmosmachinery.dm not shown fully; see machine.dm wrench_act). Drops `/obj/item/pipe/binary/bendable` on removal.
- Power: none

### Pipe: Manifold  `/obj/machinery/atmospherics/pipe/manifold`  (pipes/manifold.dm:3)

- 3-way branching pipe (TRINARY, 3 connections in NORTH/EAST/WEST directions; SOUTH always excluded by SetInitDirections).
- Key vars: `device_type = TRINARY`; `initialize_directions = NORTH|EAST|WEST` (set by SetInitDirections, pipes/manifold.dm:29–30); `pipe_color` = null
- Icon: manifold center + three pipe overlays for connected directions (update_icon, manifold.dm:33–45)
- Construction: Dispenser drops `/obj/item/pipe/trinary`
- Deconstruction: Wrench drops `/obj/item/pipe/trinary`
- Power: none

### Pipe: 4-Way Manifold  `/obj/machinery/atmospherics/pipe/manifold4w`  (pipes/manifold4w.dm, line unknown; same vars as manifold with all 4 cardinal directions)

- Construction type: `/obj/item/pipe/quaternary`
- Power: none

### Pipe: Heat Exchange Variants

- Simple: `/obj/machinery/atmospherics/pipe/heat_exchanging/simple` (pipes/heat_exchange/simple.dm)
- Manifold: `/obj/machinery/atmospherics/pipe/heat_exchanging/manifold` (heat_exchange/manifold.dm)
- 4-way: `/obj/machinery/atmospherics/pipe/heat_exchanging/manifold4w` (heat_exchange/manifold4w.dm)
- Junction: `/obj/machinery/atmospherics/pipe/heat_exchanging/junction` (heat_exchange/junction.dm)
- Heat Exchanger component: `/obj/machinery/atmospherics/components/unary/heat_exchanger` (components/unary_devices/heat_exchanger.dm)
- Mentioned but not detailed; transfers heat between two fluid loops.

---

## Vent Pump (Air Vent)  `/obj/machinery/atmospherics/components/unary/vent_pump`  (components/unary_devices/vent_pump.dm:8)

- Pumps gas between a room and a pipe network. Single connection to pipe, one to the room.
- Key vars:
  - `pump_direction = RELEASING` (1) or `SIPHONING` (0); RELEASING moves from pipe to room, SIPHONING from room to pipe (vent_pump.dm:21)
  - `pressure_checks = EXT_BOUND` (1, external pressure limit) | `INT_BOUND` (2, internal pressure limit) | `NO_BOUND` (3, no check)
  - `external_pressure_bound = ONE_ATMOSPHERE` (101.325 kPa; vent_pump.dm:24); when pump_direction=RELEASING, gas stops flowing when room pressure reaches this
  - `internal_pressure_bound = 0` (vent_pump.dm:25); when pump_direction=SIPHONING, gas stops flowing when room pressure drops below this
  - `device_type = UNARY` (1 connection)
  - `welded = FALSE` (welded shut)
  - `on = FALSE` (pump is on/off; turned on by radio signal or local UI; no local UI found)
  - `id_tag` = assigned via `assign_uid_vents()` (vent_pump.dm:40)
  - `frequency = FREQ_ATMOS_CONTROL` (radio control)
- Icon states: "vent_out" (releasing), "vent_in" (siphoning); "vent_out-off" / "vent_in-off" when off; "vent_welded" when welded (vent_pump.dm:62–85)
- Operation (process_atmos, vent_pump.dm:87–100):
  - If RELEASING: pressure relief — if `air_contents.return_pressure()` > `external_pressure_bound`, transfer gas to room until pressures balance or bound reached (code not shown fully)
  - If SIPHONING: intake — pull gas from room until room pressure drops to `internal_pressure_bound`
  - Stops if `welded = TRUE`
  - Power: `use_power = IDLE_POWER_USE`; draws power when on; idle_power_usage not specified (vent_pump.dm:14)
- Construction: click dispenser or use RPD (RPD.dm:32)
- Deconstruction: wrench unwrenches
- Interactions: Radio signal can turn on/off; broadcast_status not shown
- Access: frequency control tied to ID and area name assignment (vent_pump.dm:17, 40–46)

---

## Vent Scrubber  `/obj/machinery/atmospherics/components/unary/vent_scrubber`  (components/unary_devices/vent_scrubber.dm:4)

- Removes selected gases from a room via pipe to a waste network, or siphons gas out.
- Key vars:
  - `scrubbing = SCRUBBING` (1, filter mode) or `SIPHONING` (0, purge mode) (vent_scrubber.dm:18)
  - `filter_types = list(/datum/gas/carbon_dioxide)` by default; list of gas datum types to remove in scrubbing mode (vent_scrubber.dm:20)
  - `volume_rate = 200` (L/cycle; how much room air is sampled per tick) (vent_scrubber.dm:21)
  - `widenet = 0` (if 1, acts on the 3×3 area centered on this turf, not just the turf itself) (vent_scrubber.dm:22)
  - `adjacent_turfs` = list of turfs when widenet=1 (vent_scrubber.dm:23)
  - `on = FALSE`
  - `welded = FALSE`
  - `device_type = UNARY`
  - `idle_power_usage = 10` W; `active_power_usage = 60` W (vent_scrubber.dm:10–11)
  - `use_power = IDLE_POWER_USE`
- Power draw (auto_use_power, vent_scrubber.dm:53–67):
  - If siphoning: 60 W
  - If scrubbing: 10 W + (10 W × count of filter_types) + (scaled bonus if widenet=1: `amount += amount * (adjacent_turfs.len * (adjacent_turfs.len / 2))`)
- Icon states: "scrub_on" (scrubbing, single turf); "scrub_wide" (scrubbing, widenet); "scrub_purge" (siphoning); "scrub_off" (off or no pipe); "scrub_welded" (welded) (vent_scrubber.dm:75–89)
- Construction: dispenser or RPD
- Deconstruction: wrench
- Interactions: Radio signal; set_frequency (vent_scrubber.dm:91–94)

---

## Passive Vent  `/obj/machinery/atmospherics/components/unary/passive_vent`  (components/unary_devices/passive_vent.dm:1)

- Equalizes room air pressure with a pipe network via direct diffusion; does not require power or active control.
- Key vars: `device_type = UNARY`; `can_unwrench = TRUE`
- Operation (process_atmos, passive_vent.dm:20–28): calls `internal.equalize(external)` each tick, which transfers gas between the pipe and room until pressures and temperatures equalize.
- Power: none
- Construction: dispenser or RPD
- Deconstruction: wrench

---

## Pressure Pump (Gas Pump)  `/obj/machinery/atmospherics/components/binary/pump`  (components/binary_devices/pump.dm:13)

- Maintains a target output pressure in a network by pushing gas from input (node 1) to output (node 2).
- Key vars:
  - `target_pressure = ONE_ATMOSPHERE` (101.325 kPa; pump.dm:21); set via UI or AltClick to MAX_OUTPUT_PRESSURE (4500 kPa)
  - `device_type = BINARY` (2 connections: input, output)
  - `on = FALSE`
  - `can_unwrench = TRUE`
  - `id`, `frequency` for radio control
- Operation (process_atmos, pump.dm:56–65): calls `air1.pump_gas_to(air2, target_pressure)` to transfer gas from input until output reaches target_pressure.
- Power: No idle/active power vars shown; `use_power` not set explicitly; unclear if powered (pump.dm:1–100 truncated).
- UI: TG UI at "AtmosPump", shows on/off toggle (CtrlClick) and pressure (AltClick to max) (pump.dm:87–99).
- Interactions:
  - CtrlClick: toggle on/off (pump.dm:33–38)
  - AltClick: set target_pressure to MAX_OUTPUT_PRESSURE (pump.dm:40–45)
  - Radio signal via frequency (broadcast_status, pump.dm:74–85)
- Construction: dispenser or RPD
- Deconstruction: wrench
- Max pressure: 4500 kPa (code/__DEFINES/atmospherics.dm:207, MAX_OUTPUT_PRESSURE)

---

## Volume Pump (Volumetric Gas Pump)  `/obj/machinery/atmospherics/components/binary/volume_pump`  (components/binary_devices/volume_pump.dm:13)

- Transfers a fixed volume of gas per tick from input to output, independent of pressure difference.
- Key vars:
  - `transfer_rate = MAX_TRANSFER_RATE` (200 L/s; volume_pump.dm:21); set via AltClick to MAX_TRANSFER_RATE
  - `overclocked = FALSE`; when overclocked, can push into higher pressure (up to ~1000 kPa difference) but leaks VOLUME_PUMP_LEAK_AMOUNT (10%) to the room (volume_pump.dm:22, 79–84)
  - `device_type = BINARY`
  - `on = FALSE`
  - `can_unwrench = TRUE`
- Operation (process_atmos, volume_pump.dm:55–88):
  - Checks input pressure ≥ 0.01 kPa and output pressure ≤ 9000 kPa (unless overclocked)
  - If overclocked, output can be up to 1000 kPa higher than input
  - Transfers `transfer_rate` L per tick via `remove_ratio()` and merge
  - If overclocked, 10% of transferred gas leaks to the room
- Power: no explicit idle/active vars; `use_power` not shown
- Interactions:
  - CtrlClick: toggle on/off (volume_pump.dm:34–39)
  - AltClick: set transfer_rate to MAX_TRANSFER_RATE (volume_pump.dm:41–46)
  - Examine shows warning if overclocked (volume_pump.dm:90–93)
- Construction: dispenser or RPD
- Deconstruction: wrench
- Max transfer: 200 L/s; defined as MAX_TRANSFER_RATE (code/__DEFINES/atmospherics.dm:209)

---

## Valve  `/obj/machinery/atmospherics/components/binary/valve`  (components/binary_devices/valve.dm:5)

### Manual Valve (default)
- Stops or allows gas flow through a pipe via on/off toggle; no power required.
- Key vars: `device_type = BINARY`; `on = FALSE`; `valve_type = "m"` (manual); `can_unwrench = TRUE`
- Icon state: "mvalve_on" or "mvalve_off" (valve.dm:31); flick animation on toggle (valve.dm:30)
- Interactions:
  - Click (interact, valve.dm:46–52): calls toggle(), which sets `on = TRUE/FALSE`, updates icon with 10 ds animation delay (valve.dm:33–56), then calls `update_parents()` to propagate air changes
  - Updates log: "was opened/closed by [user] / remote signal" (valve.dm:37, 44)
- Power: none

### Digital Valve  `/obj/machinery/atmospherics/components/binary/valve/digital`  (valve.dm:59)
- AI-controllable valve; requires power to operate.
- Key vars: `valve_type = "d"` (digital); `interaction_flags_machine = INTERACT_MACHINE_ALLOW_SILICON` (AI can use) (valve.dm:67)
- Icon state: "dvalve_nopower" if unpowered; "dvalve_on/off" otherwise (valve.dm:69–74)
- Power requirement implied by no-power check (valve.dm:72)
- Constructed as subtype of manual valve; same toggle logic

### Valve Layers
- `/obj/machinery/atmospherics/components/binary/valve/layer1` and `/layer3` variants exist with `piping_layer = 1` and `piping_layer = 3` respectively (valve.dm:77–101)
- Prewired "on" variant: `/obj/machinery/atmospherics/components/binary/valve/on` (valve.dm:85)

---

## Filter  `/obj/machinery/atmospherics/components/trinary/filter`  (components/trinary_devices/filter.dm, not shown)

- A 3-input device: input, output, waste outlet.
- Removes gases matching a filter list from the input, sending filtered gas to output and waste to the waste outlet.
- Trinary (3 connections).
- Not detailed in provided source; referenced in RPD.dm:27.

---

## Mixer  `/obj/machinery/atmospherics/components/trinary/mixer`  (components/trinary_devices/mixer.dm, not shown)

- A 3-input device: inlet 1, inlet 2, output.
- Combines two input streams in a set ratio to the output.
- Trinary (3 connections).
- Not detailed in provided source; referenced in RPD.dm:28.

---

## Portables Connector  `/obj/machinery/atmospherics/components/unary/portables_connector`  (components/unary_devices/portables_connector.dm, not shown)

- Allows portable canisters and pumps to dock and connect to the pipe network.
- Unary (1 connection).
- Referenced in RPD.dm:24 and portable_atmospherics.dm:10, 143–147.

---

## Portable Canister  `/obj/machinery/portable_atmospherics/canister`  (portable/canister.dm:8)

- A movable gas storage tank containing one type of gas. Connects to pipes via portables_connector or directly to tanks/equipment via valve.
- Subtypes: `/nitrogen`, `/oxygen`, `/carbon_dioxide`, `/toxins` (plasma), `/nitrous_oxide`, `/bz`, `/air`, `/water_vapor`, `/tritium`, `/nob` (hyper-noblium), `/stimulum`, `/pluoxium`, `/miasma`, `/freon`, `/hydrogen` (canister.dm:85–172)
- Key vars:
  - `volume = 1000` (L; storage capacity; canister.dm:21)
  - `filled = 0.5` (fraction of maximum moles; canister.dm:22); actual moles calculated as (25 × ONE_ATMOSPHERE) × volume / (R_IDEAL_GAS_EQUATION × T20C) × filled
  - `valve_open = FALSE` (canister.dm:18); if true, releases gas at `release_pressure`
  - `release_pressure = ONE_ATMOSPHERE` (101.325 kPa; canister.dm:25); gas flows into the room when valve_open and room pressure < release_pressure
  - `can_max_release_pressure = (ONE_ATMOSPHERE * 10)` (1013.25 kPa; canister.dm:26)
  - `can_min_release_pressure = (ONE_ATMOSPHERE / 10)` (10.1325 kPa; canister.dm:27)
  - `heat_limit = 5000` K (canister.dm:29); tier 1 only; tier 2/3 have higher limits (not shown)
  - `pressure_limit = 50000` kPa (canister.dm:31); tier 1; higher for better tiers
  - `maximum_pressure = 90 × ONE_ATMOSPHERE` (9119.25 kPa; base class portable_atmospherics.dm:15)
  - `gas_type = /datum/gas/nitrogen` etc. (canister.dm:90, 97, etc.)
  - `mode = CANISTER_TIER_1` (visual tier, canister.dm:49)
  - `max_integrity = 250` (canister.dm:34)
  - `density = TRUE` (blocks movement)
  - `connected_port` points to the portables_connector when docked (portable_atmospherics.dm:10)
  - `holding` = tank inside, if any (portable_atmospherics.dm:11)
- UI: Shows current gas type, pressure (moles and kPa), temperature, valve state (not shown in truncated source)
- Interactions:
  - Click with a tank (attackby, portable_atmospherics.dm:120–128): inserts/swaps the tank into the canister's holding slot; message: "[holding ? "In one smooth motion you pop [holding] out of [src]'s connector and replace it with [T]" : "You insert [T] into [src]"]."
  - AltClick (AltClick, portable_atmospherics.dm:95–101): removes the held tank; message: "You remove [holding] from [src]."
  - Wrench (tool_behaviour=TOOL_WRENCH, portable_atmospherics.dm:130–149): connects/disconnects from portables_connector; if connected, unwrenches with message "You unfasten [src] from the port."; if not, connects with message "(on failure) [name] failed to connect to the port."
- Power: `use_power = NO_POWER_USE`
- Damage: Pressure rupture at `pressure_limit` (canister.dm:31); leaks at `TANK_LEAK_PRESSURE` (30 × ONE_ATMOSPHERE = 3039.75 kPa; code/__DEFINES/atmospherics.dm:222); ruptures at `TANK_RUPTURE_PRESSURE` (35 × ONE_ATMOSPHERE = 3546.375 kPa); fragments (explosion) at `TANK_FRAGMENT_PRESSURE` (40 × ONE_ATMOSPHERE = 4053 kPa, 3×3 base; code/__DEFINES/atmospherics.dm:224–226)
- Access control: `restricted = FALSE`; if TRUE, requires access (canister.dm:47, 74–77); interact() checks allowed(user) and shows "Error - Unauthorized User" if denied (canister.dm:73–77)
- Filling: Tank inserted via attackby automatically swaps. To fill: place filled tank in canister, open valve if tanks have pressure difference. No explicit "fill tank" interaction; tank contents are shared when connected (NOT_SHOWN).

---

## Portable Pump  `/obj/machinery/portable_atmospherics/pump`  (portable/pump.dm, not shown)

- Mobile gas pump for portable use. 8 found on BoxStation.
- Base class: `/obj/machinery/portable_atmospherics` (portable_atmospherics.dm:1)
- Subtypes likely: `/high_power`, `/powered` (mentioned in map counts)
- NOT detailed in provided source.

---

## Portable Scrubber  `/obj/machinery/portable_atmospherics/scrubber`  (portable/scrubber.dm, not shown)

- Mobile air scrubber for portable use. 8 found on BoxStation.
- Base class: `/obj/machinery/portable_atmospherics`
- NOT detailed in provided source.

---

## Tank (Item)  `/obj/item/tank`  (game/objects/items/tanks/tanks.dm:1)

- A portable gas storage container that can be worn on the back or held, and used as internals (breathing apparatus).
- Key vars:
  - `volume = 70` (L; tanks.dm:21); tank_types subtypes override (e.g., `volume = 1` for emergency oxygen tanks.dm:146)
  - `distribute_pressure = ONE_ATMOSPHERE` (101.325 kPa; tanks.dm:19); release pressure when used as internals (tank_types.dm:18, 102, 145)
  - `air_contents` = gas mixture stored (tanks.dm:18); initialized in Initialize() with new(volume) and T20C (tanks.dm:59–60)
  - `integrity = 3` (tanks.dm:20, damage counter; 0 = destroyed)
  - `pressure_resistance = ONE_ATMOSPHERE * 5` (506.625 kPa; tanks.dm:10); absorbs damage up to this pressure
  - `slot_flags = ITEM_SLOT_BACK` (worn on back; tanks.dm:8); internals (emergency oxygen) set to ITEM_SLOT_BELT (tank_types.dm:142)
  - `armor` = list with fire 80, acid 30, bomb 10, others 0 (tanks.dm:17)
  - `max_integrity = 250` (base; not shown for tanks.dm, inferred from other machinery)
- Subtypes (tank_types.dm):
  - **Oxygen**: `/obj/item/tank/internals/oxygen` (tank_types.dm:14); `volume = 70` (default); initial pressure = 6 × ONE_ATMOSPHERE (607.95 kPa) (tank_types.dm:23–25); distribute_pressure = TANK_DEFAULT_RELEASE_PRESSURE (16 kPa from code/__DEFINES/atmospherics.dm:231)
    - Variants: "yellow" (tank_types.dm:28), "red" (tank_types.dm:33), "empty" (no gas; tank_types.dm:38)
  - **Anesthetic**: `/obj/item/tank/internals/anesthetic` (tank_types.dm:44); N2O/O2 mix; initial pressure = 3 × ONE_ATMOSPHERE (303.975 kPa); mix is 21% O2 / 79% N2O (tank_types.dm:51–54)
  - **Plasma**: `/obj/item/tank/internals/plasma` (tank_types.dm:59); `slot_flags = null` (no straps); initial pressure = 3 × ONE_ATMOSPHERE (303.975 kPa); "full" variant = 10 × ONE_ATMOSPHERE (1013.25 kPa) (tank_types.dm:59–87)
  - **Emergency Oxygen**: `/obj/item/tank/internals/emergency_oxygen` (tank_types.dm:135); `volume = 1` (tiny; ~21 breaths of air); `slot_flags = ITEM_SLOT_BELT`; distribute_pressure = TANK_DEFAULT_RELEASE_PRESSURE (16 kPa); initial pressure = 3 × ONE_ATMOSPHERE (tank_types.dm:149–150, truncated)
  - **Plasmaman**: `/obj/item/tank/internals/plasmaman` (tank_types.dm:96); plasma-only for plasmaman species; initial pressure = 3 × ONE_ATMOSPHERE; "full" = 10 × ONE_ATMOSPHERE; belt variant with `volume = 6` (tank_types.dm:113–128)
- Air contents: initialized via `populate_gas()` override (each subtype defines moles and gas type); temperature always T20C (tank_types.dm:25, 54, 70, 106)
- Pressure thresholds:
  - Leak: TANK_LEAK_PRESSURE = 30 × ONE_ATMOSPHERE = 3039.75 kPa (code/__DEFINES/atmospherics.dm:222)
  - Rupture: TANK_RUPTURE_PRESSURE = 35 × ONE_ATMOSPHERE = 3546.375 kPa (code/__DEFINES/atmospherics.dm:224)
  - Melt: TANK_MELT_TEMPERATURE = 1000000 K (code/__DEFINES/atmospherics.dm:220)
- Examine (tanks.dm:76–104): shows pressure gauge reading (kPa, rounded to 2 decimals) and descriptive temperature ("cold", "room temperature", "lukewarm", "warm", "hot", "furiously hot") based on Celsius.
- Actions: `/datum/action/item_action/set_internals` (tanks.dm:16); clicking this action or ui_action_click (tanks.dm:23–24) calls toggle_internals() (tanks.dm:26–53)
- Toggle Internals (tanks.dm:26–53):
  - If already wearing this tank as internals: "You close [src] valve." (tanks.dm:32); `H.internal = null`; hide HUD icon (tanks.dm:33–34)
  - If not:
    - Check for breathing mask: if none and no breathing tube organ, message "You need a mask!" (tanks.dm:36–39)
    - Check mask validity: if mask is adjusted, auto-adjust it; if mask doesn't have MASKINTERNALS flag, message "[H.wear_mask] can't use [src]!" (tanks.dm:40–45)
    - If switching from another tank: "You switch your internals to [src]." (tanks.dm:48)
    - Otherwise: "You open [src] valve." (tanks.dm:50)
    - Set `H.internal = src`; show HUD icon (tanks.dm:51–52)
- Deconstruction (tanks.dm:117–124): if not disassembled (`deconstruct(disassembled=TRUE)`), release air_contents to the room and play spray sound; always qdel (tanks.dm:117–124)
- Power: none

---

## Gas Analyzer (Handheld)  NOT FOUND

A device for reading gas composition, pressure, temperature of air in a turf or tank. Examine message format not found; inferred operation: click turf or tank, get readout of moles, pressure, temperature. Used for troubleshooting atmospheric systems.

---

## Constants and Pressure Thresholds

### Gas Laws and Constants (code/__DEFINES/atmospherics.dm:1–266)

| Constant | Value | Meaning |
|----------|-------|---------|
| `R_IDEAL_GAS_EQUATION` | 8.31 | kPa·L/(K·mol); ideal gas constant |
| `ONE_ATMOSPHERE` | 101.325 | kPa; standard atmospheric pressure |
| `T0C` | 273.15 | K; 0°C in Kelvin |
| `T20C` | 293.15 | K; 20°C in Kelvin (room temperature; standard starting temp) |
| `TCMB` | 2.7 | K; ~-270.3°C (cosmic microwave background, space temperature) |
| `TCRYO` | 225 | K; ~-48.15°C (cryogenic) |
| `MOLES_CELLSTANDARD` | ONE_ATMOSPHERE × 2500 / (T20C × R_IDEAL_GAS_EQUATION) | moles of gas in a 2500 L cell at 1 atm, 20°C; ~101.33 mol |
| `CELL_VOLUME` | 2500 | L; volume of one turf's atmosphere |
| `O2STANDARD` | 0.21 | 21% oxygen in air |
| `N2STANDARD` | 0.79 | 79% nitrogen in air |
| `MOLES_O2STANDARD` | MOLES_CELLSTANDARD × 0.21 | moles of O2 in standard air per cell |
| `MOLES_N2STANDARD` | MOLES_CELLSTANDARD × 0.79 | moles of N2 in standard air per cell |
| `BREATH_VOLUME` | 0.5 | L; volume of one human breath |
| `BREATH_PERCENTAGE` | BREATH_VOLUME / CELL_VOLUME | 0.0002; fraction of cell air per breath |
| `MAX_OUTPUT_PRESSURE` | 4500 | kPa; max pressure pumps can output |
| `MAX_TRANSFER_RATE` | 200 | L/s; max volumetric transfer rate |
| `VOLUME_PUMP_LEAK_AMOUNT` | 0.1 | 10% of overclocked pump output leaks to room |

### Pressure Thresholds for Crew Damage (code/__DEFINES/atmospherics.dm:119–127)

| Threshold | Value | Effect |
|-----------|-------|--------|
| `HAZARD_HIGH_PRESSURE` | 550 kPa | Ultra-high pressure icon displayed (red); damage multiplier |
| `WARNING_HIGH_PRESSURE` | 325 kPa | 0.7 × HAZARD_HIGH_PRESSURE; high pressure icon (orange); scaled damage |
| `WARNING_LOW_PRESSURE` | 50 kPa | 2.5 × HAZARD_LOW_PRESSURE; low pressure icon (gray) |
| `HAZARD_LOW_PRESSURE` | 20 kPa | Ultra-low pressure icon (black); crew takes LOW_PRESSURE_DAMAGE flat |

### Pressure Damage (code/__DEFINES/atmospherics.dm:195–199)

- High pressure damage = (pressure / HAZARD_HIGH_PRESSURE) × PRESSURE_DAMAGE_COEFFICIENT (4), capped at MAX_HIGH_PRESSURE_DAMAGE (4)
- Low pressure damage = LOW_PRESSURE_DAMAGE (4) flat, applied when pressure < HAZARD_LOW_PRESSURE (20 kPa)

### Temperature Damage (code/__DEFINES/atmospherics.dm:129–153)

| Constant | Value | Meaning |
|----------|-------|---------|
| `BODYTEMP_NORMAL` | 310.15 | K; 37°C; normal human body temperature |
| `BODYTEMP_HEAT_DAMAGE_LIMIT` | BODYTEMP_NORMAL + 30 = 340.15 | K; 67°C; above this, crew takes heat damage |
| `BODYTEMP_COLD_DAMAGE_LIMIT` | BODYTEMP_NORMAL - 40 = 270.15 | K; -3°C; below this, crew takes cold damage |
| `BODYTEMP_AUTORECOVERY_DIVISOR` | 11 | Divisor for natural temp recovery each tick |
| `BODYTEMP_AUTORECOVERY_MINIMUM` | 12 | K; min recovery per tick when abs(310.15 - bodytemp) > 50 |

---

## Minimum Viable Port

1. **Pipe layers**: 3 independent pipe networks per turf (layer 1, 2, 3); auto-connection within layer only; -5 px offset per layer off default.
2. **Simple pipes and manifolds**: cardinal-aligned bendable/T-shaped connectors; two nodes, pressure volume per node.
3. **Vent pump**: pump_direction (release vs. siphon), external/internal pressure bounds, on/off, output pressure clamping.
4. **Vent scrubber**: scrubbing vs. siphoning, filter_types list, volume_rate L/cycle, widenet 3×3 mode, power scaling.
5. **Manual valve**: on/off toggle, animates, stops flow.
6. **Pressure pump**: target_pressure var, pushes to maintain output pressure, max 4500 kPa.
7. **Volume pump**: transfer_rate L/s (max 200), fixed-rate pump independent of pressure, overclocked flag leaks 10%.
8. **Portable canister**: gas_type, volume 1000 L, filled fraction, valve_open, release_pressure, pressure limits (leak 3040 kPa, rupture 3546 kPa, fragment 4053 kPa).
9. **Tank (item)**: volume, distribute_pressure, populate_gas() for type, toggle_internals() messages verbatim, pressure thresholds as defined.
10. **Constants**: ONE_ATMOSPHERE (101.325), T20C (293.15 K), pressure/temp damage thresholds, leak/rupture pressures.

---

## NOT FOUND / Open Questions

- **Gas analyzer**: Examine output format and interaction method not found; how does a player read a gas readout?
- **Heat exchanger**: Detailed mechanics (which fluid loops, temperature transfer rate, power use) not provided in source excerpts.
- **Portable pump / scrubber**: Internal construction, power draw, interaction not detailed in available code.
- **Filter / Mixer**: Trinary device internals and ratio/type configuration UI not shown.
- **Pipe construction**: Wrench pressure check message ("too much pressure") not found; what is the exact threshold and delay?
- **Radio control**: Full signal format and area assignment system for vent pumps/scrubbers not detailed.
- **Tank rupture behavior**: Exact message when a tank ruptures or explodes not quoted; only code paths shown (assume_air, explosion).
