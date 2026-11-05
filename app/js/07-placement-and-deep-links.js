// ---- placement quiz: one question at a time; decides where a new user starts on the path ----
const PQ = {
  role: {
    q: "What best describes you?",
    o: [
      "Medical student",
      "Foundation doctor (FY1 or FY2)",
      "Anaesthetist in training or clinical fellow",
      "Consultant or SAS anaesthetist"
    ]
  },
  exam: {
    q: "Where are you with the Primary FRCA?",
    o: ["No FRCA exams yet", "Primary FRCA written (MCQ) passed", "Primary FRCA complete"]
  },
  st4: {q: "Have you got an ST4 post?", o: ["Yes", "Not yet"]},
  final: {q: "Have you completed the Final FRCA?", o: ["Yes", "Not yet"]},
  st2done: {q: "Have you completed Stage 2 (ST4 and ST5)?", o: ["Yes", "Not yet"]},
  cons: {q: "Have you got a consultant job?", o: ["Yes", "Not yet"]}
};
const PQ_ORDER = ["role", "exam", "st4", "final", "st2done", "cons"];
const PQ_SUM = {
  st4: ["Got an ST4 post", "No ST4 post yet"],
  final: ["Final FRCA complete", "Final FRCA to go"],
  st2done: ["Stage 2 completed", "In Stage 2"],
  cons: ["Consultant job secured", "No consultant job yet"]
};
const NHS_RE = /^[^\s@]+@([a-z0-9-]+\.)*(nhs\.net|nhs\.uk|nhs\.scot|hscni\.net)$/i;
const UNI_RE = /^[^\s@]+@([a-z0-9-]+\.)*ac\.uk$/i;
const firstOf = id => ALL.findIndex(s => s.stage.id === id);
const stopByTitle = (stage, t) => ALL.find(s => s.stage.id === stage && s.title === t);
// which question comes next, given the answers so far (null = finished)
function nextQ(a) {
  if (!a.role) return "role";
  if (a.role !== PQ.role.o[2]) return null;
  if (!a.exam) return "exam";
  if (a.exam !== PQ.exam.o[2]) return null;
  for (const k of ["st4", "final", "st2done", "cons"]) {
    if (!a[k]) return k;
    if (a[k] !== "Yes") return null;
  }
  return null;
}
function placement(a) {
  const r = PQ.role.o.indexOf(a.role),
    e = PQ.exam.o.indexOf(a.exam),
    Y = k => a[k] === "Yes";
  let startStop = ALL[0];
  const extra = [];
  if (r === 3) startStop = ALL[firstOf("cons")];
  else if (r === 2) {
    startStop = ALL[firstOf("core")];
    if (e >= 1) extra.push(stopByTitle("core", "Primary FRCA: written"));
    if (e >= 2) {
      extra.push(stopByTitle("core", "Primary FRCA: OSCE & SOE"));
      if (!Y("st4")) startStop = stopByTitle("core", "ST4 interview");
      else {
        startStop = ALL[firstOf("st2")];
        if (Y("final")) {
          extra.push(stopByTitle("st2", "Final FRCA: written"), stopByTitle("st2", "Final FRCA: SOE"));
          if (Y("st2done")) startStop = Y("cons") ? ALL[firstOf("cons")] : ALL[firstOf("st3")];
        }
      }
    }
  }
  const done = new Set(ALL.slice(0, ALL.indexOf(startStop)).map(s => s.id));
  extra.filter(Boolean).forEach(s => done.add(s.id));
  return {stage: startStop.stage.id, start: startStop, done: [...done]};
}
let PA = null,
  PSTEP = "email";
