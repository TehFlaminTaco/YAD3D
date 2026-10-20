# Power Generation and Storage

Power systems include: SMES capacitors for load balancing, solar panels with tracking, PACMAN generators for emergency fuel-based power, thermoelectric generators using atmospheric heat transfer, RTGs for long-term passive power, and experimental systems like supermatter reactors, singularity generators, and radiation collectors. The power network distributes through cables: machines query `powernet.avail` vs `powernet.load` to determine if surplus power exists for their consumption.

## Counts on BoxStation (BoxStation.dmm)

| Type | Count | Notes |
|------|-------|-------|
| `/obj/machinery/power/smes` | 11 | Main energy storage units |
| `/obj/machinery/power/solar` | 8 | Solar panels (static, without trackers) |
| `/obj/machinery/power/port_gen/pacman` | 2 | Portable nuclear-type generators |
| `/obj/machinery/power/emitter` | 3 | Containment field generators |
| `/obj/machinery/power/supermatter_crystal` | 1 | Main engine power source |
| `/obj/machinery/power/rad_collector` | 4 | Radiation/singularity power collectors |
| `/obj/item/stock_parts/cell` | 20 | Standard power cells |
| `/obj/machinery/atmospherics/components/binary/circulator` | 0 | (Not used on this version) |
| `/obj/machinery/the_singularitygen` | 0 | (Not placed on map) |
| `/obj/structure/particle_accelerator` | 0 | (Not placed on map) |

---

## SMES (Superconducting Magnetic Energy Storage)  `/obj/machinery/power/smes`  (code/modules/power/smes.dm:17)

A high-capacity energy storage unit that buffers between power generation and consumption, preventing brownouts when demand spikes. Stores up to 5 MJ by default.

**Key vars:**
- `capacity = 5e6` (W, file:27) – maximum charge the SMES can store
- `charge = 0` (W, file:28) – current stored energy
- `input_level = 50000` (W, file:32) – how much power per tick the SMES tries to draw from the powernet
- `input_level_max = 200000` (W, file:33) – cap on input_level; scales with capacitor parts
- `inputting = TRUE` (file:31) – currently drawing power from the network
- `input_attempt = TRUE` (file:30) – trying to charge
- `output_level = 50000` (W, file:38) – how much power per tick the SMES tries to supply to the network
- `output_level_max = 200000` (W, file:39) – cap on output_level; scales with capacitor parts
- `outputting = TRUE` (file:37) – currently supplying power to the network
- `output_used = 0` (W, file:40) – actual power output in the last tick (may be less if network is full)
- `terminal = null` (file:42) – reference to the power terminal that connects this SMES to the cable network

**Interactions:**
- **Screwdriver** (opened panel): `default_deconstruction_screwdriver(user, "[initial(icon_state)]-o", initial(icon_state), I)` – opens/closes maintenance panel (file:85)
- **Wrench** (reorient): `default_change_direction_wrench(user, I)` – rotates SMES direction and searches for a new terminal in the target direction (file:90); shows "`<span class='notice'>Terminal found.</span>`" or "`<span class='alert'>No power terminal found.</span>`" (files:97-100)
- **Cable coil** (build terminal): 10 cable coils required; delay = 20 (ds, file:134); displays "`<span class='notice'>You start building the power terminal...</span>`" (file:131); builds `make_terminal(T)` which creates a new `/obj/machinery/power/terminal` facing toward the SMES; 50% chance of electrocution during construction (file:138); outputs "`<span class='notice'>[user.name] builds a power terminal.</span>`" (file:143)
- **Crowbar** (deconstruct): calls `default_deconstruction_crowbar(I)` and logs to admins and investigation (files:154-158)
- **Wirecutter** (dismantle terminal): only works with panel open; calls `terminal.dismantle(user, I)` (files:164-169)

**Construction chain (from frame to finished SMES):**
Not fully documented in this file; SMES is a completed machine placed on the map. Construction via circuit board and component parts occurs in generic machinery assembly (not detailed here). Uses component_parts list for capacitors and power cells (lines:69-78).

**Deconstruction chain:**
1. **Crowbar** with panel closed: `default_deconstruction_crowbar()` fails if terminal still attached (file:173); otherwise deconstructs into frame + circuit board + parts
2. **Wirecutter** with panel open: dismantles terminal first (file:168)
3. **On deconstruction**: power cells inside are given their proportional charge: `cell.charge = (charge / capacity) * cell.maxcharge` (file:181)

