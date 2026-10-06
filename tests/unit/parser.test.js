// TT-005 — parser syntax layer: tokenise, splitChain, parseCommand, vocab (ARCHITECTURE A6.1, A6.2, A12.3).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { tokenise, splitChain, parseCommand } from '../../src/engine/parser.js';
import {
  VERBS, PREPOSITIONS, ARTICLES, DIRECTION_WORDS, buildVocab, isKnownWord,
} from '../../src/engine/vocab.js';
import { CHAIN_BARRIERS, META_VERBS, DIRECTIONS, LIMITS } from '../../src/engine/types.js';

/* ------------------------------------------------------------------ *
 *  Mini content: nouns, adjectives, topics and content verbs          *
 * ------------------------------------------------------------------ */
const CONTENT = {
  items: {
    brass_key: { name: 'brass key', names: ['key'], adjectives: ['brass'] },
    iron_key: { name: 'iron key', names: ['key'], adjectives: ['iron', 'rusty'] },
    torch: { name: 'torch', names: ['torch', 'lamp'] },
    coin: { name: 'coin', names: ['coin'] },
    box: { name: 'box', names: ['box'] },
    coat: { name: 'coat', names: ['coat'] },
    card: { name: 'warrant card', names: ['warrant card', 'card'] },
    rope: { name: 'rope', names: ['rope'] },
    cutters: { name: 'bolt cutters', names: ['bolt cutters', 'cutters'] },
    chains: { name: 'chains', names: ['chains', 'chain'] },
    ladder: { name: 'ladder', names: ['ladder'] },
    door: { name: 'door', names: ['door'] },
    table: { name: 'table', names: ['table'] },
    page: { name: 'page', names: ['page'] },
    book: { name: 'book', names: ['book'] },
    hook: { name: 'hook', names: ['hook'] },
    pie: { name: 'pie', names: ['pie'] },
    beer: { name: 'beer', names: ['beer'] },
    bell: { name: 'bell', names: ['bell'] },
    gates: { name: 'gates', names: ['gates'] },
    window: { name: 'window', names: ['window'] },
    hammer: { name: 'hammer', names: ['hammer'] },
    cuffs: { name: 'handcuffs', names: ['handcuffs'] },
    oilcan: { name: 'oil can', names: ['oil can'] },
  },
  npcs: {
    maggie: { name: 'Maggie', names: ['maggie', 'barmaid'] },
    pike: { name: 'Pike', names: ['pike', 'tallyman'], adjectives: ['mr'] },
    harrow: { name: 'Harrow', names: ['harrow'] },
    constable: { name: 'constable', names: ['constable'] },
  },
  rooms: {
    pub: { name: 'The Drowned Man', scenery: [{ names: ['bar', 'counter'], adjectives: ['oak'], desc: 'x' }] },
    canal: { name: 'Canal', scenery: [{ names: ['canal'], desc: 'x' }] },
  },
  topics: { murder: { names: ['murder', 'dead girl'] } },
  verbs: [
    { id: 'take', words: ['nick'] },
    { id: 'pray', words: ['pray', 'kneel'] },
  ],
};
const V = buildVocab(CONTENT);

/** Parse one line as a single segment with the mini-content vocabulary. */
const parse = (line) => parseCommand(tokenise(line), V);
/** Assert the exact ParsedCommand / ParseError; `raw` defaults to the normalised line. */
function expectParse(line, expected) {
  const res = parse(line);
  const raw = expected.raw ?? line.toLowerCase().trim().replace(/\s+/g, ' ');
  assert.deepEqual(res, { ...expected, raw }, `parse(${JSON.stringify(line)})`);
}
/** Table of rows -> one test per row. */
function table(name, rows) {
  describe(name, () => {
    for (const [line, expected] of rows) test(JSON.stringify(line), () => expectParse(line, expected));
  });
}
const w = (...words) => ({ words });

/* ------------------------------------------------------------------ *
 *  tokenise (P1, A12.3)                                               *
 * ------------------------------------------------------------------ */
describe('tokenise', () => {
  const cases = [
    ['TAKE  The Key', ['take', 'the', 'key']],
    ["examine pike's ledger", ['examine', 'pike', 'ledger']],
    ["don't panic", ['dont', 'panic']],
    ['take bolt-cutters', ['take', 'bolt', 'cutters']],
    ['n. s; e! w? u', ['n', '.', 's', '.', 'e', '.', 'w', '.', 'u']],
    ['take key, torch', ['take', 'key', ',', 'torch']],
    ['take "key" #1 @ (now)', ['take', 'key', '1', 'now']],
    ['save 2', ['save', '2']],
    ['examine pike’s desk', ['examine', 'pike', 'desk']],
    ['take bolt—cutters', ['take', 'bolt', 'cutters']],
    ['wait…', ['wait', '.', '.', '.']],
    ['take\tthe key', ['take', 'the', 'key']],
    ['ke​y', ['key']],
    ['  \n ', []],
    ['', []],
    ['buy pie for £2', ['buy', 'pie', 'for', '2']],
    ['look\r\nnorth', ['look', 'north']],
  ];
  for (const [line, toks] of cases) {
    test(JSON.stringify(line), () => assert.deepEqual(tokenise(line), toks));
  }
  test('non-string input is coerced and never throws', () => {
    assert.deepEqual(tokenise(null), []);
    assert.deepEqual(tokenise(undefined), []);
    assert.deepEqual(tokenise(42), ['42']);
    assert.deepEqual(tokenise({ toString() { throw new Error('boom'); } }), []);
    assert.doesNotThrow(() => tokenise(Symbol('x')));
    assert.doesNotThrow(() => tokenise(Object.create(null)));
  });
  test('input is truncated to LIMITS.inputLength characters before tokenising', () => {
    const line = 'a'.repeat(LIMITS.inputLength + 50);
    assert.deepEqual(tokenise(line), ['a'.repeat(LIMITS.inputLength)]);
    const words = tokenise('take key '.repeat(100));
    assert.ok(words.join(' ').length <= LIMITS.inputLength);
  });
});

/* ------------------------------------------------------------------ *
 *  splitChain (P2)                                                    *
 * ------------------------------------------------------------------ */
