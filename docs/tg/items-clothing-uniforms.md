# Clothing: Jumpsuits, Skirts, Uniforms, Ties and Neckwear

TG-station 2020-07-06 (commit 2d6c10c1) uniforms and related neckwear. Covers all human underclothing (jumpsuits, suitskirts, shorts, costumes), ties, cloaks and stethoscopes. All items in this category have armor (wound protection values only, no other damage types protected unless noted), body_parts_covered flags, and can be adjusted/rolled down on certain types. Most rank uniforms are locked to spawn only in crew lookups and lockers tied to their job.

**Key behaviours:**
- `can_adjust` (TRUE by default in base /obj/item/clothing/under): when TRUE, examining the uniform shows "This uniform has a [state] style, and has a rolled down version." Right-click to toggle between NORMAL_STYLE (default) and rolled-down. Rolled-down changes body_parts_covered and messages. Not all subtypes override this.
- `fitted`: sets appearance variation for female-presenting characters; values are FEMALE_UNIFORM_FULL (default), FEMALE_UNIFORM_TOP (exposes chest when rolled down), NO_FEMALE_UNIFORM. Female-fitted uniforms set body_parts_covered=CHEST|GROIN|ARMS when fitted is FEMALE_UNIFORM_TOP, preventing chest coverage when rolled.
- `alt_covers_chest`: if TRUE, rolled-down uniform exposes arms only (not chest). If FALSE, exposes chest and arms.
- `has_sensor` / `sensor_mode`: crew computer sensor integration. Modes: NO_SENSORS (off), SENSOR_OFF (wearer controls it), SENSOR_LIVING (vital signs on), SENSOR_VITALS (heartbeat + vitals), SENSOR_COORDS (location + vitals), LOCKED_SENSORS (prisoners; always SENSOR_COORDS). Random sensor on init unless `random_sensor = FALSE`.
- `attached_accessory`: uniform can attach one accessory (medal, holster, tie). See /obj/item/clothing/accessory subtypes.
- Base armor: list("melee" = 0, "bullet" = 0, "laser" = 0, "energy" = 0, "bomb" = 0, "bio" = 0, "rad" = 0, "fire" = 0, "acid" = 0, "wound" = 5) [code/modules/clothing/under/_under.dm:8]

---

## Parent Class: /obj/item/clothing/under

**Identity:**
- `body_parts_covered = CHEST|GROIN|LEGS|ARMS` (default) [_under.dm:5]
- `permeability_coefficient = 0.9` (air gaps) [_under.dm:6]
- `slot_flags = ITEM_SLOT_ICLOTHING` (innermost layer) [_under.dm:7]
- `equip_sound = 'sound/items/equip/jumpsuit_equip.ogg'` [_under.dm:9]
- `limb_integrity = 30` (damage per limb before disabled) [_under.dm:12]

**Key vars:**
- `fitted = FEMALE_UNIFORM_FULL` (sprite variation) [_under.dm:13]
- `has_sensor = HAS_SENSORS` (can attach to crew computer) [_under.dm:14]
- `random_sensor = TRUE` (randomize mode on init) [_under.dm:15]
- `sensor_mode = NO_SENSORS` (initial sensor state) [_under.dm:16]
- `can_adjust = TRUE` (can roll down) [_under.dm:17]
- `adjusted = NORMAL_STYLE` (current display state) [_under.dm:18]
- `alt_covers_chest = FALSE` (FALSE=exposes chest when adjusted, TRUE=exposes arms only) [_under.dm:19]
- `attached_accessory` (one accessory max) [_under.dm:20]

**Interactions:**
- Examine: shows sensor mode and adjustment option (if `can_adjust`).
- Right-click when in inventory: toggle adjusted state; updates body_parts_covered; changes `fitted` appearance. Messages:
  - If `alt_covers_chest = FALSE` on roll-down: "You roll down the [name]." (chest + arms exposed) → body_parts_covered &= ~(CHEST|ARMS).
  - If `alt_covers_chest = TRUE` on roll-down: arms exposed only.
  - On re-equip: auto-resets to NORMAL_STYLE; restores chest coverage if needed [_under.dm:69-73].
- Drag onto cable coil (if `has_sensor == BROKEN_SENSORS`): repair sensors. Message: "You repair the suit sensors on [src] with [C]." Sets `has_sensor = HAS_SENSORS` [_under.dm:35-43].
- Drag onto accessory item: attach_accessory() → "You attach [I] to [src]." [_under.dm:42, 134].

---

## Uniform Categories

### Color Jumpsuits & Jumpskirts

Base type: /obj/item/clothing/under/color [color.dm:1-3]
- `desc = "A standard issue colored jumpsuit. Variety is the spice of life!"` [color.dm:2]
- Icon: 'icons/obj/clothing/under/color.dmi'

