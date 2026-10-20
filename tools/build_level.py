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
import closets  # noqa: E402
import build_chars  # noqa: E402

ROOT = os.path.normpath(os.path.join(HERE, '..'))
TREE = os.environ.get('YAD_TREE', os.path.join(ROOT, '_src', 'tg2020'))
OUT = os.path.join(ROOT, 'assets')
sl.SRC = TREE

MAPS = {
    'BoxStation': '_maps/map_files/BoxStation/BoxStation.dmm',
}

# Central Command is a map of its own (a separate space of grids). Only the main complex is kept, not the thunderdome, the Syndicate base or the holodecks:
# CENTCOM_PART is (x0, x1, y0, y1) of what is kept, in the .dmm's own coordinates (y up), and the emergency shuttle docks at its `emergency_away` port, on the east side
# of the complex. Its doors keep their real access (Central Command's, which nobody on the crew carries): the crew can go as far as the doors that are open to all.
CENTCOM = '_maps/map_files/generic/CentCom.dmm'
CENTCOM_PART = (130, 236, 36, 122)
CENTCOM_DOCK = ('emergency_box', 206, 85)

N, S, E, W = 1, 2, 4, 8
OPP = {N: S, S: N, E: W, W: E}
DVEC = {N: (0, 1), S: (0, -1), E: (1, 0), W: (-1, 0)}      # in DMM coordinates (y up)
BAD_ICON_DIRS = ('goon/',)                                    # CC BY-NC-SA, not usable
GRILLE = ('icons/obj/structures.dmi', 'grille', S, None, None)   # a weave; stands in a window tile as a see-through panel

_POP = []


def populate():
    """The closets' PopulateContents(), read once from the DM source."""
    if not _POP:
        _POP.append(closets.Populate(TREE))
    return _POP[0]


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
            for (pr, pg, pb, pa) in (im.get_flattened_data() if hasattr(im, 'get_flattened_data') else im.getdata()):
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


def dir_set(layers, dd):
    """The same layers with the thing turned to `dd` (S, N, E or W). A layer whose state has no such view keeps its one picture,
    spelled the same way for every dd so that identical pictures are stored once."""
    out = []
    for l in layers:
        st = sl.get_dmi(l[0]).states[l[1]]
        idx = sl.dir_index(st, dd)
        out.append((l[0], l[1], {0: S, 1: N, 2: E, 3: W}[idx]) + tuple(l[3:]))
    return out


def dir_of(r, default=S):
    d = r.get('dir', default)
    if isinstance(d, str):
        d = dm.defines.get(d, default)
        if isinstance(d, str):
            d = {'NORTH': 1, 'SOUTH': 2, 'EAST': 4, 'WEST': 8, 'NORTHEAST': 5, 'NORTHWEST': 9,
                 'SOUTHEAST': 6, 'SOUTHWEST': 10}.get(d, default)
    return d if isinstance(d, int) else default


def delay_seconds(v):
    """A DM time (40, '1 SECONDS', '2 MINUTES') in seconds, or None."""
    if isinstance(v, (int, float)):
        return v / 10
    m = re.match(r'^(\d+(?:\.\d+)?)\s*(SECONDS?|MINUTES?)$', str(v or '').strip())
    if m:
        return float(m.group(1)) * (60 if m.group(2).startswith('MINUTE') else 1)
    return None


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
    '/obj/structure/transit_tube', '/obj/structure/grille', '/obj/docking_port',
    '/obj/structure/lattice', '/obj/effect/spawner/structure', '/obj/machinery/power/terminal',
    '/obj/structure/disposaloutlet', '/obj/structure/light_construct', '/obj/item/wallframe', '/obj/item/poster',
    '/obj/structure/marker_beacon', '/obj/structure/sign/poster/random',
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
    # light fixtures that break, and what puts them right (lighting.dm)
    '/obj/item/light/tube', '/obj/item/light/bulb', '/obj/item/light/tube/broken', '/obj/item/light/bulb/broken',
    '/obj/item/storage/box/lights/mixed', '/obj/item/storage/box/lights/tubes', '/obj/item/storage/box/lights/bulbs',
    '/obj/item/clothing/under/color/grey', '/obj/item/clothing/shoes/sneakers/black', '/obj/item/storage/backpack',
    # what windows and grilles drop and are rebuilt from (window.dm spawnDebris, grille.dm deconstruct)
    '/obj/item/stack/rods', '/obj/item/stack/sheet/rglass', '/obj/item/stack/sheet/plasmaglass', '/obj/item/stack/sheet/plasmarglass', '/obj/item/shard',
    # the tiles the map's floors are made of: what prying one up leaves, and what puts one down again
    '/obj/item/stack/tile/plasteel', '/obj/item/stack/tile/wood', '/obj/item/stack/tile/carpet', '/obj/item/stack/tile/carpet/blue',
    '/obj/item/stack/tile/grass', '/obj/item/stack/tile/circuit', '/obj/item/stack/tile/mineral/titanium', '/obj/item/stack/tile/mineral/plastitanium',
]


# --------------------------------------------------------------------------- build


