// TT-023 — release build + browser smoke test (PLAN §4 "Browser smoke", §3.8, §8 DoD).
//
//   npm run smoke            build --release, then drive dist/tallyman.html over file:// in the
//                            installed Chrome (playwright-core, real keyboard events)
//   SMOKE_HEADED=1 npm run smoke   watch it
//
// Not part of `npm run check`: it needs Chrome and takes about a minute.
// Every page runs with all network blocked (only file:, data: and blob: may load). Writes
// docs/SMOKE-REPORT.md and docs/screenshots/release-*.png; exits 1 when any check fails.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WALKTHROUGH } from '../tests/walkthrough/script.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(root, 'dist/tallyman.html');
const SHOTS = resolve(root, 'docs/screenshots');
const REPORT = resolve(root, 'docs/SMOKE-REPORT.md');
const CHROME = process.env.CHROME_PATH ?? '/usr/bin/google-chrome';
const MAX_BYTES = 1.5 * 1024 * 1024;
const BASE = pathToFileURL(DIST).href;
const DESKTOP = { width: 1800, height: 1100 };
const PHONE = { width: 390, height: 844 };
const STORAGE_NOTICE_START = "Saving to this browser isn't possible here.";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tmp = mkdtempSync(join(tmpdir(), 'tallyman-smoke-'));

// ------------------------------------------------------------------ results

/** @type {{id:string, name:string, ok:boolean, notes:string[]}[]} */
const checks = [
  ['1', 'file:// load, network blocked; full boot and skipboot'],
  ['2', 'STORY §12.1 walkthrough typed at speed -> victory, score 100'],
  ['3', 'Paging [MORE] and history recall'],
  ['4', 'SAVE 1 -> reload -> LOAD 1 -> identical continuation'],
  ['5', 'localStorage throws: notice once; EXPORT -> reload -> IMPORT -> identical continuation'],
  ['6', 'Restore a pending disambiguation save and an after-ending save'],
  ['7', 'Zero console errors / page errors'],
  ['8', 'Screenshots 1800x1100 and 390x844 (title, room, ending)'],
].map(([id, name]) => ({ id, name, ok: true, ran: false, notes: [] }));
const check = (id) => checks.find((c) => c.id === id);

/** Record one assertion under check `id`; never throws. */
function expect(id, ok, what) {
  const c = check(id);
  c.ran = true;
  if (!ok) c.ok = false;
  c.notes.push(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  console.log(`  [${id}] ${ok ? 'ok  ' : 'FAIL'} ${what}`);
  return ok;
}

const consoleProblems = [];
const blockedRequests = [];
const shots = [];
/** File choosers opened so far (consumed by importFile). */
const choosers = [];

// ------------------------------------------------------------------ build

function buildRelease() {
  console.log('build --release');
  execFileSync(process.execPath, [resolve(root, 'tools/build.js'), '--release'], { stdio: 'inherit' });
  const html = readFileSync(DIST, 'utf8');
  const bytes = Buffer.byteLength(html);
  const build = { bytes, ok: bytes < MAX_BYTES, external: [] };
  for (const [label, re] of [['http', /https?:/gi], ['//cdn', /\/\/cdn/gi], ['<link', /<link\b/gi], ['src=', /\bsrc\s*=/gi]]) {
    const n = (html.match(re) ?? []).length;
    if (n) build.external.push(`${label} x${n}`);
  }
  build.ok = build.ok && build.external.length === 0;
  console.log(`  ${bytes} bytes (< ${MAX_BYTES}), external refs: ${build.external.join(', ') || 'none'}`);
  return build;
}

// ------------------------------------------------------------------ page helpers

/** A new context + page: file:// only, every other request aborted and recorded. */
async function openPage(browser, label, { viewport = DESKTOP, storageThrows = false } = {}) {
  const context = await browser.newContext({ viewport, acceptDownloads: true, deviceScaleFactor: 1 });
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (/^(file|data|blob):/.test(url)) return route.continue();
    blockedRequests.push(`${label}: ${url}`);
    return route.abort();
  });
  if (storageThrows) {
    await context.addInitScript(() => {
      const thrower = {
        configurable: true,
        get() { throw new DOMException('The operation is insecure.', 'SecurityError'); },
      };
      try { Object.defineProperty(window, 'localStorage', thrower); } catch { /* fall through */ }
      try { Object.defineProperty(Window.prototype, 'localStorage', thrower); } catch { /* ignore */ }
    });
  }
  const page = await context.newPage();
  // a listener from the start: Playwright enables file-chooser interception asynchronously
  page.on('filechooser', (fc) => { choosers.push(fc); });
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') consoleProblems.push(`${label} console.${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => consoleProblems.push(`${label} pageerror: ${e.message}`));
  page.on('request', (r) => {
    if (!/^(file|data|blob):/.test(r.url())) blockedRequests.push(`${label}: ${r.url()}`);
  });
  return { context, page };
}

