# Clothing Items: Suits, Hats, Helmets, and Spacesuits

TG2020 documentation of 96 clothing items: emergency spacesuits and hardsuits with jetpacks, armor and security wear, job-specific uniforms and coats with toggles, protective suits (bio/bomb/radiation/fire), and headwear from basic caps to hardhat-integrated tools.

## Emergency Space Protection

### Space Helmet  `/obj/item/clothing/head/helmet/space`   (spacesuits/_spacesuits.dm:5)
- Protective helmet for low-pressure EVA environments
- Key vars: armor = melee 0, bullet 0, laser 0, energy 0, bomb 0, bio 100, rad 50, fire 80, acid 70  (file:12)
- permeability_coefficient = 0.01  (file:11)
- clothing_flags = STOPSPRESSUREDAMAGE | THICKMATERIAL | SNUG_FIT  (file:9)
- flags_inv = HIDEMASK|HIDEEARS|HIDEEYES|HIDEFACE|HIDEHAIR|HIDEFACIALHAIR  (file:13)
- cold_protection = HEAD  (file:16)
- min_cold_protection_temperature = SPACE_HELM_MIN_TEMP_PROTECT  (file:17)
- heat_protection = HEAD  (file:18)
- max_heat_protection_temperature = SPACE_HELM_MAX_TEMP_PROTECT  (file:19)
- flash_protect = FLASH_PROTECTION_WELDER  (file:20)
- strip_delay = 50 (ds), equip_delay_other = 50 (ds)  (file:21-22)
- dog_fashion = null  (file:25)

### Space Suit  `/obj/item/clothing/suit/space`   (spacesuits/_spacesuits.dm:27)
- Full body pressure suit for EVA
- w_class = WEIGHT_CLASS_BULKY  (file:32)
- gas_transfer_coefficient = 0.01, permeability_coefficient = 0.02  (file:33-34)
- clothing_flags = STOPSPRESSUREDAMAGE | THICKMATERIAL  (file:35)
- body_parts_covered = CHEST|GROIN|LEGS|FEET|ARMS|HANDS  (file:36)
- allowed = list(/obj/item/flashlight, /obj/item/tank/internals)  (file:37) [summarized: flashlight, internals tank]
- slowdown = 1  (file:38)
- armor = melee 0, bullet 0, laser 0, energy 0, bomb 0, bio 100, rad 50, fire 80, acid 70  (file:39)
- flags_inv = HIDEGLOVES|HIDESHOES|HIDEJUMPSUIT  (file:40)
- cold_protection = CHEST | GROIN | LEGS | FEET | ARMS | HANDS  (file:41)
- min_cold_protection_temperature = SPACE_SUIT_MIN_TEMP_PROTECT_OFF  (file:42)
- heat_protection = CHEST|GROIN|LEGS|FEET|ARMS|HANDS  (file:43)
- max_heat_protection_temperature = SPACE_SUIT_MAX_TEMP_PROTECT  (file:44)
- strip_delay = 80 (ds), equip_delay_other = 80 (ds)  (file:45-46)
- Interactions: thermal regulator toggle (action), cell cover toggle (alt-click proc), remove cell (ctrl-click), adjust temperature (screwdriver when cover open, range 20-45 C or -20-120 C if emagged)
- cell = /obj/item/stock_parts/cell/high (initialized)  (file:50)
- THERMAL_REGULATOR_COST = 18 per tick  (file:1)

## Hardsuit Systems

### Engineering Hardsuit Helmet  `/obj/item/clothing/suit/space/hardsuit/engine`   (hardsuit.dm:203)
- max_integrity = 300  (file:10)
- armor = melee 30, bullet 5, laser 10, energy 20, bomb 10, bio 100, rad 75, fire 100, acid 75, wound 10  (file:208)
- hardsuit_type = "engineering"  (file:209)
- brightness_on = 4 (luminosity when light on)  (file:13, parent hardsuit helmet)
- on = FALSE initially  (file:14)
- actions_types = list(/datum/action/item_action/toggle_helmet_light)  (file:17)
- Interactions: attack_self toggles light on/off, sets_light(brightness_on) or set_light(0)  (file:35-43)
- Base hardsuit helmet at line 5: armor = melee 10, bullet 5, laser 10, energy 20, bomb 10, bio 100, rad 75, fire 50, acid 75  (file:11, parent)
- resistance_flags = FIRE_PROOF  (file:210)
- helmettype = /obj/item/clothing/head/helmet/space/hardsuit/engine  (line 218, suit variant)

### Engineering Hardsuit  `/obj/item/clothing/suit/space/hardsuit/engine`   (hardsuit.dm:212)
- max_integrity = 300  (file:102, parent)
- armor = melee 30, bullet 5, laser 10, energy 20, bomb 10, bio 100, rad 75, fire 100, acid 75, wound 10  (file:217)
- allowed = list(/obj/item/flashlight, /obj/item/tank/internals, /obj/item/t_scanner, /obj/item/construction/rcd, /obj/item/pipe_dispenser)  (file:104, parent suit) [summarized]
- siemens_coefficient = 0  (file:105)
- jetpack = null initially  (file:109)
- helmettype = /obj/item/clothing/head/helmet/space/hardsuit/engine  (file:218)
- Interactions: attack_self toggles helmet on/off (ToggleHelmet), attackby with jetpack/light bulb to install, screwdriver to remove jetpack
- jet pack can be installed with do_after 50 (ds)  (file:164)
- light bulb replacement: do_after 50 (ds)  (file:164)
- resistance_flags = FIRE_PROOF  (file:219)

