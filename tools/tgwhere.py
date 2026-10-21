#!/usr/bin/env python3
"""Where is a DM type defined?  Used by the TG research notes (docs/tg) so nobody has to guess "NOT FOUND".

    python tools/tgwhere.py /obj/item/assembly/igniter /obj/item/clothing/under/color/rainbow   (or without the leading slash: Git Bash mangles it)
    python tools/tgwhere.py --find rainbow            # every defined type whose path contains "rainbow"
    python tools/tgwhere.py --children /obj/item/clothing/under/color

Prints `path  code/relative/file.dm:line` (relative to the tree root, the form the notes cite) for the line that defines the type,
top-level (`/obj/item/foo`) or nested by indentation (`/obj/item/foo` then a tab and `bar`, which is `/obj/item/foo/bar`).
If a path has no definition it says so and names the nearest ancestor that has one. The index is cached in
`<tree>/.tgwhere.json` (rebuilt when missing or older than the newest .dm file).
"""
import json
import os
import re
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
TREE = os.environ.get('YAD_TREE', os.path.join(ROOT, '_src', 'tg2020'))
CODE = os.path.join(TREE, 'code')
CACHE = os.path.join(TREE, '.tgwhere.json')

_top = re.compile(r'^(/[A-Za-z0-9_/]+)\s*(?://.*)?$')
_nest = re.compile(r'^(\t+)(/?[A-Za-z0-9_]+(?:/[A-Za-z0-9_]+)*)\s*(?://.*)?$')
_KEYWORDS = {'var', 'proc', 'verb', 'if', 'else', 'for', 'while', 'do', 'switch', 'return', 'set', 'spawn', 'break', 'continue',
             'new', 'del', 'in', 'to', 'step', 'goto', 'sleep', 'try', 'catch', 'throw', 'static', 'const', 'global', 'tmp'}


def dm_files():
    out = []
    for dp, _, fn in os.walk(CODE):
        for f in fn:
            if f.endswith('.dm'):
                out.append(os.path.join(dp, f))
    return sorted(out)


def build():
    defs = {}
    for f in dm_files():
        rel = os.path.relpath(f, TREE).replace('\\', '/')
        try:
            lines = open(f, encoding='utf-8', errors='replace').read().split('\n')
        except OSError:
            continue
        stack = []      # [(indent, path)]
        for i, ln in enumerate(lines):
            if not ln.strip() or ln.lstrip().startswith(('//', '#')):
                continue
            m = _top.match(ln)
            if m:
                path = m.group(1).rstrip('/')
                stack = [(0, path)]
                defs.setdefault(path, f'{rel}:{i + 1}')
                continue
            if ln[0] == '/':               # a proc or var on a type path, e.g. /obj/foo/proc/bar() or /obj/foo/var/x = 1: the type exists too
                stack = []
                mm = re.match(r'^(/[A-Za-z0-9_/]+?)/(?:proc|verb|var)/', ln) or re.match(r'^(/[A-Za-z0-9_/]+)/[A-Za-z0-9_]+\(', ln)
                if mm and mm.group(1).count('/') >= 2:
                    defs.setdefault(mm.group(1), f'{rel}:{i + 1}')
                continue
            m = _nest.match(ln)
            if not m or not stack:
                continue
            indent = len(m.group(1))
            name = m.group(2)
            first = name.strip('/').split('/')[0]
            if first in _KEYWORDS:
                continue
            # a nested type has a block under it: the next code line is indented deeper
            j = i + 1
            while j < len(lines) and (not lines[j].strip() or lines[j].lstrip().startswith('//')):
                j += 1
            if j >= len(lines) or len(lines[j]) - len(lines[j].lstrip('\t')) <= indent:
                continue
            while stack and stack[-1][0] >= indent:
                stack.pop()
            if not stack:
                continue
            path = stack[-1][1].rstrip('/') + '/' + name.strip('/')
            stack.append((indent, path))
            defs.setdefault(path, f'{rel}:{i + 1}')
    return defs


def load():
    newest = max((os.path.getmtime(f) for f in dm_files()), default=0)
    if os.path.exists(CACHE) and os.path.getmtime(CACHE) >= newest:
        try:
            return json.load(open(CACHE, encoding='utf-8'))
        except (OSError, ValueError):
            pass
    defs = build()
    try:
        json.dump(defs, open(CACHE, 'w', encoding='utf-8'))
    except OSError:
        pass
    return defs


def where(defs, path):
    path = path.rstrip('/')
    if path in defs:
        return path, defs[path], True
    p = path
    while p.count('/') > 1:
        p = p.rsplit('/', 1)[0]
        if p in defs:
            return p, defs[p], False
    return None, None, False


def norm(arg):
    """Git Bash turns an argument like /obj/item/x into C:/Program Files/Git/obj/item/x; undo that (a path without the leading slash works too)."""
    m = re.search(r'(?:^|/)((?:obj|turf|mob|datum|area)/.+)$', arg.replace(chr(92), '/'))
    return '/' + m.group(1) if m else arg


def main(argv):
    if not argv:
        print(__doc__)
        return 1
    defs = load()
    if argv[0] == '--find':
        needle = argv[1].lower()
        for p in sorted(defs):
            if needle in p.lower():
                print(f'{p}  {defs[p]}')
        return 0
    if argv[0] == '--children':
        base = norm(argv[1]).rstrip('/') + '/'
        for p in sorted(defs):
            if p.startswith(base):
                print(f'{p}  {defs[p]}')
        return 0
    for path in map(norm, argv):
        p, loc, exact = where(defs, path)
        if exact:
            print(f'{path}  {loc}')
        elif p:
            print(f'{path}  NO OWN DEFINITION (it may be a map-only or macro-made type); nearest defined ancestor {p}  {loc}')
        else:
            print(f'{path}  NO DEFINITION and no defined ancestor')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
