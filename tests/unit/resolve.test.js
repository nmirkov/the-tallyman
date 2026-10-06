// TT-007 — parser resolution (ARCHITECTURE A6.3–A6.7, A3.3, A7.3, A8.1) on the mini-world.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, serialise, validateSave } from '../../src/engine/state.js';
import { buildVocab } from '../../src/engine/vocab.js';
import { tokenise, splitChain, parseCommand } from '../../src/engine/parser.js';
import {
  resolve, answerPending, repeatLast, recordExecuted, matchTopic, parseErrorResult,
} from '../../src/engine/resolve.js';
import { MESSAGES } from '../../src/engine/types.js';
import mini from '../fixtures/mini-world.js';

const vocab = buildVocab(mini);

/** Mini-world plus a few look-alikes, all offstage (loc null) until a test places them. */
const plus = {
  ...mini,
  items: {
    ...mini.items,
    key_ring: { name: 'key ring', names: ['key ring'], location: null, desc: 'A ring with no keys.' },
    choc: { name: 'chocolate bar', names: ['bar', 'chocolate bar'], adjectives: ['chocolate'], location: null, desc: 'Fry\'s.' },
    small_key: { name: 'small brass key', names: ['key'], adjectives: ['small', 'brass'], location: null, desc: 'Tiny.' },
  },
  npcs: {
    ...mini.npcs,
    barmaid: { name: 'barmaid', names: ['barmaid', 'woman'], location: null, desc: 'Young and tired.' },
  },
};
const plusVocab = buildVocab(plus);

function fresh(room = 'square', world = mini) {
  const s = createState(world, 1);
  s.roomId = room;
  if (!s.visited.includes(room)) s.visited.push(room);
  return s;
}
const place = (s, id, loc) => { s.items[id].loc = loc; };
const seg = (line, v = vocab) => splitChain(tokenise(line), v)[0] ?? [];
const R = (s, line, world = mini, v = vocab) => resolve(parseCommand(seg(line, v), v), s, world, v);
const RP = (s, line) => R(s, line, plus, plusVocab);
const A = (s, line, world = mini, v = vocab) => answerPending(seg(line, v), s, world, v);
const AP = (s, line) => A(s, line, plus, plusVocab);
const ok = (command) => ({ ok: true, command });
const err = (message, params = {}) => ({ ok: false, message, params });

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

/* --------------------------------------------------------------- binding (M1–M4) */

test('single match binds; resolution is pure (frozen state)', () => {
  const s = deepFreeze(fresh('office'));
  assert.deepEqual(R(s, 'take torch'), ok({ verb: 'take', verbWord: 'take', dobj: 'torch', raw: 'take torch' }));
  assert.deepEqual(R(s, 'x the flashlight'), ok({ verb: 'examine', verbWord: 'x', dobj: 'torch', raw: 'x the flashlight' }));
  assert.deepEqual(R(s, 'read duty register'), ok({ verb: 'read', verbWord: 'read', dobj: 'register', raw: 'read duty register' }));
  assert.deepEqual(R(s, 'x police torch').command.dobj, 'torch', 'adjective + noun');
  assert.deepEqual(R(s, 'talk to pike').command.dobj, 'pike', 'NPC');
  assert.deepEqual(R(s, 'x desk').command.dobj, 'office#0', 'scenery id; "desk" is only an adjective of Pike');
});

test('commands without noun slots pass through unchanged', () => {
  const s = fresh();
  assert.deepEqual(R(s, 'n'), ok({ verb: 'go', verbWord: 'n', dir: 'n', raw: 'n' }));
  assert.deepEqual(R(s, 'save 2'), ok({ verb: 'save', verbWord: 'save', arg: '2', raw: 'save 2' }));
  assert.deepEqual(R(s, 'look'), ok({ verb: 'look', verbWord: 'look', raw: 'look' }));
  assert.deepEqual(R(s, 'pray'), ok({ verb: 'pray', verbWord: 'pray', raw: 'pray' }), 'content verb');
});

test('multiword names and every word must belong to the entity (M1, M2)', () => {
  const s = fresh('back_room');
  s.items.crate.open = true;
  assert.equal(R(s, 'take ledger page').command.dobj, 'ledger_page');
  assert.equal(R(s, 'take torn page').command.dobj, 'ledger_page');
  assert.equal(R(s, 'take ledger').command.dobj, 'ledger_page');
  s.roomId = 'alley';
  assert.deepEqual(R(s, 'take iron brass key'), err('notHere'), 'a word foreign to every candidate');
  s.roomId = 'square';
  assert.equal(R(s, 'x town clock').command.dobj, 'square#0', 'scenery multiword name');
  assert.equal(R(s, 'x dry fountain').command.dobj, 'square#1');
});

test('adjective-only phrases match only when nothing matches with a noun (M2 retry)', () => {
  const s = fresh('alley');
  assert.equal(R(s, 'take brass').command.dobj, 'brass_key');
  const p = fresh('office');
  assert.equal(R(p, 'x desk').command.dobj, 'office#0', 'noun match beats adjective-only (Pike has adjective desk)');
  assert.equal(R(p, 'x sergeant').command.dobj, 'pike');
});

