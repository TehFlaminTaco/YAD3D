# Computers and Consoles in Tgstation 2020

All computers inherit from `/obj/machinery/computer` (code/game/machinery/computer/_computer.dm:1). This document covers the 80+ computer types found on BoxStation, their UI interactions, access requirements, and construction chains.

## Key Statistics

- **Total computer instances on BoxStation**: 168
- **Unique computer types**: 80+
- **Most common type**: `/obj/machinery/computer/secure_data` (11 instances)
- **Base stats**: max_integrity = 200 (code/game/machinery/computer/_computer.dm:9), armor = fire 40 / acid 20 (code/game/machinery/computer/_computer.dm:11), idle_power_usage = 300 W (code/game/machinery/computer/_computer.dm:7)

## Base Computer (`/obj/machinery/computer`)

- **File**: code/game/machinery/computer/_computer.dm:1
- **Power use**: idle_power_usage = 300 (W), active_power_usage = 300 (W) (code/game/machinery/computer/_computer.dm:7-8)
- **Max integrity**: 200 (code/game/machinery/computer/_computer.dm:9)
- **Armor**: list("fire" = 40, "acid" = 20) (code/game/machinery/computer/_computer.dm:11)
- **Key vars**:
  - `brightness_on = 1` (code/game/machinery/computer/_computer.dm:12) — controls light when powered
  - `icon_keyboard = "generic_key"` (code/game/machinery/computer/_computer.dm:13) — displayed when unpowered
  - `icon_screen = "generic"` (code/game/machinery/computer/_computer.dm:14) — screen state when powered
  - `time_to_screwdrive = 20 (ds)` (code/game/machinery/computer/_computer.dm:15) — time to deconstruct with screwdriver
  - `authenticated = 0` (code/game/machinery/computer/_computer.dm:16) — login state

### Base Interactions

- **Power change** (`power_change()` code/game/machinery/computer/_computer.dm:51-56): Sets light to `brightness_on` if powered, else 0
- **Damage/breaking** (`obj_break()` code/game/machinery/computer/_computer.dm:77-83): If circuit exists, breaks and plays "glassbr3.ogg" sound, sets light to 0
- **EMP effects** (`emp_act()` code/game/machinery/computer/_computer.dm:85-94):
  - Severity 1: 50% chance to break computer
  - Severity 2: 10% chance to break computer
- **Deconstruction** (`deconstruct()` code/game/machinery/computer/_computer.dm:96-121):
  - Creates `/obj/structure/frame/computer` at location
  - If broken: drops 2x `/obj/item/shard`, frame state = 3
  - If intact: frame state = 4
  - Preserves circuit board and any contained items
  - Message if broken: "The broken glass falls out."
  - Message if intact: "You disconnect the monitor."
- **Screwdriver action** (`screwdriver_act()` code/game/machinery/computer/_computer.dm:58-65): 20 (ds) delay to deconstruct if circuit present
- **Screen/keyboard overlays** (`update_overlays()` code/game/machinery/computer/_computer.dm:35-49):
  - If unpowered: shows `[icon_keyboard]_off`
  - If powered: shows `icon_keyboard`
  - Screen overlays always visible via `SSvis_overlays` on both normal and EMISSIVE planes

### Deconstruction/Construction Chain

Computer frame construction: `/obj/structure/frame/machine` (code/game/machinery/constructable_frame.dm:25-282)

**State 1 → State 2**: Add 5x cable coil
- Tool: cable coil (stack)
- Delay: 20 (ds)
- Tool action: `P.use_tool(src, user, 20, volume=50, amount=5)` (code/game/machinery/constructable_frame.dm:88)
- Message: "You start to add cables to the frame..." → "You add cables to the frame."
- Result: `icon_state = "box_1"`, `state = 2`

**State 2 → State 3**: Add circuit board (must be anchored for `needs_anchored` boards)
- Tool: machine circuit board
- Delay: None (instant when placed)
- Message: "You add the circuit board to the frame."
- Result: `icon_state = "box_2"`, `state = 3`, `components = list()`
- Note: Frame must be anchored if `circuit.needs_anchored` is TRUE (code/game/machinery/constructable_frame.dm:125-126)

