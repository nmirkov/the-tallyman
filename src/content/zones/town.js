// Town zone (docs/STORY.md §4.1): 18 rooms, their items and scenery, plus the player's
// personal effects and the things Maggie hands over or sells (they start at `null`).
// Prose is verbatim from STORY.md; see tickets/TT-016-content-town-canal/implementation.md
// for the few mechanical deviations.

import { CALL_HQ, LOAD_TORCH } from '../shared.js';

/* ------------------------------------------------------------------------ *
 *  Item-local named reactions (STORY §5.2)                                  *
 * ------------------------------------------------------------------------ */

const HARROWS_DOOR = [
  { if: { carried: 'room_key' }, say: "You've got Maggie's key. Just go UP." },
  'Locked. Maggie keeps the keys behind the bar.',
];

const OCCURRENCE = {
  say: '15/11/84. 09:00 On duty. 14:10 DI Harrow (Manchester) called in, enquired re: Ashcombe. 20:35 Out on patrol - Moor Road. 21:20 Returned. Nothing to report. 21:30 Kettle on.',
  note: 'pike_patrol',
  then: { if: { present: 'pike' }, say: '"Just my rounds, Sergeant," says Pike, watching you read. "Nothing to report."' },
};

const READ_REGISTER = {
  say: 'You turn to November 1912. A page and a half in the same tired hand, fourteen names, all buried on the 20th: ...Alice Crowther, 13. Nellie Dawson, 15. Mary Pike, 14, half-timer, d. 15 Nov 1912. Lily Platt, 12... Pike. You think of the big kind constable and his tea.',
  evidence: 'ev_register',
};

const MOVE_STONE = [
  { if: '!letters_found', reveal: 'love_letters' },
  'Behind it there is only a hollow where the tin was.',
];

/* ------------------------------------------------------------------------ *
 *  Rooms                                                                    *
 * ------------------------------------------------------------------------ */

