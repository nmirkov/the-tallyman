// TT-018 — the whole game, end to end (docs/STORY.md §12): the §12.1 reference walkthrough
// wins 100/100 at turn 91 (22:15), the §12.2 boiler-room route wins at turn 102, and every
// §12.3 outcome script reaches its ending (or its stated non-ending result).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import content from '../../src/content/index.js';
import { newGame, texts } from '../fixtures/harness.js';

const STORY = readFileSync(new URL('../../docs/STORY.md', import.meta.url), 'utf8');
/** STORY §12.1 "Plain list for tests/walkthrough/" (91 commands). */
const WALKTHROUGH = STORY.split('Plain list for `tests/walkthrough/` (91 lines):\n```\n')[1].split('```')[0].trim().split('\n');
/** STORY §12.2: replaces commands 84-91 of §12.1. */
const BOILER_ROUTE = ['e', 's', 'u', 's', 's', 's', 's', 's', 'e', 'd', 'w', 'n', 'd', 'oil hatch', 'open hatch', 'd', 'n', 'arrest pike', 'cut chains'];

const times = (n, line) => Array.from({ length: n }, () => line);
const endOf = (ev) => ev.find((e) => e.type === 'end');
const statusOf = (ev) => ev.filter((e) => e.type === 'status').at(-1);

/**
 * Plays `lines` in a fresh started game.
 * @returns {{g: object, ev: object[], all: object[]}} the game, the last command's events, every event
 */
function run(lines) {
  const g = newGame(content);
  const all = [...g.start()];
  let ev = [];
  for (const line of lines) {
    ev = g.input(line);
    all.push(...ev);
  }
  return { g, ev, all };
}

/** Asserts the last command ended the game with `id` on `turn`; returns the end event. */
function assertEnding({ g, ev }, id, turn) {
  const end = endOf(ev);
  assert.ok(end, `expected the ending "${id}", the game is still running at turn ${g.snapshot().turn}`);
  assert.equal(end.ending, id);
  assert.equal(end.turns, turn);
  assert.equal(g.snapshot().ended, id);
  assert.equal(g.snapshot().turn, turn);
  const ending = content.endings.find((e) => e.id === id);
  assert.equal(end.title, ending.title);
  assert.equal(end.kind, ending.kind);
  return end;
}

describe('STORY §12.1 reference walkthrough', () => {
  test('the plain list has 91 commands', () => assert.equal(WALKTHROUGH.length, 91));

  test('wins: victory, 100/100, Chief Inspector, turn 91, 22:15', () => {
    const r = run(WALKTHROUGH);
    const end = assertEnding(r, 'victory', 91);
    assert.equal(end.score, 100);
    assert.equal(end.maxScore, 100);
    assert.equal(end.rank, 'Chief Inspector');
    assert.equal(end.music, 'ending_good');
    assert.match(end.text, /^You get Frank to his feet between you/);
    assert.equal(statusOf(r.ev).time, '22:15');
    const s = r.g.snapshot();
    assert.equal(s.vars.pikeState, 'restrained');
    assert.equal(s.vars.harrowFreed, true);
    assert.equal(s.vars.attack, 1, 'arrested before the counter reached 2');
    assert.ok(s.nerve <= 30, `nerve stays low on the reference route (${s.nerve})`);
  });

  test('no command is refused or wasted: every one advances the clock by exactly 1', () => {
    const g = newGame(content);
    g.start();
    WALKTHROUGH.forEach((line, i) => {
      g.input(line);
      assert.equal(g.snapshot().turn, i + 1, `#${i + 1} ${line}`);
    });
  });

  test('the finale rows 88-91 (STORY §12.1 table)', () => {
    const { g } = run(WALKTHROUGH.slice(0, 87));
    let t = texts(g.input('d')).join('\n');
    assert.equal(g.snapshot().roomId, 'tunnel');
    assert.match(t, /North, the iron door stands ajar/);
    t = texts(g.input('n')).join('\n');
    assert.equal(g.snapshot().roomId, 'counting_room');
    assert.match(t, /"You're early, Sergeant," he says\. "I've one more to count\."/);
    assert.equal(g.snapshot().vars.attack, 1);
    t = texts(g.input('arrest pike')).join('\n');
    assert.match(t, /"Four," he whispers\. "Only four\."/);
    assert.equal(g.snapshot().score, 90);
    const ev = g.input('cut chains');
    assert.match(texts(ev).join('\n'), /"Took your time, kid," he says\./);
    assert.equal(endOf(ev).ending, 'victory');
  });
});