| Name | DM Path | Details |
|------|---------|---------|
| grey jumpsuit | `/obj/item/clothing/under/color/grey` | `name = "grey jumpsuit"`, `icon_state = "grey"`, inhand_icon_state = "gy_suit" [color.dm:57-60] |
| grey jumpskirt | `/obj/item/clothing/under/color/jumpskirt/grey` | `name = "grey jumpskirt"`, `icon_state = "grey_skirt"`, body_parts_covered = CHEST\|GROIN\|ARMS, can_adjust = FALSE, fitted = FEMALE_UNIFORM_TOP [color.dm:62-66] |
| black jumpsuit | `/obj/item/clothing/under/color/black` | `name = "black jumpsuit"`, `icon_state = "black"` [color.dm:38-42] |
| black jumpskirt | `/obj/item/clothing/under/color/jumpskirt/black` | `name = "black jumpskirt"`, `icon_state = "black_skirt"` [color.dm:44-47] |
| blue jumpsuit | `/obj/item/clothing/under/color/blue` | `name = "blue jumpsuit"`, `icon_state = "blue"` [color.dm:76-79] |
| blue jumpskirt | `/obj/item/clothing/under/color/jumpskirt/blue` | `name = "blue jumpskirt"`, `icon_state = "blue_skirt"` [color.dm:81-84] |
| green jumpsuit | `/obj/item/clothing/under/color/green` | `name = "green jumpsuit"`, `icon_state = "green"` [color.dm:86-89] |
| green jumpskirt | `/obj/item/clothing/under/color/jumpskirt/green` | `name = "green jumpskirt"`, `icon_state = "green_skirt"` [color.dm:91-94] |
| orange jumpsuit | `/obj/item/clothing/under/color/orange` | `name = "orange jumpsuit"`, desc: "Don't wear this near paranoid security officers." [color.dm:96-100] |
| orange jumpskirt | `/obj/item/clothing/under/color/jumpskirt/orange` | `name = "orange jumpskirt"`, `icon_state = "orange_skirt"` [color.dm:102-105] |
| pink jumpsuit | `/obj/item/clothing/under/color/pink` | `name = "pink jumpsuit"`, desc: "Just looking at this makes you feel fabulous." [color.dm:107-111] |
| pink jumpskirt | `/obj/item/clothing/under/color/jumpskirt/pink` | `name = "pink jumpskirt"`, `icon_state = "pink_skirt"` [color.dm:113-116] |
| red jumpsuit | `/obj/item/clothing/under/color/red` | `name = "red jumpsuit"`, `icon_state = "red"` [color.dm:118-121] |
| red jumpskirt | `/obj/item/clothing/under/color/jumpskirt/red` | `name = "red jumpskirt"`, `icon_state = "red_skirt"` [color.dm:123-126] |
| yellow jumpsuit | `/obj/item/clothing/under/color/yellow` | `name = "yellow jumpsuit"`, `icon_state = "yellow"` [color.dm:138-141] |
| yellow jumpskirt | `/obj/item/clothing/under/color/jumpskirt/yellow` | `name = "yellow jumpskirt"`, `icon_state = "yellow_skirt"` [color.dm:143-146] |
| darkblue jumpsuit | `/obj/item/clothing/under/color/darkblue` | `name = "darkblue jumpsuit"`, `icon_state = "darkblue"` [color.dm:148-151] |
| darkblue jumpskirt | `/obj/item/clothing/under/color/jumpskirt/darkblue` | `name = "darkblue jumpskirt"`, `icon_state = "darkblue_skirt"` [color.dm:153-156] |
| teal jumpsuit | `/obj/item/clothing/under/color/teal` | `name = "teal jumpsuit"`, `icon_state = "teal"` [color.dm:158-161] |
| teal jumpskirt | `/obj/item/clothing/under/color/jumpskirt/teal` | `name = "teal jumpskirt"`, `icon_state = "teal_skirt"` [color.dm:163-166] |
| purple jumpsuit | `/obj/item/clothing/under/color/lightpurple` | `name = "purple jumpsuit"`, `icon_state = "lightpurple"` [color.dm:169-172] |
| lightpurple jumpskirt | `/obj/item/clothing/under/color/jumpskirt/lightpurple` | `name = "lightpurple jumpskirt"`, `icon_state = "lightpurple_skirt"` [color.dm:174-177] |
| rainbow jumpsuit | `/obj/item/clothing/under/color/rainbow` | (not found in color.dm provided; rainbow likely defined elsewhere or by code generation) |

---

### Security Department Uniforms

Base type: /obj/item/clothing/under/rank/security [security.dm:12-14]
- Icon: 'icons/obj/clothing/under/security.dmi'

