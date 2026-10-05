// TT-013: pure parts of the audio module (notes, sequencer maths, tune/SFX data) and
// the facade's never-throw guarantee, run in Node with a fake AudioContext.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNote, noteToMidi, midiToFreq, noteFreq, isRest, FRAME_SECONDS } from '../../src/ui/audio/notes.js';
import { compileTune, rowSeconds, tuneSeconds, eventsInWindow, validateTune, createSequencer } from '../../src/ui/audio/music.js';
import { TUNES, INSTRUMENTS } from '../../src/ui/audio/tunes.js';
import { SFX, sfxEnd } from '../../src/ui/audio/sfx.js';
import { AMBIENCES } from '../../src/ui/audio/ambience.js';
import { SFX_IDS, TUNE_IDS, AMBIENT_IDS as AUDIO_AMBIENT_IDS } from '../../src/ui/audio/ids.js';
import { AMBIENT_IDS } from '../../src/engine/types.js';
import { createAudio } from '../../src/ui/audio/index.js';
import { pulseCoefficients, lfsrNoise, makeRng } from '../../src/ui/audio/synth.js';

const close = (a, b, tol) => Math.abs(a - b) <= tol;

// ---------------------------------------------------------------- fake WebAudio

function fakeParam(v = 0) {
  const p = { value: v, calls: [] };
  for (const m of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime',
    'setTargetAtTime', 'cancelScheduledValues', 'setValueCurveAtTime']) {
    p[m] = (...a) => { p.calls.push([m, ...a]); return p; };
  }
  return p;
}

function fakeNode(ctx, kind, params = []) {
  const n = { kind, connections: [], connect(d) { n.connections.push(d); return d; }, disconnect() { n.connections = []; } };
  for (const p of params) n[p] = fakeParam(p === 'gain' ? 1 : 0);
  ctx.nodes.push(n);
  return n;
}

