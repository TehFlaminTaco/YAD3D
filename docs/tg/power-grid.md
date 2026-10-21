# Power Grid & Area Power

The power system manages electricity distribution across the station through cables and APCs. A **powernet** is a contiguous network of cables and machines. Each powernet tracks available power, load, and surplus. **Area power** is controlled per-room by an **APC (Area Power Controller)**, which manages three channels (equipment, lighting, environment). All power is in watts; all time in deciseconds (ds).

## Powernet Datum  `/datum/powernet`  (code/modules/power/powernet.dm)

- Central data structure for each contiguous cable network
- Key vars: `number` (unique id), `cables` (list of all cable/junction objects), `nodes` (list of connected machines)
- Power state: `load` (W, current draw); `newavail` (W, gathered this tick, becomes `avail`); `avail` (W, available power now); `viewavail` (W, smoothed for UI); `viewload` (W, smoothed for UI); `netexcess` (W, avail−load); `delayedload` (W, load queued for next tick) (code/modules/power/powernet.dm:10-16)
- `proc/reset()` (line 79): runs end-of-tick. If `netexcess > 100 W` and machines exist, finds all `SMES` objects in nodes and calls `.restore()` on each (line 84-85). Smooths `viewavail` and `viewload` toward true values (0.8 old + 0.2 new) (line 88-89). Resets for next tick: `load ← delayedload`, `delayedload ← 0`, `avail ← newavail`, `newavail ← 0` (line 92-95).
- `proc/get_electrocute_damage()` (line 97): if `avail >= 1000 W`, returns `clamp(20 + round(avail/25000), 20, 195) + rand(-5,5)` damage; else 0 (line 98-101). (Cabling can shock unpowered users for electrocution.)
- `proc/add_cable(C)`, `proc/remove_cable(C)` (line 47, 39): add or remove cable; if empty after removal, deletes itself.
- `proc/add_machine(M)`, `proc/remove_machine(M)` (line 68, 59): add or remove power machine; if empty, deletes itself.

## Cables  `/obj/structure/cable`  (code/modules/power/cable.dm)

- Flexible superconducting insulated cable for power transfer (code/modules/power/cable.dm:14-27)
- Key vars: `linked_dirs` (bitflag which directions connect); `node` (bool, for sprite display); `cable_layer` (CABLE_LAYER_1 red / CABLE_LAYER_2 yellow / CABLE_LAYER_3 blue); `powernet` (datum/powernet)
- Subtypes: `/obj/structure/cable/layer1` (red, CABLE_LAYER_1), `/obj/structure/cable/layer3` (blue, CABLE_LAYER_3)
- **Connections**: `proc/Connect_cable()` (line 52) scans cardinal neighbours for cables on matching layer and adjacent machinery (terminal or SMES underneath). Sets `linked_dirs` bitflags; calls `update_icon()` (line 92). Prevents SMES↔terminal crossing (line 69-84).
- **Merging powernets**: `proc/mergeConnectedNetworks(direction)` (line 239) in each cardinal. If a matching cable with a powernet is found (line 255), merges powernets or assigns self to its network (line 260-263).
- **Powernet propagation** (code/modules/power/power.dm:226): `propagate_network(start_cable, new_powernet)` flood-fills from a cable, collects all linked cables and power machines, assigns them to the powernet.
- **Cutting a cable**: `proc/cut_cable_from_powernet()` (line 344) disconnects all machines on the turf (line 354), removes self from powernet (line 365), and spawns two new powernets from the two sides of the cut (line 368-372).
- **Deconstruct**: `proc/deconstruct()` (line 114) drops 1 `/obj/item/stack/cable_coil` if not NODECONSTRUCT flagged (line 116), then `qdel(src)` (line 117).
- **Damage**: `proc/shock(user, probability, siemens_coeff = 1)` (line 176) shocks on `prob(probability)`, calls `electrocute_mob(user, powernet, src, siemens_coeff)` (line 179), does 5 sparks if true.
- **Interaction**: with wirecutters, cuts the cable verbatim `"[user] cuts the cable."` and calls `deconstruct()` (line 151-155). With multitool, if powered displays `"Total power: [DisplayPower(powernet.avail)]\nLoad: [DisplayPower(powernet.load)]\nExcess power: [DisplayPower(surplus())]"` and shocks with 5% probability (line 159-163).

