# gap-items-04, part 1: glass bottles (reagent_containers/glass/bottle and its nutrient children)

Source tree: `_src/tg2020` (tgstation 2d6c10c1). Every path below is a type from the list, written out once. Values not set on a type come from the parent named.

## Parent chain (written once, used by every entry in this part)

### /obj/item/reagent_containers  `code/modules/reagents/reagent_containers.dm:1`
- name = "Container" (:2), desc = "..." (:3), icon = 'icons/obj/chemical.dmi' (:4), w_class = WEIGHT_CLASS_TINY (:6)
- amount_per_transfer_from_this = 5 (:7), possible_transfer_amounts = list(5,10,15,20,25,30) (:8), volume = 30 (:9)
- reagent_flags (:10, null), list_reagents = null (:11), spawned_disease = null (:12), disease_amount = 20 (:13)
- spillable = FALSE (:14), fill_icon_thresholds = null (:15), fill_icon_state = null (:16)
- Initialize(mapload, vol) (:18-28): `vol` overrides volume if > 0 (:20-21); `create_reagents(volume, reagent_flags)` (:22); `add_initial_reagents()` (:28), which runs `reagents.add_reagent_list(list_reagents)` (:30-32)
- attack_self (:34-45): steps amount_per_transfer_from_this to the next value in possible_transfer_amounts (wraps to the first; no change when the current amount is not in the list). Message: `"<span class='notice'>[src]'s transfer amount is now [amount_per_transfer_from_this] units.</span>"` (:44). Delay: none.
- attack (:47-49): only calls `..()` when `user.a_intent == INTENT_HARM`; otherwise does nothing.
- canconsume (:51-64): mouth covered by headgear or mask blocks eating: `"You have to remove [who] [covered] first!"` (:62)
- throw_impact (:77-79): calls `SplashReagents(hit_atom, TRUE)`
- SplashReagents (:86-118): returns at once if not spillable (:87-88). Thrown at a mob: volume multiplied by `rand(5,10) * 0.1` (:91-92), messages `"<span class='danger'>[M] is splashed with something!</span>"` (:95) and `"<span class='userdanger'>[M] is splashed with something!</span>"` (:96). Thrown onto a non-mob that is not a bartender catch: `"[src] spills its contents all over [target]."` (:113). Thrown onto a bartender-checked target: `"[src] lands onto the [target.name] without spilling a single drop."` (:105). Ends with `reagents.clear_reagents()` (:118).

### /obj/item/reagent_containers/glass  `code/modules/reagents/reagent_containers/glass.dm:2`
- name = "glass" (:3), amount_per_transfer_from_this = 10 (:4), possible_transfer_amounts = list(5, 10, 15, 20, 25, 30, 50) (:5), volume = 50 (:6)
- reagent_flags = OPENCONTAINER | DUNKABLE (:7), spillable = TRUE (:8), resistance_flags = ACID_PROOF (:9)

Interactions of the glass parent (all children inherit these unless they override the proc):

| held item / action | condition | delay (ds) | message(s), verbatim | result |
|---|---|---|---|---|
| click a mob, `user.a_intent == INTENT_HARM` | container not spillable: returns (:16-17); empty: stops | none | `"[user] splashes the contents of [src] onto [M]!"` (:26); `"[user] splashes the contents of [src] onto you!"` (:27, userdanger) | `reagents.expose(M, TOUCH)` (:35), `reagents.clear_reagents()` (:37) |
| click a mob, `M != user`, not harm | canconsume passes (:13) | `do_mob(user, M)` with default `time = 3 SECONDS` = 30 ds (`code/__HELPERS/mobs.dm:181`, `code/__DEFINES/time.dm:41`) | `"[user] attempts to feed [M] something from [src]."` (:40); `"[user] attempts to feed you something from [src]."` (:41, userdanger); on success `"[user] feeds [M] something from [src]."` (:46); `"[user] feeds you something from [src]."` (:47, userdanger) | if `do_mob` is interrupted, returns (:42-43); if the container is empty after the wait, returns (:44-45); otherwise falls to the shared drink timer below |
| click a mob, `M == user`, not harm | canconsume passes | none | `"You swallow a gulp of [src]."` (:50) | falls to the shared drink timer below |
| shared drink step (after either branch above) | | `addtimer(..., 5)` = 5 ds (:51) | `playsound(M.loc,'sound/items/drink.ogg', rand(10,50), TRUE)` (:52) | `reagents.trans_to(M, 5, ...)` (:51), 5 units per timer |
| click a mob with empty container | `!reagents.total_volume` | none | `"[src] is empty!"` (:20, warning) | nothing |
| click a non-mob with `afterattack` (proximity), target `is_refillable()` | `spillable` (:59) | none | `"[src] is empty!"` (:64); `"[target] is full."` (:68); `"You transfer [trans] unit\s of the solution to [target]."` (:72, notice) | `reagents.trans_to(target, amount_per_transfer_from_this, transfered_by = user)` (:71) |
| afterattack, target `is_drainable()` | spillable | none | `"[target] is empty and can't be refilled!"` (:76); `"[src] is full."` (:80); `"You fill [src] with [trans] unit\s of the contents of [target]."` (:84, notice) | `target.reagents.trans_to(src, amount_per_transfer_from_this)` (:83) |
| afterattack, any other target with reagents, harm intent | reagents.total_volume > 0 (:86) | none | `"[user] splashes the contents of [src] onto [target]!"` (:88); `"You splash the contents of [src] onto [target]."` (:89, notice) | `reagents.expose(target, TOUCH)` (:90), `clear_reagents()` (:91) |
| attackby with a hot item (`I.get_temperature()` non-zero) | reagents exist (:95) | none | `"You heat [name] with [I]!"` (:97, notice) | `reagents.expose_temperature(hotness)` (:96), then `..()` (:109) |
| attackby with an egg (`/obj/item/reagent_containers/food/snacks/egg`) | container not full | none | `"You break [E] in [src]."` (:105, notice); full: `"[src] is full."` (:103) | egg reagents `trans_to(src, ...)` (:106), egg `qdel` (:107), returns without `..()` (:108) |

Glass parent: `afterattack` also returns at once when `!proximity` or `!check_allowed_items(target, target_self=1)` (:56). Thrown-impact splash comes from the reagent_containers parent (see above).

### /obj/item (defaults that the entries below inherit)
- /obj: force = 0 (`code/game/objects/objs.dm:9`, inside `/obj` declared at objs.dm:2)
- /atom/movable: throwforce = 0 (`code/game/atoms_movable.dm:40`), throw_range = 7 (`code/game/atoms_movable.dm:11`)
- /obj/item: w_class = WEIGHT_CLASS_NORMAL (`code/game/objects/items.dm:77`, overridden to TINY by reagent_containers.dm:6), slot_flags = 0 (items.dm:79), max_integrity = 200 (items.dm:57), hitsound = null (items.dm:64), attack_verb = null (items.dm:131), armour_penetration = 0 (items.dm:118)
- None of the bottles below set force, throwforce, slot_flags, hitsound, attack_verb, armor or custom_materials: they inherit the values above, and `custom_materials` is unset (no material cost).

### /obj/item/reagent_containers/glass/bottle  `code/modules/reagents/reagent_containers/bottle.dm:3`
- name = "bottle" (:4), desc = "A small bottle." (:5), icon_state = "bottle" (:6), inhand_icon_state = "atoxinbottle" (:7)
- possible_transfer_amounts = list(5,10,15,25,30) (:8), volume = 30 (:9), fill_icon_thresholds = list(0, 10, 30, 50, 70) (:10)
- Initialize (:12-16): `. = ..()`, sets icon_state "bottle" if unset, then `update_icon()` (:16)
- Inherits from glass: amount_per_transfer_from_this = 10, reagent_flags = OPENCONTAINER | DUNKABLE, spillable = TRUE, resistance_flags = ACID_PROOF. Its interactions are the glass table above.

### /obj/item/reagent_containers/glass/bottle/nutrient  `code/modules/hydroponics/hydroitemdefines.dm:233`
- name = "bottle of nutrient" (:234), volume = 50 (:235), amount_per_transfer_from_this = 10 (:236), possible_transfer_amounts = list(1,2,5,10,15,25,50) (:237)
- Initialize (:239-242): `. = ..()` (runs the bottle Initialize), then `pixel_x = rand(-5, 5)` and `pixel_y = rand(-5, 5)` (:241-242): the sprite is jittered up to 5 px on each axis when placed
- Inherits from bottle (icon_state, inhand_icon_state, fill_icon_thresholds) and glass (reagent_flags, spillable, resistance_flags).

## Entries

### E-Z-Nutrient bottle  `/obj/item/reagent_containers/glass/bottle/nutrient/ez`   (hydroitemdefines.dm:245)
- In-game name: "bottle of E-Z-Nutrient" (hydroitemdefines.dm:246). Desc (:247): `"Contains a fertilizer that causes mild mutations and gradual plant growth with each harvest."`
- Parent: nutrient (hydroitemdefines.dm:233). volume 50, transfer amounts list(1,2,5,10,15,25,50) inherited from nutrient.
- list_reagents = list(/datum/reagent/plantnutriment/eznutriment = 50) (hydroitemdefines.dm:248): full, 50 units at round start.
- Interactions: glass table above. No override.
- Placed on BoxStation: x1 (from `docs/tg/_todo3/gap-items-04.txt`).

### Robust Harvest bottle  `/obj/item/reagent_containers/glass/bottle/nutrient/rh`   (hydroitemdefines.dm:255)
- In-game name: "bottle of Robust Harvest" (hydroitemdefines.dm:256). Desc (:257): `"Contains a fertilizer that increases the yield of a plant while gradually preventing mutations."`
- Parent: nutrient (hydroitemdefines.dm:233). Same volume and transfer values as E-Z-Nutrient.
- list_reagents = list(/datum/reagent/plantnutriment/robustharvestnutriment = 50) (hydroitemdefines.dm:258): full, 50 units at round start.
- Interactions: glass table above. No override.
- Placed on BoxStation: x1.

### Multiver bottle  `/obj/item/reagent_containers/glass/bottle/multiver`   (bottle.dm:55)
- In-game name: "multiver bottle" (bottle.dm:56). Desc (:57): `"A small bottle of multiver, which removes toxins and other chemicals from the bloodstream but causes shortness of breath. All effects scale with the amount of reagents in the patient."`
- Parent: bottle (bottle.dm:3). volume 30, transfer list(5,10,15,25,30) (bottle.dm:8-9), amount_per_transfer_from_this 10 (glass.dm:4).
- list_reagents = list(/datum/reagent/medicine/c2/multiver = 30) (bottle.dm:58): full, 30 units at round start. Reagent effects are not documented in this part.
- Interactions: glass table above. No override.
- Placed on BoxStation: x1.

### Toxin bottle  `/obj/item/reagent_containers/glass/bottle/toxin`   (bottle.dm:23)
- In-game name: "toxin bottle" (bottle.dm:24). Desc (:25): `"A small bottle of toxins. Do not drink, it is poisonous."`
- Parent: bottle (bottle.dm:3). Values as for the bottle.
- list_reagents = list(/datum/reagent/toxin = 30) (bottle.dm:26): full, 30 units at round start.
- Interactions: glass table above. No override.
- Placed on BoxStation: none listed in the list file (no count given).

## Coverage for part 1 (not the final Coverage, which is in the last part)
- Paths documented in this part: `/obj/item/reagent_containers/glass/bottle/multiver`, `/obj/item/reagent_containers/glass/bottle/nutrient/ez`, `/obj/item/reagent_containers/glass/bottle/nutrient/rh`, `/obj/item/reagent_containers/glass/bottle/toxin`

# gap-items-04, part 2: glass vessels (bowl, bucket)

Both inherit the glass parent (`code/modules/reagents/reagent_containers/glass.dm:2`, documented in part 1): amount_per_transfer_from_this = 10, possible_transfer_amounts = list(5, 10, 15, 20, 25, 30, 50), volume = 50, spillable = TRUE (glass.dm:8), resistance_flags = ACID_PROOF (glass.dm:9), and the glass `attack`, `afterattack` and `attackby` tables, unless the entry says otherwise. Base /obj/item defaults (force = 0, throwforce = 0, throw_range = 7, max_integrity = 200) apply as in part 1.

## Entries

### Bowl  `/obj/item/reagent_containers/glass/bowl`   (customizables.dm:299)
- In-game name: "bowl" (customizables.dm:300). Desc (:301): `"A simple bowl, used for soups and salads."`
- icon = 'icons/obj/food/soupsalad.dmi' (:302), icon_state = "bowl" (:303)
- reagent_flags = OPENCONTAINER (:304). Overrides glass (OPENCONTAINER | DUNKABLE): the bowl is not dunkable.
- custom_materials = list(/datum/material/glass = 500) (:305)
- w_class = WEIGHT_CLASS_NORMAL (:306), overrides the TINY of reagent_containers.dm:6
- volume 50, transfer 10, transfer list: inherited from glass (glass.dm:4-6)
- No list_reagents: starts empty.
- Other procs: `on_reagent_change(changetype)` calls `..()` then `update_icon()` (customizables.dm:326-328).

Interactions:

| held item / action | condition | delay (ds) | message(s), verbatim | result |
|---|---|---|---|---|
| held item is `/obj/item/reagent_containers/food/snacks` | `I.w_class > WEIGHT_CLASS_SMALL` (customizables.dm:311) | none | `"<span class='warning'>The ingredient is too big for [src]!</span>"` (:312) | nothing |
| held snack, bowl full of ingredients | `contents.len >= 20` (:313) | none | `"<span class='warning'>You can't add more ingredients to [src]!</span>"` (:314) | nothing |
| held snack, small enough, not full | `reagents.has_reagent(/datum/reagent/water, 10)` (:316) | none | none | creates `/obj/item/reagent_containers/food/snacks/customizable/soup` on the bowl's turf (:317) and calls `initialize_custom_food(src, S, user)` (:318) |
| held snack, small enough, not full, less than 10 water | else branch (:319) | none | none | creates `/obj/item/reagent_containers/food/snacks/customizable/salad` on the turf (:320) and calls `initialize_custom_food(src, S, user)` (:321) |
| any other held item | | | | `. = ..()`, the glass attackby (glass.dm:93-109; hot item and egg rules) (:323) |

Bowl attackby returns at :324. Source uses no delays and no messages besides the warnings above.

Gotchas:
- Soup versus salad is decided only by the water in the bowl: 10 units of `/datum/reagent/water` (customizables.dm:316).
- The bowl does not carry a `list_reagents`; any contents come from play.

