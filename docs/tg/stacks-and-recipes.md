# Stackable items and the crafting menu

TG's stack system stores items in countable quantities. Stacks merge when placed together. The recipe system lets stacks build complex structures and items via a UI menu triggered by attack_self or AltClick. Each stack carries a list of `datum/stack_recipe` objects that describe what can be built, the materials needed, time, and placement rules.

## `/obj/item/stack`  `/obj/item/stack`  (code/game/objects/items/stacks/stack.dm:13)

Base class for all stackable items.

- What it is: A container for countable identical items that can be merged, split, and used to craft via a menu.
- Key vars:
  - `amount` = 1 (code/game/objects/items/stacks/stack.dm:20) — current count in stack
  - `max_amount` = 50 (code/game/objects/items/stacks/stack.dm:21) — max capacity; if exceeded on init, spills into new stacks
  - `singular_name` (code/game/objects/items/stacks/stack.dm:19) — "metal sheet", "glass sheet", etc.; shown in recipe menu as "[amount] [singular_name]s"
  - `merge_type` = null (code/game/objects/items/stacks/stack.dm:25) — type path that should merge with this; defaults to src.type; child stacks of the same merge_type combine when touched or placed together
  - `is_cyborg` = 0 (code/game/objects/items/stacks/stack.dm:22) — if 1, stack stores energy instead of physical items; uses `source` (robot_energy_storage) and `cost` (energy per unit)
  - `list/recipes` (code/game/objects/items/stacks/stack.dm:18) — list of datum/stack_recipe; filled by get_main_recipes() and material categories on Initialize
  - `novariants` = TRUE (code/game/objects/items/stacks/stack.dm:27) — if FALSE, icon_state changes based on amount (e.g., "sheet-metal", "sheet-metal_2", "sheet-metal_3")

- Core procedures:
  - `get_amount()` (code/game/objects/items/stacks/stack.dm:132–136) — returns amount (physical) or energy/cost (cyborg). Used in examine, recipe menu (max_multiplier = round(get_amount() / R.req_amount)), and building_checks.
  - `use(used, transfer=FALSE, check=TRUE)` (code/game/objects/items/stacks/stack.dm:325–342) — subtracts used from amount; if check=TRUE and amount drops to 0, qdel(src); updates custom_materials if mats_per_unit set; returns FALSE if not enough. Called after each craft, and by change_stack.
  - `add(amount)` (code/game/objects/items/stacks/stack.dm:366–377) — adds to amount (or cyborg energy); updates custom_materials; no overflow.
  - `merge(obj/item/stack/S)` (code/game/objects/items/stacks/stack.dm:379–392) — merges src into S as much as possible (capped by S.max_amount or cyborg storage); uses transfer = min(src.get_amount(), S.max_amount - S.amount); calls S.copy_evidences; src.use(transfer, TRUE); S.add(transfer); triggers on Crossed() and hitby().
  - `change_stack(mob/user, amount)` (code/game/objects/items/stacks/stack.dm:435–446) — called by AltClick; creates new stack of same type with amount; uses original if possible; removes amount from src.
  - `zero_amount()` (code/game/objects/items/stacks/stack.dm:358–364) — returns TRUE and qdel(src) if amount < 1 (or cyborg energy < cost); used in use() and attack_hand.

- Interactions:
  | held item / action | condition | delay (ds) | message(s) verbatim | result |
  | --- | --- | --- | --- | --- |
  | attack_self (default click) | any | 0 | opens UI | calls interact(user) → ui_interact → stack UI menu |
  | AltClick on inactive stack | held in other hand or on ground | 0 | "How many sheets do you wish to take out of this stack?" (input dialog) | calls change_stack; removes amount from src, creates new stack in user's hands |
  | attackby with same merge_type stack | src in inventory | 0 | "Your [S.name] stack now contains [S.get_amount()] [S.singular_name]s." | calls merge(W) |
  | click (attack_hand) on inactive held stack | held in inactive hand | 0 | opens UI | calls change_stack(user, 1) to split off 1; if zero_amount returns TRUE, qdeletes src |
  | Crossed by matching stack | src and AM both type merge_type | 0 | none | calls merge(AM) |
  | hitby matching stack | thrown AM is merge_type | 0 | none | calls merge(AM) |

