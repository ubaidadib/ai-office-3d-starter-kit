// Browser check: builds nothing, changes nothing. It serves dist/ with `vite preview`, opens it in a headless
// Chrome (temporary profile), checks both languages, the tours and a vertical frame, and saves screenshots
// to check-output/. Every PASS / FAIL line is the result of a check that actually ran.
//
//   npm run build && npm run check:browser
//
// Chrome is found automatically on macOS, Windows and Linux; set CHROME=/path/to/chrome to override.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Node 20 needs a flag for the built-in WebSocket client; restart with it if necessary.
if (typeof WebSocket === 'undefined') {
  const p = spawn(process.execPath, ['--experimental-websocket', ...process.argv.slice(1)], { stdio: 'inherit' });
  p.on('exit', (code) => process.exit(code ?? 1));
} else {
  await main();
}

function findChrome() {
  const c = [process.env.CHROME,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  return c.find((p) => p && existsSync(p));
}

async function main() {
  if (!existsSync('dist/index.html')) { console.error('dist/ not found: run `npm run build` first.'); process.exit(1); }
  const chromePath = findChrome();
  if (!chromePath) { console.error('Chrome not found. Install Google Chrome or set CHROME=/path/to/chrome.'); process.exit(1); }
  const out = 'check-output'; mkdirSync(out, { recursive: true });
  const profile = mkdtempSync(join(tmpdir(), 'ai-office-check-'));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], { stdio: 'ignore' });
  const BASE = 'http://127.0.0.1:4173/';
  for (let i = 0; i < 50; i++) { await sleep(200); try { if ((await fetch(BASE)).ok) break; } catch {} }

  const port = 9600 + Math.floor(Math.random() * 300);
  const chrome = spawn(chromePath, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--window-size=1600,900',
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });

  const results = [];
  let section = '';
  const check = (name, ok, detail) => { results.push({ section, name, ok: !!ok }); console.log(`${ok ? 'PASS' : 'FAIL'} [${section}] ${name}${detail !== undefined ? '  ' + JSON.stringify(detail) : ''}`); };

  try {
    let target;
    for (let i = 0; i < 60 && !target; i++) { await sleep(200); try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch {} }
    if (!target) throw new Error('Chrome did not start');
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r));
    let seq = 0; const pending = new Map(); let requests = []; let failures = []; let errors = [];
    ws.addEventListener('message', (m) => {
      const d = JSON.parse(m.data);
      if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
      if (d.method === 'Network.requestWillBeSent') requests.push(d.params.request.url);
      if (d.method === 'Network.responseReceived' && d.params.response.status >= 400) failures.push(`${d.params.response.status} ${d.params.response.url}`);
      if (d.method === 'Network.loadingFailed' && !d.params.canceled) failures.push(`failed ${d.params.errorText}`);
      if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text);
      if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push(d.params.args.map((a) => a.value ?? a.description).join(' '));
    });
    const send = (method, params = {}) => new Promise((r) => { const id = ++seq; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
    const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;
    const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${out}/${name}.png`, Buffer.from(r.result.data, 'base64')); };
    const overlaps = (ls) => { let n = 0; for (let i = 0; i < ls.length; i++) for (let j = i + 1; j < ls.length; j++) { const a = ls[i], b = ls[j]; if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) n++; } return n; };
    const load = async (query) => {
      requests = []; failures = []; errors = [];
      await send('Page.navigate', { url: BASE + query });
      for (let i = 0; i < 200 && !(await ev('!!(window.__m2 && window.__m2.readyAt)')); i++) await sleep(100);
      await sleep(1000);
    };
    const m2 = async () => JSON.parse(await ev('JSON.stringify(window.__m2)'));
    await send('Network.enable'); await send('Runtime.enable'); await send('Page.enable');

    for (const lang of ['en', 'ar']) {
      section = lang;
      await load(`?lang=${lang}`);
      let d = await m2();
      const cfg = d.config;
      check('page loads and becomes ready', !!d.readyAt, { readyMs: Math.round(d.readyAt ?? -1) });
      check(`document language is ${lang} and direction is ${lang === 'ar' ? 'rtl' : 'ltr'}`,
        (await ev('document.documentElement.lang')) === lang && (await ev('document.documentElement.dir')) === (lang === 'ar' ? 'rtl' : 'ltr'));
      check('the disclosure line from the config is on screen', (await ev(`document.querySelector('.p-disclosure')?.textContent`)) === cfg.disclosure[lang]);
      check('the company badge shows the company name', (await ev(`document.querySelector('.p-brand b')?.textContent`)) === cfg.company.name[lang]);
      check('the browser tab title starts with the company name', (await ev('document.title')).startsWith(cfg.company.name[lang]));
      const options = await ev(`[...document.querySelectorAll('.p-dock select option')].slice(1).map((o) => o.textContent)`);
      check('the room menu lists the 13 room names from the config', options.length === 13 && options.every((n) => Object.values(cfg.rooms).some((r) => r[lang] === n)), options.length);
      check('four role figures are present and visible', ['coo', 'marketing', 'admissions', 'bizdev'].every((a) => d.cast?.[a]?.visible));
      await ev('window.__m2.seekShow(1)'); await sleep(700); d = await m2();
      check('room labels do not overlap at the overview', overlaps(d.labels ?? []) === 0, (d.labels ?? []).length);
      check('every file loaded (no 404s or failed requests)', failures.length === 0, failures.slice(0, 5));
      check('nothing is loaded from the internet', requests.every((u) => u.startsWith(BASE) || u.startsWith('data:') || u.startsWith('blob:')), requests.filter((u) => !u.startsWith(BASE)).slice(0, 3));
      check('no errors in the browser console', errors.length === 0, errors.slice(0, 3));
      await shot(`${lang}-01-overview`);

      // Short tour, seeked to fixed moments (repeatable).
      await load(`?lang=${lang}&autoplay=short&clean=1`);
      await ev('window.__m2.seekTour(5.5)'); await sleep(900);
      check('the short tour starts on its own (?autoplay=short)', (await m2()).tour?.id === 'short');
      check('no control dock in a clean recording (?clean=1)', await ev(`!document.querySelector('.p-dock')`));
      const caption = async () => ev(`document.querySelector('.p-caption b')?.textContent ?? ''`);
      check('reception caption uses the config room name', (await caption()) === cfg.rooms.reception[lang], await caption());
      await shot(`${lang}-02-reception`);
      await ev('window.__m2.seekTour(20)'); await sleep(1200); d = await m2();
      check('meeting caption uses the config room name', (await caption()) === cfg.rooms.meeting_room[lang], await caption());
      check('all four figures are seated in the meeting room', ['coo', 'marketing', 'admissions', 'bizdev'].every((a) => String(d.cast[a].seat).startsWith('meet.')),
        ['coo', 'marketing', 'admissions', 'bizdev'].map((a) => d.cast[a].seat));
      await shot(`${lang}-03-meeting`);
      await ev('window.__m2.seekTour(30)'); await sleep(1400);
      check('closing card shows the closing line', await ev(`[...document.querySelectorAll('.p-card-sub')].some((e) => e.textContent === ${JSON.stringify(cfg.closingLine[lang])} && getComputedStyle(e.parentElement).visibility === 'visible')`));
      await shot(`${lang}-04-closing`);
      check('no errors in the browser console during the tour', errors.length === 0, errors.slice(0, 3));
    }

    section = 'vertical';
    await load('?frame=9x16&autoplay=short&clean=1');
    await ev('window.__m2.seekTour(20)'); await sleep(1200);
    const frame = await ev(`(() => { const r = document.querySelector('.app').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; })()`);
    check('9:16 frame for Reels, TikTok and Shorts', Math.abs(frame.w / frame.h - 9 / 16) < 0.01, frame);
    await shot('vertical-meeting');
  } catch (e) {
    check('check run completed', false, String(e));
  } finally {
    chrome.kill(); server.kill();
    await sleep(500);
    rmSync(profile, { recursive: true, force: true });
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed. Screenshots: ${out}/`);
  process.exit(failed ? 1 : 0);
}
