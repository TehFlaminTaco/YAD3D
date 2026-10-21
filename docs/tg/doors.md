# Doors: Airlocks, Firelocks, Windoors

Airlocks are the primary secure access doors on BoxStation. There are 436 airlocks (many varieties: public, external, maintenance, command, medical, engineering, atmos, research, security, mining). Firelocks (269 total) separate fire zones and have no power or access control. Windoors (94) are transparent interior doors with access. All are damage-able and can be breached, and all can be deconstructed to return parts.

---

## Airlock `/obj/machinery/door/airlock` (code/game/machinery/doors/airlock.dm:40)

- Pressurized air-tight door with powered bolts, access control, and full deconstruction support. Includes electrification, hacking, and crush mechanics.

### Key vars
- `max_integrity = 300` (code/game/machinery/doors/airlock.dm:44); reinforced doors: 450 (AIRLOCK_INTEGRITY_MULTIPLIER = 1.5x)
- `damage_deflection = 21` (AIRLOCK_DAMAGE_DEFLECTION_N) for normal; 30 (AIRLOCK_DAMAGE_DEFLECTION_R) for reinforced (code/game/machinery/doors/airlock.dm:37–38)
- `normalspeed = 1` (code/game/machinery/doors/airlock.dm:51): TRUE = open/close 150 ds; FALSE = 15 ds
- `autoclose = TRUE` (code/game/machinery/doors/airlock.dm:48): auto-closes after opening
- `locked = FALSE` (bolts down); `welded = FALSE` (welded shut); `panel_open = FALSE` (maintenance panel)
- `density = TRUE` (closed, blocks air/movement); FALSE (open)
- `secondsElectrified`: MACHINE_NOT_ELECTRIFIED (0), MACHINE_ELECTRIFIED_PERMANENT (-1), or seconds remaining
- `security_level`: 0 (none), 1 (metal), 2–6 (plasteel layers); affects damage deflection & what tools can access wires
- `emergency = FALSE`: TRUE allows access regardless of ID; `safe = TRUE`: FALSE enables crush damage when door closes on mobs

### Interactions

| Item/Action | Condition | Delay (ds) | Message(s) | Result |
|---|---|---|---|---|
| **Screwdriver** (panel closed) | — | — | "You [open/close] the maintenance panel." | Opens/closes panel |
| **Screwdriver** (panel open, with wires exposed) | requires no security level; security_level > 0 = "Wires are protected!" | — | (no wires exposed if protected) | Blocked |
| **Metal sheets** (panel open, density, no access) | need 2+ sheets | 20 | "[user] reinforces [src] with metal." | Upgrades to AIRLOCK_SECURITY_METAL |
| **Plasteel sheets** (panel open, security_level = NONE) | need 2+ sheets | 20 | "[user] reinforces [src] with plasteel." | Upgrades to AIRLOCK_SECURITY_PLASTEEL; max_integrity × 1.5; damage_deflection = 30 |
| **Welder** (security_level = METAL) | need 2 fuel | 40 | "[user] cuts through [src]'s shielding." | Downgrades to AIRLOCK_SECURITY_NONE; drops 2 metal sheets |
| **Crowbar** (security_level = PLASTEEL_I_S) | — | 40 | "[user] remove [src]'s inner shielding." | Downgrades to AIRLOCK_SECURITY_NONE; drops 1 plasteel; max_integrity restored |
| **Welder** (security_level = PLASTEEL_I) | need 2 fuel | 40 | "[user] cuts through [src]'s shielding." | Downgrades to AIRLOCK_SECURITY_PLASTEEL_I_S |
| **Crowbar** (security_level = PLASTEEL_O_S) | — | 40 | "[user] remove [src]'s shielding." | Downgrades to AIRLOCK_SECURITY_PLASTEEL_I; drops 1 plasteel |
| **Welder** (security_level = PLASTEEL_O) | need 2 fuel | 40 | "[user] cuts through [src]'s shielding." | Downgrades to AIRLOCK_SECURITY_PLASTEEL_O_S |
| **Wirecutters** (security_level = PLASTEEL; grille electrified if powered) | may shock user (50% if powered) | 10 | "[user] cut through [src]'s outer grille." | Downgrades to AIRLOCK_SECURITY_PLASTEEL_O |
| **Weldingtool** (density, welded, powered OFF, unlocked) | need fuel | 40 | "[user] unweld [src]." | Toggles `welded` |
| **Weldingtool** (unpowered, panelopen, security ≥ METAL, less than max_integrity, in help intent) | need fuel | 40 | "[user] finishes welding [src]." | Repairs airlock to max_integrity |
| **Crowbar** (panel open, powered OFF, welded, density, not operating) | — | 40 | "[user] removes the electronics from the airlock assembly." | Calls `deconstruct(TRUE)` if also emagged or welded+no-power+locked|open condition |
| **Crowbar** (unpowered, forced open) | crowbar/fireaxe in hand | 50 | "[user] removes the electronics..." then `open(2)` | Forces door open even without power |
| **Paper/Photo** (not welded, on dense tile) | — | — | "[user] pins [C] to [src]." | Attaches note to door (visible on examine) |
| **Airlock Painter** | — | — | (input choice dialog) | Changes paint job / icon while keeping mechanics |
| **Bump** (when closed, not operating) | isElectrified() = TRUE | — | (electrocute if not silicon/admin; 100% shock chance) | Shock; may force open or return |
| **Attempt to hack** (AI, WIRE_AI cut) | `aiControlDisabled == 1` and not `hackProof` and hasPower | 50 + 20 + 200 + 170 = 440 | "[AI] Fault confirmed... Transfer complete." (step-by-step messages) | Sets `aiControlDisabled = 2` (bypassed); opens UI |
| **EMAG** (powered, closed, not already emagged) | — | 60 (6 ds flash + sleep) | (sparks animation) then `open()` | Sets `EMAGGED` flag; `lights = FALSE`; `locked = TRUE`; loseMainPower(); loseBackupPower() |

