// ---- forum: one db doc per person (forum/<their id>) holding their posts; everyone reads, each writes their own ----
const FCATS = ["General", "Operations", "Finances", "Interviews", "MSRA", "Exams", "Wellbeing"];
const F = {
  state: "loading",
  posts: [],
  raw: {},
  me: null,
  owner: false,
  user: null,
  db: null,
  names: {},
  v: 0,
  cat: "All",
  open: {},
  busy: false,
  err: ""
};
function fCatFor(stop) {
  const st = ALL.find(x => x.title === stop);
  if (!stop || !st) return "General";
  if (/MSRA/i.test(st.title)) return "MSRA";
  if (st.t === "money") return "Finances";
  if (st.t === "interview") return "Interviews";
  if (st.t === "exam") return "Exams";
  if (st.op || st.t === "recipe") return "Operations";
  return "General";
}
function fWhen(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const m = (Date.now() - d) / 60000;
  if (m < 1) return "just now";
  if (m < 60) return Math.floor(m) + " min ago";
  if (m < 1440) return Math.floor(m / 60) + " h ago";
  if (m < 10080) return Math.floor(m / 1440) + " d ago";
  return d.toLocaleDateString("en-GB", {day: "numeric", month: "short", year: "numeric"});
}
let fHandle = "";
try {
  fHandle = localStorage.getItem("pathway-forum-handle") || "";
} catch (e) {}
async function fNames() {
  if (!F.user) return;
  const ids = [...new Set(F.posts.map(p => p.author))];
  if (!ids.length) return;
  try {
    const ps = await F.user.profiles(ids);
    let ch = false;
    ids.forEach(i => {
      const n = (ps[i] && ps[i].name) || "";
      if (F.names[i] !== n) {
        F.names[i] = n;
        ch = true;
      }
    });
    if (ch) {
      F.v++;
      fillForum();
    }
  } catch (e) {}
}
function fWho(p) {
  return p.handle || F.names[p.author] || "Anaesthetist";
}
async function fWrite(uid, mutate) {
  if (F.busy) return false;
  F.busy = true;
  F.err = "";
  try {
    const ref = F.db.doc("forum/" + uid),
      snap = await ref.get(),
      cur = snap.exists ? (snap.data().posts || []).map(p => ({...p})) : [];
    await ref.set({posts: mutate(cur)});
    return true;
  } catch (e) {
    F.err =
      e && e.code === "invalid_argument"
        ? "You can read the forum but don't have permission to post. Ask the app's owner to share it with you as a Contributor."
        : e && e.code === "quota_exceeded"
          ? "The forum is full. Tell the app's owner."
          : "Couldn't save. Check your connection and try again.";
    return false;
  } finally {
    F.busy = false;
    F.v++;
    fillForum();
  }
}
function fPostHTML(p, replies, showStop) {
  const mine = p.author === F.me,
    can = mine || F.owner;
  return `<article class="fpost"><div class="fmeta"><b>${escapeHTML(fWho(p))}</b><span>${escapeHTML(fWhen(p.at))}</span><em class="fcat">${escapeHTML(p.cat || "General")}</em>${showStop && p.stop ? `<button class="fstop" data-fstop="${escapeHTML(p.stop)}">${escapeHTML(p.stop)}</button>` : ""}</div>
  <div class="ftext">${escapeHTML(p.text)}</div>
  <div class="fact">${F.me ? `<button class="flink" data-freply="${escapeHTML(p.key)}">Reply${replies.length ? ` (${replies.length})` : ""}</button>` : replies.length ? `<span class="fcount">${replies.length} ${replies.length === 1 ? "reply" : "replies"}</span>` : ""}${can ? `<button class="flink fdel" data-fdel="${escapeHTML(p.key)}">Delete</button>` : ""}</div>
  ${replies.length ? `<div class="freplies">${replies.map(r => `<div class="freply"><div class="fmeta"><b>${escapeHTML(fWho(r))}</b><span>${escapeHTML(fWhen(r.at))}</span></div><div class="ftext">${escapeHTML(r.text)}</div>${r.author === F.me || F.owner ? `<div class="fact"><button class="flink fdel" data-fdel="${escapeHTML(r.key)}">Delete</button></div>` : ""}</div>`).join("")}</div>` : ""}
  ${F.open[p.key] ? `<div class="fcompose fsmall"><textarea maxlength="2000" rows="2" placeholder="Write a reply" data-freplytext="${escapeHTML(p.key)}"></textarea><button class="fbtn" data-freplysend="${escapeHTML(p.key)}">Reply</button></div>` : ""}
  </article>`;
}
function renderForum(el) {
  el.dataset.v = F.v;
  const stop = el.dataset.stop || "",
    global = el.hasAttribute("data-global");
  if (F.state === "loading") {
    el.innerHTML = '<p class="muted">Loading the discussion…</p>';
    return;
  }
  if (F.state !== "ok") {
    el.innerHTML =
      '<p class="muted">The forum isn’t available in this view. Open Anaesthetic Ally on claude.ai, signed in, to read and post.</p>';
    return;
  }
  const keep =
    document.activeElement && el.contains(document.activeElement) && document.activeElement.tagName === "TEXTAREA"
      ? {k: document.activeElement.dataset.freplytext || "main", v: document.activeElement.value}
      : null;
  const drafts = {};
  el.querySelectorAll("textarea").forEach(t => (drafts[t.dataset.freplytext || "main"] = t.value));
  let top = F.posts.filter(p => !p.parent && (global || p.stop === stop));
  if (global && F.cat !== "All") top = top.filter(p => (p.cat || "General") === F.cat);
  top.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const rep = k => F.posts.filter(p => p.parent === k).sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const defCat = global ? (F.cat !== "All" ? F.cat : "General") : fCatFor(stop);
  let h = "";
  if (global)
    h += `<div class="fcats">${["All", ...FCATS].map(c => `<button class="fchip ${F.cat === c ? "on" : ""}" data-fcat="${c}">${c}</button>`).join("")}</div>`;
  h += F.me
    ? `<div class="fcompose"><textarea maxlength="2000" rows="3" placeholder="${global ? "Start a discussion" : "Share a tip or ask a question about this stop"}" data-fmain="1"></textarea>
    <div class="frow"><select data-fcatsel="1" aria-label="Category">${FCATS.map(c => `<option ${c === defCat ? "selected" : ""}>${c}</option>`).join("")}</select><input data-fhandle="1" maxlength="40" placeholder="Your name or grade (optional)" value="${escapeHTML(fHandle)}" aria-label="Name shown with your post"><button class="fbtn" data-fpost="1" ${F.busy ? "disabled" : ""}>Post</button></div>
    <p class="fnote">No patient-identifiable information. Posts are visible to everyone who can open Anaesthetic Ally.</p>${F.err ? `<p class="ferr">${escapeHTML(F.err)}</p>` : ""}</div>`
    : `<p class="muted">Sign in on claude.ai to join the discussion.</p>`;
  h += top.length
    ? top.map(p => fPostHTML(p, rep(p.key), global)).join("")
    : `<p class="muted fempty">${global ? "No posts yet. Start the first discussion." : "No posts on this stop yet. Be the first."}</p>`;
  el.innerHTML = h;
  el.querySelectorAll("textarea").forEach(t => {
    const k = t.dataset.freplytext || "main";
    if (drafts[k]) t.value = drafts[k];
  });
  if (keep) {
    const t =
      keep.k === "main"
        ? el.querySelector("textarea[data-fmain]")
        : el.querySelector(`textarea[data-freplytext="${CSS.escape(keep.k)}"]`);
    if (t) {
      t.value = keep.v;
      t.focus();
    }
  }
  el.querySelectorAll("[data-fcat]").forEach(
    b =>
      (b.onclick = () => {
        F.cat = b.dataset.fcat;
        F.v++;
        fillForum();
      })
  );
  el.querySelectorAll("[data-fstop]").forEach(
    b =>
      (b.onclick = () => {
        const st = ALL.find(x => x.title === b.dataset.fstop);
        if (!st) return;
        goStop(st.id);
        L.forum = true;
        draw();
      })
  );
  el.querySelectorAll("[data-freply]").forEach(
    b =>
      (b.onclick = () => {
        F.open[b.dataset.freply] = !F.open[b.dataset.freply];
        F.v++;
        fillForum();
        const t = el.querySelector(`textarea[data-freplytext="${CSS.escape(b.dataset.freply)}"]`);
        if (t) t.focus();
      })
  );
  const hi = el.querySelector("[data-fhandle]");
  if (hi)
    hi.oninput = () => {
      fHandle = hi.value.trim();
      try {
        localStorage.setItem("pathway-forum-handle", fHandle);
      } catch (e) {}
    };
  const pb = el.querySelector("[data-fpost]");
  if (pb)
    pb.onclick = async () => {
      const ta = el.querySelector("textarea[data-fmain]"),
        text = (ta.value || "").trim();
      if (!text) return ta.focus();
      const post = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        stop: global ? "" : stop,
        cat: el.querySelector("[data-fcatsel]").value,
        text: text.slice(0, 2000),
        at: new Date().toISOString()
      };
      if (fHandle) post.handle = fHandle.slice(0, 40);
      ta.value = "";
      if (!(await fWrite(F.me, a => [...a, post]))) ta.value = text;
    };
  el.querySelectorAll("[data-freplysend]").forEach(
    b =>
      (b.onclick = async () => {
        const k = b.dataset.freplysend,
          ta = el.querySelector(`textarea[data-freplytext="${CSS.escape(k)}"]`),
          text = (ta.value || "").trim();
        if (!text) return ta.focus();
        const par = F.posts.find(p => p.key === k);
        const post = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          stop: par ? par.stop : "",
          cat: par ? par.cat : "General",
          parent: k,
          text: text.slice(0, 2000),
          at: new Date().toISOString()
        };
        if (fHandle) post.handle = fHandle.slice(0, 40);
        ta.value = "";
        if (await fWrite(F.me, a => [...a, post])) F.open[k] = false;
        else ta.value = text;
      })
  );
  el.querySelectorAll("[data-fdel]").forEach(
    b =>
      (b.onclick = async () => {
        const k = b.dataset.fdel,
          p = F.posts.find(x => x.key === k);
        if (!p) return;
        if (b.dataset.sure !== "1") {
          b.dataset.sure = "1";
          b.textContent = "Tap again to delete";
          return;
        }
        const gone = new Set([p.id]);
        await fWrite(p.author, a => a.filter(x => !gone.has(x.id)));
      })
  );
}
function fillForum() {
  document.querySelectorAll(".forumbox").forEach(renderForum);
}
new MutationObserver(() => {
  document.querySelectorAll(".forumbox").forEach(el => {
    if (el.dataset.v != String(F.v)) renderForum(el);
  });
}).observe(document.body, {childList: true, subtree: true});
function openForum() {
  L = null;
  sheet.className = "sheet";
  sheet.style.cssText = col("c2");
  showPage();
  sheet.innerHTML = `<div class="sh-head"><button class="close" aria-label="Back to path">← Path</button><div class="sh-title">Forum</div></div><div class="sh-body"><div class="page"><h3>Forum</h3><p class="tl-intro">Trade thoughts with other anaesthetists on operations, finances, interviews, the MSRA and exams. Each stop also has its own Discussion tab; those posts show here too, with a link back to the stop.</p><div class="forumbox" data-global></div></div></div>`;
  sheet.querySelector(".close").onclick = close;
  fillForum();
}
