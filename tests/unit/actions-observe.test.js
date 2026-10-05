// TT-008 — observation family (ARCHITECTURE A8.4 description rows, A8.6 SEARCH, READ,
// EXAMINE, LISTEN, SMELL) on the mini-world.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MESSAGES } from '../../src/engine/types.js';
import { messages as obs } from '../../src/engine/actions/observe.js';
import mini from '../fixtures/mini-world.js';
import {
  newGame, cloneContent, texts, setup,
} from '../fixtures/harness.js';

const inBackRoom = (g, extra = () => {}) => setup(g, (s) => {
  s.roomId = 'back_room'; s.prevRoomId = 'pub'; s.visited.push('pub', 'back_room'); extra(s);
});

test('LOOK costs a turn and gives the full A8.4 description in order', () => {
  const g = newGame();
  setup(g, (s) => { s.roomId = 'pub'; s.visited.push('pub'); });
  const ev = g.input('look');
  assert.deepEqual(texts(ev), [
    'The Black Lamb',
    'A low-beamed pub thick with pipe smoke. A heavy oak door leads east.',
    'Maggie is polishing glasses behind the bar.',
    'A stub of tallow candle sits on the windowsill.',
    'You can see the oak door here.',
    'Exits: east, south.',
  ]);
  assert.equal(g.snapshot().turn, 1);
});

test('description rows 5–6: listing, supporters and transparent containers; scenery and hidden items unlisted', () => {
  const g = newGame();
  inBackRoom(g);
  assert.deepEqual(texts(g.input('look')), [
    'Back Room',
    'A cramped store room. A threadbare rug covers most of the floor.',
    'You can see the oak door and a crate here.',
    'On the table you can see a glass jar.',
    'In the glass jar you can see a silver button.',
    'Exits: west.',
  ]);
});

test('an NPC without `here` uses npcHere; an item taken loses its initial sentence', () => {
  const content = cloneContent(mini);
  delete content.npcs.maggie.here;
  const g = newGame(content);
  g.input('n');
  g.input('take candle');
  g.input('drop candle');
  const t = texts(g.input('look'));
  assert.ok(t.includes('Maggie is here.'));
  assert.ok(t.includes('You can see a candle and the oak door here.'));
  assert.ok(!t.includes('A stub of tallow candle sits on the windowsill.'));
});

test('EXAMINE renders desc variants, text hooks, NPC and scenery descriptions', () => {
  const g = newGame();
  assert.deepEqual(texts(g.input('x clock')), ['The clock reads half past nine.']);
  assert.deepEqual(texts(g.input('examine fountain')), ['A stone basin, dry for years.']);
  setup(g, (s) => { s.roomId = 'office'; s.visited.push('office'); s.items.torch.loc = 'player'; });
  assert.deepEqual(texts(g.input('x pike')), [mini.npcs.pike.desc]);
  assert.deepEqual(texts(g.input('x torch')), ['A police torch.']);
  setup(g, (s) => { s.items.torch.lit = true; });
  assert.deepEqual(texts(g.input('x torch')), ['A police torch, burning steadily.']);
});

test('EXAMINE of a container lists contents or says it is closed; it never reveals', () => {
  const g = newGame();
  setup(g, (s) => { s.roomId = 'office'; s.visited.push('office'); });
  assert.deepEqual(texts(g.input('x satchel')), ['A battered leather satchel.', obs.examineClosed]);
  g.input('open satchel');
  assert.deepEqual(texts(g.input('x satchel')), ['A battered leather satchel.', 'In the satchel you can see some handcuffs.']);
  inBackRoom(g);
  assert.deepEqual(texts(g.input('x table')), ['A rickety deal table.', 'On the table you can see a glass jar.']);
  assert.equal(g.snapshot().items.coin.hidden, true);
});

test('EXAMINE with an empty description says nothingSpecial', () => {
  const content = cloneContent(mini);
  content.items.helmet = { ...content.items.helmet, desc: [{ if: 'never', text: 'x' }] };
  const g = newGame(content);
  setup(g, (s) => { s.roomId = 'office'; s.visited.push('office'); });
  assert.deepEqual(texts(g.input('x helmet')), ['You see nothing special about the helmet.']);
});

test('EXAMINE in the dark is too dark (1 turn)', () => {
  const g = newGame();
  setup(g, (s) => { s.roomId = 'cellar'; s.prevRoomId = 'alley'; s.visited.push('cellar'); s.items.torch.loc = 'player'; });
  assert.deepEqual(texts(g.input('x torch')), [MESSAGES.tooDark]);
  assert.equal(g.snapshot().turn, 1);
});