test('M4 (a): a candidate whose full name is in the phrase wins', () => {
  const s = fresh('alley', plus);
  place(s, 'key_ring', 'alley');
  assert.equal(RP(s, 'take key').command.dobj, 'brass_key', '"key ring" also has the noun key, but brass key has a whole name');
  assert.equal(RP(s, 'take ring').command.dobj, 'key_ring');
  assert.equal(RP(s, 'take key ring').command.dobj, 'key_ring');
});

test('M4 (b): items and NPCs win over scenery', () => {
  const s = fresh('pub', plus);
  assert.equal(RP(s, 'x bar').command.dobj, 'pub#0');
  place(s, 'choc', 'pub');
  assert.equal(RP(s, 'x bar').command.dobj, 'choc');
  assert.equal(RP(s, 'x counter').command.dobj, 'pub#0');
});

test('M4 (c): the verb\'s prefer narrows (take: notCarried, drop: carried)', () => {
  const s = fresh('alley');
  place(s, 'iron_key', 'player');
  assert.equal(R(s, 'take key').command.dobj, 'brass_key');
  assert.equal(R(s, 'drop key').command.dobj, 'iron_key');
  const pending = R(s, 'x key').pending;
  assert.deepEqual(pending.candidates, ['brass_key', 'iron_key'], 'examine has no prefer');
  const o = fresh('back_room');
  assert.equal(R(o, 'open door').command.dobj, 'oak_door', 'door visible through alsoIn');
});

/* --------------------------------------------------------------- disambiguation (M5) */

test('two equally good matches → PendingDisambig exactly as A3.3; no recency tie-break (C14)', () => {
  const s = fresh('alley');
  place(s, 'iron_key', 'alley');
  s.ctx.it = 'brass_key';
  const r = R(s, 'take key');
  assert.deepEqual(r, {
    pending: {
      kind: 'disambig',
      text: 'Which do you mean, the brass key or the iron key?',
      command: { verb: 'take', verbWord: 'take', dobj: { words: ['key'] }, raw: 'take key' },
      slot: 'dobj', candidates: ['brass_key', 'iron_key'], bound: {},
    },
  });
  assert.equal(s.ctx.pending, null, 'resolve never writes state; the game stores the pending');
});

test('prompt list: three candidates, proper NPCs without "the", content.messages override', () => {
  const s = fresh('alley', plus);
  place(s, 'iron_key', 'alley');
  place(s, 'small_key', 'alley');
  assert.equal(RP(s, 'x key').pending.text, 'Which do you mean, the brass key, the iron key or the small brass key?');
  const p = fresh('pub', plus);
  p.npcs.barmaid.loc = 'pub';
  const r = RP(p, 'x woman');
  assert.deepEqual(r.pending.candidates, ['maggie', 'barmaid']);
  assert.equal(r.pending.text, 'Which do you mean, Maggie or the barmaid?');
  const world = { ...plus, messages: { ...plus.messages, disambig: 'Which one: {list}?' } };
  assert.equal(resolve(parseCommand(seg('x woman', plusVocab), plusVocab), p, world, plusVocab).pending.text,
    'Which one: Maggie or the barmaid?');
});

test('answers: adjective, adjective+noun, fillers and "one", ordinals', () => {
  const s = fresh('alley');
  place(s, 'iron_key', 'alley');
  s.ctx.pending = R(s, 'take key').pending;
  const take = (id) => ok({ verb: 'take', verbWord: 'take', dobj: id, raw: 'take key' });
  assert.deepEqual(A(s, 'brass'), take('brass_key'), 'A15 input 3');
  assert.deepEqual(A(s, 'iron key'), take('iron_key'));
  assert.deepEqual(A(s, 'the iron one'), take('iron_key'));
  assert.deepEqual(A(s, 'first'), take('brass_key'));
  assert.deepEqual(A(s, 'the second one'), take('iron_key'));
  assert.deepEqual(A(s, '2'), take('iron_key'));
  assert.deepEqual(A(s, 'last'), take('iron_key'));
  assert.deepEqual(A(s, 'third'), { notAnswer: true }, 'ordinal out of range');
  assert.notEqual(s.ctx.pending, null, 'answerPending never writes state');
});

test('an answer fitting several candidates re-asks with that subset (free)', () => {
  const s = fresh('alley', plus);
  place(s, 'iron_key', 'alley');
  place(s, 'small_key', 'alley');
  s.ctx.pending = RP(s, 'take key').pending;
  const r = AP(s, 'brass');
  assert.deepEqual(r.pending.candidates, ['brass_key', 'small_key']);
  assert.equal(r.pending.text, 'Which do you mean, the brass key or the small brass key?');
  assert.deepEqual(r.pending.command, s.ctx.pending.command);
  s.ctx.pending = r.pending;
  assert.equal(AP(s, 'small').command.dobj, 'small_key');
  assert.equal(AP(s, 'first').command.dobj, 'brass_key', 'ordinals index the re-asked subset');
  assert.deepEqual(AP(s, 'key').pending.candidates, ['brass_key', 'small_key'], 'still ambiguous → asked again');
});