### Cable Coil `/obj/item/stack/cable_coil`  (code/modules/power/cable.dm:384)

- Item stack to place cables; `max_amount = MAXCOIL` (fixed max stack), `amount = MAXCOIL` (default full stack) (code/modules/power/cable.dm:394-395)
- Colors: yellow (CABLE_LAYER_2, default), red (CABLE_LAYER_1), blue (CABLE_LAYER_3), white (multilayer hub)
- Recipes (code/modules/power/cable.dm:382): cable restraints (15 coils), multilayer cable (1 coil), multiZ layer cable (1 coil)
- **Placing cable**: `proc/place_turf(turf/T, mob/user)` (line 538): turfs must be plating/catwalk, not intact floor, within distance 1 (line 540-552). Creates new cable object, new empty powernet, calls `mergeConnectedNetworks()` in all 4 cardinal directions (line 562-566). Uses 1 coil (line 569). If `shock(user, 50)` succeeds, 50% chance cable is deconstructed (line 571-574). Delay for placement: implicit in click-wait, no explicit delay stated.
- **Layer selection**: Ctrl+Click opens radial menu (line 453) to switch between layers (line 470-500). Sets `target_type`, `target_layer`, `color` accordingly.
- **Cable healing** (line 508): attacking a human with robotic limb calls `item_heal_robotic(H, user, 0, 15)` with 50 (ds) do_mob delay (line 516), uses 1 coil if successful (line 519).

## Area Power in Code  `/area`  (code/game/area/areas.dm)

- **Power channels**: `power_equip` (equipment power, bool), `power_light` (lighting power, bool), `power_environ` (environment power, bool) (line 61-63)
- **Power flags**: `requires_power` (bool, default TRUE; areas without power never use APCs) (line 46), `always_unpowered` (bool, set TRUE for space; returns 0 from `powered()`) (line 48)
- **Power usage tracking**: `power_usage` (list of 16 entries for channels AREA_USAGE_LIGHT, AREA_USAGE_EQUIP, AREA_USAGE_ENVIRON, and their static variants, plus AREA_USAGE_STATIC_LIGHT, AREA_USAGE_STATIC_EQUIP, AREA_USAGE_STATIC_ENVIRON) (line 91)
- **Check power**: `proc/powered(chan)` (line 476) returns 1 if area has power, 0 if not. If `!requires_power` returns 1 (line 478), if `always_unpowered` returns 0 (line 480). Else checks `power_equip` (AREA_USAGE_EQUIP), `power_light` (AREA_USAGE_LIGHT), `power_environ` (AREA_USAGE_ENVIRON) (line 483-488).
- **Update power**: `proc/power_change()` (line 503) called when APC changes power state or on area init. For each machine in area, calls `M.power_change()` (line 504-505). Sends signal COMSIG_AREA_POWER_CHANGE (line 506). Calls `update_icon()` (line 507).
- **Record usage**: `proc/use_power(amount, chan)` (line 535) adds `amount` to `power_usage[chan]` for dynamic channels (line 537-538).
- **Static power**: `proc/addStaticPower(value, powerchannel)` (line 518) adds permanent load to a static channel (AREA_USAGE_STATIC_LIGHT, etc.) (line 520-521).
- **Clear usage**: `proc/clear_usage()` (line 528) zeros all dynamic channels AREA_USAGE_LIGHT through AREA_USAGE_ENVIRON after APC reads them (line 529-530).

### Machinery Power Base  `/obj/machinery/power`  (code/modules/power/power.dm)

