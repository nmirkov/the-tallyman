// Content linter (TT-006): rules L01–L23 of docs/ARCHITECTURE.md A13.
//
//   node tools/lint-content.js [--strict] [--allow-missing-art] [--content path/to/bundle.js]
//
// Prints `ERROR Lnn path: message` / `WARN Lnn path: message` lines and exits 1 iff any
// error. Without --content it lints src/content/index.js (default export). The pure
// `lintContent(content, options)` is exported for tests.
//
// --allow-missing-art (TT-018, until release R3): in --strict mode a room picture whose art
// is not drawn yet stays a warning (L12) instead of an error; everything else is unchanged.

import { pathToFileURL } from 'node:url';
import path from 'node:path';
import {
  ID_PATTERN, PLAYER, DIRECTIONS, DIRECTION_NAMES, COND_KEYS, VAR_OPS, REACTION_ORDER,
  REACTION_CONTROL_KEYS, TEXT_PLACEHOLDERS, TEXT_STYLES, AMBIENT_IDS, ENDING_KINDS, ART_SIZES,
  PALETTE_KEYS, ART_FX, LIMITS, MIDNIGHT_TURN,
} from '../src/engine/types.js';
import { varProblem, initialCaps } from '../src/engine/state.js';

/**
 * @typedef {{rule: string, path: string, message: string}} Finding
 * @typedef {{strict?: boolean, allowMissingArt?: boolean, hasGlyph?: (ch: string) => boolean, verbWords?: string[]}} LintOptions
 */

const ID_RE = new RegExp(ID_PATTERN);
const VAR_RE = /^[a-z][A-Za-z0-9]*$/;
const FILLERS = ['the', 'a', 'an', 'some', 'my', 'please'];
const ARTICLES = ['a', 'an', 'some', 'the', ''];
const PREFER = ['carried', 'notCarried', 'worn', 'closed', 'open', 'unlit', 'lit'];

const hasOwn = (o, k) => o != null && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const asObj = (v) => (isObj(v) ? v : {});
const asArr = (v) => (Array.isArray(v) ? v : []);
const toList = (v) => (Array.isArray(v) ? v : v === undefined ? [] : [v]);
const words = (s) => (typeof s === 'string' ? s.toLowerCase().split(/\s+/).filter(Boolean) : []);
const q = (v) => JSON.stringify(v);

/* ======================================================================== *
 *  L01 schema DSL                                                           *
 * ======================================================================== */

// A spec is a type name, or {obj, req}, {arr}, {rec}, {enum}, {any: [specs]}.
const obj = (fields, req = []) => ({ obj: fields, req });
const arr = (of) => ({ arr: of });
const rec = (of) => ({ rec: of });
const oneOf = (values) => ({ enum: values });
const any = (...specs) => ({ any: specs });

const BASIC = {
  string: (v) => typeof v === 'string',
  bool: (v) => typeof v === 'boolean',
  true: (v) => v === true,
  int: (v) => Number.isInteger(v),
  num: (v) => typeof v === 'number' && Number.isFinite(v),
  strings: (v) => Array.isArray(v) && v.every((x) => typeof x === 'string'),
  loc: (v) => v === null || typeof v === 'string',
  text: (v) => typeof v === 'string' || Array.isArray(v) || isObj(v),
  cond: (v) => typeof v === 'string' || Array.isArray(v) || isObj(v),
  reaction: (v) => typeof v === 'string' || Array.isArray(v) || isObj(v),
  fn: (v) => typeof v === 'function',
  value: (v) => v === null || ['string', 'number', 'boolean'].includes(typeof v),
};

const EXIT = any('string', obj({ to: 'string', if: 'cond', msg: 'text', door: 'string', hidden: 'bool', oneWay: 'true' }, ['to']));
const SLOTS = rec('reaction');
const SCHEMA = obj({
  meta: obj({ id: 'string', title: 'string', version: 'string' }, ['id', 'title', 'version']),
  rules: obj({
    start: 'string', intro: 'text', money: 'int', darkPicture: 'string',
    nerve: obj({
      start: 'num', dark: 'num', lit: 'num', safe: 'num', max: 'num', panicAt: 'num', panicReset: 'num',
      panicCooldown: 'int', panicText: 'text', messages: arr(obj({ at: 'int', text: 'text' }, ['at', 'text'])),
    }),
  }, ['start']),
  zones: rec(obj({
    name: 'string', safeRoom: 'string', panic: 'bool', nerveCap: 'num', capText: 'text', panicText: 'text',
    ambient: oneOf(AMBIENT_IDS),
  }, ['name'])),
  rooms: rec(obj({
    name: 'string', zone: 'string', desc: 'text', dark: 'bool', exits: rec(EXIT), picture: 'string',
    ambient: oneOf(AMBIENT_IDS), scenery: arr(obj({ names: 'strings', adjectives: 'strings', desc: 'text' }, ['names', 'desc'])),
    onEnter: 'reaction', nerve: 'num', sink: 'text', before: SLOTS, after: SLOTS,
  }, ['name', 'zone', 'desc', 'exits'])),
  items: rec(obj({
    name: 'string', names: 'strings', adjectives: 'strings', article: oneOf(ARTICLES), desc: 'text', location: 'loc',
    initial: 'text', fixed: any('true', 'text'), scenery: 'true', alsoIn: 'strings', critical: 'true',
    criticalMsg: 'text', personal: 'true', hidden: 'true', found: 'reaction', openable: 'bool', open: 'bool',
    locked: 'bool', keyId: 'string', container: obj({ capacity: 'int', supporter: 'bool', transparent: 'bool' }),
    light: obj({ lit: 'bool', fuel: 'int', needs: 'cond', needsMsg: 'text', outText: 'text' }),
    wearable: 'bool', readable: 'reaction', edible: 'reaction', drinkable: 'reaction', before: SLOTS, after: SLOTS,
  }, ['name', 'names', 'desc', 'location'])),
  npcs: rec(obj({
    name: 'string', names: 'strings', adjectives: 'strings', proper: 'bool', desc: 'text', here: 'text', location: 'loc',
    schedule: arr(obj({ at: 'int', to: 'loc', if: 'cond', leaveText: 'text', arriveText: 'text', do: 'reaction' }, ['at', 'to'])),
    topics: rec(any('reaction', 'loc')), default: 'reaction', talk: 'reaction', accepts: SLOTS, shows: SLOTS,
    refuse: 'reaction', sells: rec(obj({ price: 'int', if: 'cond', refuse: 'text', text: 'text' }, ['price'])),
    before: SLOTS, after: SLOTS,
  }, ['name', 'names', 'desc', 'location'])),
  topics: rec(obj({ names: 'strings' }, ['names'])),
  vars: rec(obj({
    type: oneOf(['int', 'bool', 'str', 'enum']), init: 'value', values: 'strings', nullable: 'bool', min: 'num', max: 'num',
  }, ['type', 'init'])),
  evidence: rec(obj({ label: 'string', item: 'string', note: 'string', award: 'string' }, ['label'])),
  notes: rec('text'),
  scoring: obj({
    maxScore: 'int', hintCost: 'int',
    awards: rec(obj({ points: 'int', label: 'string' }, ['points', 'label'])),
    ranks: arr(obj({ min: 'int', title: 'string' }, ['min', 'title'])),
  }, ['maxScore', 'awards', 'ranks']),
  hints: arr(obj({ id: 'string', done: 'cond', tiers: arr('text') }, ['id', 'done', 'tiers'])),
  endings: arr(obj({
    id: 'string', kind: oneOf(ENDING_KINDS), title: 'string', text: 'text', when: 'cond', art: 'string', music: 'string',
  }, ['id', 'kind', 'title', 'text'])),
  beats: arr(obj({ id: 'string', at: 'int', every: 'int', when: 'cond', once: 'bool', run: 'reaction' }, ['id', 'run'])),
  daemons: arr(obj({ id: 'string', run: 'reaction' }, ['id', 'run'])),
  afterAction: arr('reaction'),
  hazards: rec(obj({
    room: 'string', exit: oneOf(DIRECTIONS), verbs: 'strings', objects: 'strings', unless: 'cond', warn: 'text', ending: 'string',
  }, ['room', 'warn', 'ending'])),
  case: obj({
    culprit: 'string', threshold: 'int', suspects: 'strings', confirm: 'text', correct: 'reaction', weak: 'reaction',
    wrong: 'reaction', cancelText: 'text', other: 'reaction',
  }, ['culprit', 'threshold', 'suspects', 'confirm', 'correct', 'weak', 'wrong']),
  verbs: arr(obj({
    id: 'string', words: 'strings', patterns: 'strings', class: oneOf(['world', 'meta', 'system']), default: 'text',
    notHere: 'text', prefer: oneOf(PREFER), multi: 'bool',
  }, ['id'])),
  messages: rec('string'),
  help: 'text',
  hooks: rec('fn'),
  art: rec(obj({ id: 'string', w: 'int', h: 'int', chars: 'strings', colors: 'strings', bg: any('string', 'strings'), fx: 'strings' },
    ['id', 'w', 'h', 'chars', 'colors'])),
  stubs: rec(obj({ name: 'string', zone: 'string' }, ['name', 'zone'])),
}, ['meta', 'rules', 'zones', 'rooms', 'items', 'npcs', 'scoring', 'endings']);

