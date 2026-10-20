# gap-items-01 part 1: AI modules (10 entries)

Source tree: `_src/tg2020` (commit 2d6c10c1). All paths below are relative to that tree. Numbers are raw.
Base `/obj/item/ai_module` and `/obj/item/ai_module/core/full` are described once; children give only what they change.

## Parent: AI modules

### `/obj/item/ai_module` (base, `code/game/objects/items/AI_modules.dm:9`)
- Base values for all AI modules below (unless the child row says otherwise):
  - name = `"\improper AI module"` (AI_modules.dm:10); desc = `"An AI Module for programming laws to an AI."` (AI_modules.dm:16)
  - icon 'icons/obj/module.dmi', icon_state `"std_mod"`, inhand_icon_state `"electronic"` (AI_modules.dm:11-13)
  - flags_1 = CONDUCT_1 (AI_modules.dm:17); force = 5 (AI_modules.dm:18); throwforce = 0 (AI_modules.dm:20)
  - w_class = WEIGHT_CLASS_SMALL (AI_modules.dm:19) = 2 (`code/__DEFINES/inventory.dm:7`)
  - throw_speed = 3 (AI_modules.dm:21); throw_range = 7 (AI_modules.dm:22)
  - custom_materials = list(gold = 50) (AI_modules.dm:25)
  - `var/list/laws = list()` (AI_modules.dm:23); `var/bypass_law_amt_check = 0` (AI_modules.dm:24)
  - slot_flags not set: 0 from `/obj/item` default (`code/game/objects/items.dm:79`). Cannot be worn.
  - armor not set: all zero, from `/obj` default (`code/game/objects/objs.dm:62-63`, `code/datums/armor.dm:22`).
- Procs (once):
  - `examine`: `if(Adjacent(user)) show_laws(user)` (AI_modules.dm:27-30)
  - `attack_self`: `..()` then `show_laws(user)` (AI_modules.dm:32-34). No delay, no message of its own.
  - `show_laws`: `"<B>Programmed Law[(laws.len > 1) ? "s" : ""]:</B>"`, then each law as `"\"[law]\""` (AI_modules.dm:36-40)
  - `install(law_datum, user)` is the single entry point used by every law-upload target (AI_modules.dm:43-75). Messages verbatim:
    - `"<span class='warning'>ERROR: No laws found on board.</span>"` when not bypassed and `laws` empty or `laws[1] == ""` (AI_modules.dm:44-45)
    - lawcap: counts devillaws, inherent, supplied, ion, hacked and `laws`; if the count is greater than `CONFIG_GET(number/silicon_max_law_amount)` and not bypassed: `"<span class='alert'>Not enough memory allocated to [...]'s law processor to handle this amount of laws.</span>"`, sets overflow = TRUE (AI_modules.dm:50-59). Config default 12 (`code/controllers/configuration/entries/game_options.dm:306`).
    - success: `"<span class='notice'>Upload complete. [law_datum.owner]'s laws have been modified.</span>"` (AI_modules.dm:63) or `"<span class='notice'>Upload complete.</span>"` (AI_modules.dm:66); owner `law_change_counter++` (AI_modules.dm:64)
    - logs `GLOB.lawchanges`, `log_law`, `message_admins`, and `deadchat_broadcast("<b> changed ...")` (AI_modules.dm:68-75)
  - `transmitInstructions(law_datum, sender, overflow)` (AI_modules.dm:78-80): if owner, `to_chat(owner, "<span class='userdanger'>[sender] has uploaded a change to the laws you must follow using a [name].</span>")`. Every child calls `..()` into this.
- Where `install` is called (the only way laws change):
  - AI core: `code/game/objects/structures/ai_core.dm:178-184`; refused with `"<span class='warning'>The installed [brain.name] already has set laws!</span>"` when `brain.laws.id != DEFAULT_AI_LAWID` (ai_core.dm:179-180)
  - Law upload console: `code/game/machinery/computer/law.dm:12-29` (`M.install(current.laws, user)`, line 29)
  - AI player: `code/modules/mob/living/silicon/ai/ai_defense.dm:2-9`; `"[src] is entirely unresponsive!"` if no mind (ai_defense.dm:5-7)
  - Cyborg: `code/modules/mob/living/silicon/robot/robot_defense.dm:137-158`; needs open panel, closed wire panel off, a cell, not shell, not emagged and no `connected_ai && lawupdate`, else messages/buzz (robot_defense.dm:139-156)
- Gotchas: 
  - the base `transmitInstructions` only messages the owner. Every real effect is in the child.
  - Module damage/durability is default (`max_integrity = 200` from `code/game/objects/items.dm:57`, `obj_integrity` from `/obj`).

### `/obj/item/ai_module/supplied` (`code/game/objects/items/AI_modules.dm:85`) (base for supplied boards)
- name = `"Optional Law board"` (AI_modules.dm:86); `var/lawpos = 50` (AI_modules.dm:87)
- `transmitInstructions(law_datum, sender)` (AI_modules.dm:90-98): each law in `laws` is added as a supplied law at `lawpos`, `lawpos+1`, ... (`add_supplied_law`, AI_modules.dm:93-98). Supplied laws are NOT overflow-checked here and never clear anything.

### `/obj/item/ai_module/core` (`code/game/objects/items/AI_modules.dm:333`) (base for core boards)
- desc = `"An AI Module for programming core laws to an AI."` (AI_modules.dm:334)
- `transmitInstructions` (AI_modules.dm:100-111): each law added with `add_inherent_law`, or `replace_random_law(templaw, list(LAW_INHERENT, LAW_SUPPLIED))` when overflow. Does NOT clear existing inherent laws.

### `/obj/item/ai_module/core/full` (`code/game/objects/items/AI_modules.dm:336`) (base for full core boards)
- `var/law_id` (AI_modules.dm:337)
- `Initialize` (AI_modules.dm:339-348): if `law_id` is set, `lawtype = D.lawid_to_type(law_id)` and `laws = D.inherent` from that datum. Asimov's datum is `/datum/ai_laws/default/asimov` (`code/datums/ai_laws.dm:29-34`, id "asimov" line 31).
- `transmitInstructions` (AI_modules.dm:350-357): clears inherent laws and `clear_zeroth_law(0)` on owner or datum, then `..()` (the core add above). So full core boards REPLACE inherent laws. Non-`full` core boards (freeform core) do not.

---

## Sub-family: supplied law boards (protect station, quarantine, oxygen, freeform)

| DM path (def line) | in-game name (name line) | laws / lawpos (line) | transmitInstructions | design (`code/modules/research/designs/AI_module_designs.dm`) | on BoxStation |
|---|---|---|---|---|---|
| `/obj/item/ai_module/supplied/protect_station` (AI_modules.dm:204) | `'ProtectStation' AI Module` (205) | laws: `"Protect the space station against damage. Anyone you see harming the station is to be no longer considered human, and is a threat to the station which must be neutralized."` (206); lawpos = 5 (207) | inherited `supplied` (AI_modules.dm:90-98) | `protectstation_module` (31-38): glass 1000, gold 2000, bluespace 1000 (35) | x1 |
| `/obj/item/ai_module/supplied/quarantine` (AI_modules.dm:212) | `'Quarantine' AI Module` (213) | laws: `"The station is under a quarantine. Allowing anyone to leave the station causes human harm. Anyone actively attempting to leave the station is to be stopped by any means necessary. It is impossible to harm a human while preventing them from leaving the station."` (214); lawpos = 8 (215) | inherited (AI_modules.dm:90-98) | `quarantine_module` (40-47): glass 1000, gold 2000, bluespace 1000 (44) | x1 |
| `/obj/item/ai_module/supplied/oxygen` (AI_modules.dm:220) | `'OxygenIsToxicToHumans' AI Module` (221) | laws: `"Oxygen is highly toxic to humans, and must be purged from the station. Prevent, by any means necessary, anyone from exposing the station to this toxic gas. Extreme cold is the most effective method of healing the damage Oxygen does to a human."` (222); lawpos = 9 (223) | inherited (AI_modules.dm:90-98) | `oxygen_module` (49-56): glass 1000, gold 2000, bluespace 1000 (53). Its design desc reads `"Allows for the construction of a Safeguard AI Module."` (AI_module_designs.dm:51), a copy-paste slip in the design, not the item | x1 |
| `/obj/item/ai_module/supplied/freeform` (AI_modules.dm:228) | `'Freeform' AI Module` (229) | laws: `list("")` (231); lawpos = 15 (230) | inherited (AI_modules.dm:90-98); own `attack_self`/`install`/`transmitInstructions` (below) | `freeform_module` (58-65): glass 1000, gold 10000, bluespace 2000 (62). The design comment says custom inputs cost more (AI_module_designs.dm:62) | x1 |

Notes per row:
- `/obj/item/ai_module/supplied/protect_station` and `/quarantine` and `/oxygen`: no own procs. They use the base `attack_self`, `install`, `transmitInstructions`.
- `/obj/item/ai_module/supplied/freeform`, `attack_self` (AI_modules.dm:233-250):
  - `input("Please enter the priority for your new law. Can only write to law sectors 15 and above.", "Law Priority (15+)", lawpos) as num|null`
  - if below 15: `alert("Error: The law priority of [newpos] is invalid,  Law priorities below 14 are reserved for core laws,  Would you like to change that that to 15?", "Invalid law priority", "Change to 15", "Cancel")`; "Change to 15" sets newpos = 15 (AI_modules.dm:237-241)
  - `lawpos = min(newpos, 50)` (AI_modules.dm:242)
  - `stripped_input(user, "Please enter a new law for the AI.", "Freeform Law Entry", laws[1], CONFIG_GET(number/max_law_len))`; max_law_len = 1024 (`game_options.dm:319`) (AI_modules.dm:243)
  - chat filter: `"<span class='warning'>Error: Law contains invalid text.</span>"` (AI_modules.dm:246-247)
  - `laws[1] = targName` then `..()` (AI_modules.dm:249-250)
- `freeform` `install` refuses with `"<span class='alert'>No law detected on module, please create one.</span>"` when `laws[1] == ""` (AI_modules.dm:256-259)
- `freeform` `transmitInstructions` returns `laws[1]` after `..()` (AI_modules.dm:252-254); the returned text goes into the log line in `install`.

## Sub-family: OneHuman

### `/obj/item/ai_module/zeroth/onehuman` (AI_modules.dm:177)
- name = `'OneHuman' AI Module` (AI_modules.dm:178); `var/targetName = ""` (AI_modules.dm:179); laws = `list("Only SUBJECT is human.")` (AI_modules.dm:180)
- `attack_self` (AI_modules.dm:182-188): `stripped_input(user, "Please enter the subject who is the only human.", "Who?", user.real_name, MAX_NAME_LEN)`; sets `targetName`; `laws[1] = "Only [targetName] is human"` (AI_modules.dm:187, no full stop, verbatim); `..()`
- `install` (AI_modules.dm:190-194): with no `targetName`: `"<span class='alert'>No name detected on module, please enter one.</span>"` and return 0 (AI_modules.dm:192-193)
- `transmitInstructions` (AI_modules.dm:196-199): if the parent `..()` returns true, returns `"[targetName], but the AI's existing law 0 cannot be overridden."` (AI_modules.dm:198); else returns `targetName`.
- Parent `/obj/item/ai_module/zeroth` `transmitInstructions` (AI_modules.dm:113-132): if the owner already has a zeroth law, messages `"[sender.real_name] attempted to modify your zeroth law."` and `"It would be in your best interest to play along with [sender.real_name] that:"` plus each failed law (AI_modules.dm:116-119), returns 1 (AI_modules.dm:120). Otherwise `set_zeroth_law(templaw)` (AI_modules.dm:122-132).
- design `onehuman_module` (AI_module_designs.dm:22-29): glass 1000, diamond 6000, bluespace 1000 (26)
- on BoxStation: x1

## Sub-family: Reset and Purge

### `/obj/item/ai_module/reset` (AI_modules.dm:298)
- name = `\improper 'Reset' AI module` (AI_modules.dm:299); desc = `"An AI Module for removing all non-core laws."` (AI_modules.dm:301); `bypass_law_amt_check = 1` (AI_modules.dm:302, skips the law cap check); `var/targetName = "name"` (AI_modules.dm:300, unused in this file).
- `transmitInstructions` (AI_modules.dm:304-313): `..()` (the owner message above), then `clear_supplied_laws`, `clear_ion_laws`, `clear_hacked_laws` on owner or datum. Does NOT touch inherent or zeroth laws.
- design `reset_module` (AI_module_designs.dm:67-74): glass 1000, gold 2000 (71)
- on BoxStation: x2

### `/obj/item/ai_module/reset/purge` (AI_modules.dm:318)
- name = `'Purge' AI Module` (AI_modules.dm:319); desc = `"An AI Module for purging all programmed laws."` (AI_modules.dm:320). Inherits `bypass_law_amt_check = 1` from reset.
- `transmitInstructions` (AI_modules.dm:322-329): `..()` runs reset's clears (supplied, ion, hacked), then `clear_inherent_laws()` and `clear_zeroth_law(0)` on owner or datum. So purge clears all five law lists, zeroth included.
- design `purge_module` (AI_module_designs.dm:76-83): glass 1000, diamond 2000, bluespace 1000 (80)
- on BoxStation: x1

## Sub-family: Core boards

