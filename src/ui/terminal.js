// The text region of the 40x25 screen, behaving like an 8-bit adventure terminal:
// word-wrapped output that types itself out, [MORE] paging, an editable input line with a
// blinking block cursor, command history, view-only scrollback and an accessible DOM
// transcript (PLAN §3.6/§3.7, ARCHITECTURE A9, A10.3).
//
// Split in two: `createTerminalCore` is pure state (injected clock, no DOM) and is what the
// unit tests drive; `createTerminal` is the thin browser adapter that feeds it keys and
// time and copies its composed view onto a TT-003 screen.
import { wrapText } from './wrap.js';
import { CURSOR } from './font8x8.js';

export const PROMPT = '> ';
export const MORE_TEXT = '[MORE]';
export const TERMINAL_DEFAULTS = Object.freeze({
  cols: 40,
  rate: 400, // characters per second
  maxInput: 120,
  historySize: 50,
  scrollback: 500,
  blinkHz: 1.6, // C64 cursor rate
});

/**
 * Longest step the typewriter takes from one tick (ms). The host may stop ticking the
 * terminal for a while (boot / title screen, a background tab); that gap must not be spent
 * as typing budget on the next frame (TT-106).
 */
export const MAX_TICK_MS = 100;

const STYLE_ROLES = Object.freeze({
  normal: 'fg', title: 'title', alert: 'alert', whisper: 'whisper', echo: 'echo', system: 'system',
});

const MODIFIER_KEYS = new Set([
  'Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock', 'NumLock', 'ScrollLock', 'Fn', 'OS',
  'Dead', 'Unidentified', 'Process', 'Compose',
]);

// ---------------------------------------------------------------- pure helpers

/**
 * Theme colour role for an Output Event text style (A9.1); unknown/omitted = 'fg'.
 * @param {string} [style]
 * @returns {string}
 */
export function styleRole(style) {
  return typeof style === 'string' && Object.hasOwn(STYLE_ROLES, style) ? STYLE_ROLES[style] : 'fg';
}

/**
 * Screen rows owned by the terminal (PLAN §3.6): 11-24 under the picture panel, 1-24
 * with GRAPHICS OFF. Row 0 is the status bar. The bottom row is the input line.
 * @param {boolean} graphics
 * @returns {{top:number, bottom:number}}
 */
export function regionFor(graphics) {
  return graphics ? { top: 11, bottom: 24 } : { top: 1, bottom: 24 };
}

/**
 * Rows available for output text (the region minus the input line).
 * @param {{top:number, bottom:number}} region
 */
export function outputRows(region) {
  return region.bottom - region.top;
}

/**
 * Paging rule: once a full page of lines has appeared since the player last pressed a
 * key, the next line must wait behind [MORE].
 * @param {number} linesSinceInput
 * @param {number} rows  output rows in the region
 */
export function needsMore(linesSinceInput, rows) {
  return linesSinceInput >= rows;
}

/**
 * Typewriter scheduler step: whole characters due after `elapsedMs` at `rate` chars/s,
 * carrying the fraction to the next frame so the speed is exact at any frame rate.
 * @param {number} carry
 * @param {number} elapsedMs
 * @param {number} rate
 * @returns {{chars:number, carry:number}}
 */
export function typeBudget(carry, elapsedMs, rate) {
  const total = carry + (Math.max(0, elapsedMs) * rate) / 1000;
  const chars = Math.floor(total);
  return { chars, carry: total - chars };
}

/**
 * Whether a blinking element is in its visible half-period.
 * @param {number} now     ms
 * @param {number} epoch   ms at which the blink (re)started in the "on" phase
 * @param {number} [hz=1.6]
 */
export function blinkOn(now, epoch, hz = TERMINAL_DEFAULTS.blinkHz) {
  return Math.floor((Math.max(0, now - epoch) * hz * 2) / 1000) % 2 === 0;
}

const CHAR_MAP = new Map([
  ['‘', "'"], ['’', "'"], ['‚', "'"], ['‛', "'"], ['′', "'"], ['´', "'"], ['`', "'"],
  ['“', '"'], ['”', '"'], ['„', '"'], ['‟', '"'], ['″', '"'],
  ['–', '-'], ['—', '-'], ['−', '-'],
  ['\t', ' '], [' ', ' '],
]);