- Base class for all power-connected machines
- `powernet` (datum/powernet, or null if disconnected)
- `use_power` (NO_POWER_USE default; if non-zero, machine draws from area)
- `idle_power_usage`, `active_power_usage` (W, unused in this version; actual usage is tracked in area)
- `machinery_layer` (default MACHINERY_LAYER_1 for cable layer detection)
- **Connect to network**: `proc/connect_to_network()` (line 137) searches turf for cable node or terminal, adds self to powernet (line 143-152)
- **Disconnect**: `proc/disconnect_from_network()` (line 155) removes self from powernet (line 158)
- **Power check**: `proc/avail(amount)` (line 55) returns 1 if powernet.avail >= amount (or total avail if amount=0) (line 56-57)
- **Power surplus**: `proc/surplus()` (line 49) returns clamped `powernet.avail - powernet.load` (0 to avail) (line 50-51)
- **Add load**: `proc/add_load(amount)` (line 45) increments powernet.load during tick (line 46-47)
- **Add available**: `proc/add_avail(amount)` (line 38) increments powernet.newavail (for generators) (line 39-40)
- **Delayed load**: `proc/add_delayedload(amount)` (line 61) adds to powernet.delayedload for next tick (line 62-63)
- **Delayed surplus**: `proc/delayed_surplus()` (line 65) returns clamped `powernet.newavail - powernet.delayedload` (line 66-67)
- **Powered check** (area-level): `proc/powered(chan)` (line 82) checks area power without powernet, defaults to `power_channel` (line 85-93)
- **Use power** (area-level): `proc/use_power(amount, chan)` (line 96) adds to area usage (line 102)
- **Power change callback**: `proc/power_change()` (line 120) checks if `powered(power_channel)`, sets/clears NOPOWER flag on machine_stat, sends COMSIG_MACHINERY_POWER_RESTORED or COMSIG_MACHINERY_POWER_LOST, calls `update_icon()` (line 124-134)

## APC (Area Power Controller)  `/obj/machinery/power/apc`  (code/modules/power/apc.dm)

- Wall-mounted controller managing one area's electrical systems (code/modules/power/apc.dm:41-46)
- Key vars (line 48-107):
  - `cell` (stock_parts/cell object, the power battery)
  - `start_charge` (default 90%, charge % on map init)
  - `cell_type` (default `/obj/item/stock_parts/cell/upgraded`; determines capacity and charge rate)
  - `opened` (APC_COVER_CLOSED/OPENED/REMOVED)
  - `lighting`, `equipment`, `environ` (0=off, 1=off(auto), 2=on, 3=on(auto))
  - `operating` (bool; breaker is ON)
  - `charging` (APC_NOT_CHARGING, APC_CHARGING, APC_FULLY_CHARGED)
  - `chargemode` (bool; 1=try to charge)
  - `locked` (bool; interface locked/unlocked)
  - `has_electronics` (APC_ELECTRONICS_MISSING/INSTALLED/SECURED)
  - `terminal` (power/terminal object; wired to powernet)
  - `area` (area object)
  - `lastused_light`, `lastused_equip`, `lastused_environ`, `lastused_total` (W, from area last tick)
  - `main_status` (0=no power, 1=excess<load, 2=excess>=load)
  - `longtermpower` (charge state predictor, -10 to 10; charges at <30% if > -10)
  - `shorted` (bool, if true powers nothing)
  - `coverlocked` (bool)
  - `panel_open` (bool)
  - `malfai`, `occupier` (for AI malfunction feature)
  - `failure_timer` (ticks of blackout)
- Subtypes: `/obj/machinery/power/apc/highcap/five_k` (cell_type = upgraded/plus), `/obj/machinery/power/apc/highcap/ten_k` (cell/high), `/obj/machinery/power/apc/highcap/fifteen_k` (cell/high/plus); `/obj/machinery/power/apc/auto_name` (auto_name = TRUE, positioned at cardinal directions with pixel offsets)
- **Construction** (code/modules/power/apc.dm:562): frame (wallframe/apc), then insulated gloves to remove exposed wires (if broken), electronics board installed (do_after 10 ds, message "You place the power control board inside the frame."), secured with screwdriver (switch has_electronics from INSTALLED to SECURED, toggle MAINT flag), 10 cable coils (do_after 20 ds, message "You add cables to the APC frame."), power cell inserted (message "You insert the power cell.") (code/modules/power/apc.dm:561-613)
  - **Deconstruction**: reverse. Frame broken = drops metal. Crowbar open cover, remove cell (drop), remove electronics (switch to MISSING, drop electronics/apc), cut cables with wirecutters (drops terminal), weld closed and remove from wall (drops wallframe/apc or metal if broken)