describe('splitChain', () => {
  const sc = (line) => splitChain(tokenise(line), V).map((s) => s.join(' '));
  test("PLAN example 'TAKE TORCH. N THEN OPEN DOOR'", () => {
    assert.deepEqual(sc('TAKE TORCH. N THEN OPEN DOOR'), ['take torch', 'n', 'open door']);
  });
  test("'and then' is one separator", () => assert.deepEqual(sc('take key and then n'), ['take key', 'n']));
  test("',' before a verb splits; before a noun stays", () => {
    assert.deepEqual(sc('take key, open door'), ['take key', 'open door']);
    assert.deepEqual(sc('take key, torch'), ['take key , torch']);
  });
  test("'and' before a verb splits; before a noun stays", () => {
    assert.deepEqual(sc('take key and open door'), ['take key', 'open door']);
    assert.deepEqual(sc('take key and torch'), ['take key and torch']);
  });
  test("'and' / ',' before a direction word splits", () => {
    assert.deepEqual(sc('n, e and s'), ['n', 'e', 's']);
  });
  test('an article after AND keeps a verb-like noun in the list', () => {
    assert.deepEqual(sc('take key and the light'), ['take key and the light']);
  });
  test('TT-016: a multiword name that starts with a verb word stays in the list (STORY §12.1 #48)', () => {
    assert.deepEqual(sc('take cutters and oil can'), ['take cutters and oil can']);
    assert.deepEqual(sc('take cutters, oil can'), ['take cutters , oil can']);
    assert.deepEqual(parse('take cutters and oil can'), {
      verb: 'take', verbWord: 'take', dobj: { list: [w('cutters'), w('oil', 'can')] }, raw: 'take cutters and oil can',
    });
    // Only the whole name protects the noun: a verb word not followed by its name still splits.
    assert.deepEqual(sc('take cutters and oil gates'), ['take cutters', 'oil gates']);
    assert.deepEqual(sc('take cutters and oil'), ['take cutters', 'oil']);
    // Engine-only vocabulary knows no names, so the contract rule applies unchanged.
    assert.deepEqual(splitChain(tokenise('take cutters and oil can')).map((s) => s.join(' ')), ['take cutters', 'oil can']);
  });
  test('a multiword-verb head (pick up) starts a command', () => {
    assert.deepEqual(sc('drop coat, pick up key'), ['drop coat', 'pick up key']);
  });
  test('empty segments are dropped', () => {
    assert.deepEqual(sc('. . n .. then then s .'), ['n', 's']);
    assert.deepEqual(splitChain([]), []);
    assert.deepEqual(sc('...'), []);
  });
  test('content verbs start commands when the vocab is passed', () => {
    assert.deepEqual(sc('take key, nick lamp'), ['take key', 'nick lamp']);
    assert.deepEqual(splitChain(tokenise('take key, nick lamp')).map((s) => s.join(' ')), ['take key , nick lamp']);
  });
  test('non-array input never throws', () => {
    assert.deepEqual(splitChain(null), []);
    assert.deepEqual(splitChain('take key'), []);
    assert.deepEqual(splitChain([1, null, 'n']).map((s) => s.join(' ')), ['n']);
  });
});

/* ------------------------------------------------------------------ *
 *  A6.2 contract table (verbatim)                                     *
 * ------------------------------------------------------------------ */
table('A6.2 contract examples', [
  ['n', { verb: 'go', verbWord: 'n', dir: 'n' }],
  ['go north', { verb: 'go', verbWord: 'go', dir: 'n' }],
  ['take the brass key', { verb: 'take', verbWord: 'take', dobj: w('brass', 'key') }],
  ['pick it up', { verb: 'take', verbWord: 'pick up', dobj: { pronoun: 'it' } }],
  ['take all except torch and key', { verb: 'take', verbWord: 'take', dobj: { all: true, except: [w('torch'), w('key')] } }],
  ['take key and torch', { verb: 'take', verbWord: 'take', dobj: { list: [w('key'), w('torch')] } }],
  ['put coin in box', { verb: 'put', verbWord: 'put', dobj: w('coin'), prep: 'in', iobj: w('box') }],
  ['ask maggie about the dead girl', { verb: 'ask', verbWord: 'ask', dobj: w('maggie'), prep: 'about', topic: 'the dead girl' }],
  ['turn torch on', { verb: 'turn_on', verbWord: 'turn on', dobj: w('torch') }],
  ['save 2', { verb: 'save', verbWord: 'save', arg: '2' }],
  ['sound off', { verb: 'sound', verbWord: 'sound', arg: 'off' }],
  ['xyzzy', { error: 'unknown-word', word: 'xyzzy' }],
  ['key', { error: 'no-verb', word: 'key' }],
  ['take', { error: 'missing-noun', verb: 'take', verbWord: 'take' }],
  ['take key from', { error: 'no-pattern', verb: 'take', verbWord: 'take' }],
]);

/* ------------------------------------------------------------------ *
 *  Directions and abbreviations                                       *
 * ------------------------------------------------------------------ */
table('direction abbreviations and words', [
  ...DIRECTIONS.filter((d) => d !== 'in' && d !== 'out').map((d) => [d, { verb: 'go', verbWord: d, dir: d }]),
  ['north', { verb: 'go', verbWord: 'north', dir: 'n' }],
  ['northeast', { verb: 'go', verbWord: 'northeast', dir: 'ne' }],
  ['southwest', { verb: 'go', verbWord: 'southwest', dir: 'sw' }],
  ['up', { verb: 'go', verbWord: 'up', dir: 'u' }],
  ['down', { verb: 'go', verbWord: 'down', dir: 'd' }],
  ['in', { verb: 'go', verbWord: 'in', dir: 'in' }],
  ['inside', { verb: 'go', verbWord: 'inside', dir: 'in' }],
  ['out', { verb: 'go', verbWord: 'out', dir: 'out' }],
  ['outside', { verb: 'go', verbWord: 'outside', dir: 'out' }],
  ['walk east', { verb: 'go', verbWord: 'walk', dir: 'e' }],
  ['run s', { verb: 'go', verbWord: 'run', dir: 's' }],
  ['head up', { verb: 'go', verbWord: 'head', dir: 'u' }],
  ['go inside', { verb: 'enter', verbWord: 'go inside' }],
]);

table('single-letter verb abbreviations', [
  ['l', { verb: 'look', verbWord: 'l' }],
  ['x key', { verb: 'examine', verbWord: 'x', dobj: w('key') }],
  ['i', { verb: 'inventory', verbWord: 'i' }],
  ['inv', { verb: 'inventory', verbWord: 'inv' }],
  ['z', { verb: 'wait', verbWord: 'z' }],
  ['g', { verb: 'again', verbWord: 'g' }],
  ['q', { verb: 'quit', verbWord: 'q' }],
  ['y', { verb: 'yes', verbWord: 'y' }],
]);

