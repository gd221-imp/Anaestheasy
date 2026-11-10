"""Assemble app/ and content/ into dist/index.html, one self-contained page.

Usage: python3 tools/build.py   ->  dist/index.html

How it works
- app/page.html is the page shell. Each `/*@@include FILE@@*/` line is replaced by app/FILE
  (the stylesheet and the app's scripts, in order).
- Each `"/*@@text FILE@@*/"` becomes the contents of app/FILE as a JavaScript string.
- Each `/*@@NAME@@*/` line becomes `const NAME=<data>;`, with the data read from content/
  (see build_const for where each name comes from).
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / 'content'
APP = ROOT / 'app'

INCLUDE = re.compile(r'^/\*@@include ([\w./-]+)@@\*/$', re.M)
TEXT = re.compile(r'"/\*@@text ([\w./-]+)@@\*/"')
CONST = re.compile(r'^/\*@@([A-Z_0-9]+)@@\*/$', re.M)


def read_json(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def read_text(path):
    """A text file without its final line break."""
    text = Path(path).read_text(encoding='utf-8')
    return text[:-1] if text.endswith('\n') else text


def read_card_html(path):
    """A card's HTML on one line: breaks between tags are layout only; any other line break becomes a space."""
    text = re.sub(r'>[ \t]*\r?\n\s*<', '><', read_text(path))
    return re.sub(r'\s*\r?\n\s*', ' ', text)


def to_js(value):
    """JSON that is safe to place inside a <script> element."""
    return json.dumps(value, ensure_ascii=False).replace('</', '<\\/')


def subfolders(path):
    return sorted(child for child in path.iterdir() if child.is_dir())


def read_stop(folder):
    """A stop or note folder: stop.json with its card files and quiz filled in."""
    stop = read_json(folder / 'stop.json')
    # {"shared": "NAME"} stands for the card in content/data/NAME.json, so one card can appear on several stops
    stop['cards'] = [
        (
            {**read_json(CONTENT / 'data' / f"{card['shared']}.json"), 'shared': card['shared']}
            if isinstance(card, dict) and 'shared' in card
            else card
        )
        for card in stop.get('cards', [])
    ]
    for card in stop['cards']:
        if isinstance(card, dict) and isinstance(card.get('b'), str) and card['b'].startswith('file:'):
            card['b'] = read_card_html(folder / card['b'][len('file:') :])
    if stop.get('q') == 'file:quiz.json':
        stop['q'] = read_json(folder / 'quiz.json')
    return stop


def build_const(name):
    """The JavaScript `const NAME=...;` for one /*@@NAME@@*/ marker."""
    if name == 'STAGES':
        # The stage files are JavaScript object literals (they use IMPORTED and helper calls), joined in order
        stages = CONTENT / 'path' / 'stages'
        parts = [read_text(stages / file) for file in read_json(stages / '_order.json')]
        return 'const STAGES=[\n' + '\n'.join(parts) + '\n];'

    if name == 'PRIMARY':
        value = {}
        for key in read_json(CONTENT / 'primary' / '_keys.json'):
            if key == 'topics':
                value['topics'] = {}
                for topic in read_json(CONTENT / 'primary' / 'topics.json'):
                    topic = dict(topic)
                    topic_id, file = topic.pop('id'), topic.pop('file')
                    value['topics'][topic_id] = {**topic, 'h': read_card_html(CONTENT / 'primary' / file)}
            else:
                value[key] = read_json(CONTENT / 'primary' / f'{key}.json')

    elif name == 'IMPORTED':
        value = {}
        for section in read_json(CONTENT / 'specialties' / '_sections.json'):
            value[section['key']] = [
                read_stop(folder) for folder in subfolders(CONTENT / 'specialties' / section['dir'])
            ]

    elif name in ('SBA_BANK', 'PSBA_BANK'):
        bank = CONTENT / 'sba' / ('final' if name == 'SBA_BANK' else 'primary')
        questions = {}
        for file in sorted(bank.glob('*.json')):
            if file.name.startswith('_'):
                continue
            for question in read_json(file):
                if question['id'] in questions:
                    sys.exit(f'Duplicate question id {question["id"]} in {file}')
                questions[question['id']] = question
        order = read_json(bank / '_order.json')
        # questions in _order.json first, in that order; any new ids go at the end
        value = [questions.pop(qid) for qid in order if qid in questions] + list(questions.values())

    elif name in ('WPBA', 'RECIPES'):
        library = CONTENT / ('wpba' if name == 'WPBA' else 'recipes')
        value = {entry['name']: read_card_html(library / entry['file']) for entry in read_json(library / '_index.json')}

    elif name == 'NEW_STOPS':
        value = []
        added = CONTENT / 'path' / 'added-stops'
        for folder_name in read_json(added / '_order.json'):
            entry = read_json(added / folder_name / 'placement.json')
            entry['stop'] = read_stop(added / folder_name / 'stop')
            value.append(entry)

    elif name == 'PREOP_STOP':
        value = read_stop(CONTENT / 'path' / 'preop-stop')

    else:
        value = read_json(CONTENT / 'data' / f'{name}.json')

    return f'const {name}={to_js(value)};'


def assemble_page():
    """app/page.html with each /*@@include FILE@@*/ line replaced by app/FILE (the stylesheet and the app's scripts)."""
    page = (APP / 'page.html').read_text(encoding='utf-8')
    return INCLUDE.sub(lambda match: read_text(APP / match.group(1)), page)


def build():
    page = assemble_page()
    # "/*@@text FILE@@*/" becomes app/FILE as a JavaScript string (the tax tracker's own stylesheet and markup)
    page = TEXT.sub(
        lambda match: json.dumps((APP / match.group(1)).read_text(encoding='utf-8'), ensure_ascii=False).replace(
            '</', '<\\/'
        ),
        page,
    )
    out = CONST.sub(lambda match: build_const(match.group(1)), page)
    (ROOT / 'dist').mkdir(exist_ok=True)
    (ROOT / 'dist' / 'index.html').write_text(out, encoding='utf-8')
    (ROOT / 'dist' / '.nojekyll').touch()
    return out


if __name__ == '__main__':
    out = build()
    print(f'Built dist/index.html ({len(out.encode()) / 1e6:.2f} MB)')
