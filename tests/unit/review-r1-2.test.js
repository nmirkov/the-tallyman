// TT-102 — regression tests for the Codex R1 round-2 review (reviews/code-review-R1-2.md).
// Named as the review asked: reveal loops stop at an ending (A7.7 E1), strict mode rolls
// back before rethrowing (A7.9, A11 V13), and SEARCH ROOM (A8.6).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MESSAGES } from '../../src/engine/types.js';
import mini from '../fixtures/mini-world.js';
import {
  newGame, cloneContent, texts, last, play, setup,
} from '../fixtures/harness.js';

/** A fresh copy of the mini-world with `mutate` applied. */
function variant(mutate) {
  const c = cloneContent(mini);
  c.hooks = { ...(c.hooks ?? {}) };
  mutate(c);
  return c;
}

/* ------------------------------------------------------------------------ *
 *  #1 engine-owned reveal loops stop at an ending (A7.7 E1)                 *
 * ------------------------------------------------------------------------ */

describe('R1-2 #1: reveal loops stop once an ending is established', () => {
  const OTHER_FOUND = 'Under the bench you find a brown parcel.';
  const caches = (c) => {
    c.items.fatal_cache = {
      name: 'tin box', names: ['box'], adjectives: ['tin'], location: 'square', hidden: true,
      desc: 'A tin box.', found: { say: 'The tin box ticks, then flashes.', end: 'death_fall' },
    };
    c.items.other_cache = {
      name: 'brown parcel', names: ['parcel'], adjectives: ['brown'], location: 'square', hidden: true,
      desc: 'A brown parcel.', found: OTHER_FOUND,
    };
  };

  test('fatal found reaction stops remaining reveal-list elements', () => {
    const g = newGame(variant((c) => {
      caches(c);
      c.rooms.square.before = { wait: { reveal: ['fatal_cache', 'other_cache'] } };
    }));
    g.start();
    const ev = g.input('wait');
    const s = g.snapshot();
    assert.equal(s.ended, 'death_fall');
    assert.equal(last(ev).type, 'end');
    assert.equal(s.items.fatal_cache.hidden, false);
    assert.equal(s.items.other_cache.hidden, true, 'the element after the fatal one is not revealed');
    assert.ok(!texts(ev).includes(OTHER_FOUND), texts(ev).join(' | '));
  });

  test('SEARCH stops revealing after death', () => {
    const g = newGame(variant(caches));
    g.start();
    const ev = g.input('search');
    const s = g.snapshot();
    assert.equal(s.ended, 'death_fall');
    assert.equal(last(ev).ending, 'death_fall');
    assert.ok(texts(ev).includes('The tin box ticks, then flashes.'));
    assert.equal(s.items.other_cache.hidden, true, 'SEARCH stops at the ending');
    assert.ok(!texts(ev).includes(OTHER_FOUND), texts(ev).join(' | '));
  });
});

/* ------------------------------------------------------------------------ *
 *  #2 strict mode restores state and UNDO before rethrowing (A7.9, V13)     *
 * ------------------------------------------------------------------------ */

describe('R1-2 #2: strict-mode failures roll back first', () => {
  const throwingPub = () => variant((c) => {
    c.rooms.pub.desc = { hook: 'pub_desc' };
    c.hooks.pub_desc = () => { throw new Error('pub desc boom'); };
  });

  test('strict input failure restores state and previous UNDO', () => {
    const g = newGame(throwingPub());
    g.start();
    g.input('wait');                           // UNDO snapshot = turn 0
    const before = g.snapshot();
    assert.throws(() => g.input('n'), /pub desc boom/);
    assert.deepEqual(g.snapshot(), before, 'the player did not move');
    const undo = g.input('undo');
    assert.ok(texts(undo).includes(MESSAGES.undone), 'the previous UNDO snapshot survived');
    assert.equal(g.snapshot().turn, 0);
  });

  test('strict LOAD refresh failure preserves state and UNDO', () => {
    const g = newGame(throwingPub());
    g.start();
    g.input('wait');
    const before = g.snapshot();
    const data = g.save();
    data.state.roomId = 'pub';
    data.state.prevRoomId = 'square';
    data.state.visited.push('pub');
    assert.throws(() => g.load(data), /pub desc boom/);
    assert.deepEqual(g.snapshot(), before, 'the current room is still the square');
    const undo = g.input('undo');
    assert.ok(texts(undo).includes(MESSAGES.undone), 'UNDO was not cleared');
    assert.equal(g.snapshot().turn, 0);
  });

  test('strict RESTART failure keeps the game and UNDO as they were', () => {
    let armed = false;
    const g = newGame(variant((c) => {
      c.rooms.square.desc = { hook: 'square_desc' };
      c.hooks.square_desc = () => {
        if (armed) throw new Error('square desc boom');
        return 'The square.';
      };
    }));
    g.start();
    play(g, 'n', 'wait');
    const before = g.snapshot();
    armed = true;
    assert.throws(() => g.restart(), /square desc boom/);
    assert.deepEqual(g.snapshot(), before);
    assert.ok(texts(g.input('undo')).includes(MESSAGES.undone));
    assert.equal(g.snapshot().turn, 1);
  });
});

/* ------------------------------------------------------------------------ *
 *  note 1: SEARCH ROOM (A8.6)                                               *
 * ------------------------------------------------------------------------ */

describe('R1-2 note 1: SEARCH ROOM', () => {
  const inBackRoom = (g) => setup(g, (s) => {
    s.roomId = 'back_room'; s.prevRoomId = 'pub'; s.visited.push('pub', 'back_room');
  });
  const COIN = 'Wedged in a crack in the table is a 10p coin.';

  test('SEARCH ROOM and SEARCH AROUND reveal exactly what bare SEARCH does', () => {
    for (const line of ['search', 'search room', 'search around']) {
      const g = newGame();
      inBackRoom(g);
      assert.deepEqual(texts(g.input(line)), [COIN], line);
      const s = g.snapshot();
      assert.equal(s.items.coin.hidden, false, line);
      assert.equal(s.turn, 1, `${line} costs one turn`);
    }
  });

  test('a noun that starts with "room" still binds to the item', () => {
    const g = newGame(variant((c) => {
      c.items.room_key = {
        name: 'room key', names: ['key', 'room key'], adjectives: ['room'], location: 'square',
        desc: 'A key on a wooden tag.', container: { capacity: 1 }, openable: true, open: true,
      };
    }));
    g.start();
    assert.deepEqual(texts(g.input('search room key')), ['You find nothing of interest.']);
    assert.deepEqual(texts(g.input('search room')), ['You find nothing of interest.']);
  });
});
