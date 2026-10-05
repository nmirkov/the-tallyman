// TT-008 — object family (ARCHITECTURE A8.5 objects / containers / doors, A8.7 protection,
// A6.5 ALL, A8.8 discovery on TAKE) on the mini-world.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MESSAGES } from '../../src/engine/types.js';
import { messages as obj } from '../../src/engine/actions/objects.js';
import { protection } from '../../src/engine/actions/protect.js';
import { createState } from '../../src/engine/state.js';
import mini from '../fixtures/mini-world.js';
import {
  newGame, cloneContent, texts, setup,
} from '../fixtures/harness.js';

const at = (g, roomId, extra = () => {}) => setup(g, (s) => {
  s.roomId = roomId;
  if (!s.visited.includes(roomId)) s.visited.push(roomId);
  extra(s);
});
const loc = (g, id) => g.snapshot().items[id].loc;

test('TAKE: Taken. then the pickup sfx; already carried; NPCs; fixed text; scenery', () => {
  const g = newGame();
  at(g, 'office');
  const ev = g.input('take torch');
  assert.deepEqual(ev.slice(0, 2), [{ type: 'text', text: 'Taken.' }, { type: 'sfx', id: 'pickup' }]);
  assert.equal(loc(g, 'torch'), 'player');
  assert.deepEqual(texts(g.input('take torch')), [obj.alreadyHave]);
  assert.deepEqual(texts(g.input('take card')), [obj.alreadyHave], 'personal items included');
  assert.deepEqual(texts(g.input('take pike')), ['The Sergeant Pike wouldn\'t care for that.'], 'non-proper NPCs take "the"');
  assert.deepEqual(texts(g.input('take register')), ['It is chained to the desk.']);
  assert.deepEqual(texts(g.input('take desk')), [MESSAGES.fixed]);
  at(g, 'back_room');
  assert.deepEqual(texts(g.input('take crate')), ['The crate is far too heavy to lift.']);
  assert.deepEqual(texts(g.input('take rug')), [MESSAGES.fixed]);
});

test('TAKE refuses items inside a closed transparent container: You can\'t reach it.', () => {
  const g = newGame();
  at(g, 'back_room');
  assert.deepEqual(texts(g.input('take button')), [obj.cantReach]);
  g.input('open jar');
  assert.equal(texts(g.input('take button'))[0], 'Taken.');
});

test('TAKE of evidence discovers it after Taken. (award follows)', () => {
  const g = newGame();
  at(g, 'back_room', (s) => { s.items.crate.open = true; });
  const ev = g.input('take page');
  assert.deepEqual(ev.filter((e) => e.type !== 'status'), [
    { type: 'text', text: 'Taken.' },
    { type: 'sfx', id: 'pickup' },
    { type: 'text', style: 'system', text: '[Your score has gone up by 10 points.]' },
  ]);
  assert.deepEqual(g.snapshot().evidence, ['ev_ledger']);
});

test('TAKE ALL takes portable items here with per-object prefixes, 1 turn total', () => {
  const g = newGame();
  at(g, 'office');
  const ev = g.input('take all');
  assert.deepEqual(texts(ev), ['Torch: Taken.', 'Satchel: Taken.', 'Helmet: Taken.']);
  assert.equal(g.snapshot().turn, 1);
  assert.deepEqual(g.snapshot().ctx.them, ['torch', 'satchel', 'helmet']);
});

test('TAKE ALL EXCEPT, lists, and TAKE X FROM Y', () => {
  const g = newGame();
  at(g, 'office');
  assert.deepEqual(texts(g.input('take all except satchel')), ['Torch: Taken.', 'Helmet: Taken.']);
  const g2 = newGame();
  at(g2, 'office', (s) => { s.items.satchel.open = true; });
  assert.deepEqual(texts(g2.input('take torch and helmet')), ['Torch: Taken.', 'Helmet: Taken.']);
  assert.deepEqual(texts(g2.input('take cuffs from satchel')), ['Taken.']);
  assert.equal(loc(g2, 'handcuffs'), 'player');
});

test('DROP: not holding; dropped to the room; DROP ALL skips personal and worn items', () => {
  const g = newGame();
  at(g, 'office');
  assert.deepEqual(texts(g.input('drop helmet')), [obj.notHolding]);
  g.input('take torch. take helmet. wear helmet');
  assert.deepEqual(texts(g.input('drop all')), ['Torch: Dropped.']);
  assert.equal(loc(g, 'torch'), 'office');
  assert.deepEqual(texts(g.input('drop card')), [MESSAGES.personal]);
  assert.equal(loc(g, 'warrant_card'), 'player');
});

test('critical items may be dropped (always retrievable)', () => {
  const g = newGame();
  at(g, 'office');
  g.input('take torch');
  assert.deepEqual(texts(g.input('drop torch')), ['Dropped.']);
});

