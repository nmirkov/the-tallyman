import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../../src/engine/state.js';
import * as W from '../../src/engine/world.js';
import mini from '../fixtures/mini-world.js';

const fresh = () => createState(mini, 1);
/** callHook stand-in: runs the fixture's hooks with a minimal api. */
const callHook = (state) => (id, args) => mini.hooks[id]({ turn: state.turn, state }, args);

/* ---------------------------------------------------------------- containment */

test('inventory is derived from loc === player, in content order', () => {
  const s = fresh();
  assert.deepEqual(W.inventory(s), ['warrant_card']);
  W.moveItem(s, 'brass_key', 'player');
  W.moveItem(s, 'torch', 'player');
  assert.deepEqual(W.inventory(s), ['warrant_card', 'torch', 'brass_key']);
});

test('locationOf, contentsOf, isCarried (through a carried bag), roomOf (walks containers)', () => {
  const s = fresh();
  assert.equal(W.locationOf(s, 'handcuffs'), 'satchel');
  assert.equal(W.locationOf(s, 'maggie'), 'pub');
  assert.equal(W.locationOf(s, 'whisky'), null);
  assert.equal(W.locationOf(s, 'nonsense'), null);
  assert.deepEqual(W.contentsOf(s, 'table'), ['coin', 'jar']);
  assert.deepEqual(W.contentsOf(s, 'office'), ['torch', 'satchel', 'register', 'helmet']);
  assert.equal(W.isCarried(s, 'handcuffs'), false);
  W.moveItem(s, 'satchel', 'player');
  assert.equal(W.isCarried(s, 'handcuffs'), true, 'inside a carried bag counts');
  assert.equal(W.isCarried(s, 'satchel'), true);
  assert.equal(W.roomOf(s, 'handcuffs'), 'square', 'carried → the player\'s room');
  assert.equal(W.roomOf(s, 'button'), 'back_room', 'jar → table → back_room');
  assert.equal(W.roomOf(s, 'oak_door'), 'pub');
  assert.equal(W.roomOf(s, 'whisky'), null);
  assert.equal(W.roomOf(s, 'pike'), 'office', 'NPCs too');
  W.moveItem(s, 'coin', 'maggie');
  assert.equal(W.roomOf(s, 'coin'), 'pub', 'held by an NPC → the NPC\'s room');
});

test('moveItem refuses containment cycles and unknown items; leaving the player un-wears', () => {
  const s = fresh();
  assert.throws(() => W.moveItem(s, 'satchel', 'satchel'), /cycle/);
  W.moveItem(s, 'jar', 'satchel');
  assert.throws(() => W.moveItem(s, 'satchel', 'jar'), /cycle/);
  assert.throws(() => W.moveItem(s, 'ghost', 'pub'), /unknown item/);
  W.moveItem(s, 'helmet', 'player');
  s.items.helmet.worn = true;
  W.moveItem(s, 'helmet', 'office');
  assert.equal(s.items.helmet.worn, false);
  W.moveNpc(s, 'pike', null);
  assert.equal(s.npcs.pike.loc, null);
  assert.throws(() => W.moveNpc(s, 'ghost', 'pub'), /unknown NPC/);
});

test('movePlayer records the room left; markVisited keeps visited unique', () => {
  const s = fresh();
  W.movePlayer(s, 'pub');
  assert.equal(s.roomId, 'pub');
  assert.equal(s.prevRoomId, 'square');
  assert.deepEqual(s.visited, ['square'], 'visited is added after onEnter, by the caller');
  W.markVisited(s, 'pub');
  W.markVisited(s, 'pub');
  assert.deepEqual(s.visited, ['square', 'pub']);
});

/* ---------------------------------------------------------------- light */

