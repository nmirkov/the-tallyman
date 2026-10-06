// The Tallyman — engine vocabulary (TT-005, ARCHITECTURE A6.1).
// Static word tables plus buildVocab(content), which merges content nouns, adjectives,
// topic keywords and content verbs and compiles every grammar pattern for parser.js.

import { DIRECTIONS, HOST_SETTINGS } from './types.js';

/** @template T @param {T} o @returns {Readonly<T>} */
function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

/**
 * Engine verb table, in A6.1 table order. Patterns use the A6.1 mini-language; `<word>`
 * stands for any of the verb's own words (A4.15). Literals that are canonical
 * preposition ids (`in`, `from`, …) match every surface form of that preposition.
 * @type {ReadonlyArray<import('./types.js').VerbDef & {class: string}>}
 */
export const VERBS = deepFreeze([
  { id: 'go', class: 'world', words: ['go', 'walk', 'run', 'head'], patterns: ['{dir}', '<word> {dir}'] },
  { id: 'back', class: 'world', words: ['back', 'go back', 'return'], patterns: ['<word>'] },
  { id: 'enter', class: 'world', words: ['enter', 'go in', 'go into', 'get in', 'get into'], patterns: ['<word>', '<word> {dobj}'] },
  { id: 'exit', class: 'world', words: ['exit', 'leave', 'get out', 'go out'], patterns: ['<word>', '<word> [of] {dobj}'] },
  {
    id: 'climb', class: 'world', words: ['climb', 'scale', 'clamber'],
    patterns: ['<word> {dir:u|d} {dobj}', '<word> {dir:u|d}', '<word> {dobj}'],
  },
  { id: 'look', class: 'world', words: ['look', 'l'], patterns: ['<word>', '<word> around'] },
  {
    id: 'examine', class: 'world', words: ['examine', 'x', 'look at', 'inspect', 'check', 'describe', 'study'],
    patterns: ['<word> {dobj}'],
  },
  {
    id: 'search', class: 'world', words: ['search', 'rummage', 'look in', 'look under', 'look behind'],
    // SEARCH ROOM / SEARCH AROUND are bare SEARCH (A8.6); two literals outrank `{dobj}`.
    patterns: ['<word>', 'search|rummage around|room', '<word> {dobj}', 'look in|under|behind {dobj}'],
  },
  { id: 'read', class: 'world', words: ['read'], patterns: ['<word> {dobj}'] },
  { id: 'listen', class: 'world', words: ['listen', 'hear'], patterns: ['<word>', '<word> to {dobj}'] },
  { id: 'smell', class: 'world', words: ['smell', 'sniff'], patterns: ['<word>', '<word> {dobj}'] },
  {
    id: 'take', class: 'world', words: ['take', 'get', 'pick up', 'grab', 'carry'],
    patterns: ['<word> {dobj}', '<word> {dobj} from {iobj}', 'pick {dobj} up'], prefer: 'notCarried', multi: true,
  },
  {
    id: 'drop', class: 'world', words: ['drop', 'put down', 'discard'],
    patterns: ['<word> {dobj}', 'put {dobj} down'], prefer: 'carried', multi: true,
  },
  {
    id: 'put', class: 'world', words: ['put', 'place', 'insert', 'stick'],
    patterns: ['<word> {dobj} in {iobj}', '<word> {dobj} on {iobj}'], prefer: 'carried', multi: true,
  },
  { id: 'open', class: 'world', words: ['open'], patterns: ['<word> {dobj}'], prefer: 'closed' },
  { id: 'close', class: 'world', words: ['close', 'shut'], patterns: ['<word> {dobj}'], prefer: 'open' },
  { id: 'unlock', class: 'world', words: ['unlock'], patterns: ['<word> {dobj}', '<word> {dobj} with {iobj}'] },
  { id: 'lock', class: 'world', words: ['lock'], patterns: ['<word> {dobj}', '<word> {dobj} with {iobj}'] },
  { id: 'push', class: 'world', words: ['push', 'press', 'shove'], patterns: ['<word> {dobj}'] },
  { id: 'pull', class: 'world', words: ['pull', 'tug', 'yank'], patterns: ['<word> {dobj}'] },
  { id: 'move', class: 'world', words: ['move', 'slide', 'shift'], patterns: ['<word> {dobj}'] },
  {
    id: 'turn_on', class: 'world', words: ['turn on', 'switch on', 'light', 'ignite'],
    patterns: ['<word> {dobj}', 'turn|switch {dobj} on'], prefer: 'unlit',
  },
  {
    id: 'turn_off', class: 'world', words: ['turn off', 'switch off', 'extinguish'],
    patterns: ['<word> {dobj}', 'turn|switch {dobj} off'], prefer: 'lit',
  },
  { id: 'wear', class: 'world', words: ['wear', 'don', 'put on'], patterns: ['<word> {dobj}', 'put {dobj} on'], prefer: 'carried' },
  { id: 'remove', class: 'world', words: ['remove', 'take off', 'doff'], patterns: ['<word> {dobj}', 'take {dobj} off'], prefer: 'worn' },
  { id: 'eat', class: 'world', words: ['eat', 'devour'], patterns: ['<word> {dobj}'], prefer: 'carried' },
  { id: 'drink', class: 'world', words: ['drink', 'sip', 'swig', 'quaff'], patterns: ['<word> {dobj}'], prefer: 'carried' },
  {
    id: 'throw', class: 'world', words: ['throw', 'toss', 'hurl', 'chuck'],
    patterns: ['<word> {dobj}', '<word> {dobj} at|in|over {iobj}'], prefer: 'carried',
  },
  { id: 'break', class: 'world', words: ['break', 'smash', 'destroy', 'burn'], patterns: ['<word> {dobj}', '<word> {dobj} with {iobj}'] },
  { id: 'tear', class: 'world', words: ['tear', 'rip'], patterns: ['<word> {dobj}', '<word> {dobj} from {iobj}'] },
  { id: 'cut', class: 'world', words: ['cut', 'snip', 'sever'], patterns: ['<word> {dobj}', '<word> {dobj} with {iobj}'] },
  { id: 'oil', class: 'world', words: ['oil', 'lubricate', 'grease'], patterns: ['<word> {dobj}', '<word> {dobj} with {iobj}'] },
  { id: 'use', class: 'world', words: ['use'], patterns: ['<word> {dobj}', '<word> {dobj} on|with {iobj}'] },
  { id: 'touch', class: 'world', words: ['touch', 'rub', 'feel'], patterns: ['<word> {dobj}'] },
  {
    id: 'attack', class: 'world', words: ['attack', 'hit', 'kick', 'punch', 'fight', 'kill', 'strike'],
    patterns: ['<word> {dobj}', '<word> {dobj} with {iobj}'],
  },
  { id: 'talk', class: 'world', words: ['talk to', 'speak to', 'chat to', 'chat with'], patterns: ['<word> {dobj}'] },
  { id: 'ask', class: 'world', words: ['ask', 'question'], patterns: ['<word> {dobj} about {topic}'] },
  { id: 'tell', class: 'world', words: ['tell', 'inform'], patterns: ['<word> {dobj} about {topic}'] },
  { id: 'show', class: 'world', words: ['show', 'present'], patterns: ['<word> {dobj} to {iobj}', '<word> {iobj} {dobj}'], prefer: 'carried' },
  { id: 'give', class: 'world', words: ['give', 'hand', 'offer'], patterns: ['<word> {dobj} to {iobj}', '<word> {iobj} {dobj}'], prefer: 'carried' },
  { id: 'buy', class: 'world', words: ['buy', 'purchase', 'order'], patterns: ['<word> {dobj}', '<word> {dobj} from {iobj}'] },
  { id: 'call', class: 'world', words: ['call', 'phone', 'dial', 'ring'], patterns: ['<word>', '<word> {dobj}'] },
  { id: 'accuse', class: 'world', words: ['accuse', 'charge'], patterns: ['<word> {dobj}'], notHere: 'Accuse who? They\'re not here.' },
  {
    id: 'arrest', class: 'world', words: ['arrest', 'cuff', 'handcuff', 'restrain'],
    patterns: ['<word> {dobj}', '<word> {dobj} with {iobj}'],
  },
  { id: 'free', class: 'world', words: ['free', 'release', 'unchain', 'rescue'], patterns: ['<word> {dobj}'] },
  { id: 'swim', class: 'world', words: ['swim', 'dive', 'wade'], patterns: ['<word>', '<word> in {dobj}'] },
  { id: 'jump', class: 'world', words: ['jump', 'leap'], patterns: ['<word>', '<word> off|in|over {dobj}'] },
  { id: 'wait', class: 'world', words: ['wait', 'z'], patterns: ['<word>'] },
  { id: 'yes', class: 'meta', words: ['yes', 'y'], patterns: ['<word>'] },
  { id: 'no', class: 'meta', words: ['no'], patterns: ['<word>'] },
  { id: 'inventory', class: 'meta', words: ['inventory', 'i', 'inv'], patterns: ['<word>'] },
  { id: 'score', class: 'meta', words: ['score'], patterns: ['<word>'] },
  { id: 'time', class: 'meta', words: ['time'], patterns: ['<word>'] },
  { id: 'help', class: 'meta', words: ['help'], patterns: ['<word>'] },
  { id: 'notes', class: 'meta', words: ['notes', 'notebook', 'clues', 'case'], patterns: ['<word>'] },
  { id: 'hint', class: 'meta', words: ['hint', 'hints'], patterns: ['<word>'] },
  { id: 'verbose', class: 'meta', words: ['verbose'], patterns: ['<word>'] },
  { id: 'brief', class: 'meta', words: ['brief'], patterns: ['<word>'] },
  { id: 'graphics', class: 'meta', words: ['graphics'], patterns: ['<word>', '<word> {arg}'] },
  { id: 'sound', class: 'meta', words: ['sound'], patterns: ['<word>', '<word> {arg}'] },
  { id: 'music', class: 'meta', words: ['music'], patterns: ['<word>', '<word> {arg}'] },
  { id: 'typewriter', class: 'meta', words: ['typewriter'], patterns: ['<word>', '<word> {arg}'] },
  { id: 'theme', class: 'meta', words: ['theme'], patterns: ['<word>', '<word> {arg}'] },
  { id: 'again', class: 'special', words: ['again', 'g'], patterns: ['<word>'] },
  { id: 'save', class: 'system', words: ['save'], patterns: ['<word>', '<word> {arg}'] },
  { id: 'load', class: 'system', words: ['load', 'restore'], patterns: ['<word>', '<word> {arg}'] },
  { id: 'export', class: 'system', words: ['export'], patterns: ['<word>'] },
  { id: 'import', class: 'system', words: ['import'], patterns: ['<word>'] },
  { id: 'undo', class: 'system', words: ['undo'], patterns: ['<word>'] },
  { id: 'restart', class: 'system', words: ['restart'], patterns: ['<word>'] },
  { id: 'quit', class: 'system', words: ['quit', 'q'], patterns: ['<word>'] },
]);

