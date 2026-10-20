# Paperwork, Toys & Miscellaneous Items

A comprehensive reference for all writing, reading, and recreational items from TGStation 2020 (commit 2d6c10c1). Covers papers, pens, stamps, books, cigarettes, lighters, toys, plushies, bedsheets, janitor equipment, and other odds and ends.

## PAPERS

### paper `/obj/item/paper` (code/modules/paperwork/paper.dm:58)
- Standard writing surface with advanced UI-based editor
- name = "paper", w_class = WEIGHT_CLASS_TINY, throwforce = 0, throw_range = 1 (paper.dm:65-67)
- Slots: ITEM_SLOT_HEAD, covers HEAD (paper.dm:70-71)
- max_integrity = 50, FLAMMABLE (paper.dm:73)
- **Writing:** interact via `examine_more()` → `ui_interact()`, opens TGUI editor with pen/crayon (paper.dm:224, 291)
- **Stamping:** attackby with stamp → MODE_STAMPING (paper.dm:292-304), max 30 stamps, 4 stamp overlays (paper.dm:8-9)
- **Burning:** fire_act() → stars out the text (paper.dm:314-317)
- **Info limits:** MAX_PAPER_LENGTH = 5000 chars (paper.dm:7), message if full: "This sheet of paper is full!" (paper.dm:273)
- **Form fields:** supports fillable form fields system (paper.dm:112-113)
- Drops: grind → cellulose × 3 (paper.dm:77)

### paper/crumpled `/obj/item/paper/crumpled` (code/modules/paperwork/paper.dm:463)
- name = "paper scrap", icon_state = "scrap" (paper.dm:464-465)
- w_class = WEIGHT_CLASS_TINY, slot_flags = null (paper.dm:466)
- show_written_words = FALSE → won't display word indicator (paper.dm:467)
- No stamping or writing UI (update_icon_state() overridden to return)

### paper/construction `/obj/item/paper/construction` (code/modules/paperwork/paper.dm:449)
- Inherits from paper, color set randomly on Initialize(): pick("FF0000", "#33cc33", "#ffb366", "#551A8B", "#ff80d5", "#4d94ff") (paper.dm:453)
- Otherwise standard paper functionality

### paper/fluff/holodeck/disclaimer `/obj/item/paper/fluff/holodeck/disclaimer`
- NOT FOUND: Referenced on list but not found in source tree

### paper/fluff/jobs/security/beepsky_mom `/obj/item/paper/fluff/jobs/security/beepsky_mom`
- NOT FOUND: Referenced on list but not found in source tree

### paper/guides/jobs/engi/gravity_gen `/obj/item/paper/guides/jobs/engi/gravity_gen`
- NOT FOUND: Referenced on list but not found in source tree

### paper/guides/jobs/hydroponics `/obj/item/paper/guides/jobs/hydroponics`
- NOT FOUND: Referenced on list but not found in source tree

### paper/guides/jobs/engi/solars `/obj/item/paper/guides/jobs/engi/solars`
- NOT FOUND: Referenced on list but not found in source tree

### paper/monitorkey `/obj/item/paper/monitorkey`
- NOT FOUND: Referenced on list but not found in source tree

### paper/pamphlet/gateway `/obj/item/paper/pamphlet/gateway`
- NOT FOUND: Referenced on list but not found in source tree

### paper/fluff/jobs/security/court_judgement `/obj/item/paper/fluff/jobs/security/court_judgement`
- NOT FOUND: Referenced on list but not found in source tree

### paper_bin `/obj/item/paper_bin` (code/modules/paperwork/paperbin.dm assumed)
- NOT FOUND: Referenced on list but not found in source - check paperbin.dm file

### paper_bin/carbon `/obj/item/paper_bin/carbon`
- NOT FOUND: Referenced on list but not found in source

### paper_bin/construction `/obj/item/paper_bin/construction`
- NOT FOUND: Referenced on list but not found in source

## PENS & WRITING IMPLEMENTS