## Armor and Security Wear

### Armor Vest  `/obj/item/clothing/suit/armor/vest`   (armor.dm:19)
- armor = melee 35, bullet 30, laser 30, energy 40, bomb 25, bio 0, rad 0, fire 50, acid 50, wound 15  (armor.dm:12, parent)
- body_parts_covered = CHEST  (armor.dm:3)
- cold_protection = CHEST|GROIN, min_cold_protection_temperature = ARMOR_MIN_TEMP_PROTECT  (armor.dm:4-5)
- heat_protection = CHEST|GROIN, max_heat_protection_temperature = ARMOR_MAX_TEMP_PROTECT  (armor.dm:6-7)
- strip_delay = 60 (ds), equip_delay_other = 40 (ds)  (armor.dm:8-9)
- max_integrity = 250  (armor.dm:10)
- dog_fashion = /datum/dog_fashion/back  (armor.dm:25)

### Armor Vest (Alt)  `/obj/item/clothing/suit/armor/vest/alt`   (armor.dm:27)
- icon_state = "armor" (different from vest which uses "armoralt")  (armor.dm:29)
- Same armor and stats as parent /obj/item/clothing/suit/armor/vest

### Captain's Carapace  `/obj/item/clothing/suit/armor/vest/capcarapace`   (armor.dm:92)
- armor = melee 50, bullet 40, laser 50, energy 50, bomb 25, bio 0, rad 0, fire 100, acid 90, wound 10  (armor.dm:98)
- body_parts_covered = CHEST|GROIN  (armor.dm:97)
- resistance_flags = FIRE_PROOF  (armor.dm:100)
- dog_fashion = null  (armor.dm:99)

### Captain's Parade Jacket  `/obj/item/clothing/suit/armor/vest/capcarapace/alt`   (armor.dm:107)
- Inherits armor from parent capcarapace

### Armored Trenchcoat  `/obj/item/clothing/suit/armor/hos/trenchcoat`   (armor.dm:57)
- armor = inherited from /obj/item/clothing/suit/armor/hos (melee 30, bullet 30, laser 30, energy 40, bomb 25, bio 0, rad 0, fire 70, acid 90, wound 20)  (armor.dm:52)
- body_parts_covered = CHEST|GROIN|ARMS|LEGS  (armor.dm:51, parent)
- flags_inv = 0  (armor.dm:62)
- strip_delay = 80 (ds)  (armor.dm:63)

### Warden's Jacket  `/obj/item/clothing/suit/armor/vest/warden`   (armor.dm:65)
- armor = melee 35, bullet 30, laser 30, energy 40, bomb 25, bio 0, rad 0, fire 50, acid 50, wound 15  (inherited from /obj/item/clothing/suit/armor)
- body_parts_covered = CHEST|GROIN|ARMS  (armor.dm:70)
- cold_protection = CHEST|GROIN|ARMS|HANDS, heat_protection = CHEST|GROIN|ARMS|HANDS  (armor.dm:71-72)
- strip_delay = 70 (ds)  (armor.dm:73)
- resistance_flags = FLAMMABLE  (armor.dm:74)
- dog_fashion = null  (armor.dm:75)

### Warden's Armored Jacket  `/obj/item/clothing/suit/armor/vest/warden/alt`   (armor.dm:77)
- Inherits armor from parent warden's jacket

### Detective's Armor Vest  `/obj/item/clothing/suit/armor/vest/det_suit`   (armor.dm:164)
- Inherits armor from /obj/item/clothing/suit/armor/vest
- resistance_flags = FLAMMABLE  (armor.dm:168)
- dog_fashion = null  (armor.dm:169)

### Security Overcoat  `/obj/item/clothing/suit/armor/vest/leather`   (armor.dm:82)
- armor = melee 35, bullet 30, laser 30, energy 40, bomb 25, bio 0, rad 0, fire 50, acid 50 (inherited)
- body_parts_covered = CHEST|GROIN|ARMS|LEGS  (armor.dm:87)
- cold_protection = CHEST|GROIN|LEGS|ARMS, heat_protection = CHEST|GROIN|LEGS|ARMS  (armor.dm:88-89)
- dog_fashion = null  (armor.dm:90)

### Bulletproof Armor  `/obj/item/clothing/suit/armor/bulletproof`   (armor.dm:135)
- armor = melee 15, bullet 60, laser 10, energy 10, bomb 40, bio 0, rad 0, fire 50, acid 50, wound 20  (armor.dm:141)
- strip_delay = 70 (ds), equip_delay_other = 50 (ds)  (armor.dm:142-143)

### Riot Suit  `/obj/item/clothing/suit/armor/riot`   (armor.dm:113)
- armor = melee 50, bullet 10, laser 10, energy 10, bomb 0, bio 0, rad 0, fire 80, acid 80, wound 30  (armor.dm:121)
- body_parts_covered = CHEST|GROIN|LEGS|FEET|ARMS|HANDS  (armor.dm:118)
- clothing_flags = BLOCKS_SHOVE_KNOCKDOWN  (armor.dm:122)
- strip_delay = 80 (ds), equip_delay_other = 60 (ds)  (armor.dm:123-124)

