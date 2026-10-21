"""tgm-format .dmm parser: returns (grid, keys) where keys maps a key -> list of (path, vars) and grid[(x,y)] = key."""
import re

_atom = re.compile(r'(/[\w/]+)(?:\{(.*?)\})?$', re.S)


def _split_top(s, sep=','):
    out, depth, cur, instr = [], 0, [], False
    i = 0
    while i < len(s):
        c = s[i]
        if instr:
            cur.append(c)
            if c == '\\':
                i += 1
                cur.append(s[i])
            elif c == '"':
                instr = False
        elif c == '"':
            instr = True
            cur.append(c)
        elif c in '({[':
            depth += 1
            cur.append(c)
        elif c in ')}]':
            depth -= 1
            cur.append(c)
        elif c == sep and depth == 0:
            out.append(''.join(cur))
            cur = []
        else:
            cur.append(c)
        i += 1
    if cur:
        out.append(''.join(cur))
    return out


def _parse_vars(body):
    d = {}
    if not body:
        return d
    for part in _split_top(body, ';'):
        part = part.strip()
        if not part or '=' not in part:
            continue
        k, v = part.split('=', 1)
        d[k.strip()] = v.strip()
    return d


def parse(path):
    text = open(path, encoding='utf-8').read()
    keys = {}
    # key definitions: "aaa" = (\n...\n)
    for m in re.finditer(r'^"([A-Za-z]+)" = \(\n(.*?)\)\n(?=\n|"|\()', text, re.S | re.M):
        key, body = m.group(1), m.group(2)
        atoms = []
        for a in _split_top(body.replace('\n', ' ').replace('\t', ' ')):
            a = a.strip()
            if not a:
                continue
            mm = _atom.match(a)
            if not mm:
                continue
            atoms.append((mm.group(1), _parse_vars(mm.group(2))))
        keys[key] = atoms
    grid = {}
    for m in re.finditer(r'^\((\d+),(\d+),(\d+)\) = \{"\n(.*?)\n"\}', text, re.S | re.M):
        x0, y0, z = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if z != 1:
            continue
        rows = m.group(4).split('\n')
        # tgm: each row is one column x; each line is a key; lines are y from top (max y) to bottom
        n = len(rows)
        for i, key in enumerate(rows):
            grid[(x0, n - i)] = key  # y counted from bottom, 1-based
    return grid, keys


def dims(grid):
    xs = [p[0] for p in grid]
    ys = [p[1] for p in grid]
    return max(xs), max(ys)
