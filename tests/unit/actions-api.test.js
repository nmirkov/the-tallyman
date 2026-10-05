// TT-008 — the machinery under every action: text.js (A12), the Reaction runner (A4.5
// R1–R7) and the HookApi (A5), exercised directly on the mini-world.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalise, interpolate, formatMoney, listJoin, withArticle, capitalise,
} from '../../src/engine/text.js';
import {
  createRun, react, runReaction, runOf, renderText, message, nameOf, callHook,
} from '../../src/engine/api.js';
import { createState } from '../../src/engine/state.js';
import { MESSAGES, PLAYER } from '../../src/engine/types.js';
import { ACTION_MESSAGES } from '../../src/engine/actions/index.js';
import mini from '../fixtures/mini-world.js';
import { cloneContent, newGame, texts } from '../fixtures/harness.js';

function freshRun(content = mini, seed = 1) {
  return createRun({ state: createState(content, seed), content, messages: ACTION_MESSAGES, strict: true });
}
const said = (run) => run.events.filter((e) => e.type === 'text').map((e) => e.text);

describe('text.js (A12)', () => {
  test('normalise maps the A12.1 table and replaces the rest with ?', () => {
    assert.equal(normalise('‘a’ “b” … –— x y\tz\r\nw​­﻿'), '\'a\' "b" ... -- x y z\nw');
    assert.equal(normalise('£5 `tick` ´'), '£5 \'tick\' \'');
    assert.equal(normalise('café \u{1F600}'), 'caf? ?');
    assert.throws(() => normalise('café', { strict: true }), /U\+00E9/);
    assert.equal(normalise(undefined), '');
  });

  test('interpolate leaves unknown placeholders alone', () => {
    assert.equal(interpolate('{a} and {b} {c-d}', { a: 1, b: 'x' }), '1 and x {c-d}');
    assert.equal(interpolate('no braces', null), 'no braces');
    assert.equal(interpolate(42, {}), '');
  });

  test('formatMoney, listJoin, withArticle, capitalise', () => {
    assert.equal(formatMoney(50), '50p');
    assert.equal(formatMoney(99), '99p');
    assert.equal(formatMoney(200), '£2.00');
    assert.equal(formatMoney(1234), '£12.34');
    assert.equal(listJoin(['a', 'b', 'c']), 'a, b and c');
    assert.equal(listJoin(['a', 'b'], 'or'), 'a or b');
    assert.equal(listJoin(['a']), 'a');
    assert.equal(listJoin([]), '');
    assert.equal(withArticle('iron key'), 'an iron key');
    assert.equal(withArticle('brass key'), 'a brass key');
    assert.equal(withArticle('handcuffs', 'some'), 'some handcuffs');
    assert.equal(withArticle('handcuffs', 'some', 'definite'), 'the handcuffs');
    assert.equal(withArticle('Maggie', ''), 'Maggie');
    assert.equal(withArticle('Maggie', '', 'definite'), 'Maggie');
    assert.equal(capitalise('the oak door'), 'The oak door');
    assert.equal(capitalise(''), '');
  });
});

describe('messages, Text and names', () => {
  test('message lookup: content override → MESSAGES → action defaults; T1 placeholders', () => {
    const run = freshRun();
    assert.equal(message(run, 'stub'), mini.messages.stub);
    assert.equal(message(run, 'taken'), MESSAGES.taken);
    assert.equal(message(run, 'alreadyHave'), ACTION_MESSAGES.alreadyHave);
    assert.equal(message(run, 'chainIgnored', { VERB: 'GO' }), '(Commands after GO were ignored.)');
    assert.equal(message(run, 'invMoney'), 'You have £5.00.');
  });

  test('renderText: strings, variants (first match, none → empty), hooks, placeholders', () => {
    const run = freshRun();
    assert.equal(renderText(run, 'It is {time}; {money}; {score}/{maxScore}; {rank}; {evidence}; {nerve}; {turns}'),
      'It is 21:30; £5.00; 0/40; Probationer; 0; 10; 0');
    assert.equal(renderText(run, mini.items.torch.desc), 'A police torch.');
    run.state.items.torch.lit = true;
    assert.equal(renderText(run, mini.items.torch.desc), 'A police torch, burning steadily.');
    assert.equal(renderText(run, [{ if: 'nope', text: 'x' }]), '');
    assert.equal(renderText(run, { hook: 'clock_text' }), 'The clock reads half past nine.');
    assert.throws(() => renderText(run, { hook: 'missing' }), /unknown hook/);
    assert.throws(() => renderText(run, 42), /invalid Text/);
  });

  test('nameOf: definite / indefinite / bare for items, NPCs, scenery', () => {
    const run = freshRun();
    assert.equal(nameOf(run, 'handcuffs', 'indefinite'), 'some handcuffs');
    assert.equal(nameOf(run, 'oak_door', 'indefinite'), 'the oak door');
    assert.equal(nameOf(run, 'maggie'), 'Maggie');
    assert.equal(nameOf(run, 'pike'), 'the Sergeant Pike');
    assert.equal(nameOf(run, 'square#1'), 'the fountain');
    assert.equal(nameOf(run, 'brass_key', 'bare'), 'brass key');
  });
});

