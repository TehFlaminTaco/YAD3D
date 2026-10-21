"""Compose SS13 mob sprites (crew by job, carp, pets) from the real layered DMI art."""
import glob
import os
import zlib

from PIL import Image

import spritelib as sl

CLOTH_FILES = {}


def _index():
    if CLOTH_FILES:
        return
    base = sl.SRC
    for kind, pat in (('under', 'icons/mob/clothing/under/*.dmi'), ('feet', 'icons/mob/clothing/feet.dmi'),
                      ('head', 'icons/mob/clothing/head.dmi'), ('suit', 'icons/mob/clothing/suit.dmi'),
                      ('hands', 'icons/mob/clothing/hands.dmi'), ('mask', 'icons/mob/clothing/mask.dmi'),
                      ('back', 'icons/mob/clothing/back.dmi'), ('belt', 'icons/mob/clothing/belt.dmi')):
        idx = {}
        for f in sorted(glob.glob(os.path.join(base, pat))):
            rel = os.path.relpath(f, base)
            d = sl.get_dmi(rel)
            if not d:
                continue
            for s in d.order:
                idx.setdefault(s.name, rel)
        CLOTH_FILES[kind] = idx


def cloth(kind, state):
    _index()
    f = CLOTH_FILES[kind].get(state)
    return (f, state) if f else None


SKIN = ['#ffe3d3', '#f3cfae', '#e2b088', '#c68a58', '#8d5a34', '#5b3a22']
HAIR = ['#16120f', '#3a2616', '#6b4423', '#b88a3e', '#cfcfcf', '#8a2b1c']
HAIRSTYLE = ['hair_a', 'hair_b', 'hair_c', 'hair_d', 'hair_e', 'hair_f', 'bald', 'hair_bedhead', 'hair_ponytail']

# job -> outfit (state names in the 2020 clothing icon files)
OUTFITS = {
    'assistant': dict(under='grey', feet='black'),
    'station_engineer': dict(under='engine', feet='orange', head='hardhat0_yellow', hands='yellow'),
    'atmospheric_technician': dict(under='atmos', feet='black', head='hardhat0_white'),
    'chief_engineer': dict(under='chiefengineer', feet='brown', head='hardhat0_white', hands='black'),
    'medical_doctor': dict(under='medical', feet='white', suit='labcoat'),
    'chief_medical_officer': dict(under='cmo', feet='brown', suit='labcoat_cmo'),
    'paramedic': dict(under='paramedic', feet='white'),
    'chemist': dict(under='chemistry', feet='white', suit='labcoat_chem'),
    'virologist': dict(under='virology', feet='white', suit='labcoat_vir'),
    'geneticist': dict(under='genetics', feet='white', suit='labcoat_gen'),
    'scientist': dict(under='toxinswhite' , feet='white', suit='labcoat_tox'),
    'roboticist': dict(under='robotics', feet='black', hands='black'),
    'research_director': dict(under='director', feet='brown', suit='labcoat'),
    'security_officer': dict(under='security', feet='jackboots', head='helmet', hands='black'),
    'warden': dict(under='warden', feet='jackboots', hands='black'),
    'head_of_security': dict(under='hos', feet='jackboots', hands='black'),
    'detective': dict(under='detective', feet='brown'),
    'captain': dict(under='captain', feet='brown', head='captain', hands='captain'),
    'head_of_personnel': dict(under='hop', feet='brown'),
    'bartender': dict(under='bar', feet='black'),
    'cook': dict(under='chef', feet='black', head='chef'),
    'botanist': dict(under='hydroponics', feet='black'),
    'janitor': dict(under='janitor', feet='black'),
    'shaft_miner': dict(under='miner', feet='black'),
    'cargo_technician': dict(under='cargo', feet='black'),
    'quartermaster': dict(under='qm', feet='brown'),
    'clown': dict(under='clown', feet='clown'),
    'mime': dict(under='mime', feet='black'),
    'lawyer': dict(under='lawyer_black', feet='black'),
    'chaplain': dict(under='chaplain', feet='black'),
    'librarian': dict(under='red_suit', feet='black'),
    'prisoner': dict(under='prisoner', feet='orange'),
}
ALT = {'toxinswhite': 'scientist', 'bar': 'ba_suit', 'cargo': 'cargo_tech'}


