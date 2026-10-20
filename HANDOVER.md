# Handover

Written for the next Claude instance picking this project up. Read this first, then `README.md` (what it is and how to
play it) and `ATTRIBUTION.md` (where the art, sound, data and fonts come from). Everything here was true when it was
written; check `git log` for anything newer.

## 1. Where things stand

**YAD3D** ("Yet Another Dead 3D") is a first-person, multiplayer Space Station 13 on the real BoxStation map, in the
browser. It works end to end. **Not everything is committed or pushed** (below).

* **Branch** `claude/yad3d-game` on `TehFlaminTaco/YAD3D`, open as **[PR #1](https://github.com/TehFlaminTaco/YAD3D/pull/1)**
  into `main` (which holds only an "Initial commit"). Pushing to the branch updates the PR. The user said not to worry about
  the repo's original Unlicense: the project is now **AGPL-3.0** (`LICENSE`), art and sound CC BY-SA 3.0.
* **Git state (2026-10-20):** committed and pushed; PR #1 has everything. `99cef4d` is one commit holding the work of two sessions that ran side by side (the debug menu 13, the inventory HUD 14,
  the observer and rune fixes, zero gravity 15, windows and grilles 17, door angles and wall mounts 18, the TG notes and `tools/tg*.py` 16): their edits share files (`sim.js`, `world.js`,
  `movement.js`, `hud.js`, `simtest2.mjs`) and could not be split. Check `git status -sb` for anything newer.
* **Tests (all pass now):** `node tools/simtest2.mjs` 484/484, `node tools/gridtest.mjs` 267/267 (grids, maps and docked shuttles, section 20), `node tools/decktest.mjs` 59/59 (stacked decks), `node tools/physicstest.mjs` 29/29, `node tools/leveltest.mjs` 18/18,
  `node tools/simtest.mjs 12 --player` clean (a 12-minute shift). `node tools/uitest.mjs`
  (191 assertions, about 4 min) and `node tools/nettest.mjs` (29) were last run before the window work, were **edited for the new HUD but never run** (they hard-code a Playwright path that
  only exists in the Linux container, see section 3), and could not be run in the Windows sessions since: re-run both before you say "all green". The multiplayer suite is the one most worth
  running (tile, `look`, `pm`, `imv`, `strip` and `grav` events and the debug flag are all new since it last ran).
* **Two ways to run it:** `npm start` (Node server with WebSocket multiplayer, `:8080`) or `python3 tools/serve.py 8123`
  (static files; the browser hosts a round itself with the *same* simulation code). The client probes `/server.json` to decide.

What was built, in the order the user asked for it:

1. A first-person 3D port of SS13 using the real BoxStation map, sprites, sounds, jobs, access and outfits.
2. SS13 inventory (two hands, real worn slots, nested containers, intents), and all player-facing text rewritten in plain
   SS13 voice (see "The user" below for why).
3. Real multiplayer affordances: authoritative server, lobby with real job slots, late join, ghosts, NPC fill, shuttle,
   round-end report, reset to a new round.
4. A UI redesign: SS13 + Marathon, "visceral", grab things from the world with the cursor and drag them around, bags,
   no radar, almost nothing non-diegetic, **dorky springy hands**.
5. Screens (lobby, consoles, help, report) restyled to match; the lobby was fixed for narrow/zoomed-in windows.
6. Windows that are glass blocks with grilles, smashed windows that only vent when they touch space, and real closets, lockers and crates (a port of `closets.dm`).
7. Characters composed at runtime (character screen, mirrors, your own body: section 10), then people interactions (handcuffs, grabs, strip window: 11).
8. A structure rework (four-sided pictures, free-standing hitboxes, dragging: 12), a **debug menu** behind `--debug` (13) and an **SS13-style inventory HUD** from the user's mock-up (14).
9. Zero gravity and space walking (15), windows and grilles with TG's rules (17), and a round of minor fixes to door angles and wall mounts (18).
10. Research: the TG source documented by Haiku drones into `docs/tg/` (16), with tools that keep them honest.

## 2. The user, and what they've reacted to

The user is casual and direct ("Get that shit goin'"). Their actual feedback so far, which should steer anything you add:

* **"The blurb text reads INCREDIBLY AI."** All copy must read like SS13: terse, lowercase-ish chat, real SS13 wording
  wherever the source has it (job greetings, "Meteor Alert", "Critical Power Failure", shuttle "Priority Announcement"
  texts, death emote). Avoid explanatory purple prose, "Something is already wrong", canned quips. When you write a new
  message, grep `_src/tg2020` for the real string first.
* **"A lot of items appear floating."** Fixed: SS13 sprites carry empty rows under them (top-down depth). Items/props/mobs
  are positioned with `oy: 0` so they stand on the floor or table. Don't reintroduce the bottom-margin offset.
* **"The UI still looks just bad … Radar is stupid … avoid unnecessary non-diegetic information."** The old HUD (bars,
  motion tracker, location/pressure/clock readouts, hotbar) is gone. Health is shown by SS13's own full-screen overlays and
  a body panel you open on purpose; time/air/location/map live on the PDA. Don't add persistent readouts without asking.
  **Superseded (section 14):** the user later sent a mock-up of an SS13-style HUD (key slots, doll, intents always on screen) and asked for it, so that
  HUD exists now; the rule still holds for anything beyond it.
* **"The hands should DEFINITELY have dorky springy animation."** They do (spring physics, squash/stretch). Keep it dorky.
* **"It says to pick an occupation, but I can't see how?"** Cause found and fixed (section 5), and the user has
  since confirmed the fix. If it ever comes back, ask for window size and browser zoom, then reproduce at exactly that size.
* They asked for SS13 assets to be used freely, and for **BoxStation, not Meta**.
* The lobby fix, pointer lock and sound were all checked in a real browser and are **confirmed good**. Touch support is
  explicitly a non-consideration.
* **Recent direction (2026-10-20):** structures should use the four directional sprites wherever the DMI has them (chairs, consoles); dragging is Ctrl+click as in SS13, it
  must feel free (not tile by tile), you must be able to walk through what you drag and be ejected from it when you let go, and closed lockers need a smaller hitbox;
  Ctrl chords that browsers use (Ctrl+S, Ctrl+W) must be consumed while you play; observers must be able to move; the HUD should look like their mock-up (key slots bottom left, the
  rest of the equipment behind the blank button, doll and intents at the right); chat runes must sit above the speaker; firelocks, airlocks "in 3s" and wall mounts were at bad angles
  and z-fighting. They answer fast and mid-task, so expect messages to arrive while you work.
* **Windows.** "Straight windows … appear as just thin lines between walls", and "many otherwise solid windows show space
  underneath, when they should show the correct tile (and grille?)". Fixed in `src/render/level.js` (section 5), grilles included; the TG
  rules for taking windows and grilles apart are section 17.

## 3. Getting set up

```sh
git clone https://github.com/TehFlaminTaco/YAD3D && cd YAD3D && git checkout claude/yad3d-game
npm install                        # three (vendored copy is what the page loads), ws
node tools/simtest2.mjs            # sanity: 480 passed
python3 tools/serve.py 8123 &      # static server; needed by uitest.mjs and shot.mjs
npm start                          # or the multiplayer server on :8080
```

Environment-specific things that will bite you:

* **Playwright is imported from `/opt/node-tools/node_modules/playwright/index.mjs`** (hard-coded in `tools/*.mjs`).
  Chromium needs `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist --enable-webgl`
  (already in the scripts). If you are in a different container, fix that import path first.
