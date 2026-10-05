// Daemon-world fixture (TT-010): a small ContentBundle that exercises every per-turn system
// of A7.6 with the Tallyman's own encodings (A14.3, STORY §6.3, §8.4, §9):
// - panic in two zones (town with a zone panicText, mill with the rules panicText), a
//   Beneath cap zone (panic: false, nerveCap 99, capText), safe rooms, nerve messages;
// - Pike's schedule (leaves at 240 if still at the desk, arrives 10 turns later) and the
//   `fled` route (correct ACCUSE at the Police House, arrival 5 turns later), both as data;
// - STORY §8.4's story daemons transcribed literally: `pike_arrives`, then the attack
//   counter (lit: warn 2, 3, lunge 4 with nerve +20, fatal 5; dark: warn 1, fatal 2);
// - the Counting Room's onEnter greeting and Harrow's bleeding cue, the iron door gate;
// - beats of every kind: `at`, `at` + `when`, `every` + `when` with RNG (`chance`, `pick`),
//   a once-only `when` beat;
// - a fuel-limited lantern (D5) and an endless torch;
// - the four `when` endings in precedence order (victory → pyrrhic → got-away → fifth
//   stroke) plus wrong-man and death endings.
//
// Map (lit unless noted):
//
//   [police_house]
//        | n/s
//   [square]S -- e/w -- [lane] (dark, nerve +10)
//        | s/n
//   [yard]S -- e/w -- [shed] (dark, nerve +20)
//        | d/u
//   [tunnel] (dark, beneath) -- n/s (barred until Pike is inside) -- [counting_room] (dark, beneath)

import { MIDNIGHT_TURN } from '../../src/engine/types.js';

/** Plain 40×h picture made of ASCII glyphs. @param {string} id @param {number} [h] */
function art(id, h = 9) {
  const chars = [];
  const colors = [];
  for (let y = 0; y < h; y++) {
    chars.push((y === 0 ? '-' : y === h - 1 ? '#' : ' ').repeat(40));
    colors.push((y % 2 ? '7' : 'e').repeat(40));
  }
  return { id, w: 40, h, chars, colors, bg: '0' };
}

/* STORY §8.4 — shared reaction (transcribed). */
const BLEED_CUE = {
  if: [{ turnGte: 180 }, { var: 'harrowFreed', eq: false }], style: 'alert',
  say: "Harrow's head has dropped. When he lifts it, it takes him a long time. His breathing is shallower now.",
};

export const TEXTS = Object.freeze({
  greeting: 'Pike turns from the wall. He has taken off his tunic and folded it on the wages table, and he holds a long butcher\'s knife low against his leg. "You\'re early, Sergeant," he says. "I\'ve one more to count."',
  reentry: 'Pike is waiting for you, knife low. He has started counting again.',
  bleed: BLEED_CUE.say,
  warn2: 'He circles, knife low. "One," he says, matching your steps. "Two."',
  warn3: '"Three," says Pike, and takes a step closer. Behind him Harrow is trying to say something. Do something.',
  lunge: 'He lunges. The knife opens your sleeve and the arm under it, and you feel nothing at all, which frightens you more. "Four," he says. Next time it will not be your arm.',
  dark1: 'In the dark the counting is suddenly very close. "One..." Light. You need light, now.',
  arriveTunnel: 'Beyond the iron door a beam scrapes and thuds against brick. The door shifts in its frame and stands ajar. Harrow has stopped praying.',
  leave: 'Pike looks at the clock. "Half eleven. That\'s me off on my rounds, Sergeant. Pull the door to if you go."',
  barred: 'The iron door is barred from the other side. Beyond it, Harrow is praying.',
  capText: "Your heart hammers, but Harrow's voice holds you here.",
  townPanic: 'Your nerve goes. You run - blind, splashing - and stop only when the orange lamps of the square close round you.',
  rulesPanic: 'Your nerve goes. You run.',
  lanternOut: 'The lantern gutters and dies.',
  fog: 'For a moment a figure stands in the fog at the end of the lane. Then there is only fog.',
  bell: "Across the town, St Jude's bell tolls ten. Two hours.",
  pikeClock: 'Pike glances up at the clock. "Not long now," he says, to nobody.',
});

