#!/usr/bin/env python3
"""Apply reviewers' "Suggest edits" changes from the live app to the content files.

Reviewers open the app with #review in the address, edit a tab on screen and press Send. Each suggestion is
saved in the live app's database as suggestions/<user id> = {"name": ..., "items": {"<stop id>|<tab>": {...}}}
(see app/js/18-suggest-edits.js). Export that collection to a JSON file (a list of {"id", "data"} documents,
or of the data alone), then:

    python3 tools/suggestions.py list    suggestions.json
    python3 tools/suggestions.py apply   suggestions.json [--who NAME] [--report pr-body.md]

`apply` writes each pending suggestion into its stop's card file (or stage file), keeping every line the
reviewer didn't touch exactly as it was, and writes a report for the pull request. It refuses a suggestion
whose tab has changed since the reviewer started editing, and leaves shared cards to be changed by hand.
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


def load(path):
    data = json.loads(Path(path).read_text(encoding='utf-8'))
    docs = data if isinstance(data, list) else data.get('documents', [data])
    out = []
    for d in docs:
        body = d.get('data', d) if isinstance(d, dict) else {}
        for key, it in (body.get('items') or {}).items():
            out.append({**it, 'key': key, 'who': body.get('name') or 'A reviewer', 'uid': d.get('id', '')})
    return sorted(out, key=lambda it: (it['who'], it.get('stop', ''), str(it.get('card', ''))))


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


def _library():
    return sorted((C / 'recipes').glob('*.html')) + sorted((C / 'wpba').glob('*.html'))


def _matching(files, before):
    hits = [f for f in files if f.exists() and read_card_html(f) == before]
    return hits[0] if len(hits) == 1 else None


def _write_file(f, before_lines, after_lines):
    new, kept = merge(f.read_text(encoding='utf-8'), before_lines, after_lines, sep='\n')
    f.write_text(new if new.endswith('\n') else new + '\n', encoding='utf-8')
    return 'applied', f'{f.relative_to(ROOT)}' + ('' if kept else ' (rewritten in full)')


def apply_one(it):
    """Write one suggestion. Returns (status, detail): applied, conflict, manual or missing."""
    kind, path, span = find_stop(it['stop'])
    if not kind:
        return 'missing', f"no stop with id {it['stop']}"
    card = int(it['card'])
    before, after_lines = it['before'], it.get('lines') or []
    before_lines = it.get('beforeLines') or []
    rel = path.relative_to(ROOT)
    if kind == 'json':
        stop = json.loads(path.read_text(encoding='utf-8'))
        cards = stop.get('cards', [])
        c = cards[card] if card < len(cards) else {}
        if 'shared' in c:
            return 'manual', f"shared card {c['shared']} (content/data/{c['shared']}.json, shown on several stops)"
        # the app can slot a library recipe or WPBA in among a stop's tabs, so match the tab by its text
        files = [path.parent / x['b'][len('file:') :] for x in cards if str(x.get('b', '')).startswith('file:')]
        f = _matching(files, before) or _matching(_library(), before)
        if not f:
            return 'conflict', f'{rel}: the tab text has changed since the suggestion was made'
        return _write_file(f, before_lines, after_lines)
    text = path.read_text(encoding='utf-8')
    a, z = span
    if text.find(before, a, z) < 0:
        # not written in the stage file: a library recipe or WPBA the app shows on this stop
        f = _matching(_library(), before)
        if f:
            return _write_file(f, before_lines, after_lines)
    # a stage file: find the tab's text inside this stop's block
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
    return 'applied', f'{rel}' + ('' if kept else ' (tab rewritten in full)')


def link(it):
    q = urllib.parse.urlencode({'stop': it['stop'], 'tab': it.get('tab', '')}, quote_via=urllib.parse.quote)
    return f'{APP}#{q}'


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('action', choices=['list', 'apply'])
    ap.add_argument('export', help='JSON export of the suggestions collection')
    ap.add_argument('--who', help='only this reviewer (as named in the export)')
    ap.add_argument('--all', action='store_true', help='include suggestions already in a pull request')
    ap.add_argument('--report', help='write a pull request description here')
    args = ap.parse_args()
    items = [
        it
        for it in load(args.export)
        if (args.all or it.get('status', 'pending') == 'pending') and (not args.who or it['who'] == args.who)
    ]
    if not items:
        print('No pending suggestions.')
        return
    if args.action == 'list':
        for it in items:
            print(f"{it['who']}: {it['stopTitle']} › {it['tab']} ({it['stop']}|{it['card']}) {it.get('at', '')[:10]}")
            if it.get('note'):
                print(f"    note: {it['note']}")
        return
    rows, done = [], 0
    for it in items:
        status, detail = apply_one(it)
        done += status == 'applied'
        mark = {'applied': '✅', 'conflict': '⚠️', 'manual': '✋', 'missing': '❓'}[status]
        print(f"{mark} {status:8} {it['who']}: {it['stopTitle']} › {it['tab']}: {detail}")
        rows.append((it, status, detail, mark))
    if args.report:
        who = sorted({it['who'] for it in items})
        out = [f"Suggested in the app by {', '.join(who)} (Suggest edits).", '']
        for it, status, detail, mark in rows:
            out.append(f"- {mark} **{it['stopTitle']} › {it['tab']}** · [open in app]({link(it)}) · {detail}")
            if it.get('note'):
                out.append(f"  > {it['note']}".replace('\n', '\n  > '))
        out += [
            '',
            f'{done} of {len(rows)} applied. Suggestion keys: ' + ', '.join(f"`{it['key']}`" for it, *_ in rows),
        ]
        Path(args.report).write_text('\n'.join(out) + '\n', encoding='utf-8')
    print(f'\n{done} of {len(rows)} applied. Now run python3 tools/check.py.')


if __name__ == '__main__':
    main()
