# Items Remaining 4: Paper, PDAs, Pet Carrier

Documentation of 39 item types from tgstation 2020-07-06. Sources: paperwork module, PDA devices, pet carrier.

## Paper Items

### newspaper `/obj/item/newspaper` (code/game/machinery/newscaster.dm:856)
- In-game item: "newspaper"
- Printable newspaper containing news feeds and wanted notices
- Key vars: name = "newspaper" (856), icon_state = "newspaper", w_class = WEIGHT_CLASS_SMALL, resistance_flags = FLAMMABLE, attack_verb = list("bapped") (864)
- Interactions: 
  | held item / action | condition | delay (ds) | message | result |
  | attack_self | ishuman(user) | 0 | displays newspaper UI | opens browsable interface with contents |
  | suicide_act | user | 0 | "is focusing intently on [src]! It looks like [user.p_theyre()] trying to commit sudoku... until [user.p_their()] eyes light up with realization!" | TOXLOSS (user drinks whiskey) (878-887) |

---

### Holodeck Disclaimer `/obj/item/paper/fluff/holodeck/disclaimer` (code/modules/holodeck/items.dm:227)
- In-game name: "Holodeck Disclaimer"
- Medical notice: holodeck bruises heal by sleeping
- Key vars: name = "Holodeck Disclaimer", info = "Bruises sustained in the holodeck can be healed simply by sleeping." (228-229)
- No special interactions beyond standard paper

---

### Note from Beepsky's Mom `/obj/item/paper/fluff/jobs/security/beepsky_mom` (code/modules/paperwork/paper_premade.dm:30)
- In-game name: "Note from Beepsky's Mom"
- Fluff note in binary code (01001001 01101000 01101111 01110000... etc.) (31)
- Key vars: name = "Note from Beepsky's Mom"

---

### Court Judgement `/obj/item/paper/fluff/jobs/security/court_judgement` (code/modules/paperwork/paper_premade.dm:54)
- In-game name: "paper- 'Judgement'"
- Legal document for recording sentence outcomes
- Key vars: name = "paper- 'Judgement'", info = "For crimes against the station, the offender is sentenced to:<BR>\n<BR>\n" (55-56)

---

### Generate Your Own Gravity Guide `/obj/item/paper/guides/jobs/engi/gravity_gen` (code/modules/power/gravitygenerator.dm:396)
- In-game name: "paper- 'Generate your own gravity!'"
- Engineering guide for gravity generator operation
- Key vars: name = "paper- 'Generate your own gravity!'" (397)
- Info contains: gravity generator assembly instructions, repair procedures for damaged framework (screwdriver for screws, welding tool for damage, plasteel plating, wrench to secure) (398-409)

---

### Solar Array Setup Guide `/obj/item/paper/guides/jobs/engi/solars` (code/modules/power/solar.dm:480)
- In-game name: "paper- 'Going green! Setup your own solar array instructions.'"
- Engineering guide for solar panel construction
- Key vars: name = "paper- 'Going green! Setup your own solar array instructions.'" (481)
- Info: instructions for building solar panels (wrenching solar assembly onto cable node, adding glass), creating solar tracker, setting up solar computer (480-482)

---

### Greetings from Billy Bob `/obj/item/paper/guides/jobs/hydroponics` (code/modules/paperwork/paper_premade.dm:26)
- In-game name: "paper- 'Greetings from Billy Bob'"
- Botanist guide with cultivation tips
- Key vars: name = "paper- 'Greetings from Billy Bob'" (27)
- Info: instructions on plant iteration, seed extraction, mutation mechanics, nutrients vs water requirements (26-28)

---

### Monitor Decryption Key `/obj/item/paper/monitorkey` (code/game/machinery/telecomms/computers/message.dm:461)
- In-game name: "monitor decryption key"
- Auto-generated key for message server decryption
- Key vars: name = "monitor decryption key" (462)
- Initialization: receives server reference, prints key via `print(server)` proc (464-473)
- Info auto-generated: "<center><h2>Daily Key Reset</h2></center><br>The new message monitor key is '[server.decryptkey]'.<br>Please keep this a secret and away from the clown.<br>If necessary, change the password to a more secure one." (473)

---

### Gateway Project Pamphlet `/obj/item/paper/pamphlet/gateway` (code/modules/awaymissions/pamphlet.dm:12)
- In-game name: "pamphlet"
- Information about the Nanotrasen Gateway project for away missions
- Key vars: name = "pamphlet", icon_state = "pamphlet", show_written_words = FALSE (1-4)
- Info: detailed description of gateway operation basics, risks, life on other side, and colonization instructions (13-42)

---

