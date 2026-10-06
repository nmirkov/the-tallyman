// TT-008 — game loop (ARCHITECTURE A2, A7, A9.3): the A15 worked example, chains and
// barriers, pending precedence, UNDO, RESTART, refresh bundles, error containment.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGame } from '../../src/engine/game.js';
import { MESSAGES, LIMITS, EVENT_TYPES, TERMINAL_EVENT_TYPES } from '../../src/engine/types.js';
import a15 from '../fixtures/a15-world.js';
import mini from '../fixtures/mini-world.js';
import {
  newGame, cloneContent, texts, types, last, play, setup,
} from '../fixtures/harness.js';

/** A15 status event, nerve included (D6 is live since TT-010, so A15 is asserted exactly). */
const status = (room, roomId, time, score, turns, nerve) => ({ type: 'status', room, roomId, time, score, maxScore: 10, nerve, turns });
const sys = (text) => ({ type: 'text', style: 'system', text });
const txt = (text) => ({ type: 'text', text });
const title = (text) => ({ type: 'text', style: 'title', text });

describe('A15 worked example', () => {
  const game = newGame(a15);

  test('start() is the refresh bundle with intro', () => {
    assert.deepEqual(game.start(), [
      { type: 'clear' },
      { type: 'room', id: 'platform', name: 'Platform' },
      { type: 'picture', id: 'platform', graphics: true },
      { type: 'ambient', id: 'rain' },
      { type: 'music', id: 'stop' },
      status('Platform', 'platform', '21:30', 0, 0, 10),
      txt('The last train pulls away into the rain.'),
      title('Platform'),
      txt('Rain hammers the canopy of a deserted platform. The waiting room lies north.'),
      txt('Exits: north.'),
    ]);
  });

  test('input 1: N', () => {
    assert.deepEqual(game.input('N'), [
      { type: 'room', id: 'waiting', name: 'Waiting Room' },
      { type: 'picture', id: 'waiting_room', graphics: true },
      title('Waiting Room'),
      txt('A cold waiting room. A hatch in the floor stands open.'),
      txt('You can see a brass key, an iron key and a torch here.'),
      txt('Exits: south, down.'),
      { type: 'ambient', id: 'none' },
      status('Waiting Room', 'waiting', '21:30', 0, 1, 9),
    ]);
  });

  test('input 2: TAKE KEY asks (free) and stores the A3.3 pending', () => {
    assert.deepEqual(game.input('TAKE KEY'), [
      { type: 'prompt', kind: 'disambig', text: 'Which do you mean, the brass key or the iron key?' },
    ]);
    const s = game.snapshot();
    assert.equal(s.turn, 1);
    assert.deepEqual(s.ctx.pending, {
      kind: 'disambig', text: 'Which do you mean, the brass key or the iron key?',
      command: { verb: 'take', verbWord: 'take', dobj: { words: ['key'] }, raw: 'take key' },
      slot: 'dobj', candidates: ['brass_key', 'iron_key'], bound: {},
    });
  });

  test('input 3: BRASS completes take brass_key (1 turn)', () => {
    assert.deepEqual(game.input('BRASS'), [
      txt('Taken.'),
      { type: 'sfx', id: 'pickup' },
      status('Waiting Room', 'waiting', '21:31', 0, 2, 8),
    ]);
    assert.deepEqual(game.snapshot().ctx, {
      it: 'brass_key', them: [], npc: null,
      lastCommand: { verb: 'take', verbWord: 'take', dobj: 'brass_key', raw: 'take key' }, pending: null,
    });
  });

  test('input 4: TAKE TORCH THEN SAVE 2 THEN S', () => {
    const ev = game.input('TAKE TORCH THEN SAVE 2 THEN S');
    const storage = ev.pop();
    assert.deepEqual(ev, [
      txt('Taken.'),
      { type: 'sfx', id: 'pickup' },
      sys('[Your score has gone up by 5 points.]'),
      status('Waiting Room', 'waiting', '21:31', 5, 3, 7),
      sys('(Commands after SAVE were ignored.)'),
    ]);
    assert.equal(storage.type, 'storage');
    assert.equal(storage.op, 'save');
    assert.equal(storage.slot, 2);
    assert.deepEqual(storage.data.summary, { room: 'Waiting Room', time: '21:31', score: 5, turns: 3 });
    assert.equal(storage.data.format, 'tallyman-save');
    assert.equal(storage.data.game, 'mini');
    assert.equal(storage.data.state.turn, 3);
    assert.equal(storage.data.state.roomId, 'waiting');
  });

  test('input 5: D into the dark cellar', () => {
    assert.deepEqual(game.input('D'), [
      { type: 'room', id: 'cellar', name: 'Cellar' },
      { type: 'picture', id: null, graphics: true },
      title('Darkness'),
      txt('It is pitch dark. You can\'t see a thing, but you could feel your way back the way you came.'),
      { type: 'ambient', id: 'drone' },
      status('Cellar', 'cellar', '21:32', 5, 4, 12),
    ]);
  });

  test('input 6: UNDO restores the state before input 5', () => {
    assert.deepEqual(game.input('UNDO'), [
      { type: 'clear' },
      { type: 'room', id: 'waiting', name: 'Waiting Room' },
      { type: 'picture', id: 'waiting_room', graphics: true },
      { type: 'ambient', id: 'none' },
      { type: 'music', id: 'stop' },
      status('Waiting Room', 'waiting', '21:31', 5, 3, 7),
      title('Waiting Room'),
      txt('A cold waiting room. A hatch in the floor stands open.'),
      txt('You can see an iron key here.'),
      txt('Exits: south, down.'),
      sys('(Undone.)'),
    ]);
  });

  test('one-liners from the same position', () => {
    const base = game.save();
    const from = () => {
      const g = newGame(a15);
      g.load(base);
      return g;
    };
    assert.deepEqual(from().input('UNDO'), [sys('You can\'t undo any further.')]);
    assert.deepEqual(from().input('xyzzy. n'), [sys('I don\'t know the word "xyzzy".'), sys('(Commands after XYZZY were ignored.)')]);
    const again = from().input('again');
    assert.deepEqual(again, [txt('You already have that.'), status('Waiting Room', 'waiting', '21:32', 5, 4, 6)]);
    assert.deepEqual(from().input('load 2 then n'), [sys('(Commands after LOAD were ignored.)'), { type: 'storage', op: 'load', slot: 2 }]);
    assert.deepEqual(texts(from().input('drop torch')), ['Dropped.']);
    assert.deepEqual(texts(from().input('throw torch')), ['You\'d better hang on to that.']);
  });
});

