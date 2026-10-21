# Weapons, Restraints, Flashes, Shields & Grenades

TG weapons (energy and ballistic), melee arms, restraint systems, flash devices, riot shields, and chemical/barrier grenades from tgstation commit 2d6c10c1 (2020-07-06), BoxStation. Covers item mechanics, damage values (deciseconds for time, joules/damage literal), ammo properties, stun models, and interactions. See bottom for minimum viable port.

## Energy Guns

### energy gun  `/obj/item/gun/energy/e_gun`   (code/modules/projectiles/guns/energy/energy_gun.dm:1)
- Hybrid energy gun: disabler and laser. Cell-fed, can toggle fire mode.
- Key vars: `ammo_type = [disabler, laser]` (line 6), `modifystate = 1` (toggle icon on mode switch)
- Interactions:
  | Held item / action | Condition | Delay (ds) | Messages | Result |
  | - | - | - | - | - |
  | Fire | Cell has charge, gun readied | Depends on ammo | Weapon sound: `'sound/weapons/gun/pistol/shot.ogg'` | Fires projectile, consume charge from cell |
- Health / armor: `force = 5` (melee, line 19)
- Power: Uses `cell_type` (auto cell or custom), `use_power` on cell (shoot), idle none
- Gotchas: Has built-in flashlight mount (`can_flashlight = TRUE`, line 8)

### miniature energy gun  `/obj/item/gun/energy/e_gun/mini`   (code/modules/projectiles/guns/energy/energy_gun.dm:14)
- Small pistol-sized energy gun with integrated flashlight; disabler/laser modes. 3-bar charge display.
- Key vars: `cell_type = /obj/item/stock_parts/cell/mini_egun` (line 20), `w_class = WEIGHT_CLASS_SMALL` (line 19), `charge_sections = 3` (line 22), `gunlight_state = "mini-light"` (line 24)
- Health: Inherits parent (`force = 5`)
- Power: Uses mini cell (smaller), built-in flashlight (cannot detach)
- Gotchas: Flashlight auto-spawned on init (line 29), no removable light

### X-01 MultiPhase Energy Gun  `/obj/item/gun/energy/e_gun/hos`   (code/modules/projectiles/guns/energy/energy_gun.dm:52)
- Expensive handmade gun; disabler, laser, and ion modes. No timed recharge.
- Key vars: `cell_type = /obj/item/stock_parts/cell/hos_gun` (line 55), `force = 10` (line 57), `ammo_type = [disabler/hos, laser/hos, ion/hos]` (line 58), `resistance_flags = INDESTRUCTIBLE | LAVA_PROOF | FIRE_PROOF | ACID_PROOF` (line 60)
- Health / armor: `force = 10` (melee)
- Power: Uses hos_gun cell (custom non-recharging)
- Gotchas: Cannot auto-recharge; must be manually charged

### DRAGnet  `/obj/item/gun/energy/e_gun/dragnet`   (code/modules/projectiles/guns/energy/energy_gun.dm:62)
- Dynamic Rapid-Apprehension device; net and trap modes for crowd control.
- Key vars: `ammo_type = [net, trap]` (line 69), `can_flashlight = FALSE` (line 70)
- Interactions: Fires energy snares that slow targets
- Power: Cell-fed, standard e-gun cell mechanics
- Gotchas: Applies movement penalty, not lethal

### laser gun  `/obj/item/gun/energy/laser`   (code/modules/projectiles/guns/energy/laser.dm:1)
- Basic laser: concentrated light beam, passes through glass and thin metal.
- Key vars: `ammo_type = [lasergun]` (line 8), `shaded_charge = 1` (line 10, visual charge indicator)
- Health: `force = 5` (parent item)
- Power: Uses standard cell
- Gotchas: `clumsy_check = 0` on practice variant (line 16)

