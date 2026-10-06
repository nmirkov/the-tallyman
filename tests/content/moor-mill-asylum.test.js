// TT-017 — the real content, Moor, Mill and Asylum zones (docs/STORY.md §4.3–4.5, §5, §7,
// §8.6, §9, §10, §12). Asserts the §12.1 / §12.2 rows in these zones, the §7.2 phrasings,
// the quarry hazard, both hatches and the once-only room beats. Going down either hatch
// reaches the tunnel (TT-018); the finale itself is tested in walkthrough-smoke / beneath.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import content from '../../src/content/index.js';
import { newGame, texts, setup } from '../fixtures/harness.js';

const STORY = readFileSync(new URL('../../docs/STORY.md', import.meta.url), 'utf8');
/** STORY §12.1 "Plain list for tests/walkthrough/" (91 commands). */
const WALKTHROUGH = STORY.split('Plain list for `tests/walkthrough/` (91 lines):\n```\n')[1].split('```')[0].trim().split('\n');

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
const lit = (s) => { carry('torch')(s); s.flags.torch_loaded = true; s.items.torch.lit = true; };
const all = (...fns) => (s) => { for (const f of fns) f(s); };
const flags = (...names) => (s) => { for (const n of names) s.flags[n] = true; };
const carried = (g, id) => snap(g).items[id].loc === 'player';
const flag = (g, name) => snap(g).flags[name] === true;
const sfx = (ev, id) => ev.some((e) => e.type === 'sfx' && e.id === id);
const endOf = (ev) => ev.find((e) => e.type === 'end');
/** A fresh started game with `lines` played; returns the game and the last command's events. */
const run = (...lines) => {
  const g = game();
  g.start();
  let ev = [];
  for (const line of lines) ev = g.input(line);
  return { g, ev };
};

/* ------------------------------------------------------------------------ *
 *  Bundle                                                                   *
 * ------------------------------------------------------------------------ */

describe('bundle', () => {
  test('Moor has 6 rooms, Mill 5, Asylum 6; no stubs remain', () => {
    const byZone = (z) => Object.keys(content.rooms).filter((id) => content.rooms[id].zone === z);
    assert.deepEqual(byZone('moor'), ['moor_road', 'harrows_car', 'tally_stone', 'quarry_edge', 'quarry_hut', 'quarry_floor']);
    assert.deepEqual(byZone('mill'), ['mill_gates', 'mill_yard', 'weaving_shed', 'counting_house', 'boiler_room']);
    assert.deepEqual(byZone('asylum'), ['asylum_gates', 'coal_chute', 'entrance_hall', 'records_office', 'ward', 'morgue']);
    assert.equal(content.stubs, undefined);
    assert.equal(Object.keys(content.rooms).length, 42);
  });

  test('the dark rooms are the weaving shed, boiler room, ward and morgue', () => {
    const dark = ['moor', 'mill', 'asylum'].flatMap((z) => Object.keys(content.rooms).filter((id) => content.rooms[id].zone === z && content.rooms[id].dark));
    assert.deepEqual(dark, ['weaving_shed', 'boiler_room', 'ward', 'morgue']);
  });

  test('the zones get their STORY §3.1 safe rooms back', () => {
    assert.equal(content.zones.moor.safeRoom, 'moor_road');
    assert.equal(content.zones.mill.safeRoom, 'mill_yard');
    assert.equal(content.zones.asylum.safeRoom, 'asylum_gates');
    for (const z of ['moor', 'mill', 'asylum']) assert.notEqual(content.zones[z].panic, false, z);
  });

  test('these zones\' items are real: critical, located, with their slots', () => {
    const where = {
      handcuffs: 'harrows_car', notebook_page: 'harrows_car', crowbar: 'quarry_hut', rope: 'quarry_hut', exercise_book: 'quarry_floor',
      mill_chain: 'mill_gates', ledger: 'counting_house', ledger_page: 'ledger', iron_trap: 'counting_house', boiler_hatch: 'boiler_room',
      cabinet: 'records_office', patient_file: 'cabinet', drawer_four: 'morgue', drawers: 'morgue',
    };
    for (const [id, loc] of Object.entries(where)) assert.equal(content.items[id].location, loc, id);
    for (const id of ['handcuffs', 'crowbar', 'rope', 'ledger_page', 'patient_file']) assert.equal(content.items[id].critical, true, id);
  });

  test('data gated on the new rooms switched on: quarry hazard, fog figure, stone girl, dark counting', () => {
    assert.equal(content.hazards.quarry.room, 'quarry_edge');
    const beat = (id) => content.beats.find((b) => b.id === id);
    assert.ok(beat('fog_figure'));
    assert.ok(beat('stone_girl'));
    assert.deepEqual(beat('counting_dark').when.in, ['crypt', 'weaving_shed', 'boiler_room', 'ward', 'morgue', 'tunnel']);
  });
});

