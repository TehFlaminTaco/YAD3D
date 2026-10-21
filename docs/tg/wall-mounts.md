# Wall-mounted structures and machines

Anything mounted on walls: lights, switches, alarms, intercoms, cameras, cabinets. Everything except doors/windows. Build/break chains, power use, materials, emergency modes, damage response.

---

### Light fixture (tube)  `/obj/structure/light_construct`   (code/modules/power/lighting.dm:39)
- A light fixture under construction; becomes `/obj/machinery/light` when complete.
- Key vars: stage = 1|2|3 (empty/wired/finished), fixture_type = "tube", sheets_refunded = 2, max_integrity = 200 (code/modules/power/lighting.dm:46)
- Interactions:
  | held item / action | condition | delay (ds) | message(s) verbatim | result |
  | --- | --- | --- | --- | --- |
  | cable_coil (1 length) | stage=1 | 0 | `[user.name] adds wires to [src]` | stage→2, uses 1 cable |
  | wrench | stage=1 | 30 | `You begin deconstructing [src]` | drops 2 metal sheets, deletes fixture |
  | wirecutter | stage=2 | 0 | `[user.name] removes the wiring from [src]` | stage→1, drops 1 cable |
  | screwdriver | stage=2 | 0 | `[user.name] closes [src]'s casing` | creates `/obj/machinery/light/built`, stage→3 |
  | stock_parts/cell | anytime | 0 | `[user] hooks up [W] to [src]` | installs cell for emergency power backup |
- Construction chain: wallframe → stage 1 (empty frame) → add cable (stage 2) → add optional power cell → screwdriver (stage 3/complete)
- Deconstruction chain: wrench (on stage 1) → drops metal sheets + cable
- Drops: on deconstruction with `disassembled=TRUE`: 2 metal sheets; on wrench: 2 metal sheets
- Health: max_integrity = 200, armor = [melee:50, laser:10, fire:80, acid:50]
- Power: none until completed
- Gotchas: must have power cell removed before wrench; can only build in dynamic-lighting areas (code/modules/power/lighting.dm:33)

### Light fixture (small/bulb)  `/obj/structure/light_construct/small`   (code/modules/power/lighting.dm:189)
- Identical to tube variant but uses `/obj/item/light/bulb` instead of tube; sheets_refunded = 1 (code/modules/power/lighting.dm:193)
- Wallframe: `/obj/item/wallframe/light_fixture/small` (code/modules/power/lighting.dm:23), icon_state = "bulb-construct-item"

### Light fixture (completed)  `/obj/machinery/light`   (code/modules/power/lighting.dm:198)
- A powered light; comes in tube (brightness=8) and small/bulb (brightness=4) variants.
- Key vars: on=FALSE, status=LIGHT_OK|LIGHT_EMPTY|LIGHT_BROKEN|LIGHT_BURNED, brightness=8 (default), max_integrity=100, cell (optional emergency backup), nightshift_enabled=FALSE, emergency_mode=FALSE
- Idle power: 2 W; active: 20 W per tube, 4 W per bulb (static_power_used = brightness*20 when on) (code/modules/power/lighting.dm:207-209, 388-395)
- Interactions:
  | held item / action | condition | delay (ds) | message(s) verbatim | result |
  | --- | --- | --- | --- | --- |
  | light tube/bulb | status != LIGHT_OK | 0 | `You insert [L]` or `You replace [L]` | inserts light, sets status from item, on if powered |
  | empty hand | status = LIGHT_EMPTY | 0 | `You remove the light [fitting]` | opens casing, allows deconstruction |
  | empty hand (on light) | status != LIGHT_EMPTY && on | 0 | `You try to remove... but burn your hand` (5 burn if no heat protection) | fails to remove unless gloves/trait |
  | screwdriver | status = LIGHT_EMPTY | 0 | `You open [src]'s casing` | deconstructs to `/obj/structure/light_construct` |
  | attack/damage | anytime | 0 | sparks if on | prob(damage*5) to break_light_tube() |
