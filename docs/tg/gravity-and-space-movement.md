# Gravity and Space Movement

Gravity generation and zero-gravity mechanics in SS13. Movement in space relies on momentum transfer (newtonian physics) and specialized equipment. Hazards include pressure damage and cold. All time values in deciseconds (ds); 1 ds = 0.1 seconds, 10 ds = 1 second.

## Gravity System

**has_gravity()** `/atom/proc/has_gravity` (code/game/atoms.dm:1370)
- Returns gravity setting for an atom at a turf
- Returns FALSE (no gravity) if: atom has no turf location, turf is space, atom is in /area/space
- Returns area's has_gravity value if area sets it (e.g., stations always have gravity set)
- Otherwise checks GLOB.gravity_generators["[z_level]"] and returns max generator.setting on that level
- Falls back to SSmapping.level_trait(z, ZTRAIT_GRAVITY)
- Signals: COMSIG_ATOM_HAS_GRAVITY and COMSIG_TURF_HAS_GRAVITY (both can force gravity via components)

**forced_gravity** - component system (`code/datums/elements/forced_gravity.dm`)
- Atoms can register to signal COMSIG_ATOM_HAS_GRAVITY / COMSIG_TURF_HAS_GRAVITY to override gravity
- Registered listeners pass a list to add forced gravity values; proc returns max value

**Areas with no gravity:**
- /area/space (default; has_gravity = 0)
- /area/space/ruins (various space ruin areas set has_gravity = FALSE)
- All other areas must explicitly set has_gravity to control (default 0 = no gravity if not a station)

**Gravity Generator** `/obj/machinery/gravity_generator/main` (code/modules/power/gravitygenerator.dm:111)
- On BoxStation at line 44320 of BoxStation.dmm, in the engine room (/area/engine/gravity_generator)
- Key vars:
  - `on` (TRUE/FALSE): gravity is active
  - `breaker` (TRUE/FALSE): breaker switch; generator only works if breaker=TRUE and power available
  - `charging_state` (POWER_IDLE=0, POWER_UP=1, POWER_DOWN=2): startup/shutdown animation
  - `charge_count` (0-100): charge level; increments ±2 per process while charging/discharging
  - `setting` (1): gravity multiplier when on (set via UI)
- Power: idle_power_usage=0, active_power_usage=3000 (W)
- Process (code/modules/power/gravitygenerator.dm:305):
  - At charge_count >= 100: set_state(1) (turn on)
  - At charge_count <= 0: set_state(0) (turn off)
  - Increments/decrements by 2 per tick while charging; at 25% chance per tick, emits sound and calls pulse_radiation()
- Repair chain (broken_state progression):
  1. GRAV_NEEDS_SCREWDRIVER (0): screwdriver → secure screws (line 193)
  2. GRAV_NEEDS_WELDING (1): welder, 0 ds → mend framework (line 200)
  3. GRAV_NEEDS_PLASTEEL (2): 10x plasteel sheet → add plating (line 206)
  4. GRAV_NEEDS_WRENCH (3): wrench → secure plating, restored to working (line 218)
- update_list() (line 371): Registers generator in GLOB.gravity_generators["[z]"] when on, removes when off
- set_state(new_state) (line 279): Changes on/off, updates use_power (IDLE or ACTIVE), sends announcement and calls shake_everyone() if gravity state changes live
- shake_everyone() (line 351): Messages all mobs on z-level with camera shake and alert sound, calls update_gravity() on each mob

## Zero-Gravity Movement

**Process_Spacemove()** - Returns TRUE (can move) or FALSE (cannot move)
- `/mob/Process_Spacemove(movement_dir)` (code/modules/mob/mob_movement.dm:267)
  - Base: Returns TRUE if HAS_TRAIT(src, TRAIT_SPACEWALK)
  - Otherwise calls `get_spacemove_backup()` and returns TRUE if a movable object to push off exists (lines 270-276)
- `/mob/living/carbon/Process_Spacemove(movement_dir)` (code/modules/mob/living/carbon/carbon_movement.dm:8)
  - Line 10: Returns FALSE if not on a turf
  - Lines 13-15: Returns TRUE if has jetpack implant (cyberimp chest thrusters) and it's on AND movement_dir is set OR stabilizers on
  - Lines 17-19: Returns TRUE if wearing jetpack that's on AND (movement_dir is set OR stabilizers on)
  - Line 21: Calls parent's Process_Spacemove (get_spacemove_backup check)
