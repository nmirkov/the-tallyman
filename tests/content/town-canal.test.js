// TT-016 — the real content, Town + Canal zones (docs/STORY.md §4.1, §4.2, §5–§7, §12).
// Asserts actions, topics, flags, notes, evidence, score awards and room text. Behaviour
// owned by the daemons (beats, schedules, nerve / panic: steps D2–D6) is deliberately not
// asserted here, so these tests hold whatever the per-turn pipeline adds around them.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import content, { ITEM_ORDER } from '../../src/content/index.js';
import { FLAGS } from '../../src/content/registries.js';
import { lintContent, formatFinding } from '../../tools/lint-content.js';
import { hasGlyph } from '../../src/ui/font8x8.js';
import { VERBS } from '../../src/engine/vocab.js';
import { newGame, texts, setup } from '../fixtures/harness.js';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const STORY = readFileSync(new URL('../../docs/STORY.md', import.meta.url), 'utf8');

const game = () => newGame(content);
const snap = (g) => g.snapshot();
const say = (g, line) => texts(g.input(line)).join('\n');
/** Puts the player in `roomId` (and applies `extra` to the save state) via SAVE / LOAD. */
const at = (g, roomId, extra = () => {}) => setup(g, (s) => {
  s.roomId = roomId;
  if (!s.visited.includes(roomId)) s.visited.push(roomId);
  extra(s);
});
const carry = (...ids) => (s) => {
  for (const id of ids) {
    s.items[id].loc = 'player';
    if (s.items[id].hidden === true) s.items[id].hidden = false;
  }
};
const carried = (g, id) => snap(g).items[id].loc === 'player';
const flag = (g, name) => snap(g).flags[name] === true;

/* ------------------------------------------------------------------------ *
 *  Bundle, lint, play                                                       *
 * ------------------------------------------------------------------------ */