/** Direction words → canonical `Dir` (A6.1). */
export const DIRECTION_WORDS = deepFreeze({
  n: 'n', north: 'n', ne: 'ne', northeast: 'ne', e: 'e', east: 'e', se: 'se', southeast: 'se',
  s: 's', south: 's', sw: 'sw', southwest: 'sw', w: 'w', west: 'w', nw: 'nw', northwest: 'nw',
  u: 'u', up: 'u', d: 'd', down: 'd', in: 'in', inside: 'in', out: 'out', outside: 'out',
});

/** Canonical preposition id → surface words (may be multiword) (A6.1). */
export const PREPOSITIONS = deepFreeze({
  in: ['in', 'into', 'inside'],
  on: ['on', 'onto', 'upon'],
  with: ['with', 'using'],
  from: ['from', 'off', 'out of'],
  to: ['to'],
  at: ['at'],
  about: ['about'],
  under: ['under', 'beneath', 'below'],
  behind: ['behind'],
});

/** Fillers dropped everywhere outside topics (A6.1). */
export const ARTICLES = deepFreeze(['the', 'a', 'an', 'some', 'my', 'please']);
/** Pronoun words (A6.4). */
export const PRONOUN_WORDS = deepFreeze(['it', 'them', 'him', 'her']);
/** Self-reference words (TT-009): a noun phrase of only these binds to the player. */
export const SELF_WORDS = deepFreeze(['me', 'myself', 'self', 'yourself']);
/** Quantifier words (A6.5). */
export const ALL_WORDS = deepFreeze(['all', 'everything']);
export const EXCEPT_WORDS = deepFreeze(['except', 'but']);
/** Words that join list elements inside one noun phrase (A6.2 P4). */
export const LIST_WORDS = deepFreeze(['and', ',']);
/** Chain separators that always split (A6.2 P2). */
export const CHAIN_WORDS = deepFreeze(['then']);
/** Ordinals for disambiguation answers (A6.7); `last` is -1. Known words so they never trip unknown-word. */
export const ORDINALS = deepFreeze({
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, last: -1,
});

