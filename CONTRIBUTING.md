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
7. Download **pathway-preview** from the check run and open it to see your change in the app.
8. David reviews it, then merges it or comments.

Group related changes into one pull request (for example, one stop or one note). Keep unrelated changes separate.

## What the files look like

### A stop or note: `content/specialties/<section>/<NNN>-<stop|note>-<name>/`

- `stop.json` — the stop's title, type and list of tabs (cards). Each tab has a heading `h`. A tab's text lives in a file, shown as `"b": "file:cards/01-anaesthetic-recipe.html"`. Tabs that link elsewhere use `noteRef` (a Final FRCA note title) or `primaryRef` (a Primary topic id such as `pha20`).
- `cards/*.html` — the text of each tab, one HTML block per line.
- `quiz.json` — the questions at the end of the stop.

The number at the start of the folder name sets the order. To add a stop, copy a similar folder, give it the next number and edit the files. To add a tab, add an entry to `cards` in `stop.json` and a matching `.html` file.

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
- **Antibiotics:** write "Follow local guidelines" before any antibiotic recommendation. The check flags antibiotics named without it.
- **Intrathecal opioid** is always diamorphine, never intrathecal morphine. The check fails if it finds intrathecal morphine.
- **Cannulas:** order is 20G then 16G.
- **Complications** are always split into Surgical and Anaesthetic, each with Immediate and Delayed.
- **Notes:** a maximum of three linked note topics per stop.
- **Sources:** keep inline references; summarise books in your own words, never copy their text.
- **Our own notes come first.** New content fills agreed gaps only.
- **Local practice** can follow the national position, labelled "Local practice here".
- **Nothing is lost.** Correct wrong facts, but reword rather than delete useful content.
- **Education only.** Anaesthetic Ally supports learning, not clinical decision-making.
