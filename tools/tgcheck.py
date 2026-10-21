#!/usr/bin/env python3
"""Check a TG research note against the list it was written for.

    python tools/tgcheck.py docs/tg/_todo3/gap-01.txt docs/tg/gap-01.md [more parts.md ...]

* every path on the list must appear literally in the note(s)
* a path marked NOT FOUND whose type the DM does define (tools/tgwhere.py) is a FALSE NOT FOUND: the note must document it
* every `code/....dm:123` citation must name a file that exists with at least that many lines
* the note must end with a `## Coverage` section
Exit status 0 only when all of that is clean.
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tgwhere  # noqa: E402

PATH = re.compile(r'(/(?:obj|turf|mob|datum|area)/[A-Za-z0-9_/]+)')
CITE = re.compile(r'((?:code|_maps|icons)/[A-Za-z0-9_./\-]+\.dm):(\d+)')
SHORT = re.compile(r'(?<![/\w.])([A-Za-z0-9_]+\.dm):(\d+)')


def list_paths(listfile):
    out = []
    for line in open(listfile, encoding='utf-8', errors='replace'):
        if line.startswith('#') or not line.strip():
            continue
        m = PATH.search(line)
        if m:
            out.append(m.group(1).rstrip('/'))
    return list(dict.fromkeys(out))


def not_found_claims(text):
    claims = set()
    for line in text.splitlines():
        if re.search(r'NOT FOUND|not found', line):
            claims.update(p.rstrip('/') for p in PATH.findall(line))
    # a section whose heading names the path and whose body says NOT FOUND
    parts = re.split(r'(?m)^(#{2,4} .*)$', text)
    for k in range(1, len(parts) - 1, 2):
        head, body = parts[k], parts[k + 1]
        if re.search(r'NOT FOUND|not found', body) and len(body.splitlines()) < 12:
            claims.update(p.rstrip('/') for p in PATH.findall(head))
    return claims


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 2
    paths = list_paths(argv[0])
    text = '\n'.join(open(f, encoding='utf-8', errors='replace').read() for f in argv[1:])
    defs = tgwhere.load()
    ok = True

    missing = [p for p in paths if p not in text]
    print(f'{len(paths)} paths on the list; {len(paths) - len(missing)} appear in the note')
    if missing:
        ok = False
        print(f'MISSING ({len(missing)}): every list path must appear literally, one entry each:')
        for p in missing:
            print('  ' + p)

    claims = not_found_claims(text)
    false = []
    for p in sorted(claims):
        _, loc, exact = tgwhere.where(defs, p)
        if exact:
            false.append((p, loc))
    if false:
        ok = False
        print(f'FALSE NOT FOUND ({len(false)}): the DM defines these, so document them from the definition:')
        for p, loc in false:
            print(f'  {p}  defined at {loc}')
    real = [p for p in sorted(claims) if p in paths and not tgwhere.where(defs, p)[2]]
    if real:
        print(f'NOT FOUND with no own definition ({len(real)}; fine if you searched, but check the parent and nested forms):')
        for p in real:
            print('  ' + p)

    bad = []
    n = 0
    cache = {}
    for rel, ln in CITE.findall(text):
        n += 1
        f = os.path.join(tgwhere.TREE, rel)
        if f not in cache:
            cache[f] = len(open(f, encoding='utf-8', errors='replace').read().split('\n')) if os.path.exists(f) else None
        if cache[f] is None:
            bad.append(f'{rel}:{ln} (no such file)')
        elif int(ln) > cache[f]:
            bad.append(f'{rel}:{ln} (file has {cache[f]} lines)')
    # short form, `autolathe.dm:123`: the file must exist somewhere in the tree and be at least that long (the longest one, if the name is not unique)
    short = [(b, int(ln)) for b, ln in SHORT.findall(text)]
    if short:
        names = {}
        for dp, _, fn in os.walk(tgwhere.CODE):
            for f in fn:
                if f.endswith('.dm'):
                    names.setdefault(f, []).append(os.path.join(dp, f))
        for b, ln in set(short):
            n += 1
            fs = names.get(b)
            if not fs:
                bad.append(f'{b}:{ln} (no such file)')
                continue
            for f in fs:
                if f not in cache:
                    cache[f] = len(open(f, encoding='utf-8', errors='replace').read().split(chr(10)))
            size = max(cache[f] for f in fs)
            if ln > size:
                bad.append(f'{b}:{ln} (file has {size} lines)')
    print(f'{n} file:line citations; {len(bad)} bad')
    if bad:
        ok = False
        for b in sorted(set(bad))[:15]:
            print('  ' + b)

    if not re.search(r'(?m)^## Coverage', text):
        ok = False
        print('NO "## Coverage" section')
    print('CLEAN' if ok else 'NOT CLEAN')
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