### Bucket  `/obj/item/reagent_containers/glass/bucket`   (glass.dm:212)
- In-game name: "bucket" (glass.dm:213). Desc (:214): `"It's a bucket."`
- icon = 'icons/obj/janitor.dmi' (:215), icon_state = "bucket" (:216), inhand_icon_state = "bucket" (:217)
- lefthand_file = 'icons/mob/inhands/equipment/custodial_lefthand.dmi' (:218), righthand_file = 'icons/mob/inhands/equipment/custodial_righthand.dmi' (:219)
- custom_materials = list(/datum/material/iron=200) (:220)
- w_class = WEIGHT_CLASS_NORMAL (:221)
- amount_per_transfer_from_this = 20 (:222), possible_transfer_amounts = list(5,10,15,20,25,30,50,70) (:223), volume = 70 (:224)
- flags_inv = HIDEHAIR (:225), slot_flags = ITEM_SLOT_HEAD (:226)
- resistance_flags = NONE (:227) (overrides the glass ACID_PROOF)
- armor = list("melee" = 10, "bullet" = 0, "laser" = 0, "energy" = 0, "bomb" = 0, "bio" = 0, "rad" = 0, "fire" = 75, "acid" = 50) (:228). Source comment: "Weak melee protection, because you can wear it on your head."
- slot_equipment_priority (:229-238): ITEM_SLOT_BACK, ITEM_SLOT_ID, ITEM_SLOT_ICLOTHING, ITEM_SLOT_OCLOTHING, ITEM_SLOT_MASK, ITEM_SLOT_HEAD, ITEM_SLOT_NECK, ITEM_SLOT_FEET, ITEM_SLOT_GLOVES, ITEM_SLOT_EARS, ITEM_SLOT_EYES, ITEM_SLOT_BELT, ITEM_SLOT_SUITSTORE, ITEM_SLOT_LPOCKET, ITEM_SLOT_RPOCKET, ITEM_SLOT_DEX_STORAGE
- No list_reagents, so it starts empty. reagent_flags is inherited (OPENCONTAINER | DUNKABLE).

Interactions:

| held item / action | condition | delay (ds) | message(s), verbatim | result |
|---|---|---|---|---|
| mop (`/obj/item/mop`) | `reagents.total_volume < 1` (glass.dm:250) | none | `"<span class='warning'>[src] is out of water!</span>"` (:251) | nothing |
| mop | has reagents (glass.dm:252) | none | `"<span class='notice'>You wet [O] in [src].</span>"` (:254); `playsound(loc, 'sound/effects/slosh.ogg', 25, TRUE)` (:255) | `reagents.trans_to(O, 5, transfered_by = user)` (:253) |
| proximity sensor (`isprox(O)`) | any (glass.dm:256) | none | `"<span class='notice'>You add [O] to [src].</span>"` (:257) | `qdel(O)` (:258), `qdel(src)` (:259), `user.put_in_hands(new /obj/item/bot_assembly/cleanbot)` (:260). The bucket is consumed to make a cleanbot. Source comment on :256 says wooden buckets also work. |
| any other item | | | | `..()` (glass attackby, glass.dm:93-109) (:262) |

Equip and drop (glass.dm:264-284):

| event | condition | delay (ds) | message(s), verbatim | result |
|---|---|---|---|---|
| equipped into `ITEM_SLOT_HEAD` (`equipped(mob/user, slot)`, glass.dm:264-266) | `reagents.total_volume` non-zero (:267) | none | `"<span class='userdanger'>[src]'s contents spill all over you!</span>"` (:268) | `reagents.expose(user, TOUCH)` (:269), `reagents.clear_reagents()` (:270), `reagents.flags = NONE` (:271) |
| equipped into `ITEM_SLOT_HEAD`, empty | | none | none | `reagents.flags = NONE` (:271) only |
| dropped (`dropped(mob/user)`, glass.dm:273-275) | | none | none | `reagents.flags = initial(reagent_flags)` (:275) |
| `equip_to_best_slot`, has water (glass.dm:277-284) | `reagents.total_volume` non-zero | none | none | ITEM_SLOT_HEAD is removed from `slot_equipment_priority` for the equip attempt and put back afterwards (:278-283); it is never put on the head by auto-equip while it holds water |

Gotchas:
- A bucket with liquid in it spills on the wearer when put on the head, and while worn on the head the reagents are locked (flags NONE) until dropped.
- The wooden variant `/obj/item/reagent_containers/glass/bucket/wooden` (glass.dm:240) is not on this list and is not documented here. It differs in icon/inhand state, custom_materials wood, armor fire 0 (glass.dm:245), and resistance_flags FLAMMABLE (glass.dm:246).

## Coverage for part 2 (not the final Coverage)
- Paths documented in this part: `/obj/item/reagent_containers/glass/bowl`, `/obj/item/reagent_containers/glass/bucket`

# gap-items-04, part 3: hyposprays and medipens

Source tree: `_src/tg2020`. Parent blocks first, then the three entries of this family. The parent `/obj/item/reagent_containers` (reagent_containers.dm:1) and its `attack_self`/`throw_impact` are written in part 1.

## Parent: /obj/item/reagent_containers/hypospray  `code/modules/reagents/reagent_containers/hypospray.dm:1`
- name = "hypospray" (:2), desc = `"The DeForest Medical Corporation hypospray is a sterile, air-needle autoinjector for rapid administration of drugs to patients."` (:3)
- icon = 'icons/obj/syringe.dmi' (:4), icon_state = "hypo" (:8), inhand_icon_state = "hypo" (:5), lefthand_file = 'icons/mob/inhands/equipment/medical_lefthand.dmi' (:6), righthand_file = 'icons/mob/inhands/equipment/medical_righthand.dmi' (:7)
- amount_per_transfer_from_this = 5 (:9), volume = 30 (:10), possible_transfer_amounts = list() (:11)
- resistance_flags = ACID_PROOF (:12), reagent_flags = OPENCONTAINER (:13), slot_flags = ITEM_SLOT_BELT (:14)
- ignore_flags = 0 (:15), infinite = FALSE (:16)
- w_class: inherited WEIGHT_CLASS_TINY (reagent_containers.dm:6). No force, throwforce or custom_materials set (inherit the /obj defaults in part 1).
- `possible_transfer_amounts` is empty, so the inherited `attack_self` (reagent_containers.dm:34-45) does nothing: no transfer-amount cycling.
- `attack_paw(mob/user)` (:18-19): `return attack_hand(user)`.
- `attack(mob/living/M, mob/user)` (:21-22): calls `inject(M, user)`. It never calls `..()`, so harm intent does not change the result: a hypospray always tries to inject.
- No `afterattack`, no `attackby`: the hypospray does not take or give reagents to other containers by clicking.

### Proc: inject(mob/living/M, mob/user)  (hypospray.dm:24-54)
Injection delay: none. No `do_mob` or `do_after` in this proc.

| condition | delay (ds) | message(s), verbatim | result |
|---|---|---|---|
| `!reagents.total_volume` (:26) | none | `"<span class='warning'>[src] is empty!</span>"` (:27) to user | returns FALSE (:28) |
| `!iscarbon(M)` (:29) | none | none | returns FALSE (:30) silently |
| carbon, reagents present, and `(ignore_flags || M.can_inject(user, 1))` (:39) | none | to target `"<span class='warning'>You feel a tiny prick!</span>"` (:40); to user `"<span class='notice'>You inject [M] with [src].</span>"` (:41) | `fraction = min(amount_per_transfer_from_this / reagents.total_volume, 1)` (:42); `reagents.expose(M, INJECT, fraction)` (:43); if `M.reagents`: `reagents.trans_to(M, amount_per_transfer_from_this, transfered_by = user)` (:48), or `reagents.copy_to(M, amount_per_transfer_from_this)` when `infinite` (:50); returns TRUE (:53) |
| after a transfer, `M.reagents` set (:45) | none | `"<span class='notice'>[trans] unit\s injected. [reagents.total_volume] unit\s remaining in [src].</span>"` (:51) | `log_combat(user, M, "injected", src, "([contained])")` (:52) |
| `M.can_inject` false (no ignore_flags) | none | none in this proc | returns FALSE (:54). `can_inject` is overridden on subtypes; not read here. |

Gotcha: `log_combat` runs before the check (:37), so every attempt on a carbon is logged, even one that fails.

## Parent: /obj/item/reagent_containers/hypospray/medipen  `code/modules/reagents/reagent_containers/hypospray.dm:98`
The medipen base is itself the `epinephrine medipen` entry (its values are in its own entry below). Its children (stimpack, morphine, atropine, and so on) are not on this list and are not documented here. The survival medipen (entry 3) inherits the medipen values listed under its own heading.

## Entries

### hypospray (CMO)  `/obj/item/reagent_containers/hypospray/cmo`   (hypospray.dm:57)
- In-game name: "hypospray" (inherited from hypospray.dm:2; the CMO type sets no name). Desc: inherited (hypospray.dm:3).
- list_reagents = list(/datum/reagent/medicine/omnizine = 30) (hypospray.dm:58): full at round start, 30 units of omnizine.
- resistance_flags = INDESTRUCTIBLE | LAVA_PROOF | FIRE_PROOF | ACID_PROOF (hypospray.dm:59), overrides the parent's ACID_PROOF.
- volume 30, amount_per_transfer_from_this 5: inherited (hypospray.dm:9-10). Each click injects 5 units.
- Interactions: the hypospray `attack` -> `inject` table above. No override.
- Not on BoxStation list (the list file gives no count).

### epinephrine medipen  `/obj/item/reagent_containers/hypospray/medipen`   (hypospray.dm:98)
- In-game name: "epinephrine medipen" (hypospray.dm:99). Desc (:100): `"A rapid and safe way to stabilize patients in critical condition for personnel without advanced medical knowledge. Contains a powerful preservative that can delay decomposition when applied to a dead body."`
- icon_state = "medipen" (:101), inhand_icon_state = "medipen" (:102), lefthand_file / righthand_file = medical_lefthand.dmi / medical_righthand.dmi (:103-104)
- amount_per_transfer_from_this = 15 (:105), volume = 15 (:106)
- ignore_flags = 1 (:107): injects through hardsuits (source comment: "so you can medipen through hardsuits")
- reagent_flags = DRAWABLE (:108), overrides the parent's OPENCONTAINER (:13). Inferred: without OPENCONTAINER the pen is not an open container to pour into; the flag meanings are not read here.
- flags_1 = null (:109)
- list_reagents = list(/datum/reagent/medicine/epinephrine = 10, /datum/reagent/toxin/formaldehyde = 3, /datum/reagent/medicine/coagulant = 2) (:110): 15 units, full at round start.
- custom_price = 150 (:111), custom_premium_price = 300 (:112)
- Inherits inject from hypospray.dm:25-54, attack from hypospray.dm:21-22.

Interactions:

| held item / action | condition | delay (ds) | message(s), verbatim | result |
|---|---|---|---|---|
| click a living mob (attack) | as hypospray `inject` table | none | as hypospray `inject` table | as hypospray `inject` table, with the ignore_flags path (:39) |
| attack_self (use in hand) | `user.canUseTopic(src, BE_CLOSE, FALSE, NO_TK)` (:126) | none | none | `inject(user, user)` (:127): the user injects themselves; same messages as the hypospray `inject` table |
| inject succeeded (inject override, :118-123) | `. = ..()` TRUE (:120) | none | none | `reagents.maximum_volume = 0` (:121), `reagents.flags = NONE` (:122), `update_icon()` (:123): one-use. After one successful inject the pen is spent. |
| suicide_act (:114-116) | | none | `"<span class='suicide'>[user] begins to choke on \the [src]! It looks like [user.p_theyre()] trying to commit suicide!</span>"` (:115) | returns OXYLOSS (:116) |
| examine (:135-140) | `reagents.reagent_list.len` non-zero | none | `"<span class='notice'>It is currently loaded.</span>"` (:138); otherwise `"<span class='notice'>It is spent.</span>"` (:140) | none |
| update_icon_state (:129-133) | `reagents.total_volume > 0` | none | none | icon_state = initial ("medipen") (:131); else "medipen0" (:133) |

Gotcha: the `attack_self` path injects the holder with no delay and no target check beyond `canUseTopic` (:126).

### survival emergency medipen  `/obj/item/reagent_containers/hypospray/medipen/survival`   (hypospray.dm:216)
- In-game name: "survival emergency medipen" (hypospray.dm:217). Desc (:218): `"A medipen for surviving in the harsh environments, heals most common damage sources. WARNING: May cause organ damage."`
- Parent: medipen (hypospray.dm:98). Inherited: ignore_flags = 1 (:107), reagent_flags = DRAWABLE (:108), custom_price 150 (:111), custom_premium_price 300 (:112), attack_self (:125-127), suicide_act (:114-116), examine (:135-140), update_icon_state (:129-133), one-use inject tail (:118-123).
- icon_state = "stimpen" (:219), inhand_icon_state = "stimpen" (:220)
- volume = 30 (:221), amount_per_transfer_from_this = 30 (:222): the whole pen goes in one injection (before the pressure rule below).
- list_reagents = list( /datum/reagent/medicine/epinephrine = 8, /datum/reagent/medicine/c2/aiuri = 8, /datum/reagent/medicine/c2/libital = 8 ,/datum/reagent/medicine/leporazine = 6) (:223): 30 units, full at round start.

Overridden `inject(mob/living/M, mob/user)` (hypospray.dm:225-235): the dose depends on the air pressure on the user's turf. `lavaland_equipment_pressure_check` returns TRUE when the pressure is at or below `LAVALAND_EQUIPMENT_EFFECT_PRESSURE` = 50 (`code/__HELPERS/game.dm:530-539`, `code/__DEFINES/atmospherics.dm:269`). It returns FALSE when the turf has no air mixture.

| condition | delay (ds) | message(s), verbatim | result |
|---|---|---|---|
| pressure check TRUE (pressure <= 50) (:226 is false, block skipped) | none | none | `amount_per_transfer_from_this = initial(...)` = 30 (:234), then the medipen/hypospray inject: full 30 units (:235) |
| pressure check FALSE, and `M in user.do_afters` (:227) | none | `"<span class='notice'>You are too busy to use \the [src]!</span>"` (:228) | returns (:229): nothing injected |
| pressure check FALSE, no do_after in progress | `do_mob(user, M, 10 SECONDS)` = 100 ds (:231; `SECONDS` = `*10`, `code/__DEFINES/time.dm:41`) | `"<span class='notice'>You start manually releasing the low-pressure gauge...</span>"` (:230) to user | if `do_mob` completes: `amount_per_transfer_from_this = initial(...) * 0.5` = 15 (:232), then `..()` (:233): 15 units injected |
| same, but `do_mob` is interrupted (returns FALSE) | | | falls through to :234: `amount_per_transfer_from_this` = 30 and `..()` (:235): the FULL 30 units are injected. The code as written does not stop an interrupted release. (inferred from the control flow at hypospray.dm:225-235) |

