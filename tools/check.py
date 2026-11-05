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
for p in C.rglob('*.html'):
    rel = p.relative_to(ROOT)
    t = p.read_text(encoding='utf-8')
    if re.search(r'intrathecal morphine|\bIT morphine', t, re.I):
        err(rel, 'house rule: intrathecal opioid is always diamorphine, never intrathecal morphine')
    for line in t.split('\n'):
        if re.search(ABX, line, re.I) and not re.search(r'local (guideline|polic|protocol|antimicrobial)', line, re.I):
            plain = re.sub(r'<[^>]+>', '', line)[:110]
            warn(rel, f'antibiotic named without "Follow local guidelines": {plain}')

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
    rel = p.relative_to(ROOT); notes = 0
    for c in st.get('cards', []):
        if not isinstance(c, dict): continue
        if 'noteRef' in c:
            notes += 1
            if c['noteRef'] not in linkable: err(rel, f'linked note "{c["noteRef"]}" does not exist (check the exact title)')
        if 'primaryRef' in c and c['primaryRef'] not in primary_ids:
            err(rel, f'linked Primary topic "{c["primaryRef"]}" does not exist')
        b = c.get('b')
        if isinstance(b, str) and b.startswith('file:') and not (p.parent / b[5:]).exists():
            err(rel, f'card file {b[5:]} is missing')
    if notes > 3: warn(rel, f'house rule: {notes} linked note topics (maximum 3 per stop)')

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