describe('bundle', () => {
  const lint = (opts = {}) => lintContent(content, { hasGlyph, verbWords: VERBS.flatMap((v) => v.words), ...opts });
  const show = (r) => [...r.errors.map((f) => formatFinding('error', f)), ...r.warnings.map((f) => formatFinding('warning', f))].join('\n');

  test('lint (incremental) has 0 errors', () => {
    const r = lint();
    assert.deepEqual(r.errors, [], show(r));
  });

  test('lint --strict fails only on missing pictures (none with --allow-missing-art)', () => {
    const rules = new Set(lint({ strict: true }).errors.map((f) => f.rule));
    for (const rule of rules) assert.ok(['L12'].includes(rule), `unexpected strict error ${rule}`);
    const r = lint({ strict: true, allowMissingArt: true });
    assert.deepEqual(r.errors, [], show(r));
  });

  test('Town has 18 rooms, Canal 5; STORY\'s 42 rooms in all, no stubs', () => {
    const byZone = (z) => Object.values(content.rooms).filter((r) => r.zone === z).length;
    assert.equal(byZone('town'), 18);
    assert.equal(byZone('canal'), 5);
    assert.equal(Object.keys(content.rooms).length, 42);
    assert.equal(content.stubs, undefined);
  });

  test('items follow STORY §5.1 order; NPCs are proper and in STORY §6 order', () => {
    const ids = Object.keys(content.items);
    assert.deepEqual(ids, ITEM_ORDER.filter((id) => ids.includes(id)));
    assert.deepEqual(Object.keys(content.npcs), ['maggie', 'pike', 'ashdown', 'silas', 'harrow']);
    for (const npc of Object.values(content.npcs)) assert.equal(npc.proper, true, npc.name);
  });

  test('registries: four evidence ids, exactly the four A3.2 vars, 13 awards summing to 100', () => {
    assert.deepEqual(Object.keys(content.evidence), ['ev_ledger', 'ev_register', 'ev_button', 'ev_file']);
    assert.deepEqual(Object.keys(content.vars), ['pikeState', 'pikeArrivalTurn', 'attack', 'harrowFreed']);
    const awards = Object.values(content.scoring.awards);
    assert.equal(awards.length, 13);
    assert.equal(awards.reduce((n, a) => n + a.points, 0), 100);
    assert.equal(FLAGS.length, 30); // TT-105: + torch_off_warned, pike_fled; TT-130: + harrow_shouted; TT-131: + silas_dry
  });

  test('every prose string is verbatim from STORY.md', () => {
    // STORY quotes game text raw in tables and as JS literals in code blocks.
    const story = STORY.replace(/\\'/g, '\'').replace(/\\"/g, '"').replace(/\\n\\n/g, '\n\n');
    const strings = [];
    const walk = (v, p) => {
      if (typeof v === 'string') strings.push([v, p]);
      else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}[${i}]`));
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (k !== 'art' && k !== 'patterns') walk(x, `${p}.${k}`);
    };
    walk(content, 'content');
    // Prose = anything with a space and 12+ characters (names, ids and keywords are shorter).
    const prose = strings.filter(([s]) => s.length >= 12 && s.includes(' '));
    const missing = [];
    for (const [s, p] of prose) for (const para of s.split('\n\n')) if (!story.includes(para)) missing.push(`${p}: ${para.slice(0, 80)}`);
    assert.deepEqual(missing, []);
  });

  test('npm run play starts the real game on the platform', () => {
    const r = spawnSync(process.execPath, ['tools/play.js', '--script', '/dev/null'], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Thursday 15 November 1984\. 21:30\./);
    assert.match(r.stdout, /\nPlatform\nA deserted platform under a dripping canopy\./);
    assert.doesNotMatch(r.stderr, /mini-world/);
  });
});

/* ------------------------------------------------------------------------ *
 *  Start                                                                    *
 * ------------------------------------------------------------------------ */

test('start: intro (STORY §1.6), then the platform; 500p, nerve 10, turn 0', () => {
  const g = game();
  const ev = g.start();
  const t = texts(ev);
  assert.ok(t[0].startsWith('Thursday 15 November 1984. 21:30.\n\nThe last train pulls out of Blackmere'));
  assert.ok(t[0].endsWith('You have until midnight.\n\n(Type HELP for instructions.)'));
  assert.ok(ev.some((e) => e.type === 'room' && e.id === 'platform'));
  assert.ok(t.includes('Platform'));
  assert.ok(t.includes('Exits: north, west.'));
  const s = snap(g);
  assert.equal(s.money, 500);
  assert.equal(s.nerve, 10);
  assert.equal(s.turn, 0);
  assert.deepEqual(s.vars, { pikeState: 'desk', pikeArrivalTurn: null, attack: 0, harrowFreed: false });
});

/* ------------------------------------------------------------------------ *
 *  STORY §12.1 commands 1–50 (Town + Canal), row by row                      *
 * ------------------------------------------------------------------------ */

describe('STORY §12.1 walkthrough, commands 1-50', () => {
  const g = game();
  g.start();
  /** [command, room after, score after, extra check] — command k ends on turn k. */
  const ROWS = [
    ['w', 'waiting_room', 0],
    ['search bench', 'waiting_room', 0, (s, t) => { assert.equal(s.items.coin.hidden, false); assert.match(t, /Wedged between the slats of the bench is a 10p coin\./); }],
    ['take torch and coin', 'waiting_room', 0, (s) => { assert.equal(s.items.torch.loc, 'player'); assert.equal(s.items.coin.loc, 'player'); }],
    ['e', 'platform', 0],
    ['n', 'station_road', 0],
    ['n', 'market_square', 0],
    ['in', 'phone_box', 0],
    ['call hq', 'phone_box', 5, (s, t, ev) => {
      assert.equal(s.flags.phoned, true);
      assert.equal(s.items.coin.loc, null);
      assert.ok(s.notes.includes('hq_call'));
      assert.ok(s.awarded.includes('phone_call'));
      assert.ok(ev.some((e) => e.type === 'sfx' && e.id === 'phone'));
      assert.match(t, /Manchester CID, night desk/);
    }],
    ['out', 'market_square', 5],
    ['w', 'black_lamb', 5, (s, t) => assert.match(t, /Maggie is behind the bar, polishing a glass that is already clean\./)],
    ['show card to maggie', 'black_lamb', 5, (s, t) => {
      assert.equal(s.items.room_key.loc, 'player');
      assert.equal(s.items.batteries.loc, 'player');
      assert.equal(s.flags.maggie_saw_card, true);
      assert.equal(s.flags.got_batteries, true);
      assert.match(t, /She slides a brass key and a packet of Ever Readys across the bar\./);
    }],
    ['put batteries in torch', 'black_lamb', 5, (s) => { assert.equal(s.flags.torch_loaded, true); assert.equal(s.items.batteries.loc, null); }],
    ['turn on torch', 'black_lamb', 10, (s) => { assert.equal(s.items.torch.lit, true); assert.ok(s.awarded.includes('torch_lit')); }],
    ['ask maggie about silas', 'black_lamb', 10, (s, t) => { assert.equal(s.flags.heard_of_silas, true); assert.match(t, /^"Silas Thorne\? Lock-keeper/); }],
    ['buy whisky', 'black_lamb', 10, (s, t) => { assert.equal(s.items.whisky.loc, 'player'); assert.equal(s.money, 300); assert.match(t, /"Two pound\."/); }],
    ['u', 'harrows_room', 15, (s, t) => { assert.equal(s.flags.entered_harrows_room, true); assert.match(t, /You let yourself in with Maggie's key\./); }],
    ['open suitcase', 'harrows_room', 15, (s) => assert.equal(s.items.suitcase.open, true)],
    ['read map', 'harrows_room', 15, (s) => assert.ok(s.notes.includes('case_map'))],
    ['read notes', 'harrows_room', 15, (s) => assert.ok(s.notes.includes('harrow_list'))],
    ['d', 'black_lamb', 15],
    ['e', 'market_square', 15],
    ['e', 'police_house', 15, (s, t) => { assert.equal(s.npcs.pike.loc, 'police_house'); assert.match(t, /Tap tap tap tap\. Pause\./); }],
    ['read book', 'police_house', 15, (s, t) => { assert.ok(s.notes.includes('pike_patrol')); assert.match(t, /"Just my rounds, Sergeant," says Pike/); }],
    ['w', 'market_square', 15],
    ['n', 'high_street', 15],
    ['w', 'chapel_street', 15],
    ['in', 'number_13', 15],
    ['search', 'number_13', 15, (s, t) => { assert.equal(s.items.button.hidden, false); assert.match(t, /something silver: a button\./); }],
    ['take button', 'number_13', 25, (s) => { assert.ok(s.evidence.includes('ev_button')); assert.ok(s.awarded.includes('button')); }],
    ['out', 'chapel_street', 25],
    ['e', 'high_street', 25],
    ['ne', 'church_lane', 25],
    ['n', 'st_judes', 25, (s, t) => assert.match(t, /The Reverend Ashdown hovers by the candles/)],
    ['e', 'vestry', 25],
    ['read register', 'vestry', 35, (s, t) => {
      assert.deepEqual(s.evidence, ['ev_button', 'ev_register']);
      assert.ok(s.notes.includes('mary_pike'));
      assert.match(t, /Mary Pike, 14, half-timer, d\. 15 Nov 1912\./);
    }],
    ['w', 'st_judes', 35],
    ['s', 'church_lane', 35],
    ['sw', 'high_street', 35],
    ['s', 'market_square', 35],
    ['s', 'station_road', 35],
    ['e', 'canal_bridge', 35],
    ['d', 'towpath', 35],
    ['e', 'lock', 35],
    ['n', 'lock_cottage', 35, (s, t) => { assert.equal(s.flags.heard_of_silas, true); assert.match(t, /Silas Thorne rocks in his chair by the heater/); }],
    ['give whisky to silas', 'lock_cottage', 40, (s, t) => {
      assert.equal(s.flags.silas_told, true);
      assert.equal(s.flags.shed_open, true);
      assert.equal(s.items.whisky.loc, 'silas');
      assert.ok(s.notes.includes('silas_story'));
      assert.match(t, /"Bolt cutters, oil can\. Take 'em\. The mill gates are chained\."/);
    }],
    ['s', 'lock', 40],
    ['e', 'shed', 40, (s, t) => assert.match(t, /A pair of long-handled bolt cutters hangs inside its painted outline\./)],
    ['take cutters and oil can', 'shed', 40, (s) => { assert.equal(s.items.bolt_cutters.loc, 'player'); assert.equal(s.items.oil_can.loc, 'player'); }],
    ['w', 'lock', 40],
    ['w', 'towpath', 40],
  ];
  ROWS.forEach(([line, room, score, check], i) => {
    test(`${i + 1}. ${line}`, () => {
      const ev = g.input(line);
      const s = snap(g);
      const t = texts(ev).join('\n');
      assert.equal(s.ended, null);
      assert.equal(s.turn, i + 1, 'each command costs exactly one turn');
      assert.equal(s.roomId, room);
      assert.equal(s.score, score);
      if (check) check(s, t, ev);
    });
  });
  test('after 50: notes in order, evidence count 2, money 300', () => {
    const s = snap(g);
    assert.deepEqual(s.notes, ['hq_call', 'case_map', 'harrow_list', 'pike_patrol', 'mary_pike', 'silas_story']);
    assert.equal(s.money, 300);
    assert.match(say(g, 'notes'), /Evidence \(2\)/);
  });
});

/* ------------------------------------------------------------------------ *
 *  STORY §7.2 accepted phrasings (Town + Canal steps)                        *
 * ------------------------------------------------------------------------ */

/** Each phrasing in a fresh game prepared by `prep`; `check(g, text)` must hold. */
function phrasings(name, lines, prep, check) {
  describe(name, () => {
    for (const line of lines) {
      test(line, () => {
        const g = game();
        g.start();
        prep(g);
        const t = say(g, line);
        check(g, t, line);
      });
    }
  });
}

phrasings('step 1: the 10p on the bench',
  ['search', 'search bench', 'search seat', 'look under bench', 'look in bench', 'look behind bench'],
  (g) => at(g, 'waiting_room'),
  (g, t) => { assert.equal(snap(g).items.coin.hidden, false); assert.match(t, /10p coin/); });

phrasings('step 2: CALL HQ from the phone box',
  ['call hq', 'call', 'phone hq', 'dial hq', 'ring hq', 'call manchester', 'use phone', 'use coin', 'put coin in phone'],
  (g) => at(g, 'phone_box', (s) => { s.items.coin.loc = 'player'; s.items.coin.hidden = false; }),
  (g, t) => {
    const s = snap(g);
    assert.equal(s.flags.phoned, true);
    assert.equal(s.score, 5);
    assert.equal(s.items.coin.loc, null);
    assert.deepEqual(s.notes, ['hq_call']);
    assert.match(t, /Sarge\? Thank God\./);
  });

phrasings('step 3: SHOW CARD TO MAGGIE',
  ['show card to maggie', 'show maggie card', 'show warrant card to landlady', 'show warrant to landlady', 'show id to maggie'],
  (g) => at(g, 'black_lamb'),
  (g) => { assert.ok(carried(g, 'room_key')); assert.ok(carried(g, 'batteries')); assert.ok(flag(g, 'maggie_saw_card')); });

phrasings('step 3b: ASK MAGGIE ABOUT BATTERIES',
  ['ask maggie about batteries', 'ask maggie about torch', 'ask maggie about light', 'ask maggie about the dark'],
  (g) => at(g, 'black_lamb'),
  (g, t) => { assert.ok(carried(g, 'batteries')); assert.ok(flag(g, 'got_batteries')); assert.match(t, /She hands you four Ever Readys\./); });

phrasings('step 4: load the torch',
  ['put batteries in torch', 'insert batteries into torch', 'use batteries', 'use batteries on torch', 'replace batteries', 'change batteries', 'fit batteries'],
  (g) => at(g, 'black_lamb', carry('torch', 'batteries')),
  (g, t) => { assert.ok(flag(g, 'torch_loaded')); assert.equal(snap(g).items.batteries.loc, null); assert.match(t, /The spring bites\. Ready\./); });

phrasings('step 5: switch the loaded torch on',
  ['turn on torch', 'turn torch on', 'switch on torch', 'light torch'],
  (g) => at(g, 'black_lamb', (s) => { carry('torch')(s); s.flags.torch_loaded = true; }),
  (g) => { assert.equal(snap(g).items.torch.lit, true); assert.deepEqual(snap(g).awarded, ['torch_lit']); });

phrasings('step 6: up to Harrow\'s room with the key',
  ['u', 'go up', 'up', 'climb up', 'climb stairs'],
  (g) => at(g, 'black_lamb', carry('room_key')),
  (g, t) => { assert.equal(snap(g).roomId, 'harrows_room'); assert.equal(snap(g).score, 5); assert.match(t, /Maggie's key/); });

phrasings('step 8: hearing of Silas',
  ['ask maggie about silas', 'ask maggie about the lock keeper', 'ask maggie about the lock-keeper', 'ask maggie about the counting man'],
  (g) => at(g, 'black_lamb'),
  (g, t) => { assert.ok(flag(g, 'heard_of_silas')); assert.match(t, /He'll talk for a drop of whisky/); });

phrasings('step 9: buying the whisky',
  ['buy whisky', 'buy whisky from maggie', 'order whisky', 'purchase bottle'],
  (g) => at(g, 'black_lamb', (s) => { s.flags.heard_of_silas = true; }),
  (g) => { assert.ok(carried(g, 'whisky')); assert.equal(snap(g).money, 300); });

phrasings('step 10: whisky for Silas',
  ['give whisky to silas', 'give silas whisky', 'offer whisky to silas', 'hand bottle to old man'],
  (g) => at(g, 'lock_cottage', carry('whisky')),
  (g) => {
    const s = snap(g);
    assert.ok(s.flags.silas_told && s.flags.shed_open);
    assert.equal(s.score, 5);
    assert.ok(s.notes.includes('silas_story'));
  });

phrasings('step 11: the shed',
  ['take cutters', 'take bolt cutters', 'take croppers', 'take oil can', 'take all'],
  (g) => at(g, 'shed', (s) => { s.flags.shed_open = true; s.flags.silas_told = true; }),
  (g, t, line) => {
    if (line !== 'take oil can') assert.ok(carried(g, 'bolt_cutters'));
    if (line === 'take oil can' || line === 'take all') assert.ok(carried(g, 'oil_can'));
  });

phrasings('step 16: the burial register',
  ['read register', 'read burial register', 'search register', 'look in register'],
  (g) => at(g, 'vestry'),
  (g, t) => {
    const s = snap(g);
    assert.deepEqual(s.evidence, ['ev_register']);
    assert.deepEqual(s.notes, ['mary_pike']);
    assert.equal(s.score, 10);
    assert.match(t, /You think of the big kind constable and his tea\./);
  });

phrasings('step 17: searching No.13',
  ['search', 'search room', 'search here', 'search candle', 'search stub', 'search wax', 'look in wax'],
  (g) => at(g, 'number_13', carry('room_key')),
  (g, t) => { assert.equal(snap(g).items.button.hidden, false); assert.match(t, /a button\./); });

phrasings('step 18: taking the button',
  ['take button', 'take button from candle', 'take all from stub'],
  (g) => at(g, 'number_13', (s) => { s.items.button.hidden = false; }),
  (g) => { assert.ok(carried(g, 'button')); assert.deepEqual(snap(g).evidence, ['ev_button']); assert.equal(snap(g).score, 10); });

/* ------------------------------------------------------------------------ *
 *  Gates, refusals and fallbacks                                            *
 * ------------------------------------------------------------------------ */

describe('gates and refusals', () => {
  test('the Black Lamb stair is locked without the key (msg A); the door explains', () => {
    const g = game();
    at(g, 'black_lamb');
    assert.equal(say(g, 'u'), "Harrow's door at the top of the stairs is locked. Maggie keeps the keys behind the bar.");
    assert.equal(snap(g).roomId, 'black_lamb');
    assert.equal(say(g, 'open door'), 'Locked. Maggie keeps the keys behind the bar.');
  });

  test('the shed is padlocked until Silas has his whisky (msg B)', () => {
    const g = game();
    at(g, 'lock');
    assert.equal(say(g, 'e'), "The shed is padlocked. Silas's padlock, Silas's shed.");
    assert.equal(say(g, 'open shed'), "It's Silas's padlock on Silas's shed. Ask Silas.");
    assert.equal(snap(g).roomId, 'lock');
  });

  test('whisky is refused until Silas has been heard of; a second SHOW CARD gives nothing more', () => {
    const g = game();
    at(g, 'black_lamb');
    assert.match(say(g, 'buy whisky'), /^"Whisky\? You're on duty, love\./);
    assert.equal(snap(g).money, 500);
    say(g, 'show card to maggie');
    assert.equal(say(g, 'show card to maggie'), '"Yes, love, I\'ve seen it. Very nice photo."');
    assert.equal(say(g, 'ask maggie about batteries'), '"You\'ve had the last ones I had, love."');
  });

  test('batteries first by asking, then SHOW CARD gives only the key (SHOW_KEY)', () => {
    const g = game();
    at(g, 'black_lamb');
    say(g, 'ask maggie about batteries');
    assert.match(say(g, 'show card to maggie'), /She slides a brass key across the bar\.$/);
    assert.ok(carried(g, 'room_key'));
  });

  test('TURN ON TORCH with the batteries in hand loads them first', () => {
    const g = game();
    at(g, 'waiting_room', carry('torch', 'batteries'));
    const t = say(g, 'turn on torch');
    assert.match(t, /^\(First you load the fresh batteries\.\)/);
    assert.equal(snap(g).items.torch.lit, true);
    assert.equal(snap(g).items.batteries.loc, null);
  });

  test('a dead torch will not switch on', () => {
    const g = game();
    at(g, 'waiting_room', carry('torch'));
    assert.equal(say(g, 'turn on torch'), 'Click. Nothing. The batteries in it are as dead as Dickens.');
  });

  test('the phone without a coin; CALL outside the box is a free not-here', () => {
    const g = game();
    at(g, 'phone_box');
    assert.equal(say(g, 'call hq'), 'You pat your pockets. No change. The phone wants 10p.');
    at(g, 'market_square');
    const turn = snap(g).turn;
    assert.equal(say(g, 'call hq'), "You'll need a phone. There's a box in Market Square.");
    assert.equal(snap(g).turn, turn);
  });

  test('Maggie\'s 10p fallback (STORY §13): bench pointer, coin from the till, then "had your call"', () => {
    const g = game();
    at(g, 'black_lamb');
    assert.match(say(g, 'ask maggie about change'), /Try down the back of the station bench/);
    at(g, 'black_lamb', (s) => { s.items.coin.loc = null; });
    assert.match(say(g, 'ask maggie about the phone'), /She rings up NO SALE/);
    assert.ok(carried(g, 'coin'));
    assert.equal(snap(g).money, 490);
    at(g, 'black_lamb', (s) => { s.flags.phoned = true; });
    assert.equal(say(g, 'ask maggie about change'), '"You\'ve had your call, love."');
  });

  test('pints keep 200p back for the whisky until Silas has talked', () => {
    const g = game();
    at(g, 'black_lamb', (s) => { s.money = 250; });
    assert.match(say(g, 'buy pint'), /Keep summat back/);
    at(g, 'black_lamb', (s) => { s.money = 300; });
    assert.match(say(g, 'buy pint'), /^She pulls you a pint of mild\./);
    assert.equal(snap(g).money, 250);
    assert.equal(say(g, 'drink pint'), 'Flat, brown and wonderful. Your hands steady a little.');
    assert.equal(snap(g).items.pint.loc, null);
  });

  test('critical items are protected: whisky cannot be drunk or given to Maggie', () => {
    const g = game();
    at(g, 'black_lamb', carry('whisky'));
    assert.equal(say(g, 'drink whisky'), "That's for Silas. Hang on to it.");
    assert.equal(say(g, 'give whisky to maggie'), "That's for Silas. Hang on to it.");
    assert.ok(carried(g, 'whisky'));
  });

  test('Silas before his whisky: DRY, and his topics wait for it', () => {
    const g = game();
    at(g, 'lock_cottage');
    assert.match(say(g, 'talk to silas'), /^"Counting man, counting man, comes on a Thursday\.\.\."[^\n]*\n"Dry throat, Sergeant\./);
    // TT-131: the full speech once, then the short of it.
    assert.equal(say(g, 'ask silas about the tunnel'), '"Dry," says Silas, and licks his lips. "Black Lamb. Bell\'s. Then we\'ll talk."');
    assert.equal(say(g, 'ask silas about maggie'), '"Maggie\'s all right. Knows everybody\'s business but her own."');
    at(g, 'lock_cottage', (s) => { s.flags.silas_told = true; });
    assert.match(say(g, 'ask silas about the tunnel'), /^"Asylum morgue to the mill, under the moor\./);
    assert.equal(say(g, 'ask silas about the hatch'), '"Wants oil. There\'s a can in my shed."');
  });

  test('Pike at his desk: talk, topics, the button', () => {
    const g = game();
    at(g, 'police_house');
    assert.match(say(g, 'talk to pike'), /^"Now then, Sergeant\. Cup of tea\?/);
    assert.match(say(g, 'ask pike about mary'), /The pencil stops\./);
    assert.match(say(g, 'ask pike about the mill'), /Been up there yet, have you\?/);
    assert.match(say(g, 'arrest pike'), /^Not yet\. You need more than a hunch\.$/);
    at(g, 'police_house', (s) => { carry('button')(s); s.evidence.push('ev_button'); });
    assert.match(say(g, 'show button to pike'), /His hand has gone to his tunic\./);
    assert.match(say(g, 'x pike'), /all but the second button, which is missing/);
  });

  test('the occurrence book: EXAMINE works as READ', () => {
    const g = game();
    at(g, 'police_house');
    assert.match(say(g, 'x book'), /^15\/11\/84\. 09:00 On duty\./);
    assert.deepEqual(snap(g).notes, ['pike_patrol']);
  });

  test('Harrow\'s room: the empty cuff pouch, the suitcase stays put', () => {
    const g = game();
    at(g, 'harrows_room');
    assert.match(say(g, 'x jacket'), /an empty handcuff pouch\. He took his cuffs with him\./);
    assert.equal(say(g, 'take suitcase'), "It's Frank's. You'll look through it here.");
    say(g, 'open bag');
    assert.match(say(g, 'read list'), /^ASHWORTH 18\/10\./);
  });

  test('the bridge and the towpath refuse jumping and swimming (not hazards)', () => {
    const g = game();
    at(g, 'canal_bridge');
    assert.equal(say(g, 'jump'), "You lean over the parapet and look at the water. It looks back. You don't.");
    at(g, 'towpath');
    assert.match(say(g, 'swim'), /^Into November canal water\?/);
    assert.equal(snap(g).ended, null);
    assert.deepEqual(snap(g).warned, []);
  });

  test('throwing a non-critical item off the bridge loses it (sink)', () => {
    const g = game();
    at(g, 'canal_bridge', (s) => { s.items.coin.loc = 'player'; s.items.coin.hidden = false; });
    assert.equal(say(g, 'throw coin'), 'It drops into the black water without a splash worth the name. Gone.');
    assert.equal(snap(g).items.coin.loc, null);
  });

  test('the towpath leads west to the mill gates', () => {
    const g = game();
    at(g, 'towpath');
    say(g, 'w');
    assert.equal(snap(g).roomId, 'mill_gates');
  });
});

/* ------------------------------------------------------------------------ *
 *  Crypt, letters and the alibi                                             *
 * ------------------------------------------------------------------------ */

describe('the crypt and the alibi (red herring)', () => {
  const lit = (s) => { carry('torch')(s); s.flags.torch_loaded = true; s.items.torch.lit = true; };

  test('MOVE STONE reveals the letters once; showing them to Ashdown gives the alibi', () => {
    const g = game();
    at(g, 'crypt', lit);
    assert.match(say(g, 'move stone'), /Behind it is a Quality Street tin/);
    assert.ok(flag(g, 'letters_found'));
    assert.equal(say(g, 'pull stone'), 'Behind it there is only a hollow where the tin was.');
    say(g, 'take letters');
    assert.ok(carried(g, 'love_letters'));
    assert.match(say(g, 'read letters'), /A vicar's secret\. Not a murderer's\./);
    at(g, 'st_judes');
    assert.match(say(g, 'show letters to vicar'), /M\. is Margaret Pollard\./);
    assert.ok(flag(g, 'alibi_known'));
    assert.deepEqual(snap(g).notes, ['alibi']);
    assert.equal(say(g, 'ask ashdown about the eighth'), '"I\'ve told you. I was with Margaret."');
  });

  test('SEARCH in the lit crypt also finds the tin; in the dark you find nothing', () => {
    const g = game();
    at(g, 'crypt');
    assert.equal(say(g, 'search'), 'You grope around in the dark but find nothing.');
    at(g, 'crypt', lit);
    assert.match(say(g, 'search'), /bundle of letters tied with blue ribbon/);
  });

  test('Maggie gives the same alibi when shown the letters', () => {
    const g = game();
    at(g, 'black_lamb', (s) => { carry('love_letters')(s); s.items.love_letters.hidden = false; });
    assert.match(say(g, 'show letters to maggie'), /I was with Clement on the eighth\./);
    assert.ok(flag(g, 'alibi_known'));
  });

  test('PRAY in St Jude\'s; elsewhere the default', () => {
    const g = game();
    at(g, 'st_judes');
    assert.match(say(g, 'pray'), /^You sit in a box pew and close your eyes\./);
    at(g, 'platform');
    assert.equal(say(g, 'pray'), 'You pray. The rain goes on.');
  });
});

/* ------------------------------------------------------------------------ *
 *  ACCUSE, hazards, endings reachable in Town + Canal (STORY §12.3)          *
 * ------------------------------------------------------------------------ */

describe('outcomes reachable in Town + Canal', () => {
  const run = (...lines) => {
    const g = game();
    g.start();
    let ev = [];
    for (const line of lines) ev = g.input(line);
    return { g, ev };
  };
  const endOf = (ev) => ev.find((e) => e.type === 'end');

  test('wrong man - Maggie: prompt is free, YES ends the game on turn 4', () => {
    const { g, ev } = run('n', 'n', 'w', 'accuse maggie');
    assert.equal(ev[ev.length - 1].type, 'prompt');
    assert.equal(ev[ev.length - 1].text, 'Are you certain? (Y/N)');
    assert.equal(snap(g).turn, 3);
    const end = endOf(g.input('y'));
    assert.equal(end.ending, 'wrong_man');
    assert.equal(end.title, 'The Wrong Man');
    assert.match(end.text, /^You say it in front of the whole bar: "Margaret Pollard, I am arresting you\.\.\."/);
    assert.equal(snap(g).turn, 4);
  });

  test('wrong man - Ashdown (turn 6) and Silas (turn 6)', () => {
    const a = run('n', 'n', 'n', 'ne', 'n', 'accuse ashdown', 'y');
    assert.equal(snap(a.g).ended, 'wrong_man');
    assert.match(endOf(a.ev).text, /^"Clement Ashdown, I am arresting you\.\.\."/);
    assert.equal(snap(a.g).turn, 6);
    const s = run('n', 'e', 'd', 'e', 'n', 'accuse silas', 'y');
    assert.equal(snap(s.g).ended, 'wrong_man');
    assert.match(endOf(s.ev).text, /^"Silas Thorne, I am arresting you\.\.\."/);
    assert.equal(snap(s.g).turn, 6);
  });

  test('accusation cancelled: "(You hold your tongue.)", no turn', () => {
    const { g, ev } = run('n', 'n', 'w', 'accuse maggie', 'n');
    assert.deepEqual(texts(ev), ['(You hold your tongue.)']);
    assert.equal(snap(g).turn, 3);
    assert.equal(snap(g).ended, null);
  });

  test('weak accusation: Pike laughs, 1 turn, the game goes on', () => {
    const { g, ev } = run('n', 'n', 'e', 'accuse pike');
    assert.match(texts(ev).join('\n'), /Pike laughs - a big easy laugh with nothing behind it\./);
    assert.equal(snap(g).turn, 4);
    assert.equal(snap(g).ended, null);
    assert.equal(snap(g).vars.pikeState, 'desk');
  });

  test('accusing someone absent is free', () => {
    const { g, ev } = run('accuse pike');
    assert.deepEqual(texts(ev), ["Accuse who? They're not here."]);
    assert.equal(snap(g).turn, 0);
  });

  test('correct accusation at the desk with 3 evidence: Pike flees (+10, fled, arrival turn + 5)', () => {
    const g = game();
    at(g, 'police_house', (s) => {
      s.turn = 63;
      carry('button', 'ledger_page')(s);
      s.evidence.push('ev_button', 'ev_register', 'ev_ledger');
    });
    const ev = g.input('accuse pike');
    const t = texts(ev).join('\n');
    assert.match(t, /^"Arthur Pike, I am arresting you for the murders of Edna Ashworth/);
    assert.ok(ev.some((e) => e.type === 'sfx' && e.id === 'sting'));
    const s = snap(g);
    assert.equal(s.vars.pikeState, 'fled');
    assert.equal(s.vars.pikeArrivalTurn, 68);
    assert.equal(s.npcs.pike.loc, null);
    assert.ok(s.awarded.includes('accusation'));
    assert.match(say(g, 'look'), /Pike's helmet lies on the floor where it fell\./);
  });

  test('the lock: SWIM warns once (1 turn), the second is fatal; bare ENTER and JUMP share the warning', () => {
    const { g, ev } = run('n', 'e', 'd', 'e', 'swim');
    assert.match(texts(ev).join('\n'), /\(If it is the cottage you want, it is NORTH\.\)/);
    assert.equal(snap(g).turn, 5);
    assert.deepEqual(snap(g).warned, ['lock']);
    const end = endOf(g.input('swim'));
    assert.equal(end.ending, 'death_drown');
    assert.equal(end.title, 'Drowned');
    assert.equal(snap(g).turn, 6);
    for (const second of ['enter', 'jump', 'enter lock', 'jump in lock']) {
      const r = run('n', 'e', 'd', 'e', 'enter');
      assert.deepEqual(snap(r.g).warned, ['lock']);
      assert.equal(endOf(r.g.input(second))?.ending, 'death_drown', second);
    }
  });

  test('HINT: the first open step is the light, tier 1', () => {
    const g = game();
    at(g, 'platform');
    assert.equal(say(g, 'hint'), "You won't get far in Blackmere without a light. There's a torch on the waiting-room windowsill, but its batteries are dead.");
  });

  test('HELP is STORY §1.7', () => {
    const g = game();
    assert.match(say(g, 'help'), /^Type short commands: GO NORTH \(or N\)/);
  });
});
