// Canal zone (docs/STORY.md §4.2): 5 rooms, their items and scenery. Prose verbatim.

import { CUT_CHAIN, CUT_CHAINS, OIL_HATCH } from '../shared.js';

/* ------------------------------------------------------------------------ *
 *  Item-local named reactions (STORY §5.2)                                  *
 * ------------------------------------------------------------------------ */

const SHED = [
  { if: 'shed_open', say: "It's open. Go EAST." },
  "It's Silas's padlock on Silas's shed. Ask Silas.",
];

const OIL_USE = [
  { if: { present: 'boiler_hatch' }, then: OIL_HATCH },
  "You'd waste it. Save it for something rusty.",
];

/* ------------------------------------------------------------------------ *
 *  Rooms                                                                    *
 * ------------------------------------------------------------------------ */

export const rooms = {
  canal_bridge: {
    name: 'Canal Bridge', zone: 'canal', picture: 'canal_bridge',
    desc: 'A humpbacked bridge over the canal. The water below is black and perfectly still, as if it were holding its breath. Stone steps lead down to the towpath. Station Road is west.',
    exits: { w: 'station_road', d: 'towpath' },
    sink: 'It drops into the black water without a splash worth the name. Gone.',
    scenery: [
      { names: ['water', 'canal'], desc: "Black. Still. It doesn't reflect the lamps so much as swallow them." },
      { names: ['parapet', 'bridge', 'stone'], desc: "Worn smooth by elbows. Generations of Blackmere have leaned here and thought about jumping. Most didn't." },
      { names: ['steps'], desc: 'Slick stone steps down to the towpath.' },
    ],
    before: {
      jump: "You lean over the parapet and look at the water. It looks back. You don't.",
      swim: 'From up here? No.',
    },
  },

  towpath: {
    name: 'Towpath', zone: 'canal', picture: 'towpath',
    desc: 'The towpath, puddled and lit by a single bulb on a pole. Walter Crabtree died here three weeks ago; someone has left flowers, now brown. East, the lock. West, the black bulk of the mill. Steps climb to the bridge.',
    exits: { e: 'lock', w: 'mill_gates', u: 'canal_bridge' },
    sink: 'It goes into the canal. The canal keeps it.',
    scenery: [
      { names: ['bulb', 'pole', 'light'], desc: 'One bare bulb in a tin shade, the only light for half a mile. Moths would love it, in summer.' },
      { names: ['flowers', 'cellophane'], desc: 'Chrysanthemums, brown now. The card says: WALTER - FROM THE LADS AT THE BOWLING CLUB.' },
      { names: ['mill'], desc: "Ashworth's Mill. Seven storeys of black. A chimney like a finger raised for silence." },
      { names: ['water', 'canal'], desc: 'Black and quiet. You keep to the middle of the path.' },
      { names: ['steps'], desc: 'Worn stone, up to the bridge.' },
    ],
    before: {
      swim: "Into November canal water? There are easier ways to catch your death, and you're trying to avoid them all tonight.",
    },
  },

  // No `in` exit on purpose: bare ENTER here is the `lock` hazard (STORY §4.2, C31).
  lock: {
    name: 'Blackmere Lock', zone: 'canal', picture: 'lock', nerve: 1,
    desc: "Blackmere Lock: two great timber gates and between them a chamber of black water ten feet down, roaring where it pours through the paddles. Silas's cottage is north, his shed east. The towpath runs west.",
    exits: {
      n: 'lock_cottage',
      e: { to: 'shed', if: 'shed_open', msg: "The shed is padlocked. Silas's padlock, Silas's shed." },
      w: 'towpath',
    },
    sink: "It vanishes into the churn of the lock. The lock doesn't give things back.",
    scenery: [
      { names: ['gates', 'lock gates', 'beams', 'balance beams'], desc: 'Oak gates, black with age, iron-banded. The balance beams are worn smooth where men pushed them for two hundred years.' },
      { names: ['paddles', 'sluice', 'sluices'], desc: 'The paddles are up a crack; water hammers through. If you went in there, you would not come out.' },
      { names: ['cottage'], desc: 'A low cottage, one lit window, smoke from the chimney.' },
    ],
  },

  lock_cottage: {
    name: "Lock-keeper's Cottage", zone: 'canal', picture: 'lock_cottage', ambient: 'none', nerve: -1,
    desc: 'A one-room cottage, hot as an oven. A paraffin heater, a rocking chair, a whippet asleep on an old coat. Every shelf is covered in clocks, and not one of them is going. The door is south.',
    exits: { s: 'lock', out: 'lock' },
    scenery: [
      { names: ['heater', 'paraffin heater'], desc: 'A Valor heater, ticking, blue flame. The room smells of it.' },
      { names: ['rocking chair', 'chair'], desc: "Silas's chair. It rocks on its own a moment after he stops." },
      { names: ['whippet', 'dog', 'nell'], desc: 'Grey, thin, asleep - or pretending. Her ears follow you. She never barks.' },
      { names: ['coat'], desc: "An army greatcoat, very old. The dog's now." },
      { names: ['door'], desc: 'A plank door, out to the lock. The roar of the water comes through it anyway.' },
      { names: ['clocks', 'clock', 'shelves', 'shelf'], desc: "Dozens of clocks, all stopped, all at different times. 'Can't abide the ticking,' says Silas. 'Sounds like counting.'" },
    ],
    // Silent: meeting Silas counts as having heard of him, so Maggie will sell whisky.
    onEnter: { setFlag: 'heard_of_silas' },
  },

  shed: {
    name: "Silas's Shed", zone: 'canal', picture: 'shed',
    desc: "Silas's shed: oil, rope ends, rust. Tools hang on nails, each one inside its own outline painted on the boards, so you'd know at once if one were gone. The lock is west.",
    exits: { w: 'lock', out: 'lock' },
    scenery: [
      { names: ['tools', 'nails'], desc: "Saws, a scythe, a mole trap. Silas's order is absolute." },
      { names: ['outlines', 'outline', 'boards'], desc: 'Painted shapes. Two of them, by the door, will be empty when you leave.' },
      { names: ['rope ends', 'ends'], desc: 'Short ends of tarred rope. Too short for anything but tying parcels.' },
      { names: ['oil', 'rust'], desc: 'Everywhere. The shed is mostly made of them.' },
    ],
  },
};

