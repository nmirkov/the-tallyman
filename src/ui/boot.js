// TT-014: the boot sequence a 1984 player saw before the game (PLAN §1, §3.6).
//
//   C64 flavour (c64 and amber themes)        Spectrum flavour (spectrum theme)
//   power  **** COMMODORE 64 BASIC V2 ****     (c) 1982 Sinclair Research Ltd
//   type   LOAD"TALLYMAN",1                    K cursor, LOAD "" (keyword entry)
//   play   PRESS PLAY ON TAPE  (waits: a key   Start tape, then press any key.
//          is PLAY, and unlocks audio)
//   search OK / SEARCHING FOR / screen blanks  red/cyan pilot, header, "Program: TALLYMAN"
//          / FOUND TALLYMAN / LOADING
//   load   thin multicolour turbo bars; the    blue/yellow data bars; the picture loads
//          title art loads in row by row       as a monochrome bitmap, then the colours
//   title  title art + fx, "PRESS ANY KEY" blinking on row 24, title music
//
// A key during power/type/search/load skips to the title; at "PRESS PLAY" it is PLAY.
// The pure parts (state machine with an injected clock, scene description, stripe bands)
// are exported for DOM-free tests; createBoot() draws them on the TT-003 screen.
import { createArtLayer } from './picture.js';
import { cellAt } from './fx.js';
import { resolveColor } from './palette.js';

export const PROGRAM = 'TALLYMAN';
export const PRESS_ANY_KEY = 'PRESS ANY KEY';

/** Phase durations in ms ('play' and 'title' wait for a key). */
export const BOOT_TIMING = Object.freeze({
  c64: Object.freeze({ power: 1300, type: 1650, search: 2150, load: 3600 }),
  spectrum: Object.freeze({ power: 1300, type: 1500, search: 2300, load: 3600 }),
  /** Keys on the title are ignored this long (a held or double key must not skip it). */
  titleMinMs: 350,
});

export const PHASES = Object.freeze(['power', 'type', 'play', 'search', 'load', 'title', 'done']);
const NEXT = Object.freeze({ power: 'type', type: 'play', search: 'load', load: 'title' });
const SKIPPABLE = new Set(['power', 'type', 'search', 'load']);

/**
 * Which machine the boot imitates for a theme: Spectrum for 'spectrum', C64 otherwise.
 * @param {string} theme
 * @returns {'c64'|'spectrum'}
 */
export function bootFlavour(theme) {
  return theme === 'spectrum' ? 'spectrum' : 'c64';
}

/**
 * Where the boot starts from the page parameters: 'game' for scripted runs or boot=off,
 * 'title' for skipboot=1 / boot=title or reduced motion, else the full 'power' sequence.
 * @param {{boot?: string|null, skipboot?: string|null, scripted?: boolean, reducedMotion?: boolean}} p
 * @returns {'power'|'title'|'game'}
 */
export function bootStart({ boot = null, skipboot = null, scripted = false, reducedMotion = false } = {}) {
  if (scripted || boot === 'off') return 'game';
  if (skipboot === '1' || boot === 'title' || reducedMotion) return 'title';
  return 'power';
}

/**
 * @typedef {{type:'tape', on:boolean} | {type:'music', id:string} | {type:'start'} |
 *   {type:'phase', phase:string}} BootEffect
 */

/**
 * The boot state machine. Pure: time comes in as `now` (ms) and side effects go out as
 * data. The host applies the effects (tape loop, music, starting the game).
 * @param {{flavour?: 'c64'|'spectrum', start?: 'power'|'title', now?: number,
 *   music?: boolean|(() => boolean), gestured?: boolean}} [opts]
 *   music: whether the title tune would be heard (sound and music on). gestured: a user
 *   gesture has already unlocked audio (e.g. QUIT back to the title).
 */
