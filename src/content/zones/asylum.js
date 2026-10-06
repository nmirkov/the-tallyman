// Asylum zone (docs/STORY.md §4.5): 6 rooms, their items and scenery. Prose verbatim.

import { PRY_CABINET, MOVE_DRAWER } from '../shared.js';

/* ------------------------------------------------------------------------ *
 *  Rooms                                                                    *
 * ------------------------------------------------------------------------ */

export const rooms = {
  asylum_gates: {
    name: 'Asylum Gates', zone: 'asylum', picture: 'asylum_gates',
    desc: 'Ashcombe Asylum, closed 1979. The gates are chained, the lodge bricked up, though a lamp still burns over it for no one. At the foot of the wall a coal chute gapes, its lid long gone. The moor road runs south.',
    exits: { s: 'tally_stone', d: 'coal_chute', in: 'coal_chute' },
    scenery: [
      { names: ['gates'], desc: 'Chained, padlocked and welded for good measure. The council meant it.' },
      { names: ['lodge', 'lamp'], desc: 'Bricked up. The lamp over the door is on a timer nobody remembered to cancel.' },
      { names: ['chute', 'coal chute', 'lid'], desc: 'A square black mouth at the foot of the wall, big enough for a man. The coal dust around it is scuffed by boots. You could go DOWN.' },
      { names: ['building', 'clock tower', 'tower'], desc: 'A long range of windows and a clock tower with no clock in it. Just a round hole, like an eye.' },
    ],
  },

  coal_chute: {
    name: 'Coal Chute', zone: 'asylum', picture: 'coal_chute', ambient: 'none', nerve: 1,
    desc: 'The coal cellar at the foot of the chute. Grey light falls from above. Coal dust everywhere, scuffed by boots - recently, and more than once. A stair leads north into the building. You could climb back up the chute.',
    exits: { n: 'entrance_hall', u: 'asylum_gates' },
    scenery: [
      { names: ['coal', 'dust', 'coal dust'], desc: 'Fine and black. It gets into everything - cuffs, tyres, bicycle chains.' },
      { names: ['boots', 'prints', 'bootprints', 'footprints'], desc: "Big boots, size eleven or so, with a nailed heel like a policeman's. In and out, many times." },
      { names: ['chute'], desc: 'A steep slide of sheet iron. You could CLIMB UP it, just.' },
      { names: ['stair', 'stairs'], desc: 'Stone, going up into the building.' },
    ],
  },

  entrance_hall: {
    name: 'Entrance Hall', zone: 'asylum', picture: 'entrance_hall', ambient: 'wind', nerve: 1,
    desc: 'The entrance hall: black and white tiles, a reception hatch, a noticeboard of curling rotas. Moonlight falls through tall windows. Records are west, the ward east. A stair goes down to the morgue. The cellar is south.',
    exits: { e: 'ward', s: 'coal_chute', w: 'records_office', d: 'morgue' },
    scenery: [
      { names: ['tiles', 'floor'], desc: 'Black and white, like a chessboard nobody won.' },
      { names: ['hatch', 'reception', 'reception hatch'], desc: "PLEASE RING. There's no bell." },
      { names: ['noticeboard', 'rotas', 'board'], desc: 'Staff rotas for March 1979. At the bottom, a typed notice: ADOLESCENT WARD - NIGHT CHECKS EVERY 15 MIN. PATIENT P. TO BE COUNTED IN PERSON.' },
      { names: ['windows', 'moonlight'], desc: 'Tall, arched, filthy. The moon comes and goes behind the fog.' },
    ],
  },

  records_office: {
    name: 'Records Office', zone: 'asylum', picture: 'records_office', ambient: 'none',
    desc: 'Records: shelves of box files, a dead typewriter, and a steel cabinet marked P-R, rusted shut. The lodge lamp outside paints everything orange. The hall is east.',
    exits: { e: 'entrance_hall' },
    scenery: [
      { names: ['shelves', 'box files', 'files', 'boxes'], desc: 'Thousands of files. Damp has married most of them into a single block. Only the steel cabinet has kept anything dry.' },
      { names: ['typewriter'], desc: "An Olympia. A sheet still in it: 'Dear Mrs'. Nothing more." },
      { names: ['lamp', 'window'], desc: 'The lodge lamp. Orange light, orange dust.' },
    ],
  },

  ward: {
    name: 'Adolescent Ward', zone: 'asylum', picture: 'ward', ambient: 'counting', dark: true, nerve: 2,
    desc: 'The adolescent ward. Twelve iron beds, stripped. On the wall above bed nine, tally marks in pencil, thousands of them, in neat gates of five, climbing to the ceiling. Something drips. The hall is west.',
    exits: { w: 'entrance_hall' },
    scenery: [
      { names: ['beds', 'bed', 'iron beds'], adjectives: ['iron', 'stripped'], desc: 'Iron frames, springs rusted to lace. A brass number on each foot.' },
      { names: ['bed nine', 'nine', '9'], adjectives: ['ninth'], desc: 'Bed 9. Scratched into the iron of the footboard: A.P.' },
      { names: ['marks', 'tally marks', 'pencil', 'wall'], desc: 'Gates of five, row after row, thousands. A boy counted something here every night for four years. Near the top the rows go wrong - the fifth stroke missing, again and again. Four, four, four.' },
      { names: ['drip', 'water'], desc: 'From the ceiling into a puddle. Drip. Drip. You catch yourself counting.' },
    ],
    // Once, and only with a light (STORY §9.2).
    onEnter: {
      if: [{ lit: true }, '!ward_counting'], setFlag: 'ward_counting', sfx: 'whisper', style: 'whisper',
      say: 'Under the drip, under your breath, someone is counting. "...one, two, three, four..." It stops when you stop breathing.',
    },
  },

  morgue: {
    name: 'Morgue', zone: 'asylum', picture: 'morgue', ambient: 'counting', dark: true, nerve: 2,
    desc: [
      { if: 'morgue_hatch_found', text: 'The morgue: white tiles, a drain in the floor, a slab, and a wall of steel drawers numbered 1 to 8. Drawer 4 has been run back on its rails; beneath it, iron rungs drop into a square hatch. The stair leads up.' },
      { text: 'The morgue: white tiles, a drain in the floor, a slab, and a wall of steel drawers numbered 1 to 8. Drawer 4 does not sit flush with the rest. The stair leads up.' },
    ],
    exits: {
      u: 'entrance_hall',
      d: {
        to: 'tunnel', if: ['morgue_hatch_found', { on: 'torch' }], hidden: true,
        msg: [{ if: '!morgue_hatch_found', text: "You can't go that way." }, { text: 'Not without a light.' }],
      },
    },
    scenery: [
      { names: ['tiles'], desc: 'White, crazed, a few missing like teeth.' },
      { names: ['drain'], desc: 'A brass grating. It smells of the canal.' },
      { names: ['slab'], desc: 'Porcelain. Empty. Clean. Cleaner than anything else in the building.' },
      {
        names: ['hatch', 'rungs'],
        desc: [
          { if: 'morgue_hatch_found', text: 'A square hatch under the drawer, iron rungs going down into black. A cold draught comes up it, smelling of brick and canal.' },
          { text: 'You see no hatch.' },
        ],
      },
    ],
  },
};