describe('chains and barriers (A7.2)', () => {
  test('LOAD 1 THEN NORTH: north discarded, notice before the storage request, nothing simulated', () => {
    const g = newGame();
    g.start();
    const before = g.snapshot();
    const ev = g.input('load 1 then north');
    assert.deepEqual(ev, [sys('(Commands after LOAD were ignored.)'), { type: 'storage', op: 'load', slot: 1 }]);
    assert.deepEqual(g.snapshot(), before);
  });

  test('chain runs commands in order, each with its own turn; in-world failures do not stop it', () => {
    const g = newGame();
    const ev = g.input('n. e. s');
    const t = texts(ev);
    assert.equal(t[0], 'The Black Lamb');
    assert.ok(t.includes('The oak door is closed.'));
    assert.ok(t.indexOf('The oak door is closed.') < t.indexOf('Market Square'));
    assert.equal(g.snapshot().turn, 3);
    assert.equal(ev.filter((e) => e.type === 'status').length, 3);
    assert.equal(g.snapshot().roomId, 'square');
  });

  test('parse and resolution errors stop the chain for free', () => {
    const g = newGame();
    assert.deepEqual(g.input('take banana then n'), [sys('I don\'t know the word "banana".'), sys('(Commands after TAKE were ignored.)')]);
    // TT-131: an absent person named by name is "<Name> isn't here." (resolve.js personNotHere).
    assert.deepEqual(g.input('take maggie, n'), [sys('Maggie isn\'t here.'), sys('(Commands after TAKE were ignored.)')]);
    assert.equal(g.snapshot().turn, 0);
  });

  test('meta commands do not stop a chain and cost nothing', () => {
    const g = newGame();
    const ev = g.input('i. score. n');
    assert.equal(g.snapshot().roomId, 'pub');
    assert.equal(g.snapshot().turn, 1);
    assert.match(texts(ev)[0], /^You are carrying:/);
  });

  test('a prompt stops the chain; the notice goes before it', () => {
    const g = newGame();
    setup(g, (s) => { s.items.iron_key.loc = 'alley'; });
    play(g, 's');
    const ev = g.input('take key. n');
    assert.deepEqual(ev, [sys('(Commands after TAKE were ignored.)'), { type: 'prompt', kind: 'disambig', text: 'Which do you mean, the brass key or the iron key?' }]);
  });

  test('a disambiguation answer completes the command and the rest of the chain continues', () => {
    const g = newGame();
    setup(g, (s) => { s.items.iron_key.loc = 'alley'; });
    play(g, 's', 'take key');
    const ev = g.input('iron. n');
    assert.equal(texts(ev)[0], 'Taken.');
    assert.equal(g.snapshot().roomId, 'square');
    assert.equal(g.snapshot().items.iron_key.loc, 'player');
    assert.equal(g.snapshot().turn, 3);
  });

  test('SAVE n / LOAD n / EXPORT / IMPORT / QUIT events; bad slot asks for one', () => {
    const g = newGame();
    assert.deepEqual(g.input('save'), [sys('Which slot? Type SAVE 1, SAVE 2 or SAVE 3.')]);
    assert.deepEqual(g.input('restore 9'), [sys('Which slot? Type RESTORE 1, RESTORE 2 or RESTORE 3.')]);
    const save = last(g.input('n. save 3'));
    assert.equal(save.type, 'storage');
    assert.equal(save.data.state.roomId, 'pub', 'saved state includes the chain\'s earlier commands');
    const exp = g.input('export');
    assert.equal(exp.length, 1);
    assert.equal(exp[0].type, 'host');
    assert.equal(exp[0].op, 'export');
    assert.equal(exp[0].data.state.roomId, 'pub');
    assert.deepEqual(g.input('import'), [{ type: 'host', op: 'import' }]);
    assert.deepEqual(g.input('quit'), [{ type: 'prompt', kind: 'confirm', text: MESSAGES.quitConfirm }]);
    assert.deepEqual(g.input('y'), [{ type: 'host', op: 'quit' }]);
  });

  test('QUIT then NO cancels for free', () => {
    const g = newGame();
    g.input('quit');
    assert.deepEqual(g.input('n'), [sys(MESSAGES.confirmCancelled)]);
    assert.equal(g.snapshot().ctx.pending, null);
    assert.equal(g.snapshot().roomId, 'square', 'n meant NO, not north');
  });

  test('chain length is capped at 16; the notice names the 16th segment', () => {
    const g = newGame();
    const line = Array(20).fill('wait').join('. ').replace(/wait$/, 'look');
    const ev = g.input(line.split('. ').map((w, i) => (i === 15 ? 'z' : w)).join('. '));
    assert.equal(g.snapshot().turn, LIMITS.chainLength);
    assert.deepEqual(last(ev), sys('(Commands after Z were ignored.)'));
  });

  test('extra segments after a world STOP (ending) are discarded before the end event', () => {
    const g = newGame();
    play(g, 'e');
    g.input('d');
    const ev = g.input('d. n. n');
    assert.equal(last(ev).type, 'end');
    assert.deepEqual(ev[ev.length - 2], sys('(Commands after D were ignored.)'));
  });
});

