# gap-items-03 part 1: suits and uniforms (TG 2020 tree, `_src/tg2020`)

Scope: outer suits and jumpsuits from `gap-items-03.txt`. Numbers are raw (deciseconds where a delay, as written in the DM). Citations are relative to the tree root.

## Parent classes (documented once; children below cite these)

### /obj/item (base of every item)   (`code/game/objects/items.dm:10`)
- Vars inherited when a type does not set them: `w_class = WEIGHT_CLASS_NORMAL` (`code/game/objects/items.dm:77`), `slot_flags = 0` (`:79`), `body_parts_covered = 0` (`:108`), `permeability_coefficient = 1` (`:112`), `siemens_coefficient = 1` (`:114`), `slowdown = 0` (`:116`), `equip_delay_self = 0` (`:122`), `equip_delay_other = 20` (`:124`), `strip_delay = 40` (`:126`), `max_integrity = 200` (`code/game/objects/items.dm:57`).
- `force = 0`, `damtype = BRUTE` come from `/obj` (`code/game/objects/objs.dm:8-9`). `throwforce = 0`, `throw_range = 7` come from `/atom/movable` (`code/game/atoms_movable.dm:40`, `:11`).

### /obj/item/clothing   (`code/modules/clothing/clothing.dm:1`)
- `name = "clothing"` (`code/modules/clothing/clothing.dm:2`), `resistance_flags = FLAMMABLE` (`:3`), `max_integrity = 200` (`:4`), `integrity_failure = 0.4` (`:5`).
- No `strip_delay` / `equip_delay_other` set here or in `_suits.dm` / `_under.dm` (grep of all three files), so clothing inherits the `/obj/item` values 40 and 20 (`code/game/objects/items.dm:126`, `:124`).
- Vars added (defaults): `flash_protect = FLASH_PROTECTION_NONE` (`:9`), `tint = 0` (`:10`), `clothing_flags = NONE` (`:26`), `repairable_by = /obj/item/stack/sheet/cloth` (`:29`), `dynamic_hair_suffix = ""` (`:41`).

### /obj/item/clothing/suit   (`code/modules/clothing/suits/_suits.dm:1`)
- `icon = 'icons/obj/clothing/suits.dmi'` (`:2`), `name = "suit"` (`:3`), `fire_resist = T0C+100` (`:4`).
- `allowed = list(/obj/item/tank/internals/emergency_oxygen, /obj/item/tank/internals/plasmaman)` (`:5`) is the default suit-storage list; a child that sets `allowed` replaces it.
- `armor = list("melee" = 0, "bullet" = 0, "laser" = 0,"energy" = 0, "bomb" = 0, "bio" = 0, "rad" = 0, "fire" = 0, "acid" = 0)` (`:6`).
- `slot_flags = ITEM_SLOT_OCLOTHING` (`:9`): outer-clothing slot.
- `limb_integrity = 0` (`:13`).
- Procs defined: `worn_overlays` (`:16-29`): shows `damaged[blood_overlay_type]` when damaged, `[blood_overlay_type]blood` when blood DNA is present, and the accessory overlay when `U.attached_accessory.above_suit`.

### /obj/item/clothing/under   (`code/modules/clothing/under/_under.dm:1`)
- `name = "under"` (`:2`), `worn_icon = 'icons/mob/clothing/under/default.dmi'` (`:4`).
- `body_parts_covered = CHEST|GROIN|LEGS|ARMS` (`:5`), `permeability_coefficient = 0.9` (`:6`), `slot_flags = ITEM_SLOT_ICLOTHING` (`:7`).
- `armor = list("melee" = 0, "bullet" = 0, "laser" = 0,"energy" = 0, "bomb" = 0, "bio" = 0, "rad" = 0, "fire" = 0, "acid" = 0, "wound" = 5)` (`:8`).
- `limb_integrity = 30` (`:12`), `fitted = FEMALE_UNIFORM_FULL` (`:13`), `has_sensor = HAS_SENSORS` (`:14`), `random_sensor = TRUE` (`:15`), `sensor_mode = NO_SENSORS` (`:16`), `can_adjust = TRUE` (`:17`), `adjusted = NORMAL_STYLE` (`:18`), `alt_covers_chest = FALSE` (`:19`).
- `Initialize` (`:53-57`): when `random_sensor` is TRUE, `sensor_mode = pick(SENSOR_OFF, SENSOR_LIVING, SENSOR_LIVING, SENSOR_VITALS, SENSOR_VITALS, SENSOR_VITALS, SENSOR_COORDS, SENSOR_COORDS)`. So a uniform's suit sensor mode is random at spawn (inferred from the pick list; the sensor modes are not listed in the notes).
- `attackby` (`:35-43`): with `has_sensor == BROKEN_SENSORS` and a cable coil, `C.use(1)`, sensors restored: `"<span class='notice'>You repair the suit sensors on [src] with [C].</span>"` (`:40`). Otherwise accessory attach, then `..()`.
- `update_clothes_damaged_state` (`:45-51`): damaged uniform sets `has_sensor = BROKEN_SENSORS` when it had sensors.

### /obj/item/clothing/under/color   (`code/modules/clothing/under/color.dm:1`)
- `desc = "A standard issue colored jumpsuit. Variety is the spice of life!"` (`:2`), `dying_key = DYE_REGISTRY_UNDER` (`:3`, value `"under"`, `code/__DEFINES/dye_keys.dm:1`), `icon = 'icons/obj/clothing/under/color.dmi'` (`:4`), `worn_icon = 'icons/mob/clothing/under/color.dmi'` (`:5`).

### /obj/item/clothing/under/misc   (`code/modules/clothing/under/miscellaneous.dm:1`)
- `icon = 'icons/obj/clothing/under/misc.dmi'` (`:2`), `worn_icon = 'icons/mob/clothing/under/misc.dmi'` (`:3`). Nothing else set on the parent.

### /obj/item/clothing/suit/space   (`code/modules/clothing/spacesuits/_spacesuits.dm:27`)
- The only parent with real behaviour for the space-suit entry below. Full detail under that entry.

---

## Suits

### judge's robe  `/obj/item/clothing/suit/judgerobe`   (`code/modules/clothing/suits/miscellaneous.dm:82`)
- A plain outer-clothing robe; no procs of its own.
- Key vars (all set on the type unless marked "from parent"):
  - `name = "judge's robe"` (`code/modules/clothing/suits/miscellaneous.dm:83`)
  - `desc = "This robe commands authority."` (`:84`)
  - `icon_state = "judge"` (`:85`), `inhand_icon_state = "judge"` (`:86`)
  - `body_parts_covered = CHEST|GROIN|LEGS|ARMS` (`:87`)
  - `allowed = list(/obj/item/storage/fancy/cigarettes, /obj/item/stack/spacecash)` (`:88`). This REPLACES the `/obj/item/clothing/suit` default (`code/modules/clothing/suits/_suits.dm:5`), so it can hold a cigarette packet or spacecash in suit storage, and not the emergency oxygen or plasmaman tanks.
  - `flags_inv = HIDEJUMPSUIT` (`:89`)
  - `armor`: from `/obj/item/clothing/suit`, every value `0` (`code/modules/clothing/suits/_suits.dm:6`)
  - `slot_flags = ITEM_SLOT_OCLOTHING`: from `/obj/item/clothing/suit` (`code/modules/clothing/suits/_suits.dm:9`)
  - `w_class`: from `/obj/item` = `WEIGHT_CLASS_NORMAL` (`code/game/objects/items.dm:77`)
  - `strip_delay`: from `/obj/item` = 40 (`code/game/objects/items.dm:126`); `equip_delay_other`: from `/obj/item` = 20 (`:124`)
  - `max_integrity = 200`, `resistance_flags = FLAMMABLE`: from `/obj/item/clothing` (`code/modules/clothing/clothing.dm:3-4`)
  - `force = 0`, `throwforce = 0`: from `/obj` and `/atom/movable` (see parent block)
  - `permeability_coefficient`: from `/obj/item` = 1 (`code/game/objects/items.dm:112`); `slowdown`: 0 (`:116`); no `cold_protection`, `heat_protection`, `clothing_flags` set on the type, so none (inherited default 0 / NONE).
- Interactions: no `attack_self`, `afterattack`, `attackby`, or `interact` defined on the type or `/obj/item/clothing/suit`. Default item behaviour only.
- Contents: none. Suit storage holds items matching `allowed` above.
- Gotchas: `allowed` replaces the default list, so the judge's robe does not accept the emergency oxygen tank that other suits accept (`code/modules/clothing/suits/miscellaneous.dm:88` vs `_suits.dm:5`).

### space suit (emergency variant)  `/obj/item/clothing/suit/space/emergency`   (NO OWN DEFINITION; nearest defined ancestor `code/modules/clothing/spacesuits/_spacesuits.dm:27`)
- Own definition: NOT FOUND in `code/` or `_maps/`. Searched: `grep "clothing/suit/space/emergency"` across `_src/tg2020` returned no hits; `tools/tgwhere.py` reports `NO OWN DEFINITION`. It is treated as a map-only or macro-made type `(inferred)`. The list gives no BoxStation count for it.
- It therefore takes every value from `/obj/item/clothing/suit/space`, which is documented here as the parent. Name is inherited: `name = "space suit"` (`code/modules/clothing/spacesuits/_spacesuits.dm:28`).

#### Parent: /obj/item/clothing/suit/space   (`code/modules/clothing/spacesuits/_spacesuits.dm:27`)
- What it is: a pressure suit with an optional battery-powered thermal regulator. Its own description: `"A suit that protects against low pressure environments. Has a big 13 on the back."` (`:29`).
- Key vars:

| var | value | file:line |
|---|---|---|
| `name` | `"space suit"` | `_spacesuits.dm:28` |
| `desc` | `"A suit that protects against low pressure environments. Has a big 13 on the back."` | `:29` |
| `icon_state` | `"spaceold"` | `:30` |
| `inhand_icon_state` | `"s_suit"` | `:31` |
| `w_class` | `WEIGHT_CLASS_BULKY` | `:32` |
| `gas_transfer_coefficient` | `0.01` | `:33` |
| `permeability_coefficient` | `0.02` | `:34` |
| `clothing_flags` | `STOPSPRESSUREDAMAGE \| THICKMATERIAL` | `:35` |
| `body_parts_covered` | `CHEST\|GROIN\|LEGS\|FEET\|ARMS\|HANDS` | `:36` |
| `allowed` | `list(/obj/item/flashlight, /obj/item/tank/internals)` | `:37` |
| `slowdown` | `1` | `:38` |
| `armor` | `melee 0, bullet 0, laser 0, energy 0, bomb 0, bio 100, rad 50, fire 80, acid 70` | `:39` |
| `flags_inv` | `HIDEGLOVES\|HIDESHOES\|HIDEJUMPSUIT` | `:40` |
| `cold_protection` | `CHEST \| GROIN \| LEGS \| FEET \| ARMS \| HANDS` | `:41` |
| `min_cold_protection_temperature` | `SPACE_SUIT_MIN_TEMP_PROTECT_OFF` = `72` (K) while the regulator is off; `SPACE_SUIT_MIN_TEMP_PROTECT` = `2.0` (K) when on | `:42`, `:206`; values `code/__DEFINES/atmospherics.dm:160`, `:162` |
| `heat_protection` | `CHEST\|GROIN\|LEGS\|FEET\|ARMS\|HANDS` | `:43` |
| `max_heat_protection_temperature` | `SPACE_SUIT_MAX_TEMP_PROTECT` = `1500` (K) | `:44`; `code/__DEFINES/atmospherics.dm:163` |
| `strip_delay` | `80` (ds) | `:45` |
| `equip_delay_other` | `80` (ds) | `:46` |
| `resistance_flags` | `NONE` | `:47` |
| `actions_types` | `list(/datum/action/item_action/toggle_spacesuit)` | `:48` |
| `temperature_setting` | `BODYTEMP_NORMAL` = `310.15` (K) | `:49`; `code/__DEFINES/atmospherics.dm:133` |
| `cell` | `/obj/item/stock_parts/cell/high` (created in `Initialize`) | `:50`, `:54-57` |
| `cell_cover_open` | `FALSE` | `:51` |
| `thermal_on` | `FALSE` | `:52` |
| `slot_flags` | `ITEM_SLOT_OCLOTHING` (from `_suits.dm:9`, not set here) | |
| `fire_resist` | `T0C+100` (from `_suits.dm:4`) | |

- Interactions (proc, condition, delay, messages verbatim, result):

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| crowbar (`TOOL_CROWBAR`) | any | none | none | `toggle_spacesuit_cell(user)` (`_spacesuits.dm:139-140`) |
| crowbar: `toggle_spacesuit_cell` | any | none | `"<span class='notice'>You [cell_cover_open ? "open" : "close"] the cell cover on \the [src].</span>"` (`:195`) | flips `cell_cover_open` (`:194`) |
| screwdriver (`TOOL_SCREWDRIVER`) | `cell_cover_open` | none | input prompt `"What temperature would you like to set the thermal regulator to? ([range_low]-[range_high] degrees celcius)"` (`:149-150`); success `"<span class='notice'>You see the readout change to [deg_c] c.</span>"` (`:153`) | sets `temperature_setting = round(T0C + deg_c, 0.1)` if in range (`:151-152`). Range 20 to 45 C (`:143-144`); if `EMAGGED`, -20 to 120 C (`:146-147`) |
| stock cell (`/obj/item/stock_parts/cell`) | `cell_cover_open` and no cell installed | none | `"<span class='warning'>[src] already has a cell installed.</span>"` if already one (`:157`); success `"<span class='notice'>You successfully install \the [cell] into [src].</span>"` (`:161`) | `user.transferItemToLoc(I, src)` then `cell = I` (`:159-160`) |
| `AltClick` | `user.canUseTopic(src, BE_CLOSE, ismonkey(user))` | none | as `toggle_spacesuit_cell` | toggles cover (`:166-169`) |
| `CtrlClick` | cover open and cell present | none | none | `remove_cell(user)` (`:172-176`) |
| `attack_self` (empty hand use on the suit) | cover open and cell present (checked in `remove_cell`) | none | `"<span class='notice'>[user] removes \the [cell] from [src]!</span>"` / `"<span class='notice'>You remove [cell].</span>"` (`:186-187`) | `remove_cell`: cell goes to `user.put_in_hands(cell)` (`:189`), `cell = null` (`:190`) (`:180-181`) |
| `emag_act` | not already emagged | none | `"<span class='warning'>You emag [src], overwriting thermal regulator restrictions.</span>"` (`:213`), `playsound(src, "sparks", 50, TRUE)` (`:215`) | `obj_flags |= EMAGGED` (`:212`); the screwdriver range widens to -20 to 120 C (`:145-147`) |
| action button "Toggle Suit Thermal Regulator" (`/datum/action/item_action/toggle_spacesuit`, `code/datums/action.dm:275-276`) | `Trigger` calls `suit.toggle_spacesuit()` (`code/datums/action.dm:288-292`) | none | none | `toggle_spacesuit`: turning on needs `cell` and `cell.charge >= THERMAL_REGULATOR_COST` (`_spacesuits.dm:202`); flips `thermal_on` (`:205`); fires `COMSIG_SUIT_SPACE_TOGGLE` (`:207`) |

