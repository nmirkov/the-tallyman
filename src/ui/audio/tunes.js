// TT-013: instruments and tunes, as data. See music.js for the format and synth.js for the
// instrument fields. Everything is in D minor, the key of the Tallyman.
//
// The title theme's hook is the killer's tally: one stroke, two, three, four - then the
// fast descending "slash" through the four (bar 1-2 of the lead). The harmony leans on
// the Andalusian descent (Dm C Bb A), the Neapolitan Eb (bII) and harmonic-minor A7,
// with phrygian-dominant Bb/F over A for the eastern-folk menace.

const pulseArp = (arp, extra = {}) => ({ wave: 'pulse', duty: 0.25, arp, arpRate: 1, a: 0.002, d: 0.16, s: 0.45, r: 0.04, vol: 0.13, ...extra });
const softArp = (arp) => ({ wave: 'pulse', duty: 0.125, arp, arpRate: 1, a: 0.05, d: 0.5, s: 0.55, r: 0.25, vol: 0.09 });

/** Instrument table shared by all tunes. */
export const INSTRUMENTS = Object.freeze({
  // --- voice 1: SID chord arpeggios at 50 Hz -------------------------------------------
  arpm: pulseArp([0, 3, 7]),
  arpM: pulseArp([0, 4, 7]),
  arpd: pulseArp([0, 3, 6]),
  arp7: pulseArp([0, 4, 7, 10]),
  arpsm: softArp([0, 3, 7, 12]),
  arpsM: softArp([0, 4, 7, 12]),
  arps7: softArp([0, 4, 7, 10]),
  arpclu: { wave: 'pulse', duty: 0.25, arp: [0, 1, 6], arpRate: 1, a: 0.02, d: 0.5, s: 0.5, r: 0.3, vol: 0.08 },
  // --- voice 2: triangle bass, with a filtered 12.5 % pulse "bite" for small speakers ----
  bass: { wave: 'triangle', a: 0.002, d: 0.15, s: 0.75, r: 0.03, vol: 0.42, also: 'bassbite' },
  bassbite: { wave: 'pulse', duty: 0.125, a: 0.001, d: 0.09, s: 0.12, r: 0.03, vol: 0.1, filter: { type: 'lowpass', freq: 2600, to: 300, time: 0.12, q: 8 } },
  bassl: { wave: 'triangle', a: 0.01, d: 1.6, s: 0.6, r: 0.6, vol: 0.42, also: 'bassbite' },
  drone: { wave: 'triangle', a: 0.4, d: 1.2, s: 0.8, r: 0.8, vol: 0.4 },
  // --- voice 3: leads ---------------------------------------------------------------------
  lead: { wave: 'pwm', duty: 0.3, pwm: { depth: 0.17, rate: 1.3 }, a: 0.004, d: 0.25, s: 0.72, r: 0.08, vol: 0.34, vib: { delay: 0.2, rate: 5.6, depth: 20 } },
  softlead: { wave: 'pwm', duty: 0.4, pwm: { depth: 0.1, rate: 0.9 }, a: 0.05, d: 0.4, s: 0.65, r: 0.4, vol: 0.3, vib: { delay: 0.25, rate: 5, depth: 14 } },
  ghost: { wave: 'pwm', duty: 0.2, pwm: { depth: 0.12, rate: 0.7 }, a: 0.35, d: 0.8, s: 0.6, r: 0.6, vol: 0.28, vib: { delay: 0.3, rate: 4.5, depth: 15 } },
  sicklead: { wave: 'pwm', duty: 0.15, pwm: { depth: 0.1, rate: 3.3 }, a: 0.03, d: 0.5, s: 0.6, r: 0.4, vol: 0.3, detune: -25, vib: { delay: 0.15, rate: 3.2, depth: 45 } },
  ping: { wave: 'pulse', duty: 0.125, a: 0.001, d: 0.3, s: 0, r: 0.05, vol: 0.16 },
  tolly: { wave: 'pulse', duty: 0.125, a: 0.001, d: 0.9, s: 0, r: 0.1, vol: 0.14 },
  // --- noise voice: Hubbard-style drums ------------------------------------------------
  hat: { wave: 'noise', a: 0.001, d: 0.035, s: 0, r: 0.015, vol: 0.13, filter: { type: 'highpass', freq: 7000, q: 0.7 } },
  shaker: { wave: 'noise', a: 0.005, d: 0.05, s: 0, r: 0.02, vol: 0.07, filter: { type: 'highpass', freq: 5000, q: 0.7 } },
  snare: { wave: 'noise', a: 0.001, d: 0.12, s: 0, r: 0.03, vol: 0.26, also: 'snarebody' },
  snarebody: { wave: 'triangle', transpose: -17, slide: { semis: 7, time: 0.05 }, a: 0.001, d: 0.06, s: 0, r: 0.02, vol: 0.32 },
  kick: { wave: 'triangle', slide: { semis: 24, time: 0.07 }, a: 0.001, d: 0.16, s: 0, r: 0.03, vol: 0.55, also: 'kickclick' },
  kickclick: { wave: 'noise', transpose: 36, a: 0.0005, d: 0.01, s: 0, r: 0.005, vol: 0.2, filter: { type: 'lowpass', freq: 2500, q: 0.7 } },
  tom: { wave: 'triangle', slide: { semis: 12, time: 0.09 }, a: 0.001, d: 0.14, s: 0, r: 0.03, vol: 0.4 },
  thump: { wave: 'triangle', slide: { semis: 12, time: 0.05 }, a: 0.002, d: 0.12, s: 0, r: 0.04, vol: 0.45, filter: { type: 'lowpass', freq: 300, q: 0.7 } },
  breath: { wave: 'noise', a: 0.9, d: 1.6, s: 0, r: 0.3, vol: 0.07, filter: { type: 'bandpass', freq: 900, q: 1.5 } },
  cymbal: { wave: 'noise', a: 0.002, d: 2.5, s: 0, r: 0.4, vol: 0.08, filter: { type: 'highpass', freq: 4000, q: 0.7 } },
  rumble: { wave: 'noise', a: 1.0, d: 2.0, s: 0.3, r: 0.8, vol: 0.22, filter: { type: 'lowpass', freq: 400, to: 120, time: 2.5, q: 1 } },
});

