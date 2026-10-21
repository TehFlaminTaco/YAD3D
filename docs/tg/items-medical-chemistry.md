# Medical & Chemistry Items

TG 2020-07-06. Surgical tools, containers, medipens, defibrillators, first-aid kits, pills, patches, and prosthetics. Medical stacks apply healing to a bodypart zone; medipens inject multiple reagents; defib revives dead patients; first-aid kits populate contents on creation. 57 item paths documented from code/game/objects/items/{stacks/medical,storage/firstaid}, code/modules/{surgery/tools,reagents/reagent_containers,surgery/bodyparts/robot_bodyparts}, code/game/objects/items/{defib,implants}.

## Medical Stacks (`/obj/item/stack/medical`)

Base vars (code/game/objects/items/stacks/medical.dm:15–28):
- `self_delay`, `other_delay`: application time in ds
- `heal_brute`, `heal_burn`: heal amounts per application
- `stop_bleeding`: bleeding reduction (0–1 scale)
- `sanitization`, `flesh_regeneration`: burn wound modifiers
- `amount`, `max_amount`: stack count

| Item | Heal Brute | Heal Burn | Self Delay | Other Delay | Stop Bleeding | Notes |
|------|-----------|----------|-----------|-----------|---------------|-------|
| bruise pack | 40 | 0 | 40 ds | 20 ds | 0 | Fails on dead mobs (line 94) |
| ointment | 0 | 5 | 40 ds | 20 ds | 0 | flesh_regeneration=2.5, sanitization=0.3 (line 240–241) |
| gauze | 0 | 0 | 50 ds | 20 ds | — | Wound-based, not for brute>40 (line 136) |
| suture | 10 | 0 | 30 ds | 10 ds | 0.6 | repeating=TRUE (line 185) |
| mesh | 0 | 10 | 30 ds | 10 ds | 0 | Requires open(); sanitization=0.75, flesh_regen=3 (line 268–269) |

## Surgical Tools (`/obj/item/cautery` et al)

All have `tool_behaviour` and `toolspeed=1` (base). Code/modules/surgery/tools.dm.

| Tool | Desc | Force | w_class | Tool Behaviour |
|------|------|-------|---------|-----------------|
| cautery | "This stops bleeding." | — | TINY | TOOL_CAUTERY |
| circular_saw | "For heavy duty cutting." | 15 | NORMAL | TOOL_SAW; wound_bonus=10, bare_wound_bonus=15 (line 152–153) |
| hemostat | "You think you have seen this before." | — | TINY | TOOL_HEMOSTAT |
| retractor | "Retracts stuff." | — | TINY | TOOL_RETRACTOR |
| scalpel | "Cut, cut, and once more cut." | 10 | TINY | TOOL_SCALPEL; bare_wound_bonus=20, sharpness=IS_SHARP_ACCURATE (line 116) |
| surgical_drapes | Nanotrasen brand. | — | TINY | Initiates surgery on attack (line 178) |

## Medipens & Hypospray (`/obj/item/reagent_containers/hypospray`)

| Item | Contents | Volume | Transfer | Notes |
|------|----------|--------|----------|-------|
| epinephrine medipen | epinephrine 10u, formaldehyde 3u, coagulant 2u | 15 | 15 | One-use; ignore_flags=1 (pierce hardsuits); revivecost NOT in medipen (line 98–111) |
| survival emergency medipen | epinephrine 8u, c2/aiuri 8u, c2/libital 8u, leporazine 6u | 30 | 30 | Variable delay inject (line 216–235) |
| hypospray (CMO) | omnizine 30u | 30 | 5 | Standard hypospray with preset load (line 57–59) |

## Reagent Containers (base: code/modules/reagents/reagent_containers.dm:1–16)

Base vars: `volume`, `amount_per_transfer_from_this`, `possible_transfer_amounts`, `reagent_flags`.

### Syringes (`/obj/item/reagent_containers/syringe`)

| Type | Volume | Transfer | Piercing | Reagents (if any) |
|------|--------|----------|----------|-------------------|
| syringe (base) | 15 | 5 | — | 0 | Mode toggle via attack_self (line 40–42) |
| syringe (antiviral) | 15 | 5 | — | spaceacillin 15u (line 201–204) |
| syringe (lethal/execution) | 50 | 50 | — | plasma 15u, formaldehyde 15u, cyanide 10u, fluacid 10u (line 230–231) |

