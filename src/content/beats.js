// Scripted beats (step D2) and story daemons (step D4) (docs/STORY.md §8.4, §9; A4.12).
// Array order is STORY's. RNG only via `chance` / `pick`.

export const beats = [
  { id: 'bell_22', at: 60, run: { sfx: 'bell', say: "Across the town, St Jude's bell tolls ten. Two hours." } },
  { id: 'bell_23', at: 180, run: { sfx: 'bell', style: 'alert', say: "St Jude's tolls eleven, slow and flat through the rain. One hour to midnight." } },
  { id: 'bell_2330', at: 240, run: { sfx: 'bell', style: 'alert', say: "A single stroke from St Jude's. Half past eleven." } },
  { id: 'bell_2345', at: 270, run: { sfx: 'bell', style: 'alert', say: "St Jude's strikes the quarter. Fifteen minutes." } },
  { id: 'last_5', at: 290, run: { sfx: 'heart', style: 'alert', say: 'Five minutes to midnight. You can feel it in your teeth.' } },
  {
    id: 'pike_clock', at: 210, when: [{ present: 'pike' }, { var: 'pikeState', eq: 'desk' }],
    run: { say: 'Pike glances up at the clock, and his thumb rubs at his tunic where a button should be. "Not long now," he says, to nobody.' },
  },
  {
    id: 'thunder', every: 23, when: { any: [{ zone: 'town' }, { zone: 'canal' }, { zone: 'moor' }] },
    run: {
      chance: 0.5, sfx: 'thunder',
      pick: [
        'Thunder rolls over the moor.',
        'Lightning, far off. You count without meaning to - one, two, three, four - and the thunder comes.',
        'The rain thickens. Thunder grumbles somewhere over Ashcombe.',
      ],
    },
  },
  {
    id: 'counting_dark', every: 9, when: { in: ['crypt', 'weaving_shed', 'boiler_room', 'ward', 'morgue', 'tunnel'] },
    run: {
      chance: 0.5, sfx: 'whisper', style: 'whisper',
      pick: [
        'Somewhere in the dark, someone is counting. "...three... four..."',
        'Footsteps behind you. You stop. They stop.',
        '"...one, two, three, four..." A pause. Then, very softly, "...four..."',
      ],
    },
  },
  {
    id: 'counting_late', every: 10, when: [{ turnGte: 180 }, { not: { zone: 'beneath' } }],
    run: {
      chance: 0.4, sfx: 'whisper', style: 'whisper',
      pick: [
        'Under the rain, under everything, a voice is counting. It is nearer than it was.',
        'You find you are counting your own steps. You make yourself stop.',
        'A smell of scorched cotton, from nowhere, and gone.',
      ],
    },
  },
  // Cosmetic only (PLAN §2.2 #1): the torch never actually fails.
  {
    id: 'torch_flicker', every: 7, when: [{ turnGte: 180 }, { carried: 'torch' }, { on: 'torch' }],
    run: { chance: 0.5, say: 'Your torch flickers, browns out, and steadies again.' },
  },
  {
    id: 'fog_figure', when: [{ in: 'tally_stone' }, { turnGte: 30 }],
    run: { sfx: 'sting', nerve: 10, say: 'For a moment a figure stands in the fog beyond the stone - tall, quite still, a cape on its shoulders. Then there is only fog.' },
  },
  {
    id: 'towpath_steps', when: [{ in: 'towpath' }, { turnGte: 60 }],
    run: { sfx: 'footsteps', say: 'Footsteps on the towpath behind you, measured, unhurried. You turn: the bulb, the rain, the black water. Nobody. The footsteps have stopped too.' },
  },
  {
    id: 'stone_girl', when: [{ in: 'churchyard' }, { visited: 'weaving_shed' }],
    run: { say: "The stone girl's worn face seems turned a fraction further towards the mill than it was. It must always have been like that." },
  },
  {
    id: 'harrow_bleeds', every: 20, when: [{ in: 'counting_room' }, { var: 'harrowFreed', eq: false }],
    run: {
      style: 'alert',
      pick: [
        "Harrow's breathing is shallower now.",
        "Harrow coughs, and there is something wet in it. He looks at you and doesn't say anything, which is worse.",
        "The stain at Harrow's side has reached the floor.",
      ],
    },
  },
];

/** Step D4, in this order: Pike's arrival, then the attack counter (STORY §8.4, A14.3). */
export const daemons = [
  {
    id: 'pike_arrives',
    run: {
      if: [{ var: 'pikeState', oneOf: ['fled', 'left'] }, { turnGte: { var: 'pikeArrivalTurn' } }],
      move: { pike: 'counting_room' }, setVar: { pikeState: 'counting' },
      then: [
        { if: { in: 'counting_house' }, sfx: 'hatch', style: 'alert', say: 'Under your feet the iron trap shudders. Something heavy climbs down beneath it, and a bolt slides home.' },
        { if: { in: 'tunnel' }, sfx: 'door', style: 'alert', say: 'Beyond the iron door a beam scrapes and thuds against brick. The door shifts in its frame and stands ajar. Harrow has stopped praying.' },
      ],
    },
  },
  {
    id: 'attack',
    run: {
      if: [{ in: 'counting_room' }, { var: 'pikeState', eq: 'counting' }],
      setVar: { attack: { add: 1 } },
      then: [
        { if: [{ lit: true }, { var: 'attack', gte: 5 }], sfx: 'scream', end: 'death_pike' },
        {
          if: [{ lit: true }, { var: 'attack', eq: 4 }], style: 'alert', nerve: 20, sfx: 'sting',
          say: 'He lunges. The knife opens your sleeve and the arm under it, and you feel nothing at all, which frightens you more. "Four," he says. Next time it will not be your arm.',
        },
        { if: [{ lit: true }, { var: 'attack', eq: 3 }], style: 'alert', say: '"Three," says Pike, and takes a step closer. Behind him Harrow is trying to say something. Do something.' },
        { if: [{ lit: true }, { var: 'attack', eq: 2 }], style: 'alert', say: 'He circles, knife low. "One," he says, matching your steps. "Two."' },
        // Dark: warned once (the TURN OFF warning or this one), then fatal (STORY §8.4, TT-121).
        { if: [{ lit: false }, { var: 'attack', gte: 2 }, 'dark_warned'], sfx: 'scream', end: 'death_pike' },
        { if: { lit: false }, setFlag: 'dark_warned', style: 'alert', say: 'In the dark the counting is suddenly very close. "One..." Light. You need light, now.' },
      ],
    },
  },
];
