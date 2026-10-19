"""Sprite resolution helpers shared by the build scripts."""
import os
import re
from PIL import Image
from dmi import Dmi

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '_src', 'tgstation')
_dmis = {}
DIRIDX = {2: 0, 1: 1, 4: 2, 8: 3, 6: 4, 10: 5, 5: 6, 9: 7}
CARD_FALLBACK = {4: {6: 0, 10: 0, 5: 1, 9: 1}}


_ci_cache = {}


def _resolve_case(path):
    """BYOND resolves file names case-insensitively; Linux does not."""
    full = os.path.join(SRC, path)
    if os.path.exists(full):
        return full
    cur = SRC
    for part in path.split('/'):
        nxt = os.path.join(cur, part)
        if not os.path.exists(nxt):
            if cur not in _ci_cache:
                try:
                    _ci_cache[cur] = {n.lower(): n for n in os.listdir(cur)}
                except OSError:
                    return None
            real = _ci_cache[cur].get(part.lower())
            if real is None:
                return None
            nxt = os.path.join(cur, real)
        cur = nxt
    return cur


def get_dmi(path):
    if path not in _dmis:
        try:
            real = _resolve_case(path)
            _dmis[path] = Dmi(real) if real else None
        except Exception:
            _dmis[path] = None
    return _dmis[path]


def first_arg(v):
    """MAP_SWITCH('a', 'b') -> a ; plain values pass through."""
    if isinstance(v, str):
        m = re.match(r'^\w+\((.*)\)$', v.strip())
        if m:
            a = m.group(1)
            depth = 0
            out = ''
            for ch in a:
                if ch == ',' and depth == 0:
                    break
                if ch in '([':
                    depth += 1
                if ch in ')]':
                    depth -= 1
                out += ch
            out = out.strip()
            if len(out) >= 2 and out[0] in '\'"' and out[-1] == out[0]:
                out = out[1:-1]
            return out
    return v


def dir_index(state, d):
    """BYOND dir value -> index inside a state's dir set."""
    idx = DIRIDX.get(d, 0)
    if state.dirs == 1:
        return 0
    if state.dirs == 4 and idx > 3:
        # diagonal on a 4-dir state: fall back to the vertical component
        return {4: 0, 5: 1, 6: 0, 7: 1}[idx]
    return idx if idx < state.dirs else 0


def tint(img, color=None, alpha=None):
    if color is None and (alpha is None or alpha >= 255):
        return img
    img = img.copy()
    px = img.load()
    r = g = b = 255
    if color:
        c = color.lstrip('#')
        if len(c) == 3:
            c = ''.join(ch * 2 for ch in c)
        r, g, b = int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16)
    a = 255 if alpha is None else alpha
    for y in range(img.height):
        for x in range(img.width):
            pr, pg, pb, pa = px[x, y]
            if pa:
                px[x, y] = (pr * r // 255, pg * g // 255, pb * b // 255, pa * a // 255)
    return img


def layer_image(layer):
    """layer = (icon, state, dir, color, alpha, frame) -> RGBA image or None"""
    icon, state, d, color, alpha = layer[:5]
    frame = layer[5] if len(layer) > 5 else 0
    dm = get_dmi(icon)
    if not dm or not dm.has(state):
        return None
    st = dm.states[state]
    return tint(dm.frame(state, dir_index(st, d), frame), color, alpha)


def compose(layers, size=None):
    imgs = [layer_image(l) for l in layers]
    imgs = [i for i in imgs if i is not None]
    if not imgs:
        return None
    w = size[0] if size else max(i.width for i in imgs)
    h = size[1] if size else max(i.height for i in imgs)
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    for i in imgs:
        # bottom-align oversized frames (BYOND anchors sprites at the tile's SW corner)
        out.alpha_composite(i, ((w - i.width) // 2, h - i.height))
    return out
