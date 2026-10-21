# Brief for the gap drones (third sweep)

Read `docs/tg/_BRIEF.md` (rules, formats) and `docs/tg/_BRIEF_LISTS.md` (what to record per item) first. All their rules apply. This
file only adds what went wrong last time and how you work now. Paths below are absolute because you must not `cd` anywhere.

* Repo: `C:/Users/Willi/Documents/GitHub/YAD3D`
* DM source you document: `C:/Users/Willi/Documents/GitHub/YAD3D/_src/tg2020` (cite paths relative to it: `code/game/...dm:123`)

## What went wrong before, and the two tools that fix it

Earlier drones reported `NOT FOUND` for types that exist (`/obj/item/assembly/igniter`, `/obj/item/camera_film`, `/obj/item/clothing/under/color/rainbow`,
`/obj/item/clothing/head/frenchberet`...): 83 of 88 such claims were false. They also ran out of session before writing anything.

1. **Find every type with `tgwhere`.** Run
   `python C:/Users/Willi/Documents/GitHub/YAD3D/tools/tgwhere.py /obj/item/foo /obj/item/bar ...` (many paths at once). It prints `path  file:line`, the line
   that defines the type (top-level or nested by indentation, or introduced by a proc line). **If it prints a location the type exists: read that file at
   that line and document it. You may never write NOT FOUND for a path it locates.** `NO OWN DEFINITION ... nearest defined ancestor X` means the type is
   a map-only variant (or made by a macro): document X's values, say it inherits them, and still give the path its own entry. `tgwhere.py --find word`
   lists defined types containing a word; `--children /obj/item/foo` lists the subtypes. (Git Bash rewrites a leading `/obj/...`; the tool undoes that.)
2. **Check yourself with `tgcheck` before you reply.** Run
   `python C:/Users/Willi/Documents/GitHub/YAD3D/tools/tgcheck.py <your list file> <your part files...>`
   It reports list paths missing from your notes, false NOT FOUNDs, citations to files or lines that do not exist, and a missing `## Coverage`.
   Fix everything it reports (edit a part or add a new one) and run it again until it prints `CLEAN`.

## How you write (so a cut-off loses nothing)

* Work through your list in order, a sub-family (about 6 to 10 entries) at a time.
* **After each sub-family, create a part file with the Write tool** at `C:/Users/Willi/Documents/GitHub/YAD3D/docs/tg/_parts/<shard>.<n>.md`
  (`<shard>` is your list's name, `<n>` = 1, 2, 3...). Never rewrite an earlier part; add a new one. Write your first part within your first few tool calls.
* The last part ends with `## Coverage`: entries on the list, entries documented with real data, entries marked NOT FOUND (should be 0 or tiny), and one line
  per path you could not locate with the exact `tgwhere` output.
* Write only your own part files. Do not touch anything else. Do not read the game's own code (`src/`).

## What an entry looks like

Items: the columns of `_BRIEF_LISTS.md` ("What to record per item"): final `name`, `desc`, `w_class`, `slot_flags`, `force`, armor numbers, `strip_delay`,
what `attack_self` / `afterattack` / `attackby` do (messages verbatim, delays raw in ds), contents and reagent amounts, and which values come from a parent.
Machines and structures: the section format of `_BRIEF.md` (interactions table with held item, delay in ds and verbatim messages; construction and deconstruction
chains; what drops when broken versus deconstructed; health and armor; power in watts; gotchas). Variants that differ only by name, colour, icon or a few
numbers may share a block with their parent as long as each path is written out and the differing values are given.

Numbers stay raw (deciseconds, never converted). Every number and every message carries `file:line`. Quote strings verbatim. Never invent: mark an
inference `(inferred)`.

## Your reply

Only: the paths of your part files and your `## Coverage` numbers, and the final `tgcheck` line.
