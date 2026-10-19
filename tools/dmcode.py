"""Tiny DM source scraper: collects `#define`s and per-type var overrides so we can look up
icon / icon_state / color / density for any map path by walking its ancestors."""
import os
import re

DIRS = {'NORTH': 1, 'SOUTH': 2, 'EAST': 4, 'WEST': 8}
_define = re.compile(r'^#define\s+([A-Z_0-9a-z]+)\s+(.+?)\s*(?://.*)?$')
_macro_def = re.compile(r'^#define\s+(\w+)\((\w+)\)\\\s*$')
_type_line = re.compile(r'^(/[A-Za-z0-9_/]+)\s*(?://.*)?$')
_assign = re.compile(r'^\t+(?:var/(?:[\w/]+/)?)?(\w+)\s*=\s*(.+?)\s*(?://.*)?$')


class DmCode:
    def __init__(self, root):
        self.defines = dict(DIRS)
        self.types = {}      # path -> {var: raw string}
        self.macros = {}     # name -> (param, body lines)
        files = []
        for dp, _, fn in os.walk(root):
            for f in fn:
                if f.endswith('.dm'):
                    files.append(os.path.join(dp, f))
        files.sort()
        for f in files:
            try:
                self._scan_defines(f)
            except Exception:
                pass
        for f in files:
            try:
                self._scan_types(f)
            except Exception:
                pass

    # -- pass 1
    def _scan_defines(self, path):
        lines = open(path, encoding='utf-8', errors='replace').read().split('\n')
        i = 0
        while i < len(lines):
            ln = lines[i]
            m = _macro_def.match(ln)
            if m:
                body = []
                i += 1
                while i < len(lines):
                    body.append(lines[i])
                    if not lines[i].rstrip().endswith('\\'):
                        break
                    i += 1
                self.macros[m.group(1)] = (m.group(2), [b.rstrip('\\').rstrip() for b in body])
            else:
                m = _define.match(ln)
                if m and '(' not in m.group(1):
                    self.defines[m.group(1)] = m.group(2)
            i += 1

    # -- pass 2
    def _scan_types(self, path):
        cur = None
        for ln in open(path, encoding='utf-8', errors='replace').read().split('\n'):
            if not ln or ln.startswith('//') or ln.startswith('#'):
                continue
            if ln[0] == '/':
                m = _type_line.match(ln)
                cur = m.group(1) if m else None
                if cur:
                    self.types.setdefault(cur, {})
                continue
            if ln[0] != '\t':
                mm = re.match(r'^(\w+)\((/[\w/]+)\)', ln)
                if mm and mm.group(1) in self.macros:
                    self._expand(mm.group(1), mm.group(2))
                cur = None
                continue
            if cur is None:
                continue
            if ln.startswith('\t\t'):
                continue
            m = _assign.match(ln)
            if m:
                self.types[cur][m.group(1)] = m.group(2)

    def _expand(self, name, arg):
        param, body = self.macros[name]
        text = '\n'.join(body).replace('##' + param, arg)
        for m in re.finditer(r'(/[\w/]+)\s*\{(.*?)\}', text, re.S):
            t = self.types.setdefault(m.group(1), {})
            for part in re.split(r';', m.group(2)):
                kv = re.match(r'\s*(\w+)\s*=\s*(.+?)\s*$', part)
                if kv:
                    t[kv.group(1)] = kv.group(2)

    # -- lookup
    def chain(self, path):
        parts = path.strip('/').split('/')
        out = []
        for i in range(1, len(parts) + 1):
            p = '/' + '/'.join(parts[:i])
            if p in self.types:
                out.append(p)
        return out

    def lookup(self, path):
        """Merged raw vars from root to leaf along the path chain."""
        props = {}
        for p in self.chain(path):
            props.update(self.types[p])
        return props

    def value(self, raw, depth=0):
        if raw is None or not isinstance(raw, str):
            return raw
        raw = raw.strip()
        if raw in self.defines and depth < 4:
            return self.value(self.defines[raw], depth + 1)
        if len(raw) >= 2 and raw[0] in '\'"' and raw[-1] == raw[0]:
            return raw[1:-1]
        if re.fullmatch(r'-?\d+(\.\d+)?', raw):
            return float(raw) if '.' in raw else int(raw)
        if raw in ('TRUE', 'FALSE'):
            return raw == 'TRUE'
        return raw

    def resolve(self, path):
        raw = self.lookup(path)
        return {k: self.value(v) for k, v in raw.items()}
