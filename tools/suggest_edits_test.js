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
const INIT = `localStorage.setItem("aa-review", "true"); localStorage.setItem("aa-review-section", '"final-a"');
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
      const btn = document.querySelector("[data-se-edit]");
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
  // Final FRCA notes: one ✏️ per section
  for (const note of NOTES.filter((x, i) => i % 9 === 0)) {
    openNote(note);
    const btns = [...document.querySelectorAll(".nsec .semini")];
    if (!btns.length) continue;
    btns[0].click();
    const ed = document.querySelector("#seEd"),
      t = ed && ed.querySelectorAll("li, p")[0];
    if (!t) {
      document.querySelector("#seCancel").click();
      continue;
    }
    t.append(" EDITED" + n++);
    document.querySelector("#seSend").click();
    await new Promise(r => setTimeout(r, 20));
    if (SE.editing) problems.push(`note ${note.title}: still editing after Send`);
    sheet.hidden = true;
    L = null;
  }
  // Primary topics
  for (const k of Object.keys(PRIMARY.topics).filter((x, i) => i % 15 === 0)) {
    goTopic(k);
    const b = document.querySelector("[data-se-edit]");
    if (!b) {
      problems.push(`topic ${k}: no Suggest edits button`);
      continue;
    }
    b.click();
    const ed = document.querySelector("#seEd"),
      t = ed.querySelectorAll("li, p")[1] || ed.querySelectorAll("li, p")[0];
    t.append(" EDITED" + n++);
    document.querySelector("#seSend").click();
    await new Promise(r => setTimeout(r, 20));
    if (SE.editing) problems.push(`topic ${k}: still editing after Send`);
    sheet.hidden = true;
    L = null;
  }
  // Quiz questions: edit a stop's own question, add one, flag one, and edit a shared SBA bank question
  let nq = 0,
    nsba = 0;
  for (const st of ALL.filter((s, i) => i % 5 === 1 && s.q && s.q.length)) {
    const subs = subsOf(st),
      qi = subs.findIndex(x => x.id === "q");
    if (qi < 0) continue;
    openSub(st.id, subs[0].id);
    goSub(qi);
    draw();
    // step through to a question of the kind still wanted
    for (let k = 0; k < L.steps.length - 1; k++) {
      L.step = k;
      draw();
      const q = L.steps[k].q,
        sba = !!q.id;
      if ((sba && nsba >= 6) || (!sba && nq >= 12)) continue;
      const mode = sba ? "edit" : ["edit", "new", "flag"][nq % 3];
      const b = document.querySelector(`[data-se-q="${mode}"]`);
      if (!b) {
        problems.push(`${st.title}: no ${mode} button on a quiz question`);
        break;
      }
      b.click();
      if (mode === "flag") document.querySelector("#seNote").value = "Flag " + n;
      else if (mode === "new") {
        document.querySelector("#seQq").value = "New question " + n + "?";
        ["Alpha", "Beta", "Gamma", "Delta", ""].forEach((v, i) => (document.querySelector("#seQo" + i).value = v));
        document.querySelector("#seQa2").checked = true;
        document.querySelector("#seQwhy").value = "Because " + n;
      } else document.querySelector("#seQq").value += " EDITED" + n;
      document.querySelector("#seSend").click();
      await new Promise(r => setTimeout(r, 20));
      n++;
      if (SE.editing)
        problems.push(
          `${st.title}: quiz ${mode} still open after Send (${document.querySelector("#seStat").textContent})`
        );
      sba ? nsba++ : nq++;
      break;
    }
    sheet.hidden = true;
    L = null;
  }
  if (nq < 9 || nsba < 3) problems.push(`only ${nq} quiz and ${nsba} SBA questions were tried`);
  // "Looks good" on a stop, then the review list shows it
  const ok = ALL.find(s => s.stage.id === "st2" && s.group === "Cardiac" && !seSent("stop:" + s.id).length);
  openSub(ok.id, subsOf(ok)[0].id);
  document.querySelector("[data-se-ok]").click();
  await new Promise(r => setTimeout(r, 20));
  if (!SE.checked["stop:" + ok.id]) problems.push("Looks good was not saved");
  sheet.hidden = true;
  L = null;
  seOpenList();
  const rows = document.querySelectorAll(".serow");
  if (rows.length !== seSection().list().length)
    problems.push(`review list shows ${rows.length} rows, expected ${seSection().list().length}`);
  if (!document.querySelector(".serow .s-ok")) problems.push("review list does not show the looks-good stop as done");
  if (!document.getElementById("seBar") || document.getElementById("seBar").hidden)
    problems.push("no review banner on the path");
  close();
  return {n, problems, store: window.__store};
}

/* Runs inside the rebuilt copy: each edited tab must now read as the reviewer's version */
function shows(items) {
  const norm = s => s.replace(/&amp;/g, "&").replace(/\s+/g, " ").replace(/> </g, "><").trim();
  const bad = [];
  for (const it of items) {
    let b;
    if (it.kind === "quiz" || it.kind === "sba") {
      if (it.mode === "flag") continue;
      const pool = it.kind === "sba" ? SBA_BANK.concat(PSBA_BANK) : (ALL.find(s => s.id === it.ref) || {}).q || [];
      const want = JSON.stringify(it.afterQ),
        hit = pool.some(q => JSON.stringify({q: q.q, o: q.o, a: q.a, why: q.why || ""}) === want);
      if (!hit) bad.push(`${it.title} › ${it.tab}: quiz doesn't show the suggested question`);
      continue;
    }
    if (it.kind === "topic") b = PRIMARY.topics[it.ref] && PRIMARY.topics[it.ref].h;
    else {
      const x = it.kind === "note" ? findNote(it.ref) : ALL.find(s => s.id === it.ref),
        c = x && x.cards[+it.card];
      b = c && c.b;
    }
    if (b == null) {
      bad.push(`${it.title} › ${it.tab}: missing`);
      continue;
    }
    const d = document.createElement("div");
    d.innerHTML = b;
    if (norm(seLines(seCleanNode(d)).join("")) !== norm(it.after))
      bad.push(`${it.title} › ${it.tab}: doesn't show the suggested text`);
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
    const notApplied = out
      .split("\n")
      .filter(l => /^\S+ +(conflict|manual|missing)/.test(l) && !/flagged for David/.test(l));
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
