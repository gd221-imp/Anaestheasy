"""Plain-English review summary for a pull request: which workstreams it touches, links that open each
changed stop in the PR preview, quiz and SBA changes laid out with the correct answer marked, and dose changes.

Usage:  python3 tools/pr_summary.py BASE HEAD [--preview URL] [--post]
  BASE, HEAD   git commits to compare (e.g. origin/main HEAD)
  --preview    PR preview address; adds "open in preview" links
  --post       post or update one comment on the pull request (GitHub Actions only)
Prints the summary as Markdown. In GitHub Actions it is also added to the job summary."""
import json, os, re, subprocess, sys, urllib.parse, urllib.request
from pathlib import PurePosixPath as P

MARK = '<!-- anaesthetic-ally-review-summary -->'
LIMIT = 60000  # GitHub comments max out at 65,536 characters

# Keep in step with WORKSTREAMS.md and .github/CODEOWNERS
SPEC = {3: 'cardiac thoracic vascular neuro icm pain',
        4: 'obstetrics paeds periop-medicine general-surgery urology orthopaedics trauma head-and-neck plastics '
           'ophthalmology critical-incidents miscellaneous emergency-cepod-stops',
        1: 'core-training-stops', 6: 'stage3-stops'}
WS_NAMES = {1: 'Foundation and Core training', 2: 'Primary FRCA', 3: 'Final FRCA A', 4: 'Final FRCA B',
            5: 'Recipes and WPBAs', 6: 'Stage 3, Consultant and careers', 8: 'Technical and App Store'}
STAGE_WS = {'01-foundation.js': 1, '02-core-training.js': 1, '03-stage-2.js': 4, '04-stage-3.js': 6, '05-consultant.js': 6}

def workstream(path):
    p = path.split('/')
    if p[0] in ('app', 'tools', '.github') or path in ('cspell.json', 'content/data/DRUGS.json', 'content/data/NG45_CARD.json'):
        return 8
    if p[0] != 'content': return None  # README and other docs
    if p[1] == 'specialties' and len(p) > 2:
        return next((ws for ws, dirs in SPEC.items() if p[2] in dirs.split()), 8 if p[2].startswith('_') else None)
    if p[1] == 'path':
        if len(p) > 3 and p[2] == 'stages': return STAGE_WS.get(p[3], 8)
        if p[2] == 'preop-stop': return 1
        if p[2] == 'added-stops' and len(p) > 3 and p[3][:2].isdigit():
            n = int(p[3][:2]); return 1 if n <= 5 else 3 if n <= 8 else 4
        return 8
    if p[1] == 'primary' or path.startswith('content/sba/primary/'): return 2
    if path.startswith('content/sba/final/'): return 4
    if p[1] in ('recipes', 'wpba'): return 5
    if path == 'content/data/CURRIC_KC.json': return 6
    return 8

def git(*args): return subprocess.run(['git', *args], capture_output=True, text=True, check=True).stdout
def show(rev, path):
    try: return git('show', f'{rev}:{path}')
    except subprocess.CalledProcessError: return None
def load(rev, path):
    t = show(rev, path)
    try: return json.loads(t) if t is not None else None
    except ValueError: return None
def plain(h): return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', h or '')).replace('&lt;', '<').replace('&gt;', '>').replace('&amp;', '&').strip()
def cell(t): return plain(t).replace('|', '\\|')