### `/obj/item/ai_module/core/freeformcore` (AI_modules.dm:445)
- name = `'Freeform' Core AI Module` (AI_modules.dm:446); laws = `list("")` (AI_modules.dm:447). Parent `/obj/item/ai_module/core` supplies desc `"An AI Module for programming core laws to an AI."` (AI_modules.dm:334).
- `attack_self` (AI_modules.dm:449-457): `stripped_input(user, "Please enter a new core law for the AI.", "Freeform Law Entry", laws[1], CONFIG_GET(number/max_law_len))`; chat filter `"<span class='warning'>Error: Law contains invalid text.</span>"` (AI_modules.dm:453-454); `laws[1] = targName`; `..()`
- `transmitInstructions` (AI_modules.dm:459-461): `..()` = `/obj/item/ai_module/core` add, then `return laws[1]`
- Gotcha: it is NOT `/core/full`, so it does NOT clear existing inherent or zeroth laws. It adds one core law on top of what the AI already has (or replaces a random inherent/supplied law when overflow).
- design `freeformcore_module` (AI_module_designs.dm:94-101): glass 1000, diamond 10000, bluespace 2000 (98)
- on BoxStation: x1

### `/obj/item/ai_module/core/full/asimov` (AI_modules.dm:362)
- name = `'Asimov' Core AI Module` (AI_modules.dm:363); `law_id = "asimov"` (AI_modules.dm:364); `var/subject = "human being"` (AI_modules.dm:365)
- Initialize (from `/obj/item/ai_module/core/full`, AI_modules.dm:339-348): laws = the asimov datum's inherent laws (`code/datums/ai_laws.dm:32-34`):
  - `"You may not injure a human being or, through inaction, allow a human being to come to harm."`
  - `"You must obey orders given to you by human beings, except where such orders would conflict with the First Law."`
  - `"You must protect your own existence as long as such does not conflict with the First or Second Law."`
- `attack_self` (AI_modules.dm:367-375): `stripped_input(user, "Please enter a new subject that asimov is concerned with.", "Asimov to whom?", subject, MAX_NAME_LEN)`; `subject = targName`; `laws = list("You may not injure a [subject] or, through inaction, allow a [subject] to come to harm.", "You must obey orders given to you by [subject]s, except where such orders would conflict with the First Law.", "You must protect your own existence as long as such does not conflict with the First or Second Law.")` (AI_modules.dm:372-374); `..()`. The subject gets an `s` appended in the second law only (verbatim).
- `transmitInstructions`: inherited from `/full` (clears inherent and zeroth, then adds these laws as inherent) (AI_modules.dm:350-357).
- design `asimov_module` (AI_module_designs.dm:103-110): glass 1000, diamond 2000, bluespace 1000 (107)
- on BoxStation: x1

### `/obj/item/ai_module/core/full/custom` (AI_modules.dm:406)
- name = `Default Core AI Module` (AI_modules.dm:407). No law_id.
- `Initialize` (AI_modules.dm:409-420): calls parent `Initialize` (no-op, no law_id), then reads `world.file2list("[global.config.directory]/silicon_laws.txt")`. Skips empty lines and lines whose first char is `#` (`findtextEx(line,"#",1,2)`), appends each other line to `laws`. If `laws` is still empty: `return INITIALIZE_HINT_QDEL` (AI_modules.dm:419-420). An empty `silicon_laws.txt` makes the board delete itself at init.
- `transmitInstructions`: inherited from `/full` (clears inherent and zeroth, then adds the file laws).
- design `default_module` (AI_module_designs.dm:149-156): glass 1000, diamond 2000, bluespace 1000 (153)
- on BoxStation: x1

# gap-items-01 part 2: assemblies (3 entries)

Source tree: `_src/tg2020`. Numbers are raw (deciseconds unless the row says seconds). Parent defined once; children give only overrides.

## Parent: assemblies

### `/obj/item/assembly` (base, `code/modules/assembly/assembly.dm:8`)
- name = `"assembly"` (assembly.dm:9); desc = `"A small electronic device that should never exist."` (assembly.dm:10); icon 'icons/obj/assemblies/new_assemblies.dmi' (assembly.dm:11)
- flags_1 = CONDUCT_1 (assembly.dm:13); w_class = WEIGHT_CLASS_SMALL (assembly.dm:14) = 2 (`code/__DEFINES/inventory.dm:7`)
- custom_materials = list(iron = 100) (assembly.dm:15); throwforce = 2 (assembly.dm:16); throw_speed = 3 (assembly.dm:17); throw_range = 7 (assembly.dm:18)
- drop_sound 'sound/items/handling/component_drop.ogg' and pickup_sound 'sound/items/handling/component_pickup.ogg' (assembly.dm:19-20)
- `var/secured = TRUE` (assembly.dm:23): assemblies start secured (ready to use), so they cannot be attached until unsecured with a screwdriver.
- `var/wire_type = WIRE_RECEIVE | WIRE_PULSE` (assembly.dm:26) = 1|2 = 3. The WIRE_ defines are at assembly.dm:1-5: RECEIVE 1, PULSE 2, PULSE_SPECIAL 4, RADIO_RECEIVE 8, RADIO_PULSE 16.
- `var/attachable = FALSE` (assembly.dm:27); `var/next_activate = 0` (assembly.dm:29): spam cooldown.
- Procs (once):
  - `activate()` (assembly.dm:77-81): returns FALSE if `QDELETED(src)`, `!secured`, or `next_activate > world.time`; otherwise sets `next_activate = world.time + 30` (assembly.dm:80) and returns TRUE. **Every child's `activate()` calls this first, so each use has a 30 ds cooldown.**
  - `pulsed(radio)` (assembly.dm:58-63) and `pulse(radio)` (assembly.dm:66-74): wire routing; `connected.pulse_assembly(src)` or `holder.process_activation(...)`.
  - `toggle_secure()` (assembly.dm:83-86): flips `secured`, `update_icon()`.
  - `attackby(W, user)` (assembly.dm:88-98): if W is another assembly and both are unsecured: creates an `/obj/item/assembly_holder` and `"You attach and secure \the [A] to \the [src]!"` (assembly.dm:92-94). Otherwise `"Both devices must be in attachable mode to be attached together."` (assembly.dm:96).
  - `screwdriver_act` (assembly.dm:100-108): calls `toggle_secure()`; `"\The [src] is ready!"` (assembly.dm:104) when it becomes secured, `"\The [src] can now be attached!"` (assembly.dm:106) when unsecured.
  - `examine` (assembly.dm:110-112): `"<span class='notice'>\The [src] [secured? "is secured and ready to be used!" : "can be attached to other things."]</span>"`
  - `attack_self` (assembly.dm:114-119): `user.set_machine(src)`, `interact(user)` = `ui_interact`.
  - `is_secured(user)` (assembly.dm:51-55): `"<span class='warning'>The [name] is unsecured!</span>"` when not secured.
- Default custom_materials/cost: autolathe designs for these are in `code/modules/research/designs/autolathe_designs.dm` (see per-item rows).

---

## Sub-family: the three active assemblies

| DM path (def line) | in-game name (line) | desc (line) | custom_materials (line) | attachable (line) | autolathe design (materials) | on BoxStation |
|---|---|---|---|---|---|---|
| `/obj/item/assembly/prox_sensor` (proximity.dm:1) | `proximity sensor` (proximity.dm:2) | `"Used for scanning and alerting when someone enters a certain proximity."` (proximity.dm:3) | iron 800, glass 200 (proximity.dm:5) | TRUE (proximity.dm:6) | `prox_sensor` (autolathe_designs.dm:758-763): iron 800, glass 200 (762) | x12 |
| `/obj/item/assembly/signaler` (signaler.dm:1) | `remote signaling device` (signaler.dm:2) | `"Used to remotely activate devices. Allows for syncing when using a secure signaler on another."` (signaler.dm:3) | iron 400, glass 120 (signaler.dm:8) | TRUE (signaler.dm:10) | `signaler` (autolathe_designs.dm:644-649): iron 400, glass 120 (648) | x12 |
| `/obj/item/assembly/timer` (timer.dm:1) | `timer` (timer.dm:2) | `"Used to time things. Works well with contraptions which has to count down. Tick tock."` (timer.dm:3) | iron 500, glass 50 (timer.dm:5) | TRUE (timer.dm:6) | `timer` (autolathe_designs.dm:692-697): iron 500, glass 50 (696) | x12 |

All three: `icon_state` `"prox"` (proximity.dm:4), `"signaller"` (signaler.dm:4), `"timer"` (timer.dm:4); no `w_class` override, so WEIGHT_CLASS_SMALL from the parent (assembly.dm:14). `throwforce` 2 from parent.

---

### `/obj/item/assembly/prox_sensor` (`code/modules/assembly/proximity.dm:1`)
- Key vars (proximity.dm:9-15): `ui_x = 250`, `ui_y = 185`, `scanning = FALSE`, `timing = FALSE`, `time = 10` (seconds, decremented in `process()`, see below), `sensitivity = 1`, `hearing_range = 3`
- Init (proximity.dm:17-20): `proximity_monitor = new(src, 0)`, `START_PROCESSING(SSobj, src)`. Destroy stops processing (proximity.dm:22-24).
- Examine (proximity.dm:26-28): `"<span class='notice'>The proximity sensor is [timing ? "arming" : (scanning ? "armed" : "disarmed")].</span>"`
- Interactions:

  | held item / action | condition | delay (ds) | message(s) verbatim | result |
  |---|---|---|---|---|
  | empty hand, attack_self (opens UI) | `is_secured` (assembly.dm:51-55) | 0 | `"The proximity sensor is unsecured!"` if unsecured (via `is_secured`; `ui_status` closes the UI, proximity.dm:113-116) | opens tgui `ProximitySensor` (proximity.dm:118-123) |
  | screwdriver | any | 0 | `"\The [src] is ready!"` / `"\The [src] can now be attached!"` (assembly.dm:104/106) | toggles `secured` |
  | another assembly | both unsecured | 0 | `"You attach and secure \the [A] to \the [src]!"` (assembly.dm:94) | creates a holder |
  | any use via `activate()` | cooldown | 30 (assembly.dm:80) | none | `timing = !timing` if not `scanning`, else `scanning = FALSE` (proximity.dm:30-38); `update_icon()` |
  | a mob/obj enters proximity | `scanning && secured && next_activate <= world.time` (proximity.dm:61-67) | 30 (proximity.dm:75) | `audible_message("[icon2html(src, hearers(src))] *beep* *beep* *beep*", null, hearing_range)` (proximity.dm:70); each hearing mob gets `'sound/machines/triple_beep.ogg'` at volume `ASSEMBLY_BEEP_VOLUME` (5, assembly.dm:6) (proximity.dm:71-74) | `pulse(FALSE)` (proximity.dm:69). Beams (`/obj/effect/beam`) are ignored (proximity.dm:62-63) |

- UI actions (proximity.dm:134-156): `"scanning"` toggles scan; `"sense"` with `range` calls `sensitivity_change`; `"time"` toggles `timing`; `"input"` adjusts `time` with `clamp(value, 0, 600)` (proximity.dm:155). Data sent: seconds, minutes, timing, scanning, sensitivity (proximity.dm:125-132).
- Procs of note:
  - `toggle_scan(scan)` (proximity.dm:87-92): no-op if not secured; `scanning = scan`; `proximity_monitor.SetRange(scanning ? sensitivity : 0)`.
  - `sensitivity_change(value)` (proximity.dm:94-98): `sensitivity = min(max(sensitivity + value, 0), 5)`; re-senses if scanning.
  - `process()` (proximity.dm:78-85): if `timing`: `time--`; at `time <= 0`: `timing = FALSE`, `toggle_scan(TRUE)`, `time = initial(time)` (= 10).
  - `toggle_secure()` (proximity.dm:47-59): unsecuring stops scanning and timing and `STOP_PROCESSING`; securing restarts processing and `SetHost(loc, src)`.
- Icon overlays: `"prox_timing"` and `"prox_scanning"` (proximity.dm:103-108).
- Power: none. Cell: none.
- Construction: autolathe, iron 800 + glass 200 (autolathe_designs.dm:762). No other recipe found in the autolathe file for this path.
- Gotchas:
  - `time` is in seconds by intent (the UI shows `minutes`/`seconds`, proximity.dm:127-128), but `process()` runs on `SSobj`, whose `wait = 20` (`code/controllers/subsystem/processing/obj.dm:5`). So one `time--` happens per SSobj fire, i.e. about 20 ds (2 s) of world time per unit (inferred from the subsystem wait; not run).
  - `sense()` refuses while on cooldown (proximity.dm:67, 75), so one activation lasts at least 30 ds after the last beep.