test('non-answers: verbs, directions, unknown words, empty segment → treated as a new command', () => {
  const s = fresh('alley');
  place(s, 'iron_key', 'alley');
  s.ctx.pending = R(s, 'take key').pending;
  for (const line of ['n', 'take torch', 'drop brass', 'xyzzy', 'look', 'the', 'one', 'fifth']) {
    assert.deepEqual(A(s, line), { notAnswer: true }, line);
  }
  assert.deepEqual(answerPending([], s, mini, vocab), { notAnswer: true });
  assert.deepEqual(answerPending('brass', s, mini, vocab).command.dobj, 'brass_key', 'a string segment is tokenised');
});

test('barriers while a question is pending are flagged so the game keeps the pending (A7.3, C13)', () => {
  const s = fresh('alley');
  place(s, 'iron_key', 'alley');
  s.ctx.pending = R(s, 'take key').pending;
  for (const line of ['save 2', 'save', 'export', 'load 1', 'restore 3', 'import', 'undo', 'restart', 'quit', 'q']) {
    assert.deepEqual(A(s, line), { notAnswer: true, barrier: true }, line);
  }
  s.ctx.pending = { kind: 'confirm', text: 'Are you certain? (Y/N)', command: { verb: 'accuse', verbWord: 'accuse', dobj: 'pike', raw: 'accuse pike' } };
  assert.deepEqual(A(s, 'save 1'), { notAnswer: true, barrier: true }, 'no cancel text for SAVE during a confirmation');
});

test('SAVE while pending: the question is inside the save and survives serialise → load → answer', () => {
  const s = fresh('alley');
  place(s, 'iron_key', 'alley');
  s.ctx.pending = R(s, 'take key').pending;
  const before = JSON.stringify(s);
  assert.deepEqual(A(s, 'save 2'), { notAnswer: true, barrier: true });
  assert.equal(JSON.stringify(s), before, 'state untouched');
  const data = JSON.parse(JSON.stringify(serialise(s, mini)));
  assert.deepEqual(data.state.ctx.pending, s.ctx.pending);
  const loaded = validateSave(data, mini);
  assert.equal(loaded.ok, true, loaded.error);
  assert.deepEqual(loaded.state.ctx.pending, s.ctx.pending);
  assert.deepEqual(A(loaded.state, 'iron'), ok({ verb: 'take', verbWord: 'take', dobj: 'iron_key', raw: 'take key' }));
});

test('pending on the iobj (resolved first), then the dobj; bound slots persist through a save', () => {
  const s = fresh('pub');
  place(s, 'brass_key', 'player');
  place(s, 'iron_key', 'player');
  const r = R(s, 'unlock door with key');
  assert.equal(r.pending.slot, 'iobj');
  assert.deepEqual(r.pending.bound, {}, 'dobj not yet resolved: iobj first (M3)');
  s.ctx.pending = r.pending;
  assert.deepEqual(A(s, 'brass'), ok({
    verb: 'unlock', verbWord: 'unlock', dobj: 'oak_door', prep: 'with', iobj: 'brass_key', raw: 'unlock door with key',
  }));

  const t = fresh('alley');
  place(t, 'iron_key', 'alley');
  t.ctx.pending = R(t, 'put key in key').pending;
  assert.equal(t.ctx.pending.slot, 'iobj');
  const second = A(t, 'iron');
  assert.equal(second.pending.slot, 'dobj');
  assert.deepEqual(second.pending.bound, { iobj: 'iron_key' });
  t.ctx.pending = second.pending;
  const loaded = validateSave(JSON.parse(JSON.stringify(serialise(t, mini))), mini);
  assert.equal(loaded.ok, true, loaded.error);
  assert.deepEqual(A(loaded.state, 'brass'), ok({
    verb: 'put', verbWord: 'put', dobj: 'brass_key', prep: 'in', iobj: 'iron_key', raw: 'put key in key',
  }));
});

test('an answer that completes into a resolution error returns that error', () => {
  const s = fresh('square');
  place(s, 'brass_key', 'player');
  place(s, 'iron_key', 'player');
  s.ctx.pending = R(s, 'unlock door with key').pending;
  assert.deepEqual(A(s, 'brass'), err('notHere'), 'no door in the square');
});

/* --------------------------------------------------------------- confirm answers (A6.7) */

test('confirm: exactly yes/y → command with confirmed; no/n → cancelled; else cancel + new command', () => {
  const s = fresh('office');
  const command = { verb: 'accuse', verbWord: 'accuse', dobj: 'pike', raw: 'accuse pike' };
  s.ctx.pending = { kind: 'confirm', text: 'Are you certain? (Y/N)', command };
  assert.deepEqual(A(s, 'yes'), ok({ ...command, confirmed: true }));
  assert.deepEqual(A(s, 'y'), ok({ ...command, confirmed: true }));
  assert.deepEqual(A(s, 'no'), { ok: false, cancelled: true, message: 'confirmCancelled', params: {} });
  assert.deepEqual(A(s, 'n'), { ok: false, cancelled: true, message: 'confirmCancelled', params: {} }, 'n means NO here (C22)');
  assert.deepEqual(A(s, 'north'), { notAnswer: true, cancel: { message: 'confirmCancelled', params: {} } });
  assert.deepEqual(A(s, 'yes please'), { notAnswer: true, cancel: { message: 'confirmCancelled', params: {} } });
  s.ctx.pending = { ...s.ctx.pending, cancelText: 'You hold your tongue.' };
  assert.deepEqual(A(s, 'no'), { ok: false, cancelled: true, message: 'confirmCancelled', params: {}, text: 'You hold your tongue.' });
  assert.deepEqual(A(s, 'wait'), { notAnswer: true, cancel: { message: 'confirmCancelled', params: {}, text: 'You hold your tongue.' } });
  assert.equal(s.ctx.pending.command.confirmed, undefined, 'stored command not mutated');
});

