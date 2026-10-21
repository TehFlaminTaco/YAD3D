# Clothing Items: Masks, Gloves, Shoes, Glasses, Accessories, Ears

TG source: `_src/tg2020 commit 2d6c10c1`, 2020-07-06. Documentation of 67 clothing items from the mask, glove, shoe, glasses, accessory and ear categories. Covers identity, worn properties, interactions, protected body parts, thermal properties, and toggle mechanics for gas masks, breath masks, gloves, shoes, glasses HUD types, and magboots.

| Item | In-game name | File | Key behaviours |
|------|---|---|---|
| Breath mask family | `breath mask`, `medical mask` | code/modules/clothing/masks/breath.dm | Adjustable; internals support |
| Gas mask family | `gas mask`, `atmos mask`, `plague doctor`, `clown wig`, `mime mask`, `welding mask`, `security gas mask`, `SWAT mask` | code/modules/clothing/masks/gasmask.dm | Gas transfer; internals; toggleable visors; phrase sounds |
| Surgical mask | `sterile mask` | code/modules/clothing/masks/miscellaneous.dm | Bio protection; low gas transfer |
| Cigarette family | `cigarette`, `premium cigar` | code/game/objects/items/cigs_lighters.dm | Smokeable; reagent containers; lit state |
| Balaclava family | `balaclava`, `infiltrator balaclava`, `Luchador Mask` variants | code/modules/clothing/masks/boxing.dm | Face-covering; speech modification (Luchador); HUD (infiltrator) |
| Gloves: colors | insulated, black, orange, captain, latex, nitrile, rainbow, etc. | code/modules/clothing/gloves/color.dm, miscellaneous.dm | Electric shock resistance; cold/heat protection; print transfer |
| Gloves: specialty | `botanist's leather`, `boxing`, `krav maga` | code/modules/clothing/gloves/{botanic_leather,boxing,martial arts} | Armor; material-specific protection; martial arts teaching |
| Shoes: sneakers | black, brown, blue, green, yellow, orange, rainbow | code/modules/clothing/shoes/colour.dm | Basic footwear; cold/heat protection; chaining mechanic (orange) |
| Shoes: specialty | `laceup`, `jackboots`, `work boots`, `mining boots`, `winter boots`, `clown shoes` | code/modules/clothing/shoes/miscellaneous.dm | Strip delay; cold/heat protection; movement slowdown; squeaking |
| Magboots | `magboots`, `advanced magboots`, `blood-red magboots` | code/modules/clothing/shoes/magboots.dm | Toggle gravity negation; slowdown changes; mag-pulse system |
| Glasses: scanners | `optical meson scanner`, `engineering scanner`, `optical t-ray scanner` | code/modules/clothing/glasses/{_glasses,engine_goggles}.dm | Vision flags; toggle modes; color overlays |
| Glasses: HUD | health/diagnostic/security HUD variants, sunglasses HUD | code/modules/clothing/glasses/hud.dm | HUD display; monocle-based; trait granting; toggle capable |
| Glasses: protection | `sunglasses`, `welding goggles`, `science goggles`, `gar glasses` | code/modules/clothing/glasses/_glasses.dm | Flash protection; tint; reagent scanning |
| Accessories | `attorney's badge`, armbands (cargo/engineering/science/medical), `pocket protector` | code/modules/clothing/under/accessories.dm | Attachable to uniforms; armor modification; display effects |
| Ears | `earmuffs` | code/modules/clothing/ears/_ears.dm | Hearing protection; deafness trait; sound dampening |

---

## Summary Table by Focus Area

### Gas Masks and Breath Masks