### Construction chain (from empty turf)

1. Place /obj/structure/door_assembly at turf
   - State: AIRLOCK_ASSEMBLY_NEEDS_WIRES
   - Not anchored, density = TRUE
   
2. Wrench it to anchor (40 ds, 100 vol) → "You secure the airlock assembly."
   - Becomes `anchored = TRUE`; name = "secured airlock assembly"
   
3. Add 1 cable_coil (40 ds, 1 coil) → "You wire the airlock assembly."
   - State: AIRLOCK_ASSEMBLY_NEEDS_ELECTRONICS; name = "wired airlock assembly"
   
4. Install /obj/item/electronics/airlock (40 ds auto, no tool; includes electronics UI for access list)
   - State: AIRLOCK_ASSEMBLY_NEEDS_SCREWDRIVER; name = "near finished airlock assembly"
   - Electronics installed in assembly
   
5. Screwdriver to finish (40 ds, 100 vol) → "You finish the airlock."
   - New /obj/machinery/door/airlock spawned at location
   - Electronics moved into airlock
   - Assembly deleted
   - Airlock inherits direction, unres_sides, req_access/req_one_access, heat_proof, previous_airlock from assembly

**Mineral/Glass variants:** Mineral sheets (2) added after step 1 (before wiring) → new /obj/structure/door_assembly/door_assembly_[mineral] spawned with transfer_assembly_vars. Glass (1) can be added at any point before completion.

### Deconstruction chain (to assembly)

1. Crowbar electronics while: unpowered OR (powered & (EMAGGED or (density & welded & !locked))) + panel open (40 ds, 100 vol) → "You remove the airlock electronics."
   - If EMAGGED: "You discard the damaged electronics." (electronics deleted)
   - Else: New /obj/item/electronics/airlock dropped with accesses copied
   - /obj/structure/door_assembly spawned at airlock location
   - Assembly state = AIRLOCK_ASSEMBLY_NEEDS_ELECTRONICS
   - Airlock deleted

2. From assembly: Crowbar (panel open, state = NEEDS_SCREWDRIVER) (40 ds, 100 vol) → "You remove the airlock electronics."
   - State: AIRLOCK_ASSEMBLY_NEEDS_ELECTRONICS
   - New /obj/item/electronics/airlock dropped

3. Wirecutter (panel open, state = NEEDS_ELECTRONICS) (40 ds, 100 vol) → "You cut the wires from the airlock assembly."
   - State: AIRLOCK_ASSEMBLY_NEEDS_WIRES
   - 1 cable_coil dropped

4. Wrench (anchored) (40 ds, 100 vol) → "You unsecure the airlock assembly."
   - Becomes unanchored; name = "airlock assembly"

5. Welder (unanchored) (40 ds, 50 vol) → "You disassemble the airlock assembly."
   - Drops random 2–4 of material_type (default /obj/item/stack/sheet/metal)
   - If glass: drops sheet/glass (disassembled) or shard (broken)
   - If mineral: drops 2 mineral sheets