/* ------------------------------------------------------------------ *
 *  Every engine verb pattern (A6.1)                                   *
 * ------------------------------------------------------------------ */
table('movement verbs', [
  ['back', { verb: 'back', verbWord: 'back' }],
  ['go back', { verb: 'back', verbWord: 'go back' }],
  ['return', { verb: 'back', verbWord: 'return' }],
  ['enter', { verb: 'enter', verbWord: 'enter' }],
  ['enter the box', { verb: 'enter', verbWord: 'enter', dobj: w('box') }],
  ['go in', { verb: 'enter', verbWord: 'go in' }],
  ['go into box', { verb: 'enter', verbWord: 'go into', dobj: w('box') }],
  ['get in', { verb: 'enter', verbWord: 'get in' }],
  ['exit', { verb: 'exit', verbWord: 'exit' }],
  ['leave', { verb: 'exit', verbWord: 'leave' }],
  ['get out', { verb: 'exit', verbWord: 'get out' }],
  ['go out', { verb: 'exit', verbWord: 'go out' }],
  ['get out of the box', { verb: 'exit', verbWord: 'get out of', dobj: w('box') }],
  ['climb ladder', { verb: 'climb', verbWord: 'climb', dobj: w('ladder') }],
  ['climb up', { verb: 'climb', verbWord: 'climb', dir: 'u' }],
  ['climb down the ladder', { verb: 'climb', verbWord: 'climb', dir: 'd', dobj: w('ladder') }],
  ['scale the wall', { error: 'unknown-word', word: 'wall' }],
  ['clamber up ladder', { verb: 'climb', verbWord: 'clamber', dir: 'u', dobj: w('ladder') }],
]);

table('looking and senses', [
  ['look', { verb: 'look', verbWord: 'look' }],
  ['look around', { verb: 'look', verbWord: 'look around' }],
  ['examine the iron key', { verb: 'examine', verbWord: 'examine', dobj: w('iron', 'key') }],
  ['look at the brass key', { verb: 'examine', verbWord: 'look at', dobj: w('brass', 'key') }],
  ['inspect card', { verb: 'examine', verbWord: 'inspect', dobj: w('card') }],
  ['check warrant card', { verb: 'examine', verbWord: 'check', dobj: w('warrant', 'card') }],
  ['search', { verb: 'search', verbWord: 'search' }],
  ['search the box', { verb: 'search', verbWord: 'search', dobj: w('box') }],
  ['rummage box', { verb: 'search', verbWord: 'rummage', dobj: w('box') }],
  ['look in box', { verb: 'search', verbWord: 'look in', dobj: w('box') }],
  ['look inside box', { verb: 'search', verbWord: 'look inside', dobj: w('box') }],
  ['look under table', { verb: 'search', verbWord: 'look under', dobj: w('table') }],
  ['look beneath table', { verb: 'search', verbWord: 'look beneath', dobj: w('table') }],
  ['look behind the door', { verb: 'search', verbWord: 'look behind', dobj: w('door') }],
  ['read book', { verb: 'read', verbWord: 'read', dobj: w('book') }],
  ['listen', { verb: 'listen', verbWord: 'listen' }],
  ['listen to the bell', { verb: 'listen', verbWord: 'listen to', dobj: w('bell') }],
  ['smell', { verb: 'smell', verbWord: 'smell' }],
  ['sniff beer', { verb: 'smell', verbWord: 'sniff', dobj: w('beer') }],
  ['touch the oak counter', { verb: 'touch', verbWord: 'touch', dobj: w('oak', 'counter') }],
]);

table('take / drop / put', [
  ['get key', { verb: 'take', verbWord: 'get', dobj: w('key') }],
  ['grab key', { verb: 'take', verbWord: 'grab', dobj: w('key') }],
  ['carry the lamp', { verb: 'take', verbWord: 'carry', dobj: w('lamp') }],
  ['pick up the key', { verb: 'take', verbWord: 'pick up', dobj: w('key') }],
  ['pick the rusty key up', { verb: 'take', verbWord: 'pick up', dobj: w('rusty', 'key') }],
  ['take key from box', { verb: 'take', verbWord: 'take', dobj: w('key'), prep: 'from', iobj: w('box') }],
  ['take key off hook', { verb: 'take', verbWord: 'take', dobj: w('key'), prep: 'from', iobj: w('hook') }],
  ['take coin out of the box', { verb: 'take', verbWord: 'take', dobj: w('coin'), prep: 'from', iobj: w('box') }],
  ['drop key', { verb: 'drop', verbWord: 'drop', dobj: w('key') }],
  ['put down the key', { verb: 'drop', verbWord: 'put down', dobj: w('key') }],
  ['put key down', { verb: 'drop', verbWord: 'put down', dobj: w('key') }],
  ['discard coin', { verb: 'drop', verbWord: 'discard', dobj: w('coin') }],
  ['put coin into box', { verb: 'put', verbWord: 'put', dobj: w('coin'), prep: 'in', iobj: w('box') }],
  ['insert coin inside box', { verb: 'put', verbWord: 'insert', dobj: w('coin'), prep: 'in', iobj: w('box') }],
  ['put coin on table', { verb: 'put', verbWord: 'put', dobj: w('coin'), prep: 'on', iobj: w('table') }],
  ['place the coin onto the table', { verb: 'put', verbWord: 'place', dobj: w('coin'), prep: 'on', iobj: w('table') }],
  ['stick card upon table', { verb: 'put', verbWord: 'stick', dobj: w('card'), prep: 'on', iobj: w('table') }],
]);

