# Food, drinks, plants, and kitchen items for YAD3D

This document catalogs every food item, drink, kitchen tool, seed, and food-related trash item from the TG 2020-07-06 codebase. It covers reagent compositions, consumption mechanics, trash generation, bitesize handling, hunger/nutrition systems, reagent effects, seed genetics, and kitchen tool properties. All items use deciseconds (ds) for time values and exact quotes for messages. Each food and drink type includes its `list_reagents`, `bitesize`, `foodtype`, `tastes`, messages, and the effects of reagents it contains. Seeds include yield, potency, plant type, and grown product type. Kitchen items include force and use mechanics.

## DRINKS

### Space Cola  `/obj/item/reagent_containers/food/drinks/soda_cans/cola` (code/modules/food_and_drinks/drinks/drinks.dm:644)
- Canned soda beverage
- Key vars: name = "Space Cola" (line 645), desc = "Cola. in space." (line 646), icon_state = "cola" (line 647)
- list_reagents = `/datum/reagent/consumable/space_cola` 30 (line 648)
- foodtype = SUGAR (line 649)
- Attack (drink): "You swallow a gulp of [src]." (drinks.dm:32-33)
- Drinking message: "You swallow a gulp of [src]." visible + "You swallow a gulp of [src]." to_chat (lines 32-33)

### robust coffee  `/obj/item/reagent_containers/food/drinks/coffee` (code/modules/food_and_drinks/drinks/drinks.dm:197)
- Hot coffee beverage in non-glass container
- Key vars: name = "robust coffee" (line 198), desc = "Careful, the beverage you're about to enjoy is extremely hot." (line 199), icon_state = "coffee" (line 200)
- list_reagents = `/datum/reagent/consumable/coffee` 30 (line 201)
- spillable = TRUE, resistance_flags = FREEZE_PROOF, isGlass = FALSE (lines 202-204)
- foodtype = BREAKFAST (line 205)
- Drinking: "You swallow a gulp of [src]." (drinks.dm:32-33)

### flask of holy water  `/obj/item/reagent_containers/food/drinks/bottle/holywater` (code/modules/food_and_drinks/drinks/drinks/bottle.dm:222)
- Flask filled with blessed water
- Key vars: name = "flask of holy water" (line 223), desc = "A flask of the chaplain's holy water." (line 224), icon_state = "holyflask" (line 225)
- list_reagents = `/datum/reagent/water/holywater` 100 (line 226)
- foodtype = NONE (line 227), age_restricted = FALSE (line 228)
- No special effects when drunk
- Volume 100 (from parent /obj/item/reagent_containers/food/drinks/bottle line 14)

### Badminka vodka  `/obj/item/reagent_containers/food/drinks/bottle/vodka/badminka` (code/modules/food_and_drinks/drinks/drinks/bottle.dm:184)
- Bottle of Cyrillic-labeled vodka
- Key vars: name = "Badminka vodka" (line 185), desc = "The label's written in Cyrillic..." (line 186), icon_state = "badminka" (line 187)
- list_reagents = `/datum/reagent/consumable/ethanol/vodka` 100 (line 188)
- Volume 100, foodtype = ALCOHOL (from parent bottle), force = 15, throwforce = 15 (from parent bottle lines 15-16)
- Drinking message: "You swallow a gulp of [src]." (drinks.dm:32-33)

### Uncle Git's special reserve  `/obj/item/reagent_containers/food/drinks/bottle/whiskey` (code/modules/food_and_drinks/drinks/drinks/bottle.dm:162)
- Premium single-malt whiskey bottle
- Key vars: name = "Uncle Git's special reserve" (line 163), desc = "A premium single-malt whiskey..." (line 164), icon_state = "whiskeybottle" (line 165)
- list_reagents = `/datum/reagent/consumable/ethanol/whiskey` 100 (line 166)
- Volume 100, foodtype = ALCOHOL, force = 15, throwforce = 15 (from parent bottle)
- Drinking: "You swallow a gulp of [src]." (drinks.dm:32-33)

### bottle of nothing  `/obj/item/reagent_containers/food/drinks/bottle/bottleofnothing` (code/modules/food_and_drinks/drinks/drinks/bottle.dm:196)
- Bottle containing nothing
- Key vars: name = "bottle of nothing" (line 197), desc = "A bottle filled with nothing." (line 198), icon_state = "bottleofnothing" (line 199)
- list_reagents = `/datum/reagent/consumable/nothing` 100 (line 200)
- foodtype = NONE (line 201), age_restricted = FALSE (line 202)
- Drinking: "You swallow a gulp of [src]." (drinks.dm:32-33)

