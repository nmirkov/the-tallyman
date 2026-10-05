// Mini-world fixture (TT-006): a small but complete ContentBundle used by the engine tests
// of TT-006…TT-010. It exercises every world feature the contract defines: a dark room, a
// light source with and without fuel, open / closed / transparent containers, a supporter,
// a locked door visible from both sides (`alsoIn`), a hidden item, scenery (room entries
// and scenery items), two NPCs with topics, personal / critical / evidence items, a fact,
// safe room and zones, typed content vars, hazards, a one-way exit, a stub, beats,
// daemons, a case and hooks. It passes `tools/lint-content.js` with zero errors (the one
// warning is the declared stub, L14). Later tickets may extend it additively.
//
// Map (lit unless noted):
//
//   [pub] =door= [back_room]           towpath (stub) - w - [square] - e - [office]
//     |              : (hidden, d)                          |  n/s           |  s/e (gate)
//   [square]      [cellar] (dark) ---- u ---- [alley] ------+----------------+
//
//   square: n pub, e office, s alley, w towpath (stub)
//   pub: s square, e back_room (oak door, locked, brass key)
//   back_room: w pub, d cellar (hidden until the rug is moved)
//   office: w square, s alley, d cellar (one-way drain; hazard 'drain')
//   alley: n square, e office (only once the gate is unbolted), d cellar
//   cellar (dark, zone beneath): u alley, n back_room (hidden until the trapdoor is open)

/** Plain 40×h picture made of ASCII glyphs. @param {string} id @param {number} [h] */
function art(id, h = 9) {
  const chars = [];
  const colors = [];
  for (let y = 0; y < h; y++) {
    chars.push((y === 0 ? '-' : y === h - 1 ? '#' : ' ').repeat(40));
    colors.push((y % 2 ? '7' : 'e').repeat(40));
  }
  return { id, w: 40, h, chars, colors, bg: '0' };
}

