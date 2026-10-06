// TT-019 art preview: `node tools/art-preview.js [--screenshots]`.
// Bundles the real renderer (src/ui/screen.js + font8x8 + palette), src/ui/fx.js and the art
// registry (src/content/art/index.js) with esbuild into ONE self-contained page,
// docs/art-preview.html (works from file://, no server). Every picture is shown in the C64 and
// Spectrum themes at 2x and 4x with its id, room and STORY.md brief, animated with its fx, in
// situ on a full 40x25 game screen, plus an fx lab running all four effects.
// TT-021 adds the 40x25 screen art (title, endings): shown full-screen with the rows the UI
// reserves for its own text ("PRESS ANY KEY", ending title and score) overlaid as the game
// would print them, so the art can be judged in place.
// --screenshots also renders docs/screenshots/art-gate-*.png (location pictures) and
// docs/screenshots/art-021-*.png (screens) with headless Chrome (override the binary with
// CHROME=/path/to/chrome); --screenshots=screens renders only the art-021 set.
//
// Page query params (used for the screenshots): view = all (default) | gallery | zoom | situ | fx
// | screens, theme = c64 | spectrum, scale = 2 | 4, id = <art id>, static = 1 (freeze),
// tick = <n>, overlay = 0 (screens without the UI text).
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { art } from '../src/content/art/index.js';
import { endings } from '../src/content/endings.js';
import { applyFx, cellAt } from '../src/ui/fx.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(root, 'docs/art-preview.html');
const SHOTS = resolve(root, 'docs/screenshots');

/**
 * Room name, picture brief and default description per room id, from STORY.md §4.
 * @param {string} md
 * @returns {Record<string, {name: string, brief: string, desc: string}>}
 */
