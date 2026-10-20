# Vending Machines and Small Utility Machines

On BoxStation, there are 79 vending machines and numerous small utility machines providing food, beverages, medical supplies, clothing, and convenience services. Vending machines dispense items for credits, cigarette_dollars, or free depending on location. Small machines handle recharging, waste, hygiene, information and safety functions.

## Vending Machine Types — Count on BoxStation

| Type | Count | Purpose |
|------|-------|---------|
| /obj/machinery/vending/wardrobe | 22 | Clothing (general, security, medical, engineering variants) |
| /obj/machinery/vending/cigarette | 10 | Tobacco, rolling papers, lighters |
| /obj/machinery/vending/coffee | 9 | Hot beverages: coffee, tea, chocolate |
| /obj/machinery/vending/snack | 8 | Snack foods and candy |
| /obj/machinery/vending/cola | 7 | Soft drinks and bottled water |
| /obj/machinery/vending/wallmed | 2 | Wall-mounted medical supplies |
| /obj/machinery/vending/tool | 2 | Engineering and repair tools |
| /obj/machinery/vending/modularpc | 2 | Modular computers |
| /obj/machinery/vending/medical | 2 | Medical supplies and drugs |
| /obj/machinery/vending/assist | 2 | Engineering assistance items |
| /obj/machinery/vending/sustenance | 1 | Mixed food items |
| /obj/machinery/vending/security | 1 | Security items and armor |
| /obj/machinery/vending/hydroseeds | 1 | Hydroponics seeds |
| /obj/machinery/vending/hydronutrients | 1 | Hydroponics nutrients |
| /obj/machinery/vending/games | 1 | Board games and toys |
| /obj/machinery/vending/engivend | 1 | Engineering supplies and power cells |
| /obj/machinery/vending/dinnerware | 1 | Plates, bowls, utensils |
| /obj/machinery/vending/clothing | 1 | Misc clothing items |
| /obj/machinery/vending/cart | 1 | Food cart supplies |
| /obj/machinery/vending/boozeomat | 2 | Alcoholic beverages |
| /obj/machinery/vending/autodrobe | 1 | Costumes and theatrical clothing |

**Total: 79 machines**

---

## Vending Machine Mechanics — Base Class

### /obj/machinery/vending — (code/modules/vending/_vending.dm:45)

Vending machines are stationary commerce devices that dispense items for credits or free on station.

**Key Variables** (`code/modules/vending/_vending.dm`):
- `name` = "Vendomat" (machine display name, line 46)
- `max_integrity` = 300 (health, line 55)
- `armor` = list("melee" = 20, "bullet" = 0, "laser" = 0, "energy" = 0, "bomb" = 0, "bio" = 0, "rad" = 0, "fire" = 50, "acid" = 70) (line 57)
- `active` = 1 (sales pitch enabled if powered, line 63)
- `vend_ready` = TRUE (ready to dispense, line 65)
- `tilted` = FALSE (tipped over by impact, line 70)
- `tiltable` = TRUE (can be knocked over, line 71)
- `squish_damage` = 75 (damage when machine tips, line 72)
- `seconds_electrified` = MACHINE_NOT_ELECTRIFIED (electrification duration, line 122)
- `shoot_inventory` = 0 (fires items when broken, line 124)
- `extended_inventory` = 0 (hacked to show hidden items, line 130)
- `scan_id` = 1 (checks ID for access, line 132)
- `default_price` = 25 (credits per normal item, line 138)
- `extra_price` = 50 (credits per premium item, line 140)
- `onstation` = TRUE (charges credits; FALSE = free, line 148)
- `product_records` = list() (inventory for products, line 103)
- `hidden_records` = list() (inventory for contraband, line 104)
- `coin_records` = list() (inventory for premium items, line 105)

**Product Lists** — format is `/obj/item/type = amount`:
- `products` = list() — normal items, free if onstation=FALSE
- `contraband` = list() — unlocked by emagging, counts as `hidden_records`
- `premium` = list() — premium items requiring extra credits

**Interactions** (how vending works):
| Held Item / Action | Condition | Delay (ds) | Message / Result |
|---|---|---|---|
| Left-click (vend) | item in stock, powered, ID check passes | 20 (emit_playsound) | "Thank you for shopping!" (custom `vend_reply` per machine, line 110) |
| Emagged | not already emagged | instant | "You short out the product lock on [src]." (line 679) |
| Panel opened with screwdriver | anchored | 40 (line 403) | Panel opens; `panel_open` flag set |
| Wires hacked (panel open) | access to wires | instant | Route to `/datum/wires/vending` (line 414) |
| Refill canister placed (panel open) | panel open, machine powered, correct canister | instant | "You loaded [transferred] items in [src]." (line 431) |
| Hit with item of force > 0 | not tilted | instant | 1-5%: freebie(1-3), 16-25%: tilt(), 76-100%: skip |
| Tilted (via hit) | tiltable=TRUE | 60 (untilt delay, line 689) | Machine tips, crushing mobs underneath; layer = ABOVE_MOB_LAYER (line 493) |