### Blue Laser Tag Armor  `/obj/item/clothing/suit/bluetag`   (miscellaneous.dm:11)
- body_parts_covered = CHEST  (miscellaneous.dm:17)
- allowed = list(/obj/item/gun/energy/laser/bluetag)  (miscellaneous.dm:18)

### Red Laser Tag Armor  `/obj/item/clothing/suit/redtag`   (miscellaneous.dm:21)
- body_parts_covered = CHEST  (miscellaneous.dm:27)
- allowed = list(/obj/item/gun/energy/laser/redtag)  (miscellaneous.dm:28)

## Protective Suits

### Bio Suit (Generic)  `/obj/item/clothing/suit/bio_suit/general`   (bio.dm:35)
- w_class = WEIGHT_CLASS_BULKY  (bio.dm:18)
- gas_transfer_coefficient = 0.01, permeability_coefficient = 0.01  (bio.dm:19-20)
- clothing_flags = THICKMATERIAL  (bio.dm:21)
- body_parts_covered = CHEST|GROIN|LEGS|FEET|ARMS|HANDS  (bio.dm:22)
- slowdown = 0.5  (bio.dm:23)
- armor = melee 0, bullet 0, laser 0, energy 0, bomb 0, bio 100, rad 80, fire 30, acid 100  (bio.dm:25)
- strip_delay = 70 (ds), equip_delay_other = 70 (ds)  (bio.dm:27-28)
- resistance_flags = ACID_PROOF  (bio.dm:29)

### Bio Hood (Generic)  `/obj/item/clothing/head/bio_hood/general`   (bio.dm:32)
- permeability_coefficient = 0.01  (bio.dm:6)
- clothing_flags = THICKMATERIAL | BLOCK_GAS_SMOKE_EFFECT | SNUG_FIT  (bio.dm:7)
- armor = melee 0, bullet 0, laser 0, energy 0, bomb 0, bio 100, rad 80, fire 30, acid 100  (bio.dm:8)
- flags_inv = HIDEMASK|HIDEEARS|HIDEEYES|HIDEHAIR|HIDEFACIALHAIR|HIDEFACE  (bio.dm:9)
- resistance_flags = ACID_PROOF  (bio.dm:10)

### Bio Suit (Virology)  `/obj/item/clothing/suit/bio_suit/virology`   (bio.dm:43)
- Same as general, icon_state = "bio_virology"  (bio.dm:44)

### Bio Hood (Virology)  `/obj/item/clothing/head/bio_hood/virology`   (bio.dm:40)
- Same as general, icon_state = "bio_virology"  (bio.dm:41)

### Bio Suit (Security)  `/obj/item/clothing/suit/bio_suit/security`   (bio.dm:52)
- armor = melee 25, bullet 15, laser 25, energy 35, bomb 25, bio 100, rad 80, fire 30, acid 100  (bio.dm:53)

### Bio Hood (Security)  `/obj/item/clothing/head/bio_hood/security`   (bio.dm:48)
- armor = melee 25, bullet 15, laser 25, energy 35, bomb 25, bio 100, rad 80, fire 30, acid 100  (bio.dm:49)

### Bio Suit (Janitor)  `/obj/item/clothing/suit/bio_suit/janitor`   (bio.dm:64)
- Same base armor as general bio suit

### Bio Hood (Janitor)  `/obj/item/clothing/head/bio_hood/janitor`   (bio.dm:61)
- Same as general hood

### Bio Suit (Scientist)  `/obj/item/clothing/suit/bio_suit/scientist`   (bio.dm:75)
- Same base stats

### Bio Hood (Scientist)  `/obj/item/clothing/head/bio_hood/scientist`   (bio.dm:72)
- Same as general

### Bio Suit (CMO)  `/obj/item/clothing/suit/bio_suit/cmo`   (bio.dm:82)
- Same base stats

### Bio Hood (CMO)  `/obj/item/clothing/head/bio_hood/cmo`   (bio.dm:79)
- Same as general

### Bomb Suit  `/obj/item/clothing/suit/bomb_suit`   (utility.dm:74)
- w_class = WEIGHT_CLASS_BULKY  (utility.dm:79)
- gas_transfer_coefficient = 0.01, permeability_coefficient = 0.01  (utility.dm:80-81)
- clothing_flags = THICKMATERIAL  (utility.dm:82)
- body_parts_covered = CHEST|GROIN|LEGS|FEET|ARMS|HANDS  (utility.dm:83)
- slowdown = 2  (utility.dm:84)
- armor = melee 20, bullet 0, laser 20, energy 30, bomb 100, bio 0, rad 0, fire 80, acid 50  (utility.dm:85)
- heat_protection = CHEST|GROIN|LEGS|FEET|ARMS|HANDS, max_heat_protection_temperature = ARMOR_MAX_TEMP_PROTECT  (utility.dm:87-88)
- cold_protection = CHEST|GROIN|LEGS|FEET|ARMS|HANDS, min_cold_protection_temperature = ARMOR_MIN_TEMP_PROTECT  (utility.dm:89-90)
- strip_delay = 70 (ds), equip_delay_other = 70 (ds)  (utility.dm:91-92)

