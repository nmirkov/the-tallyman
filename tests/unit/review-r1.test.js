// TT-101 — regression tests for the Codex R1 milestone review (reviews/code-review-R1-1.md).
// One test per blocking finding (named as the review asked), plus the non-blocking items.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGame } from '../../src/engine/game.js';
import { validateSave } from '../../src/engine/state.js';
import { MESSAGES } from '../../src/engine/types.js';
import { lintContent } from '../../tools/lint-content.js';
import { createHost } from '../../tools/play.js';
import { hasGlyph } from '../../src/ui/font8x8.js';
import mini from '../fixtures/mini-world.js';
import {
  newGame, cloneContent, texts, types, last, play, setup,
} from '../fixtures/harness.js';

/** A fresh copy of the mini-world with `mutate` applied. */
function variant(mutate) {
  const c = cloneContent(mini);
  c.hooks = { ...(c.hooks ?? {}) };
  mutate(c);
  return c;
}

const CANT_REACH = 'You can\'t reach it.';
const isEngineError = (events) => events.length === 1 && events[0].type === 'text' && events[0].style === 'system'
  && events[0].text.startsWith('(Something went wrong:');

/* ------------------------------------------------------------------------ *
 *  #1 protection of critical descendants (A8.7)                             *
 * ------------------------------------------------------------------------ */

describe('R1 #1: critical / personal items are protected through their container', () => {
  test('throwing a container into a sink preserves its critical descendants', () => {
    const c = variant((c) => {
      c.rooms.alley.sink = 'The canal swallows it without a sound.';
      c.npcs.maggie.accepts = { ...c.npcs.maggie.accepts, satchel: '"A nice bag, that."' };
    });
    const g = newGame(c);
    g.start();
    play(g, 'e', 'take satchel', 's');
    const ev = g.input('throw satchel');
    assert.ok(texts(ev).includes(MESSAGES.critical), texts(ev).join(' | '));
    assert.equal(g.snapshot().items.satchel.loc, 'player');
    assert.equal(g.snapshot().items.handcuffs.loc, 'satchel');
    assert.equal(g.snapshot().turn, 4, 'the refusal costs one turn');

    // GIVE to an NPC who accepts the container would also lose the cuffs.
    play(g, 'n', 'n');
    const give = g.input('give satchel to maggie');
    assert.ok(texts(give).includes(MESSAGES.critical), texts(give).join(' | '));
    assert.equal(g.snapshot().items.satchel.loc, 'player');

    // Once the critical item is out, the container is an ordinary item again.
    play(g, 's', 's', 'open satchel', 'take handcuffs');
    const ok = g.input('throw satchel');
    assert.ok(texts(ok).includes('The canal swallows it without a sound.'), texts(ok).join(' | '));
    assert.equal(g.snapshot().items.satchel.loc, null);
    assert.equal(g.snapshot().items.handcuffs.loc, 'player');
  });
});

/* ------------------------------------------------------------------------ *
 *  #2 exit-condition exceptions reach the transaction boundary (A7.9)       *
 * ------------------------------------------------------------------------ */

describe('R1 #2: hook exceptions during resolution', () => {
  const boomWorld = () => variant((c) => {
    c.rooms.square.exits = { ...c.rooms.square.exits, n: { to: 'pub', if: { hook: 'boom' } } };
    c.rooms.square.before = { pray: { setFlag: 'armed', say: 'You feel uneasy.' } };
    c.hooks.boom = (api) => {
      if (api.flag('armed')) throw new Error('boom');
      return true;
    };
  });

  test('throwing exit condition rolls back the entire chain and preserves previous UNDO', () => {
    const g = newGame(boomWorld(), { strict: false });
    g.start();
    g.input('look');                         // commits an UNDO snapshot (turn 0)
    const before = g.snapshot();
    const ev = g.input('pray. wait');        // PRAY arms the hook; resolving WAIT throws
    assert.ok(isEngineError(ev), JSON.stringify(ev));
    assert.match(ev[0].text, /boom/);
    assert.deepEqual(g.snapshot(), before, 'PRAY was rolled back too');
    const undo = g.input('undo');
    assert.ok(texts(undo).includes(MESSAGES.undone), 'the UNDO snapshot of the previous line survived');
    assert.equal(g.snapshot().turn, 0);
  });

  test('strict mode rethrows the exit-condition exception', () => {
    const g = newGame(boomWorld());
    g.start();
    assert.throws(() => g.input('pray. wait'), /boom/);
  });
});

/* ------------------------------------------------------------------------ *
 *  #3 nested endings (A7.7 E1)                                              *
 * ------------------------------------------------------------------------ */

