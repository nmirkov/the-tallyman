// TT-013: sound effects as data. Each SFX is {dur, loop?, hits: [...]}, where a hit is
// {at, note | freq | steps, len, inst, vol?} (synth.js instrument fields). `dur` is the declared
// audible length; the unit tests check it against the data and the audition gate
// (tools/audio-audit.js) checks it against the rendered audio.
import { parseNote } from './notes.js';
import { makeRng, playHit } from './synth.js';

// --- instrument helpers (they only build plain objects) ---------------------------------
const pulse = (duty, o) => ({ wave: 'pulse', duty, ...o });
const tri = (o) => ({ wave: 'triangle', ...o });
const saw = (o) => ({ wave: 'saw', ...o });
const noise = (o) => ({ wave: 'noise', ...o });
const lp = (freq, extra = {}) => ({ type: 'lowpass', freq, q: 0.7, ...extra });
const hp = (freq, extra = {}) => ({ type: 'highpass', freq, q: 0.7, ...extra });
const bp = (freq, q, extra = {}) => ({ type: 'bandpass', freq, q, ...extra });

// Commodore datasette: every bit is two square cycles of 352 / 512 / 672 us
// ("0" = short+medium, "1" = medium+short, byte marker = long+medium).
function tapeSteps(seconds, seed) {
  const rng = makeRng(seed);
  const S = 1 / 352e-6;
  const M = 1 / 512e-6;
  const L = 1 / 672e-6;
  const steps = [];
  let t = 0;
  const push = (f) => { steps.push([t, f]); t += 1 / f; };
  while (t < seconds - 0.002) {
    push(L); push(M);
    for (let b = 0; b < 9 && t < seconds - 0.002; b++) {
      if (rng() < 0.5) { push(S); push(M); } else { push(M); push(S); }
    }
  }
  return steps;
}

function chainRattle(seed) {
  const rng = makeRng(seed);
  const clink = tri({ a: 0.0005, d: 0.07, s: 0, r: 0.02, vol: 0.07 });
  const fizz = noise({ a: 0.0005, d: 0.02, s: 0, r: 0.01, vol: 0.05, filter: hp(5000) });
  const hits = [];
  const times = [0.12, 0.2, 0.31, 0.39, 0.52, 0.66, 0.85];
  for (const at of times) {
    const f = 1800 + rng() * 1400;
    hits.push({ at, freq: f, len: 0.03, inst: clink });
    hits.push({ at, freq: f * 2.76, len: 0.03, inst: clink, vol: 0.6 });
    hits.push({ at, note: 'C-8', len: 0.015, inst: fizz });
  }
  return hits;
}

function bellToll() {
  const strike = 220; // the bell's prime, A-3
  // Church-bell partials relative to the prime: hum, prime, minor-third tierce, quint, nominal...
  const partials = [[0.5, 0.18, 4.3], [1, 0.16, 3.4], [1.2, 0.13, 2.8], [1.5, 0.07, 2.0], [2, 0.12, 2.4], [3, 0.05, 1.2], [4, 0.04, 0.8]];
  const hits = partials.map(([ratio, vol, len]) => ({
    at: 0, freq: strike * ratio, len, inst: tri({ a: 0.003, d: len * 1.05, s: 0, r: 0.3, vol }),
  }));
  hits.push({ at: 0, note: 'C-7', len: 0.02, inst: noise({ a: 0.0005, d: 0.03, s: 0, r: 0.01, vol: 0.15, filter: bp(3000, 2) }) });
  return hits;
}

function footsteps() {
  const hits = [];
  [0, 0.42, 0.84, 1.26].forEach((at, i) => {
    const left = i % 2 === 0;
    hits.push({ at, note: left ? 'D-2' : 'C-2', len: 0.05, inst: tri({ slide: { semis: 7, time: 0.04 }, a: 0.001, d: 0.08, s: 0, r: 0.03, vol: 0.45, filter: lp(250) }) });
    hits.push({ at, note: 'C-5', len: 0.06, inst: noise({ a: 0.002, d: 0.07, s: 0, r: 0.03, vol: 0.22, filter: bp(left ? 800 : 700, 1) }) });
  });
  return hits;
}