test('isLit: non-dark rooms are lit; a dark room needs a lit light source that reaches it', () => {
  const s = fresh();
  assert.equal(W.isLit(s, mini, 'square'), true);
  assert.equal(W.isLit(s, mini, 'cellar'), false);
  s.items.torch.lit = true;
  assert.equal(W.isLit(s, mini, 'cellar'), false, 'lit torch in another room');
  W.moveItem(s, 'torch', 'cellar');
  assert.equal(W.isLit(s, mini, 'cellar'), true, 'lit torch lying in the room');
  W.moveItem(s, 'torch', 'player');
  assert.equal(W.isLit(s, mini, 'cellar'), false, 'carried, but the player is elsewhere');
  W.movePlayer(s, 'cellar');
  assert.equal(W.isLit(s, mini, 'cellar'), true, 'carried by the player in the room');
  assert.equal(W.isLit(s, mini), true, 'roomId defaults to the player\'s room');
  W.moveItem(s, 'satchel', 'player');
  W.moveItem(s, 'torch', 'satchel');
  assert.equal(W.isLit(s, mini, 'cellar'), false, 'closed opaque container blocks light');
  s.items.satchel.open = true;
  assert.equal(W.isLit(s, mini, 'cellar'), true, 'open container lets it through');
  W.moveItem(s, 'jar', 'cellar');
  W.moveItem(s, 'torch', 'jar');
  assert.equal(W.isLit(s, mini, 'cellar'), true, 'closed transparent container lets it through');
  s.items.torch.lit = false;
  assert.equal(W.isLit(s, mini, 'cellar'), false);
});

/* ---------------------------------------------------------------- scope */

test('scope (lit): room items incl. alsoIn door, NPCs, scenery ids, carried, supporter / open / transparent contents', () => {
  const s = fresh();
  W.movePlayer(s, 'back_room');
  const sc = W.scope(s, mini);
  // crate closed → ledger hidden from view; coin hidden; jar transparent → button visible.
  assert.deepEqual(sc.items, ['warrant_card', 'oak_door', 'crate', 'rug', 'table', 'jar', 'button']);
  assert.deepEqual(sc.npcs, []);
  assert.deepEqual(sc.scenery, []);
  assert.deepEqual(sc.ids, sc.items);
  s.items.crate.open = true;
  s.items.coin.hidden = false;
  assert.deepEqual(W.visibleItems(s, mini), ['warrant_card', 'oak_door', 'crate', 'ledger_page', 'rug', 'table', 'coin', 'jar', 'button']);

  W.movePlayer(s, 'square');
  const sq = W.scope(s, mini);
  assert.deepEqual(sq.items, ['warrant_card']);
  assert.deepEqual(sq.scenery, ['square#0', 'square#1']);
  assert.deepEqual(sq.exits, ['n', 'e', 's', 'w']);

  W.movePlayer(s, 'office');
  const of = W.scope(s, mini);
  assert.deepEqual(of.items, ['warrant_card', 'torch', 'satchel', 'register', 'helmet'], 'closed satchel hides handcuffs');
  assert.deepEqual(of.npcs, ['pike']);
  assert.deepEqual(of.ids, [...of.items, 'pike', 'office#0'], 'listing order: items, NPCs, scenery');
});

test('scope (unlit): carried items and contents of carried open containers only', () => {
  const s = fresh();
  W.movePlayer(s, 'cellar');
  W.moveItem(s, 'satchel', 'player');
  const dark = W.scope(s, mini);
  assert.deepEqual(dark.items, ['warrant_card', 'satchel'], 'iron key on the floor is not visible; closed satchel');
  assert.deepEqual(dark.npcs, []);
  assert.deepEqual(dark.scenery, []);
  s.items.satchel.open = true;
  assert.deepEqual(W.scope(s, mini).items, ['warrant_card', 'satchel', 'handcuffs'], 'by touch');
  W.moveNpc(s, 'maggie', 'cellar');
  assert.deepEqual(W.scope(s, mini).npcs, [], 'NPCs are not visible in the dark');
});

test('items held by NPCs or out of the world are never in scope', () => {
  const s = fresh();
  W.movePlayer(s, 'pub');
  W.moveItem(s, 'brass_key', 'maggie');
  const sc = W.scope(s, mini);
  assert.ok(!sc.items.includes('brass_key'));
  assert.ok(!sc.items.includes('whisky'));
  assert.deepEqual(sc.npcs, ['maggie']);
});

test('isVisible / isReachable: transparent closed jar contents are visible but not reachable', () => {
  const s = fresh();
  W.movePlayer(s, 'back_room');
  assert.equal(W.isVisible(s, mini, 'button'), true);
  assert.equal(W.isReachable(s, mini, 'button'), false);
  assert.equal(W.isReachable(s, mini, 'jar'), true, 'on a supporter is reachable');
  s.items.jar.open = true;
  assert.equal(W.isReachable(s, mini, 'button'), true);
  assert.equal(W.isVisible(s, mini, 'coin'), false, 'hidden');
  assert.equal(W.isVisible(s, mini, 'back_room#0'), false, 'no such scenery');
  W.movePlayer(s, 'square');
  assert.equal(W.isVisible(s, mini, 'square#1'), true);
  assert.equal(W.isReachable(s, mini, 'square#1'), true);
  assert.equal(W.isVisible(s, mini, 'button'), false);
});