**State 3 → State 4 (Final)**: Add required components, then screwdriver
- Tool: Components as specified by circuit's `req_components` list
- Then: Screwdriver
- Delay per component: varies (usually instant for non-stack items)
- When all components added: screwdriver creates final machinery
- Message: "You add [component] to [src]."
- Final result: Creates `/obj/machinery/new_type` at location with circuit board intact
- Drops: Cable (5x), all components placed in frame

**Disassembly (reverse)**:
- State 3 to 2: Crowbar to remove circuit board
  - Message: "You remove the circuit board [and other components]."
  - Drops: Circuit board + all components
- State 2 to 1: Wirecutter to remove cables
  - Message: "You remove the cables."
  - Drops: 5x cable coil
- State 1 removal: Screwdriver (40 ds) to disassemble frame
  - Message: "You disassemble the frame."
  - Drops: 5x metal sheet
  - Anchoring: Must be unanchored; wrench (40 ds) to toggle anchor

---

## Most Common Computer Types (by frequency on BoxStation)

### Secure Data Console  `/obj/machinery/computer/secure_data`

- **Instances**: 11
- **File**: code/game/machinery/computer/security.dm:1
- **Name**: "security records console"
- **Description**: "Used to view and edit personnel's security records."
- **Circuit board**: `/obj/item/circuitboard/computer/secure_data`
- **Access**: `req_one_access = list(ACCESS_SECURITY, ACCESS_FORENSICS_LOCKERS)` (code/game/machinery/computer/security.dm:6)
- **Power use**: idle_power_usage = 300 (inherited), active_power_usage = 300 (inherited)
- **Icon states**:
  - `icon_screen = "security"` (code/game/machinery/computer/security.dm:4)
  - `icon_keyboard = "security_key"` (code/game/machinery/computer/security.dm:5)
- **Light color**: LIGHT_COLOR_RED (code/game/machinery/computer/security.dm:21)
- **UI/Actions** (via `ui_interact()` code/game/machinery/computer/security.dm:35):
  - Screen 1: Record list search with sorting (Name/ID/Rank/Fingerprints) and criminal status display
  - Screen 2: Record maintenance (delete all records)
  - Screen 3: Individual security record view with:
    - Name, ID, Gender, Age, Species, Rank, Fingerprint (all editable)
    - Physical and mental status (display only)
    - Photo front/side (editable with photo preview, print, update)
    - Criminal status (editable)
    - Citations table (add new, edit)
    - Fine tracking
  - No access restrictions shown; uses `req_one_access` check before interaction
- **Variants**:
  - `/obj/machinery/computer/secure_data/syndie`: Uses `icon_keyboard = "syndie_key"` (code/game/machinery/computer/security.dm:23-24)
  - `/obj/machinery/computer/secure_data/laptop`: Portable version, `icon_state = "laptop"`, `icon_screen = "seclaptop"`, `pass_flags = PASSTABLE` (code/game/machinery/computer/security.dm:26-32)

---

### Security/Telescreen Computers  `/obj/machinery/computer/security/telescreen/*`

- **Instances**: Multiple variants (6 entertainment telescreen alone)
- **File**: code/game/machinery/computer/security.dm
- **Purpose**: Various security monitoring telescreen variants
- **Variants on map**:
  - `/obj/machinery/computer/security/telescreen/entertainment` (6x)
  - `/obj/machinery/computer/security/telescreen/prison` (1x)
  - `/obj/machinery/computer/security/telescreen/interrogation` (1x)
  - `/obj/machinery/computer/security/telescreen/vault` (1x)
  - `/obj/machinery/computer/security/telescreen/auxbase` (1x)
  - `/obj/machinery/computer/security/telescreen/cmo` (1x)
  - `/obj/machinery/computer/security/telescreen/ce` (1x)
  - `/obj/machinery/computer/security/telescreen/engine` (2x)
  - `/obj/machinery/computer/security/telescreen/toxins` (1x)
  - `/obj/machinery/computer/security/telescreen/research` (1x)
  - `/obj/machinery/computer/security/telescreen/rd` (1x)
  - `/obj/machinery/computer/security/telescreen/turbine` (1x)

---

### Station Alert Console  `/obj/machinery/computer/station_alert`