### Paper Bin `/obj/item/paper_bin` (code/modules/paperwork/paperbin.dm:1)
- In-game name: "paper bin"
- Storage container for blank paper and pens
- Key vars: name = "paper bin", desc = "Contains all the paper you'll never need.", w_class = WEIGHT_CLASS_NORMAL, throwforce = 0, throw_range = 7, papertype = /obj/item/paper, total_paper = 30 (1-16)
- Interactions:
  | held item / action | condition | delay (ds) | message | result |
  | attack_hand | bin_pen exists | 0 | "You take [P] out of \the [src]." | removes pen from bin |
  | attack_hand | total_paper >= 1 | 0 | "You take [P] out of \the [src]." | removes paper from bin, decrements total_paper (76-94) |
  | attack_hand | no paper or pen | 0 | "[src] is empty!" | warning message |
  | attackby with paper | user has paper I | 0 | "You put [P] in [src]." | adds paper to bin (101-108) |
  | attackby with pen | !bin_pen | 0 | "You put [P] in [src]." | adds pen to bin (109-115) |
  | fire_act | any | 0 | (implicit) | destroys all paper in bin (38-41) |

---

### Carbon Paper Bin `/obj/item/paper_bin/carbon` (code/modules/paperwork/paperbin.dm:177)
- In-game name: "carbon paper bin"
- Storage for carbon paper (produces duplicates)
- Key vars: name = "carbon paper bin", desc = "Contains all the paper you'll ever need, in duplicate!", icon_state = "paper_bin_carbon", papertype = /obj/item/paper/carbon (177-181)
- Inherits all mechanics from /obj/item/paper_bin; only difference is the paper type produced

---

## PDA Types

### Base PDA Definition `/obj/item/pda` (code/game/objects/items/devices/PDA/PDA.dm:14)
- In-game name: "\improper PDA"
- Portable microcomputer for communications
- Key vars: name = "\improper PDA", w_class = WEIGHT_CLASS_TINY, slot_flags = ITEM_SLOT_ID | ITEM_SLOT_BELT, armor = list("melee" = 0, "bullet" = 0, "laser" = 0, "energy" = 0, "bomb" = 0, "bio" = 0, "rad" = 0, "fire" = 100, "acid" = 100), resistance_flags = FIRE_PROOF | ACID_PROOF (14-28)
- Key attributes: default_cartridge, cartridge (current), owner (string name), mode (0=hub), icon_alert, font_index, scanmode (PDA_SCANNER_NONE=0 to 5), fon (flashlight), silent, toff (messenger disabled), ttone, honkamt, mimeamt, note, hidden, emped, allow_emojis (31-70)
- All PDAs below are subtypes of this

---

### Atmospherics PDA `/obj/item/pda/atmos` (code/game/objects/items/devices/PDA/PDA_types.dm:213)
- In-game name: "atmospherics PDA"
- Key vars: name = "atmospherics PDA", default_cartridge = /obj/item/cartridge/atmos, icon_state = "pda-atmos" (213-216)

---

### Bartender PDA `/obj/item/pda/bar` (code/game/objects/items/devices/PDA/PDA_types.dm:208)
- In-game name: "bartender PDA"
- Key vars: name = "bartender PDA", icon_state = "pda-bartender", inserted_item = /obj/item/pen/fountain (208-211)

---

### Botanist PDA `/obj/item/pda/botanist` (code/game/objects/items/devices/PDA/PDA_types.dm:177)
- In-game name: "botanist PDA"
- Key vars: name = "botanist PDA", icon_state = "pda-hydro" (177-180)

---

### Captain PDA `/obj/item/pda/captain` (code/game/objects/items/devices/PDA/PDA_types.dm:133)
- In-game name: "captain PDA"
- Key vars: name = "captain PDA", default_cartridge = /obj/item/cartridge/captain, inserted_item = /obj/item/pen/fountain/captain, icon_state = "pda-captain" (133-137)
- Special: RegisterSignal on COMSIG_PDA_CHECK_DETONATE to prevent detonation (139-141)

---

### Cargo Technician PDA `/obj/item/pda/cargo` (code/game/objects/items/devices/PDA/PDA_types.dm:143)
- In-game name: "cargo technician PDA"
- Key vars: name = "cargo technician PDA", default_cartridge = /obj/item/cartridge/quartermaster, icon_state = "pda-cargo" (143-146)

---

### Chaplain PDA `/obj/item/pda/chaplain` (code/game/objects/items/devices/PDA/PDA_types.dm:165)
- In-game name: "chaplain PDA"
- Key vars: name = "chaplain PDA", icon_state = "pda-chaplain", ttone = "holy" (165-168)

---

### Chemist PDA `/obj/item/pda/chemist` (code/game/objects/items/devices/PDA/PDA_types.dm:218)
- In-game name: "chemist PDA"
- Key vars: name = "chemist PDA", default_cartridge = /obj/item/cartridge/chemistry, icon_state = "pda-chemistry" (218-221)

