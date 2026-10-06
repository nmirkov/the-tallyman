// TT-022 — Fuzz suite (PLAN §4 "Fuzz"): 20 seeds x 2 000 random commands built from the
// engine vocabulary plus every content noun, on the real content, in strict mode (so any
// internal error throws, A2 G3 / A7.9). After every input:
//   - the engine did not throw, and returned well-formed events (A9: known types, a
//     terminal event only last, game text inside the A12.2 glyph policy);
//   - the state passes validateSave and survives a JSON round trip (A3, A11);
//   - the save stays under LIMITS.saveBytes;
//   - UNDO is one level only: right after a successful UNDO a second one is refused and
//     changes nothing (A7.8 U1/U3 - the snapshot is bounded to one state);
//   - STORY §13 / PLAN §2.5 resource invariants hold: no critical item is ever destroyed
//     (only the designed consumptions: batteries into the torch, whisky to Silas), and
//     until Silas has his whisky the balance never drops below its price.
// A host emulator answers SAVE / LOAD / EXPORT / IMPORT like the terminal player does.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import content from '../../src/content/index.js';
import { createGame } from '../../src/engine/game.js';
import { validateSave } from '../../src/engine/state.js';
import { VERBS, DIRECTION_WORDS, PREPOSITIONS, ARTICLES, ALL_WORDS, PRONOUN_WORDS } from '../../src/engine/vocab.js';
import { EVENT_TYPES, TERMINAL_EVENT_TYPES, LIMITS } from '../../src/engine/types.js';
import { cloneContent } from '../fixtures/harness.js';
import { readFileSync } from 'node:fs';

const SEEDS = 20;
const COMMANDS = 2000;

const STORY = readFileSync(new URL('../../docs/STORY.md', import.meta.url), 'utf8');
const WALKTHROUGH = STORY.split('Plain list for `tests/walkthrough/` (91 lines):\n```\n')[1].split('```')[0].trim().split('\n');

/* ------------------------------------------------------------------------ *
 *  Word pools                                                               *
 * ------------------------------------------------------------------------ */

const uniq = (xs) => [...new Set(xs.filter((x) => typeof x === 'string' && x.length > 0))];
const engineVerbWords = VERBS.flatMap((v) => v.words);
const contentVerbWords = (content.verbs ?? []).flatMap((v) => v.words ?? []);
const VERB_WORDS = uniq([...engineVerbWords, ...contentVerbWords]);
const NOUNS = uniq([
  ...Object.values(content.items).flatMap((i) => [i.name, ...(i.names ?? []), ...(i.adjectives ?? []).map((a) => `${a} ${(i.names ?? [i.name])[0]}`)]),
  ...Object.values(content.npcs).flatMap((n) => [n.name, ...(n.names ?? [])]),
  ...Object.values(content.rooms).flatMap((r) => (r.scenery ?? []).flatMap((sc) => sc.names ?? [])),
]);
const TOPICS = uniq(Object.values(content.topics).flatMap((t) => t.names ?? []));
const NPC_WORDS = uniq(Object.values(content.npcs).flatMap((n) => n.names ?? []));
const DIRS = Object.keys(DIRECTION_WORDS);
const PREPS = uniq(Object.values(PREPOSITIONS).flat());
const JUNK = ['xyzzy', 'plugh', 'frobozz', '', ' ', '...', '?', '!', ',', 'and', 'then', '.', '42', '0', '4', 'four', 'second', '£', 'é', '"', "'", 'the the', 'it', 'them', 'him', 'her', 'all', 'except', 'but'];