- **Instances**: 5
- **File**: code/game/machinery/computer/station_alert.dm:1
- **Name**: "station alert console"
- **Description**: "Used to access the station's automated alert system."
- **Circuit board**: `/obj/item/circuitboard/computer/stationalert` (code/game/machinery/computer/station_alert.dm:6)
- **Power use**: idle_power_usage = 300 (inherited), active_power_usage = 300 (inherited)
- **Icon states**:
  - `icon_screen = "alert:0"` (code/game/machinery/computer/station_alert.dm:4)
  - `icon_keyboard = "atmos_key"` (code/game/machinery/computer/station_alert.dm:5)
- **Light color**: LIGHT_COLOR_CYAN (code/game/machinery/computer/station_alert.dm:11)
- **UI Interface** (via `ui_interact()` code/game/machinery/computer/station_alert.dm:21-26):
  - TGUI-based interface ("StationAlertConsole")
  - Displays alarms by class: Fire, Atmosphere, Power (code/game/machinery/computer/station_alert.dm:9)
- **Alarm states** (via `update_overlays()` code/game/machinery/computer/station_alert.dm:81-92):
  - If broken or unpowered: no overlay
  - If active alarms exist: overlay "alert:2"
- **Alarm management**:
  - `triggerAlarm(class, area/A, O, obj/source)`: Adds source to alarm list (code/game/machinery/computer/station_alert.dm:39-62)
  - `cancelAlarm(class, area/A, obj/origin)`: Removes source from alarm, clears if no sources (code/game/machinery/computer/station_alert.dm:65-79)
  - Only triggers if source.z matches console z (code/game/machinery/computer/station_alert.dm:40-41)

---

### Crew Monitoring Console  `/obj/machinery/computer/crew`

- **Instances**: 4
- **File**: code/game/machinery/computer/crew.dm:3
- **Name**: "crew monitoring console"
- **Description**: "Used to monitor active health sensors built into most of the crew's uniforms."
- **Circuit board**: `/obj/item/circuitboard/computer/crew` (code/game/machinery/computer/crew.dm:11)
- **Power use**: idle_power_usage = 250 (W), active_power_usage = 500 (W) (code/game/machinery/computer/crew.dm:9-10)
- **Icon states**:
  - `icon_screen = "crew"` (code/game/machinery/computer/crew.dm:6)
  - `icon_keyboard = "med_key"` (code/game/machinery/computer/crew.dm:7)
- **Light color**: LIGHT_COLOR_BLUE (code/game/machinery/computer/crew.dm:13)
- **Data tracked** (via `update_data()` code/game/machinery/computer/crew.dm:104-223):
  - From nanite sensors (higher priority): All data
  - From suit sensors: Depends on sensor mode (SENSOR_LIVING, SENSOR_VITALS, SENSOR_COORDS)
  - For each person:
    - Name, assignment, job (sorted by job code)
    - Life status (alive/dead)
    - Damage types: oxydam, toxdam, burndam, brutedam
    - Location (area name, x/y coordinates)
    - Tracking capability
  - Sensor update rate: 100 (ds) = 10 seconds (code/game/machinery/computer/crew.dm:1)
- **UI Actions** (via `ui_act()` code/game/machinery/computer/crew.dm:228-234):
  - AI only: "select_person" action calls `AI.ai_camera_track(params["name"])`
- **Job codes** (for sorting): Captain=00, HoP=50, HoS=10, Captain=200 → Assistants=999 (code/game/machinery/computer/crew.dm:33-73)

---

### Communications Console  `/obj/machinery/computer/communications`

- **Instances**: 2
- **File**: code/game/machinery/computer/communications.dm:14
- **Name**: "communications console"
- **Description**: "A console used for high-priority announcements and emergencies."
- **Circuit board**: `/obj/item/circuitboard/computer/communications` (code/game/machinery/computer/communications.dm:20)
- **Access**: `req_access = list(ACCESS_HEADS)` (code/game/machinery/computer/communications.dm:19)
- **Power use**: idle_power_usage = 300 (inherited), active_power_usage = 300 (inherited)
- **Icon states**:
  - `icon_screen = "comm"` (code/game/machinery/computer/communications.dm:17)
  - `icon_keyboard = "tech_key"` (code/game/machinery/computer/communications.dm:18)