test('no pending → not an answer', () => {
  assert.deepEqual(A(fresh(), 'brass'), { notAnswer: true });
});

/* --------------------------------------------------------------- scope (M3, A8.1) and M6 */

test('not in scope → notHere; unlit room → tooDark; verb notHere override', () => {
  const s = fresh('square');
  assert.deepEqual(R(s, 'take torch'), err('notHere'));
  assert.deepEqual(R(s, 'x pike'), err('notHere'));
  assert.deepEqual(R(s, 'accuse pike'), { ok: false, message: 'notHere', params: {}, text: 'Accuse who? They\'re not here.' });
  const c = fresh('cellar');
  assert.deepEqual(R(c, 'x key'), err('tooDark'));
  assert.deepEqual(R(c, 'take pike'), err('tooDark'), 'groping (C38) only extends TAKE to loose items on the floor');
  place(c, 'torch', 'player');
  assert.equal(R(c, 'x torch').command.dobj, 'torch', 'carried items are in scope in the dark');
  c.items.torch.lit = true;
  assert.equal(R(c, 'take key').command.dobj, 'iron_key', 'lit by the torch');
});

test('hidden, closed-container and NPC-held items are out of scope; transparent and supporters expose', () => {
  const s = fresh('back_room');
  assert.deepEqual(R(s, 'take coin'), err('notHere'), 'hidden');
  assert.equal(R(s, 'x button').command.dobj, 'button', 'in a transparent jar on a supporter');
  assert.deepEqual(R(s, 'take page'), err('notHere'), 'inside the closed crate');
  const o = fresh('office');
  assert.deepEqual(R(o, 'take cuffs'), err('notHere'));
  o.items.satchel.open = true;
  assert.equal(R(o, 'take cuffs').command.dobj, 'handcuffs');
  const p = fresh('pub');
  place(p, 'brass_key', 'maggie');
  assert.deepEqual(R(p, 'x key'), err('notHere'), 'held by an NPC');
});

test('BUY scope adds items sold by NPCs in the room (M3)', () => {
  const p = fresh('pub');
  assert.deepEqual(R(p, 'buy whisky'), ok({ verb: 'buy', verbWord: 'buy', dobj: 'whisky', raw: 'buy whisky' }));
  assert.deepEqual(R(p, 'buy whisky from maggie').command, {
    verb: 'buy', verbWord: 'buy', dobj: 'whisky', prep: 'from', iobj: 'maggie', raw: 'buy whisky from maggie',
  });
  assert.deepEqual(R(p, 'x whisky'), err('notHere'), 'only BUY sees it');
  assert.deepEqual(R(fresh('square'), 'buy whisky'), err('notHere'), 'seller not here');
});

test('TAKE X FROM Y limits dobj candidates to Y\'s contents (M3)', () => {
  const s = fresh('back_room');
  s.items.crate.open = true;
  assert.deepEqual(R(s, 'take page from crate'), ok({
    verb: 'take', verbWord: 'take', dobj: 'ledger_page', prep: 'from', iobj: 'crate', raw: 'take page from crate',
  }));
  place(s, 'brass_key', 'player');
  assert.deepEqual(R(s, 'take key from crate'), err('notHere'), 'the carried key is visible but not in the crate');
  assert.deepEqual(R(s, 'take page from jar'), err('notHere'));
});

/* --------------------------------------------------------------- pronouns (A6.4) */

test('IT: antecedent, unset, not visible; scenery antecedent', () => {
  const s = fresh('office');
  assert.deepEqual(R(s, 'take it'), err('pronounUnset', { pronoun: 'it' }));
  s.ctx.it = 'torch';
  assert.deepEqual(R(s, 'take it'), ok({ verb: 'take', verbWord: 'take', dobj: 'torch', raw: 'take it' }));
  assert.equal(R(s, 'pick it up').command.dobj, 'torch');
  s.ctx.it = 'candle';
  assert.deepEqual(R(s, 'take it'), err('notHere'));
  const q = fresh('square');
  q.ctx.it = 'square#0';
  assert.equal(R(q, 'x it').command.dobj, 'square#0');
});

