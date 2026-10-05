// TT-010 — per-turn daemons (ARCHITECTURE A7.6, A7.7, A8.2, A8.10, A8.11, A4.12–A4.14,
// A14 rules 6–12, PLAN §2.5): order of operations, clock, beats, schedules, story daemons
// (STORY §8.4's attack counter as data), light / fuel, nerve, panic, cap zones, ambience,
// endings precedence at the 299/300 boundary, scoring and status.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MIDNIGHT_TURN, RULE_DEFAULTS } from '../../src/engine/types.js';
import { DAEMON_STEPS as GAME_STEPS } from '../../src/engine/game.js';
import { DAEMON_STEPS, DAEMON_MESSAGES, runDaemons } from '../../src/engine/daemons.js';
import { lintContent } from '../../tools/lint-content.js';
import { hasGlyph } from '../../src/ui/font8x8.js';
import world, { TEXTS } from '../fixtures/daemon-world.js';
import a15 from '../fixtures/a15-world.js';
import {
  newGame, cloneContent, texts, types, last, play, setup,
} from '../fixtures/harness.js';

/* ------------------------------- helpers -------------------------------- */

/** Puts the player in `roomId` (visited), with `prev` as the room left. */
function place(s, roomId, prev = null) {
  s.roomId = roomId;
  s.prevRoomId = prev;
  if (!s.visited.includes(roomId)) s.visited.push(roomId);
}
const carry = (s, ...ids) => { for (const id of ids) s.items[id].loc = 'player'; };
const lightUp = (s, id) => { s.items[id].loc = 'player'; s.items[id].lit = true; };

/** A strict daemon-world game prepared by `mutate(state)`. */
function game(mutate = () => {}, content = world) {
  const g = newGame(content);
  g.start();
  setup(g, mutate);
  return g;
}

/** Player in the tunnel, torch lit, Pike counting in the Counting Room (STORY §8.2). */
const finale = (extra = () => {}) => game((s) => {
  place(s, 'tunnel', 'yard');
  lightUp(s, 'torch');
  s.npcs.pike.loc = 'counting_room';
  s.vars.pikeState = 'counting';
  extra(s);
});

const statusOf = (events) => events.filter((e) => e.type === 'status');
const ofType = (events, type) => events.filter((e) => e.type === type);
const idx = (events, pred) => events.findIndex(pred);
const textIdx = (events, s) => idx(events, (e) => e.type === 'text' && e.text === s);

/* -------------------------------- module -------------------------------- */