export const rooms = {
  platform: {
    name: 'Platform', zone: 'town', picture: 'platform',
    desc: "A deserted platform under a dripping canopy. The last train's lamps shrink into the rain and are gone. A gas lamp hisses over a sign: BLACKMERE. The waiting room is west; Station Road climbs north into the town.",
    exits: { n: 'station_road', w: 'waiting_room' },
    scenery: [
      { names: ['canopy', 'roof'], desc: 'Iron and glass, Victorian, leaking in a dozen places onto the same dozen places.' },
      { names: ['gas lamp', 'lamp'], desc: "It hisses and pops. Moths would be dancing round it if anything could fly in this." },
      { names: ['sign', 'nameboard'], desc: 'BLACKMERE, white on maroon. Someone has scratched four short strokes under the B.' },
      { names: ['rails', 'track', 'line', 'train'], desc: 'The rails shine for a while and then the dark takes them. No more trains tonight.' },
      { names: ['rain'], desc: 'Lancashire rain: patient, thorough, personal.' },
    ],
  },

  waiting_room: {
    name: 'Waiting Room', zone: 'town', picture: 'waiting_room', ambient: 'none',
    desc: 'A cold waiting room that smells of wet coats and Jeyes Fluid. A wooden bench runs under a timetable nobody has changed since 1979, and the grate has not seen a fire in years. The door east leads back to the platform.',
    exits: { e: 'platform' },
    scenery: [
      { names: ['timetable', 'table'], desc: 'SUMMER 1979. Every train on it has long since gone.' },
      { names: ['grate', 'fireplace', 'fire'], desc: 'Cold ash and a crisp packet. Smiths, salt and vinegar.' },
      { names: ['door'], desc: 'Glass-panelled. Rain runs down it in crooked lines.' },
      { names: ['window', 'windowsill', 'sill'], desc: 'Grimy glass. The platform lamp makes a yellow smear of it.' },
    ],
  },

  station_road: {
    name: 'Station Road', zone: 'town', picture: 'station_road',
    desc: 'Station Road climbs between blackened terraces. Rain runs down the gutters in a hurry to be somewhere else. North, the lamps of Market Square. East, a humpbacked bridge crosses the canal. The station is south.',
    exits: { n: 'market_square', e: 'canal_bridge', s: 'platform' },
    scenery: [
      { names: ['terraces', 'houses', 'terrace'], desc: 'Two-up two-downs, soot-black. Curtains drawn tight in every one. Nobody wants to see out tonight.' },
      { names: ['gutters', 'gutter'], desc: 'Fast and loud. You could float a boat. You could lose one.' },
      { names: ['lamps', 'square'], desc: 'Orange smudges up the hill.' },
      { names: ['bridge'], desc: 'Over to the east, stone, humpbacked, over black water.' },
    ],
  },

  market_square: {
    name: 'Market Square', zone: 'town', picture: 'market_square',
    desc: 'Market Square: wet cobbles, a stone cross, sodium lamps humming orange. The Black Lamb glows to the west; opposite, the blue lamp of the Police House. A phone box waits by the cross. High Street runs north, Station Road south.',
    exits: { n: 'high_street', e: 'police_house', s: 'station_road', w: 'black_lamb', in: 'phone_box' },
    scenery: [
      { names: ['cobbles', 'cobblestones'], desc: 'Slick as fish.' },
      { names: ['cross', 'market cross'], desc: 'A worn stone cross. The steps are carved with initials and, low on one side, four neat strokes.' },
      { names: ['lamps', 'sodium lamps', 'lamp'], adjectives: ['sodium', 'orange'], desc: 'They hum. The light they give is the colour of weak tea.' },
      { names: ['blue lamp', 'police lamp'], adjectives: ['blue', 'police'], desc: "POLICE, in white on blue. Somebody's in; the office light is on." },
      { names: ['phone box', 'box'], adjectives: ['red'], desc: 'A red K6 phone box. The light inside works. IN to use it.' },
    ],
  },

  phone_box: {
    name: 'Phone Box', zone: 'town', picture: 'phone_box', ambient: 'none',
    desc: 'A red phone box, glass fogged, smelling of fag ends. The directory has been torn out page by page. A card above the phone says MINIMUM CALL 10p, and someone has scratched four strokes into the paint beside it. The square is out.',
    exits: { out: 'market_square' },
    scenery: [
      { names: ['directory', 'book', 'pages'], desc: 'Just the spine and the letters A to C. Someone wanted the rest.' },
      { names: ['card', 'notice'], desc: 'MINIMUM CALL 10p. FOR EMERGENCIES DIAL 999. In biro underneath: DONT.' },
      { names: ['strokes', 'scratches', 'marks', 'paint'], desc: "Four strokes. Neat, deliberate, about the height of a big man's eyes." },
      { names: ['glass'], desc: 'Fogged with your own breath. You wipe a hole. The square, the cross, the rain.' },
    ],
    before: { call: CALL_HQ },
  },

  black_lamb: {
    name: 'The Black Lamb', zone: 'town', picture: 'black_lamb', ambient: 'pub', nerve: -1,
    desc: 'The Black Lamb: low beams, horse brasses, a fire that has seen better winters. Three regulars stare into their mild and do not look up. Behind the bar a stair climbs to the guest rooms. Market Square is east.',
    exits: {
      e: 'market_square',
      u: { to: 'harrows_room', if: { carried: 'room_key' }, msg: "Harrow's door at the top of the stairs is locked. Maggie keeps the keys behind the bar." },
    },
    scenery: [
      { names: ['beams', 'beam'], desc: 'Black oak, low enough to teach tall men humility.' },
      { names: ['brasses', 'horse brasses'], desc: "Polished to a shine. Maggie's work. Everything in here is polished except the regulars." },
      { names: ['fire', 'fireplace'], desc: 'Coal, banked low. You stand near it a moment. It helps.' },
      { names: ['regulars', 'drinkers', 'locals', 'men'], desc: 'Three old men, three pints of mild. They have decided you are not here.' },
      { names: ['bar', 'counter', 'pumps'], desc: 'Thwaites on the pumps, a jar of pickled eggs, a till that rings like a church bell.' },
      { names: ['stair', 'stairs', 'staircase'], desc: "Narrow, carpeted, up to the guest rooms. Harrow's is at the top." },
    ],
  },

  harrows_room: {
    name: "Harrow's Room", zone: 'town', picture: 'harrows_room', ambient: 'none',
    desc: "Harrow's room: a candlewick bedspread, a gas ring, a window streaming with rain. His suitcase sits on the bed. His jacket hangs on the chair. An ashtray holds six Embassy ends. The stair leads down.",
    exits: { d: 'black_lamb' },
    scenery: [
      { names: ['bedspread', 'bed', 'candlewick'], desc: "Pink candlewick. He hasn't slept in it. He hasn't even sat on it." },
      { names: ['gas ring', 'ring'], desc: 'A kettle on it, cold.' },
      { names: ['window'], desc: 'Rain, and beyond it the dark lump of the moor.' },
      { names: ['jacket', 'coat'], desc: 'His sports jacket, elbow patches. On the belt hanging with it, an empty handcuff pouch. He took his cuffs with him.' },
      { names: ['pouch', 'handcuff pouch', 'belt'], desc: 'Black leather, police issue, empty. Wherever Frank went, his handcuffs went too.' },
      { names: ['chair'], desc: 'A hard chair. His jacket on it.' },
      { names: ['ashtray', 'ends', 'embassy'], desc: 'Six. Frank smokes when he is close to something.' },
    ],
    onEnter: { if: '!entered_harrows_room', setFlag: 'entered_harrows_room', say: "You let yourself in with Maggie's key.", award: 'harrows_room' },
  },

  police_house: {
    name: 'Police House', zone: 'town', picture: 'police_house', ambient: 'none',
    desc: [
      { if: { var: 'pikeState', eq: 'fled' }, text: "The front office of the Police House. The counter flap is up, the occurrence book open on the desk, and Pike's helmet lies on the floor where it fell. The clock ticks for nobody. The cells are east. The square is west." },
      { if: { var: 'pikeState', oneOf: ['left', 'counting', 'restrained'] }, text: "The front office of the Police House. Empty. The kettle is still warm and the occurrence book lies open on the desk. Pike's cape is gone from its peg. The clock ticks. The cells are east. The square is west." },
      { text: 'The front office of the Police House: a counter, a kettle, a wall clock that ticks too loudly, a desk with the occurrence book open on it. Wanted posters curl on a board. The cells are east. The square is west.' },
    ],
    exits: { e: 'cells', w: 'market_square' },
    scenery: [
      { names: ['counter', 'flap'], desc: "Varnished, scarred, a bell on it you can't imagine anyone ringing." },
      { names: ['kettle'], desc: "A big tin kettle. Arthur Pike's tea runs on it." },
      { names: ['clock', 'wall clock'], desc: 'A railway clock. Its tick fills the room. It is right, to the second.' },
      { names: ['desk'], desc: 'Tidy to a fault. Pencils in a jar in fours. The occurrence book lies open.' },
      { names: ['posters', 'board', 'wanted posters'], desc: "Faces from 1981. A missing dog. A Neighbourhood Watch leaflet with the Tallyman's tally drawn on it in biro by some wag." },
      {
        names: ['helmet'],
        desc: [
          { if: { var: 'pikeState', eq: 'fled' }, text: "Pike's helmet, upturned. He went out without it, in a hurry." },
          { text: 'On its peg, polished.' },
        ],
      },
      { names: ['peg', 'pegs', 'cape'], desc: "A row of pegs by the door. Pike's cape hangs there - a long police cape, the old kind." },
    ],
  },

  cells: {
    name: 'Cells', zone: 'town', picture: 'cells', ambient: 'none',
    desc: 'Two cells, doors open, a bucket in each. A black police bicycle leans in the corridor. Someone has scratched four strokes low on the wall of the far cell, very neat. The front office is west.',
    exits: { w: 'police_house' },
    scenery: [
      { names: ['cells', 'cell', 'doors'], desc: "Empty. Blackmere doesn't lock many people up. It prefers to talk about them." },
      { names: ['bucket', 'buckets'], desc: 'Galvanised. Clean. Pike runs a tidy station.' },
      { names: ['bicycle', 'bike'], adjectives: ['police', 'black'], desc: "Pike's bicycle, upright and heavy. Fresh moor mud caked in the tyres, and black coal dust ground into the chain." },
      { names: ['strokes', 'marks', 'scratches', 'wall'], desc: 'Four strokes, scratched with something sharp, by someone kneeling. Prisoners do it to count days. Nobody has been held here in a month.' },
    ],
  },

  high_street: {
    name: 'High Street', zone: 'town', picture: 'high_street',
    desc: 'High Street: shuttered shops, a Co-op, a butcher\'s with the blinds down. Chapel Street runs west and Church Lane climbs north-east towards a dark spire. North, the street gives up and becomes the moor road. The square is south.',
    exits: { n: 'moor_road', ne: 'church_lane', s: 'market_square', w: 'chapel_street' },
    scenery: [
      { names: ['shops', 'shutters', 'co-op', 'coop'], desc: "CLOSED, CLOSED, CLOSING DOWN SALE. The Co-op has a poster for the miners' strike fund." },
      { names: ['butcher', 'butchers', 'blinds'], desc: 'HOLT & SON, FAMILY BUTCHERS. Dennis Holt drove the bus. His dad still cuts the meat. The blinds have been down for two weeks.' },
      { names: ['spire', 'church'], desc: "St Jude's, black against a sky only slightly less black." },
      { names: ['moor'], desc: 'Above the last streetlamp, nothing at all.' },
    ],
  },

  chapel_street: {
    name: 'Chapel Street', zone: 'town', picture: 'chapel_street',
    desc: 'Chapel Street. Terraces shoulder to shoulder. Police tape sags across the door of No.13, the fourth house to go dark. A ginnel runs west behind the houses. High Street is east.',
    exits: { e: 'high_street', w: 'back_alley', in: 'number_13' },
    scenery: [
      { names: ['terraces', 'houses'], desc: 'Every curtain twitches once as you pass, then stills.' },
      { names: ['tape', 'police tape'], desc: 'POLICE - DO NOT CROSS. It has been crossed. You cross it too.' },
      { names: ['door', 'no.13', 'number 13', '13'], desc: 'A green door, number 13 in brass. Unlocked. Nobody in Blackmere would dare.' },
      { names: ['ginnel', 'alley'], desc: 'A narrow passage between the backs. Lancashire for alley.' },
    ],
  },

  number_13: {
    name: 'No.13 Chapel Street', zone: 'town', picture: 'number_13', ambient: 'none', nerve: 1,
    desc: "Ivy Marsh's front room, a week on. Lace, a clock stopped at ten past ten, a dark stain on the hearthrug. On the wall by the hearth four strokes are scratched into the wallpaper. A candle stub has melted to the skirting below. The street is out.",
    exits: { out: 'chapel_street' },
    scenery: [
      { names: ['lace', 'curtains', 'doilies'], desc: 'Lace on every surface. Ivy Marsh taught infants for forty years and kept a house like a classroom.' },
      { names: ['clock'], desc: 'A carriage clock, stopped at ten past ten. Nobody has wound it. Nobody will.' },
      { names: ['stain', 'hearthrug', 'rug'], desc: "A dark stain. You don't need to look closer, and you don't." },
      { names: ['strokes', 'marks', 'wallpaper', 'wall', 'scratches'], desc: 'Four strokes, gouged deep, at kneeling height. Whoever did it knelt here with a candle and took their time.' },
      { names: ['hearth', 'fireplace'], desc: 'Cold.' },
      { names: ['skirting', 'skirting board'], desc: 'Candle wax has run down onto it and set.' },
    ],
  },

  back_alley: {
    name: 'Back Alley', zone: 'town', picture: 'back_alley', nerve: 1,
    desc: 'A ginnel behind Chapel Street: wet flags, dustbins, a coal-hole lid. Someone has chalked four strokes on a back gate, and a fifth, half rubbed out. A gap in the wall leads north-east into the churchyard. Chapel Street is east.',
    exits: { ne: 'churchyard', e: 'chapel_street' },
    scenery: [
      { names: ['flags', 'flagstones'], desc: 'York stone, worn into dips that hold the rain.' },
      { names: ['coal-hole', 'coal hole', 'lid'], desc: "A cast-iron lid, rusted into its ring. Nothing's gone down there in years." },
      { names: ['gate', 'back gate', 'chalk', 'strokes'], desc: 'Children\'s chalk: four strokes, then a fifth slashed across them and smudged out by a sleeve. Kids playing at the Tallyman. Or somebody practising.' },
      { names: ['gap', 'wall'], desc: 'A gap where the wall has given up. Beyond it, gravestones.' },
    ],
  },

  church_lane: {
    name: 'Church Lane', zone: 'town', picture: 'church_lane',
    desc: "Church Lane climbs between yew hedges to St Jude's. Edna Ashworth's cottage stands dark at the corner, its windows boarded. The church door is north. High Street lies south-west.",
    exits: { n: 'st_judes', sw: 'high_street', in: 'st_judes' },
    scenery: [
      { names: ['yew', 'hedges', 'hedge', 'yews'], desc: 'Old yews, black and dripping. They have been here longer than the church.' },
      { names: ['cottage'], desc: "Edna Ashworth's. The first stroke. Boarded up now, as if the house were ashamed." },
      { names: ['windows', 'boards'], desc: 'Chipboard, nailed by somebody who wanted it done quickly.' },
      { names: ['church door'], desc: 'Oak, studded, ajar. A light inside.' },
    ],
  },

  st_judes: {
    name: "St Jude's", zone: 'town', picture: 'st_judes', ambient: 'none',
    desc: "St Jude's: cold stone, candle smoke and damp hymn books. Fourteen small brass plaques line the north wall. The vestry is east; the porch north opens on the churchyard. Steps lead down to the crypt. The lane is south.",
    exits: { n: 'churchyard', e: 'vestry', s: 'church_lane', d: 'crypt', out: 'church_lane' },
    scenery: [
      { names: ['plaques', 'plaque', 'brass'], desc: 'Fourteen small brass plaques, each engraved with the same date and nothing else: 15 NOVEMBER 1912. No names. The vicar will tell you the names are in the register.' },
      { names: ['pews', 'pew'], desc: 'Box pews, the doors worn smooth by a century of hands.' },
      { names: ['candles', 'candle'], desc: 'A rack of votive candles. Four are burning. You count them without meaning to.' },
      { names: ['hymn books', 'books'], desc: 'Ancient and Modern, swollen with damp.' },
      { names: ['porch'], desc: 'The north porch. Rain blows in.' },
      { names: ['steps', 'crypt steps'], desc: 'Stone steps, worn hollow, going down into the dark. The vicar watches you look at them.' },
    ],
    before: {
      pray: { nerve: -5, say: 'You sit in a box pew and close your eyes. When you open them the candles are still burning. Four of them. It helps, a little.' },
    },
  },

  vestry: {
    name: 'Vestry', zone: 'town', picture: 'vestry', ambient: 'none',
    desc: 'The vestry: cassocks on hooks, a cupboard of communion wine, a desk under a green-shaded lamp. On the desk lies the burial register of St Jude\'s, open, its pages foxed with age. The church is west.',
    exits: { w: 'st_judes' },
    scenery: [
      { names: ['cassocks', 'hooks', 'robes'], desc: 'Black, white, purple for Lent. They hang like a queue of tired men.' },
      { names: ['cupboard', 'wine'], desc: 'Locked. A note on it in a careful hand: NOT TO BE TOUCHED - C.A.' },
      { names: ['desk'], desc: 'A heavy desk. The register takes up most of it.' },
      { names: ['lamp', 'green lamp'], desc: "A banker's lamp. Its light makes the register look like a stage." },
    ],
  },

  churchyard: {
    name: 'Churchyard', zone: 'town', picture: 'churchyard', nerve: 1,
    desc: 'A churchyard drowning in long grass. Headstones lean like tired men. In the middle stands the memorial to the Fourteen: a stone girl with her face worn smooth. The porch is south; a gap in the wall leads south-west to a ginnel.',
    exits: { s: 'st_judes', sw: 'back_alley' },
    scenery: [
      { names: ['grass'], desc: 'Long, wet, grabbing at your trousers.' },
      { names: ['headstones', 'graves', 'stones'], desc: 'Ashworth. Crabtree. Holt. The old town names, over and over. And Marsh, freshly dug, flowers still in their cellophane.' },
      { names: ['girl', 'statue', 'stone girl'], desc: "Carved in clogs and shawl, hands folded. The rain has taken her face. You find you don't like turning your back on her." },
      { names: ['gap', 'wall'], desc: 'Leads to the ginnel behind Chapel Street.' },
    ],
  },

  crypt: {
    name: 'Crypt', zone: 'town', picture: 'crypt', ambient: 'drone', dark: true, nerve: 1,
    desc: 'A low crypt. Coffin shelves, broken chairs, a hundred years of dust. One stone in the wall sits proud of the others, its mortar picked clean. The steps lead up.',
    exits: { u: 'st_judes' },
    scenery: [
      { names: ['shelves', 'coffins', 'coffin'], desc: 'Lead coffins on stone shelves, labels long gone. Nothing has moved here for a century except the vicar.' },
      { names: ['chairs'], desc: 'Stacked, broken. Harvest festival 1953, by the look of the bunting.' },
      { names: ['dust'], desc: 'Thick everywhere - except a trail from the steps to that one stone.' },
    ],
  },
};