- Recipe menu (code/game/objects/items/stacks/stack.dm:144–197):
  - Opened by interact() or attack_self.
  - Shows "Amount Left: [get_amount()]" at top.
  - Lists each recipe. If recipe.res_amount > 1, title is "[res_amount]x [title]s", else "[title]"; appends "([req_amount] [singular_name]s)".
  - Only clickable if max_multiplier = round(get_amount() / req_amount) > 0.
  - If res_amount > 1 and max_multiplier > 1, shows buttons for multipliers 5, 10, 25, and max.
  - Recipe lists (datum/stack_recipe_list) can nest; clicking opens sublist.

- Building process (code/game/objects/items/stacks/stack.dm:200–276):
  - href click triggers Topic(href, href_list) with make=[i] (recipe index) and multiplier=[n].
  - building_checks(R, multiplier) (code/game/objects/items/stacks/stack.dm:278–323) validates:
    - Enough amount (get_amount() >= R.req_amount * multiplier).
    - window_checks: if R.window_checks, calls valid_window_location(turf, dir); rejects if FALSE.
    - one_per_turf: if R.one_per_turf, rejects if locate(R.result_type) in T already.
    - on_floor: if R.on_floor, rejects if not isfloorturf(T); also rejects if dense objects (except grille, table, fulltile window) in T.
    - placement_checks (STACK_CHECK_CARDINALS or STACK_CHECK_ADJACENT): rejects if another result_type nearby.
  - If R.time, calls do_after(usr, adjusted_time, target=usr); time is R.time * R.trait_modifier if usr has R.trait_booster trait, else R.time.
  - After do_after, re-checks building_checks; if FALSE, aborts.
  - Creates object:
    - If R.max_res_amount > 1, new R.result_type(usr.drop_location(), R.res_amount * multiplier) — creates a stack.
    - If result_type is turf path, calls T.PlaceOnTop(R.result_type, flags=CHANGETURF_INHERIT_AIR).
    - Otherwise, new R.result_type(usr.drop_location()).
  - Sets O.dir = usr.dir.
  - Calls use(R.req_amount * multiplier).
  - If R.applies_mats and custom_materials set, calculates used_materials from mats_per_unit and assigns to O.
  - Special handling for windoor_assembly, window (sets ini_dir), cable (sets color).
  - If not QDELETED(O) and isitem(O), puts O in user's hands; adds fingerprint.
  - If storage item, empties it.
  - Messages: visible_message("[usr] starts building \a [R.title]."), to_chat("[usr] You start building \a [R.title]...") when do_after starts.

- Weight: updates dynamically via update_weight() on use/add. At amount <= 1/3 max, w_class = full_w_class - 2 (min TINY); at <= 2/3, w_class = full_w_class - 1; else full_w_class.

- Icon: if novariants, no update; else at amount <= 1/3, icon_state = initial(icon_state); at <= 2/3, icon_state = "[initial]_2"; else "[initial]_3".

- Examine: shows "[get_amount()] [singular_name]\s in the stack" and "Alt-click to take a custom amount."

---

## `/datum/stack_recipe`  `/datum/stack_recipe`  (code/game/objects/items/stacks/stack.dm:470)

Data container for a single craft rule. Created by the `New()` proc (code/game/objects/items/stacks/stack.dm:485–500).

- All fields (initialized in New):
  - `title` = "ERROR" — display name in menu ("metal rod", "window", etc.)
  - `result_type` — type path to create (can be /obj/item, /obj/structure, or /turf)
  - `req_amount` = 1 — how many units of the stack are consumed
  - `res_amount` = 1 — how many of result_type are created (if stack); shown in menu if > 1
  - `max_res_amount` = 1 — max total creatable in one multiplier batch; used to cap multiplier button (if > 1, max_multiplier = min(max_multiplier, round(max_res_amount / res_amount))). Must equal stack.max_amount for balance.
  - `time` = 0 — delay in deciseconds before craft completes (do_after delay); 0 = instant
  - `one_per_turf` = FALSE — if TRUE, building_checks rejects if another result_type already on turf
  - `on_floor` = FALSE — if TRUE, building_checks requires turf to be floor and blocks dense objects
  - `window_checks` = FALSE — if TRUE, building_checks calls valid_window_location (for windows and doors)
  - `placement_checks` = FALSE — if set to STACK_CHECK_CARDINALS or STACK_CHECK_ADJACENT, building_checks rejects if result_type nearby
  - `applies_mats` = FALSE — if TRUE, custom_materials from used stack apply to created object
  - `trait_booster` = null — trait path; if user has it, time is multiplied by trait_modifier
  - `trait_modifier` = 1 — multiplier for time if trait_booster present

