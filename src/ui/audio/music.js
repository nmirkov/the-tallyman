// TT-013: tiny tracker-style sequencer.
//
// A tune (data, see tunes.js):
//   { speed, loop, tracks: {v1, v2, v3, noise}, patterns: {name: [[note, rows, inst?], ...]} }
// `speed` is 50 Hz frames per row, as in SID players (speed 6 -> 0.12 s per row).
// A track is an order list of pattern names; `['bass', -5]` plays a pattern transposed
// (Rob Hubbard's trick for reusing one bar under a whole chord progression).
// A pattern entry's instrument may be omitted to reuse the previous one in that pattern.
//
// Live playback schedules ahead on AudioContext.currentTime with a look-ahead window
// refilled by a coarse timer, so timer jitter never reaches the audio clock.
import { FRAME_SECONDS, isRest, parseNote } from './notes.js';
import { playHit } from './synth.js';
import { TUNES, INSTRUMENTS } from './tunes.js';

/** Voices a tune may use: three SID tone voices plus the noise "drum" voice. */
export const VOICES = Object.freeze(['v1', 'v2', 'v3', 'noise']);

/**
 * Seconds per row.
 * @param {number} speed frames per row
 * @returns {number}
 */
export function rowSeconds(speed) {
  return Math.round(speed * FRAME_SECONDS * 1e9) / 1e9;
}

function orderEntry(entry) {
  return typeof entry === 'string' ? [entry, 0] : [entry[0], entry[1] ?? 0];
}

/**
 * Flatten a tune into time-sorted note events.
 * @param {object} tune
 * @param {Record<string, object>} [instruments]
 * @returns {{speed: number, loop: boolean, rows: number, rowSec: number,
 *   events: Array<{voice: string, row: number, len: number, midi: number, inst: string}>}}
 */
export function compileTune(tune, instruments = INSTRUMENTS) {
  const events = [];
  let rows = 0;
  for (const voice of VOICES) {
    const track = tune.tracks[voice];
    if (!track) continue;
    let row = 0;
    for (const entry of track) {
      const [name, transpose] = orderEntry(entry);
      let inst = null;
      for (const [note, len, i] of tune.patterns[name]) {
        if (i) inst = i;
        const midi = parseNote(note);
        if (midi !== null && inst && instruments[inst]) events.push({ voice, row, len, midi: midi + transpose, inst });
        row += len;
      }
    }
    rows = Math.max(rows, row);
  }
  const order = (v) => VOICES.indexOf(v);
  events.sort((a, b) => a.row - b.row || order(a.voice) - order(b.voice));
  return { speed: tune.speed, loop: !!tune.loop, rows, rowSec: rowSeconds(tune.speed), events };
}

/**
 * Length of one pass of a compiled tune in seconds.
 * @param {{rows: number, rowSec: number}} compiled
 * @returns {number}
 */
export function tuneSeconds(compiled) {
  return compiled.rows * compiled.rowSec;
}

/**
 * Events whose start time falls in [from, to), with absolute times, for a tune started at `start`.
 * Consecutive half-open windows never repeat or skip an event; looping tunes wrap forever.
 * @param {ReturnType<typeof compileTune>} c
 * @param {number} start
 * @param {number} from
 * @param {number} to
 * @returns {Array<{voice: string, row: number, len: number, midi: number, inst: string, time: number}>}
 */
export function eventsInWindow(c, start, from, to) {
  const out = [];
  const loopLen = tuneSeconds(c);
  if (loopLen <= 0 || to <= from) return out;
  const first = c.loop ? Math.max(0, Math.floor((from - start) / loopLen)) : 0;
  const last = c.loop ? Math.floor((to - start) / loopLen) : 0;
  for (let k = first; k <= last; k++) {
    for (const e of c.events) {
      const time = start + k * loopLen + e.row * c.rowSec;
      if (time >= from && time < to) out.push({ ...e, time });
    }
  }
  return out;
}

/**
 * Check a tune; returns a list of problems (empty when valid).
 * @param {object} tune
 * @param {Record<string, object>} [instruments]
 * @returns {string[]}
 */
