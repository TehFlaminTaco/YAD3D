# Placed Machinery on BoxStation

This document describes every machine placed on BoxStation from tgstation commit 2d6c10c1 (2020-07-06), focusing on player interactions, power usage, recipes, construction, and deconstruction. Machines are grouped by function and ordered by count (most placed first). Total: 173 entries.

---

## ATMOSPHERIC & CLIMATE CONTROL

### Space Heater  `/obj/machinery/space_heater`   (code/game/machinery/spaceheater.dm:5)

15 placed on BoxStation.

- Climate control device: heats or cools the station atmosphere. Uses internal power cell.
- Key vars:
  - `max_integrity = 250` (code/game/machinery/spaceheater.dm:13)
  - `use_power = NO_POWER_USE` — does not use area power, only cell (code/game/machinery/spaceheater.dm:18)
  - `idle_power_usage = 0`
  - `active_power_usage` — varies with operation; uses cell charge to transfer heat via `requiredPower / efficiency` (code/game/machinery/spaceheater.dm:115)
  - `heatingPower = 40000` (base: 40 kJ, code/game/machinery/spaceheater.dm:24)
  - `efficiency = 20000` (base: 20 kJ, code/game/machinery/spaceheater.dm:25)
  - `targetTemperature = T20C` (293.15 K, code/game/machinery/spaceheater.dm:23)
  - `settableTemperatureRange = 30` (can set ±30°C from median, code/game/machinery/spaceheater.dm:28)
- Armor: `melee=0, bullet=0, laser=0, energy=0, bomb=0, bio=100, rad=100, fire=80, acid=10` (code/game/machinery/spaceheater.dm:14)
- Interactions:
  | Action | Condition | Delay | Message | Result |
  |--------|-----------|-------|---------|--------|
  | Power toggle | None | 0 | "You switch [on/off] \\the [src]." | Toggles on/off state, mode becomes STANDBY (code/game/machinery/spaceheater.dm:212) |
  | Set mode | Panel open | 0 | None | Sets heat/cool/auto mode via UI (code/game/machinery/spaceheater.dm:218) |
  | Set target temp | Panel open | 0 | None | Clamps temperature within range via UI (code/game/machinery/spaceheater.dm:228) |
  | Insert power cell | Panel open | 0 | "You insert the power cell into \\the [src]." | Loads cell (code/game/machinery/spaceheater.dm:159) |
  | Eject power cell | Panel open | 0 | None | Via UI button (code/game/machinery/spaceheater.dm:233) |
  | Screwdriver | Always | 0 | "You [open/close] the hatch on \\the [src]." | Toggles panel open (code/game/machinery/spaceheater.dm:165) |
  | Crowbar | None | 0 | None | Deconstructs machine (code/game/machinery/spaceheater.dm:168) |
- Construction: Constructable with frame, circuit board, stock parts (code/game/machinery/spaceheater.dm:15; parts affect heating power, efficiency, range via RefreshParts)
  - Circuit: `/obj/item/circuitboard/machine/space_heater` (code/game/machinery/spaceheater.dm:15)
  - Parts upgraded: `micro_laser` (rating affects heatingPower), `capacitor` (rating affects temperature range and efficiency) (code/game/machinery/spaceheater.dm:121-132)
- Deconstruction: Crowbar triggers default_deconstruction_crowbar; on_deconstruction moves cell to component_parts (code/game/machinery/spaceheater.dm:45-49)
- Drops: Anchor required with wrench; no special drops on deconstruction beyond standard parts and cell
- Gotchas:
  - Anchored = FALSE; can be moved with wrench (code/game/machinery/spaceheater.dm:6)
  - Does not use area power; must have charged cell installed to operate
  - Requires panel open to insert cell; cell ejection also requires panel open

---

### Portable Atmospherics Canister - Air  `/obj/machinery/portable_atmospherics/canister/air`   (code/modules/atmospherics/machinery/portable/canister.dm:8+)

13 placed on BoxStation.

- Gas storage canister: holds 1000 units of air at various pressures.
- Key vars (base canister):
  - `volume = 1000` (code/modules/atmospherics/machinery/portable/canister.dm:21)
  - `max_integrity = 250` (code/modules/atmospherics/machinery/portable/canister.dm:34)
  - `density = TRUE` (code/modules/atmospherics/machinery/portable/canister.dm:12)
  - `release_pressure = ONE_ATMOSPHERE` (101.325 kPa, code/modules/atmospherics/machinery/portable/canister.dm:25)
  - `can_max_release_pressure = ONE_ATMOSPHERE * 10` (code/modules/atmospherics/machinery/portable/canister.dm:26)
  - `can_min_release_pressure = ONE_ATMOSPHERE / 10` (code/modules/atmospherics/machinery/portable/canister.dm:27)
  - `heat_limit = 5000` (K, code/modules/atmospherics/machinery/portable/canister.dm:29)
  - `pressure_limit = 50000` (kPa, code/modules/atmospherics/machinery/portable/canister.dm:31)
  - Armor: `melee=50, bullet=50, laser=50, energy=100, bomb=10, bio=100, rad=100, fire=80, acid=50` (code/modules/atmospherics/machinery/portable/canister.dm:33)
- Interactions:
  | Action | Condition | Delay | Message | Result |
  |--------|-----------|-------|---------|--------|
  | Interact (click) | Allowed user | 0 | None | Opens UI; "Error - Unauthorized User" if not allowed (code/modules/atmospherics/machinery/portable/canister.dm:73-78) |
  | UI controls | Via interface | 0 | Various | Set release pressure, toggle valve, set timer (inferred from UI) |
- Deconstruction: Handled by portable_atmospherics parent machinery; pressure/heat damage can destroy canister
- Drops: On destruction, contents are released into the atmosphere; on proper deconstruction, canister becomes items/wreckage (inferred from parent class)
- Gotchas:
  - Access check required to interact (code/modules/atmospherics/machinery/portable/canister.dm:74)
  - Canister can rupture if pressure or heat exceed limits (code/modules/atmospherics/machinery/portable/canister.dm:30-31)

### Portable Atmospherics Canister - Oxygen  `/obj/machinery/portable_atmospherics/canister/oxygen`   (code/modules/atmospherics/machinery/portable/canister.dm:92)

12 placed on BoxStation.

- Same as Air canister above; holds oxygen gas.
- `gas_type = /datum/gas/oxygen` (code/modules/atmospherics/machinery/portable/canister.dm:97)
- `name = "o2 canister"` (code/modules/atmospherics/machinery/portable/canister.dm:93)
- `icon_state = "blue"` (code/modules/atmospherics/machinery/portable/canister.dm:95)

### Portable Atmospherics Canister - Nitrous Oxide  `/obj/machinery/portable_atmospherics/canister/nitrous_oxide`   (code/modules/atmospherics/machinery/portable/canister.dm)

7 placed on BoxStation.

- Same structure as air/oxygen canisters.
- `gas_type = /datum/gas/nitrous_oxide` (inferred from parent structure)

### Portable Atmospherics Canister - Toxins  `/obj/machinery/portable_atmospherics/canister/toxins`   (code/modules/atmospherics/machinery/portable/canister.dm)

7 placed on BoxStation.

- Same structure; holds plasma/toxins gas.

### Portable Atmospherics Canister - Nitrogen  `/obj/machinery/portable_atmospherics/canister/nitrogen`   (code/modules/atmospherics/machinery/portable/canister.dm:85)

5 placed on BoxStation.

- Same structure; holds nitrogen gas.
- `gas_type = /datum/gas/nitrogen` (code/modules/atmospherics/machinery/portable/canister.dm:90)