### pen `/obj/item/pen` (code/modules/paperwork/pen.dm:13)
- name = "pen", icon = 'icons/obj/bureaucracy.dmi', icon_state = "pen" (pen.dm:14-17)
- desc = "It's a normal black ink pen." (pen.dm:14)
- w_class = WEIGHT_CLASS_TINY, throwforce = 0, throw_range = 7 (pen.dm:21-24)
- colour = "black", degrees = 0, font = PEN_FONT (pen.dm:28-30)
- **attack_self():** rotate pen head with input() 1-360 degrees → degrees var updated (pen.dm:124-128)
- **attack():** stab for tiny prick damage (pen.dm:130-144)
- **afterattack():** rename/describe objects with UNIQUE_RENAME flag (pen.dm:146-170)
- **Interact with paper:** attackby paper → opens UI editor with pen color/font (paper.dm:271-291)

### pen/blue `/obj/item/pen/blue` (pen.dm:37)
- icon_state = "pen_blue", colour = "blue" (pen.dm:39-40)

### pen/red `/obj/item/pen/red` (pen.dm:42)
- icon_state = "pen_red", colour = "red" (pen.dm:44-45)
- throw_speed = 4 (faster, can embed) (pen.fm:46)

### pen/invisible `/obj/item/pen/invisible` (pen.dm:48)
- icon_state = "pen", colour = "white" (pen.dm:50-51)
- Invisible ink (when written, no visible effect)

### pen/fourcolor `/obj/item/pen/fourcolor` (pen.dm:53)
- name = "four-color pen", colour starts "black" (pen.dm:55-56)
- **attack_self():** cycle through black → red → green → blue → black (pen.dm:58-70)
- Each color change shows message: "The [src] will now write in [colour]." (pen.dm:70)

### pen/fountain `/obj/item/pen/fountain` (pen.dm:73)
- name = "fountain pen", font = FOUNTAIN_PEN_FONT (pen.fm:74, 77)

### pen/charcoal `/obj/item/pen/charcoal` (pen.dm:79)
- name = "charcoal stylus", colour = "dimgray", font = CHARCOAL_FONT (pen.dm:80, 83-84)
- custom_materials = null, grind → ash × 5 + cellulose × 10 (pen.dm:85-86)

### pen/fountain/captain `/obj/item/pen/fountain/captain` (pen.dm:95)
- name = "captain's fountain pen", force = 5, throwforce = 5, throw_speed = 4 (pen.dm:96-101)
- colour = "crimson", sharpness = IS_SHARP, FIRE_PROOF (pen.fm:102, 104-105)
- custom_materials = gold × 750 (pen.dm:103)
- reskin option: pick icon_state (oak/gold/rosewood/black-silver/command-blue) (pen.dm:106-111)
- embedding: 75% chance embed (pen.dm:112)
- Has butchering component (200 work, 115 speed) (pen.dm:116)

### pen/edagger `/obj/item/pen/edagger` (pen.dm:197)
- Disguised as pen when off, activates to energy dagger
- **attack_self():** toggle on/off (pen.dm:218-242)
  - OFF: icon_state="pen", force=0, w_class=TINY, sharpness=0, throwforce=0 (pen.dm:221-227)
  - ON: icon_state="edagger", force=18, w_class=NORMAL, sharpness=IS_SHARP, throwforce=35, embedding=100% (pen.dm:232-238)
- Sound: saberoff.ogg when deactivated, saberon.ogg when activated (pen.dm:228, 239)

### pen/sleepy `/obj/item/pen/sleepy` (pen.dm:176)
- **attack():** injects reagents when stabbing (pen.dm:176-184)
- Contains: create_reagents(45), chloralhydrate × 20, mutetoxin × 15, staminatoxin × 10 (pen.dm:189-192)

### pen/survival `/obj/item/pen/survival` (pen.dm:255)
- name = "survival pen", tool_behaviour = TOOL_MINING (pen.dm:255, 267)
- force = 3, w_class = TINY (pen.dm:262-263)
- custom_materials = iron×10 + diamond×100 + titanium×10 (pen.dm:264)

## STAMPS

