#!/usr/bin/env python3
"""Bring reviewers' work from the live app's review mode into the content files.

Reviewers open the app with #review=<section>, work through "Your review list", edit tabs on screen and press
Send, or mark an item "Looks good, no changes" (see app/js/18-suggest-edits.js). Each reviewer's work is saved
in the live app's database as suggestions/<user id>:
    {"name", "section", "items": {"<item>|<tab>": suggestion}, "checked": {"<item>": date}}
where <item> is stop:<id>, note:<title> or topic:<id>. Export that collection to a JSON file (a list of
{"id", "data"} documents, or of the data alone), then:

    python3 tools/suggestions.py list  export.json [--who NAME]
    python3 tools/suggestions.py apply export.json [--who NAME] [--report pr.md] [--mark-pr N]
    python3 tools/suggestions.py tick  export.json --body issue.md      (prints the issue body, items ticked)

`apply` writes each pending suggestion into the file its text came from (a card file, a note, a Primary topic,
a library recipe, or the stop's stage file), keeping every line the reviewer didn't touch exactly as it was,
and writes a report for the pull request. It refuses a suggestion whose text has changed since the reviewer
started editing. With --mark-pr N it also writes export.marked.json: the reviewers' documents with each
applied suggestion marked as in pull request N, ready to write back so reviewers see where it is.
Run tools/check.py afterwards, then open a pull request; David approves it as usual.
"""

import argparse
import difflib
import html
import json
import re
import sys
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
C = ROOT / 'content'
APP = 'https://gd221-imp.github.io/Anaestheasy/'
sys.path.insert(0, str(ROOT / 'tools'))
from build import read_card_html  # noqa: E402  the same one-line form the app shows, so `before` can be compared

TAG = re.compile(r'<!--.*?-->|<(/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(/?)>', re.S)
VOID = {'br', 'hr', 'img', 'input', 'wbr', 'col', 'area', 'source', 'meta', 'link', 'base'}


def segments(src):
    """Split HTML the way seLines() in 18-suggest-edits.js lays it out: each top-level block, and each item of
    a top-level list (with its own nested lists inside it), with the list's opening and closing tags apart."""
    cuts, stack = {0}, []
    for m in TAG.finditer(src):
        if m.group(0).startswith('<!--'):
            if not stack:
                cuts.add(m.start())
            continue
        close, name = m.group(1) == '/', m.group(2).lower()
        if name in VOID or m.group(3):
            continue
        if not close:
            if not stack or (name == 'li' and len(stack) == 1 and stack[0] in ('ul', 'ol')):
                cuts.add(m.start())
            stack.append(name)
        else:
            if len(stack) == 1 and name in ('ul', 'ol'):
                cuts.add(m.start())
            while stack and stack.pop() != name:
                pass
    cuts = sorted(cuts) + [len(src)]
    return [src[a:b] for a, b in zip(cuts, cuts[1:]) if src[a:b]]


def docs_of(path):
    data = json.loads(Path(path).read_text(encoding='utf-8'))
    docs = data if isinstance(data, list) else data.get('documents', [data])
    return [{'id': d.get('id', ''), 'data': d.get('data', d)} for d in docs if isinstance(d, dict)]


def load(path):
    out = []
    for d in docs_of(path):
        body = d['data']
        for key, it in (body.get('items') or {}).items():
            it = dict(it)
            # suggestions made before notes and topics could be edited name only their stop
            it.setdefault('kind', 'stop')
            it.setdefault('ref', it.get('stop'))
            it.setdefault('title', it.get('stopTitle', ''))
            out.append({**it, 'key': key, 'who': body.get('name') or 'A reviewer', 'uid': d['id']})
    return sorted(out, key=lambda it: (it['who'], it['kind'], it['ref'] or '', str(it.get('card', ''))))


def find_stop(stop_id):
    """(kind, path, extra) for a stop id: a stop.json, or a stage file with the stop's position."""
    if stop_id == 'core-preop':
        return 'json', C / 'path' / 'preop-stop' / 'stop.json', None
    for pl in sorted((C / 'path' / 'added-stops').glob('*/placement.json')):
        if json.loads(pl.read_text(encoding='utf-8')).get('id') == stop_id:
            return 'json', pl.parent / 'stop' / 'stop.json', None
    for sj in sorted(C.glob('specialties/*/*/stop.json')):
        if json.loads(sj.read_text(encoding='utf-8')).get('id') == stop_id:
            return 'json', sj, None
    for js in sorted((C / 'path' / 'stages').glob('*.js')):
        text = js.read_text(encoding='utf-8')
        m = re.search(r'\{id:"' + re.escape(stop_id) + '"', text)
        if m:
            nxt = re.search(r'\n \{id:"', text[m.end() :])
            return 'js', js, (m.start(), m.end() + nxt.start() if nxt else len(text))
    return None, None, None


