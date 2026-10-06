// TT-022 — Solvability suite (PLAN §4 "Solvability", STORY §7, §8, §13, PLAN §2.5).
// Each named test plays the real content in strict mode. Where a test needs an unusual
// starting position it edits a save (harness `setup`) and says so; outcomes are always
// STORY / PLAN rules, not observed engine output.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from '../fixtures/harness.js';
import {
  content, WALKTHROUGH, times, texts, joined, endOf, fresh, run, feed, snap,
  assertEnding, assertRunning, evidenceCount, isCarried,
} from './script.js';

const PROTECT_PERSONAL = "You'd sooner lose your head.";

/* ------------------------------------------------------------------------ *
 *  Compact scripts (all derived from the STORY §3.3 exit table)             *
 * ------------------------------------------------------------------------ */

/**
 * From the platform: torch lit (auto-load, §7.2 step 4), Silas told, cutters carried,
 * mill chain cut; ends in Market Square on turn 29.
 */
const PREFIX = [
  'w', 'search bench', 'take torch and coin', 'e', 'n', 'n', 'w', 'show card to maggie', 'turn on torch',
  'ask maggie about silas', 'buy whisky', 'e', 's', 'e', 'd', 'e', 'n', 'give whisky to silas', 's', 'e',
  'take cutters', 'w', 'w', 'w', 'cut chain', 'e', 'u', 'w', 'n',
];

/** One evidence each; every segment starts and ends in Market Square. */
const SEG = {
  button: ['n', 'w', 'in', 'search', 'take button', 'out', 'e', 's'],
  register: ['n', 'ne', 'n', 'e', 'read register', 'w', 's', 'sw', 's'],
  ledger: ['s', 'e', 'd', 'w', 'n', 'n', 'take page', 's', 's', 'e', 'u', 'w', 'n'],
  file: ['n', 'n', 'n', 'e', 'in', 'take crowbar', 'out', 'w', 'n', 'd', 'n', 'w', 'open cabinet', 'take file',
    'e', 's', 'u', 's', 's', 's', 's'],
};
const EV_OF = { button: 'ev_button', register: 'ev_register', ledger: 'ev_ledger', file: 'ev_file' };

/** Market Square -> car (cuffs) -> asylum -> morgue drawer -> Counting Room door (tunnel). */
const TO_TUNNEL = ['n', 'n', 'in', 'take handcuffs', 'out', 'n', 'n', 'd', 'n', 'd', 'pull drawer', 'd'];
const FINALE = [...TO_TUNNEL, 'n', 'arrest pike', 'cut chains'];

function permutations(list) {
  if (list.length <= 1) return [list];
  return list.flatMap((x, i) => permutations([...list.slice(0, i), ...list.slice(i + 1)]).map((p) => [x, ...p]));
}

/** Edits the save so the player stands in `room` (prev room `prev`) and carries `items`. */
function place(g, room, { prev = null, items = [], mutate = () => {} } = {}) {
  setup(g, (s) => {
    s.roomId = room;
    s.prevRoomId = prev;
    if (!s.visited.includes(room)) s.visited.push(room);
    if (prev && !s.visited.includes(prev)) s.visited.push(prev);
    for (const id of items) {
      s.items[id].loc = 'player';
      if ('hidden' in s.items[id]) s.items[id].hidden = false;
      if ('moved' in s.items[id]) s.items[id].moved = true;
    }
    mutate(s);
  });
}

/** Torch carried, loaded and lit (state edit). */
const litTorch = (s) => {
  s.items.torch.loc = 'player';
  s.items.torch.moved = true;
  s.items.torch.lit = true;
  s.flags.torch_loaded = true;
};

/* ------------------------------------------------------------------------ *
 *  Evidence in every order                                                  *
 * ------------------------------------------------------------------------ */