- Called from client/Move (code/modules/mob/mob_movement.dm:117) to prevent movement in space without these conditions

**get_spacemove_backup()** (code/modules/mob/mob_movement.dm:281)
- Searches orange(1) around mob for adjacent objects to push off
- Checks in order: skip areas, skip space turfs, check dense anchored atoms, skip buckled mobs, return first unanchored dense movable
- Used by newtonian_move to push off when moving in space

**newtonian_move(direction)** (code/game/atoms_movable.dm:558)
- Called after every movement (Moved proc, line 393) and diagonal moves (line 360)
- Returns 0 if has gravity OR if not on turf
- Sets inertia_dir = direction (0 to stop drifting, any dir to continue/start drift)
- Adds src to SSspacedrift.processing list for space drift subsystem
- Returns 1 if successfully set inertia

**Space Drift Subsystem** (code/controllers/subsystem/spacedrift.dm)
- Priority: FIRE_PRIORITY_SPACEDRIFT, wait=5 (ds), processes every 5 deciseconds
- Maintains list of drifting objects in processing[]
- For each object per tick (fire(), line 15):
  - If inertia_next_move > world.time, skip (not yet time to move)
  - If object moved or Process_Spacemove(0) returns TRUE (gravity applied), stop drifting (inertia_dir=0)
  - If inertia_dir=0, remove from processing
  - Otherwise: call step(object, inertia_dir) with inertia_moving=TRUE flag
  - Update inertia_next_move = world.time + inertia_move_delay (typically 5 ds, line 51)

**Inertia variables** (code/game/atoms_movable.dm:22-26)
- `inertia_dir`: direction of drift (0 = not drifting)
- `inertia_moving`: flag TRUE while space drift subsystem is moving the object
- `inertia_next_move`: world.time when next drift step can occur
- `inertia_move_delay`: delay between drift steps, default 5 (ds)
- `inertia_last_loc`: location when drift started (checked against current loc to detect space turf Entered event)

**Throwing in zero-g** - pushes thrower backward
- throw_item() calls newtonian_move(get_dir(target, thrower)) on thrower (code/modules/mob/mob_movement.dm:273)
- Message: "<span class='info'>You push off of [backup] to propel yourself.</span>"

**float() animation** - NOT FOUND (item floating animation mechanism not located in this version)

## Space Turf

**Space turf** `/turf/open/space` (code/game/turfs/open/space/space.dm:1)
- Icon: icons/turf/space.dmi, state "0"
- Temperature: TCMB (2.7 K, near absolute zero)
- Immutable air environment: uses space_gas datum (line 15)
- Entered() (line 145): When atom enters space turf
  - If has destination_z/destination_x/destination_y set: forceMoves atom to that turf (lines 151-176)
  - Tries to find safe landing spot by spiraling outward from destination if it's dense
  - Pulls along any item the atom is pulling
  - Calls stoplag() then atom.newtonian_move(atom.inertia_dir) to resume space drift on new z-level

**Lattice** `/obj/structure/lattice` (code/game/turfs/open/space/space.dm:109-129)
- Built with 1 rod on space turf; upgraded to catwalk with 1 additional rod + 1 lattice
- Allows Process_Spacemove to return TRUE (lattice found via locate in range(1) in atoms_movable.dm:551)

**Catwalk** `/obj/structure/lattice/catwalk` (code/game/turfs/open/space/space.dm:109-129)
- Built with lattice + 1 rod (2 rods total from space)
- Also allows Process_Spacemove (same check as lattice)
- Can have cabling: can_have_cabling() returns TRUE for catwalk (line 190)

## Gear

### Jetpack `/obj/item/tank/jetpack` (code/game/objects/items/tanks/jetpack.dm:1)
- Base jetpack stats:
  - volume=70, w_class=WEIGHT_CLASS_BULKY
  - Actions: toggle_jetpack, jetpack_stabilization, set_internals
  - on=FALSE, stabilizers=FALSE (both togglable), full_speed=TRUE (non-improvised)
  - Holds compressed oxygen gas initially; can be filled with other gases
  - Populate gas: 6 * ONE_ATMOSPHERE pressure in 70 volume at 20°C