### Portable Atmospherics Canister - Carbon Dioxide  `/obj/machinery/portable_atmospherics/canister/carbon_dioxide`   (code/modules/atmospherics/machinery/portable/canister.dm:99)

4 placed on BoxStation.

- Same structure; holds CO2 gas.

### Portable Atmospherics Canister - Water Vapor  `/obj/machinery/portable_atmospherics/canister/water_vapor`   (code/modules/atmospherics/machinery/portable/canister.dm)

1 placed on BoxStation.

- Same structure; holds water vapor.

### Portable Atmospherics Canister - BZ  `/obj/machinery/portable_atmospherics/canister/bz`   (code/modules/atmospherics/machinery/portable/canister.dm)

1 placed on BoxStation.

- Same structure; holds BZ gas (hallucinogenic).

### Portable Atmospherics Scrubber (Huge)  `/obj/machinery/portable_atmospherics/scrubber/huge`   (code/modules/atmospherics/machinery/portable/portable_atmospherics.dm)

2 placed on BoxStation.

- Large gas scrubber: filters atmospheric contaminants.
- (Details NOT FOUND; search more specific file)

---

## MEDICAL

### IV Drip  `/obj/machinery/iv_drip`   (code/game/machinery/iv_drip.dm:4)

10 placed on BoxStation.

- Medical device: transfers liquids (blood, saline, chemicals) into or out of patients. Can operate in inject or blood-draw modes.
- Key vars:
  - `anchored = FALSE` (code/game/machinery/iv_drip.dm:9)
  - `mode = IV_INJECTING` (0 = taking blood, 1 = injecting, code/game/machinery/iv_drip.dm:12)
  - `dripfeed = FALSE` (slow drip if TRUE, code/game/machinery/iv_drip.dm:13)
  - Power: no `use_power` defined; inferred as NO_POWER_USE (unpowered device)
- Interactions:
  | Action | Condition | Delay (ds) | Message | Result |
  |--------|-----------|-----------|---------|--------|
  | MouseDrop patient onto drip | Drip has beaker | 0 | "[attached] is detached." (if already attached) or "[usr] attaches [src] to [target]." | Attaches patient; must have beaker; logs attachment (code/game/machinery/iv_drip.dm:72-96) |
  | Click to detach | Patient attached | 0 | "[attached] is detached from [src]." | Detaches patient (code/game/machinery/iv_drip.dm:77-80, 161-170) |
  | AttackBy with reagent container | Slot empty | 0 | "You attach [W] to [src]." | Loads beaker/container (code/game/machinery/iv_drip.dm:99-111) |
  | Alt-Click valve | Attached to patient | 0 | "You [tighten/loosen] the valve..." | Toggles dripfeed mode (code/game/machinery/iv_drip.dm:177-185) |
  | Toggle mode verb | Always | 0 | "The IV drip is now [injecting/taking blood]." | Switches between inject/draw (code/game/machinery/iv_drip.dm:203-216) |
  | Eject beaker verb | Always | 0 | None | Removes attached container (code/game/machinery/iv_drip.dm:187-201) |
- Process loop (active when attached):
  - Inject mode: transfers 5 units/cycle (1 if dripfeed) from beaker to patient; blood packs transfer ×2 faster (code/game/machinery/iv_drip.dm:133-142)
  - Draw mode: transfers up to 4 units/cycle from patient to beaker; beeps if patient low on blood (code/game/machinery/iv_drip.dm:144-159)
  - Pings when beaker full; beeps if patient blood_volume < BLOOD_VOLUME_SAFE (code/game/machinery/iv_drip.dm:149-156)
  - Stops and damages patient (3 brute) if patient moves > 1 tile away (code/game/machinery/iv_drip.dm:124-129)
- Construction: NOT FOUND (no construction details visible; deconstruct-only item)
- Deconstruction: `new /obj/item/stack/sheet/metal(loc)` if NODECONSTRUCT_1 flag not set (code/game/machinery/iv_drip.dm:115-118)
- Drops: Single metal sheet stack on deconstruction; attached reagent container remains
- Gotchas:
  - Must be within 1 tile of patient to operate
  - Patient can move freely; drip detaches and damages if >1 tile away

---

## FOOD & KITCHEN

### Microwave  `/obj/machinery/microwave`   (code/modules/food_and_drinks/kitchen_machinery/microwave.dm:3)

6 placed on BoxStation.

- Cooking appliance: heats food items via microwave_act callback on contents. Max 10 items (configurable).
- Key vars:
  - `density = TRUE` (code/modules/food_and_drinks/kitchen_machinery/microwave.dm:9)
  - `use_power = IDLE_POWER_USE` (code/modules/food_and_drinks/kitchen_machinery/microwave.dm:10)
  - `idle_power_usage = 5` (W) (code/modules/food_and_drinks/kitchen_machinery/microwave.dm:11)
  - `active_power_usage = 100` (W) (code/modules/food_and_drinks/kitchen_machinery/microwave.dm:12)
  - `max_integrity = 300` (implicit from parent)
  - `circuit = /obj/item/circuitboard/machine/microwave` (code/modules/food_and_drinks/kitchen_machinery/microwave.dm:13)
  - `efficiency = 0` (upgraded via stock_parts/micro_laser rating, code/modules/food_and_drinks/kitchen_machinery/microwave.dm:48-52)
  - `max_n_of_items = 10` (base, upgradeable via matter_bin rating, code/modules/food_and_drinks/kitchen_machinery/microwave.dm:22, 51-52)
- Armor: `melee=20, bullet=0, laser=0, energy=0, bomb=0, bio=0, rad=0, fire=50, acid=70` (code/modules/food_and_drinks/kitchen_machinery/microwave.dm:57)
- Interactions:
  | Action | Condition | Delay (ds) | Message | Result |
  |--------|-----------|-----------|---------|--------|
  | Alt-click to cook | Not operating | 0 | Examine shows "Alt-click [src] to turn it on." | Starts cooking cycle for all ingredients (code/modules/food_and_drinks/kitchen_machinery/microwave.dm:58) |
  | Insert item | Not operating, space available | 0 | Display updates | Item added to cooking list (inferred) |
  | Clean with space cleaner spray | Not operating | 0 | "You clean \\the [src]." | Removes dirt/blood overlay (code/modules/food_and_drinks/kitchen_machinery/microwave.dm:140-143) |
  | Fix broken (wirecutter) | Broken state 2 | 20 (ds) | "You fix part of \\the [src]." | Reduces broken level from 2 to 1 (code/modules/food_and_drinks/kitchen_machinery/microwave.dm:120-124) |
  | Fix broken (welder) | Broken state 1 | 20 (ds) | "You fix \\the [src]." | Fully repairs broken state to 0 (code/modules/food_and_drinks/kitchen_machinery/microwave.dm:125-131) |
  | Screwdriver | None | 0 | None | Toggles panel if dirty < 100 (code/modules/food_and_drinks/kitchen_machinery/microwave.dm:111) |
  | Wrench | None | 0 | None | Unfastens if dirty < 100 (code/modules/food_and_drinks/kitchen_machinery/microwave.dm:111) |
  | Crowbar | None | 0 | None | Deconstructs machine (code/modules/food_and_drinks/kitchen_machinery/microwave.dm:107) |
