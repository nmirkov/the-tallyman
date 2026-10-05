import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as rng from '../../src/engine/rng.js';
import { createState, clone, serialise, validateSave, varProblem } from '../../src/engine/state.js';
import { STATE_VERSION, SAVE_FORMAT, LIMITS } from '../../src/engine/types.js';
import mini from '../fixtures/mini-world.js';

const A3_KEYS = [
  'v', 'seed', 'rng', 'turn', 'roomId', 'prevRoomId', 'visited', 'items', 'npcs', 'flags', 'vars',
  'money', 'score', 'awarded', 'hintTiers', 'nerve', 'panicCooldown', 'notes', 'evidence', 'warned',
  'fired', 'ctx', 'settings', 'ended',
];

/** A valid save built from a fresh state, optionally patched. @param {(s: any) => void} [patch] */
function save(patch) {
  const s = createState(mini, 7);
  if (patch) patch(s);
  return serialise(s, mini);
}

/** Recursively freeze, so any mutation by validateSave throws. */
function deepFreeze(o) {
  if (o && typeof o === 'object') { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); }
  return o;
}

/* ---------------------------------------------------------------- rng */

test('rng: mulberry32 is deterministic, stored in state.rng and in [0,1)', () => {
  const a = { rng: 42 };
  const b = { rng: 42 };
  const seqA = Array.from({ length: 50 }, () => rng.next(a));
  const seqB = Array.from({ length: 50 }, () => rng.next(b));
  assert.deepEqual(seqA, seqB);
  assert.equal(a.rng, b.rng);
  assert.notEqual(a.rng, 42, 'state advanced');
  for (const x of seqA) assert.ok(x >= 0 && x < 1);
  assert.ok(Number.isInteger(a.rng) && a.rng >= 0 && a.rng <= 0xffffffff, 'rng stays uint32');
  assert.ok(new Set(seqA).size > 45, 'values vary');
});

test('rng: known mulberry32 output for seed 1 (reference implementation)', () => {
  // Reference mulberry32 (Tommy Ettinger) with a = 1: first output.
  let a = 1;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const expected = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  assert.equal(rng.next({ rng: 1 }), expected);
});

test('rng: int and pick', () => {
  const s = { rng: 99 };
  const counts = [0, 0, 0];
  for (let i = 0; i < 300; i++) counts[rng.int(s, 3)]++;
  for (const c of counts) assert.ok(c > 50, `roughly uniform: ${counts}`);
  assert.equal(rng.int(s, 1), 0);
  assert.throws(() => rng.int(s, 0), RangeError);
  assert.throws(() => rng.int(s, 2.5), RangeError);
  const arr = ['a', 'b', 'c'];
  for (let i = 0; i < 20; i++) assert.ok(arr.includes(rng.pick(s, arr)));
  const before = s.rng;
  assert.equal(rng.pick(s, []), undefined);
  assert.equal(s.rng, before, 'empty pick does not consume');
});

/* ---------------------------------------------------------------- createState */

test('createState: exactly the A3 fields with the documented initial values', () => {
  const s = createState(mini, 12345);
  assert.deepEqual(Object.keys(s), A3_KEYS);
  assert.equal(s.v, STATE_VERSION);
  assert.equal(s.seed, 12345);
  assert.equal(s.rng, 12345);
  assert.equal(s.turn, 0);
  assert.equal(s.roomId, 'square');
  assert.equal(s.prevRoomId, null);
  assert.deepEqual(s.visited, ['square']);
  assert.deepEqual(Object.keys(s.items), Object.keys(mini.items), 'items in content order');
  assert.deepEqual(Object.keys(s.npcs), Object.keys(mini.npcs));
  assert.deepEqual(s.npcs.maggie, { loc: 'pub', state: null });
  assert.deepEqual(s.flags, {});
  assert.deepEqual(s.vars, { pikeState: 'desk', arrivalTurn: null, bells: 0, alarmRaised: false, lastWord: '' });
  assert.deepEqual(Object.keys(s.vars), Object.keys(mini.vars));
  assert.equal(s.money, 500);
  assert.equal(s.score, 0);
  assert.equal(s.nerve, 10);
  assert.equal(s.panicCooldown, 0);
  for (const k of ['awarded', 'notes', 'evidence', 'warned', 'fired']) assert.deepEqual(s[k], []);
  assert.deepEqual(s.hintTiers, {});
  assert.deepEqual(s.ctx, { it: null, them: [], npc: null, lastCommand: null, pending: null });
  assert.deepEqual(s.settings, { verbose: true, graphics: true });
  assert.equal(s.ended, null);
});