/**
 * Reduce typed/pasted text to what the font can show on the input line: printable ASCII
 * and `£`. Smart quotes and dashes from phone keyboards become their ASCII forms.
 * @param {string} s
 * @returns {string}
 */
export function sanitiseInput(s) {
  let out = '';
  for (let c of String(s ?? '')) {
    c = CHAR_MAP.get(c) ?? c;
    const cp = c.codePointAt(0);
    if ((cp >= 0x20 && cp <= 0x7e) || c === '£') out += c;
  }
  return out;
}

/**
 * @typedef {{text:string, cursor:number}} InputState
 * @typedef {{op:'insert', text:string}|{op:'backspace'|'delete'|'left'|'right'|'home'|'end'}} EditAction
 */

/**
 * Apply one line-editing operation. Pure; returns a new state (or the same one for a no-op).
 * @param {InputState} s
 * @param {EditAction} a
 * @param {number} [max=120]
 * @returns {InputState}
 */
export function editInput(s, a, max = TERMINAL_DEFAULTS.maxInput) {
  const { text, cursor } = s;
  switch (a.op) {
    case 'insert': {
      const add = sanitiseInput(a.text).slice(0, Math.max(0, max - text.length));
      if (!add) return s;
      return { text: text.slice(0, cursor) + add + text.slice(cursor), cursor: cursor + add.length };
    }
    case 'backspace':
      return cursor > 0 ? { text: text.slice(0, cursor - 1) + text.slice(cursor), cursor: cursor - 1 } : s;
    case 'delete':
      return cursor < text.length ? { text: text.slice(0, cursor) + text.slice(cursor + 1), cursor } : s;
    case 'left':
      return cursor > 0 ? { text, cursor: cursor - 1 } : s;
    case 'right':
      return cursor < text.length ? { text, cursor: cursor + 1 } : s;
    case 'home':
      return cursor ? { text, cursor: 0 } : s;
    case 'end':
      return cursor !== text.length ? { text, cursor: text.length } : s;
    default:
      return s;
  }
}

/**
 * Horizontal scroll of the input line: the first visible character index, moved only as
 * far as needed to keep the cursor (which may sit one past the end) inside `width` cells.
 * @param {number} len     input length
 * @param {number} cursor
 * @param {number} width   visible columns
 * @param {number} offset  previous offset
 * @returns {number}
 */
export function inputWindow(len, cursor, width, offset) {
  let o = offset;
  if (cursor < o) o = cursor;
  if (cursor >= o + width) o = cursor - width + 1;
  return Math.max(0, Math.min(o, len + 1 - width));
}

/**
 * Command history for ↑/↓: newest last, blanks and immediate repeats skipped, capped.
 * Walking up from the live line saves it as a draft that ↓ past the newest restores.
 * @param {number} [max=50]
 */
export function createHistory(max = TERMINAL_DEFAULTS.historySize) {
  const entries = [];
  let idx = 0;
  let draft = '';
  return {
    get entries() { return entries.slice(); },
    /** Record a submitted line and reset the walk. */
    push(line) {
      if (line.trim() && line !== entries[entries.length - 1]) {
        entries.push(line);
        if (entries.length > max) entries.splice(0, entries.length - max);
      }
      idx = entries.length;
      draft = '';
    },
    /** Older entry, or null at the oldest. @param {string} current live line */
    prev(current) {
      if (idx === entries.length) draft = current;
      if (idx === 0) return null;
      idx--;
      return entries[idx];
    },
    /** Newer entry (the draft past the newest), or null when already on the live line. */
    next() {
      if (idx >= entries.length) return null;
      idx++;
      return idx === entries.length ? draft : entries[idx];
    },
  };
}

// ---------------------------------------------------------------- pure core

/**
 * @typedef {object} ViewCell
 * @property {string} ch
 * @property {string} role     theme colour role
 * @property {boolean} inverse
 */