### Bomb Hood  `/obj/item/clothing/head/bomb_hood`   (utility.dm:55)
- clothing_flags = THICKMATERIAL | SNUG_FIT  (utility.dm:59)
- armor = melee 20, bullet 0, laser 20, energy 30, bomb 100, bio 0, rad 0, fire 80, acid 50  (utility.dm:60)
- flags_inv = HIDEFACE|HIDEMASK|HIDEEARS|HIDEEYES|HIDEHAIR|HIDEFACIALHAIR  (utility.dm:61)
- strip_delay = 70 (ds), equip_delay_other = 70 (ds)  (utility.dm:68-69)

### Bomb Suit (Security)  `/obj/item/clothing/suit/bomb_suit/security`   (utility.dm:100)
- allowed = list(/obj/item/gun/energy, /obj/item/melee/baton, /obj/item/restraints/handcuffs)  (utility.dm:103)

### Bomb Hood (Security)  `/obj/item/clothing/head/bomb_hood/security`   (utility.dm:96)
- Same armor as parent bomb hood

### Radiation Suit  `/obj/item/clothing/suit/radiation`   (utility.dm:131)
- w_class = WEIGHT_CLASS_BULKY  (utility.dm:136)
- gas_transfer_coefficient = 0.9, permeability_coefficient = 0.5  (utility.dm:137-138)
- clothing_flags = THICKMATERIAL  (utility.dm:139)
- body_parts_covered = CHEST|GROIN|LEGS|FEET|ARMS|HANDS  (utility.dm:140)
- allowed = list(/obj/item/flashlight, /obj/item/tank/internals, /obj/item/geiger_counter)  (utility.dm:141)
- slowdown = 1.5  (utility.dm:142)
- armor = melee 0, bullet 0, laser 0, energy 0, bomb 0, bio 60, rad 100, fire 30, acid 30  (utility.dm:143)
- strip_delay = 60 (ds), equip_delay_other = 60 (ds)  (utility.dm:144-145)
- rad_flags = RAD_PROTECT_CONTENTS  (utility.dm:148)

### Radiation Hood  `/obj/item/clothing/head/radiation`   (utility.dm:118)
- clothing_flags = THICKMATERIAL | SNUG_FIT  (utility.dm:122)
- flags_inv = HIDEMASK|HIDEEARS|HIDEFACE|HIDEEYES|HIDEHAIR|HIDEFACIALHAIR  (utility.dm:123)
- armor = melee 0, bullet 0, laser 0, energy 0, bomb 0, bio 60, rad 100, fire 30, acid 30  (utility.dm:124)
- strip_delay = 60 (ds), equip_delay_other = 60 (ds)  (utility.dm:125-126)
- rad_flags = RAD_PROTECT_CONTENTS  (utility.dm:129)

### Fire Suit (Emergency)  `/obj/item/clothing/suit/fire/firefighter`   (utility.dm:34)
- w_class = WEIGHT_CLASS_BULKY  (utility.dm:17)
- gas_transfer_coefficient = 0.9, permeability_coefficient = 0.5  (utility.dm:18-19)
- body_parts_covered = CHEST|GROIN|LEGS|FEET|ARMS|HANDS  (utility.dm:20)
- slowdown = 1  (utility.dm:22)
- armor = melee 15, bullet 5, laser 20, energy 20, bomb 20, bio 10, rad 20, fire 100, acid 50  (utility.dm:23)
- heat_protection = CHEST|GROIN|LEGS|FEET|ARMS|HANDS, max_heat_protection_temperature = FIRE_SUIT_MAX_TEMP_PROTECT  (utility.dm:26-27)
- cold_protection = CHEST|GROIN|LEGS|FEET|ARMS|HANDS, min_cold_protection_temperature = FIRE_SUIT_MIN_TEMP_PROTECT  (utility.dm:28-29)
- strip_delay = 60 (ds), equip_delay_other = 60 (ds)  (utility.dm:30-31)
- resistance_flags = FIRE_PROOF  (utility.dm:32)

### Fire Suit (Atmos)  `/obj/item/clothing/suit/fire/atmos`   (utility.dm:45)
- max_heat_protection_temperature = FIRE_IMMUNITY_MAX_TEMP_PROTECT  (utility.dm:50)

### Ablative Trenchcoat  `/obj/item/clothing/suit/hooded/ablative`   (miscellaneous.dm:694)
- body_parts_covered = CHEST|GROIN|LEGS|ARMS  (miscellaneous.dm:699)
- armor = melee 10, bullet 10, laser 60, energy 60, bomb 0, bio 0, rad 0, fire 100, acid 100  (miscellaneous.dm:700)
- hoodtype = /obj/item/clothing/head/hooded/ablative  (miscellaneous.dm:701)
- strip_delay = 30 (ds), equip_delay_other = 40 (ds)  (miscellaneous.dm:702-703)
- hit_reflect_chance = 50  (miscellaneous.dm:704)
- Interactions: IsReflect() proc returns TRUE if prob(50) on appropriate def_zones

## Job-Specific Wear

### Apron (Botanist)  `/obj/item/clothing/suit/apron`   (jobs.dm:6)
- body_parts_covered = CHEST|GROIN  (jobs.dm:12)
- allowed = list(/obj/item/reagent_containers/spray/plantbgone, /obj/item/plant_analyzer, /obj/item/seeds, /obj/item/reagent_containers/glass/bottle, /obj/item/reagent_containers/glass/beaker, /obj/item/cultivator, /obj/item/reagent_containers/spray/pestspray, /obj/item/hatchet, /obj/item/storage/bag/plants, /obj/item/graft, /obj/item/secateurs, /obj/item/geneshears)  (jobs.dm:13) [summarized: botanist tools]