/** Returns a problem description, or null. Recurses, reporting through `report`. */
function checkSpec(v, spec, p, report) {
  if (typeof spec === 'string') {
    if (!BASIC[spec](v)) report(p, `expected ${spec}, got ${v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v}`);
    return;
  }
  if (spec.enum) { if (!spec.enum.includes(v)) report(p, `expected one of ${spec.enum.map(q).join(', ')}, got ${q(v)}`); return; }
  if (spec.any) {
    const ok = spec.any.some((s) => { let bad = false; checkSpec(v, s, p, () => { bad = true; }); return !bad; });
    if (!ok) {
      // Report the detail of the object alternative when the value is an object.
      const objAlt = spec.any.find((s) => s.obj);
      if (objAlt && isObj(v)) checkSpec(v, objAlt, p, report);
      else report(p, `unexpected value ${typeof v === 'object' ? (Array.isArray(v) ? 'array' : 'object') : q(v)}`);
    }
    return;
  }
  if (spec.arr) {
    if (!Array.isArray(v)) { report(p, 'expected an array'); return; }
    v.forEach((x, i) => checkSpec(x, spec.arr, `${p}[${i}]`, report));
    return;
  }
  if (spec.rec) {
    if (!isObj(v)) { report(p, 'expected an object'); return; }
    for (const [k, x] of Object.entries(v)) checkSpec(x, spec.rec, `${p}.${k}`, report);
    return;
  }
  if (!isObj(v)) { report(p, 'expected an object'); return; }
  for (const k of spec.req) if (!hasOwn(v, k)) report(`${p}.${k}`, 'required field missing');
  for (const [k, x] of Object.entries(v)) {
    if (!hasOwn(spec.obj, k)) report(`${p}.${k}`, 'unknown field');
    else if (x !== undefined) checkSpec(x, spec.obj[k], `${p}.${k}`, report);
  }
}

/* ======================================================================== *
 *  The linter                                                               *
 * ======================================================================== */

/**
 * Lints a content bundle (A13). Never throws; never mutates the bundle.
 * @param {any} content
 * @param {LintOptions} [options]
 * @returns {{errors: Finding[], warnings: Finding[]}}
 */
export function lintContent(content, options = {}) {
  const errors = [];
  const warnings = [];
  try {
    runRules(content, options, errors, warnings);
  } catch (e) {
    errors.push({ rule: 'L01', path: 'content', message: `linter could not finish: ${e && e.message}` });
  }
  return { errors, warnings };
}

/**
 * One output line.
 * @param {'error'|'warning'} level
 * @param {Finding} f
 */
export function formatFinding(level, f) {
  return `${level === 'error' ? 'ERROR' : 'WARN'} ${f.rule} ${f.path}: ${f.message}`;
}

