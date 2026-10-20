# Brief for the TG research bots

YAD3D is a first-person Space Station 13 in the browser, built on the real BoxStation map. We are about to implement real
construction, deconstruction, power and machines. Your job is to **read the Space Station 13 (tgstation) DM source and
write down exactly how a topic behaves**, so that someone can port it later without reading the DM themselves. You do not
write game code.

## Where the source is

* **Primary: `C:/Users/Willi/Documents/GitHub/YAD3D/_src/tg2020`** (tgstation at commit `2d6c10c1`, 2020-07-06). This is the exact
  tree our map, sprites and item paths came from. Document THIS version. BoxStation is
  `_maps/map_files/BoxStation/BoxStation.dmm`.
* **Cross-check only: `C:/Users/Willi/Downloads/tgstation-1da0b5547e02db0db48d0bc93926c26bd8888347/tgstation-1da0b5547e02db0db48d0bc93926c26bd8888347`**
  (a newer snapshot; it has no BoxStation). Use it only to say "DIFF vs newer: ..." in one line when a behaviour you
  documented has clearly changed. Do not let it override the primary tree.
* Use the Read, Grep and Glob tools with absolute paths. **Never `cd` into either tree.**

## What we have (document these, and whatever they need to work)

Two inventories of what our game already contains:
* `docs/tg/_ours-structures.txt`: DM path of every structure/machine placed on BoxStation, with how many.
* `docs/tg/_ours-items.txt`: every item type the game knows, with its in-game name.

Start from the entries in your topic. Follow their parent classes (`/obj/machinery`, `/obj/structure`, `/obj/item`...) far
enough to know the inherited behaviour that matters, and follow their construction frames/assemblies/circuit boards.

## Rules (the last bots got these wrong, so read them)

1. **Numbers stay as they are in the source.** Time in the DM is in **deciseconds** (10 ds = 1 second). Write
   `delay = 40 (ds)`, **never convert** it to seconds. Same for `max_integrity`, damage, `amount`, power in watts, etc.:
   quote the literal and say what it is.
2. **Every number, message and fact carries `file:line`** (path relative to the tree root, e.g.
   `code/game/objects/structures/window.dm:312`). Look at the line before you cite it.
3. **Messages are quoted verbatim** from the DM (`to_chat`, `user.visible_message`, `span_notice`, `<span class='notice'>`...).
   Keep the `[variables]` as they appear. Do not paraphrase a string.
4. **Never invent.** If you cannot find it, write `NOT FOUND` and where you looked. If you are inferring something, mark it
   `(inferred)`. Do not describe a tool or action "generically"; say which proc handles it and what it does.
5. Do not mix up which delay belongs to which action. Put each delay next to the proc call that uses it
   (`I.use_tool(src, user, 40, volume=50)` means 40 ds for that one action).
6. If a thing is a subtype that overrides the parent, say which values come from the parent and which are overridden.
7. **Write only your own file**, `docs/tg/<name>.md` as given in your assignment. Do not edit, create or delete anything else.
   Do not read our game code (`src/`): you are documenting TG, not us.

## Format of the file

Start with a 5-line summary of the topic. Then one section per thing:

```
### <In-game name>  `/obj/path/in/dm`   (file:line of the type definition)
- What it is, in a sentence
- Key vars: name = value  (file:line)
- Interactions (every tool/item/intent that does something):
  | held item / action | condition | delay (ds) | message(s) verbatim | result |
- Construction chain: ordered steps, each with tool, delay, materials and amounts, messages
- Deconstruction chain: ordered steps, same detail
- Drops: exactly what `new /obj/...` / `drop_location` lines run when it is (a) destroyed/broken and (b) deconstructed
  properly; they are usually different. Say what stays behind.
- Health / armor: max_integrity, armor, damage_deflection, what damage types do
- Power: use_power, idle_power_usage, active_power_usage (W), or "none"
- Gotchas: anything surprising (flags, `anchored` rules, access checks, "only if unpowered", "must be welded first"...)
```

End the file with:
* `## Minimum viable port`: at most 10 bullets, what a first implementation must include to feel right.
* `## NOT FOUND / open questions`.

Be dense, not chatty. Tables over prose. 200 to 500 lines is the right size; stop when the topic is covered, do not pad.
When you finish, reply with just the path of your file and a three-line summary.
