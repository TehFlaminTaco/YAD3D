# gap-items-02, part 1: shared parents, laser tag helmets, space helmet

Source: `_src/tg2020` (tgstation 2d6c10c1). Every citation is relative to that tree root. Numbers are raw (deciseconds where a delay; `SECONDS` is the BYOND macro `*10`, `code/__DEFINES/time.dm:41`, so `1 SECONDS` = 10 ds). Defines are resolved to their literal value with the define's own file:line.

## Shared parents (documented once, inherited by every entry in this shard)

### `/obj/item` (`code/game/objects/items.dm:10`), `/obj` (`code/game/objects/objs.dm:2`), `/obj/item/clothing` (`code/modules/clothing/clothing.dm:1`)

| var | value on the base | file:line |
|---|---|---|
| `force` | 0 | objs.dm:9 |
| `damtype` | BRUTE (`"brute"`) | objs.dm:8, `code/__DEFINES/combat.dm:6` |
| `throwforce` | 0 | `code/game/atoms_movable.dm:40` |
| `throw_range` | 7 | `code/game/atoms_movable.dm:11` |
| `throw_speed` | 2 | `code/game/atoms_movable.dm:10` |
| `attack_verb` | unset (null) | items.dm:131 |
| `hitsound` | unset; `/obj/item/Initialize` sets `"swing_hit"` when damtype is brute | items.dm:203-207 |
| `w_class` | WEIGHT_CLASS_NORMAL = 3 | items.dm:77, `code/__DEFINES/inventory.dm:9` |
| `slot_flags` | 0 (each family sets its own) | items.dm:79 |
| `armor` | `getArmor()` with no args: melee, bullet, laser, energy, bomb, bio, rad, fire, acid all 0 | objs.dm:60-63, `code/datums/armor.dm:3` |
| `max_integrity` | 200 on items; clothing sets 200 again | items.dm:57, clothing.dm:4 |
| `integrity_failure` | 0.4 on clothing | clothing.dm:5 (objs.dm:19 comment: 0.5 means 50%) |
| `resistance_flags` | FLAMMABLE on clothing | clothing.dm:3 |
| `permeability_coefficient` | 1 | items.dm:112 |
| `siemens_coefficient` | 1 | items.dm:114 |
| `gas_transfer_coefficient` | 1 | items.dm:110 |
| `slowdown` | 0 | items.dm:116 |
| `strip_delay` | 40 | items.dm:126 |
| `equip_delay_other` | 20 | items.dm:124 |
| `heat_protection`, `cold_protection` | 0, 0 | items.dm:85, items.dm:87 |
| `max_heat_protection_temperature`, `min_cold_protection_temperature` | null, null (no protection) | items.dm:89, items.dm:91 |
| `body_parts_covered` | 0 | items.dm:108 |
| `flags_inv`, `flags_cover` | unset (0) | items.dm:100, items.dm:145 |
| `flash_protect`, `tint` | FLASH_PROTECTION_NONE (0), 0 | clothing.dm:9-10, `code/__DEFINES/mobs.dm:306` |
| `clothing_flags` | NONE | clothing.dm:26 |
| `dynamic_hair_suffix` | `""` | clothing.dm:41 |
| `repairable_by` | `/obj/item/stack/sheet/cloth` | clothing.dm:29 |

Protection values are only applied when the temperature check passes: `wear_suit.min_cold_protection_temperature && wear_suit.min_cold_protection_temperature <= temperature` (`code/modules/mob/living/carbon/human/life.dm:233-235`). A null min temperature therefore gives no cold protection at all. The same pattern is used for head, uniform, shoes, gloves and mask (life.dm:230-247). Heat protection flags likewise apply only to the areas in `heat_protection` (items.dm:88 comment).

Clothing-wide behaviour (every clothing item):

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| cloth stack, `attackby` | item is damaged or shredded and the stack is `repairable_by` (clothing.dm:95-96) | 1 cloth used if damaged (clothing.dm:100); if shredded, needs 3 and `do_after(user, 6 SECONDS, ...)` = 60 ds (clothing.dm:102-109) | `"You require 3 [S.name] to repair [src]."` (clothing.dm:104); `"You begin fixing the damage to [src] with [S]..."` (clothing.dm:106); `"You fix the damage on [src]."` (clothing.dm:123) | `repair()`: integrity back to max, name reset to `initial(name)`, `body_parts_covered` reset (clothing.dm:114-124) |
| shredding (`obj_destruction`, non-bomb, non-acid/fire) | any | none | `"[M]'s [src.name] fall[p_s()] off, [p_theyre()] completely shredded!"`; `"[src] fall[p_s()] apart, completely shredded!"` (clothing.dm:434-451) | `body_parts_covered = NONE`, `slot_flags = NONE`, name prefixed `"shredded "` |
| examine | max_heat_protection_temperature 400-1000 | none | `"[src] offers the wearer limited protection from fire."` (clothing.dm:228-230); 1001-1600 `"...some protection from fire."` (clothing.dm:231-232); 1601-35000 `"...robust protection from fire."` (clothing.dm:233-234) | text only |
| examine (armour tag) | any armour above 0 | none | `"It has a <a href=...>tag</a> listing its protection classes."` (clothing.dm:291-292) | Topic prints roman-numeral classes, `armor_to_protection_class` (clothing.dm:321-344) |

### `/obj/item/clothing/head` (`code/modules/clothing/head/_head.dm:1`)

| var | value | file:line |
|---|---|---|
| `name` | BODY_ZONE_HEAD = `"head"` | _head.dm:2, `code/__DEFINES/combat.dm:220` |
| `icon` | `'icons/obj/clothing/hats.dmi'` | _head.dm:3 |
| `icon_state` | `"top_hat"` | _head.dm:4 |
| `inhand_icon_state` | `"that"` | _head.dm:5 |
| `body_parts_covered` | HEAD | _head.dm:6 |
| `slot_flags` | ITEM_SLOT_HEAD = `(1<<6)` | _head.dm:7, `code/__DEFINES/inventory.dm:29` |
| `can_toggle` | null (no visor toggle) | _head.dm:9 |
| `dynamic_hair_suffix` | `"+generic"` | _head.dm:10 |

Thrown hats (`throw_impact`, _head.dm:18-59): a hat thrown at a target zone of head (`thrownthing.target_zone != BODY_ZONE_HEAD` returns, _head.dm:22-23) goes on the carbon's head, unless it holds contents (_head.dm:28-29), has ANTI_TINFOIL_MANEUVER (_head.dm:25-26), or the wearer's head item has TRAIT_NODROP (_head.dm:35-37) or SNUG_FIT (_head.dm:42-44). Messages: `"<span class='warning'>[src] bounces off [H]'s [WH.name]!</span>"` (_head.dm:36), `"<span class='warning'>[src] knocks [WH] off [H]'s head!</span>"` (_head.dm:47), `"<span class='notice'>[src] lands neatly on [H]'s head!</span>"` (_head.dm:49). Dynamic hair: `Initialize` calls `H.update_hair()` when worn by a human and `dynamic_hair_suffix` is set (_head.dm:12-16).

### `/obj/item/clothing/head/helmet` (`code/modules/clothing/head/helmet.dm:1`)

| var | value | file:line |
|---|---|---|
| `name` / `desc` | `"helmet"` / `"Standard Security gear. Protects the head from impacts."` | helmet.dm:2-3 |
| `icon_state`, `inhand_icon_state` | `"helmet"`, `"helmet"` | helmet.dm:4-5 |
| `armor` | melee 35, bullet 30, laser 30, energy 40, bomb 25, bio 0, rad 0, fire 50, acid 50 | helmet.dm:6 |
| `cold_protection` / `min_cold_protection_temperature` | HEAD / HELMET_MIN_TEMP_PROTECT = 160 K | helmet.dm:7-8, `code/__DEFINES/atmospherics.dm:178` |
| `heat_protection` / `max_heat_protection_temperature` | HEAD / HELMET_MAX_TEMP_PROTECT = 600 K | helmet.dm:9-10, `code/__DEFINES/atmospherics.dm:180` |
| `strip_delay` | 60 | helmet.dm:11 |
| `clothing_flags` | SNUG_FIT | helmet.dm:12 |
| `flags_cover` | HEADCOVERSEYES | helmet.dm:13 |
| `flags_inv` | HIDEHAIR | helmet.dm:14 |
| `can_flashlight` | FALSE (a seclite cannot be mounted) | helmet.dm:18 |
| `dog_fashion` | `/datum/dog_fashion/head/helmet` | helmet.dm:16 |

Interactions on the base helmet (inherited unless a child overrides):

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| attack_self | needs `can_toggle` truthy and not incapacitated (helmet.dm:106-107) | none | `"[up ? alt_toggle_message : toggle_message] \the [src]."` (helmet.dm:115) | visor flip; children with can_toggle null do nothing |
| `/obj/item/flashlight/seclite` in `attackby` | `can_flashlight && !attached_light` (helmet.dm:361-364) | none | `"You click [S] into place on [src]."` (helmet.dm:367) only when attached | otherwise `return` with no message (helmet.dm:376) |
| screwdriver `screwdriver_act` | `can_flashlight && attached_light` (helmet.dm:381) | none | `"You unscrew [attached_light] from [src]."` (helmet.dm:383) | light removed |

Destroy only `QDEL_NULL(attached_light)` (helmet.dm:36-38). No `new` on destruction, so nothing drops from the base helmet.

### `/obj/item/clothing/head/helmet/space` (`code/modules/clothing/spacesuits/_spacesuits.dm:5`)

Own values (from `_spacesuits.dm:5-25`): `name` `"space helmet"` (6); `icon_state` `"spaceold"` (7); `desc` `"A special helmet with solar UV shielding to protect your eyes from harmful rays."` (8); `clothing_flags` STOPSPRESSUREDAMAGE | THICKMATERIAL | SNUG_FIT (9); `inhand_icon_state` `"spaceold"` (10); `permeability_coefficient` 0.01 (11); `armor` melee 0, bullet 0, laser 0, energy 0, bomb 0, bio 100, rad 50, fire 80, acid 70 (12); `flags_inv` HIDEMASK|HIDEEARS|HIDEEYES|HIDEFACE|HIDEHAIR|HIDEFACIALHAIR (13); `dynamic_hair_suffix` `""` (14); `dynamic_fhair_suffix` `""` (15); `cold_protection` HEAD (16); `min_cold_protection_temperature` SPACE_HELM_MIN_TEMP_PROTECT = 2.0 (17, `atmospherics.dm:156`); `heat_protection` HEAD (18); `max_heat_protection_temperature` SPACE_HELM_MAX_TEMP_PROTECT = 1500 (19, `atmospherics.dm:158`); `flash_protect` FLASH_PROTECTION_WELDER = 2 (20, `code/__DEFINES/mobs.dm:308`); `strip_delay` 50 (21); `equip_delay_other` 50 (22); `flags_cover` HEADCOVERSEYES | HEADCOVERSMOUTH | PEPPERPROOF (23); `resistance_flags` NONE (24); `dog_fashion` null (25).

Inherits from the helmet base: `can_flashlight` FALSE, `can_toggle` null, `dynamic_hair_suffix` overridden to `""` here.

---

## Head: laser tag helmets

Both helmets are direct children of `/obj/item/clothing/head/helmet`. They share every value except name, desc, sprite and armour. The armour block is identical in both (helmet.dm:238 and helmet.dm:248).

| DM path (file:line) | name (verbatim) | desc (verbatim) | icon_state / inhand | own overrides | armour (melee, bullet, laser, energy, bomb, bio, rad, fire, acid) |
|---|---|---|---|---|---|
| `/obj/item/clothing/head/helmet/redtaghelm` (helmet.dm:232) | `"red laser tag helmet"` (helmet.dm:233) | `"They have chosen their own end."` (helmet.dm:234) | `"redtaghelm"` (helmet.dm:235) / `"redtaghelm"` (helmet.dm:237) | `flags_cover = HEADCOVERSEYES` (236, same as base); `dog_fashion = null` (240) | 15, 10, 20, 10, 20, 0, 0, 0, 50 (helmet.dm:238) |
| `/obj/item/clothing/head/helmet/bluetaghelm` (helmet.dm:242) | `"blue laser tag helmet"` (helmet.dm:243) | `"They'll need more men."` (helmet.dm:244) | `"bluetaghelm"` (helmet.dm:245) / `"bluetaghelm"` (helmet.dm:247) | `flags_cover = HEADCOVERSEYES` (246, same as base); `dog_fashion = null` (250) | 15, 10, 20, 10, 20, 0, 0, 0, 50 (helmet.dm:248) |

Comment in both (helmet.dm:239, 249): `// Offer about the same protection as a hardhat.`

Everything else is inherited from `/obj/item/clothing/head/helmet` (helmet.dm:1-14) and `/obj/item/clothing/head/` (_head.dm:1-10):

