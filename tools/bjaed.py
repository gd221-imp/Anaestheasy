#!/usr/bin/env python3
"""Keep the app's BJA Education reading lists up to date.

Every Final FRCA note can have a "Further reading" tab listing BJA Education articles as
<li>Title (year)</li>, one per line. Articles that match no note sit in the note "Other BJA Ed
Articles" (content/specialties/miscellaneous/025-note-other-bja-ed-articles).

    python3 tools/bjaed.py list                       every article in the app, with the note it is under
    python3 tools/bjaed.py has "Title"                is this article already in the app? (ignores case,
                                                      spaces, hyphens and punctuation)
    python3 tools/bjaed.py notes                      every Final FRCA note: folder and title, to pick from
    python3 tools/bjaed.py add "Title" 2026 FOLDER    add an article to a note's Further reading tab
                                                      (FOLDER as `notes` prints it, or "other");
                                                      makes the tab if the note has none

Only titles and years go in, as the lists already hold: never the article's text.
Run tools/check.py afterwards.
"""
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPEC = ROOT / 'content' / 'specialties'
OTHER = SPEC / 'miscellaneous' / '025-note-other-bja-ed-articles'
LI = re.compile(r'<li>(.*?)\s*\((\d{4})\)\s*</li>')


def key(title):
    return re.sub(r'[^a-z0-9]', '', html.unescape(title).lower().replace('&', 'and'))


def notes():
    for sj in sorted(SPEC.glob('*/*/stop.json')):
        stop = json.loads(sj.read_text(encoding='utf-8'))
        if stop.get('note'):
            yield sj.parent, stop


def reading_file(folder, stop):
    for c in stop.get('cards', []):
        if c.get('h', '').lower() == 'further reading' and str(c.get('b', '')).startswith('file:'):
            return folder / c['b'][5:]
    return None


def articles():
    for folder, stop in notes():
        f = reading_file(folder, stop)
        if f and f.exists():
            for m in LI.finditer(f.read_text(encoding='utf-8')):
                yield html.unescape(m.group(1)), m.group(2), folder, stop['title']


def find(title):
    k = key(title)
    return [a for a in articles() if key(a[0]) == k]


def add(title, year, where):
    if find(title):
        sys.exit(f'already in the app: {find(title)[0][3]}')
    folder = OTHER if where == 'other' else SPEC / where
    sj = folder / 'stop.json'
    if not sj.exists():
        sys.exit(f'no note at {folder.relative_to(ROOT)}')
    stop = json.loads(sj.read_text(encoding='utf-8'))
    if not stop.get('note'):
        sys.exit(f'{folder.relative_to(ROOT)} is a stop, not a Final FRCA note')
    f = reading_file(folder, stop)
    line = f'<li>{html.escape(title, quote=False)} ({year})</li>'
    if f is None:
        n = len(stop['cards']) + 1
        f = folder / 'cards' / f'{n:02d}-further-reading.html'
        f.write_text(f'<ul>\n{line}\n</ul>\n', encoding='utf-8')
        stop['cards'].append({'h': 'Further reading', 'b': f'file:cards/{f.name}'})
        text = sj.read_text(encoding='utf-8')
        indent = len(re.search(r'\n( +)\S', text).group(1)) if re.search(r'\n( +)\S', text) else 2
        sj.write_text(json.dumps(stop, indent=indent, ensure_ascii=False) + '\n', encoding='utf-8')
        print(f'made a Further reading tab in "{stop["title"]}" and added: {title} ({year})')
        return
    lines = f.read_text(encoding='utf-8').rstrip('\n').split('\n')
    # keep the list in year order, as the lists are: after the last article of that year or earlier
    at = max([i for i, ln in enumerate(lines) if (m := LI.search(ln)) and m.group(2) <= str(year)], default=None)
    if at is None:
        at = next(i for i, ln in enumerate(lines) if ln.strip() == '<ul>')
    lines.insert(at + 1, line)
    f.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(f'added to "{stop["title"]}": {title} ({year})')


def main():
    a = sys.argv[1:]
    if not a or a[0] not in ('list', 'has', 'notes', 'add'):
        print(__doc__)
        sys.exit(1)
    if a[0] == 'list':
        rows = sorted(articles(), key=lambda r: (r[1], r[0].lower()))
        for t, y, folder, note in rows:
            print(f'{y}  {t}  →  {note}')
        print(f'{len(rows)} articles')
    elif a[0] == 'has':
        hits = find(' '.join(a[1:]))
        print('\n'.join(f'yes: {t} ({y}) in "{n}"' for t, y, _, n in hits) or 'no')
    elif a[0] == 'notes':
        for folder, stop in notes():
            has = 'further reading' if reading_file(folder, stop) else 'no further reading tab yet'
            print(f'{folder.relative_to(SPEC)}  {stop["title"]}  ({stop.get("group", "")}; {has})')
    else:
        if len(a) != 4 or not re.fullmatch(r'\d{4}', a[2]):
            sys.exit('usage: bjaed.py add "Title" YEAR FOLDER|other')
        add(a[1], a[2], a[3])


if __name__ == '__main__':
    main()