class Summary:
    def __init__(self, base, head, preview):
        self.base, self.head, self.preview = base, head, (preview.rstrip('/') + '/') if preview else None
        self.changes = [l.split('\t') for l in git('diff', '--name-status', '-M', f'{base}...{head}').splitlines() if l]
        self.out = []

    def link(self, **kw):
        if not self.preview: return ''
        return f' · [open in preview]({self.preview}#{urllib.parse.urlencode(kw, quote_via=urllib.parse.quote)})'

    # ---------- workstreams ----------
    def workstreams(self):
        ws = {}
        for c in self.changes:
            for path in c[1:]:
                w = workstream(path)
                if w: ws.setdefault(w, set()).add(path)
        content_ws = sorted(w for w in ws if w != 8)
        self.out.append(f'**Files changed:** {len(self.changes)}  ')
        self.out.append('**Workstreams:** ' + (', '.join(f'{w}. {WS_NAMES[w]}' for w in sorted(ws)) or 'none (docs only)'))
        if len(content_ws) > 1:
            self.out.append(f'\n> [!NOTE]\n> This pull request edits {len(content_ws)} content workstreams. That\'s fine if intended, '
                            'but check each owner has seen their part (see WORKSTREAMS.md).')
        if 8 in ws and content_ws:
            self.out.append('\n> [!NOTE]\n> It changes both content and technical files (app, tools or settings). '
                            'Technical changes usually go in their own pull request.')

    # ---------- stops, notes and cards ----------
    def stop_changes(self):
        rows, seen = [], set()
        rec_index = {e['file']: e['name'] for e in (load(self.head, 'content/recipes/_index.json') or [])}
        wpba_index = {e['file']: e['name'] for e in (load(self.head, 'content/wpba/_index.json') or [])}
        for c in self.changes:
            status, path = c[0][0], c[-1]
            parts = path.split('/')
            folder = None
            if path.startswith('content/specialties/') and len(parts) > 3: folder = '/'.join(parts[:4])
            elif path.startswith('content/path/added-stops/') and len(parts) > 3: folder = '/'.join(parts[:4]) + '/stop'
            elif path.startswith('content/path/preop-stop/'): folder = 'content/path/preop-stop'
            if folder:
                sj = load(self.head, folder + '/stop.json') or load(self.base, folder + '/stop.json') or {}
                title, sid, note = sj.get('title', folder), sj.get('id') or ('core-preop' if 'preop' in folder else None), sj.get('note')
                if path.startswith('content/path/added-stops/'):
                    sid = (load(self.head, '/'.join(parts[:4]) + '/placement.json') or {}).get('id', sid)
                tab = None
                if '/cards/' in path:
                    rel = 'file:' + path.split(folder + '/', 1)[1]
                    tab = next((x.get('h') for x in sj.get('cards', []) if isinstance(x, dict) and x.get('b') == rel), None)
                what = {'quiz.json': 'quiz', 'stop.json': 'tabs and links', 'placement.json': 'where it sits on the path'}.get(parts[-1]) \
                    or (f'"{tab}" tab' if tab else parts[-1])
                key = (title, what)
                if key in seen: continue
                seen.add(key)
                lk = self.link(note=title, **({'tab': tab} if tab else {})) if note else \
                    self.link(stop=sid or title, **({'tab': tab} if tab else {}))
                rows.append(f'| {"Note" if note else "Stop"} | {cell(title)} | {what} ({"new" if status == "A" else "removed" if status == "D" else "edited"}){lk} |')
            elif path.startswith(('content/recipes/', 'content/wpba/')) and path.endswith('.html'):
                kind, name = ('recipe', rec_index.get(parts[-1])) if 'recipes' in path else ('sample WPBA', wpba_index.get(parts[-1]))
                if name:
                    lk = self.link(stop=name) if name in self.stop_titles() else self.link(note=name, tab='Anaesthetic recipe')
                    rows.append(f'| Recipe library | {cell(name)} | {kind}{lk} |')
            elif path.startswith('content/path/stages/') and path.endswith('.js'):
                for sid, title in self.stage_stops_touched(path):
                    rows.append(f'| Stop | {cell(title)} | text in {parts[-1]}{self.link(stop=sid)} |')
        if rows:
            self.out.append('\n### Stops and notes changed\n\n| | Name | What changed |\n|---|---|---|')
            self.out += rows[:150]
            if len(rows) > 150: self.out.append(f'| | …and {len(rows) - 150} more | |')

    def stop_titles(self):
        """Titles of stops on the path (not notes) at HEAD."""
        if not hasattr(self, '_titles'):
            t = set()
            for f in git('ls-tree', '-r', '--name-only', self.head, 'content').splitlines():
                if f.endswith('/stop.json'):
                    d = load(self.head, f) or {}
                    if not d.get('note'): t.add(d.get('title'))
                elif f.startswith('content/path/stages/') and f.endswith('.js'):
                    t |= set(re.findall(r'^\s*\{id:"[^"]*",t:"[a-z]+",.*?title:"([^"]+)"', show(self.head, f) or '', re.M))
            self._titles = t
        return self._titles

    def stage_stops_touched(self, path):
        """Stops in a stage file whose lines changed, found from the diff's line numbers."""
        text = show(self.head, path)
        if text is None: return []
        lines = text.split('\n')
        starts = [(n, m.group(1), m.group(2)) for n, l in enumerate(lines, 1)
                  for m in [re.match(r'\s*\{id:"([^"]+)",t:"[a-z]+",.*?title:"([^"]+)"', l)] if m]
        touched = set()
        for h in re.finditer(r'^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@', git('diff', '-U0', f'{self.base}...{self.head}', '--', path), re.M):
            a = int(h.group(1)); b = a + max(int(h.group(2) or 1), 1) - 1
            for n in range(a, b + 1):
                owner = [s for s in starts if s[0] <= n]
                if owner: touched.add(owner[-1][1:])
        return sorted(touched)

    # ---------- quizzes and SBAs ----------
    @staticmethod
    def question(q, mark=''):
        o = q.get('o') or []
        lines = [f'**{mark}{cell(q.get("q", ""))}**', '']
        for i, opt in enumerate(o):
            lines.append(f'{"✅" if i == q.get("a") else "▫️"} {chr(65 + i)}. {cell(opt)}  ')
        if q.get('why'): lines += ['', f'*Why:* {cell(q["why"])}']
        return '\n'.join(lines)

    def quiz_changes(self):
        blocks = []
        for c in self.changes:
            path = c[-1]
            is_quiz = path.endswith('/quiz.json')
            is_sba = path.startswith('content/sba/') and path.endswith('.json') and not P(path).name.startswith('_')
            if not (is_quiz or is_sba): continue
            old, new = load(self.base, c[1]) or [], load(self.head, path) or []
            if not isinstance(old, list) or not isinstance(new, list): continue
            if is_sba:
                ob = {q.get('id'): q for q in old if isinstance(q, dict)}; nb = {q.get('id'): q for q in new if isinstance(q, dict)}
                pairs = [(ob.get(k), nb.get(k), k) for k in list(nb) + [k for k in ob if k not in nb]]
                where = f'SBA bank `{path}`'
            else:
                pairs = [(old[i] if i < len(old) else None, new[i] if i < len(new) else None, f'Q{i + 1}') for i in range(max(len(old), len(new)))]
                st = load(self.head, path.rsplit('/', 1)[0] + '/stop.json') or {}
                where = f'Quiz for **{cell(st.get("title", path))}**' + self.link(stop=st.get('id') or st.get('title', ''), tab='q')
            for a, b, label in pairs:
                if a == b: continue
                if a is None: blocks.append(f'#### {where}: {label} added\n\n' + self.question(b))
                elif b is None: blocks.append(f'#### {where}: {label} removed\n\n' + self.question(a))
                else:
                    notes = []
                    if a.get('a') != b.get('a'):
                        notes.append(f'> [!WARNING]\n> The correct answer changed from **{chr(65 + a["a"]) if isinstance(a.get("a"), int) else "?"}** '
                                     f'to **{chr(65 + b["a"]) if isinstance(b.get("a"), int) else "?"}**.')
                    if a.get('o') != b.get('o'): notes.append('Options changed.')
                    if a.get('q') != b.get('q'): notes.append('Question wording changed.')
                    if a.get('why') != b.get('why'): notes.append('Explanation changed.')
                    if a.get('st') != b.get('st'): notes.append(f'Now shown on stop `{b.get("st")}` (was `{a.get("st")}`).')
                    blocks.append(f'#### {where}: {label} edited\n\n' + '\n\n'.join(notes) + '\n\n' + self.question(b))
        if blocks:
            self.out.append(f'\n### Quiz and SBA questions ({len(blocks)})\n\nThe correct answer is marked ✅.\n')
            self.out.append('\n\n'.join(blocks[:40]))
            if len(blocks) > 40: self.out.append(f'\n…and {len(blocks) - 40} more questions changed.')

    # ---------- doses ----------
    DOSE = re.compile(r'\d[\d.,]*\s?(?:–|-|to)?\s?\d*[\d.,]*\s?(?:mg|µg|mcg|micrograms?|g|kg|mL|ml|L|units?|mmol|nanograms?|ng|J)(?:/(?:kg|h|hr|min|day|24 ?h|m2|m²|mL|dose))*\b', re.I)
    def dose_changes(self):
        rows = []
        for c in self.changes:
            path = c[-1]
            if c[0][0] == 'D' or not re.search(r'\.(html|json|js)$', path) or path.endswith('/quiz.json') or path.startswith(('content/sba/', 'app/', 'tools/', '.github/')) or path == 'content/data/DRUGS.json':
                continue
            diff = git('diff', '-U0', f'{self.base}...{self.head}', '--', path)
            for hunk in re.split(r'^@@.*@@.*$', diff, flags=re.M)[1:]:
                minus = [l[1:] for l in hunk.split('\n') if l.startswith('-') and not l.startswith('---')]
                plus = [l[1:] for l in hunk.split('\n') if l.startswith('+') and not l.startswith('+++')]
                for i in range(max(len(minus), len(plus))):
                    a = minus[i] if i < len(minus) else ''; b = plus[i] if i < len(plus) else ''
                    da, db = self.DOSE.findall(a), self.DOSE.findall(b)
                    if (da or db) and da != db:
                        rows.append(f'| `{path.split("/")[-3] if "/cards/" in path else P(path).name}` | {cell(a)[:160] or "—"} | {cell(b)[:160] or "—"} |')
        if rows:
            self.out.append(f'\n### Dose changes ({len(rows)})\n\nLines where a dose, volume or amount was added, removed or changed. '
                            'Check each against the BNF or local guidance.\n\n| Where | Before | After |\n|---|---|---|')
            self.out += rows[:60]
            if len(rows) > 60: self.out.append(f'| | …and {len(rows) - 60} more | |')

    FIELDS = {'n': 'name', 'c': 'class/use', 'a': 'adult dose', 'p': 'paediatric dose', 'g': 'how to give', 'x': 'cautions', 'k': 'search words', 'r': 'presentation'}
    def drug_changes(self):
        if not any(c[-1] == 'content/data/DRUGS.json' for c in self.changes): return
        old = {d.get('n'): d for d in load(self.base, 'content/data/DRUGS.json') or []}
        new = {d.get('n'): d for d in load(self.head, 'content/data/DRUGS.json') or []}
        rows = []
        for n in list(new) + [k for k in old if k not in new]:
            a, b = old.get(n), new.get(n)
            if a == b: continue
            if a is None: rows.append(f'| **{cell(n)}** | added | | |'); continue
            if b is None: rows.append(f'| **{cell(n)}** | removed | | |'); continue
            for k in sorted(set(a) | set(b), key=lambda k: list(self.FIELDS).index(k) if k in self.FIELDS else 99):
                if a.get(k) != b.get(k):
                    rows.append(f'| **{cell(n)}** | {self.FIELDS.get(k, k)} | {cell(str(a.get(k, "—")))[:160]} | {cell(str(b.get(k, "—")))[:160]} |')
        if rows:
            self.out.append(f'\n### Drug reference changes ({len(rows)})\n\nCheck each against the BNF or local guidance.\n\n| Drug | Field | Before | After |\n|---|---|---|---|')
            self.out += rows[:80]

    def build(self):
        self.out += [MARK, '## Review summary', '']
        self.workstreams(); self.stop_changes(); self.quiz_changes(); self.drug_changes(); self.dose_changes()
        if self.preview: self.out.append(f'\n[Open the whole app in the preview]({self.preview}) (it can take a minute or two to appear).')
        self.out.append('\n<sub>Made by `tools/pr_summary.py` and updated on every push.</sub>')
        md = '\n'.join(self.out)
        return md if len(md) <= LIMIT else md[:LIMIT] + '\n\n…summary cut short because it is very long.'