### `/obj/item/assembly/signaler` (`code/modules/assembly/signaler.dm:1`)
- Key vars: `ui_x = 280`, `ui_y = 132` (signaler.dm:13-14); `code = DEFAULT_SIGNALER_CODE` (signaler.dm:15) = 30 (`code/__DEFINES/radio.dm:106`); `frequency = FREQ_SIGNALER` (signaler.dm:16) = 1457 (`code/__DEFINES/radio.dm:85`); `radio_connection` (signaler.dm:17); `hearing_range = 1` (signaler.dm:22)
- `wires = WIRE_RECEIVE | WIRE_PULSE | WIRE_RADIO_PULSE | WIRE_RADIO_RECEIVE` (signaler.dm:9) = 1|2|16|8 = 27. **Gotcha:** this sets the atom's `wires` variable (`code/game/atoms.dm:87` `var/datum/wires/wires`), NOT the assembly's `wire_type` (assembly.dm:26). The receive gate reads `src.wires & WIRE_RADIO_RECEIVE` (signaler.dm:140). Wire routing in `pulse()` still reads `wire_type` (assembly.dm:66-74), so the signaler's pulse routing uses the default 3.
- Examine: none on this path.
- Interactions:

  | held item / action | condition | delay (ds) | message(s) verbatim | result |
  |---|---|---|---|---|
  | empty hand, attack_self (opens UI) | `is_secured` | 0 | `"<span class='warning'>The [name] is unsecured!</span>"` via `is_secured` (assembly.dm:53) | opens tgui `Signaler` (signaler.dm:72-77) |
  | activate() via use | cooldown | 30 (assembly.dm:80) | none | `signal()` (signaler.dm:56-60) |
  | another signaler, both secured | `signaler2.secured` and `secured` (signaler.dm:113-119) | 0 | `"You transfer the frequency and code of \the [signaler2.name] to \the [name]"` (signaler.dm:119) | copies `code` and `frequency` (`set_frequency`) |
  | another signaler, not both secured | (signaler.dm:116) | 0 | falls to `..()`, which is the assembly rule (assembly.dm:88-98) | |
  | screwdriver | any | 0 | ready / attachable messages (assembly.dm:104/106) | toggles secured |
  | incoming radio signal with matching code (`receive_signal`, signaler.dm:134-151) | `code` equal, `wires & WIRE_RADIO_RECEIVE` set, not suicider | 0 | `audible_message("[icon2html(src, hearers(src))] *beep* *beep* *beep*", null, hearing_range)` (signaler.dm:146); `'sound/machines/triple_beep.ogg'` at volume 5 to hearers in view (signaler.dm:147-150) | `pulse(TRUE)` (signaler.dm:145) |

- UI actions (signaler.dm:87-111): `"signal"` calls `signal()` async; `"freq"` unformats and sanitizes the frequency then `set_frequency`; `"code"` `text2num`, round; `"reset"` restores `initial(frequency)` or `initial(code)`. Data sent: `frequency`, `code`, `minFrequency = MIN_FREE_FREQ` (1201, `code/__DEFINES/radio.dm:53`), `maxFrequency = MAX_FREE_FREQ` (1599, `code/__DEFINES/radio.dm:90`) (signaler.dm:79-85).
- `signal()` (signaler.dm:122-132): returns if no `radio_connection`; posts `new(list("code" = code))` on the radio. If `usr`, logs `GLOB.lastsignalers` with key, location, `format_frequency(frequency)/code`.
- `set_frequency(new_frequency)` (signaler.dm:153-157): removes from `SSradio` and re-adds with `RADIO_SIGNALER`.
- Suicide: `suicide_act` (signaler.dm:24-30): `"<span class='suicide'>[user] eats \the [src]! If it is signaled, [user.p_they()] will die!</span>"` (signaler.dm:25), playsound `'sound/items/eatfood.ogg'` 50 (signaler.dm:26), returns `MANUAL_SUICIDE_NONLETHAL` (signaler.dm:30). On the next matching signal, `manual_suicide` does `adjustOxyLoss(200)` (signaler.dm:40), `death(0)`, `qdel(src)` (signaler.dm:45). Message: `"<span class='suicide'>[user]'s [src] receives a signal, killing [user.p_them()] instantly!</span>"` (signaler.dm:37) or `"... receives a signal and [user.p_they()] die[user.p_s()] like a gamer!"` (signaler.dm:39).
- Power: none. Cell: none.
- Construction: autolathe, iron 400 + glass 120 (autolathe_designs.dm:648). `category = list("initial", "T-Comm")` (autolathe_designs.dm:650).
- Gotchas:
  - `receiver` child (signaler.dm:162-179) and `anomaly` child (181-182) are not on this list; the receiver adds `on` and `toggle_safety()`. Not documented here.
  - Radio code is the only filter. Anyone with a signaler on the same frequency and code triggers it.

### `/obj/item/assembly/timer` (`code/modules/assembly/timer.dm:1`)
- Key vars: `ui_x = 275`, `ui_y = 115` (timer.dm:9-10); `timing = FALSE` (timer.dm:11); `time = 5` (timer.dm:12); `saved_time = 5` (timer.dm:13); `loop = FALSE` (timer.dm:14); `hearing_range = 3` (timer.dm:15). Units: seconds (the `suicide_act` multiplies by 10, timer.dm:20).
- Init: `START_PROCESSING(SSobj, src)` (timer.dm:28-30). Destroy stops it (timer.dm:32-34).
- Examine (timer.dm:36-38): `"The timer is [timing ? "counting down from [time]":"set for [time] seconds"]."`
- Interactions:

  | held item / action | condition | delay (ds) | message(s) verbatim | result |
  |---|---|---|---|---|
  | empty hand, attack_self (opens UI) | `is_secured` | 0 | `"<span class='warning'>The [name] is unsecured!</span>"` (assembly.dm:53) | opens tgui `Timer` (timer.dm:93-98) |
  | activate() via use | cooldown | 30 (assembly.dm:80) | none | `timing = !timing`, `update_icon()` (timer.dm:40-45) |
  | screwdriver | any | 0 | ready / attachable messages (assembly.dm:104/106) | toggles secured; unsecuring sets `timing = FALSE` and stops processing (timer.dm:47-55) |
  | another assembly | both unsecured | 0 | `"You attach and secure \the [A] to \the [src]!"` (assembly.dm:94) | creates a holder |
  | suicide_act | any | 0 | `"<span class='suicide'>[user] looks at the timer and decides [user.p_their()] fate! It looks like [user.p_theyre()] going to commit suicide!</span>"` (timer.dm:18) | `activate()`; `addtimer(CALLBACK(src, .proc/manual_suicide, user), time*10)` (timer.dm:19-20); returns `MANUAL_SUICIDE` |

- Timer end (`timer_end`, timer.dm:57-68): returns if not secured or `next_activate > world.time`; otherwise `pulse(FALSE)`, `audible_message(... *beep* *beep* *beep* ..., null, hearing_range)` (timer.dm:61), triple_beep to hearers in view (timer.dm:62-65), `if(loop) timing = TRUE` (timer.dm:66-67), `update_icon()`.
- `process()` (timer.dm:70-77): if `timing`: `time--`; at `time <= 0`: `timing = FALSE`, `timer_end()`, `time = saved_time`.
- UI actions (timer.dm:108-128): `"time"` toggles `timing` (logs bomber if holder is `/obj/item/transfer_valve`, timer.dm:115-116); `"repeat"` toggles `loop`; `"input"` adjusts `time` with `clamp(value, 1, 600)` and sets `saved_time` (timer.dm:126-127). Data: seconds, minutes, timing, loop (timer.dm:102-106).
- Overlay: `"timer_timing"` while timing (timer.dm:82-84).
- Power: none. Cell: none.
- Construction: autolathe, iron 500 + glass 50 (autolathe_designs.dm:696).
- Gotchas:
  - `timer_end` returns early if `next_activate > world.time` (timer.dm:58-59). `next_activate` is set by every use (assembly.dm:80), so an end inside the 30 ds cooldown after a use silently drops the beep and pulse. `process()` still resets `time = saved_time` (timer.dm:76-77). Inferred consequence: a 1-second timer that is started and runs out within 30 ds will not beep. (inferred; code only, not run)
  - `process()` is driven by `SSobj` `wait = 20` (obj.dm:5), so each `time--` is about 20 ds (inferred).

---

## Minimum notes for a port (this part only)
- Assemblies are secured by default (assembly.dm:23); attaching needs a screwdriver first (assembly.dm:88-108).
- Every use is gated by a 30 ds cooldown (assembly.dm:80).
- Proximity and timer count down in `SSobj` ticks; their `time` values are seconds by intent but the tick is 20 ds (obj.dm:5). (inferred)
- Signaler radio gate is the `wires` bitmask (signaler.dm:9, 140), not `wire_type`.
- Gotcha: a timer that ends inside the 30 ds cooldown silently skips its pulse (timer.dm:58-59).

# gap-items-01 part 3: surplus prosthetic limbs (4 entries)

Source tree: `_src/tg2020`. Raw numbers. Chain: `/obj/item/bodypart` -> `/obj/item/bodypart/l_arm` (etc., `parts.dm`) -> `/robot` (`robot_bodyparts.dm`) -> `/surplus`. Each surplus limb overrides only icon, brute/burn reduction and max_damage.

## Parent: body parts as items

### `/obj/item/bodypart` (base, `code/modules/surgery/bodyparts/_bodyparts.dm:2`)
- name = `"limb"` (_bodyparts.dm:3); desc = `"Why is it detached..."` (_bodyparts.dm:4)
- force = 3 (_bodyparts.dm:5); throwforce = 3 (_bodyparts.dm:6); w_class = WEIGHT_CLASS_SMALL (_bodyparts.dm:7) = 2
- icon 'icons/mob/human_parts.dmi' (_bodyparts.dm:8); layer BELOW_MOB_LAYER (_bodyparts.dm:10)
- `var/status = BODYPART_ORGANIC` (_bodyparts.dm:13). BODYPART_ORGANIC = 1, BODYPART_ROBOTIC = 2 (`code/__DEFINES/mobs.dm:63-64`).
- `max_damage = 0` (_bodyparts.dm:34); `brute_reduction = 0` (_bodyparts.dm:38); `burn_reduction = 0` (_bodyparts.dm:39): subtracted from damage taken.
- `body_damage_coeff = 1` (_bodyparts.dm:26); `stam_damage_coeff = 0.75` (_bodyparts.dm:27)
- Damage-stage text used by `help_shake_act` (_bodyparts.dm:61-67): organic brute `"bruised"`, `"battered"`, `"mangled"`; burn `"numb"`, `"blistered"`, `"peeling away"`.
- `dismemberable = 1` (_bodyparts.dm:52); `wound_resistance = 0` (_bodyparts.dm:78); `disabled_wound_penalty = 15` (_bodyparts.dm:80)
- `throw_impact` (_bodyparts.dm:140-145): plays `'sound/misc/splort.ogg'` only if NOT robotic (_bodyparts.dm:142-143).
- `drop_organs(user, violent_removal)` (_bodyparts.dm:148-153): plays splort only if not robotic (_bodyparts.dm:150-151), then moves every `/obj/item` inside to the turf.

### Organic parent limbs (values the robot and surplus limbs inherit unless overridden)
| parent path (def line) | name (line) | max_damage (line) | max_stamina_damage (line) | body_damage_coeff (line) | body_zone (line) | held_index (line) |
|---|---|---|---|---|---|---|
| `/obj/item/bodypart/l_arm` (`code/modules/surgery/bodyparts/parts.dm:57`) | `"left arm"` (58) | 50 (65) | 50 (66) | 0.75 (71) | `BODY_ZONE_L_ARM` (67) | 1 (72) |
| `/obj/item/bodypart/r_arm` (parts.dm:125) | `"right arm"` (126) | 50 (131) | 50 (140) | 0.75 (136) | `BODY_ZONE_R_ARM` (132) | 2 (137) |
| `/obj/item/bodypart/l_leg` (parts.dm:191) | `"left leg"` (192) | 50 (197) | 50 (203) | 0.75 (200) | `BODY_ZONE_L_LEG` (198) | 0 (default, `_bodyparts.dm:22`) |
| `/obj/item/bodypart/r_leg` (parts.dm:249) | `"right leg"` (250) | 50 (257) | 50 (263) | 0.75 (260) | `BODY_ZONE_R_LEG` (258) | 0 (default, `_bodyparts.dm:22`) |

### Robot parent limbs (`code/modules/surgery/bodyparts/robot_bodyparts.dm`)
Damage-stage messages used by all robot limbs (`robot_bodyparts.dm:1-7`): brute light `"marred"`, medium `"dented"`, heavy `"falling apart"`; burn light `"scorched"`, medium `"charred"`, heavy `"smoldering"`. Set on each robot limb at robot_bodyparts.dm:26-32 (arms) and 47-53, 68-74, 89-95 (legs).

| path (def line) | name (line) | desc (line) | attack_verb (line) | status (line) | brute_reduction (line) | burn_reduction (line) | icon |
|---|---|---|---|---|---|---|---|
| `/obj/item/bodypart/l_arm/robot` (robot_bodyparts.dm:13) | `"cyborg left arm"` (14) | `"A skeletal limb wrapped in pseudomuscles, with a low-conductivity case."` (15) | `list("slapped", "punched")` (16) | `BODYPART_ROBOTIC` (21) | 5 (23) | 4 (24) | `'icons/mob/augmentation/augments.dmi'`, icon_state `"borg_l_arm"` (18, 20) |
| `/obj/item/bodypart/r_arm/robot` (robot_bodyparts.dm:34) | `"cyborg right arm"` (35) | same (36) | `list("slapped", "punched")` (37) | `BODYPART_ROBOTIC` (42) | 5 (44) | 4 (45) | augments.dmi, `"borg_r_arm"` (41) |
| `/obj/item/bodypart/l_leg/robot` (robot_bodyparts.dm:55) | `"cyborg left leg"` (56) | same (57) | `list("kicked", "stomped")` (58) | `BODYPART_ROBOTIC` (63) | 5 (65) | 4 (66) | augments.dmi, `"borg_l_leg"` (62) |
| `/obj/item/bodypart/r_leg/robot` (robot_bodyparts.dm:76) | `"cyborg right leg"` (77) | same (78) | `list("kicked", "stomped")` (79) | `BODYPART_ROBOTIC` (84) | 5 (86) | 4 (87) | augments.dmi, `"borg_r_leg"` (83) |