- Construction chain: none in this file. The suit is not built from parts here; `_spacesuits.dm` only sets up the cell.
- Deconstruction chain: the cell is removed via cover (crowbar or AltClick), then `attack_self` or `CtrlClick` (see table). On `Destroy` the cell is `QDEL_NULL`ed (`_spacesuits.dm:103-105`).
- Drops: none defined in this file (no `new` line creates items on destruction).
- Thermal regulator behaviour (`process`, `_spacesuits.dm:75-100`): runs only while worn in `ITEM_SLOT_OCLOTHING` (`:60-64`, `START_PROCESSING` in `equipped`). Each tick with `thermal_on`: `cell.use(THERMAL_REGULATOR_COST)` (`:92`), `THERMAL_REGULATOR_COST` = `18` (per tick, `:1`). If no cell or not enough charge, `toggle_spacesuit()` turns it off (`:86-95`). Heat: `user.adjust_bodytemperature((temperature_setting - user.bodytemperature), use_steps=TRUE, capped=FALSE)` (`:99`).
- Examine text (`:124-135`): `"The thermal regulator is [thermal_on ? "on" : "off"] and the temperature is set to ..."`, `"The power meter shows [cell ? "[round(cell.percent(), 0.1)]%" : "!invalid!"] charge remaining."`, plus cover open messages `"The cell cover is open exposing the cell and setting knobs."`, `"The slot for a cell is empty."`, `"\The [cell] is firmly in place."`.
- EMP (`:244-249`): `cell.emp_act(severity)` unless `EMP_PROTECT_CONTENTS`.
- Health / armor (the suit's own values): `max_integrity = 200` (from `/obj/item`), `armor` as in the table. `armour_penetration` not set (0).
- Power: the cell is `/obj/item/stock_parts/cell/high` (`code/modules/power/cell.dm:249`), `maxcharge = 10000` (`code/modules/power/cell.dm:252`), `name = "high-capacity power cell"` (`:250`). Regulator draw `THERMAL_REGULATOR_COST` = 18 units per tick (`_spacesuits.dm:1`, `:92`). Unit of the cell charge is the cell's own unit (not converted here). The tick rate of `SSobj` processing is not stated in `_spacesuits.dm`; see the open questions below.
- Gotchas:
  - The regulator only heats while the cover is closed and the cell charge covers each tick (`:202`).
  - `min_cold_protection_temperature` drops from 72 K to 2.0 K when the regulator turns on (`:206`), so cold protection is tied to the regulator state.
  - Emagging widens the temperature range (see table) and sets `EMAGGED` (`:212`).
  - `attackby` returns early for crowbar/screwdriver/cell cases (`:139-163`); any other item falls through to `..()`.
  - Sets `flags_inv = HIDEGLOVES|HIDESHOES|HIDEJUMPSUIT` (`:40`), so gloves, shoes and jumpsuit are hidden.

### space suit (emergency variant) — summary for the port
- Use the parent values above. The variant has no own numbers (`(inferred)`: it is a map or macro alias of the parent, since no code defines it).

---

## Uniforms (jumpsuits)

### rainbow jumpsuit  `/obj/item/clothing/under/color/rainbow`   (`code/modules/clothing/under/color.dm:219`)
- A multi-colored jumpsuit. Fixed look, not adjustable.
- Key vars:
  - `name = "rainbow jumpsuit"` (`code/modules/clothing/under/color.dm:220`)
  - `desc = "A multi-colored jumpsuit!"` (`:221`)
  - `icon_state = "rainbow"` (`:222`), `inhand_icon_state = "rainbow"` (`:223`)
  - `can_adjust = FALSE` (`:224`): the jumpsuit cannot be rolled down (`_under.dm:17` default is TRUE).
  - `dying_key = DYE_REGISTRY_UNDER` (from `/obj/item/clothing/under/color`, `code/modules/clothing/under/color.dm:3`).
  - `body_parts_covered = CHEST|GROIN|LEGS|ARMS`, `slot_flags = ITEM_SLOT_ICLOTHING`, `armor` (all 0, wound 5), `limb_integrity = 30`, `permeability_coefficient = 0.9`: all from `/obj/item/clothing/under` (`code/modules/clothing/under/_under.dm:5`, `:7`, `:8`, `:12`, `:6`).
  - `has_sensor = HAS_SENSORS`, `random_sensor = TRUE`: from `_under.dm:14-15`; so sensor mode is random at spawn (`_under.dm:53-57`).
  - `fitted = FEMALE_UNIFORM_FULL` (`_under.dm:13`).
  - `w_class`, `strip_delay` (40), `equip_delay_other` (20): from `/obj/item` (`code/game/objects/items.dm:77`, `:126`, `:124`).
- Interactions: none defined on the type. Uniform `attackby` (cable coil sensor repair, accessory attach) from `_under.dm:35-43`.
- Contents: none.
- Gotchas: no colour switch or other proc is defined on the type. The only dye hook is `dying_key` (from `code/modules/clothing/under/color.dm:3`). `can_adjust = FALSE` (`:224`) removes the roll-down option.

### assistant's formal uniform  `/obj/item/clothing/under/misc/assistantformal`   (`code/modules/clothing/under/miscellaneous.dm:77`)
- A formal assistant uniform. Fixed, not adjustable.
- Key vars:
  - `name = "assistant's formal uniform"` (`code/modules/clothing/under/miscellaneous.dm:78`)
  - `desc = "An assistant's formal-wear. Why an assistant needs formal-wear is still unknown."` (`:79`)
  - `icon_state = "assistant_formal"` (`:80`), `inhand_icon_state = "gy_suit"` (`:81`)
  - `can_adjust = FALSE` (`:82`)
  - `icon = 'icons/obj/clothing/under/misc.dmi'`, `worn_icon = 'icons/mob/clothing/under/misc.dmi'`: from `/obj/item/clothing/under/misc` (`code/modules/clothing/under/miscellaneous.dm:2-3`).
  - `has_sensor` and `random_sensor`: NOT set on the type, so `HAS_SENSORS` and random (`code/modules/clothing/under/_under.dm:14-15`). The burial variant at `miscellaneous.dm:67` sets `has_sensor = NO_SENSORS`; this one does not.
  - `body_parts_covered`, `slot_flags`, `armor`, `limb_integrity`: from `/obj/item/clothing/under` (`_under.dm:5`, `:7`, `:8`, `:12`).
  - `w_class`, `strip_delay`, `equip_delay_other`: from `/obj/item` (`code/game/objects/items.dm:77`, `:126`, `:124`).
- Interactions: none defined on the type. Uniform `attackby` from `_under.dm:35-43`.
- Contents: none.
- Gotchas: `can_adjust = FALSE` (`code/modules/clothing/under/miscellaneous.dm:82`) removes the roll-down option. Sensors are on and randomised at spawn because `has_sensor` and `random_sensor` are not overridden (`_under.dm:14-15`, `:53-57`).

## NOT FOUND / open questions (this part)
- `/obj/item/clothing/suit/space/emergency`: NOT FOUND as its own definition (see entry). Parent values used.
- Suit `thermal regulator` tick rate in `SSobj`: not stated in `_spacesuits.dm` (NOT FOUND in this file).
- `/obj/item/clothing/under` sensor mode names (`SENSOR_OFF` etc.) are defined elsewhere; only the pick list is given here.

### Tally (part 1)
- Entries in this part: 4 (judge's robe, space suit emergency, rainbow jumpsuit, assistant's formal uniform).
- Documented with real data: 4. NOT FOUND as own definition: 1 (`/obj/item/clothing/suit/space/emergency`, resolved to parent).

# gap-items-03 part 2: coins (TG 2020 tree, `_src/tg2020`)

Scope: the five `/obj/item/coin/*` entries on the list. All five share one parent block; each child is a one-line material override. Numbers are raw.

## Parent: /obj/item/coin   (`code/modules/mining/ores_coins.dm:335`)

- What it is: a flippable currency coin. Its value is the sum of its material values (`code/modules/mining/ores_coins.dm:332-334`).
- Key vars (parent values; children inherit unless they say otherwise):

| var | value | file:line |
|---|---|---|
| `icon` | `'icons/obj/economy.dmi'` | `ores_coins.dm:336` |
| `name` | `"coin"` | `ores_coins.dm:337` |
| `icon_state` | `"coin"` (overwritten in `Initialize`, see below) | `:338` |
| `flags_1` | `CONDUCT_1` | `:339` |
| `force` | `1` | `:340` |
| `throwforce` | `2` | `:341` |
| `w_class` | `WEIGHT_CLASS_TINY` | `:342` |
| `custom_materials` | `list(/datum/material/iron = 400)` | `:343` |
| `material_flags` | `MATERIAL_ADD_PREFIX \| MATERIAL_COLOR \| MATERIAL_AFFECT_STATISTICS` | `:344` |
| `sideslist` | `list("heads","tails")` | `:346` |
| `cooldown` | `0` | `:347` |
| `value` | unset until `set_custom_materials` runs | `:348`, `:359-364` |
| `item_flags` | `NO_MAT_REDEMPTION` | `:350` |
| `desc` | not set on the type; `examine` appends `desc` only if set (`code/game/atoms.dm:535`) | |

- `NO_MAT_REDEMPTION` = `(1<<5)` (`code/__DEFINES/obj_flags.dm:24`): its own comment says it "Stops you from putting things like an RCD or other items into an ORM or protolathe for materials." The coin code gives it at `ores_coins.dm:350`, with a comment about money being worth more extrinsically than intrinsically.
- `Initialize` (`ores_coins.dm:352-357`): `coinflip = pick(sideslist)`, `icon_state = "coin_[coinflip]"`, random `pixel_x = rand(0,16)-8`, `pixel_y = rand(0,8)-8`.
- `set_custom_materials` (`:359-364`): after the material is applied, `value = 0`, then for each material `value += M.value_per_unit * custom_materials[M]`. So `value` is in credits. Value per unit is in `code/datums/materials/basemats.dm` (lines cited per child).
- Name at runtime: `material_flags` includes `MATERIAL_ADD_PREFIX`. On apply, `on_applied` sets `source.name = "[name] [source.name]"` (`code/datums/materials/_material.dm:57-58`), and `set_custom_materials` calls `on_applied` at init (`code/game/atoms.dm:188`, `:1339-1352`). So the in-game name is "`<material> coin`" (inferred from these lines, not stated in the coin code).
- Colour: `MATERIAL_COLOR` applies the material's `color` as a fixed colour (`code/datums/materials/_material.dm:48-50`).

### Interactions (parent, apply to every coin)

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| `attack_self` (use in hand) | `cooldown < world.time` and no string attached | cooldown `15` (`ores_coins.dm:425`); `sleep(15)` (`:431`) | if a string is attached: `"<span class='warning'>The coin won't flip very well with something attached!</span>"` (`:423`) | returns FALSE (`:424`), no flip |
| `attack_self` flip | (as above) | flick `"coin_[coinflip]_flip"` (`:426`) | `"<span class='notice'>[user] flips [src]. It lands on [coinflip].</span>"` and `"<span class='notice'>You flip [src]. It lands on [coinflip].</span>"` and hear `"<span class='hear'>You hear the clattering of loose change.</span>"` (`:433-435`) | `coinflip = pick(sideslist)` (`:427`); `icon_state = "coin_[coinflip]"` (`:428`); sound `'sound/items/coinflip.ogg'` vol 50 (`:429`); only shows the message if the coin did not move during the sleep and the user is not incapacitated (`:430-432`); returns TRUE (`:436`) |
| `attackby` with `/obj/item/stack/cable_coil` | no string yet, 1 cable available | none | `"<span class='notice'>You attach a string to the coin.</span>"` (`:402`) | `CC.use(1)` (`:399`); overlay `"coin_string_overlay"` (`:400`); `string_attached = 1` (`:401`) |
| `attackby` cable coil | string already attached | none | `"<span class='warning'>There already is a string attached to this coin!</span>"` (`:396`) | nothing |
| `attackby` cable coil | no cable length | none | `"<span class='warning'>You need one length of cable to attach a string to the coin!</span>"` (`:404`) | nothing |
| `attackby` other | (not cable) | none | none | `..()` (`:407`) |
| wirecutters (`wirecutter_act`) | string attached | none | `"<span class='notice'>You detach the string from the coin.</span>"` (`:417`) | drops `new /obj/item/stack/cable_coil(drop_location(), 1)` (`:414`); `overlays = list()` (`:415`); `string_attached = null` (`:416`) |
| `examine` | any | none | `"<span class='info'>It's worth [value] credit\s.</span>"` (`:390`) | none |
| `get_item_credit_value` | any | none | none | returns `value` (`:366-367`) |
| `suicide_act` | any | `addtimer(..., 10)` (`:374`) | `"<span class='suicide'>[user] contemplates suicide with \the [src]!</span>"` (`:370`); if the flip fails: `"<span class='suicide'>[user] couldn't flip \the [src]!</span>"` (`:372`) | returns `SHAME` (`:373`) on a failed flip; else `MANUAL_SUICIDE_NONLETHAL` (`:375`) |
| `manual_suicide` (after the 10 ds timer) | `sideslist.Find(coinflip) == 2` (tails) | none | `"<span class='suicide'>\the [src] lands on [coinflip]! [user] promptly falls over, dead!</span>"` (`:380`) | `user.adjustOxyLoss(200)` (`:381`), `user.death(0)` (`:382`), `user.set_suicide(TRUE)` (`:383`), `user.suicide_log()` (`:384`) |
| `manual_suicide` | heads | none | `"<span class='suicide'>\the [src] lands on [coinflip]! [user] keeps on living!</span>"` (`:386`) | nothing |

- Construction / deconstruction chains: none (coins are not built). String removal is the only deconstruction (wirecutters, above).
- Drops: none on destruction defined on the parent (NOT FOUND in this file).
- Health / armor: `max_integrity` from `/obj/item` = 200 (`code/game/objects/items.dm:57`).
- Power: none.

## Children

### coin (gold)  `/obj/item/coin/gold`   (`code/modules/mining/ores_coins.dm:438`)
- Key vars: `custom_materials = list(/datum/material/gold = 400)` (`ores_coins.dm:439`). Replaces the iron default (`:343`), so it is 400 units of gold and nothing else.
- Name: inherits `"coin"` (`:337`); runtime name `"gold coin"` (inferred, see parent).
- Material: `name = "gold"` (`code/datums/materials/basemats.dm:40`), `color` (`basemats.dm:42`), `value_per_unit = 0.0625` (`basemats.dm:46`).
- Value: `0.0625 * 400 = 25` credits (computed by the parent formula at `ores_coins.dm:359-364`; `(inferred)` for the arithmetic, the inputs are cited).
- Interactions and drops: as parent.
- Gotchas: `NO_MAT_REDEMPTION` (`:350`) applies, so it cannot be melted down for materials.

### coin (silver)  `/obj/item/coin/silver`   (`code/modules/mining/ores_coins.dm:441`)
- Key vars: `custom_materials = list(/datum/material/silver = 400)` (`ores_coins.dm:442`).
- Name: `"coin"` (`:337`); runtime `"silver coin"` (inferred).
- Material: `name = "silver"` (`basemats.dm:30`), `color` (`basemats.dm:32`), `value_per_unit = 0.025` (`basemats.dm:35`).
- Value: `0.025 * 400 = 10` credits (inferred arithmetic).
- Interactions and drops: as parent.
- Gotchas: as gold.

### coin (diamond)  `/obj/item/coin/diamond`   (`code/modules/mining/ores_coins.dm:444`)
- Key vars: `custom_materials = list(/datum/material/diamond = 400)` (`ores_coins.dm:445`).
- Name: `"coin"` (`:337`); runtime `"diamond coin"` (inferred).
- Material: `name = "diamond"` (`basemats.dm:52`), `color` (`basemats.dm:54`), `value_per_unit = 0.25` (`basemats.dm:58`).
- Value: `0.25 * 400 = 100` credits (inferred arithmetic).
- Interactions and drops: as parent.
- Gotchas: as gold. Highest value of the five.

### coin (plasma)  `/obj/item/coin/plasma`   (`code/modules/mining/ores_coins.dm:447`)
- Key vars: `custom_materials = list(/datum/material/plasma = 400)` (`ores_coins.dm:448`).
- Name: `"coin"` (`:337`); runtime `"plasma coin"` (inferred).
- Material: `name = "plasma"` (`basemats.dm:83`), `color` (`basemats.dm:85`), `value_per_unit = 0.1` (`basemats.dm:88`). The plasma material also defines `on_applied` and `on_removed` (`code/datums/materials/basemats.dm:92`, `:98`). They run when the coin gets its material; their effect is not documented in this entry.
- Value: `0.1 * 400 = 40` credits (inferred arithmetic).
- Interactions and drops: as parent.
- Gotchas: the material procs at `basemats.dm:92` and `:98` are a side effect of the material, not of the coin code.

### coin (iron)  `/obj/item/coin/iron`   (`code/modules/mining/ores_coins.dm:483`)
- No body: the type is an empty block, so every value comes from `/obj/item/coin` (`ores_coins.dm:335-350`).
- Key vars (inherited): `custom_materials = list(/datum/material/iron = 400)` (`ores_coins.dm:343`).
- Name: `"coin"` (`:337`); runtime `"iron coin"` (inferred).
- Material: `name = "iron"` (`code/datums/materials/basemats.dm:3`), `color = "#878687"` (`basemats.dm:5`), `value_per_unit = 0.0025` (`basemats.dm:8`).
- Value: `0.0025 * 400 = 1` credit (inferred arithmetic). This is the default coin.
- Interactions and drops: as parent.
- Gotchas: the only coin with no `custom_materials` override; the other four replace the default.

### Tally (part 2)
- Entries in this part: 5 (coin/gold, coin/silver, coin/diamond, coin/plasma, coin/iron), plus the parent block.
- Documented with real data: 5. NOT FOUND: 0.

# gap-items-03 part 3: defibrillators (TG 2020 tree, `_src/tg2020`)

Scope: `/obj/item/defibrillator/loaded` and `/obj/item/defibrillator/compact/loaded`, plus their shared parent and the compact child. The paddles (`/obj/item/shockpaddles`) are a separate type not on this list; they are noted only where the defib depends on them. Numbers are raw (ds).

## Parent: /obj/item/defibrillator   (`code/game/objects/items/defib.dm:4`)

- What it is: a back-worn (or belt-worn, compact) unit with a detachable paddle set. Shocks and the revive are in the paddles; the unit holds the cell, the safety flag and the cooldown.
- Key vars:

| var | value | file:line |
|---|---|---|
| `name` | `"defibrillator"` | `defib.dm:5` |
| `desc` | `"A device that delivers powerful shocks to detachable paddles that resuscitate incapacitated patients."` | `:6` |
| `icon` | `'icons/obj/defib.dmi'` | `:7` |
| `icon_state` | `"defibunit"` | `:8` |
| `inhand_icon_state` | `"defibunit"` | `:9` |
| `slot_flags` | `ITEM_SLOT_BACK` | `:12` |
| `force` | `5` | `:13` |
| `throwforce` | `6` | `:14` |
| `w_class` | `WEIGHT_CLASS_BULKY` | `:15` |
| `actions_types` | `list(/datum/action/item_action/toggle_paddles)` | `:16` |
| `armor` | `melee 0, bullet 0, laser 0, energy 0, bomb 0, bio 0, rad 0, fire 50, acid 50` | `:17` |
| `paddle_type` | `/obj/item/shockpaddles` | `:19` |
| `on` | `FALSE` (paddles off the unit) | `:20` |
| `safety` | `TRUE` | `:21` |
| `powered` | `FALSE` (set in `update_power`) | `:22` |
| `cell` | `/obj/item/stock_parts/cell/high` (declared type) | `:24` |
| `combat` | `FALSE` | `:25` |
| `cooldown_duration` | `5 SECONDS` = `50` ds (`SECONDS` is `*10`, `code/__DEFINES/time.dm:41`) | `:26` |
| `max_integrity` | `200` (from `/obj/item`, `code/game/objects/items.dm:57`) | |

- Paddles (`/obj/item/shockpaddles`, `defib.dm:287`): `force = 0`, `throwforce = 6`, `w_class = WEIGHT_CLASS_BULKY`, `resistance_flags = INDESTRUCTIBLE` (`defib.dm:296-299`), `revivecost = 1000` (`defib.dm:301`). `revivecost` is what the unit needs to be `powered`.

### Interactions (parent; apply to both children)

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| `attack_hand`, unit in own hand, worn on back (`ITEM_SLOT_BACK`) | `user.get_item_by_slot(ITEM_SLOT_BACK) == src` | none | none | `ui_action_click()` = `toggle_paddles()` (`defib.dm:88-92`, `:84-85`) |
| `attack_hand`, unit in user's inventory, `slot_flags == ITEM_SLOT_BACK`, but not in the back slot | (else) | none | `"<span class='warning'>Put the defibrillator on your back first!</span>"` (`:94`) | nothing |
| `attack_hand`, unit in own hand, `ITEM_SLOT_BELT` | `get_item_by_slot(ITEM_SLOT_BELT) == src` | none | none | `ui_action_click()` (`:96-98`) |
| `attack_hand`, belt, not on belt | (else) | none | `"<span class='warning'>Strap the defibrillator's belt on first!</span>"` (`:100`) | nothing |
| `attack_hand` inside a `/obj/machinery/defibrillator_mount` | `istype(loc, /obj/machinery/defibrillator_mount)` | none | none | `ui_action_click()`; mount checks live in the mount file (`:102-103`) |
| action button "Toggle Paddles" (`/datum/action/item_action/toggle_paddles`) | any | none | none | `toggle_paddles()` (`:84-85`) |
| `toggle_paddles` (proc) with `on` becoming TRUE | `usr.put_in_hands(paddles)` succeeds | none | `"<span class='warning'>You need a free hand to hold the paddles!</span>"` if it fails (`:175`) | on fail: `on = FALSE` (`:174`), `update_power()`, return (`:176-177`). On success: paddles go to the hand (`:173`) |
| `toggle_paddles` with `on` becoming FALSE | | none | none | `remove_paddles(user)` (`:180`) |
| `attackby` with the paddles (`W == paddles`) | | none | none | `toggle_paddles()` (`:115-116`) |
| `attackby` with `/obj/item/stock_parts/cell` | `cell` already set | none | `"<span class='warning'>[src] already has a cell!</span>"` (`:120`) | nothing |
| `attackby` cell | `C.maxcharge < paddles.revivecost` | none | `"<span class='notice'>[src] requires a higher capacity cell.</span>"` (`:123`) | returns (`:124`) |
| `attackby` cell | fits, `transferItemToLoc` ok | none | `"<span class='notice'>You install a cell in [src].</span>"` (`:128`) | `cell = W` (`:127`), `update_power()` (`:129`) |
| `attackby` screwdriver (`TOOL_SCREWDRIVER`) | `cell` set | none | `"<span class='notice'>You remove the cell from [src].</span>"` (`:136`) | `cell.update_icon()`, `cell.forceMove(get_turf(src))` (`:133-134`), `cell = null` (`:135`), `update_power()` (`:137`) |
| `emag_act` | `safety` TRUE | none | `"<span class='warning'>You silently disable [src]'s safety protocols with the cryptographic sequencer.</span>"` (`:144`) | `safety = FALSE` (`:143`) |
| `emag_act` | `safety` FALSE | none | `"<span class='notice'>You silently enable [src]'s safety protocols with the cryptographic sequencer.</span>"` (`:147`) | `safety = TRUE` (`:146`) |
| EMP (`emp_act`) | cell present and not `EMP_PROTECT_CONTENTS` | none | none | `deductcharge(1000 / severity)` (`:151-152`) |
| EMP (`emp_act`), `EMP_PROTECT_SELF` not set | `safety` TRUE | none | `"<span class='notice'>[src] beeps: Safety protocols disabled!</span>"` (`:157`); sound `'sound/machines/defib_saftyOff.ogg'` (`:158`) | `safety = FALSE` (`:156`) |
| EMP, `EMP_PROTECT_SELF` not set | `safety` FALSE | none | `"<span class='notice'>[src] beeps: Safety protocols enabled!</span>"` (`:161`); sound `'sound/machines/defib_saftyOn.ogg'` (`:162`) | `safety = TRUE` (`:160`) |
| `equipped` | equipped into a slot other than its `slot_flags` slot (back or belt) | none | none | `remove_paddles(user)` and `update_power()` (`:188-192`) |
| `finish_charging` (run by `addtimer` in `cooldowncheck`, `:223-224`; the caller is not in this file) | cell charge `>= paddles.revivecost` | `cooldown_duration` (50 ds) before this runs | `"<span class='notice'>[src] beeps: Unit ready.</span>"` (`:229`); sound `'sound/machines/defib_ready.ogg'` (`:230`) | `paddles.cooldown = FALSE` (`:234`) |
| `finish_charging` | cell charge below `revivecost` | as above | `"<span class='notice'>[src] beeps: Charge depleted.</span>"` (`:232`); sound `'sound/machines/defib_failed.ogg'` (`:233`) | `paddles.cooldown = FALSE` (`:234`) |

- Construction chain: none defined on the unit (`defib.dm` has no crafting recipe). `CheckParts` (`defib.dm:79-82`) re-reads the cell from `contents` (`cell = locate(/obj/item/stock_parts/cell) in contents`) and then calls `update_power()`. Its caller is not in this file (`(inferred)`: the construction system).
- Deconstruction chain: the cell is removed with a screwdriver and dropped on the turf (`defib.dm:131-137`). Paddles can be removed by `toggle_paddles` or by `equipped` into another slot (`:188-192`).
- Drops: on `Destroy`, `remove_paddles(M)` if on, then `QDEL_NULL(paddles)` and `QDEL_NULL(cell)` (`defib.dm:204-210`). The cell and paddles are deleted, not dropped. Health breaking is not handled in this file (NOT FOUND here).
- Health / armor: `max_integrity = 200` (from `/obj/item`, `code/game/objects/items.dm:57`). `armor` fire 50, acid 50, others 0 (`defib.dm:17`).
- Power: `update_power` (`defib.dm:53-61`): `powered = TRUE` only if `cell.charge >= paddles.revivecost` (`revivecost = 1000`, `defib.dm:301`). `deductcharge(chrgdeductamt)` (`defib.dm:212-221`) uses `cell.use()`. The unit's own draw is not stated; the cell charge is in the cell's unit (`maxcharge` 10000, `code/modules/power/cell.dm:252`). Cell type and charge details are in the cell file, not converted here.
- `update_overlays` (`defib.dm:63-77`) shows `-paddles` when paddles are off, `-powered` and `-charge[ratio]` (ratio rounded up to steps of 25) when powered, `-nocell` without a cell, `-emagged` when `safety` is off.
- Gotchas:
  - `attack_hand` ignores the parent's return value (comment at `defib.dm:87`). When the unit is in the user's inventory it returns after the back/belt check (`:101`); otherwise it calls `..()` (`:104`).
  - The unit's own `attackby` falls back to `..()` for other items (`defib.dm:138-139`).
  - `cooldowncheck` is a single `addtimer` call (`defib.dm:223-224`); the cooldown is `cooldown_duration`.
  - EMP with `EMP_PROTECT_SELF` returns before toggling the safety (`defib.dm:153-154`).

## Child: /obj/item/defibrillator/loaded   (`code/game/objects/items/defib.dm:37`)

- What it is: the standard unit, shipped with a high-capacity cell.
- Key vars (set on the type): none beyond `Initialize`. Everything else inherited: `name = "defibrillator"` (`defib.dm:5`), `slot_flags = ITEM_SLOT_BACK` (`:12`), `w_class = WEIGHT_CLASS_BULKY` (`:15`), `force = 5` (`:13`), `throwforce = 6` (`:14`), `armor` (`:17`).
- Initialize (`defib.dm:37-41`): `. = ..()`, `cell = new(src)` (`:39`), `update_power()` (`:40`). The cell type is the declared `cell` type `/obj/item/stock_parts/cell/high` (`defib.dm:24`), so this is a high-capacity cell (`(inferred)`: BYOND `new()` uses the variable's declared type).
- Contents at start: one `/obj/item/stock_parts/cell/high` (`code/modules/power/cell.dm:249-253`: `name = "high-capacity power cell"`, `maxcharge = 10000`). The paddles are created by the parent's `Initialize` (`defib.dm:33`) as `new paddle_type(src)`, so the paddles are inside the unit.
- Interactions and drops: parent table.
- Gotchas: the parent `Initialize` (`defib.dm:31-35`) runs first, which creates the paddles; then this child sets the cell.

## Child: /obj/item/defibrillator/compact   (`code/game/objects/items/defib.dm:238`)

- What it is: the belt-worn version. No loaded cell on its own (see the next entry).
- Key vars (set on the type):
  - `name = "compact defibrillator"` (`defib.dm:239`)
  - `desc = "A belt-equipped defibrillator that can be rapidly deployed."` (`:240`)
  - `icon_state = "defibcompact"` (`:241`); `inhand_icon_state = "defibcompact"` (`:242`); `worn_icon_state = "defibcompact"` (`:243`)
  - `w_class = WEIGHT_CLASS_NORMAL` (`:244`, overrides the parent's BULKY)
  - `slot_flags = ITEM_SLOT_BELT` (`:245`, overrides the parent's BACK)
- `item_action_slot_check` (`defib.dm:247-249`): TRUE when `slot == user.getBeltSlot()`.
- Belt vs back: the parent's `attack_hand` branch for `ITEM_SLOT_BELT` (`defib.dm:96-100`) applies, since `slot_flags == ITEM_SLOT_BELT`.

## Child: /obj/item/defibrillator/compact/loaded   (`code/game/objects/items/defib.dm:251`)

- What it is: the compact unit with a high-capacity cell.
- Name: `"compact defibrillator"` inherited from `defib.dm:239`.
- Key vars: none set on the type beyond `Initialize` (`defib.dm:251-254`).
- Initialize: `. = ..()` then `cell = new(src)` (`defib.dm:253`) then `update_power()` (`:254`). The new cell is `/obj/item/stock_parts/cell/high` (see the loaded entry).
- Note: the compact child's `Initialize` is `/obj/item/defibrillator/compact/loaded/Initialize`, which is distinct from `/obj/item/defibrillator/loaded/Initialize` (`defib.dm:37`). It does not call the loaded child, so only the one cell is created.
- Interactions and drops: parent table.
- Gotchas: all compact children (`combat` and `nanotrasen`, `defib.dm:256-283`) inherit this and are not documented here (not on the list).

## NOT FOUND / open questions (this part)
- Health breaking for the defib unit: no `take_damage`/`broken` handling in `defib.dm` (NOT FOUND in this file).
- Unit's own power draw (W): not stated in `defib.dm` (NOT FOUND in this file). Cell capacity is given.
- Mount (`defibrillator_mount`) behaviour: NOT covered here (the file is referenced at `defib.dm:102-103`).

### Tally (part 3)
- Entries in this part: 2 on the list (`/obj/item/defibrillator/loaded`, `/obj/item/defibrillator/compact/loaded`).
- Documented with real data: 2. NOT FOUND: 0.

# gap-items-03 part 4: electronics circuits (TG 2020 tree, `_src/tg2020`)

Scope: the two `/obj/item/electronics/*` circuits on the list (`airalarm`, `tracker`) and their shared parent. Circuits are not usable on their own; each is a part that a machine's construction code consumes. Numbers are raw.

## Parent: /obj/item/electronics   (`code/game/objects/items/apc_frame.dm:113`)

| var | value | file:line |
|---|---|---|
| `desc` | `"Looks like a circuit. Probably is."` | `code/game/objects/items/apc_frame.dm:114` |
| `icon` | `'icons/obj/module.dmi'` | `:115` |
| `icon_state` | `"door_electronics"` (children override) | `:116` |
| `inhand_icon_state` | `"electronic"` | `:117` |
| `flags_1` | `CONDUCT_1` | `:120` |
| `w_class` | `WEIGHT_CLASS_SMALL` | `:121` |
| `custom_materials` | `list(/datum/material/iron=50, /datum/material/glass=50)` | `:122` |
| `grind_results` | `list(/datum/reagent/iron = 10, /datum/reagent/silicon = 10)` | `:123` |
| `name` | inherited from `/obj/item` (`"item"`, `code/game/objects/items.dm:11`) unless set; both children set their own | |
| `slot_flags` | `0` (inherited, `code/game/objects/items.dm:79`): not wearable | |
| `force` | `0` (inherited, `code/game/objects/objs.dm:9`) | |
| `throw_range` | `7` (inherited, `code/game/atoms_movable.dm:11`) | |

- Parent defines no procs of its own (the file ends at `grind_results`, `apc_frame.dm:123`). Behaviour comes from the machine that takes the part.
- Health: `max_integrity = 200` (from `/obj/item`, `code/game/objects/items.dm:57`).
- Power: none. A circuit has no power draw.

---

## Air alarm electronics  `/obj/item/electronics/airalarm`   (`code/modules/atmospherics/machinery/airalarm.dm:36`)

- What it is: the circuit that goes into the air alarm assembly during construction. It is the only way to bring an air alarm back to the "wired, circuit-in" state.
- Key vars:
  - `name = "air alarm electronics"` (`code/modules/atmospherics/machinery/airalarm.dm:37`)
  - `custom_price = 50` (`:38`); a raw price var (the cargo/export use is not read here)
  - `icon_state = "airalarm_electronics"` (`:39`)
  - `desc`, `w_class`, `custom_materials`, `flags_1`: from `/obj/item/electronics` (`apc_frame.dm:114`, `:121`, `:122`, `:120`). So `w_class = WEIGHT_CLASS_SMALL`, iron 50 + glass 50.
- Interactions (where the circuit is used, from the air alarm machine; the item has no `attack_self`/`afterattack` of its own):

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| air alarm frame at `buildstage 0`, hit with `/obj/item/electronics/airalarm` | `user.temporarilyRemoveItemFromInventory(W)` succeeds | none | `"<span class='notice'>You insert the circuit.</span>"` (`airalarm.dm:775`) | `buildstage = 1` (`:776`), `update_icon()` (`:777`), `qdel(W)` (`:778`). The circuit is consumed |
| air alarm at `buildstage 1`, crowbar (`TOOL_CROWBAR`) | `buildstage == 1` | `use_tool(src, user, 20)` = **20 ds** (`:743`) | `"<span class='notice'>[user.name] removes the electronics from [src.name].</span>"` (`:740`) (visible); `"<span class='notice'>You start prying out the circuit...</span>"` (`:741`); on success `"<span class='notice'>You remove the air alarm electronics.</span>"` (`:745`) | `new /obj/item/electronics/airalarm(src.loc)` (`:746`); `buildstage = 0` (`:748`) |
| `buildstage 0`, RCD in "simple circuits" upgrade (`rcd_vals`) | `the_rcd.upgrade & RCD_UPGRADE_SIMPLE_CIRCUITS` | `"delay" = 20` (`airalarm.dm:802`) | `"<span class='notice'>[user] fabricates a circuit and places it into [src].</span>"` / `"<span class='notice'>You adapt an air alarm circuit and slot it into the assembly.</span>"` (`:808-809`) | `buildstage = 1` (`:810`); cost `1` (`:802`) (RCD charge) |
| `buildstage 0`, `/obj/item/electroadaptive_pseudocircuit` | `P.adapt_circuit(user, 25)` succeeds | `adapt_circuit` cost `25` (`:783`) | same two messages as above (`:785-786`) | `buildstage = 1` (`:787`) |

- Construction chain (the part's role in the air alarm build, each step with tool, delay, materials, messages):
  1. Wallframe: `/obj/item/wallframe/airalarm` (`code/modules/atmospherics/machinery/airalarm.dm:41-46`, `result_path = /obj/machinery/airalarm` at `:46`, desc `"Used for building Air Alarms."`) is what the machine turns into when wrenched off (`:791-794`).
  2. The wrench-off step is done by the machine (`airalarm.dm:791-796`); see the air alarm machine entry for the full chain (not on this shard).
  3. Insert this circuit at `buildstage 0` (above, `:773-779`). Result `buildstage 1`.
  4. Five cable lengths at `buildstage 1`: `"<span class='warning'>You need five lengths of cable to wire the air alarm!</span>"` if fewer than 5 (`:754-755`); `do_after(user, 20, target = src)` (`:759`); `"<span class='notice'>You wire the air alarm.</span>"` (`:762`). Uses `cable.use(5)` (`:761`). Result `buildstage 2`, `locked = FALSE`, `mode = 1` (`:765-766`).
- Deconstruction chain (circuit comes back out):
  1. At `buildstage 1`, crowbar, 20 ds, gives this circuit back (see table above).
  2. Full deconstruct (`deconstruct(disassembled = TRUE)`, `airalarm.dm:841-848`): `new /obj/item/stack/sheet/metal(loc, 2)` (`:843`), `new /obj/item/electronics/airalarm(loc)` (`:844`), `new /obj/item/stack/cable_coil(loc, 3)` (`:847`), then the machine is deleted (`qdel(src)`, `:848`). Unless `NODECONSTRUCT_1` is set (`:842`).
  3. Not disassembled (`disassembled = FALSE`): the circuit's `obj_integrity = I.max_integrity * 0.5` (`:845-846`); the other drops are the same.
- Drops:
  - Destroyed (the `deconstruct(disassembled = FALSE)` path; `(inferred)` that destruction calls this with FALSE): metal x2, this circuit at 50% integrity, cable coil x3 (`airalarm.dm:841-847`).
  - Deconstructed properly (`deconstruct(TRUE)`): metal x2, this circuit at full integrity, cable coil x3 (`:841-847`).
  - The difference is only the circuit's integrity.
- Health / armor: `max_integrity` 200 (from `/obj/item`, `items.dm:57`).
- Power: none on the circuit. The air alarm machine's own power is not in this entry.
- Gotchas:
  - At `buildstage 0` the machine's `attackby` handles this circuit (`airalarm.dm:773`), the pseudocircuit (`:781`), and a wrench (`:791`). The RCD path is separate (`:800-803`).
  - The machine's examine text at `buildstage 0` is `"It is missing air alarm electronics."` (`airalarm.dm:231-233`).
  - `custom_price = 50` is set on this type (`:38`).

---

## Tracker electronics  `/obj/item/electronics/tracker`   (`code/modules/power/tracker.dm:86`)

- What it is: the control circuit (the "tracker board") that turns a solar assembly into a solar tracker (a machine that follows the sun).
- Key vars:
  - `name = "tracker electronics"` (`code/modules/power/tracker.dm:87`)
  - `desc`, `icon_state`, `custom_materials`, `w_class`, `flags_1`: from `/obj/item/electronics` (`apc_frame.dm:114`, `:116`, `:122`, `:121`, `:120`). `icon_state` is therefore `"door_electronics"` (inherited; this child sets no icon_state). `(inferred)`: the sprite for this item is the parent's door circuit sprite.
  - `custom_price`: not set (no export price here; the cargo export is in `parts.dm`, see below).
- Interactions (the item has no own procs; the solar assembly takes it):

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| `/obj/item/solar_assembly` hit with `/obj/item/electronics/tracker` | `!tracker` (no tracker board yet) and `user.temporarilyRemoveItemFromInventory(W)` | none | `"<span class='notice'>[user] inserts the electronics into the solar assembly.</span>"` / `"<span class='notice'>You insert the electronics into the solar assembly.</span>"` (`code/modules/power/solar.dm:274`) | `tracker = 1` (`solar.dm:272`), `qdel(W)` (`:273`). The circuit is consumed |
| `/obj/item/solar_assembly` with `tracker` set, crowbar (`TOOL_CROWBAR`) | `tracker` set | none | `"<span class='notice'>[user] takes out the electronics from the solar assembly.</span>"` / `"<span class='notice'>You take out the electronics from the solar assembly.</span>"` (`solar.dm:280`) | `new /obj/item/electronics/tracker(src.loc)` (`:278`), `tracker = 0` (`:279`) |
| solar assembly with glass, `tracker` set | `S.use(2)` (two glass sheets) | none | `"<span class='notice'>[user] places the glass on the solar assembly.</span>"` (`solar.dm:258`) | `new /obj/machinery/power/tracker(get_turf(src), src)` (`:260`) instead of a plain solar panel (`:262`) |

- Construction chain (the tracker board's role):
  1. Build a solar assembly (`/obj/item/solar_assembly`, as in the crate contents).
  2. Insert this circuit into the assembly (above, `solar.dm:268-275`). `tracker = 1`.
  3. Put two glass sheets on the assembly (`S.use(2)`, `solar.dm:255`; `"You need two sheets of glass to put them into a solar panel!"` if short, `:264`). Result: `/obj/machinery/power/tracker` (`:260`).
- Deconstruction chain:
  1. Crowbar on the assembly takes this circuit out (above, `solar.dm:277-281`). The tracker flag is cleared.
  2. The tracker machine itself is taken apart with a crowbar: `"[user] begins to take the glass off [src]."` (`code/modules/power/tracker.dm:58`), `I.use_tool(src, user, 50)` = **50 ds** (`tracker.dm:59`), then `"sound/items/deconstruct.ogg"` (`:60`). The rest of that proc is not read in this entry.
- Drops:
  - Assembly taken apart: the circuit comes out with the crowbar (`solar.dm:278`).
  - Tracker machine destroyed or deconstructed: the circuit is not listed as a drop in the parts read here (NOT FOUND in `tracker.dm` lines 56-86; the machine's `Destroy` is `tracker.dm:25-27`, which only clears control). `(inferred)`: the tracker's parts go through its own deconstruct path, not read.
- Where it appears (not construction):
  - Crate `/obj/structure/closet/crate/solarpanel_small`: one per crate (`code/game/objects/structures/crates_lockers/crates.dm:213`), alongside 13 `/obj/item/solar_assembly` (`:209-210`), a solar control circuit board (`:211`) and a guide paper (`:212`).
  - Cargo pack: `code/modules/cargo/packs.dm:953` (the pack name is not read here).
  - Cargo export: `datum/export/solar/tracker_board` with `cost = 100` and `unit_name = "solar tracker board"` (`code/modules/cargo/exports/parts.dm:8-11`).
- Health / armor: `max_integrity` 200 (from `/obj/item/`, `items.dm:57`).
- Power: none on the circuit. The solar tracker machine has `use_power = NO_POWER_USE` (`code/modules/power/tracker.dm:12`), `max_integrity = 250` (`:13`), `integrity_failure = 0.2` (`:14`).
- Gotchas:
  - Only one tracker board per solar assembly (`if(!tracker)`, `solar.dm:268`).
  - The circuit is consumed when inserted (`qdel(W)`, `solar.dm:273`); removing it makes a new item (`:278`), so it is not the same object.

## NOT FOUND / open questions (this part)
- Air alarm circuit's `custom_price = 50` is a raw price var; the cargo export for it is not read (no `datum/export` line for it was checked).
- Tracker machine's full deconstruct proc (`tracker.dm:56-86` only partly read) and whether the circuit drops when the tracker is destroyed: NOT FOUND in the lines read.
- `cargo pack` name for `packs.dm:953`: not read in this entry.

### Tally (part 4)
- Entries in this part: 2 on the list (`/obj/item/electronics/airalarm`, `/obj/item/electronics/tracker`).
- Documented with real data: 2. NOT FOUND: 0 (open questions listed above).

# gap-items-03 part 5: radios, signalers, trackers and the MMI (TG 2020 tree, `_src/tg2020`)

Scope: `/obj/item/radio/off`, `/obj/item/electropack`, `/obj/item/pinpointer/nuke`, `/obj/item/mmi`. Each has its parent block here. Numbers are raw (ds where a delay; Hz-style frequency values are the integer the DM stores, i.e. the value shown divided by 10 for display, `radio.dm:324`).

---

## Parent: /obj/item/radio   (`code/game/objects/items/devices/radio/radio.dm:3`)

- What it is: a handheld two-way radio. Frequencies are stored times 10 (the examine text divides by 10: `radio.dm:324`).
- Key vars:

| var | value | file:line |
|---|---|---|
| `icon` | `'icons/obj/radio.dmi'` | `radio.dm:4` |
| `name` | `"station bounced radio"` | `radio.dm:5` |
| `icon_state` / `inhand_icon_state` | `"walkietalkie"` / `"walkietalkie"` | `:6-7` |
| `desc` | `"A basic handheld radio that communicates with local telecommunication networks."` | `:8` |
| `dog_fashion` | `/datum/dog_fashion/back` | `:9` |
| `flags_1` | `CONDUCT_1 \| HEAR_1` | `:11` |
| `slot_flags` | `ITEM_SLOT_BELT` | `:12` |
| `throw_speed` / `throw_range` | `3` / `7` | `:13-14` |
| `w_class` | `WEIGHT_CLASS_SMALL` | `:15` |
| `custom_materials` | `list(/datum/material/iron=75, /datum/material/glass=25)` | `:16` |
| `obj_flags` | `USES_TGUI` | `:17` |
| `on` | `TRUE` | `:19` |
| `frequency` | `FREQ_COMMON` = `1459` | `:20`; `code/__DEFINES/radio.dm:86` |
| `canhear_range` | `3` | `:21` |
| `broadcasting` | `FALSE` | `:24` |
| `listening` | `TRUE` | `:25` |
| `freerange` | `FALSE` (so the frequency band is `MIN_FREQ`..`MAX_FREQ`, `1441`..`1489`, `code/__DEFINES/radio.dm:73`, `:88`) | `:28`, `ui_data` `:133-134` |
| `keyslot` | none on the base type (only the `borg` child's `attackby` inserts keys) | `:36`, `:390-421` |

- `Initialize` (`radio.dm:89-99`): creates `wires = new /datum/wires/radio(src)`; cuts `WIRE_TX` if `prison_radio` (`:91-92`); `frequency = sanitize_frequency(frequency, freerange)`; `set_frequency(frequency)`; adds secure channels (`:98-99`).
- `ComponentInitialize` (`:101-103`): `AddComponent(/datum/component/empprotection, EMP_PROTECT_WIRES)`.

### Interactions (parent; `/obj/item/radio/off` inherits all of these)

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| `suicide_act` | any | none | `"<span class='suicide'>[user] starts bouncing [src] off [user.p_their()] head! It looks like [user.p_theyre()] trying to commit suicide!</span>"` (`radio.dm:44`) | returns `BRUTELOSS` (`:45`) |
| `attackby` screwdriver (`TOOL_SCREWDRIVER`) | any | none | `"<span class='notice'>The radio can now be attached and modified!</span>"` (`:335`) when it becomes unscrewed; `"<span class='notice'>The radio can no longer be modified or attached!</span>"` (`:337`) when it becomes screwed | toggles `unscrewed` (`:333`) |
| `attackby` any other item | | none | none | `..()` (`:338-339`). The base type has no encryption-key slot logic; that is only in `/obj/item/radio/borg/attackby` (`:390-421`) |
| `interact` | `unscrewed` and not an AI | none | none | opens the wire panel: `wires.interact(user)` and `add_fingerprint` (`:105-108`); otherwise the TGUI (`:110`) |
| `examine` | `frequency` and `in_range` | none | `"<span class='notice'>It is set to broadcast over the [frequency/10] frequency.</span>"` (`:324`); `"<span class='notice'>It can be attached and modified.</span>"` (`:326`) or `"<span class='notice'>It cannot be modified or attached.</span>"` (`:328`) | none |
| TGUI "Radio" (`ui_interact`, `:112-125`; base size 360 x 106, `:117-118`) | | none | | actions below |
| TGUI `ui_act` "frequency" | `freqlock` FALSE | none | none | tunes by `adjust * 10` or to `tune * 10`, then `set_frequency(sanitize_frequency(tune, freerange))` (`:151-163`) |
| TGUI "listen" | | none | none | `listening = !listening` (`:164-166`) |
| TGUI "broadcast" | | none | none | `broadcasting = !broadcasting` (`:167-169`) |
| TGUI "channel" | channel is in `channels` | none | none | toggles `FREQ_LISTENING` bit (`:170-178`) |
| TGUI "command" | | none | none | `use_command = !use_command` (`:179-181`) |
| TGUI "subspace" | `subspace_switchable` | none | none | toggles `subspace_transmission`; clears `channels` or calls `recalculateChannels()` (`:182-189`) |
| `Hear` (heard speech) | `broadcasting` and `get_dist(src, speaker) <= canhear_range` (`:279`) | none | whispers are starred: `stars(raw_message)` (`:283-284`) | `talk_into(...)` (`:294`) |
| `can_receive` (incoming signal) | `!on` or `!listening` or `RX` wire cut | none | none | returns FALSE (`:299-300`) |
| `emp_act` | not `EMP_PROTECT_SELF` | `addtimer(..., 200)` = 200 ds to recover (`:354`) | `"<span class='warning'>\The [src] overloads.</span>"` if `listening` and held (`:347-348`) | `emped++`, `broadcasting = FALSE`, `listening = FALSE`, channels 0, `on = FALSE` (`:345-353`); `end_emp_effect` sets `on = TRUE` (`:356-361`) |

- Construction chain: none on the radio (no recipe here). Parts: `custom_materials` iron 75 + glass 25 (`:16`).
- Deconstruction: unscrew with a screwdriver to reach the wire panel (`:332-337`), then the wire panel (`:105-108`). Nothing else is removed here.
- Drops: `Destroy` removes it from the radio network, `QDEL_NULL(wires)` and `QDEL_NULL(keyslot)` (`radio.dm:83-87`). No `new` line drops items.
- Health / armor: `max_integrity = 200` from `/obj/item` (`items.dm:57`).
- Power: none. The radio is set `on = TRUE` and has no power draw in this file (NOT FOUND for a W number here).

---

## Child: /obj/item/radio/off   (`code/game/objects/items/devices/radio/radio.dm:424`)

- What it is: the "station bounced radio" that spawns with listening off. Its own comment: `"Station bounced radios, their only difference is spawning with the speakers off, this was made to help the lag."` (`radio.dm:424`); second line: `"And it's nice to have a subtype too for future features."` (`:425`).
- Key vars (set on this type):
  - `listening = 0` (`code/game/objects/items/devices/radio/radio.dm:425`); the parent has `TRUE` (`:25`).
  - `dog_fashion = /datum/dog_fashion/back` (`:426`); same as the parent (`:9`).
- Everything else inherited: `name = "station bounced radio"` (`:5`), `desc`, `w_class`, `custom_materials`, `frequency`, `on = TRUE` (`:19`), `broadcasting = FALSE` (`:24`).
- Effect: `can_receive` returns FALSE while `listening` is 0 (`:297-299`), so this radio does not pick up signals until the player turns on "listen" in the TGUI (`:164-166`). It also does not transmit, because `broadcasting` is FALSE by default (`:24`).
- Count: 15 placed on BoxStation (from the list).
- Gotchas: the name is the same as the parent's, so the in-game name does not show that it is off; `examine` does not print the listening state (`radio.dm:321-328`).

---

## Electropack  `/obj/item/electropack`   (`code/game/objects/items/devices/radio/electropack.dm:1`)

- What it is: a back-worn signaller and shock unit. A signal with a matching code makes the wearer step, get a sharp shock, and be paralysed (`electropack.dm:61-78`).
- Key vars:

| var | value | file:line |
|---|---|---|
| `name` | `"electropack"` | `electropack.dm:2` |
| `desc` | `"Dance my monkeys! DANCE!!!"` | `:3` |
| `icon` | `'icons/obj/radio.dmi'` | `:4` |
| `icon_state` | `"electropack0"` (then `"electropack[on]"`) | `:5`, `:111` |
| `inhand_icon_state` | `"electropack"` | `:6` |
| `flags_1` | `CONDUCT_1` | `:9` |
| `slot_flags` | `ITEM_SLOT_BACK` | `:10` |
| `w_class` | `WEIGHT_CLASS_HUGE` | `:11` |
| `custom_materials` | `list(/datum/material/iron=10000, /datum/material/glass=2500)` | `:12` |
| `ui_x` / `ui_y` | `260` / `137` | `:13-14` |
| `on` | `TRUE` | `:15` |
| `code` | `2` (range 1 to 100 in the UI, `:119-123`) | `:16` |
| `frequency` | `FREQ_ELECTROPACK` = `1449` (`code/__DEFINES/radio.dm:82`); the free band is `MIN_FREE_FREQ` 1201 (`:53`) to `MAX_FREE_FREQ` 1599 (`:90`) | `:17` |
| `shock_cooldown` | `FALSE` | `:18` |

- `Initialize` (`electropack.dm:20-22`): `set_frequency(frequency)`; `set_frequency` (`:83-86`) moves the object to `SSradio` with `RADIO_SIGNALER` (`"signaler"`, `code/__DEFINES/radio.dm:101`).
- `Destroy` (`:24-26`): `SSradio.remove_object(src, frequency)`.

### Interactions

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| `suicide_act` | any | none | `"<span class='suicide'>[user] hooks [user.p_them()]self to the electropack and spams the trigger! It looks like [user.p_theyre()] trying to commit suicide!</span>"` (`electropack.dm:29`) | returns `FIRELOSS` (`:30`) |
| `attack_hand` by the wearer (`src == C.back`) | carbon user | none | `"<span class='warning'>You need help taking this off!</span>"` (`:37`) | returns (`:38`) |
| `attack_hand` otherwise | | none | none | `..()` (`:39`) |
| `attackby` a `/obj/item/clothing/head/helmet` | | none | `"<span class='warning'>[W] is stuck to your hand, you cannot attach it to [src]!</span>"` (`:47`) if the helmet cannot be moved | creates `/obj/item/assembly/shock_kit` (`:43`), puts the helmet and this unit into it (`:46-54`), `user.put_in_hands(A)` (`:56`). Other items: `..()` (`:59`) |
| `receive_signal` (matching `signal.data["code"] == code`, `:62`) | `isliving(loc)` and `on` (`:65`) and not `shock_cooldown` (`:66-67`) | `addtimer(VARSET_CALLBACK(src, shock_cooldown, FALSE), 100)` = 100 ds (`:69`) | `"<span class='danger'>You feel a sharp shock!</span>"` (`:73`) | `step(L, pick(GLOB.cardinals))` (`:71`); sparks `s.set_up(3, 1, L)` (`:75`); `L.Paralyze(100)` (`:78`, raw argument, unit of the proc not read). If `master` is set, `master.receive_signal()` (`:80-81`) |
| UI "power" | | none | none | `on = !on`, `icon_state = "electropack[on]"` (`:109-112`) |
| UI "freq" | value parses | none | none | `frequency = sanitize_frequency(value, TRUE)`; `set_frequency` (`:113-118`) |
| UI "code" | `text2num` parses | none | none | `code = clamp(round(value), 1, 100)` (`:119-124`) |
| UI "reset" | `freq` or `code` | none | none | resets to `initial(frequency)` or `initial(code)` (`:125-131`) |

- Construction chain: none on the unit itself. It is made into a shock kit by joining a helmet (`electropack.dm:41-57`).
- Deconstruction chain: none (no screwdriver or wrench handling in this file).
- Drops: `Destroy` only removes the radio registration (`:24-26`). No `new` line on destruction in this file.
- Health / armor: `max_integrity` 200 (from `/obj/item`, `items.dm:57`).
- Power: none (no `use_power`; the unit is a signaller). `(inferred)`: the shock uses the signal, not a power grid.
- Gotchas:
  - `shock_cooldown` gives 100 ds between shocks (`electropack.dm:66-69`).
  - The shock only runs when `on` (`:65`); `master` is also signalled regardless (`:80-81`).
  - Its `code` 2 default and frequency 1449 are the settings a matching signaller uses. A signal with a different code is ignored (`:62-63`).

---

## Pinpointer, nuke disk variant  `/obj/item/pinpointer/nuke`   (`code/modules/antagonists/nukeop/equipment/pinpointer.dm:1`)

- What it is: a pinpointer set to track the nuclear authentication disk.
- Key vars:
  - `mode = TRACK_NUKE_DISK` (`code/modules/antagonists/nukeop/equipment/pinpointer.dm:2`); `TRACK_NUKE_DISK` = `1` (`code/__DEFINES/pinpointers.dm:2`).
  - Inherits from `/obj/item/pinpointer` (`code/game/objects/items/pinpointer.dm:2`): `name = "pinpointer"` (`:3`), `desc = "A handheld tracking device that locks onto certain signals."` (`:4`), `icon_state = "pinpointer"` (`:6`), `slot_flags = ITEM_SLOT_BELT` (`:8`), `w_class = WEIGHT_CLASS_SMALL` (`:9`), `throw_speed = 3` (`:14`), `throw_range = 7` (`:15`), `custom_materials = list(/datum/material/iron = 500, /datum/material/glass = 250)` (`:16`), `resistance_flags = INDESTRUCTIBLE | LAVA_PROOF | FIRE_PROOF | ACID_PROOF` (`:17`).
  - Parent vars: `active = FALSE` (`:18`), `minimum_range = 0` (`:20`), `alert = FALSE` (`:21`), `process_scan = TRUE` (`:22`), `icon_suffix = ""` (`:23`).
  - Parent `Initialize` adds it to `GLOB.pinpointer_list` (`:25-27`).
- Interactions:

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| `attack_self` (parent, `pinpointer.dm:35-39`) | `process_scan` TRUE so no scan here | none | `"<span class='notice'>[user] [active ? "" : "de"]activates [user.p_their()] pinpointer.</span>"` and `"<span class='notice'>You [active ? "" : "de"]activate your pinpointer.</span>"` (`:39`) | `toggle_on()` (`:38`) |
| `toggle_on` (parent, `pinpointer.dm:41-49`) | | none | none | `active = !active`; sound `'sound/items/screwdriver2.ogg'` vol 50 (`:43`); on: `START_PROCESSING(SSfastprocess, src)` (`:45`); off: `target = null`, `STOP_PROCESSING` (`:46-48`); `update_icon()` (`:49`) |
| `process` (`pinpointer.dm:51-56`) | `active` | none | none | `scan_for_target()` if `process_scan` (`:54-55`) |
| `examine` (nuke, `pinpointer.dm` nuke file `:4-19`) | any | none | `"Its tracking indicator reads "` plus `"\"nuclear_disk\"."` (nuke file `:9`) when `TRACK_NUKE_DISK`; `"\"01000001 01001001\"."` (`:11`) when `TRACK_MALF_AI`; `"\"vasvygengbefuvc\"."` (`:13`) when `TRACK_INFILTRATOR`; `"Its tracking indicator is blank."` (`:15`) otherwise. For each `bomb` with `timing`: `"Extreme danger. Arming signal detected. Time remaining: [bomb.get_time_left()]."` (`:19`) | none |
| `process` (nuke, `:21-31`) | `active` and a bomb in `GLOB.nuke_list` with `timing` | none | `"<span class='userdanger'>Your [name] vibrates and lets out a tinny alarm. Uh oh.</span>"` (`:31`) to a living holder | `alert = TRUE` once (`:26-27`); sound `'sound/items/nuke_toy_lowpower.ogg'` vol 50 (`:28`) |
| `scan_for_target` (nuke, `:33-50`) | `mode` | none | none | `TRACK_NUKE_DISK`: `target` = first `/obj/item/disk/nuclear` in `GLOB.poi_list` (`:36-38`). `TRACK_MALF_AI`: a nuking AI, or an APC with `malfhack` and `occupier` (`:39-47`). `TRACK_INFILTRATOR`: `SSshuttle.getShuttle("syndicate")` (`:48-49`) |
| `switch_mode_to` (nuke, `:52-58`) | | none | `"<span class='userdanger'>Your [name] beeps as it reconfigures it's tracking algorithms.</span>"` (`:55`) for a living holder; sound `'sound/machines/triple_beep.ogg'` vol 50 (`:56`) | `mode = new_mode` (`:57`); `scan_for_target()` (`:58`) |

- Construction / deconstruction: none in this file.
- Drops: none (`INDESTRUCTIBLE`, `pinpointer.dm:17`).
- Health / armor: indestructible (`resistance_flags`, `pinpointer.dm:17`); `max_integrity` 200 from `/obj/item` (not overridden).
- Power: none in this file.
- Gotchas:
  - `resistance_flags` makes it `INDESTRUCTIBLE` (`pinpointer.dm:17`).
  - Pinpointers track only on the same z-level (`pinpointer.dm:1` comment, and `update_overlays` `:70`).
  - The tracking mode is changed with `switch_mode_to`, not by a click.

---

## Man-Machine Interface (MMI)  `/obj/item/mmi`   (`code/modules/mob/living/brain/MMI.dm:1`)

- What it is: a canister that holds a brain (and its brain mob) so a cyborg or AI can be run from it. Holds a radio (`:8`).
- Key vars:

| var | value | file:line |
|---|---|---|
| `name` | `"\improper Man-Machine Interface"` (in game: "Man-Machine Interface") | `MMI.dm:2` |
| `desc` | `"The Warrior's bland acronym, MMI, obscures the true horror of this monstrosity, that nevertheless has become standard-issue on Nanotrasen stations."` | `:3` |
| `icon` | `'icons/obj/assemblies.dmi'` | `:4` |
| `icon_state` | `"mmi_off"` (then `mmi_brain`, `mmi_brain_alien`, `mmi_alive`, `mmi_dead` by state) | `:5`, `:17-33` |
| `w_class` | `WEIGHT_CLASS_NORMAL` | `:6` |
| `braintype` | `"Cyborg"` (`"Xenoborg"` for an alien brain) | `:7`, `:82`, `:84` |
| `radio` | created in `Initialize` as `/obj/item/radio` (`:37`) | `:8` |
| `brainmob` / `brain` | null at start | `:9`, `:12` |
| `laws` | `new()` (`:13`), config set in `Initialize` (`:39`) | `:13` |
| `overrides_aicore_laws` | `FALSE` | `:15` |
| `slot_flags` | not set (not wearable) | |
| `custom_materials` | not set on this type or on `/obj/item` (none) | |

- `Initialize` (`MMI.dm:35-39`): `radio = new(src)` (`:37`), `radio.broadcasting = FALSE` (`:38`), `laws.set_laws_config()` (`:39`).

### Interactions

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| `attackby` a brain (`/obj/item/organ/brain`), MMI empty | brain has a `brainmob` (`MMI.dm:48`) and `user.transferItemToLoc` ok (`:52`) | `user.changeNext_move(CLICK_CD_MELEE)` (`:42`) | `"<span class='notice'>[user] sticks \a [newbrain] into [src].</span>"` / `"<span class='notice'>[src]'s indicator light turn on as you insert [newbrain].</span>"` (`:57`) | `brainmob` set; brain frozen `ORGAN_FROZEN` (`:77`); `name = "[initial(name)]: [brainmob.real_name]"` (`:79`); `braintype` set (`:81-84`); `SSblackbox.record_feedback` (`:86`) |
| brain already in the MMI | | none | `"<span class='warning'>There's already a brain in the MMI!</span>"` (`:46`) | nothing |
| brain with no brainmob | | none | `"<span class='warning'>You aren't sure where this brain came from, but you're pretty sure it's a useless brain!</span>"` (`:49`) | nothing |
| brain that is `ORGAN_FAILING` (not suicided) | | sound `'sound/machines/synth_no.ogg'` vol 5 (`:70`) | `"<span class='warning'>[src]'s indicator light turns yellow and its brain integrity alarm beeps softly. Perhaps you should check [newbrain] for damage.</span>"` (`:69`) | the brain mob is not woken (`:68`) |
| brain from a suicider, or suiciding brainmob | | sound `'sound/machines/triple_beep.ogg'` vol 5 (`:73`) | `"<span class='warning'>[src]'s indicator light turns red and its brainwave activity alarm beeps softly. Perhaps you should check [newbrain] again.</span>"` (`:72`) | the brain mob is not woken (`:71`) |
| `attackby` any other item with a brainmob inside | `else if(brainmob)` (`:90`) | none | none | `O.attack(brainmob, user)` (`:91`) |
| `attack_self`, MMI has no brain | | none | `"<span class='notice'>You toggle [src]'s radio system [radio.on==1 ? "on" : "off"].</span>"` (`:98`) | `radio.on = !radio.on` (`:97`) |
| `attack_self`, MMI has a brain | | none | `"<span class='notice'>You unlock and upend [src], spilling the brain onto the floor.</span>"` (`:103`) | `eject_brain(user)` (`:100`), `update_icon()` (`:101`), `name = initial(name)` (`:102`) |
| `Toggle_Listening` verb | `brainmob.stat` non-zero: message, but no return (the next check still runs, `:162-163`) | none | `"<span class='warning'>Can't do that while incapacitated or dead!</span>"` (`:163`); if `!radio.on`: `"<span class='warning'>Your radio is disabled!</span>"` (`:165`) and return; otherwise `"<span class='notice'>Radio is [radio.listening ? "now" : "no longer"] receiving broadcast.</span>"` (`:169`) | `radio.listening = !radio.listening` (`:168`) |
| `emp_act` with a brainmob | not `EMP_PROTECT_SELF`; not in a cyborg (`:173-176`) | none | `brainmob.emote("alarm")` (`:185`) | `brainmob.emp_damage = min(emp_damage + rand(20,30), 30)` for severity 1 (`:179-180`); `rand(10,20)` for 2 (`:181-182`); `rand(0,10)` for 3 (`:183-184`); cap 30 |
| `relaymove` | | none | none | returns (`:222-223`), so the MMI does not warn about moving |

- `eject_brain(user)` (`MMI.dm:105-121`): `brainmob.container = null` (`:106`), `brainmob.forceMove(brain)` (`:107`), `brainmob.set_stat(DEAD)` (`:108`), `emp_damage = 0` (`:109`), moves the mob to the dead list (`:111-112`), `brain.brainmob = brainmob` (`:113`), `brainmob = null` (`:115`). With a user the brain goes into their hands via `put_in_hands` (`:117`); with no user it drops on the turf (`:119`). `ORGAN_FROZEN` is cleared (`:120`), `brain = null` (`:121`).
- `transfer_identity` (`MMI.dm:123-150`): used for human-to-robot transfer; creates a new brainmob if needed (`:124-125`), copies DNA (`:128-132`), takes the human brain organ into the MMI (`:135-139`) or creates a new brain named `"[L.real_name]'s brain"` (`:140-142`).
- Construction chain: none on the MMI itself in this file. A brain is inserted (above). The cyborg or AI build that uses it is outside this entry.
- Deconstruction chain: `deconstruct(disassembled = TRUE)` (`MMI.dm:204-207`): if a brain is in, `eject_brain()` with no user (the brain drops to the turf, `:119`), then `qdel(src)` (`:207`).
- Drops:
  - Deconstructed or destroyed (`deconstruct`): the brain drops on the turf (`MMI.dm:205-206`, `:119`); the MMI is deleted (`:207`).
  - Deleted via `Destroy` (`MMI.dm:187-202`): the brainmob, brain (if any) and radio are `qdel`ed (`:191-201`). By the time `Destroy` runs after `deconstruct`, `brain` is null, so the brain is not deleted twice.
- Health / armor: `max_integrity` 200 from `/obj/item` (`items.dm:57`); no armor set.
- Power: none on the MMI. The radio inside has no power draw here.
- Gotchas:
  - The name changes to `"Man-Machine Interface: [real_name]"` while a brain is in (`:79`) and resets on eject (`:102`).
  - The brain is frozen (`ORGAN_FROZEN`) while inside (`:77`).
  - `examine` reports the radio switch state and the brain's activity (`:209-220`).
  - `brain_check` returns FALSE for: no brain, no key or mind, no client, suicidal, dead, failing brain (`:225-250`), each with its own message (for example `"\The [src] indicates that the brain is damaged!"`, `:249`).
- Syndicate variant: `/obj/item/mmi/syndie` (`MMI.dm:253-261`) is not on the list.

## NOT FOUND / open questions (this part)
- Radio W draw: no power use is set in `radio.dm`; NOT FOUND.
- `Paralyze(100)` unit in the electropack: the proc is not read (raw value given).
- Cargo or price data for the radio, electropack, pinpointer, MMI: not read.
- Electropack `/obj/item/assembly/shock_kit` is a separate type (not on the list).

### Tally (part 5)
- Entries in this part: 4 on the list (`/obj/item/radio/off`, `/obj/item/electropack`, `/obj/item/pinpointer/nuke`, `/obj/item/mmi`).
- Documented with real data: 4. NOT FOUND: 0.

# gap-items-03 part 6: surgical hemostat and exile implant items (TG 2020 tree, `_src/tg2020`)

Scope: `/obj/item/hemostat`, `/obj/item/implanter/exile`, `/obj/item/implantcase/exile`. The exile implant that both carry is documented here as the contents. Numbers are raw (ds).

## Shared parent: /obj/item (hemostat only uses the base)

Base values used by the hemostat are listed in part 1 (`/obj/item`, `code/game/objects/items.dm:77-126`). Hemostat sets its own `force` by inheritance: none, so `force = 0` from `/obj` (`code/game/objects/objs.dm:9`).

---

## Hemostat  `/obj/item/hemostat`   (`code/modules/surgery/tools.dm:21`)

- What it is: a surgical clamp (`TOOL_HEMOSTAT`). It has no melee use of its own; it is used by surgery steps and by a few other procs (see the table of uses).
- Key vars:

| var | value | file:line |
|---|---|---|
| `name` | `"hemostat"` | `code/modules/surgery/tools.dm:22` |
| `desc` | `"You think you have seen this before."` | `:23` |
| `icon` / `icon_state` | `'icons/obj/surgery.dmi'` / `"hemostat"` | `:24-25` |
| `inhand_icon_state` | `"clamps"` | `:28` |
| `custom_materials` | `list(/datum/material/iron=5000, /datum/material/glass=2500)` | `:29` |
| `flags_1` | `CONDUCT_1` | `:30` |
| `item_flags` | `SURGICAL_TOOL` | `:31` |
| `w_class` | `WEIGHT_CLASS_TINY` | `:32` |
| `attack_verb` | `list("attacked", "pinched")` | `:33` |
| `tool_behaviour` | `TOOL_HEMOSTAT` (value `"hemostat"`, `code/__DEFINES/tools.dm:12`) | `:34` |
| `toolspeed` | `1` | `:35` |
| `force`, `throwforce` | not set: `0` (from `/obj`, `code/game/objects/objs.dm:9`) and `0` (from `/atom/movable`, `code/game/atoms_movable.dm:40`) | |
| `slot_flags` | not set: `0` (from `/obj/item`, `items.dm:79`) | |
| `max_integrity` | `200` (from `/obj/item`, `code/game/objects/items.dm:57`) | |
- Augment variant `/obj/item/hemostat/augment` (`tools.dm:37-39`): `desc = "Tiny servos power a pair of pincers to stop bleeding."`, `toolspeed = 0.5`. Not on the list.

### Interactions

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| melee hit (the hemostat as a weapon) | any | none | the verbs are `"attacked", "pinched"` (`tools.dm:33`); the attack-line format is `[x] has been [z.attack_verb] by [y] with [z]` per the `attack_verb` comment (`code/game/objects/items.dm:130`) | damage `force = 0` (inherited) |
| surgery step uses (`TOOL_HEMOSTAT` in `implements`) | see table | the step's base `time` (see table); the step's own `use` timing is in `surgery_step.dm` (below) | see table | see table |
| medibot: pull a pAI card (`bot.dm:314-322`) | bot panel closed, `paicard` inside | `do_after(user, 30, target = src)` = 30 ds (`bot.dm:319`) | `"<span class='warning'>Close the access panel before manipulating the personality slot!</span>"` (`:316`) if open; `"<span class='notice'>You attempt to pull [paicard] free...</span>"` (`:318`); `"<span class='notice'>[user] uses [W] to pull [paicard] out of [bot_name]!</span>"` and `"<span class='notice'>You pull [paicard] out of [bot_name] with [W].</span>"` (`:321`) | `ejectpai(user)` (`:322`) |

### Surgery step use (`TOOL_HEMOSTAT` in the step's `implements` list)

How the number works (the list value is a speed factor, not a success probability in the code path):
- `implement_speed_mod = implements[implement_type] / 100.0` (`code/modules/surgery/surgery_step.dm:81-83`).
- `speed_mod /= (location * (1 + surgery.speed_modifier) * implement_speed_mod)` (`:85`); `modded_time = time * speed_mod * skill_modifier` (`:86`). A lower value makes the step slower.
- `fail_prob = min(max(0, modded_time - time * SURGERY_SLOWDOWN_CAP_MULTIPLIER), 99)` (`:89`); success is `prob(100 - fail_prob)` (`:100`). So a slow tool raises the failure chance.
- The comment on the list says `path = probability of success` (`surgery_step.dm:3`); the code above is what runs.
- Base messages if a step does not set its own: success `"<span class='notice'>You succeed.</span>"` / `"<span class='notice'>[user] succeeds!</span>"` / `"<span class='notice'>[user] finishes.</span>"` (`surgery_step.dm:125-129`); failure `"<span class='warning'>You screw up![screwedmessage]</span>"` / `"<span class='warning'>[user] screws up!</span>"` / `"<span class='notice'>[user] finishes.</span>"`, with `screwedmessage` `" You almost had it, though."` (fail 0-24, `:137`), `" This is hard to get right in these conditions..."` (50-74, `:139`), `" This is practically impossible in these conditions..."` (75-99, `:141`) (`surgery_step.dm:133-145`).

| step (datum) | `implements` with the hemostat | value for `TOOL_HEMOSTAT` | base `time` (ds) | preop message (verbatim, first line) |
|---|---|---|---|---|
| clamp bleeders `/datum/surgery_step/clamp_bleeders` | `modules/surgery/organic_steps.dm:47` | 100 | 24 (`organic_steps.dm:48`) | `"<span class='notice'>You begin to clamp bleeders in [target]'s [parse_zone(target_zone)]...</span>"` (`organic_steps.dm:51`) |
| brainwash `/datum/surgery_step/brainwash` | `modules/surgery/advanced/brainwashing.dm:30` | 85 | 200 (`:31`) | `"<span class='notice'>You begin to brainwash [target]...</span>"` (`:39`) |
| pacify `/datum/surgery_step/pacify` | `modules/surgery/advanced/pacification.dm:23` | 100 | 40 (`:24`) | `"<span class='notice'>You begin to pacify [target]...</span>"` (`:28`) |
| fix brain `/datum/surgery_step/fix_brain` | `modules/surgery/brain_surgery.dm:17` (comment: `"pouring some alcohol on their open brain will get that chance to 100"`) | 85 | 100 (`:19`, comment `//long and complicated`) | `"<span class='notice'>You begin to fix [target]'s brain...</span>"` (`:29`) |
| debride `/datum/surgery_step/debride` | `modules/surgery/burn_dressing.dm:24` | 100 | 30 (`:25`) | `"<span class='notice'>You begin to excise infected flesh from [target]'s [parse_zone(user.zone_selected)]...</span>"` (`:37`) |
| extract core `/datum/surgery_step/extract_core` | `modules/surgery/core_removal.dm:17` | 100 (crowbar is 100 too) | 16 (`:18`) | `"<span class='notice'>You begin to extract a core from [target]...</span>"` (`:21`) |
| coronary bypass `/datum/surgery_step/coronary_bypass` | `modules/surgery/coronary_bypass.dm:53` | 90 | 90 (`:54`) | `"<span class='notice'>You begin to graft a bypass onto [target]'s heart...</span>"` (`:58`) |
| fix eyes `/datum/surgery_step/fix_eyes` | `modules/surgery/eye_surgery.dm:11` | 100 | 64 (`:12`) | `"<span class='notice'>You begin to fix [target]'s eyes...</span>"` (`:23`) |
| heal (wounds) `/datum/surgery_step/heal` | `modules/surgery/healing.dm:28` | 100 | 25 (`:30`) | `"<span class='notice'>You attempt to patch some of [target]'s [woundtype].</span>"` (`:46`) |
| extract implant `/datum/surgery_step/extract_implant` | `modules/surgery/implant_removal.dm:11` | 100 | 64 (`:12`) | `"<span class='notice'>You begin to extract [I] from [target]'s [target_zone]...</span>"` (`:21`) |
| prepare electronics `/datum/surgery_step/prepare_electronics` | `modules/surgery/mechanic_steps.dm:46-48` | 10 | 24 (`:49`) | `"<span class='notice'>You begin to prepare electronics in [target]'s [parse_zone(target_zone)]...</span>"` (`:52`) |
| manipulate organs `/datum/surgery_step/manipulate_organs` (`implements_extract`) | `modules/surgery/organ_manipulation.dm:72` | 100 | 64 (`:68`) | `"<span class='notice'>You begin to extract [I] from [target]'s [parse_zone(target_zone)]...</span>"` (`:122`) |

- Success / failure text per step is in each step's `success` and `failure` procs (for example clamp bleeders success: no own message, it runs `..()` at `organic_steps.dm:63`, and heals 20 bodypart damage with a saw step present, `:56-57`, and removes 3 bleedstacks, `:62`). Only the preop text is quoted in the table to keep this readable.
- Extract implant success: `"<span class='notice'>You successfully remove [I] from [target]'s [target_zone].</span>"` (`modules/surgery/implant_removal.dm:31`) and the implant case path `"<span class='notice'>You place [I] into [case].</span>"` (`:46`). This is how the exile implant is removed from a person (see the implant entries).
- Related but not the hemostat: `/obj/item/retractor/advanced` sets `tool_behaviour = TOOL_HEMOSTAT` at `modules/surgery/tools.dm:297` (in its `attack_self`, `tools.dm:294`). Not on the list.
- Construction: none (no recipe in `tools.dm`).
- Deconstruction: none.
- Drops: none defined.
- Power: none.
- Gotchas:
  - No `force` is set, so the hemostat does 0 base melee damage (inferred from `objs.dm:9`).
  - `item_flags = SURGICAL_TOOL` (`tools.dm:31`) is set on the hemostat; what the flag changes is not read in this part.
  - The hemostat also counts as a `TOOL_HEMOSTAT` on the medibot (`bot.dm:314`).

---

## Exile implanter  `/obj/item/implanter/exile`   (`code/game/objects/items/implants/implant_exile.dm:15`)

- What it is: an injector that starts loaded with an exile implant.
- Key vars (set on this type):
  - `name = "implanter (exile)"` (`code/game/objects/items/implants/implant_exile.dm:16`)
  - `imp_type = /obj/item/implant/exile` (`:17`); `Initialize` makes it (`code/game/objects/items/implants/implanter.dm:61-65`: `if(imp_type) imp = new imp_type(src)`, then `update_icon()`).
- Inherited from `/obj/item/implanter` (`code/game/objects/items/implants/implanter.dm:1-14`):
  - `desc = "A sterile automatic implant injector."` (`:3`)
  - `icon_state = "implanter0"` (`:5`); with an implant in it the icon is `"implanter1"` (`:17-21`)
  - `inhand_icon_state = "syringe_0"` (`:6`), `throw_speed = 3` (`:9`), `throw_range = 5` (`:10`)
  - `w_class = WEIGHT_CLASS_SMALL` (`:11`)
  - `custom_materials = list(/datum/material/iron=600, /datum/material/glass=200)` (`:12`)
  - `imp = null` (`:13`), `imp_type = null` (`:14`)
- Interactions:

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| `attack` on a living mob, implanter loaded, user is the target | `M == user` | none | `"<span class='notice'>You implant yourself.</span>"` (`implanter.dm:36`) on success | `imp.implant(M, user)` (`:34`); `imp = null`, `update_icon()` (`:39-40`) |
| `attack` on another mob | `do_mob(user, M, 50)` | **50** ds (`implanter.dm:32`) | `"<span class='warning'>[user] is attempting to implant [M].</span>"` (`:29`); on success `"<span class='notice'>[user] implants [M].</span>"` and `"<span class='notice'>[user] implants you.</span>"` (`:38`) | as above |
| `attack` fails (`imp.implant` returns FALSE) | | | `"<span class='warning'>[src] fails to implant [M].</span>"` (`:42`) | the implant stays in the implanter |
| `attackby` pen (literate user) | `user.get_active_held_item() == W` | none | label prompt `"What would you like the label to be?"` (`:49`); with a label `name = "implanter ([t])"` (`:55`), without `name = "implanter"` (`:57`) | none |
| `attackby` pen, illiterate user | | none | `"<span class='notice'>You prod at [src] with [W]!</span>"` (`:47`) | returns |

- Implant effect on the target: `implant()` (`code/game/objects/items/implants/implant.dm:43`) puts the implant in the mob's `implants` list (`:46-74`) and moves it inside the mob (`forceMove(target)`, `:75`). `can_be_implanted()` (`implant.dm:29-36`) is FALSE for silicons (`:32-33`). Exile is not blocked by the body; it is a flag the gate reads.
- Construction: none. Deconstruction: none.
- Drops: none defined on the implanter in this file.
- Health / armor: `max_integrity 200` (from `/obj/item`, `items.dm:57`).
- Power: none.
- Gotchas:
  - The implanter is single use: after `imp = null` (`implanter.dm:39`) it is empty.
  - `do_mob(user, M, 50)` is a 50 ds wait on a target who is not the user (`implanter.dm:32`).

## Exile implant (the contents)  `/obj/item/implant/exile`   (`code/game/objects/items/implants/implant_exile.dm:4`)

- What it is: an implant that stops a person from coming back through the station gate. It does not do anything to the body.
- Key vars:
  - `name = "exile implant"` (`implant_exile.dm:5`); `desc = "Prevents you from returning from away missions."` (`:6`)
  - `activated = 0` (`:7`): not activatable, always on. The parent's comment says this is the "always on" kind (`code/game/objects/items/implants/implant.dm:6`).
  - `get_data()` (`implant_exile.dm:9-13`): `"<b>Name:</b> Nanotrasen Employee Exile Implant"` and `"<b>Implant Details:</b> The onboard gateway system has been modified to reject entry by individuals containing this implant"`.
  - Inherited from `/obj/item/implant` (`implant.dm:1-11`): `icon_state = "generic"` (`:4`), `actions_types = list(/datum/action/item_action/hands_free/activate)` (`:5`), `implant_color = "b"` (`:8`), `allow_multiple = FALSE` (`:9`), `uses = -1` (`:10`), `item_flags = DROPDEL` (`:11`).
- Effect (the gate reads it): the home gateway checks every arriving living mob (`code/modules/awaymissions/gateway.dm:97-117`):
  - `check_exile_implant(L)` (`gateway.dm:113-117`): `"<span class='userdanger'>The station gate has detected your exile implant and is blocking your entry.</span>"` (`:115`), returns TRUE.
  - Contained lifeform (a container with a mob inside): `target_gateway.say("Rejecting [AM]: Exile implant detected in contained lifeform.")` (`:104`).
  - Buckled lifeform: `target_gateway.say("Rejecting [AM]: Exile implant detected in close proximity lifeform.")` (`:109`).
- Interactions: its own `trigger`/`on_death` are empty (`implant.dm:14-18`); activation is via `activate()` (`implant.dm:20-21`), not used for this implant.
- Construction / deconstruction: none. Removal from a person is by the implant-removal surgery (see the hemostat table, `implant_removal.dm`).
- Drops: `item_flags = DROPDEL` (`implant.dm:11`): the implant is deleted when dropped (`(inferred)` from the DROPDEL flag name; the flag itself is defined in `code/__DEFINES/obj_flags.dm`, not read here).

## Exile implant case  `/obj/item/implantcase/exile`   (`code/game/objects/items/implants/implant_exile.dm:19`)

- What it is: a glass case that holds one exile implant. Sold in the exile implant box (`code/game/objects/items/storage/boxes.dm:380-381`, `/obj/item/storage/box/exileimp`).
- Key vars (set on this type):
  - `name = "implant case - 'Exile'"` (`implant_exile.dm:20`)
  - `desc = "A glass case containing an exile implant."` (`:21`)
  - `imp_type = /obj/item/implant/exile` (`:22`)
- Inherited from `/obj/item/implantcase` (`code/game/objects/items/implants/implantcase.dm:1-14`): `desc` overridden; `icon = 'icons/obj/items_and_weapons.dmi'` (`:4`); `icon_state = "implantcase-0"` (`:5`), changed by `update_icon_state` to `"implantcase-[imp.implant_color]"` when loaded (`:17-21`), so the exile case shows `"implantcase-b"`; `inhand_icon_state = "implantcase"` (`:6`); `throw_speed = 2` (`:9`); `throw_range = 5` (`:10`); `w_class = WEIGHT_CLASS_TINY` (`:11`); `custom_materials = list(/datum/material/glass=500)` (`:12`).
- Initialize (`implantcase.dm:63-68`): `if(imp_type) imp = new imp_type(src)` (`:65-66`); `update_icon()` (`:67`); `reagents = imp.reagents` (`:68`). So the case starts with an exile implant inside.
- Interactions:

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| `attackby` pen (literate) | `user.get_active_held_item() == W` | none | prompt `"What would you like the label to be?"` (`implantcase.dm:29`) | with text: `name = "implant case - '[t]'"` (`:35`); without: `name = "implant case"` (`:37`) |
| `attackby` pen, illiterate | | none | `"<span class='notice'>You scribble illegibly on the side of [src]!</span>"` (`:27`) | returns |
| `attackby` implanter with an implant, case empty | `I.imp` set, case has no `imp` | none | none | the implant moves into the case (`:43-48`), `reagents = imp.reagents` (`:47`) |
| `attackby` implanter, case full, implanter empty | | none | none | the implant moves back into the implanter (`:50-58`) |
| other items | | none | none | `..()` (`:60-61`) |

- Drops / deconstruction: none defined; the case is glass (`custom_materials` glass 500, `:12`).
- Health / armor: `max_integrity 200` (from `/obj/item`, `items.dm:57`).
- Power: none.
- Gotchas:
  - The case label can be changed with a pen, and the name then no longer says "Exile" (`implantcase.dm:35`).
  - The exile implant can be moved out of the case into an implanter (`implantcase.dm:50-58`).

## NOT FOUND / open questions (this part)
- The hemostat's `attack` line text in `items.dm` (`attack_verb` line): only the verbs are in this file (`tools.dm:33`).
- `DROPDEL` behaviour and `SURGICAL_TOOL` meaning: flags are defined in `code/__DEFINES/`, not read in this part.
- Surgery step `use` timing (`do_after`) skill modifiers: read from `surgery_step.dm:85-93` only.

### Tally (part 6)
- Entries in this part: 3 on the list (`/obj/item/hemostat`, `/obj/item/implanter/exile`, `/obj/item/implantcase/exile`).
- Documented with real data: 3. NOT FOUND: 0.

# gap-items-03 part 7: blood pack and monkey meat (TG 2020 tree, `_src/tg2020`)

Scope: `/obj/item/reagent_containers/blood/random` (blood pack) and `/obj/item/reagent_containers/food/snacks/meat/slab/monkey` (monkey meat). Parents and the food base are documented once here. Numbers are raw.

---

## Parent: /obj/item/reagent_containers/blood   (`code/modules/reagents/reagent_containers/blood_pack.dm:1`)

- What it is: a transfusion bag. Used on an IV drip (`desc`, `blood_pack.dm:3`).
- Key vars:

| var | value | file:line |
|---|---|---|
| `name` | `"blood pack"` | `blood_pack.dm:2` |
| `desc` | `"Contains blood used for transfusion. Must be attached to an IV drip."` | `:3` |
| `icon` / `icon_state` | `'icons/obj/bloodpack.dmi'` / `"bloodpack"` | `:4-5` |
| `volume` | `200` | `:6` |
| `blood_type` | `null` | `:7` |
| `unique_blood` | `null` | `:8` |
| `labelled` | `0` | `:9` |
| `fill_icon_thresholds` | `list(10, 20, 30, 40, 50, 60, 70, 80, 90, 100)` | `:10` |
| `possible_transfer_amounts`, `amount_per_transfer_from_this` | not set here: inherited from `/obj/item/reagent_containers` (`code/modules/reagents/reagent_containers.dm:7-9`): 5 and `list(5,10,15,20,25,30)` | |
| `reagent_flags`, `spillable` | not set here (`reagent_containers.dm`; not read) | |
| `custom_materials` | not set: none | |

- `Initialize` (`blood_pack.dm:12-16`): `. = ..()`; if `blood_type != null`, `reagents.add_reagent(unique_blood ? unique_blood : /datum/reagent/blood, 200, list("donor"=null,"viruses"=null,"blood_DNA"=null,"blood_type"=blood_type,"resistances"=null,"trace_chem"=null))` (`:15`), then `update_icon()` (`:16`). So a pack with a set blood type starts full (200 units).
- `on_reagent_change` (`:18-26`): reads `blood_type` from the blood reagent's data (`:20-24`), then `update_pack_name()` and `update_icon()` (`:25-26`).
- `update_pack_name` (`:28-33`): when not labelled, the name is `"blood pack - [blood_type]"` if a type is known, else `"blood pack"`.
- `attackby` (`:71-88`): a pen or crayon labels the pack. `"<span class='notice'>You scribble illegibly on the label of [src]!</span>"` (`:74`) if illiterate; prompt `"What would you like to label the blood pack?"` (`:76`); label set `name = "blood pack - [t]"` and `labelled = 1` (`:81-83`); empty input clears `labelled` and calls `update_pack_name()` (`:84-86`). Anything else: `..()` (`:87-88`).
- Subtypes (not on the list): `a_plus` `"A+"` (`:43-44`), `a_minus` `"A-"` (`:46-47`), `b_plus` (`:49-50`), `b_minus` (`:52-53`), `o_plus` (`:55-56`), `o_minus` (`:58-59`), `lizard` `"L"` (`:61-62`), `ethereal` `"LE"` with `unique_blood = /datum/reagent/consumable/liquidelectricity` (`:64-66`), `universal` `"U"` (`:68-69`).

---

## Blood pack, random type  `/obj/item/reagent_containers/blood/random`   (`code/modules/reagents/reagent_containers/blood_pack.dm:35`)

- What it is: a full pack of a random blood type (6 are placed on BoxStation per the list).
- Key vars (set on this type):
  - `icon_state = "random_bloodpack"` (`blood_pack.dm:36`); overwritten to `"bloodpack"` in `Initialize` (`:39`).
- `Initialize` (`blood_pack.dm:38-41`):
  - `icon_state = "bloodpack"` (`:39`)
  - `blood_type = pick("A+", "A-", "B+", "B-", "O+", "O-", "L")` (`:40`). The list includes `"L"` (lizard blood, the same value as `blood_pack.dm:62`).
  - `return ..()` (`:41`): runs the parent `Initialize` (`:12-16`), which adds 200 units of `/datum/reagent/blood` with the picked `blood_type` (`:14-15`).
- Name: `"blood pack"` at spawn (inherited, `:2`). After the blood is added, the name becomes `"blood pack - [blood_type]"` through `on_reagent_change` and `update_pack_name` (`:18-33`) (`(inferred)`: `on_reagent_change` runs when reagents are added).
- Contents at round start: 200 units of blood with the random type (`blood_pack.dm:15`). Capacity 200 (`:6`).
- Interactions: same as the parent (label with a pen or crayon, `blood_pack.dm:71-88`). The IV drip is not documented here.
- Construction / deconstruction: none.
- Drops: none defined.
- Health / armor: `max_integrity` from `/obj/item` (200, `code/game/objects/items.dm:57`). Not overridden.
- Power: none.
- Gotchas:
  - A random pack can be `"L"` (lizard). The type value is in `blood_pack.dm:40`.
  - The label on a labelled pack stops the auto-name (`labelled = 1`, `:82`).

---

## Parent: /obj/item/reagent_containers/food/snacks/meat   (`code/modules/food_and_drinks/food/snacks/meat.dm:1`)

- Base for all meat food. Vars: `subjectname = ""` (`meat.dm:2`), `subjectjob = null` (`:3`), `custom_materials = list(/datum/material/meat = MINERAL_MATERIAL_AMOUNT * 4)` (`:4`; `MINERAL_MATERIAL_AMOUNT` = `2000`, `code/__DEFINES/construction.dm:70`, so `8000` units of meat material), `material_flags = MATERIAL_NO_EFFECTS` (`:5`; `code/__DEFINES/materials.dm:13`), which stops the meat from being eaten twice.

## Parent: /obj/item/reagent_containers/food/snacks/meat/slab   (`code/modules/food_and_drinks/food/snacks/meat.dm:7`)

| var | value | file:line |
|---|---|---|
| `name` | `"meat"` (children override) | `meat.dm:8` |
| `desc` | `"A slab of meat."` | `:9` |
| `icon_state` | `"meat"` | `:10` |
| `dried_type` | `/obj/item/reagent_containers/food/snacks/sosjerky/healthy` | `:11` |
| `bitesize` | `3` | `:12` |
| `list_reagents` | `list(/datum/reagent/consumable/nutriment = 3, /datum/reagent/consumable/cooking_oil = 2)` | `:13` |
| `cooked_type` | `/obj/item/reagent_containers/food/snacks/meat/steak/plain` | `:14` |
| `slice_path` | `/obj/item/reagent_containers/food/snacks/meat/rawcutlet/plain` | `:15` |
| `slices_num` | `3` | `:16` |
| `filling_color` | `"#FF0000"` | `:17` |
| `tastes` | `list("meat" = 1)` | `:18` |
| `foodtype` | `MEAT \| RAW` | `:19` |

- Food base (`code/modules/food_and_drinks/food/snacks.dm:31-58`): `bitesize = 2` (`:40`), `eatverb` set on first use (`:45`, `:90-91`), `value = 10` (`:56`), `obj_flags = UNIQUE_RENAME` (`:38`), `grind_results = list()` (`:39`), `junkiness = 0` (`:52`).
- `Initialize`/`add_initial_reagents` (`snacks.dm:61-71`): `list_reagents` is added only when `tastes` is non-empty (`:62-63`). The slab has `tastes`, so the list is added.
- Volume: the food uses `volume = 30` from `/obj/item/reagent_containers` (`code/modules/reagents/reagent_containers.dm:9`); the slab fills 5 units (3 nutriment + 2 cooking oil), so it is not full.

### Slicing and cooking (the slab's own values, used by the monkey child)

- `slice(accuracy, W, user)` (`snacks.dm:218-249`): needs `slices_num > 0`, a `slice_path`, and to be on a turf with a table, optable or tray (`:222-229`): `"<span class='warning'>You cannot slice [src] here! You need a table or at least a tray.</span>"` (`:228`). A clean cut: `"[user] slices [src]."` and `"<span class='notice'>You slice [src].</span>"` (`:233-236`). An inaccurate cut loses 1 slice: `"[user] inaccurately slices [src] with [W]!"` and `"<span class='notice'>You inaccurately slice [src] with your [W]!</span>"` (`:238-242`, `slices_lost = rand(1,min(1,round(slices_num/2)))`, `:242`). Each slice gets `reagents.total_volume / slices_num` (`:244`) and the source is `qdel`ed (`:248`).
- `initialize_slice` (`meat.dm:21-28`): the slice gets a `"rawcutlet_coloration"` overlay in `filling_color` (`:23-25`), and `slice.name = "raw [name] cutlet"` (`:27`). For the monkey slab that is `"raw monkey meat cutlet"` (`(inferred)` from the concatenation).
- `initialize_cooked_food` (`meat.dm:30-`; `snacks.dm:285-295`): cooked food takes the reagents and the `bonus_reagents` (not read per type).

---

## Monkey meat  `/obj/item/reagent_containers/food/snacks/meat/slab/monkey`   (`code/modules/food_and_drinks/food/snacks/meat.dm:158`)

- What it is: a raw monkey meat slab. Same as the slab.
- Key vars (set on this type):
  - `name = "monkey meat"` (`code/modules/food_and_drinks/food/snacks/meat.dm:159`)
  - `foodtype = RAW | MEAT` (`:160`); the slab has `MEAT | RAW` (`:19`) (same flags, order changed).
- Inherited: `desc = "A slab of meat."` (`:9`), `icon_state = "meat"` (`:10`), `bitesize = 3` (`:12`), `list_reagents` (nutriment 3, cooking oil 2, `:13`), `cooked_type` (`:14`), `slice_path` (`:15`), `slices_num = 3` (`:16`), `tastes = list("meat" = 1)` (`:18`), `custom_materials` (meat 8000, `:4`), `material_flags = MATERIAL_NO_EFFECTS` (`:5`), `value = 10` (`snacks.dm:56`).
- Interactions:

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| eat (`attack` on self, `M == user`) | `user.a_intent != INTENT_HARM`; `canconsume` ok | none | by `fullness` (`snacks.dm:100-115`): `"<span class='notice'>[user] hungrily [eatverb]s \the [src], gobbling it down!</span>"` (fullness <= 50, `:109`); `"<span class='notice'>[user] hungrily [eatverb]s \the [src].</span>"` (50 to 150, `:111`); `"<span class='notice'>[user] [eatverb]s \the [src].</span>"` (150 to 500, `:113`); `"<span class='notice'>[user] unwillingly [eatverb]s a bit of \the [src].</span>"` (500 to 600, `:115`); `"<span class='warning'>[user] cannot force any more of \the [src] to go down [user.p_their()] throat!</span>"` (over the limit, `:117`) | one bite: `reagents.trans_to(M, bitesize, ...)` with `bitesize = 3` (`snacks.dm:147-148`, `meat.dm:12`); `playsound(M.loc,'sound/items/eatfood.ogg', rand(10,50), TRUE)` (`snacks.dm:144`) |
| `eatverb` | first use | none | `pick("bite","chew","nibble","gnaw","gobble","chomp")` (`snacks.dm:91`) | sets `eatverb` |
| feed someone else | target is not the user, `do_mob` | none (see the feed code, `snacks.dm:122-135`) | `"<span class='danger'>[user] attempts to feed [M] [src].</span>"` (`:124`); `"<span class='danger'>[user] forces [M] to eat [src]!</span>"` (`:134`) | bite transfers as above |
| `attack` with `INTENT_HARM` | | none | none | `..()` (`snacks.dm:88-89`) |
| empty (`reagents.total_volume == 0`) | | none | `"<span class='warning'>None of [src] left, oh no!</span>"` (`snacks.dm:93`) | `qdel(src)` (`:94`) |
| after the last bite | `reagents.total_volume` 0 | none | none | `On_Consume(M)` (`snacks.dm:150`): if empty, `generate_trash(location)` (`:78`) and `qdel(src)`; the trash goes into the eater's hands (`:80-81`). `trash` is null on this type, so no trash item |
| `attackby` with a sharp tool | `get_sharpness()` | none | the slice messages above (`snacks.dm:233-242`) | slices into `slice_path` (`meat.dm:15`) |
| `attackby` with a food item | `custom_food_type` set (not on this type) | none | `"<span class='warning'>[S] is too big for [src]!</span>"` (`snacks.dm:177`) and others | not applicable here (`custom_food_type` is null) |

- Cooking: `cooked_type = /obj/item/reagent_containers/food/snacks/meat/steak/plain` (`meat.dm:14`), applied by the microwave (`microwave_act`, `snacks.dm:297`; the microwave file is not read here).
- Drying: `dried_type = /obj/item/reagent_containers/food/snacks/sosjerky/healthy` (`meat.dm:11`), applied by the dryer (not read here).
- Construction / deconstruction: none. Slicing is the only "deconstruction" (`snacks.dm:218-249`).
- Drops: when eaten to nothing, `trash` is null, so nothing; when sliced, the 3 raw cutlets (`meat.dm:16`, `slices_num`) minus `slices_lost` (0 on a clean cut; `snacks.dm:231-245`).
- Health / armor: `max_integrity` from `/obj/item` (200, `items.dm:57`).
- Power: none.
- Gotchas:
  - The meat material is 8000 units (`meat.dm:4`, `MINERAL_MATERIAL_AMOUNT` 2000 x 4, `construction.dm:70`), but `material_flags = MATERIAL_NO_EFFECTS` (`meat.dm:5`) stops it from doing anything more.
  - `list_reagents` is only added because `tastes` is set (`snacks.dm:62-63`). Removing `tastes` removes the 3 nutriment and 2 cooking oil.
  - The monkey meat is a plain slab of meat; there is no species check in this file.

## NOT FOUND / open questions (this part)
- Microwave cooking time and output on the steak: `microwave_act` (`snacks.dm:297`) not read.
- Dryer output (`sosjerky/healthy`): not read.
- `initialize_cooked_food` in `meat.dm:30-` (the slab's override): only its header is in view; not read in full.
- Monkey meat sale value: `value = 10` (`snacks.dm:56`) is the export tier, not a price, per the comment at `snacks.dm:56`.

### Tally (part 7)
- Entries in this part: 2 on the list (`/obj/item/reagent_containers/blood/random`, `/obj/item/reagent_containers/food/snacks/meat/slab/monkey`).
- Documented with real data: 2. NOT FOUND: 0.

# gap-items-03 part 8: beaker and medicine bottles (TG 2020 tree, `_src/tg2020`)

Scope: `/obj/item/reagent_containers/glass/beaker/cryoxadone`, `/obj/item/reagent_containers/glass/bottle/ammonia`, `/obj/item/reagent_containers/glass/bottle/epinephrine`, `/obj/item/reagent_containers/glass/bottle/morphine`. The shared parents are documented once here: the reagent container base, the glass base, the beaker, and the bottle. Numbers are raw (ds for delays; units for reagent amounts).

---

## Parent: /obj/item/reagent_containers   (`code/modules/reagents/reagent_containers.dm:1`)

- Base of all reagent containers. Vars: `amount_per_transfer_from_this = 5` (`reagent_containers.dm:7`), `possible_transfer_amounts = list(5,10,15,20,25,30)` (`:8`), `volume = 30` (`:9`).
- `Initialize(mapload, vol)` (`:18-28`): if `vol` is a positive number, `volume = vol` (`:20-21`); `create_reagents(volume, reagent_flags)` (`:22`); if `spawned_disease`, adds blood with a disease (`:23-26`); then `add_initial_reagents()` (`:28`).
- `add_initial_reagents()` (`:30-32`): `if(list_reagents) reagents.add_reagent_list(list_reagents)`. This is how the contents below are filled at round start.
- `attack_self` (`:34-45`): cycles the transfer amount through `possible_transfer_amounts`. Message: `"<span class='notice'>[src]'s transfer amount is now [amount_per_transfer_from_this] units.</span>"` (`:44`). Wraps to the first entry after the last (`:40-43`).
- `attack` (`:47-49`): with `INTENT_HARM` it calls `..()`; otherwise the glass `attack` runs (see below).
- `canconsume` (`:51-63`): blocks drinking when the target's head or mouth is covered: `"<span class='warning'>You have to remove [who] [covered] first!</span>"` (`:62`).
- `SplashReagents` (`:86-113`): thrown or spilled. `"<span class='danger'>[M] is splashed with something!</span>"` (`:95`), `"<span class='notice'>[src] lands onto the [target.name] without spilling a single drop.</span>"` (`:105`), `"<span class='notice'>[src] spills its contents all over [target].</span>"` (`:113`).
- `on_reagent_change` (`:127`) and `update_overlays` (`:130`): fill-level sprites via `fill_icon_thresholds` (not read).

## Parent: /obj/item/reagent_containers/glass   (`code/modules/reagents/reagent_containers/glass.dm:2`)

| var | value | file:line |
|---|---|---|
| `name` | `"glass"` | `glass.dm:3` |
| `amount_per_transfer_from_this` | `10` | `:4` |
| `possible_transfer_amounts` | `list(5, 10, 15, 20, 25, 30, 50)` | `:5` |
| `volume` | `50` | `:6` |
| `reagent_flags` | `OPENCONTAINER \| DUNKABLE` | `:7` |
| `spillable` | `TRUE` | `:8` |
| `resistance_flags` | `ACID_PROOF` | `:9` |

- `attack` (`glass.dm:12-52`):
  - Empty: `"<span class='warning'>[src] is empty!</span>"` (`:20`).
  - Harm intent on a mob: `"<span class='danger'>[user] splashes the contents of [src] onto [M]!</span>"` (`:26`), then `reagents.expose(M, TOUCH)` and `clear_reagents()` (`:35-37`).
  - Feed another mob: `"<span class='danger'>[user] attempts to feed [M] something from [src].</span>"` (`:40`), a `do_mob` wait (`:42`, no delay value on the line, the wait is the default `do_mob` timing), then `"<span class='danger'>[user] feeds [M] something from [src].</span>"` (`:46`).
  - Drink self: `"<span class='notice'>You swallow a gulp of [src].</span>"` (`:50`).
  - Each gulp: `addtimer(CALLBACK(reagents, trans_to, M, 5, ...), 5)` transfers **5 units** to the drinker after a **5 ds** timer (`:51`), `playsound(M.loc,'sound/items/drink.ogg', rand(10,50), TRUE)` (`:52`).
- `afterattack` (`glass.dm:54-91`) with a target and `proximity`, `check_allowed_items` ok:
  - Target is refillable (a container): empty source `"<span class='warning'>[src] is empty!</span>"` (`:64`); target full `"<span class='warning'>[target] is full.</span>"` (`:68`); else `reagents.trans_to(target, amount_per_transfer_from_this)` and `"<span class='notice'>You transfer [trans] unit\s of the solution to [target].</span>"` (`:71-72`).
  - Target is drainable (a dispenser): target empty `"<span class='warning'>[target] is empty and can't be refilled!</span>"` (`:76`); source full `"<span class='warning'>[src] is full.</span>"` (`:80`); else pulls `amount_per_transfer_from_this` units and `"<span class='notice'>You fill [src] with [trans] unit\s of the contents of [target].</span>"` (`:83-84`).
  - Otherwise with contents and harm intent: `"<span class='danger'>[user] splashes the contents of [src] onto [target]!</span>"` (`:88`) or `"<span class='notice'>You splash the contents of [src] onto [target].</span>"` (`:89`); expose and clear (`:90-91`).
- `attackby` (`glass.dm:93-109`): heat from `I.get_temperature()` gives `"<span class='notice'>You heat [name] with [I]!</span>"` (`:97`). An egg breaks into the glass: `"<span class='notice'>[src] is full.</span>"` (`:103`) or `"<span class='notice'>You break [E] in [src].</span>"` (`:105`). Otherwise `..()`.
- Construction: none in this file.

## Parent: /obj/item/reagent_containers/glass/beaker   (`code/modules/reagents/reagent_containers/glass.dm:112`)

- Key vars (set on the type): `name = "beaker"` (`glass.dm:113`), `desc = "A beaker. It can hold up to 50 units."` (`:114`), `icon = 'icons/obj/chemical.dmi'` (`:115`), `icon_state = "beaker"` (`:116`), `inhand_icon_state = "beaker"` (`:117`), `custom_materials = list(/datum/material/glass=500)` (`:118`), `fill_icon_thresholds = list(0, 10, 25, 50, 75, 80, 90)` (`:119`).
- Volume 50, from `/obj/item/reagent_containers/glass` (`glass.dm:6`), matching the desc.
- `Initialize` (`glass.dm:121-123`): `update_icon()`. `get_part_rating()` returns `reagents.maximum_volume` (`:125-126`), so the beaker's capacity is its part rating.

## Parent: /obj/item/reagent_containers/glass/bottle   (`code/modules/reagents/reagent_containers/bottle.dm:3`)

| var | value | file:line |
|---|---|---|
| `name` | `"bottle"` | `bottle.dm:4` |
| `desc` | `"A small bottle."` | `:5` |
| `icon_state` | `"bottle"` | `:6` |
| `inhand_icon_state` | `"atoxinbottle"` | `:7` |
| `possible_transfer_amounts` | `list(5,10,15,25,30)` | `:8` |
| `volume` | `30` | `:9` |
| `fill_icon_thresholds` | `list(0, 10, 30, 50, 70)` | `:10` |
| `icon` | not set here: inherited from `/obj/item/reagent_containers` (not read) | |
| `amount_per_transfer_from_this` | `10` (inherited from `glass.dm:4`) | |

- `Initialize` (`bottle.dm:12-16`): `if(!icon_state) icon_state = "bottle"`, `update_icon()`.
- Bottles take the glass `attack`, `afterattack` and `attackby` (above). `spillable` is TRUE (`glass.dm:8`).

---

## Beaker, cryoxadone  `/obj/item/reagent_containers/glass/beaker/cryoxadone`   (`code/modules/reagents/reagent_containers/glass.dm:184`)

- What it is: a beaker of cryoxadone medicine, used with the cryo tube (the cryo machine is not read here).
- Key vars (set on this type):
  - `list_reagents = list(/datum/reagent/medicine/cryoxadone = 30)` (`glass.dm:185`)
- Inherited: `name = "beaker"` (`:113`), `desc = "A beaker. It can hold up to 50 units."` (`:114`), `icon_state = "beaker"` (`:116`), `custom_materials = glass 500` (`:118`), `volume 50` (`glass.dm:6`), `possible_transfer_amounts = list(5, 10, 15, 20, 25, 30, 50)` (`glass.dm:5`), `amount_per_transfer_from_this = 10` (`glass.dm:4`).
- Contents at round start: `cryoxadone` 30 units (`glass.dm:185`), added by `add_initial_reagents` (`reagent_containers.dm:30-32`). So it is 30 of 50.
- Map count on BoxStation: 4 (from the list).
- Interactions: glass `attack`, `afterattack`, `attackby` (above); `attack_self` cycles the transfer amount (`reagent_containers.dm:34-45`).
- Construction / deconstruction: none in this file.
- Drops: none defined. A beaker is glass; no break behaviour is read here.
- Health / armor: `resistance_flags = ACID_PROOF` (`glass.dm:9`); `max_integrity` from `/obj/item` (200, `items.dm:57`) if not changed by `reagent_containers` (not read).
- Power: none.
- Gotchas: the description says 50 units while the contents are 30; the transfer list is the glass one (`glass.dm:5`).

## Bottle, ammonia  `/obj/item/reagent_containers/glass/bottle/ammonia`   (`code/modules/reagents/reagent_containers/bottle.dm:85`)

- Key vars (set on this type):
  - `name = "ammonia bottle"` (`bottle.dm:86`)
  - `desc = "A small bottle of ammonia."` (`:87`)
  - `list_reagents = list(/datum/reagent/ammonia = 30)` (`:88`)
- Inherited: `icon_state = "bottle"` (`bottle.dm:6`), `volume = 30` (`:9`), `possible_transfer_amounts = list(5,10,15,25,30)` (`:8`), `amount_per_transfer_from_this = 10` (`glass.dm:4`).
- Contents at round start: 30 units of ammonia (`bottle.dm:88`), the bottle is full.
- Map count on BoxStation: 1 (from the list).
- Interactions and drops: the glass set (above). No own procs.
- Gotchas: this bottle has no `icon` of its own; the sprite is the parent's (`(inferred)`).

## Bottle, epinephrine  `/obj/item/reagent_containers/glass/bottle/epinephrine`   (`code/modules/reagents/reagent_containers/bottle.dm:18`)

- Key vars (set on this type):
  - `name = "epinephrine bottle"` (`bottle.dm:19`)
  - `desc = "A small bottle. Contains epinephrine - used to stabilize patients."` (`:20`)
  - `list_reagents = list(/datum/reagent/medicine/epinephrine = 30)` (`:21`)
- Inherited: as the ammonia bottle.
- Contents at round start: 30 units of epinephrine (`bottle.dm:21`).
- Map count on BoxStation: 5 (from the list).
- Interactions and drops: the glass set. No own procs.

## Bottle, morphine  `/obj/item/reagent_containers/glass/bottle/morphine`   (`code/modules/reagents/reagent_containers/bottle.dm:38`)

- Key vars (set on this type):
  - `name = "morphine bottle"` (`bottle.dm:39`)
  - `desc = "A small bottle of morphine."` (`:40`)
  - `icon = 'icons/obj/chemical.dmi'` (`:41`) (sets its own icon; the others inherit)
  - `list_reagents = list(/datum/reagent/medicine/morphine = 30)` (`:42`)
- Inherited: as the ammonia bottle.
- Contents at round start: 30 units of morphine (`bottle.dm:42`).
- Map count on BoxStation: 1 (from the list).
- Interactions and drops: the glass set. No own procs.

---

## NOT FOUND / open questions (this part)
- `fill_icon_thresholds` sprite levels on `reagent_containers`: not read.
- Drink/feed timing for the `do_mob` in the glass `attack`: the call on `glass.dm:42` has no explicit delay value; the default `do_mob` timing is not read.
- Medicine effects of cryoxadone, ammonia, epinephrine, morphine: the reagent files are not read in this part (contents and amounts only).
- Glass break/destroy behaviour: not read in `glass.dm`.

### Tally (part 8)
- Entries in this part: 4 on the list (`cryoxadone` beaker, `ammonia` bottle, `epinephrine` bottle, `morphine` bottle).
- Documented with real data: 4. NOT FOUND: 0.

# gap-items-03 part 9: stun baton and emergency pickaxe (TG 2020 tree, `_src/tg2020`)

Scope: `/obj/item/melee/baton/loaded` (stun baton) and `/obj/item/pickaxe/emergency` (emergency disembarkation tool). Each parent is documented here. Numbers are raw. `N SECONDS` macros are `N * 10` ds (`code/__DEFINES/time.dm:41`).

---

## Parent: /obj/item/melee/baton   (`code/game/objects/items/stunbaton.dm:1`)

- What it is: a security stun baton. Off it is a melee weapon; on, and with charge, each hit runs `baton_effect` (stamina damage, confusion and a delayed knockdown).

### Key vars (parent)

| var | value | file:line |
|---|---|---|
| `name` | `"stun baton"` | `stunbaton.dm:2` |
| `desc` | `"A stun baton for incapacitating people with."` | `:3` |
| `icon_state` | `"stunbaton"` | `:5` |
| `inhand_icon_state` / `worn_icon_state` | `"baton"` / `"baton"` | `:6-7` |
| `force` | `10` | `:11` |
| `attack_verb` | `list("beaten")` | `:12` |
| `w_class` | `WEIGHT_CLASS_NORMAL` | `:14` |
| `slot_flags` | `ITEM_SLOT_BELT` | `:15` |
| `armor` | `melee 0, bullet 0, laser 0, energy 0, bomb 50, bio 0, rad 0, fire 80, acid 80` | `:16` |
| `throwforce` | `7` | `:18` |
| `throw_stun_chance` | `35` | `:19` |
| `cell` | none on the type (set in `Initialize` from `preload_cell_type`) | `:21` |
| `preload_cell_type` | `null` on the parent | `:22` |
| `cell_hit_cost` | `1000` | `:23` |
| `can_remove_cell` | `TRUE` | `:24` |
| `turned_on` | `FALSE` | `:26` |
| `activate_sound` | `"sparks"` | `:27` |
| `attack_cooldown_check` | `0 SECONDS` = `0` ds | `:29` |
| `attack_cooldown` | `2.5 SECONDS` = `25` ds | `:30` |
| `stun_sound` | `'sound/weapons/egloves.ogg'` | `:31` |
| `confusion_amt` | `10` | `:33` |
| `stamina_loss_amt` | `60` | `:34` |
| `apply_stun_delay` | `2 SECONDS` = `20` ds | `:35` |
| `stun_time` | `5 SECONDS` = `50` ds | `:36` |
| `convertible` | `TRUE` (a conversion kit can make a classic baton) | `:38` |
| `max_integrity` | `200` (from `/obj/item`, `code/game/objects/items.dm:57`) | |

### Interactions (parent)

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| `attack_self` | any | none | none on success; `toggle_on` (`stunbaton.dm:152-153`) | toggles on or off |
| `toggle_on` with charge `> cell_hit_cost` | `cell.charge > 1000` (`:156`) | none | `"<span class='notice'>[src] is now [turned_on ? "on" : "off"].</span>"` (`:158`); sound `activate_sound` vol 75 (`:159`) | `turned_on = !turned_on` (`:157`) |
| `toggle_on`, no cell | `!cell` | none | `"<span class='warning'>[src] does not have a power source!</span>"` (`:163`) | `turned_on = FALSE` (`:161`) |
| `toggle_on`, low charge | cell present, charge `<= 1000` | none | `"<span class='warning'>[src] is out of charge.</span>"` (`:165`) | `turned_on = FALSE` (`:161`) |
| `attack` (any mob), clumsy user | `turned_on`, `TRAIT_CLUMSY`, `prob(50)` (`:170-172`) | none (knockdown `stun_time*3` = 150 ds, `:174`) | `"<span class='danger'>[user] accidentally hits [user.p_them()]self with [src]!</span>"` (`:172`); `"<span class='userdanger'>You accidentally hit yourself with [src]!</span>"` (`:173`) | `Knockdown(stun_time*3)` (`:174`); `deductcharge(cell_hit_cost)` (`:175`) |
| `attack` on a cyborg | `iscyborg(M)` (`:183`) | none | none | `..()` (`:184`) |
| `attack` on a human with martial counter | `check_martial_counter` (`:190`) | none | none | returns |
| `attack` with a non-harm intent, baton on | `attack_cooldown_check <= world.time` (`:195`) | `attack_cooldown` 25 ds after a stun (`:247`) | none | `baton_effect(M, user)` (`:196`) |
| `attack` with a non-harm intent, baton on, still charging | `attack_cooldown_check > world.time` | none | `"<span class='danger'>The baton is still charging!</span>"` (`:200`) | nothing |
| `attack` with a non-harm intent, baton off | `turned_on` FALSE | none | `"<span class='warning'>[user] prods [M] with [src]. Luckily it was off.</span>"` (`:202`) and `"<span class='warning'>[user] prods you with [src]. Luckily it was off.</span>"` (`:203`) | nothing |
| `attack` with harm intent, baton on | `turned_on` and cooldown ok (`:205-206`) | none | none | `baton_effect(M, user)` (`:207`), then `..()` (`:208`) (normal weapon hit with `force` 10) |
| `baton_effect` (the stun) | not blocked by `shields_blocked` (`:212-213`); target not `TRAIT_IWASBATONED` from this user (`:214-216`); `deductcharge(1000)` succeeds (`:222-223`) | `Jitter(20)`, `confused = max(10, ...)`, `stuttering = max(8, ...)` (`:226-228`); stamina `60` (`:229`); stun check `addtimer(apply_stun_effect_end, 20)` (`:232`) | `"<span class='userdanger'>[user] stuns you with [src]!</span>"` and `"<span class='danger'>[user] stuns [L] with [src]!</span>"` (`:237-238`, if a user); `"<span class='warning'>[L] manages to avoid the attack!</span>"` (`:215`) if already batoned by this user | cooldown `attack_cooldown` 25 ds (`:247`); trait `TRAIT_IWASBATONED` for 25 ds (`:249-250`); sound `stun_sound` vol 50 (`:241`); `forcesay(GLOB.hit_appends)` for humans (`:245`) |
| `apply_stun_effect_end` (after 20 ds) | | 20 ds (from `:232`) | `"<span class='warning'>Your muscles seize, making you collapse[, but your body quickly recovers...]</span>"` (`:258`) if not already knocked down | `Knockdown(stun_time * 0.1)` = 5 ds with `TRAIT_STUNRESISTANCE` (`:260-261`), else `Knockdown(stun_time)` = 50 ds (`:262-263`) |
| `throw_impact` | `turned_on`, `prob(throw_stun_chance)` (35), target is carbon (`:90`) | none | none | `baton_effect(hit_atom)` (`:91`) |
| `attackby` a cell | no cell yet, `C.maxcharge >= 1000` (`:129`) | none | `"<span class='warning'>[src] already has a cell!</span>"` (`:127`) if one is in; `"<span class='notice'>[src] requires a higher capacity cell.</span>"` (`:130`) if too small; `"<span class='notice'>You install a cell in [src].</span>"` (`:135`) | `transferItemToLoc`, `cell = W` (`:132-134`) |
| `attackby` screwdriver (`TOOL_SCREWDRIVER`) | | none | `"<span class='notice'>You remove the cell from [src].</span>"` (`:148`) if `cell && can_remove_cell` | `cell` dropped on the turf (`:145-147`), `turned_on = FALSE` (`:149`) |
| `examine` | | none | `"<span class='notice'>\The [src] is [round(cell.percent())]% charged.</span>"` (`:119`) or `"<span class='warning'>\The [src] does not have a power source installed.</span>"` (`:121`) | none |
| `emp_act` | not `EMP_PROTECT_SELF` (`:267`) | none | none | `deductcharge(1000 / severity)` (`:268`) |
| conversion kit (`COMSIG_PARENT_ATTACKBY`) | `convertible` and the item is a `/obj/item/conversion_kit` (`:69-70`) | sound `'sound/items/drill_use.ogg'` vol 80 (`:74`); `animate` 10 ds (`:75-76`) | none | makes a `/obj/item/melee/classic_baton` (`:72`), deletes the kit and this baton (`:77-78`) |

- `deductcharge(chrg)` (`stunbaton.dm:96-105`): `cell.use(chrg)`; below `cell_hit_cost` while on, `turned_on = FALSE` and the `activate_sound` (`:101-105`).
- `shields_blocked` (`:270-`): the shield check; not read in full.

### Construction / deconstruction / drops (parent)
- Construction: none (the baton is not built from parts here; the conversion kit is the only other item that changes it).
- Deconstruction: the cell comes out with a screwdriver (`stunbaton.dm:138-139`, `:143-150`). Only if `can_remove_cell` is TRUE.
- Destroy (`stunbaton.dm:63-67`): `QDEL_NULL(cell)` and unregister the conversion signal. Nothing is dropped.
- Power: `cell_hit_cost` 1000 per hit (`stunbaton.dm:23`), `deductcharge` on each stun (`:222`). The cell is `/obj/item/stock_parts/cell/high` on the loaded type.

---

## Stun baton, loaded  `/obj/item/melee/baton/loaded`   (`code/game/objects/items/stunbaton.dm:93`)

- What it is: the stun baton with a high-capacity cell already installed (the standard security baton).
- Key vars (set on this type):
  - `preload_cell_type = /obj/item/stock_parts/cell/high` (`stunbaton.dm:94`)
- Inherited from the parent (all values above): `name "stun baton"`, `force 10`, `throwforce 7`, `slot_flags BELT`, `w_class NORMAL`, `armor`, `cell_hit_cost 1000`, etc.
- `Initialize` (`stunbaton.dm:52-60`): `. = ..()`; `if(preload_cell_type)` makes `cell = new preload_cell_type(src)` (`:54-58`), so a `/obj/item/stock_parts/cell/high` is created; `update_icon()` (`:59`); the conversion signal is registered (`:60`).
- Cell: `/obj/item/stock_parts/cell/high`, `maxcharge = 10000`, `name = "high-capacity power cell"` (`code/modules/power/cell.dm:249-253`). That is 10 full-cost stuns (`10000 / 1000`, `(inferred)`).
- Map count on BoxStation: none in the list.
- Interactions and drops: the parent tables. The cell is removable by screwdriver (`stunbaton.dm:143-150`).
- Gotchas:
  - A stun costs 1000 units and only runs with charge above 1000 (`stunbaton.dm:156`).
  - The stun is delayed 20 ds before the knockdown (`:232`, `:255-263`).
  - The loaded and unloaded batons have the same parent values; the only difference is the starting cell.

---

## Parent: /obj/item/pickaxe   (`code/modules/mining/equipment/mining_tools.dm:2`)

| var | value | file:line |
|---|---|---|
| `name` | `"pickaxe"` | `mining_tools.dm:3` |
| `icon` / `icon_state` | `'icons/obj/mining.dmi'` / `"pickaxe"` | `:4-5` |
| `flags_1` | `CONDUCT_1` | `:6` |
| `slot_flags` | `ITEM_SLOT_BELT \| ITEM_SLOT_BACK` | `:7` |
| `force` | `15` | `:8` |
| `throwforce` | `10` | `:9` |
| `inhand_icon_state` / `worn_icon_state` | `"pickaxe"` / `"pickaxe"` | `:10-11` |
| `lefthand_file` / `righthand_file` | `'icons/mob/inhands/equipment/mining_lefthand.dmi'` / `'icons/mob/inhands/equipment/mining_righthand.dmi'` | `:12-13` |
| `w_class` | `WEIGHT_CLASS_BULKY` | `:14` |
| `custom_materials` | `list(/datum/material/iron=2000)` (comment: "one sheet, but where can you make them?") | `:15` |
| `tool_behaviour` | `TOOL_MINING` | `:16` |
| `toolspeed` | `1` | `:17` |
| `usesound` | `list('sound/effects/picaxe1.ogg', 'sound/effects/picaxe2.ogg', 'sound/effects/picaxe3.ogg')` | `:18` |
| `attack_verb` | `list("hit", "pierced", "sliced", "attacked")` | `:19` |
| `max_integrity` | `200` (from `/obj/item`) | |

- `suicide_act` (`mining_tools.dm:21-26`): `"<span class='suicide'>[user] begins digging into [user.p_their()] chest! It looks like [user.p_theyre()] trying to commit suicide!</span>"` (`:22`); `use_tool(user, user, 30, volume=50)` = **30 ds** (`:23`); success returns `BRUTELOSS` (`:24`); failure `"<span class='suicide'>[user] couldn't do it!</span>"` (`:25`) and `SHAME` (`:26`).
- Mining use (the tool's main action, not a proc on the pickaxe): a mineral wall's `attackby` with `TOOL_MINING` (`code/game/turfs/closed/minerals.dm:59-75`): `"<span class='notice'>You start picking...</span>"` (`:72`), then `I.use_tool(src, user, 40, volume=50)` = **40 ds** base (`:74`), scaled by `toolspeed` and the mining skill (`code/game/objects/items.dm:853`: `delay *= toolspeed * skill_modifier`; `items.dm:846-848`). A Journeyman miner may get a mineral scan pulse (`items.dm:850-851`).
- Other tool users of `TOOL_MINING` (not read here): `code/game/objects/structures/flora.dm:396`, `code/game/objects/structures/mineral_doors.dm:150`, `code/game/turfs/open/floor/plating/asteroid.dm:69`, `code/datums/components/archaeology.dm:36`.

---

## Emergency disembarkation tool  `/obj/item/pickaxe/emergency`   (`code/modules/shuttle/emergency.dm:519`)

- What it is: a pickaxe from the emergency pod's wall safe, for getting out of a rough landing.
- Key vars (set on this type):
  - `name = "emergency disembarkation tool"` (`code/modules/shuttle/emergency.dm:520`)
  - `desc = "For extracting yourself from rough landings."` (`:521`)
- Inherited from `/obj/item/pickaxe` (`mining_tools.dm:2-19`): `icon_state "pickaxe"`, `force 15`, `throwforce 10`, `slot_flags BELT|BACK`, `w_class BULKY`, `custom_materials iron 2000`, `tool_behaviour TOOL_MINING`, `toolspeed 1`, `attack_verb` `hit/pierced/sliced/attacked`, `usesound` picaxe sounds.
- Contents: none.
- Where it is: two in the emergency pod's wall safe (`code/modules/shuttle/emergency.dm:541-542`, `/obj/item/storage/pod/PopulateContents`). That matches the 2 on BoxStation in the list.
- Interactions: the parent (suicide, mining on mineral walls, melee). No own procs.
- Construction / deconstruction: none.
- Drops: none defined.
- Health / armor: `max_integrity` 200 (from `/obj/item`, `items.dm:57`).
- Power: none.
- Gotchas:
  - It is a full pickaxe (`force 15`, mining tool) with a different name and desc only.
  - The pod safe itself is `unlocked`-gated (`emergency.dm:530` `var/unlocked = FALSE`; the check is not read in this part).

## NOT FOUND / open questions (this part)
- `shields_blocked` (`stunbaton.dm:270-`): not read in full; the shield list is not documented.
- Baton `convert` target `/obj/item/melee/classic_baton`: not documented (not on the list).
- Mineral wall full result (the ore drop) in `minerals.dm:74-` after `use_tool`: not read in this part.
- Emergency pod safe unlock check (`/obj/item/storage/pod`, `emergency.dm:530-560`): only partly read.

## Coverage

Whole shard (`gap-items-03`, parts 1 to 9):
- Entries on the list: 28.
- Documented with real data: 28. Each path has its own entry; a path that shares a block with another is written out in its own heading or row.
- Marked NOT FOUND: 0.
- Paths with no own definition (resolved to a parent, see the entry): 1.
- Paths `tgwhere` could not locate by its own definition, exact `tgwhere` output:
  `/obj/item/clothing/suit/space/emergency  NO OWN DEFINITION (it may be a map-only or macro-made type); nearest defined ancestor /obj/item/clothing/suit/space  code/modules/clothing/spacesuits/_spacesuits.dm:27`
- Per-part entry counts: part 1 = 4 (judge's robe, space suit emergency, rainbow jumpsuit, assistant's formal uniform); part 2 = 5 (coins); part 3 = 2 (defibrillator loaded, compact loaded); part 4 = 2 (air alarm electronics, tracker electronics); part 5 = 4 (station bounced radio off, electropack, nuke pinpointer, MMI); part 6 = 3 (hemostat, exile implanter, exile implant case); part 7 = 2 (blood pack random, monkey meat); part 8 = 4 (cryoxadone beaker, ammonia, epinephrine, morphine bottles); part 9 = 2 (stun baton loaded, emergency disembarkation tool).