export function validateTune(tune, instruments = INSTRUMENTS) {
  const errs = [];
  if (!Number.isInteger(tune.speed) || tune.speed < 1 || tune.speed > 32) errs.push(`speed ${tune.speed} must be 1..32`);
  const lengths = new Map();
  for (const [voice, track] of Object.entries(tune.tracks || {})) {
    if (!VOICES.includes(voice)) errs.push(`unknown voice ${voice} (allowed: ${VOICES.join(', ')})`);
    let rows = 0;
    for (const entry of track) {
      const [name, transpose] = orderEntry(entry);
      const pat = tune.patterns?.[name];
      if (!pat) { errs.push(`${voice}: unknown pattern ${name}`); continue; }
      if (!Number.isInteger(transpose)) errs.push(`${voice}: transpose of ${name} must be an integer`);
      let inst = null;
      for (const [note, len, i] of pat) {
        if (i !== undefined) {
          if (!instruments[i]) errs.push(`${name}: unknown instrument ${i}`);
          inst = i;
        }
        if (!Number.isInteger(len) || len < 1) errs.push(`${name}: bad length ${len}`);
        let midi = null;
        try { midi = parseNote(note); } catch { errs.push(`${name}: bad note ${note}`); }
        if (midi !== null) {
          if (!inst) errs.push(`${name}: note ${note} has no instrument`);
          if (midi + transpose < 12 || midi + transpose > 108) errs.push(`${name}${transpose ? ` (${transpose})` : ''}: ${note} out of range`);
        }
        rows += Number.isInteger(len) ? len : 0;
      }
    }
    lengths.set(voice, rows);
  }
  if (new Set(lengths.values()).size > 1) {
    errs.push(`track length mismatch: ${[...lengths].map(([v, n]) => `${v}=${n}`).join(' ')}`);
  }
  return [...new Set(errs)];
}

/** Gate time of an event: its rows minus one frame (the SID "hard restart" gap). */
function gateSeconds(e, c) {
  return Math.max(e.len * c.rowSec - FRAME_SECONDS, FRAME_SECONDS);
}

/**
 * Schedule every note of a tune that starts within `seconds` of `t0` (offline rendering, previews).
 * @param {BaseAudioContext} ctx
 * @param {AudioNode} dest
 * @param {object} tune
 * @param {number} t0
 * @param {number} seconds
 * @param {Record<string, object>} [instruments]
 * @returns {number} time the last note has fully ended
 */
export function scheduleTune(ctx, dest, tune, t0, seconds, instruments = INSTRUMENTS) {
  const c = compileTune(tune, instruments);
  let end = t0;
  for (const e of eventsInWindow(c, t0, t0, t0 + seconds)) {
    end = Math.max(end, playHit(ctx, dest, e.time, { midi: e.midi, len: gateSeconds(e, c), inst: e.inst }, instruments));
  }
  return end;
}

/**
 * Live sequencer bound to one context.
 * @param {BaseAudioContext} ctx
 * @param {AudioNode} dest
 * @param {{tunes?: object, instruments?: object, lookahead?: number, interval?: number,
 *   setInterval?: Function, clearInterval?: Function, setTimeout?: Function}} [opts]
 */
export function createSequencer(ctx, dest, opts = {}) {
  const tunes = opts.tunes ?? TUNES;
  const instruments = opts.instruments ?? INSTRUMENTS;
  const lookahead = opts.lookahead ?? 1.0;
  const interval = opts.interval ?? 100;
  const si = opts.setInterval ?? ((fn, ms) => globalThis.setInterval(fn, ms));
  const ci = opts.clearInterval ?? ((id) => globalThis.clearInterval(id));
  const st = opts.setTimeout ?? ((fn, ms) => globalThis.setTimeout(fn, ms));
  let cur = null;

  function tick() {
    if (!cur) return;
    const c = cur.compiled;
    // After a long stall (suspended context, throttled tab) skip what was missed instead of
    // firing it all at once.
    if (cur.cursor < ctx.currentTime) cur.cursor = ctx.currentTime;
    const horizon = ctx.currentTime + lookahead;
    if (horizon <= cur.cursor) return;
    for (const e of eventsInWindow(c, cur.start, cur.cursor, horizon)) {
      playHit(ctx, cur.bus, e.time, { midi: e.midi, len: gateSeconds(e, c), inst: e.inst }, instruments);
    }
    cur.cursor = horizon;
    if (!c.loop && cur.cursor > cur.start + tuneSeconds(c) + 3) finish();
  }

  function finish() {
    if (cur) ci(cur.timer);
    cur = null;
  }

  function stop(fade = 0.3) {
    if (!cur) return;
    const { bus } = cur;
    finish();
    bus.gain.setTargetAtTime(0, ctx.currentTime, fade / 3);
    st(() => { try { bus.disconnect(); } catch { /* already gone */ } }, fade * 1000 + 200);
  }

  function play(id) {
    if (cur && cur.id === id) return;
    stop();
    const tune = tunes[id];
    if (!tune) return;
    const bus = ctx.createGain();
    bus.connect(dest);
    cur = { id, compiled: compileTune(tune, instruments), start: ctx.currentTime + 0.06, bus, timer: null };
    cur.cursor = cur.start;
    // A throwing timer callback would surface as an uncaught error; audio must never do that.
    cur.timer = si(() => { try { tick(); } catch { stop(0.05); } }, interval);
    tick();
  }

  return {
    play,
    stop,
    tick,
    lookahead,
    get playing() { return cur ? cur.id : null; },
  };
}
