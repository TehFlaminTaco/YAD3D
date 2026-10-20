# Addendum to the brief: you are given a LIST, and every entry on it must be documented

Read `docs/tg/_BRIEF.md` first; all its rules apply (raw deciseconds, `file:line` on every fact, verbatim messages,
never invent, never convert units, write only your own file). This addendum changes how you are scored.

The first research sweep was organised by topic and only named 73 of the game's 913 item types. It missed the user's actual
request, which was: **every item the game has gets looked up in the TG source and its behaviour written down.** You are
closing that gap for one family. Your assignment names a list file under `docs/tg/_todo/`. Each line is `DM path<TAB>in-game name`
(or `count<TAB>DM path` for things placed on the map).

## Rules for lists

1. **Every path on your list appears literally in your file**, exactly as written in the list, one entry each. A script
   will check this. A path you could not find in the source still gets an entry that says `NOT FOUND` and what you searched
   (but search properly: grep the type name, then the parent chain, then the file the path suggests; a path like
   `/obj/item/clothing/under/color/red` lives in `code/modules/clothing/under/color.dm` as `/color/red`, nested type definitions
   inherit the parent path, so look for the nested definition).
2. **Subtypes that only differ by name, colour or icon may share one table row** as long as each path is written in the row
   and the differing values (name, desc, colour) are given. A subtype that changes any number or behaviour gets its own entry.
3. Resolve inheritance: give the **final value** of a var for each type, and say which parent it came from when it is not set on
   the type itself (`armor: from /obj/item/clothing/suit/space/hardsuit, file:line`).
4. Do not skip something because it looks boring or like flavour. Give the literal `name`, `desc`, and what happens when it is used,
   worn, eaten, thrown, hit with, or clicked on something.
5. Group the file by sub-family with a short heading each, parent class first (its vars and procs once), then the children.
   Dense tables, not prose. Aim for completeness over polish; if the list is long, shorter entries are better than missing ones.
6. At the end add `## Coverage`: the number of list entries, the number you documented with real data, and the paths you marked
   `NOT FOUND`.

## What to record per item (skip a column when it does not apply, never guess it)

* Identity: `name`, `desc`, `icon_state`/`item_state` only if they carry meaning (colour variants, on/off states), `w_class`,
  `slot_flags`, `force`, `throwforce`, `throw_range`, `attack_verb`, `hitsound`.
* Worn things: `body_parts_covered`, `flags_inv`, `flags_cover`, `clothing_flags` (STOPSPRESSUREDAMAGE, THICKMATERIAL, NOSLIP...),
  every number in `armor`, `slowdown`, `siemens_coefficient`, `permeability_coefficient`, `min_cold_protection_temperature`,
  `max_heat_protection_temperature`, `cold_protection`, `heat_protection`, `strip_delay`, `equip_delay_other`, `flash_protect`,
  `tint`, `visor_flags`, `can_adjust`/`alt_covers_chest`, suit-storage `allowed` lists (summarise), sensor modes, accessories, toggle
  actions (the proc, the messages).
* Use: `attack_self`, `afterattack`, `attack`, `attackby` with other items, `interact`; each with its delay in ds, messages
  verbatim, and the numeric effect (heal amounts, reagent amounts, damage, charges used).
* Contents: what a container holds at round start (`PopulateContents` / `new` lines, `list_reagents` with amounts), capacity
  (`max_combined_w_class`, `storage_slots`, `can_hold`, `cant_hold`, `max_w_class`).
* Food and drink: `list_reagents`, `bitesize`, `foodtype`, `tastes`, `junkiness`, what it leaves behind (`trash`), the exact eat/drink
  messages, cooking results if any are defined on the item itself.
* Electronics and devices: power use, cell type, frequencies/channels (numbers), what its UI offers (the action names), access.
* Weapons: damage, damage type, `fire_delay`, ammo type and capacity, charge cost, projectile path, stun time.
* Anything surprising (it explodes, it is rigged, it needs a skill/trait, it only works on a certain slot...).

## Output

Your file is named in your assignment. When you finish, reply with just the file path and your `## Coverage` numbers.