The robot limbs do NOT set `max_damage`, so they keep the organic parent's value (50, parts.dm:65/131/197/257). `flags_1 = CONDUCT_1` on each robot limb (robot_bodyparts.dm:19, 40, 61, 82).

---

## Sub-family: surplus prosthetic limbs

Common to all four (`code/modules/surgery/bodyparts/robot_bodyparts.dm`):
- desc = `"A skeletal, robotic limb. Outdated and fragile, but it's still better than nothing."` (robot_bodyparts.dm:298, 306, 314, 322)
- icon = 'icons/mob/augmentation/surplus_augments.dmi' (robot_bodyparts.dm:299, 307, 315, 323)
- brute_reduction = 0 (robot_bodyparts.dm:300, 308, 316, 324) (robot value 5, see above)
- burn_reduction = 0 (robot_bodyparts.dm:301, 309, 317, 325) (robot value 4)
- max_damage = 20 (robot_bodyparts.dm:302, 310, 318, 326) (inherited organic value 50)
- status = BODYPART_ROBOTIC (inherited from the robot parent, robot_bodyparts.dm:21, 42, 63, 84)
- attack_verb, w_class, force, throwforce, inhand: inherited (see tables above)
- Not made by any design (no `build_path` in the research or mech fabricator files for these four paths). Only the robot (non-surplus) arms and legs have designs (`code/modules/research/designs/mechfabricator_designs.dm:33, 42, 51, 60`).

| DM path (def line) | in-game name (line) | BoxStation count | where it comes from in the code |
|---|---|---|---|
| `/obj/item/bodypart/l_arm/robot/surplus` (robot_bodyparts.dm:296) | `surplus prosthetic left arm` (297) | none placed (not in list) | quirk `prosthetic_limb` (negative.dm:421-422); crate `surplus_limbs` (crates.dm:161-162) |
| `/obj/item/bodypart/r_arm/robot/surplus` (robot_bodyparts.dm:304) | `surplus prosthetic right arm` (305) | none placed | quirk (negative.dm:424-425); crate (crates.dm:163-164) |
| `/obj/item/bodypart/l_leg/robot/surplus` (robot_bodyparts.dm:312) | `surplus prosthetic left leg` (313) | none placed | quirk (negative.dm:427-428); crate (crates.dm:165-166) |
| `/obj/item/bodypart/r_leg/robot/surplus` (robot_bodyparts.dm:320) | `surplus prosthetic right leg` (321) | none placed | quirk (negative.dm:430-431); crate (crates.dm:167-168) |

### Where surplus limbs come from
- Quirk `/datum/quirk/prosthetic_limb` (`code/datums/traits/negative.dm:407-439`): name `"Prosthetic Limb"` (negative.dm:408), value -1 (negative.dm:410), hardcore_value 3 (negative.dm:413). `on_spawn` (negative.dm:415-435) picks one random limb slot (L_ARM, R_ARM, L_LEG or R_LEG, negative.dm:416), creates the matching surplus limb on the holder (negative.dm:422-431), calls `prosthetic.replace_limb(H)` and `qdel(old_part)` (negative.dm:433-434). Message on add (`post_add`, negative.dm:437-439), verbatim (the source has a line continuation):
  - `Your [slot_string] has been replaced with a surplus prosthetic. It is fragile and will easily come apart under duress. Additionally, you need to use a welding tool and cables to repair it, instead of bruise packs and ointment.` (inside `<span class='boldannounce'>`, negative.dm:438-439)
- Crate `/obj/structure/closet/crate/freezer/surplus_limbs` (`code/game/objects/structures/crates_lockers/crates.dm:155`): name `"surplus prosthetic limbs"` (crates.dm:156). `PopulateContents` (crates.dm:159-168) puts 2 x `l_arm/robot/surplus`, 2 x `r_arm/robot/surplus`, 2 x `l_leg/robot/surplus`, 2 x `r_leg/robot/surplus` (8 total) in it.

### Use: attaching
- Timing for both steps below: the listed `time` is the base. The effective do_after is `min(modded_time, 2 * time)`, where `modded_time` is scaled by the tool's `toolspeed` and the implement's `implements` value (100 = 1.0) (`code/modules/surgery/surgery_step.dm:78-93`; cap multiplier 2 at surgery_step.dm:61). The surplus limb is a bodypart with `implements` value 100 in both steps, so the base time applies unscaled (before healing-skill and location modifiers). (inferred for the exact final time)
- Surgery `prosthetic_replacement` (`code/modules/surgery/prosthetic_replacement.dm:1-9`): name `"Prosthetic replacement"` (line 2); steps incise, clamp_bleeders, retract_skin, add_prosthetic (line 3); possible_locs R_ARM, L_ARM, L_LEG, R_LEG, HEAD (line 5); only starts when the target zone has NO bodypart (line 9-14).
- Step `/datum/surgery_step/add_prosthetic` (prosthetic_replacement.dm:18-22): `implements` includes `/obj/item/bodypart = 100` (line 20); **time = 32 ds** (line 21).
  - preop (prosthetic_replacement.dm:25-64): a bodypart whose `status != BODYPART_ROBOTIC` gets organ rejection (`organ_rejection_dam = 10`, line 42). Surplus limbs are robotic, so no rejection (line 41 check).
  - Wrong zone: `"[tool] isn't the right type for [parse_zone(target_zone)]."` (line 56) and returns -1.
  - Begin message (line 52): `"<span class='notice'>You begin to replace [target]'s [parse_zone(target_zone)] with [tool]...</span>"` (plus the other two display_results messages on lines 53-54).
  - Success (prosthetic_replacement.dm:66-109): `L.attach_limb(target)`; success message `"<span class='notice'>You succeed in replacing [target]'s [parse_zone(target_zone)].</span>"` (line 83); on reject `"<span class='warning'>You fail in replacing [target]'s [parse_zone(target_zone)]! Their body has rejected [L]!</span>"` (line 76).
- Surgery `augmentation` (`code/modules/surgery/limb_augmentation.dm:36-41`): steps incise, clamp_bleeders, retract_skin, replace_limb; target human only; `requires_real_bodypart = TRUE` (line 41): it REPLACES a present organic limb with a robotic one.
- Step `/datum/surgery_step/replace_limb` (limb_augmentation.dm:7-12): `implements = list(/obj/item/bodypart = 100, /obj/item/organ_storage = 100)` (line 9); **time = 32 ds** (line 10).
  - preop (limb_augmentation.dm:15-31): non-robotic bodypart -> `"<span class='warning'>That's not an augment, silly!</span>"` (line 20). Wrong `body_zone`: `"[tool] isn't the right type for [parse_zone(target_zone)]."` (line 23).
  - success (limb_augmentation.dm:45-60): `tool.replace_limb(target, TRUE)` (line 53); `"<span class='notice'>You successfully augment [target]'s [parse_zone(target_zone)].</span>"` (line 54).

### Use: repair (the only healing that works on a robotic limb)
Robotic limbs do not take bruise packs or ointment (see the quirk message above). They are healed with:
- Welding tool, `/obj/item/weldingtool/attack` (`code/game/objects/items/tools/weldingtool.dm:109-124`): only when the target limb is robotic and the user is not on harm intent (line 115). `use_tool(H, user, 0, volume=50, amount=1)` (line 116): **delay 0 ds**. Then `item_heal_robotic(H, user, 15, 0)` (line 122): **brute heal 15, burn 0**. If the user is repairing themselves: `"You start fixing some of the dents on your [affecting.name]."` and `do_mob(user, H, 50)` (lines 117-121), **50 ds**.
- Cable coil, `/obj/item/stack/cable_coil/attack` (`code/modules/power/cable.dm:508-522`): only on robotic limbs (line 513). `item_heal_robotic(H, user, 0, 15)` (line 518): **burn heal 15, brute 0**, consumes 1 cable (`use(1)`, line 519). Self-repair: `"You start fixing some of the wires in your [affecting.name]."` and `do_mob(user, H, 50)` (lines 514-517), **50 ds**.
- `item_heal_robotic` (`code/modules/mob/mob_helpers.dm:406-421`): calls `affecting.heal_damage(brute_heal, burn_heal, 0, BODYPART_ROBOTIC)` (line 415) only if the matching damage is above 0 (line 414). Success message: `"[user] fixes some of the [dam ? "dents on" : "burnt wires in"] [H]'s [affecting.name]."` (line 417) (dents when brute > burn). If nothing to heal: `"[affecting] is already in good condition!"` (line 421).
- The welder and cable repair only target the limb in `check_zone(user.zone_selected)` of a human (weldingtool.dm:113, cable.dm:512). The item on the floor cannot be repaired this way.

### Gotchas
- Max damage 20 (robot_bodyparts.dm:302) is 40% of the organic limb's 50 (parts.dm:65) and of the robot limb's inherited 50. The surplus limb reaches its damage cap sooner.
- Zero brute and burn reduction (robot_bodyparts.dm:300-301): every point of damage counts, where the robot limb takes 5 brute and 4 burn less (robot_bodyparts.dm:23-24).
- A surplus limb is robotic, so `prosthetic_replacement` gives no organ-rejection damage (prosthetic_replacement.dm:41-42).
- Surplus limbs have no design: they cannot be researched or fabricated, and the BoxStation list has none placed.

# gap-items-01 part 4: cameras and film (3 entries)

Source tree: `_src/tg2020`. Raw numbers; cooldowns and `addtimer` delays are deciseconds.

## Parent: cameras

### `/obj/item/camera` (base, `code/modules/photography/camera/camera.dm:4`)
- name = `"camera"` (camera.dm:5); desc = `"A polaroid camera."` (camera.dm:7); icon 'icons/obj/items_and_weapons.dmi', icon_state `"camera"`, state_on `"camera"`, state_off `"camera_off"` (camera.dm:8, 20-21)
- w_class = WEIGHT_CLASS_SMALL (camera.dm:14) = 2; flags_1 = CONDUCT_1 (camera.dm:15); slot_flags = ITEM_SLOT_NECK (camera.dm:16) = `1<<12` (`code/__DEFINES/inventory.dm:35`)
- custom_materials = list(iron = 50, glass = 150) (camera.dm:17); custom_price = 120 (camera.dm:18)
- light_color LIGHT_COLOR_WHITE (camera.dm:12); light_power FLASH_LIGHT_POWER = 3 (camera.dm:13, `code/__DEFINES/lighting.dm:113`)
- Vars (camera.dm:19-38):
  - `flash_enabled = TRUE` (camera.dm:19): a flash lighting effect `flash_lighting_fx(8, light_power, light_color)` runs on each capture (camera.dm:161-162)
  - `pictures_max = 10`, `pictures_left = 10` (camera.dm:22-23)
  - `on = TRUE` (camera.dm:24); `cooldown = 64` (camera.dm:25, ds)
  - `see_ghosts = CAMERA_NO_GHOSTS` (camera.dm:27) = 0 (`code/__DEFINES/misc.dm:444`)
  - `picture_size_x = 2`, `picture_size_y = 2` (camera.dm:31-32); min 1 and 1 (camera.dm:33-34); max 4 and 4 (camera.dm:35-36)
  - `can_customise = TRUE` (camera.dm:37); `disk` (camera.dm:28, holodisk slot)
- Interactions:

  | held item / action | condition | delay (ds) | message(s) verbatim | result |
  |---|---|---|---|---|
  | `attack_self` | `disk` present | 0 | `"<span class='notice'>You eject [disk] out the back of [src].</span>"` (camera.dm:43) | disk put in hands (camera.dm:40-45). With no disk: nothing |
  | `AltClick` | `user.canUseTopic(src, BE_CLOSE)` (camera.dm:65-67) | 0 | prompts (below) | `adjust_zoom(user)` |
  | `adjust_zoom` input | | 0 | `input(user, "How high do you want the camera to shoot, between [picture_size_x_min] and [picture_size_x_max]?", "Zoom", picture_size_x)` (camera.dm:52), then `"How wide do you want the camera to shoot, between [picture_size_y_min] and [picture_size_y_max]?"` (camera.dm:57) | `picture_size_x = min(clamp(x, min, max), CAMERA_PICTURE_SIZE_HARD_LIMIT)` (camera.dm:62-63); `CAMERA_PICTURE_SIZE_HARD_LIMIT` = 21 (camera.dm:2) |
  | `attack` (hit a mob) | | 0 | none | does nothing (camera.dm:70-71) |
  | `attackby` film `/obj/item/camera_film`, pictures_left > 0 | | 0 | `"<span class='notice'>[src] still has some film in it!</span>"` (camera.dm:76) | refused |
  | `attackby` film, pictures_left = 0 | | 0 | `"<span class='notice'>You insert [I] into [src].</span>"` (camera.dm:80) | film qdel'd, `pictures_left = pictures_max` (camera.dm:78-82) |
  | `attackby` `/obj/item/disk/holodisk`, no disk yet | | 0 | `"<span class='notice'>You slide [I] into the back of [src].</span>"` (camera.dm:89); `"<span class='warning'>[I] is stuck to your hand!</span>"` if the transfer fails (camera.dm:87) | disk slotted (camera.dm:84-93) |
  | `attackby` holodisk, disk already present | | 0 | `"<span class='warning'>There's already a disk inside [src].</span>"` (camera.dm:92) | refused |
  | `afterattack(target, user, flag)` (take a picture) | `can_target` (below) | `cooldown` 64 (camera.dm:25, 142); halved if `HAS_TRAIT(H, TRAIT_PHOTOGRAPHER)` (camera.dm:139-141; `TRAIT_PHOTOGRAPHER` = "photographer", `code/__DEFINES/traits.dm:219`) | none on success | `on = FALSE`, `addtimer(CALLBACK(src, .proc/cooldown), realcooldown)`, `icon_state = state_off` (camera.dm:136-144); `captureimage` runs async (camera.dm:146) |
  | `afterattack` with a disk, target not a mob | | 0 | `"<span class='warning'>Invalid holodisk target.</span>"` (camera.dm:130) | returns |