const SLOT_NAMES = ['dobj', 'iobj', 'topic', 'dir', 'arg'];
const NOUN_SLOTS = ['dobj', 'iobj'];

/**
 * @typedef {{toks: string[], prep: string|null}} LitAlt
 * @typedef {{t: 'lit', alts: LitAlt[], opt: boolean, role?: 'verb'|'prep'}
 *   | {t: 'slot', name: string, dirs?: string[]}} PatternEl
 * @typedef {{verb: string, rank: number, els: PatternEl[], lits: number}} CompiledPattern
 * @typedef {{els: PatternEl[], verb: string, exact: boolean, rank: number}} VerbHead
 * @typedef {Object} Vocab  Output of buildVocab; read-only, not part of state.
 * @property {Array<import('./types.js').VerbDef & {class: string, words: string[], patterns: string[]}>} verbs
 * @property {Record<string, import('./types.js').VerbDef & {class: string}>} verbById
 * @property {Set<string>} words           Every known word (A6.1); numbers are known implicitly.
 * @property {CompiledPattern[]} patterns  Sorted: most literal tokens first, then table order.
 * @property {Map<string, CompiledPattern[]>} byHead  Patterns indexed by their first token.
 * @property {CompiledPattern[]} unheaded  Patterns that start with a slot or optional literal.
 * @property {VerbHead[]} heads            Verb heads for error attribution, longest first.
 * @property {Set<string>} startWords      First words that start a command (P2).
 * @property {Map<string, string[][]>} nounStarts  Start word → multiword entity names beginning with it
 *   (`oil` → [['oil', 'can']]); splitChain keeps such a name inside a noun list (TT-016).
 * @property {Map<string, string>} prepWords  Single surface word → canonical preposition.
 * @property {Map<string, string[][]>} prepStarts  First word → multiword prepositions starting with it.
 * @property {Array<{verb: string, pattern: unknown}>} invalidPatterns  Content patterns that were dropped.
 */

