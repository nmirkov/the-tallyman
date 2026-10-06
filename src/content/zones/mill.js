// Mill zone (docs/STORY.md §4.4): 5 rooms, their items and scenery. Prose verbatim.
// Variants that need Pike in the Counting Room switch on with TT-018's rooms (stubs.js).

import { CUT_CHAIN, OIL_HATCH, TRAP } from '../shared.js';
import { ready } from '../stubs.js';

/** Pike is down in the Counting Room (only possible once TT-018 adds it). */
const PIKE_BELOW = { at: ['pike', 'counting_room'] };
/** Text variants that name the Counting Room, kept only once it is transcribed. */
const whenPikeBelow = (text) => (ready('counting_room') ? [{ if: PIKE_BELOW, text }] : []);

/* ------------------------------------------------------------------------ *
 *  Item-local named reactions (STORY §5.2)                                  *
 * ------------------------------------------------------------------------ */

/** TEAR / TAKE the loose last page out of the ledger (carried: critical protection answers). */
const TEAR_PAGE = [
  { if: { not: { carried: 'ledger_page' } }, give: 'ledger_page', say: 'You tease the page free. It comes away with a sigh of old paper.' },
];

/* ------------------------------------------------------------------------ *
 *  Rooms                                                                    *
 * ------------------------------------------------------------------------ */

const CHAINED = "A chain as thick as your wrist holds the gates shut, padlocked to itself. You'd need bolt cutters.";