test('THEM: visible subset; falls back to IT; non-multi verbs need exactly one', () => {
  const s = fresh('office');
  s.ctx.them = ['torch', 'helmet'];
  assert.deepEqual(R(s, 'take them').command.dobj, ['torch', 'helmet']);
  assert.deepEqual(R(s, 'x them'), err('oneAtATime'));
  s.ctx.them = ['torch', 'candle'];
  assert.equal(R(s, 'x them').command.dobj, 'torch', 'visible subset of one');
  s.ctx.them = [];
  s.ctx.it = 'handcuffs';
  s.items.satchel.open = true;
  assert.equal(R(s, 'take them').command.dobj, 'handcuffs', 'falls back to it');
  s.ctx.it = null;
  assert.deepEqual(R(s, 'take them'), err('pronounUnset', { pronoun: 'them' }));
  s.ctx.them = ['candle'];
  assert.deepEqual(R(s, 'take them'), err('notHere'));
});

test('HIM / HER → ctx.npc', () => {
  const s = fresh('office');
  assert.deepEqual(R(s, 'talk to her'), err('pronounUnset', { pronoun: 'her' }));
  s.ctx.npc = 'pike';
  assert.equal(R(s, 'x him').command.dobj, 'pike');
  assert.deepEqual(R(s, 'give torch to him').command.iobj, 'pike');
  s.ctx.npc = 'maggie';
  assert.deepEqual(R(s, 'talk to her'), err('notHere'));
});

/* --------------------------------------------------------------- ALL, EXCEPT, lists (A6.5) */

test('TAKE ALL: portable, non-hidden items lying in the room, content order, all: true', () => {
  const s = fresh('office');
  assert.deepEqual(R(s, 'take all'), ok({ verb: 'take', verbWord: 'take', dobj: ['torch', 'satchel', 'helmet'], all: true, raw: 'take all' }));
  assert.deepEqual(R(s, 'get everything').command.dobj, ['torch', 'satchel', 'helmet']);
  assert.deepEqual(R(s, 'nick all').command, { verb: 'take', verbWord: 'nick', dobj: ['torch', 'satchel', 'helmet'], all: true, raw: 'nick all' });
  assert.deepEqual(R(fresh('back_room'), 'take all'), err('allNothing', { verbWord: 'take' }), 'fixed, scenery and supporters\' contents excluded');
  assert.deepEqual(R(fresh('square'), 'take all'), err('allNothing', { verbWord: 'take' }));
  assert.deepEqual(R(fresh('cellar'), 'take all').command.dobj, ['iron_key'], 'unlit: loose items on the floor are found by touch (C38)');
  const dark = fresh('cellar');
  place(dark, 'iron_key', 'satchel');
  place(dark, 'satchel', 'cellar');
  dark.items.satchel.open = true;
  assert.deepEqual(R(dark, 'take all').command.dobj, ['satchel'], 'unlit: container contents are not felt');
});

test('ALL EXCEPT: phrases resolved in the same scope and removed', () => {
  const s = fresh('office');
  assert.deepEqual(R(s, 'take all except torch').command.dobj, ['satchel', 'helmet']);
  assert.deepEqual(R(s, 'take all but torch and bag').command.dobj, ['helmet']);
  assert.deepEqual(R(s, 'take all except torch, bag and helmet'), err('allNothing', { verbWord: 'take' }));
  assert.deepEqual(R(s, 'take all except candle'), err('notHere'));
  s.ctx.it = 'helmet';
  assert.deepEqual(R(s, 'take all except it').command.dobj, ['torch', 'satchel']);
  const a = fresh('alley');
  place(a, 'iron_key', 'alley');
  place(a, 'torch', 'alley');
  assert.deepEqual(R(a, 'take all except key').command.dobj, ['torch'], 'an ambiguous exception removes every match');
});

test('DROP ALL: carried directly, not personal, not worn; PUT ALL IN Y: same minus Y', () => {
  const s = fresh('office');
  assert.deepEqual(R(s, 'drop all'), err('allNothing', { verbWord: 'drop' }), 'only the personal warrant card');
  place(s, 'torch', 'player');
  place(s, 'helmet', 'player');
  s.items.helmet.worn = true;
  assert.deepEqual(R(s, 'drop all').command.dobj, ['torch']);
  s.items.helmet.worn = false;
  place(s, 'satchel', 'player');
  s.items.satchel.open = true;
  assert.deepEqual(R(s, 'drop all').command.dobj, ['torch', 'satchel', 'helmet'], 'handcuffs inside the satchel are not direct');
  assert.deepEqual(R(s, 'put all in satchel'), ok({
    verb: 'put', verbWord: 'put', dobj: ['torch', 'helmet'], prep: 'in', iobj: 'satchel', all: true, raw: 'put all in satchel',
  }));
});

test('TAKE ALL FROM Y expands to Y\'s contents', () => {
  const s = fresh('back_room');
  s.items.crate.open = true;
  assert.deepEqual(R(s, 'take all from crate'), ok({
    verb: 'take', verbWord: 'take', dobj: ['ledger_page'], prep: 'from', iobj: 'crate', all: true, raw: 'take all from crate',
  }));
  s.items.crate.open = false;
  assert.deepEqual(R(s, 'take all from crate'), err('allNothing', { verbWord: 'take' }));
});

test('ALL / lists with non-multi verbs or in the iobj are refused (free)', () => {
  const s = fresh('office');
  assert.deepEqual(R(s, 'examine all'), err('allNotAllowed'));
  assert.deepEqual(R(s, 'examine torch and helmet'), err('oneAtATime'));
  place(s, 'torch', 'player');
  assert.deepEqual(R(s, 'put torch in all'), err('allNotAllowed'));
  assert.deepEqual(R(s, 'put torch in satchel and helmet'), err('oneAtATime'));
});

