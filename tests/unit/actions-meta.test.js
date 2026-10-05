// TT-008 — meta family and the registry (ARCHITECTURE A7.4 costs, A10.3 settings, A8.11
// SCORE / TIME), plus the vocab enumeration: every engine verb has an action or a
// deliberate generic response.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MESSAGES, CHAIN_BARRIERS, HOST_SETTINGS } from '../../src/engine/types.js';
import { VERBS } from '../../src/engine/vocab.js';
import { ACTIONS, SYSTEM_ACTIONS, ACTION_MESSAGES } from '../../src/engine/actions/index.js';
import { messages as metaMsgs } from '../../src/engine/actions/meta.js';
import mini from '../fixtures/mini-world.js';
import {
  newGame, cloneContent, texts, setup,
} from '../fixtures/harness.js';

const sys = (text) => ({ type: 'text', style: 'system', text });

test('INVENTORY is free: nested open containers, lit and worn notes, money', () => {
  const g = newGame();
  setup(g, (s) => {
    for (const id of ['torch', 'satchel', 'helmet']) s.items[id].loc = 'player';
    s.items.torch.lit = true;
    s.items.helmet.worn = true;
    s.items.satchel.open = true;
  });
  assert.deepEqual(texts(g.input('i')), [
    'You are carrying:\n  a warrant card\n  a torch (providing light)\n  a satchel\n    some handcuffs\n  a helmet (being worn)',
    'You have £5.00.',
  ]);
  assert.equal(g.snapshot().turn, 0);
  const g2 = newGame();
  setup(g2, (s) => { s.items.warrant_card.loc = 'square'; s.money = 0; });
  assert.deepEqual(texts(g2.input('inventory')), [metaMsgs.invEmpty]);
});

test('SCORE, TIME and HELP are free', () => {
  const g = newGame();
  setup(g, (s) => { s.turn = 2; s.score = 20; });
  assert.deepEqual(texts(g.input('score')), ['Your score is 20 of a possible 40, in 2 turns, giving you the rank of Sergeant.']);
  assert.deepEqual(texts(g.input('time')), ['It is 21:31.']);
  assert.deepEqual(texts(g.input('help')), [mini.help]);
  const content = cloneContent(mini);
  delete content.help;
  assert.deepEqual(texts(newGame(content).input('help')), [metaMsgs.helpText]);
  assert.equal(g.snapshot().turn, 2);
});

test('VERBOSE / BRIEF set state settings (and saves carry them)', () => {
  const g = newGame();
  assert.deepEqual(texts(g.input('brief')), [metaMsgs.briefOn]);
  assert.equal(g.save().state.settings.verbose, false);
  assert.deepEqual(texts(g.input('verbose')), [metaMsgs.verboseOn]);
  assert.equal(g.snapshot().settings.verbose, true);
});

test('GRAPHICS [ON|OFF]: picture event alone, then the acknowledgement; bare toggles', () => {
  const g = newGame();
  assert.deepEqual(g.input('graphics off'), [{ type: 'picture', id: 'square', graphics: false }, { type: 'text', text: 'Graphics off.' }]);
  assert.equal(g.snapshot().settings.graphics, false);
  assert.deepEqual(g.input('graphics'), [{ type: 'picture', id: 'square', graphics: true }, { type: 'text', text: 'Graphics on.' }]);
  assert.deepEqual(g.input('graphics 2'), [sys('Use GRAPHICS ON or GRAPHICS OFF.')]);
  assert.equal(g.start()[2].graphics, true);
});

test('SOUND / MUSIC / TYPEWRITER / THEME emit host setting events (free, not terminal)', () => {
  const g = newGame();
  assert.deepEqual(g.input('sound off'), [{ type: 'host', op: 'setting', key: 'sound', value: 'off' }]);
  assert.deepEqual(g.input('music'), [{ type: 'host', op: 'setting', key: 'music', value: 'toggle' }]);
  assert.deepEqual(g.input('typewriter on'), [{ type: 'host', op: 'setting', key: 'typewriter', value: 'on' }]);
  assert.deepEqual(g.input('theme'), [{ type: 'host', op: 'setting', key: 'theme', value: 'next' }]);
  for (const v of HOST_SETTINGS.theme) assert.deepEqual(g.input(`theme ${v}`), [{ type: 'host', op: 'setting', key: 'theme', value: v }]);
  assert.deepEqual(g.input('sound 7'), [sys('Use SOUND ON or SOUND OFF.')]);
  assert.deepEqual(g.input('theme torch'), [sys(metaMsgs.themeUse)]);
  const chained = g.input('sound off. n');
  assert.equal(chained[0].type, 'host');
  assert.equal(g.snapshot().roomId, 'pub', 'settings do not stop a chain');
  assert.equal(g.snapshot().turn, 1);
});