/** @param {unknown} v @returns {string[]} */
function strings(v) {
  return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
}

/** Lower-case word tokens of a content string (letters/digits only, like tokenise). */
function wordsOf(s) {
  return String(s).toLowerCase().replace(/'s\b/g, '').replace(/'/g, '').replace(/[^a-z0-9]+/g, ' ')
    .split(' ').filter(Boolean);
}

/** Alternatives for one literal word: a canonical preposition id expands to its surface forms. */
function litAlts(word) {
  if (Object.hasOwn(PREPOSITIONS, word)) {
    return PREPOSITIONS[word].map((s) => ({ toks: s.split(' '), prep: word }));
  }
  return [{ toks: [word], prep: null }];
}

/**
 * Compile one pattern string for one verb word (`word` replaces `<word>`).
 * @returns {PatternEl[]|null} null when the pattern is malformed.
 */
function compilePattern(pattern, word) {
  if (typeof pattern !== 'string') return null;
  const parts = pattern.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  /** @type {PatternEl[]} */
  const els = [];
  for (const part of parts) {
    if (part === '<word>') {
      if (!word) return null;
      for (const tok of word.split(' ')) els.push({ t: 'lit', alts: litAlts(tok), opt: false });
      continue;
    }
    const slot = /^\{([a-z]+)(?::([a-z|]+))?\}$/.exec(part);
    if (slot) {
      if (!SLOT_NAMES.includes(slot[1])) return null;
      if (slot[2] && slot[1] !== 'dir') return null;
      const el = { t: 'slot', name: slot[1] };
      if (slot[2]) {
        const dirs = slot[2].split('|');
        if (!dirs.every((d) => DIRECTIONS.includes(d))) return null;
        el.dirs = dirs;
      }
      els.push(el);
      continue;
    }
    const opt = /^\[(.+)\]$/.exec(part);
    const body = opt ? opt[1] : part;
    const words = body.split('|');
    if (!words.every((x) => /^[a-z0-9]+$/.test(x))) return null;
    els.push({ t: 'lit', alts: words.flatMap(litAlts), opt: Boolean(opt) });
  }
  // {topic} must be last; slots of the same name at most once.
  const names = els.filter((e) => e.t === 'slot').map((e) => e.name);
  if (new Set(names).size !== names.length) return null;
  if (names.includes('topic') && (els[els.length - 1].t !== 'slot' || els[els.length - 1].name !== 'topic')) return null;
  // Role of each literal: a preposition sits between a noun slot and a noun/topic slot; anything else is
  // part of the verb word ('pick … up', 'look under …', 'listen to …').
  for (let i = 0; i < els.length; i++) {
    const el = els[i];
    if (el.t !== 'lit') continue;
    const prev = els[i - 1];
    const next = els[i + 1];
    const afterNoun = prev && prev.t === 'slot' && NOUN_SLOTS.includes(prev.name);
    const beforeNoun = next && next.t === 'slot' && (NOUN_SLOTS.includes(next.name) || next.name === 'topic');
    el.role = afterNoun && beforeNoun ? 'prep' : 'verb';
  }
  return els;
}