---

## `/datum/stack_recipe_list`  `/datum/stack_recipe_list`  (code/game/objects/items/stacks/stack.dm:504)

Container for a named submenu of recipes. Fields: `title` (menu label), `recipes` (list of datum/stack_recipe or nested datum/stack_recipe_list).

---

## Recipes by stack type

### Metal sheets  `/obj/item/stack/sheet/metal`  (code/game/objects/items/stacks/sheets/sheet_types.dm:96)

- Name: "metal", singular_name: "metal sheet"
- max_amount: 50 (code/game/objects/items/stacks/sheets/sheets.dm:8)
- merge_type: /obj/item/stack/sheet/metal (code/game/objects/items/stacks/sheets/sheet_types.dm:106)
- Subtypes: /five, /ten, /twenty, /fifty (amounts 5, 10, 20, 50); /cyborg (is_cyborg=1, cost=500)
- Recipes (GLOB.metal_recipes, code/game/objects/items/stacks/sheets/sheet_types.dm:17–94):
  - stool: 1 metal → /obj/structure/chair/stool, one_per_turf=TRUE, on_floor=TRUE
  - bar stool: 1 metal → /obj/structure/chair/stool/bar, one_per_turf=TRUE, on_floor=TRUE
  - bed: 2 metal → /obj/structure/bed, one_per_turf=TRUE, on_floor=TRUE
  - [office chairs sublist]: dark (5m), light (5m) — one_per_turf=TRUE, on_floor=TRUE
  - [comfy chairs sublist]: beige (2m), black (2m), brown (2m), lime (2m), teal (2m) — one_per_turf=TRUE, on_floor=TRUE
  - [sofas sublist]: middle (1m), left (1m), right (1m), corner (1m) — one_per_turf=TRUE, on_floor=TRUE
  - rack parts: 1 metal → /obj/item/rack_parts
  - closet: 2 metal → /obj/structure/closet, time=15 (ds), one_per_turf=TRUE, on_floor=TRUE
  - canister frame: 5 metal → /obj/structure/canister_frame/machine/frame_tier_0, time=8, one_per_turf=TRUE, on_floor=TRUE
  - floor tile: 1 metal → /obj/item/stack/tile/plasteel, 4 res_amount, max_res_amount=20
  - metal rod: 1 metal → /obj/item/stack/rods, 2 res_amount, max_res_amount=60
  - wall girders: 2 metal → /obj/structure/girder, time=40, one_per_turf=TRUE, on_floor=TRUE, trait_booster=TRAIT_QUICK_BUILD, trait_modifier=0.75
  - computer frame: 5 metal → /obj/structure/frame/computer, time=25, one_per_turf=TRUE, on_floor=TRUE
  - modular console: 10 metal → /obj/machinery/modular_computer/console/buildable/, time=25, one_per_turf=TRUE, on_floor=TRUE
  - machine frame: 5 metal → /obj/structure/frame/machine, time=25, one_per_turf=TRUE, on_floor=TRUE
  - [airlock assemblies sublist]: standard (4m, time=50), public (4m, time=50), command (4m, time=50), security (4m, time=50), engineering (4m, time=50), mining (4m, time=50), atmospherics (4m, time=50), research (4m, time=50), freezer (4m, time=50), science (4m, time=50), medical (4m, time=50), virology (4m, time=50), maintenance (4m, time=50), external (4m, time=50), external maintenance (4m, time=50), airtight hatch (4m, time=50), maintenance hatch (4m, time=50) — all one_per_turf=1, on_floor=1
  - firelock frame: 3 metal → /obj/structure/firelock_frame, time=50, one_per_turf=TRUE, on_floor=TRUE
  - turret frame: 5 metal → /obj/machinery/porta_turret_construct, time=25, one_per_turf=TRUE, on_floor=TRUE
  - meatspike frame: 5 metal → /obj/structure/kitchenspike_frame, time=25, one_per_turf=TRUE, on_floor=TRUE
  - reflector frame: 5 metal → /obj/structure/reflector, time=25, one_per_turf=TRUE, on_floor=TRUE
  - grenade casing: 1 metal → /obj/item/grenade/chem_grenade
  - light fixture frame: 2 metal → /obj/item/wallframe/light_fixture
  - small light fixture frame: 1 metal → /obj/item/wallframe/light_fixture/small
  - apc frame: 2 metal → /obj/item/wallframe/apc
  - air alarm frame: 2 metal → /obj/item/wallframe/airalarm
  - fire alarm frame: 2 metal → /obj/item/wallframe/firealarm
  - extinguisher cabinet frame: 2 metal → /obj/item/wallframe/extinguisher_cabinet
  - button frame: 1 metal → /obj/item/wallframe/button
  - iron door: 20 metal → /obj/structure/mineral_door/iron, one_per_turf=TRUE, on_floor=TRUE
  - floodlight frame: 5 metal → /obj/structure/floodlight_frame, one_per_turf=TRUE, on_floor=TRUE
  - voting box: 15 metal → /obj/structure/votebox, time=50
  - pestle: 1 metal → /obj/item/pestle, time=50
  - hygienebot assembly: 2 metal → /obj/item/bot_assembly/hygienebot, time=50