export const rooms = {
  mill_gates: {
    name: 'Mill Gates', zone: 'mill', picture: 'mill_gates', ambient: 'rain',
    desc: [
      { if: 'mill_chain_cut', text: "The gates of Ashworth's Mill stand open a body's width, the cut chain hanging from one bar. Beyond, the mill rises in black tiers, every window dead. A demolition notice is pasted to the gatepost. The towpath is east." },
      { text: "The gates of Ashworth's Mill: iron, twelve feet high, chained and padlocked. Beyond them the mill rises in black tiers, every window dead. A demolition notice is pasted to the gatepost. The towpath is east." },
    ],
    exits: {
      n: { to: 'mill_yard', if: 'mill_chain_cut', msg: CHAINED },
      e: 'towpath',
      in: { to: 'mill_yard', if: 'mill_chain_cut', msg: CHAINED },
    },
    scenery: [
      { names: ['gates', 'gate'], desc: 'Wrought iron, the word ASHWORTH worked into the top in letters a foot high. Spikes.' },
      { names: ['mill', 'windows', 'tiers'], desc: 'Seven storeys. Hundreds of windows, all black, all looking at you.' },
      { names: ['notice', 'demolition notice', 'gatepost'], desc: "BLACKMERE BOROUGH COUNCIL. DEMOLITION ORDER. Ashworth's Mill. Works commence 3rd December 1984. Someone has drawn four strokes across the date." },
    ],
  },

  mill_yard: {
    name: 'Mill Yard', zone: 'mill', picture: 'mill_yard',
    desc: 'The mill yard, cobbled, lit by one lamp that still works over the counting-house door. The weaving shed gapes to the west. The counting house is north. Steps lead down to the boiler room. The gates are south.',
    exits: { n: 'counting_house', s: 'mill_gates', w: 'weaving_shed', d: 'boiler_room' },
    scenery: [
      { names: ['lamp'], desc: 'One electric lamp in a cage over the counting-house door. Someone pays for this electricity. Someone wants light here.' },
      { names: ['cobbles'], desc: 'Setts, worn into ruts by a century of carts.' },
      { names: ['chimney'], desc: "Two hundred feet of brick. It hasn't smoked since 1971." },
      { names: ['steps'], desc: 'Down to the boiler room. Dark down there.' },
    ],
    onEnter: { if: '!entered_mill', setFlag: 'entered_mill', award: 'mill_entered', say: 'Somewhere up in the dark, a loom shuttle clacks once. Then nothing.' },
  },

  weaving_shed: {
    name: 'Weaving Shed', zone: 'mill', picture: 'weaving_shed', ambient: 'counting', dark: true, nerve: 2,
    desc: 'The weaving shed: row on row of dead looms under a roof of broken glass. The east doors are scorched black. Strokes have been scratched into the doors, low down, at a child\'s height. Lint stirs, though there is no wind.',
    exits: { e: 'mill_yard' },
    scenery: [
      { names: ['looms', 'loom'], desc: 'Lancashire looms, two hundred of them, frozen mid-shuttle. They were stopped in 1971 and nobody started them again.' },
      { names: ['roof', 'glass'], desc: 'More hole than glass. Rain falls through it in long silver threads.' },
      { names: ['doors', 'scorched doors'], desc: "Scorched black. There's a bracket on the outside for a bar. In 1912 there was a bar in it." },
      { names: ['strokes', 'scratches', 'marks'], desc: 'Fourteen strokes, low down on the inside of the door. Scratched with fingernails, the old men say. You count them twice. Fourteen.' },
      { names: ['lint', 'fluff'], desc: 'Cotton lint, everywhere, stirring. No wind. No draught. It stirs.' },
      { names: ['girl', 'ghost', 'figure', 'pinafore'], desc: "There's no one there. There was no one there." },
    ],
    // Once, and only with a light: the mill girl (STORY §2.6, §9.2).
    onEnter: {
      if: [{ lit: true }, '!saw_girl'], setFlag: 'saw_girl', sfx: 'whisper', style: 'whisper', nerve: 10,
      say: 'Between two looms, at the edge of your torch, a girl in a pinafore. Her hair is wet. "He counts for me," she whispers. "Make him stop." You blink, and there is lint, and shadow, and nothing.',
    },
  },

  counting_house: {
    name: 'Counting House', zone: 'mill', picture: 'counting_house', nerve: 1,
    desc: [
      ...whenPikeBelow('The counting house: high desks, barred wages windows, the smell of ink and mice. On the tallest desk lies a great ledger bound in black. The iron trap in the floor has lost its padlock; it is bolted from beneath. The yard is south.'),
      { text: 'The counting house: high desks, barred wages windows, the smell of ink and mice. On the tallest desk lies a great ledger bound in black. An iron trap is set in the floor, padlocked. The yard is south.' },
    ],
    exits: { s: 'mill_yard' },
    scenery: [
      { names: ['desks', 'high desks'], desc: "Clerks' desks, stool-high. Inkwells dried to black crust." },
      { names: ['windows', 'wages windows', 'bars'], desc: 'Barred hatches the girls queued at on Fridays. A brass plate: NO CREDIT WITHOUT THE BOOK.' },
      { names: ['mice'], desc: 'You hear them. They are the only things in here still keeping accounts.' },
    ],
    // LISTEN / LISTEN TO TRAP / FLOOR: Harrow praying below (pointer, STORY §7.2 step 15).
    before: {
      listen: [
        { if: { var: 'harrowFreed', eq: true }, say: 'Nothing beneath the floor now but your own heartbeat.' },
        { say: 'You hold your breath. Faintly, from beneath the iron trap, a man\'s voice: "...forgive us our trespasses, as we forgive..." Someone is alive down there.', setFlag: 'heard_praying', note: 'praying' },
      ],
    },
  },

  boiler_room: {
    name: 'Boiler Room', zone: 'mill', picture: 'boiler_room', ambient: 'drone', dark: true, nerve: 1,
    desc: [
      { if: { open: 'boiler_hatch' }, text: 'The boiler room: two Lancashire boilers like beached whales, pipes, a coal heap. Between the boilers the round iron hatch stands open on a ladder going down into the dark. Steps lead up to the yard.' },
      { text: 'The boiler room: two Lancashire boilers like beached whales, pipes, a coal heap, the smell of old fire. In the floor between the boilers is a round iron hatch, rusted to its rim. Steps lead up to the yard.' },
    ],
    exits: {
      u: 'mill_yard',
      d: { to: 'tunnel', door: 'boiler_hatch', if: { on: 'torch' }, msg: 'Not without a light.' },
    },
    scenery: [
      { names: ['boilers', 'boiler'], desc: 'Two of them, thirty feet long, riveted. Their fireboxes are cold mouths.' },
      { names: ['pipes'], desc: "Lagged with something you'd rather not breathe." },
      { names: ['coal', 'heap', 'coal heap'], desc: 'Old coal, gone grey.' },
      {
        names: ['ladder'],
        desc: [
          { if: { open: 'boiler_hatch' }, text: 'Iron rungs, going down.' },
          { text: "You can't see one. The hatch is shut." },
        ],
      },
    ],
  },
};