- Turn on (turn_on(), line 54):
  - Calls allow_thrust(0.01) to check fuel; if insufficient, doesn't turn on
  - Sets on=TRUE, icon_state="[initial_state]-on"
  - Starts ion trail effect
  - Registers for COMSIG_MOVABLE_MOVED and COMSIG_MOVABLE_PRE_MOVE
  - If full_speed=TRUE: adds /datum/movespeed_modifier/jetpack/fullspeed (speedboost in space)
- move_react() (line 74): Called per move if on
  - Requires: user not incapacitated, on turf, is_flying() or is_floating(), not buckled, not pulled, not throwing, movement keys held
  - Calls allow_thrust(0.01) per keypress
- allow_thrust(num, user) (line 93):
  - Checks if num < 0.005 or total_moles() < num; if so, turns off
  - Removes num moles from air_contents, adds to turf air
  - Generates ion trail effect
  - No refund/message on thrust; messages only on toggle
- Full speed jetpack message: none during operation
- Improvised jetpack (`/obj/item/tank/jetpack/improvised`):
  - volume=20 (vs 70 normal), full_speed=FALSE (hardsuit speed), gas_type=null (starts empty)
  - allow_thrust: 1/250 chance per thrust to cut out engines (line 134)
- Subtypes:
  - oxygen: standard oxygen-fueled
  - carbon_dioxide: CO2-fueled, distribute_pressure=0 (not for internals)
  - hardsuit jetpack (/suit variant, lines 197-277): 
    - volume=1, slot_flags=null, powered by tank in hardsuit s_store slot
    - Requires hardsuit equipped and internal tank present to toggle on

### Magboots `/obj/item/clothing/shoes/magboots` (code/modules/clothing/shoes/magboots.dm:1)
- Stats: permeability=0.05, slowdown_active=2 (when on)
- magpulse (0/1): toggle state; affects clothing_flags and slowdown
- attack_self/toggle() (line 23):
  - If magpulse=1: clears NOSLIP flag, sets slowdown=SHOES_SLOWDOWN (normal walk speed)
  - If magpulse=0: sets NOSLIP flag, sets slowdown=slowdown_active (2 = slow)
  - Toggles magpulse, updates icon and calls update_gravity() on user
- negates_gravity() (line 39): Returns TRUE if NOSLIP flag is set (magpulse on)
- Examine: Shows magpulse state
- Advanced magboots (`/advance`): slowdown_active=SHOES_SLOWDOWN (same as normal shoes)
- Syndie magboots (`/syndie`): heavier pull, different icon

### EVA Suits `/obj/item/clothing/suit/space` (code/modules/clothing/spacesuits/_spacesuits.dm:27)
- **Base stats:**
  - Clothing flags: STOPSPRESSUREDAMAGE | THICKMATERIAL
  - Slowdown: 1 (no speed penalty)
  - Gas transfer coefficient: 0.01, permeability: 0.02
  - Coverage: CHEST|GROIN|LEGS|FEET|ARMS|HANDS
  - Allowed items: flashlight, tank/internals
  - Armor: all 0 except bio=100, rad=50, fire=80, acid=70
  - Cold protection: HEAD|CHEST|GROIN|LEGS|FEET|ARMS|HANDS
    - min_cold_protection_temperature: SPACE_SUIT_MIN_TEMP_PROTECT_OFF (when thermal off)
  - Heat protection: same areas
    - max_heat_protection_temperature: SPACE_SUIT_MAX_TEMP_PROTECT
  - Strip delay: 80 ds
- **Thermal regulator:**
  - Has internal cell (/obj/item/stock_parts/cell/high by default)
  - thermal_on: toggle status
  - temperature_setting: target body temp (default BODYTEMP_NORMAL = 310.15 K)
  - Cell usage: 18 (W) per process tick when on (line 92, THERMAL_REGULATOR_COST)
  - When on: adjusts user's bodytemperature toward temperature_setting (line 99)
  - CAN toggle cell cover with crowbar (CtrlClick/AltClick) to access cell and temperature dial
  - Temperature adjustment via screwdriver when cover open: range 20-45°C (normal), -20-120°C (emagged)
