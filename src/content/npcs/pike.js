// PC Arthur Pike, the constable (docs/STORY.md §2.1, §6.3, §8.2). At the Police House
// desk until he flees (ACCUSE) or leaves on his schedule; then the Counting Room.

import { ARREST_PIKE, HARROW_CUFFS } from '../shared.js';

/** The Counting Room voice: fires only there, so the desk topics are untouched. */
const COUNTING_VOICE = [
  { if: [{ in: 'counting_room' }, { var: 'pikeState', eq: 'restrained' }], say: '"I would have stopped at five," he says. "Five is a gate. You close a gate."' },
  {
    if: { in: 'counting_room' },
    pick: ['"Four," he says, not to you. "Four, and one to settle."', '"She was fourteen, Sergeant. Somebody has to keep the book."', '"Don\'t make me count you, Sergeant. You\'re not in the ledger."'],
    then: HARROW_CUFFS,
  },
];

/**
 * TT-130: SHOW / GIVE in the Counting Room. The desk replies (`shows`, `refuse`) belong to
 * the Police House; down here evidence is no use to anyone, and Harrow says so.
 */
const COUNTING_HANDS = [
  { if: [{ in: 'counting_room' }, { var: 'pikeState', eq: 'restrained' }], say: 'He does not look up. He is counting the links of the cuffs.' },
  {
    if: { in: 'counting_room' },
    say: 'He doesn\'t look at it. He looks at you, measuring the floor between you. "I keep my own book, Sergeant."',
    then: HARROW_CUFFS,
  },
];

const SILAS = '"Silas Thorne? Harmless. Sees things. Counting men in capes." He smiles. "You don\'t want to listen to Silas."';
const MILL = '"The mill? Been up there yet, have you?" Mild, interested. "Mind the gates. Chained. Council\'s orders."';
const PATROL = '"Out on my rounds, Sergeant. Moor road, up to the stone and back. Saw nowt. Fog." Tap tap tap tap.';

export const pike = {
  name: 'Pike', names: ['pike', 'arthur', 'arthur pike', 'constable', 'pc', 'policeman', 'bobby'], proper: true,
  location: 'police_house',
  here: [
    { if: { var: 'pikeState', eq: 'restrained' }, text: "Arthur Pike kneels by the wall in Harrow's handcuffs, lips moving." },
    { if: { var: 'pikeState', eq: 'counting' }, text: 'Arthur Pike stands between you and Harrow, a long knife held low, counting under his breath.' },
    { text: 'PC Arthur Pike sits behind the counter with a mug of tea, tapping a pencil. Tap tap tap tap. Pause.' },
  ],
  desc: [
    { if: { var: 'pikeState', eq: 'restrained' }, text: 'Cuffed, on his knees. Without the helmet he looks very young. He is counting the links of the cuffs, over and over.' },
    { if: { var: 'pikeState', eq: 'counting' }, text: "Pike, in shirtsleeves, a long butcher's knife held low. His tunic hangs on the wages table, the second button missing. He does not blink." },
    { if: { found: 'ev_button' }, text: 'A big young constable, soft-spoken, older than his years. Tunic buttoned to the throat - all but the second button, which is missing. A thread hangs where it was.' },
    { text: 'PC Arthur Pike: a big young constable, ruddy, soft-spoken, older than his years. Tunic buttoned to the throat, every button polished. He taps his pencil on the desk in fours.' },
  ],
  talk: '"Now then, Sergeant. Cup of tea? You look perished. Mr Harrow, is it? He\'ll turn up. They always turn up."',
  before: {
    ask: COUNTING_VOICE,
    tell: COUNTING_VOICE,
    talk: COUNTING_VOICE,
    show: COUNTING_HANDS,
    give: COUNTING_HANDS,
    arrest: ARREST_PIKE,
    attack: [
      { if: { var: 'pikeState', eq: 'restrained' }, say: 'He is cuffed and on his knees. That isn\'t who you are.' },
      { if: { var: 'pikeState', eq: 'counting' }, say: 'He is quicker with that knife than you are with your fists. Cuffs, not fists.' },
      '"Steady on, Sergeant." He doesn\'t even stand up. You are suddenly very aware of how big he is.',
    ],
  },
  shows: {
    button: { nerve: 5, say: '"A button?" He doesn\'t look at it. He looks at you. "I was first in at Ivy Marsh\'s, Sergeant. Could\'ve come off anyone." His hand has gone to his tunic.' },
    ledger_page: '"Old paper. Mill\'s full of it." He reads it upside down without meaning to. His lips move: one, two, three, four, five.',
    patient_file: '"That\'s private, that." Very quietly. "That\'s mine."',
    handcuffs: '"Mr Harrow\'s? Where did you find those?" A beat too late: "Is he all right?"',
    warrant_card: '"Very nice, Sergeant. I\'ve got one too, somewhere."',
  },
  refuse: '"No thank you, Sergeant. Can\'t accept gifts. Regulations."',
  default: '"Can\'t help you there, Sergeant. Cup of tea?"',
  topics: {
    harrow: '"Mr Harrow? Came in this afternoon asking after the old asylum records. Off up the moor, last I heard. Grand fella. Bit sure of himself."',
    t_murders: '"Four in four weeks. I\'ve walked every street every Thursday. He\'s cleverer than me, whoever he is." He taps the pencil. Four times.',
    t_tally: '"Kids\' tale. Folk round here never forget a debt, that\'s all it means."',
    t_fire: '"Fourteen lasses. Terrible thing. Before anyone\'s time, Sergeant. Best left."',
    t_mary: '"Mary?" The pencil stops. Then it starts again. "There\'s always been Pikes in Blackmere, Sergeant. Common as muck, us."',
    t_asylum: '"Ashcombe? Closed in \'79. Nowt up there but pigeons." He doesn\'t look up.',
    t_mill: MILL,
    t_counting_room: MILL,
    button: [
      { if: { carried: 'button' }, say: '"A button?" He doesn\'t look at it. "I was first in at Ivy Marsh\'s, Sergeant. Could\'ve come off anyone."' },
      '"Buttons, Sergeant?"',
    ],
    handcuffs: '"Never had call to use mine. Not in Blackmere."',
    silas: SILAS,
    t_counting: SILAS,
    t_keeper: SILAS,
    maggie: '"Our Maggie? Known her all my life. She brought me grapes, when I was poorly."',
    ashdown: '"The vicar\'s been jumpy. You might ask him where he goes of a night."',
    t_patrol: PATROL,
    occurrence_book: PATROL,
    t_tunnel: '"Tunnel? Never heard of one." Too quick.',
    patient_file: '"Ashcombe kept files on half the town, Sergeant." His face does not move at all.',
    t_self: '"Me? Born here, schooled here, never wanted owt else. Four years in the job." Tap tap tap tap.',
  },
  // Leaves on turn 240 (23:30) if still at his desk; reaches the Counting Room on 250.
  schedule: [{
    at: 240, to: null, if: { var: 'pikeState', eq: 'desk' },
    leaveText: 'Pike looks at the clock. "Half eleven. That\'s me off on my rounds, Sergeant. Pull the door to if you go." He takes his cape from the peg and goes out into the rain, counting the steps down to the street.',
    do: { setVar: { pikeState: 'left', pikeArrivalTurn: { turnPlus: 10 } } },
  }],
};
