// Adaptive hints (docs/STORY.md §10; A8.11): HINT shows the next tier of the first step
// not yet done and costs `scoring.hintCost` points. Steps whose `done` names a room of a
// later zone switch on when that room lands (stubs.js).

import { ready } from './stubs.js';

const STEPS = [
  [true, {
    id: 'light', done: { awarded: 'torch_lit' },
    tiers: [
      "You won't get far in Blackmere without a light. There's a torch on the waiting-room windowsill, but its batteries are dead.",
      'Maggie at the Black Lamb has batteries. She helps police officers - once she knows you are one.',
      'TAKE TORCH in the waiting room. In the Black Lamb: SHOW CARD TO MAGGIE, PUT BATTERIES IN TORCH, TURN ON TORCH.',
    ],
  }],
  [true, {
    id: 'room', done: { awarded: 'harrows_room' },
    tiers: [
      'Frank was staying at the Black Lamb. His things might tell you what he knew.',
      'Maggie keeps the room keys behind the bar.',
      'Get the key by showing Maggie your card, then go UP. OPEN SUITCASE, READ MAP, READ NOTES.',
    ],
  }],
  [true, {
    id: 'silas', done: { awarded: 'silas_story' },
    tiers: [
      'Frank marked someone at the canal lock as a witness.',
      "Silas Thorne, the lock-keeper, talks for a drink. Maggie sells whisky - once she knows who it's for.",
      'ASK MAGGIE ABOUT SILAS, BUY WHISKY. Then Station Road, EAST, DOWN, EAST, NORTH: GIVE WHISKY TO SILAS.',
    ],
  }],
  [true, {
    id: 'mill', done: { awarded: 'mill_entered' },
    tiers: [
      'Frank circled the mill twice. Its gates are chained.',
      'Silas has something for chains in his shed.',
      'Take the BOLT CUTTERS from the shed (east of the lock), go WEST along the towpath to the mill gates and CUT CHAIN.',
    ],
  }],
  [true, {
    id: 'ledger', done: { found: 'ev_ledger' },
    tiers: [
      "'Who keeps the book?' The mill kept one.",
      'The ledger in the counting house is too heavy to carry - but not all of it is.',
      'In the counting house: TAKE PAGE.',
    ],
  }],
  [true, {
    id: 'register', done: { found: 'ev_register' },
    tiers: [
      'The ledger page names a girl, Mary Pike. Who was she?',
      'The Fourteen have no names on the church wall. The vicar keeps them somewhere.',
      "In the vestry of St Jude's: READ REGISTER.",
    ],
  }],
  [true, {
    id: 'button', done: { found: 'ev_button' },
    tiers: [
      'Ivy Marsh died at No.13 Chapel Street. Scenes are never as clean as they look.',
      'Look closely where the killer knelt, by the candle.',
      'In No.13: SEARCH, then TAKE BUTTON.',
    ],
  }],
  [true, {
    id: 'cuffs', done: { any: [{ carried: 'handcuffs' }, { var: 'pikeState', eq: 'restrained' }] },
    tiers: [
      'Frank took his handcuffs with him. Where did Frank go?',
      'HQ, the map and the occurrence book all point at the moor road. His car is still there.',
      'From High Street go NORTH, get IN the car, TAKE HANDCUFFS.',
    ],
  }],
  [true, {
    id: 'files', done: { any: [{ found: 'ev_file' }, 'morgue_hatch_found', 'hatch_oiled'] },
    tiers: [
      "Frank asked for Ashcombe Asylum's files from 1971. They were never sent. They're still up there.",
      'The asylum has a coal chute. The records cabinet is rusted shut - the quarry hut has tools.',
      'Take the CROWBAR from the quarry hut (EAST of the tally stone). At the asylum: DOWN, NORTH, WEST, OPEN CABINET, TAKE FILE, READ FILE.',
    ],
  }],
  [true, {
    id: 'accuse', done: { any: [{ awarded: 'accusation' }, { var: 'pikeState', oneOf: ['left', 'counting', 'restrained'] }] },
    tiers: [
      'You know who it is. Say it - with at least three pieces of evidence on you.',
      'The man you want is sitting at his desk drinking tea.',
      'At the Police House, carrying your evidence: ACCUSE PIKE.',
    ],
  }],
  [ready('tunnel'), {
    id: 'way_down', done: { visited: 'tunnel' },
    tiers: [
      "Harrow is under the mill, but Pike's trap won't open. Silas told you of other ways down.",
      'The file speaks of a morgue drawer that does not close. And the boiler-room hatch wants oil.',
      'Asylum morgue, torch on: PULL DRAWER, then DOWN. Or mill boiler room: OIL HATCH, OPEN HATCH, DOWN.',
    ],
  }],
  [ready('counting_room'), {
    id: 'door', done: { visited: 'counting_room' },
    tiers: [
      'The iron door is barred from the far side. Somebody has to open it from in there.',
      'Pike goes down to the Counting Room after you accuse him - or at half past eleven anyway - and leaves himself a way out.',
      'Once Pike has gone down, go NORTH from the tunnel with your torch on.',
    ],
  }],
  [true, {
    id: 'arrest', done: { var: 'pikeState', eq: 'restrained' },
    tiers: ["Pike has a knife and he's counting. You haven't long.", "Frank's handcuffs.", 'ARREST PIKE (you must be carrying the handcuffs).'],
  }],
  [true, {
    id: 'free', done: { var: 'harrowFreed', eq: true },
    tiers: ['Frank is chained to the wall.', "Silas's bolt cutters.", 'CUT CHAINS (carrying the bolt cutters).'],
  }],
];

export const hints = STEPS.filter(([ok]) => ok).map(([, step]) => step);