### Drops on deconstruction
- **Proper deconstruction** (crowbar while meeting conditions): Assembly returned with state NEEDS_ELECTRONICS, intact for rebuilding
- **Destruction** (explosion, RCD): If NODECONSTRUCT_1 flag set, drops nothing (part of assembly already dropped if disassembled = TRUE)

### Health / Armor
- `max_integrity`: 300 normal; 450 (command, security) (code/game/machinery/doors/airlock_types.dm); 250 (maintenance); 200 (external maint glass)
- `armor = list("melee" = 25, "bullet" = 20, "laser" = 25, "energy" = 25, "bomb" = 15, "bio" = 100, "rad" = 100, "fire" = 80, "acid" = 70)` (assumed, inherited from /obj/machinery/door)
- `damage_deflection`: 21 normal; 30 reinforced (plasteel security_level ≥ PLASTEEL_O)
- `integrity_failure = 0.25`: at 75 max_integrity (sparks_damaged); below 25% (sparks_broken)
- Damage types: BRUTE, BURN applied; crush damage (safe = FALSE when door closes on mobs)

### Power
- `use_power`: uses 50 power per open/close if powered (code/game/machinery/doors/airlock.dm:1038, 1086)
- Idle: none stated
- Requires power for: open/close (unless forced), bolts (unbolt needs hasPower), electrification, auto-close timer, AI control
- Loses power: WIRE_POWER1 or WIRE_POWER2 cut → `loseMainPower()` (secondsMainPowerLost = 60, then countdown 1/sec if wires mended); WIRE_BACKUP1 or WIRE_BACKUP2 cut → `loseBackupPower()` (secondsBackupPowerLost = 60)
- **Unpowered behavior:** Cannot open/close (unless forced with crowbar/fireaxe, forced open only), cannot unbolt, no auto-close, no electrification