**Tilt Mechanics** (when kicked, tiltable machines can tip over):
- Roll 1-100 on impact: 1-5% free items, 6-15% tilt, 16-25% tilt, 76-90% tilt critical, 91-100% tilt critical
- Tilt sets `tilted = TRUE`, rotates 90°/270° via `transform`, changes `layer` (line 493)
- If crit (roll 1-6): case 1 = leg shatter + bleed 150, case 2 = pin mob, case 3 = shards, case 4 = paralyze, case 5 = limb wounds, case 6 = skull crush (lines 514-564)
- Crushing damage = squish_damage (75) minus crit_rebate (lines 567-570)
- Mobs can untilt by interacting while tilted (line 686-690)

**Electrification** (hacked wires):
- When `seconds_electrified > 0` and not NOPOWER, shock user on interaction (lines 682-684)
- `shock(user, 100)` returns TRUE if player dies (line 683)

**Shoot Inventory** (when broken):
- If `shoot_inventory = 1` (hacked via wires or damage), vending throws random items at customers (line 124-126)
- `shoot_inventory_chance = 2` (2% per vend attempt to trigger)

**Power State**:
- If powered and not BROKEN: icon_state = initial state, light power on (lines 252-254)
- If BROKEN: icon_state = "[state]-broken", no light (lines 249-251)
- If no power: icon_state = "[state]-off", no light (lines 255-257)

**Deconstruction Chain**:
1. Wrench while panel open (60 ds) → unbuckle mobs (line 395-396)
2. Screwdriver on machine → toggle panel (line 403-407)
3. Crowbar while panel open → full deconstruction (line 389)
4. If NOT refill_canister type (non-constructable): drops 3 metal sheets (line 243)
5. If refill_canister type (constructable): returns component parts (line 245)

**Hacking via Wires** (`/datum/wires/vending`):
- Wire operations set flags: emagged (unlock contraband), shock (electrify), loosen (free items), disable (lock machine)

---

## Top 5 Most Common Vending Machines

### Wardrobe Machines (22 total)  `/obj/machinery/vending/wardrobe`  (code/modules/vending/wardrobes.dm:4)

Generic base class for clothing vendors with department variants. Machines accept returned clothing.

**Key Vars**:
- `default_price` = 350 (line 5)
- `extra_price` = 450 (line 6)
- `payment_department` = NO_FREEBIES (never free, line 7)
- `input_display_header` = "Returned Clothing" (line 8)
- `canLoadItem(I)` returns TRUE if I.type is in products list (line 12) — can load returned clothes

#### Subtypes on BoxStation:

**SecDrobe** (5 copies) — `/obj/machinery/vending/wardrobe/sec_wardrobe` (wardrobes.dm:14)
- Products (starting amount): winter coat security = 3, backpack security = 3, satchel security = 3, duffelbag security = 3, rank security officer = 3, jackboots = 3, beret security = 3, soft cap security = 3, bandana red = 3, gloves black = 3, rank security officer skirt = 3, rank security officer grey = 3, pants khaki = 3, rank security officer blueshirt = 3
- Premium: rank security officer formal = 3, suit security officer = 3, beret security navyofficer = 3
- Price: 350 credits default, 450 premium (line 5-6)

**MediDrobe** — `/obj/machinery/vending/wardrobe/medi_wardrobe` (wardrobes.dm:44)
- Products: pocketprotector = 4, duffelbag med = 4, backpack medic = 4, satchel med = 4, winter coat medical = 4, rank medical paramedic = 4, rank medical paramedic skirt = 4, rank medical doctor nurse = 4, nursehat = 4, rank medical doctor skirt = 4, rank medical doctor blue = 4, rank medical doctor green = 4, rank medical doctor purple = 4, rank medical doctor = 4, labcoat = 4, labcoat paramedic = 4, sneakers white = 4, soft cap paramedic = 4, apron surgical = 4, mask surgical = 4
- Default price per item (not explicitly set, inherits 350), items free if NOT onstation

