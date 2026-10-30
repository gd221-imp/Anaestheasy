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

gh = bool(__import__('os').environ.get('GITHUB_ACTIONS'))
for w in warnings: print(f'::warning::{w}' if gh else f'WARNING {w}')
for e in errors: print(f'::error::{e}' if gh else f'ERROR   {e}')
print(f'\n{len(errors)} error(s), {len(warnings)} warning(s)')
sys.exit(1 if errors else 0)
