import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../../src/engine/types.js';

/** @param {unknown} v @param {string} path */
function assertDeepFrozen(v, path) {
  if (v === null || typeof v !== 'object') return;
  assert.ok(Object.isFrozen(v), `${path} is not frozen`);
  for (const [k, child] of Object.entries(v)) assertDeepFrozen(child, `${path}.${k}`);
}

test('scalar clock constants match PLAN §2.3/§2.5', () => {
  assert.equal(T.TURN_SECONDS, 30);
  assert.equal(T.MIDNIGHT_TURN, 300);
  assert.equal(T.START_TIME, '21:30');
  const [h, m] = T.START_TIME.split(':').map(Number);
  assert.equal(h * 60 + m + (T.MIDNIGHT_TURN * T.TURN_SECONDS) / 60, 24 * 60, 'turn 300 is midnight');
});

test('every exported object constant is deeply frozen', () => {
  const objects = Object.entries(T).filter(([, v]) => v !== null && typeof v === 'object');
  assert.ok(objects.length >= 20, 'expected the documented constant set');
  for (const [name, v] of objects) assertDeepFrozen(v, name);
});

test('the module exports no functions (contract file has no behaviour)', () => {
  for (const [name, v] of Object.entries(T)) assert.notEqual(typeof v, 'function', name);
});

test('event types are the complete documented list', () => {
  assert.deepEqual([...T.EVENT_TYPES].sort(), [
    'ambient', 'clear', 'end', 'host', 'music', 'pause', 'picture', 'prompt', 'room', 'sfx',
    'status', 'storage', 'text',
  ]);
  for (const t of T.TERMINAL_EVENT_TYPES) assert.ok(T.EVENT_TYPES.includes(t));
});

test('directions: 12 canonical ids, names for each, opposite is an involution', () => {
  assert.equal(T.DIRECTIONS.length, 12);
  for (const d of T.DIRECTIONS) {
    assert.equal(typeof T.DIRECTION_NAMES[d], 'string');
    assert.ok(T.DIRECTIONS.includes(T.OPPOSITE[d]));
    assert.equal(T.OPPOSITE[T.OPPOSITE[d]], d);
  }
});

test('verb sets are disjoint and barriers match PLAN §3.4a', () => {
  assert.deepEqual([...T.CHAIN_BARRIERS].sort(), ['export', 'import', 'load', 'quit', 'restart', 'save', 'undo']);
  for (const v of T.META_VERBS) assert.ok(!T.CHAIN_BARRIERS.includes(v), v);
  for (const v of T.ENDED_VERBS) assert.ok(T.CHAIN_BARRIERS.includes(v), v);
  assert.deepEqual(T.VERB_CLASSES, { world: 1, meta: 0, system: 0 });
});

test('save constants and limits', () => {
  assert.equal(T.STATE_VERSION, 1);
  assert.equal(T.SAVE_FORMAT, 'tallyman-save');
  assert.deepEqual([...T.SAVE_SLOTS], [1, 2, 3]);
  assert.equal(T.PLAYER, 'player');
  assert.equal(T.LIMITS.roomDesc, 300);
  assert.ok(new RegExp(T.ID_PATTERN).test('mill_yard'));
  assert.ok(!new RegExp(T.ID_PATTERN).test('Mill-Yard'));
});

test('rule defaults encode PLAN §2.5 resource policy', () => {
  const n = T.RULE_DEFAULTS.nerve;
  assert.equal(n.panicAt, 100);
  assert.equal(n.panicReset, 50);
  assert.equal(n.panicCooldown, 15);
  assert.equal(n.safe, -5);
  assert.equal(n.lit, -1);
  assert.equal(T.RULE_DEFAULTS.hintCost, 2);
  assert.deepEqual([...T.PIKE_STATES], ['desk', 'fled', 'left', 'counting', 'restrained']);
});

test('reaction and condition key lists have no duplicates or overlap', () => {
  const all = [...T.REACTION_ORDER, ...T.REACTION_CONTROL_KEYS];
  assert.equal(new Set(all).size, all.length);
  assert.equal(new Set(T.COND_KEYS).size, T.COND_KEYS.length);
  for (const op of T.VAR_OPS) assert.ok(!T.COND_KEYS.includes(op), op);
});

test('messages are ASCII-only strings (glyph policy)', () => {
  for (const [id, text] of Object.entries(T.MESSAGES)) {
    assert.equal(typeof text, 'string', id);
    assert.match(text, /^[\x20-\x7e]*$/, id);
  }
  assert.equal(T.MESSAGES.chainIgnored.replace('{VERB}', 'LOAD'), '(Commands after LOAD were ignored.)');
  assert.equal(T.MESSAGES.personal, 'You\'d sooner lose your head.');
});

test('art constants match PLAN §3.5', () => {
  assert.deepEqual(T.ART_SIZES, { location: { w: 40, h: 9 }, screen: { w: 40, h: 25 } });
  assert.equal(T.PALETTE_KEYS.length, 16);
  assert.deepEqual([...T.ART_FX], ['rain', 'lightning', 'flicker', 'fog']);
});
