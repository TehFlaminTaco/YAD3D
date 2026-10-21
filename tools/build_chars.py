"""Character art for runtime composition (assets/chars.png + assets/chars.json).

Players and crew are not baked sprites any more: the browser stacks these layers (see src/client/charart.js), so what a person
wears and how they look can change at any time. Every state is stored as a group of four 32x32 cells, one per direction in the
order S, N, E, W, and `base` is the first cell's index. The cell sheet is `COLS` cells wide.

chars.json
    cols, cells
    cuffs      base cell of the handcuff overlay
    body       {head_m, head_f, chest_m, chest_f, r_arm, l_arm, r_hand, l_hand, r_leg, l_leg}: greyscale parts, tinted by skin
    eyes       base cell of the eyes (tinted by eye colour)
    hair, facial, underwear, undershirt, socks: [{n: name, c: base (-1: none), g: 'M' | 'F' | 'N'}]
    skin       [{n, hex}]
    worn       {item path: {slot: [base] or [base, hide flags]}}  (hide flags are SS13's own HIDE* bits)
"""
import json
import os
import re
import glob

from PIL import Image

import spritelib as sl

COLS = 128
DIRS = (2, 1, 4, 8)                      # S, N, E, W

BODY = {
    'head_m': 'human_head_m', 'head_f': 'human_head_f', 'chest_m': 'human_chest_m', 'chest_f': 'human_chest_f',
    'r_arm': 'human_r_arm', 'l_arm': 'human_l_arm', 'r_hand': 'human_r_hand', 'l_hand': 'human_l_hand',
    'r_leg': 'human_r_leg', 'l_leg': 'human_l_leg',
}
SKIN_ORDER = ['albino', 'caucasian1', 'caucasian2', 'caucasian3', 'latino', 'mediterranean', 'asian1', 'asian2', 'arab', 'indian',
              'african1', 'african2']

# slot -> the files SS13 looks the worn sprite up in (build_worn_icon's default_icon_file)
SLOT_FILES = {
    'uniform': 'icons/mob/clothing/under/*.dmi', 'suit': 'icons/mob/clothing/suit.dmi', 'head': 'icons/mob/clothing/head.dmi',
    'shoes': 'icons/mob/clothing/feet.dmi', 'gloves': 'icons/mob/clothing/hands.dmi', 'glasses': 'icons/mob/clothing/eyes.dmi',
    'ears': 'icons/mob/clothing/ears.dmi', 'mask': 'icons/mob/clothing/mask.dmi', 'neck': 'icons/mob/clothing/neck.dmi',
    'back': 'icons/mob/clothing/back.dmi', 'belt': 'icons/mob/clothing/belt.dmi', 'suit_store': 'icons/mob/clothing/belt_mirror.dmi',
}