### Glass sheets  `/obj/item/stack/sheet/glass`  (code/game/objects/items/stacks/sheets/glass.dm:16)

- Name: "glass", singular_name: "glass sheet"
- max_amount: 50 (code/game/objects/items/stacks/sheets/sheets.dm:8)
- merge_type: /obj/item/stack/sheet/glass (code/game/objects/items/stacks/sheets/glass.dm:25)
- Subtypes: /fifty (amount=50); /cyborg (is_cyborg=1, cost=500)
- Recipes (GLOB.glass_recipes, code/game/objects/items/stacks/sheets/glass.dm:11–14):
  - directional window: 1 glass → /obj/structure/window/unanchored, time=0, on_floor=TRUE, window_checks=TRUE
  - fulltile window: 2 glass → /obj/structure/window/fulltile/unanchored, time=0, on_floor=TRUE, window_checks=TRUE
- attackby special (code/game/objects/items/stacks/sheets/glass.dm:47–73): clicking with cable_coil (5 cable + 1 glass → light_w) or rods (1 rod + 1 glass → reinforced glass /obj/item/stack/sheet/rglass)

### Reinforced glass sheets  `/obj/item/stack/sheet/rglass`  (code/game/objects/items/stacks/sheets/glass.dm:134)

- Name: "reinforced glass", singular_name: "reinforced glass sheet"
- max_amount: 50 (default)
- merge_type: /obj/item/stack/sheet/rglass (code/game/objects/items/stacks/sheets/glass.dm:143)
- Recipes (GLOB.reinforced_glass_recipes, code/game/objects/items/stacks/sheets/glass.dm:126–131):
  - windoor frame: 5 rglass → /obj/structure/windoor_assembly, time=0, on_floor=TRUE, window_checks=TRUE
  - directional reinforced window: 1 rglass → /obj/structure/window/reinforced/unanchored, time=0, on_floor=TRUE, window_checks=TRUE
  - fulltile reinforced window: 2 rglass → /obj/structure/window/reinforced/fulltile/unanchored, time=0, on_floor=TRUE, window_checks=TRUE

### Plasteel sheets  `/obj/item/stack/sheet/plasteel`  (code/game/objects/items/stacks/sheets/sheet_types.dm:154)

- Name: "plasteel", singular_name: "plasteel sheet"
- max_amount: 50 (code/game/objects/items/stacks/sheets/sheets.dm:8)
- merge_type: /obj/item/stack/sheet/plasteel (code/game/objects/items/stacks/sheets/sheet_types.dm:165)
- Subtypes: /twenty (amount=20), /fifty (amount=50)
- Recipes (GLOB.plasteel_recipes, code/game/objects/items/stacks/sheets/sheet_types.dm:144–152):
  - AI core: 4 plasteel → /obj/structure/ai_core, time=50, one_per_turf=TRUE
  - bomb assembly: 10 plasteel → /obj/machinery/syndicatebomb/empty, time=50
  - [airlock assemblies sublist]: high security (4p, time=50, one_per_turf=1, on_floor=1), vault door (6p, time=50, one_per_turf=1, on_floor=1)

### Rods  `/obj/item/stack/rods`  (code/game/objects/items/stacks/rods.dm:9)