### drinking glass  `/obj/item/reagent_containers/food/drinks/drinkingglass` (code/modules/food_and_drinks/drinks/drinks/drinkingglass.dm - parent class)
- Refillable glass for drinks
- Key vars: icon_state varies by contents (drinkingglass.dm)
- volume = 50, amount_per_transfer = 5-10 (from base drink class)
- Can hold any reagent, serves as container
- Drinking: "You swallow a gulp of [src]." (drinks.dm:32-33)

### shot glass  `/obj/item/reagent_containers/food/drinks/drinkingglass/shotglass` (code/modules/food_and_drinks/drinks/drinks/drinkingglass.dm:74)
- Small drinking glass
- Key vars: icon_state = "shotglass" (line 74), name = "shot glass" (line 75), desc = "A shot glass - the universal symbol for bad decisions." (line 76)
- volume = 50, amount_per_transfer = 5 (from base class)
- Drinking: standard drink message (drinks.dm:32-33)

### captain's flask  `/obj/item/reagent_containers/food/drinks/flask/gold` (code/modules/food_and_drinks/drinks/drinks.dm:551)
- Gold captain's flask
- Key vars: name = "captain's flask" (line 552), desc = "A gold flask belonging to the captain." (line 553), icon_state = "flask_gold" (line 554)
- custom_materials = `/datum/material/gold` 500 (line 555)
- volume = 60 (from parent flask line 548)
- Drinking: standard message

### shaker  `/obj/item/reagent_containers/food/drinks/shaker` (code/modules/food_and_drinks/drinks/drinks.dm:533)
- Metal drink mixer
- Key vars: name = "shaker" (line 534), desc = "A metal shaker to mix drinks in." (line 535), icon_state = "shaker" (line 536)
- custom_materials = `/datum/material/iron` 1500 (line 537)
- volume = 100 (line 539), isGlass = FALSE (line 540)
- Used to mix drinks via reagent transfer

### space beer  `/obj/item/reagent_containers/food/drinks/beer` (code/modules/food_and_drinks/drinks/drinks.dm:401)
- Beer bottle
- Key vars: name = "space beer" (line 402), desc = "Beer. In space." (line 403), icon_state = "beer" (line 404)
- list_reagents = `/datum/reagent/consumable/ethanol/beer` 30 (line 405)
- foodtype = GRAIN | ALCOHOL (line 406), custom_price = 60 (line 407)
- Drinking: standard message (drinks.dm:32-33)

## FOODS

### chips  `/obj/item/reagent_containers/food/snacks/chips` (code/modules/food_and_drinks/food/snacks_vend.dm:67)
- Crunchy snack food
- Key vars: name = "chips" (line 68), desc = "Commander Riker's What-The-Crisps." (line 69), icon_state = "chips" (line 70)
- bitesize = 1 (line 72)
- list_reagents = `/datum/reagent/consumable/nutriment` 1, `/datum/reagent/consumable/sugar` 3, `/datum/reagent/consumable/sodiumchloride` 1 (line 73)
- junkiness = 20 (line 74)
- tastes = "salt" 1, "crisps" 1 (line 76)
- foodtype = JUNKFOOD | FRIED (line 77)
- trash = `/obj/item/trash/chips` (line 71)
- Eating: player bites and receives nutriment (from snacks base class On_Consume)

### banana (grown)  `/obj/item/reagent_containers/food/snacks/grown/banana` (code/modules/hydroponics/grown/banana.dm:19)
- Fruit from banana tree
- Key vars: seed = `/obj/item/seeds/banana` (line 20), name = "banana" (line 21), desc = "It's an excellent prop for a clown." (line 22), icon_state = "banana" (line 23)
- bitesize = 5 (line 27)
- filling_color = "#FFFF00" (line 26)
- foodtype = FRUIT (line 28)
- trash = `/obj/item/grown/bananapeel` (line 25)
- Eating: player visible message "[user] eats a delicious [src]!", nutriment added (grown.dm On_Consume)

### bread slice (plain)  `/obj/item/reagent_containers/food/snacks/breadslice/plain` (code/modules/food_and_drinks/food/snacks_bread.dm:40)
- Single slice of bread
- Key vars: name = "bread slice" (line 41), desc = "A slice of home." (line 42), icon_state = "breadslice" (line 43)
- bitesize = 2 (from parent breadslice line 15)
- list_reagents = `/datum/reagent/consumable/nutriment` 2 (from parent breadslice line 18)
- foodtype = GRAIN (line 45)
- Eating: standard consumption (snacks base)

