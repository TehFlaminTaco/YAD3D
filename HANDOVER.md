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
* **Tests, all green at the last commit:** `node tools/simtest2.mjs` 51/51, `node tools/uitest.mjs` 191/191 (about 4 min),
  `node tools/nettest.mjs` 29/29. (The browser and multiplayer suites were last run just before the final two commits; the
  later changes were small and covered by the sim suite, but re-run everything before you say "all green".)
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
* **"It says to pick an occupation, but I can't see how?"** Cause found and fixed (below) but **never confirmed with the
  user**. If they come back with it again, ask for window size and browser zoom, then reproduce at exactly that size.
* They asked for SS13 assets to be used freely, and for **BoxStation, not Meta**.

## 3. Getting set up

```sh
git clone https://github.com/TehFlaminTaco/YAD3D && cd YAD3D && git checkout claude/yad3d-game
npm install                        # three (vendored copy is what the page loads), ws
node tools/simtest2.mjs            # sanity: 51 passed
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
  (`door, fdoor, tile, pane, item+, item-, toss, mob+, mob-, self, msg, snd, beam, power, area, flicker, prog, term, round,
  alert, report, ghost, evac, shake, hurt, bubble`). Events have scopes (all / one client / near a point / ghosts). **A
  `snap` is sent before the same step's `ev` batch**, so the client must tolerate a snapshot that mentions a mob it hasn't
  heard of yet, and `self` being null for a tick after spawning.
* **Items** live in exactly one place (`item.loc`: floor | hand | slot | box). Everything that moves an item goes through
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
* **Lobby narrow-window fix:** below 960 px page width the lobby used to squeeze the job board to nothing (94 px wide at
  720 px, 14 px at 640 px) because a strip was reserved for chat. `css/screens.css` now has a `@media (max-width: 960px)`
  block: full-width board, Ready/Start/Observe in a row above it, crew list hidden, chat reduced to one bar.

## 6. Testing and debugging

| What | Command | Notes |
| --- | --- | --- |
| Sim logic (no browser) | `node tools/simtest2.mjs` | 51 assertions, seconds. Add a `section()` for any new server rule. |
| Long soak | `node tools/simtest.mjs 12 --player` | a 12-minute simulated shift, ~4 s |
| Browser UI (local round) | `node tools/uitest.mjs` | needs :8123 static server; ~4 min; `BASE=`, `SHOTS=` env; drives the real mouse/keyboard |
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

1. **Confirm the lobby fix with the user** (section 2). Also worth an in-person check of the lobby at 1366×657 and at 150–200%
   browser zoom.
2. **Nothing in a real browser has been verified for pointer lock or sound.** Headless runs fake the lock (`?nolock`) and have
   no audio. Specifically unverified: Esc-to-free-mouse landing in hands mode; re-locking from a key press after a window
   closes (`requestPointerLock` needs a user gesture; the code falls back to Space/click); `audio.ensure()` on first click.
   If you have any way to test this in headed Chrome, do.
3. **The review of the new UI was only half done.** The drag-and-drop *server* code got a manual review (2 bugs fixed). Not
   yet reviewed: (a) the mode/state machine in `game.js` (`applyMode/enterHands/enterLook/panelsChanged/closeTop/setPhase`)
   for ways to get stuck with a free or captured mouse, keys firing while typing in the lobby name field or chat, ghost/lobby
   transitions leaving panels up; (b) `hands.js`/`effects.js`/`art.js`/`hud.js` robustness and per-frame cost (`rayAt` and
   `lookRay` allocate vectors every frame; runechat does an LOS test per speaking mob per frame; the visor canvas is redrawn
   on resize). The earlier plan was three independent reviewers plus a skeptic pass per finding.
4. **Known gaps** (also in the README): windoors are drawn but don't block movement; NPC crew keep their roundstart sprite
   when clothes change; no antagonists/chemistry/botany/cooking/construction (scope decision, not an oversight); look mode
   doesn't work on touch devices.
5. **Small things noticed:** a throw within the 0.5 s cooldown silently does nothing after the drag ghost vanishes (no
   feedback); `tools/preview_ui.html` is a leftover dev page for eyeballing procedural art (works with the static server);
   the lobby's "pick one, then Ready" hint disappears during a running round by design.
6. **Ideas the user hasn't asked for** (do not start these unprompted): typed station announcements from the comms console
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
