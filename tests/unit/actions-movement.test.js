// TT-008 — movement family (ARCHITECTURE A8.3, A7.5 step 1 hazards, A8.4 BRIEF) on the mini-world.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MESSAGES } from '../../src/engine/types.js';
import { messages as moveMessages } from '../../src/engine/actions/movement.js';
import mini from '../fixtures/mini-world.js';
import {
  newGame, cloneContent, texts, types, last, play, setup,
} from '../fixtures/harness.js';

const turn = (g) => g.snapshot().turn;
const room = (g) => g.snapshot().roomId;

test('a direction moves the player: room, picture, description, then status', () => {
  const g = newGame();
  const ev = g.input('north');
  assert.deepEqual(types(ev).slice(0, 3), ['room', 'picture', 'text']);
  assert.equal(room(g), 'pub');
  assert.equal(g.snapshot().prevRoomId, 'square');
  assert.deepEqual(g.snapshot().visited, ['square', 'pub']);
  assert.equal(last(ev).type, 'status');
});

test('GO <dir>, WALK <dir> and abbreviations are the same command', () => {
  for (const line of ['go north', 'walk n', 'n', 'head north']) {
    const g = newGame();
    g.input(line);
    assert.equal(room(g), 'pub', line);
  }
});

test('no exit: cantGo, still 1 turn', () => {
  const g = newGame();
  const ev = g.input('ne');
  assert.deepEqual(texts(ev), [MESSAGES.cantGo]);
  assert.equal(turn(g), 1);
});

test('blocked conditional exit says its msg; the exit opens once the flag is set', () => {
  const g = newGame();
  play(g, 's');
  assert.deepEqual(texts(g.input('e')), ['The yard gate is bolted from the other side.']);
  setup(g, (s) => { s.flags.gate_unbolted = true; });
  g.input('e');
  assert.equal(room(g), 'office');
});

test('a closed door blocks: "The oak door is closed."', () => {
  const g = newGame();
  play(g, 'n');
  assert.deepEqual(texts(g.input('e')), ['The oak door is closed.']);
  assert.equal(moveMessages.doorClosed, '{The} is closed.');
});

test('hidden exits are not listed and act as no exit while closed', () => {
  const g = newGame();
  setup(g, (s) => { s.roomId = 'back_room'; s.visited.push('back_room'); });
  const look = texts(g.input('look'));
  assert.ok(look.includes('Exits: west.'));
  assert.deepEqual(texts(g.input('d')), [MESSAGES.cantGo]);
  setup(g, (s) => { s.flags.trapdoor_open = true; });
  assert.ok(texts(g.input('look')).includes('Exits: west, down.'));
});

test('a stub target says the stub message (content override) and the player stays', () => {
  const g = newGame();
  assert.deepEqual(texts(g.input('w')), [mini.messages.stub]);
  assert.equal(room(g), 'square');
  assert.equal(turn(g), 1);
});

test('darkness rule: only the way back; other exits darkMove', () => {
  const g = newGame();
  setup(g, (s) => { s.flags.trapdoor_open = true; });
  play(g, 's', 'd');
  assert.equal(room(g), 'cellar');
  assert.deepEqual(texts(g.input('n')), [MESSAGES.darkMove]);
  assert.deepEqual(texts(g.input('e')), [MESSAGES.darkMove], 'no exit at all in the dark');
  g.input('u');
  assert.equal(room(g), 'alley');
});

test('darkness rule has no softlock: with no exit back every exit is allowed', () => {
  const g = newGame();
  setup(g, (s) => {
    s.flags.trapdoor_open = true;
    s.roomId = 'cellar';
    s.prevRoomId = 'office';
    s.visited.push('cellar');
  });
  g.input('n');
  assert.equal(room(g), 'back_room');
});

test('BACK returns to the previous room; without one it refuses', () => {
  const g = newGame();
  assert.deepEqual(texts(g.input('back')), [moveMessages.noBack]);
  play(g, 'n');
  g.input('back');
  assert.equal(room(g), 'square');
  g.input('return');
  assert.equal(room(g), 'pub');
});

