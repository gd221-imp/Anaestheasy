# Contributing to Anaesthetic Ally

## The rules in one line

Edit only your own section, send every change as a pull request, and David approves it before it goes into the app.

## Copyright and your contributions

Anaesthetic Ally and everything in this repository is © 2026 Dr David Griffiths, all rights reserved (see [LICENSE](LICENSE)). Do not copy content out of the repository or share it outside the team.

By opening a pull request you confirm that:

- the work is your own, or is credited to its source and summarised in your own words rather than copied;
- you assign the copyright in your contribution to Dr David Griffiths, so he can publish, change and distribute the app (including on the App Store); and
- you will be credited as a contributor in the app.

If you do not agree, do not open a pull request; talk to David first.

## Making a change in the browser (no software needed)

1. Find the file. Use [WORKSTREAMS.md](WORKSTREAMS.md) for your folders, or press `t` on the repository page and type part of the stop's name.
2. Click the pencil icon (Edit this file).
3. Make your change.
4. Click **Commit changes…**, choose **Create a new branch for this commit and start a pull request**, and give it a short name such as `obs-lscs-oxytocin`.
5. Fill in the pull request form: what changed, why, and your source. Tick the checklist.
6. Wait for the automatic check (a green tick). If it's red, open it to see what to fix.
7. A **Review summary** comment appears on the pull request within a minute or two. It lists the stops and notes you changed, each with an **open in preview** link that opens the app at that exact tab (on a phone too). It also shows any quiz or SBA questions with the correct answer marked ✅, a warning if a correct answer changed, and any dose changes side by side. Check it says what you meant to change.
8. David reviews it, then merges it or comments.

Group related changes into one pull request (for example, one stop or one note). Keep unrelated changes separate. The summary flags a pull request that spans several workstreams, or mixes content with technical files.

## Reviewing in the app (no GitHub needed)

Reviewers check one section of the app and change its text on screen, without touching any files.

1. David shares the live app with you as a **Contributor** and sends you the link to your section. The links end in `#review=` and the section: `foundation`, `core`, `primary`, `final-a`, `final-b` or `stage3`. Open it once and the app remembers it in that browser (`#review=off` turns review mode off).
2. A **Review** bar on the path opens **Your review list**: every stop, note or topic in your section, with its status (to do, changes sent, no changes). Anything David has asked you to look at is at the top.
3. Open each one. Tap **✏️ Suggest edits** to change a tab (in a Final FRCA note, the ✏️ under each heading), as you want it to read. The toolbar gives you bold, headings, subheadings, lists, the dose highlight and links; pasted text arrives plain. Add a note for David if it helps (why, or your source) and tap **Send suggestion**.
4. If it's fine as it is, tap **✓ Looks good, no changes**.

You can come back to change or withdraw a suggestion until David picks it up. Your work is saved against your Claude account; nobody else sees it, and the app doesn't change until David approves it. Quizzes, sample WPBAs and shared cards (such as the NICE pre-op tests) can't be edited this way yet: mention them in a note.

**For David:** the Review bar shows you **Review progress** for every section. To bring work in, ask Claude to "bring in the suggestions": it opens one pull request per reviewer, crediting them, and ticks their items on the GitHub review lists. Lines the reviewer didn't touch stay exactly as they were; a suggestion whose text has changed since the reviewer started is skipped and listed, not forced in. To ask a reviewer to look at something, tell Claude (e.g. "ask the Foundation reviewer to check the MSRA dates").

## Editing in VS Code

