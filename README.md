# YAD3D: Yet Another Dead 3D

Space Station 13, in first person, in your browser. The map is the real BoxStation, the sprites and sounds are SS13's own,
the jobs, access, outfits and most of the text come from the SS13 source. The interface borrows from two places: from SS13
its slot icons, intents, health doll, damage overlays and speech floating over people's heads; from Marathon its steel
plates and green phosphor screens. There is no radar and almost nothing on screen while you play: you see your two hands
and what they hold, and you find out how hurt you are the way SS13 tells you, through the edges of your vision.
It plays like a round of SS13: lobby, job slots, a crew of other people, things going wrong.

* **Rounds.** Pick a job in the lobby, ready up, spawn on the station. Jobs have the real slot counts. Join late from
  Arrivals, or observe. Die and you become a ghost. A round ends with the evacuation shuttle (or when everyone is dead or gone)
  and a round-end report, then the server starts the next one.
* **Multiplayer.** An authoritative server (`server/index.js`) runs the simulation; browsers connect over WebSocket. Empty
  job slots are filled by NPC crew so the station is never empty. With nobody else around, the browser hosts a round itself
  using the *same* simulation and protocol.
* **SS13 inventory, by hand.** Two hands, real worn slots (uniform, suit, shoes, gloves, glasses, ears, mask, head, neck,
  belt, ID, back, both pockets, suit storage), nested containers with SS13's size classes, intents (help / disarm / grab /
  harm), throw mode, internals. Free the mouse and you can pick things up off the floor or a table and drag them between the
  world, your hands, your open bags and your body; drop them where you want them, or fling them across the room.
* **SS13 chat.** `T` to speak, `;` for the common radio, `:e` `:m` `:s` `:n` `:u` `:v` `:c` for department channels (needs a
  headset), `:h` for your own department, `Y` whisper, `M` emote, `O` OOC. Speech has a range and needs line of sight; what
  people say also floats over their heads for a few seconds. The dead talk to the dead.
* **Systems.** Atmospherics with real partial pressures and decompression, APC power with emergency cells and a blackout, fire
  alarms and firelocks, access-controlled airlocks (crowbars work on dead ones), meteors that blow holes in the hull, space carp,
  characters you design (body, skin, hair, facial hair, eyes, underwear; saved in your browser) that everyone sees, with the
  clothes they really wear, a hairdresser's mirror, and your own body when you look down,
  closets, lockers and crates that really open, close, lock (ID access, Alt+click), weld shut, hold what the DM says they
  hold, and shut people in (they break out in two minutes),
  handcuffs (three seconds to put on, a minute to break out of), grabs that tighten from passive to aggressive to a neck
  hold, dragging people, loose items and unbolted structures (lockers, tanks, office chairs) around behind you, going through
  people's clothes and pockets in a strip window, dragging them into lockers,
  smashed windows (they open up to whatever is behind them: only a window that touches space vents the room, and the grille
  stays standing), welding breaches shut, escape pods and the emergency shuttle, console programs (APC, air alarm, crew monitor, power monitor,
  comms, ...).

## Playing

```sh
npm install
npm start                      # http://localhost:8080 - multiplayer server (add --bots 20, --autostart 30, --port 9000, --debug)
```

Or, for a round hosted entirely in your own browser (no Node needed to play, just a static file server):

```sh
python3 tools/serve.py 8123    # then open http://localhost:8123
```

Pick a job, press **Ready** (a short countdown starts the round), or **Start now**. You arrive with the mouse free (hands
mode, below); press `Space` to capture it and look around. `?name=Alex` sets your name, `?bots=N` sets how many NPCs fill
the crew (single player), `?local` forces a local round even when served by the game server, `?auto&job=station_engineer`
skips the lobby.

### Debug menu

Start the server with `--debug` (`node server/index.js --debug`, or `npm start -- --debug`), or open a local round with `?debug`, and `F3`
opens the debug menu for everyone who is playing or observing. **Never run a public server with it**: anyone can spawn anything. Without the
flag the server ignores every debug message and the menu does not exist. Tabs:

* **Items**: search all 913 item definitions by name or path, click one, pick an amount and where it goes (your hand, in front of you, or the
  floor where you are looking), `Spawn` (or double-click). Stacks come as one stack of that many.
* **Creatures**: space carp, Ian, Runtime, Pun Pun, or an NPC crew member in any job; and a list of everyone on the station with Go, Bring, Heal,
  Kill, Revive and Delete (players cannot be deleted).