function openPlacement(retake) {
  const prev = store.get("pathway-profile", null);
  PA = {email: (prev && prev.email) || ""};
  PSTEP = "email";
  L = null;
  sheet.style.cssText = col("c1");
  sheet.className = "sheet onb";
  showPage();
  drawPlacement(retake);
}
function drawPlacement(retake) {
  const hist = ["email"];
  {
    const t = {email: PA.email};
    let k;
    while ((k = nextQ(t))) {
      hist.push(k);
      if (!PA[k]) break;
      t[k] = PA[k];
    }
  }
  let body, foot;
  if (PSTEP === "email") {
    body = `<h3>Welcome to Anaesthetic Ally</h3><p class="lead">A few quick questions so Anaesthetic Ally starts you in the right place. You can retake this any time from the menu.</p>
    <p class="q"><label for="pq-email">Your NHS email address</label></p>
    <input type="email" id="pq-email" autocomplete="email" inputmode="email" placeholder="name@nhs.net" value="${(PA.email || "").replace(/"/g, "&quot;")}">
    <p class="fine">Medical students can use a university (.ac.uk) address. Used only to confirm you work or study in the NHS.</p><p class="err" id="pq-err" role="alert"></p>`;
    foot = `<button class="cta" id="pq-next">Continue</button>`;
  } else if (PSTEP === "result") {
    const r = placement(PA);
    const ans = PQ_ORDER.filter(k => PA[k]).map(k => (PQ_SUM[k] ? PQ_SUM[k][PA[k] === "Yes" ? 0 : 1] : PA[k]));
    body = `<h3>Your starting point</h3><div class="result"><span>${r.start.stage.name}</span><b>${r.start.title}</b></div>
    <p>Based on: ${ans.join(" · ")}.</p><ul class="ticks">${r.done.length ? `<li>${r.done.length} earlier stops marked as done, so they stay open to revisit</li>` : ""}<li>Every stop stays readable; nothing is hidden from you</li></ul>`;
    foot = `<div class="confirm" style="max-width:680px;margin:0 auto 10px"><button id="pq-back">Back</button></div><button class="cta" id="pq-go">Start here</button>`;
  } else {
    const Q = PQ[PSTEP];
    body = `<p class="qcount">Question ${hist.indexOf(PSTEP)} </p><h3>${Q.q}</h3><div class="ochips col" role="group">${Q.o.map(o => `<button class="ochip" data-v="${o}" aria-pressed="${PA[PSTEP] === o}">${o}</button>`).join("")}</div>`;
    foot = `<div class="confirm" style="max-width:680px;margin:0 auto"><button id="pq-back">Back</button></div>`;
  }
  sheet.innerHTML = `<div class="sh-head">${retake ? `<button class="close" aria-label="Back to path">← Path</button>` : `<span></span>`}<div class="sh-title">${retake ? "Retake placement" : "Getting started"}</div></div>
   <div class="sh-body"><div class="page">${body}</div></div><div class="sh-foot">${foot}</div>`;
  const cl = sheet.querySelector(".close");
  if (cl) cl.onclick = close;
  const go2 = k => {
    PSTEP = k;
    drawPlacement(retake);
    const sb = sheet.querySelector(".sh-body");
    if (sb) sb.scrollTop = 0;
  };
  const advance = () => go2(nextQ(PA) || "result");
  sheet.querySelectorAll(".ochip").forEach(
    b =>
      (b.onclick = () => {
        const k = PSTEP,
          v = b.dataset.v;
        if (PA[k] !== v) {
          PA[k] = v;
          PQ_ORDER.slice(PQ_ORDER.indexOf(k) + 1).forEach(x => delete PA[x]);
        }
        advance();
      })
  );
  const em = sheet.querySelector("#pq-email");
  const nx = sheet.querySelector("#pq-next");
  if (nx) {
    const sub = () => {
      const err = sheet.querySelector("#pq-err");
      PA.email = (em.value || "").trim();
      if (!NHS_RE.test(PA.email) && !UNI_RE.test(PA.email)) {
        err.textContent =
          "Enter an NHS email address (for example name@nhs.net), or a university .ac.uk address if you are a medical student.";
        em.focus();
        return;
      }
      advance();
    };
    nx.onclick = sub;
    em.onkeydown = e => {
      if (e.key === "Enter") sub();
    };
  }
  const bk = sheet.querySelector("#pq-back");
  if (bk)
    bk.onclick = () => {
      const order = [...hist, "result"];
      const i = order.indexOf(PSTEP);
      go2(PSTEP === "result" ? hist[hist.length - 1] : order[Math.max(0, i - 1)]);
    };
  const go = sheet.querySelector("#pq-go");
  if (go)
    go.onclick = () => {
      if (PA.role === PQ.role.o[0] && !UNI_RE.test(PA.email) && !NHS_RE.test(PA.email)) return;
      const r = placement(PA);
      const subs = {};
      r.done.forEach(id => (subs[id] = subsOf(ALL.find(s => s.id === id)).map(x => x.id)));
      if (retake) {
        // undo what the previous placement ticked off, keep stops the person completed themselves, then apply the new placement
        const prevPlaced = new Set(state.placed || state.done);
        const own = state.done.filter(id => !prevPlaced.has(id));
        prevPlaced.forEach(id => {
          if (!own.includes(id)) delete state.subs[id];
        });
        state.done = [...new Set([...r.done, ...own])];
        Object.assign(state.subs, subs);
        state.placed = r.done;
      } else state = {done: r.done, subs, xp: 0, streak: 0, placed: r.done};
      save();
      const prof = {
        email: PA.email,
        role: PA.role,
        exam: PA.exam || "",
        st4: PA.st4 || "",
        final: PA.final || "",
        st2done: PA.st2done || "",
        cons: PA.cons || "",
        stage: r.stage,
        start: r.start.title,
        at: new Date().toISOString()
      };
      store.set("pathway-profile", prof);
      saveSignup(prof);
      close();
      render();
      setTimeout(() => scrollToCurrent(true), 60);
    };
}
async function saveSignup(prof) {
  try {
    if (!(window.claude && window.claude.use)) return;
    const [db, user] = await Promise.all([window.claude.use("db"), window.claude.use("user")]);
    if (!db || !user) return;
    const id = await user.id();
    if (!id) return;
    await db.doc("signups/" + id).set({
      email: prof.email,
      role: prof.role,
      exam: prof.exam,
      st4: prof.st4,
      final: prof.final,
      st2done: prof.st2done,
      cons: prof.cons,
      start: prof.start,
      at: prof.at
    });
  } catch (e) {}
}
// Deep links, e.g. #stop=st2-12&tab=Anaesthetic%20recipe, #note=Tamponade&tab=Management, #topic=pha32
// (tab may be a tab's name or its number from 0). Used by the pull request review summaries.
function openFromHash() {
  let h;
  try {
    h = new URLSearchParams(decodeURIComponent(location.hash.slice(1)).replace(/\+/g, "%2B"));
  } catch (e) {
    return false;
  }
  const tab = h.get("tab");
  if (h.get("stop")) {
    const st = ALL.find(s => s.id === h.get("stop")) || ALL.find(s => s.title === h.get("stop"));
    if (!st) return false;
    const subs = subsOf(st),
      sub =
        (tab != null &&
          (subs.find(x => x.name === tab || x.id === tab) ||
            subs.find(x => x.c && x.c.h === tab) ||
            (/^\d+$/.test(tab) && subs[+tab]))) ||
        subs[0];
    openSub(st.id, sub.id);
    return true;
  }
  if (h.get("note")) {
    const n = NOTES.find(x => x.title === h.get("note") || x.id === h.get("note"));
    if (!n) return false;
    openNote(n);
    if (tab) {
      const t = [...sheet.querySelectorAll(".nh")].find(e => e.textContent === tab);
      if (t) setTimeout(() => t.scrollIntoView({block: "start"}), 50);
    }
    return true;
  }
  if (h.get("topic") && PRIMARY.topics[h.get("topic")]) {
    goTopic(h.get("topic"));
    return true;
  }
  return false;
}
const deepLinked = location.hash.length > 1 && openFromHash();
addEventListener("hashchange", () => {
  if (location.hash.length > 1) openFromHash();
});
if (!deepLinked && !store.get("pathway-profile", null)) setTimeout(() => openPlacement(false), 50);