def solar_image(tracker=False):
    """A solar panel seen from above, drawn here (TG's own is in goon/, which is not usable): a frame, a dark blue panel and its cell lines. The tracker is the same with a dish."""
    img = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    px = img.load()
    for yy in range(32):
        for xx in range(32):
            edge = xx in (1, 30) or yy in (1, 30)
            if not (1 <= xx <= 30 and 1 <= yy <= 30):
                continue
            line = xx % 8 == 1 or yy % 8 == 1
            px[xx, yy] = (150, 158, 172, 255) if edge else (56, 92, 190, 255) if line else (24, 40, 104, 255)
    if tracker:
        for yy in range(10, 22):
            for xx in range(10, 22):
                if (xx - 16) ** 2 + (yy - 16) ** 2 <= 30:
                    px[xx, yy] = (214, 220, 232, 255)
    return img


def process(grid, keys, cells, spr, shared, Wd, Ht, full=True, docks=False):
    """Classify tiles + props for one grid. Registries (areas, wall variants, floor types, cells, sprites) are shared across calls.
    `full` is the first call (the station): only it makes the things that belong to the game as a whole (the loot pool, the mob sets, the
    tile table, the item definitions for jobs and closets); the others (shuttles) add the definitions for the items lying on them.
    `docks`: the shutters that close a shuttle's dock until it arrives (`poddoor/shuttledock`) are doors here (shut: they keep the air in; the director opens them on docking);
    elsewhere every poddoor is skipped, as they are opened by buttons that do not exist yet."""
    areas = shared['areas']
    area_idx = shared['area_idx']
    kind = bytearray(Wd * Ht)           # 0 space 1 floor 2 wall/window block 3 lattice-over-space
    area_a = [0] * (Wd * Ht)
    floor_c = [0xFFFF] * (Wd * Ht)
    wall_v = [0xFFFF] * (Wd * Ht)
    ft = bytearray(Wd * Ht)             # floor type: 0 none, else 1 + index into shared['floor_types']
    lat_a = bytearray(Wd * Ht)          # lattice over space: 1 lattice, 2 catwalk
    floor_types, floor_type_idx = shared['floor_types'], shared['floor_type_idx']
    roof = bytearray(Wd * Ht)
    cab = bytearray(Wd * Ht)            # 1 where there is a power cable (this TG joins every cable to its neighbours: cable.dm Connect_cable, so a tile is all there is to know)
    wall_variants = shared['wall_variants']     # {name, glass, cells[4], gr?}  index = left|right<<1
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

    def floor_type(turf_path):
        """What kind of floor this is, for taking it apart: plating (bare), a tile floor (the tile it leaves), or a reinforced floor."""
        raw = dm.lookup(turf_path)
        tile = raw.get('floor_tile')
        tile = tile.strip() if isinstance(tile, str) and tile.strip().startswith('/') else None
        intact = str(raw.get('intact', 'TRUE')).strip().upper() not in ('FALSE', '0')
        klass = 'engine' if turf_path.startswith('/turf/open/floor/engine') else ('tile' if intact else 'plating')
        if klass == 'plating':
            tile = None
        name = str(raw.get('name', '')).strip().strip('"') or {'plating': 'plating', 'engine': 'reinforced floor', 'tile': 'floor'}[klass]
        key = (klass, tile, name)
        if key not in floor_type_idx:
            floor_type_idx[key] = len(floor_types)
            floor_types.append({'k': klass, 'tile': tile, 'n': name})
        return 1 + floor_type_idx[key]

    def window_of(objs):
        """(tag, has_grille) for a full-tile window on this tile, else None. A window spawner always brings a grille."""
        for p, v in objs:
            if p.startswith('/obj/effect/spawner/structure/window') or '/fulltile' in p:
                tag = 'pwindow' if 'plasma' in p else ('rwindow' if 'reinforced' in p else 'window')
                return tag, p.startswith('/obj/effect/spawner/') or any(q == '/obj/structure/grille' for q, _ in objs)
        return None

    def grille_cell():
        """The grille sprite as a see-through panel: the dark field between the bars is a gap, not paint."""
        img = sl.compose([GRILLE], (32, 32))
        px = img.load()
        for yy in range(img.height):
            for xx in range(img.width):
                r_, g_, b_, a_ = px[xx, yy]
                if max(r_, g_, b_) < 48:
                    px[xx, yy] = (0, 0, 0, 0)
        return cells.add(img)

    def block_variant(icon, glass, name, grille=False):
        """Wall-like block type: 4 face cells indexed by (left connected) | (right connected) << 1.
        `gr` (windows with a grille) is the cell of the grille panel that stands just inside each glass face."""
        key = (icon, glass, grille)
        if key in wall_variant_idx:
            return wall_variant_idx[key]
        face = []
        for lr in range(4):
            left, right = bool(lr & 1), bool(lr & 2)
            adj = {'N': False, 'S': False, 'E': right, 'W': left, 'NE': False, 'NW': False, 'SE': False, 'SW': False}
            face.append(cells.add(smooth_image(icon, adj)))
        variant = {'name': name, 'glass': glass, 'cells': face}
        if grille:
            variant['gr'] = grille_cell()
        wall_variants.append(variant)
        wall_variant_idx[key] = len(wall_variants) - 1
        return wall_variant_idx[key]

    def closet_prop(p, r, base):
        icon, st = r.get('icon'), r.get('icon_state')
        is_crate = p.startswith('/obj/structure/closet/crate')
        if not (isinstance(st, str) and icon_ok(icon, st)) or (not is_crate and icon != 'icons/obj/closet.dmi'):
            return None
        base_state = resolve(p).get('icon_state') if is_crate else st
        if not (isinstance(base_state, str) and icon_ok(icon, base_state)):
            return None
        fr = closets.frames(spr, sl, icon, st, base_state, r, is_crate)
        if fr[0] < 0 or fr[4] < 0:
            return None
        raw = dm.lookup(p)
        names = re.findall(r'ACCESS_[A-Z_]+', str(raw.get('req_access', '')))
        one = re.findall(r'ACCESS_[A-Z_]+', str(raw.get('req_one_access', '')))
        num = lambda ns: sorted({dm.value(dm.defines[n]) for n in ns if n in dm.defines and isinstance(dm.value(dm.defines[n]), int)})
        acc = access_of(r)
        d = dict(base, k='closet', fr=fr, p=p.split('/', 2)[2], bb=1)
        if r.get('anchored') in (True, 1):
            d['anc'] = 1                                      # bolted down (the brig's lockers)
        if isinstance(r.get('drag_slowdown'), (int, float)) and r['drag_slowdown'] > 0:
            d['ds'] = r['drag_slowdown']                      # lockers slow you down like a prone body (1.5); crates do not
        secure = r.get('secure') is True
        if secure:
            d['sec'] = 1
            if r.get('locked') in (True, 1):
                d['lk'] = 1
        if 'ACCESS_ALL_PERSONAL_LOCKERS' in names:
            d['pl'] = 1                                   # personal locker: the first ID swiped owns it
        a, o = sorted(set(num(names)) | set(acc['a'])), sorted(set(num(one)) | set(acc['o']))
        if a:
            d['a'] = a
        if o:
            d['o'] = o
        if is_crate:
            d['hz'] = 1
        if r.get('dense_when_open') is True:
            d['do'] = 1
        if r.get('can_weld_shut') is False or is_crate:
            d['nw'] = 1
        if (is_crate and st == base_state + 'open') or r.get('opened') is True:
            d['op'] = 1
        bt = r.get('breakout_time')
        if isinstance(bt, int) and bt != 1200:
            d['bt'] = bt // 10
        return d

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
            if has_lat:
                lat_objs = [p for p, _ in objs if p.startswith('/obj/structure/lattice')]
                lat_a[i] = 2 if lat_objs[0].startswith('/obj/structure/lattice/catwalk') else 1       # drawn from the first one, like the cell below
        else:
            kind[i] = 1
            floor_c[i] = floor_cell(tp, tv, decals)
            ft[i] = floor_type(tp)
        tile_atoms[(x, y)] = (tp, tv, objs, atoms)

    def is_kind(x, y, *ks):
        return inb(x, y) and kind[idx(x, y)] in ks

    # fulltile windows become wall-like glass blocks
    WALL_FALLBACK = 'icons/turf/walls/wall.dmi'
    win_tiles = {}
    for (x, y), (tp, tv, objs, atoms) in tile_atoms.items():
        wi = window_of(objs)
        if wi:
            win_tiles[(x, y)] = wi
            kind[idx(x, y)] = 2

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
            tag, grille = win_tiles[(x, y)]
            icon = WIN_ICON[tag] if icon_ok(WIN_ICON[tag]) else WIN_ICON['rwindow']
            wall_v[i] = block_variant(icon, True, tag, grille)
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

    def mount_side(r, v, p, x, y, d):
        """The wall a mount is on, and how we know: the map's pixel offset (24 px = a whole wall away), else its `dir` if the map sets one
        (an APC's dir is the wall it hangs on; for everything else dir is the way it faces, so the wall is behind it), else whichever wall is there."""
        px, py = r.get('pixel_x', 0), r.get('pixel_y', 0)
        px = px if isinstance(px, (int, float)) else 0
        py = py if isinstance(py, (int, float)) else 0
        if abs(px) >= 12 or abs(py) >= 12:
            if abs(px) >= abs(py):
                return (E if px > 0 else W), 'pixel', px, py
            return (N if py > 0 else S), 'pixel', px, py
        if 'dir' in v and d in (N, S, E, W):
            cand = d if p.startswith('/obj/machinery/power/apc') else OPP[d]
            if wall_at(x + DVEC[cand][0], y + DVEC[cand][1]):
                return cand, 'dir', px, py
        return snap_wall_side(x, y), 'snap', px, py

    stats = collections.Counter()
    missing = collections.Counter()
    for (x, y), (tp, tv, objs, atoms) in tile_atoms.items():
        for p, v in objs:
            if p.startswith('/mob'):
                continue
            if p.startswith('/obj/structure/cable'):
                cab[idx(x, y)] = 1
                stats['cable'] += 1
                continue
            if p == '/obj/machinery/power/terminal':                      # under the floor: no picture, but the SMES it feeds is wired through it (`d`: which way it faces)
                props.append({'x': x - 1, 'y': Ht - y, 'd': dir_of(resolve(p, v)), 'k': 'mach', 't': 'terminal'})
                stats['terminal'] += 1
                continue
            if p.startswith(SKIP_PREFIXES):
                continue
            r = resolve(p, v)
            d = dir_of(r)
            nm = clean_name(r.get('name', ''))
            row, col = Ht - y, x - 1
            base = {'x': col, 'y': row, 'd': d, 'n': nm}
            den = 1 if r.get('density') is True else 0

            # --- solar panels and their trackers: flat on the floor, in a picture of our own
            if p in ('/obj/machinery/power/solar', '/obj/machinery/power/tracker'):
                trk = p.endswith('tracker')
                sp = spr.add_image(solar_image(trk), ('solar', trk))
                if sp >= 0:
                    props.append(dict(base, k='mach', t='tracker' if trk else 'solar', n='solar tracker' if trk else 'solar panel', s=sp, flat=1))
                    stats['solar'] += 1
                continue

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
            if docks and p.startswith('/obj/machinery/door/poddoor/shuttledock'):
                icon = r.get('icon')
                if icon_ok(icon, 'closed'):
                    dmi = sl.get_dmi(icon)
                    frames = [spr.add([(icon, 'closed', S, None, None)])]
                    if dmi.has('opening'):
                        for f in range(dmi.states['opening'].frames):
                            frames.append(spr.add([(icon, 'opening', S, None, None, f)]))
                    frames.append(spr.add([(icon, 'open', S, None, None)]))
                    props.append(dict(base, k='door', fr=frames, a=[], o=[], glass=0, t='poddoor', n='shuttle dock shutters'))
                    stats['door'] += 1
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
                    # what the fixture looks like with its glass smashed, burnt out, or taken out (lighting.dm: [fitting]-broken, -burned, -empty)
                    ss = [spr.add([(icon, '%s-%s' % (kl, s_), d, None, None)]) if icon_ok(icon, '%s-%s' % (kl, s_)) else sp for s_ in ('broken', 'burned', 'empty')]
                    props.append(dict(base, k='light', s=sp, lt=kl, c=col, ss=ss))
                    stats['light'] += 1
                continue

            # --- wall mounts
            if p.startswith(WALLMOUNT_PREFIXES):
                icon, st = r.get('icon'), r.get('icon_state')
                if isinstance(st, str) and icon_ok(icon, st):
                    side, how, mpx, mpy = mount_side(r, v, p, x, y, d)
                    face = OPP[side]
                    onwall = is_kind(x, y, 2)
                    if onwall:
                        # signs and the like are mapped ON the wall tile itself: they hang on the face that looks onto open floor, facing out
                        opts = [dd for dd in (S, N, E, W) if is_kind(x + DVEC[dd][0], y + DVEC[dd][1], 1)] or [dd for dd in (S, N, E, W) if not wall_at(x + DVEC[dd][0], y + DVEC[dd][1])]
                        if opts:
                            side = d if ('dir' in v and d in opts) else opts[0]
                            face, how = side, 'onwall'
                    stats['wm_' + how] += 1
                    if how == 'snap' and sum(1 for dd in (N, E, W, S) if wall_at(x + DVEC[dd][0], y + DVEC[dd][1])) > 1:
                        stats['wm_snap_corner'] += 1                 # more than one wall to choose from: a guess
                    sp = spr.add([(icon, st, face if sl.get_dmi(icon).states[st].dirs > 1 else S, None, None)])
                    if sp >= 0:
                        sub = p.split('/')[3] if p.count('/') >= 3 else 'misc'
                        if p.startswith('/obj/machinery/power/apc'):
                            sub = 'apc'
                        if p.startswith('/obj/structure/sign'):
                            sub = 'sign'
                        elif p.startswith('/obj/item/radio'):
                            sub = 'intercom'
                        # slid along the wall by the map's other pixel offset (side by side buttons, an alarm off to one side): +x on a north or south wall, +z on an east or west one
                        lat = int(max(-14, min(14, mpx if side in (N, S) else -mpy)))
                        rec = dict(base, k='wm', d=face, sd=side, s=sp, sub=sub, p=p)
                        if sub == 'apc' and isinstance(v.get('areastring'), str):
                            rec['as'] = v['areastring'].strip('"')        # the area it controls (by its path), when the map says
                        if how == 'onwall':
                            rec['ow'] = 1
                        if lat:
                            rec['lat'] = lat
                        props.append(rec)
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

            # --- closets, lockers and crates: open/closed/locked/welded sprites, access, and (in data/closets.json) contents
            if p.startswith('/obj/structure/closet'):
                cp = closet_prop(p, r, base)
                if cp:
                    props.append(cp)
                    shared.setdefault('closet_types', set()).add(p)
                    stats['closet'] += 1
                    continue

            # --- fans (survival_pod.dm): CanAtmosPass = ATMOS_PASS_NO, so air never goes through the tile they are on, whatever stands open beside them.
            # BoxStation has three, behind the poddoors of the chapel, disposal and toxins launchers, which open on space. Flat on the floor, not standing up.
            if p.startswith('/obj/structure/fans'):
                icon, st = r.get('icon'), r.get('icon_state')
                if isinstance(st, str) and icon_ok(icon, st):
                    sp = spr.add([(icon, st, S, None, None)])
                    if sp >= 0:
                        props.append(dict(base, k='fan', s=sp, den=den, inv=1 if 'invisible' in p else 0, p=p.split('/', 2)[2]))
                        stats['fan'] += 1
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
                cont = 1 if p.startswith(('/obj/structure/closet', '/obj/structure/rack')) else 0
                rec = dict(base, k='sprite', s=sp, den=den, bb=1, cont=cont, p=p.split('/', 2)[2])
                if any(sl.get_dmi(l[0]).states[l[1]].dirs > 1 for l in layers):
                    # it looks different from every side: the game picks the picture by where you stand (S, N, E, W as the thing is turned)
                    fr = [spr.add(dir_set(layers, dd)) for dd in (S, N, E, W)]
                    if all(f >= 0 for f in fr) and len(set(fr)) > 1:
                        rec['fr'] = fr
                        stats['directional'] += 1
                if r.get('anchored') in (True, 1):
                    rec['anc'] = 1
                if isinstance(r.get('drag_slowdown'), (int, float)) and r['drag_slowdown'] > 0:
                    rec['ds'] = r['drag_slowdown']
                if p.startswith('/obj/machinery/power/smes'):                 # what the map says of a storage unit's charge and capacity (the rest is in its parts)
                    for key, short in (('charge', 'sc'), ('capacity', 'sk')):
                        try:
                            rec[short] = float(str(v[key]).strip('"'))        # (only what the map itself sets: the defaults are the DM's, and in the parts)
                        except (KeyError, ValueError):
                            pass
                props.append(rec)
                stats['sprite'] += 1
                continue

    # loot pool sprites
    pool = []
    for pth, tag in (LOOT_POOL if full else []):
        r = resolve(pth)
        st, icon = r.get('icon_state'), r.get('icon')
        if isinstance(st, str) and icon_ok(icon, st):
            sp = spr.add([(icon, st, S, None, None)])
            if sp >= 0:
                pool.append({'p': pth, 'n': clean_name(r.get('name', pth.split('/')[-1])), 's': sp, 't': tag})

    # item definitions for the game systems: every path the jobs/outfits/containers refer to, plus the map's loot pool
    itemdefs = {}
    want = (list(GAME_ITEMS) + [q for q, _ in LOOT_POOL]) if full else []
    jobs_path = os.path.join(ROOT, 'data', 'jobs.json')
    if full and os.path.exists(jobs_path):
        for j in json.load(open(jobs_path))['jobs']:
            o = j['outfit']
            for k, v in o.items():
                if k == 'contents':
                    want += [c[0] for c in v]
                elif isinstance(v, str):
                    want.append(v)
    # everything lying around on the map is an item the game should know (so a hardsuit helmet on a shelf can be worn)
    want += sorted({pr['p'] for pr in props if pr['k'] == 'item' and pr.get('p')})
    pop = populate()

    def flat_rows(rows):
        for row in rows:
            if isinstance(row, dict):
                for _, sub in row['pick']:
                    yield from flat_rows(sub)
            else:
                yield row
    for ct in (sorted(shared.get('closet_types', ())) if full else []):
        want += [row[0] for row in flat_rows(pop.rows(ct))]
    cpath = os.path.join(ROOT, 'data', 'contents.json')
    if full and os.path.exists(cpath):
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
            # seconds to take it off someone / put it on someone (SS13's strip_delay and equip_delay_other; defaults 4 and 2)
            for key, var, dflt in (('sd', 'strip_delay', 4), ('ed', 'equip_delay_other', 2)):
                secs = delay_seconds(r.get(var))
                if secs is not None and slots and abs(secs - dflt) > 0.01:
                    itemdefs[pth][key] = secs
        else:
            missing['ITEM ' + pth] += 1

    mobs = build_mobs(spr) if full else {}

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
            full = pth if pth.startswith('/') else '/obj/' + pth      # prop paths are stored without the leading /obj/
            r = resolve(full)
            dsc = r.get('desc')
            descs[pth] = [clean_name(r.get('name', '')), dsc if isinstance(dsc, str) else '']
    # what each tile item turns a bit of plating into (turf_type): the floor type and the cell it is drawn with
    tiles = {}
    for tp_ in (('/obj/item/stack/tile/plasteel', '/obj/item/stack/tile/wood', '/obj/item/stack/tile/carpet', '/obj/item/stack/tile/carpet/blue',
                '/obj/item/stack/tile/grass', '/obj/item/stack/tile/circuit', '/obj/item/stack/tile/mineral/titanium', '/obj/item/stack/tile/mineral/plastitanium') if full else ()):
        turf = dm.lookup(tp_).get('turf_type')
        if isinstance(turf, str) and turf.strip().startswith('/turf/'):
            turf = turf.strip()
            tiles[tp_] = {'ft': floor_type(turf), 'cell': floor_cell(turf, {}, [])}
    print('  props', len(props), dict(stats))
    print('  unresolved:', missing.most_common(12))

    return dict(tiles=tiles, kind=kind, ft=ft, lat=lat_a, cab=cab, area=area_a, floor=floor_c, wall=wall_v, roof=roof, props=props, spawns=spawns,
                pool=pool, itemdefs=itemdefs, mobs=mobs, descs=descs)


