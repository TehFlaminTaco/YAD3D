# Tools and Dispatch Chain

How Space Station 13 tools work: the click dispatch chain, tool dispatch, helper procs, and per-tool behavior.
When a player clicks an object with a tool, the code follows a strict order: tool_act (if tool_behaviour is set), pre_attack, attackby, then afterattack.
Each tool has a tool_behaviour constant that determines which machinery helpers it can work with.
Tools have delays (in deciseconds), sounds, and checks to gate their use on conditions like fuel, power, or anchoring.

## Click Dispatch Chain

The dispatcher is at `/obj/item/proc/melee_attack_chain` (code/_onclick/item_attack.dm:10).
When you click something while holding an item W, the order of execution is:

1. **tool_act** on the target (code/game/atoms.dm:1117)
   - Checks if W has a tool_behaviour and target has a handler for that tool type.
   - The handler (crowbar_act, screwdriver_act, etc.) returns a signal bitmask; if COMPONENT_BLOCK_TOOL_ATTACK is set, the chain stops.
   - Return TRUE from tool_act to stop the chain; return FALSE to continue.
   - Only runs if W.tool_behaviour is non-zero (code/_onclick/item_attack.dm:11).

2. **pre_attack** on the item (code/_onclick/item_attack.dm:13)
   - Called on W before attackby. Returns TRUE to stop the chain, FALSE to continue.
   - Signals COMSIG_ITEM_PRE_ATTACK (code/_onclick/item_attack.dm:38-41).

3. **attackby** on the target (code/_onclick/item_attack.dm:15)
   - Called on the target (atom) that was hit. Returns TRUE to stop the chain, FALSE to continue.
   - Base: returns signal COMSIG_PARENT_ATTACKBY; if COMPONENT_NO_AFTERATTACK is set, returns TRUE (code/_onclick/item_attack.dm:53-56).
   - /obj (code/_onclick/item_attack.dm:58): calls I.attack_obj if CAN_BE_HIT.
   - /mob/living (code/_onclick/item_attack.dm:61-65): calls I.attack, sets next_move to CLICK_CD_MELEE.

4. **afterattack** on the item (code/_onclick/item_attack.dm:20)
   - Always called if target and item are not deleted. Return value ignored.
   - This is where tools like welding torches can ignite mobs (code/game/objects/items/tools/weldingtool.dm:126-157).

## Tool Dispatch from tool_act

The tool_act function in /atom (code/game/atoms.dm:1117) dispatches to specific handlers by tool_behaviour constant:

| Constant | Handler | Signal |
|----------|---------|--------|
| TOOL_CROWBAR | crowbar_act | COMSIG_ATOM_CROWBAR_ACT |
| TOOL_SCREWDRIVER | screwdriver_act | COMSIG_ATOM_SCREWDRIVER_ACT |
| TOOL_WRENCH | wrench_act | COMSIG_ATOM_WRENCH_ACT |
| TOOL_WIRECUTTER | wirecutter_act | COMSIG_ATOM_WIRECUTTER_ACT |
| TOOL_WELDER | welder_act | COMSIG_ATOM_WELDER_ACT |
| TOOL_MULTITOOL | multitool_act | COMSIG_ATOM_MULTITOOL_ACT |
| TOOL_ANALYZER | analyzer_act | COMSIG_ATOM_ANALYSER_ACT |

Each handler sends a signal; components can listen and return COMPONENT_BLOCK_TOOL_ATTACK to stop the chain.

## Helper Procs

### use_tool(atom/target, mob/living/user, delay, amount=0, volume=0, datum/callback/extra_checks)
(code/game/objects/items.dm:838)

Main proc called by machinery to use a tool on them. Handles delay, sound, fuel/ammo consumption, and checks.
- Argument `delay` is in deciseconds; multiplied by `toolspeed` and skill modifiers (line 853).
- If delay > 0, calls do_after with tool_check_callback; if delay = 0, calls tool_start_check once.
- Calls `play_tool_sound(target, volume)` at start and end (if delay >= MIN_TOOL_SOUND_DELAY).
- Calls `use(amount)` to consume fuel/ammo; returns TRUE if successful, FALSE if not.
- Returns TRUE if all checks pass and the tool actually used, FALSE otherwise.

