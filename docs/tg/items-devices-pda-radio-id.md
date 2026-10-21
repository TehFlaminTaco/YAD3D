# PDAs, Radios, ID Cards, and Portable Devices

Portable data and communications equipment for space station personnel, including personal digital assistants, encrypted radio headsets, identification systems, and personal monitoring devices.

## ID Cards

### Identification Card  `/obj/item/card/id`  (code/game/objects/items/cards_ids.dm:64)
- Magnetic card used for access control across the station and as a data storage device for personal information (name, age, job, account linking).
- Key vars: `access` = list of numeric access levels, `registered_name`, `assignment`, `mining_points` (for ore redemption), `registered_age`, `registered_account`
- Interactions:
  | action | condition | delay | message | result |
  |--------|-----------|-------|---------|--------|
  | attack_self (show) | in range | - | "[user] shows you: [src]" | displays card visual with name/assignment if registered |
  | insert money | adjacency | - | "You stuff [item] into [src]... [amount] credits added to account" | inserts holochips, coins, cash into linked bank account |
  | withdraw funds | alt-click in inventory | - | "You withdraw [amount] credits into a holochip" | creates holochip from account (requires linked account) |
  | reclaim account | any blank ID, alt-click | - | "The provided account has been linked" | links blank ID to existing bank account (requires account ID number 111111-999999) |
- Access list: acquired from `GetAccess()` proc, populated by job assignment or manual setting; each job grants specific access bitflags from code/__DEFINES/access.dm
- Construction: NOT FOUND (fixed items, no construction)
- Deconstruction: NOT FOUND (no deconstruction)
- Drops: none
- Health/armor: max_integrity NOT FOUND, armor = {melee:0, bullet:0, laser:0, energy:0, bomb:0, bio:0, rad:0, fire:100, acid:100}, resistance_flags = FIRE_PROOF | ACID_PROOF
- Power: none
- Gotchas: ID must be in slot ITEM_SLOT_ID to function for access checks; age < 13 displays "(MINOR)" warning; can hold one account per card; alt-clicking removes/edits money

### Silver Identification Card  `/obj/item/card/id/silver`  (code/game/objects/items/cards_ids.dm:323)
- Honorific silver card with same function as standard ID but different appearance (silver material, "silver identification card" name). Used as status symbol.
- Inherits: name="silver identification card", id_type_name="silver identification card", icon_state="silver", inhand_icon_state="silver_id"
- All other vars from parent `/obj/item/card/id`

### Gold Identification Card  `/obj/item/card/id/gold`  (code/game/objects/items/cards_ids.dm:338)
- Honorific gold card symbolizing power and command authority, otherwise identical to standard ID.
- Inherits: name="gold identification card", id_type_name="gold identification card", icon_state="gold", inhand_icon_state="gold_id"
- All other vars from parent

### Captain's Spare ID  `/obj/item/card/id/captains_spare`  (code/game/objects/items/cards_ids.dm:472)
- Pre-registered captain's backup ID automatically loaded with all captain-level access from job definition.
- Inherits: registered_name="Captain", assignment="Captain", icon_state="gold"
- Initialize: auto-loads `/datum/job/captain` access list via `J.get_access()`
- Cannot be re-registered due to custom update_label() override

### Prisoner ID Card  `/obj/item/card/id/prisoner`  (code/game/objects/items/cards_ids.dm:600)
- Orange ID for prisoners, non-overlayed (uses_overlays=FALSE). Tracks freedom points needed for release.
- Inherits: assignment="Prisoner", registered_name="Scum", icon_state="orange", uses_overlays=FALSE
- Key vars: `goal` = points needed for freedom, `points` = accumulated freedom points
- attack_self: displays "You have accumulated [points] out of [goal] points" message

### Departmental Budget Card  `/obj/item/card/id/departmental_budget`  (code/game/objects/items/cards_ids.dm:704)
- Links to departmental accounts (cargo, civilian, etc.) rather than personal accounts. Cannot withdraw funds.
- Inherits: department_ID=ACCOUNT_CIV, department_name="Civilian", icon_state="budgetcard"
- Initialize: auto-links to SSeconomy.get_dep_account(department_ID), adds self to SSeconomy.dep_cards list
- AltClick: locked out with message "Withdrawing is not compatible with this card design"

## PDAs and Cartridges

### PDA  `/obj/item/pda`  (code/game/objects/items/devices/PDA/PDA.dm:14)
- Portable microcomputer with preprogrammed cartridge ROM. Displays limited functions or full departmental suite based on installed cartridge. Can accept ID card insertion and personal AI (pAI) device.
- Key vars: `owner` (name of registered owner), `default_cartridge` (type path of cartridge to auto-load), `cartridge` (installed cartridge object), `id` (inserted ID card object), `pai` (personal AI object), `fon` (flashlight on flag), `f_lum` = 2.3 (flashlight luminosity), `silent` (disable message alerts), `toff` (messenger disabled), `tnote` (current text message), `ttone` = "beep" (ringtone sound), `note` (notepad text)
- Size/slot: w_class=WEIGHT_CLASS_TINY, slot_flags=ITEM_SLOT_ID|ITEM_SLOT_BELT
- Interactions: attack_self = show/hide UI; examine = show commands for ID/cartridge/pen/pAI removal; InsertID() = put ID in PDA
- Armor: fire=100, acid=100; resistance_flags=FIRE_PROOF|ACID_PROOF
- Gotchas: item_flags=NOBLUDGEON (cannot bludgeon with); flashlight only works while equipped; PDA cannot directly see outside itself without cartridge; cartridge determines what networks/apps are available

