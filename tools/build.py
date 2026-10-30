"""Assemble app/page.html + content/ into dist/index.html (one self-contained page).
Usage: python3 tools/build.py   ->  dist/index.html"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
C = ROOT / 'content'

def rj(p): return json.loads(Path(p).read_text(encoding='utf-8'))
def rt(p):
    t = Path(p).read_text(encoding='utf-8')
    return t[:-1] if t.endswith('\n') else t
def html(p):
    # line breaks between tags are layout only; any other line break becomes a space
    t = rt(p)
    t = re.sub(r'>[ \t]*\r?\n\s*<', '><', t)
    return re.sub(r'\s*\r?\n\s*', ' ', t)

def dump(o): return json.dumps(o, ensure_ascii=False).replace('</', '<\\/')

def read_stop(folder):
    st = rj(folder / 'stop.json')
    for c in st.get('cards', []):
        if isinstance(c, dict) and isinstance(c.get('b'), str) and c['b'].startswith('file:'):
            c['b'] = html(folder / c['b'][5:])
    if st.get('q') == 'file:quiz.json':
        st['q'] = rj(folder / 'quiz.json')
    return st

def subdirs(p): return sorted(d for d in p.iterdir() if d.is_dir())

def build_const(name):
    if name == 'STAGES':
        parts = [rt(C / 'path' / 'stages' / f) for f in rj(C / 'path' / 'stages' / '_order.json')]
        return 'const STAGES=[\n' + '\n'.join(parts) + '\n];'
    if name == 'PRIMARY':
        o = {}
        for k in rj(C / 'primary' / '_keys.json'):
            if k == 'topics':
                o['topics'] = {}
                for t in rj(C / 'primary' / 'topics.json'):
                    t = dict(t); tid = t.pop('id'); f = t.pop('file')
                    o['topics'][tid] = {**t, 'h': html(C / 'primary' / f)}
            else:
                o[k] = rj(C / 'primary' / f'{k}.json')
    elif name == 'IMPORTED':
        o = {}
        for s in rj(C / 'specialties' / '_sections.json'):
            o[s['key']] = [read_stop(d) for d in subdirs(C / 'specialties' / s['dir'])]
    elif name in ('SBA_BANK', 'PSBA_BANK'):
        base = C / 'sba' / ('final' if name == 'SBA_BANK' else 'primary')
        allq = {}
        for f in sorted(base.glob('*.json')):
            if f.name.startswith('_'): continue
            for q in rj(f):
                if q['id'] in allq: sys.exit(f'Duplicate question id {q["id"]} in {f}')
                allq[q['id']] = q
        order = rj(base / '_order.json')
        o = [allq.pop(i) for i in order if i in allq] + list(allq.values())  # new ids go at the end
    elif name in ('WPBA', 'RECIPES'):
        base = C / ('wpba' if name == 'WPBA' else 'recipes')
        o = {e['name']: html(base / e['file']) for e in rj(base / '_index.json')}
    elif name == 'NEW_STOPS':
        o = []
        for fn in rj(C / 'path' / 'added-stops' / '_order.json'):
            d = C / 'path' / 'added-stops' / fn
            e = rj(d / 'placement.json'); e['stop'] = read_stop(d / 'stop'); o.append(e)
    elif name == 'PREOP_STOP':
        o = read_stop(C / 'path' / 'preop-stop')
    elif name in ('RECIPE_FILL', 'RECIPE_EDIT', 'RECIPE_ADD'):
        o = rj(C / 'recipes' / 'extras' / f'{name}.json')
    else:
        o = rj(C / 'data' / f'{name}.json')
    return f'const {name}={dump(o)};'

def build():
    page = (ROOT / 'app' / 'page.html').read_text(encoding='utf-8')
    out = re.sub(r'^/\*@@([A-Z_0-9]+)@@\*/$', lambda m: build_const(m.group(1)), page, flags=re.M)
    (ROOT / 'dist').mkdir(exist_ok=True)
    (ROOT / 'dist' / 'index.html').write_text(out, encoding='utf-8')
    return out

if __name__ == '__main__':
    out = build()
    print(f'Built dist/index.html ({len(out.encode())/1e6:.2f} MB)')