- **Process** (line 1178): Core tick logic for power management and charging:
  1. If broken or in maintenance, return (line 1181-1182)
  2. If area doesn't require power, return (line 1183-1184)
  3. If failure_timer > 0, decrement it (line 1185-1189), return
  4. Read area usage from last tick: `lastused_light` (AREA_USAGE_LIGHT + AREA_USAGE_STATIC_LIGHT), `lastused_equip`, `lastused_environ`, total (line 1192-1197)
  5. Clear area usage for this tick (line 1195)
  6. Check surplus: if `avail() == 0` then `main_status = 0`, else if `surplus() < 0` then `main_status = 1`, else `main_status = 2` (line 1205-1212)
  7. **Cell power draw and recharge loop** (line 1214-1302):
     - Draw from cell: `cellused = min(cell.charge, GLOB.CELLRATE * lastused_total)`, `cell.use(cellused)` (line 1216-1217)
     - If `excess > lastused_total` (excess power), recharge cell by same amount: `cell.give(cellused)`, `add_load(cellused/GLOB.CELLRATE)` (line 1219-1222)
     - Else if `(cell.charge/GLOB.CELLRATE + excess) >= lastused_total` (can cover from cell+grid): recharge at available rate, `add_load(excess)` (line 1226-1228)
     - Else (not enough power): turn off auto channels with `autoset()` (line 1235-1237)
  8. **Charge state logic** (line 1243-1269):
     - If `charging` and `longtermpower < 10`, increment (line 1243-1244)
     - Else if `longtermpower > -10`, decrement by 2 (line 1245-1246)
     - If `cell.percent() == 0%`: turn all channels off (line 1248-1251)
     - Else if `cell.percent() < 15%` and `longtermpower < 0`: set equipment/lighting to auto-off (2), environment to auto-on (1) (line 1253-1256)
     - Else if `cell.percent() < 30%` and `longtermpower < 0`: set equipment to auto-off (2), lighting/environment to auto-on (1) (line 1258-1261)
     - Else (normal): set all to auto-on (1) (line 1263-1266)
  9. **Trickle-charge** (line 1272-1281): If `chargemode && charging == APC_CHARGING && operating` and `excess > 0 W`:
     - Max charge rate: `ch = min(excess*GLOB.CELLRATE, cell.maxcharge*GLOB.CHARGELEVEL)` (line 1275)
     - `add_load(ch/GLOB.CELLRATE)`, `cell.give(ch)` (line 1276-1277)
     - Else stop charging (line 1280)
  10. **Check full charge** (line 1284-1286): if `cell.charge >= maxcharge`, clamp to max, set `charging = APC_FULLY_CHARGED`
  11. **Auto-start charging** (line 1288-1302): if `chargemode` and not charging, if `excess > cell.maxcharge*GLOB.CHARGELEVEL`, increment `chargecount`. If `chargecount == 10`, reset count, start charging (line 1290-1298).
  12. **Update UI**: if any channel (lighting/equipment/environ) or charging changed, call `queue_icon_update()` and `update()` (line 1315-1320)
