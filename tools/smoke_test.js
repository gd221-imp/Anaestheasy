#!/usr/bin/env node
/* Smoke test: opens dist/index.html in headless Chrome and visits every stop, tab,
   note, Primary topic and top-bar page, failing on any error or broken text.
   No npm packages: it drives Chrome through its DevTools protocol using Node's
   built-in fetch and WebSocket (Node 22 or later).
   Usage: python3 tools/build.py && node tools/smoke_test.js
   Set CHROME_PATH if Chrome is not found automatically. */
'use strict';
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist', 'index.html');
const GH = !!process.env.GITHUB_ACTIONS;
const TIMEOUT_MS = 120000;

function fail(msg) { console.log(GH ? `::error::smoke test: ${msg}` : `ERROR   ${msg}`); }

function findChrome() {
  const names = [process.env.CHROME_PATH, 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
  for (const n of names) {
    if (n.includes('/')) { if (fs.existsSync(n)) return n; continue; }
    try { return execFileSync('which', [n], { encoding: 'utf8' }).trim(); } catch (e) { /* try next */ }
  }
  return null;
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
  if (!fs.existsSync(DIST)) { fail('dist/index.html is missing: run python3 tools/build.py first'); process.exit(1); }
  if (typeof WebSocket === 'undefined') { fail(`needs Node 22 or later (this is ${process.version})`); process.exit(1); }
  const chrome = findChrome();
  if (!chrome) { fail('Chrome not found: install Google Chrome or set CHROME_PATH'); process.exit(1); }

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ally-smoke-'));
  const proc = spawn(chrome, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run',
    '--no-default-browser-check', '--disable-extensions', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--window-size=390,844', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const cleanup = () => { try { proc.kill('SIGKILL'); } catch (e) { } try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { } };
  const timer = setTimeout(() => { fail(`timed out after ${TIMEOUT_MS / 1000}s`); cleanup(); process.exit(1); }, TIMEOUT_MS);

  const port = await new Promise((resolve, reject) => {
    let buf = '';
    proc.stderr.on('data', d => { buf += d; const m = buf.match(/DevTools listening on ws:\/\/[^:]+:(\d+)\//); if (m) resolve(m[1]); });
    proc.on('exit', c => reject(new Error(`Chrome exited (${c}): ${buf.slice(-400)}`)));
  });
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });

  let id = 0; const pending = new Map(); const runtimeErrors = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      runtimeErrors.push(`uncaught ${(d.exception && d.exception.description || d.text).split('\n')[0]} (line ${d.lineNumber + 1})`);
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      runtimeErrors.push('console error: ' + m.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 200));
    }
  };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: pathToFileURL(DIST).href });
  for (let i = 0; i < 100; i++) {
    const r = await send('Runtime.evaluate', { expression: `document.readyState==='complete' && typeof ALL!=='undefined'`, returnByValue: true });
    if (r.result && r.result.result && r.result.result.value) break;
    await new Promise(r => setTimeout(r, 100));
  }
  await new Promise(r => setTimeout(r, 300));

  const t0 = Date.now();
  const r = await send('Runtime.evaluate', { expression: `(${traverse.toString()})()`, awaitPromise: true, returnByValue: true });
  const ms = Date.now() - t0;
  ws.close(); clearTimeout(timer); cleanup();

  if (r.result.exceptionDetails) {
    fail('the app could not be traversed: ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text).split('\n')[0]);
    process.exit(1);
  }
  const { counts, problems } = r.result.result.value;
  const all = [...runtimeErrors, ...problems];
  for (const p of all.slice(0, 50)) fail(p);
  if (all.length > 50) fail(`…and ${all.length - 50} more`);
  console.log(`\nSmoke test: ${counts.stops} stops (${counts.tabs} tabs), ${counts.notes} notes, ${counts.topics} Primary topics, ${counts.pages} pages in ${(ms / 1000).toFixed(1)}s — ${all.length} problem(s)`);
  process.exit(all.length ? 1 : 0);
}

main().catch(e => { fail(e.stack || String(e)); process.exit(1); });