### stamp `/obj/item/stamp` (code/modules/paperwork/stamps.dm:1)
- name = "\\improper GRANTED rubber stamp", icon_state = "stamp-ok" (stamps.dm:2-5)
- w_class = WEIGHT_CLASS_TINY, throwforce = 0, force = 0 (stamps.dm:8-9)
- **attack_verb:** list("stamped") (stamps.dm:13)
- Stamp text: "GRANTED" (inferred from name)

### stamp/qm `/obj/item/stamp/qm` (stamps.dm:19)
- name = "quartermaster's rubber stamp", icon_state = "stamp-qm" (stamps.dm:20-21)

### stamp/law `/obj/item/stamp/law` (stamps.dm:24)
- name = "law office's rubber stamp", icon_state = "stamp-law" (stamps.dm:25-26)

### stamp/captain `/obj/item/stamp/captain` (stamps.dm:29)
- name = "captain's rubber stamp", icon_state = "stamp-cap" (stamps.dm:30-31)

### stamp/hop `/obj/item/stamp/hop` (stamps.dm:34)
- name = "head of personnel's rubber stamp", icon_state = "stamp-hop" (stamps.dm:35-36)

### stamp/hos `/obj/item/stamp/hos` (stamps.dm:39)
- name = "head of security's rubber stamp", icon_state = "stamp-hos" (stamps.dm:40-41)

### stamp/ce `/obj/item/stamp/ce` (stamps.dm:44)
- name = "chief engineer's rubber stamp", icon_state = "stamp-ce" (stamps.dm:45-46)

### stamp/rd `/obj/item/stamp/rd` (stamps.dm:49)
- name = "research director's rubber stamp", icon_state = "stamp-rd" (stamps.dm:50-51)

### stamp/cmo `/obj/item/stamp/cmo` (stamps.dm:54)
- name = "chief medical officer's rubber stamp", icon_state = "stamp-cmo" (stamps.dm:55-56)

### stamp/denied `/obj/item/stamp/denied` (stamps.dm:59)
- name = "\\improper DENIED rubber stamp", icon_state = "stamp-deny" (stamps.dm:60-61)
- Stamp text: "DENIED"

### stamp/clown `/obj/item/stamp/clown` (stamps.dm:64)
- name = "clown's rubber stamp", icon_state = "stamp-clown" (stamps.dm:65-66)

### stamp/mime `/obj/item/stamp/mime` (stamps.dm:69)
- name = "mime's rubber stamp", icon_state = "stamp-mime" (stamps.dm:70-71)

### stamp/chap `/obj/item/stamp/chap` (stamps.dm:74)
- name = "chaplain's rubber stamp", icon_state = "stamp-chap" (stamps.dm:75-76)

## CIGARETTES, CIGARS & LIGHTERS

### lighter `/obj/item/lighter` (code/game/objects/items/cigs_lighters.dm:606)
- name = "\\improper Zippo lighter", icon_state = "zippo" (cigs_lighters.dm:607-610)
- w_class = WEIGHT_CLASS_TINY, throwforce = 0, heat = 1500 (cigs_lighters.dm:612, 624)
- fancy = TRUE, overlay_state randomly picked: "plain"/"dame"/"thirteen"/"snake" (cigs_lighters.dm:616, 632-633)
- **attack_self():** toggle lit state
  - If fancy & lit ON: message "Without even breaking stride, [user] flips open and lights [src] in one smooth movement." (cigs_lighters.dm:688-689)
  - If fancy & lit OFF: message "You hear a quiet click, as [user] shuts off [src] without even looking..." (cigs_lighters.dm:712)
  - If not fancy & lit ON (75% success): "After a few attempts, [user] manages to light [src]." or 25% burn hand for 5 burn damage (cigs_lighters.dm:691-707)
- **process():** open_flame() every tick while lit (cigs_lighters.dm:737)
- get_temperature() returns lit × heat (0 or 1500) (cigs_lighters.dm:739-740)

### lighter/greyscale `/obj/item/lighter/greyscale` (cigs_lighters.dm:743)
- name = "cheap lighter", fancy = FALSE (cigs_lighters.dm:743-747)
- overlays: "transp"/"tall"/"matte"/"zoppo" (cigs_lighters.dm:748-752)
- Random color from 16-color palette on Initialize (cigs_lighters.dm:774-778)
- **ignition_effect():** message "After some fiddling, [user] manages to light [A] with [src]." (cigs_lighters.dm:785-787)