- Name: "metal rod", singular_name: "metal rod"
- max_amount: 50 (code/game/objects/items/stacks/rods.dm:22)
- merge_type: default (code/game/objects/items/stacks/rods.dm — not set, defaults to type)
- Subtypes: /ten (amount=10), /twentyfive (amount=25), /fifty (amount=50); /cyborg (is_cyborg=1, cost=250); /lava (heat-resistant, max=30)
- Recipes (GLOB.rod_recipes, code/game/objects/items/stacks/rods.dm:1–7):
  - grille: 2 rods → /obj/structure/grille, time=10, one_per_turf=TRUE, on_floor=FALSE
  - table frame: 2 rods → /obj/structure/table_frame, time=10, one_per_turf=1, on_floor=1
  - scooter frame: 10 rods → /obj/item/scooter_frame, time=25
  - linen bin: 2 rods → /obj/structure/bedsheetbin/empty, time=5
  - railing: 3 rods → /obj/structure/railing, time=18, window_checks=TRUE
- attackby special (code/game/objects/items/stacks/rods.dm:47–75): clicking with welder (2 rods → 1 metal) or snacks to make kebab

### Cardboard sheets  `/obj/item/stack/sheet/cardboard`  (code/game/objects/items/stacks/sheets/sheet_types.dm:441)

- Name: "cardboard", singular_name: "cardboard sheet"
- max_amount: 50 (code/game/objects/items/stacks/sheets/sheets.dm:8)
- merge_type: /obj/item/stack/sheet/cardboard (code/game/objects/items/stacks/sheets/sheet_types.dm:451)
- Subtypes: /fifty (amount=50)
- Recipes (GLOB.cardboard_recipes, code/game/objects/items/stacks/sheets/sheet_types.dm:386–439):
  - box: 1 cardboard → /obj/item/storage/box
  - cardborg suit: 3 cardboard → /obj/item/clothing/suit/cardborg
  - cardborg helmet: 1 cardboard → /obj/item/clothing/head/cardborg
  - large box: 4 cardboard → /obj/structure/closet/cardboard, one_per_turf=TRUE, on_floor=TRUE
  - cardboard cutout: 5 cardboard → /obj/item/cardboard_cutout
  - pizza box: 1 cardboard → /obj/item/pizzabox
  - folder: 1 cardboard → /obj/item/folder
  - [fancy boxes sublist, code/game/objects/items/stacks/sheets/sheet_types.dm:398–436]: donut box (1c), egg box (1c), donk-pockets variants (1c each: base, spicy, teriyaki, pizza, berry, honk), monkey cube box (1c), nugget box (1c), lethal ammo box (1c), rubber shot box (1c), bean bag box (1c), flashbang box (1c), flashes box (1c), handcuffs box (1c), ID card box (1c), PDA box (1c), pillbottle box (1c), beaker box (1c), syringe box (1c), latex gloves box (1c), sterile masks box (1c), body bag box (1c), prescription glasses box (1c), disk box (1c), light tubes box (1c), light bulbs box (1c), mixed lights box (1c), mouse traps box (1c), candle box (1c)
- attackby special (code/game/objects/items/stacks/sheets/sheet_types.dm:463–478): clicking with clown stamp creates clown box; with chameleon stamp creates syndie kit

### Wood planks  `/obj/item/stack/sheet/mineral/wood`  (code/game/objects/items/stacks/sheets/sheet_types.dm:224)