test('createState: ItemState capability fields exist iff the item has the capability (S4)', () => {
  const { items } = createState(mini, 1);
  assert.deepEqual(items.warrant_card, { loc: 'player' });
  assert.deepEqual(items.torch, { loc: 'office', lit: false });
  assert.deepEqual(items.candle, { loc: 'pub', lit: false, fuel: 10, moved: false });
  assert.deepEqual(items.satchel, { loc: 'office', open: false, locked: false });
  assert.deepEqual(items.oak_door, { loc: 'pub', open: false, locked: true });
  assert.deepEqual(items.coin, { loc: 'table', hidden: true });
  assert.deepEqual(items.helmet, { loc: 'office', worn: false });
  assert.deepEqual(items.whisky, { loc: null });
  assert.deepEqual(items.table, { loc: 'back_room' }, 'non-openable container has no open/locked');
});

test('createState: defaults when rules omit money / nerve, seed coerced to uint32', () => {
  const content = { ...mini, rules: { start: 'square' }, vars: undefined };
  const s = createState(content, -1);
  assert.equal(s.money, 0);
  assert.equal(s.nerve, 0);
  assert.equal(s.seed, 0xffffffff);
  assert.deepEqual(s.vars, {});
  assert.equal(createState(mini).seed, 1, 'default seed 1');
});

test('state is plain JSON: round trip is exact; clone is deep and independent', () => {
  const s = createState(mini, 3);
  s.flags.trapdoor_open = true;
  s.ctx.pending = { kind: 'disambig', text: 'Which do you mean, the brass key or the iron key?',
    command: { verb: 'take', verbWord: 'take', dobj: { words: ['key'] }, raw: 'take key' },
    slot: 'dobj', candidates: ['brass_key', 'iron_key'], bound: {} };
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
  const c = clone(s);
  assert.deepEqual(c, s);
  c.items.torch.loc = 'player';
  c.ctx.pending.candidates.push('x');
  assert.equal(s.items.torch.loc, 'office');
  assert.equal(s.ctx.pending.candidates.length, 2);
});

/* ---------------------------------------------------------------- serialise */

test('serialise builds SaveData from a deep clone with a derived summary', () => {
  const s = createState(mini, 5);
  s.turn = 142;
  s.score = 15;
  const data = serialise(s, mini);
  assert.equal(data.format, SAVE_FORMAT);
  assert.equal(data.game, 'mini');
  assert.equal(data.contentVersion, '1');
  assert.deepEqual(data.summary, { room: 'Market Square', time: '22:41', score: 15, turns: 142 });
  assert.deepEqual(data.state, s);
  assert.notEqual(data.state, s);
  data.state.items.torch.loc = 'player';
  assert.equal(s.items.torch.loc, 'office');
});

/* ---------------------------------------------------------------- validateSave: success */

test('validateSave accepts a fresh save (object and JSON string) and returns a fresh equal state', () => {
  const data = save();
  const r1 = validateSave(data, mini);
  assert.equal(r1.ok, true, r1.error);
  assert.deepEqual(r1.state, data.state);
  assert.notEqual(r1.state, data.state);
  const r2 = validateSave(JSON.stringify(data), mini);
  assert.equal(r2.ok, true, r2.error);
  assert.deepEqual(r2.state, data.state);
});

