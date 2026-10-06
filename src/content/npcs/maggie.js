// Maggie Pollard, landlady of the Black Lamb (docs/STORY.md §2.3, §6.2). Never moves.

const SHOW_FULL = '"Oh! Right you are, Sergeant." She fishes under the bar. "His key - room three, top of the stairs. Went out at eight and never touched his tea. And you\'ll want these, wandering about in the dark - they were for the jukebox." She slides a brass key and a packet of Ever Readys across the bar.';
const SHOW_KEY = '"Oh! Right you are, Sergeant. His key - room three, top of the stairs." She slides a brass key across the bar.';

const BATTERIES = [
  { if: 'got_batteries', say: '"You\'ve had the last ones I had, love."' },
  { setFlag: 'got_batteries', give: 'batteries', sfx: 'pickup', say: '"Batteries? There\'s a packet behind the bar for the jukebox. Here - it\'s not like anyone dances." She hands you four Ever Readys.' },
];

const SILAS = { setFlag: 'heard_of_silas', say: '"Silas Thorne? Lock-keeper, down the canal past the bridge. Daft as a brush and twice as old. Mind, he sees things - says a man walks the towpath of a Thursday, counting. He\'ll talk for a drop of whisky, that one, and not before."' };

export const maggie = {
  name: 'Maggie', names: ['maggie', 'landlady', 'pollard', 'mrs pollard', 'woman', 'margaret'], proper: true,
  location: 'black_lamb',
  here: 'Maggie is behind the bar, polishing a glass that is already clean.',
  desc: 'Fifty, sharp-eyed, hair set on Saturday and defended since. Cardigan, pearls, a tea towel over one shoulder. She watches you the way she watches the till.',
  talk: [
    { if: '!maggie_saw_card', say: '"Now then. You\'ll be the one from Manchester, come after Mr Harrow. Got anything to prove it, love?"' },
    '"Still here, love? Ask away."',
  ],
  shows: {
    warrant_card: [
      { if: ['!maggie_saw_card', '!got_batteries'], setFlag: ['maggie_saw_card', 'got_batteries'], give: ['room_key', 'batteries'], sfx: 'pickup', say: SHOW_FULL },
      { if: '!maggie_saw_card', setFlag: 'maggie_saw_card', give: 'room_key', sfx: 'pickup', say: SHOW_KEY },
      '"Yes, love, I\'ve seen it. Very nice photo."',
    ],
    button: '"Off a uniform, that." She looks at it, then away. "Lots of uniforms about."',
    ledger_page: '"I don\'t want to see that." She doesn\'t look.',
    patient_file: 'Her hand goes to her pearls. "Where did you get that? Leave the lad alone. He got better."',
    love_letters: { setFlag: 'alibi_known', note: 'alibi', say: '"Oh." She sits down for the first time all night. "You\'ve been in his crypt. All right. I was with Clement on the eighth. All night. And you can keep that to yourself, Sergeant."' },
    handcuffs: '"Put them away, love. You\'re frightening the regulars."',
  },
  // Money invariant (STORY §13): until Silas has his whisky, pints and the 10p never take
  // the balance below 200p, so the whisky can always be bought.
  sells: {
    whisky: { price: 200, if: 'heard_of_silas', refuse: '"Whisky? You\'re on duty, love. Unless it\'s for somebody who needs loosening up."', text: '"For Silas, is it? He\'ll talk for a drop of this." She wraps a half-bottle of Bell\'s in a Bugle and slides it across. "Two pound." You pay her, and the bottle is yours.' },
    pint: { price: 50, if: { any: [{ moneyGte: 260 }, 'silas_told'] }, refuse: '"Not with what\'s left in your wallet, love. Keep summat back."', text: 'She pulls you a pint of mild. "Fifty pence. On the house would be bribery."' },
  },
  topics: {
    t_light: BATTERIES,
    torch: BATTERIES,
    harrow: [
      { if: '!maggie_saw_card', say: '"Mr Harrow? And who\'s asking, love?"' },
      '"Went out at eight, said he\'d be back for his tea. Asked me all sorts last night - the mill, the old families. Asked about Arthur, an\' all, which I didn\'t care for."',
    ],
    silas: SILAS,
    t_counting: SILAS,
    t_keeper: SILAS,
    whisky: [
      { if: 'heard_of_silas', say: '"For Silas? Two pound. Just say so."' },
      '"Whisky? On duty? Get away. Unless it\'s for somebody."',
    ],
    t_drink: '"Pint of mild? Fifty pence."',
    t_change: [
      { if: 'phoned', say: '"You\'ve had your call, love."' },
      { if: [{ at: ['coin', null] }, { moneyGte: 210 }], money: -10, give: 'coin', say: '"For the phone? Here." She rings up NO SALE and hands you a ten pence piece. "I\'ll take it off your slate."' },
      { if: { at: ['coin', null] }, say: '"Not with what\'s left in your wallet, love."' },
      { if: { carried: 'coin' }, say: '"You\'ve got a 10p, love. I saw it."' },
      '"Try down the back of the station bench. Half Blackmere\'s change is down there."',
    ],
    pike: '"Arthur? Salt of the earth. Counts his change twice, mind - always has. He was away a few years as a lad. Poorly. We don\'t talk about it." She polishes the glass harder.',
    t_asylum: '"Ashcombe? Up past the stone. Closed now, thank God. Some of the town\'s own went up there. Some came back." She looks at the door.',
    t_fire: '"Fourteen girls. Every family in Blackmere lost someone, or knew someone who did. That\'s the trouble with this town, love. It doesn\'t forget anything."',
    t_mary: '"Mary Pike? Before my time, love. There\'s always been Pikes in Blackmere."',
    t_murders: '"Edna, Walter, Dennis, Ivy. I served every one of them in here. Nobody goes out on a Thursday now."',
    t_tally: '"The Tallyman? Kids\' story. Debt-collector at the mill, locked the girls in for what they owed. Mothers use him to get kiddies to bed." She doesn\'t smile.',
    t_mill: '"Coming down next month. About time. Nothing good ever came out of that place but wages, and not enough of them."',
    t_counting_room: '"Under the mill, my grandad said - where they made up the wages. Never seen it. Never wanted to."',
    ashdown: 'A little colour in her cheeks. "The vicar is a good man. Whatever folk say."',
    t_alibi: [
      { if: 'alibi_known', say: '"I\'ve told you. I was with Clement. Leave it there."' },
      '"Where was I? Here, love. Where I always am."',
    ],
    t_ghost: '"Silas\'ll tell you all about her. I won\'t."',
    t_self: '"Me? Twenty years behind this bar. Widowed in \'81. Don\'t you start."',
    t_crypt: '"Ask the vicar." Too quickly.',
    // TT-131: ASK MAGGIE ABOUT ROOMS.
    t_room: [
      { if: 'maggie_saw_card', say: '"Room three, top of the stairs. You\'ve got his key, love."' },
      '"Mr Harrow\'s room? Not to just anybody. Show me something official and we\'ll see."',
    ],
    // TT-131: ASK MAGGIE ABOUT MARGARET / HERSELF / MAGGIE. The letters are signed "M.".
    maggie: [
      { if: 'letters_found', say: 'She stops polishing. "Margaret\'s my Sunday name, love. Nobody calls me it." A beat. "Nearly nobody."' },
      '"Me? Twenty years behind this bar. Widowed in \'81. Don\'t you start."',
    ],
  },
  default: '"Can\'t help you there, love."',
  refuse: '"That\'s kind, love, but no."',
  before: {
    attack: '"Try that again and you\'re barred, Sergeant." The regulars look up for the first time.',
  },
};