const creakA = (freq, len, rate, depth, vol, band) => saw({
  a: 0.03, d: 0.4, s: 0.85, r: 0.05, vol, slide: { semis: -4, time: len }, vib: { delay: 0, rate, depth }, filter: bp(band, 3),
});

/** Sound effects by id (see ids.js for what each is for). */
export const SFX = Object.freeze({
  key: {
    dur: 0.018,
    hits: [
      { at: 0, note: 'C-7', len: 0.012, inst: noise({ a: 0.0005, d: 0.004, s: 0.4, r: 0.006, vol: 0.1, filter: hp(2500) }) },
      { at: 0, note: 'E-6', len: 0.012, inst: pulse(0.125, { a: 0.0005, d: 0.004, s: 0.4, r: 0.006, vol: 0.05 }) },
    ],
  },
  door: {
    dur: 0.7,
    hits: [
      { at: 0, freq: 95, len: 0.45, inst: creakA(95, 0.45, 23, 90, 0.26, 1100) },
      { at: 0.05, freq: 141, len: 0.35, inst: creakA(141, 0.35, 31, 60, 0.11, 1700) },
      { at: 0.5, note: 'E-2', len: 0.12, inst: tri({ slide: { semis: 12, time: 0.06 }, a: 0.001, d: 0.25, s: 0, r: 0.08, vol: 0.6, filter: lp(400) }) },
      { at: 0.5, note: 'C-4', len: 0.08, inst: noise({ a: 0.001, d: 0.1, s: 0, r: 0.05, vol: 0.3, filter: lp(500) }) },
    ],
  },
  creak: {
    dur: 1.45,
    hits: [
      { at: 0, freq: 70, len: 1.3, inst: saw({ a: 0.15, d: 0.1, s: 1, r: 0.15, vol: 0.36, slide: { semis: -3, time: 1.3 }, vib: { delay: 0, rate: 13, depth: 140 }, filter: bp(650, 4) }) },
      { at: 0.1, freq: 104, len: 1.2, inst: saw({ a: 0.2, d: 0.1, s: 1, r: 0.15, vol: 0.22, slide: { semis: -2, time: 1.2 }, vib: { delay: 0, rate: 17.3, depth: 110 }, filter: bp(1400, 5) }) },
    ],
  },
  thunder: {
    dur: 3.15,
    hits: [
      { at: 0, note: 'C-8', len: 0.08, inst: noise({ a: 0.001, d: 0.1, s: 0.3, r: 0.1, vol: 0.4, filter: hp(1200) }) },
      { at: 0.07, note: 'C-7', len: 0.2, inst: noise({ a: 0.002, d: 0.25, s: 0, r: 0.1, vol: 0.32, filter: lp(3000) }) },
      { at: 0.05, note: 'C-4', len: 2.7, inst: noise({ a: 0.08, d: 2.4, s: 0.05, r: 0.4, vol: 0.75, filter: lp(1400, { to: 90, time: 2.6, q: 0.8 }) }) },
      { at: 0.6, note: 'G-3', len: 1.6, inst: noise({ a: 0.3, d: 1.2, s: 0.2, r: 0.5, vol: 0.5, filter: lp(300, { to: 80, time: 2 }) }) },
    ],
  },
  sting: {
    dur: 2.1,
    hits: [
      { at: 0, note: 'C-8', len: 0.9, inst: noise({ a: 0.001, d: 0.9, s: 0, r: 0.2, vol: 0.22, filter: hp(2500) }) },
      { at: 0, note: 'D-3', len: 1.8, inst: saw({ a: 0.002, d: 1.8, s: 0.15, r: 0.3, vol: 0.2, slide: { semis: 1, time: 1.6 }, filter: lp(3000, { to: 600, time: 1.8 }) }) },
      { at: 0, note: 'C#5', len: 1.8, inst: pulse(0.25, { a: 0.002, d: 1.8, s: 0.15, r: 0.3, vol: 0.13, slide: { semis: 1, time: 1.6 } }) },
      { at: 0, note: 'G-5', len: 1.8, inst: pulse(0.125, { a: 0.002, d: 1.8, s: 0.15, r: 0.3, vol: 0.11, slide: { semis: 1, time: 1.6 } }) },
      { at: 0, note: 'D-6', len: 1.8, inst: pulse(0.5, { a: 0.002, d: 1.8, s: 0.15, r: 0.3, vol: 0.07, slide: { semis: 1, time: 1.6 } }) },
      { at: 0, note: 'D-2', len: 0.6, inst: tri({ slide: { semis: 12, time: 0.1 }, a: 0.001, d: 1, s: 0, r: 0.2, vol: 0.5 }) },
    ],
  },
  pickup: {
    dur: 0.37,
    hits: [
      ...['C-5', 'E-5', 'G-5'].map((note, i) => ({ at: i * 0.05, note, len: 0.045, inst: pulse(0.25, { a: 0.001, d: 0.06, s: 0.6, r: 0.04, vol: 0.2 }) })),
      { at: 0.15, note: 'C-6', len: 0.12, inst: pulse(0.25, { a: 0.001, d: 0.1, s: 0.6, r: 0.1, vol: 0.2 }) },
      { at: 0.15, note: 'G-6', len: 0.08, inst: pulse(0.125, { a: 0.001, d: 0.1, s: 0.4, r: 0.1, vol: 0.06 }) },
    ],
  },
  drop: {
    dur: 0.27,
    hits: [
      { at: 0, note: 'G-4', len: 0.05, inst: pulse(0.5, { a: 0.001, d: 0.1, s: 0.3, r: 0.05, vol: 0.18 }) },
      { at: 0.06, note: 'C-4', len: 0.1, inst: pulse(0.5, { a: 0.001, d: 0.1, s: 0.3, r: 0.05, vol: 0.18, slide: { semis: 7, time: 0.08 } }) },
      { at: 0.14, note: 'C-2', len: 0.08, inst: tri({ slide: { semis: 12, time: 0.05 }, a: 0.001, d: 0.12, s: 0, r: 0.05, vol: 0.4 }) },
    ],
  },
  footsteps: { dur: 1.35, hits: footsteps() },
  bell: { dur: 4.6, hits: bellToll() },
  phone: {
    dur: 1.72,
    hits: [
      { at: 0, freq: 400, len: 0.4, inst: pulse(0.5, { arp: [0, 2], arpRate: 1, a: 0.005, d: 0.05, s: 1, r: 0.02, vol: 0.13 }) },
      { at: 0.6, freq: 400, len: 0.4, inst: pulse(0.5, { arp: [0, 2], arpRate: 1, a: 0.005, d: 0.05, s: 1, r: 0.02, vol: 0.13 }) },
      ...[['E-7', 1.25], ['C-7', 1.33], ['G#6', 1.38], ['D-7', 1.44]].map(([note, at]) => ({
        at, note, len: 0.03, inst: tri({ a: 0.001, d: 0.08, s: 0, r: 0.02, vol: 0.12 }),
      })),
      { at: 1.6, note: 'C-4', len: 0.05, inst: noise({ a: 0.001, d: 0.1, s: 0, r: 0.05, vol: 0.3, filter: lp(600) }) },
      { at: 1.6, note: 'G-2', len: 0.05, inst: tri({ slide: { semis: 7, time: 0.04 }, a: 0.001, d: 0.1, s: 0, r: 0.05, vol: 0.3 }) },
    ],
  },
  scream: {
    dur: 1.7,
    hits: [
      { at: 0, note: 'E-5', len: 0.5, inst: saw({ a: 0.03, d: 0.3, s: 0.9, r: 0.05, vol: 0.2, slide: { semis: -6, time: 0.18 }, vib: { delay: 0.05, rate: 9, depth: 70 }, filter: bp(1600, 1.2) }) },
      { at: 0.45, note: 'A-4', len: 1.0, inst: saw({ a: 0.02, d: 0.9, s: 0.4, r: 0.25, vol: 0.2, slide: { semis: 7, time: 1.0 }, vib: { delay: 0, rate: 7, depth: 90 }, filter: bp(1400, 1.2) }) },
      { at: 0, note: 'C-7', len: 1.3, inst: noise({ a: 0.05, d: 1.2, s: 0.2, r: 0.2, vol: 0.06, filter: bp(2600, 1.5) }) },
    ],
  },
  heart: {
    dur: 0.32,
    hits: [
      { at: 0, note: 'A-1', len: 0.07, inst: tri({ slide: { semis: 7, time: 0.04 }, a: 0.003, d: 0.1, s: 0, r: 0.04, vol: 0.7, filter: lp(180) }) },
      { at: 0, note: 'C-3', len: 0.05, inst: noise({ a: 0.002, d: 0.07, s: 0, r: 0.03, vol: 0.15, filter: lp(400) }) },
      { at: 0.2, note: 'F-1', len: 0.08, inst: tri({ slide: { semis: 7, time: 0.04 }, a: 0.003, d: 0.1, s: 0, r: 0.04, vol: 0.55, filter: lp(180) }) },
      { at: 0.2, note: 'C-3', len: 0.05, inst: noise({ a: 0.002, d: 0.07, s: 0, r: 0.03, vol: 0.11, filter: lp(400) }) },
    ],
  },
  chain: {
    dur: 0.9,
    hits: [
      { at: 0, note: 'C-8', len: 0.03, inst: noise({ a: 0.0005, d: 0.04, s: 0, r: 0.02, vol: 0.4, filter: hp(3000) }) },
      { at: 0, note: 'G-6', len: 0.02, inst: pulse(0.125, { a: 0.0005, d: 0.03, s: 0, r: 0.02, vol: 0.12 }) },
      ...chainRattle(13),
    ],
  },
  hatch: {
    dur: 0.88,
    hits: [
      { at: 0, freq: 85, len: 0.3, inst: creakA(85, 0.3, 19, 100, 0.16, 900) },
      { at: 0.32, note: 'C-2', len: 0.15, inst: tri({ slide: { semis: 14, time: 0.07 }, a: 0.001, d: 0.35, s: 0, r: 0.1, vol: 0.7, filter: lp(350) }) },
      { at: 0.32, note: 'C-4', len: 0.1, inst: noise({ a: 0.001, d: 0.2, s: 0, r: 0.1, vol: 0.35, filter: lp(700) }) },
      { at: 0.7, note: 'C-2', len: 0.08, inst: tri({ slide: { semis: 10, time: 0.05 }, a: 0.001, d: 0.15, s: 0, r: 0.1, vol: 0.25, filter: lp(350) }) },
      { at: 0.7, note: 'C-4', len: 0.05, inst: noise({ a: 0.001, d: 0.1, s: 0, r: 0.05, vol: 0.1, filter: lp(700) }) },
    ],
  },
  splash: {
    dur: 1.06,
    hits: [
      { at: 0, note: 'C-6', len: 0.55, inst: noise({ a: 0.005, d: 0.6, s: 0, r: 0.1, vol: 0.45, filter: lp(5000, { to: 350, time: 0.6 }) }) },
      { at: 0, note: 'A-2', len: 0.2, inst: tri({ slide: { semis: 5, time: 0.15 }, a: 0.002, d: 0.25, s: 0, r: 0.05, vol: 0.3 }) },
      ...[['C-6', 0.45], ['G-6', 0.62], ['D-6', 0.8], ['A-6', 1.0]].map(([note, at]) => ({
        at, note, len: 0.04, inst: tri({ slide: { semis: -12, time: 0.04 }, a: 0.001, d: 0.05, s: 0, r: 0.02, vol: 0.12 }),
      })),
    ],
  },
  death: {
    dur: 2.7,
    hits: [
      ...['A-4', 'G#4', 'G-4', 'F#4'].map((note, i) => ({
        at: i * 0.2, note, len: 0.18, inst: pulse(0.5, { a: 0.005, d: 0.2, s: 0.7, r: 0.06, vol: 0.2 }),
      })),
      { at: 0.8, note: 'F-4', len: 0.22, inst: pulse(0.5, { a: 0.005, d: 0.2, s: 0.7, r: 0.06, vol: 0.2 }) },
      { at: 1.05, note: 'D-4', len: 1.4, inst: pulse(0.5, { a: 0.005, d: 0.8, s: 0.6, r: 0.25, vol: 0.2, vib: { delay: 0.2, rate: 5.5, depth: 35 } }) },
      { at: 1.05, note: 'D-2', len: 1.4, inst: tri({ a: 0.005, d: 0.8, s: 0.6, r: 0.25, vol: 0.4 }) },
    ],
  },
  victory: {
    dur: 2.5,
    hits: [
      ...[['G-4', 0, 0.09], ['C-5', 0.1, 0.09], ['E-5', 0.2, 0.09], ['G-5', 0.3, 0.28], ['E-5', 0.6, 0.09]].map(([note, at, len]) => ({
        at, note, len, inst: pulse(0.25, { a: 0.003, d: 0.15, s: 0.75, r: 0.08, vol: 0.2 }),
      })),
      { at: 0.7, note: 'G-5', len: 1.5, inst: pulse(0.25, { a: 0.003, d: 0.4, s: 0.75, r: 0.3, vol: 0.2, vib: { delay: 0.15, rate: 6, depth: 18 } }) },
      { at: 0.3, note: 'C-4', len: 1.9, inst: pulse(0.125, { arp: [0, 4, 7, 12], arpRate: 1, a: 0.01, d: 0.5, s: 0.6, r: 0.3, vol: 0.08 }) },
      ...[['C-3', 0, 0.25], ['G-2', 0.3, 0.28]].map(([note, at, len]) => ({
        at, note, len, inst: tri({ a: 0.002, d: 0.15, s: 0.7, r: 0.04, vol: 0.4 }),
      })),
      { at: 0.7, note: 'C-2', len: 1.5, inst: tri({ a: 0.002, d: 0.6, s: 0.6, r: 0.3, vol: 0.4 }) },
    ],
  },
  error: {
    dur: 0.34,
    hits: [
      { at: 0, note: 'C-2', len: 0.3, inst: saw({ a: 0.003, d: 0.1, s: 0.8, r: 0.04, vol: 0.18 }) },
      { at: 0, note: 'C#2', len: 0.3, inst: pulse(0.5, { a: 0.003, d: 0.1, s: 0.8, r: 0.04, vol: 0.14 }) },
    ],
  },
  tape: {
    dur: 1.0,
    loop: true,
    hits: [{ at: 0, steps: tapeSteps(1.0, 64), len: 0.997, inst: pulse(0.5, { a: 0.002, d: 0.1, s: 1, r: 0.003, vol: 0.07 }) }],
  },
  whisper: {
    dur: 1.47,
    hits: [
      { at: 0, note: 'C-7', len: 0.32, inst: noise({ a: 0.08, d: 0.3, s: 0.6, r: 0.08, vol: 0.36, filter: bp(2600, 3, { to: 3400, time: 0.3 }) }) },
      { at: 0.42, note: 'G-6', len: 0.25, inst: noise({ a: 0.06, d: 0.25, s: 0.5, r: 0.07, vol: 0.32, filter: bp(1500, 4, { to: 1100, time: 0.25 }) }) },
      { at: 0.8, note: 'C-8', len: 0.55, inst: noise({ a: 0.1, d: 0.5, s: 0.6, r: 0.12, vol: 0.28, filter: bp(5200, 2.5, { to: 6000, time: 0.55 }) }) },
    ],
  },
});