- Emergencies: if powered but area has no lightswitch power, activates emergency mode: brightness*0.25, color=#FF3232, uses battery cell at 0.2 W/tick (code/modules/power/lighting.dm:235-240, 379-382)
- Cell recharge: on power, charges automatically at 80 units/tick if emergency_mode (code/modules/power/lighting.dm:416)
- Built variants: `/obj/machinery/light/built` and `/obj/machinery/light/small/built` start with status=LIGHT_EMPTY, no initial cell (code/modules/power/lighting.dm:270-286)
- Nightshift: if enabled in area APC, brightness→nightshift_brightness=8, power→0.45, color→#FFDDCC (code/modules/power/lighting.dm:229-233, 362-366)
- Rigged lights: if rigged=TRUE (injected with plasma via syringe), explode on switch-on at brightness level 2 (code/modules/power/lighting.dm:370-372)
- Burn out: prob(min(60, (switchcount^2)*0.01)) on each switch (code/modules/power/lighting.dm:373)
- Fire exposure: temperature > T0C+200 triggers break_light_tube() (code/modules/power/lighting.dm:754)
- Dropped: created with new /obj/machinery/light/built (code/modules/power/lighting.dm:166-168); placed on wall via wallframe

### Light item (tube)  `/obj/item/light/tube`   (code/modules/power/lighting.dm:794)
- A removable light tube item; can be inserted into compatible fixtures.
- Key vars: status=LIGHT_OK|LIGHT_BROKEN|LIGHT_BURNED, brightness=8, switchcount=0, rigged=FALSE
- Interactions:
  | held item / action | condition | delay (ds) | message(s) verbatim | result |
  | --- | --- | --- | --- | --- |
  | syringe w/ plasma | anytime | 0 | `You inject the solution into [src]` | rigged=TRUE (5u plasma sets rigged) |
  | throw/drop | anytime | 0 | hits ground or mob | shatters; if rigged, spawns 5u plasma at location (code/modules/power/lighting.dm:887) |
- Status: LIGHT_OK shows as normal, LIGHT_BURNED shows burned, LIGHT_BROKEN shows broken (code/modules/power/lighting.dm:824-834)
- Subtypes: `/obj/item/light/tube/broken` starts broken (code/modules/power/lighting.dm:802)

### Light item (bulb)  `/obj/item/light/bulb`   (code/modules/power/lighting.dm:805)
- Identical to tube but brightness=4 (code/modules/power/lighting.dm:813)
- Subtypes: `/obj/item/light/bulb/broken` (code/modules/power/lighting.dm:815)

### Light switch  `/obj/machinery/light_switch`   (code/game/machinery/lightswitch.dm:2)
- Controls lights in its area; one or more per area.
- Key vars: area (the area it controls, defaults to own area), power_channel=AREA_USAGE_LIGHT
- Interactions:
  | held item / action | condition | delay (ds) | message(s) verbatim | result |
  | --- | --- | --- | --- | --- |
  | click | any | 0 | none | toggles area.lightswitch; calls area.power_change() which notifies all lights |
- Icon states: light1 (on), light0 (off), light-p (no power); emissive glow when on (code/game/machinery/lightswitch.dm:26-37)
- Power notification: calls power_change() when area loses/gains power (code/game/machinery/lightswitch.dm:54-57)
- EMP: power_change() triggered on EMP if not protected (code/game/machinery/lightswitch.dm:59-64)