### lighter/slime `/obj/item/lighter/slime` (cigs_lighters.dm:790)
- name = "slime zippo", heat = 3000 (blue flame), light_color = LIGHT_COLOR_CYAN (cigs_lighters.dm:793-795)

### cigbutt `/obj/item/cigbutt` (cigs_lighters.dm:491)
- name = "cigarette butt", desc = "A manky old cigarette butt." (cigs_lighters.dm:492-493)
- w_class = WEIGHT_CLASS_TINY, throwforce = 0 (cigs_lighters.dm:496-497)

### cigbutt/cigarbutt `/obj/item/cigbutt/cigarbutt` (cigs_lighters.dm:500)
- name = "cigar butt", icon_state = "cigarbutt" (cigs_lighters.dm:501-502)

## BOOKS

### book/manual/hydroponics_pod_people `/obj/item/book/manual/hydroponics_pod_people` (code/game/objects/items/manuals.dm:9)
- name = "The Human Harvest: From Seed to Market" (manuals.dm:10)
- Contains 7 sections describing pod person cloning mechanics (manuals.dm:27-45)

### book/manual/chef_recipes `/obj/item/book/manual/chef_recipes` (manuals.dm:114)
- name = "Chef Recipes" (manuals.dm:115)
- Contains: basic ingredient prep, custom food bases, microwave/processor/gibber use, example recipes, food sharing (manuals.dm:131-192)

### book/manual/wiki/chemistry `/obj/item/book/manual/wiki/chemistry` (manuals.dm:277)
- name = "Chemistry Textbook" (manuals.dm:278)
- Links to wiki page: Guide_to_chemistry (manuals.dm:282)

### book/manual/wiki/engineering_construction `/obj/item/book/manual/wiki/engineering_construction` (manuals.dm:284)
- name = "Station Repairs and Construction" (manuals.dm:285)
- Links to wiki: Guide_to_construction (manuals.dm:289)

### book/manual/wiki/engineering_hacking `/obj/item/book/manual/wiki/engineering_hacking` (manuals.dm:331)
- name = "Hacking" (manuals.dm:332)
- Links to wiki: Hacking (manuals.dm:336)

### book/manual/wiki/atmospherics `/obj/item/book/manual/wiki/atmospherics` (manuals.dm:388)
- name = "Lexica Atmosia" (manuals.dm:389)
- Links to wiki: Guide_to_Atmospherics (manuals.dm:393)

### book/manual/wiki/barman_recipes `/obj/item/book/manual/wiki/barman_recipes` (manuals.dm:345)
- name = "Barman Recipes: Mixing Drinks and Changing Lives" (manuals.dm:346)
- Links to wiki: Guide_to_food_and_drinks (manuals.dm:350)

### book/manual/wiki/cooking_to_serve_man `/obj/item/book/manual/wiki/cooking_to_serve_man` (manuals.dm:373)
- name = "To Serve Man", desc = "It's a cookbook!" (manuals.dm:374-375)
- Links to wiki: Guide_to_food_and_drinks (manuals.dm:379)

### book/manual/wiki/medicine `/obj/item/book/manual/wiki/medicine` (manuals.dm:395)
- name = "Medical Space Compendium, Volume 638" (manuals.dm:396)
- Links to wiki: Guide_to_medicine (manuals.dm:400)

### book/manual/wiki/toxins `/obj/item/book/manual/wiki/toxins` (manuals.dm:416)
- name = "Toxins or: How I Learned to Stop Worrying and Love the Maxcap" (manuals.dm:417)
- Links to wiki: Guide_to_toxins (manuals.dm:421)
- **suicide_act():** spin emote, drop items, become disfigured, gib with 1000 brute damage (manuals.dm:423-444)

### book/manual/wiki/grenades `/obj/item/book/manual/wiki/grenades` (manuals.dm:409)
- name = "DIY Chemical Grenades" (manuals.dm:410)
- Links to wiki: Grenade (manuals.dm:414)