table('object manipulation', [
  ['open door', { verb: 'open', verbWord: 'open', dobj: w('door') }],
  ['close door', { verb: 'close', verbWord: 'close', dobj: w('door') }],
  ['shut the box', { verb: 'close', verbWord: 'shut', dobj: w('box') }],
  ['unlock door', { verb: 'unlock', verbWord: 'unlock', dobj: w('door') }],
  ['unlock the door with the brass key', { verb: 'unlock', verbWord: 'unlock', dobj: w('door'), prep: 'with', iobj: w('brass', 'key') }],
  ['lock door using key', { verb: 'lock', verbWord: 'lock', dobj: w('door'), prep: 'with', iobj: w('key') }],
  ['push door', { verb: 'push', verbWord: 'push', dobj: w('door') }],
  ['press bell', { verb: 'push', verbWord: 'press', dobj: w('bell') }],
  ['shove box', { verb: 'push', verbWord: 'shove', dobj: w('box') }],
  ['pull rope', { verb: 'pull', verbWord: 'pull', dobj: w('rope') }],
  ['tug rope', { verb: 'pull', verbWord: 'tug', dobj: w('rope') }],
  ['yank chain', { verb: 'pull', verbWord: 'yank', dobj: w('chain') }],
  ['move table', { verb: 'move', verbWord: 'move', dobj: w('table') }],
  ['slide box', { verb: 'move', verbWord: 'slide', dobj: w('box') }],
  ['shift table', { verb: 'move', verbWord: 'shift', dobj: w('table') }],
  ['turn on the torch', { verb: 'turn_on', verbWord: 'turn on', dobj: w('torch') }],
  ['switch on lamp', { verb: 'turn_on', verbWord: 'switch on', dobj: w('lamp') }],
  ['switch lamp on', { verb: 'turn_on', verbWord: 'switch on', dobj: w('lamp') }],
  ['light torch', { verb: 'turn_on', verbWord: 'light', dobj: w('torch') }],
  ['ignite lamp', { verb: 'turn_on', verbWord: 'ignite', dobj: w('lamp') }],
  ['turn off torch', { verb: 'turn_off', verbWord: 'turn off', dobj: w('torch') }],
  ['turn the torch off', { verb: 'turn_off', verbWord: 'turn off', dobj: w('torch') }],
  ['switch off lamp', { verb: 'turn_off', verbWord: 'switch off', dobj: w('lamp') }],
  ['extinguish lamp', { verb: 'turn_off', verbWord: 'extinguish', dobj: w('lamp') }],
  ['wear coat', { verb: 'wear', verbWord: 'wear', dobj: w('coat') }],
  ['don coat', { verb: 'wear', verbWord: 'don', dobj: w('coat') }],
  ['put on the coat', { verb: 'wear', verbWord: 'put on', dobj: w('coat') }],
  ['put coat on', { verb: 'wear', verbWord: 'put on', dobj: w('coat') }],
  ['remove coat', { verb: 'remove', verbWord: 'remove', dobj: w('coat') }],
  ['take off coat', { verb: 'remove', verbWord: 'take off', dobj: w('coat') }],
  ['take the coat off', { verb: 'remove', verbWord: 'take off', dobj: w('coat') }],
  ['doff coat', { verb: 'remove', verbWord: 'doff', dobj: w('coat') }],
  ['eat pie', { verb: 'eat', verbWord: 'eat', dobj: w('pie') }],
  ['devour pie', { verb: 'eat', verbWord: 'devour', dobj: w('pie') }],
  ['drink beer', { verb: 'drink', verbWord: 'drink', dobj: w('beer') }],
  ['sip beer', { verb: 'drink', verbWord: 'sip', dobj: w('beer') }],
  ['swig beer', { verb: 'drink', verbWord: 'swig', dobj: w('beer') }],
  ['quaff beer', { verb: 'drink', verbWord: 'quaff', dobj: w('beer') }],
  ['throw rope', { verb: 'throw', verbWord: 'throw', dobj: w('rope') }],
  ['throw the rope at pike', { verb: 'throw', verbWord: 'throw', dobj: w('rope'), prep: 'at', iobj: w('pike') }],
  ['toss coin into canal', { verb: 'throw', verbWord: 'toss', dobj: w('coin'), prep: 'in', iobj: w('canal') }],
  ['hurl rope over gates', { verb: 'throw', verbWord: 'hurl', dobj: w('rope'), prep: 'over', iobj: w('gates') }],
  ['break window', { verb: 'break', verbWord: 'break', dobj: w('window') }],
  ['smash window with hammer', { verb: 'break', verbWord: 'smash', dobj: w('window'), prep: 'with', iobj: w('hammer') }],
  ['burn book', { verb: 'break', verbWord: 'burn', dobj: w('book') }],
  ['tear page', { verb: 'tear', verbWord: 'tear', dobj: w('page') }],
  ['rip page from book', { verb: 'tear', verbWord: 'rip', dobj: w('page'), prep: 'from', iobj: w('book') }],
  ['tear the page out of the book', { verb: 'tear', verbWord: 'tear', dobj: w('page'), prep: 'from', iobj: w('book') }],
  ['cut chains', { verb: 'cut', verbWord: 'cut', dobj: w('chains') }],
  ['cut the chains with the bolt cutters', { verb: 'cut', verbWord: 'cut', dobj: w('chains'), prep: 'with', iobj: w('bolt', 'cutters') }],
  ['sever chain using cutters', { verb: 'cut', verbWord: 'sever', dobj: w('chain'), prep: 'with', iobj: w('cutters') }],
  ['oil gates', { verb: 'oil', verbWord: 'oil', dobj: w('gates') }],
  ['lubricate gates with oil can', { verb: 'oil', verbWord: 'lubricate', dobj: w('gates'), prep: 'with', iobj: w('oil', 'can') }],
  ['use cutters', { verb: 'use', verbWord: 'use', dobj: w('cutters') }],
  ['use bolt cutters on chains', { verb: 'use', verbWord: 'use', dobj: w('bolt', 'cutters'), prep: 'on', iobj: w('chains') }],
  ['use key with door', { verb: 'use', verbWord: 'use', dobj: w('key'), prep: 'with', iobj: w('door') }],
  ['attack pike', { verb: 'attack', verbWord: 'attack', dobj: w('pike') }],
  ['hit pike with hammer', { verb: 'attack', verbWord: 'hit', dobj: w('pike'), prep: 'with', iobj: w('hammer') }],
  ['kick door', { verb: 'attack', verbWord: 'kick', dobj: w('door') }],
]);

