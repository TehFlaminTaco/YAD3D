#!/usr/bin/env python3
"""Convert a tgstation .dmm map + the game's own DM/DMI data into YAD3D level data.

    python3 tools/build_level.py [BoxStation]

Reads the 2020-07 tgstation snapshot in _src/tg2020 (the last commit that still shipped BoxStation),
so the map, code and art all come from the same tree.

Outputs (assets/):
    level.json       tile layers (base64), props, areas, spawns, loot pool
    terrain.png      32x32 cell atlas (baked floors w/ decals, wall faces, lattice...)
    sprites.png      packed sprite atlas (props, items, doors...)
    sprites.json     sprite rects (+ average colour)
"""
import base64
import collections
import hashlib
import json
import os
import re
import struct
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import dmm  # noqa: E402
import spritelib as sl  # noqa: E402
from dmcode import DmCode  # noqa: E402
from build_mobs import build_mobs  # noqa: E402

ROOT = os.path.normpath(os.path.join(HERE, '..'))
TREE = os.environ.get('YAD_TREE', os.path.join(ROOT, '_src', 'tg2020'))
OUT = os.path.join(ROOT, 'assets')
sl.SRC = TREE

MAPS = {
    'BoxStation': '_maps/map_files/BoxStation/BoxStation.dmm',
}

N, S, E, W = 1, 2, 4, 8
OPP = {N: S, S: N, E: W, W: E}
DVEC = {N: (0, 1), S: (0, -1), E: (1, 0), W: (-1, 0)}      # in DMM coordinates (y up)
BAD_ICON_DIRS = ('goon/',)                                    # CC BY-NC-SA, not usable

# --------------------------------------------------------------------------- registries