class Sheet:
    def __init__(self):
        self.imgs = []
        self.by_hash = {}

    def group(self, imgs):
        """Four direction images -> base cell index (deduplicated)."""
        key = b''.join(i.tobytes() for i in imgs)
        if key not in self.by_hash:
            self.by_hash[key] = len(self.imgs)
            self.imgs.extend(imgs)
        return self.by_hash[key]

    def save(self, path):
        rows = (len(self.imgs) + COLS - 1) // COLS
        sheet = Image.new('RGBA', (COLS * 32, max(1, rows) * 32), (0, 0, 0, 0))
        for i, im in enumerate(self.imgs):
            sheet.paste(im, ((i % COLS) * 32, (i // COLS) * 32))
        sheet.save(path)


def _int(v):
    """A DM define's value as an int: 5, "(1<<8)" and friends."""
    if isinstance(v, int):
        return v
    m = re.match(r'^\(?\s*(\d+)\s*<<\s*(\d+)\s*\)?$', str(v).strip())
    if m:
        return int(m.group(1)) << int(m.group(2))
    return int(v) if str(v).strip().isdigit() else 0


def _dirs(icon, state):
    """The four direction images of a state, or None if it is missing or not 32x32."""
    d = sl.get_dmi(icon)
    if not d or not d.has(state) or d.w != 32 or d.h != 32:
        return None
    st = d.states[state]
    out = []
    for dd in DIRS:
        im = d.frame(state, sl.dir_index(st, dd), 0)
        out.append(im if im.size == (32, 32) else im.resize((32, 32), Image.NEAREST))
    return out


def build(itemdefs, resolve, dm, out_dir):
    sheet = Sheet()
    meta = {'cols': COLS}

    def group(icon, state):
        imgs = _dirs(icon, state)
        return sheet.group(imgs) if imgs else -1

    parts = 'icons/mob/human_parts_greyscale.dmi'
    meta['body'] = {k: group(parts, v) for k, v in BODY.items()}
    meta['eyes'] = group('icons/mob/human_face.dmi', 'eyes')
    meta['cuffs'] = group('icons/mob/mob.dmi', 'handcuff1')            # worn over everything while handcuffed

    def accessories(cat):
        out = []
        root = '/datum/sprite_accessory/' + cat
        for p in sorted(dm.types):
            if not p.startswith(root + '/'):
                continue
            r = resolve(p)
            name, icon, state = r.get('name'), r.get('icon'), r.get('icon_state')
            if not isinstance(name, str) or r.get('locked') is True:
                continue
            base = group(icon, state) if isinstance(state, str) and state != 'null' and isinstance(icon, str) else -1
            if base < 0 and name.lower() not in ('nude', 'bald', 'none', 'shaved'):
                continue
            g = {'MALE': 'M', 'FEMALE': 'F'}.get(r.get('gender'), 'N')
            out.append({'n': name, 'c': base, 'g': g})
        out.sort(key=lambda e: (e['c'] >= 0, e['n'].lower()))      # "none" first, then alphabetical
        return out
    for key, cat in (('hair', 'hair'), ('facial', 'facial_hair'), ('underwear', 'underwear'), ('undershirt', 'undershirt'), ('socks', 'socks')):
        meta[key] = accessories(cat)

    meta['skin'] = []
    src = open(os.path.join(sl.SRC, 'code/modules/surgery/bodyparts/helpers.dm'), encoding='utf-8', errors='replace').read()
    hexes = dict(re.findall(r'if\("(\w+)"\)\s*\n\s*\. = "([0-9a-f]{6})"', src))
    for n in SKIN_ORDER:
        meta['skin'].append({'n': n, 'hex': '#' + hexes[n]})

    # what each item looks like when worn, by slot
    files = {}
    for slot, pat in SLOT_FILES.items():
        files[slot] = [os.path.relpath(f, sl.SRC).replace(os.sep, '/') for f in sorted(glob.glob(os.path.join(sl.SRC, pat)))]

    def hide_bits(r):
        v = r.get('flags_inv')
        bits = 0
        if isinstance(v, str):
            for name in re.findall(r'HIDE\w+', v):
                if name in dm.defines:
                    bits |= _int(dm.value(dm.defines[name]))
        elif isinstance(v, int):
            bits = v
        return bits

    worn = {}
    for path, d in itemdefs.items():
        slots = [s for s in d.get('sl', []) if s in SLOT_FILES]
        if not slots:
            continue
        r = resolve(path)
        state = r.get('worn_icon_state') if isinstance(r.get('worn_icon_state'), str) else r.get('icon_state')
        if not isinstance(state, str) or state == 'null':
            continue
        custom = r.get('worn_icon')
        for slot in slots:
            cands = [custom] if isinstance(custom, str) and sl.get_dmi(custom) else files[slot]
            base = -1
            for f in cands:
                base = group(f, state)
                if base >= 0:
                    break
            if base < 0:
                continue
            hide = hide_bits(r)
            worn.setdefault(path, {})[slot] = [base, hide] if hide else [base]
    meta['worn'] = worn

    # what each item looks like held, by hand (SS13's inhand_icon_state, else icon_state, in lefthand_file / righthand_file): [left, right] base cells, -1 for none.
    # A lit welding tool is "<state>1" (weldingtool.dm update_icon_state): `handOn`.
    def hand_pair(r, state):
        out = []
        for key in ('lefthand_file', 'righthand_file'):
            f = r.get(key)
            out.append(group(f, state) if isinstance(f, str) and state else -1)
        return out

    hand, hand_on = {}, {}
    for path in itemdefs:
        r = resolve(path)
        held = r.get('inhand_icon_state')                          # (unset, or null: the icon_state; "": nothing to show)
        state = held if isinstance(held, str) and held != 'null' else r.get('icon_state')
        if not isinstance(state, str) or state in ('', 'null'):
            continue
        pair = hand_pair(r, state)
        if pair[0] < 0 and pair[1] < 0:
            continue
        hand[path] = pair
        if path.startswith('/obj/item/weldingtool'):
            on = hand_pair(r, state + '1')
            if on[0] >= 0 or on[1] >= 0:
                hand_on[path] = on
    meta['hand'] = hand
    meta['handOn'] = hand_on
    meta['cells'] = len(sheet.imgs)

    os.makedirs(out_dir, exist_ok=True)
    sheet.save(os.path.join(out_dir, 'chars.png'))
    with open(os.path.join(out_dir, 'chars.json'), 'w') as f:
        json.dump(meta, f, separators=(',', ':'))
    print('  chars: %d cells, %d worn items, %d held, %d hair, %d facial, %d underwear, %d undershirts, %d socks' % (
        len(sheet.imgs), len(worn), len(hand), len(meta['hair']), len(meta['facial']), len(meta['underwear']), len(meta['undershirt']), len(meta['socks'])))
    return meta