table('people and the case', [
  ['talk to maggie', { verb: 'talk', verbWord: 'talk to', dobj: w('maggie') }],
  ['speak to the barmaid', { verb: 'talk', verbWord: 'speak to', dobj: w('barmaid') }],
  ['chat with pike', { verb: 'talk', verbWord: 'chat with', dobj: w('pike') }],
  ['tell pike about murder', { verb: 'tell', verbWord: 'tell', dobj: w('pike'), prep: 'about', topic: 'murder' }],
  ['question maggie about xyzzy plugh', { verb: 'ask', verbWord: 'question', dobj: w('maggie'), prep: 'about', topic: 'xyzzy plugh' }],
  ["ask maggie about Pike's ledger", { verb: 'ask', verbWord: 'ask', dobj: w('maggie'), prep: 'about', topic: 'pike ledger', raw: 'ask maggie about pike ledger' }],
  ['show card to pike', { verb: 'show', verbWord: 'show', dobj: w('card'), prep: 'to', iobj: w('pike') }],
  ['show pike the warrant card', { verb: 'show', verbWord: 'show', iobj: w('pike'), dobj: w('warrant', 'card') }],
  ['present card to constable', { verb: 'show', verbWord: 'present', dobj: w('card'), prep: 'to', iobj: w('constable') }],
  ['give key to maggie', { verb: 'give', verbWord: 'give', dobj: w('key'), prep: 'to', iobj: w('maggie') }],
  ['give maggie key', { verb: 'give', verbWord: 'give', iobj: w('maggie'), dobj: w('key') }],
  ['hand mr pike the brass key', { verb: 'give', verbWord: 'hand', iobj: w('mr', 'pike'), dobj: w('brass', 'key') }],
  ['offer coin to maggie', { verb: 'give', verbWord: 'offer', dobj: w('coin'), prep: 'to', iobj: w('maggie') }],
  ['buy pie', { verb: 'buy', verbWord: 'buy', dobj: w('pie') }],
  ['buy a pie from maggie', { verb: 'buy', verbWord: 'buy', dobj: w('pie'), prep: 'from', iobj: w('maggie') }],
  ['purchase beer', { verb: 'buy', verbWord: 'purchase', dobj: w('beer') }],
  ['order beer', { verb: 'buy', verbWord: 'order', dobj: w('beer') }],
  ['call', { verb: 'call', verbWord: 'call' }],
  ['call the constable', { verb: 'call', verbWord: 'call', dobj: w('constable') }],
  ['phone constable', { verb: 'call', verbWord: 'phone', dobj: w('constable') }],
  ['dial', { verb: 'call', verbWord: 'dial' }],
  ['ring constable', { verb: 'call', verbWord: 'ring', dobj: w('constable') }],
  ['accuse pike', { verb: 'accuse', verbWord: 'accuse', dobj: w('pike') }],
  ['charge the tallyman', { verb: 'accuse', verbWord: 'charge', dobj: w('tallyman') }],
  ['arrest pike', { verb: 'arrest', verbWord: 'arrest', dobj: w('pike') }],
  ['arrest pike with handcuffs', { verb: 'arrest', verbWord: 'arrest', dobj: w('pike'), prep: 'with', iobj: w('handcuffs') }],
  ['cuff pike', { verb: 'arrest', verbWord: 'cuff', dobj: w('pike') }],
  ['handcuff pike', { verb: 'arrest', verbWord: 'handcuff', dobj: w('pike') }],
  ['restrain pike', { verb: 'arrest', verbWord: 'restrain', dobj: w('pike') }],
  ['free harrow', { verb: 'free', verbWord: 'free', dobj: w('harrow') }],
  ['release harrow', { verb: 'free', verbWord: 'release', dobj: w('harrow') }],
  ['unchain harrow', { verb: 'free', verbWord: 'unchain', dobj: w('harrow') }],
  ['rescue harrow', { verb: 'free', verbWord: 'rescue', dobj: w('harrow') }],
]);

table('body and waiting', [
  ['swim', { verb: 'swim', verbWord: 'swim' }],
  ['swim in canal', { verb: 'swim', verbWord: 'swim in', dobj: w('canal') }],
  ['dive into the canal', { verb: 'swim', verbWord: 'dive into', dobj: w('canal') }],
  ['wade', { verb: 'swim', verbWord: 'wade' }],
  ['jump', { verb: 'jump', verbWord: 'jump' }],
  ['jump off ladder', { verb: 'jump', verbWord: 'jump off', dobj: w('ladder') }],
  ['jump into canal', { verb: 'jump', verbWord: 'jump into', dobj: w('canal') }],
  ['leap over gates', { verb: 'jump', verbWord: 'leap over', dobj: w('gates') }],
  ['wait', { verb: 'wait', verbWord: 'wait' }],
]);

table('meta and system verbs', [
  ['yes', { verb: 'yes', verbWord: 'yes' }],
  ['no', { verb: 'no', verbWord: 'no' }],
  ['inventory', { verb: 'inventory', verbWord: 'inventory' }],
  ['score', { verb: 'score', verbWord: 'score' }],
  ['time', { verb: 'time', verbWord: 'time' }],
  ['help', { verb: 'help', verbWord: 'help' }],
  ['notes', { verb: 'notes', verbWord: 'notes' }],
  ['notebook', { verb: 'notes', verbWord: 'notebook' }],
  ['clues', { verb: 'notes', verbWord: 'clues' }],
  ['case', { verb: 'notes', verbWord: 'case' }],
  ['hint', { verb: 'hint', verbWord: 'hint' }],
  ['hints', { verb: 'hint', verbWord: 'hints' }],
  ['verbose', { verb: 'verbose', verbWord: 'verbose' }],
  ['brief', { verb: 'brief', verbWord: 'brief' }],
  ['graphics', { verb: 'graphics', verbWord: 'graphics' }],
  ['graphics off', { verb: 'graphics', verbWord: 'graphics', arg: 'off' }],
  ['sound on', { verb: 'sound', verbWord: 'sound', arg: 'on' }],
  ['music toggle', { verb: 'music', verbWord: 'music', arg: 'toggle' }],
  ['typewriter off', { verb: 'typewriter', verbWord: 'typewriter', arg: 'off' }],
  ['theme', { verb: 'theme', verbWord: 'theme' }],
  ['theme spectrum', { verb: 'theme', verbWord: 'theme', arg: 'spectrum' }],
  ['theme c64', { verb: 'theme', verbWord: 'theme', arg: 'c64' }],
  ['again', { verb: 'again', verbWord: 'again' }],
  ['save', { verb: 'save', verbWord: 'save' }],
  ['save 7', { verb: 'save', verbWord: 'save', arg: '7' }],
  ['load 1', { verb: 'load', verbWord: 'load', arg: '1' }],
  ['restore 3', { verb: 'load', verbWord: 'restore', arg: '3' }],
  ['export', { verb: 'export', verbWord: 'export' }],
  ['import', { verb: 'import', verbWord: 'import' }],
  ['undo', { verb: 'undo', verbWord: 'undo' }],
  ['restart', { verb: 'restart', verbWord: 'restart' }],
  ['quit', { verb: 'quit', verbWord: 'quit' }],
]);