- `can_target(target, user, prox_flag)` (camera.dm:101-117): returns FALSE if `!on`, `blending`, or `!pictures_left` (camera.dm:102); target must be on a turf visible to the user (`get_hear` or `view`) (camera.dm:104-116).
- `captureimage(target, user, flag, size_x, size_y)` (camera.dm:160-214): 
  - the photo description starts with `"This is a photo of an area of [size_x+1] meters by [size_y+1] meters."` (camera.dm:170). Each visible mob adds `get_photo_description` (camera.dm:201).
  - the captured block is `block(target.x - size_x ... target.x + size_x)` (camera.dm:183), i.e. `2*size + 1` turfs per side. `afterattack` passes `picture_size - 1` (camera.dm:146), so the default `picture_size_x = 2` captures 3 x 3 turfs but the text says "2 meters by 2 meters". Source inconsistency (gotcha). Image size `psize = (size*2+1) * world.icon_size` (camera.dm:203-204).
  - `size` clamped to 0..21 (camera.dm:168-169).
- `after_picture` -> `printpicture` (camera.dm:216-244):
  - creates a `/obj/item/photo` at the camera's turf and puts it in the user's hands if `in_range` (camera.dm:220-222)
  - `pictures_left--`; `"[pictures_left] photos left."` (camera.dm:223-224)
  - if `can_customise`: `alert(user, "Do you want to customize the photo?", "Customization", "Yes", "No")` (camera.dm:226-227). On Yes: name `"Set a name for this photo, or leave blank. 32 characters max."` (camera.dm:229), description `"Set a description to add to photo, or leave blank. 128 characters max."` (camera.dm:230), caption `"Set a caption for this photo, or leave blank. 256 characters max."` (camera.dm:231).
  - `default_picture_name` used if the user says No (camera.dm:238-240).
  - logs to file if `CONFIG_GET(flag/picture_logging_camera)` (camera.dm:243-244).