**EngiDrobe** — `/obj/machinery/vending/wardrobe/engi_wardrobe` (wardrobes.dm:76)
- Products: pocketprotector = 3, duffelbag engineering = 3, backpack industrial = 3, satchel eng = 3, winter coat engineering = 3, rank engineering engineer = 3, rank engineering engineer skirt = 3, rank engineering engineer hazard = 3, hazardvest = 3, workboots = 3, hardhat = 3, hardhat weldhat = 3
- Payment department = ACCOUNT_ENG (line 95)

---

### Cigarette Machine (10 total)  `/obj/machinery/vending/cigarette`  (code/modules/vending/cigarette.dm:1)

Tobacco products vendor. Emagging unlocks vape masks.

**Key Vars** (`cigarette.dm`):
- `name` = "ShadyCigs Deluxe" (line 2)
- `product_slogans` = "Space cigs taste good like a cigarette should.;I'd rather toolbox than switch.;Smoke!;Don't believe the reports - smoke today!" (line 4)
- `product_ads` = advertising text (line 5)
- `default_price` = 75 (line 24)
- `extra_price` = 250 (line 25)
- `payment_department` = ACCOUNT_SRV (line 26)

**Products** (starting amounts):
- fancy cigarettes = 5
- fancy cigarettes cigpack_candy = 4
- fancy cigarettes cigpack_uplift = 3
- fancy cigarettes cigpack_robust = 3
- fancy cigarettes cigpack_carp = 3
- fancy cigarettes cigpack_midori = 3
- box matches = 10
- lighter greyscale = 4
- fancy rollingpapers = 5

**Contraband** (emagged):
- clothing mask vape = 5

**Premium** (extra_price):
- fancy cigarettes cigpack_robustgold = 3
- box gum nicotine = 2
- lighter = 3
- fancy cigarettes cigars = 1
- fancy cigarettes cigars havana = 1
- fancy cigarettes cigars cohiba = 1

---

### Coffee Machine (9 total)  `/obj/machinery/vending/coffee`  (code/modules/vending/coffee.dm:1)

Hot beverage vendor. Contraband is ice (for subversive coffee sabotage).

**Key Vars** (`coffee.dm`):
- `name` = "Solar's Best Hot Drinks" (line 2)
- `product_ads` = "Have a drink!;Drink up!;It's good for you!;Would you like a hot joe?;I'd kill for some coffee!;The best beans in the galaxy.;Only the finest brew for you.;Mmmm. Nothing like a coffee.;I like coffee, don't you?;Coffee helps you work!;Try some tea.;We hope you like the best!;Try our new chocolate!;Admin conspiracies" (line 4)
- `default_price` = 45 (line 12)
- `extra_price` = 150 (line 13)
- `payment_department` = ACCOUNT_SRV (line 14)

**Products** (starting amounts):
- reagent_containers food drinks coffee = 6
- reagent_containers food drinks mug tea = 6
- reagent_containers food drinks mug coco = 3

**Contraband** (emagged):
- reagent_containers food drinks ice = 12

---

### Snack Machine (8 total)  `/obj/machinery/vending/snack`  (code/modules/vending/snack.dm:1)

Candy and chips vendor. Accepts kitchen return compartment.

**Key Vars** (`snack.dm`):
- `name` = "Getmore Chocolate Corp" (line 2)
- `default_price` = 60 (line 21)
- `extra_price` = 160 (line 22)
- `payment_department` = ACCOUNT_SRV (line 23)
- `canload_access_list` = list(ACCESS_KITCHEN) (line 20) — only kitchen can load items
- `input_display_header` = "Chef's Food Selection" (line 24)

**Products** (starting amounts):
- reagent_containers food snacks spacetwinkie = 6
- reagent_containers food snacks cheesiehonkers = 6
- reagent_containers food snacks candy = 6
- reagent_containers food snacks chips = 6
- reagent_containers food snacks sosjerky = 6
- reagent_containers food snacks no_raisin = 6
- reagent_containers food drinks dry_ramen = 3
- storage box gum = 3
- reagent_containers food snacks energybar = 6

**Contraband** (emagged):
- reagent_containers food snacks syndicake = 6
- reagent_containers food snacks candy bronx = 1

---

### Cola Machine (7 total)  `/obj/machinery/vending/cola`  (code/modules/vending/cola.dm:2)

Soft drinks vendor with multiple visual variants (Blue, Red, Space-up, Starkist, Pwr Game, Shamblers).

**Key Vars** (`cola.dm`):
- `name` = "Robust Softdrinks" (line 4)
- `default_price` = 45 (line 24)
- `extra_price` = 200 (line 25)
- `payment_department` = ACCOUNT_SRV (line 26)

