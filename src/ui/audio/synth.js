// TT-013: SID-like voice engine. Everything here takes an explicit (Offline)AudioContext and
// a destination node, so the same code drives the live game and the offline audition gate.
//
// A "hit" is one gated note: {midi | freq, len (gate seconds), inst, vol?, steps?}.
// An instrument is plain data:
//   wave      'pulse' | 'pwm' | 'triangle' | 'saw' | 'sine' | 'noise'
//   duty      pulse duty 0.125 | 0.25 | 0.5 (PeriodicWave); base duty for 'pwm'
//   pwm       {depth, rate}  duty modulation for wave 'pwm' (saw minus delayed saw)
//   a, d, s, r  ADSR: attack s, decay s (to within 5 % of sustain), sustain level 0..1, release s
//   vol       peak gain
//   arp       semitone offsets cycled every `arpRate` 50 Hz frames (SID chord arpeggio)
//   vib       {delay, rate, depth}  delayed vibrato, depth in cents
//   slide     {semis, time}  start `semis` away and glide to the note (drums, sweeps)
//   filter    {type, freq, q, to?, time?}  per-note biquad, optional exponential sweep
//   detune    cents
//   transpose semitones
//   also      name (or object) of a second instrument triggered with the same note (layering)
// Noise follows the SID: its pitch is the oscillator frequency (LFSR clocked at 16 x f).
import { FRAME_SECONDS, midiToFreq } from './notes.js';

const DUTIES = [0.125, 0.25, 0.5];
const NOISE_LEN = 1 << 16;
const cache = new WeakMap();

/**
 * Fourier series of a pulse wave with the given duty (DC term omitted).
 * @param {number} duty 0..1
 * @param {number} harmonics
 * @returns {{real: Float32Array, imag: Float32Array}}
 */
export function pulseCoefficients(duty, harmonics = 64) {
  const real = new Float32Array(harmonics);
  const imag = new Float32Array(harmonics);
  for (let n = 1; n < harmonics; n++) {
    const x = 2 * Math.PI * n * duty;
    // Tiny residues from sin(n*pi) are noise; flush them so even harmonics of a square are exactly 0.
    const re = Math.sin(x) / (Math.PI * n);
    const im = (1 - Math.cos(x)) / (Math.PI * n);
    real[n] = Math.abs(re) < 1e-9 ? 0 : re;
    imag[n] = Math.abs(im) < 1e-9 ? 0 : im;
  }
  return { real, imag };
}

/**
 * SID-style noise: 23-bit LFSR (taps 22 and 17), 8 output bits mapped to -1..1.
 * @param {number} length samples
 * @returns {Float32Array}
 */
export function lfsrNoise(length) {
  const out = new Float32Array(length);
  let r = 0x7ffff8;
  for (let i = 0; i < length; i++) {
    const bit = ((r >> 22) ^ (r >> 17)) & 1;
    r = ((r << 1) | bit) & 0x7fffff;
    const byte = (((r >> 22) & 1) << 7) | (((r >> 20) & 1) << 6) | (((r >> 16) & 1) << 5) | (((r >> 13) & 1) << 4)
      | (((r >> 11) & 1) << 3) | (((r >> 7) & 1) << 2) | (((r >> 4) & 1) << 1) | ((r >> 2) & 1);
    out[i] = byte / 127.5 - 1;
  }
  return out;
}

/**
 * Small seeded PRNG (mulberry32) for deterministic "random" drips, clinks and tape noise.
 * @param {number} seed
 * @returns {() => number} uniform in [0, 1)
 */
export function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Lazily built per-context assets: pulse PeriodicWaves and the looping LFSR noise buffer. */
function assets(ctx) {
  let a = cache.get(ctx);
  if (!a) {
    a = { pulse: new Map(), noise: null };
    for (const d of DUTIES) {
      const { real, imag } = pulseCoefficients(d);
      a.pulse.set(d, ctx.createPeriodicWave(real, imag));
    }
    const buf = ctx.createBuffer(1, NOISE_LEN, ctx.sampleRate);
    buf.getChannelData(0).set(lfsrNoise(NOISE_LEN));
    a.noise = buf;
    cache.set(ctx, a);
  }
  return a;
}