Gotchas:
- The pressure rule is backwards from its message: the 10 s "release the low-pressure gauge" wait and the half dose happen when the turf pressure is above 50, and the full dose is instant when it is at or below 50 (hypospray.dm:226, 232, 234; `code/__HELPERS/game.dm:530-539`).
- The 15-unit dose only happens if the 10 s wait is completed; an interrupted wait still injects 30 units (see the last row).
- Because `inject` is overridden, `attack_self` (medipen, hypospray.dm:125-127) also uses this rule when used on oneself: `do_mob(user, user, 10 SECONDS)` when the pressure is above 50.
- Medipen behaviour after use: maximum_volume set to 0, flags NONE (:121-122).

Interactions: table as in the medipen entry above. Plus the `inject` override rule just described.

## Coverage for part 3 (not the final Coverage)
- Paths documented in this part: `/obj/item/reagent_containers/hypospray/cmo`, `/obj/item/reagent_containers/hypospray/medipen`, `/obj/item/reagent_containers/hypospray/medipen/survival`

# gap-items-04, part 4: syringes, pill/patch parent, aiuri patch

Source tree: `_src/tg2020`. Parents first (syringe, lethal, pill, patch), then the entries.

## Parent: /obj/item/reagent_containers/syringe  `code/modules/reagents/reagent_containers/syringes.dm:1`
- name = "syringe" (:2), desc = `"A syringe that can hold up to 15 units."` (:3), icon = 'icons/obj/syringe.dmi' (:4), icon_state = "0" (:8), inhand_icon_state = "syringe_0" (:5), lefthand_file / righthand_file = medical_lefthand.dmi / medical_righthand.dmi (:6-7)
- amount_per_transfer_from_this = 5 (:9), possible_transfer_amounts = list() (:10), volume = 15 (:11)
- mode = SYRINGE_DRAW (:12); SYRINGE_DRAW = 0, SYRINGE_INJECT = 1 (`code/__DEFINES/misc.dm:378-379`)
- busy = FALSE (:13), proj_piercing = 0 (:14)
- custom_materials = list(/datum/material/iron=10, /datum/material/glass=20) (:15)
- reagent_flags = TRANSPARENT (:16) (not OPENCONTAINER: the syringe has its own afterattack and does not use the glass transfer rules)
- custom_price = 150 (:17)
- Initialize (:19-23): if `list_reagents` is set (pre-filled type), `mode = SYRINGE_INJECT` (:21-22): pre-filled syringes start in INJECT mode.
- on_reagent_change, pickup, dropped, attack_hand, attack_paw: each calls `update_icon()` (:29-50). No messages.
- attackby (:52-53): empty override: a syringe ignores every held item.
- update_icon_state (:158-161): icon_state = `get_rounded_vol()`, which is `clamp(round(total / volume * 15, 5), 1, 15)`, or 0 when empty (:180-184).
- w_class: inherited WEIGHT_CLASS_TINY (reagent_containers.dm:6). No force, throwforce or slot_flags set.

### Interactions of the syringe parent

| held item / action | condition | delay (ds) | message(s), verbatim | result |
|---|---|---|---|---|
| attack_self (use in hand) | any | none | none | toggles `mode` (syringes.dm:41), `update_icon()` (:42) |
| attackby (any item) | | none | none | nothing (:52-53) |
| afterattack, `busy` set | | none | none | returns (:57-58) |
| afterattack, not adjacent (`!proximity`) or target without reagents | | none | none | returns (:59-62) |
| afterattack, living target, `!L.can_inject(user, 1)` | | none | none | returns (:67-68) |
| afterattack, monkey target | `prob(MONKEY_SYRINGE_RETALIATION_PROB)` with `MONKEY_SYRINGE_RETALIATION_PROB` = 20 (`code/__DEFINES/monkeys.dm:14`) (:71) | none | none | `M.retaliate(user)` (:74) |
| DRAW, syringe already full (`reagents.total_volume >= reagents.maximum_volume`) | (:79) | none | `"<span class='notice'>The syringe is full.</span>"` (:80) | returns |
| DRAW, living target that is not the user | | do_mob with default `time = 3 SECONDS` = 30 ds (`code/__HELPERS/mobs.dm:181`, `code/__DEFINES/time.dm:41`) (:89) | to others `"<span class='danger'>[user] is trying to take a blood sample from [target]!</span>"` (:86); to target `"<span class='userdanger'>[user] is trying to take a blood sample from you!</span>"` (:87) | `busy = TRUE` (:88); if the wait is interrupted: `busy = FALSE`, returns (:90-91) |
| DRAW, living target, sample taken | `L.transfer_blood_to(src, drawn_amount)` (:95) | none | success: `"<span class='notice'>[user] takes a blood sample from [L].</span>"` (:96); failure: `"<span class='warning'>You are unable to draw any blood from [L]!</span>"` (:98) | blood moved into the syringe up to the free volume (`drawn_amount` = max - total, :84) |
| DRAW, non-mob target, empty | `!target.reagents.total_volume` (:101) | none | `"<span class='warning'>[target] is empty!</span>"` (:102) | returns |
| DRAW, non-mob target, not drawable | `!target.is_drawable(user)` (:105) | none | `"<span class='warning'>You cannot directly remove reagents from [target]!</span>"` (:106) | returns |
| DRAW, non-mob target, drawable | | none | `"<span class='notice'>You fill [src] with [trans] units of the solution. It now contains [reagents.total_volume] units.</span>"` (:111) | `target.reagents.trans_to(src, amount_per_transfer_from_this, transfered_by = user)` (:109). After any DRAW that did not return early (blood or reagents), if the syringe is now full, `mode` flips to INJECT (:112-114) |
| INJECT, syringe empty | `!reagents.total_volume` (:121) | none | `"<span class='warning'>[src] is empty!</span>"` (:122) | returns |
| INJECT, non-living target that is not injectable | `!L && !target.is_injectable(user)` (:125) | none | `"<span class='warning'>You cannot directly fill [target]!</span>"` (:126) | returns |
| INJECT, target reagents full | (:129) | none | `"<span class='notice'>[target] is full.</span>"` (:130) | returns |
| INJECT, living target, not the user | `L.can_inject(user, TRUE)` (:134); do_mob with default 30 ds (:139) | 30 ds (default) (:139) | `"<span class='danger'>[user] is trying to inject [L]!</span>"` (:137); `"<span class='userdanger'>[user] is trying to inject you!</span>"` (:138); after the wait: `"<span class='danger'>[user] injects [L] with the syringe!</span>"` (:145); `"<span class='userdanger'>[user] injects you with the syringe!</span>"` (:146) | returns if the wait is interrupted, if the syringe empties, or if the target is full (:140-144) |
| INJECT, living target, is the user | | none | none | `log_message` only (:150-151) |
| INJECT, any target that got past the checks | | none | `"<span class='notice'>You inject [amount_per_transfer_from_this] units of the solution. The syringe now contains [reagents.total_volume] units.</span>"` (:153) | `reagents.trans_to(target, amount_per_transfer_from_this, transfered_by = user, method = INJECT)` (:152); if empty, `mode` flips back to DRAW (:154-156) |

Gotchas:
- The syringe's mode decides everything: in DRAW it takes reagents or blood from the target, in INJECT it gives them. It starts in INJECT when pre-filled (:21-22) and flips itself at both ends (:112-114, :154-156).
- An injection moves `amount_per_transfer_from_this` units in one click: 5 for the base syringe (:9), 50 for the lethal syringe (lethal entry).
- The living-target path checks `can_inject` (:67, :134), which is overridden on subtypes (not read here).

## Entries

### syringe (spaceacillin)  `/obj/item/reagent_containers/syringe/antiviral`   (syringes.dm:201)
- In-game name: "syringe (spaceacillin)" (syringes.dm:202). Desc (:203): `"Contains antiviral agents."`
- list_reagents = list(/datum/reagent/medicine/spaceacillin = 15) (syringes.dm:204): full at round start, 15 units.
- Starts in INJECT mode (syringes.dm:21-22), because list_reagents is set.
- Parent: syringe. volume 15, amount_per_transfer_from_this 5, interactions the table above.
- Placed on BoxStation: x1.

### lethal injection syringe  `/obj/item/reagent_containers/syringe/lethal`   (syringes.dm:221)
- This is the parent of the execution syringe. Its own values:
  - name = "lethal injection syringe" (syringes.dm:222)
  - desc = `"A syringe used for lethal injections. It can hold up to 50 units."` (:223)
  - amount_per_transfer_from_this = 50 (:224), volume = 50 (:225)
- Inherits the syringe interaction table. The syringe's `proc/afterattack`, with `amount_per_transfer_from_this` = 50, moves 50 units per injection.
- Child on this list: `lethal/execution` (below). Other children (`lethal/choral`, syringes.dm:227-228) are not on this list.

### lethal injection syringe  `/obj/item/reagent_containers/syringe/lethal/execution`   (syringes.dm:230)
- In-game name: "lethal injection syringe" (inherited from syringes.dm:222; the child sets no name).
- list_reagents = list(/datum/reagent/toxin/plasma = 15, /datum/reagent/toxin/formaldehyde = 15, /datum/reagent/toxin/cyanide = 10, /datum/reagent/toxin/acid/fluacid = 10) (syringes.dm:231): 50 units, full at round start (volume 50).
- Starts in INJECT mode (syringes.dm:21-22).
- Inherits from lethal (syringes.dm:221-225): amount_per_transfer_from_this = 50, volume = 50.
- Interactions: the syringe table. One click on another living target gives all 50 units after the 30 ds default do_mob wait (syringes.dm:139), since the transfer amount is 50.
- Placed on BoxStation: none listed in the list file (no count given).

## Parent: /obj/item/reagent_containers/pill  `code/modules/reagents/reagent_containers/pill.dm:1`
- name = "pill" (:2), desc = `"A tablet or capsule."` (:3), icon = 'icons/obj/chemical.dmi' (:4), icon_state = "pill" (:5), inhand_icon_state = "pill" (:6), lefthand_file / righthand_file = medical files (:7-8)
- possible_transfer_amounts = list() (:9), volume = 50 (:10), grind_results = list() (:11)
- apply_type = INGEST (:12; INGEST = 2, `code/__DEFINES/reagents.dm:21`), apply_method = "swallow" (:13)
- rename_with_volume = FALSE (:14), self_delay = 0 (:15), dissolvable = TRUE (:16)
- Initialize (:18-23): if `icon_state` is empty, `icon_state = "pill[rand(1,20)]"` (:20-21); if `rename_with_volume`, `name += " ([reagents.total_volume]u)"` (:22-23)
- attack_self (:26-27): returns, does nothing
- attack (:30-55): see the table below
- afterattack (:58-74): see the table below

### Pill attack table (pill.dm:30-55)

| case | condition | delay (ds) | message(s), verbatim | result |
|---|---|---|---|---|
| `!canconsume(M, user)` | (:31) | none | from canconsume | returns FALSE (:32) |
| self (`M == user`) | | `do_mob(user, M, self_delay)` only if `self_delay` is non-zero (:36-37) | to others `"<span class='notice'>[user] attempts to [apply_method] [src].</span>"` (:35); to self `"<span class='notice'>You [apply_method] [src].</span>"` (:39) | if the wait is interrupted, returns FALSE (:37-38) |
| other target | | `do_mob(user, M)` default = 30 ds (`code/__HELPERS/mobs.dm:181`) (:44) | to others `"<span class='danger'>[user] attempts to force [M] to [apply_method] [src].</span>"` (:42); to target `"<span class='userdanger'>[user] attempts to force you to [apply_method] [src].</span>"` (:43); after the wait `"<span class='danger'>[user] forces [M] to [apply_method] [src].</span>"` (:46) and `"<span class='userdanger'>[user] forces you to [apply_method] [src].</span>"` (:47) | if the wait is interrupted, returns FALSE (:44-45) |
| red-pill joke, `icon_state == "pill4"` and `prob(5)` | (:49) | `addtimer(..., 50)` = 50 ds (:50) | `pick(strings(REDPILL_FILE, "redpill_questions"))` shown as notice to M | not applicable to patches (their icon_state is "bandaid_*") |
| transfer | `reagents.total_volume` non-zero (:52) | none | none | `reagents.trans_to(M, reagents.total_volume, transfered_by = user, method = apply_type)` (:53); `qdel(src)` (:54); returns TRUE (:55) |

### Pill afterattack table (pill.dm:58-74)

| case | condition | delay (ds) | message(s), verbatim | result |
|---|---|---|---|---|
| not in proximity | (:60) | none | none | returns |
| not dissolvable or target not refillable | `!dissolvable || !target.is_refillable()` (:62) | none | none | returns |
| target is a drainable container and empty | (:64) | none | `"<span class='warning'>[target] is empty! There's nothing to dissolve [src] in.</span>"` (:65) | returns |
| target full | `target.reagents.holder_full()` (:68) | none | `"<span class='warning'>[target] is full.</span>"` (:69) | returns |
| dissolve | | none | `"<span class='warning'>[user] slips something into [target]!</span>"` (:72) to others; `"<span class='notice'>You dissolve [src] in [target].</span>"` (:72) to user | `reagents.trans_to(target, reagents.total_volume, transfered_by = user)` (:73); `qdel(src)` (:74) |

## Parent: /obj/item/reagent_containers/pill/patch  `code/modules/reagents/reagent_containers/patch.dm:1`
- name = "chemical patch" (patch.dm:2), desc = `"A chemical patch for touch based applications."` (:3), icon = 'icons/obj/chemical.dmi' (:4), icon_state = "bandaid" (:5), inhand_icon_state = "bandaid" (:6)
- possible_transfer_amounts = list() (:7), volume = 40 (:8)
- apply_type = PATCH (:9; PATCH = 4, `code/__DEFINES/reagents.dm:23`), apply_method = "apply" (:10)
- self_delay = 30 (:11), source comment "three seconds" = 30 ds. dissolvable = FALSE (:12).
- Inherits from pill: possible_transfer_amounts, grind_results, the Initialize (icon_state is set, so no random pill icon, and rename_with_volume is FALSE, so no name suffix), attack_self (does nothing), afterattack (never dissolves, as dissolvable is FALSE).

### Patch attack (patch.dm:14-28)