export function createBootMachine(opts = {}) {
  const flavour = opts.flavour === 'spectrum' ? 'spectrum' : 'c64';
  const timing = BOOT_TIMING[flavour];
  const wantsMusic = () => (typeof opts.music === 'function' ? !!opts.music() : opts.music !== false);
  let phase = null;
  let since = 0;
  let gestured = !!opts.gestured;
  let holdForMusic = false;

  /** @returns {BootEffect[]} */
  function enter(next, now) {
    const was = phase;
    phase = next;
    since = now;
    const fx = [{ type: 'phase', phase: next }];
    if (next === 'search') fx.push({ type: 'tape', on: true });
    if (next === 'title') {
      if (was === 'search' || was === 'load') fx.push({ type: 'tape', on: false });
      fx.push({ type: 'music', id: 'title' });
      // Without a gesture yet the tune cannot start: the first key unlocks audio and
      // starts it, the next one starts the game (the title tune is heard either way).
      holdForMusic = !gestured && wantsMusic();
    }
    if (next === 'done') fx.push({ type: 'music', id: 'stop' }, { type: 'start' });
    return fx;
  }

  const initial = enter(opts.start === 'title' ? 'title' : 'power', opts.now ?? 0);

  return {
    get phase() { return phase; },
    get flavour() { return flavour; },
    get holdForMusic() { return holdForMusic; },
    /** Effects of entering the start phase (apply them once after creating). */
    initial,
    /** ms spent in the current phase. */
    elapsed(now) { return Math.max(0, now - since); },
    /**
     * Advance timed phases.
     * @param {number} now
     * @returns {BootEffect[]}
     */
    tick(now) {
      const out = [];
      for (let guard = 0; guard < PHASES.length; guard++) {
        const dur = timing[phase];
        if (dur === undefined || now - since < dur) break;
        out.push(...enter(NEXT[phase], since + dur));
      }
      return out;
    },
    /**
     * A key press or tap.
     * @param {number} now
     * @returns {BootEffect[]}
     */
    key(now) {
      gestured = true;
      if (phase === 'play') return enter('search', now);
      if (SKIPPABLE.has(phase)) return enter('title', now);
      if (phase === 'title') {
        if (holdForMusic) { holdForMusic = false; return []; } // this key unlocked the tune
        if (now - since < BOOT_TIMING.titleMinMs) return [];
        return enter('done', now);
      }
      return [];
    },
  };
}

// ------------------------------------------------------------------ scenes

/** The C64 power-on screen, exactly (rows 1, 3, 5). */
export const C64_BANNER = Object.freeze([
  Object.freeze({ y: 1, text: '    **** COMMODORE 64 BASIC V2 ****' }),
  Object.freeze({ y: 3, text: ' 64K RAM SYSTEM  38911 BASIC BYTES FREE' }),
  Object.freeze({ y: 5, text: 'READY.' }),
]);
export const C64_LOAD = `LOAD"${PROGRAM}",1`;
export const SPECTRUM_COPYRIGHT = '(c) 1982 Sinclair Research Ltd';
export const SPECTRUM_PLAY = 'Start tape, then press any key.';
const C64_TYPE_DELAY = 300;
const C64_TYPE_MS = 70;
const C64_BLINK_HZ = 1.5; // the C64 cursor: 20 jiffies on, 20 off
const SPECTRUM_FLASH_HZ = 1.56; // FLASH swaps ink/paper every 16 frames

/**
 * @typedef {object} Scene
 * @property {string} paper          colour spec for the whole cell area
 * @property {string|null} border    plain border colour (null: theme border); ignored with stripes
 * @property {null|'c64'|'pilot'|'data'} stripes  tape-loading border
 * @property {{x:number, y:number, text:string}[]} lines   text in the theme's ink
 * @property {null|{x:number, y:number, ch:string, blinkHz:number}} cursor  reverse-video cursor
 * @property {null|{cells:number, mono:boolean, attrRows:number}} reveal  picture loading in
 * @property {boolean} title         the title screen
 */

const frac = (t, dur) => Math.min(1, Math.max(0, t / dur));

/**
 * What the screen shows `elapsed` ms into a boot phase. Pure.
 * @param {'c64'|'spectrum'} flavour
 * @param {string} phase
 * @param {number} elapsed
 * @param {{cols?: number, rows?: number}} [size]
 * @returns {Scene}
 */