* **The static server on :8123 dies whenever the worker restarts.** Restart it before running `uitest`/`shot`.
* **`_src/` (SS13 source trees) is git-ignored and absent from a fresh clone.** It is only needed to *rebuild* assets
  (`npm run build`): `_src/tg2020` is a git worktree of tgstation at `2d6c10c1` (2020-07-06), `_src/tgstation` a newer
  clone used only for the fonts. The generated `assets/` and `data/` are committed, so you don't need them to run or test.
  On the Windows machine `_src/tg2020` is a plain extract made with
  `git -C ../tgstation archive 2d6c10c1 _maps code icons | tar -x -C _src/tg2020` (80 MB, enough for `build_level.py`; the
  user's own tgstation clone is at `C:\Users\Willi\Documents\GitHub\tgstation` and has that commit). `build_level.py` now
  rebuilds **byte-identically** run to run (it used `hash(job)` for NPC sprite variants, which changes every run, and
  needed a Pillow without `get_flattened_data`); the committed `sprites.png` therefore changed once when this was fixed.
  `YAD_TREE` overrides the tree the Python tools read. **Don't `cd` into `_src/tg2020`**: it is a worktree and the harness
  then reports your working directory as changed.
* Use the **scratchpad directory** from the system prompt for screenshots/scratch scripts, not `/tmp`.

## 4. Architecture in one page

Full description is in `README.md` ("How it is put together"). What you need to hold in your head:

* **One simulation, two transports.** `src/sim/*` (`Sim`) is plain logic, no DOM/Three. `server/index.js` runs it in Node
  at 20 Hz; the browser runs the same class for a local round (`LocalConnection` in `src/client/net.js`, with an optional
  artificial `lag`). The client only sees `send(msg)` / `poll()`. `src/shared/*` is code **both sides run** (world and
  collision, `stepMovement`, doors, atmos, power, item rules, chat rules, `buildPropData`).
* **Determinism contract:** `buildPropData` (shared) derives doors, firelocks, props, lights, tables, panes from a grid's blueprint
  in a fixed order, so index `i` means the same door/prop of **that grid** on server and client. Click targets use those indexes
  with the grid they are on (`{k:'door', g, idx}`, `{k:'prop', g, idx}`; a target with no `g` means the grid you stand on). Never reorder those lists. **The world is a set of grids in maps (section 20):** everything standing on a grid has `.grid` and coordinates in that grid's own frame.
* **Protocol** (client→server): `hello, input, click, key, inv, say, term, examine, lobby, ghost, mirror, strip, stuff` (+ `ping`; `dbg` is ignored unless the sim was started with
  `debug`). (server→client): `welcome` (`map`, `grids: [one entry per grid: g, bp, kind, tf, power, doors, tiles, panes, closets, moved, gravity, built, evac]`, floor `items`, `jobs`, `debug`), `snap` (10 Hz mob rows
  `[id, g, x, z, yaw, flags, speed]`, `ack`, `you` with its grid `g`, `env`; the positions are in the frame of grid `g`) and `ev` batches (**events about a grid carry its id as `g`**, and are only sent to players in its map; the closet event's
  "gone" flag is `gn`; **`grid+` (a whole grid state, as in the welcome) and `grid-` add and remove a grid**; an `input` and a `click` say which grid's frame their facing is in: `g` / `yg`): (`door, fdoor, tile, cl, pane,
  item+, item-, imv, pm, toss, mob+, mob-, look, mirror, strip, self, msg, bubble, snd, beam, power, area, flicker, prog, term, round, alert, report, ghost, evac, grav, shake, hurt, dbg`).
  Events have scopes (all / one client / near a point / ghosts). **A `snap` is sent before the same step's `ev` batch**, so the client must tolerate a snapshot that mentions a mob it hasn't
  heard of yet, and `self` being null for a tick after spawning.
* **Closets, lockers and crates** are `kind: 'closet'` records in `props.interact`/`props.closets` (built by `buildPropData`
  from `k:'closet'` props). Server logic is `src/sim/closets.js` (a port of SS13's `closets.dm`), shared state helpers are
  `src/shared/closets.js`: one number `cs` (open 1, welded 2, locked 4, broken 8), `setClosetState` also flips the tile's
  `solid` (open closets don't block; open *crates* do). The server sends `{e:'cl', i, cs, g}`; the welcome lists closets that
  differ from the map (`closets: [[idx, cs, gone]]`). Sprites are five frames per closet (closed, closed+locked, welded,
  welded+locked, open) from `tools/closets.py`, swapped by `WorldView.setClosetView`. Contents come from the DM
  `PopulateContents()` (`data/closets.json`, rows `[item, count, chance %, stack amount]` or `{pick: [[weight, rows]]}`);
  closing takes in what lies on the tile (30 items, 3 people), opening puts it back on the floor. People inside have
  `mob.inside`, are hidden from others' snapshots, can't act, and the client shows a dark vent-slit overlay
  (`ScreenFX`, `self.inside`). Locked or welded: B (resist) starts a 120 s breakout. `Alt+click` (look mode and hands mode)
  sends `alt:1`; on a closed secure locker it toggles the lock. Deliberate divergence from SS13: clicking a closed closet
  with a non-tool item in hand opens it (SS13 wants an empty hand).
* **Items** live in exactly one place (`item.loc`: floor | hand | slot | box | closet). Everything that moves an item goes through
  `src/sim/inventory.js` (`detach`/`attach`/`place`). Client mirrors only see serialized items
  (`{id,n,s,w,st,tg,amt,lit,c,cap}`; `tg` = space-separated type tags like `pda bag helmet`; `cap` = `{n}` slot count or
  `{w,used}` weight).
* **Prediction:** the client runs the same `stepMovement`, replays unacked inputs on each snapshot, and smooths the
  correction (`game.corr`). With a simulated 300 ms RTT the correction stayed under 1 mm.
* **Coordinates:** 1 tile = 2 m (`TILE`), **a grid's own frame** x = col*2, z = row*2, north = -z, yaw 0 faces north (forward = (-sin, -cos)). BYOND direction bitflags N=1 S=2 E=4 W=8. Eye height 1.45 m.
  Where a grid is in its map is `grid.tf` (`{p: [x, y, z], q: [x, y, z, w]}`, `src/shared/math3.js`); only `Sim.worldPos/dist` and `Grid.worldPoint/localPoint` use it. The station sits at the origin, so its frame is the map's.
  BYOND direction bitflags N=1 S=2 E=4 W=8. Eye height 1.45 m.
* **Rendering:** custom shaders; terrain from a texture array; three instanced `SpriteBatch`es (`stat` 20000, `dyn` 3000,
  `itemB` 6000; **`SpriteBatch.add` throws when full**, freed slots are recycled via free-lists); per-vertex baked light from
  a flood-fill `LightField`; low-res (≤540 px tall) pixelated canvas under a DOM UI.
* **Data pipeline** (Python, `tools/`): reads DMI/DMM/DM source from the tgstation tree → `assets/level.json`, atlases,
  sounds, `data/jobs.json`, `assets/ui.png|json`, `assets/overlays/`. `goon/` icon dirs are deliberately excluded
  (non-commercial licence), as are CC-BY/BBC sounds (see `ATTRIBUTION.md`).

## 5. The interface (the part most likely to change next)

All in `src/client/`; CSS in `css/style.css` (in-game) and `css/screens.css` (lobby/consoles/help/report).

* **Two mouse modes** (`game.mode`): `look` (pointer locked, crosshair, LMB = SS13 click on what you aim at) and `hands`
  (pointer free and is a pixel-hand cursor; click/drag things). `Space` toggles. Opening any window (`I`, `Tab`, a bag, a
  console, help, report) calls `game.enterHands(true)`; the last one closing calls `panelsChanged()` which returns to look
  if the panel is what freed the mouse (`autoHands`). Pointer-lock loss (Esc) lands in hands. `?nolock` fakes the lock for
  headless tests (`Input.force()`), which also **disables mouse-look**.
* **Picking:** `game.rayAt(x,y)` / `lookRay()` → `findTarget(o, dir)` (items, doors, firelocks, props, mobs, breaches, scored
  by distance from the ray; mirrors what the server will accept) and `floorPoint(o, dir)` (table top or floor, within
  `DROP_REACH`, not inside solid).
* **Drag and drop:** `dnd.js`. A press on something carriable becomes a drag after 6 px. Sources: floor items (world),
  hands (`[data-hand]`), bag cells (`#bags .cell`), inventory HUD slots (`#slots .slot`). Drops resolve (in order): container
  → hand → slot → bag window → the world (use on a person/door/machine if held in a hand; put down at `floorPoint`; else
  throw at the aim point). While dragging, `view.setDropMarker` shows a green (set down) or red (throw) ring.
  Server ops: `inv` `move` (to hand/slot/box/floor-with-x,z; from floor too) and `inv` `throw {at:[x,y,z]}`.
* **Hands:** `hands.js` + `art.js:paintHand`. Art is painted procedurally to a 64×72 canvas and scaled by CSS var `--h`;
  held items are the real sprite at 2×. Each hand has five springs (x, y, rot, sx, sy) integrated in **fixed 1/120 s
  substeps** (frame-rate independent); gestures are `hands.bump(i, kind)` kicks (`use, swing, throw, catch, drop, wiggle,
  swap, step`). Tune feel in `bump()` and the stiffness/damping in `update()`.
* **Other pieces:** `bags.js` (container windows), `invhud.js` (key slots, the equipment grid behind `I`, health doll, intents; section 14),
  `pda.js` (`Tab`: needs an item tagged `pda`; ghosts see the whole map), `effects.js` (SS13 full-screen overlays from
  `assets/overlays/`, helmet visor, vacuum tint, desaturation), `hud.js` (crosshair, hover name, progress, runechat,
  ghost bar, toast), `chatui.js`, `terminalui.js`, `lobby.js`, `screens.js`.
* **Visual language:** Marathon = riveted steel plates (a 9-slice generated in `art.js`, used via `border-image: var(--frame)`)
  and green CRT glass (`.crt`); SS13 = its slot icons / intent buttons / health doll (`assets/ui.png`), runechat. Fonts:
  Pixellari (interface), Grand9K Pixel (runechat/labels), VCR OSD Mono (CRT screens). CSS variables `--s` (UI pixel scale),
  `--p` (slot scale), `--h` (hand scale), `--cell` are set from JS in `Game.resize()`.
* **Windows (`src/render/level.js`, `wallBlock`):** a fulltile window is a *glass block*: the tile's real floor (and
  ceiling) is drawn under it, and every non-wall side, space included, gets a glass face at the tile edge, so it is as
  thick as the walls beside it. It used to be a single zero-thickness pane in the tile's centre with no floor at all
  (space showed through). `tools/leveltest.mjs` guards this. Directional (non-fulltile) panes are separate and unchanged.
  **The grille** is a property of the window's wall variant (`gr` = a see-through terrain cell, made in `build_level.py` from the
  real `grille` sprite with its dark field cut out; `window_of` decides who has one). `LevelMesh.grillePanels` stands a
  panel just inside every side the glass faces (`GRILLE_INSET`), so it renders the way the window does, one layer under it,
  and it is still drawn once the tile is smashed. Every BoxStation window comes from a window spawner, which always
  spawns a grille. The 457 *stand-alone* grilles in the map (on lattice outside, etc.) are still skipped.
* **Smashed windows** (`World.setBreach`, `Sim.breachTile`): the tile becomes `KIND.FLOOR` (its own floor, glass gone, grille
  left), `solid` (the grille still blocks walking), not `airBlock`. It used to become a vacuum tile whatever was behind it, so
  shooting an *interior* window vented both rooms. Now `World.ventsToSpace(i)` (touches space or lattice) decides what is
  a hull breach: alarms, carp, the engineering radio call-out, the round report, the PDA colour (red vs amber) and the
  screen shake/flicker all use it (`World.ventTiles()`). The hover name used to be "hull breach" or "broken window": that
  was an invented object, and it is gone (section 17: it is the grille, or "floor"). `world.breached` is "every window whose glass is gone"; the tile event carries
  `brk` so clients keep the same set. Atmos rebuilds its topology (`Atmos.tileChanged`); a cell beside a venting broken window
  counts as a sink, which keeps decompression about as hard as when the hole was a space tile. Welding a metal plate over it
  still turns it into a wall (not TG: see section 17).
* **Lobby narrow-window fix:** below 960 px page width the lobby used to squeeze the job board to nothing (94 px wide at
  720 px, 14 px at 640 px) because a strip was reserved for chat. `css/screens.css` now has a `@media (max-width: 960px)`
  block: full-width board, Ready/Start/Observe in a row above it, crew list hidden, chat reduced to one bar.

## 6. Testing and debugging

| What | Command | Notes |
| --- | --- | --- |
| Sim logic (no browser) | `node tools/simtest2.mjs` | 480 assertions, seconds. Add a `section()` for any new server rule. Sections: spawn, inventory, combat, doors, breaches, closets, characters, people, structures, observers, debug menu, door angles and wall mounts, zero gravity, windows and grilles, chat, consoles, drag and drop, death. |
| Long soak | `node tools/simtest.mjs 12 --player` | a 12-minute simulated shift, ~4 s |
| Browser UI (local round) | `node tools/uitest.mjs` | needs :8123 static server; ~4 min; `BASE=`, `SHOTS=` env; drives the real mouse/keyboard |
| Closets, people (in simtest2) | `node tools/simtest2.mjs` | the `closets` section: DM contents, locks, welding, breakout, personal lockers; the `people` section: handcuffs, strip window, pockets, grabs, examine, stuffing |
| Grids and maps | `node tools/gridtest.mjs` | 135 assertions: a second grid and a second map in one real `Sim` and the client `Replica`; the real level's docked shuttles (walking on and off every one of them, air at the seams, the emergency shuttle arriving and leaving); and a scan that fails if any file under `src/` uses the station shortcuts (section 20). `tools/gridkit.mjs` builds test grids from ASCII |
| Stacked decks | `node tools/decktest.mjs` | 59 assertions: a two-deck grid (a stair up, a hole in the upper floor) in a real `Sim`: the arrays, walking up the stair, falling (damage, stun, the stair that takes the fall), what is seen and reached across a floor, air through the hole, pathfinding, the client replica and the slope of a stair, light per deck, the physics shape and the debug menu's deck grid (section 20, stage 5b) |
| Physics adapter | `node tools/physicstest.mjs` | 29 assertions: the transform maths and Rapier (compound bodies, locks, collisions, kinematic bodies, thrust); also loads in the browser |
| Level mesh geometry | `node tools/leveltest.mjs` | no browser or WebGL; 18 assertions: glass, floor, grille, smashed windows, the character art data |
| Multiplayer | `node tools/nettest.mjs` | spawns `server/index.js` on :8191 with `--debug`, three browsers |
| TG notes | `python tools/tgwhere.py`, `tgcheck.py`, `tgmerge.py`, `tgplan.py` | find a DM type's definition, check a drone's note, merge its parts, list what is undocumented (section 16, `docs/tg/_STATUS.md`) |
| Screenshots | `node tools/shot.mjs "<query>" <prefix> --w 1280 --h 720 --steps '[…]'` | per step runs: `eval`, then `key`/`down`/`up`/`click`, then `wait`, then `snap` |

* **Page query params:** `nolock`, `norender` (skip WebGL draw: use it with several pages), `auto` (+`&job=<id>`) skips the
  lobby, `bots=N`, `autostart=SECONDS`, `lag=MS`, `local` (force an in-page round even when a server answers), `fullbright`,
  `name=`, `god`, `debug` (the debug menu, F3; section 13). `window.yad` is the `Game`; in local mode `yad.conn.sim` is the live `Sim` (teleport mobs, spawn items,
  hurt the player, call `yad.conn.sim.director.finish('shuttle')`, open consoles via `sim.terminals.open(...)`).