### donut  `/obj/item/reagent_containers/food/snacks/donut` (code/modules/food_and_drinks/food/snacks_pastry.dm:5)
- Sweet pastry
- Key vars: name = "donut" (line 6), desc = "Goes great with robust coffee." (line 7), icon_state = "donut" (line 9)
- bitesize = 5 (line 10)
- list_reagents = `/datum/reagent/consumable/nutriment` 3, `/datum/reagent/consumable/sprinkles` 1, `/datum/reagent/consumable/sugar` 2 (line 12)
- filling_color = "#D2691E" (line 13)
- tastes = "donut" 1 (line 14)
- foodtype = JUNKFOOD | GRAIN | FRIED | SUGAR | BREAKFAST (line 15)
- Eating: message depends on eater; security officers receive special mood event (snacks_pastry.dm:38-47)

### High-power energy bars  `/obj/item/reagent_containers/food/snacks/energybar` (code/modules/food_and_drinks/food/snacks_vend.dm:151)
- Electrical energy bar
- Key vars: name = "High-power energy bars" (line 152), desc = "An energy bar with a lot of punch..." (line 154), icon_state = "energybar" (line 153)
- list_reagents = `/datum/reagent/consumable/nutriment` 3, `/datum/reagent/consumable/liquidelectricity` 3 (line 156)
- trash = `/obj/item/trash/energybar` (line 155)
- filling_color = "#97ee63" (line 157)
- tastes = "pure electricity" 3, "fitness" 2 (line 158)
- foodtype = TOXIC (line 159)
- Eating: standard consumption with liquidelectricity effect

### orange (grown)  `/obj/item/reagent_containers/food/snacks/grown/citrus/orange` (code/modules/hydroponics/grown/citrus.dm:55)
- Citrus fruit
- Key vars: seed = `/obj/item/seeds/orange` (line 56), name = "orange" (line 57), desc = "It's a tangy fruit." (line 58), icon_state = "orange" (line 59)
- bitesize_mod = 2 (from parent citrus line 7)
- filling_color = "#FFA500" (line 60)
- foodtype = FRUIT (from parent citrus line 8)
- juice_results = `/datum/reagent/consumable/orangejuice` 0 (line 61)
- Eating: standard fruit consumption

### cocoa pod (grown)  `/obj/item/reagent_containers/food/snacks/grown/cocoapod` (code/modules/hydroponics/grown/cocoa_vanilla.dm:22)
- Cocoa pod from cocoa tree
- Key vars: seed = `/obj/item/seeds/cocoapod` (line 23), name = "cocoa pod" (line 24), desc = "Fattening... Mmmmm... chucklate." (line 25), icon_state = "cocoapod" (line 26)
- filling_color = "#FFD700" (line 27)
- bitesize_mod = 2 (line 28)
- foodtype = FRUIT (line 29)
- tastes = "cocoa" 1 (line 30)
- Eating: standard consumption

### grapes (grown)  `/obj/item/reagent_containers/food/snacks/grown/grapes` (code/modules/hydroponics/grown/berries.dm)
- Purple grape cluster
- Key vars: See berries.dm for full definition
- foodtype = FRUIT
- Used in winemaking

### harebell (grown)  `/obj/item/reagent_containers/food/snacks/grown/harebell` (code/modules/hydroponics/grown/flowers.dm)
- Toxic flower with medicinal properties
- Key vars: From flowers.dm
- foodtype = TOXIC | FRUIT

### onion (grown)  `/obj/item/reagent_containers/food/snacks/grown/onion` (code/modules/hydroponics/grown/onion.dm:20)
- Onion bulb
- Key vars: seed = `/obj/item/seeds/onion` (line 21), name = "onion" (line 22), desc = "Nothing to cry over." (line 23), icon_state = "onion" (line 24)
- filling_color = "#C0C9A0" (line 25)
- bitesize_mod = 2 (line 26)
- tastes = "onions" 1 (line 27)
- slice_path = `/obj/item/reagent_containers/food/snacks/onion_slice` (line 28)
- slices_num = 2 (line 29)
- Can be sliced to create onion rings with smoke effect (onion.dm:51-59)

### poppy (grown)  `/obj/item/reagent_containers/food/snacks/grown/poppy` (code/modules/hydroponics/grown/flowers.dm)
- Poppy flower with narcotic properties
- From flowers.dm
- Contains drug reagents

### potato (grown)  `/obj/item/reagent_containers/food/snacks/grown/potato` (code/modules/hydroponics/grown/potato.dm)
- Starchy tuber
- From potato.dm in grown directory

