// TT-103 — the non-blocking notes of the Codex R1 round-3 review (reviews/code-review-R1-3.md).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import mini from '../fixtures/mini-world.js';
import {
  newGame, cloneContent, texts, types, last, play, setup,
} from '../fixtures/harness.js';

function variant(mutate) {
  const c = cloneContent(mini);
  c.hooks = { ...(c.hooks ?? {}) };
  mutate(c);
  return c;
}

/** Puts the player in the office (a valid save needs it in `visited`). */
const toOffice = (s) => {
  s.roomId = 'office';
  s.prevRoomId = 'square';
  if (!s.visited.includes('office')) s.visited.push('office');
};

describe('R1-3 #1: a hook that breaks a save invariant fails the line in strict mode', () => {
  test('writing api.state.score past maxScore throws and rolls back', () => {
    const g = newGame(variant((c) => {
      c.hooks.bad_score = (api) => { api.state.score = 999999; };
      c.rooms.square.before = { wait: { hook: 'bad_score' } };
    }));
    g.start();
    const before = g.snapshot();
    assert.throws(() => g.input('wait'), /invariant broken/);
    assert.deepEqual(g.snapshot(), before);
  });
});

describe('R1-3 #2: vanishing containers do not orphan their contents', () => {
  const edible = (c) => {
    c.items.satchel.edible = { say: 'You gnaw the satchel.' };
    c.items.satchel.open = true;
    c.items.pebble = { name: 'pebble', names: ['pebble'], location: 'satchel', desc: 'A pebble.' };
  };
  const withKey = (g) => setup(g, (s) => {
    toOffice(s);
    s.items.satchel.loc = 'player';
    for (const id of Object.keys(s.items)) if (s.items[id].loc === 'satchel') s.items[id].loc = 'office';
    s.items.pebble.loc = 'satchel';
    s.items.satchel.open = true;
  });

  test('EAT spills the contents into the room', () => {
    const g = newGame(variant(edible));
    g.start();
    withKey(g);
    g.input('eat satchel');
    const s = g.snapshot();
    assert.equal(s.items.satchel.loc, null);
    assert.equal(s.items.pebble.loc, 'office');
  });

  test('THROW into a sink room takes the contents with it (explicit null)', () => {
    const g = newGame(variant((c) => { edible(c); c.rooms.office.sink = 'It drops down the drain.'; }));
    g.start();
    withKey(g);
    g.input('throw satchel');
    const s = g.snapshot();
    assert.equal(s.items.satchel.loc, null);
    assert.equal(s.items.pebble.loc, null);
  });
});

describe('R1-3 #3: a throwing ending text hook rolls the fatal turn back', () => {
  test('state is unchanged, no end event, the hazard has not recorded its warning', () => {
    const g = newGame(variant((c) => {
      c.hooks.boom = () => { throw new Error('ending boom'); };
      c.endings.find((e) => e.id === 'death_fall').text = { hook: 'boom' };
    }));
    g.start();
    setup(g, toOffice);
    g.input('d');                                 // hazard warning
    const before = g.snapshot();
    assert.throws(() => g.input('d'), /ending boom/);
    assert.deepEqual(g.snapshot(), before);
    assert.equal(g.snapshot().ended, null);
  });
});

describe('R1-3 #4: behaviours the review verified by hand', () => {
  test('afterAction end skips D2-D7, D1 still runs and end is last', () => {
    const g = newGame(variant((c) => {
      c.afterAction = [{ end: 'death_fall' }, { say: 'never printed' }];
      c.beats = [{ id: 'every_turn', every: 1, run: 'BEAT TEXT' }];
    }));
    g.start();
    const ev = g.input('wait');
    assert.equal(last(ev).type, 'end');
    assert.ok(types(ev).includes('status'));
    assert.ok(!texts(ev).some((t) => t.includes('BEAT TEXT') || t.includes('never printed')), texts(ev).join('|'));
    assert.equal(g.snapshot().turn, 1);
  });

  test('strict failure after a committed world segment restores the pre-line UNDO snapshot', () => {
    const g = newGame(variant((c) => {
      c.rooms.pub.desc = { hook: 'pub_desc' };
      c.hooks.pub_desc = () => { throw new Error('pub desc boom'); };
    }));
    g.start();
    g.input('wait');                              // turn 0 -> 1
    g.input('wait');                              // turn 1 -> 2, UNDO restores turn 1
    assert.throws(() => g.input('wait. n'), /pub desc boom/);
    g.input('undo');
    assert.equal(g.snapshot().turn, 1);
  });

  test('a save holding a mid-list disambiguation loads and the answer completes the list', () => {
    const g = newGame(mini);
    g.start();
    setup(g, (s) => {
      toOffice(s);
      s.items.brass_key.loc = 'office';
      s.items.iron_key.loc = 'office';
    });
    const ask = g.input('take key, torch');
    assert.ok(types(ask).includes('prompt'), types(ask).join(','));
    const data = JSON.parse(JSON.stringify(g.save()));
    const g2 = newGame(mini);
    g2.start();
    const r = g2.load(data);
    assert.ok(r.ok, r.error);
    const out = texts(g2.input('iron'));
    assert.ok(out.includes('Iron key: Taken.'), out.join('|'));
    assert.ok(out.includes('Torch: Taken.'), out.join('|'));
  });

  test('hazard warning and death in one chain', () => {
    const g = newGame(mini);
    g.start();
    setup(g, toOffice);
    const ev = g.input('d. d. look');
    const t = texts(ev);
    assert.ok(t.some((x) => x.includes('drain shaft drops into blackness')), t.join('|'));
    assert.equal(types(ev).filter((x) => x === 'status').length, 2);
    assert.equal(last(ev).type, 'end');
    assert.equal(last(ev).ending, 'death_fall');
  });
});