### practice laser gun  `/obj/item/gun/energy/laser/practice`   (code/modules/projectiles/guns/energy/laser.dm:12)
- Modified laser for target practice; less concentrated, cannot gain ITEM_PERMIT flag.
- Key vars: `ammo_type = [laser/practice]` (line 15), `clumsy_check = 0` (line 16), `item_flags = NONE` (line 17)
- Interactions: Same as laser, but non-lethal variant
- Gotchas: No permit required; disarms clumsy-check safety

### disabler  `/obj/item/gun/energy/disabler`   (code/modules/projectiles/guns/energy/stun.dm:33)
- Self-defense gun: exhausts organic targets, weakens until collapse.
- Key vars: `ammo_type = [disabler]` (line 38), `can_flashlight = TRUE` (line 40)
- Health: `force = 5` (parent)
- Power: Standard cell
- Gotchas: Flashlight mountable

### ion rifle  `/obj/item/gun/energy/ionrifle`   (code/modules/projectiles/guns/energy/special.dm:1)
- Anti-armor weapon; disables mechanical threats. Large, backslot.
- Key vars: `ammo_type = [ion]` (line 12), `w_class = WEIGHT_CLASS_HUGE` (line 9), `slot_flags = ITEM_SLOT_BACK` (line 11), `can_flashlight = TRUE` (line 8), `shaded_charge = TRUE` (line 7)
- Health: `force = 5` (parent)
- Power: Standard cell
- Gotchas: `emp_act(severity)` returns null (line 16-17), immune to EMP

### security temperature gun  `/obj/item/gun/energy/temperature/security`   (code/modules/projectiles/guns/energy/special.dm:313)
- Weapon version of temperature gun; only full-power use allowed to security.
- Key vars: `pin = /obj/item/firing_pin` (line 316, firing pin required), parent is temperature gun
- Inherits from `/obj/item/gun/energy/temperature` (line 305): `ammo_type = [temp, temp/hot]` (line 309), `cell_type = /obj/item/stock_parts/cell/high` (line 310), `pin = null` (line 311, base has none)
- Health: `force = 5` (parent)
- Power: Uses high cell
- Gotchas: Firing pin required on security variant; two modes (heat/cold)

### proto-kinetic accelerator  `/obj/item/gun/energy/kinetic_accelerator`   (code/modules/projectiles/guns/energy/kinetic_accelerator.dm:1)
- Self-recharging mining tool; high damage in low pressure. Has mod capacity system (max 100%).
- Key vars: `ammo_type = [kinetic]` (line 6), `cell_type = /obj/item/stock_parts/cell/emproof` (line 7), `item_flags = NONE` (line 8), `overheat_time = 16` (line 18), `holds_charge = FALSE` (line 19), `modkits = list()` (line 26), `max_mod_capacity = 100` (line 25)
- Interactions:
  | Item | Condition | Delay | Messages | Result |
  | Crowbar | Modkit installed | 100 (audio) | "You pry the modifications out." | Remove all modkits, drop to ground |
  | Modkit | Has capacity | Instant | "You install the modkit." | Add modkit, consume capacity % |
- Projectile: `/obj/projectile/kinetic`, `damage = 40` (line 173), `damage_type = BRUTE` (line 174), `range = 3` (line 176), reduced by 0.25x in high pressure (line 196)
- Power: Emproof cell, no timed recharge but fires then must cool 16 ds (overheat_time)
- Gotchas: Modkit system allows damage/range/AoE mods; pressure affects damage; unique_frequency flag on some variants prevents shared cooldown

---

## Laser / Disabler Ammo and Projectiles

(Ammunition defines behavior; projectiles inherit properties)

**Standard laser** `/obj/item/ammo_casing/energy/lasergun` → `/obj/projectile/beam/laser`
- Damage = 25 (BURN), range = 255, pass through windows

**Disabler** `/obj/item/ammo_casing/energy/disabler` → `/obj/projectile/beam/disabler`
- Stamina damage ~60, no direct HP damage, causes Knockdown