### Chef's Apron  `/obj/item/clothing/suit/toggle/chef`   (jobs.dm:34)
- body_parts_covered = CHEST|GROIN|ARMS  (jobs.dm:41)
- togglename = "sleeves"  (jobs.dm:43)
- allowed = list(/obj/item/kitchen)  (jobs.dm:42) [kitchen items]

### Trenchcoat (Detective)  `/obj/item/clothing/suit/det_suit`   (jobs.dm:56)
- body_parts_covered = CHEST|GROIN|LEGS|ARMS  (jobs.dm:62)
- armor = melee 25, bullet 10, laser 25, energy 35, bomb 0, bio 0, rad 0, fire 0, acid 45  (jobs.dm:63)
- cold_protection = CHEST|GROIN|LEGS|ARMS, heat_protection = CHEST|GROIN|LEGS|ARMS  (jobs.dm:64-65)

### Hazard Vest  `/obj/item/clothing/suit/hazardvest`   (jobs.dm:84)
- body_parts_covered: not overridden (default from parent if any)
- allowed = list(/obj/item/flashlight, /obj/item/tank/internals/emergency_oxygen, /obj/item/tank/internals/plasmaman, /obj/item/t_scanner, /obj/item/radio)  (jobs.dm:90) [summarized: flashlight, tanks, scanner, radio]
- resistance_flags = NONE  (jobs.dm:91)

### Blue Suit Jacket (Lawyer)  `/obj/item/clothing/suit/toggle/lawyer`   (jobs.dm:94)
- body_parts_covered = CHEST|ARMS  (jobs.dm:100)
- togglename = "buttons"  (jobs.dm:101)

### Captain's Parade Tunic  `/obj/item/clothing/suit/captunic`   (jobs.dm:24)
- body_parts_covered = CHEST|GROIN|LEGS|ARMS  (jobs.dm:29)
- allowed = list(/obj/item/disk, /obj/item/stamp, /obj/item/reagent_containers/food/drinks/flask, /obj/item/melee, /obj/item/storage/lockbox/medal, /obj/item/assembly/flash/handheld, /obj/item/storage/box/matches, /obj/item/lighter, /obj/item/clothing/mask/cigarette, /obj/item/storage/fancy/cigarettes, /obj/item/tank/internals/emergency_oxygen, /obj/item/tank/internals/plasmaman)  (jobs.dm:31) [summarized: captain items, flowers, smokes, tanks]

## Lab Coats and Toggle Suits

### Labcoat  `/obj/item/clothing/suit/toggle/labcoat`   (labcoat.dm:1)
- body_parts_covered = CHEST|ARMS  (labcoat.dm:7)
- allowed = list(/obj/item/analyzer, /obj/item/stack/medical, /obj/item/dnainjector, /obj/item/reagent_containers/dropper, /obj/item/reagent_containers/syringe, /obj/item/reagent_containers/hypospray, /obj/item/healthanalyzer, /obj/item/flashlight/pen, /obj/item/reagent_containers/glass/bottle, /obj/item/reagent_containers/glass/beaker, /obj/item/reagent_containers/pill, /obj/item/storage/pill_bottle, /obj/item/paper, /obj/item/melee/classic_baton/telescopic, /obj/item/soap, /obj/item/sensor_device, /obj/item/tank/internals/emergency_oxygen, /obj/item/tank/internals/plasmaman)  (labcoat.dm:8) [summarized: medical tools, reagents, containers, oxygen]
- armor = melee 0, bullet 0, laser 0, energy 0, bomb 0, bio 50, rad 0, fire 50, acid 50  (labcoat.dm:9)
- togglename = "buttons"  (labcoat.dm:10)

### CMO's Labcoat  `/obj/item/clothing/suit/toggle/labcoat/cmo`   (labcoat.dm:13)
- Inherits from parent labcoat, icon_state = "labcoat_cmo"  (labcoat.dm:16)

### Chemist Labcoat  `/obj/item/clothing/suit/toggle/labcoat/chemist`   (labcoat.dm:36)
- Inherits from parent, icon_state = "labcoat_chem"  (labcoat.dm:39)

### Geneticist Labcoat  `/obj/item/clothing/suit/toggle/labcoat/genetics`   (labcoat.dm:31)
- Inherits from parent, icon_state = "labcoat_gen"  (labcoat.dm:34)

### Paramedic's Jacket  `/obj/item/clothing/suit/toggle/labcoat/paramedic`   (labcoat.dm:19)
- Inherits from parent, icon_state = "labcoat_paramedic"  (labcoat.dm:22)

### Scientist Labcoat  `/obj/item/clothing/suit/toggle/labcoat/science`   (labcoat.dm:46)
- Inherits from parent, icon_state = "labcoat_tox"  (labcoat.dm:48)

### Virologist Labcoat  `/obj/item/clothing/suit/toggle/labcoat/virologist`   (labcoat.dm:41)
- Inherits from parent, icon_state = "labcoat_vir"  (labcoat.dm:44)

### Suspenders (Mime)  `/obj/item/clothing/suit/toggle/suspenders`   (jobs.dm:117)
- togglename = "straps"  (jobs.dm:124)