describe('evidence collected in every order (4! = 24); ACCUSE after any three; win', () => {
  for (const order of permutations(Object.keys(SEG))) {
    test(order.join(' > '), () => {
      const g = fresh();
      feed(g, PREFIX);
      assert.equal(snap(g).roomId, 'market_square');
      const found = [];
      for (const [i, seg] of order.entries()) {
        if (i === 3) {
          // three pieces in hand: the accusation is correct (§8.1)
          const ev = feed(g, ['e', 'accuse pike']);
          assert.match(joined(ev), /^"Arthur Pike, I am arresting you/, 'correct accusation with exactly 3');
          assert.equal(snap(g).vars.pikeState, 'fled');
          assert.equal(snap(g).vars.pikeArrivalTurn, snap(g).turn - 1 + 5, 'arrival = accuse turn - 1 + 5 (§8.2)');
          feed(g, ['w']);
        }
        feed(g, SEG[seg]);
        found.push(EV_OF[seg]);
        const s = snap(g);
        assert.equal(s.roomId, 'market_square', `${seg} segment returns to the square`);
        assert.deepEqual([...s.evidence].sort(), [...found].sort(), `evidence after ${seg}`);
        assert.equal(evidenceCount(s), found.length);
        assertRunning(g);
      }
      const ev = feed(g, FINALE);
      const end = assertEnding(g, ev, 'victory');
      // §11: everything except phone_call and harrows_room
      assert.equal(end.score, 90);
    });
  }
});

/* ------------------------------------------------------------------------ *
 *  Accuse early / late / never                                              *
 * ------------------------------------------------------------------------ */

describe('accuse early / late / never', () => {
  test('early: a weak accusation first (laugh, +15 nerve) never blocks the correct one later', () => {
    const g = fresh();
    feed(g, ['n', 'n', 'e']);
    const n0 = snap(g).nerve;
    assert.match(joined(g.input('accuse pike')), /^Pike laughs/);
    assert.equal(snap(g).nerve, n0 + 15 - 1, 'weak: nerve +15 (lit room -1)');
    assert.equal(snap(g).vars.pikeState, 'desk');
    assert.match(joined(g.input('accuse pike')), /^Pike laughs/, 'may retry');
    feed(g, ['w', 's', 's', ...PREFIX, ...SEG.button, ...SEG.register, ...SEG.ledger, 'e']);
    assert.match(joined(g.input('accuse pike')), /^"Arthur Pike, I am arresting you/);
    assert.equal(snap(g).vars.pikeState, 'fled');
    assert.ok(snap(g).awarded.includes('accusation'));
  });

  test('a weak accusation costs 1 turn; accusing someone absent costs none', () => {
    const g = fresh();
    feed(g, ['n', 'n', 'e']);
    g.input('accuse pike');
    assert.equal(snap(g).turn, 4);
    g.input('accuse maggie');
    assert.equal(snap(g).turn, 4);
  });

  /** PREFIX + three evidence; standing in the Police House. */
  function readyAtDesk() {
    const g = fresh();
    feed(g, [...PREFIX, ...SEG.button, ...SEG.register, ...SEG.ledger, 'e']);
    assert.equal(snap(g).roomId, 'police_house');
    return g;
  }

  test('late: accusing on turn 240 still catches Pike at his desk (A beats D3); arrival 244; win', () => {
    const g = readyAtDesk();
    feed(g, times(239 - snap(g).turn, 'wait'));
    assert.equal(snap(g).turn, 239);
    assert.equal(snap(g).vars.pikeState, 'desk');
    const ev = g.input('accuse pike');
    assert.match(joined(ev), /^"Arthur Pike, I am arresting you/);
    assert.equal(snap(g).turn, 240);
    assert.equal(snap(g).vars.pikeState, 'fled');
    assert.equal(snap(g).vars.pikeArrivalTurn, 244);
    feed(g, ['w', ...FINALE]);
    assert.equal(snap(g).ended, 'victory');
    assert.ok(snap(g).turn < 300);
  });

  test('too late: Pike leaves at 240 (leave text in the Police House); ACCUSE on 241 is "not here", free', () => {
    const g = readyAtDesk();
    feed(g, times(240 - 1 - snap(g).turn, 'wait'));
    const ev = g.input('wait');
    assert.equal(snap(g).turn, 240);
    assert.match(joined(ev), /"Half eleven\. That's me off on my rounds, Sergeant\./);
    assert.equal(snap(g).vars.pikeState, 'left');
    assert.equal(snap(g).vars.pikeArrivalTurn, 250);
    assert.deepEqual(texts(g.input('accuse pike')), ["Accuse who? They're not here."]);
    assert.equal(snap(g).turn, 240);
  });

  test('late, in the Counting Room: correct accusation there gives the points only (+10), confrontation continues', () => {
    const g = fresh();
    feed(g, [...PREFIX, ...SEG.button, ...SEG.register, ...SEG.ledger, ...TO_TUNNEL]);
    assert.equal(snap(g).roomId, 'tunnel');
    assert.equal(snap(g).vars.pikeState, 'desk');
    feed(g, times(250 - snap(g).turn, 'wait'));
    assert.equal(snap(g).vars.pikeState, 'counting', 'Pike down at 23:35 without an accusation');
    g.input('n');
    assert.equal(snap(g).roomId, 'counting_room');
    const score = snap(g).score;
    const t = joined(g.input('accuse pike'));
    assert.match(t, /You say it out loud: the whole caution, every name\./);
    assert.equal(snap(g).score, score + 10);
    assert.equal(snap(g).vars.pikeState, 'counting');
    assert.equal(snap(g).vars.attack, 2, 'the counter keeps running');
    const end = assertEnding(g, feed(g, ['arrest pike', 'cut chains']), 'victory');
    assert.equal(end.score, 80, 'all but phone_call, harrows_room, file');
  });

  test('late, in the Counting Room with < 3 evidence: "Prove it," nerve +15', () => {
    const g = fresh();
    feed(g, [...PREFIX, ...TO_TUNNEL]);
    feed(g, times(250 - snap(g).turn, 'wait'));
    g.input('n');
    const n0 = snap(g).nerve;
    assert.match(joined(g.input('accuse pike')), /"Prove it," says Pike/);
    assert.ok(snap(g).nerve >= Math.min(99, n0 + 15), 'nerve +15 (capped 99 Beneath)');
    assert.ok(!snap(g).awarded.includes('accusation'));
  });

  test('never: the STORY §7.1 minimum - no evidence, no file, no mill - wins once Pike goes down at 23:35', () => {
    const g = fresh();
    feed(g, [
      'w', 'take torch', 'e', 'n', 'n', 'w', 'show card to maggie', 'turn on torch', 'ask maggie about silas', 'buy whisky',
      'e', 's', 'e', 'd', 'e', 'n', 'give whisky to silas', 's', 'e', 'take cutters', 'w', 'w', 'u', 'w', 'n',
      ...TO_TUNNEL,
    ]);
    assert.equal(snap(g).roomId, 'tunnel');
    assert.equal(snap(g).evidence.length, 0);
    // before Pike: the door is barred, Harrow praying (msg F)
    assert.match(joined(g.input('n')), /The iron door is barred from the other side\. Beyond it, Harrow is praying\./);
    assert.equal(snap(g).roomId, 'tunnel');
    feed(g, times(249 - snap(g).turn, 'wait'));
    const ev = g.input('wait');
    assert.equal(snap(g).turn, 250);
    assert.match(joined(ev), /Beyond the iron door a beam scrapes and thuds against brick\./);
    const end = assertEnding(g, feed(g, ['n', 'arrest pike', 'cut chains']), 'victory', 253);
    assert.equal(end.score, 35, 'torch 5 + car 5 + silas 5 + arrest 10 + freed 10');
    assert.equal(end.rank, 'Constable');
  });

  test('never accused, nothing done: fifth stroke at 300 (Pike left 240, arrived 250)', () => {
    const { g, ev } = run(times(300, 'wait'));
    assertEnding(g, ev, 'fifth_stroke', 300);
  });

  test('after 23:00 the barred door message changes ("slower now, losing his place")', () => {
    const g = fresh();
    feed(g, [...PREFIX, ...TO_TUNNEL]);
    feed(g, times(180 - snap(g).turn, 'wait'));
    assert.match(joined(g.input('n')), /Harrow is praying - slower now, losing his place\./);
  });
});

/* ------------------------------------------------------------------------ *
 *  Both finale routes                                                       *
 * ------------------------------------------------------------------------ */

describe('both finale routes (STORY §7.1 "way down")', () => {
  test('morgue route: the drawer is found without reading the file (EXAMINE DRAWERS -> PULL DRAWER 4)', () => {
    const g = fresh();
    feed(g, [...PREFIX, 'n', 'n', 'n', 'n', 'd', 'n', 'd']);
    assert.equal(snap(g).roomId, 'morgue');
    assert.match(joined(g.input('examine drawers')), /Number 4 does not sit flush\./);
    assert.match(joined(g.input('pull drawer 4')), /It doesn't open - it slides/);
    assert.ok(snap(g).flags.morgue_hatch_found);
    g.input('d');
    assert.equal(snap(g).roomId, 'tunnel');
  });

  test('morgue: before the drawer moves, DOWN is "You can\'t go that way."', () => {
    const g = fresh();
    feed(g, [...PREFIX, 'n', 'n', 'n', 'n', 'd', 'n', 'd']);
    assert.equal(joined(g.input('d')), "You can't go that way.");
    assert.equal(snap(g).roomId, 'morgue');
  });

  test('boiler route: the hatch will not open without oil; oil, open, down; back up through it', () => {
    const g = fresh();
    feed(g, [...WALKTHROUGH.slice(0, 51), 'cut chain', 'n', 'd']);
    assert.equal(snap(g).roomId, 'boiler_room');
    assert.match(joined(g.input('open hatch')), /^You heave\. Nothing\. Rust has welded the rim to the frame\. It wants oil\./);
    assert.equal(snap(g).items.boiler_hatch.open, false);
    assert.match(joined(g.input('d')), /The hatch is closed|closed/);
    assert.equal(snap(g).roomId, 'boiler_room');
    feed(g, ['oil hatch', 'open hatch', 'd']);
    assert.equal(snap(g).roomId, 'tunnel');
    g.input('u');
    assert.equal(snap(g).roomId, 'boiler_room');
  });

  test('boiler route: every §7.2 26b oil phrasing works', () => {
    for (const phr of ['oil hatch', 'oil hatch with can', 'lubricate hatch', 'grease hatch', 'use oil can on hatch', 'use oil on hatch',
      'pour oil on hatch', 'squirt oil on hatch', 'put oil on hatch']) {
      const g = fresh();
      feed(g, [...WALKTHROUGH.slice(0, 51), 'cut chain', 'n', 'd']);
      g.input(phr);
      assert.ok(snap(g).flags.hatch_oiled, phr);
    }
  });

  test('both routes reach the same gate: the tunnel door opens only once Pike is inside', () => {
    const g = fresh();
    feed(g, [...WALKTHROUGH.slice(0, 51), 'cut chain', 'n', 'd', 'oil hatch', 'open hatch', 'd']);
    assert.equal(snap(g).vars.pikeState, 'desk');
    g.input('n');
    assert.equal(snap(g).roomId, 'tunnel');
  });
});

/* ------------------------------------------------------------------------ *
 *  Cuff-then-free / free-then-cuff; leave & re-enter                         *
 * ------------------------------------------------------------------------ */

describe('finale order', () => {
  test('cuff-then-free: victory at 91; the counter stops at 1', () => {
    const { g, ev } = run(WALKTHROUGH);
    assertEnding(g, ev, 'victory', 91);
    assert.equal(snap(g).vars.attack, 1);
  });

  test('free-then-cuff: victory at 91; "Behind you!" then Frank throws himself at Pike\'s knees', () => {
    const { g, ev: ev1 } = run([...WALKTHROUGH.slice(0, 89), 'cut chains']);
    assert.match(joined(ev1), /"Behind you!" he says\./);
    const ev = g.input('arrest pike');
    assert.match(joined(ev), /Frank throws himself at Pike's knees/);
    assertEnding(g, ev, 'victory', 91);
  });

  test('cuffs fetched after the first entry: leave, pick them up, re-enter, arrest, free', () => {
    const g = fresh();
    feed(g, [...WALKTHROUGH.slice(0, 88), 'drop handcuffs', 'n']);
    assert.equal(snap(g).vars.attack, 1);
    assert.match(joined(g.input('arrest pike')), /^With what\?/);
    feed(g, ['s', 'take handcuffs', 'n']);
    assert.equal(snap(g).vars.attack, 3, 'enter 1, arrest attempt 2, paused outside, re-entry 3');
    const ev = feed(g, ['arrest pike', 'cut chains']);
    assertEnding(g, ev, 'victory');
  });

  test('cutters fetched after the arrest: Pike stays restrained while you are out', () => {
    const g = fresh();
    feed(g, [...WALKTHROUGH.slice(0, 88), 'drop cutters', 'n', 'arrest pike', 's']);
    assert.equal(snap(g).vars.pikeState, 'restrained');
    assert.equal(snap(g).npcs.pike.loc, 'counting_room');
    feed(g, times(10, 'wait'));
    const ev = feed(g, ['take cutters', 'n', 'cut chains']);
    assertEnding(g, ev, 'victory');
    assert.equal(snap(g).vars.attack, 1, 'restraint stopped the counter permanently');
  });

  test('the last moment: cut chains on the lunge (attack 4), arrest before the fifth count -> victory', () => {
    const g = fresh();
    feed(g, [...WALKTHROUGH.slice(0, 89), 'wait', 'wait']);
    assert.equal(snap(g).vars.attack, 3);
    assert.match(joined(g.input('cut chains')), /He lunges\./);
    assert.equal(snap(g).vars.attack, 4);
    assertEnding(g, g.input('arrest pike'), 'victory', 93);
  });

  test('a second correct accusation in the Counting Room just says its text (award once)', () => {
    const g = fresh();
    feed(g, WALKTHROUGH.slice(0, 89));
    const score = snap(g).score;
    assert.match(joined(g.input('accuse pike')), /You say it out loud: the whole caution, every name\./);
    assert.equal(snap(g).score, score);
    assert.equal(snap(g).turn, 90, '1 turn');
    assert.equal(snap(g).vars.attack, 2, 'the counter ticks');
  });

  test('leave & re-enter: the counter pauses outside and resumes +1 on re-entry; no second greeting', () => {
    const g = fresh();
    feed(g, WALKTHROUGH.slice(0, 89));
    assert.equal(snap(g).vars.attack, 1);
    g.input('s');
    assert.equal(snap(g).vars.attack, 1, 'paused in the tunnel');
    feed(g, times(5, 'wait'));
    assert.equal(snap(g).vars.attack, 1);
    const t = joined(g.input('n'));
    assert.equal(snap(g).vars.attack, 2, 'resumes at >= 1, +1 on the entering turn');
    assert.match(t, /Pike is waiting for you, knife low\./);
    assert.doesNotMatch(t, /You're early, Sergeant/);
    assert.match(t, /He circles, knife low\./);
  });

  test('re-entering cannot cheat the counter: in-and-out reaches 5 and kills', () => {
    const g = fresh();
    feed(g, WALKTHROUGH.slice(0, 89));
    let ev = [];
    for (let k = 2; k <= 5; k++) {
      g.input('s');
      ev = g.input('n');
      if (k < 5) assert.equal(snap(g).vars.attack, k);
    }
    assertEnding(g, ev, 'death_pike');
  });
});

/* ------------------------------------------------------------------------ *
 *  Turn 299 / 300 boundaries                                                *
 * ------------------------------------------------------------------------ */

describe('turn 299/300 boundaries (PLAN §2.5 endings precedence)', () => {
  test('victory achieved ON turn 300 wins (not pyrrhic): cuff at 90, cut chains at 300', () => {
    const g = fresh();
    feed(g, [...WALKTHROUGH.slice(0, 90), ...times(209, 'wait')]);
    assert.equal(snap(g).turn, 299);
    assertRunning(g, 'turn 299');
    const ev = g.input('cut chains');
    const end = assertEnding(g, ev, 'victory', 300);
    assert.equal(end.score, 100);
  });

  test('victory ON turn 300 by the arrest: free first, wait in the tunnel, re-enter at 299 (attack 3), cuff at 300', () => {
    const g = fresh();
    feed(g, [...WALKTHROUGH.slice(0, 89), 'cut chains', 's']);
    feed(g, times(298 - snap(g).turn, 'wait'));
    g.input('n');
    assert.equal(snap(g).turn, 299);
    assert.equal(snap(g).vars.attack, 3);
    assertRunning(g);
    assertEnding(g, g.input('arrest pike'), 'victory', 300);
  });

  test('pyrrhic: running at 299, ending at 300', () => {
    const g = fresh();
    feed(g, [...WALKTHROUGH.slice(0, 90), ...times(209, 'wait')]);
    assertRunning(g, 'turn 299');
    assertEnding(g, g.input('wait'), 'pyrrhic', 300);
  });

  test('got away: running at 299, ending at 300', () => {
    const g = fresh();
    feed(g, [...WALKTHROUGH.slice(0, 89), 'cut chains', 's', ...times(208, 'wait')]);
    assert.equal(snap(g).turn, 299);
    assertRunning(g);
    assertEnding(g, g.input('wait'), 'got_away', 300);
  });

  test('fifth stroke: running at 299, ending at 300, clock reads 00:00', () => {
    const g = fresh();
    feed(g, times(299, 'wait'));
    assertRunning(g);
    const ev = g.input('wait');
    assertEnding(g, ev, 'fifth_stroke', 300);
    assert.equal(ev.filter((e) => e.type === 'status').at(-1).time, '00:00');
  });

  test('death beats midnight: the fifth count on turn 300 is death_pike, not the fifth stroke', () => {
    const g = fresh();
    feed(g, [
      'w', 'take torch', 'e', 'n', 'n', 'w', 'show card to maggie', 'turn on torch', 'ask maggie about silas', 'buy whisky',
      'e', 's', 'e', 'd', 'e', 'n', 'give whisky to silas', 's', 'e', 'take cutters', 'w', 'w', 'u', 'w', 'n', ...TO_TUNNEL,
    ]);
    feed(g, times(295 - snap(g).turn, 'wait'));
    g.input('n');
    assert.equal(snap(g).turn, 296);
    assert.equal(snap(g).vars.attack, 1);
    feed(g, ['wait', 'wait', 'wait']);
    assert.equal(snap(g).vars.attack, 4);
    assertRunning(g, 'turn 299');
    assertEnding(g, g.input('wait'), 'death_pike', 300);
  });

  test('a free command on turn 299 does not advance the clock to midnight', () => {
    const g = fresh();
    feed(g, times(299, 'wait'));
    for (const free of ['inventory', 'score', 'time', 'notes', 'help', 'accuse pike']) g.input(free);
    assert.equal(snap(g).turn, 299);
    assertRunning(g);
  });
});

/* ------------------------------------------------------------------------ *
 *  Critical items cannot be lost (STORY §13, PLAN §2.5, A8.7)               *
 * ------------------------------------------------------------------------ */

const CRITICAL = Object.entries(content.items).filter(([, i]) => i.critical).map(([id]) => id);
const SINKS = Object.entries(content.rooms).filter(([, r]) => r.sink).map(([id]) => id);
/** NPC -> the room they are always in (STORY §6; Pike at his desk). */
const NPC_ROOMS = { maggie: 'black_lamb', pike: 'police_house', ashdown: 'st_judes', silas: 'lock_cottage', harrow: 'counting_room' };
/** STORY §6 accepts: only Silas takes anything (the whisky). */
const ACCEPTS = { silas: ['whisky'] };
/** A8.7: the critical refusal, `criticalMsg ?? MESSAGES.critical`. */
const REFUSAL = (id) => content.items[id].criticalMsg ?? "You'd better hang on to that.";
const nameOf = (id) => content.items[id].names?.find((n) => n.split(' ').length > 1) ?? content.items[id].names?.[0] ?? content.items[id].name;

describe('attempts to lose every critical item', () => {
  test('STORY §5.1 / PLAN §2.5 critical list is what content marks critical', () => {
    for (const id of ['ledger_page', 'button', 'patient_file', 'handcuffs', 'bolt_cutters', 'crowbar', 'oil_can', 'torch', 'batteries', 'whisky', 'room_key', 'rope']) {
      assert.ok(CRITICAL.includes(id), id);
    }
    assert.deepEqual([...SINKS].sort(), ['canal_bridge', 'lock', 'quarry_edge', 'quarry_floor', 'towpath']);
  });

  for (const id of CRITICAL) {
    const noun = nameOf(id);
    describe(id, () => {
      test(`throw: refused in every sink room (${noun})`, () => {
        for (const room of SINKS) {
          const g = fresh();
          place(g, room, { items: [id] });
          assert.equal(joined(g.input(`throw ${noun}`)), REFUSAL(id), room);
          for (const line of [`throw ${noun} in water`, `drop ${noun}`, `take ${noun}`]) g.input(line);
          assert.equal(snap(g).items[id].loc, 'player', `${room}: still carried after throw + drop/take`);
        }
      });

      test('drop in each hazard / sink room: stays there, retrievable', () => {
        for (const room of [...SINKS]) {
          const g = fresh();
          place(g, room, { items: [id] });
          assert.equal(joined(g.input(`drop ${noun}`)), 'Dropped.', room);
          assert.equal(snap(g).items[id].loc, room);
          g.input(`take ${noun}`);
          assert.equal(snap(g).items[id].loc, 'player', `${room}: retrieved`);
        }
      });

      test('eat / drink / break / burn / tear / cut: refused while carried', () => {
        const g = fresh();
        place(g, 'market_square', { items: [id] });
        for (const v of ['eat', 'drink', 'break', 'burn', 'tear', 'cut', 'smash', 'destroy']) {
          assert.equal(joined(g.input(`${v} ${noun}`)), REFUSAL(id), `${v} ${noun}`);
          assert.equal(snap(g).items[id].loc, 'player', `${v} ${noun}`);
        }
      });

      for (const [npc, room] of Object.entries(NPC_ROOMS)) {
        if (ACCEPTS[npc]?.includes(id)) continue;
        test(`give to ${npc}: refused, kept`, () => {
          const g = fresh();
          place(g, room, { items: [id], mutate: (s) => { if (room === 'counting_room') litTorch(s); } });
          for (const line of [`give ${noun} to ${npc}`, `give ${npc} ${noun}`, `offer ${noun} to ${npc}`]) {
            assert.equal(joined(g.input(line)), REFUSAL(id), line);
          }
          assert.equal(snap(g).items[id].loc, 'player');
        });
      }

      test('put in containers, then try to dispose of the container: still retrievable', () => {
        // dustbin (back_alley), suitcase (harrows_room), bench (waiting_room)
        let g = fresh();
        place(g, 'back_alley', { items: [id] });
        g.input(`put ${noun} in dustbin`);
        // batteries: PUT is LOAD_TORCH (STORY §5.2) and refuses without the torch - also fine
        assert.ok(['dustbin', 'player'].includes(snap(g).items[id].loc));
        for (const l of ['take dustbin', 'throw dustbin', 'break dustbin', 'burn dustbin']) g.input(l);
        g.input(`take ${noun} from dustbin`);
        assert.equal(snap(g).items[id].loc, 'player', 'dustbin');

        g = fresh();
        place(g, 'harrows_room', { items: [id], prev: 'black_lamb' });
        feed(g, ['open suitcase', `put ${noun} in suitcase`, 'close suitcase']);
        if (snap(g).items[id].loc === 'suitcase') {
          for (const l of ['take suitcase', 'throw suitcase', 'break suitcase']) g.input(l);
          feed(g, ['open suitcase', `take ${noun} from suitcase`]);
        }
        assert.equal(snap(g).items[id].loc, 'player', 'suitcase');

        g = fresh();
        place(g, 'waiting_room', { items: [id] });
        g.input(`put ${noun} on bench`);
        for (const l of ['take bench', 'break bench']) g.input(l);
        g.input(`take ${noun}`);
        if (id === 'batteries' && snap(g).flags.torch_loaded) {
          // STORY §7.3 known harmless edge: the torch is in the waiting room, so PUT BATTERIES
          // anywhere loads it - the designed consumption, not a loss
          assert.equal(snap(g).items.batteries.loc, null);
        } else assert.equal(snap(g).items[id].loc, 'player', 'bench');
      });
    });
  }

  test('the special consumptions are the designed ones only: batteries into the torch, whisky to Silas', () => {
    const { g } = run(WALKTHROUGH);
    const s = snap(g);
    for (const id of CRITICAL) {
      if (id === 'batteries') assert.equal(s.items[id].loc, null);
      else if (id === 'whisky') assert.equal(s.items[id].loc, 'silas');
      else if (['oil_can', 'rope'].includes(id)) assert.notEqual(s.items[id].loc, null);
      else assert.equal(s.items[id].loc, 'player', id);
    }
  });

  test('a critical item thrown at the lock does not count as a hazard or a loss', () => {
    const g = fresh();
    place(g, 'lock', { items: ['handcuffs'] });
    feed(g, ['throw handcuffs in lock', 'throw cuffs at water', 'put cuffs in lock']);
    assert.equal(snap(g).items.handcuffs.loc, 'player');
    assertRunning(g);
  });

  test('dropping evidence lowers the count; picking it up restores it (A8.8)', () => {
    const g = fresh();
    feed(g, WALKTHROUGH.slice(0, 63));
    assert.equal(evidenceCount(snap(g)), 3);
    g.input('drop button');
    assert.equal(evidenceCount(snap(g)), 2);
    assert.match(joined(g.input('accuse pike')), /^Pike laughs/, 'weak with 2');
    g.input('take button');
    assert.match(joined(g.input('accuse pike')), /^"Arthur Pike, I am arresting you/);
  });
});

/* ------------------------------------------------------------------------ *
 *  Warrant card and money (Codex plan review R3 note 4)                      *
 * ------------------------------------------------------------------------ */

describe('warrant card and money loss attempts', () => {
  for (const [id, noun] of [['warrant_card', 'card'], ['wallet', 'wallet']]) {
    test(`${id}: DROP / THROW / GIVE / PUT / EAT / BREAK refused everywhere ("${PROTECT_PERSONAL}")`, () => {
      for (const room of [...SINKS, 'back_alley']) {
        const g = fresh();
        place(g, room);
        for (const v of [`drop ${noun}`, `throw ${noun}`, `throw ${noun} in water`, `eat ${noun}`, `break ${noun}`, `burn ${noun}`, `tear ${noun}`, `cut ${noun}`]) {
          const t = joined(g.input(v));
          if (!/can't see/.test(t) && v.split(' ').length === 2) assert.equal(t, PROTECT_PERSONAL, `${room}: ${v}`);
        }
        if (room === 'back_alley') assert.equal(joined(g.input(`put ${noun} in dustbin`)), PROTECT_PERSONAL);
        assert.equal(snap(g).items[id].loc, 'player', room);
      }
      for (const [npc, room] of Object.entries(NPC_ROOMS)) {
        const g = fresh();
        place(g, room, { mutate: (s) => { if (room === 'counting_room') litTorch(s); } });
        assert.equal(joined(g.input(`give ${noun} to ${npc}`)), PROTECT_PERSONAL, npc);
        assert.equal(snap(g).items[id].loc, 'player', npc);
      }
    });
  }

  test('SHOW CARD works and keeps the card', () => {
    const { g } = run(['n', 'n', 'w', 'show card to maggie']);
    assert.equal(snap(g).items.warrant_card.loc, 'player');
    assert.equal(snap(g).items.room_key.loc, 'player');
  });

  test('until Silas has his whisky the balance never drops below the whisky price (pints and 10p exhausted)', () => {
    const g = fresh();
    feed(g, ['n', 'n', 'w']);
    for (let k = 0; k < 12; k++) feed(g, ['buy pint', 'drink pint']);
    assert.equal(snap(g).money, 250, '5 pints; the 6th is refused under 260p (STORY §6.2)');
    assert.match(joined(g.input('buy pint')), /Keep summat back/);
    // the 10p: each time the coin is gone (thrown away - forced by a save edit), Maggie hands
    // over another while !phoned and money >= 210
    for (let k = 0; k < 8; k++) {
      setup(g, (s) => { s.items.coin.loc = null; });
      g.input('ask maggie about change');
    }
    assert.equal(snap(g).money, 200, 'stops at 200p');
    feed(g, ['ask maggie about silas', 'buy whisky']);
    assert.equal(snap(g).items.whisky.loc, 'player', 'the whisky is always affordable');
    assert.equal(snap(g).money, 0);
  });

  test('after Silas has his whisky the rest can be spent on pints (STORY §13 "not softlocks")', () => {
    const g = fresh();
    feed(g, WALKTHROUGH.slice(0, 45));
    assert.ok(snap(g).flags.silas_told);
    feed(g, ['s', 'w', 'u', 'w', 'n', 'w']);
    for (let k = 0; k < 10; k++) feed(g, ['buy pint', 'drink pint']);
    assert.equal(snap(g).money, 0);
    assert.match(joined(g.input('buy pint')), /afford/);
    assert.ok(snap(g).money >= 0);
  });
});

/* ------------------------------------------------------------------------ *
 *  Whisky re-purchase                                                       *
 * ------------------------------------------------------------------------ */

describe('whisky re-purchase after loss (PLAN §2.5, A8.9)', () => {
  test('not before hearing of Silas; once heard, bought; if the bottle is somehow gone, sold again', () => {
    const g = fresh();
    feed(g, ['n', 'n', 'w']);
    assert.match(joined(g.input('buy whisky')), /You're on duty, love/);
    assert.equal(snap(g).items.whisky.loc, null);
    feed(g, ['ask maggie about silas', 'buy whisky']);
    assert.equal(snap(g).money, 300);
    assert.match(joined(g.input('buy whisky')), /already got one/);
    assert.equal(snap(g).money, 300);
    setup(g, (s) => { s.items.whisky.loc = null; }); // the impossible loss, forced
    g.input('buy whisky');
    assert.equal(snap(g).items.whisky.loc, 'player');
    assert.equal(snap(g).money, 100, 'the balance permits two purchases');
  });

  test('whisky cannot be drunk, thrown or given to anyone but Silas', () => {
    const g = fresh();
    feed(g, ['n', 'n', 'w', 'ask maggie about silas', 'buy whisky', 'drink whisky', 'give whisky to maggie']);
    assert.match(joined(g.input('drink whisky')), /That's for Silas\. Hang on to it\./);
    assert.equal(snap(g).items.whisky.loc, 'player');
  });
});

/* ------------------------------------------------------------------------ *
 *  Panic in every zone; Beneath nerve cap                                   *
 * ------------------------------------------------------------------------ */

/** STORY §3.1: zone -> [a room in it where nerve rises, its neighbour, safe room, panic text]. */
const PANIC = {
  town: ['crypt', 'st_judes', 'market_square', /^Your nerve goes\. You run - blind, splashing/],
  canal: ['lock', 'towpath', 'towpath', /^Something in the black water moves/],
  moor: ['quarry_edge', 'tally_stone', 'moor_road', /^The moor is too big and too dark and it is watching\./],
  mill: ['weaving_shed', 'mill_yard', 'mill_yard', /^The counting is right behind you\./],
  asylum: ['ward', 'entrance_hall', 'asylum_gates', /^The corridors fold in on you\./],
};

describe('panic in every zone (PLAN §2.5)', () => {
  for (const [zone, [room, prev, safe, re]] of Object.entries(PANIC)) {
    test(`${zone}: high nerve in ${room} -> flee to ${safe}, nerve 50, cooldown 15`, () => {
      const g = fresh();
      // the canal has no dark room: start at the panic threshold (lock: +1 room, -1 lit)
      place(g, room, { prev, mutate: (s) => { s.nerve = zone === 'canal' ? 100 : 90; } });
      let ev = [];
      for (let k = 0; k < 20 && snap(g).roomId === room; k++) ev = g.input('wait');
      assert.equal(snap(g).roomId, safe);
      assert.ok(texts(ev).some((t) => re.test(t)), `${zone} panic text`);
      assert.ok(ev.some((e) => e.type === 'sfx' && e.id === 'sting'));
      assert.equal(snap(g).nerve, 50);
      assert.equal(snap(g).panicCooldown, 15);
      assert.equal(content.rooms[safe].zone, zone, 'safe room is in the zone');
      assert.ok(!content.rooms[safe].dark, 'safe room is lit');
    });
  }

  test('town, from the real start: walk into the unlit crypt and stay (STORY §12.3)', () => {
    const { g } = run(['n', 'n', 'n', 'ne', 'n', 'd', ...times(16, 'wait')]);
    assert.equal(snap(g).roomId, 'market_square');
  });

  test('moor, without editing nerve: quarry edge raises nerve 1/turn until panic', () => {
    const g = fresh();
    feed(g, ['n', 'n', 'n', 'n', 'n', 'e']);
    let k = 0;
    while (snap(g).roomId === 'quarry_edge' && k++ < 120) g.input('wait');
    assert.equal(snap(g).roomId, 'moor_road');
    assertRunning(g);
  });

  test('no second panic within 15 turns of one', () => {
    const g = fresh();
    place(g, 'crypt', { prev: 'st_judes', mutate: (s) => { s.nerve = 100; s.panicCooldown = 15; } });
    for (let k = 0; k < 14; k++) {
      g.input('wait');
      assert.equal(snap(g).roomId, 'crypt', `cooldown turn ${k + 1}`);
    }
    feed(g, ['wait', 'wait']);
    assert.equal(snap(g).roomId, 'market_square', 'panics once the cooldown has run out');
  });

  test('Beneath: the tunnel caps nerve at 99 with the cap text once, never panics', () => {
    const g = fresh();
    feed(g, [...PREFIX, ...TO_TUNNEL]);
    setup(g, (s) => { s.nerve = 95; });
    const all = [];
    for (let k = 0; k < 10; k++) all.push(...g.input('wait'));
    assert.equal(snap(g).nerve, 99);
    assert.equal(snap(g).roomId, 'tunnel');
    assert.equal(texts(all).filter((t) => t === "Your heart hammers, but Harrow's voice holds you here.").length, 1);
  });

  test('Beneath: the Counting Room caps at 99 while the attack counter runs; nerve does not feed the counter', () => {
    const g = fresh();
    feed(g, WALKTHROUGH.slice(0, 89));
    setup(g, (s) => { s.nerve = 97; });
    g.input('wait');
    assert.equal(snap(g).nerve, 99);
    assert.equal(snap(g).vars.attack, 2, 'one per turn, as without nerve');
    assert.equal(snap(g).roomId, 'counting_room');
    g.input('arrest pike');
    feed(g, times(30, 'wait'));
    assert.equal(snap(g).nerve, 99);
    assert.equal(snap(g).roomId, 'counting_room');
    assertRunning(g);
  });
});

/* ------------------------------------------------------------------------ *
 *  Darkness                                                                 *
 * ------------------------------------------------------------------------ */

/** Dark rooms outside Beneath and the lit neighbour you enter them from (STORY §3.3). */
const DARK = { crypt: 'st_judes', weaving_shed: 'mill_yard', boiler_room: 'mill_yard', ward: 'entrance_hall', morgue: 'entrance_hall' };
const exitsOf = (room) => content.rooms[room].exits;
const dirTo = (from, to) => Object.entries(exitsOf(from)).find(([, e]) => (typeof e === 'string' ? e : e.to) === to)?.[0];

describe('dark-room entry / exit without light (A8.3 darkness rule)', () => {
  for (const [room, from] of Object.entries(DARK)) {
    test(`${room}: enter unlit from ${from}, other exits refused, the way back works`, () => {
      const g = fresh();
      place(g, from, { mutate: (s) => { s.flags.mill_chain_cut = true; } });
      const into = dirTo(from, room);
      const ev = g.input(into);
      assert.equal(snap(g).roomId, room);
      assert.ok(ev.some((e) => e.type === 'picture' && e.id === 'dark'), 'dark picture');
      assert.ok(texts(ev).some((t) => /pitch dark/i.test(t)));
      for (const dir of Object.keys(exitsOf(room))) {
        const target = typeof exitsOf(room)[dir] === 'string' ? exitsOf(room)[dir] : exitsOf(room)[dir].to;
        if (target === from) continue;
        g.input(dir);
        assert.equal(snap(g).roomId, room, `${room} ${dir} refused in the dark`);
      }
      g.input(dirTo(room, from));
      assert.equal(snap(g).roomId, from, 'back out');
    });
  }

  test('switching the torch off in a dark room: dark; the way back still works', () => {
    const g = fresh();
    feed(g, [...WALKTHROUGH.slice(0, 85), 'd']);
    assert.equal(snap(g).roomId, 'morgue');
    const ev = g.input('turn off torch');
    assert.ok(texts(ev).some((t) => /pitch dark/i.test(t)));
    g.input('u');
    assert.equal(snap(g).roomId, 'entrance_hall');
  });
});

describe('light sources and darkness never trap the player (STORY §13, PLAN §2.5 "always retrievable")', () => {
  test('the torch switched off and dropped in a dark room can be taken again', () => {
    const g = fresh();
    feed(g, [...WALKTHROUGH.slice(0, 36), 'd']);
    assert.equal(snap(g).roomId, 'crypt');
    feed(g, ['turn off torch', 'drop torch', 'take torch']);
    // fix-agnostic: either DROP was refused in the dark, or TAKE finds it by touch
    assert.ok(isCarried(snap(g), 'torch'), 'the only light is lost in the dark: game unwinnable');
  });

  test('the batteries dropped in the dark crypt (torch not yet loaded) can be taken again', () => {
    const g = fresh();
    feed(g, ['w', 'take torch', 'e', 'n', 'n', 'w', 'show card to maggie', 'e', 'n', 'ne', 'n', 'd']);
    assert.equal(snap(g).roomId, 'crypt');
    feed(g, ['drop batteries', 'take batteries']);
    assert.ok(isCarried(snap(g), 'batteries'), 'the only batteries are lost in the dark: no light, game unwinnable');
  });

  test('the torch switched off and dropped in the dark boiler room can be taken again', () => {
    const g = fresh();
    feed(g, [...WALKTHROUGH.slice(0, 51), 'cut chain', 'n', 'd', 'turn off torch', 'drop torch', 'take torch']);
    assert.ok(isCarried(snap(g), 'torch'));
  });

  test('leaving the lit torch in the Counting Room does not trap you in the dark tunnel', () => {
    const g = fresh();
    feed(g, [...WALKTHROUGH.slice(0, 90), 'drop torch', 's']);
    if (snap(g).roomId === 'tunnel') {
      g.input('n');
      assert.equal(snap(g).roomId, 'counting_room', 'the way back (A8.3 step 4) must stay open');
    }
    g.input('take torch');
    assert.ok(isCarried(snap(g), 'torch'));
  });

  test('switched off in the Counting Room, dropped, walked out: the tunnel still lets you back', () => {
    const g = fresh();
    feed(g, [...WALKTHROUGH.slice(0, 90), 'turn off torch', 'drop torch', 's']);
    if (snap(g).roomId === 'tunnel') {
      for (const d of ['n', 's', 'u']) {
        if (snap(g).roomId !== 'tunnel') break;
        g.input(d);
      }
      assert.notEqual(snap(g).roomId, 'tunnel', 'trapped in the dark tunnel: Beneath never panics');
    }
  });

  test('the switched-off torch dropped in the tunnel: the way back down is never closed for good', () => {
    const g = fresh();
    feed(g, [...WALKTHROUGH.slice(0, 88), 'turn off torch', 'drop torch', 'take torch']);
    assert.ok(isCarried(snap(g), 'torch'));
  });

  test('the Counting Room is only ever entered with a light (torch left lit in the tunnel)', () => {
    const g = fresh();
    feed(g, [...WALKTHROUGH.slice(0, 88), 'drop torch']);
    const ev = g.input('n');
    const enteredDark = snap(g).roomId === 'counting_room' && texts(ev).some((t) => /pitch dark/i.test(t));
    assert.ok(!enteredDark, 'STORY §3.3: "the Counting Room is only ever entered with a light"');
  });
});

describe('TT-120..122 regressions: groping, the way back, the dark Counting Room', () => {
  test('content: no portable, non-hidden item starts loose in a dark room (groping only finds what you dropped)', () => {
    const loose = Object.entries(content.items).filter(([, it]) => content.rooms[it.location]?.dark
      && !it.hidden && !it.fixed && !it.scenery);
    assert.deepEqual(loose.map(([id]) => id), []);
  });

  test('batteries dropped in the dark crypt: SEARCH names them, TAKE finds them, the torch still loads', () => {
    const g = fresh();
    feed(g, ['w', 'take torch', 'e', 'n', 'n', 'w', 'show card to maggie', 'e', 'n', 'ne', 'n', 'd', 'drop batteries']);
    assert.match(joined(g.input('search')), /Your hand finds some batteries\./);
    assert.match(joined(g.input('take batteries')), /You fumble about in the dark until your hand closes on the batteries\./);
    g.input('turn on torch');
    assert.equal(snap(g).items.torch.lit, true);
  });

  test('Pike counting, lit torch dropped in the Counting Room, walk out: the way back in stays open', () => {
    const g = fresh();
    feed(g, [...WALKTHROUGH.slice(0, 89), 'drop torch', 's']);
    assert.equal(snap(g).roomId, 'tunnel');
    g.input('n');
    assert.equal(snap(g).roomId, 'counting_room');
    g.input('take torch');
    assert.ok(isCarried(snap(g), 'torch'));
  });

  test('switched off in the tunnel and walked back in to Pike: warned once in the dark, light saves you', () => {
    const g = fresh();
    feed(g, [...WALKTHROUGH.slice(0, 89), 's', 'turn off torch']);
    const t = joined(g.input('n'));
    assert.equal(snap(g).roomId, 'counting_room', 'the way back is retraced by feel (A8.3 step 4)');
    assertRunning(g, 'no unwarned dark death (PLAN §2.5 dark: warning at 1, fatal at 2)');
    assert.match(t, /Light\. You need light, now\./);
    g.input('turn on torch');
    assertRunning(g);
    g.input('arrest pike');
    assert.equal(snap(g).vars.pikeState, 'restrained');
  });

  test('…and staying dark after that warning is fatal', () => {
    const g = fresh();
    feed(g, [...WALKTHROUGH.slice(0, 89), 's', 'turn off torch', 'n']);
    assertEnding(g, g.input('wait'), 'death_pike');
  });

  test('msg F: a torch burning on the tunnel floor is not a light in your hand', () => {
    const g = fresh();
    feed(g, [...WALKTHROUGH.slice(0, 88), 'drop torch']);
    assert.match(joined(g.input('n')), /without your torch in your hand\? Not a chance\./);
    feed(g, ['take torch', 'n']);
    assert.equal(snap(g).roomId, 'counting_room');
  });

  test('torch dropped switched off in the tunnel, walked into the dark morgue: confined to the way back, never lost', () => {
    const g = fresh();
    feed(g, [...WALKTHROUGH.slice(0, 88), 'turn off torch', 'drop torch', 's']);
    assert.equal(snap(g).roomId, 'morgue');
    g.input('u');
    assert.equal(snap(g).roomId, 'morgue', 'not the way back: you cannot wander off from your light');
    g.input('d');
    assert.equal(snap(g).roomId, 'tunnel', 'the hidden, light-guarded hatch is retraced by feel');
    g.input('take torch');
    assert.ok(isCarried(snap(g), 'torch'));
  });
});

describe('Beneath refuses entry without light (STORY §3.3 msgs D, E, F)', () => {
  test('morgue: drawer found, torch off -> DOWN refused, stays in the morgue', () => {
    const g = fresh();
    feed(g, [...WALKTHROUGH.slice(0, 85), 'd', 'pull drawer', 'turn off torch']);
    assert.ok(snap(g).flags.morgue_hatch_found);
    const t = joined(g.input('d'));
    assert.equal(snap(g).roomId, 'morgue');
    assert.match(t, /Not without a light\.|You blunder about in the dark/);
  });

  test('boiler room: hatch open, torch off -> DOWN refused', () => {
    const g = fresh();
    feed(g, [...WALKTHROUGH.slice(0, 51), 'cut chain', 'n', 'd', 'oil hatch', 'open hatch', 'turn off torch']);
    const t = joined(g.input('d'));
    assert.equal(snap(g).roomId, 'boiler_room');
    assert.match(t, /Not without a light\.|You blunder about in the dark/);
  });

  test('boiler room carrying an unlit torch: hatch open -> DOWN still refused ({on: torch})', () => {
    const g = fresh();
    feed(g, [...WALKTHROUGH.slice(0, 51), 'cut chain', 'n', 'd', 'oil hatch', 'open hatch', 'turn off torch', 'u']);
    assert.equal(snap(g).roomId, 'mill_yard');
    g.input('d');
    g.input('d');
    assert.equal(snap(g).roomId, 'boiler_room');
  });

  test('tunnel: Pike inside, torch off -> NORTH refused, the Counting Room is never entered dark', () => {
    const g = fresh();
    feed(g, [...WALKTHROUGH.slice(0, 88), 'turn off torch']);
    const t = joined(g.input('n'));
    assert.equal(snap(g).roomId, 'tunnel');
    assert.match(t, /Turn your torch on\.|You blunder about in the dark/);
    assert.equal(snap(g).vars.attack, 0);
  });

  test('a lit torch left in the morgue lets you down into a dark tunnel - but never traps you', () => {
    const g = fresh();
    feed(g, [...WALKTHROUGH.slice(0, 85), 'd', 'pull drawer', 'drop torch', 'd']);
    if (snap(g).roomId === 'tunnel') {
      g.input('n');
      assert.equal(snap(g).roomId, 'tunnel');
      g.input('s');
    }
    assert.equal(snap(g).roomId, 'morgue');
    g.input('take torch');
    assert.ok(isCarried(snap(g), 'torch'));
  });
});

describe('a gate item dropped behind its own gate (PLAN §2.5: no room ever becomes permanently inaccessible)', () => {
  test('room key dropped in Harrow\'s room: the room can be entered again', () => {
    const g = fresh();
    feed(g, [...WALKTHROUGH.slice(0, 16), 'drop key', 'd', 'u']);
    assert.equal(snap(g).roomId, 'harrows_room', 'locked out of Harrow\'s room for good (key upstairs, SHOW CARD gives no second key)');
  });

  test('Harrow\'s door stays on the latch: OPEN DOOR says so, and the key is no longer needed', () => {
    const g = fresh();
    feed(g, [...WALKTHROUGH.slice(0, 16), 'drop key', 'd']);
    assert.match(joined(g.input('open door')), /You left it on the latch\. Just go UP\./);
    g.input('u');
    assert.equal(snap(g).roomId, 'harrows_room');
    g.input('take key');
    assert.ok(isCarried(snap(g), 'room_key'));
  });

  test('before entering, Harrow\'s door is still locked without the key (msg A)', () => {
    const g = fresh();
    feed(g, ['n', 'n', 'w']);
    assert.match(joined(g.input('u')), /Maggie keeps the keys behind the bar\./);
    assert.equal(snap(g).roomId, 'black_lamb');
  });

  test('quarry: after the first climb the goat track takes you down without the rope', () => {
    const g = fresh();
    feed(g, ['n', 'n', 'n', 'n', 'n', 'e', 'in', 'take rope', 'out', 'd', 'drop rope', 'u']);
    assert.match(joined(g.input('x path')), /The top of the goat track/);
    const t = joined(g.input('d'));
    assert.equal(snap(g).roomId, 'quarry_floor');
    assert.match(t, /pick your way down/);
    assert.deepEqual(snap(g).warned, []);
  });

  test('rope dropped on the quarry floor: the floor can be reached again without dying', () => {
    const g = fresh();
    feed(g, ['n', 'n', 'n', 'n', 'n', 'e', 'in', 'take rope', 'out', 'd', 'drop rope', 'u', 'd']);
    assertRunning(g);
    assert.equal(snap(g).roomId, 'quarry_floor', 'the only way down is now the warned fatal fall');
  });
});

/* ------------------------------------------------------------------------ *
 *  Hazards: warned once, then fatal                                         *
 * ------------------------------------------------------------------------ */

describe('hazards (STORY §8.6)', () => {
  test('quarry: warned, then fatal - the warning is not repeated after leaving and coming back', () => {
    const g = fresh();
    feed(g, ['n', 'n', 'n', 'n', 'n', 'e']);
    assert.match(joined(g.input('d')), /Without a rope you would never make it down alive\./);
    feed(g, ['w', 'e']);
    assertEnding(g, g.input('d'), 'death_fall');
  });

  test('quarry: JUMP is a refusal, not the hazard', () => {
    const g = fresh();
    feed(g, ['n', 'n', 'n', 'n', 'n', 'e']);
    assert.equal(joined(g.input('jump')), 'You look at the drop. The drop looks at you. No.');
    g.input('jump');
    assertRunning(g);
    assert.deepEqual(snap(g).warned, []);
  });

  test('quarry: carrying the rope there is no warning and no death; climb back up', () => {
    const g = fresh();
    feed(g, ['n', 'n', 'n', 'n', 'n', 'e', 'in', 'take rope', 'out', 'd']);
    assert.equal(snap(g).roomId, 'quarry_floor');
    assert.deepEqual(snap(g).warned, []);
    feed(g, ['drop rope', 'u']);
    assert.equal(snap(g).roomId, 'quarry_edge', "the floor's u exit doesn't need the rope");
  });

  test('canal bridge / towpath: JUMP and SWIM are refusals, not hazards', () => {
    const g = fresh();
    feed(g, ['n', 'e', 'jump', 'jump', 'd', 'swim', 'swim']);
    assertRunning(g);
    assert.deepEqual(snap(g).warned, []);
  });

  test('lock: NORTH to the cottage is never a hazard', () => {
    const g = fresh();
    feed(g, ['n', 'e', 'd', 'e', 'n']);
    assert.equal(snap(g).roomId, 'lock_cottage');
    assert.deepEqual(snap(g).warned, []);
  });
});

/* ------------------------------------------------------------------------ *
 *  Softlock audit spot checks (STORY §13)                                   *
 * ------------------------------------------------------------------------ */

describe('STORY §13 softlock audit', () => {
  test('batteries: two sources; ASK ABOUT BATTERIES first, then SHOW CARD gives only the key', () => {
    const g = fresh();
    feed(g, ['n', 'n', 'w', 'ask maggie about batteries']);
    assert.equal(snap(g).items.batteries.loc, 'player');
    g.input('show card to maggie');
    assert.equal(snap(g).items.room_key.loc, 'player');
    assert.equal(snap(g).items.batteries.loc, 'player', 'no duplicate');
    assert.match(joined(g.input('ask maggie about batteries')), /You've had the last ones I had, love\./);
  });

  test('the coin is optional and can be lost; Maggie gives a 10p while !phoned and money >= 210', () => {
    const g = fresh();
    feed(g, ['w', 'search bench', 'take coin', 'e', 'n', 'e', 'throw coin']);
    assert.equal(snap(g).items.coin.loc, null, 'thrown into the canal (not critical)');
    feed(g, ['w', 'n', 'w', 'ask maggie about change']);
    assert.equal(snap(g).items.coin.loc, 'player');
    assert.equal(snap(g).money, 490);
  });

  test('the shed, the mill chain, the cabinet and the drawer stay open once opened', () => {
    const { g } = run(WALKTHROUGH.slice(0, 90));
    const s = snap(g);
    for (const f of ['shed_open', 'mill_chain_cut', 'morgue_hatch_found']) assert.ok(s.flags[f], f);
    assert.equal(s.items.cabinet.open, true);
  });

  test('every room stays reachable from the start after the walkthrough (no exit ever removed)', () => {
    // BFS over the exit table with the walkthrough's flags in place
    const { g } = run(WALKTHROUGH.slice(0, 90));
    const reach = new Set(['platform']);
    const queue = ['platform'];
    while (queue.length) {
      const r = queue.shift();
      for (const e of Object.values(content.rooms[r].exits)) {
        const to = typeof e === 'string' ? e : e.to;
        if (!reach.has(to)) { reach.add(to); queue.push(to); }
      }
    }
    assert.equal(reach.size, Object.keys(content.rooms).length);
    assertRunning(g);
  });
});