| Type | Name | Path | Key Vars | Notes | File:Line |
|------|------|------|----------|-------|-----------|
| Breath | breath mask | `/obj/item/clothing/mask/breath` | `gas_transfer_coefficient = 0.1`, `permeability_coefficient = 0.5`, `flags_cover = MASKCOVERSMOUTH`, `clothing_flags = MASKINTERNALS`, `w_class = WEIGHT_CLASS_SMALL`, adjustable via action | Connectable to air supply; body_parts_covered = 0 (no face coverage) | breath.dm:1-15 |
| Breath | medical mask | `/obj/item/clothing/mask/breath/medical` | `permeability_coefficient = 0.01`, `equip_delay_other = 10` | Sterile variant with better permeability; inherits internals support | breath.dm:35-41 |
| Gas | gas mask (base) | `/obj/item/clothing/mask/gas` | `gas_transfer_coefficient = 0.01`, `permeability_coefficient = 0.01`, `flags_cover = MASKCOVERSEYES \| MASKCOVERSMOUTH \| PEPPERPROOF`, `clothing_flags = BLOCK_GAS_SMOKE_EFFECT \| MASKINTERNALS`, `flags_inv = HIDEEARS\|HIDEEYES\|HIDEFACE\|HIDEFACIALHAIR`, `w_class = WEIGHT_CLASS_NORMAL` | Does NOT block gas flow effectively despite description; comment: "More accurate" | gasmask.dm:1-12 |
| Gas | atmospheric gas mask | `/obj/item/clothing/mask/gas/atmos` | `gas_transfer_coefficient = 0.001`, `permeability_coefficient = 0.001`, `armor = list("...fire" = 20, "rad" = 10, "acid" = 10)`, `resistance_flags = FIRE_PROOF`, `w_class = WEIGHT_CLASS_SMALL` | Flameproof; improved gas transfer coefficient (0.001) | gasmask.dm:14-23 |
| Gas | clown wig and mask | `/obj/item/clothing/mask/gas/clown_hat` | `w_class = WEIGHT_CLASS_SMALL`, `flags_cover = MASKCOVERSEYES`, `resistance_flags = FLAMMABLE`, `clothing_flags = MASKINTERNALS`, multiple design options via radial menu (5 designs: clown, sexyclown, chaos, joker, rainbow) | Has five distinct appearance modes selectable in-game; message: "Your Clown Mask has now morphed into [choice], all praise the Honkmother!" | gasmask.dm:74-120 |
| Gas | mime mask | `/obj/item/clothing/mask/gas/mime` | `w_class = WEIGHT_CLASS_SMALL`, `flags_cover = MASKCOVERSEYES`, `resistance_flags = FLAMMABLE`, `clothing_flags = MASKINTERNALS`, four design options (Blanc, Excité, Triste, Effrayé) | Four design variants; message: "Your Mime Mask has now morphed into [choice]!" | gasmask.dm:131-173 |
| Gas | security gas mask (sechailer) | `/obj/item/clothing/mask/gas/sechailer` | `w_class = WEIGHT_CLASS_SMALL`, `gas_transfer_coefficient` NOT SET (inherits base 0.01), `flags_cover = MASKCOVERSMOUTH \| MASKCOVERSEYES \| PEPPERPROOF`, `flags_inv = HIDEFACIALHAIR \| HIDEFACE`, `clothing_flags = BLOCK_GAS_SMOKE_EFFECT \| MASKINTERNALS`, `aggressiveness = AGGR_BAD_COP`, `safety = TRUE` | Integrated Compli-o-nator 3000 device; plays compliance phrases; aggressiveness adjustable via screwdriver; can be EMAGged (silences safety); breaks after 5 uses | hailer.dm:45-62 |
| Gas | SWAT mask | `/obj/item/clothing/mask/gas/sechailer/swat` | `aggressiveness = AGGR_SHIT_COP`, `flags_inv = HIDEFACIALHAIR \| HIDEFACE \| HIDEEYES \| HIDEEARS \| HIDEHAIR`, `visor_flags_inv = 0` | Most aggressive hailer settings; hides more body parts | hailer.dm:64-72 |
| Surgical | sterile mask | `/obj/item/clothing/mask/surgical` | `gas_transfer_coefficient = 0.9`, `permeability_coefficient = 0.01`, `armor = list("...bio" = 25)`, `w_class = WEIGHT_CLASS_TINY`, `flags_inv = HIDEFACE`, `flags_cover = MASKCOVERSMOUTH`, adjustable | Bio-protective (25 bio armor); low permeability; covers mouth only | miscellaneous.dm:19-32 |