test('PUT IN / ON: open container with room; closed; full; not a container; inside itself', () => {
  const g = newGame();
  at(g, 'office');
  g.input('take satchel. take torch. take helmet');
  assert.deepEqual(texts(g.input('put torch in satchel')), ['The satchel is closed.']);
  g.input('open satchel');
  assert.deepEqual(texts(g.input('put torch in satchel')), ['You put the torch in the satchel.']);
  assert.equal(loc(g, 'torch'), 'satchel');
  assert.deepEqual(texts(g.input('put helmet in satchel')), ['You put the helmet in the satchel.']);
  at(g, 'office', (s) => { s.items.warrant_card.loc = 'player'; s.items.brass_key.loc = 'player'; });
  assert.deepEqual(texts(g.input('put key in satchel')), ['There\'s no room in the satchel.']);
  assert.deepEqual(texts(g.input('put satchel in satchel')), [obj.putInside]);
  assert.deepEqual(texts(g.input('put key on satchel')), ['There\'s no good surface on the satchel.']);
  assert.deepEqual(texts(g.input('put key in helmet')), ['You can\'t put things in the helmet.']);
  assert.deepEqual(texts(g.input('put helmet on table')), [MESSAGES.notHere]);
  assert.deepEqual(texts(g.input('put card in satchel')), [MESSAGES.personal]);
});

test('PUT ON a supporter; PUT IN a supporter is refused', () => {
  const g = newGame();
  at(g, 'back_room', (s) => { s.items.brass_key.loc = 'player'; });
  assert.deepEqual(texts(g.input('put key in table')), ['You can\'t put things in the table.']);
  assert.deepEqual(texts(g.input('put key on table')), ['You put the brass key on the table.']);
  assert.equal(loc(g, 'brass_key'), 'table');
});

test('OPEN / CLOSE: reveals contents, already open / closed, not openable, locked', () => {
  const g = newGame();
  at(g, 'office');
  assert.deepEqual(texts(g.input('open satchel')), ['Opening the satchel reveals some handcuffs.']);
  assert.deepEqual(texts(g.input('open satchel')), ['The satchel is already open.']);
  assert.deepEqual(texts(g.input('close satchel')), ['Closed.']);
  assert.deepEqual(texts(g.input('close satchel')), ['The satchel is already closed.']);
  assert.deepEqual(texts(g.input('open helmet')), [obj.notOpenable]);
  assert.deepEqual(texts(g.input('close helmet')), [obj.notCloseable]);
  at(g, 'pub');
  assert.deepEqual(texts(g.input('open door')), ['The oak door is locked.']);
});

test('UNLOCK without WITH uses the carried keyId "(with the brass key)"; doors emit sfx door', () => {
  const g = newGame();
  at(g, 'pub');
  assert.deepEqual(texts(g.input('unlock door')), ['You have nothing to unlock the oak door with.']);
  at(g, 'pub', (s) => { s.items.brass_key.loc = 'player'; s.items.iron_key.loc = 'player'; });
  assert.deepEqual(texts(g.input('unlock door with iron key')), ['The iron key doesn\'t fit.']);
  assert.deepEqual(texts(g.input('unlock door')), ['(with the brass key)', 'Unlocked.']);
  assert.deepEqual(texts(g.input('unlock door')), ['The oak door isn\'t locked.']);
  const ev = g.input('open door');
  assert.deepEqual(ev.slice(0, 2), [{ type: 'text', text: 'Opened.' }, { type: 'sfx', id: 'door' }]);
  assert.deepEqual(texts(g.input('lock door')), ['You\'ll have to close the oak door first.']);
  g.input('close door');
  assert.deepEqual(texts(g.input('lock door with brass key')), ['Locked.']);
  assert.deepEqual(texts(g.input('lock door')), ['The oak door is already locked.']);
  g.input('e');
  assert.equal(g.snapshot().roomId, 'pub');
});

test('LOCK / UNLOCK things without a lock', () => {
  const g = newGame();
  at(g, 'office');
  assert.deepEqual(texts(g.input('lock satchel')), [obj.cantLock]);
  assert.deepEqual(texts(g.input('unlock helmet')), [obj.cantUnlock]);
  assert.deepEqual(texts(g.input('unlock satchel')), ['The satchel isn\'t locked.']);
});

test('the door is visible and usable from both sides (alsoIn)', () => {
  const g = newGame();
  at(g, 'pub', (s) => { s.items.brass_key.loc = 'player'; });
  g.input('unlock door. open door. e');
  assert.equal(g.snapshot().roomId, 'back_room');
  g.input('close door');
  assert.deepEqual(texts(g.input('w')), ['The oak door is closed.']);
});

test('PUSH / PULL / MOVE: content before reaction, else generic by kind', () => {
  const g = newGame();
  at(g, 'back_room');
  assert.deepEqual(texts(g.input('move rug')), ['You drag the rug aside, uncovering a trapdoor.']);
  assert.ok(g.input('move rug').some((e) => e.type === 'text' && e.text === 'The rug is already pushed aside.'));
  assert.deepEqual(texts(g.input('push crate')), ['The crate won\'t budge.']);
  at(g, 'office');
  assert.deepEqual(texts(g.input('pull helmet')), [obj.nothingHappens]);
  assert.deepEqual(texts(g.input('push pike')), ['The Sergeant Pike wouldn\'t appreciate that.']);
});