- **Channel modes**: 0=off, 1=off(auto), 2=on, 3=on(auto). `proc/autoset(val, on)` (line 1325) toggles auto flags: if `on==0` turns on channels off (2→0, 3→1); if `on==1` turns off channels on (1→3); if `on==2` toggles auto-on to auto-off (3→1). Returns unchanged if already in target state.
- **UI data**: `ui_data()` (line 860) returns locked, failTime, isOperating, externalPower (main_status), powerCellStatus, chargeMode, chargingStatus, totalLoad, coverLocked, siliconUser, malfStatus, emergencyLights, nightshiftLights, and three powerChannels (Equipment/Lighting/Environment) each with title, powerLoad, status (0-3), and UI action topics (auto/on/off).
- **Construction frame** `/obj/item/wallframe/apc` (code/modules/power/apc.dm): dropped when APC is deconstructed. Place on wall with 10 metal to start construction.
- **Electronics** `/obj/item/electronics/apc` (line 1485): power control module, dropped when removed from APC, inserted back to reinstall.
- **Update icon**: `proc/update_icon()` (line 283) checks `check_updates()` (line 284) which returns 0/1/2 (no update / state only / overlays only) based on cell, broken, opened, emagged, panel_open, operating, charging, lighting, equipment, environ states. Sets icon_state (e.g., "apc0"=closed normal, "apc2"=cell present and opened, "apcmaint"=broken opened, "apc-b"=broken, "apcemag"=emagged, "apcewires"=wires exposed) (line 293-313). Adds vis_overlays for charging indicator, channel states (0/1/2 for each), lock indicator (line 320-331). Light: red if not charging, blue if charging, green if full (line 334-341).
- **Wire interaction**: when panel_open and not opened, wire tools interact via `wires.interact(user)` (code/datums/wires/apc.dm). Wires: WIRE_IDSCAN (lock control), WIRE_POWER1/WIRE_POWER2 (shorts), WIRE_AI (disables AI).
- **Destruction**: `proc/set_broken()` (line 1380) sets operating = FALSE, calls `obj_break()`, if occupier shunt them out, calls `update()`.
- **Integration with terminal**: terminal is auto-created at APC location on Initialize. APC connects to powernet via its terminal. Terminal has master pointer back to APC.

## Power Monitor Console  `/obj/machinery/computer/monitor`  (code/modules/modular_computers/file_system/programs/powermonitor.dm)

- Shows real-time power data for attached powernet (code/modules/modular_computers/file_system/programs/powermonitor.dm:1)
- Data displayed (line 83-101): current supply (viewavail), demand (viewload), history (60 ticks rolling window, sampled every 50 ds = 5 seconds), all areas' APCs with name, charge%, load (W), charging state, and each channel status (0-3)
- Attached by placing computer on a turf with a cable, or by powering it from its area's APC

## Minimum Viable Port

1. Powernet datum with avail/load/viewavail/viewload tracking; reset() smoothing views and SMES restore
2. Cable structure with layer color distinction; Connect_cable() linking; mergeConnectedNetworks() and cut_cable_from_powernet() powernet topology
3. Cable coil item with place_turf() creating cables; shock risk on placement
4. Area vars power_equip/power_light/power_environ; powered(chan) check; power_change() propagating updates
5. APC with cell charge/discharge; process() tick logic handling surplus/shortfall and auto channel shutdown
6. Three power channels (equipment/lighting/environment) with 0/1/2/3 modes (off/auto-off/on/auto-on)
7. Terminal as power machine on APC turf, connecting APC to powernet
8. Main_status indicator (no power / load excess / normal)
9. Charging logic: auto-start above cell.maxcharge*CHARGELEVEL, trickle-charge if excess, stop if not
10. Icon states: apc0 (closed), apc2 (open with cell), apc-b (broken), apcemag (emagged), apcewires (wires open)

## NOT FOUND / Open Questions

- GLOB.CELLRATE and GLOB.CHARGELEVEL constants not found in this version; must be defined in global power.dm or a subsystem
- Cable shock electrocution does not specify siemens_coeff behavior or how resistance scales damage in this version
- Terminal construction steps, deconstruction chain, and exact tool interactions NOT FOUND; cable placing hints at terminal existence but no terminal.dm file examined
- Power monitor display format (graph rendering, axis labels) NOT FOUND; only data-gathering procs documented
- SMES (Smart Mega Energy Stores) mentioned in powernet reset (restore()) but no SMES.dm examined for charge/discharge mechanics
- Whether broken/emagged APCs can be repaired in-game or only replaced NOT FULLY DOCUMENTED; socket replacement from wallframe exists but not complete chain