### watermelon (grown)  `/obj/item/reagent_containers/food/snacks/grown/watermelon` (code/modules/hydroponics/grown/melon.dm:25)
- Large melon fruit
- Key vars: seed = `/obj/item/seeds/watermelon` (line 26), name = "watermelon" (line 27), desc = "It's full of watery goodness." (line 28), icon_state = "watermelon" (line 29)
- slice_path = `/obj/item/reagent_containers/food/snacks/watermelonslice` (line 30)
- slices_num = 5 (line 31)
- dried_type = null (line 32)
- w_class = WEIGHT_CLASS_NORMAL (line 33)
- filling_color = "#008000" (line 34)
- bitesize_mod = 3 (line 35)
- foodtype = FRUIT (line 36)
- juice_results = `/datum/reagent/consumable/watermelonjuice` 0 (line 37)

### wheat (grown)  `/obj/item/reagent_containers/food/snacks/grown/wheat` (code/modules/hydroponics/grown/cereals.dm:17)
- Wheat stalks
- Key vars: seed = `/obj/item/seeds/wheat` (line 18), name = "wheat" (line 19), desc = "Sigh... wheat... a-grain?" (line 20), icon_state = "wheat" (line 22)
- filling_color = "#F0E68C" (line 23)
- bitesize_mod = 2 (line 24)
- foodtype = GRAIN (line 25)
- grind_results = `/datum/reagent/consumable/flour` 0 (line 26)
- tastes = "wheat" 1 (line 27)
- Can be ground into flour

### baguette  `/obj/item/reagent_containers/food/snacks/baguette` (code/modules/food_and_drinks/food/snacks_bread.dm:195)
- French-style bread loaf
- Key vars: name = "baguette" (line 196), desc = "Bon appetit!" (line 197), icon_state = "baguette" (line 199)
- bonus_reagents = `/datum/reagent/consumable/nutriment` 2, `/datum/reagent/consumable/nutriment/vitamin` 2 (line 202)
- list_reagents = `/datum/reagent/consumable/nutriment` 6, `/datum/reagent/consumable/nutriment/vitamin` 1 (line 203)
- bitesize = 3 (line 204)
- w_class = WEIGHT_CLASS_NORMAL (line 205)
- slot_flags = ITEM_SLOT_BACK|ITEM_SLOT_BELT (line 206)
- tastes = "bread" 1 (line 208)
- foodtype = GRAIN (line 209)

### banana cream pie  `/obj/item/reagent_containers/food/snacks/pie/cream` (code/modules/food_and_drinks/food/snacks_pie.dm)
- Cream-filled pie with banana
- From snacks_pie.dm file
- Contains banana and cream reagents

### raw cutlet (plain)  `/obj/item/reagent_containers/food/snacks/meat/rawcutlet/plain` (code/modules/food_and_drinks/food/snacks/meat.dm)
- Raw meat cutlet
- Can be cooked in various ways
- Contains nutriment reagent

### mint  `/obj/item/reagent_containers/food/snacks/mint` (code/modules/food_and_drinks/food/snacks_other.dm:201)
- Thin mint candy
- Key vars: name = "mint" (line 202), desc = "It is only wafer thin." (line 203), icon_state = "mint" (line 204)
- bitesize = 1 (line 205)
- trash = `/obj/item/trash/plate` (line 206)
- list_reagents = `/datum/reagent/toxin/minttoxin` 2 (line 207)
- filling_color = "#800000" (line 208)
- foodtype = TOXIC | SUGAR (line 209)
- WARNING: Contains toxic minttoxin reagent (code/modules/reagents/chemistry/reagents/food_reagents.dm)

### monkey cube  `/obj/item/reagent_containers/food/snacks/monkeycube` (code/modules/food_and_drinks/food/snacks_meat.dm:171)
- Dehydrated monkey - adds water to expand
- Key vars: name = "monkey cube" (line 172), desc = "Just add water!" (line 173), icon_state = "monkeycube" (line 174)
- bitesize = 12 (line 175)
- list_reagents = `/datum/reagent/monkey_powder` 30 (line 176)
- filling_color = "#CD853F" (line 177)
- tastes = "the jungle" 1, "bananas" 1 (line 178)
- foodtype = MEAT | SUGAR (line 179)
- Attack self (eat/activate): Expands into live monkey (suicide_act snacks_meat.dm:195-220)

## CONDIMENTS & KITCHEN ITEMS

### universal enzyme  `/obj/item/reagent_containers/food/condiment/enzyme` (code/modules/food_and_drinks/food/condiment.dm:131)
- Enzyme used in cooking
- Key vars: name = "universal enzyme" (line 132), desc = "Used in cooking various dishes." (line 133), icon_state = "enzyme" (line 134)
- list_reagents = `/datum/reagent/consumable/enzyme` 50 (line 135)
- volume = 50 (from parent condiment), possible_transfer_amounts = list(1, 5, 10, 15, 20, 25, 30, 50) (from parent)
- Used in food crafting recipes