/* ------------------------------------------------------------------ *
 *  Noun phrases: fillers, pronouns, ALL / EXCEPT, lists (P4)          *
 * ------------------------------------------------------------------ */
table('fillers and case', [
  ['please take the key', { verb: 'take', verbWord: 'take', dobj: w('key') }],
  ['take my coat', { verb: 'take', verbWord: 'take', dobj: w('coat') }],
  ['buy some beer', { verb: 'buy', verbWord: 'buy', dobj: w('beer') }],
  ['TAKE The BRASS Key', { verb: 'take', verbWord: 'take', dobj: w('brass', 'key'), raw: 'take the brass key' }],
  ['take an iron key', { verb: 'take', verbWord: 'take', dobj: w('iron', 'key') }],
  ['take 2 coin', { verb: 'take', verbWord: 'take', dobj: w('2', 'coin') }],
]);

table('pronouns', [
  ['take it', { verb: 'take', verbWord: 'take', dobj: { pronoun: 'it' } }],
  ['drop them', { verb: 'drop', verbWord: 'drop', dobj: { pronoun: 'them' } }],
  ['ask him about murder', { verb: 'ask', verbWord: 'ask', dobj: { pronoun: 'him' }, prep: 'about', topic: 'murder' }],
  ['give her the key', { verb: 'give', verbWord: 'give', iobj: { pronoun: 'her' }, dobj: w('key') }],
  ['show it to him', { verb: 'show', verbWord: 'show', dobj: { pronoun: 'it' }, prep: 'to', iobj: { pronoun: 'him' } }],
  ['unlock it with the key', { verb: 'unlock', verbWord: 'unlock', dobj: { pronoun: 'it' }, prep: 'with', iobj: w('key') }],
]);

table('ALL, EXCEPT and lists', [
  ['take all', { verb: 'take', verbWord: 'take', dobj: { all: true } }],
  ['take everything', { verb: 'take', verbWord: 'take', dobj: { all: true } }],
  ['take all but the torch', { verb: 'take', verbWord: 'take', dobj: { all: true, except: [w('torch')] } }],
  ['drop all except it', { verb: 'drop', verbWord: 'drop', dobj: { all: true, except: [{ pronoun: 'it' }] } }],
  ['take everything except brass key, torch and coin', { verb: 'take', verbWord: 'take', dobj: { all: true, except: [w('brass', 'key'), w('torch'), w('coin')] } }],
  ['take all from the box', { verb: 'take', verbWord: 'take', dobj: { all: true }, prep: 'from', iobj: w('box') }],
  ['put all in box', { verb: 'put', verbWord: 'put', dobj: { all: true }, prep: 'in', iobj: w('box') }],
  ['take key, torch and coin', { verb: 'take', verbWord: 'take', dobj: { list: [w('key'), w('torch'), w('coin')] } }],
  ['take the brass key and the iron key', { verb: 'take', verbWord: 'take', dobj: { list: [w('brass', 'key'), w('iron', 'key')] } }],
  ['drop it and coin', { verb: 'drop', verbWord: 'drop', dobj: { list: [{ pronoun: 'it' }, w('coin')] } }],
  ['put key and coin in box', { verb: 'put', verbWord: 'put', dobj: { list: [w('key'), w('coin')] }, prep: 'in', iobj: w('box') }],
  ['take all coin', { error: 'no-pattern', verb: 'take', verbWord: 'take' }],
  ['take all except', { error: 'no-pattern', verb: 'take', verbWord: 'take' }],
  ['take key but torch', { error: 'no-pattern', verb: 'take', verbWord: 'take' }],
]);

/* ------------------------------------------------------------------ *
 *  Errors (P3 priority)                                               *
 * ------------------------------------------------------------------ */
table('errors', [
  ['', { error: 'empty', raw: '' }],
  ['   ', { error: 'empty', raw: '' }],
  ['the', { error: 'no-verb', word: 'the' }],
  ['frobnicate the key', { error: 'unknown-word', word: 'frobnicate' }],
  ['key xyzzy', { error: 'unknown-word', word: 'xyzzy' }],
  ['take the xyzzy', { error: 'unknown-word', word: 'xyzzy' }],
  ['take key from xyzzy', { error: 'unknown-word', word: 'xyzzy' }],
  ['ask maggie xyzzy', { error: 'unknown-word', word: 'xyzzy' }],
  ['save foo', { error: 'unknown-word', word: 'foo' }],
  ['brass key', { error: 'no-verb', word: 'brass' }],
  ['about', { error: 'no-verb', word: 'about' }],
  ['put', { error: 'missing-noun', verb: 'put', verbWord: 'put' }],
  ['x', { error: 'missing-noun', verb: 'examine', verbWord: 'x', verbName: 'examine' }], // TT-131
  ['look at', { error: 'missing-noun', verb: 'examine', verbWord: 'look at' }],
  ['pick up', { error: 'missing-noun', verb: 'take', verbWord: 'pick up' }],
  ['pick', { error: 'missing-noun', verb: 'take', verbWord: 'pick' }],
  ['turn', { error: 'missing-noun', verb: 'turn_on', verbWord: 'turn' }],
  ['ask', { error: 'missing-noun', verb: 'ask', verbWord: 'ask' }],
  ['climb', { error: 'missing-noun', verb: 'climb', verbWord: 'climb' }],
  ['go', { error: 'no-pattern', verb: 'go', verbWord: 'go' }],
  ['go key', { error: 'no-pattern', verb: 'go', verbWord: 'go' }],
  ['n key', { error: 'no-pattern', verb: 'go', verbWord: 'n' }],
  ['put coin in', { error: 'no-pattern', verb: 'put', verbWord: 'put' }],
  ['ask maggie about', { error: 'no-pattern', verb: 'ask', verbWord: 'ask' }],
  ['ask maggie about the', { error: 'no-pattern', verb: 'ask', verbWord: 'ask' }],
  ['save 2 3', { error: 'no-pattern', verb: 'save', verbWord: 'save' }],
  ['look key', { error: 'no-pattern', verb: 'look', verbWord: 'look' }],
  ['talk maggie', { error: 'no-pattern', verb: 'talk', verbWord: 'talk' }],
]);