/** mulberry32: the fuzzer's own deterministic PRNG (separate from the game's). */
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random command line. */
function generator(rand) {
  const pick = (xs) => xs[Math.floor(rand() * xs.length)];
  const noun = () => (rand() < 0.15 ? `${pick(ARTICLES)} ${pick(NOUNS)}` : pick(NOUNS));
  const simple = () => {
    const r = rand();
    if (r < 0.22) return pick(DIRS);
    if (r < 0.32) return pick(WALKTHROUGH);
    if (r < 0.40) return pick(VERB_WORDS);
    if (r < 0.62) return `${pick(VERB_WORDS)} ${noun()}`;
    if (r < 0.72) return `${pick(VERB_WORDS)} ${noun()} ${pick(PREPS)} ${noun()}`;
    if (r < 0.78) return `${pick(['ask', 'tell'])} ${pick(NPC_WORDS)} about ${pick([...TOPICS, ...NOUNS])}`;
    if (r < 0.82) return `${pick(['give', 'show', 'offer'])} ${noun()} to ${pick(NPC_WORDS)}`;
    if (r < 0.85) return `${pick(VERB_WORDS)} ${pick(ALL_WORDS)}${rand() < 0.5 ? ` except ${noun()}` : ''}`;
    if (r < 0.87) return `${pick(VERB_WORDS)} ${pick(PRONOUN_WORDS)}`;
    if (r < 0.89) return `${pick(VERB_WORDS)} ${noun()} and ${noun()}`;
    if (r < 0.91) return pick(['yes', 'y', 'no', 'again', 'g', 'undo', 'hint', 'notes', 'score', 'inventory', 'time', 'look', 'wait', 'z']);
    if (r < 0.93) return `${pick(['save', 'load', 'restore'])} ${pick(['1', '2', '3', '4', '', 'x'])}`.trim();
    if (r < 0.94) return pick(['restart', 'quit', 'export', 'import', 'verbose', 'brief', 'graphics off', 'graphics on', 'theme amber', 'sound off', 'music on', 'typewriter off']);
    if (r < 0.98) return Array.from({ length: 1 + Math.floor(rand() * 4) }, () => pick([...JUNK, ...VERB_WORDS, ...NOUNS, ...PREPS])).join(' ');
    return pick(VERB_WORDS).repeat(1 + Math.floor(rand() * 30)); // overlong
  };
  return () => {
    const r = rand();
    if (r < 0.08) return Array.from({ length: 2 + Math.floor(rand() * 3) }, simple).join(pick([' then ', '. ', ', then ', ' and then ']));
    if (r < 0.09) return Array.from({ length: 20 }, () => pick(DIRS)).join('. '); // over the chain limit
    if (r < 0.095) return null; // A2: non-strings are coerced
    return simple();
  };
}

/* ------------------------------------------------------------------------ *
 *  Checks                                                                   *
 * ------------------------------------------------------------------------ */

const ALLOWED_TEXT = /^[\x20-\x7E\n£]*$/;
const CRITICAL = Object.entries(content.items).filter(([, i]) => i.critical).map(([id]) => id);

function checkEvents(events, where) {
  assert.ok(Array.isArray(events), `${where}: events array`);
  events.forEach((e, i) => {
    assert.ok(EVENT_TYPES.includes(e.type), `${where}: unknown event type ${e.type}`);
    if (TERMINAL_EVENT_TYPES.includes(e.type) && !(e.type === 'end' && events[i + 1]?.type === 'storage')) {
      assert.equal(i, events.length - 1, `${where}: terminal ${e.type} is not last`);
    }
    for (const key of ['text', 'title']) {
      if (e[key] === undefined) continue;
      assert.equal(typeof e[key], 'string', `${where}: ${e.type}.${key}`);
      assert.match(e[key], ALLOWED_TEXT, `${where}: glyph policy in ${JSON.stringify(e[key]).slice(0, 80)}`);
      assert.doesNotMatch(e[key], /undefined|\[object Object\]|NaN/, `${where}: ${e[key].slice(0, 80)}`);
    }
  });
}

/** STORY §13 resource invariants on one state. */
function checkInvariants(s, where) {
  for (const id of CRITICAL) {
    if (s.items[id].loc !== null) continue;
    if (id === 'batteries') assert.ok(!s.flags.got_batteries || s.flags.torch_loaded, `${where}: batteries lost before loading`);
    else if (id === 'room_key') assert.ok(!s.flags.maggie_saw_card, `${where}: room key lost`);
    else if (id === 'whisky') assert.ok(!s.flags.silas_told, `${where}: whisky null after Silas had it`);
    else assert.fail(`${where}: critical item ${id} destroyed`);
  }
  if (!s.flags.silas_told && s.items.whisky.loc === null) {
    assert.ok(s.money >= 200, `${where}: money ${s.money} < 200 before the whisky`);
  }
  for (const id of ['warrant_card', 'wallet']) assert.equal(s.items[id].loc, 'player', `${where}: ${id}`);
}

/* ------------------------------------------------------------------------ *
 *  The run                                                                  *
 * ------------------------------------------------------------------------ */

