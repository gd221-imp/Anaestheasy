/* Open dist/index.html in headless Chrome and run code inside it, with no npm packages.
   Drives Chrome through its DevTools protocol using Node's built-in fetch and WebSocket (Node 22 or later).
   Used by tools/smoke_test.js and tests/*.test.js. Set CHROME_PATH if Chrome is not found automatically. */
'use strict';
const {spawn, execFileSync} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {pathToFileURL} = require('node:url');

const ROOT = path.resolve(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist', 'index.html');

function findChrome() {
  const names = [
    process.env.CHROME_PATH,
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ].filter(Boolean);
  for (const name of names) {
    if (name.includes('/')) {
      if (fs.existsSync(name)) return name;
      continue;
    }
    try {
      return execFileSync('which', [name], {encoding: 'utf8'}).trim();
    } catch (e) {
      /* try the next name */
    }
  }
  return null;
}

/* Opens the built app and resolves to {evaluate, send, errors, close}.
   evaluate(fn, ...args) runs fn(...args) inside the page (fn may be async) and returns its JSON-able result.
   errors lists uncaught exceptions and console errors seen so far.
   init (optional) is a script run before the page's own, e.g. to fix the date.
   file (optional) opens another built copy of the app instead of dist/index.html. */
async function openApp({width = 390, height = 844, init = '', file = DIST} = {}) {
  if (!fs.existsSync(file)) throw new Error('dist/index.html is missing: run python3 tools/build.py first');
  if (typeof WebSocket === 'undefined') throw new Error(`needs Node 22 or later (this is ${process.version})`);
  const chrome = findChrome();
  if (!chrome) throw new Error('Chrome not found: install Google Chrome or set CHROME_PATH');

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ally-chrome-'));
  const proc = spawn(
    chrome,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      `--window-size=${width},${height}`,
      'about:blank'
    ],
    {stdio: ['ignore', 'ignore', 'pipe']}
  );
  const close = () => {
    try {
      proc.kill('SIGKILL');
    } catch (e) {}
    try {
      fs.rmSync(profile, {recursive: true, force: true});
    } catch (e) {}
  };
  try {
    const port = await new Promise((resolve, reject) => {
      let buf = '';
      proc.stderr.on('data', d => {
        buf += d;
        const m = buf.match(/DevTools listening on ws:\/\/[^:]+:(\d+)\//);
        if (m) resolve(m[1]);
      });
      proc.on('exit', code => reject(new Error(`Chrome exited (${code}): ${buf.slice(-400)}`)));
    });
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    let nextId = 0;
    const pending = new Map();
    const errors = [];
    ws.onmessage = ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
        return;
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        errors.push(`uncaught ${((d.exception && d.exception.description) || d.text).split('\n')[0]} (line ${d.lineNumber + 1})`);
      }
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        errors.push('console error: ' + msg.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 200));
      }
    };
    const send = (method, params = {}) =>
      new Promise(resolve => {
        const id = ++nextId;
        pending.set(id, resolve);
        ws.send(JSON.stringify({id, method, params}));
      });

    await send('Runtime.enable');
    await send('Page.enable');
    if (init) await send('Page.addScriptToEvaluateOnNewDocument', {source: init});
    await send('Page.navigate', {url: pathToFileURL(file).href});
    for (let i = 0; i < 100; i++) {
      const r = await send('Runtime.evaluate', {
        expression: `document.readyState==='complete' && typeof ALL!=='undefined'`,
        returnByValue: true
      });
      if (r.result && r.result.result && r.result.result.value) break;
      await new Promise(r => setTimeout(r, 100));
    }
    await new Promise(r => setTimeout(r, 300));

    async function evaluate(fn, ...args) {
      const r = await send('Runtime.evaluate', {
        expression: `(${fn.toString()})(...${JSON.stringify(args)})`,
        awaitPromise: true,
        returnByValue: true
      });
      if (r.result.exceptionDetails) {
        const d = r.result.exceptionDetails;
        throw new Error(((d.exception && d.exception.description) || d.text).split('\n')[0]);
      }
      return r.result.result.value;
    }
    return {
      evaluate,
      send,
      errors,
      close: () => {
        ws.close();
        close();
      }
    };
  } catch (e) {
    close();
    throw e;
  }
}

module.exports = {openApp, findChrome, ROOT, DIST};
