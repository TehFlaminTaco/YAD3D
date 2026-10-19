# Handover

Written for the next Claude instance picking this project up. Read this first, then `README.md` (what it is and how to
play it) and `ATTRIBUTION.md` (where the art, sound, data and fonts come from). Everything here was true when it was
written; check `git log` for anything newer.

## 1. Where things stand

**YAD3D** ("Yet Another Dead 3D") is a first-person, multiplayer Space Station 13 on the real BoxStation map, in the
browser. It works end to end and is pushed.

* **Branch** `claude/yad3d-game` on `TehFlaminTaco/YAD3D`, open as **[PR #1](https://github.com/TehFlaminTaco/YAD3D/pull/1)**
  into `main` (which holds only an "Initial commit"). Pushing to the branch updates the PR. The user said not to worry about
  the repo's original Unlicense: the project is now **AGPL-3.0** (`LICENSE`), art and sound CC BY-SA 3.0.
* **Tests:** `node tools/simtest2.mjs` 127/127 and `node tools/leveltest.mjs` 18/18 pass now. `node tools/uitest.mjs` (191/191,
  about 4 min) and `node tools/nettest.mjs` (29/29) were last run before the window work, and **could not be run in the
  Windows session that did it** (Playwright path below): re-run both before you say "all green". The window change touches
  tile events (`brk`) and rendering, so the multiplayer suite is the one most worth running.
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
* **"The hands should DEFINITELY have dorky springy animation."** They do (spring physics, squash/stretch). Keep it dorky.
* **"It says to pick an occupation, but I can't see how?"** Cause found and fixed (section 5), and the user has
  since confirmed the fix. If it ever comes back, ask for window size and browser zoom, then reproduce at exactly that size.
* They asked for SS13 assets to be used freely, and for **BoxStation, not Meta**.
* The lobby fix, pointer lock and sound were all checked in a real browser and are **confirmed good**. Touch support is
  explicitly a non-consideration.
* **Windows.** "Straight windows … appear as just thin lines between walls", and "many otherwise solid windows show space
  underneath, when they should show the correct tile (and grille?)". Fixed in `src/render/level.js` (section 5); the grille
  is **not** done (section 8).

## 3. Getting set up

```sh
git clone https://github.com/TehFlaminTaco/YAD3D && cd YAD3D && git checkout claude/yad3d-game
npm install                        # three (vendored copy is what the page loads), ws
node tools/simtest2.mjs            # sanity: 127 passed
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
* **Protocol** (client→server): `hello, input, click, key, inv, say, term, examine, lobby` (+ `ping`; `dbg` only with
  `--debug`). (server→client): `welcome` (world state), `snap` (10 Hz mob positions, `ack`, `you`, `env`), `ev` batches
  (`door, fdoor, tile, cl, pane, item+, item-, toss, mob+, mob-, self, msg, snd, beam, power, area, flicker, prog, term, round,
  alert, report, ghost, evac, shake, hurt, bubble`). Events have scopes (all / one client / near a point / ghosts). **A
  `snap` is sent before the same step's `ev` batch**, so the client must tolerate a snapshot that mentions a mob it hasn't
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
  hands (`[data-hand]`), bag cells (`#bags .cell`), body-panel slots (`#body .slot`). Drops resolve (in order): container
  → hand → slot → bag window → the world (use on a person/door/machine if held in a hand; put down at `floorPoint`; else
  throw at the aim point). While dragging, `view.setDropMarker` shows a green (set down) or red (throw) ring.
  Server ops: `inv` `move` (to hand/slot/box/floor-with-x,z; from floor too) and `inv` `throw {at:[x,y,z]}`.
* **Hands:** `hands.js` + `art.js:paintHand`. Art is painted procedurally to a 64×72 canvas and scaled by CSS var `--h`;
  held items are the real sprite at 2×. Each hand has five springs (x, y, rot, sx, sy) integrated in **fixed 1/120 s
  substeps** (frame-rate independent); gestures are `hands.bump(i, kind)` kicks (`use, swing, throw, catch, drop, wiggle,
  swap, step`). Tune feel in `bump()` and the stiffness/damping in `update()`.
* **Other pieces:** `bags.js` (container windows), `bodypanel.js` (`I`: paper doll + SS13 health doll + buttons),
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
  a hull breach: alarms, carp, the engineering radio call-out, the round report, the PDA colour (red vs amber), the
  hover name ("hull breach" vs "broken window") and the screen shake/flicker all use it (`World.ventTiles()`).
  `world.breached` is now "every smashed window"; the tile event carries `brk` so clients keep the same set. Atmos
  rebuilds its topology (`Atmos.tileChanged`); a cell beside a venting broken window counts as a sink, which keeps
  decompression about as hard as when the hole was a space tile. Welding a plate still turns it into a wall.
* **Lobby narrow-window fix:** below 960 px page width the lobby used to squeeze the job board to nothing (94 px wide at
  720 px, 14 px at 640 px) because a strip was reserved for chat. `css/screens.css` now has a `@media (max-width: 960px)`
  block: full-width board, Ready/Start/Observe in a row above it, crew list hidden, chat reduced to one bar.

## 6. Testing and debugging

| What | Command | Notes |
| --- | --- | --- |
| Sim logic (no browser) | `node tools/simtest2.mjs` | 127 assertions, seconds. Add a `section()` for any new server rule. |
| Long soak | `node tools/simtest.mjs 12 --player` | a 12-minute simulated shift, ~4 s |
| Browser UI (local round) | `node tools/uitest.mjs` | needs :8123 static server; ~4 min; `BASE=`, `SHOTS=` env; drives the real mouse/keyboard |
| Closets, people (in simtest2) | `node tools/simtest2.mjs` | the `closets` section: DM contents, locks, welding, breakout, personal lockers; the `people` section: handcuffs, strip window, pockets, grabs, examine, stuffing |
| Level mesh geometry | `node tools/leveltest.mjs` | no browser or WebGL; 18 assertions: glass, floor, grille, smashed windows, the character art data |
| Multiplayer | `node tools/nettest.mjs` | spawns `server/index.js` on :8191 with `--debug`, three browsers |
| Screenshots | `node tools/shot.mjs "<query>" <prefix> --w 1280 --h 720 --steps '[…]'` | per step runs: `eval`, then `key`/`down`/`up`/`click`, then `wait`, then `snap` |

* **Page query params:** `nolock`, `norender` (skip WebGL draw: use it with several pages), `auto` (+`&job=<id>`) skips the
  lobby, `bots=N`, `autostart=SECONDS`, `lag=MS`, `local` (force an in-page round even when a server answers), `fullbright`,
  `name=`, `god`. `window.yad` is the `Game`; in local mode `yad.conn.sim` is the live `Sim` (teleport mobs, spawn items,
  hurt the player, call `yad.conn.sim.director.finish('shuttle')`, open consoles via `sim.terminals.open(...)`).
* **Server flags:** `--port --bots --autostart --name --endDelay --max --debug`. `--debug` enables `{t:'dbg',op:'tp'|'kill'|'finish'|'tile'}`
  messages: **never use on a public server**.
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
* A safety check blocks `rm`/`rmdir` of workspace directories, and **`pkill -f` with a pattern that appears in your own command
  line kills your own shell.** Avoid both.
* The **Workflow** (multi-agent) tool is for when the user opts in ("ultracode"/"use a workflow"). Subagents burn usage fast;
  a workflow was cut off by a usage limit once (its restyle and docs agents finished, its test and review agents didn't, and
  the rest was redone by hand).

## 8. Open items, roughly in priority order

1. **Re-run `uitest` and `nettest`** (see section 1) and look at windows, closets and other people in a real two-player session:
   those were only checked by `simtest2`, `leveltest` and the in-app browser (single player, local round). The new `look`
   and `mob+ ap` events and the `chars.png` download are the parts most worth a multiplayer check.
2. *(Done: lobby fix, pointer lock and sound were checked in a real browser by the user; grille under windows; closets.)*
3. **The review of the new UI was only half done.** The drag-and-drop *server* code got a manual review (2 bugs fixed). Not
   yet reviewed: (a) the mode/state machine in `game.js` (`applyMode/enterHands/enterLook/panelsChanged/closeTop/setPhase`)
   for ways to get stuck with a free or captured mouse, keys firing while typing in the lobby name field or chat, ghost/lobby
   transitions leaving panels up; (b) `hands.js`/`effects.js`/`art.js`/`hud.js` robustness and per-frame cost (`rayAt` and
   `lookRay` allocate vectors every frame; runechat does an LOS test per speaking mob per frame; the visor canvas is redrawn
   on resize). The earlier plan was three independent reviewers plus a skeptic pass per finding.
4. **Known gaps** (also in the README): windoors are drawn but don't block movement; no antagonists/chemistry/botany/cooking/construction (scope decision, not an oversight). Look mode
   doesn't work on touch devices; the user said that is a non-consideration.
5. **Small things noticed:** a throw within the 0.5 s cooldown silently does nothing after the drag ghost vanishes (no
   feedback); `tools/preview_ui.html` is a leftover dev page for eyeballing procedural art (works with the static server);
   the lobby's "pick one, then Ready" hint disappears during a running round by design.
6. **Roadmap the user agreed (2026-10-19), in this order.** Research for it came from eight Haiku drone reports over the 2020 TG
   source (see the memory note about checking their numbers). (1) Foundations + closets/lockers/crates: **done**, except body bags. Still to build for the foundations: a generic tool dispatch
   (`startTimed` now takes `{start, stop}` messages and `welderReady` mirrors SS13's tool check), stacks (merge, split, craft
   menu), mutable tiles/structures beyond closets. (2) **Dynamic character sprites** (DONE, see section 10): compose a human at runtime in the
   browser from the layered DMIs (what `tools/build_mobs.py` does at build time: greyscale body parts tinted by skin, uniform,
   shoes, gloves, suit, eyes, `human_face.dmi` hair, mask, head; 176 hair styles, 36 facial hair, 31 underwear, 55
   undershirts, 33 socks), so worn clothes show on everyone; then a setup screen with a live preview, **mirrors on the map**
   (10 on BoxStation; change hair there) and **your body visible when looking down**. The user does *not* want a third-person
   toggle. Save characters in `localStorage`. (3) People interactions (DONE, see section 11): strip menu, handcuffs, grab states, pulling, resist, examine text,
   stuffing people into closets; **buckling and body bags were left out**. (4) Item
   interactions: welder, extinguisher, lights, medical (bruise pack heals 40, 4 s on yourself / 2 s on someone), food and
   hunger, vending machines (79 on the map). (5) Construction: girders/walls (2 metal, 4 s), windows, floor tiles, tables,
   airlock assemblies, the stack craft menu.
7. **Ideas the user hasn't asked for** (do not start these unprompted): typed station announcements from the comms console
   (it currently has no text input, so the canned announcement button was removed), more consoles, headset/radio sounds.

## 9. Map of the code

```
index.html                    page shell: boot overlay, canvas#view, two stylesheets, src/client/main.js
server/index.js               static files (allow-listed dirs) + /server.json + WebSocket host + round reset
src/shared/                   config.js (constants, slot list), world.js, movement.js, door.js, atmos.js, power.js,
                              body.js, items.js (behaviour table, storage rules), chat.js, jobs.js, propdata.js, nav.js,
                              leveldata.js (decode level.json), util.js
src/sim/                      sim.js (loop, clients, snapshots, handle()), actions.js (clicks, combat, drag/throw,
                              examine), inventory.js, round.js (lobby/rounds), director.js (meteors, power failure,
                              carp, shuttle), terminals.js (console programs), chatsys.js, ai.js, firedoors.js, mob.js
src/render/                   level.js (terrain meshes), sprites.js (instanced batches), materials.js (shaders), lighting.js
src/client/                   main.js, game.js, net.js, state.js (Replica), view.js (WorldView), input.js, audio.js, assets.js,
                              + the interface files listed in section 5
css/                          style.css (in-game), screens.css (lobby, consoles, help, report)
tools/                        build_*.py (data pipeline), serve.py, shot.mjs, simtest*.mjs, uitest.mjs, nettest.mjs
assets/ data/ vendor/         generated art/sound/level data (committed), jobs data, vendored three.js r170
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
  who is down also slows you unless your grip is aggressive or better. The body panel shows SS13's own `pull` icon while you drag (SS13 draws nothing otherwise).
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