/* ------------------------------------------------------------------------ *
 *  STORY §12.1 commands 51–88, row by row                                    *
 * ------------------------------------------------------------------------ */

describe('STORY §12.1 walkthrough, commands 51-88', () => {
  const g = game();
  g.start();
  for (const line of WALKTHROUGH.slice(0, 50)) g.input(line);
  /** [room after, score after, extra check] for commands 51.. — command k ends on turn k. */
  const ROWS = [
    ['mill_gates', 40, (s, t) => assert.match(t, /chained and padlocked/)],
    ['mill_gates', 40, (s, t, ev) => { assert.equal(s.flags.mill_chain_cut, true); assert.ok(sfx(ev, 'chain')); assert.match(t, /a crack like a pistol/); }],
    ['mill_yard', 45, (s, t) => { assert.ok(s.awarded.includes('mill_entered')); assert.equal(s.flags.entered_mill, true); assert.match(t, /a loom shuttle clacks once/); }],
    ['counting_house', 45, (s, t) => assert.match(t, /On the ledger you can see a loose ledger page\./)],
    ['counting_house', 55, (s) => { assert.equal(s.items.ledger_page.loc, 'player'); assert.deepEqual(s.evidence, ['ev_button', 'ev_register', 'ev_ledger']); }],
    ['counting_house', 55, (s, t) => { assert.equal(s.flags.heard_praying, true); assert.ok(s.notes.includes('praying')); assert.match(t, /forgive us our trespasses/); }],
    ['mill_yard', 55, (s, t) => assert.doesNotMatch(t, /loom shuttle/)],
    ['mill_gates', 55, (s, t) => assert.match(t, /stand open a body's width, the cut chain hanging from one bar/)],
    ['towpath', 55],
    ['canal_bridge', 55, (s, t) => assert.match(t, /tolls ten\. Two hours\./)],
    ['station_road', 55],
    ['market_square', 55],
    ['police_house', 55, (s) => assert.equal(s.npcs.pike.loc, 'police_house')],
    ['police_house', 65, (s) => { assert.equal(s.vars.pikeState, 'fled'); assert.equal(s.vars.pikeArrivalTurn, 68); }],
    ['market_square', 65],
    ['high_street', 65],
    ['moor_road', 65, (s, t) => assert.match(t, /Nosed into the ditch is a blue Cortina/)],
    ['harrows_car', 70, (s, t) => {
      assert.equal(s.flags.found_car, true);
      assert.ok(s.awarded.includes('car_found'));
      assert.match(t, /A pair of police handcuffs lies on the passenger seat, dropped in a hurry\.\nA torn notebook page lies in the footwell\./);
      assert.match(t, /Frank never leaves his keys\./);
    }],
    ['harrows_car', 70, (s) => { assert.equal(s.items.handcuffs.loc, 'player'); assert.equal(s.items.notebook_page.loc, 'player'); }],
    ['harrows_car', 70, (s, t) => { assert.ok(s.notes.includes('notebook')); assert.match(t, /The boy who counted\./); }],
    ['moor_road', 70],
    ['tally_stone', 70, (s, t) => { assert.ok(s.fired.includes('fog_figure')); assert.match(t, /a cape on its shoulders\. Then there is only fog\./); }],
    ['quarry_edge', 70],
    ['quarry_hut', 70, (s, t) => assert.match(t, /A crowbar leans in the corner, rusty but sound\.\nA long coil of rope hangs from a nail\./)],
    ['quarry_hut', 70, (s) => assert.equal(s.items.crowbar.loc, 'player')],
    ['quarry_edge', 70],
    ['tally_stone', 70],
    ['asylum_gates', 70],
    ['coal_chute', 70],
    ['entrance_hall', 70],
    ['records_office', 70],
    ['records_office', 70, (s, t, ev) => {
      assert.equal(s.items.cabinet.open, true);
      assert.equal(s.items.cabinet.locked, false);
      assert.ok(sfx(ev, 'creak'));
      assert.match(t, /^\(with the crowbar\) You jam the claw into the seam/);
    }],
    ['records_office', 80, (s) => { assert.equal(s.items.patient_file.loc, 'player'); assert.deepEqual(s.evidence, ['ev_button', 'ev_register', 'ev_ledger', 'ev_file']); }],
    ['records_office', 80, (s, t) => { assert.ok(s.notes.includes('morgue_drawer')); assert.match(t, /the drawer that does not close/); }],
    ['entrance_hall', 80],
    ['morgue', 80, (s, t) => { assert.match(t, /Drawer 4 does not sit flush with the rest\./); assert.match(t, /Exits: up\./); }],
    ['morgue', 80, (s, t, ev) => { assert.equal(s.flags.morgue_hatch_found, true); assert.ok(sfx(ev, 'creak')); assert.match(t, /iron rungs drop into a square hatch/); }],
    // 88: D into the tunnel; Pike has been below since turn 68, so the iron door is ajar.
    ['tunnel', 80, (s, t, ev) => {
      assert.match(t, /North, the iron door stands ajar/);
      assert.equal(s.flags.tunnel_music, true);
      assert.ok(ev.some((e) => e.type === 'music' && e.id === 'dread'));
    }],
  ];
  ROWS.forEach(([room, score, check], i) => {
    const k = 51 + i;
    test(`${k}. ${WALKTHROUGH[k - 1]}`, () => {
      const ev = g.input(WALKTHROUGH[k - 1]);
      const s = snap(g);
      const t = texts(ev).join('\n');
      assert.equal(s.ended, null);
      assert.equal(s.turn, k, 'each command costs exactly one turn');
      assert.equal(s.roomId, room);
      assert.equal(s.score, score);
      if (check) check(s, t, ev);
    });
  });
  test('after 88: notes in order, 4 evidence, 80 points', () => {
    const s = snap(g);
    assert.deepEqual(s.notes, ['hq_call', 'case_map', 'harrow_list', 'pike_patrol', 'mary_pike', 'silas_story', 'praying', 'notebook', 'morgue_drawer']);
    assert.match(say(g, 'notes'), /Evidence \(4\)/);
    assert.equal(snap(g).score, 80);
  });
});

/* ------------------------------------------------------------------------ *
 *  STORY §12.2 boiler-room route, commands 84–99                             *
 * ------------------------------------------------------------------------ */

describe('STORY §12.2 boiler-room route, commands 84-99', () => {
  const g = game();
  g.start();
  for (const line of WALKTHROUGH.slice(0, 83)) g.input(line);
  const ROWS = [
    ['e', 'entrance_hall'], ['s', 'coal_chute'], ['u', 'asylum_gates'], ['s', 'tally_stone'], ['s', 'moor_road'],
    ['s', 'high_street'], ['s', 'market_square'], ['s', 'station_road'], ['e', 'canal_bridge'], ['d', 'towpath'],
    ['w', 'mill_gates'], ['n', 'mill_yard'],
    ['d', 'boiler_room', (s, t) => { assert.match(t, /In the floor between the boilers is a round iron hatch, rusted to its rim\./); assert.match(t, /Exits: up, down\./); }],
    ['oil hatch', 'boiler_room', (s, t) => { assert.equal(s.flags.hatch_oiled, true); assert.match(t, /The rust drinks it\./); }],
    ['open hatch', 'boiler_room', (s, t, ev) => { assert.equal(s.items.boiler_hatch.open, true); assert.ok(sfx(ev, 'hatch')); }],
    // 99: D into the tunnel, up the ladder from the boiler-room side.
    ['d', 'tunnel', (s, t) => { assert.match(t, /North, the iron door stands ajar/); assert.match(t, /You can see a hatch here\./); }],
  ];
  ROWS.forEach(([line, room, check], i) => {
    const k = 84 + i;
    test(`${k}. ${line}`, () => {
      const ev = g.input(line);
      const s = snap(g);
      assert.equal(s.turn, k);
      assert.equal(s.roomId, room);
      assert.equal(s.score, 80);
      if (check) check(s, texts(ev).join('\n'), ev);
    });
  });
});

/* ------------------------------------------------------------------------ *
 *  STORY §7.2 accepted phrasings (Moor, Mill, Asylum steps)                  *
 * ------------------------------------------------------------------------ */

/** Each phrasing in a fresh game prepared by `prep`; `check(g, text, line)` must hold. */
function phrasings(name, lines, prep, check) {
  describe(name, () => {
    for (const line of lines) {
      test(line, () => {
        const g = game();
        g.start();
        prep(g);
        const t = say(g, line);
        assert.equal(snap(g).turn, 1, 'one turn');
        check(g, t, line);
      });
    }
  });
}

phrasings('step 12: cutting the gate chain',
  ['cut chain', 'cut chain with cutters', 'cut padlock', 'break chain', 'snip chain', 'use cutters', 'use cutters on chain', 'open chain', 'unlock padlock', 'crop chain'],
  (g) => at(g, 'mill_gates', carry('bolt_cutters')),
  (g, t) => { assert.ok(flag(g, 'mill_chain_cut')); assert.match(t, /The gates groan open a body's width\./); });

phrasings('step 13: into the mill',
  ['n', 'in', 'go in', 'enter mill', 'enter gates'],
  (g) => at(g, 'mill_gates', flags('mill_chain_cut')),
  (g) => { assert.equal(snap(g).roomId, 'mill_yard'); assert.equal(snap(g).score, 5); });

phrasings('step 14: the ledger page',
  ['take page', 'take loose page', 'take page from ledger', 'tear page', 'tear page from ledger', 'tear page out of ledger', 'rip page', 'tear ledger', 'pull page'],
  (g) => at(g, 'counting_house'),
  (g) => { assert.ok(carried(g, 'ledger_page')); assert.deepEqual(snap(g).evidence, ['ev_ledger']); assert.equal(snap(g).score, 10); });

phrasings('step 15: listening at the trap',
  ['listen', 'listen to trap', 'listen to floor'],
  (g) => at(g, 'counting_house'),
  (g, t) => { assert.ok(flag(g, 'heard_praying')); assert.deepEqual(snap(g).notes, ['praying']); assert.match(t, /Someone is alive down there\./); });

phrasings('step 19: into Harrow\'s car',
  ['in', 'enter car', 'get in car', 'enter cortina'],
  (g) => at(g, 'moor_road'),
  (g) => { assert.equal(snap(g).roomId, 'harrows_car'); assert.equal(snap(g).score, 5); assert.ok(flag(g, 'found_car')); });

phrasings('step 20: the handcuffs and the notebook page',
  ['take handcuffs', 'take cuffs', 'take all', 'read page'],
  (g) => at(g, 'harrows_car'),
  (g, t, line) => {
    if (line === 'read page') assert.deepEqual(snap(g).notes, ['notebook']);
    else assert.ok(carried(g, 'handcuffs'));
    if (line === 'take all') assert.ok(carried(g, 'notebook_page'));
  });

phrasings('step 21: the quarry hut',
  ['take crowbar', 'take jemmy', 'take all'],
  (g) => at(g, 'quarry_hut'),
  (g, t, line) => { assert.ok(carried(g, 'crowbar')); if (line === 'take all') assert.ok(carried(g, 'rope')); });

phrasings('step 22: down the coal chute',
  ['d', 'down', 'in', 'enter chute', 'climb down', 'climb down chute', 'go down'],
  (g) => at(g, 'asylum_gates'),
  (g) => assert.equal(snap(g).roomId, 'coal_chute'));

phrasings('step 22: back up the chute',
  ['u', 'climb up', 'climb up chute'],
  (g) => at(g, 'coal_chute'),
  (g) => assert.equal(snap(g).roomId, 'asylum_gates'));

phrasings('step 23: levering the cabinet',
  ['open cabinet', 'open cabinet with crowbar', 'pry cabinet', 'pry cabinet open', 'pry open cabinet', 'pry cabinet with crowbar', 'pry open cabinet with crowbar',
    'pry cabinet open with crowbar', 'prise cabinet', 'lever cabinet', 'force cabinet', 'break cabinet', 'unlock cabinet', 'use crowbar', 'use crowbar on cabinet'],
  (g) => at(g, 'records_office', carry('crowbar')),
  (g, t) => { assert.equal(snap(g).items.cabinet.open, true); assert.match(t, /the drawer lurches out\./); });

phrasings('step 24: the patient file',
  ['take file', 'take folder', 'take file from cabinet'],
  (g) => at(g, 'records_office', (s) => { s.items.cabinet.open = true; s.items.cabinet.locked = false; }),
  (g) => { assert.ok(carried(g, 'patient_file')); assert.deepEqual(snap(g).evidence, ['ev_file']); assert.equal(snap(g).score, 10); });

phrasings('step 26a: drawer 4',
  ['pull drawer', 'push drawer', 'move drawer', 'slide drawer', 'shift drawer', 'open drawer', 'close drawer', 'pull drawer 4', 'pull drawer four',
    'pull fourth drawer', 'move drawer four', 'use crowbar', 'use crowbar on drawer'],
  (g) => at(g, 'morgue', all(lit, carry('crowbar'))),
  (g, t) => { assert.ok(flag(g, 'morgue_hatch_found')); assert.match(t, /^You put your weight against drawer 4\./); });

phrasings('step 26b: oiling the boiler hatch',
  ['oil hatch', 'oil hatch with can', 'oil hatch with oil can', 'lubricate hatch', 'grease hatch', 'use oil', 'use oil can', 'use oil on hatch', 'use oil can on hatch',
    'pour oil on hatch', 'squirt oil on hatch', 'put oil on hatch'],
  (g) => at(g, 'boiler_room', all(lit, carry('oil_can'))),
  (g, t) => { assert.ok(flag(g, 'hatch_oiled')); assert.match(t, /Somewhere in the hinge, something sighs\./); });

/* ------------------------------------------------------------------------ *
 *  The quarry (STORY §8.6, §12.3)                                           *
 * ------------------------------------------------------------------------ */

describe('the quarry', () => {
  test('without the rope: D warns once (turn 7), the second D is death_fall (turn 8)', () => {
    const { g, ev } = run('n', 'n', 'n', 'n', 'n', 'e', 'd');
    assert.equal(snap(g).roomId, 'quarry_edge');
    assert.equal(snap(g).turn, 7);
    assert.match(texts(ev).join('\n'), /^You look over the edge\. Sixty feet of wet rock down to black water/);
    assert.deepEqual(snap(g).warned, ['quarry']);
    const end = endOf(g.input('d'));
    assert.equal(end.ending, 'death_fall');
    assert.equal(end.title, 'The Long Drop');
    assert.match(end.text, /I was told\. Then the rock lets go of you\./);
    assert.equal(snap(g).turn, 8);
  });

  test('UNDO after the fall restores the edge with the warning still given', () => {
    const { g } = run('n', 'n', 'n', 'n', 'n', 'e', 'd', 'd');
    assert.equal(snap(g).ended, 'death_fall');
    g.input('undo');
    assert.equal(snap(g).ended, null);
    assert.equal(snap(g).turn, 7);
    assert.equal(endOf(g.input('d'))?.ending, 'death_fall');
  });

  test('with the rope: down safely (once-only climb text), up again, and the rope is still yours', () => {
    const { g, ev } = run('n', 'n', 'n', 'n', 'n', 'e', 'in', 'take rope', 'out', 'd');
    const t = texts(ev).join('\n');
    assert.equal(snap(g).roomId, 'quarry_floor');
    assert.deepEqual(snap(g).warned, []);
    assert.ok(flag(g, 'climbed_down'));
    assert.match(t, /You loop the rope round the winch post/);
    assert.match(t, /A child's exercise book lies swollen beside the fire ring\./);
    assert.ok(carried(g, 'rope'));
    assert.match(say(g, 'take book'), /Taken\./);
    assert.match(say(g, 'read book'), /WHEN THE TALLY IS SETTLED SHE CAN STOP\./);
    assert.equal(snap(g).items.exercise_book.loc, 'player');
    say(g, 'u');
    assert.equal(snap(g).roomId, 'quarry_edge');
    assert.doesNotMatch(say(g, 'd'), /You loop the rope/);
    assert.equal(snap(g).roomId, 'quarry_floor');
  });

  test('JUMP at the edge is a refusal, not the hazard; the rope cannot be thrown away', () => {
    const g = game();
    at(g, 'quarry_edge', carry('rope'));
    assert.equal(say(g, 'jump'), 'You look at the drop. The drop looks at you. No.');
    assert.deepEqual(snap(g).warned, []);
    say(g, 'throw rope');
    assert.ok(carried(g, 'rope'));
  });

  test('a non-critical item thrown over the edge is lost (sink)', () => {
    const g = game();
    at(g, 'quarry_edge', carry('notebook_page'));
    assert.equal(say(g, 'throw page'), 'It falls a long way and the black water takes it with a small sound.');
    assert.equal(snap(g).items.notebook_page.loc, null);
  });
});

/* ------------------------------------------------------------------------ *
 *  Both hatches (STORY §3.3 msgs D / E, §5.2)                                *
 * ------------------------------------------------------------------------ */

describe('the boiler hatch', () => {
  test('unoiled it will not open; without the can there is nothing to oil it with', () => {
    const g = game();
    at(g, 'boiler_room', lit);
    assert.match(say(g, 'x hatch'), /It would want oil before it moved\./);
    assert.equal(say(g, 'open hatch'), 'You heave. Nothing. Rust has welded the rim to the frame. It wants oil.');
    assert.equal(snap(g).items.boiler_hatch.open, false);
    assert.equal(say(g, 'oil hatch'), "You've nothing to oil it with.");
    assert.equal(say(g, 'x ladder'), "You can't see one. The hatch is shut.");
    assert.equal(say(g, 'd'), 'The hatch is closed.');
  });

  test('oiled: a second oiling says so; OPEN opens it (sfx hatch); the room and ladder change', () => {
    const g = game();
    at(g, 'boiler_room', all(lit, carry('oil_can')));
    say(g, 'oil hatch');
    assert.equal(say(g, 'oil hatch'), "It's had all the oil it needs. Try opening it.");
    assert.equal(say(g, 'x hatch'), 'A round iron hatch. The oil has soaked into the rust round the rim.');
    const ev = g.input('open hatch');
    assert.ok(sfx(ev, 'hatch'));
    assert.equal(snap(g).items.boiler_hatch.open, true);
    assert.match(say(g, 'look'), /the round iron hatch stands open on a ladder going down into the dark/);
    assert.equal(say(g, 'x ladder'), 'Iron rungs, going down.');
    assert.equal(say(g, 'x hatch'), 'The round iron hatch, open, a ladder going down.');
  });

  test('down needs the torch on (msg D) even with the hatch open', () => {
    const g = game();
    at(g, 'boiler_room', (s) => {
      lit(s);
      s.items.boiler_hatch.open = true;
      s.prevRoomId = 'boiler_room';
    });
    say(g, 'turn off torch');
    assert.equal(say(g, 'd'), 'Not without a light.');
  });

  test('the oil can elsewhere is wasted breath', () => {
    const g = game();
    at(g, 'mill_yard', carry('oil_can'));
    assert.equal(say(g, 'use oil can'), "You'd waste it. Save it for something rusty.");
    assert.equal(snap(g).flags.hatch_oiled, undefined);
  });
});

describe('the morgue hatch', () => {
  test('hidden until drawer 4 slides; then listed, described and examinable', () => {
    const g = game();
    at(g, 'morgue', lit);
    assert.equal(say(g, 'd'), "You can't go that way.");
    assert.equal(say(g, 'x hatch'), 'You see no hatch.');
    assert.match(say(g, 'x drawer'), /Its runners shine with grease/);
    assert.match(say(g, 'search drawer'), /It moves more than a drawer should\./);
    assert.equal(say(g, 'open drawers'), 'Rusted shut, all but number 4.');
    say(g, 'pull drawer');
    const look = say(g, 'look');
    assert.match(look, /Drawer 4 has been run back on its rails; beneath it, iron rungs drop into a square hatch\./);
    assert.match(look, /Exits: up, down\./);
    assert.match(say(g, 'x hatch'), /^A square hatch under the drawer/);
    assert.equal(say(g, 'x drawer'), 'Drawer 4, run back into the wall. The hatch yawns beneath it.');
    assert.equal(say(g, 'push drawer'), 'It has run back as far as it goes. The hatch is open beneath it.');
  });

  // Msg E's "Not without a light." is transcribed but unreachable: the morgue is dark, so
  // without the torch on the hidden exit's `if` is false and A8.3 refuses it as darkness.
  test('down needs the torch on; with it on you reach the tunnel', () => {
    const g = game();
    at(g, 'morgue', (s) => { lit(s); s.flags.morgue_hatch_found = true; s.prevRoomId = 'entrance_hall'; });
    say(g, 'turn off torch');
    assert.equal(say(g, 'd'), 'You blunder about in the dark but find no way through.');
    assert.equal(snap(g).roomId, 'morgue');
    say(g, 'turn on torch');
    assert.match(say(g, 'd'), /^Tunnel\n/);
    assert.equal(snap(g).roomId, 'tunnel');
    assert.match(say(g, 's'), /^Morgue\n/);
  });
});

/* ------------------------------------------------------------------------ *
 *  Room beats, once-only effects, refusals                                  *
 * ------------------------------------------------------------------------ */

describe('room beats and once-only effects', () => {
  test('the mill girl appears once, and only by torchlight (+10 nerve, whisper)', () => {
    const g = game();
    at(g, 'mill_yard');
    assert.doesNotMatch(say(g, 'w'), /He counts for me/);
    assert.equal(snap(g).flags.saw_girl, undefined);
    say(g, 'e');
    at(g, 'mill_yard', lit);
    const before = snap(g).nerve;
    const ev = g.input('w');
    const girl = ev.find((e) => e.type === 'text' && /He counts for me/.test(e.text));
    assert.ok(girl);
    assert.equal(girl.style, 'whisper');
    assert.ok(sfx(ev, 'whisper'));
    assert.ok(flag(g, 'saw_girl'));
    assert.equal(snap(g).nerve, before + 10 + 2, 'girl +10, the shed +2');
    assert.equal(say(g, 'x girl'), "There's no one there. There was no one there.");
    say(g, 'e');
    assert.doesNotMatch(say(g, 'w'), /He counts for me/);
  });

  test('then the stone girl in the churchyard turns towards the mill, once', () => {
    const g = game();
    at(g, 'churchyard', (s) => { s.visited.push('weaving_shed'); });
    say(g, 'z');
    assert.ok(snap(g).fired.includes('stone_girl'));
  });

  test('the ward: counting under the drip, once, by torchlight', () => {
    const g = game();
    at(g, 'entrance_hall', lit);
    assert.match(say(g, 'e'), /It stops when you stop breathing\./);
    assert.ok(flag(g, 'ward_counting'));
    say(g, 'w');
    assert.doesNotMatch(say(g, 'e'), /It stops when you stop breathing\./);
    assert.equal(say(g, 'x bed nine'), 'Bed 9. Scratched into the iron of the footboard: A.P.');
    assert.equal(say(g, 'x bed'), 'Iron frames, springs rusted to lace. A brass number on each foot.');
  });

  test('the mill yard and the car award once only', () => {
    const g = game();
    at(g, 'mill_gates', flags('mill_chain_cut'));
    say(g, 'n');
    say(g, 's');
    assert.doesNotMatch(say(g, 'n'), /loom shuttle/);
    assert.equal(snap(g).score, 5);
    at(g, 'moor_road');
    say(g, 'in');
    say(g, 'out');
    assert.doesNotMatch(say(g, 'in'), /Frank never leaves his keys/);
    assert.equal(snap(g).score, 10);
  });

  test('a panic on the moor ends on the moor road (the safe room is back)', () => {
    const g = game();
    at(g, 'quarry_edge', (s) => { s.nerve = 99; });
    say(g, 'z');
    assert.equal(snap(g).roomId, 'moor_road');
    assert.equal(snap(g).nerve, 50);
  });
});

describe('gates and refusals', () => {
  test('the mill gates are chained (msg C) and the bare chain wants cutters', () => {
    const g = game();
    at(g, 'mill_gates');
    assert.equal(say(g, 'n'), "A chain as thick as your wrist holds the gates shut, padlocked to itself. You'd need bolt cutters.");
    assert.equal(say(g, 'in'), "A chain as thick as your wrist holds the gates shut, padlocked to itself. You'd need bolt cutters.");
    assert.equal(say(g, 'cut chain'), 'With what - your teeth? You need bolt cutters.');
    at(g, 'mill_gates', all(carry('bolt_cutters'), flags('mill_chain_cut')));
    assert.equal(say(g, 'cut chain'), "It's cut already. The gates are open a body's width.");
    assert.equal(say(g, 'x chain'), 'Cut through. It hangs from one bar like a dead snake.');
  });

  test('Pike\'s iron trap never opens, with or without tools', () => {
    const g = game();
    at(g, 'counting_house', carry('crowbar', 'bolt_cutters'));
    const TRAP = /^A disc padlock: no shackle for cutters to bite on/;
    for (const line of ['open trap', 'unlock trap', 'cut trap', 'break trap', 'pry trap', 'pull trap', 'use crowbar']) assert.match(say(g, line), TRAP, line);
    assert.match(say(g, 'x trap'), /bright with use\. Someone comes and goes here, often\./);
  });

  test('the ledger stays; a carried page is protected; after Harrow is free the floor is quiet', () => {
    const g = game();
    at(g, 'counting_house');
    assert.equal(say(g, 'take ledger'), "It weighs as much as a child. You couldn't carry it if you wanted to.");
    assert.equal(say(g, 'hit ledger'), 'The ledger is unmoved by your violence.');
    assert.match(say(g, 'read ledger'), /The last page - the one hanging loose - is different\./);
    say(g, 'take page');
    assert.match(say(g, 'read page'), /Pike, Mary, 14 - 3s 4d\./);
    say(g, 'tear page');
    assert.ok(carried(g, 'ledger_page'));
    at(g, 'counting_house', (s) => { s.vars.harrowFreed = true; });
    assert.equal(say(g, 'listen'), 'Nothing beneath the floor now but your own heartbeat.');
  });

  test('the cabinet without the crowbar; once open it stays open', () => {
    const g = game();
    at(g, 'records_office');
    assert.equal(say(g, 'open cabinet'), "Rusted solid. You'd need something to lever it with.");
    assert.equal(say(g, 'take file'), "You can't see any such thing.");
    at(g, 'records_office', carry('crowbar'));
    say(g, 'open cabinet');
    assert.equal(say(g, 'open cabinet'), "It's open.");
    assert.match(say(g, 'x cabinet'), /^A steel cabinet marked P-R, its drawer levered open\./);
  });

  test('tools out of place: crowbar, handcuffs', () => {
    const g = game();
    at(g, 'moor_road', carry('crowbar', 'handcuffs'));
    assert.equal(say(g, 'use crowbar'), 'Nothing here wants levering.');
    assert.equal(say(g, 'use handcuffs'), "There's nobody here who needs cuffing.");
  });

  test('critical items here cannot be thrown away or eaten', () => {
    const g = game();
    at(g, 'quarry_edge', carry('crowbar', 'handcuffs', 'ledger_page', 'patient_file'));
    for (const id of ['crowbar', 'cuffs', 'page', 'file']) say(g, `throw ${id}`);
    for (const id of ['crowbar', 'handcuffs', 'ledger_page', 'patient_file']) assert.ok(carried(g, id), id);
  });

  test('Pike reacts to the new evidence at his desk', () => {
    const g = game();
    at(g, 'police_house', carry('patient_file', 'handcuffs', 'ledger_page'));
    assert.equal(say(g, 'show file to pike'), '"That\'s private, that." Very quietly. "That\'s mine."');
    assert.match(say(g, 'show cuffs to pike'), /^"Mr Harrow's\? Where did you find those\?"/);
    assert.match(say(g, 'show page to pike'), /His lips move: one, two, three, four, five\./);
    assert.match(say(g, 'x pike'), /^PC Arthur Pike: a big young constable/);
  });
});

describe('hints in these zones', () => {
  test('HINT points at the mill once Silas has talked, and at the asylum files after the cuffs', () => {
    const g = game();
    at(g, 'towpath', (s) => {
      s.awarded.push('torch_lit', 'harrows_room', 'silas_story');
      s.score = 15;
    });
    assert.equal(say(g, 'hint'), 'Frank circled the mill twice. Its gates are chained.');
    at(g, 'moor_road', (s) => {
      s.awarded.push('mill_entered');
      s.evidence.push('ev_ledger', 'ev_register', 'ev_button');
      carry('ledger_page', 'button', 'handcuffs')(s);
    });
    assert.equal(say(g, 'hint'), "Frank asked for Ashcombe Asylum's files from 1971. They were never sent. They're still up there.");
  });
});