describe('pending questions (A7.3)', () => {
  function withPrompt() {
    const g = newGame();
    setup(g, (s) => { s.items.iron_key.loc = 'alley'; });
    play(g, 's', 'take key');
    return g;
  }

  test('empty line re-emits the prompt verbatim, free', () => {
    const g = withPrompt();
    const p = g.snapshot().ctx.pending.text;
    assert.deepEqual(g.input(''), [{ type: 'prompt', kind: 'disambig', text: p }]);
    assert.deepEqual(g.input('   '), [{ type: 'prompt', kind: 'disambig', text: p }]);
  });

  test('without a pending question an empty line is "I beg your pardon?"', () => {
    assert.deepEqual(newGame().input(''), [sys(MESSAGES.empty)]);
  });

  test('SAVE keeps the pending question and stores it; loading that save restores the prompt', () => {
    const g = withPrompt();
    const ev = g.input('save 1');
    assert.equal(ev[0].type, 'storage');
    assert.notEqual(g.snapshot().ctx.pending, null);
    assert.notEqual(ev[0].data.state.ctx.pending, null);
    const g2 = newGame();
    const r = g2.load(ev[0].data);
    assert.equal(r.ok, true);
    assert.deepEqual(last(r.events), { type: 'prompt', kind: 'disambig', text: 'Which do you mean, the brass key or the iron key?' });
    assert.equal(r.events[0].type, 'clear');
    assert.equal(texts(g2.input('brass'))[0], 'Taken.');
  });

  test('a non-answer clears the question and runs as a new command', () => {
    const g = withPrompt();
    const ev = g.input('n');
    assert.equal(g.snapshot().ctx.pending, null);
    assert.equal(g.snapshot().roomId, 'square');
    assert.equal(ev[0].type, 'room');
  });

  test('UNDO while pending: snapshot restored (pending = snapshot\'s) or cantUndo keeps it', () => {
    const g = withPrompt();
    const ev = g.input('undo');
    assert.deepEqual(last(ev), sys('(Undone.)'));
    assert.equal(g.snapshot().roomId, 'square');
    assert.equal(g.snapshot().ctx.pending, null);
    const g2 = newGame();
    setup(g2, (s) => { s.items.iron_key.loc = 'square'; s.items.brass_key.loc = 'square'; });
    g2.input('take key');
    assert.deepEqual(g2.input('undo'), [sys(MESSAGES.cantUndo)]);
    assert.notEqual(g2.snapshot().ctx.pending, null);
  });

  test('RESTART while pending replaces the question with the restart confirmation', () => {
    const g = withPrompt();
    assert.deepEqual(g.input('restart'), [{ type: 'prompt', kind: 'confirm', text: MESSAGES.restartConfirm }]);
    assert.equal(g.snapshot().ctx.pending.kind, 'confirm');
    const ev = g.input('yes');
    assert.equal(ev[0].type, 'clear');
    assert.equal(g.snapshot().turn, 0);
    assert.ok(texts(ev).includes(mini.rules.intro.replace('{time}', '21:30')));
  });

  test('a confirmation followed by anything else is cancelled, then the segment runs', () => {
    const g = newGame();
    g.input('restart');
    const ev = g.input('n. n');
    assert.deepEqual(ev[0], sys(MESSAGES.confirmCancelled));
    assert.equal(ev.length, 2, 'NO stops the chain');
    g.input('restart');
    const ev2 = g.input('look');
    assert.deepEqual(ev2[0], sys(MESSAGES.confirmCancelled));
    assert.equal(ev2[1].text, 'Market Square');
    assert.equal(g.snapshot().turn, 1);
  });

  test('ActionDef.confirm asks first (free); YES runs the command with confirmed:true (1 turn)', () => {
    let seen = null;
    const actions = {
      pray: {
        verb: 'pray',
        confirm: (cmd) => ({ kind: 'confirm', text: 'Really pray? (Y/N)', command: cmd, cancelText: 'You think better of it.' }),
        run: (cmd, api) => { seen = cmd; api.say('Amen.'); return { ok: true }; },
      },
    };
    const g = newGame(mini, { actions });
    assert.deepEqual(g.input('pray'), [{ type: 'prompt', kind: 'confirm', text: 'Really pray? (Y/N)' }]);
    assert.equal(g.snapshot().turn, 0);
    assert.deepEqual(g.input('no'), [txt('You think better of it.')]);
    g.input('pray');
    const ev = g.input('y');
    assert.equal(ev[0].text, 'Amen.');
    assert.equal(seen.confirmed, true);
    assert.equal(g.snapshot().turn, 1);
    assert.equal(g.snapshot().ctx.lastCommand.confirmed, undefined);
  });
});