/**
 * The context's looping LFSR noise buffer (white at playbackRate 1).
 * @param {BaseAudioContext} ctx
 * @returns {AudioBuffer}
 */
export function noiseBuffer(ctx) {
  return assets(ctx).noise;
}

/**
 * A pulse PeriodicWave (duty 0.125, 0.25 or 0.5).
 * @param {BaseAudioContext} ctx
 * @param {number} duty
 * @returns {PeriodicWave}
 */
export function pulseWave(ctx, duty) {
  return assets(ctx).pulse.get(duty) || assets(ctx).pulse.get(0.5);
}

/** Soft-knee safety limiter curve: linear to 0.85, then eases into a 0.98 ceiling. */
function softClipCurve(points = 2049) {
  const c = new Float32Array(points);
  for (let i = 0; i < points; i++) {
    const x = (i / (points - 1)) * 2 - 1;
    const ax = Math.abs(x);
    const y = ax <= 0.85 ? ax : 0.85 + 0.13 * Math.tanh((ax - 0.85) / 0.13);
    c[i] = Math.sign(x) * y;
  }
  return c;
}

function gainNode(ctx, value, dest) {
  const g = ctx.createGain();
  g.gain.value = value;
  if (dest) g.connect(dest);
  return g;
}

/**
 * Master graph: music / sfx / ambience buses -> master -> DC block -> warm low-pass -> limiter.
 * @param {BaseAudioContext} ctx
 * @param {AudioNode} [destination] defaults to ctx.destination
 * @returns {{master: GainNode, music: GainNode, sfx: GainNode, ambience: GainNode}}
 */
export function createChain(ctx, destination = ctx.destination) {
  const shaper = ctx.createWaveShaper();
  shaper.curve = softClipCurve();
  shaper.connect(destination);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 7200;
  lp.Q.value = 0.6;
  lp.connect(shaper);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 22;
  hp.Q.value = 0.7;
  hp.connect(lp);
  const master = gainNode(ctx, 0.9, hp);
  return {
    master,
    music: gainNode(ctx, 1, master),
    sfx: gainNode(ctx, 1, master),
    ambience: gainNode(ctx, 1, master),
  };
}

/** Schedule the pitch curve of a hit onto `param` (Hz times `scale`). */
function schedulePitch(param, t, end, freq, inst, hit, scale) {
  if (hit.steps) {
    for (const [dt, hz] of hit.steps) param.setValueAtTime(hz * scale, t + dt);
    return;
  }
  if (inst.arp && inst.arp.length) {
    const step = FRAME_SECONDS * (inst.arpRate || 1);
    const n = inst.arp.length;
    for (let i = 0; t + i * step < end; i++) param.setValueAtTime(freq * 2 ** (inst.arp[i % n] / 12) * scale, t + i * step);
    return;
  }
  if (inst.slide) {
    param.setValueAtTime(freq * 2 ** (inst.slide.semis / 12) * scale, t);
    param.exponentialRampToValueAtTime(freq * scale, t + inst.slide.time);
    return;
  }
  param.setValueAtTime(freq * scale, t);
}

/** Build the sound source for an instrument; returns {out, pitch, scale, detune, sources}. */
function makeSource(ctx, inst, freq) {
  const wave = inst.wave || 'pulse';
  if (wave === 'noise') {
    const src = ctx.createBufferSource();
    src.buffer = assets(ctx).noise;
    src.loop = true;
    return { out: src, pitch: src.playbackRate, scale: 16 / ctx.sampleRate, detune: src.detune, sources: [src] };
  }
  const osc = ctx.createOscillator();
  if (wave === 'pulse') osc.setPeriodicWave(pulseWave(ctx, inst.duty || 0.5));
  else if (wave === 'pwm') osc.type = 'sawtooth';
  else osc.type = wave === 'saw' ? 'sawtooth' : wave;
  if (wave !== 'pwm') return { out: osc, pitch: osc.frequency, scale: 1, detune: osc.detune, sources: [osc] };

  // Real pulse-width modulation: pulse = saw(t) - saw(t - duty/f), the delay swept by an LFO.
  const mix = gainNode(ctx, 0.5);
  osc.connect(mix);
  const delay = ctx.createDelay(0.1);
  delay.delayTime.value = (inst.duty || 0.5) / freq;
  const inv = gainNode(ctx, -0.5, mix);
  osc.connect(delay);
  delay.connect(inv);
  const sources = [osc];
  if (inst.pwm) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = inst.pwm.rate;
    lfo.connect(gainNode(ctx, inst.pwm.depth / freq, delay.delayTime));
    sources.push(lfo);
  }
  return { out: mix, pitch: osc.frequency, scale: 1, detune: osc.detune, sources };
}