**Drops:**
- When deconstructed: frame, circuit board `/obj/item/circuitboard/machine/smes`, all component_parts (capacitors, power cells)
- When deleted mid-round: admin message logged; if terminal exists, `disconnect_terminal()` called (file:189)
- Stays behind: nothing (machine is removed)

**Health:**
- `max_integrity`: NOT SET (inherits from base machinery class, typically 200)
- Armor: NOT SET in this file
- Power:
  - `use_power = NO_POWER_USE` (file:22) – SMES itself draws no power
  - Does NOT have idle_power_usage or active_power_usage

**Gotchas:**
- SMES **must have a power terminal** to function; created with cable coils if missing. Examined text warns "`<span class='warning'>This SMES has no power terminal!</span>`" (file:47)
- SMES will break if terminal is missing on Initialize (file:60: `obj_break()`)
- `inputting` and `outputting` are TRUE by default, but actual flow depends on `input_level`, `output_level`, and network state
- Panel must be open to build a terminal (line:116)
- Floor plating must be removed to build a terminal (line:121)
- Capacity is recalculated from power cells in component_parts (file:76): `capacity = MC / 15000 * 1e6` where MC is sum of cell maxcharge values
- Charge is backfilled from cells on initialize (lines:77-78)

---

## Power Cells  `/obj/item/stock_parts/cell`  (code/modules/power/cell.dm:1)

Rechargeable electrochemical batteries in two main types: standard (1000 W·s default maxcharge) and high-capacity variants (seen at line 567 of _ours-items.txt as `/obj/item/stock_parts/cell/high`).

**Key vars (from _ours-items.txt and cell.dm):**
- `/obj/item/stock_parts/cell` – name: "power cell", maxcharge = 1000 (W, file:15), charge = 0 initially, filled to maxcharge on Initialize (line:33)
- `/obj/item/stock_parts/cell/high` – from _ours-items.txt line 52: "high-capacity power cell" (no DMM values found in source; likely overrides maxcharge to ~2000-5000)
- `/obj/item/stock_parts/cell/emproof` – "EMP-proof cell" (line:566 of _ours-items.txt)
- `/obj/item/stock_parts/cell/potato` – "potato battery" (line:568 of _ours-items.txt) (novelty item; not documented)
- `/obj/item/stock_parts/cell/high/plus` – "high-capacity power cell+" (line:567 of _ours-items.txt) (not found in code; likely T5 upgrade)
- `charge` (W, file:14) – current energy stored
- `maxcharge` (W, file:15) – maximum capacity (standard = 1000, high variants higher)
- `chargerate = 100` (W, file:19) – power per tick a recharger gives to this cell
- `self_recharge = 0` (file:20) – if non-zero, cell recharges itself over time at `chargerate * 0.25` per tick (file:53)
- `rigged = FALSE` (file:18) – if TRUE, cell explodes when used or charged

**Interactions:**
- **use(amount)** proc (file:72): Drains `amount` from charge; if rigged, calls explode() instead; returns 1 if successful, 0 if insufficient charge
- **give(amount)** proc (file:84): Charges cell by `amount`, capped at maxcharge; if rigged, explodes; returns actual power added
- **examine**: Shows charge percentage (file:99) and "faulty" warning if rigged (file:97)
- **self_recharge START/STOP**: When vv_edit_var sets `self_recharge`, starts/stops processing (lines:44-48)

**Construction chain:**
Not found – cells are manufactured items, not constructed on-station.

**Deconstruction chain:**
Not found.