### Fire alarm  `/obj/machinery/firealarm`   (code/game/machinery/firealarm.dm:15)
- Detects fire (temperature) and activates fire protocol; manually triggerable.
- Key vars: detecting=1 (thermal sensor active), buildstage=0|1|2 (circuit gone/no wires/complete), panel_open=FALSE, last_alarm=0
- Max integrity: 250, armor=[melee:0, laser:0, fire:90, acid:30], idle_power=2W, active_power=6W
- Interactions:
  | held item / action | condition | delay (ds) | message(s) verbatim | result |
  | --- | --- | --- | --- | --- |
  | click | buildstage=2 | 0 | `You [reset/alarm]` | toggles A.fire state via A.firealert()/A.firereset() |
  | screwdriver (buildstage=2) | any | 0 | `The wires have been [exposed/unexposed]` | toggles panel_open |
  | welder (panel_open, buildstage=2) | damaged | 40 | `You begin repairing [src]` → `You repair [src]` | restores obj_integrity to max |
  | multitool (panel_open, buildstage=2) | any | 0 | `You [reconnect/disconnect] [src]'s detecting unit` | toggles detecting |
  | wirecutter (panel_open, buildstage=2) | buildstage=2 | 0 | `You cut the wires from [src]` | drops 5 cable, buildstage→1 |
  | cable coil 5× (panel_open) | buildstage=1 | 0 | `You wire [src]` | buildstage→2 |
  | crowbar (panel_open) | buildstage=1 | 20 | `You start prying out the circuit` | drops /obj/item/electronics/firealarm (or nothing if broken), buildstage→0 |
  | electronics/firealarm (panel_open) | buildstage=0 | 0 | `You insert the circuit` | buildstage→1 |
  | wrench (buildstage=0, panel_open) | any | 0 | `You remove the fire alarm assembly` | drops /obj/item/wallframe/firealarm, deletes self |
- Construction: frame → stage 0 (open) → insert electronics → stage 1 → add 5 cable → stage 2 (complete)
- Deconstruction: screwdriver to open panel → crowbar to remove electronics → wrench to remove frame
- Thermal trigger: temperature > T0C+200 or < BODYTEMP_COLD_DAMAGE_LIMIT (if last_alarm + 67 ds < world.time) triggers alarm() (code/game/machinery/firealarm.dm:122)
- Cooldown: 67 ds (length of FireAlarm.ogg) between alarms (FIREALARM_COOLDOWN) (code/game/machinery/firealarm.dm:1)
- EMP: prob(50/severity) chance to trigger alarm (code/game/machinery/firealarm.dm:108)
- Emagged: disables thermal detection; shows fire_emagged overlay (code/game/machinery/firealarm.dm:111-119)
- Wallframe: `/obj/item/wallframe/firealarm` (code/game/machinery/firealarm.dm:8)

### Air alarm  `/obj/machinery/airalarm`   (code/modules/atmospherics/machinery/airalarm.dm:60)
- Monitors atmosphere (pressure, temperature, gases) and commands vents/scrubbers; user-configurable.
- Key vars: danger_level=0 (0=safe, 1=warning, 2=critical), mode=AALARM_MODE_SCRUBBING (1=scrub, 2=vent, 3=panic, 4=replace, 5=off, 6=flood/emagged, 7=siphon, 8=contaminated, 9=refill), buildstage=0|1|2 (circuit gone/no wires/complete), locked=TRUE
- Max integrity: 250, idle_power=4W, active_power=8W, req_access=ACCESS_ATMOSPHERICS
- Thresholds (defaults):
  - Pressure: min2=HAZARD_LOW, min1=WARNING_LOW, max1=WARNING_HIGH, max2=HAZARD_HIGH (kPa)
  - Temperature: min2=T0C, min1=T0C+10, max1=T0C+40, max2=T0C+66 (K)
  - O₂: min1=19, max1=135, max2=140 (partial pressure, kPa); min2=-1 (no lower limit)
  - N₂: max1=1000, max2=1000 (inert, no toxicity)
  - CO₂: max1=5, max2=10
  - Plasma/Nitrous/BZ/water_vapor: max1=0.2, max2=0.5 (dangerous)
  - Miasma: max1=15, max2=30 (custom threshold)