test('bare ENTER / EXIT / CLIMB UP / CLIMB DOWN map to in / out / u / d', () => {
  const content = cloneContent(mini);
  content.rooms.square = { ...content.rooms.square, exits: { ...content.rooms.square.exits, in: 'pub' } };
  content.rooms.pub = { ...content.rooms.pub, exits: { ...content.rooms.pub.exits, out: 'square' } };
  const g = newGame(content);
  g.input('enter');
  assert.equal(room(g), 'pub');
  g.input('go out');
  assert.equal(room(g), 'square');
  play(g, 's');
  g.input('climb down');
  assert.equal(room(g), 'cellar');
  g.input('climb up');
  assert.equal(room(g), 'alley');
  assert.deepEqual(texts(g.input('get out')), [MESSAGES.cantGo]);
});

test('ENTER X runs X\'s before reaction first, else tries IN', () => {
  const content = cloneContent(mini);
  content.items.crate = { ...content.items.crate, before: { enter: 'You would never fit in the crate.' } };
  const g = newGame(content);
  setup(g, (s) => { s.roomId = 'back_room'; s.visited.push('back_room'); });
  assert.deepEqual(texts(g.input('enter crate')), ['You would never fit in the crate.']);
  content.items.crate.before = {};
  const g2 = newGame(content);
  setup(g2, (s) => { s.roomId = 'back_room'; s.visited.push('back_room'); });
  assert.deepEqual(texts(g2.input('enter crate')), [MESSAGES.cantGo]);
});

test('exit hazard: warned once (1 turn, alert), then fatal', () => {
  const g = newGame();
  play(g, 'e');
  const warn = g.input('d');
  assert.deepEqual(warn.filter((e) => e.type === 'text'), [
    { type: 'text', style: 'alert', text: mini.hazards.drain.warn },
  ]);
  assert.equal(room(g), 'office');
  assert.deepEqual(g.snapshot().warned, ['drain']);
  assert.equal(turn(g), 2);
  const death = g.input('down');
  assert.equal(last(death).type, 'end');
  assert.equal(g.snapshot().ended, 'death_fall');
});

test('verb hazard (SWIM in the alley) also triggers without an object (C31)', () => {
  const g = newGame();
  play(g, 's');
  assert.deepEqual(texts(g.input('swim')), [mini.hazards.canal.warn]);
  assert.equal(last(g.input('jump')).ending, 'death_drown');
});

test('BRIEF omits the prose on re-visits only; VERBOSE restores it', () => {
  const g = newGame();
  g.input('brief');
  const first = texts(g.input('n'));
  assert.ok(first.includes('A low-beamed pub thick with pipe smoke. A heavy oak door leads east.'), 'first visit is full');
  g.input('s');
  const again = texts(g.input('n'));
  assert.ok(!again.includes('A low-beamed pub thick with pipe smoke. A heavy oak door leads east.'));
  assert.equal(again[0], 'The Black Lamb');
  assert.ok(again.includes('Exits: east, south.'));
  assert.ok(texts(g.input('look')).includes('A low-beamed pub thick with pipe smoke. A heavy oak door leads east.'), 'LOOK is always full');
  g.input('verbose');
  g.input('s');
  assert.ok(texts(g.input('n')).includes('A low-beamed pub thick with pipe smoke. A heavy oak door leads east.'));
});

test('onEnter runs after the description, every entry, and visited is marked after it', () => {
  const content = cloneContent(mini);
  content.rooms.pub = { ...content.rooms.pub, onEnter: { if: { not: { visited: 'pub' } }, say: 'First time here.' } };
  const g = newGame(content);
  const t = texts(g.input('n'));
  assert.equal(last(t), 'First time here.');
  g.input('s');
  assert.ok(!texts(g.input('n')).includes('First time here.'));
});

test('the cellar onEnter fires when lit on entry', () => {
  const g = newGame();
  setup(g, (s) => { s.items.torch.loc = 'player'; s.items.torch.lit = true; });
  play(g, 's');
  const t = texts(g.input('d'));
  assert.equal(t[0], 'Cellar');
  assert.ok(t.includes('Your light catches the glint of old bottles.'));
});