* `cold_protection` HEAD, `min_cold_protection_temperature` 160 (helmet.dm:7-8)
* `heat_protection` HEAD, `max_heat_protection_temperature` 600 (helmet.dm:9-10)
* `strip_delay` 60 (helmet.dm:11)
* `clothing_flags` SNUG_FIT (helmet.dm:12), so a thrown hat cannot knock it off (_head.dm:42-44)
* `flags_inv` HIDEHAIR (helmet.dm:14); the dynamic hair suffix `"+generic"` from the head class (_head.dm:10) is also live, and clothing.dm:40 says these suffixes override the HIDEHAIR flags (inferred effect: hair may still show)
* `can_flashlight` FALSE (helmet.dm:18): a seclite is silently refused (helmet.dm:361-376)
* `can_toggle` null (_head.dm:9): attack_self does nothing (helmet.dm:106-107)
* `body_parts_covered` HEAD (_head.dm:6), `slot_flags` ITEM_SLOT_HEAD (_head.dm:7)
* `w_class` 3, `max_integrity` 200, `permeability_coefficient` 1, `siemens_coefficient` 1 (items.dm:77, 57, 112, 114)
* `flash_protect` 0, `tint` 0 (clothing.dm:9-10)
* `resistance_flags` FLAMMABLE (clothing.dm:3)

Interactions (both): none of their own. Attack_self, seclite and screwdriver paths in the helmet base table above are no-ops here. No `attack`, `afterattack` or `attackby` override exists in these two type blocks (helmet.dm:232-250).

Construction chain: none. `grep -rn taghelm _src/tg2020/code` (Grep, path `code`) finds only: `code/game/objects/structures/crates_lockers/closets/fitness.dm:51` and `:65` (closet spawns), `code/modules/cargo/packs.dm:2186-2191` (cargo pack, 3 red and 3 blue), `code/modules/clothing/outfits/standard.dm:102` and `:114` (laser tag outfits), and helmet.dm itself. No crafting recipe mentions them.

Deconstruction chain: none (no deconstruct proc on the helmet family).

Drops: none. Destroy only nulls `attached_light` (helmet.dm:36-38). Nothing spawned on destruction. Break behaviour is the clothing parent: `obj_destruction` (clothing.dm:434-453) and `obj_break` message `"Your [name] start[p_s()] to fall apart!"` (clothing.dm:346-354).

Health / armour: `max_integrity` 200 (inherited, items.dm:57 / clothing.dm:4). `integrity_failure` 0.4 (clothing.dm:5). Armour above.

Power: none.

Gotchas:
* The laser tag helmets' `fire` armour is 0 (helmet.dm:238, helmet.dm:248), the base helmet's is 50 (helmet.dm:6). They do not protect against fire.
* A seclite can never be attached (`can_flashlight` FALSE, helmet.dm:18), and the attach branch is skipped silently (helmet.dm:376).
* Both are SNUG_FIT, so thrown hats bounce off them (_head.dm:42-44).
* The "tag" logic (who is on which team, the laser gun) is not in these files. Not searched, out of scope for this item.

---

## Head: space helmet, no own definition (emergency variant)

### space helmet, emergency  `/obj/item/clothing/head/helmet/space/emergency`   (no own definition; nearest defined ancestor code/modules/clothing/spacesuits/_spacesuits.dm:5)

* What it is: a list entry with the in-game name "space helmet" and no count on BoxStation. The type is not defined anywhere in the tree. Grep for `space/emergency` over `_src/tg2020` (Grep, whole tree) returns no match, and tgwhere prints `NO OWN DEFINITION`. So it behaves as the ancestor `/obj/item/clothing/head/helmet/space` (inherits, does not override).
* Key vars: all values listed in the `/obj/item/clothing/head/helmet/space` block above (`_spacesuits.dm:5-25`). Name, desc and icon are inherited, so the game shows `"space helmet"` (_spacesuits.dm:6).
* Interactions: none of its own. Inherited from the helmet base: `attack_self` (no-op, can_toggle null), seclite refused (`can_flashlight` FALSE is inherited; the space helmet does not set it, so it inherits helmet.dm:18 = FALSE), screwdriver (needs an attached light).
* Construction chain: none found. `grep` for `space/emergency` over `_src/tg2020` has no match, so no recipe or spawn names this type.
* Deconstruction chain: none defined (inherits nothing relevant).
* Drops: none (helmet Destroy only, helmet.dm:36-38).
* Health / armour: max_integrity 200 (inherited), armour bio 100 / rad 50 / fire 80 / acid 70, all others 0 (_spacesuits.dm:12).
* Power: none.
* Gotchas: because the name is "space helmet", the in-game name in our list matches the ancestor's name, not a separate emergency type. It may be a map-only variant or a leftover from a removed type (inferred).

---

# gap-items-02, part 2: head, soft caps and the misc hats

Parents (`/obj/item`, `/obj`, `/obj/item/clothing`, `/obj/item/clothing/head`) and the thrown-hat behaviour are in part 1 and apply here: `armor` all 0 (objs.dm:60-63), `strip_delay` 40 (items.dm:126), `equip_delay_other` 20 (items.dm:124), `body_parts_covered` HEAD (_head.dm:6), `slot_flags` ITEM_SLOT_HEAD (_head.dm:7), `dynamic_hair_suffix` `"+generic"` (_head.dm:10), `flags_inv` and `flags_cover` unset (0), `cold_protection` and `heat_protection` 0 (items.dm:85, 87), `clothing_flags` NONE (clothing.dm:26), `resistance_flags` FLAMMABLE (clothing.dm:3), `max_integrity` 200 (clothing.dm:4). `dog_fashion` is null on `/obj/item` (items.dm:164) unless a type sets it.

Caps have no `SNUG_FIT`, so a thrown hat can knock them off (_head.dm:42-44 applies only to SNUG_FIT wearers).

---

## Soft caps (`/obj/item/clothing/head/soft`, `code/modules/clothing/head/soft_caps.dm:1`)

### Parent: `/obj/item/clothing/head/soft`   (soft_caps.dm:1)

Own values (the base is the "cargo cap"; children override name, desc, icon and soft_type):

| var | value | file:line |
|---|---|---|
| `name` | `"cargo cap"` | soft_caps.dm:2 |
| `desc` | `"It's a baseball hat in a tasteless yellow colour."` | soft_caps.dm:3 |
| `icon_state` | `"cargosoft"` | soft_caps.dm:4 |
| `inhand_icon_state` | `"helmet"` | soft_caps.dm:5 |
| `soft_type` | `"cargo"` | soft_caps.dm:6 |
| `dog_fashion` | `/datum/dog_fashion/head/cargo_tech` | soft_caps.dm:8 |
| `flipped` | 0 | soft_caps.dm:10 |

Flip mechanics (shared by every cap in this part):

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| Alt-click (`AltClick`) | `user.canUseTopic(src, BE_CLOSE, ismonkey(user))` (soft_caps.dm:24-27) | none | none | calls `flip(user)` (soft_caps.dm:29) |
| verb `flipcap` (category Object, name "Flip cap") | none | none | none | calls `flip(usr)` (soft_caps.dm:17-21) |
| `flip(user)` | `!user.incapacitated()` (soft_caps.dm:33) | none | flipped on: `"<span class='notice'>You flip the hat backwards.</span>"` (soft_caps.dm:37); flipped off: `"<span class='notice'>You flip the hat back in normal position.</span>"` (soft_caps.dm:40) | toggles `flipped`; icon `"[soft_type]soft_flipped"` when flipped (soft_caps.dm:36), `"[soft_type]soft"` otherwise (soft_caps.dm:39); `usr.update_inv_head()` (soft_caps.dm:41) |
| dropped (`dropped()`) | none | none | none | `icon_state = "[soft_type]soft"` and `flipped = 0` (soft_caps.dm:12-14) |
| examine | none | none | `"<span class='notice'>Alt-click the cap to flip it [flipped ? "forwards" : "backwards"].</span>"` (soft_caps.dm:45) | text only |

Flip is the only use. No attack, afterattack or attackby override on the soft base. No contents, no reagents, no power, no charges.

Construction and deconstruction chains: none in these files (not searched further).

Drops: none. Destroy is the clothing default (no `new` on break; clothing.dm:434-453 shredding, clothing.dm:346-354 break message).

Health / armour: `max_integrity` 200. `armor` all 0. No cold or heat protection. `body_parts_covered` HEAD only, so the crown is covered but nothing is protected (inferred from zero protection values, items.dm:85-91).

Power: none.