describe('Reaction runner (A4.5)', () => {
  test('a string says and fires; undefined does not fire', () => {
    const run = freshRun();
    assert.equal(react('Hello.', run.api), true);
    assert.equal(react(undefined, run.api), false);
    assert.deepEqual(said(run), ['Hello.']);
  });

  test('R1: false `if` runs `else` (fires iff else fires) or does not fire', () => {
    const run = freshRun();
    assert.equal(react({ if: 'f', say: 'yes' }, run.api), false);
    assert.equal(react({ if: 'f', say: 'yes', else: 'no' }, run.api), true);
    assert.equal(react({ if: 'f', say: 'yes', else: { if: 'g', say: 'never' } }, run.api), false);
    assert.deepEqual(said(run), ['no']);
  });

  test('cases: the first element whose own `if` holds runs; fires iff one ran', () => {
    const run = freshRun();
    const cases = [{ if: 'a', say: 'A' }, { if: 'b', say: 'B' }, 'default'];
    react(cases, run.api);
    run.state.flags.b = true;
    react(cases, run.api);
    assert.equal(react([{ if: 'a', say: 'A' }], run.api), false);
    assert.deepEqual(said(run), ['default', 'B']);
  });

  test('R2: chance rolls the state RNG after `if`; deterministic per seed', () => {
    const run1 = freshRun(mini, 7);
    const run2 = freshRun(mini, 7);
    const out1 = [];
    const out2 = [];
    for (let i = 0; i < 20; i++) {
      out1.push(react({ chance: 0.5, say: 'x' }, run1.api));
      out2.push(react({ chance: 0.5, say: 'x' }, run2.api));
    }
    assert.deepEqual(out1, out2);
    assert.ok(out1.includes(true) && out1.includes(false));
    const rng = run1.state.rng;
    react({ if: 'f', chance: 0.5, say: 'x' }, run1.api);
    assert.equal(run1.state.rng, rng, 'no roll when `if` fails');
  });

  test('R3: effects apply in REACTION_ORDER; R5 setVar forms; `then` sees updated state', () => {
    const run = freshRun();
    run.state.turn = 12;
    react({
      then: { if: { var: 'bells', eq: 3 }, say: 'three bells' },
      setVar: { bells: { add: 3 }, arrivalTurn: { turnPlus: 5 }, lastWord: 'hush' },
      say: 'first',
      sfx: 'bell',
      setFlag: ['a', 'b'],
      clearFlag: 'a',
      money: -600,
      nerve: 200,
      award: 'torch_lit',
      give: 'brass_key',
      music: 'theme',
      pause: 300,
    }, run.api);
    assert.deepEqual(run.events.map((e) => e.type), ['sfx', 'pause', 'text', 'text', 'music', 'text']);
    assert.deepEqual(said(run), ['first', '[Your score has gone up by 5 points.]', 'three bells']);
    assert.deepEqual(run.state.vars, { pikeState: 'desk', arrivalTurn: 17, bells: 3, alarmRaised: false, lastWord: 'hush' });
    assert.deepEqual(run.state.flags, { b: true });
    assert.equal(run.state.money, 0);
    assert.equal(run.state.nerve, 100);
    assert.equal(run.state.items.brass_key.loc, PLAYER);
  });

  test('R4: a hook returning false un-fires (effects stay, `then` skipped); R7 `continue`', () => {
    const content = cloneContent(mini);
    content.hooks.decline = () => false;
    content.hooks.agree = () => undefined;
    const run = freshRun(content);
    assert.deepEqual(runReaction(run, { setFlag: 'x', hook: 'decline', then: 'later' }), { fired: false, cont: false });
    assert.equal(run.state.flags.x, true);
    assert.deepEqual(said(run), []);
    assert.deepEqual(runReaction(run, { hook: 'agree', continue: true }), { fired: true, cont: true });
    assert.deepEqual(runReaction(run, [{ if: 'nope', say: 'x' }, { say: 'y', continue: true }]), { fired: true, cont: true });
  });

  test('hooks receive (api, {phase, cmd, self}); `found`, reveal, move, setItem, setNpc, end', () => {
    const content = cloneContent(mini);
    const calls = [];
    content.hooks.spy = (api, args) => { calls.push({ ...args, room: api.room, turn: api.turn }); };
    const run = freshRun(content);
    runReaction(run, { hook: 'spy' }, { phase: 'before', cmd: { verb: 'look' }, self: 'square' });
    assert.deepEqual(calls, [{ phase: 'before', cmd: { verb: 'look' }, self: 'square', room: 'square', turn: 0 }]);
    react({ reveal: 'coin' }, run.api);
    assert.equal(run.state.items.coin.hidden, false);
    assert.deepEqual(said(run), ['Wedged in a crack in the table is a 10p coin.']);
    react({ reveal: 'coin' }, run.api);
    assert.equal(said(run).length, 1, 'reveal is once-only');
    react({ move: { pike: 'pub', satchel: 'square' }, setItem: { satchel: { open: true } }, setNpc: { maggie: { state: 'angry' } } }, run.api);
    assert.equal(run.state.npcs.pike.loc, 'pub');
    assert.equal(run.state.items.satchel.open, true);
    assert.equal(run.state.npcs.maggie.state, 'angry');
    react({ end: 'wrong_man' }, run.api);
    assert.equal(run.state.ended, 'wrong_man');
  });

  test('invalid effects throw (content bugs): setVar type, setItem field, unknown ids', () => {
    const run = freshRun();
    assert.throws(() => react({ setVar: { bells: 'many' } }, run.api), /setVar bells/);
    assert.throws(() => react({ setVar: { nope: 1 } }, run.api), /unknown var/);
    assert.throws(() => react({ setItem: { helmet: { lit: true } } }, run.api), /no field "lit"/);
    assert.throws(() => react({ setItem: { candle: { fuel: -1 } } }, run.api), /bad value/);
    assert.throws(() => react({ award: 'nope' }, run.api), /unknown award/);
    assert.throws(() => react({ end: 'nope' }, run.api), /unknown ending/);
    assert.throws(() => react({ move: { brass_key: 'attic' } }, run.api), /unknown location/);
    assert.throws(() => react({ movePlayer: 'towpath' }, run.api), /unknown room/);
    assert.throws(() => react(42, run.api), /invalid reaction/);
  });

  test('movePlayer in a reaction is a full room entry', () => {
    const run = freshRun();
    react({ movePlayer: 'pub' }, run.api);
    assert.deepEqual(run.events.slice(0, 2).map((e) => e.type), ['room', 'picture']);
    assert.equal(run.state.roomId, 'pub');
    assert.equal(run.state.prevRoomId, 'square');
    assert.ok(run.state.visited.includes('pub'));
  });
});