---

### Clown PDA `/obj/item/pda/clown` (code/game/objects/items/devices/PDA/PDA_types.dm:2)
- In-game name: "clown PDA"
- Slippery PDA with clown virus cartridge
- Key vars: name = "clown PDA", default_cartridge = /obj/item/cartridge/virus/clown, inserted_item = /obj/item/toy/crayon/rainbow, icon_state = "pda-clown", desc = "A portable microcomputer by Thinktronic Systems, LTD. The surface is coated with polytetrafluoroethylene and banana drippings.", ttone = "honk" (2-8)
- Interactions: AddComponent(/datum/component/slippery/clowning, 120, NO_SLIP_WHEN_WALKING) on ComponentInitialize; when non-owner slips on it, clown cartridge (if present) gains 1 charge up to 5 (10-18)

---

### Cook PDA `/obj/item/pda/cook` (code/game/objects/items/devices/PDA/PDA_types.dm:204)
- In-game name: "cook PDA"
- Key vars: name = "cook PDA", icon_state = "pda-cook" (204-206)

---

### Curator PDA `/obj/item/pda/curator` (code/game/objects/items/devices/PDA/PDA_types.dm:187)
- In-game name: "curator PDA"
- Library worker PDA, silent operation
- Key vars: name = "curator PDA", icon_state = "pda-library", icon_alert = "pda-r-library", default_cartridge = /obj/item/cartridge/curator, inserted_item = /obj/item/pen/fountain, desc = "A portable microcomputer by Thinktronic Systems, LTD. This model is a WGW-11 series e-reader.", note = "Congratulations, your station has chosen the Thinktronic 5290 WGW-11 Series E-reader and Personal Data Assistant!", silent = TRUE, overlays_x_offset = -3 (187-196)

---

### Detective PDA `/obj/item/pda/detective` (code/game/objects/items/devices/PDA/PDA_types.dm:80)
- In-game name: "detective PDA"
- Key vars: name = "detective PDA", default_cartridge = /obj/item/cartridge/detective, icon_state = "pda-detective" (80-83)

---

### Engineering PDA `/obj/item/pda/engineering` (code/game/objects/items/devices/PDA/PDA_types.dm:70)
- In-game name: "engineering PDA"
- Key vars: name = "engineering PDA", default_cartridge = /obj/item/cartridge/engineering, icon_state = "pda-engineer" (70-73)

---

### Geneticist PDA `/obj/item/pda/geneticist` (code/game/objects/items/devices/PDA/PDA_types.dm:223)
- In-game name: "geneticist PDA"
- Key vars: name = "geneticist PDA", default_cartridge = /obj/item/cartridge/medical, icon_state = "pda-genetics" (223-226)

---

### Chief Engineer PDA `/obj/item/pda/heads/ce` (code/game/objects/items/devices/PDA/PDA_types.dm:117)
- In-game name: "chief engineer PDA"
- Key vars: name = "chief engineer PDA", default_cartridge = /obj/item/cartridge/ce, icon_state = "pda-ce" (117-120)

---

### Chief Medical Officer PDA `/obj/item/pda/heads/cmo` (code/game/objects/items/devices/PDA/PDA_types.dm:122)
- In-game name: "chief medical officer PDA"
- Key vars: name = "chief medical officer PDA", default_cartridge = /obj/item/cartridge/cmo, icon_state = "pda-cmo" (122-125)

---

### Head of Personnel PDA `/obj/item/pda/heads/hop` (code/game/objects/items/devices/PDA/PDA_types.dm:107)
- In-game name: "head of personnel PDA"
- Key vars: name = "head of personnel PDA", default_cartridge = /obj/item/cartridge/hop, icon_state = "pda-hop" (107-110)

---

### Head of Security PDA `/obj/item/pda/heads/hos` (code/game/objects/items/devices/PDA/PDA_types.dm:112)
- In-game name: "head of security PDA"
- Key vars: name = "head of security PDA", default_cartridge = /obj/item/cartridge/hos, icon_state = "pda-hos" (112-115)

---

### Research Director PDA `/obj/item/pda/heads/rd` (code/game/objects/items/devices/PDA/PDA_types.dm:127)
- In-game name: "research director PDA"
- Key vars: name = "research director PDA", default_cartridge = /obj/item/cartridge/rd, inserted_item = /obj/item/pen/fountain, icon_state = "pda-rd" (127-131)

---

### Janitor PDA `/obj/item/pda/janitor` (code/game/objects/items/devices/PDA/PDA_types.dm:90)
- In-game name: "janitor PDA"
- Key vars: name = "janitor PDA", default_cartridge = /obj/item/cartridge/janitor, icon_state = "pda-janitor", ttone = "slip" (90-94)

---

