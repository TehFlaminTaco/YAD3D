"""Closets, lockers and crates for the level build.

* `Populate` reads every `/obj/structure/closet.../PopulateContents()` in the DM source and flattens it, with its
  `..()` chain, into [item path, count, chance %, stack amount] rows (data/closets.json).
* `frames()` composes the sprites a closet shows: closed, closed+locked, welded, welded+locked and open.
"""
import glob
import os
import re

CLOSET_ROOT = '/obj/structure/closet'


def _indent(line):
    return len(line) - len(line.lstrip('\t'))


class Populate:
    def __init__(self, tree):
        self.procs = {}          # path -> ops
        self.unsupported = {}    # path -> [statements we could not read]
        for f in glob.glob(os.path.join(tree, 'code', '**', '*.dm'), recursive=True):
            try:
                lines = open(f, encoding='utf-8', errors='replace').read().split('\n')
            except OSError:
                continue
            i = 0
            while i < len(lines):
                m = re.match(r'^(/obj/structure/closet[\w/]*)/PopulateContents\(\)\s*(//.*)?$', lines[i])
                if not m:
                    i += 1
                    continue
                j = i + 1
                while j < len(lines) and (lines[j].startswith('\t') or not lines[j].strip()):
                    j += 1
                bad = []
                self.procs[m.group(1)] = self._block([l.rstrip() for l in lines[i + 1:j]], 1, 100, bad)
                if bad:
                    self.unsupported[m.group(1)] = bad
                i = j

    # -- parsing ------------------------------------------------------------------------------
    def _block(self, lines, mult, prob, bad):
        ops, i, last_prob = [], 0, None
        while i < len(lines):
            raw = lines[i]
            s = raw.strip()
            if not s or s.startswith('//'):
                i += 1
                continue
            ind = _indent(raw)
            j = i + 1
            while j < len(lines) and (not lines[j].strip() or _indent(lines[j]) > ind):
                j += 1
            child = lines[i + 1:j]
            # a multi-line `var/static/items_inside = list(` has its rows at the same indent: read to the closing )
            m = re.match(r'^var/static/(\w+)\s*=\s*list\(\s*(.*)$', s)
            if m:
                text, k = m.group(2), i + 1
                while ')' not in text and k < len(lines):
                    text += ' ' + lines[k].strip()
                    k += 1
                self._lists = getattr(self, '_lists', {})
                self._lists[m.group(1)] = [(p, int(n)) for p, n in re.findall(r'(/[\w/]+)\s*=\s*(\d+)', text)]
                i = k
                continue
            m = re.match(r'^generate_items_inside\(\s*(\w+)', s)
            if m:
                for p, n in getattr(self, '_lists', {}).get(m.group(1), []):
                    ops.append({'p': p, 'n': n * mult, 'pr': prob})
                i = j
                continue
            if s in ('..()', '. = ..()', '.=..()'):
                ops.append({'super': True})
            elif re.match(r'^new\s+/', s):
                m = re.match(r'^new\s+(/[\w/]+)\s*\(\s*src\s*(?:,\s*([^)]*))?\)', s)
                if m:
                    op = {'p': m.group(1), 'n': mult, 'pr': prob}
                    if m.group(2) and m.group(1).startswith('/obj/item/stack'):
                        am = re.match(r'\s*(\d+)', m.group(2))
                        if am:
                            op['amt'] = int(am.group(1))
                    ops.append(op)
                else:
                    bad.append(s)
            elif re.match(r'^if\s*\(prob\((\d+)\)\)', s):
                pr = int(re.match(r'^if\s*\(prob\((\d+)\)\)', s).group(1))
                rest = s[s.index('))') + 2:].strip()
                body = child if child else ([raw[:ind] + '\t' + rest] if rest else [])
                ops += self._block(body, mult, prob * pr / 100, bad)
                last_prob = pr
                i = j
                continue
            elif s.startswith('else') and last_prob is not None:
                ops += self._block(child, mult, prob * (100 - last_prob) / 100, bad)
            elif re.match(r'^for\(var/\w+\s*(?:=|in)\s*1\s+to\s+(\d+)\)', s):
                n = int(re.match(r'^for\(var/\w+\s*(?:=|in)\s*1\s+to\s+(\d+)\)', s).group(1))
                ops += self._block(child, mult * n, prob, bad)
            elif re.match(r'^for\(var/\w+\s*=\s*0\s*,\s*\w+\s*<\s*(\d+)\s*,', s):
                n = int(re.match(r'^for\(var/\w+\s*=\s*0\s*,\s*\w+\s*<\s*(\d+)\s*,', s).group(1))
                ops += self._block(child, mult * n, prob, bad)
            elif re.match(r'^switch\s*\(pickweight\(list\(', s):
                weights = dict((k, int(w)) for k, w in re.findall(r'"(\w+)"\s*=\s*(\d+)', s))
                cases, name, buf = {}, None, []
                for cl in child:
                    cs = cl.strip()
                    m = re.match(r'^if\s*\("(\w+)"\)', cs)
                    if m:
                        if name is not None:
                            cases[name] = buf
                        name, buf = m.group(1), []
                    elif name is not None:
                        buf.append(cl)
                if name is not None:
                    cases[name] = buf
                ops.append({'choice': [(w, self._block(cases.get(k, []), mult, prob, bad)) for k, w in weights.items()]})
            elif s in ('return', 'return TRUE', 'return FALSE'):
                pass
            else:
                bad.append(s)
            last_prob = None
            i = j
        return ops

    # -- flattening -----------------------------------------------------------------------------
    def rows(self, path, depth=0):
        """[item path, count, chance, amount] for a closet type, following `..()` up the type tree."""
        parent = path.rsplit('/', 1)[0]
        ops = self.procs.get(path)
        if ops is None:
            return self.rows(parent, depth + 1) if path.startswith(CLOSET_ROOT + '/') else []
        return self._flat(ops, parent, depth)

    def _flat(self, ops, parent, depth):
        out = []
        for op in ops:
            if op.get('super'):
                out += self.rows(parent, depth + 1) if parent.startswith(CLOSET_ROOT) else []
            elif 'choice' in op:
                out.append({'pick': [[w, self._flat(sub, parent, depth)] for w, sub in op['choice']]})
            else:
                out.append([op['p'], op['n'], round(op['pr'], 2), op.get('amt', 0)])
        return out


