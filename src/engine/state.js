// Game state (A3) and saves (A11): create, clone, serialise and validate.
// State is plain JSON; validateSave is atomic — it never mutates its input and returns a
// fresh state only after every check (V1–V12) has passed.

import {
  STATE_VERSION, SAVE_FORMAT, LIMITS, MIDNIGHT_TURN, RULE_DEFAULTS, START_TIME, TURN_SECONDS,
  PLAYER, DIRECTIONS, PENDING_KINDS,
} from './types.js';

/** Top-level State keys in A3 order. */
export const STATE_KEYS = Object.freeze([
  'v', 'seed', 'rng', 'turn', 'roomId', 'prevRoomId', 'visited', 'items', 'npcs', 'flags', 'vars',
  'money', 'score', 'awarded', 'hintTiers', 'nerve', 'panicCooldown', 'notes', 'evidence', 'warned',
  'fired', 'ctx', 'settings', 'ended',
]);

/**
 * Clock time for a turn: START_TIME + ⌊turn × TURN_SECONDS / 60⌋ minutes, 'HH:MM', wrapping at 24 h.
 * @param {number} turn
 * @returns {string}
 */
export function timeString(turn) {
  const [h, m] = START_TIME.split(':').map(Number);
  const total = (h * 60 + m + Math.floor((turn * TURN_SECONDS) / 60)) % 1440;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/**
 * Capability fields an item's ItemState must carry (A3.1 S4), in canonical order, with
 * their initial values.
 * @param {import('./types.js').Item} item
 * @returns {Record<string, boolean|number>}
 */
export function initialCaps(item) {
  /** @type {Record<string, boolean|number>} */
  const caps = {};
  if (item.openable) { caps.open = item.open ?? false; caps.locked = item.locked ?? false; }
  if (item.light) {
    caps.lit = item.light.lit ?? false;
    if (item.light.fuel !== undefined) caps.fuel = item.light.fuel;
  }
  if (item.hidden) caps.hidden = true;
  if (item.wearable) caps.worn = false;
  if (item.initial !== undefined) caps.moved = false;
  return caps;
}

/**
 * A fresh game state for `content` (A3 initial values).
 * @param {import('./types.js').ContentBundle} content
 * @param {number} [seed]  uint32; default 1.
 * @returns {import('./types.js').State}
 */
export function createState(content, seed = 1) {
  const rules = content.rules;
  const items = {};
  for (const [id, item] of Object.entries(content.items)) items[id] = { loc: item.location ?? null, ...initialCaps(item) };
  const npcs = {};
  for (const [id, npc] of Object.entries(content.npcs)) npcs[id] = { loc: npc.location ?? null, state: null };
  const vars = {};
  for (const [name, decl] of Object.entries(content.vars ?? {})) vars[name] = decl.init;
  return {
    v: STATE_VERSION,
    seed: seed >>> 0,
    rng: seed >>> 0,
    turn: 0,
    roomId: rules.start,
    prevRoomId: null,
    visited: [rules.start],
    items,
    npcs,
    flags: {},
    vars,
    money: rules.money ?? RULE_DEFAULTS.money,
    score: 0,
    awarded: [],
    hintTiers: {},
    nerve: rules.nerve?.start ?? RULE_DEFAULTS.nerve.start,
    panicCooldown: 0,
    notes: [],
    evidence: [],
    warned: [],
    fired: [],
    ctx: { it: null, them: [], npc: null, lastCommand: null, pending: null },
    settings: { verbose: true, graphics: true },
    ended: null,
  };
}

/**
 * Deep clone of a state (plain JSON).
 * @param {import('./types.js').State} state
 * @returns {import('./types.js').State}
 */
export function clone(state) {
  return JSON.parse(JSON.stringify(state));
}

/**
 * SaveData for a state (A11). Built from a deep clone; `summary` is derived.
 * @param {import('./types.js').State} state
 * @param {import('./types.js').ContentBundle} content
 * @returns {import('./types.js').SaveData}
 */
export function serialise(state, content) {
  return {
    format: SAVE_FORMAT,
    game: content.meta?.id ?? '',
    contentVersion: content.meta?.version ?? '',
    summary: {
      room: content.rooms[state.roomId]?.name ?? state.roomId,
      time: timeString(state.turn),
      score: state.score,
      turns: state.turn,
    },
    state: clone(state),
  };
}

/**
 * Why `value` is not valid for a VarDecl, or null when it is (A4.13).
 * @param {import('./types.js').VarDecl} decl
 * @param {unknown} value
 * @returns {string|null}
 */
export function varProblem(decl, value) {
  if (value === null) return decl.nullable ? null : 'null not allowed';
  switch (decl.type) {
    case 'int':
      if (!Number.isInteger(value)) return 'expected an integer';
      if (typeof decl.min === 'number' && value < decl.min) return `below minimum ${decl.min}`;
      if (typeof decl.max === 'number' && value > decl.max) return `above maximum ${decl.max}`;
      return null;
    case 'bool': return typeof value === 'boolean' ? null : 'expected a boolean';
    case 'str': return typeof value === 'string' ? null : 'expected a string';
    case 'enum': {
      const values = decl.values ?? [];
      return values.includes(/** @type {string} */ (value)) ? null : `expected one of ${values.join(', ')}`;
    }
    default: return `unknown var type "${decl.type}"`;
  }
}

/* ------------------------------------------------------------------------ *
 *  validateSave                                                             *
 * ------------------------------------------------------------------------ */

class SaveError extends Error {}
const NOT_A_SAVE = 'not a Tallyman save';

/** @param {string} message @returns {never} */
function fail(message) { throw new SaveError(message); }
/** @param {string} path @param {string} problem @returns {never} */
function corrupt(path, problem) { fail(`corrupt save: ${path}: ${problem}`); }

/** @param {unknown} v @returns {v is Record<string, any>} */
function isPlainObject(v) {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

const has = (obj, key) => obj != null && Object.prototype.hasOwnProperty.call(obj, key);
const isUint32 = (v) => Number.isInteger(v) && v >= 0 && v <= 0xffffffff;

/** Type predicates for the V5 shape table. */
const TYPES = {
  int: [(v) => Number.isInteger(v), 'expected an integer'],
  uint32: [isUint32, 'expected a uint32'],
  string: [(v) => typeof v === 'string', 'expected a string'],
  'string|null': [(v) => v === null || typeof v === 'string', 'expected a string or null'],
  'string[]': [(v) => Array.isArray(v) && v.every((x) => typeof x === 'string'), 'expected an array of strings'],
  object: [isPlainObject, 'expected an object'],
  'object|null': [(v) => v === null || isPlainObject(v), 'expected an object or null'],
  boolean: [(v) => typeof v === 'boolean', 'expected a boolean'],
};

const STATE_SHAPE = {
  v: 'int', seed: 'uint32', rng: 'uint32', turn: 'int', roomId: 'string', prevRoomId: 'string|null',
  visited: 'string[]', items: 'object', npcs: 'object', flags: 'object', vars: 'object', money: 'int',
  score: 'int', awarded: 'string[]', hintTiers: 'object', nerve: 'int', panicCooldown: 'int',
  notes: 'string[]', evidence: 'string[]', warned: 'string[]', fired: 'string[]', ctx: 'object',
  settings: 'object', ended: 'string|null',
};
const CTX_SHAPE = { it: 'string|null', them: 'string[]', npc: 'string|null', lastCommand: 'object|null', pending: 'object|null' };
const SETTINGS_SHAPE = { verbose: 'boolean', graphics: 'boolean' };

/** Exactly `keys`: missing first (declared order), then unexpected ones. */
function exactKeys(obj, keys, path) {
  for (const k of keys) if (!has(obj, k)) corrupt(`${path}.${k}`, 'missing');
  for (const k of Object.keys(obj)) if (!keys.includes(k)) corrupt(`${path}.${k}`, 'unexpected field');
}

/** Exact keys plus per-key JSON types from a shape table. */
function checkShape(obj, shape, path) {
  exactKeys(obj, Object.keys(shape), path);
  for (const [k, type] of Object.entries(shape)) {
    const [ok, msg] = TYPES[type];
    if (!ok(obj[k])) corrupt(`${path}.${k}`, msg);
  }
}

function range(value, min, max, path) {
  if (value < min || value > max) corrupt(path, `out of range ${min}..${max}`);
}

/** Every element is a known id, no duplicates. */
function idList(list, known, path, what) {
  const seen = new Set();
  list.forEach((id, i) => {
    if (!known(id)) corrupt(`${path}[${i}]`, `unknown ${what} "${id}"`);
    if (seen.has(id)) corrupt(`${path}[${i}]`, `duplicate "${id}"`);
    seen.add(id);
  });
}

/**
 * Validation context: lookups over the content bundle.
 * @param {import('./types.js').ContentBundle} content
 */
function lookups(content) {
  const rooms = content.rooms ?? {};
  const items = content.items ?? {};
  const npcs = content.npcs ?? {};
  /** Entity reference: room / item / NPC id or a scenery id `${roomId}#${index}`. */
  const isRef = (id) => {
    if (typeof id !== 'string') return false;
    if (has(rooms, id) || has(items, id) || has(npcs, id)) return true;
    const m = /^(.+)#(\d+)$/.exec(id);
    return !!m && has(rooms, m[1]) && Number(m[2]) < (rooms[m[1]].scenery?.length ?? 0);
  };
  return { rooms, items, npcs, isRef };
}

/** A resolved Command (A3.3) with existing ids. Unknown extra keys are tolerated. */
function checkCommand(cmd, path, L, content) {
  if (!isPlainObject(cmd)) corrupt(path, 'expected an object');
  for (const k of ['verb', 'verbWord', 'raw']) if (typeof cmd[k] !== 'string') corrupt(`${path}.${k}`, 'expected a string');
  if (has(cmd, 'dobj')) {
    const d = cmd.dobj;
    if (Array.isArray(d)) d.forEach((id, i) => { if (!L.isRef(id)) corrupt(`${path}.dobj[${i}]`, `unknown id "${id}"`); });
    else if (!L.isRef(d)) corrupt(`${path}.dobj`, `unknown id "${d}"`);
  }
  if (has(cmd, 'iobj') && !L.isRef(cmd.iobj)) corrupt(`${path}.iobj`, `unknown id "${cmd.iobj}"`);
  if (has(cmd, 'dir') && !DIRECTIONS.includes(cmd.dir)) corrupt(`${path}.dir`, `unknown direction "${cmd.dir}"`);
  for (const k of ['prep', 'topicText', 'arg']) if (has(cmd, k) && typeof cmd[k] !== 'string') corrupt(`${path}.${k}`, 'expected a string');
  if (has(cmd, 'topic') && cmd.topic !== null && !(typeof cmd.topic === 'string' && (has(content.topics, cmd.topic) || L.isRef(cmd.topic)))) {
    corrupt(`${path}.topic`, `unknown topic "${cmd.topic}"`);
  }
  if (has(cmd, 'all') && typeof cmd.all !== 'boolean') corrupt(`${path}.all`, 'expected a boolean');
  if (has(cmd, 'confirmed') && cmd.confirmed !== true) corrupt(`${path}.confirmed`, 'expected true');
}

/** A pending question (A3.3). */
function checkPending(p, path, L, content) {
  if (!PENDING_KINDS.includes(p.kind)) corrupt(`${path}.kind`, `unknown kind "${p.kind}"`);
  if (typeof p.text !== 'string') corrupt(`${path}.text`, 'expected a string');
  if (p.kind === 'confirm') {
    checkCommand(p.command, `${path}.command`, L, content);
    if (has(p, 'cancelText') && typeof p.cancelText !== 'string') corrupt(`${path}.cancelText`, 'expected a string');
    return;
  }
  const c = p.command;
  if (!isPlainObject(c)) corrupt(`${path}.command`, 'expected an object');
  for (const k of ['verb', 'raw']) if (typeof c[k] !== 'string') corrupt(`${path}.command.${k}`, 'expected a string');
  if (p.slot !== 'dobj' && p.slot !== 'iobj') corrupt(`${path}.slot`, 'expected "dobj" or "iobj"');
  if (!Array.isArray(p.candidates) || p.candidates.length === 0) corrupt(`${path}.candidates`, 'expected a non-empty array');
  p.candidates.forEach((id, i) => { if (!L.isRef(id)) corrupt(`${path}.candidates[${i}]`, `unknown id "${id}"`); });
  if (has(p, 'index') && !(Number.isInteger(p.index) && p.index >= 0)) corrupt(`${path}.index`, 'expected an integer >= 0');
  if (!isPlainObject(p.bound)) corrupt(`${path}.bound`, 'expected an object');
  for (const k of ['dobj', 'iobj']) {
    if (!has(p.bound, k)) continue;
    const ids = Array.isArray(p.bound[k]) ? p.bound[k] : [p.bound[k]];
    if (!ids.every(L.isRef)) corrupt(`${path}.bound.${k}`, 'unknown id');
  }
}

/** The checks V1–V12, throwing SaveError on the first failure. Returns a fresh state. */
function validate(data, content) {
  // V1 — plain object or JSON string of one; size limit. Parsing a fresh copy keeps the input untouched.
  let json;
  if (typeof data === 'string') json = data;
  else if (isPlainObject(data)) {
    try { json = JSON.stringify(data); } catch { fail(NOT_A_SAVE); }
  } else fail(NOT_A_SAVE);
  if (typeof json !== 'string' || json.length > LIMITS.saveBytes) fail(NOT_A_SAVE);
  let save;
  try { save = JSON.parse(json); } catch { fail(NOT_A_SAVE); }
  if (!isPlainObject(save)) fail(NOT_A_SAVE);
  // V2–V4
  if (save.format !== SAVE_FORMAT) fail(NOT_A_SAVE);
  if (save.game !== content.meta?.id) fail('save is from a different game');
  const s = save.state;
  if (!isPlainObject(s)) corrupt('state', 'expected an object');
  if (s.v !== STATE_VERSION) fail(`unsupported save version ${typeof s.v === 'number' ? s.v : JSON.stringify(s.v)}`);

  // V5 — exact keys and JSON types
  checkShape(s, STATE_SHAPE, 'state');
  checkShape(s.ctx, CTX_SHAPE, 'state.ctx');
  checkShape(s.settings, SETTINGS_SHAPE, 'state.settings');

  // V6 — ranges
  const maxScore = content.scoring?.maxScore ?? 0;
  const cooldownRule = content.rules?.nerve?.panicCooldown ?? RULE_DEFAULTS.nerve.panicCooldown;
  range(s.turn, 0, MIDNIGHT_TURN, 'state.turn');
  range(s.nerve, 0, 100, 'state.nerve');
  if (s.money < 0) corrupt('state.money', 'must be >= 0');
  range(s.score, 0, maxScore, 'state.score');
  range(s.panicCooldown, 0, cooldownRule, 'state.panicCooldown');

  // V7 — ids
  const L = lookups(content);
  const isRoom = (id) => has(L.rooms, id);
  if (!isRoom(s.roomId)) corrupt('state.roomId', `unknown room "${s.roomId}"`);
  if (s.prevRoomId !== null && !isRoom(s.prevRoomId)) corrupt('state.prevRoomId', `unknown room "${s.prevRoomId}"`);
  idList(s.visited, isRoom, 'state.visited', 'room');
  if (!s.visited.includes(s.roomId)) corrupt('state.visited', `does not contain the current room "${s.roomId}"`);
  for (const [table, contentTable, what] of [['items', L.items, 'item'], ['npcs', L.npcs, 'NPC'], ['vars', content.vars ?? {}, 'var']]) {
    for (const id of Object.keys(contentTable)) if (!has(s[table], id)) corrupt(`state.${table}.${id}`, 'missing');
    for (const id of Object.keys(s[table])) if (!has(contentTable, id)) corrupt(`state.${table}.${id}`, `unknown ${what}`);
  }
  idList(s.awarded, (id) => has(content.scoring?.awards, id), 'state.awarded', 'award');
  idList(s.notes, (id) => has(content.notes, id), 'state.notes', 'note');
  idList(s.evidence, (id) => has(content.evidence, id), 'state.evidence', 'evidence');
  idList(s.warned, (id) => has(content.hazards, id), 'state.warned', 'hazard');
  const beatIds = (content.beats ?? []).map((b) => b.id);
  idList(s.fired, (id) => beatIds.includes(id), 'state.fired', 'beat');
  const hints = content.hints ?? [];
  for (const [id, tier] of Object.entries(s.hintTiers)) {
    const step = hints.find((h) => h.id === id);
    if (!step) corrupt(`state.hintTiers.${id}`, 'unknown hint step');
    if (!Number.isInteger(tier) || tier < 0 || tier >= step.tiers.length) corrupt(`state.hintTiers.${id}`, `out of range 0..${step.tiers.length - 1}`);
  }

  // V8 — ItemState capability fields exactly per S4
  for (const [id, item] of Object.entries(L.items)) {
    const st = s.items[id];
    const path = `state.items.${id}`;
    if (!isPlainObject(st)) corrupt(path, 'expected an object');
    const caps = initialCaps(item);
    exactKeys(st, ['loc', ...Object.keys(caps)], path);
    for (const k of Object.keys(caps)) {
      if (k === 'fuel') {
        if (!Number.isInteger(st.fuel) || st.fuel < 0) corrupt(`${path}.fuel`, 'expected an integer >= 0');
      } else if (typeof st[k] !== 'boolean') corrupt(`${path}.${k}`, 'expected a boolean');
    }
  }
  for (const id of Object.keys(L.npcs)) {
    const st = s.npcs[id];
    const path = `state.npcs.${id}`;
    if (!isPlainObject(st)) corrupt(path, 'expected an object');
    exactKeys(st, ['loc', 'state'], path);
    if (st.state !== null && typeof st.state !== 'string') corrupt(`${path}.state`, 'expected a string or null');
  }

  // V9 — locations
  for (const id of Object.keys(L.items)) {
    const st = s.items[id];
    const path = `state.items.${id}`;
    const loc = st.loc;
    if (loc !== null && typeof loc !== 'string') corrupt(`${path}.loc`, 'expected a string or null');
    if (typeof loc === 'string' && loc !== PLAYER && !isRoom(loc) && !has(L.npcs, loc)) {
      if (!has(L.items, loc)) corrupt(`${path}.loc`, `unknown location "${loc}"`);
      if (!L.items[loc].container) corrupt(`${path}.loc`, `"${loc}" is not a container`);
    }
    if (st.worn === true && loc !== PLAYER) corrupt(`${path}.worn`, 'worn but not carried');
  }
  for (const id of Object.keys(L.npcs)) {
    const loc = s.npcs[id].loc;
    if (loc !== null && !isRoom(loc)) corrupt(`state.npcs.${id}.loc`, `unknown room "${loc}"`);
  }

  // V10 — containment cycles
  const ids = Object.keys(L.items);
  for (const id of ids) {
    let cur = s.items[id].loc;
    let steps = 0;
    while (typeof cur === 'string' && has(L.items, cur)) {
      if (cur === id || ++steps > ids.length) fail(`corrupt save: containment cycle at ${id}`);
      cur = s.items[cur].loc;
    }
  }

  // V11 — vars and flags
  for (const [name, decl] of Object.entries(content.vars ?? {})) {
    const problem = varProblem(decl, s.vars[name]);
    if (problem) corrupt(`state.vars.${name}`, problem);
  }
  for (const [name, value] of Object.entries(s.flags)) if (value !== true) corrupt(`state.flags.${name}`, 'expected true');

  // V12 — ctx, ended, settings
  const ctx = s.ctx;
  if (ctx.it !== null && !L.isRef(ctx.it)) corrupt('state.ctx.it', `unknown id "${ctx.it}"`);
  if (ctx.npc !== null && !has(L.npcs, ctx.npc)) corrupt('state.ctx.npc', `unknown NPC "${ctx.npc}"`);
  ctx.them.forEach((id, i) => { if (!L.isRef(id)) corrupt(`state.ctx.them[${i}]`, `unknown id "${id}"`); });
  if (ctx.lastCommand !== null) checkCommand(ctx.lastCommand, 'state.ctx.lastCommand', L, content);
  if (ctx.pending !== null) checkPending(ctx.pending, 'state.ctx.pending', L, content);
  if (s.ended !== null && !(content.endings ?? []).some((e) => e.id === s.ended)) corrupt('state.ended', `unknown ending "${s.ended}"`);
  if (s.ended !== null && ctx.pending !== null) corrupt('state.ctx.pending', 'must be null once the game has ended');

  // Canonical key order (A3: items / npcs / vars in content declaration order).
  s.items = Object.fromEntries(Object.keys(L.items).map((id) => [id, s.items[id]]));
  s.npcs = Object.fromEntries(Object.keys(L.npcs).map((id) => [id, s.npcs[id]]));
  s.vars = Object.fromEntries(Object.keys(content.vars ?? {}).map((k) => [k, s.vars[k]]));
  return Object.fromEntries(STATE_KEYS.map((k) => [k, s[k]]));
}

/**
 * Validates SaveData (object or JSON string) against the content (A11 V1–V13).
 * Never throws and never mutates `data`.
 * @param {unknown} data
 * @param {import('./types.js').ContentBundle} content
 * @returns {{ok: true, state: import('./types.js').State} | {ok: false, error: string}}
 */
export function validateSave(data, content) {
  try {
    return { ok: true, state: validate(data, content) };
  } catch (e) {
    return { ok: false, error: e instanceof SaveError ? e.message : NOT_A_SAVE };
  }
}
