// TT-013: looping ambiences (AMBIENT_IDS). Each one is a small graph of continuous nodes
// started once, plus a `tick(from, to)` that schedules its discrete events (drips, clinks,
// heartbeats, the counting) for a time window - the live player refills the window from a
// coarse timer, the audition gate calls it once for the whole render.
import { noteFreq } from './notes.js';
import { makeRng, noiseBuffer, playHit, pulseWave } from './synth.js';
import { SFX, playSfx } from './sfx.js';

const CROSSFADE = 1;

function gain(ctx, value, dest) {
  const g = ctx.createGain();
  g.gain.value = value;
  if (dest) g.connect(dest);
  return g;
}

function filter(ctx, type, freq, q, dest) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  if (dest) f.connect(dest);
  return f;
}

function noiseLoop(ctx, rate, dest, sources) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  src.playbackRate.value = rate;
  src.connect(dest);
  sources.push(src);
  return src;
}

function lfo(ctx, rate, depth, param, sources, type = 'sine') {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = rate;
  o.connect(gain(ctx, depth, param));
  sources.push(o);
  return o;
}

function osc(ctx, freq, dest, sources, { wave = 'triangle', duty = 0.5, detune = 0 } = {}) {
  const o = ctx.createOscillator();
  if (wave === 'pulse') o.setPeriodicWave(pulseWave(ctx, duty));
  else o.type = wave;
  o.frequency.value = freq;
  o.detune.value = detune;
  o.connect(dest);
  sources.push(o);
  return o;
}

/** Poisson-ish event stream: calls `fire(t)` for every event time in [from, to). */
function stream(rng, start, minGap, maxGap) {
  let next = start + minGap + rng() * (maxGap - minGap);
  return (from, to, fire) => {
    if (next < from) next = from + rng() * (maxGap - minGap);
    while (next < to) {
      fire(next);
      next += minGap + rng() * (maxGap - minGap);
    }
  };
}

/** Fixed-period cycles: calls `fire(k, cycleStart)` for each cycle that starts in [from, to). */
function cycles(start, period) {
  return (from, to, fire) => {
    for (let k = Math.max(0, Math.ceil((from - start) / period - 1e-9)); start + k * period < to; k++) fire(k, start + k * period);
  };
}

const drip = { wave: 'triangle', slide: { semis: -9, time: 0.03 }, a: 0.001, d: 0.04, s: 0, r: 0.02, vol: 0.05 };
const clink = { wave: 'triangle', a: 0.0005, d: 0.15, s: 0, r: 0.03, vol: 0.045 };
const tsk = { wave: 'noise', a: 0.02, d: 0.08, s: 0.3, r: 0.04, vol: 0.15, filter: { type: 'bandpass', freq: 3200, q: 4 } };
const murmur = { wave: 'sine', a: 0.06, d: 0.3, s: 0.4, r: 0.15, vol: 0.06, vib: { delay: 0, rate: 5.5, depth: 30 } };
const slash = { wave: 'noise', a: 0.05, d: 0.5, s: 0.3, r: 0.15, vol: 0.17, filter: { type: 'bandpass', freq: 1800, to: 5200, time: 0.5, q: 3 } };
const sigh = { wave: 'sine', a: 0.1, d: 0.6, s: 0.4, r: 0.3, vol: 0.06, slide: { semis: 5, time: 0.6 } };

/**
 * Ambience builders: (ctx, out, t0, rng) -> {sources, tick(from, to)}.
 * Levels are set so each sits under the text-adventure SFX, never over them.
 */