/**
 * @typedef {object} TerminalOptions
 * @property {number} [cols=40]
 * @property {boolean} [graphics=true]       picture panel shown (region rows 11-24) or not (1-24)
 * @property {boolean} [typewriter=true]
 * @property {boolean} [reducedMotion=false] instant text, no blinking
 * @property {number} [rate=400]             typewriter chars/s
 * @property {number} [maxInput=120]
 * @property {number} [historySize=50]
 * @property {number} [scrollback=500]
 * @property {number} [blinkHz=1.6]
 * @property {(line:string) => void} [onSubmit]
 * @property {(kind:'char'|'delete'|'move'|'enter'|'more'|'skip') => void} [onKey]  key-click SFX hook
 * @property {() => void} [onIdle]           output finished, input line live again
 */

/**
 * DOM-free terminal state machine. Output calls (`print`, `clear`, `pause`, `mark`) are
 * queued and played back by `tick(now)` in order (A9.2 O1); `key()` / `setInput()` feed
 * input; `compose(now)` returns the region as rows of cells for any renderer.
 * @param {TerminalOptions} [opts]
 */
export function createTerminalCore(opts = {}) {
  const cfg = { ...TERMINAL_DEFAULTS, ...Object.fromEntries(Object.entries(opts).filter(([, v]) => v !== undefined)) };
  const { cols, maxInput } = cfg;
  const inputWidth = cols - PROMPT.length;
  const history = createHistory(cfg.historySize);

  let region = regionFor(cfg.graphics ?? true);
  /** The command echo counts towards [MORE] paging (off on tiny regions such as the ending screen). */
  let echoPages = true;
  let typewriter = cfg.typewriter ?? true;
  let reducedMotion = !!cfg.reducedMotion;
  let rate = cfg.rate;

  /** @type {{chars:string[], style:string}[]} */
  const lines = [];
  let clearMark = 0; // first line index shown at the bottom view since the last clear
  const queue = [];
  let typing = null; // { line, full }
  let carry = 0;
  let last = null;
  let now = 0;
  let pauseUntil = null;
  let skipping = false;
  let more = false;
  let linesSinceInput = 0;
  let lastQueued = null; // last line in output order, null right after a clear
  /** @type {InputState} */
  let input = { text: '', cursor: 0 };
  let inputOffset = 0;
  let inputEnabled = true;
  let scrollOffset = 0;
  let blinkEpoch = 0;
  let wasReady = true;
  let version = 0;

  const busy = () => more || typing !== null || queue.length > 0;
  const ready = () => !busy();
  const rows = () => outputRows(region);
  const maxScroll = () => Math.max(0, lines.length - rows());
  const emitKey = (kind) => cfg.onKey?.(kind);

  function enqueueLine(text, style, { count = true, instant = false } = {}) {
    queue.push({ t: 'line', text, style, count, instant });
    lastQueued = { text, style };
  }

  function pushLine(line) {
    lines.push(line);
    if (lines.length > cfg.scrollback) {
      lines.shift();
      clearMark = Math.max(0, clearMark - 1);
    }
    if (scrollOffset) scrollOffset = Math.min(scrollOffset + 1, maxScroll()); // keep the view still
  }

  function setInputState(next) {
    if (next === input) return false;
    input = next;
    inputOffset = inputWindow(input.text.length, input.cursor, inputWidth, inputOffset);
    blinkEpoch = now;
    version++;
    return true;
  }

  function submit() {
    const line = input.text;
    history.push(line);
    if (lastQueued && lastQueued.text !== '') enqueueLine('', 'normal', { count: false, instant: true });
    linesSinceInput = 0;
    for (const l of wrapText(PROMPT + line, cols)) enqueueLine(l, 'echo', { instant: true, count: echoPages });
    setInputState({ text: '', cursor: 0 });
    emitKey('enter');
    cfg.onSubmit?.(line);
  }

  function continueMore() {
    more = false;
    linesSinceInput = 1; // the last line of the page stays as context
    version++;
  }

  const core = {
    // ------------------------------------------------ output (queued, in order)
    /**
     * Queue text in a style ('normal'|'title'|'alert'|'whisper'|'echo'|'system'). Wrapped
     * at the region width; a title gets a blank line above it unless it opens the region
     * or follows a blank / command echo.
     */
    print(text, style = 'normal') {
      const st = style ?? 'normal';
      if (st === 'title' && lastQueued && lastQueued.text !== '' && lastQueued.style !== 'echo') enqueueLine('', 'normal');
      for (const l of wrapText(text, cols)) enqueueLine(l, st);
    },
    /** Queue a clear of the region (scrollback keeps the old lines). */
    clear() {
      queue.push({ t: 'clear' });
      lastQueued = null;
    },
    /** Queue a pause (event `pause`); any key skips it. */
    pause(ms) {
      queue.push({ t: 'pause', ms: Math.max(0, Number(ms) || 0) });
    },
    /** Queue a callback that runs when the output reaches this point (sfx, picture, status). */
    mark(fn) {
      if (typeof fn === 'function') queue.push({ t: 'mark', fn });
    },

    // ------------------------------------------------ clock
    /** Advance the typewriter / pauses to time `now` (ms, monotonic). */
    tick(t) {
      now = t;
      if (last === null) last = t;
      const elapsed = Math.min(MAX_TICK_MS, t - last);
      last = t;
      const instant = !typewriter || reducedMotion || skipping;
      let budget;
      if (instant) budget = Infinity;
      else ({ chars: budget, carry } = typeBudget(carry, elapsed, rate));
      let changed = false;

      for (;;) {
        if (more) { carry = 0; break; }
        if (typing) {
          const shown = typing.line.chars.length;
          const n = Math.min(typing.full.length - shown, budget);
          if (n > 0) {
            typing.line.chars.push(...typing.full.slice(shown, shown + n));
            budget -= n;
            changed = true;
          }
          if (typing.line.chars.length < typing.full.length) break;
          typing = null;
          continue;
        }
        const item = queue[0];
        if (!item) { skipping = false; carry = 0; break; }
        if (item.t === 'clear') {
          queue.shift();
          clearMark = lines.length;
          linesSinceInput = 0;
          scrollOffset = 0;
          changed = true;
          continue;
        }
        if (item.t === 'mark') {
          queue.shift();
          try { item.fn(); } catch (err) { queueMicrotask(() => { throw err; }); }
          continue;
        }
        if (item.t === 'pause') {
          if (!skipping) {
            if (pauseUntil === null) pauseUntil = t + item.ms;
            if (t < pauseUntil) { carry = 0; break; }
          }
          queue.shift();
          pauseUntil = null;
          continue;
        }
        if (item.count && needsMore(linesSinceInput, rows())) {
          more = true;
          skipping = false;
          blinkEpoch = t;
          changed = true;
          continue; // loop exits at the top
        }
        if (!item.instant && budget < 1) break;
        queue.shift();
        const line = { chars: [], style: item.style };
        pushLine(line);
        if (item.count) linesSinceInput++;
        changed = true;
        const full = Array.from(item.text);
        if (item.instant) { line.chars = full; continue; }
        if (!full.length) { budget -= 1; continue; } // a blank line costs one character
        typing = { line, full };
      }

      if (changed) version++;
      const r = ready();
      if (r && !wasReady) {
        blinkEpoch = t;
        version++;
        cfg.onIdle?.();
      }
      wasReady = r;
    },

    /**
     * Forget the previous tick time: the next tick counts as no elapsed time. Call when the
     * terminal resumes after not being ticked (e.g. a new game after the title screen).
     */
    resetClock() {
      last = null;
      carry = 0;
    },

    // ------------------------------------------------ input
    /**
     * Handle one key (KeyboardEvent.key names). Returns true when the key was used, so the
     * adapter can preventDefault. Precedence: PgUp/PgDn scroll; while scrolled back any key
     * returns to the bottom; [MORE] takes any key; while output plays any key fast-forwards
     * (printable keys other than space are kept as type-ahead); else line editing.
     * @param {string} k
     * @param {{ctrl?:boolean, alt?:boolean, meta?:boolean}} [mods]
     */
    key(k, mods = {}) {
      if (typeof k !== 'string' || MODIFIER_KEYS.has(k)) return false;
      if (mods.ctrl || mods.alt || mods.meta) return false; // leave browser shortcuts alone
      if (k === 'PageUp' || k === 'PageDown') {
        const step = Math.max(1, rows() - 1);
        const next = k === 'PageUp' ? Math.min(maxScroll(), scrollOffset + step) : Math.max(0, scrollOffset - step);
        if (next !== scrollOffset) { scrollOffset = next; version++; }
        emitKey('move');
        return true;
      }
      if (scrollOffset > 0) { scrollOffset = 0; version++; return true; }
      if (more) { continueMore(); emitKey('more'); return true; }
      const printable = k.length === 1 && sanitiseInput(k) !== '';
      if (busy()) {
        skipping = true;
        if (printable && k !== ' ' && inputEnabled) setInputState(editInput(input, { op: 'insert', text: k }, maxInput));
        emitKey('skip');
        return true;
      }
      if (!inputEnabled) return false;
      const edit = (op, kind) => { setInputState(editInput(input, { op }, maxInput)); emitKey(kind); return true; };
      switch (k) {
        case 'Enter': submit(); return true;
        case 'Backspace': return edit('backspace', 'delete');
        case 'Delete': return edit('delete', 'delete');
        case 'ArrowLeft': return edit('left', 'move');
        case 'ArrowRight': return edit('right', 'move');
        case 'Home': return edit('home', 'move');
        case 'End': return edit('end', 'move');
        case 'ArrowUp':
        case 'ArrowDown': {
          const h = k === 'ArrowUp' ? history.prev(input.text) : history.next();
          if (h !== null) setInputState({ text: h, cursor: h.length });
          emitKey('move');
          return true;
        }
        default:
          if (!printable) return false;
          setInputState(editInput(input, { op: 'insert', text: k }, maxInput));
          emitKey('char');
          return true;
      }
    },
    /**
     * Mirror a native text field (mobile soft keyboard). The value is sanitised and
     * clamped; while [MORE] waits, the change only continues the output.
     * @param {string} text
     * @param {number} [cursor]
     */
    setInput(text, cursor) {
      if (scrollOffset > 0) { scrollOffset = 0; version++; }
      if (more) { continueMore(); emitKey('more'); return; }
      if (!inputEnabled) return;
      if (busy()) skipping = true;
      const clean = sanitiseInput(text).slice(0, maxInput);
      const c = Math.max(0, Math.min(clean.length, cursor ?? clean.length));
      if (clean === input.text && c === input.cursor) return;
      const kind = clean.length > input.text.length ? 'char' : clean.length < input.text.length ? 'delete' : 'move';
      setInputState({ text: clean, cursor: c });
      emitKey(kind);
    },
    /** Empty the input line (a new screen such as the ending prompt drops type-ahead). */
    clearInput() {
      setInputState({ text: '', cursor: 0 });
    },
    /** Enable/disable the input line (e.g. while a file picker is open). */
    setInputEnabled(on) {
      inputEnabled = !!on;
      version++;
    },

    // ------------------------------------------------ settings
    /** GRAPHICS ON/OFF: the region is rows 11-24 or 1-24. */
    setGraphics(on) {
      core.setRegion(regionFor(!!on));
    },
    /**
     * Use an explicit region ({top, bottom} rows, bottom = input line). `echoPages: false`
     * keeps the command echo out of the [MORE] count, so a two-row answer on a three-row
     * region needs no [MORE] (the echo scrolls off instead). Defaults to true.
     * @param {{top:number, bottom:number, echoPages?: boolean}} r
     */
    setRegion(r) {
      region = { top: r.top, bottom: r.bottom };
      echoPages = r.echoPages !== false;
      scrollOffset = Math.min(scrollOffset, maxScroll());
      version++;
    },
    setTypewriter(on) { typewriter = !!on; },
    setReducedMotion(on) { reducedMotion = !!on; version++; },
    /** Typewriter speed in characters per second. */
    setRate(cps) { if (cps > 0) rate = cps; },

    // ------------------------------------------------ view
    /**
     * The region as rows of cells: output rows then the bottom row (input line, [MORE],
     * or the scrollback notice).
     * @param {number} [at=now]
     * @returns {{top:number, rows:ViewCell[][]}}
     */
    compose(at = now) {
      const h = rows();
      const end = lines.length - scrollOffset;
      const start = scrollOffset ? Math.max(0, end - h) : Math.max(clearMark, end - h);
      const out = [];
      const blank = () => Array.from({ length: cols }, () => ({ ch: ' ', role: 'fg', inverse: false }));
      for (let r = 0; r < h; r++) {
        const row = blank();
        const line = start + r < end ? lines[start + r] : null;
        if (line) {
          const role = styleRole(line.style);
          line.chars.forEach((ch, x) => { if (x < cols) row[x] = { ch, role, inverse: false }; });
        }
        out.push(row);
      }
      const bottom = blank();
      const write = (x, s, role, inverse = false) => {
        for (const ch of s) { if (x < cols) bottom[x] = { ch, role, inverse }; x++; }
        return x;
      };
      const on = reducedMotion || blinkOn(at, blinkEpoch, cfg.blinkHz);
      if (scrollOffset) {
        write(0, `[BACK ${scrollOffset}] PGDN OR ANY KEY`, 'system');
      } else if (more) {
        // reverse video: the theme's system colour alone can match body text (Spectrum: black)
        if (on) write(0, MORE_TEXT, 'system', true);
      } else if (ready() && inputEnabled) {
        const x0 = write(0, PROMPT, 'echo');
        write(x0, input.text.slice(inputOffset, inputOffset + inputWidth), 'echo');
        if (on) {
          const cx = x0 + input.cursor - inputOffset;
          if (input.cursor < input.text.length) bottom[cx] = { ...bottom[cx], inverse: true };
          else if (cx < cols) bottom[cx] = { ch: CURSOR, role: 'cursor', inverse: false };
        }
      }
      out.push(bottom);
      return { top: region.top, rows: out };
    },
    /** Changes whenever compose() would return something different. */
    frameKey(at = now) {
      const blinking = !reducedMotion && !scrollOffset && (more || (ready() && inputEnabled));
      return `${version}:${blinking ? blinkOn(at, blinkEpoch, cfg.blinkHz) : '-'}`;
    },

    get busy() { return busy(); },
    get ready() { return ready(); },
    get more() { return more; },
    get input() { return { text: input.text, cursor: input.cursor }; },
    get inputEnabled() { return inputEnabled; },
    get scrollOffset() { return scrollOffset; },
    get lineCount() { return lines.length; },
    get region() { return { ...region }; },
    get history() { return history.entries; },
    get version() { return version; },
  };
  return core;
}