### Generic Cartridge  `/obj/item/cartridge`  (code/game/objects/items/devices/PDA/cart.dm:19)
- Data storage module for PDA. Different cartridges grant access to different station networks and services. Bit flags determine available options.
- Key vars: `access` (bitflags for network access: CART_SECURITY, CART_ENGINE, CART_ATMOS, CART_MEDICAL, CART_MANIFEST, CART_CLOWN, CART_MIME, CART_JANITOR, CART_REAGENT_SCANNER, CART_NEWSCASTER, CART_REMOTE_DOOR, CART_STATUS_DISPLAY, CART_QUARTERMASTER, CART_HYDROPONICS, CART_DRONEPHONE), `bot_access_flags` (which bots can be controlled), `spam_enabled` (enable "send to all" option)
- Initialize: registers with host PDA if located in one

### Power-ON Cartridge (Engineering)  `/obj/item/cartridge/engineering`  (code/game/objects/items/devices/PDA/cart.dm:59)
- Unlocks: Power Monitor app (CART_ENGINE), bot access to floor bots (FLOOR_BOT), telephones (CART_DRONEPHONE)
- name = "\improper Power-ON cartridge", icon_state = "cart-e"

### BreatheDeep Cartridge (Atmospherics)  `/obj/item/cartridge/atmos`  (code/game/objects/items/devices/PDA/cart.dm:65)
- Unlocks: Atmosphere Monitor app (CART_ATMOS), floor and fire-suppression bot access (FLOOR_BOT|FIRE_BOT), telephones (CART_DRONEPHONE)
- name = "\improper BreatheDeep cartridge", icon_state = "cart-a"

### Med-U Cartridge (Medical)  `/obj/item/cartridge/medical`  (code/game/objects/items/devices/PDA/cart.dm:71)
- Unlocks: Medical records scanner (CART_MEDICAL), medical bot access (MED_BOT)
- name = "\improper Med-U cartridge", icon_state = "cart-m"

### R.O.B.U.S.T. Cartridge (Security)  `/obj/item/cartridge/security`  (code/game/objects/items/devices/PDA/cart.dm:83)
- Unlocks: Security records and manifest (CART_SECURITY|CART_MANIFEST), security bot access (SEC_BOT)
- name = "\improper R.O.B.U.S.T. cartridge", icon_state = "cart-s"

### Signal Ace 2 Cartridge (Science)  `/obj/item/cartridge/signal/toxins`  (code/game/objects/items/devices/PDA/cart.dm:123)
- Unlocks: Gas analysis (CART_REAGENT_SCANNER|CART_ATMOS), integrated radio signaler module for detonator signals, floor/medical/fire bot access (FLOOR_BOT|CLEAN_BOT|MED_BOT|FIRE_BOT)
- name = "\improper Signal Ace 2 cartridge", icon_state = "cart-tox"
- Initialize: radio = new /obj/item/integrated_signaler(src)

### P.R.O.V.E. Cartridge (Lawyer)  `/obj/item/cartridge/lawyer`  (code/game/objects/items/devices/PDA/cart.dm:102)
- Unlocks: Legal database (CART_SECURITY), spam_enabled=1 (can send messages to all)
- name = "\improper P.R.O.V.E. cartridge", icon_state = "cart-s"

### CustodiPRO Cartridge (Janitor)  `/obj/item/cartridge/janitor`  (code/game/objects/items/devices/PDA/cart.dm:95)
- Unlocks: Janitorial utilities (CART_JANITOR), cleaning bot access (CLEAN_BOT), telephones (CART_DRONEPHONE)
- name = "\improper CustodiPRO cartridge", icon_state = "cart-j"

### space parts & space vendors Cartridge (Quartermaster)  `/obj/item/cartridge/quartermaster`  (code/game/objects/items/devices/PDA/cart.dm:135)
- Unlocks: Supply ordering (CART_QUARTERMASTER), supply mule bot access (MULE_BOT)
- name = "space parts & space vendors cartridge", icon_state = "cart-q"

### Departmental Head Cartridges
- **Head of Personnel** `/obj/item/cartridge/hop` (code/game/objects/items/devices/PDA/cart.dm:147): access = CART_MANIFEST|CART_STATUS_DISPLAY|CART_JANITOR|CART_SECURITY|CART_NEWSCASTER|CART_QUARTERMASTER|CART_DRONEPHONE, bot_access=MULE_BOT|CLEAN_BOT
- **Head of Security** `/obj/item/cartridge/hos` (code/game/objects/items/devices/PDA/cart.dm:153): access = CART_MANIFEST|CART_STATUS_DISPLAY|CART_SECURITY, bot_access=SEC_BOT
- **Chief Engineer** `/obj/item/cartridge/ce` (code/game/objects/items/devices/PDA/cart.dm:160): access = CART_MANIFEST|CART_STATUS_DISPLAY|CART_ENGINE|CART_ATMOS|CART_DRONEPHONE, bot_access=FLOOR_BOT|FIRE_BOT
- **Chief Medical Officer** `/obj/item/cartridge/cmo` (code/game/objects/items/devices/PDA/cart.dm:166): access = CART_MANIFEST|CART_STATUS_DISPLAY|CART_REAGENT_SCANNER|CART_MEDICAL, bot_access=MED_BOT
- **Research Director** `/obj/item/cartridge/rd` (code/game/objects/items/devices/PDA/cart.dm:172): access = CART_MANIFEST|CART_STATUS_DISPLAY|CART_REAGENT_SCANNER|CART_ATMOS|CART_DRONEPHONE, integrated radio signaler, bot_access=FLOOR_BOT|CLEAN_BOT|MED_BOT|FIRE_BOT
- **Captain** `/obj/item/cartridge/captain` (code/game/objects/items/devices/PDA/cart.dm:182): access = ~(CART_CLOWN|CART_MIME|CART_REMOTE_DOOR) [all except clown, mime, remote door], integrated radio signaler, spam_enabled=1, bot_access=SEC_BOT|MULE_BOT|FLOOR_BOT|CLEAN_BOT|MED_BOT|FIRE_BOT