### tool_use_check(mob/living/user, amount=0)
(code/game/objects/items.dm:893)

Called by use_tool on every tick of a delay, and once by tool_start_check if no delay.
Generic version returns !amount (i.e., TRUE if amount is 0, FALSE if amount > 0).
Override in subclasses (e.g., welding tool checks get_fuel() >= amount at line code/game/objects/items/tools/weldingtool.dm:250-259).
Signals COMSIG_TOOL_IN_USE if it returns TRUE (code/game/objects/items.dm:915).

### tool_start_check(mob/living/user, amount=0)
(code/game/objects/items.dm:887)

Called by use_tool if there's a delay, before the do_after starts.
Calls tool_use_check(user, amount) and signals COMSIG_TOOL_START_USE if it returns TRUE.
Not used by most tools; only by welding tools and stacks.

### play_tool_sound(atom/target, volume=50)
(code/game/objects/items.dm:901)

Plays item.usesound at `target` location, volume `volume`.
If usesound is a list, picks one at random (code/game/objects/items.dm:905-906).
Does nothing if usesound is null or volume is 0.

### do_after(mob/user, var/delay, needhand=TRUE, atom/target=null, progress=TRUE, datum/callback/extra_checks=null)
(code/__HELPERS/mobs.dm:244)

Delays action by `delay` deciseconds (line 267: multiplied by user.do_after_coefficent()).
Shows a progress bar at target (or user) if progress=TRUE.
Loop breaks (returns FALSE) if any of these happen:
- User is deleted, stat != CONSCIOUS, or moves away from original location (line 285).
- User is stunned or paralyzed (line 291-293).
- Target is deleted or moves away (line 295-298).
- User no longer has target in do_afters list (line 300-302).
- User's active held item changes (if needhand=TRUE; line 311-313).
- extra_checks callback returns FALSE (line 285).
On success, returns TRUE; on interruption, returns FALSE.

## Tool Items

### Pocket Crowbar  `/obj/item/crowbar`   (code/game/objects/items/tools/crowbar.dm:1)

- Hand-held tool for prying, force-opening, and deconstruction.
- tool_behaviour = TOOL_CROWBAR (line 19).
- usesound = 'sound/items/crowbar.ogg' (line 8).
- Default delays: default_pry_open uses 10 ds; default_deconstruction_crowbar uses 50 ds (inferred from machinery code).
- force = 5 (line 11); throwforce = 7 (line 12); w_class = WEIGHT_CLASS_SMALL.
- toolspeed = 1 (line 20) — no speed modifier vs. base.
- Variants: /obj/item/crowbar/red (force = 8), /obj/item/crowbar/large (force = 12, w_class = WEIGHT_CLASS_NORMAL, toolspeed = 0.7), /obj/item/crowbar/power (jaws of life; force = 15, toolspeed = 0.7, can toggle to TOOL_WIRECUTTER), /obj/item/crowbar/cyborg (toolspeed = 0.5).

### Wrench  `/obj/item/wrench`   (code/game/objects/items/tools/wrench.dm:1)

- Hand-held rotating tool for unfastening bolts and machinery anchors.
- tool_behaviour = TOOL_WRENCH (line 19).
- usesound = 'sound/items/ratchet.ogg' (line 13).
- Default delays: default_unfasten_wrench uses 40 ds (inferred).
- force = 5 (line 10); throwforce = 7 (line 11); w_class = WEIGHT_CLASS_SMALL.
- toolspeed = 1 (line 20).
- Variants: /obj/item/wrench/medical (force = 2, throwforce = 4, toolspeed = 1), /obj/item/wrench/cyborg (toolspeed = 0.5), /obj/item/wrench/combat (toggleable via attack_self; starts as tool_behaviour = null; when on, tool_behaviour = TOOL_WRENCH, toolspeed = 1, force = 6).

### Screwdriver  `/obj/item/screwdriver`   (code/game/objects/items/tools/screwdriver.dm:1)