export const AMBIENCES = Object.freeze({
  none: () => ({ sources: [], tick() {} }),

  rain(ctx, out, t0, rng) {
    const sources = [];
    noiseLoop(ctx, 1, filter(ctx, 'highpass', 500, 0.5, filter(ctx, 'lowpass', 5000, 0.5, gain(ctx, 0.09, out))), sources);
    noiseLoop(ctx, 0.25, filter(ctx, 'bandpass', 1100, 0.6, gain(ctx, 0.07, out)), sources);
    const drips = stream(rng, t0, 0.07, 0.55);
    return {
      sources,
      tick(from, to) {
        drips(from, to, (t) => playHit(ctx, out, t, { freq: 1500 + rng() * 2200, len: 0.02, inst: drip, vol: 0.5 + rng() * 0.8 }));
      },
    };
  },

  wind(ctx, out, t0) {
    const sources = [];
    const level = gain(ctx, 0.22, out);
    lfo(ctx, 0.11, 0.1, level.gain, sources);
    const band = filter(ctx, 'bandpass', 650, 5, level);
    lfo(ctx, 0.07, 350, band.frequency, sources);
    lfo(ctx, 0.19, 150, band.frequency, sources);
    noiseLoop(ctx, 0.5, band, sources);
    const whistle = filter(ctx, 'bandpass', 1400, 14, gain(ctx, 0.12, out));
    lfo(ctx, 0.05, 400, whistle.frequency, sources);
    lfo(ctx, 0.23, 120, whistle.frequency, sources);
    noiseLoop(ctx, 0.7, whistle, sources);
    return { sources, tick() {} };
  },

  drone(ctx, out) {
    const sources = [];
    const lpf = filter(ctx, 'lowpass', 450, 3, gain(ctx, 0.1, out));
    lfo(ctx, 0.05, 200, lpf.frequency, sources);
    const d = noteFreq('D-2');
    osc(ctx, d, lpf, sources, { wave: 'pulse', duty: 0.125 });
    osc(ctx, d, lpf, sources, { wave: 'pulse', duty: 0.25, detune: 7 });
    osc(ctx, noteFreq('A-1'), lpf, sources, { wave: 'triangle', detune: -4 });
    osc(ctx, noteFreq('Eb3'), gain(ctx, 0.08, lpf), sources, { wave: 'triangle', detune: 3 });
    return { sources, tick() {} };
  },

  pub(ctx, out, t0, rng) {
    const sources = [];
    const voices = gain(ctx, 0.09, out);
    lfo(ctx, 3.1, 0.03, voices.gain, sources);
    lfo(ctx, 4.7, 0.025, voices.gain, sources);
    lfo(ctx, 0.23, 0.02, voices.gain, sources);
    noiseLoop(ctx, 0.3, filter(ctx, 'bandpass', 450, 1.2, voices), sources);
    const chatter = gain(ctx, 0.035, out);
    lfo(ctx, 5.3, 0.02, chatter.gain, sources);
    lfo(ctx, 2.2, 0.015, chatter.gain, sources);
    noiseLoop(ctx, 0.35, filter(ctx, 'bandpass', 950, 2, chatter), sources);
    const clinks = stream(rng, t0, 1.5, 5.5);
    return {
      sources,
      tick(from, to) {
        clinks(from, to, (t) => {
          const f = 2500 + rng() * 900;
          playHit(ctx, out, t, { freq: f, len: 0.03, inst: clink });
          playHit(ctx, out, t, { freq: f * 2.71, len: 0.03, inst: clink, vol: 0.5 });
          if (rng() < 0.5) playHit(ctx, out, t + 0.09 + rng() * 0.05, { freq: f * 1.06, len: 0.03, inst: clink, vol: 0.6 });
        });
      },
    };
  },

  heartbeat(ctx, out, t0) {
    const beats = cycles(t0 + 0.1, 60 / 70);
    return { sources: [], tick(from, to) { beats(from, to, (k, t) => playSfx(ctx, out, SFX.heart, t, 0.8)); } };
  },

  // The tally, whispered: 1 tick, 2, 3, 4, then a long hiss like a stroke through them.
  counting(ctx, out, t0, rng) {
    const sources = [];
    const breath = filter(ctx, 'bandpass', 700, 1, gain(ctx, 0.02, out));
    noiseLoop(ctx, 0.2, breath, sources);
    const bars = cycles(t0 + 0.2, 2.4);
    const pitches = ['A-3', 'C-4', 'D-4', 'E-4'].map(noteFreq);
    return {
      sources,
      tick(from, to) {
        bars(from, to, (k, t) => {
          const n = (k % 5) + 1;
          if (n === 5) {
            playHit(ctx, out, t, { midi: 96, len: 0.5, inst: slash });
            playHit(ctx, out, t, { freq: pitches[0] * 2, len: 0.6, inst: sigh });
            return;
          }
          for (let i = 0; i < n; i++) {
            const at = t + i * 0.3 + rng() * 0.02;
            playHit(ctx, out, at, { midi: 96, len: 0.08, inst: tsk });
            playHit(ctx, out, at, { freq: pitches[i], len: 0.18, inst: murmur });
          }
        });
      },
    };
  },
});

