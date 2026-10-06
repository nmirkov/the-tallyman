// Picture layer: draws a content art def (40x9 location picture on rows 1-9, or a 40x25
// screen) onto the TT-003 screen and animates its fx (src/ui/fx.js) at ~8 frames/s.
// Each fx frame restores only the cells the previous frame changed and then writes the new
// overrides, so text printed over fx-inert cells (ending titles, reserved rows) survives.
import { applyAllFx, cellAt } from './fx.js';

export const PICTURE_TOP = 1;
export const PICTURE_ROWS = 9;
export const DIVIDER_ROW = 10;
export const FX_FPS = 8;

/**
 * Whether an art def has animation to run.
 * @param {{fx?: string[]}|null|undefined} art
 */
export function hasFx(art) {
  return !!art && Array.isArray(art.fx) && art.fx.length > 0;
}

/**
 * Animation tick number for a time (ms) at `fps`.
 * @param {number} now
 * @param {number} [fps=FX_FPS]
 */
export function fxTick(now, fps = FX_FPS) {
  return Math.floor(Math.max(0, now) * fps / 1000);
}

/**
 * Write every cell of an art def onto the screen from row `top`.
 * @param {{put: Function}} screen
 * @param {object} art
 * @param {number} top
 */
export function drawArt(screen, art, top) {
  for (let y = 0; y < art.h; y++) {
    for (let x = 0; x < art.w; x++) {
      const c = cellAt(art, x, y);
      screen.put(x, top + y, c.ch, c.fg, c.bg);
    }
  }
}

/**
 * Draw the divider line under the picture panel (row 10).
 * @param {{fill: Function, cols: number}} screen
 */
export function drawDivider(screen) {
  screen.fill({ x: 0, y: DIVIDER_ROW, w: screen.cols, h: 1 }, '─', 'divider');
}

/**
 * An animated art layer at a fixed top row.
 * @param {{put: Function}} screen
 * @param {{top?: number, fps?: number, reducedMotion?: boolean, seed?: number}} [opts]
 */
export function createArtLayer(screen, opts = {}) {
  const top = opts.top ?? PICTURE_TOP;
  const fps = opts.fps ?? FX_FPS;
  const seed = opts.seed ?? 0;
  let reducedMotion = !!opts.reducedMotion;
  let art = null;
  let lastTick = -1;
  let prev = []; // cells changed by the last fx frame

  function restorePrev() {
    for (const o of prev) {
      const c = cellAt(art, o.x, o.y);
      screen.put(o.x, top + o.y, c.ch, c.fg, c.bg);
    }
    prev = [];
  }

  return {
    get art() { return art; },
    /** Show an art def (null: nothing; the caller owns those rows again). Draws it at once. */
    set(def) {
      art = def ?? null;
      prev = [];
      lastTick = -1;
      if (art) drawArt(screen, art, top);
    },
    /** Redraw the base picture (after a theme change or anything that overwrote the rows). */
    redraw() {
      prev = [];
      lastTick = -1;
      if (art) drawArt(screen, art, top);
    },
    setReducedMotion(on) {
      reducedMotion = !!on;
      if (reducedMotion && art && prev.length) restorePrev();
    },
    /**
     * Advance the animation to time `now`. Returns true when cells changed.
     * @param {number} now  ms
     */
    frame(now) {
      if (!art || reducedMotion || !hasFx(art)) return false;
      const t = fxTick(now, fps);
      if (t === lastTick) return false;
      lastTick = t;
      restorePrev();
      const over = applyAllFx(art, t, seed);
      for (const o of over) screen.put(o.x, top + o.y, o.ch, o.fg, o.bg);
      prev = over;
      return true;
    },
  };
}