describe('STORY §12.2 boiler-room route', () => {
  test('wins: victory, 100/100 at turn 102', () => {
    const r = run([...WALKTHROUGH.slice(0, 83), ...BOILER_ROUTE]);
    const end = assertEnding(r, 'victory', 102);
    assert.equal(end.score, 100);
    assert.equal(end.rank, 'Chief Inspector');
  });

  test('the hatch is one door: open from the boiler room, open from the tunnel side, and back up', () => {
    const { g } = run([...WALKTHROUGH.slice(0, 83), ...BOILER_ROUTE.slice(0, 16)]);
    assert.equal(g.snapshot().roomId, 'tunnel');
    assert.equal(g.snapshot().turn, 99);
    assert.match(texts(g.input('x hatch')).join('\n'), /^The round iron hatch, open, a ladder going down\.$/);
    g.input('u');
    assert.equal(g.snapshot().roomId, 'boiler_room');
  });
});

describe('STORY §12.3 other outcomes', () => {
  test('free-then-cuff victory at turn 91, 100/100', () => {
    const r = run([...WALKTHROUGH.slice(0, 89), 'cut chains']);
    assert.match(texts(r.ev).join('\n'), /"Behind you!" he says\./);
    assert.match(texts(r.ev).join('\n'), /He circles, knife low\./);
    assert.equal(r.g.snapshot().vars.attack, 2);
    const ev = r.g.input('arrest pike');
    assert.match(texts(ev).join('\n'), /^Frank throws himself at Pike's knees/);
    const end = assertEnding({ g: r.g, ev }, 'victory', 91);
    assert.equal(end.score, 100);
  });

  test('pyrrhic: Pike cuffed, Harrow left chained until midnight; bleed beats every 20 turns', () => {
    const r = run([...WALKTHROUGH.slice(0, 90), ...times(210, 'wait')]);
    const end = assertEnding(r, 'pyrrhic', 300);
    assert.equal(end.score, 90);
    assert.match(end.text, /^Midnight\. Somewhere above you St Jude's strikes twelve/);
    const bleeds = texts(r.all).filter((t) => /^Harrow's breathing is shallower now\.$|^Harrow coughs, and there is something wet in it\.|^The stain at Harrow's side has reached the floor\.$/.test(t));
    assert.equal(bleeds.length, 11, 'turns 100, 120, ... 300: D2 runs before the midnight ending (D8)');
  });

  test('the one that got away: Harrow freed, Pike left counting, player waits in the tunnel', () => {
    const r = run([...WALKTHROUGH.slice(0, 89), 'cut chains', 's', ...times(209, 'wait')]);
    const end = assertEnding(r, 'got_away', 300);
    assert.equal(end.score, 90);
    assert.equal(r.g.snapshot().vars.attack, 2, 'the counter paused outside');
    assert.match(end.text, /^Midnight\. St Jude's strikes twelve above you/);
  });

  test('fifth stroke, never accused: Pike leaves at 240, arrives at 250; default text', () => {
    const g = newGame(content);
    g.start();
    for (let k = 1; k <= 239; k++) g.input('wait');
    assert.equal(g.snapshot().vars.pikeState, 'desk');
    g.input('wait');
    assert.equal(g.snapshot().vars.pikeState, 'left');
    assert.equal(g.snapshot().vars.pikeArrivalTurn, 250);
    for (let k = 241; k <= 249; k++) g.input('wait');
    assert.equal(g.snapshot().vars.pikeState, 'left');
    g.input('wait');
    assert.equal(g.snapshot().vars.pikeState, 'counting');
    assert.equal(g.snapshot().npcs.pike.loc, 'counting_room');
    let ev = [];
    for (let k = 251; k <= 300; k++) ev = g.input('wait');
    const end = assertEnding({ g, ev }, 'fifth_stroke', 300);
    assert.match(end.text, /PC Arthur Pike leads the search himself\./);
    assert.equal(end.score, 0);
  });

  test('fifth stroke, accused: the accusation variant; score 65', () => {
    const r = run([...WALKTHROUGH.slice(0, 64), ...times(236, 'wait')]);
    const end = assertEnding(r, 'fifth_stroke', 300);
    assert.equal(end.score, 65);
    assert.match(end.text, /You told them who it was; you just didn't get there\./);
  });

  const wrongMan = [
    ['Maggie', ['n', 'n', 'w', 'accuse maggie', 'y'], 4, /^You say it in front of the whole bar: "Margaret Pollard/],
    ['Ashdown', ['n', 'n', 'n', 'ne', 'n', 'accuse ashdown', 'y'], 6, /^"Clement Ashdown, I am arresting you\.\.\."/],
    ['Silas', ['n', 'e', 'd', 'e', 'n', 'accuse silas', 'y'], 6, /^"Silas Thorne, I am arresting you\.\.\."/],
  ];
  for (const [who, lines, turn, text] of wrongMan) {
    test(`wrong man - ${who}: ending on turn ${turn}`, () => {
      const r = run(lines);
      const end = assertEnding(r, 'wrong_man', turn);
      assert.match(end.text, text);
    });
  }

  test('accusation cancelled: "(You hold your tongue.)", no turn', () => {
    const r = run(['n', 'n', 'w', 'accuse maggie', 'n']);
    assert.deepEqual(texts(r.ev), ['(You hold your tongue.)']);
    assert.equal(r.g.snapshot().turn, 3);
    assert.equal(r.g.snapshot().ended, null);
  });

  test('weak accusation: laugh, nerve 3 -> 17, turn 4, game continues', () => {
    const r = run(['n', 'n', 'e', 'accuse pike']);
    assert.match(texts(r.ev).join('\n'), /^Pike laughs - a big easy laugh/);
    assert.equal(r.g.snapshot().nerve, 17);
    assert.equal(r.g.snapshot().turn, 4);
    assert.equal(r.g.snapshot().ended, null);
  });

  test('accuse someone absent: free', () => {
    const r = run(['accuse pike']);
    assert.deepEqual(texts(r.ev), ["Accuse who? They're not here."]);
    assert.equal(r.g.snapshot().turn, 0);
  });

  test('death - drowning: warned on turn 5, dead on 6; UNDO keeps the warning', () => {
    const r = run(['n', 'e', 'd', 'e', 'swim']);
    assert.match(texts(r.ev).join('\n'), /^You stand at the edge of the lock/);
    assert.equal(r.g.snapshot().turn, 5);
    const ev = r.g.input('swim');
    assertEnding({ g: r.g, ev }, 'death_drown', 6);
    r.g.input('undo');
    assert.equal(r.g.snapshot().turn, 5);
    assertEnding({ g: r.g, ev: r.g.input('jump') }, 'death_drown', 6);
  });

  test('death - quarry: warned on turn 7, dead on 8', () => {
    const r = run(['n', 'n', 'n', 'n', 'n', 'e', 'd']);
    assert.equal(r.g.snapshot().turn, 7);
    assert.equal(r.g.snapshot().roomId, 'quarry_edge');
    assertEnding({ g: r.g, ev: r.g.input('d') }, 'death_fall', 8);
  });

  test('quarry with the rope: down safely, and back up', () => {
    const r = run(['n', 'n', 'n', 'n', 'n', 'e', 'in', 'take rope', 'out', 'd']);
    assert.equal(r.g.snapshot().roomId, 'quarry_floor');
    assert.equal(r.g.snapshot().ended, null);
    r.g.input('u');
    assert.equal(r.g.snapshot().roomId, 'quarry_edge');
  });

  test('death - Pike (lit): warnings at 90, 91, lunge at 92, dead at 93', () => {
    const { g } = run(WALKTHROUGH.slice(0, 89));
    const expect = [/He circles, knife low\./, /^"Three," says Pike/, /^He lunges\./];
    const n0 = g.snapshot().nerve;
    for (const [i, re] of expect.entries()) {
      assert.ok(texts(g.input('wait')).some((t) => re.test(t)), `turn ${90 + i}`);
      assert.equal(g.snapshot().vars.attack, 2 + i);
    }
    assert.ok(g.snapshot().nerve >= n0 + 15, 'the lunge adds 20 nerve');
    const ev = g.input('wait');
    assert.ok(ev.some((e) => e.type === 'sfx' && e.id === 'scream'));
    const end = assertEnding({ g, ev }, 'death_pike', 93);
    assert.match(end.text, /^"Five," says Pike, close as a whisper/);
  });

  test('death - Pike (dark): the first TURN OFF is refused with a warning; the second is fatal', () => {
    const { g } = run(WALKTHROUGH.slice(0, 89));
    let t = texts(g.input('turn off torch')).join('\n');
    assert.match(t, /^Switch off your only light, with Pike and his knife in here\?/);
    assert.match(t, /He circles, knife low\./);
    assert.equal(g.snapshot().items.torch.lit, true);
    assert.equal(g.snapshot().flags.torch_off_warned, true);
    assert.equal(g.snapshot().flags.dark_warned, undefined, 'the refusal alone does not arm the dark counter (TT-105)');
    const ev = g.input('turn off torch');
    const end = assertEnding({ g, ev }, 'death_pike', 91);
    assert.equal(g.snapshot().items.torch.lit, false);
    assert.match(end.text, /^In the dark the counting comes from everywhere at once\./);
  });

  test('arrest without cuffs: "With what?" costs a turn and the counter ticks', () => {
    const { g } = run([...WALKTHROUGH.slice(0, 88), 'drop handcuffs', 'n']);
    assert.equal(g.snapshot().roomId, 'counting_room');
    assert.equal(g.snapshot().vars.attack, 1);
    const t = texts(g.input('arrest pike'));
    assert.equal(t[0], "With what? Harrow croaks: 'Cuffs - in my car!'");
    assert.equal(g.snapshot().turn, 91);
    assert.equal(g.snapshot().vars.attack, 2);
    assert.equal(g.snapshot().vars.pikeState, 'counting');
  });

  test('panic (town): 16 waits in the unlit crypt send you to Market Square', () => {
    const r = run(['n', 'n', 'n', 'ne', 'n', 'd']);
    assert.equal(r.g.snapshot().roomId, 'crypt');
    assert.equal(r.g.snapshot().nerve, 7);
    let ev = [];
    for (let i = 0; i < 16; i++) ev = r.g.input('wait');
    assert.ok(texts(ev).some((t) => t.startsWith('Your nerve goes. You run - blind, splashing')));
    const s = r.g.snapshot();
    assert.equal(s.roomId, 'market_square');
    assert.equal(s.nerve, 50);
    assert.equal(s.panicCooldown, 15);
  });
});

describe('every ending is reachable', () => {
  test('the scripts above cover all eight endings', () => {
    assert.deepEqual(content.endings.map((e) => e.id), ['victory', 'pyrrhic', 'got_away', 'fifth_stroke', 'wrong_man', 'death_drown', 'death_fall', 'death_pike']);
  });
});