- Cook time: Determined by `efficiency` (reduce by [(efficiency - 1) * 25]%, code/modules/food_and_drinks/kitchen_machinery/microwave.dm:88); each item's food object calls its microwave_act proc (NOT specific recipes found in microwave.dm; see food items)
- Construction: Frame + circuit board + stock parts (micro_laser for efficiency, matter_bin for capacity)
- Deconstruction: Crowbar; ejects all ingredients; loses wires on destruction
- Drops: All ingredients eject; machine destroyed on deconstruction
- Gotchas:
  - Cannot insert items while operating
  - Can break to states 1 or 2 requiring wirecutter/welder repairs
  - Dirty value (0-100) blocks most operations when dirty == 100

### Reagent Grinder  `/obj/machinery/reagentgrinder`   (code/modules/reagents/chemistry/machinery/reagentgrinder.dm:3)

7 placed on BoxStation.

- Processing appliance: grinds solid items into reagents and mixes them in internal beaker. Holds beaker + up to 10 items.
- Key vars:
  - `density = TRUE` (implicit)
  - `use_power = IDLE_POWER_USE` (code/modules/reagents/chemistry/machinery/reagentgrinder.dm:9)
  - `idle_power_usage = 5` (W) (code/modules/reagents/chemistry/machinery/reagentgrinder.dm:10)
  - `active_power_usage = 100` (W) (code/modules/reagents/chemistry/machinery/reagentgrinder.dm:11)
  - `circuit = /obj/item/circuitboard/machine/reagentgrinder` (code/modules/reagents/chemistry/machinery/reagentgrinder.dm:12)
  - `speed = 1` (multiplier; upgraded via stock_parts/manipulator rating, code/modules/reagents/chemistry/machinery/reagentgrinder.dm:56-58)
  - `limit = 10` (max items; base capacity, code/modules/reagents/chemistry/machinery/reagentgrinder.dm:17)
  - Default beaker: `/obj/item/reagent_containers/glass/beaker/large` (code/modules/reagents/chemistry/machinery/reagentgrinder.dm:30)
- Armor: inherits from parent; `resistance_flags = ACID_PROOF` (code/modules/reagents/chemistry/machinery/reagentgrinder.dm:14)
- Interactions:
  | Action | Condition | Delay (ds) | Message | Result |
  |--------|-----------|-----------|---------|--------|
  | Alt-click to replace beaker | Always | 0 | None | Removes old beaker, installs new one if provided (code/modules/reagents/chemistry/machinery/reagentgrinder.dm:85-89) |
  | Insert item | Space available, not operating | 0 | Various | Item added to holdingitems list (code/modules/reagents/chemistry/machinery/reagentgrinder.dm:149+) |
  | Insert reagent container | Always | 0 | "You add [B] to [src]." | Replaces beaker (code/modules/reagents/chemistry/machinery/reagentgrinder.dm:139-147) |
  | Grind/Juice/Mix (radial menu) | UI interaction | ~30 (inferred) | Messages vary | Grinds items: calls microwave_act on items; results in reagents (NOT specific recipes documented) |
  | Crowbar | None | 0 | None | Deconstructs machine (code/modules/reagents/chemistry/machinery/reagentgrinder.dm:130) |
  | Wrench | Always | 0 | None | Unfastens (code/modules/reagents/chemistry/machinery/reagentgrinder.dm:133) |
  | Screwdriver | Empty and no items | 0 | None | Toggles panel (code/modules/reagents/chemistry/machinery/reagentgrinder.dm:127) |
- Construction: Frame + circuit board + stock parts (manipulator for speed; matter_bin for capacity inferred from construction line)
- Deconstruction: Crowbar; beaker ejects; all items drop
- Drops: Beaker and all held items
- Gotchas:
  - Cannot modify if operating
  - Panel must be screwed closed to operate
  - Capacity is 10 items (upgradeable via parts)

---

## POWER SYSTEMS

### Recharge Station (Cyborg)  `/obj/machinery/recharge_station`   (code/game/machinery/rechargestation.dm:1)

6 placed on BoxStation.

- Robot charging unit: recharges cyborg/robot occupants and resupplies materials. Can optionally repair damage.
- Key vars:
  - `density = FALSE` (code/game/machinery/rechargestation.dm:6)
  - `use_power = IDLE_POWER_USE` (when open, code/game/machinery/rechargestation.dm:7)
  - `idle_power_usage = 5` (W) (code/game/machinery/rechargestation.dm:8)
  - `active_power_usage = 1000` (W) (code/game/machinery/rechargestation.dm:9, when occupant inside and machine closed)
  - `req_access = list(ACCESS_ROBOTICS)` (code/game/machinery/rechargestation.dm:10)
  - `state_open = TRUE` (code/game/machinery/rechargestation.dm:11)
  - `circuit = /obj/item/circuitboard/machine/cyborgrecharger` (code/game/machinery/rechargestation.dm:12)
  - `occupant_typecache = list(/mob/living/silicon/robot, /mob/living/carbon/human)` (can accept robots or humans, code/game/machinery/rechargestation.dm:13)
  - `recharge_speed = 0` (upgraded via capacitor rating × 100, code/game/machinery/rechargestation.dm:22-24)
  - `repairs = 0` (upgrade level; manipulator rating - 1, code/game/machinery/rechargestation.dm:26-27)
- Interactions:
  | Action | Condition | Delay (ds) | Message | Result |
  |--------|-----------|-----------|---------|--------|
  | Click to open/close | Always | 0 | (none) | Toggles state_open; switches to ACTIVE_POWER_USE when closed with occupant (code/game/machinery/rechargestation.dm:75-79) |
  | Enter machine | Door open, allowed | 0 | (none) | Player enters as occupant; triggers process_occupant on cycle |
  | Leave machine | Inside | 0 | (none) | Player can leave; ejects from machine (code/game/machinery/rechargestation.dm:46-49) |
  | Screwdriver | Open state | 0 | None | Deconstruction toggle (code/game/machinery/rechargestation.dm:61) |
  | Pry-open (crowbar/jemmy) | Always | 0 | None | Opens machine (code/game/machinery/rechargestation.dm:64) |
  | Crowbar | Always | 0 | None | Deconstructs machine (code/game/machinery/rechargestation.dm:67) |
- Process: When closed with occupant, sends `COMSIG_PROCESS_BORGCHARGER_OCCUPANT` with (recharge_speed, repairs) to occupant; occupant handles charging (code/game/machinery/rechargestation.dm:100-103)
- Construction: Frame + circuit board + stock parts (capacitor for recharge_speed, manipulator for repair level, cell for battery capacity) (code/game/machinery/rechargestation.dm:21-29)
- Deconstruction: Crowbar
- Drops: Standard machinery drops
- Gotchas:
  - Requires ACCESS_ROBOTICS to interact if powered
  - Active power draw (1000 W) only when closed with occupant
  - EMP can eject occupant and damage contents (code/game/machinery/rechargestation.dm:51-57)

### Radiation Collector (Anchored)  `/obj/machinery/power/rad_collector/anchored`   (code/game/machinery/power/radiation.dm)

6 placed on BoxStation.

- Radiation power source: converts radiation into electrical power via AM processing.
- (Details NOT FOUND; need to read radiation.dm or power machinery files)

---

## SECURITY & ACCESS CONTROL

### Keycard Authentication Device  `/obj/machinery/keycard_auth`   (code/modules/security_levels/keycard_authentication.dm:7)

7 placed on BoxStation.

