// Palettes and screen themes. Colour "keys" everywhere in the game (art, UI) are the
// C64 palette indices '0'-'f'; each theme maps those 16 keys to its own RGB values, so
// the same art renders on every theme. Roles ('fg', 'bg', 'border', ...) name the
// theme's semantic colours and resolve to a key (or a literal '#rrggbb').

/** C64 palette, Philip "Pepto" Timmermann (2001). Index = C64 colour number. */
export const PEPTO = Object.freeze([
  '#000000', '#ffffff', '#68372b', '#70a4b2', '#6f3d86', '#588d43', '#352879', '#b8c76f',
  '#6f4f25', '#433900', '#9a6759', '#444444', '#6c6c6c', '#9ad284', '#6c5eb5', '#959595',
]);

/** C64 palette, Colodore by Philip Timmermann (2017) — the more accurate successor. */
export const COLODORE = Object.freeze([
  '#000000', '#ffffff', '#813338', '#75cec8', '#8e3c97', '#56ac4d', '#2e2c9b', '#edf171',
  '#8e5029', '#553800', '#c46c71', '#4a4a4a', '#7b7b7b', '#a9ff9f', '#706deb', '#b2b2b2',
]);

/** ZX Spectrum palette: index 0-7 = black, blue, red, magenta, green, cyan, yellow, white. */
export const SPECTRUM = Object.freeze({
  normal: Object.freeze(['#000000', '#0000d7', '#d70000', '#d700d7', '#00d700', '#00d7d7', '#d7d700', '#d7d7d7']),
  bright: Object.freeze(['#000000', '#0000ff', '#ff0000', '#ff00ff', '#00ff00', '#00ffff', '#ffff00', '#ffffff']),
});

const N = SPECTRUM.normal;
const B = SPECTRUM.bright;
// C64 key -> nearest-in-spirit Spectrum colour (the Spectrum has no orange/brown/greys:
// greys become normal white, dark grey becomes blue as Spectrum artists used it for shade).
const SPECTRUM_FROM_C64 = Object.freeze([
  N[0], B[7], N[2], N[5], N[3], N[4], N[1], B[6],
  N[6], N[2], B[2], N[1], N[7], B[4], B[1], N[7],
]);

/** Map a colour to an amber-monitor shade by its luminance. */
function amberShade(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const t = Math.pow(0.2126 * r + 0.7152 * g + 0.0722 * b, 0.75);
  const ch = (v) => Math.round(v).toString(16).padStart(2, '0');
  return `#${ch(255 * t)}${ch(176 * t)}${ch(16 * t)}`;
}

/**
 * @typedef {object} Theme
 * @property {string} name
 * @property {string} label
 * @property {string[]} colors  16 '#rrggbb' values indexed by C64 key 0-f
 * @property {Record<string,string>} roles  role -> key or '#rrggbb'
 * @property {boolean} upper  render a-z as A-Z (C64 power-on character set)
 */

/** @type {Record<string, Theme>} */
export const THEMES = Object.freeze({
  c64: Object.freeze({
    name: 'c64',
    label: 'Commodore 64',
    colors: COLODORE,
    upper: true,
    roles: Object.freeze({
      fg: 'e', bg: '6', border: 'e', statusFg: '6', statusBg: '1', divider: 'e', cursor: 'e',
      title: '1', alert: 'a', whisper: 'f', echo: '1', system: '7', dim: 'c',
    }),
  }),
  spectrum: Object.freeze({
    name: 'spectrum',
    label: 'ZX Spectrum',
    colors: SPECTRUM_FROM_C64,
    upper: false,
    roles: Object.freeze({
      fg: '0', bg: 'f', border: 'f', statusFg: '1', statusBg: '6', divider: '0', cursor: '0',
      title: '6', alert: '2', whisper: '4', echo: '6', system: '0', dim: '6',
    }),
  }),
  amber: Object.freeze({
    name: 'amber',
    label: 'Amber monitor',
    colors: Object.freeze(COLODORE.map(amberShade)),
    upper: false,
    roles: Object.freeze({
      fg: '7', bg: '0', border: '#0c0700', statusFg: '0', statusBg: '7', divider: 'c', cursor: '7',
      title: '1', alert: '1', whisper: 'c', echo: 'f', system: 'f', dim: 'b',
    }),
  }),
});

/**
 * Look up a theme by name (unknown names give 'c64'); a theme object passes through.
 * @param {string|Theme} [nameOrTheme]
 * @returns {Theme}
 */
export function getTheme(nameOrTheme) {
  if (nameOrTheme && typeof nameOrTheme === 'object' && Array.isArray(nameOrTheme.colors)) return nameOrTheme;
  return THEMES[nameOrTheme] ?? THEMES.c64;
}

const KEY = /^[0-9a-f]$/i;
const LITERAL = /^#[0-9a-f]{6}$/i;

/**
 * Resolve a colour spec to '#rrggbb' under a theme. A spec is a C64 key ('0'-'f' or
 * 0-15), a role name ('fg', 'bg', 'border', 'statusFg', 'alert', ...), or a literal
 * '#rrggbb'. Anything else (incl. null/undefined) resolves to `fallbackRole`.
 * @param {Theme} theme
 * @param {string|number|null|undefined} spec
 * @param {string} [fallbackRole='fg']
 * @returns {string}
 */
export function resolveColor(theme, spec, fallbackRole = 'fg') {
  for (let depth = 0; depth < 4; depth++) {
    if (typeof spec === 'number' && Number.isInteger(spec) && spec >= 0 && spec < 16) return theme.colors[spec];
    if (typeof spec === 'string') {
      if (KEY.test(spec)) return theme.colors[parseInt(spec, 16)];
      if (LITERAL.test(spec)) return spec.toLowerCase();
      if (Object.hasOwn(theme.roles, spec)) { spec = theme.roles[spec]; continue; }
    }
    if (spec === theme.roles[fallbackRole]) break;
    spec = theme.roles[fallbackRole] ?? '0';
  }
  return theme.colors[0];
}

/**
 * Pack '#rrggbb' into a Uint32 for a little-endian ImageData Uint32Array view (0xAABBGGRR).
 * @param {string} hex
 * @returns {number}
 */
export function packRGBA(hex) {
  const v = parseInt(hex.slice(1, 7), 16);
  return ((0xff << 24) | ((v & 0xff) << 16) | (v & 0xff00) | ((v >> 16) & 0xff)) >>> 0;
}
