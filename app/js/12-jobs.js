// ---- live jobs feeds (db docs jobs/latest = consultant, jobs/fellows = clinical fellow; written by a daily scheduled task) ----
const FEEDS = {
  latest: {data: null, state: "loading", region: "All", what: "adverts"},
  fellows: {data: null, state: "loading", region: "All", what: "fellow posts"}
};
let JOBS_V = 0;
function renderJobs(el) {
  const key = el.dataset.feed === "fellows" ? "fellows" : "latest",
    F = FEEDS[key];
  el.dataset.v = JOBS_V;
  if (F.state === "loading") {
    el.innerHTML = `<p class="muted">Loading the latest ${F.what}…</p>`;
    return;
  }
  if (F.state !== "ok") {
    el.innerHTML =
      key === "fellows"
        ? '<p class="muted">The live list isn’t available yet. Use the links above to see current fellow posts.</p>'
        : '<p class="muted">The live list isn’t available in this view. Open Health Jobs UK above to see current adverts.</p>';
    return;
  }
  const all = Array.isArray(F.data.jobs) ? F.data.jobs : [];
  const counts = {};
  all.forEach(j => {
    const r = j.region || "Other";
    counts[r] = (counts[r] || 0) + 1;
  });
  const regions = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
  if (F.region !== "All" && !counts[F.region]) F.region = "All";
  const shown = all.filter(j => F.region === "All" || (j.region || "Other") === F.region);
  const d = F.data.updated ? new Date(F.data.updated) : null;
  const when =
    d && !isNaN(d) ? d.toLocaleDateString("en-GB", {day: "numeric", month: "short", year: "numeric"}) : "unknown";
  const max = Math.max(1, ...Object.values(counts));
  let h = `<p class="jobmeta">${all.length} ${F.what} · updated ${escapeHTML(when)}</p>`;
  if (!all.length) {
    el.innerHTML = h + '<p class="muted">None found on the last check. Try the links above.</p>';
    return;
  }
  h += `<div class="jobbars"><button class="jobchip${F.region === "All" ? " on" : ""}" data-r="All">All regions <b>${all.length}</b></button>`;
  regions.forEach(r => {
    h += `<button class="jobchip${F.region === r ? " on" : ""}" data-r="${escapeHTML(r)}"><span class="jobbar" style="width:${Math.round((100 * counts[r]) / max)}%"></span><span class="jobl">${escapeHTML(r)}</span><b>${counts[r]}</b></button>`;
  });
  h += '</div><ul class="joblist">';
  shown.forEach(j => {
    const u = /^https:\/\/(www\.healthjobsuk\.com\/|www\.bmj\.com\/careers\/)/.test(j.url || "") ? j.url : "#";
    const tag = j.locum
      ? ' <em class="joblocum">Locum</em>'
      : j.grade
        ? ` <em class="joblocum">${escapeHTML(j.grade)}</em>`
        : "";
    h += `<li><a href="${escapeHTML(u)}" target="_blank" rel="noopener"><span class="jobt">${escapeHTML(j.title)}${tag}</span><span class="jobe">${escapeHTML(j.employer)} · ${escapeHTML(j.town)}${j.closes ? " · closes " + escapeHTML(j.closes) : ""}${j.source ? " · via " + escapeHTML(j.source) : ""}</span></a></li>`;
  });
  h += "</ul>";
  el.innerHTML = h;
  el.querySelectorAll(".jobchip").forEach(
    b =>
      (b.onclick = () => {
        F.region = b.dataset.r;
        JOBS_V++;
        fillJobs();
      })
  );
}
function fillJobs() {
  document.querySelectorAll(".jobsfeed").forEach(renderJobs);
}
new MutationObserver(() => {
  document.querySelectorAll(".jobsfeed").forEach(el => {
    if (el.dataset.v != String(JOBS_V)) renderJobs(el);
  });
}).observe(document.body, {childList: true, subtree: true});
(async () => {
  const fail = k => {
    FEEDS[k].state = "none";
    JOBS_V++;
    fillJobs();
  };
  try {
    const db = window.claude && window.claude.use ? await window.claude.use("db") : null;
    if (!db) {
      fail("latest");
      fail("fellows");
      return;
    }
    ["latest", "fellows"].forEach(k =>
      db.doc("jobs/" + k).onSnapshot(
        snap => {
          const F = FEEDS[k];
          F.data = snap.exists ? snap.data() : null;
          F.state = F.data ? "ok" : "none";
          JOBS_V++;
          fillJobs();
        },
        () => fail(k)
      )
    );
  } catch (e) {
    fail("latest");
    fail("fellows");
  }
})();