test('lists: resolved in order, deduplicated; an ambiguous element prompts with index', () => {
  const s = fresh('office');
  assert.deepEqual(R(s, 'take torch and helmet'), ok({ verb: 'take', verbWord: 'take', dobj: ['torch', 'helmet'], raw: 'take torch and helmet' }));
  assert.equal(R(s, 'take torch and flashlight').command.dobj, 'torch', 'duplicates collapse to one object');
  assert.deepEqual(R(s, 'take torch and candle'), err('notHere'));

  const a = fresh('alley');
  place(a, 'iron_key', 'alley');
  place(a, 'torch', 'alley');
  const r = R(a, 'take torch and key');
  assert.deepEqual(r.pending, {
    kind: 'disambig', text: 'Which do you mean, the brass key or the iron key?',
    command: { verb: 'take', verbWord: 'take', dobj: { list: [{ words: ['torch'] }, { words: ['key'] }] }, raw: 'take torch and key' },
    slot: 'dobj', candidates: ['brass_key', 'iron_key'], index: 1, bound: { dobj: ['torch'] },
  });
  a.ctx.pending = r.pending;
  assert.deepEqual(A(a, 'iron').command.dobj, ['torch', 'iron_key']);

  a.ctx.pending = R(a, 'take key and torch').pending;
  assert.equal(a.ctx.pending.index, 0);
  const loaded = validateSave(JSON.parse(JSON.stringify(serialise(a, mini))), mini);
  assert.equal(loaded.ok, true, loaded.error);
  assert.deepEqual(A(loaded.state, 'brass').command.dobj, ['brass_key', 'torch'], 'resolution continues after the answer');
});

/* --------------------------------------------------------------- topics (A4.9, M7) */

test('ASK / TELL topics: keywords, then global item / NPC names, else null; never fails', () => {
  const p = fresh('pub');
  assert.deepEqual(R(p, 'ask maggie about the dead girl'), ok({
    verb: 'ask', verbWord: 'ask', dobj: 'maggie', prep: 'about', topic: 'murder', topicText: 'the dead girl',
    raw: 'ask maggie about the dead girl',
  }));
  assert.equal(R(p, 'ask maggie about pike').command.topic, 'pike', 'NPC elsewhere: scope-independent');
  assert.equal(R(p, 'ask landlady about the ledger').command.topic, 'ledger_page');
  assert.equal(R(p, 'ask maggie about killing pike').command.topic, 'murder', 'topic keywords first');
  assert.equal(R(p, 'ask maggie about the weather in spain').command.topic, null);
  assert.equal(R(p, 'tell maggie about it').command.topic, null);
  assert.deepEqual(R(p, 'ask pike about murder'), err('notHere'), 'the NPC must be here');
  assert.equal(matchTopic('Dead  GIRL!', mini), 'murder');
  assert.equal(matchTopic('', mini), null);
  assert.equal(matchTopic(42, null), null);
});

/* --------------------------------------------------------------- AGAIN (A6.6) */

test('AGAIN: nothing to repeat; repeats the stored command; refuses when an id is gone', () => {
  const s = fresh('office');
  assert.deepEqual(repeatLast(s, mini, vocab), err('againNothing'));
  assert.deepEqual(R(s, 'again'), err('againNothing'), 'resolve() delegates AGAIN');
  s.ctx.lastCommand = { verb: 'take', verbWord: 'take', dobj: 'torch', raw: 'take torch' };
  const r = R(s, 'g');
  assert.deepEqual(r, ok({ verb: 'take', verbWord: 'take', dobj: 'torch', raw: 'take torch' }));
  assert.notEqual(r.command, s.ctx.lastCommand, 'a fresh copy');
  s.roomId = 'square';
  assert.deepEqual(repeatLast(s, mini, vocab), err('notHere'));
  s.ctx.lastCommand = { verb: 'look', verbWord: 'look', raw: 'look' };
  assert.deepEqual(repeatLast(s, mini, vocab), ok({ verb: 'look', verbWord: 'look', raw: 'look' }));
  const p = fresh('pub');
  p.ctx.lastCommand = { verb: 'buy', verbWord: 'buy', dobj: 'whisky', raw: 'buy whisky' };
  assert.equal(repeatLast(p, mini, vocab).ok, true, 'a sold item counts as present for BUY');
  p.ctx.lastCommand = { verb: 'take', verbWord: 'take', dobj: ['candle', 'torch'], all: true, raw: 'take all' };
  assert.deepEqual(repeatLast(p, mini, vocab), err('notHere'), 'every id of a multi-object command must be visible');
  p.ctx.lastCommand = { verb: 'accuse', verbWord: 'accuse', dobj: 'pike', raw: 'accuse pike' };
  assert.deepEqual(repeatLast(p, mini, vocab), { ok: false, message: 'notHere', params: {}, text: 'Accuse who? They\'re not here.' });
});

/* --------------------------------------------------------------- ctx updates after execution */