const ui = (page) => page.evaluate(() => {
  const t = window.__tallyman;
  return {
    mode: t.mode, bootPhase: t.bootPhase, ready: t.term.ready, more: t.term.core.more,
    inputEnabled: t.term.core.inputEnabled, input: t.term.core.input.text,
  };
});

async function waitFor(page, fn, arg, timeout = 30000) {
  await page.waitForFunction(fn, arg, { timeout, polling: 20 });
}

const stats = { more: 0 };

/**
 * Let the output finish: page through [MORE] with Space, and fast-forward long typing with
 * Space, until the input line is live or the ending waits for its key. A skip press can
 * race the end of the output and land in the input line as a space: such whitespace-only
 * input is erased before returning.
 */
async function settle(page, { skip = true, timeout = 60000 } = {}) {
  const until = Date.now() + timeout;
  let busySince = null;
  while (Date.now() < until) {
    const s = await ui(page);
    if (s.more) { stats.more++; busySince = null; await page.keyboard.press('Space'); continue; }
    const live = (s.mode === 'play' || s.mode === 'end') && s.ready && s.inputEnabled;
    if ((s.mode === 'endWait' && s.ready) || live) {
      if (live && s.input && !s.input.trim()) {
        for (let i = 0; i < s.input.length; i++) await page.keyboard.press('Backspace');
        continue;
      }
      return s;
    }
    busySince ??= Date.now();
    // only typing that is still going after 150 ms is skipped (typewriter-off output is
    // finished within a frame or two)
    if (skip && s.mode !== 'boot' && !s.ready && Date.now() - busySince > 150) {
      busySince = null;
      await page.keyboard.press('Space');
    } else await sleep(20);
  }
  throw new Error(`settle timed out: ${JSON.stringify(await ui(page))}`);
}

/** Mark the transcript so `newOutput` returns only what follows. */
const markTranscript = (page) => page.evaluate(() => {
  for (const p of document.querySelectorAll('[role=log] p')) p.dataset.seen = '1';
});
const newOutput = (page) => page.evaluate(() => Array.from(document.querySelectorAll('[role=log] p:not([data-seen])'), (p) => p.textContent));
const rowText = (page, y) => page.evaluate((row) => window.__tallyman.rowText(row), y);
const screenText = (page) => page.evaluate(() => window.__tallyman.screenText());

/** Type a command with real key events, press Enter, settle; returns the new transcript lines. */
async function command(page, text) {
  await settle(page);
  await markTranscript(page);
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
  await settle(page);
  return newOutput(page);
}

/** Press a key on the title (honouring its 350 ms debounce) until the game runs. */
async function leaveTitle(page) {
  await waitFor(page, () => window.__tallyman?.bootPhase === 'title');
  for (let i = 0; i < 20; i++) {
    await sleep(400);
    await page.keyboard.press('Space');
    try { await waitFor(page, () => window.__tallyman.mode === 'play', undefined, 600); return; } catch { /* retry */ }
  }
  throw new Error('title never left');
}

