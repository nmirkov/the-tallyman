// Animated picture effects (PLAN §3.5 `fx`): pure functions from (art, effect, tick) to
// cell overrides. No state, no Math.random and no clock: the same arguments always give
// the same frame, so the game's picture panel, tools/art-preview.js and the tests share one
// implementation. A tick is one animation step; the UI is expected to run ~10 per second.
//
// Conventions the effects rely on (TT-019 style rules):
// - a cell whose char is ' ' is open air: fog drifts in it, and lightning lights it when it
//   is connected to the top edge (so black doors and windows inside a shape stay dark). Rain
//   streaks over ' ' and solid '█' cells only, so detail cells (windows, text, edges,
//   dithers) never flicker. Solid surfaces are drawn with '█', never ' '.
// - art without `bg` has black paper ('0').
import { ART_FX } from '../engine/types.js';
import { cellAt, fxMayChange, DARK_KEYS, SKY_KEYS, EDGE_GLYPHS, FLICKER_RAMP } from '../shared/art-cells.js';

export { cellAt, fxMayChange };

/**
 * @typedef {import('../shared/art-cells.js').ArtCell} ArtCell
 * @typedef {{x: number, y: number, ch: string, fg: string, bg: string}} FxOverride  full cell value
 * @typedef {number | ((...ints: number[]) => number)} FxRng  integer seed, or a PURE hash of
 *   integers to [0, 1) (never a stateful generator: frames must stay a function of the tick)
 */

/** Order in which applyAllFx layers effects: later ones see (and may restyle) earlier ones. */
export const FX_ORDER = Object.freeze(['lightning', 'rain', 'fog', 'flicker']);

/** Rain streak glyph: falls one row down and one column left per step, like the glyph. */
export const RAIN_GLYPH = '╱';

const LIGHT_KEYS = new Set(['1', '3', '7', 'c', 'd', 'e', 'f']);

/**
 * Integer hash to [0, 1) (murmur3 finaliser per argument).
 * @param {...number} ns
 * @returns {number}
 */
export function hash01(...ns) {
  let h = 0x9e3779b9;
  for (const n of ns) {
    h = Math.imul(h ^ (n | 0), 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
  }
  return (h >>> 0) / 4294967296;
}

function rngFn(rng) {
  if (typeof rng === 'function') return rng;
  const seed = Number.isFinite(rng) ? rng | 0 : 0;
  return (...ns) => hash01(seed, ...ns);
}

const mod = (a, n) => ((a % n) + n) % n;

/** A cell lookup over an art def plus already-applied overrides. */
function viewOf(art, overrides) {
  const over = new Map(overrides.map((o) => [o.y * art.w + o.x, o]));
  return (x, y) => over.get(y * art.w + x) ?? cellAt(art, x, y);
}

function rain(art, cell, tick, rnd) {
  const { w, h } = art;
  const drops = Math.round((w * h) / 3);
  const period = h + 4;
  const out = new Map(); // one streak per cell even when two drops meet
  for (let i = 0; i < drops; i++) {
    const speed = rnd(1, i) < 0.6 ? 1 : 2;
    const travel = Math.floor(rnd(2, i) * period * 16) + tick * speed;
    const y = mod(travel, period) - 2;
    if (y < 0 || y >= h) continue;
    const x = mod(Math.floor(rnd(3, i) * w) - travel, w);
    const c = cell(x, y);
    const paper = c.ch === ' ' ? c.bg : c.ch === '█' ? c.fg : null;
    if (paper === null) continue;
    if (!out.has(y * w + x)) out.set(y * w + x, { x, y, ch: RAIN_GLYPH, fg: LIGHT_KEYS.has(paper) ? '6' : 'e', bg: paper });
  }
  return [...out.values()];
}

function lightning(art, cell, tick, rnd) {
  const period = 90;
  const cycle = Math.floor(tick / period);
  const t = mod(tick, period);
  const at = 6 + Math.floor(rnd(11, cycle) * (period - 14));
  const flash = t === at ? '1' : t === at + 2 ? 'f' : t === at + 3 ? 'c' : null;
  if (!flash) return [];
  // light the open air connected to the top edge (sky, street) and the edges touching it;
  // closed black shapes (doors, windows, interiors) stay dark
  const { w, h } = art;
  const skyKey = (c) => SKY_KEYS.has(c.bg);
  const lit = new Uint8Array(w * h);
  const queue = [];
  for (let x = 0; x < w; x++) queue.push([x, 0]);
  while (queue.length) {
    const [x, y] = queue.pop();
    if (x < 0 || y < 0 || x >= w || y >= h || lit[y * w + x]) continue;
    const c = cell(x, y);
    if (!skyKey(c)) continue;
    if (c.ch === ' ') {
      lit[y * w + x] = 1;
      queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    } else if (EDGE_GLYPHS.has(c.ch)) lit[y * w + x] = 2;
  }
  const out = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!lit[y * w + x]) continue;
      const c = cell(x, y);
      out.push({ x, y, ch: c.ch, fg: c.fg, bg: flash });
    }
  }
  return out;
}