- **Helmet** `/obj/item/clothing/head/helmet/space` (line 5):
  - Clothing flags: STOPSPRESSUREDAMAGE | THICKMATERIAL | SNUG_FIT
  - Permeability: 0.01
  - Cold protection: HEAD, min temp SPACE_HELM_MIN_TEMP_PROTECT
  - Heat protection: HEAD, max temp SPACE_HELM_MAX_TEMP_PROTECT
  - Flash protection: WELDER
  - Coverage flags: HIDEMASK|HIDEEARS|HIDEEYES|HIDEFACE|HIDEHAIR|HIDEFACIALHAIR
  - Armor: bio=100, rad=50, fire=80, acid=70
- **calculate_affecting_pressure()** (code/modules/mob/living/carbon/human/life.dm:51):
  - If wear_suit AND head both have STOPSPRESSUREDAMAGE flag: returns ONE_ATMOSPHERE (negates pressure damage)
  - Otherwise returns actual pressure

## Space Hazards

### Low Pressure Damage
- **Damage per tick:** `LOW_PRESSURE_DAMAGE` = 4 (code/__DEFINES/atmospherics.dm:199) per tick when below HAZARD_LOW_PRESSURE
  - Applied as brutal damage via adjustBruteLoss() in handle_environment_pressure (code/modules/mob/living/carbon/human/species.dm:1847)
  - Modified by H.physiology.pressure_mod
- **Pressure alerts:**
  - HAZARD_LOW_PRESSURE = 20 (kPa) (code/__DEFINES/atmospherics.dm:127): severe alert, damage
  - WARNING_LOW_PRESSURE = 50 (kPa) (code/__DEFINES/atmospherics.dm:125): warning alert, no damage
  - Switch statement (line 1830): clears alerts if WARNING_LOW_PRESSURE to WARNING_HIGH_PRESSURE (50-150 range safe)
  - Switch statement (line 1834-1839): shows "lowpressure" alert level 1 if HAZARD_LOW_PRESSURE to WARNING_LOW_PRESSURE (20-50)
  - Switch statement (line 1842-1848): shows "lowpressure" alert level 2 and applies 4 damage if below HAZARD_LOW_PRESSURE
- **Resist trait:** TRAIT_RESISTLOWPRESSURE prevents pressure damage and alerts (line 1836-1845)
- **Suit protection:** STOPSPRESSUREDAMAGE flag on both suit AND helmet → calculate_affecting_pressure() returns ONE_ATMOSPHERE, negating all pressure damage

### Cold Damage
- **Body temperature:**
  - BODYTEMP_NORMAL = 310.15 K (~37°C) (code/__DEFINES/atmospherics.dm:133)
  - BODYTEMP_COLD_DAMAGE_LIMIT = BODYTEMP_NORMAL - 40 = 270.15 K (~-3°C) (code/__DEFINES/atmospherics.dm:153)
- **Cold damage levels** (code/__DEFINES/mobs.dm:90-92):
  - COLD_DAMAGE_LEVEL_1 = 0.5 (at 200-270 K): applied as BURN damage
  - COLD_DAMAGE_LEVEL_2 = 1.5 (at 120-200 K)
  - COLD_DAMAGE_LEVEL_3 = 3.0 (below 120 K)
  - Damage modified by H.physiology.cold_mod
- **Cold damage thresholds** (code/modules/mob/living/carbon/human/species.dm:1790-1799):
  - bodytemp 200-270: alert level 1, apply COLD_DAMAGE_LEVEL_1
  - bodytemp 120-200: alert level 2, apply COLD_DAMAGE_LEVEL_2
  - bodytemp below 120: alert level 3, apply COLD_DAMAGE_LEVEL_3
- **Space temperature:** Space turf temperature = TCMB = 2.7 K (extremely cold)
- **Suit cold protection:** 
  - min_cold_protection_temperature on suit/helmet determines if protection applies
  - SPACE_SUIT_MIN_TEMP_PROTECT_OFF (when thermal off): ~0.1 K
  - SPACE_SUIT_MIN_TEMP_PROTECT (when thermal on): not specified; likely provides full space protection
  - Thermal regulator can actively maintain temperature if powered

### Suffocation / Asphyxiation
- **Breathing mechanics** (code/modules/mob/living/carbon/life.dm:53-66):
  - Base breathing: once per 4 ticks if healthy
  - Damaged lungs/heart: once per 2-3 ticks
  - Failed breath: every 1 tick until successful