**Electrode (stun bolt)** `/obj/item/ammo_casing/energy/electrode` → `/obj/projectile/beam/stun`
- Stun effect, 5-10 second paralysis, confusion

---

## Melee Weapons

### police baton  `/obj/item/melee/classic_baton`   (code/game/objects/items/melee/misc.dm:167)
- Wooden truncheon for beating criminals; stun when extended. Passive cooldown (40 ds), stamina damage on hit.
- Key vars: `force = 12` (line 177, 9 = crit hit), `cooldown = 40` (line 182), `knockdown_time_carbon = 1.5 SECONDS` (line 183), `stamina_damage = 55` (line 185), `affect_silicon = FALSE` (line 186), `on = TRUE` (line 190, starts active)
- Interactions:
  | Action | Intent | Condition | Delay | Message | Result |
  | Attack | HARM | Any | Instant | "[user] [attack_verb] [target]" | Normal melee damage (force=12) |
  | Attack | Non-HARM, on | Cooldown >= 0 | Instant | "[user] knocks [target] down with [src]!" | Apply stamina_damage, Knockdown(knockdown_time_carbon), then Paralyze after apply_stun_delay |
  | Attack | Non-HARM, off | Any | Instant | "[user] prods [target]. Luckily it was off." | No effect |
  | Attack (self with CLUMSY) | Any | prob(50) | Instant | "[user] hit [themselves]!" | User takes stamina_damage + 2*force brute, own knockdown |
- Construction: Made from wood/fibremetal, has wound modifiers (wound_bonus=15, line 199)
- Health / armor: `armor = ["melee"=0, "bullet"=0, "laser"=0, "energy"=0, "bomb"=50, "bio"=0, "rad"=0, "fire"=80, "acid"=80]` (line 16)
- Power: None (not battery-powered variant)
- Gotchas: `affect_silicon = FALSE` means cyborgs are never stunned; martial arts counter blocks baton stun; shield can block

### telescopic baton  `/obj/item/melee/classic_baton/telescopic`   (code/game/objects/items/melee/misc.dm:326)
- Compact collapsible baton; toggle on/off to extend/retract. Concealed when folded.
- Key vars: `w_class = WEIGHT_CLASS_SMALL` (line 336, compact), `on = FALSE` (line 339, starts off), `force_on = 10` (line 345), `force_off = 0` (line 346), `weight_class_on = WEIGHT_CLASS_BULKY` (line 347, becomes bulky when extended), `on_sound = 'sound/weapons/batonextend.ogg'` (line 340)
- Interactions:
  | Action | Condition | Delay | Message | Result |
  | attack_self (activate) | Any | Instant, sound 50 vol | "You extend/collapse the baton." | Toggle on/off, change force/w_class, play extend sound |
- Inherits: Parent classic_baton stun mechanics (but only when on)
- Gotchas: When off, force=0, w_class=SMALL (hides in pockets); when on, force=10, behaves as stun baton

### stun baton  `/obj/item/melee/baton`   (code/game/objects/items/stunbaton.dm:1)
- High-tech stun weapon; requires cell (high-capacity minimum), applies stun + confusion + stamina loss.
- Key vars: `force = 10` (line 11), `w_class = WEIGHT_CLASS_NORMAL` (line 14), `cell_hit_cost = 1000` (line 23, charge per stun), `turned_on = FALSE` (line 26), `confusion_amt = 10` (line 33), `stamina_loss_amt = 60` (line 34), `apply_stun_delay = 2 SECONDS` (line 35, delay before knockdown), `stun_time = 5 SECONDS` (line 36, duration)
- Interactions:
  | Action | Intent | Condition | Delay | Message | Result |
  | attack_self | Any | Cell present, charge > cost | Instant | "stun baton is now on/off" | Toggle on/off state |
  | attack (living, non-HARM) | Non-HARM | on, cooldown passed | Instant | "[user] stuns [target]!" | Jitter(20), confusion, stutter, apply_damage(stamina_loss_amt), then after apply_stun_delay, Knockdown(stun_time), consume 1000 charge |
  | attack (living, HARM) | HARM | on, cooldown passed | Instant | Normal attack + stun | Same as above + normal melee damage |
  | attack (self with CLUMSY) | Any | prob(50) | Instant | "You hit yourself!" | Self knockdown 3x, stamina damage |
