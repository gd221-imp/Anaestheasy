// Review mode: reviewers check a section of the app and suggest edits on screen, with no files or GitHub.
// David sends each reviewer a link to their section, e.g. …#review=foundation. The app then shows
// "Your review list" (that section's stops, notes or topics, each with its status). Opening one shows
// "Suggest edits" on each tab the reviewer can change, and "Looks good, no changes".
// Everything a reviewer sends is saved in the live app's database as suggestions/<user id>:
//   {name, section, items: {"<item>|<tab>": suggestion}, checked: {"<item>": date}}
// where <item> is stop:<id>, note:<title> or topic:<id>. David's own requests for a stop or note are in
// review/asks: {items: {"<item>": text}}. David turns suggestions into pull requests with
// tools/suggestions.py; nothing changes in the app until he approves them.
// #review turns review mode on without a section, #review=<section> picks a section, #review=off turns it off.
var SE = {
  on: false,
  section: null,
  db: null,
  me: null,
  owner: false,
  name: "",
  items: {},
  checked: {},
  asks: {},
  ready: false,
  editing: null,
  busy: false,
  fromList: false
};
const SE_A = ["Cardiac", "Thoracic", "Vascular", "Neuro", "ICM", "Pain"];
const seStop = s => ({key: "stop:" + s.id, kind: "stop", ref: s.id, title: s.title, group: s.group || ""});
const seNote = n => ({
  key: "note:" + n.title,
  kind: "note",
  ref: n.title,
  title: n.title,
  group: (n.group || "") + " notes"
});
const SE_SECTIONS = [
  {id: "foundation", name: "Foundation stops", list: () => ALL.filter(s => s.stage.id === "found").map(seStop)},
  {id: "core", name: "Core training stops", list: () => ALL.filter(s => s.stage.id === "core").map(seStop)},
  {
    id: "primary",
    name: "Primary FRCA topics",
    list: () =>
      Object.entries(PRIMARY.topics).map(([k, t]) => ({
        key: "topic:" + k,
        kind: "topic",
        ref: k,
        title: t.n,
        group: t.c
      }))
  },
  {
    id: "final-a",
    name: "Final FRCA A: cardiac, thoracic, vascular, neuro, ICM and pain",
    list: () => [
      ...ALL.filter(s => s.stage.id === "st2" && SE_A.includes(s.group)).map(seStop),
      ...NOTES.filter(n => SE_A.includes(n.group)).map(seNote)
    ]
  },
  {
    id: "final-b",
    name: "Final FRCA B: obstetrics, paeds, surgery, regional and the rest",
    list: () => [
      ...ALL.filter(s => s.stage.id === "st2" && !SE_A.includes(s.group)).map(seStop),
      ...NOTES.filter(n => !SE_A.includes(n.group)).map(seNote)
    ]
  },
  {
    id: "stage3",
    name: "Stage 3 and Consultant stops",
    list: () => ALL.filter(s => s.stage.id === "st3" || s.stage.id === "cons").map(seStop)
  }
];
const seSection = () => SE_SECTIONS.find(s => s.id === SE.section) || null;