- Construction (buildstage 0→2): insert electronics → stage 1 → add wires → stage 2 (complete)
- Wallframe: `/obj/item/wallframe/airalarm` (code/modules/atmospherics/machinery/airalarm.dm:41)

### Intercom  `/obj/item/radio/intercom`   (code/game/objects/items/devices/radio/intercom.dm:1)
- Wall-mounted radio; anchored to wall; broadcasting=mode INTERCOM, listening=yes by default.
- Key vars: unscrewed=FALSE, on (depends on area power), canhear_range=2
- Interactions:
  | held item / action | condition | delay (ds) | message(s) verbatim | result |
  | --- | --- | --- | --- | --- |
  | screwdriver | unscrewed=FALSE | 40 | `You unscrew [src], loosening it from the wall` | unscrewed→TRUE |
  | screwdriver | unscrewed=TRUE | 30 | `You tighten [src]'s screws` | unscrewed→FALSE |
  | wrench | unscrewed=TRUE | 80 | `You detach [src] from the wall` | drops /obj/item/wallframe/intercom, deletes self |
  | click/interact | any | 0 | opens UI | talk via MODE_INTERCOM (MODE_TOKEN_INTERCOM) to broadcast through area |
- Power state: on if area has equipment power; AreaPowerCheck() called on area power change (code/game/objects/items/devices/radio/intercom.dm:116-122)
- Icon state: intercom (on), intercom-p (no power) (code/game/objects/items/devices/radio/intercom.dm:102-107)
- EMP: turns off (calls end_emp_effect→AreaPowerCheck); resets on power restore (code/game/objects/items/devices/radio/intercom.dm:94-100)
- Wallframe: `/obj/item/wallframe/intercom` (code/game/objects/items/devices/radio/intercom.dm:128), pixel_shift=29, custom_materials=[iron:75, glass:25]

### Camera assembly  `/obj/structure/camera_assembly`   (code/game/machinery/camera/camera_assembly.dm:14)
- Intermediate construction stage for cameras; final stage creates `/obj/machinery/camera`.
- Key vars: state=STATE_WRENCHED|WELDED|WIRED|FINISHED (1|2|3|4), xray_module, emp_module (plasma), proxy_module (motion sensor)
- Max integrity: 150
- Construction stages:
  | state | 1 (WRENCHED) | 2 (WELDED) | 3 (WIRED) | 4 (FINISHED) |
  | --- | --- | --- | --- | --- |
  | **From prev** | wrench assembly | welder (3 fuel) | cable 2× | screwdriver + network config |
  | **To next** | welder (3 fuel) | cable 2× | screwdriver | creates /obj/machinery/camera |
  | **Delay** | 20 ds | 0 | 0 | 0 (UI input for networks) |
  | **Message** | - | `You weld [src] securely into place` | `You add wires to [src]` | creates camera, asks for network names |
- Upgrades (insertable at state=WIRED):
  - Plasma sheet (1×): adds emp_module (EMP-proof), confirms on examine
  - Analyzer: adds xray_module (X-ray vision), confirms on examine
  - Prox sensor: adds proxy_module (motion detection), confirms on examine
- Deconstruction: wrench at state=WRENCHED drops frame; crowbar at state=WIRED removes upgrades (user pick dialog)
- Wallframe: `/obj/item/wallframe/camera` (code/game/machinery/camera/camera_assembly.dm:6), custom_materials=[iron:400, glass:250]

