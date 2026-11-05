#!/usr/bin/env node
/* Smoke test: opens dist/index.html in headless Chrome and visits every stop, tab,
   note, Primary topic and top-bar page, failing on any error or broken text.
   No npm packages: Chrome is driven by tools/lib/chrome.js (Node 22 or later).
   Usage: python3 tools/build.py && node tools/smoke_test.js
   Set CHROME_PATH if Chrome is not found automatically. */
'use strict';
const {openApp} = require('./lib/chrome');

const GH = !!process.env.GITHUB_ACTIONS;
const TIMEOUT_MS = 120000;

function fail(msg) {
  console.log(GH ? `::error::smoke test: ${msg}` : `ERROR   ${msg}`);
}

/* Runs inside the app. Returns { counts, problems }. */
async function traverse() {
  const problems = [], counts = { stops: 0, tabs: 0, notes: 0, topics: 0, pages: 0 };
  const BAD = /Topic not found|Note not found|\bundefined\b|\bNaN\b|\[object Object\]|[{}]/;
  const sheet = document.getElementById('sheet');
  const look = (where) => {
    const t = sheet.innerText || '';
    const m = t.match(BAD);
    if (m) {
      const i = t.indexOf(m[0]);
      problems.push(`${where}: shows "${m[0]}" near "…${t.slice(Math.max(0, i - 40), i + 20).replace(/\s+/g, ' ')}…"`);
    }
  };
  const tryDo = (where, fn) => { try { fn(); look(where); } catch (e) { problems.push(`${where}: ${e && e.message || e}`); } };
  const reset = () => { sheet.hidden = true; L = null; };

  for (const name of ['STAGES', 'ALL', 'NOTES', 'PRIMARY', 'SBA_BANK', 'PSBA_BANK', 'DRUGS']) {
    try { if (eval(`typeof ${name}`) === 'undefined') problems.push(`global ${name} is missing`); }
    catch (e) { problems.push(`global ${name}: ${e.message}`); }
  }
  if (problems.length) return { counts, problems };
  if (!document.querySelector('#map').children.length) problems.push('the path (main map) is empty');
  if (typeof STOP_ID_MISSING !== 'undefined')
    for (const t of STOP_ID_MISSING) problems.push(`stop "${t}" has no id (add "id" to its stop.json or stage file)`);
  const seen = {};
  for (const st of ALL) { if (seen[st.id]) problems.push(`stops "${seen[st.id]}" and "${st.title}" share the id ${st.id}`); seen[st.id] = st.title; }

  for (const st of ALL) {
    const where = `stop "${st.title}"`;
    let subs;
    try { subs = subsOf(st); } catch (e) { problems.push(`${where}: ${e.message}`); continue; }
    if (!subs.length) { problems.push(`${where}: has no tabs`); continue; }
    tryDo(`${where} › ${subs[0].name}`, () => openSub(st.id, subs[0].id));
    for (let i = 1; i < subs.length; i++) tryDo(`${where} › ${subs[i].name}`, () => { goSub(i); draw(); });
    counts.stops++; counts.tabs += subs.length;
    reset();
  }
  for (const n of NOTES) { tryDo(`note "${n.title}"`, () => openNote(n)); counts.notes++; reset(); }
  for (const k of Object.keys(PRIMARY.topics)) {
    tryDo(`Primary topic "${PRIMARY.topics[k].n}"`, () => goTopic(k)); counts.topics++; reset();
  }
  const pages = { Contents: 'openContents', Curriculum: 'openCurriculum', ARCP: 'openARCP', Drugs: 'openDrugs',
    'Paeds drugs': 'openPaedDrugs', Events: 'openEvents', Forum: 'openForum', 'Follow-ups': 'openFollowups' };
  for (const [label, fn] of Object.entries(pages)) {
    if (typeof window[fn] !== 'function' && typeof eval(`typeof ${fn}==='function'?${fn}:null`) !== 'function') continue;
    const before = problems.length;
    tryDo(`${label} page`, () => eval(fn)());
    await new Promise(r => setTimeout(r, 30));
    if (problems.length === before) look(`${label} page (after loading)`);
    counts.pages++; reset();
  }
  tryDo('placement quiz', () => openPlacement(true)); counts.pages++; reset();
  return { counts, problems };
}

async function main() {
  const timer = setTimeout(() => {
    fail(`timed out after ${TIMEOUT_MS / 1000}s`);
    process.exit(1);
  }, TIMEOUT_MS);
  const app = await openApp();
  const t0 = Date.now();
  let result;
  try {
    result = await app.evaluate(traverse);
  } catch (e) {
    fail('the app could not be traversed: ' + e.message);
    app.close();
    process.exit(1);
  }
  const ms = Date.now() - t0;
  app.close();
  clearTimeout(timer);
  const {counts, problems} = result;
  const all = [...app.errors, ...problems];
  for (const p of all.slice(0, 50)) fail(p);
  if (all.length > 50) fail(`…and ${all.length - 50} more`);
  console.log(
    `\nSmoke test: ${counts.stops} stops (${counts.tabs} tabs), ${counts.notes} notes, ${counts.topics} Primary topics, ${counts.pages} pages in ${(ms / 1000).toFixed(1)}s — ${all.length} problem(s)`
  );
  process.exit(all.length ? 1 : 0);
}

main().catch(e => { fail(e.stack || String(e)); process.exit(1); });