## Winter Coats (Hooded)

### Winter Coat  `/obj/item/clothing/suit/hooded/wintercoat`   (miscellaneous.dm:539)
- body_parts_covered = CHEST|GROIN|ARMS  (miscellaneous.dm:544)
- cold_protection = CHEST|GROIN|ARMS, min_cold_protection_temperature = FIRE_SUIT_MIN_TEMP_PROTECT  (miscellaneous.dm:545-546)
- armor = melee 0, bullet 0, laser 0, energy 0, bomb 0, bio 10, rad 0, fire 0, acid 0  (miscellaneous.dm:547)
- allowed = list(/obj/item/flashlight, /obj/item/tank/internals/emergency_oxygen, /obj/item/tank/internals/plasmaman, /obj/item/toy, /obj/item/storage/fancy/cigarettes, /obj/item/lighter)  (miscellaneous.dm:548)
- hoodtype = /obj/item/clothing/head/hooded/winterhood  (default)
- Interactions: toggle hood with action or alt-click

### Captain's Winter Coat  `/obj/item/clothing/suit/hooded/wintercoat/captain`   (miscellaneous.dm:560)
- armor = melee 25, bullet 30, laser 30, energy 40, bomb 25, bio 0, rad 0, fire 0, acid 50  (miscellaneous.dm:564)
- hoodtype = /obj/item/clothing/head/hooded/winterhood/captain  (miscellaneous.dm:565)

### Science Winter Coat  `/obj/item/clothing/suit/hooded/wintercoat/science`   (miscellaneous.dm:602)
- armor = melee 0, bullet 0, laser 0, energy 0, bomb 10, bio 0, rad 0, fire 0, acid 0  (miscellaneous.dm:607)
- hoodtype = /obj/item/clothing/head/hooded/winterhood/science  (miscellaneous.dm:608)

## Helmets and Hats

### Hard Hat (Yellow)  `/obj/item/clothing/head/hardhat`   (hardhat.dm:1)
- armor = melee 15, bullet 5, laser 20, energy 10, bomb 20, bio 10, rad 20, fire 100, acid 50  (hardhat.dm:9)
- brightness_on = 4 (luminosity when on)  (hardhat.dm:6)
- on = FALSE  (hardhat.dm:7)
- hat_type = "yellow"  (hardhat.dm:8)
- actions_types = list(/datum/action/item_action/toggle_helmet_light)  (hardhat.dm:11)
- clothing_flags = SNUG_FIT  (hardhat.dm:12)
- resistance_flags = FIRE_PROOF  (hardhat.dm:13)
- Interactions: attack_self or action toggle_helmet_light toggles on/off, sets_light(brightness_on) or set_light(0)
- dog_fashion = /datum/dog_fashion/head  (hardhat.dm:16)

### Hard Hat (White)  `/obj/item/clothing/head/hardhat/white`   (hardhat.dm:70)
- hat_type = "white"  (hardhat.dm:73)
- clothing_flags = STOPSPRESSUREDAMAGE  (hardhat.dm:74)
- heat_protection = HEAD, max_heat_protection_temperature = FIRE_HELM_MAX_TEMP_PROTECT  (hardhat.dm:75-76)
- cold_protection = HEAD, min_cold_protection_temperature = FIRE_HELM_MIN_TEMP_PROTECT  (hardhat.dm:77-78)

### Hard Hat (Orange)  `/obj/item/clothing/head/hardhat/orange`   (hardhat.dm:42)
- hat_type = "orange"  (hardhat.dm:45)

### Hard Hat (Red - Firefighter)  `/obj/item/clothing/head/hardhat/red`   (hardhat.dm:48)
- hat_type = "red"  (hardhat.dm:51)
- name = "firefighter helmet"  (hardhat.dm:53)
- clothing_flags = STOPSPRESSUREDAMAGE  (hardhat.dm:54)
- heat_protection = HEAD, max_heat_protection_temperature = FIRE_HELM_MAX_TEMP_PROTECT  (hardhat.dm:55-56)
- cold_protection = HEAD, min_cold_protection_temperature = FIRE_HELM_MIN_TEMP_PROTECT  (hardhat.dm:57-58)

### Hard Hat (Atmos Firefighter)  `/obj/item/clothing/head/hardhat/atmos`   (hardhat.dm:87)
- hat_type = "atmos"  (hardhat.dm:90)
- name = "atmospheric technician's firefighting helmet"  (hardhat.dm:92)
- clothing_flags = STOPSPRESSUREDAMAGE | THICKMATERIAL | BLOCK_GAS_SMOKE_EFFECT  (hardhat.dm:94)
- flags_inv = HIDEMASK|HIDEEARS|HIDEEYES|HIDEFACE|HIDEHAIR|HIDEFACIALHAIR  (hardhat.dm:95)
- heat_protection = HEAD, max_heat_protection_temperature = FIRE_IMMUNITY_MAX_TEMP_PROTECT  (hardhat.dm:96-97)
- cold_protection = HEAD, min_cold_protection_temperature = FIRE_HELM_MIN_TEMP_PROTECT  (hardhat.dm:98-99)