/**
 * Start one ambience into `dest` at `t0` with its own fade gain.
 * @param {BaseAudioContext} ctx
 * @param {AudioNode} dest
 * @param {string} id
 * @param {number} t0
 * @param {number} [fadeIn] seconds
 * @returns {{id: string, gain: GainNode, tick: (from: number, to: number) => void, stop: (t: number, fade?: number) => void}}
 */
export function startAmbience(ctx, dest, id, t0, fadeIn = 0) {
  const g = gain(ctx, fadeIn > 0 ? 0 : 1, dest);
  if (fadeIn > 0) {
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(1, t0 + fadeIn);
  }
  const built = AMBIENCES[id](ctx, g, t0, makeRng(0x7a11 + id.length * 977));
  for (const s of built.sources) s.start(t0);
  return {
    id,
    gain: g,
    tick: built.tick,
    stop(t, fade = CROSSFADE) {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0, t + fade);
      for (const s of built.sources) s.stop(t + fade + 0.05);
    },
  };
}

/**
 * Live ambience player with 1 s crossfades.
 * @param {BaseAudioContext} ctx
 * @param {AudioNode} dest
 * @param {{setInterval?: Function, clearInterval?: Function, setTimeout?: Function, lookahead?: number}} [opts]
 */
export function createAmbiencePlayer(ctx, dest, opts = {}) {
  const si = opts.setInterval ?? ((fn, ms) => globalThis.setInterval(fn, ms));
  const ci = opts.clearInterval ?? ((id) => globalThis.clearInterval(id));
  const st = opts.setTimeout ?? ((fn, ms) => globalThis.setTimeout(fn, ms));
  const lookahead = opts.lookahead ?? 1.0;
  let active = null;
  let cursor = 0;
  let timer = null;

  function tick() {
    if (!active) return;
    if (cursor < ctx.currentTime) cursor = ctx.currentTime;
    const horizon = ctx.currentTime + lookahead;
    if (horizon > cursor) {
      active.tick(cursor, horizon);
      cursor = horizon;
    }
  }

  function release(handle, now) {
    handle.stop(now, CROSSFADE);
    st(() => { try { handle.gain.disconnect(); } catch { /* gone */ } }, CROSSFADE * 1000 + 300);
  }

  return {
    get current() { return active ? active.id : 'none'; },
    set(id) {
      if (!AMBIENCES[id] || id === (active ? active.id : 'none')) return;
      const now = ctx.currentTime;
      if (active) release(active, now);
      active = null;
      if (id === 'none') {
        if (timer !== null) { ci(timer); timer = null; }
        return;
      }
      active = startAmbience(ctx, dest, id, now, CROSSFADE);
      cursor = now;
      if (timer === null) timer = si(() => { try { tick(); } catch { /* keep the loop alive */ } }, 200);
      tick();
    },
    dispose() {
      if (timer !== null) ci(timer);
      timer = null;
      if (active) release(active, ctx.currentTime);
      active = null;
    },
  };
}