class Cells:
    """32x32 terrain cell registry (dedupes on content)."""

    def __init__(self):
        self.imgs = []
        self.by_hash = {}

    def add(self, img):
        if img is None:
            return 0xFFFF
        if img.size != (32, 32):
            img = img.resize((32, 32), Image.NEAREST)
        h = hashlib.md5(img.tobytes()).hexdigest()
        if h not in self.by_hash:
            self.by_hash[h] = len(self.imgs)
            self.imgs.append(img)
        return self.by_hash[h]

    def save(self, path, cols=64):
        rows = (len(self.imgs) + cols - 1) // cols
        atlas = Image.new('RGBA', (cols * 32, max(1, rows) * 32), (0, 0, 0, 0))
        for i, im in enumerate(self.imgs):
            atlas.paste(im, ((i % cols) * 32, (i // cols) * 32))
        atlas.save(path)
        return cols


class Sprites:
    """Packed sprite atlas; each sprite is cropped to its opaque bounds."""

    def __init__(self):
        self.keys = {}
        self.items = []   # (img, ox, oy, fw, fh)

    def add_image(self, img, key=None):
        if img is None:
            return -1
        if key is not None and key in self.keys:
            return self.keys[key]
        bbox = img.getbbox()
        if bbox is None:
            return -1
        fw, fh = img.size
        idx = len(self.items)
        self.items.append((img.crop(bbox), bbox[0], bbox[1], fw, fh))
        if key is not None:
            self.keys[key] = idx
        return idx

    def add(self, layers):
        key = tuple(layers)
        if key in self.keys:
            return self.keys[key]
        return self.add_image(sl.compose(layers), key)

    def pack(self, size=4096, pad=2):
        order = sorted(range(len(self.items)), key=lambda i: -self.items[i][0].height)
        x = y = row_h = 0
        pos = {}
        for i in order:
            w, h = self.items[i][0].size
            if x + w + pad > size:
                x = 0
                y += row_h + pad
                row_h = 0
            pos[i] = (x, y)
            x += w + pad
            row_h = max(row_h, h)
        total_h = y + row_h + pad
        atlas_h = 1
        while atlas_h < total_h:
            atlas_h *= 2
        atlas = Image.new('RGBA', (size, atlas_h), (0, 0, 0, 0))
        rects = []
        for i, (im, ox, oy, fw, fh) in enumerate(self.items):
            px, py = pos[i]
            atlas.paste(im, (px, py))
            r_ = g_ = b_ = n_ = 0
            for (pr, pg, pb, pa) in im.get_flattened_data():
                if pa > 128:
                    r_ += pr
                    g_ += pg
                    b_ += pb
                    n_ += 1
            avg = [r_ // n_, g_ // n_, b_ // n_] if n_ else [128, 128, 128]
            rects.append([px, py, im.width, im.height, ox, oy, fw, fh] + avg)
        return atlas, rects


# --------------------------------------------------------------------------- DM helpers

dm = DmCode(os.path.join(TREE, 'code'))
_res_cache = {}


def resolve(path, vars_=None):
    """Resolved DM props for a map atom (class defaults + map overrides)."""
    if path not in _res_cache:
        r = dm.resolve(path)
        for k in list(r):
            r[k] = sl.first_arg(r[k])
        _res_cache[path] = r
    r = dict(_res_cache[path])
    if vars_:
        for k, v in vars_.items():
            r[k] = sl.first_arg(dm.value(v))
    return r


def dir_of(r, default=S):
    d = r.get('dir', default)
    if isinstance(d, str):
        d = dm.defines.get(d, default)
        if isinstance(d, str):
            d = {'NORTH': 1, 'SOUTH': 2, 'EAST': 4, 'WEST': 8, 'NORTHEAST': 5, 'NORTHWEST': 9,
                 'SOUTHEAST': 6, 'SOUTHWEST': 10}.get(d, default)
    return d if isinstance(d, int) else default


def clean_name(n):
    if not isinstance(n, str):
        return ''
    return re.sub(r'\\(improper|proper|the|a|an)\s?', '', n).strip()


def icon_ok(icon, state=None):
    if not isinstance(icon, str) or icon.startswith(BAD_ICON_DIRS):
        return False
    d = sl.get_dmi(icon)
    return bool(d and (state is None or d.has(state)))


# access defines -> department tokens ------------------------------------------------------

ACCESS_NUM = {}
for _k, _v in dm.defines.items():
    _n = dm.value(_v)
    if _k.startswith('ACCESS_') and isinstance(_n, int):
        ACCESS_NUM[str(_n)] = _k[7:]

def access_of(r):
    """Real SS13 access numbers: 'a' = all required (req_access), 'o' = any one of (req_one_access)."""
    def nums(key):
        v = r.get(key)
        out = []
        if isinstance(v, str):
            for tok in re.split(r'[;,]', v):
                tok = tok.strip()
                if tok.isdigit() and tok != '0' and tok in ACCESS_NUM:
                    out.append(int(tok))
        elif isinstance(v, int) and v:
            out.append(v)
        return sorted(set(out))
    return {'a': nums('req_access_txt'), 'o': nums('req_one_access_txt')}


# --------------------------------------------------------------------------- smoothing


def corner_states(adj):
    """The four overlay states tg's icon smoothing picks (see code/__HELPERS/icon_smoothing.dm)."""
    n, s, e, w = adj['N'], adj['S'], adj['E'], adj['W']
    ne, nw, se, sw = adj['NE'], adj['NW'], adj['SE'], adj['SW']

    def pick(a, b, diag, i, a_name, b_name, both):
        if a and b:
            return '%d-f' % i if diag else '%d-%s' % (i, both)
        if a:
            return '%d-%s' % (i, a_name)
        if b:
            return '%d-%s' % (i, b_name)
        return '%d-i' % i

    return [pick(n, w, nw, 1, 'n', 'w', 'nw'), pick(n, e, ne, 2, 'n', 'e', 'ne'),
            pick(s, w, sw, 3, 's', 'w', 'sw'), pick(s, e, se, 4, 's', 'e', 'se')]


def smooth_image(icon, adj, base_state=None):
    layers = []
    dmi = sl.get_dmi(icon)
    if dmi is None:
        return None
    if base_state and dmi.has(base_state):
        layers.append((icon, base_state, S, None, None))
    for st in corner_states(adj):
        if dmi.has(st):
            layers.append((icon, st, S, None, None))
    return sl.compose(layers, (32, 32)) if layers else None


def adj_from(pred):
    """pred(dx, dy) -> bool using DMM coordinates; builds the 8-neighbour adjacency dict."""
    return {'N': pred(0, 1), 'S': pred(0, -1), 'E': pred(1, 0), 'W': pred(-1, 0),
            'NE': pred(1, 1), 'NW': pred(-1, 1), 'SE': pred(1, -1), 'SW': pred(-1, -1)}


# --------------------------------------------------------------------------- classification tables

SKIP_PREFIXES = (
    '/obj/structure/cable', '/obj/machinery/atmospherics', '/obj/structure/disposalpipe', '/obj/machinery/duct',
    '/obj/effect/mapping_helpers', '/obj/effect/decal', '/obj/effect/turf_decal', '/obj/effect/landmark',
    '/obj/machinery/navbeacon', '/obj/machinery/meter', '/obj/machinery/conveyor', '/obj/item/solar_assembly',
    '/obj/structure/transit_tube', '/obj/structure/grille', '/obj/machinery/power/solar', '/obj/docking_port',
    '/obj/structure/lattice', '/obj/effect/spawner/structure', '/obj/machinery/power/terminal',
    '/obj/structure/disposaloutlet', '/obj/structure/light_construct', '/obj/item/wallframe', '/obj/item/poster',
    '/obj/structure/marker_beacon', '/obj/machinery/power/tracker', '/obj/structure/sign/poster/random',
    '/obj/machinery/door_buttons', '/obj/structure/plasticflaps', '/obj/effect/spawner/lootdrop/grille',
    '/obj/machinery/ai_slipper', '/obj/machinery/porta_turret', '/obj/machinery/flasher', '/obj/machinery/field',
    '/obj/machinery/telecomms', '/obj/machinery/plumbing', '/obj/item/stack/rods', '/obj/item/stack/cable_coil',
    '/obj/machinery/button/flasher', '/obj/machinery/holopad', '/obj/machinery/disposal/deliveryChute',
)

WALLMOUNT_PREFIXES = (
    '/obj/machinery/airalarm', '/obj/machinery/firealarm', '/obj/machinery/power/apc', '/obj/item/radio/intercom',
    '/obj/structure/extinguisher_cabinet', '/obj/machinery/camera', '/obj/machinery/light_switch',
    '/obj/machinery/button', '/obj/machinery/newscaster', '/obj/machinery/status_display',
    '/obj/machinery/ai_status_display', '/obj/machinery/requests_console', '/obj/structure/sign',
    '/obj/structure/noticeboard', '/obj/structure/mirror', '/obj/machinery/vending/wallmed',
    '/obj/machinery/turretid', '/obj/structure/sink', '/obj/machinery/shower', '/obj/machinery/keycard_auth',
    '/obj/machinery/defibrillator_mount', '/obj/machinery/computer/security/telescreen',
    '/obj/structure/fireaxecabinet', '/obj/structure/urinal',
)

# item paths for the runtime loot spawners (maintenance, junk crates...)
LOOT_POOL = [
    ('/obj/item/crowbar', 'tool'), ('/obj/item/wrench', 'tool'), ('/obj/item/screwdriver', 'tool'),
    ('/obj/item/wirecutters', 'tool'), ('/obj/item/weldingtool', 'tool'), ('/obj/item/flashlight', 'tool'),
    ('/obj/item/storage/toolbox/mechanical', 'tool'), ('/obj/item/extinguisher', 'tool'),
    ('/obj/item/storage/firstaid/regular', 'medical'), ('/obj/item/storage/firstaid/fire', 'medical'),
    ('/obj/item/storage/firstaid/o2', 'medical'), ('/obj/item/healthanalyzer', 'medical'),
    ('/obj/item/stack/medical/bruise_pack', 'medical'), ('/obj/item/stack/medical/ointment', 'medical'),
    ('/obj/item/tank/internals/emergency_oxygen', 'life'), ('/obj/item/clothing/mask/breath', 'life'),
    ('/obj/item/clothing/suit/space/emergency', 'life'), ('/obj/item/clothing/head/helmet/space/emergency', 'life'),
    ('/obj/item/radio', 'junk'), ('/obj/item/stock_parts/cell', 'junk'), ('/obj/item/paper', 'junk'),
    ('/obj/item/pen', 'junk'), ('/obj/item/lighter', 'junk'),
    ('/obj/item/reagent_containers/food/drinks/soda_cans/cola', 'junk'),
    ('/obj/item/storage/box', 'junk'), ('/obj/item/clothing/gloves/color/yellow', 'junk'),
    ('/obj/item/clothing/head/hardhat', 'junk'), ('/obj/item/stack/sheet/metal', 'junk'),
    ('/obj/item/stack/sheet/glass', 'junk'), ('/obj/item/assembly/igniter', 'junk'),
    ('/obj/item/multitool', 'tool'), ('/obj/item/gun/energy/e_gun/mini', 'weapon'), ('/obj/item/melee/baton', 'weapon'),
]


SLOT_FLAGS = {'BACK': 'back', 'MASK': 'mask', 'BELT': 'belt', 'ID': 'id', 'EARS': 'ears', 'EYES': 'glasses', 'NECK': 'neck', 'HEAD': 'head',
              'FEET': 'shoes', 'GLOVES': 'gloves', 'ICLOTHING': 'uniform', 'OCLOTHING': 'suit', 'POCKET': 'pocket', 'SUITSTORE': 'suit_store'}
WEIGHT = {'WEIGHT_CLASS_TINY': 1, 'WEIGHT_CLASS_SMALL': 2, 'WEIGHT_CLASS_NORMAL': 3, 'WEIGHT_CLASS_BULKY': 4, 'WEIGHT_CLASS_HUGE': 5, 'WEIGHT_CLASS_GIGANTIC': 6}

# items the game systems refer to by path (so their sprites are always in the atlas)
GAME_ITEMS = [
    '/obj/item/crowbar', '/obj/item/wrench', '/obj/item/screwdriver', '/obj/item/wirecutters', '/obj/item/weldingtool',
    '/obj/item/flashlight', '/obj/item/storage/toolbox/mechanical', '/obj/item/storage/toolbox/emergency',
    '/obj/item/extinguisher', '/obj/item/storage/firstaid/regular', '/obj/item/storage/firstaid/fire',
    '/obj/item/storage/firstaid/toxin', '/obj/item/storage/firstaid/o2', '/obj/item/storage/firstaid/brute',
    '/obj/item/healthanalyzer', '/obj/item/stack/medical/bruise_pack', '/obj/item/stack/medical/ointment',
    '/obj/item/tank/internals/oxygen', '/obj/item/tank/internals/emergency_oxygen', '/obj/item/clothing/mask/breath',
    '/obj/item/clothing/mask/gas', '/obj/item/clothing/suit/space/emergency', '/obj/item/clothing/head/helmet/space/emergency',
    '/obj/item/clothing/suit/space/hardsuit/engine', '/obj/item/card/id', '/obj/item/pda', '/obj/item/radio',
    '/obj/item/stock_parts/cell', '/obj/item/stack/sheet/metal', '/obj/item/stack/sheet/glass',
    '/obj/item/gun/energy/e_gun', '/obj/item/gun/energy/e_gun/mini', '/obj/item/gun/energy/laser', '/obj/item/melee/baton',
    '/obj/item/fireaxe', '/obj/item/clothing/gloves/color/yellow', '/obj/item/clothing/head/hardhat',
    '/obj/item/reagent_containers/food/drinks/soda_cans/cola', '/obj/item/reagent_containers/food/snacks/chips',
    '/obj/item/reagent_containers/food/drinks/coffee', '/obj/item/reagent_containers/hypospray/medipen',
    '/obj/item/multitool', '/obj/item/paper', '/obj/item/pen', '/obj/item/lighter', '/obj/item/storage/box',
    '/obj/item/stack/sheet/plasteel', '/obj/item/clothing/head/welding', '/obj/item/geiger_counter',
    '/obj/item/assembly/igniter', '/obj/item/stock_parts/cell/high', '/obj/item/clothing/suit/hazardvest',
    '/obj/item/clothing/under/color/grey', '/obj/item/clothing/shoes/sneakers/black', '/obj/item/storage/backpack',
]


# --------------------------------------------------------------------------- build


def process(grid, keys, cells, spr, shared, Wd, Ht, full=True):
    """Classify tiles + props for one (possibly shuttle-stamped) grid. Registries are shared across calls."""
    areas = shared['areas']
    area_idx = shared['area_idx']
    kind = bytearray(Wd * Ht)           # 0 space 1 floor 2 wall/window block 3 lattice-over-space
    area_a = [0] * (Wd * Ht)
    floor_c = [0xFFFF] * (Wd * Ht)
    wall_v = [0xFFFF] * (Wd * Ht)
    roof = bytearray(Wd * Ht)
    wall_variants = shared['wall_variants']     # {name, glass, cells[4]}  index = left|right<<1
    wall_variant_idx = shared['wall_variant_idx']

    def idx(x, y):  # DMM (x, y-from-bottom) -> row-major with row 0 at the top
        return (Ht - y) * Wd + (x - 1)

    def inb(x, y):
        return 1 <= x <= Wd and 1 <= y <= Ht

    props = []
    floor_cache = {}

    def floor_cell(turf_path, turf_vars, decals):
        r = resolve(turf_path, turf_vars)
        d = dir_of(r) if turf_vars and 'dir' in turf_vars else S
        key = (turf_path, d, tuple((p, tuple(sorted(v.items()))) for p, v in decals))
        if key in floor_cache:
            return floor_cache[key]
        icon, state = r.get('icon'), r.get('icon_state')
        layers = []
        if isinstance(state, str) and icon_ok(icon, state):
            col = r.get('color') if isinstance(r.get('color'), str) else None
            layers.append((icon, state, d, col, None))
        else:
            layers.append(('icons/turf/floors.dmi', 'plating', S, None, None))
        for p, v in decals:
            dr = resolve(p, v)
            di, ds = dr.get('icon'), dr.get('icon_state')
            if isinstance(ds, str) and icon_ok(di, ds):
                col = dr.get('color') if isinstance(dr.get('color'), str) else None
                al = dr.get('alpha') if isinstance(dr.get('alpha'), int) else None
                layers.append((di, ds, dir_of(dr), col, al))
        floor_cache[key] = cells.add(sl.compose(layers, (32, 32)))
        return floor_cache[key]

    def block_variant(icon, glass, name):
        """Wall-like block type: 4 face cells indexed by (left connected) | (right connected) << 1."""
        key = (icon, glass)
        if key in wall_variant_idx:
            return wall_variant_idx[key]
        face = []
        for lr in range(4):
            left, right = bool(lr & 1), bool(lr & 2)
            adj = {'N': False, 'S': False, 'E': right, 'W': left, 'NE': False, 'NW': False, 'SE': False, 'SW': False}
            face.append(cells.add(smooth_image(icon, adj)))
        wall_variants.append({'name': name, 'glass': glass, 'cells': face})
        wall_variant_idx[key] = len(wall_variants) - 1
        return wall_variant_idx[key]

    # ---- pass 1: tiles --------------------------------------------------------------------
    tile_atoms = {}
    for (x, y), key in grid.items():
        atoms = keys[key]
        turf = area = None
        objs, decals = [], []
        for p, v in atoms:
            if p.startswith('/turf'):
                turf = (p, v)
            elif p.startswith('/area'):
                area = (p, v)
            elif p.startswith('/obj/effect/turf_decal'):
                decals.append((p, v))
            elif p.startswith('/obj') or p.startswith('/mob'):
                objs.append((p, v))
        i = idx(x, y)
        ap = area[0] if area else '/area/space'
        if ap not in area_idx:
            ar = resolve(ap)
            parts = ap.strip('/').split('/')
            area_idx[ap] = len(areas)
            areas.append({'n': clean_name(ar.get('name', parts[-1])) or parts[-1], 'c': parts[1] if len(parts) > 1 else 'space', 'p': ap})
        area_a[i] = area_idx[ap]
        roof[i] = 0 if (ap.startswith('/area/space') or ap.startswith('/area/solar') or ap.startswith('/area/asteroid')) else 1
        tp = turf[0] if turf else '/turf/open/space/basic'
        tv = turf[1] if turf else {}
        has_lat = any(p.startswith('/obj/structure/lattice') for p, _ in objs)
        if tp.startswith('/turf/closed'):
            kind[i] = 2
        elif tp.startswith('/turf/open/space'):
            kind[i] = 3 if has_lat else 0
        else:
            kind[i] = 1
            floor_c[i] = floor_cell(tp, tv, decals)
        tile_atoms[(x, y)] = (tp, tv, objs, atoms)

    def is_kind(x, y, *ks):
        return inb(x, y) and kind[idx(x, y)] in ks

    # fulltile windows become wall-like glass blocks
    WALL_FALLBACK = 'icons/turf/walls/wall.dmi'
    win_tiles = {}
    for (x, y), (tp, tv, objs, atoms) in tile_atoms.items():
        i = idx(x, y)
        for p, v in objs:
            if p.startswith('/obj/effect/spawner/structure/window') or '/fulltile' in p:
                tag = 'pwindow' if 'plasma' in p else ('rwindow' if 'reinforced' in p else 'window')
                win_tiles[(x, y)] = tag
                kind[i] = 2
                break

    # lattice cells (smoothing against other lattice tiles)
    for (x, y), (tp, tv, objs, atoms) in tile_atoms.items():
        i = idx(x, y)
        if kind[i] != 3:
            continue
        lat = [p for p, _ in objs if p.startswith('/obj/structure/lattice')]
        lr = resolve(lat[0])
        li = lr.get('icon')
        if icon_ok(li):
            adj = adj_from(lambda dx, dy: is_kind(x + dx, y + dy, 3, 1))
            floor_c[i] = cells.add(smooth_image(li, adj, lr.get('icon_state')))

    WIN_ICON = {'window': 'icons/obj/smooth_structures/window.dmi',
                'rwindow': 'icons/obj/smooth_structures/reinforced_window.dmi',
                'pwindow': 'icons/obj/smooth_structures/plasma_window.dmi'}
    for (x, y), (tp, tv, objs, atoms) in tile_atoms.items():
        i = idx(x, y)
        if (x, y) in win_tiles:
            tag = win_tiles[(x, y)]
            icon = WIN_ICON[tag] if icon_ok(WIN_ICON[tag]) else WIN_ICON['rwindow']
            wall_v[i] = block_variant(icon, True, tag)
            if floor_c[i] == 0xFFFF:
                floor_c[i] = cells.add(sl.compose([('icons/turf/floors.dmi', 'plating', S, None, None)], (32, 32)))
        elif kind[i] == 2:
            r = resolve(tp, tv)
            icon = r.get('icon')
            if not icon_ok(icon):
                icon = WALL_FALLBACK
            wall_v[i] = block_variant(icon, False, os.path.basename(icon)[:-4])

    # ---- pass 2: props --------------------------------------------------------------------
    tables = set()
    for (x, y), (tp, tv, objs, atoms) in tile_atoms.items():
        for p, v in objs:
            if p.startswith('/obj/structure/table') and 'optable' not in p:
                tables.add((x, y))

    def wall_at(x, y):
        return (not inb(x, y)) or kind[idx(x, y)] == 2

    def snap_wall_side(x, y):
        for d in (N, E, W, S):
            dx, dy = DVEC[d]
            if wall_at(x + dx, y + dy):
                return d
        return N

    def mount_side(r, x, y):
        px, py = r.get('pixel_x', 0), r.get('pixel_y', 0)
        px = px if isinstance(px, (int, float)) else 0
        py = py if isinstance(py, (int, float)) else 0
        if abs(px) >= 12 or abs(py) >= 12:
            if abs(px) >= abs(py):
                return E if px > 0 else W
            return N if py > 0 else S
        return snap_wall_side(x, y)

    stats = collections.Counter()
    missing = collections.Counter()
    for (x, y), (tp, tv, objs, atoms) in tile_atoms.items():
        for p, v in objs:
            if p.startswith('/mob'):
                continue
            if p.startswith(SKIP_PREFIXES):
                continue
            r = resolve(p, v)
            d = dir_of(r)
            nm = clean_name(r.get('name', ''))
            row, col = Ht - y, x - 1
            base = {'x': col, 'y': row, 'd': d, 'n': nm}
            den = 1 if r.get('density') is True else 0

            # --- airlocks
            if p.startswith('/obj/machinery/door/airlock'):
                icon = r.get('icon')
                if not icon_ok(icon, 'closed'):
                    missing[p] += 1
                    continue
                dmi = sl.get_dmi(icon)
                glass = r.get('glass') is True
                ov = r.get('overlays_file')
                ov = ov if icon_ok(ov) else None

                def comp(state, frame=0):
                    ls = [(icon, state, S, None, None, frame)]
                    if glass and ov and sl.get_dmi(ov).has('glass_' + state):
                        ls.append((ov, 'glass_' + state, S, None, None, frame))
                    elif not glass and dmi.has('fill_' + state):
                        ls.append((icon, 'fill_' + state, S, None, None, frame))
                    return ls
                frames = [spr.add(comp('closed'))]
                if dmi.has('opening'):
                    for f in range(dmi.states['opening'].frames):
                        frames.append(spr.add(comp('opening', f)))
                frames.append(spr.add(comp('open')))
                acc = access_of(r)
                props.append(dict(base, k='door', fr=frames, a=acc['a'], o=acc['o'], glass=1 if glass else 0,
                                  t=p.split('/')[4] if p.count('/') >= 4 else 'public'))
                stats['door'] += 1
                continue
            if p.startswith('/obj/machinery/door/window'):
                icon = r.get('icon')
                st = r.get('icon_state', 'left')
                if icon_ok(icon, st):
                    acc = access_of(r)
                    props.append(dict(base, k='wdoor', s=spr.add([(icon, st, d, None, None)]), a=acc['a'], o=acc['o']))
                    stats['wdoor'] += 1
                continue
            if p.startswith('/obj/machinery/door/firedoor'):
                icon = r.get('icon')
                if icon_ok(icon, 'door_closed'):
                    props.append(dict(base, k='fdoor', s=spr.add([(icon, 'door_closed', S, None, None)])))
                    stats['fdoor'] += 1
                continue
            if p.startswith('/obj/machinery/door/'):
                continue

            # --- thin directional panes
            if p.startswith('/obj/structure/window'):
                if '/fulltile' in p:
                    continue
                tag = 'pwindow' if 'plasma' in p else ('rwindow' if 'reinforced' in p else 'window')
                props.append(dict(base, k='pane', t=tag))
                stats['pane'] += 1
                continue

            # --- tables: top face sprite with corner smoothing
            if p.startswith('/obj/structure/table') and 'optable' not in p:
                icon = r.get('icon')
                if icon_ok(icon):
                    adj = adj_from(lambda dx, dy: (x + dx, y + dy) in tables)
                    img = smooth_image(icon, adj, r.get('icon_state'))
                    sp = spr.add_image(img, ('table', icon, tuple(sorted(adj.items()))))
                    if sp >= 0:
                        props.append(dict(base, k='table', s=sp))
                        stats['table'] += 1
                continue

            # --- lights
            if p.startswith('/obj/machinery/light') and not p.startswith('/obj/machinery/light_switch'):
                icon, st = r.get('icon'), r.get('icon_state', 'tube')
                sp = -1
                if icon_ok(icon, st):
                    sp = spr.add([(icon, st, d, None, None)])
                kl = 'floor' if '/floor' in p else ('bulb' if '/small' in p else 'tube')
                col = {'bulb': '#ffcf8f', 'tube': '#eaf2ff', 'floor': '#ffffff'}[kl]
                if sp >= 0:
                    props.append(dict(base, k='light', s=sp, lt=kl, c=col))
                    stats['light'] += 1
                continue

            # --- wall mounts
            if p.startswith(WALLMOUNT_PREFIXES):
                icon, st = r.get('icon'), r.get('icon_state')
                if isinstance(st, str) and icon_ok(icon, st):
                    side = mount_side(r, x, y)
                    face = OPP[side]
                    sp = spr.add([(icon, st, face if sl.get_dmi(icon).states[st].dirs > 1 else S, None, None)])
                    if sp >= 0:
                        sub = p.split('/')[3] if p.count('/') >= 3 else 'misc'
                        if p.startswith('/obj/structure/sign'):
                            sub = 'sign'
                        elif p.startswith('/obj/item/radio'):
                            sub = 'intercom'
                        props.append(dict(base, k='wm', d=face, sd=side, s=sp, sub=sub, p=p))
                        stats['wm'] += 1
                else:
                    missing[p] += 1
                continue

            # --- random loot
            if p.startswith('/obj/effect/spawner/lootdrop'):
                props.append(dict(base, k='loot', cat=p.split('/')[-1]))
                stats['loot'] += 1
                continue
            if p.startswith('/obj/effect/'):
                continue

            # --- items
            if p.startswith('/obj/item/'):
                st = r.get('icon_state')
                icon = r.get('icon')
                if isinstance(st, str) and icon_ok(icon, st):
                    sp = spr.add([(icon, st, S, None, None)])
                    if sp >= 0:
                        if 'kirbyplants' in p:
                            props.append(dict(base, k='sprite', s=sp, den=0, bb=1))
                        else:
                            props.append(dict(base, k='item', s=sp, p=p))
                        stats['item'] += 1
                else:
                    missing[p] += 1
                continue

            # --- standing structures / machinery (computers get keyboard + screen overlays)
            if p.startswith(('/obj/structure', '/obj/machinery')):
                icon, st = r.get('icon'), r.get('icon_state')
                if not (isinstance(st, str) and icon_ok(icon, st)):
                    missing[p] += 1
                    continue
                dmi = sl.get_dmi(icon)
                layers = [(icon, st, d, None, None)]
                if p.startswith('/obj/machinery/computer') or p.startswith('/obj/machinery/modular_computer'):
                    for ov in (r.get('icon_keyboard', 'keyboard'), r.get('icon_screen')):
                        if isinstance(ov, str) and dmi.has(ov):
                            layers.append((icon, ov, d, None, None))
                elif p.startswith('/obj/structure/closet'):
                    door = r.get('icon_door') if isinstance(r.get('icon_door'), str) else st
                    for cand in (door + '_door', st + '_door'):
                        if dmi.has(cand):
                            layers.append((icon, cand, d, None, None))
                            break
                sp = spr.add(layers)
                if sp < 0:
                    continue
                multi = dmi.states[st].dirs > 1
                cont = 1 if p.startswith(('/obj/structure/closet', '/obj/structure/rack')) else 0
                props.append(dict(base, k='sprite', s=sp, den=den, bb=0 if multi else 1, cont=cont, p=p.split('/', 2)[2]))
                stats['sprite'] += 1
                continue

    # loot pool sprites
    pool = []
    for pth, tag in LOOT_POOL:
        r = resolve(pth)
        st, icon = r.get('icon_state'), r.get('icon')
        if isinstance(st, str) and icon_ok(icon, st):
            sp = spr.add([(icon, st, S, None, None)])
            if sp >= 0:
                pool.append({'p': pth, 'n': clean_name(r.get('name', pth.split('/')[-1])), 's': sp, 't': tag})

    # item definitions for the game systems: every path the jobs/outfits/containers refer to, plus the map's loot pool
    itemdefs = {}
    want = list(GAME_ITEMS) + [q for q, _ in LOOT_POOL]
    jobs_path = os.path.join(ROOT, 'data', 'jobs.json')
    if os.path.exists(jobs_path):
        for j in json.load(open(jobs_path))['jobs']:
            o = j['outfit']
            for k, v in o.items():
                if k == 'contents':
                    want += [c[0] for c in v]
                elif isinstance(v, str):
                    want.append(v)
    cpath = os.path.join(ROOT, 'data', 'contents.json')
    if os.path.exists(cpath):
        for k, v in json.load(open(cpath)).items():
            if k.startswith('/'):
                want.append(k)
                want += v
    for pth in dict.fromkeys(want):
        r = resolve(pth)
        st, icon = r.get('icon_state'), r.get('icon')
        if isinstance(st, str) and icon_ok(icon, st):
            sp = spr.add([(icon, st, S, None, None)])
            if sp < 0:
                continue
            raw = dm.lookup(pth)
            flags = raw.get('slot_flags', '')
            slots = sorted({SLOT_FLAGS[m] for m in re.findall(r'ITEM_SLOT_(\w+)', flags) if m in SLOT_FLAGS})
            w = r.get('w_class')
            w = w if isinstance(w, int) else WEIGHT.get(str(raw.get('w_class', '')).strip(), 2)
            f = r.get('force')
            itemdefs[pth] = {'n': clean_name(r.get('name', pth.split('/')[-1])), 's': sp,
                             'd': r.get('desc') if isinstance(r.get('desc'), str) else '',
                             'w': w, 'sl': slots, 'f': f if isinstance(f, (int, float)) else 0}
        else:
            missing['ITEM ' + pth] += 1

    mobs = build_mobs(spr)

    # spawn landmarks
    spawns = []
    for (x, y), (tp, tv, objs, atoms) in tile_atoms.items():
        for p, v in objs:
            m = re.match(r'/obj/effect/landmark/start/(.+)$', p)
            if m:
                spawns.append({'job': m.group(1), 'x': x - 1, 'y': Ht - y})
            elif p.startswith('/obj/effect/landmark/latejoin'):
                spawns.append({'job': 'latejoin', 'x': x - 1, 'y': Ht - y})
            elif p.startswith('/obj/effect/landmark/carpspawn'):
                spawns.append({'job': '@carp', 'x': x - 1, 'y': Ht - y})
            elif p.startswith('/obj/effect/landmark/xeno_spawn'):
                spawns.append({'job': '@xeno', 'x': x - 1, 'y': Ht - y})

    descs = {}
    for pr in props:
        pth = pr.get('p')
        if pth and pth not in descs:
            full = pth if pth.startswith('/') else '/' + pth
            r = resolve(full)
            dsc = r.get('desc')
            descs[pth] = [clean_name(r.get('name', '')), dsc if isinstance(dsc, str) else '']
    print('  props', len(props), dict(stats))
    print('  unresolved:', missing.most_common(12))

    return dict(kind=kind, area=area_a, floor=floor_c, wall=wall_v, roof=roof, props=props, spawns=spawns,
                pool=pool, itemdefs=itemdefs, mobs=mobs, descs=descs)


# --------------------------------------------------------------------------- shuttle stamping

CCW = {N: W, W: S, S: E, E: N}


def rotate_dir(d, k):
    for _ in range(k % 4):
        out = 0
        for bit in (N, S, E, W):
            if d & bit:
                out |= CCW[bit]
        d = out
    return d


def rot_vec(dx, dy, k):
    for _ in range(k % 4):
        dx, dy = -dy, dx
    return dx, dy


def stamp(grid, keys, template, sx, sy, tag, Wd, Ht):
    """Overlay a shuttle template so its mobile-port tile sits on (sx, sy). Picks the rotation that
    collides least with non-space tiles (same effect as SS13's dock transform)."""
    tg, tk = dmm.parse(os.path.join(TREE, '_maps/shuttles', template + '.dmm'))
    port = None
    for pos, key in tg.items():
        for p, v in tk[key]:
            if p.startswith('/obj/docking_port/mobile'):
                port = pos
    if port is None:
        raise SystemExit('no mobile port in ' + template)

    def turf_of(atoms):
        for p, v in atoms:
            if p.startswith('/turf'):
                return p
        return None

    best = None
    for rot in range(4):
        conflicts, placed = 0, []
        for (x, y), key in tg.items():
            tp = turf_of(tk[key])
            if tp is None or tp == '/turf/template_noop':
                continue
            rx, ry = rot_vec(x - port[0], y - port[1], rot)
            tx, ty = sx + rx, sy + ry
            if not (1 <= tx <= Wd and 1 <= ty <= Ht):
                conflicts += 10
                continue
            tgt = turf_of(keys[grid[(tx, ty)]])
            if tgt and not tgt.startswith('/turf/open/space'):
                conflicts += 1
            placed.append((tx, ty, key))
        if best is None or conflicts < best[0]:
            best = (conflicts, rot, placed)
    conflicts, rot, placed = best
    for tx, ty, key in placed:
        atoms = []
        for p, v in tk[key]:
            if p.startswith('/obj/docking_port') or p.startswith('/area/template'):
                continue
            v = dict(v)
            if rot and p.startswith('/obj'):
                d = 2
                if 'dir' in v:
                    try:
                        d = int(v['dir'])
                    except ValueError:
                        d = 2
                v['dir'] = str(rotate_dir(d, rot))
                for pk, other in (('pixel_x', 'pixel_y'), ('pixel_y', 'pixel_x')):
                    pass
                px = int(v['pixel_x']) if v.get('pixel_x', '').lstrip('-').isdigit() else 0
                py = int(v['pixel_y']) if v.get('pixel_y', '').lstrip('-').isdigit() else 0
                if px or py:
                    nx, ny = rot_vec(px, py, rot)
                    v['pixel_x'], v['pixel_y'] = str(nx), str(ny)
            atoms.append((p, v))
        has_area = any(p.startswith('/area') for p, _ in atoms)
        if not has_area:
            atoms.extend((p, v) for p, v in keys[grid[(tx, ty)]] if p.startswith('/area'))
        nk = '%s_%d_%d' % (tag, tx, ty)
        keys[nk] = atoms
        grid[(tx, ty)] = nk
    print('  stamped %-20s at (%3d,%3d) rot %3d conflicts %d tiles %d' % (template, sx, sy, rot * 90, conflicts, len(placed)))


# (template, dock tile in DMM coordinates) for shuttles that sit at their docks when the round starts
ROUNDSTART_DOCKS = [
    ('arrival_box', 47, 110), ('labour_box', 90, 92), ('mining_large', 80, 150), ('mining_common_meta', 33, 127),
    ('cargo_box', 68, 139),
    ('escape_pod_default', 33, 103), ('escape_pod_default', 33, 117), ('escape_pod_default', 131, 183),
    ('escape_pod_default', 137, 77),
]
EMERGENCY_DOCK = ('emergency_box', 200, 118)


def build(mapname):
    print('parsing', mapname)
    grid, keys = dmm.parse(os.path.join(TREE, MAPS[mapname]))
    Wd, Ht = dmm.dims(grid)
    print('  grid', Wd, Ht, 'keys', len(keys), 'access defs', len(ACCESS_NUM))
    H = Ht
    # the dock tiles above are listed (x, y-from-top); convert to DMM y (from bottom)
    for n, (tpl, sx, sy_top) in enumerate(ROUNDSTART_DOCKS):
        stamp(grid, keys, tpl, sx, H - sy_top, 'RS%d' % n, Wd, Ht)

    cells = Cells()
    spr = Sprites()
    shared = {'areas': [], 'area_idx': {}, 'wall_variants': [], 'wall_variant_idx': {}}
    base = process(grid, keys, cells, spr, shared, Wd, Ht)

    # emergency shuttle: processed on a copy, stored as an overlay applied when it docks
    grid_e, keys_e = dict(grid), dict(keys)
    tpl, sx, sy_top = EMERGENCY_DOCK
    stamp(grid_e, keys_e, tpl, sx, H - sy_top, 'EM', Wd, Ht)
    emerg = process(grid_e, keys_e, cells, spr, shared, Wd, Ht, full=False)
    changed = [i for i in range(Wd * Ht)
               if (emerg['kind'][i], emerg['floor'][i], emerg['wall'][i], emerg['area'][i], emerg['roof'][i]) !=
               (base['kind'][i], base['floor'][i], base['wall'][i], base['area'][i], base['roof'][i])]
    cset = set(changed)
    overlay = {
        'tiles': [[i, emerg['kind'][i], emerg['floor'][i], emerg['wall'][i], emerg['area'][i], emerg['roof'][i]] for i in changed],
        'props': [p for p in emerg['props'] if p['y'] * Wd + p['x'] in cset],
    }
    print('  emergency overlay: %d tiles, %d props' % (len(changed), len(overlay['props'])))

    areas, wall_variants = shared['areas'], shared['wall_variants']
    ceiling_cell = cells.add(sl.compose([('icons/turf/floors.dmi', 'plating', S, '#8a8f99', None)], (32, 32)))
    flat_cell = cells.add(Image.new('RGBA', (32, 32), (255, 255, 255, 255)))
    print('  cells', len(cells.imgs), 'sprites', len(spr.items), 'areas', len(areas), 'wall variants', len(wall_variants))

    # ---- write ----------------------------------------------------------------------------
    os.makedirs(OUT, exist_ok=True)
    cols = cells.save(os.path.join(OUT, 'terrain.png'))
    atlas, rects = spr.pack()
    atlas.save(os.path.join(OUT, 'sprites.png'))
    with open(os.path.join(OUT, 'sprites.json'), 'w') as f:
        json.dump({'w': atlas.width, 'h': atlas.height, 'rects': rects}, f, separators=(',', ':'))

    def b64u8(a):
        return base64.b64encode(bytes(a)).decode()

    def b64u16(a):
        return base64.b64encode(struct.pack('<%dH' % len(a), *a)).decode()

    descs = dict(base['descs'])
    descs.update(emerg['descs'])
    level = {
        'name': mapname, 'w': Wd, 'h': Ht,
        'terrain': {'cols': cols, 'cells': len(cells.imgs), 'ceiling': ceiling_cell, 'flat': flat_cell},
        'kind': b64u8(base['kind']), 'roof': b64u8(base['roof']),
        'area': b64u16(base['area']), 'floor': b64u16(base['floor']), 'wall': b64u16(base['wall']),
        'areas': areas, 'walls': wall_variants, 'props': base['props'], 'spawns': base['spawns'], 'pool': base['pool'],
        'itemdefs': base['itemdefs'], 'mobs': base['mobs'], 'descs': descs, 'evac': overlay,
    }
    with open(os.path.join(OUT, 'level.json'), 'w') as f:
        json.dump(level, f, separators=(',', ':'))
    print('  wrote', os.path.getsize(os.path.join(OUT, 'level.json')) // 1024, 'KB level,',
          os.path.getsize(os.path.join(OUT, 'sprites.png')) // 1024, 'KB sprites,',
          os.path.getsize(os.path.join(OUT, 'terrain.png')) // 1024, 'KB terrain')


if __name__ == '__main__':
    build(sys.argv[1] if len(sys.argv) > 1 else 'BoxStation')