describe('parseCommand input handling', () => {
  test('raw keeps fillers and glues commas', () => {
    assert.equal(parse('take the key , torch').raw, 'take the key, torch');
  });
  test('stray leading/trailing commas and full stops are ignored', () => {
    assert.deepEqual(parseCommand([',', 'take', 'key', ',', '.'], V), { verb: 'take', verbWord: 'take', dobj: w('key'), raw: 'take key' });
  });
  test('tokens are lower-cased defensively', () => {
    assert.deepEqual(parseCommand(['TAKE', 'Key'], V), { verb: 'take', verbWord: 'take', dobj: w('key'), raw: 'take key' });
  });
  test('a string is accepted and tokenised', () => {
    assert.deepEqual(parseCommand('Take the key', V), { verb: 'take', verbWord: 'take', dobj: w('key'), raw: 'take the key' });
  });
  test('vocab defaults to the engine-only vocabulary', () => {
    assert.deepEqual(parseCommand(['n']), { verb: 'go', verbWord: 'n', dir: 'n', raw: 'n' });
    assert.deepEqual(parseCommand(['take', 'key']), { error: 'unknown-word', word: 'key', raw: 'take key' });
  });
  test('numbers are always known words', () => {
    assert.deepEqual(parseCommand(['take', '12']), { verb: 'take', verbWord: 'take', dobj: w('12'), raw: 'take 12' });
  });
});

/* ------------------------------------------------------------------ *
 *  Output shape (acceptance 1)                                        *
 * ------------------------------------------------------------------ */
const CMD_KEYS = new Set(['verb', 'verbWord', 'dobj', 'prep', 'iobj', 'dir', 'topic', 'arg', 'raw']);
const ERR_KEYS = new Set(['error', 'word', 'verb', 'verbWord', 'verbName', 'raw']); // verbName: TT-131
const PREP_IDS = new Set([...Object.keys(PREPOSITIONS), 'over']);
function assertPhrase(p, where) {
  assert.ok(p && typeof p === 'object', `${where} is an object`);
  const kinds = ['words', 'pronoun', 'all', 'list'].filter((k) => k in p);
  assert.equal(kinds.length, 1, `${where} has exactly one of words/pronoun/all/list: ${JSON.stringify(p)}`);
  if (p.words) assert.ok(p.words.length > 0 && p.words.every((x) => typeof x === 'string' && x));
  if (p.list) for (const [i, e] of p.list.entries()) assertPhrase(e, `${where}.list[${i}]`);
  if ('except' in p) {
    assert.equal(p.all, true, 'except only with all');
    for (const [i, e] of p.except.entries()) assertPhrase(e, `${where}.except[${i}]`);
  }
  for (const k of Object.keys(p)) assert.ok(['words', 'pronoun', 'all', 'list', 'except'].includes(k), `phrase key ${k}`);
}
function assertShape(res) {
  assert.ok(res && typeof res === 'object');
  assert.equal(typeof res.raw, 'string');
  if ('error' in res) {
    for (const k of Object.keys(res)) assert.ok(ERR_KEYS.has(k), `error key ${k}`);
    assert.ok(['empty', 'unknown-word', 'no-verb', 'missing-noun', 'no-pattern'].includes(res.error));
  } else {
    for (const k of Object.keys(res)) assert.ok(CMD_KEYS.has(k), `command key ${k}`);
    assert.equal(typeof res.verb, 'string');
    assert.equal(typeof res.verbWord, 'string');
    if (res.dobj) assertPhrase(res.dobj, 'dobj');
    if (res.iobj) assertPhrase(res.iobj, 'iobj');
    if (res.prep) assert.ok(PREP_IDS.has(res.prep), `prep ${res.prep}`);
    if (res.dir) assert.ok(DIRECTIONS.includes(res.dir));
  }
  assert.deepEqual(JSON.parse(JSON.stringify(res)), res, 'plain JSON');
}

describe('output shape', () => {
  test('every result in this file is plain JSON with only contract keys', () => {
    const lines = ['take all except torch and key', 'give her the key', 'n', 'xyzzy', 'take', 'ask maggie about the dead girl',
      'put key and coin in box', 'sound off', 'climb down the ladder', 'hurl rope over gates'];
    for (const l of lines) assertShape(parse(l));
  });
});

/* ------------------------------------------------------------------ *
 *  Vocabulary (A6.1) and content extension (acceptance 3)             *
 * ------------------------------------------------------------------ */