/* ------------------------------------------------------------------------ *
 *  Items (content order is set by ITEM_ORDER in ../index.js, STORY §5.1)    *
 * ------------------------------------------------------------------------ */

export const items = {
  mill_chain: {
    name: 'gate chain', names: ['chain', 'padlock'], adjectives: ['gate', 'heavy'], location: 'mill_gates', scenery: true,
    desc: [
      { if: 'mill_chain_cut', text: 'Cut through. It hangs from one bar like a dead snake.' },
      { text: 'A chain as thick as your wrist, wound through the bars and padlocked to itself. New padlock, old chain.' },
    ],
    before: { cut: CUT_CHAIN, break: CUT_CHAIN, open: CUT_CHAIN, unlock: CUT_CHAIN },
  },
  ledger: {
    name: 'ledger', names: ['ledger', 'debt ledger', 'tally book'], adjectives: ['great', 'black', '1912'], location: 'counting_house',
    scenery: true, fixed: "It weighs as much as a child. You couldn't carry it if you wanted to.", container: { supporter: true },
    desc: 'The tally book of Ashworth\'s Mill, 1912, bound in black, the size of a gravestone. The last page has torn almost free and hangs by a thread.',
    readable: 'Debts, in a clerk\'s copperplate: what each girl owed the company shop, week by week, in shillings and pence. The sums never go down. The last page - the one hanging loose - is different.',
    before: { attack: 'The ledger is unmoved by your violence.', tear: TEAR_PAGE },
  },
  ledger_page: {
    name: 'loose ledger page', names: ['page', 'ledger page', 'last page'], adjectives: ['loose', 'ledger', 'last', '1912'],
    location: 'ledger', critical: true,
    desc: 'The last page of the 1912 ledger, loose.',
    readable: 'Two columns. On the left, headed SHED DOOR - 15th Novr 1912 - TO BE KEPT LOCKED UNTIL THE TALLY IS SETTLED, five names: J. Ashworth. W. Crabtree. T. Holt. E. Marsh. J. Harrow (bailiff, key). On the right, HALF-TIMERS OWING, a list of girls, and halfway down: Pike, Mary, 14 - 3s 4d.',
    // `pull` is not in STORY §5.2; STORY §7.2 step 14 lists PULL PAGE as accepted.
    before: { tear: TEAR_PAGE, pull: TEAR_PAGE },
  },
  iron_trap: {
    name: 'iron trap', names: ['trap', 'trapdoor', 'iron trap'], adjectives: ['iron', 'floor'], location: 'counting_house', scenery: true,
    desc: [
      ...whenPikeBelow("The iron trap, its padlock gone. Bolted from beneath. Pike's door is shut behind him."),
      { text: 'An iron trap two feet square, a squat disc padlock through the hasp. The steel round the keyhole is bright with use. Someone comes and goes here, often.' },
    ],
    before: { open: TRAP, unlock: TRAP, cut: TRAP, break: TRAP, pry: TRAP, pull: TRAP },
  },
  // A door between the boiler room and the tunnel (STORY §3.3); the tunnel side lands with TT-018.
  boiler_hatch: {
    name: 'hatch', names: ['hatch', 'boiler hatch', 'manhole'], adjectives: ['round', 'iron', 'boiler', 'rusty'],
    location: 'boiler_room', ...(ready('tunnel') ? { alsoIn: ['tunnel'] } : {}),
    fixed: true, openable: true, open: false,
    desc: [
      { if: { open: 'boiler_hatch' }, text: 'The round iron hatch, open, a ladder going down.' },
      { if: 'hatch_oiled', text: 'A round iron hatch. The oil has soaked into the rust round the rim.' },
      { text: 'A round iron hatch, rusted to its frame all the way round. It would want oil before it moved.' },
    ],
    before: {
      open: [{ if: '!hatch_oiled', say: 'You heave. Nothing. Rust has welded the rim to the frame. It wants oil.' }],
      oil: OIL_HATCH,
    },
    after: { open: { sfx: 'hatch' } },
  },
};
