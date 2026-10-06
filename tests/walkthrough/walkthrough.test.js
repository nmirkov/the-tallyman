// TT-022 — Walkthrough suite (PLAN §4 "Walkthrough"): STORY §12.1 wins 100/100 with
// `victory` at turn 91 (22:15), checked row by row against the §12.1 table (room, turn,
// running score, notes and evidence where the table names them); STORY §12.2 boiler-room
// route row by row; every other ending and death script in STORY §12.3.
// Expected values come from STORY.md / PLAN §2.5, never from engine output.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  content, WALKTHROUGH, WALKTHROUGH_TABLE, BOILER_ROUTE, times, texts, joined, endOf, statusOf,
  fresh, run, feed, snap, assertEnding, assertRunning, evidenceCount,
} from './script.js';

/** STORY §11: every award id and its points (total 100). */
const AWARDS = {
  torch_lit: 5, harrows_room: 5, phone_call: 5, car_found: 5, silas_story: 5, mill_entered: 5,
  ledger_page: 10, register: 10, button: 10, file: 10, accusation: 10, harrow_freed: 10, arrest: 10,
};
/** STORY §11 ranks. */
const RANKS = [[100, 'Chief Inspector'], [80, 'Inspector'], [60, 'Detective Sergeant'], [40, 'Detective Constable'], [20, 'Constable'], [0, 'Probationer']];
const rankFor = (score) => RANKS.find(([min]) => score >= min)[1];

describe('STORY §11 scoring sanity (the yardstick these suites use)', () => {
  test('13 awards summing to 100, as content declares them', () => {
    assert.equal(Object.values(AWARDS).reduce((a, b) => a + b, 0), 100);
    assert.equal(content.scoring.maxScore, 100);
    for (const [id, pts] of Object.entries(AWARDS)) {
      const a = content.scoring.awards[id];
      assert.ok(a, `award ${id} exists`);
      assert.equal(a.points ?? a, pts, id);
    }
  });
});

