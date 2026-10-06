// Status bar (row 0, inverse: room name left, "HH:MM  SC nn" right) and the nerve-driven
// border colour (PLAN §3.6). The text and colour rules are pure; `drawStatus` writes them
// onto a TT-003 screen.

/** Nerve thresholds for the border (PLAN §3.6, TT-012). */
export const NERVE_PURPLE = 50;
export const NERVE_RED = 80;
/** Border colours (C64 palette keys): purple, and the red pulse pair. */
export const BORDER_PURPLE = '4';
export const BORDER_RED = '2';
export const BORDER_RED_BRIGHT = 'a';
/** Red pulse period in ms (a slow heartbeat). */
export const PULSE_MS = 900;

/**
 * Status bar text, exactly `cols` wide: " ROOM NAME      21:30  SC 45 ". A long room name is
 * truncated so at least one space separates it from the right part.
 * @param {{room?:string, time?:string, score?:number}} status
 * @param {number} [cols=40]
 * @returns {string}
 */
export function statusText(status, cols = 40) {
  const right = `${status?.time ?? '--:--'}  SC ${status?.score ?? 0}`;
  const room = String(status?.room ?? '');
  const roomMax = Math.max(0, cols - 2 - right.length - 1);
  const left = Array.from(room).slice(0, roomMax).join('');
  const gap = cols - 2 - Array.from(left).length - right.length;
  return Array.from(` ${left}${' '.repeat(Math.max(1, gap))}${right} `.padEnd(cols)).slice(0, cols).join('');
}

/**
 * Border treatment for a nerve value: the theme border below 50, purple 50-79, red and
 * pulsing at 80 and above.
 * @param {number} nerve
 * @returns {{color:string, pulse:boolean}}  color: 'border' (theme role) or a palette key
 */
export function borderForNerve(nerve) {
  const n = Number(nerve) || 0;
  if (n >= NERVE_RED) return { color: BORDER_RED, pulse: true };
  if (n >= NERVE_PURPLE) return { color: BORDER_PURPLE, pulse: false };
  return { color: 'border', pulse: false };
}

/**
 * Border colour to show at time `now`: the red pulse alternates red / light red, and is
 * steady red under reduced motion.
 * @param {{color:string, pulse:boolean}} b
 * @param {number} now  ms
 * @param {boolean} [reducedMotion=false]
 * @returns {string}
 */
export function borderAt(b, now, reducedMotion = false) {
  if (!b.pulse || reducedMotion) return b.color;
  // a heartbeat: a short bright beat, then the long dark rest
  const phase = (Math.max(0, now) % PULSE_MS) / PULSE_MS;
  return phase < 0.3 ? BORDER_RED_BRIGHT : BORDER_RED;
}

/**
 * Draw the status bar on row 0 of a screen in the theme's status colours.
 * @param {{print: Function, cols: number}} screen
 * @param {{room?:string, time?:string, score?:number}} status
 */
export function drawStatus(screen, status) {
  screen.print(0, 0, statusText(status, screen.cols), 'statusFg', 'statusBg');
}