- Small sharp tool for unscrewing fasteners and precision work.
- tool_behaviour = TOOL_SCREWDRIVER (line 21).
- usesound = list('sound/items/screwdriver.ogg', 'sound/items/screwdriver2.ogg') (line 20) — picks random at playsound.
- Default delays: default_deconstruction_screwdriver uses 50 ds (inferred).
- force = 5 (line 12); w_class = WEIGHT_CLASS_TINY; throw_speed = 3, throw_range = 5.
- toolspeed = 1 (line 22).
- Random color overlay applied on Initialize (line 44-48); color list at line 28-36.
- item_flags = EYE_STAB (line 26) — can eye-stab; hitsound = 'sound/weapons/bladeslice.ogg' (line 19).
- Variants: /obj/item/screwdriver/abductor (usesound = 'sound/items/pshoom.ogg', toolspeed = 0.1, random_color = FALSE), /obj/item/screwdriver/power (hand drill; force = 8, w_class = WEIGHT_CLASS_SMALL, toolspeed = 0.7, can toggle to TOOL_WRENCH via attack_self), /obj/item/screwdriver/cyborg (toolspeed = 0.5).

### Wirecutters  `/obj/item/wirecutters`   (code/game/objects/items/tools/wirecutters.dm:1)

- Cutting tool for wires, restraints, and other cutting tasks.
- tool_behaviour = TOOL_WIRECUTTER (line 22).
- usesound = hitsound = 'sound/items/wirecutter.ogg' (lines 17-18).
- Default delays: default_deconstruction (wirecutter variant) uses 50 ds (inferred).
- force = 6 (line 11); w_class = WEIGHT_CLASS_SMALL; throw_speed = 3, throw_range = 7.
- toolspeed = 1 (line 23).
- Random color overlay applied on Initialize (line 39-43); color list at line 26-34.
- Special: attack() checks if target is restrained with cable cuffs or durathread; if so, cuts and deletes restraint instead of attacking (lines 53-64).
- Variants: /obj/item/wirecutters/abductor (usesound = none, toolspeed = 0.1, random_color = FALSE), /obj/item/wirecutters/cyborg (toolspeed = 0.5).

### Welding Tool  `/obj/item/weldingtool`   (code/game/objects/items/tools/weldingtool.dm:1)

- Fuel-powered tool for welding, heating, and repairs. Must be turned on first via attack_self.
- tool_behaviour = TOOL_WELDER (line 36).
- usesound = list('sound/items/welder.ogg', 'sound/items/welder2.ogg') (line 16); acti_sound = 'sound/items/welderactivate.ogg', deac_sound = 'sound/items/welderdeactivate.ogg' (lines 19-20).
- Default delays: use_tool(..., 40, amount=1, volume=50) for most construction (e.g., welding two pieces of metal).
- Fuel: max_fuel = 20 units (line 30); each use(1) consumes 1 unit. WELDER_FUEL_BURN_INTERVAL = 13 (line 1) — burns 1 fuel per 13 game ticks while on.
- force = 3 off (line 13), force = 15 on (line 78) — damtype = "fire" when on, "brute" when off.
- toolspeed = 1 (line 37).
- tool_use_check (line 250): returns TRUE if isOn() and check_fuel(); else returns FALSE and sends warning message (lines 251-259).
- heat = 3800 (line 35) — can ignite mobs (code/game/objects/items/tools/weldingtool.dm:134-138).
- attack_self toggles on/off; on checks fuel >= 1 (line 211) and sets light (line 165).
- attackby accepts screwdriver (flamethrower conversion) or rods (line 94-101).
- afterattack (line 126): if isOn() and proximity, calls handle_fuel_and_temps(1, user) and tries to ignite target mob.
- Variants: /obj/item/weldingtool/largetank (max_fuel = 40).

### Multitool  `/obj/item/multitool`   (code/game/objects/items/devices/multitool.dm:13)

- Device for hacking, pulsing wires, and testing circuits. No fuel; used for testing and linkage.
- tool_behaviour = TOOL_MULTITOOL (line 23).
- usesound = 'sound/weapons/empty.ogg' (line 32).
- Default delays: most pulse/hack actions use 10-30 ds (varies by machinery).
- force = 5 (line 21); w_class = WEIGHT_CLASS_SMALL; throwforce = 0 (line 24).
- toolspeed = 1 (line 31).
- Has a data buffer (var buffer, line 33) for device linkage; modes (var mode, line 34).
- No tool_use_check override — default (returns !amount) always passes.
- Variants: /obj/item/multitool/ai_detect (detects AI cameras, toggles HUD via attack_self), /obj/item/multitool/cyborg (toolspeed = 0.5).