describe('UNDO (A7.8)', () => {
  test('N. UNDO. S — UNDO restores the before-line state, S is discarded', () => {
    const g = newGame();
    g.start();
    const before = g.snapshot();
    const ev = g.input('n. undo. s');
    const s = g.snapshot();
    assert.deepEqual(s, before);
    assert.deepEqual(last(ev), sys('(Commands after UNDO were ignored.)'));
    assert.ok(ev.some((e) => e.type === 'clear'));
    assert.deepEqual(g.input('undo'), [sys(MESSAGES.cantUndo)], 'one level only');
  });

  test('lines of only free commands, errors or SAVE never touch the snapshot', () => {
    const g = newGame();
    play(g, 'n', 'i', 'score', 'xyzzy', 'save 1', 'take banana');
    g.input('undo');
    assert.equal(g.snapshot().roomId, 'square');
    assert.equal(g.snapshot().turn, 0);
  });

  test('UNDO after a death restores the state before the fatal line', () => {
    const g = newGame();
    play(g, 'e', 'd');
    const ev = g.input('d');
    assert.equal(last(ev).type, 'end');
    assert.equal(g.snapshot().ended, 'death_fall');
    const u = g.undo();
    assert.deepEqual(last(u), sys('(Undone.)'));
    assert.equal(g.snapshot().ended, null);
    assert.equal(g.snapshot().roomId, 'office');
    assert.deepEqual(g.snapshot().warned, ['drain']);
  });

  test('game.undo() is identical to typing UNDO', () => {
    const a = newGame();
    const b = newGame();
    play(a, 'n', 'take candle');
    play(b, 'n', 'take candle');
    assert.deepEqual(a.undo(), b.input('UNDO'));
    assert.deepEqual(a.snapshot(), b.snapshot());
  });

  test('successful LOAD and RESTART clear the snapshot', () => {
    const g = newGame();
    g.input('n');
    const data = g.save();
    g.input('s');
    assert.equal(g.load(data).ok, true);
    assert.deepEqual(g.input('undo'), [sys(MESSAGES.cantUndo)]);
    g.input('n');
    g.restart();
    assert.deepEqual(g.input('undo'), [sys(MESSAGES.cantUndo)]);
  });
});

