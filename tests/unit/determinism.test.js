// TT-010 — determinism with live daemons (ARCHITECTURE G1, A3, A11; PLAN §3.4a): the same
// seed and inputs give the same events; a save taken at any point and loaded into a
// fresh game continues identically for ≥ 50 random turns of the daemon world, whose beats
// consume RNG (`chance`, `pick`); UNDO restores the RNG too.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/engine/game.js';
import world from '../fixtures/daemon-world.js';
import { cloneContent, texts } from '../fixtures/harness.js';

/** Turn-costing commands (no barriers) that wander the whole fixture map. */
const POOL = [
  'n', 's', 'e', 'w', 'd', 'u', 'wait', 'wait', 'z', 'look', 'take lantern', 'turn on lantern',
  'turn off lantern', 'take torch', 'turn on torch', 'turn off torch', 'take cuffs', 'take button',
  'take cutters', 'x pike', 'arrest pike', 'free harrow', 'accuse pike', 'i',
];

/**
 * A reproducible walk of `n` commands (LCG; independent of the engine RNG). Some commands
 * are free (refused resolution, INVENTORY), so 120 commands span well over 50 turns.
 */
function walk(walkSeed, n = 120) {
  let x = walkSeed >>> 0;
  const out = [];
  for (let i = 0; i < n; i++) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    out.push(POOL[x % POOL.length]);
  }
  return out;
}

const RNG_TEXTS = [
  'Thunder rolls over the moor.', 'Lightning, far off. You count without meaning to.', 'The rain thickens.',
  'Somewhere in the dark, someone is counting.', 'Footsteps behind you. You stop. They stop.',
];

const newGame = (seed) => {
  const g = createGame({ content: cloneContent(world), seed, strict: true });
  g.start();
  return g;
};

const feed = (g, lines) => lines.map((l) => g.input(l));

describe('determinism (G1)', () => {
  test('same seed + same inputs → identical events and states; RNG beats really fire', () => {
    for (const walkSeed of [1, 2, 3]) {
      const lines = walk(walkSeed);
      const a = newGame(7);
      const b = newGame(7);
      assert.deepEqual(feed(a, lines), feed(b, lines));
      assert.deepEqual(a.snapshot(), b.snapshot());
    }
    const lines = walk(1);
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
    const runs = seeds.map((seed) => feed(newGame(seed), lines).flatMap(texts).filter((t) => RNG_TEXTS.includes(t)));
    assert.ok(runs.some((r) => r.length > 0), 'the walk triggers RNG beats');
    assert.ok(new Set(runs.map((r) => JSON.stringify(r))).size > 1, 'different seeds, different beats');
  });

  test('state stays plain JSON after every turn of a walk', () => {
    const g = newGame(3);
    for (const line of walk(4)) {
      g.input(line);
      const s = g.snapshot();
      assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
    }
  });
});

describe('save → load → identical continuation (A11, ≥ 50 random turns)', () => {
  for (const walkSeed of [1, 2, 3, 4, 5]) {
    test(`walk ${walkSeed}: every split point continues identically`, () => {
      const lines = walk(walkSeed);
      for (const k of [0, 1, 10, 25, 50, 80, 119]) {
        const a = newGame(walkSeed * 11);
        feed(a, lines.slice(0, k));
        const save = a.save();
        const json = JSON.stringify(save);

        const b = newGame(12345);                  // its own seed must not matter: rng comes from the save
        const r = b.load(json);
        assert.equal(r.ok, true, r.error);
        assert.deepEqual(b.snapshot(), a.snapshot(), `k=${k}: loaded state`);

        const restA = feed(a, lines.slice(k));
        const restB = feed(b, lines.slice(k));
        assert.deepEqual(restB, restA, `k=${k}: continuation events`);
        assert.deepEqual(b.snapshot(), a.snapshot(), `k=${k}: final state`);
        if (k === 0) assert.ok(a.snapshot().turn >= 50 || a.snapshot().ended !== null, `only ${a.snapshot().turn} turns`);
      }
    });
  }

  test('a save taken mid-panic-cooldown and mid-counter continues identically', () => {
    const a = newGame(5);
    const data = a.save();
    Object.assign(data.state, {
      roomId: 'tunnel', prevRoomId: 'yard', nerve: 70, panicCooldown: 6, turn: 120,
    });
    data.state.visited.push('yard', 'tunnel');
    data.state.items.torch.loc = 'player';
    data.state.items.torch.lit = true;
    data.state.npcs.pike.loc = 'counting_room';
    data.state.vars.pikeState = 'counting';
    assert.equal(a.load(data).ok, true);
    a.input('n. wait');
    const mid = a.save();
    const b = newGame(1);
    b.load(mid);
    const lines = ['s', 'wait', 'u', 'e', 'wait', 'w', 'd', 'n', 'wait', 'wait', 'wait'];
    assert.deepEqual(feed(b, lines), feed(a, lines));
    assert.deepEqual(b.snapshot(), a.snapshot());
  });
});

describe('UNDO restores the RNG with the state (U1–U3)', () => {
  test('replaying an undone line gives the same events', () => {
    const g = newGame(9);
    feed(g, walk(6, 20));
    const line = 'wait. wait. wait. wait';
    const first = g.input(line);
    g.input('undo');
    assert.deepEqual(g.input(line), first);
  });
});