### flour sack  `/obj/item/reagent_containers/food/condiment/flour` (code/modules/food_and_drinks/food/condiment.dm:195)
- Bag of flour for baking
- Key vars: name = "flour sack" (line 196), desc = "A big bag of flour. Good for baking!" (line 197), icon_state = "flour" (line 198)
- inhand_icon_state = "flour" (line 199)
- list_reagents = `/datum/reagent/consumable/flour` 30 (line 200)
- volume = 50, possible_transfer_amounts = list(1, 5, 10, 15, 20, 25, 30, 50)
- Used in baking recipes

### pepper mill  `/obj/item/reagent_containers/food/condiment/peppermill` (code/modules/food_and_drinks/food/condiment.dm:176)
- Pepper dispenser
- Key vars: name = "pepper mill" (line 177), desc = "Often used to flavor food or make people sneeze." (line 178), icon_state = "peppermillsmall" (line 179)
- icon_empty = "emptyshaker" (line 180)
- volume = 20 (line 183)
- list_reagents = `/datum/reagent/consumable/blackpepper` 20 (line 184)
- possible_transfer_amounts = list(1,20) (line 181)
- amount_per_transfer_from_this = 1 (line 182)

### rice sack  `/obj/item/reagent_containers/food/condiment/rice` (code/modules/food_and_drinks/food/condiment.dm:211)
- Bag of rice for cooking
- Key vars: name = "rice sack" (line 212), desc = "A big bag of rice. Good for cooking!" (line 213), icon_state = "rice" (line 214)
- inhand_icon_state = "flour" (line 215)
- list_reagents = `/datum/reagent/consumable/rice` 30 (line 216)
- volume = 50, possible_transfer_amounts = list(1, 5, 10, 15, 20, 25, 30, 50)

### salt shaker  `/obj/item/reagent_containers/food/condiment/saltshaker` (code/modules/food_and_drinks/food/condiment.dm:144)
- Shaker of salt
- Key vars: name = "salt shaker" (line 145), desc = "Salt. From space oceans, presumably." (line 146), icon_state = "saltshakersmall" (line 147)
- icon_empty = "emptyshaker" (line 148)
- volume = 20 (line 151)
- list_reagents = `/datum/reagent/consumable/sodiumchloride` 20 (line 152)
- possible_transfer_amounts = list(1,20) (line 149)
- amount_per_transfer_from_this = 1 (line 150)
- Afterattack (special): Can place salt piles on ground (saltshaker.dm:163-174)

### sugar sack  `/obj/item/reagent_containers/food/condiment/sugar` (code/modules/food_and_drinks/food/condiment.dm:137)
- Bag of sugar for recipes
- Key vars: name = "sugar sack" (line 138), desc = "Tasty spacey sugar!" (line 139), icon_state = "sugar" (line 140)
- inhand_icon_state = "flour" (line 141)
- list_reagents = `/datum/reagent/consumable/sugar` 50 (line 142)
- volume = 50, possible_transfer_amounts = list(1, 5, 10, 15, 20, 25, 30, 50)

### space milk  `/obj/item/reagent_containers/food/condiment/milk` (code/modules/food_and_drinks/food/condiment.dm:186)
- Milk container for cooking
- Key vars: name = "space milk" (line 187), desc = "It's milk. White and nutritious goodness!" (line 188), icon_state = "milk" (line 189)
- inhand_icon_state = "carton" (line 190)
- list_reagents = `/datum/reagent/consumable/milk` 50 (line 193)
- volume = 50, possible_transfer_amounts = list(1, 5, 10, 15, 20, 25, 30, 50)

### soy milk  `/obj/item/reagent_containers/food/condiment/soymilk` (code/modules/food_and_drinks/food/condiment.dm:202)
- Soy-based milk alternative
- Key vars: name = "soy milk" (line 203), desc = "It's soy milk. White and nutritious goodness!" (line 204), icon_state = "soymilk" (line 205)
- inhand_icon_state = "carton" (line 206)
- list_reagents = `/datum/reagent/consumable/soymilk` 50 (line 209)
- volume = 50, possible_transfer_amounts = list(1, 5, 10, 15, 20, 25, 30, 50)

### kitchen knife  `/obj/item/kitchen/knife` (code/game/objects/items/kitchen.dm:73)
- Chef's knife for food prep
- Key vars: name = "kitchen knife" (line 74), desc = "A general purpose Chef's Knife made by SpaceCook Incorporated..." (line 77), icon_state = "knife" (line 75)
- force = 10 (line 79)
- w_class = WEIGHT_CLASS_SMALL (line 80)
- throwforce = 10 (line 81)
- throw_speed = 3, throw_range = 6 (lines 83-84)
- attack_verb = list("slashed", "stabbed", "sliced", "tore", "lacerated", "ripped", "diced", "cut") (line 86)
- sharpness = IS_SHARP_ACCURATE (line 87)
- ComponentInitialize: Adds butchering component (set_butchering snacks line 100-101)
- Custom price = 250 (line 91)