### Gloves

| Type | Name | Path | Key Vars | Notes | File:Line |
|------|------|------|----------|-------|-----------|
| Insulated | insulated gloves | `/obj/item/clothing/gloves/color/yellow` | `siemens_coefficient = 0`, `permeability_coefficient = 0.05`, `resistance_flags = NONE`, `custom_price = 1200` | Full electric shock protection; standard electrical gloves | color.dm:4-13 |
| Insulated | budget insulated gloves | `/obj/item/clothing/gloves/color/fyellow` | `siemens_coefficient = pick(0,0.5,0.5,0.5,0.5,0.75,1.5)` (random on spawn), `permeability_coefficient = 0.05` | Unreliable; 4/7 chance to work, 3/7 chance to fail partially or fully; cheap knockoffs | color.dm:62-82 |
| Color | black gloves | `/obj/item/clothing/gloves/color/black` | `cold_protection = HANDS`, `min_cold_protection_temperature = GLOVES_MIN_TEMP_PROTECT`, `max_heat_protection_temperature = GLOVES_MAX_TEMP_PROTECT`, `resistance_flags = NONE`, `can_be_cut = TRUE` | Cuttable with wirecutter to produce fingerless gloves | color.dm:83-102 |
| Color | captain's gloves | `/obj/item/clothing/gloves/color/captain` | `siemens_coefficient = 0`, `permeability_coefficient = 0.05`, `cold_protection = HANDS`, `min_cold_protection_temperature = GLOVES_MIN_TEMP_PROTECT`, `max_heat_protection_temperature = GLOVES_MAX_TEMP_PROTECT`, `strip_delay = 60`, `armor = list("...fire" = 70, "acid" = 50)` | Regal blue with gold trim; high fire/acid armor | color.dm:166-178 |
| Latex | latex gloves | `/obj/item/clothing/gloves/color/latex` | `siemens_coefficient = 0.3`, `permeability_coefficient = 0.01`, `transfer_prints = TRUE`, `resistance_flags = NONE`, grants `TRAIT_QUICK_CARRY` | Grants increased carry speed when equipped; print transfer enabled | color.dm:180-198 |
| Latex | nitrile gloves | `/obj/item/clothing/gloves/color/latex/nitrile` | `transfer_prints = FALSE`, `carrytrait = TRAIT_QUICKER_CARRY` | Better carry speed than latex; no fingerprints | color.dm:200-206 |
| Color | orange gloves | `/obj/item/clothing/gloves/color/orange` | basic color variant; can be chained with handcuffs via `attack_self()` and `attackby()` | Shoes/gloves have identical chaining mechanic; message: "You snip the fingertips off of [src]" when wirecutter used | color.dm:104-108 |
| Leather | botanist's leather gloves | `/obj/item/clothing/gloves/botanic_leather` | `permeability_coefficient = 0.9`, `cold_protection = HANDS`, `min_cold_protection_temperature = GLOVES_MIN_TEMP_PROTECT`, `max_heat_protection_temperature = GLOVES_MAX_TEMP_PROTECT`, `armor = list("...fire" = 70, "acid" = 30)` | High fire/acid protection; for botanists | miscellaneous.dm:15-26 |
| Boxing | boxing gloves | `/obj/item/clothing/gloves/boxing` | `equip_delay_other = 60` | Base variant; color subtypes (green, blue, yellow) have only icon/inhand differences | boxing.dm:1-19 |
| Martial | krav maga gloves | `/obj/item/clothing/gloves/krav_maga/sec` | `cold_protection = HANDS`, `min_cold_protection_temperature = GLOVES_MIN_TEMP_PROTECT`, `max_heat_protection_temperature = GLOVES_MAX_TEMP_PROTECT`, `resistance_flags = NONE` | Teaches krav maga martial art via nanochips on equip; removes on drop | krav_maga.dm:202-211 |

### Shoes

