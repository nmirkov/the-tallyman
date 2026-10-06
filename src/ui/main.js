// The browser host (ARCHITECTURE A10): wires the engine to the 40x25 screen, the terminal,
// the picture panel, the status bar, audio and storage, and renders Output Events through
// the pure dispatcher (src/ui/dispatch.js). It holds no game state beyond what the last
// events said (A10.4 rule 5). The boot sequence (src/ui/boot.js, TT-014) runs first:
// power-on screen, LOAD, tape loading, title; QUIT returns to the title.
//
// URL parameters (testing):
//   seed=<uint32>         game seed (default: from the clock)
//   script=cmd1|cmd2|...  type these commands once the game is idle, typewriter off (no boot)
//   skipboot=1            straight to the title screen (also boot=title; reduced motion does it too)
//   boot=off              no boot sequence and no title: straight into the game
//   theme=c64|spectrum|amber   start theme for this page load (not persisted)
//   static=1              reduced motion: instant text, no blinking, no fx, steady border
//   storage=off           behave as if localStorage were unavailable (in-memory saves)
import { createScreen } from './screen.js';
import { createTerminal } from './terminal.js';
import { createAudio } from './audio/index.js';
import { createDispatcher, THEME_ORDER } from './dispatch.js';
import { createStorageAdapter, loadSettings } from './storage.js';
import { drawStatus, borderForNerve, borderAt } from './statusbar.js';
import { createArtLayer, drawDivider, PICTURE_TOP, PICTURE_ROWS } from './picture.js';
import { createBoot, bootStart } from './boot.js';
import { createGame } from '../engine/game.js';
import content from '../content/index.js';

const ENDING_PROMPT = 'UNDO, LOAD, RESTART or IMPORT?';
const PRESS_KEY = '[PRESS ANY KEY]';
/** Ending-screen rows (TT-021: art rows 0-18, rows 19-24 reserved for the UI). */
const END_ROWS = Object.freeze({ title: 19, score: 20, rank: 21, region: { top: 22, bottom: 24 } });
/** Terminal colours on the black ending screen: palette keys that read in every theme. */
const END_COLORS = Object.freeze({
  paper: '0',
  roles: { fg: 'f', title: '1', alert: 'a', whisper: 'c', echo: '1', system: '7', cursor: '1', dim: 'c' },
});
const KEY_CLICK_KINDS = new Set(['char', 'delete', 'enter']);