# --------------------------------------------------------------------------- shuttles: each is a grid of its own

def load_template(template):
    """A shuttle template's tiles (DMM coordinates), its atoms by key, and the tile its mobile docking port sits on."""
    tg, tk = dmm.parse(os.path.join(TREE, '_maps/shuttles', template + '.dmm'))
    port = None
    for pos, key in tg.items():
        for p, v in tk[key]:
            if p.startswith('/obj/docking_port/mobile'):
                port = pos
    if port is None:
        raise SystemExit('no mobile port in ' + template)
    return tg, tk, port


def turf_of(atoms):
    for p, v in atoms:
        if p.startswith('/turf'):
            return p
    return None


def template_grid(tg, tk, port):
    """A shuttle template as a grid of its own, ready for process(): its tiles in a box of their own (the `template_noop` tiles are open space), without
    the docking port and the template's area. Returns the grid, its keys, its width and height, and the tile the port is on in the grid's own
    (col, row), which is where the grid is held to the dock."""
    live = {pos for pos, key in tg.items() if turf_of(tk[key]) not in (None, '/turf/template_noop')}
    xs, ys = [x for x, _ in live], [y for _, y in live]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    pad = 1                                     # a tile of open space all round: a body in a doorway reaches past the hull, and that must not be "off the grid"
    grid2, keys2 = {}, {}
    for y in range(y0 - pad, y1 + pad + 1):
        for x in range(x0 - pad, x1 + pad + 1):
            if (x, y) in live:
                atoms = [(p, v) for p, v in tk[tg[(x, y)]] if not (p.startswith('/obj/docking_port') or p.startswith('/area/template'))]
            else:
                atoms = [('/turf/open/space/basic', {}), ('/area/space', {})]
            nk = 'T%d_%d' % (x, y)
            keys2[nk] = atoms
            grid2[(x - x0 + pad + 1, y - y0 + pad + 1)] = nk
    return grid2, keys2, x1 - x0 + 1 + 2 * pad, y1 - y0 + 1 + 2 * pad, (port[0] - x0 + pad, y1 - port[1] + pad)