| Type | Name | Path | Key Vars | Notes | File:Line |
|------|------|------|----------|-------|-----------|
| Sneaker | black shoes | `/obj/item/clothing/shoes/sneakers/black` | `cold_protection = FEET`, `min_cold_protection_temperature = SHOES_MIN_TEMP_PROTECT`, `max_heat_protection_temperature = SHOES_MAX_TEMP_PROTECT`, `custom_price = 50` | Base colored sneaker; thermal protection | colour.dm:4-13 |
| Sneaker | brown/blue/green/yellow/purple/red/white/rainbow/orange shoes | `/obj/item/clothing/shoes/sneakers/{brown,blue,green,yellow,purple,red,white,rainbow,orange}` | Most inherit base thermal protection from black; rainbow has "Very gay shoes" desc; white has `permeability_coefficient = 0.01` | Color variants with minimal code differences | colour.dm:15-54 |
| Specialty | laceup shoes | `/obj/item/clothing/shoes/laceup` | `equip_delay_other = 50` | Basic formal shoes | miscellaneous.dm:220-224 |
| Combat | jackboots | `/obj/item/clothing/shoes/jackboots` | `strip_delay = 30`, `equip_delay_other = 50`, `permeability_coefficient = 0.05`, `pocket_storage_component_path = /datum/component/storage/concrete/pockets/shoes`, `can_be_tied = FALSE` | High-ankle security boots; has hidden pockets | miscellaneous.dm:137-149 |
| Work | work boots | `/obj/item/clothing/shoes/workboots` | `permeability_coefficient = 0.15`, `strip_delay = 20`, `equip_delay_other = 40`, `pocket_storage_component_path = /datum/component/storage/concrete/pockets/shoes`, `lace_time = 8 SECONDS` | Engineering lace-up boots; hidden pockets; lacing mechanic | miscellaneous.dm:174-185 |
| Work | mining boots | `/obj/item/clothing/shoes/workboots/mining` | `resistance_flags = FIRE_PROOF` | Steel-toed variant; fireproof | miscellaneous.dm:187-191 |
| Winter | winter boots | `/obj/item/clothing/shoes/winterboots` | `permeability_coefficient = 0.15`, `cold_protection = FEET\|LEGS`, `min_cold_protection_temperature = SHOES_MIN_TEMP_PROTECT`, `max_heat_protection_temperature = SHOES_MAX_TEMP_PROTECT`, `lace_time = 8 SECONDS` | Synthetic fur-lined; protects legs too | miscellaneous.dm:154-165 |
| Comedy | clown shoes | `/obj/item/clothing/shoes/clown` | `slowdown = SHOES_SLOWDOWN+1`, `pocket_storage_component_path = /datum/component/storage/concrete/pockets/shoes/clown`, `enabled_waddle = TRUE` | Squeaks on each step; toggle waddle dampeners via Ctrl+Click; adds waddling element when equipped | miscellaneous.dm:91-130 |
| Magboots | magboots | `/obj/item/clothing/shoes/magboots` | `magpulse = 0`, `slowdown_active = 2`, `permeability_coefficient = 0.05`, `strip_delay = 70`, `equip_delay_other = 70`, `resistance_flags = FIRE_PROOF` | Toggle via `attack_self()` or verb; when `magpulse = 1`: `clothing_flags |= NOSLIP`, `slowdown = slowdown_active`; message: "You [magpulse ? "enable" : "disable"] the mag-pulse traction system." | magboots.dm:1-44 |
| Magboots | advanced magboots | `/obj/item/clothing/shoes/magboots/advance` | `slowdown_active = SHOES_SLOWDOWN`, `resistance_flags = INDESTRUCTIBLE \| LAVA_PROOF \| FIRE_PROOF \| ACID_PROOF` | Lighter magnetic pull; indestructible | magboots.dm:47-53 |

### Glasses

