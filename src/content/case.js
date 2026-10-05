// ACCUSE machinery and hazards (docs/STORY.md §8.1, §8.6; A14.1 rules 2-5, A14.3).
// Variants that name rooms of later zones switch on when those rooms land (stubs.js).

import { ready } from './stubs.js';

const WEAK_IN_COUNTING_ROOM = { if: { in: 'counting_room' }, nerve: 15, say: '"Prove it," says Pike, and smiles, and goes on counting.' };

export const caseDef = {
  culprit: 'pike',
  threshold: 3,
  suspects: ['ashdown', 'maggie', 'silas'],
  confirm: 'Are you certain? (Y/N)',
  cancelText: '(You hold your tongue.)',
  correct: [
    {
      if: { in: 'police_house' }, sfx: 'sting', award: 'accusation', move: { pike: null },
      setVar: { pikeState: 'fled', pikeArrivalTurn: { turnPlus: 5 } },
      say: '"Arthur Pike, I am arresting you for the murders of Edna Ashworth, Walter Crabtree, Dennis Holt and Ivy Marsh -" He stands. He is very big. For a moment his face is quite empty, a slate wiped clean. Then he puts both hands on the counter and vaults it, and his shoulder takes you into the wall. By the time you are up, the door is banging in the wind and he is gone into the rain without his helmet. You know where. Under the mill. To Frank.',
    },
    {
      award: 'accusation',
      say: 'You say it out loud: the whole caution, every name. Pike listens with his head on one side, counting the names off on his fingers. "Four," he says. "You forgot one."',
    },
  ],
  weak: [
    ...(ready('counting_room') ? [WEAK_IN_COUNTING_ROOM] : []),
    { nerve: 15, say: 'Pike laughs - a big easy laugh with nothing behind it. "Me? On what, Sergeant? A feeling?" He leans across the counter. "Come back when you\'ve got something you can count."' },
  ],
  wrong: [
    { if: { present: 'maggie' }, setFlag: 'accused_maggie', end: 'wrong_man' },
    { if: { present: 'ashdown' }, setFlag: 'accused_ashdown', end: 'wrong_man' },
    { setFlag: 'accused_silas', end: 'wrong_man' },
  ],
  other: [
    { if: { present: 'harrow' }, say: '"Me?" Harrow manages a laugh. "I\'m the one in chains, kid."' },
    "You'd need a lot more than that, and so would a jury.",
  ],
};

/** Warned once, then fatal (A7.5 step 1). */
export const hazards = {
  lock: {
    room: 'lock', verbs: ['swim', 'enter', 'jump'], objects: ['lock_water'], ending: 'death_drown',
    warn: 'You stand at the edge of the lock and look down into ten feet of black, churning water. If you went in there you would not come out. (If it is the cottage you want, it is NORTH.)',
  },
  ...(ready('quarry_edge') ? {
    quarry: {
      room: 'quarry_edge', exit: 'd', unless: { carried: 'rope' }, ending: 'death_fall',
      warn: 'You look over the edge. Sixty feet of wet rock down to black water, and not a handhold you would trust. Without a rope you would never make it down alive.',
    },
  } : {}),
};
