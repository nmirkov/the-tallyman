// TT-131 — parser and content gaps from the blind playtest (docs/playtest/tester-{A,B}-log.md,
// docs/PLAYTEST-REPORT.md). Every test replays the testers' own commands.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import content from '../../src/content/index.js';
import { newGame, texts, setup } from '../fixtures/harness.js';

const STORY = readFileSync(new URL('../../docs/STORY.md', import.meta.url), 'utf8');
const WALKTHROUGH = STORY.split('Plain list for `tests/walkthrough/` (91 lines):\n```\n')[1].split('```')[0].trim().split('\n');
const BOILER_ROUTE = ['e', 's', 'u', 's', 's', 's', 's', 's', 'e', 'd', 'w', 'n', 'd', 'oil hatch', 'open hatch', 'd'];

const snap = (g) => g.snapshot();
const say = (g, line) => texts(g.input(line)).join('\n');

/** A fresh game moved to `room` with a lit torch and the listed items carried. */
function at(room, carry = [], mutate = () => {}) {
  const g = newGame(content);
  g.start();
  setup(g, (s) => {
    s.roomId = room;
    if (!s.visited.includes(room)) s.visited.push(room);
    s.items.torch.loc = 'player';
    s.items.torch.lit = true;
    s.flags.torch_loaded = true;
    s.items.batteries.loc = null;
    for (const id of carry) s.items[id].loc = 'player';
    mutate(s);
  });
  return g;
}
function played(lines) {
  const g = newGame(content);
  g.start();
  for (const line of lines) g.input(line);
  return g;
}