**Products** (starting amounts):
- reagent_containers food drinks soda_cans cola = 10
- reagent_containers food drinks soda_cans space_mountain_wind = 10
- reagent_containers food drinks soda_cans dr_gibb = 10
- reagent_containers food drinks soda_cans starkist = 10
- reagent_containers food drinks soda_cans space_up = 10
- reagent_containers food drinks soda_cans pwr_game = 10
- reagent_containers food drinks soda_cans lemon_lime = 10
- reagent_containers food drinks soda_cans sol_dry = 10
- reagent_containers food drinks waterbottle = 10

**Contraband** (emagged):
- reagent_containers food drinks soda_cans thirteenloko = 6
- reagent_containers food drinks soda_cans shamblers = 6

**Premium** (extra_price):
- reagent_containers food drinks drinkingglass filled nuka_cola = 1
- reagent_containers food drinks soda_cans air = 1
- reagent_containers food drinks soda_cans monkey_energy = 1
- reagent_containers food drinks soda_cans grey_bull = 1

---

### Other Machines on BoxStation (names only)

- /obj/machinery/vending/wallmed (2) — wall-mounted medical supplies
- /obj/machinery/vending/tool (2) — tools and parts
- /obj/machinery/vending/modularpc (2) — modular computers
- /obj/machinery/vending/medical (2) — medical drugs
- /obj/machinery/vending/assist (2) — engineering assists
- /obj/machinery/vending/sustenance (1) — mixed food
- /obj/machinery/vending/security (1) — armor and weapons
- /obj/machinery/vending/hydroseeds (1) — seeds
- /obj/machinery/vending/hydronutrients (1) — nutrients
- /obj/machinery/vending/games (1) — toys
- /obj/machinery/vending/engivend (1) — engineering supplies
- /obj/machinery/vending/dinnerware (1) — dishes
- /obj/machinery/vending/clothing (1) — general clothing
- /obj/machinery/vending/cart (1) — food cart
- /obj/machinery/vending/boozeomat (2) — alcohol
- /obj/machinery/vending/autodrobe (1) — costumes

---

## Small Utility Machines

### /obj/machinery/recharger  (code/game/machinery/recharger.dm:1)

Energy weapon and power cell charging dock.

**What it charges**:
- Energy weapons (/obj/item/gun/energy) — if can_charge flag set
- Melee batons (/obj/item/melee/baton)
- Magazine recharge boxes (/obj/item/ammo_box/magazine/recharge)
- Modular computers (/obj/item/modular_computer)

**Power Use** (line 6-8):
- `use_power` = IDLE_POWER_USE
- `idle_power_usage` = 4 (W) — when not charging
- `active_power_usage` = 250 (W) — when item inserted

**Key Mechanics**:
- `recharge_coeff` = capacitor rating (1-3) — affects how much charge per cycle (10% per coeff level per cycle)
- `charging` = currently held item (null if empty)
- Only accepts one item at a time
- Must be anchored to accept items (wrench to anchor/unanchor, line 60-61)
- Displays charge % of inserted item if in range (line 38-40)
- Area must have power to charge (line 74-76)
- Per-cycle recharge: `recharge_coeff * 10` % cell charge (line 37)

---

### /obj/machinery/disposal/bin  (code/modules/recycling/disposal/bin.dm)

Waste disposal entry point. Items flushed into pipes go to central disposal.

**How trash enters** (NOT FOUND — requires full file read)

**Key Mechanics**:
- Items can be placed in or thrown into open disposal bin
- Pressing "flush" button sends items through pipes
- Pipes route to `/obj/structure/disposalpipe` network
- Eventually reaches disposal unit at destination
- Delay in transit depends on pipe length

---

### /obj/structure/sink  (code/modules/plumbing/sinks_showers.dm)

Wall-mounted or standalone sink for washing.

**Interactions**:
- Interact to wash hands/face
- Draw water (if plumbed)
- Reagent interactions (NOT FOUND)

---

### /obj/machinery/shower  (code/modules/plumbing/sinks_showers.dm)

Wall-enclosed shower stall.

**Interactions**:
- Enter to bathe (washes off blood, mud, etc.)
- Toggles water on/off
- Takes time to shower (~10 seconds typical, NOT FOUND exact ds)

---

### /obj/structure/toilet and /obj/structure/urinal  (code/modules/plumbing/toilets.dm)