test('validateSave accepts a well-formed mid-game state', () => {
  const data = save((s) => {
    s.turn = 120;
    s.roomId = 'cellar';
    s.prevRoomId = 'alley';
    s.visited = ['square', 'alley', 'cellar'];
    s.items.torch = { loc: 'player', lit: true };
    s.items.satchel = { loc: 'player', open: true, locked: false };
    s.items.helmet = { loc: 'player', worn: true };
    s.items.coin = { loc: 'satchel', hidden: false };
    s.items.candle = { loc: 'pub', lit: false, fuel: 0, moved: true };
    s.npcs.pike = { loc: null, state: 'gone' };
    s.flags = { trapdoor_open: true, gate_unbolted: true };
    s.vars = { pikeState: 'left', arrivalTurn: 125, bells: 3, alarmRaised: true, lastWord: 'help' };
    s.money = 300;
    s.score = 15;
    s.awarded = ['torch_lit', 'register'];
    s.hintTiers = { light: 2 };
    s.nerve = 99;
    s.panicCooldown = 7;
    s.notes = ['register'];
    s.evidence = ['ev_register', 'ev_ledger'];
    s.warned = ['canal'];
    s.fired = ['rain_eases'];
    s.ctx = {
      it: 'square#0', them: ['brass_key', 'iron_key'], npc: 'maggie',
      lastCommand: { verb: 'take', verbWord: 'take', dobj: ['brass_key', 'iron_key'], all: true, raw: 'take all' },
      pending: { kind: 'confirm', text: 'Are you certain? (Y/N)', command: { verb: 'accuse', verbWord: 'accuse', dobj: 'maggie', raw: 'accuse maggie' } },
    };
    s.settings = { verbose: false, graphics: true };
  });
  const r = validateSave(data, mini);
  assert.equal(r.ok, true, r.error);
  assert.deepEqual(r.state, data.state);
});

test('validateSave accepts an ended game and a contentVersion mismatch', () => {
  const data = save((s) => { s.ended = 'death_fall'; s.turn = 300; });
  data.contentVersion = '99';
  const r = validateSave(data, mini);
  assert.equal(r.ok, true, r.error);
});

test('validateSave re-orders items / npcs / vars keys into content order', () => {
  const data = save();
  const items = data.state.items;
  data.state.items = Object.fromEntries(Object.entries(items).reverse());
  const r = validateSave(data, mini);
  assert.equal(r.ok, true, r.error);
  assert.deepEqual(Object.keys(r.state.items), Object.keys(mini.items));
});

/* ---------------------------------------------------------------- validateSave: rejections */