/**
 * The modifier flags `core.key` should see for a keydown. AltGr (reported as Ctrl+Alt on
 * Windows) types characters such as '@' or '£' on many European layouts: those are text,
 * not shortcuts, so they are passed without ctrl/alt (TT-106).
 * @param {{key?: string, ctrlKey?: boolean, altKey?: boolean, metaKey?: boolean,
 *   getModifierState?: (k: string) => boolean}} e
 * @returns {{ctrl: boolean, alt: boolean, meta: boolean}}
 */
export function keyMods(e) {
  const meta = !!e.metaKey;
  const k = typeof e.key === 'string' ? e.key : '';
  const altGraph = !!e.getModifierState?.('AltGraph')
    || (!!e.ctrlKey && !!e.altKey && !meta && Array.from(k).length === 1 && !/^[a-z0-9]$/i.test(k));
  if (altGraph && Array.from(k).length === 1) return { ctrl: false, alt: false, meta };
  return { ctrl: !!e.ctrlKey, alt: !!e.altKey, meta };
}

/**
 * Whether a keydown counts as "press any key" (ending text, title): a fresh press, not an
 * auto-repeat, not a lone modifier, not a browser shortcut or function key (TT-106).
 * @param {{key?: string, repeat?: boolean, ctrlKey?: boolean, altKey?: boolean, metaKey?: boolean}} e
 */