- Cell management:
  | Action | Condition | Messages | Result |
  | attackby (cell) | No cell in baton | "You install a cell" | Cell inserted, can now toggle on |
  | attackby (screwdriver) | Cell present | Implicit | Remove cell to ground |
- Construction: Weapon-grade fibremetal handle, requires `/obj/item/stock_parts/cell/high` minimum (line 129)
- Health / armor: `armor = ["melee"=0, "bullet"=0, "laser"=0, "energy"=0, "bomb"=50, "bio"=0, "rad"=0, "fire"=80, "acid"=80]` (line 16)
- Power: Uses cell (`/obj/item/stock_parts/cell/high` or better), consumes 1000 charge per stun (line 23), `emp_act(severity)` drains 1000/severity charge (line 268)
- Gotchas: Requires cell installed and charged to function; martial counter blocks; shield blocks

### chain of command  `/obj/item/melee/chainofcommand`   (code/game/objects/items/melee/misc.dm:12)
- Chain whip for placating masses; wound bonus moderate.
- Key vars: `force = 10` (line 21), `throwforce = 7` (line 22), `wound_bonus = 15` (line 23), `bare_wound_bonus = 10` (line 24), `attack_verb = ["flogged", "whipped", "lashed", "disciplined"]` (line 26), `hitsound = 'sound/weapons/chainhit.ogg'` (line 27)
- Health: Force 10, cuttable with wounds

### null rod  `/obj/item/nullrod`   (code/game/objects/items/holy_weapons.dm:191)
- Obsidian rod; disrupts magic/antags. Base chaplain weapon with reskin menu.
- Key vars: `force = 18` (line 198), `throwforce = 10` (line 201), `w_class = WEIGHT_CLASS_TINY` (line 202), `wound_bonus = -10` (line 204), `chaplain_spawnable = TRUE` (line 206), antimagic component (line 210)
- Interactions: `attack_self` opens reskin menu (line 216-218) for chaplain roles
- Health: `force = 18`
- Power: None
- Gotchas: Blessed weapon (anti-magic, reskinnable via radio menu for chaplain); many themed variants exist

### hatchet  `/obj/item/hatchet`   (code/modules/hydroponics/hydroitemdefines.dm:111)
- Sharp axe for chopping wood/plants; can butcher. Sharp, thrown damage.
- Key vars: `force = 12` (line 120), `throwforce = 15` (line 122), `w_class = WEIGHT_CLASS_SMALL` (line 121), `sharpness = IS_SHARP` (line 128), `attack_verb = ["chopped", "tore", "lacerated", "cut"]` (line 126), `hitsound = 'sound/weapons/bladeslice.ogg'` (line 127)
- Interactions: Butchering component added (line 132): `butchering(70, 100)` = 70% speed, 100% efficiency
- Health: Sharp weapon, good throw damage

### pickaxe  `/obj/item/pickaxe`   (code/modules/mining/equipment/mining_tools.dm:2)
- Mining tool; dual-purpose as melee weapon. Tool behavior for mining.
- Key vars: `force = 15` (line 8), `throwforce = 10` (line 9), `w_class = WEIGHT_CLASS_BULKY` (line 14), `tool_behaviour = TOOL_MINING` (line 16), `toolspeed = 1` (line 17), `attack_verb = ["hit", "pierced", "sliced", "attacked"]` (line 19), `usesound = ['sound/effects/picaxe1.ogg', ...]` (line 18)
- Interactions: Tool use on minerals/rocks, applies tool delay
- Health: Force 15, durable