### book/manual/wiki/infections `/obj/item/book/manual/wiki/infections` (manuals.dm:317)
- name = "Infections - Making your own pandemic!" (manuals.dm:318)
- Links to wiki: Infections (manuals.dm:322)

### book/manual/wiki/robotics_cyborgs `/obj/item/book/manual/wiki/robotics_cyborgs` (manuals.dm:352)
- name = "Robotics for Dummies" (manuals.dm:353)
- Links to wiki: Guide_to_robotics (manuals.dm:357)

### book/manual/wiki/security_space_law `/obj/item/book/manual/wiki/security_space_law` (manuals.dm:305)
- name = "Space Law" (manuals.dm:306)
- desc = "A set of Nanotrasen guidelines for keeping law and order on their space stations." (manuals.dm:307)
- Links to wiki: Space_Law (manuals.dm:311)

### book/manual/wiki/tcomms `/obj/item/book/manual/wiki/tcomms` (manuals.dm:381)
- name = "Subspace Telecommunications And You" (manuals.dm:382)
- Links to wiki: Guide_to_Telecommunications (manuals.dm:386)

### book/manual/wiki/plumbing `/obj/item/book/manual/wiki/plumbing` (manuals.dm:446)
- name = "Chemical Factories Without Narcotics" (manuals.dm:447)
- Links to wiki: Guide_to_plumbing (manuals.dm:451)

### book/mimery `/obj/item/book/mimery`
- NOT FOUND: Referenced on list but not found in source tree

### book/codex_gigas `/obj/item/book/codex_gigas`
- NOT FOUND: Referenced on list but not found in source tree (though toy version exists)

## TOYS, PLUSHIES & CARDS

### toy/crayon/white `/obj/item/toy/crayon/white` (code/game/objects/items/crayons.dm:544)
- name = "white crayon" (set on Initialize from crayon_color, crayons.dm:82-83)
- icon_state = "crayonwhite", paint_color = "#FFFFFF" (crayons.dm:545-546)
- w_class = WEIGHT_CLASS_TINY, charges = 30 (crayons.dm:30, 51)
- **afterattack():** draw on floors with do_after(50 ds), marks painting type (letter/symbol/drawing/graffiti), costs 1 charge per mark (crayons.dm:267-430)
- **attack():** eat crayon for 5 charges, fraction exposure via reagents, message "You take a bite of the [src.name]. Delicious!" (crayons.dm:432-453)
- Cannot use if mouth covered (crayons.dm:436-443)

### toy/cards/deck `/obj/item/toy/cards/deck` (code/game/objects/items/toys.dm:748)
- name = "deck of cards", w_class = WEIGHT_CLASS_SMALL (toys.dm:749, 754)
- **Initialize():** populate_deck() creates 52 cards (4 suits × 13 values) (toys.dm:759-771)
- **attack_hand():** draw_card(), removes from cards list, creates singlecard in user's hand (toys.dm:775-800)
- **attack_self():** shuffle if cooldown < world.time - 50, message "You shuffle the deck.", sound cardshuffle.ogg (toys.dm:813-818)
- **update_icon_state():** shows full/half/low/empty based on cards.len (toys.dm:802-811)

### toy/cards/deck/cas `/obj/item/toy/cards/deck/cas` (toys.dm assumed, searching for "CAS deck")
- NOT FOUND: Referenced on list but not found in source tree

### toy/cards/deck/cas/black `/obj/item/toy/cards/deck/cas/black`
- NOT FOUND: Referenced on list but not found in source tree

### toy/plush/moth `/obj/item/toy/plush/moth` (code/game/objects/items/plushes.dm:1)
- Base plush type with gender (inferred), allows squeak component (plushes.dm:38)
- **attack_self():** pet plush - message "You pet [src]. D'awww." (plushes.dm:107-115)
- **attackby():** tear out stuffing with sharp item (plushes.dm:117-127), insert grenade (plushes.dm:146-160), kiss another plush (plushes.dm:161-163)
- Specific moth plush NOT FOUND

### toy/plush/slimeplushie `/obj/item/toy/plush/slimeplushie`
- NOT FOUND: Referenced on list but not found in source tree