- **Light color**: LIGHT_COLOR_BLUE (code/game/machinery/computer/communications.dm:34)
- **States** (via Topic() code/game/machinery/computer/communications.dm:46-418):
  - STATE_DEFAULT (1): Main menu
  - STATE_CALLSHUTTLE (2): Emergency shuttle call form
  - STATE_CANCELSHUTTLE (3): Cancel shuttle confirmation
  - STATE_MESSAGELIST (4): List messages to crew
  - STATE_VIEWMESSAGE (5): View single message with possible answers
  - STATE_DELMESSAGE (6): Confirm delete message
  - STATE_STATUSDISPLAY (7): Set station status displays (Blank, Shuttle ETA, Message, Alerts)
  - STATE_ALERT_LEVEL (8): Current alert level display
  - STATE_CONFIRM_LEVEL (9): Confirm alert level change with ID swipe
  - STATE_TOGGLE_EMERGENCY (10): Enable/disable emergency maintenance access
  - STATE_PURCHASE (11): Purchase shuttle (if enabled)
- **Key Actions**:
  - `login`: Swipe ID to authenticate; becomes `authenticated = 2` if Captain (ACCESS_CAPTAIN in access)
  - `logout`: Deauthenticate
  - `swipeidseclevel`: Only Captain can change alert level (SEC_LEVEL_GREEN to SEC_LEVEL_BLUE only)
  - `announce`: Requires `authenticated = 2` (Captain); uses announcer cooldown
  - `crossserver`: Send message to allied stations (600 (ds) cooldown after use)
  - `MessageCentCom`: Send to CentCom (600 (ds) cooldown)
  - `MessageSyndicate`: Send to Syndicate (if emagged, 600 (ds) cooldown)
  - `callshuttle`: Call emergency shuttle (with reason text)
  - `cancelshuttle`: Cancel shuttle
  - `nukerequest`: Request nuclear codes from CentCom (Captain only)
  - `emergencyaccess`: Toggle emergency maintenance access (Captain only)
  - `buyshuttle`: Purchase replacement shuttle (Captain only, requires budget)
- **AI Interface**: Limited to message list, shuttle call, status display, alert level, emergency access

---

### Cargo Consoles  `/obj/machinery/computer/cargo/*`

- **Instances**: 5+ (cargo supply, request)
- **File**: Multiple files (code/game/machinery/computer/... likely)
- **Variants on map**:
  - `/obj/machinery/computer/cargo` (5x supply console)
  - `/obj/machinery/computer/cargo/request` (2x request console)

---

### Arcade Machines  `/obj/machinery/computer/arcade`

- **Instances**: 4
- **File**: code/game/machinery/computer/arcade.dm:58
- **Name**: "random arcade" (varies by game: "arcade machine")
- **Description**: "random arcade machine"
- **Circuit boards** (auto-selected on spawn if none present, code/game/machinery/computer/arcade.dm:74-81):
  - `/obj/item/circuitboard/computer/arcade/battle` (49% weight)
  - `/obj/item/circuitboard/computer/arcade/orion_trail` (49% weight)
  - `/obj/item/circuitboard/computer/arcade/amputation` (2% weight)
- **Power use**: idle_power_usage = 300 (inherited), active_power_usage = 300 (inherited)
- **Icon states**:
  - `icon_state = "arcade"` (code/game/machinery/computer/arcade.dm:61)
  - `icon_keyboard = "no_keyboard"` (code/game/machinery/computer/arcade.dm:62)
  - `icon_screen = "invaders"` (code/game/machinery/computer/arcade.dm:63)
- **Light color**: LIGHT_COLOR_GREEN (code/game/machinery/computer/arcade.dm:65)
- **Interactions** (code/game/machinery/computer/arcade.dm:84-144):
  - Prize vending with 2 arcade tickets
  - On attack with arcade ticket: If ≥2 tickets, dispense 1 prize and consume 2 tickets
  - Prize selection: Random from `GLOB.arcade_prize_pool` (40+ item types)
  - Message: "[src] dispenses [prize]!", "You hear a chime and a clunk."
  - Special: Legendary gamer with TRAIT_GAMERGOD gets 2x prizes
  - Rare event (0.01% per prize): Dispenses pulse rifle
