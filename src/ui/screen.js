// 40x25 character-cell screen rendered like a C64/Spectrum: 8x8 glyphs into an offscreen
// 320x200 bitmap (dirty cells only), blitted at the largest integer scale that fits, with
// the remaining area painted in the border colour like a real TV. The pure parts
// (layout math, cell buffer, glyph expansion) are exported for DOM-free unit tests.
import { glyphFor } from './font8x8.js';
import { getTheme, resolveColor, packRGBA } from './palette.js';

export const SCREEN_COLS = 40;
export const SCREEN_ROWS = 25;
export const CELL = 8;
/**
 * Minimum border (in source pixels) per side: half a PAL C64's visible border (32/36).
 * The full border would cost small phones a whole scale step (360 CSS px @2x -> 1x).
 */
export const MIN_BORDER = Object.freeze({ x: 16, y: 18 });

/**
 * @typedef {object} Layout
 * @property {number} scale   device pixels per source pixel (integer unless the area is smaller than the bitmap)
 * @property {number} x       left offset of the bitmap in device pixels
 * @property {number} y       top offset of the bitmap in device pixels
 * @property {number} width   scaled bitmap width
 * @property {number} height  scaled bitmap height
 */

/**
 * Largest integer scale at which the bitmap plus the minimum border fits the area; if even
 * scale 1 with a border does not fit, the border shrinks first; only when the area is
 * smaller than the bitmap itself does the scale go fractional. Bitmap is centred.
 * @param {number} areaW  available width in device pixels
 * @param {number} areaH  available height in device pixels
 * @param {{cols?:number, rows?:number, border?:{x:number,y:number}}} [opts]
 * @returns {Layout}
 */
export function computeLayout(areaW, areaH, { cols = SCREEN_COLS, rows = SCREEN_ROWS, border = MIN_BORDER } = {}) {
  const w = cols * CELL;
  const h = rows * CELL;
  let scale = Math.floor(Math.min(areaW / (w + 2 * border.x), areaH / (h + 2 * border.y)));
  if (scale < 1) scale = Math.floor(Math.min(areaW / w, areaH / h));
  if (scale < 1) scale = Math.max(1 / 8, Math.min(areaW / w, areaH / h));
  const width = w * scale;
  const height = h * scale;
  return {
    scale, width, height,
    x: Math.max(0, Math.floor((areaW - width) / 2)),
    y: Math.max(0, Math.floor((areaH - height) / 2)),
  };
}

/**
 * @typedef {object} Cell
 * @property {string} ch          one code point
 * @property {string|null} fg     colour spec (null = theme 'fg')
 * @property {string|null} bg     colour spec (null = theme 'bg')
 * @property {boolean} inverse
 */

/**
 * @typedef {{x:number, y:number, w:number, h:number}} Rect
 */

/**
 * DOM-free character grid with dirty tracking. Out-of-range writes are clipped silently.
 * @param {number} [cols=40]
 * @param {number} [rows=25]
 */