### Health Analyzer  `/obj/item/healthanalyzer`   (code/game/objects/items/devices/scanners.dm:81)

- Medical scanning device; no tool_behaviour. Scans mob vitals on attack().
- tool_behaviour is not set (default NONE).
- No usesound (medical, not a construction tool).
- Default delays: none; attack() flicks scan animation and outputs detailed health report (lines 117-142).
- force = 0 (inherited); item_flags = NOBLUDGEON (line 91) — cannot damage.
- w_class = WEIGHT_CLASS_TINY; throwforce = 3 (line 93).
- attack_self (line 107): cycles through scanmode (SCANMODE_HEALTH, SCANMODE_CHEMICAL, SCANMODE_WOUND).
- attack (line 117): flicks "[icon_state]-scan" animation; if user is clumsy, scans floor; else calls healthscan(user, M, mode, advanced) (line 138).
- Has modes and scanmode vars; advanced mode shows more detail (line 100).
- Variants: /obj/item/healthanalyzer/advanced (advanced = TRUE).

### Analyzer (Gas/Environment)  `/obj/item/analyzer`   (code/game/objects/items/devices/scanners.dm:490)

- Environmental gas scanner for atmosphere analysis. No tool_behaviour per se; uses TOOL_ANALYZER for consistency.
- tool_behaviour = TOOL_ANALYZER (line 506).
- No usesound (diagnostic tool).
- Default delays: none; attack_self reads turf.return_air() and outputs pressure, gas concentrations, temperature (lines 521-560).
- force = 0 (inherited); item_flags = NOBLUDGEON (line 501) — cannot damage.
- w_class = WEIGHT_CLASS_SMALL; throwforce = 0 (line 503).
- attack_self (line 521): analyzes current turf atmosphere; sends results to user.
- AltClick (line 562): barometer function (cooldown 250 ds per line 510); predicts weather.
- Variants: none in this version.

### Cable Coil  `/obj/item/stack/cable_coil`   (code/modules/power/cable.dm:384)

- Stack item for placing power cables on turfs. Referenced here only; cable placement is handled by construction code.
- Not a tool (tool_behaviour = NONE); used in crafting and construction recipes.
- Documented in separate module; see code/modules/power/cable.dm.

## Generic Machinery Helpers

All in `/obj/machinery` or `/obj` (code/game/machinery/_machinery.dm).

### default_pry_open(obj/item/I) (line 389)

Checks if a crowbar can pry open a closed machine or panel.
- Condition: !(state_open || panel_open || is_operational() || (flags_1 & NODECONSTRUCT_1)) && I.tool_behaviour == TOOL_CROWBAR
- On success: plays tool sound, sends message "You pry open the [src].", calls open_machine().
- Returns TRUE on success, FALSE if conditions not met.
- No delay; instant action (just calls I.play_tool_sound with volume 50, not I.use_tool).

### default_deconstruction_crowbar(obj/item/I, ignore_panel=0) (line 396)

Checks if a crowbar can fully deconstruct a machine (after unscrewing).
- Condition: (panel_open || ignore_panel) && !(flags_1 & NODECONSTRUCT_1) && I.tool_behaviour == TOOL_CROWBAR
- On success: plays tool sound, calls deconstruct(TRUE).
- Returns TRUE on success, FALSE if conditions not met.
- No delay; instant action.

### default_deconstruction_screwdriver(mob/user, icon_state_open, icon_state_closed, obj/item/I) (line 447)

Toggles machine panel open/closed; first step of deconstruction.
- Condition: !(flags_1 & NODECONSTRUCT_1) && I.tool_behaviour == TOOL_SCREWDRIVER
- On success: plays tool sound, toggles panel_open, sets icon_state, sends message to user.
- Returns TRUE on success, FALSE if conditions not met.
- Messages: "You open the maintenance hatch" or "You close the maintenance hatch" (code/game/machinery/_machinery.dm:453, 456).
- No delay; instant action.

### default_unfasten_wrench(mob/user, obj/item/I, time=20) (line 475)