### Camera (security camera)  `/obj/machinery/camera`   (code/game/machinery/camera/camera.dm:5)
- Active surveillance; optionally upgraded; EMP-able; can be bugged.
- Key vars: network=list("ss13"), c_tag="Area Name (###)", status=TRUE, upgrades=0 (bitflag: CAMERA_UPGRADE_XRAY|EMP_PROOF|MOTION), emped=0, internal_light=TRUE
- Idle power: 5 W, active: 10 W
- Max integrity: 100, armor=[melee:50, bullet:20, laser:20, fire:90, acid:50]
- Interactions:
  | held item / action | condition | delay (ds) | message(s) verbatim | result |
  | --- | --- | --- | --- | --- |
  | screwdriver | any | 0 | `You screw the camera's panel [open/closed]` | toggles panel_open |
  | wrench (panel_open) | status=TRUE | 0 | `You remove the assembly frame` | drops wallframe, deletes camera |
  | wirecutter (panel_open, status=FALSE) | any | 0 | `You restore the wiring` | status→TRUE |
- EMP: 90 SECONDS cooldown; network clears, emped flag set, light turns off; post_emp_reset() restores after 90s (code/game/machinery/camera/camera.dm:141-174)
- Upgrades: checked on Initialize from assembly; can be added to assembly and transferred to camera
- Subtypes:
  - `/obj/machinery/camera/preset/toxins`: invuln=TRUE, use_power=NO_POWER_USE, c_tag="Bomb Testing Site", network=["rd","toxins"] (hardened test camera)
  - `/obj/machinery/camera/autoname`: auto-assigns name from area (code/game/machinery/camera/camera.dm; not fully shown)
  - `/obj/machinery/camera/motion`: adds motion sensor upgrade on Initialize

### Door button  `/obj/machinery/button/door`   (code/game/machinery/buttons.dm:183)
- Wall-mounted door control; coordinates synchronized doors or individual control (normaldoorcontrol=FALSE for grouped, TRUE for /obj/item/assembly/control/airlock).
- Key vars: req_access=list() (empty=public), panel_open=FALSE, device (/obj/item/assembly/control), board (/obj/item/electronics/airlock), skin="doorctrl"
- Idle power: 2 W
- Interactions:
  | held item / action | condition | delay (ds) | message(s) verbatim | result |
  | --- | --- | --- | --- | --- |
  | click | powered & allowed | 0 | `[skin]1` icon flash | calls device.pulsed() |
  | screwdriver (panel_open) | any | 0 | flips icon to "button-open" | toggles panel_open |
  | wrench (panel_open, no device, no board) | any | 40 | `You unsecure the button frame` | drops /obj/item/wallframe/button, deletes self |
  | assembly (panel_open) | !device | 0 | `You add [W] to the button` | device=W |
  | airlock electronics (panel_open) | !board | 0 | `You add [W] to the button` | board=W, sets req_access/req_one_access |
  | click (panel_open) | !device && !board | 0 | swaps skin | toggles skin between "doorctrl" and "launcher" |
- Skin types: "doorctrl" (standard), "launcher" (alternate appearance)
- Access: emag clears all access requirements; alt-click toggles access (code/game/machinery/buttons.dm:109-115)
- Wallframe: `/obj/item/wallframe/button` (code/game/machinery/buttons.dm:285), custom_materials=[iron:MINERAL_MATERIAL_AMOUNT]
- Subtypes: `/obj/machinery/button/massdriver`, `/obj/machinery/button/ignition`, `/obj/machinery/button/flasher`, `/obj/machinery/button/crematorium`

### Defibrillator mount  `/obj/machinery/defibrillator_mount`   (code/game/machinery/defibrillator_mount.dm:4)
- Wall-mounted holder for defibrillators; charges them passively (PENLITE variant at 1 idle W).
- Key vars: defib (/obj/item/defibrillator), clamps_locked=FALSE, wallframe_type=/obj/item/wallframe/defib_mount, idle_power=0W
- Interactions:
  | held item / action | condition | delay (ds) | message(s) verbatim | result |
  | --- | --- | --- | --- | --- |
  | click | defib mounted | 0 | `You are already holding [defib]'s paddles` (if held) | puts defib.paddles in hand |
  | click | no defib | 0 | `There's no defibrillator unit loaded` | error |
  | defibrillator item | defib=NULL | 0 | `You press [I] into the mount` | defib=I, begins processing |
  | ID card swipe | any | 0 | `Clamps [dis]engaged` (if access) | toggles clamps_locked |
  | multitool | clamps_locked=TRUE | 100 | `You override the locking clamps` | clamps_locked→FALSE |
  | wrench | defib=NULL | 0 | `You remove [src] from the wall` | drops wallframe, deletes self |
  | alt-click | defib mounted | 0 | `You unhook [defib]` or `dropping it on the floor` | removes defib, puts in hand or drops |
