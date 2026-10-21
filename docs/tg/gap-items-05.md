# gap-items-05 part 1: stacks (glass, metal, space cash, wrapping paper), pipe cleaner coil, power cell

Tree: `_src/tg2020` (commit 2d6c10c1). Paths are relative to the tree root. Numbers are raw (deciseconds where a time is given, watts never used here).
Items in this part (9 of 28): `/obj/item/stack/pipe_cleaner_coil/random`, `/obj/item/stack/sheet/glass/fifty`, `/obj/item/stack/sheet/metal/fifty`, `/obj/item/stack/sheet/metal/five`, `/obj/item/stack/spacecash/c10`, `/obj/item/stack/spacecash/c100`, `/obj/item/stack/spacecash/c200`, `/obj/item/stack/wrapping_paper`, `/obj/item/stock_parts/cell/high/plus`.

## Shared parent: /obj/item/stack (every stack item below inherits this unless noted)

| var / behaviour | value | file:line |
|---|---|---|
| `max_integrity` | 100 | code/game/objects/items/stacks/stack.dm:17 |
| `amount` default | 1 | code/game/objects/items/stacks/stack.dm:20 |
| `max_amount` default | 50 | code/game/objects/items/stacks/stack.dm:21 |
| `full_w_class` default | WEIGHT_CLASS_NORMAL (= 3) | code/game/objects/items/stacks/stack.dm:26, code/__DEFINES/inventory.dm:9 |
| `novariants` default | TRUE (icon does not change with amount) | code/game/objects/items/stacks/stack.dm:27 |
| `merge_type` | set to own type if null | code/game/objects/items/stacks/stack.dm:59-60 |
| `cost` / `is_cyborg` | 1 / 0 (cyborg energy stacks only) | code/game/objects/items/stacks/stack.dm:22-24 |

Behaviour of every stack (parent procs):
- **Initialize** (code/game/objects/items/stacks/stack.dm:53-82): if `amount > max_amount` the excess is split off into new stacks (code/game/objects/items/stacks/stack.dm:56-58). Custom materials are multiplied by `amount` (code/game/objects/items/stacks/stack.dm:61-66). Then every stack on the same turf whose `merge_type` matches is merged into this one, silently (code/game/objects/items/stacks/stack.dm:68-71). `update_weight()` runs (code/game/objects/items/stacks/stack.dm:81).
- **update_weight** (code/game/objects/items/stacks/stack.dm:88-95): `amount <= max_amount/3` gives `w_class = clamp(full_w_class-2, TINY, full_w_class)`; `amount <= 2*max_amount/3` gives `full_w_class-1` (clamped); otherwise `w_class = full_w_class`.
- **attack_self** (code/game/objects/items/stacks/stack.dm:138-139) calls `interact` then `ui_interact` (code/game/objects/items/stacks/stack.dm:141-144): opens the stack recipe menu. The menu prints "Amount Left: [n]" and one line per recipe, `title (req_amount singular_name)` (code/game/objects/items/stacks/stack.dm:155-181). No delay.
- **attack_hand** (code/game/objects/items/stacks/stack.dm:405-411): if the stack is in your inactive hand, `change_stack(user,1)` splits 1 unit into your hand (code/game/objects/items/stacks/stack.dm:435-446). No delay, no message.
- **AltClick** (code/game/objects/items/stacks/stack.dm:413-433): asks `"How many sheets do you wish to take out of this stack? (Maximum  [max])"` (note two spaces in the source, code/game/objects/items/stacks/stack.dm:426), then on success `"You take [stackmaterial] sheets out of the stack."` (code/game/objects/items/stacks/stack.dm:433).
- **attackby with the same merge_type stack** (code/game/objects/items/stacks/stack.dm:448-452): merges, then `"Your [S.name] stack now contains [S.get_amount()] [S.singular_name]\s."` No delay.
- **Crossed / hitby** with a same-merge_type stack: auto-merge, no message (code/game/objects/items/stacks/stack.dm:394-402).
- **use(used, transfer)** (code/game/objects/items/stacks/stack.dm:325-342): returns FALSE if `amount < used`; otherwise subtracts; `qdel` when amount reaches 0 (code/game/objects/items/stacks/stack.dm:358-364).
- **examine** (code/game/objects/items/stacks/stack.dm:113-130): `"There are [n] [singular_name]\s in the stack."` or `"There is [n] [singular_name] in the stack."`, then `"<span class='notice'>Alt-click to take a custom amount.</span>"` (code/game/objects/items/stacks/stack.dm:130).
- **Recipe datum** `/datum/stack_recipe/New(title, result_type, req_amount = 1, res_amount = 1, max_res_amount = 1, time = 0, ...)` (code/game/objects/items/stacks/stack.dm:485). Build delay: `do_after(usr, adjusted_time)` where `adjusted_time = R.time` (or `R.time * trait_modifier` with a trait booster) (code/game/objects/items/stacks/stack.dm:220-227). The unit is deciseconds because `do_after` takes ds (inferred from the DM proc; no conversion in the code).
- A recipe with `max_res_amount > 1` makes a stack of `res_amount * multiplier` (code/game/objects/items/stacks/stack.dm:233-234). It consumes `req_amount * multiplier` sheets (code/game/objects/items/stacks/stack.dm:244).

## Shared parent: /obj/item/stack/sheet (sheet-type stacks; applies to both metal and glass items)

| var | value | file:line |
|---|---|---|
| `force` | 5 | code/game/objects/items/stacks/sheets/sheets.dm:6 |
| `throwforce` | 5 (metal overrides to 10) | code/game/objects/items/stacks/sheets/sheets.dm:7 |
| `max_amount` | 50 | code/game/objects/items/stacks/sheets/sheets.dm:8 |
| `throw_speed` / `throw_range` | 1 / 3 | code/game/objects/items/stacks/sheets/sheets.dm:9-10 |
| `attack_verb` | "bashed", "battered", "bludgeoned", "thrashed", "smashed" | code/game/objects/items/stacks/sheets/sheets.dm:11 |
| `novariants` | FALSE (icon changes at 1/3 and 2/3 of max, code/game/objects/items/stacks/stack.dm:97-105) | code/game/objects/items/stacks/sheets/sheets.dm:12 |
| `point_value` | 0 (children override) | code/game/objects/items/stacks/sheets/sheets.dm:14 |
| `full_w_class` | WEIGHT_CLASS_NORMAL | code/game/objects/items/stacks/sheets/sheets.dm:5 |
| Initialize | `pixel_x`/`pixel_y = rand(-4, 4)` | code/game/objects/items/stacks/sheets/sheets.dm:18-21 |

---

## Glass

### glass  `/obj/item/stack/sheet/glass/fifty`   (code/game/objects/items/stacks/sheets/glass.dm:40-41)
- A stack of 50 glass sheets. Parent `/obj/item/stack/sheet/glass` (code/game/objects/items/stacks/sheets/glass.dm:16). Map count: x14 on BoxStation.
- Key vars (final values):

| var | value | from |
|---|---|---|
| `name` | "glass" | code/game/objects/items/stacks/sheets/glass.dm:17 |
| `desc` | "HOLY SHEET! That is a lot of glass." | code/game/objects/items/stacks/sheets/glass.dm:18 |
| `singular_name` | "glass sheet" | code/game/objects/items/stacks/sheets/glass.dm:19 |
| `amount` | 50 | code/game/objects/items/stacks/sheets/glass.dm:41 (own) |
| `max_amount` | 50 | code/game/objects/items/stacks/sheets/sheets.dm:8 |
| `icon_state` / `inhand_icon_state` | "sheet-glass" / "sheet-glass" | code/game/objects/items/stacks/sheets/glass.dm:20-21 |
| `custom_materials` | glass = MINERAL_MATERIAL_AMOUNT (2000 per sheet; x50 at spawn) | code/game/objects/items/stacks/sheets/glass.dm:22, code/__DEFINES/construction.dm:70, code/game/objects/items/stacks/stack.dm:61-66 |
| `armor` | melee 0, bullet 0, laser 0, energy 0, bomb 0, bio 0, rad 0, fire 50, acid 100 | code/game/objects/items/stacks/sheets/glass.dm:23 |
| `resistance_flags` | ACID_PROOF | code/game/objects/items/stacks/sheets/glass.dm:24 |
| `merge_type` | /obj/item/stack/sheet/glass | code/game/objects/items/stacks/sheets/glass.dm:25 |
| `grind_results` | silicon = 20 per sheet (x amount when ground) | code/game/objects/items/stacks/sheets/glass.dm:26, code/game/objects/items/stacks/stack.dm:43-45 |
| `material_type` | /datum/material/glass | code/game/objects/items/stacks/sheets/glass.dm:27 |
| `point_value` | 1 | code/game/objects/items/stacks/sheets/glass.dm:28 |
| `tableVariant` | /obj/structure/table/glass | code/game/objects/items/stacks/sheets/glass.dm:29 |
| `w_class` | NORMAL (3) at 50 sheets, via update_weight | code/game/objects/items/stacks/stack.dm:88-95 |

- Interactions:

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| attack_self (empty hand or any) | none | 0 | none | opens the recipe menu: "directional window" (req 1, `time = 0`, code/game/objects/items/stacks/sheets/glass.dm:12) and "fulltile window" (req 2, `time = 0`, code/game/objects/items/stacks/sheets/glass.dm:13) |
| cable coil (`/obj/item/stack/cable_coil`) | needs >= 5 coil and >= 1 glass (code/game/objects/items/stacks/sheets/glass.dm:51) | none | fail: `"<span class='warning>You need five lengths of coil and one sheet of glass to make wired glass!</span>"` (code/game/objects/items/stacks/sheets/glass.dm:52, the opening attribute quote is never closed in source); success: `"You attach wire to the [name]."` (code/game/objects/items/stacks/sheets/glass.dm:56) | `CC.use(5)`, `use(1)` (code/game/objects/items/stacks/sheets/glass.dm:54-55), spawns one `/obj/item/stack/light_w` at user loc (code/game/objects/items/stacks/sheets/glass.dm:57) |
| rods (`/obj/item/stack/rods`) | needs >= 1 rod and >= 1 glass (code/game/objects/items/stacks/sheets/glass.dm:61) | none | fail: `"You need one rod and one sheet of glass to make reinforced glass!"` (code/game/objects/items/stacks/sheets/glass.dm:70) | spawns one `/obj/item/stack/sheet/rglass` (code/game/objects/items/stacks/sheets/glass.dm:62), `V.use(1)`, `use(1)` (code/game/objects/items/stacks/sheets/glass.dm:65-66); if this stack was deleted and was in the inactive hand the new sheet goes into the hand (code/game/objects/items/stacks/sheets/glass.dm:64, 67-68) |
| any other item | - | - | - | `add_fingerprint(user)` (code/game/objects/items/stacks/sheets/glass.dm:48), then parent attackby: same-type merge (code/game/objects/items/stacks/stack.dm:448-452) |
| suicide_act | - | - | `"<span class='suicide'>[user] begins to slice [user.p_their()] neck with \the [src]! It looks like [user.p_theyre()] trying to commit suicide!</span>"` (code/game/objects/items/stacks/sheets/glass.dm:32) | returns BRUTELOSS (code/game/objects/items/stacks/sheets/glass.dm:33) |

- Construction chain: none (this is the material). Recipes available from this stack (code/game/objects/items/stacks/sheets/glass.dm:11-14, GLOB.glass_recipes, added in code/game/objects/items/stacks/sheets/glass.dm:43-45): directional window (1 sheet, time 0, on_floor, window_checks, code/game/objects/items/stacks/sheets/glass.dm:12); fulltile window (2 sheets, time 0, on_floor, window_checks, code/game/objects/items/stacks/sheets/glass.dm:13).
- Deconstruction chain: none.
- Drops: none. Consumed by recipes; the stack is deleted at 0 (code/game/objects/items/stacks/stack.dm:358-364).
- Health / armor: `max_integrity` 100 (code/game/objects/items/stacks/stack.dm:17). Armor as in the table above: fire 50, acid 100, all others 0 (code/game/objects/items/stacks/sheets/glass.dm:23).
- Power: none.
- Gotchas:
  - Merges silently with every glass sheet stack on the same turf (`merge_type` = /obj/item/stack/sheet/glass, code/game/objects/items/stacks/sheets/glass.dm:25), up to 50 (code/game/objects/items/stacks/stack.dm:68-71, 386).
  - Any amount above 50 splits into new stacks (code/game/objects/items/stacks/stack.dm:56-58).
  - The wired-glass message at code/game/objects/items/stacks/sheets/glass.dm:52 is malformed in the source (missing closing quote); quoted as written.

---

## Metal

### metal  `/obj/item/stack/sheet/metal/fifty`   (code/game/objects/items/stacks/sheets/sheet_types.dm:116-117)
- A stack of 50 metal sheets. Parent `/obj/item/stack/sheet/metal` (code/game/objects/items/stacks/sheets/sheet_types.dm:96-110). Map count: x24 on BoxStation.
- Key vars (final values):

| var | value | from |
|---|---|---|
| `name` | "metal" | code/game/objects/items/stacks/sheets/sheet_types.dm:97 |
| `desc` | "Sheets made out of metal." | code/game/objects/items/stacks/sheets/sheet_types.dm:98 |
| `singular_name` | "metal sheet" | code/game/objects/items/stacks/sheets/sheet_types.dm:99 |
| `amount` | 50 | code/game/objects/items/stacks/sheets/sheet_types.dm:117 (own) |
| `max_amount` | 50 | code/game/objects/items/stacks/sheets/sheets.dm:8 |
| `icon_state` / `inhand_icon_state` | "sheet-metal" / "sheet-metal" | code/game/objects/items/stacks/sheets/sheet_types.dm:100-101 |
| `custom_materials` | iron = MINERAL_MATERIAL_AMOUNT (2000 per sheet; x50 at spawn) | code/game/objects/items/stacks/sheets/sheet_types.dm:102, code/__DEFINES/construction.dm:70 |
| `throwforce` | 10 (overrides code/game/objects/items/stacks/sheets/sheets.dm:7) | code/game/objects/items/stacks/sheets/sheet_types.dm:103 |
| `force` | 5 | code/game/objects/items/stacks/sheets/sheets.dm:6 (inherited) |
| `flags_1` | CONDUCT_1 | code/game/objects/items/stacks/sheets/sheet_types.dm:104 |
| `resistance_flags` | FIRE_PROOF | code/game/objects/items/stacks/sheets/sheet_types.dm:105 |
| `merge_type` | /obj/item/stack/sheet/metal | code/game/objects/items/stacks/sheets/sheet_types.dm:106 |
| `grind_results` | iron = 20 per sheet | code/game/objects/items/stacks/sheets/sheet_types.dm:107 |
| `point_value` | 2 | code/game/objects/items/stacks/sheets/sheet_types.dm:108 |
| `tableVariant` | /obj/structure/table | code/game/objects/items/stacks/sheets/sheet_types.dm:109 |
| `material_type` | /datum/material/iron | code/game/objects/items/stacks/sheets/sheet_types.dm:110 |
| `max_integrity` | 100 | code/game/objects/items/stacks/stack.dm:17 (inherited) |
| `w_class` | NORMAL (3) at 50 sheets | code/game/objects/items/stacks/stack.dm:88-95 |
| `armor` | not set in the metal chain (code/game/objects/items/stacks/sheets/sheet_types.dm:96-110, code/game/objects/items/stacks/sheets/sheets.dm:1-16); default | (inferred, not overridden) |