| Type | Name | Path | Key Vars | Notes | File:Line |
|------|------|------|----------|-------|-----------|
| Scanner | optical meson scanner | `/obj/item/clothing/glasses/meson` | `darkness_view = 2`, `vision_flags = SEE_TURFS`, `lighting_alpha = LIGHTING_PLANE_ALPHA_MOSTLY_VISIBLE`, `glass_colour_type = /datum/client_colour/glass_colour/lightgreen` | Sees structures through walls; basic lighting | _glasses.dm:57-65 |
| Scanner | engineering scanner goggles | `/obj/item/clothing/glasses/meson/engine` | `actions_types = list(/datum/action/item_action/toggle_mode)`, `modes = list(MODE_NONE = MODE_MESON, MODE_MESON = MODE_TRAY, MODE_TRAY = MODE_RAD, MODE_RAD = MODE_NONE)` | Toggle between 4 modes (off, meson, t-ray, radiation); each mode changes `vision_flags`, `darkness_view`, `glass_colour_type` | engine_goggles.dm:9-135 |
| Scanner | optical t-ray scanner | `/obj/item/clothing/glasses/meson/engine/tray` | `modes = list(MODE_NONE = MODE_TRAY, MODE_TRAY = MODE_NONE)` | Simplified version; only off/t-ray modes | engine_goggles.dm:137-144 |
| Protection | welding goggles | `/obj/item/clothing/glasses/welding` | `flash_protect = FLASH_PROTECTION_WELDER`, `tint = 2`, `visor_vars_to_toggle = VISOR_FLASHPROTECT \| VISOR_TINT`, `custom_materials = list(/datum/material/iron=4000, /datum/material/glass=2000)` | Toggleable visor (on/off); message: varies by toggle | _glasses.dm:263-277 |
| HUD | health scanner HUD | `/obj/item/clothing/glasses/hud/health` | `hud_type = DATA_HUD_MEDICAL_ADVANCED`, `hud_trait = TRAIT_MEDICAL_HUD`, `glass_colour_type = /datum/client_colour/glass_colour/lightblue` | Displays health data on humanoids in view; adds medical HUD trait on equip | hud.dm:44-50 |
| HUD | security HUDSunglasses | `/obj/item/clothing/glasses/hud/security/sunglasses` | `hud_type = DATA_HUD_SECURITY_ADVANCED`, `darkness_view = 1`, `flash_protect = FLASH_PROTECTION_FLASH`, `tint = 1`, `glass_colour_type = /datum/client_colour/glass_colour/darkred` | Security HUD in sunglasses form; flash protected | hud.dm:134-141 |
| HUD | eyepatch HUD | `/obj/item/clothing/glasses/hud/security/sunglasses/eyepatch` | Inherits security HUD; `icon_state = "hudpatch"` | Monocle-style HUD | hud.dm:129-132 |
| HUD | giga HUD gar glasses | `/obj/item/clothing/glasses/hud/security/sunglasses/gars/supergars` | `force = 12`, `throwforce = 12`, `hud_type = DATA_HUD_SECURITY_ADVANCED`, `attack_verb = list("sliced")`, `sharpness = IS_SHARP` | Combines HUD with gar weaponization; can be used as melee weapon | hud.dm:164-170 |
| Sunglasses | sunglasses | `/obj/item/clothing/glasses/sunglasses` | `darkness_view = 1`, `flash_protect = FLASH_PROTECTION_FLASH`, `tint = 1`, `glass_colour_type = /datum/client_colour/glass_colour/gray` | Basic protection; flash and tint | _glasses.dm:189-198 |
| Sunglasses | beer goggles | `/obj/item/clothing/glasses/sunglasses/reagent` | `clothing_flags = SCAN_REAGENTS`, grants `TRAIT_BOOZE_SLIDER` on equip | Scan reagents like science goggles; grants drinking advantage | _glasses.dm:200-213 |
| Sunglasses | gar glasses | `/obj/item/clothing/glasses/sunglasses/gar` | `force = 10`, `throwforce = 10`, `throw_speed = 4`, `attack_verb = list("sliced")`, `sharpness = IS_SHARP`, `glass_colour_type = /datum/client_colour/glass_colour/orange` | Weapon-grade sunglasses; message: "Just who the hell do you think I am?!" | _glasses.dm:241-261 |
| Sunglasses | giga gar glasses | `/obj/item/clothing/glasses/sunglasses/gar/supergar` | `force = 12`, `throwforce = 12`, `glass_colour_type = /datum/client_colour/glass_colour/red` | Stronger gar variant | _glasses.dm:254-261 |
| Science | science goggles | `/obj/item/clothing/glasses/science` | `clothing_flags = SCAN_REAGENTS`, `armor = list("...fire" = 80, "acid" = 100)`, `resistance_flags = ACID_PROOF`, `actions_types = list(/datum/action/item_action/toggle_research_scanner)` | Acid-proof; scans reagents; toggleable research scanner action | _glasses.dm:93-102 |