- **EMP response** (code/game/machinery/computer/arcade.dm:107-129):
  - Severity 1: Ejects 1-4 prizes, creates explosion
  - Severity 2: Ejects 0-2 prizes, creates explosion

---

### Slot Machines  `/obj/machinery/computer/slot_machine`

- **Instances**: 5
- **File**: Unknown (NOT_FOUND in provided files)
- **Likely function**: Gambling/credit dispenser

---

### Medical Data Console  `/obj/machinery/computer/med_data*`

- **Instances**: 3 (med_data) + 2 (med_data/laptop)
- **File**: code/game/machinery/computer/medical.dm
- **Likely function**: Patient record access (medical records)

---

### Prisoner Management Computer  `/obj/machinery/computer/prisoner/management`

- **Instances**: 2
- **File**: code/game/machinery/computer/prisoner/management.dm
- **Circuit board**: `/obj/item/circuitboard/computer/prisoner` (code/game/machinery/computer/prisoner/management.dm)
- **Likely function**: Prisoner records and gulag access management

---

### Gulag Teleporter Computer  `/obj/machinery/computer/prisoner/gulag_teleporter_computer`

- **Instances**: 1
- **File**: code/game/machinery/computer/prisoner/gulag_teleporter.dm
- **Circuit board**: `/obj/item/circuitboard/computer/gulag_teleporter_console`
- **Function**: Controls teleporter to gulag/brig

---

### Operating Theater Computer  `/obj/machinery/computer/operating`

- **Instances**: 3
- **File**: code/game/machinery/computer/Operating.dm
- **Circuit board**: `/obj/item/circuitboard/computer/operating`
- **Function**: Surgical theater control (likely anesthesia/lights)

---

### RD Server/Console Types

- `/obj/machinery/computer/rdconsole/core` (2x): Research Director console, core systems
- `/obj/machinery/computer/rdconsole/production` (3x): R&D production authorization
- `/obj/machinery/computer/rdservercontrol` (1x): R&D server control
- **Files**: code/game/machinery/computer/ (NOT_FOUND for detailed interaction data)

---

### Shuttle Computers

- `/obj/machinery/computer/shuttle/mining` (4x): Mining shuttle control
- `/obj/machinery/computer/shuttle/labor` (2x): Labor shuttle control
- `/obj/machinery/computer/shuttle/mining/common` (1x): Common mining shuttle
- **Function**: Call/cancel shuttles

---

### Atmospheric Computers

- `/obj/machinery/computer/atmos_alert` (3x): Atmospheric alarm console
- `/obj/machinery/computer/atmos_control` (2x): Atmosphere control
- `/obj/machinery/computer/atmos_control/incinerator` (1x): Incinerator control
- `/obj/machinery/computer/atmos_control/toxinsmix` (1x): Toxins mix control
- `/obj/machinery/computer/atmos_control/tank/*` (7x variants): Individual gas tank control
  - `/tank/oxygen_tank`, `/tank/nitrogen_tank`, `/tank/carbon_tank`, `/tank/air_tank`, `/tank/mix_tank`, `/tank/toxin_tank`, `/tank/nitrous_tank`
- **File**: code/game/machinery/computer/atmos_control.dm
- **Function**: Atmosphere and gas control

---

### Security Records Computer (`/obj/machinery/computer/security`)

- **Instances**: 4
- **Variants on map**:
  - `/obj/machinery/computer/security` (4x)
  - `/obj/machinery/computer/security/hos` (1x) — Head of Security variant
  - `/obj/machinery/computer/security/mining` (3x) — Mining security
  - `/obj/machinery/computer/security/labor` (1x) — Labor division
  - `/obj/machinery/computer/security/qm` (1x) — Quartermaster security
  - `/obj/machinery/computer/security/wooden_tv` (1x) — Wooden case variant
- **File**: code/game/machinery/computer/security.dm

---

### Card Access Computers  `/obj/machinery/computer/card*`

- **Instances**: 3 (card) + variants
- **Variants**:
  - `/obj/machinery/computer/card` (3x): ID card access modification
  - `/obj/machinery/computer/card/minor/hos` (1x): Head of Security minor access
  - `/obj/machinery/computer/card/minor/ce` (1x): Chief Engineer minor access
  - `/obj/machinery/computer/card/minor/cmo` (1x): Chief Medical Officer minor access
  - `/obj/machinery/computer/card/minor/rd` (1x): Research Director minor access