def post(md):
    repo, token, pr = os.environ.get('GITHUB_REPOSITORY'), os.environ.get('GITHUB_TOKEN'), os.environ.get('PR_NUMBER')
    if not (repo and token and pr): print('Not posting: GITHUB_REPOSITORY, GITHUB_TOKEN or PR_NUMBER missing', file=sys.stderr); return
    def call(method, url, body=None):
        req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body else None,
                                     headers={'Authorization': f'Bearer {token}', 'Accept': 'application/vnd.github+json'})
        with urllib.request.urlopen(req) as r: return json.loads(r.read() or b'null')
    api = f'https://api.github.com/repos/{repo}/issues/{pr}/comments'
    try:
        existing, page = None, 1
        while existing is None:
            batch = call('GET', f'{api}?per_page=100&page={page}')
            existing = next((c for c in batch if MARK in (c.get('body') or '')), None)
            if len(batch) < 100: break
            page += 1
        if existing: call('PATCH', existing['url'], {'body': md})
        else: call('POST', api, {'body': md})
    except Exception as e:  # e.g. a pull request from a fork, whose token can't comment
        print(f'Could not post the comment ({e}); the summary is still in the job summary.', file=sys.stderr)

if __name__ == '__main__':
    import argparse
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('base'); ap.add_argument('head')
    ap.add_argument('--preview'); ap.add_argument('--post', action='store_true')
    a = ap.parse_args()
    md = Summary(a.base, a.head, a.preview).build()
    print(md)
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a', encoding='utf-8') as f: f.write(md + '\n')
    if a.post: post(md)