/**
 * Fuzzes one seed: the game seed, the generator seed and a walkthrough prefix (so later
 * seeds start deeper in the story - the mill, the asylum, the Counting Room) all derive
 * from it. Returns counters for the report line.
 */
function fuzz(seed) {
  const rand = prng(seed * 7919);
  const next = generator(rand);
  const g = createGame({ content: cloneContent(content), seed, strict: true });
  const slots = new Map();
  let exported = null;
  const stats = { inputs: 0, ended: 0, undos: 0, loads: 0, maxTurn: 0, rooms: new Set(), maxSave: 0 };

  const host = (events, where) => {
    const req = events.at(-1);
    if (!req) return;
    if (req.type === 'storage' && req.op === 'save') slots.set(req.slot, req.data);
    if (req.type === 'storage' && req.op === 'load' && slots.has(req.slot)) {
      const r = g.load(JSON.stringify(slots.get(req.slot)));
      assert.ok(r.ok, `${where}: own save rejected: ${r.error}`);
      checkEvents(r.events, `${where} (load)`);
      stats.loads++;
    }
    if (req.type === 'host' && req.op === 'export') exported = req.data;
    if (req.type === 'host' && req.op === 'import' && exported) {
      const r = g.load(exported);
      assert.ok(r.ok, `${where}: own export rejected: ${r.error}`);
      stats.loads++;
    }
  };

  checkEvents(g.start(), `seed ${seed} start`);
  // seeds 1-17 spread over #0-#83; the last three start in the tunnel (#88), the Counting Room
  // with the counter running (#89) and with Pike cuffed (#90)
  const prefix = seed <= SEEDS - 3 ? Math.floor(((seed - 1) * 88) / (SEEDS - 3)) : 88 + (seed - (SEEDS - 2));
  for (const line of WALKTHROUGH.slice(0, prefix)) g.input(line);

  for (let i = 0; i < COMMANDS; i++) {
    let line;
    if (g.snapshot().ended !== null) {
      stats.ended++;
      const r = rand();
      line = r < 0.5 ? 'undo' : r < 0.8 ? 'restart' : next();
    } else line = next();
    const where = `seed ${seed} #${i} ${JSON.stringify(line)}`;
    const events = g.input(line); // strict: an internal error throws here and fails the test
    stats.inputs++;
    checkEvents(events, where);
    host(events, where);

    const s = g.snapshot();
    assert.deepEqual(JSON.parse(JSON.stringify(s)), s, `${where}: state is plain JSON`);
    const save = g.save();
    const v = validateSave(save, content);
    assert.ok(v.ok, `${where}: ${v.error}`);
    const bytes = JSON.stringify(save).length;
    assert.ok(bytes <= LIMITS.saveBytes, `${where}: save ${bytes} bytes`);
    stats.maxSave = Math.max(stats.maxSave, bytes);
    checkInvariants(s, where);
    stats.maxTurn = Math.max(stats.maxTurn, s.turn);
    stats.rooms.add(s.roomId);

    if (events.some((e) => e.type === 'text' && e.text === '(Undone.)')) {
      stats.undos++;
      const before = g.snapshot();
      const again = g.undo();
      assert.deepEqual(again.filter((e) => e.type === 'text').map((e) => e.text), ["You can't undo any further."], `${where}: UNDO is one level`);
      assert.deepEqual(g.snapshot(), before, `${where}: a refused UNDO changes nothing`);
    }
  }
  return stats;
}

describe(`fuzz: ${SEEDS} seeds x ${COMMANDS} random commands on the real content (strict)`, () => {
  const totals = { rooms: new Set(), endings: 0, inputs: 0 };
  for (let seed = 1; seed <= SEEDS; seed++) {
    test(`seed ${seed}`, () => {
      const st = fuzz(seed);
      assert.equal(st.inputs, COMMANDS);
      for (const r of st.rooms) totals.rooms.add(r);
      totals.inputs += st.inputs;
      totals.endings += st.ended;
    });
  }

  test('coverage: the fuzzer reached a good part of the map', () => {
    assert.equal(totals.inputs, SEEDS * COMMANDS);
    assert.ok(totals.rooms.size >= 38, `rooms visited: ${totals.rooms.size} of 42`);
    for (const r of ['tunnel', 'counting_room', 'boiler_room', 'counting_house']) assert.ok(totals.rooms.has(r), r);
  });
});
