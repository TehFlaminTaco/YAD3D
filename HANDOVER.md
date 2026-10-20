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
* **Git state (2026-10-20):** local `HEAD` is `d1b5a2a` (people interactions and the structure rework), **two commits ahead of `origin`** (`ca706f5`). On top of that
  the working tree holds a lot of **uncommitted work from two sessions that ran side by side**: the debug menu (13), the SS13-style inventory HUD (14), the observer fix, the
  rune placement fix, zero gravity (15), windows and grilles the TG way (17), door angles and wall mounts (18), the TG notes and their tools (16, `docs/`, `tools/tg*.py`).
  Files such as `sim.js`, `world.js`, `movement.js`, `hud.js` and `simtest2.mjs` carry both sessions' edits, so it cannot be split by file: **review `git status`, do not revert
  what you did not write, and commit it in one go (or ask the user how to split it) before building more.** Nothing has been pushed since `ca706f5`.
* **Tests (all pass now):** `node tools/simtest2.mjs` 339/339, `node tools/leveltest.mjs` 18/18, `node tools/simtest.mjs 12 --player` clean (a 12-minute shift). `node tools/uitest.mjs`
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
node tools/simtest2.mjs            # sanity: 339 passed
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
* **Determinism contract:** `buildPropData` (shared) derives doors, firelocks, props, lights, tables, panes from the level
  JSON in a fixed order, so index `i` means the same door/prop on server and client. Click targets use those indexes
  (`{k:'door', idx}`, `{k:'prop', idx}`). The emergency-shuttle overlay *appends* in the same order on both sides.
  Never reorder those lists.
* **Protocol** (client→server): `hello, input, click, key, inv, say, term, examine, lobby, ghost, mirror, strip, stuff` (+ `ping`; `dbg` is ignored unless the sim was started with
  `debug`). (server→client): `welcome` (world state, `moved` structures, `gravity`, `debug`), `snap` (10 Hz mob positions, `ack`, `you`, `env`) and `ev` batches (`door, fdoor, tile, cl, pane,
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
* **Coordinates:** 1 tile = 2 m (`TILE`), world x = col·2, z = row·2, north = −z, yaw 0 faces north (forward = (−sin, −cos)).
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
| Sim logic (no browser) | `node tools/simtest2.mjs` | 339 assertions, seconds. Add a `section()` for any new server rule. Sections: spawn, inventory, combat, doors, breaches, closets, characters, people, structures, observers, debug menu, door angles and wall mounts, zero gravity, windows and grilles, chat, consoles, drag and drop, death. |
| Long soak | `node tools/simtest.mjs 12 --player` | a 12-minute simulated shift, ~4 s |
| Browser UI (local round) | `node tools/uitest.mjs` | needs :8123 static server; ~4 min; `BASE=`, `SHOTS=` env; drives the real mouse/keyboard |
| Closets, people (in simtest2) | `node tools/simtest2.mjs` | the `closets` section: DM contents, locks, welding, breakout, personal lockers; the `people` section: handcuffs, strip window, pockets, grabs, examine, stuffing |
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
src/shared/                   config.js (constants, slot list), world.js (tiles, collision, free-standing boxes), movement.js (stepMovement, gravity and drift),
                              door.js, atmos.js, power.js, body.js, items.js (behaviour table, storage rules), chat.js, jobs.js, looks.js (characters),
                              closets.js, windows.js (window state), propdata.js (props, door angles, mounts, moveProp), nav.js, leveldata.js, util.js
src/sim/                      sim.js (loop, clients, snapshots, handle()), actions.js (clicks, combat, drag/throw, examine), inventory.js, round.js, director.js
                              (meteors, power failure, carp, shuttle), terminals.js, chatsys.js, ai.js, firedoors.js, mob.js, jobs.js, closets.js, people.js
                              (handcuffs, grabs, dragging, strip window), windows.js (taking windows and grilles apart), debug.js (the debug menu's operations)
src/render/                   level.js (terrain meshes), sprites.js (instanced batches), materials.js (shaders), lighting.js
src/client/                   main.js, game.js, net.js, state.js (Replica), view.js (WorldView), input.js, audio.js, assets.js, charart.js, bodyview.js, and the
                              interface files: hands, bags, invhud (HUD), strip, debugmenu, charedit, pda, effects, hud (runes), chatui, terminalui, lobby, screens
css/                          style.css (in-game), screens.css (lobby, consoles, help, report)
tools/                        build_*.py (data pipeline), serve.py, shot.mjs, simtest*.mjs, leveltest.mjs, uitest.mjs, nettest.mjs, tgwhere/tgcheck/tgmerge/tgplan.py
assets/ data/ vendor/         generated art/sound/level data (committed), jobs data, vendored three.js r170
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