/* ---------------------------------------------------------------- exits */

test('exitsOf: DIRECTIONS order, doors, conditions, hidden exits, stubs', () => {
  const s = fresh();
  const ch = callHook(s);
  const pub = W.exitsOf(s, mini, 'pub', ch);
  assert.deepEqual(pub.map((e) => e.dir), ['e', 's']);
  const east = pub.find((e) => e.dir === 'e');
  assert.equal(east.to, 'back_room');
  assert.equal(east.door, 'oak_door');
  assert.equal(east.passable, false, 'door closed');
  assert.equal(east.listed, true);
  s.items.oak_door.open = true;
  assert.equal(W.exitsOf(s, mini, 'pub', ch).find((e) => e.dir === 'e').passable, true);

  const alley = W.exitsOf(s, mini, 'alley', ch);
  const gate = alley.find((e) => e.dir === 'e');
  assert.equal(gate.condOk, false);
  assert.equal(gate.passable, false);
  assert.equal(gate.listed, true, 'blocked, not hidden → still listed');
  assert.equal(gate.msg, 'The yard gate is bolted from the other side.');

  const back = W.exitsOf(s, mini, 'back_room', ch);
  assert.deepEqual(back.filter((e) => e.listed).map((e) => e.dir), ['w'], 'hidden trapdoor omitted');
  s.flags.trapdoor_open = true;
  assert.deepEqual(W.exitsOf(s, mini, 'back_room', ch).filter((e) => e.listed).map((e) => e.dir), ['w', 'd']);

  const sq = W.exitsOf(s, mini, 'square', ch);
  assert.equal(sq.find((e) => e.dir === 'w').stub, true);
  assert.equal(sq.find((e) => e.dir === 'n').stub, false);
  assert.equal(W.exitsOf(s, mini, undefined, ch).length, 4, 'defaults to the player\'s room');
});

/* ---------------------------------------------------------------- time */

test('timeString: 21:30 + 30 s per turn, wraps at midnight', () => {
  assert.equal(W.timeString(0), '21:30');
  assert.equal(W.timeString(1), '21:30');
  assert.equal(W.timeString(2), '21:31');
  assert.equal(W.timeString(142), '22:41');
  assert.equal(W.timeString(208), '23:14');
  assert.equal(W.timeString(299), '23:59');
  assert.equal(W.timeString(300), '00:00');
  assert.equal(W.timeString(330), '00:15');
});

/* ---------------------------------------------------------------- conditions */