/** @type {import('../../src/engine/types.js').ContentBundle} */
const miniWorld = {
  meta: { id: 'mini', title: 'Mini World', version: '1' },
  rules: {
    start: 'square',
    intro: 'Rain sweeps across Blackmere. It is {time}, and Harrow is still missing.',
    money: 500,
    nerve: {
      start: 10,
      messages: [{ at: 50, text: 'Your hands are starting to shake.' }],
      panicText: 'Your nerve breaks and you run, blindly, until the square opens around you.',
    },
  },
  zones: {
    town: { name: 'Town', safeRoom: 'square', ambient: 'rain' },
    beneath: {
      name: 'Beneath', panic: false, nerveCap: 99, ambient: 'heartbeat',
      capText: 'Your heart hammers, but you hold your ground.',
    },
  },
  rooms: {
    square: {
      name: 'Market Square', zone: 'town', picture: 'square',
      desc: [
        { if: { hook: 'is_late' }, text: 'The square is empty now. Only the clock keeps watch.' },
        { text: 'Rain hammers the cobbles of the market square. The town clock looms over a dry fountain.' },
      ],
      exits: { n: 'pub', e: 'office', s: 'alley', w: 'towpath' },
      scenery: [
        { names: ['clock', 'town clock'], adjectives: ['town'], desc: { hook: 'clock_text' } },
        { names: ['fountain'], adjectives: ['dry', 'stone'], desc: 'A stone basin, dry for years.' },
      ],
    },
    pub: {
      name: 'The Black Lamb', zone: 'town', picture: 'pub', ambient: 'pub',
      desc: 'A low-beamed pub thick with pipe smoke. A heavy oak door leads east.',
      exits: { s: 'square', e: { to: 'back_room', door: 'oak_door' } },
      scenery: [{ names: ['bar', 'counter'], desc: 'Polished by a century of elbows.' }],
    },
    back_room: {
      name: 'Back Room', zone: 'town', picture: 'back_room',
      desc: 'A cramped store room. A threadbare rug covers most of the floor.',
      exits: {
        w: { to: 'pub', door: 'oak_door' },
        d: { to: 'cellar', if: 'trapdoor_open', hidden: true },
      },
    },
    office: {
      name: 'Police Office', zone: 'town', picture: 'office',
      desc: 'A cold office with a desk, a duty register and a drain grating in the floor.',
      exits: {
        w: 'square',
        s: 'alley',
        d: { to: 'cellar', oneWay: true },
      },
      scenery: [{ names: ['desk'], adjectives: ['wooden'], desc: 'Scarred oak, piled with forms.' }],
      before: { wait: { if: { present: 'pike' }, say: 'Pike drums his fingers on the desk.', continue: true } },
    },
    alley: {
      name: 'Back Alley', zone: 'town', picture: 'alley',
      desc: 'A narrow alley above the canal. Steps lead down to a cellar; a yard gate stands east.',
      exits: {
        n: 'square',
        e: { to: 'office', if: 'gate_unbolted', msg: 'The yard gate is bolted from the other side.' },
        d: 'cellar',
      },
      scenery: [{ names: ['canal', 'water'], adjectives: ['black'], desc: 'Black water, very deep.' }],
    },
    cellar: {
      name: 'Cellar', zone: 'beneath', picture: 'cellar', dark: true, nerve: 2,
      desc: 'Damp brick vaults. Somewhere, water drips.',
      exits: {
        u: 'alley',
        n: { to: 'back_room', if: 'trapdoor_open', hidden: true },
      },
      onEnter: { if: { lit: true }, say: 'Your light catches the glint of old bottles.' },
    },
  },
  items: {
    warrant_card: {
      name: 'warrant card', names: ['card', 'warrant card'], personal: true, location: 'player',
      desc: 'Detective Constable, Blackmere CID. The photo flatters you.',
    },
    torch: {
      name: 'torch', names: ['torch', 'flashlight'], adjectives: ['police'], critical: true,
      location: 'office',
      desc: [{ if: { on: 'torch' }, text: 'A police torch, burning steadily.' }, { text: 'A police torch.' }],
      light: { lit: false },
      after: { turn_on: { award: 'torch_lit' } },
    },
    candle: {
      name: 'candle', names: ['candle', 'stub'], adjectives: ['tallow'], location: 'pub',
      initial: 'A stub of tallow candle sits on the windowsill.',
      desc: 'A stub of tallow candle.',
      light: { lit: false, fuel: 10, outText: 'The candle gutters and dies.' },
    },
    satchel: {
      name: 'satchel', names: ['satchel', 'bag'], adjectives: ['leather'], location: 'office',
      desc: 'A battered leather satchel.',
      openable: true, open: false, container: { capacity: 3 },
    },
    handcuffs: {
      name: 'handcuffs', names: ['handcuffs', 'cuffs'], article: 'some', critical: true,
      location: 'satchel', desc: 'Regulation steel handcuffs.',
    },
    brass_key: {
      name: 'brass key', names: ['key'], adjectives: ['brass'], location: 'alley',
      desc: 'A small brass key.',
    },
    iron_key: {
      name: 'iron key', names: ['key'], adjectives: ['iron'], location: 'cellar',
      desc: 'A heavy iron key, cold to the touch.',
    },
    oak_door: {
      name: 'oak door', names: ['door'], adjectives: ['oak', 'heavy'], article: 'the',
      location: 'pub', alsoIn: ['back_room'], fixed: true,
      openable: true, open: false, locked: true, keyId: 'brass_key',
      desc: 'A heavy oak door, banded with iron.',
    },
    crate: {
      name: 'crate', names: ['crate', 'box'], adjectives: ['wooden'], location: 'back_room',
      fixed: 'The crate is far too heavy to lift.',
      openable: true, open: false, container: { capacity: 4 },
      desc: 'A wooden packing crate.',
    },
    ledger_page: {
      name: 'ledger page', names: ['page', 'ledger page', 'ledger'], adjectives: ['torn'],
      location: 'crate', desc: 'A torn page from a mill ledger, dated 1912.',
      readable: 'Wages docked: M. Pike, aged 14, "for idleness".',
    },
    rug: {
      name: 'rug', names: ['rug', 'carpet'], adjectives: ['threadbare'], location: 'back_room',
      scenery: true, desc: 'A threadbare rug. One corner is curled.',
      before: {
        move: [
          { if: 'trapdoor_open', say: 'The rug is already pushed aside.' },
          { say: 'You drag the rug aside, uncovering a trapdoor.', setFlag: 'trapdoor_open', sfx: 'door' },
        ],
      },
    },
    table: {
      name: 'table', names: ['table'], adjectives: ['rickety'], location: 'back_room',
      scenery: true, container: { supporter: true }, desc: 'A rickety deal table.',
    },
    coin: {
      name: '10p coin', names: ['coin', 'ten pence'], adjectives: ['10p', 'ten'], location: 'table',
      hidden: true, found: 'Wedged in a crack in the table is a 10p coin.',
      desc: 'A ten pence piece, 1979.',
    },
    jar: {
      name: 'glass jar', names: ['jar'], adjectives: ['glass'], location: 'table',
      openable: true, open: false, container: { transparent: true, capacity: 1 },
      desc: 'A stoppered glass jar.',
    },
    button: {
      name: 'silver button', names: ['button'], adjectives: ['silver', 'tunic'], location: 'jar',
      desc: 'A silver tunic button, stamped with a crown.',
    },
    register: {
      name: 'duty register', names: ['register', 'duty register'], adjectives: ['duty'],
      location: 'office', fixed: 'It is chained to the desk.',
      desc: 'The station duty register.',
      readable: { say: 'The last entry, at {time}, is in Pike\'s neat hand.', evidence: 'ev_register' },
    },
    helmet: {
      name: 'helmet', names: ['helmet', 'hat'], adjectives: ['custodian'], location: 'office',
      wearable: true, desc: 'A custodian helmet, a size too large.',
    },
    whisky: {
      name: 'bottle of whisky', names: ['whisky', 'bottle'], adjectives: ['scotch'], location: null,
      desc: 'Cheap scotch.', drinkable: 'It burns all the way down.',
    },
  },
  npcs: {
    maggie: {
      name: 'Maggie', names: ['maggie', 'landlady', 'woman'], proper: true, location: 'pub',
      desc: 'Fifty, sharp-eyed, polishing a glass that is already clean.',
      here: 'Maggie is polishing glasses behind the bar.',
      topics: {
        murder: { say: '"Terrible business. Ask Arthur, he knows everyone."', setFlag: 'heard_of_whisky' },
        pike: '"Arthur? Salt of the earth. Counts his change twice, mind."',
        ledger_page: '"Never seen it before, love."',
      },
      default: '"Can\'t help you there, love."',
      talk: '"What\'ll it be?"',
      accepts: { coin: '"Ta, love."' },
      refuse: '"I don\'t want that."',
      shows: {
        warrant_card: [
          { if: '!maggie_saw_card', say: '"Oh! Police, is it?"', setFlag: 'maggie_saw_card' },
          '"Yes, love, I\'ve seen it."',
        ],
      },
      sells: { whisky: { price: 200, if: 'heard_of_whisky', refuse: '"What would you want with that?"' } },
    },
    pike: {
      name: 'Sergeant Pike', names: ['pike', 'sergeant', 'arthur'], adjectives: ['desk'],
      location: 'office',
      desc: 'A neat, grey man who counts everything twice.',
      here: 'Sergeant Pike sits behind the desk, counting forms.',
      topics: {
        murder: '"Nasty. Best leave it to us, eh?"',
        maggie: '"Maggie? She hears everything."',
      },
      default: '"I wouldn\'t know about that."',
      talk: { say: '"The yard gate? I\'ll unbolt it for you."', setFlag: 'gate_unbolted' },
      schedule: [{
        at: 240, to: null, if: { var: 'pikeState', eq: 'desk' },
        leaveText: 'Pike pulls on his coat and leaves without a word.',
        do: { setVar: { pikeState: 'left', arrivalTurn: { turnPlus: 5 } } },
      }],
      before: {
        arrest: [
          { if: { var: 'pikeState', eq: 'restrained' }, say: 'He is going nowhere.' },
          { if: { carried: 'handcuffs' }, setVar: { pikeState: 'restrained' }, award: 'arrest', say: 'You snap the cuffs on.' },
          'With what?',
        ],
      },
    },
  },
  topics: {
    murder: { names: ['murder', 'killing', 'dead girl'] },
  },
  vars: {
    pikeState: { type: 'enum', values: ['desk', 'fled', 'left', 'counting', 'restrained'], init: 'desk' },
    arrivalTurn: { type: 'int', nullable: true, min: 0, init: null },
    bells: { type: 'int', min: 0, init: 0 },
    alarmRaised: { type: 'bool', init: false },
    lastWord: { type: 'str', init: '' },
  },
  evidence: {
    ev_ledger: { label: 'Ledger page (1912)', item: 'ledger_page', award: 'ledger' },
    ev_button: { label: 'Silver tunic button', item: 'button' },
    ev_register: { label: 'Duty register entry', note: 'register', award: 'register' },
  },
  notes: { register: 'Duty register: Pike signed out at the time Harrow vanished.' },
  scoring: {
    maxScore: 40, hintCost: 2,
    awards: {
      torch_lit: { points: 5, label: 'Lit the torch' },
      ledger: { points: 10, label: 'Found the ledger page' },
      register: { points: 5, label: 'Read the duty register' },
      accusation: { points: 10, label: 'Accused the right man' },
      arrest: { points: 10, label: 'Arrested Pike' },
    },
    ranks: [{ min: 0, title: 'Probationer' }, { min: 20, title: 'Sergeant' }, { min: 40, title: 'Inspector' }],
  },
  hints: [
    { id: 'light', done: { awarded: 'torch_lit' }, tiers: ['It is dark below the town.', 'Pike keeps a torch in the office.', 'TURN ON TORCH.'] },
    { id: 'ledger', done: { found: 'ev_ledger' }, tiers: ['The pub keeps its secrets in the back.', 'OPEN CRATE.'] },
  ],
  endings: [
    { id: 'victory', kind: 'victory', title: 'Case Closed', text: 'Pike goes quietly.', when: { var: 'pikeState', eq: 'restrained' } },
    { id: 'midnight', kind: 'midnight', title: 'Midnight', text: 'Somewhere a bell strikes twelve.', when: { turnGte: 300 } },
    { id: 'wrong_man', kind: 'wrong', title: 'Wrong Man', text: 'You arrested the wrong person.' },
    { id: 'death_fall', kind: 'death', title: 'The Drain', text: 'You fall a long way in the dark.' },
    { id: 'death_drown', kind: 'death', title: 'The Canal', text: 'The black water closes over you.' },
  ],
  beats: [
    { id: 'bell', every: 20, run: { sfx: 'bell', say: 'A distant church bell tolls.' } },
    { id: 'rain_eases', when: { turnGte: 50 }, run: 'The rain eases a little.' },
    { id: 'drips', every: 3, when: { in: 'cellar' }, run: { chance: 0.5, pick: ['Water drips somewhere.', 'Something scuttles in the dark.'] } },
  ],
  daemons: [
    { id: 'cellar_bells', run: { if: { in: 'cellar' }, setVar: { bells: { add: 1 } } } },
  ],
  afterAction: [
    { if: [{ var: 'pikeState', eq: 'left' }, { turnGte: { var: 'arrivalTurn' } }], setVar: { pikeState: 'counting' }, move: { pike: 'cellar' } },
  ],
  hazards: {
    drain: { room: 'office', exit: 'd', warn: 'The drain shaft drops into blackness. You would not survive the fall.', ending: 'death_fall' },
    canal: { room: 'alley', verbs: ['swim', 'jump'], warn: 'The canal is black, cold and very deep.', ending: 'death_drown' },
  },
  case: {
    culprit: 'pike', threshold: 2, suspects: ['maggie'],
    confirm: 'Are you certain? (Y/N)',
    correct: { award: 'accusation', setVar: { pikeState: 'fled', arrivalTurn: { turnPlus: 5 } }, move: { pike: null }, say: 'Pike shoves past you and is gone.' },
    weak: { say: 'Pike laughs in your face.', nerve: 15 },
    wrong: { end: 'wrong_man' },
  },
  verbs: [
    { id: 'take', words: ['nick'] },
    { id: 'pray', words: ['pray'], default: 'Nobody is listening.' },
  ],
  messages: { stub: 'That way lies the towpath, and it is not built yet.' },
  help: 'Type commands like LOOK, TAKE KEY or GO NORTH.',
  hooks: {
    is_late: (api) => api.turn >= 200,
    clock_text: (api) => (api.turn >= 200 ? 'The clock reads nearly midnight.' : 'The clock reads half past nine.'),
  },
  art: {
    square: art('square'),
    pub: art('pub'),
    back_room: art('back_room'),
    office: art('office'),
    alley: art('alley'),
    cellar: art('cellar'),
  },
  stubs: { towpath: { name: 'Towpath', zone: 'town' } },
};

export { miniWorld };
export default miniWorld;
