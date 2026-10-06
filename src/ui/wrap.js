// Word-wrapping for the 40-column text region. Pure; counts code points (so `£` is one
// column, like every other glyph in font8x8).

/**
 * Display width of a string in character cells (one per code point).
 * @param {string} s
 * @returns {number}
 */
export function textWidth(s) {
  let n = 0;
  for (const _ of String(s)) n++;
  return n;
}

/**
 * Wrap one paragraph (no newlines) to `width` columns. Breaks at spaces; a word is only
 * split when it is longer than a whole line. Spaces at a wrap point and at the end of a
 * line are dropped; spaces inside a line and a paragraph's leading indent are kept.
 * @param {string} text
 * @param {number} [width=40]
 * @returns {string[]} at least one line ('' for empty input)
 */
export function wrapLine(text, width = 40) {
  const tokens = String(text).match(/ +|[^ ]+/g) ?? [];
  const lines = [];
  let line = [];
  const hasInk = () => line.some((c) => c !== ' ');
  const flush = () => {
    while (line.length && line[line.length - 1] === ' ') line.pop();
    lines.push(line.join(''));
    line = [];
  };

  for (const tok of tokens) {
    const chars = Array.from(tok);
    if (tok[0] === ' ') {
      if (line.length === 0 && lines.length > 0) continue; // no leading spaces on wrapped lines
      if (line.length + chars.length <= width) line.push(...chars);
      else if (hasInk()) flush();
      else line = [];
      continue;
    }
    if (chars.length > width) {
      if (hasInk()) flush();
      else line = [];
      for (let i = 0; i < chars.length; i += width) {
        line = chars.slice(i, i + width);
        if (i + width < chars.length) flush();
      }
      continue;
    }
    if (line.length + chars.length > width) {
      if (hasInk()) flush();
      else line = [];
    }
    line.push(...chars);
  }
  if (line.length || lines.length === 0) flush();
  return lines;
}

/**
 * Wrap text that may contain newlines: each `\n` starts a new line, and empty lines
 * (paragraph gaps) are preserved.
 * @param {string} text
 * @param {number} [width=40]
 * @returns {string[]}
 */
export function wrapText(text, width = 40) {
  return String(text ?? '').replace(/\r\n?/g, '\n').split('\n').flatMap((p) => wrapLine(p, width));
}