/** Merge engine verbs with `content.verbs` (A4.15). */
function mergeVerbs(content) {
  const verbs = VERBS.map((v) => ({ ...v, words: [...v.words], patterns: [...v.patterns] }));
  const byId = Object.fromEntries(verbs.map((v) => [v.id, v]));
  const extra = content && Array.isArray(content.verbs) ? content.verbs : [];
  for (const def of extra) {
    if (!def || typeof def !== 'object' || typeof def.id !== 'string' || !def.id) continue;
    const words = strings(def.words).map((s) => wordsOf(s).join(' ')).filter(Boolean);
    const patterns = Array.isArray(def.patterns) ? [...def.patterns] : null;
    const existing = byId[def.id];
    if (existing) {
      for (const wd of words) if (!existing.words.includes(wd)) existing.words.push(wd);
      if (patterns) existing.patterns.push(...patterns);
      for (const k of ['prefer', 'multi', 'notHere', 'default']) if (def[k] !== undefined) existing[k] = def[k];
      continue;
    }
    const v = {
      ...def,
      class: ['world', 'meta', 'system'].includes(def.class) ? def.class : 'world',
      words: words.length ? words : [wordsOf(def.id).join(' ')].filter(Boolean),
      patterns: patterns ?? ['<word>', '<word> {dobj}'],
    };
    verbs.push(v);
    byId[v.id] = v;
  }
  return { verbs, byId };
}

/**
 * Build the merged vocabulary (A6.1): engine verbs + content verbs, content nouns /
 * adjectives / topic keywords, prepositions, fillers, directions, quantifiers, ordinals
 * and host-setting values. Never throws on malformed content (lint reports it).
 * @param {import('./types.js').ContentBundle} [content]
 * @returns {Vocab}
 */