test('recordExecuted: pronouns and lastCommand per A6.4 / A6.6', () => {
  const s = fresh('office');
  recordExecuted(s, mini, { verb: 'take', verbWord: 'take', dobj: 'torch', raw: 'take torch' }, vocab);
  assert.equal(s.ctx.it, 'torch');
  assert.deepEqual(s.ctx.lastCommand, { verb: 'take', verbWord: 'take', dobj: 'torch', raw: 'take torch' });
  recordExecuted(s, mini, { verb: 'take', verbWord: 'take', dobj: ['satchel', 'helmet'], all: true, raw: 'take all' }, vocab);
  assert.deepEqual(s.ctx.them, ['satchel', 'helmet']);
  assert.equal(s.ctx.it, 'torch', 'multi-object leaves it');
  recordExecuted(s, mini, { verb: 'give', verbWord: 'give', dobj: 'torch', prep: 'to', iobj: 'pike', raw: 'give torch to pike' }, vocab);
  assert.equal(s.ctx.npc, 'pike');
  assert.equal(s.ctx.it, 'torch');
  recordExecuted(s, mini, { verb: 'examine', verbWord: 'x', dobj: 'office#0', raw: 'x desk' }, vocab);
  assert.equal(s.ctx.it, 'office#0', 'scenery sets it');
  recordExecuted(s, mini, { verb: 'talk', verbWord: 'talk to', dobj: 'maggie', raw: 'talk to maggie' }, vocab);
  assert.equal(s.ctx.npc, 'maggie');
  assert.equal(s.ctx.it, 'office#0', 'NPC dobj does not set it');
  recordExecuted(s, mini, { verb: 'put', verbWord: 'put', dobj: 'torch', prep: 'in', iobj: 'satchel', raw: 'put torch in satchel' }, vocab);
  assert.equal(s.ctx.it, 'torch', 'an item iobj does not set it');

  const accuse = { verb: 'accuse', verbWord: 'accuse', dobj: 'pike', raw: 'accuse pike', confirmed: true };
  recordExecuted(s, mini, accuse, vocab);
  assert.deepEqual(s.ctx.lastCommand, { verb: 'accuse', verbWord: 'accuse', dobj: 'pike', raw: 'accuse pike' }, 'stored without confirmed');
  assert.equal(accuse.confirmed, true, 'input not mutated');
  const last = s.ctx.lastCommand;
  for (const verb of ['save', 'load', 'undo', 'restart', 'quit', 'export', 'import', 'again', 'yes', 'no']) {
    recordExecuted(s, mini, { verb, verbWord: verb, raw: verb }, vocab);
    assert.equal(s.ctx.lastCommand, last, verb);
  }
  recordExecuted(s, mini, { verb: 'inventory', verbWord: 'i', raw: 'i' }, vocab);
  assert.deepEqual(s.ctx.lastCommand, { verb: 'inventory', verbWord: 'i', raw: 'i' }, 'meta commands are repeatable');
  assert.deepEqual(JSON.parse(JSON.stringify(s.ctx)), s.ctx);
  assert.doesNotThrow(() => recordExecuted(s, mini, null, vocab));
  assert.doesNotThrow(() => recordExecuted(null, mini, { verb: 'look' }, vocab));
});

test('A15 walk-through: TAKE KEY → prompt → BRASS → ctx as documented', () => {
  const s = fresh('alley');
  place(s, 'iron_key', 'alley');
  const r = R(s, 'take key');
  s.ctx.pending = r.pending;
  const a = A(s, 'brass');
  s.ctx.pending = null;
  recordExecuted(s, mini, a.command, vocab);
  assert.deepEqual(s.ctx, {
    it: 'brass_key', them: [], npc: null,
    lastCommand: { verb: 'take', verbWord: 'take', dobj: 'brass_key', raw: 'take key' }, pending: null,
  });
});

/* --------------------------------------------------------------- errors and robustness */

test('parse errors map to their message ids', () => {
  const s = fresh();
  assert.deepEqual(R(s, 'xyzzy'), err('unknownWord', { word: 'xyzzy' }));
  assert.deepEqual(R(s, 'key'), err('noVerb', { word: 'key' }));
  assert.deepEqual(R(s, 'take'), err('missingNoun', { verbWord: 'take' }));
  assert.deepEqual(R(s, 'take key from'), err('noPattern'));
  assert.deepEqual(resolve(parseCommand([], vocab), s, mini, vocab), err('empty'));
  assert.deepEqual(parseErrorResult({ error: 'unknown-word', word: 'zz' }), err('unknownWord', { word: 'zz' }));
  for (const [, r] of [['x', R(s, 'xyzzy')], ['y', R(s, 'take')]]) assert.ok(Object.hasOwn(MESSAGES, r.message));
});