const R = '...';

// ======================================================================================
// TITLE — 28 bars at speed 6 (125 bpm, 16 rows a bar) = 53.76 s loop.
//   Intro  4  Dm  C   Bb  A                    arps + octave bass + hats
//   A      8  Dm  Bb  Gm  A  | Dm  Bb  Eb  A7    lead: the tally motif
//   B      8  Gm  Dm  Bb  A  | Gm  Dm  E°  A7    16th bass, soaring counter-melody
//   Break  4  Dm  Dm  Eb  A7                   soft arps, pumping bass, the count on a bell
//   A'     4  Dm  Bb  Gm  A                    motif again, back round to the intro
// ======================================================================================
const title = {
  speed: 6,
  loop: true,
  tracks: {
    v1: [
      'am', ['aM', -2], ['aM', -4], ['aM', -5],
      'am', ['aM', -4], ['am', -7], ['aM', -5], 'am', ['aM', -4], ['aM', 1], ['a7', -5],
      ['am', -7], 'am', ['aM', -4], ['aM', -5], ['am', -7], 'am', ['ad', 2], ['a7', -5],
      'asm', 'asm', ['asM', 1], ['as7', -5],
      'am', ['aM', -4], ['am', -7], ['a7', -5],
    ],
    v2: [
      'bo', ['bo', -2], ['bo', -4], ['bo', -5],
      'bw', ['bM', -4], ['bw', 5], 'bV', 'bw', ['bM', -4], ['bM', 1], 'bV',
      ['b16', 5], 'b16', ['b16M', -4], ['b16M', -5], ['b16', 5], 'b16', 'bdim', ['b16M', -5],
      'bpump', 'bpump', ['bpump', 1], ['bpump', -5],
      'bw', ['bM', -4], ['bw', 5], 'bV',
    ],
    v3: ['rest4', 'L1', 'L2', 'LB1', 'LB2', 'LBR', 'L1'],
    noise: [
      'dh', 'dh', 'dh', 'df',
      'dk', 'dk', 'dk', 'df', 'dk', 'dk', 'dk', 'df',
      'dk', 'dk', 'dk', 'df', 'dk', 'dk', 'dk', 'df',
      'db', 'db', 'db', 'df',
      'dk', 'dk', 'dk', 'df',
    ],
  },
  patterns: {
    // Arps: chord stabs in a 3-3-2 / 3-3-2 rhythm, transposed per chord.
    am: [['D-4', 3, 'arpm'], ['D-4', 3], ['D-4', 2], ['D-4', 3], ['D-4', 3], ['D-4', 2]],
    aM: [['D-4', 3, 'arpM'], ['D-4', 3], ['D-4', 2], ['D-4', 3], ['D-4', 3], ['D-4', 2]],
    ad: [['D-4', 3, 'arpd'], ['D-4', 3], ['D-4', 2], ['D-4', 3], ['D-4', 3], ['D-4', 2]],
    a7: [['D-4', 3, 'arp7'], ['D-4', 3], ['D-4', 2], ['D-4', 3], ['D-4', 3], ['D-4', 2]],
    asm: [['D-4', 8, 'arpsm'], ['D-4', 8]],
    asM: [['D-4', 8, 'arpsM'], ['D-4', 8]],
    as7: [['D-4', 8, 'arps7'], ['D-4', 8]],

    // Bass. bo: octave bounce; bw/bM: walking minor/major; bV: dominant walking up into D.
    bo: [['D-2', 2, 'bass'], ['D-3', 1], ['D-2', 1], ['D-2', 2], ['D-3', 2], ['D-2', 2], ['D-3', 1], ['D-2', 1], ['A-2', 2], ['C-3', 2]],
    bw: [['D-2', 2, 'bass'], ['D-3', 2], ['C-3', 2], ['A-2', 2], ['F-2', 2], ['A-2', 2], ['D-3', 2], ['C-3', 2]],
    bM: [['D-2', 2, 'bass'], ['D-3', 2], ['A-2', 2], ['F#2', 2], ['D-2', 2], ['F#2', 2], ['A-2', 2], ['C#3', 2]],
    bV: [['A-1', 2, 'bass'], ['A-2', 2], ['E-2', 2], ['A-2', 2], ['G-2', 2], ['E-2', 2], ['C#2', 2], ['E-2', 1], ['C#2', 1]],
    b16: [['D-2', 1, 'bass'], ['D-2', 1], ['D-3', 1], ['D-2', 1], ['A-2', 1], ['D-2', 1], ['D-3', 1], ['D-2', 1],
      ['F-2', 1], ['D-2', 1], ['D-3', 1], ['D-2', 1], ['C-3', 1], ['D-2', 1], ['A-2', 1], ['C-3', 1]],
    b16M: [['D-2', 1, 'bass'], ['D-2', 1], ['D-3', 1], ['D-2', 1], ['A-2', 1], ['D-2', 1], ['D-3', 1], ['D-2', 1],
      ['F#2', 1], ['D-2', 1], ['D-3', 1], ['D-2', 1], ['A-2', 1], ['D-2', 1], ['F#2', 1], ['A-2', 1]],
    bdim: [['E-2', 1, 'bass'], ['E-2', 1], ['E-3', 1], ['E-2', 1], ['Bb2', 1], ['E-2', 1], ['E-3', 1], ['E-2', 1],
      ['G-2', 1], ['E-2', 1], ['E-3', 1], ['E-2', 1], ['Bb2', 1], ['E-2', 1], ['G-2', 1], ['Bb2', 1]],
    bpump: [['D-2', 3, 'bass'], ['D-2', 3], ['D-2', 2], ['D-3', 3], ['D-2', 3], ['C-3', 2]],

    // Lead.
    rest4: [[R, 64]],
    // The tally: 1 stroke, 2, 3 ... 4 quick strokes and the slash down, answered over Gm, A.
    L1: [
      ['D-5', 4, 'lead'], ['F-5', 2], ['F-5', 2], ['E-5', 2], ['E-5', 2], ['E-5', 2], [R, 2],
      ['D-5', 1], ['D-5', 1], ['D-5', 1], ['D-5', 1], ['A-5', 2], ['G-5', 1], ['F-5', 1], ['E-5', 1], ['D-5', 7],
      ['G-5', 3], ['F-5', 1], ['D-5', 4], ['Bb4', 2], ['C-5', 2], ['D-5', 4],
      ['E-5', 2], ['F-5', 2], ['E-5', 2], ['C#5', 2], ['A-4', 8],
    ],
    L2: [
      ['D-5', 4, 'lead'], ['F-5', 2], ['F-5', 2], ['E-5', 2], ['E-5', 2], ['E-5', 2], ['A-4', 2],
      ['D-5', 1], ['D-5', 1], ['D-5', 1], ['D-5', 1], ['Bb5', 2], ['A-5', 1], ['G-5', 1], ['F-5', 1], ['D-5', 7],
      ['G-5', 3], ['F-5', 1], ['Eb5', 4], ['D-5', 2], ['Eb5', 2], ['Bb5', 4],
      ['A-5', 4], ['G-5', 2], ['E-5', 2], ['C#5', 6], ['D-5', 1], ['E-5', 1],
    ],
    LB1: [
      ['D-5', 2, 'lead'], ['G-5', 2], ['Bb5', 8], ['A-5', 2], ['G-5', 2],
      ['A-5', 12], ['F-5', 2], ['E-5', 2],
      ['F-5', 4], ['D-5', 2], ['F-5', 2], ['Bb5', 4], ['A-5', 4],
      ['G-5', 2], ['F-5', 2], ['E-5', 12],
    ],
    LB2: [
      ['D-5', 2, 'lead'], ['G-5', 2], ['Bb5', 8], ['C-6', 2], ['Bb5', 2],
      ['A-5', 8], ['D-6', 4], ['A-5', 4],
      ['Bb5', 4], ['G-5', 4], ['E-5', 4], ['G-5', 2], ['Bb5', 2],
      ['A-5', 2], ['F-5', 2], ['E-5', 2], ['C#5', 10],
    ],
    // Breakdown: the count rung on a bell, then the lead creeps back in via the Neapolitan.
    LBR: [
      ['A-5', 4, 'ping'], [R, 4], ['A-5', 2], ['A-5', 2], [R, 4],
      ['A-5', 2], ['A-5', 2], ['A-5', 2], [R, 2], ['A-5', 1], ['A-5', 1], ['A-5', 1], ['A-5', 1], ['D-6', 4],
      ['Eb5', 8, 'lead'], ['D-5', 8],
      ['C#5', 16],
    ],

    // Drums (noise voice): hats, main beat, breakdown pump, tom fill.
    dh: [['C-7', 2, 'hat'], ['C-7', 2], ['C-7', 2], ['C-7', 2], ['C-7', 2], ['C-7', 2], ['C-7', 2], ['C-7', 2]],
    dk: [['C-2', 2, 'kick'], ['C-7', 2, 'hat'], ['C-5', 2, 'snare'], ['C-7', 2, 'hat'], ['C-7', 2], ['C-2', 2, 'kick'],
      ['C-5', 2, 'snare'], ['C-7', 1, 'hat'], ['C-7', 1]],
    df: [['C-2', 2, 'kick'], ['C-7', 2, 'hat'], ['C-5', 2, 'snare'], ['C-7', 2, 'hat'], ['C-5', 1, 'snare'], ['C-5', 1],
      ['A-3', 1, 'tom'], ['A-3', 1], ['F-3', 1], ['F-3', 1], ['D-3', 1], ['D-3', 1]],
    db: [['C-2', 3, 'kick'], ['C-2', 3], [R, 2], ['C-2', 3], ['C-2', 3], ['C-7', 2, 'hat']],
  },
};