function flicker(art, cell, tick, rnd) {
  const r = rnd(21, tick);
  const level = r < 0.6 ? 0 : r < 0.92 ? 1 : 2;
  if (!level) return [];
  const dim = (k) => (FLICKER_RAMP[k] ? FLICKER_RAMP[k][level - 1] ?? k : k);
  const out = [];
  for (let y = 0; y < art.h; y++) {
    for (let x = 0; x < art.w; x++) {
      const c = cell(x, y);
      const fg = dim(c.fg), bg = dim(c.bg);
      if (fg !== c.fg || bg !== c.bg) out.push({ x, y, ch: c.ch, fg, bg });
    }
  }
  return out;
}

function fog(art, cell, tick, rnd) {
  const { w, h } = art;
  const smooth = (f) => f * f * (3 - 2 * f);
  const out = [];
  for (let y = 0; y < h; y++) {
    const weight = Math.min(1, Math.max(0, ((y + 1) / h) * 1.5 - 0.25));
    for (let x = 0; x < w; x++) {
      const u = x * 0.21 + tick * 0.07 + y * 1.7;
      const i = Math.floor(u);
      const f = smooth(u - i);
      const v = (rnd(31, i, y) * (1 - f) + rnd(31, i + 1, y) * f) * weight;
      if (v < 0.36) continue;
      const c = cell(x, y);
      const base = c.ch === ' ' ? c.bg : c.ch === '█' ? c.fg : null;
      if (base === null || !DARK_KEYS.has(base)) continue;
      out.push({ x, y, ch: v < 0.6 ? '░' : '▒', fg: base === 'b' ? 'c' : 'b', bg: base });
    }
  }
  return out;
}

const EFFECTS = { rain, lightning, flicker, fog };

/**
 * Cell overrides for one effect at one tick. Deterministic: same (art, fxId, tick, rng) gives
 * the same list. Overrides are full cell values, sorted row-major, only for cells that change.
 * @param {import('../engine/types.js').Art} art
 * @param {string} fxId  one of ART_FX
 * @param {number} tick  animation step (integer >= 0)
 * @param {FxRng} [rng=0]
 * @returns {FxOverride[]}
 */
export function applyFx(art, fxId, tick, rng = 0) {
  return runFx(art, fxId, tick, rngFn(rng), (x, y) => cellAt(art, x, y));
}

function runFx(art, fxId, tick, rnd, cell) {
  if (!ART_FX.includes(fxId) || !Object.hasOwn(EFFECTS, fxId)) throw new RangeError(`unknown art effect "${fxId}"`);
  const t = Math.max(0, Math.floor(Number(tick) || 0));
  return EFFECTS[fxId](art, cell, t, rnd).sort((a, b) => a.y - b.y || a.x - b.x);
}

/**
 * All of an art def's effects layered in FX_ORDER (each sees the previous ones' result).
 * @param {import('../engine/types.js').Art} art
 * @param {number} tick
 * @param {FxRng} [rng=0]
 * @param {string[]} [fxIds=art.fx]
 * @returns {FxOverride[]} final values of every changed cell, row-major
 */
export function applyAllFx(art, tick, rng = 0, fxIds = art.fx ?? []) {
  const unknown = fxIds.find((id) => !FX_ORDER.includes(id));
  if (unknown !== undefined) throw new RangeError(`unknown art effect "${unknown}"`);
  const rnd = rngFn(rng);
  let overrides = [];
  for (const id of FX_ORDER.filter((f) => fxIds.includes(f))) {
    const layer = runFx(art, id, tick, rnd, viewOf(art, overrides));
    const merged = new Map(overrides.map((o) => [o.y * art.w + o.x, o]));
    for (const o of layer) merged.set(o.y * art.w + o.x, o);
    overrides = [...merged.values()].sort((a, b) => a.y - b.y || a.x - b.x);
  }
  return overrides;
}