| Name | DM Path | Armor | Details |
|------|---------|-------|---------|
| security jumpsuit | `/obj/item/clothing/under/rank/security/officer` | melee=10, fire=30, acid=30, wound=10 | `desc = "A tactical security jumpsuit for officers complete with Nanotrasen belt buckle."`, `icon_state = "rsecurity"`, alt_covers_chest=TRUE, sensor_mode=SENSOR_COORDS, strip_delay=50 [security.dm:16-25] |
| security jumpskirt | `/obj/item/clothing/under/rank/security/officer/skirt` | (from parent) | `icon_state = "secskirt"`, body_parts_covered=CHEST\|GROIN\|ARMS, can_adjust=FALSE, fitted=FEMALE_UNIFORM_TOP, comment: "if you adjust the skirt and the sprite disappears isn't that just like flashing everyone" [security.dm:33-40] |
| hard-worn suit | `/obj/item/clothing/under/rank/security/detective` | melee=10, fire=30, acid=30, wound=10 | `desc = "Someone who wears this means business."`, `icon_state = "detective"`, alt_covers_chest=TRUE, sensor_mode=SENSOR_COORDS, strip_delay=50 [security.dm:100-109] |
| head of security's jumpsuit | `/obj/item/clothing/under/rank/security/head_of_security` | melee=10, fire=50, acid=50, wound=10 | `desc = "A security jumpsuit decorated for those few with the dedication to achieve the position of Head of Security."`, `icon_state = "rhos"`, alt_covers_chest=TRUE, sensor_mode=SENSOR_COORDS, strip_delay=60 [security.dm:139-148] |
| head of security's jumpskirt | `/obj/item/clothing/under/rank/security/head_of_security/skirt` | (from parent) | `icon_state = "rhos_skirt"`, body_parts_covered=CHEST\|GROIN\|ARMS, can_adjust=FALSE, fitted=FEMALE_UNIFORM_TOP [security.dm:150-157] |
| head of security's grey jumpsuit | `/obj/item/clothing/under/rank/security/head_of_security/grey` | (from parent) | `name = "head of security's grey jumpsuit"`, `icon_state = "hos"` [security.dm:159-163] |
| head of security's turtleneck | `/obj/item/clothing/under/rank/security/head_of_security/alt` | (from parent) | `desc = "A stylish alternative to the normal head of security jumpsuit, complete with tactical pants."`, `icon_state = "hosalt"` [security.dm:165-169] |
| head of security's turtleneck skirt | `/obj/item/clothing/under/rank/security/head_of_security/alt/skirt` | (from parent) | `icon_state = "hosalt_skirt"`, body_parts_covered=CHEST\|GROIN\|ARMS, can_adjust=FALSE, fitted=FEMALE_UNIFORM_TOP [security.dm:171-178] |
| head of security's parade uniform | `/obj/item/clothing/under/rank/security/head_of_security/parade` | (from parent) | male variant: `icon_state = "hos_parade_male"`, can_adjust=FALSE [security.dm:180-185] |
| head of security's parade uniform (female) | `/obj/item/clothing/under/rank/security/head_of_security/parade/female` | (from parent) | female variant: `icon_state = "hos_parade_fem"`, fitted=FEMALE_UNIFORM_TOP, can_adjust=FALSE [security.dm:187-193] |
| security suit | `/obj/item/clothing/under/rank/security/warden` | melee=10, fire=30, acid=30, wound=10 | `desc = "A formal security suit for officers complete with Nanotrasen belt buckle."`, `icon_state = "rwarden"`, alt_covers_chest=TRUE, sensor_mode=SENSOR_COORDS (3), strip_delay=50 [security.dm:64-73] |
| warden's suitskirt | `/obj/item/clothing/under/rank/security/warden/skirt` | (from parent) | `icon_state = "rwarden_skirt"`, body_parts_covered=CHEST\|GROIN\|ARMS, can_adjust=FALSE, fitted=FEMALE_UNIFORM_TOP [security.dm:81-88] |
| warden's formal uniform | `/obj/item/clothing/under/rank/security/warden/formal` | (from parent) | `desc = "The insignia on this uniform tells you that this uniform belongs to the Warden."`, `icon_state = "wardenblueclothes"`, alt_covers_chest=TRUE [security.dm:90-95] |
| prison jumpsuit | `/obj/item/clothing/under/rank/prisoner` | (base armor) | `desc = "It's standardised Nanotrasen prisoner-wear. Its suit sensors are stuck in the 'Fully On' position."`, `icon_state = "prisoner"`, has_sensor=LOCKED_SENSORS, sensor_mode=SENSOR_COORDS, random_sensor=FALSE [security.dm:213-222] |
| prison jumpskirt | `/obj/item/clothing/under/rank/prisoner/skirt` | (base armor) | `icon_state = "prisoner_skirt"`, body_parts_covered=CHEST\|GROIN\|ARMS, can_adjust=FALSE, fitted=FEMALE_UNIFORM_TOP [security.dm:224-231] |

---

### Medical Department Uniforms

Base type: /obj/item/clothing/under/rank/medical [medical.dm:1-3]
- Icon: 'icons/obj/clothing/under/medical.dmi'
- `permeability_coefficient = 0.5` (bio protection) on most medical uniforms

| Name | DM Path | Armor | Details |
|------|---------|-------|---------|
| chief medical officer's jumpsuit | `/obj/item/clothing/under/rank/medical/chief_medical_officer` | bio=10 | `desc = "It's a jumpsuit worn by those with the experience to be 'Chief Medical Officer'. It provides minor biological protection."`, `icon_state = "cmo"`, permeability_coefficient=0.5 [medical.dm:5-11] |
| chief medical officer's jumpskirt | `/obj/item/clothing/under/rank/medical/chief_medical_officer/skirt` | (from parent) | `icon_state = "cmo_skirt"`, body_parts_covered=CHEST\|GROIN\|ARMS, can_adjust=FALSE, fitted=FEMALE_UNIFORM_TOP [medical.dm:13-20] |
| medical doctor's jumpsuit | `/obj/item/clothing/under/rank/medical/doctor` | bio=10 | `desc = "It's made of a special fiber that provides minor protection against biohazards. It has a cross on the chest denoting that the wearer is trained medical personnel."`, `icon_state = "medical"`, permeability_coefficient=0.5 [medical.dm:50-56] |
| medical doctor's jumpskirt | `/obj/item/clothing/under/rank/medical/doctor/skirt` | (from parent) | `icon_state = "medical_skirt"`, body_parts_covered=CHEST\|GROIN\|ARMS, can_adjust=FALSE, fitted=FEMALE_UNIFORM_TOP [medical.dm:76-83] |
| chemist's jumpsuit | `/obj/item/clothing/under/rank/medical/chemist` | bio=10, fire=50, acid=65 | `desc = "It's made of a special fiber that gives special protection against biohazards. It has a chemist rank stripe on it."`, `icon_state = "chemistry"`, permeability_coefficient=0.5 [medical.dm:85-91] |
| chemist's jumpskirt | `/obj/item/clothing/under/rank/medical/chemist/skirt` | (from parent) | `icon_state = "chemistrywhite_skirt"`, body_parts_covered=CHEST\|GROIN\|ARMS, can_adjust=FALSE, fitted=FEMALE_UNIFORM_TOP [medical.dm:93-100] |
| paramedic jumpsuit | `/obj/item/clothing/under/rank/medical/paramedic` | bio=10 | `desc = "It's made of a special fiber that provides minor protection against biohazards. It has a dark blue cross on the chest denoting that the wearer is a trained paramedic."`, `icon_state = "paramedic"`, permeability_coefficient=0.5 [medical.dm:102-108] |
| paramedic jumpskirt | `/obj/item/clothing/under/rank/medical/paramedic/skirt` | (from parent) | `icon_state = "paramedic_skirt"`, body_parts_covered=CHEST\|GROIN\|ARMS, can_adjust=FALSE, fitted=FEMALE_UNIFORM_TOP [medical.dm:110-117] |
| virologist's jumpsuit | `/obj/item/clothing/under/rank/medical/virologist` | bio=10 | `desc = "It's made of a special fiber that gives special protection against biohazards. It has a virologist rank stripe on it."`, `icon_state = "virology"`, permeability_coefficient=0.5 [medical.dm:22-28] |
| virologist's jumpskirt | `/obj/item/clothing/under/rank/medical/virologist/skirt` | (from parent) | `icon_state = "virologywhite_skirt"`, body_parts_covered=CHEST\|GROIN\|ARMS, can_adjust=FALSE, fitted=FEMALE_UNIFORM_TOP [medical.dm:30-37] |

