// Bundle metadata, rules, zones and HELP (docs/STORY.md §1.6, §1.7, §3.1; A14.3).

export const meta = { id: 'tallyman', title: 'The Tallyman', version: '0.1.0' };

/** STORY §1.6 (`rules.intro`). */
const INTRO = [
  'Thursday 15 November 1984. 21:30.',
  'The last train pulls out of Blackmere and takes its lights with it. Rain. Somewhere above the town, the moor.',
  'Four dead in four weeks, four Thursdays, and a tally scratched beside each: one stroke, two, three, four. The papers call him the Tallyman.',
  'At 20:40 your DI, Frank Harrow, radioed in from the moor road: "I know who it is." Then nothing.',
  'Tonight is the fifth Thursday. You have until midnight.',
  '(Type HELP for instructions.)',
].join('\n\n');

export const rules = {
  start: 'platform',
  money: 500,
  intro: INTRO,
  darkPicture: 'dark',
  nerve: {
    start: 10,
    panicText: 'Your nerve goes. You run.',
    // Beneath has no lamps to run to and never panics, so it gets its own lines (TT-105).
    messages: [
      {
        at: 50,
        text: [
          { if: { zone: 'beneath' }, text: 'Your hands will not stop shaking. The torch beam shakes with them. Breathe.' },
          { text: 'Your hands will not stop shaking. Find some light, somewhere warm.' },
        ],
      },
      {
        at: 75,
        text: [
          { if: { zone: 'beneath' }, text: 'Every shadow down here has a shape now. Think of Frank. Keep going.' },
          { text: 'Every shadow has a shape now. Get back to the lamps.' },
        ],
      },
      { at: 90, text: 'You can hear your own heart. Something is about to give.' },
    ],
  },
};

/** STORY §3.1, transcribed literally. */
export const zones = {
  town: {
    name: 'Town', safeRoom: 'market_square', ambient: 'rain',
    panicText: 'Your nerve goes. You run - blind, splashing, not caring where - and stop only when the orange lamps of Market Square close round you.',
  },
  canal: {
    name: 'Canal', safeRoom: 'towpath', ambient: 'rain',
    panicText: 'Something in the black water moves, or you think it does. You bolt, and come to yourself under the bulb on the towpath, gasping.',
  },
  moor: {
    name: 'Moor', safeRoom: 'moor_road', ambient: 'wind',
    panicText: 'The moor is too big and too dark and it is watching. You run downhill until the town glow is on your face again.',
  },
  mill: {
    name: 'Mill', safeRoom: 'mill_yard', ambient: 'drone',
    panicText: 'The counting is right behind you. You run, and find yourself in the mill yard under the one lamp, shaking.',
  },
  asylum: {
    name: 'Asylum', safeRoom: 'asylum_gates', ambient: 'wind',
    panicText: 'The corridors fold in on you. You scramble, claw, climb, and are outside the gates in the rain before you know how.',
  },
  beneath: {
    name: 'Beneath', panic: false, nerveCap: 99, ambient: 'heartbeat',
    capText: "Your heart hammers, but Harrow's voice holds you here.",
  },
};

/** STORY §1.7 (`help`). */
export const help = [
  'Type short commands: GO NORTH (or N), EXAMINE LEDGER (X LEDGER), TAKE TORCH, SEARCH, READ NOTE, OPEN CABINET, ASK MAGGIE ABOUT SILAS, SHOW CARD TO MAGGIE, GIVE WHISKY TO SILAS, CALL HQ.',
  'Useful: LOOK (L), INVENTORY (I), NOTES (your case notebook), TIME, SCORE, HINT (costs 2 points), WAIT (Z), AGAIN (G), UNDO, SAVE 1-3, LOAD 1-3, EXPORT, IMPORT, RESTART.',
  'Chain commands with THEN or a full stop: TAKE TORCH. W THEN SEARCH.',
  "When you know who it is, ACCUSE them - you'll want at least three pieces of evidence on you. Each command takes thirty seconds. Midnight is turn 300.",
].join('\n\n');