describe('1. a person beats things named after them (engine resolve.js)', () => {
  test('tester A: ASK HARROW ABOUT PIKE through the door, carrying Harrow\'s key, map and notes', () => {
    const g = at('tunnel', ['room_key', 'case_map', 'harrows_notes', 'handcuffs']);
    assert.equal(say(g, 'ask harrow about pike'), "Harrow isn't here.");
    assert.equal(snap(g).ctx.pending, null, 'no "Which do you mean" question');
    assert.match(say(g, 'x harrow key'), /^A brass Yale/);
  });

  test('tester A: ACCUSE PIKE in the records office with his file in hand', () => {
    const g = at('records_office', ['patient_file']);
    assert.equal(say(g, 'accuse pike'), "Accuse who? They're not here.");
    assert.equal(say(g, 'x pike'), "Pike isn't here.");
    assert.equal(snap(g).turn, 0, 'both free');
  });

  test('with Harrow present, ASK / SHOW / GIVE bind to him, not his things', () => {
    const g = played(WALKTHROUGH.slice(0, 89));
    say(g, 'arrest pike');
    assert.equal(say(g, 'ask harrow about cuffs'), '"Then use them!"');
    assert.doesNotMatch(say(g, 'show map to harrow'), /Which do you mean/);
  });

  test('tester A: X TUNIC at the desk is Pike\'s tunic, not the button in your pocket', () => {
    const g = at('police_house', ['button'], (s) => { s.items.button.hidden = false; s.evidence.push('ev_button'); });
    assert.match(say(g, 'examine tunic'), /^Pike's tunic, buttoned to the throat - all but the second button down/);
  });
});

describe('2. Church Lane: IN / ENTER COTTAGE', () => {
  test('tester A and B: IN and ENTER COTTAGE say the cottage is boarded; IN is no longer listed', () => {
    const g = at('church_lane');
    assert.match(say(g, 'look'), /Exits: north, southwest\./);
    for (const line of ['in', 'enter cottage', 'go in', 'enter']) {
      assert.match(say(g, line), /^Edna Ashworth's cottage is boarded up tight/, line);
      assert.equal(snap(g).roomId, 'church_lane', line);
    }
    assert.match(say(g, 'enter church'), /^St Jude's\n/);
    say(g, 'out');
    assert.match(say(g, 'go to church'), /^St Jude's\n/);
  });
});

describe('3. OIL CABINET with the oil can', () => {
  test('tester A: says why oil won\'t do and what will', () => {
    const g = at('records_office', ['oil_can']);
    assert.match(say(g, 'oil cabinet'), /It isn't a stiff hinge.*That wants levering, not oiling\./);
    assert.match(say(g, 'oil cabinet with oil can'), /wants levering/);
    const h = at('records_office');
    assert.equal(say(h, 'oil cabinet'), "Oil wouldn't shift that much rust anyway. It wants levering open.");
  });
});

describe('4. words the game didn\'t know', () => {
  test('tester B: SAY FIVE / SHOUT / CALL OUT; Pike, Harrow, Maggie and Silas answer', () => {
    const g = at('market_square');
    assert.equal(say(g, 'say five'), "You say it out loud. The rain goes on as if you hadn't.");
    assert.equal(say(g, 'shout hello'), "You say it out loud. The rain goes on as if you hadn't.");
    assert.equal(say(g, 'call out'), "You say it out loud. The rain goes on as if you hadn't.");
    assert.match(say(at('police_house'), 'say hello'), /^"Sorry, Sergeant\?" Pike looks up/);
    const t = at('tunnel');
    assert.match(say(t, 'shout harrow'), /^Harrow stops praying\./);
    assert.equal(snap(t).flags.heard_harrow, true);
    assert.match(say(at('black_lamb'), 'say hello'), /"Speak up, love,"/);
    assert.match(say(at('lock_cottage'), 'say hello'), /^"Eh\?" Silas cups a hand/);
    const c = played(WALKTHROUGH.slice(0, 89));
    assert.match(say(c, 'say five'), /^Pike tilts his head.*\n.*cuff/);
  });

  test('tester B: BREATHE; tester A/B: DRIVE, GLOVEBOX, BOOT, TRUNK in Harrow\'s car', () => {
    assert.equal(say(at('market_square'), 'breathe'), 'In for four, out for four. You catch yourself counting, and stop.');
    const g = at('harrows_car');
    assert.match(say(g, 'drive'), /front wheels are in the ditch/);
    assert.match(say(g, 'examine glovebox'), /^Road atlas, a de-icer/);
    assert.match(say(g, 'x glove box'), /^Road atlas/);
    assert.match(say(g, 'open glovebox'), /^You go through the glovebox/);
    assert.match(say(g, 'open boot'), /^You lean over the back seat and look into the boot/);
    assert.match(say(g, 'open trunk'), /look into the boot/);
    const m = at('moor_road');
    assert.match(say(m, 'open boot'), /^You lift the boot lid/);
    assert.match(say(m, 'drive car'), /^Not with its front wheels in the ditch/);
  });

  test('tester A: EXAMINE TOWPATH on the towpath; GO / ENTER TOWPATH from the rooms next to it', () => {
    const g = at('towpath');
    assert.match(say(g, 'examine towpath'), /^Cinders and puddles/);
    assert.match(say(g, 'enter towpath'), /^You're standing on it\./);
    for (const room of ['canal_bridge', 'lock', 'mill_gates']) {
      for (const line of ['go towpath', 'enter towpath', 'walk to the towpath']) {
        const h = at(room);
        say(h, line);
        assert.equal(snap(h).roomId, 'towpath', `${room}: ${line}`);
      }
    }
    const lock = at('lock');
    say(lock, 'enter cottage');
    assert.equal(snap(lock).roomId, 'lock_cottage');
    assert.match(say(at('lock'), 'enter'), /If it is the cottage you want, it is NORTH/, 'bare ENTER is still the lock hazard');
  });

  test('tester A: BUY WHISKY FOR SILAS before asking about him', () => {
    const g = at('black_lamb', [], (s) => { s.flags.maggie_saw_card = true; });
    const t = say(g, 'buy whisky for silas');
    assert.match(t, /^"For Silas, is it\?.*"Two pound\." You pay her, and the bottle is yours\.$/);
    assert.equal(snap(g).items.whisky.loc, 'player');
    assert.equal(snap(g).money, 300);
    const h = at('black_lamb');
    assert.match(say(h, 'buy whisky for maggie'), /You're on duty, love/);
  });

  test('tester B: X alone, X ALL; tester B: OPEN WALLET', () => {
    const g = at('market_square');
    assert.equal(say(g, 'x'), 'What do you want to examine?');
    assert.equal(say(g, 'x all'), 'One thing at a time, Sergeant.');
    assert.match(say(g, 'open wallet'), /^You thumb it open\. £5\.00, a photo/);
    assert.equal(snap(g).turn, 1, 'only OPEN WALLET costs a turn');
  });
});

describe('5. topics: the testers\' own words', () => {
  test('tester B: ASK SILAS ABOUT TALLYMAN; tester A: THURSDAY, SHED; also KILLER, MURDERS, MILL', () => {
    const g = at('lock_cottage', [], (s) => { s.flags.silas_told = true; });
    const counting = /^"Thursdays\. Big man in a cape/;
    assert.match(say(g, 'ask silas about tallyman'), counting);
    assert.match(say(g, 'ask silas about the killer'), counting);
    assert.match(say(g, 'ask silas about thursday'), counting);
    assert.match(say(g, 'ask silas about shed'), /^"Shed's open - take what you need\./);
    assert.match(say(g, 'ask silas about the murders'), /^"Four Thursdays, four of the old names\./);
    assert.match(say(g, 'ask silas about the mill'), /^"Ashworth's\. Gates are chained, but chains cut\./);
    assert.match(say(g, 'ask silas about the tunnel'), /^"Asylum morgue to the mill/);
    assert.match(say(g, 'ask silas about pike'), /They were all counters, the Pikes/);
    assert.match(say(g, 'ask silas about harrow'), /^"Your mate\?/);
  });

  test('tester A: Silas says the whole "Dry throat" speech once, then the short of it', () => {
    const g = at('lock_cottage');
    assert.match(say(g, 'ask silas about thursday'), /^"Dry throat, Sergeant\./);
    for (const line of ['ask silas about shed', 'ask silas about tallyman', 'talk to silas']) {
      const t = say(g, line);
      assert.doesNotMatch(t, /Dry throat/, line);
      assert.match(t, /"Dry," says Silas/, line);
    }
  });

  test('"last thursday" is still an alibi question', () => {
    const g = at('black_lamb');
    assert.equal(say(g, 'ask maggie about last thursday'), '"Where was I? Here, love. Where I always am."');
  });

  test('tester A: ASK MAGGIE ABOUT MARGARET; ASK MAGGIE ABOUT ROOMS', () => {
    const g = at('black_lamb');
    assert.match(say(g, 'ask maggie about margaret'), /^"Me\? Twenty years behind this bar\./);
    assert.match(say(g, 'ask maggie about rooms'), /Show me something official/);
    const h = at('black_lamb', [], (s) => { s.flags.letters_found = true; s.flags.maggie_saw_card = true; });
    assert.match(say(h, 'ask maggie about margaret'), /"Margaret's my Sunday name, love\./);
    assert.match(say(h, 'ask maggie about rooms'), /^"Room three, top of the stairs\./);
  });
});

describe('6. READ = what EXAMINE says, for every readable piece of scenery', () => {
  test('tester A: READ NOTICE at the Mill Gates shows the demolition order', () => {
    const g = at('mill_gates');
    assert.equal(say(g, 'read notice'), say(g, 'examine notice'));
    assert.match(say(g, 'read notice'), /DEMOLITION ORDER/);
  });

  test('every room scenery entry reads as it examines; readable items are unchanged', () => {
    for (const [room, def] of Object.entries(content.rooms)) {
      for (const sc of def.scenery ?? []) {
        if (typeof sc.desc !== 'string') continue;
        // The first of its names that EXAMINE binds to this entry (a carried "card" outranks scenery, M4b).
        const name = sc.names.find((n) => say(at(room), `examine ${n}`) === sc.desc);
        assert.ok(name, `${room}: ${sc.names[0]} is examinable`);
        assert.equal(say(at(room), `read ${name}`), sc.desc, `${room}: read ${name}`);
      }
    }
    const g = at('harrows_room', ['case_map']);
    assert.match(say(g, 'read map'), /Ordnance Survey|mill/i);
    assert.equal(say(at('market_square', ['torch']), 'read torch'), "There's nothing written on the torch.");
  });
});

describe('7. LISTEN where the prose has a sound', () => {
  test('tester A: LISTEN in the tunnel hears the praying (and Harrow)', () => {
    assert.match(say(at('tunnel'), 'listen'), /^Behind the iron door, very faint, a man is praying\. You know the voice: Frank Harrow\. You could KNOCK\./);
    assert.match(say(at('tunnel', [], (s) => { s.turn = 200; }), 'listen'), /slower now, losing his place/);
  });

  test('the other rooms whose prose makes a sound', () => {
    const expect = {
      platform: /gas lamp hissing/, lock: /roaring through the paddles/, police_house: /tap tap tap tap/,
      harrows_car: /^The radio, hissing\./, ward: /^Drip\. Drip\./, counting_house: /./,
    };
    for (const [room, re] of Object.entries(expect)) {
      const t = say(at(room), 'listen');
      assert.match(t, re, room);
      assert.notEqual(t, 'You hear nothing unusual.', room);
    }
  });
});

describe('8. the torch flicker', () => {
  test('tester A: at most three times between 23:00 and midnight, and the third pays it off', () => {
    const g = played(WALKTHROUGH.slice(0, 88)); // the tunnel, torch on
    const all = [];
    while (snap(g).turn < 299 && !snap(g).ended) all.push(...texts(g.input('wait')));
    const flickers = all.filter((t) => /torch|beam/i.test(t) && /flicker|browns out|beam jumps/.test(t));
    assert.equal(flickers.length, 3, flickers.join('\n'));
    assert.match(flickers[2], /It is your hand\./);
  });
});

describe('9. SEARCH / SEARCH ROOM finds what is hidden in the room', () => {
  test('bench coin, candle button, dustbin Bugle, crypt letters - by SEARCH ROOM as well as SEARCH <thing>', () => {
    assert.match(say(at('waiting_room'), 'search room'), /10p coin/);
    assert.match(say(at('number_13'), 'search room'), /a button/);
    assert.match(say(at('back_alley'), 'search room'), /this week's Bugle/);
    assert.match(say(at('crypt'), 'search room'), /bundle of letters/);
  });
});

describe('other refusals from the logs', () => {
  test('tester A: TAKE FLOWERS; OPEN COAL-HOLE LID; OPEN CUPBOARD', () => {
    assert.equal(say(at('towpath'), 'take flowers'), 'You leave it where it is.');
    assert.match(say(at('back_alley'), 'open coal-hole lid'), /rusted into its ring/);
    assert.match(say(at('vestry'), 'open cupboard'), /NOT TO BE TOUCHED - C\.A\./);
  });

  test('tester A: up from the tunnel into the morgue, the way back DOWN is found and listed', () => {
    const g = played([...WALKTHROUGH.slice(0, 83), ...BOILER_ROUTE]);
    assert.equal(snap(g).roomId, 'tunnel');
    assert.equal(snap(g).flags.morgue_hatch_found, undefined);
    assert.match(say(g, 's'), /You come up the rungs through a square hatch in the floor\./);
    assert.equal(snap(g).flags.morgue_hatch_found, true);
    assert.match(say(g, 'look'), /Exits: up, down\./);
    assert.match(say(g, 'd'), /^Tunnel\n.*Iron rungs climb south to the morgue/);
  });
});
