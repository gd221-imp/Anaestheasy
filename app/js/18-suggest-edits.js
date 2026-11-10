// Suggest edits: a reviewer opens a stop, taps "Suggest edits" on a tab and changes its text on screen.
// Suggestions are saved in the live app's database (suggestions/<user id>), one per tab, and David turns
// them into pull requests with tools/suggestions.py. Nothing goes into the app until he approves it.
// Turn it on by opening the app with #review in the address (#review=off turns it off again).
var SE = {on: false, db: null, me: null, name: "", items: {}, ready: false, editing: null, busy: false};
// Shared cards appear on several stops (kept once in content/data), so they are changed by hand, not from one stop
function seShared(c) {
  if (c.shared || /class="expmount"/.test(c.b)) return true;
  return ["NG45_CARD", "COMP_CARD", "LOCUM_CARD", "TAX_CARD", "FELLOW_CARD", "JOBS_CARD"].some(n => {
    try {
      return eval(`typeof ${n} !== "undefined" && ${n}`) === c;
    } catch (e) {
      return false;
    }
  });
}
(() => {
  const h = location.hash;
  if (/(^#|&)review=off(&|$)/.test(h)) store.set("aa-review", false);
  else if (/(^#|&)review(=1|=on)?(&|$)/.test(h)) store.set("aa-review", true);
  SE.on = store.get("aa-review", false) === true;
})();

function seKey(st, sub) {
  return st.id + "|" + sub.id;
}
// A tab can be edited when its text is the stop's own (not a linked note or topic, a shared card or a sample WPBA)
function seEditable() {
  if (!SE.on || !L || L.win || L.forum || L.topic || L.standalone || (L.notes && L.notes.length)) return false;
  const s = L.steps && L.steps[L.step];
  if (!s || s.type !== "card" || L.sub.type !== "card") return false;
  const c = s.c;
  if (!c || typeof c.b !== "string" || !c.b.trim() || c.primaryRef || c.noteRef || c.wpba) return false;
  if (!L.st.id || L.st.id.startsWith("tmp-") || seShared(c)) return false;
  return true;
}

// Called at the end of draw(): adds the "Suggest edits" bar to a tab that can be edited
function seDecorate() {
  if (typeof SE === "undefined" || !SE || !seEditable()) return;
  const page = sheet.querySelector(".sh-body .page");
  if (!page) return;
  const it = SE.items[seKey(L.st, L.sub)];
  const status = it
    ? it.status === "pr"
      ? `Your suggestion is with David for review${it.pr ? ` (pull request #${it.pr})` : ""}.`
      : it.status === "done"
        ? "Your last suggestion for this tab has been dealt with."
        : "You've suggested changes to this tab. Tap to change them."
    : "Spotted something to change? Edit this tab as it appears in the app.";
  const bar = document.createElement("div");
  bar.className = "sebar";
  bar.innerHTML = `<button class="sebtn" type="button" id="seEdit">✏️ ${it && it.status === "pending" ? "Edit my suggestion" : "Suggest edits"}</button><span>${status}</span>`;
  page.prepend(bar);
  bar.querySelector("#seEdit").onclick = seOpen;
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

function seOpen() {
  const {st, sub} = L,
    c = L.steps[L.step].c,
    key = seKey(st, sub),
    it = SE.items[key];
  SE.editing = {key, st, sub, c, before: c.b};
  const start = it && it.status === "pending" && it.before === c.b ? it.after : c.b;
  sheet.querySelector(".tstrip") && sheet.querySelector(".tstrip").remove();
  const head = sheet.querySelector(".sh-head");
  head.innerHTML = `<button class="close" type="button" id="seCancelTop" aria-label="Stop editing">← Cancel</button><div class="sh-title">Suggesting edits · ${escapeHTML(st.title)}</div>`;
  sheet.querySelector(".sh-body").innerHTML =
    `<div class="page sepage"><div class="kind">${escapeHTML(st.title)}</div><h3>${escapeHTML(sub.name)}</h3>
<p class="sehelp">Change the text below as you'd like it to read in the app. Your version goes to David to approve; nothing changes for anyone else until he does.</p>
<div class="setools" role="toolbar" aria-label="Formatting">${SE_TOOLS.map(([k, l, t]) => `<button type="button" data-se="${k}" title="${t}" aria-label="${t}">${l}</button>`).join("")}</div>
<div class="seed" id="seEd" contenteditable="true" spellcheck="true" lang="en-GB" aria-label="Tab text">${start}</div>
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
    SE.editing = null;
    draw();
  };
  sheet.querySelector("#seCancel").onclick = cancel;
  sheet.querySelector("#seCancelTop").onclick = cancel;
  sheet.querySelector("#seSend").onclick = () => seSend(ed);
  const wd = sheet.querySelector("#seWithdraw");
  if (wd) wd.onclick = () => seWithdraw();
  ed.focus();
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

async function seSend(ed) {
  if (SE.busy) return;
  const E = SE.editing,
    lines = seLines(seCleanNode(seParse(ed.innerHTML))),
    after = lines.join(""),
    note = sheet.querySelector("#seNote").value.trim();
  if (after === seLines(seCleanNode(seParse(E.before))).join("") && !note)
    return seSay("Nothing has changed yet. Edit the text, or add a note for David.");
  if (!SE.db || !SE.me)
    return seSay(
      "Suggestions can only be sent from the live app while you're signed in to Claude. Open the link David sent you and try again."
    );
  if (!SE.name) {
    const n = prompt("Your name, so David can credit you", "");
    if (!n || !n.trim()) return seSay("Add your name to send the suggestion.");
    SE.name = n.trim().slice(0, 80);
  }
  SE.busy = true;
  seSay("Sending…");
  const items = {
    ...SE.items,
    [E.key]: {
      stop: E.st.id,
      stopTitle: E.st.title,
      card: E.sub.id,
      tab: E.sub.name,
      before: E.before,
      beforeLines: seLines(seCleanNode(seParse(E.before))),
      after,
      lines,
      note,
      at: new Date().toISOString(),
      status: "pending"
    }
  };
  try {
    await SE.db.doc("suggestions/" + SE.me).set({name: SE.name, items});
    SE.items = items;
    SE.editing = null;
    SE.busy = false;
    draw();
    seToast("Suggestion sent to David. Thank you!");
  } catch (e) {
    SE.busy = false;
    seSay("Couldn't send just now. Check you're online and signed in, then try again. Your changes are still here.");
  }
}
async function seWithdraw() {
  if (SE.busy || !SE.db || !SE.me) return;
  const items = {...SE.items};
  delete items[SE.editing.key];
  SE.busy = true;
  try {
    await SE.db.doc("suggestions/" + SE.me).set({name: SE.name, items});
    SE.items = items;
    SE.editing = null;
    draw();
    seToast("Suggestion withdrawn.");
  } catch (e) {
    seSay("Couldn't withdraw just now. Try again in a moment.");
  }
  SE.busy = false;
}
function seToast(t) {
  const d = document.createElement("div");
  d.className = "setoast";
  d.setAttribute("role", "status");
  d.textContent = t;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 3500);
}

// Load the reviewer's own suggestions from the live app's database (only in the live app, only in review mode)
(async () => {
  if (!SE.on || !(window.claude && window.claude.use)) return;
  try {
    const [db, user] = await Promise.all([window.claude.use("db"), window.claude.use("user")]);
    if (!db || !user) return;
    const me = await user.id();
    if (!me) return;
    Object.assign(SE, {db, me});
    try {
      const ps = await user.profiles([me]);
      SE.name = (ps && ps[me] && ps[me].name) || "";
    } catch (e) {}
    const snap = await db.doc("suggestions/" + me).get();
    const d = snap && typeof snap.data === "function" ? snap.data() : snap;
    if (d && d.items && typeof d.items === "object") SE.items = d.items;
    if (d && d.name && !SE.name) SE.name = d.name;
    SE.ready = true;
    if (L && !SE.editing && !sheet.hidden) draw();
  } catch (e) {}
})();