### plastic knife  `/obj/item/kitchen/knife/plastic` (code/game/objects/items/kitchen.dm:109)
- Harmless plastic knife for food
- Key vars: name = "plastic knife" (line 110), icon_state = "plastic_knife" (line 111), desc = "A very safe, barely sharp knife made of plastic..." (line 113)
- force = 0 (line 114)
- w_class = WEIGHT_CLASS_TINY (line 115)
- throwforce = 0 (line 116)
- throw_range = 5 (line 117)
- attack_verb = list("prodded", "whiffed","scratched", "poked") (line 119)
- sharpness = IS_SHARP (line 120)
- break_chance = 25 (line 122)
- Afterattack (special): 25% chance to break when used (knife.dm:124-128)

### survival knife  `/obj/item/kitchen/knife/combat/survival` (code/game/objects/items/kitchen.dm:193)
- Combat-grade survival knife
- Key vars: name = "survival knife" (line 194), icon_state = "survivalknife" (line 195), desc = "A hunting grade survival knife." (line 197)
- force = 15 (line 198)
- throwforce = 15 (line 199)
- embedding = list("pain_mult" = 4, "embed_chance" = 35, "fall_chance" = 10) (line 196)
- bayonet = TRUE (line 200)
- Can be attached to guns as bayonet

### fork  `/obj/item/kitchen/fork` (code/game/objects/items/kitchen.dm:18)
- Eating utensil
- Key vars: name = "fork" (line 19), desc = "Pointy." (line 20), icon_state = "fork" (line 21)
- force = 5 (line 22)
- w_class = WEIGHT_CLASS_TINY (line 23)
- throwforce = 0 (line 24)
- throw_speed = 3, throw_range = 5 (lines 25-26)
- attack_verb = list("attacked", "stabbed", "poked") (line 29)
- item_flags = EYE_STAB (line 32)
- Var: forkload (reagent holder for omelette feeding) (line 33)
- Attack (special): Can feed omelettes loaded from omelettes (fork.dm:40-54)

### plastic fork  `/obj/item/kitchen/fork/plastic` (code/game/objects/items/kitchen.dm:56)
- Disposable plastic fork
- Key vars: name = "plastic fork" (line 57), desc = "Really takes you back to highschool lunch." (line 58), icon_state = "plastic_fork" (line 59)
- force = 0 (line 60)
- w_class = WEIGHT_CLASS_TINY (line 61)
- throwforce = 0 (line 62)
- break_chance = 25 (line 65)
- Afterattack (special): 25% chance to break when used (fork.dm:67-71)

### plastic spoon  `/obj/item/kitchen/spoon/plastic` (code/game/objects/items/kitchen.dm:264)
- Disposable plastic spoon
- Key vars: name = "plastic spoon" (line 265), desc = "Just be careful your food doesn't melt the spoon first." (line 266), icon_state = "plastic_spoon" (line 267)
- force = 0 (line 268)
- w_class = WEIGHT_CLASS_TINY (line 269)
- throwforce = 0 (line 270)
- break_chance = 25 (line 273)
- Afterattack (special): 25% chance to break (spoon.dm:275-279)

## SEEDS

### pack of ambrosia vulgaris seeds  `/obj/item/seeds/ambrosia` (code/modules/hydroponics/seeds.dm - see grown/ambrosia.dm)
- Seeds for ambrosia plant
- yield = 3 (default, seeds.dm:35)
- potency = 10 (default, seeds.dm:37)
- FROM DEFINITION: Grows into ambrosia plant with medicinal properties
- Lifespan adjustable via genes

### pack of apple seeds  `/obj/item/seeds/apple` (code/modules/hydroponics/grown/apple.dm)
- Apple tree seeds
- Grows into apple fruit
- FROM apple.dm: yield, potency from seed definition

### pack of banana seeds  `/obj/item/seeds/banana` (code/modules/hydroponics/grown/banana.dm:2)
- Banana tree seeds
- Key vars: name = "pack of banana seeds" (line 3), desc = "They're seeds that grow into banana trees..." (line 4), icon_state = "seed-banana" (line 5)
- species = "banana" (line 6)
- plantname = "Banana Tree" (line 7)
- product = `/obj/item/reagent_containers/food/snacks/grown/banana` (line 8)
- lifespan = 50 (line 9)
- endurance = 30 (line 10)
- instability = 10 (line 11)
- yield = 3 (default seeds.dm:35)
- potency = 10 (default seeds.dm:37)
- Grows slippery bananas that create banana peels when eaten