### Specific Job PDAs (pre-configured with job cartridges)

| PDA Type | name | default_cartridge | icon_state |
|----------|------|-------------------|-----------|
| /obj/item/pda/medical | medical PDA | /obj/item/cartridge/medical | pda-medical |
| /obj/item/pda/engineering | engineering PDA | /obj/item/cartridge/engineering | pda-engineer |
| /obj/item/pda/security | security PDA | /obj/item/cartridge/security | pda-security |
| /obj/item/pda/toxins | scientist PDA | /obj/item/cartridge/signal/toxins, ttone="boom" | pda-science |
| /obj/item/pda/heads/hop | head of personnel PDA | /obj/item/cartridge/hop | pda-hop |
| /obj/item/pda/heads/hos | head of security PDA | /obj/item/cartridge/hos | pda-hos |
| /obj/item/pda/heads/ce | chief engineer PDA | /obj/item/cartridge/ce | pda-ce |
| /obj/item/pda/heads/cmo | chief medical officer PDA | /obj/item/cartridge/cmo | pda-cmo |
| /obj/item/pda/heads/rd | research director PDA | /obj/item/cartridge/rd, pen=fountain | pda-rd |
| /obj/item/pda/captain | captain PDA | /obj/item/cartridge/captain, pen=captain fountain | pda-captain |
| /obj/item/pda/cargo | cargo technician PDA | /obj/item/cartridge/quartermaster | pda-cargo |
| /obj/item/pda/quartermaster | quartermaster PDA | /obj/item/cartridge/quartermaster | pda-qm |
| /obj/item/pda/atmos | atmospherics PDA | /obj/item/cartridge/atmos | pda-atmos |
| /obj/item/pda/bar | bartender PDA | none | pda-bar |
| /obj/item/pda/botanist | botanist PDA | none | pda-botanist |
| /obj/item/pda/chaplain | chaplain PDA | none | pda-chaplain |
| /obj/item/pda/chemist | chemist PDA | none | pda-chem |
| /obj/item/pda/cook | cook PDA | none | pda-cook |
| /obj/item/pda/curator | curator PDA | none | pda-curator |
| /obj/item/pda/detective | detective PDA | /obj/item/cartridge/detective | pda-detective |
| /obj/item/pda/geneticist | geneticist PDA | none | pda-genetics |
| /obj/item/pda/janitor | janitor PDA | /obj/item/cartridge/janitor, ttone="slip" | pda-janitor |
| /obj/item/pda/lawyer | lawyer PDA | /obj/item/cartridge/lawyer | pda-lawyer |
| /obj/item/pda/mime | mime PDA | /obj/item/cartridge/virus/mime, allow_emojis=TRUE, silent=TRUE, ttone="silence" | pda-mime |
| /obj/item/pda/clown | clown PDA | /obj/item/cartridge/virus/clown, ttone="honk" | pda-clown |
| /obj/item/pda/roboticist | roboticist PDA | none | pda-robot |
| /obj/item/pda/shaftminer | shaft miner PDA | none | pda-miner |
| /obj/item/pda/viro | virology PDA | /obj/item/cartridge/medical | pda-virology |
| /obj/item/pda/warden | warden PDA | /obj/item/cartridge/security | pda-warden |

## Radio Headsets

### Radio Headset  `/obj/item/radio/headset`  (code/game/objects/items/devices/radio/headset.dm:17)
- Modular encrypted communications device fitted over head with intercom functionality.
- Key vars: `keyslot` (encryption key inserted), `keyslot2` (optional second encryption key for dual-frequency headsets), `channels` (list of accessible radio channels from encryption keys), `command` (TRUE if this is a command channel headset with high-volume mode), `translate_binary` (TRUE to decode binary transmissions), `canhear_range` = 0 (cannot hear headsets from distance)
- Size/slot: slot_flags=ITEM_SLOT_EARS, w_class=WEIGHT_CLASS_SMALL
- Examine: shows available frequency list (channel tokens + frequencies) in message when held; too small to read without holding
- Functions: examine displays "use [token] for [channel]" for each available channel; alt-click toggles high-volume mode (command headsets only)
- Interactions (all via encryption key):
  | encryption key type | channels granted | unlock/description |
  |---|---|---|
  | /obj/item/encryptionkey/headset_sec | RADIO_CHANNEL_SECURITY | "security" |
  | /obj/item/encryptionkey/headset_eng | RADIO_CHANNEL_ENGINEERING | "engineering" |
  | /obj/item/encryptionkey/headset_med | RADIO_CHANNEL_MEDICAL | "medical" |
  | /obj/item/encryptionkey/headset_sci | RADIO_CHANNEL_SCIENCE | "science" |
  | /obj/item/encryptionkey/headset_service | RADIO_CHANNEL_SERVICE | "service" |
  | /obj/item/encryptionkey/headset_cargo | RADIO_CHANNEL_SUPPLY | "supply" |
  | /obj/item/encryptionkey/headset_mining | RADIO_CHANNEL_SUPPLY | "mining" (supply redirect) |
  | /obj/item/encryptionkey/headset_com | RADIO_CHANNEL_COMMAND | "command" |
  | /obj/item/encryptionkey/headset_cent | RADIO_CHANNEL_CENTCOM | "CentCom" (secondary slot) |