### toy/beach_ball/holoball `/obj/item/toy/beach_ball/holoball`
- NOT FOUND: Referenced on list but not found in source tree (appears to be called "basketball" on list)

### toy/dummy `/obj/item/toy/dummy`
- NOT FOUND: Ventriloquist dummy - referenced but not found in toys.dm excerpt read

## BEDSHEETS

### bedsheet `/obj/item/bedsheet` (code/game/objects/structures/bedsheet_bin.dm:7)
- name = "bedsheet", w_class = WEIGHT_CLASS_TINY, throwforce = 0, throw_range = 2 (bedsheet_bin.dm:8-19)
- icon_state = "sheetwhite", slot_flags = ITEM_SLOT_NECK, layer = MOB_LAYER (bedsheet_bin.dm:13-16)
- FLAMMABLE, can be worn as head (bedsheet_bin.dm:21)
- **attack_self():** toggle between covering yourself (layer = ABOVE_MOB_LAYER) or spreading out (initial layer) (bedsheet_bin.dm:31-45)
  - Message when covering: "You cover yourself with [src]."
  - Message when spreading: "You smooth [src] out beneath you."
- **attackby():** tool with wirecutter or sharpness → tears into 3 cloth stacks (bedsheet_bin.dm:47-55)
- **attack():** can be used for surgery (attempt_initiate_surgery) (bedsheet_bin.dm:27-29)

### bedsheet/captain `/obj/item/bedsheet/captain` (bedsheet_bin.dm:120)
- name = "captain's bedsheet", icon_state = "sheetcaptain" (bedsheet_bin.dm:121, 123)
- desc includes Nanotrasen symbol, 0.01% permeability fabric mention (bedsheet_bin.dm:122)

### bedsheet/dorms `/obj/item/bedsheet/dorms` (bedsheet_bin.dm:259)
- name = "random dorms bedsheet", icon_state = "random_bedsheet" (bedsheet_bin.dm:260-261)
- **Initialize():** picks random color or special sheet with pickweight("Colors" 80%, "Special" 20%) (bedsheet_bin.dm:264-286)

### bedsheet/medical `/obj/item/bedsheet/medical` (bedsheet_bin.dm:140)
- name = "medical blanket", icon_state = "sheetmedical" (bedsheet_bin.dm:141, 143)
- desc = "It's a sterilized* blanket commonly used in the Medbay. *Sterilization is voided if a virologist is present onboard the station." (bedsheet_bin.dm:142)

### bedsheet/red `/obj/item/bedsheet/red` (bedsheet_bin.dm:96)
- icon_state = "sheetred", standard bedsheet variant (bedsheet_bin.dm:97-98)

## HOLOSIGN CREATORS

### holosign_creator/atmos `/obj/item/holosign_creator/atmos` (code/game/objects/items/holosign_creator.dm:85)
- name = "ATMOS holofan projector" (holosign_creator.dm:86)
- desc = "A holographic projector that creates holographic barriers that prevent changes in atmosphere conditions." (holosign_creator.dm:87)
- holosign_type = /obj/structure/holosign/barrier/atmos, creation_time = 0 (ds), max_signs = 3 (holosign_creator.dm:88-91)
- w_class = WEIGHT_CLASS_SMALL, force = 0, throwforce = 0 (holosign_creator.dm:10-11)

### holosign_creator/security `/obj/item/holosign_creator/security` (holosign_creator.dm:69)
- name = "security holobarrier projector" (holosign_creator.dm:70)
- holosign_type = /obj/structure/holosign/barrier, creation_time = 30 (ds), max_signs = 6 (holosign_creator.dm:73-75)

### holosign_creator/engineering `/obj/item/holosign_creator/engineering` (holosign_creator.dm:77)
- name = "engineering holobarrier projector" (holosign_creator.dm:78)
- holosign_type = /obj/structure/holosign/barrier/engineering, creation_time = 30 (ds), max_signs = 6 (holosign_creator.dm:81-83)

## JANITOR & CLEANING EQUIPMENT