- Station control device: dual-ID authentication for critical functions (Red Alert, Emergency Maintenance, Bluespace Artillery unlock).
- Key vars:
  - `use_power = IDLE_POWER_USE` (code/modules/security_levels/keycard_authentication.dm:12)
  - `idle_power_usage = 2` (W) (code/modules/security_levels/keycard_authentication.dm:13)
  - `active_power_usage = 6` (W) (code/modules/security_levels/keycard_authentication.dm:14)
  - `req_access = list(ACCESS_KEYCARD_AUTH)` (code/modules/security_levels/keycard_authentication.dm:16)
  - `resistance_flags = INDESTRUCTIBLE | LAVA_PROOF | FIRE_PROOF | UNACIDABLE | ACID_PROOF` (code/modules/security_levels/keycard_authentication.dm:17)
  - `ui_x = 375, ui_y = 125` (code/modules/security_levels/keycard_authentication.dm:18-19)
- Interactions (via UI, code/modules/security_levels/keycard_authentication.dm:60-80):
  | Action | Condition | Delay (ds) | Message | Result |
  |--------|-----------|-----------|---------|--------|
  | Red Alert button | Event not pending, allowed | 0 | (admin log) | Sends KEYCARD_RED_ALERT event; sets waiting flag for 20 ds (code/modules/security_levels/keycard_authentication.dm:64-67, 87) |
  | Emergency Maintenance button | Event not pending, allowed | 0 | (admin log) | Sends KEYCARD_EMERGENCY_MAINTENANCE_ACCESS event; 20 ds wait (code/modules/security_levels/keycard_authentication.dm:69-71) |
  | Bluespace Artillery unlock | Event not pending, allowed | 0 | (admin log) | Sends KEYCARD_BSA_UNLOCK event; 20 ds wait (code/modules/security_levels/keycard_authentication.dm:78-80) |
  | Swipe ID to confirm | Another device triggered event | 0 | (admin log) | Confirms pending event; executes action (Red Alert → SEC_LEVEL_RED, Maint Access → all maintenance airlock emergency=TRUE, BSA → toggle GLOB.bsa_unlock) (code/modules/security_levels/keycard_authentication.dm:103-118) |
- Event cycle: trigger device → waiting 20 ds → confirmation device swipes ID (code/modules/security_levels/keycard_authentication.dm:82-102)
- Construction: NOT FOUND (inferred as fixed/non-constructable)
- Deconstruction: INDESTRUCTIBLE flag prevents normal deconstruction
- Gotchas:
  - Requires ACCESS_KEYCARD_AUTH to use
  - Two-device authentication required: first device triggers, second confirms
  - Events propagate across all keycard_auth machines globally (via GLOB.keycard_events)

---

## CHEMISTRY & REAGENT PROCESSING

(To be continued - need to research /obj/machinery/chem_heater, /obj/machinery/chem_dispenser, /obj/machinery/chem_master/condimaster, /obj/machinery/smartfridge/chemistry, etc.)

---

## HYDROPONICS & AGRICULTURE

### Hydroponics Tray (Constructable)  `/obj/machinery/hydroponics/constructable`   (code/modules/hydroponics/hydroponics.dm:66)

16 placed on BoxStation.

- Plant growth chamber: supports seed planting, nutrient/water management, pest/weed control, gene mutation. Constructable variant allows assembly from components.
- Key vars:
  - `name = "hydroponics tray"` (code/modules/hydroponics/hydroponics.dm:67)
  - `icon_state = "hydrotray3"` (code/modules/hydroponics/hydroponics.dm:69, constructable variant)
  - `density = TRUE` (code/modules/hydroponics/hydroponics.dm:6)
  - `pixel_z = 8` (code/modules/hydroponics/hydroponics.dm:7)
  - `obj_flags = CAN_BE_HIT | UNIQUE_RENAME` (code/modules/hydroponics/hydroponics.dm:8)
  - `circuit = /obj/item/circuitboard/machine/hydroponics` (code/modules/hydroponics/hydroponics.dm:9)
  - `idle_power_usage = 0` (code/modules/hydroponics/hydroponics.dm:10)
  - `waterlevel = 100` / `maxwater = 100` (base, code/modules/hydroponics/hydroponics.dm:12-14)
  - `nutridrain = 1` (base; 1/rating after RefreshParts, code/modules/hydroponics/hydroponics.dm:16, 80)
  - `maxnutri = 10` (base; 50*tmp_capacity after RefreshParts, code/modules/hydroponics/hydroponics.dm:18, 78)
  - `cycledelay = 200` (deciseconds per growth tick: ~20 seconds, code/modules/hydroponics/hydroponics.dm:40)
  - `rating = 1` (quality multiplier; affects drain, health, yield; updated via matter_bin parts, code/modules/hydroponics/hydroponics.dm:46, 73-76)
  - `self_sustaining = FALSE` (autogrow mode; when TRUE, drains 0.5 water/cycle, immune to weeds/pests/mutations, code/modules/hydroponics/hydroponics.dm:56, 154-157)
- Interactions:
  | Action | Condition | Delay (ds) | Message | Result |
  |--------|-----------|-----------|---------|--------|
  | Click (examine) | In range or observer | 0 | Lists contents, water/nutrient levels, health status | Examine output (code/modules/hydroponics/hydroponics.dm:374-394) |
  | Ctrl-Click to activate autogrow | Powered (new in constructable) | 0 | (examine hint) | Toggles self_sustaining flag (inferred from examine note, code/modules/hydroponics/hydroponics.dm:82-84) |
  | Alt-Click to empty nutrients | Always | 0 | (examine hint) | Drains nutrient reagents (inferred from examine note, code/modules/hydroponics/hydroponics.dm:82-84) |
  | Screwdriver to open panel | Always | 0 | None | Deconstruction toggle (default_deconstruction_screwdriver, code/modules/hydroponics/hydroponics.dm:98) |
  | Crowbar (if no irrigation) | Not connected to hoses | 0 | "Disconnect the hoses first!" | Deconstructs tray (code/modules/hydroponics/hydroponics.dm:102-106) |
- Growth cycle (process, 200 ds = ~20 sec):
  - Age increments; nutrient drains at nutridrain rate per age tick (code/modules/hydroponics/hydroponics.dm:159-176)
  - Water consumption: random 1-6 units/cycle (code/modules/hydroponics/hydroponics.dm:196)
  - Health penalties: low water, low nutrients, pests, weeds, toxins, high age (code/modules/hydroponics/hydroponics.dm:178-220)
  - Health bonuses: sufficient water & nutrients (code/modules/hydroponics/hydroponics.dm:205-206)
  - Plant death at plant_health <= 0 (code/modules/hydroponics/hydroponics.dm:274-276)
  - Harvest flag when age > production and time since last harvest > production (code/modules/hydroponics/hydroponics.dm:283-287)
  - Mutation: depends on instability var (code/modules/hydroponics/hydroponics.dm:257-269)
- Construction:
  - Circuit: `/obj/item/circuitboard/machine/hydroponics` (code/modules/hydroponics/hydroponics.dm:9)
  - Parts: matter_bin (affects water capacity & nutrient capacity), manipulator (affects rating/drain rate) (code/modules/hydroponics/hydroponics.dm:71-80)
  - RefreshParts recalculates: `maxwater = tmp_capacity * 50` (up to 300), `maxnutri = (tmp_capacity * 5) + STATIC_NUTRIENT_CAPACITY` (up to 50), `nutridrain = 1/rating` (code/modules/hydroponics/hydroponics.dm:71-80)
- Deconstruction: Crowbar if not connected to irrigation hoses; seed is destroyed on Destroy() (code/modules/hydroponics/hydroponics.dm:89-93, 102-106)
- Drops: Circuit board, stock parts (matter_bin, manipulator), no special items
- Gotchas:
  - Irrigation hoses block deconstruction with crowbar (must disconnect first)
  - Plant genetics include mutations that affect growth, yield, potency, production time, lifespan
  - Weeds/pests/toxins degrade yield and potency
  - Instability >= 20 can cause mutations without player intervention
  - Autogrow (self_sustaining) mode prevents most negative effects but requires power