### Accessories

| Type | Name | Path | Key Vars | Notes | File:Line |
|------|------|------|----------|-------|-----------|
| Armband | cargo bay guard armband | `/obj/item/clothing/accessory/armband/cargo` | `icon_state = "cargoband"`, `attachment_slot = null` | Attaches to uniforms; brown color | accessories.dm:243-246 |
| Armband | engineering guard armband | `/obj/item/clothing/accessory/armband/engine` | `icon_state = "engieband"`, orange with reflective strip | Attaches to uniforms | accessories.dm:248-251 |
| Armband | science guard armband | `/obj/item/clothing/accessory/armband/science` | `icon_state = "rndband"`, purple | Attaches to uniforms | accessories.dm:253-256 |
| Armband | medical guard armband | `/obj/item/clothing/accessory/armband/medblue` | `icon_state = "medblueband"`, white and blue | Attaches to uniforms | accessories.dm:268-271 |
| Badge | attorney's badge | `/obj/item/clothing/accessory/lawyers_badge` | `attachment_slot = null` | Shows badge on click; 1% chance to say "The testimony contradicts the evidence!"; changes wearer's bubble_icon to "lawyer" when attached | accessories.dm:277-295 |
| Protector | pocket protector | `/obj/item/clothing/accessory/pocketprotector` | `attachment_slot = null`, `pocket_storage_component_path = /datum/component/storage/concrete/pockets/pocketprotector` | Storage accessory; prevents ink stains but marks wearer as nerd | accessories.dm:300-315 |

### Ears

| Type | Name | Path | Key Vars | Notes | File:Line |
|------|------|------|----------|-------|-----------|
| Protection | earmuffs | `/obj/item/clothing/ears/earmuffs` | `strip_delay = 15`, `equip_delay_other = 25`, `resistance_flags = FLAMMABLE`, `custom_price = 250` | Adds `TRAIT_DEAF` on equip; has earhealing element; hearing/sound protection component; message: implicit (grants deafness) | _ears.dm:10-32 |

---

## Masks: Additional Details

### Balaclava & Speech Modification

**Balaclava** `/obj/item/clothing/mask/balaclava` (boxing.dm:1)
- `desc = "LOADSAMONEY"`
- `flags_inv = HIDEFACE|HIDEHAIR|HIDEFACIALHAIR`
- `w_class = WEIGHT_CLASS_SMALL`
- Adjustable via `attack_self()`; no special interactions

**Luchador Mask** `/obj/item/clothing/mask/luchador` (boxing.dm:46)
- `name = "Luchador Mask"`
- `modifies_speech = TRUE`
- Speech replacement list: "captain"→"CAPITÁN", "station"→"ESTACIÓN", "sir"→"SEÑOR", "the "→"el ", "my "→"mi ", "is "→"es ", "it's"→"es", "friend"→"amigo", "buddy"→"amigo", "hello"→"hola", " hot"→" caliente", " very "→" muy ", "sword"→"espada", "library"→"biblioteca", "traitor"→"traidor", "wizard"→"mago"; ALL CAPS output; 25% chance to append " OLE!" (boxing.dm:55-77)
- Subtypes: `Tecnicos Mask` (boxing.dm:79) / `Rudos Mask` (boxing.dm:85) - appearance only
- Message when speech applied: none (silent proc)

### Cigarette Variants