- Name: "wooden plank", singular_name: "wood plank"
- max_amount: 50 (default)
- merge_type: /obj/item/stack/sheet/mineral/wood (code/game/objects/items/stacks/sheets/sheet_types.dm:235)
- Subtypes: /fifty (amount=50)
- Recipes (GLOB.wood_recipes, code/game/objects/items/stacks/sheets/sheet_types.dm:184–222):
  - wooden sandals: 1 wood → /obj/item/clothing/shoes/sandal
  - wood floor tile: 1 wood → /obj/item/stack/tile/wood, 4 res_amount, max_res_amount=20
  - wood table frame: 2 wood → /obj/structure/table_frame/wood, time=10
  - rifle stock: 10 wood → /obj/item/weaponcrafting/stock, time=40
  - rolling pin: 2 wood → /obj/item/kitchen/rollingpin, time=30
  - wooden chair: 3 wood → /obj/structure/chair/wood/, time=10, one_per_turf=TRUE, on_floor=TRUE
  - winged wooden chair: 3 wood → /obj/structure/chair/wood/wings, time=10, one_per_turf=TRUE, on_floor=TRUE
  - wooden barricade: 5 wood → /obj/structure/barricade/wooden, time=50, one_per_turf=TRUE, on_floor=TRUE
  - wooden door: 10 wood → /obj/structure/mineral_door/wood, time=20, one_per_turf=TRUE, on_floor=TRUE
  - coffin: 5 wood → /obj/structure/closet/crate/coffin, time=15, one_per_turf=TRUE, on_floor=TRUE
  - book case: 4 wood → /obj/structure/bookcase, time=15, one_per_turf=TRUE, on_floor=TRUE
  - drying rack: 10 wood → /obj/machinery/smartfridge/drying_rack, time=15, one_per_turf=TRUE, on_floor=TRUE
  - wooden barrel: 8 wood → /obj/structure/fermenting_barrel, time=50, one_per_turf=TRUE, on_floor=TRUE
  - dog bed: 10 wood → /obj/structure/bed/dogbed, time=10, one_per_turf=TRUE, on_floor=TRUE
  - dresser: 10 wood → /obj/structure/dresser, time=15, one_per_turf=TRUE, on_floor=TRUE
  - picture frame: 1 wood → /obj/item/wallframe/picture, time=10
  - painting frame: 1 wood → /obj/item/wallframe/painting, time=10
  - display case chassis: 5 wood → /obj/structure/displaycase_chassis, one_per_turf=TRUE, on_floor=TRUE
  - wooden buckler: 20 wood → /obj/item/shield/riot/buckler, time=40
  - apiary: 40 wood → /obj/structure/beebox, time=50
  - tiki mask: 2 wood → /obj/item/clothing/mask/gas/tiki_mask
  - honey frame: 5 wood → /obj/item/honey_frame, time=10
  - wooden bucket: 3 wood → /obj/item/reagent_containers/glass/bucket/wooden, time=10
  - rake: 5 wood → /obj/item/cultivator/rake, time=10
  - ore box: 4 wood → /obj/structure/ore_box, time=50, one_per_turf=TRUE, on_floor=TRUE
  - wooden crate: 6 wood → /obj/structure/closet/crate/wooden, time=50, one_per_turf=TRUE, on_floor=TRUE
  - baseball bat: 5 wood → /obj/item/melee/baseball_bat, time=15
  - loom: 10 wood → /obj/structure/loom, time=15, one_per_turf=TRUE, on_floor=TRUE
  - mortar: 3 wood → /obj/item/reagent_containers/glass/mortar
  - firebrand: 2 wood → /obj/item/match/firebrand, time=100
  - [pews sublist]: middle (3w, one_per_turf=TRUE, on_floor=TRUE), left (3w, one_per_turf=TRUE, on_floor=TRUE), right (3w, one_per_turf=TRUE, on_floor=TRUE)

### Cloth sheets  `/obj/item/stack/sheet/cloth`  (code/game/objects/items/stacks/sheets/sheet_types.dm:312)

- Name: "cloth", singular_name: "cloth roll"
- max_amount: 50 (default)
- merge_type: /obj/item/stack/sheet/cloth (code/game/objects/items/stacks/sheets/sheet_types.dm:321)
- Subtypes: /ten (amount=10), /five (amount=5)
- Recipes (GLOB.cloth_recipes, code/game/objects/items/stacks/sheets/sheet_types.dm:279–310):
  - white jumpskirt: 3 cloth → /obj/item/clothing/under/color/jumpskirt/white
  - white jumpsuit: 3 cloth → /obj/item/clothing/under/color/white
  - white shoes: 2 cloth → /obj/item/clothing/shoes/sneakers/white
  - white scarf: 1 cloth → /obj/item/clothing/neck/scarf
  - backpack: 4 cloth → /obj/item/storage/backpack
  - duffel bag: 6 cloth → /obj/item/storage/backpack/duffelbag
  - plant bag: 4 cloth → /obj/item/storage/bag/plants
  - book bag: 4 cloth → /obj/item/storage/bag/books
  - mining satchel: 4 cloth → /obj/item/storage/bag/ore
  - chemistry bag: 4 cloth → /obj/item/storage/bag/chemistry
  - bio bag: 4 cloth → /obj/item/storage/bag/bio
  - construction bag: 4 cloth → /obj/item/storage/bag/construction
  - improvised gauze: 1 cloth → /obj/item/stack/medical/gauze/improvised, 2 res_amount, max_res_amount=6
  - rag: 1 cloth → /obj/item/reagent_containers/glass/rag
  - bedsheet: 3 cloth → /obj/item/bedsheet
  - empty sandbag: 4 cloth → /obj/item/emptysandbag
  - fingerless gloves: 1 cloth → /obj/item/clothing/gloves/fingerless
  - white gloves: 3 cloth → /obj/item/clothing/gloves/color/white
  - white softcap: 2 cloth → /obj/item/clothing/head/soft/mime
  - white beanie: 2 cloth → /obj/item/clothing/head/beanie
  - blindfold: 2 cloth → /obj/item/clothing/glasses/blindfold
  - 19x19 canvas: 3 cloth → /obj/item/canvas/nineteen_nineteen
  - 23x19 canvas: 4 cloth → /obj/item/canvas/twentythree_nineteen
  - 23x23 canvas: 5 cloth → /obj/item/canvas/twentythree_twentythree