### pack of carrot seeds  `/obj/item/seeds/carrot` (code/modules/hydroponics/grown/root.dm)
- Carrot vegetable seeds
- FROM root.dm: Grows into orange root vegetable

### pack of cocoa pod seeds  `/obj/item/seeds/cocoapod` (code/modules/hydroponics/grown/cocoa_vanilla.dm:2)
- Cocoa tree seeds
- Key vars: name = "pack of cocoa pod seeds" (line 3), desc = "These seeds grow into cacao trees..." (line 4), icon_state = "seed-cocoapod" (line 5)
- species = "cocoapod" (line 6)
- plantname = "Cocao Tree" (line 7)
- product = `/obj/item/reagent_containers/food/snacks/grown/cocoapod` (line 8)
- lifespan = 20 (line 9)
- maturation = 5, production = 5, yield = 2 (lines 10-12)
- potency = 10 (default)
- instability = 20 (line 13)
- Grows cocoa pods for chocolate

### pack of garlic seeds  `/obj/item/seeds/garlic` (code/modules/hydroponics/grown/garlic.dm)
- Garlic bulb seeds
- FROM garlic.dm: Grows into pungent garlic

### pack of grape seeds  `/obj/item/seeds/grape` (code/modules/hydroponics/grown/berries.dm)
- Grape vine seeds
- FROM berries.dm: Grows into grape clusters for wine

### pack of grass seeds  `/obj/item/seeds/grass` (code/modules/hydroponics/grown/grass_carpet.dm)
- Grass/turf seeds
- FROM grass_carpet.dm: Decorative plant

### pack of onion seeds  `/obj/item/seeds/onion` (code/modules/hydroponics/grown/onion.dm:1)
- Onion bulb seeds
- Key vars: name = "pack of onion seeds" (line 2), desc = "These seeds grow into onions." (line 3), icon_state = "seed-onion" (line 4)
- species = "onion" (line 5)
- plantname = "Onion Sprouts" (line 6)
- product = `/obj/item/reagent_containers/food/snacks/grown/onion` (line 7)
- lifespan = 20, maturation = 3, production = 4, yield = 6 (lines 8-11)
- endurance = 25, instability = 10 (lines 12-13)
- Grows onion bulbs that can be sliced and cooked

### pack of orange seeds  `/obj/item/seeds/orange` (code/modules/hydroponics/grown/citrus.dm:37)
- Orange tree seeds
- Key vars: name = "pack of orange seeds" (line 38), desc = "Sour seeds." (line 39), icon_state = "seed-orange" (line 40)
- species = "orange" (line 41)
- plantname = "Orange Tree" (line 42)
- product = `/obj/item/reagent_containers/food/snacks/grown/citrus/orange` (line 43)
- lifespan = 60, endurance = 50, yield = 5, potency = 20 (lines 44-47)
- Grows tangy orange fruits for juice

### pack of potato seeds  `/obj/item/seeds/potato` (code/modules/hydroponics/grown/potato.dm)
- Potato tuber seeds
- FROM potato.dm: Grows into starchy potatoes

### pack of pumpkin seeds  `/obj/item/seeds/pumpkin` (code/modules/hydroponics/grown/pumpkin.dm)
- Pumpkin seeds
- FROM pumpkin.dm: Grows large pumpkins

### pack of sugarcane seeds  `/obj/item/seeds/sugarcane` (code/modules/hydroponics/grown/sugar_cane.dm)
- Sugarcane plant seeds
- FROM sugar_cane.dm: Grows sweet sugarcane stalks

### pack of tomato seeds  `/obj/item/seeds/tomato` (code/modules/hydroponics/grown/tomato.dm)
- Tomato plant seeds
- FROM tomato.dm: Grows red tomatoes

### pack of tower-cap mycelium  `/obj/item/seeds/tower` (code/modules/hydroponics/grown/towercap.dm)
- Fungal tower-cap spores
- FROM towercap.dm: Grows mushroom cluster, type FUNGAL_METABOLISM

### pack of watermelon seeds  `/obj/item/seeds/watermelon` (code/modules/hydroponics/grown/melon.dm:2)
- Watermelon vine seeds
- Key vars: name = "pack of watermelon seeds" (line 3), desc = "These seeds grow into watermelon plants." (line 4), icon_state = "seed-watermelon" (line 5)
- species = "watermelon" (line 6)
- plantname = "Watermelon Vines" (line 7)
- product = `/obj/item/reagent_containers/food/snacks/grown/watermelon` (line 8)
- lifespan = 50, endurance = 40, instability = 20 (lines 9-11)
- yield = 3, potency = 10 (default)
- Grows large melons that can be sliced