const win = window;
const doc = document;
const params = new URLSearchParams(win.location.search);
const motionQuery = win.matchMedia?.('(prefers-reduced-motion: reduce)');
const forcedStatic = params.get('static') === '1';
let reducedMotion = forcedStatic || !!motionQuery?.matches;
const script = (params.get('script') ?? '').split('|').map((s) => s.trim()).filter(Boolean);
const scripted = script.length > 0;
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const newSeed = () => (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;

// ------------------------------------------------------------------ host services

const adapter = createStorageAdapter(params.get('storage') === 'off' ? { storage: null } : {});
const settings = loadSettings(adapter, { reducedMotion });
const startTheme = THEME_ORDER.includes(params.get('theme')) ? params.get('theme') : settings.theme;
settings.theme = startTheme;

const canvas = doc.querySelector('#screen');
const screen = createScreen(canvas, { theme: startTheme });
const audio = createAudio();
audio.setMuted(settings.sound === 'off');
audio.setMusicEnabled(settings.music === 'on');

const picture = createArtLayer(screen, { top: PICTURE_TOP, reducedMotion });
const endArt = createArtLayer(screen, { top: 0, reducedMotion });

// ------------------------------------------------------------------ view state

let game = null;
// 'boot' (boot.js owns the screen) | 'play' | 'endWait' (ending text shown, waiting for a key)
// | 'end' (ending screen)
let mode = 'play';
let boot = null;
/** A user gesture has happened (audio can play). */
let gestured = false;
/** Swallow the click that follows a boot pointerdown (the terminal would read it as a key). */
let swallowClick = false;
let endEvent = null;
let status = null;
let pictureEvent = { id: null, graphics: true };
let border = borderForNerve(0);

const term = createTerminal(screen, {
  graphics: true,
  typewriter: settings.typewriter === 'on' && !scripted,
  reducedMotion: forcedStatic || undefined,
  autoLoop: false,
  onSubmit: submit,
  onKey: (kind) => { if (KEY_CLICK_KINDS.has(kind)) audio.sfx('key'); },
});

/** The location picture to show, or null (none, GRAPHICS OFF, or not a 40x9 picture). */
function panelArt() {
  if (!pictureEvent.graphics || !pictureEvent.id) return null;
  const def = content.art?.[pictureEvent.id];
  return def && def.h === PICTURE_ROWS ? def : null;
}

function drawPanel() {
  const def = panelArt();
  term.setGraphics(!!def);
  if (def) {
    picture.set(def);
    drawDivider(screen);
  } else {
    picture.set(null);
  }
}

function drawStatusBar() {
  if (mode !== 'play') return;
  if (status) drawStatus(screen, status);
  else screen.fill({ x: 0, y: 0, w: screen.cols, h: 1 }, ' ', 'statusFg', 'statusBg');
}

/** Full redraw of the play screen (theme change, leaving the ending screen). */
function redrawPlay() {
  drawStatusBar();
  drawPanel();
  term.invalidate();
}

// ------------------------------------------------------------------ ending screen

const centre = (y, text, fg) => {
  const s = Array.from(String(text).toUpperCase()).slice(0, screen.cols).join('');
  screen.fill({ x: 0, y, w: screen.cols, h: 1 }, ' ', '0', '0');
  screen.print(Math.floor((screen.cols - s.length) / 2), y, s, fg, '0');
};

function transcriptLine(text) {
  const p = doc.createElement('p');
  p.textContent = text;
  term.transcript.append(p);
}

/** After the ending text: wait for a key, then show the ending screen. */
function awaitEnding(ev) {
  endEvent = ev;
  mode = 'endWait';
  term.setInputEnabled(false);
}

function showEnding() {
  if (mode !== 'endWait' || !endEvent) return;
  const ev = endEvent;
  mode = 'end';
  picture.set(null);
  const def = content.art?.[ev.art];
  if (def && def.h === screen.rows) endArt.set(def);
  else { endArt.set(null); screen.fill({ x: 0, y: 0, w: screen.cols, h: screen.rows }, ' ', '0', '0'); }
  const score = `You scored ${ev.score} of ${ev.maxScore} in ${ev.turns} turns`;
  const rank = `Rank: ${ev.rank}`;
  centre(END_ROWS.title, ev.title, '1');
  centre(END_ROWS.score, score, 'f');
  centre(END_ROWS.rank, rank, '7');
  transcriptLine(`${ev.title}. ${score}. ${rank}.`);
  term.setColors(END_COLORS);
  term.core.setRegion(END_ROWS.region);
  term.clear();
  term.print(ENDING_PROMPT, 'system');
  term.setInputEnabled(true);
  term.invalidate();
}

/** The engine left the ended state (refresh bundle after UNDO / LOAD / RESTART / IMPORT). */
function leaveEnding() {
  if (mode === 'play') return;
  mode = 'play';
  endEvent = null;
  endArt.set(null);
  term.setColors(null);
  term.setInputEnabled(true);
  screen.clearRegion();
  redrawPlay();
}

// ------------------------------------------------------------------ settings

function applySetting(key, value) {
  switch (key) {
    case 'sound': audio.setMuted(value === 'off'); break;
    case 'music': audio.setMusicEnabled(value === 'on'); break;
    case 'typewriter': term.setTypewriter(value === 'on' && !scripted); break;
    case 'theme':
      screen.setTheme(value);
      doc.body.style.background = '';
      if (mode === 'play') redrawPlay();
      else term.invalidate();
      break;
    default: break;
  }
}

// ------------------------------------------------------------------ files

function download(name, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = doc.createElement('a');
  a.href = url;
  a.download = name;
  a.style.display = 'none';
  doc.body.append(a);
  a.click();
  a.remove();
  win.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** Open a .json file picker; resolves with the file's text, or null when cancelled. */
function pickFile() {
  return new Promise((resolve) => {
    const input = doc.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      win.removeEventListener('focus', onFocus);
      input.remove();
      resolve(value);
    };
    // `cancel` is reported by current browsers; older ones only give the window focus back
    const onFocus = () => win.setTimeout(() => { if (!input.files?.length) finish(null); }, 800);
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) { finish(null); return; }
      file.text().then(finish, () => finish(null));
    });
    input.addEventListener('cancel', () => finish(null));
    doc.body.append(input);
    win.addEventListener('focus', onFocus);
    input.click();
  });
}