/**
 * Time the data says an SFX ends: the latest hit start + gate + release.
 * @param {{hits: Array<{at: number, len: number, inst: object}>}} def
 * @returns {number}
 */
export function sfxEnd(def) {
  let end = 0;
  for (const h of def.hits) {
    let inst = h.inst;
    let r = 0;
    while (inst) { r = Math.max(r, inst.r ?? 0.02); inst = typeof inst.also === 'object' ? inst.also : null; }
    end = Math.max(end, h.at + h.len + r);
  }
  return end;
}

/**
 * Schedule an SFX at time `t`. Returns the time it has fully ended.
 * @param {BaseAudioContext} ctx
 * @param {AudioNode} dest
 * @param {{hits: Array<object>}} def
 * @param {number} t
 * @param {number} [vol] overall level multiplier
 * @returns {number}
 */
export function playSfx(ctx, dest, def, t, vol = 1) {
  let end = t;
  for (const h of def.hits) {
    const hit = { len: h.len, inst: h.inst, vol: (h.vol ?? 1) * vol, steps: h.steps };
    if (h.note !== undefined) hit.midi = parseNote(h.note);
    else if (h.freq !== undefined) hit.freq = h.freq;
    else hit.freq = h.steps?.[0]?.[1] ?? 440;
    end = Math.max(end, playHit(ctx, dest, t + h.at, hit));
  }
  return end;
}
