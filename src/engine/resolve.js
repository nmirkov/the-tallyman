// The Tallyman — parser resolution (TT-007, ARCHITECTURE A6.3–A6.7, A3.3, A7.3, A8.1).
// Binds TT-005's unresolved noun phrases to world ids, builds disambiguation questions,
// answers pending questions, expands pronouns / ALL / lists, and repeats AGAIN.
//
// ─── Interface for the game loop (TT-008) ─────────────────────────────────────────────
// Every function is pure except recordExecuted: none of them writes `state`; the game
// applies the results. All results are plain JSON. None of them throws.
//
//   Result =
//     | { ok: true,  command: Command }                    bound — execute it
//     | { ok: false, message, params, text? }               error — free, STOP the chain
//     | { pending: PendingDisambig }                        question — free, STOP the chain
//
//   `message` is a MESSAGES id (content.messages may override it); `params` fills its
//   placeholders. `text` (a Text) is present only when the verb's own `notHere` replaces
//   MESSAGES.notHere (ACCUSE) — say `text` instead of the message then.
//
//   (Every entry point also takes a trailing `options` — `{strict: true}` rethrows
//   internal exceptions instead of returning engineError, A7.9 / C24.)
//   resolve(parsed, state, content, vocab?, callHook?)            → Result
//     `parsed` is parseCommand's output. A ParseError is mapped to its message id
//     (unknownWord {word}, noVerb, missingNoun {verbWord}, noPattern, empty), and
//     verb `again` is delegated to repeatLast, so one call covers A7.1 steps 6.2–6.5.
//   answerPending(segment, state, content, vocab?, callHook?)      → Result | NotAnswer | Cancelled
//     The first segment of a line while `state.ctx.pending` is set (A7.3, A6.7):
//       { notAnswer: true, barrier: true }   SAVE/LOAD/EXPORT/IMPORT/UNDO/RESTART/QUIT —
//                                            leave ctx.pending alone; the barrier decides.
//       { notAnswer: true, cancel? }         clear ctx.pending; say `cancel` if present
//                                            (confirmations only); run the segment as new.
//       { ok: false, cancelled: true, message: 'confirmCancelled', params, text? }
//                                            NO: clear ctx.pending, say it, STOP.
//       Result                               clear ctx.pending, then treat it exactly like
//                                            resolve()'s result (a re-ask is a new pending).
//     YES returns the stored command with `confirmed: true`.
//   repeatLast(state, content, vocab?, callHook?)                  → Result   (AGAIN, A6.6)
//   recordExecuted(state, content, command, vocab?)                → void     (mutates ctx)
//     Call after every executed command (world or meta): sets it / them / npc (A6.4) and
//     lastCommand (A6.6). Not for prompts, errors or barriers.
//   matchTopic(text, content)            → TopicId | null      (A4.9)
//   parseErrorResult(parseError)         → error Result
//
//   Storing a question: `state.ctx.pending = result.pending` and emit
//   `{type:'prompt', kind:'disambig', text: result.pending.text}`.
//
// `callHook` is only forwarded to world.scope() for hook-conditioned exits; resolution
// itself never runs hooks. A hook that throws there is a content bug: the exception
// propagates (the game passes `{strict: true}` so it reaches its transaction boundary,
// A7.9); standalone callers without `strict` get the usual engineError result.

import { MESSAGES, CHAIN_BARRIERS, PLAYER } from './types.js';
import { ARTICLES, ORDINALS, SELF_WORDS, defaultVocab } from './vocab.js';
import { tokenise, parseCommand } from './parser.js';
import { scope, isVisible, isCarried, isLit, sceneryOf, gropeable } from './world.js';