* **Me**: god mode, noclip, speed, heal, revive, a master ID, put on a job's outfit, and delete the thing under the crosshair (a loose item,
  an NPC, a locker or crate).
* **Go**: teleport to any room. Observers can use it too.
* **Station**: alert level, power (normal, battery, out), a meteor strike, carp, call or dock or send the shuttle, open or close every door,
  seal the hull and restore power, start or end the round, skip the clock ahead a minute.

Every operation answers with a `[Debug]` line in the chat.

### Two ways to use the mouse

* **Look.** The pointer is captured and there is a small dot in the middle of the screen (it turns amber when it is on
  something you can reach); the name of that thing is written under it. Left click is an SS13 click with your active hand
  on what the dot is on: pick it up, open it, use what you hold on it, hit it on harm intent (hold the button to keep
  swinging). Right click examines.
* **Hands.** `Space` frees the pointer, and the pointer becomes a pixel hand: pointing, open over something you could pick
  up, closed while you drag something, SS13's throw target in throw mode. A click does the same SS13 click on whatever is
  under the cursor; right click examines it. Clicking your inactive hand swaps to it; clicking your active hand uses what it
  holds, or opens it if it is a container. `Space` again goes back to look. Pressing `Esc` in look mode also lands you here.
  Opening a window (`I`, `Tab`, a bag, a console, the help) switches to hands by itself; closing the last one takes you
  back to look if that is where you were.

In hands mode, press on anything you can carry (lying on the floor or a table, in either hand, in an open bag, in a slot on
the equipment slots) and drag it:

| Drop it on | and |
| --- | --- |
| An empty hand or body-panel slot, a bag window, or a container (in a hand, a slot or a bag) | it moves there, if SS13's storage rules allow it |
| The floor or a table top within reach | it is put down there; a marker shows where it will land |
| A person, door, machine or hull breach (something you are holding) | it is used on them, as if you had clicked them with it |
| Your hands, with a *person* picked up from the world | their strip window opens (same as `Alt`+click on them) |
| An open locker, with a person picked up from the world | you stuff them in (four seconds; you stay next to them) |
| Somewhere it can't be put down, such as out of reach (something you are carrying) | it is thrown there |

### On screen

* **Your hands.** Two pixel-art hands at the bottom of the view, drawn by code (`paintHand` in `src/client/art.js`). The
  active one is raised. A held item is the real SS13 sprite at twice the hand's pixel size. An empty active hand shows your
  intent: open hand (help), push (disarm), claw (grab), fist (harm). Throw mode cocks the arm back. Sleeves take the
  colour of your uniform or suit, gloves colour the hand, and the hands darken in the dark. Each hand hangs on loose,
  under-damped springs for position, tilt and squash/stretch, and every gesture just kicks them: a click jabs, harm swings,
  a throw lunges, catching something squashes the hand, changing intent makes it shake, footsteps jiggle both, turning your
  head drags them behind the view. Something picked up off the floor flies from where it lay into the hand. It is dorky on
  purpose.
* **Bags.** An open container (click a worn or held one, or press `Z` with it in your hand) is a small window of SS13
  storage slots, stacked on the left of the screen. Containers that take a total weight rather than a number of items
  show how full they are. Drag a window by its strap to move it; the button on the strap closes it.
* **Inventory HUD** (`invhud.js`), laid out like SS13's. Bottom left, always on screen: the slots you reach for all the time (back, belt,
  ID and both pockets), each showing what is in it (or SS13's silhouette of what goes there). The blank button above them (or `I`) opens the
  rest of what you wear: head, ears, glasses, mask, neck, uniform, suit, gloves, shoes and suit storage. Click a slot to take what is in it or
  (with something in your hand) put it there, open a bag by clicking it, or drag things between slots, hands and bags. At the right edge are
  SS13's health doll with a one-line description of how you feel ("You have some bruising.") and the internals button (and the pull button
  while you drag something); at the bottom right, the four intents with throw, drop and resist above them. The mouse has to be free to use
  any of it (hands mode: `Space`).
* **PDA** (`Tab`). Only if you carry one (every job except Prisoner starts with one): station time, where you are, the
  pressure and oxygen of the air around you, and a map of the station that fills in as you see it. Ghosts see the whole map.