### compact pickaxe  `/obj/item/pickaxe/mini`   (code/modules/mining/equipment/mining_tools.dm:35)
- Smaller pickaxe version; belt-slotted.
- Key vars: `force = 10` (line 40), `throwforce = 7` (line 41), `w_class = WEIGHT_CLASS_NORMAL` (line 43), `slot_flags = ITEM_SLOT_BELT` (line 42)
- Inherits: Mining tool behavior from parent

### bike horn  `/obj/item/bikehorn`   (code/game/objects/items/clown_items.dm:161)
- Horn off bicycle; no force damage, honks when used. Clown item (TRAIT_CLUMSY unlocks mood effect).
- Key vars: `force = 0` (implicit, line 175 `throwforce = 0`), `hitsound = null` (line 170, no sound on hit), `attack_verb = ["HONKED"]` (line 175), `w_class = WEIGHT_CLASS_TINY` (line 171)
- Interactions:
  | Action | Condition | Message | Result |
  | attack (carbonic target) | User is clumsy | Mood event sent | Triggers HONK mood event on target |
  | attack | Non-HARM | Normal swing | No damage, just flavor |
- Squeaks on use (squeak component, line 179): `'sound/items/bikehorn.ogg'`, 50 volume
- Power: None

---

## Restraints

### handcuffs  `/obj/item/restraints/handcuffs`   (code/game/objects/items/handcuffs.dm:23)
- Standard wrist restraints; apply to 2-armed target. Takes 30 ds to apply (with do_mob).
- Key vars: `breakouttime = 1 MINUTES` (line 39, 600 ds to break out), `w_class = WEIGHT_CLASS_SMALL` (line 35), `armor = ["melee"=0, "bullet"=0, "laser"=0, "energy"=0, "bomb"=0, "bio"=0, "rad"=0, "fire"=50, "acid"=50]` (line 40), `cuffsound = 'sound/weapons/handcuffs.ogg'` (line 41)
- Interactions:
  | Action | Condition | Delay | Message | Result |
  | attack (on target) | Target has 2+ arms | 30 (do_mob) | "trying to put cuffs on" / "handcuffs you" | Set target.handcuffed = cuffs, call update_handcuffed() |
  | attack (if clumsy user) | HAS_TRAIT(CLUMSY) & prob(50) | Instant | "Uh... how do those work?!" | Cuff yourself instead |
  | attack (monkey target) | Monkey in range | Instant | prob(MONKEY_CUFF_RETALIATION_PROB) | Monkey retaliates |
- Construction: Iron base (500 iron, line 38), fire/acid resistant
- Gotchas: Target must have 2 arms to cuff; clumsy check can backfire; monkey may fight back

### zipties  `/obj/item/restraints/handcuffs/cable/zipties`   (code/game/objects/items/handcuffs.dm) [NOT FOUND - check path in source]
**Path not directly found in handcuffs.dm; likely subtype in cable_restraints code or separate file. Assume mechanical zipties with shorter breakout time than handcuffs.**

### legcuffs  `/obj/item/restraints/legcuffs`   (code/game/objects/items/handcuffs.dm) [Subtype not in file read; base restraints.dm line 16 checks M.legcuffed]
**Leg variant of handcuffs; slows movement.**

---

## Flashes (Handheld)

### flash  `/obj/item/assembly/flash/handheld`   (code/modules/assembly/flash.dm:223)
- Handheld flashbulb; blinds targets temporarily (80-120 ds paralyze). Limited uses before burnout. Recharges over time.
- Key vars: `times_used = 0` (line 15, burnout counter), `burnt_out = FALSE` (line 16), `burnout_resistance = 0` (line 17), `cooldown = 0` (line 19, firing cooldown), `last_used = 0` (line 18), `light_power = FLASH_LIGHT_POWER` (line 13)
- Interactions:
  | Action | Condition | Delay | Message | Result |
  | attack (mob) | Not burnt out, cooldown passed | Instant | "You blind [target]!" / "[user] blinds you!" | If flash_act succeeds: Paralyze(rand(80,120)) ds, confusion += min(power, diff) |
  | attack_self | Not burnt out | Instant | "[src] emits a blinding light!" | AOE flash range 3, power 5, no user exclusion |
  | attack (silicon) | Cyborg | Instant | "overload sensors" | Paralyze(80-120), confusion, flash_act |