test('YES / NO without a question: rhetorical, free', () => {
  const g = newGame();
  assert.deepEqual(texts(g.input('yes')), [metaMsgs.rhetorical]);
  assert.deepEqual(texts(g.input('no')), [metaMsgs.rhetorical]);
  assert.equal(g.snapshot().turn, 0);
});

test('WAIT costs a turn; room before slots with continue still let it run', () => {
  const g = newGame();
  assert.deepEqual(texts(g.input('wait')), [metaMsgs.wait]);
  assert.equal(g.snapshot().turn, 1);
  g.input('e');
  assert.deepEqual(texts(g.input('z')), ['Pike drums his fingers on the desk.', metaMsgs.wait]);
});

test('content verbs: before reactions, then `default`, else cantDo; 1 turn', () => {
  const g = newGame();
  assert.deepEqual(texts(g.input('pray')), ['Nobody is listening.']);
  assert.equal(g.snapshot().turn, 1);
  const content = cloneContent(mini);
  content.verbs = [...content.verbs, { id: 'dance', words: ['dance'] }];
  content.rooms.pub = { ...content.rooms.pub, before: { dance: 'Maggie raises an eyebrow.' } };
  const g2 = newGame(content);
  assert.deepEqual(texts(g2.input('dance')), [MESSAGES.cantDo]);
  g2.input('n');
  assert.deepEqual(texts(g2.input('dance')), ['Maggie raises an eyebrow.']);
});

test('content synonyms reach engine verbs (NICK = TAKE)', () => {
  const g = newGame();
  setup(g, (s) => { s.roomId = 'office'; s.visited.push('office'); });
  assert.equal(texts(g.input('nick torch'))[0], 'Taken.');
});

test('every engine verb has a registry entry (or is a barrier / AGAIN)', () => {
  for (const v of VERBS) {
    if (v.id === 'again') continue;
    if (CHAIN_BARRIERS.includes(v.id)) assert.equal(typeof SYSTEM_ACTIONS[v.id], 'function', v.id);
    else assert.equal(typeof ACTIONS[v.id]?.run, 'function', `no action for ${v.id}`);
  }
  for (const [id, def] of Object.entries(ACTIONS)) assert.equal(def.verb, id);
  for (const [id, text] of Object.entries(ACTION_MESSAGES)) {
    assert.equal(typeof text, 'string', id);
    assert.match(text, /^[\x20-\x7E\n£]*$/, `${id} obeys A12.2`);
  }
});

/** A sample sentence for each engine verb, built from its first pattern. */
function sample(verb) {
  const p = verb.patterns[0].replace('<word>', verb.words[0]);
  return p.replace('{dir:u|d}', 'up').replace('{dir}', 'north').replace('{dobj}', 'torch').replace('{iobj}', 'satchel')
    .replace('{topic}', 'murder').replace('{arg}', '1').replace(/\[[^\]]*\]\s?/g, '').replace(/(\w+)\|\S+/g, '$1');
}

test('every engine verb produces a sensible response on the mini-world and never throws', () => {
  for (const verb of VERBS) {
    const g = newGame();
    setup(g, (s) => { s.roomId = 'office'; s.visited.push('office'); s.items.torch.loc = 'player'; });
    const line = sample(verb);
    const ev = g.input(line);
    assert.ok(ev.length > 0, `${verb.id}: "${line}" produced nothing`);
    if (!CHAIN_BARRIERS.includes(verb.id) && !['sound', 'music', 'typewriter', 'theme', 'again'].includes(verb.id)) {
      assert.ok(texts(ev).length > 0 || ev.some((e) => e.type === 'prompt'), `${verb.id}: "${line}" said nothing`);
      assert.ok(!texts(ev).some((t) => t.startsWith('I don\'t know') || t === MESSAGES.noPattern), `${verb.id}: "${line}" → ${texts(ev)}`);
    }
  }
});

test('verb classes: meta verbs are free, world verbs cost 1, barriers cost 0', () => {
  const g = newGame();
  setup(g, (s) => { s.roomId = 'office'; s.visited.push('office'); });
  for (const line of ['i', 'score', 'time', 'help', 'notes', 'hint', 'verbose', 'brief', 'graphics', 'sound', 'theme', 'yes', 'save 1', 'export']) {
    g.input(line);
  }
  assert.equal(g.snapshot().turn, 0);
  for (const line of ['look', 'x torch', 'search', 'listen', 'smell', 'touch desk', 'jump', 'call', 'z']) g.input(line);
  assert.equal(g.snapshot().turn, 9);
});

test('TT-009 slot: NPC / case verbs answer with placeholders for now', () => {
  const g = newGame();
  g.input('n');
  assert.equal(texts(g.input('ask maggie about murder')).length, 1);
  assert.equal(texts(g.input('notes')).length, 1);
  assert.equal(g.snapshot().turn, 2);
});
