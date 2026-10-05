// Case-world fixture (TT-009): the mini-world plus two more NPCs and the case data the
// NPC / case tests need. Kept separate from mini-world.js so the room listings other
// suites assert stay unchanged; built from it additively (nothing is removed or renamed).
//
// Additions:
//   silas      proper NPC in the alley, a second suspect; accepts the photograph (a
//              critical item) and the whisky; sells matches; topic-less except `murder`.
//   constable  non-proper NPC in the square with no talk / default / shows / accepts /
//              refuse / sells — every engine default — and not a suspect (`case.other`).
//   photo      critical item with its own criticalMsg, on the square's cobbles.
//   matches    sold by Silas (30p); edible-free, not critical.
//   case       suspects maggie + silas, `other` reaction, `cancelText`.
//   hints      a third step (`accuse`) that is never done before an accusation.

import mini from './mini-world.js';
import { cloneContent } from './harness.js';

const world = cloneContent(mini);

world.npcs.silas = {
  name: 'Silas', names: ['silas', 'tramp', 'old man'], adjectives: ['old'], proper: true, location: 'alley',
  desc: 'A tramp in three coats, smelling of the canal.',
  here: 'Silas huddles in a doorway.',
  topics: { murder: '"I saw a copper on the towpath. A copper!"' },
  default: '"Eh? Speak up."',
  accepts: {
    photo: { say: '"That\'s him. That\'s the copper."', setFlag: 'silas_saw_photo' },
    whisky: '"Bless you, sir."',
  },
  sells: { matches: { price: 30, text: 'Silas sells you a box of matches.' } },
};

world.npcs.constable = {
  name: 'constable', names: ['constable', 'bobby', 'policeman'], adjectives: ['young'], location: 'square',
  desc: 'A young constable, dripping under his cape.',
};

world.items.photo = {
  name: 'photograph', names: ['photograph', 'photo'], adjectives: ['creased'], critical: true,
  criticalMsg: 'That photograph is the only one of Harrow you have.',
  location: 'square', desc: 'A creased photograph of Harrow.',
};

world.items.matches = {
  name: 'box of matches', names: ['matches', 'box of matches'], article: 'a', location: null,
  desc: 'Swan Vestas, half full.',
};

world.case = {
  ...world.case,
  suspects: ['maggie', 'silas'],
  other: '"Me? I only walk the beat," says the constable.',
  cancelText: 'You think better of it.',
};

world.hints = [
  ...world.hints,
  { id: 'accuse', done: { awarded: 'accusation' }, tiers: ['Someone in the office counts everything twice.', 'ACCUSE PIKE.'] },
];

export { world as caseWorld };
export default world;