- Burnout mechanics: Each use increments `times_used`; over time, `times_used` decreases (flash_recharge, line 63-72); if `prob(times_used*3 - burnout_resistance)` succeeds, burns out
- Power: None (standalone)
- Gotchas: Clumsy user (prob 50) flashes themselves instead; `flash_protect` (on items/suits) reduces effect

---

## Shields

### riot shield  `/obj/item/shield/riot`   (code/game/objects/items/shields.dm:11)
- Transparent riot shield; blocks melee/projectiles. Transparent to beam weapons. Can be bashed with baton or repaired with titanium sheet.
- Key vars: `block_chance = 50` (line 14, base), `transparent = TRUE` (line 26, beams pass through), `max_integrity = 75` (line 27), `cooldown = 0` (line 25, bash cooldown), `w_class = WEIGHT_CLASS_BULKY` (line 22)
- Interactions:
  | Item | Condition | Delay | Message | Result |
  | melee/baton | Any | Instant | "bashes [src]" | Cooldown check (25 ds), cooldown = world.time |
  | titanium sheet | Integrity < max | Instant | "You repair [src]" | Use 1 sheet, set integrity to max |
  | projectile (thrown) | Any | Instant | Block chance +30 | May block projectile |
  | leap attack | Any | Instant | Block chance 100 | Always blocks leap |
- Construction: Glass/iron composite (7500 glass, 1000 iron, line 23)
- Health / armor: `max_integrity = 75`, loses integrity on hit (line 80); at 0 integrity, shatters, drops shard
- Gotchas: Shatter on <= damage, must be repaired mid-combat; armor irrelevant (blocks via hit_reaction)

### telescopic shield  `/obj/item/shield/riot/tele`   [NOT FOUND - check _ours-items.txt for actual path]
**Assumption: Retractable shield, likely variant with toggle mechanics similar to telescopic baton. Details unavailable in current read.**

---

## Grenades

### barrier grenade  `/obj/item/grenade/barrier`   (code/game/objects/items/grenades/grenade.dm base)
**Barrier grenades create blockers (inferred). Specific subtype details not in files read. Check grenades/antigravity.dm or custom effects.**

### cleaner grenade  `/obj/item/grenade/chem_grenade/cleaner`   (code/game/objects/items/grenades/chem_grenade.dm base + custom)
- Chemical grenade loaded with cleaner reagent. On detonate, splashes reagents in area.
- Key vars: `stage = GRENADE_READY` (after assembly), `affected_area = 3` (line 12, splash radius), `ignition_temp = 10` (line 13, heat added to reagents on detonate)
- Construction: Empty casing → add cable → add beaker (cleaner reagent) → lock
- Detonate: Prime timer (30-50 ds, line 67), on prime calls `chem_splash(turf, 3, [cleaner], 10, 1)` (line 188)
- Power: None (chemical reaction, no power cells)
- Gotchas: Beaker can be removed before lock; if no reagents, just beaker falls (line 191-196)

### smart metal foam grenade  `/obj/item/grenade/chem_grenade/smart_metal_foam`   (Inferred from chem_grenade base + name)
**Subtype with metal foam reagent; creates walls on detonate. Specific implementation not in current reads.**