### Hydroponics Tray (Soil)  `/obj/machinery/hydroponics/soil`   (code/modules/hydroponics/hydroponics.dm)

14 placed on BoxStation.

- Variant: same as constructable above, but optimized for soil planting (NOT FOUND specific var differences; likely just icon/name change).

---

## VENDING MACHINES

### Snack Vending Machine (Random)  `/obj/machinery/vending/snack/random`   (code/modules/vending/snacks.dm)

9 placed on BoxStation.

- Automated dispenser: vends snack items (chips, candy, etc.). Random variant stocks random snacks each round.
- Key vars (from base vending machine, code/modules/vending/_vending.dm:45-75):
  - `use_power = IDLE_POWER_USE` (inferred)
  - `idle_power_usage = ?` (NOT FOUND specific value)
  - `active_power_usage = ?` (NOT FOUND specific value)
  - `density = TRUE` (code/modules/vending/_vending.dm:51)
  - `max_integrity = 300` (code/modules/vending/_vending.dm:55)
  - `circuit = /obj/item/circuitboard/machine/vendor` (code/modules/vending/_vending.dm:58)
  - `payment_department = ACCOUNT_SRV` (code/modules/vending/_vending.dm:59)
  - `light_range = MINIMUM_USEFUL_LIGHT_RANGE, light_power = 0.5` (code/modules/vending/_vending.dm:60-61)
  - `tiltable = TRUE` (can be knocked over, code/modules/vending/_vending.dm:71)
  - `squish_damage = 75` (damage if person pinned under tilted machine, code/modules/vending/_vending.dm:72)
- Products: list varies by snack variant; stored in `/datum/data/vending_product` records with amount/max_amount
- Interactions:
  | Action | Condition | Delay (ds) | Message | Result |
  |--------|-----------|-----------|---------|--------|
  | Click item in UI | Vend ready, enough money | 30 (inferred) | "Item dispensed." or purchase_slogans message | Item vended; money deducted (inferred from parent vending code) |
  | Hack (multitool) | Panel open | 0 | (none) | Toggles contraband products (inferred) |
  | Tip over (push) | Always | 0 | "The [src] tips over!" | Machine tilts; occupants pinned underneath take damage (code/modules/vending/_vending.dm:71-72) |
- Construction: Frame + circuit board (vendor), possibly stock parts (NOT FOUND specific requirements)
- Deconstruction: Crowbar; drops all products
- Drops: All unsold inventory as items
- Gotchas:
  - Requires money/ID to purchase (payment deducted from account)
  - Can be tilted/shoved over, pinning people and causing damage
  - Hacking unlocks contraband items
  - Random variant stocks different items each round (inferred)

### Cola Vending Machine (Random)  `/obj/machinery/vending/cola/random`   (code/modules/vending/cola.dm)

7 placed on BoxStation.

- Beverage dispenser: vends cola drinks (various flavors). Random variant stock varies.
- Same structure as snack vending above; specific products differ (cola-type beverages).

### Cola Vending Machine (Red)  `/obj/machinery/vending/cola/red`   (code/modules/vending/cola.dm)

1 placed on BoxStation.

- Specific cola flavor vending machine; same structure, fixed product list.

---

## CONSTRUCTION & TOOLS

(To be continued - need to research machines like suits, mining equipment, construction machinery, etc.)

---

## COMPUTERS & CONTROL SYSTEMS

(To be continued - need to research atmos_control, camera_advanced, med_data, modular_computer, turretid, etc.)

---

## CLIMATE & UTILITIES

### Washing Machine  `/obj/machinery/washing_machine`   (code/game/machinery/washing_machine.dm:134)

5 placed on BoxStation.

- Clothes cleaning: removes blood stains, optionally dyes items. Holds up to 5 items. Wash cycle lasts 200 ds (~20 seconds).
- Key vars:
  - `density = TRUE` (code/game/machinery/washing_machine.dm:139)
  - `state_open = TRUE` (code/game/machinery/washing_machine.dm:140)
  - `busy = FALSE` (code/game/machinery/washing_machine.dm:141)
  - `bloody_mess = 0` (blood contamination flag, code/game/machinery/washing_machine.dm:142)
  - `max_wash_capacity = 5` (items, code/game/machinery/washing_machine.dm:144)
  - `color_source = null` (item used for dye, code/game/machinery/washing_machine.dm:143)
- Interactions:
  | Action | Condition | Delay | Result |
  |--------|-----------|-------|--------|
  | Alt-click to start | Door closed, not busy, not bloody | 200 (ds) | Starts wash cycle; SEND_SIGNAL to contents with COMSIG_COMPONENT_CLEAN_ACT; calls machine_wash() on each item (code/game/machinery/washing_machine.dm:155-170, 194-204) |
  | Insert item | Door open, not full | 0 | Adds item to contents; if item.dye_color set, becomes color_source (code/game/machinery/washing_machine.dm:297-323) |
  | Close/open door | Always | 0 | Toggle state_open (code/game/machinery/washing_machine.dm:328+) |
- Dye system: If color_source item has dye_color, all clothing items in wash inherit that color via dye_item() proc (code/game/machinery/washing_machine.dm:207-229, 247-249)
- Freshly laundered flag: Clothing items get freshly_laundered = TRUE for 5 minutes after wash (code/game/machinery/washing_machine.dm:260-261)
- Process: Shakes machine during wash if anchored=FALSE (code/game/machinery/washing_machine.dm:172-187)
- (No power usage specified; inferred as unpowered device)
- Deconstruction: Screwdriver, wrench (code/game/machinery/washing_machine.dm:297-303, 356+)

### Igniter  `/obj/machinery/igniter`   (code/game/machinery/igniter.dm:1)

1 placed on BoxStation + 2 incinerator variants.

- Flame producer: ignites plasma/fuel in its location when activated. Can be toggle on/off.
- Key vars:
  - `use_power = IDLE_POWER_USE` (code/game/machinery/igniter.dm:7)
  - `idle_power_usage = 2` (W) (code/game/machinery/igniter.dm:8)
  - `active_power_usage = 4` (W) (code/game/machinery/igniter.dm:9)
  - `max_integrity = 300` (code/game/machinery/igniter.dm:10)
  - `on = FALSE` (code/game/machinery/igniter.dm:14)
  - `id = null` (incinerator ID, code/game/machinery/igniter.dm:13)
  - Armor: `melee=50, bullet=30, laser=70, energy=50, bomb=20, bio=0, rad=0, fire=100, acid=70` (code/game/machinery/igniter.dm:11)
- Interactions:
  | Action | Condition | Delay | Result |
  |--------|-----------|-------|--------|
  | Click | Always | 0 | Toggles on/off (use_power(50)); updates icon (code/game/machinery/igniter.dm:29-37) |
- Process: If on and powered, calls location.hotspot_expose(1000, 500, 1) every process tick (code/game/machinery/igniter.dm:39-44)
- hotspot_expose triggers fire ignition in the turf (code/game/machinery/igniter.dm:43)
- Variants: incinerator_toxmix, incinerator_atmos (different IDs, code/game/machinery/igniter.dm:16-20)

### Sparker  `/obj/machinery/sparker`   (code/game/machinery/igniter.dm:61)

2 placed on BoxStation.