(() => {
  const m = location.hash.match(/(?:^#|&)review(?:=([\w-]+))?(?:&|$)/);
  if (m) {
    const v = (m[1] || "on").toLowerCase();
    if (v === "off") store.set("aa-review", false);
    else {
      store.set("aa-review", true);
      if (SE_SECTIONS.some(s => s.id === v)) store.set("aa-review-section", v);
    }
  }
  SE.on = store.get("aa-review", false) === true;
  SE.section = SE.on ? store.get("aa-review-section", null) : null;
})();

// What the sheet is showing now, as a review item: a stop, a Final FRCA note or a Primary topic
function seCurrent() {
  if (!L || L.win || L.forum) return null;
  if (L.topic && PRIMARY.topics[L.topic])
    return {key: "topic:" + L.topic, kind: "topic", ref: L.topic, title: PRIMARY.topics[L.topic].n};
  if (L.notes && L.notes.length) {
    const n = L.notes[L.notes.length - 1];
    return {key: "note:" + n.title, kind: "note", ref: n.title, title: n.title, n};
  }
  if (L.st && L.st.id && !L.st.id.startsWith("tmp-") && L.sub && L.st.stage) return seStop(L.st);
  return null;
}
// Shared cards are written once and shown on several stops (content/data/*_CARD.json): David keeps them
// himself, so reviewers can't edit them here (they can mention them in a note).
const SE_SHARED_NAMES = ["NG45_CARD", "COMP_CARD", "LOCUM_CARD", "TAX_CARD", "FELLOW_CARD", "JOBS_CARD"];
function seSharedName(c) {
  if (!c) return "";
  if (c.shared) return c.shared;
  if (/class="expmount"/.test(c.b || "")) return "EXP_CARD";
  return (
    SE_SHARED_NAMES.find(n => {
      try {
        return eval(`typeof ${n} !== "undefined" && ${n}`) === c;
      } catch (e) {
        return false;
      }
    }) || ""
  );
}
const seCardOK = c =>
  !!(c && typeof c.b === "string" && c.b.trim() && !c.primaryRef && !c.noteRef && !c.wpba && !seSharedName(c));
// The stop tab on screen, if it can be edited
function seEditable() {
  if (!SE.on || !L || L.win || L.forum || L.topic || (L.notes && L.notes.length)) return false;
  const s = L.steps && L.steps[L.step];
  if (!s || s.type !== "card" || L.sub.type !== "card") return false;
  return !!(L.st.id && !L.st.id.startsWith("tmp-") && seCardOK(s.c));
}
const seSent = key => Object.keys(SE.items).filter(k => k.startsWith(key + "|"));
function seStatus(key) {
  const sent = seSent(key).map(k => SE.items[k]);
  if (sent.some(x => x.status === "pending")) return {c: "sent", t: "Changes sent"};
  if (sent.some(x => x.status === "pr")) return {c: "review", t: "With David"};
  if (SE.checked[key]) return {c: "ok", t: "No changes"};
  if (sent.length) return {c: "ok", t: "Done"};
  return {c: "todo", t: "To do"};
}
const sePending = key => SE.items[key] && SE.items[key].status === "pending";

// Called at the end of draw(): adds the review bar (and edit buttons) to whatever the sheet shows
function seDecorate() {
  if (typeof SE === "undefined" || !SE || !SE.on || SE.editing) return;
  const cur = seCurrent();
  if (!cur) return;
  const page = sheet.querySelector(".sh-body .page");
  if (!page) return;
  const step = L.steps && L.steps[L.step];
  if (cur.kind !== "note" && step && step.type === "q") return seQuizBar(cur, page, step.q);
  if (cur.kind !== "note" && !L.topic && step && step.type !== "card") return;
  const ask = SE.asks[cur.key],
    st = seStatus(cur.key);
  let edit = null;
  if (cur.kind === "stop" && seEditable()) {
    const sub = L.sub,
      c = L.steps[L.step].c;
    edit = {
      label: sePending(cur.key + "|" + sub.id) ? "Edit my suggestion" : "Suggest edits",
      go: () => seOpen({...cur, card: sub.id, tab: sub.name, c})
    };
  } else if (cur.kind === "topic") {
    const t = PRIMARY.topics[cur.ref];
    edit = {
      label: sePending(cur.key + "|0") ? "Edit my suggestion" : "Suggest edits",
      go: () => seOpen({...cur, card: "0", tab: t.n, c: {b: t.h}})
    };
  }
  const bar = document.createElement("div");
  bar.className = "sebar";
  bar.innerHTML = `${SE.fromList && seSection() ? `<button class="selink" type="button" data-se-list>← Review list</button>` : ""}${ask ? `<p class="seask"><b>David asks:</b> ${escapeHTML(ask)}</p>` : ""}<div class="sebtns">${edit ? `<button class="sebtn" type="button" data-se-edit>✏️ ${edit.label}</button>` : ""}<button class="sebtn seok ${SE.checked[cur.key] ? "on" : ""}" type="button" data-se-ok aria-pressed="${!!SE.checked[cur.key]}">${SE.checked[cur.key] ? "✓ Marked: looks good" : "✓ Looks good, no changes"}</button><span class="sestate s-${st.c}">${st.t}</span></div>${cur.kind === "note" ? `<small>Tap ✏️ under a heading to change that part of the note.</small>` : !edit && cur.kind === "stop" ? `<small>${step && seSharedName(step.c) ? "This tab is shared with other stops and David keeps it himself." : "This tab can't be edited here."} Mention anything about it in a note when you edit another tab.</small>` : ""}`;
  page.prepend(bar);
  const li = bar.querySelector("[data-se-list]");
  if (li) li.onclick = seOpenList;
  if (edit) bar.querySelector("[data-se-edit]").onclick = edit.go;
  bar.querySelector("[data-se-ok]").onclick = () => seToggleOK(cur.key);
  // a note: one edit button per section (each section is one of the note's cards, in order)
  if (cur.kind === "note")
    page.querySelectorAll(".nsec").forEach((sec, i) => {
      const c = cur.n.cards[i];
      if (!seCardOK(c)) return;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sebtn semini";
      b.textContent = sePending(cur.key + "|" + i) ? "✏️ Edit my suggestion" : "✏️ Suggest edits";
      b.onclick = () =>
        seOpen({key: cur.key, kind: cur.kind, ref: cur.ref, title: cur.title, card: String(i), tab: c.h, c});
      const h = sec.querySelector(".nh");
      h ? h.after(b) : sec.prepend(b);
    });
}

const SE_TOOLS = [
  ["bold", "<b>B</b>", "Bold"],
  ["italic", "<i>I</i>", "Italic"],
  ["h4", "Heading", "Heading"],
  ["subh", "Subheading", "Small subheading"],
  ["p", "Text", "Normal paragraph"],
  ["ul", "• List", "Bullet list"],
  ["ol", "1. List", "Numbered list"],
  ["dose", "Dose", "Highlight a drug dose"],
  ["link", "Link", "Add a link"],
  ["undo", "↶", "Undo"],
  ["redo", "↷", "Redo"]
];

// ctx: {key (the item), kind, ref, title, card, tab, c (the card, its text in c.b)}
function seOpen(ctx) {
  const skey = ctx.key + "|" + ctx.card,
    it = SE.items[skey],
    before = ctx.c.b;
  SE.editing = {
    key: ctx.key,
    kind: ctx.kind,
    ref: ctx.ref,
    title: ctx.title,
    card: ctx.card,
    tab: ctx.tab,
    skey,
    before
  };
  const start = it && it.status === "pending" && it.before === before ? it.after : before;
  const where = ctx.kind === "note" ? "Final FRCA note · " : ctx.kind === "topic" ? "Primary FRCA topic · " : "";
  const strip = sheet.querySelector(".tstrip");
  if (strip) strip.remove();
  sheet.querySelector(".sh-head").innerHTML =
    `<button class="close" type="button" id="seCancelTop" aria-label="Stop editing">← Cancel</button><div class="sh-title">Suggesting edits · ${escapeHTML(ctx.title)}</div>`;
  sheet.querySelector(".sh-body").innerHTML =
    `<div class="page sepage"><div class="kind">${where}${escapeHTML(ctx.title)}</div><h3>${escapeHTML(ctx.tab)}</h3>
<p class="sehelp">Change the text below as you'd like it to read in the app. Your version goes to David to approve; nothing changes for anyone else until he does.</p>
<div class="setools" role="toolbar" aria-label="Formatting">${SE_TOOLS.map(([k, l, t]) => `<button type="button" data-se="${k}" title="${t}" aria-label="${t}">${l}</button>`).join("")}</div>
<div class="seed" id="seEd" contenteditable="true" spellcheck="true" lang="en-GB" aria-label="Text">${start}</div>
<label class="selab" for="seNote">Anything David should know? <small>(optional: why, or your source)</small></label>
<textarea id="seNote" class="senote" rows="3">${escapeHTML((it && it.status === "pending" && it.note) || "")}</textarea>
<p class="sestat" id="seStat" role="status"></p></div>`;
  sheet.querySelector(".sh-foot").innerHTML =
    `<button class="cta2" type="button" id="seCancel">Cancel</button>${it && it.status === "pending" ? `<button class="cta2" type="button" id="seWithdraw">Withdraw suggestion</button>` : ""}<button class="cta" type="button" id="seSend">Send suggestion</button>`;
  const ed = sheet.querySelector("#seEd");
  try {
    document.execCommand("defaultParagraphSeparator", false, "p");
  } catch (e) {}
  sheet.querySelector(".setools").addEventListener("mousedown", e => e.target.closest("button") && e.preventDefault());
  sheet.querySelector(".setools").onclick = e => {
    const b = e.target.closest("button[data-se]");
    if (b) seTool(b.dataset.se, ed);
  };
  ed.addEventListener("paste", e => {
    // paste as plain text so formatting from Word or a website doesn't come along
    const t = (e.clipboardData || window.clipboardData).getData("text/plain");
    if (t == null) return;
    e.preventDefault();
    document.execCommand("insertText", false, t);
  });
  const cancel = () => {
    if (seCleanHTML(ed) !== seCleanHTML(seParse(start)) && !confirmLeave()) return;
    seDone();
  };
  sheet.querySelector("#seCancel").onclick = cancel;
  sheet.querySelector("#seCancelTop").onclick = cancel;
  sheet.querySelector("#seSend").onclick = () => seSend(ed);
  const wd = sheet.querySelector("#seWithdraw");
  if (wd) wd.onclick = () => seWithdraw();
  ed.focus();
}
function seDone() {
  SE.editing = null;
  draw();
}
// A tab-local "are you sure": the first tap warns, a second tap within 4 s leaves
let seWarned = 0;
function confirmLeave() {
  if (Date.now() - seWarned < 4000) return true;
  seWarned = Date.now();
  seSay("You have unsent changes. Tap Cancel again to discard them.");
  return false;
}
const seSay = t => {
  const s = sheet.querySelector("#seStat");
  if (s) s.textContent = t;
};

function seBlock(ed) {
  const sel = getSelection();
  if (!sel.rangeCount) return null;
  let n = sel.getRangeAt(0).startContainer;
  if (n.nodeType === 3) n = n.parentNode;
  while (n && n !== ed && n.parentNode !== ed && !/^(P|H4|LI)$/.test(n.tagName)) n = n.parentNode;
  return n && n !== ed ? n : null;
}
function seTool(k, ed) {
  ed.focus();
  const ex = (c, v) => document.execCommand(c, false, v);
  if (k === "bold" || k === "italic" || k === "undo" || k === "redo") ex(k);
  else if (k === "ul") ex("insertUnorderedList");
  else if (k === "ol") ex("insertOrderedList");
  else if (k === "h4") ex("formatBlock", "h4");
  else if (k === "p" || k === "subh") {
    ex("formatBlock", "p");
    const b = seBlock(ed);
    if (b && b.tagName === "P") {
      b.className = k === "subh" ? "subh" : "";
      if (!b.className) b.removeAttribute("class");
    }
  } else if (k === "dose") {
    const sel = getSelection();
    if (!sel.rangeCount || sel.isCollapsed) return seSay("Select the dose first, then tap Dose.");
    const r = sel.getRangeAt(0),
      inDose = (r.startContainer.parentElement || {}).closest && r.startContainer.parentElement.closest(".dose");
    if (inDose) {
      inDose.replaceWith(...inDose.childNodes);
      return;
    }
    const sp = document.createElement("span");
    sp.className = "dose";
    sp.appendChild(r.extractContents());
    r.insertNode(sp);
    sel.removeAllRanges();
  } else if (k === "link") {
    const sel = getSelection();
    if (!sel.rangeCount || sel.isCollapsed) return seSay("Select the words to link first, then tap Link.");
    const r = sel.getRangeAt(0).cloneRange(),
      url = prompt("Link address (starting https://)", "https://");
    if (!url || !/^https?:\/\/\S+$/.test(url)) return url && seSay("That doesn't look like a web address.");
    sel.removeAllRanges();
    sel.addRange(r);
    ex("createLink", url);
  }
}

// Quiz questions: a stop's own quiz (its quiz.json or stage file) or a shared SBA bank question (it has an id)
const seQ = q => ({q: q.q, o: [...q.o], a: q.a, why: q.why || ""});
function seQuizRef(q) {
  if (q.id) return {kind: "sba", ref: q.id, card: "sba:" + q.id, tab: "SBA " + q.id};
  const st = L.st,
    qs = (st && st.q) || [],
    i = qs.findIndex(x => x === q || (x.q === q.q && x.a === q.a && JSON.stringify(x.o) === JSON.stringify(q.o)));
  if (i < 0) return null;
  return {kind: "quiz", ref: st.id, card: "quiz:" + i, tab: "Quiz question " + (i + 1)};
}
function seQuizBar(cur, page, q) {
  const r = seQuizRef(q);
  const own = L.st && Array.isArray(L.st.q) && L.st.q.length && !L.tq && !(L.sub && L.sub.opt);
  if (!r && !own) return;
  const bar = document.createElement("div");
  bar.className = "sebar";
  const pend = r && sePending(cur.key + "|" + r.card);
  bar.innerHTML = `${SE.fromList && seSection() ? `<button class="selink" type="button" data-se-list>← Review list</button>` : ""}<div class="sebtns">${r ? `<button class="sebtn" type="button" data-se-q="edit">✏️ ${pend ? "Edit my suggestion" : "Edit this question"}</button><button class="sebtn" type="button" data-se-q="flag">⚑ Flag a problem</button>` : ""}${own ? `<button class="sebtn" type="button" data-se-q="new">+ Suggest a new question</button>` : ""}</div>${r && r.kind === "sba" ? `<small>This is a ${q.id[0] === "P" ? "Primary" : "Final"} SBA bank question, so it may also appear on other stops: a change here changes it everywhere.</small>` : ""}`;
  page.prepend(bar);
  const li = bar.querySelector("[data-se-list]");
  if (li) li.onclick = seOpenList;
  bar.querySelectorAll("[data-se-q]").forEach(b => (b.onclick = () => seQuizOpen(b.dataset.seQ, cur, q, r)));
}
function seQuizOpen(mode, cur, q, r) {
  const st = L.st,
    isNew = mode === "new",
    ref = isNew ? {kind: "quiz", ref: st.id, card: "quiz-new:" + Date.now(), tab: "New quiz question"} : r,
    skey = cur.key + "|" + ref.card + (mode === "flag" ? "#flag" : ""),
    it = SE.items[skey],
    orig = isNew ? null : seQ(q),
    start =
      it && it.status === "pending" && it.afterQ ? it.afterQ : orig || {q: "", o: ["", "", "", "", ""], a: -1, why: ""};
  SE.editing = {
    key: cur.key,
    kind: ref.kind,
    ref: ref.ref,
    title: cur.title,
    card: ref.card,
    tab: ref.tab,
    skey,
    mode,
    beforeQ: orig,
    prevQ: isNew && st.q.length ? seQ(st.q[st.q.length - 1]) : null
  };
  const strip = sheet.querySelector(".tstrip");
  if (strip) strip.remove();
  sheet.querySelector(".sh-head").innerHTML =
    `<button class="close" type="button" id="seCancelTop" aria-label="Stop editing">← Cancel</button><div class="sh-title">${mode === "flag" ? "Flag a problem" : "Suggesting edits"} · ${escapeHTML(cur.title)}</div>`;
  const shared =
    ref.kind === "sba"
      ? `<p class="sehelp"><b>This SBA bank question may also appear on other stops</b>, so a change here changes it everywhere.</p>`
      : "";
  const form =
    mode === "flag"
      ? `<div class="seqview"><p><b>${escapeHTML(q.q)}</b></p><ol type="A">${q.o.map((o, i) => `<li${i === q.a ? ' class="seright"' : ""}>${escapeHTML(o)}${i === q.a ? " ✓" : ""}</li>`).join("")}</ol></div>
<label class="selab" for="seNote">What's the problem? <small>(and your source, if you have one)</small></label>`
      : `<label class="selab" for="seQq">Question</label><textarea id="seQq" class="senote" rows="4">${escapeHTML(start.q)}</textarea>
<fieldset class="seopts"><legend class="selab">Answers <small>(tick the correct one; leave a box empty to remove that answer)</small></legend>${[
          0, 1, 2, 3, 4, 5
        ]
          .slice(0, Math.max(5, start.o.length))
          .map(
            i =>
              `<div class="seopt"><input type="radio" name="seQa" id="seQa${i}" value="${i}"${i === start.a ? " checked" : ""} aria-label="Answer ${String.fromCharCode(65 + i)} is correct"><label for="seQa${i}">${String.fromCharCode(65 + i)}</label><input type="text" class="senote" id="seQo${i}" value="${escapeHTML(start.o[i] || "")}" aria-label="Answer ${String.fromCharCode(65 + i)}"></div>`
          )
          .join("")}</fieldset>
<label class="selab" for="seQwhy">Explanation <small>(shown after answering)</small></label><textarea id="seQwhy" class="senote" rows="4">${escapeHTML(start.why)}</textarea>
<label class="selab" for="seNote">Anything David should know? <small>(optional: why, or your source)</small></label>`;
  sheet.querySelector(".sh-body").innerHTML =
    `<div class="page sepage"><div class="kind">${escapeHTML(cur.title)}</div><h3>${mode === "flag" ? "Flag a problem with this question" : isNew ? "Suggest a new question" : "Edit this question"}</h3>
<p class="sehelp">${mode === "flag" ? "Not sure of the fix? Say what's wrong and David will look at it." : "Your version goes to David to approve; nothing changes for anyone else until he does."}</p>${shared}
${form}<textarea id="seNote" class="senote" rows="3">${escapeHTML((it && it.status === "pending" && it.note) || "")}</textarea>
<p class="sestat" id="seStat" role="status"></p></div>`;
  sheet.querySelector(".sh-foot").innerHTML =
    `<button class="cta2" type="button" id="seCancel">Cancel</button>${it && it.status === "pending" ? `<button class="cta2" type="button" id="seWithdraw">Withdraw</button>` : ""}<button class="cta" type="button" id="seSend">${mode === "flag" ? "Send to David" : "Send suggestion"}</button>`;
  const leave = () => seDone();
  sheet.querySelector("#seCancel").onclick = leave;
  sheet.querySelector("#seCancelTop").onclick = leave;
  sheet.querySelector("#seSend").onclick = () => seQuizSend();
  const wd = sheet.querySelector("#seWithdraw");
  if (wd) wd.onclick = () => seWithdraw();
}
function seQuizRead() {
  const v = id => (sheet.querySelector("#" + id) ? sheet.querySelector("#" + id).value.trim() : "");
  const picked = sheet.querySelector('input[name="seQa"]:checked'),
    raw = [...sheet.querySelectorAll('.seopt input[type="text"]')].map(x => x.value.trim()),
    keep = raw.map((o, i) => (o ? i : -1)).filter(i => i >= 0),
    a = picked ? keep.indexOf(+picked.value) : -1;
  return {q: v("seQq"), o: keep.map(i => raw[i]), a, why: v("seQwhy")};
}
async function seQuizSend() {
  if (SE.busy) return;
  const E = SE.editing,
    note = sheet.querySelector("#seNote").value.trim();
  let afterQ = null;
  if (E.mode === "flag") {
    if (!note) return seSay("Say what the problem is, then send.");
  } else {
    afterQ = seQuizRead();
    if (!afterQ.q) return seSay("Add the question.");
    if (afterQ.o.length < 2) return seSay("Add at least two answers.");
    if (afterQ.a < 0) return seSay("Tick the correct answer (it can't be an empty box).");
    if (!afterQ.why) return seSay("Add an explanation: it's shown after someone answers.");
    if (E.beforeQ && JSON.stringify(afterQ) === JSON.stringify(E.beforeQ) && !note)
      return seSay("Nothing has changed yet. Edit the question, or add a note for David.");
  }
  SE.busy = true;
  seSay("Sending…");
  const item = {
    kind: E.kind,
    ref: E.ref,
    title: E.title,
    card: E.card,
    tab: E.tab,
    mode: E.mode,
    beforeQ: E.beforeQ,
    afterQ,
    prevQ: E.prevQ,
    note,
    at: new Date().toISOString(),
    status: "pending"
  };
  const checked = {...SE.checked};
  delete checked[E.key];
  const ok = await seSave({items: {...SE.items, [E.skey]: item}, checked});
  SE.busy = false;
  if (!ok) return;
  seDone();
  seToast(E.mode === "flag" ? "Sent to David. Thank you!" : "Suggestion sent to David. Thank you!");
}

// Turn the edited text back into the house layout: one block per line, only the app's own tags and classes
const seParse = html => {
  const d = document.createElement("div");
  d.innerHTML = html;
  return d;
};
function seCleanNode(root) {
  const rename = (el, tag) => {
    const n = document.createElement(tag);
    for (const a of el.attributes) n.setAttribute(a.name, a.value);
    n.append(...el.childNodes);
    el.replaceWith(n);
    return n;
  };
  root.querySelectorAll("[style]").forEach(e => e.removeAttribute("style"));
  root.querySelectorAll("strong").forEach(e => rename(e, "b"));
  root.querySelectorAll("em").forEach(e => rename(e, "i"));
  root.querySelectorAll("font, span:not([class])").forEach(e => {
    if (!e.attributes.length) e.replaceWith(...e.childNodes);
  });
  // the browser adds <tbody> to tables; the files don't use it
  root.querySelectorAll("table > tbody").forEach(e => e.replaceWith(...e.childNodes));
  root.querySelectorAll("[class='']").forEach(e => e.removeAttribute("class"));
  root.querySelectorAll("a").forEach(a => {
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener");
  });
  // Enter inside a contenteditable may make <div>s: they are paragraphs
  [...root.children].forEach(e => {
    if (e.tagName === "DIV" && !e.attributes.length) rename(e, "p");
  });
  // loose text at the top level becomes a paragraph
  [...root.childNodes].forEach(n => {
    if (n.nodeType === 3 && n.textContent.trim()) {
      const p = document.createElement("p");
      n.replaceWith(p);
      p.append(n);
    } else if (n.nodeType === 3) n.remove();
    else if (n.tagName === "BR") n.remove();
  });
  // no empty blocks, no line breaks left dangling at the end of a block
  root.querySelectorAll("p, h4, li, b, i").forEach(e => {
    while (e.lastChild && e.lastChild.nodeName === "BR") e.lastChild.remove();
  });
  root.querySelectorAll("p, h4, li").forEach(e => {
    if (!e.textContent.trim() && !e.querySelector("img, input")) e.remove();
  });
  root.querySelectorAll("ul, ol").forEach(e => {
    if (!e.querySelector("li")) e.remove();
  });
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let t; (t = walk.nextNode());) t.textContent = t.textContent.replace(/ /g, " ");
  return root;
}
// lines: one top-level block per line, list items on their own lines (as in the cards/*.html files)
function seLines(root) {
  const out = [];
  for (const e of root.childNodes) {
    if (e.nodeType === 8)
      out.push(`<!--${e.data}-->`); // markers such as <!--rfmt2--> are kept
    else if (e.nodeType !== 1) continue;
    else if (/^(UL|OL)$/.test(e.tagName)) {
      const open = e.outerHTML.slice(0, e.outerHTML.indexOf(">") + 1);
      out.push(open);
      for (const li of e.children) out.push(li.outerHTML);
      out.push(`</${e.tagName.toLowerCase()}>`);
    } else out.push(e.outerHTML);
  }
  // the files write a bare & (as in U&E); keep it that way unless it would read as an entity
  return out.map(l => l.replace(/&amp;(?![a-z][a-z0-9]*;|#\d+;|#x[0-9a-f]+;)/gi, "&"));
}
const seCleanHTML = el => seLines(seCleanNode(seParse(el.innerHTML))).join("");

// Save this reviewer's whole document (one write at a time)
async function seSave(change) {
  if (!SE.db || !SE.me) {
    seSay(
      "This only saves in the live app while you're signed in to Claude. Open the link David sent you and try again."
    );
    seToast("Open the link David sent you to save this.");
    return false;
  }
  if (!SE.name) {
    const n = prompt("Your name, so David can credit you", "");
    if (!n || !n.trim()) {
      seSay("Add your name to send this.");
      return false;
    }
    SE.name = n.trim().slice(0, 80);
  }
  const next = {items: SE.items, checked: SE.checked, ...change};
  try {
    await SE.db.doc("suggestions/" + SE.me).set({name: SE.name, section: SE.section || "", ...next});
    SE.items = next.items;
    SE.checked = next.checked;
    seBadge();
    return true;
  } catch (e) {
    seSay("Couldn't save just now. Check you're online and signed in, then try again. Your changes are still here.");
    seToast("Couldn't save just now. Try again in a moment.");
    return false;
  }
}

async function seSend(ed) {
  if (SE.busy) return;
  const E = SE.editing,
    lines = seLines(seCleanNode(seParse(ed.innerHTML))),
    after = lines.join(""),
    note = sheet.querySelector("#seNote").value.trim();
  if (after === seLines(seCleanNode(seParse(E.before))).join("") && !note)
    return seSay("Nothing has changed yet. Edit the text, or add a note for David.");
  SE.busy = true;
  seSay("Sending…");
  const item = {
    kind: E.kind,
    ref: E.ref,
    title: E.title,
    card: E.card,
    tab: E.tab,
    before: E.before,
    beforeLines: seLines(seCleanNode(seParse(E.before))),
    after,
    lines,
    note,
    at: new Date().toISOString(),
    status: "pending"
  };
  const checked = {...SE.checked};
  delete checked[E.key];
  const ok = await seSave({items: {...SE.items, [E.skey]: item}, checked});
  SE.busy = false;
  if (!ok) return;
  seDone();
  seToast("Suggestion sent to David. Thank you!");
}
async function seWithdraw() {
  if (SE.busy) return;
  const items = {...SE.items};
  delete items[SE.editing.skey];
  SE.busy = true;
  const ok = await seSave({items});
  SE.busy = false;
  if (!ok) return;
  seDone();
  seToast("Suggestion withdrawn.");
}
async function seToggleOK(key) {
  if (SE.busy) return;
  const checked = {...SE.checked};
  if (checked[key]) delete checked[key];
  else checked[key] = new Date().toISOString();
  SE.busy = true;
  const ok = await seSave({checked});
  SE.busy = false;
  if (!ok) return;
  draw();
  if (checked[key]) seToast("Marked as looks good. Thank you!");
}
function seToast(t) {
  const d = document.createElement("div");
  d.className = "setoast";
  d.setAttribute("role", "status");
  d.textContent = t;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 3500);
}

// "Your review list": the section's items, grouped, each with its status
function seOpenList() {
  const sec = seSection();
  if (!sec) return seOpenProgress();
  L = null;
  SE.fromList = true;
  sheet.className = "sheet";
  sheet.style.cssText = col("c2");
  showPage();
  const items = sec.list(),
    groups = {};
  items.forEach(x => (groups[x.group || "Stops"] = groups[x.group || "Stops"] || []).push(x));
  const done = items.filter(x => seStatus(x.key).c !== "todo").length,
    asked = items.filter(x => SE.asks[x.key]);
  const row = x => {
    const s = seStatus(x.key);
    return `<button class="serow" type="button" data-se-item="${escapeHTML(x.key)}"><span>${escapeHTML(x.title)}${SE.asks[x.key] ? `<small>David asks: ${escapeHTML(SE.asks[x.key])}</small>` : ""}</span><em class="sestate s-${s.c}">${s.t}</em></button>`;
  };
  sheet.innerHTML = `<div class="sh-head"><button class="close" type="button" aria-label="Back to path">← Path</button><div class="sh-title">Your review list</div></div><div class="sh-body"><div class="page selist"><div class="kind">Review</div><h3>${escapeHTML(sec.name)}</h3>
<p>Thank you for reviewing${SE.name ? ", " + escapeHTML(SE.name.split(" ")[0]) : ""}. Open each one and read it as a trainee at your stage would. Change anything that's wrong, unclear or out of date with <b>✏️ Suggest edits</b>, or tap <b>✓ Looks good, no changes</b>. David approves every change before it goes into the app.</p>
<div class="seprog"><b>${done} of ${items.length} done</b><i style="width:${items.length ? Math.round((done / items.length) * 100) : 0}%"></i></div>
${SE.db ? "" : `<p class="sehelp">Open the link David sent you, signed in to Claude, to save your work.</p>`}
${asked.length ? `<h4>David has asked about</h4><div class="serows">${asked.map(row).join("")}</div>` : ""}
${Object.entries(groups)
  .map(([g, xs]) => `<h4>${escapeHTML(g)}</h4><div class="serows">${xs.map(row).join("")}</div>`)
  .join("")}
${SE.owner ? `<p><button class="selink" type="button" data-se-progress>See everyone's progress →</button></p>` : ""}</div></div>`;
  sheet.querySelector(".close").onclick = () => {
    SE.fromList = false;
    close();
    render();
  };
  sheet.querySelectorAll("[data-se-item]").forEach(b => (b.onclick = () => seGo(b.dataset.seItem)));
  const pg = sheet.querySelector("[data-se-progress]");
  if (pg) pg.onclick = seOpenProgress;
  sheet.querySelector(".sh-body").scrollTop = 0;
}
function seGo(key) {
  const i = key.indexOf(":"),
    kind = key.slice(0, i),
    ref = key.slice(i + 1);
  sheet.hidden = true;
  if (kind === "stop") {
    const st = ALL.find(s => s.id === ref);
    if (st) openSub(st.id, subsOf(st)[0].id);
  } else if (kind === "note") {
    const n = findNote(ref);
    if (n) openNote(n);
  } else if (kind === "topic") goTopic(ref);
}

// David only: everyone's progress, by section and reviewer
async function seOpenProgress() {
  L = null;
  sheet.className = "sheet";
  sheet.style.cssText = col("c2");
  showPage();
  sheet.innerHTML = `<div class="sh-head"><button class="close" type="button" aria-label="Back to path">← Path</button><div class="sh-title">Review progress</div></div><div class="sh-body"><div class="page selist" id="seProg"><div class="kind">Review</div><h3>Review progress</h3><p>Loading…</p></div></div>`;
  sheet.querySelector(".close").onclick = () => {
    close();
    render();
  };
  const el = sheet.querySelector("#seProg");
  if (!SE.owner || !SE.db) {
    el.innerHTML = `<div class="kind">Review</div><h3>Review progress</h3><p>Only David can see everyone's progress, in the live app.</p>`;
    return;
  }
  let docs = [];
  try {
    const snap = await SE.db.collection("suggestions").get();
    docs = snap.docs.map(d => ({id: d.id, ...(d.data() || {})}));
  } catch (e) {
    el.innerHTML += `<p>Couldn't load progress just now.</p>`;
    return;
  }
  const pend = docs.reduce((n, d) => n + Object.values(d.items || {}).filter(x => x.status === "pending").length, 0);
  el.innerHTML = `<div class="kind">Review</div><h3>Review progress</h3><p>${pend ? `<b>${pend} suggestion${pend === 1 ? "" : "s"} waiting.</b> Ask Claude to “bring in the suggestions” to turn them into a pull request.` : "No suggestions waiting."}</p>
${SE_SECTIONS.map(sec => {
  const keys = new Set(sec.list().map(x => x.key)),
    total = keys.size,
    touched = new Set(),
    who = [];
  docs.forEach(d => {
    const sent = Object.keys(d.items || {})
        .map(k => k.split("|")[0])
        .filter(k => keys.has(k)),
      ok = Object.keys(d.checked || {}).filter(k => keys.has(k));
    sent.concat(ok).forEach(k => touched.add(k));
    if (sent.length || ok.length || d.section === sec.id)
      who.push(`${escapeHTML(d.name || "Unnamed")}: ${new Set(sent).size} with changes, ${ok.length} looks good`);
  });
  return `<h4>${escapeHTML(sec.name)}</h4><div class="seprog"><b>${touched.size} of ${total} reviewed</b><i style="width:${total ? Math.round((touched.size / total) * 100) : 0}%"></i></div><p class="sehelp">${who.length ? who.join(" · ") : "No reviewer yet"} · link: <code>#review=${sec.id}</code></p>`;
}).join("")}`;
}

// The banner on the path that opens the review list
function seBadge() {
  if (!SE.on) return;
  let b = document.getElementById("seBar");
  if (!b) {
    b = document.createElement("button");
    b.id = "seBar";
    b.type = "button";
    b.className = "newsbar sebanner";
    const after = document.getElementById("newsBtn");
    if (after) after.after(b);
    else document.body.prepend(b);
    b.onclick = () => (seSection() ? seOpenList() : seOpenProgress());
  }
  const sec = seSection();
  if (sec) {
    const items = sec.list(),
      done = items.filter(x => seStatus(x.key).c !== "todo").length;
    b.innerHTML = `<span class="newstag">Review</span><span class="newst">Your review list · ${done} of ${items.length} done</span><span aria-hidden="true">→</span>`;
    b.hidden = false;
  } else if (SE.owner) {
    b.innerHTML = `<span class="newstag">Review</span><span class="newst">Review progress</span><span aria-hidden="true">→</span>`;
    b.hidden = false;
  } else b.hidden = true;
}

// Load this reviewer's own suggestions and David's asks (live app only, review mode only)
(async () => {
  if (!SE.on) return;
  seBadge();
  if (!(window.claude && window.claude.use)) return;
  try {
    const [db, user] = await Promise.all([window.claude.use("db"), window.claude.use("user")]);
    if (!db || !user) return;
    const me = await user.id();
    if (!me) return;
    Object.assign(SE, {db, me});
    try {
      SE.owner = !!(await user.isOwner());
    } catch (e) {}
    try {
      const ps = await user.profiles([me]);
      SE.name = (ps && ps[me] && ps[me].name) || "";
    } catch (e) {}
    const data = async p => {
      try {
        const s = await db.doc(p).get();
        return (s && typeof s.data === "function" ? s.data() : s) || null;
      } catch (e) {
        return null;
      }
    };
    const [d, a] = await Promise.all([data("suggestions/" + me), data("review/asks")]);
    if (d) {
      if (d.items && typeof d.items === "object") SE.items = d.items;
      if (d.checked && typeof d.checked === "object") SE.checked = d.checked;
      if (d.name && !SE.name) SE.name = d.name;
    }
    if (a && a.items && typeof a.items === "object") SE.asks = a.items;
    SE.ready = true;
    seBadge();
    if (L && !SE.editing && !sheet.hidden) draw();
  } catch (e) {}
})();