---

### Engineering Department Uniforms

Base type: /obj/item/clothing/under/rank/engineering [engineering.dm:3-5]
- Icon: 'icons/obj/clothing/under/engineering.dmi'

| Name | DM Path | Armor | Details |
|------|---------|-------|---------|
| chief engineer's jumpsuit | `/obj/item/clothing/under/rank/engineering/chief_engineer` | rad=10, fire=80, acid=40 | `desc = "It's a high visibility jumpsuit given to those engineers insane enough to achieve the rank of 'Chief Engineer'. It has minor radiation shielding."`, `icon_state = "chiefengineer"` [engineering.dm:7-12] |
| chief engineer's jumpskirt | `/obj/item/clothing/under/rank/engineering/chief_engineer/skirt` | (from parent) | `icon_state = "chief_skirt"`, body_parts_covered=CHEST\|GROIN\|ARMS, can_adjust=FALSE, fitted=FEMALE_UNIFORM_TOP [engineering.dm:15-22] |
| engineer's jumpsuit | `/obj/item/clothing/under/rank/engineering/engineer` | rad=10, fire=60, acid=20 | `desc = "It's an orange high visibility jumpsuit worn by engineers. It has minor radiation shielding."`, `icon_state = "engine"` [engineering.dm:41-47] |
| engineer's jumpskirt | `/obj/item/clothing/under/rank/engineering/engineer/skirt` | (from parent) | `icon_state = "engine_skirt"`, body_parts_covered=CHEST\|GROIN\|ARMS, can_adjust=FALSE, fitted=FEMALE_UNIFORM_TOP [engineering.dm:56-63] |
| atmospheric technician's jumpsuit | `/obj/item/clothing/under/rank/engineering/atmospheric_technician` | rad=10, fire=60, acid=20 | `desc = "It's a jumpsuit worn by atmospheric technicians. It has minor protection from fire."`, `icon_state = "atmos"` [engineering.dm:24-30] |
| atmospheric technician's jumpskirt | `/obj/item/clothing/under/rank/engineering/atmospheric_technician/skirt` | (from parent) | `icon_state = "atmos_skirt"`, body_parts_covered=CHEST\|GROIN\|ARMS, can_adjust=FALSE, fitted=FEMALE_UNIFORM_TOP [engineering.dm:32-39] |

---

### Cargo & Supply Department Uniforms

Base type: /obj/item/clothing/under/rank/cargo [cargo.dm:1-2]
- Icon: 'icons/obj/clothing/under/cargo.dmi'

| Name | DM Path | Armor | Details |
|------|---------|-------|---------|
| quartermaster's jumpsuit | `/obj/item/clothing/under/rank/cargo/qm` | (base armor) | `desc = "It's a jumpsuit worn by the quartermaster. It's specially designed to prevent back injuries caused by pushing paper."`, `icon_state = "qm"` [cargo.dm:5-9] |
| quartermaster's jumpskirt | `/obj/item/clothing/under/rank/cargo/qm/skirt` | (base armor) | `icon_state = "qm_skirt"`, body_parts_covered=CHEST\|GROIN\|ARMS, can_adjust=FALSE, fitted=FEMALE_UNIFORM_TOP [cargo.dm:11-18] |
| cargo technician's jumpsuit | `/obj/item/clothing/under/rank/cargo/tech` | (base armor) | `desc = "Shooooorts! They're comfy and easy to wear!"`, `icon_state = "cargotech"`, body_parts_covered=CHEST\|GROIN\|ARMS, mutantrace_variation=MUTANTRACE_VARIATION, alt_covers_chest=TRUE [cargo.dm:20-27] |
| cargo technician's jumpskirt | `/obj/item/clothing/under/rank/cargo/tech/skirt` | (base armor) | `desc = "Skiiiiirts! They're comfy and easy to wear"`, `icon_state = "cargo_skirt"`, body_parts_covered=CHEST\|GROIN\|ARMS, can_adjust=FALSE, fitted=FEMALE_UNIFORM_TOP [cargo.dm:29-37] |
| shaft miner's jumpsuit | `/obj/item/clothing/under/rank/cargo/miner/lavaland` | fire=80, wound=10 | `desc = "A green uniform for operating in hazardous environments."`, `icon_state = "explorer"`, can_adjust=FALSE [cargo.dm:47-52] |

---

### Research & Development Uniforms

Base type: /obj/item/clothing/under/rank/rnd [rnd.dm:1-3]
- Icon: 'icons/obj/clothing/under/rnd.dmi'