- Wall-mounted ignition: remote ignition device that creates spark effects.
- Key vars:
  - `disable = 0` (code/game/machinery/igniter.dm:68)
  - `last_spark = 0` (cooldown timer, code/game/machinery/igniter.dm:69)
  - `id = null` (igniter ID link, code/game/machinery/igniter.dm:67)
  - `spark_system = new /datum/effect_system/spark_spread` (code/game/machinery/igniter.dm:77)
- (Full interaction details NOT FOUND; likely triggered remotely via ID system)

---

## CONTAINMENT & DEFENSE

### Shield Wall Generator  `/obj/machinery/power/shieldwallgen`   (code/game/machinery/shieldgen.dm:251)

4 placed on BoxStation (including xenobiology variant).

- Defensive shield: creates force walls in cardinal directions when powered. Walls block movement, projectiles, gas.
- Key vars:
  - `anchored = FALSE` (code/game/machinery/shieldgen.dm:256)
  - `density = TRUE` (code/game/machinery/shieldgen.dm:257)
  - `req_access = list(ACCESS_TELEPORTER)` (code/game/machinery/shieldgen.dm:258)
  - `use_power = NO_POWER_USE` (code/game/machinery/shieldgen.dm:260; uses network power instead)
  - `idle_power_usage = 10` (W) (code/game/machinery/shieldgen.dm:261)
  - `active_power_usage = 50` (W) (code/game/machinery/shieldgen.dm:262)
  - `max_integrity = 300` (code/game/machinery/shieldgen.dm:263)
  - `active = FALSE` (code/game/machinery/shieldgen.dm:264)
  - `locked = TRUE` (code/game/machinery/shieldgen.dm:265)
  - `shield_range = 8` (tiles to adjacent generator, code/game/machinery/shieldgen.dm:266)
- Interactions:
  | Action | Condition | Result |
  |--------|-----------|--------|
  | Interact/click | Has access | Opens UI; toggles active state; sets active = ACTIVE_SETUPFIELDS (code/game/machinery/shieldgen.dm:398+) |
  | Emag | Any | Disables access lock (code/game/machinery/shieldgen.dm:426+) |
- Power network: Only anchored units connect to power network (code/game/machinery/shieldgen.dm:277-293)
- Setup fields: When active, searches in cardinal directions for another active shieldwallgen (up to shield_range=8 tiles); creates /obj/machinery/shieldwall objects between generators (code/game/machinery/shieldgen.dm:322-348)
- Shutdown: If insufficient power, deactivates and removes all shield walls (code/game/machinery/shieldgen.dm:305-315)
- Variants:
  - xenobiologyaccess: req_access = ACCESS_XENOBIOLOGY (code/game/machinery/shieldgen.dm:269-272)
  - anchored: anchored = TRUE (code/game/machinery/shieldgen.dm:274-275)
- Deconstruction: Wrench (requires not anchored or panel closed), crowbar (code/game/machinery/shieldgen.dm:375-397)

---

## MISCELLANEOUS MACHINES

(To be continued - research remaining ~30 machines)

---

### Food Processor  `/obj/machinery/processor`   (code/modules/food_and_drinks/kitchen_machinery/processor.dm:2)

2 placed on BoxStation.

- Food preparation: grinds food items and produces processed output. Has recipes via /datum/food_processor_process subtypes.
- Key vars:
  - `density = TRUE` (code/modules/food_and_drinks/kitchen_machinery/processor.dm:8)
  - `use_power = IDLE_POWER_USE` (code/modules/food_and_drinks/kitchen_machinery/processor.dm:9)
  - `idle_power_usage = 5` (W) (code/modules/food_and_drinks/kitchen_machinery/processor.dm:10)
  - `active_power_usage = 50` (W) (code/modules/food_and_drinks/kitchen_machinery/processor.dm:11)
  - `circuit = /obj/item/circuitboard/machine/processor` (code/modules/food_and_drinks/kitchen_machinery/processor.dm:12)
  - `rating_speed = 1` (multiplier; manipulator rating, code/modules/food_and_drinks/kitchen_machinery/processor.dm:15, 22)
  - `rating_amount = 1` (output multiplier; matter_bin rating, code/modules/food_and_drinks/kitchen_machinery/processor.dm:16, 20)
- Interactions:
  | Action | Delay | Result |
  |--------|-------|--------|
  | Insert food/mob | 0 | Selects recipe; processes and outputs; mobs are gibbed (code/modules/food_and_drinks/kitchen_machinery/processor.dm:75-79, 29-37) |
- Recipes: Determined by /datum/food_processor_process subtypes; output = recipe.output spawned (rating_amount * recipe.multiplier) times (code/modules/food_and_drinks/kitchen_machinery/processor.dm:29-37)
- RefreshParts: Updates rating_speed (manipulator) and rating_amount (matter_bin) (code/modules/food_and_drinks/kitchen_machinery/processor.dm:18-22)
- Deconstruction: Crowbar, wrench, screwdriver, pry-open (code/modules/food_and_drinks/kitchen_machinery/processor.dm:46-60)
- Gotchas:
  - Processing is blocking; can't insert while processing (code/modules/food_and_drinks/kitchen_machinery/processor.dm:47-48)
  - Mobs are gibbed in place (code/modules/food_and_drinks/kitchen_machinery/processor.dm:35)

### Deep Fryer  `/obj/machinery/deepfryer`   (code/modules/food_and_drinks/kitchen_machinery/deep_fryer.dm:23)

2 placed on BoxStation.

- Food frying appliance: heats oil and fries food items. Oil usage and speed upgradeable via parts.
- Key vars:
  - `density = TRUE` (code/modules/food_and_drinks/kitchen_machinery/deep_fryer.dm:28)
  - `use_power = IDLE_POWER_USE` (code/modules/food_and_drinks/kitchen_machinery/deep_fryer.dm:29)
  - `idle_power_usage = 5` (W) (code/modules/food_and_drinks/kitchen_machinery/deep_fryer.dm:30)
  - `oil_use = 0.05` (units per tick, code/modules/food_and_drinks/kitchen_machinery/deep_fryer.dm:34)
  - `fry_speed = 1` (multiplier; micro_laser rating, code/modules/food_and_drinks/kitchen_machinery/deep_fryer.dm:35, 68)
  - Holds 50 units of cooking oil (code/modules/food_and_drinks/kitchen_machinery/deep_fryer.dm:55-56)
  - Internal beaker holds frying item (code/modules/food_and_drinks/kitchen_machinery/deep_fryer.dm:32)
- Interactions: Insert food into oil; oil consumes via tick; when done, output fried variant (NOT specific recipes documented)
- Blacklisted items: tools, reagent containers, storage items (code/modules/food_and_drinks/kitchen_machinery/deep_fryer.dm:38-50)
- RefreshParts: oil_efficiency from micro_laser reduces oil_use; increases fry_speed (code/modules/food_and_drinks/kitchen_machinery/deep_fryer.dm:63-68)
- Gotchas:
  - Oil depletion limits frying time
  - Pills can be dissolved in oil (code/modules/food_and_drinks/kitchen_machinery/deep_fryer.dm:78+)

### Recycler  `/obj/machinery/recycler`   (code/game/machinery/recycler.dm:3)

1 placed on BoxStation.