### Welding Hard Hat  `/obj/item/clothing/head/hardhat/weldhat`   (hardhat.dm:102)
- brightness_on = 3  (hardhat.dm:105)
- actions_types = list(/datum/action/item_action/toggle_helmet_light, /datum/action/item_action/toggle_welding_screen)  (hardhat.dm:107)
- flash_protect = FLASH_PROTECTION_WELDER  (hardhat.dm:108)
- tint = 2  (hardhat.dm:109)
- flags_inv = HIDEEYES | HIDEFACE  (hardhat.dm:110)
- flags_cover = HEADCOVERSEYES | HEADCOVERSMOUTH  (hardhat.dm:111)
- visor_vars_to_toggle = VISOR_FLASHPROTECT | VISOR_TINT  (hardhat.dm:112)
- visor_flags_inv = HIDEEYES | HIDEFACE  (hardhat.dm:113)
- visor_flags_cover = HEADCOVERSEYES | HEADCOVERSMOUTH | PEPPERPROOF  (hardhat.dm:114)
- Interactions: attack_self toggles light, alt-click toggles visor (weldingvisortoggle proc, plays sound)

### Welding Hard Hat (White)  `/obj/item/clothing/head/hardhat/weldhat/white`   (hardhat.dm:149)
- brightness_on = 4  (hardhat.dm:153)
- hat_type = "white"  (hardhat.dm:154)
- clothing_flags = STOPSPRESSUREDAMAGE  (hardhat.dm:155)
- heat_protection = HEAD, max_heat_protection_temperature = FIRE_HELM_MAX_TEMP_PROTECT  (hardhat.dm:156-157)
- cold_protection = HEAD, min_cold_protection_temperature = FIRE_HELM_MIN_TEMP_PROTECT  (hardhat.dm:158-159)

### Welding Helmet  `/obj/item/clothing/head/welding`   (misc_special.dm:16)
- flash_protect = FLASH_PROTECTION_WELDER  (misc_special.dm:23)
- tint = 2  (misc_special.dm:24)
- armor = melee 10, bullet 0, laser 0, energy 0, bomb 0, bio 0, rad 0, fire 100, acid 60  (misc_special.dm:25)
- flags_inv = HIDEMASK|HIDEEARS|HIDEEYES|HIDEFACE  (misc_special.dm:26)
- actions_types = list(/datum/action/item_action/toggle)  (misc_special.dm:27)
- visor_flags_inv = HIDEMASK|HIDEEARS|HIDEEYES|HIDEFACE  (misc_special.dm:28)
- visor_flags_cover = HEADCOVERSEYES | HEADCOVERSMOUTH | PEPPERPROOF  (misc_special.dm:29)
- resistance_flags = FIRE_PROOF  (misc_special.dm:30)
- Interactions: attack_self toggles visor (weldingvisortoggle proc)

### Security Helmet  `/obj/item/clothing/head/helmet/sec`   (helmet.dm:48)
- can_flashlight = TRUE  (helmet.dm:49)

### Helmet (Alt - Bulletproof)  `/obj/item/clothing/head/helmet/alt`   (helmet.dm:67)
- armor = melee 15, bullet 60, laser 10, energy 10, bomb 40, bio 0, rad 0, fire 50, acid 50  (helmet.dm:72)
- can_flashlight = TRUE  (helmet.dm:73)

### Riot Helmet  `/obj/item/clothing/head/helmet/riot`   (helmet.dm:88)
- armor = melee 50, bullet 10, laser 10, energy 10, bomb 0, bio 0, rad 0, fire 80, acid 80  (helmet.dm:96)
- toggle_message = "You pull the visor down on", alt_toggle_message = "You push the visor up on"  (helmet.dm:93-94)
- can_toggle = 1  (helmet.dm:95)
- flags_inv = HIDEEARS|HIDEFACE  (helmet.dm:97)
- actions_types = list(/datum/action/item_action/toggle)  (helmet.dm:99)
- visor_flags_inv = HIDEFACE  (helmet.dm:100)
- flags_cover = HEADCOVERSEYES | HEADCOVERSMOUTH | PEPPERPROOF  (helmet.dm:102)
- visor_flags_cover = HEADCOVERSEYES | HEADCOVERSMOUTH | PEPPERPROOF  (helmet.dm:103)
- Interactions: attack_self toggles visor (up/down), message sent to user

### Captain's Hat  `/obj/item/clothing/head/caphat`   (jobs.dm:28)
- armor = melee 25, bullet 15, laser 25, energy 35, bomb 25, bio 0, rad 0, fire 50, acid 50  (jobs.dm:34)
- strip_delay = 60 (ds)  (jobs.dm:35)

### Captain's Parade Cap  `/obj/item/clothing/head/caphat/parade`   (jobs.dm:39)
- dog_fashion = null  (jobs.dm:44)

### Head of Personnel's Cap  `/obj/item/clothing/head/hopcap`   (jobs.dm:48)
- armor = melee 25, bullet 15, laser 25, energy 35, bomb 25, bio 0, rad 0, fire 50, acid 50  (jobs.dm:52)

### Chef's Hat  `/obj/item/clothing/head/chefhat`   (jobs.dm:8)
- strip_delay = 10 (ds), equip_delay_other = 10 (ds)  (jobs.dm:13-14)
- dog_fashion = /datum/dog_fashion/head/chef  (jobs.dm:16)