- Charging (PENLITE only): process() charges cell 80 units/tick at 100 W if < maxcharge (code/game/machinery/defibrillator_mount.dm:172-177)
- Overlays: shows "defib", online/emagged status, charge level (25/50/75/100%), clamps if locked (code/game/machinery/defibrillator_mount.dm:39-55)
- Wallframe subtypes:
  - `/obj/item/wallframe/defib_mount`: standard mount (custom_materials=[iron:300, glass:100], result_path=/obj/machinery/defibrillator_mount)
  - `/obj/item/wallframe/defib_mount/charging`: PENLITE mount (adds silver:50, result_path=/obj/machinery/defibrillator_mount/charging, idle_power=1W)

### Extinguisher cabinet  `/obj/structure/extinguisher_cabinet`   (code/game/objects/structures/extinguisher.dm:1)
- Wall-mounted cabinet holding one fire extinguisher; breakable glass; can be opened/closed.
- Key vars: stored_extinguisher, opened=FALSE, max_integrity=200
- Armor: [melee:0, laser:0, fire:90, acid:50]
- Interactions:
  | held item / action | condition | delay (ds) | message(s) verbatim | result |
  | --- | --- | --- | --- | --- |
  | click (hand) | stored_extinguisher & !opened | 0 | `You take [stored_extinguisher]` | removes from cabinet, user gets item |
  | click (hand) | !stored_extinguisher & opened | 0 | toggles open | opened→FALSE |
  | alt-click | any | 0 | toggles open | opened=!opened |
  | extinguisher item | opened & !stored | 0 | `You place [I] in [src]` | stored_extinguisher=I |
  | wrench | !stored_extinguisher | 60 | `You unsecure [name]` | deconstructs (drops frame if disassembled) |
  | damage | anytime | 0 | sparks | if obj_integrity < 0, breaks (opened→TRUE, drops extinguisher) |
- Icon states: extinguisher_closed (locked), extinguisher_full (open with item), extinguisher_mini (open with mini), extinguisher_empty (open no item) (code/game/objects/structures/extinguisher.dm:123-132)
- Deconstruction: wrench → drops wallframe (if disassembled) or 2 metal sheets (if destroyed)
- Wallframe: `/obj/item/wallframe/extinguisher_cabinet` (code/game/objects/structures/extinguisher.dm:155), result_path=/obj/structure/extinguisher_cabinet

### Fire axe cabinet  `/obj/structure/fireaxecabinet`   (code/game/objects/structures/fireaxe.dm:1)
- Wall-mounted cabinet with single fire axe inside; locked by default; glass breakable.
- Key vars: locked=TRUE, open=FALSE, fireaxe (/obj/item/fireaxe), max_integrity=150
- Armor: [melee:50, bullet:20, laser:0, fire:90, acid:50]
- Interactions:
  | held item / action | condition | delay (ds) | message(s) verbatim | result |
  | --- | --- | --- | --- | --- |
  | click (locked & closed) | any | 0 | `The [name] won't budge` | nothing |
  | click (!locked & closed) | any | 0 | toggles open | open=!open |
  | click (open) | fireaxe | 0 | `You take the fire axe` | removes from cabinet, user gets item |
  | multitool / cyborg | any | 20 | `Resetting circuitry` → `You [disable/re-enable] the locking modules` | toggles locked |
  | welder | damaged & !broken | 40 | `You begin repairing [src]` | restores integrity to max |
  | glass sheets (2×) | broken | 20 | `You start fixing [src]` | broken→0, integrity→max |
  | fireaxe item | open & !fireaxe | 0 | `You place the [F.name] back` | fireaxe=I |
  | damage | anytime | 0 | sparks | if obj_integrity ≤ 0, broken→TRUE (drops shards) |
