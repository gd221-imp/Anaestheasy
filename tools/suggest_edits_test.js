#!/usr/bin/env node
/* Suggest edits round trip: in headless Chrome, a pretend reviewer edits a spread of tabs with the
   in-app editor (app/js/18-suggest-edits.js) and presses Send, against a stand-in for the live
   database. tools/suggestions.py then applies the suggestions to a temporary copy of the repository,
   the copy is built, and every edited tab must show exactly the reviewer's version, with nothing
   else in the files changed. The real content is never touched.
   Usage: python3 tools/build.py && node tools/suggest_edits_test.js */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const {execFileSync} = require("child_process");
const {openApp: open1, ROOT} = require("./lib/chrome");
// Chrome sometimes isn't ready straight after the previous copy closes: try again
async function openApp(opts) {
  for (let i = 0; ; i++) {
    try {
      return await open1(opts);
    } catch (e) {
      if (i >= 2) throw e;
      await new Promise(r => setTimeout(r, 1500));
    }
  }
}

const GH = !!process.env.GITHUB_ACTIONS;
const fail = msg => console.log(GH ? `::error::suggest edits test: ${msg}` : `ERROR   ${msg}`);

// a stand-in for the live app's database and signed-in user
const INIT = `localStorage.setItem("aa-review", "true");
window.__store = {};
const D = p => ({get: async () => ({data: () => window.__store[p]}), set: async v => { window.__store[p] = JSON.parse(JSON.stringify(v)); }, onSnapshot() { return () => {}; }});
const COL = {onSnapshot() { return () => {}; }, get: async () => ({docs: []}), doc: D, where() { return COL; }, orderBy() { return COL; }, limit() { return COL; }};
const db = {doc: D, collection: () => COL};
const user = {id: async () => "u1", isOwner: async () => false, profiles: async () => ({u1: {name: "Test Reviewer"}})};
window.claude = {use: async n => (n === "db" ? db : n === "user" ? user : null)};`;

/* Runs inside the app: edit every 3rd stop's editable tabs (and all Foundation stops) through the editor */
async function reviewer() {
  await new Promise(r => setTimeout(r, 600));
  const problems = [];
  let n = 0;
  const pick = ALL.filter((s, i) => s.id.startsWith("found") || i % 3 === 0);
  for (const st of pick) {
    const subs = subsOf(st);
    openSub(st.id, subs[0].id);
    for (let i = 0; i < subs.length; i++) {
      goSub(i);
      draw();
      if (!seEditable()) continue;
      const btn = document.querySelector("#seEdit");
      if (!btn) {
        problems.push(`${st.title} › ${subs[i].name}: no Suggest edits button`);
        continue;
      }
      btn.click();
      const ed = document.querySelector("#seEd");
      const blocks = ed.querySelectorAll("li, p");
      const t = blocks[Math.min(2, blocks.length - 1)];
      if (!t) {
        document.querySelector("#seCancel").click();
        continue;
      }
      t.append(" EDITED" + n); // change one block…
      if (t.tagName === "LI") {
        const li = document.createElement("li");
        li.textContent = "New point " + n;
        t.after(li);
      } // …and add one
      document.querySelector("#seNote").value = "note " + n;
      document.querySelector("#seSend").click();
      await new Promise(r => setTimeout(r, 20));
      n++;
      if (SE.editing)
        problems.push(
          `${st.title} › ${subs[i].name}: still editing after Send (${document.querySelector("#seStat").textContent})`
        );
    }
    sheet.hidden = true;
    L = null;
  }
  return {n, problems, store: window.__store};
}

/* Runs inside the rebuilt copy: each edited tab must now read as the reviewer's version */
function shows(items) {
  const norm = s => s.replace(/&amp;/g, "&").replace(/\s+/g, " ").replace(/> </g, "><").trim();
  const bad = [];
  for (const it of items) {
    const st = ALL.find(s => s.id === it.stop),
      c = st && st.cards[+it.card];
    if (!c) {
      bad.push(`${it.stopTitle} › ${it.tab}: tab missing`);
      continue;
    }
    const d = document.createElement("div");
    d.innerHTML = c.b;
    if (norm(seLines(seCleanNode(d)).join("")) !== norm(it.after))
      bad.push(`${it.stopTitle} › ${it.tab}: doesn't show the suggested text`);
  }
  return bad;
}

(async () => {
  let errors = 0;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aa-suggest-"));
  try {
    const app = await openApp({init: INIT});
    const r = await app.evaluate(reviewer);
    app.errors.forEach(e => {
      fail(e);
      errors++;
    });
    r.problems.forEach(p => {
      fail(p);
      errors++;
    });
    await app.close();
    const docs = Object.entries(r.store).map(([k, v]) => ({id: k.split("/")[1], data: v}));
    const items = docs.flatMap(d => Object.values(d.data.items));
    if (items.length !== r.n || r.n < 50) {
      fail(`expected the ${r.n} edits to be saved, found ${items.length}`);
      errors++;
    }

    // apply to a copy of the repository, then build the copy
    for (const d of ["app", "content", "tools"]) fs.cpSync(path.join(ROOT, d), path.join(tmp, d), {recursive: true});
    fs.writeFileSync(path.join(tmp, "export.json"), JSON.stringify(docs));
    const out = execFileSync(
      "python3",
      [path.join(tmp, "tools", "suggestions.py"), "apply", path.join(tmp, "export.json")],
      {encoding: "utf8"}
    );
    const notApplied = out.split("\n").filter(l => /^\S+ +(conflict|manual|missing)/.test(l));
    notApplied.forEach(l => {
      fail("not applied: " + l);
      errors++;
    });
    out
      .split("\n")
      .filter(l => /rewritten in full/.test(l))
      .forEach(l => {
        fail("rewritten in full: " + l);
        errors++;
      });
    execFileSync("python3", [path.join(tmp, "tools", "build.py")], {encoding: "utf8"});
    const copy = await openApp({file: path.join(tmp, "dist", "index.html")});
    const bad = await copy.evaluate(shows, items);
    await copy.close();
    bad.forEach(b => {
      fail(b);
      errors++;
    });

    // only the edited blocks change: about one line per edit (a block written over several lines counts each)
    let changed = 0;
    try {
      execFileSync("git", ["diff", "--no-index", "--numstat", path.join(ROOT, "content"), path.join(tmp, "content")], {
        encoding: "utf8"
      });
    } catch (e) {
      for (const l of String(e.stdout).trim().split("\n")) {
        const [, del] = l.split("\t");
        changed += +del || 0;
      }
    }
    if (changed > Math.ceil(items.length * 1.1)) {
      fail(`${changed} lines removed or changed for ${items.length} edits: untouched text was rewritten`);
      errors++;
    }
    console.log(`Suggest edits test: ${items.length} tabs edited, sent, applied and rebuilt — ${errors} problem(s)`);
  } catch (e) {
    fail(e.message);
    errors++;
  } finally {
    fs.rmSync(tmp, {recursive: true, force: true});
  }
  process.exit(errors ? 1 : 0);
})();