test('never throws on garbage arguments', () => {
  const s = fresh();
  const parsed = parseCommand(seg('take torch'), vocab);
  const garbage = [undefined, null, 0, 'take', [], {}, { verb: 5 }, { verb: 'take', dobj: 5, raw: 'x' },
    { verb: 'take', dobj: { words: 'key' }, raw: 'x' }, { verb: 'take', dobj: { list: 'x' } }, { verb: 'take', dobj: { all: true, except: 3 } },
    { verb: 'take', dobj: { pronoun: 'zz' } }, { verb: 'ask', dobj: { words: ['maggie'] }, topic: 7 }];
  for (const g of garbage) {
    assert.doesNotThrow(() => resolve(g, s, mini, vocab), JSON.stringify(g));
    assert.doesNotThrow(() => answerPending(g, s, mini, vocab));
  }
  for (const st of [undefined, null, {}, { ctx: null }, { ...s, items: null }, { ...s, ctx: { pending: { kind: 'disambig' } } }]) {
    assert.doesNotThrow(() => resolve(parsed, st, mini, vocab));
    assert.doesNotThrow(() => answerPending(['brass'], st, mini, vocab));
    assert.doesNotThrow(() => repeatLast(st, mini, vocab));
  }
  for (const c of [undefined, null, {}, { items: null }]) assert.doesNotThrow(() => resolve(parsed, s, c, vocab));
  assert.equal(resolve(parsed, { ...s, roomId: 'office' }, mini).ok, true, 'vocab optional');
  const weird = { ...s, ctx: { ...s.ctx, pending: { kind: 'disambig', text: 'x', command: { verb: 'take', raw: 'take key' }, slot: 'dobj', candidates: ['brass_key', 'iron_key'], bound: {} } } };
  assert.doesNotThrow(() => answerPending(['brass'], weird, mini, vocab));
});

test('property: random token soups in random rooms never throw and return a well-formed result', () => {
  let seed = 12345;
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) >>> 0; return (seed >>> 16) % n; };
  const words = [...plusVocab.words, 'xyzzy', ',', 'and', 'all', 'except', 'it', 'them', 'him'];
  const rooms = Object.keys(plus.rooms);
  const itemIds = Object.keys(plus.items);
  const msgIds = new Set([...Object.keys(MESSAGES)]);
  const seen = { ok: 0, pending: 0, error: 0 };
  const nouns = [...new Set([...Object.values(plus.items), ...Object.values(plus.npcs)]
    .flatMap((e) => [...e.names, ...(e.adjectives ?? [])]).flatMap((w) => w.split(' ')))]
    .concat(['all', 'except', 'and', 'it', 'them', 'her', 'one']);
  for (let i = 0; i < 2500; i++) {
    const s = fresh(rooms[rnd(rooms.length)], plus);
    for (let k = 0; k < 4; k++) place(s, itemIds[rnd(itemIds.length)], rnd(3) ? s.roomId : 'player');
    if (rnd(2)) for (const k of ['brass_key', 'iron_key', 'small_key', 'choc']) place(s, k, rnd(2) ? s.roomId : 'player');
    if (rnd(2)) s.ctx.it = itemIds[rnd(itemIds.length)];
    if (rnd(2)) s.ctx.them = [itemIds[rnd(itemIds.length)], itemIds[rnd(itemIds.length)]];
    if (rnd(2)) s.ctx.npc = 'maggie';
    if (rnd(3) === 0) s.items.torch.lit = true;
    const verbFirst = ['take', 'drop', 'x', 'put', 'open', 'give', 'ask', 'unlock', 'buy', 'turn on', 'nick'];
    const phrases = ['key', 'brass key', 'key and torch', 'all', 'all except key', 'it', 'them', 'bar', 'woman', 'key in key'];
    const pool = rnd(2) ? nouns : words;
    const toks = rnd(3) === 0 ? phrases[rnd(phrases.length)].split(' ')
      : Array.from({ length: 1 + rnd(4) }, () => pool[rnd(pool.length)]);
    if (rnd(3)) toks.unshift(...verbFirst[rnd(verbFirst.length)].split(' '));
    const parsed = parseCommand(toks, plusVocab);
    const r = resolve(parsed, s, plus, plusVocab);
    assert.deepEqual(JSON.parse(JSON.stringify(r)), r, 'plain JSON');
    seen[r.ok === true ? 'ok' : r.pending ? 'pending' : 'error']++;
    if (r.ok === true) {
      assert.equal(typeof r.command.verb, 'string');
      for (const id of [].concat(r.command.dobj ?? [], r.command.iobj ?? [])) {
        assert.ok(Object.hasOwn(s.items, id) || Object.hasOwn(s.npcs, id) || /#\d+$/.test(id), id);
      }
    } else if (r.pending) {
      assert.equal(r.pending.kind, 'disambig');
      assert.ok(r.pending.candidates.length >= 2);
      s.ctx.pending = r.pending;
      const v = validateSave(JSON.parse(JSON.stringify(serialise(s, plus))), plus);
      assert.equal(v.ok, true, v.error);
      const toks2 = Array.from({ length: 1 + rnd(3) }, () => words[rnd(words.length)]);
      const a = answerPending(toks2, s, plus, plusVocab);
      assert.ok(a.notAnswer || a.ok !== undefined || a.pending, JSON.stringify(a));
    } else {
      assert.equal(r.ok, false);
      assert.ok(msgIds.has(r.message), `${r.message} for ${toks.join(' ')}`);
      assert.notEqual(r.message, 'engineError', toks.join(' '));
    }
  }
  assert.ok(seen.ok > 100 && seen.pending > 20 && seen.error > 100, JSON.stringify(seen));
});