/** Open with ?skipboot=1, leave the title, let the intro finish. */
async function startSkipboot(page, seed = 1) {
  await page.goto(`${BASE}?skipboot=1&seed=${seed}`);
  await leaveTitle(page);
  await settle(page);
}

const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

async function shot(page, name) {
  await sleep(250); // a couple of frames, so fx and the blink are drawn
  const path = resolve(SHOTS, `release-${name}.png`);
  await page.screenshot({ path });
  shots.push(`docs/screenshots/release-${name}.png`);
}

/** Status row plus the output of each command in `lines`. */
async function continuation(page, lines) {
  const out = [];
  for (const l of lines) out.push({ cmd: l, text: await command(page, l), status: (await rowText(page, 0)).trimEnd() });
  return out;
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ------------------------------------------------------------------ scenarios

/** A: phone width, full boot (key at PRESS PLAY -> tape -> title -> intro), paging, wrong-man ending. */
async function scenarioFullBoot(browser) {
  console.log('A: full boot at 390x844');
  const { context, page } = await openPage(browser, 'A', { viewport: PHONE });
  await page.goto(`${BASE}?seed=1`);
  await waitFor(page, () => window.__tallyman?.bootPhase === 'play');
  expect('1', (await screenText(page)).includes('PRESS PLAY ON TAPE'), 'full boot waits at PRESS PLAY ON TAPE');
  await page.keyboard.press('Space');
  await waitFor(page, () => window.__tallyman.bootPhase === 'load', undefined, 15000);
  expect('1', true, 'key at PLAY -> searching -> loading');
  await waitFor(page, () => window.__tallyman.bootPhase === 'title', undefined, 15000);
  await sleep(300);
  expect('1', (await screenText(page)).includes('PRESS ANY KEY'), 'tape load reaches the title (PRESS ANY KEY)');
  await shot(page, 'title-390');
  await leaveTitle(page);

  // the intro types itself (typewriter on) and pages at [MORE]
  await waitFor(page, () => window.__tallyman.term.core.more, undefined, 30000);
  const bottom = await rowText(page, 24);
  expect('3', bottom.includes('[MORE]'), `long intro stops at [MORE] (bottom row "${bottom.trim()}")`);
  const before = await screenText(page);
  await page.keyboard.press('Space');
  await sleep(300);
  const after = await ui(page);
  expect('3', !after.more || (await screenText(page)) !== before, 'a key continues past [MORE]');
  await settle(page);
  expect('1', (await ui(page)).mode === 'play', 'boot -> title -> intro -> game input live');
  expect('8', await noHScroll(page), 'no horizontal scroll at 390 px');

  for (const l of ['n', 'n']) await command(page, l);
  await shot(page, 'room-390');
  await command(page, 'w');
  await command(page, 'accuse maggie');
  const yes = await command(page, 'y');
  const s = await settle(page);
  expect('6', s.mode === 'endWait', `wrong-man ending reached (${yes.length} lines)`);
  const endedSave = await page.evaluate(() => JSON.stringify(window.__tallyman.game.save()));
  await page.keyboard.press('Space');
  await waitFor(page, () => window.__tallyman.mode === 'end');
  await settle(page);
  await shot(page, 'ending-390');
  await context.close();
  return endedSave;
}

/** B: desktop, skipboot, the full §12.1 walkthrough by keyboard; history; victory screen. */
async function scenarioWalkthrough(browser) {
  console.log(`B: walkthrough (${WALKTHROUGH.length} commands) at 1800x1100`);
  const { context, page } = await openPage(browser, 'B');
  await page.goto(`${BASE}?skipboot=1&seed=1`);
  await waitFor(page, () => window.__tallyman?.bootPhase === 'title');
  expect('1', (await ui(page)).mode === 'boot', '?skipboot=1 opens on the title');
  await sleep(300);
  await shot(page, 'title-1800');
  await leaveTitle(page);
  await settle(page);
  const tw = await command(page, 'typewriter off');
  expect('2', tw.includes('Typewriter off.'), 'TYPEWRITER OFF acknowledged');

  const morePages = stats.more;
  const t0 = Date.now();
  let last = [];
  for (let i = 0; i < WALKTHROUGH.length; i++) {
    last = await command(page, WALKTHROUGH[i]);
    if (i === 9) {
      // history: Up recalls the last command, Up again the one before, Down walks back
      await page.keyboard.press('ArrowUp');
      const up1 = (await ui(page)).input;
      await page.keyboard.press('ArrowUp');
      const up2 = (await ui(page)).input;
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');
      const down = (await ui(page)).input;
      expect('3', up1 === WALKTHROUGH[9] && up2 === WALKTHROUGH[8] && down === '',
        `history: Up "${up1}", Up "${up2}", Down Down "${down}"`);
      for (let k = 0; k < 40 && (await ui(page)).input; k++) await page.keyboard.press('Backspace');
    }
    if (i === 30) await shot(page, 'room-1800');
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  expect('3', stats.more > morePages, `[MORE] paged ${stats.more - morePages} times during the walkthrough`);
  const s = await ui(page);
  expect('2', s.mode === 'endWait', `all ${WALKTHROUGH.length} commands typed in ${secs}s; ending text shown (last: ${last.length} lines)`);
  await page.keyboard.press('Space');
  await waitFor(page, () => window.__tallyman.mode === 'end');
  await settle(page);
  const scr = await screenText(page);
  expect('2', scr.includes('THE TALLY SETTLED'), 'ending screen shows the victory title THE TALLY SETTLED');
  expect('2', /SCORED 100 OF 100/.test(scr), `ending screen shows score 100 ("${scr.split('\n')[20].trim()}")`);
  await shot(page, 'ending-1800');
  expect('8', await noHScroll(page), 'no horizontal scroll at 1800 px');
  await context.close();
}

/** C: SAVE 1 / reload / LOAD 1, then a pending disambiguation through SAVE 2 / reload / LOAD 2. */
async function scenarioSaveLoad(browser) {
  console.log('C: save / reload / load (localStorage)');
  const { context, page } = await openPage(browser, 'C');
  await startSkipboot(page);
  await command(page, 'typewriter off');
  const N = 20;
  for (const l of WALKTHROUGH.slice(0, N)) await command(page, l);
  const saved = await command(page, 'save 1');
  expect('4', saved.includes('Saved in slot 1.'), `SAVE 1 -> "${saved.at(-1)}"`);
  const next3 = WALKTHROUGH.slice(N, N + 3);
  const ref = await continuation(page, next3);

  await page.reload();
  await leaveTitle(page);
  await settle(page);
  const loaded = await command(page, 'load 1');
  expect('4', loaded.includes('Restored from slot 1.'), `reload, LOAD 1 -> "${loaded.at(-1)}"`);
  const got = await continuation(page, next3);
  expect('4', same(ref, got), `3 more commands (${next3.join(', ')}): output + status line identical ("${got.at(-1).status}")`);
  if (!same(ref, got)) console.log(JSON.stringify({ ref, got }, null, 1));

  // pending disambiguation (STORY: "read page" in the car with both pages carried)
  for (const l of WALKTHROUGH.slice(N + 3, 69)) await command(page, l);
  const ask = await command(page, 'read page');
  const question = ask.find((t) => t.startsWith('Which do you mean')) ?? '';
  expect('6', !!question, `"read page" asks: "${question}"`);
  const saved2 = await command(page, 'save 2');
  expect('6', saved2.includes('Saved in slot 2.'), 'SAVE 2 while the question is pending');
  const refAnswer = await continuation(page, ['notebook']);
  await page.reload();
  await leaveTitle(page);
  await settle(page);
  const loaded2 = await command(page, 'load 2');
  expect('6', loaded2.includes(question) && loaded2.includes('Restored from slot 2.'), 'LOAD 2 asks the same question again');
  const answer = await continuation(page, ['notebook']);
  expect('6', same(refAnswer, answer), 'answering "notebook" after the reload gives identical output and status');
  if (!same(refAnswer, answer)) console.log(JSON.stringify({ refAnswer, answer }, null, 1));
  await context.close();
}

/** D: localStorage getters throw: notice once, EXPORT a download, reload, IMPORT it. */
async function scenarioNoStorage(browser) {
  console.log('D: localStorage throws -> EXPORT / reload / IMPORT');
  const { context, page } = await openPage(browser, 'D', { storageThrows: true });
  await page.goto(`${BASE}?skipboot=1&seed=1`);
  const throws = await page.evaluate(() => { try { void window.localStorage; return false; } catch { return true; } });
  expect('5', throws, 'init script makes window.localStorage throw');
  await leaveTitle(page);
  await settle(page);
  await command(page, 'typewriter off');
  const notices = async () => page.evaluate((s) => Array.from(document.querySelectorAll('[role=log] p'))
    .filter((p) => p.textContent.startsWith(s)).length, STORAGE_NOTICE_START);
  const N = 12;
  for (const l of WALKTHROUGH.slice(0, N)) await command(page, l);
  const save = await command(page, 'save 1');
  expect('5', (await notices()) === 1, 'storage notice shown exactly once (after the intro)');
  expect('5', save.some((t) => t.includes('for this session only')), `SAVE says session-only: "${save.at(-1)}"`);
  const [download] = await Promise.all([page.waitForEvent('download'), command(page, 'export')]);
  const file = join(tmp, 'export.json');
  await download.saveAs(file);
  const exported = JSON.parse(readFileSync(file, 'utf8'));
  expect('5', download.suggestedFilename() === 'tallyman-save.json' && exported && typeof exported === 'object',
    `EXPORT downloads ${download.suggestedFilename()} (${readFileSync(file).length} bytes)`);
  const next3 = WALKTHROUGH.slice(N, N + 3);
  const ref = await continuation(page, next3);

  await page.reload();
  await leaveTitle(page);
  await settle(page);
  expect('5', (await notices()) === 1, 'after reload the notice is again shown once');
  await command(page, 'typewriter off');
  const imported = await importFile(page, file);
  expect('5', imported.includes('Save imported.'), `IMPORT -> "${imported.at(-1)}"`);
  const got = await continuation(page, next3);
  expect('5', same(ref, got), `3 more commands (${next3.join(', ')}): output + status line identical`);
  if (!same(ref, got)) console.log(JSON.stringify({ ref, got }, null, 1));
  await context.close();
}

/** Type IMPORT and answer the file chooser with `file`. */
async function importFile(page, file) {
  await settle(page);
  await markTranscript(page);
  await page.keyboard.type('import');
  choosers.length = 0;
  await page.keyboard.press('Enter');
  await waitFor(page, () => !window.__tallyman.term.core.inputEnabled, undefined, 5000);
  for (let i = 0; i < 250 && !choosers.length; i++) await sleep(20);
  const chooser = choosers.shift();
  if (!chooser) throw new Error('IMPORT opened no file chooser');
  expect('5', !(await ui(page)).inputEnabled, 'input is blocked while the file chooser is open');
  await chooser.setFiles(file);
  await settle(page);
  return newOutput(page);
}

/** E: a save taken after the wrong-man ending, imported into a fresh page. */
async function scenarioEndedSave(browser, endedSave) {
  console.log('E: restore a save made after an ending');
  const { context, page } = await openPage(browser, 'E');
  const file = join(tmp, 'ended.json');
  writeFileSync(file, endedSave);
  await startSkipboot(page, 7);
  await command(page, 'typewriter off');
  const out = await importFile(page, file);
  const s = await ui(page);
  expect('6', s.mode === 'endWait' && out.includes('Save imported.'), 'importing the after-ending save replays the ending text');
  await page.keyboard.press('Space');
  await waitFor(page, () => window.__tallyman.mode === 'end');
  await settle(page);
  expect('6', (await screenText(page)).includes('THE WRONG MAN'), 'ending screen THE WRONG MAN is shown');
  const look = await command(page, 'look');
  expect('6', look.some((t) => t.includes('The game is over')), `LOOK after the ending: "${look.at(-1)}"`);
  const undo = await command(page, 'undo');
  expect('6', undo.some((t) => t.includes("can't undo")), `UNDO: "${undo.at(-1)}"`);
  await command(page, 'restart');
  const after = await ui(page);
  expect('6', after.mode === 'play', 'RESTART leaves the ending screen for a new game');
  await context.close();
}

// ------------------------------------------------------------------ report

function writeReport(build, started, failed) {
  const lines = [
    '# Smoke report — release build',
    '',
    `Generated by \`npm run smoke\` (tools/smoke.js, TT-023) on ${started.toISOString().slice(0, 19).replace('T', ' ')} UTC.`,
    `Chrome: \`${CHROME}\` (${browserVersion}), driven by playwright-core over \`file://\` with every non-file request aborted.`,
    '',
    '## Release build',
    '',
    `- \`dist/tallyman.html\`: ${build.bytes} bytes (limit ${MAX_BYTES}) — ${build.bytes < MAX_BYTES ? 'ok' : 'FAIL'}`,
    `- External references (\`http\`, \`//cdn\`, \`<link\`, \`src=\`): ${build.external.join(', ') || 'none'} — ${build.external.length ? 'FAIL' : 'ok'}`,
    `- Requests that tried to leave file://: ${blockedRequests.length ? blockedRequests.join('; ') : 'none'}`,
    '',
    '## Checks',
    '',
    '| # | Check | Result |',
    '|---|---|---|',
    ...checks.map((c) => `| ${c.id} | ${c.name} | ${c.ran && c.ok ? 'PASS' : 'FAIL'} |`),
    '',
    `**Overall: ${failed ? 'FAIL' : 'PASS'}**`,
    '',
    '## Details',
    '',
  ];
  for (const c of checks) {
    lines.push(`### ${c.id}. ${c.name}`, '', ...(c.notes.length ? c.notes.map((n) => `- ${n}`) : ['- (not run)']), '');
  }
  lines.push('## Screenshots', '', 'Look at them after every run (the script cannot judge art); the notes of the last',
    'inspection are in `tickets/TT-023-release-smoke/implementation.md`.', '', ...shots.map((s) => `- \`${s}\``), '');
  writeFileSync(REPORT, `${lines.join('\n')}\n`);
}

// ------------------------------------------------------------------ main

let browserVersion = '?';
const started = new Date();
const build = buildRelease();
mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: !process.env.SMOKE_HEADED });
browserVersion = browser.version();
let crashed = null;
try {
  const endedSave = await scenarioFullBoot(browser);
  await scenarioWalkthrough(browser);
  await scenarioSaveLoad(browser);
  await scenarioNoStorage(browser);
  await scenarioEndedSave(browser, endedSave);
} catch (e) {
  crashed = e;
  console.error(e);
} finally {
  await browser.close();
  rmSync(tmp, { recursive: true, force: true });
}

expect('1', build.ok, `release build ${build.bytes} bytes, external refs: ${build.external.join(', ') || 'none'}`);
expect('1', blockedRequests.length === 0, `no request left file:// (${blockedRequests.length})`);
expect('7', consoleProblems.length === 0, `${consoleProblems.length} console errors/warnings/page errors across all runs`);
for (const p of consoleProblems) console.log(`    ${p}`);
expect('8', shots.length === 6, `${shots.length} screenshots written`);
if (crashed) expect('7', false, `smoke run aborted: ${crashed.message.split('\n')[0]}`);

const failed = checks.some((c) => !c.ok || !c.ran);
writeReport(build, started, failed);
console.log(`\nsmoke: ${failed ? 'FAIL' : 'PASS'} (${checks.filter((c) => c.ok && c.ran).length}/${checks.length} checks) — docs/SMOKE-REPORT.md`);
process.exit(failed ? 1 : 0);