### Dropper (`/obj/item/reagent_containers/dropper`)

Volume 5u, transfer 5u, possible_transfer_amounts list(1,2,3,4,5). Squirts into eyes on afterattack vs mobs (line 43–54, dropper.dm).

### Beakers & Bottles

| Type | Volume | Transfer Amt | Notes |
|------|--------|--------------|-------|
| beaker | 50 | 10 | Possible amounts: 5,10,15,20,25,30,50 (line 5–6, glass.dm) |
| large beaker | 100 | 10 | Possible: 5,10,15,20,25,30,50,100 (line 141) |
| bottle (generic) | 30 | 5–25 | Possible: 5,10,15,25,30 (line 8, bottle.dm) |
| bottle (epinephrine) | 30 | — | epinephrine 30u (line 18–21) |
| bottle (morphine) | 30 | — | morphine 30u (line 38–42) |
| bottle (multiver) | 30 | — | c2/multiver 30u (line 55–58) |
| bottle (ammonia) | 30 | — | ammonia 30u (line 85–88) |
| bottle (toxin) | 30 | — | toxin 30u (line 23–26) |

### Blood Packs (`/obj/item/reagent_containers/blood`)

Volume 200u, no transfer_amounts list. blood_type field. random subtype picks type at init (line 38–41, blood_pack.dm). Contains /datum/reagent/blood with data fields: donor, viruses, blood_DNA, blood_type, resistances, trace_chem (line 15).

### Chem Pack (`/obj/item/reagent_containers/chem_pack`)

Volume 100u, transfer 5u (from base). Spillable=TRUE. Alt-click to seal (reagents.flags=NONE) (line 14–26, chem_pack.dm).

### Spray Bottles (`/obj/item/reagent_containers/spray`)

| Type | Volume | Stream Range | Spray Range | Transfer | Notes |
|------|--------|--------------|-------------|----------|-------|
| spray (generic) | 250 | 1 | 3 | 5 | Mode toggle; stream uses stream_amount=10 (line 116–124, spray.dm) |
| space cleaner | 100 | 1 | 3 | 2 | space_cleaner 100u (line 162–169) |
| pepperspray | 50 | 4 | 3 | 5 | condensedcapsaicin 50u (line 194–205) |
| water flower | 10 | — | — | 1 | water 10u; attack_self disabled (line 221–232) |
| pest spray | — | — | — | — | NOT FOUND in provided files |
| Plant-B-Gone | — | — | — | — | NOT FOUND in provided files |

### Pills & Patches (`/obj/item/reagent_containers/pill*`)

Pills: volume 50u, no transfer. Patches: volume 40u, apply_type=PATCH, self_delay=30 ds (line 11, patch.dm).

| Type | Reagent | Amount | Notes |
|------|---------|--------|-------|
| patch (aiuri/burn) | c2/aiuri 1u, granibitaluri 9u | — | self_delay=30 ds (line 36–40, patch.dm) |

### Pill Bottles (`/obj/item/storage/pill_bottle`)

All hold pills with max_w_class, storage_slots. PopulateContents creates pill stacks.

| Bottle Type | Pill Count | Contents | Notes |
|-------------|-----------|----------|-------|
| mannitol | 7 | mannitol pills 50u each | code/game/objects/items/storage/firstaid.dm:397–403 |
| psicodine | 7 | psicodine pills 10u each | line 462–468 |
| paxpsych | 5 | paxpsych pills 5u each | line 521–527 |
| happinesspsych | 5 | happinesspsych pills 5u each | line 505–511 |
| lsdpsych | 5 | lsdpsych pills 5u each | line 513–519 |

## First-Aid Kits (`/obj/item/storage/firstaid`)

All w_class TINY, throw_speed=3, throw_range=7.