export function isAnyKeyPress(e) {
  const k = typeof e.key === 'string' ? e.key : '';
  if (!k || e.repeat || MODIFIER_KEYS.has(k) || /^F\d+$/.test(k)) return false;
  return !e.ctrlKey && !e.altKey && !e.metaKey;
}

// ---------------------------------------------------------------- browser adapter

const HIDDEN_CSS = 'position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;'
  + 'overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:pre-wrap;';
const FIELD_CSS = 'position:fixed;left:0;top:0;width:1px;height:1px;padding:0;margin:0;border:0;'
  + 'opacity:0;font-size:16px;background:transparent;color:transparent;caret-color:transparent;outline:none;';
const TRANSCRIPT_MAX = 400;

/**
 * Attach a terminal to a TT-003 screen. Owns: keyboard handling, a hidden <input> for
 * soft keyboards (tap the canvas to focus), a visually hidden `role=log` transcript, a
 * `visualViewport` listener so the canvas rescales when an on-screen keyboard opens, and
 * (unless `autoLoop:false`) a requestAnimationFrame loop calling `frame()` + `screen.render()`.
 *
 * @param {ReturnType<import('./screen.js').createScreen>} screen
 * @param {TerminalOptions & {
 *   keyTarget?: EventTarget, transcriptParent?: HTMLElement, viewportContainer?: HTMLElement|null,
 *   autoLoop?: boolean }} [opts]
 */
