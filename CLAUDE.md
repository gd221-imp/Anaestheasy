# Anaesthetic Ally: instructions for Claude

Anaesthetic Ally is a UK anaesthetics training app (FY1 to new consultant). This repository is the **master copy**. The live app is a claude.ai artifact: https://claude.ai/artifact/Snz4DcZk9eWfBrthiPcjEk

## Rules for any change

- Edit files in `content/` (and `app/` for code: `page.html` is the page shell, `styles.css` the styles, `js/*.js` the app's script in order), never the built `dist/index.html` and never the live artifact directly.
- Follow the house rules in CONTRIBUTING.md: UK practice first; "Follow local guidelines" with any antibiotic recommendation in a recipe (notes may name antibiotics freely); intrathecal opioid is always diamorphine; cannulas 20G then 16G; complications split into Surgical and Anaesthetic, each with Immediate and Delayed; ideally no more than three linked note topics per stop (a guide, not checked); summarise books, never copy; keep inline references; reword rather than delete useful content.
- David's own notes come first. Only fill gaps he has approved; never add new clinical content unprompted.
- Mark a stop reviewed only when David says so.
- Work on a branch and open a pull request; David approves every merge.
- Run `python3 tools/check.py` before committing. It must show 0 errors.

## Layout

See README.md (folders) and WORKSTREAMS.md (who owns what). A stop or note is a folder: `stop.json` (titles, tabs, links), `cards/*.html` (tab text, one block per line), `quiz.json`.

## Publishing to the live app

1. `python3 tools/build.py` → `dist/index.html`.
2. Read the live artifact first and compare it with the fresh `dist/index.html`: if it has changes that are not in `main` (made in another chat), copy them into the matching `content/` or `app/` files by hand and open a pull request for them before publishing. (`tools/split.py` is historical and no longer matches the layout.)
3. Publish `dist/index.html` to the artifact URL above, keeping its existing runtime capabilities.

## Reviewers' in-app suggestions

Reviewers use **Suggest edits** in the live app (`#review` in the address; `app/js/18-suggest-edits.js`). Suggestions live in the live artifact's database, collection `suggestions`, one document per reviewer: `{name, items: {"<stop id>|<tab>": {stop, stopTitle, card, tab, before, beforeLines, after, lines, note, at, status}}}`. When David asks to bring them in:

1. Export with the artifact database tools (`db_list` on `suggestions`) to a JSON file outside the repository.
2. On a new branch per reviewer: `python3 tools/suggestions.py apply export.json --who "<name>" --report pr.md`, then `python3 tools/check.py`. Report any conflict or manual items to David rather than forcing them.
3. Open the pull request with `pr.md` as its description (credit the reviewer), then set each applied item's `status` to `"pr"` and `pr` to the pull request number in their document (`db_write`), keeping everything else in it.
4. The house rules still apply to what reviewers write: point out anything that breaks them in the pull request, but don't rewrite their clinical content.

The live artifact's database rules must include `{"path":"suggestions","read":"owner","write":"owner"}` and `{"path":"suggestions/{self}","read":"interact","write":"interact"}`: each reviewer reads and writes only their own document, and only David reads them all.
