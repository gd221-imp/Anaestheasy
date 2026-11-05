# Anaesthetic Ally

Anaesthetic Ally is a UK anaesthetics training app that takes a doctor from FY1 to their first years as a consultant, one stop at a time. This repository holds its content and code, split so the team can each own a section.

**© 2026 Dr David Griffiths BMBS MMedSc FRCA. All rights reserved.** Nothing here may be copied, reused or redistributed without written permission. See [LICENSE](LICENSE).

- **Team brief:** what the app is and who owns what (shared separately).
- **[WORKSTREAMS.md](WORKSTREAMS.md):** which folders belong to which workstream.
- **[CONTRIBUTING.md](CONTRIBUTING.md):** how to make a change, and the house rules.

## How it fits together

| Folder | What's in it |
| --- | --- |
| `content/path/stages/` | The five stages of the path (Foundation → Consultant) and their hand-written stops |
| `content/path/added-stops/` | Extra operation stops slotted into the path, each with a `placement.json` |
| `content/specialties/` | Every specialty stop and Final FRCA note, one folder each: `stop.json`, `cards/*.html`, `quiz.json` |
| `content/primary/` | The 209 Primary FRCA topics (`topics/<category>/*.html`), indexed in `topics.json` |
| `content/sba/` | Single best answer banks, one file per area (`final/`, `primary/`) |
| `content/recipes/`, `content/wpba/` | Recipes and sample WPBAs for the few stops and notes without their own folder. Every other recipe and WPBA lives once, in its stop's `cards/` folder (a note with the same name as an operation shows that operation's recipe) |
| `content/data/` | Drug reference, curriculum key capabilities, NICE pre-op tests |
| `app/page.html` | The app's code and layout, with markers where content is inserted |
| `tools/` | `build.py` (assemble the app), `check.py` (house-rule checks), `split.py` (one-off split, kept for reference) |

## Build and preview

```bash
python3 tools/check.py      # checks content, house rules and JavaScript syntax, then builds
python3 tools/build.py      # writes dist/index.html, the whole app in one page
node tools/smoke_test.js    # opens every stop, tab, note and topic in headless Chrome
```

**Links to a stop:** add `#stop=<id>` (and optionally `&tab=<tab name>`) to the app's address to open a stop at a given tab, e.g. `dist/index.html#stop=st2-15&tab=Anaesthetic%20recipe`. `#note=<title>` and `#topic=<Primary id>` work the same way. The review summary on each pull request uses these to link straight to what changed.

The smoke test needs Node 22+ and Google Chrome (set `CHROME_PATH` if Chrome isn't found), and no npm packages. It fails if anything throws an error or shows broken text such as `undefined`, `NaN` or a stray `}`. All three run automatically on every pull request.

Open `dist/index.html` in a browser to see the app. No installs are needed beyond Python 3.

Every pull request is checked and built automatically. Open the check run on the pull request and download **pathway-preview** to see the app with that change. Once GitHub Pages is switched on (Settings → Pages → Source: GitHub Actions), each merge to `main` also updates a preview website.

**Note:** the forum, news, jobs and sign-in only work in the live version hosted on claude.ai. In a local or GitHub preview those panels show as empty; everything else works.

## Publishing

`main` is the master copy. When David is ready to release, the built `dist/index.html` is published to the live app. The same build will feed the iOS app later (workstream 8).