export function createCellBuffer(cols = SCREEN_COLS, rows = SCREEN_ROWS) {
  const size = cols * rows;
  const ch = new Array(size).fill(' ');
  const fg = new Array(size).fill(null);
  const bg = new Array(size).fill(null);
  const inv = new Uint8Array(size);
  const dirty = new Uint8Array(size).fill(1);
  let dirtyList = Array.from({ length: size }, (_, i) => i);

  const inside = (x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < cols && y < rows;
  const mark = (i) => { if (!dirty[i]) { dirty[i] = 1; dirtyList.push(i); } };
  const firstCp = (c) => {
    const s = c == null || c === '' ? ' ' : typeof c === 'number' ? String.fromCodePoint(c) : String(c);
    return String.fromCodePoint(s.codePointAt(0));
  };

  function setIdx(i, c, f, b, v) {
    if (ch[i] === c && fg[i] === f && bg[i] === b && inv[i] === v) return;
    ch[i] = c; fg[i] = f; bg[i] = b; inv[i] = v;
    mark(i);
  }

  function clip(rect) {
    const r = rect ?? { x: 0, y: 0, w: cols, h: rows };
    const x0 = Math.max(0, r.x | 0);
    const y0 = Math.max(0, r.y | 0);
    const x1 = Math.min(cols, (r.x | 0) + (r.w | 0));
    const y1 = Math.min(rows, (r.y | 0) + (r.h | 0));
    return { x0, y0, x1, y1 };
  }

  const api = {
    cols,
    rows,
    /**
     * @param {number} x @param {number} y
     * @returns {Cell|null}
     */
    get(x, y) {
      if (!inside(x, y)) return null;
      const i = y * cols + x;
      return { ch: ch[i], fg: fg[i], bg: bg[i], inverse: inv[i] === 1 };
    },
    /** Write one character (first code point of `c`); clears the cell's inverse flag. */
    put(x, y, c, f = null, b = null) {
      if (!inside(x, y)) return;
      setIdx(y * cols + x, firstCp(c), f ?? null, b ?? null, 0);
    },
    /**
     * Write a string left to right from (x, y), one code point per cell, clipped at the edge.
     * @returns {number} the column after the last character
     */
    print(x, y, text, f = null, b = null) {
      let cx = x;
      for (const c of String(text)) { api.put(cx, y, c, f, b); cx++; }
      return cx;
    },
    /** Fill a rectangle with one character and colours. */
    fill(rect, c = ' ', f = null, b = null) {
      const { x0, y0, x1, y1 } = clip(rect);
      const cp = firstCp(c);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) setIdx(y * cols + x, cp, f ?? null, b ?? null, 0);
    },
    /** Blank a rectangle (default: whole screen) to spaces in theme colours. */
    clearRegion(rect) {
      api.fill(rect, ' ', null, null);
    },
    /** Scroll rows rowStart..rowEnd (inclusive) up one line; rowEnd becomes blank. */
    scrollUp(rowStart = 0, rowEnd = rows - 1) {
      const a = Math.max(0, rowStart | 0);
      const z = Math.min(rows - 1, rowEnd | 0);
      for (let y = a; y < z; y++) {
        for (let x = 0; x < cols; x++) {
          const s = (y + 1) * cols + x;
          setIdx(y * cols + x, ch[s], fg[s], bg[s], inv[s]);
        }
      }
      if (z >= a) api.fill({ x: 0, y: z, w: cols, h: 1 });
    },
    /** Toggle (or with `on`, set) reverse video for one cell. */
    invert(x, y, on) {
      if (!inside(x, y)) return;
      const i = y * cols + x;
      const v = on === undefined ? inv[i] ^ 1 : on ? 1 : 0;
      setIdx(i, ch[i], fg[i], bg[i], v);
    },
    /** Mark every cell dirty (theme change, full redraw). */
    markAll() {
      for (let i = 0; i < size; i++) mark(i);
    },
    /**
     * Return and reset the list of dirty cell indices (y * cols + x).
     * @returns {number[]}
     */
    takeDirty() {
      const out = dirtyList;
      dirtyList = [];
      for (const i of out) dirty[i] = 0;
      return out;
    },
    /** Raw read access for the renderer. @internal */
    _raw: { ch, fg, bg, inv },
  };
  return api;
}

/**
 * Expand 8 font bytes (LSB = leftmost pixel) into 64 pixel values.
 * @param {ArrayLike<number>} bytes
 * @param {number} fg  packed ink colour
 * @param {number} bg  packed paper colour
 * @returns {Uint32Array}
 */
export function glyphPixels(bytes, fg, bg) {
  const px = new Uint32Array(64);
  for (let r = 0; r < 8; r++) {
    const row = bytes[r];
    for (let c = 0; c < 8; c++) px[r * 8 + c] = (row >> c) & 1 ? fg : bg;
  }
  return px;
}

const GLYPH_CACHE_MAX = 4096;

/**
 * Create a character screen on a canvas. The canvas is sized to fill its container
 * (default: parent element; use a container with a definite size and give the canvas
 * `position:absolute; inset:0` or `display:block`).
 *
 * Colour args (fg/bg/border) are palette keys '0'-'f', role names ('fg', 'bg', 'border',
 * 'statusFg', 'alert', ...) or '#rrggbb'; null/omitted means the theme default. They
 * are resolved at render time, so setTheme() recolours everything already on screen.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {{cols?:number, rows?:number, theme?:string|import('./palette.js').Theme,
 *   border?:{x:number,y:number}, container?:HTMLElement, autoResize?:boolean}} [opts]
 */