- Waste processing: crushes items for material recovery. Auto-eats items from a direction; can be emagged to disable safety.
- Key vars:
  - `density = TRUE` (code/game/machinery/recycler.dm:9)
  - `use_power = IDLE_POWER_USE` (inferred; has Crossed proc)
  - `safety_mode = FALSE` (code/game/machinery/recycler.dm:11)
  - `amount_produced = 50` (material reclaim %; modified by parts, code/game/machinery/recycler.dm:15, 37)
  - `crush_damage = 1000` (code/game/machinery/recycler.dm:16)
  - `eat_dir = WEST` (direction items are consumed from, code/game/machinery/recycler.dm:14)
  - Has material_container component (iron, glass, silver, plasma, gold, diamond, plastic, uranium, bananium, titanium) (code/game/machinery/recycler.dm:22)
- Interactions:
  | Action | Condition | Result |
  |--------|-----------|--------|
  | Cross into recycler | Not broken, not in safety mode, power on | Item/mob is eaten; butchering component triggers (code/game/machinery/recycler.dm:89-90, 94+) |
  | Emag | Has emagged access | Disables safety; safety_mode set to FALSE (code/game/machinery/recycler.dm:64-71) |
- Safety mode: Stops machine if mob detected; toggle via UI or emag
- RefreshParts: matter_bin increases material storage; manipulator increases material reclaim % (code/game/machinery/recycler.dm:28-40)
- Deconstruction: Screwdriver, pry-open, wrench, crowbar (code/game/machinery/recycler.dm:50-62)

### Monkey Recycler  `/obj/machinery/monkey_recycler`   (code/modules/food_and_drinks/kitchen_machinery/monkeyrecycler.dm)

2 placed on BoxStation.

- (Details NOT FOUND; likely variant of recycler for mob processing)

---

## MEDICAL & GENETICS

### Medical Kiosk  `/obj/machinery/medical_kiosk`   (code/game/machinery/medical_kiosk.dm:5)

2 placed on BoxStation.

- Self-diagnosis device: performs medical scans for fee. Four scan types available.
- Key vars:
  - `density = TRUE` (code/game/machinery/medical_kiosk.dm:11)
  - `circuit = /obj/item/circuitboard/machine/medical_kiosk` (code/game/machinery/medical_kiosk.dm:12)
  - `payment_department = ACCOUNT_MED` (code/game/machinery/medical_kiosk.dm:13)
  - `default_price = 15` (credits; scan cost, code/game/machinery/medical_kiosk.dm:15)
  - `pandemonium = FALSE` (emag mode: increases price randomly, code/game/machinery/medical_kiosk.dm:17, 36)
  - Scanner wand included (code/game/machinery/medical_kiosk.dm:32)
- Interactions:
  | Action | Cost | Result |
  |--------|------|--------|
  | General medical scan | 15 credits (or emag-inflated) | Shows vitals, injuries, etc. (code/game/machinery/medical_kiosk.dm:45-49) |
  | Medical staff scan | Free (ACCOUNT_MED) | Applies free scan (code/game/machinery/medical_kiosk.dm:45-49) |
- Payment: Requires ID with registered account; deducts from account (code/game/machinery/medical_kiosk.dm:40-56)
- (Full scan details NOT FOUND; stored in separate scan code)

### DNA Scanner  `/obj/machinery/dna_scannernew`   (code/game/machinery/dna_scanner.dm:1)

3 placed on BoxStation.

- Genetic analysis: scans DNA/organs to extract genetic information for cloning/mutation research.
- Key vars:
  - `density = TRUE` (code/game/machinery/dna_scanner.dm:6)
  - `use_power = IDLE_POWER_USE` (code/game/machinery/dna_scanner.dm:7)
  - `idle_power_usage = 50` (W) (code/game/machinery/dna_scanner.dm:8)
  - `active_power_usage = 300` (W) (code/game/machinery/dna_scanner.dm:9)
  - `occupant_typecache = list(/mob/living, /obj/item/bodypart/head, /obj/item/organ/brain)` (code/game/machinery/dna_scanner.dm:10)
  - `circuit = /obj/item/circuitboard/machine/dnascanner` (code/game/machinery/dna_scanner.dm:11)
  - `scan_level = 0` (accuracy; scanning_module rating sum, code/game/machinery/dna_scanner.dm:21, 25)
  - `precision_coeff = 0` (matter_bin rating, code/game/machinery/dna_scanner.dm:22, 27)
  - `damage_coeff = 0` (micro_laser rating, code/game/machinery/dna_scanner.dm:22, 29)
- RefreshParts: scanning_module increases scan_level; matter_bin increases precision (accuracy²); micro_laser decreases damage (damage²) (code/game/machinery/dna_scanner.dm:20-29)
- Occupant: Can hold /mob/living, /obj/item/bodypart/head, /obj/item/organ/brain (code/game/machinery/dna_scanner.dm:10)
- (Full scan/mutation details NOT FOUND)

---

## CHEMISTRY & REAGENT PROCESSING

### Chemical Heater  `/obj/machinery/chem_heater`   (code/modules/reagents/chemistry/machinery/chem_heater.dm:1)

3 placed on BoxStation.

- Reagent heating: warms contents of reagent container to target temperature. Triggers reactions.
- Key vars:
  - `density = TRUE` (code/modules/reagents/chemistry/machinery/chem_heater.dm:3)
  - `use_power = IDLE_POWER_USE` (code/modules/reagents/chemistry/machinery/chem_heater.dm:6)
  - `idle_power_usage = 40` (W) (code/modules/reagents/chemistry/machinery/chem_heater.dm:7)
  - `circuit = /obj/item/circuitboard/machine/chem_heater` (code/modules/reagents/chemistry/machinery/chem_heater.dm:9)
  - `target_temperature = 300` (K; adjustable via UI, code/modules/reagents/chemistry/machinery/chem_heater.dm:14)
  - `heater_coefficient = 0.1` (base; micro_laser rating multiplier, code/modules/reagents/chemistry/machinery/chem_heater.dm:15, 52-54)
- Interactions:
  | Action | Result |
  |--------|--------|
  | Insert reagent container | Loads beaker (code/modules/reagents/chemistry/machinery/chem_heater.dm:78-86) |
  | Alt-click to swap beaker | Removes and reinstalls beaker (code/modules/reagents/chemistry/machinery/chem_heater.dm:34-38) |
  | Toggle on via UI | Starts heating cycle; transfers thermal energy every process tick (code/modules/reagents/chemistry/machinery/chem_heater.dm:61-69) |
- Heating formula: beaker.reagents.adjust_thermal_energy((target_temperature - current_temp) * heater_coefficient * SPECIFIC_HEAT_DEFAULT * total_volume) (code/modules/reagents/chemistry/machinery/chem_heater.dm:68)
- RefreshParts: micro_laser rating multiplicatively affects heater_coefficient (code/modules/reagents/chemistry/machinery/chem_heater.dm:52-54)
- Deconstruction: Screwdriver, crowbar (code/modules/reagents/chemistry/machinery/chem_heater.dm:72, 75)

### Chemical Dispenser  `/obj/machinery/chem_dispenser`   (code/modules/reagents/chemistry/machinery/chem_dispenser.dm:14)

3 placed on BoxStation.