def rot_vec(dx, dy, k):
    for _ in range(k % 4):
        dx, dy = -dy, dx
    return dx, dy


def dock_rotation(grid, keys, tg, tk, port, sx, sy, Wd, Ht):
    """How many quarter turns (counter-clockwise, seen from above) put this shuttle at the dock (sx, sy) (DMM coordinates) so that it overlaps the
    station's own tiles least: the same choice SS13's dock transform makes."""
    best = None
    for rot in range(4):
        conflicts = 0
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
        if best is None or conflicts < best[0]:
            best = (conflicts, rot)
    return best[1], best[0]


def dock_pose(rot, port_cr, dock_cr):
    """Where a grid whose port tile is (col, row) `port_cr` in its own frame must be put, and turned `rot` quarter turns, so that this tile lies on the
    tile `dock_cr` of the station: [x, y, z] metres and a rotation about the vertical axis as a quaternion [x, y, z, w] (a positive turn is counter-clockwise from above)."""
    import math
    th = rot * math.pi / 2
    c, s_ = round(math.cos(th)), round(math.sin(th))
    lx, lz = port_cr[0] * 2 + 1, port_cr[1] * 2 + 1                  # the port tile's middle, in the grid's frame
    rx, rz = lx * c + lz * s_, -lx * s_ + lz * c                      # turned
    px, pz = dock_cr[0] * 2 + 1 - rx, dock_cr[1] * 2 + 1 - rz         # so that it lands on the dock tile's middle
    return [px, 0, pz], [0, math.sin(th / 2), 0, math.cos(th / 2)]