export function bootScene(flavour, phase, elapsed, { cols = 40, rows = 25 } = {}) {
  const scene = { paper: 'bg', border: null, stripes: null, lines: [], cursor: null, reveal: null, title: false };
  const cells = cols * rows;
  if (phase === 'title' || phase === 'done') {
    return { ...scene, paper: '0', border: '0', title: true };
  }
  if (flavour === 'spectrum') return spectrumScene(scene, phase, elapsed, cells, rows);
  return c64Scene(scene, phase, elapsed, cells);
}

function c64Scene(scene, phase, e, cells) {
  const lines = scene.lines;
  if (phase === 'power') {
    if (e < 250) return scene; // the moment before the KERNAL clears the screen
    lines.push(...C64_BANNER.map((l) => ({ x: 0, ...l })));
    scene.cursor = { x: 0, y: 6, ch: ' ', blinkHz: C64_BLINK_HZ };
    return scene;
  }
  lines.push(...C64_BANNER.map((l) => ({ x: 0, ...l })));
  if (phase === 'type') {
    const n = Math.max(0, Math.min(C64_LOAD.length, Math.floor((e - C64_TYPE_DELAY) / C64_TYPE_MS) + 1));
    lines.push({ x: 0, y: 6, text: C64_LOAD.slice(0, n) });
    scene.cursor = { x: n, y: 6, ch: ' ', blinkHz: 0 }; // solid while typing
    return scene;
  }
  lines.push({ x: 0, y: 6, text: C64_LOAD }, { x: 0, y: 8, text: 'PRESS PLAY ON TAPE' });
  if (phase === 'play') return scene;
  if (phase === 'search') {
    lines.push({ x: 0, y: 9, text: 'OK' });
    if (e >= 150) lines.push({ x: 0, y: 11, text: `SEARCHING FOR ${PROGRAM}` });
    if (e >= 450 && e < 1450) return { ...scene, lines: [], paper: 'border' }; // screen blanked
    if (e >= 1450) lines.push({ x: 0, y: 12, text: `FOUND ${PROGRAM}` });
    if (e >= 1850) lines.push({ x: 0, y: 13, text: 'LOADING' });
    return scene;
  }
  // load: turbo loader, black screen, the picture arrives row by row in full colour
  return {
    ...scene, lines: [], paper: '0', stripes: 'c64',
    reveal: { cells: Math.floor(frac(e - 200, 3100) * cells), mono: false, attrRows: Infinity },
  };
}

function spectrumScene(scene, phase, e, cells, rows) {
  const bottom = rows - 1;
  if (phase === 'power') {
    if (e < 300) return { ...scene, paper: '0', border: '0' }; // RAM check: black
    scene.lines.push({ x: 0, y: bottom, text: SPECTRUM_COPYRIGHT });
    return scene;
  }
  if (phase === 'type') {
    // keyword entry: J gives LOAD at once, then SYMBOL SHIFT+P twice; the cursor flashes K then L
    if (e >= 1350) return scene; // ENTER: the edit line is gone
    let text = '';
    if (e >= 350) text = 'LOAD ';
    if (e >= 700) text = 'LOAD "';
    if (e >= 950) text = 'LOAD ""';
    scene.lines.push({ x: 0, y: bottom, text });
    scene.cursor = { x: text.length, y: bottom, ch: e < 350 ? 'K' : 'L', blinkHz: SPECTRUM_FLASH_HZ };
    return scene;
  }
  if (phase === 'play') {
    scene.lines.push({ x: 0, y: bottom, text: SPECTRUM_PLAY });
    return scene;
  }
  if (phase === 'search') {
    // pilot tone, the header block, "Program:", then the pilot of the next block
    scene.stripes = e >= 1300 && e < 1450 ? 'data' : 'pilot';
    if (e >= 1450) scene.lines.push({ x: 0, y: 0, text: `Program: ${PROGRAM}` });
    return scene;
  }
  // load: SCREEN$ — the bitmap arrives first (no colour), then the attributes flood in
  return {
    ...scene, stripes: 'data',
    reveal: {
      cells: Math.floor(frac(e, 2900) * cells),
      mono: true,
      attrRows: Math.floor(frac(e - 2900, 400) * rows),
    },
  };
}