### Floor tiles (Plasteel)  `/obj/item/stack/tile/plasteel`  (code/game/objects/items/stacks/tiles/tile_types.dm:328)

- Name: "floor tile", singular_name: "floor tile"
- max_amount: 60 (code/game/objects/items/stacks/tiles/tile_types.dm:13)
- merge_type: default
- Subtypes: /cyborg (is_cyborg=1, cost=125)
- No direct recipes in Tg source (tiles are crafted from sheets). When placed via PlaceOnTop, applies turf_type = /turf/open/floor/plasteel.
- attackby special (code/game/objects/items/stacks/tiles/tile_types.dm:43–87): welder (4 tiles → metal sheet or mineral sheet based on mineralType)

### Cable coil  `/obj/item/stack/cable_coil`  (code/modules/power/cable.dm:384)

- Name: "cable coil" (or "cable [piece/coil]" based on amount)
- singular_name: "cable piece"
- max_amount: MAXCOIL (defined elsewhere, typically 30)
- merge_type: /obj/item/stack/cable_coil (code/modules/power/cable.dm:396)
- Subtypes: /five (amount=5); /cut (amount=null, randomized 1–2); /cyborg (is_cyborg=1, cost=1)
- Recipes (GLOB.cable_coil_recipes, code/modules/power/cable.dm:382):
  - cable restraints: 15 cable → /obj/item/restraints/handcuffs/cable
  - multilayer cable: 1 cable → /obj/structure/cable/multilayer
  - multiZ cable: 1 cable → /obj/structure/cable/multilayer/multiz
- Placing via interact: CtrlClick (code/modules/power/cable.dm:453–501) opens radial menu to select layer (1/red, 2/yellow, 3/blue) or multilayer hub. Click on turf calls place_turf (code/modules/power/cable.dm:538–576): lays cable at distance ≤ 1; rejects if intact turf, no_cabling, or cable already on target_layer; creates /obj/structure/cable at target_layer; attempts merge with adjacent powernetworks; uses 1 cable; on shock fail (50%), drops 1 cable and deconstructs cable.
- attack special (code/modules/power/cable.dm:508–522): on robot limb with status==BODYPART_ROBOTIC, repairs 15 damage over 50 (ds); uses 1 cable.

---

## Minimum viable port

1. **Stack data structure**: amount, max_amount, merge_type; merge on Crossed/hitby/attackby with same type.
2. **Split interaction**: AltClick prompts for count; creates new stack; removes from source via use().
3. **Recipe system**: list of datum/stack_recipe; each with title, result_type, req/res/max_res amounts, time.
4. **Recipe menu**: attack_self opens UI; shows recipes; click creates result_type via do_after if R.time > 0.
5. **Building checks**: validates amount, window_checks, one_per_turf, on_floor, placement_checks.
6. **Material carryover**: if applies_mats, pass custom_materials from stack to result.
7. **Metal recipes**: floor tile (1→4), metal rod (1→2 rods), chairs, closets, airlock frames, girders, wall frames.
8. **Glass recipes**: directional and fulltile windows (1–2 glass each).
9. **Reinforced glass recipes**: windoor frame (5 rglass), reinforced windows (1–2 rglass each).
10. **Cable system**: layer selection via radial; place_turf places cables; restraints and multilayer recipes.

## NOT FOUND / open questions

- Behavior of TRAIT_QUICK_BUILD and trait_modifier when user lacks trait (assumed no effect; time used as-is).
- Exact threshold for valid_window_location (referenced, not defined in stack.dm).
- How custom_materials are computed for cyborg stacks (uses `source.energy / cost`, no material list).
- Whether cloth can actually be bandages (code references splint_factor, absorption_capacity, absorption_rate on stack, but no recipes set these).