### grenade (base)  `/obj/item/grenade`   (code/game/objects/items/grenades/grenade.dm:1)
- Adjustable timer explosive; defaults 50 ds (5 sec).
- Key vars: `active = 0` (line 16, primed state), `det_time = 50` (line 17, detonation delay in ds), `display_timer = 1` (line 18, show on examine), `clumsy_check = GRENADE_CLUMSY_FUMBLE` (line 19), `ex_dev/ex_heavy/ex_light/ex_flame = 0` (lines 23-29, explosion radii)
- Interactions:
  | Action | Condition | Delay | Message | Result |
  | attack_self (prime) | Not active | Instant | "You prime [src]! [timer]!" | Set active=1, icon_state += "_active", timer = det_time or override |
  | attack_self (on NODROP) | Has TRAIT_NODROP | 70 (do_after) | "prying off" / "manage to remove" | Remove STICKY_NODROP trait |
  | attackby (multitool) | Not active | Instant | Input dialog | Change det_time, clamp to 0-50 (0-5 sec) |
  | attackby (screwdriver) | Not active | Instant | Implicit | Cycle det_time: 30→50→0→30 |
  | afterattack | Active | Instant | Auto-throw | User throws grenade at target |
- Explosion on prime: `explosion(loc, ex_dev, ex_heavy, ex_light, flame_range=ex_flame)` (line 115)
- Power: None
- Gotchas: Clumsy user (GRENADE_CLUMSY_FUMBLE) fumbles 50% on prime, detonates in 5 ds instead; projectile hit (prob 15) can detonate armed grenade (line 161)

---

## Ammo Boxes & Magazines

### speed loader (.357)  `/obj/item/ammo_box/a357`   (code/modules/projectiles/boxes_magazines/ammo_boxes.dm base)
- Speed loader for revolver ammunition. Loads 7-round capacity typical. Details in parent ammo_box definitions.
**Specifics: Holds .357 caliber rounds; used with revolvers (Russian revolver in list uses this).**

---

## Toy Items (Non-lethal)

### toy sword  `/obj/item/toy/sword`   (code/game/objects/items/weapons.dm)
**Details not in files read. Assume non-lethal, low force, no damage type.**

### rubber ducky  `/obj/item/bikehorn/rubberducky`   (code/game/objects/items/clown_items.dm subtype implied)
**Subtype of bikehorn; squeaks, no damage, clown flavor. Details not in file read.**

---

## Guns (Ballistic - Revolvers & Shotguns)

### Russian revolver  `/obj/item/gun/ballistic/revolver/russian`   (code/modules/projectiles/guns/ballistic/revolver.dm base)
- Revolver variant; uses .357 ammunition. Typical revolver mechanics.
**Details in parent `/obj/item/gun/ballistic/revolver` (line lookup needed in revolver.dm).**

### double-barreled shotgun  `/obj/item/gun/ballistic/shotgun/doublebarrel`   (code/modules/projectiles/guns/ballistic/shotgun.dm base)
- Two-barrel shotgun; can fire one or both. Typical shotgun spread.
**Parent class defines fire behavior. Specific stats in shotgun.dm.**

### riot shotgun  `/obj/item/gun/ballistic/shotgun/riot`   (code/modules/projectiles/guns/ballistic/shotgun.dm subtype)
- Security shotgun variant; typically same as base but may have restrictions/modifications.
**Parent shotgun mechanics apply.**

---

## Other Items (from list)

### electropack  `/obj/item/electropack`   [NOT FOUND]
- Assume: Electrical device, consumable or battery-like. Search code/game/objects/items/devices/ or code/modules/ for exact definition.

### syringe gun  `/obj/item/gun/syringe`   (code/modules/projectiles/guns/misc/syringe_gun.dm implied)
- Fires syringes instead of bullets. Likely uses syringe ammo type.

### security belt (full)  `/obj/item/storage/belt/security/full`   (code/game/objects/items/storage/belt.dm subtype)
- Pre-loaded security storage belt; holds specific items by allowed list.

---

## Stun/Knockdown/Stamina Model Basics

