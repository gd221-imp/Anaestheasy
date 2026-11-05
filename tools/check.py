"""Checks run on every pull request. Errors fail the check; warnings are shown for the reviewer.
Usage: python3 tools/check.py"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
C = ROOT / 'content'
errors, warnings = [], []

def err(p, msg): errors.append(f'{p}: {msg}')
def warn(p, msg): warnings.append(f'{p}: {msg}')

ABX = r'\b(co-amoxiclav|amoxicillin|ampicillin|piperacillin|tazocin|meropenem|gentamicin|vancomycin|teicoplanin|clindamycin|metronidazole|flucloxacillin|benzylpenicillin|cefuroxime|ceftriaxone|cefotaxime|cefazolin|cephalosporin|aciclovir|linezolid)\b'

# 1. JSON files parse
for p in C.rglob('*.json'):
    try: json.loads(p.read_text(encoding='utf-8'))
    except Exception as e: err(p.relative_to(ROOT), f'invalid JSON ({e})')

# 2. Quizzes: answer index inside the options
def check_quiz(p, qs):
    for n, q in enumerate(qs, 1):
        if not isinstance(q, dict) or not {'q', 'o', 'a'} <= q.keys():
            err(p, f'question {n} needs q, o and a'); continue
        if not (0 <= q['a'] < len(q['o'])):
            err(p, f'question {n}: answer index {q["a"]} is outside its {len(q["o"])} options')
for p in C.rglob('quiz.json'):
    try: check_quiz(p.relative_to(ROOT), json.loads(p.read_text(encoding='utf-8')))
    except Exception: pass
ids = set()
for bank in ('final', 'primary'):
    for p in (C / 'sba' / bank).glob('*.json'):
        if p.name.startswith('_'): continue
        try: qs = json.loads(p.read_text(encoding='utf-8'))
        except Exception: continue
        check_quiz(p.relative_to(ROOT), qs)
        for q in qs:
            if q.get('id') in ids: err(p.relative_to(ROOT), f'duplicate SBA id {q.get("id")}')
            ids.add(q.get('id'))

# 3. House rules in the text
# Recipes are the only place antibiotics are recommended, so the "Follow local guidelines" rule applies to them alone
# (pharmacology and microbiology notes may name antibiotics freely).
recipe_files = {p.resolve() for p in (C / 'recipes').glob('*.html')}
for sj in C.rglob('stop.json'):
    try: cards = json.loads(sj.read_text(encoding='utf-8')).get('cards', [])
    except Exception: continue
    for c in cards:
        if isinstance(c, dict) and c.get('recipe') and isinstance(c.get('b'), str) and c['b'].startswith('file:'):
            recipe_files.add((sj.parent / c['b'][5:]).resolve())
for p in C.rglob('*.html'):
    rel = p.relative_to(ROOT)
    t = p.read_text(encoding='utf-8')
    if re.search(r'intrathecal morphine|\bIT morphine', t, re.I):
        err(rel, 'house rule: intrathecal opioid is always diamorphine, never intrathecal morphine')
    if p.resolve() not in recipe_files: continue
    for line in t.split('\n'):
        if re.search(ABX, line, re.I) and not re.search(r'local (guideline|polic|protocol|antimicrobial)', line, re.I):
            plain = re.sub(r'<[^>]+>', '', line)[:110]
            warn(rel, f'recipe names an antibiotic without "Follow local guidelines": {plain}')

# 4. Links between stops, notes and Primary topics
stop_files = list(C.rglob('stop.json'))
linkable = set(re.findall(r'title:"([^"]+)"', ''.join(p.read_text(encoding='utf-8') for p in (C / 'path' / 'stages').glob('*.js'))))
stops = {}
for p in stop_files:
    try: stops[p] = json.loads(p.read_text(encoding='utf-8'))
    except Exception: continue
    if not stops[p].get('op'): linkable.add(stops[p].get('title'))
try: primary_ids = {t['id'] for t in json.loads((C / 'primary' / 'topics.json').read_text(encoding='utf-8'))}
except Exception: primary_ids = set()
for p, st in stops.items():
    rel = p.relative_to(ROOT)
    for c in st.get('cards', []):
        if not isinstance(c, dict): continue
        if 'noteRef' in c:
            if c['noteRef'] not in linkable: err(rel, f'linked note "{c["noteRef"]}" does not exist (check the exact title)')
        if 'primaryRef' in c and c['primaryRef'] not in primary_ids:
            err(rel, f'linked Primary topic "{c["primaryRef"]}" does not exist')
        b = c.get('b')
        if isinstance(b, str) and b.startswith('file:') and not (p.parent / b[5:]).exists():
            err(rel, f'card file {b[5:]} is missing')

# 4b. Stop ids: fixed, unique and well formed; every SBA link points at a real stop
ID_OK = re.compile(r'^[a-z0-9]+(-[a-z0-9]+)*$')
stop_ids = {}
def add_id(i, where):
    if not ID_OK.match(i): err(where, f'stop id "{i}" should be lower case letters, numbers and hyphens (e.g. st2-ruptured-aaa)')
    if i in stop_ids: err(where, f'stop id "{i}" is already used by {stop_ids[i]}; each stop needs its own id')
    else: stop_ids[i] = str(where)
for p in sorted(C.glob('specialties/*/*/stop.json')):
    try: d = json.loads(p.read_text(encoding='utf-8'))
    except Exception: continue
    if 'id' in d: add_id(d['id'], p.relative_to(ROOT))
for p in sorted((C / 'path' / 'stages').glob('*.js')):
    rel = p.relative_to(ROOT)
    for n, line in enumerate(p.read_text(encoding='utf-8').split('\n'), 1):
        m = re.match(r'\s*\{(id:"([^"]*)",)?t:"[a-z]+",.*?title:"([^"]+)"', line)
        if not m: continue
        if m.group(2): add_id(m.group(2), f'{rel}:{n}')
        else: err(f'{rel}:{n}', f'stop "{m.group(3)}" has no id: start it with {{id:"<stage>-<short-name>", (e.g. id:"st2-ruptured-aaa"), and never change an id once published')
for p in sorted((C / 'path' / 'added-stops').glob('*/placement.json')):
    try: add_id(json.loads(p.read_text(encoding='utf-8'))['id'], p.relative_to(ROOT))
    except (KeyError, ValueError): err(p.relative_to(ROOT), 'placement.json needs an "id"')
add_id('core-preop', 'content/path/preop-stop (id set in app/page.html)')
for p in sorted((C / 'sba' / 'final').glob('*.json')):
    if p.name.startswith('_'): continue
    try: qs = json.loads(p.read_text(encoding='utf-8'))
    except Exception: continue
    for q in qs:
        if q.get('st') and q['st'] not in stop_ids:
            err(p.relative_to(ROOT), f'SBA {q.get("id")} links to stop "{q["st"]}", which does not exist')

# 4c. Recipes and WPBAs have one source each: a stop's own cards/ file, or content/recipes|wpba for stops and notes without one
titles, owns = set(), {'recipes': set(), 'wpba': set()}
for p in C.glob('**/stop.json'):
    try: d = json.loads(p.read_text(encoding='utf-8'))
    except Exception: continue
    titles.add(d.get('title'))
    if not d.get('note'):
        cards = [c for c in d.get('cards', []) if isinstance(c, dict)]
        if any(c.get('recipe') for c in cards): owns['recipes'].add(d.get('title'))
        if any(c.get('wpba') for c in cards): owns['wpba'].add(d.get('title'))
for p in (C / 'path' / 'stages').glob('*.js'):
    titles |= set(re.findall(r'^\s*\{id:"[^"]*",t:"[a-z]+",.*?title:"([^"]+)"', p.read_text(encoding='utf-8'), re.M))
recipe_names = set()
for kind in ('recipes', 'wpba'):
    ip = C / kind / '_index.json'
    try: idx = json.loads(ip.read_text(encoding='utf-8'))
    except Exception: continue
    rel = ip.relative_to(ROOT)
    for e in idx:
        n, f = e.get('name'), e.get('file')
        if kind == 'recipes': recipe_names.add(n)
        if not f or not (C / kind / f).exists(): err(rel, f'"{n}": file {f} is missing')
        if n not in titles: err(rel, f'"{n}" does not match any stop or note title, so it is never shown')
        elif n in owns[kind]: err(rel, f'"{n}" already has its own {"recipe" if kind == "recipes" else "sample WPBA"} card in its stop folder; edit that file instead and remove this duplicate')
        if kind == 'wpba' and n not in recipe_names and n not in owns['recipes']:
            err(rel, f'"{n}" has no recipe, so its sample WPBA is never shown')
    listed = {e.get('file') for e in idx}
    for f in sorted(x.name for x in (C / kind).glob('*.html')):
        if f not in listed: err(f'content/{kind}/{f}', f'not listed in {kind}/_index.json, so it is never shown')

# 5. The app still builds
sys.path.insert(0, str(ROOT / 'tools'))
try:
    import build
    build.build()
except SystemExit as e: err('build', str(e))
except Exception as e: err('build', f'{type(e).__name__}: {e}')

# 6. JavaScript is valid (a syntax error anywhere means a blank app)
import shutil, subprocess, tempfile
MARKER = re.compile(r'^/\*@@([A-Z_0-9]+)@@\*/$', re.M)

def js_syntax(code, label, offset=0):
    """Run node --check on code; report label:line for the first syntax error."""
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as f:
        f.write(code); tmp = f.name
    try:
        r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True, timeout=60)
    finally:
        Path(tmp).unlink(missing_ok=True)
    if r.returncode == 0: return
    out = r.stderr
    m = re.search(re.escape(tmp) + r':(\d+)', out)
    line = int(m.group(1)) - offset if m else '?'
    msg = next((l.strip() for l in out.splitlines() if re.match(r'\s*\w*Error:', l)), out.strip().splitlines()[-1] if out.strip() else 'syntax error')
    err(f'{label}:{line}', f'JavaScript {msg}')

def script_only(text):
    """Keep only what sits inside <script> tags, blanking everything else, so line numbers still match the file."""
    keep, inside = [], False
    for l in text.split('\n'):
        if not inside and '<script' in l:
            inside = True; keep.append(l.split('>', 1)[1] if '>' in l else ''); continue
        if inside and '</script>' in l:
            inside = False; keep.append(l.split('</script>', 1)[0]); continue
        keep.append(l if inside else '')
    return '\n'.join(keep)

if not shutil.which('node'):
    warn('javascript', 'Node.js is not installed, so JavaScript syntax was not checked (it is checked on GitHub)')
else:
    for f in json.loads((C / 'path' / 'stages' / '_order.json').read_text(encoding='utf-8')):
        js_syntax('void [\n' + (C / 'path' / 'stages' / f).read_text(encoding='utf-8') + '\n];', f'content/path/stages/{f}', offset=1)
    page = (ROOT / 'app' / 'page.html').read_text(encoding='utf-8')
    js_syntax(MARKER.sub(lambda m: f'const {m.group(1)}=null;', script_only(page)), 'app/page.html')
    dist = ROOT / 'dist' / 'index.html'
    if dist.exists() and not errors:
        built = dist.read_text(encoding='utf-8')
        for m in MARKER.finditer(built): err('dist/index.html', f'build marker {m.group(0)} was not filled in')
        js_syntax(script_only(built), 'dist/index.html (built page; check content/ files)')

gh = bool(__import__('os').environ.get('GITHUB_ACTIONS'))
for w in warnings: print(f'::warning::{w}' if gh else f'WARNING {w}')
for e in errors: print(f'::error::{e}' if gh else f'ERROR   {e}')
print(f'\n{len(errors)} error(s), {len(warnings)} warning(s)')
sys.exit(1 if errors else 0)
