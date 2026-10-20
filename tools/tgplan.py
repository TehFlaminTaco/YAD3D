#!/usr/bin/env python3
"""What in the game is still not documented in docs/tg, cut into shards for drones.

    python tools/tgplan.py            # report the gap only
    python tools/tgplan.py --write docs/tg/_todo4     # also write shard list files there (refuses a directory that already has any)

The universe is every item definition in assets/level.json plus every distinct path placed on the map (structures, machinery, closets, wall
mounts, items). A path counts as documented when it appears in some docs/tg/*.md on a line that does not say NOT FOUND / unknown / further research.
Items are cut into shards of 28, machines and structures into shards of 14 (they cost about twice as much to document).
Each shard line is `DM path <TAB> in-game name <TAB> (xN on BoxStation)`; hand a drone `docs/tg/_BRIEF_GAPS.md` and one shard file.
"""
import collections
import glob
import json
import os
import re
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import tgwhere  # noqa: E402

PATH = re.compile(r'(/(?:obj|turf|mob|datum|area)/[A-Za-z0-9_/]+)')
BAD = re.compile(r'NOT FOUND|not found|unknown|not traced|further research', re.I)
ITEM_SHARD, THING_SHARD = 28, 14


def heavy(p):
    return p.startswith(('/obj/machinery', '/obj/structure', '/obj/docking_port', '/obj/effect', '/turf', '/mob'))


def main(argv):
    L = json.load(open(os.path.join(ROOT, 'assets', 'level.json'), encoding='utf-8'))
    names = {p: d['n'] for p, d in L['itemdefs'].items()}
    placed, pname = collections.Counter(), {}
    for p in L['props']:
        pth = p.get('p')
        if not pth:
            continue
        full = ('/obj/' + pth) if p['k'] in ('sprite', 'closet') else pth
        placed[full] += 1
        pname.setdefault(full, p.get('n') or '')

    good = set()
    for f in glob.glob(os.path.join(ROOT, 'docs', 'tg', '*.md')):
        if os.path.basename(f).startswith('_'):
            continue
        for line in open(f, encoding='utf-8', errors='replace'):
            if not BAD.search(line):
                good.update(p.rstrip('/') for p in PATH.findall(line))

    universe = set(names) | set(placed)
    gap = sorted(p for p in universe if p not in good)
    items = [p for p in gap if not heavy(p)]
    things = [p for p in gap if heavy(p)]
    n_placed = sum(placed.values())
    covered = sum(n for p, n in placed.items() if p in good)
    print(f'universe: {len(universe)} paths; documented: {len(universe) - len(gap)}; gap: {len(gap)} ({len(items)} items, {len(things)} machines/structures)')
    print(f'things placed on BoxStation: {n_placed}; covered by a documented path: {covered} ({100 * covered // max(1, n_placed)}%)')
    for k, n in collections.Counter('/'.join(p.split('/')[:4]) for p in gap).most_common(10):
        print(f'  {n:4d} {k}')
    no_def = [p for p in gap if not tgwhere.where(tgwhere.load(), p)[2]]
    if no_def:
        print(f'{len(no_def)} gap paths have no DM definition of their own (made up by the game, or map/macro-made): {no_def[:6]}')

    if '--write' in argv:
        out = argv[argv.index('--write') + 1]
        out = out if os.path.isabs(out) else os.path.join(ROOT, out)
        if os.path.isdir(out) and glob.glob(os.path.join(out, '*.txt')):
            print(f'{out} already has shard files; pick another directory')
            return 1
        os.makedirs(out, exist_ok=True)

        def line(p):
            c = placed.get(p)
            return f'{p}\t{names.get(p) or pname.get(p) or ""}' + (f'\t(x{c} on BoxStation)' if c else '')

        for lst, size, prefix in ((items, ITEM_SHARD, 'gap-items'), (things, THING_SHARD, 'gap-things')):
            for i in range(0, len(lst), size):
                name = f'{prefix}-{i // size + 1:02d}'
                with open(os.path.join(out, name + '.txt'), 'w', encoding='utf-8', newline='\n') as fh:
                    fh.write('# DM path <TAB> in-game name <TAB> how many are placed on BoxStation (if any)\n')
                    for p in lst[i:i + size]:
                        fh.write(line(p) + '\n')
                print('wrote', name, len(lst[i:i + size]))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