describe('vocab', () => {
  const ENGINE_IDS = ['go', 'back', 'enter', 'exit', 'climb', 'look', 'examine', 'search', 'read', 'listen', 'smell',
    'take', 'drop', 'put', 'open', 'close', 'unlock', 'lock', 'push', 'pull', 'move', 'turn_on', 'turn_off', 'wear',
    'remove', 'eat', 'drink', 'throw', 'break', 'tear', 'cut', 'oil', 'use', 'touch', 'attack', 'talk', 'ask', 'tell',
    'show', 'give', 'buy', 'call', 'accuse', 'arrest', 'free', 'swim', 'jump', 'wait', 'yes', 'no', 'inventory', 'score',
    'time', 'help', 'notes', 'hint', 'verbose', 'brief', 'graphics', 'sound', 'music', 'typewriter', 'theme', 'again',
    'save', 'load', 'export', 'import', 'undo', 'restart', 'quit'];
  test('VERBS holds exactly the A6.1 engine verb ids, unique, in table order', () => {
    assert.deepEqual(VERBS.map((v) => v.id), ENGINE_IDS);
  });
  test('VERBS, PREPOSITIONS, ARTICLES and DIRECTION_WORDS are deeply frozen', () => {
    for (const c of [VERBS, VERBS[0], VERBS[0].words, PREPOSITIONS, PREPOSITIONS.from, ARTICLES, DIRECTION_WORDS]) {
      assert.ok(Object.isFrozen(c));
    }
  });
  test('verb classes: barriers are system, meta verbs are meta, again is special', () => {
    const byId = Object.fromEntries(VERBS.map((v) => [v.id, v]));
    for (const id of CHAIN_BARRIERS) assert.equal(byId[id].class, 'system', id);
    for (const id of META_VERBS) assert.equal(byId[id].class, 'meta', id);
    assert.equal(byId.again.class, 'special');
    assert.equal(byId.take.class, 'world');
    assert.equal(byId.yes.class, 'meta');
  });
  test('prefer / multi / notHere per A6.1', () => {
    const byId = Object.fromEntries(VERBS.map((v) => [v.id, v]));
    assert.deepEqual(['take', 'drop', 'put'].map((id) => byId[id].multi), [true, true, true]);
    assert.equal(byId.examine.multi, undefined);
    assert.equal(byId.take.prefer, 'notCarried');
    assert.equal(byId.remove.prefer, 'worn');
    assert.equal(byId.turn_off.prefer, 'lit');
    assert.equal(byId.accuse.notHere, 'Accuse who? They\'re not here.');
  });
  test('preposition canon and fillers per A6.1', () => {
    assert.deepEqual(PREPOSITIONS.from, ['from', 'off', 'out of']);
    assert.deepEqual(PREPOSITIONS.with, ['with', 'using']);
    assert.deepEqual([...ARTICLES], ['the', 'a', 'an', 'some', 'my', 'please']);
    assert.equal(DIRECTION_WORDS.outside, 'out');
  });
  test('every engine pattern compiles (none dropped)', () => {
    const v = buildVocab();
    assert.deepEqual(v.invalidPatterns, []);
  });
  test('buildVocab merges content nouns, adjectives, scenery, topics and settings words', () => {
    for (const word of ['brass', 'warrant', 'card', 'oak', 'counter', 'dead', 'girl', 'mr', 'maggie', 'spectrum', 'amber', 'first', 'of', 'around']) {
      assert.ok(isKnownWord(V, word), word);
    }
    assert.ok(isKnownWord(V, '123'));
    assert.ok(!isKnownWord(V, 'xyzzy'));
    assert.ok(!isKnownWord(buildVocab(), 'brass'));
  });
  test('content synonyms extend engine verbs', () => {
    expectParse('nick the key', { verb: 'take', verbWord: 'nick', dobj: w('key') });
    expectParse('nick key from box', { verb: 'take', verbWord: 'nick', dobj: w('key'), prep: 'from', iobj: w('box') });
  });
  test('a new content verb gets default patterns and class world', () => {
    expectParse('pray', { verb: 'pray', verbWord: 'pray' });
    expectParse('kneel at table', { error: 'no-pattern', verb: 'pray', verbWord: 'kneel' });
    expectParse('kneel table', { verb: 'pray', verbWord: 'kneel', dobj: w('table') });
    assert.equal(V.verbById.pray.class, 'world');
  });
  test('content patterns, optional literals and explicit classes', () => {
    const v = buildVocab({ verbs: [{ id: 'hum', words: ['hum'], patterns: ['<word> [quietly]', '<word> to {dobj}'], class: 'meta' }], items: { cat: { name: 'cat', names: ['cat'] } } });
    assert.deepEqual(parseCommand(tokenise('hum quietly'), v), { verb: 'hum', verbWord: 'hum quietly', raw: 'hum quietly' });
    assert.deepEqual(parseCommand(tokenise('hum'), v), { verb: 'hum', verbWord: 'hum', raw: 'hum' });
    assert.deepEqual(parseCommand(tokenise('hum to cat'), v), { verb: 'hum', verbWord: 'hum to', dobj: w('cat'), raw: 'hum to cat' });
    assert.equal(v.verbById.hum.class, 'meta');
  });
  test('engine-only parsing is unaffected by content vocab', () => {
    assert.deepEqual(parseCommand(['nick', 'key'], buildVocab()), { error: 'unknown-word', word: 'nick', raw: 'nick key' });
  });
  test('buildVocab never throws on malformed content and drops bad patterns', () => {
    const bad = [null, 42, 'x', { items: null }, { items: { a: null, b: { names: 'key' } } }, { verbs: 'nope' },
      { verbs: [null, { id: 7 }, { id: 'zap', words: [3, 'zap'], patterns: ['{bogus}', 7, '<word> {dobj}'] }] },
      { rooms: { r: { scenery: [null, { names: [null] }] } } }, { topics: { t: null } }];
    for (const c of bad) assert.doesNotThrow(() => buildVocab(c), JSON.stringify(c));
    const v = buildVocab(bad[6]);
    assert.ok(v.invalidPatterns.length >= 1);
    assert.deepEqual(parseCommand(['zap', 'zap'], v), { verb: 'zap', verbWord: 'zap', dobj: w('zap'), raw: 'zap zap' });
  });
});

/* ------------------------------------------------------------------ *
 *  Never throws (P5, acceptance 2) — property-style                   *
 * ------------------------------------------------------------------ */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('never throws', () => {
  const pool = [...V.words, '.', ',', 'and', 'then', 'xyzzy', '', ' ', '9', 'ÄÖ', '£', '<word>', '{dobj}', '[x]', 'a|b'];
  test('random token soup from the vocabulary (3000 cases) always yields a well-formed result', () => {
    const rnd = mulberry32(5);
    for (let n = 0; n < 3000; n++) {
      const len = Math.floor(rnd() * 12);
      const toks = Array.from({ length: len }, () => pool[Math.floor(rnd() * pool.length)]);
      let segs;
      assert.doesNotThrow(() => { segs = splitChain(toks, V); }, JSON.stringify(toks));
      for (const s of segs) {
        let res;
        assert.doesNotThrow(() => { res = parseCommand(s, V); }, JSON.stringify(s));
        assertShape(res);
      }
      assertShape(parseCommand(toks, V));
    }
  });
  test('random character strings through the whole syntax pipeline', () => {
    const rnd = mulberry32(11);
    const chars = 'abcdefghijklmnopqrstuvwxyz      .,;!?\'"-–—…‘’“”£$%&*()[]{}<>|\\/\t\n ​é漢🙂0123456789';
    for (let n = 0; n < 2000; n++) {
      const len = Math.floor(rnd() * 80);
      let line = '';
      for (let i = 0; i < len; i++) line += chars[Math.floor(rnd() * chars.length)];
      const toks = tokenise(line);
      for (const t of toks) assert.match(t, /^([a-z0-9]+|[.,])$/, JSON.stringify(line));
      for (const s of splitChain(toks, V)) assertShape(parseCommand(s, V));
    }
  });
  test('very long input is bounded', () => {
    const long = 'take the brass key and the iron key and '.repeat(500);
    const toks = tokenise(long);
    assert.ok(toks.join(' ').length <= LIMITS.inputLength);
    assertShape(parseCommand(toks, V));
    const huge = Array.from({ length: 5000 }, (_, i) => (i % 3 ? 'key' : 'and'));
    huge.unshift('give');
    assertShape(parseCommand(huge, V));
  });
  test('garbage arguments', () => {
    for (const g of [null, undefined, 42, {}, [null], [{}], [[]], [Symbol('s')], [{ toString() { throw new Error('x'); } }]]) {
      assert.doesNotThrow(() => assertShape(parseCommand(g, V)), String(typeof g));
      assert.doesNotThrow(() => parseCommand(['take', 'key'], g));
    }
  });
});