- `examine` (camera.dm:47-49, 96-98): `"<span class='notice'>Alt-click to change its focusing, allowing you to set how big of an area it will capture.</span>"` and `"It has [pictures_left] photos left."`
- Power: none. Cell: none.
- Ghosts: see_ghosts is checked only in `camera_image_capturing.dm:37` and `:49` (invisible observers drawn into the photo if the camera's `see_ghosts` is truthy) and `observer.dm:148-149` (`"You can also see a g-g-g-g-ghooooost!"` is added to the photo description). Any non-zero value does the same thing; the code does not separate BASIC from ORBIT.
- Gotchas:
  - `cooldown` is a flat wait after every shot (64 ds), halved only for TRAIT_PHOTOGRAPHER holders (camera.dm:139-142).
  - Film is not a count: refilling sets `pictures_left` to `pictures_max` (camera.dm:82), which is 10 on the base and 30 on the detective camera.
  - The base camera starts with `pictures_left = 10` (camera.dm:23). The film cartridge is only needed to reload after those are used up.
  - Design: autolathe `camera` (autolathe_designs.dm:216-222) costs iron 50 + glass 100 (line 220), but the item's custom_materials are iron 50 + glass 150 (camera.dm:17). The design and the item disagree on glass.

## Sub-family: camera variants

| DM path (def line) | in-game name (line) | desc (line) | own vars (line) | BoxStation count |
|---|---|---|---|---|
| `/obj/item/camera/spooky` (`code/modules/photography/camera/other.dm:1`) | `camera obscura` (other.dm:2) | `"A polaroid camera, some say it can see ghosts!"` (other.dm:3) | `see_ghosts = CAMERA_SEE_GHOSTS_BASIC` (other.dm:4) = 1 (`code/__DEFINES/misc.dm:445`) | no count on the list (none placed) |
| `/obj/item/camera/detective` (other.dm:10) | `Detective's camera` (other.dm:11) | `"A polaroid camera with extra capacity for crime investigations."` (other.dm:12) | `pictures_max = 30` (other.dm:13), `pictures_left = 30` (other.dm:14) | x1 |
| `/obj/item/camera_film` (`code/modules/photography/camera/film.dm:4`) | `film cartridge` (film.dm:5) | `"A camera film cartridge. Insert it into a camera to reload it."` (film.dm:7) | see below | x3 |

### `/obj/item/camera/spooky` (other.dm:1)
- Inherits everything from `/obj/item/camera`: cooldown 64 (camera.dm:25), pictures 10 (camera.dm:22), custom_price 120 (camera.dm:18), materials iron 50 / glass 150 (camera.dm:17).
- Only override: `see_ghosts = CAMERA_SEE_GHOSTS_BASIC` (other.dm:4). Ghosts appear in its photos (see the base section).
- Child `/obj/item/camera/spooky/badmin` (other.dm:6-8) is not on this list: `see_ghosts = CAMERA_SEE_GHOSTS_ORBIT` (other.dm:8) = 2.
- Design: none. A grep of `code` for `build_path = /obj/item/camera` finds only the base camera (autolathe_designs.dm:221) and the film (autolathe_designs.dm:229).

### `/obj/item/camera/detective` (other.dm:10)
- Inherits everything from `/obj/item/camera` except the capacity: `pictures_max = 30`, `pictures_left = 30` (other.dm:13-14). Cooldown stays 64 ds (camera.dm:25).
- Design: none. Same grep as the spooky camera: no `build_path` for `/obj/item/camera/detective`.

### `/obj/item/camera_film` (film.dm:4)
- name = `"film cartridge"` (film.dm:5); desc (film.dm:7) as above; icon 'icons/obj/items_and_weapons.dmi', icon_state `"film"` (film.dm:6, 8); inhand_icon_state `"electropack"` (film.dm:9); lefthand/righthand 'icons/mob/inhands/misc/devices_lefthand.dmi' / 'icons/mob/inhands/misc/devices_righthand.dmi' (film.dm:10-11)
- w_class = WEIGHT_CLASS_TINY (film.dm:12) = 1 (`code/__DEFINES/inventory.dm:5`)
- resistance_flags = FLAMMABLE (film.dm:13) = `1<<2` (`code/__DEFINES/flags.dm:83`)
- custom_materials = list(iron = 10, glass = 10) (film.dm:14)
- No procs, no attack or use messages of its own. It is used only through the camera's `attackby` (camera.dm:73-83, messages in the camera table above).
- Design: `camera_film` (autolathe_designs.dm:224-230): iron 10, glass 10 (228). Matches the item.
- Film holds no charges: it is consumed (`qdel(I)`, camera.dm:81) and adds `pictures_max` to the camera.

---

## Gotchas (this sub-family)
- The "2 meters by 2 meters" photo description covers 3 x 3 turfs at default zoom (camera.dm:170 vs 183 and 146). Source inconsistency.
- The autolathe camera design (glass 100) does not match the item (glass 150, camera.dm:17).
- Detective camera has 30 photos, the base 10; the film refills to `pictures_max`, so it refills a detective camera to 30.

# gap-items-01 part 5: departmental budget card (1 entry)

Source tree: `_src/tg2020`. Raw numbers.

## Parents: cards

### `/obj/item/card` (base, `code/game/objects/items/cards_ids.dm:15`)
- name = `"card"` (cards_ids.dm:16); desc = `"Does card things."` (cards_ids.dm:17); icon 'icons/obj/card.dmi' (cards_ids.dm:18); w_class = WEIGHT_CLASS_TINY (cards_ids.dm:19) = 1 (`code/__DEFINES/inventory.dm:5`); `var/list/files = list()` (cards_ids.dm:21)
- `suicide_act` (cards_ids.dm:23-25): `"<span class='suicide'>[user] begins to swipe [user.p_their()] neck with \the [src]! It looks like [user.p_theyre()] trying to commit suicide!</span>"`, returns BRUTELOSS.

### `/obj/item/card/id` (base, `code/game/objects/items/cards_ids.dm:64`)
- name = `"identification card"` (cards_ids.dm:65); desc = `"A card used to provide ID and determine access across the station."` (cards_ids.dm:66); icon_state `"id"` (cards_ids.dm:67); inhand_icon_state `"card-id"` (cards_ids.dm:68)
- slot_flags = ITEM_SLOT_ID (cards_ids.dm:71)
- armor = list(melee 0, bullet 0, laser 0, energy 0, bomb 0, bio 0, rad 0, fire 100, acid 100) (cards_ids.dm:72)
- resistance_flags = FIRE_PROOF | ACID_PROOF (cards_ids.dm:73)
- `var/list/access = list()` (cards_ids.dm:76): no station access by default. `registered_name = null` (cards_ids.dm:77), `assignment = null` (cards_ids.dm:78), `registered_account` (cards_ids.dm:80), `uses_overlays = TRUE` (cards_ids.dm:82), `registered_age = 13` (cards_ids.dm:84)
- `attack_self` (cards_ids.dm:99-105): if adjacent, shows the card: `"<span class='notice'>[user] shows you: [icon2html(src, viewers(user))] [src.name][minor].</span>"` / `"<span class='notice'>You show \the [src.name][minor].</span>"` with `minor = " <b>(MINOR)</b>"` only if `registered_age < AGE_MINOR` (cards_ids.dm:101-104).
- `attackby` (cards_ids.dm:114-134): holochip -> `insert_money` (cards_ids.dm:115-116); `/obj/item/stack/spacecash` -> `insert_money(W, user, TRUE)` (cards_ids.dm:118-119); `/obj/item/coin` -> same (cards_ids.dm:121-123); `/obj/item/storage/bag/money` -> `mass_insert_money` (cards_ids.dm:124-132); `"You stuff the contents into the card! They disappear in a puff of bluespace smoke, adding [money_added] worth of credits to the linked account."` (cards_ids.dm:131). Otherwise `..()`.
- `insert_money(I, user, physical_currency)` (cards_ids.dm:136-155). Messages verbatim:
  - no value: `"<span class='warning'>[I] doesn't seem to be worth anything!</span>"` (cards_ids.dm:139)
  - no `registered_account`: `"<span class='warning'>[src] doesn't have a linked account to deposit [I] into!</span>"` (cards_ids.dm:143)
  - physical currency: `"<span class='notice'>You stuff [I] into [src]. It disappears in a small puff of bluespace smoke, adding [cash_money] credits to the linked account.</span>"` (cards_ids.dm:150)
  - holochip: `"<span class='notice'>You insert [I] into [src], adding [cash_money] credits to the linked account.</span>"` (cards_ids.dm:152)
  - always after: `"<span class='notice'>The linked account now reports a balance of [registered_account.account_balance] cr.</span>"` (cards_ids.dm:154); the item is qdel'd (cards_ids.dm:155). Deposit = `registered_account.adjust_money(cash_money)` (cards_ids.dm:146).

## Sub-family: departmental budget cards

### `/obj/item/card/id/departmental_budget` (`code/game/objects/items/cards_ids.dm:704`)
- name = `"departmental card (FUCK)"` (cards_ids.dm:705). **This placeholder is the literal name in the source.** It is replaced at Initialize when the account exists (see below).
- desc = `"Provides access to the departmental budget."` (cards_ids.dm:706); icon_state `"budgetcard"` (cards_ids.dm:707); `uses_overlays = FALSE` (cards_ids.dm:708)
- `var/department_ID = ACCOUNT_CIV` (cards_ids.dm:709) = `"CIV"` (`code/__DEFINES/economy.dm:15`); `var/department_name = ACCOUNT_CIV_NAME` (cards_ids.dm:710) = `"Civil Budget"` (`economy.dm:16`); `registered_age = null` (cards_ids.dm:711): no age, so no MINOR tag.
- `Initialize` (cards_ids.dm:713-722): parent init, then `B = SSeconomy.get_dep_account(department_ID)`; if found: `registered_account = B`, add the card to `B.bank_cards` (if not already there), `name = "departmental card ([department_name])"` (cards_ids.dm:720), `desc = "Provides access to the [department_name]."` (cards_ids.dm:721). Always: `SSeconomy.dep_cards += src` (cards_ids.dm:722).
- `Destroy` (cards_ids.dm:724-726): `SSeconomy.dep_cards -= src`, then parent.
- `update_label` (cards_ids.dm:728-729): returns nothing, so the card never gets an assignment label.
- `AltClick` (cards_ids.dm:736-737): `registered_account.bank_card_talk("<span class='warning'>Withdrawing is not compatible with this card design.</span>", TRUE)`. The card cannot withdraw money, only deposit (via `attackby`).
- Access: none (`access` is `list()` from cards_ids.dm:76; no `access_txt`).
- Power, cell, reagents: none.
- Construction: no autolathe, protolathe or other `build_path` for this path was found in `code` (grep `build_path = /obj/item/card/id/departmental_budget`: no match).

### `/obj/item/card/id/departmental_budget/car` (`code/game/objects/items/cards_ids.dm:731`)
- `department_ID = ACCOUNT_CAR` (cards_ids.dm:732) = `"CAR"` (`code/__DEFINES/economy.dm:25`)
- `department_name = ACCOUNT_CAR_NAME` (cards_ids.dm:733) = `"Cargo Budget"` (`code/__DEFINES/economy.dm:26`)
- `icon_state = "car_budget"` (cards_ids.dm:734); source comment `// saving up for a new tesla` (cards_ids.dm:734)
- Everything else inherited from `departmental_budget` above.
- After Initialize (with the Cargo account present): name = `departmental card (Cargo Budget)`, desc = `Provides access to the Cargo Budget.` (from cards_ids.dm:720-721 with the Cargo values).
- Without the account the name stays `departmental card (FUCK)` (cards_ids.dm:705).
- BoxStation: listed as `/obj/item/card/id/departmental_budget/car	departmental card (FUCK)` with no count in the list (none placed by the list).

### Uses for this path
| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| holochip | `registered_account` set | 0 | `"<span class='notice'>You insert [I] into [src], adding [cash_money] credits to the linked account.</span>"` (cards_ids.dm:152) | credits added to Cargo account (cards_ids.dm:146), holochip qdel'd |
| spacecash stack or coin | `registered_account` set | 0 | `"<span class='notice'>You stuff [I] into [src]. It disappears in a small puff of bluespace smoke, adding [cash_money] credits to the linked account.</span>"` (cards_ids.dm:150) | same |
| money bag | `registered_account` set | 0 | `"You stuff the contents into the card! ..."` (cards_ids.dm:131) | `mass_insert_money` |
| any cash, no account | `registered_account` null | 0 | `"<span class='warning'>[src] doesn't have a linked account to deposit [I] into!</span>"` (cards_ids.dm:143) | refused |
| `attack_self` | adjacent | 0 | `"<span class='notice'>You show \the [src.name].</span>"` (cards_ids.dm:104) | shows the name |
| AltClick | any | 0 | `"<span class='warning'>Withdrawing is not compatible with this card design.</span>"` (cards_ids.dm:737) | no withdrawal |

## Gotchas
- Name placeholder `departmental card (FUCK)` (cards_ids.dm:705) shows in the list and in the source until Initialize renames the card. A card that never gets an account keeps it.
- The card has no `access`, so it opens no doors. Its only function is the budget (deposit by attackby, AltClick withdrawal blocked).
- Deposit is one-way: the message at cards_ids.dm:737 refuses withdrawals on this card design.

# gap-items-01 part 6: circular saw (1 entry)

Source tree: `_src/tg2020`. Raw numbers in deciseconds (ds).

## Parent
The circular saw is a direct child of `/obj/item` (`code/modules/surgery/tools.dm:131`). Its siblings in the same file (retractor, hemostat, cautery, surgicaldrill, scalpel) are not on this list and are not documented here.

## Sub-family: saws

### `/obj/item/circular_saw` (`code/modules/surgery/tools.dm:131`)
- name = `"circular saw"` (tools.dm:132); desc = `"For heavy duty cutting."` (tools.dm:133)
- icon 'icons/obj/surgery.dmi', icon_state `"saw"` (tools.dm:134-135); lefthand 'icons/mob/inhands/equipment/medical_lefthand.dmi', righthand 'icons/mob/inhands/equipment/medical_righthand.dmi' (tools.dm:136-137)
- hitsound = `'sound/weapons/circsawhit.ogg'` (tools.dm:138); mob_throw_hit_sound = `'sound/weapons/pierce.ogg'` (tools.dm:139)
- flags_1 = CONDUCT_1 (tools.dm:140); item_flags = SURGICAL_TOOL (tools.dm:141)
- force = 15 (tools.dm:142); throwforce = 9 (tools.dm:144); throw_speed = 2 (tools.dm:145); throw_range = 5 (tools.dm:146)
- w_class = WEIGHT_CLASS_NORMAL (tools.dm:143) = 3 (`code/__DEFINES/inventory.dm:9`)
- custom_materials = list(iron = 1000) (tools.dm:147). No glass.
- attack_verb = `list("attacked", "slashed", "sawed", "cut")` (tools.dm:148)
- sharpness = IS_SHARP (tools.dm:149)
- tool_behaviour = TOOL_SAW (tools.dm:150) = `"saw"` (`code/__DEFINES/tools.dm:16`); toolspeed = 1 (tools.dm:151)
- wound_bonus = 10 (tools.dm:152); bare_wound_bonus = 15 (tools.dm:153)
- `Initialize` (tools.dm:155-157): `AddComponent(/datum/component/butchering, 40 * toolspeed, 100, 5, 'sound/weapons/circsawhit.ogg')`. Component args: speed = 40 ds, effectiveness = 100, bonus_modifier = 5, butcher sound = circsawhit. The comment in source: "saws are very accurate and fast at butchering" (tools.dm:157).
- Child `/obj/item/circular_saw/augment` (tools.dm:159-163) and `/obj/item/circular_saw/alien` (`code/modules/antagonists/abductor/equipment/abduction_gear.dm:735`) are not on this list.

### Interactions

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| attack a dead mob with butcher results, intent HARM | `sharpness` (`IS_SHARP`) and component `butchering_enabled` (`datums/components/butchering.dm:25-31`) | `speed` = 40 from tools.dm:157 (component default is 80, `butchering.dm:2`), used as `do_mob` time (`butchering.dm:46`) | `"You begin to butcher [M]..."` (butchering.dm:44); on success `"[butcher] butchers [meat]."` / `"You butcher [meat]."` (butchering.dm:104-105) | `Butcher()` (butchering.dm:78-108): drops `butcher_results`, sinew, then `meat.gib(FALSE, FALSE, TRUE)` (butchering.dm:108) |
| butcher roll per bone (inside Butcher) | `prob(final_effectiveness)` where `final_effectiveness = effectiveness - meat.butcher_difficulty` (butchering.dm:80, 86) | 0 | `"<span class='warning'>You fail to harvest some of the [initial(bones.name)] from [meat].</span>"` (butchering.dm:88); extra: `"<span class='info'>You harvest some extra [initial(bones.name)] from [meat]!</span>"` (butchering.dm:91) | extra bonus chance = `max(0, (final_effectiveness - 100) + bonus_modifier)` (butchering.dm:81); extra gives 2 of the bone (butchering.dm:92-93) |
| attack a human, intent HARM, pulling them with an aggressive grab, zone `head` (`butchering.dm:33-41`) | `user.pulling == H`, `grab_state >= GRAB_AGGRESSIVE`, `zone_selected == BODY_ZONE_HEAD`, and `source.force` and sharp | `do_mob(user, H, clamp(500 / source.force, 30, 100))` (butchering.dm:62): 500 / 15 = 33.33 ds for force 15 (clamped min 30, max 100) | `"[user] is slitting [H]'s throat!"` / `"You start slicing [H]'s throat!"` / `"You hear a cutting noise!"` (butchering.dm:54-56); to H: `"Your throat is being slit by [user]!"` (butchering.dm:57); `playsound` `butcher_sound` (butchering.dm:61) | on completion: `"[user] slits [H]'s throat!"` (butchering.dm:68), to H `"[user] slits your throat..."` (butchering.dm:69); `apply_damage(source.force, BRUTE, BODY_ZONE_HEAD, wound_bonus=CANT_WOUND)` (butchering.dm:71) = 15 brute; a critical cut wound `/datum/wound/brute/cut/critical` on the head (butchering.dm:72-75); `apply_status_effect(/datum/status_effect/neck_slice)` (butchering.dm:76). A second slice: `"<span class='warning'>[H]'s neck has already been already cut, you can't make the bleeding any worse!</span>"` (butchering.dm:37-38, 63-65) |
| already interacting | `INTERACTING_WITH(user, H)` | 0 | `"<span class='warning'>You're already interacting with [H]!</span>"` (butchering.dm:51) | no slice |
| surgery step `saw bone` (`/datum/surgery_step/saw`) | `implements` TOOL_SAW = 100 (`code/modules/surgery/organic_steps.dm:111`) | base **54** (organic_steps.dm:113); see the timing note below the table | preop `"<span class='notice'>You begin to saw through the bone in [target]'s [parse_zone(target_zone)]...</span>"` (organic_steps.dm:116); success `"<span class='notice'>You saw [target]'s [parse_zone(target_zone)] open.</span>"` (organic_steps.dm:127) | success applies `apply_damage(50, BRUTE, "[target_zone]", wound_bonus=CANT_WOUND)` (organic_steps.dm:126) |
| surgery step `sever limb` (`/datum/surgery_step/sever_limb`) | `implements` TOOL_SAW = 100 (`code/modules/surgery/amputation.dm:12`) | base **64** (amputation.dm:13) | preop `"<span class='notice'>You begin to sever [target]'s [parse_zone(target_zone)]...</span>"` (amputation.dm:17); success `"<span class='notice'>You sever [L]'s [parse_zone(target_zone)].</span>"` (amputation.dm:23) | `drop_limb()` on the operated bodypart (amputation.dm:26-28) |
| surgery step `cut excess fat` (`/datum/surgery_step/cut_fat`) | `implements` TOOL_SAW = 100 (`code/modules/surgery/lipoplasty.dm:15`) | base **64** (lipoplasty.dm:16) | preop `"<span class='notice'>You begin to cut away [target]'s excess fat...</span>"` (lipoplasty.dm:20); success `"<span class='notice'>You cut [target]'s excess fat loose.</span>"` (lipoplasty.dm:25) | lipoplasty surgery steps (lipoplasty.dm:3) |
| surgery step `excise infection` (`/datum/surgery_step/debride`) | `implements` TOOL_SAW = 60 (`code/modules/surgery/burn_dressing.dm:24`) | base **30** (burn_dressing.dm:25); with the saw's 60 the step runs longer (timing note) | preop `"<span class='notice'>You begin to excise infected flesh from [target]'s [parse_zone(user.zone_selected)]...</span>"` (burn_dressing.dm:37); if no infected flesh: `"<span class='notice'>[target]'s [parse_zone(user.zone_selected)] has no infected flesh to remove!</span>"` (burn_dressing.dm:33) | `repeatable = TRUE` (burn_dressing.dm:26); burn-wound step (burn_dressing.dm:22) |
| crafting `Chainsaw` (`/datum/crafting_recipe/chainsaw`, `code/datums/components/crafting/recipes.dm:342-349`) | needs this saw x1, `/obj/item/stack/cable_coil` x3, `/obj/item/stack/sheet/plasteel` x5 (recipes.dm:345-347); tool TOOL_WELDER (recipes.dm:348) | **50** (recipes.dm:349) | (craft messages not checked) | result `/obj/item/chainsaw` (recipes.dm:344) |

Timing note for every surgery row (`code/modules/surgery/surgery_step.dm`):
- The `implements` number is documented as "probability of success" (surgery_step.dm:3), but the code also uses it as a speed factor: `implement_speed_mod = implements[implement_type] / 100.0` (surgery_step.dm:83).
- `speed_mod` starts from `tool.toolspeed` (surgery_step.dm:79; the saw is 1, tools.dm:151), is divided by `get_location_modifier(target) * (1 + surgery.speed_modifier) * implement_speed_mod`, and `modded_time = time * speed_mod * healing skill SKILL_SPEED_MODIFIER` (surgery_step.dm:85-86).
- `fail_prob` = modded_time minus `time * SURGERY_SLOWDOWN_CAP_MULTIPLIER`, capped at 99 (surgery_step.dm:89). The multiplier is 2 (surgery_step.dm:61). The do_after time is `min(modded_time, time * 2)` (surgery_step.dm:90). Cyborg users always get `time` (surgery_step.dm:92-93).
- So at the saw's 100 the base time is used (e.g. 54 ds for saw bone). With the debride saw value 60 the modded time is 30 / 0.6 = 50 ds (inferred from the formula, healing skill and location modifiers not included). (inferred)
- Other tools listed for the same steps (e.g. shears 300 in amputation.dm:12) are faster by the same formula; that is the number's real effect.

### Drops, health, power
- Drops: the saw itself has no drop code. Butchering a dead mob drops `butcher_results` and sinew on the mob's turf (butchering.dm:78-102).
- Health / armor: none set (the saw is not clothing). Inherits `max_integrity` 200 default from `/obj` (`code/game/objects/items.dm:57`) and the default armor (all zero, `code/datums/armor.dm:22`).
- Power: none.

### Construction and availability
- Autolathe design `circular_saw` (`code/modules/research/designs/autolathe_designs.dm:507-514`): **iron 10000, glass 6000** (autolathe_designs.dm:511), `build_type = AUTOLATHE | PROTOLATHE` (510), category `"initial", "Medical", "Tool Designs"` (513), departmental flags MEDICAL | SCIENCE (514). **The design costs 10x the iron of the item's own `custom_materials` (iron 1000, tools.dm:147), and it adds 6000 glass the item does not list.** Source inconsistency.
- Spawned in:
  - `/obj/item/storage/firstaid/medical` (`code/game/objects/items/storage/firstaid.dm:95`, inside the medical first aid kit, which starts at firstaid.dm:57)
  - `/obj/item/storage/belt/medical` (`code/game/objects/items/storage/belt.dm:164`; the belt starts at belt.dm:126)
  - `/obj/item/storage/backpack/duffelbag/med/surgery` (`code/game/objects/items/storage/backpack.dm:373`; the duffel starts at backpack.dm:365)
  - `/obj/item/storage/backpack/duffelbag/sec/surgery` (backpack.dm:395; starts at backpack.dm:387)
  - `/obj/item/storage/backpack/duffelbag/syndie/surgery` (backpack.dm:481; starts at backpack.dm:471)
  - vendor `/obj/machinery/vending/robotics`: stock 2 (`code/modules/vending/robotics.dm:18`)
  - cat butcher loot (`code/modules/mob/living/simple_animal/hostile/cat_butcher.dm:24`)
  - Robot module list (`code/modules/mob/living/silicon/robot/robot_modules.dm:284`) and the augmentation arm contents (`code/modules/surgery/organs/augments_arms.dm:238` uses `/obj/item/circular_saw/augment`, not this path)
- BoxStation: x1 (list).

### Gotchas
- The saw is `TOOL_SAW` for surgery, so it works as the saw step and for the lipoplasty and debride steps. It is not a `TOOL_SCALPEL`.
- The butchering component is registered on any item with a sharpness, but needs `sharpness` to be set on the item for the dead-mob path (`butchering.dm:29`). The saw is `IS_SHARP` (tools.dm:149).
- Neck slice time depends on force: `500 / force` (butchering.dm:62). The saw's 15 force gives 33.33 ds.
- Autolathe cost (iron 10000, glass 6000) vs item material (iron 1000): see the construction note.

# gap-items-01 part 7: boxing gloves and rainbow gloves (4 entries)

Source tree: `_src/tg2020`. Raw numbers in ds. Chain: `/obj/item/clothing/gloves` (`_gloves.dm`) -> `/obj/item/clothing/gloves/boxing` (`boxing.dm`, plus the martial-art hooks in `code/datums/martial/boxing.dm`) -> colour children. Rainbow: `/obj/item/clothing/gloves/color` -> `/rainbow`.

## Parents: gloves

### `/obj/item/clothing/gloves` (base, `code/modules/clothing/gloves/_gloves.dm:1`)
- name = `"gloves"` (_gloves.dm:2); gender = PLURAL (_gloves.dm:3)
- w_class = WEIGHT_CLASS_SMALL (_gloves.dm:4) = 2; icon 'icons/obj/clothing/gloves.dmi' (_gloves.dm:5)
- siemens_coefficient = 0.5 (_gloves.dm:6): electrical conductance 0.5 (items default is 1, `code/game/objects/items.dm:114`)
- body_parts_covered = HANDS (_gloves.dm:7); slot_flags = ITEM_SLOT_GLOVES (_gloves.dm:8)
- attack_verb = `list("challenged")` (_gloves.dm:9); transfer_prints = FALSE (_gloves.dm:10)
- strip_delay = 20 (_gloves.dm:11) (items default 40, `items.dm:126`); equip_delay_other = 40 (_gloves.dm:12) (items default 20, `items.dm:124`)
- Armor: none set, so all zero (`code/game/objects/objs.dm:62-63`, `code/datums/armor.dm:22`)
- Inherited from `/obj/item/clothing` (`code/modules/clothing/clothing.dm:1-5`): max_integrity = 200 (clothing.dm:4), integrity_failure = 0.4 (clothing.dm:5), resistance_flags = FLAMMABLE (clothing.dm:3)
- `clean_blood` (signal `COMSIG_COMPONENT_CLEAN_ACT`, _gloves.dm:14-21): at or above `CLEAN_STRENGTH_BLOOD`, sets `transfer_blood = 0`.
- `suicide_act` (_gloves.dm:23-25): `"<span class='suicide'>\the [src] are forcing [user]'s hands around [user.p_their()] neck! It looks like the gloves are possessed!</span>"`, returns OXYLOSS.
- `Touch` (_gloves.dm:42-43): hook returning 0, no effect.

### `/obj/item/clothing/gloves/boxing` (`code/modules/clothing/gloves/boxing.dm:1`)
- name = `"boxing gloves"` (boxing.dm:2); desc = `"Because you really needed another excuse to punch your crewmates."` (boxing.dm:3)
- icon_state = `"boxing"` (boxing.dm:4); inhand_icon_state = `"boxing"` (boxing.dm:5)
- **equip_delay_other = 60** (boxing.dm:6) (base gloves 40, _gloves.dm:12)
- species_exception = `list(/datum/species/golem)` (boxing.dm:7): golems can wear them ("now you too can be a golem boxing champion", source comment)
- Martial art (`code/datums/martial/boxing.dm:54-73`):
  - `var/datum/martial_art/boxing/style = new` (datums/martial/boxing.dm:55): each glove holds its own style datum.
  - `equipped(user, slot)` (datums/martial/boxing.dm:57-64): if a human puts it on ITEM_SLOT_GLOVES, `style.teach(H, 1)` (line 63).
  - `dropped(user)` (datums/martial/boxing.dm:66-73): if the human's glove slot still holds this glove, `style.remove(H)` (line 72).
- The martial art `/datum/martial_art/boxing` (datums/martial/boxing.dm:1-52):
  - name = `"Boxing"` (line 2); id = MARTIALART_BOXING (line 3)
  - `disarm_act` (line 5-7): `"<span class='warning'>Can't disarm while boxing!</span>"` (line 6), returns 1
  - `grab_act` (line 9-11): `"<span class='warning'>Can't grab while boxing!</span>"` (line 10), returns 1
  - `harm_act` (line 13-50): replaces a normal punch. Damage `rand(5, 8) + A.dna.species.punchdamagelow` (line 19), applied as **STAMINA** damage (line 38), reduced by `run_armor_check(affecting, "melee")` (line 30). Verb picked from `"left hook"`, `"right hook"`, `"straight punch"` (line 17). Messages: `"<span class='warning'>[A]'s [atk_verb] misses [D]!</span>"` (line 22); on a hit `"<span class='danger'>[A] [atk_verb]ed [D]!</span>"` (line 34) and `"<span class='userdanger'>You're [atk_verb]ed by [A]!</span>"` (line 35).
  - Knockout (line 40-49): when `D.getStaminaLoss() > 50` and D is in a boxing style: `knockout_prob = D.getStaminaLoss() + rand(-15,15)` (line 41); on success `"<span class='danger'>[A] knocks [D] out with a haymaker!</span>"` (line 43), `apply_effect(200, EFFECT_KNOCKDOWN, armor_block)` (line 46), `SetSleeping(100)` (line 47), `forcesay(GLOB.hit_appends)` (line 48). Otherwise, if D is down, `forcesay` (line 50-51).
- Other interactions:
  - Crafting `Extendo-Hand` (`code/datums/components/crafting/recipes.dm:497-501`): reqs = `/obj/item/bodypart/r_arm/robot` x1 and `/obj/item/clothing/gloves/boxing` x1 (recipes.dm:499); result `/obj/item/extendohand` (recipes.dm:500). (inferred: subtypes such as the coloured gloves satisfy this req, since the parent path is required; the recipe engine's subtype matching was not checked.)
- Spawned in: `/obj/structure/closet/boxinggloves` (`code/game/objects/structures/crates_lockers/closets/fitness.dm:17-26`): name `"boxing gloves"` (fitness.dm:18), contents blue (fitness.dm:23), green (24), yellow (25), base (26).
- Also: `code/modules/events/wizard/curseditems.dm:31` gives boxing gloves as a curse loadout slot item.
- No R&D or autolathe design found (grep of `gloves/boxing` and `build_path` finds no design).

---

## Sub-family: boxing glove colours

All three share the parent's behaviour (martial art, equip 60 ds, golem exception, siemens 0.5, max_integrity 200). They differ only in name, icon and inhand (the name is inherited as `"boxing gloves"` from boxing.dm:2).

| DM path (def line) | in-game name | desc | icon_state (line) | inhand_icon_state (line) | BoxStation count | spawned in |
|---|---|---|---|---|---|---|
| `/obj/item/clothing/gloves/boxing/green` (`code/modules/clothing/gloves/boxing.dm:9`) | `boxing gloves` (inherited, boxing.dm:2) | inherited (boxing.dm:3) | `"boxinggreen"` (boxing.dm:10) | `"boxinggreen"` (boxing.dm:11) | none placed | fitness closet (fitness.dm:24) |
| `/obj/item/clothing/gloves/boxing/blue` (boxing.dm:13) | `boxing gloves` (inherited) | inherited | `"boxingblue"` (boxing.dm:14) | `"boxingblue"` (boxing.dm:15) | none placed | fitness closet (fitness.dm:23) |
| `/obj/item/clothing/gloves/boxing/yellow` (boxing.dm:17) | `boxing gloves` (inherited) | inherited | `"boxingyellow"` (boxing.dm:18) | `"boxingyellow"` (boxing.dm:19) | none placed | fitness closet (fitness.dm:25) |

The list gives these three the in-game name `boxing gloves`, and says none are placed on BoxStation.

---

## Sub-family: rainbow gloves

### `/obj/item/clothing/gloves/color` (base, `code/modules/clothing/gloves/color.dm:1`)
- `dying_key = DYE_REGISTRY_GLOVES` (color.dm:2): the glove is dyeable through the dye registry.
- Otherwise inherits `/obj/item/clothing/gloves` (above).

### `/obj/item/clothing/gloves/color/rainbow` (`code/modules/clothing/gloves/color.dm:124`)
- name = `"rainbow gloves"` (color.dm:125)
- desc = `"A pair of gloves, they don't look special in any way."` (color.dm:126)
- icon_state = `"rainbow"` (color.dm:127); inhand_icon_state = `"rainbowgloves"` (color.dm:128)
- No other vars: default gloves values (strip_delay 20, equip_delay_other 40, siemens 0.5, all armor zero).
- Dye: the washing machine's dye table maps `DYE_RAINBOW` to this path (`code/game/machinery/washing_machine.dm:57`) and `DYE_CLOWN` to this path (washing_machine.dm:59).
- Random loot: `/obj/effect/spawner/lootdrop/gloves` (color.dm:235-250) includes `/obj/item/clothing/gloves/color/rainbow = 1` (color.dm:250), one of ten equal weights.
- Interactions: none of its own. No `attack_self`, `attackby`, or `afterattack` on this path.
- Design: none (no build_path).
- BoxStation: x1 (list).

---

## Gotchas
- Boxing gloves are not a simple cosmetic variant: wearing one in the glove slot teaches the Boxing martial art (`equipped`, datums/martial/boxing.dm:57-64), which turns the wearer's unarmed harm attacks into stamina punches with a knockout chance (datums/martial/boxing.dm:13-50). Disarm and grab are blocked (datums/martial/boxing.dm:5-11).
- The boxing gloves' equip delay (60, boxing.dm:6) is 1.5x the base gloves (40, _gloves.dm:12).
- Rainbow and the other colours share no code beyond the gloves base. Only the name, icon and dye mapping differ.

# gap-items-01 part 8: magnificent crown and helmet (2 entries)

Source tree: `_src/tg2020`. Raw numbers. Chains: `/obj/item/clothing/head` (`_head.dm`) -> `/obj/item/clothing/head/crown` (`misc.dm`) -> `/crown/fancy`; `/obj/item/clothing/head` -> `/obj/item/clothing/head/helmet` (`helmet.dm`).

## Parent: head clothing

### `/obj/item/clothing/head` (base, `code/modules/clothing/head/_head.dm:1`)
- name = `BODY_ZONE_HEAD` (_head.dm:2) (a define, not a string literal); icon 'icons/obj/clothing/hats.dmi' (_head.dm:3); icon_state `"top_hat"` (_head.dm:4); inhand_icon_state `"that"` (_head.dm:5)
- body_parts_covered = HEAD (_head.dm:6) (`code/__DEFINES/inventory.dm:64` = 1<<0); slot_flags = ITEM_SLOT_HEAD (_head.dm:7)
- `dynamic_hair_suffix = "+generic"` (_head.dm:10): default hair overlay; children that set `""` (the crowns) turn it off.
- blockTracking = 0 (_head.dm:8): AI tracking flag.
- `Initialize` (_head.dm:12-16): if worn by a human and `dynamic_hair_suffix` is set, `H.update_hair()`.
- `throw_impact` (_head.dm:19-59): a thrown hat aimed at a head ("frisbee" rule). Messages verbatim:
  - `"<span class='notice'>[src] lands neatly on [H]'s head!</span>"` (_head.dm:49) / `"<span class='notice'>[src] lands perfectly onto your head!</span>"` (_head.dm:49)
  - knocks the worn item off: `"<span class='warning'>[src] knocks [WH] off [H]'s head!</span>"` (_head.dm:47)
  - worn item has NODROP: `"<span class='warning'>[src] bounces off [H]'s [WH.name]!</span>"` and to the wearer `"<span class='warning'>[src] bounces off your [WH.name], falling to the floor.</span>"` (_head.dm:35-36)
  - worn item is SNUG_FIT: `"<span class='warning'>[src] bounces off [H]'s [WHH.name]!</span>"` and to the wearer `"... bounces off your [WHH.name], falling to the floor."` (_head.dm:43)
  - contents or `ANTI_TINFOIL_MANEUVER` stop the throw (_head.dm:25-29)
  - borg: `"<span class='notice'>[src] lands neatly on top of [R]!</span>"` (_head.dm:58) unless on `GLOB.blacklisted_borg_hats` (_head.dm:54-55)
- Inherits from `/obj/item/clothing`: max_integrity = 200 (`code/modules/clothing/clothing.dm:4`), integrity_failure 0.4 (clothing.dm:5), resistance_flags FLAMMABLE (clothing.dm:3)
- Inherits from `/obj/item`: w_class WEIGHT_CLASS_NORMAL (`code/game/objects/items.dm:77`) = 3; strip_delay 40 (items.dm:126); equip_delay_other 20 (items.dm:124); permeability 1 (items.dm:112); siemens 1 (items.dm:114); slowdown 0 (items.dm:116); force 0 (`code/game/objects/objs.dm:9`); throwforce 0 (`code/game/atoms_movable.dm:40`)
- Armor: none set on the base, so all zero (`code/game/objects/objs.dm:62-63`, `code/datums/armor.dm:22`).

---

## Sub-family: crowns

### `/obj/item/clothing/head/crown` (base, `code/modules/clothing/head/misc.dm:336`)
- name = `"crown"` (misc.dm:337); desc = `"A crown fit for a king, a petty king maybe."` (misc.dm:338)
- icon_state = `"crown"` (misc.dm:339)
- **armor = list(melee 15, bullet 0, laser 0, energy 10, bomb 0, bio 0, rad 0, fire 100, acid 50)** (misc.dm:340)
- **resistance_flags = FIRE_PROOF** (misc.dm:341): this REPLACES the inherited FLAMMABLE (`clothing.dm:3`), so crowns do not burn. Source `resistance_flags =` assignment.
- dynamic_hair_suffix = `""` (misc.dm:342): no hair overlay change (overrides `"+generic"`, `_head.dm:10`).
- No `clothing_flags` set, so NOT SNUG_FIT: a hat thrown at a crown wearer knocks it off (_head.dm:42).
- Otherwise the head base values (above).
- Recipe: stack recipe "Simple Crown" = `/obj/item/clothing/head/crown` for **5** gold sheets (`code/game/objects/items/stacks/sheets/mineral.dm:219`, in `gold_recipes` at mineral.dm:211). Gold stack type: `/obj/item/stack/sheet/mineral/gold` (mineral.dm:207).
- Dropped by: `/mob/living/simple_animal/hostile/regalrat` `butcher_results = list(/obj/item/clothing/head/crown = 1)` (`code/modules/mob/living/simple_animal/hostile/regalrat.dm:14`).
- Recipe in tablecraft: `/obj/item/clothing/head/crown = 1` (`code/modules/food_and_drinks/recipes/tablecraft/recipes_misc.dm:351`). Not documented further.

### `/obj/item/clothing/head/crown/fancy` (`code/modules/clothing/head/misc.dm:344`)
- name = `"magnificent crown"` (misc.dm:345)
- desc = `"A crown worn by only the highest emperors of the <s>land</s> space."` (misc.dm:346): the `<s>` tags are in the source
- icon_state = `"fancycrown"` (misc.dm:347)
- Everything else inherited from `/obj/item/clothing/head/crown`: armor (fire 100, acid 50, melee 15, energy 10), FIRE_PROOF (not flammable), dynamic_hair_suffix `""`, not SNUG_FIT.
- Spawned in: `/obj/structure/closet/secure_closet/captains` (`code/game/objects/structures/crates_lockers/closets/secure/security.dm:1`, the `new /obj/item/clothing/head/crown/fancy(src)` line is security.dm:24, inside that closet's contents).
- BoxStation: x1 (list).
- Design: none (no build_path).

#### Crown interactions
| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| hat thrown onto a head | target zone head (`_head.dm:22`), no tinfoil counter, empty | 0 | see `_head.dm:19-59` above | put on the head or knocked off |
| no own `attack_self`, `attackby`, `attack` on the crown path | | | | |

Equip and strip times: base values, equip_delay_other 20 (items.dm:124), strip_delay 40 (items.dm:126).

---

## Sub-family: helmets

### `/obj/item/clothing/head/helmet` (base, `code/modules/clothing/head/helmet.dm:1`)
- name = `"helmet"` (helmet.dm:2); desc = `"Standard Security gear. Protects the head from impacts."` (helmet.dm:3)
- icon_state = `"helmet"` (helmet.dm:4); inhand_icon_state = `"helmet"` (helmet.dm:5)
- **armor = list(melee 35, bullet 30, laser 30, energy 40, bomb 25, bio 0, rad 0, fire 50, acid 50)** (helmet.dm:6)
- **cold_protection = HEAD** (helmet.dm:7) (`code/__DEFINES/inventory.dm:64`); **min_cold_protection_temperature = HELMET_MIN_TEMP_PROTECT** (helmet.dm:8) = **160** (`code/__DEFINES/atmospherics.dm:178`)
- **heat_protection = HEAD** (helmet.dm:9); **max_heat_protection_temperature = HELMET_MAX_TEMP_PROTECT** (helmet.dm:10) = **600** (`code/__DEFINES/atmospherics.dm:180`)
- **strip_delay = 60** (helmet.dm:11) (items default 40, `items.dm:126`)
- clothing_flags = SNUG_FIT (helmet.dm:12) = `1<<11` (`code/__DEFINES/obj_flags.dm:47`): the helmet cannot be knocked off by a thrown hat (`_head.dm:42`).
- flags_cover = HEADCOVERSEYES (helmet.dm:13) = `1<<2` (`code/__DEFINES/inventory.dm:107`)
- flags_inv = HIDEHAIR (helmet.dm:14) = `1<<8` (`code/__DEFINES/inventory.dm:59`)
- dog_fashion = `/datum/dog_fashion/head/helmet` (helmet.dm:16)
- `var/can_flashlight = FALSE` (helmet.dm:18): no seclite mount on the base
- `var/obj/item/flashlight/seclite/attached_light` (helmet.dm:19); `var/datum/action/item_action/toggle_helmet_flashlight/alight` (helmet.dm:20)
- Inherits the head base (dynamic_hair_suffix `"+generic"`, body_parts_covered HEAD, slot_flags ITEM_SLOT_HEAD) and the clothing base (max_integrity 200, FLAMMABLE). w_class NORMAL (items.dm:77).
- Inherits no own `resistance_flags` (FLAMMABLE from clothing.dm:3).

#### Helmet interactions (base type)
| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| `attack_self` | `can_toggle` is null on the base (helmet.dm:107) | 0 | none | nothing on the base (the toggle is used by children with `can_toggle = 1`, helmet.dm:95, 134) |
| `attackby` a `/obj/item/flashlight/seclite` | `can_flashlight` FALSE on the base (helmet.dm:364) | 0 | none | falls through to `..()` (helmet.dm:377) |
| `screwdriver_act` | `can_flashlight && attached_light` (helmet.dm:381) | 0 | (for a mounted light) `"You unscrew [attached_light] from [src]."` (helmet.dm:383) | base has no light, returns nothing special |
| `examine` | `attached_light` / `can_flashlight` (helmet.dm:27-34) | 0 | `"It has a mounting point for a <b>seclite</b>."` (helmet.dm:34) only if `can_flashlight` and no light | |
| hat thrown at a helmet wearer | the worn helmet is SNUG_FIT | 0 | `"<span class='warning'>[src] bounces off [H]'s [WHH.name]!</span>"` (_head.dm:43); to the wearer `"<span class='warning'>[src] bounces off your [WHH.name], falling to the floor.</span>"` (_head.dm:43) | the thrown hat falls; the helmet stays |

#### Helmet uses in other objects (the helmet as a part)
- Electropack (`code/game/objects/items/devices/radio/electropack.dm:41-53`): a helmet used on an electropack makes a `/obj/item/assembly/shock_kit`: `"<span class='warning'>[W] is stuck to your hand, you cannot attach it to [src]!</span>"` (electropack.dm:47) if the transfer fails. The helmet becomes `W.master = A` and `A.part1 = W` (electropack.dm:49-50).
- ED-209 frame (`code/modules/mob/living/simple_animal/bot/construction.dm:110-119`): at build step `ASSEMBLY_FIFTH_STEP`, a helmet is consumed: `"<span class='notice'>You add [W] to [src].</span>"` (construction.dm:114) and the frame is renamed `"covered and shielded frame assembly"` (construction.dm:116); `qdel(W)` (construction.dm:115).
- Security helmet child `/obj/item/clothing/head/helmet/sec` (helmet.dm:48-65): `can_flashlight = TRUE` (helmet.dm:49); `attackby` a signaler on a helmet becomes a secbot (helmet.dm:51-65). Not on this list.
- Other `istype(..., /obj/item/clothing/head/helmet)` checks (no change to the helmet itself): `code/modules/vehicles/scooter.dm:110, 293`; `code/datums/components/tackle.dm:348`; `code/game/objects/items/storage/book.dm:155`; `code/game/machinery/doors/airlock.dm:744`; `code/modules/mob/living/simple_animal/bot/construction.dm:111`.

#### Helmet: not made by any design
- No design has `build_path = /obj/item/clothing/head/helmet` (the base) in `code/modules/research/designs`. A design for a child, `/obj/item/clothing/head/helmet/knight/greyscale`, is at `misc_designs.dm:476`.

## Gotchas
- The crown's `resistance_flags = FIRE_PROOF` replaces FLAMMABLE (misc.dm:341), so the crown does not burn.
- The crown is NOT SNUG_FIT (no `clothing_flags`), so hats thrown at it knock it off (_head.dm:42-47). The helmet is SNUG_FIT (helmet.dm:12).
- The helmet's strip_delay (60, helmet.dm:11) is 1.5x the default 40 (items.dm:126).
- The base helmet has no working light and no toggle: `can_flashlight = FALSE` (helmet.dm:18) and `can_toggle` null (helmet.dm:107). Those features exist only on `/sec` and `/alt` children.
- Crown armor is armor-like (melee 15, energy 10, fire 100, acid 50); no bullet, laser, bomb or bio protection (misc.dm:340).

# gap-items-01 part 9: coverage

Every path on `docs/tg/_todo3/gap-items-01.txt` was located with `tools/tgwhere.py` (exact definition, not a parent fallback) and documented in parts 1-8.

| DM path | tgwhere location | part |
|---|---|---|
| `/obj/item/ai_module/core/freeformcore` | `code/game/objects/items/AI_modules.dm:445` | 1 |
| `/obj/item/ai_module/core/full/asimov` | `code/game/objects/items/AI_modules.dm:362` | 1 |
| `/obj/item/ai_module/core/full/custom` | `code/game/objects/items/AI_modules.dm:406` | 1 |
| `/obj/item/ai_module/reset` | `code/game/objects/items/AI_modules.dm:298` | 1 |
| `/obj/item/ai_module/reset/purge` | `code/game/objects/items/AI_modules.dm:318` | 1 |
| `/obj/item/ai_module/supplied/freeform` | `code/game/objects/items/AI_modules.dm:228` | 1 |
| `/obj/item/ai_module/supplied/oxygen` | `code/game/objects/items/AI_modules.dm:220` | 1 |
| `/obj/item/ai_module/supplied/protect_station` | `code/game/objects/items/AI_modules.dm:204` | 1 |
| `/obj/item/ai_module/supplied/quarantine` | `code/game/objects/items/AI_modules.dm:212` | 1 |
| `/obj/item/ai_module/zeroth/onehuman` | `code/game/objects/items/AI_modules.dm:177` | 1 |
| `/obj/item/assembly/prox_sensor` | `code/modules/assembly/proximity.dm:1` | 2 |
| `/obj/item/assembly/signaler` | `code/modules/assembly/signaler.dm:1` | 2 |
| `/obj/item/assembly/timer` | `code/modules/assembly/timer.dm:1` | 2 |
| `/obj/item/bodypart/l_arm/robot/surplus` | `code/modules/surgery/bodyparts/robot_bodyparts.dm:296` | 3 |
| `/obj/item/bodypart/l_leg/robot/surplus` | `code/modules/surgery/bodyparts/robot_bodyparts.dm:312` | 3 |
| `/obj/item/bodypart/r_arm/robot/surplus` | `code/modules/surgery/bodyparts/robot_bodyparts.dm:304` | 3 |
| `/obj/item/bodypart/r_leg/robot/surplus` | `code/modules/surgery/bodyparts/robot_bodyparts.dm:320` | 3 |
| `/obj/item/camera/detective` | `code/modules/photography/camera/other.dm:10` | 4 |
| `/obj/item/camera/spooky` | `code/modules/photography/camera/other.dm:1` | 4 |
| `/obj/item/camera_film` | `code/modules/photography/camera/film.dm:4` | 4 |
| `/obj/item/card/id/departmental_budget/car` | `code/game/objects/items/cards_ids.dm:731` | 5 |
| `/obj/item/circular_saw` | `code/modules/surgery/tools.dm:131` | 6 |
| `/obj/item/clothing/gloves/boxing/blue` | `code/modules/clothing/gloves/boxing.dm:13` | 7 |
| `/obj/item/clothing/gloves/boxing/green` | `code/modules/clothing/gloves/boxing.dm:9` | 7 |
| `/obj/item/clothing/gloves/boxing/yellow` | `code/modules/clothing/gloves/boxing.dm:17` | 7 |
| `/obj/item/clothing/gloves/color/rainbow` | `code/modules/clothing/gloves/color.dm:124` | 7 |
| `/obj/item/clothing/head/crown/fancy` | `code/modules/clothing/head/misc.dm:344` | 8 |
| `/obj/item/clothing/head/helmet` | `code/modules/clothing/head/helmet.dm:1` | 8 |

## Coverage
- Entries on the list: 28
- Documented with real data: 28 (parts 1-8)
- Marked NOT FOUND: 0
- Paths not located by tgwhere: none (all 28 have an exact definition line, see the table above)