def _same(a, b):
    """The same block, ignoring layout whitespace and how characters are escaped (& or &amp;)."""
    norm = lambda s: re.sub(
        r'\s+', ' ', re.sub(r'>\s+<|</?tbody>', lambda m: '' if 'tbody' in m.group() else '><', html.unescape(s))
    ).strip()
    return norm(a) == norm(b)


def merge(source, before_lines, after_lines, sep=''):
    """The new source text. Blocks the reviewer didn't change keep their original text exactly, line breaks
    included; changed or added blocks come from the reviewer's version. If the source can't be matched block
    for block (unusual layout), the whole tab is written from the reviewer's version."""
    raw = segments(source)
    keep = len(raw) == len(before_lines) and all(_same(r, b) for r, b in zip(raw, before_lines))
    if not keep:
        return sep.join(after_lines) + sep, False
    out = []
    sm = difflib.SequenceMatcher(None, before_lines, after_lines, autojunk=False)
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == 'equal':
            out += raw[i1:i2]
        else:
            # a changed block takes the place (and trailing line break) of the one it replaces
            tail = re.search(r'\s*$', raw[i2 - 1] if i2 > i1 else (raw[i1 - 1] if i1 else '')).group()
            out += [ln + tail for ln in after_lines[j1:j2]]
    return ''.join(out), True


_TEXTS = None


def _by_text(before):
    """The one content file whose text (as the app shows it) is exactly `before`, if there is one."""
    global _TEXTS
    if _TEXTS is None:
        _TEXTS = {}
        for f in sorted(C.rglob('*.html')):
            _TEXTS.setdefault(read_card_html(f), []).append(f)
    hits = _TEXTS.get(before, [])
    return hits[0] if len(hits) == 1 else None


def _write_file(f, before_lines, after_lines):
    global _TEXTS
    _TEXTS = None
    new, kept = merge(f.read_text(encoding='utf-8'), before_lines, after_lines, sep='\n')
    f.write_text(new if new.endswith('\n') else new + '\n', encoding='utf-8')
    return 'applied', f'{f.relative_to(ROOT)}' + ('' if kept else ' (rewritten in full)')


def apply_one(it):
    """Write one suggestion. Returns (status, detail): applied, conflict, manual or missing."""
    before, after_lines = it['before'], it.get('lines') or []
    before_lines = it.get('beforeLines') or []
    # most text lives in its own file: a stop's card, a note's section, a Primary topic, a library recipe
    f = _by_text(before)
    if f:
        return _write_file(f, before_lines, after_lines)
    if it['kind'] == 'note':
        # the same text in several files: take the one in this note's own folder
        for sj in sorted(C.glob('specialties/*/*/stop.json')):
            s = json.loads(sj.read_text(encoding='utf-8'))
            if s.get('note') and s.get('title') == it['ref']:
                own = [sj.parent / x['b'][5:] for x in s.get('cards', []) if str(x.get('b', '')).startswith('file:')]
                own = [f for f in own if f.exists() and read_card_html(f) == before]
                if len(own) == 1:
                    return _write_file(own[0], before_lines, after_lines)
    if it['kind'] != 'stop':
        return 'conflict', 'the text has changed since the suggestion was made, or appears in several places'
    kind, path, span = find_stop(it['ref'])
    if not kind:
        return 'missing', f"no stop with id {it['ref']}"
    rel = path.relative_to(ROOT)
    if kind == 'json':
        cards = json.loads(path.read_text(encoding='utf-8')).get('cards', [])
        c = cards[int(it['card'])] if int(it['card']) < len(cards) else {}
        if 'shared' in c:
            return 'manual', f"shared card {c['shared']} (content/data/{c['shared']}.json, shown on several stops)"
        # the same text in several files: take the one in this stop's own folder
        own = [path.parent / x['b'][5:] for x in cards if str(x.get('b', '')).startswith('file:')]
        own = [f for f in own if f.exists() and read_card_html(f) == before]
        if len(own) == 1:
            return _write_file(own[0], before_lines, after_lines)
        return 'conflict', f'{rel}: the tab text has changed since the suggestion was made'
    # written inside a stage file: find the tab's text inside this stop's block
    text = path.read_text(encoding='utf-8')
    a, z = span
    i = text.find(before, a, z)
    if i < 0:
        return 'conflict', f'{rel}: the tab text has changed since the suggestion was made, or is written with escapes'
    if text.find(before, i + 1, z) >= 0:
        return 'manual', f'{rel}: the same text appears twice in this stop'
    quote = text[i - 1]
    new, kept = merge(before, before_lines, after_lines)
    if quote == '`':
        new = new.replace('\\', '\\\\').replace('`', '\\`').replace('${', '\\${')
    elif quote == '"':
        new = new.replace('\\', '\\\\').replace('"', '\\"')
    else:
        return 'manual', f'{rel}: tab text is not a plain string'
    path.write_text(text[:i] + new + text[i + len(before) :], encoding='utf-8')
    global _TEXTS
    _TEXTS = None
    return 'applied', f'{rel}' + ('' if kept else ' (tab rewritten in full)')