/* ------------------------------------------------------------------------ *
 *  Items (content order is set by ITEM_ORDER in ../index.js, STORY §5.1)    *
 * ------------------------------------------------------------------------ */

export const items = {
  cabinet: {
    name: 'cabinet', names: ['cabinet', 'filing cabinet'], adjectives: ['steel', 'rusted', 'p-r'], location: 'records_office',
    fixed: true, openable: true, open: false, locked: true, container: {},
    desc: [
      { if: { open: 'cabinet' }, text: 'A steel cabinet marked P-R, its drawer levered open.' },
      { text: 'A steel filing cabinet marked P-R. Rust has sealed every seam. You would need to lever it.' },
    ],
    before: { open: PRY_CABINET, unlock: PRY_CABINET, break: PRY_CABINET, pry: PRY_CABINET },
  },
  patient_file: {
    name: 'patient file', names: ['file', 'patient file', 'folder'], adjectives: ['patient', 'manila', 'pike'], location: 'cabinet',
    critical: true,
    desc: 'A manila patient file, damp-spotted: ASHCOMBE HOSPITAL - ADOLESCENT UNIT - PIKE, A. - 1971/0413.',
    readable: {
      say: 'PIKE, Arthur. Admitted 3.5.71, aged 13, following death of mother. Obsessional counting (gates of five; cannot complete the fifth stroke). Fixed delusion of a family debt "owed to Mary" to be "settled in full". Night staff report: "the boy kept to the morgue - the drawer that does not close". Discharged 1975, improved. Prognosis: guarded.',
      note: 'morgue_drawer',
    },
  },
  drawer_four: {
    name: 'drawer 4', article: '', names: ['drawer', 'drawer 4', 'drawer four'], adjectives: ['fourth', 'four', '4'], location: 'morgue', fixed: true,
    desc: [
      { if: 'morgue_hatch_found', text: 'Drawer 4, run back into the wall. The hatch yawns beneath it.' },
      { text: 'Drawer 4 stands a finger-width proud of the rest. It does not close. Its runners shine with grease - the only clean metal in the room.' },
    ],
    before: {
      open: MOVE_DRAWER, pull: MOVE_DRAWER, push: MOVE_DRAWER, move: MOVE_DRAWER, close: MOVE_DRAWER,
      search: 'Empty, and cleaner than it should be. The rails it runs on are greased. It moves more than a drawer should.',
    },
  },
  drawers: {
    name: 'drawers', names: ['drawers'], adjectives: ['other', 'steel'], location: 'morgue', scenery: true,
    desc: 'Eight steel drawers. Seven are rusted shut and empty. Number 4 does not sit flush.',
    before: { open: 'Rusted shut, all but number 4.', pull: 'Rusted shut, all but number 4.' },
  },
};
