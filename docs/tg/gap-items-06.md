# gap-items-06 part 1: shooting targets (shared parent and `/obj/item/target/alien/anchored`)

Summary
1. The list has three targets, all children of `/obj/item/target` in `code/game/objects/items/shooting_range.dm`: `/obj/item/target/alien/anchored` (line 52), `/obj/item/target/clown` (line 55) and `/obj/item/target/syndicate` (line 42). All are named "shooting target" and differ only in `desc`, `icon_state`, `hp`, and (alien/anchored) `anchored`.
2. Targets are flat, unwearable, non-storable items (`slot_flags = 0`) with two damage pools. `hp` (1800 base; 2350 alien; 2000 clown; 2600 syndicate) is cut only by bullets. `obj_integrity` (200) is cut by thrown items, explosions and fire. Melee does nothing (inferred from the attack chain, see the melee row).
3. A switched-on welder clears the bullet scars for 0 ds and restores no hp. Each counted bullet adds one scar, and at most 36 scars count per welding cycle (derived from `shooting_range.dm:76`, see gotchas).
4. Targets are used by sliding them into a `/obj/structure/target_stake` (`code/game/objects/structures/target_stake.dm:1`, documented in part 3). A pinned target becomes dense and moves with the stake.
5. No construction, deconstruction, power or drops. Bullet destruction prints one message and deletes the target; nothing is left behind.

## Shared parent: `/obj/item/target`

### shooting target  `/obj/item/target`   (code/game/objects/items/shooting_range.dm:1)
- What it is: a flat shooting-range target that absorbs bullet damage into `hp`, can be welded clean, and can be pinned into a target stake. The base type is also placed on BoxStation twice (`_maps/map_files/BoxStation/BoxStation.dmm:29243`, `:31600`); it is not on this list.
- Key vars (base values; children override the ones marked in their entries):

  | var | final value | source |
  |---|---|---|
  | name | "shooting target" | code/game/objects/items/shooting_range.dm:2 |
  | desc | "A shooting target." | shooting_range.dm:3 |
  | icon / icon_state | 'icons/obj/objects.dmi' / "target_h" | shooting_range.dm:4-5 |
  | density | FALSE | shooting_range.dm:6 |
  | hp | 1800 | shooting_range.dm:7 |
  | pinnedLoc | null (the stake it is pinned in) | shooting_range.dm:8 |
  | anchored | FALSE (default) | code/game/atoms_movable.dm:5 |
  | w_class | 3 (WEIGHT_CLASS_NORMAL) | code/game/objects/items.dm:77; code/__DEFINES/inventory.dm:9 |
  | slot_flags | 0 (no equip slot) | code/game/objects/items.dm:79 |
  | force | 0 | code/game/objects/objs.dm:9 |
  | throwforce | 0 | code/game/atoms_movable.dm:40 |
  | throw_range / throw_speed | 7 / 2 | code/game/atoms_movable.dm:11, :10 |
  | attack_verb | none (no value set) | code/game/objects/items.dm:131 |
  | damtype / hitsound | BRUTE / "swing_hit" (hitsound set in Initialize because damtype is brute) | code/game/objects/objs.dm:8; code/game/objects/items.dm:203-207 |
  | max_integrity / obj_integrity | 200 / 200 (max from /obj/item; obj_integrity set to max in /obj/Initialize) | code/game/objects/items.dm:57; code/game/objects/objs.dm:66-67 |
  | integrity_failure / damage_deflection | 0 / 0 (no broken state, no deflection) | code/game/objects/objs.dm:19, :21 |
  | resistance_flags | NONE (not fire-proof, not indestructible) | code/game/objects/objs.dm:23 |
  | obj_flags | NONE, overriding the /obj default CAN_BE_HIT | code/game/objects/items.dm:59; code/game/objects/objs.dm:5 |
  | armor | all ratings 0 (getArmor() with no arguments) | code/game/objects/objs.dm:60-63; code/datums/armor.dm:3 |
  | interaction_flags_item | INTERACT_ITEM_ATTACK_HAND_PICKUP | code/game/objects/items.dm:105 |