- **Files**: code/game/machinery/computer/card.dm
- **Circuit boards**:
  - `/obj/item/circuitboard/computer/card`
  - `/obj/item/circuitboard/computer/card/centcom`
  - `/obj/item/circuitboard/computer/card/minor`

---

### Scan Console  `/obj/machinery/computer/scan_consolenew`

- **Instances**: 3
- **File**: code/game/machinery/computer/dna_console.dm
- **Circuit board**: `/obj/item/circuitboard/computer/scan_consolenew`
- **Function**: DNA/genetic scanning

---

### Other Computer Types (partial list)

- `/obj/machinery/computer/monitor` (2x): Monitor display
- `/obj/machinery/computer/libraryconsole` (1x): Library system
- `/obj/machinery/computer/bookmanagement` (2x): Book/library management
- `/obj/machinery/computer/camera_advanced` (2x xenobio, 1x base_construction): Advanced camera control
- `/obj/machinery/computer/warrant` (2x): Warrant system
- `/obj/machinery/computer/bounty` (3x): Bounty tracking
- `/obj/machinery/computer/teleporter` (1x): Teleporter control
- `/obj/machinery/computer/robotics` (1x): Robotics lab control
- `/obj/machinery/computer/mecha` (1x): Mecha assembly control
- `/obj/machinery/computer/bank_machine` (1x): Credit card reader
- `/obj/machinery/computer/message_monitor` (1x): Message display monitor
- `/obj/machinery/computer/gateway_control` (1x): Gateway device control
- `/obj/machinery/computer/holodeck` (1x): Holodeck simulator control
- `/obj/machinery/computer/launchpad_control` (NOT_FOUND)
- `/obj/machinery/computer/pandemic` (1x): Pathogen tracking
- `/obj/machinery/computer/turbine_computer` (1x): Turbine control
- `/obj/machinery/computer/mech_bay_power_console` (3x): Mech bay power management
- `/obj/machinery/computer/nanite_chamber_control` (2x): Nanite chamber control
- `/obj/machinery/computer/nanite_cloud_controller` (2x): Nanite cloud control
- `/obj/machinery/computer/apc_control` (1x): Power distribution control
- `/obj/machinery/computer/pod/old` (1x): Old-style pod control
- `/obj/machinery/computer/upload/ai` (1x): AI law upload
- `/obj/machinery/computer/upload/borg` (1x): Borg law upload
- `/obj/machinery/computer/telecomms/server` (1x): Telecommunications server
- `/obj/machinery/computer/telecomms/monitor` (1x): Telecommunications monitor

---

## Ranking by Usefulness in Multiplayer Game

For a first-person multiplayer game prioritizing player interaction and game state visibility, the most useful consoles are:

### **Tier 1: Critical for Gameplay**

1. **Communications Console** (`/obj/machinery/computer/communications`)
   - Data read: Shuttle status, current alert level, emergency access state, message queue
   - Actions: Call/cancel shuttle, change alert level (if Captain), emergency maintenance access toggle
   - Impact: Defines round progression (evacuation timer) and security state

2. **Station Alert Console** (`/obj/machinery/computer/station_alert`)
   - Data read: Fire alarms by area, atmospheric alarms, power alarms
   - Actions: Display only (monitoring)
   - Impact: Situational awareness of station hazards

3. **Crew Monitor Console** (`/obj/machinery/computer/crew`)
   - Data read: Crew location, assignment, vital status, damage levels (if sensors enabled)
   - Actions: AI-only camera tracking
   - Impact: High-value recon tool for locating players

4. **Secure Data Console** (`/obj/machinery/computer/secure_data`)
   - Data read: Security records (criminal status, citations), general crew records (name, ID, rank)
   - Actions: Edit all personnel records, add charges/fines
   - Impact: Role-playing and record-keeping; Security uses for arrests

### **Tier 2: Important for Departments**

5. **Cargo Console** (`/obj/machinery/computer/cargo`)
   - Data read: Supply shuttle status, cargo requests, budget
   - Actions: Order supplies, approve/deny requests, purchase new shuttle
   - Impact: Economy and resource management