| case | condition | delay (ds) | message(s), verbatim | result |
|---|---|---|---|---|
| target is human, no body part in the zone | `L.get_bodypart(check_zone(user.zone_selected))` is null (patch.dm:16-17) | none | `"<span class='warning'>The limb is missing!</span>"` (:18) | returns (:19) |
| target is human, robotic limb | `affecting.status != BODYPART_ORGANIC` (:20) | none | `"<span class='notice'>Medicine won't work on a robotic limb!</span>"` (:21) | returns (:22) |
| otherwise | | pill attack delays (self 30 ds; other 30 ds default) | pill attack messages with `apply_method` = "apply" | `..()` (:23) |
| canconsume (patch.dm:25-28) | | | | carbon: 1 (masks do not block patches; source comment at :28) |

## Entry: aiuri patch (burn)  `/obj/item/reagent_containers/pill/patch/aiuri`   (patch.dm:36)
- In-game name: "aiuri patch (burn)" (patch.dm:37). Desc (:38): `"Helps with burn injuries. Does minor eye damage. Diluted with Granibitaluri."`
- list_reagents = list(/datum/reagent/medicine/c2/aiuri = 1, /datum/reagent/medicine/granibitaluri = 9) (patch.dm:39): 10 units, so it starts partly full (volume 40, patch.dm:8).
- icon_state = "bandaid_burn" (patch.dm:40)
- Inherits the patch parent (self_delay 30, apply_type PATCH, dissolvable FALSE, the limb and robotic checks) and the pill attack table (self 30 ds; other 30 ds default do_mob).
- Placed on BoxStation: x1.
- Gotcha: the patch can only be applied to a body part that is organic and present (patch.dm:16-21). The target zone is `user.zone_selected`.

## Coverage for part 4 (not the final Coverage)
- Paths documented in this part: `/obj/item/reagent_containers/syringe/antiviral`, `/obj/item/reagent_containers/syringe/lethal/execution`, `/obj/item/reagent_containers/pill/patch/aiuri`

# gap-items-04, part 5: spray bottles (space cleaner, pepperspray, water flower)

Source tree: `_src/tg2020`. The parent `/obj/item/reagent_containers/spray` is written once here; its procs apply to all three entries.

## Parent: /obj/item/reagent_containers/spray  `code/modules/reagents/reagent_containers/spray.dm:1`
- name = "spray bottle" (:2), desc = `"A spray bottle, with an unscrewable top."` (:3), icon = 'icons/obj/janitor.dmi' (:4), icon_state = "sprayer_large" (:5), inhand_icon_state = "cleaner" (:6), lefthand_file / righthand_file = custodial_lefthand.dmi / custodial_righthand.dmi (:7-8)
- item_flags = NOBLUDGEON (:9), reagent_flags = OPENCONTAINER (:10), slot_flags = ITEM_SLOT_BELT (:11)
- throwforce = 0 (:12), w_class = WEIGHT_CLASS_SMALL (:13), throw_speed = 3 (:14), throw_range = 7 (:15)
- stream_mode = 0 (:16), current_range = 3 (:17), spray_range = 3 (:18), stream_range = 1 (:19), stream_amount = 10 (:20), can_fill_from_container = TRUE (:21)
- amount_per_transfer_from_this = 5 (:22), volume = 250 (:23), possible_transfer_amounts = list(5,10,15,20,25,30,50,100) (:24)
- force: inherited 0 (`code/game/objects/objs.dm:9`). attack_verb: inherited null (items.dm:131).

### Parent interactions

| held item / action | condition | delay (ds) | message(s), verbatim | result |
|---|---|---|---|---|
| attack_self (use in hand) | `stream_mode` toggled (:117) | none | `"<span class='notice'>You switch the nozzle setting to [stream_mode ? "\"stream\"":"\"spray\""]. You'll now use [amount_per_transfer_from_this] units per use.</span>"` (:124) | stream: `amount_per_transfer_from_this = stream_amount` (10) and `current_range = stream_range` (1) (:118-120). spray: `amount_per_transfer_from_this = initial(...)` and `current_range = spray_range` (:121-123) |
| afterattack on a sink, janitorial cart or hydroponics machine (`istype`) | (:28) | none | none | returns (:29) |
| afterattack on a drainable, non-refillable target within 1 tile, `can_fill_from_container` (:31) | target has no reagents (:32) | none | `"<span class='warning'>[A] is empty.</span>"` (:33) | returns (:34) |
| same, container full (:36) | | none | `"<span class='warning'>[src] is full.</span>"` (:37) | returns (:38) |
| same, fill | | none | `"<span class='notice'>You fill \the [src] with [trans] units of the contents of \the [A].</span>"` (:41) | `A.reagents.trans_to(src, 50, transfered_by = user)` (:40): always 50 units, not the transfer amount |
| afterattack spray, `reagents.total_volume < amount_per_transfer_from_this` (:44) | | none | `"<span class='warning'>Not enough left!</span>"` (:45) | returns (:46) |
| afterattack spray, otherwise | | `sleep(wait_step)` per tile of travel (:73, :82); `changeNext_move(CLICK_CD_RANGE*2)` = 2 x 4 = 8 (:51, `code/__DEFINES/combat.dm:53`) | `playsound(src.loc, 'sound/effects/spray2.ogg', 50, TRUE, -6)` (:50) | `spray(A, user)` (:48); `newtonian_move(get_dir(A, user))` recoil (:52); logged (:57-58) |
| attackby with a hot item (`I.get_temperature()`) | `hotness && reagents` (:128) | none | `"<span class='notice'>You heat [name] with [I]!</span>"` (:130) | `reagents.expose_temperature(hotness)` (:129), then `..()` (:131) |
| verb "Empty Spray Bottle" (:133-144) | `usr` not incapacitated; player confirms `alert(... "Yes", "No")` (:139); `src.loc == usr` (:141) | none | `"<span class='notice'>You empty \the [src] onto the floor.</span>"` (:142) | `reagents.expose(usr.loc)`, `clear_reagents()` (:143-144) |

### Proc: spray(atom/A, mob/user)  (spray.dm:62-74)
- `range = max(min(current_range, get_dist(src, A)), 1)` (:63)
- makes a `/obj/effect/decal/chempuff` with `create_reagents(amount_per_transfer_from_this)` (:64-65)
- stream mode: `reagents.trans_to(D, amount_per_transfer_from_this)` (:68), `puff_reagent_left = 1` (:69). Spray mode: `reagents.trans_to(D, amount_per_transfer_from_this, 1/range)` (:71), `puff_reagent_left = range` (:66)
- `wait_step = max(round(2+3/range), 2)` (:73): ds between puff steps. Range 1 gives 5 ds, range 2 gives 4 ds, range 3 gives 3 ds, range 4 gives 3 ds (DM `round`).
- `do_spray(A, wait_step, D, range, puff_reagent_left, user)` (:74)

### Proc: do_spray  (spray.dm:76-114)
- `set waitfor = FALSE` (:77). Loops `range` times: `step_towards(D, A)`, `sleep(wait_step)` (:81-82). Each turf: exposes the puff to atoms there with VAPOR (:96, :101, :103, :108); stream mode hits living mobs only if `M.can_inject()` (:93) and standing or out of range (:95). Puff is qdel'd when used up (:111-114).
- No messages. Delay: `wait_step` ds per tile.
- Stream mode logs each living mob hit (:99).

### Proc: on_reagent_change  (spray.dm:146-159)
- Sets `spray_range` from the average `R.reagent_weight` of the contents: `clamp(round((initial(spray_range) / average_reagent_weight) - ((amount_of_reagents - 1) * 1)), 3, 5)` (:155). So the spray reaches 3 to 5 tiles; each extra reagent costs one tile. `reagent_weight` is a `/datum/reagent` var, not read here.
- Empty: `spray_range = initial(spray_range)` (:157). If not in stream mode: `current_range = spray_range` (:158-159).

### Parent: no other delays. The spray itself has no do_after.

## Entries

### space cleaner  `/obj/item/reagent_containers/spray/cleaner`   (spray.dm:162)
- In-game name: "space cleaner" (spray.dm:163). Desc (:164): `"BLAM!-brand non-foaming space cleaner!"`
- icon_state = "cleaner" (:165), volume = 100 (:166)
- list_reagents = list(/datum/reagent/space_cleaner = 100) (:167): full at round start, 100 units.
- amount_per_transfer_from_this = 2 (:168): spray mode uses 2 units per click (the type's `initial()` value, which the parent's attack_self restores). stream_amount = 5 (:169): stream mode uses 5 units.
- Other values inherited: spray_range 3, stream_range 1, current_range 3 (spray.dm:17-19), w_class SMALL, reagent_flags OPENCONTAINER.
- Interactions: parent table above. Plus the child proc below.
- suicide_act (spray.dm:171-183): visible `"<span class='suicide'>[user] is putting the nozzle of \the [src] in [user.p_their()] mouth. It looks like [user.p_theyre()] trying to commit suicide!</span>"` (:172). `do_mob(user, user, 30)` = 30 ds (:173). If it completes and reagents >= amount (:174): `"<span class='suicide'>[user] pulls the trigger!</span>"` (:175), `spray(user)` (:176), returns BRUTELOSS (:177). If empty: `"<span class='suicide'>[user] pulls the trigger...but \the [src] is empty!</span>"` (:179), returns SHAME (:180). If the wait is cancelled: `"<span class='suicide'>[user] decided life was worth living.</span>"` (:182), returns MANUAL_SUICIDE_NONLETHAL (:183).
- Placed on BoxStation: x6.

### pepperspray  `/obj/item/reagent_containers/spray/pepper`   (spray.dm:194)
- In-game name: "pepperspray" (spray.dm:195). Desc (:196): `"Manufactured by UhangInc, used to blind and down an opponent quickly."`
- icon = 'icons/obj/items_and_weapons.dmi' (:197), icon_state = "pepperspray" (:198), inhand_icon_state = "pepperspray" (:199), lefthand_file / righthand_file = security_lefthand.dmi / security_righthand.dmi (:200-201)
- volume = 50 (:202), stream_range = 4 (:203), amount_per_transfer_from_this = 5 (:204)
- list_reagents = list(/datum/reagent/consumable/condensedcapsaicin = 50) (:205): full at round start, 50 units.
- Stream mode reaches 4 tiles (stream_range, :203) and uses stream_amount 10 (inherited, spray.dm:20).
- suicide_act (:210-212): visible `"<span class='suicide'>[user] begins huffing \the [src]! It looks like [user.p_theyre()] getting a dirty high!</span>"` (:211); returns OXYLOSS (:212). No do_mob.
- afterattack (:215-218): `if (A.loc == user) return` (:216-217): clicking an item in one's own inventory does not spray; otherwise the parent afterattack (:218).
- Placed on BoxStation: x2.

### water flower  `/obj/item/reagent_containers/spray/waterflower`   (spray.dm:221)
- In-game name: "water flower" (spray.dm:222). Desc (:223): `"A seemingly innocent sunflower...with a twist."`
- icon = 'icons/obj/hydroponics/harvest.dmi' (:224), icon_state = "sunflower" (:225), inhand_icon_state = "sunflower" (:226)
- amount_per_transfer_from_this = 1 (:227), volume = 10 (:228)
- list_reagents = list(/datum/reagent/water = 10) (:229): full at round start, 10 units of water.
- attack_self (:231-232): returns with no effect. The nozzle cannot be switched, so the flower always uses spray mode: 1 unit per click, range 3 (spray_range inherited, spray.dm:18).
- Interactions: parent table above (afterattack spray path, hot-item attackby, empty verb). The attack_self row does not apply.
- Child `/obj/item/reagent_containers/spray/waterflower/superlube` ("clown flower", spray.dm:235) and the cyborg children (spray.dm:243-260) are not on the list and are not documented here.
- Placed on BoxStation: none listed in the list file (no count given).

## Coverage for part 5 (not the final Coverage)
- Paths documented in this part: `/obj/item/reagent_containers/spray/cleaner`, `/obj/item/reagent_containers/spray/pepper`, `/obj/item/reagent_containers/spray/waterflower`

# gap-items-04, part 6: surgery tools (retractor, scalpel)

Source tree: `_src/tg2020`. Both tools have no `attack_self`, `afterattack` or `attackby` of their own. Their actions are the surgery steps that list their `tool_behaviour` in `implements`, plus the scalpel's butchering component. The surgery engine is written once here (surgery_step.dm), then the two entries.

## Surgery engine (applies to every step named below)  `code/modules/surgery/surgery_step.dm`
- A step matches a tool when `ispath(key) && istype(tool, key)` or `tool.tool_behaviour == key` (surgery_step.dm:31-34). The value in `implements` is the success chance in % (:3).
- Default `time = 10` ds (surgery_step.dm:7). Each step sets its own `time` (noted per step below).
- `try_op` only runs when the target zone is the surgery's location and the zone is exposed; otherwise `"<span class='warning'>You need to expose [target]'s [parse_zone(target_zone)] to perform surgery on it!</span>"` (surgery_step.dm:43-47).
- `initiate` refuses when the user already has do_afters, unless they hold the Hippocratic oath status (surgery_step.dm:66-67).
- Delay (surgery_step.dm:78-93): `speed_mod = tool.toolspeed` (:79); `implement_speed_mod = implements[implement_type] / 100` (:81-83); `speed_mod /= (get_location_modifier(target) * (1 + surgery.speed_modifier) * implement_speed_mod)` (:85); `modded_time = time * speed_mod * user.mind.get_skill_modifier(/datum/skill/healing, SKILL_SPEED_MODIFIER)` (:86). `fail_prob = min(max(0, modded_time - time*2), 99)` (:89) and `modded_time = min(modded_time, time * SURGERY_SLOWDOWN_CAP_MULTIPLIER)` with the multiplier 2 (:61, :90). So the delay is capped at twice the step time, and the success roll is `prob(100 - fail_prob)` (:100). `get_location_modifier` and `surgery.speed_modifier` are not read here.
- Consequence (inferred from the lines above): a tool with a low implement percentage makes the step slower before the cap and sharply raises `fail_prob`. A 10% implement at base speed gives a pre-cap time of time x 10, so `fail_prob` reaches 99 (assuming location and skill modifiers are 1).
- Default `preop` message (surgery_step.dm:120-123) is replaced in each step below. Default `success` (surgery_step.dm:125-131) when `default_display_results` is TRUE: `"<span class='notice'>You succeed.</span>"` (:127), `"<span class='notice'>[user] succeeds!</span>"` (:128), vague `"<span class='notice'>[user] finishes.</span>"` (:129).
- Default `failure` (surgery_step.dm:133-146): `"<span class='warning'>You screw up![screwedmessage]</span>"` (:143), `"<span class='warning'>[user] screws up!</span>"` (:144); `screwedmessage` is `" You almost had it, though."` (fail_prob 0-24, :137), `" This is hard to get right in these conditions..."` (50-74, :139), `" This is practically impossible in these conditions..."` (75-99, :141).
- `display_results` (surgery_step.dm:178-183): the surgeon and bystanders next to them see the detailed text; everyone else sees the vague text.

