// TT-013: tracker note notation -> MIDI -> Hz. Pure, Node-safe.
//
// Notation is the classic tracker form: letter, accidental-or-dash, octave.
//   'C-4' middle C (MIDI 60), 'C#4' / 'Db4' (61), 'A-4' 440 Hz (69), 'Bb3' (58).
// Rests: '...' or '---' (or null).

/** One SID player frame (PAL vertical blank, 50 Hz). Arpeggios and row timing run on it. */
export const FRAME_SECONDS = 0.02;

const SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NOTE_RE = /^([A-G])([-#b])(\d)$/;

/**
 * True for a rest token.
 * @param {unknown} n
 * @returns {boolean}
 */
export function isRest(n) {
  return n === null || n === '...' || n === '---';
}

/**
 * Parse a tracker note to its MIDI number, or null for a rest. Throws on bad input.
 * @param {string|null} n
 * @returns {number|null}
 */
export function parseNote(n) {
  if (isRest(n)) return null;
  const m = typeof n === 'string' ? NOTE_RE.exec(n) : null;
  if (!m) throw new Error(`bad note ${JSON.stringify(n)}`);
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + SEMITONE[m[1]] + acc;
}

/**
 * MIDI number of a (non-rest) note.
 * @param {string} n
 * @returns {number}
 */
export function noteToMidi(n) {
  const m = parseNote(n);
  if (m === null) throw new Error('rest has no pitch');
  return m;
}

/**
 * Equal-tempered frequency, A-4 (MIDI 69) = 440 Hz.
 * @param {number} midi
 * @returns {number}
 */
export function midiToFreq(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

/**
 * Frequency of a tracker note.
 * @param {string} n
 * @returns {number}
 */
export function noteFreq(n) {
  return midiToFreq(noteToMidi(n));
}
