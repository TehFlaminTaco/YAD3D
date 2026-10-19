# YAD3D: Yet Another Dead 3D

Space Station 13, in first person, in your browser. The map is the real BoxStation, the sprites and sounds are SS13's own,
the jobs, access, outfits and most of the text come from the SS13 source. The HUD takes its look from Marathon (green
phosphor terminals, a motion tracker). It plays like a round of SS13: lobby, job slots, a crew of other people, things going wrong.

* **Rounds.** Pick a job in the lobby, ready up, spawn on the station. Jobs have the real slot counts. Join late from
  Arrivals, or observe. Die and you become a ghost. A round ends with the evacuation shuttle (or when everyone is dead or gone)
  and a round-end report, then the server starts the next one.
* **Multiplayer.** An authoritative server (`server/index.js`) runs the simulation; browsers connect over WebSocket. Empty
  job slots are filled by NPC crew so the station is never empty. With nobody else around, the browser hosts a round itself
  using the *same* simulation and protocol.
* **SS13 inventory.** Two hands, a swap key, real worn slots (uniform, suit, shoes, gloves, glasses, ears, mask, head, neck,
  belt, ID, back, both pockets, suit storage), nested containers with SS13's size classes, intents (help / disarm / grab / harm),
  throw mode, internals.
* **SS13 chat.** `T` to speak, `;` for the common radio, `:e` `:m` `:s` `:n` `:u` `:v` `:c` for department channels (needs a
  headset), `:h` for your own department, `Y` whisper, `M` emote, `O` OOC. Speech has a range and needs line of sight; the dead
  talk to the dead.
* **Systems.** Atmospherics with real partial pressures and decompression, APC power with emergency cells and a blackout, fire
  alarms and firelocks, access-controlled airlocks (crowbars work on dead ones), meteors that blow holes in the hull, space carp,
  welding breaches shut, escape pods and the emergency shuttle, console programs (APC, air alarm, crew monitor, power monitor,
  comms, ...).

## Playing

```sh
npm install
npm start                      # http://localhost:8080 - multiplayer server (add --bots 20, --autostart 30, --port 9000)
```

Or, for a round hosted entirely in your own browser (no Node needed to play, just a static file server):

```sh
python3 tools/serve.py 8123    # then open http://localhost:8123
```

Pick a job, press **Ready** (a short countdown starts the round), or **Start now**. Click the view to capture the mouse.
`?name=Alex` sets your name, `?bots=N` sets how many NPCs fill the crew (single player), `?local` forces a local round even when
served by the game server.

### Controls

| Key | |
| --- | --- |
| `W A S D`, mouse, `Shift` | Move, look, run |
| Left click | Use the item in your active hand on what the crosshair is on; pick up; open; attack (harm intent) |
| Right click | Examine |
| `1 2 3 4` | Intent: help, disarm, grab, harm |
| `X` | Swap active hand |
| `E` | Equip the held item (draws from your belt with empty hands) |
| `Z` | Use the held item in hand (light, tank, welder, medkit, ...) |
| `Q` / `R` | Drop / toggle throw mode |
| `I` | Inventory: click or drag items between slots, hands and open containers |
| `V` / `F` | Toggle internals / flashlight |
| `T` `Y` `M` `O` | Say / whisper / emote / OOC (`;` and `:x` prefixes work in Say) |
| `Tab` | Station map |
| `B` | Stop the timed action you are doing |
| `F1`, `F2` | Help, mute |

## How it is put together

```
assets/        generated: level.json (BoxStation + shuttles), terrain/sprite atlases, sounds
data/          generated: jobs.json (jobs, slots, access, outfits), contents.json
tools/         Python data pipeline (DMI/DMM/DM readers), test harnesses
src/shared/    rules both sides run: world & collision, movement, doors, atmos, power, items, chat rules
src/sim/       the authoritative game: Sim, rounds, jobs, inventory, actions, chat, AI, director, consoles
src/render/    Three.js terrain mesh, instanced sprites, lighting
src/client/    transports, replica of the world, view, prediction, HUD and screens
server/        static files + WebSocket host
```

* **One simulation, two transports.** `Sim` is plain logic with no DOM or Three.js. The server instantiates it in Node; the
  browser instantiates the very same class for a local round. A client only sees `send(msg)` / `poll()` (`src/client/net.js`).
* **Protocol.** Client to server: `hello`, `input` (batched WASD + look with sequence numbers), `click`, `key`, `inv`, `say`,
  `term`, `examine`, `lobby`. Server to client: `welcome` (full world state), `snap` (10 Hz positions of mobs in range plus the
  acknowledged input sequence) and `ev` batches (doors, tiles, items, chat, sounds, private inventory and vitals, ...). Events
  carry a scope (everyone / one client / within earshot / ghosts only), so you never receive what you could not perceive.
* **Prediction.** Your own movement is predicted with the same `stepMovement` the server uses and reconciled against each
  snapshot, so it feels instant at any latency (`?lag=150` simulates 150 ms each way). Other mobs are interpolated 130 ms in the past.
* **Anti-cheat basics.** The server owns everything that matters: input time is budgeted (no speed-hacking), reach and line of
  sight are checked on every click, inventory moves are validated against SS13's storage rules, chat is routed server-side.
* **Late joiners** receive the welcome snapshot plus a log of hull changes and shuttle docking, so their world matches.

### Rebuilding the data

The shipped `assets/` and `data/` are generated. To rebuild you need a tgstation checkout at `_src/tg2020` (or point
`YAD_TREE` at one) and Python 3 with Pillow:

```sh
npm run build
```

### Tests

```sh
npm run test:sim      # 37 assertions on the headless simulation (inventory, combat, doors, breaches, chat, consoles, ghosts)
npm run test:soak     # a 12 minute simulated shift with a player attached
npm run serve &       # then:
npm run test:ui       # headless Chromium: HUD, targeting, inventory panel, consoles, chat, death (needs Playwright)
npm run test:net      # starts the server and drives 3 browsers: lobby, round start, chat/radio, prediction, late join, ghosts, reset
```

## Known gaps

* Windoors (the thin glass doors) are drawn but do not block movement.
* NPC crew keep their roundstart look when their clothes change.
* There is no antagonist game mode, chemistry, botany, cooking or construction. The goal is the feel of a round (a station full of
  people, a crisis, an evacuation), not a port of SS13's rules.
* Mouse look needs pointer lock, so it does not work on touch devices.

See [ATTRIBUTION.md](ATTRIBUTION.md) for where the art, sound and data come from and under which licenses.