### Gotchas
- **Wires protected by security_level:** Operator must remove security layers before cutting/pulsing/mending wires; attempt_wire_interaction() returns WIRE_INTERACTION_FAIL if security_level > 0
- **Access control:** `requiresID()` checks if WIRE_IDSCAN is cut or `aiDisabledIdScanner = TRUE`. If either true, no ID required.
- **Bolts lock the door:** Locked (bolted) doors cannot be opened; bumpopen/crowbar blocked with "The airlock's bolts prevent it from being forced!"
- **Welded doors:** Cannot open/close or crowbar open; Crowbar blocked "It's welded, it won't budge!"
- **Crush damage:** Only if `safe = FALSE`. Default TRUE means no crush. When closing, if not safe, calls `crush()` on mobs in the turf (code/game/machinery/doors/airlock.dm:1108–1109)
- **EMAG:** Sets door as permanently broken (electronics are damaged, can't be removed cleanly). Cannot open after EMAG unless forced.
- **AI control disabled by WIRE_AI cut:** Door locked out from AI UI. AI can attempt hack() (50+20+200+170 = 440 ds) to regain control if not hackProof and hasPower and !isAllPowerCut
- **Cycle-linked airlocks:** `cyclelinkeddir` and `cyclelinkedairlock` link two airlocks so that bumping one forces the other closed
- **Heat-proof:** `heat_proof = TRUE` prevents rglass airlock from melting in high-temp atmospheres

---

## Airlock Wires `/datum/wires/airlock` (code/datums/wires/airlock.dm:1)

14 wires total: POWER1, POWER2, BACKUP1, BACKUP2, OPEN, BOLTS, IDSCAN, AI, SHOCK, SAFETY, TIMING, LIGHT, ZAP1, ZAP2 (last two are duds).

| Wire | Cut | Pulse | Mend |
|---|---|---|---|
| POWER1, POWER2 | Door loses main power (60 sec countdown until restore); shock user 50% | Door loses main power | Restore main power if both intact |
| BACKUP1, BACKUP2 | Door loses backup power (60 sec); shock user 50% | Door loses backup power | Restore backup power if both intact |
| OPEN | (no effect) | Toggle door open/close (only if !EMAGGED, (!requiresID or has_access)); respects density | (no effect) |
| BOLTS | Bolts drop immediately (locked = TRUE); cannot be raised | Toggle bolts (raise only if hasPower) | (no effect, stay raised) |
| IDSCAN | (no effect) | Show deny animation if powered & closed, then disable emergency access | (no effect) |
| AI | Disable AI control (aiControlDisabled = 1 for 10 ds, then resets if not re-cut) | Disable AI control toggle (toggle between 0/1 or 1/2 states); lasts 10 ds sleep | Re-enable AI control: if aiControlDisabled=1 → 0; if =2 → -1 |
| SHOCK | Door permanently electrified (until mended) | Temp electrify for 30 sec (MACHINE_DEFAULT_ELECTRIFY_TIME) | Un-electrify |
| SAFETY | Disable safeties (safe = FALSE, crush enabled) | Toggle safe state | Re-enable safeties (safe = mend) |
| TIMING | Disable auto-close | Toggle auto-close | Re-enable auto-close |
| LIGHT | Disable bolt lights | Toggle lights | Re-enable lights |
| ZAP1, ZAP2 | Shock user 50% | (no effect) | (no effect) |

---

## Firelock `/obj/machinery/door/firedoor` (code/game/machinery/doors/firedoor.dm:7)

- Fire-proof, no power, no access control, no bolts. Automatically closes when area pressure drops or fire alarm triggers. Heavy version exists.

### Key vars
- `max_integrity = 300` (heavy: 550) (code/game/machinery/doors/firedoor.dm:14, 254)
- `glass = TRUE` (heat-proof glass); `heat_proof = TRUE` (code/game/machinery/doors/firedoor.dm:16–17)
- `resistance_flags = FIRE_PROOF` (code/game/machinery/doors/firedoor.dm:15)
- `welded = FALSE` (can be welded shut); `boltslocked = TRUE` (bolts locked by screws, blocks wrench until unscrewed)
- `safe = FALSE` (no crush protection, always crushes) (code/game/machinery/doors/firedoor.dm:20)
- No `density` initially; `density = FALSE` (open state) defined in /firedoor/closed subtype

### Interactions

| Item/Action | Condition | Delay (ds) | Message(s) | Result |
|---|---|---|---|---|
| **Crowbar** | — | — | "[user] [open/close] [src]." | Toggle open/close |
| **Weldingtool** | — | 40 (50 vol) | "[user] [weld/unweld] [src]." | Toggle `welded` |
| **Wrench** (welded, not boltslocked) | — | 50 | "[user] unfastens [src]'s bolts." | Calls `deconstruct(TRUE)` |
| **Screwdriver** (welded) | — | — | "[user] [lock/unlock] [src]'s bolts." | Toggle `boltslocked` |
| **Punch** (operating or !density) | — | — | no effect | Blocked |
| **Bump** | panel_open or operating | — | no effect | Blocked |

### Construction chain (from /obj/structure/firelock_frame)

1. Place frame (state = CONSTRUCTION_NOCIRCUIT)

2. Add /obj/item/electronics/firelock (40 ds auto) → "You insert and secure [C]."
   - State: CONSTRUCTION_GUTTED

3. Add 5 cable_coil (60 ds auto) → "You wire [src]."
   - State: CONSTRUCTION_WIRES_EXPOSED

4. Crowbar (50 ds, 100 vol) → "You remove the cover plate from [src]."
   - State: CONSTRUCTION_WIRES_EXPOSED → CONSTRUCTION_PANEL_OPEN

5. Wrench (30 ds, check no other door on turf) → "You finish the firelock."
   - New /obj/machinery/door/firedoor spawned (or /heavy variant if reinforced)
   - Frame deleted

**Reinforcement (optional at CONSTRUCTION_PANEL_OPEN):** Add 2 plasteel (60 ds auto) → "You reinforce [src]." → `reinforced = 1` (spawns /firedoor/heavy when finished)

### Deconstruction chain (to frame)

From a **finished firedoor**:
1. Crowbar (50 ds, 100 vol) → "You pry out a metal plate from [src]."
   - State: CONSTRUCTION_PANEL_OPEN → CONSTRUCTION_WIRES_EXPOSED
   - Creates new /obj/structure/firelock_frame with constructionStep = CONSTRUCTION_PANEL_OPEN if disassembled, else CONSTRUCTION_WIRES_EXPOSED at 50% integrity

2. Wirecutter (60 ds, 100 vol) → "You remove the wiring from [src]."
   - State: CONSTRUCTION_WIRES_EXPOSED → CONSTRUCTION_GUTTED
   - 5 cable_coil dropped

3. Crowbar (50 ds, 50 vol) → "You remove the circuit board from [src]."
   - State: CONSTRUCTION_GUTTED → CONSTRUCTION_NOCIRCUIT
   - New /obj/item/electronics/firelock dropped

4. Welder (40 ds, 1 fuel) → "You cut [src] into metal."
   - Drops 3 metal sheets; if reinforced, also 2 plasteel

### Drops
- **Proper deconstruction:** Frame at CONSTRUCTION_PANEL_OPEN (if disassembled = TRUE) or 50% integrity (destroyed = FALSE)

### Health / Armor
- `max_integrity = 300`; heavy = 550 (code/game/machinery/doors/firedoor.dm:14, 254)
- `armor = list("melee" = 30, "bullet" = 30, "laser" = 20, "energy" = 20, "bomb" = 10, "bio" = 100, "rad" = 100, "fire" = 95, "acid" = 70)` (code/game/machinery/doors/firedoor.dm:24)
- No crush damage (safe = FALSE)

### Power
- None; no power usage, always operational

### Gotchas
- **No access control:** Cannot be locked by ID; bolts are manual (boltslocked via screwdriver)
- **Automatic closure on pressure alarm:** When area pressure drops or fire alarm in affecting area triggers, door auto-closes
- **Crush damage always enabled:** safe = FALSE, so mobs **will be crushed** when door closes
- **Welded doors cannot be crowbarred:** If welded, crowbar is blocked

---

## Windoor `/obj/machinery/door/window` (code/game/machinery/doors/windowdoor.dm:1)

- Transparent interior door with access control, no bolts, no power requirement for opening/closing (forced open/close when unpowered). Health 150; brigdoor 300 (reinforced).

### Key vars
- `max_integrity = 150` (brigdoor 300) (code/game/machinery/doors/windowdoor.dm:10, 342)
- `glass = FALSE` (set to TRUE for see-through); opacity = FALSE (glass types don't block view)
- `visible = FALSE` (not opaque by default); flags_1 = ON_BORDER_1 (border door, blocks at edges)
- `density = TRUE` (closed) or FALSE (open)
- `CanAtmosPass = ATMOS_PASS_PROC` (respects door state)
- `panel_open = FALSE` (maintenance panel for electronics removal)
- Embedded debris on spawn: 2 shards, 2 rods, 1 cable_coil (can be transferred on deconstruct)

### Interactions

| Item/Action | Condition | Delay (ds) | Message(s) | Result |
|---|---|---|---|---|
| **Crowbar** (unpowered) | — | — | (forces open/close immediately) | Toggle density |
| **Crowbar** (powered) | — | — | "The door's motors resist..." | Blocked |
| **Screwdriver** (panel) | !density | — | "You [open/close] the maintenance panel." | Toggle `panel_open` |
| **Crowbar** (panel open, !density) | — | 40 (50 vol) | "[user] removes the electronics from [src]." | Creates /obj/structure/windoor_assembly at location; spawns airlock electronics dropped; deletes windoor |
| **Bump** (closed, not operating) | — | — | Calls bumpopen; auto-opens if allowed and !requiresID or has access | |
| **EMAG** (powered, closed) | — | 6 ds flash | (sparks) | Sets EMAGGED; opens forced; desc += smoking warning |

### Construction chain (from /obj/structure/windoor_assembly)

1. Place assembly (anchored = FALSE, state = "02" or state var TBD)
   
2. Screwdriver (state = "02") → finish assembly
   - New /obj/machinery/door/window spawned
   - Inherits: facing (l/r icon_state), secure flag, direction, created_name, electronics accesses
   - Assembly deleted

### Deconstruction chain

1. Crowbar (panel open, !density) (40 ds, 50 vol) → "You remove the airlock electronics."
   - Spawns /obj/structure/windoor_assembly at location (state = "02", anchored = TRUE)
   - New /obj/item/electronics/airlock dropped with accesses copied
   - Windoor deleted

### Drops on destruction
- If not disassembled (destroyed in place): Debris (shards, rods, cable) forceMove to turf; transfer_fingerprints_to each; list cleared

### Health / Armor
- `max_integrity = 150`; brigdoor 300 reinforced (code/game/machinery/doors/windowdoor.dm:10, 342)
- `armor = list("melee" = 20, "bullet" = 50, "laser" = 50, "energy" = 50, "bomb" = 10, "bio" = 100, "rad" = 100, "fire" = 70, "acid" = 100)` (code/game/machinery/doors/windowdoor.dm:12)
- `integrity_failure = 0` (no sparks)
- BURN damage (exposed_temperature > T0C + (reinf ? 1600 : 800)) causes damage proportional to exposure

### Power
- Does not require power to open/close if unpowered (forced open/close still works)
- If powered: normal open/close with EMAG blockage

### Gotchas
- **Access control via electronics:** req_access/req_one_access set on spawning windoor from assembly
- **On border, respects direction:** CanAtmosPass, CheckExit check if get_dir(loc, target) == dir
- **Crush damage only if safe = TRUE (default); most windoors have safe = TRUE**
- **No bolts; cannot be locked**

---

## Door Button `/obj/machinery/button/door` (code/game/machinery/buttons.dm:183)

- Remote control switch that toggles target doors (airlocks or pod doors) on/off via id_tag.

### Key vars
- `id = null` (or specific id_tag to match doors)
- `normaldoorcontrol = FALSE` (if TRUE, creates airlock control; else creates pod door control)
- `specialfunctions = OPEN` (bitflag: 1=OPEN, 2=IDSCAN, 4=BOLTS, 8=SHOCK, 16=SAFE) (code/modules/assembly/doorcontrol.dm:33–40)
- `sync_doors = TRUE` (if TRUE, all doors toggle to same state; if FALSE, each door independently toggles)

### Interactions

| Action | Condition | Delay (ds) | Result |
|---|---|---|---|
| **Press button** | — | — | Activates device control; 10 ds cooldown |
| **Airlock control** (if normaldoorcontrol=TRUE) | For each airlock D with D.id_tag == button.id | — | If OPEN flag: toggle all open/close; if IDSCAN: toggle aiDisabledIdScanner; if BOLTS & hasPower & !wire_cut: toggle locked; if SHOCK: toggle secondsElectrified; if SAFE: toggle safe |
| **Pod door control** (if normaldoorcontrol=FALSE) | For each poddoor M with M.id == button.id | — | If sync_doors=TRUE: all toggle to same state (open if any closed, close if all open); if FALSE: each toggles independently |

---

## Door Control (Remote Assembly) `/obj/item/assembly/control/airlock` (code/modules/assembly/doorcontrol.dm:29)

- Handheld remote that triggers same functions as door button.

### Key vars
- `id = "badmin"` (default; null = "MEGAFUN" random)
- `specialfunctions` (bitflag, see above)
- `cooldown = FALSE` (10 ds between activations)

### Interaction
- **Activate (press/attach to signaler):** Loops through GLOB.airlocks; if D.id_tag == id, applies specialfunctions. 10 ds cooldown.

---

## Minimum viable port

1. **Airlock open/close:** density toggle, 1 ds opening/closing anim, 150 ds autoclose timer (normalspeed=1) or 15 ds (=0), requires hasPower (unless forced)
2. **Bolts:** `locked` var toggles, blocks force-open if locked, boltUp/boltDown sounds
3. **Access control:** check_access(id_card) blocks entry; "access denied" animation if fail; requiresID() checks WIRE_IDSCAN
4. **Electrification:** isElectrified() shocks on bump (100% if electrified); 50% on wire contact; cooldown 1 sec
5. **Wires:** 9 functional wires (POWER1/2, BACKUP1/2, OPEN, BOLTS, IDSCAN, SHOCK, SAFETY); cut/pulse/mend states; protected by security_level if >0
6. **Deconstruction:** Crowbar electronics (40 ds) returns assembly; assembly → 2–4 metal sheets (welder); cable_coil refund (40 ds wirecutter); wrench anchor (40 ds)
7. **Firelock:** glass_type = TRUE, always closes on pressure alarm, weldable, crowbable, no power/access, crushes on close
8. **Windoor:** access control, panel opens to remove electronics, border-door, respects direction for atmos
9. **Door buttons/remotes:** Match airlocks by id_tag, toggle open/close, optional special flags (idscan toggle, bolt toggle, etc.)
10. **Damage/health:** Normal 300 max_integrity; damage_deflection = 21; crush when safe=FALSE; sparks_damaged at 75%, sparks_broken at 25%

---

## NOT FOUND / open questions

- Exact timings for power restoration (`secondsMainPowerLost` countdown rate) — inferred 1 per 10 ds (1 sec) from `handlePowerRestore()` sleep(10) decrement
- Exact crush damage formula (not found in take_damage or crush definition; inferred from safe = FALSE enabling crush in close())
- WIRE_ZAP1/ZAP2 purpose beyond "Ouch" (duds or special hacks? not fully documented)