// ------------------------------------------------------------------ dispatcher

const dispatcher = createDispatcher({
  print: (text, style) => term.print(text, style),
  clear: () => term.clear(),
  pause: (ms) => term.pause(ms),
  mark: (fn) => term.mark(fn),
  cleared: leaveEnding,
  room: (ev) => {
    status = { ...(status ?? {}), room: ev.name };
    drawStatusBar();
  },
  picture: (ev) => {
    pictureEvent = { id: ev.id ?? null, graphics: ev.graphics !== false };
    if (mode === 'play') drawPanel();
  },
  status: (ev) => {
    status = ev;
    border = borderForNerve(ev.nerve);
    drawStatusBar();
  },
  sfx: (id) => audio.sfx(id),
  ambient: (id) => audio.ambient(id),
  music: (id) => audio.music(id),
  end: awaitEnding,
  adapter,
  load: (data) => game.load(data),
  download,
  pickFile,
  setInputEnabled: (on) => term.setInputEnabled(on),
  quit: () => showTitle(),
  applySetting,
}, { settings });

function submit(line) {
  try {
    dispatcher.render(game.input(line));
  } catch (e) {
    console.error(e);
    term.print(`(Something went wrong: ${e?.message ?? e})`, 'system');
  }
}

function newGame(seed) {
  game = createGame({ content, seed });
  dispatcher.render(game.start());
}

// ------------------------------------------------------------------ boot and title (TT-014)

let firstSeed = Number.isFinite(seedParam) ? seedParam >>> 0 : null;

/** Leave the boot / title for a fresh game (intro). */
function startGame() {
  boot = null;
  mode = 'play';
  endEvent = null;
  endArt.set(null);
  term.setColors(null);
  term.setInputEnabled(true);
  screen.clearRegion();
  drawStatusBar();
  const seed = firstSeed ?? newSeed();
  firstSeed = null;
  newGame(seed);
  const notice = adapter.takeNotice();
  if (notice) term.print(notice, 'system');
  term.focus();
}

/**
 * Run the boot sequence from `start` ('power' or 'title'). The game, if any, is discarded.
 * @param {'power'|'title'} start
 */
function runBoot(start) {
  mode = 'boot';
  game = null;
  status = null;
  picture.set(null);
  endArt.set(null);
  term.setColors(null);
  term.setInputEnabled(false);
  audio.ambient('none');
  boot = createBoot({
    screen,
    audio,
    titleArt: content.art?.title ?? null,
    start,
    reducedMotion,
    gestured,
    music: () => dispatcher.settings.sound === 'on' && dispatcher.settings.music === 'on' && audio.available,
    onStart: startGame,
    now: win.performance.now(),
  });
}

/** QUIT: back to the title screen. */
function showTitle() {
  term.clear();
  runBoot('title');
}

// ------------------------------------------------------------------ input, audio unlock