Toggles machine anchored state (secures/unsecures). Most complex helper; uses do_after.
- Checks: !(flags_1 & NODECONSTRUCT_1) && I.tool_behaviour == TOOL_WRENCH
- Calls can_be_unfasten_wrench() to validate (line 477).
- If time > 0: sends "You begin [un]securing [src]..." message (line 481).
- Calls I.use_tool(src, user, time, extra_checks=CALLBACK(..., unfasten_wrench_check, ...)) (line 485).
- On success: toggles anchored, sends "You [un]secure [src]." message, plays 'sound/items/deconstruct.ogg', signals COMSIG_OBJ_DEFAULT_UNFASTEN_WRENCH.
- Returns: SUCCESSFUL_UNFASTEN (TRUE) on success, FAILED_UNFASTEN (TRUE) if conditions fail mid-action, CANT_UNFASTEN (FALSE) if tool not wrench.
- Delay: `time` deciseconds (default 20 ds); uses extra_checks callback unfasten_wrench_check to verify anchored state doesn't change during delay.

### can_be_unfasten_wrench(mob/user, silent=FALSE) (line 469)

Validates if object can be unfastened with wrench.
- Checks: must be on floor (isfloorturf(loc) or indestructible turf) OR already anchored.
- Returns: SUCCESSFUL_UNFASTEN if valid, FAILED_UNFASTEN if on wrong loc, CANT_UNFASTEN not used by this proc.
- Message if fails: "[src] needs to be on the floor to be secured!" (unless silent=TRUE).
- No delay.

## /obj/item/wallframe Pointer

/obj/item/wallframe (code/game/objects/items/apc_frame.dm:1) is a base item for wall-mounted structures (APC, intercoms, fire extinguisher cabinets, etc.).
Referenced here as a pointer only; full documentation deferred to construction/deconstruction docs.
Has try_build(), attach(), after_attach(), and attackby() procs to handle placement and tool interaction.

## Tool Summary Table

| Tool | tool_behaviour | Sound | Default Delays |
|------|-----------------|-------|-----------------|
| Crowbar | TOOL_CROWBAR | crowbar.ogg | pry 10 ds, deconstruct 50 ds |
| Wrench | TOOL_WRENCH | ratchet.ogg | unfasten 40 ds |
| Screwdriver | TOOL_SCREWDRIVER | screwdriver.ogg / screwdriver2.ogg | deconstruct 50 ds |
| Wirecutters | TOOL_WIRECUTTER | wirecutter.ogg | cut 50 ds |
| Welding Tool | TOOL_WELDER | welder.ogg / welder2.ogg | varies 40 ds typical; uses fuel |
| Multitool | TOOL_MULTITOOL | empty.ogg (none) | varies 10-30 ds by target |
| Analyzer (Gas) | TOOL_ANALYZER | none | none; instant scan |
| Health Analyzer | NONE | none | none; instant scan |

## Minimum Viable Port

1. Implement tool_act dispatch chain that checks tool_behaviour against target handlers (crowbar_act, screwdriver_act, etc.).
2. Implement melee_attack_chain order: tool_act → pre_attack → attackby → afterattack, with early exit on TRUE return.
3. Implement use_tool() proc with delay (in deciseconds), toolspeed multiplier, fuel/ammo check, and do_after loop.
4. Implement do_after (delay loop with interrupt checks on move, held-item change, stunlock, target move).
5. Map each tool item to its tool_behaviour constant; store toolspeed (default 1).
6. Implement tool_use_check as condition gate for tool activation; override in welding tool to check fuel.
7. Add play_tool_sound to all tool uses; use usesound from item definition.
8. Support delay in deciseconds; multiply by toolspeed for actual duration.
9. Animate tool use with progress bar (do_after visual, not sound).
10. Make welding tool special: fuel = 20 units, burns 1 per 13 ticks while on, requires fuel >= amount to use.

## NOT FOUND / Open Questions

- Construction/deconstruction chain for specific structures (windows, walls, airlock frames, machinery frames); documented in their own modules.
- Cable placement mechanics (cable_coil usage in crafting); documented in power/cable module (code/modules/power/cable.dm).
- Full wallframe build chain and frame states; documented in items/apc_frame module (code/game/objects/items/apc_frame.dm).
- Specific machinery implementations and their tool_act signal listeners (component-based system).
- Wire interaction when panel is open (wire_act, wire_cut, etc.); separate from tool dispatch.