/* ------------------------------------------------------------------------ *
 *  Items                                                                    *
 * ------------------------------------------------------------------------ */

export const items = {
  lock_water: {
    name: 'lock', names: ['water', 'lock', 'chamber', 'canal'], adjectives: ['black', 'lock'], location: 'lock', scenery: true,
    desc: 'Ten feet down, black water churning between the gates. It would pull you under and hold you there.',
  },
  shed_door: {
    name: 'shed', names: ['shed', 'shed door', 'padlock'], location: 'lock', scenery: true,
    desc: [
      { if: 'shed_open', text: 'The shed door stands open. Silas has taken his padlock off.' },
      { text: "A tarred shed with a padlock the size of a fist. Silas's padlock, Silas's shed." },
    ],
    before: { open: SHED, unlock: SHED, break: SHED, cut: SHED, pry: SHED },
  },
  bolt_cutters: {
    name: 'bolt cutters', article: 'some', names: ['bolt cutters', 'cutters', 'croppers'], adjectives: ['bolt', 'red'], location: 'shed',
    critical: true,
    initial: 'A pair of long-handled bolt cutters hangs inside its painted outline.',
    desc: "Two-foot bolt cutters, red handles, jaws that would take a finger off. They'd go through a padlock chain like string.",
    before: {
      use: [
        { if: { present: 'mill_chain' }, then: CUT_CHAIN },
        { if: { present: 'chains' }, then: CUT_CHAINS },
        'Nothing here needs cutting.',
      ],
    },
  },
  oil_can: {
    name: 'oil can', names: ['oil can', 'oilcan', 'can'], adjectives: ['oil', 'green'], location: 'shed', critical: true,
    initial: 'A green oil can with a long spout stands on the bench.',
    desc: 'A pump-action oil can, half full. It smells of every bicycle you ever owned.',
    before: {
      use: OIL_USE,
      put: [{ if: { present: 'boiler_hatch' }, then: OIL_HATCH }],
      pour: OIL_USE,
    },
  },
};
