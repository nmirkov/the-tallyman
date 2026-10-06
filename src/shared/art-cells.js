// Cell-level facts about art and its effects that both the fx layer (src/ui/fx.js) and the
// content lint (tools/lint-content.js) need. Kept neutral so the lint does not depend on a
// presentation module (TT-132).

/** @typedef {{ch: string, fg: string, bg: string}} ArtCell */

export const DARK_KEYS = new Set(['0', '6', '9', 'b']);
export const SKY_KEYS = new Set(['0', '6']);
// glyphs that are part solid, part paper: their paper is "air" for lightning
export const EDGE_GLYPHS = new Set([...'▀▄▌▐▖▗▘▝▙▛▜▟▚▞▁▂▃▅▆▇▔▏▎▍▋▊▉▕']);
// torch / candle flicker: colour -> [one step dimmer, two steps dimmer]
export const FLICKER_RAMP = Object.freeze({
  1: ['f', 'c'], 7: ['f', 'c'], f: ['c', 'b'], c: [null, 'b'], a: [null, '8'], 8: [null, '9'],
});

/**
 * The cell at (x, y) of an art def, with `bg` resolved (single key, per-cell rows, or absent = '0').
 * @param {import('../engine/types.js').Art} art
 * @param {number} x
 * @param {number} y
 * @returns {ArtCell}
 */
export function cellAt(art, x, y) {
  const ch = Array.from(art.chars[y])[x];
  const fg = art.colors[y][x];
  const bg = typeof art.bg === 'string' ? art.bg : Array.isArray(art.bg) ? art.bg[y][x] : '0';
  return { ch, fg, bg };
}

/**
 * Whether an effect can ever change this (base) cell, at any tick. Static and conservative,
 * mirroring each effect's cell test in fx.js: rain and fog only touch ' ' and '█', lightning
 * only sky-paper air and edge glyphs, flicker only cells with a dimmable colour. Used by the
 * content lint to keep the ending screen's reserved rows fx-inert (TT-106).
 * @param {string} fxId
 * @param {ArtCell} c
 * @returns {boolean}
 */
export function fxMayChange(fxId, c) {
  switch (fxId) {
    case 'rain': return c.ch === ' ' || c.ch === '█';
    case 'fog': return (c.ch === ' ' && DARK_KEYS.has(c.bg)) || (c.ch === '█' && DARK_KEYS.has(c.fg));
    case 'lightning': return SKY_KEYS.has(c.bg) && (c.ch === ' ' || EDGE_GLYPHS.has(c.ch));
    case 'flicker': return Object.hasOwn(FLICKER_RAMP, c.fg) || Object.hasOwn(FLICKER_RAMP, c.bg);
    default: return true;
  }
}