- Overlays: show glass damage (glass1-4 opacity), locked/unlocked icon, glass_raised (open)
- Deconstruction: none; only breakage
- Drops on break: 2 glass shards

### Newscaster  `/obj/machinery/newscaster`   (code/game/machinery/newscaster.dm:181)
- Wall-mounted news display terminal; reads and publishes news feeds; tracks paper remaining.
- Key vars: screen=0 (main menu), paper_remaining=15, securityCaster=0, max_integrity=200, unit_no (auto-assigned on Init)
- Idle power: none specified (relies on parent /obj/machinery defaults); armor=[melee:50, fire:50, acid:30]
- Interactions: UI-based; user clicks to interact, reads news, posts articles, prints newspapers
- Icon states: newscaster_normal (operational, no alert), newscaster_wanted (wanted issue active), newscaster_off (no power/broken) (code/game/machinery/newscaster.dm:227-234)
- Wallframe: `/obj/item/wallframe/newscaster` (code/game/machinery/newscaster.dm:173), custom_materials=[iron:14000, glass:8000]

---

## Counts from BoxStation.dmm

| Item | Count |
| --- | --- |
| /obj/machinery/camera (all types) | 228 |
| /obj/machinery/airalarm (all types) | 130 |
| /obj/machinery/button (all types) | 94 |
| /obj/machinery/firealarm | 83 |
| /obj/item/radio/intercom | 91 |
| /obj/machinery/light_switch | 64 |
| /obj/structure/extinguisher_cabinet | 63 |
| /obj/machinery/newscaster | 27 |
| /obj/machinery/defibrillator_mount | 3 |

---

## Minimum viable port

- Wallframe base: `try_build(turf)` validation (no double placement, only on floors, area allowed), `attach(turf)` spawning result_path with dir/pixel_shift, deconstruction via wrench
- Lights: stage system (1=empty, 2=wired, 3=finished); icon states per stage; cable/screwdriver progression; emergency power cell support for off-power activation
- Light switches: area.lightswitch toggle; power_change() broadcast to all lights in area; icon state on/off
- Fire alarms: buildstage 0→2; panel_open toggle; thermal trigger (temp > T0C+200); alarm() call on trigger or manual click; cooldown 67 ds
- Air alarms: buildstage 0→2; mode selection UI; pressure/temperature/gas thresholds; vent/scrubber control signals
- Intercoms: anchor to wall; on/off tied to area power; MODE_INTERCOM broadcast within range
- Cameras: assembly state machine (wrenched/welded/wired/finished); network assignment on screwdriver; upgrades (plasma/analyzer/prox sensor)
- Buttons: device/board slots in panel; access check; pulsed() on click (tells device to fire)
- Defibrillators: mount holds defib; clamps lock/unlock via ID; removes paddles on hand-click; PENLITE passive charging
- Cabinets (extinguisher/fireaxe): stored_extinguisher/fireaxe var; open/close toggle; wrench removes from wall

## NOT FOUND / open questions

- Precise power use values for some machines (newscaster not specified; inferred from parent /obj/machinery)
- Visual glint/overlay system (see EMISSIVE_PLANE usage in lights, but detailed implementation out of scope)
- Borg-specific interactions (many machines reject borg/alien; not fully enumerated per machine)
- Emagged flood mode details for air alarm (turns off scrubbers + pressure checks on vents; mode=AALARM_MODE_FLOOD)
- Signs (many subtypes; not machines, so excluded—appear in _ours-structures.txt but have no build chain)