describe('R1 #3: an established ending stands', () => {
  test('onEnter death survives the enclosing reaction\'s later effects and ending', () => {
    const c = variant((c) => {
      c.rooms.square.before = { wait: { movePlayer: 'pub', then: 'You should never read this.', end: 'wrong_man' } };
      c.rooms.pub.onEnter = { end: 'death_fall' };
    });
    const g = newGame(c);
    g.start();
    const ev = g.input('wait');
    const s = g.snapshot();
    assert.equal(s.ended, 'death_fall');
    assert.equal(last(ev).type, 'end');
    assert.equal(last(ev).ending, 'death_fall');
    assert.ok(!texts(ev).includes('You should never read this.'), 'effects after the ending are skipped');
    assert.equal(s.turn, 1, 'the clock still runs (C10)');
    assert.equal(types(ev).filter((t) => t === 'status').length, 1, 'status still runs');
    assert.equal(ev[ev.length - 2].type, 'status');
  });

  test('api.end never overwrites an ending already set', () => {
    const c = variant((c) => {
      c.rooms.square.before = { wait: { hook: 'twice' } };
      c.hooks.twice = (api) => { api.end('death_fall'); api.end('wrong_man'); };
    });
    const g = newGame(c);
    g.start();
    assert.equal(last(g.input('wait')).ending, 'death_fall');
  });
});

/* ------------------------------------------------------------------------ *
 *  #4 reachability before physical manipulation (A8.1)                      *
 * ------------------------------------------------------------------------ */

describe('R1 #4: closed containers keep their contents out of reach', () => {
  test('DROP and PUT cannot extract contents from a closed transparent carried container', () => {
    const g = newGame();
    g.start();
    setup(g, (s) => {
      s.roomId = 'pub';
      s.visited.push('pub');
      s.items.jar.loc = 'player';              // closed, transparent, holds the button
      s.items.satchel.loc = 'player';
      s.items.satchel.open = true;
    });
    for (const line of ['drop button', 'put button in satchel', 'give button to maggie', 'throw button']) {
      const turn = g.snapshot().turn;
      const ev = g.input(line);
      assert.ok(texts(ev).includes(CANT_REACH), `${line}: ${texts(ev).join(' | ')}`);
      assert.equal(g.snapshot().items.button.loc, 'jar', line);
      assert.equal(g.snapshot().turn, turn + 1, `${line} costs one turn`);
    }
    // Opening the jar makes the same commands work.
    play(g, 'open jar');
    assert.ok(texts(g.input('put button in satchel')).includes('You put the silver button in the satchel.'));
  });

  test('a key inside a closed carried container is not used for UNLOCK', () => {
    const g = newGame();
    g.start();
    setup(g, (s) => {
      s.roomId = 'pub';
      s.visited.push('pub');
      s.items.satchel.loc = 'player';           // closed, opaque
      s.items.brass_key.loc = 'satchel';
    });
    const ev = g.input('unlock door');
    assert.ok(texts(ev).includes('You have nothing to unlock the oak door with.'), texts(ev).join(' | '));
    assert.equal(g.snapshot().items.oak_door.locked, true);
  });
});

/* ------------------------------------------------------------------------ *
 *  #5 lighting changes outside the action phase (A9.2 O5)                   *
 * ------------------------------------------------------------------------ */

describe('R1 #5: every lighting change refreshes the presentation once', () => {
  const pictures = (ev) => ev.filter((e) => e.type === 'picture').map((e) => e.id);
  const inCellar = (s) => {
    s.roomId = 'cellar';
    s.prevRoomId = 'alley';
    s.visited.push('alley', 'cellar');
    s.items.torch.loc = 'player';
  };

  test('afterAction lighting change refreshes the room', () => {
    const c = variant((c) => {
      c.afterAction = [...c.afterAction, { if: [{ in: 'cellar' }, '!lamp_lit'], setFlag: 'lamp_lit', setItem: { torch: { lit: true } } }];
    });
    const g = newGame(c);
    g.start();
    setup(g, inCellar);
    const ev = g.input('wait');
    assert.deepEqual(pictures(ev), ['cellar']);
    const t = texts(ev);
    assert.ok(t.includes('Cellar') && t.includes('Damp brick vaults. Somewhere, water drips.'), t.join(' | '));
    assert.ok(ev.findIndex((e) => e.type === 'picture') < ev.findIndex((e) => e.text === 'Cellar'));
  });

  test('onEnter lighting change replaces the initial dark display', () => {
    const c = variant((c) => {
      c.rooms.cellar.onEnter = { if: { lit: false }, setItem: { torch: { lit: true } } };
    });
    const g = newGame(c);
    g.start();
    setup(g, (s) => {
      s.roomId = 'alley';
      s.visited.push('alley');
      s.items.torch.loc = 'player';
    });
    const ev = g.input('d');
    assert.deepEqual(pictures(ev), [null, 'cellar'], 'dark picture on entry, then exactly one refresh');
    const t = texts(ev);
    assert.equal(t[0], MESSAGES.darkTitle);
    assert.ok(t.lastIndexOf('Cellar') > t.indexOf(MESSAGES.dark), t.join(' | '));
    assert.equal(t.filter((x) => x === 'Damp brick vaults. Somewhere, water drips.').length, 1);
  });

  test('a beat that puts the light out shows the darkness once', () => {
    const c = variant((c) => {
      c.beats = [...c.beats, { id: 'blackout', when: { in: 'cellar' }, run: { setItem: { torch: { lit: false } } } }];
    });
    const g = newGame(c);
    g.start();
    setup(g, (s) => { inCellar(s); s.items.torch.lit = true; });
    const ev = g.input('wait');
    assert.deepEqual(pictures(ev), [null]);
    assert.equal(texts(ev).filter((x) => x === MESSAGES.dark).length, 1);
  });
});

