// Beneath zone (docs/STORY.md §4.6, §3.3, §7.4, §8.3-8.5): the Tunnel and the Counting
// Room, the chains, Pike's greeting and Harrow's bleeding cues. Prose verbatim.
// Pike's arrival and the attack counter are story daemons (../beats.js, STORY §8.4).

import { CUT_CHAINS, HARROW_CUFFS } from '../shared.js';

/** Pike is down in the Counting Room: the iron door is ajar (STORY §8.3). */
const PIKE_BELOW = { at: ['pike', 'counting_room'] };

/** STORY §8.4: after 23:00 while Harrow is still chained. */
const BLEED_CUE = {
  if: [{ turnGte: 180 }, { var: 'harrowFreed', eq: false }], style: 'alert',
  say: "Harrow's head has dropped. When he lifts it, it takes him a long time. His breathing is shallower now.",
};

/** First tunnel entry starts the `dread` music (STORY §4.6, §14). */
const TUNNEL_MUSIC = { if: '!tunnel_music', setFlag: 'tunnel_music', music: 'dread' };

// TT-131: "rungs", not "steps" - the morgue end is the drawer hatch's iron rungs (STORY §4.5).
const TUNNEL_BASE = 'A brick tunnel, barrel-vaulted, tally marks scratched every few yards. Iron rungs climb south to the morgue; a ladder rises to a hatch overhead.';

/** KNOCK, or SAY / SHOUT through the iron door before Pike comes down (STORY §8.3). */
const THROUGH_THE_DOOR = [
  { if: PIKE_BELOW, say: 'The door swings at your knock. It is not barred any more.' },
  {
    say: 'Harrow stops praying. "Kid? Is that you? The bar\'s on this side and I can\'t reach it. He comes and goes by the trap up top. Find another way - and hurry."',
    setFlag: 'heard_harrow',
  },
];

/* ------------------------------------------------------------------------ *
 *  Rooms                                                                    *
 * ------------------------------------------------------------------------ */