/**
 * @typedef {import('./types.js').State} State
 * @typedef {import('./types.js').ContentBundle} ContentBundle
 * @typedef {import('./types.js').Command} Command
 * @typedef {import('./types.js').ParsedCommand} ParsedCommand
 * @typedef {import('./types.js').ParsedNounPhrase} ParsedNounPhrase
 * @typedef {import('./types.js').PendingDisambig} PendingDisambig
 * @typedef {import('./vocab.js').Vocab} Vocab
 * @typedef {{ok: false, message: string, params: Record<string, string>, text?: unknown}} ErrorResult
 * @typedef {{ok: true, command: Command} | ErrorResult | {pending: PendingDisambig}} Result
 */

const hasOwn = (obj, key) => obj != null && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, key);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const clone = (v) => JSON.parse(JSON.stringify(v));
const strings = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);

/** Verbs that never become `lastCommand` (A6.6) besides class `system`. */
const NOT_REPEATED = new Set([...CHAIN_BARRIERS, 'again', 'yes', 'no']);
const PARSE_ERRORS = {
  empty: ['empty', []],
  'unknown-word': ['unknownWord', ['word']],
  'no-verb': ['noVerb', ['word']],
  'missing-noun': ['missingNoun', ['verbWord']],
  'no-pattern': ['noPattern', []],
};

/** @returns {ErrorResult} */
function fail(message, params = {}) {
  return { ok: false, message, params };
}

/** Same word split as vocab.js / tokenise: lower-case letters and digits only. */
function wordsOf(s) {
  return String(s).toLowerCase().replace(/'s\b/g, '').replace(/'/g, '').replace(/[^a-z0-9]+/g, ' ')
    .split(' ').filter(Boolean);
}

/* ------------------------------------------------------------------------ *
 *  Entity words (M1)                                                        *
 * ------------------------------------------------------------------------ */

/** content → Map(id → {noun, adj, names}); content is immutable, so this is a pure cache. */
const wordCache = new WeakMap();

function entityDef(content, id) {
  if (hasOwn(content.items, id)) return content.items[id];
  if (hasOwn(content.npcs, id)) return content.npcs[id];
  return sceneryOf(content, id);
}

/**
 * nounWords / adjWords of an item, NPC or scenery entry (M1), plus its names as word lists.
 * @returns {{noun: Set<string>, adj: Set<string>, names: string[][]}}
 */
function entityWords(content, id) {
  let cache = wordCache.get(content);
  if (!cache) { cache = new Map(); wordCache.set(content, cache); }
  if (cache.has(id)) return cache.get(id);
  const def = entityDef(content, id);
  const names = isObj(def) ? strings(def.names).map(wordsOf).filter((n) => n.length) : [];
  const noun = new Set(names.flat());
  const adj = new Set(isObj(def) ? strings(def.adjectives).flatMap(wordsOf) : []);
  if (isObj(def) && typeof def.name === 'string') for (const w of wordsOf(def.name)) if (!noun.has(w)) adj.add(w);
  const info = { noun, adj, names };
  cache.set(id, info);
  return info;
}

/** Every word of the phrase is a word of E, and (unless adjOnly) at least one is a noun (M2). */
function fits(info, words, adjOnly) {
  return words.every((w) => info.noun.has(w) || info.adj.has(w)) && (adjOnly || words.some((w) => info.noun.has(w)));
}

/** Display form for the prompt list: "the brass key", "Maggie" (proper NPC). */
function displayName(content, id) {
  if (hasOwn(content.npcs, id)) {
    const npc = content.npcs[id];
    return npc.proper ? String(npc.name) : `the ${npc.name}`;
  }
  if (hasOwn(content.items, id)) return `the ${content.items[id].name}`;
  const sc = sceneryOf(content, id);
  return `the ${strings(sc?.names)[0] ?? 'thing'}`;
}