/* ------------------------------------------------------------------------ *
 *  #6 hooks see the executing command (A5 context table)                    *
 * ------------------------------------------------------------------------ */

describe('R1 #6: command context for handler-triggered hooks', () => {
  test('movement onEnter and EXAMINE text hooks receive the executing command', () => {
    const c = variant((c) => {
      c.rooms.pub.onEnter = { hook: 'enterCmd' };
      c.items.torch.desc = { hook: 'torchDesc' };
      c.hooks.enterCmd = (api, args) => { api.say(`Entered by ${args.cmd.verb} ${args.cmd.dir} (${args.phase}, ${args.self}).`); };
      c.hooks.torchDesc = (api, args) => `Examined via ${args.cmd.verb} (${args.phase}, ${args.self}).`;
    });
    const g = newGame(c);
    g.start();
    assert.ok(texts(g.input('n')).includes('Entered by go n (onEnter, pub).'));
    play(g, 's', 'e');
    assert.ok(texts(g.input('examine torch')).includes('Examined via examine (text, torch).'));
  });
});

/* ------------------------------------------------------------------------ *
 *  #7 pending questions are validated in full (A11 V12)                     *
 * ------------------------------------------------------------------------ */

describe('R1 #7: malformed pending questions', () => {
  const disambig = (patch) => ({
    kind: 'disambig', text: 'Which do you mean, the brass key or the iron key?',
    command: { verb: 'take', verbWord: 'take', dobj: { words: ['key'] }, raw: 'take key' },
    slot: 'dobj', candidates: ['brass_key', 'iron_key'], bound: {}, ...patch,
  });

  test('malformed pending noun phrase rejects LOAD and preserves state and UNDO', () => {
    const g = newGame();
    g.start();
    g.input('n');                              // UNDO snapshot exists
    const before = g.snapshot();
    const data = g.save();
    data.state.ctx.pending = disambig({ command: { verb: 'take', raw: 'take key', dobj: { words: 17 } } });
    const r = g.load(data);
    assert.equal(r.ok, false);
    assert.match(r.error, /state\.ctx\.pending\.command/);
    assert.deepEqual(r.events, []);
    assert.deepEqual(g.snapshot(), before);
    assert.ok(texts(g.input('undo')).includes(MESSAGES.undone));
  });

  test('every malformed part of a disambiguation question is rejected; a well-formed one loads', () => {
    const g = newGame();
    const save = (pending) => {
      const data = g.save();
      data.state.ctx.pending = pending;
      return data;
    };
    assert.equal(validateSave(save(disambig({})), mini).ok, true);
    const listCmd = { verb: 'take', verbWord: 'take', dobj: { list: [{ words: ['torch'] }, { words: ['key'] }] }, raw: 'take torch and key' };
    assert.equal(validateSave(save(disambig({ command: listCmd, index: 1, bound: { dobj: ['torch'] } })), mini).ok, true);
    const bad = {
      'missing verbWord': disambig({ command: { verb: 'take', dobj: { words: ['key'] }, raw: 'take key' } }),
      'unknown verb': disambig({ command: { verb: 'frobnicate', verbWord: 'frob', dobj: { words: ['key'] }, raw: 'frob key' } }),
      'empty words': disambig({ command: { verb: 'take', verbWord: 'take', dobj: { words: [] }, raw: 'take' } }),
      'two phrase forms': disambig({ command: { verb: 'take', verbWord: 'take', dobj: { words: ['key'], pronoun: 'it' }, raw: 'take key' } }),
      'bad pronoun': disambig({ command: { verb: 'take', verbWord: 'take', dobj: { pronoun: 'she' }, raw: 'take she' } }),
      'slot missing from command': disambig({ slot: 'iobj' }),
      'duplicate candidates': disambig({ candidates: ['brass_key', 'brass_key'] }),
      'index without a list': disambig({ index: 0 }),
      'index past the list': disambig({ command: listCmd, index: 2, bound: { dobj: ['torch'] } }),
      'list prefix not an array': disambig({ command: listCmd, index: 1, bound: { dobj: 'torch' } }),
      'bound slot being asked': disambig({ bound: { dobj: 'brass_key' } }),
      'unknown bound key': disambig({ bound: { zobj: 'torch' } }),
      'bad prep': disambig({ command: { verb: 'take', verbWord: 'take', dobj: { words: ['key'] }, prep: 7, raw: 'take key' } }),
    };
    for (const [why, pending] of Object.entries(bad)) {
      assert.equal(validateSave(save(pending), mini).ok, false, why);
    }
  });
});