export const rooms = {
  tunnel: {
    name: 'Tunnel', zone: 'beneath', picture: 'tunnel', dark: true, nerve: 2,
    desc: [
      { if: PIKE_BELOW, text: `${TUNNEL_BASE} North, the iron door stands ajar - the bar lifted from inside by someone who wants a way out.` },
      { if: { turnGte: 180 }, text: `${TUNNEL_BASE} North, an iron door, shut. Behind it Harrow is praying, slower now.` },
      { text: `${TUNNEL_BASE} North, an iron door, shut. Behind it, very faint, a man is praying.` },
    ],
    exits: {
      // Msg F (STORY §3.3): the Counting Room is only ever entered with a light the player
      // carries (TT-122: a torch left lit out here lights the tunnel, not the room beyond).
      // Coming back out of the dark, the way back in is the darkness rule's (A8.3 step 4).
      n: {
        to: 'counting_room', if: [PIKE_BELOW, { carried: 'torch' }, { lit: true }],
        msg: [
          { if: [PIKE_BELOW, { var: 'pikeState', eq: 'counting' }, { carried: 'torch' }], text: 'Into a room with Pike in it, in the dark? Not a chance. Turn your torch on.' },
          { if: [PIKE_BELOW, { var: 'pikeState', eq: 'counting' }], text: 'Into a room with Pike in it, without your torch in your hand? Not a chance.' },
          { if: [PIKE_BELOW, { carried: 'torch' }], text: 'Not in the dark. Not with Pike in there, cuffs or no cuffs. Turn your torch on.' },
          { if: PIKE_BELOW, text: 'Not in the dark. Not with Pike in there, cuffs or no cuffs. Bring your torch.' },
          { if: { turnGte: 180 }, text: 'The iron door is barred from the other side. Beyond it, Harrow is praying - slower now, losing his place.' },
          { text: 'The iron door is barred from the other side. Beyond it, Harrow is praying.' },
        ],
      },
      s: 'morgue',
      u: { to: 'boiler_room', door: 'boiler_hatch' },
    },
    scenery: [
      { names: ['bricks', 'brick', 'vault', 'walls'], desc: 'Victorian brick, sweating. It runs under the moor for the best part of a mile.' },
      { names: ['marks', 'tally marks', 'tallies'], desc: 'Gates of five every few yards, scratched by a nail. Someone has walked this tunnel counting it, many times.' },
      {
        names: ['iron door', 'door', 'bar', 'beam'],
        desc: [
          { if: PIKE_BELOW, text: 'Iron, studded, ajar. The beam that barred it has been lifted from the far side and leaned against the wall in there. Whoever went in left himself a way out.' },
          { text: 'Iron, studded, shut fast. It is barred on the far side - you can hear the beam shift in its brackets when you push. Beyond it, Harrow is praying.' },
        ],
      },
      { names: ['steps', 'rungs'], desc: 'Iron rungs set in the brick at the south end, up to a square hatch in the morgue floor.' },
      { names: ['ladder'], desc: 'Iron rungs up to the boiler hatch.' },
    ],
    // STORY §8.5: Harrow's cough after 23:00 while chained; the first entry starts the music.
    onEnter: [
      {
        if: [{ turnGte: 180 }, { var: 'harrowFreed', eq: false }], style: 'alert',
        say: 'Beyond the iron door Harrow coughs - a wet, bad cough - and goes quiet for too long.',
        then: TUNNEL_MUSIC,
      },
      TUNNEL_MUSIC,
    ],
    // STORY §7.4 room-level use.
    before: {
      knock: THROUGH_THE_DOOR,
      // TT-131: SAY / SHOUT through the door reaches Harrow like a knock; LISTEN hears what the desc says.
      say: [
        { if: PIKE_BELOW, say: 'Your voice goes through the open door and comes back off brick. Beyond it, someone stops counting, and then starts again.' },
        THROUGH_THE_DOOR[1],
      ],
      listen: [
        { if: PIKE_BELOW, say: 'Through the open door: a man counting under his breath, slow and patient. And another man, breathing badly.' },
        { if: { turnGte: 180 }, say: 'Behind the iron door Harrow is praying, slower now, losing his place. He is alive. You could KNOCK.' },
        'Behind the iron door, very faint, a man is praying. You know the voice: Frank Harrow. You could KNOCK.',
      ],
    },
  },

  counting_room: {
    name: 'The Counting Room', zone: 'beneath', picture: 'counting_room', ambient: 'counting', dark: true, nerve: 3,
    desc: [
      { if: { var: 'harrowFreed', eq: true }, text: 'The Counting Room: a brick vault, a long wages table, iron rings in the wall. On the far wall four great strokes are cut deep into the brick, a gate waiting to be closed. Harrow sits slumped beneath them, the cut chains at his feet. The door is south.' },
      { text: 'The Counting Room: a brick vault, a long wages table, iron rings in the wall. On the far wall four great strokes are cut deep into the brick, a gate waiting to be closed. Harrow hangs in chains beneath them. The iron door is south.' },
    ],
    exits: { s: 'tunnel' },
    scenery: [
      { names: ['table', 'wages table'], desc: 'A long table where the wages were counted out in 1912. Coins are still stuck to it with old wax, in piles of four.' },
      { names: ['rings', 'iron rings'], desc: 'Iron rings set in the brick. Harrow is chained to two of them.' },
      { names: ['strokes', 'marks', 'wall', 'gate'], desc: 'Four strokes, each as long as a man, cut deep with a chisel. Room for one more across them. You understand exactly whose length the fifth is meant to be.' },
      // TT-105: every noun of the desc, Pike's `here` line and his greeting resolves in here.
      {
        names: ['knife', 'butcher knife'], adjectives: ['long', 'butcher'],
        desc: [
          { if: { var: 'pikeState', eq: 'restrained' }, text: 'On the brick where it fell, well out of his reach. It can stay there for Manchester.' },
          { text: "A butcher's knife, a foot of it, honed thin. He holds it low and easy, the way another man would hold a pencil." },
        ],
      },
      { names: ['tunic', 'uniform'], desc: "Pike's tunic, folded square on the wages table. The second button down is missing. A thread hangs where it was." },
      { names: ['door'], adjectives: ['iron'], desc: 'The iron door to the tunnel, standing ajar. Pike left himself a way out.' },
      { names: ['vault', 'brick', 'bricks', 'ceiling'], desc: 'Victorian brick, black with damp, low enough to touch. It gives your own breathing back to you.' },
      { names: ['trap', 'ladder', 'rungs', 'bolt'], desc: "Iron rungs climb to a trap in the ceiling - the counting house above. Pike's door. It is bolted from this side and his padlock hangs locked through the bolt. His key, not yours." },
      {
        names: ['beam', 'bar'],
        desc: [
          { if: PIKE_BELOW, text: 'The bar that held the iron door, leaned against the wall. Pike lifted it when he came down. His way out.' },
          { text: 'The bar is in its brackets across the door.' },
        ],
      },
    ],
    before: {
      // TT-131 / TT-130: LISTEN and SAY in here.
      listen: [
        { if: { var: 'pikeState', eq: 'counting' }, say: 'Pike, counting under his breath. Harrow\'s breathing, wet and shallow. Your own heart.', then: HARROW_CUFFS },
        "Harrow's breathing, wet and shallow. Pike's lips moving. The brick drips.",
      ],
      say: [
        { if: { var: 'pikeState', eq: 'counting' }, say: 'Pike tilts his head and listens to you the way he listens to the rain. Then he goes on counting.', then: HARROW_CUFFS },
        { if: { var: 'pikeState', eq: 'restrained' }, say: 'Pike doesn\'t answer. He is counting the links of the cuffs.' },
        '"Save your breath, kid," says Harrow.',
      ],
    },
    // STORY §8.4: greeting first, then the bleeding cue (REACTION_ORDER: `say` before `then`).
    onEnter: [
      {
        if: [{ var: 'pikeState', eq: 'counting' }, '!pike_greeted'], setFlag: 'pike_greeted', sfx: 'sting', style: 'alert',
        say: 'Pike turns from the wall. He has taken off his tunic and folded it on the wages table, and he holds a long butcher\'s knife low against his leg. "You\'re early, Sergeant," he says. "I\'ve one more to count."',
        then: BLEED_CUE,
      },
      // Felt your way back in with the torch off (A8.3 step 4): you cannot see him (TT-105).
      { if: [{ var: 'pikeState', eq: 'counting' }, { lit: false }], style: 'alert', say: 'Somewhere ahead of you in the black a big man is breathing, slow and even, close enough to touch.' },
      { if: { var: 'pikeState', eq: 'counting' }, style: 'alert', say: 'Pike is waiting for you, knife low. He has started counting again.', then: BLEED_CUE },
      BLEED_CUE,
    ],
  },
};

/* ------------------------------------------------------------------------ *
 *  Items (content order is set by ITEM_ORDER in ../index.js, STORY §5.1)    *
 * ------------------------------------------------------------------------ */

export const items = {
  chains: {
    name: 'chains', names: ['chains', 'chain', 'shackles', 'manacles'], adjectives: ['iron', 'heavy'], location: 'counting_room', scenery: true,
    desc: [
      { if: { var: 'harrowFreed', eq: true }, text: 'Cut, lying on the floor in loops.' },
      { text: "Heavy chain from Harrow's wrists to two rings in the wall, padlocked. Cutters would do it." },
    ],
    before: { cut: CUT_CHAINS, break: CUT_CHAINS, open: CUT_CHAINS, unlock: CUT_CHAINS, pull: 'Set in the brick. They will not pull out.' },
  },
};