| Name | DM Path | Armor | Details |
|------|---------|-------|---------|
| research director's vest suit | `/obj/item/clothing/under/rank/rnd/research_director` | bomb=10, bio=10, acid=35 | `desc = "It's a suit worn by those with the know-how to achieve the position of 'Research Director'. Its fabric provides minor protection from biological contaminants."`, `icon_state = "director"`, can_adjust=FALSE [rnd.dm:5-11] |
| research director's vest suitskirt | `/obj/item/clothing/under/rank/rnd/research_director/skirt` | (from parent) | `icon_state = "director_skirt"`, body_parts_covered=CHEST\|GROIN\|ARMS, can_adjust=FALSE, fitted=FEMALE_UNIFORM_TOP [rnd.dm:13-20] |
| research director's tan suit | `/obj/item/clothing/under/rank/rnd/research_director/alt` | bomb=10, bio=10 | `desc = "Maybe you'll engineer your own half-man, half-pig creature some day. Its fabric provides minor protection from biological contaminants."`, `icon_state = "rdwhimsy"`, can_adjust=TRUE, alt_covers_chest=TRUE [rnd.dm:22-29] |
| research director's tan suitskirt | `/obj/item/clothing/under/rank/rnd/research_director/alt/skirt` | (from parent) | `icon_state = "rdwhimsy_skirt"`, body_parts_covered=CHEST\|GROIN\|ARMS, can_adjust=FALSE, fitted=FEMALE_UNIFORM_TOP [rnd.dm:31-38] |
| research director's turtleneck | `/obj/item/clothing/under/rank/rnd/research_director/turtleneck` | bomb=10, bio=10 | `desc = "A dark purple turtleneck and tan khakis, for a director with a superior sense of style."`, `icon_state = "rdturtle"`, can_adjust=TRUE, alt_covers_chest=TRUE [rnd.dm:40-47] |
| research director's turtleneck skirt | `/obj/item/clothing/under/rank/rnd/research_director/turtleneck/skirt` | (from parent) | `icon_state = "rdturtle_skirt"`, body_parts_covered=CHEST\|GROIN\|ARMS, can_adjust=FALSE, fitted=FEMALE_UNIFORM_TOP [rnd.dm:49-56] |
| scientist's jumpsuit | `/obj/item/clothing/under/rank/rnd/scientist` | bomb=10 | `desc = "It's made of a special fiber that provides minor protection against explosives. It has markings that denote the wearer as a scientist."`, `icon_state = "toxins"`, permeability_coefficient=0.5 [rnd.dm:58-64] |
| scientist's jumpskirt | `/obj/item/clothing/under/rank/rnd/scientist/skirt` | (from parent) | `icon_state = "toxinswhite_skirt"`, body_parts_covered=CHEST\|GROIN\|ARMS, can_adjust=FALSE, fitted=FEMALE_UNIFORM_TOP [rnd.dm:66-73] |
| roboticist's jumpsuit | `/obj/item/clothing/under/rank/rnd/roboticist` | (base armor) | `desc = "It's a slimming black with reinforced seams; great for industrial work."`, `icon_state = "robotics"` [rnd.dm:75-80] |
| roboticist's jumpskirt | `/obj/item/clothing/under/rank/rnd/roboticist/skirt` | (base armor) | `icon_state = "robotics_skirt"`, body_parts_covered=CHEST\|GROIN\|ARMS, can_adjust=FALSE, fitted=FEMALE_UNIFORM_TOP [rnd.dm:82-89] |
| geneticist's jumpsuit | `/obj/item/clothing/under/rank/rnd/geneticist` | bio=10 | `desc = "It's made of a special fiber that gives special protection against biohazards. It has a genetics rank stripe on it."`, `icon_state = "genetics"`, permeability_coefficient=0.5 [rnd.dm:91-97] |
| geneticist's jumpskirt | `/obj/item/clothing/under/rank/rnd/geneticist/skirt` | (from parent) | `icon_state = "geneticswhite_skirt"`, body_parts_covered=CHEST\|GROIN\|ARMS, can_adjust=FALSE, fitted=FEMALE_UNIFORM_TOP [rnd.dm:99-106] |

---

### Command Department Uniforms

Base type: /obj/item/clothing/under/rank/captain [command.dm:1-10]
- Icon: 'icons/obj/clothing/under/captain.dmi'

| Name | DM Path | Armor | Details |
|------|---------|-------|---------|
| captain's jumpsuit | `/obj/item/clothing/under/rank/captain` | wound=15 | `desc = "It's a blue jumpsuit with some gold markings denoting the rank of 'Captain'."`, `icon_state = "captain"`, sensor_mode=SENSOR_COORDS, random_sensor=FALSE [command.dm:1-10] |
| captain's jumpskirt | `/obj/item/clothing/under/rank/captain/skirt` | (from parent) | `icon_state = "captain_skirt"`, body_parts_covered=CHEST\|GROIN\|ARMS, can_adjust=FALSE, fitted=FEMALE_UNIFORM_TOP [command.dm:12-19] |
| captain's parade uniform | `/obj/item/clothing/under/rank/captain/parade` | (from parent) | `desc = "A captain's luxury-wear, for special occasions."`, `icon_state = "captain_parade"`, can_adjust=FALSE [command.dm:37-42] |

---

### Civilian Department Uniforms

Base type: /obj/item/clothing/under/rank/civilian [civilian.dm:3-5]
- Icon: 'icons/obj/clothing/under/civilian.dmi'