/** @type {import('../../src/engine/types.js').ContentBundle} */
const daemonWorld = {
  meta: { id: 'daemons', title: 'Daemon World', version: '1' },
  rules: {
    start: 'square',
    intro: 'Rain. It is {time}.',
    money: 0,
    nerve: {
      start: 10,
      panicText: TEXTS.rulesPanic,
      messages: [
        { at: 75, text: 'Every shadow has a shape now.' },
        { at: 50, text: 'Your hands will not stop shaking.' },
        { at: 90, text: 'You can hear your own heart.' },
      ],
    },
  },
  zones: {
    town: { name: 'Town', safeRoom: 'square', ambient: 'rain', panicText: TEXTS.townPanic },
    mill: { name: 'Mill', safeRoom: 'yard', ambient: 'drone' },
    beneath: { name: 'Beneath', panic: false, nerveCap: 99, ambient: 'heartbeat', capText: TEXTS.capText },
  },
  rooms: {
    square: {
      name: 'Market Square', zone: 'town', picture: 'square',
      desc: 'Orange lamps over wet cobbles.',
      exits: { n: 'police_house', e: 'lane', s: 'yard' },
    },
    police_house: {
      name: 'Police House', zone: 'town', picture: 'police_house', ambient: 'none',
      desc: [
        { if: { var: 'pikeState', eq: 'desk' }, text: 'A counter, a clock, a kettle.' },
        { text: 'A counter, a clock, a kettle. The chair behind the counter is empty.' },
      ],
      exits: { s: 'square' },
    },
    lane: {
      name: 'Dark Lane', zone: 'town', picture: 'lane', dark: true, nerve: 10,
      desc: 'A lane between blind walls.',
      exits: { w: 'square' },
    },
    yard: {
      name: 'Mill Yard', zone: 'mill', picture: 'yard',
      desc: 'One lamp over the mill yard. A hatch leads down.',
      exits: { n: 'square', e: 'shed', d: 'tunnel' },
    },
    shed: {
      name: 'Weaving Shed', zone: 'mill', picture: 'shed', dark: true, nerve: 20,
      desc: 'Looms under dust sheets.',
      exits: { w: 'yard' },
    },
    tunnel: {
      name: 'Tunnel', zone: 'beneath', picture: 'tunnel', dark: true,
      desc: [
        { if: { at: ['pike', 'counting_room'] }, text: 'A brick tunnel. The iron door to the north stands ajar.' },
        { text: 'A brick tunnel ending at an iron door. Behind it, very faint, a man is praying.' },
      ],
      exits: {
        u: 'yard',
        n: { to: 'counting_room', if: { at: ['pike', 'counting_room'] }, msg: TEXTS.barred },
      },
    },
    counting_room: {
      name: 'Counting Room', zone: 'beneath', picture: 'counting_room', dark: true, nerve: 5,
      desc: 'Four great strokes cut into the brick. Harrow hangs in chains beneath them.',
      exits: { s: 'tunnel' },
      // STORY §8.4 (transcribed): greeting first, then the bleeding cue.
      onEnter: [
        { if: [{ var: 'pikeState', eq: 'counting' }, '!pike_greeted'], setFlag: 'pike_greeted', sfx: 'sting', style: 'alert',
          say: TEXTS.greeting, then: BLEED_CUE },
        { if: { var: 'pikeState', eq: 'counting' }, style: 'alert', say: TEXTS.reentry, then: BLEED_CUE },
        BLEED_CUE,
      ],
    },
  },
  items: {
    warrant_card: {
      name: 'warrant card', names: ['card', 'warrant card'], personal: true, location: 'player',
      desc: 'Detective Sergeant, Manchester CID.',
    },
    torch: {
      name: 'torch', names: ['torch', 'flashlight'], critical: true, location: 'police_house',
      desc: 'A police torch.', light: { lit: false },
    },
    lantern: {
      name: 'lantern', names: ['lantern', 'lamp'], adjectives: ['storm'], location: 'square',
      desc: 'A storm lantern.', light: { lit: false, fuel: 3, outText: TEXTS.lanternOut },
    },
    handcuffs: {
      name: 'handcuffs', names: ['handcuffs', 'cuffs'], article: 'some', critical: true,
      location: 'police_house', desc: 'Harrow\'s handcuffs.',
    },
    cutters: {
      name: 'bolt cutters', names: ['cutters', 'bolt cutters'], adjectives: ['bolt'], article: 'some',
      critical: true, location: 'shed', desc: 'Long-handled bolt cutters.',
    },
    button: {
      name: 'silver button', names: ['button'], adjectives: ['silver'], location: 'yard',
      desc: 'A silver tunic button.',
    },
  },
  npcs: {
    pike: {
      name: 'Pike', names: ['pike', 'arthur', 'constable'], proper: true, location: 'police_house',
      desc: 'A big young constable.',
      here: [
        { if: { var: 'pikeState', eq: 'restrained' }, text: 'Arthur Pike kneels by the wall in handcuffs.' },
        { if: { var: 'pikeState', eq: 'counting' }, text: 'Arthur Pike stands between you and Harrow, a long knife held low.' },
        { text: 'PC Arthur Pike sits behind the counter, tapping a pencil.' },
      ],
      // STORY §6.3 (transcribed; arrival delay for `left` is 10).
      schedule: [{
        at: 240, to: null, if: { var: 'pikeState', eq: 'desk' }, leaveText: TEXTS.leave,
        do: { setVar: { pikeState: 'left', pikeArrivalTurn: { turnPlus: 10 } } },
      }],
      before: {
        arrest: [
          { if: { var: 'pikeState', eq: 'restrained' }, say: 'He is going nowhere.' },
          { if: [{ var: 'pikeState', eq: 'counting' }, { carried: 'handcuffs' }],
            setVar: { pikeState: 'restrained' }, award: 'arrest', say: 'You get the cuffs on him.' },
          { if: { var: 'pikeState', eq: 'counting' }, say: "With what? Harrow croaks: 'Cuffs - in my car!'" },
          'Not yet. You need more than a hunch.',
        ],
      },
    },
    harrow: {
      name: 'Harrow', names: ['harrow', 'frank'], proper: true, location: 'counting_room',
      desc: 'DI Frank Harrow, in chains.',
      here: [
        { if: { var: 'harrowFreed', eq: true }, text: 'Harrow sits against the wall, rubbing his wrists.' },
        { text: 'Harrow hangs in chains against the wall.' },
      ],
      before: {
        free: [
          { if: { var: 'harrowFreed', eq: true }, say: 'He is already free.' },
          { if: { carried: 'cutters' }, setVar: { harrowFreed: true }, award: 'freed', say: 'The chains part. Harrow slides down the wall.' },
          'With what? The chains are thick as your thumb.',
        ],
      },
    },
  },
  vars: {
    pikeState: { type: 'enum', values: ['desk', 'fled', 'left', 'counting', 'restrained'], init: 'desk' },
    pikeArrivalTurn: { type: 'int', nullable: true, min: 0, init: null },
    attack: { type: 'int', min: 0, init: 0 },
    harrowFreed: { type: 'bool', init: false },
  },
  evidence: {
    ev_button: { label: 'Silver tunic button', item: 'button', award: 'button' },
  },
  scoring: {
    maxScore: 35, hintCost: 2,
    awards: {
      button: { points: 5, label: 'Found the button' },
      accusation: { points: 10, label: 'Named the killer' },
      arrest: { points: 10, label: 'Arrested Pike' },
      freed: { points: 10, label: 'Freed Harrow' },
    },
    ranks: [{ min: 0, title: 'Probationer' }, { min: 20, title: 'Sergeant' }, { min: 35, title: 'Inspector' }],
  },
  case: {
    culprit: 'pike', threshold: 1, suspects: [],
    confirm: 'Are you certain? (Y/N)',
    // STORY §8.1 / A14.3 (transcribed, prose shortened).
    correct: [
      { if: { in: 'police_house' }, sfx: 'sting', award: 'accusation', move: { pike: null },
        setVar: { pikeState: 'fled', pikeArrivalTurn: { turnPlus: 5 } }, say: 'He vaults the counter and is gone into the rain.' },
      { award: 'accusation', say: '"Four," he says. "You forgot one."' },
    ],
    weak: { nerve: 15, say: 'Pike laughs. "On what, Sergeant? A feeling?"' },
    wrong: { end: 'wrong_man' },
  },
  // STORY §9.1 shapes (subset, transcribed where the rooms exist).
  beats: [
    { id: 'bell_22', at: 60, run: { sfx: 'bell', say: TEXTS.bell } },
    { id: 'pike_clock', at: 210, when: [{ present: 'pike' }, { var: 'pikeState', eq: 'desk' }], run: { say: TEXTS.pikeClock } },
    { id: 'thunder', every: 4, when: { zone: 'town' },
      run: { chance: 0.5, sfx: 'thunder', pick: ['Thunder rolls over the moor.', 'Lightning, far off. You count without meaning to.', 'The rain thickens.'] } },
    { id: 'counting_dark', every: 3, when: { in: ['lane', 'shed', 'tunnel'] },
      run: { chance: 0.5, sfx: 'whisper', style: 'whisper', pick: ['Somewhere in the dark, someone is counting.', 'Footsteps behind you. You stop. They stop.'] } },
    { id: 'fog_figure', when: [{ in: 'lane' }, { turnGte: 5 }], run: { sfx: 'sting', nerve: 10, say: TEXTS.fog } },
    { id: 'harrow_bleeds', every: 20, when: [{ in: 'counting_room' }, { var: 'harrowFreed', eq: false }],
      run: { style: 'alert', pick: ["Harrow's breathing is shallower now.", 'Harrow coughs, and there is something wet in it.'] } },
  ],
  // STORY §8.4 (transcribed literally): step D4, `pike_arrives` then `attack`.
  daemons: [
    { id: 'pike_arrives', run: {
      if: [{ var: 'pikeState', oneOf: ['fled', 'left'] }, { turnGte: { var: 'pikeArrivalTurn' } }],
      move: { pike: 'counting_room' }, setVar: { pikeState: 'counting' },
      then: [
        { if: { in: 'tunnel' }, sfx: 'door', style: 'alert', say: TEXTS.arriveTunnel },
      ] } },
    { id: 'attack', run: {
      if: [{ in: 'counting_room' }, { var: 'pikeState', eq: 'counting' }],
      setVar: { attack: { add: 1 } },
      then: [
        { if: [{ lit: true }, { var: 'attack', gte: 5 }], sfx: 'scream', end: 'death_pike' },
        { if: [{ lit: true }, { var: 'attack', eq: 4 }], style: 'alert', nerve: 20, sfx: 'sting', say: TEXTS.lunge },
        { if: [{ lit: true }, { var: 'attack', eq: 3 }], style: 'alert', say: TEXTS.warn3 },
        { if: [{ lit: true }, { var: 'attack', eq: 2 }], style: 'alert', say: TEXTS.warn2 },
        { if: [{ lit: false }, { var: 'attack', gte: 2 }], sfx: 'scream', end: 'death_pike' },
        { if: [{ lit: false }, { var: 'attack', eq: 1 }], style: 'alert', say: TEXTS.dark1 },
      ] } },
  ],
  endings: [
    { id: 'victory', kind: 'victory', title: 'The Tally Settled', text: 'You walk them both out.',
      when: [{ var: 'pikeState', eq: 'restrained' }, { var: 'harrowFreed', eq: true }] },
    { id: 'pyrrhic', kind: 'midnight', title: 'Paid in Full', text: 'Midnight. You have your man.',
      when: [{ turnGte: MIDNIGHT_TURN }, { var: 'pikeState', eq: 'restrained' }] },
    { id: 'got_away', kind: 'midnight', title: 'The One That Got Away', text: 'Midnight. Pike is gone.',
      when: [{ turnGte: MIDNIGHT_TURN }, { var: 'harrowFreed', eq: true }] },
    { id: 'fifth_stroke', kind: 'midnight', title: 'The Fifth Stroke', text: 'Midnight. St Jude\'s strikes twelve.',
      when: { turnGte: MIDNIGHT_TURN } },
    { id: 'wrong_man', kind: 'wrong', title: 'The Wrong Man', text: 'You arrested the wrong person.' },
    { id: 'death_pike', kind: 'death', title: 'Counted',
      text: [{ if: { lit: true }, text: '"Five," says Pike.' }, { text: '"Two," says Pike, in the dark.' }] },
  ],
  art: {
    square: art('square'),
    police_house: art('police_house'),
    lane: art('lane'),
    yard: art('yard'),
    shed: art('shed'),
    tunnel: art('tunnel'),
    counting_room: art('counting_room'),
  },
};

export { daemonWorld };
export default daemonWorld;
