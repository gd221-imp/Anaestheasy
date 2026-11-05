"""Checks run on every pull request. Errors fail the check; warnings are shown for the reviewer.
Usage: python3 tools/check.py"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
C = ROOT / 'content'
errors, warnings = [], []

def err(p, msg): errors.append(f'{p}: {msg}')
def warn(p, msg): warnings.append(f'{p}: {msg}')

# index the content tree once; every check below reads from this list
FILES = sorted(p for p in C.rglob('*') if p.is_file())
def files(suffix=None, name=None):
    return [p for p in FILES if (suffix is None or p.suffix == suffix) and (name is None or p.name == name)]

ABX = r'\b(co-amoxiclav|amoxicillin|ampicillin|piperacillin|tazocin|meropenem|gentamicin|vancomycin|teicoplanin|clindamycin|metronidazole|flucloxacillin|benzylpenicillin|cefuroxime|ceftriaxone|cefotaxime|cefazolin|cephalosporin|aciclovir|linezolid)\b'

# 1. JSON files parse
for p in files('.json'):
    try: json.loads(p.read_text(encoding='utf-8'))
    except Exception as e: err(p.relative_to(ROOT), f'invalid JSON ({e})')

# 2. Quizzes: answer index inside the options
def check_quiz(p, qs):
    for n, q in enumerate(qs, 1):
        if not isinstance(q, dict) or not {'q', 'o', 'a'} <= q.keys():
            err(p, f'question {n} needs q, o and a'); continue
        if not (0 <= q['a'] < len(q['o'])):
            err(p, f'question {n}: answer index {q["a"]} is outside its {len(q["o"])} options')
for p in files(name='quiz.json'):
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
for sj in files(name='stop.json'):
    try: cards = json.loads(sj.read_text(encoding='utf-8')).get('cards', [])
    except Exception: continue
    for c in cards:
        if isinstance(c, dict) and c.get('recipe') and isinstance(c.get('b'), str) and c['b'].startswith('file:'):
            recipe_files.add((sj.parent / c['b'][5:]).resolve())
from html.parser import HTMLParser
VOID = {'br', 'hr', 'img', 'input', 'meta', 'link', 'col', 'area', 'base', 'wbr', 'source'}
class TagBalance(HTMLParser):
    def __init__(self): super().__init__(convert_charrefs=True); self.stack, self.problems = [], []
    def handle_starttag(self, tag, attrs):
        if tag not in VOID: self.stack.append((tag, self.getpos()[0]))
    def handle_endtag(self, tag):
        if tag in VOID: return
        if self.stack and self.stack[-1][0] == tag: self.stack.pop(); return
        if any(t == tag for t, _ in self.stack):
            while self.stack[-1][0] != tag:
                t, n = self.stack.pop(); self.problems.append(f'line {n}: <{t}> is never closed')
            self.stack.pop()
        else: self.problems.append(f'line {self.getpos()[0]}: </{tag}> has no matching <{tag}>')
def tag_problems(text):
    b = TagBalance(); b.feed(text); b.close()
    return b.problems + [f'line {n}: <{t}> is never closed' for t, n in b.stack]

CANNULA = re.compile(r'\b(14|16|20)\s?G\b')
def cannula_order(line):
    """House rule: 20G then 16G. True if a 14G/16G cannula is listed before a 20G one on the same line."""
    sizes = [m.group(1) for m in CANNULA.finditer(line)]
    return '20' in sizes and any(s in ('14', '16') for s in sizes[:sizes.index('20')])

# Complications in a recipe: Surgical then Anaesthetic, each with Immediate then Delayed
def complications_problem(t):
    m = re.search(r'<p class="subh">Complications</p>\s*([\s\S]*?)(?=<p class="subh">(?!Immediate</p>|Delayed</p>)|<h4>|<h3|$)', t)
    if not m: return 'has no Complications field'
    parts = re.split(r'<p class="csub"><b>(Surgical|Anaesthetic)</b></p>', m.group(1))
    if parts[1::2] != ['Surgical', 'Anaesthetic']: return 'Complications should be split into Surgical then Anaesthetic'
    for head, body in zip(parts[1::2], parts[2::2]):
        if re.findall(r'<p class="subh">(Immediate|Delayed)</p>', body) != ['Immediate', 'Delayed']:
            return f'{head} complications should have Immediate then Delayed'
    return None
todo_path = ROOT / 'tools' / 'complications_todo.json'
complications_todo = set(json.loads(todo_path.read_text(encoding='utf-8'))) if todo_path.exists() else set()
still_todo = []

for p in files('.js') + files('.json'):
    t = p.read_text(encoding='utf-8')
    if re.search(r'intrathecal morphine|\bIT morphine', t, re.I):
        err(p.relative_to(ROOT), 'house rule: intrathecal opioid is always diamorphine, never intrathecal morphine')
    if p.suffix == '.js':
        for n, line in enumerate(t.split('\n'), 1):
            if cannula_order(line): err(f'{p.relative_to(ROOT)}:{n}', 'house rule: list cannulas 20G then 16G')
for p in files('.html'):
    rel = p.relative_to(ROOT)
    t = p.read_text(encoding='utf-8')
    if re.search(r'intrathecal morphine|\bIT morphine', t, re.I):
        err(rel, 'house rule: intrathecal opioid is always diamorphine, never intrathecal morphine')
    for problem in tag_problems(t): err(rel, f'HTML {problem} (to show a < or > as text, write &lt; or &gt;)')
    for n, line in enumerate(t.split('\n'), 1):
        if cannula_order(line): err(f'{rel}:{n}', 'house rule: list cannulas 20G then 16G')
    if p.resolve() not in recipe_files: continue
    problem, key = complications_problem(t), str(rel)
    if problem and key in complications_todo: still_todo.append(key)
    elif problem: err(rel, f'house rule: {problem} (see CONTRIBUTING.md)')
    elif key in complications_todo: err('tools/complications_todo.json', f'{key} now has the right Complications layout: remove it from this list')
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
        if 'shared' in c and not (C / 'data' / f"{c['shared']}.json").exists():
            err(rel, f'shared card "{c["shared"]}" does not exist (expected content/data/{c["shared"]}.json)')
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
for p in files(name='stop.json'):
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

# 4d. Every link and placement points at something real
try: curric = {d['n'] for d in json.loads((C / 'data' / 'CURRIC_DOMAINS.json').read_text(encoding='utf-8'))}
except Exception as e: curric = set(); err('content/data/CURRIC_DOMAINS.json', f'could not read the curriculum domains ({e})')
def check_link(k, where):
    if k.startswith('stop:'):
        if k[5:] not in titles: err(where, f'link "{k}" points at a stop or note that does not exist (check the exact title)')
    elif k.startswith('curric:'):
        if not k[7:].isdigit() or int(k[7:]) not in curric: err(where, f'link "{k}" is not a curriculum domain')
    elif k.split('|')[0] not in primary_ids: err(where, f'link "{k}" is not a Primary topic id')
for p in files(name='stop.json'):
    try: cards = json.loads(p.read_text(encoding='utf-8')).get('cards', [])
    except Exception: continue
    for c in cards:
        for k in (c.get('links') or []) if isinstance(c, dict) else []: check_link(k, p.relative_to(ROOT))
for p in (C / 'path' / 'stages').glob('*.js'):
    for m in re.finditer(r'links:\[([^\]]*)\]', p.read_text(encoding='utf-8')):
        for k in re.findall(r'"([^"]+)"', m.group(1)): check_link(k, p.relative_to(ROOT))
for name in ('map', 'syllabus'):
    fp = C / 'primary' / f'{name}.json'
    try: groups = json.loads(fp.read_text(encoding='utf-8'))
    except Exception: continue
    for keys in groups.values():
        for k in keys: check_link(k, fp.relative_to(ROOT))
stage_ids = set(re.findall(r'^\{id:"([a-z0-9]+)",name:', ''.join(p.read_text(encoding='utf-8') for p in (C / 'path' / 'stages').glob('*.js')), re.M))
for p in sorted((C / 'path' / 'added-stops').glob('*/placement.json')):
    try: d = json.loads(p.read_text(encoding='utf-8'))
    except Exception: continue
    rel = p.relative_to(ROOT)
    if d.get('stage') not in stage_ids: err(rel, f'stage "{d.get("stage")}" does not exist (use one of {", ".join(sorted(stage_ids))})')
    for k in ('after', 'before'):
        if d.get(k) and d[k] not in titles: err(rel, f'"{k}": "{d[k]}" is not a stop title, so this stop would be put at the end of its stage')

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
    # each script file on its own (exact file and line), then all of them joined (catches clashes between files)
    sys.path.insert(0, str(ROOT / 'tools')); import build as _build
    fill = lambda code: _build.TEXT.sub('""', MARKER.sub(lambda m: f'const {m.group(1)}=null;', code))
    joined, origin = [], []
    for m in _build.INCLUDE.finditer((ROOT / 'app' / 'page.html').read_text(encoding='utf-8')):
        f = ROOT / 'app' / m.group(1)
        if not f.exists(): err('app/page.html', f'includes {m.group(1)}, which does not exist'); continue
        if f.suffix != '.js': continue
        code = fill(f.read_text(encoding='utf-8'))
        js_syntax(code, f'app/{m.group(1)}')
        for n, line in enumerate(code.split('\n'), 1): joined.append(line); origin.append(f'app/{m.group(1)}:{n}')
    if joined and not errors:
        before = len(errors); js_syntax('\n'.join(joined), 'app scripts joined')
        for k in range(before, len(errors)):
            mm = re.match(r'app scripts joined:(\d+): (.*)', errors[k])
            if mm and mm.group(1).isdigit() and int(mm.group(1)) <= len(origin): errors[k] = f'{origin[int(mm.group(1)) - 1]}: {mm.group(2)} (when the app files are joined)'
    if not errors: js_syntax(fill(script_only(_build.assemble_page())), 'app/page.html (assembled)')
    dist = ROOT / 'dist' / 'index.html'
    if dist.exists() and not errors:
        built = dist.read_text(encoding='utf-8')
        for m in MARKER.finditer(built): err('dist/index.html', f'build marker {m.group(0)} was not filled in')
        js_syntax(script_only(built), 'dist/index.html (built page; check content/ files)')

gh = bool(__import__('os').environ.get('GITHUB_ACTIONS'))
for w in warnings: print(f'::warning::{w}' if gh else f'WARNING {w}')
for e in errors: print(f'::error::{e}' if gh else f'ERROR   {e}')
if still_todo: print(f'To do: {len(still_todo)} recipe(s) still need Complications split into Surgical/Anaesthetic x Immediate/Delayed (listed in tools/complications_todo.json)')
print(f'\n{len(errors)} error(s), {len(warnings)} warning(s)')
sys.exit(1 if errors else 0)