| Name | DM Path | Armor | Details |
|------|---------|-------|---------|
| bartender's uniform | `/obj/item/clothing/under/rank/civilian/bartender` | (base armor) | `desc = "It looks like it could use some more flair."`, `icon_state = "barman"`, alt_covers_chest=TRUE [civilian.dm:7-12] |
| bartender's skirt | `/obj/item/clothing/under/rank/civilian/bartender/skirt` | (base armor) | `icon_state = "barman_skirt"`, body_parts_covered=CHEST\|GROIN\|ARMS, can_adjust=FALSE, fitted=FEMALE_UNIFORM_TOP [civilian.dm:20-27] |
| botanist's jumpsuit | `/obj/item/clothing/under/rank/civilian/hydroponics` | (base armor) | `desc = "It's a jumpsuit designed to protect against minor plant-related hazards."`, `icon_state = "hydroponics"`, permeability_coefficient=0.5 [civilian.dm:91-96] |
| botanist's jumpskirt | `/obj/item/clothing/under/rank/civilian/hydroponics/skirt` | (base armor) | `icon_state = "hydroponics_skirt"`, body_parts_covered=CHEST\|GROIN\|ARMS, can_adjust=FALSE, fitted=FEMALE_UNIFORM_TOP [civilian.dm:98-105] |
| chaplain's jumpsuit | `/obj/item/clothing/under/rank/civilian/chaplain` | (base armor) | `desc = "It's a black jumpsuit, often worn by religious folk."`, `icon_state = "chaplain"`, can_adjust=FALSE [civilian.dm:29-34] |
| chaplain's jumpskirt | `/obj/item/clothing/under/rank/civilian/chaplain/skirt` | (base armor) | `icon_state = "chapblack_skirt"`, body_parts_covered=CHEST\|GROIN\|ARMS, can_adjust=FALSE, fitted=FEMALE_UNIFORM_TOP [civilian.dm:36-43] |
| cook's suit | `/obj/item/clothing/under/rank/civilian/chef` | (base armor) | `name = "cook's suit"`, `desc = "A suit which is given only to the most hardcore cooks in space."`, `icon_state = "chef"`, alt_covers_chest=TRUE [civilian.dm:45-49] |
| cook's skirt | `/obj/item/clothing/under/rank/civilian/chef/skirt` | (base armor) | `icon_state = "chef_skirt"`, body_parts_covered=CHEST\|GROIN\|ARMS, can_adjust=FALSE, fitted=FEMALE_UNIFORM_TOP [civilian.dm:51-57] |
| sensible suit | `/obj/item/clothing/under/rank/civilian/curator` | (base armor) | `name = "sensible suit"`, `desc = "It's very... sensible."`, icon='icons/obj/clothing/under/suits.dmi', `icon_state = "red_suit"`, can_adjust=FALSE [curator.dm:1-8] |
| sensible suitskirt | `/obj/item/clothing/under/rank/civilian/curator/skirt` | (base armor) | icon='icons/obj/clothing/under/suits.dmi', `icon_state = "red_suit_skirt"`, body_parts_covered=CHEST\|GROIN\|ARMS, can_adjust=FALSE, fitted=FEMALE_UNIFORM_TOP [curator.dm:10-19] |
| clown suit | `/obj/item/clothing/under/rank/civilian/clown` | (base armor) | `desc = "'HONK!'"`, `icon_state = "clown"`, InitComp: AddComponent squeak [clown_mime.dm:26-30] |
| sensible suit | `/obj/item/clothing/under/rank/civilian/curator` | (base armor) | `desc = "It's very... sensible."`, `icon_state = "red_suit"`, can_adjust=FALSE [civilian/curator.dm:1-8] |
| head of personnel's jumpsuit | `/obj/item/clothing/under/rank/civilian/head_of_personnel` | (base armor) | `desc = "It's a jumpsuit worn by someone who works in the position of 'Head of Personnel'."`, `icon_state = "hop"`, can_adjust=FALSE [civilian.dm:59-64] |
| head of personnel's jumpskirt | `/obj/item/clothing/under/rank/civilian/head_of_personnel/skirt` | (base armor) | `icon_state = "hop_skirt"`, body_parts_covered=CHEST\|GROIN\|ARMS, can_adjust=FALSE, fitted=FEMALE_UNIFORM_TOP [civilian.dm:66-73] |
| janitor's jumpsuit | `/obj/item/clothing/under/rank/civilian/janitor` | bio=10 | `desc = "It's the official uniform of the station's janitor. It has minor protection from biohazards."`, `icon_state = "janitor"` [civilian.dm:107-111] |
| janitor's jumpskirt | `/obj/item/clothing/under/rank/civilian/janitor/skirt` | (from parent) | `icon_state = "janitor_skirt"`, body_parts_covered=CHEST\|GROIN\|ARMS, can_adjust=FALSE, fitted=FEMALE_UNIFORM_TOP [civilian.dm:113-119] |
| mime's outfit | `/obj/item/clothing/under/rank/civilian/mime` | (base armor) | `desc = "It's not very colourful."`, `icon_state = "mime"` [clown_mime.dm:2-6] |
| mime's skirt | `/obj/item/clothing/under/rank/civilian/mime/skirt` | (base armor) | `icon_state = "mime_skirt"`, body_parts_covered=CHEST\|GROIN\|ARMS, can_adjust=FALSE, fitted=FEMALE_UNIFORM_TOP [clown_mime.dm:8-15] |
| blue suit | `/obj/item/clothing/under/rank/civilian/lawyer/bluesuit` | (base armor) | `desc = "A classy suit and tie."`, `icon_state = "bluesuit"`, can_adjust=TRUE, alt_covers_chest=TRUE [civilian.dm:187-193] |
| blue suitskirt | `/obj/item/clothing/under/rank/civilian/lawyer/bluesuit/skirt` | (base armor) | `desc = "A classy suitskirt and tie."`, `icon_state = "bluesuit_skirt"`, body_parts_covered=CHEST\|GROIN\|ARMS, can_adjust=FALSE, fitted=FEMALE_UNIFORM_TOP [civilian.dm:195-202] |