| Kit Type | Contents (PopulateContents) | Damage Type Healed |
|----------|---------------------------|-------------------|
| regular | gauze 1, suture 2, mesh 2, medipen 1 | null (general) |
| emergency | healthanalyzer/wound 1, gauze 1, suture/emergency 1, ointment 1, medipen/ekit 2, iron pills 1 | null |
| fire | aiuri patch 3, hercuri spray 1, oxandrolone medipen 1, medipen 1 | BURN (line 156, firstaid.dm) |
| toxin | multiver/less 1, syriniver 3, potassiodide 1, penacid medipen 1 | TOX (line 181) |
| o2 | convermol syringe 3, salbutamol medipen 1, medipen 1, iron pills 1 | OXY (line 206) |
| brute | libital patch 3, gauze 1, probital pills 1, salacid medipen 1 | BRUTE (line 231) |

## Defibrillator (`/obj/item/defibrillator`)

code/game/objects/items/defib.dm:1–100. Revivecost=1000 (paddles.dm:301). Cooldown_duration=5 SECONDS (line 26). Cell type: stock_parts/cell/high (line 24).

### Revive Mechanics (shockpaddles.proc.do_help, line 544–638)

- Begin to place: 30 ds delay (line 548)
- After placement: 20 ds delay before reviving (line 552)
- Revive requires: patient DEAD, heart present (getorgan), can_defib()>0 (line 551, 567)
- On success: defib deducts revivecost from cell, sets cooldown=TRUE (line 616–617)
- Messages: "Resuscitation successful" on success, various fail_reason strings (line 572–586)

### Compact Defibrillator (`/obj/item/defibrillator/compact`)

slot_flags=ITEM_SLOT_BELT, w_class=NORMAL (line 245, defib.dm). Loaded variant spawns with cell (line 251–254).

## Prosthetic Bodyparts (`/obj/item/bodypart/*/robot/surplus`)

code/modules/surgery/bodyparts/robot_bodyparts.dm:296–300.

| Part | Name | brute_reduction | burn_reduction |
|------|------|----------------|----------------|
| l_arm/robot/surplus | surplus prosthetic left arm | 0 | — |
| r_arm/robot/surplus | surplus prosthetic right arm | 0 | — |
| l_leg/robot/surplus | surplus prosthetic left leg | 0 | — |
| r_leg/robot/surplus | surplus prosthetic right leg | 0 | — |

Desc: "A skeletal, robotic limb. Outdated and fragile, but it's still better than nothing."

## Implanters & Cases

`/obj/item/implanter`: w_class=SMALL, force/throwforce in custom_materials. On attack: do_mob 50 ds, then imp.implant() (implanter.dm:24–42).

`/obj/item/implantcase/exile`: name="implant case - 'Exile'", desc="A glass case containing an exile implant." (implantcase.dm:71 NOT FOUND—not in provided excerpt).

## Minimum viable port

1. Medical stacks: apply to bodypart zone; heal_brute/heal_burn per application; self_delay vs other_delay
2. Medipens: 15u volume, one-use, ignore armor flag (pierce hardsuits)
3. Syringes: 15u volume, draw/inject modes toggled via attack_self
4. Spray bottles: volume 250u, spray range 3 or stream range 1; mode toggle
5. Beakers/bottles: volume 30–100u; transfer_amounts list for player menu
6. Blood packs: 200u; track blood_type and data; random subtype picks type
7. Pills/patches: instant or 30 ds delay; dissolve in containers
8. First-aid kits: PopulateContents on spawn, only if not empty flag
9. Defibrillator: 1000-charge revive; 30 ds place + 20 ds shock; revive checks can_defib()
10. Prosthetics: 0 brute/burn reduction (surplus versions)

## NOT FOUND / open questions

- `/obj/item/reagent_containers/spray/pestspray` (code not in provided files)
- `/obj/item/reagent_containers/spray/plantbgone` (code not in provided files)
- `/obj/item/implantcase/exile` (only /exile subtype name and desc in task; code impl NOT FOUND)
- Health analyzer, gas analyzer: referenced in task but NOT FOUND in provided medical stacks/surgery files
- Reagent effects (on_mob_life, overdose_threshold, metabolism): `/datum/reagent/medicine/*` code NOT FOUND in provided files
- Bottle.dm provides 30u content examples only; nutrient bottles (EZ-Nutrient, Robust Harvest) NOT FOUND
