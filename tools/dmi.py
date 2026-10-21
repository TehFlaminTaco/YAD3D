"""Minimal BYOND .dmi reader (PNG with a zTXt 'Description' chunk) built on Pillow."""
import re
from PIL import Image

DIR_ORDER = ['S', 'N', 'E', 'W', 'SE', 'SW', 'NE', 'NW']


class State:
    def __init__(self, name):
        self.name = name
        self.dirs = 1
        self.frames = 1
        self.delays = None
        self.movement = False
        self.first = 0  # index of first image in the sheet


class Dmi:
    def __init__(self, path):
        self.path = path
        self.img = Image.open(path).convert('RGBA')
        meta = Image.open(path).info.get('Description', '')
        self.w = self.h = 32
        self.states = {}
        self.order = []
        cur = None
        for line in meta.splitlines():
            line = line.strip()
            m = re.match(r'(\w+)\s*=\s*(.*)', line)
            if not m:
                continue
            k, v = m.group(1), m.group(2).strip()
            if k == 'width':
                self.w = int(v)
            elif k == 'height':
                self.h = int(v)
            elif k == 'state':
                cur = State(v.strip('"'))
                self.order.append(cur)
                # duplicate names exist (movement=1); keep the first
                self.states.setdefault(cur.name, cur)
            elif cur is not None:
                if k == 'dirs':
                    cur.dirs = int(v)
                elif k == 'frames':
                    cur.frames = int(v)
                elif k == 'delay':
                    cur.delays = [float(x) for x in v.split(',')]
                elif k == 'movement':
                    cur.movement = v == '1'
        idx = 0
        for s in self.order:
            s.first = idx
            idx += s.dirs * s.frames
        self.cols = max(1, self.img.width // self.w)

    def tile(self, index):
        x = (index % self.cols) * self.w
        y = (index // self.cols) * self.h
        return self.img.crop((x, y, x + self.w, y + self.h))

    def frame(self, state, direction=0, frame=0):
        """direction is an index into DIR_ORDER (clamped to the state's dirs)."""
        s = self.states[state]
        d = direction if direction < s.dirs else 0
        f = frame if frame < s.frames else 0
        return self.tile(s.first + f * s.dirs + d)

    def has(self, state):
        return state in self.states