**Drops:**
- When deconstructed: CELL does not drop anything; it simply ceases to exist (cell is in a machine's component_parts list)
- When destroyed: CELL disappears
- Stays behind: none

**Health:**
- `max_integrity`: NOT SET (not a machine; is an item)
- Damage: `w_class = WEIGHT_CLASS_SMALL` (line:13); `force = 5`, `throwforce = 5` (lines:9-10)
- Power: N/A – cell is an item, not a power machine

**Gotchas:**
- `rigged = FALSE` by default but becomes TRUE if plasma toxin is added via reagent (line:106)
- Rigged cells explode on use or recharge, creating a scaled explosion based on charge (files:110-124): devastation_range = -1, heavy_impact_range = sqrt(charge)/60, light_impact_range = sqrt(charge)/30, flash_range = light_impact_range
- `give()` clamping is minimum of (maxcharge - charge, amount), preventing overfill (file:90)
- EMP reduces charge by 1000 W / severity (lines:136)
- Self-recharge cells require START_PROCESSING (line:29) to tick

---

## PACMAN Generators  `/obj/machinery/power/port_gen/pacman`  (code/modules/power/port_gen.dm:82)

Portable nuclear-fueled generators that consume plasma sheets or similar material to produce power. Can be anchored to join the power network or left mobile as emergency backup.

**Key vars:**
- `sheets = 0` (file:85) – number of full fuel sheets currently loaded
- `max_sheets = 100` (file:86) – capacity in sheet units
- `sheet_name = ""` (file:87) – in-game name of the fuel (e.g., "Plasma Sheet")
- `sheet_path = /obj/item/stack/sheet/mineral/plasma` (file:88) – the object type used as fuel
- `sheet_left = 0` (file:89) – fractional sheet remaining (0 to 1)
- `time_per_sheet = 260` (ds, file:90) – how long one full sheet lasts to produce power
- `current_heat = 0` (file:91) – (NOT DOCUMENTED; likely for thermal management)
- `power_gen = 5000` (W, file:14 base) – base power output per tick
- `power_output = 1` (file:15) – multiplier on power_gen (0–1 range; default 1)
- `consumption = 0` (file:16) – fuel efficiency scaling from parts (file:119)
- `active = FALSE` (file:13 base) – currently running
- `anchored = FALSE` (file:8 base) – must be anchored to connect to powernet

**Interactions:**
- **Examine**: Shows fuel count, sheet name, and efficiency boost from parts (file:122-127): "`<span class='notice'>The generator has [sheets] units of [sheet_name] fuel left, producing [DisplayPower(power_gen)] per cycle.</span>`"
- **TogglePower()** (file:50): Checks `HasFuel()`; if TRUE, sets `active = TRUE`, START_PROCESSING, plays sound; if FALSE, sets `active = FALSE`
- **Active/Inactive toggle via interact**: NOT FOUND in pacman; handled by base class (file:13 base: `interaction_flags_atom = INTERACT_ATOM_ATTACK_HAND | INTERACT_ATOM_UI_INTERACT | INTERACT_ATOM_REQUIRES_ANCHORED`)

**Construction chain:**
PACMAN is a completed machine placed on the map. Assembly from parts:
1. Part refresh via `RefreshParts()` (file:108): matter_bin rating scales max_sheets = rating²×50; capacitor rating sums into temp_rating; all part ratings sum into consumption_coeff; power_gen recalculated as `initial(power_gen) * temp_rating * 2`; consumption = consumption_coeff
2. Fuel loading: Use item with `/obj/item/stack/sheet/mineral/plasma` in hand; item drops into the machine's contents

**Deconstruction chain:**
1. **Wrench** (unfasten): `default_unfasten_wrench(user, W, 0)` – detaches from floor, calls `DropFuel()` which spawns all sheets at current location (file:135-136)
2. **Crowbar**: NOT FOUND

**Drops:**
- When DropFuel() called: `new sheet_path(drop_location(), sheets)` – all sheets spawn at the machine's location (file:136)
- When destroyed: sheets are inside machine contents; unknown if they drop or are lost
- Stays behind: empty generator frame

**Health:**
- `max_integrity`: NOT SET (inherits ~200)
- Power:
  - `use_power = NO_POWER_USE` (file:9 base)
  - `active_power_usage`: NOT SET (generator does NOT consume power; it produces it)

**Gotchas:**
- **Must be anchored** to connect to powernet (line:34); unanchored generators produce power but it goes nowhere
- `HasFuel()` checks: `sheets >= 1 / (time_per_sheet / power_output) - sheet_left` (file:130) – threshold is fractional sheet count needed per cycle
- `UseFuel()` (file:139): Uses `needed_sheets = 1 / (time_per_sheet * consumption / power_output)`; subtracts from sheet_left first, then sheets. Tracks fractional remainder
- Heat generation NOT YET IMPLEMENTED in this snapshot (line:150 references `lower_limit = 56 + power_output * 10` but code is cut off)
- `power_output` ranges 0–1 and scales fuel consumption and power_gen linearly

---

## Solar Panels  `/obj/machinery/power/solar`  (code/modules/power/solar.dm:4)

Static or tracking photovoltaic panels that generate power proportional to sunlight angle and occlusion. Panels can rotate to track the sun when connected to a tracker and control computer. Standard panel generates `SOLAR_GEN_RATE * sunfrac` watts per tick, where SOLAR_GEN_RATE = 1500 (W) and sunfrac ∈ [0, 1] is the cosine of the angle between panel azimuth and sun azimuth (Lambert's Cosine Law, file:166).

**Key vars:**
- `id` (file:16) – panel group identifier for tracking
- `sunfrac = 0` (file:18) – [0–1] fraction of max power the panel currently generates
- `azimuth_current = 0` (file:19) – [0–360) panel facing direction in degrees
- `azimuth_target = 0` (file:20) – next azimuth the panel will rotate to
- `control` (file:21) – reference to the `/obj/machinery/power/solar_control` computer managing this panel
- `needs_to_turn = TRUE` (file:22) – queued turn pending
- `needs_to_update_solar_exposure = TRUE` (file:23) – queued exposure recalculation pending
- `obscured = FALSE` (file:17 in occlusion_setup) – panel is in shadow
- `max_integrity = 150` (file:13) – health; doubles if glass_type is reinforced glass (file:66)
- `integrity_failure = 0.33` (file:14) – breaks at 33% health
- **Control Computer** `/obj/machinery/power/solar_control` (file:288):
  - `azimuth_target = 0` (file:303) – target rotation angle
  - `azimuth_rate = 1` (file:304) – degrees per minute; starts as SSsun.base_rotation
  - `track = SOLAR_TRACK_OFF` (file:306) – tracking mode: OFF, TIMED, or AUTO
  - `connected_panels` (file:309) – list of panels managed by this control computer
  - `connected_tracker` (file:308) – optional motion tracker for automatic sun following
  - `idle_power_usage = 250` (W, file:295) – control computer always draws this

**Interactions:**
- **Crowbar** (disassemble panel): delay = 50 (ds, file:72); displays "`<span class='notice'>[user] takes the glass off [src].</span>`" (file:74); calls `deconstruct(TRUE)` which returns the glass and drops shards if broken (files:97-106)
- **Damage** (break panel): When broken, unsets control and plays shatter sound (file:93); glass panels take extra damage from brute force; emits "`<span class='alert'>BRUTE</span>`" or "`<span class='alert'>BURN</span>`" overlays on damage (files:78-86)
- **Control Computer Interaction**: UI at file:351; actions include azimuth adjustment (file:373), azimuth_rate adjustment (file:382), tracking mode toggle (file:391), refresh search (file:400)

**Construction chain:**
1. **Solar Assembly** `/obj/item/solar_assembly` (file:199):
   - Anchored with **wrench**: delay = 0; displays "`<span class='notice'>[user] wrenches the solar assembly into place.</span>`" (file:240); anchored = TRUE; resets pixel offsets
   - Unanchored with **wrench**: anchored = FALSE; displays "`<span class='notice'>[user] unwrenches the solar assembly from its place.</span>`" (file:245); randomizes pixel offset by ±6 pixels
2. **Add glass** with **glass sheets** (2 required): Works only if anchored (file:251); uses 2 sheets (file:255); creates `/obj/machinery/power/solar` if no tracker, or `/obj/machinery/power/tracker` if tracker = 1 (files:259-262); displays "`<span class='notice'>[user] places the glass on the solar assembly.</span>`" (file:258)
3. **Add tracker electronics** with **electronics/tracker item**: Inserts tracker electronics into assembly; displays "`<span class='notice'>[user] inserts the electronics into the solar assembly.</span>`" (file:274); sets `tracker = 1`
4. **Solar Control Computer**: Built separately from generic computer construction

**Deconstruction chain:**
1. **Crowbar** on panel (disassemble glass): delay = 50 (ds); returns glass sheets (2) or shards (2) if broken; displays "`<span class='notice'>[user] takes the glass off [src].</span>`" (file:74)
2. On deconstruction, assembly is moved back to the ground (file:100)

**Drops:**
- When deconstructed properly: `/obj/item/solar_assembly` with glass_type set to the glass used (or none if broken)
- When destroyed/broken: `/obj/item/shard` x2 dropped
- Stays behind: assembly frame can be reused

**Health / Armor:**
- `max_integrity = 150` (file:13); doubled if reinforced glass used (file:66)
- `integrity_failure = 0.33` (file:14) – breaks at 33%
- Armor: NOT SET; takes full damage
- Damage types: BRUTE and BURN affect icon state; BRUTE at >100 integrity causes "`<span class='effects'>glasshit.ogg</span>`" sound

**Power (generation):**
- `use_power = NO_POWER_USE` (file:10) – panel itself draws no power
- `idle_power_usage = 0` (file:11)
- `active_power_usage = 0` (file:12)
- **Generation formula** (file:182): `sgen = SOLAR_GEN_RATE * sunfrac` where SOLAR_GEN_RATE = 1500 (W, file:1); sunfrac calculated as Lambert's Cosine Law: `sunfrac = cos(azimuth_current - SSsun.azimuth)` clamped [0, 1] (file:166)
- Power added to network via `add_avail(sgen)` (file:183); if control computer assigned, also increments `control.gen += sgen` (file:185)

**Gotchas:**
- **Occlusion check** (file:134): Traces 20 tiles toward sun; if any turf is opaque, panel is obscured and generates 0 power (file:135)
- **Sunfrac update** (file:155): Whenever sun moves (via SSsun signal) or panel rotates, recalculates sunfrac using cosine law (file:166)
- **Control linking**: Panel must be in the same powernet as its control computer; if powernet differs, unsets control (file:173)
- **Tracking modes**: SOLAR_TRACK_OFF (manual), SOLAR_TRACK_TIMED (rotates at fixed rate), SOLAR_TRACK_AUTO (follows tracker with SSsun signal)
- **Rotation rate**: azimuth_rate clamped to ±2× SSsun.base_rotation (file:388)
- **Control computer requires power** (250 W idle; file:295); if unpowered, still searches for panels but does not update them
- **Fake solar** subtype (file:188) unregisters from SSsun signal and never generates power

---

## RTG (Radioisotope Thermoelectric Generator)  `/obj/machinery/power/rtg`  (code/modules/power/rtg.dm:4)

A passive power generator using radioisotope decay, producing steady power for decades without fuel input. Outputs 1000 W base (scales with part ratings). Emits radiation when panel is open.

**Key vars:**
- `power_gen = 1000` (W, file:18) – base power output per tick; scales linearly with part ratings in RefreshParts() (file:37)
- `irradiate = TRUE` (file:20) – if TRUE and panel open, pulses 60 rads every tick (file:30)
- `can_buckle = TRUE` (file:14) – allows buckling people to RTG (for admin fun/punishment)
- `buckle_lying = FALSE` (file:15) – buckled mobs stand
- `buckle_requires_restraints = TRUE` (file:16) – mobs must be restrained first

**Interactions:**
- **Screwdriver** (open/close panel): `default_deconstruction_screwdriver(user, "[initial(icon_state)]-open", initial(icon_state), I)` (file:45) – opens panel, emits radiation pulses if panel_open = TRUE
- **Crowbar** (deconstruct): `default_deconstruction_crowbar(I)` (file:47) – removes RTG

**Construction chain:**
NOT DOCUMENTED – RTG is a completed machine placed on map. Upgraded via component_parts list (capacitors scale output).

**Deconstruction chain:**
1. **Crowbar**: Deconstructs into frame + circuit board `/obj/item/circuitboard/machine/rtg` + component_parts

**Drops:**
- When deconstructed: Circuit board, frame, component_parts
- Stays behind: none

**Health / Power:**
- `max_integrity`: NOT SET (inherits ~200)
- `use_power = NO_POWER_USE` (file:10) – RTG draws no power
- `idle_power_usage` / `active_power_usage`: NOT SET (does not consume power)
- **Power output**: `add_avail(power_gen)` per tick (file:28)

**Gotchas:**
- **Radiation only when panel open**: `if(panel_open && irradiate) radiation_pulse(src, 60)` (file:29) – emission stops when panel is closed
- **Advanced RTG subtype** (file:51): `power_gen = 1250` (1250 W base instead of 1000)
- **Void Core subtype** (file:59): Alien power source; power_gen = 20000 W; no radiation (irradiate = FALSE); can explode if shot (file:81-94)

---

## Thermoelectric Generator (TEG)  `/obj/machinery/power/generator`  (code/modules/power/generator.dm:1)

Converts temperature difference between two air circulators (hot and cold loops) into electrical power. Requires both a hot-side and cold-side circulator; power output scales with ΔT and gas heat capacity. Uses formula: `energy_transfer = (ΔT * C_hot * C_cold) / (C_hot + C_cold); power = energy_transfer * efficiency` with efficiency = 0.65 and GENRATE coefficient = 800 (file:44, 64).

**Key vars:**
- `cold_circ` (file:8) – reference to `/obj/machinery/atmospherics/components/binary/circulator` on cold side (mode = CIRCULATOR_COLD)
- `hot_circ` (file:9) – reference to circulator on hot side (mode = CIRCULATOR_HOT)
- `lastgen = 0` (W, file:11) – power generated last cycle
- `lastgenlev = -1` (W, file:12) – smoothed output for icon display
- `lastcirc = "00"` (file:13) – circulation status; "1" if circulator has positive pressure delta, "0" otherwise

**Interactions:**
- **UI** (file:138): Displays cold loop and hot loop inlet/outlet temperatures and pressures; shows output power
- **Wrench** (anchor/unanchor): Works only with panel open (file:190); `anchored = !anchored`; calls `kill_circs()` if unanchored (file:195); displays "`<span class='notice'>You [anchored?"secure":"unsecure"] [src].</span>`" (file:197); reconnects to network
- **Rotate** (via component): Alt-click or other rotation method rotates TEG direction; search for circulators on new sides (file:26)

**Construction chain:**
1. **Place TEG**: Creates with frame + circuit board `/obj/item/circuitboard/machine/generator` (line:22)
2. **Find circulators**: Automatically searches adjacent turfs in cardinal directions matching generator's direction (file:161); expects circulators facing back toward TEG
3. **Connect**: Circulators are found if they are:
   - In the turf in the direction the TEG is facing (EAST or WEST if TEG dir is EAST/WEST) (file:162-168)
   - Facing back toward TEG (e.g., circulator dir = WEST if TEG dir = EAST)
   - In mode CIRCULATOR_COLD or CIRCULATOR_HOT
4. **Anchor** (with wrench, panel open): `anchored = TRUE`; TEG then connects to powernet

**Deconstruction chain:**
1. **Crowbar** (from base machinery): Deconstructs into frame + circuit board + component_parts
2. **Wrench** (unanchor first): Disconnects circulators

**Drops:**
- When deconstructed: Circuit board, frame, component_parts (none typically added)
- When deleted: Circulators remain; TEG disappears
- Stays behind: none (frame removed)

**Health / Power:**
- `max_integrity`: NOT SET (inherits ~200)
- `use_power = NO_POWER_USE` (NOT SET in this file; inherits base)
- Power output (file:94-100): `power_output = round(lastgen / 10)` per tick; `lastgen` is accumulated from `process_atmos()`

**Gotchas:**
- **Requires both circulators**: If either is missing, displays error message (files:127-132): "`<span class='bad'>Unable to locate hot circulator!</span>`" or "`<span class='bad'>Unable to locate cold circulator!</span>`"
- **ΔT check**: Only generates if `delta_temperature > 0` (file:63); cold side must actually be cold
- **Heat capacity required**: Both gases must have non-zero heat_capacity(); otherwise no power (file:63)
- **Power calculation** (lines:66-72): `energy_transfer = ΔT * C_hot * C_cold / (C_hot + C_cold); power = energy_transfer * 0.65; heat_loss = energy_transfer * 0.35`. Cold air gains heat_loss; hot air loses energy_transfer. Power is divided by 10 before being added to network (line:96)
- **Circulator directions**: Generator searches using `get_step(src, cardinal)` and expects circulators facing back; if generator is rotated, must manually search circulators again by rotating or unanchoring/reanchoring (file:191-196)
- **Icon display** (file:36-41): Shows heat generation level (teg-op[1-11]) and circulator status (teg-oc[lastcirc]) only when not broken/unpowered

---

## Emitter  `/obj/machinery/power/emitter`  (code/modules/power/singularity/emitter.dm:1)

A heavy-duty directed-energy weapon used to fire particles at singularities or for containment tests. Fires beams automatically when powered and active. Requires welding/anchoring to the floor. Draws 10 W idle, 300 W active (scales down with micro-laser parts). Fire delay 100 ds (10 sec) base, improves with upgrades.

**Overview (10 lines):**
Anchored or welded beam emitter that fires when active and powered. Can be locked by admin. Requires: welded to floor (or anchored + unwelded); connected to powernet; active = TRUE. Fires `/obj/projectile/beam/emitter` at interval fire_delay every tick. Costs active_power_usage = 300 W (or less with upgrades). On singularity/engine room, emitters are critical for testing and containment field activation. Not currently on BoxStation map (counts as 3 emitters for field containment).

---

## Supermatter Crystal  `/obj/machinery/power/supermatter_crystal`  (code/modules/power/supermatter/supermatter.dm:98)

The main engine power source on BoxStation. Generates power by absorbing radiation from surrounding gas. Produces exponentially more power and heat as it consumes particles; can destabilize and detonate if overheated or overpowered. Indestructible crystal anchored in engine room; surrounded by containment field (singularity/emitter + field generators). Base damage = 0; explodes when damage ≥ 900. Outputs `power = <varies>` watts (complex calculation based on gas composition, moles, temperature, and internal state).

**Overview (10 lines):**
The supermatter is BoxStation's primary power source. It sits in a containment chamber and absorbs radiation from surrounding gas to produce power. Hotter gas, more plasma/tritium, and higher moles increase power output exponentially. Damage accumulates from radiation and overpower conditions; crystal explodes at damage = 900 (delamination). Safe operational temp ≈ 40–10,000 K depending on gas. If core delams, station loses power and suffers explosion. Must be cooled and fueled with low-damage-state gases (CO₂, N₂, freon preferred; avoid plasma/tritium at high temps). The emitters and field generators on the engine room work to contain escaping radiation.

---

## Singularity Generator  `/obj/machinery/the_singularitygen`  (code/modules/power/singularity/generator.dm:2)

A device that creates a gravitational singularity on demand. Requires an energy input (usually from supermatter) to charge to energy = 200, at which point it spawns `/obj/singularity` with starting_energy = 50. Generator is consumed after singularity is created.

**Overview (10 lines):**
The singularity generator is an emergency/exotic power system that spawns a contained black hole. Charges via radiation or external power input (process() decrements energy –1 per tick; process() also called by external radiation). When energy ≥ 200, spawns a new singularity and deletes itself. Singularities consume all matter nearby and grow in size/stages (1–6); larger singularities pull and irradiate more. Singularities are used in late-stage engine testing; uncontained singularities destroy the station. Not placed on BoxStation (engine uses supermatter only). Requires containment fields and emitters to safely test.

---

## Particle Accelerator  `/obj/structure/particle_accelerator`  (code/modules/power/singularity/particle_accelerator/particle_accelerator.dm:22)

A seven-part structure that fires alpha particles toward a target (typically supermatter or singularity) to inject radiation. Composed of: 3 emitters, 1 power box, 1 fuel chamber, 1 end cap, 1 control computer. Each part must be secured, wired, paneled, and completed before accelerator functions.

**Overview (10 lines):**
The particle accelerator is a multi-part weapon/engine component that fires radiation beams into a singularity or supermatter crystal. Setup: wrench each part to floor (PA_CONSTRUCTION_UNSECURED → PA_CONSTRUCTION_UNWIRED), add 1 cable coil per part (→ PA_CONSTRUCTION_PANEL_OPEN), screw panels closed (→ PA_CONSTRUCTION_COMPLETE). Requires control computer wired to powernet. Fires when powered. Each part has 500 health; armor 30/20/20 (melee/bullet/laser). On BoxStation: NOT PLACED. Engine room setup includes emitters, field generators, and supermatter; particle accelerator is optional advanced equipment.

---

## Radiation Collector  `/obj/machinery/power/rad_collector`  (code/modules/power/singularity/collector.dm:9)

A device that absorbs Hawking radiation and plasma to produce power. Requires a plasma tank loaded and active status. Generates power from radiation pulses (singularities, supermatter) or direct plasma consumption. Stores energy internally and outputs in pulses.

**Overview (10 lines):**
Radiation collectors harvest power from a singularity, supermatter, or direct plasma fuel. Load a plasma tank, anchor it, set active. Collector stores radiation as internal `stored_energy` and outputs at rate `RAD_COLLECTOR_OUTPUT = min(stored_energy, stored_energy*0.04 + 1000)` watts per tick. Can be set to bitcoin-mining mode (converts tritium + O₂ → CO₂ and research points). Emits radiation continuously; requires plasma tank to function. On BoxStation: 4 collectors are placed (typically near engine for backup power or mining). Tank insertion/eject via interaction; lock controls with ID when active. Wrench to anchor/detach from powernet.

---

## Power Terminal  `/obj/machinery/power/terminal`  (code/modules/power/terminal.dm:6)

An underfloor wiring connection point for power machines like SMES. Terminals are auto-generated when an SMES is placed or manually built with cable coils. Serves as the network node for machines that cannot sit directly on cable nodes.

**Overview (5 lines):**
Power terminals are invisible underfloor connectors that link power machines (especially SMES) to the cable network. Built with 10 cable coils (delay = 20 ds) when a user clicks an SMES with cables in hand while panel is open. Can be dismantled with wirecutters (delay = 50 ds) to return 10 cable coils. Terminal is located on the turf; visible only with T-ray scanner or when dismantled. Every SMES should have a terminal to function; missing terminal causes SMES to break on init.

---

## Minimum Viable Port

- **SMES**: Stores power; requires terminal to network. Input/output levels cap at input_level_max/output_level_max (default 200 kW). Capacity scales with power cell maxcharges in component_parts.
- **Power cells**: Store 1000 W standard (higher for upgraded variants). Used in rechargers, APCs, and SMES. Can be rigged (plasma) to explode.
- **Solar panels**: Generate 1500 W × cos(panel_angle - sun_angle). Require glass + tracker electronics + control computer. Track sun angle from SSsun.
- **PACMAN generator**: Burns plasma sheets at rate ~1 per 260 ds. Outputs ~5 kW base (scales with capacitor/manipulator parts). Must anchor to powernet.
- **RTG**: Passive 1 kW output, no fuel, emits radiation when panel open. Use for backup power.
- **Thermoelectric generator**: Produces power from ΔT between hot and cold air circulators. Requires both circulators adjacent, facing toward TEG. Complex calculation with gas heat capacity and efficiency.
- **Supermatter crystal**: Main engine power. Absorbs radiation from gas; produces power exponentially. Explodes at damage = 900 (delamination). Must cool and manage gas carefully.
- **Power network basics**: Machines connect via cables or terminals. `powernet.avail` = total available; `powernet.load` = total demand; surplus = avail - load. Machines check `surplus()` before drawing power.

---

## NOT FOUND / Open Questions

- **RTG advanced subtype**: Advanced RTG code (line:51 rtg.dm) exists; actual maxcharge values for /obj/item/stock_parts/cell/high not documented in source.
- **PACMAN heat system**: Variable `current_heat` (port_gen.dm:91) is never referenced in the provided code snippet (cut off at line:150); heat overheating logic NOT FOUND.
- **Thermoelectric generator process_atmos() full formula**: Code in generator.dm lines:66-72 is complete; uses efficiency = 0.65 and GENRATE = 800, but no scaling by GENRATE visible in the snippet (likely in the power_output calc at line:96).
- **Singularity energy decay/dissipation**: Energy decrements with dissipate_delay and dissipate_strength; exact formula for decay vs. radiation absorption NOT FULLY CLEAR.
- **Supermatter delamination explosion scale**: Variable `explosion_power = 35` (supermatter.dm:144) is set but the explosion() call NOT FOUND in the excerpt.
- **Particle accelerator particle generation**: Control computer and emitter logic NOT DOCUMENTED in the particle_accelerator.dm excerpt.
- **Radiation collector plasma conversion rate**: `RAD_COLLECTOR_MINING_CONVERSION_RATE = 0.00001` (collector.dm:5) converts watts to research points; inverse ratio NOT EXPLAINED.
- **Circulator modes** (CIRCULATOR_COLD, CIRCULATOR_HOT): Definitions NOT FOUND; inferred from generator.dm context but not declared in provided code.