// ------------------------------------------------------------------ border stripes

/** Small seeded PRNG (mulberry32); stripes must be reproducible for a given tick. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const C64_KEYS = '0123456789abcdef'.split('');

/**
 * Horizontal tape-loading bands covering `height` device pixels. Pure.
 *  - 'c64': thin random multicolour turbo-loader bars (1-3 lines), new every frame
 *  - 'pilot': Spectrum pilot tone, red/cyan bands ~10 lines tall, drifting
 *  - 'data': Spectrum data, blue/yellow pairs 4 (bit 0) or 8 (bit 1) lines tall
 * @param {'c64'|'pilot'|'data'} mode
 * @param {number} height  device pixels
 * @param {number} unit    device pixels per source line (>= 1)
 * @param {number} tick    50 Hz frame number
 * @returns {{y:number, h:number, color:string}[]}  colour = C64 palette key
 */
export function stripeBands(mode, height, unit, tick) {
  const u = Math.max(1, unit);
  const bands = [];
  const r = rng((tick * 2654435761) ^ mode.length);
  let y = 0;
  const push = (lines, color) => {
    const h = Math.max(1, Math.round(lines * u));
    bands.push({ y, h: Math.min(h, height - y), color });
    y += h;
  };
  if (mode === 'pilot') {
    const band = 10;
    const off = (tick * 3) % (band * 2);
    y = -Math.round(off * u);
    let i = 0;
    while (y < height) {
      const h = Math.round(band * u);
      if (y + h > 0) bands.push({ y: Math.max(0, y), h: Math.min(y + h, height) - Math.max(0, y), color: i % 2 ? '3' : '2' });
      y += h;
      i++;
    }
    return bands;
  }
  if (mode === 'data') {
    while (y < height) {
      const lines = r() < 0.5 ? 4 : 8;
      push(lines, '6');
      if (y < height) push(lines, '8');
    }
    return bands;
  }
  while (y < height) push(1 + Math.floor(r() * 3), C64_KEYS[Math.floor(r() * 16)]);
  return bands;
}

// ------------------------------------------------------------------ the boot screen

/**
 * Draw the boot sequence on a TT-003 screen and drive it from key presses.
 * @param {object} host
 * @param {ReturnType<import('./screen.js').createScreen>} host.screen
 * @param {{sfxLoop: Function, music: Function}} host.audio
 * @param {object|null} host.titleArt     content.art.title (40x25)
 * @param {'power'|'title'} [host.start]
 * @param {boolean} [host.reducedMotion]  steady PRESS ANY KEY, no fx
 * @param {boolean} [host.gestured]       audio already unlocked
 * @param {() => boolean} [host.music]    the title tune would be heard
 * @param {() => void} host.onStart       the player pressed a key on the title
 * @param {number} [host.now]
 */