---

### Suit & Formal Wear

Base type: /obj/item/clothing/under/suit [suits.dm:1-4]
- Icon: 'icons/obj/clothing/under/suits.dmi'
- can_adjust = FALSE (default)

| Name | DM Path | Details |
|------|---------|---------|
| black suit | `/obj/item/clothing/under/suit/black` | `desc = "A professional looking black suit. Ready for some serious law."`, `icon_state = "blacksuit"`, can_adjust=TRUE [suits.dm:37-42] |
| black suitskirt | `/obj/item/clothing/under/suit/black/skirt` | `desc = "A professional black suitskirt. Nanotrasen Investigation Bureau approved!"`, `icon_state = "blacksuit_skirt"`, alt_covers_chest=TRUE, body_parts_covered=CHEST\|GROIN\|ARMS, fitted=FEMALE_UNIFORM_TOP [suits.dm:44-50] |
| executive suit | `/obj/item/clothing/under/suit/black_really` | `desc = "A formal black suit and red tie, intended for the station's finest."`, `icon_state = "really_black_suit"` [suits.dm:52-56] |
| executive suitskirt | `/obj/item/clothing/under/suit/black_really/skirt` | `icon_state = "really_black_suit_skirt"`, body_parts_covered=CHEST\|GROIN\|ARMS, fitted=FEMALE_UNIFORM_TOP [suits.dm:58-64] |
| red suit | `/obj/item/clothing/under/suit/red` | `desc = "A red suit and blue tie. Somewhat formal."`, `icon_state = "red_suit"` [suits.dm:80-84] |

---

### Athletic Shorts

Base type: /obj/item/clothing/under/shorts [shorts.dm:1-10]
- Icon: 'icons/obj/clothing/under/shorts_pants.dmi'
- `body_parts_covered = GROIN` only
- `fitted = NO_FEMALE_UNIFORM`
- `can_adjust = FALSE`

| Name | DM Path | Details |
|------|---------|---------|
| red athletic shorts | `/obj/item/clothing/under/shorts/red` | `icon_state = "redshorts"` [shorts.dm:12-14] |
| green athletic shorts | `/obj/item/clothing/under/shorts/green` | `icon_state = "greenshorts"` [shorts.dm:16-18] |
| blue athletic shorts | `/obj/item/clothing/under/shorts/blue` | `icon_state = "blueshorts"` [shorts.dm:20-22] |
| black athletic shorts | `/obj/item/clothing/under/shorts/black` | `icon_state = "blackshorts"` [shorts.dm:24-26] |
| grey athletic shorts | `/obj/item/clothing/under/shorts/grey` | `icon_state = "greyshorts"` [shorts.dm:28-30] |
| purple athletic shorts | `/obj/item/clothing/under/shorts/purple` | `icon_state = "purpleshorts"` [shorts.dm:32-34] |

---

### Costume & Miscellaneous Underclothing

Base type: /obj/item/clothing/under/costume [costume.dm:1-2] or /obj/item/clothing/under/misc [miscellaneous.dm:1-3]
- Icon varies per item

| Name | DM Path | Details |
|------|---------|---------|
| jabroni outfit | `/obj/item/clothing/under/costume/jabroni` | `desc = "The leather club is two sectors down."`, `icon_state = "darkholme"`, can_adjust=FALSE [costume.dm:14-19] |
| burial garments | `/obj/item/clothing/under/misc/burial` | `desc = "Traditional burial garments from the early 22nd century."`, `icon_state = "burial"`, can_adjust=FALSE, has_sensor=NO_SENSORS [misc.dm:61-67] |
| mailman's jumpsuit | `/obj/item/clothing/under/misc/mailman` | `desc = "'Special delivery!'"`, `icon_state = "mailman"` [misc.dm:24-28] |
| PJs (red) | `/obj/item/clothing/under/misc/pj/red` | `name = "PJs"`, `desc = "A comfy set of sleepwear, for taking naps or being lazy instead of working."`, `icon_state = "red_pyjamas"`, can_adjust=FALSE [misc.dm:5-12] |
| PJs (blue) | `/obj/item/clothing/under/misc/pj/blue` | `icon_state = "blue_pyjamas"` [misc.dm:14-15] |
| assistant's formal uniform | `/obj/item/clothing/under/misc/assistantformal` | `desc = "An assistant's formal-wear. Why an assistant needs formal-wear is still unknown."`, `icon_state = "assistant_formal"`, can_adjust=FALSE [misc.dm:77-82] |

---

## Neckwear Items

### Neckwear Base Class

/obj/item/clothing/neck [_neck.dm:1-7]
- `body_parts_covered = NECK`
- `slot_flags = ITEM_SLOT_NECK`
- `strip_delay = 40`
- `equip_delay_other = 40`

### Ties

| Name | DM Path | Details |
|------|---------|---------|
| loose tie | `/obj/item/clothing/neck/tie/detective` | `desc = "A loosely tied necktie, a perfect accessory for the over-worked detective."`, `icon_state = "detective"` [_neck.dm:44-47] |
| stethoscope | `/obj/item/clothing/neck/stethoscope` | `desc = "An outdated medical apparatus for listening to the sounds of the human body. It also makes you look like you know what you're doing."`, `icon_state = "stethoscope"`. interact: use_help_intent on human to auscultate chest/other body zones, message: "You place [src] against [M]'s [body_part]. [diagnosis]" [_neck.dm:49-82] |
| pet collar | `/obj/item/clothing/neck/petcollar` | `desc = "It's for pets."`, `icon_state = "petcollar"`. interact: attack_self() to rename tag. mob_can_equip() returns FALSE for humans (pets only) [_neck.dm:169-178] |