## Entries

### retractor  `/obj/item/retractor`   (tools.dm:1)
- In-game name: "retractor" (tools.dm:2). Desc (:3): `"Retracts stuff."`
- icon = 'icons/obj/surgery.dmi' (:4), icon_state = "retractor" (:5), inhand_icon_state = "clamps" (:8), lefthand_file = 'icons/mob/inhands/equipment/medical_lefthand.dmi' (:6), righthand_file = 'icons/mob/inhands/equipment/medical_righthand.dmi' (:7)
- custom_materials = list(iron = 6000, glass = 3000) (:9)
- flags_1 = CONDUCT_1 (:10), item_flags = SURGICAL_TOOL (:11)
- w_class = WEIGHT_CLASS_TINY (:12)
- tool_behaviour = TOOL_RETRACTOR (:13) (`"retractor"`, `code/__DEFINES/tools.dm:11`), toolspeed = 1 (:14)
- force, throwforce, throw_range: inherited (0, 0, 7; `objs.dm:9`, `atoms_movable.dm:40`, `atoms_movable.dm:11`). No attack_verb, no hitsound, no slot_flags.
- Augmented child `/obj/item/retractor/augment` (tools.dm:16-18: toolspeed 0.5) and `/obj/item/retractor/advanced` (tools.dm:287-307) are not on the list. The advanced one switches between retractor and hemostat by `attack_self`.

Surgery steps that use the retractor (`implements` lists):

| step | file:line | implement % | step time (ds) | notes |
|---|---|---|---|---|
| retract skin | `code/modules/surgery/organic_steps.dm:66-69` | TOOL_RETRACTOR = 100 (:68) | 24 (:69) | the main use |
| remove loose fat (lipoplasty) | `code/modules/surgery/lipoplasty.dm:31-34` | TOOL_RETRACTOR = 100 (:33) | 32 (:34) | sits in the Lipoplasty surgery |
| mechanic unwrench | `code/modules/surgery/mechanic_steps.dm:57-62` | TOOL_RETRACTOR = 10 (:61) | 24 (:62) | robotic limbs |
| mechanic wrench | `code/modules/surgery/mechanic_steps.dm:70-75` | TOOL_RETRACTOR = 10 (:74) | 24 (:75) | robotic limbs |

Retract skin specifics:
- preop (organic_steps.dm:71-74): self `"<span class='notice'>You begin to retract the skin in [target]'s [parse_zone(target_zone)]...</span>"` (:72); detailed and vague `"<span class='notice'>[user] begins to retract the skin in [target]'s [parse_zone(target_zone)].</span>"` (:73-74).
- success: no override, so the default success messages above apply (`default_display_results` = TRUE, surgery_step.dm:125-131). Result: the step is advanced (`surgery.status++`) by `initiate` (surgery_step.dm:109-110).
- Delay with the retractor at 100% and toolspeed 1: `modded_time = 24 / (location modifier x (1 + surgery.speed_modifier))` times the skill modifier, capped at 48 ds (surgery_step.dm:86, :90). The cap value is `time * 2` = 48 ds.

Gotchas:
- The mechanic steps (10%) reach a near-certain failure (inferred from the engine notes above).
- The retractor acts only through the surgery steps listed above. Other places that set `TOOL_RETRACTOR` are not documented here: the mecha work tool (`code/game/mecha/equipment/tools/work_tools.dm:11`) and the debug item (`code/game/objects/items/debug_items.dm:90`).

Drops, deconstruction, health and power: none on the item itself (no `new` or `drop_location` lines in `tools.dm:1-14`). Not powered.

### scalpel  `/obj/item/scalpel`   (tools.dm:95)
- In-game name: "scalpel" (tools.dm:96). Desc (:97): `"Cut, cut, and once more cut."`
- icon = 'icons/obj/surgery.dmi' (:98), icon_state = "scalpel" (:99), inhand_icon_state = "scalpel" (:102), lefthand_file / righthand_file = medical files (:100-101)
- flags_1 = CONDUCT_1 (:103), item_flags = SURGICAL_TOOL | EYE_STAB (:104)
- force = 10 (:105), w_class = WEIGHT_CLASS_TINY (:106), throwforce = 5 (:107), throw_speed = 3 (:108), throw_range = 5 (:109)
- custom_materials = list(iron = 4000, glass = 1000) (:110)
- attack_verb = list("attacked", "slashed", "stabbed", "sliced", "tore", "lacerated", "ripped", "diced", "cut") (:111)
- hitsound = 'sound/weapons/bladeslice.ogg' (:112), sharpness = IS_SHARP_ACCURATE (:113)
- tool_behaviour = TOOL_SCALPEL (:114), toolspeed = 1 (:115), bare_wound_bonus = 20 (:116)
- Initialize (:118-120): `AddComponent(/datum/component/butchering, 80 * toolspeed, 100, 0)`: speed 80 ds, effectiveness 100 %, bonus modifier 0 (`code/datums/components/butchering.dm:9-15`, default speed 80 at :2)
- suicide_act (:126-128): visible `"<span class='suicide'>[user] is slitting [user.p_their()] [pick("wrists", "throat", "stomach")] with [src]! It looks like [user.p_theyre()] trying to commit suicide!</span>"` (:127); returns BRUTELOSS (:128). No delay.
- attack_self, afterattack, attackby: none on the type (tools.dm:95-116).