/* ------------------------------------------------------------------------ *
 *  Items (content order is set by ITEM_ORDER in ../index.js, STORY §5.1)    *
 * ------------------------------------------------------------------------ */

/** TURN OFF in the Counting Room while Pike counts: warned once (STORY §5.2). */
const TORCH_OFF_WARNING = {
  if: [{ in: 'counting_room' }, { var: 'pikeState', eq: 'counting' }, '!dark_warned'], setFlag: 'dark_warned', style: 'alert',
  say: 'Switch off your only light, with Pike and his knife in here? He counts by touch. You do not. (Do it again if you really mean it.)',
};

export const items = {
  warrant_card: {
    name: 'warrant card', names: ['warrant card', 'card', 'warrant', 'id', 'identification', 'badge'], adjectives: ['police', 'my'],
    location: 'player', personal: true,
    desc: 'Your warrant card. The photo makes you look like a suspect. Greater Manchester Police, CID.',
  },
  wallet: {
    name: 'wallet', names: ['wallet', 'money', 'cash'], adjectives: ['leather'], location: 'player', personal: true,
    desc: "Your wallet. Inside: {money}, a photo you don't look at tonight, and a Barclaycard nobody in Blackmere will take.",
  },
  torch: {
    name: 'torch', names: ['torch', 'flashlight'], adjectives: ['police', 'rubber'], location: 'waiting_room', critical: true,
    initial: 'Someone has left a big rubber police torch on the windowsill.',
    desc: [
      { if: { on: 'torch' }, text: 'A police torch, rubber-cased, throwing a good hard beam.' },
      { if: 'torch_loaded', text: 'A police torch, loaded with fresh batteries. It is switched off.' },
      { text: 'A rubber-cased police torch. You shake it: dead batteries rattle inside. Someone stole the good ones.' },
    ],
    light: { lit: false, fuel: 320, needs: 'torch_loaded', needsMsg: 'Click. Nothing. The batteries in it are as dead as Dickens.', outText: 'Your torch dies.' },
    after: { turn_on: { award: 'torch_lit' } },
    before: {
      turn_on: { if: [{ carried: 'batteries' }, '!torch_loaded'], say: '(First you load the fresh batteries.)', move: { batteries: null }, setFlag: 'torch_loaded', continue: true },
      // The warning names the Counting Room, so it switches on with TT-018's rooms.
      turn_off: TORCH_OFF_WARNING,
    },
  },
  bench: {
    name: 'bench', names: ['bench', 'seat'], adjectives: ['wooden', 'oak'], location: 'waiting_room', scenery: true,
    container: { supporter: true },
    desc: 'Scarred oak, carved with initials going back to the war. The slats are far enough apart to lose things in.',
  },
  coin: {
    name: '10p coin', names: ['coin', '10p', 'ten pence', 'tenpence'], adjectives: ['ten', 'small'], location: 'bench', hidden: true,
    desc: 'A ten pence piece, 1979. Enough for a phone call.',
    found: 'Wedged between the slats of the bench is a 10p coin.',
    before: {
      use: [{ if: { in: 'phone_box' }, then: CALL_HQ }, "There's no phone here."],
      put: [{ if: { in: 'phone_box' }, then: CALL_HQ }],
    },
  },
  payphone: {
    name: 'phone', names: ['phone', 'telephone', 'payphone', 'receiver', 'hq', 'headquarters', 'cid', 'manchester'], adjectives: ['black'],
    location: 'phone_box', scenery: true,
    desc: 'A black GPO payphone. Press button A, press button B, the whole palaver. Dial HQ: CALL HQ.',
    before: { use: CALL_HQ, call: CALL_HQ },
  },
  batteries: {
    name: 'batteries', article: 'some', names: ['batteries', 'battery', 'ever ready'], adjectives: ['fresh', 'new'], location: null, critical: true,
    desc: 'Four Ever Ready batteries, fresh, still in their cellophane.',
    criticalMsg: "They're the only fresh batteries in Blackmere. Hang on to them.",
    before: { put: LOAD_TORCH, use: LOAD_TORCH, replace: LOAD_TORCH },
  },
  room_key: {
    name: 'room key', names: ['key', 'room key'], adjectives: ['brass', 'harrow'], location: null, critical: true,
    desc: "A brass Yale on a wooden tag: 3. Harrow's room.",
    before: { use: "You'll let yourself in when you go upstairs.", unlock: "You'll let yourself in when you go upstairs." },
  },
  harrows_door: {
    name: 'door', names: ['door'], adjectives: ['bedroom', 'harrow', 'guest'], location: 'black_lamb', alsoIn: ['harrows_room'], scenery: true,
    desc: 'Room 3, at the top of the stairs.',
    before: { open: HARROWS_DOOR, unlock: HARROWS_DOOR },
  },
  whisky: {
    name: 'bottle of whisky', names: ['whisky', 'whiskey', 'bottle', 'scotch', 'bells'], location: null, critical: true,
    desc: "A half-bottle of Bell's. Maggie's price, Silas's poison.",
    criticalMsg: "That's for Silas. Hang on to it.",
  },
  pint: {
    name: 'pint of mild', names: ['pint', 'mild', 'beer', 'glass'], location: null,
    desc: 'A pint of mild, dark and flat, a thumb of foam.',
    drinkable: { say: 'Flat, brown and wonderful. Your hands steady a little.', nerve: -10 },
  },
  suitcase: {
    name: 'suitcase', names: ['suitcase', 'luggage', 'bag'], adjectives: ['brown', 'harrow'], location: 'harrows_room',
    fixed: "It's Frank's. You'll look through it here.", openable: true, open: false, container: {},
    desc: "A brown suitcase, labels from Blackpool and Benidorm. Frank's holiday case, for a working trip.",
  },
  case_map: {
    name: 'map', names: ['map', 'case map'], adjectives: ['ordnance', 'survey', 'harrow'], location: 'suitcase',
    desc: 'An Ordnance Survey map of Blackmere, marked in biro.',
    readable: {
      say: "Harrow's biro: the mill circled twice. Ashcombe Asylum, on the moor north of the tally stone, circled. At the canal lock: 'S. THORNE - saw something?' And by the Police House, a question mark, scribbled out.",
      note: 'case_map',
    },
  },
  harrows_notes: {
    name: "Harrow's notes", article: '', names: ['notes', 'list', 'names'], adjectives: ['harrow', 'victim'], location: 'suitcase',
    desc: 'A sheet of Frank\'s handwriting. You know it from a hundred reports.',
    readable: {
      say: 'ASHWORTH 18/10. CRABTREE 25/10. HOLT 1/11. MARSH 8/11. All Thursdays. All old mill names. Then, underlined twice: TALLY = DEBT. Who keeps the book? And smaller, at the bottom, in a different pen: Harrow.',
      note: 'harrow_list',
    },
  },
  occurrence_book: {
    name: 'occurrence book', names: ['book', 'occurrence book', 'log', 'logbook'], adjectives: ['occurrence', 'police'],
    location: 'police_house', scenery: true,
    desc: "The station occurrence book, open at today. Pike's round, careful hand.",
    readable: OCCURRENCE,
    before: { examine: OCCURRENCE },
  },
  candle_stub: {
    name: 'candle stub', names: ['candle', 'stub', 'candle stub', 'wax'], adjectives: ['melted'], location: 'number_13', scenery: true,
    container: {},
    desc: 'A church candle, burned down to a stub and melted to the skirting. Somebody knelt here for a long time.',
  },
  button: {
    name: 'silver button', names: ['button', 'tunic button'], adjectives: ['silver', 'police', 'crown', 'tunic'], location: 'candle_stub',
    critical: true, hidden: true,
    desc: 'A silver tunic button, crown and all - police issue. A thread still hangs from its shank. Only one man in Blackmere wears buttons like this.',
    found: 'Pressed into the cold wax of the candle stub, half buried, is something silver: a button.',
  },
  dustbin: {
    name: 'dustbin', names: ['dustbin', 'dustbins', 'bin', 'bins'], adjectives: ['metal'], location: 'back_alley', scenery: true,
    container: {},
    desc: 'A dented bin, lid off, full of rain and potato peelings.',
  },
  newspaper: {
    name: 'newspaper', names: ['newspaper', 'paper', 'bugle'], adjectives: ['blackmere', 'wet'], location: 'dustbin', hidden: true,
    desc: 'The Blackmere Bugle, sodden but legible.',
    found: 'Folded on top of the rubbish in the bin is this week\'s Bugle.',
    readable: "THE TALLYMAN STRIKES FOURTH TIME. Retired teacher Ivy Marsh (66) found dead at home, No.13 Chapel Street. Like Edna Ashworth, Walter Crabtree and Dennis Holt before her, four strokes scratched beside the body. Police 'following several lines of inquiry'. PC Arthur Pike: 'Lock your doors on a Thursday.' Inside: MILL TO BE PULLED DOWN.",
  },
  register: {
    name: 'burial register', names: ['register', 'burial register', 'parish register'], adjectives: ['burial', 'parish'],
    location: 'vestry', scenery: true, fixed: 'It\'s chained to the desk, and it weighs as much as a font.',
    desc: "The burial register of St Jude's, 1890 to 1950. Foxed pages, copperplate, a lot of children. You could READ it.",
    readable: READ_REGISTER,
    // STORY §7.2 step 16: SEARCH REGISTER / LOOK IN REGISTER read it too.
    before: { search: READ_REGISTER },
  },
  memorial: {
    name: 'memorial', names: ['memorial', 'plinth', 'inscription'], location: 'churchyard', scenery: true,
    desc: 'A stone girl on a plinth. An inscription below.',
    readable: 'IN MEMORY OF THE FOURTEEN. 15 NOVEMBER 1912. THEIR TALLY IS WITH GOD. The names beneath have weathered away to nothing. The burial register in the vestry would have them.',
  },
  loose_stone: {
    name: 'loose stone', names: ['stone', 'loose stone', 'mortar'], adjectives: ['loose', 'proud'], location: 'crypt', scenery: true,
    desc: 'One stone in the wall, its mortar picked out and the dust around it disturbed.',
    before: { move: MOVE_STONE, pull: MOVE_STONE, push: MOVE_STONE, take: MOVE_STONE, search: MOVE_STONE },
  },
  love_letters: {
    name: 'bundle of letters', names: ['letters', 'bundle', 'tin', 'toffee tin'], adjectives: ['love'], location: 'crypt', hidden: true,
    desc: "A toffee tin holding a bundle of letters tied with blue ribbon. The top one begins 'My dearest C.'",
    found: { setFlag: 'letters_found', say: 'You ease out the loose stone. Behind it is a Quality Street tin, and inside, a bundle of letters tied with blue ribbon.' },
    readable: "Letters, dozens, since Easter. 'My dearest C.' ... 'the 8th, Thursday, I'll leave the back door' ... 'all night, and nobody the wiser' ... signed, every time, 'M.' A vicar's secret. Not a murderer's.",
  },
};