/** @type {Array<[string, (d: any) => any, RegExp]>} */
const BAD = [
  ['V1 null', () => null, /^not a Tallyman save$/],
  ['V1 array', () => [], /^not a Tallyman save$/],
  ['V1 number', () => 42, /^not a Tallyman save$/],
  ['V1 bad JSON string', () => '{"format":', /^not a Tallyman save$/],
  ['V1 JSON string of a non-object', () => '"hello"', /^not a Tallyman save$/],
  ['V1 too large', (d) => { d.padding = 'x'.repeat(LIMITS.saveBytes); return d; }, /^not a Tallyman save$/],
  ['V2 format', (d) => { d.format = 'other'; return d; }, /^not a Tallyman save$/],
  ['V3 game', (d) => { d.game = 'zork'; return d; }, /^save is from a different game$/],
  ['V4 version', (d) => { d.state.v = 2; return d; }, /^unsupported save version 2$/],
  ['V4 state missing', (d) => { delete d.state; return d; }, /^corrupt save: state/],
  ['V5 missing key', (d) => { delete d.state.nerve; return d; }, /^corrupt save: state\.nerve: missing$/],
  ['V5 extra key', (d) => { d.state.cheat = true; return d; }, /^corrupt save: state\.cheat: unexpected field$/],
  ['V5 wrong type turn', (d) => { d.state.turn = '5'; return d; }, /^corrupt save: state\.turn: /],
  ['V5 non-integer money', (d) => { d.state.money = 1.5; return d; }, /^corrupt save: state\.money: /],
  ['V5 seed not uint32', (d) => { d.state.seed = -1; return d; }, /^corrupt save: state\.seed: /],
  ['V5 rng not uint32', (d) => { d.state.rng = 2 ** 32; return d; }, /^corrupt save: state\.rng: /],
  ['V5 visited not array', (d) => { d.state.visited = 'square'; return d; }, /^corrupt save: state\.visited: /],
  ['V5 items not object', (d) => { d.state.items = []; return d; }, /^corrupt save: state\.items: /],
  ['V5 ctx missing field', (d) => { delete d.state.ctx.them; return d; }, /^corrupt save: state\.ctx\.them: missing$/],
  ['V6 turn range', (d) => { d.state.turn = 301; return d; }, /^corrupt save: state\.turn: /],
  ['V6 nerve range', (d) => { d.state.nerve = 101; return d; }, /^corrupt save: state\.nerve: /],
  ['V6 money negative', (d) => { d.state.money = -5; return d; }, /^corrupt save: state\.money: /],
  ['V6 score above max', (d) => { d.state.score = 41; return d; }, /^corrupt save: state\.score: /],
  ['V6 panicCooldown above rule', (d) => { d.state.panicCooldown = 16; return d; }, /^corrupt save: state\.panicCooldown: /],
  ['V7 unknown room', (d) => { d.state.roomId = 'attic'; return d; }, /^corrupt save: state\.roomId: unknown room "attic"$/],
  ['V7 stub room', (d) => { d.state.roomId = 'towpath'; d.state.visited.push('towpath'); return d; }, /^corrupt save: state\.roomId: /],
  ['V7 prevRoomId unknown', (d) => { d.state.prevRoomId = 'attic'; return d; }, /^corrupt save: state\.prevRoomId: /],
  ['V7 visited lacks roomId', (d) => { d.state.visited = ['pub']; return d; }, /^corrupt save: state\.visited: /],
  ['V7 visited duplicate', (d) => { d.state.visited = ['square', 'square']; return d; }, /^corrupt save: state\.visited\[1\]: duplicate/],
  ['V7 unknown item key', (d) => { d.state.items.sword = { loc: null }; return d; }, /^corrupt save: state\.items\.sword: /],
  ['V7 missing item key', (d) => { delete d.state.items.torch; return d; }, /^corrupt save: state\.items\.torch: missing$/],
  ['V7 missing npc key', (d) => { delete d.state.npcs.pike; return d; }, /^corrupt save: state\.npcs\.pike: missing$/],
  ['V7 unknown var key', (d) => { d.state.vars.gold = 1; return d; }, /^corrupt save: state\.vars\.gold: /],
  ['V7 unknown award', (d) => { d.state.awarded = ['nope']; return d; }, /^corrupt save: state\.awarded\[0\]: /],
  ['V7 duplicate award', (d) => { d.state.awarded = ['ledger', 'ledger']; d.state.score = 20; return d; }, /^corrupt save: state\.awarded\[1\]: duplicate/],
  ['V7 unknown note', (d) => { d.state.notes = ['diary']; return d; }, /^corrupt save: state\.notes\[0\]: /],
  ['V7 unknown evidence', (d) => { d.state.evidence = ['ev_knife']; return d; }, /^corrupt save: state\.evidence\[0\]: /],
  ['V7 unknown hazard', (d) => { d.state.warned = ['lava']; return d; }, /^corrupt save: state\.warned\[0\]: /],
  ['V7 unknown beat', (d) => { d.state.fired = ['nope']; return d; }, /^corrupt save: state\.fired\[0\]: /],
  ['V7 unknown hint step', (d) => { d.state.hintTiers = { nope: 0 }; return d; }, /^corrupt save: state\.hintTiers\.nope: /],
  ['V7 hint tier out of range', (d) => { d.state.hintTiers = { ledger: 2 }; return d; }, /^corrupt save: state\.hintTiers\.ledger: /],
  ['V8 capability field missing', (d) => { delete d.state.items.torch.lit; return d; }, /^corrupt save: state\.items\.torch\.lit: missing$/],
  ['V8 capability field extra', (d) => { d.state.items.brass_key.open = true; return d; }, /^corrupt save: state\.items\.brass_key\.open: unexpected field$/],
  ['V8 capability wrong type', (d) => { d.state.items.satchel.open = 'yes'; return d; }, /^corrupt save: state\.items\.satchel\.open: /],
  ['V8 fuel negative', (d) => { d.state.items.candle.fuel = -1; return d; }, /^corrupt save: state\.items\.candle\.fuel: /],
  ['V8 fuel non-integer', (d) => { d.state.items.candle.fuel = 1.5; return d; }, /^corrupt save: state\.items\.candle\.fuel: /],
  ['V9 unknown loc', (d) => { d.state.items.torch.loc = 'attic'; return d; }, /^corrupt save: state\.items\.torch\.loc: unknown location "attic"$/],
  ['V9 loc in a non-container item', (d) => { d.state.items.torch.loc = 'brass_key'; return d; }, /^corrupt save: state\.items\.torch\.loc: /],
  ['V9 loc is a stub', (d) => { d.state.items.torch.loc = 'towpath'; return d; }, /^corrupt save: state\.items\.torch\.loc: /],
  ['V9 npc loc not a room', (d) => { d.state.npcs.pike.loc = 'player'; return d; }, /^corrupt save: state\.npcs\.pike\.loc: /],
  ['V9 npc state wrong type', (d) => { d.state.npcs.pike.state = 3; return d; }, /^corrupt save: state\.npcs\.pike\.state: /],
  ['V9 worn but not carried', (d) => { d.state.items.helmet.worn = true; return d; }, /^corrupt save: state\.items\.helmet\.worn: /],
  ['V10 containment cycle', (d) => { d.state.items.satchel.loc = 'crate'; d.state.items.crate.loc = 'satchel'; return d; }, /^corrupt save: containment cycle at (satchel|crate)$/],
  ['V10 self containment', (d) => { d.state.items.satchel.loc = 'satchel'; return d; }, /^corrupt save: containment cycle at satchel$/],
  ['V11 enum var out of set', (d) => { d.state.vars.pikeState = 'dancing'; return d; }, /^corrupt save: state\.vars\.pikeState: /],
  ['V11 int var below min', (d) => { d.state.vars.bells = -1; return d; }, /^corrupt save: state\.vars\.bells: /],
  ['V11 null in non-nullable var', (d) => { d.state.vars.bells = null; return d; }, /^corrupt save: state\.vars\.bells: /],
  ['V11 bool var wrong type', (d) => { d.state.vars.alarmRaised = 0; return d; }, /^corrupt save: state\.vars\.alarmRaised: /],
  ['V11 flag value false', (d) => { d.state.flags.trapdoor_open = false; return d; }, /^corrupt save: state\.flags\.trapdoor_open: /],
  ['V12 ctx.it unknown', (d) => { d.state.ctx.it = 'ghost'; return d; }, /^corrupt save: state\.ctx\.it: /],
  ['V12 ctx.it bad scenery index', (d) => { d.state.ctx.it = 'square#9'; return d; }, /^corrupt save: state\.ctx\.it: /],
  ['V12 ctx.npc not an NPC', (d) => { d.state.ctx.npc = 'torch'; return d; }, /^corrupt save: state\.ctx\.npc: /],
  ['V12 ctx.them unknown', (d) => { d.state.ctx.them = ['ghost']; return d; }, /^corrupt save: state\.ctx\.them\[0\]: /],
  ['V12 lastCommand unknown dobj', (d) => { d.state.ctx.lastCommand = { verb: 'take', verbWord: 'take', dobj: 'ghost', raw: 'take ghost' }; return d; }, /^corrupt save: state\.ctx\.lastCommand\.dobj: /],
  ['V12 lastCommand missing verb', (d) => { d.state.ctx.lastCommand = { verbWord: 'take', raw: 'take' }; return d; }, /^corrupt save: state\.ctx\.lastCommand\.verb: /],
  ['V12 lastCommand bad dir', (d) => { d.state.ctx.lastCommand = { verb: 'go', verbWord: 'go', dir: 'up', raw: 'go up' }; return d; }, /^corrupt save: state\.ctx\.lastCommand\.dir: /],
  ['V12 pending bad kind', (d) => { d.state.ctx.pending = { kind: 'riddle', text: '?' }; return d; }, /^corrupt save: state\.ctx\.pending\.kind: /],
  ['V12 pending text not string', (d) => { d.state.ctx.pending = { kind: 'confirm', text: 3, command: { verb: 'quit', verbWord: 'quit', raw: 'quit' } }; return d; }, /^corrupt save: state\.ctx\.pending\.text: /],
  ['V12 pending unknown candidate', (d) => {
    d.state.ctx.pending = { kind: 'disambig', text: 'Which?', command: { verb: 'take', verbWord: 'take', dobj: { words: ['key'] }, raw: 'take key' }, slot: 'dobj', candidates: ['brass_key', 'ghost'], bound: {} };
    return d;
  }, /^corrupt save: state\.ctx\.pending\.candidates\[1\]: /],
  ['V12 pending bad slot', (d) => {
    d.state.ctx.pending = { kind: 'disambig', text: 'Which?', command: { verb: 'take', verbWord: 'take', raw: 'take key' }, slot: 'topic', candidates: ['brass_key'], bound: {} };
    return d;
  }, /^corrupt save: state\.ctx\.pending\.slot: /],
  ['V12 ended unknown', (d) => { d.state.ended = 'nope'; return d; }, /^corrupt save: state\.ended: /],
  ['V12 ended with pending', (d) => {
    d.state.ended = 'midnight';
    d.state.ctx.pending = { kind: 'confirm', text: 'Really quit? (Y/N)', command: { verb: 'quit', verbWord: 'quit', raw: 'quit' } };
    return d;
  }, /^corrupt save: state\.ctx\.pending: /],
  ['V12 settings extra', (d) => { d.state.settings.sound = true; return d; }, /^corrupt save: state\.settings\.sound: /],
  ['V12 settings wrong type', (d) => { d.state.settings.verbose = 'yes'; return d; }, /^corrupt save: state\.settings\.verbose: /],
];