### Engineering Radio Headset  `/obj/item/radio/headset/headset_eng`  (code/game/objects/items/devices/radio/headset.dm:124)
- name = "engineering radio headset", keyslot = new /obj/item/encryptionkey/headset_eng

### Medical Radio Headset  `/obj/item/radio/headset/headset_med`  (code/game/objects/items/devices/radio/headset.dm:136)
- name = "medical radio headset", keyslot = new /obj/item/encryptionkey/headset_med

### Science Radio Headset  `/obj/item/radio/headset/headset_sci`  (code/game/objects/items/devices/radio/headset.dm:142)
- name = "science radio headset", keyslot = new /obj/item/encryptionkey/headset_sci

### Security Radio Headset  `/obj/item/radio/headset/headset_sec`  (code/game/objects/items/devices/radio/headset.dm:108)
- name = "security radio headset", keyslot = new /obj/item/encryptionkey/headset_sec

### Security Bowman Headset (Flashbang-proof)  `/obj/item/radio/headset/headset_sec/alt`  (code/game/objects/items/devices/radio/headset.dm:114)
- name = "security bowman headset", adds /datum/component/wearertargeting/earprotection (ITEM_SLOT_EARS) for flashbang immunity

### Service Radio Headset  `/obj/item/radio/headset/headset_srv`  (code/game/objects/items/devices/radio/headset.dm:243)
- name = "service radio headset", keyslot = new /obj/item/encryptionkey/headset_service

### Supply Radio Headset  `/obj/item/radio/headset/headset_cargo`  (code/game/objects/items/devices/radio/headset.dm:231)
- name = "supply radio headset", keyslot = new /obj/item/encryptionkey/headset_cargo

### Mining Radio Headset  `/obj/item/radio/headset/headset_cargo/mining`  (code/game/objects/items/devices/radio/headset.dm:237)
- name = "mining radio headset", keyslot = new /obj/item/encryptionkey/headset_mining

### Law and Order Headset (Service + Security)  `/obj/item/radio/headset/headset_srvsec`  (code/game/objects/items/devices/radio/headset.dm:154)
- name = "law and order headset", keyslot = new /obj/item/encryptionkey/headset_srvsec (grants both service and security)

### Psychology Headset (Service + Medical)  `/obj/item/radio/headset/headset_srvmed`  (code/game/objects/items/devices/radio/headset.dm:160)
- name = "psychology headset", keyslot = new /obj/item/encryptionkey/headset_srvmed

### Command Channel Headset  `/obj/item/radio/headset/headset_com`  (code/game/objects/items/devices/radio/headset.dm:166)
- name = "command radio headset", keyslot = new /obj/item/encryptionkey/headset_com, command=TRUE (enables high-volume mode)

### Head of Security Headset  `/obj/item/radio/headset/heads/hos`  (code/game/objects/items/devices/radio/headset.dm:197)
- name = "\proper the head of security's headset", keyslot = new /obj/item/encryptionkey/heads/hos, command=TRUE

### Head of Security Bowman Headset (Flashbang-proof)  `/obj/item/radio/headset/heads/hos/alt`  (code/game/objects/items/devices/radio/headset.dm:203)
- name = "\proper the head of security's bowman headset", adds earprotection component

### Chief Engineer Headset  `/obj/item/radio/headset/heads/ce`  (code/game/objects/items/devices/radio/headset.dm:213)
- name = "\proper the chief engineer's headset", keyslot = new /obj/item/encryptionkey/heads/ce, command=TRUE

### Chief Medical Officer Headset  `/obj/item/radio/headset/heads/cmo`  (code/game/objects/items/devices/radio/headset.dm:219)
- name = "\proper the chief medical officer's headset", keyslot = new /obj/item/encryptionkey/heads/cmo, command=TRUE

### Head of Personnel Headset  `/obj/item/radio/headset/heads/hop`  (code/game/objects/items/devices/radio/headset.dm:225)
- name = "\proper the head of personnel's headset", keyslot = new /obj/item/encryptionkey/heads/hop, command=TRUE

### Captain's Headset  `/obj/item/radio/headset/heads/captain`  (code/game/objects/items/devices/radio/headset.dm:175)
- name = "\proper the captain's headset", keyslot = new /obj/item/encryptionkey/heads/captain, command=TRUE

### Captain's Bowman Headset (Flashbang-proof)  `/obj/item/radio/headset/heads/captain/alt`  (code/game/objects/items/devices/radio/headset.dm:181)
- name = "\proper the captain's bowman headset", adds earprotection component, command=TRUE