test('SEARCH reveals hidden items in the room through supporters, with `found` text', () => {
  const g = newGame();
  inBackRoom(g);
  assert.deepEqual(texts(g.input('search')), ['Wedged in a crack in the table is a 10p coin.']);
  assert.equal(g.snapshot().items.coin.hidden, false);
  assert.ok(texts(g.input('look')).includes('On the table you can see a 10p coin and a glass jar.'));
  assert.deepEqual(texts(g.input('search')), [obs.nothingFound]);
  assert.equal(texts(g.input('take coin'))[0], 'Taken.');
});

test('SEARCH AROUND is bare SEARCH; SEARCH X reveals only in / on X', () => {
  const g = newGame();
  inBackRoom(g);
  assert.deepEqual(texts(g.input('search around')), ['Wedged in a crack in the table is a 10p coin.']);
  const g2 = newGame();
  inBackRoom(g2);
  assert.deepEqual(texts(g2.input('search crate')), ['The crate is closed.']);
  assert.deepEqual(texts(g2.input('look under table')), ['Wedged in a crack in the table is a 10p coin.']);
  assert.deepEqual(texts(g2.input('search table')), ['On the table you can see a 10p coin and a glass jar.']);
});

test('the default `found` text is "You find <a item>."', () => {
  const content = cloneContent(mini);
  delete content.items.coin.found;
  const g = newGame(content);
  inBackRoom(g);
  assert.deepEqual(texts(g.input('search')), ['You find a 10p coin.']);
});

test('SEARCH does not reach into closed containers; LOOK IN an open one lists it', () => {
  const content = cloneContent(mini);
  content.items.handcuffs = { ...content.items.handcuffs, hidden: true };
  const g = newGame(content);
  setup(g, (s) => { s.roomId = 'office'; s.visited.push('office'); });
  assert.deepEqual(texts(g.input('search')), [obs.nothingFound]);
  g.input('open satchel');
  assert.deepEqual(texts(g.input('search')), ['You find some handcuffs.']);
  const g2 = newGame();
  setup(g2, (s) => { s.roomId = 'office'; s.visited.push('office'); s.items.satchel.open = true; });
  assert.deepEqual(texts(g2.input('look in satchel')), ['In the satchel you can see some handcuffs.']);
});

test('SEARCH in the dark finds nothing; SEARCH an NPC is refused', () => {
  const g = newGame();
  setup(g, (s) => { s.roomId = 'cellar'; s.prevRoomId = 'alley'; s.visited.push('cellar'); });
  assert.deepEqual(texts(g.input('search')), [obs.searchDark]);
  const g2 = newGame();
  g2.input('n');
  assert.deepEqual(texts(g2.input('search maggie')), ['Maggie would not take kindly to being searched.']);
});

test('READ runs `readable` (evidence → note → award); non-readable items are refused', () => {
  const g = newGame();
  setup(g, (s) => { s.roomId = 'office'; s.visited.push('office'); s.turn = 10; });
  const ev = g.input('read register');
  assert.deepEqual(ev.filter((e) => e.type === 'text'), [
    { type: 'text', text: 'The last entry, at 21:35, is in Pike\'s neat hand.' },
    { type: 'text', style: 'system', text: MESSAGES.noted },
    { type: 'text', style: 'system', text: '[Your score has gone up by 5 points.]' },
  ]);
  const s = g.snapshot();
  assert.deepEqual(s.evidence, ['ev_register']);
  assert.deepEqual(s.notes, ['register']);
  assert.deepEqual(s.awarded, ['register']);
  assert.deepEqual(texts(g.input('read helmet')), ['There\'s nothing written on the helmet.']);
});

test('READ in the dark is refused', () => {
  const g = newGame();
  setup(g, (s) => { s.roomId = 'cellar'; s.prevRoomId = 'alley'; s.visited.push('cellar'); s.items.ledger_page.loc = 'player'; });
  assert.deepEqual(texts(g.input('read page')), [obs.readDark]);
});

test('LISTEN / SMELL have generic responses; rooms can override with before slots', () => {
  const g = newGame();
  assert.deepEqual(texts(g.input('listen')), [obs.listenNothing]);
  assert.deepEqual(texts(g.input('smell')), [obs.smellNothing]);
  assert.deepEqual(texts(g.input('listen to fountain')), ['The fountain makes no sound.']);
  assert.deepEqual(texts(g.input('sniff clock')), ['The clock smells much as you would expect.']);
  const content = cloneContent(mini);
  content.rooms.square = { ...content.rooms.square, before: { listen: 'Rain, and the slow tick of the clock.' } };
  assert.deepEqual(texts(newGame(content).input('listen')), ['Rain, and the slow tick of the clock.']);
});