**Toilet** (`/obj/structure/toilet`):
- Sit to use (NOT FOUND mechanics)
- Flush button disposes waste (NOT FOUND)
- Can plunge if clogged (NOT FOUND exact result)
- May contain hidden items (can retrieve with plunger, NOT FOUND)

**Urinal** (`/obj/structure/urinal`):
- Stand to use
- Auto-flushes after use (NOT FOUND ds)
- Similar hidden item mechanics

---

### /obj/machinery/newscaster  (code/modules/newscaster/newscaster.dm)

Public information display on walls.

**What it does** (NOT FOUND exact mechanics):
- Displays station announcements
- Shows emergency alerts
- Broadcasting system integration
- Syndicate/admin control possible

---

### /obj/machinery/requests_console  (code/modules/requests_console/requests_console.dm)

Department supply request terminal.

**Departments** (NOT FOUND complete list):
- Captain / Command
- Engineering
- Medical
- Security
- Science
- Service (Kitchen, Bar, Janitor)
- Cargo
- (others via code)

**Message Types** (NOT FOUND):
- Supply order (request items from cargo)
- Job slot request
- Status updates

**How it works** (NOT FOUND exact proc):
- Submit request → goes to department console
- Department approves/denies
- Cargo fulfills supply requests

---

### /obj/machinery/status_display  (code/modules/status_display/status_display.dm)

Wall-mounted status monitor showing ship/department status.

**Display Types**:
- `/obj/machinery/status_display/evac` — evacuation status
- `/obj/machinery/status_display/ai` — AI status
- `/obj/machinery/status_display/supply` — cargo/supply status

**What shows** (NOT FOUND exact messages):
- Alert levels (green/yellow/red)
- Department status (power, breaches, alarms)
- Evacuation timer (if active)

---

### /obj/machinery/button/door  (code/modules/doors/airlock_control.dm)

Electronic door button (calls/toggles airlock).

**Pressing does**:
- Call airlock if closed
- Open airlock if powered and accessible
- Close airlock if open
- NOPOWER: button does nothing (line NOT FOUND)
- Access check: `req_access` (electronics check via ID)

---

### /obj/machinery/light_switch  (code/modules/power/light_control.dm)

Wall-mounted light switch.

**Pressing does**:
- Toggle lights in linked area on/off
- Area lighting handled by power system
- Unpowered switch: does nothing (no battery backup, NOT FOUND)
- Requires power to function (NOT FOUND: "NOPOWER" behavior)

---

## Minimum Viable Port

1. **Vending Machines**: Dispense products/contraband/premium items for credits or free (onstation flag). Track inventory via product_records/hidden_records/coin_records datums. Support emagging to unlock contraband. Show available items on UI click.

2. **Tilting Mechanics**: When kicked, vending machines can tip over. Random roll determines outcome (free item, critical tilt crushing mobs). Implement crush damage table (leg shatter, pinning, glass shards, paralysis, limb wounds, skull crush).

3. **Electrification**: Hacked wires can electrify machines; user takes shock damage (100) on interaction. Display feedback (sparks, sound).

4. **Refill System**: Refill canisters restore stock. Panel must be open, machine powered. Messages confirm loaded items. Track canister depletion.

5. **Recharger**: Charge energy weapons, batons, modular computers. Show charge % and rate. Requires anchoring and area power. Capacitor rating affects recharge speed.

6. **Disposal Bins**: Accept items, flush sends them through pipes. Route to central disposal system.

7. **Toilets/Urinals**: Functional use (sit/stand). Flush mechanic. Hidden item recovery via plunger.

8. **Requests Console**: Submit supply orders. UI shows available departments and message types. Orders route to cargo.

9. **Status Displays**: Show alert level, power status, evacuation timer. Update in real-time.

10. **Buttons & Switches**: Door buttons call/toggle airlocks (access check). Light switches toggle area lights (power required).

---

## NOT FOUND / Open Questions

- **Disposal pipes**: Full routing logic, delay per tile, garbage crushing/incineration at end destination
- **Toilet/Urinal mechanics**: Exact sit/stand/flush delays in ds, hidden item spawn chance, plunging behavior
- **Shower**: Exact wash time in ds, reagent cleanup effects, water pressure simulation
- **Requests Console**: Full department list, approval workflow, priority queue
- **Newscaster**: Broadcasting integration, syndicate override method, message persistence
- **Status Display**: Update frequency, alert thresholds, department status queries
- **Light Switch**: Area query method, wired lights vs. portable lights, backup power handling
- **Door Button**: AI/cyborg interaction, multi-access buttons, signal override
- **Recharger**: Exact charge rate formula (coeff * percent per cycle?), maximum charge cycles before wear