### Warden's Police Hat  `/obj/item/clothing/head/warden`   (jobs.dm:161)
- armor = melee 40, bullet 30, laser 30, energy 40, bomb 25, bio 0, rad 0, fire 30, acid 60  (jobs.dm:165)
- strip_delay = 60 (ds)  (jobs.dm:166)

### Warden's Campaign Hat  `/obj/item/clothing/head/warden/drill`   (jobs.dm:169)
- Interactions: screwdriver cycles voice modes (default -> shouting -> yelling -> default), wirecutter breaks circuit to canadian mode  (jobs.dm:177-199)
- Messages: "You set the voice circuit to the middle position." / "last position" / "first position" / "voice circuit but nothing happens"  (jobs.dm:182-191)
- Modifies wearer's speech based on mode  (jobs.dm:212-235)

### Head of Security Beret  `/obj/item/clothing/head/hos/beret`   (jobs.dm:152)
- armor = melee 40, bullet 30, laser 25, energy 35, bomb 25, bio 10, rad 0, fire 50, acid 60  (jobs.dm:144, parent /obj/item/clothing/head/hos)

### Warden's Beret  `/obj/item/clothing/head/beret/sec/navywarden`   (jobs.dm:250)
- armor = melee 40, bullet 30, laser 30, energy 40, bomb 25, bio 0, rad 0, fire 30, acid 50  (jobs.dm:254)

### Detective's Fedora  `/obj/item/clothing/head/fedora/det_hat`   (jobs.dm:69)
- armor = melee 25, bullet 5, laser 25, energy 35, bomb 0, bio 0, rad 0, fire 30, acid 50  (jobs.dm:72)
- pocket_storage_component_path = /datum/component/storage/concrete/pockets/small/fedora/detective  (jobs.dm:75)
- Interactions: Initialize creates /obj/item/reagent_containers/food/drinks/flask/det inside (file:80), Alt-click with cooldown takes candy corn from hat (cooldown 1200 = 120 ds) (file:86-96)

### French Beret  `/obj/item/clothing/head/frenchberet`   (todo list)
- (Not found in main files; likely in beret subtypes in jobs.dm)

### Bear Pelt Hat  `/obj/item/clothing/head/bearpelt`   (misc.dm:197)
- (Generic hat with no special mechanics)

### Mailman's Hat  `/obj/item/clothing/head/mailman`   (misc.dm:43)
- (Generic hat)

### Radiation Hood  `/obj/item/clothing/head/radiation`   (Already covered in Protective Suits)

### Soft Caps (Various Colors)  `/obj/item/clothing/head/soft` and variants (soft_caps.dm)
- Flippable cap: Alt-click flips cap backwards/forwards (flip proc message: "You flip the hat backwards." / "forwards.")  (soft_caps.dm:32-41)
- Variants: /red, /blue, /green, /yellow, /grey, /orange, /mime (white), /purple, /black, /rainbow, /sec (security), /paramedic  (soft_caps.dm:47-131)

## Misc Coats and Suits

### Straight Jacket  `/obj/item/clothing/suit/straight_jacket`   (miscellaneous.dm:351)
- body_parts_covered = CHEST|GROIN|LEGS|ARMS|HANDS  (miscellaneous.dm:356)
- flags_inv = HIDEGLOVES|HIDESHOES|HIDEJUMPSUIT  (miscellaneous.dm:357)
- clothing_flags = DANGEROUS_OBJECT  (miscellaneous.dm:358)
- equip_delay_self = 50 (ds)  (miscellaneous.dm:359)
- strip_delay = 60 (ds)  (miscellaneous.dm:360)
- breakouttime = 3000 (ds)  (miscellaneous.dm:361)

### Worn Shirt (Ian Shirt)  `/obj/item/clothing/suit/ianshirt`   (miscellaneous.dm:363)
- (Flavor item, no special mechanics)

## Coverage

**List entries:** 96  
**Documented with real data:** 95  
**NOT FOUND:** 1 path (/obj/item/clothing/head/frenchberet - appears in todo list but not located in grepped files; may be nested type or in alternative file)

## Minimum viable port

- Hardsuit helmet light toggle (on/off) with brightness_on luminosity setting and visual icon_state changes
- Hardsuit helmet can be separated from suit via toggle action; helmettype points to correct helmet type
- Hardsuit allows jetpack and light bulb installation/removal via attackby() with do_after() delays
- Space suit thermal regulator: toggle action, cell management (cover open/close), temperature adjustment via screwdriver input, per-tick power consumption (18 cost)
- Armor values on all worn items reflect TG2020 values: every type (melee/bullet/laser/energy/bomb/bio/rad/fire/acid/wound) is numeric
- Clothing_flags control pressure/temperature protection: STOPSPRESSUREDAMAGE, THICKMATERIAL, cold/heat_protection with min/max limits
- Toggle suits (labcoats, chef apron, suspenders, winter coats): suit_toggle() action changes icon_state and shows message
- Hardhat and welding hat toggle lights and visors separately; weldingvisortoggle() proc controls visor flip
- Bio/bomb/radiation/fire suits have slowdown and full body coverage with varied armor profiles
- Hooded suits spawn hood on equip and can toggle hood on/off; hood inherits parent armor stats when specified

## NOT FOUND / open questions

- `/obj/item/clothing/head/frenchberet`: Listed in todo as "french beret" but not found in headwear files; may be a naming error or nested in beret parent type variants (beret/sec subtypes exist but not specific frenchberet entry found)
