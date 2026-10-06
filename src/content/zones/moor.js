// Moor zone (docs/STORY.md §4.3): 6 rooms, their items and scenery. Prose verbatim.
// The quarry fall is the `quarry` hazard in ../case.js (STORY §8.6).

import { ARREST_PIKE, PRY_CABINET, MOVE_DRAWER, TRAP } from '../shared.js';

/**
 * TIE / USE ROPE (TT-105): the winch post says "You could tie a rope to that", so at the edge,
 * rope in hand, tying it on is the climb down (the same as DOWN; quarry_floor.onEnter says how).
 */
const TIE_ROPE = [
  { if: [{ in: 'quarry_edge' }, { carried: 'rope' }, 'climbed_down'], say: 'You loop the rope round the winch post again and go down it hand over hand.', movePlayer: 'quarry_floor' },
  { if: [{ in: 'quarry_edge' }, { carried: 'rope' }], movePlayer: 'quarry_floor' },
  { if: { in: 'quarry_edge' }, say: "You'll want to be holding it first." },
  "There's nothing here worth tying it to.",
];

/* ------------------------------------------------------------------------ *
 *  Rooms                                                                    *
 * ------------------------------------------------------------------------ */

export const rooms = {
  moor_road: {
    name: 'Moor Road', zone: 'moor', picture: 'moor_road',
    desc: 'The moor road, lit only by the town glow behind you. Heather and black peat on both sides. Nosed into the ditch is a blue Cortina, driver\'s door open. North, the road climbs on to the moor. The town is south.',
    exits: { n: 'tally_stone', s: 'high_street', in: 'harrows_car' },
    scenery: [
      { names: ['heather', 'peat'], desc: 'Black and sodden. It would take a footprint and keep it a week.' },
      { names: ['ditch'], desc: "Running water. The Cortina's front wheels are in it." },
      { names: ['cortina', 'car', 'blue car', 'door', 'driver door'], desc: "Harrow's Cortina, J reg, Manchester tax disc. The driver's door hangs open. You could get IN." },
      { names: ['glow', 'town'], desc: 'Blackmere, an orange stain in the fog below.' },
    ],
  },

  harrows_car: {
    name: "Harrow's Car", zone: 'moor', picture: 'harrows_car', ambient: 'wind',
    desc: "Inside Harrow's Cortina. Cold vinyl, a smell of Embassy and wet dog. The radio handset dangles on its curly cord, hissing. Rain beads the windscreen. The road is out.",
    exits: { out: 'moor_road' },
    scenery: [
      { names: ['radio', 'handset', 'cord'], desc: 'Dead air and hiss. You key it: nothing. Someone has pulled the aerial lead out from behind the dash.' },
      { names: ['windscreen', 'wipers'], desc: 'Rain, and through it, the road climbing into nothing.' },
      { names: ['vinyl', 'seat', 'seats', 'passenger seat'], desc: "Cold. The driver's seat is pushed right back. Frank isn't that tall." },
      { names: ['keys', 'ignition'], desc: 'The keys hang in the ignition. You leave them. The car is evidence now.' },
      { names: ['aerial', 'lead', 'dash'], desc: 'The radio lead dangles loose. Not torn - pulled, by somebody who knew where it was.' },
    ],
    onEnter: { if: '!found_car', setFlag: 'found_car', award: 'car_found', say: 'The keys are still in the ignition. Frank never leaves his keys.' },
  },

  tally_stone: {
    name: 'The Tally Stone', zone: 'moor', picture: 'tally_stone', nerve: 1,
    desc: 'A standing stone on the crest of the moor, taller than a man and cut from top to bottom with tally marks, hundreds of them, old as weather. The road runs south to town and north to the asylum. A track leads east to the quarry.',
    exits: { n: 'asylum_gates', e: 'quarry_edge', s: 'moor_road' },
    scenery: [
      { names: ['stone', 'standing stone', 'tally stone'], adjectives: ['standing', 'leaning'], desc: 'Gritstone, leaning. The marks run in gates of five, row on row. Old ones, worn soft. And low down, very fresh: four strokes, pale against the lichen.' },
      { names: ['marks', 'tally marks', 'strokes'], adjectives: ['fresh', 'four'], desc: 'Shepherds counted sheep on it, the guidebooks say. The town says something else. The four fresh strokes are cut with a knife.' },
      { names: ['track'], desc: 'Two ruts in the heather, east.' },
      { names: ['asylum'], desc: 'A long black building to the north. One lamp burning at the lodge.' },
    ],
  },

  // The way down is the `quarry` hazard (exit d, unless the rope is carried or you have
  // already climbed down and found the goat track; ../case.js, TT-123).
  quarry_edge: {
    name: 'Quarry Edge', zone: 'moor', picture: 'quarry_edge', nerve: 2,
    desc: 'The lip of Blackmere Quarry. The face drops sixty feet to black water and spoil heaps. An old winch post leans out over the drop. A tin hut squats behind you. The track runs west to the stone.',
    exits: { w: 'tally_stone', d: 'quarry_floor', in: 'quarry_hut' },
    sink: 'It falls a long way and the black water takes it with a small sound.',
    scenery: [
      { names: ['face', 'drop', 'quarry', 'lip', 'edge', 'quarry edge'], desc: "Sixty feet of wet gritstone. Without a rope you'd never make it down alive." },
      { names: ['water', 'spoil', 'heaps'], desc: "Black water at the bottom, grey spoil around it. A ring of stones by a boulder - somebody's fire." },
      { names: ['winch post', 'post', 'winch'], desc: 'An iron post sunk in concrete. You could tie a rope to that.' },
      {
        names: ['goat track', 'path'],
        desc: [
          { if: 'climbed_down', text: 'The top of the goat track, hidden in the bracken at the lip. From up here you would never have found it.' },
          { text: 'No way down that you can see. Not without a rope.' },
        ],
      },
      { names: ['hut', 'tin hut'], desc: 'Corrugated tin, door hanging off. IN to go inside.' },
    ],
    before: {
      jump: 'You look at the drop. The drop looks at you. No.',
    },
  },

  quarry_hut: {
    name: 'Quarry Hut', zone: 'moor', picture: 'quarry_hut', ambient: 'wind',
    desc: 'A tin hut, its door hanging off. A brazier full of rainwater, a calendar from 1968, a workbench with nothing on it but rust and mouse droppings. The quarry edge is out.',
    exits: { out: 'quarry_edge' },
    scenery: [
      { names: ['brazier'], desc: 'Full of rainwater with a skin of rust on it.' },
      { names: ['calendar'], desc: 'MARCH 1968. A Pirelli girl, faded to a ghost. The quarry closed that spring.' },
      { names: ['workbench', 'bench', 'rust', 'droppings', 'mouse droppings'], desc: 'Rust and droppings.' },
      { names: ['door'], desc: 'Hanging by one hinge, banging softly in the wind.' },
    ],
  },

  quarry_floor: {
    name: 'Quarry Floor', zone: 'moor', picture: 'quarry_floor', ambient: 'wind', nerve: 1,
    desc: 'The quarry floor: black water, spoil heaps, a burnt-out car. In the lee of a boulder someone has made a fire, often - a ring of stones, years of ash. A rough path zig-zags back up to the edge.',
    exits: { u: 'quarry_edge' },
    sink: 'It splashes into the black water and is gone.',
    scenery: [
      { names: ['water'], desc: 'Deep, they say. Nobody knows how deep.' },
      { names: ['car', 'burnt-out car'], desc: 'A Ford Anglia, burnt to the frame years ago. Joyriders, or insurance.' },
      { names: ['boulder', 'fire', 'ring', 'stones', 'ash'], desc: "Years of small fires in the same place. Somebody's private place. Somebody who liked to be alone with something." },
      { names: ['path'], desc: 'A goat track up the spoil. Steep, but you can manage it going up.' },
      { names: ['spoil', 'heaps', 'spoil heaps', 'heap'], desc: 'Grey shale tipped off the face and left to slump in the rain. The goat track picks its way up through it.' },
      { names: ['face', 'edge', 'lip', 'quarry'], desc: 'Sixty feet of wet gritstone going up into the fog. The goat track is the only way back to the edge.' },
    ],
    onEnter: [
      {
        if: '!climbed_down', setFlag: 'climbed_down',
        say: 'You loop the rope round the winch post and let yourself down hand over hand, the wet rock scraping your knees. Then you are at the bottom, and the rope is yours again.',
      },
      // TT-123: after the first climb you know the goat track, rope or no rope.
      { if: { not: { carried: 'rope' } }, say: 'You find the top of the goat track and pick your way down, sliding on the spoil.' },
    ],
  },
};