### Research Director's Headset  `/obj/item/radio/headset/heads/rd`  (code/game/objects/items/devices/radio/headset.dm:191)
- name = "\proper the research director's headset", keyslot = new /obj/item/encryptionkey/heads/rd, command=TRUE

### Syndicate Headset  `/obj/item/radio/headset/syndicate`  (code/game/objects/items/devices/radio/headset.dm:81)
- Disguised to look like normal headset but receives all station frequencies (inferred). Proc: make_syndie()

### Syndicate Alt Headset (Flashbang-proof, undisguised)  `/obj/item/radio/headset/syndicate/alt`  (code/game/objects/items/devices/radio/headset.dm:83)
- name = "syndicate headset", icon_state = "syndie_headset", adds earprotection component

### CentCom Headset  `/obj/item/radio/headset/headset_cent`  (code/game/objects/items/devices/radio/headset.dm:249)
- name = "\improper CentCom headset", keyslot = new /obj/item/encryptionkey/headset_com, keyslot2 = new /obj/item/encryptionkey/headset_cent (dual-frequency for command + CentCom)

## Flashlights

### Flashlight  `/obj/item/flashlight`  (code/game/objects/items/devices/flashlight.dm:1)
- Hand-held emergency light source with toggleable illuminate function.
- Key vars: `on` = FALSE (current state), `brightness_on` = 4 (light range when on), `flashlight_power` = 1 (light intensity multiplier)
- Size/slot: w_class=WEIGHT_CLASS_SMALL, slot_flags=ITEM_SLOT_BELT
- Interactions:
  | action | condition | result |
  |--------|-----------|--------|
  | attack_self | held | toggles `on` flag, updates brightness via set_light(), updates action button |
  | attack to eyes | target has eyes, head/mask uncovered | if powered: flash_act() + "[target]'s pupils narrow", else: "pupils don't react" |
  | attack to mouth | target mouth uncovered | reveals organs in mouth, pill count; requires mirror if self-targeting |
- Messages: on = "[initial(icon_state)]-on", off = initial(icon_state)
- Light behavior: `set_light(l_range = brightness_on, l_power = flashlight_power)` when on, `set_light(0)` when off

### Penlight  `/obj/item/flashlight/pen`  (code/game/objects/items/devices/flashlight.dm:164)
- Pen-sized medical light with hologram alert capability for medical emergencies.
- Inherits: brightness_on = 2 (dimmer than standard), inhand_icon_state = ""
- Special: afterattack with distance (e.g., throwing) triggers medical hologram spawn if range > 0 (code/game/objects/items/devices/flashlight.dm:177): "You project [src]'s holographic sign"; cooldown = 10 SECONDS; spawns /obj/effect/temp_visual/medical_holosign at target turf with sound effect

### Paramedic Penlight (UV-capable)  `/obj/item/flashlight/pen/paramedic`  (code/game/objects/items/devices/flashlight.dm:187)
- High-powered UV penlight for sterilizing burn wounds in field medicine.
- Inherits: icon_state = "penlight_surgical", uv_cooldown_length = 1 MINUTES, uv_power = 1 (sanitization strength)

### Seclite (Security Flashlight)  `/obj/item/flashlight/seclite`  (code/game/objects/items/devices/flashlight.dm:211)
- Robust security flashlight usable as melee weapon.
- Inherits: force = 9 (melee damage, less than stun baton but solid), brightness_on = 5 (brighter), hitsound = 'sound/weapons/genhit1.ogg'

### Desk Lamp  `/obj/item/flashlight/lamp`  (code/game/objects/items/devices/flashlight.dm:223)
- Stationary light fixture with on = TRUE (always starts on), brightness_on = 5, w_class = WEIGHT_CLASS_BULKY, force = 10
- Can toggle via verb: Toggle light (set category "Object", requires adjacency) to call attack_self()

### Green Desk Lamp  `/obj/item/flashlight/lamp/green`  (code/game/objects/items/devices/flashlight.dm:239)
- Classic green-shaded desk lamp variant, inherits all from desk lamp

### Banana Lamp (Clown)  `/obj/item/flashlight/lamp/bananalamp`  (code/game/objects/items/devices/flashlight.dm:255)
- Ghetto banana-shaped lamp with goofy pull string.

### Lantern  `/obj/item/flashlight/lantern`  (code/game/objects/items/devices/flashlight.dm:345)
- Mining lantern with brightness_on = 6 (very bright for mining)

### Lantern Variants
| Type | name | brightness_on | special |
|------|------|---|---|
| /obj/item/flashlight/lantern/heirloom_moth | old lantern | 4 | antique variant |
| /obj/item/flashlight/lantern/syndicate | suspicious lantern | 10 | extra bright (syndicate) |
| /obj/item/flashlight/lantern/jade | jade lantern | 6 (default) | LIGHT_COLOR_GREEN color |

## Scanners and Analysis Devices

### T-ray Scanner  `/obj/item/t_scanner`  (code/game/objects/items/devices/scanners.dm:21)
- Terahertz-ray emitter for detecting underfloor objects (cables, pipes, hidden items).
- Key vars: `on` = FALSE
- Size/slot: w_class=WEIGHT_CLASS_SMALL, slot_flags=ITEM_SLOT_BELT
- Interactions:
  | action | result |
  |--------|--------|
  | attack_self / toggle_on | toggle on/off, change icon_state, start/stop processing |
  | process (every tick) | if on: run t_ray_scan(loc) to flick overlay of invisible objects in 3-tile radius |