for (const [name, corrupt, expected] of BAD) {
  test(`validateSave rejects: ${name} — and leaves the input untouched`, () => {
    const data = corrupt(save());
    const snapshot = JSON.stringify(data);
    deepFreeze(data);
    const r = validateSave(data, mini);
    assert.equal(r.ok, false, `expected rejection for ${name}`);
    assert.equal(r.state, undefined);
    assert.match(r.error, expected);
    assert.equal(JSON.stringify(data), snapshot, 'input unchanged');
  });
}

test('validateSave never throws, whatever it is given', () => {
  const cyclic = { format: SAVE_FORMAT };
  cyclic.self = cyclic;
  for (const junk of [undefined, '', 'null', true, () => 1, Symbol('x'), cyclic, { state: { v: 1 } }, new Map()]) {
    const r = validateSave(junk, mini);
    assert.equal(r.ok, false);
    assert.equal(typeof r.error, 'string');
  }
});

/* ---------------------------------------------------------------- varProblem */

test('varProblem enforces VarDecl type, range, nullability and enum membership', () => {
  const { vars } = mini;
  assert.equal(varProblem(vars.bells, 3), null);
  assert.match(varProblem(vars.bells, -1), /below/);
  assert.match(varProblem(vars.bells, 1.5), /integer/);
  assert.match(varProblem(vars.bells, null), /null/);
  assert.equal(varProblem(vars.arrivalTurn, null), null);
  assert.equal(varProblem(vars.pikeState, 'fled'), null);
  assert.match(varProblem(vars.pikeState, 'gone'), /one of/);
  assert.equal(varProblem(vars.alarmRaised, true), null);
  assert.match(varProblem(vars.alarmRaised, 'true'), /boolean/);
  assert.equal(varProblem(vars.lastWord, 'x'), null);
  assert.match(varProblem(vars.lastWord, 5), /string/);
  assert.match(varProblem({ type: 'int', max: 3, init: 0 }, 4), /above/);
});