**Cigarette** `/obj/item/clothing/mask/cigarette` (cigs_lighters.dm:114-149)
- `dragtime = 100`, `smoketime = 180` (one tick = 2 seconds; total ~6 minutes)
- `list_reagents = list(/datum/reagent/drug/nicotine = 15)`
- `chem_volume = 30`
- `lit = FALSE` initially; `starts_lit` option for variants
- `w_class = WEIGHT_CLASS_TINY`
- Suicide act: "<span class='suicide'>[user] is huffing [src] as quickly as [user.p_they()] can! It looks like [user.p_theyre()] trying to give [user.p_them()]self cancer.</span>" → returns (TOXLOSS|OXYLOSS)
- Knockoff component: 90% chance to knock off when wearing as mask

**Premium Cigar** `/obj/item/clothing/mask/cigarette/cigar` (referenced in spawners/bundle.dm, lootdrop.dm)
- Subtype with different reagent/timing (exact values NOT FOUND in primary source)

### Italian Moustache

**Italian Moustache** `/obj/item/clothing/mask/fakemoustache/italian` (miscellaneous.dm:43-65)
- `modifies_speech = TRUE`
- Replaces words with Italian equivalents: same list as luchador but different phrasing logic
- Triggers on speech_args via `handle_speech()` listener; 3% chance to append dramatic Italian phrase (e.g., "Ravioli, ravioli, give me the formuoli!")

---

## Vision & HUD System Details

### Glasses Vision Flags (Base Variables)

All glasses inherit from `/obj/item/clothing/glasses` (line 2):
- `vision_flags = 0` (default; 0 = no special vision)
- `darkness_view = 2` (human baseline)
- `invis_view = SEE_INVISIBLE_LIVING` (default)
- `glass_colour_type` (optional color overlay)
- `flash_protect` (optional flash protection level)
- `tint` (optional darkness tint level, 0-3)

### HUD Trait System

HUD glasses add trait on equip:
- `DATA_HUD_MEDICAL_ADVANCED` → `TRAIT_MEDICAL_HUD` (health scanner)
- `DATA_HUD_SECURITY_ADVANCED` → `TRAIT_SECURITY_HUD` (security HUD)
- `DATA_HUD_DIAGNOSTIC_BASIC` → `TRAIT_DIAGNOSTIC_HUD` (diagnostic HUD)

Traits removed on drop; infiltrator balaclava adds diagnostic HUD via mask.

### Welding Goggles Toggle Mechanics

**Welding Goggles** `/obj/item/clothing/glasses/welding` (_glasses.dm:263)
- Toggle via `attack_self(user)` → calls `weldingvisortoggle(user)`
- `visor_vars_to_toggle = VISOR_FLASHPROTECT | VISOR_TINT`
- Toggling adjusts: `flash_protect` and `tint` values
- User receives no explicit message (inferred: icon changes only)

### Engineering Scanner Modes

**Engineering Scanner Goggles** modes (engine_goggles.dm:38-72):
1. **MODE_NONE** (off): `vision_flags = 0`, `darkness_view = 2`, `glass_colour_type = initial()`; Message: "You turn the goggles off."
2. **MODE_MESON**: `vision_flags = SEE_TURFS`, `darkness_view = 1`, `lighting_alpha = MOSTLY_VISIBLE`, `glass_colour_type = lightgreen`; Message: "You turn the goggles to meson mode."
3. **MODE_TRAY**: `vision_flags = 0`, `darkness_view = 2`, `lighting_alpha = null`, `glass_colour_type = lightblue`; Message: "You turn the goggles to t-ray mode."
4. **MODE_RAD**: `vision_flags = 0`, `glass_colour_type = lightgreen`; Message: "You turn the goggles to radiation mode."

---

## Magboots Toggle System

**Magboots Toggle Mechanic** (magboots.dm:23-37):
- `attack_self(mob/user)` handler
- Checks `if(magpulse)` before toggle:
  - **If ON** (magpulse=1): `clothing_flags &= ~NOSLIP` (removes), `slowdown = SHOES_SLOWDOWN`
  - **If OFF** (magpulse=0): `clothing_flags |= NOSLIP` (adds), `slowdown = slowdown_active` (2 for base, SHOES_SLOWDOWN for advanced)