// ======================================================================================
// DREAD — 12 bars at speed 8 (0.16 s rows) = 30.72 s loop. Drone bass, a ghostly lead
// creeping chromatically, and the count rung on a high bell: one, two, three, four, slash.
// ======================================================================================
const dread = {
  speed: 8,
  loop: true,
  tracks: {
    v1: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'],
    v2: ['drone'],
    v3: ['ghost'],
    noise: ['nb', 'nb', 'nh', 'nh'],
  },
  patterns: {
    c1: [['A-5', 4, 'tolly'], [R, 28]],
    c2: [['A-5', 4, 'tolly'], ['A-5', 4], [R, 24]],
    c3: [['A-5', 4, 'tolly'], ['A-5', 4], ['A-5', 4], [R, 20]],
    c4: [['A-5', 4, 'tolly'], ['A-5', 4], ['A-5', 4], ['A-5', 4], [R, 16]],
    c5: [['D-6', 2, 'tolly'], ['Bb5', 2], ['G#5', 2], ['F-5', 2], ['D-5', 8], [R, 16]],
    c6: [[R, 32]],
    drone: [['D-2', 32, 'drone'], ['Eb2', 16], ['D-2', 16], ['D-2', 32], ['Bb1', 16], ['A-1', 16],
      ['D-2', 32], ['Eb2', 16], ['C#2', 16]],
    ghost: [[R, 32], ['D-4', 4, 'ghost'], ['F-4', 4], ['E-4', 8], ['Eb4', 12], ['D-4', 4], [R, 32],
      ['A-4', 4], ['C-5', 4], ['Bb4', 8], ['A-4', 8], ['G#4', 8], [R, 16],
      ['F-4', 4], ['E-4', 4], ['Eb4', 4], ['D-4', 4], ['C#4', 16], [R, 16]],
    nb: [['C-5', 32, 'breath'], [R, 32]],
    nh: [['C-2', 3, 'thump'], ['C-2', 13], ['C-2', 3], ['C-2', 13]],
  },
};