def frames(spr, sl, icon, state, base_state, r, is_crate):
    """Sprite ids [closed, closed+locked, welded, welded+locked, open]; -1 where a state does not exist."""
    dmi = sl.get_dmi(icon)
    S = 2
    secure = r.get('secure') is True
    welds = r.get('can_weld_shut') is not False and not is_crate

    def add(*states):
        layers = [(icon, s, S, None, None) for s in states if s and dmi.has(s)]
        return spr.add(layers) if layers else -1

    if is_crate:
        closed = add(base_state)
        opened = add(base_state + 'open') if dmi.has(base_state + 'open') else closed
        return [closed, -1, -1, -1, opened]
    door = r.get('icon_door') if isinstance(r.get('icon_door'), str) and r.get('icon_door') != 'null' else state
    door_state = door + '_door' if dmi.has(door + '_door') else state + '_door'
    open_name = (door if r.get('icon_door_override') is True else state) + '_open'
    cu = add(state, door_state)
    cl = add(state, door_state, 'locked') if secure else -1
    wu = add(state, door_state, 'welded', *(['unlocked'] if secure else [])) if welds else -1
    wl = add(state, door_state, 'welded', 'locked') if (welds and secure) else -1
    if secure:
        cu = add(state, door_state, 'unlocked')
    return [cu, cl, wu, wl, add(state, open_name)]
