// The Tallyman — parser syntax layer (TT-005, ARCHITECTURE A6.2, A12.3).
// No world knowledge: turns a line into token segments and each segment into a
// ParsedCommand (verb + unresolved noun phrases) or a ParseError. Never throws.

import { LIMITS } from './types.js';
import {
  ARTICLES, PRONOUN_WORDS, ALL_WORDS, EXCEPT_WORDS, DIRECTION_WORDS, CHAIN_WORDS, defaultVocab, isKnownWord,
} from './vocab.js';

/** Hard cap on tokens per command; tokenise() can produce at most this many from a 200-char line. */
const MAX_TOKENS = LIMITS.inputLength;

/* ------------------------------------------------------------------ *
 *  Input normalisation (A12.3) and tokenise (P1)                      *
 * ------------------------------------------------------------------ */

/** A12.1 character mapping, applied to input before lower-casing. */
function mapChars(s) {
  return s
    .replace(/\r\n?/g, '\n')
    .replace(/[‘’‚‛′´`]/g, '\'')
    .replace(/[“”„‟″]/g, '"')
    .replace(/…/g, '...')
    .replace(/[–—―‒−‐‑]/g, '-')
    .replace(/[  -   　\t]/g, ' ')
    .replace(/[​-‍⁠­﻿]/g, '')
    .replace(/[^\x20-\x7e\n£]/gu, '?');
}

/** Coerce anything to a string without ever throwing. */
function coerce(line) {
  if (typeof line === 'string') return line;
  if (line === null || line === undefined) return '';
  try {
    return String(line);
  } catch {
    return '';
  }
}

/**
 * Input normalisation (A12.3): coerce → A12.1 mapping → lower-case → trim → collapse
 * whitespace → truncate to `LIMITS.inputLength`.
 * @param {unknown} line
 * @returns {string}
 */
export function normaliseInput(line) {
  return mapChars(coerce(line)).toLowerCase().trim().replace(/\s+/g, ' ').slice(0, LIMITS.inputLength);
}

/**
 * Split a raw input line into lower-case tokens (A6.2 P1). `'s` is dropped, other
 * apostrophes removed, hyphens become spaces, `. ; ! ?` become `'.'`, `,` stays `','`,
 * any other punctuation is removed. Never throws.
 * @param {unknown} line
 * @returns {string[]}
 */
export function tokenise(line) {
  const s = normaliseInput(line)
    .replace(/'s\b/g, '')
    .replace(/'/g, '')
    .replace(/-/g, ' ')
    .replace(/[.;!?]/g, ' . ')
    .replace(/,/g, ' , ')
    .replace(/[^a-z0-9., ]/g, '');
  return s.split(' ').filter(Boolean);
}

/* ------------------------------------------------------------------ *
 *  splitChain (P2)                                                    *
 * ------------------------------------------------------------------ */

/** Does a multiword entity name that starts with a verb word ("oil can") begin at `k`? (TT-016) */
function nameAt(vocab, toks, k) {
  const names = vocab.nounStarts instanceof Map ? vocab.nounStarts.get(toks[k]) : undefined;
  return Boolean(names && names.some((seq) => seq.every((w, j) => toks[k + j] === w)));
}

/**
 * Split tokens into command segments (A6.2 P2): `'.'`, `then` and `and then` always
 * separate; `','` / `and` separate only when the next token starts a command (a verb
 * word or a direction word) and does not begin a multiword entity name of the merged
 * vocab ("take cutters and oil can" is one command). Empty segments are dropped. Never throws.
 * @param {string[]} tokens
 * @param {import('./vocab.js').Vocab} [vocab]  Defaults to the engine-only vocabulary;
 *   pass the merged vocab so content verbs also start commands.
 * @returns {string[][]}
 */
export function splitChain(tokens, vocab) {
  try {
    const v = vocab && vocab.startWords ? vocab : defaultVocab();
    const toks = Array.isArray(tokens) ? tokens.filter((t) => typeof t === 'string' && t) : [];
    const segments = [];
    let cur = [];
    const cut = () => { if (cur.length) segments.push(cur); cur = []; };
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      const next = toks[i + 1];
      if (t === '.' || CHAIN_WORDS.includes(t)) { cut(); continue; }
      if (t === 'and' && next === 'then') { cut(); i++; continue; }
      if ((t === ',' || t === 'and') && next !== undefined && v.startWords.has(next) && !nameAt(v, toks, i + 1)) { cut(); continue; }
      cur.push(t);
    }
    cut();
    return segments;
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ *
 *  parseCommand (P3, P4)                                              *
 * ------------------------------------------------------------------ */

/** Join tokens into the `raw` text: words space-separated, commas glued to the word before. */
function joinRaw(toks) {
  return toks.join(' ').replace(/ ,/g, ',');
}

/**
 * Parse one simple noun phrase (no list separators). Returns null if invalid.
 * @param {string[]} words
 */
function simplePhrase(words) {
  if (!words.length) return null;
  if (words.some((x) => ALL_WORDS.includes(x) || EXCEPT_WORDS.includes(x))) return null;
  if (words.length === 1 && PRONOUN_WORDS.includes(words[0])) return { pronoun: words[0] };
  return { words };
}

/** Split on `and` / `,` into simple phrases; empty elements are skipped. Null if any element is invalid. */
function phraseList(words) {
  const items = [];
  let cur = [];
  for (const x of [...words, ',']) {
    if (x === 'and' || x === ',') {
      if (cur.length) {
        const p = simplePhrase(cur);
        if (!p) return null;
        items.push(p);
      }
      cur = [];
    } else cur.push(x);
  }
  return items.length ? items : null;
}

/**
 * Noun phrase (A6.2 P4) from slot words (fillers already dropped). Null if invalid.
 * @param {string[]} words
 * @returns {import('./types.js').ParsedNounPhrase|null}
 */
function nounPhrase(words) {
  if (!words.length) return null;
  if (ALL_WORDS.includes(words[0])) {
    if (words.length === 1) return { all: true };
    if (!EXCEPT_WORDS.includes(words[1])) return null;
    const except = phraseList(words.slice(2));
    return except ? { all: true, except } : null;
  }
  const items = phraseList(words);
  if (!items) return null;
  return items.length === 1 ? items[0] : { list: items };
}

/**
 * @typedef {{w: string, i: number, art: boolean}} Entry  A significant token: word, index in the
 *   segment's token list, and whether a filler stood right before it.
 */

/** Does literal element `el` match at entry index `ti`? Returns the matched alt or null. */
function litAt(el, entries, ti) {
  for (const alt of el.alts) {
    if (ti + alt.toks.length > entries.length) continue;
    if (alt.toks.every((tok, k) => entries[ti + k].w === tok)) return alt;
  }
  return null;
}

/** Index of the first preposition word at or after `from` (single or multiword); entries.length if none. */
function nextPrep(entries, from, vocab) {
  for (let k = from; k < entries.length; k++) {
    const x = entries[k].w;
    if (vocab.prepWords.has(x)) return k;
    const multi = vocab.prepStarts.get(x);
    if (multi && multi.some((toks) => toks.every((tok, j) => entries[k + j] && entries[k + j].w === tok))) return k;
  }
  return entries.length;
}

/**
 * Try one compiled pattern against the entries; backtracks over slot lengths.
 * @returns {{verbParts: string[], bind: Record<string, unknown>, topicStart: number}|null}
 */
function matchPattern(pattern, entries, toks, vocab) {
  const { els } = pattern;
  const verbParts = [];
  const bind = {};
  let topicStart = Infinity;

  const step = (ei, ti) => {
    if (ei === els.length) return ti === entries.length;
    const el = els[ei];
    if (el.t === 'lit') {
      const alt = litAt(el, entries, ti);
      if (alt) {
        const surface = entries.slice(ti, ti + alt.toks.length).map((e) => e.w).join(' ');
        const isPrep = el.role === 'prep';
        if (isPrep) bind.prep = alt.prep ?? surface; else verbParts.push(surface);
        if (step(ei + 1, ti + alt.toks.length)) return true;
        if (isPrep) delete bind.prep; else verbParts.pop();
      }
      return el.opt ? step(ei + 1, ti) : false;
    }
    switch (el.name) {
      case 'dir': {
        const e = entries[ti];
        const dir = e && Object.hasOwn(DIRECTION_WORDS, e.w) ? DIRECTION_WORDS[e.w] : null;
        if (!dir || (el.dirs && !el.dirs.includes(dir))) return false;
        bind.dir = dir;
        bind.dirWord = e.w;
        if (step(ei + 1, ti + 1)) return true;
        delete bind.dir;
        delete bind.dirWord;
        return false;
      }
      case 'arg': {
        if (ti >= entries.length) return false;
        bind.arg = entries[ti].w;
        if (step(ei + 1, ti + 1)) return true;
        delete bind.arg;
        return false;
      }
      case 'topic': {
        if (ti >= entries.length) return false;
        const start = ti === 0 ? 0 : entries[ti - 1].i + 1;
        bind.topic = joinRaw(toks.slice(start));
        topicStart = ti;
        return true;
      }
      default: { // dobj / iobj
        const max = nextPrep(entries, ti, vocab) - ti;
        if (max < 1) return false;
        const lengths = [];
        const next = els[ei + 1];
        if (next && next.t === 'slot' && (next.name === 'dobj' || next.name === 'iobj')) {
          // Two adjacent noun slots (SHOW PIKE THE CARD): split at an article first, else after one word.
          for (let L = 1; L < max; L++) if (entries[ti + L].art) lengths.push(L);
        }
        for (let L = 1; L <= max; L++) if (!lengths.includes(L)) lengths.push(L);
        for (const L of lengths) {
          const phrase = nounPhrase(entries.slice(ti, ti + L).map((e) => e.w));
          if (!phrase) continue;
          bind[el.name] = phrase;
          if (step(ei + 1, ti + L)) return true;
          delete bind[el.name];
        }
        return false;
      }
    }
  };

  return step(0, 0) ? { verbParts, bind, topicStart } : null;
}

/** Build the ParsedCommand from a successful match. */
function buildCommand(pattern, m, raw) {
  const cmd = { verb: pattern.verb, verbWord: m.verbParts.join(' ') || m.bind.dirWord || '' };
  for (const k of ['dobj', 'prep', 'iobj', 'dir', 'topic', 'arg']) if (m.bind[k] !== undefined) cmd[k] = m.bind[k];
  cmd.raw = raw;
  return cmd;
}

/** The longest verb head at the start of the entries (exact verb words before pattern heads). */
function findHead(entries, vocab) {
  for (const h of vocab.heads) {
    let ti = 0;
    const parts = [];
    let ok = true;
    for (const el of h.els) {
      const alt = litAt(el, entries, ti);
      if (!alt) { ok = false; break; }
      parts.push(entries.slice(ti, ti + alt.toks.length).map((e) => e.w).join(' '));
      ti += alt.toks.length;
    }
    if (ok) return { verb: h.verb, verbWord: parts.join(' '), len: ti };
  }
  return null;
}

/** Does `verb` have any pattern with the given slot? */
function hasSlot(vocab, verb, name) {
  return vocab.patterns.some((p) => p.verb === verb && p.els.some((e) => e.t === 'slot' && e.name === name));
}

/** Candidate patterns for these entries, in global priority order. */
function candidates(entries, vocab) {
  const headed = vocab.byHead.get(entries[0].w) ?? [];
  if (!vocab.unheaded.length) return headed;
  return [...headed, ...vocab.unheaded].sort((a, b) => b.lits - a.lits || a.rank - b.rank);
}

/** Sanitise the token argument into a lower-case string array (a string is tokenised). */
function sanitise(tokens) {
  if (typeof tokens === 'string') return tokenise(tokens);
  if (!Array.isArray(tokens)) return [];
  const out = [];
  for (const t of tokens.slice(0, MAX_TOKENS)) {
    if (typeof t !== 'string') continue;
    const x = t.toLowerCase().trim();
    if (x && x !== '.') out.push(x);
  }
  while (out[0] === ',') out.shift();
  while (out[out.length - 1] === ',') out.pop();
  return out;
}

/**
 * Parse one command segment (A6.2 P3/P4). Error priority: empty → unknown-word (first
 * unknown word outside a `{topic}`) → no-verb → missing-noun → no-pattern. Never throws.
 * @param {string[]} tokens  One segment from splitChain (a string is tokenised first).
 * @param {import('./vocab.js').Vocab} [vocab]  Merged vocabulary; defaults to engine-only.
 * @returns {import('./types.js').ParsedCommand|import('./types.js').ParseError}
 */
export function parseCommand(tokens, vocab) {
  let raw = '';
  try {
    const v = vocab && vocab.heads && vocab.byHead ? vocab : defaultVocab();
    const toks = sanitise(tokens);
    raw = joinRaw(toks);
    if (!toks.length) return { error: 'empty', raw };

    /** @type {Entry[]} */
    const entries = [];
    let art = false;
    toks.forEach((x, i) => {
      if (ARTICLES.includes(x)) { art = true; return; }
      entries.push({ w: x, i, art });
      art = false;
    });
    if (!entries.length) return { error: 'no-verb', word: toks[0], raw };

    const firstUnknown = (limit) => entries.slice(0, limit).find((e) => e.w !== ',' && !isKnownWord(v, e.w));

    for (const p of candidates(entries, v)) {
      const m = matchPattern(p, entries, toks, v);
      if (!m) continue;
      const unknown = firstUnknown(m.topicStart);
      if (unknown) return { error: 'unknown-word', word: unknown.w, raw };
      return buildCommand(p, m, raw);
    }

    const head = findHead(entries, v);
    let topicFrom = Infinity;
    if (head && hasSlot(v, head.verb, 'topic')) {
      const about = entries.findIndex((e, k) => k >= head.len && e.w === 'about');
      if (about >= 0) topicFrom = about + 1;
    }
    const unknown = firstUnknown(topicFrom);
    if (unknown) return { error: 'unknown-word', word: unknown.w, raw };
    if (!head) return { error: 'no-verb', word: entries[0].w, raw };
    const base = { verb: head.verb, verbWord: head.verbWord, raw };
    if (entries.length === head.len && hasSlot(v, head.verb, 'dobj')) {
      // TT-131: "X" alone asks "What do you want to examine?", not "...to x?".
      const name = v.verbById[head.verb]?.words?.[0];
      if (head.verbWord.length === 1 && typeof name === 'string' && name.length > 1) base.verbName = name;
      return { error: 'missing-noun', ...base };
    }
    return { error: 'no-pattern', ...base };
  } catch {
    return { error: 'no-pattern', raw: typeof raw === 'string' ? raw : '' };
  }
}