// ======================================================================================
// ENDING_GOOD — 6 bars at speed 7 = 13.44 s. The motif, slowed and gentled, walks
// Dm Bb Gm-A Bb-C and lands on D MAJOR: a Picardy third. Bittersweet, then still.
// ======================================================================================
const endingGood = {
  speed: 7,
  loop: false,
  tracks: {
    v1: ['g_arp'],
    v2: ['g_bass'],
    v3: ['g_lead'],
    noise: ['g_drum'],
  },
  patterns: {
    g_arp: [['D-4', 8, 'arpsm'], ['D-4', 8], ['Bb3', 8, 'arpsM'], ['Bb3', 8], ['G-3', 8, 'arpsm'], ['A-3', 8, 'arpsM'],
      ['Bb3', 8], ['C-4', 8], ['D-4', 16], ['D-4', 16]],
    g_bass: [['D-2', 8, 'bass'], ['A-2', 8], ['Bb1', 8], ['F-2', 8], ['G-2', 8], ['A-2', 8], ['Bb1', 8], ['C-2', 8],
      ['D-2', 32, 'bassl']],
    g_lead: [['D-5', 4, 'softlead'], ['F-5', 2], ['F-5', 2], ['E-5', 8],
      ['D-5', 4], ['F-5', 4], ['Bb5', 4], ['A-5', 4],
      ['G-5', 4], ['F-5', 4], ['E-5', 4], ['C#5', 4],
      ['D-5', 4], ['F-5', 4], ['E-5', 4], ['G-5', 4],
      ['E-5', 4], ['F#5', 28]],
    g_drum: [['C-7', 4, 'shaker'], ['C-7', 4], ['C-7', 4], ['C-7', 4], ['C-7', 4], ['C-7', 4], ['C-7', 4], ['C-7', 4],
      ['C-7', 4], ['C-7', 4], ['C-7', 4], ['C-7', 4], ['C-7', 4], ['C-7', 4], ['C-5', 4, 'snare'], ['C-5', 4],
      ['C-8', 32, 'cymbal']],
  },
};