### Lawyer PDA `/obj/item/pda/lawyer` (code/game/objects/items/devices/PDA/PDA_types.dm:170)
- In-game name: "lawyer PDA"
- Key vars: name = "lawyer PDA", default_cartridge = /obj/item/cartridge/lawyer, inserted_item = /obj/item/pen/fountain, icon_state = "pda-lawyer", ttone = "objection" (170-175)

---

### Medical PDA `/obj/item/pda/medical` (code/game/objects/items/devices/PDA/PDA_types.dm:60)
- In-game name: "medical PDA"
- Key vars: name = "medical PDA", default_cartridge = /obj/item/cartridge/medical, icon_state = "pda-medical" (60-63)

---

### Mime PDA `/obj/item/pda/mime` (code/game/objects/items/devices/PDA/PDA_types.dm:21)
- In-game name: "mime PDA"
- Silent PDA with mime virus cartridge; sends emoji-based messages
- Key vars: name = "mime PDA", default_cartridge = /obj/item/cartridge/virus/mime, inserted_item = /obj/item/toy/crayon/mime, icon_state = "pda-mime", desc = "A portable microcomputer by Thinktronic Systems, LTD. The hardware has been modified for compliance with the vows of silence.", allow_emojis = TRUE, silent = TRUE, ttone = "silence" (21-29)
- msg_input override: sanitizes and returns emojis only, disables on EMP or toff (31-39)

---

### Quartermaster PDA `/obj/item/pda/quartermaster` (code/game/objects/items/devices/PDA/PDA_types.dm:148)
- In-game name: "quartermaster PDA"
- Key vars: name = "quartermaster PDA", default_cartridge = /obj/item/cartridge/quartermaster, inserted_item = /obj/item/pen/fountain, icon_state = "pda-qm" (148-152)

---

### Roboticist PDA `/obj/item/pda/roboticist` (code/game/objects/items/devices/PDA/PDA_types.dm:182)
- In-game name: "roboticist PDA"
- Key vars: name = "roboticist PDA", icon_state = "pda-roboticist", default_cartridge = /obj/item/cartridge/roboticist (182-185)

---

### Security PDA `/obj/item/pda/security` (code/game/objects/items/devices/PDA/PDA_types.dm:75)
- In-game name: "security PDA"
- Key vars: name = "security PDA", default_cartridge = /obj/item/cartridge/security, icon_state = "pda-security" (75-78)

---

### Shaft Miner PDA `/obj/item/pda/shaftminer` (code/game/objects/items/devices/PDA/PDA_types.dm:154)
- In-game name: "shaft miner PDA"
- Key vars: name = "shaft miner PDA", icon_state = "pda-miner" (154-156)

---

### Scientist PDA (Toxins) `/obj/item/pda/toxins` (code/game/objects/items/devices/PDA/PDA_types.dm:96)
- In-game name: "scientist PDA"
- Key vars: name = "scientist PDA", default_cartridge = /obj/item/cartridge/signal/toxins, icon_state = "pda-science", ttone = "boom" (96-100)

---

## Equipment

### Pet Carrier `/obj/item/pet_carrier` (code/game/objects/items/pet_carrier.dm:5)
- In-game name: "pet carrier"
- Container for transporting living creatures
- Key vars: name = "pet carrier", desc = "A big white-and-blue pet carrier. Good for carrying <s>meat to the chef</s> cute animals around.", w_class = WEIGHT_CLASS_BULKY, force = 5, attack_verb = list("bashed", "carried"), throw_speed = 2, throw_range = 3, custom_materials = list(/datum/material/iron = 7500, /datum/material/glass = 100), open = TRUE, locked = FALSE, max_occupants = 3, max_occupant_weight = MOB_SIZE_SMALL (5-24)
- Interactions:
  | held item / action | condition | delay (ds) | message | result |
  | attack_self | user | 0 | toggle open/locked state | toggles open/locked (58-71) |
  | AltClick | user | 0 | load_occupant dialog | attempts to load creature into carrier (72-81) |
  | attack target mob | valid target | 0 | "[user] crudely shoves [target] into [src]!" or "[target] resists!" | loads occupant if conditions met, displays message based on success (83-102) |
  | relaymove (mob movement) | occupant in carrier | 0 | movement request passed to parent | occupant can influence carrier movement (104-117) |
  | container_resist | occupant | 0 | "[occupant] struggles out of [src]." | occupant escapes if not locked (119-142) |
- Mechanics: Exited() proc removes occupant from list and decrements occupant_weight when exiting; handle_atom_del() removes deleted occupants; examine shows what's inside; open/locked state tracked separately; max 3 occupants or MOB_SIZE_SMALL total weight (32-50, 144-155)

---

## Coverage

**Total list entries:** 39  
**Documented with real data:** 39  
**NOT FOUND:** 0

All 39 item types documented with file paths and line numbers.