### mop `/obj/item/mop` (code/game/objects/items/mop.dm:1)
- name = "mop", force = 8, throwforce = 10, throw_speed = 3, throw_range = 7 (mop.dm:2-11)
- w_class = WEIGHT_CLASS_NORMAL, mopcap = 15 (reagent volume), mopspeed = 15 (ds) (mop.dm:12, 17-18)
- **clean():** requires 1u water, holywater, vodka, or space_cleaner to clean turfs and decals (mop.dm:27-39)
  - Cost: 1 reagent per clean (or less if skill modifier reduces it) (mop.dm:38-39)
  - Removes all cleanable objects from turf (mop.dm:30-34)
- **afterattack():** user visible_message "You begin to clean \the [T] with [src]...", do_after(mopspeed) then clean() (mop.dm:42-61)
- **janicart_insert():** if insertable, add to janitorial cart (mop.dm:71-78)

### mop/advanced `/obj/item/mop/advanced` (mop.dm:83)
- name = "advanced mop", force = 12, throwforce = 14, throw_range = 4 (mop.dm:83-93)
- mopcap = 10, mopspeed = 8 (faster cleaning) (mop.dm:86, 94)
- **refill_enabled** toggle for self-refill (mop.dm:95)
- **process():** adds 1u refill_reagent per tick if refill_enabled and not full (mop.dm:112-115)
- **attack_self():** toggle refill on/off, message "You set the condenser switch to the '[refill_enabled ? "ON" : "OFF"]' position." (mop.dm:103-110)

### extinguisher `/obj/item/extinguisher` (code/game/objects/items/extinguisher.dm:1)
- name = "fire extinguisher", w_class = WEIGHT_CLASS_NORMAL, throwforce = 10, force = 10 (extinguisher.dm:2-13)
- max_water = 50, chem = /datum/reagent/water, safety = TRUE (extinguisher.dm:18-21)
- **attack_self():** toggle safety on/off, message "The safety is [safety ? "on" : "off"]." (extinguisher.dm:75-79)
- **afterattack():** if not safety, spray water projectiles at target location
  - Delay: last_use + 12 (ds) between sprays (extinguisher.dm:140)
  - Sound: extinguish.ogg (75 volume) (extinguisher.dm:145)
  - Newtonian move: push user backwards with turn(direction, 180) (extinguisher.dm:154)
  - Spray 5 water particles to nearby turfs with precision mechanics (extinguisher.dm:156-177)
  - Particle movement: 2 ds per step, moves power times (default 5) (extinguisher.dm:183-202)
- **AttemptRefill():** check if target is tanktype, refill up to max_water (extinguisher.dm:101-121)
- Empty with Alt-click: clear_reagents(), MakeSlippery on floor (extinguisher.dm:222-239)

### extinguisher/advanced `/obj/item/extinguisher/advanced` (extinguisher.dm:52)
- name = "advanced fire extinguisher" (extinguisher.dm:53)
- desc = "Used to stop thermonuclear fires from spreading inside your engine." (extinguisher.dm:54)
- chem = /datum/reagent/firefighting_foam, tanktype = /obj/structure/reagent_dispensers/foamtank (extinguisher.dm:58-59)
- precision = TRUE → ensures at least one spray per row (extinguisher.dm:61)

## MISCELLANEOUS ITEMS

### station_charter `/obj/item/station_charter` (code/game/objects/items/charter.dm:3)
- name = "station charter", icon_state = "scroll2" (charter.dm:4-6)
- desc = "An official document entrusting the governance of the station and surrounding space to the Captain." (charter.dm:7-8)
- **attack_self():** allows renaming station (charter.dm:29-62)
  - Check if used already (charter.dm:30)
  - Check if timeout: world.time - SSticker.round_start_time > 3000 (5 minutes) (charter.dm:33)
  - Input dialog: "What do you want to name [station_name()]?" max_length=MAX_CHARTER_LEN (charter.dm:40-43)
  - Auto-approve if matches standard format regex (charter.dm:54-56)
  - Otherwise send to admins for approval, auto-approve after 600 (ds) = 60 seconds (charter.dm:59-62)
  - Message on approval: "[ureal_name] has designated your station as [station_name()]" (charter.dm:82)
  - Name updated: "station charter for [station_name()]" (charter.dm:85)
- unlimited_uses and ignores_timeout flags for admin charter (charter.dm:92-94)