export function parseStory(md) {
  const rooms = {};
  const sections = md.split(/^#### /m).slice(1);
  for (const sec of sections) {
    const head = /^`([a-z0-9_]+)` - ([^\n(]+)/.exec(sec);
    if (!head) continue;
    const brief = /^- picture brief[^:]*: (.+)$/m.exec(sec);
    const plain = /^- desc: "(.+)"$/m.exec(sec);
    const variant = /^ {2}- \(default\): "(.+)"$/m.exec(sec);
    rooms[head[1]] = {
      name: head[2].trim(),
      brief: brief ? brief[1].trim() : '',
      desc: plain ? plain[1] : variant ? variant[1] : '',
    };
  }
  return rooms;
}

/**
 * Screen-art briefs from STORY.md §14.2 ("- `title`: ..." items under "Screen art"), by id.
 * @param {string} md
 * @returns {Record<string, string>}
 */
export function parseScreenBriefs(md) {
  const out = {};
  const sec = md.split('**Screen art (40x25)**')[1]?.split('- **Art-gate')[0] ?? '';
  for (const item of sec.split(/\n {2}- (?=`)/).slice(1)) {
    const m = /^`([a-z0-9_]+)`: ([\s\S]+)$/.exec(item.trim());
    if (m) out[m[1]] = m[2].replace(/\s+/g, ' ').trim();
  }
  return out;
}

/** First tick in [0, limit) at which an effect changes the picture (for static fx frames). */
function firstActiveTick(def, fxId, pred = (o) => o.length > 0, limit = 400) {
  for (let t = 0; t < limit; t++) if (pred(applyFx(def, fxId, t))) return t;
  return 0;
}

/* The page script, serialised into the HTML. Self-contained: it only uses its arguments. */
function pageMain(A, META) {
  const { createScreen, applyAllFx, applyFx, art } = A;
  const q = new URLSearchParams(location.search);
  const view = q.get('view') || 'all';
  const frozen = q.get('static') === '1';
  const fixedTick = Number(q.get('tick') || 0);
  const ids = Object.keys(art).filter((id) => art[id].h === 9);
  const screenIds = Object.keys(art).filter((id) => art[id].h === 25);
  const animated = [];
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
  const app = document.getElementById('app');

  function screenBox(parent, cols, rows, scale, theme, border) {
    const b = border ?? { x: 0, y: 0 };
    const box = el('div', 'screen');
    box.style.width = `${(cols * 8 + 2 * b.x) * scale}px`;
    box.style.height = `${(rows * 8 + 2 * b.y) * scale}px`;
    const canvas = el('canvas');
    box.append(canvas);
    parent.append(box);
    return createScreen(canvas, { cols, rows, theme, border: b });
  }
  function drawArt(s, def, top, fxIds, tick) {
    for (let y = 0; y < def.h; y++) {
      const chars = Array.from(def.chars[y]);
      for (let x = 0; x < def.w; x++) {
        const bg = typeof def.bg === 'string' ? def.bg : def.bg ? def.bg[y][x] : '0';
        s.put(x, top + y, chars[x], def.colors[y][x], bg);
      }
    }
    const over = fxIds === undefined ? applyAllFx(def, tick) : fxIds.length === 1 ? applyFx(def, fxIds[0], tick) : [];
    for (const o of over) s.put(o.x, top + o.y, o.ch, o.fg, o.bg);
    s.render();
  }
  function picture(parent, id, theme, scale, fxIds, tick) {
    const def = art[id];
    const s = screenBox(parent, def.w, def.h, scale, theme);
    const paint = (t) => drawArt(s, def, 0, fxIds, t);
    paint(tick ?? fixedTick);
    if (!frozen && tick === undefined && (fxIds ?? def.fx ?? []).length) animated.push(paint);
    return s;
  }
  function wrap(text, width) {
    const lines = [];
    let line = '';
    for (const word of text.split(' ')) {
      if (line && line.length + 1 + word.length > width) { lines.push(line); line = word; } else line = line ? `${line} ${word}` : word;
    }
    if (line) lines.push(line);
    return lines;
  }
  function situ(parent, id, theme, scale) {
    const s = screenBox(parent, 40, 25, scale, theme, { x: 16, y: 18 });
    const room = META.rooms[id] ?? { name: id, desc: '' };
    const name = room.name.replace(/\s*\(.*$/, '');
    const left = ` ${name.toUpperCase()}`;
    const right = '21:30  SC 0 ';
    s.print(0, 0, left + ' '.repeat(40 - left.length - right.length) + right, 'statusFg', 'statusBg');
    const paint = (t) => {
      drawArt(s, art[id], 1, undefined, t);
      s.fill({ x: 0, y: 10, w: 40, h: 1 }, '─', 'divider');
      s.print(0, 11, name, 'title');
      wrap(room.desc, 40).forEach((ln, i) => s.print(0, 12 + i, ln, 'fg'));
      s.print(0, 24, '>', 'fg');
      s.put(1, 24, '', 'cursor');
      s.render();
    };
    paint(fixedTick);
    if (!frozen && (art[id].fx ?? []).length) animated.push(paint);
  }
  // 40x25 screen art with the UI's reserved rows printed over it (TT-021)
  function screenArt(parent, id, theme, scale, overlay = true, tick) {
    const def = art[id];
    const s = screenBox(parent, 40, 25, scale, theme, { x: 16, y: 18 });
    const ending = META.endings.find((e) => e.art === id);
    const centre = (y, text, role) => s.print(Math.floor((40 - text.length) / 2), y, text, role, '0');
    const paint = (t) => {
      drawArt(s, def, 0, undefined, t);
      // stand-in for the UI's text: plain palette keys, so it reads on black in every theme
      if (overlay && id === 'title') centre(24, 'PRESS ANY KEY', 'f');
      else if (overlay && ending) {
        centre(20, ending.title.toUpperCase(), '1');
        centre(22, 'YOU SCORED 100 OF 100 IN 91 TURNS', 'f');
      }
      s.render();
    };
    paint(tick ?? fixedTick);
    if (!frozen && tick === undefined && (def.fx ?? []).length) animated.push(paint);
  }
  function label(parent, text, cls = 'label') { parent.append(el('div', cls, text)); }
  function card(id) {
    const c = el('section', 'card');
    const def = art[id];
    const room = META.rooms[id];
    c.append(el('h2', null, `${id}${room ? ` - ${room.name}` : ''}`));
    c.append(el('p', 'meta', `${def.w}x${def.h} - fx: ${(def.fx ?? []).join(', ') || 'none'}`));
    if (room?.brief) c.append(el('p', 'brief', `Brief: ${room.brief}`));
    return c;
  }

  if (view === 'gallery') {
    const theme = q.get('theme') || 'c64';
    const scale = Number(q.get('scale') || 2);
    for (const id of ids) { label(app, `${id} - ${theme} ${scale}x`, 'shot-label'); picture(app, id, theme, scale); }
  } else if (view === 'zoom') {
    const id = q.get('id') || ids[0];
    const scale = Number(q.get('scale') || (art[id]?.h === 25 ? 2 : 4));
    const row = el('div', 'row');
    app.append(row);
    for (const theme of ['c64', 'spectrum']) {
      const cell = el('div');
      label(cell, `${id} - ${theme} ${scale}x`, 'shot-label');
      if (art[id]?.h === 25) screenArt(cell, id, theme, scale, q.get('overlay') !== '0');
      else picture(cell, id, theme, scale);
      row.append(cell);
    }
  } else if (view === 'screenfx') {
    for (const [id, ticks, what] of META.screenFx) {
      label(app, `${id} - ${what} - ticks ${ticks.join(', ')}`, 'shot-label');
      const row = el('div', 'row');
      app.append(row);
      for (const t of ticks) screenArt(row, id, 'c64', 1, true, t);
    }
  } else if (view === 'screens') {
    const theme = q.get('theme') || 'c64';
    const row = el('div', 'row');
    app.append(row);
    for (const id of screenIds) {
      const cell = el('div');
      label(cell, `${id} - ${theme} ${q.get('scale') || 2}x`, 'shot-label');
      screenArt(cell, id, theme, Number(q.get('scale') || 2), q.get('overlay') !== '0');
      row.append(cell);
    }
  } else if (view === 'situ') {
    const theme = q.get('theme') || 'c64';
    const row = el('div', 'row');
    app.append(row);
    for (const id of ids) situ(row, id, theme, Number(q.get('scale') || 2));
  } else if (view === 'fx') {
    for (const [fxId, id, ticks] of META.fxFrames) {
      label(app, `${fxId} on ${id} - ticks ${ticks.join(', ')}`, 'shot-label');
      const row = el('div', 'row');
      app.append(row);
      for (const t of ticks) picture(row, id, 'c64', 2, [fxId], t);
    }
  } else {
    app.append(el('h1', null, 'The Tallyman - art preview (TT-019, TT-021)'));
    app.append(el('p', 'meta', 'Rendered with the game\'s own screen.js, font8x8 and palettes; fx from src/ui/fx.js at 10 ticks/s. '
      + 'Query: ?static=1&tick=N freezes the animation.'));
    for (const id of ids) {
      const c = card(id);
      const grid = el('div', 'grid');
      for (const [theme, scale] of [['c64', 2], ['spectrum', 2], ['c64', 4], ['spectrum', 4]]) {
        const cell = el('div', 'cell');
        label(cell, `${theme} ${scale}x`);
        picture(cell, id, theme, scale);
        grid.append(cell);
      }
      c.append(grid);
      app.append(c);
    }
    for (const id of screenIds) {
      const c = card(id);
      if (META.briefs[id]) c.append(el('p', 'brief', `Brief: ${META.briefs[id]}`));
      const grid = el('div', 'grid');
      for (const theme of ['c64', 'spectrum']) {
        const cell = el('div', 'cell');
        label(cell, `${theme} 2x, with the UI text in the reserved rows`);
        screenArt(cell, id, theme, 2);
        grid.append(cell);
      }
      c.append(grid);
      app.append(c);
    }
    const s = el('section', 'card');
    s.append(el('h2', null, 'In situ - full 40x25 screen'));
    for (const theme of ['c64', 'spectrum']) {
      const row = el('div', 'row');
      for (const id of ids) situ(row, id, theme, 2);
      s.append(row);
    }
    app.append(s);
    const lab = el('section', 'card');
    lab.append(el('h2', null, 'FX lab - every effect, animated'));
    const grid = el('div', 'grid');
    for (const [fxId, id] of META.fxFrames) {
      const cell = el('div', 'cell');
      label(cell, `${fxId} on ${id}`);
      picture(cell, id, 'c64', 2, [fxId]);
      grid.append(cell);
    }
    lab.append(grid);
    app.append(lab);
  }

  if (animated.length) {
    let last = -1;
    const loop = (now) => {
      const tick = Math.floor(now / 100);
      if (tick !== last) { last = tick; for (const paint of animated) paint(tick); }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  document.body.dataset.ready = '1';
}

const CSS = `
  :root { color-scheme: dark; }
  body { margin: 0; background: #101014; color: #d8d8e0; font: 14px/1.45 system-ui, sans-serif; }
  #app { padding: 24px clamp(16px, 3vw, 48px); }
  h1 { font-size: 22px; margin: 0 0 4px; } h2 { font-size: 17px; margin: 0 0 4px; font-family: ui-monospace, monospace; }
  .meta { color: #9a9aa8; margin: 0 0 6px; } .brief { color: #c8c8b0; margin: 0 0 12px; }
  .card { margin: 0 0 28px; padding: 16px; background: #18181e; border: 1px solid #2a2a34; border-radius: 6px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(660px, max-content)); gap: 16px; }
  .row { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 16px; }
  .label, .shot-label { font: 12px ui-monospace, monospace; color: #9a9aa8; margin: 0 0 4px; }
  .shot-label { margin-top: 8px; }
  .screen { position: relative; flex: none; }
  .screen canvas { position: absolute; inset: 0; display: block; image-rendering: pixelated; }
`;

async function bundle() {
  const result = await build({
    stdin: {
      contents: [
        "import { createScreen } from './src/ui/screen.js';",
        "import { applyAllFx, applyFx, cellAt } from './src/ui/fx.js';",
        "import { art } from './src/content/art/index.js';",
        'window.__ART__ = { createScreen, applyAllFx, applyFx, cellAt, art };',
      ].join('\n'),
      resolveDir: root,
      sourcefile: 'art-preview-entry.js',
    },
    bundle: true, format: 'iife', write: false, target: 'es2022', minify: false,
  });
  return result.outputFiles[0].text;
}

/** A tick at which no flicker or lightning is active, so static screenshots show the base art. */
function calmTick() {
  for (let t = 0; t < 400; t++) {
    const busy = Object.values(art).some((def) => (def.fx ?? []).some((f) => (f === 'flicker' || f === 'lightning') && applyFx(def, f, t).length));
    if (!busy) return t;
  }
  return 0;
}

function screenshots(set = 'all') {
  const chrome = process.env.CHROME || 'google-chrome';
  const profile = mkdtempSync(join(tmpdir(), 'art-preview-'));
  const tick = String(calmTick());
  const url = (params) => `${pathToFileURL(OUT).href}?${new URLSearchParams({ static: '1', tick, ...params })}`;
  const shots = [
    ['art-gate-c64.png', { view: 'gallery', theme: 'c64', scale: '2' }, [720, 560]],
    ['art-gate-spectrum.png', { view: 'gallery', theme: 'spectrum', scale: '2' }, [720, 560]],
    ['art-gate-situ-c64.png', { view: 'situ', theme: 'c64', scale: '2' }, [2320, 520]],
    ['art-gate-situ-spectrum.png', { view: 'situ', theme: 'spectrum', scale: '2' }, [2320, 520]],
    ['art-gate-fx.png', { view: 'fx' }, [2760, 820]],
    ...Object.keys(art).filter((id) => art[id].h === 9).map((id) => [`art-gate-${id}.png`, { view: 'zoom', id }, [1320, 680]]),
  ];
  const screenIds = Object.keys(art).filter((id) => art[id].h === 25);
  const screenShots = [
    ['art-021-screens-c64.png', { view: 'screens', theme: 'c64', scale: '2' }, [2300, 1560]],
    ['art-021-screens-spectrum.png', { view: 'screens', theme: 'spectrum', scale: '2' }, [2300, 1560]],
    ['art-021-title-4x.png', { view: 'zoom', id: 'title', scale: '4' }, [3000, 1010]],
    ['art-021-fx.png', { view: 'screenfx' }, [1160, 1980]],
    ...screenIds.map((id) => [`art-021-${id}.png`, { view: 'zoom', id, scale: '2' }, [1560, 540]]),
  ];
  mkdirSync(SHOTS, { recursive: true });
  try {
    for (const [file, params, [w, h]] of set === 'screens' ? screenShots : [...shots, ...screenShots]) {
      const r = spawnSync(chrome, [
        '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--force-device-scale-factor=1',
        `--user-data-dir=${profile}`, `--window-size=${w},${h}`, '--virtual-time-budget=3000',
        `--screenshot=${join(SHOTS, file)}`, url(params),
      ], { encoding: 'utf8', timeout: 60000 });
      if (r.status !== 0) throw new Error(`chrome failed for ${file}: ${r.stderr || r.error}`);
      console.log(`art-preview: wrote docs/screenshots/${file}`);
    }
  } finally {
    rmSync(profile, { recursive: true, force: true });
  }
}

async function main() {
  const rooms = parseStory(readFileSync(resolve(root, 'docs/STORY.md'), 'utf8'));
  const demo = (id) => (art[id] ? id : Object.keys(art)[0]);
  const rainId = demo('market_square');
  const flickerId = demo('weaving_shed');
  const flash = firstActiveTick(art[rainId], 'lightning');
  // flicker level 2 is the only one that dims mid grey ('c' -> 'b'); level 1 leaves it alone
  const fl = art[flickerId];
  const hasDeep = (o) => o.some((c) => cellAt(fl, c.x, c.y).fg === 'c' || cellAt(fl, c.x, c.y).bg === 'c');
  const calm = firstActiveTick(fl, 'flicker', (o) => o.length === 0);
  const dim1 = firstActiveTick(fl, 'flicker', (o) => o.length > 0 && !hasDeep(o));
  const dim2 = firstActiveTick(fl, 'flicker', (o) => o.length > 0 && hasDeep(o));
  const fxFrames = [
    ['rain', rainId, [0, 1, 2, 3]],
    ['lightning', rainId, [flash - 1, flash, flash + 2, flash + 3]],
    ['fog', flickerId, [0, 10, 20, 30]],
    ['flicker', flickerId, [calm, dim1, dim2, calm]],
  ];
  const story = readFileSync(resolve(root, 'docs/STORY.md'), 'utf8');
  const briefs = parseScreenBriefs(story);
  const screenFx = [];
  for (const [id, def] of Object.entries(art)) {
    if (def.h !== 25) continue;
    for (const f of def.fx ?? []) {
      const on = firstActiveTick(def, f, f === 'flicker' ? (o) => o.length > 20 : undefined);
      screenFx.push([id, f === 'lightning' ? [on - 1, on, on + 2] : [on, on + 7, on + 15], f]);
    }
  }
  const meta = { rooms, fxFrames, briefs, screenFx, endings: endings.map((e) => ({ art: e.art, title: e.title })) };
  const js = (await bundle()).replace(/<\/script/gi, '<\\/script');
  const json = JSON.stringify(meta).replace(/</g, '\\u003c');
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tallyman Art Preview</title>
<!-- GENERATED by tools/art-preview.js (TT-019, TT-021) - do not edit; re-run the tool. -->
<style>${CSS}</style>
</head>
<body>
<div id="app"></div>
<script>
${js}
</script>
<script>
(${pageMain.toString()})(window.__ART__, ${json});
</script>
</body>
</html>
`;
  writeFileSync(OUT, html);
  console.log(`art-preview: wrote docs/art-preview.html (${Object.keys(art).length} pictures, ${html.length} bytes)`);
  const shotArg = process.argv.find((a) => a.startsWith('--screenshots'));
  if (shotArg) screenshots(shotArg.split('=')[1] || 'all');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