/* ------------------------------------------------------------------------ *
 *  #8 API mutations keep the A3 invariants                                  *
 * ------------------------------------------------------------------------ */

describe('R1 #8: invalid API mutations roll back', () => {
  /** Runs `reaction` as square.before.wait in a non-strict and a strict game. */
  function check(reaction, pattern) {
    const c = variant((c) => { c.rooms.square.before = { wait: reaction }; });
    const g = newGame(c, { strict: false });
    g.start();
    g.input('look');
    const before = g.snapshot();
    const ev = g.input('wait');
    assert.ok(isEngineError(ev), JSON.stringify(ev));
    assert.match(ev[0].text, pattern);
    assert.deepEqual(g.snapshot(), before);
    assert.equal(g.load(g.save()).ok, true, 'the committed state is still loadable');
    const strict = newGame(c);
    strict.start();
    assert.throws(() => strict.input('wait'), pattern);
  }

  test('move into a non-container rolls back', () => {
    check({ say: 'Click.', move: { brass_key: 'torch' } }, /not a container/);
  });

  test('wearing an uncarried item through setItem rolls back', () => {
    check({ setItem: { helmet: { worn: true } } }, /worn but not carried/);
  });

  test('non-finite money / nerve deltas roll back', () => {
    check({ money: Infinity }, /money/);
    check({ nerve: NaN }, /nerve/);
  });
});

/* ------------------------------------------------------------------------ *
 *  #9 terminal storage failures (A10.1, A10.2)                              *
 * ------------------------------------------------------------------------ */

describe('R1 #9: tools/play.js storage failures', () => {
  test('SAVE and EXPORT write failures allow subsequent commands', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tallyman-r1-'));
    try {
      const blocker = join(dir, 'not-a-dir');
      writeFileSync(blocker, 'x');
      const game = createGame({ content: cloneContent(mini), seed: 1 });
      const lines = [];
      const host = createHost(game, { saves: join(blocker, 'saves'), verbose: false, importFile: null }, (l) => lines.push(l));
      host.render(game.start());
      const step = (line) => {
        lines.length = 0;
        host.render(game.input(line));
        return [...lines];
      };
      const saved = step('save 1');
      assert.ok(saved.some((l) => l.startsWith('Couldn\'t write')), saved.join(' | '));
      assert.ok(saved.includes('Saved in slot 1 for this session only. Use EXPORT to keep a copy.'), saved.join(' | '));
      const exported = step('export');
      assert.ok(exported.some((l) => l.startsWith('Couldn\'t export')), exported.join(' | '));
      assert.ok(step('n').includes('The Black Lamb'), 'play continues');
      const loaded = step('load 1');
      assert.ok(loaded.includes('Restored from slot 1.'), loaded.join(' | '));
      assert.equal(game.snapshot().roomId, 'square', 'the in-memory save was restored');
      const imported = step('import');
      assert.ok(imported.includes('Save imported.'), imported.join(' | '));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

/* ------------------------------------------------------------------------ *
 *  Non-blocking (a): non-finite numbers in lint                             *
 * ------------------------------------------------------------------------ */

describe('R1 note 1: non-finite numbers', () => {
  test('lint rejects non-finite reaction and condition numbers', () => {
    const c = variant((c) => {
      c.rooms.square.before = { wait: [{ if: { moneyGte: NaN }, money: Infinity }, { nerve: -Infinity, pause: Infinity }] };
      c.rooms.pub.before = { wait: { setVar: { bells: { add: Infinity } } } };
    });
    const r = lintContent(c, { hasGlyph });
    const paths = r.errors.map((e) => e.path);
    for (const p of ['rooms.square.before.wait[0].if.moneyGte', 'rooms.square.before.wait[0].money',
      'rooms.square.before.wait[1].nerve', 'rooms.square.before.wait[1].pause', 'rooms.pub.before.wait.setVar.bells']) {
      assert.ok(paths.includes(p), `${p} not reported: ${paths.join(', ')}`);
    }
  });
});