describe('RESTART', () => {
  test('N. RESTART mid-chain asks for confirmation after N ran', () => {
    const g = newGame();
    const ev = g.input('n. restart');
    assert.equal(ev[0].type, 'room');
    assert.deepEqual(last(ev), { type: 'prompt', kind: 'confirm', text: MESSAGES.restartConfirm });
    assert.equal(g.snapshot().roomId, 'pub');
    const r = g.input('y');
    assert.equal(r[0].type, 'clear');
    assert.equal(g.snapshot().roomId, 'square');
    assert.equal(g.snapshot().turn, 0);
  });

  test('game.restart() reuses the original seed, needs no confirmation, includes the intro', () => {
    const g = createGame({ content: cloneContent(mini), seed: 77, strict: true });
    const first = g.start();
    g.input('n');
    assert.deepEqual(g.restart(), first);
    assert.equal(g.snapshot().seed, 77);
  });
});

describe('ended game (A7.1 step 2, A7.7)', () => {
  function dead() {
    const g = newGame();
    play(g, 'e', 'd', 'd');
    return g;
  }

  test('the fatal turn still runs the clock, status and end (C10)', () => {
    const g = newGame();
    play(g, 'e', 'd');
    const ev = g.input('d');
    assert.deepEqual(types(ev).slice(-2), ['status', 'end']);
    const end = last(ev);
    assert.equal(end.ending, 'death_fall');
    assert.equal(end.kind, 'death');
    assert.equal(end.title, 'The Drain');
    assert.equal(end.text, 'You fall a long way in the dark.');
    assert.equal(end.rank, 'Probationer');
    assert.equal(end.turns, 3);
    assert.equal(g.snapshot().turn, 3);
  });

  test('only UNDO / LOAD / RESTART / IMPORT are accepted', () => {
    const g = dead();
    for (const line of ['look', 'n', '', 'save 1', 'xyzzy', 'again', 'quit']) {
      assert.deepEqual(g.input(line), [sys(MESSAGES.gameOver)], line);
    }
    assert.deepEqual(g.input('load 2'), [{ type: 'storage', op: 'load', slot: 2 }]);
    assert.deepEqual(g.input('import'), [{ type: 'host', op: 'import' }]);
    const r = g.input('restart');
    assert.equal(r[0].type, 'clear', 'RESTART needs no confirmation when ended');
    assert.equal(g.snapshot().ended, null);
  });

  test('ended-mode barrier with a chain gets the notice', () => {
    const g = dead();
    const ev = g.input('undo. n');
    assert.deepEqual(ev[ev.length - 1], sys('(Commands after UNDO were ignored.)'));
  });

  test('loading an ended game refreshes with the end event last', () => {
    const g = dead();
    const data = g.save();
    const g2 = newGame();
    const r = g2.load(JSON.stringify(data));
    assert.equal(r.ok, true);
    assert.deepEqual(types(r.events).slice(0, 6), ['clear', 'room', 'picture', 'ambient', 'music', 'status']);
    assert.equal(last(r.events).type, 'end');
    assert.equal(last(r.events).text, 'You fall a long way in the dark.');
    assert.equal(r.events.filter((e) => e.type === 'prompt').length, 0);
    assert.deepEqual(g2.input('look'), [sys(MESSAGES.gameOver)]);
    assert.equal(last(g2.start()).type, 'end');
  });

  test('a `when` ending fires at D8 (victory via a before reaction)', () => {
    const g = newGame();
    setup(g, (s) => { s.items.handcuffs.loc = 'player'; });
    play(g, 'e');
    const ev = g.input('arrest pike. n');
    assert.ok(texts(ev).includes('You snap the cuffs on.'));
    assert.equal(last(ev).type, 'end');
    assert.equal(last(ev).ending, 'victory');
    assert.equal(last(ev).score, 10);
    assert.deepEqual(ev[ev.length - 2], sys('(Commands after ARREST were ignored.)'));
  });
});