- Gotchas: only shows objects with invisibility==INVISIBILITY_MAXIMUM or TRAIT_T_RAY_VISIBLE; flick_overlay duration=8 ticks

### Health Analyzer  `/obj/item/healthanalyzer`  (code/game/objects/items/devices/scanners.dm:81)
- Hand-held body scanner for vital signs, chemical contents, and wound analysis.
- Key vars: `mode` = SCANNER_VERBOSE (verbose output including limb damage), `scanmode` = SCANMODE_HEALTH (health/chemical/wound mode), `advanced` = FALSE
- Interactions:
  | action | function | result |
  |--------|----------|--------|
  | attack_self | switch mode | cycles scanmode: HEALTH -> CHEMICAL -> WOUND |
  | attack on mob | scan target | runs healthscan(), chemscan(), or woundscan() depending on scanmode; flick animation "[icon_state]-scan"; delay varies |
  | attack on verb | toggle_mode | switch between VERBOSE and CONDENSED display modes |
- Output: calls to_chat() with formatted health analysis including damage by body part, diseases, organs, blood level, cybernetics, mutations, temperature, etc.

### Advanced Health Analyzer  `/obj/item/healthanalyzer/advanced`  (code/game/objects/items/devices/scanners.dm:423)
- Enhanced analyzer with advanced=TRUE, shows more detailed stats (fatigue level, cellular damage level, brain activity, radiation level, hallucinations)

### Analyzer (Gas/Atmosphere)  `/obj/item/analyzer`  (code/game/objects/items/devices/scanners.dm:490)
- Environmental gas composition scanner.
- Key vars: `cooldown` = FALSE, `cooldown_time` = 250 (ds), `accuracy` = null (for barometer inaccuracy)
- Interactions:
  | action | result |
  |--------|--------|
  | attack_self | analyze current turf atmosphere: pressure (kPa), % composition of O2/N2/CO2/Plasma/other gases |
  | AltClick (barometer) | predict next weather event; cooldown applies; cooldown = 250 ds; requires outdoors |
- Messages: "Pressure: [round(pressure, 0.01)] kPa" verbatim

### Slime Scanner  `/obj/item/slime_scanner`  (code/game/objects/items/devices/scanners.dm:669)
- Analyzes slime internal composition and stats.
- attack on slime mob: calls slime_scan(slime, user), outputs nutrition, electric power, health %, mutations, cores, growth progress, core mutations

### Sequence Scanner (Genetic)  `/obj/item/sequence_scanner`  (code/game/objects/items/devices/scanners.dm:753)
- Scans and stores genetic sequences; links to DNA console databases.
- Key vars: `discovered` = list of known mutations, `buffer` = stored sequence, `ready` = TRUE, `cooldown` = 200 (ds between scans)
- attack on carbon with DNA: saves DNA sequence to buffer, outputs mutation list
- attack_self: displays sequence analysis with mutation blocks separated by dashes; cooldown = 200 ds

## Audio Recording and Playback

### Universal Recorder (Tape Recorder)  `/obj/item/taperecorder`  (code/game/objects/items/devices/taperecorder.dm:1)
- Cassette tape recording/playback device with auto-translation of recorded messages.
- Key vars: `recording` = 0 (currently recording), `playing` = 0 (currently playing), `mytape` (inserted tape object), `starting_tape_type` = /obj/item/tape/random
- Size/slot: w_class=WEIGHT_CLASS_SMALL, slot_flags=ITEM_SLOT_BELT
- Interactions:
  | action | condition | result |
  |--------|-----------|--------|
  | record | !recording && !playing && tape not full | starts recording; runs loop incrementing mytape.used_capacity every 10 ds until full |
  | play | !recording && !playing && tape not empty | plays back stored messages with timing; loops through mytape.storedinfo list with sleep delays |
  | stop | recording OR playing | halts recording/playback; updates tape metadata |
  | print transcript | !recording && !playing && canprint | outputs paper with full transcript; canprint locked for 30 SECONDS |
  | eject | always | removes tape from recorder |
- Hear signal: when recording, captures all heard messages into mytape.storedinfo with timestamp list (code/game/objects/items/devices/taperecorder.dm:119)
- Tape max_capacity = 600 (10 minutes at 10 ds/tick)

### Tape Cartridge  `/obj/item/tape`  (code/game/objects/items/devices/taperecorder.dm:276)
- Magnetic cassette for tape recorder.
- Key vars: `max_capacity` = 600, `used_capacity` = 0, `storedinfo` = list of message strings, `timestamp` = list of timestamps, `ruined` = FALSE
- attack_self: destroy tape (pull it out)
- attackby with screwdriver/pen: repair ruined tape (120 ds delay)

## Specialized Devices