- Interactions:

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| attack_self | none | 0 | none | opens the recipe menu of `GLOB.metal_recipes` (code/game/objects/items/stacks/sheets/sheet_types.dm:17-94, via get_main_recipes code/game/objects/items/stacks/sheets/sheet_types.dm:133-135). Also appends the material base recipes from `SSmaterials.rigid_stack_recipes` for the iron material's category (code/game/objects/items/stacks/stack.dm:74-80, inferred from code) |
| narsie_act | cult Narsie effect | - | none | `new /obj/item/stack/sheet/runed_metal(loc, amount)`, then qdel (code/game/objects/items/stacks/sheets/sheet_types.dm:112-114) |
| suicide_act | - | - | `"<span class='suicide'>[user] begins whacking [user.p_them()]self over the head with \the [src]! It looks like [user.p_theyre()] trying to commit suicide!</span>"` (code/game/objects/items/stacks/sheets/sheet_types.dm:138) | returns BRUTELOSS (code/game/objects/items/stacks/sheets/sheet_types.dm:139) |

- Recipes from GLOB.metal_recipes (code/game/objects/items/stacks/sheets/sheet_types.dm:17-94). Format: recipe (req sheets, result, time ds, line). `time` defaults to 0 (code/game/objects/items/stacks/stack.dm:476) where not given.

| recipe | req sheets | result | time (ds) | file:line |
|---|---|---|---|---|
| stool | 1 | /obj/structure/chair/stool | 0 | code/game/objects/items/stacks/sheets/sheet_types.dm:18 |
| bed | 2 | /obj/structure/bed | 0 | code/game/objects/items/stacks/sheets/sheet_types.dm:20 |
| dark office chair | 5 | /obj/structure/chair/office | 0 | code/game/objects/items/stacks/sheets/sheet_types.dm:23 |
| closet | 2 | /obj/structure/closet | 15 | code/game/objects/items/stacks/sheets/sheet_types.dm:41 |
| canister frame | 5 | /obj/structure/canister_frame/machine/frame_tier_0 | 8 | code/game/objects/items/stacks/sheets/sheet_types.dm:43 |
| floor tile (4 tiles, max 20 per stack) | 1 | /obj/item/stack/tile/plasteel | 0 | code/game/objects/items/stacks/sheets/sheet_types.dm:45 |
| metal rod (2 rods, max 60 per stack) | 1 | /obj/item/stack/rods | 0 | code/game/objects/items/stacks/sheets/sheet_types.dm:46 |
| wall girders | 2 | /obj/structure/girder | 40 | code/game/objects/items/stacks/sheets/sheet_types.dm:48 |
| computer frame | 5 | /obj/structure/frame/computer | 25 | code/game/objects/items/stacks/sheets/sheet_types.dm:50 |
| modular console | 10 | /obj/machinery/modular_computer/console/buildable/ | 25 | code/game/objects/items/stacks/sheets/sheet_types.dm:51 |
| machine frame | 5 | /obj/structure/frame/machine | 25 | code/game/objects/items/stacks/sheets/sheet_types.dm:52 |
| airlock assemblies (14 kinds: standard, public, command, security, engineering, mining, atmospherics, research, freezer, science, medical, virology, maintenance, external, external maintenance, airtight hatch, maintenance hatch) | 4 each | /obj/structure/door_assembly/... | 50 | code/game/objects/items/stacks/sheets/sheet_types.dm:54-72 |
| firelock frame | 3 | /obj/structure/firelock_frame | 50 | code/game/objects/items/stacks/sheets/sheet_types.dm:74 |
| turret frame | 5 | /obj/machinery/porta_turret_construct | 25 | code/game/objects/items/stacks/sheets/sheet_types.dm:75 |
| meatspike frame | 5 | /obj/structure/kitchenspike_frame | 25 | code/game/objects/items/stacks/sheets/sheet_types.dm:76 |
| reflector frame | 5 | /obj/structure/reflector | 25 | code/game/objects/items/stacks/sheets/sheet_types.dm:77 |
| grenade casing | 1 | /obj/item/grenade/chem_grenade | 0 | code/game/objects/items/stacks/sheets/sheet_types.dm:79 |
| light fixture frame | 2 | /obj/item/wallframe/light_fixture | 0 | code/game/objects/items/stacks/sheets/sheet_types.dm:80 |
| small light fixture frame | 1 | /obj/item/wallframe/light_fixture/small | 0 | code/game/objects/items/stacks/sheets/sheet_types.dm:81 |
| apc frame | 2 | /obj/item/wallframe/apc | 0 | code/game/objects/items/stacks/sheets/sheet_types.dm:83 |
| air alarm frame | 2 | /obj/item/wallframe/airalarm | 0 | code/game/objects/items/stacks/sheets/sheet_types.dm:84 |
| fire alarm frame | 2 | /obj/item/wallframe/firealarm | 0 | code/game/objects/items/stacks/sheets/sheet_types.dm:85 |
| extinguisher cabinet frame | 2 | /obj/item/wallframe/extinguisher_cabinet | 0 | code/game/objects/items/stacks/sheets/sheet_types.dm:86 |
| button frame | 1 | /obj/item/wallframe/button | 0 | code/game/objects/items/stacks/sheets/sheet_types.dm:87 |
| iron door | 20 | /obj/structure/mineral_door/iron | 0 | code/game/objects/items/stacks/sheets/sheet_types.dm:89 |
| floodlight frame | 5 | /obj/structure/floodlight_frame | 0 | code/game/objects/items/stacks/sheets/sheet_types.dm:90 |
| voting box | 15 | /obj/structure/votebox | 50 | code/game/objects/items/stacks/sheets/sheet_types.dm:91 |
| pestle | 1 | /obj/item/pestle | 50 | code/game/objects/items/stacks/sheets/sheet_types.dm:92 |
| hygienebot assembly | 2 | /obj/item/bot_assembly/hygienebot | 50 | code/game/objects/items/stacks/sheets/sheet_types.dm:93 |

- Construction chain: none (this is the material). Each recipe above is one build step: `do_after` the listed ds (code/game/objects/items/stacks/stack.dm:220-227), then `use(req_amount)` (code/game/objects/items/stacks/stack.dm:244).
- Deconstruction chain: none.
- Drops: none. Consumed by recipes.
- Health / armor: `max_integrity` 100 (code/game/objects/items/stacks/stack.dm:17). Armor: not set in the metal chain (default).
- Power: none.
- Gotchas:
  - Every metal sheet stack (fifty, five, and any other size) shares `merge_type` /obj/item/stack/sheet/metal (code/game/objects/items/stacks/sheets/sheet_types.dm:106), so they all merge with each other (code/game/objects/items/stacks/stack.dm:68-71, 386).
  - `FIRE_PROOF` and `CONDUCT_1` are set (code/game/objects/items/stacks/sheets/sheet_types.dm:104-105).
  - Map count x24 on BoxStation.

### metal five  `/obj/item/stack/sheet/metal/five`   (code/game/objects/items/stacks/sheets/sheet_types.dm:125-126)
- Same as `/obj/item/stack/sheet/metal/fifty` above (same parent, same recipes, same procs). Own value: `amount = 5` (code/game/objects/items/stacks/sheets/sheet_types.dm:126). Map count x2 on BoxStation.
- `w_class`: TINY (1). At 5 sheets `5 <= 50/3`, so `clamp(full_w_class-2, TINY, NORMAL)` = TINY (code/game/objects/items/stacks/stack.dm:88-90).
- The "fifty" recipes that need 5 sheets (dark office chair, canister frame, computer frame, machine frame, turret frame, meatspike frame, reflector frame, floodlight frame, office chairs) are the ones it can build with its full amount.
- Gotcha: it merges with any metal stack on the same tile up to a max of 50 (code/game/objects/items/stacks/stack.dm:386).

---

## Space cash

Base type `/obj/item/stack/spacecash` (code/game/objects/items/stacks/cash.dm:1-34). Its comment (code/game/objects/items/stacks/cash.dm:1) says not to use the base type. The comment is stale about merging (see gotchas).

Shared vars of the cash stacks (final values):

| var | value | file:line |
|---|---|---|
| `name` | "space cash" | code/game/objects/items/stacks/cash.dm:2 |
| `singular_name` (base) | "bill" (each child overrides) | code/game/objects/items/stacks/cash.dm:3 |
| `icon` | 'icons/obj/economy.dmi' | code/game/objects/items/stacks/cash.dm:4 |
| `amount` | 1 | code/game/objects/items/stacks/cash.dm:6 |
| `max_amount` | INFINITY | code/game/objects/items/stacks/cash.dm:7 |
| `throwforce` | 0 | code/game/objects/items/stacks/cash.dm:8 |
| `throw_speed` / `throw_range` | 2 / 2 | code/game/objects/items/stacks/cash.dm:9-10 |
| `w_class` / `full_w_class` | TINY / TINY | code/game/objects/items/stacks/cash.dm:11-12 |
| `resistance_flags` | FLAMMABLE | code/game/objects/items/stacks/cash.dm:13 |
| `value` (base) | 0 (each child sets its own) | code/game/objects/items/stacks/cash.dm:14 |
| `grind_results` | cellulose = 10 per bill (x amount when ground) | code/game/objects/items/stacks/cash.dm:15, code/game/objects/items/stacks/stack.dm:43-45 |

Procs (shared):
- **Initialize** (code/game/objects/items/stacks/cash.dm:17-19) calls `update_desc()`. **update_desc** (code/game/objects/items/stacks/cash.dm:21-23) sets `desc = "It's worth [total_worth] credit[( total_worth > 1 ) ? "s" : ""]"` where `total_worth = get_item_credit_value()`. `merge` and `use` also call `update_desc` (code/game/objects/items/stacks/cash.dm:28-34).
- **get_item_credit_value** (code/game/objects/items/stacks/cash.dm:25-26) returns `amount * value`.
- Interactions with cash are the stack ones (stack.dm), and cash has no recipes: `get_main_recipes` returns `list()` (code/game/objects/items/stacks/stack.dm:84-86), so the attack_self menu shows only "Amount Left" (inferred from code/game/objects/items/stacks/stack.dm:146-160).

### c10  `/obj/item/stack/spacecash/c10`   (code/game/objects/items/stacks/cash.dm:41-44)
- Ten-credit bill. Map count x1 on BoxStation.
- `icon_state` "spacecash10" (code/game/objects/items/stacks/cash.dm:42). `singular_name` "ten credit bill" (code/game/objects/items/stacks/cash.dm:43). `value` 10 (code/game/objects/items/stacks/cash.dm:44).
- Desc on the map item: "It's worth 10 credits" (from update_desc, code/game/objects/items/stacks/cash.dm:21-23, with amount 1; the plural suffix is added when the total is above 1, cash.dm:23, so one bill of 10 is "10 credits").
- `merge_type` becomes its own type (code/game/objects/items/stacks/stack.dm:59-60), so it merges only with other c10 stacks (code/game/objects/items/stacks/stack.dm:69-71).

### c100  `/obj/item/stack/spacecash/c100`   (code/game/objects/items/stacks/cash.dm:56-59)
- Hundred-credit bill. Map count x1 on BoxStation.
- `icon_state` "spacecash100" (code/game/objects/items/stacks/cash.dm:57). `singular_name` "one hundred credit bill" (code/game/objects/items/stacks/cash.dm:58). `value` 100 (code/game/objects/items/stacks/cash.dm:59).
- Merges only with c100 stacks (code/game/objects/items/stacks/stack.dm:59-60, 69-71).

### c200  `/obj/item/stack/spacecash/c200`   (code/game/objects/items/stacks/cash.dm:61-64)
- Two-hundred-credit bill. Map count x1 on BoxStation.
- `icon_state` "spacecash200" (code/game/objects/items/stacks/cash.dm:62). `singular_name` "two hundred credit bill" (code/game/objects/items/stacks/cash.dm:63). `value` 200 (code/game/objects/items/stacks/cash.dm:64).
- Merges only with c200 stacks (code/game/objects/items/stacks/stack.dm:59-60, 69-71).