- **Check breath** (code/modules/mob/living/carbon/life.dm:138-308):
  - Safe oxygen minimum: 16 kPa partial pressure
  - If oxygen < 16 kPa:
    - If 0 < O2 < 16: apply min(5*ratio, 3) oxyloss where ratio = 1 - O2/16
    - If 0 O2: apply 3 oxyloss per breath attempt
    - Throw "not_enough_oxy" alert
  - If oxygen >= 16 kPa: reduce oxyloss by -5 per breath, clear alert
- **Oxyloss constants:**
  - HUMAN_MAX_OXYLOSS = 3 (code/__DEFINES/mobs.dm:81): max oxyloss per breath under stress
  - No oxygen (0 kPa): 3 oxyloss per breath = 3 oxyloss per breath attempt
- **Death from asphyxiation:**
  - Health threshold for death: ~0 (variable; humans have crit_threshold and HEALTH_THRESHOLD_FULLCRIT)
  - Oxyloss accumulates until unconsciousness, then death at max oxyloss (~210 for humans)
  - In space with no air: 3 oxyloss per breath attempt
  - Breathing occurs once per 4 ticks normally → takes 4*(210/3) = 280 ticks to die from asphyxiation alone
- **Internals / breath source:**
  - Tank-based internals protect against all asphyxiation while active and full
  - Equipped via grab+attack action; requires mask flagged MASKINTERNALS or ORGAN_SLOT_BREATHING_TUBE
  - Air removed per breath: BREATH_VOLUME = 0.5 (code/__DEFINES/atmospherics.dm:44)

### Derivation: T-shirt death time in space
(inferred from code values)

Assume a human in t-shirt (no suit) in vacuum (space = 2.7 K, 0 kPa):
1. **Pressure damage:** 4 damage per tick when below 20 kPa
   - Ticks per second = unclear without SSmobs.wait value; assume 10 ticks/sec (1 ds/tick standard)
   - 4 damage/tick * 10 ticks/sec = 40 damage/sec from pressure alone
   - Human health ~100 → 2.5 seconds from pressure
2. **Cold damage:** From 310 K to 120 K (worst case for survival)
   - Temperature drop = 190 K; body adjusts per BODYTEMP_COLD_DIVISOR=15 and BODYTEMP_AUTORECOVERY_DIVISOR=11
   - With no insulation in space, cold damage ~3/tick at below-120K threshold
   - Accumulated over seconds while temp drops
3. **Asphyxiation:** 
   - Breathing every 4 ticks normally; 3 oxyloss per failed breath
   - 210 oxyloss to death → 280 ticks = 28 seconds at 10 ticks/sec
4. **Combined survival: ~20-30 seconds** (pressure kills fastest, then cold, then suffocation overlaps; all three occur simultaneously)

Space suit + helmet (STOPSPRESSUREDAMAGE flags) + internals eliminates pressure and asphyxiation. Thermal regulator protects from cold. Without thermal or proper coverage: dead in seconds.

## Minimum viable port
- has_gravity() proc checking turf, space flag, area.has_gravity, GLOB.gravity_generators
- Gravity generator machine with on/off, breaker, charging state, update_list() to GLOB
- Process_Spacemove() checks for gravity, jetpack, get_spacemove_backup()
- newtonian_move() sets inertia_dir and adds to space drift processing
- Space drift subsystem stepping objects per inertia_move_delay ticks
- Space turf with Entered() transit to destination_z
- Lattice/catwalk allowing spacemove
- Jetpack with thrust consumption and turn_on/off
- Magboots with toggle and negates_gravity()
- EVA suit with STOPSPRESSUREDAMAGE and thermal regulator
- Low pressure damage when below 20 kPa (4 per tick)
- Cold damage when below 270 K (0.5-3 per tick depending on severity)
- Suffocation: 3 oxyloss per failed breath, breathing every 4 ticks
- Internals and breath volume (0.5) protection against asphyxiation

## NOT FOUND / open questions
- Exact SSmobs.wait value (used in HUMAN_CRIT_MAX_OXYLOSS = SSmobs.wait/30 calculation)
- float() animation system for items in space
- Exact values for SPACE_HELM_MIN_TEMP_PROTECT, SPACE_SUIT_MIN_TEMP_PROTECT, SPACE_SUIT_MIN_TEMP_PROTECT_OFF
- Which items in _ours-items.txt are space-safe (have STOPSPRESSUREDAMAGE flag)
- Exact health/oxyloss thresholds for human crit and death
- Emote messages when turning jetpack on/off beyond what's quoted