function runRules(content, options, errors, warnings) {
  const strict = !!options.strict;
  const err = (rule, p, message) => errors.push({ rule, path: p, message });
  const warn = (rule, p, message) => warnings.push({ rule, path: p, message });
  const strictly = (rule, p, message) => (strict ? err : warn)(rule, p, message);

  if (!isObj(content)) { err('L01', 'content', 'bundle is not an object'); return; }
  if (!isObj(content.rooms) || Object.keys(content.rooms).length === 0) {
    if (isObj(content.rooms) || content.rooms === undefined) strictly('L01', 'content', 'bundle is empty (no rooms yet); nothing else is checked');
    else err('L01', 'content.rooms', 'expected an object');
    return;
  }

  // ---------------------------------------------------------------- L01
  checkSpec(content, SCHEMA, 'content', (p, m) => err('L01', p.replace(/^content\./, ''), m));

  const rooms = Object.fromEntries(Object.entries(asObj(content.rooms)).filter(([, v]) => isObj(v)));
  const items = Object.fromEntries(Object.entries(asObj(content.items)).filter(([, v]) => isObj(v)));
  const npcs = Object.fromEntries(Object.entries(asObj(content.npcs)).filter(([, v]) => isObj(v)));
  const stubs = asObj(content.stubs);
  const zones = asObj(content.zones);
  const topics = asObj(content.topics);
  const vars = asObj(content.vars);
  const evidence = asObj(content.evidence);
  const notes = asObj(content.notes);
  const scoring = asObj(content.scoring);
  const awards = asObj(scoring.awards);
  const endings = asArr(content.endings).filter(isObj);
  const hazards = asObj(content.hazards);
  const hooks = asObj(content.hooks);
  const art = asObj(content.art);
  const rules = asObj(content.rules);

  const isRoom = (id) => hasOwn(rooms, id);
  const isStub = (id) => hasOwn(stubs, id) && !isRoom(id);
  const isItem = (id) => hasOwn(items, id);
  const isNpc = (id) => hasOwn(npcs, id);
  const isEntity = (id) => isRoom(id) || isItem(id) || isNpc(id);
  const endingIds = new Set(endings.map((e) => e.id));

  // ---------------------------------------------------------------- L02 ids
  const seen = new Map();
  for (const [table, ids] of [['rooms', Object.keys(rooms)], ['stubs', Object.keys(stubs)], ['items', Object.keys(asObj(content.items))], ['npcs', Object.keys(asObj(content.npcs))]]) {
    for (const id of ids) {
      if (!ID_RE.test(id)) err('L02', `${table}.${id}`, `id "${id}" does not match ${ID_PATTERN}`);
      if (id === PLAYER) err('L02', `${table}.${id}`, '"player" is reserved');
      if (seen.has(id)) err('L02', `${table}.${id}`, `id "${id}" already used in ${seen.get(id)}`);
      else seen.set(id, table);
    }
  }
  for (const id of Object.keys(topics)) {
    if (!ID_RE.test(id)) err('L02', `topics.${id}`, `id "${id}" does not match ${ID_PATTERN}`);
    if (seen.has(id)) err('L02', `topics.${id}`, `topic id collides with ${seen.get(id)}.${id}`);
  }
  for (const [table, ids] of [
    ['zones', Object.keys(zones)], ['scoring.awards', Object.keys(awards)], ['notes', Object.keys(notes)],
    ['evidence', Object.keys(evidence)], ['hazards', Object.keys(hazards)], ['hooks', Object.keys(hooks)], ['art', Object.keys(art)],
  ]) for (const id of ids) if (!ID_RE.test(id)) err('L02', `${table}.${id}`, `id "${id}" does not match ${ID_PATTERN}`);
  for (const table of ['endings', 'beats', 'daemons', 'hints']) {
    const ids = new Set();
    asArr(content[table]).forEach((e, i) => {
      if (!isObj(e) || typeof e.id !== 'string') return;
      if (!ID_RE.test(e.id)) err('L02', `${table}[${i}].id`, `id "${e.id}" does not match ${ID_PATTERN}`);
      if (ids.has(e.id)) err(table === 'endings' ? 'L19' : 'L02', `${table}[${i}].id`, `duplicate id "${e.id}"`);
      ids.add(e.id);
    });
  }
  for (const name of Object.keys(vars)) if (!VAR_RE.test(name)) err('L02', `vars.${name}`, `var name "${name}" is not camelCase`);

  // ---------------------------------------------------------------- reference bookkeeping
  const hookRefs = new Set();
  const flagsTested = new Map(); // flag -> first path
  const flagsSet = new Set();
  const awardRefs = new Set();
  const endingRefs = new Set();
  const producers = new Set(); // items some reaction / shop puts into the world

  /** Where an item may be: room, container item, NPC, player or null. Reports L03/L14. */
  const checkItemLoc = (loc, p) => {
    if (loc === null || loc === PLAYER || isRoom(loc) || isNpc(loc)) return;
    if (isStub(loc)) { err('L14', p, `stub "${loc}" used outside an exit target`); return; }
    if (isItem(loc)) { if (!items[loc].container) err('L03', p, `"${loc}" is not a container`); return; }
    err('L03', p, `unknown location ${q(loc)}`);
  };
  const checkRoomRef = (id, p, { allowNull = false } = {}) => {
    if (allowNull && id === null) return;
    if (isRoom(id)) return;
    if (isStub(id)) err('L14', p, `stub "${id}" used outside an exit target`);
    else err('L03', p, `unknown room ${q(id)}`);
  };
  const ref = (ok, p, what, id) => { if (!ok) err('L03', p, `unknown ${what} ${q(id)}`); };

  // ---------------------------------------------------------------- Text / Cond / Reaction walkers (L03, L04, L15, L22)
  const checkPlaceholders = (s, p) => {
    for (const m of s.matchAll(/\{([^{}]*)\}/g)) {
      if (!TEXT_PLACEHOLDERS.includes(m[1])) err('L04', p, `unknown placeholder {${m[1]}}`);
    }
  };
  const flagName = (name, p) => { if (typeof name !== 'string' || !ID_RE.test(name)) err('L02', p, `flag name ${q(name)} does not match ${ID_PATTERN}`); };
  const testFlag = (name, p) => { flagName(name, p); if (!flagsTested.has(name)) flagsTested.set(name, p); };

  function walkText(t, p) {
    if (typeof t === 'string') { checkPlaceholders(t, p); return; }
    if (Array.isArray(t)) {
      if (t.length === 0) { err('L04', p, 'empty Text variant list'); return; }
      t.forEach((v, i) => {
        const vp = `${p}[${i}]`;
        if (!isObj(v) || typeof v.text !== 'string') { err('L04', vp, 'Text variant needs a string "text"'); return; }
        for (const k of Object.keys(v)) if (k !== 'if' && k !== 'text') err('L04', `${vp}.${k}`, 'unknown Text variant field');
        if (hasOwn(v, 'if')) walkCond(v.if, `${vp}.if`);
        checkPlaceholders(v.text, `${vp}.text`);
      });
      if (isObj(t[t.length - 1]) && hasOwn(t[t.length - 1], 'if')) warn('L04', `${p}[${t.length - 1}]`, 'last Text variant has an "if" (nothing renders when no variant matches)');
      return;
    }
    if (isObj(t) && Object.keys(t).length === 1 && typeof t.hook === 'string') { hookRefs.add(t.hook); checkHook(t.hook, `${p}.hook`); return; }
    err('L04', p, 'invalid Text (string, variants or {hook})');
  }

  const checkHook = (id, p) => { if (!hasOwn(hooks, id)) err('L15', p, `hook "${id}" is not defined`); };

  function walkCond(c, p) {
    if (typeof c === 'string') { testFlag(c.startsWith('!') ? c.slice(1) : c, p); return; }
    if (Array.isArray(c)) { c.forEach((x, i) => walkCond(x, `${p}[${i}]`)); return; }
    if (!isObj(c)) { err('L04', p, `invalid condition ${q(c)}`); return; }
    const keys = Object.keys(c);
    if (keys.includes('var')) {
      const op = keys.find((k) => k !== 'var');
      if (keys.length !== 2 || !VAR_OPS.includes(op)) { err('L04', p, `"var" needs exactly one of ${VAR_OPS.join(', ')}; got keys ${keys.join(', ')}`); return; }
      const decl = vars[c.var];
      if (!isObj(decl)) { err('L03', `${p}.var`, `unknown var ${q(c.var)}`); return; }
      const values = op === 'oneOf' ? toList(c.oneOf) : ['eq', 'ne'].includes(op) ? [c[op]] : [];
      if (op === 'oneOf' && !Array.isArray(c.oneOf)) err('L04', `${p}.oneOf`, 'expected an array');
      for (const v of values) { const prob = varProblem(decl, v); if (prob) err('L04', `${p}.${op}`, `${q(v)} can never match var ${c.var}: ${prob}`); }
      if (['gt', 'gte', 'lt', 'lte'].includes(op) && typeof c[op] !== 'number') err('L04', `${p}.${op}`, 'expected a number');
      return;
    }
    if (keys.length !== 1) { err('L04', p, `a condition has exactly one key; got ${keys.join(', ') || 'none'}`); return; }
    const [k] = keys;
    const v = c[k];
    const kp = `${p}.${k}`;
    if (!COND_KEYS.includes(k)) { err('L04', kp, `unknown condition key "${k}"`); return; }
    switch (k) {
      case 'all': case 'any':
        if (!Array.isArray(v)) err('L04', kp, 'expected an array'); else v.forEach((x, i) => walkCond(x, `${kp}[${i}]`));
        break;
      case 'not': walkCond(v, kp); break;
      case 'flag': testFlag(v, kp); break;
      case 'in': toList(v).forEach((r) => checkRoomRef(r, kp)); break;
      case 'zone': ref(hasOwn(zones, v), kp, 'zone', v); break;
      case 'carried': case 'open': case 'locked': case 'on': ref(isItem(v), kp, 'item', v); break;
      case 'present': ref(isItem(v) || isNpc(v), kp, 'item or NPC', v); break;
      case 'at':
        if (!Array.isArray(v) || v.length !== 2) { err('L04', kp, 'expected [id, location]'); break; }
        if (isNpc(v[0])) checkRoomRef(v[1], `${kp}[1]`, { allowNull: true });
        else if (isItem(v[0])) checkItemLoc(v[1], `${kp}[1]`);
        else err('L03', `${kp}[0]`, `unknown item or NPC ${q(v[0])}`);
        break;
      case 'visited': checkRoomRef(v, kp); break;
      case 'turnGte': case 'turnLt':
        if (isObj(v)) {
          if (Object.keys(v).length !== 1 || typeof v.var !== 'string') err('L04', kp, 'expected a number or {var}');
          else if (!isObj(vars[v.var])) err('L03', `${kp}.var`, `unknown var ${q(v.var)}`);
          else if (vars[v.var].type !== 'int') err('L04', `${kp}.var`, `var ${v.var} is not an int`);
        } else if (!Number.isInteger(v)) err('L04', kp, 'expected an integer or {var}');
        break;
      case 'evidence': case 'moneyGte': case 'nerveGte': if (!Number.isFinite(v)) err('L04', kp, 'expected a finite number'); break;
      case 'found': ref(hasOwn(evidence, v), kp, 'evidence', v); break;
      case 'noted': ref(hasOwn(notes, v), kp, 'note', v); break;
      case 'awarded': ref(hasOwn(awards, v), kp, 'award', v); if (hasOwn(awards, v)) awardRefs.add(v); break;
      case 'lit': if (typeof v !== 'boolean') err('L04', kp, 'expected a boolean'); break;
      case 'hook': hookRefs.add(v); checkHook(v, kp); break;
      default: break;
    }
  }

  const REACTION_KEYS = [...REACTION_ORDER, ...REACTION_CONTROL_KEYS];
  function walkReaction(r, p) {
    if (typeof r === 'string') { walkText(r, p); return; }
    if (Array.isArray(r)) { r.forEach((x, i) => walkReaction(x, `${p}[${i}]`)); return; }
    if (!isObj(r)) { err('L04', p, `invalid reaction ${q(r)}`); return; }
    for (const k of Object.keys(r)) if (!REACTION_KEYS.includes(k)) err('L04', `${p}.${k}`, `unknown reaction key "${k}"`);
    const kp = (k) => `${p}.${k}`;
    if (hasOwn(r, 'if')) walkCond(r.if, kp('if'));
    if (hasOwn(r, 'else')) walkReaction(r.else, kp('else'));
    if (hasOwn(r, 'chance') && !(Number.isFinite(r.chance) && r.chance >= 0 && r.chance <= 1)) err('L04', kp('chance'), 'expected a number 0..1');
    if (hasOwn(r, 'style') && !TEXT_STYLES.includes(r.style)) err('L04', kp('style'), `unknown style ${q(r.style)}`);
    if (hasOwn(r, 'continue') && typeof r.continue !== 'boolean') err('L04', kp('continue'), 'expected a boolean');
    for (const k of ['sfx', 'music']) if (hasOwn(r, k) && typeof r[k] !== 'string') err('L04', kp(k), 'expected a string');
    // Finite only: Infinity / NaN would reach state (or an event) and make saves unloadable.
    for (const k of ['pause', 'money', 'nerve']) if (hasOwn(r, k) && !Number.isFinite(r[k])) err('L04', kp(k), 'expected a finite number');
    if (hasOwn(r, 'say')) walkText(r.say, kp('say'));
    if (hasOwn(r, 'pick')) {
      if (!Array.isArray(r.pick) || r.pick.length === 0) err('L04', kp('pick'), 'expected a non-empty array of Text');
      else r.pick.forEach((t, i) => walkText(t, `${kp('pick')}[${i}]`));
    }
    if (hasOwn(r, 'setFlag')) toList(r.setFlag).forEach((f) => { flagName(f, kp('setFlag')); flagsSet.add(f); });
    if (hasOwn(r, 'clearFlag')) toList(r.clearFlag).forEach((f) => flagName(f, kp('clearFlag')));
    if (hasOwn(r, 'setVar')) {
      if (!isObj(r.setVar)) err('L04', kp('setVar'), 'expected an object');
      else for (const [name, val] of Object.entries(r.setVar)) {
        const vp = `${kp('setVar')}.${name}`;
        const decl = vars[name];
        if (!isObj(decl)) { err('L03', vp, `unknown var ${q(name)}`); continue; }
        if (isObj(val)) {
          const [op] = Object.keys(val);
          if (Object.keys(val).length !== 1 || !['add', 'turnPlus'].includes(op) || !Number.isInteger(val[op])) err('L04', vp, 'expected a value, {add: n} or {turnPlus: n} (n an integer)');
          else if (decl.type !== 'int') err('L04', vp, `{${op}} needs an int var; ${name} is ${decl.type}`);
        } else {
          const prob = varProblem(decl, val);
          if (prob) err('L04', vp, `${q(val)} does not fit var ${name}: ${prob}`);
        }
      }
    }
    if (hasOwn(r, 'setItem')) {
      if (!isObj(r.setItem)) err('L04', kp('setItem'), 'expected an object');
      else for (const [id, patch] of Object.entries(r.setItem)) {
        const ip = `${kp('setItem')}.${id}`;
        if (!isItem(id)) { err('L03', ip, `unknown item ${q(id)}`); continue; }
        const caps = initialCaps(items[id]);
        for (const [f, val] of Object.entries(asObj(patch))) {
          if (!hasOwn(caps, f)) err('L04', `${ip}.${f}`, `item ${id} has no "${f}" state`);
          else if (f === 'fuel' ? !(Number.isInteger(val) && val >= 0) : typeof val !== 'boolean') err('L04', `${ip}.${f}`, 'wrong type');
        }
      }
    }
    if (hasOwn(r, 'setNpc')) {
      for (const [id, patch] of Object.entries(asObj(r.setNpc))) {
        if (!isNpc(id)) err('L03', `${kp('setNpc')}.${id}`, `unknown NPC ${q(id)}`);
        if (!isObj(patch) || Object.keys(patch).join() !== 'state' || !(patch.state === null || typeof patch.state === 'string')) err('L04', `${kp('setNpc')}.${id}`, 'expected {state: string|null}');
      }
    }
    if (hasOwn(r, 'reveal')) toList(r.reveal).forEach((id) => ref(isItem(id), kp('reveal'), 'item', id));
    if (hasOwn(r, 'move')) {
      if (!isObj(r.move)) err('L04', kp('move'), 'expected an object');
      else for (const [id, loc] of Object.entries(r.move)) {
        const mp = `${kp('move')}.${id}`;
        if (isItem(id)) {
          checkItemLoc(loc, mp);
          if (loc !== null) producers.add(id);
          else if (items[id].critical) warn('L18', mp, `moves critical item ${id} out of the world`);
        } else if (isNpc(id)) checkRoomRef(loc, mp, { allowNull: true });
        else err('L03', mp, `unknown item or NPC ${q(id)}`);
      }
    }
    if (hasOwn(r, 'give')) toList(r.give).forEach((id) => { ref(isItem(id), kp('give'), 'item', id); producers.add(id); });
    if (hasOwn(r, 'note')) ref(hasOwn(notes, r.note), kp('note'), 'note', r.note);
    if (hasOwn(r, 'evidence')) ref(hasOwn(evidence, r.evidence), kp('evidence'), 'evidence', r.evidence);
    if (hasOwn(r, 'award')) { ref(hasOwn(awards, r.award), kp('award'), 'award', r.award); awardRefs.add(r.award); }
    if (hasOwn(r, 'movePlayer')) checkRoomRef(r.movePlayer, kp('movePlayer'));
    if (hasOwn(r, 'hook')) { hookRefs.add(r.hook); checkHook(r.hook, kp('hook')); }
    if (hasOwn(r, 'then')) walkReaction(r.then, kp('then'));
    if (hasOwn(r, 'end')) { ref(endingIds.has(r.end), kp('end'), 'ending', r.end); endingRefs.add(r.end); }
  }

  const slots = (o, p) => { for (const [verb, r] of Object.entries(asObj(o))) walkReaction(r, `${p}.${verb}`); };
  const maybe = (o, k, fn, p) => { if (o && hasOwn(o, k) && o[k] !== undefined) fn(o[k], `${p}.${k}`); };

  // ---------------------------------------------------------------- walk every slot
  maybe(rules, 'intro', walkText, 'rules');
  const nerveRules = asObj(rules.nerve);
  asArr(nerveRules.messages).forEach((m, i) => maybe(m, 'text', walkText, `rules.nerve.messages[${i}]`));
  maybe(nerveRules, 'panicText', walkText, 'rules.nerve');
  checkRoomRef(rules.start, 'rules.start');
  if (hasOwn(rules, 'darkPicture')) ref(hasOwn(art, rules.darkPicture), 'rules.darkPicture', 'art', rules.darkPicture);

  for (const [id, z] of Object.entries(zones)) {
    if (!isObj(z)) continue;
    maybe(z, 'capText', walkText, `zones.${id}`);
    maybe(z, 'panicText', walkText, `zones.${id}`);
    if (hasOwn(z, 'safeRoom')) checkRoomRef(z.safeRoom, `zones.${id}.safeRoom`);
  }

  for (const [id, room] of Object.entries(rooms)) {
    const p = `rooms.${id}`;
    maybe(room, 'desc', walkText, p);
    maybe(room, 'sink', walkText, p);
    maybe(room, 'onEnter', walkReaction, p);
    slots(room.before, `${p}.before`);
    slots(room.after, `${p}.after`);
    asArr(room.scenery).forEach((s, i) => maybe(s, 'desc', walkText, `${p}.scenery[${i}]`));
    for (const [dir, raw] of Object.entries(asObj(room.exits))) {
      const ep = `${p}.exits.${dir}`;
      const exit = typeof raw === 'string' ? { to: raw } : asObj(raw);
      if (!isRoom(exit.to) && !isStub(exit.to)) err('L03', ep, `exit to unknown room ${q(exit.to)}`);
      if (hasOwn(exit, 'door')) {
        if (!isItem(exit.door)) err('L03', `${ep}.door`, `unknown item ${q(exit.door)}`);
        else if (!items[exit.door].openable) err('L03', `${ep}.door`, `door item "${exit.door}" is not openable`);
      }
      maybe(exit, 'if', walkCond, ep);
      maybe(exit, 'msg', walkText, ep);
    }
  }

  for (const [id, it] of Object.entries(items)) {
    const p = `items.${id}`;
    for (const k of ['desc', 'initial', 'criticalMsg']) maybe(it, k, walkText, p);
    if (hasOwn(it, 'fixed') && it.fixed !== true) walkText(it.fixed, `${p}.fixed`);
    for (const k of ['found', 'readable', 'edible', 'drinkable']) maybe(it, k, walkReaction, p);
    slots(it.before, `${p}.before`);
    slots(it.after, `${p}.after`);
    const light = asObj(it.light);
    maybe(light, 'needs', walkCond, `${p}.light`);
    maybe(light, 'needsMsg', walkText, `${p}.light`);
    maybe(light, 'outText', walkText, `${p}.light`);
    if (hasOwn(it, 'location')) checkItemLoc(it.location, `${p}.location`);
    asArr(it.alsoIn).forEach((r, i) => checkRoomRef(r, `${p}.alsoIn[${i}]`));
    if (hasOwn(it, 'keyId')) ref(isItem(it.keyId), `${p}.keyId`, 'item', it.keyId);
  }

  for (const [id, npc] of Object.entries(npcs)) {
    const p = `npcs.${id}`;
    maybe(npc, 'desc', walkText, p);
    maybe(npc, 'here', walkText, p);
    for (const k of ['default', 'talk', 'refuse']) maybe(npc, k, walkReaction, p);
    for (const [t, r] of Object.entries(asObj(npc.topics))) {
      if (!hasOwn(topics, t) && !isItem(t) && !isNpc(t)) err('L03', `${p}.topics.${t}`, `unknown topic ${q(t)}`);
      if (r !== null) walkReaction(r, `${p}.topics.${t}`);
    }
    for (const table of ['accepts', 'shows']) {
      for (const [itemId, r] of Object.entries(asObj(npc[table]))) {
        ref(isItem(itemId), `${p}.${table}.${itemId}`, 'item', itemId);
        walkReaction(r, `${p}.${table}.${itemId}`);
      }
    }
    for (const [itemId, sell] of Object.entries(asObj(npc.sells))) {
      const sp = `${p}.sells.${itemId}`;
      ref(isItem(itemId), sp, 'item', itemId);
      producers.add(itemId);
      maybe(sell, 'if', walkCond, sp);
      maybe(sell, 'refuse', walkText, sp);
      maybe(sell, 'text', walkText, sp);
    }
    slots(npc.before, `${p}.before`);
    slots(npc.after, `${p}.after`);
    if (hasOwn(npc, 'location')) checkRoomRef(npc.location, `${p}.location`, { allowNull: true });
    asArr(npc.schedule).forEach((s, i) => {
      const sp = `${p}.schedule[${i}]`;
      if (!isObj(s)) return;
      if (hasOwn(s, 'to')) checkRoomRef(s.to, `${sp}.to`, { allowNull: true });
      maybe(s, 'if', walkCond, sp);
      maybe(s, 'leaveText', walkText, sp);
      maybe(s, 'arriveText', walkText, sp);
      maybe(s, 'do', walkReaction, sp);
      if (!(Number.isInteger(s.at) && s.at >= 1 && s.at <= MIDNIGHT_TURN)) err('L20', `${sp}.at`, `must be an integer 1..${MIDNIGHT_TURN}`);
    });
  }

  for (const [id, t] of Object.entries(notes)) walkText(t, `notes.${id}`);
  for (const [id, ev] of Object.entries(evidence)) {
    if (!isObj(ev)) continue;
    const p = `evidence.${id}`;
    if (hasOwn(ev, 'item')) ref(isItem(ev.item), `${p}.item`, 'item', ev.item);
    if (hasOwn(ev, 'note')) ref(hasOwn(notes, ev.note), `${p}.note`, 'note', ev.note);
    if (hasOwn(ev, 'award')) { ref(hasOwn(awards, ev.award), `${p}.award`, 'award', ev.award); awardRefs.add(ev.award); }
  }

  // L23 hints
  asArr(content.hints).forEach((h, i) => {
    const p = `hints[${i}]`;
    if (!isObj(h)) return;
    if (!hasOwn(h, 'done')) err('L23', `${p}.done`, 'hint step needs a "done" condition');
    else walkCond(h.done, `${p}.done`);
    if (!Array.isArray(h.tiers) || h.tiers.length === 0) err('L23', `${p}.tiers`, 'hint step needs at least one tier');
    else h.tiers.forEach((t, j) => walkText(t, `${p}.tiers[${j}]`));
  });

  endings.forEach((e, i) => {
    maybe(e, 'text', walkText, `endings[${i}]`);
    maybe(e, 'when', walkCond, `endings[${i}]`);
    if (hasOwn(e, 'art')) {
      if (!hasOwn(art, e.art)) err('L03', `endings[${i}].art`, `unknown art ${q(e.art)}`);
      else if (isObj(art[e.art]) && art[e.art].h !== ART_SIZES.screen.h) err('L11', `endings[${i}].art`, `ending art must be ${ART_SIZES.screen.w}x${ART_SIZES.screen.h}`);
    }
  });

  // L20 beats
  asArr(content.beats).forEach((b, i) => {
    const p = `beats[${i}]`;
    if (!isObj(b)) return;
    maybe(b, 'when', walkCond, p);
    maybe(b, 'run', walkReaction, p);
    if (!hasOwn(b, 'at') && !hasOwn(b, 'every') && !hasOwn(b, 'when')) err('L20', p, 'beat needs at least one of at / every / when');
    for (const k of ['at', 'every']) {
      if (hasOwn(b, k) && !(Number.isInteger(b[k]) && b[k] >= 1 && b[k] <= MIDNIGHT_TURN)) err('L20', `${p}.${k}`, `must be an integer 1..${MIDNIGHT_TURN}`);
    }
  });
  asArr(content.daemons).forEach((d, i) => maybe(d, 'run', walkReaction, `daemons[${i}]`));
  asArr(content.afterAction).forEach((r, i) => walkReaction(r, `afterAction[${i}]`));

  for (const [id, h] of Object.entries(hazards)) {
    if (!isObj(h)) continue;
    const p = `hazards.${id}`;
    checkRoomRef(h.room, `${p}.room`);
    ref(endingIds.has(h.ending), `${p}.ending`, 'ending', h.ending);
    endingRefs.add(h.ending);
    maybe(h, 'unless', walkCond, p);
    maybe(h, 'warn', walkText, p);
    asArr(h.objects).forEach((o, j) => ref(isEntity(o), `${p}.objects[${j}]`, 'entity', o));
    if (!hasOwn(h, 'exit') && !hasOwn(h, 'verbs')) err('L03', p, 'hazard needs an exit or verbs');
    if (hasOwn(h, 'exit') && isRoom(h.room) && !hasOwn(asObj(rooms[h.room].exits), h.exit)) err('L03', `${p}.exit`, `room ${h.room} has no exit ${q(h.exit)}`);
  }

  if (isObj(content.case)) {
    const c = content.case;
    ref(isNpc(c.culprit), 'case.culprit', 'NPC', c.culprit);
    asArr(c.suspects).forEach((s, i) => ref(isNpc(s), `case.suspects[${i}]`, 'NPC', s));
    for (const k of ['confirm', 'cancelText']) maybe(c, k, walkText, 'case');
    for (const k of ['correct', 'weak', 'wrong', 'other']) maybe(c, k, walkReaction, 'case');
  }
  asArr(content.verbs).forEach((v, i) => {
    for (const k of ['default', 'notHere']) maybe(v, k, walkText, `verbs[${i}]`);
  });
  maybe(content, 'help', walkText, 'content');

  // ---------------------------------------------------------------- L05 / L06 exits
  for (const [id, room] of Object.entries(rooms)) {
    for (const [dir, raw] of Object.entries(asObj(room.exits))) {
      const ep = `rooms.${id}.exits.${dir}`;
      if (!DIRECTIONS.includes(dir)) { err('L05', ep, `unknown direction "${dir}"`); continue; }
      const exit = typeof raw === 'string' ? { to: raw } : asObj(raw);
      if (exit.oneWay) {
        if (!Object.values(hazards).some((h) => isObj(h) && h.room === id && h.exit === dir)) err('L06', ep, 'one-way exit without a hazard on this room and direction');
        continue;
      }
      if (!isRoom(exit.to)) continue;
      const back = Object.values(asObj(rooms[exit.to].exits)).some((x) => (typeof x === 'string' ? x : asObj(x).to) === id);
      if (!back) err('L05', ep, `no exit back from ${exit.to}`);
    }
  }

  // ---------------------------------------------------------------- L07 reachability
  const reachable = new Set();
  if (isRoom(rules.start)) {
    const queue = [rules.start];
    reachable.add(rules.start);
    while (queue.length) {
      const r = queue.shift();
      for (const raw of Object.values(asObj(rooms[r].exits))) {
        const to = typeof raw === 'string' ? raw : asObj(raw).to;
        if (isRoom(to) && !reachable.has(to)) { reachable.add(to); queue.push(to); }
      }
    }
    for (const id of Object.keys(rooms)) if (!reachable.has(id)) err('L07', `rooms.${id}`, `not reachable from ${rules.start}`);
  }

  // ---------------------------------------------------------------- L08 critical items obtainable
  /** Start room of an item's location chain, 'player', or null. */
  const startRoom = (id) => {
    let loc = items[id].location;
    for (let steps = 0; steps <= Object.keys(items).length; steps++) {
      if (loc === PLAYER || loc === null || loc === undefined) return loc ?? null;
      if (isItem(loc)) loc = items[loc].location;
      else if (isNpc(loc)) loc = npcs[loc].location;
      else return loc;
    }
    return null;
  };
  for (const [id, it] of Object.entries(items)) {
    if (!it.critical) continue;
    const room = startRoom(id);
    const inWorld = room === PLAYER || (room && reachable.has(room)) || asArr(it.alsoIn).some((r) => reachable.has(r));
    if (!inWorld && !producers.has(id)) err('L08', `items.${id}`, 'critical item is not obtainable (not in a reachable room, and nothing gives, moves or sells it)');
  }

  // ---------------------------------------------------------------- L09 glyphs (all static strings except art)
  const glyphOk = (ch) => ch === '\n' || ch === '£' || (ch >= ' ' && ch <= '~');
  const walkStrings = (v, p) => {
    if (typeof v === 'string') {
      for (const ch of v) {
        if (!glyphOk(ch)) { err('L09', p, `invalid character ${q(ch)} (U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}); use ASCII, \\n and £ only`); break; }
      }
    } else if (Array.isArray(v)) v.forEach((x, i) => walkStrings(x, `${p}[${i}]`));
    else if (isObj(v)) for (const [k, x] of Object.entries(v)) walkStrings(x, p ? `${p}.${k}` : k);
  };
  for (const [k, v] of Object.entries(content)) if (k !== 'art' && k !== 'hooks') walkStrings(v, k);

  // ---------------------------------------------------------------- L10 description length
  for (const [id, room] of Object.entries(rooms)) {
    const variants = typeof room.desc === 'string' ? [[room.desc, `rooms.${id}.desc`]]
      : asArr(room.desc).map((v, i) => [asObj(v).text, `rooms.${id}.desc[${i}].text`]);
    for (const [text, p] of variants) {
      if (typeof text === 'string' && text.length > LIMITS.roomDesc) err('L10', p, `description is ${text.length} characters (max ${LIMITS.roomDesc})`);
    }
  }

  // ---------------------------------------------------------------- L11 art
  const glyphFn = typeof options.hasGlyph === 'function' ? options.hasGlyph
    : (ch) => glyphOk(ch) || (ch.codePointAt(0) >= 0x2500 && ch.codePointAt(0) <= 0x259f);
  const sizes = Object.values(ART_SIZES);
  const isKey = (ch) => ch.length === 1 && PALETTE_KEYS.includes(ch);
  for (const [id, a] of Object.entries(art)) {
    const p = `art.${id}`;
    if (!isObj(a)) continue;
    if (a.id !== id) err('L11', `${p}.id`, `art id ${q(a.id)} differs from its key "${id}"`);
    if (!sizes.some((s) => s.w === a.w && s.h === a.h)) { err('L11', p, `size ${a.w}x${a.h} is not one of ${sizes.map((s) => `${s.w}x${s.h}`).join(', ')}`); continue; }
    const grid = (rows, name, cellOk, cellMsg) => {
      if (!Array.isArray(rows) || rows.length !== a.h) { err('L11', `${p}.${name}`, `expected ${a.h} rows`); return; }
      rows.forEach((row, y) => {
        const cells = Array.from(typeof row === 'string' ? row : '');
        if (cells.length !== a.w) { err('L11', `${p}.${name}[${y}]`, `row is ${cells.length} characters, expected ${a.w}`); return; }
        const bad = cells.find((ch) => !cellOk(ch));
        if (bad !== undefined) err('L11', `${p}.${name}[${y}]`, `${cellMsg} ${q(bad)}`);
      });
    };
    grid(a.chars, 'chars', glyphFn, 'no font glyph for');
    grid(a.colors, 'colors', isKey, 'invalid colour key');
    if (hasOwn(a, 'bg')) {
      if (typeof a.bg === 'string') { if (!isKey(a.bg)) err('L11', `${p}.bg`, `invalid colour key ${q(a.bg)}`); }
      else grid(a.bg, 'bg', isKey, 'invalid colour key');
    }
    asArr(a.fx).forEach((fx, i) => { if (!ART_FX.includes(fx)) err('L11', `${p}.fx[${i}]`, `unknown effect ${q(fx)}`); });
  }

  // ---------------------------------------------------------------- L12 room pictures
  for (const [id, room] of Object.entries(rooms)) {
    const p = `rooms.${id}`;
    if (!hasOwn(room, 'picture')) strictly('L12', p, 'no picture');
    else if (!hasOwn(art, room.picture)) (options.allowMissingArt ? warn : strictly)('L12', `${p}.picture`, `art ${q(room.picture)} does not exist (falls back to no picture)`);
    else if (isObj(art[room.picture]) && art[room.picture].h !== ART_SIZES.location.h) err('L11', `${p}.picture`, `room art must be ${ART_SIZES.location.w}x${ART_SIZES.location.h}`);
  }

  // ---------------------------------------------------------------- L13 indistinguishable references
  const entities = [];
  const nounSet = (names) => new Set(asArr(names).flatMap(words));
  const entity = (p, names, adjectives, name, portable, inRooms) => {
    const nouns = nounSet(names);
    const adjs = new Set([...asArr(adjectives).flatMap(words), ...words(name).filter((w) => !nouns.has(w))]);
    entities.push({ p, nouns, adjs, portable, rooms: new Set(inRooms.filter(Boolean)) });
  };
  for (const [id, it] of Object.entries(items)) {
    const portable = !it.fixed && !it.scenery;
    const r = startRoom(id);
    entity(`items.${id}`, it.names, it.adjectives, it.name, portable, [r === PLAYER ? null : r, ...asArr(it.alsoIn)]);
  }
  for (const [id, n] of Object.entries(npcs)) {
    entity(`npcs.${id}`, n.names, n.adjectives, n.name, false, [n.location, ...asArr(n.schedule).map((s) => asObj(s).to)]);
  }
  for (const [id, room] of Object.entries(rooms)) {
    asArr(room.scenery).forEach((s, i) => { if (isObj(s)) entity(`rooms.${id}.scenery[${i}]`, s.names, s.adjectives, '', false, [id]); });
  }
  const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const a = entities[i];
      const b = entities[j];
      const shareScope = a.portable || b.portable || [...a.rooms].some((r) => b.rooms.has(r));
      const shared = [...a.nouns].filter((w) => b.nouns.has(w));
      if (shareScope && shared.length && sameSet(a.adjs, b.adjs)) {
        err('L13', b.p, `indistinguishable from ${a.p}: both answer to "${shared[0]}" with the same adjectives [${[...a.adjs].join(', ')}]`);
      }
    }
  }

  // ---------------------------------------------------------------- L14 stubs
  for (const [id, s] of Object.entries(stubs)) {
    strictly('L14', `stubs.${id}`, strict ? 'stubs are not allowed in --strict mode' : `stub room "${asObj(s).name ?? id}" (incremental build)`);
  }

  // ---------------------------------------------------------------- L15 hooks defined but unused
  for (const id of Object.keys(hooks)) if (!hookRefs.has(id)) warn('L15', `hooks.${id}`, 'hook is never referenced');

  // ---------------------------------------------------------------- L16 zones
  for (const [id, room] of Object.entries(rooms)) if (!hasOwn(zones, room.zone)) err('L16', `rooms.${id}.zone`, `unknown zone ${q(room.zone)}`);
  for (const [id, s] of Object.entries(stubs)) if (isObj(s) && !hasOwn(zones, s.zone)) err('L16', `stubs.${id}.zone`, `unknown zone ${q(s.zone)}`);
  for (const [id, z] of Object.entries(zones)) {
    if (!isObj(z) || z.panic === false) continue;
    const p = `zones.${id}.safeRoom`;
    if (!hasOwn(z, 'safeRoom')) { err('L16', p, 'a zone with panic needs a safeRoom'); continue; }
    const room = rooms[z.safeRoom];
    if (!isObj(room)) continue; // L03 already reported
    if (room.zone !== id) err('L16', p, `safe room ${z.safeRoom} is in zone ${q(room.zone)}, not ${id}`);
    if (room.dark) err('L16', p, `safe room ${z.safeRoom} is dark`);
    if (Object.values(hazards).some((h) => isObj(h) && h.room === z.safeRoom)) err('L16', p, `safe room ${z.safeRoom} has a hazard`);
  }

  // ---------------------------------------------------------------- L17 scoring
  if (isObj(content.scoring)) {
    const sum = Object.values(awards).reduce((n, a) => n + (Number.isInteger(asObj(a).points) ? a.points : 0), 0);
    if (sum !== scoring.maxScore) err('L17', 'scoring.maxScore', `maxScore ${scoring.maxScore} but award points sum to ${sum}`);
    const ranks = asArr(scoring.ranks).filter(isObj);
    if (!ranks.length) err('L17', 'scoring.ranks', 'at least one rank is required');
    else {
      if (ranks[0].min !== 0) err('L17', 'scoring.ranks[0].min', 'first rank must start at 0');
      if (ranks[ranks.length - 1].min !== scoring.maxScore) err('L17', `scoring.ranks[${ranks.length - 1}].min`, `last rank must start at maxScore (${scoring.maxScore})`);
      for (let i = 1; i < ranks.length; i++) if (!(ranks[i].min > ranks[i - 1].min)) err('L17', `scoring.ranks[${i}].min`, 'ranks must be strictly ascending');
    }
    for (const id of Object.keys(awards)) if (!awardRefs.has(id)) warn('L17', `scoring.awards.${id}`, 'award is never given');
  }

  // ---------------------------------------------------------------- L18 personal / critical
  for (const [id, it] of Object.entries(items)) {
    const p = `items.${id}`;
    if (it.personal && it.location !== PLAYER) err('L18', `${p}.location`, 'personal items must start on the player');
    if (it.critical && (hasOwn(it, 'edible') || hasOwn(it, 'drinkable'))) err('L18', p, 'critical items cannot be edible or drinkable');
    const fuel = asObj(it.light).fuel;
    if (it.critical && fuel !== undefined && !(fuel >= MIDNIGHT_TURN)) err('L18', `${p}.light.fuel`, `critical light source needs no fuel limit or fuel >= ${MIDNIGHT_TURN}`);
  }
  for (const [id, npc] of Object.entries(npcs)) {
    for (const table of ['accepts', 'sells']) {
      for (const itemId of Object.keys(asObj(npc[table]))) {
        if (items[itemId]?.personal) err('L18', `npcs.${id}.${table}.${itemId}`, 'personal items cannot be accepted or sold');
      }
    }
  }

  // ---------------------------------------------------------------- L19 endings
  const whenEndings = endings.filter((e) => hasOwn(e, 'when'));
  const last = whenEndings[whenEndings.length - 1];
  const isCatchAll = (w) => isObj(w) && Object.keys(w).length === 1 && w.turnGte === MIDNIGHT_TURN;
  if (!last || !isCatchAll(last.when)) err('L19', 'endings', `the last ending with "when" must be the catch-all {turnGte: ${MIDNIGHT_TURN}}`);
  endings.forEach((e, i) => {
    if (!hasOwn(e, 'when') && !endingRefs.has(e.id)) warn('L19', `endings[${i}]`, `ending "${e.id}" has no "when" and nothing ends with it`);
  });

  // ---------------------------------------------------------------- L21 words that clash with parser words
  const dirWords = new Set([...DIRECTIONS, ...Object.values(DIRECTION_NAMES), 'inside', 'outside']);
  const verbWords = new Set([...asArr(options.verbWords), ...asArr(content.verbs).flatMap((v) => asArr(asObj(v).words))]
    .filter((w) => typeof w === 'string' && !w.includes(' ')).map((w) => w.toLowerCase()));
  const clash = (w) => (dirWords.has(w) ? 'a direction' : FILLERS.includes(w) ? 'a filler word' : verbWords.has(w) ? 'a verb word' : null);
  const checkWords = (list, p, kind) => asArr(list).forEach((entry, i) => {
    for (const w of words(entry)) { const c = clash(w); if (c) warn('L21', `${p}[${i}]`, `${kind} "${w}" is ${c}`); }
  });
  for (const [id, it] of Object.entries(items)) { checkWords(it.names, `items.${id}.names`, 'noun'); checkWords(it.adjectives, `items.${id}.adjectives`, 'adjective'); }
  for (const [id, n] of Object.entries(npcs)) { checkWords(n.names, `npcs.${id}.names`, 'noun'); checkWords(n.adjectives, `npcs.${id}.adjectives`, 'adjective'); }
  for (const [id, room] of Object.entries(rooms)) {
    asArr(room.scenery).forEach((s, i) => {
      checkWords(asObj(s).names, `rooms.${id}.scenery[${i}].names`, 'noun');
      checkWords(asObj(s).adjectives, `rooms.${id}.scenery[${i}].adjectives`, 'adjective');
    });
  }

  // ---------------------------------------------------------------- L22 flags tested but never set
  for (const [flag, p] of flagsTested) if (!flagsSet.has(flag)) warn('L22', p, `flag "${flag}" is tested but never set by any reaction`);
}