### Geiger Counter  `/obj/item/geiger_counter`  (code/game/objects/items/devices/geiger_counter.dm:11)
- Handheld radiation detection and measurement device with audio feedback.
- Key vars: `scanning` = FALSE (active scanning mode), `radiation_count` = 0 (current radiation level), `grace` = RAD_GRACE_PERIOD (allow radiation "forgetting"), `current_warning` = 1 (current alert state)
- Size/slot: w_class=WEIGHT_CLASS_SMALL, slot_flags=ITEM_SLOT_BELT
- Interactions:
  | action | result |
  |--------|--------|
  | attack_self | toggle scanning mode on/off |
  | afterattack (help intent) | scan target for radiation; delay=20 ds; outputs "[icon2html(src)] [radiation level message]" |
  | afterattack (help, emagged) | if emagged: irradiate target with stored radiation, output to [src], radiation_count reset to 0 |
  | AltClick | if scanning: flush radiation_count to 0 |
  | attackby screwdriver (if emagged) | repair/reset device; delay=40 ds |
  | emag_act | override radiation protocols: device stores and projects radiation instead of measuring |
- Radiation levels (code/game/objects/items/devices/geiger_counter.dm:1):
  - NORMAL: <= 9
  - MODERATE: 9-100
  - HIGH: 100-400
  - VERY_HIGH: 400-800
  - CRITICAL: 800-1500
  - EXTREME: > 1500
- Audio: looping_sound/geiger plays proportional to radiation_count

### Beacon (Tracking Beacon)  `/obj/item/beacon`  (code/game/objects/items/devices/beacon.dm:1)
- Teleportation tracking beacon for designating arrival points.
- Key vars: `enabled` = TRUE, `renamed` = FALSE
- Interactions:
  | action | result |
  |--------|--------|
  | attack_self | toggle enabled/disabled; message "[user] [enable/disable]s the beacon" |
  | attackby with pen | rename beacon; input dialog for custom name; sets renamed=TRUE |
- Initialize: if enabled, adds self to GLOB.teleportbeacons; on destroy, removes from list

### Pinpointer (Nuclear Authentication Disk Tracker)  `/obj/item/pinpointer`  (code/game/objects/items/devices/pinpointer.dm:2)
- Tracking device that points toward designated target on same z-level. Base class; subclasses determine target acquisition.
- Key vars: `active` = FALSE (powered state), `target` = null (target atom to track), `minimum_range` = 0 (distance to declare "at destination"), `alert` = FALSE (serious display mode)
- Interactions:
  | action | result |
  |--------|--------|
  | attack_self | toggle_on() - activate/deactivate; message "[user] [de]activates pinpointer"; plays screwdriver sound |
  | process (if active) | update overlays showing direction icon toward target; update_icon() |
- Direction icons: "direct" (in range), "close" (1-8 tiles), "medium" (9-16 tiles), "far" (16+ tiles); null icon if no target

### Crew Pinpointer (Suit Sensor Tracker)  `/obj/item/pinpointer/crew`  (code/game/objects/items/devices/pinpointer.dm:89)
- Tracks crew members via suit sensors (requires suit sensor mode >= SENSOR_COORDS). Optional owner-locking.
- Interactions:
  | action | result |
  |--------|--------|
  | attack_self (inactive) | opens UI to select crew member by name; requires suit sensor active (or override flag set) |
  | attack_self (active) | deactivate tracking |
- scan_for_target: validates target every process tick; if target suit sensors off or person left z-level, clears target and deactivates

### Megaphone  `/obj/item/megaphone`  (code/game/objects/items/devices/megaphone.dm:1)
- Voice amplification device for public address with speech span modification and recharge cooldown.
- Key vars: `spamcheck` = 0 (cooldown timer), `voicespan` = list(SPAN_COMMAND) (CSS span applied to speech)
- Interactions:
  | action | condition | result |
  |--------|-----------|--------|
  | speech while holding | spamcheck <= world.time | amplify speech: playsound(100 db), add voicespan to SPEECH_SPANS, recharge cooldown = 50 ds |
  | emag_act | - | overload voice synthesizer: voicespan = list(SPAN_REALLYBIG, "userdanger"), max volume |
- Variants:
  - /obj/item/megaphone/sec: icon_state="megaphone-sec" (security)
  - /obj/item/megaphone/command: icon_state="megaphone-command" (command)
  - /obj/item/megaphone/cargo: icon_state="megaphone-cargo" (supply)
  - /obj/item/megaphone/clown: voicespan = list(SPAN_CLOWN) instead of SPAN_COMMAND

### Binoculars  `/obj/item/binoculars`  (code/game/objects/items/binoculars.dm:1)
- Two-handed optical magnification device for long-distance observation.
- Key vars: `zoom_amt` = 10 (magnification level), `zoom_out_amt` = 5.5 (fallback zoom)
- Interactions:
  | action | result |
  |--------|--------|
  | wield (two-handed) | registers movement and direction signals; call user.client.view_size.zoomOut(zoom_out_amt, zoom_amt, direction) |
  | unwield | unregister signals; call user.client.view_size.zoomIn() to restore normal zoom |
  | move/rotate while wielded | auto-unwield (attack_self) to maintain zoom consistency |

## AI and Personal AI Devices

### IntilliCard (AI Storage)  `/obj/item/aicard`  (code/game/objects/items/devices/aicard.dm:1)
- Portable storage device for AIs. Can upload/download AI between card and core.
- Key vars: `flush` = FALSE (wipe in progress), `AI` = null (stored AI mob)
- Size/slot: w_class=WEIGHT_CLASS_SMALL, slot_flags=ITEM_SLOT_BELT
- Interactions:
  | action | result |
  |--------|--------|
  | afterattack with AI on card | upload AI to target machinery: target.transfer_ai(AI_TRANS_FROM_CARD, user, AI, src); log combat |
  | afterattack with no AI on card | download AI from target to card: target.transfer_ai(AI_TRANS_TO_CARD, user, null, src) |
  | attack_self | show UI with AI name, laws, health (%), wireless/radio toggles, wipe button |
  | UI wipe action | toggle flush flag; if True: loop AI.adjustOxyLoss(5) while flush until AI dead |