export function createTerminal(screen, opts = {}) {
  const doc = screen.canvas.ownerDocument;
  const win = doc.defaultView;
  const mq = win.matchMedia?.('(prefers-reduced-motion: reduce)');
  const idleWaiters = [];

  const log = doc.createElement('div');
  log.setAttribute('role', 'log');
  log.setAttribute('aria-live', 'polite');
  log.setAttribute('aria-label', 'Game transcript');
  log.style.cssText = HIDDEN_CSS;
  (opts.transcriptParent ?? doc.body).append(log);
  const transcript = (text, style) => {
    const p = doc.createElement('p');
    p.textContent = text;
    if (style && style !== 'normal') p.dataset.style = style;
    log.append(p);
    while (log.childElementCount > TRANSCRIPT_MAX) log.firstElementChild.remove();
  };

  const core = createTerminalCore({
    ...opts,
    cols: screen.cols,
    reducedMotion: opts.reducedMotion ?? !!mq?.matches,
    onSubmit: (line) => { transcript(PROMPT + line, 'echo'); opts.onSubmit?.(line); },
    onIdle: () => { idleWaiters.splice(0).forEach((r) => r()); opts.onIdle?.(); },
  });

  const field = doc.createElement('input');
  Object.entries({
    type: 'text', autocapitalize: 'off', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false',
    enterkeyhint: 'send', inputmode: 'text', maxlength: String(opts.maxInput ?? TERMINAL_DEFAULTS.maxInput),
    'aria-label': 'Command',
  }).forEach(([k, v]) => field.setAttribute(k, v));
  field.style.cssText = FIELD_CSS;
  doc.body.append(field);

  function syncField() {
    const { text, cursor } = core.input;
    if (field.value !== text) field.value = text;
    if (doc.activeElement === field && (field.selectionStart !== cursor || field.selectionEnd !== cursor)) {
      try { field.setSelectionRange(cursor, cursor); } catch { /* not focusable yet */ }
    }
  }

  const focus = () => { try { field.focus({ preventScroll: true }); } catch { field.focus(); } };

  const onKeyDown = (e) => {
    if (e.isComposing || e.keyCode === 229) return; // soft keyboards: the input event carries it
    const t = e.target;
    if (t !== field && t?.closest?.('input, textarea, select, button, [contenteditable]')) return;
    if (core.key(e.key, keyMods(e))) {
      e.preventDefault();
      syncField();
    }
  };
  const onFieldInput = () => {
    core.setInput(field.value, field.selectionStart ?? field.value.length);
    syncField();
  };
  const onPaste = (e) => {
    if (e.target === field) return; // the field's own input event handles it
    const text = e.clipboardData?.getData('text') ?? '';
    if (!text) return;
    e.preventDefault();
    const { text: cur, cursor } = core.input;
    core.setInput(cur.slice(0, cursor) + text.replace(/\s+/g, ' ') + cur.slice(cursor), cursor + text.length);
    syncField();
  };
  const onTap = () => {
    if (!core.ready || core.scrollOffset) core.key(' '); // a tap is "any key" for MORE / skip
    focus();
    syncField();
  };

  const keyTarget = opts.keyTarget ?? win;
  keyTarget.addEventListener('keydown', onKeyDown);
  win.addEventListener('paste', onPaste);
  field.addEventListener('input', onFieldInput);
  screen.canvas.addEventListener('click', onTap);

  const vv = win.visualViewport;
  const vvTarget = opts.viewportContainer === undefined ? screen.canvas.parentElement : opts.viewportContainer;
  const onViewport = () => {
    if (vvTarget && vvTarget !== doc.body) vvTarget.style.height = `${Math.round(vv.height)}px`;
    if (win.scrollY) win.scrollTo(0, 0);
    screen.resize();
  };
  vv?.addEventListener('resize', onViewport);
  const onMotion = (e) => core.setReducedMotion(opts.reducedMotion ?? e.matches);
  mq?.addEventListener?.('change', onMotion);

  let drawnKey = '';
  /** Optional colour override ({paper, roles}) for screens with their own paper (TT-012 endings). */
  let colors = null;
  /** Advance and draw the region; call once per animation frame when `autoLoop` is off. */
  function frame(now = win.performance.now()) {
    core.tick(now);
    const k = core.frameKey(now);
    if (k === drawnKey) return;
    drawnKey = k;
    const { top, rows } = core.compose(now);
    const paper = colors?.paper ?? null;
    rows.forEach((cells, r) => cells.forEach((c, x) => {
      screen.put(x, top + r, c.ch, colors?.roles?.[c.role] ?? c.role, paper);
      if (c.inverse) screen.invert(x, top + r, true);
    }));
  }

  let raf = 0;
  const loop = (now) => { frame(now); screen.render(); raf = win.requestAnimationFrame(loop); };
  if (opts.autoLoop !== false) raf = win.requestAnimationFrame(loop);

  return {
    core,
    field,
    transcript: log,
    /** Queue text (A9.1 `text` event) and mirror it to the transcript. */
    print(text, style = 'normal') {
      core.print(text, style);
      transcript(text, style);
    },
    /** Add a line to the transcript only (text drawn outside the terminal region). */
    transcribe: (text, style) => transcript(text, style),
    clear: () => core.clear(),
    pause: (ms) => core.pause(ms),
    mark: (fn) => core.mark(fn),
    setGraphics(on) { core.setGraphics(on); drawnKey = ''; },
    setTypewriter: (on) => core.setTypewriter(on),
    setRate: (cps) => core.setRate(cps),
    setInputEnabled(on) { core.setInputEnabled(on); if (on) syncField(); },
    clearInput() { core.clearInput(); syncField(); },
    /** Force a full redraw of the region on the next frame (e.g. after a theme change). */
    invalidate() { drawnKey = ''; },
    /**
     * Draw the region with other colours: `paper` replaces the theme background and
     * `roles` maps a text role to a colour spec (e.g. on a black ending screen). null restores.
     * @param {{paper?: string, roles?: Record<string,string>}|null} map
     */
    setColors(map) { colors = map ?? null; drawnKey = ''; },
    focus,
    frame,
    /** Resolves when all queued output has been shown and the input line is live. */
    whenIdle() {
      return core.ready ? Promise.resolve() : new Promise((r) => idleWaiters.push(r));
    },
    get busy() { return core.busy; },
    get ready() { return core.ready; },
    destroy() {
      win.cancelAnimationFrame(raf);
      keyTarget.removeEventListener('keydown', onKeyDown);
      win.removeEventListener('paste', onPaste);
      field.removeEventListener('input', onFieldInput);
      screen.canvas.removeEventListener('click', onTap);
      vv?.removeEventListener('resize', onViewport);
      mq?.removeEventListener?.('change', onMotion);
      field.remove();
      log.remove();
    },
  };
}