// ======================================================================================
// ENDING_BAD — 5 bars at speed 8 = 12.8 s. The motif sags a semitone at a time over a
// chromatically falling bass and dies on a tritone (G# over D) under a semitone cluster.
// ======================================================================================
const endingBad = {
  speed: 8,
  loop: false,
  tracks: {
    v1: ['x_arp'],
    v2: ['x_bass'],
    v3: ['x_lead'],
    noise: ['x_drum'],
  },
  patterns: {
    x_arp: [['D-4', 8, 'arpclu'], ['D-4', 8], ['C#4', 8], ['C-4', 8], ['B-3', 8], ['Bb3', 8], ['A-3', 16], ['D-4', 16]],
    x_bass: [['D-2', 8, 'bass'], ['C#2', 8], ['C-2', 8], ['B-1', 8], ['Bb1', 8], ['A-1', 8], ['Ab1', 16], ['D-1', 16, 'bassl']],
    x_lead: [['D-5', 4, 'sicklead'], ['F-5', 2], ['F-5', 2], ['E-5', 8],
      ['Eb5', 4], ['D-5', 2], ['D-5', 2], ['C#5', 8],
      ['C-5', 4], ['B-4', 4], ['Bb4', 8],
      ['A-4', 16],
      ['G#4', 16]],
    x_drum: [['C-2', 8, 'thump'], ['C-2', 8], ['C-2', 8], ['C-2', 8], ['C-2', 8], ['C-2', 8], ['C-2', 8], ['C-2', 8],
      ['C-4', 16, 'rumble']],
  },
};

/** Tunes by music id. */
export const TUNES = Object.freeze({ title, dread, ending_good: endingGood, ending_bad: endingBad });