* **Server flags:** `--port --bots --autostart --name --endDelay --max --debug`. `--debug` turns on the debug menu and every `{t:'dbg'}` operation
  (section 13; `tools/nettest.mjs` uses `tp`, `kill`, `finish`, `tile`, `noop`): **never use on a public server**.
* **Frames are slow under swiftshader and the in-page sim only advances with frames** (`dt` is capped at 0.05 s, so game
  time runs slow). Never use fixed sleeps for state: poll with `page.waitForFunction`. Several rendering pages at once starve
  each other and make movement tests flaky; use `norender`.
* A recurring test-writing trap: the click/aim helpers need `yad.pred` to **catch up after a server-side teleport** before
  you compute a yaw from it, otherwise you aim from the old position.
* Bugs the tests have already caught (so you know where it's fragile): the `examineProp` method that didn't exist; overlay
  images loading from the wrong path (only the broken-image icon showed); throw targets with NaN making the thrower's aim
  NaN; hand index 5 creating a phantom third hand.

## 7. Git, PR and harness quirks

* Work on `claude/yad3d-game`; the PR updates when you push. Commit trailers are given by the session's system reminders
  (they name the model and the session URL), so follow whatever the current reminder says rather than copying old commits.
* A **stop hook** insists the tree is clean and pushed. The clone only fetched `main`, so git didn't know the remote branch:
  fixed with `git config --add remote.origin.fetch '+refs/heads/claude/yad3d-game:refs/remotes/origin/claude/yad3d-game'`
  (per-clone config, not in the repo). If the hook says "N unpushed commits and no remote branch", run `git ls-remote origin
  <branch>` first: it was a false alarm.
* The repo was renamed; pushes print a "repository moved" notice. Harmless.
* **Parallel sessions.** Two Claude sessions have edited this tree at the same time (one on the debug menu and HUD, one on gravity, windows and the TG notes). `git status` can show changes you did not
  make, and a file can change under you between a read and an edit; re-read before you edit a shared file and never revert what you did not write.
* **Git Bash rewrites `/obj/...` arguments** into `C:/Program Files/Git/obj/...`. `tools/tgwhere.py` undoes that; do the same in any new tool that takes a DM path.
* **The browser pane lags a frame behind your last action** (a screenshot right after a state change can show the old frame; take a second one) and its timers stall when the pane is hidden. Prefer
  `javascript_exec` on `yad` for state and screenshots for looks. Reload the page after editing CSS or client JS.
* A safety check blocks `rm`/`rmdir` of workspace directories, and **`pkill -f` with a pattern that appears in your own command
  line kills your own shell.** Avoid both.
* The **Workflow** (multi-agent) tool is for when the user opts in ("ultracode"/"use a workflow"). Subagents burn usage fast;
  a workflow was cut off by a usage limit once (its restyle and docs agents finished, its test and review agents didn't, and
  the rest was redone by hand).

## 8. Open items, roughly in priority order

1. **Commit and push** (section 1), then **re-run `uitest` and `nettest`** on a machine with Playwright and look at two-player sessions: windows, closets, people, dragging, observers and the debug menu were only checked
   by `simtest2`, `leveltest`, the soak and the in-app browser (single player, local round, plus one websocket smoke test of `--debug`).
2. *(Done: lobby fix, pointer lock and sound were checked in a real browser by the user; grille under windows; closets; characters; people; structures and dragging; debug menu; HUD; observer movement; zero gravity; TG windows; door and mount angles.)*
3. **The review of the UI was only half done.** The drag-and-drop *server* code got a manual review (2 bugs fixed). Not yet reviewed: (a) the mode/state machine in `game.js` (`applyMode/enterHands/enterLook/panelsChanged/closeTop/setPhase`)
   for ways to get stuck with a free or captured mouse, keys firing while typing in the lobby name field or chat, ghost/lobby transitions leaving panels up; (b) `hands.js`/`effects.js`/`art.js`/`hud.js` robustness and per-frame cost (`rayAt` and
   `lookRay` allocate vectors every frame; runechat does an LOS test per speaking mob per frame; the visor canvas is redrawn on resize). The earlier plan was three independent reviewers plus a skeptic pass per finding.
4. **Known gaps** (also in the README): windoors are drawn but don't block movement; no buckling to chairs or beds, no body bags; NPCs still walk on the floor when gravity is off (section 15); no antagonists, chemistry, botany or cooking;
   look mode doesn't work on touch devices (a non-consideration, the user said).
5. **Small things noticed:** a throw within the 0.5 s cooldown silently does nothing after the drag ghost vanishes (no feedback); `tools/preview_ui.html` is a leftover dev page; the lobby's "pick one, then Ready" hint disappears during a running round by design;
   73 wall mounts have no offset or direction in the map and are placed by guess (13 at corners) and 35 (cameras, direction signs on pillars) have no wall on their side (section 18); the game's own `suit/space/emergency`,
   `helmet/space/emergency` and `storage/photo_album/prison` item paths do not exist in TG 2020 (closets in `src/sim/actions.js` hand out the first two; `docs/tg/_STATUS.md`); the debug menu's World tab has no text input for station announcements.
6. **Roadmap the user agreed (2026-10-19), in this order.** (1) Foundations + closets/lockers/crates: **done**, except body bags. Still to build: a generic tool dispatch (`startTimed` takes `{start, stop}` messages and `welderReady` mirrors SS13's tool
   check), stacks (merge, split, craft menu), mutable tiles/structures beyond closets and windows. (2) Dynamic character sprites, setup screen, mirrors, your own body: **done** (section 10). (3) People interactions: **done** (section 11);
   buckling and body bags were left out. *(Structure rework, debug menu, HUD, gravity: done, sections 12 to 15.)* (4) **Item interactions: not started; the user put it on hold on 2026-10-20.** Welder, extinguisher, lights, medical (bruise pack heals 40,
   4 s on yourself / 2 s on someone), food and hunger, vending machines (79 on the map). (5) **Construction**: windows and grilles are done the TG way (section 17); girders/walls (2 metal, 4 s), floor tiles, tables, airlock assemblies, the stack craft menu are not.
   The research for steps 4 and 5 is in `docs/tg/` (section 16): every item the game has is documented and **73 machines and structures are still to do** (`docs/tg/_STATUS.md` has the six shard lists and the budget: do not launch more than three
   machinery drones per 5-hour usage window).
7. **Ideas the user hasn't asked for** (do not start these unprompted): typed station announcements from the comms console (it currently has no text input, so the canned announcement button was removed), more consoles, headset/radio sounds.

## 9. Map of the code

```
index.html                    page shell: boot overlay, canvas#view, two stylesheets, src/client/main.js
server/index.js               static files (allow-listed dirs) + /server.json + WebSocket host + round reset; --debug flag
src/shared/                   config.js (constants, slot list), world.js (one grid's tiles, collision, free-standing boxes), grid.js + gamemap.js (a grid: tiles, props, doors, pose; a map: a space of grids and how they lie against each other), frames.js (handing a body from one grid to the next),
                              math3.js (vectors, quaternions, transforms), physics.js (Rapier adapter), movement.js (stepMovement, gravity and drift),
                              door.js, atmos.js, power.js, body.js, items.js (behaviour table, storage rules), chat.js, jobs.js, looks.js (characters),
                              closets.js, windows.js (window state), propdata.js (props, door angles, mounts, moveProp), nav.js, leveldata.js, util.js
src/sim/                      sim.js (maps, grids, loop, clients, snapshots, handle()), gridsim.js (a grid plus its air, power, nav, firelocks), actions.js (clicks, combat, drag/throw, examine), inventory.js, round.js, director.js
                              (meteors, power failure, carp, shuttle), terminals.js, chatsys.js, ai.js, firedoors.js, mob.js, jobs.js, closets.js, people.js
                              (handcuffs, grabs, dragging, strip window), windows.js (taking windows and grilles apart), debug.js (the debug menu's operations)
src/render/                   level.js (terrain meshes), sprites.js (instanced batches), materials.js (shaders), lighting.js
src/client/                   main.js, game.js, net.js, state.js (Replica, GridReplica), view.js (WorldView), gridview.js (GridView, one grid's picture), input.js, audio.js, assets.js, charart.js, bodyview.js, and the
                              interface files: hands, bags, invhud (HUD), strip, debugmenu, charedit, pda, effects, hud (runes), chatui, terminalui, lobby, screens
css/                          style.css (in-game), screens.css (lobby, consoles, help, report)
tools/                        build_*.py (data pipeline), serve.py, shot.mjs, simtest*.mjs, leveltest.mjs, uitest.mjs, nettest.mjs, tgwhere/tgcheck/tgmerge/tgplan.py
assets/ data/ vendor/         generated art/sound/level data (committed), jobs data, vendored three.js r170 and Rapier 0.21 (`rapier3d-compat.mjs`, wasm inlined)
docs/tg/                      the TG research notes and how they were made (_BRIEF*.md, _STATUS.md, gap-*.md and the topic files)
```

## 10. Characters: runtime-composed people, the character screen, mirrors, your own body (roadmap step 2, done)
People are no longer baked sprites. `tools/build_chars.py` (run by `build_level.py`) writes `assets/chars.png|json`: layered body
parts, eyes, hair, facial hair, underwear, undershirts, socks and the worn sprites of every item the game knows (434), with SS13's own
`flags_inv` hide bits. `src/shared/looks.js` holds the look rules (`look` = what you design, `ap` = look + what you wear + hide flags);
the server sends each human `ap` in `mob+` and a `look` event when it changes (`recalc` marks it dirty); `src/client/charart.js`
composes it in SS13's layer order into a strip under the sprite atlas (`DynAtlas`, ~800 people, shared by identical looks and
reference counted), so the normal sprite batches draw them. Dead people are the sprite turned on its side.

* **Character screen** (`charedit.js`, Character button in the lobby): live turning preview wearing the selected job's clothes,
  body, skin, hair, facial hair, eyes, underwear dials, Randomise. Saved in `localStorage` (`yad3d.look`), sent as `hello.look`;
  the server sanitises it (`Looks.sanitize`: unknown names fall back, colours are normalised).
* **Mirrors** (10 on the map): clicking one sends `{e:'mirror'}`; the same screen opens with only hair and facial hair, and
  `{t:'mirror', look}` is applied only if you stand within 3.4 m of a mirror and only hair fields change (`Actions.mirror`). A
  mirror also shows your reflection (`WorldView.updateMirrors`, a small shader on a quad over the glass): the image is you as
  you would be standing as far behind the glass as you stand in front, drawn with the sprite direction that image would get (it turns as
  you turn; front/back views are flipped left-right), projected from your eye onto the glass (that sets its size and how far it slides
  along the wall as you move), and cut to the glass's oval. Only you appear in it, only when you are in front of it, within 5.5 m.
* **Your own body** (`bodyview.js`): when you look down, a plane in the 3D world stands at your feet (0.28 m ahead, leaning back
  toward you about 17 degrees, cropped to shoes-to-chest) wearing your front sprite; it turns with you and sways when you walk. The
  user did not like a flat screen overlay and found a 36 degree lean too much. Your hands take your skin tone.
* NPCs get random looks (`Looks.random`). Map items now all have definitions (913), so clothing found on the map can be worn.
* Not done: held items are not drawn on people, no species (human only), no job-specific uniform variants (skirts), no persistent
  server-side characters, no third-person toggle (the user does not want one).

## 11. People: handcuffs, grabs, the strip window (roadmap step 3, done)
All of it is `src/sim/people.js` (class `People`, `sim.people`), with `src/client/strip.js` for the window. Numbers come from the DM source
(check the DM, not drone reports, before adding more: see the memory note).