/* ======================================================================== *
 *  CLI                                                                      *
 * ======================================================================== */

/** Verb words from vocab.js's VERBS (array or record of {words}); [] if absent. */
function verbWordsFrom(mod) {
  const verbs = mod?.VERBS;
  const list = Array.isArray(verbs) ? verbs : isObj(verbs) ? Object.values(verbs) : [];
  return list.flatMap((v) => asArr(v?.words)).filter((w) => typeof w === 'string');
}

async function main(argv) {
  const strict = argv.includes('--strict');
  const allowMissingArt = argv.includes('--allow-missing-art');
  const ci = argv.indexOf('--content');
  const target = ci >= 0 ? path.resolve(argv[ci + 1] ?? '') : new URL('../src/content/index.js', import.meta.url);
  const mod = await import(target instanceof URL ? target.href : pathToFileURL(target).href);
  const content = mod.default ?? mod.content;
  let hasGlyph;
  try { ({ hasGlyph } = await import('../src/ui/font8x8.js')); } catch { hasGlyph = undefined; }
  let verbWords = [];
  try { verbWords = verbWordsFrom(await import('../src/engine/vocab.js')); } catch { verbWords = []; }

  const { errors, warnings } = lintContent(content, { strict, allowMissingArt, hasGlyph, verbWords });
  for (const f of warnings) console.log(formatFinding('warning', f));
  for (const f of errors) console.log(formatFinding('error', f));
  const label = ci >= 0 ? path.relative(process.cwd(), String(target)) : 'src/content';
  console.log(`lint:content ${label}${strict ? ' (strict)' : ''}: ${errors.length} error(s), ${warnings.length} warning(s)`);
  return errors.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (e) => {
    console.error(`lint:content failed: ${e && e.stack ? e.stack : e}`);
    process.exitCode = 1;
  });
}