export function createBoot(host) {
  const { screen, audio } = host;
  const cols = screen.cols;
  const rows = screen.rows;
  const flavour = bootFlavour(screen.theme.name);
  const machine = createBootMachine({
    flavour, start: host.start, music: host.music, gestured: host.gestured, now: host.now ?? 0,
  });
  const titleLayer = createArtLayer(screen, { top: 0, reducedMotion: !!host.reducedMotion });
  let stripeMode = null;
  let stripeTick = 0;
  let active = true;

  const painter = (ctx, w, h, layout) => {
    const unit = Math.max(1, layout.scale);
    for (const b of stripeBands(stripeMode, h, unit, stripeTick)) {
      ctx.fillStyle = resolveColor(screen.theme, b.color, 'border');
      ctx.fillRect(0, b.y, w, b.h);
    }
  };

  function apply(effects) {
    for (const fx of effects) {
      if (fx.type === 'tape') audio.sfxLoop(fx.on ? 'tape' : null);
      else if (fx.type === 'music') audio.music(fx.id);
      else if (fx.type === 'phase') onPhase(fx.phase);
      else if (fx.type === 'start') finish();
    }
  }

  function onPhase(phase) {
    if (phase === 'title') {
      screen.fill({ x: 0, y: 0, w: cols, h: rows }, ' ', '0', '0');
      titleLayer.set(host.titleArt && host.titleArt.h === rows ? host.titleArt : null);
    } else if (phase !== 'done') {
      titleLayer.set(null);
    }
  }

  function finish() {
    if (!active) return;
    active = false;
    titleLayer.set(null);
    screen.setBorderPainter(null);
    screen.setBorder(null);
    host.onStart?.();
  }

  function drawText(scene, now) {
    screen.fill({ x: 0, y: 0, w: cols, h: rows }, ' ', scene.paper === 'bg' ? null : scene.paper, scene.paper === 'bg' ? null : scene.paper);
    for (const l of scene.lines) screen.print(l.x, l.y, l.text, null, scene.paper === 'bg' ? null : scene.paper);
    const c = scene.cursor;
    if (c) {
      const on = c.blinkHz === 0 || host.reducedMotion || Math.floor(now * c.blinkHz * 2 / 1000) % 2 === 0;
      screen.put(c.x, c.y, c.ch);
      if (on) screen.invert(c.x, c.y, true);
    }
  }

  function drawReveal(reveal) {
    const art = host.titleArt;
    const blankInk = flavour === 'spectrum' ? null : '0';
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        if (!art || i >= reveal.cells) {
          screen.put(x, y, ' ', blankInk, blankInk);
          continue;
        }
        const cell = cellAt(art, x, y);
        // Spectrum SCREEN$: until a row's attributes arrive, black ink on the white paper
        if (reveal.mono && y >= reveal.attrRows) screen.put(x, y, cell.ch, '0', null);
        else screen.put(x, y, cell.ch, cell.fg, cell.bg);
      }
    }
  }

  function drawTitle(now) {
    titleLayer.frame(now);
    const y = rows - 1;
    const x = Math.floor((cols - PRESS_ANY_KEY.length) / 2);
    const on = host.reducedMotion || Math.floor(now / 400) % 2 === 0;
    screen.fill({ x: 0, y, w: cols, h: 1 }, ' ', '0', '0');
    if (on) screen.print(x, y, PRESS_ANY_KEY, '1', '0');
  }

  // Applied on the first frame, not now: QUIT creates the boot from inside a terminal mark,
  // and the terminal still draws its region later in that same animation frame.
  let pending = machine.initial;
  const flush = () => { if (pending) { const p = pending; pending = null; apply(p); } };

  return {
    get phase() { return machine.phase; },
    get flavour() { return flavour; },
    get active() { return active; },
    get holdForMusic() { return machine.holdForMusic; },
    /** Advance and draw; call once per animation frame (before screen.render()). */
    frame(now) {
      if (!active) return;
      flush();
      apply(machine.tick(now));
      if (!active) return;
      const scene = bootScene(flavour, machine.phase, machine.elapsed(now), { cols, rows });
      stripeMode = scene.stripes;
      stripeTick = Math.floor(now / 20);
      if (stripeMode) screen.setBorderPainter(painter);
      else {
        screen.setBorderPainter(null);
        screen.setBorder(scene.border);
      }
      if (scene.title) drawTitle(now);
      else if (scene.reveal) drawReveal(scene.reveal);
      else drawText(scene, now);
    },
    /** A key press or tap (the host has already unlocked audio). */
    key(now) {
      if (!active) return;
      flush();
      apply(machine.key(now));
    },
    /** Abort without starting (page teardown). */
    stop() {
      if (!active) return;
      active = false;
      audio.sfxLoop(null);
      titleLayer.set(null);
      screen.setBorderPainter(null);
    },
    setReducedMotion(on) {
      host.reducedMotion = !!on;
      titleLayer.setReducedMotion(!!on);
    },
  };
}