describe('daemons.js module (A1, A7.6)', () => {
  test('DAEMON_STEPS lists D1–D9 in pipeline order; game.js re-exports the same list', () => {
    assert.deepEqual(DAEMON_STEPS.map((s) => s.id.split(' ')[0]), ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9']);
    assert.deepEqual(DAEMON_STEPS.filter((s) => s.always).map((s) => s.id.split(' ')[0]), ['D1', 'D8', 'D9']);
    assert.equal(GAME_STEPS, DAEMON_STEPS);
    assert.equal(typeof runDaemons, 'function');
    assert.ok(Object.isFrozen(DAEMON_STEPS));
  });

  test('daemon messages are overridable defaults', () => {
    assert.equal(typeof DAEMON_MESSAGES.lightOut, 'string');
    assert.equal(typeof DAEMON_MESSAGES.panic, 'string');
  });

  test('the daemon-world fixture lints with zero errors and warnings, also in strict mode', () => {
    const r = lintContent(world, { hasGlyph, strict: true });
    assert.deepEqual([...r.errors, ...r.warnings], []);
  });
});

/* -------------------------- order of operations -------------------------- */

describe('order of operations (A7.6)', () => {
  /** Every step leaves a marker; see the fixture for the steps' own triggers. */
  function orderWorld() {
    const c = cloneContent(world);
    c.rooms.yard.nerve = 10;                      // safe −5 + 10 = +5 → crosses 50
    c.rules.nerve.start = 49;
    c.afterAction = [{ say: 'B' }];
    c.beats = [{ id: 'mark', every: 1, run: 'D2' }];
    c.npcs.pike.schedule = [{ at: 1, to: 'yard', arriveText: 'D3 arrive', do: { say: 'D3 do' } }];
    c.daemons = [
      { id: 'mark', run: { if: { at: ['pike', 'yard'] }, say: 'D4 sees the arrival', setFlag: 'order_done' } },
    ];
    c.endings = [{ id: 'order_end', kind: 'victory', title: 'Ordered', text: 'Done.', when: 'order_done' }, ...c.endings];
    return c;
  }

  test('A → B → D1 clock → D2 → D3 → D4 → D5 → D6 → D7 → D8 → D9 → end', () => {
    const g = game((s) => { s.items.lantern.loc = 'player'; s.items.lantern.lit = true; s.items.lantern.fuel = 1; }, orderWorld());
    const ev = g.input('s');
    const order = [
      idx(ev, (e) => e.type === 'room' && e.id === 'yard'),          // A: the move
      textIdx(ev, 'B'),                                                // B: afterAction
      textIdx(ev, 'D2'),
      textIdx(ev, 'D3 arrive'),
      textIdx(ev, 'D3 do'),
      textIdx(ev, 'D4 sees the arrival'),
      textIdx(ev, TEXTS.lanternOut),                                   // D5
      textIdx(ev, 'Your hands will not stop shaking.'),                // D6
      idx(ev, (e) => e.type === 'ambient'),                            // D7
      idx(ev, (e) => e.type === 'status'),                             // D9 (after D8)
      idx(ev, (e) => e.type === 'end'),
    ];
    assert.ok(order.every((i) => i >= 0), `missing marker: ${JSON.stringify(order)}`);
    assert.deepEqual([...order].sort((a, b) => a - b), order, JSON.stringify(ev, null, 1));
    assert.equal(ev.length - 1, order[order.length - 1], 'end is the last event');
    assert.deepEqual(ev.find((e) => e.type === 'ambient'), { type: 'ambient', id: 'drone' });
    const st = ev.find((e) => e.type === 'status');
    assert.equal(st.turns, 1, 'D1 ran before D9');
    assert.equal(st.nerve, 54);
    assert.equal(last(ev).ending, 'order_end');
  });

  test('when the action ends the game, B and D2–D7 are skipped; D1, D8, D9 still run (C10)', () => {
    const c = orderWorld();
    c.npcs.pike.before = { attack: { end: 'death_pike' } };
    const g = game((s) => { place(s, 'police_house'); s.items.lantern.loc = 'player'; s.items.lantern.lit = true; s.items.lantern.fuel = 1; }, c);
    const ev = g.input('attack pike');
    assert.deepEqual(texts(ev), []);
    assert.deepEqual(types(ev), ['status', 'end']);
    assert.equal(ev[0].turns, 1);
    assert.equal(ev[0].nerve, 49, 'D6 skipped');
    assert.equal(g.snapshot().items.lantern.fuel, 1, 'D5 skipped');
    assert.equal(last(ev).ending, 'death_pike');
  });

  test('free commands run no daemons and emit no status', () => {
    const g = game();
    const before = g.snapshot();
    const ev = g.input('inventory');
    assert.equal(statusOf(ev).length, 0);
    assert.equal(g.snapshot().turn, before.turn);
    assert.equal(g.snapshot().nerve, before.nerve);
  });

  test('each world command of a chain gets its own turn and its own status (O4)', () => {
    const g = game();
    const ev = g.input('wait. wait. wait');
    assert.deepEqual(statusOf(ev).map((s) => s.turns), [1, 2, 3]);
    assert.deepEqual(statusOf(ev).map((s) => s.time), ['21:30', '21:31', '21:31']);
  });
});

/* --------------------------------- clock --------------------------------- */

describe('D1 clock', () => {
  test('turn → time; midnight is turn 300 (00:00)', () => {
    const g = game((s) => { s.turn = 297; });
    const ev = g.input('wait. wait');
    assert.deepEqual(statusOf(ev).map((s) => [s.turns, s.time]), [[298, '23:59'], [299, '23:59']]);
    const end = g.input('wait');
    assert.deepEqual(statusOf(end).map((s) => [s.turns, s.time]), [[300, '00:00']]);
  });
});

/* --------------------------------- beats --------------------------------- */

describe('D2 scripted beats (A4.12)', () => {
  test('`at` beat fires on that turn only, sfx before its text', () => {
    const g = game((s) => { place(s, 'yard'); s.turn = 58; });
    assert.ok(!texts(g.input('wait')).includes(TEXTS.bell));
    const ev = g.input('wait');
    assert.ok(textIdx(ev, TEXTS.bell) > idx(ev, (e) => e.type === 'sfx' && e.id === 'bell'));
    assert.ok(!texts(g.input('wait')).includes(TEXTS.bell));
    assert.deepEqual(g.snapshot().fired, [], '`at` beats are not once-beats');
  });

  test('`at` + `when`: Pike glances at the clock at 210 only if present and at the desk', () => {
    const here = game((s) => { place(s, 'police_house'); s.turn = 209; });
    assert.ok(texts(here.input('wait')).includes(TEXTS.pikeClock));
    const away = game((s) => { place(s, 'yard'); s.turn = 209; });
    assert.ok(!texts(away.input('wait')).includes(TEXTS.pikeClock));
  });

  test('`every` + `when` with RNG: fires only on multiples, only where `when` holds, deterministically', () => {
    const thunder = ['Thunder rolls over the moor.', 'Lightning, far off. You count without meaning to.', 'The rain thickens.'];
    const run = (seed) => {
      const g = newGame(world, { seed });
      g.start();
      const hits = [];
      for (let i = 0; i < 40; i++) {
        const ev = g.input('wait');
        if (texts(ev).some((t) => thunder.includes(t))) hits.push(statusOf(ev)[0].turns);
      }
      return hits;
    };
    const hits = run(1);
    assert.ok(hits.length > 0 && hits.length < 10, `chance 0.5 over 10 eligible turns: ${hits}`);
    assert.ok(hits.every((t) => t % 4 === 0), `${hits}`);
    assert.deepEqual(run(1), hits, 'same seed, same beats');
    const seeds = [2, 3, 4, 5, 6].map(run);
    assert.ok(seeds.some((h) => JSON.stringify(h) !== JSON.stringify(hits)), 'other seeds differ');

    const mill = game((s) => place(s, 'yard'));
    for (let i = 0; i < 12; i++) assert.ok(!texts(mill.input('wait')).some((t) => thunder.includes(t)), 'not in the mill zone');
  });

  test('when-only beats are once by default and append their id to `fired` when they fire', () => {
    const g = game((s) => { place(s, 'lane', 'square'); s.turn = 4; s.nerve = 0; });
    const ev = g.input('wait');
    assert.ok(texts(ev).includes(TEXTS.fog));
    assert.deepEqual(g.snapshot().fired, ['fog_figure']);
    assert.equal(statusOf(ev)[0].nerve, 25, 'beat nerve +10 is included in D6 (+5 dark, +10 room)');
    assert.ok(!texts(g.input('wait')).includes(TEXTS.fog));
    assert.deepEqual(g.snapshot().fired, ['fog_figure']);
  });

  test('a once-beat that does not fire (chance) is not marked; `once` overrides the defaults', () => {
    const c = cloneContent(world);
    c.beats = [
      { id: 'never', when: { turnGte: 0 }, run: { chance: 0, say: 'never' } },
      { id: 'always', when: { turnGte: 0 }, once: false, run: 'always' },
      { id: 'once_every', every: 1, once: true, run: 'once every' },
    ];
    const g = game(() => {}, c);
    const t1 = texts(g.input('wait'));
    const t2 = texts(g.input('wait'));
    assert.ok(t1.includes('always') && t1.includes('once every') && !t1.includes('never'));
    assert.ok(t2.includes('always') && !t2.includes('once every'));
    assert.deepEqual(g.snapshot().fired, ['once_every']);
  });

  test('beats run in array order; a beat that ends the game stops later beats and D3–D7', () => {
    const c = cloneContent(world);
    c.beats = [
      { id: 'first', every: 1, run: 'first' },
      { id: 'fatal', every: 1, run: { say: 'fatal', end: 'death_pike' } },
      { id: 'later', every: 1, run: 'later' },
    ];
    c.daemons = [{ id: 'd4', run: 'D4' }];
    const g = game(() => {}, c);
    const ev = g.input('wait');
    const t = texts(ev);
    assert.ok(t.indexOf('first') < t.indexOf('fatal'));
    assert.ok(!t.includes('later') && !t.includes('D4'));
    assert.deepEqual(types(ev).slice(-2), ['status', 'end']);
  });

  test('beat, schedule and daemon hooks get their phase, the command and self', () => {
    const seen = [];
    const c = cloneContent(world);
    c.hooks = {
      spy: (api, args) => { seen.push([args.phase, args.cmd?.verb ?? null, args.self]); },
    };
    c.beats = [{ id: 'spy', at: 1, run: { hook: 'spy' } }];
    c.npcs.pike.schedule = [{ at: 1, to: 'square', do: { hook: 'spy' } }];
    c.daemons = [{ id: 'spy', run: { hook: 'spy' } }];
    const g = game(() => {}, c);
    g.input('wait');
    assert.deepEqual(seen, [['beat', 'wait', null], ['schedule', 'wait', 'pike'], ['daemon', 'wait', null]]);
  });
});

/* ------------------------------- schedules ------------------------------- */

describe('D3 NPC schedules (A14 rule 6, STORY §6.3)', () => {
  test('Pike leaves the Police House at 240 with leaveText; `do` sets left and the arrival turn', () => {
    const g = game((s) => { place(s, 'police_house'); s.turn = 239; });
    const ev = g.input('wait');
    assert.ok(texts(ev).includes(TEXTS.leave));
    const st = g.snapshot();
    assert.equal(st.npcs.pike.loc, null);
    assert.equal(st.vars.pikeState, 'left');
    assert.equal(st.vars.pikeArrivalTurn, 250);
  });

  test('away from the Police House he leaves silently; already fled → the entry does nothing', () => {
    const g = game((s) => { s.turn = 239; });
    assert.ok(!texts(g.input('wait')).includes(TEXTS.leave));
    assert.equal(g.snapshot().vars.pikeState, 'left');

    const fled = game((s) => { s.turn = 239; s.npcs.pike.loc = null; s.vars.pikeState = 'fled'; s.vars.pikeArrivalTurn = 260; });
    fled.input('wait');
    assert.equal(fled.snapshot().vars.pikeState, 'fled');
    assert.equal(fled.snapshot().vars.pikeArrivalTurn, 260);
  });

  test('entries fire only when `at === turn`; arriveText only when the player is in the (lit) destination', () => {
    const c = cloneContent(world);
    c.npcs.harrow.schedule = [
      { at: 3, to: 'yard', leaveText: 'Harrow leaves.', arriveText: 'Harrow arrives in the yard.' },
      { at: 5, to: 'lane', arriveText: 'Harrow arrives in the lane.' },
    ];
    const g = game((s) => place(s, 'yard'), c);
    assert.ok(!texts(g.input('wait. wait')).some((t) => t.startsWith('Harrow')));
    const ev = g.input('wait');
    assert.ok(texts(ev).includes('Harrow arrives in the yard.'));
    assert.ok(!texts(ev).includes('Harrow leaves.'), 'the player is not in the room left');
    assert.equal(g.snapshot().npcs.harrow.loc, 'yard');
    g.input('n. e');                                  // square, then the dark lane at turn 5
    const s = g.snapshot();
    assert.equal(s.turn, 5);
    assert.equal(s.npcs.harrow.loc, 'lane');
    assert.equal(s.roomId, 'lane');
  });

  test('a dark destination says nothing', () => {
    const c = cloneContent(world);
    c.npcs.harrow.schedule = [{ at: 1, to: 'lane', arriveText: 'Harrow arrives.' }];
    const g = game((s) => place(s, 'lane', 'square'), c);
    assert.ok(!texts(g.input('wait')).includes('Harrow arrives.'));
    assert.equal(g.snapshot().npcs.harrow.loc, 'lane');
  });
});

/* ----------------------- D4 story daemons (STORY §8) ---------------------- */

describe('D4 story daemons: Pike arrives (STORY §8.2, A14.3)', () => {
  test('left: arrives on pikeArrivalTurn; heard from the tunnel; the iron door opens', () => {
    const g = game((s) => {
      place(s, 'tunnel', 'yard');
      lightUp(s, 'torch');
      s.turn = 248;
      s.npcs.pike.loc = null;
      s.vars.pikeState = 'left';
      s.vars.pikeArrivalTurn = 250;
    });
    assert.ok(texts(g.input('n')).includes(TEXTS.barred));
    const ev = g.input('wait');
    assert.equal(statusOf(ev)[0].turns, 250);
    assert.ok(textIdx(ev, TEXTS.arriveTunnel) > idx(ev, (e) => e.type === 'sfx' && e.id === 'door'));
    assert.equal(g.snapshot().vars.pikeState, 'counting');
    assert.equal(g.snapshot().npcs.pike.loc, 'counting_room');
    const enter = g.input('n');
    assert.ok(texts(enter).includes(TEXTS.greeting));
    assert.equal(g.snapshot().vars.attack, 1, 'the entering turn counts as 1');
  });

  test('fled: a correct accusation at the Police House → Pike in the Counting Room 5 turns later', () => {
    const g = game((s) => { place(s, 'police_house'); carry(s, 'button'); s.evidence = ['ev_button']; s.awarded = ['button']; s.score = 5; s.turn = 10; });
    g.input('accuse pike');
    let s = g.snapshot();
    assert.equal(s.vars.pikeState, 'fled');
    assert.equal(s.vars.pikeArrivalTurn, 15);
    assert.equal(s.npcs.pike.loc, null);
    assert.equal(s.turn, 11);
    g.input('wait. wait. wait');
    assert.equal(g.snapshot().vars.pikeState, 'fled');
    g.input('wait');
    s = g.snapshot();
    assert.equal(s.turn, 15);
    assert.equal(s.vars.pikeState, 'counting');
    assert.equal(s.npcs.pike.loc, 'counting_room');
  });
});

describe('D4 story daemons: the attack counter (STORY §8.4 encoded in data, A14 rule 8)', () => {
  test('lit walk-through: 1 greeting, 2 warn, 3 warn, 4 lunge (+20, capped at 99), 5 death', () => {
    const g = finale((s) => { s.nerve = 80; s.turn = 100; });
    const e1 = g.input('n');
    assert.ok(texts(e1).includes(TEXTS.greeting));
    assert.equal(g.snapshot().vars.attack, 1);
    assert.equal(statusOf(e1)[0].nerve, 85, 'dark room lit by the torch: 0 + room nerve 5');

    const e2 = g.input('wait');
    assert.ok(texts(e2).includes(TEXTS.warn2));
    assert.ok(texts(e2).includes('You can hear your own heart.'), 'message at 90 on crossing');
    assert.equal(statusOf(e2)[0].nerve, 90);

    const e3 = g.input('wait');
    assert.ok(texts(e3).includes(TEXTS.warn3));
    assert.equal(statusOf(e3)[0].nerve, 95);

    const e4 = g.input('wait');
    assert.ok(textIdx(e4, TEXTS.lunge) >= 0);
    assert.ok(textIdx(e4, TEXTS.capText) > textIdx(e4, TEXTS.lunge), 'D6 caps after D4');
    assert.equal(statusOf(e4)[0].nerve, 99, 'lunge +20 capped at 99 by D6 the same turn');
    assert.ok(!ofType(e4, 'room').length, 'Beneath never panics');
    assert.ok(e4.find((e) => e.type === 'text' && e.text === TEXTS.lunge).style === 'alert');

    const e5 = g.input('wait');
    assert.deepEqual(types(e5).slice(-2), ['status', 'end']);
    assert.ok(idx(e5, (e) => e.type === 'sfx' && e.id === 'scream') >= 0);
    assert.equal(last(e5).ending, 'death_pike');
    assert.equal(last(e5).kind, 'death');
    assert.equal(last(e5).text, '"Five," says Pike.');
    assert.equal(g.snapshot().vars.attack, 5);
  });

  test('dark: turning the torch off at 1 is fatal at 2 (dark ending text)', () => {
    const g = finale();
    g.input('n');
    const ev = g.input('turn off torch');
    assert.equal(last(ev).ending, 'death_pike');
    assert.equal(last(ev).text, '"Two," says Pike, in the dark.');
  });

  test('dark: entering unlit warns at 1, fatal at 2', () => {
    const g = finale((s) => { s.items.torch.lit = false; s.prevRoomId = 'counting_room'; });
    const e1 = g.input('n');
    assert.ok(texts(e1).includes(TEXTS.dark1));
    assert.equal(last(g.input('wait')).ending, 'death_pike');
  });

  test('ARREST in step A stops the counter the same turn; then FREE HARROW wins', () => {
    const g = finale((s) => carry(s, 'handcuffs', 'cutters'));
    g.input('n');
    assert.ok(texts(g.input('wait')).includes(TEXTS.warn2));
    const arrest = g.input('arrest pike');
    assert.ok(texts(arrest).includes('You get the cuffs on him.'));
    assert.equal(g.snapshot().vars.attack, 2, 'no increment on the arrest turn');
    g.input('wait. wait. wait. wait');
    assert.equal(g.snapshot().vars.attack, 2, 'restraint stops the counter permanently');
    const win = g.input('free harrow');
    assert.equal(last(win).ending, 'victory');
    assert.equal(last(win).score, 20);
  });

  test('free first, then arrest before D4 makes it 3 (STORY §8.4 arrest-after-free order)', () => {
    const g = finale((s) => carry(s, 'handcuffs', 'cutters'));
    g.input('n');
    assert.ok(texts(g.input('free harrow')).includes(TEXTS.warn2));
    const ev = g.input('arrest pike');
    assert.equal(g.snapshot().vars.attack, 2);
    assert.equal(last(ev).ending, 'victory');
  });

  test('without handcuffs: "With what?" costs a turn and the counter runs on', () => {
    const g = finale();
    g.input('n');
    const ev = g.input('arrest pike');
    assert.ok(texts(ev).includes("With what? Harrow croaks: 'Cuffs - in my car!'"));
    assert.ok(texts(ev).includes(TEXTS.warn2));
  });

  test('leaving pauses the counter; re-entry resumes it (+1 on the entering turn)', () => {
    const g = finale();
    g.input('n');
    g.input('wait');
    g.input('s');
    assert.equal(g.snapshot().vars.attack, 2);
    g.input('wait');
    assert.equal(g.snapshot().vars.attack, 2);
    const back = g.input('n');
    assert.equal(g.snapshot().vars.attack, 3);
    assert.ok(texts(back).includes(TEXTS.reentry));
    assert.ok(texts(back).includes(TEXTS.warn3));
    assert.ok(!texts(back).includes(TEXTS.greeting), 'greeting is once');
  });

  test("Harrow's bleeding: the cue after 23:00 on entry; the every-20 beat while chained", () => {
    const g = finale((s) => { s.turn = 199; });
    const e = g.input('n');
    assert.ok(textIdx(e, TEXTS.bleed) > textIdx(e, TEXTS.greeting), 'greeting first, then the cue');
    const bleeds = ["Harrow's breathing is shallower now.", 'Harrow coughs, and there is something wet in it.'];
    assert.ok(texts(e).some((t) => bleeds.includes(t)), 'turn 200 is a multiple of 20 in the room');
    const early = finale((s) => { s.turn = 100; });
    assert.ok(!texts(early.input('n')).includes(TEXTS.bleed));
  });
});

/* --------------------------------- light --------------------------------- */

describe('D5 light (A8.2, A7.6)', () => {
  test('a lit fuel source burns 1 per turn and goes out at 0 with outText; then it is spent', () => {
    const g = game((s) => lightUp(s, 'lantern'));
    g.input('wait');
    assert.equal(g.snapshot().items.lantern.fuel, 2);
    g.input('wait');
    const ev = g.input('wait');
    assert.ok(texts(ev).includes(TEXTS.lanternOut));
    const st = g.snapshot().items.lantern;
    assert.deepEqual([st.lit, st.fuel], [false, 0]);
    assert.ok(texts(g.input('turn on lantern')).includes('The lantern is spent.'));
  });

  test('an unlit source does not burn; a source without fuel burns forever', () => {
    const g = game((s) => { s.items.lantern.loc = 'player'; lightUp(s, 'torch'); });
    for (let i = 0; i < 20; i++) g.input('wait');
    const st = g.snapshot().items;
    assert.equal(st.lantern.fuel, 3);
    assert.equal(st.torch.lit, true);
    assert.equal(st.torch.fuel, undefined);
  });

  test('going out out of sight is silent; default text when no outText', () => {
    const silent = game((s) => { place(s, 'yard'); s.items.lantern.lit = true; s.items.lantern.fuel = 1; });
    assert.ok(!texts(silent.input('wait')).includes(TEXTS.lanternOut));
    assert.equal(silent.snapshot().items.lantern.lit, false);

    const c = cloneContent(world);
    delete c.items.lantern.light.outText;
    const g = game((s) => { lightUp(s, 'lantern'); s.items.lantern.fuel = 1; }, c);
    assert.ok(texts(g.input('wait')).includes('The lantern goes out.'));
  });

  test('burning out in a dark room re-describes it as dark (O5): text, picture, darkness', () => {
    const g = game((s) => { place(s, 'lane', 'square'); lightUp(s, 'lantern'); s.items.lantern.fuel = 1; s.turn = 1; });
    const ev = g.input('wait');
    const out = textIdx(ev, TEXTS.lanternOut);
    const pic = idx(ev, (e) => e.type === 'picture');
    assert.ok(out >= 0 && pic === out + 1, JSON.stringify(ev));
    assert.deepEqual(ev[pic], { type: 'picture', id: null, graphics: true });
    assert.match(ev[pic + 1].text, /pitch dark/);
    assert.equal(statusOf(ev)[0].nerve, 10 + 15, 'D6 sees the room unlit: +5 dark +10 room');
  });
});

/* ------------------------------ nerve (D6) ------------------------------- */

describe('D6 nerve (A8.10)', () => {
  const after = (mutate, line = 'wait') => {
    const g = game(mutate);
    return statusOf(g.input(line)).at(-1).nerve;
  };

  test('safe room −5, lit room −1, dark +dark, dark room lit by a light 0, plus room.nerve; clamp at 0', () => {
    assert.equal(after(() => {}), 5);                                                   // square: safe
    assert.equal(after((s) => place(s, 'police_house')), 9);                            // lit
    assert.equal(after((s) => place(s, 'lane', 'square')), 25);                         // dark +5, room +10
    assert.equal(after((s) => { place(s, 'lane', 'square'); lightUp(s, 'torch'); }), 20); // lit by torch: 0 + 10
    assert.equal(after((s) => { s.nerve = 3; }), 0);
    assert.equal(after((s) => { place(s, 'tunnel', 'yard'); }), 15);                    // beneath, dark
  });

  test('tuning comes from RULE_DEFAULTS overridden by rules.nerve', () => {
    assert.equal(RULE_DEFAULTS.nerve.safe, -5);
    const c = cloneContent(world);
    Object.assign(c.rules.nerve, { safe: -2, dark: 7 });
    const g = game(() => {}, c);
    assert.equal(statusOf(g.input('wait'))[0].nerve, 8);
    const h = game((s) => place(s, 'lane', 'square'), c);
    assert.equal(statusOf(h.input('wait'))[0].nerve, 27);
  });

  test('threshold messages fire on crossing only, ascending, in alert style', () => {
    const g = game((s) => { place(s, 'lane', 'square'); s.nerve = 70; s.turn = 1; });
    const ev = g.input('wait');                    // 70 → 85
    assert.deepEqual(ev.filter((e) => e.style === 'alert').map((e) => e.text), ['Every shadow has a shape now.']);

    const c = cloneContent(world);
    c.npcs.pike.before = { attack: { nerve: 50, say: 'He looms.' } };
    const g2 = game((s) => { place(s, 'police_house'); s.nerve = 45; }, c);
    const ev2 = g2.input('attack pike');           // 45 + 50 − 1 = 94; declared 75, 50, 90
    assert.deepEqual(ev2.filter((e) => e.style === 'alert').map((e) => e.text),
      ['Your hands will not stop shaking.', 'Every shadow has a shape now.', 'You can hear your own heart.']);
    assert.equal(statusOf(ev2)[0].nerve, 94);

    const falling = game((s) => { place(s, 'police_house'); s.nerve = 51; });
    const ev3 = falling.input('wait');
    assert.equal(statusOf(ev3)[0].nerve, 50);
    assert.deepEqual(ev3.filter((e) => e.style === 'alert'), [], 'reaching a threshold from above says nothing');
  });
});

/* ------------------------------ panic (D6) ------------------------------- */

describe('D6 panic (A8.10 step 5, PLAN §2.5)', () => {
  test('town: zone panicText, sting, room entry into the safe room, nerve 50, cooldown 15', () => {
    const g = game((s) => { place(s, 'lane', 'square'); s.nerve = 90; s.turn = 1; });
    const ev = g.input('wait');
    const p = textIdx(ev, TEXTS.townPanic);
    assert.ok(p >= 0);
    assert.equal(ev[p].style, 'alert');
    assert.deepEqual(ev[p + 1], { type: 'sfx', id: 'sting' });
    assert.deepEqual(ev[p + 2], { type: 'room', id: 'square', name: 'Market Square' });
    assert.equal(ev[p + 3].type, 'picture');
    assert.deepEqual(ev[p + 4], { type: 'text', style: 'title', text: 'Market Square' });
    const st = statusOf(ev)[0];
    assert.deepEqual([st.roomId, st.nerve], ['square', 50]);
    const s = g.snapshot();
    assert.equal(s.panicCooldown, 15);
    assert.equal(s.prevRoomId, 'lane');
    assert.equal(ofType(ev, 'ambient').length, 0, 'rain → rain');
  });

  test('mill: rules panicText; a panic stops the chain with the notice', () => {
    const g = game((s) => { place(s, 'shed', 'yard'); s.nerve = 80; s.turn = 1; });
    const ev = g.input('wait. look. wait');
    assert.ok(texts(ev).includes(TEXTS.rulesPanic));
    assert.equal(statusOf(ev).length, 1);
    assert.deepEqual(last(ev), { type: 'text', style: 'system', text: '(Commands after WAIT were ignored.)' });
    assert.equal(g.snapshot().roomId, 'yard');
  });

  test('the default panic message applies when neither zone nor rules give one', () => {
    const c = cloneContent(world);
    delete c.rules.nerve.panicText;
    const g = game((s) => { place(s, 'shed', 'yard'); s.nerve = 99; s.turn = 1; }, c);
    assert.ok(texts(g.input('wait')).includes(DAEMON_MESSAGES.panic));
  });

  test('cooldown: no panic for the 15 turns after one, then panic again', () => {
    const g = game((s) => { place(s, 'lane', 'square'); s.nerve = 100; s.panicCooldown = 15; s.turn = 1; s.fired = ['fog_figure']; });
    const cds = [];
    for (let i = 0; i < 15; i++) {
      const ev = g.input('wait');
      assert.equal(ofType(ev, 'room').length, 0, `no panic on wait ${i + 1}`);
      cds.push(g.snapshot().panicCooldown);
    }
    assert.deepEqual(cds, [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
    assert.equal(g.snapshot().nerve, 100);
    const ev = g.input('wait');
    assert.ok(texts(ev).includes(TEXTS.townPanic));
    assert.equal(g.snapshot().panicCooldown, 15);
  });

  test('panic emits ambient when the safe room sounds different (D7 after D6)', () => {
    const c = cloneContent(world);
    c.rooms.lane.ambient = 'counting';
    const g = game((s) => { place(s, 'lane', 'square'); s.nerve = 95; s.turn = 1; }, c);
    const ev = g.input('wait');
    assert.deepEqual(ofType(ev, 'ambient'), [{ type: 'ambient', id: 'rain' }]);
    assert.ok(idx(ev, (e) => e.type === 'ambient') > idx(ev, (e) => e.type === 'room'));
  });
});

/* ------------------------------- cap zone -------------------------------- */

describe('Beneath: nerve cap 99, no panic (A8.10 steps 3 and 6)', () => {
  test('capText only on the turn the cap is first reached; nerve never exceeds 99; no panic', () => {
    const g = game((s) => { place(s, 'tunnel', 'yard'); s.nerve = 96; s.turn = 1; });
    const e1 = g.input('wait');
    assert.equal(statusOf(e1)[0].nerve, 99);
    assert.deepEqual(e1.filter((e) => e.text === TEXTS.capText).map((e) => e.style), ['alert']);
    for (let i = 0; i < 5; i++) {
      const ev = g.input('wait');
      assert.equal(statusOf(ev)[0].nerve, 99);
      assert.ok(!texts(ev).includes(TEXTS.capText));
      assert.equal(ofType(ev, 'room').length, 0);
    }
  });

  test('reaching the cap exactly also says capText once', () => {
    const g = game((s) => { place(s, 'tunnel', 'yard'); s.nerve = 94; s.turn = 1; });
    assert.ok(texts(g.input('wait')).includes(TEXTS.capText));
  });

  test('entering Beneath at 100 is clamped to 99 without the crossing text; cap in both rooms', () => {
    const g = game((s) => { place(s, 'yard'); lightUp(s, 'torch'); s.nerve = 100; s.panicCooldown = 5; s.turn = 1; });
    const ev = g.input('d');
    assert.equal(statusOf(ev)[0].nerve, 99);
    assert.ok(!texts(ev).includes(TEXTS.capText));
    const room = finale((s) => { s.nerve = 97; });
    const e2 = room.input('n');
    assert.equal(statusOf(e2)[0].nerve, 99);
    assert.ok(texts(e2).includes(TEXTS.capText));
  });
});

/* ------------------------------- ambience -------------------------------- */

describe('D7 ambience (A9.2 O6)', () => {
  test('emitted only when the value changes during the turn', () => {
    const g = game();
    assert.equal(ofType(g.input('e'), 'ambient').length, 0, 'square → lane: rain → rain');
    g.input('w');
    assert.deepEqual(ofType(g.input('n'), 'ambient'), [{ type: 'ambient', id: 'none' }]);
    assert.deepEqual(ofType(g.input('s'), 'ambient'), [{ type: 'ambient', id: 'rain' }]);
    assert.deepEqual(ofType(g.input('s'), 'ambient'), [{ type: 'ambient', id: 'drone' }]);
    assert.equal(ofType(g.input('look'), 'ambient').length, 0);
  });
});

/* ---------------------- endings (A7.7, PLAN §2.5) ------------------------ */

describe('D8 endings precedence at the 299/300 boundary', () => {
  test('midnight on 300: nothing at 299, fifth stroke at 300; status then end, end last', () => {
    const g = game((s) => { place(s, 'yard'); s.turn = 298; });
    const e299 = g.input('wait');
    assert.equal(ofType(e299, 'end').length, 0);
    assert.equal(g.snapshot().ended, null);
    const ev = g.input('wait');
    assert.deepEqual(types(ev).slice(-2), ['status', 'end']);
    assert.deepEqual(last(ev), {
      type: 'end', ending: 'fifth_stroke', kind: 'midnight', title: 'The Fifth Stroke',
      text: 'Midnight. St Jude\'s strikes twelve.', score: 0, maxScore: 35, rank: 'Probationer',
      turns: MIDNIGHT_TURN, art: null, music: null,
    });
    assert.equal(g.snapshot().ended, 'fifth_stroke');
    assert.equal(g.snapshot().turn, MIDNIGHT_TURN);
  });

  test('victory on 300 wins over every midnight ending (2 precedes 3)', () => {
    const g = finale((s) => {
      place(s, 'counting_room', 'tunnel');
      carry(s, 'cutters');
      s.vars.pikeState = 'restrained';
      s.awarded = ['arrest'];
      s.score = 10;
      s.turn = 299;
    });
    const ev = g.input('free harrow');
    assert.equal(statusOf(ev)[0].turns, 300);
    assert.equal(last(ev).ending, 'victory');
    assert.equal(last(ev).kind, 'victory');
    assert.equal(last(ev).score, 20);
    assert.equal(last(ev).rank, 'Sergeant');
  });

  test('midnight variants: pyrrhic (restrained), got away (freed), fifth stroke (neither)', () => {
    const at299 = (extra) => game((s) => { place(s, 'yard'); s.turn = 299; extra(s); });
    assert.equal(last(at299((s) => { s.vars.pikeState = 'restrained'; s.npcs.pike.loc = 'counting_room'; }).input('wait')).ending, 'pyrrhic');
    assert.equal(last(at299((s) => { s.vars.harrowFreed = true; }).input('wait')).ending, 'got_away');
    assert.equal(last(at299(() => {}).input('wait')).ending, 'fifth_stroke');
  });

  test('death on turn 300 beats midnight (E1): the attack counter kills at D4', () => {
    const g = finale((s) => { place(s, 'counting_room', 'tunnel'); s.vars.attack = 4; s.turn = 299; });
    const ev = g.input('wait');
    assert.equal(last(ev).ending, 'death_pike');
    assert.equal(statusOf(ev)[0].turns, 300);
  });

  test('death in the action stands even when a `when` ending holds', () => {
    const c = cloneContent(world);
    c.npcs.pike.before = { attack: { end: 'death_pike' } };
    const g = game((s) => { place(s, 'police_house'); s.turn = 299; }, c);
    assert.equal(last(g.input('attack pike')).ending, 'death_pike');
  });

  test('an ending mid-chain discards the rest with the notice before `end`', () => {
    const g = game((s) => { place(s, 'yard'); s.turn = 299; });
    const ev = g.input('wait. wait. wait');
    assert.deepEqual(types(ev).slice(-3), ['status', 'text', 'end']);
    assert.equal(ev.at(-2).text, '(Commands after WAIT were ignored.)');
    assert.equal(statusOf(ev).length, 1);
  });

  test('ended mode: only ENDED_VERBS; UNDO goes back to turn 299', () => {
    const g = game((s) => { place(s, 'yard'); s.turn = 299; });
    g.input('wait');
    assert.deepEqual(texts(g.input('wait')), ['The game is over. Type UNDO, LOAD, RESTART or IMPORT.']);
    g.input('undo');
    assert.equal(g.snapshot().turn, 299);
    assert.equal(g.snapshot().ended, null);
  });
});

/* ------------------------- scoring, ranks, status ------------------------ */

describe('scoring (A8.11)', () => {
  test('award is once-only; score is clamped to maxScore; rank follows the table', () => {
    const g = finale((s) => { place(s, 'counting_room', 'tunnel'); carry(s, 'handcuffs'); s.score = 30; s.awarded = ['button', 'accusation', 'freed']; });
    const ev = g.input('arrest pike');
    assert.ok(texts(ev).includes('[Your score has gone up by 5 points.]'), 'only the points up to maxScore');
    assert.equal(g.snapshot().score, 35);
    assert.deepEqual(g.snapshot().awarded, ['button', 'accusation', 'freed', 'arrest']);
    assert.match(texts(g.input('score'))[0], /35 of a possible 35, in \d+ turns, giving you the rank of Inspector\./);
  });

  test('a second correct accusation says its text without points', () => {
    const g = finale((s) => { place(s, 'counting_room', 'tunnel'); carry(s, 'button'); s.evidence = ['ev_button']; s.awarded = ['button']; s.score = 5; });
    const first = g.input('accuse pike');
    assert.ok(texts(first).includes('[Your score has gone up by 10 points.]'));
    const again = g.input('accuse pike');
    assert.ok(texts(again).includes('"Four," he says. "You forgot one."'));
    assert.ok(!texts(again).some((t) => t.startsWith('[Your score')));
    assert.equal(g.snapshot().score, 15);
  });

  test('the status event carries room, time, score, nerve and turns after every turn', () => {
    const g = game();
    const ev = g.input('n');
    assert.deepEqual(statusOf(ev), [{
      type: 'status', room: 'Police House', roomId: 'police_house', time: '21:30', score: 0, maxScore: 35, nerve: 9, turns: 1,
    }]);
  });
});

/* -------------------------- A15 nerve, now exact ------------------------- */

describe('A15 worked example: nerve values (D6 now live)', () => {
  test('9, 8, 7, 12, then 7 after UNDO', () => {
    const g = newGame(a15);
    assert.equal(statusOf(g.start())[0].nerve, 10);
    assert.equal(statusOf(g.input('N'))[0].nerve, 9);
    g.input('TAKE KEY');
    assert.equal(statusOf(g.input('BRASS'))[0].nerve, 8);
    assert.equal(statusOf(g.input('TAKE TORCH THEN SAVE 2 THEN S'))[0].nerve, 7);
    assert.equal(statusOf(g.input('D'))[0].nerve, 12);
    assert.equal(statusOf(g.input('UNDO'))[0].nerve, 7);
  });
});