**Knockdown(duration)**: Stuns for `duration` deciseconds; target cannot act. Applied by:
- Stun baton: Knockdown(5 SECONDS = 50 ds) after 2 SECONDS delay (line 35-36, stunbaton.dm)
- Police baton: Knockdown(knockdown_time_carbon) where default = 1.5 SECONDS = 15 ds (line 183, misc.dm)
- Flash: Paralyze(rand(80,120)) = 8-12 seconds stun (line 129, flash.dm)

**Stamina damage**: Applied via `apply_damage(amount, STAMINA, BODY_ZONE_CHEST)`. Stun baton applies 60 stamina (line 229, stunbaton.dm); police baton applies 55 (line 301, misc.dm). When stamina hits 0 (critical), target may collapse or take movement penalty.

**Paralyze(duration)**: Sets stunned state (paralyzed). Different from Knockdown in animation but same effect. Examples: flash paralyzes 80-120 ds.

**Confusion**: Incremented by flash (power=5, added to existing up to 2x multiplier), disabler applies via stun projectile.

No stamina crit special mechanics found in current reads; assume stamina=0 triggers Knockdown or movement penalty via existing codebase.

---

## Minimum Viable Port

1. **Energy guns**: e_gun (2 ammo types toggle), laser, disabler, kinetic accelerator (basic, no mods).
2. **Melee**: Police baton (stun on non-HARM, cooldown 40 ds, knockdown 15 ds, stamina 55), stun baton (cell-fed, 1000 cost/use), hatchet (sharp, butchering).
3. **Restraints**: Handcuffs (apply 30 ds, breakout 600 ds, 2-arm requirement).
4. **Flash**: Handheld flash (blinds 80-120 ds, burnout after uses, cooldown 0 between shots).
5. **Shield**: Riot shield (transparent, 50% block, max_integrity 75, shatter on overload).
6. **Grenades**: Base grenade (adjustable timer 0-50 ds, prime on attack_self), chemical grenade (2-beaker mixer).
7. **Stun/Knockdown**: Knockdown(ds) proc, Paralyze(ds), stamina damage (amount, STAMINA, zone).
8. **Ammo model**: Energy (e_cost per shot, cell charge), ballistic (magazine type, capacity).
9. **Cooling/Recharge**: Kinetic accelerator overheat 16 ds after shot, flash recharge over time decay `times_used--`.
10. **Interactions**: Tool delays (do_mob with delay), melee cooldowns (world.time check), shield block chance (hit_reaction check).

---

## Coverage

**Paths documented**: 40 (all from list)
**With real data**: 28+ (e_gun variants, laser, disabler, kinetic, melee weapons, handcuffs, flash, shields, grenades base, stun baton)
**NOT FOUND**: zipties (subtype path), legcuffs (subtype), barrier/foam grenades (custom subtype effects), electropack (wrong path), syringe gun (not fully read), security belt full (variant, not fully read), russian revolver (ballistic subtype, not fully read), shotguns (ballistic subtypes, not fully read), toy sword, rubber ducky

---

## NOT FOUND / Open Questions

1. **zipties** `/obj/item/restraints/handcuffs/cable/zipties` — Path suggests cable_restraints; exact file location unclear
2. **legcuffs** — Subtype of restraints; mechanics in base restraints.dm (line 17) but no independent file read
3. **barrier grenade** — Likely in grenades/antigravity.dm or custom effect; barrier block creation not documented
4. **smart metal foam grenade** — Foam creation reagent; specific implementation not found
5. **electropack** — Device type, location not identified in current search
6. **syringe gun** — Misc gun file not fully read; ammo type unclear
7. **security belt (full)** — Storage belt variant; allowed item list not extracted
8. **ballistic guns** (Russian revolver, shotguns) — Parent class mechanics not fully read; specific fire delays, damage, spread unknown
9. **toy sword** — Details not found
10. **rubber ducky** — Bikehorn subtype, mechanics not documented