def item_link(kind, ref, tab=''):
    q = {'stop': {'stop': ref}, 'note': {'note': ref}, 'topic': {'topic': ref}}[kind]
    if tab and kind != 'topic':
        q['tab'] = tab
    return f'{APP}#' + urllib.parse.urlencode(q, quote_via=urllib.parse.quote)


def reviewed(path, who=None):
    """Every item a reviewer has finished: sent changes for, or marked looks good."""
    keys = set()
    for d in docs_of(path):
        b = d['data']
        if who and b.get('name') != who:
            continue
        keys |= {k.split('|')[0] for k in (b.get('items') or {})}
        keys |= set(b.get('checked') or {})
    return keys


def tick(body, keys):
    """The review issue's text with the boxes of these items ticked (matched by their app links)."""
    pats = []
    for k in keys:
        kind, _, ref = k.partition(':')
        if kind in ('stop', 'topic'):
            pats.append(f'#{kind}={ref})')
        elif kind == 'note':
            pats.append('#note=' + urllib.parse.quote(ref) + ')')
    out = []
    for line in body.split('\n'):
        if line.lstrip().startswith('- [ ]') and any(p in line for p in pats):
            line = line.replace('- [ ]', '- [x]', 1)
        out.append(line)
    return '\n'.join(out)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('action', choices=['list', 'apply', 'tick'])
    ap.add_argument('export', help='JSON export of the suggestions collection')
    ap.add_argument('--who', help='only this reviewer (as named in the export)')
    ap.add_argument('--all', action='store_true', help='include suggestions already in a pull request')
    ap.add_argument('--report', help='apply: write a pull request description here')
    ap.add_argument('--mark-pr', type=int, help='apply: write EXPORT.marked.json with applied items in this PR')
    ap.add_argument('--body', help='tick: the review issue text to tick')
    args = ap.parse_args()
    if args.action == 'tick':
        print(tick(Path(args.body).read_text(encoding='utf-8'), reviewed(args.export, args.who)), end='')
        return
    items = [
        it
        for it in load(args.export)
        if (args.all or it.get('status', 'pending') == 'pending') and (not args.who or it['who'] == args.who)
    ]
    if args.action == 'list':
        for it in items:
            print(f"{it['who']}: {it['title']} › {it.get('tab', '')} ({it['key']}) {it.get('at', '')[:10]}")
            if it.get('note'):
                print(f"    note: {it['note']}")
        print(f'{len(items)} pending suggestion(s); {len(reviewed(args.export, args.who))} item(s) reviewed.')
        return
    if not items:
        print('No pending suggestions.')
        return
    rows, applied = [], []
    for it in items:
        status, detail = apply_one(it)
        if status == 'applied':
            applied.append(it)
        mark = {'applied': '✅', 'conflict': '⚠️', 'manual': '✋', 'missing': '❓'}[status]
        print(f"{mark} {status:8} {it['who']}: {it['title']} › {it['tab']}: {detail}")
        rows.append((it, status, detail, mark))
    if args.report:
        who = sorted({it['who'] for it in items})
        out = [f"Suggested in the app by {', '.join(who)} (review mode).", '']
        for it, status, detail, mark in rows:
            out.append(
                f"- {mark} **{it['title']} › {it['tab']}** · [open in app]({item_link(it['kind'], it['ref'], it['tab'])})"
                f" · {detail}"
            )
            if it.get('note'):
                out.append(f"  > {it['note']}".replace('\n', '\n  > '))
        out += ['', f'{len(applied)} of {len(rows)} applied.']
        Path(args.report).write_text('\n'.join(out) + '\n', encoding='utf-8')
    if args.mark_pr:
        done = {(it['uid'], it['key']) for it in applied}
        docs = docs_of(args.export)
        for d in docs:
            for k, it in (d['data'].get('items') or {}).items():
                if (d['id'], k) in done:
                    it.update(status='pr', pr=args.mark_pr)
        Path(args.export).with_suffix('.marked.json').write_text(json.dumps(docs, ensure_ascii=False), encoding='utf-8')
    print(f'\n{len(applied)} of {len(rows)} applied. Now run python3 tools/check.py.')


if __name__ == '__main__':
    main()