/* ------------------------------------------------------------------------ *
 *  Items (content order is set by ITEM_ORDER in ../index.js, STORY §5.1)    *
 * ------------------------------------------------------------------------ */

export const items = {
  handcuffs: {
    name: 'handcuffs', article: 'some', names: ['handcuffs', 'cuffs', 'bracelets'], adjectives: ['police', 'steel', 'harrow'],
    location: 'harrows_car', critical: true,
    initial: 'A pair of police handcuffs lies on the passenger seat, dropped in a hurry.',
    desc: "Hiatt handcuffs, Frank's. The key is in the lock. He never got the chance to use them.",
    before: {
      use: [{ if: { present: 'pike' }, then: ARREST_PIKE }, "There's nobody here who needs cuffing."],
      put: [{ if: { present: 'pike' }, then: ARREST_PIKE }],
    },
  },
  notebook_page: {
    name: 'torn notebook page', names: ['page', 'notebook page', 'sheet'], adjectives: ['torn', 'notebook'], location: 'harrows_car',
    initial: 'A torn notebook page lies in the footwell.',
    desc: "A page torn from Frank's notebook, written fast, the biro skidding.",
    readable: {
      say: "'Ledger at the mill names them. Ashcombe - 1970s files. The boy who counted.' Underneath, pressed so hard it tore the paper: 'IT'S'",
      note: 'notebook',
    },
  },
  crowbar: {
    name: 'crowbar', names: ['crowbar', 'jemmy'], adjectives: ['iron', 'rusty'], location: 'quarry_hut', critical: true,
    initial: 'A crowbar leans in the corner, rusty but sound.',
    desc: "Three feet of iron, a claw at one end. The quarrymen's. It would lever open anything that rust has shut.",
    before: {
      use: [
        { if: { present: 'cabinet' }, then: PRY_CABINET },
        { if: { present: 'drawer_four' }, then: MOVE_DRAWER },
        { if: { present: 'iron_trap' }, then: TRAP },
        'Nothing here wants levering.',
      ],
    },
  },
  rope: {
    name: 'rope', names: ['rope', 'coil'], adjectives: ['long', 'coiled'], location: 'quarry_hut', critical: true,
    initial: 'A long coil of rope hangs from a nail.',
    desc: 'Sixty feet of hemp, stiff with cold but sound. Enough to get down a quarry face, with something to tie it to.',
    before: { tie: TIE_ROPE, use: TIE_ROPE },
  },
  exercise_book: {
    name: 'exercise book', names: ['exercise book', 'jotter', 'book'], adjectives: ['swollen', 'child', 'school'], location: 'quarry_floor',
    initial: "A child's exercise book lies swollen beside the fire ring.",
    desc: 'A school exercise book, swollen with rain and dried out and swollen again. On the cover in careful capitals: A.P. FORM 2.',
    readable: 'Page after page of tally marks, gates of five, row on row - and then, halfway through, only fours. Four, four, four, never the fifth stroke, as if the hand refused it. On the last page, in a boy\'s capitals: WHEN THE TALLY IS SETTLED SHE CAN STOP.',
  },
};