describe('refresh bundles (A9.3) and load (A2, A11)', () => {
  test('start() of a non-fresh game has no intro', () => {
    const g = newGame();
    g.input('n');
    const ev = g.start();
    assert.equal(ev[0].type, 'clear');
    assert.ok(!texts(ev).some((t) => t.startsWith('Rain sweeps')));
  });

  test('refresh in the dark gives the darkness text and dark picture', () => {
    const content = cloneContent(mini);
    content.rules.darkPicture = 'cellar';
    const g = createGame({ content, strict: true });
    setup(g, (s) => { s.roomId = 'cellar'; s.visited.push('alley', 'cellar'); s.prevRoomId = 'alley'; });
    const ev = g.start();
    assert.deepEqual(ev[2], { type: 'picture', id: 'cellar', graphics: true });
    assert.deepEqual(texts(ev), ['Darkness', MESSAGES.dark]);
    assert.deepEqual(ev[3], { type: 'ambient', id: 'heartbeat' });
  });

  test('load failure leaves state and UNDO untouched and returns no events', () => {
    const g = newGame();
    g.input('n');
    const before = g.snapshot();
    for (const bad of [null, 42, '{', { format: 'nope' }, { ...g.save(), game: 'other' }]) {
      const r = g.load(bad);
      assert.equal(r.ok, false);
      assert.equal(typeof r.error, 'string');
      assert.deepEqual(r.events, []);
    }
    assert.deepEqual(g.snapshot(), before);
    assert.equal(g.input('undo').at(-1).text, '(Undone.)');
  });

  test('save() is pure; snapshot() and every result are fresh objects (G2)', () => {
    const g = newGame();
    const s1 = g.snapshot();
    s1.roomId = 'pub';
    assert.equal(g.snapshot().roomId, 'square');
    const d = g.save();
    d.state.turn = 99;
    assert.equal(g.save().state.turn, 0);
    const a = g.input('i');
    a[0].text = 'mutated';
    assert.notEqual(g.input('i')[0].text, 'mutated');
  });
});