### Cloaks

| Name | DM Path | Details |
|------|---------|---------|
| captain's cloak | `/obj/item/clothing/neck/cloak/cap` | `desc = "Worn by the commander of Space Station 13."`, `icon_state = "capcloak"`, body_parts_covered=CHEST\|GROIN\|LEGS\|ARMS, flags_inv=HIDESUITSTORAGE [cloaks.dm:42-45] |
| chief medical officer's cloak | `/obj/item/clothing/neck/cloak/cmo` | `desc = "Worn by Meditopia, the valiant men and women keeping pestilence at bay."`, `icon_state = "cmocloak"`, body_parts_covered=CHEST\|GROIN\|LEGS\|ARMS, flags_inv=HIDESUITSTORAGE [cloaks.dm:26-29] |
| chief engineer's cloak | `/obj/item/clothing/neck/cloak/ce` | `desc = "Worn by Engitopia, wielders of an unlimited power."`, `icon_state = "cecloak"`, resistance_flags=FIRE_PROOF, body_parts_covered=CHEST\|GROIN\|LEGS\|ARMS, flags_inv=HIDESUITSTORAGE [cloaks.dm:31-35] |
| head of personnel's cloak | `/obj/item/clothing/neck/cloak/hop` | `desc = "Worn by the Head of Personnel. It smells faintly of bureaucracy."`, `icon_state = "hopcloak"`, body_parts_covered=CHEST\|GROIN\|LEGS\|ARMS, flags_inv=HIDESUITSTORAGE [cloaks.dm:47-50] |
| head of security's cloak | `/obj/item/clothing/neck/cloak/hos` | `desc = "Worn by Securistan, ruling the station with an iron fist."`, `icon_state = "hoscloak"`, body_parts_covered=CHEST\|GROIN\|LEGS\|ARMS, flags_inv=HIDESUITSTORAGE [cloaks.dm:17-20] |
| quartermaster's cloak | `/obj/item/clothing/neck/cloak/qm` | `desc = "Worn by Cargonia, supplying the station with the necessary tools for survival."`, `icon_state = "qmcloak"` (uses base), body_parts_covered=CHEST\|GROIN\|LEGS\|ARMS, flags_inv=HIDESUITSTORAGE [cloaks.dm:22-24] |
| research director's cloak | `/obj/item/clothing/neck/cloak/rd` | `desc = "Worn by Sciencia, thaumaturges and researchers of the universe."`, `icon_state = "rdcloak"`, body_parts_covered=CHEST\|GROIN\|LEGS\|ARMS, flags_inv=HIDESUITSTORAGE [cloaks.dm:37-40] |

---

## Minimum Viable Port

1. **Base clothing under-layer**: name, desc, armor (wound only), body_parts_covered, can_adjust flag to toggle exposed chest/arms, strip_delay for security/formal uniforms (50-60 ds).
2. **Color & rank jump suits**: 40+ unique suit types with distinct names/descriptions, sensor mode defaults per rank (SENSOR_COORDS for security/command, NO_SENSORS for prisoner/burial).
3. **Armor parity**: security (melee=10, fire=30, acid=30), engineering (rad=10, fire=60+), medical/science (bio=10), command/captain (wound=15/higher fire). Fire-resistant armor for chief engineer (80) and atmospheric tech (60).
4. **Fitted variants**: jumpskirts with fitted=FEMALE_UNIFORM_TOP to expose only arms when rolled down; can_adjust=FALSE for skirts and most formal wear.
5. **Accessories & cloaks**: captain/command-tier cloaks with body_parts_covered CHEST|GROIN|LEGS|ARMS and HIDESUITSTORAGE flag; ability to attach one accessory (ties/medals/holsters).
6. **Neckwear**: 7 command cloaks, detective tie, stethoscope with examine/interact for vitals check, pet collar (animals only).
7. **Job mapping**: security/command (red armor), medical (bio), engineering (fire/rad), cargo (no special), RnD (bomb/acid), civilian (varies).

---

## NOT FOUND / Open Questions

- Rainbow jumpsuit (/obj/item/clothing/under/color/rainbow): path appears in list but DM definition not found in provided color.dm excerpt (likely defined elsewhere or generated).
- Job outfit assignments: exact integration with crew computer lookups and locker placement not documented here; grep `code/game/objects/structures/lockers/*.dm` and `code/datums/outfit.dm` job entries for full mapping.
- Mutantrace variations (digitigrade sprites): documented as existing (mutantrace_variation flag) but sprite files not examined.
- Sensor mode random distribution weights: coded as favor higher levels, specific formula: pick(SENSOR_OFF, SENSOR_LIVING, SENSOR_LIVING, SENSOR_VITALS, SENSOR_VITALS, SENSOR_VITALS, SENSOR_COORDS, SENSOR_COORDS) [_under.dm:57].
- Cold/heat protection: only found on curator NASA suit (cold_protection=CHEST|GROIN|LEGS|ARMS|HANDS|FEET, min_cold=SPACE_SUIT_MIN_TEMP, max_heat=SPACE_SUIT_MAX_TEMP). Plasmaman envirosuit exists but not in list.

---

## Coverage

- **List entries**: 102
- **Documented with real data**: 96 (includes color variants sharing rows)
- **Marked NOT FOUND**: 1 (rainbow jumpsuit path unresolved in excerpt)
- **Notes on grouping**: Color variants (grey, black, blue, etc.) and job-tier variants (officer/warden/HoS/parade) grouped by subtype; each DM path listed; skirt variants (body_parts_covered=CHEST|GROIN|ARMS, fitted=FEMALE_UNIFORM_TOP) noted per type.