# (template, dock tile in DMM coordinates) for shuttles that sit at their docks when the round starts
ROUNDSTART_DOCKS = [
    ('arrival_box', 47, 110), ('labour_box', 90, 92), ('mining_large', 80, 150), ('mining_common_meta', 33, 127),
    ('cargo_box', 68, 139),
    ('escape_pod_default', 33, 103), ('escape_pod_default', 33, 117), ('escape_pod_default', 131, 183),
    ('escape_pod_default', 137, 77),
]
EMERGENCY_DOCK = ('emergency_box', 200, 118)


def crop(grid, x0, x1, y0, y1):
    """A rectangle of a map as a grid of its own: (x, y) in the part -> (x - x0 + 1, y - y0 + 1), coordinates from 1 as ever. Returns it with its width and height."""
    out = {}
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            out[(x - x0 + 1, y - y0 + 1)] = grid[(x, y)]
    return out, x1 - x0 + 1, y1 - y0 + 1


def build(mapname):
    print('parsing', mapname)
    grid, keys = dmm.parse(os.path.join(TREE, MAPS[mapname]))
    Wd, Ht = dmm.dims(grid)
    print('  grid', Wd, Ht, 'keys', len(keys), 'access defs', len(ACCESS_NUM))
    H = Ht
    cells = Cells()
    spr = Sprites()
    shared = {'areas': [], 'area_idx': {}, 'wall_variants': [], 'wall_variant_idx': {}, 'floor_types': [], 'floor_type_idx': {}}
    base = process(grid, keys, cells, spr, shared, Wd, Ht)            # the station alone: no shuttle is stamped into it

    # each shuttle is a grid of its own, built once per template; the docks (listed as (x, y-from-top)) place it
    blueprints, bases, placements, docks = {}, {}, [], {}
    itemdefs, descs = dict(base['itemdefs']), dict(base['descs'])

    def shuttle(template, sx, sy_top, kind, name):
        if template not in blueprints:
            tg, tk, port = load_template(template)
            g2, k2, w2, h2, port_cr = template_grid(tg, tk, port)
            print('  shuttle', template, w2, 'x', h2)
            res = process(g2, k2, cells, spr, shared, w2, h2, full=False)
            blueprints[template] = res
            bases[template] = (tg, tk, port, port_cr, w2, h2)
            itemdefs.update(res['itemdefs'])
            descs.update(res['descs'])
        tg, tk, port, port_cr, w2, h2 = bases[template]
        sy = H - sy_top
        rot, conflicts = dock_rotation(grid, keys, tg, tk, port, sx, sy, Wd, Ht)
        p, q = dock_pose(rot, port_cr, (sx - 1, sy_top))
        print('  dock %-20s at (%3d,%3d) turned %3d, conflicts %d' % (template, sx, sy_top, rot * 90, conflicts))
        return {'bp': template, 'kind': kind, 'name': name, 'p': p, 'q': q}

    for template, sx, sy_top in ROUNDSTART_DOCKS:
        pod = template.startswith('escape_pod')
        placements.append(shuttle(template, sx, sy_top, 'pod' if pod else 'shuttle', 'Escape Pod' if pod else ' '.join(w.capitalize() for w in template.split('_')[:-1]) + ' Shuttle'))
    tpl, sx, sy_top = EMERGENCY_DOCK
    docks['emergency'] = shuttle(tpl, sx, sy_top, 'shuttle', 'Emergency Shuttle')

    # Central Command: one blueprint, a map of its own, and the dock the emergency shuttle comes to
    cgrid, ckeys = dmm.parse(os.path.join(TREE, CENTCOM))
    cx0, cx1, cy0, cy1 = CENTCOM_PART
    part, cw, ch = crop(cgrid, cx0, cx1, cy0, cy1)
    print('  centcom', cw, 'x', ch)
    centcom = process(part, ckeys, cells, spr, shared, cw, ch, full=False, docks=True)
    itemdefs.update(centcom['itemdefs'])
    descs.update(centcom['descs'])
    tpl, dx, dy = CENTCOM_DOCK
    if tpl not in bases:
        raise SystemExit('the emergency shuttle template was not built')
    tg, tk, port, port_cr, w2, h2 = bases[tpl]
    sx, sy = dx - cx0 + 1, dy - cy0 + 1
    rot, conflicts = dock_rotation(part, ckeys, tg, tk, port, sx, sy, cw, ch)
    p, q = dock_pose(rot, port_cr, (sx - 1, ch - sy))
    print('  dock %-20s at centcom (%3d,%3d) turned %3d, conflicts %d' % (tpl, dx, dy, rot * 90, conflicts))
    centcom_docks = {'emergency': {'bp': tpl, 'kind': 'shuttle', 'name': 'Emergency Shuttle', 'p': p, 'q': q}}

    areas, wall_variants = shared['areas'], shared['wall_variants']
    ceiling_cell = cells.add(sl.compose([('icons/turf/floors.dmi', 'plating', S, '#8a8f99', None)], (32, 32)))
    flat_cell = cells.add(Image.new('RGBA', (32, 32), (255, 255, 255, 255)))
    # art for things made at run time: girders (structures.dmi), and the floors a dismantled wall or a laid tile leaves
    # (added last, so no existing cell or sprite id moves)
    structs = {}
    for key, state in (('girder', 'girder'), ('displaced', 'displaced'), ('reinforced', 'reinforced')):
        structs[key] = spr.add([('icons/obj/structures.dmi', state, S, None, None)])
    floors = {key: cells.add(sl.compose([('icons/turf/floors.dmi', state, S, None, None)], (32, 32)))
              for key, state in (('plating', 'plating'), ('floor', 'floor'), ('engine', 'engine'))}
    # a lattice or catwalk drawn for every pattern of lattice/floor neighbours (N S E W NE NW SE SW = bits 0..7), so one can be put up or cut away at run time
    lat_cells = {}
    for key, icon, base_state in (('lat', 'icons/obj/smooth_structures/lattice.dmi', 'lattice'), ('cat', 'icons/obj/smooth_structures/catwalk.dmi', 'catwalk')):
        row = []
        for mask in range(256):
            adj = {d: bool(mask & (1 << b)) for b, d in enumerate(('N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW'))}
            img = smooth_image(icon, adj, base_state)
            row.append(cells.add(img) if img is not None else 0xFFFF)
        lat_cells[key] = row
    # a cable laid on plating, for each of the 16 ways its four neighbours can join (N S E W = 1 2 4 8): the plating's cell with the cable drawn on it
    cable_cells = []
    for mask in range(16):
        state = 'l2-' + '-'.join(str(b) for b in (1, 2, 4, 8) if mask & b) if mask else 'l2-noconnection'
        cable_cells.append(cells.add(sl.compose([('icons/turf/floors.dmi', 'plating', S, None, None), ('icons/obj/power_cond/layer_cable.dmi', state, S, '#ffdd00', None)], (32, 32))))
    # the same cables as sprites with nothing under them, for the T-ray scanner to show through an intact floor
    cable_sprites = []
    for mask in range(16):
        state = 'l2-' + '-'.join(str(b) for b in (1, 2, 4, 8) if mask & b) if mask else 'l2-noconnection'
        cable_sprites.append(spr.add_image(sl.compose([('icons/obj/power_cond/layer_cable.dmi', state, S, '#ffdd00', None)], (32, 32)), ('cablespr', mask)))
    # a light tube or bulb as an item is whole, broken or burnt out (lighting.dm update(): ltube, ltube-broken, ltube-burned)
    light_items = {kind: [spr.add([('icons/obj/lighting.dmi', base + suffix, S, None, None)]) for suffix in ('', '-broken', '-burned')] for kind, base in (('tube', 'ltube'), ('bulb', 'lbulb'))}
    # make sure the three floors a player can make exist as types (the map has them all, this just says where)
    ftypes = shared['floor_types']
    print('  floor types:', ', '.join('%s%s' % (t['k'], ' (' + t['tile'].split('/')[-1] + ')' if t['tile'] else '') for t in ftypes))
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

    # What every grid shares (the art tables, areas, item definitions) sits at the top; each grid's own map (its arrays, props, spawn points)
    # is a "blueprint" under `grids`, and a `maps` entry says which blueprints float in it and where (a map is a space of grids).
    station = {
        'w': Wd, 'h': Ht,
        'ft': b64u8(base['ft']), 'lat': b64u8(base['lat']), 'cab': b64u8(base['cab']),
        'kind': b64u8(base['kind']), 'roof': b64u8(base['roof']),
        'area': b64u16(base['area']), 'floor': b64u16(base['floor']), 'wall': b64u16(base['wall']),
        'props': base['props'], 'spawns': base['spawns'],
    }
    grids = {'station': station}
    for template, res in blueprints.items():
        w2, h2 = bases[template][4], bases[template][5]
        grids[template] = {
            'w': w2, 'h': h2, 'ft': b64u8(res['ft']), 'lat': b64u8(res['lat']), 'cab': b64u8(res['cab']), 'kind': b64u8(res['kind']), 'roof': b64u8(res['roof']),
            'area': b64u16(res['area']), 'floor': b64u16(res['floor']), 'wall': b64u16(res['wall']),
            'props': res['props'], 'spawns': res['spawns'],
        }
    grids['centcom'] = {
        'w': cw, 'h': ch, 'ft': b64u8(centcom['ft']), 'lat': b64u8(centcom['lat']), 'cab': b64u8(centcom['cab']), 'kind': b64u8(centcom['kind']), 'roof': b64u8(centcom['roof']),
        'area': b64u16(centcom['area']), 'floor': b64u16(centcom['floor']), 'wall': b64u16(centcom['wall']),
        'props': centcom['props'], 'spawns': [],
    }
    level = {
        'name': mapname,
        'terrain': {'cols': cols, 'cells': len(cells.imgs), 'ceiling': ceiling_cell, 'flat': flat_cell, **floors},
        'structs': structs, 'floorTypes': ftypes, 'latCells': lat_cells, 'cableCells': cable_cells, 'cableSprites': cable_sprites, 'lightItems': light_items, 'tiles': base['tiles'],
        'areas': areas, 'walls': wall_variants, 'pool': base['pool'],
        'itemdefs': itemdefs, 'mobs': base['mobs'], 'descs': descs,
        'grids': grids,
        'maps': {'station': {'name': mapname, 'grids': [{'bp': 'station', 'kind': 'station', 'name': mapname, 'p': [0, 0, 0], 'q': [0, 0, 0, 1]}] + placements,
                             'docks': docks},
                 'centcom': {'name': 'Central Command', 'grids': [{'bp': 'centcom', 'kind': 'centcom', 'name': 'Central Command', 'p': [0, 0, 0], 'q': [0, 0, 0, 1]}],
                             'docks': centcom_docks}},
        'map': 'station',
    }
    # what each closet type holds (sim only): rows [item, count, chance %, stack amount] or {'pick': [[weight, rows]]}
    defs, pop = itemdefs, populate()

    def prune(rows):
        out = []
        for row in rows:
            if isinstance(row, dict):
                out.append({'pick': [[w, prune(sub)] for w, sub in row['pick']]})
            elif row[0] in defs:
                out.append(row)
        return out
    closet_data = {ct: prune(pop.rows(ct)) for ct in sorted(shared.get('closet_types', ()))}
    with open(os.path.join(ROOT, 'data', 'closets.json'), 'w') as f:
        json.dump({'_comment': 'Built by tools/build_level.py from the DM PopulateContents() of each closet type on the map.', **closet_data}, f, separators=(',', ':'))
    build_chars.build(itemdefs, resolve, dm, OUT)
    print('  closets: %d types, %d with contents' % (len(closet_data), sum(1 for v in closet_data.values() if v)))
    with open(os.path.join(OUT, 'level.json'), 'w') as f:
        json.dump(level, f, separators=(',', ':'))
    print('  wrote', os.path.getsize(os.path.join(OUT, 'level.json')) // 1024, 'KB level,',
          os.path.getsize(os.path.join(OUT, 'sprites.png')) // 1024, 'KB sprites,',
          os.path.getsize(os.path.join(OUT, 'terrain.png')) // 1024, 'KB terrain')


if __name__ == '__main__':
    build(sys.argv[1] if len(sys.argv) > 1 else 'BoxStation')