describe('error containment (A7.9) and determinism (G1)', () => {
  function throwingWorld() {
    const content = cloneContent(mini);
    content.verbs = [...content.verbs, { id: 'boom', words: ['boom'] }];
    content.rooms.pub = { ...content.rooms.pub, before: { boom: { setFlag: 'x', hook: 'explode' } } };
    content.hooks = { ...content.hooks, explode: () => { throw new Error('kaboom'); } };
    return content;
  }

  test('a throwing hook rolls the whole line back and returns engineError (non-strict)', () => {
    const g = createGame({ content: throwingWorld() });
    g.input('n');
    g.input('s');
    const before = g.snapshot();
    const ev = g.input('n. boom');
    assert.deepEqual(ev, [sys('(Something went wrong: kaboom. That command was cancelled.)')]);
    assert.deepEqual(g.snapshot(), before);
    const u = g.input('undo');
    assert.equal(g.snapshot().roomId, 'pub', 'the previous UNDO snapshot survives');
    assert.equal(last(u).text, '(Undone.)');
  });

  test('strict mode rethrows and deep-freezes content', () => {
    const content = throwingWorld();
    const g = createGame({ content, strict: true });
    assert.throws(() => g.input('n. boom'), /kaboom/);
    assert.ok(Object.isFrozen(content.rooms.pub));
  });

  test('output normaliser: curly quotes / dashes mapped; other characters → ? (strict: throws)', () => {
    const content = cloneContent(mini);
    content.messages = { ...content.messages, wait: '‘Tick’ — “tock”… ☺' };
    assert.deepEqual(texts(createGame({ content }).input('wait')), ['\'Tick\' - "tock"... ?']);
    assert.throws(() => createGame({ content: cloneContent(content), strict: true }).input('wait'), /unsupported character/);
  });

  test('input() never throws and always returns well-formed events (fuzz, strict)', () => {
    const words = ['n', 's', 'e', 'w', 'd', 'u', 'take', 'drop', 'all', 'key', 'torch', 'open', 'door', 'satchel', 'put',
      'in', 'on', 'table', 'it', 'them', 'then', '.', ',', 'and', 'undo', 'restart', 'y', 'n', 'save', '1', 'load',
      'again', 'g', 'look', 'x', 'search', 'move', 'rug', 'turn', 'on', 'off', 'unlock', 'with', 'brass', 'iron',
      'eat', 'drink', 'throw', 'wear', 'helmet', 'quit', 'no', 'yes', 'export', 'graphics', 'theme', 'sound', 'i',
      'xyzzy', 'except', 'candle', 'light', 'read', 'register', 'ask', 'maggie', 'about', 'pike', 'z', 'pray'];
    let seed = 12345;
    const rand = (n) => { seed = (seed * 1103515245 + 12345) >>> 0; return seed % n; };
    const g = newGame();
    for (let i = 0; i < 1500; i++) {
      const len = 1 + rand(6);
      const line = Array.from({ length: len }, () => words[rand(words.length)]).join(' ');
      const ev = g.input(line);
      assert.ok(Array.isArray(ev) && ev.length > 0, line);
      for (const e of ev) assert.ok(EVENT_TYPES.includes(e.type), `${line}: ${e.type}`);
      const terminals = ev.filter((e) => TERMINAL_EVENT_TYPES.includes(e.type)
        || (e.type === 'host' && e.op !== 'setting'));
      assert.ok(terminals.length <= 1, `${line}: ${terminals.length} terminal events`);
      if (terminals.length) assert.equal(ev[ev.length - 1], terminals[0], line);
      const s = g.snapshot();
      assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
      if (s.ended) g.input('restart');
    }
    for (const odd of [undefined, null, 42, {}, [], '\u0000\u0001', 'x'.repeat(5000), '...', ', , ,']) {
      assert.ok(Array.isArray(g.input(odd)));
    }
  });

  test('same seed + same inputs ⇒ identical events and states', () => {
    const lines = ['n', 'take candle', 'light candle', 's', 's', 'take key', 'n', 'n', 'unlock door', 'open door', 'e', 'search table', 'take coin'];
    const a = newGame();
    const b = newGame();
    const ea = [a.start(), ...lines.map((l) => a.input(l))];
    const eb = [b.start(), ...lines.map((l) => b.input(l))];
    assert.deepEqual(ea, eb);
    assert.deepEqual(a.snapshot(), b.snapshot());
  });
});

describe('tools/play.js (terminal host, A10.1)', () => {
  test('--script prints a transcript, services SAVE / LOAD / EXPORT / settings and stops at QUIT', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tallyman-play-'));
    try {
      const script = join(dir, 'script.txt');
      writeFileSync(script, ['# comment', 'e', 'take torch', 'save 2', 's', 'load 2', 'load 3', 'export', 'sound off',
        'theme', 'quit', 'y', 'look'].join('\n'));
      const r = spawnSync(process.execPath, ['tools/play.js', '--content', 'tests/fixtures/mini-world.js', '--script', script,
        '--saves', join(dir, 'saves'), '--verbose-events'], { encoding: 'utf8' });
      assert.equal(r.status, 0, r.stderr);
      const out = r.stdout;
      for (const line of ['> e', 'Police Office', 'Taken.', '[sfx: pickup]', '[picture: office]', 'Saved in slot 2.',
        'Restored from slot 2.', 'Slot 3 is empty.', 'Save exported as tallyman-save.json.', 'Sound off.',
        'Theme: ZX Spectrum.', 'Really quit? (Y/N)']) {
        assert.ok(out.includes(line), `missing "${line}"`);
      }
      assert.ok(!out.includes('> look'), 'nothing runs after QUIT');
      assert.ok(existsSync(join(dir, 'saves', 'slot2.json')));
      assert.ok(existsSync(join(dir, 'saves', 'tallyman-save.json')));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