const unlock = () => { gestured = true; audio.unlock(); };
win.addEventListener('keydown', (e) => {
  unlock();
  if (e.key === 'F2') {
    e.preventDefault();
    const r = dispatcher.setting('sound', 'toggle');
    if (mode === 'boot') audio.setMuted(r.value === 'off'); // the terminal (and its marks) is paused
    return;
  }
  if (mode === 'boot') {
    // the boot owns every key; modifiers alone, browser shortcuts and auto-repeat do not count
    if (e.ctrlKey || e.altKey || e.metaKey || /^F\d+$/.test(e.key)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.repeat || ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) return;
    boot?.key(win.performance.now());
    return;
  }
  if (mode === 'endWait' && term.ready && !e.ctrlKey && !e.altKey && !e.metaKey) {
    e.preventDefault();
    e.stopImmediatePropagation();
    showEnding();
  }
}, { capture: true });
win.addEventListener('pointerdown', (e) => {
  unlock();
  if (mode === 'boot') {
    e.preventDefault();
    swallowClick = true;
    boot?.key(win.performance.now());
    return;
  }
  if (mode === 'endWait' && term.ready) {
    e.preventDefault();
    showEnding();
  }
}, { capture: true });
win.addEventListener('click', (e) => {
  if (mode !== 'boot' && !swallowClick) return;
  swallowClick = false;
  e.preventDefault();
  e.stopPropagation();
}, { capture: true });
motionQuery?.addEventListener?.('change', (e) => {
  if (forcedStatic) return;
  reducedMotion = e.matches;
  picture.setReducedMotion(reducedMotion);
  endArt.setReducedMotion(reducedMotion);
  boot?.setReducedMotion(reducedMotion);
});

// ------------------------------------------------------------------ frame loop

function frame(now) {
  if (mode === 'boot') {
    boot?.frame(now);
    screen.render();
    win.requestAnimationFrame(frame);
    return;
  }
  term.frame(now);
  if (mode === 'play') picture.frame(now);
  else endArt.frame(now);
  if (mode === 'endWait' && term.ready) {
    const on = reducedMotion || Math.floor(now / 500) % 2 === 0;
    screen.print(0, screen.rows - 1, on ? PRESS_KEY : ' '.repeat(PRESS_KEY.length), 'system', 'bg');
    if (on) for (let x = 0; x < PRESS_KEY.length; x++) screen.invert(x, screen.rows - 1, true);
  }
  screen.setBorder(mode === 'play' ? borderAt(border, now, reducedMotion) : null);
  screen.render();
  win.requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ test script

const sleep = (ms) => new Promise((r) => win.setTimeout(r, ms));
let scriptDone = !scripted;

async function runScript() {
  for (const cmd of script) {
    for (;;) {
      if (mode === 'endWait' && term.ready) showEnding();
      else if (term.core.more) term.core.key(' ');
      else if (term.ready && term.core.inputEnabled && !dispatcher.importing) break;
      await sleep(30);
    }
    for (const ch of cmd) term.core.key(ch);
    term.core.key('Enter');
    await sleep(30);
  }
  // page through the last answer too, so the final screen is the settled one
  while (!term.ready) {
    if (term.core.more) term.core.key(' ');
    await sleep(30);
  }
  scriptDone = true;
}

// ------------------------------------------------------------------ boot

const startAt = bootStart({ boot: params.get('boot'), skipboot: params.get('skipboot'), scripted, reducedMotion });
if (startAt === 'game') startGame();
else runBoot(startAt);
win.requestAnimationFrame(frame);
if (scripted) runScript();

/** Test / CDP hooks (read-only views; no game logic). */
win.__tallyman = {
  get game() { return game; },
  get mode() { return mode; },
  /** Boot phase ('power' ... 'title'), or null once the game runs. */
  get bootPhase() { return boot ? boot.phase : null; },
  /** Press a key on the boot / title screen (tests). */
  bootKey: () => { gestured = true; boot?.key(win.performance.now()); },
  get scriptDone() { return scriptDone && term.ready; },
  get settings() { return dispatcher.settings; },
  term,
  screen,
  audio,
  adapter,
  continueEnding: showEnding,
  /** Render an event array through the dispatcher (e.g. the bundle of a crafted game.load). */
  render: (events) => dispatcher.render(events),
  get border() { return border; },
  rowText: (y) => Array.from({ length: screen.cols }, (_, x) => screen.get(x, y).ch).join(''),
  screenText: () => Array.from({ length: screen.rows }, (_, y) => win.__tallyman.rowText(y)).join('\n'),
};