6. **Atmosphere Console** (`/obj/machinery/computer/atmos_control`)
   - Data read: Current gas mix and pressures in connected areas
   - Actions: Adjust gas flows, mix atmospheres, vent or pressurize spaces
   - Impact: Environmental hazard creation/resolution

7. **RD Console** (`/obj/machinery/computer/rdconsole/production`)
   - Data read: Research tech tree, buildable items
   - Actions: Authorize production queues
   - Impact: Science department item availability

8. **Medical Records** (`/obj/machinery/computer/med_data`)
   - Data read: Patient medical history, genetic records
   - Actions: Update patient records
   - Impact: Medical role-play and patient tracking

### **Tier 3: Niche/Fun**

9. **Prisoner Management** (`/obj/machinery/computer/prisoner/management`)
   - Data read: Prisoner records
   - Actions: Release/reassign prisoners
   - Impact: Security department roster

10. **Shuttle Computers** (mining/labor)
    - Data read: Shuttle docking/transit status
    - Actions: Call/recall shuttle
    - Impact: Department-specific transport

### **Data Model for Top 5**

**Communications Console** reads:
- `SSshuttle.emergency.mode` (SHUTTLE_IDLE, SHUTTLE_CALL, SHUTTLE_RECALL, SHUTTLE_DOCKING, etc.)
- `SSshuttle.emergency.timer` or equivalent
- `GLOB.security_level` (SEC_LEVEL_GREEN, BLUE, RED, DELTA)
- `GLOB.emergency_access` (boolean)
- `messages` (list of `/datum/comm_message` objects with title, content, answer choices)

**Station Alert Console** reads:
- `alarms["Fire"]`, `alarms["Atmosphere"]`, `alarms["Power"]` (lists of areas with active alerts)
- For each alarm: source objects, linked cameras

**Crew Monitor Console** reads:
- `GLOB.suit_sensors_list` and `GLOB.nanite_sensors_list` (list of mobs with active sensors)
- For each: name, assignment, location (area/x/y), vital status, damage levels, sensor mode

**Secure Data Console** reads:
- `GLOB.data_core.general` (list of `/datum/data/record` with crew demographics)
- `GLOB.data_core.security` (list of records with criminal status, citations)
- Fields: name, ID, rank, fingerprints, criminal status, citations with fines

**Cargo Console** reads:
- `SSshuttle.supply.mode`, `SSshuttle.supply.timer`
- Supply requisition list (items, requestor, approval status)
- Budget/credits from bank account

---

## Minimum Viable Port

1. **Communications Console**
   - Shuttle status display and call button
   - Alert level selector (requires Captain ID)
   - Emergency maintenance access toggle

2. **Station Alert Console**
   - Display active alerts by category (Fire/Atmosphere/Power)
   - Update on alarm state changes

3. **Crew Monitor Console**
   - Display crew names, assignments, locations, vital status
   - Support suit sensor modes (off/basic/location/vitals)

4. **Computer Frame Assembly**
   - Cable coil placement (state 1→2)
   - Circuit board placement (state 2→3)
   - Component insertion and completion

5. **Computer Deconstruction**
   - Screwdriver to deconstruct into frame (lose computer, keep circuit board)
   - Reverse frame assembly to get metal/cables back

6. **Power and Lighting**
   - Turn lights on when powered, off when unpowered or broken
   - Track power consumption (idle vs. active)

7. **Authentication for Access**
   - ID card checks for access-restricted consoles
   - Captain-only features on communications console

8. **TGUI Interface Framework**
   - Support state-based screens (main menu, sub-menu, actions)
   - Update dialog on action completion

---

## NOT FOUND / Open Questions

- Circuit board `req_components` lists for each computer type: NOT_FOUND
- Detailed interaction code for cargo, atmos, RD, med_data consoles: Files referenced but specific UI code not fully examined
- Exact power consumption breakdown (active vs. idle) for specialized consoles: Most use inherited 300 W, some show 250/500
- Camera integration with advanced camera controls: Frame.dm references but camera code not reviewed
- Telecomms server/monitor functionality: Files mention existence but code NOT_FOUND
- Message monitor display: Existence confirmed but interaction code NOT_FOUND
- Exact wording of all system messages beyond those cited: Many messages in large files not fully extracted

