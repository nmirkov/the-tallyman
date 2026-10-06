// Beneath zone (docs/STORY.md §4.6, §3.3, §7.4, §8.3-8.5): the Tunnel and the Counting
// Room, the chains, Pike's greeting and Harrow's bleeding cues. Prose verbatim.
// Pike's arrival and the attack counter are story daemons (../beats.js, STORY §8.4).

import { CUT_CHAINS } from '../shared.js';

/** Pike is down in the Counting Room: the iron door is ajar (STORY §8.3). */
const PIKE_BELOW = { at: ['pike', 'counting_room'] };

/** STORY §8.4: after 23:00 while Harrow is still chained. */
const BLEED_CUE = {
  if: [{ turnGte: 180 }, { var: 'harrowFreed', eq: false }], style: 'alert',
  say: "Harrow's head has dropped. When he lifts it, it takes him a long time. His breathing is shallower now.",
};

/** First tunnel entry starts the `dread` music (STORY §4.6, §14). */
const TUNNEL_MUSIC = { if: '!tunnel_music', setFlag: 'tunnel_music', music: 'dread' };

const TUNNEL_BASE = 'A brick tunnel, barrel-vaulted, tally marks scratched every few yards. Steps climb south to the morgue; a ladder rises to a hatch overhead.';

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
      // Msg F (STORY §3.3): the Counting Room is only ever entered with a light.
      n: {
        to: 'counting_room', if: [PIKE_BELOW, { lit: true }],
        msg: [
          { if: PIKE_BELOW, text: 'Into a room with Pike in it, in the dark? Not a chance. Turn your torch on.' },
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
      { names: ['steps'], desc: 'Up to the morgue.' },
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
      knock: [
        { if: PIKE_BELOW, say: 'The door swings at your knock. It is not barred any more.' },
        {
          say: 'Harrow stops praying. "Kid? Is that you? The bar\'s on this side and I can\'t reach it. He comes and goes by the trap up top. Find another way - and hurry."',
          setFlag: 'heard_harrow',
        },
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
      { names: ['trap', 'ladder', 'rungs', 'bolt'], desc: "Iron rungs climb to a trap in the ceiling - the counting house above. Pike's door. It is bolted from this side and his padlock hangs locked through the bolt. His key, not yours." },
      {
        names: ['beam', 'bar'],
        desc: [
          { if: PIKE_BELOW, text: 'The bar that held the iron door, leaned against the wall. Pike lifted it when he came down. His way out.' },
          { text: 'The bar is in its brackets across the door.' },
        ],
      },
    ],
    // STORY §8.4: greeting first, then the bleeding cue (REACTION_ORDER: `say` before `then`).
    onEnter: [
      {
        if: [{ var: 'pikeState', eq: 'counting' }, '!pike_greeted'], setFlag: 'pike_greeted', sfx: 'sting', style: 'alert',
        say: 'Pike turns from the wall. He has taken off his tunic and folded it on the wages table, and he holds a long butcher\'s knife low against his leg. "You\'re early, Sergeant," he says. "I\'ve one more to count."',
        then: BLEED_CUE,
      },
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