- Interactions (every tool, item and intent that does something):

  | held item / action | condition | delay (ds) | message(s) verbatim | result |
  |---|---|---|---|---|
  | Welding tool, switched on: `welder_act` (shooting_range.dm:28-33) | welder on and has fuel (`tool_use_check`, weldingtool.dm:250-256; `check_fuel` switches it off at 0 fuel, weldingtool.dm:196-201) | 0 (`I.use_tool(src, user, 0, volume=40)`, shooting_range.dm:30) | `<span class='notice'>You slice off [src]'s uneven chunks of aluminium and scorch marks.</span>` (shooting_range.dm:32) | `removeOverlays()` clears every scar (shooting_range.dm:31; `cut_overlays` at :20-21). `hp` is unchanged. No fuel is used (amount 0, items.dm:876), and the welder's afterattack fuel burn is skipped because the tool act returns first (item_attack.dm:11-12; weldingtool.dm:126-132) |
  | Welding tool, switched off or out of fuel | `tool_use_check` fails | 0 | `<span class='warning'>[src] has to be on to complete this task!</span>`, where [src] is the welder (weldingtool.dm:252); default welder name "welding tool" (weldingtool.dm:3) | nothing happens to the target. `welder_act` still returns TRUE (shooting_range.dm:33), so the attack chain stops (item_attack.dm:11-12) |
  | Welding tool sound on a successful weld | start check passed | 0 | none (sound only: welder usesound list `welder.ogg` / `welder2.ogg` at volume 40; weldingtool.dm:16; items.dm:857, :901-908) | the end-of-use sound is skipped because delay 0 is below MIN_TOOL_SOUND_DELAY 20 (items.dm:881; code/__DEFINES/tools.dm:21) |
  | Any other item, clicked on the target (melee) | none | n/a | none | no effect. (inferred from the chain: `/obj/attackby` calls `attack_obj` only if `obj_flags & CAN_BE_HIT` (item_attack.dm:58-59), and `/obj/item` has obj_flags NONE (items.dm:59); the item's afterattack then only sends signals (item_attack.dm:158-160)) |
  | Empty hand, click (`attack_hand`, shooting_range.dm:35-40) | not anchored, not pinned | n/a | none | `/obj/item/attack_hand` picks the target up into the active hand (items.dm:336-399; `pickup` and `put_in_active_hand` at items.dm:397-399) |
  | Empty hand, click, anchored | `anchored` TRUE | n/a | none | `/obj/item/attack_hand` returns at `if(anchored)` (items.dm:342). No pickup |
  | Empty hand, click, pinned in a stake | `pinnedLoc` set | n/a | see the stake entry (part 3) | the parent attack_hand runs first, then `pinnedLoc.removeTarget(user)` (shooting_range.dm:39-40). See gotcha 10 |
  | Bullet, aimed at this target (`P.original == src`), hits an opaque pixel, `overlays.len <= 35` | not a foam dart | n/a | none, except the break message on the killing shot | `hp -= P.damage` (shooting_range.dm:76-77); a scar image is added (shooting_range.dm:81-92); returns BULLET_ACT_HIT (shooting_range.dm:93) |
  | Bullet in any other case (transparent pixel, not aimed at this target, or more than 35 scars) | not a foam dart | n/a | none | returns BULLET_ACT_FORCE_PIERCE (shooting_range.dm:94). The projectile keeps going (code/modules/projectiles/projectile.dm:317-322) |
  | Foam dart (`/obj/projectile/bullet/reusable/foam_dart`, damage 0, nodamage TRUE, foam_dart.dm:4, :6) | any | n/a | none | no `hp` change. `P.on_hit(src, 0)` (shooting_range.dm:68-69). The reusable `on_hit` drops the spent casing on the target's turf (code/modules/projectiles/projectile/reusable/_reusable.dm:8-10, :16-19; foam_dart.dm:14) |

- Construction chain: none defined. The only tool branch is `welder_act`.
- Deconstruction chain: none. Welder clears scars only (shooting_range.dm:31). Wrench and crowbar are not overridden here, so they reach the atom defaults, which only send signals (code/game/atoms.dm:1140, :1160).
- Drops:
  - (a) Destroyed by bullets (hp <= 0): `visible_message("<span class='danger'>[src] breaks into tiny pieces and collapses!</span>")` (shooting_range.dm:78-79), then `qdel(src)` (shooting_range.dm:80). `Destroy` clears the overlays and tells the stake to drop its pointer (shooting_range.dm:10-14). Nothing new is spawned. The stake stays where it is.
  - (b) Destroyed by obj_integrity reaching 0 (thrown items, explosions, fire; see Health): `obj_destruction` calls `deconstruct(FALSE)`, which is `qdel(src)` (code/game/objects/obj_defense.dm:252-258, :243-245). No message and no drop.
  - (c) "Deconstructed properly": no such path. Taking it out of a stake is not destruction (target_stake.dm:58-70).
- Health / armor:
  - `hp`: 1800 (shooting_range.dm:7). Children: 2600, 2350, 2000 (listed in their entries).
  - `obj_integrity` 200 and armor 0 (items.dm:57; objs.dm:66-67; objs.dm:60-63). Only non-bullet damage reaches `obj_integrity`:
    - thrown items: `/obj/hitby` calls `take_damage(AM.throwforce, BRUTE, "melee", 1, ...)` (code/game/objects/obj_defense.dm:50-52)
    - explosions: severity 1 `take_damage(INFINITY)`, severity 2 `rand(100, 250)`, severity 3 `rand(10, 90)`, all BRUTE "bomb" (obj_defense.dm:54-69)
    - fire: `take_damage(clamp(0.02 * exposed_temperature, 0, 20), BURN, "fire", 0)` (obj_defense.dm:200-205); at 0 integrity, fire calls `burn()` which calls `deconstruct(FALSE)` (obj_defense.dm:211)
  - `run_obj_armor` returns 0 for damage types other than BRUTE and BURN (obj_defense.dm:24-31) and for "melee" damage under `damage_deflection` (obj_defense.dm:25-26).
  - Bullets never reach the generic `/obj/bullet_act` (obj_defense.dm:71-75, which calls `take_damage`), because the target's override does not call its parent (shooting_range.dm:67).
- Power: none (no power vars or procs).
- Gotchas:
  1. Two damage pools. `hp` is for bullets only (shooting_range.dm:77). `obj_integrity` (200) takes everything else. Melee never reaches `obj_integrity` (see the melee row).
  2. Scar cap. A bullet counts only if `overlays.len <= 35` (shooting_range.dm:76), and each counted hit adds one scar (shooting_range.dm:92). After 36 counted hits, bullets pierce without damage until a welder clears the scars (shooting_range.dm:31). Count derived (inferred): the emissive blocker is a vis overlay, not an entry in `overlays` (code/game/atoms_movable.dm:55-78). Welding restores no hp.
  3. Opaque pixel check. A bullet scores only if `icon(icon, icon_state).GetPixel(p_x, p_y)` is non-null (shooting_range.dm:75-76). The hit point is jittered on each axis by `pick(0,0,0,0,0,-1,1)` (shooting_range.dm:70-71).
  4. Aim check. `P.original == src` (shooting_range.dm:76). A bullet that passes over the target without being aimed at it is not counted.
  5. Code keeps running after `qdel(src)` (shooting_range.dm:80). It still adds a scar and returns BULLET_ACT_HIT (shooting_range.dm:81-93). Nothing visible results, since the object is being deleted.
  6. Decal type depends on the projectile. Bullets (`/obj/projectile/bullet`) add a "dent" image (shooting_range.dm:73-74, :90-91). Other projectiles, including beams, add a "scorch" image, which is "light_scorch" unless `P.damage >= 20` or the projectile is a practice beam (shooting_range.dm:84-89).
  7. Damage ignores damage type. `hp -= P.damage` runs for any projectile that passes the checks (shooting_range.dm:77), including beams. (inferred from the line; the damage type is not checked.)
  8. Return value decides the projectile. In `process_hit`, only BULLET_ACT_FORCE_PIERCE lets a projectile continue; any other result, including BULLET_ACT_HIT, ends it (code/modules/projectiles/projectile.dm:317-331). Constants: BULLET_ACT_HIT "HIT", BULLET_ACT_FORCE_PIERCE "PIERCE" (code/__DEFINES/combat.dm:239, :241).
  9. Density. The base target is `density = FALSE` (shooting_range.dm:6), so it does not block walking. While pinned it is `density = TRUE` (target_stake.dm:46).
  10. Pinned target clicked directly. The parent attack_hand runs first and would pick the item up (items.dm:336-399), then `removeTarget` runs (shooting_range.dm:35-40, target_stake.dm:58-70). Read from the code order only; not run. (inferred)
  11. Moving a pinned target drags the stake (`Move()`, shooting_range.dm:23-26).
  12. No repair. The welder is the only act that touches a target, and it never changes `hp` (shooting_range.dm:28-33).
- DIFF vs newer: none found. The newer snapshot (Downloads tree, `code/game/objects/items/shooting_range.dm`) has the same hp lines (:7, :45, :50, :58), the same scar cap (:76), the same welder `use_tool` (:30) and the same returns (:93-94).

### shooting target  `/obj/item/target/alien/anchored`   (code/game/objects/items/shooting_range.dm:52)
- What it is: the alien-looking target bolted in place. It is `/obj/item/target/alien` (shooting_range.dm:47-50) with `anchored = TRUE`, so it cannot be picked up by hand. Everything else is as in the parent block.
- Key vars (final values):

  | var | final value | source |
  |---|---|---|
  | name | "shooting target" | inherited from /obj/item/target, shooting_range.dm:2 |
  | desc | "A shooting target that looks like a xenomorphic alien." | inherited from /obj/item/target/alien, shooting_range.dm:49 |
  | icon / icon_state | 'icons/obj/objects.dmi' / "target_q" | icon from shooting_range.dm:4; icon_state from /obj/item/target/alien, shooting_range.dm:48 |
  | hp | 2350 | inherited from /obj/item/target/alien, shooting_range.dm:50 |
  | anchored | TRUE | set here, shooting_range.dm:53 (default FALSE, code/game/atoms_movable.dm:5) |
  | density | FALSE | inherited from /obj/item/target, shooting_range.dm:6 |
  | w_class, slot_flags, force, throwforce, throw_range, obj_integrity, armor | as the parent block | from /obj/item and /obj (see parent table) |

- Interactions: the parent table applies, with these differences:

  | held item / action | condition | delay (ds) | message(s) verbatim | result |
  |---|---|---|---|---|
  | Empty hand, click | anchored TRUE | n/a | none | no pickup (items.dm:342). Nothing visible happens unless the target is pinned |
  | Paw click (`attack_paw`, animal/monkey hands) | anchored TRUE | n/a | none | returns at `if(anchored)` (items.dm:408-409) |
  | Any wrench (`wrench_act`) | no `wrench_act` override on any target type | n/a | none | the atom default only sends `COMSIG_ATOM_WRENCH_ACT` (code/game/atoms.dm:1160-1161). No code in the target path sets `anchored` back to FALSE (inferred: no `setAnchored` call site covers items) |
  | Welding tool, switched on; bullets | same as parent | 0 (welder) | same as parent | same as parent (hp 2350) |

- Construction chain: none.
- Deconstruction chain: none. The anchor has no in-game removal path in the target code (inferred, see the wrench row).
- Drops: as the parent block. Bullet destruction leaves nothing (shooting_range.dm:78-80). Integrity destruction leaves nothing (obj_defense.dm:252-258).
- Health / armor: `hp` 2350 (shooting_range.dm:50). `obj_integrity` 200 and armor 0, as in the parent block. Damage paths as the parent block.
- Power: none.
- Gotchas:
  1. `anchored` only blocks hand pickup (items.dm:342) and paw pickup (items.dm:408). It does not block the stake: the stake's `attackby` has no anchored check (target_stake.dm:40-49). Pinning this target into a stake is therefore not blocked by code. (inferred from the missing check)
  2. Placed on BoxStation once, at `_maps/map_files/BoxStation/BoxStation.dmm:30444`. This matches the list count (x1).
  3. Its scar cap, opaque-pixel check, aim check and return values are the parent's (shooting_range.dm:67-94). See the parent gotchas 2 to 8.

# gap-items-06 part 2: shooting target, clown

Shared behaviour (welder, pickup, bullets, destruction, stake interplay, health) is documented once in part 1 under `/obj/item/target`. Only the differences are written here.

### shooting target  `/obj/item/target/clown`   (code/game/objects/items/shooting_range.dm:55)
- What it is: the clown-looking target. It is the base target (shooting_range.dm:1) with its own `desc`, `icon_state` and `hp`, plus a bike horn that plays on every projectile that reaches it.
- Key vars (final values):

  | var | final value | source |
  |---|---|---|
  | name | "shooting target" | inherited from /obj/item/target, shooting_range.dm:2 |
  | desc | "A shooting target that looks like a useless clown." | shooting_range.dm:57 |
  | icon / icon_state | 'icons/obj/objects.dmi' / "target_c" | icon from shooting_range.dm:4; icon_state shooting_range.dm:56 |
  | hp | 2000 | shooting_range.dm:58 (base 1800, shooting_range.dm:7) |
  | density | FALSE | inherited, shooting_range.dm:6 |
  | anchored | FALSE | default, code/game/atoms_movable.dm:5 |
  | w_class, slot_flags, force, throwforce, throw_range, obj_integrity, armor | as the parent block | from /obj/item and /obj (see part 1) |

- Interactions: the parent table applies unchanged (welder, pickup, bullet hit, foam dart, pierce), plus:

  | held item / action | condition | delay (ds) | message(s) verbatim | result |
  |---|---|---|---|---|
  | Any projectile that reaches the target (counted hit, pierce, or foam dart) | the override calls the parent first (`. = ..()`, shooting_range.dm:64) | n/a | none. Sound only: `playsound(src.loc, 'sound/items/bikehorn.ogg', 50, TRUE)` (shooting_range.dm:65) | the horn plays at the target's turf with volume 50. It is unconditional after the parent call, so misses, pierced shots and foam darts honk as well as hits. The return value is the parent's (`.`), so bullet effects are unchanged |

- Construction chain: none (as the parent).
- Deconstruction chain: none (as the parent).
- Drops:
  - (a) Destroyed by bullets: the parent path. `visible_message("<span class='danger'>[src] breaks into tiny pieces and collapses!</span>")` (shooting_range.dm:79), then `qdel(src)` (shooting_range.dm:80). Nothing spawned. The horn may play on the same shot (it runs after the parent returns, shooting_range.dm:64-65).
  - (b) Destroyed by obj_integrity reaching 0: `deconstruct(FALSE)`, no message, no drop (obj_defense.dm:252-258).
  - (c) Deconstructed properly: no path.
- Health / armor: `hp` 2000 (shooting_range.dm:58). `obj_integrity` 200, armor 0. Bullet budget against this `hp` is in part 3.
- Power: none.
- Gotchas:
  1. The horn is the only behavioural difference from the base target. A port must play the horn on every projectile that reaches the target, not only on counted hits (shooting_range.dm:63-65).
  2. Opaque-pixel, aim, scar-cap (36 counted hits per welding cycle), return-value and welder gotchas are the parent's (part 1, gotchas 2 to 8). The welder never restores `hp` (shooting_range.dm:28-33).
  3. Placed on BoxStation twice, both in the map block `"cbc"` at `_maps/map_files/BoxStation/BoxStation.dmm:35630-35631`, which matches the list count (x2). The block key `"cbc"` starts at BoxStation.dmm:35626 (the DMM tile-key format puts all of these on one tile; inferred).
- DIFF vs newer: none found. Newer `code/game/objects/items/shooting_range.dm:56-58` and `:63-65` are identical in value and order.

# gap-items-06 part 3: shooting target, syndicate; related target stake; budget; port; open questions; coverage

Shared behaviour is documented once in part 1 under `/obj/item/target`. This part has the last list entry, the related stake (not on the list, but the only place targets are pinned), and the closing sections.

Path key for the short file names used in parts 1 to 3 (all under the tree root `code/`):
`items.dm` = game/objects/items.dm; `objs.dm` = game/objects/objs.dm; `obj_defense.dm` = game/objects/obj_defense.dm; `structures.dm` = game/objects/structures.dm; `buckling.dm` = game/objects/buckling.dm; `weldingtool.dm` = game/objects/items/tools/weldingtool.dm; `shooting_range.dm` = game/objects/items/shooting_range.dm; `target_stake.dm` = game/objects/structures/target_stake.dm; `item_attack.dm` = _onclick/item_attack.dm; `other_mobs.dm` = _onclick/other_mobs.dm; `atoms.dm` = game/atoms.dm; `atoms_movable.dm` = game/atoms_movable.dm; `projectile.dm` = modules/projectiles/projectile.dm; `_reusable.dm` and `foam_dart.dm` = modules/projectiles/projectile/reusable/; `bullets.dm` = modules/projectiles/projectile/bullets.dm; `combat.dm`, `tools.dm`, `inventory.dm` = __DEFINES/; `armor.dm` = datums/armor.dm.

### shooting target  `/obj/item/target/syndicate`   (code/game/objects/items/shooting_range.dm:42)
- What it is: the syndicate-looking target. It is the base target (shooting_range.dm:1) with its own `desc`, `icon_state` and `hp`. It overrides no proc.
- Key vars (final values):

  | var | final value | source |
  |---|---|---|
  | name | "shooting target" | inherited from /obj/item/target, shooting_range.dm:2 |
  | desc | "A shooting target that looks like syndicate scum." | shooting_range.dm:44 |
  | icon / icon_state | 'icons/obj/objects.dmi' / "target_s" | icon from shooting_range.dm:4; icon_state shooting_range.dm:43 |
  | hp | 2600 | shooting_range.dm:45 (base 1800, shooting_range.dm:7) |
  | density | FALSE | inherited, shooting_range.dm:6 |
  | anchored | FALSE | default, code/game/atoms_movable.dm:5 |
  | w_class, slot_flags, force, throwforce, throw_range, obj_integrity, armor | as the parent block | from /obj/item and /obj (see part 1) |

- Interactions: the parent table applies unchanged (welder on, welder off, pickup, bullet hit, pierce, foam dart, melee no-op). No child-specific rows.
- Construction chain: none.
- Deconstruction chain: none.
- Drops:
  - (a) Destroyed by bullets: `visible_message("<span class='danger'>[src] breaks into tiny pieces and collapses!</span>")` (shooting_range.dm:79), then `qdel(src)` (shooting_range.dm:80). Nothing spawned.
  - (b) Destroyed by obj_integrity reaching 0: `deconstruct(FALSE)`, no message, no drop (obj_defense.dm:252-258).
  - (c) Deconstructed properly: no path.
- Health / armor: `hp` 2600 (shooting_range.dm:45). `obj_integrity` 200, armor 0. Bullet budget in the table below.
- Power: none.
- Gotchas:
  1. Highest `hp` of the four. A 60-damage projectile needs 44 counted hits, more than one welding cycle allows (36), so at least one weld is needed (derived, see the table below).
  2. Placed twice on BoxStation at `_maps/map_files/BoxStation/BoxStation.dmm:35632-35633`, in the same map block `"cbc"` (BoxStation.dmm:35626) as the clown targets. The list count (x2) matches. The same-tile reading is from the DMM tile-key format (inferred).
  3. No horn and no other override; behaviour is exactly the parent's.
- DIFF vs newer: none found. Newer `code/game/objects/items/shooting_range.dm:43-45` has the same values.

### target stake  `/obj/structure/target_stake`   (code/game/objects/structures/target_stake.dm:1)
Not on this list. Included because a target does nothing useful outside a stake, and every target entry above refers to it.
- What it is: a thin platform with magnetized wheels that holds one target (pinned) and can take one buckled mob.
- Key vars:

  | var | final value | source |
  |---|---|---|
  | name | "target stake" | target_stake.dm:2 |
  | desc | "A thin platform with negatively-magnetized wheels." | target_stake.dm:3 |
  | icon / icon_state | 'icons/obj/objects.dmi' / "target_stake" | target_stake.dm:4-5 |
  | density | FALSE by default; TRUE while a target is pinned or a mob is buckled | target_stake.dm:6; `handle_density` at :18-22 |
  | flags_1 | CONDUCT_1 | target_stake.dm:7 |
  | can_buckle / max_buckled_mobs / buckle_lying | TRUE / 1 / FALSE | target_stake.dm:8-10 |
  | pinned_target | the pinned target, or null | target_stake.dm:11 |
  | max_integrity | 300 (from /obj/structure) | code/game/objects/structures.dm:4 |

- Interactions (every tool and item that does something):

  | held item / action | condition | delay (ds) | message(s) verbatim | result |
  |---|---|---|---|---|
  | Target, clicked on the stake (`attackby`, target_stake.dm:40-49) | no pinned target; `istype(T)`; `user.transferItemToLoc(T, drop_location())` succeeds (:43) | n/a | `<span class='notice'>You slide the target into the stake.</span>` (target_stake.dm:49) | target moved to the stake's turf (:43); `pinned_target = T` (:44); `T.pinnedLoc = src` (:45, sets the target's `pinnedLoc` field, shooting_range.dm:8); `T.density = TRUE` (:46); `T.layer = OBJ_LAYER + 0.01` (:47); `handle_density()` (:48) |
  | Second target, while one is already pinned | `pinned_target` set | n/a | none | returns at target_stake.dm:41-42; nothing moves |
  | Any non-target item | none | n/a | none | `istype` fails, nothing happens. The parent attackby is not called (target_stake.dm:40-49) |
  | Click on the stake (`attack_hand`, target_stake.dm:51-56) with a target pinned | pinned | n/a | see removeTarget | `removeTarget(user)` (:55-56) |
  | removeTarget, human, empty active hand | `ishuman(user)` and `!user.get_active_held_item()` (target_stake.dm:64-65) | n/a | `<span class='notice'>You take the target out of the stake.</span>` (target_stake.dm:67) | target layer reset to OBJ_LAYER (:59); moved to `user.loc` (:60); unpinned (:61-62); `handle_density()` (:63); `user.put_in_hands(pinned_target)` (:66) |
  | removeTarget, human, full active hand | `ishuman(user)`, hand not empty | n/a | none | as above through :63, but the target is not put in a hand and stays on the floor at `user.loc` (:60). No message (:65-67 skipped) |
  | removeTarget, non-human | not `ishuman(user)` | n/a | `<span class='notice'>You take the target out of the stake.</span>` (target_stake.dm:70) | target dropped at `user.drop_location()` (:69) |
  | Bullet into the stake, target pinned | `pinned_target` set | n/a | none | `pinned_target.bullet_act(P)` runs (:73-74); its result is not returned, so the projectile ends (code/modules/projectiles/projectile.dm:317-331) |
  | Bullet into the stake, no target pinned | none | n/a | none | `. = ..()` (target_stake.dm:76), the parent structure bullet handling (not traced further) |
  | Mob buckles to the stake | `can_buckle`, max 1 | n/a | none in this file | `post_buckle_mob` runs `handle_density()` (target_stake.dm:24-26); unbuckle does the same (:28-30) |

