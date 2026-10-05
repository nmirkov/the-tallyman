// Text helpers (A12): the output normaliser, placeholder interpolation and the English
// helpers every engine module shares. Pure functions; imports only types.js (D4).

const hasOwn = (obj, key) => obj != null && Object.prototype.hasOwnProperty.call(obj, key);

/** A12.1 mapping, applied in this order before the printable-ASCII check. */
const OUTPUT_MAP = [
  [/\r\n?/g, '\n'],
  [/[‘’‚‛′´`]/g, '\''],
  [/[“”„‟″]/g, '"'],
  [/…/g, '...'],
  [/[–—―‒−‐‑]/g, '-'],
  [/[  -   　\t]/g, ' '],
  [/[​-‍⁠­﻿]/g, ''],
];

/**
 * Output normaliser (A12.1): curly quotes → straight, ellipsis → `...`, dashes → `-`,
 * exotic spaces → space, CR/CRLF → `\n`, zero-width characters removed. Anything else
 * outside printable ASCII, `\n` and `£` becomes `?` — or, with `strict`, throws so tests
 * catch it. Word-safe: never splits or re-wraps text.
 * @param {unknown} s
 * @param {{strict?: boolean}} [opts]
 * @returns {string}
 */
export function normalise(s, opts = {}) {
  let out = typeof s === 'string' ? s : String(s ?? '');
  for (const [re, rep] of OUTPUT_MAP) out = out.replace(re, rep);
  return out.replace(/[^\x20-\x7E\n£]/gu, (ch) => {
    if (opts.strict) throw new Error(`unsupported character U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')} in output`);
    return '?';
  });
}

/**
 * Replaces `{key}` placeholders whose key is in `values`; unknown placeholders stay as typed.
 * @param {string} text
 * @param {Record<string, unknown>} values
 * @returns {string}
 */
export function interpolate(text, values) {
  if (typeof text !== 'string') return '';
  if (!text.includes('{') || !values) return text;
  return text.replace(/\{([A-Za-z]+)\}/g, (m, key) => (hasOwn(values, key) ? String(values[key]) : m));
}

/**
 * Money in pence → display (A12.4): `< 100` → `"50p"`, else `"£2.00"`.
 * @param {number} pence
 * @returns {string}
 */
export function formatMoney(pence) {
  const p = Math.max(0, Math.trunc(Number(pence) || 0));
  return p < 100 ? `${p}p` : `£${(p / 100).toFixed(2)}`;
}

/**
 * "a, b and c" — no serial comma (A12.4).
 * @param {string[]} parts
 * @param {string} [conj]  'and' (default) or 'or'.
 * @returns {string}
 */
export function listJoin(parts, conj = 'and') {
  const list = Array.isArray(parts) ? parts.filter((p) => typeof p === 'string' && p !== '') : [];
  if (list.length < 2) return list.join('');
  return `${list.slice(0, -1).join(', ')} ${conj} ${list[list.length - 1]}`;
}

/**
 * A name with its article (A4.7 `article`, A4.8 `proper`).
 * - `article === ''` (proper names): the bare name in every mode.
 * - mode `'definite'`: "the brass key".
 * - mode `'indefinite'` (default): the declared article, else a/an by first letter.
 * @param {string} name
 * @param {string} [article]
 * @param {'definite'|'indefinite'} [mode]
 * @returns {string}
 */
export function withArticle(name, article, mode = 'indefinite') {
  const n = String(name ?? '');
  if (article === '') return n;
  if (mode === 'definite') return `the ${n}`;
  if (typeof article === 'string') return `${article} ${n}`;
  return `${/^[aeiou]/i.test(n) ? 'an' : 'a'} ${n}`;
}

/**
 * Upper-cases the first letter.
 * @param {string} s
 * @returns {string}
 */
export function capitalise(s) {
  const str = String(s ?? '');
  return str ? str[0].toUpperCase() + str.slice(1) : str;
}
