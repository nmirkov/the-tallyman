// Silas Thorne, lock-keeper (docs/STORY.md §2.5, §6.5). Never moves. Talks for whisky.

import { SILAS_STORY } from '../shared.js';

/** Before the whisky. The full speech once; after that, the short of it (TT-131). */
const DRY = [
  { if: '!silas_dry', setFlag: 'silas_dry', say: '"Dry throat, Sergeant. Can\'t talk with a dry throat. Maggie at the Black Lamb keeps a bottle of Bell\'s for me. Bring me a drop and I\'ll tell you about the counting man."' },
  '"Dry," says Silas, and licks his lips. "Black Lamb. Bell\'s. Then we\'ll talk."',
];

/** Every topic row: the reply once he has had his whisky, else DRY (STORY §6.5). */
const afterWhisky = (reply) => [{ if: 'silas_told', say: reply }, ...DRY];

const TUNNEL = afterWhisky('"Asylum morgue to the mill, under the moor. They carried the dead down it in the cholera, to the boilers. Comes out in the Counting Room, under the counting house, where they made up the wages. There\'s a hatch in the boiler-room floor an\' all, but that wants oil. Rusted solid since the war."');
const OIL = afterWhisky('"Wants oil. There\'s a can in my shed."');
const COUNTING_MAN = afterWhisky('"Thursdays. Big man in a cape, like the bobbies used to wear. Counts my lock gates - one, two, three, four - goes in at the mill. Comes out up at Ashcombe an hour after, coal on him. There\'s a tunnel, see."');
const TOOLS = afterWhisky('"Shed\'s open - take what you need. Quarry hut\'s full of old tools an\' all. Nobody\'s worked it since \'68."');

export const silas = {
  name: 'Silas', names: ['silas', 'thorne', 'silas thorne', 'lock keeper', 'lock-keeper', 'keeper', 'old man'], proper: true,
  location: 'lock_cottage',
  here: [
    { if: 'silas_told', text: 'Silas rocks by the heater with the bottle in his lap, the whippet at his feet.' },
    { text: 'Silas Thorne rocks in his chair by the heater, muttering, a whippet at his feet.' },
  ],
  desc: 'Seventy-odd, a coat tied with string, one milky eye and one very sharp one. He is counting the clocks under his breath, though none of them go.',
  talk: [
    { if: 'silas_told', say: '"Told you what I know. Mind that hatch - it wants oil."' },
    { say: '"Counting man, counting man, comes on a Thursday..." He breaks off and looks at you with the good eye.', then: DRY },
  ],
  accepts: { whisky: SILAS_STORY },
  refuse: '"Don\'t want that. Got whisky?"',
  shows: {
    whisky: '"Well? Give it here, then."',
    button: '"Bobby\'s button. The counting man wore a cape. Under a cape, who\'s to say."',
    patient_file: '"Pike. Aye. They were all counters, the Pikes."',
  },
  before: {
    attack: '"Nell," says Silas. The whippet opens one eye. That is all it takes. You think better of it.',
  },
  topics: {
    t_counting: COUNTING_MAN,
    // TT-131: the testers' own words for him (STORY §6.5).
    t_tally: COUNTING_MAN,
    t_murders: afterWhisky('"Four Thursdays, four of the old names. Counting man\'s work." He counts them off on his fingers and stops at the thumb. "He\'s not done."'),
    t_mill: afterWhisky('"Ashworth\'s. Gates are chained, but chains cut. Counting man goes in there of a Thursday and comes out at Ashcombe. Work it out."'),
    shed_door: TOOLS,
    t_tunnel: TUNNEL,
    t_counting_room: TUNNEL,
    boiler_hatch: OIL,
    oil_can: OIL,
    t_fire: afterWhisky('"My mam got out. Climbed through the roof glass. She said it once and never again: the doors were barred from the outside, and the bailiff stood there with the key."'),
    harrow: afterWhisky('"Your mate? Never saw him. Saw a bike lamp come down off the moor about quarter past nine, going like the clappers."'),
    pike: afterWhisky('"Young Arthur? Knew his gran. They were all counters, the Pikes." He looks at you with the good eye. "All of them."'),
    t_mary: afterWhisky('"Mary Pike. My mam\'s pal. Fourteen. They were going to the fair on the Saturday."'),
    bolt_cutters: TOOLS,
    t_quarry: TOOLS,
    crowbar: TOOLS,
    t_ghost: afterWhisky('"She\'s in the weaving shed. Don\'t talk to her. Don\'t let her talk to you."'),
    maggie: '"Maggie\'s all right. Knows everybody\'s business but her own."',
    ashdown: '"Vicar\'s got a lady friend. Everybody knows. Nobody says."',
    whisky: [{ if: 'silas_told', say: '"Grand drop, that."' }, ...DRY],
  },
  default: [{ if: 'silas_told', say: '"Can\'t help you with that. Ask me about the counting man."' }, ...DRY],
};
