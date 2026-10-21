#!/usr/bin/env python3
"""Join a gap drone's part files into one note and check it.

    python tools/tgmerge.py gap-items-01 [gap-things-02 ...]

Reads docs/tg/_parts/<shard>.<n>.md in order, writes docs/tg/<shard>.md, and runs tools/tgcheck.py against docs/tg/_todo3/<shard>.txt.
With --keep the part files stay; otherwise they are deleted when the merged note is CLEAN.
"""
import glob
import os
import re
import subprocess
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
DOCS = os.path.join(ROOT, 'docs', 'tg')


def merge(shard, keep):
    parts = glob.glob(os.path.join(DOCS, '_parts', f'{shard}.*.md'))
    parts.sort(key=lambda f: int(re.search(r'\.(\d+)\.md$', f).group(1)))
    if not parts:
        print(f'{shard}: no part files')
        return False
    out = os.path.join(DOCS, f'{shard}.md')
    with open(out, 'w', encoding='utf-8', newline='\n') as fh:
        for f in parts:
            fh.write(open(f, encoding='utf-8', errors='replace').read().rstrip('\n') + '\n\n')
    r = subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'tgcheck.py'), os.path.join(DOCS, '_todo3', f'{shard}.txt'), out],
                       capture_output=True, text=True)
    print(f'--- {shard}: {len(parts)} parts -> {out}')
    print(r.stdout.rstrip())
    clean = r.returncode == 0
    if clean and not keep:
        for f in parts:
            os.remove(f)
    return clean


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if a != '--keep']
    keep = '--keep' in sys.argv
    if not args:
        print(__doc__)
        sys.exit(2)
    sys.exit(0 if all([merge(s, keep) for s in args]) else 1)