describe('STORY §12.1 reference walkthrough, row by row', () => {
  test('the table and the plain list agree: 91 rows, same commands', () => {
    assert.equal(WALKTHROUGH.length, 91);
    assert.equal(WALKTHROUGH_TABLE.length, 91);
    WALKTHROUGH_TABLE.forEach((row, i) => {
      assert.equal(row.n, i + 1);
      assert.equal(row.command.toLowerCase(), WALKTHROUGH[i], `row ${row.n}`);
    });
  });

  test('every row: room after, turn = row number, running score', () => {
    const g = fresh();
    for (const [i, row] of WALKTHROUGH_TABLE.entries()) {
      const ev = g.input(WALKTHROUGH[i]);
      const s = snap(g);
      const where = `#${row.n} ${row.command}`;
      assert.equal(s.turn, row.n, `${where}: turn`);
      assert.equal(s.roomId, row.room, `${where}: room`);
      assert.equal(s.score, row.score, `${where}: score`);
      if (row.n < 91) assertRunning(g, where);
      else assert.ok(endOf(ev), 'row 91 ends the game');
    }
  });

  test('notes and evidence appear on the rows the table names', () => {
    const g = fresh();
    // row -> [note ids that must exist after it, evidence count after it]
    const expectNotes = { 8: ['hq_call'], 18: ['case_map'], 19: ['harrow_list'], 23: ['pike_patrol'], 35: ['mary_pike'], 45: ['silas_story'], 56: ['praying'], 70: ['notebook'], 84: ['morgue_drawer'] };
    const expectEvidence = { 29: 1, 35: 2, 55: 3, 83: 4 };
    let ev = 0;
    for (const [i, line] of WALKTHROUGH.entries()) {
      g.input(line);
      const s = snap(g);
      const n = i + 1;
      for (const id of expectNotes[n] ?? []) assert.ok(s.notes.includes(id), `#${n}: note ${id}`);
      if (expectEvidence[n] !== undefined) ev = expectEvidence[n];
      assert.equal(evidenceCount(s), ev, `#${n}: evidence count`);
    }
  });

  test('state checkpoints from the table (money, flags, Pike, the counter)', () => {
    const g = fresh();
    const at = (k) => { feed(g, WALKTHROUGH.slice(snap(g).turn, k)); return snap(g); };
    let s = at(8);
    assert.equal(s.items.coin.loc, null, '#8 coin used');
    assert.ok(s.flags.phoned);
    s = at(13);
    assert.ok(s.flags.torch_loaded);
    assert.equal(s.items.torch.lit, true, '#13 torch lit');
    s = at(15);
    assert.equal(s.money, 300, '#15 money 500 -> 300');
    assert.equal(s.items.whisky.loc, 'player');
    s = at(45);
    assert.ok(s.flags.silas_told && s.flags.shed_open, '#45');
    assert.equal(s.items.whisky.loc, 'silas');
    s = at(52);
    assert.ok(s.flags.mill_chain_cut, '#52');
    s = at(64);
    assert.equal(s.vars.pikeState, 'fled', '#64');
    assert.equal(s.vars.pikeArrivalTurn, 68, '#64 arrival turn 63+5 = 68');
    assert.equal(s.npcs.pike.loc, null);
    s = at(67);
    assert.equal(s.vars.pikeState, 'fled', '#67 not yet');
    s = at(68);
    assert.equal(s.vars.pikeState, 'counting', '#68 Pike reaches the Counting Room this turn');
    assert.equal(s.npcs.pike.loc, 'counting_room');
    s = at(69);
    assert.equal(s.items.handcuffs.loc, 'player', '#69 TAKE ALL');
    assert.equal(s.items.notebook_page.loc, 'player');
    s = at(87);
    assert.ok(s.flags.morgue_hatch_found, '#87');
    s = at(89);
    assert.equal(s.vars.attack, 1, '#89 greeting; attack 1');
    s = at(90);
    assert.equal(s.vars.pikeState, 'restrained', '#90');
    assert.equal(s.vars.attack, 1, '#90 counter stops');
  });

  test('wins: victory, 100/100, Chief Inspector, turn 91, 22:15, good music', () => {
    const { g, ev } = run(WALKTHROUGH);
    const end = assertEnding(g, ev, 'victory', 91);
    assert.equal(end.score, 100);
    assert.equal(end.maxScore, 100);
    assert.equal(end.rank, 'Chief Inspector');
    assert.equal(end.music, 'ending_good');
    assert.match(end.text, /^You get Frank to his feet between you/);
    assert.match(end.text, /The mill comes down in December\./);
    assert.equal(statusOf(ev).time, '22:15');
    const s = snap(g);
    assert.deepEqual([...s.awarded].sort(), Object.keys(AWARDS).sort(), 'all 13 awards');
    assert.ok(300 - s.turn >= 70, 'PLAN §4: >= 70 turns of slack');
  });

  test('nerve never exceeds ~20 on this route (STORY §12.1 note)', () => {
    const g = fresh();
    let max = snap(g).nerve;
    for (const line of WALKTHROUGH) {
      g.input(line);
      max = Math.max(max, snap(g).nerve);
    }
    assert.ok(max <= 25, `max nerve ${max}`);
  });
});

describe('STORY §12.2 boiler-room route', () => {
  test('the parsed variant replaces #84-91 with 19 commands', () => {
    assert.equal(BOILER_ROUTE.length, 19);
    assert.deepEqual(BOILER_ROUTE.map((r) => r.n), Array.from({ length: 19 }, (_, i) => 84 + i));
  });

  test('every row lands in the room STORY names; victory 100/100 at turn 102', () => {
    const g = fresh();
    feed(g, WALKTHROUGH.slice(0, 83));
    let ev = [];
    for (const row of BOILER_ROUTE) {
      ev = g.input(row.command);
      const s = snap(g);
      assert.equal(s.turn, row.n, `#${row.n} ${row.command}`);
      if (row.room) assert.equal(s.roomId, row.room, `#${row.n} ${row.command}`);
      if (row.n < 102) assertRunning(g, `#${row.n}`);
    }
    const s = snap(g);
    assert.ok(s.flags.hatch_oiled);
    assert.equal(s.items.boiler_hatch.open, true);
    const end = assertEnding(g, ev, 'victory', 102);
    assert.equal(end.score, 100);
    assert.equal(end.rank, 'Chief Inspector');
    assert.equal(300 - 102, 198, 'STORY: 198 turns of slack');
  });

  test('the drawer route is never touched on the boiler route', () => {
    const { g } = run([...WALKTHROUGH.slice(0, 83), ...BOILER_ROUTE.map((r) => r.command)]);
    assert.equal(snap(g).flags.morgue_hatch_found, undefined);
    assert.ok(!snap(g).visited.includes('morgue'));
  });
});