/**
 * Schedule one gated note. Returns the time the sound has fully ended.
 * @param {BaseAudioContext} ctx
 * @param {AudioNode} dest
 * @param {number} t start time (ctx seconds)
 * @param {{midi?: number, freq?: number, len: number, inst: object|string, vol?: number, steps?: Array<[number, number]>}} hit
 * @param {Record<string, object>} [instruments] lookup for string instruments and `also`
 * @param {number} [depth] layering depth guard (internal)
 * @returns {number}
 */
export function playHit(ctx, dest, t, hit, instruments = {}, depth = 0) {
  const inst = typeof hit.inst === 'string' ? instruments[hit.inst] : hit.inst;
  if (!inst || depth > 3) return t;
  const semis = inst.transpose || 0;
  const freq = hit.freq !== undefined ? hit.freq * 2 ** (semis / 12) : midiToFreq((hit.midi ?? 69) + semis);
  const a = Math.max(inst.a ?? 0.002, 0.0005);
  const d = inst.d ?? 0.1;
  const s = inst.s ?? 0;
  const r = Math.max(inst.r ?? 0.02, 0.003);
  const peak = (inst.vol ?? 0.3) * (hit.vol ?? 1);
  const gate = Math.max(hit.len, 0.001);
  const aEff = Math.min(a, gate);
  const off = t + gate;
  const end = off + r;

  const src = makeSource(ctx, inst, freq);
  const env = gainNode(ctx, 0, dest);
  let tail = src.out;
  if (inst.filter) {
    const f = ctx.createBiquadFilter();
    f.type = inst.filter.type || 'lowpass';
    f.Q.value = inst.filter.q ?? 0.7;
    f.frequency.setValueAtTime(inst.filter.freq, t);
    if (inst.filter.to) f.frequency.exponentialRampToValueAtTime(inst.filter.to, t + (inst.filter.time || gate));
    tail.connect(f);
    tail = f;
  }
  tail.connect(env);

  // ADSR. The level at gate-off is computed analytically so the release starts where the decay is.
  const g = env.gain;
  const atPeak = peak * (aEff / a);
  g.setValueAtTime(0, t);
  g.linearRampToValueAtTime(atPeak, t + aEff);
  let level = atPeak;
  if (gate > aEff && d > 0) {
    const sus = peak * s;
    g.setTargetAtTime(sus, t + aEff, d / 3);
    level = sus + (atPeak - sus) * Math.exp(-(gate - aEff) * 3 / d);
  }
  g.setValueAtTime(level, off);
  g.linearRampToValueAtTime(0, end);

  schedulePitch(src.pitch, t, end, freq, inst, hit, src.scale);
  if (inst.detune) src.detune.setValueAtTime(inst.detune, t);
  if (inst.vib && gate > inst.vib.delay) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = inst.vib.rate;
    const depth = gainNode(ctx, 0, src.detune);
    depth.gain.setValueAtTime(0, t + inst.vib.delay);
    depth.gain.linearRampToValueAtTime(inst.vib.depth, t + inst.vib.delay + 0.25);
    lfo.connect(depth);
    src.sources.push(lfo);
  }
  for (const n of src.sources) {
    n.start(t);
    n.stop(end + 0.02);
  }

  let last = end;
  if (inst.also) {
    const layer = typeof inst.also === 'string' ? instruments[inst.also] : inst.also;
    if (layer) last = Math.max(last, playHit(ctx, dest, t, { ...hit, inst: layer }, instruments, depth + 1));
  }
  return last;
}