* **Your condition.** SS13's own full-screen overlays (red at the edges as you get hurt, darkness closing in as you run out
  of air, tunnel vision in critical condition), a red flash when you are hit, a pale blue edge in vacuum, a space helmet's visor
  (or a mask's frame while you breathe from a tank) round the view, and colour draining out of the world as your health
  drops.
* **Text.** The chat log in the top left, names under the cursor, a progress bar for timed actions, speech over people's
  heads (SS13 runechat), a line at the bottom when you are a ghost.
* **Consoles** are drawn as a steel bezel round a green screen, with numbered keys under the glass (`1` to `9` press them).

### Controls

The same list is in the game under `F1`.

| Key | |
| --- | --- |
| `W A S D`, `Shift`, mouse | Move, run, look around |
| `Space` | Hands: free the mouse to point, click and drag things. `Space` again to look around |
| Left click | Use what is in your active hand on whatever you point at; with an empty hand, pick it up or open it |
| Drag | (hands) Carry things between the floor, tables, your hands, your bags and your body. Drag far away to throw |
| Right click | Examine |
| `1 2 3 4` | Intent: help, disarm, grab, harm (watch your empty hand) |
| `X` | Swap hands |
| `E` | Wear or stow what you hold (empty hand: draw from your belt) |
| `Z` | Use the item in your hand (light, welder, tank, medkit, ...; opens a bag) |
| `Q` | Drop |
| `R` | Throw mode: your next click throws what you hold |
| `I` | Show or hide the equipment grid (the rest of what you wear), same as the blank button above your bag (observing: back to the lobby) |
| `Tab` | Your PDA: time, location, air, map |
| `V` | Internals (mask and air tank) |
| `F` | Flashlight |
| `B` | Stop what you are doing; resist: a grab (a passive one lets go at once), handcuffs (a minute standing still), a locker you are shut in (two minutes) |
| `P` | Let go of whoever or whatever you are dragging |
| `Alt`+click | Lock or unlock a closed locker you have the access for, without opening it. On a person: their strip window; click what they wear to take it off them (their items take SS13's delays, pockets four seconds and they are not told), click an empty slot to put what you hold on them |
| `Ctrl`+click | Drag it: SS13's pull. A person (a passive hold, never tighter), a loose item, or a structure that is not anchored in the DM (lockers, tanks, canisters, office chairs; not racks, vending machines or most chairs). It trails a little way behind you and slides along walls, lockers slow you down like a body does, `Ctrl`+click again or `P` lets go |
| `T` `Y` `M` `O` | Say (`;` common radio, `:h` department, `:e :m :s :n :u :v :c` other channels) / whisper / emote / OOC |
| `F1`, `F2`, `F3`, `F4` | This list, mute, debug menu (only with `--debug` or `?debug`), fullscreen (with the keyboard locked on Chromium, so `Ctrl`+`W`, `Ctrl`+`T` and `Ctrl`+`N` cannot close the page) |
| `Esc` | Close the top window (in look mode: free the mouse) |

While a round is on, every browser shortcut the page is allowed to swallow is swallowed (`Ctrl`+`S`, `D`, `P`, `R`, `F`, `U`, `Alt`+`Left`, `Ctrl`+wheel zoom and so on; developer tools and `Ctrl`+`Shift`+`R` still work, and so does editing text in the chat line). The browser reserves `Ctrl`+`W`, `Ctrl`+`T` and `Ctrl`+`N`, so leaving the page asks first (not in `?nolock` runs), and fullscreen (`F4`) locks the keyboard so they reach the game.

Also: the arrow keys turn and look up and down, `Enter` opens Say, `/` opens Say with `;` already typed. In the chat line,
`Tab` cycles Say / Whisper / Me / OOC and `Esc` cancels. While a console is open, `1` to `9` press its keys instead of
changing intent.

## How it is put together

```
assets/        generated: level.json (shared art and item tables, a grid for BoxStation and one for each shuttle, the map that docks them), terrain/sprite atlases, sounds,
               ui.png + ui.json (SS13 HUD icons), overlays/ (SS13 full-screen overlays); fonts/ (copied, see ATTRIBUTION.md)
data/          generated: jobs.json (jobs, slots, access, outfits), contents.json
tools/         Python data pipeline (DMI/DMM/DM readers), test harnesses, screenshot helper
src/shared/    rules both sides run: grids (a tile map, its props and doors, its pose in a map) & collision, movement, doors, atmos, power, items, chat rules,
               transform maths, the physics adapter (Rapier)
src/sim/       the authoritative game: Sim, rounds, jobs, inventory, actions, chat, AI, director, consoles, grid physics and shuttle flight
src/render/    Three.js terrain mesh, instanced sprites, lighting
src/client/    transports, replica of the world, view, prediction, and the interface (below)
server/        static files + WebSocket host
```

The interface, in `src/client/`: `game.js` (look and hands modes, picking what is under the crosshair or cursor, prediction,
the frame loop), `dnd.js` (clicks and drag and drop in hands mode), `hands.js`, `bags.js`, `invhud.js`, `pda.js`,
`effects.js` (screen overlays), `hud.js` (crosshair, hover name, progress bar, runechat, ghost line), `chatui.js`,
`terminalui.js`, `lobby.js`, `screens.js` (help, round report, disconnect) and `art.js` (SS13 icons from `assets/ui.png`,
the steel frame and the hand cursors, painted at 1x and scaled up with nearest neighbour). Text uses three pixel fonts:
Pixellari for the interface, Grand9K Pixel for speech and labels, VCR OSD Mono on the green screens.

* **One simulation, two transports.** `Sim` is plain logic with no DOM or Three.js. The server instantiates it in Node; the
  browser instantiates the very same class for a local round. A client only sees `send(msg)` / `poll()` (`src/client/net.js`).
* **Protocol.** Client to server: `hello`, `input` (batched WASD + look with sequence numbers), `click`, `key`, `inv`
  (inventory moves, including to and from a point on the floor, and throwing at a point), `say`, `term`, `examine`, `lobby`.
  Server to client: `welcome` (full world state), `snap` (10 Hz positions of mobs in range plus the acknowledged input
  sequence) and `ev` batches (doors, tiles, items, chat, speech over heads, sounds, private inventory and vitals, ...). Events
  carry a scope (everyone / one client / within earshot / ghosts only), so you never receive what you could not perceive.
* **Prediction.** Your own movement is predicted with the same `stepMovement` the server uses and reconciled against each
  snapshot, so it feels instant at any latency (`?lag=150` simulates 150 ms each way). Other mobs are interpolated 130 ms in the past.
* **Anti-cheat basics.** The server owns everything that matters: input time is budgeted (no speed-hacking), reach and line of
  sight are checked on every click and on every item put down on the floor, inventory moves are validated against SS13's
  storage rules, chat is routed server-side.
* **Late joiners** receive the welcome snapshot plus a log of hull changes and shuttle docking, so their world matches.

### Rebuilding the data

The shipped `assets/` and `data/` are generated. To rebuild you need a tgstation checkout at `_src/tg2020` (or point
`YAD_TREE` at one) and Python 3 with Pillow:

```sh
npm run build
```

This runs `tools/build_jobs.py`, `tools/build_level.py`, `tools/build_sounds.py` and `tools/build_ui.py`. The last one
writes `assets/ui.png`, `assets/ui.json` and `assets/overlays/` from the HUD icon files in the same tree. The fonts in
`assets/fonts/` are not generated: they were copied unchanged from `interface/fonts/` of a current tgstation checkout (the
2020 tree has no fonts directory).

### Tests

```sh
npm run test:sim      # 480 assertions on the headless simulation (spawn and outfit, inventory, combat, doors, breaches, closets, zero gravity, windows and grilles,
                      #   characters, handcuffs/grabs/stripping, structures and dragging, observers, the debug menu, zero gravity, windows and
                      #   grilles, door angles and wall mounts, chat, consoles,
                      #   drag and drop, death and ghosts)
npm run test:level    # level mesh geometry and the character art data (no browser)
npm run test:soak     # a 12 minute simulated shift with a player attached
npm run serve &       # then:
npm run test:ui       # ~190 assertions, about 4 minutes; headless Chromium, local round: look and hands modes, hands, drag and drop, the inventory HUD, bags,
                      #   throwing, PDA, consoles, chat and runechat, screen effects, death (needs Playwright)
npm run test:net      # starts the server and drives 3 browsers: lobby, round start, chat/radio, prediction, late join, ghosts, reset
```

## Known gaps

* Windoors (the thin glass doors) are drawn but do not block movement.
* There is no antagonist game mode, chemistry, botany, cooking or construction. The goal is the feel of a round (a station full of
  people, a crisis, an evacuation), not a port of SS13's rules.
* Look mode needs pointer lock and everything else needs a mouse and keyboard, so it does not work on touch devices.

See [ATTRIBUTION.md](ATTRIBUTION.md) for where the art, sound, fonts and data come from and under which licenses.