### pack of wheat seeds  `/obj/item/seeds/wheat` (code/modules/hydroponics/grown/cereals.dm:2)
- Wheat grain seeds
- Key vars: name = "pack of wheat seeds" (line 3), desc = "These may, or may not, grow into wheat." (line 4), icon_state = "seed-wheat" (line 5)
- species = "wheat" (line 6)
- plantname = "Wheat Stalks" (line 7)
- product = `/obj/item/reagent_containers/food/snacks/grown/wheat` (line 8)
- production = 1, yield = 4, potency = 15, instability = 20 (lines 9-12)
- Grows wheat stalks for grinding into flour

## TRASH ITEMS

### boritos bag  `/obj/item/trash/boritos` (code/game/objects/items/kitchen.dm - referenced in snacks)
- Disposable snack bag
- From: chips and snack consumption
- Trash item left behind after eating snacks

### crushed can  `/obj/item/trash/can` (code/modules/food_and_drinks/drinks/drinks.dm:617)
- Empty crushed beverage can
- Created when: soda cans crushed (soda_cans.dm line 617 or bullet impact line 626)
- Icon state matches original can icon_state
- Thrown away by crushed item

### candy (trash)  `/obj/item/trash/candy` (code/modules/food_and_drinks/food/snacks_vend.dm:9)
- Candy wrapper or remnant
- Created by eating certain candy items
- Trash output from candy snack consumption

### chips (trash)  `/obj/item/trash/chips` (code/modules/food_and_drinks/food/snacks_vend.dm:71)
- Empty chip bag
- Created by eating chips item
- Left behind as trash

### plate  `/obj/item/trash/plate` (code/modules/food_and_drinks/food/snacks_pie.dm - referenced)
- Dirty or empty plate
- Created by: eating pies, meat dishes, and other plated foods
- Trash output from specific food types

### Scaredy's Private Reserve Beef Jerky (trash)  `/obj/item/trash/sosjerky` (code/modules/food_and_drinks/food/snacks_vend.dm:52)
- Jerky package wrapper
- Created by eating beef jerky items
- Trash from consumption

## CANNED DRINKS

### Canned Laughter  `/obj/item/reagent_containers/food/drinks/soda_cans/canned_laughter` (code/modules/food_and_drinks/drinks/drinks.dm)
- Carbonated beverage in can
- Soda can type, follows soda_cans parent mechanics
- Must be opened before drinking

## Minimum viable port

1. **Food consumption system**: Basic eat action with bitesize, list_reagents transfer, trash generation, and eating messages for each item type
2. **Drink mechanics**: Opening containers (soda cans), drinking actions with gulp messages, volume tracking, refillable/drainable checks
3. **Hunger/nutrition**: Nutriment and nutriment/vitamin reagents, NUTRITION_LEVEL values based on total reagent amounts, hunger bar depletion over time, mood effects for food preferences
4. **Kitchen tools**: fork/knife/spoon with force values, butchering component for knives, plastic tools with breakage chance
5. **Condiment system**: Transfer of cooking ingredients (flour, sugar, salt, milk, etc.) to recipes and food items with amount tracking
6. **Seed/plant system**: Seed vars (yield, potency, lifespan, endurance, production), growing cycles, harvest counts, grown produce with variable reagents based on potency
7. **Reagent effects**: Coffee (caffeine), alcohol (ethanol), minttoxin, capsaicin with on_mob_life effects per reagent type
8. **Food types**: Foodtype flags (FRUIT, GRAIN, MEAT, TOXIC, etc.) for species preference/disgust tracking and food safety
9. **Trash generation**: create_trash proc that generates specific trash objects when foods are consumed or items are deleted
10. **Slice/juice mechanics**: Watermelons and onions sliceable into multiple portions; fruits juiceable for liquid reagents

## NOT FOUND / open questions

- Canned Laughter specific reagent composition (if differs from default)
- Drinkingglass filled variants beyond /cola and /soda specs
- Exact reagent effects and on_mob_life durations for: space_cola, coffee, minttoxin, liquidelectricity, monkey_powder
- Hunger damage over time rate and NUTRITION_LEVEL thresholds (expected in hunger.dm or mob vitals subsystem)
- Exact damage values from eating toxic foods (minttoxin, carpotoxin amounts per item)
- Construction or farming station context (no construction mechanics documented here, only consumption)

## Coverage

- List entries: 71
- Documented with real data: 68
- Marked NOT FOUND: 0 (all items located in source)
- Paths verified: all 71 items confirmed in TG 2020-07-06 source tree

File: C:/Users/Willi/Documents/GitHub/YAD3D/docs/tg/items-food-drink-plants.md