export function createScreen(canvas, opts = {}) {
  const cols = opts.cols ?? SCREEN_COLS;
  const rows = opts.rows ?? SCREEN_ROWS;
  const minBorder = opts.border ?? MIN_BORDER;
  const buf = createCellBuffer(cols, rows);
  const W = cols * CELL;
  const H = rows * CELL;
  const { ch, fg, bg, inv } = buf._raw;

  const off = document.createElement('canvas');
  off.width = W;
  off.height = H;
  const offCtx = off.getContext('2d');
  const image = offCtx.createImageData(W, H);
  const pixels = new Uint32Array(image.data.buffer);
  const ctx = canvas.getContext('2d', { alpha: false });
  const cache = new Map();

  let theme = getTheme(opts.theme);
  let borderSpec = null;
  let borderPainter = null;
  let borderDirty = true;
  /** @type {Layout} */
  let layout = computeLayout(canvas.width || W, canvas.height || H, { cols, rows, border: minBorder });

  function drawCell(i) {
    let c = ch[i];
    if (theme.upper && c >= 'a' && c <= 'z') c = c.toUpperCase();
    let f = packRGBA(resolveColor(theme, fg[i], 'fg'));
    let b = packRGBA(resolveColor(theme, bg[i], 'bg'));
    if (inv[i]) [f, b] = [b, f];
    const key = `${c.codePointAt(0)}:${f}:${b}`;
    let px = cache.get(key);
    if (!px) {
      if (cache.size >= GLYPH_CACHE_MAX) cache.clear();
      px = glyphPixels(glyphFor(c), f, b);
      cache.set(key, px);
    }
    const cx = (i % cols) * CELL;
    const cy = Math.floor(i / cols) * CELL;
    for (let r = 0; r < CELL; r++) pixels.set(px.subarray(r * CELL, r * CELL + CELL), (cy + r) * W + cx);
  }

  function paintBorder() {
    ctx.save();
    if (borderPainter) {
      borderPainter(ctx, canvas.width, canvas.height, layout);
    } else {
      ctx.fillStyle = resolveColor(theme, borderSpec ?? 'border', 'border');
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.restore();
    borderDirty = false;
  }

  function blit() {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, W, H, layout.x, layout.y, layout.width, layout.height);
  }

  /**
   * Draw pending changes. Cheap when nothing changed; call once per animation frame.
   * @returns {boolean} whether anything was drawn
   */
  function render() {
    const dirty = buf.takeDirty();
    const needBorder = borderDirty || borderPainter !== null;
    if (!dirty.length && !needBorder) return false;
    if (dirty.length) {
      for (const i of dirty) drawCell(i);
      offCtx.putImageData(image, 0, 0);
    }
    if (needBorder) paintBorder();
    blit();
    return true;
  }

  function sizeSource() {
    const el = opts.container ?? canvas.parentElement;
    if (!el || el === document.body || el === document.documentElement) {
      return { w: window.innerWidth, h: window.innerHeight };
    }
    return { w: el.clientWidth, h: el.clientHeight };
  }

  /** Fit the canvas to its container at the device pixel ratio and re-layout. */
  function resize() {
    const { w, h } = sizeSource();
    const dpr = window.devicePixelRatio || 1;
    const cssW = Math.max(1, Math.floor(w));
    const cssH = Math.max(1, Math.floor(h));
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    layout = computeLayout(canvas.width, canvas.height, { cols, rows, border: minBorder });
    borderDirty = true;
    render();
  }

  let observer = null;
  const onWindowResize = () => resize();
  if (opts.autoResize !== false) {
    const el = opts.container ?? canvas.parentElement;
    if (typeof ResizeObserver === 'function' && el && el !== document.body) {
      observer = new ResizeObserver(onWindowResize);
      observer.observe(el);
    } else {
      window.addEventListener('resize', onWindowResize);
    }
    resize();
  }

  return {
    canvas,
    cols,
    rows,
    get theme() { return theme; },
    get layout() { return layout; },
    get: buf.get,
    put: buf.put,
    print: buf.print,
    fill: buf.fill,
    clearRegion: buf.clearRegion,
    scrollUp: buf.scrollUp,
    invert: buf.invert,
    /** Set the border colour (key/role/hex); null restores the theme border. */
    setBorder(spec) {
      if (spec === borderSpec) return;
      borderSpec = spec ?? null;
      borderDirty = true;
    },
    /**
     * Take over border painting (e.g. tape-loading stripes); called on every render()
     * with (ctx, canvasW, canvasH, layout). Pass null to restore the plain border.
     */
    setBorderPainter(fn) {
      borderPainter = typeof fn === 'function' ? fn : null;
      borderDirty = true;
    },
    /** Switch theme ('c64' | 'spectrum' | 'amber' | theme object); redraws everything. */
    setTheme(t) {
      theme = getTheme(t);
      cache.clear();
      buf.markAll();
      borderDirty = true;
    },
    render,
    resize,
    /** Detach resize listeners. */
    destroy() {
      observer?.disconnect();
      window.removeEventListener('resize', onWindowResize);
    },
  };
}