describe('STORY §12.3 other outcomes', () => {
  test('free-then-cuff victory at turn 91, 100/100', () => {
    const { g, ev: ev90 } = run([...WALKTHROUGH.slice(0, 89), 'cut chains']);
    assert.equal(snap(g).vars.attack, 2, 'attack 2');
    assert.match(joined(ev90), /He circles, knife low\./);
    assert.equal(snap(g).vars.harrowFreed, true);
    const ev = g.input('arrest pike');
    const end = assertEnding(g, ev, 'victory', 91);
    assert.equal(end.score, 100);
    assert.equal(snap(g).vars.attack, 2, 'arrest succeeds before D4 makes it 3');
  });

  test('pyrrhic: turn 300, score 90, bleed beats every 20 turns', () => {
    const { g, ev, all } = run([...WALKTHROUGH.slice(0, 90), ...times(210, 'wait')]);
    const end = assertEnding(g, ev, 'pyrrhic', 300);
    assert.equal(end.score, 90);
    assert.equal(end.rank, rankFor(90));
    assert.equal(end.music, 'ending_bad');
    assert.match(end.text, /Frank Harrow stopped breathing/);
    const bleeds = texts(all).filter((t) => /^Harrow's breathing is shallower now\.$|^Harrow coughs, and there is something wet in it\.|^The stain at Harrow's side has reached the floor\.$/.test(t));
    assert.ok(bleeds.length >= 10, `bleed beats every 20 turns over 210 turns (${bleeds.length})`);
  });

  test('the one that got away: turn 300, score 90, counter paused at 2', () => {
    const { g, ev } = run([...WALKTHROUGH.slice(0, 89), 'cut chains', 's', ...times(209, 'wait')]);
    const end = assertEnding(g, ev, 'got_away', 300);
    assert.equal(end.score, 90);
    assert.equal(snap(g).vars.attack, 2);
    assert.equal(snap(g).roomId, 'tunnel');
    assert.match(end.text, /someone cuts four fresh strokes into the tally stone/);
  });

  test('fifth stroke (never accused): Pike leaves at 240, arrives 250; default text', () => {
    const g = fresh();
    feed(g, times(239, 'wait'));
    assert.equal(snap(g).vars.pikeState, 'desk');
    feed(g, ['wait']);
    assert.equal(snap(g).vars.pikeState, 'left');
    feed(g, times(9, 'wait'));
    assert.equal(snap(g).vars.pikeState, 'left', 'turn 249');
    feed(g, ['wait']);
    assert.equal(snap(g).vars.pikeState, 'counting', 'turn 250 = 23:35');
    const ev = feed(g, times(50, 'wait'));
    const end = assertEnding(g, ev, 'fifth_stroke', 300);
    assert.match(end.text, /PC Arthur Pike leads the search himself\./);
    assert.doesNotMatch(end.text, /You told them who it was/);
  });

  test('fifth stroke (accused): accusation variant, score 65', () => {
    const { g, ev } = run([...WALKTHROUGH.slice(0, 64), ...times(236, 'wait')]);
    const end = assertEnding(g, ev, 'fifth_stroke', 300);
    assert.equal(end.score, 65);
    assert.match(end.text, /You told them who it was; you just didn't get there\./);
  });

  for (const [who, lines, turn, re] of [
    ['Maggie', ['n', 'n', 'w', 'accuse maggie', 'y'], 4, /"Margaret Pollard, I am arresting you\.\.\."/],
    ['Ashdown', ['n', 'n', 'n', 'ne', 'n', 'accuse ashdown', 'y'], 6, /"Clement Ashdown, I am arresting you\.\.\."/],
    ['Silas', ['n', 'e', 'd', 'e', 'n', 'accuse silas', 'y'], 6, /"Silas Thorne, I am arresting you\.\.\."/],
  ]) {
    test(`wrong man - ${who}: confirmation is free, YES ends on turn ${turn}`, () => {
      const g = fresh();
      feed(g, lines.slice(0, -2));
      const ev1 = g.input(lines.at(-2));
      assert.ok(ev1.some((e) => e.type === 'prompt' && e.text === 'Are you certain? (Y/N)'));
      assert.equal(snap(g).turn, turn - 1, 'the question is free');
      const ev = g.input('y');
      const end = assertEnding(g, ev, 'wrong_man', turn);
      assert.match(end.text, re);
    });
  }

  test('accusation cancelled: "(You hold your tongue.)", turn stays 3', () => {
    const { g, ev } = run(['n', 'n', 'w', 'accuse maggie', 'n']);
    assert.deepEqual(texts(ev), ['(You hold your tongue.)']);
    assert.equal(snap(g).turn, 3);
    assertRunning(g);
  });

  test('weak accusation: laugh text, nerve 3 -> 17, turn 4, game continues', () => {
    const { g, ev } = run(['n', 'n', 'e', 'accuse pike']);
    assert.match(joined(ev), /Pike laughs - a big easy laugh with nothing behind it\./);
    assert.equal(snap(g).nerve, 17);
    assert.equal(snap(g).turn, 4);
    assert.equal(snap(g).vars.pikeState, 'desk');
    assertRunning(g);
  });

  test('accuse absent: "Accuse who? They\'re not here." on the platform, turn 0', () => {
    const { g, ev } = run(['accuse pike']);
    assert.deepEqual(texts(ev), ["Accuse who? They're not here."]);
    assert.equal(snap(g).turn, 0);
  });

  test('death - drowning: swim warns (turn 5), swim kills (turn 6); UNDO keeps the warning', () => {
    const { g, ev: warn } = run(['n', 'e', 'd', 'e', 'swim']);
    assert.match(joined(warn), /If you went in there you would not come out\./);
    assert.equal(snap(g).turn, 5);
    assertRunning(g);
    const ev = g.input('swim');
    const end = assertEnding(g, ev, 'death_drown', 6);
    assert.match(end.text, /^You go into the lock\./);
    g.input('undo');
    assert.equal(snap(g).turn, 5);
    assert.ok(snap(g).warned.includes('lock'));
    assertEnding(g, g.input('swim'), 'death_drown', 6);
  });

  for (const verb of ['enter lock', 'jump', 'enter']) {
    test(`death - drowning shares one warning: swim, then "${verb}"`, () => {
      const { g } = run(['n', 'e', 'd', 'e', 'swim']);
      assertEnding(g, g.input(verb), 'death_drown', 6);
    });
    test(`death - drowning: "${verb}" warns first, then swim kills`, () => {
      const { g, ev } = run(['n', 'e', 'd', 'e', verb]);
      assert.match(joined(ev), /^You stand at the edge of the lock/);
      assertRunning(g);
      assertEnding(g, g.input('swim'), 'death_drown', 6);
    });
  }

  test('death - quarry: d warns on turn 7, d kills on turn 8', () => {
    const { g, ev } = run(['n', 'n', 'n', 'n', 'n', 'e', 'd']);
    assert.match(joined(ev), /Without a rope you would never make it down alive\./);
    assert.equal(snap(g).turn, 7);
    assert.equal(snap(g).roomId, 'quarry_edge');
    const end = assertEnding(g, g.input('d'), 'death_fall', 8);
    assert.match(end.text, /I was told\./);
  });

  test('quarry with rope: arrive at quarry_floor safely; u returns', () => {
    const { g } = run(['n', 'n', 'n', 'n', 'n', 'e', 'in', 'take rope', 'out', 'd']);
    assert.equal(snap(g).roomId, 'quarry_floor');
    assertRunning(g);
    g.input('u');
    assert.equal(snap(g).roomId, 'quarry_edge');
  });

  test('death - Pike (lit): 90 "He circles", 91 "Three", 92 lunge (+20 nerve), 93 death', () => {
    const g = fresh();
    feed(g, WALKTHROUGH.slice(0, 89));
    let n = snap(g).nerve;
    assert.match(joined(g.input('wait')), /He circles, knife low\./);
    assert.match(joined(g.input('wait')), /"Three," says Pike/);
    n = snap(g).nerve;
    assert.match(joined(g.input('wait')), /He lunges\./);
    assert.ok(snap(g).nerve >= Math.min(99, n + 20), 'lunge: nerve +20 (+3 room), capped at 99');
    const ev = g.input('wait');
    const end = assertEnding(g, ev, 'death_pike', 93);
    assert.ok(ev.some((e) => e.type === 'sfx' && e.id === 'scream'));
    assert.match(end.text, /^"Five," says Pike/);
  });

  test('death - Pike (dark): TURN OFF refused with warning (attack 2), second TURN OFF fatal at 91', () => {
    const g = fresh();
    feed(g, WALKTHROUGH.slice(0, 89));
    const t = joined(g.input('turn off torch'));
    assert.match(t, /Switch off your only light/);
    assert.match(t, /He circles, knife low\./);
    assert.equal(snap(g).vars.attack, 2);
    assert.equal(snap(g).items.torch.lit, true);
    const ev = g.input('turn off torch');
    const end = assertEnding(g, ev, 'death_pike', 91);
    assert.match(end.text, /^In the dark the counting comes from everywhere at once\./);
  });

  test('arrest without cuffs: "With what?..." costs 1 turn, counter ticks', () => {
    const g = fresh();
    feed(g, [...WALKTHROUGH.slice(0, 88), 'drop handcuffs', 'n']);
    const ev = g.input('arrest pike');
    assert.equal(texts(ev)[0], "With what? Harrow croaks: 'Cuffs - in my car!'");
    assert.equal(snap(g).vars.attack, 2);
    assert.equal(snap(g).vars.pikeState, 'counting');
  });

  test('panic (town): nerve 7 in the unlit crypt at turn 6, 16 waits -> Market Square, nerve 50, cooldown 15', () => {
    const { g } = run(['n', 'n', 'n', 'ne', 'n', 'd']);
    assert.equal(snap(g).roomId, 'crypt');
    assert.equal(snap(g).nerve, 7);
    let panicked = -1;
    for (let i = 1; i <= 16; i++) {
      const ev = g.input('wait');
      if (snap(g).roomId === 'market_square') { panicked = i; assert.ok(ev.some((e) => e.type === 'sfx' && e.id === 'sting')); break; }
    }
    assert.equal(panicked, 16, '+6/turn from 7 reaches 100 on the 16th wait');
    assert.equal(snap(g).nerve, 50);
    assert.equal(snap(g).panicCooldown, 15);
  });

  test('after every death / ending UNDO, RESTART and LOAD are offered; other input is refused', () => {
    const { g } = run(['n', 'e', 'd', 'e', 'swim', 'swim']);
    assert.ok(snap(g).ended);
    const t = joined(g.input('look'));
    assert.match(t, /UNDO/);
    assert.match(t, /RESTART/);
    assert.match(t, /LOAD/);
    const ev = g.input('restart');
    assert.equal(snap(g).turn, 0);
    assert.equal(snap(g).ended, null);
    assert.ok(ev.length > 0);
  });

  test('every ending in content.endings is covered by a script above', () => {
    assert.deepEqual(content.endings.map((e) => e.id),
      ['victory', 'pyrrhic', 'got_away', 'fifth_stroke', 'wrong_man', 'death_drown', 'death_fall', 'death_pike']);
  });
});
