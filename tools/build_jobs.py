#!/usr/bin/env python3
"""Extract the real SS13 job slots / supervisors / access / outfits from the DM source into data/jobs.json."""
import glob
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from dmcode import DmCode  # noqa: E402

ROOT = os.path.normpath(os.path.join(HERE, '..'))
TREE = os.environ.get('YAD_TREE', os.path.join(ROOT, '_src', 'tg2020'))


def strip_comment(s):
    return re.sub(r'\s//.*$', '', s)


def parse_blocks(text):
    """tab-indented DM type blocks -> {path: {var: raw}} (multi-line parenthesised values joined)."""
    out = {}
    cur = None
    lines = text.split('\n')
    i = 0
    while i < len(lines):
        ln = lines[i]
        if ln.startswith('/'):
            if re.match(r'^/[\w/]+\s*(//.*)?$', ln):
                cur = ln.split()[0]
                out.setdefault(cur, {})
            else:
                cur = None
        elif cur and ln.startswith('\t') and not ln.startswith('\t\t'):
            m = re.match(r'^\t(?:var/(?:[\w/]+/)?)?(\w+)\s*=\s*(.*)$', ln)
            if m:
                val = strip_comment(m.group(2))
                while val.count('(') > val.count(')') and i + 1 < len(lines):
                    i += 1
                    val += ' ' + strip_comment(lines[i].strip())
                out[cur][m.group(1)] = val.strip()
        i += 1
    return out


def main():
    dm = DmCode(os.path.join(TREE, 'code'))
    access_num = {}
    for k, v in dm.defines.items():
        n = dm.value(v)
        if k.startswith('ACCESS_') and isinstance(n, int):
            access_num[k] = n
    num_name = {str(v): k[7:] for k, v in access_num.items()}

    blocks = {}
    for f in sorted(glob.glob(os.path.join(TREE, 'code/modules/jobs/job_types/*.dm'))):
        blocks.update(parse_blocks(open(f, encoding='utf-8', errors='replace').read()))

    def lst(raw):
        return re.findall(r'ACCESS_\w+', raw or '')

    def path_of(raw):
        m = re.match(r'(/[\w/]+)', raw or '')
        return m.group(1) if m else None

    jobs = []
    for path, v in blocks.items():
        if not path.startswith('/datum/job/') or path.count('/') != 3:
            continue
        title = (v.get('title') or '').strip('"')
        if not title or title in ('NOPE', 'AI', 'Cyborg'):
            continue
        outfit_path = path_of(v.get('outfit', ''))
        ob = {}
        # outfit chain: /datum/outfit/job -> job outfit (child overrides)
        base = blocks.get('/datum/outfit/job', {})
        for k, val in base.items():
            ob[k] = val
        for k, val in blocks.get(outfit_path, {}).items():
            ob[k] = val

        def slot(name):
            return path_of(ob.get(name, ''))

        contents = []
        for m in re.finditer(r'(/[\w/]+)\s*(?:=\s*(\d+))?', ob.get('backpack_contents', '')):
            if m.group(1).startswith('/obj'):
                contents.append([m.group(1), int(m.group(2) or 1)])
        acc = lst(v.get('access'))
        if not acc and (v.get('minimal_access')):
            acc = lst(v.get('minimal_access'))
        slug = re.sub(r'[^a-z0-9]+', '_', title.lower()).strip('_')
        total = int(re.match(r'-?\d+', v.get('total_positions', '0')).group(0)) if re.match(r'-?\d+', v.get('total_positions', '0')) else 0
        spawn = int(re.match(r'-?\d+', v.get('spawn_positions', '0')).group(0)) if re.match(r'-?\d+', v.get('spawn_positions', '0')) else 0
        jobs.append({
            'id': slug, 'title': title, 'supervisors': (v.get('supervisors') or '').strip('"'),
            'total': total, 'spawn': spawn, 'color': (v.get('selection_color') or '#ffffff').strip('"'),
            'head': re.findall(r'"([^"]+)"', v.get('department_head', '')),
            'access': sorted({access_num[a] for a in acc if a in access_num}),
            'allAccess': 'get_all_accesses' in open(os.path.join(TREE, 'code/modules/jobs/job_types', os.path.basename(path.split('/')[-1]) + '.dm')).read() if False else False,
            'outfit': {
                'uniform': slot('uniform'), 'suit': slot('suit'), 'shoes': slot('shoes'), 'gloves': slot('gloves'),
                'glasses': slot('glasses'), 'ears': slot('ears'), 'mask': slot('mask'), 'head': slot('head'),
                'neck': slot('neck'), 'belt': slot('belt'), 'id': slot('id'), 'lpocket': slot('l_pocket'),
                'rpocket': slot('r_pocket'), 'suit_store': slot('suit_store'),
                'back': path_of(ob.get('backpack', '')) or slot('back'), 'box': slot('box'), 'contents': contents,
            },
        })

    # jobs with special get_access()
    src_all = ''.join(open(f, encoding='utf-8', errors='replace').read() for f in glob.glob(os.path.join(TREE, 'code/modules/jobs/job_types/*.dm')))
    for j in jobs:
        if j['id'] == 'captain':
            j['allAccess'] = True
        if j['id'] == 'assistant':
            j['access'] = sorted(set(j['access']) | {access_num.get('ACCESS_MAINT_TUNNELS')})
        if j['id'] not in ('captain',):
            j['access'] = sorted(set(j['access']) | {access_num['ACCESS_MAINT_TUNNELS']}) if j['id'] in ('assistant',) else j['access']
    jobs.sort(key=lambda j: j['title'])
    out = {'jobs': jobs, 'access': num_name}
    os.makedirs(os.path.join(ROOT, 'data'), exist_ok=True)
    json.dump(out, open(os.path.join(ROOT, 'data', 'jobs.json'), 'w'), indent=1)
    print(len(jobs), 'jobs;', len(num_name), 'access names')
    for j in jobs:
        print('%-24s %2d/%2d  %-4s access=%-2d  %s' % (j['title'], j['spawn'], j['total'], j['id'][:4], len(j['access']), {k: (v.split('/')[-1] if isinstance(v, str) else v) for k, v in j['outfit'].items() if v and k in ('uniform', 'shoes', 'ears', 'belt', 'back', 'box', 'head')}))


if __name__ == '__main__':
    main()