- Construction chain: none defined in this file (the stake's own construction was not traced).
- Deconstruction chain: none defined in this file.
- Drops: destroying the stake (Destroy, target_stake.dm:13-16) calls `pinned_target.nullPinnedLoc()`, which only clears the target's `pinnedLoc` and sets `density = FALSE` (shooting_range.dm:16-18). The target stays on the stake's turf. No drop and no message in this file.
- Health: `max_integrity` 300 (code/game/objects/structures.dm:4); parent defaults otherwise.
- Power: none.
- Gotchas:
  1. Density recalculation is uneven. `handle_density` runs on pin (target_stake.dm:48), unpin (:63) and buckle/unbuckle (:25, :29). `nullPinnedTarget` (:32-33) does not run it, and `nullPinnedTarget` is what a destroyed pinned target calls (shooting_range.dm:13). So a stake whose target was shot apart stays dense until something else recalculates. (inferred)
  2. Moving the stake drags the pinned target along (`Move`, target_stake.dm:35-38). The target's own `Move` does the same to the stake (shooting_range.dm:23-26).
  3. A pinned stake stops every bullet that reaches it. The return value of the target's `bullet_act` is discarded (target_stake.dm:73-74), so even a miss that would have passed an unpinned target ends the projectile (projectile.dm:317-331). (inferred from the code path)
  4. Pinning is not gated by `anchored` (target_stake.dm:40-49), so the anchored target can be pinned (inferred).
  5. Empty-hand removal with a full active hand leaves the target on the floor with no message (target_stake.dm:64-67).
  6. Clicking a pinned target directly runs the parent pickup first; see part 1, target gotcha 10.
- DIFF vs newer: none found. The newer `code/game/objects/structures/target_stake.dm` keeps the same line layout for these procs (`handle_density` :18, `nullPinnedTarget` :32, `T.layer` :47, `removeTarget` :58-63, `bullet_act` :72-74).

## Bullet budget (derived; inferred from the scar cap and projectile damage)

Assumes every shot is aimed at the target and lands on an opaque pixel, so each one counts (shooting_range.dm:75-76). A welding cycle allows 36 counted hits (shooting_range.dm:76, :92), and a weld resets the scars without changing hp (shooting_range.dm:31). Each cell gives counted hits needed, then welds needed (`ceil(hits / 36) - 1`). Damage values are the projectile's `damage` as written:

| target (hp) | c38, 25 | c9mm, 30 | c45, 35 | mm712x82, 45 | a762 / a357 / shotgun slug, 60 |
|---|---|---|---|---|---|
| base 1800 | 72 / 1 | 60 / 1 | 52 / 1 | 40 / 1 | 30 / 0 |
| clown 2000 | 80 / 2 | 67 / 1 | 58 / 1 | 45 / 1 | 34 / 0 |
| alien 2350 | 94 / 2 | 79 / 2 | 68 / 1 | 53 / 1 | 40 / 1 |
| syndicate 2600 | 104 / 2 | 87 / 2 | 75 / 2 | 58 / 1 | 44 / 1 |

Sources. Projectile damage (each file under code/modules/projectiles/projectile/bullets/): c38 `revolver.dm:17`; c9mm `pistol.dm:5`; c45 `smg.dm:5`; mm712x82 `lmg.dm:28`; a762 `rifle.dm:19`; a357 `revolver.dm:100`; shotgun slug `shotgun.dm:3`. hp: base `code/game/objects/items/shooting_range.dm:7`; clown `:58`; alien `:50`; syndicate `:45`. Full paths are in the path key at the top of this part.

Welding costs no fuel: `use_tool` is called with amount 0 (shooting_range.dm:30; items.dm:876), and the afterattack fuel burn is skipped (item_attack.dm:11-12). (inferred from the call; not run)

## Minimum viable port

- One item type with `hp` (1800 base; syndicate 2600, alien 2350, clown 2000; shooting_range.dm:7, :45, :50, :58) separate from integrity (200; items.dm:57). Melee does nothing (items.dm:59; code/_onclick/item_attack.dm:58-59).
- Bullet test: the bullet must be aimed at the target and land on an opaque pixel of its sprite; otherwise it passes through (shooting_range.dm:70-76, :94).
- Each counted hit: `hp -= projectile.damage` and one scar; at most 36 scars per welding cycle, then bullets pass through until the scars are cleared (shooting_range.dm:76-77, :92).
- Welder switched on: 0 ds, clears all scars, no fuel, no hp change, message "You slice off ..." (shooting_range.dm:28-33). Welder off: "... has to be on to complete this task!" (weldingtool.dm:252).
- Destruction at hp <= 0: "breaks into tiny pieces and collapses!", delete, nothing dropped (shooting_range.dm:78-80).
- Clown: play `sound/items/bikehorn.ogg` at volume 50 on every projectile that reaches it (shooting_range.dm:63-65).
- Click with an empty hand picks it up, unless anchored (items.dm:336-342). The alien/anchored variant is fixed in place (shooting_range.dm:52-53).
- Stake: slide a target in with its message; while pinned it is dense and stops bullets; click the stake to take it out; message and hand rules as in target_stake.dm:40-70.
- Foam darts do no damage and drop their casing on the target's tile (shooting_range.dm:68-69; code/modules/projectiles/projectile/reusable/_reusable.dm:8-19).

## NOT FOUND / open questions

- NOT FOUND: none. All three list paths were located by `tools/tgwhere.py`.
- Not traced: whether a thrown item actually reaches a non-dense target (the base target is `density = FALSE`, shooting_range.dm:6). The throw code was not read. The `/obj/hitby` damage path is documented (obj_defense.dm:50-52) but its trigger is open.
- Read from code order only, not run: a pinned target clicked directly (part 1, gotcha 10).
- Inferred, not run: melee no-op (item_attack.dm:58-59, items.dm:59); that an anchored target has no in-game unanchor path (no `wrench_act` override; code/game/atoms.dm:1160); that the stake stays dense after its target is shot apart (target_stake.dm:32-33).
- Inferred: the scar cap counts only `overlays` entries (the emissive blocker is a vis overlay, code/game/atoms_movable.dm:55-78). If `overlays` contains anything else on a live target, the 36-hit figure shifts.
- Not traced: whether beams (`/obj/projectile/beam`) enter `hp -= P.damage` with the same values (shooting_range.dm:77 does not check damage type).
- BoxStation tile coordinates are not resolved; only the DMM tile key is given (`"cbc"` at BoxStation.dmm:35626).

## Coverage

- List entries: 3 (`/obj/item/target/alien/anchored`, `/obj/item/target/clown`, `/obj/item/target/syndicate`).
- Documented with real data: 3.
- Marked NOT FOUND: 0.
- Located by `tools/tgwhere.py` (exact output, all located):
  - `/obj/item/target/alien/anchored  code/game/objects/items/shooting_range.dm:52`
  - `/obj/item/target/clown  code/game/objects/items/shooting_range.dm:55`
  - `/obj/item/target/syndicate  code/game/objects/items/shooting_range.dm:42`
  - parent (not on list, documented): `/obj/item/target  code/game/objects/items/shooting_range.dm:1`
  - parent of anchored (not on list, values inherited): `/obj/item/target/alien  code/game/objects/items/shooting_range.dm:47`
- Paths with no own definition: none.