Gotchas: caps have `flags_cover` 0, so they do not cover eyes or mouth. They are not SNUG_FIT, so thrown hats knock them off (_head.dm:42-44 applies only when the wearer's head item has SNUG_FIT). The flipped state is reset on drop (soft_caps.dm:13-14).

### Children (all share the parent's flip behaviour; all set `dog_fashion = null`)

| DM path (file:line of type) | name (verbatim) | desc (verbatim) | icon_state | soft_type | own overrides |
|---|---|---|---|---|---|
| `/obj/item/clothing/head/soft/grey` (soft_caps.dm:75) | `"grey cap"` (soft_caps.dm:76) | `"It's a baseball hat in a tasteful grey colour."` (soft_caps.dm:77) | `"greysoft"` (soft_caps.dm:78) | `"grey"` (soft_caps.dm:79) | `dog_fashion = null` (soft_caps.dm:80) |
| `/obj/item/clothing/head/soft/black` (soft_caps.dm:103) | `"black cap"` (soft_caps.dm:104) | `"It's a baseball hat in a tasteless black colour."` (soft_caps.dm:105) | `"blacksoft"` (soft_caps.dm:106) | `"black"` (soft_caps.dm:107) | `dog_fashion = null` (soft_caps.dm:108) |
| `/obj/item/clothing/head/soft/rainbow` (soft_caps.dm:110) | `"rainbow cap"` (soft_caps.dm:111) | `"It's a baseball hat in a bright rainbow of colors."` (soft_caps.dm:112) | `"rainbowsoft"` (soft_caps.dm:113) | `"rainbow"` (soft_caps.dm:114) | `dog_fashion = null` (soft_caps.dm:115) |
| `/obj/item/clothing/head/soft/paramedic` (soft_caps.dm:126) | `"paramedic cap"` (soft_caps.dm:127) | `"It's a baseball hat with a dark turquoise color and a reflective cross on the top."` (soft_caps.dm:128) | `"paramedicsoft"` (soft_caps.dm:129) | `"paramedic"` (soft_caps.dm:130) | `dog_fashion = null` (soft_caps.dm:131) |

For each child, inherited without change: `inhand_icon_state` `"helmet"` (soft_caps.dm:5), `flipped` 0, `soft_type` is the only other value set, the flip messages and icon scheme above, `armor` all 0, no protection.

Per-child notes:
* grey, black, rainbow and paramedic have no `armor`, `strip_delay`, or `flags_*` of their own, so every value is the parent's (soft_caps.dm:1-22, 75-131).
* The flipped icon name for each is built from `soft_type` (`"greysoft_flipped"`, `"blacksoft_flipped"`, `"rainbowsoft_flipped"`, `"paramedicsoft_flipped"`). Whether those sprite states exist in `icons/obj/clothing/hats.dmi` was not checked.
* Paramedic cap: no protection, so it is cosmetic in the code as read.

---

## Misc head items (`code/modules/clothing/head/misc.dm`)

### `/obj/item/clothing/head/powdered_wig`   (misc.dm:18)

* What it is: a powdered wig (a hat-slot cosmetic).
* Own vars: `name` `"powdered wig"` (misc.dm:19); `desc` `"A powdered wig."` (misc.dm:20); `icon_state` `"pwig"` (misc.dm:21); `inhand_icon_state` `"pwig"` (misc.dm:22).
* Inherited: everything from `/obj/item/clothing/head` (_head.dm:1-10) and clothing/item bases. `dog_fashion` is null (items.dm:164). No `flags_inv`, so hair and ears are not hidden (flags_inv unset = 0, items.dm:100), but the dynamic hair suffix `"+generic"` is live (_head.dm:10; clothing.dm:40).
* Interactions: none of its own. Only the thrown-hat behaviour from `/obj/item/clothing/head/throw_impact` (_head.dm:18-59).
* Construction chain: none in these files.
* Deconstruction chain: none.
* Drops: none beyond clothing break behaviour (clothing.dm:434-453).
* Health / armour: `max_integrity` 200, armour all 0, no protection.
* Power: none.
* Gotchas: no protection of any kind, same as the caps.

### `/obj/item/clothing/head/that`   (misc.dm:24)

* What it is: the top-hat, a head cosmetic with a thrown-damage value.
* Own vars: `name` `"top-hat"` (misc.dm:25); `desc` `"It's an amish looking hat."` (misc.dm:26); `icon_state` `"tophat"` (misc.dm:27); `inhand_icon_state` `"that"` (misc.dm:28, same as the head base, _head.dm:5); `dog_fashion` `/datum/dog_fashion/head` (misc.dm:29); `throwforce` 1 (misc.dm:30; base is 0, `code/game/atoms_movable.dm:40`).
* Inherited: everything from `/obj/item/clothing/head` (_head.dm:1-10). `flags_inv` unset, so hair is not hidden.
* Interactions:

  | held item / action | condition | delay (ds) | message(s) verbatim | result |
  |---|---|---|---|---|
  | thrown at a head target | `throw_impact` (_head.dm:18-59), SNUG_FIT wearers excepted | none | `"[src] lands neatly on [H]'s head!"` / `"[src] lands perfectly onto your head!"` (_head.dm:49) on success | goes on the target's head; a wearer's hat is knocked off (_head.dm:47) unless SNUG_FIT (_head.dm:42-44) |
  | thrown and hits something as a thrown object | none | none | none | `throwforce` 1 applies (misc.dm:30) |

* Construction chain: none in these files.
* Deconstruction chain: none.
* Drops: none.
* Health / armour: `max_integrity` 200, armour all 0, no protection.
* Power: none.
* Gotchas: the only item in this part with a non-zero `throwforce` (1, misc.dm:30). Its `dog_fashion` is `/datum/dog_fashion/head` (misc.dm:29), not null as on the soft caps. Our inventory counts one on BoxStation (`/obj/item/clothing/head/that`, x1).

---

* The caps and the wig are not `/obj/item/clothing/head/helmet` children, so the helmet attackby (seclite) and screwdriver paths (helmet.dm:361-395) do not apply to them.

# gap-items-02, part 3: masks (parent, muzzle, bandanas)

## Mask parent: `/obj/item/clothing/mask` (`code/modules/clothing/masks/_masks.dm:1`)

Inherits the clothing and item defaults from part 1. Own values:

| var | value | file:line |
|---|---|---|
| `name` | `"mask"` | _masks.dm:2 |
| `icon` | `'icons/obj/clothing/masks.dmi'` | _masks.dm:3 |
| `body_parts_covered` | HEAD | _masks.dm:4 |
| `slot_flags` | ITEM_SLOT_MASK | _masks.dm:5 |
| `strip_delay` | 40 | _masks.dm:6 |
| `equip_delay_other` | 40 | _masks.dm:7 |
| `modifies_speech` | FALSE | _masks.dm:8 |
| `mask_adjusted` | 0 | _masks.dm:9 |
| `adjusted_flags` | null | _masks.dm:10 |

Behaviour on the mask base:

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| `attack_self` | `VOICEBOX_TOGGLABLE` in `clothing_flags` (_masks.dm:13) | none | `"<span class='notice'>You turn the voice box in [src] [status ? "on" : "off"].</span>"` (_masks.dm:16) | toggles `VOICEBOX_DISABLED` (_masks.dm:14). Not set on the items in this part, so no effect here |
| equipped in `ITEM_SLOT_MASK` | `modifies_speech` TRUE (_masks.dm:20-21) | none | none | registers `COMSIG_MOB_SAY` to `handle_speech` (_masks.dm:21). Unregistered on drop (_masks.dm:25-27) |
| `adjustmask(user)` (via `attack_self` on children, or `adjustmask` directly) | `user` not incapacitated (_masks.dm:48-49) | none | pushed out of the way: `"<span class='notice'>You push \the [src] out of the way.</span>"` (_masks.dm:62); pushed back: `"<span class='notice'>You push \the [src] back into place.</span>"` (_masks.dm:58) | out of the way: `icon_state += "_up"` (_masks.dm:61), `gas_transfer_coefficient` and `permeability_coefficient` set to null (_masks.dm:63-64), `visor_flags` / `visor_flags_inv` / `visor_flags_cover` removed (_masks.dm:65-67), and `slot_flags = adjusted_flags` when `adjusted_flags` is set (_masks.dm:68-69). Back in place restores initials and `slot_flags = initial(slot_flags)` (_masks.dm:52-59) |

`is_mouth_covered` is the check used by eating and other mouth actions. On a carbon it returns TRUE when `wear_mask.flags_cover & MASKCOVERSMOUTH` (`code/modules/mob/living/carbon/carbon_defense.dm:23-25`).

---

## Muzzle

### `/obj/item/clothing/mask/muzzle`   (`code/modules/clothing/masks/miscellaneous.dm:1`)

* What it is: a mask that stops the wearer talking and covers the mouth. The desc is `"To stop that awful noise."`.
* Key vars:

  | var | value | file:line |
  |---|---|---|
  | `name` | `"muzzle"` | miscellaneous.dm:2 |
  | `desc` | `"To stop that awful noise."` | miscellaneous.dm:3 |
  | `icon_state` | `"muzzle"` | miscellaneous.dm:4 |
  | `inhand_icon_state` | `"blindfold"` | miscellaneous.dm:5 |
  | `flags_cover` | MASKCOVERSMOUTH | miscellaneous.dm:6 |
  | `w_class` | WEIGHT_CLASS_SMALL = 2 | miscellaneous.dm:7, `code/__DEFINES/inventory.dm:7` |
  | `gas_transfer_coefficient` | 0.9 | miscellaneous.dm:8 |
  | `equip_delay_other` | 20 (overrides the mask's 40) | miscellaneous.dm:9 |
  | `strip_delay` | 40 (inherited) | _masks.dm:6 |
  | `slot_flags` | ITEM_SLOT_MASK (inherited) | _masks.dm:5 |
  | `armor` | all 0 (inherited) | objs.dm:60-63 |
  | `max_integrity` | 200 (inherited) | clothing.dm:4 |

* Interactions:

  | held item / action | condition | delay (ds) | message(s) verbatim | result |
  |---|---|---|---|---|
  | worn on the mask slot, the wearer tries to talk | `is_muzzled()` true for a carbon with a muzzle in `wear_mask` (`code/modules/mob/living/carbon/carbon.dm:262-263`) | none | none | `can_speak_vocal` returns 0 (`code/modules/mob/living/living_say.dm:325-326`) |
  | worn, audible emote | `user.is_muzzled()` and `emote_type == EMOTE_AUDIBLE` (`code/datums/emotes.dm:104`) | none | none | the emote is blocked unless `muzzle_ignore` |
  | eat or drink from a food/reagent item while worn | `is_mouth_covered(mask_only = 1)` (`code/datums/components/edible.dm:181-182`; `reagent_containers.dm:58` uses the same test) | none | `"<span class='warning'>You have to remove [who] [covered] first!</span>"` with `covered` = `"mask"` (`edible.dm:182`, `edible.dm:185`) | refused (`edible.dm:186`) |
  | monkey / paw user tries to take off the muzzle it wears (`attack_paw`) | `iscarbon(user)` and `src == C.wear_mask` (miscellaneous.dm:12-14) | none | `"<span class='warning'>You need help taking this off!</span>"` (miscellaneous.dm:15) | returns without removing |
  | `attack_self` | none of its own; the mask base only toggles a voicebox (_masks.dm:12-16) | none | none | no effect |

  No `attack`, `afterattack` or `attackby` override on the muzzle.

* Construction chain: leather sheets, one recipe, `new/datum/stack_recipe("muzzle", /obj/item/clothing/mask/muzzle, 2)` in `GLOBAL_LIST_INIT(leather_recipes ...)` (`code/game/objects/items/stacks/sheets/leather.dm:155`). The third argument is `req_amount` (`code/game/objects/items/stacks/stack.dm:485`), so 2 sheets of leather. `res_amount` defaults to 1. No tools, no delay on the recipe in this line.
* Deconstruction chain: none.
* Drops: none beyond clothing break behaviour (clothing.dm:434-453).
* Health / armour: `max_integrity` 200, armour all 0, no protection (no `heat_protection`, `cold_protection`, `armor` set).
* Power: none.
* Spawn sites in the tree (not counts on BoxStation, our inventory has no count): `code/modules/vending/autodrobe.dm:131` (vend stock 2), `code/_globalvars/lists/maintenance_loot.dm:184` (weight 1), `code/game/objects/items/storage/firstaid.dm:106`, `code/game/objects/items/storage/belt.dm:175`, `code/game/objects/items/storage/backpack.dm:487`, `code/game/objects/structures/crates_lockers/closets/secure/medical.dm:66`.
* Gotchas: the muzzle is a mask with `flags_cover` MASKCOVERSMOUTH, so it also blocks eating and drinking, not only speech. Speech is blocked silently: `can_speak_vocal` returns 0 with no message (living_say.dm:325-326). The 20 ds `equip_delay_other` is shorter than the mask base's 40 (miscellaneous.dm:9 vs _masks.dm:7).

---

## Bandanas

### Parent: `/obj/item/clothing/mask/bandana`   (`code/modules/clothing/masks/miscellaneous.dm:226`)

Own values (base is the "botany bandana"; the six colours below override name, desc and icon_state):

| var | value | file:line |
|---|---|---|
| `name` | `"botany bandana"` | miscellaneous.dm:227 |
| `desc` | `"A fine bandana with nanotech lining and a hydroponics pattern."` | miscellaneous.dm:228 |
| `w_class` | WEIGHT_CLASS_TINY = 1 | miscellaneous.dm:229, `code/__DEFINES/inventory.dm:5` |
| `flags_cover` | MASKCOVERSMOUTH | miscellaneous.dm:230 |
| `flags_inv` | HIDEFACE \| HIDEFACIALHAIR | miscellaneous.dm:231 |
| `visor_flags_inv` | HIDEFACE \| HIDEFACIALHAIR | miscellaneous.dm:232 |
| `visor_flags_cover` | MASKCOVERSMOUTH \| PEPPERPROOF | miscellaneous.dm:233 |
| `slot_flags` | ITEM_SLOT_MASK | miscellaneous.dm:234 |
| `adjusted_flags` | ITEM_SLOT_HEAD | miscellaneous.dm:235 |
| `icon_state` | `"bandbotany"` | miscellaneous.dm:236 |

Inherited from the mask base: `body_parts_covered` HEAD, `strip_delay` 40, `equip_delay_other` 40, `modifies_speech` FALSE (_masks.dm:4-8).

Behaviour:

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| `attack_self` | none | none | none | `adjustmask(user)` (miscellaneous.dm:238-239): pushes it out of the way (into head slot, see `adjusted_flags`) or back |
| `AltClick`, not holding the bandana | any | none | `"<span class='warning'>You must be holding [src] in order to tie it!</span>"` (miscellaneous.dm:264) | nothing |
| `AltClick`, worn on the mask slot | `get_item_by_slot(ITEM_SLOT_MASK) == src` (see gotcha) | none | `"<span class='warning'>You can't tie [src] while wearing it!</span>"` (miscellaneous.dm:246) | returns (miscellaneous.dm:247) |
| `AltClick`, pushed out of the way (`slot_flags & ITEM_SLOT_HEAD`) | none | none | `"<span class='warning'>You must undo [src] before you can tie it into a neckerchief!</span>"` (miscellaneous.dm:249) | returns |
| `AltClick`, held in hand | `user.is_holding(src)` and the bandana is not on the head/mask (miscellaneous.dm:251) | none | `"<span class='notice'>You tie [src] up like a neckerchief.</span>"` to the user and `"[user] ties [src] up like a neckerchief."` to others (miscellaneous.dm:261) | creates `/obj/item/clothing/neck/neckerchief` (miscellaneous.dm:252), named `"[name] neckerchief"` (miscellaneous.dm:253), desc `"[desc] It's tied up like a neckerchief."` (miscellaneous.dm:254), `icon_state` copied, `worn_icon` set to `'icons/misc/hidden.dmi'` (miscellaneous.dm:256), `sourceBandanaType = src.type` (miscellaneous.dm:257); puts it in the same hand (miscellaneous.dm:258-260); then `qdel(src)` (miscellaneous.dm:262) |

No `attack`, `afterattack` or `attackby` override in the bandana type blocks (miscellaneous.dm:226-264).

Construction chain: none for the base bandana. A search of `code/datums/components/crafting` and `code/game/objects/items/stacks` finds only the durathread bandana recipe (`code/datums/components/crafting/tailoring.dm:38-40`, `code/game/objects/items/stacks/sheets/sheet_types.dm:340`, 1 sheet, `time = 25`), which is a different path not on this list. Deconstruction: none. The AltClick tie (miscellaneous.dm:241-264) is the only other transformation; its result is a neckerchief, not on this list.

Drops: none. Destroyed as a clothing item (clothing.dm:434-453).

Health / armour: `max_integrity` 200, armour all 0, no protection (no protection values set on the base or children).

Power: none.

Gotchas:
* The head check in `AltClick` is written as `C.get_item_by_slot(ITEM_SLOT_HEAD == src)` (miscellaneous.dm:245). The `== src` sits inside the call, so the comparison is between a slot flag and the item and is always false (inferred from operator placement). The message on line 246 then only fires when the bandana is on the mask slot.
* `adjusted_flags` = ITEM_SLOT_HEAD (miscellaneous.dm:235). Once pushed out of the way, the bandana is worn as a head item (`slot_flags = adjusted_flags`, _masks.dm:68-69). Back in place it reverts (_masks.dm:59).
* `adjustmask` also drops `MASKCOVERSMOUTH | PEPPERPROOF` (visor_flags_cover) from `flags_cover` while out of the way (_masks.dm:67; miscellaneous.dm:233), so the mouth is no longer covered.

### Colour bandanas (children of `/obj/item/clothing/mask/bandana`)

All six set only `name`, `desc` and `icon_state`. Everything else is inherited from the parent above (miscellaneous.dm:226-236). Each path is written out below with its own values.

| DM path (file:line of type) | name (verbatim) | desc (verbatim) | icon_state | own lines |
|---|---|---|---|---|
| `/obj/item/clothing/mask/bandana/red` (miscellaneous.dm:266) | `"red bandana"` (miscellaneous.dm:267) | `"A fine red bandana with nanotech lining."` (miscellaneous.dm:268) | `"bandred"` (miscellaneous.dm:269) | none beyond these |
| `/obj/item/clothing/mask/bandana/blue` (miscellaneous.dm:271) | `"blue bandana"` (miscellaneous.dm:272) | `"A fine blue bandana with nanotech lining."` (miscellaneous.dm:273) | `"bandblue"` (miscellaneous.dm:274) | none beyond these |
| `/obj/item/clothing/mask/bandana/green` (miscellaneous.dm:276) | `"green bandana"` (miscellaneous.dm:277) | `"A fine green bandana with nanotech lining."` (miscellaneous.dm:278) | `"bandgreen"` (miscellaneous.dm:279) | none beyond these |
| `/obj/item/clothing/mask/bandana/gold` (miscellaneous.dm:281) | `"gold bandana"` (miscellaneous.dm:282) | `"A fine gold bandana with nanotech lining."` (miscellaneous.dm:283) | `"bandgold"` (miscellaneous.dm:284) | none beyond these |
| `/obj/item/clothing/mask/bandana/black` (miscellaneous.dm:286) | `"black bandana"` (miscellaneous.dm:287) | `"A fine black bandana with nanotech lining."` (miscellaneous.dm:288) | `"bandblack"` (miscellaneous.dm:289) | none beyond these |
| `/obj/item/clothing/mask/bandana/skull` (miscellaneous.dm:291) | `"skull bandana"` (miscellaneous.dm:292) | `"A fine black bandana with nanotech lining and a skull emblem."` (miscellaneous.dm:293) | `"bandskull"` (miscellaneous.dm:294) | none beyond these |

Per colour, the same as the parent: `w_class` TINY (1), `flags_cover` MASKCOVERSMOUTH, `flags_inv` HIDEFACE | HIDEFACIALHAIR, `visor_flags_cover` MASKCOVERSMOUTH | PEPPERPROOF, `slot_flags` ITEM_SLOT_MASK, `adjusted_flags` ITEM_SLOT_HEAD, the same AltClick and attack_self behaviour (miscellaneous.dm:238-264).

Construction chain: none found for the colour bandanas (same search as the base, part 3 above). Deconstruction chain: none.
Drops: none.
Health / armour: as parent. Power: none.
Gotchas: the colour is cosmetic. Only the sprite and text change; the AltClick tie and the adjust mechanics are identical. The `desc` strings are the only per-colour text.

# gap-items-02, part 4: luchador masks

Source: `code/modules/clothing/masks/boxing.dm`. Mask base (`/obj/item/clothing/mask`, `_masks.dm:1`) and the item/clothing defaults are in parts 1 and 3. Inherited here: `strip_delay` 40 and `equip_delay_other` 40 (_masks.dm:6-7), `armor` all 0 (objs.dm:60-63), `max_integrity` 200 (clothing.dm:4), `slot_flags` ITEM_SLOT_MASK (_masks.dm:5), `body_parts_covered` HEAD (_masks.dm:4), `adjusted_flags` null (_masks.dm:10), no protection values.

## Luchador parent: `/obj/item/clothing/mask/luchador`   (`code/modules/clothing/masks/boxing.dm:46`)

Own values:

| var | value | file:line |
|---|---|---|
| `name` | `"Luchador Mask"` | boxing.dm:47 |
| `desc` | `"Worn by robust fighters, flying high to defeat their foes!"` | boxing.dm:48 |
| `icon_state` | `"luchag"` | boxing.dm:49 |
| `inhand_icon_state` | `"luchag"` | boxing.dm:50 |
| `flags_inv` | HIDEFACE \| HIDEHAIR \| HIDEFACIALHAIR | boxing.dm:51 |
| `w_class` | WEIGHT_CLASS_SMALL = 2 | boxing.dm:52, `code/__DEFINES/inventory.dm:7` |
| `modifies_speech` | TRUE | boxing.dm:53 |

Mechanics: the mask base registers `COMSIG_MOB_SAY` to `handle_speech` when the mask is worn in ITEM_SLOT_MASK and `modifies_speech` is TRUE (`_masks.dm:18-23`), and unregisters on drop (`_masks.dm:25-27`). The luchador's `handle_speech` is the handler (boxing.dm:55).

`handle_speech(datum/source, list/speech_args)` (boxing.dm:55-77):

| step | condition | line | effect |
|---|---|---|---|
| read message | always | boxing.dm:56 | `speech_args[SPEECH_MESSAGE]` |
| skip emotes | `message[1] != "*"` | boxing.dm:57 | `*` messages are left alone |
| word swaps (in this order, all `replacetext`) | always | boxing.dm:58-73 | `"captain"` to `"CAPITÁN"`; `"station"` to `"ESTACIÓN"`; `"sir"` to `"SEÑOR"`; `"the "` to `"el "`; `"my "` to `"mi "`; `"is "` to `"es "`; `"it's"` to `"es"`; `"friend"` to `"amigo"`; `"buddy"` to `"amigo"`; `"hello"` to `"hola"`; `" hot"` to `" caliente"`; `" very "` to `" muy "`; `"sword"` to `"espada"`; `"library"` to `"biblioteca"`; `"traitor"` to `"traidor"`; `"wizard"` to `"mago"` |
| uppercase | always | boxing.dm:74 | `message = uppertext(message)`; comment says it "fits the macho wrestler image" |
| chant | `prob(25)` | boxing.dm:75-76 | `message += " OLE!"` |
| write back | always | boxing.dm:77 | `speech_args[SPEECH_MESSAGE] = message` (no trim) |

The word swaps are case-sensitive (`replacetext`). Only lowercase input matches; the uppercase step at line 74 runs after them.

Interactions (the parent and both children):

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| attack_self | `VOICEBOX_TOGGLABLE` is not set (boxing.dm does not set `clothing_flags`), so the mask base does nothing (_masks.dm:12-16) | none | none | no effect |
| speaking while worn in the mask slot | `modifies_speech` TRUE, slot ITEM_SLOT_MASK | none | none | rewrites speech as above |
| adjust (push out of the way) | the luchador has no `attack_self` override, no `adjusted_flags` (_masks.dm:10) and no `actions_types`, so `adjustmask` is never reached from its own code. Other masks do call it from `attack_self`, e.g. bandana (miscellaneous.dm:238-239) and balaclava (boxing.dm:11-12) | none | none | not adjustable |

No `attack`, `afterattack`, `attackby` or `interact` override on the luchador type blocks (boxing.dm:46-89).

Construction chain: none found. A search of `code/datums/components/crafting` and `code/game/objects/items/stacks` for `luchador` returns nothing.

Deconstruction chain: none.

Drops: none. Destroyed as a clothing item (clothing.dm:434-453).

Health / armour: `max_integrity` 200, armour all 0 (inherited), no protection values set.

Power: none.

Spawn sites (for context, not counts on BoxStation): `code/game/objects/structures/crates_lockers/closets/fitness.dm:35` (`/obj/item/clothing/mask/luchador`), `:36` (rudos), `:37` (tecnicos); `code/game/objects/items/storage/belt.dm:367` (`/obj/item/clothing/mask/luchador`); `code/modules/events/wizard/curseditems.dm:30` (wizard curse loadout `loadout[ITEM_SLOT_MASK] = /obj/item/clothing/mask/luchador`).

Gotchas:
* Speech is rewritten for everyone who hears the wearer, not only for a chat channel. It is applied on `COMSIG_MOB_SAY` (mask base _masks.dm:21).
* The `" OLE!"` chant is random at 25% (boxing.dm:75). It is not deterministic.
* The word list is English-to-Spanish-ish and only matches the exact lowercase tokens listed. Anything else passes through unchanged except for uppercasing.
* `flags_inv` hides the face, hair and facial hair (boxing.dm:51). The mask therefore also covers identity, not only the mouth. Note `flags_cover` is not set on the luchador (unset = 0), so the mouth is not covered (inferred from is_mouth_covered, carbon_defense.dm:24).

---

## Luchador child: `/obj/item/clothing/mask/luchador/tecnicos`   (`code/modules/clothing/masks/boxing.dm:79`)

| var | value | file:line |
|---|---|---|
| `name` | `"Tecnicos Mask"` | boxing.dm:80 |
| `desc` | `"Worn by robust fighters who uphold justice and fight honorably."` | boxing.dm:81 |
| `icon_state` | `"luchador"` | boxing.dm:82 |
| `inhand_icon_state` | `"luchador"` | boxing.dm:83 |

Everything else (flags, w_class SMALL, modifies_speech TRUE, the speech handler) is inherited from the parent (boxing.dm:46-53, 55-77).

Interactions, construction, deconstruction, drops, health, power: as the parent above.

Gotchas: the only per-type difference is the sprite and text. No protection changes.

---

## Luchador child: `/obj/item/clothing/mask/luchador/rudos`   (`code/modules/clothing/masks/boxing.dm:85`)

| var | value | file:line |
|---|---|---|
| `name` | `"Rudos Mask"` | boxing.dm:86 |
| `desc` | `"Worn by robust fighters who are willing to do anything to win."` | boxing.dm:87 |
| `icon_state` | `"luchar"` | boxing.dm:88 |
| `inhand_icon_state` | `"luchar"` | boxing.dm:89 |

Everything else is inherited from the parent (boxing.dm:46-53, 55-77), as for `tecnicos`.

Interactions, construction, deconstruction, drops, health, power: as the parent above.

Gotchas: the only per-type difference is the sprite and text. No protection changes.

# gap-items-02, part 5: shoes (parent, clown shoes, sneakers)

Clothing and item defaults are in part 1. Shoe-specific defaults and the lacing system are below and apply to every entry in this part.

## Shoe parent: `/obj/item/clothing/shoes`   (`code/modules/clothing/shoes/_shoes.dm:1`)

Own values:

| var | value | file:line |
|---|---|---|
| `name` | `"shoes"` | _shoes.dm:2 |
| `icon` | `'icons/obj/clothing/shoes.dmi'` | _shoes.dm:3 |
| `desc` | `"Comfortable-looking shoes."` | _shoes.dm:4 |
| `gender` | PLURAL | _shoes.dm:5 |
| `chained` | 0 | _shoes.dm:6 |
| `body_parts_covered` | FEET | _shoes.dm:8 |
| `slot_flags` | ITEM_SLOT_FEET | _shoes.dm:9 |
| `permeability_coefficient` | 0.5 | _shoes.dm:11 |
| `slowdown` | SHOES_SLOWDOWN = 0 | _shoes.dm:12, `code/__DEFINES/mobs.dm:294` |
| `strip_delay` | 1 SECONDS = 10 ds | _shoes.dm:13, `code/__DEFINES/time.dm:41` |
| `can_be_tied` | TRUE | _shoes.dm:20 |
| `tied` | SHOES_TIED = 1 (laces tied by default) | _shoes.dm:22, `code/__DEFINES/misc.dm:120` |
| `lace_time` | 5 SECONDS = 50 ds | _shoes.dm:24 |
| `can_be_bloody` | TRUE | _shoes.dm:18 |
| `offset` | 0 | _shoes.dm:16 |

Protection values are not set on the base, so `cold_protection`, `heat_protection`, `min_cold_protection_temperature` and `max_heat_protection_temperature` are all the item defaults (0, 0, null, null; items.dm:85-91). Armour is all 0 (objs.dm:60-63).

Lacing (the base behaviour of every shoe with `can_be_tied`):

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| attack_self | `INTERACTING_WITH(user, src)` is false (_shoes.dm:269) | `lace_time` (_shoes.dm:275) | `"<span class='notice'>You begin [tied ? "untying" : "tying"] the laces on [src]...</span>"` (_shoes.dm:273); on success `"<span class='notice'>You [tied ? "untie" : "tie"] the laces on [src].</span>"` (_shoes.dm:276); already busy: `"<span class='warning'>You're already interacting with [src]!</span>"` (_shoes.dm:270) | `adjust_laces(tied ? SHOES_TIED : SHOES_UNTIED, user)` (_shoes.dm:277) |
| attack_hand while worn (`loc == user`) | `tied != SHOES_TIED` and `MOBILITY_USE` (_shoes.dm:261) | `handle_tying` | see `handle_tying` (_shoes.dm:152-206) | the wearer ties or unties their own laces |
| untied, walking | `COMSIG_SHOES_STEP_ACTION` registered when untied (_shoes.dm:81-83, 137-141) | none | knotted: `"<span class='danger'>[our_guy] trips on [our_guy.p_their()] knotted shoelaces and falls! What a klutz!</span>"` (_shoes.dm:221); untied roll `rand(1, 1000)` (_shoes.dm:227): 1 = fall (Paralyze 5, Knockdown 10), 2-5 = lurch forward 3 tiles, 6-13 = fling held items, 14-25 = shove slowdown, 26+ nothing (_shoes.dm:228-252) | check_trip, _shoes.dm:213-256 |

Shoes start tied and every shoe in this part inherits that, so the trip logic only runs after someone unties them.

Other base procs used by children: `equipped` sets an `"shoealert"` when untied (_shoes.dm:74-83); `dropped` clears it (_shoes.dm:90-95); `attack_hand` and `handle_tying` are the knot-tying paths for other people (_shoes.dm:152-206).

## Sneaker parent: `/obj/item/clothing/shoes/sneakers`   (`code/modules/clothing/shoes/colour.dm:1`)

| var | value | file:line |
|---|---|---|
| `dying_key` | DYE_REGISTRY_SNEAKERS = `"sneakers"` | colour.dm:2, `code/__DEFINES/dye_keys.dm:4` |

The sneaker parent sets nothing else. All four sneakers in this part inherit every value from `/obj/item/clothing/shoes` above (part 5), and from the item defaults.

Sneaker children in this part do not set `armor`, cold or heat protection (only the black sneaker does, colour.dm:10-13, which is not on this list). Protection is therefore zero.

---

## Clown shoes

### `/obj/item/clothing/shoes/clown_shoes`   (`code/modules/clothing/shoes/miscellaneous.dm:91`)

* What it is: the clown's shoes. They squeak on each step, make the wearer waddle, and have a toggle.
* Key vars:

  | var | value | file:line |
  |---|---|---|
  | `desc` | `"The prankster's standard-issue clowning shoes. Damn, they're huge! Ctrl-click to toggle waddle dampeners."` | miscellaneous.dm:92 |
  | `name` | `"clown shoes"` | miscellaneous.dm:93 |
  | `icon_state` | `"clown"` | miscellaneous.dm:94 |
  | `inhand_icon_state` | `"clown_shoes"` | miscellaneous.dm:95 |
  | `slowdown` | SHOES_SLOWDOWN+1 = 1 | miscellaneous.dm:96, `code/__DEFINES/mobs.dm:294` |
  | `pocket_storage_component_path` | `/datum/component/storage/concrete/pockets/shoes/clown` | miscellaneous.dm:97 |
  | `enabled_waddle` | TRUE (waddle on by default) | miscellaneous.dm:98 |
  | `lace_time` | 20 SECONDS = 200 ds | miscellaneous.dm:99 |
  | `strip_delay`, `equip_delay_other` | not set here: inherit 10 ds and 20 ds (_shoes.dm:13, items.dm:124) | |

* Interactions:

  | held item / action | condition | delay (ds) | message(s) verbatim | result |
  |---|---|---|---|---|
  | worn on feet (`equipped`) | `slot == ITEM_SLOT_FEET` (miscellaneous.dm:107) | none | none | if `enabled_waddle`, `user.AddElement(/datum/element/waddling)` (miscellaneous.dm:108-109). If the user's mind role is `"Clown"`, sends `COMSIG_ADD_MOOD_EVENT` with `"clownshoes"` and `/datum/mood_event/clownshoes` (miscellaneous.dm:110-111) |
  | dropped | none | none | none | removes the waddling element (miscellaneous.dm:115); clears the `"clownshoes"` mood for a clown (miscellaneous.dm:116-117) |
  | Ctrl-click (`CtrlClick`), not holding the shoes | `user.get_active_held_item() != src` (miscellaneous.dm:122-123) | none | `"<span class='warning'>You must hold the [src] in your hand to do this!</span>"` (miscellaneous.dm:123) | returns |
  | Ctrl-click, holding the shoes, `enabled_waddle` currently FALSE | `isliving(user)` (miscellaneous.dm:120-121) | none | `"<span class='notice'>You switch off the waddle dampeners!</span>"` (miscellaneous.dm:126) | `enabled_waddle = TRUE` (miscellaneous.dm:127), waddle on |
  | Ctrl-click, holding the shoes, `enabled_waddle` currently TRUE | same | none | `"<span class='notice'>You switch on the waddle dampeners!</span>"` (miscellaneous.dm:129) | `enabled_waddle = FALSE` (miscellaneous.dm:130), waddle off |
  | `Initialize` | none | none | none | `AddComponent(/datum/component/squeak, list('sound/effects/clownstep1.ogg'=1,'sound/effects/clownstep2.ogg'=1), 50)` (miscellaneous.dm:103): squeak sounds, the trailing 50 is `volume_override` (`code/datums/components/squeak.dm:16`) |

  No `attack`, `afterattack` or `attackby` override on the clown shoes. The shoe base `attack_self` (lace toggle, _shoes.dm:266-277) still applies, because the clown shoes do not override it.

* Construction chain: none found. A search of `code/datums/components/crafting` and `code/game/objects/items/stacks` for `clown_shoes` returns nothing.
* Deconstruction chain: none.
* Drops: none. Destroyed as a clothing item (clothing.dm:434-453).
* Health / armour: `max_integrity` 200; armour all 0; no protection.
* Power: none.
* Gotchas:
  * The waddle is applied on equip and removed on drop only (miscellaneous.dm:105-117). Toggling with Ctrl-click while wearing the shoes does not add or remove the element (inferred: no AddElement or RemoveElement in the CtrlClick proc, miscellaneous.dm:119-130).
  * `enabled_waddle` TRUE means waddling is ON (the dampeners are off). The two messages are consistent with that.
  * The clown mood event only fires for a mind whose `assigned_role` is `"Clown"` (miscellaneous.dm:110, 116).
  * Slowdown 1 (miscellaneous.dm:96) makes them slower than the 0 shoe base, regardless of the waddle.

---

## Sneakers (children of `/obj/item/clothing/shoes/sneakers`)

### `/obj/item/clothing/shoes/sneakers/blue`   (`code/modules/clothing/shoes/colour.dm:20`)

| var | value | file:line |
|---|---|---|
| `name` | `"blue shoes"` | colour.dm:21 |
| `icon_state` | `"blue"` | colour.dm:22 |
| `desc` | not set: inherits `"Comfortable-looking shoes."` (_shoes.dm:4) | |

Interactions: the shoe base only (lace toggle, attack_hand tie, untied trip). No override. Construction: none found (the only sneaker recipe in the stacks is the white one, `code/game/objects/items/stacks/sheets/sheet_types.dm:282`). Deconstruction: none. Drops: none. Armour 0, no protection. Power: none.

### `/obj/item/clothing/shoes/sneakers/brown`   (`code/modules/clothing/shoes/colour.dm:15`)

| var | value | file:line |
|---|---|---|
| `name` | `"brown shoes"` | colour.dm:16 |
| `desc` | `"A pair of brown shoes."` | colour.dm:17 |
| `icon_state` | `"brown"` | colour.dm:18 |

Interactions, construction, deconstruction, drops, health and power: as the blue sneaker above.

### `/obj/item/clothing/shoes/sneakers/rainbow`   (`code/modules/clothing/shoes/colour.dm:46`)

| var | value | file:line |
|---|---|---|
| `name` | `"rainbow shoes"` | colour.dm:47 |
| `desc` | `"Very gay shoes."` | colour.dm:48 |
| `icon_state` | `"rain_bow"` | colour.dm:49 |

Interactions, construction, deconstruction, drops, health and power: as the blue sneaker above.

### `/obj/item/clothing/shoes/sneakers/orange`   (`code/modules/clothing/shoes/colour.dm:51`)

| var | value | file:line |
|---|---|---|
| `name` | `"orange shoes"` | colour.dm:52 |
| `desc` | not set: inherits `"Comfortable-looking shoes."` (_shoes.dm:4) | |
| `icon_state` | `"orange"` (unchained) / `"orange1"` (chained, set on attach) | colour.dm:53, colour.dm:60, colour.dm:70 |
| `chained` | 0 (base) / 1 when shackled | _shoes.dm:6, colour.dm:68 |
| `slowdown` | 0 (base SHOES_SLOWDOWN) / 15 when shackled | _shoes.dm:12, colour.dm:58, colour.dm:69 |

The orange sneaker is a cuffed-shoe variant. Its own overrides replace the base procs. `attackby`, `allow_attack_hand_drop` and `MouseDrop` call `..()`, but `attack_self` does not (colour.dm:55-61), so the base lace toggle is lost on this type.

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| `attack_self` (unshackle) | `chained` is set (colour.dm:56) | none | none | `chained = null` (colour.dm:57), `slowdown = SHOES_SLOWDOWN` (colour.dm:58), `new /obj/item/restraints/handcuffs( user.loc )` (colour.dm:59), `icon_state = "orange"` (colour.dm:60). Returns (colour.dm:61) |
| `attack_self`, not chained | none | none | none | nothing: the override has no `..()` call, so the lace toggle from `/obj/item/clothing/shoes` does not run (colour.dm:55-61) |
| `attackby` with handcuffs | `H.type == /obj/item/restraints/handcuffs` (exact type, subtypes ignored, colour.dm:65-66) and not chained | none | none | `qdel(H)` (colour.dm:67), `chained = 1` (colour.dm:68), `slowdown = 15` (colour.dm:69), `icon_state = "orange1"` (colour.dm:70). Calls `..()` first (colour.dm:64) |
| take off from the wearer's own feet (`allow_attack_hand_drop`) | `ishuman(user)`, `C.shoes == src` and `chained == 1` (colour.dm:74-76) | none | `"<span class='warning'>You need help taking these off!</span>"` (colour.dm:77) | returns FALSE (colour.dm:78); otherwise `..()` (colour.dm:79) |
| `MouseDrop` (drag onto self) | same condition as above (colour.dm:83-85) | none | `"<span class='warning'>You need help taking these off!</span>"` (colour.dm:86) | returns (colour.dm:87); otherwise `..()` (colour.dm:88) |

* Construction chain: none found for the orange sneaker or any sneaker in this part. Handcuffs come from the sneaker itself: they are consumed when the shoes are chained (colour.dm:67) and the handcuffs are recreated on unchain (colour.dm:59).
* Deconstruction chain: the unchain step above (colour.dm:55-61). No tool.
* Drops: on unchain, one `/obj/item/restraints/handcuffs` appears at `user.loc` (colour.dm:59). Nothing on destruction beyond clothing break behaviour (clothing.dm:434-453).
* Health / armour: `max_integrity` 200, armour 0, no protection.
* Power: none.
* Gotchas:
  * Chained orange shoes cannot be taken off by their wearer through hand-drop or MouseDrop (colour.dm:74-88). Other removal paths are not blocked in this file (inferred).
  * The `attackby` type test is exact (`H.type ==`), so only the plain handcuffs item chains the shoes (colour.dm:65 comment: "not using istype here because we want to ignore all subtypes").
  * `attack_self` on unchained orange shoes does nothing at all, so the lacing that other sneakers get does not work here (colour.dm:55-61).

# gap-items-02, part 6: suits (parent and jackets)

Clothing and item defaults are in part 1. Suit-specific values and the suit-storage rule are below.

## Suit parent: `/obj/item/clothing/suit`   (`code/modules/clothing/suits/_suits.dm:1`)

| var | value | file:line |
|---|---|---|
| `icon` | `'icons/obj/clothing/suits.dmi'` | _suits.dm:2 |
| `name` | `"suit"` | _suits.dm:3 |
| `fire_resist` | T0C + 100 = 373.15 (K) | _suits.dm:4, `code/__DEFINES/atmospherics.dm:24` (T0C = 273.15) |
| `allowed` | `list(/obj/item/tank/internals/emergency_oxygen, /obj/item/tank/internals/plasmaman)` (children override) | _suits.dm:5 |
| `armor` | all nine values 0 | _suits.dm:6 |
| `slot_flags` | ITEM_SLOT_OCLOTHING = `(1<<0)` | _suits.dm:9, `code/__DEFINES/inventory.dm:23` |
| `blood_overlay_type` | `"suit"` | _suits.dm:10 |
| `togglename` | null | _suits.dm:11 |
| `suittoggled` | FALSE | _suits.dm:12 |
| `limb_integrity` | 0 (no per-zone shredding for suits) | _suits.dm:13 |
| `drop_sound` / `pickup_sound` | `'sound/items/handling/cloth_drop.ogg'` / `'sound/items/handling/cloth_pickup.ogg'` | _suits.dm:7-8 |

Suit storage, the rule that uses `allowed` on every suit in this part (`code/modules/mob/living/carbon/human/species.dm:1058-1068`):

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| put a held item into the suit storage slot | the wearer has a suit (species.dm:1054) | none | `"<span class='warning'>You need a suit before you can attach this [I.name]!</span>"` (species.dm:1056) | refused, unless `disable_warning` |
| same, suit has no `allowed` list | `!H.wear_suit.allowed` (species.dm:1058) | none | `"<span class='warning'>You somehow have a suit with no defined allowed items for suit storage, stop that.</span>"` (species.dm:1060) | refused |
| same, item is too big | `I.w_class > WEIGHT_CLASS_BULKY` (species.dm:1062) | none | `"<span class='warning'>The [I.name] is too big to attach!</span>"` (species.dm:1064) | refused. WEIGHT_CLASS_BULKY = 4 (`code/__DEFINES/inventory.dm:11`) |
| same, item is in the list | `istype(I, /obj/item/pda) \|\| istype(I, /obj/item/pen) \|\| is_type_in_list(I, H.wear_suit.allowed)` (species.dm:1066) | none | none | allowed. PDA and pen are always allowed (species.dm:1066) |

Suit clothing has no attack, attack_self or attackby override of its own in these lines. The `allowed` list is the only suit-specific interaction.

Clothing-wide: `resistance_flags` FLAMMABLE (clothing.dm:3), `max_integrity` 200 (clothing.dm:4), damage zones off by `limb_integrity` 0 (_suits.dm:13).

---

## Bomber jacket

### `/obj/item/clothing/suit/jacket`   (`code/modules/clothing/suits/miscellaneous.dm:387`)

* What it is: a bomber jacket. It covers chest, groin and arms and has a large suit-storage list.
* Key vars:

  | var | value | file:line |
  |---|---|---|
  | `name` | `"bomber jacket"` | miscellaneous.dm:388 |
  | `desc` | `"Aviators not included."` | miscellaneous.dm:389 |
  | `icon_state` | `"bomberjacket"` | miscellaneous.dm:390 |
  | `inhand_icon_state` | `"brownjsuit"` | miscellaneous.dm:391 |
  | `allowed` | `list(/obj/item/flashlight, /obj/item/tank/internals/emergency_oxygen, /obj/item/tank/internals/plasmaman, /obj/item/toy, /obj/item/storage/fancy/cigarettes, /obj/item/lighter, /obj/item/radio)` | miscellaneous.dm:392 |
  | `body_parts_covered` | CHEST \| GROIN \| ARMS | miscellaneous.dm:393 |
  | `cold_protection` | CHEST \| GROIN \| ARMS | miscellaneous.dm:394 |
  | `min_cold_protection_temperature` | FIRE_SUIT_MIN_TEMP_PROTECT = 60 (K) | miscellaneous.dm:395, `code/__DEFINES/atmospherics.dm:166` |
  | `heat_protection` | not set: 0 (items.dm:85) | |
  | `max_heat_protection_temperature` | not set: null (items.dm:89) | |
  | `strip_delay` | not set: 40 (items.dm:126) | |
  | `equip_delay_other` | not set: 20 (items.dm:124) | |
  | `armor` | all 0 (inherited from the suit base, _suits.dm:6) | |

* Interactions: no `attack_self`, `attack` or `attackby` override. Suit storage per the table in the suit parent above (species.dm:1058-1068). Accepts the listed items: flashlight, emergency oxygen tank, plasmaman tank, toy, cigarettes, lighter, radio, plus PDA and pen (species.dm:1066).
* Construction chain: none found. The leather jacket has its own recipe (part 6 below); the bomber does not appear in `code/datums/components/crafting` or `code/game/objects/items/stacks` (search by path, `jacket`).
* Deconstruction chain: none.
* Drops: none. Destroyed as a clothing item (clothing.dm:434-453).
* Health / armour: `max_integrity` 200 (clothing.dm:4), armour all 0 (_suits.dm:6). Cold protection on CHEST, GROIN and ARMS down to 60 K (miscellaneous.dm:394-395). No heat protection.
* Power: none.
* Gotchas:
  * Cold protection is active only while the ambient temperature is at or above the min (life.dm:233-235: `min_cold_protection_temperature <= temperature`). The min here is FIRE_SUIT_MIN_TEMP_PROTECT = 60 K (atmospherics.dm:166). items.dm:90 describes it as the temperature "down to which" the item protects.
  * Heat protection is absent. `max_heat_protection_temperature` is null, and `heat_protection` is 0 (items.dm:85-89), so the fire rules for this jacket are empty.
  * The bomber jacket is the parent of the leather jacket and overcoat (see below), so their unset values inherit from here.

---

## Leather jacket

### `/obj/item/clothing/suit/jacket/leather`   (`code/modules/clothing/suits/miscellaneous.dm:397`)

This type is a child of `/obj/item/clothing/suit/jacket` (the bomber, miscellaneous.dm:387). Everything it does not set is inherited from the bomber jacket above, including `body_parts_covered` CHEST|GROIN|ARMS (miscellaneous.dm:393), `cold_protection` CHEST|GROIN|ARMS (miscellaneous.dm:394) and `min_cold_protection_temperature` 60 (miscellaneous.dm:395).

* Own values:

  | var | value | file:line |
  |---|---|---|
  | `name` | `"leather jacket"` | miscellaneous.dm:398 |
  | `desc` | `"Pompadour not included."` | miscellaneous.dm:399 |
  | `icon_state` | `"leatherjacket"` | miscellaneous.dm:400 |
  | `inhand_icon_state` | `"hostrench"` | miscellaneous.dm:401 |
  | `resistance_flags` | NONE (overrides FLAMMABLE from clothing.dm:3) | miscellaneous.dm:402 |
  | `max_heat_protection_temperature` | ARMOR_MAX_TEMP_PROTECT = 600 (K) | miscellaneous.dm:403, `code/__DEFINES/atmospherics.dm:184` |
  | `allowed` | `list(/obj/item/flashlight, /obj/item/tank/internals/emergency_oxygen, /obj/item/tank/internals/plasmaman, /obj/item/toy, /obj/item/storage/fancy/cigarettes, /obj/item/lighter, /obj/item/gun/ballistic/automatic/pistol, /obj/item/gun/ballistic/revolver, /obj/item/gun/ballistic/revolver/detective, /obj/item/radio)` | miscellaneous.dm:404 |

* Inherited from the bomber: `body_parts_covered`, `cold_protection`, `min_cold_protection_temperature`, `slot_flags`, `strip_delay` 40, `equip_delay_other` 20, `heat_protection` 0.
* Interactions: suit storage per the suit parent. Compared with the bomber list, it adds the pistol and both revolver types (miscellaneous.dm:404). PDA and pen are always allowed (species.dm:1066). No other interaction.
* Construction chain: `new/datum/stack_recipe("leather jacket", /obj/item/clothing/suit/jacket/leather, 7)` in `GLOBAL_LIST_INIT(leather_recipes ...)` (`code/game/objects/items/stacks/sheets/leather.dm:160`). 7 leather sheets (third argument = req_amount, stack.dm:485). Result amount 1 (default).
* Deconstruction chain: none.
* Drops: none. Destroyed as a clothing item (clothing.dm:434-453).
* Health / armour: `max_integrity` 200 (clothing.dm:4). Armour all 0 (_suits.dm:6). Cold protection CHEST, GROIN, ARMS down to 60 K (inherited).
* Power: none.
* Gotchas:
  * `resistance_flags` is NONE here, so the jacket is not flagged FLAMMABLE (miscellaneous.dm:402, overriding clothing.dm:3).
  * `max_heat_protection_temperature` is 600 K, but `heat_protection` is 0 (inherited, items.dm:85). The heat limit has no body area to protect, so no heat protection applies (inferred from items.dm:88 comment "Only protects areas set by heat_protection flags").
  * The jacket's `allowed` list is the only way the gun types can be placed in suit storage.

---

## Leather overcoat

### `/obj/item/clothing/suit/jacket/leather/overcoat`   (`code/modules/clothing/suits/miscellaneous.dm:406`)

Child of `/obj/item/clothing/suit/jacket/leather` (miscellaneous.dm:397), so inherits the leather jacket, and through it the bomber jacket.

* Own values:

  | var | value | file:line |
  |---|---|---|
  | `name` | `"leather overcoat"` | miscellaneous.dm:407 |
  | `desc` | `"That's a damn fine coat."` | miscellaneous.dm:408 |
  | `icon_state` | `"leathercoat"` | miscellaneous.dm:409 |
  | `body_parts_covered` | CHEST \| GROIN \| ARMS \| LEGS (overrides the bomber's CHEST\|GROIN\|ARMS) | miscellaneous.dm:410 |
  | `cold_protection` | CHEST \| GROIN \| ARMS \| LEGS (overrides the bomber's CHEST\|GROIN\|ARMS) | miscellaneous.dm:411 |

* Inherited from the leather jacket: `resistance_flags` NONE (miscellaneous.dm:402), `max_heat_protection_temperature` 600 (miscellaneous.dm:403), `allowed` list (miscellaneous.dm:404), `inhand_icon_state` `"hostrench"` (miscellaneous.dm:401). Inherited from the bomber: `min_cold_protection_temperature` 60 (miscellaneous.dm:395).
* Interactions: suit storage per the leather jacket. No other interaction.
* Construction chain: `new/datum/stack_recipe("leather overcoat", /obj/item/clothing/suit/jacket/leather/overcoat, 10)` in `GLOBAL_LIST_INIT(leather_recipes ...)` (`code/game/objects/items/stacks/sheets/leather.dm:162`). 10 leather sheets.
* Deconstruction chain: none.
* Drops: none. Destroyed as a clothing item (clothing.dm:434-453).
* Health / armour: `max_integrity` 200, armour all 0. Cold protection on CHEST, GROIN, ARMS and LEGS down to 60 K (min inherited from miscellaneous.dm:395). No heat protection (`heat_protection` 0, items.dm:85).
* Power: none.
* Gotchas:
  * This is the only jacket here that covers the legs. The leg coverage comes from `body_parts_covered` (miscellaneous.dm:410) and `cold_protection` (miscellaneous.dm:411).
  * The 60 K minimum is inherited, not set on this type. Earlier reasoning that treated it as null was wrong: the type path puts it under the bomber.
  * The 600 K maximum is inherited from the leather jacket, with the same missing `heat_protection` as above.

# gap-items-02, part 7: engineering winter coat (hooded chain)

The engineering winter coat is a hooded suit. Its hood is a separate head item made by the hooded base. Chain: `/obj/item/clothing/suit/hooded` (toggles.dm:3) → `/obj/item/clothing/suit/hooded/wintercoat` (miscellaneous.dm:539) → `/obj/item/clothing/suit/hooded/wintercoat/engineering`. Hood chain: `/obj/item/clothing/head/hooded` (toggles.dm:72) → `/obj/item/clothing/head/hooded/winterhood` (miscellaneous.dm:550) → `/obj/item/clothing/head/hooded/winterhood/engineering`. Clothing and suit defaults are in parts 1 and 6.

## Hooded suit base: `/obj/item/clothing/suit/hooded`   (`code/modules/clothing/suits/toggles.dm:3`)

| var / proc | value | file:line |
|---|---|---|
| `actions_types` | `list(/datum/action/item_action/toggle_hood)` | toggles.dm:4 |
| `hood` | the linked hood object (null until made) | toggles.dm:5 |
| `hoodtype` | `/obj/item/clothing/head/hooded/winterhood` (children override) | toggles.dm:6 |
| `Initialize` | calls `MakeHood()` | toggles.dm:8-10 |
| `MakeHood()` | `if(!hood)`: `new hoodtype(src)`, sets `W.suit = src`, `hood = W` | toggles.dm:17-21 |
| `ui_action_click()` | calls `ToggleHood()` | toggles.dm:23-24 |
| `item_action_slot_check(slot)` | returns 1 for `ITEM_SLOT_OCLOTHING` | toggles.dm:26-28 |
| `equipped(user, slot)` | `if(slot != ITEM_SLOT_OCLOTHING) RemoveHood()` | toggles.dm:30-33 |
| `RemoveHood()` | `icon_state = initial`; `suittoggled = FALSE`; moves the hood back into the suit (`transferItemToLoc`) if a human holds it, else `forceMove` into the suit; updates action buttons | toggles.dm:35-46 |
| `dropped()` | `RemoveHood()` | toggles.dm:48-50 |
| `ToggleHood()` | see the table below | toggles.dm:52-70 |

`ToggleHood()` (toggles.dm:52-70):

| step | condition | line | effect and message(s) verbatim |
|---|---|---|---|
| not up | `!suittoggled` (toggles.dm:53) | 53 | continue |
| not a human | `ishuman(src.loc)` false | 54 | nothing happens, no message |
| not worn | `H.wear_suit != src` (toggles.dm:56) | 56-58 | `"<span class='warning'>You must be wearing [src] to put up the hood!</span>"` (toggles.dm:57), return |
| head occupied | `H.head` (toggles.dm:59) | 59-61 | `"<span class='warning'>You're already wearing something on your head!</span>"` (toggles.dm:60), return |
| hood fits | `H.equip_to_slot_if_possible(hood, ITEM_SLOT_HEAD, 0, 0, 1)` (toggles.dm:62) | 62-68 | `suittoggled = TRUE` (toggles.dm:63); `icon_state = "[initial(icon_state)]_t"` (toggles.dm:64); `H.update_inv_wear_suit()` (toggles.dm:65); action buttons updated (toggles.dm:66-68) |
| already up | `suittoggled` TRUE (toggles.dm:69) | 69-70 | `RemoveHood()` |

No delay anywhere in the hood toggle (no `do_after`, no `sleep`).

## Hood base: `/obj/item/clothing/head/hooded`   (`code/modules/clothing/suits/toggles.dm:72`)

| var / proc | value | file:line |
|---|---|---|
| `suit` | the linked suit | toggles.dm:73 |
| `dynamic_hair_suffix` | `""` | toggles.dm:74 |
| `Destroy()` | `suit = null` | toggles.dm:76-78 |
| `dropped()` | `suit.RemoveHood()` if `suit` | toggles.dm:80-83 |
| `equipped(user, slot)` | if `slot != ITEM_SLOT_HEAD`: `suit.RemoveHood()` if `suit`, otherwise `qdel(src)` | toggles.dm:85-91 |

Note: a hood that is equipped outside the head slot with no linked suit deletes itself (toggles.dm:88-91).

---

## Winter coat parent: `/obj/item/clothing/suit/hooded/wintercoat`   (`code/modules/clothing/suits/miscellaneous.dm:539`)

| var | value | file:line |
|---|---|---|
| `name` | `"winter coat"` | miscellaneous.dm:540 |
| `desc` | `"A heavy jacket made from 'synthetic' animal furs."` | miscellaneous.dm:541 |
| `icon_state`, `inhand_icon_state` | `"coatwinter"`, `"coatwinter"` | miscellaneous.dm:542-543 |
| `body_parts_covered` | CHEST \| GROIN \| ARMS | miscellaneous.dm:544 |
| `cold_protection` | CHEST \| GROIN \| ARMS | miscellaneous.dm:545 |
| `min_cold_protection_temperature` | FIRE_SUIT_MIN_TEMP_PROTECT = 60 (K) | miscellaneous.dm:546, atmospherics.dm:166 |
| `armor` | melee 0, bullet 0, laser 0, energy 0, bomb 0, bio 10, rad 0, fire 0, acid 0 | miscellaneous.dm:547 |
| `allowed` | `list(/obj/item/flashlight, /obj/item/tank/internals/emergency_oxygen, /obj/item/tank/internals/plasmaman, /obj/item/toy, /obj/item/storage/fancy/cigarettes, /obj/item/lighter)` | miscellaneous.dm:548 |

Inherits from the hooded suit base: the hood action, `hoodtype` default, and the hood toggle above. Interactions: as the hooded base table above. Suit storage per part 6 (species.dm:1058-1068).

Hood parent: `/obj/item/clothing/head/hooded/winterhood` (miscellaneous.dm:550-558):

| var | value | file:line |
|---|---|---|
| `name` | `"winter hood"` | miscellaneous.dm:551 |
| `desc` | `"A hood attached to a heavy winter jacket."` | miscellaneous.dm:552 |
| `icon_state` | `"winterhood"` | miscellaneous.dm:553 |
| `body_parts_covered` | HEAD | miscellaneous.dm:554 |
| `cold_protection` | HEAD | miscellaneous.dm:555 |
| `min_cold_protection_temperature` | FIRE_SUIT_MIN_TEMP_PROTECT = 60 (K) | miscellaneous.dm:556 |
| `flags_inv` | HIDEHAIR \| HIDEEARS | miscellaneous.dm:557 |
| `armor` | melee 0, bullet 0, laser 0, energy 0, bomb 0, bio 10, rad 0, fire 0, acid 0 | miscellaneous.dm:558 |

Inherits `dynamic_hair_suffix` `""` and the linked-suit behaviour from `/obj/item/clothing/head/hooded` (toggles.dm:74, 80-91), and `slot_flags` ITEM_SLOT_HEAD and `body_parts_covered` HEAD from `/obj/item/clothing/head` (_head.dm:6-7).

---

## Engineering winter coat

### `/obj/item/clothing/suit/hooded/wintercoat/engineering`   (`code/modules/clothing/suits/miscellaneous.dm:614`)

* What it is: the engineers' version of the winter coat, with a rad, fire and acid rated armour and a hood.
* Key vars:

  | var | value | file:line |
  |---|---|---|
  | `name` | `"engineering winter coat"` | miscellaneous.dm:615 |
  | `icon_state` | `"coatengineer"` | miscellaneous.dm:616 |
  | `inhand_icon_state` | `"coatengineer"` | miscellaneous.dm:617 |
  | `armor` | melee 0, bullet 0, laser 0, energy 0, bomb 0, bio 0, rad 20, fire 30, acid 45 (overrides the winter coat's bio 10) | miscellaneous.dm:618 |
  | `allowed` | `list(/obj/item/flashlight, /obj/item/tank/internals/emergency_oxygen, /obj/item/tank/internals/plasmaman, /obj/item/t_scanner, /obj/item/construction/rcd, /obj/item/pipe_dispenser, /obj/item/toy, /obj/item/storage/fancy/cigarettes, /obj/item/lighter)` | miscellaneous.dm:619 |
  | `hoodtype` | `/obj/item/clothing/head/hooded/winterhood/engineering` | miscellaneous.dm:620 |

* Inherited from the winter coat: `body_parts_covered` CHEST|GROIN|ARMS (miscellaneous.dm:544), `cold_protection` CHEST|GROIN|ARMS (miscellaneous.dm:545), `min_cold_protection_temperature` 60 (miscellaneous.dm:546), `strip_delay` 40 and `equip_delay_other` 20 (items.dm:124-126; the suit base does not set them, _suits.dm:1-13). No `heat_protection` and no `max_heat_protection_temperature` are set on any level of this chain, so both are 0 and null (items.dm:85, 89).
* Interactions:

  | held item / action | condition | delay (ds) | message(s) verbatim | result |
  |---|---|---|---|---|
  | hood action (toggle) | worn in the suit slot, head empty (toggles.dm:53-61) | none | `"<span class='warning'>You must be wearing [src] to put up the hood!</span>"` (toggles.dm:57) or `"<span class='warning'>You're already wearing something on your head!</span>"` (toggles.dm:60) on failure | hood goes on the head, suit icon `"coatengineer_t"` (from `"[initial(icon_state)]_t"`, toggles.dm:64) |
  | coat moved out of the suit slot | `slot != ITEM_SLOT_OCLOTHING` (toggles.dm:31-32) | none | none | `RemoveHood()`: hood moves back into the coat |
  | coat dropped | none | none | none | `RemoveHood()` (toggles.dm:48-50) |
  | hood moved out of the head slot | `slot != ITEM_SLOT_HEAD` (toggles.dm:87) | none | none | `suit.RemoveHood()`, or `qdel` of the hood when there is no linked suit (toggles.dm:88-91) |
  | suit storage | per part 6 (species.dm:1058-1068) | none | none | allowed list above |

  No `attack`, `attackby` or `attack_self` on the coat. The hood action is the only toggle.

* Hood, `/obj/item/clothing/head/hooded/winterhood/engineering` (`code/modules/clothing/suits/miscellaneous.dm:622`):

  | var | value | file:line |
  |---|---|---|
  | `icon_state` | `"winterhood_engineer"` | miscellaneous.dm:623 |
  | `armor` | melee 0, bullet 0, laser 0, energy 0, bomb 0, bio 0, rad 20, fire 30, acid 45 (overrides the bio 10 of the winter hood) | miscellaneous.dm:624 |

  Inherits: `name` `"winter hood"`, `desc`, `body_parts_covered` HEAD, `cold_protection` HEAD, `min_cold_protection_temperature` 60, `flags_inv` HIDEHAIR | HIDEEARS (miscellaneous.dm:551-557), `dynamic_hair_suffix` `""` (toggles.dm:74). The hood's `name` and `desc` are therefore the parent's: `"winter hood"` and `"A hood attached to a heavy winter jacket."`. No interactions beyond the linked-suit behaviour (toggles.dm:85-91).

* Construction chain: none found. `grep` for `wintercoat/engineering` across `code/datums/components/crafting` and `code/game/objects/items/stacks` returns nothing.
* Deconstruction chain: none.
* Drops: none on destruction beyond clothing break behaviour (clothing.dm:434-453). The hood is not a separate drop: it moves back into the coat or is deleted (toggles.dm:88-91).
* Health / armour: `max_integrity` 200 (clothing.dm:4). Coat armour rad 20, fire 30, acid 45, all others 0 (miscellaneous.dm:618). Hood armour rad 20, fire 30, acid 45, all others 0 (miscellaneous.dm:624). Cold protection (CHEST, GROIN, ARMS on the coat, HEAD on the hood) down to 60 K (miscellaneous.dm:546, 556). No heat protection.
* Power: none.
* Gotchas:
  * The coat's `armor` replaces the winter coat's: `bio` 10 becomes 0 (miscellaneous.dm:547 vs 618). The hood does the same (miscellaneous.dm:558 vs 624).
  * The hood is created by `MakeHood` when the coat initialises (toggles.dm:8-10, 17-21), so every engineering coat carries one hood object from the start.
  * The toggle needs an empty head slot and the coat worn in the suit slot. There is no delay or message on success.
  * `clothing_flags` is not set, so the coat and hood are not SNUG_FIT (clothing.dm:26 NONE); a thrown hat can knock the hood off the wearer's head (_head.dm:42-44 SNUG_FIT check applies only to the head item).
  * Heat: the engineering coat has no heat values, so the rad / fire / acid armour is the only damage-type protection. Fire 30 on `armor` is not the same as heat protection (inferred from the separate field names).

# gap-items-02, part 8: reactive armour (teleport)

Chain: `/obj/item/clothing/suit/armor` (`code/modules/clothing/suits/armor.dm:1`) → `/obj/item/clothing/suit/armor/reactive` (`code/modules/clothing/suits/reactive_armour.dm:27`) → `/obj/item/clothing/suit/armor/reactive/teleport` (`reactive_armour.dm:64`). Clothing and suit defaults are in parts 1 and 6.

## Armour parent: `/obj/item/clothing/suit/armor`   (`code/modules/clothing/suits/armor.dm:1`)

| var | value | file:line |
|---|---|---|
| `allowed` | null (set to `GLOB.security_vest_allowed` in Initialize when null) | armor.dm:2, armor.dm:14-17 |
| `body_parts_covered` | CHEST | armor.dm:3 |
| `cold_protection` | CHEST \| GROIN | armor.dm:4 |
| `min_cold_protection_temperature` | ARMOR_MIN_TEMP_PROTECT = 160 (K) | armor.dm:5, `code/__DEFINES/atmospherics.dm:182` |
| `heat_protection` | CHEST \| GROIN | armor.dm:6 |
| `max_heat_protection_temperature` | ARMOR_MAX_TEMP_PROTECT = 600 (K) | armor.dm:7, `code/__DEFINES/atmospherics.dm:184` |
| `strip_delay` | 60 | armor.dm:8 |
| `equip_delay_other` | 40 | armor.dm:9 |
| `max_integrity` | 250 | armor.dm:10 |
| `resistance_flags` | NONE | armor.dm:11 |
| `armor` | melee 35, bullet 30, laser 30, energy 40, bomb 25, bio 0, rad 0, fire 50, acid 50, wound 15 | armor.dm:12 |

Initialize (armor.dm:14-17): `if(!allowed) allowed = GLOB.security_vest_allowed`. The security vest list (`code/__DEFINES/inventory.dm:155-167`) is: `/obj/item/ammo_box`, `/obj/item/ammo_casing`, `/obj/item/flashlight`, `/obj/item/gun/ballistic`, `/obj/item/gun/energy`, `/obj/item/kitchen/knife/combat`, `/obj/item/melee/baton`, `/obj/item/melee/classic_baton/telescopic`, `/obj/item/reagent_containers/spray/pepper`, `/obj/item/restraints/handcuffs`, `/obj/item/tank/internals/emergency_oxygen`, `/obj/item/tank/internals/plasmaman`. A child that sets its own `allowed` keeps it, because the Initialize only fills a null list (armor.dm:16).

Interactions: the armour base has no own attack, attack_self or attackby override in these lines. Its `hit_reaction` hook is the mechanism for the reactive subtypes (see below).

---

## Reactive armour base: `/obj/item/clothing/suit/armor/reactive`   (`code/modules/clothing/suits/reactive_armour.dm:27`)

| var | value | file:line |
|---|---|---|
| `name` | `"reactive armor"` | reactive_armour.dm:28 |
| `desc` | `"Doesn't seem to do much for some reason."` | reactive_armour.dm:29 |
| `active` | 0 (off) | reactive_armour.dm:30 |
| `reactivearmor_cooldown_duration` | 0 (set per child) | reactive_armour.dm:31 |
| `reactivearmor_cooldown` | 0 | reactive_armour.dm:32 |
| `icon_state`, `inhand_icon_state` | `"reactiveoff"`, `"reactiveoff"` | reactive_armour.dm:33-34 |
| `blood_overlay_type` | `"armor"` | reactive_armour.dm:35 |
| `armor` | melee 0, bullet 0, laser 0, energy 0, bomb 0, bio 0, rad 0, fire 100, acid 100 (no `wound` key, so wound = 0) | reactive_armour.dm:36 |
| `actions_types` | `list(/datum/action/item_action/toggle)` | reactive_armour.dm:37 |
| `resistance_flags` | INDESTRUCTIBLE \| LAVA_PROOF \| FIRE_PROOF \| ACID_PROOF | reactive_armour.dm:38 |
| `hit_reaction_chance` | 50 | reactive_armour.dm:39 |

Interactions on the reactive base:

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| attack_self (toggle) | none (no incapacitation check) | none | active: `"<span class='notice'>[src] is now active.</span>"` (reactive_armour.dm:44); inactive: `"<span class='notice'>[src] is now inactive.</span>"` (reactive_armour.dm:48) | `active = !(active)` (reactive_armour.dm:42); icon and inhand `"reactive"` when active (reactive_armour.dm:45-46), `"reactiveoff"` when inactive (reactive_armour.dm:49-50); `add_fingerprint(user)` (reactive_armour.dm:51) |
| EMP (`emp_act`) | not `EMP_PROTECT_SELF` (reactive_armour.dm:56-57) | none | none | `active = 0`, icon and inhand `"reactiveoff"`, `reactivearmor_cooldown = world.time + 200` (reactive_armour.dm:58-61). 200 ds = 20 s |

Armour and protection on the reactive base come from the armour parent for everything the base does not override: `max_integrity` 250, `body_parts_covered` CHEST, cold CHEST|GROIN down to 160 K, heat CHEST|GROIN up to 600 K, `strip_delay` 60, `equip_delay_other` 40, `allowed` = security vest list (armor.dm:1-17). `armor` is overridden by the reactive base (reactive_armour.dm:36) and `resistance_flags` is overridden too (reactive_armour.dm:38; armor.dm:11 has NONE).

---

## Teleport armour: `/obj/item/clothing/suit/armor/reactive/teleport`   (`code/modules/clothing/suits/reactive_armour.dm:64`)

* What it is: a suit that, when hit, teleports the wearer a short distance and irradiates them.
* Key vars:

  | var | value | file:line |
  |---|---|---|
  | `name` | `"reactive teleport armor"` | reactive_armour.dm:65 |
  | `desc` | `"Someone separated our Research Director from his own head!"` | reactive_armour.dm:66 |
  | `tele_range` | 6 (tiles) | reactive_armour.dm:67 |
  | `rad_amount` | 15 (radiation passed to `rad_act`) | reactive_armour.dm:68 |
  | `reactivearmor_cooldown_duration` | 100 (ds, = 10 s) | reactive_armour.dm:69 |
  | `siemens_coefficient` | not set: 1 (items.dm:114). Only the tesla child sets -1 (reactive_armour.dm:153) | |

* Interactions:

  | held item / action | condition | delay (ds) | message(s) verbatim | result |
  |---|---|---|---|---|
  | hit (the armour's `hit_reaction` hook, caller not traced) | `active` is FALSE: `return 0` (reactive_armour.dm:72-73) | none | none | nothing |
  | hit, active, roll | `prob(hit_reaction_chance)` = `prob(50)` (reactive_armour.dm:74) | none | none | roll fails: `return 0` (reactive_armour.dm:99) |
  | hit, active, roll passes, still cooling down | `world.time < reactivearmor_cooldown` (reactive_armour.dm:76) | none | `owner.visible_message("<span class='danger'>The reactive teleport system is still recharging! It fails to teleport [H]!</span>")` (reactive_armour.dm:77) | returns with no value (reactive_armour.dm:78) |
  | hit, active, roll passes, ready | same and `reactivearmor_cooldown` passed | none | `owner.visible_message("<span class='danger'>The reactive teleport system flings [H] clear of [attack_text], shutting itself off in the process!</span>")` (reactive_armour.dm:79); `playsound(get_turf(owner),'sound/magic/blink.ogg', 100, TRUE)` (reactive_armour.dm:80) | teleport, see below |
  | attack_self, emp_act | as the reactive base | | | as the reactive base table above |

  Teleport target (reactive_armour.dm:81-95): gather turfs in `orange(tele_range, H)` (range 6) that are not `density` (reactive_armour.dm:82-84) and sit inside a margin of `tele_range` from the map edge on each axis (reactive_armour.dm:85-88). If none qualify, `pick(/turf in orange(tele_range, H))` (reactive_armour.dm:90-91). The wearer is `forceMove`d to a picked turf (reactive_armour.dm:95), then `H.rad_act(rad_amount)` (reactive_armour.dm:96), `reactivearmor_cooldown = world.time + reactivearmor_cooldown_duration` (reactive_armour.dm:97), and `return 1` (reactive_armour.dm:98).

* Construction chain (armour shell plus anomaly core, not a recipe):
  1. Protolathe design `reactive_armour`, name `"Reactive Armour Shell"`, `build_type = PROTOLATHE`, `materials = list(/datum/material/iron = 10000, /datum/material/diamond = 5000, /datum/material/uranium = 8000, /datum/material/silver = 4500, /datum/material/gold = 5000)`, `build_path = /obj/item/reactive_armour_shell`, category Equipment, departments science and engineering (`code/modules/research/designs/misc_designs.dm:451-459`). Material amounts are raw as in the source.
  2. Insert an anomaly signaler into the shell (see the shell table below). A bluespace signaler gives the teleport armour.
  3. The shell and the signaler are both deleted, and the armour appears at the shell's turf (reactive_armour.dm:22-24).

  The bluespace signaler comes from a bluespace anomaly: `aSignal = new aSignal(src)`, `aSignal.anomaly_type = type` (`code/game/objects/effects/anomalies.dm:29-31`). The spawned bluespace signalers in the tree are at `code/game/objects/structures/icemoon/cave_entrance.dm:170` and `code/modules/mob/living/simple_animal/hostile/mining_mobs/ice demon.dm:77`.

* Deconstruction chain: none defined on the armour.

* Drops: none. The type is `INDESTRUCTIBLE` (reactive_armour.dm:38). `take_damage` returns at once for INDESTRUCTIBLE items (`code/game/objects/obj_defense.dm:9-10`), so the armour takes no integrity damage and does not break through the damage path.

* Health / armour: `max_integrity` 250 (armor.dm:10, inherited). `armor`: melee 0, bullet 0, laser 0, energy 0, bomb 0, bio 0, rad 0, fire 100, acid 100, wound 0 (reactive_armour.dm:36). Cold protection on CHEST and GROIN down to 160 K and heat protection on CHEST and GROIN up to 600 K (armor.dm:4-7, inherited).

* Power: none.

* Spawn sites: `code/game/objects/structures/crates_lockers/closets/secure/scientist.dm:23` (`new /obj/item/clothing/suit/armor/reactive/teleport(src)`) and `code/game/gamemodes/objective_items.dm:87` (`targetitem` for an objective). Not counted on BoxStation in our inventory.

* Gotchas:
  * The message at reactive_armour.dm:79 says the armour is "shutting itself off in the process!", but no line in `hit_reaction` (reactive_armour.dm:71-99) sets `active = 0`. Only `emp_act` does (reactive_armour.dm:58). As the code reads, the armour stays active after a teleport. The wording is the only thing that says it switches off.
  * The "still recharging" branch returns with no value (reactive_armour.dm:78), while the failed roll returns 0 (reactive_armour.dm:73, 99). Both mean no block; the caller that reads the return value was not traced.
  * The reactive armour's `armor` list drops the armour parent's values to 0 (reactive_armour.dm:36 vs armor.dm:12). The only protection against melee, bullet and laser is the chance-based teleport, and against fire and acid the 100 ratings.
  * Reactive armour is 250 integrity but INDESTRUCTIBLE, so the integrity figure has no effect on it.
  * Teleporting uses `forceMove` to a random turf in a 6-tile radius (reactive_armour.dm:82-95). The only turf tests are `T.density` and the map-edge margin (reactive_armour.dm:83-88). No check for space, lava or hazards appears in these lines.

---

## Reactive armour shell: `/obj/item/reactive_armour_shell`   (`code/modules/clothing/suits/reactive_armour.dm:1`)

This is the item the protolathe makes. It is the step between the design and the armour. Not on the list, documented here because it is the only construction path for the teleport armour.

| var | value | file:line |
|---|---|---|
| `name` | `"reactive armour shell"` | reactive_armour.dm:2 |
| `desc` | `"An experimental suit of armour, awaiting installation of an anomaly core."` | reactive_armour.dm:3 |
| `icon_state` | `"reactiveoff"` | reactive_armour.dm:4 |
| `icon` | `'icons/obj/clothing/suits.dmi'` | reactive_armour.dm:5 |
| `w_class` | WEIGHT_CLASS_BULKY = 4 | reactive_armour.dm:6 |

`attackby(obj/item/I, mob/user, params)` (reactive_armour.dm:8-24):

| held item | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| any item | always | none | none | `..()` first (reactive_armour.dm:9) |
| anomaly signaler `/obj/item/assembly/signaler/anomaly` | `istype(I, ...)` (reactive_armour.dm:16) | none | `"<span class='notice'>You insert [A] into the chest plate, and the armour gently hums to life.</span>"` (reactive_armour.dm:21) | armour type from `anomaly_armour_types[A.anomaly_type]` (reactive_armour.dm:18). Creates it at the shell's turf (reactive_armour.dm:22), `qdel(src)` (reactive_armour.dm:23), `qdel(A)` (reactive_armour.dm:24) |

Core-to-armour map (`static var/list/anomaly_armour_types`, reactive_armour.dm:10-14):

| anomaly type (the key) | armour created | file:line |
|---|---|---|
| `/obj/effect/anomaly/grav` | `/obj/item/clothing/suit/armor/reactive/repulse` | reactive_armour.dm:11 |
| `/obj/effect/anomaly/flux` | `/obj/item/clothing/suit/armor/reactive/tesla` | reactive_armour.dm:12 |
| `/obj/effect/anomaly/bluespace` | `/obj/item/clothing/suit/armor/reactive/teleport` | reactive_armour.dm:13 |
| any other type | `/obj/item/clothing/suit/armor/reactive/stealth` (fallback) | reactive_armour.dm:19-20 |

Health: no own values. Shell `max_integrity` is the item default 200 (items.dm:57). Power: none.
Gotcha: the armour is made only from a signaler whose `anomaly_type` is in the table. Anything else gives stealth armour, with a comment that it avoids cheating the player (reactive_armour.dm:20).

# gap-items-02, part 9: coverage

Every path on `docs/tg/_todo3/gap-items-02.txt` is documented in parts 1 to 8, one entry each, with values taken from its own type definition or, for the one type with none, from its nearest ancestor. Parts 1 to 8 cite the tree as `code/...` relative to `_src/tg2020`.

## Coverage

* list entries: 28
* documented with real data: 28 (27 from their own type definition; 1 from its nearest ancestor, see below)
* marked NOT FOUND: 0
* one line per path without an own definition, exact `tgwhere` output:

  `/obj/item/clothing/head/helmet/space/emergency  NO OWN DEFINITION (it may be a map-only variant or macro-made type); nearest defined ancestor /obj/item/clothing/head/helmet/space  code/modules/clothing/spacesuits/_spacesuits.dm:5`

  A whole-tree `grep` for `space/emergency` in `_src/tg2020` also returns no match, so the type is not defined anywhere in the tree.