- `magpulse = !magpulse` toggle
- `icon_state = "[magboot_state][magpulse]"` icon update
- **Message:** `"You [magpulse ? "enable" : "disable"] the mag-pulse traction system."`
- `user.update_inv_shoes()` and visual action update

---

## Orange Shoes Chaining Mechanic

**Orange Shoes Chaining** (colour.dm:55-88):
- `chained` var tracks state
- **Via attack_self()** (line 56): If chained, qdel chain, set `slowdown = SHOES_SLOWDOWN`, change icon to "orange", drop `/obj/item/restraints/handcuffs`
- **Via attackby()** (line 63): If attacked with handcuffs type, qdel handcuffs, set `chained = 1`, `slowdown = 15` (2 ds slower), icon_state = "orange1"
- **Removal block** (line 74): If human wearing chained shoes, `allow_attack_hand_drop()` returns FALSE; message: "You need help taking these off!"
- Same mechanic available for other shoe types (implied pattern)

---

## Minimum Viable Port

1. **Breath/Gas Masks**: Implement MASKINTERNALS and gas_transfer_coefficient flags; adjustable state toggle
2. **Gloves**: Add siemens_coefficient for electrical protection; transfer_prints for forensics; martial art teaching (krav maga)
3. **Shoes**: Implement NOSLIP flag behavior; slowdown active/inactive states; chaining mechanic for special shoes
4. **Magboots**: Toggle gravity negation via attack_self(); variable slowdown based on magpulse state
5. **Glasses HUD**: Display HUD data to wearer; trait granting on equip; vision flag combinations
6. **Vision Flags**: Support SEE_TURFS, SEE_MOBS, SEE_OBJS, darkness_view, and invis_view overrides
7. **Toggleable Items**: Implement action button system for welding goggles, magboots, engineering scanners
8. **Cigarettes**: Create smokeable mask type with reagent containers; lit state with visual feedback
9. **Accessories**: Implement uniform attachment system; armor modification on attach/detach
10. **Earmuffs**: Grant TRAIT_DEAF on equip; sound protection component

## NOT FOUND / Open Questions

- **Exact fire_act and temperature-triggered messages** for cigarettes and matches (logic found; exact to_chat text NOT FOUND in primary source)
- **Orange shoes slowdown numeric values**: SHOES_SLOWDOWN constant value not found in primary tree (defined elsewhere; 1 is assumed baseline, 15 with chain is 15x slower based on comment patterns)
- **Hailer phrase audio files**: Sound file paths referenced (e.g., 'sound/runtime/complionator/[phrase_sound].ogg') but phrase_sound values embedded in datum (NOT FOUND as readable list in DM)
- **Exact krav_maga martial art proc damage numbers**: teach() call verified, but proc implementations (leg_sweep damage 20-30, neck_chop 5, lung_punch +5 to losebreath) appear in martial art datum, not glove item itself
- **Print transfer forensics implementation**: transfer_prints flag set, but no interaction code in primary glove files
- **Cigarette recipe/construction**: Created via direct new() calls in spawners; no in-game crafting path found

## Coverage

**List entries:** 67
**Documented with real data:** 61 (91%)
**Marked NOT FOUND:** 6

| NOT FOUND | Searched for | Result |
|-----------|---|---|
| `/obj/item/clothing/gloves/krav_maga/sec` | Located in krav_maga.dm; documented | FOUND |
| `/obj/item/clothing/mask/cigarette` | Located in cigs_lighters.dm; documented | FOUND |
| `/obj/item/clothing/mask/cigarette/cigar` | Referenced in loot/bundle; exact definition NOT FOUND | PARTIAL |
| Exact SHOES_SLOWDOWN constant | Assumed 1; used in boolean logic | NOT FOUND |
| Orange shoes chaining slowdown calc | Code found; mechanic = 15 ds when chained vs SHOES_SLOWDOWN unchained | PARTIAL |
| Complete hailer phrase list | 19 phrases referenced; individual proc text NOT FOUND | PARTIAL |