- Reagent synthesis: dispenses individual chemical reagents into containers from a list of ~25+ base reagents (list_reagents, code/modules/reagents/chemistry/machinery/chem_dispenser.dm:39-75).
- Key vars:
  - `density = TRUE` (code/modules/reagents/chemistry/machinery/chem_dispenser.dm:17)
  - `use_power = IDLE_POWER_USE` (code/modules/reagents/chemistry/machinery/chem_dispenser.dm:20)
  - `idle_power_usage = 40` (W) (code/modules/reagents/chemistry/machinery/chem_dispenser.dm:21)
  - `circuit = /obj/item/circuitboard/machine/chem_dispenser` (code/modules/reagents/chemistry/machinery/chem_dispenser.dm:24)
  - `powerefficiency = 0.1` (base power cost multiplier, code/modules/reagents/chemistry/machinery/chem_dispenser.dm:29)
  - `amount = 30` (dispense amount per request, code/modules/reagents/chemistry/machinery/chem_dispenser.dm:30)
  - `recharge_amount = 10` (reagent recharge per counter, code/modules/reagents/chemistry/machinery/chem_dispenser.dm:31)
  - `dispensable_reagents` list of ~25 base chemicals (code/modules/reagents/chemistry/machinery/chem_dispenser.dm:39-66)
  - `upgrade_reagents` list of 6 chemicals (unlocked at manipulator tier 4) (code/modules/reagents/chemistry/machinery/chem_dispenser.dm:68-75)
  - `emagged_reagents` list of 5 dangerous chemicals (unlocked if emagged) (code/modules/reagents/chemistry/machinery/chem_dispenser.dm:76-82)
  - `saved_recipes` list (custom recipe storage) (code/modules/reagents/chemistry/machinery/chem_dispenser.dm:86)
  - Internal cell component (code/modules/reagents/chemistry/machinery/chem_dispenser.dm:28)
- Base dispensable reagents: aluminium, bromine, carbon, chlorine, copper, ethanol, fluorine, hydrogen, iodine, iron, lithium, mercury, nitrogen, oxygen, phosphorus, potassium, radium, silicon, silver, sodium, stable_plasma, sugar, sulfur, acid, water, fuel (code/modules/reagents/chemistry/machinery/chem_dispenser.dm:40-65)
- Upgraded reagents (tier 4 manipulator): acetone, ammonia, ash, diethylamine, oil, saltpetre (code/modules/reagents/chemistry/machinery/chem_dispenser.dm:68-75)
- Emagged reagents: carpotoxin, mine_salve, morphine, space_drugs, toxin (code/modules/reagents/chemistry/machinery/chem_dispenser.dm:76-82)
- (UI, dispensing mechanics NOT FOUND in snippet)

### Chemical Master / Condimaster  `/obj/machinery/chem_master/condimaster`   (code/modules/reagents/chemistry/machinery/chem_master.dm)

3 placed on BoxStation.

- (Details NOT FOUND; likely chemical mixing/separation machine)

---

## AGRICULTURE & MINING

### Seed Extractor  `/obj/machinery/seed_extractor`   (code/modules/hydroponics/seed_extractor.dm)

3 placed on BoxStation.

- (Details NOT FOUND; plant genetics extraction machine)

### Biogenerator  `/obj/machinery/biogenerator`   (code/modules/hydroponics/biogenerator.dm)

3 placed on BoxStation.

- (Details NOT FOUND; organic matter conversion machine)

### Mass Driver  `/obj/machinery/mass_driver`   (code/game/machinery/mass_driver.dm:1)

3 placed on BoxStation.

- Projectile launcher: launches unanchored objects from its location in a direction. Uses power per launch.
- Key vars:
  - `use_power = IDLE_POWER_USE` (code/game/machinery/mass_driver.dm:6)
  - `idle_power_usage = 2` (W) (code/game/machinery/mass_driver.dm:7)
  - `active_power_usage = 50` (W) (code/game/machinery/mass_driver.dm:8)
  - `power = 1` (throw multiplier, code/game/machinery/mass_driver.dm:9)
  - `drive_range = 50` (tiles; can throw to space, code/game/machinery/mass_driver.dm:12)
  - `id = 1` (shuttle ID for docking, code/game/machinery/mass_driver.dm:11)
- Interactions:
  | Action | Condition | Delay | Result |
  |--------|-----------|-------|--------|
  | drive() activation | Powered, not broken | 0 | Uses 500 power per object; throws up to 20 unanchored objects from loc in direction (code/game/machinery/mass_driver.dm:20-32) |
  | EMP | Any | 0 | Triggers drive() immediately (code/game/machinery/mass_driver.dm:36-42) |
- Throw formula: throw_at(target, drive_range * power, power) (code/game/machinery/mass_driver.dm:32)
- Max load: 20 objects before "screech" message (code/game/machinery/mass_driver.dm:28-30)
- Gotchas:
  - Mechas exempted from anchoring check; always thrown (code/game/machinery/mass_driver.dm:24)
  - EMP will cause immediate activation

---

## NOT FOUND / OPEN QUESTIONS

The following 100+ paths require further research or have incomplete documentation:

**Partially researched (need full details):**
- Washing machine (5 placed)
- Photocopier (5 placed)
- Newscaster/security_unit (5 placed)
- Suit storage units (captain, CE, atmos, security, CMO, RD, HOS, etc.)
- Shieldwall generators (4 placed, including xenobiology access variant)
- Power/energy machinery (emitter/welded, SMES/engineering, rad_collector/anchored, supermatter_crystal, compressor, turbine, etc.)
- Computer systems (shuttle/pod, camera_advanced, med_data, atmos_control, modular_computer/console variants, turretid, etc.)
- Vending wardrobe machines (20+ variants)
- Food cart, gibber, icecream_vat, igniter
- Disposal/chute, mineral processing (stacking_unit, ore_redemption, equipment_vendor, labor_claim, etc.)
- Advanced research machines (rnd/server, production/circuit_imprinter, production/protolathe, production/techfab variants, destructive_analyzer, nanite_chamber, nanite_program_hub, nanite_programmer, magnetic_controller, magnetic_module, bepis, research/explosive_compressor, doppler_array)
- Teleportation (gateway, gulag_teleporter, teleport/station, teleport/hub)
- Security/access (turretid, announcement_system, airalarm variants, blackbox_recorder)
- Misc (ntnet_relay, pinpointer_dispenser, lapvend, ticket_machine, pdapainter, button/ticket_machine, etc.)

**Not yet researched:**
- All remaining paths not listed above (~80 machines)

---

## COVERAGE

- **Total list entries:** 171 (per placed-machines.txt line count)
- **Documented with full data (file:line citations, interactions, power, recipes, construction, deconstruction):** 27
  - Space Heater (15 placed), IV Drip (10), Microwave (6), Reagent Grinder (7), Recharge Station (6), Keycard Auth (7), Canisters (air 13, oxygen 12, nitrous 7, toxins 7, nitrogen 5, CO2 4, water vapor 1, BZ 1), Hydroponics Tray constructable (16) & soil (14), Processor (2), Deep Fryer (2), Recycler (1), Medical Kiosk (2), DNA Scanner (3), Chem Heater (3), Chem Dispenser (3), Mass Driver (3), Washing Machine (5), Igniter (1), Sparker (2), Shield Wall Generator (4)
- **Documented with partial data (name, basic functions, some vars/interactions):** ~18
  - Snack/Cola Vending variants, Suit Storage variants, Chem Master, Seed Extractor, Biogenerator, Monkey Recycler, Portable Scrubber, etc.
- **Stub entries (name/location/count only, no data):** ~30
- **NOT FOUND / Require further research:** ~95 paths
  - Photocopier (5), Newscaster (5), advanced computers (shuttle, atmos_control, camera_advanced, modular_computer variants, med_data, turretid, etc.), power machinery (SMES, emitter, rad_collector, supermatter, compressor, turbine), wardrobe vending (20+ variants), research machines (protolathe, circuit_imprinter, techfab, destructive_analyzer, nanite machines, etc.), mining/mineral processing (stacking_unit, ore_redemption, etc.), teleportation (gateway, gulag_teleporter), security (announcement_system, airalarm variants, blackbox_recorder), and ~50 others

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
