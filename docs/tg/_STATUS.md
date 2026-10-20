# TG research notes: status and how to finish them

Last updated 2026-10-20 after the third sweep. Read `_BRIEF.md`, `_BRIEF_LISTS.md` and `_BRIEF_GAPS.md` for the rules the drones follow.

## Where it stands

* Sweep 1 (topics, 14 files), sweep 2 (item families and placed things, 12 files) and the third sweep (11 `gap-*.md` files, 9,762 lines, written by
  drones that each saved their notes in part files as they went) are all merged and pass `tools/tgcheck.py`.
* Every item definition the game has (916) is now documented. 96% of the 4,450 things placed on BoxStation are covered.
* **Still to do: 73 machines and structures**, listed as shards `_todo3/gap-things-06.txt` to `gap-things-11.txt` (14 each, the last 4). Mostly vending
  machines (16), R&D machines (11), suit storage units (9), power machines (7), smartfridges, pipe dispensers, the nuclear bomb, teleporter parts, filing
  cabinets, a doppler array. Run `python tools/tgplan.py` for the live list (it recounts from the notes).
* `/obj/machinery/power/apc/highcap` has no definition of its own in the DM (a map-only variant of `/obj/machinery/power/apc`).
* The game makes up three item paths TG 2020 does not have: `/obj/item/clothing/suit/space/emergency`, `/obj/item/clothing/head/helmet/space/emergency`
  (TG's equivalents are `.../space/orange`, in `code/modules/shuttle/emergency.dm:508-513`, and the plain `space` suit and helmet) and
  `/obj/item/storage/photo_album/prison`. Closets in `src/sim/actions.js` (`LOOT`) hand out the first two.

## Tools (all take absolute or repo-relative paths; none needs the tree to be the current directory)

| Tool | Use |
| --- | --- |
| `python tools/tgwhere.py /obj/item/foo ...` | file:line where each type is defined (top-level, nested by indentation, or introduced by a proc line); `--find word`, `--children path`. Fixes the old drones' false NOT FOUNDs. |
| `python tools/tgcheck.py LIST NOTE.md ...` | every list path present, no false NOT FOUND, every `file:line` citation (full and short form) in range, a `## Coverage` section. |
| `python tools/tgmerge.py gap-things-06 ...` | joins `_parts/<shard>.<n>.md` into `docs/tg/<shard>.md`, runs `tgcheck`, deletes the parts when clean (`--keep` keeps them). |
| `python tools/tgplan.py [--write DIR]` | recomputes what is undocumented and, with `--write`, cuts it into new shard lists. |

## To finish the last six shards

One Haiku drone per shard (`Agent`, `subagent_type: general-purpose`, `model: haiku`, background). Prompt, with the shard name filled in:

> You are a research drone documenting the tgstation (Space Station 13) DM source for a game port. Your first action: read C:/Users/Willi/Documents/GitHub/YAD3D/docs/tg/_BRIEF_GAPS.md, then the two files it tells you to read (_BRIEF.md and _BRIEF_LISTS.md in the same folder). Follow them exactly.
> Your shard is `gap-things-06`. Your list: C:/Users/Willi/Documents/GitHub/YAD3D/docs/tg/_todo3/gap-things-06.txt
> Your part files: C:/Users/Willi/Documents/GitHub/YAD3D/docs/tg/_parts/gap-things-06.1.md, gap-things-06.2.md, ... (write one after each sub-family, starting early).
> These are MACHINES and STRUCTURES, so use the section format of _BRIEF.md.
> Use tools/tgwhere.py to locate every type, and run tools/tgcheck.py until it prints CLEAN before you reply. Reply with only the part file paths, your Coverage numbers and the final tgcheck line.

Then `python tools/tgmerge.py gap-things-06` for each, and look at the `NOT FOUND with no own definition` lines it prints.

**Budget: a machinery drone costs about 7 to 8 points of the 5-hour plan window (an item drone about 5)**, and a Pro plan session died at the limit once
already. Check `get_usage` first and launch no more than three at a time; the window resets about five hours after it opened. The part files mean
a cut-off drone loses at most its last sub-family, and `tgmerge` can still join what exists (it will not be `CLEAN`, which is correct).

## What to trust

Spot checks of the third sweep (about 25 citations across eight files: air alarm power and integrity, stack parent values, glove strip delays, item defaults,
reagent container sizes, the door timer's two `Initialize()` definitions) all matched the DM. That is far better than the first two sweeps, which is credited to
`tgwhere` and to the checker, not to the model. Still grep the DM for any number you build on, and never treat a NOT FOUND as evidence.
