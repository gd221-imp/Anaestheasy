"""HISTORICAL: the one-off script that first split the single-file app into app/page.html + content/.
It does not know the current layout (fixed stop ids, shared cards, data in content/data/, app/ split into
styles.css and js/*.js), so do not use it to import changes. To find changes made directly in the live app,
compare the downloaded live page with a fresh dist/index.html (see CLAUDE.md) and copy them across by hand.
Usage (historical): python3 tools/split.py path/to/live-index.html"""
import json, re, sys, os, shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
C = ROOT / 'content'
SECTION_DIRS = {'__core': 'core-training-stops', '__st3': 'stage3-stops', '__cepod': 'emergency-cepod-stops'}

def slug(s, n=48):
    s = re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')
    return s[:n].strip('-') or 'item'

def wjson(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def wtext(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.suffix == '.html':
        text = pretty(text)
    path.write_text(text, encoding='utf-8')

BLOCK = r'(?:h[1-6]|p|ul|ol|li|table|thead|tbody|tr|div|section|blockquote|details|summary|figure|!--)'
def pretty(html):
    # one block element per line, so edits and diffs are readable; build.py joins them back
    return re.sub(r'>(?=<' + BLOCK + r'[\s>])|>(?=</(?:ul|ol|table|tbody|thead|div|section|details)>)', '>\n', html)

def write_stop(folder, st):
    """A stop/note dict -> folder/stop.json + cards/*.html + quiz.json"""
    st = json.loads(json.dumps(st))
    for i, c in enumerate(st.get('cards', [])):
        if isinstance(c, dict) and isinstance(c.get('b'), str):
            f = f'cards/{i+1:02d}-{slug(c.get("h", "card"))}.html'
            wtext(folder / f, c['b'] + '\n')
            c['b'] = 'file:' + f
    if isinstance(st.get('q'), list):
        wjson(folder / 'quiz.json', st['q'])
        st['q'] = 'file:quiz.json'
    wjson(folder / 'stop.json', st)

def main(src):
    L = Path(src).read_text(encoding='utf-8').split('\n')
    if C.exists(): shutil.rmtree(C)
    out = []
    i = 0
    def const(line):
        m = re.match(r'^const ([A-Z_0-9]+)=(.*);$', line)
        return (m.group(1), json.loads(m.group(2))) if m else (None, None)
    while i < len(L):
        line = L[i]
        if line == 'const STAGES=[':
            j = L.index('];', i)
            body = L[i+1:j]
            starts = [k for k, l in enumerate(body) if l.startswith('{id:"')]
            names = []
            for n, s in enumerate(starts):
                e = starts[n+1] if n+1 < len(starts) else len(body)
                sid = re.match(r'\{id:"([^"]+)",name:"([^"]+)"', body[s])
                fn = f'{n+1:02d}-{slug(sid.group(2))}.js'
                wtext(C / 'path' / 'stages' / fn, '\n'.join(body[s:e]) + '\n')
                names.append(fn)
            wjson(C / 'path' / 'stages' / '_order.json', names)
            out.append('/*@@STAGES@@*/')
            i = j + 1
            continue
        name, obj = (None, None)
        if line.startswith('const ') and len(line) > 2000:
            try: name, obj = const(line)
            except Exception: name = None
        if name in ('PRIMARY',):
            topics = []
            for tid, t in obj['topics'].items():
                f = f'topics/{slug(t["c"])}/{tid}-{slug(t["n"])}.html'
                wtext(C / 'primary' / f, t['h'] + '\n')
                meta = {k: v for k, v in t.items() if k != 'h'}
                topics.append({'id': tid, **meta, 'file': f})
            wjson(C / 'primary' / 'topics.json', topics)
            for k in obj:
                if k != 'topics': wjson(C / 'primary' / f'{k}.json', obj[k])
            wjson(C / 'primary' / '_keys.json', list(obj.keys()))
        elif name == 'IMPORTED':
            secs = []
            for sec, arr in obj.items():
                d = SECTION_DIRS.get(sec, slug(sec))
                secs.append({'key': sec, 'dir': d})
                for n, st in enumerate(arr):
                    kind = 'note' if st.get('note') else 'stop'
                    write_stop(C / 'specialties' / d / f'{n+1:03d}-{kind}-{slug(st["title"])}', st)
            wjson(C / 'specialties' / '_sections.json', secs)
        elif name in ('SBA_BANK', 'PSBA_BANK'):
            base = C / 'sba' / ('final' if name == 'SBA_BANK' else 'primary')
            by = {}
            for q in obj: by.setdefault(q['ar'], []).append(q)
            for ar, qs in by.items(): wjson(base / f'{slug(ar)}.json', qs)
            wjson(base / '_order.json', [q['id'] for q in obj])
        elif name in ('WPBA', 'RECIPES'):
            base = C / ('wpba' if name == 'WPBA' else 'recipes')
            idx = []
            for n, (k, v) in enumerate(obj.items()):
                f = f'{n+1:03d}-{slug(k)}.html'
                wtext(base / f, v + '\n'); idx.append({'name': k, 'file': f})
            wjson(base / '_index.json', idx)
        elif name == 'NEW_STOPS':
            names = []
            for n, e in enumerate(obj):
                fn = f'{n+1:02d}-{slug(e["stop"]["title"])}'
                write_stop(C / 'path' / 'added-stops' / fn / 'stop', e['stop'])
                wjson(C / 'path' / 'added-stops' / fn / 'placement.json', {k: v for k, v in e.items() if k != 'stop'})
                names.append(fn)
            wjson(C / 'path' / 'added-stops' / '_order.json', names)
        elif name == 'PREOP_STOP':
            write_stop(C / 'path' / 'preop-stop', obj)
        elif name in ('RECIPE_FILL', 'RECIPE_EDIT', 'RECIPE_ADD'):
            wjson(C / 'recipes' / 'extras' / f'{name}.json', obj)
        elif name in ('NG45_CARD', 'CURRIC_KC', 'DRUGS'):
            wjson(C / 'data' / f'{name}.json', obj)
        else:
            name = None
        out.append(f'/*@@{name}@@*/' if name else line)
        i += 1
    (ROOT / 'app').mkdir(exist_ok=True); (ROOT / 'app' / 'page.html').write_text('\n'.join(out), encoding='utf-8')

if __name__ == '__main__':
    main(sys.argv[1])