/** "the a, the b or the c" */
function orList(parts) {
  return parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} or ${parts[parts.length - 1]}`;
}

function messageText(content, id) {
  const override = content.messages?.[id];
  return typeof override === 'string' ? override : MESSAGES[id];
}

function disambigText(content, candidates) {
  const list = orList(candidates.map((id) => displayName(content, id)));
  return messageText(content, 'disambig').replace(/\{list\}/g, list);
}

/* ------------------------------------------------------------------------ *
 *  Resolution context and scope (M3, A8.1)                                  *
 * ------------------------------------------------------------------------ */

/**
 * Per-call context: everything the slot resolvers need.
 * @param {ParsedCommand|Command} cmd
 */
function context(cmd, state, content, vocab, callHook) {
  const v = vocab && vocab.verbById ? vocab : defaultVocab();
  const verb = typeof cmd.verb === 'string' && hasOwn(v.verbById, cmd.verb) ? v.verbById[cmd.verb] : null;
  const sc = scope(state, content, typeof callHook === 'function' ? callHook : () => false);
  return { state, content, vocab: v, cmd, verb, sc, lit: isLit(state, content), ctx: isObj(state.ctx) ? state.ctx : {} };
}

/** Items NPCs in the room sell (M3, BUY only). */
function soldHere(rc) {
  const sold = new Set();
  for (const npc of rc.sc.npcs) {
    for (const id of Object.keys(rc.content.npcs[npc]?.sells ?? {})) if (hasOwn(rc.state.items, id)) sold.add(id);
  }
  return sold;
}

/**
 * Candidate ids for a slot in listing order (items in content order, NPCs, scenery) — M3.
 * @param {object} rc
 * @param {'dobj'|'iobj'} slot
 * @param {object} out  Slots bound so far (iobj is bound before dobj).
 */
function slotScope(rc, slot, out) {
  const { state, sc, cmd } = rc;
  if (slot === 'dobj' && cmd.verb === 'take' && cmd.prep === 'from' && typeof out.iobj === 'string') {
    return sc.items.filter((id) => state.items[id].loc === out.iobj);
  }
  if (slot === 'dobj' && cmd.verb === 'buy') {
    const sold = soldHere(rc);
    const visible = new Set(sc.items);
    const items = Object.keys(state.items).filter((id) => visible.has(id) || sold.has(id));
    return [...items, ...sc.npcs, ...sc.scenery];
  }
  // A8.1 groping (C38): in an unlit room TAKE also finds loose items on the floor by touch.
  if (slot === 'dobj' && cmd.verb === 'take' && !rc.lit) return [...sc.ids, ...gropeable(state, rc.content)];
  return sc.ids;
}

/** M6: nothing matched. */
function noMatch(rc) {
  return rc.lit ? notHere(rc) : fail('tooDark');
}

/** MESSAGES.notHere, or the verb's own text (ACCUSE). */
function notHere(rc) {
  const r = fail('notHere');
  if (rc.verb && rc.verb.notHere !== undefined) r.text = rc.verb.notHere;
  return r;
}

/* ------------------------------------------------------------------------ *
 *  Noun phrases                                                             *
 * ------------------------------------------------------------------------ */

/** Phrase words: lower-case strings, fillers dropped; `one` dropped when other words remain. */
function phraseWords(np) {
  const words = strings(np.words).map((w) => w.toLowerCase()).filter((w) => w && w !== ',' && !ARTICLES.includes(w));
  const without = words.filter((w) => w !== 'one');
  return without.length ? without : words;
}

/**
 * NPCs (anywhere in the world) that the phrase names as a noun phrase (M2 strict), e.g.
 * "harrow", "frank harrow", "the old man". TT-131.
 */
function personsNamed(content, words) {
  if (!words.length || !isObj(content.npcs)) return [];
  return Object.keys(content.npcs).filter((id) => fits(entityWords(content, id), words, false));
}

/**
 * M2 matches among `ids`, with the adjective-only retry. TT-131: a phrase that names a person
 * never falls back to things named after them ("Harrow's key", "patient file ... PIKE"), so
 * ASK HARROW / ACCUSE PIKE with the person elsewhere is "not here", not a question about keys.
 */
function matching(rc, ids, words) {
  if (!words.length) return [];
  const strict = ids.filter((id) => fits(entityWords(rc.content, id), words, false));
  if (strict.length) return strict;
  if (personsNamed(rc.content, words).length) return [];
  return ids.filter((id) => fits(entityWords(rc.content, id), words, true));
}

/**
 * M6 for a phrase that names an absent named (`proper`) person: "Harrow isn't here." (TT-131; content
 * may override `messages.personNotHere`, `{The}` = the NPC's display name). The verb's own
 * `notHere` (ACCUSE) still wins. Null when the phrase does not name one person by name.
 */
function personNotHere(rc, words) {
  if (!rc.lit || (rc.verb && rc.verb.notHere !== undefined)) return null;
  const named = personsNamed(rc.content, words).filter((id) => {
    if (rc.content.npcs[id].proper !== true) return false;
    const own = wordsOf(rc.content.npcs[id].name ?? '');
    return words.some((w) => own.includes(w));
  });
  if (named.length !== 1) return null;
  const tpl = typeof rc.content.messages?.personNotHere === 'string' ? rc.content.messages.personNotHere : '{The} isn\'t here.';
  const r = fail('notHere');
  r.text = tpl.replace(/\{The\}/g, String(rc.content.npcs[named[0]].name));
  return r;
}

/** Does the item satisfy the verb's `prefer` (M4 c)? */
function prefers(rc, prefer, id) {
  const st = rc.state.items[id];
  const def = rc.content.items?.[id];
  switch (prefer) {
    case 'carried': return !!st && isCarried(rc.state, id);
    case 'notCarried': return !st || !isCarried(rc.state, id);
    case 'worn': return st?.worn === true;
    case 'closed': return !!def?.openable && st?.open !== true;
    case 'open': return st?.open === true;
    case 'unlit': return !!def?.light && st?.lit !== true;
    case 'lit': return st?.lit === true;
    default: return true;
  }
}

/** M4 narrowing; each step applies only if it leaves ≥ 1 candidate. No recency (C14). */
function narrow(rc, hits, words) {
  const isScenery = (id) => !hasOwn(rc.state.items, id) && !hasOwn(rc.state.npcs, id);
  const isPerson = (id) => hasOwn(rc.state.npcs, id);
  const steps = [
    (id) => entityWords(rc.content, id).names.some((n) => n.every((w) => words.includes(w))),
    // TT-131: a person beats objects named after them.
    (id) => !personsNamed(rc.content, words).length || isPerson(id),
    (id) => !isScenery(id),
    (id) => prefers(rc, rc.verb?.prefer, id),
  ];
  let out = hits;
  for (const step of steps) {
    if (out.length < 2) break;
    const kept = out.filter(step);
    if (kept.length) out = kept;
  }
  return out;
}

/**
 * A pronoun → ids in scope (A6.4).
 * @returns {{ids: string[]} | {error: ErrorResult}}
 */
function pronounIds(rc, pronoun, ids) {
  const inScope = new Set(ids);
  const { ctx } = rc;
  const single = (id) => {
    if (typeof id !== 'string') return { error: fail('pronounUnset', { pronoun }) };
    return inScope.has(id) ? { ids: [id] } : { error: notHere(rc) };
  };
  if (pronoun === 'it') return single(ctx.it ?? null);
  if (pronoun === 'him' || pronoun === 'her') return single(ctx.npc ?? null);
  if (pronoun === 'them') {
    const them = strings(ctx.them);
    const visible = [...new Set(them.filter((id) => inScope.has(id)))];
    if (visible.length) return { ids: visible };
    if (typeof ctx.it === 'string') return single(ctx.it);
    return { error: them.length ? notHere(rc) : fail('pronounUnset', { pronoun }) };
  }
  return { error: notHere(rc) };
}

/**
 * One simple phrase (words or pronoun) → ids, an error, or an ambiguity.
 * @returns {{ids: string[]} | {error: ErrorResult} | {ambiguous: string[]}}
 */
function simpleIds(rc, np, ids) {
  if (!isObj(np)) return { error: noMatch(rc) };
  if (typeof np.pronoun === 'string') return pronounIds(rc, np.pronoun, ids);
  const words = phraseWords(np);
  const hits = matching(rc, ids, words);
  if (!hits.length) return { error: personNotHere(rc, words) ?? noMatch(rc) };
  const best = narrow(rc, hits, words);
  return best.length === 1 ? { ids: best } : { ambiguous: best };
}

/** ME / MYSELF / SELF / YOURSELF alone → the player (TT-009); always in scope, even in the dark. */
function isSelf(np) {
  if (typeof np.pronoun === 'string') return false;
  const words = phraseWords(np);
  return words.length > 0 && words.every((w) => SELF_WORDS.includes(w));
}

/** ALL expansion (A6.5), before EXCEPT. */
function expandAll(rc, out) {
  const { state, content, cmd, sc } = rc;
  const visible = new Set(sc.items);
  const verb = cmd.verb;
  const carriedStyle = verb === 'drop' || verb === 'put' || (verb !== 'take' && rc.verb?.prefer === 'carried');
  const ids = Object.keys(state.items);
  if (carriedStyle) {
    return ids.filter((id) => state.items[id].loc === PLAYER && !content.items[id]?.personal
      && state.items[id].worn !== true && id !== out.iobj);
  }
  const from = cmd.prep === 'from' && typeof out.iobj === 'string' ? out.iobj : state.roomId;
  if (verb === 'take' && from === state.roomId && !rc.lit) for (const id of gropeable(state, content)) visible.add(id);
  return ids.filter((id) => {
    const def = content.items[id];
    return state.items[id].loc === from && visible.has(id) && state.items[id].hidden !== true
      && !(def?.fixed || def?.scenery);
  });
}

/**
 * Resolve one slot. `start` / `prefix` resume a list after an answered element.
 * @returns {{value: string|string[], all?: true} | {error: ErrorResult} | {ambiguous: string[], index?: number, prefix?: string[]}}
 */
function resolveSlot(rc, slot, np, out, start = 0, prefix = []) {
  if (!isObj(np)) return { error: noMatch(rc) };
  const multi = slot === 'dobj' && rc.verb?.multi === true;
  const ids = slotScope(rc, slot, out);

  if (np.all === true) {
    if (!multi) return { error: fail('allNotAllowed') };
    let expanded = expandAll(rc, out);
    for (const ex of Array.isArray(np.except) ? np.except : []) {
      let drop;
      if (isObj(ex) && typeof ex.pronoun === 'string') {
        const r = pronounIds(rc, ex.pronoun, ids);
        if (r.error) return r;
        drop = r.ids;
      } else {
        drop = matching(rc, ids, isObj(ex) ? phraseWords(ex) : []);
        if (!drop.length) return { error: noMatch(rc) };
      }
      expanded = expanded.filter((id) => !drop.includes(id));
    }
    if (!expanded.length) return { error: fail('allNothing', { verbWord: String(rc.cmd.verbWord ?? '') }) };
    return { value: expanded, all: true };
  }

  if (Array.isArray(np.list)) {
    if (!multi) return { error: fail('oneAtATime') };
    const got = [...prefix];
    for (let i = start; i < np.list.length; i++) {
      const r = simpleIds(rc, np.list[i], ids);
      if (r.error) return r;
      if (r.ambiguous) return { ambiguous: r.ambiguous, index: i, prefix: got };
      got.push(...r.ids);
    }
    const unique = [...new Set(got)];
    if (!unique.length) return { error: noMatch(rc) };
    return { value: unique.length === 1 ? unique[0] : unique };
  }

  if (isSelf(np)) return { value: PLAYER };
  const r = simpleIds(rc, np, ids);
  if (r.error || r.ambiguous) return r;
  if (r.ids.length > 1 && !multi) return { error: fail('oneAtATime') };
  return { value: r.ids.length === 1 ? r.ids[0] : r.ids };
}

/* ------------------------------------------------------------------------ *
 *  Commands                                                                 *
 * ------------------------------------------------------------------------ */

/**
 * Resolve the remaining slots of `parsed` (iobj before dobj, M3) on top of `bound`.
 * @param {object} rc
 * @param {Record<string, unknown>} bound  Slots already resolved.
 * @param {{slot: string, index: number}|null} resume  Continue a list at `index`.
 * @returns {Result}
 */
function bindFrom(rc, bound, resume) {
  const parsed = rc.cmd;
  const out = { ...bound };
  for (const slot of ['iobj', 'dobj']) {
    if (parsed[slot] === undefined) continue;
    const resuming = resume && resume.slot === slot;
    if (hasOwn(out, slot) && !resuming) continue;
    const r = resuming
      ? resolveSlot(rc, slot, parsed[slot], out, resume.index, strings(out[slot]))
      : resolveSlot(rc, slot, parsed[slot], out);
    if (r.error) return r.error;
    if (r.ambiguous) {
      const b = { ...out };
      if (r.index !== undefined) b[slot] = r.prefix; else delete b[slot];
      const pending = {
        kind: 'disambig', text: disambigText(rc.content, r.ambiguous), command: clone(parsed), slot,
        candidates: r.ambiguous,
      };
      if (r.index !== undefined) pending.index = r.index;
      pending.bound = b;
      return { pending };
    }
    out[slot] = r.value;
    if (r.all) out.all = true;
  }
  return { ok: true, command: buildCommand(rc, out) };
}

/** Assemble the resolved Command (A3.3 field set). */
function buildCommand(rc, out) {
  const p = rc.cmd;
  const cmd = { verb: p.verb, verbWord: typeof p.verbWord === 'string' ? p.verbWord : String(p.verb) };
  if (out.dobj !== undefined) cmd.dobj = out.dobj;
  if (typeof p.prep === 'string') cmd.prep = p.prep;
  if (out.iobj !== undefined) cmd.iobj = out.iobj;
  if (typeof p.dir === 'string') cmd.dir = p.dir;
  if (p.topic !== undefined) {
    cmd.topic = matchTopic(p.topic, rc.content);
    cmd.topicText = typeof p.topic === 'string' ? p.topic : '';
  }
  if (typeof p.arg === 'string') cmd.arg = p.arg;
  if (out.all) cmd.all = true;
  cmd.raw = typeof p.raw === 'string' ? p.raw : '';
  return cmd;
}

/**
 * Wraps an exported entry point: bad arguments become errors, never exceptions — unless
 * `options.strict` (A7.9, C24), when the exception is rethrown for tests.
 */
function guarded(fn, options) {
  try {
    return fn();
  } catch (e) {
    if (options && options.strict === true) throw e;
    return fail('engineError', { error: String(e && e.message ? e.message : e) });
  }
}

const validWorld = (state, content) => isObj(state) && isObj(content) && isObj(state.items) && isObj(state.npcs)
  && isObj(content.items) && isObj(content.npcs) && isObj(content.rooms) && typeof state.roomId === 'string';

/**
 * Map a ParseError to its message (A16).
 * @param {import('./types.js').ParseError} err
 * @returns {ErrorResult}
 */
export function parseErrorResult(err) {
  const [message, keys] = PARSE_ERRORS[err?.error] ?? PARSE_ERRORS['no-pattern'];
  const params = {};
  for (const k of keys) if (typeof err[k] === 'string') params[k] = err[k];
  if (err?.error === 'missing-noun' && typeof err.verbName === 'string') params.verbWord = err.verbName; // TT-131
  return fail(message, params);
}

/**
 * Bind a parsed command to world ids (A6.3): scope, M2 matching, M4 narrowing, pronouns,
 * ALL / EXCEPT / lists, topics. Pure; free whatever the outcome. See the file header.
 * @param {ParsedCommand|import('./types.js').ParseError} parsed
 * @param {State} state
 * @param {ContentBundle} content
 * @param {Vocab} [vocab]  Merged vocabulary (buildVocab(content)); engine-only by default.
 * @param {(hookId: string, args: object) => unknown} [callHook]
 * @param {{strict?: boolean}} [options]  strict: rethrow internal errors (C24).
 * @returns {Result}
 */
export function resolve(parsed, state, content, vocab, callHook, options) {
  return guarded(() => {
    if (!isObj(parsed)) return fail('noPattern');
    if (typeof parsed.error === 'string') return parseErrorResult(parsed);
    if (typeof parsed.verb !== 'string') return fail('noPattern');
    if (parsed.verb === 'again') return repeatLast(state, content, vocab, callHook, options);
    if (!validWorld(state, content)) return fail('noPattern');
    return bindFrom(context(parsed, state, content, vocab, callHook), {}, null);
  }, options);
}

/** Tokens of an answer segment (array from splitChain, or a string). */
function answerTokens(segment) {
  const toks = typeof segment === 'string' ? tokenise(segment) : strings(segment).map((t) => t.toLowerCase().trim());
  return toks.filter((t) => t && t !== '.');
}

/**
 * Answer the pending question with the first segment of a line (A6.7, A7.3).
 * Pure: the caller clears / replaces `ctx.pending` as described in the file header.
 * @param {string[]|string} segment
 * @param {State} state
 * @param {ContentBundle} content
 * @param {Vocab} [vocab]
 * @param {(hookId: string, args: object) => unknown} [callHook]
 * @param {{strict?: boolean}} [options]
 */
export function answerPending(segment, state, content, vocab, callHook, options) {
  return guarded(() => {
    const pending = isObj(state) && isObj(state.ctx) && isObj(state.ctx.pending) ? state.ctx.pending : null;
    if (!pending) return { notAnswer: true };
    const v = vocab && vocab.verbById ? vocab : defaultVocab();
    const toks = answerTokens(segment);
    if (!toks.length) return { notAnswer: true };

    const parsed = parseCommand(toks, v);
    if (!parsed.error && (CHAIN_BARRIERS.includes(parsed.verb) || v.verbById[parsed.verb]?.class === 'system')) {
      return { notAnswer: true, barrier: true };
    }

    if (pending.kind === 'confirm') {
      const cancel = { message: 'confirmCancelled', params: {} };
      if (typeof pending.cancelText === 'string') cancel.text = pending.cancelText;
      if (toks.length === 1 && (toks[0] === 'yes' || toks[0] === 'y') && isObj(pending.command)) {
        return { ok: true, command: { ...clone(pending.command), confirmed: true } };
      }
      if (toks.length === 1 && (toks[0] === 'no' || toks[0] === 'n')) return { ok: false, cancelled: true, ...cancel };
      return { notAnswer: true, cancel };
    }

    if (pending.kind !== 'disambig' || !validWorld(state, content) || !isObj(pending.command)) return { notAnswer: true };
    const candidates = strings(pending.candidates);
    const words = toks.filter((t) => t !== ',' && t !== 'one' && !ARTICLES.includes(t));
    if (!words.length || !candidates.length) return { notAnswer: true };

    let chosen = null;
    if (words.length === 1 && (hasOwn(ORDINALS, words[0]) || /^\d+$/.test(words[0]))) {
      const n = hasOwn(ORDINALS, words[0]) ? ORDINALS[words[0]] : Number(words[0]);
      const i = n === -1 ? candidates.length - 1 : n - 1;
      if (i < 0 || i >= candidates.length) return { notAnswer: true };
      chosen = candidates[i];
    } else {
      const fit = candidates.filter((id) => fits(entityWords(content, id), words, true));
      if (!fit.length) return { notAnswer: true };
      if (fit.length > 1) {
        return { pending: { ...clone(pending), text: disambigText(content, fit), candidates: fit } };
      }
      chosen = fit[0];
    }

    const slot = pending.slot === 'iobj' ? 'iobj' : 'dobj';
    const bound = isObj(pending.bound) ? clone(pending.bound) : {};
    let resume = null;
    if (Number.isInteger(pending.index)) {
      bound[slot] = [...strings(bound[slot]), chosen];
      resume = { slot, index: pending.index + 1 };
    } else {
      bound[slot] = chosen;
    }
    return bindFrom(context(pending.command, state, content, v, callHook), bound, resume);
  }, options);
}

/**
 * AGAIN (A6.6): a fresh copy of `ctx.lastCommand` if every id in it is still visible
 * (for BUY, a sold item of an NPC here counts); otherwise notHere; none → againNothing.
 * No re-binding.
 * @param {State} state
 * @param {ContentBundle} content
 * @param {Vocab} [vocab]
 * @param {(hookId: string, args: object) => unknown} [callHook]
 * @param {{strict?: boolean}} [options]
 * @returns {Result}
 */
export function repeatLast(state, content, vocab, callHook, options) {
  return guarded(() => {
    const last = isObj(state) && isObj(state.ctx) && isObj(state.ctx.lastCommand) ? state.ctx.lastCommand : null;
    if (!last) return fail('againNothing');
    if (!validWorld(state, content)) return fail('againNothing');
    const rc = context(last, state, content, vocab, callHook);
    const sold = last.verb === 'buy' ? soldHere(rc) : new Set();
    const present = (id) => id === PLAYER || (typeof id === 'string' && (isVisible(state, content, id) || sold.has(id)));
    const dobj = last.dobj === undefined ? [] : [].concat(last.dobj);
    if (!dobj.every(present)) return notHere(rc);
    if (last.iobj !== undefined && !present(last.iobj)) return notHere(rc);
    const command = clone(last);
    delete command.confirmed;
    return { ok: true, command };
  }, options);
}

/**
 * Update `state.ctx` after a command executed (A6.4, A6.6). The only function here that
 * writes state. Ignores malformed input.
 * @param {State} state
 * @param {ContentBundle} content
 * @param {Command} command
 * @param {Vocab} [vocab]
 */
export function recordExecuted(state, content, command, vocab) {
  if (!isObj(state) || !isObj(state.ctx) || !isObj(command) || typeof command.verb !== 'string') return;
  const ctx = state.ctx;
  const isNpc = (id) => hasOwn(state.npcs, id);
  const isRef = (id) => typeof id === 'string' && (hasOwn(state.items, id) || isNpc(id)
    || (isObj(content) && sceneryOf(content, id) !== null));
  if (Array.isArray(command.dobj)) {
    const them = [...new Set(command.dobj.filter(isRef))];
    if (them.length) ctx.them = them;
  } else if (isRef(command.dobj)) {
    if (isNpc(command.dobj)) ctx.npc = command.dobj; else ctx.it = command.dobj;
  }
  if (isRef(command.iobj) && isNpc(command.iobj)) ctx.npc = command.iobj;
  const v = vocab && vocab.verbById ? vocab : defaultVocab();
  if (!NOT_REPEATED.has(command.verb) && v.verbById[command.verb]?.class !== 'system') {
    const last = clone(command);
    delete last.confirmed;
    ctx.lastCommand = last;
  }
}

/**
 * Topic matching for ASK / TELL (A4.9): first `content.topics` keyword occurring as a
 * whole-word sequence, else the first item / NPC (global) whose names occur, else null.
 * @param {string} text
 * @param {ContentBundle} content
 * @returns {string|null}
 */
export function matchTopic(text, content) {
  if (typeof text !== 'string' || !isObj(content)) return null;
  const words = wordsOf(text);
  if (!words.length) return null;
  const occurs = (name) => {
    const seq = wordsOf(name);
    if (!seq.length) return false;
    for (let i = 0; i + seq.length <= words.length; i++) if (seq.every((w, k) => words[i + k] === w)) return true;
    return false;
  };
  for (const [id, topic] of Object.entries(isObj(content.topics) ? content.topics : {})) {
    if (isObj(topic) && strings(topic.names).some(occurs)) return id;
  }
  for (const table of [content.items, content.npcs]) {
    for (const [id, e] of Object.entries(isObj(table) ? table : {})) {
      if (isObj(e) && strings(e.names).some(occurs)) return id;
    }
  }
  return null;
}