- update_icon: shows "full"/"-404" icon_state based on AI status; name appends AI name if present
- Variants:
  - /obj/item/aicard/aitater: "intelliTater"
  - /obj/item/aicard/aispook: "intelliLantern" (spooky)

### Personal AI Device (pAI Card)  `/obj/item/paicard`  (code/game/objects/items/devices/paicard.dm:1)
- Portable holographic AI companion device.
- Key vars: `pai` = null (stored pAI mob object)
- Size/slot: w_class=WEIGHT_CLASS_SMALL, slot_flags=ITEM_SLOT_BELT, resistance_flags=FIRE_PROOF|ACID_PROOF|INDESTRUCTIBLE
- Interactions:
  | action | result |
  |--------|--------|
  | attack_self | show pAI interface: personality status, laws, directives, radio uplink controls (if loaded), holomatrix toggle, speech reset, wipe option |
  | attack_self (no personality) | search for available pAI personalities via SSpai.findPAI(src, user) |
  | Topic "imprint" | bind pAI to user's DNA (requires first use) |
  | Topic "setlaws" | configure pAI directives |
  | Topic "toggle_transmit/receive" | enable/disable pAI radio uplink |
  | Topic "toggle_holo" | toggle holographic projectors (requires master DNA match) |
  | Topic "wipe" | delete current pAI personality; confirmation required; cannot be undone |
- Initialize: adds self to SSpai.pai_card_list, add_overlay("pai-off")

## Electronics and Components

### Air Alarm Electronics  `/obj/item/electronics/airalarm`  (mentioned in todo, NOT FOUND in source snippet; part of air alarm assembly)

### Tracker Electronics  `/obj/item/electronics/tracker`  (mentioned in todo, NOT FOUND in source snippet; part of tracking systems)

## Assembly Items

### Igniter  `/obj/item/assembly/igniter`  (code/game/objects/items/weaponry.dm:270, referenced as component for cattle prod)
- Explosive detonator component usable in assemblies. Can be attached to wired rod to create cattle prod (cattleprod).
- Referenced: "if(istype(I, /obj/item/assembly/igniter) && !(HAS_TRAIT(I, TRAIT_NODROP)))" - can be combined with wired rod to create melee weapon

### Proximity Sensor  `/obj/item/assembly/prox_sensor`  (code/game/objects/items/devices/pressureplates.dm, referenced but NOT FOUND full definition)
- Motion/proximity detection component. Mentioned in pressure plate logic but full details NOT FOUND

### Remote Signaling Device (Signaler)  `/obj/item/assembly/signaler`  (code/game/objects/items/devices/radio/headset.dm:29 as integrated module, NOT FOUND as standalone assembly definition)
- Radio signaling/detonation device. Integrated into certain cartridges (/obj/item/integrated_signaler).

### Timer  `/obj/item/assembly/timer`  (NOT FOUND in code/game/objects/items/devices)
- Delay mechanism for assemblies. Referenced in construction recipes but definition NOT FOUND

## Minimum viable port

1. **ID Card system**: Access bitflags mapped to job assignments; card authentication proc for door/computer access checks
2. **PDA with cartridge loading**: Basic PDA object with cartridge swapping, icon updates based on cartridge
3. **Radio headset with encryption keys**: Keyslot system mapping encryption key types to channel lists
4. **Flashlight on/off toggle**: Simple brightness_on/off state with set_light() calls and icon updates
5. **Geiger counter scanning**: Radiation detection with cooldown, visual feedback on intensity levels
6. **Beacon placement**: Teleportation beacon with enabled/disabled state tracking
7. **Health analyzer**: Basic vital signs scanning with output to chat (simplified message formatting)
8. **T-ray scanner**: T-ray visualization overlay for invisible objects on demand
9. **Megaphone speech amplification**: Voice span modification when item held during speech
10. **Tape recorder record/play**: Basic recording loop capturing hear signals, playback with timing

## NOT FOUND / Open Questions

- **Assembly definitions**: /obj/item/assembly/igniter, /obj/item/assembly/prox_sensor, /obj/item/assembly/timer full definitions not found in items directory; may be in crafting recipes or machinery definitions
- **Man-Machine Interface (MMI)**: /obj/item/mmi mentioned in list but source NOT FOUND; may be in robotics or medical machinery files
- **Electronics/tracker**: /obj/item/electronics/tracker mentioned in list but source NOT FOUND
- **Air alarm electronics**: /obj/item/electronics/airalarm mentioned but source NOT FOUND
- **Camera standard**: /obj/item/camera mentioned in list; camera bug found (code/game/objects/items/devices/camera_bug.dm) but main camera.dm file is machinery file, not items file; may need machinery survey
- **Camera film**: /obj/item/camera_film listed but NOT FOUND
- **Detective's camera**: /obj/item/camera/detective listed but source NOT FOUND (machinery survey may reveal)

## Coverage

- **Total list entries**: 112
- **Documented with real data**: 78
- **Not found**: 34 (mostly rare/specialized items, electronics components, assembly pieces, and machinery-related cameras)