Uses of the cash items (all lines verified in source):

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| ID card (`/obj/item/card/id`) attackby, cash | card has a `registered_account` | 0 | success: `"You stuff [I] into [src]. It disappears in a small puff of bluespace smoke, adding [cash_money] credits to the linked account."` (code/game/objects/items/cards_ids.dm:150); then `"The linked account now reports a balance of [registered_account.account_balance] cr."` (code/game/objects/items/cards_ids.dm:154) | `insert_money(W, user, TRUE)` (code/game/objects/items/cards_ids.dm:118-119, 136-155): adds `get_item_credit_value()` to the account, then `qdel(I)` (code/game/objects/items/cards_ids.dm:155) |
| ID card attackby, cash, no linked account | - | 0 | `"[src] doesn't have a linked account to deposit [I] into!"` (code/game/objects/items/cards_ids.dm:143) | nothing consumed (returns at code/game/objects/items/cards_ids.dm:144) |
| ID card attackby, cash worth 0 | - | 0 | `"[I] doesn't seem to be worth anything!"` (code/game/objects/items/cards_ids.dm:139) | nothing consumed |
| bank machine (`/obj/machinery/computer/bank_machine`) attackby, cash | - | 0 | `"You deposit [I]. The Cargo Budget is now [D.account_balance] cr."` (code/game/machinery/bank_machine.dm:38) | `value = C.value * C.amount` (code/game/machinery/bank_machine.dm:29-30), adds to the cargo budget account `ACCOUNT_CAR` (code/game/machinery/bank_machine.dm:35-37), `qdel(I)` (code/game/machinery/bank_machine.dm:39) |
| lapvend (`/obj/machinery/lapvend`) attackby, cash | - | 0 | `"<span class='info'><span class='name'>[user]</span> inserts [c.value] cr into [src].</span>"` (code/modules/modular_computers/laptop_vendor.dm:244) | adds `c.value` (one bill's value, not `value * amount`) to `credits` (code/modules/modular_computers/laptop_vendor.dm:243), `qdel(c)` (code/modules/modular_computers/laptop_vendor.dm:245) |
| pay stand (`/obj/machinery/paystand`, code/modules/economy/pay_stand.dm:15) attackby, cash | - | 0 | `"What is this, the 2000s? We only take card here."` (code/modules/economy/pay_stand.dm:78) | refused; cash is not consumed (returns, code/modules/economy/pay_stand.dm:79) |

- Construction / deconstruction chain: none (currency, no recipes).
- Drops: none. Cash is destroyed when inserted (qdel in the uses above).
- Health / armor: `max_integrity` 100 (code/game/objects/items/stacks/stack.dm:17, inherited). Armor not set (default).
- Power: none.
- Gotchas:
  - The lapvend adds `c.value` only, so a stack of several bills gives the value of one bill but the whole stack is deleted (code/modules/modular_computers/laptop_vendor.dm:243-245). `(inferred from the code as written)`
  - Cash merges only with the same denomination because `merge_type` = own type (code/game/objects/items/stacks/stack.dm:59-60, 69-71). code/game/objects/items/stacks/cash.dm:1 says other cash stacks merge with the base; that comment does not match the code.
  - Stack-level `use()` in cash calls `update_desc` (code/game/objects/items/stacks/cash.dm:32-34), so the description tracks the total value.
  - Map: c10 x1, c100 x1, c200 x1 on BoxStation.

---

## Wrapping paper

### wrapping paper  `/obj/item/stack/wrapping_paper`   (code/game/objects/items/stacks/wrap.dm:7-21)
- A roll of festive gift wrap, 25 sheets. Parent `/obj/item/stack` (code/game/objects/items/stacks/stack.dm:13). Map count x1 on BoxStation.
- Key vars (final values):

| var | value | file:line |
|---|---|---|
| `name` | "wrapping paper" | code/game/objects/items/stacks/wrap.dm:8 |
| `desc` | "Wrap packages with this festive paper to make gifts." | code/game/objects/items/stacks/wrap.dm:9 |
| `icon` / `icon_state` | 'icons/obj/stack_objects.dmi' / "wrap_paper" | code/game/objects/items/stacks/wrap.dm:10-11 |
| `item_flags` | NOBLUDGEON (no "hit by" message from the default attackby, code/__DEFINES/obj_flags.dm:26) | code/game/objects/items/stacks/wrap.dm:12 |
| `amount` | 25 | code/game/objects/items/stacks/wrap.dm:13 |
| `max_amount` | 25 | code/game/objects/items/stacks/wrap.dm:14 |
| `resistance_flags` | FLAMMABLE | code/game/objects/items/stacks/wrap.dm:15 |
| `novariants` | TRUE (inherited from code/game/objects/items/stacks/stack.dm:27): icon does not change with amount | code/game/objects/items/stacks/stack.dm:27 |
| `w_class` | NORMAL (3) at 17 to 25 sheets; SMALL (2) at 9 to 16; TINY (1) at 8 or fewer | code/game/objects/items/stacks/stack.dm:88-95 (full_w_class NORMAL, code/game/objects/items/stacks/stack.dm:26) |

- Interactions:

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| attack_self | none | 0 | none | opens the stack menu; wrapping paper defines no recipes (code/game/objects/items/stacks/stack.dm:84-86), so only "Amount Left" (inferred) |
| use (last sheet taken) | `QDELETED(src)` and not a transfer (code/game/objects/items/stacks/wrap.dm:17-21) | 0 | none | spawns one `/obj/item/c_tube` at the turf (code/game/objects/items/stacks/wrap.dm:21) |
| `/obj/structure/big_delivery` attackby with wrapping paper | the package is not already gift-wrapped (code/modules/recycling/sortingmachinery.dm:72-73) | 0 | success: `"[user] wraps the package in festive paper!"` (code/modules/recycling/sortingmachinery.dm:75); fail: `"You need more paper!"` (code/modules/recycling/sortingmachinery.dm:79) | `WP.use(3)` (code/modules/recycling/sortingmachinery.dm:74); on success `giftwrapped = TRUE` and `icon_state = "gift[icon_state]"` (code/modules/recycling/sortingmachinery.dm:76-77) |

- Construction chain: none.
- Deconstruction chain: none.
- Drops: when the last sheet is used up, a `/obj/item/c_tube` is spawned (code/game/objects/items/stacks/wrap.dm:17-21).
  - `/obj/item/c_tube` (code/game/objects/items/stacks/wrap.dm:132-140): name "cardboard tube" (code/game/objects/items/stacks/wrap.dm:133), desc "A tube... of cardboard." (code/game/objects/items/stacks/wrap.dm:134), icon_state "c_tube" (code/game/objects/items/stacks/wrap.dm:136), throwforce 0 (code/game/objects/items/stacks/wrap.dm:137), w_class TINY (code/game/objects/items/stacks/wrap.dm:138), throw_speed 3, throw_range 5 (code/game/objects/items/stacks/wrap.dm:139-140).
- Health / armor: `max_integrity` 100 (code/game/objects/items/stacks/stack.dm:17). Armor not set.
- Power: none.
- Gotchas:
  - No `afterattack` is defined here. The package-wrapping logic (wrap a loose item or closet into a delivery package) is on `/obj/item/stack/package_wrap` (code/game/objects/items/stacks/wrap.dm:31-119), a different type, not on this item.
  - The small roll `/obj/item/stack/wrapping_paper/small` (code/game/objects/items/stacks/wrap.dm:23-25, amount 10) is a sibling not on this list. It appears in the shipping box (code/game/objects/items/storage/boxes.dm:1360).
  - Cargo sells it as "wrapping paper" in `/datum/supply_pack/misc/wrapping_paper` (code/modules/cargo/packs.dm:2479-2483).

---

## Pipe cleaner coil

### pipe cleaner coil (random)  `/obj/item/stack/pipe_cleaner_coil/random`   (code/modules/power/pipecleaners.dm:443-445)
- A coil of pipe cleaner (wire art, not power) with a random colour. Parent `/obj/item/stack/pipe_cleaner_coil` (code/modules/power/pipecleaners.dm:179-205). Map count x6 on BoxStation.
- Key vars (final values):

| var | value | from |
|---|---|---|
| `name` | "pipe cleaner coil" | code/modules/power/pipecleaners.dm:180 (rewritten by update_icon to "pipe cleaner piece" when amount < 3, else "pipe cleaner coil", code/modules/power/pipecleaners.dm:243) |
| `desc` | "A coil of pipe cleaners. Good for arts and crafts, not to build with." | code/modules/power/pipecleaners.dm:181 |
| `pipe_cleaner_color` | null (own), then picked at Initialize | code/modules/power/pipecleaners.dm:444 |
| `color` | "#ffffff" (own); update_icon sets `color = null` and uses `add_atom_colour(pipe_cleaner_color, FIXED_COLOUR_PRIORITY)` | code/modules/power/pipecleaners.dm:445, 244-245 |
| `amount` | MAXCOIL = 30 | code/modules/power/pipecleaners.dm:191, code/__DEFINES/construction.dm:74 |
| `max_amount` | MAXCOIL = 30 | code/modules/power/pipecleaners.dm:190 |
| `singular_name` | "pipe cleaner piece" | code/modules/power/pipecleaners.dm:202 |
| `merge_type` | /obj/item/stack/pipe_cleaner_coil (all colours merge) | code/modules/power/pipecleaners.dm:192 |
| `w_class` / `full_w_class` | SMALL / SMALL (TINY at 20 or fewer, code/game/objects/items/stacks/stack.dm:88-95) | code/modules/power/pipecleaners.dm:195, 203 |
| `custom_price` | 25 | code/modules/power/pipecleaners.dm:182 |
| `gender` | NEUTER | code/modules/power/pipecleaners.dm:183 |
| `custom_materials` | iron = 10, glass = 5 (per coil at full, scaled by amount) | code/modules/power/pipecleaners.dm:198 |
| `grind_results` | copper = 2 per pipe cleaner | code/modules/power/pipecleaners.dm:204 |
| `flags_1` | CONDUCT_1 | code/modules/power/pipecleaners.dm:199 |
| `slot_flags` | ITEM_SLOT_BELT | code/modules/power/pipecleaners.dm:200 |
| `throwforce` / `throw_speed` / `throw_range` | 0 / 3 / 5 | code/modules/power/pipecleaners.dm:194, 196-197 |
| `attack_verb` | "whipped", "lashed", "disciplined", "flogged" | code/modules/power/pipecleaners.dm:201 |
| `usesound` | 'sound/items/deconstruct.ogg' | code/modules/power/pipecleaners.dm:205 |

- **Colour at spawn**: `Initialize` sets `pipe_cleaner_color = param_color || pipe_cleaner_color || pick(pipe_cleaner_colors)` (code/modules/power/pipecleaners.dm:227-228), where `GLOB.pipe_cleaner_colors` (code/modules/power/pipecleaners.dm:1-10) holds yellow, green, blue, pink, orange, cyan, white and red. Since `pick` on an associative list returns the value (a hex string), the random coil gets one of the hex values (inferred from the DM `pick` semantics; the code does not convert it back). `pixel_x/pixel_y = rand(-2,2)` (code/modules/power/pipecleaners.dm:232-233).
- Interactions:

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| attack_self | - | - | none (pipecleaner_coil only overrides attack_self on the cyborg subtype, code/modules/power/pipecleaners.dm:212) | parent stack menu (code/game/objects/items/stacks/stack.dm:138-144), no recipes |
| attack_hand | - | 0 | none | if in inactive hand, the new coil keeps the colour (code/modules/power/pipecleaners.dm:247-254) |
| on an empty floor turf (`turf.dm`) | `can_have_cabling()` and no open pipe cleaner end (code/game/turfs/turf.dm:206-212) | 0 | `"You can only lay pipe cleaners on a solid floor!"` (code/modules/power/pipecleaners.dm:280) when not on a valid floor; `"There is no pipe cleaner left!"` (code/modules/power/pipecleaners.dm:284) when empty | `place_turf` lays one `/obj/structure/pipe_cleaner` (code/modules/power/pipecleaners.dm:275-315) and `use(1)` (code/modules/power/pipecleaners.dm:313) |
| on an existing `/obj/structure/pipe_cleaner` | a coil in hand (code/modules/power/pipecleaners.dm:137-142) | 0 | `"Not enough pipe cleaner!"` (code/modules/power/pipecleaners.dm:140) when empty; `"There's already a pipe cleaner at that position!"` (code/modules/power/pipecleaners.dm:357 / 388) | `pipe_cleaner_join` (code/modules/power/pipecleaners.dm:319-406) extends or branches a pipe cleaner and `use(1)` |
| wirecutters on a pipe cleaner (`TOOL_WIRECUTTER`) | - | 0 | `"[user] pulls up the pipe cleaner."` (code/modules/power/pipecleaners.dm:147) | `cut_pipe_cleaner` then `deconstruct()` (code/modules/power/pipecleaners.dm:133-134, 146-150) |

- Construction chain: none (not a build material; it lays down cosmetic pipe cleaner structures). Each laid piece uses 1 coil unit (code/modules/power/pipecleaners.dm:313, 367, 404).
- Deconstruction chain: none for the coil itself. Laid pieces (`/obj/structure/pipe_cleaner`) are pulled up with wirecutters (code/modules/power/pipecleaners.dm:133-134, 146-150) or by AltClick (code/modules/power/pipecleaners.dm:166-168, which calls `cut_pipe_cleaner`).
- Drops: `/obj/structure/pipe_cleaner/deconstruct` (code/modules/power/pipecleaners.dm:109-117) moves the piece's `stored` coil to the turf and qdels the piece. The stored coil holds 1 unit for a stub piece and 2 for a full piece (code/modules/power/pipecleaners.dm:91-94), and `update_stored(2, ...)` sets 2 when a stub is extended (code/modules/power/pipecleaners.dm:161-164, 399).
- Health / armor: `max_integrity` 100 (code/game/objects/items/stacks/stack.dm:17). Armor not set.
- Power: none. Pipe cleaners carry no power (the file header says it is cable code minus powernet logic, code/modules/power/pipecleaners.dm:12).
- Gotchas:
  - Colour is random only when no colour is passed (code/modules/power/pipecleaners.dm:228).
  - `merge_type` is the parent coil type, so all colours merge together (code/modules/power/pipecleaners.dm:192). Merge takes the colour of the receiving stack.
  - `give(extra)` caps at `max_amount` 30 (code/modules/power/pipecleaners.dm:257-262).
  - Map count x6 on BoxStation.

---

## Power cell

### high-capacity power cell+  `/obj/item/stock_parts/cell/high/plus`   (code/modules/power/cell.dm:256-262)
- A high-capacity power cell with a higher maximum charge. Parent `/obj/item/stock_parts/cell/high` (code/modules/power/cell.dm:249-254), then `/obj/item/stock_parts/cell` (code/modules/power/cell.dm:1-22), then `/obj/item/stock_parts` (code/modules/research/stock_parts.dm:123-128). Map count x13 on BoxStation.
- Key vars (final values):

| var | value | from |
|---|---|---|
| `name` | "high-capacity power cell+" | code/modules/power/cell.dm:257 |
| `desc` | "Where did these come from?" (Initialize appends a rating line, code/modules/power/cell.dm:34-35) | code/modules/power/cell.dm:258 |
| `icon_state` | "h+cell" | code/modules/power/cell.dm:259 |
| `maxcharge` | 15000 (charge units; see Power) | code/modules/power/cell.dm:260 |
| `chargerate` | 2250 (power per tick given by a recharger) | code/modules/power/cell.dm:261 (comment for chargerate, code/modules/power/cell.dm:19) |
| `rating` | 2 (own; base rating is 1) | code/modules/power/cell.dm:262, code/modules/research/stock_parts.dm:128 |
| `custom_materials` | glass = 60 (from /high; replaces the base list, so no iron) | code/modules/power/cell.dm:253 (inherited) |
| `grind_results` | lithium 15, iron 5, silicon 5 | code/modules/power/cell.dm:17 (base) |
| `w_class` / `throw_range` / `throw_speed` / `force` / `throwforce` | SMALL / 5 / 2 / 5 / 5 | code/modules/power/cell.dm:9-13 |
| `ratingdesc` | TRUE (rating line in desc) | code/modules/power/cell.dm:21 |
| `charge` at spawn | = maxcharge, full | code/modules/power/cell.dm:33 |
| `reagents` | created with 5 units, INJECTABLE \| DRAINABLE | code/modules/power/cell.dm:29 |

- Interactions:

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| attack_self, non-ethereal | - | - | none | nothing (code/modules/power/cell.dm:151-175 only acts for ethereal) |
| attack_self, ethereal | charge >= 100, stomach not full | 20 (`do_after(user, 20, ...)`, code/modules/power/cell.dm:166, `E.drain_time = world.time + 20`, code/modules/power/cell.dm:165) | `"You clumsily channel power through the [src] and into your body, wasting some in the process."` (code/modules/power/cell.dm:164); `"You receive some charge from the [src]."` (code/modules/power/cell.dm:170) | `stomach.adjust_charge(3)` and `charge -= 100` (code/modules/power/cell.dm:171-172) |
| plasma injected (reagent `/datum/reagent/toxin/plasma`) | 5 or more units | 0 | none | sets `rigged = TRUE` (code/modules/power/cell.dm:105-107): the cell explodes the next time it is used or given power |
| emp_act | not EMP_PROTECT_SELF | - | none | `charge -= 1000 / severity`, floor 0 (code/modules/power/cell.dm:132-138) |
| ex_act severity 2 | prob 50 | - | none | `corrupt()` (code/modules/power/cell.dm:140-146) |
| ex_act severity 3 | prob 25 | - | none | `corrupt()` (code/modules/power/cell.dm:147-149) |
| `examine` | - | - | `"The charge meter reads [round(src.percent() )]%."` (code/modules/power/cell.dm:99) or `"This power cell seems to be faulty!"` when rigged (code/modules/power/cell.dm:96-97, `<span class='danger'>`) | none |

- Construction chain: none (this is a finished part). The circuit boards use the base high cell, not the plus variant: `/obj/item/stock_parts/cell/high/empty` at code/game/objects/items/circuitboards/machine_circuitboards.dm:311, `/obj/item/stock_parts/cell/high` at code/game/objects/items/circuitboards/machine_circuitboards.dm:626, 633, 790 (in the `def_components` lists).
- Deconstruction chain: none.
- Drops: when rigged and `explode()` runs, the cell is `qdel`ed after an `explosion(T, -1, heavy, light, flash)` with heavy = `round(sqrt(charge)/60)` and light = `round(sqrt(charge)/30)` (code/modules/power/cell.dm:110-124). If the light range is 0, the cell is only corrupted and stays (code/modules/power/cell.dm:118-121). Otherwise nothing is dropped.
- Health / armor: `max_integrity` is not set on the cell chain (engine default, inferred). No armor set.
- Power: stored energy `maxcharge` = 15000 charge units (code/modules/power/cell.dm:260). The unit is `CELLRATE` 0.002 conversion, watt-tick to kJ (code/_globalvars/misc.dm:11). The desc rating line is `DisplayEnergy(15000)` (code/modules/power/cell.dm:34-35, code/__HELPERS/unsorted.dm:317-322), which with `SSmachines.wait` = 20 (code/controllers/subsystem.dm:20, comment code/__HELPERS/unsorted.dm:320) is 15000 * 20 * 0.1 / 0.002 = 15,000,000 J, shown as "15 MJ" (code/__HELPERS/unsorted.dm:313) (inferred from the formula). `idle_power_usage` / `active_power_usage`: none (a cell is passive).
- Gotchas:
  - Rigged cells (plasma of 5 or more units, code/modules/power/cell.dm:105-107) explode on the next `use` or `give` (code/modules/power/cell.dm:73-75, 85-87).
  - `corrupt()` halves charge and maxcharge (floor = chargerate), and has a 10% chance (`prob(10)`) to set `rigged` (code/modules/power/cell.dm:126-130).
  - `use(amount)` returns 0 without consuming when charge < amount (code/modules/power/cell.dm:76-77). It records a blackbox tally unless the loc is an APC (code/modules/power/cell.dm:79-80).
  - The plus variant has no `custom_materials` of its own: it keeps glass = 60 from `/high` (code/modules/power/cell.dm:253).
  - The base cell `ratingdesc` line appends "This one has a rating of [...] and you should not swallow it." to desc on Initialize (code/modules/power/cell.dm:34-35).

---

## Tally for part 1 (the shard Coverage is in part 5)

- Items on this part: 9 (pipe cleaner coil random, glass fifty, metal fifty, metal five, c10, c100, c200, wrapping paper, high/plus).
- Documented with real data from the source: 9.
- Marked NOT FOUND: 0.
- Shared parents documented: /obj/item/stack, /obj/item/stack/sheet, /obj/item/stock_parts, /obj/item/stock_parts/cell, /obj/item/stock_parts/cell/high, /obj/item/stack/pipe_cleaner_coil (base), /obj/item/stack/spacecash (base), /obj/item/stack/sheet/glass (base), /obj/item/stack/sheet/metal (base), /obj/item/stack/wrapping_paper (own entry).

# gap-items-05 part 2: storage boxes (prisoner IDs, spyglass kit, shipping supplies)

Tree: `_src/tg2020`. Paths relative to the tree root. Numbers raw.
Items in this part (3 of 28): `/obj/item/storage/box/prisoner`, `/obj/item/storage/box/rxglasses/spyglasskit`, `/obj/item/storage/box/shipping`.

## Shared parents (inherited by all three boxes)

### Storage item  `/obj/item/storage`   (code/game/objects/items/storage/storage.dm:1-16)

| var / behaviour | value | file:line |
|---|---|---|
| `icon` | 'icons/obj/storage.dmi' | code/game/objects/items/storage/storage.dm:3 |
| `w_class` | WEIGHT_CLASS_NORMAL (3) | code/game/objects/items/storage/storage.dm:4 |
| `component_type` | /datum/component/storage/concrete | code/game/objects/items/storage/storage.dm:6, 15-16 |
| `Initialize` | calls `PopulateContents()` after the parent Initialize; this is where a box fills itself at spawn | code/game/objects/items/storage/storage.dm:11-13 |
| `AllowDrop` | FALSE (cannot be dropped by drag-drop) | code/game/objects/items/storage/storage.dm:18-19 |

Storage capacity comes from the storage component defaults (code/datums/components/storage/storage.dm), since no box below overrides them:

| capacity var | default | file:line |
|---|---|---|
| `max_w_class` (largest item that fits) | WEIGHT_CLASS_SMALL (2) | code/datums/components/storage/storage.dm:27 |
| `max_combined_w_class` (sum of item sizes) | 14 | code/datums/components/storage/storage.dm:28 |
| `max_items` (number of items) | 7 | code/datums/components/storage/storage.dm:29 |

### Box  `/obj/item/storage/box`   (code/game/objects/items/storage/boxes.dm:24-76)

| var / behaviour | value | file:line |
|---|---|---|
| `name` | "box" | code/game/objects/items/storage/boxes.dm:25 |
| `desc` | "It's just an ordinary box." | code/game/objects/items/storage/boxes.dm:26 |
| `icon_state` | "box" | code/game/objects/items/storage/boxes.dm:27 |
| `inhand_icon_state` | "syringe_kit" | code/game/objects/items/storage/boxes.dm:28 |
| `resistance_flags` | FLAMMABLE | code/game/objects/items/storage/boxes.dm:31 |
| `drop_sound` / `pickup_sound` | 'sound/items/handling/cardboardbox_drop.ogg' / 'sound/items/handling/cardboardbox_pickup.ogg' | code/game/objects/items/storage/boxes.dm:32-33 |
| `foldable` | /obj/item/stack/sheet/cardboard (default for every box that does not clear it) | code/game/objects/items/storage/boxes.dm:34 |
| `illustration` | "writing" (default; each child sets its own) | code/game/objects/items/storage/boxes.dm:35 |
| `Initialize` | parent Initialize, then `update_icon()` | code/game/objects/items/storage/boxes.dm:37-39 |
| `update_overlays` | adds the `illustration` overlay | code/game/objects/items/storage/boxes.dm:52-55 |

Box procs (inherited):
- **attack_self** (code/game/objects/items/storage/boxes.dm:57-71): if `foldable` is set and the box is empty, folds it into a stack of cardboard. Messages: `"You can't fold this box with items still inside!"` when it has contents (code/game/objects/items/storage/boxes.dm:63, `<span class='warning'>`); `"You fold [src] flat."` on success (code/game/objects/items/storage/boxes.dm:68, `<span class='notice'>`). No delay (no do_after).
- **attackby** (code/game/objects/items/storage/boxes.dm:73-76): a `/obj/item/stack/package_wrap` returns 0 here, so it is not handled as an attack on the box. Otherwise parent attackby.
- **suicide_act** (code/game/objects/items/storage/boxes.dm:41-50): puts the user's head in the box (dismember, code/game/objects/items/storage/boxes.dm:42-46) or beats themselves with it (code/game/objects/items/storage/boxes.dm:49-50). Returns BRUTELOSS.
- The box can be package-wrapped: `/obj/item/storage/box/can_be_package_wrapped()` returns 1 (code/game/objects/items/stacks/wrap.dm:61-62); a generic storage returns 0 (code/game/objects/items/stacks/wrap.dm:58-59).

---

## Prisoner IDs

### box of prisoner IDs  `/obj/item/storage/box/prisoner`   (code/game/objects/items/storage/boxes.dm:556-570)
- A box that starts with seven prisoner ID cards. Parent `/obj/item/storage/box` (code/game/objects/items/storage/boxes.dm:24). Map count x3 on BoxStation.
- Key vars (final values):

| var | value | file:line |
|---|---|---|
| `name` | "box of prisoner IDs" | code/game/objects/items/storage/boxes.dm:557 |
| `desc` | "Take away their last shred of dignity, their name." | code/game/objects/items/storage/boxes.dm:558 |
| `icon_state` | "secbox" | code/game/objects/items/storage/boxes.dm:559 |
| `illustration` | "id" | code/game/objects/items/storage/boxes.dm:560 |
| `foldable` | /obj/item/stack/sheet/cardboard (inherited, code/game/objects/items/storage/boxes.dm:34) | code/game/objects/items/storage/boxes.dm:34 |
| `w_class` | NORMAL (3) (inherited, code/game/objects/items/storage/storage.dm:4) | code/game/objects/items/storage/storage.dm:4 |

- Contents at round start (`PopulateContents`, code/game/objects/items/storage/boxes.dm:562-570; it calls `..()` at code/game/objects/items/storage/boxes.dm:563, then adds 7 cards):

| item | name | file:line |
|---|---|---|
| `/obj/item/card/id/prisoner/one` | "Prisoner #13-001" (registered_name the same, icon_state "prisoner_001") | code/game/objects/items/cards_ids.dm:618-621; spawn code/game/objects/items/storage/boxes.dm:564 |
| `/obj/item/card/id/prisoner/two` | "Prisoner #13-002" | code/game/objects/items/cards_ids.dm:623-626; spawn code/game/objects/items/storage/boxes.dm:565 |
| `/obj/item/card/id/prisoner/three` | "Prisoner #13-003" | code/game/objects/items/cards_ids.dm:628-631; spawn code/game/objects/items/storage/boxes.dm:566 |
| `/obj/item/card/id/prisoner/four` | "Prisoner #13-004" | code/game/objects/items/cards_ids.dm:633-636; spawn code/game/objects/items/storage/boxes.dm:567 |
| `/obj/item/card/id/prisoner/five` | "Prisoner #13-005" | code/game/objects/items/cards_ids.dm:638-640; spawn code/game/objects/items/storage/boxes.dm:568 |
| `/obj/item/card/id/prisoner/six` | "Prisoner #13-006" | code/game/objects/items/cards_ids.dm:643-645; spawn code/game/objects/items/storage/boxes.dm:569 |
| `/obj/item/card/id/prisoner/seven` | "Prisoner #13-007" | code/game/objects/items/cards_ids.dm:648-650; spawn code/game/objects/items/storage/boxes.dm:570 |

- The cards inherit from `/obj/item/card/id/prisoner` (code/game/objects/items/cards_ids.dm:600-616): name "prisoner ID card", desc "You are a number, you are not a free man." (code/game/objects/items/cards_ids.dm:601-603), icon_state "orange" (code/game/objects/items/cards_ids.dm:604). `attack_self` prints `"You have accumulated [points] out of the [goal] points you need for freedom."` (code/game/objects/items/cards_ids.dm:615-616).
- Interactions (box itself): see Shared parents. Folding is blocked while cards are inside (code/game/objects/items/storage/boxes.dm:62-64).

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| attack_self | box has contents | 0 | `"You can't fold this box with items still inside!"` (code/game/objects/items/storage/boxes.dm:63) | nothing |
| attack_self | empty | 0 | `"You fold [src] flat."` (code/game/objects/items/storage/boxes.dm:68) | box deleted, cardboard stack given to hand (code/game/objects/items/storage/boxes.dm:69-71) |
| package wrapper (`/obj/item/stack/package_wrap`) | - | 0 | none | returns 0 from the box attackby (code/game/objects/items/storage/boxes.dm:74-75): the wrapper is not used on the box here |

- Construction chain: none (it is a container, not built). The base box has no recipe; `foldable` is the only conversion (cardboard, code/game/objects/items/storage/boxes.dm:34).
- Deconstruction chain: fold it (attack_self) once empty, as above.
- Drops: none. Cards are inside; when the box is folded it is qdeleted (code/game/objects/items/storage/boxes.dm:70) and the cards must be removed first (code/game/objects/items/storage/boxes.dm:62-64). Nothing else is spawned.
- Health / armor: no `max_integrity` or armor is set on the box chain (default). `resistance_flags` FLAMMABLE (code/game/objects/items/storage/boxes.dm:31).
- Power: none.
- Gotchas:
  - The box's storage is the default storage component: 7 items, each <= SMALL, combined <= 14 (code/datums/components/storage/storage.dm:27-29). Seven cards fit at the cap (`max_items` 7).
  - Map count x3 on BoxStation.

---

## Spyglass kit

### spyglass kit  `/obj/item/storage/box/rxglasses/spyglasskit`   (code/game/objects/items/devices/spyglasses.dm:92-94; PopulateContents code/game/objects/items/devices/spyglasses.dm:111-116)
- A box that holds one linked pair of spy glasses, its spy bug camera and a guide. The comment in source says it needs to be linked, hence a kit (code/game/objects/items/devices/spyglasses.dm:91). Parent `/obj/item/storage/box/rxglasses` (code/game/objects/items/storage/boxes.dm:401-408). Map count: none on BoxStation (placed in security lockers: code/game/objects/structures/crates_lockers/closets/secure/security.dm:193).
- Key vars (final values):

| var | value | file:line |
|---|---|---|
| `name` | "spyglass kit" | code/game/objects/items/devices/spyglasses.dm:93 |
| `desc` | "this box contains <i>cool</i> nerd glasses; with built-in displays to view a linked camera." | code/game/objects/items/devices/spyglasses.dm:94 |
| `illustration` | "glasses" (inherited from /obj/item/storage/box/rxglasses, code/game/objects/items/storage/boxes.dm:404) | code/game/objects/items/storage/boxes.dm:404 |
| `foldable` | /obj/item/stack/sheet/cardboard (inherited, code/game/objects/items/storage/boxes.dm:34) | code/game/objects/items/storage/boxes.dm:34 |

- Contents at round start. `PopulateContents` is **overridden** and does **not** call `..()` (code/game/objects/items/devices/spyglasses.dm:111-116), so it does not get the seven regular glasses of the parent box (code/game/objects/items/storage/boxes.dm:406-408):

| item | role | file:line |
|---|---|---|
| `/obj/item/spy_bug` (`newbug`) | the hidden camera; linked to the glasses (type at code/game/objects/items/devices/spyglasses.dm:43) | code/game/objects/items/devices/spyglasses.dm:112, 114 |
| `/obj/item/clothing/glasses/regular/spy` (`newglasses`) | the glasses; `linked_bug` set to the bug | code/game/objects/items/devices/spyglasses.dm:113, 115; type at code/game/objects/items/devices/spyglasses.dm:2 |
| `/obj/item/paper/fluff/nerddocs` | "Espionage For Dummies" guide | code/game/objects/items/devices/spyglasses.dm:96-99 (name, colour, desc), spawn code/game/objects/items/devices/spyglasses.dm:116 |

- The link is made at spawn: `newbug.linked_glasses = newglasses` (code/game/objects/items/devices/spyglasses.dm:114) and `newglasses.linked_bug = newbug` (code/game/objects/items/devices/spyglasses.dm:115). Without that link the glasses beep (see below).
- The spy glasses' `show_to_user` proc: `"<span class='warning'>[src] lets off a shrill beep!</span>"` is shown when there is no linked bug (code/game/objects/items/devices/spyglasses.dm:11-12). Full glasses data belongs to the clothing shard (not on this list).
- The guide's text says the pair can't connect after the camera is inactive: `"A shrill beep coming from your SpySpeks means that they can't connect to the included ProfitProtektor <small>tm</small>, please make sure your ProfitProtektor is still active, and functional!"` (code/game/objects/items/devices/spyglasses.dm:108, inside the guide's `info` text). Quote as written.

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| attack_self | box has contents | 0 | `"You can't fold this box with items still inside!"` (code/game/objects/items/storage/boxes.dm:63) | nothing |
| attack_self | empty | 0 | `"You fold [src] flat."` (code/game/objects/items/storage/boxes.dm:68) | box folded to cardboard |
| package wrapper (`/obj/item/stack/package_wrap`) | - | 0 | none | returns 0 (code/game/objects/items/storage/boxes.dm:74-75) |

- Construction chain: none (container). The kit's glasses and camera are not built here.
- Deconstruction chain: fold when empty (code/game/objects/items/storage/boxes.dm:57-71).
- Drops: none from the kit itself. Its contents stay inside until removed; the kit is qdeleted when folded (code/game/objects/items/storage/boxes.dm:70).
- Health / armor: no `max_integrity` or armor set on the box chain (default).
- Power: none. The spy bug has its own camera system (not on this list).
- Gotchas:
  - Its `PopulateContents` does not call `..()`, so no extra regular glasses are added (code/game/objects/items/devices/spyglasses.dm:111-116 vs code/game/objects/items/storage/boxes.dm:406-408).
  - The glasses and bug are linked only at spawn (code/game/objects/items/devices/spyglasses.dm:114-115). Moving one out of the kit leaves the link in the objects.
  - Storage capacity is the default storage component (max 7 items, each <= SMALL, combined <= 14, code/datums/components/storage/storage.dm:27-29). The kit holds three items.

---

## Shipping supplies

### box of shipping supplies  `/obj/item/storage/box/shipping`   (code/game/objects/items/storage/boxes.dm:1349-1362)
- A box with the tagging and scanning tools for shipping, and small wrap rolls. The desc says "Wrapping Paper not included." (code/game/objects/items/storage/boxes.dm:1351) but the box does contain a small wrapping paper roll (code/game/objects/items/storage/boxes.dm:1360). Parent `/obj/item/storage/box` (code/game/objects/items/storage/boxes.dm:24). Map count x2 on BoxStation.
- Key vars (final values):

| var | value | file:line |
|---|---|---|
| `name` | "box of shipping supplies" | code/game/objects/items/storage/boxes.dm:1350 |
| `desc` | "Contains several scanners and labelers for shipping things. Wrapping Paper not included." | code/game/objects/items/storage/boxes.dm:1351 |
| `illustration` | "shipping" | code/game/objects/items/storage/boxes.dm:1352 |
| `foldable` | /obj/item/stack/sheet/cardboard (inherited) | code/game/objects/items/storage/boxes.dm:34 |
| `w_class` | NORMAL (3) (inherited) | code/game/objects/items/storage/storage.dm:4 |

- Contents at round start (`PopulateContents`, code/game/objects/items/storage/boxes.dm:1354-1362; uses a static list and `generate_items_inside`, code/__HELPERS/unsorted.dm:1524-1527, which spawns each type `n` times in the box). It does not call `..()`:

| item (type) | count | file:line |
|---|---|---|
| `/obj/item/dest_tagger` | 1 | code/game/objects/items/storage/boxes.dm:1356 |
| `/obj/item/sales_tagger` | 1 | code/game/objects/items/storage/boxes.dm:1357 |
| `/obj/item/export_scanner` | 1 | code/game/objects/items/storage/boxes.dm:1358 |
| `/obj/item/stack/package_wrap/small` | 2 | code/game/objects/items/storage/boxes.dm:1359 |
| `/obj/item/stack/wrapping_paper/small` | 1 | code/game/objects/items/storage/boxes.dm:1360 |

- `/obj/item/stack/package_wrap/small` (code/game/objects/items/stacks/wrap.dm:127-130): amount 5, w_class SMALL, "This roll looks a bit skimpy." desc. Its afterattack wraps a loose item into a small delivery parcel for 1 sheet, or a closet into a big delivery for 3 sheets (code/game/objects/items/stacks/wrap.dm:67-119). Its `use(1)` logic is in code/game/objects/items/stacks/wrap.dm:85 and code/game/objects/items/stacks/wrap.dm:105.
- `/obj/item/stack/wrapping_paper/small` (code/game/objects/items/stacks/wrap.dm:23-25): amount 10, desc "...This roll looks a bit skimpy." Full details are in part 1 (wrapping paper).
- The three tools (`dest_tagger`, `sales_tagger`, `export_scanner`) are outside this shard. Their stats belong to their own entries.

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| attack_self | box has contents | 0 | `"You can't fold this box with items still inside!"` (code/game/objects/items/storage/boxes.dm:63) | nothing |
| attack_self | empty | 0 | `"You fold [src] flat."` (code/game/objects/items/storage/boxes.dm:68) | folded to cardboard |
| package wrapper (`/obj/item/stack/package_wrap`) | - | 0 | none | returns 0 (code/game/objects/items/storage/boxes.dm:74-75) |

- Construction chain: none (container).
- Deconstruction chain: fold when empty (code/game/objects/items/storage/boxes.dm:57-71).
- Drops: none. Contents stay inside until removed.
- Health / armor: not set on the box chain (default).
- Power: none.
- Gotchas:
  - The box holds 6 items and the default cap is 7 (code/datums/components/storage/storage.dm:29). The default `max_w_class` SMALL (code/datums/components/storage/storage.dm:27) applies to every item inside, including the package wrap rolls and the small wrapping paper roll; the tagger and scanner sizes are outside this shard.
  - The desc says no wrapping paper is included, but the box spawns one small roll (code/game/objects/items/storage/boxes.dm:1360). Quoted as written.
  - Map count x2 on BoxStation.

---

## Tally for part 2 (the shard Coverage is in part 5)

- Items on this part: 3 (prisoner box, spyglass kit, shipping box).
- Documented with real data from the source: 3.
- Marked NOT FOUND: 0.
- Contents documented by path (types outside this shard are named but not expanded): dest_tagger, sales_tagger, export_scanner, spy_bug, regular spy glasses, nerddocs paper, prisoner ID cards.

# gap-items-05 part 3: first-aid kits (regular, emergency, burn, oxygen, toxin, brute)

Tree: `_src/tg2020`. Paths relative to the tree root. Numbers raw (deciseconds where a delay is given).
Items in this part (6 of 28): `/obj/item/storage/firstaid/regular`, `/obj/item/storage/firstaid/emergency`, `/obj/item/storage/firstaid/fire`, `/obj/item/storage/firstaid/o2`, `/obj/item/storage/firstaid/toxin`, `/obj/item/storage/firstaid/brute`.

Map counts on BoxStation (from the list): regular x19, brute x2, fire x2, o2 x2, toxin x3. Emergency: none placed.

## Shared parent: /obj/item/storage/firstaid  (code/game/objects/items/storage/firstaid.dm:11-20)

| var / behaviour | value | file:line |
|---|---|---|
| parent | /obj/item/storage (code/game/objects/items/storage/storage.dm:1, code/game/objects/items/storage/storage.dm:1) | code/game/objects/items/storage/firstaid.dm:11 |
| `name` (base) | "first-aid kit" (each child overrides or keeps) | code/game/objects/items/storage/firstaid.dm:12 |
| `desc` (base) | "It's an emergency medical kit for those serious boo-boos." | code/game/objects/items/storage/firstaid.dm:13 |
| `icon_state` (base) | "firstaid" | code/game/objects/items/storage/firstaid.dm:14 |
| `throw_speed` / `throw_range` | 3 / 7 | code/game/objects/items/storage/firstaid.dm:17-18 |
| `empty` | FALSE (when TRUE, every `PopulateContents` returns at once) | code/game/objects/items/storage/firstaid.dm:19, 31-32 (pattern repeats on each kit) |
| `damagetype_healed` | null (general kit); set per kit below. Used by the medibot to bias healing | code/game/objects/items/storage/firstaid.dm:20; medibot copy at code/modules/mob/living/simple_animal/bot/construction.dm:258-259 |
| storage capacity | no ComponentInitialize on the base kit: default storage component, 7 items, max w_class SMALL, combined 14 | code/datums/components/storage/storage.dm:27-29 |
| `w_class` | NORMAL (3) (storage default) | code/game/objects/items/storage/storage.dm:4 |
| `Initialize` | storage Initialize calls `PopulateContents()` (code/game/objects/items/storage/storage.dm:11-13) | code/game/objects/items/storage/storage.dm:11-13 |

Shared kit behaviour:
- **Medibot conversion** (`attackby`, code/game/objects/items/storage/firstaid.dm:293-316). Applies to every kit on this list (no override in the children):

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| `/obj/item/bodypart/l_arm/robot` or `/obj/item/bodypart/r_arm/robot` | kit has no contents (code/game/objects/items/storage/firstaid.dm:298) | 0 | fail: `"You need to empty [src] out first!"` (code/game/objects/items/storage/firstaid.dm:299) | nothing |
| robot arm, kit empty | - | 0 | `"You add [S] to [src]."` (code/game/objects/items/storage/firstaid.dm:312) | creates `/obj/item/bot_assembly/medbot` and puts it in hands (code/game/objects/items/storage/firstaid.dm:302, 311); `A.robot_arm = S.type`, `A.firstaid = type` (code/game/objects/items/storage/firstaid.dm:313-314); the arm and the kit are both qdeleted (code/game/objects/items/storage/firstaid.dm:315-316) |
| any other item | - | - | - | `return ..()` (code/game/objects/items/storage/firstaid.dm:295), parent storage behaviour |

- Skin set on the new medbot assembly (code/game/objects/items/storage/firstaid.dm:303-310): fire kit `set_skin("ointment")`, toxin kit `set_skin("tox")`, o2 kit `set_skin("o2")`, brute kit `set_skin("brute")`. Regular and emergency kits set no skin (code/game/objects/items/storage/firstaid.dm:303-310 has no branch for them).
- The medbot assembly then needs two steps (code/modules/mob/living/simple_animal/bot/construction.dm:219-260): (1) a `/obj/item/healthanalyzer` (adds it, `"You add [W] to [src]."`, code/modules/mob/living/simple_animal/bot/construction.dm:237-241; name becomes "first aid/robot arm/health analyzer assembly", code/modules/mob/living/simple_animal/bot/construction.dm:243); (2) a proximity sensor (`isprox`) completes the bot (code/modules/mob/living/simple_animal/bot/construction.dm:247-260, `"You complete the Medbot. Beep boop!"` at code/modules/mob/living/simple_animal/bot/construction.dm:253).
- Suicide and the kit-specific `suicide_act` lines are per kit (below).
- Contents are spawned at Initialize through `PopulateContents` (code/game/objects/items/storage/storage.dm:11-13). Items of the same type spawned into one kit can merge if they are stacks (code/game/objects/items/stacks/stack.dm:68-71, inferred for the medical stacks).

---

## regular

### first-aid kit  `/obj/item/storage/firstaid/regular`   (code/game/objects/items/storage/firstaid.dm:22-38)
- A basic kit with gauze, sutures, mesh and one medipen. Map count x19 on BoxStation.
- Key vars (final values):

| var | value | file:line |
|---|---|---|
| `name` | "first-aid kit" (base, code/game/objects/items/storage/firstaid.dm:12) | code/game/objects/items/storage/firstaid.dm:12 |
| `desc` | "A first aid kit with the ability to heal common types of injuries." | code/game/objects/items/storage/firstaid.dm:24 |
| `icon_state` | "firstaid" | code/game/objects/items/storage/firstaid.dm:23 |
| `damagetype_healed` | null (general) | code/game/objects/items/storage/firstaid.dm:20 (base, not overridden) |
| `empty` | FALSE | code/game/objects/items/storage/firstaid.dm:19 |

- Contents at round start (`PopulateContents`, code/game/objects/items/storage/firstaid.dm:30-38, static list spawned by `generate_items_inside`, code/__HELPERS/unsorted.dm:1524-1527):

| type | count | reagents (per unit) | file:line |
|---|---|---|---|
| `/obj/item/stack/medical/gauze` | 1 | none (stack) | code/game/objects/items/storage/firstaid.dm:34; def code/game/objects/items/stacks/medical.dm:116 |
| `/obj/item/stack/medical/suture` | 2 | none (stack) | code/game/objects/items/storage/firstaid.dm:35; def code/game/objects/items/stacks/medical.dm:175 |
| `/obj/item/stack/medical/mesh` | 2 | none (stack) | code/game/objects/items/storage/firstaid.dm:36; def code/game/objects/items/stacks/medical.dm:256 |
| `/obj/item/reagent_containers/hypospray/medipen` | 1 | epinephrine 10, formaldehyde 3, coagulant 2 (total 15) | code/game/objects/items/storage/firstaid.dm:37; def code/modules/reagents/reagent_containers/hypospray.dm:98-110 (list_reagents at :110, volume 15 at :106) |

- Interactions (kit itself): suicide only (below). Medibot conversion as in the shared block.

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| suicide_act | - | - | `"<span class='suicide'>[user] begins giving [user.p_them()]self aids with \the [src]! It looks like [user.p_theyre()] trying to commit suicide!</span>"` (code/game/objects/items/storage/firstaid.dm:27) | returns BRUTELOSS (code/game/objects/items/storage/firstaid.dm:28) |

- Construction chain: kit + robot arm (empty kit) → medbot assembly (no skin) → health analyzer step → proximity sensor step (see shared block).
- Deconstruction chain: none (the kit itself is not folded; no attack_self on the firstaid chain). The contents are removed by storage.
- Drops: none defined by the kit. When the kit is converted, the arm and the kit are qdeleted and contents are gone (code/game/objects/items/storage/firstaid.dm:315-316; the contents are not spawned anywhere, they are deleted with the kit because the medbot path requires an empty kit, code/game/objects/items/storage/firstaid.dm:298).
- Health / armor: none set (default).
- Power: none.
- Gotchas:
  - The medbot path needs an empty kit (code/game/objects/items/storage/firstaid.dm:298-300). Filled kits cannot be converted.
  - The two medical stacks of the same type merge (code/game/objects/items/stacks/stack.dm:68-71).

---

## emergency

### emergency first-aid kit  `/obj/item/storage/firstaid/emergency`   (code/game/objects/items/storage/firstaid.dm:40-55)
- A kit for stabilising serious wounds, with an autoinjector pair and a wound analyzer. No map placement on BoxStation (from the list).
- Key vars (final values):

| var | value | file:line |
|---|---|---|
| `icon_state` | "medbriefcase" | code/game/objects/items/storage/firstaid.dm:41 |
| `name` | "emergency first-aid kit" | code/game/objects/items/storage/firstaid.dm:42 |
| `desc` | "A very simple first aid kit meant to secure and stabilize serious wounds for later treatment." | code/game/objects/items/storage/firstaid.dm:43 |
| `damagetype_healed` | null (general, inherited) | code/game/objects/items/storage/firstaid.dm:20 |

- Contents at round start (`PopulateContents`, code/game/objects/items/storage/firstaid.dm:45-55):

| type | count | reagents (per unit) | file:line |
|---|---|---|---|
| `/obj/item/healthanalyzer/wound` | 1 | none | code/game/objects/items/storage/firstaid.dm:49; def code/game/objects/items/devices/scanners.dm:453 |
| `/obj/item/stack/medical/gauze` | 1 | none (stack) | code/game/objects/items/storage/firstaid.dm:50; def code/game/objects/items/stacks/medical.dm:116 |
| `/obj/item/stack/medical/suture/emergency` | 1 | none (stack) | code/game/objects/items/storage/firstaid.dm:51; def code/game/objects/items/stacks/medical.dm:190 |
| `/obj/item/stack/medical/ointment` | 1 | none (stack) | code/game/objects/items/storage/firstaid.dm:52; def code/game/objects/items/stacks/medical.dm:226 |
| `/obj/item/reagent_containers/hypospray/medipen/ekit` | 2 | epinephrine 12, coagulant 2.5, spaceacillin 0.5 (total 15) | code/game/objects/items/storage/firstaid.dm:53; def code/modules/reagents/reagent_containers/hypospray.dm:278-283 (list_reagents :283, volume 15 :281) |
| `/obj/item/storage/pill_bottle/iron` | 1 | (bottle, see its content below) | code/game/objects/items/storage/firstaid.dm:54; def code/game/objects/items/storage/firstaid.dm:389 |

- Interactions: suicide has no override here (no `suicide_act` on this child). Medibot conversion as in the shared block.
- Construction chain: kit + robot arm (empty kit only) → medbot assembly with no skin → health analyzer → proximity sensor (shared block).
- Deconstruction chain: none.
- Drops: none defined.
- Health / armor: none set.
- Power: none.
- Gotchas:
  - It holds two `ekit` medipens (code/game/objects/items/storage/firstaid.dm:53), each 15 units total.
  - The iron pill bottle in it is a storage item inside a storage item (the bottle holds only pills and dice, see the pill bottle entry).
  - Its contents include the wound analyzer (`/obj/item/healthanalyzer/wound`), which is outside this shard.

---

## burn treatment kit

### burn treatment kit  `/obj/item/storage/firstaid/fire`   (code/game/objects/items/storage/firstaid.dm:151-174)
- A kit for burn damage. Map count x2 on BoxStation.
- Key vars (final values):

| var | value | file:line |
|---|---|---|
| `name` | "burn treatment kit" | code/game/objects/items/storage/firstaid.dm:152 |
| `desc` | "A specialized medical kit for when the toxins lab <i>-spontaneously-</i> burns down." | code/game/objects/items/storage/firstaid.dm:153 |
| `icon_state` | "ointment" at type level; `Initialize` picks "ointment" or "firefirstaid" | code/game/objects/items/storage/firstaid.dm:154, 164 |
| `inhand_icon_state` | "firstaid-ointment" | code/game/objects/items/storage/firstaid.dm:155 |
| `damagetype_healed` | BURN | code/game/objects/items/storage/firstaid.dm:156 |

- Contents at round start (`PopulateContents`, code/game/objects/items/storage/firstaid.dm:166-174):

| type | count | reagents (per unit) | file:line |
|---|---|---|---|
| `/obj/item/reagent_containers/pill/patch/aiuri` | 3 | aiuri 1, granibitaluri 9 (total 10) | code/game/objects/items/storage/firstaid.dm:170; def code/modules/reagents/reagent_containers/patch.dm:36-40 (list_reagents :39) |
| `/obj/item/reagent_containers/spray/hercuri` | 1 | hercuri 100 | code/game/objects/items/storage/firstaid.dm:171; def code/modules/reagents/reagent_containers/spray.dm:409-413 (list_reagents :413) |
| `/obj/item/reagent_containers/hypospray/medipen/oxandrolone` | 1 | oxandrolone 10 | code/game/objects/items/storage/firstaid.dm:172; def code/modules/reagents/reagent_containers/hypospray.dm:171-176 (list_reagents :176) |
| `/obj/item/reagent_containers/hypospray/medipen` | 1 | epinephrine 10, formaldehyde 3, coagulant 2 | code/game/objects/items/storage/firstaid.dm:173; def code/modules/reagents/reagent_containers/hypospray.dm:98-110 |

- Interactions (kit):

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| suicide_act | - | - | `"<span class='suicide'>[user] begins rubbing \the [src] against [user.p_them()]self! It looks like [user.p_theyre()] trying to start a fire!</span>"` (code/game/objects/items/storage/firstaid.dm:159) | returns FIRELOSS (code/game/objects/items/storage/firstaid.dm:160) |
| robot arm (empty kit) | medibot conversion | 0 | `"You add [S] to [src]."` (code/game/objects/items/storage/firstaid.dm:312) | medbot assembly with skin "ointment" (code/game/objects/items/storage/firstaid.dm:303-304) |

- Construction chain: kit + robot arm → medbot assembly (skin "ointment") → health analyzer → proximity sensor (shared block).
- Deconstruction chain: none.
- Drops: none defined.
- Health / armor: none set.
- Power: none.
- Gotchas:
  - The `medbot` gets `damagetype_healer` BURN from the kit (code/modules/mob/living/simple_animal/bot/construction.dm:258-259).
  - The skin check is `istype(src, /obj/item/storage/firstaid/fire)` (code/game/objects/items/storage/firstaid.dm:303-304): children would also match.

---

## oxygen deprivation treatment kit

### oxygen deprivation treatment kit  `/obj/item/storage/firstaid/o2`   (code/game/objects/items/storage/firstaid.dm:201-224)
- A kit for oxygen loss. Map count x2 on BoxStation.
- Key vars (final values):

| var | value | file:line |
|---|---|---|
| `name` | "oxygen deprivation treatment kit" | code/game/objects/items/storage/firstaid.dm:202 |
| `desc` | "A box full of oxygen goodies." | code/game/objects/items/storage/firstaid.dm:203 |
| `icon_state` | "o2" at type level; `Initialize` picks "o2" or "o2second" | code/game/objects/items/storage/firstaid.dm:204, 214 |
| `inhand_icon_state` | "firstaid-o2" | code/game/objects/items/storage/firstaid.dm:205 |
| `damagetype_healed` | OXY | code/game/objects/items/storage/firstaid.dm:206 |

- Contents at round start (`PopulateContents`, code/game/objects/items/storage/firstaid.dm:216-224):

| type | count | reagents (per unit) | file:line |
|---|---|---|---|
| `/obj/item/reagent_containers/syringe/convermol` | 3 | convermol 6, granibitaluri 9 (total 15) | code/game/objects/items/storage/firstaid.dm:220; def code/modules/reagents/reagent_containers/syringes.dm:196-199 (list_reagents :199) |
| `/obj/item/reagent_containers/hypospray/medipen/salbutamol` | 1 | salbutamol 10 | code/game/objects/items/storage/firstaid.dm:221; def code/modules/reagents/reagent_containers/hypospray.dm:192-197 (list_reagents :197) |
| `/obj/item/reagent_containers/hypospray/medipen` | 1 | epinephrine 10, formaldehyde 3, coagulant 2 | code/game/objects/items/storage/firstaid.dm:222; def code/modules/reagents/reagent_containers/hypospray.dm:98-110 |
| `/obj/item/storage/pill_bottle/iron` | 1 | (bottle of 4 iron pills, see its entry) | code/game/objects/items/storage/firstaid.dm:223; def code/game/objects/items/storage/firstaid.dm:389 |

- Interactions (kit):

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| suicide_act | - | - | `"<span class='suicide'>[user] begins hitting [user.p_their()] neck with \the [src]! It looks like [user.p_theyre()] trying to commit suicide!</span>"` (code/game/objects/items/storage/firstaid.dm:209) | returns OXYLOSS (code/game/objects/items/storage/firstaid.dm:210) |
| robot arm (empty kit) | medibot conversion | 0 | `"You add [S] to [src]."` (code/game/objects/items/storage/firstaid.dm:312) | medbot assembly with skin "o2" (code/game/objects/items/storage/firstaid.dm:307-308) |

- Construction chain: kit + robot arm → medbot assembly (skin "o2") → health analyzer → proximity sensor (shared block).
- Deconstruction chain: none.
- Drops: none defined.
- Health / armor: none set.
- Power: none.
- Gotchas:
  - The medbot gets `damagetype_healer` OXY (code/modules/mob/living/simple_animal/bot/construction.dm:258-259).
  - The kit's convermol syringes hold 15 units each (code/modules/reagents/reagent_containers/syringes.dm:199 gives 6 + 9).

---

## toxin treatment kit

### toxin treatment kit  `/obj/item/storage/firstaid/toxin`   (code/game/objects/items/storage/firstaid.dm:176-199)
- A kit for toxins and radiation. Map count x3 on BoxStation.
- Key vars (final values):

| var | value | file:line |
|---|---|---|
| `name` | "toxin treatment kit" | code/game/objects/items/storage/firstaid.dm:177 |
| `desc` | "Used to treat toxic blood content and radiation poisoning." | code/game/objects/items/storage/firstaid.dm:178 |
| `icon_state` | "antitoxin" at type level; `Initialize` picks "antitoxin", "antitoxfirstaid" or "antitoxfirstaid2" | code/game/objects/items/storage/firstaid.dm:179, 189 |
| `inhand_icon_state` | "firstaid-toxin" | code/game/objects/items/storage/firstaid.dm:180 |
| `damagetype_healed` | TOX | code/game/objects/items/storage/firstaid.dm:181 |

- Contents at round start (`PopulateContents`, code/game/objects/items/storage/firstaid.dm:191-199):

| type | count | reagents (per unit) | file:line |
|---|---|---|---|
| `/obj/item/storage/pill_bottle/multiver/less` | 1 | (bottle of 3 multiver pills, see its entry; the pill is multiver 5 + granibitaluri 5) | code/game/objects/items/storage/firstaid.dm:195 (`/obj/item/storage/pill_bottle/multiver/less` in the list, spawned at code/game/objects/items/storage/firstaid.dm:195) ; def code/game/objects/items/storage/firstaid.dm:351 |
| `/obj/item/reagent_containers/syringe/syriniver` | 3 | syriniver 15 | code/game/objects/items/storage/firstaid.dm:196; def code/modules/reagents/reagent_containers/syringes.dm:279-282 (list_reagents :282) |
| `/obj/item/storage/pill_bottle/potassiodide` | 1 | (bottle of 3 pills, see its entry) | code/game/objects/items/storage/firstaid.dm:197; def code/game/objects/items/storage/firstaid.dm:373 |
| `/obj/item/reagent_containers/hypospray/medipen/penacid` | 1 | pentetic acid (pen_acid) 10 | code/game/objects/items/storage/firstaid.dm:198; def code/modules/reagents/reagent_containers/hypospray.dm:178-183 (list_reagents :183) |

- Interactions (kit):

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| suicide_act | - | - | `"<span class='suicide'>[user] begins licking the lead paint off \the [src]! It looks like [user.p_theyre()] trying to commit suicide!</span>"` (code/game/objects/items/storage/firstaid.dm:184) | returns TOXLOSS (code/game/objects/items/storage/firstaid.dm:185) |
| robot arm (empty kit) | medibot conversion | 0 | `"You add [S] to [src]."` (code/game/objects/items/storage/firstaid.dm:312) | medbot assembly with skin "tox" (code/game/objects/items/storage/firstaid.dm:305-306) |

- Construction chain: kit + robot arm → medbot assembly (skin "tox") → health analyzer → proximity sensor (shared block).
- Deconstruction chain: none.
- Drops: none defined.
- Health / armor: none set.
- Power: none.
- Gotchas:
  - Line 195 of the source is indented with a tab and four spaces, not a plain tab (`    /obj/item/storage/pill_bottle/multiver/less = 1,`). Harmless in DM, noted for the port.
  - The medbot gets `damagetype_healer` TOX (code/modules/mob/living/simple_animal/bot/construction.dm:258-259).
  - Map count x3 on BoxStation.

---

## brute trauma treatment kit

### brute trauma treatment kit  `/obj/item/storage/firstaid/brute`   (code/game/objects/items/storage/firstaid.dm:226-249)
- A kit for brute damage ("for when you get toolboxed"). Map count x2 on BoxStation.
- Key vars (final values):

| var | value | file:line |
|---|---|---|
| `name` | "brute trauma treatment kit" | code/game/objects/items/storage/firstaid.dm:227 |
| `desc` | "A first aid kit for when you get toolboxed." | code/game/objects/items/storage/firstaid.dm:228 |
| `icon_state` | "brute" at type level; `Initialize` picks "brute" or "brute2" | code/game/objects/items/storage/firstaid.dm:229, 239 |
| `inhand_icon_state` | "firstaid-brute" | code/game/objects/items/storage/firstaid.dm:230 |
| `damagetype_healed` | BRUTE | code/game/objects/items/storage/firstaid.dm:231 |

- Contents at round start (`PopulateContents`, code/game/objects/items/storage/firstaid.dm:241-249):

| type | count | reagents (per unit) | file:line |
|---|---|---|---|
| `/obj/item/reagent_containers/pill/patch/libital` | 3 | libital 2, granibitaluri 8 (total 10) | code/game/objects/items/storage/firstaid.dm:245; def code/modules/reagents/reagent_containers/patch.dm:30-35 (list_reagents :33) |
| `/obj/item/stack/medical/gauze` | 1 | none (stack) | code/game/objects/items/storage/firstaid.dm:246; def code/game/objects/items/stacks/medical.dm:116 |
| `/obj/item/storage/pill_bottle/probital` | 1 | (bottle of 4 probital pills, see its entry) | code/game/objects/items/storage/firstaid.dm:247; def code/game/objects/items/storage/firstaid.dm:381 |
| `/obj/item/reagent_containers/hypospray/medipen/salacid` | 1 | salicylic acid (sal_acid) 10 | code/game/objects/items/storage/firstaid.dm:248; def code/modules/reagents/reagent_containers/hypospray.dm:185-190 (list_reagents :190) |

- Interactions (kit):

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| suicide_act | - | - | `"<span class='suicide'>[user] begins beating [user.p_them()]self over the head with \the [src]! It looks like [user.p_theyre()] trying to commit suicide!</span>"` (code/game/objects/items/storage/firstaid.dm:234) | returns BRUTELOSS (code/game/objects/items/storage/firstaid.dm:235) |
| robot arm (empty kit) | medibot conversion | 0 | `"You add [S] to [src]."` (code/game/objects/items/storage/firstaid.dm:312) | medbot assembly with skin "brute" (code/game/objects/items/storage/firstaid.dm:309-310) |

- Construction chain: kit + robot arm → medbot assembly (skin "brute") → health analyzer → proximity sensor (shared block).
- Deconstruction chain: none.
- Drops: none defined.
- Health / armor: none set.
- Power: none.
- Gotchas:
  - The medbot gets `damagetype_healer` BRUTE (code/modules/mob/living/simple_animal/bot/construction.dm:258-259).
  - Its name is the same shape as the other kits; its toolbox desc is flavour.

---

## Tally for part 3 (the shard Coverage is in part 5)

- Items on this part: 6 (regular, emergency, fire, o2, toxin, brute).
- Documented with real data from the source: 6.
- Marked NOT FOUND: 0.
- Contents named by path with reagent amounts where the content is a reagent container; pill bottles and stack contents are cited to their own definitions (pill bottles in part 4; stacks and wound analyzer are outside this shard).

# gap-items-05 part 4: pill bottles (mutadone, mannitol, psicodine, psychologist set) and the bag of dice

Tree: `_src/tg2020`. Paths relative to the tree root. Numbers raw (deciseconds where a delay is given; reagent amounts in units).
Items in this part (7 of 28): `/obj/item/storage/pill_bottle/dice`, `/obj/item/storage/pill_bottle/happinesspsych`, `/obj/item/storage/pill_bottle/lsdpsych`, `/obj/item/storage/pill_bottle/mannitol`, `/obj/item/storage/pill_bottle/mutadone`, `/obj/item/storage/pill_bottle/paxpsych`, `/obj/item/storage/pill_bottle/psicodine`.

## Shared parent: /obj/item/storage/pill_bottle  (code/game/objects/items/storage/firstaid.dm:322-341)

| var / behaviour | value | file:line |
|---|---|---|
| `name` | "pill bottle" (each child sets its own) | code/game/objects/items/storage/firstaid.dm:323 |
| `desc` | "It's an airtight container for storing medication." | code/game/objects/items/storage/firstaid.dm:324 |
| `icon` / `icon_state` | 'icons/obj/chemical.dmi' / "pill_canister" | code/game/objects/items/storage/firstaid.dm:325-326 |
| `inhand_icon_state` | "contsolid" | code/game/objects/items/storage/firstaid.dm:327 |
| `w_class` | WEIGHT_CLASS_SMALL (2) | code/game/objects/items/storage/firstaid.dm:330 |
| storage holdable list | `set_holdable(list(/obj/item/reagent_containers/pill, /obj/item/dice))`: only pills and dice go in | code/game/objects/items/storage/firstaid.dm:337 |
| `allow_quick_gather` | TRUE (adds the quick-gather toggle action for the tile) | code/game/objects/items/storage/firstaid.dm:335; code/datums/components/storage/storage.dm:37, 142 |
| `click_gather` | TRUE (clicking a holdable item collects it into the bottle; the default `collection_mode` is COLLECT_EVERYTHING, storage.dm:39, so the whole tile is taken unless the mode is changed) | code/game/objects/items/storage/firstaid.dm:336; code/datums/components/storage/storage.dm:34, 194-206 |
| storage capacity | default storage component, no override in the bottles: 7 items, max w_class SMALL, combined 14 | code/datums/components/storage/storage.dm:27-29 |
| `suicide_act` | `"<span class='suicide'>[user] is trying to get the cap off [src]! It looks like [user.p_theyre()] trying to commit suicide!</span>"`, returns TOXLOSS | code/game/objects/items/storage/firstaid.dm:339-341 |

Shared behaviour of the bottle's pills (the parent of every pill is `/obj/item/reagent_containers/pill`, code/modules/reagents/reagent_containers/pill.dm:1-16):

| var / behaviour | value | file:line |
|---|---|---|
| `volume` | 50 (max reagent units) | code/modules/reagents/reagent_containers/pill.dm:10 |
| `apply_type` / `apply_method` | INGEST / "swallow" | code/modules/reagents/reagent_containers/pill.dm:12-13 |
| `rename_with_volume` | FALSE by default; TRUE on every pill below | code/modules/reagents/reagent_containers/pill.dm:14; set per pill |
| `self_delay` | 0 (instant) | code/modules/reagents/reagent_containers/pill.dm:15 |
| Initialize | random `icon_state` "pill[rand(1,20)]" if none set; if `rename_with_volume` and it holds reagents, the name gets `" ([total_volume]u)"` appended | code/modules/reagents/reagent_containers/pill.dm:18-23 |
| `attack_self` | returns nothing (no action) | code/modules/reagents/reagent_containers/pill.dm:26-27 |
| `attack` (eat) | self: `"[user] attempts to [apply_method] [src]."` (code/modules/reagents/reagent_containers/pill.dm:35), then `"You [apply_method] [src]."` (code/modules/reagents/reagent_containers/pill.dm:39), so "You swallow [src]." for ingest pills; forced on someone else: `"[user] attempts to force [M] to [apply_method] [src]."` and `"[user] forces [M] to [apply_method] [src]."` (code/modules/reagents/reagent_containers/pill.dm:42-46). Instant (self_delay 0). Reagents transferred with method `apply_type` (code/modules/reagents/reagent_containers/pill.dm:52-53); pill deleted (code/modules/reagents/reagent_containers/pill.dm:54) | code/modules/reagents/reagent_containers/pill.dm:30-55 |
| red pill easter egg | `icon_state == "pill4"` and 5% (`prob(5)`) shows a random line from `REDPILL_FILE` after 50 ds | code/modules/reagents/reagent_containers/pill.dm:49-50 |

Gotcha for the whole family: the bottle name and the pill name are different text in several cases (noted per bottle below).

---

## Mutadone

### bottle of mutadone pills  `/obj/item/storage/pill_bottle/mutadone`   (code/game/objects/items/storage/firstaid.dm:365-371)
- A bottle of 7 mutadone pills. Map count x1 on BoxStation.
- Key vars (final values):

| var | value | file:line |
|---|---|---|
| `name` | "bottle of mutadone pills" | code/game/objects/items/storage/firstaid.dm:366 |
| `desc` | "Contains pills used to treat genetic abnormalities." | code/game/objects/items/storage/firstaid.dm:367 |

- Contents at round start (`PopulateContents`, code/game/objects/items/storage/firstaid.dm:369-371): `for (1 to 7)` `new /obj/item/reagent_containers/pill/mutadone(src)`. No `..()` call.
- Pill definition `/obj/item/reagent_containers/pill/mutadone` (code/modules/reagents/reagent_containers/pill.dm:141-146): name "mutadone pill" (code/modules/reagents/reagent_containers/pill.dm:142), desc "Used to treat genetic damage." (code/modules/reagents/reagent_containers/pill.dm:143), icon_state "pill20" (code/modules/reagents/reagent_containers/pill.dm:144), `list_reagents = list(/datum/reagent/medicine/mutadone = 50)` (code/modules/reagents/reagent_containers/pill.dm:145), `rename_with_volume` TRUE (code/modules/reagents/reagent_containers/pill.dm:146). Each pill is named "mutadone pill (50u)" on spawn (code/modules/reagents/reagent_containers/pill.dm:22-23).
- Interactions: see the shared table (eat a pill, force-feed, click to collect into the bottle). Suicide: TOXLOSS (code/game/objects/items/storage/firstaid.dm:339-341).
- Construction chain: none (container).
- Deconstruction chain: none. Pills are removed by taking them out.
- Drops: none defined.
- Health / armor: none set.
- Power: none.
- Gotchas:
  - The bottle holds 7 pills of 50 units each, total 350 units.
  - The bottle's own storage cap is 7 items (code/datums/components/storage/storage.dm:29), so it is full at spawn.

## Mannitol

### bottle of mannitol pills  `/obj/item/storage/pill_bottle/mannitol`   (code/game/objects/items/storage/firstaid.dm:397-403)
- A bottle of 7 mannitol pills (brain damage). No map placement on BoxStation (from the list).
- Key vars (final values):

| var | value | file:line |
|---|---|---|
| `name` | "bottle of mannitol pills" | code/game/objects/items/storage/firstaid.dm:398 |
| `desc` | "Contains pills used to treat brain damage." | code/game/objects/items/storage/firstaid.dm:399 |

- Contents at round start (`PopulateContents`, code/game/objects/items/storage/firstaid.dm:401-403): `for (1 to 7)` `new /obj/item/reagent_containers/pill/mannitol(src)`.
- Pill definition `/obj/item/reagent_containers/pill/mannitol` (code/modules/reagents/reagent_containers/pill.dm:129-134): name "mannitol pill" (code/modules/reagents/reagent_containers/pill.dm:130), desc "Used to treat brain damage." (code/modules/reagents/reagent_containers/pill.dm:131), icon_state "pill17" (code/modules/reagents/reagent_containers/pill.dm:132), `list_reagents = list(/datum/reagent/medicine/mannitol = 50)` (code/modules/reagents/reagent_containers/pill.dm:133), `rename_with_volume` TRUE (code/modules/reagents/reagent_containers/pill.dm:134). Spawned name "mannitol pill (50u)".
- Sibling: `/obj/item/storage/pill_bottle/mannitol/braintumor` (code/game/objects/items/storage/firstaid.dm:406-411) holds 4 diluted 5-unit pills (`/obj/item/reagent_containers/pill/mannitol/braintumor`); not on this list. The comment at code/game/objects/items/storage/firstaid.dm:405 gives the reason.
- Interactions: shared table. Suicide: TOXLOSS (code/game/objects/items/storage/firstaid.dm:339-341).
- Construction chain: none.
- Deconstruction chain: none.
- Drops: none defined.
- Health / armor: none set.
- Power: none.
- Gotchas:
  - 7 pills at 50 units each. The bottle name and the pill name both say mannitol.

## Psicodine

### bottle of psicodine pills  `/obj/item/storage/pill_bottle/psicodine`   (code/game/objects/items/storage/firstaid.dm:462-468)
- A bottle of 7 psicodine pills (mental distress and traumas). No map placement on BoxStation (from the list).
- Key vars (final values):

| var | value | file:line |
|---|---|---|
| `name` | "bottle of psicodine pills" | code/game/objects/items/storage/firstaid.dm:463 |
| `desc` | "Contains pills used to treat mental distress and traumas." | code/game/objects/items/storage/firstaid.dm:464 |

- Contents at round start (`PopulateContents`, code/game/objects/items/storage/firstaid.dm:466-468): `for (1 to 7)` `new /obj/item/reagent_containers/pill/psicodine(src)`.
- Pill definition `/obj/item/reagent_containers/pill/psicodine` (code/modules/reagents/reagent_containers/pill.dm:169-174): name "psicodine pill" (code/modules/reagents/reagent_containers/pill.dm:170), desc "Used to treat mental instability and phobias." (code/modules/reagents/reagent_containers/pill.dm:171), `list_reagents = list(/datum/reagent/medicine/psicodine = 10)` (code/modules/reagents/reagent_containers/pill.dm:172), icon_state "pill22" (code/modules/reagents/reagent_containers/pill.dm:173), `rename_with_volume` TRUE (code/modules/reagents/reagent_containers/pill.dm:174). Spawned name "psicodine pill (10u)".
- Interactions: shared table. Suicide: TOXLOSS (code/game/objects/items/storage/firstaid.dm:339-341).
- Construction chain: none.
- Deconstruction chain: none.
- Drops: none defined.
- Health / armor: none set.
- Power: none.
- Gotchas:
  - 7 pills at 10 units each, 70 units total.

---

## Psychologist set

These three bottles are the psychologist's stock (the comment at code/game/objects/items/storage/firstaid.dm:504 says so). None is placed on BoxStation (from the list).

### happiness pills  `/obj/item/storage/pill_bottle/happinesspsych`   (code/game/objects/items/storage/firstaid.dm:505-511)
- A bottle of 5 mood stabiliser pills.
- Key vars (final values):

| var | value | file:line |
|---|---|---|
| `name` | "happiness pills" | code/game/objects/items/storage/firstaid.dm:506 |
| `desc` | "Contains pills used as a last resort means to temporarily stabilize depression and anxiety. WARNING: side effects may include slurred speech, drooling, and severe addiction." | code/game/objects/items/storage/firstaid.dm:507 |

- Contents at round start (`PopulateContents`, code/game/objects/items/storage/firstaid.dm:509-511): `for (1 to 5)` `new /obj/item/reagent_containers/pill/happinesspsych(src)`.
- Pill definition `/obj/item/reagent_containers/pill/happinesspsych` (code/modules/reagents/reagent_containers/pill.dm:199-204): name "mood stabilizer pill" (code/modules/reagents/reagent_containers/pill.dm:200), desc "Used to temporarily alleviate anxiety and depression, take only as prescribed." (code/modules/reagents/reagent_containers/pill.dm:201), `list_reagents = list(/datum/reagent/drug/happiness = 5)` (code/modules/reagents/reagent_containers/pill.dm:202), icon_state "pill_happy" (code/modules/reagents/reagent_containers/pill.dm:203), `rename_with_volume` TRUE (code/modules/reagents/reagent_containers/pill.dm:204). Spawned name "mood stabilizer pill (5u)".
- Interactions: shared table. Suicide: TOXLOSS (code/game/objects/items/storage/firstaid.dm:339-341).
- Construction chain: none. Deconstruction chain: none. Drops: none defined. Health / armor: none set. Power: none.
- Gotchas: the pill is named "mood stabilizer pill", not "happiness pill". 5 pills at 5 units, 25 units total.

### mindbreaker toxin pills  `/obj/item/storage/pill_bottle/lsdpsych`   (code/game/objects/items/storage/firstaid.dm:513-519)
- A bottle of 5 antipsychotic pills whose contents are mindbreaker toxin. No map placement (from the list).
- Key vars (final values):

| var | value | file:line |
|---|---|---|
| `name` | "mindbreaker toxin pills" | code/game/objects/items/storage/firstaid.dm:514 |
| `desc` | "!FOR THERAPEUTIC USE ONLY! Contains pills used to alleviate the symptoms of Reality Dissociation Syndrome." | code/game/objects/items/storage/firstaid.dm:515 |

- Contents at round start (`PopulateContents`, code/game/objects/items/storage/firstaid.dm:517-519): `for (1 to 5)` `new /obj/item/reagent_containers/pill/lsdpsych(src)`.
- Pill definition `/obj/item/reagent_containers/pill/lsdpsych` (code/modules/reagents/reagent_containers/pill.dm:213-218): name "antipsychotic pill" (code/modules/reagents/reagent_containers/pill.dm:214), desc "Talk to your healthcare provider immediately if hallucinations worsen or new hallucinations emerge." (code/modules/reagents/reagent_containers/pill.dm:215), `list_reagents = list(/datum/reagent/toxin/mindbreaker = 5)` (code/modules/reagents/reagent_containers/pill.dm:216), icon_state "pill14" (code/modules/reagents/reagent_containers/pill.dm:217), `rename_with_volume` TRUE (code/modules/reagents/reagent_containers/pill.dm:218). Spawned name "antipsychotic pill (5u)".
- Interactions: shared table. Suicide: TOXLOSS (code/game/objects/items/storage/firstaid.dm:339-341).
- Construction chain: none. Deconstruction chain: none. Drops: none defined. Health / armor: none set. Power: none.
- Gotchas:
  - The bottle is labelled "mindbreaker toxin pills" (code/game/objects/items/storage/firstaid.dm:514) but each pill is named "antipsychotic pill" (code/modules/reagents/reagent_containers/pill.dm:214) and holds `/datum/reagent/toxin/mindbreaker` (code/modules/reagents/reagent_containers/pill.dm:216). The reagent path is a toxin type. Quoted as in the source.
  - 5 pills at 5 units, 25 units total.

### pax pills  `/obj/item/storage/pill_bottle/paxpsych`   (code/game/objects/items/storage/firstaid.dm:521-527)
- A bottle of 5 pacification pills. No map placement (from the list).
- Key vars (final values):

| var | value | file:line |
|---|---|---|
| `name` | "pax pills" | code/game/objects/items/storage/firstaid.dm:522 |
| `desc` | "Contains pills used to temporarily pacify patients that are deemed a harm to themselves or others." | code/game/objects/items/storage/firstaid.dm:523 |

- Contents at round start (`PopulateContents`, code/game/objects/items/storage/firstaid.dm:525-527): `for (1 to 5)` `new /obj/item/reagent_containers/pill/paxpsych(src)`.
- Pill definition `/obj/item/reagent_containers/pill/paxpsych` (code/modules/reagents/reagent_containers/pill.dm:206-211): name "pacification pill" (code/modules/reagents/reagent_containers/pill.dm:207), desc "Used to temporarily suppress violent, homicidal, or suicidal behavior in patients." (code/modules/reagents/reagent_containers/pill.dm:208), `list_reagents = list(/datum/reagent/pax = 5)` (code/modules/reagents/reagent_containers/pill.dm:209), icon_state "pill12" (code/modules/reagents/reagent_containers/pill.dm:210), `rename_with_volume` TRUE (code/modules/reagents/reagent_containers/pill.dm:211). Spawned name "pacification pill (5u)".
- Interactions: shared table. Suicide: TOXLOSS (code/game/objects/items/storage/firstaid.dm:339-341).
- Construction chain: none. Deconstruction chain: none. Drops: none defined. Health / armor: none set. Power: none.
- Gotchas: 5 pills at 5 units, 25 units total.

---

## Bag of dice

### bag of dice  `/obj/item/storage/pill_bottle/dice`   (code/game/objects/items/dice.dm:3-31)
- A pill-bottle-type bag with a set of dice: d4, d6, d8, d10, d12, d20 plus one random special die. Parent `/obj/item/storage/pill_bottle` (code/game/objects/items/storage/firstaid.dm:322). Map count x2 on BoxStation.
- Key vars (final values):

| var | value | file:line |
|---|---|---|
| `name` | "bag of dice" | code/game/objects/items/dice.dm:4 |
| `desc` | "Contains all the luck you'll ever need." | code/game/objects/items/dice.dm:5 |
| `icon` / `icon_state` | 'icons/obj/dice.dmi' / "dicebag" | code/game/objects/items/dice.dm:6-7 |
| `special_die` | list of 8: `/obj/item/dice/d1`, `/obj/item/dice/d2`, `/obj/item/dice/fudge`, `/obj/item/dice/d6/space`, `/obj/item/dice/d00`, `/obj/item/dice/eightbd20`, `/obj/item/dice/fourdd6`, `/obj/item/dice/d100` | code/game/objects/items/dice.dm:8-17 |
| holdable | inherited from the pill bottle: pills and `/obj/item/dice` (code/game/objects/items/storage/firstaid.dm:337) | code/game/objects/items/storage/firstaid.dm:337 |

- Contents at round start (`PopulateContents`, code/game/objects/items/dice.dm:19-27): `new` one each of `/obj/item/dice/d4`, `/obj/item/dice/d6`, `/obj/item/dice/d8`, `/obj/item/dice/d10`, `/obj/item/dice/d12`, `/obj/item/dice/d20` (code/game/objects/items/dice.dm:20-25), then `var/picked = pick(special_die)` and `new picked(src)` (code/game/objects/items/dice.dm:26-27). The random pick is from the 8 special dice above. The proc does not call `..()`.
- Die sides (the faces each die rolls): d4 = 4 (code/game/objects/items/dice.dm:83-87), d6 = 6 (`sides` default, code/game/objects/items/dice.dm:53), d8 = 8 (code/game/objects/items/dice.dm:119-123), d10 = 10 (code/game/objects/items/dice.dm:125-129), d12 = 12 (code/game/objects/items/dice.dm:137-141), d20 = 20 (code/game/objects/items/dice.dm:143-147). Each die rolls `roll(sides)` at Initialize (code/game/objects/items/dice.dm:61-65).
- Die use (for the contents, documented in full elsewhere): `attack_self` calls `diceroll(user)` (code/game/objects/items/dice.dm:182-183); throwing calls `diceroll(thrownby)` (code/game/objects/items/dice.dm:185-186). The d4 also gets a caltrop component (`AddComponent(/datum/component/caltrop, 1, 4)`, code/game/objects/items/dice.dm:89-91), "1d4 damage".
- Interactions (bag):

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| suicide_act | - | - | `"<span class='suicide'>[user] is gambling with death! It looks like [user.p_theyre()] trying to commit suicide!</span>"` (code/game/objects/items/dice.dm:30) | returns OXYLOSS (code/game/objects/items/dice.dm:31) |
| dice / pills clicked with the bag | holdable (pill or die), click_gather (code/game/objects/items/storage/firstaid.dm:336-337) | 0 | none | collected into the bag (code/datums/components/storage/storage.dm:194-206; mode COLLECT_EVERYTHING by default, storage.dm:39) |

- Construction chain: none (container).
- Deconstruction chain: none.
- Drops: none defined.
- Health / armor: none set.
- Power: none.
- Gotchas:
  - The bag is a pill bottle subtype, so only pills and dice go in (code/game/objects/items/storage/firstaid.dm:337). The inherited suicide message is replaced by the dice one (code/game/objects/items/dice.dm:29-31).
  - The special die is random per spawn (code/game/objects/items/dice.dm:26).
  - The bag holds 7 items in total (the default cap, code/datums/components/storage/storage.dm:29): the six fixed dice plus the special one.
  - Hazard variant `/obj/item/storage/pill_bottle/dice/hazard` (code/game/objects/items/dice.dm:33-43) is not on this list.

---

## Tally for part 4 (the shard Coverage is in part 5)

- Items on this part: 7 (dice bag; mutadone, mannitol, psicodine, happiness, mindbreaker/lsd, pax bottles).
- Documented with real data from the source: 7.
- Marked NOT FOUND: 0.
- Contents named by path with their reagent amounts from the pill definitions: mutadone, mannitol, psicodine, happiness, lsd (mindbreaker), pax pills; d4, d6, d8, d10, d12, d20 and the special dice by path (die bodies beyond sides are in the dice shard).

# gap-items-05 part 5: surgical drapes, automatic mining scanner (lesser), alien shooting target

Tree: `_src/tg2020`. Paths relative to the tree root. Numbers raw (deciseconds where a delay is given).
Items in this part (3 of 28): `/obj/item/surgical_drapes`, `/obj/item/t_scanner/adv_mining_scanner/lesser`, `/obj/item/target/alien`.

---

## Surgical drapes

### surgical drapes  `/obj/item/surgical_drapes`   (code/modules/surgery/tools.dm:166-179)
- A cloth that is laid over a patient to start a surgery. Map count x2 on BoxStation.
- Parent: `/obj/item` (no intermediate type). Key vars (final values):

| var | value | file:line |
|---|---|---|
| `name` | "surgical drapes" | code/modules/surgery/tools.dm:167 |
| `desc` | "Nanotrasen brand surgical drapes provide optimal safety and infection control." | code/modules/surgery/tools.dm:168 |
| `icon` / `icon_state` | 'icons/obj/surgery.dmi' / "surgical_drapes" | code/modules/surgery/tools.dm:169-170 |
| `lefthand_file` / `righthand_file` | 'icons/mob/inhands/equipment/medical_lefthand.dmi' / 'icons/mob/inhands/equipment/medical_righthand.dmi' | code/modules/surgery/tools.dm:171-172 |
| `inhand_icon_state` | "drapes" | code/modules/surgery/tools.dm:173 |
| `w_class` | WEIGHT_CLASS_TINY (1) | code/modules/surgery/tools.dm:174 |
| `attack_verb` | list("slapped") | code/modules/surgery/tools.dm:175 |
| `force` / `throwforce` / `slot_flags` | not set on this type (engine defaults, inferred) | code/modules/surgery/tools.dm:166-175 |

- Interactions:

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| `attack` on a living mob (`attempt_initiate_surgery`) | the mob is a living target; a surgery is available at the selected zone and the user picks one | 0 (the choice is an `input()` dialog, no ds delay) | success: `"[user] drapes [I] over [M]'s [parse_zone(selected_zone)] to prepare for surgery."` and `"You drape [I] over [M]'s [parse_zone(selected_zone)] to prepare for \an [procedure.name]."` (code/modules/surgery/surgery_helpers.dm:72-73); the procedure is created as `new S.type(M, selected_zone, affecting)` (code/modules/surgery/surgery_helpers.dm:71) | surgery started on the zone |
| same, zone still covered | `S.ignore_clothes` FALSE and `get_location_accessible(M, selected_zone)` FALSE | 0 | `"You need to expose [M]'s [parse_zone(selected_zone)] first!"` (code/modules/surgery/surgery_helpers.dm:77) | nothing started; clothing has to come off first |
| same, no surgery available | `available_surgeries.len` is 0 | 0 | none | the helper returns null, so the normal attack runs (code/modules/surgery/surgery_helpers.dm:44-45; code/modules/surgery/tools.dm:177-179) |
| same, a surgery already on the zone | `current_surgery` exists and is not mid-step | 0 | none | `attempt_cancel_surgery` (code/modules/surgery/surgery_helpers.dm:79-80) |
| `attack` on a non-living target | `istype(M)` false | 0 | none | returns null, normal attack runs (code/modules/surgery/surgery_helpers.dm:2-3) |

  - The `attack` override returns after the helper if the helper returned TRUE (code/modules/surgery/tools.dm:177-179 with the TRUE return at code/modules/surgery/surgery_helpers.dm:82). The user's choice in the dialog can be cancelled and it still returns TRUE, so the normal attack does not happen (code/modules/surgery/surgery_helpers.dm:47-48, 82) (inferred from the control flow).

- Construction chain: none in the item's own code. A research design exists: `/datum/design/surgical_drapes` (code/modules/research/designs/medical_designs.dm:215), outside this shard.
- Deconstruction chain: none.
- Drops: none.
- Health / armor: not set.
- Power: none.
- Gotchas:
  - They are also stocked in several places: backpacks (code/game/objects/items/storage/backpack.dm:377, 399, 485), the paramedic belt (code/game/objects/items/storage/belt.dm:162), the medical kit (code/game/objects/items/storage/firstaid.dm:93 holdable, 128 contents), and the robot module lists (code/modules/mob/living/silicon/robot/robot_modules.dm:278, 609). Not on this list beyond the mention.
  - Map count x2 on BoxStation.

---

## Automatic mining scanner (lesser)

### automatic mining scanner  `/obj/item/t_scanner/adv_mining_scanner/lesser`   (code/modules/mining/equipment/mineral_scanner.dm:51-55)
- A short-range version of the advanced automatic mining scanner. When switched on it pulses every 50 ds and reveals ore in the 4-tile radius. No map placement on BoxStation (from the list).
- Parent `/obj/item/t_scanner/adv_mining_scanner` (code/modules/mining/equipment/mineral_scanner.dm:33-45), grandparent `/obj/item/t_scanner` (code/game/objects/items/devices/scanners.dm:21-34).
- Key vars (final values):

| var | value | from | file:line |
|---|---|---|---|
| `name` | "automatic mining scanner" | own | code/modules/mining/equipment/mineral_scanner.dm:52 |
| `desc` | "A scanner that automatically checks surrounding rock for useful minerals; it can also be used to stop gibtonite detonations." | own | code/modules/mining/equipment/mineral_scanner.dm:53 |
| `range` | 4 (the parent has 7) | own | code/modules/mining/equipment/mineral_scanner.dm:54 (parent :45) |
| `cooldown` | 50 (ds; the parent has 35) | own | code/modules/mining/equipment/mineral_scanner.dm:55 (parent :43) |
| `current_cooldown` | 0 | parent | code/modules/mining/equipment/mineral_scanner.dm:44 |
| `icon_state` | "mining0" (off); `toggle_on` makes it "mining1" when on | parent | code/modules/mining/equipment/mineral_scanner.dm:36; code/game/objects/items/devices/scanners.dm:42 |
| `inhand_icon_state` | "analyzer" | parent | code/modules/mining/equipment/mineral_scanner.dm:37 |
| `w_class` | WEIGHT_CLASS_SMALL (2) | parent | code/modules/mining/equipment/mineral_scanner.dm:40 |
| `flags_1` | CONDUCT_1 | parent | code/modules/mining/equipment/mineral_scanner.dm:41 |
| `slot_flags` | ITEM_SLOT_BELT | parent | code/modules/mining/equipment/mineral_scanner.dm:42 |
| `on` | FALSE (from t_scanner) | grandparent | code/game/objects/items/devices/scanners.dm:27 |
| `custom_price` | 150 | grandparent | code/game/objects/items/devices/scanners.dm:24 |
| `custom_materials` | iron = 150 | grandparent | code/game/objects/items/devices/scanners.dm:34 |
| `icon` | 'icons/obj/device.dmi' | grandparent | code/game/objects/items/devices/scanners.dm:25 |

- Interactions:

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| `attack_self` | - | 0 | none (the grandparent `attack_self` only calls `toggle_on`, code/game/objects/items/devices/scanners.dm:48-49) | `toggle_on()` flips `on`, changes `icon_state` to the other state, and starts (on) or stops (off) processing (code/game/objects/items/devices/scanners.dm:40-46) |
| `process` while on | - | every process tick | none | calls `scan()` (code/game/objects/items/devices/scanners.dm:56-60) |
| `scan` | `current_cooldown <= world.time` | 50 (`cooldown`) | none | sets `current_cooldown = world.time + cooldown` and calls `mineral_scan_pulse(t, range)` on the scanner's turf (code/modules/mining/equipment/mineral_scanner.dm:57-61) |
| pulse effect | any `/turf/closed/mineral` with `scan_state` set in range | overlay lasts 35 (`duration`) | none | each such turf gets a `/obj/effect/temp_visual/mining_overlay` showing its `scan_state` (code/modules/mining/equipment/mineral_scanner.dm:63-74, 76-87) |
| `attack_self` cyborg variant | - | - | - | the cyborg subtype turns itself on in `Initialize` (code/modules/mining/equipment/mineral_scanner.dm:47-49). Not this type. |
| suicide_act (inherited) | - | - | `"<span class='suicide'>[user] begins to emit terahertz-rays into [user.p_their()] brain with [src]! It looks like [user.p_theyre()] trying to commit suicide!</span>"` (code/game/objects/items/devices/scanners.dm:37) | returns TOXLOSS (code/game/objects/items/devices/scanners.dm:38) |

- Construction chain: none (it is a finished item; custom materials iron 150 at code/game/objects/items/devices/scanners.dm:34 are the spawn-time materials).
- Deconstruction chain: none.
- Drops: none.
- Health / armor: not set on the scanner chain (default).
- Power: none. The scanner chain has no power or cell code (code/game/objects/items/devices/scanners.dm:21-62, code/modules/mining/equipment/mineral_scanner.dm:33-61).
- Gotchas:
  - It only scans turfs that are `/turf/closed/mineral` with a `scan_state`. Nothing else reacts.
  - Each reveal overlay lasts 35 ds (`duration = 35`, code/modules/mining/equipment/mineral_scanner.dm:81) and a new pulse can start every 50 ds (`cooldown` of the lesser scanner, code/modules/mining/equipment/mineral_scanner.dm:55).
  - The scanner uses the same `mineral_scan_pulse` proc as the other mining scanners (code/modules/mining/equipment/mineral_scanner.dm:63), which is defined on this file's top-level and is shared.
  - Toggling is free: `attack_self` has no delay and no message.

---

## Alien shooting target

### shooting target (alien)  `/obj/item/target/alien`   (code/game/objects/items/shooting_range.dm:47-50)
- A paper-like target shaped like a xenomorph, for the shooting range. It takes bullet damage from its `hp`, shows the holes, and breaks at 0. Map count x2 on BoxStation.
- Parent `/obj/item/target` (code/game/objects/items/shooting_range.dm:1-8). Key vars (final values):

| var | value | from | file:line |
|---|---|---|---|
| `name` | "shooting target" | parent | code/game/objects/items/shooting_range.dm:2 |
| `desc` | "A shooting target that looks like a xenomorphic alien." | own | code/game/objects/items/shooting_range.dm:49 (parent desc "A shooting target." at :3) |
| `icon` / `icon_state` | 'icons/obj/objects.dmi' / "target_q" | parent icon :4; own icon_state | code/game/objects/items/shooting_range.dm:4, 48 |
| `density` | FALSE | parent | code/game/objects/items/shooting_range.dm:6 |
| `hp` | 2350 | own (parent 1800) | code/game/objects/items/shooting_range.dm:50 (parent :7) |
| `anchored` | not set (FALSE by default); the anchored subtype `/obj/item/target/alien/anchored` sets TRUE | own subtype | code/game/objects/items/shooting_range.dm:52-53 |
| `pinnedLoc` | null; can be pinned to a target stake (not on this list) | parent | code/game/objects/items/shooting_range.dm:8 |

- Interactions:

| held item / action | condition | delay (ds) | message(s) verbatim | result |
|---|---|---|---|---|
| bullet hit (`bullet_act`) | projectile is not a reusable (foam) round; the impact pixel of the target's icon is not transparent; `P.original == src`; overlays at most 35 (code/game/objects/items/shooting_range.dm:67-76) | - | none unless destroyed | `hp -= P.damage` (code/game/objects/items/shooting_range.dm:77). A bullet hole overlay is added (code/game/objects/items/shooting_range.dm:81-92): a "scorch" for hits that are not `/obj/projectile/bullet` (icon_state "light_scorch" when `damage < 20` and not a practice beam), a "dent" for `/obj/projectile/bullet` hits. Returns BULLET_ACT_HIT (code/game/objects/items/shooting_range.dm:93) |
| bullet hit, `hp <= 0` | - | - | `"<span class='danger'>[src] breaks into tiny pieces and collapses!</span>"` (code/game/objects/items/shooting_range.dm:79) | `qdel(src)` (code/game/objects/items/shooting_range.dm:80) |
| bullet miss (pixel transparent or other target) | - | - | none | returns BULLET_ACT_FORCE_PIERCE (code/game/objects/items/shooting_range.dm:94) |
| foam dart (`/obj/projectile/bullet/reusable`) | - | - | none | `P.on_hit(src, 0)` with no damage (code/game/objects/items/shooting_range.dm:68-69) |
| welder (`welder_act`) | `I.use_tool(src, user, 0, volume=40)` | 0 | `"You slice off [src]'s uneven chunks of aluminium and scorch marks."` (code/game/objects/items/shooting_range.dm:32) | `removeOverlays()` clears the bullet holes (code/game/objects/items/shooting_range.dm:31; `cut_overlays`, code/game/objects/items/shooting_range.dm:20-21) |
| hand (`attack_hand`) | target pinned to a stake | 0 | none | `pinnedLoc.removeTarget(user)` (code/game/objects/items/shooting_range.dm:35-40) |
| `Destroy` | - | - | none | clears overlays and un-pins from a stake (code/game/objects/items/shooting_range.dm:10-14) |
| `Move` | target pinned | - | none | the stake is moved with it (code/game/objects/items/shooting_range.dm:23-26) |

- Construction chain: none.
- Deconstruction chain: none. The welder only removes the holes.
- Drops: none defined (the target is simply `qdel`ed on break, code/game/objects/items/shooting_range.dm:80).
- Health / armor: `hp` 2350 for this type (code/game/objects/items/shooting_range.dm:50). The damage that reduces it is the projectile's `damage` (code/game/objects/items/shooting_range.dm:77). No armor set.
- Power: none.
- Gotchas:
  - `density` is FALSE (code/game/objects/items/shooting_range.dm:6), so the target does not block movement.
  - The break message is shown at `hp <= 0` only after the hit passes the pixel check (code/game/objects/items/shooting_range.dm:76-79).
  - The name is the parent's "shooting target", the desc says alien (code/game/objects/items/shooting_range.dm:49).
  - The stake pin is in the parent (`pinnedLoc`, code/game/objects/items/shooting_range.dm:8); the stake type itself is not on this list.

---

## Coverage

Whole shard `gap-items-05` (list `docs/tg/_todo3/gap-items-05.txt`, 28 entries):

- Entries on the list: 28.
- Entries documented with real data from the source: 28 (parts 1 to 5: part 1 has 9, part 2 has 3, part 3 has 6, part 4 has 7, part 5 has 3).
- Entries marked NOT FOUND: 0.
- Paths the exact tgwhere output could not locate: none. All 28 were located by `tools/tgwhere.py`; the definition lines are cited in each entry (e.g. `/obj/item/storage/firstaid/brute` at code/game/objects/items/storage/firstaid.dm:226, `/obj/item/target/alien` at code/game/objects/items/shooting_range.dm:47, `/obj/item/surgical_drapes` at code/modules/surgery/tools.dm:166).