For a change that touches several files (a stop's `stop.json`, its `cards/` and its `quiz.json`, say), use VS Code. The repository comes set up for it.

**In the browser, with nothing to install:** on the repository page press `.` (full stop). VS Code opens in the browser with the files on the left. Press `Ctrl+P` (`Cmd+P` on a Mac) and type part of a file name to open it. To save your work, open **Source Control** on the left, type a short message, choose **Commit to new branch**, give it a name such as `obs-lscs-oxytocin`, then **Create Pull Request**. The automatic check and preview then work exactly as above.

**On your own computer:** install [VS Code](https://code.visualstudio.com), open **Clone Git Repository** from its start page, choose GitHub and pick `gd221-imp/Anaestheasy`. Accept the prompt to install the recommended extensions. Make a branch (click the branch name at the bottom left → **Create new branch**), edit, commit, then **Publish Branch** and create the pull request from the GitHub panel. You can also run the checks yourself before you push: **Terminal → Run Task…**, then:

- **Check (run before every pull request)**: `tools/check.py`; it must show 0 errors.
- **Build and open preview**: builds the app and opens it in your browser.
- **Smoke test**: opens every screen (needs Node 22+ and Chrome).

**What you get in both:**

- **Shortcuts for the house layouts.** In a tab's `.html` file type `complications` and press `Tab` for the full Surgical/Anaesthetic × Immediate/Delayed layout, then `Tab` again to jump to each gap. Others: `h4`, `subh`, `para`, `ul`, `ol`, `li`, `bold`, `dose`, `link` (select some text first and `bold` or `dose` wraps it). In a JSON file: `quizq`, `sbaq`, `tabfile`, `tabrecipe`, `tabwpba`, `tabnote`, `tabprimary`, `tabcurric`.
- **Mistakes underlined as you type** in `stop.json`, `quiz.json`, SBA files and `placement.json`: a misspelt key, a missing `"why"`, an answer number beyond the options, a tab file not in `cards/`, an id without its stage prefix. Hover over the squiggle for what's wrong. These are early hints only; the check on the pull request is still the one that counts.
- **British spelling**, using the same dictionary and drug-name list as the automatic spell check.

Content `.html` files are never reformatted on save, so the one-block-per-line layout stays as you wrote it.

## What the files look like

### A stop or note: `content/specialties/<section>/<NNN>-<stop|note>-<name>/`

- `stop.json` — the stop's title, type and list of tabs (cards). A card written as `{"shared": "NG45_CARD"}` shows a card kept once in `content/data/` (here the NICE pre-op tests card), so it can appear on several stops. Each tab has a heading `h`. A tab's text lives in a file, shown as `"b": "file:cards/01-anaesthetic-recipe.html"`. Tabs that link elsewhere use `noteRef` (a Final FRCA note title) or `primaryRef` (a Primary topic id such as `pha20`).
- `cards/*.html` — the text of each tab, one HTML block per line.
- `quiz.json` — the questions at the end of the stop.

The number at the start of the folder name sets the order. To add a stop, copy a similar folder, give it the next number and edit the files. **Give the new stop its own `"id"`** at the top of `stop.json`: the stage prefix (`found`, `core`, `st2`, `st3` or `cons`) plus a short name, e.g. `"id": "st2-ruptured-aaa"`. Never change or reuse an existing id: users' saved progress and the SBA links (`"st"` in `content/sba/final/`) depend on it. The checks will tell you if an id is missing, duplicated or linked to a stop that doesn't exist. To add a tab, add an entry to `cards` in `stop.json` and a matching `.html` file.

### The text of a tab (`.html`)

Write one block per line. The tags you'll need:

| You want | Write |
| --- | --- |
| Heading in a tab | `<h4>Pre-op</h4>` |
| Small subheading | `<p class="subh">History (Hx)</p>` |
| Paragraph | `<p>Text</p>` |
| Bold | `<b>bold words</b>` |
| Bullet list | `<ul>` then one `<li>item</li>` per line, then `</ul>` |
| Numbered list | `<ol>` … `</ol>` |
| Drug dose highlight | `<span class="dose">300 units/kg</span>` |
| Link | `<a href="https://…" target="_blank" rel="noopener">text</a>` |

Line breaks between tags don't show in the app; a line break inside a sentence becomes a space.

Complications always use this layout:

```html
<h4>Complications</h4>
<p class="csub"><b>Surgical</b></p>
<p class="subh">Immediate</p>
<ul>
<li>…</li>
</ul>
<p class="subh">Delayed</p>
<ul>
<li>…</li>
</ul>
<p class="csub"><b>Anaesthetic</b></p>
<p class="subh">Immediate</p>
<ul>
<li>…</li>
</ul>
<p class="subh">Delayed</p>
<ul>
<li>…</li>
</ul>
```

### A quiz question (`quiz.json` or an SBA file)

```json
{
  "q": "Which nerve is most at risk in the lithotomy position?",
  "o": ["Femoral", "Common peroneal", "Obturator", "Sciatic", "Ulnar"],
  "a": 1,
  "why": "Compression at the fibular head by the stirrups causes foot drop."
}
```

`a` counts from 0, so `"a": 1` is the second option. SBA questions also carry `id`, `ar` (area) and `sb`; give a new question the next unused id. Quotes inside text need a backslash: `\"`.

### Path stages (`content/path/stages/*.js`)

These are written as code, not JSON. Edit the words inside the backticks (`` `…` ``) and quotes only, and keep every comma and bracket. If the check goes red after editing one, ask the technical owner.

## House rules

- **UK practice first.** Use UK guidance (RCoA, Association of Anaesthetists, DAS, OAA, NICE, RCUK, APA). Where a US text such as Miller differs, give the UK position and note the difference.
- **Antibiotics:** in a recipe, write "Follow local guidelines" with any antibiotic recommendation. The check flags recipes that name an antibiotic without it. Notes (for example pharmacology and microbiology topics) may name antibiotics freely.
- **Intrathecal opioid** is always diamorphine, never intrathecal morphine. The check fails if it finds intrathecal morphine anywhere (cards, stage files, quizzes and SBAs).
- **Cannulas:** order is 20G then 16G. The check fails if 16G (or 14G) is listed before 20G on the same line. Quiz answers aren't checked, so a deliberately wrong option is fine.
- **Complications** in a recipe are always split into Surgical then Anaesthetic, each with Immediate then Delayed. The check fails on a recipe laid out differently. Older recipes still to be converted are listed in `tools/complications_todo.json`; remove one from that list once it's fixed (the check will remind you).
- **HTML:** every tag that opens must close. To show `<` or `>` as text (for example `<C>ABCDE`), write `&lt;C&gt;ABCDE`.
- **Links** (`stop:`, `curric:` and Primary topic ids) and added-stop placements must point at something that exists. The check names any that don't.
- **Notes:** ideally no more than three linked note topics per stop. This is a guide, not a hard rule, so the checks don't flag it.
- **Sources:** keep inline references; summarise books in your own words, never copy their text.
- **Our own notes come first.** New content fills agreed gaps only.
- **Local practice** can follow the national position, labelled "Local practice here".
- **Nothing is lost.** Correct wrong facts, but reword rather than delete useful content.
- **Education only.** Anaesthetic Ally supports learning, not clinical decision-making.