/** Minimal AudioContext stand-in that records every node and source start. */
class FakeAudioContext {
  constructor() {
    this.nodes = [];
    this.starts = [];
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.state = 'suspended';
    this.destination = { kind: 'destination' };
  }
  resume() { this.state = 'running'; return Promise.resolve(); }
  createGain() { return fakeNode(this, 'gain', ['gain']); }
  createBiquadFilter() { return fakeNode(this, 'filter', ['frequency', 'Q', 'gain', 'detune']); }
  createDelay() { return fakeNode(this, 'delay', ['delayTime']); }
  createWaveShaper() { return fakeNode(this, 'shaper'); }
  createPeriodicWave(re, im) { return { re, im }; }
  createBuffer(ch, len, rate) {
    const data = new Float32Array(len);
    return { numberOfChannels: ch, length: len, sampleRate: rate, getChannelData: () => data };
  }
  #source(kind, params) {
    const n = fakeNode(this, kind, params);
    n.start = (t = 0) => { this.starts.push({ kind, t, node: n }); };
    n.stop = (t = 0) => { n.stopAt = t; };
    n.setPeriodicWave = (w) => { n.wave = w; };
    return n;
  }
  createOscillator() { return this.#source('osc', ['frequency', 'detune']); }
  createBufferSource() { return this.#source('buffer', ['playbackRate', 'detune']); }
}

// ---------------------------------------------------------------- notes

test('notes: A-4 = 440 Hz, C-4 ~ 261.63 Hz, MIDI numbering', () => {
  assert.equal(noteToMidi('A-4'), 69);
  assert.equal(noteToMidi('C-4'), 60);
  assert.equal(noteFreq('A-4'), 440);
  assert.ok(close(noteFreq('C-4'), 261.63, 0.01));
  assert.ok(close(noteFreq('A-3'), 220, 1e-9));
  assert.ok(close(noteFreq('A-5'), 880, 1e-9));
  assert.equal(noteToMidi('C#4'), 61);
  assert.equal(noteToMidi('Db4'), 61);
  assert.equal(noteToMidi('Bb3'), 58);
  assert.equal(noteToMidi('B-3'), 59);
  assert.equal(midiToFreq(69), 440);
  // every semitone of an octave is 2^(1/12) apart
  for (let m = 24; m < 100; m++) assert.ok(close(midiToFreq(m + 1) / midiToFreq(m), 2 ** (1 / 12), 1e-12));
});

test('notes: rests and bad notes', () => {
  assert.ok(isRest('...'));
  assert.ok(isRest('---'));
  assert.ok(isRest(null));
  assert.equal(parseNote('...'), null);
  for (const bad of ['H-4', 'C-', 'c-4', 'C#', 'Cx4', 42, 'A-10']) {
    assert.throws(() => parseNote(bad), /note/i, String(bad));
  }
  assert.equal(FRAME_SECONDS, 0.02);
});

// ---------------------------------------------------------------- sequencer maths

const mini = {
  speed: 6,
  loop: true,
  tracks: {
    v1: ['a', ['a', 5]],
    noise: ['d'],
  },
  patterns: {
    a: [['C-4', 4, 'lead'], ['...', 2], ['E-4', 2]],
    d: [['C-2', 8, 'kick'], ['C-7', 8, 'hat']],
  },
};

test('sequencer: row duration is speed frames at 50 Hz', () => {
  assert.equal(rowSeconds(6), 0.12);
  assert.equal(rowSeconds(5), 0.1);
  assert.ok(close(tuneSeconds(compileTune(mini, INSTRUMENTS)), 16 * 0.12, 1e-9));
});

test('sequencer: compile flattens order lists, applies transposition, drops rests', () => {
  const c = compileTune(mini, INSTRUMENTS);
  assert.equal(c.rows, 16);
  const v1 = c.events.filter((e) => e.voice === 'v1');
  assert.deepEqual(v1.map((e) => [e.row, e.len, e.midi]), [[0, 4, 60], [6, 2, 64], [8, 4, 65], [14, 2, 69]]);
  assert.ok(v1.every((e) => e.inst === 'lead'));
  // events are sorted by row
  for (let i = 1; i < c.events.length; i++) assert.ok(c.events[i].row >= c.events[i - 1].row);
});

test('sequencer: window scheduling is loop-aware and gap-free', () => {
  const c = compileTune(mini, INSTRUMENTS);
  const start = 10;
  const loopSec = 16 * 0.12;
  // Walk two full loops in uneven look-ahead windows; every event must appear exactly once.
  const seen = [];
  let from = start;
  for (const step of [0.05, 0.31, 0.2, 0.77, 0.4, 1.3, 0.9, 0.04]) {
    const to = from + step;
    seen.push(...eventsInWindow(c, start, from, to));
    from = to;
  }
  while (from < start + 2 * loopSec) {
    seen.push(...eventsInWindow(c, start, from, from + 0.25));
    from += 0.25;
  }
  const inTwoLoops = seen.filter((e) => e.time < start + 2 * loopSec - 1e-9);
  assert.equal(inTwoLoops.length, c.events.length * 2);
  const times = inTwoLoops.map((e) => e.time);
  assert.deepEqual(times, [...times].sort((a, b) => a - b));
  // second loop is the first shifted by the loop length
  const firstV1 = inTwoLoops.filter((e) => e.voice === 'v1').map((e) => e.time - start);
  assert.ok(close(firstV1[4], loopSec, 1e-9));
  assert.ok(close(firstV1[1], 6 * 0.12, 1e-9));
});

test('sequencer: one-shot tunes stop after their last row', () => {
  const c = compileTune({ ...mini, loop: false }, INSTRUMENTS);
  const all = eventsInWindow(c, 0, 0, 100);
  assert.equal(all.length, c.events.length);
});

test('sequencer: plays through a fake context with look-ahead and stops cleanly', () => {
  const ctx = new FakeAudioContext();
  const timers = [];
  const seq = createSequencer(ctx, ctx.createGain(), {
    tunes: { mini }, instruments: INSTRUMENTS,
    setInterval: (fn) => { timers.push(fn); return timers.length; },
    clearInterval: (id) => { timers[id - 1] = null; },
  });
  seq.play('mini');
  assert.equal(seq.playing, 'mini');
  const t0 = ctx.starts.length;
  ctx.currentTime = 0.5;
  timers[0]();
  const scheduled = ctx.starts.slice(t0);
  assert.ok(scheduled.length > 0);
  // nothing is scheduled beyond the look-ahead horizon
  assert.ok(scheduled.every((s) => s.t <= 0.5 + seq.lookahead + 1e-9));
  seq.stop();
  assert.equal(seq.playing, null);
  assert.equal(timers[0], null);
});

// ---------------------------------------------------------------- data validation

test('tunes: every tune validates (notes parse, <=3 tone voices + noise, equal track lengths)', () => {
  for (const id of TUNE_IDS) {
    assert.ok(TUNES[id], `missing tune ${id}`);
    assert.deepEqual(validateTune(TUNES[id], INSTRUMENTS), [], id);
    const voices = Object.keys(TUNES[id].tracks);
    assert.ok(voices.length <= 4);
    assert.ok(voices.every((v) => ['v1', 'v2', 'v3', 'noise'].includes(v)));
  }
  assert.deepEqual(Object.keys(TUNES).sort(), [...TUNE_IDS].sort());
});

test('tunes: validateTune reports bad data', () => {
  const bad = {
    speed: 6, loop: true,
    tracks: { v1: ['a'], v2: ['b'], v4: ['a'] },
    patterns: { a: [['H-4', 4, 'lead']], b: [['C-4', 3, 'nosuch']] },
  };
  const errs = validateTune(bad, INSTRUMENTS).join('\n');
  assert.match(errs, /v4/);
  assert.match(errs, /H-4/);
  assert.match(errs, /nosuch/);
  assert.match(errs, /length/);
});

test('tunes: title loop is 45-60 s; endings are short; dread loops', () => {
  const sec = (id) => tuneSeconds(compileTune(TUNES[id], INSTRUMENTS));
  assert.ok(sec('title') >= 45 && sec('title') <= 60, `title ${sec('title')}`);
  assert.equal(TUNES.title.loop, true);
  assert.equal(TUNES.dread.loop, true);
  assert.equal(TUNES.ending_good.loop, false);
  assert.equal(TUNES.ending_bad.loop, false);
  assert.ok(sec('ending_good') <= 25);
  assert.ok(sec('ending_bad') <= 20);
});

test('tunes: title uses an arpeggio instrument, triangle bass, noise percussion', () => {
  const insts = (voice) => new Set(compileTune(TUNES.title, INSTRUMENTS).events.filter((e) => e.voice === voice).map((e) => e.inst));
  assert.ok([...insts('v1')].some((i) => INSTRUMENTS[i].arp), 'arps on v1');
  assert.ok([...insts('v2')].every((i) => INSTRUMENTS[i].wave === 'triangle'), 'triangle bass on v2');
  assert.ok([...insts('noise')].some((i) => INSTRUMENTS[i].wave === 'noise'), 'noise drums');
});

test('ids: SFX list covers the ticket, ambience ids mirror the engine contract', () => {
  for (const id of ['key', 'door', 'creak', 'thunder', 'sting', 'pickup', 'drop', 'footsteps', 'bell', 'phone',
    'scream', 'heart', 'chain', 'hatch', 'splash', 'death', 'victory', 'error', 'tape', 'whisper']) {
    assert.ok(SFX_IDS.includes(id), id);
  }
  assert.deepEqual(Object.keys(SFX).sort(), [...SFX_IDS].sort());
  assert.deepEqual([...AUDIO_AMBIENT_IDS], [...AMBIENT_IDS]);
  assert.deepEqual(Object.keys(AMBIENCES).sort(), [...AMBIENT_IDS].sort());
});

test('sfx: every hit parses and the declared duration matches the data within 10 %', () => {
  for (const id of SFX_IDS) {
    const def = SFX[id];
    assert.ok(def.dur > 0, id);
    for (const h of def.hits) {
      if (h.note !== undefined) assert.ok(parseNote(h.note) !== null, `${id} ${h.note}`);
      else assert.ok(h.freq > 0 || h.steps, `${id} needs a pitch`);
    }
    const end = sfxEnd(def);
    assert.ok(Math.abs(end - def.dur) <= def.dur * 0.1, `${id}: data ends at ${end.toFixed(3)}, declared ${def.dur}`);
  }
});

// ---------------------------------------------------------------- synth helpers

test('synth: pulse Fourier coefficients, LFSR noise, seeded rng', () => {
  const { real, imag } = pulseCoefficients(0.5, 16);
  // a 50 % pulse has only odd harmonics
  for (let n = 2; n < 16; n += 2) assert.ok(Math.abs(real[n]) < 1e-12 && Math.abs(imag[n]) < 1e-12);
  assert.ok(Math.hypot(real[1], imag[1]) > 0.6);
  const noise = lfsrNoise(4096);
  const mean = noise.reduce((a, b) => a + b, 0) / noise.length;
  assert.ok(Math.abs(mean) < 0.1);
  assert.ok(noise.every((v) => v >= -1 && v <= 1));
  assert.ok(new Set(noise).size > 50);
  const a = makeRng(7); const b = makeRng(7);
  for (let i = 0; i < 10; i++) assert.equal(a(), b());
});

// ---------------------------------------------------------------- facade

function exercise(audio) {
  audio.unlock();
  for (const id of SFX_IDS) audio.sfx(id);
  audio.sfx('no_such_sound');
  for (const id of AMBIENT_IDS) audio.ambient(id);
  audio.ambient('no_such_ambient');
  for (const id of TUNE_IDS) audio.music(id);
  audio.music('no_such_tune');
  audio.music('stop');
  audio.sfxLoop('tape');
  audio.sfxLoop('no_such_sound');
  audio.sfxLoop(null);
  audio.sfxLoop('tape');
  audio.setMuted(true);
  audio.setMuted(false);
  audio.setMusicEnabled(false);
  audio.setMusicEnabled(true);
  audio.music('title');
  audio.dispose();
  return audio.muted;
}

const quietConsole = { debug() {}, warn() {} };

test('facade: no AudioContext at all -> every call is a silent no-op', () => {
  const audio = createAudio({ AudioContext: undefined, console: quietConsole });
  assert.doesNotThrow(() => exercise(audio));
  assert.equal(audio.available, false);
});

test('facade: constructor that throws -> no-op, never throws', () => {
  class Boom { constructor() { throw new Error('no audio for you'); } }
  const audio = createAudio({ AudioContext: Boom, console: quietConsole });
  assert.doesNotThrow(() => exercise(audio));
  assert.equal(audio.available, false);
});

test('facade: context whose methods all throw -> never throws', () => {
  class Hostile extends FakeAudioContext {}
  for (const m of ['createGain', 'createOscillator', 'createBufferSource', 'createBiquadFilter', 'createDelay',
    'createWaveShaper', 'createPeriodicWave', 'createBuffer', 'resume']) {
    Hostile.prototype[m] = () => { throw new Error(`${m} exploded`); };
  }
  const audio = createAudio({ AudioContext: Hostile, console: quietConsole, setInterval: () => 0, clearInterval() {} });
  assert.doesNotThrow(() => exercise(audio));
});

test('facade: context whose node methods throw only later (after unlock) -> never throws', () => {
  let armed = false;
  class Flaky extends FakeAudioContext {
    createOscillator() { if (armed) throw new Error('late failure'); return super.createOscillator(); }
    createBufferSource() { if (armed) throw new Error('late failure'); return super.createBufferSource(); }
  }
  const audio = createAudio({ AudioContext: Flaky, console: quietConsole, setInterval: () => 0, clearInterval() {} });
  audio.unlock();
  armed = true;
  assert.doesNotThrow(() => exercise(audio));
});

test('facade: works with a fake context; music waits for unlock; mute and music toggles', () => {
  const ctxs = [];
  class Recording extends FakeAudioContext { constructor() { super(); ctxs.push(this); } }
  const timers = [];
  const audio = createAudio({
    AudioContext: Recording, console: quietConsole,
    setInterval: (fn) => { timers.push(fn); return timers.length; }, clearInterval: (id) => { timers[id - 1] = null; },
  });
  audio.music('title');
  audio.ambient('rain');
  audio.sfx('door');
  assert.equal(ctxs.length, 0, 'no context before the first gesture');
  audio.unlock();
  assert.equal(ctxs.length, 1);
  assert.equal(audio.available, true);
  assert.equal(audio.playing, 'title', 'requested music starts on unlock');
  assert.equal(audio.ambience, 'rain');
  audio.setMusicEnabled(false);
  assert.equal(audio.playing, null);
  audio.music('dread');
  assert.equal(audio.playing, null, 'music disabled: remembered, not played');
  audio.setMusicEnabled(true);
  assert.equal(audio.playing, 'dread');
  const before = ctxs[0].starts.length;
  audio.setMuted(true);
  assert.equal(audio.muted, true);
  audio.sfx('door');
  assert.equal(ctxs[0].starts.length, before, 'muted: sfx not even scheduled');
  audio.setMuted(false);
  audio.sfx('door');
  assert.ok(ctxs[0].starts.length > before);
  audio.sfxLoop('tape');
  assert.equal(audio.looping, 'tape');
  const loopStarts = ctxs[0].starts.length;
  ctxs[0].currentTime += 2;
  timers.filter(Boolean).forEach((fn) => fn());
  assert.ok(ctxs[0].starts.length > loopStarts, 'loop keeps scheduling');
  audio.sfxLoop(null);
  assert.equal(audio.looping, null);
  audio.unlock();
  assert.equal(ctxs.length, 1, 'unlock is idempotent');
  audio.dispose();
});