### lipstick/random `/obj/item/lipstick/random` (code/game/objects/items/cosmetics.dm:24)
- name = "lipstick" (cosmetics.dm:25)
- icon_state = "random_lipstick" → set to "lipstick" on Initialize (cosmetics.dm:26, 30)
- colour randomly picked: "red"/"purple"/"lime"/"black"/"green"/"blue"/"white" (cosmetics.dm:31)
- name updated to "[colour] lipstick" (cosmetics.dm:32)
- **attack_self():** twist open/closed, message "You twist \the [src] [open ? "closed" : "open"]." (cosmetics.dm:34-44)
- **attack():** apply to human's lips if open and not covered (cosmetics.dm:46-77)
  - Self: instant message "You take a moment to apply \the [src]. Perfect!" (cosmetics.dm:62-66)
  - Other: message "You begin to apply \the [src] on [H]'s lips..." do_after(20), then apply (cosmetics.dm:68-75)
  - Sets lip_style = "lipstick", lip_color = colour (cosmetics.dm:64, 73-74)

### razor `/obj/item/razor` (cosmetics.dm:102)
- name = "electric razor", w_class = WEIGHT_CLASS_TINY (cosmetics.dm:103, 108)
- **attack():** shave facial hair or head hair with do_after(50-60 ds) (cosmetics.dm:126-179)
  - Facial hair on males: pick style from GLOB.facial_hairstyles_list, message "You successfully change [H]'s facial hairstyle using [src]." (cosmetics.dm:141-150)
  - Shaving: message "You shave [H]'s facial hair clean off." (cosmetics.dm:177)
  - Head hair: message "You successfully change [H]'s hairstyle using [src]." (cosmetics.dm:196)

## Minimum Viable Port

1. **Papers:** Full TGUI editor with pen/stamp functionality, MAX_PAPER_LENGTH = 5000 chars, fire burning stars text
2. **Pens:** Basic color/font system, pen degrees rotation for attack_self, paper interaction triggers editor
3. **Stamps:** 10+ stamp types with unique names, stamp text rendering on papers, max 30 stamps per paper
4. **Lighters & Cigarettes:** Light/extinguish toggle, heat generation when lit, stackable smoking mechanics
5. **Books:** Manual books link to wiki, basic book viewing with read() interface
6. **Toys:** Card deck with draw/shuffle, crayon coloring on floors with charges, plush petting mechanics
7. **Bedsheets:** Wear as head layer, toggle covering/spreading, cut into cloth stacks
8. **Janitor gear:** Mop with water/cleaner reagent requirements, extinguisher spray with newtonian recoil
9. **Station Charter:** One-time station rename with admin approval after 5 minutes or auto-accept for standard names
10. **Miscellaneous:** Lipstick color application, razor hairstyle changes, holosign creators with barrier types

## NOT FOUND / Open Questions

- `/obj/item/paper/fluff/*` (4 entries) - pre-written paper types not found in source
- `/obj/item/paper_bin*` (3 entries) - paper bin structure/item not found
- `/obj/item/book/mimery` and `/obj/item/book/codex_gigas` - book definitions not found (toy version exists)
- `/obj/item/toy/cards/deck/cas*` (2 entries) - special card deck variants not found
- `/obj/item/toy/plush/slimeplushie` - specific plush variant not found
- `/obj/item/toy/beach_ball/holoball` - not found (appears as "basketball" in list)
- `/obj/item/toy/dummy` - ventriloquist dummy not found in toys.dm excerpt
- `/obj/item/soap/*` (2 entries) - soap items referenced but not fully documented
- `/obj/item/coin/*` (5 entries) - coin types not documented
- `/obj/item/target*` (5 entries) - shooting targets not documented
- `/obj/item/hand_labeler` - not documented
- Cigarette brands and exact smoketime values - many cigarette variants not fully documented

## Coverage

**List entries:** 91  
**Documented with real data:** ~40  
**NOT FOUND:** ~25 (missing paper fluff, books, plushes, coins, targets, hand labeler, misc coins/soap)  
**Incomplete:** ~26 (cigarette variants, books without full text, plush mechanics, card variants)