describe('HookApi (A5)', () => {
  test('queries and awards; evidence discovery order: append → note → award', () => {
    const run = freshRun();
    const api = run.api;
    assert.equal(runOf(api), run);
    assert.equal(api.flag('x'), false);
    api.setFlag('x');
    assert.equal(api.flag('x'), true);
    api.setFlag('x', false);
    assert.equal(api.flag('x'), false);
    assert.equal(api.var('pikeState'), 'desk');
    assert.equal(api.carried('warrant_card'), true);
    assert.equal(api.locOf('torch'), 'office');
    assert.equal(api.present('pike'), false);
    assert.equal(api.lit(), true);
    assert.equal(api.test({ in: 'square' }), true);
    api.addEvidence('ev_register');
    api.addEvidence('ev_register');
    assert.deepEqual(said(run), [MESSAGES.noted, '[Your score has gone up by 5 points.]']);
    assert.deepEqual(run.state.evidence, ['ev_register']);
    assert.equal(api.evidenceCount(), 1);
    api.move('ledger_page', PLAYER);
    assert.deepEqual(run.state.evidence, ['ev_register', 'ev_ledger'], 'moving an item to the player discovers it');
    api.award('torch_lit');
    api.award('torch_lit');
    assert.equal(run.state.score, 20);
    api.money(-100);
    api.nerve(-50);
    assert.equal(run.state.money, 400);
    assert.equal(run.state.nerve, 0);
    assert.equal(typeof api.rng.next(), 'number');
    assert.ok([1, 2].includes(api.rng.pick([1, 2])));
    assert.ok(Object.isFrozen(api));
  });

  test('awards cap at maxScore', () => {
    const run = freshRun();
    run.state.score = 38;
    run.api.award('ledger');
    assert.equal(run.state.score, 40);
    assert.deepEqual(said(run), ['[Your score has gone up by 2 points.]']);
  });

  test('callHook context nests and restores', () => {
    const content = cloneContent(mini);
    const seen = [];
    content.hooks.inner = (api, args) => { seen.push(args.self); };
    content.hooks.outer = (api, args) => { seen.push(args.self); api.react({ hook: 'inner' }); };
    const run = freshRun(content);
    callHook(run, 'outer', { phase: 'before', self: 'rug' });
    assert.deepEqual(seen, ['rug', 'rug']);
    assert.deepEqual(run.args, { phase: null, cmd: null, self: null });
  });

  test('content hooks can drive a game through the api (condition hook on a room desc)', () => {
    const g = newGame();
    assert.ok(texts(g.input('look')).includes('Rain hammers the cobbles of the market square. The town clock looms over a dry fountain.'));
  });
});