def _img(icon, state, di):
    d = sl.get_dmi(icon)
    if not d or not d.has(state):
        return None
    return sl.tint(d.frame(state, sl.dir_index(d.states[state], [2, 1, 4, 8][di])), None, None)


def _tinted(icon, state, di, color):
    d = sl.get_dmi(icon)
    if not d or not d.has(state):
        return None
    return sl.tint(d.frame(state, sl.dir_index(d.states[state], [2, 1, 4, 8][di])), color, None)


def compose_human(job, variant):
    o = OUTFITS.get(job, OUTFITS['assistant'])
    skin = SKIN[variant % len(SKIN)]
    hair = HAIR[(variant * 5 + 2) % len(HAIR)]
    style = HAIRSTYLE[(variant * 3 + 1) % len(HAIRSTYLE)]
    male = variant % 2 == 0
    parts = 'icons/mob/human_parts_greyscale.dmi'
    out = []
    for di in range(4):
        layers = []
        order = ['human_r_leg', 'human_l_leg', 'human_chest_' + ('m' if male else 'f'), 'human_r_arm', 'human_l_arm',
                 'human_r_hand', 'human_l_hand', 'human_head_' + ('m' if male else 'f')]
        for st in order:
            layers.append(_tinted(parts, st, di, skin))
        u = o.get('under')
        c = cloth('under', u) or cloth('under', ALT.get(u, '')) or cloth('under', 'grey')
        if c:
            layers.append(_img(c[0], c[1], di))
        for kind in ('feet', 'hands', 'suit'):
            if o.get(kind):
                c = cloth(kind, o[kind])
                if c:
                    layers.append(_img(c[0], c[1], di))
        layers.append(_tinted('icons/mob/human_face.dmi', 'eyes', di, '#3a5fa0'))
        if style != 'bald':
            layers.append(_tinted('icons/mob/human_face.dmi', style, di, hair))
        for kind in ('mask', 'head'):
            if o.get(kind):
                c = cloth(kind, o[kind])
                if c:
                    layers.append(_img(c[0], c[1], di))
        im = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
        for l in layers:
            if l is not None:
                im.alpha_composite(l)
        out.append(im)
    return out


def lying(img):
    """SS13 shows the dead as the sprite turned on its side."""
    r = img.rotate(90, expand=False, resample=Image.NEAREST)
    return sl.tint(r, '#c8c8d8', None)


def build_mobs(spr):
    mobs = {}

    def reg(name, dir_frames, dead=None):
        entry = {'d': [[spr.add_image(im, ('mob', name, di, fi)) for fi, im in enumerate(frames)] for di, frames in enumerate(dir_frames)]}
        if dead is not None:
            entry['dead'] = spr.add_image(dead, ('mobdead', name))
        mobs[name] = entry

    for job in OUTFITS:
        for v in range(3):
            imgs = compose_human(job, v + (zlib.crc32(job.encode()) % 3))
            reg('%s_%d' % (job, v), [[im] for im in imgs], lying(imgs[0]))

    # space carp (3 walk frames per direction)
    carp = 'icons/mob/carp.dmi'
    d = sl.get_dmi(carp)
    if d and d.has('carp'):
        frames = [[d.frame('carp', sl.dir_index(d.states['carp'], [2, 1, 4, 8][di]), f) for f in range(d.states['carp'].frames)] for di in range(4)]
        dead = d.frame('carp_dead') if d.has('carp_dead') else None
        reg('carp', frames, dead)

    # pets
    pets = 'icons/mob/pets.dmi'
    for name, state, dead in (('corgi', 'corgi', 'corgi_dead'), ('cat', 'cat2', 'cat2_dead'), ('cat_b', 'cat', 'cat_dead')):
        d = sl.get_dmi(pets)
        if d and d.has(state):
            frames = [[d.frame(state, sl.dir_index(d.states[state], [2, 1, 4, 8][di]))] for di in range(4)]
            reg(name, frames, d.frame(dead) if d.has(dead) else None)

    # monkey + mouse
    for name, icon, state in (('monkey', 'icons/mob/monkey.dmi', 'monkey1'), ('mouse', 'icons/mob/animal.dmi', 'mouse_gray')):
        d = sl.get_dmi(icon)
        if d and d.has(state):
            frames = [[d.frame(state, sl.dir_index(d.states[state], [2, 1, 4, 8][di]))] for di in range(4)]
            reg(name, frames, d.frame(state + '_dead') if d.has(state + '_dead') else None)
    return mobs