test('test(): every Cond form', () => {
  const s = fresh();
  const t = (c) => W.test(c, s, mini, callHook(s));
  // flags
  assert.equal(t('trapdoor_open'), false);
  assert.equal(t('!trapdoor_open'), true);
  s.flags.trapdoor_open = true;
  assert.equal(t('trapdoor_open'), true);
  assert.equal(t({ flag: 'trapdoor_open' }), true);
  assert.equal(t(undefined), true, 'absent condition holds');
  // combinators
  assert.equal(t([]), true);
  assert.equal(t(['trapdoor_open', '!gate_unbolted']), true);
  assert.equal(t({ all: ['trapdoor_open', 'gate_unbolted'] }), false);
  assert.equal(t({ any: ['gate_unbolted', 'trapdoor_open'] }), true);
  assert.equal(t({ any: [] }), false);
  assert.equal(t({ not: 'gate_unbolted' }), true);
  // vars
  assert.equal(t({ var: 'pikeState', eq: 'desk' }), true);
  assert.equal(t({ var: 'pikeState', ne: 'desk' }), false);
  assert.equal(t({ var: 'pikeState', oneOf: ['fled', 'desk'] }), true);
  s.vars.bells = 3;
  assert.equal(t({ var: 'bells', gt: 2 }), true);
  assert.equal(t({ var: 'bells', gte: 4 }), false);
  assert.equal(t({ var: 'bells', lt: 4 }), true);
  assert.equal(t({ var: 'bells', lte: 2 }), false);
  assert.equal(t({ var: 'pikeState', gt: 0 }), false, 'non-number compares false');
  assert.equal(t({ var: 'arrivalTurn', lt: 10 }), false, 'null compares false');
  // place / objects
  assert.equal(t({ in: 'square' }), true);
  assert.equal(t({ in: ['pub', 'office'] }), false);
  assert.equal(t({ zone: 'town' }), true);
  assert.equal(t({ visited: 'square' }), true);
  assert.equal(t({ visited: 'pub' }), false);
  assert.equal(t({ carried: 'warrant_card' }), true);
  assert.equal(t({ carried: 'torch' }), false);
  assert.equal(t({ at: ['torch', 'office'] }), true);
  assert.equal(t({ at: ['whisky', null] }), true);
  assert.equal(t({ at: ['pike', 'office'] }), true);
  assert.equal(t({ present: 'warrant_card' }), true);
  assert.equal(t({ present: 'pike' }), false);
  W.movePlayer(s, 'office');
  assert.equal(t({ present: 'pike' }), true);
  assert.equal(t({ present: 'torch' }), true);
  assert.equal(t({ present: 'handcuffs' }), false, 'inside closed satchel');
  assert.equal(t({ open: 'satchel' }), false);
  assert.equal(t({ locked: 'oak_door' }), true);
  assert.equal(t({ on: 'torch' }), false);
  s.items.torch.lit = true;
  assert.equal(t({ on: 'torch' }), true);
  assert.equal(t({ lit: true }), true);
  W.movePlayer(s, 'cellar');
  assert.equal(t({ lit: false }), true);
  // clock / counters
  s.turn = 120;
  assert.equal(t({ turnGte: 120 }), true);
  assert.equal(t({ turnLt: 120 }), false);
  assert.equal(t({ turnGte: { var: 'arrivalTurn' } }), false, 'var form false while null');
  assert.equal(t({ turnLt: { var: 'arrivalTurn' } }), false);
  s.vars.arrivalTurn = 100;
  assert.equal(t({ turnGte: { var: 'arrivalTurn' } }), true);
  assert.equal(t({ moneyGte: 500 }), true);
  assert.equal(t({ moneyGte: 501 }), false);
  assert.equal(t({ nerveGte: 10 }), true);
  s.awarded.push('torch_lit');
  s.notes.push('register');
  s.evidence.push('ev_register');
  assert.equal(t({ awarded: 'torch_lit' }), true);
  assert.equal(t({ noted: 'register' }), true);
  assert.equal(t({ found: 'ev_register' }), true);
  assert.equal(t({ found: 'ev_ledger' }), false);
  assert.equal(t({ evidence: 1 }), true);
  assert.equal(t({ evidence: 2 }), false);
  // hooks
  assert.equal(t({ hook: 'is_late' }), false);
  s.turn = 250;
  assert.equal(t({ hook: 'is_late' }), true);
});

test('test(): malformed conditions and hook conditions without callHook throw (developer errors)', () => {
  const s = fresh();
  assert.throws(() => W.test({ flag: 'a', in: 'square' }, s, mini), /condition/);
  assert.throws(() => W.test({ colour: 'red' }, s, mini), /condition/);
  assert.throws(() => W.test({ var: 'bells' }, s, mini), /condition/);
  assert.throws(() => W.test({ var: 'bells', eq: 1, gt: 0 }, s, mini), /condition/);
  assert.throws(() => W.test(42, s, mini), /condition/);
  assert.throws(() => W.test({ hook: 'is_late' }, s, mini), /callHook/);
});

test('test() is pure: it never changes state', () => {
  const s = fresh();
  const before = JSON.stringify(s);
  W.test([{ present: 'pike' }, { lit: true }, { evidence: 0 }, { hook: 'is_late' }], s, mini, callHook(s));
  assert.equal(JSON.stringify(s), before);
});

test('evidenceCount: facts once found, items only while carried', () => {
  const s = fresh();
  assert.equal(W.evidenceCount(s, mini), 0);
  s.evidence.push('ev_register', 'ev_ledger');
  assert.equal(W.evidenceCount(s, mini), 1, 'ledger page not carried');
  W.moveItem(s, 'ledger_page', 'player');
  assert.equal(W.evidenceCount(s, mini), 2);
  W.moveItem(s, 'satchel', 'player');
  W.moveItem(s, 'ledger_page', 'satchel');
  assert.equal(W.evidenceCount(s, mini), 2, 'inside a carried bag still counts');
  W.moveItem(s, 'satchel', 'square');
  assert.equal(W.evidenceCount(s, mini), 1, 'dropping lowers the count');
});

test('sceneryOf resolves derived scenery ids', () => {
  assert.equal(W.sceneryOf(mini, 'square#1').names[0], 'fountain');
  assert.equal(W.sceneryOf(mini, 'square#5'), null);
  assert.equal(W.sceneryOf(mini, 'torch'), null);
});