export function buildVocab(content) {
  const c = content && typeof content === 'object' ? content : {};
  const { verbs, byId } = mergeVerbs(c);
  const words = new Set();
  const add = (s) => { if (typeof s === 'string') for (const wd of wordsOf(s)) words.add(wd); };

  for (const list of [Object.keys(DIRECTION_WORDS), ARTICLES, PRONOUN_WORDS, SELF_WORDS, ALL_WORDS, EXCEPT_WORDS,
    CHAIN_WORDS, Object.keys(ORDINALS), ['and', 'one'], ...Object.values(PREPOSITIONS), ...Object.values(HOST_SETTINGS)]) {
    for (const s of list) add(s);
  }
  const entities = (table) => (table && typeof table === 'object' ? Object.values(table) : []);
  for (const e of [...entities(c.items), ...entities(c.npcs)]) {
    if (!e || typeof e !== 'object') continue;
    add(e.name);
    for (const s of [...strings(e.names), ...strings(e.adjectives)]) add(s);
  }
  for (const room of entities(c.rooms)) {
    const scenery = room && Array.isArray(room.scenery) ? room.scenery : [];
    for (const sc of scenery) {
      if (sc && typeof sc === 'object') for (const s of [...strings(sc.names), ...strings(sc.adjectives)]) add(s);
    }
  }
  for (const t of entities(c.topics)) if (t && typeof t === 'object') for (const s of strings(t.names)) add(s);

  /** @type {CompiledPattern[]} */
  const patterns = [];
  /** @type {VerbHead[]} */
  const heads = [];
  const invalidPatterns = [];
  let rank = 0;
  verbs.forEach((verb, vi) => {
    for (const wd of verb.words) {
      add(wd);
      const els = compilePattern('<word>', wd);
      if (els) heads.push({ els, verb: verb.id, exact: true, rank: vi });
      if (els && els.length > 1) heads.push({ els: [els[0]], verb: verb.id, exact: false, rank: vi });
    }
    for (const p of verb.patterns) {
      const variants = typeof p === 'string' && p.includes('<word>') ? verb.words : [null];
      let ok = variants.length > 0;
      for (const wd of variants) {
        const els = compilePattern(p, wd);
        if (!els) { ok = false; continue; }
        for (const el of els) if (el.t === 'lit') for (const a of el.alts) for (const tok of a.toks) words.add(tok);
        const lits = els.filter((e) => e.t === 'lit' && !e.opt).length;
        patterns.push({ verb: verb.id, rank: rank++, els, lits });
        if (els[0].t === 'lit' && !els[0].opt && !(typeof p === 'string' && p.startsWith('<word>'))) {
          heads.push({ els: [els[0]], verb: verb.id, exact: false, rank: vi });
        }
      }
      if (!ok) invalidPatterns.push({ verb: verb.id, pattern: p });
    }
  });
  for (const dw of Object.keys(DIRECTION_WORDS)) {
    heads.push({ els: [{ t: 'lit', alts: [{ toks: [dw], prep: null }], opt: false, role: 'verb' }], verb: 'go', exact: true, rank: 0 });
  }

  patterns.sort((a, b) => b.lits - a.lits || a.rank - b.rank);
  const byHead = new Map();
  const unheaded = [];
  for (const p of patterns) {
    const first = p.els[0];
    if (first.t !== 'lit' || first.opt) { unheaded.push(p); continue; }
    for (const t of new Set(first.alts.map((a) => a.toks[0]))) {
      if (!byHead.has(t)) byHead.set(t, []);
      byHead.get(t).push(p);
    }
  }
  heads.sort((a, b) => b.els.length - a.els.length || Number(b.exact) - Number(a.exact) || a.rank - b.rank);

  const startWords = new Set(Object.keys(DIRECTION_WORDS));
  for (const h of heads) for (const a of h.els[0].alts) startWords.add(a.toks[0]);

  // Multiword item / NPC / scenery names whose first word also starts a command
  // ("oil can"): after AND / ',' such a name continues a noun list (P2, TT-016).
  const nounStarts = new Map();
  const nameLists = [...entities(c.items), ...entities(c.npcs)].map((e) => (e && typeof e === 'object' ? strings(e.names) : []));
  for (const room of entities(c.rooms)) {
    for (const sc of room && Array.isArray(room.scenery) ? room.scenery : []) if (sc && typeof sc === 'object') nameLists.push(strings(sc.names));
  }
  for (const name of nameLists.flat()) {
    const toks = wordsOf(name);
    if (toks.length < 2 || !startWords.has(toks[0])) continue;
    if (!nounStarts.has(toks[0])) nounStarts.set(toks[0], []);
    const list = nounStarts.get(toks[0]);
    if (!list.some((t) => t.join(' ') === toks.join(' '))) list.push(toks);
  }

  const prepWords = new Map();
  const prepStarts = new Map();
  for (const [id, forms] of Object.entries(PREPOSITIONS)) {
    for (const f of forms) {
      const toks = f.split(' ');
      if (toks.length === 1) prepWords.set(f, id);
      else {
        if (!prepStarts.has(toks[0])) prepStarts.set(toks[0], []);
        prepStarts.get(toks[0]).push(toks);
      }
    }
  }

  return {
    verbs, verbById: byId, words, patterns, byHead, unheaded, heads, startWords, nounStarts, prepWords, prepStarts, invalidPatterns,
  };
}

/**
 * Is `word` known (A6.1: in the merged vocabulary, or a number)?
 * @param {Vocab} vocab @param {string} word
 */
export function isKnownWord(vocab, word) {
  return /^\d+$/.test(word) || Boolean(vocab && vocab.words && vocab.words.has(word));
}

let engineVocab = null;
/** The engine-only vocabulary (no content), built once. @returns {Vocab} */
export function defaultVocab() {
  engineVocab ??= buildVocab();
  return engineVocab;
}