Butchering (the scalpel's non-surgery action), from `code/datums/components/butchering.dm`:
- Triggers on `COMSIG_ITEM_ATTACK` (:23), only when `user.a_intent == INTENT_HARM` (:26-27), the target is dead and has `butcher_results` or `guaranteed_butcher_results` (:28), and `butchering_enabled && (can_be_blunt || source.get_sharpness())` (:29). The scalpel is sharp (IS_SHARP_ACCURATE), so it qualifies.
- `startButcher` (butchering.dm:43-47): `"<span class='notice'>You begin to butcher [M]...</span>"` (:44); `playsound(M.loc, butcher_sound, 50, TRUE, -1)` (:45); `do_mob(user, M, speed)` with speed = 80 ds (:46); then `Butcher(user, M)` if the mob is still adjacent to the source (:46-47). The `Butcher` proc itself is not read here.

Surgery steps that use the scalpel (`implements` lists):

| step | file:line | implement % | step time (ds) | notes |
|---|---|---|---|---|
| make incision | `code/modules/surgery/organic_steps.dm:3-30` | TOOL_SCALPEL = 100 (:5) | 16 (:7) | the main use; see below |
| mechanic open | `code/modules/surgery/mechanic_steps.dm:2-9` | TOOL_SCALPEL = 75 (:6) | 24 (:9) | robotic limbs |
| mechanic close | `code/modules/surgery/mechanic_steps.dm:23-30` | TOOL_SCALPEL = 75 (:27) | 24 (:30) | robotic limbs |
| other steps: chance only | `plastic_surgery.dm:9` = 100; `lobectomy.dm:18` = 95; `hepatectomy.dm:24` = 95; `gastrectomy.dm:25` = 95; `experimental_dissection.dm:26` = 45 (scalpel/augment is also listed there); `coronary_bypass.dm:18` = 90; `burn_dressing.dm:24` = 85; `amputation.dm:12` = 100; `lobotomy.dm:26` = 85 | | | these are the `implements` lines only; step names and times are not documented in this part |

Make incision specifics (organic_steps.dm:3-30):
- preop (organic_steps.dm:9-12): self `"<span class='notice'>You begin to make an incision in [target]'s [parse_zone(target_zone)]...</span>"` (:10); detailed `"<span class='notice'>[user] begins to make an incision in [target]'s [parse_zone(target_zone)].</span>"` (:11); vague (:12) same text.
- tool_check (organic_steps.dm:14-18): fails only for a bare `/obj/item` implement with no sharpness. A scalpel matches TOOL_SCALPEL and passes.
- success (organic_steps.dm:20-30): for a human whose species lacks `NOBLOOD` (:23): `"<span class='notice'>Blood pools around the incision in [H]'s [parse_zone(target_zone)].</span>"` (:24-26); `BP.generic_bleedstacks += 10` (:29). Then `return ..()` (:30). That call passes `default_display_results` = FALSE (:20), so the default "You succeed." messages are not shown for incisions.
- Gotcha: `/datum/surgery_step/incise/nobleed` (organic_steps.dm:32-42) is a separate step type, not on this list.

Health, drops and power: no health or armor values on the scalpel beyond the inherited `max_integrity` 200 (items.dm:57). Nothing drops. Not powered.

## Coverage for part 6 (not the final Coverage)
- Paths documented in this part: `/obj/item/retractor`, `/obj/item/scalpel`

# gap-items-04, part 7: restraints and shields (bear trap, telescopic shield)

Source tree: `_src/tg2020`. Parents first: restraints base and legcuffs (handcuffs.dm), shield base and riot shield (shields.dm).

## Parent: /obj/item/restraints  `code/game/objects/items/handcuffs.dm:1`
- breakouttime = 600 (handcuffs.dm:2) (ds, = 60 s)
- suicide_act (:4-6): `"<span class='suicide'>[user] is strangling [user.p_them()]self with [src]! It looks like [user.p_theyre()] trying to commit suicide!</span>"` (:5), returns OXYLOSS (:6)
- Destroy (:8-19): if held by a carbon, clears `handcuffed` / `legcuffed` on the wearer and unbuckles them when `buckle_requires_restraints` (:9-18)

## Parent: /obj/item/restraints/legcuffs  `code/game/objects/items/handcuffs.dm:205`
- name = "leg cuffs" (:206), desc = `"Use this to keep prisoners in line."` (:207), gender = PLURAL (:208)
- icon = 'icons/obj/items_and_weapons.dmi' (:209), icon_state = "handcuff" (:210), lefthand_file / righthand_file = security files (:211-212)
- flags_1 = CONDUCT_1 (:213), throwforce = 0 (:214), w_class = WEIGHT_CLASS_NORMAL (:215)
- slowdown = 7 (:216). Applies as the wearer's leg-cuff speed modifier when attached (the speed-mod proc is not read here).
- breakouttime = 30 SECONDS (:217) = 300 ds, overrides the 600 of the restraints base.
- No custom_materials, armor, slot_flags or force set on this type (inherit /obj defaults).

## Entry: bear trap  `/obj/item/restraints/legcuffs/beartrap`   (handcuffs.dm:219)
- In-game name: "bear trap" (handcuffs.dm:220). Desc (:224): `"A trap used to catch bears and other legged creatures."`
- icon_state = "beartrap" (:223), throw_speed = 1 (:221), throw_range = 1 (:222)
- armed = 0 (:225), trap_damage = 20 (:226)
- Inherits from legcuffs: slowdown 7, breakouttime 300 ds, w_class NORMAL, gender PLURAL.
- Placed on BoxStation: x2.

Procs:

| proc | file:line | condition | delay (ds) | message(s), verbatim | result |
|---|---|---|---|---|---|
| Initialize (:228-230) | | | none | none | `update_icon()` |
| update_icon_state (:232-233) | | | none | none | `icon_state = "[initial(icon_state)][armed]"`: "beartrap0" when disarmed, "beartrap1" when armed |
| attack_self (:240-245) | `..()` then `ishuman(user) && !user.stat && !user.restrained()` (:242) | none | `"<span class='notice'>[src] is now [armed ? "armed" : "disarmed"]</span>"` (:245) | toggles `armed` (:243), `update_icon()` (:244) |
| suicide_act (:235-238) | | none | `"<span class='suicide'>[user] is sticking [user.p_their()] head in the [src.name]! It looks like [user.p_theyre()] trying to commit suicide!</span>"` (:236) | `playsound(loc, 'sound/weapons/bladeslice.ogg', 50, TRUE, -1)` (:237); returns BRUTELOSS (:238) |
| close_trap (:247-250) | | | none | none | `armed = FALSE`, `update_icon()`, `playsound(src, 'sound/effects/snap.ogg', 50, TRUE)` (:250) |
| Crossed (:252-287) | `armed && isturf(loc)` (:253) and `isliving(AM)` (:254) | none | see below | see below |

Crossed, in order (handcuffs.dm:252-287):
1. Riding a vehicle (`istype(L.buckled, /obj/vehicle)`, :257): if the vehicle's `are_legs_exposed` is FALSE, the trap closes with no damage and no trap: `"<span class='danger'>[ridden_vehicle] triggers \the [src].</span>"` (:261), then `..()` (:262).
2. Flying or floating (`L.movement_type & (FLYING|FLOATING)`, :264-265): `snap = FALSE`, the trap does not close.
3. Carbon standing (`C.mobility_flags & MOBILITY_STAND`, :270): `def_zone = pick(BODY_ZONE_L_LEG, BODY_ZONE_R_LEG)` (:271); the default `def_zone` is `BODY_ZONE_CHEST` (:267). If there is no leg cuff yet and the carbon has at least 2 legs (`C.get_num_legs(FALSE) >= 2`, :272): `C.legcuffed = src`, `forceMove(C)` (:273-274), speed mods and leg-cuff inventory updated (:275-276), `SSblackbox.record_feedback` (:277). The trap then sits on the leg.
4. Simple animal (:278-281): if `SA.mob_size <= MOB_SIZE_TINY` (`mob_size` tiny), `snap = FALSE`.
5. If `snap`: `close_trap()` (:283); to others `"<span class='danger'>[L] triggers \the [src].</span>"` (:284), to target `"<span class='userdanger'>You trigger \the [src]!</span>"` (:285); `L.apply_damage(trap_damage, BRUTE, def_zone)` = 20 BRUTE (:286).

Interactions (summary):

| held item / action | condition | delay (ds) | message(s) | result |
|---|---|---|---|---|
| attack_self (in hand) | human, not stat, not restrained | none | `"<span class='notice'>[src] is now [armed ? "armed" : "disarmed"]</span>"` (:245) | armed toggles |
| step on it (Crossed) | armed; living mob; `snap` still TRUE | none | see Crossed above | closes (`close_trap`) and deals 20 BRUTE (`trap_damage`, :286) to a random leg for a standing carbon (:271), or to the chest otherwise (:267). A standing carbon with two legs and no legcuffs also gets the trap attached to a leg (:272-274); the damage still applies (inferred from the flow: no branch sets `snap` to FALSE after the carbon block) |
| no attack, afterattack or attackby of its own | | | | inherits `/obj/item` defaults |

Drops, deconstruction and health: none defined. The trap is not destructible beyond the `/obj` `max_integrity` 200 inherited from `items.dm:57`. A trap that is attached to a leg is moved into the wearer (`forceMove(C)`, :274). No `new` or `drop_location` lines on the type.

Power: none.

Gotchas:
- The trap only snaps when `armed` (:253). Riders whose legs are inside a vehicle, flying and floating mobs, and tiny simple animals do not trigger it (:259-265, :280-281).
- Only one legcuff can be on a carbon: `!C.legcuffed` (:272). A carbon with fewer than 2 legs is hit but not cuffed (:272).

## Parent: /obj/item/shield  `code/game/objects/items/shields.dm:1`
- name = "shield" (:2), icon = 'icons/obj/shields.dmi' (:3), block_chance = 50 (:4)
- armor = list("melee" = 50, "bullet" = 50, "laser" = 50, "energy" = 0, "bomb" = 30, "bio" = 0, "rad" = 0, "fire" = 80, "acid" = 70) (:5)
- transparent = FALSE (:6) (lets beam projectiles pass when TRUE)
- on_shield_block (:8-9): returns TRUE (base)

## Parent: /obj/item/shield/riot  `code/game/objects/items/shields.dm:11`
- name = "riot shield" (:12), desc = `"A shield adept at blocking blunt objects from connecting with the torso of the shield wielder."` (:13), icon_state = "riot" (:14), lefthand_file / righthand_file = shields files (:15-16)
- slot_flags = ITEM_SLOT_BACK (:17), force = 10 (:18), throwforce = 5 (:19), throw_speed = 2 (:20), throw_range = 3 (:21), w_class = WEIGHT_CLASS_BULKY (:22)
- custom_materials = list(glass = 7500, iron = 1000) (:23)
- attack_verb = list("shoved", "bashed") (:24), cooldown = 0 (:25), transparent = TRUE (:26), max_integrity = 75 (:27), material_flags = MATERIAL_NO_EFFECTS (:28)
- hit_reaction (:30-39): `transparent && (hitby.pass_flags & PASSGLASS)` returns FALSE (:31-32); thrown attacks add 30 to the block chance (:33-34); leap attacks force 100 (:35-36); then the parent `hit_reaction`, and `on_shield_block` if the block happened (:37-39)
- on_shield_block (:73-81): if `obj_integrity <= damage`: `"<span class='warning'>[hitby] destroys [src]!</span>"` (:76), `shatter(owner)` (:77), `qdel(src)` (:78), returns FALSE. Else `take_damage(damage)` (:80).
- shatter (:69-71): `playsound(owner, 'sound/effects/glassbr3.ogg', 100)` (:70), `new /obj/item/shard((get_turf(src)))` (:71)
- attackby (:41-56): a baton (`/obj/item/melee/baton`) bashes the shield when `cooldown < world.time - 25` (:43): `"<span class='warning'>[user] bashes [src] with [W]!</span>"` (:44), `playsound(user.loc, 'sound/effects/shieldbash.ogg', 50, TRUE)` (:45), `cooldown = world.time` (:46) (25 ds window). A titanium sheet repairs it: `"<span class='warning'>[src] is already in perfect condition.</span>"` (:49) when full; otherwise `T.use(1)` (:52), `obj_integrity = max_integrity` (:53), `"<span class='notice'>You repair [src] with [T].</span>"` (:54). Anything else goes to `..()` (:56).
- examine (:58-67): integrity text `"<span class='info'>It looks slightly damaged.</span>"` (50-99%), `"<span class='info'>It appears heavily damaged.</span>"` (25-50%), `"<span class='warning'>It's falling apart!</span>"` (0-25%), using `round((obj_integrity/max_integrity) * 100, 1)` (:60)

## Entry: telescopic shield  `/obj/item/shield/riot/tele`   (shields.dm:240)
- In-game name: "telescopic shield" (shields.dm:241). Desc (:242): `"An advanced riot shield made of lightweight materials that collapses for easy storage."`
- icon_state = "teleriot0" (:243), lefthand_file / righthand_file = shields files (:244-245)
- custom_materials = list(iron = 3600, glass = 3600, silver = 270, titanium = 180) (:246), overrides the riot's list.
- slot_flags = null (:247) (overrides ITEM_SLOT_BACK): can't be worn on the back while collapsed.
- force = 3 (:248), throwforce = 3 (:249), throw_speed = 3 (:250), throw_range = 4 (:251), w_class = WEIGHT_CLASS_NORMAL (:252) (all while collapsed)
- var active = 0 (:253)
- Inherits from riot: block_chance 50, armor (melee 50, bullet 50, laser 50, energy 0, bomb 30, bio 0, rad 0, fire 80, acid 70), max_integrity 75, transparent TRUE, attack_verb shoved/bashed, material_flags MATERIAL_NO_EFFECTS, the attackby and on_shield_block procs.

Procs:

| proc | file:line | condition | delay (ds) | message(s), verbatim | result |
|---|---|---|---|---|---|
| hit_reaction (:255-258) | `active` (:256) | none | none | if not active, returns 0: a collapsed shield never blocks. If active, `..()` (riot hit_reaction) |
| attack_self (:260-279) | any user | none | `playsound(src.loc, 'sound/weapons/batonextend.ogg', 50, TRUE)` (:263) | toggles `active` (:261), `icon_state = "teleriot[active]"` (:262) |
| attack_self, extending (active) | | none | `"<span class='notice'>You extend \the [src].</span>"` (:271) | force 8 (:266), throwforce 5 (:267), throw_speed 2 (:268), w_class BULKY (:269), slot_flags ITEM_SLOT_BACK (:270) |
| attack_self, collapsing (not active) | | none | `"<span class='notice'>[src] can now be concealed.</span>"` (:278) | force 3 (:273), throwforce 3 (:274), throw_speed 3 (:275), w_class NORMAL (:276), slot_flags null (:277) |
| attack_self, end | | none | none | `add_fingerprint(user)` (:279) |

Gotchas:
- The shield's block and melee numbers change with `active`: extended it hits for 8 and can be worn on the back. Collapsed it hits for 3, blocks nothing, and is carried as a normal item.
- Placed on BoxStation: none listed in the list file (no count given).

Drops, deconstruction and health: no `new` or `drop_location` lines on the tele type. When its integrity reaches the damage it takes, the riot `on_shield_block` breaks it: it drops `/obj/item/shard` on its turf and is deleted (shields.dm:73-81). Health: max_integrity 75 (inherited). Power: none.

## Coverage for part 7 (not the final Coverage)
- Paths documented in this part: `/obj/item/restraints/legcuffs/beartrap`, `/obj/item/shield/riot/tele`

# gap-items-04, part 8: soap (deluxe, Nanotrasen) and soapstone

Source tree: `_src/tg2020`. The soap parent (clown_items.dm:13-154) is written once here; the two soap entries are its children. The soapstone is a separate base type (soapstone.dm).

## Parent: /obj/item/soap  `code/game/objects/items/clown_items.dm:13`
- name = "soap" (:14), desc = `"A cheap bar of soap. Doesn't smell."` (:15), gender = PLURAL (:16)
- icon = 'icons/obj/items_and_weapons.dmi' (:17), icon_state = "soap" (:18), lefthand_file / righthand_file = custodial files (:19-20)
- w_class = WEIGHT_CLASS_TINY (:21), item_flags = NOBLUDGEON (:22), throwforce = 0 (:23), throw_speed = 3 (:24), throw_range = 7 (:25)
- grind_results = list(/datum/reagent/lye = 10) (:26)
- cleanspeed = 35 (:27), source comment "slower than mop". force_string = `"robust... against germs"` (:28). uses = 100 (:29).
- ComponentInitialize (:31-33): `AddComponent(/datum/component/slippery, 80)` (argument 80 as written; the component signature is not read).
- force: inherited 0 (`code/game/objects/objs.dm:9`). attack_verb: null. No armour.

### Parent procs

**examine** (clown_items.dm:35-52): if `uses` is still the type's `initial` value, `"<span class='notice'>It looks like it just came out of the package.</span>"` (:38). Otherwise by `uses / max_uses`:
- 0 to 0.15 (:42-43): `"There's just a tiny bit left of what it used to be, you're not sure it'll last much longer."`
- 0.15 to 0.30 (:44-45): `"It's dissolved quite a bit, but there's still some life to it."`
- 0.30 to 0.50 (:46-47): `"It's past its prime, but it's definitely still good."`
- 0.50 to 0.75 (:48-49): `"It's started to get a little smaller than it used to be, but it'll definitely still last for a while."`
- else (:50-51): `"It's seen some light use, but it's still pretty fresh."`
(All texts are inside `<span class='notice'>`, :52.)

**suicide_act** (:94-98): `user.say(";FFFFFFFFFFFFFFFFUUUUUUUDGE!!", forced="soap suicide")` (:95); visible `"<span class='suicide'>[user] lifts [src] to [user.p_their()] mouth and gnaws on it furiously, producing a thick froth! [user.p_they(TRUE)]'ll never get that BB gun now!</span>"` (:96); `new /obj/effect/particle_effect/foam(loc)` (:97); returns TOXLOSS (:98). No delay.

**decreaseUses(user)** (:100-106): `skillcheck = user.mind.get_skill_modifier(/datum/skill/cleaning, SKILL_SPEED_MODIFIER)`; with probability `skillcheck * 100` percent, `uses--` (:101-103). When `uses <= 0`: `"<span class='warning'>[src] crumbles into tiny bits!</span>"` (:105) and `qdel(src)` (:106). So a use is not always spent. The source comment at :102 says "higher level = more uses assuming RNG is nice"; the direction of `SKILL_SPEED_MODIFIER` is not read here.

**afterattack** (:108-154):

| target / case | condition | delay (ds) | message(s), verbatim | result |
|---|---|---|---|---|
| not in proximity, or `!check_allowed_items(target)` | (:110-111) | none | none | returns |
| clean speed | `clean_speedies = cleanspeed * min(skill_modifier + 0.1, 1)` (:112) | this value is the `do_after` delay in each branch below | | the skill modifier is per player (not read) |
| target is on the client's screen and not held | `user.client && ((target in user.client.screen) && !user.is_holding(target))` (:115) | none | `"<span class='warning'>You need to take that [target.name] off before cleaning it!</span>"` (:116) | nothing |
| target is a cleanable decal (`/obj/effect/decal/cleanable`) | (:117) | `do_after(user, clean_speedies, target = target)` (:119) | start: visible `"<span class='notice'>[user] begins to scrub \the [target.name] out with [src].</span>"` (:118), self `"<span class='warning'>You begin to scrub \the [target.name] out with [src]...</span>"` (:118); done: `"<span class='notice'>You scrub \the [target.name] out.</span>"` (:120) | `qdel(target)` (:123), experience from `beauty` (:122), `decreaseUses(user)` (:124) |
| human target, `user.zone_selected == BODY_ZONE_PRECISE_MOUTH` | (:126) | none (no do_after) | visible `"<span class='warning'>\the [user] washes \the [target]'s mouth out with [src.name]!</span>"` (:128); self `"<span class='notice'>You wash \the [target]'s mouth out with [src.name]!</span>"` (:128) | `H = user` (:127, see gotcha), `H.lip_style = null` (:131), `H.update_body()` (:132), `decreaseUses(user)` (:133), returns (:134) |
| window (`/obj/structure/window`) | (:135) | `do_after(user, clean_speedies, target = target)` (:137) | start: `"<span class='notice'>[user] begins to clean \the [target.name] with [src]...</span>"` (:136) visible, `"<span class='notice'>You begin to clean \the [target.name] with [src]...</span>"` (:136) self; done: `"<span class='notice'>You clean \the [target.name].</span>"` (:138) | removes WASHABLE colour (:139), restores `initial(target.opacity)` (:140), experience, `decreaseUses(user)` (:142) |
| any other target | (:143) | `do_after(user, clean_speedies, target = target)` (:145) | start and done: same texts as the window branch, lines :144 and :146 | deletes each `cleanable` in the target turf (:147-149), `remove_atom_colour(WASHABLE_COLOUR_PRIORITY)` (:150), `SEND_SIGNAL(target, COMSIG_COMPONENT_CLEAN_ACT, CLEAN_MEDIUM)` (:151), experience (:152), `decreaseUses(user)` (:153) |

Gotcha (as written): in the mouth branch, `var/mob/living/carbon/human/H = user` (clown_items.dm:127). The lipstick reset and `update_body()` (:131-132) therefore act on the washer, not on the target. Inferred from the code, not tested.

**Soap children and the cleaning clock.** A use costs `clean_speedies` ds of `do_after` (:119, :137, :145). The formula is `cleanspeed x min(skill modifier + 0.1, 1)`, so a skill modifier of 0.9 or more gives the full `cleanspeed` (:112).

## Entries

### soap (Nanotrasen)  `/obj/item/soap/nanotrasen`   (clown_items.dm:54)
- In-game name: "soap" (inherited, clown_items.dm:14). Desc (:55): `"A heavy duty bar of Nanotrasen brand soap. Smells of plasma."`
- grind_results = list(/datum/reagent/toxin/plasma = 10, /datum/reagent/lye = 10) (:56) (replaces the parent's lye-only list)
- icon_state = "soapnt" (:57)
- cleanspeed = 28 (:58), source comment "janitor gets this"
- uses = 300 (:59) (parent 100)
- Other values, interactions and suicide: as the parent.
- Placed on BoxStation: x2.

### soap (deluxe)  `/obj/item/soap/deluxe`   (clown_items.dm:66)
- In-game name: "soap" (inherited, clown_items.dm:14). Desc (:67): `"A deluxe Waffle Co. brand bar of soap. Smells of high-class luxury."`
- icon_state = "soapdeluxe" (:68)
- cleanspeed = 20 (:69), source comment "captain gets one of these"
- uses: inherited 100 (clown_items.dm:29)
- grind_results: inherited lye 10 (clown_items.dm:26)
- Other values, interactions and suicide: as the parent.
- Placed on BoxStation: x2.

## Entry: soapstone  `/obj/item/soapstone`   (soapstone.dm:1)
- In-game name: "soapstone" (soapstone.dm:2). Desc (:3): `"Leave informative messages for the crew, including the crew of future shifts!\nEven if out of uses, it can still be used to remove messages.\n(Not suitable for engraving on shuttles, off station or on cats. Side effects may include prompt beatings, psychotic clown incursions, and/or orbital bombardment.)"`
- icon = 'icons/obj/items_and_weapons.dmi' (:4), icon_state = "soapstone" (:5)
- throw_speed = 3 (:6), throw_range = 5 (:7), w_class = WEIGHT_CLASS_TINY (:8)
- tool_speed = 50 (:9): delay in ds for every engrave or erase (:40, :59)
- remaining_uses = 3 (:10). `-1` is unlimited (see `can_use`, :68).
- Initialize (:12-14): `check_name()`.
- check_name (:82-87): `name = initial(name)` = "soapstone" when `remaining_uses` is non-zero; otherwise `"dull [initial(name)]"` = "dull soapstone".
- examine (:16-19): `"It has [remaining_uses] uses left."` (:19), not shown when `remaining_uses == -1`.
- Force, attack_verb, armor: inherited (0; none).
- Placed on BoxStation: none listed in the list file (no count given).

afterattack (soapstone.dm:21-66). Engraving needs `proximity` (:24-25):

| case | condition | delay (ds) | message(s), verbatim | result |
|---|---|---|---|---|
| no uses left and no message on the turf | `!remaining_uses && !existing_message` (:29) | none | `"<span class='warning'>[src] is too worn out to use.</span>"` (:30) | returns |
| wrong surface | `!good_chisel_message_location(T)` (:33): only floor or wall turfs (:102-108) | none | `"<span class='warning'>It's not appropriate to engrave on [T].</span>"` (:34) | returns |
| erase an existing message | `existing_message` on the turf (:37) | `do_after(user, tool_speed, target = existing_message)` = 50 ds (:40) | start: visible `"<span class='notice'>[user] starts erasing [existing_message].</span>"` (:38), self `"<span class='notice'>You start erasing [existing_message].</span>"` (:38), hear `"<span class='hear'>You hear a chipping sound.</span>"` (:38); done: visible `"<span class='notice'>[user] erases [existing_message].</span>"` (:41), self `"<span class='notice'>You erase [existing_message][existing_message.creator_key == user.ckey ? ", refunding a use" : ""].</span>"` (:41) | `persists = FALSE`, `qdel(existing_message)` (:42-43); playsound gavel.ogg 50 (:39, :44); `refund_use()` if the creator is the user (:45-46). Returns (:47). |
| cancelled text | `stripped_input` empty (:49-51) | none | `"<span class='notice'>You decide not to engrave anything.</span>"` (:51) | returns |
| someone wrote here while typing | `!target.Adjacent(user) && locate(/obj/structure/chisel_message) in T` (:54) | none | `"<span class='warning'>Someone wrote here before you chose! Find another spot.</span>"` (:55) | returns |
| engrave | `can_use() && do_after(user, tool_speed, target = T) && can_use()` (:59) | `do_after` = 50 ds (:59) | start: visible `"<span class='notice'>[user] starts engraving a message into [T]...</span>"` (:58), self `"<span class='notice'>You start engraving a message into [T]...</span>"` (:58), hear `"<span class='hear'>You hear a chipping sound.</span>"` (:58); done (if no message is on the turf yet, :60): visible `"<span class='notice'>[user] leaves a message for future spacemen!</span>"` (:61), self `"<span class='notice'>You engrave a message into [T]!</span>"` (:61) | `playsound(loc, 'sound/items/gavel.ogg', 50, TRUE, -1)` (:57, :62); creates `/obj/structure/chisel_message` on T (:63); `M.register(user, message)` (:64); `remove_use()` (:65) |

Notes on the engraved message (soapstone.dm:110-209):
- `/obj/structure/chisel_message` (name "engraved message", desc "A message from a past traveler.", icon_state "soapstone_message", density FALSE, anchored TRUE, max_integrity 30, :110-118). Stored in `SSpersistence.chisel_messages` (:133).
- Its `persists` flag is cleared when a soapstone erases it (:42) and when an admin deletes it (:264), so it is then not saved. At init it is deleted at once when its turf is not a floor or wall (:137-139).
- The message is hashed to a colour and gives light radius 1 (`update_icon`, :149-155).
- The message can be liked or disliked by any player except its creator (`ui_act`, :238-258). Admins can delete it (:259-265).

Use accounting:
- `can_use()` is true when `remaining_uses == -1` or `>= 0` (:67-68). `remove_use` lowers the count (not below 0, :70-74). `refund_use` raises it again, except for unlimited (:76-80).
- Each erase by the creator refunds one use (:45-46).

Gotchas:
- Engraving and erasing are both 50 ds `do_after`s (`tool_speed`, :9).
- The soapstone children `soapstone/infinite` (remaining_uses -1, soapstone.dm:96-97) and `soapstone/empty` (remaining_uses 0, :99-100) are not on this list and are not documented here.

## Coverage for part 8 (not the final Coverage)
- Paths documented in this part: `/obj/item/soap/nanotrasen`, `/obj/item/soap/deluxe`, `/obj/item/soapstone`

# gap-items-04, part 9: medical stacks (bruise pack, gauze, ointment)

Source tree: `_src/tg2020`. Parents first: the stack base (stack.dm), then the medical stack base (medical.dm), then the three entries.

## Parent: /obj/item/stack  `code/game/objects/items/stacks/stack.dm:13`
- icon = 'icons/obj/stack_objects.dmi' (:14), gender = PLURAL (:15), material_modifier = 0.01 (:16), max_integrity = 100 (:17)
- singular_name (:19, null), amount = 1 (:20), max_amount = 50 (:21), cost = 1 (:24), merge_type (:25, null = own type), full_w_class = WEIGHT_CLASS_NORMAL (:26), novariants = TRUE (:27)
- splint_factor, absorption_capacity, absorption_rate: null here (:36, :38, :40); set on the medical children
- force, throwforce, attack_verb: inherited (0, 0, null)
- Initialize(mapload, new_amount, merge = TRUE) (:53-82): sets `amount` from `new_amount`; any excess over `max_amount` makes new stacks (:56-58); scales `custom_materials` by `amount` (:61-66); merges with an identical stack on the same turf (:68-71); calls `update_weight()` (:81) and `update_icon()` (:82).
- update_weight (:88-94): `amount <= max_amount/3` gives `w_class = clamp(full_w_class - 2, TINY, full)`; `amount <= 2/3 max` gives `full - 1`; otherwise `full`. So the weight class depends on the stack size and overrides the explicit `w_class` set on a subtype.
- update_icon_state (:97-105): if `novariants` is TRUE, nothing. Otherwise icon_state is the base at `<= max/3`, `"<base>_2"` at `<= 2/3 max`, `"<base>_3"` above.
- use(used, transfer = FALSE, check = TRUE) (:325-342): `amount < used` returns FALSE (:330-331); otherwise `amount -= used`, `update_weight()`, `update_icon()`; `zero_amount()` deletes a stack at 0 (:358-364).
- attack_self (:138-139): opens the recipe window through `interact` and `ui_interact` (:141-150). The medical stacks have no recipes.
- attackby (:448-454): a stack of the same `merge_type` merges and prints `"<span class='notice'>Your [S.name] stack now contains [S.get_amount()] [S.singular_name]\s.</span>"` (:452). Anything else goes to `..()`.
- microwave_act (:463-465): adds `amount` to `M.dirty` when below 100.

## Parent: /obj/item/stack/medical  `code/game/objects/items/stacks/medical.dm:1`
- name = "medical pack" (:2), singular_name = "medical pack" (:3), icon = 'icons/obj/stack_objects.dmi' (:4)
- amount = 6 (:5), max_amount = 6 (:6)
- w_class = WEIGHT_CLASS_TINY (:7), full_w_class = WEIGHT_CLASS_TINY (:8): the weight class stays TINY at every size (clamp, stack.dm:90-94)
- throw_speed = 3 (:9), throw_range = 7 (:10), resistance_flags = FLAMMABLE (:11), max_integrity = 40 (:12), novariants = FALSE (:13), item_flags = NOBLUDGEON (:14)
- self_delay = 50 (:15) (ds), other_delay = 0 (:16), repeating = FALSE (:17), experience_given = 1 (:18)
- heal_brute, heal_burn, stop_bleeding, sanitization, flesh_regeneration: null (:20-28) and set on the children

Procs:

| proc | file:line | condition | delay (ds) | message(s), verbatim | result |
|---|---|---|---|---|---|
| attack(mob/living/M, mob/user) (:30-32) | | | | | `. = ..()` then `try_heal(M, user)` |
| try_heal (:35-54) | `!M.can_inject(user, TRUE)` (:36) | none | | | returns |
| try_heal, self (`M == user`) | | `do_mob(user, M, self_delay)` (:41), `self_delay` (default 50) | self: `"<span class='notice'>You begin applying \the [src] on yourself...</span>"` (:40); visible `"<span class='notice'>[user] starts to apply \the [src] on [user.p_them()]self...</span>"` (:40) | returns if the wait is interrupted (:41-42) |
| try_heal, other, `other_delay` non-zero | | `do_mob(user, M, other_delay)` (:46) | self: `"<span class='notice'>You begin applying \the [src] on [M]...</span>"` (:45); visible `"<span class='notice'>[user] starts to apply \the [src] on [M].</span>"` (:45) | returns if the wait is interrupted (:46-47) |
| try_heal, after the wait | `heal(M, user)` TRUE (:49) | | | `user?.mind.adjust_experience(/datum/skill/healing, experience_given)` (:50); `log_combat(user, M, "healed", src.name)` (:51); `use(1)` (:52); if `repeating && amount > 0`, `try_heal(M, user, TRUE)` again (:53-54) |
| heal (:56-57) | | | | | base returns nothing; each child overrides |
| heal_carbon(C, user, brute, burn) (:59-78) | | | | | see below |

heal_carbon (medical.dm:59-78):
- `affecting = C.get_bodypart(check_zone(user.zone_selected))` (:60). Missing: `"<span class='warning'>[C] doesn't have \a [parse_zone(user.zone_selected)]!</span>"` (:62), returns.
- Robotic limb (`affecting.status != BODYPART_ORGANIC`, :64): `"<span class='warning'>\The [src] won't work on a robotic limb!</span>"` (:65), returns.
- If `affecting.brute_dam && brute || affecting.burn_dam && burn` (:67): visible `"<span class='green'>[user] applies \the [src] on [C]'s [affecting.name].</span>"` (:68), `brute2heal = brute * (2 - skill_mod)` and `burn2heal = burn * (2 - skill_mod)` when `skill_mod` is non-zero (:69-74; the skill modifier's direction is not read), `affecting.heal_damage(brute2heal, burn2heal)` (:75), `C.update_damage_overlays()` if it healed (:76), returns TRUE (:77).
- Otherwise: `"<span class='warning'>[C]'s [affecting.name] can not be healed with \the [src]!</span>"` (:78).

Gotchas:
- The stack is consumed one unit per successful heal only (`use(1)`, medical.dm:52). A failed heal costs nothing.
- Every heal here goes through `check_zone(user.zone_selected)`: the body part is the one the user has selected.

## Entry: bruise pack  `/obj/item/stack/medical/bruise_pack`   (medical.dm:81)
- In-game name: "bruise pack" (medical.dm:82), singular_name "bruise pack" (:83). Desc (:84): `"A therapeutic gel pack and bandages designed to treat blunt-force trauma."`
- icon_state = "brutepack" (:85), lefthand_file / righthand_file = medical files (:86-87)
- heal_brute = 40 (:88), self_delay = 40 (:89), other_delay = 20 (:90)
- grind_results = list(/datum/reagent/medicine/c2/libital = 10) (:91)
- amount 6 and max_amount 6, w_class TINY, max_integrity 40: inherited (medical.dm:5-12)

heal (medical.dm:93-110):

| target | condition | delay (ds) | message(s), verbatim | result |
|---|---|---|---|---|
| dead (`M.stat == DEAD`) | (:94) | none | `"<span class='warning'>[M] is dead! You can not help [M.p_them()].</span>"` (:95) | returns (nothing) |
| simple animal not healable | `!(critter.healable)` (:99) | none | `"<span class='warning'>You cannot use \the [src] on [M]!</span>"` (:100) | returns FALSE |
| simple animal at full health | `critter.health == critter.maxHealth` (:102) | none | `"<span class='notice'>[M] is at full health.</span>"` (:103) | returns FALSE |
| simple animal, heals | | none | visible `"<span class='green'>[user] applies \the [src] on [M].</span>"` (:105) | `M.heal_bodypart_damage((heal_brute/2))` = 20 (:106); returns TRUE |
| carbon | `iscarbon(M)` (:108) | none | from heal_carbon | `heal_carbon(M, user, 40, heal_burn)`, heal_burn null (:109) |
| other | | none | `"<span class='warning'>You can't heal [M] with \the [src]!</span>"` (:110) | nothing |

Suicide: `suicide_act` (:112-114): visible `"<span class='suicide'>[user] is bludgeoning [user.p_them()]self with [src]! It looks like [user.p_theyre()] trying to commit suicide!</span>"` (:113); returns BRUTELOSS (:114).

Drops, deconstruction, health and power: none on the type. max_integrity 40 (medical.dm:12). Not powered.

Gotchas:
- On a carbon the pack heals 40 brute, scaled by the user's skill (heal_carbon, :71-74), with self 40 ds and other 20 ds waits (:89-90).
- On a simple animal it heals only half (`heal_brute/2`, :106).

## Entry: medical gauze  `/obj/item/stack/medical/gauze`   (medical.dm:116)
- In-game name: "medical gauze" (medical.dm:117), singular_name "medical gauze" (:120). Desc (:118): `"A roll of elastic cloth, perfect for stabilizing all kinds of wounds, from cuts and burns, to broken bones. "` (note the trailing space in the source)
- gender = PLURAL (:119), icon_state = "gauze" (:121)
- self_delay = 50 (:122), other_delay = 20 (:123)
- max_amount = 12 (:124), amount = 6 (:125)
- grind_results = list(/datum/reagent/cellulose = 2) (:126)
- custom_price = 100 (:127)
- absorption_rate = 0.25 (:128), absorption_capacity = 5 (:129), splint_factor = 0.35 (:130). Source comment (:132): "gauze is only relevant for wounds, which are handled in the wounds themselves". The wound system (not read here) uses these three values.

try_heal override (medical.dm:133-139): does not heal and does not use the delays.
- `limb = M.get_bodypart(check_zone(user.zone_selected))` (:134).
- If the limb has `brute_dam > 40` (:136): `"<span class='warning'>The bleeding on [user==M ? "your" : "[M]'s"] [limb.name] is from bruising, and cannot be treated with [src]!</span>"` (:137).
- Otherwise: `"<span class='warning'>There's no bleeding on [user==M ? "your" : "[M]'s"] [limb.name]</span>"` (:139).
- No `do_mob`, no `use(1)`: the gauze is not consumed by applying it.

attackby (medical.dm:144-155):
- A wirecutter (`I.tool_behaviour == TOOL_WIRECUTTER`) or any sharp item (`I.get_sharpness()`) cuts the gauze into cloth. Fewer than 2 units: `"<span class='warning'>You need at least two gauzes to do this!</span>"` (:147), returns.
- Otherwise: `new /obj/item/stack/sheet/cloth(user.drop_location())` (:149), visible `"<span class='notice'>[user] cuts [src] into pieces of cloth with [I].</span>"` (:150), self `"<span class='notice'>You cut [src] into pieces of cloth with [I].</span>"` (:151), hear `"<span class='hear'>You hear cutting.</span>"` (:152), `use(2)` (:153). No delay.
- Anything else goes to `..()` (:155).

suicide_act (medical.dm:157-159): visible `"<span class='suicide'>[user] begins tightening \the [src] around [user.p_their()] neck! It looks like [user.p_they()] forgot how to use medical supplies!</span>"` (:158); returns OXYLOSS (:159).

Sub-types not on the list: `gauze/twelve` (amount 12, :141-142), `gauze/improvised` (:161-168), `gauze/cyborg` (:170-173). Not documented here.

Gotchas:
- Applying gauze to a limb does nothing except print a message (see try_heal override). Its value is in the wound system's absorption and splint numbers above.
- In the code of this type, gauze is spent only by cutting it into cloth (2 units per sheet, medical.dm:153). Applying it costs nothing.

## Entry: ointment  `/obj/item/stack/medical/ointment`   (medical.dm:226)
- In-game name: "ointment" (medical.dm:227), singular_name "ointment" (:230). Desc (:228): `"Basic burn ointment, rated effective for second degree burns with proper bandaging, though it's still an effective stabilizer for worse burns. Not terribly good at outright healing burns though."`
- gender = PLURAL (:229), icon_state = "ointment" (:231), lefthand_file / righthand_file = medical files (:232-233)
- amount = 10 (:234), max_amount = 10 (:235)
- self_delay = 40 (:236), other_delay = 20 (:237)
- heal_burn = 5 (:239), flesh_regeneration = 2.5 (:240), sanitization = 0.3 (:241)
- grind_results = list(/datum/reagent/medicine/c2/lenturi = 10) (:242)
- heal_brute: null (inherited, not set)

heal (medical.dm:244-250):
- dead (`M.stat == DEAD`): `"<span class='warning'>[M] is dead! You can not help [M.p_them()].</span>"` (:246), returns.
- carbon: `heal_carbon(M, user, heal_brute, heal_burn)` = `heal_carbon(M, user, null, 5)` (:248-249). Only the burn value is applied (see heal_carbon; `brute` null is falsy at :67).
- other: `"<span class='warning'>You can't heal [M] with \the [src]!</span>"` (:250). Simple animals are refused.

suicide_act (medical.dm:252-254): visible `"<span class='suicide'>[user] is squeezing \the [src] into [user.p_their()] mouth! [user.p_do(TRUE)]n't [user.p_they()] know that stuff is toxic?</span>"` (:253); returns TOXLOSS (:254).

Drops, deconstruction, health and power: none on the type. max_integrity 40 (inherited). Not powered.

Gotchas:
- Ointment heals burns only, and only on carbons. Its wait is 40 ds for self and 20 ds for others (:236-237).

## Coverage for part 9 (not the final Coverage)
- Paths documented in this part: `/obj/item/stack/medical/bruise_pack`, `/obj/item/stack/medical/gauze`, `/obj/item/stack/medical/ointment`

# gap-items-04, part 10: plumbing ducts, license plates, package wrapper

Source tree: `_src/tg2020`. The stack base (stack.dm) is written in part 9 and applies here: `max_integrity` 100 (stack.dm:17), `update_weight` (stack.dm:88-94), `update_icon_state` (stack.dm:97-105), `use` (stack.dm:325-342), `attackby` merge (stack.dm:448-454), `attack_self` opens the recipe window (stack.dm:138-139).

## Entry: stack of duct (fifty)  `/obj/item/stack/ducts/fifty`   (ducts.dm:430)

Parent `/obj/item/stack/ducts` (ducts.dm:383):
- name = "stack of duct" (:384), desc = `"A stack of fluid ducts."` (:385), singular_name = "duct" (:386)
- icon = 'icons/obj/plumbing/fluid_ducts.dmi' (:387), icon_state = "ducts" (:388)
- custom_materials = list(/datum/material/iron = 500) (:389): 500 iron per unit. Initialize multiplies the list by the amount (stack.dm:61-66), so the 50-unit stack starts at 25000 iron.
- w_class = WEIGHT_CLASS_TINY (:390). Overridden at init by `update_weight` (stack.dm:88-94): at 50 of 50 units the stack is `full_w_class` = WEIGHT_CLASS_NORMAL (inferred from stack.dm:90-94).
- novariants = FALSE (:391): the icon follows the amount (stack.dm:97-105)
- max_amount = 50 (:392), item_flags = NOBLUDGEON (:393), merge_type = /obj/item/stack/ducts (:394): all duct stacks merge with each other by type (stack.dm:68-71, :448-452).
- duct_color = "grey" (:396), duct_layer = "Default Layer" (:398), layers = list("First Layer" = FIRST_DUCT_LAYER, "Second Layer" = SECOND_DUCT_LAYER, "Default Layer" = DUCT_LAYER_DEFAULT, "Fourth Layer" = FOURTH_DUCT_LAYER, "Fifth Layer" = FIFTH_DUCT_LAYER) (:400-401)
- force, throwforce: inherited 0; attack_verb null.

Procs:

| proc | file:line | condition | delay (ds) | message(s), verbatim | result |
|---|---|---|---|---|---|
| examine (:403-405) | | | none | `"<span class='notice'>It's current color and layer are [duct_color] and [duct_layer]. Use in-hand to change.</span>"` (:405) | |
| attack_self (:407-414) | | | none (input dialogs) | none | `input` to choose a layer from `layers` (:408), then a colour from `GLOB.pipe_paint_colors` (:411). A chosen colour is applied with `add_atom_colour` (:414). |
| afterattack (:416-428) | `proximity` (:418) | none | none | none | see next rows |
| afterattack on an unanchored `/obj/machinery/duct` | `!D.anchored` (:422) | none | none | none | `add(1)` (:423) and `qdel(D)` (:424): picks the duct back up into the stack |
| afterattack on an open turf (`/turf/open`) | `use(1)` (:425) | none | none | `playsound(get_turf(src), 'sound/machines/click.ogg', 50, TRUE)` (:428) | `new /obj/machinery/duct(OT, FALSE, GLOB.pipe_paint_colors[duct_color], layers[duct_layer])` (:427): places one duct with the stack's colour and layer |

Entry values:
- In-game name: "stack of duct" (ducts.dm:384). Desc: inherited (:385).
- amount = 50 (ducts.dm:431), the only change from the parent.
- Placed on BoxStation: x4 (from the list file).

Gotchas:
- Its colour and layer are instance variables that the merge does not compare (merge is by `merge_type`, stack.dm:68-71, inferred for colour).
- Using it on an open turf costs one unit per duct (ducts.dm:425).

## Entry: empty license plate (fifty)  `/obj/item/stack/license_plates/empty/fifty`   (license_plates.dm:13)

Parent `/obj/item/stack/license_plates` (license_plates.dm:1):
- name = "invalid plate" (:2), desc = `"someone fucked up"` (:3)
- icon = 'icons/obj/machines/prison.dmi' (:4), icon_state = "empty_plate" (:5)
- novariants = FALSE (:6): the icon follows the amount (stack.dm:97-105). At 50 of 50 this sets icon_state to `"empty_plate_3"` (inferred; the sprite name is not checked against prison.dmi).
- max_amount = 50 (:7)
- Filled plates (`/obj/item/stack/license_plates/filled`, license_plates.dm:16-30) are a sibling and are not on the list.

Child `/obj/item/stack/license_plates/empty` (license_plates.dm:9):
- name = "empty license plate" (:10)
- desc = `"Instead of a license plate number, this could contain a quote like \"Live laugh love\"."` (:11)

Entry `/obj/item/stack/license_plates/empty/fifty` (:13-14):
- amount = 50 (:14). Everything else inherited.
- In-game name: "empty license plate" (inherited, :10).
- Placed on BoxStation: x6 (from the list file).
- Procs: none on the type. Stack defaults apply: `full_w_class` NORMAL, so the plates are NORMAL at 50 (stack.dm:90-94); `attack_self` opens the recipe window with no recipes (stack.dm:138-139); `attackby` merges with other plates of the same `merge_type` (stack.dm:448-452).
- Interactions: none defined on the type. No delays, no messages.
- Drops, deconstruction, health and power: none. max_integrity 100 (stack.dm:17). Not powered.

## Entry: package wrapper  `/obj/item/stack/package_wrap`   (wrap.dm:31)

Parent: this is the base type. Stack defaults apply (part 9). Its own values:
- name = "package wrapper" (wrap.dm:32), singular_name = "wrapping sheet" (:33), desc = `"You can use this to wrap items in."` (:34)
- icon = 'icons/obj/stack_objects.dmi' (:35), icon_state = "deliveryPaper" (:36)
- item_flags = NOBLUDGEON (:37), amount = 25 (:38), max_amount = 25 (:39), resistance_flags = FLAMMABLE (:40)
- grind_results = list(/datum/reagent/cellulose = 5) (:41)
- novariants: inherited TRUE (stack.dm:27): the icon does not change with amount.
- full_w_class: inherited NORMAL (stack.dm:26): at 25 units the wrapper is NORMAL; at 8 or fewer units it is TINY (stack.dm:88-94)
- Child `/obj/item/stack/package_wrap/small` (wrap.dm:127-130): desc, w_class SMALL, amount 5. Not on the list.

Interactions:

| held item / action | condition | delay (ds) | message(s), verbatim | result |
|---|---|---|---|---|
| suicide_act (wrap.dm:43-53) | `use(3)` succeeds | none | visible `"<span class='suicide'>[user] begins wrapping [user.p_them()]self in \the [src]! It looks like [user.p_theyre()] trying to commit suicide!</span>"` (:44) | a `/obj/structure/big_delivery` on the user's turf, icon "deliverypackage5" (:46-47), `user.forceMove(P)` (:48), returns OXYLOSS (:50) |
| suicide_act, not enough | `use(3)` fails | none | `"<span class='warning'>You need more paper!</span>"` (:52) | returns SHAME (:53) |
| afterattack on an item (`isitem(target)`) | `proximity`, target is not anchored (:69-74), `I.can_be_package_wrapped()` (:78) | none | none | see next row |
| item, held by the user | `user.is_holding(I)` (:80) | none | none | `user.dropItemToGround(I)` must succeed (:81-82) |
| item, on a turf | `isturf(I.loc)` (:83) | none | none | returns if not on a turf (:84) |
| item, wrapping | `use(1)` (:85) | none | none | a `/obj/item/small_delivery` on the item's turf (:86); if the user is adjacent it is put in their hands (:87-90); item moved inside (:91); parcel name `"[weightclass2text(size)] parcel"` (:93), `P.w_class = size` where `size = round(I.w_class)` (:92, :94), icon "deliverypackage[min(size, 5)]" (:95-96) |
| afterattack on a closet (`/obj/structure/closet`) | `O.opened` (:100) is FALSE | none | `"<span class='warning'>You can't wrap this!</span>"` (:103) when `!O.delivery_icon`; `"<span class='warning'>You need more paper!</span>"` (:112) | `use(3)` (:105); `/obj/structure/big_delivery` on the closet's turf with `O.delivery_icon` (:106-107); `O.forceMove(P)` (:108) |
| afterattack, any other target | | none | `"<span class='warning'>The object you are trying to wrap is unsuitable for the sorting machinery!</span>"` (:115) | returns (:116) |
| after a successful wrap | | none | `"<span class='notice'>[user] wraps [target].</span>"` (:118) | `user.log_message(...)` (:119) |
| use() that empties the stack | `QDELETED(src) && !transfer` (:124) | none | none | `new /obj/item/c_tube(T)`, a cardboard tube on the turf (:125) |

`can_be_package_wrapped` (wrap.dm:55-65): the base item returns 1 (:55-56); `/obj/item/storage` returns 0 (:58-59); `/obj/item/storage/box` returns 1 (:61-62); `/obj/item/small_delivery` returns 0 (:64-65).

Entry values:
- Placed on BoxStation: x14 (from the list file).

Gotchas:
- Wrapping an item costs one unit (wrap.dm:85), a closet costs three (wrap.dm:105).
- The parcel's size class is the item's `w_class`, which is then rounded and capped only in the icon (wrap.dm:92-96).
- Using the last unit leaves a cardboard tube (wrap.dm:124-125).

## Coverage

- Entries on the list: 28
- Entries documented with real data: 28 (`/obj/item/reagent_containers/glass/bottle/multiver`, `/obj/item/reagent_containers/glass/bottle/nutrient/ez`, `/obj/item/reagent_containers/glass/bottle/nutrient/rh`, `/obj/item/reagent_containers/glass/bottle/toxin`, `/obj/item/reagent_containers/glass/bowl`, `/obj/item/reagent_containers/glass/bucket`, `/obj/item/reagent_containers/hypospray/cmo`, `/obj/item/reagent_containers/hypospray/medipen`, `/obj/item/reagent_containers/hypospray/medipen/survival`, `/obj/item/reagent_containers/pill/patch/aiuri`, `/obj/item/reagent_containers/spray/cleaner`, `/obj/item/reagent_containers/spray/pepper`, `/obj/item/reagent_containers/spray/waterflower`, `/obj/item/reagent_containers/syringe/antiviral`, `/obj/item/reagent_containers/syringe/lethal/execution`, `/obj/item/restraints/legcuffs/beartrap`, `/obj/item/retractor`, `/obj/item/scalpel`, `/obj/item/shield/riot/tele`, `/obj/item/soap/deluxe`, `/obj/item/soap/nanotrasen`, `/obj/item/soapstone`, `/obj/item/stack/ducts/fifty`, `/obj/item/stack/license_plates/empty/fifty`, `/obj/item/stack/medical/bruise_pack`, `/obj/item/stack/medical/gauze`, `/obj/item/stack/medical/ointment`, `/obj/item/stack/package_wrap`)
- Entries marked NOT FOUND: 0
- Paths not located by tgwhere: none (tgwhere.py located all 28 paths)