* **Handcuffs** (`restraints/handcuffs`, `def.cuff` = seconds to break out): click a person with them in your hand (any intent) to start a
  3 s timed action; they are told ("X is trying to put handcuffs on you!"). A cuffed mob drops what it holds, can't use its hands (clicks,
  inventory moves, keys are refused with SS13's "You're handcuffed and can't act" line) and shows the cuffs on its sprite (`ap.o.cuffs`,
  painted last in `charart.js`). `B` starts a resist (60 s for plain cuffs, 30 for cable restraints, 45 for zipties; `keep:true` so it only fails if you move).
  Someone else frees them through the strip window ("Handcuffed" row; takes the item's strip delay).
* **Grabs**: a grab-intent click is passive (the target trails you, `DRAG`=1.5 m, let go past 3.4 m); the next click is aggressive at
  once (they drop what they hold); the third is a 3 s neck grab that puts them down (`downed`). Resisting: passive breaks at once,
  an aggressive hold breaks 60% of tries, a neck hold 30% (`60 / grab state`, one try per 2 s; `resistGrab`). `P` releases. Moves of the holder are not slowed (SS13 does slow); no strangling/killing grab.
* **Strip window**: Alt+click a person (`clickMob(alt)`; the client puts ctrl/alt into the click code as +20/+10) or drag them onto your
  hands (`dnd.js` `startMob`/`dropMob`). The server sends `{e:'strip', id, name, hands, slots, pockets, cuffs}` after every change and
  `{close:1}` when they move away. Ops (`{t:'strip', op}`): `take` (delay = the item's `sd`, e.g. jackboots), `put` (2 s, `ed`), `pocket`
  (4 s, silent, only says "Full"/"Empty"); slots covered by another item's hide flags show as "Obscured" and refuse. Stripping is
  announced to the victim ("X tries to remove your Y!") except pockets.
* **Lying people** draw a separate `lie` cell (the sprite turned on its side, untinted) and the dead a grey `dead` one (`PER_GROUP = 6`
  in `charart.js`); `view.js` picks by `m.lying`/`m.dead`. Snapshot flag 16 means stunned *or* downed.
* **Closets**: drag a pulled/any person onto an open closet, or click it empty-handed while pulling someone, to stuff them in (4 s, then it
  closes; `Closets.stuff`).
* **Examine** on a human now prints SS13's list ("This is X!", "X is wearing ...", "X is handcuffed!") one line per message.
* **Hover picking**: doors get a 2x worse score in `Game.findTarget` so a person standing in front of one is the target (they were not).
* **Left out on purpose**: buckling to chairs and beds, body bags, strangling, legcuffs, pulled-body slowdown, resisting out of a pull by
  moving. The `people` section of `tools/simtest2.mjs` is the spec.

## 12. Structures: four sides, hitboxes, dragging (structure rework, done)
* **Four-sided pictures.** The build (`tools/build_level.py`, "standing structures" block) gives every structure whose DMI has more than one
  direction a `fr: [S, N, E, W]` list of sprite ids (`dir_set` canonicalises directions so identical pictures are stored once; 455 props +
  62 on the shuttle: chairs, consoles, toilets, morgue trays, engines). `propdata.js` puts `views` + `face` on the static, `WorldView.updateFacing`
  picks the picture each frame with `viewIndex` (the same rule mobs use: the way it faces against where the camera is), and these are
  billboards now, not planes at a fixed yaw. Wall mounts and windoors stay planes on purpose.
* **Anchored** comes from the DM (`anchored` resolved over the class chain plus the map's own override) as `anc`; `ds` is `drag_slowdown`
  (lockers 1.5, crates 0). Machinery is bolted by default, structures are not: chairs, racks, vending machines, brig lockers are anchored;
  lockers, crates, canisters, tanks, space heaters, scrubbers, office chairs, roller beds, IV drips are loose.
* **Free-standing boxes, not tiles.** Anything loose and dense (closets and crates always, plus every unanchored dense prop: canisters, tanks,
  heaters, scrubbers) is a box with its own `x, z, half` (`blockHalf` from the sprite's visible width: a locker 0.55 m, a tank 0.95) kept in
  `World.boxes` (tile -> boxes touching it), `bcount` (fast skip in `World.collides`, which takes an optional `ignore` box) and `dyn` (boxes
  whose middle is in the tile: `Nav.passable` and the AI go round those tiles). `boxAdd/boxSet/boxMove/boxDrop`; `setClosetState` toggles
  `dense` when a closet opens or closes. Bolted-down dense props (racks, vending machines, bolted machines) still just set `solid` on their tile.
  `World.part`/blockers from the first version of this rework are gone. A closet's contents and occupants are matched by distance
  (`Closets.under`, 0.8 m; 0.7 m for people), not by tile.
* **Dragging** (`People.drag/haul/towProp/dragSlow/moved`, Ctrl+click, `P` lets go; `m.hauling` is `{k: 'item'|'prop', ...}`, mobs still use
  `m.pulling`). A structure is dragged **freely, not tile by tile**: each tick, if its middle is further from you than
  `half + 0.32 + 0.3` m, it slides toward you by the excess (`towProp`), along walls (axis by axis), never into another box or anyone's body, and
  turns to face the way it goes. Blocked, it just stays; you lose your grip when you get more than 3.4 m past its own size from it. Items trail 0.9 m
  behind you the same way. The server sends `pm {i, x, z, d}` / `imv {id, x, z}` per tick it moves (positions rounded to 1 mm so both sides agree), late joiners get
  `welcome.moved: [[idx, x, z, d]]`; both sides apply it with `moveProp` (record, box and the static's position) and `WorldView.propMoved/updateSlides`
  ease the picture over to it. People inside a dragged closet go with it. Slowdown is `1 / (1 + ds * 0.45)` (about 0.6 for a locker); dragging someone
  who is down also slows you unless your grip is aggressive or better. The HUD shows SS13's own `pull` icon under the doll while you drag (SS13 draws nothing otherwise).
* **Controls changed**: Ctrl+click used to open the strip window; it now drags (SS13's meaning), and the strip window is Alt+click on a person or
  dragging them onto your hands. Alt+click on a closet is still lock/unlock.
* Not done: dragged structures cannot be stood on or buckled to (no buckling yet); a box dragged into a doorway just blocks it (the door still
  opens and closes round it); tables, windows and wall mounts are not draggable (anchored in the DM anyway); no sound or message when a thing
  will not budge (SS13 says nothing either). The `structures` section of `tools/simtest2.mjs` is the spec.
* **You pass through what you drag, then you eject.** `stepMovement`'s `ctx.ignore` (server: `m.hauling.it`; client prediction: `selfState.haul`, the
  index of the dragged prop) lets you walk through its box, so you can never get wedged against it. `People.release` calls `eject(m, it)`: if you
  are standing in it you and it move apart (half the distance each along the line between you, else whoever has room; tries eight directions;
  tested exactly on top of it with a wall behind you). Release happens for many reasons (P, Ctrl+click again, losing your grip, a stun, cuffs), all via `release`.
* **Browser shortcuts while you play.** `Input.guard` (true in a round) makes `Input` call `preventDefault` on every Ctrl/Cmd chord except text-field
  editing keys and Ctrl+Shift+I/J/C/K/R (devtools, hard reload), on Alt+Arrow (back) and on Ctrl+wheel (zoom). Ctrl+W, Ctrl+T and Ctrl+N cannot be prevented
  by a page: `Game` asks before leaving a round (`beforeunload`; off for `?nolock` so headless runs and tests are not blocked) and `F4` goes fullscreen
  and calls `navigator.keyboard.lock(['KeyW','KeyT','KeyN','Tab','PageUp','PageDown'])` (Chromium only), which does let those through to the game.

## 13. The debug menu, and the observer fix
* **Flag**: `node server/index.js --debug` (it already existed for `tools/nettest.mjs`; its three ad-hoc ops moved out of `server/index.js`) or `?debug` on a
  local round. It becomes `Sim` option `debug`; `welcome.debug` tells the client the menu exists. With the flag off `Sim.handle` ignores `{t: 'dbg'}`.
* **Sim side** is `src/sim/debug.js` (`sim.debug`, class `Debug`): one function per op in `Debug.ops` (spawn, mob, delete, heal, revive, god, noclip,
  speed, access, outfit, tp, area, goto, bring, who, alert, power, strike, carp, shuttle, doors, repair, round, skip, plus the nettest ones: kill,
  finish, tile, noop). Everything a client sends is validated (paths checked with `Object.hasOwn` on the item defs, amounts capped at 25 / a 50 stack,
  non-finite coordinates ignored, players cannot be deleted). It answers with `[Debug] ...` chat lines, and `who` with a `dbg` event.
  `Body.god` stops all damage; `Mob.noclip` and `Mob.dbgSpeed` feed `Sim.moveFactor` and `selfState.dbg`, which the client uses to predict the same
  movement (`predictCtx`).
* **Client side** is `src/client/debugmenu.js` (`F3`, five tabs; opens like the other panels and frees the mouse). The item catalog comes from
  `assets.level.itemdefs`, so it needs nothing from the server.
* **Test**: the `debug menu` section of `tools/simtest2.mjs` (it found a real bug: `'__proto__'` passed as an item path).
* **Observer bug fixed**: `applyPlayerInputs` threw away the queued inputs of every client without a body (observers, ghosts) before `updateGhosts`
  could read them, so observers and the dead could not move in multiplayer and were pulled back to where they started. Now bodiless clients keep
  their inputs (`observers and ghosts` section of simtest2).

## 14. The inventory HUD (from the user's mock-up)
`src/client/invhud.js` (class `InvHud`, `game.inv`) replaced `bodypanel.js`. Three fixed groups, all SS13 icons from `assets/ui.png`, sized by the `--cell` /
`--p` CSS variables, visible while `phase === 'playing'` (`setVisible`, called from `setPhase`) and clickable only in hands mode (`body.handsmode`):
* `#slots` bottom left: the key row `back, belt, id, lpocket, rpocket` always; above it the `equipment` grid
  (`head ears / glasses mask neck / uniform suit gloves`, and `shoes suit_store` next to the blank toggle button on the bottom row), shown when
  `#slots.open`. `I` or the button toggles it (`InvHud.toggle`: opening calls `enterHands(true)`, closing `panelsChanged()`); the open state is
  remembered in `localStorage` (`yad3d.equipment`). It is **not** part of `panelOpen` (it is a HUD, not a modal window) but Esc closes it (`closeTop`).
* `#gauges` right edge: the health doll (same damage levels and condition text as the old panel), then the internals button and the pull button
  (hidden unless you drag something).
* `#acts` bottom right: the four intent buttons, with throw / drop / resist above (those three are half-height crops of SS13's tiles, whose artwork
  sits in the top or bottom half).
* Slot elements keep `.slot[data-slot]` + `data-item`, so `dnd.js` treats them as before (`uiCell` now matches `#slots .slot`). Bag windows stack above
  the slots (`InvHud.topEdge()`, `Bags.place`). `tools/uitest.mjs` was updated to the new ids but could not be run here.

## 15. Zero gravity and space walking
Open space is no longer solid: you can leave the station and float. The rules follow SS13's `Process_Spacemove` (`_src/tg2020/code/modules/mob/mob_movement.dm:267`,
`atoms_movable.dm:538`, `carbon_movement.dm:8`, `controllers/subsystem/spacedrift.dm`).
* **Gravity** is `World.hasGravity(x, z)`: none over space or lattice, always on in an area whose category is `shuttle`, otherwise `world.gravityOn` (the station's generator:
  `Sim.setGravity(on)`, the debug menu's World tab, or `{t:'dbg', op:'gravity', on}`). `welcome.gravity` and a `grav` event keep clients in step. Switching it shakes everyone's camera and plays
  `terminal_alert` (gravitygenerator.dm's `shake_everyone`; it says nothing in words). There is no gravity generator *machine* yet (see docs/tg/gravity-and-space-movement.md).
* **Movement** (`src/shared/movement.js`): `floatState(world, st, ctx)` gives `floating` (no gravity under you; `ctx.mag` magboots only count on a real floor), `held` (gravity, `ctx.jet`, or
  `World.hasGrip`: lattice within a tile, or any wall / locker / window frame within `GRIP_REACH` = 0.9 m of your body) and `adrift` (floating and not held). Held: you steer as normal, and with no
  keys you stop, which is how you grab a wall. Adrift: the keys do nothing and you coast at the speed you had (capped at `DRIFT_MAX`, 4 m/s); a bump zeroes that axis; escaping air adds to your
  velocity (`WIND_PUSH`). A floating body reports speed 0 (no steps, no walk animation; the camera sways instead). `ctx.limp` (dead, stunned, held down) keeps coasting in zero g
  (`Sim.limp`, `Game.stepPred`).
* **Throwing** while adrift kicks you the other way (`THROW_KICK`, `Actions.throwItem`; carbon.dm `throw_item` does `newtonian_move`).
* **Gear**: `J` is the jetpack on your back (`def.jetpack`, gas in `item.gas`, 3 per second of thrust, SS13's "You turn the jetpack on." and "You feel your jetpack's engines cut out."; stabilizers
  are always on, so it brakes you when you let go). `K` is magboots (`def.magboots`, "You enable the mag-pulse traction system.", 0.65x speed). Both switch themselves off when taken off
  (`recalc`). The client predicts with `self.jet` / `self.mag`.
* **Rendering**: wall faces that look onto space are drawn now (they were skipped), so the hull shows from outside. The stars are still a skybox on the camera (no parallax).
* **Not done**: NPCs still walk on the floor when gravity is off; loose items do not drift; no jetpack stabilizer toggle; the hardsuit jetpack upgrade is treated as a plain jetpack; carp fly
  through open space like anywhere else. The `zero gravity` section of `tools/simtest2.mjs` is the spec. Debug: F3, World tab, Gravity (on / off / take me out into space).

## 16. The TG research notes (docs/tg/)
Fourteen Haiku drones read `_src/tg2020` and wrote one file each, so the next stage (real construction, power, machines) can be built from them. `docs/tg/_BRIEF.md` is what they were told (raw
deciseconds, file:line on every fact, verbatim strings, never invent); `_ours-items.txt` and `_ours-structures.txt` list what the game already has. The files: windows-grilles, walls-floors-girders,
tools-and-dispatch, stacks-and-recipes, power-grid, power-generation, computers, machine-frames-and-parts, vending-and-small-machines, doors, furniture-structures, wall-mounts, atmos-equipment,
gravity-and-space-movement. **They are unverified drone output.** A spot check of five claims found four right (the reinforced window delays 150/50/40/20/40 ds, 80 computer types on BoxStation,
`default_unfasten_wrench` 20 ds, windows leave the grille) and one wrong (machine-frames said the APC, fire alarm and air alarm electronics were NOT FOUND; they exist). So grep the DM for any number
or string before building on it, and do not trust a "NOT FOUND". A newer TG snapshot (it has no BoxStation) is at
`C:/Users/Willi/Downloads/tgstation-1da0b5547e02db0db48d0bc93926c26bd8888347` for cross-checks.
* **Third sweep (2026-10-20, done except 73 machines):** the item lists and the gaps the first two sweeps left were redone by 17 shards of Haiku drones
  that save part files as they go (`docs/tg/gap-*.md`). Every one of the game's 916 item definitions is now documented, and 96% of what is placed on the map. What is left is
  listed in `docs/tg/_STATUS.md` with the commands to finish it. Four tools came out of it (`tools/tgwhere.py`, `tgcheck.py`, `tgmerge.py`, `tgplan.py`). `tgwhere` is what
  stopped the false NOT FOUNDs: 83 of the first sweeps' 88 NOT FOUND claims were for types the DM defines. Spot checks of the new notes all matched the DM. Cost: about
  5 points of a Pro plan's 5-hour window per item drone and 7 to 8 per machinery drone; the second sweep's agents died on the session limit.
  Found on the way: the game's `suit/space/emergency` and `helmet/space/emergency` and `storage/photo_album/prison` are not TG 2020 types (`_STATUS.md`).
* **Why a smashed window leaves something behind**: in TG a window and its grille are separate objects. Breaking or unscrewing the glass leaves the grille, which you then cut with wirecutters
  (windows-grilles.md). Our `World.setBreach` (commit ac5381a) copied the grille staying, but nothing removed either, and a made-up "broken window" target stood in for it. Fixed: section 17.

## 17. Windows and grilles, the TG way (`src/sim/windows.js`, `src/shared/windows.js`)
Read `window.dm` and `grille.dm` in `_src/tg2020/code/game/objects/structures/`; every delay, message and drop below is theirs (checked in the DM, not taken from the drone note).
* **Two kinds of window**: a whole glass tile (target `window`, state in `world.ws[i]`) and a thin pane on a tile edge (target `pane`, state in `pane.ws`, 25 hp). **A tile whose glass is gone** is a `breach`
  target with `world.grille[i]` (the grille still stands and blocks you) or without (open floor). The hover name is "grille" or "floor"; there is no "broken window".
* **State** (`WS` in `shared/windows.js`): the DM `state` (reinforced: SECURE 8, BOLTS_HEATED 7, BOLTS_OUT 6, POPPED 5, BARS_CUT 4, OUT_OF_FRAME 0) plus `UNANCHORED` 16 (loose: does **not** seal, `airBlock` 0,
  window.dm `CanAtmosPass`) and `GRILLE_LOOSE` 32. Tile events carry `gr` and `ws`.
* **Smashing** (`Sim.breachTile` / `shatterPane` -> `Windows.spill`): one shard, a second one for a full-tile window, and 2 rods (1 for a pane) if it was reinforced (window.dm `spawnDebris`); the grille stays. No decal
  (we have none), and a plasma window drops a plain shard (we have no plasma shard item).
* **Taking apart** (`Windows.click`): screwdriver 30 ds toggles anchored; wrench 30 ds on a loose one gives `glass_amount` sheets (2 for a tile, 1 for a pane) at *your feet*; a reinforced one first needs
  welder on **harm** intent 150 ds (cools after 300 ds), screwdriver 50, crowbar 40, wirecutters 20, wrench 40, and to be levered back in with a crowbar 100 ds. Welder on help intent repairs (40 ds).
  Empty hand on help intent knocks. Anything else on harm intent is still a swing (`Actions.swing`), which smashes with force 9 or more. (Real TG hits objects with tools on any intent; we only do it on harm.)
* **The grille** (`Windows.clickGrille`): wirecutters cut it at once for 2 rods, no message; screwdriver loosens or fastens it; 2 rods on a hole build one (1 s; TG builds it at your feet, we build it where you click);
  glass sheets (2, or rglass / plasma glass) on a fastened grille place a window in 2 s that comes out **loose** (screw it down, and a reinforced one needs the crowbar step). Plasma reinforced glass has no window in this map.
* **Items**: `/obj/item/stack/rods`, plasma glass and plasma reinforced glass were added to `GAME_ITEMS` in `tools/build_level.py` and the assets rebuilt (the build is byte-identical on re-run; the three generated files that
  changed are `level.json`, `sprites.json`, `sprites.png`). Behaviours in `shared/items.js` (`sheet: 'rods'|'rglass'|'plasmaglass'`).
* **Still not TG**: welding a **metal sheet** over a hole to make a wall (`Actions.clickBreach`), the "hull breach" SOP text in `terminals.js` and the engineer call-out in `director.js` that describe it. Real repairs are
  glass on the grille. They are kept for now; say if they should go. A grille does not shock (no cables are modelled), and tools do not hit windows on help intent.
* **Not done**: building a pane (the stack craft menu), the grille taking damage, the windoor / shuttle / tinted windows, the glass decal. The `windows and grilles` section of `tools/simtest2.mjs` is the spec.

## 18. Door angles and wall mounts (a round of minor fixes)
* **Doors and firelocks** (`doorYaw` in `src/shared/propdata.js`, run for every door and firelock once all are placed; `DoorCore` and `WorldView.addFdoorView` read `proto.yaw` / `f.yaw`). The angle used to come from
  "are both neighbours on this axis walls", and anything else was a guess: 51 of 436 airlocks and 170 of 269 firelocks had no wall on one axis (the map's own `dir` is always south for them, so no help).
  Now each axis is scored: wall at an end counts 3, a door in the line counts 1, open floor on the two sides counts 1 each; ties look two tiles out. This turns the middle door of a row of three
  airlocks (the four "Central Access" groups) and firelocks in an open passage into a line across it. Clear cases come out exactly as before (385 of 385 airlocks, 99 of 99 firelocks).
* **A firelock in an airlock's doorway** (118 of them) is drawn 0.2 m to one side of it: the two closed doors were in one plane and flickered through each other.
* **Wall mounts** (`tools/build_level.py` `mount_side`): the wall is the map's pixel offset if it has one (>= 12 px), else the object's own `dir` when the map sets it (an APC's dir is the wall; for everything else the wall is behind
  the way it faces), else whichever wall is there (73 guesses left, 13 at corners). The map's other pixel offset now slides the mount along the wall (`lat`), so side by side buttons and alarms are no longer drawn on top of each
  other. **Signs, status displays and buttons that are mapped on the wall tile itself** (111 of them, `ow: 1`) used to be pointed at another wall block, which put them inside it, invisible; they now hang just outside the
  face that looks onto open floor. Mounts on the same stretch of wall stand 12 mm apart in depth so none flicker (`out.wmSpots`). 35 mounts (cameras and direction signs on pillars or door frames) still have no wall on their side.
* Test: the `door angles and wall mounts` section of `tools/simtest2.mjs`.
* **Chat runes** (`hud.js` `updateRunes`): a speaker's words sit just above the top of their drawn picture (`WorldView.mobViews.get(id).top`, from the standing frame so a walk cycle does not shake it), kept on screen when the head is above the top edge
  (`RUNE_EDGE`), and your own speech is not shown (your head is the camera, and your own record is never moved, so it used to hang where you spawned). Checked in the browser: a person at range, a corgi, someone lying down, someone standing close.

## 19. Walls, girders and what players build (`src/sim/walls.js`, `src/shared/walls.js`, `src/shared/built.js`)
Read from `walls.dm`, `reinf_walls.dm`, `girders.dm` (all delays and messages are theirs). **Stage 1 of "walls+"** (stacks, the craft menu, floors and lattice are the next two stages).
* **Walls** (`World.wallKey(i)`: `wall` or `reinforced_wall`; the shuttle wall and the other variants are not taken apart): target `wall`, a target only while you hold a tool (`Game.holdingTool`), so corridors are not labelled.
  Plain: a lit welder, 100 ds, then two metal sheets, a girder and bare plating (`World.dismantleWall`, floor cell `level.terrain.plating`). Reinforced: 7 states in `world.ws[i]`
  (`RW`): wirecutters (instant) / screwdriver 40 / welder 60 / crowbar 100 / wrench 40 / welder 100 / crowbar 100, each reversible one step back, ending in a plasteel sheet and a reinforced girder.
  Taking down a wall that touches space is a hull breach (`World.holes`, `ventTiles()`), until a wall is built there again.
* **Girders** are **built structures** (`BuiltSet`, one per tile, events `bs+ bs~ bs-`, `welcome.built`, `Replica.built`, drawn from `WorldView.addBuilt` in the `dyn` batch). The map's 5 girders are records now (`props.girders`), not static
  sprites. State `GIRDER` 0 normal, 1 struts unscrewed, 2 reinforced, 3 displaced. Wrench 40 loosens / bolts, screwdriver 40 takes a displaced one apart (two metal) or the struts of a reinforced one,
  wirecutters 40 take the inner grille out (a plasteel sheet, back to a plain girder), two metal sheets plate it (40) into a wall, plasteel reinforces it (60) and then finishes the reinforced wall (50).
  Not done: false walls (sheets on a displaced girder), iron walls from rods, plasma cutters, girders taking damage.
* `src/sim/tooljob.js` (`toolJob`) is the timed tool step both the windows and the walls use; reuse it for anything that is "work for N ds, still there, still holding it, still close".
* Wall mounts (an APC, buttons) on a wall that is taken down stay drawn where the wall was (the DM leaves such objects on the tile too).
* Build: `structs` (girder sprites) and `terrain.plating|floor|engine` are in `level.json`. Test: the `walls and girders` section of `tools/simtest2.mjs`.

### Stage 2: stacks (`src/shared/stacks.js`, `src/sim/stacks.js`, `src/client/stackui.js`)
From `stack.dm` and `sheet_types.dm`. `STACKS` lists what stacks (max_amount, singular_name; two items merge when they match the same entry, like merge_type) and `RECIPES` what the menu makes; the DM's metal list has
dozens of entries (chairs, frames, airlock assemblies, wall frames...), only the three the game can build are in (floor tile 1 -> 4, metal rod 1 -> 2, wall girders 2 sheets 40 ds), so adding a recipe is one line once its result exists.
* **Merging** (`mergeStack`, `stackNote` in `inventory.js`): picking a stack up joins the one in your active hand, else the other (put_in_hands), and clicking a floor stack with one in hand joins it into yours; a stack holds `max`, the
  rest stays on the floor. "Your metal stack now contains N metal sheets." `Stacks.spawn(path, amount, x, z)` makes stacks of at most max and joins them to what lies on the tile (every window / wall / girder drop uses it).
* **The menu**: `Z` on a stack sends `{e:'stack', id, name, amount, recipes}`; `StackWindow` shows "Amount Left", a take-out row (stack.dm's Alt+click prompt) and one row per recipe with the 5x / 10x / 25x / max buttons the DM offers.
  Messages from the client: `{t:'stack', op:'make', item, i, mult}` (the stack must be in your active hand) and `{op:'take', item, n}`. The server answers with a fresh `stack` event, or `{close:1}` when the stack is gone.
* **Building**: a structure goes on the tile **in front of you** (the DM builds under your feet; here you would stand inside it, so `moveOut` also nudges you back if you overlap). Checks and messages are `building_checks`' ("There is another wall girders here!",
  "The wall girders must be constructed on the floor!", "You haven't got enough the metal to build the 2 wall girderss!": the DM's own grammar). It stops if you walk away or put the stack down.
* Items: `/obj/item/stack/tile/plasteel` (the floor tile) is in `GAME_ITEMS`. Test: the `stacks` section of `tools/simtest2.mjs` (436 assertions in all).

### Stage 3: floors, plating, tiles, lattice, catwalks (`src/sim/floors.js`)
From `floor.dm`, `plating.dm`, `reinf_floor.dm`, `lattice.dm`, `space.dm`. Target `floor` `{c, r}`, shown (hover name `World.floorName`: floor / plating / reinforced floor / lattice / catwalk / space) only while you hold
a crowbar, wrench, wirecutters, rods or a tile (`Game.holdingBuilder`, `floorAlong`: the ray down to the floor plane).
* **Data** (build, `level.json`): `ft` per tile (1 + index into `floorTypes`: `{k: 'plating'|'tile'|'engine', tile (what prying it leaves), n (name)}`, 23 types on BoxStation), `lat` (1 lattice, 2 catwalk), `latCells`
  (the lattice and catwalk art for every pattern of the 8 neighbours, `World.latticeMask`/`latticeCell`; a simtest checks it reproduces all 1,721 of the map's own lattice tiles) and `tiles` (what each tile item
  turns plating into: floor type + cell). Tile events carry `ft` and `lat`. Shuttle floors have no type, so they cannot be taken apart.
* **Rules** (all messages the DM's): a crowbar pries a tile floor up **at once** (leaves its tile, plating; a reinforced floor cannot be lifted); a tile on plating lays it **at once** (any of plasteel, wood, carpet, blue carpet, grass, circuit,
  titanium, plastitanium); a tile on a floor with a crowbar in the other hand replaces it; two rods (30 ds) reinforce plating; a wrench (30 ds) takes a reinforced floor back to plating and two rods. In space: a rod makes a lattice, a rod on a
  lattice a catwalk, wirecutters cut either away (1 rod, 2 for a catwalk), a plasteel tile on a lattice or catwalk makes plating ("You build a floor."), a tile on bare space says plating needs support. A floor built out in space has gravity like
  any other (the generator). Redrawing: any change redraws the lattice around it (`World.latticeAround`, `Sim.emitTile`).
* Not done: broken / burnt plating and welding dents smooth, foam plating, light and mineral floors, building a floor under girders, cables on catwalks.
* The debug spawn menu now makes real stacks (`stackInfo`). Test: the `floors, plating and lattice` section of `tools/simtest2.mjs` (480 assertions in all; the soak `node tools/simtest.mjs 12 --player` is clean).

## 20. Grids and maps (the "independent grids" work: `src/shared/{grid,gamemap,frames,math3,physics}.js`, `src/sim/gridsim.js`, `src/client/gridview.js`)
The user asked for **independent grids**: each its own tile map, floating separately in 3D (one may be perpendicular to another), each a physics body, room for stacked floors, and *a grid's movement never directly affects its
inhabitants*; and **a map is a separate space of grids**. Decisions made with them: do all five stages, use **Rapier** (behind `src/shared/physics.js`, so Box3D could replace it), and people who step off a moving grid **inherit its velocity**
(`v_world = R·v_local + v_grid + ω×r`, with a cap and a relative-speed limit on entering; constants to be added in stage 3). The plan (stages 0 to 5) was written in plan mode (`~/.claude/plans/`); this is what is built and what is next.
**All five stages are done**: 0 (groundwork), 1 (the grid abstraction), 2 (shuttles and docks), 3a (physics and flight), 3b (the void and inherited velocity), 4 (grids across each other, three dimensions), 5a (several maps) and 5b (stacked decks).
* **The model.** `GameMap` {id, name, grids}: a space with its own void and (stage 3) its own physics world. `Grid` (`shared/grid.js`; `GridSim` on the server, `GridReplica` on the client): `{id, bp, kind, map, tf, vel, ang, world, props, doors}`
  built from a **blueprint** (`level.grids[bp]`: the arrays, props and spawn points of one tile map). `World` stays the tile store (gains `levels`, `n`, `idx(c, r, l)`); `grid.world.gravityOn` is the grid's own gravity. `GridSim` adds the per-grid
  `atmos`, `power`, `nav`, `firedoors`, `built` and `tileLog`. **Everything on a grid has `.grid` and coordinates in its frame**: mobs (`m.grid`, `m.map`, `x, y, z`; a body floating free is on the map's *void grid*, see stages 3b and 4), floor items
  (`{item, grid, x, y, z, c, r}`: `place(sim, item, grid, x, z, y)` throws without a grid), doors, firelocks and props (`buildPropData` stamps `grid` on them), built structures, closets.
* **Riding.** Because a rider's state is in the grid's frame, moving or turning the grid changes only `grid.tf`: nothing local changes (a test asserts it bit for bit), and the client's prediction does not depend on the grid's motion at all.
* **Sim helpers** (`sim.js`): `worldPos(at)`, `dist(a, b)` (same grid: across the deck, height ignored as always; different grids: true distance in the map; different maps: `Infinity`), `sameGrid`, `mapOf`, `gridFor(id, client)`, `spawnPoints()`,
  `addMap`, `addGrid(bp, {map, kind, tf})` (relinks the map and sends `grid+`), `removeGrid(g)` (items on it go; `grid-`), `relink(map)`, `settleMob(m)`, `yawIn(m, yaw, g)`, `frameYaw(from, to)`. `sound(name, at, v)` and `shake(at, amt, r)` take anything with a grid and x, z
  (a mob, a door, an item record) and send map coordinates. `emit(ev, {near: {at, r}})`. `grid.emit(ev)` stamps `g`. `sim.station` is the main grid: the director, the round report and the pets name it on purpose.
* **Shortcuts for the tests.** `sim.world / props / doors / atmos / power / nav / firedoors / built / tileLog` and `rep.world / props / doors / fdoors / power / built` still exist and mean the station's; they count their uses in `sim.compat` / `rep.compat`.
  `tools/gridtest.mjs` fails if any file under `src/` uses them (and only lets the listed files name `.station`): **keep it that way, it is what stops the single-grid assumption creeping back.**
* **Data.** `build_level.py` writes `level.json` as shared content (art tables, areas, wall variants, item definitions) plus `grids` (`station` and one blueprint per shuttle template: arrival, labour, mining x2, cargo, escape pod, emergency; each padded with a
  tile of open space all round, so a body in a doorway is not "off the grid") and `maps.station`: which blueprints sit at which pose (`p`, `q`, found from the DM docking ports and the rotation that overlaps the station least, the same choice the old stamping made)
  and `docks.emergency` (where the emergency shuttle arrives). Shuttles are **no longer stamped into the station** (`stamp()` and the evacuation overlay are gone), and each is processed once however many docks use it (four pods, one blueprint).
  `decodeGrid(level, bp)` makes fresh arrays each call. The plan said one file per blueprint (`assets/grids/*.json`); it is all in `level.json` for now, the format would not change.
* **Docking (stage 2).** `GameMap.relink()` (both sides call it whenever a grid comes, goes or moves) gives every grid `world.neighbors` (the other grids lying over its open space, with the 2x2 matrix and offset from its frame to theirs and the
  turn between them) and `world.covered` (its space tiles another grid is over: 1 floor, 2 wall). Consequences: `World.collides` also checks each neighbour's tiles, so a docked hull is solid from the station's side; `isOpenSpace` is false under a docked
  grid, so **air does not leak into the gap** (atmos sinks, wind, `ventsToSpace`, the director's window list use it; air does not pass between grids either, so a seam is sealed even with both doors open: a gap, see below); `shared/frames.js` `settle(grid, st)`
  hands a body that has walked onto a neighbour's tile to it (position, velocity and facing carried across; the map position never jumps, a test checks all nine docks incl. the quarter-turned ones). The server calls it after every movement (`settleMob`: players, `limp`,
  NPC `steer`, a person you pull); the client's prediction does the same, and **`Game.yaw` follows you from grid to grid** (`yawG`, `syncYaw`) so you keep facing the same way in the world; an input or click made in the old frame names it (`g`, `yg`)
  and is turned on arrival, on both sides.
* **The emergency shuttle** (`director.js`) is a grid that appears when it docks (`sim.docks.emergency`) and is removed when it departs, with everyone aboard (`evacuated`). `inShuttle(m)` is `m.grid === evacGrid`. NPCs run to the station tile beside its nearest
  door (`findSeams`, `m.seam`) and then through it (`m.boardTo`, `AI.board`). Gravity on shuttles is just their own grid's `gravityOn` (the area special case is gone).
* **Client** (`state.js`, `view.js`, `gridview.js`, `game.js`): `Replica.grids`, `station`, `map`; events go to the grid they name; `grid+` / `grid-` build and drop a grid live. **`WorldView` draws a `GridView` per grid in a `THREE.Group` whose matrix is its
  pose relative to the grid you stand on** (`update(..., frameId)`: the scene is drawn in that grid's frame, so the camera, light uniforms and picking are in it); people are drawn by `WorldView` in that frame (`mobPose`); the sprite shader multiplies by `modelMatrix`
  and builds billboards in the batch's own frame; terrain skips faces toward space covered by another grid's wall (they would shimmer). `Game.pred.g` / `myGrid()` is the grid you stand on; `findTarget` searches it and the grids against it (`scanGrid`, with the ray
  turned into each); click targets carry `g`; sound is positioned in map coordinates (`listener` = your world position and facing).
* **Physics adapter** (`src/shared/physics.js`, stage 0; the sim's use of it is "Stage 3a" below): `await initPhysics()` once (the module is async because Rapier is wasm), then `new PhysicsWorld()` per map: `addBody(id, {type: 'dynamic'|'fixed'|'kinematic', p, q, lock})`,
  `setBoxes(id, [{c, h, d}])` (a grid's tiles as boxes), `thrust`, `impulse`, `pose`, `step(dt)` (returns collisions with their force). `lock: {y, rx, rz}` keeps a body in its plane (stage 3 flies grids that way; stage 4 lifts the locks).
  500 boxes step in about 1 ms in Node and in the browser; Rapier is 4.3 MB of JS with the wasm inlined (`vendor/rapier3d-compat.mjs`, Apache-2.0, in `ATTRIBUTION.md`).
* **Tests.** `tools/gridtest.mjs` (135) with `tools/gridkit.mjs` (`makeBlueprint(level, asciiRows)`, `withGrids(data, blueprints, placements)`: the station plus what the test adds): separate arrays, air, power, gravity, doors and items; clicks name a grid; `worldPos`/`dist`; riding;
  maps do not meet; the client replica for several grids; **the real docks** (walk on and off each, air at the seam, the hull, the emergency shuttle through `grid+`/`grid-`, boarding NPCs); the source scan. `tools/physicstest.mjs` (29). `simtest2` (478): the walls section
  now switches off meteors and carp (`director.strikes = 99`, `carpTimer = 1e9`): with the shuttles gone from the station's window list the first strike lands somewhere else, and where it lands is not what that section tests.
* **Gaps from stage 2.** Air does not flow between grids (a docking seam is sealed even with both doors open; the old stamped shuttles shared the station's air). Mobs and items cannot be on two grids at once: a thrown item lands on the thrower's grid. Hauling a
  locker or item across a seam lets go. Speech hears across a seam only within 2 m (no line of sight between grids); runes show only for people on your grid; sounds from other grids are not muffled. Pulling someone across a seam works (they follow in their own frame).
  `uitest.mjs` and `nettest.mjs` were edited for the new signatures but not run (no Playwright here). The ghost still flies in map coordinates (= the station's frame, as the station is at the origin).
* **Stage 3a: grids are physics bodies and fly** (`src/sim/physics.js`, `src/sim/shuttle.js`). **`await initPhysics()` must run before `new Sim`** (the server, `tools/*.mjs` and `LocalConnection.start` do; a new entry point must too).
  * `GridPhysics` (`sim.physics`): one Rapier world per map, one body per grid, its shape the greedy-merged boxes of its non-space tiles (`boxesOf`, each box `INSET` = 0.12 m smaller each way so two hulls docked flush do not catch on contact; density 50 kg/m3, 1 m tall).
    Bodies are locked to the deck plane and to turning about the vertical (stage 4 lifts that). A *docked* grid is a fixed body; an undocked one is dynamic. `step(dt)` writes each dynamic grid's pose, velocity and spin back to `g.tf / vel / ang` and
    bumps `g.poseSeq` only when it moved; shapes are rebuilt when a tile changes (`tileChanged` -> `physics.touch(g)`; at most once a step). Hard contacts (force over `IMPACT_MIN`) go to `Sim.gridImpact`: shake and a far explosion sound.
    `physics.warm()` runs one tiny step after setup (the first Rapier step costs about 80 ms).
  * `Shuttles` (`sim.shuttles`): `fly(g, pose, {dock, vmax, amax, done})` lets the grid go (`sim.undock`) and pushes it with an engine force (a PD on velocity: cruise `VMAX` 14 m/s, `AMAX` 4 m/s2, settle time `TAU` 0.25 s, braking so it stops on the mark);
    on arrival it is put *exactly* on the mark and, with `dock`, welded there (`sim.dock(g, pose)`, which relinks the map). `halt`, `cancel`, `clearDirection(g, dist)` (an axis along which the grid can move without meeting another's walls; null in a notch).
    `sim.undock / dock` send `grid~`; undocked grids have no `neighbors` or `covered`, so nothing is "docked" to them.
  * **The emergency shuttle flies** (`director.js`): at 20 s before arrival (`FLIGHT_LEAD`) it appears `APPROACH` (150 m) out along a clear direction (`awayFromStation`) and flies in; `dockShuttle()` is the instant version (the debug op and the tests use it);
    on departure it flies away and is removed when no client is aboard (then `finish('shuttle')`).
  * **Protocol:** `grid~` (docked or free, pose), and `snap.grids` rows `[id, p x3, q x4, v x3, w x3]` for the grids that moved since the last snapshot (an undocked grid at rest is not repeated). The client keeps a short buffer per grid (`g.buf`) and `Replica.updatePoses(now)`
    interpolates, exactly as for mobs, so a flying grid is drawn about one snapshot behind the server. The stars rotate against the frame you stand in (`view.js`). Riders' coordinates are untouched by any of it.
  * **Debug:** `dbg grid list|out|home|spin|stop|tilt|level|board` and a "Grids" tab in the F3 menu (stage 4 added Tilt and Level). Out flies a shuttle 60 m clear of the hull (some sit in a notch of the station and say so), Spin turns it, Board puts you on it.
  * **Fans:** `/obj/structure/fans` (tiny fans) are props (`k: 'fan'`, `propdata.js`): their tile is `airBlock` (no gas moves through it) and the dense variant is solid. BoxStation has three (the chapel, disposal and toxins launcher doors): the plating they stand on is no longer a place the air escapes, so the room behind keeps its pressure with the door open.
  * **Gaps (kept from before, plus new):** a docked hull is sealed (no air passes between grids even through two open doors); the arrival, labour, mining and cargo shuttle templates have open ends (the DM's engines pass air) so **they vent when flown away**, the pods are sealed;
    14 pressurised station tiles still leak to space because their poddoors/shutters are not modelled (Transfer Centre 79,76-78; Toxins Test Area 223,151; Toxins Mixing Chamber 183,152-154; Port Quarter Maintenance 72,160-161 and 73,161; Incinerator 147,181 and 148,184; and the like);
    `clearDirection` only tries the four axes (some pods have none); a flown shuttle that meets the hull is stopped by it and shakes the station (a test), but nobody is hurt by a collision; **`tools/uitest.mjs` and `tools/nettest.mjs` have not been run since stage 1** (no Playwright here);
  * **Tests:** `tools/gridtest.mjs` (267 with 3b to 5a: a grid flying, spinning, hitting the station, reaching clients, the emergency shuttle in and out; riders bit-identical while it moves), `tools/physicstest.mjs` (29), `simtest2` (484, with `tiny fans seal against air`). Soak: `node tools/simtest.mjs 12 --player` clean, worst tick about 25 to 55 ms.
* **Stage 3b: the void.** A body that is on no grid is "on" its map's **void grid** (`map.void`, kind `'void'`, `VOID_BP`): a real `Grid` with a single empty tile, the identity pose, no physics body, and a **`VoidWorld`** (`shared/voidworld.js`) for a `world`. Its coordinates are the
  map's own, so a body in the void has `m.grid = map.void` and everything that takes a body's grid (`sim.dist/worldPos`, atmos queries, events, snapshot rows, the client's frame, the camera) works unchanged; the void has no air (`Atmos.pressureAt` is 0 off the array), no gravity, no props, no doors.
  The void grid is added after the real grids (`Sim.ensureVoid`; `addMap` makes one at once), is in `map.grids` and the welcome like any other, and is skipped where only real grids are wanted (`map.solids`, the debug list, physics).
  * **`VoidWorld`** has no tiles; what is in the way is every other grid of the map, listed in its `neighbors` (the same records a docked grid keeps, but for all grids, moving or not: `GameMap.linkVoid()`, called by `relink` and by both sides whenever a pose changes). So `collides`, `move`, `hasGrip`, `holdVelocity` and `raycast` (it
    joins each ray to a grid where it enters its array) work through the grids' own tiles in their own frames; `VOID_LIMIT` (1500 m) is the edge of the map. **Hold on and you move with it:** floating beside a hull you can steer, relative to what you hold (`holdVelocity`: the hull's speed at that point), so you are carried along by a flying shuttle.
  * **Leaving and arriving** (`shared/frames.js settle(grid, st, free)`, run by the server after every move and by the client's prediction; **the only code that changes a body's grid**): a **`free`** body (a player's: `ctx.free`, `m.client`) may go past the edge of an array (the edge is a wall to everyone else, so NPCs never leave) and leaves its grid for the void when it is
    off the array, or over open space of a grid that is **not docked** (a docked grid is part of the map's frame: standing out on its open space is still being on it). It takes the grid's speed: `v = R·v_local + v_grid + ω×r` (`pointVelocity`, capped at `LEAVE_CAP` 24 m/s). Arriving is the inverse: a void body joins a grid when over one of its non-solid, non-space tiles
    (or anywhere in the array of a docked one); its speed relative to the grid is taken, and over `ENTER_MAX` (6 m/s) it is stopped to that and hurt (`Sim.hullImpact`: "You crash into the ... with a sickening noise!", `(over x 1.5)` brute and a stun). Inside a wall that has moved onto it, a void body is put in the nearest clear spot (`unstick`). `Sim.undock` settles whoever is standing out on the open space.
    **A grid's `vel` is the velocity of its origin (`tf.p`), not of its centre of mass** (`GridPhysics.step` converts, and snapshot rows carry it), so `v + ω×(point − tf.p)` is right anywhere on it.
  * **Speed:** in grid frames escaping air cannot blow you faster than `DRIFT_MAX`, but nothing else slows a floating body (the clamp is only with wind): you keep the speed you had, in the void and on a grid. Throwing something kicks you as before.
  * **Ghosts and the lobby** are in the void now too (`snap.you.g` is the void's id; their coordinates were always the map's), so the camera frame is right wherever a player died or watches from. The client draws the void as a (tiny, empty) `GridView` like any other grid, and floor items can lie in it.
  * **Gaps:** NPCs and anything not a player stay on their grid (a glued NPC over a flying grid's open space moves with it); the AI (carp etc.) only sees bodies on its own grid, so a player in the void is not attacked; picking a window or a wall of a grid from the void does nothing (doors, props, items and people on it work, at arm's length);
    a jetpack steers relative to the map, not to a hull; hauling and pulling across the void are untested; a body at a doorway of a venting grid can flip between the grid and the void every tick as the wind pushes it (it is correct, just noisy); items left in the void stay where they were put (they do not drift).
  * **Tests:** `gridtest` section `floating free in the void` (leaving a moving and a spinning grid, speed kept, docked grids, NPCs, arriving gently and hard, hulls solid, holding a flying hull, unsticking, the client's `settle` and the void's collision against the server's, ghosts and snapshots).
* **Stage 4: grids across each other, and three dimensions.** A grid may lie at any angle; a body floating in the void moves in 3D.
  * **Tipped grids.** `Grid.tilted` (its `tf.q` turns about a horizontal axis too). `GameMap.relink` only lets *level* docked grids lie against each other, so a tipped one has no seam (you reach it through the void). Physics: flying grids are locked to their plane by default;
    `GridPhysics.setFree3d(g, true)` (`g.free3d`) lifts the locks so a knock can tip and lift it (the locks stop forces only: `setVel` still sets any spin). Debug: `dbg grid tilt <id> <deg>` (on its side about the east-west axis, let go, free) and `level`.
    Standing on one is as ever: you are in its frame, so the scene is drawn with it upright and the station tipped over.
  * **The void in 3D.** A floating body has `y` (the height of its *middle*: `CENTER_H` 0.85 above where its feet were), `vy` and `q`, **the tilt it keeps from the grid it left** (`qTilt(grid.q)`; the heading is the yaw, so for a level grid `q` is the identity and it is stage 3b exactly: yaw += twist). Its `yaw`/`pitch` are relative to `q`.
    `VoidWorld.collides3` is a ball of `VOID_R` (0.45) against each grid's tiles in that grid's own frame (`World.collidesTiles3`: walls, doors, edges and things where it is as high as the wall band, the floor as a slab under it and the roof as one over it, where the tile has a roof): from the side through a doorway or an open end
    you can get in, through a roof or a floor you cannot. `grip` (walls and lattice; not floors or roofs, as SS13 holds on to what is dense) and `holdVelocity` (3D) as before. `stepVoid` (`shared/movement.js`, used by `stepMovement` for a void world): with a jetpack or a hold you steer along where you look (pitch too, in your own up), else you coast;
    `stepGhost`: a ghost flies where it looks, up and down as well. `Mob.y/vy/q` and `snap.you.{y,vy,q}` (void only), mob rows have a 8th element `y` for someone floating.
  * **`settle`** does it in 3D: leaving puts the middle at `CENTER_H` above the deck and takes `v + w x r` (3D; a grid's `vel` is its origin's, `ang` any axis); arriving needs the middle within `[VOID_R, WALL_H - VOID_R]` above a non-solid floor tile (a docked level grid also takes you anywhere over its array at about standing height), takes the relative velocity (3D, the vertical part dropped
    after counting it for `ENTER_MAX`), and puts you on the deck. A facing is turned as a direction (`reorient(qFrom, qTo, yaw, pitch)`, `facingTo`): you look the same way in the map across any change of frame, tipped or not; coming onto a grid that is turned differently from your up lines you up with it (the roll goes). The result also has `lift` (how far above standing height your middle was).
  * **Client.** The scene is drawn in a **frame**: the grid you stand on, or, floating, a `Frame` (`shared/frames.js`: a pose with `worldPoint/localPoint/worldDir`) turned as you are (`Game.viewFrame`, `frameQ`); `syncYaw` turns `yaw`/`pitch` with `reorient` when the frame changes (a grid's turning does not count: only moving to another). The camera floating is at
    `qirot(q, middle)` plus eye height, and arriving eases the eye down (`lift`). `findTarget` floating searches each grid near you in its own frame (3D ray). `WorldView.update(..., frame)` gives every grid's picture the camera in its own frame (`gv.cam`, `facingTo`); **people are drawn in their grid's own `mobB` batch** (upright on it, position in its coordinates, someone floating by their feet),
    so a person on a tipped grid is upright to it and tipped to you; the sprite shader falls back to facing the camera's place when the camera's right lies along a grid's up. The stars turn against the frame.
  * **Gaps:** items left in the void do not drift and lie at height 0.01; hauling, pulling and carp across the void are untested; the AI never leaves its grid; a jetpack steers relative to the map, not to a hull; a stale input just after changing frame is turned by the difference of headings only (right for level frames); the PDA map and the minimap assume the station's frame; `uitest`/`nettest` still not run.
  * **Tests:** `gridtest` section `grids across each other` (a tipped grid: riding it, leaving it with its up, steering in 3D, arriving from the side and being stopped by roofs and floors, the client's collision and `settle` against the server's, what snapshots tell, turning a flying grid over, the debug ops, ghosts).
* **Stage 5a: several maps.** A map was a separate space of grids from stage 1 (own void, own physics world); now there is more than one in play and things can move between them.
  * `Sim.addMap(id, name)` (makes the map's void), `Sim.moveGrid(g, map, pose)`: the grid, with whoever and whatever is on it (their coordinates are in its frame, so nothing about them changes), leaves one map and stands at rest at `pose` in the other: its body moves to the other map's physics world, both maps are relinked, the old map's clients are told
    `grid-` (not the ones aboard) and the new map's `grid+`. **A client always has the picture of exactly one map** (`c.map`: the map of its body, or of its ghost): `sendSnapshots` notices when `c.mapSeen` is not `c.map` and sends `{t: 'map', name, map, grids, items}` (the welcome's world part, `Sim.mapState`) and resets what it was told about people;
    the client's `Replica.switchMap` drops the old map's grids, items and people and builds the new, `Game.onMap` makes a new `WorldView` (the old one `dispose`s itself). A map with no station falls back on its first real grid as `rep.station`. Anything that puts a body or a watcher in another map's grid (the debug `map` op, `Debug.teleport`) works the same way, with no special code.
  * Nothing crosses a map: `sim.dist` is Infinity, snapshots and events are per map, and `spawnPoints` are those of the round's own map. `sim.station` is still the one main grid.
  * **Hyperspace:** when the emergency shuttle has flown out and somebody is aboard, `Director.hyperspace()` is a map of its own (`'hyperspace'`) and the shuttle is carried there with them (it was left out there before); with nobody aboard it is still removed. Debug: `dbg map away|home` (an away mission made on first use, a copy of a shuttle in a map of its own) and two buttons in the F3 "Station" tab.
  * **Gaps:** nothing but the shuttle and the debug op uses a second map yet (no CentCom content: BoxStation has none); the radio and announcements are still heard in every map; ghosts at death are put in their body's map; a grid cannot be moved while it is being flown by the controller (it is let go first, as `moveGrid` does).
  * **Tests:** `gridtest` section `several maps` (carrying a grid with someone aboard: who is told what, who sees what, the physics worlds, the replica's switch; the debug op for a body and a watcher; the shuttle's trip through hyperspace).
* **Stage 5b: stacked decks** (`World.levels`; the rules are TG's multi-z: `turf.dm zFall / zImpact`, `living.dm ZImpactDamage`, `structures/stairs.dm`). A grid may have several decks, one above the other, each as big as the grid. It is a grid thing: the station is one deck, and nothing in the real level uses more yet. The new tests
  build their own (`tools/decktest.mjs`), and **the F3 menu's Grids tab has a "Two-deck test grid" button** (`dbg grid deck`): a small grid is made out beyond the station's edge and you are put on it (the stair is the `>`, the upper floor has a hole over it).
  * **Data.** A blueprint has `levels` (default 1) and `stairs` (one byte a tile: the direction it climbs, N 1, S 2, E 4, W 8); **every array holds deck 0, then deck 1, ...** (`n = W*H*levels`, `idx(c, r, l)`, `World.levelOf(i)`). Every `World` method that takes a tile takes a trailing `l` (default 0), so the single-deck code is unchanged.
    Deck `l` stands `l * DECK_H` above deck 0 (`config.js`: `DECK_H` 2.8 = `WALL_H` 2.5 + `DECK_THICK` 0.3, the slab that is the floor above and the ceiling below). `SPACE` on a deck above the first **is a hole** (you can see and fall through to the deck below; there is no "roof" between decks, the roof flag is for the top deck).
    Props, doors, firelocks, lights, tables, panes and floor items carry `l` (`propdata.js` puts their heights up by `l * DECK_H`). `src/shared/blueprint.js` `makeBlueprint(level, rows, o)` turns ASCII into one (a list of decks, the first at the bottom; `#` wall, `.` floor, space = open space or a hole, `D` door, `L` light, `S` spawn, `^ v > <` stairs);
    `tools/gridkit.mjs` re-exports it. A blueprint made while the game runs (`sim.madeBlueprints`) is sent whole in `grid+` / the welcome (`gs.def`).
  * **Moving** (`shared/movement.js`, run by the server and the client's prediction alike): `walkStep` = a stair step, else a normal move, then `fallStep`. **Stairs:** leaving a stair tile the way it climbs takes you up a deck onto the tile in front of it, if you can stand there (the tile above the stair itself should be open space). **Falling:** over a hole you drop to the deck below, as far as the air goes;
    `st.fell` is how many decks and `st.landed` is `'stairs'` or `'floor'`; the server's `Sim.zImpact` hurts you `(5 * decks) ** 1.5` brute and stuns you `5 * decks` s ("X falls through the open space!", "X crashes into the floor!"), except onto a stair, which takes the fall (no hurt, no message); the client only shows it. NPCs use `walkStep` too.
    `World.stairLift(x, z, l)` is how far up the slope of a stair a body is (0 to `DECK_H`): the stair is drawn as a ramp and the eye follows it, so the step up at its end is no jump.
  * **Mobs and items.** `m.l`, `m.fell`, `m.landed`; a snapshot mob row carries the deck in bits 8 to 11 of its flags, `snap.you.l` is yours. A floor item has `l` (`place(sim, item, grid, x, z, y, l)`; over a hole it comes to rest on the deck below, `restDeck`; the `item+` event, the welcome rows and `toss` carry it).
    `sim.dist` adds `dl * DECK_H` between decks, so hearing and speech across a floor reach less far; **reach, shots, rays and drops are on your own deck** (`inReach`, `raycast(..., l)`, `rayMobs`, `reachablePoint`, `throwItem`, vending and `dropFromHand` all use `m.l`).
  * **Air.** `Atmos` is per tile index, so each deck holds its own gas. A space tile over a floor, on a deck above the first, is a *shaft cell* (one room two decks high) and pairs join a cell to the cell above it, so air goes up and down through a hole and only there; a floor under a floor does not leak. `isOpenSpace(c, r, l)` is false for a hole over a room. `pressureAt / o2At / toxAt / addGas / windAt` take `l`.
    Nav (`nav.js`) steps through stairs (up, and down by stepping into the hole over one: the stair takes the fall); paths are `[c, r, l]`; the physics shape (`GridPhysics.boxesOf`) is as tall as the grid's decks over each tile.
  * **Client.** The replica reads a mob's deck from its flags (`m.l`) and its height (`m.h`, the deck plus the slope, interpolated); `Game.pred.l`; `eyeBase()` is the eye's height above deck 0 (and a change of deck, such as a fall, eases through `lift`); `LevelMesh` makes chunks per deck (key `(l*1000 + cy)*1000 + cx`; a ceiling under a deck above only where there is floor above, a skirt round a deck's slab at its edges and holes, walls that go down through the slab, the stair as a ramp);
    `LightField` has a layer per deck (light does not pass between them); `GridView` places doors, items, tosses and lights on their deck. **Picking only considers things on your own deck**, and windows, walls and floors are offered only from the first deck (see the gaps).
  * **Gaps.** The `windows / walls / floors` modules and built structures (girders) work on deck 0 only, so nobody can build or break anything on an upper deck (a pane on one only comes from a blueprint). There is no ladder or lift, no way to climb but stairs. Only people fall: an item put or thrown over a hole is placed on the deck below at once (`restDeck`), and nothing hurts whoever stands under the hole. Light does not pass down through a hole. The PDA map is of deck 0.
    The station has one deck; **making BoxStation two decks is content work this does not start.** `uitest` and `nettest` were not run (no Playwright here); the browser was checked by hand in the preview pane (the stair, the slope of the eye, the fall, a person and an item on the upper deck, picking).
  * **Tests:** `tools/decktest.mjs` (59, `npm run test:decks`): the model, walking, stairs and falls (damage, stun, the stair that takes the fall), what is on a deck is on that deck (items, reach, doors, hearing), air, pathfinding, the clients (snapshots, the replica, prediction against the server, the slope of a stair, light per deck), a ball flying about it, the physics shape, the debug menu's deck grid.
