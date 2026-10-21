#!/usr/bin/env python3
"""Export SS13's own HUD art (slot icons, health doll, intent icons, full-screen damage overlays) for the client UI.

Writes assets/ui.png + assets/ui.json (name -> [x, y, w, h]) and assets/overlays/*.png.
"""
import json
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dmi import Dmi  # noqa: E402

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
TREE = os.environ.get('YAD_TREE', os.path.join(ROOT, '_src', 'tg2020'))
ICONS = os.path.join(TREE, 'icons')
OUT = os.path.join(ROOT, 'assets')

MIDNIGHT = ['uniform', 'suit', 'back', 'id', 'belt', 'mask', 'glasses', 'ears', 'head', 'suit_storage', 'pocket', 'gloves', 'shoes',
            'neck', 'hand_r', 'hand_l', 'hand_active', 'template', 'template_active', 'template_small', 'swap_1', 'swap_2',
            'act_throw_off', 'act_throw_on', 'act_drop', 'act_equip', 'act_resist', 'pull', 'pull0', 'harm', 'help', 'disarm', 'grab', 'toggle']
GEN = ['internal0', 'internal1', 'backpack_close', 'healthdoll_OVERLAY', 'healthdoll_DEAD']
PARTS = ['head', 'chest', 'l_arm', 'r_arm', 'l_leg', 'r_leg']


def main():
    tiles = []
    mid = Dmi(os.path.join(ICONS, 'mob', 'screen_midnight.dmi'))
    for s in MIDNIGHT:
        if mid.has(s):
            tiles.append((s, mid.frame(s)))
    gen = Dmi(os.path.join(ICONS, 'mob', 'screen_gen.dmi'))
    for s in GEN:
        tiles.append((s, gen.frame(s)))
    for p in PARTS:
        for k in range(1, 8):
            st = f'{p}{k}'
            if gen.has(st):
                tiles.append((st, gen.frame(st)))
    thr = Dmi(os.path.join(ICONS, 'effects', 'mouse_pointers', 'throw_target.dmi'))
    tiles.append(('throw_target', thr.frame(thr.order[0].name)))

    cols = 16
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * 32, rows * 32), (0, 0, 0, 0))
    index = {}
    for k, (name, im) in enumerate(tiles):
        x, y = (k % cols) * 32, (k // cols) * 32
        sheet.paste(im, (x, y))
        index[name] = [x, y, 32, 32]
    sheet.save(os.path.join(OUT, 'ui.png'), optimize=True)

    full = Dmi(os.path.join(ICONS, 'mob', 'screen_full.dmi'))
    od = os.path.join(OUT, 'overlays')
    os.makedirs(od, exist_ok=True)
    overlays = {}
    for prefix, n in [('brutedamageoverlay', 7), ('oxydamageoverlay', 11), ('passage', 11)]:
        overlays[prefix] = []
        for k in range(n):
            st = f'{prefix}{k}'
            if not full.has(st):
                continue
            im = full.frame(st)
            if im.getbbox() is None:
                overlays[prefix].append(None)
                continue
            fn = f'{prefix}{k}.png'
            im.save(os.path.join(od, fn), optimize=True)
            overlays[prefix].append('overlays/' + fn)
    json.dump({'tiles': index, 'size': [sheet.width, sheet.height], 'overlays': overlays}, open(os.path.join(OUT, 'ui.json'), 'w'), indent=1)
    print(f'ui.png {sheet.size}, {len(index)} icons; overlays', {k: sum(1 for v in vs if v) for k, vs in overlays.items()})


if __name__ == '__main__':
    main()