test('the rug before reaction emits its sfx before its text (REACTION_ORDER)', () => {
  const g = newGame();
  at(g, 'back_room');
  const ev = g.input('move rug');
  assert.deepEqual(ev.slice(0, 2), [{ type: 'sfx', id: 'door' }, { type: 'text', text: 'You drag the rug aside, uncovering a trapdoor.' }]);
});

test('WEAR / REMOVE', () => {
  const g = newGame();
  at(g, 'office');
  assert.deepEqual(texts(g.input('wear helmet')), [obj.notHolding]);
  g.input('take helmet');
  assert.deepEqual(texts(g.input('wear helmet')), ['You put on the helmet.']);
  assert.equal(g.snapshot().items.helmet.worn, true);
  assert.deepEqual(texts(g.input('wear helmet')), ['You\'re already wearing the helmet.']);
  assert.deepEqual(texts(g.input('wear torch')), [obj.cantWear]);
  assert.deepEqual(texts(g.input('take off helmet')), ['You take off the helmet.']);
  assert.deepEqual(texts(g.input('remove helmet')), [obj.notWorn]);
  assert.match(texts(g.input('i'))[0], /a helmet$/m);
});

test('EAT / DRINK: drinkable reaction then gone; inedible; personal / critical protection', () => {
  const g = newGame();
  at(g, 'office', (s) => { s.items.whisky.loc = 'player'; });
  assert.deepEqual(texts(g.input('drink whisky')), ['It burns all the way down.']);
  assert.equal(loc(g, 'whisky'), null);
  assert.deepEqual(texts(g.input('eat helmet')), [obj.inedible]);
  assert.deepEqual(texts(g.input('drink helmet')), [obj.cantDrink]);
  g.input('take torch');
  assert.deepEqual(texts(g.input('eat torch')), [MESSAGES.critical]);
  assert.deepEqual(texts(g.input('eat card')), [MESSAGES.personal]);
});

test('THROW: dropped ("Thrown."), lost in a sink room, refused for personal / critical', () => {
  const content = cloneContent(mini);
  content.rooms.alley = { ...content.rooms.alley, sink: 'It vanishes into the black water.' };
  const g = newGame(content);
  at(g, 'office');
  g.input('take helmet. take torch');
  assert.deepEqual(texts(g.input('throw helmet')), ['Thrown.']);
  assert.equal(loc(g, 'helmet'), 'office');
  assert.deepEqual(texts(g.input('throw torch at pike')), [MESSAGES.critical]);
  assert.deepEqual(texts(g.input('throw card')), [MESSAGES.personal]);
  g.input('take helmet');
  at(g, 'alley');
  assert.deepEqual(texts(g.input('throw helmet')), ['It vanishes into the black water.']);
  assert.equal(loc(g, 'helmet'), null);
});

test('BREAK: never destroys; critical refused while carried; criticalMsg overrides', () => {
  const content = cloneContent(mini);
  content.items.torch = { ...content.items.torch, criticalMsg: 'You need that torch.' };
  const g = newGame(content);
  at(g, 'office');
  assert.deepEqual(texts(g.input('break torch')), [obj.cantBreak], 'not yet carried: default');
  g.input('take torch');
  assert.deepEqual(texts(g.input('break torch')), ['You need that torch.']);
  assert.deepEqual(texts(g.input('smash card')), [MESSAGES.personal]);
  assert.equal(loc(g, 'torch'), 'player');
});

test('protection runs before content before-slots (C21) and costs a turn', () => {
  const content = cloneContent(mini);
  content.items.warrant_card = { ...content.items.warrant_card, before: { drop: 'You toss it away.' } };
  const g = newGame(content);
  assert.deepEqual(texts(g.input('drop card')), [MESSAGES.personal]);
  assert.equal(g.snapshot().turn, 1);
});

test('protection table (A8.7) for GIVE: accepts entry vs none', () => {
  const s = createState(mini, 1);
  const P = (verb, dobj, iobj) => protection({ verb, dobj, iobj }, s, mini);
  assert.equal(P('give', 'warrant_card', 'maggie'), 'personal');
  assert.equal(P('give', 'torch', 'maggie'), 'critical');
  assert.equal(P('give', 'coin', 'maggie'), null);
  assert.equal(P('show', 'warrant_card', 'maggie'), null);
  assert.equal(P('give', 'handcuffs', 'pike'), 'critical');
  assert.equal(P('tear', 'torch'), null, 'critical but not carried');
  assert.equal(P('drop', 'torch'), null);
  assert.equal(P('look'), null);
});

test('pronouns: IT after a single object, THEM after ALL', () => {
  const g = newGame();
  at(g, 'office');
  g.input('take torch');
  assert.deepEqual(texts(g.input('drop it')), ['Dropped.']);
  g.input('take all');
  assert.deepEqual(texts(g.input('drop them')), ['Torch: Dropped.', 'Satchel: Dropped.', 'Helmet: Dropped.']);
});
