// HookApi + Reaction runner (A4.5, A5, C27) and the engine services every action and the
// game loop share: the per-game `run` context, message lookup, Text rendering, room entry
// and description (A8.3 step 7, A8.4), and the status / picture / end events (A9).
//
// A `run` is the engine's working context, one per game:
//   { content, vocab, strict, messages, state, events, args, turnStart, shown, panicked,
//     api, hook }
// `state` is replaced on LOAD / UNDO / RESTART; `events` is the output buffer of the
// current call; `args` is the hook context ({phase, cmd, self}) of the code running now.
// Content hooks only ever see `api`; actions reach the run through runOf(api).

import { MESSAGES, PLAYER, REACTION_ORDER, DIRECTION_NAMES } from './types.js';
import * as rng from './rng.js';
import { interpolate, formatMoney, listJoin, withArticle, capitalise } from './text.js';
import { varProblem, timeString, itemLocProblem, inContainmentCycle } from './state.js';
import * as world from './world.js';

/**
 * @typedef {import('./types.js').State} State
 * @typedef {import('./types.js').ContentBundle} ContentBundle
 * @typedef {import('./types.js').Reaction} Reaction
 * @typedef {import('./types.js').Text} Text
 * @typedef {import('./types.js').HookApi} HookApi
 * @typedef {import('./types.js').OutputEvent} OutputEvent
 * @typedef {{phase: string|null, cmd: import('./types.js').Command|null, self: string|null}} HookCtx
 * @typedef {Object} Run
 * @property {ContentBundle} content
 * @property {object} vocab
 * @property {boolean} strict
 * @property {Record<string, string>} messages   Action-module message defaults (A16).
 * @property {State} state
 * @property {OutputEvent[]} events
 * @property {HookCtx} args
 * @property {{roomId: string, lit: boolean, ambient: string, nerve: number}|null} turnStart
 * @property {{roomId: string, lit: boolean}|null} shown  Room and lit state the player was
 *   last shown (A9.2 O5); set at turn start and by every room description.
 * @property {boolean} panicked   Panic moved the player this turn (stops the chain).
 * @property {HookApi} api
 * @property {(id: string, args?: object) => unknown} hook   CallHook for world.js.
 */

const hasOwn = (obj, key) => obj != null && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, key);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const each = (v, fn) => { for (const x of Array.isArray(v) ? v : [v]) fn(x); };

/** Engine-core message ids beyond the contract table (A16); overridable via content.messages. */
export const CORE_MESSAGES = Object.freeze({
  found: 'You find {a}.',
  onYouSee: 'On {the} you can see {list}.',
  inYouSee: 'In {the} you can see {list}.',
});

const NO_ARGS = Object.freeze({ phase: null, cmd: null, self: null });
const RUNS = new WeakMap();

/* ------------------------------------------------------------------------ *
 *  Run context                                                              *
 * ------------------------------------------------------------------------ */

/**
 * Creates the engine's working context and its HookApi.
 * @param {{state: State, content: ContentBundle, vocab?: object, strict?: boolean, messages?: Record<string,string>}} init
 * @returns {Run}
 */
export function createRun({ state, content, vocab = null, strict = false, messages = {} }) {
  /** @type {Run} */
  const run = {
    content, vocab, strict, messages, state, events: [], args: NO_ARGS,
    turnStart: null, shown: null, panicked: false, api: null, hook: null,
  };
  run.hook = (id, args) => callHook(run, id, args);
  run.api = createApi(run);
  return run;
}

/**
 * The run behind a HookApi (engine-internal; content cannot import api.js).
 * @param {HookApi} api
 * @returns {Run}
 */
export function runOf(api) {
  const run = RUNS.get(api);
  if (!run) throw new Error('runOf: not an engine HookApi');
  return run;
}

/** Runs `fn` with `run.args` temporarily replaced. */
function withArgs(run, args, fn) {
  const saved = run.args;
  run.args = args;
  try {
    return fn();
  } finally {
    run.args = saved;
  }
}

/**
 * Runs `fn` with `cmd` as the command being executed, so every hook it triggers — handler
 * services such as room entry or EXAMINE text included — sees `args.cmd` (A5 context table).
 * @param {Run} run
 * @param {import('./types.js').Command|null} cmd
 * @param {() => T} fn
 * @returns {T}
 * @template T
 */
export function withCommand(run, cmd, fn) {
  return withArgs(run, { phase: null, cmd, self: null }, fn);
}

/** Merges partial hook args over the current ones. */
function argsFor(run, args = {}) {
  return {
    phase: args.phase ?? run.args.phase ?? null,
    cmd: hasOwn(args, 'cmd') ? args.cmd ?? null : run.args.cmd ?? null,
    self: hasOwn(args, 'self') ? args.self ?? null : run.args.self ?? null,
  };
}

/**
 * Calls a content hook `(api, args)` (A5). Unknown hooks are a content bug and throw
 * (A7.9 turns that into an engine error).
 * @param {Run} run
 * @param {string} id
 * @param {Partial<HookCtx>} [args]
 * @returns {unknown}
 */
export function callHook(run, id, args = {}) {
  const fn = run.content.hooks?.[id];
  if (typeof fn !== 'function') throw new Error(`unknown hook "${id}"`);
  const full = argsFor(run, args);
  return withArgs(run, full, () => fn(run.api, full));
}

/** Cond evaluation with hooks bound to this run. */
export function testCond(run, cond) {
  return world.test(cond, run.state, run.content, run.hook);
}

/* ------------------------------------------------------------------------ *
 *  Events, messages and Text                                                *
 * ------------------------------------------------------------------------ */

/** @param {Run} run @param {OutputEvent} ev */
export function emit(run, ev) {
  run.events.push(ev);
}

/**
 * Emits a plain string as a `text` event; empty strings emit nothing (A4.3).
 * @param {Run} run
 * @param {string} s
 * @param {string} [style]  Omitted for 'normal'.
 */
export function emitText(run, s, style) {
  if (typeof s !== 'string' || s === '') return;
  const ev = { type: 'text', text: s };
  if (style && style !== 'normal') ev.style = style;
  run.events.push(ev);
}

/** Rank title for a score (A8.11). */
export function rankFor(content, score) {
  let title = '';
  for (const r of content.scoring?.ranks ?? []) if (r.min <= score) title = r.title;
  return title;
}

/** Values of the T1 placeholders, computed on demand. */
function placeholderValues(run) {
  const { state, content } = run;
  return {
    money: formatMoney(state.money),
    time: timeString(state.turn),
    turns: state.turn,
    score: state.score,
    maxScore: content.scoring?.maxScore ?? 0,
    nerve: state.nerve,
    evidence: world.evidenceCount(state, content),
    rank: rankFor(content, state.score),
  };
}

/** Fills T1 placeholders ({money}, {time}, …) in an already-chosen string. */
function fillPlaceholders(run, s) {
  return typeof s === 'string' && s.includes('{') ? interpolate(s, placeholderValues(run)) : s;
}

/**
 * Message text for an id (A16): content.messages → contract MESSAGES → engine core →
 * action defaults. `params` fill the message's own placeholders, then T1 placeholders.
 * @param {Run} run
 * @param {string} id
 * @param {Record<string, unknown>} [params]
 * @returns {string}
 */
export function message(run, id, params = {}) {
  const override = run.content.messages?.[id];
  const tpl = typeof override === 'string' ? override
    : MESSAGES[id] ?? CORE_MESSAGES[id] ?? run.messages?.[id] ?? id;
  return fillPlaceholders(run, interpolate(tpl, params));
}

/** Emits a message as a text event. */
export function sayMessage(run, id, params, style) {
  emitText(run, message(run, id, params), style);
}

/**
 * Renders a Text (A4.3): string, first matching variant, or a text hook — then T1.
 * @param {Run} run
 * @param {Text} text
 * @param {string|null} [self]  Owner id for text hooks.
 * @returns {string}
 */
export function renderText(run, text, self) {
  if (text === undefined || text === null) return '';
  let s = '';
  const ctxArgs = self === undefined ? {} : { self };
  if (typeof text === 'string') s = text;
  else if (Array.isArray(text)) {
    const variant = withArgs(run, argsFor(run, ctxArgs), () => text.find((v) => isObj(v) && testCond(run, v.if)));
    s = variant ? String(variant.text ?? '') : '';
  } else if (isObj(text) && typeof text.hook === 'string') {
    const out = callHook(run, text.hook, { phase: 'text', ...ctxArgs });
    s = out === undefined || out === null ? '' : String(out);
  } else {
    throw new Error(`invalid Text: ${JSON.stringify(text)}`);
  }
  return fillPlaceholders(run, s);
}

/** Renders and emits a Text. */
export function say(run, text, style, self) {
  emitText(run, renderText(run, text, self === undefined ? run.args.self : self), style);
}

/* ------------------------------------------------------------------------ *
 *  Names                                                                    *
 * ------------------------------------------------------------------------ */

/**
 * 'item' | 'npc' | 'scenery' | 'room' | null.
 * @param {Run} run @param {string} id
 */
export function kindOf(run, id) {
  if (typeof id !== 'string') return null;
  if (hasOwn(run.content.items, id)) return 'item';
  if (hasOwn(run.content.npcs, id)) return 'npc';
  if (world.sceneryOf(run.content, id)) return 'scenery';
  if (hasOwn(run.content.rooms, id)) return 'room';
  return null;
}

/**
 * Display name of an entity: `'definite'` ("the brass key", "Maggie"), `'indefinite'`
 * ("a brass key", "some handcuffs") or `'bare'` ("brass key").
 * @param {Run} run
 * @param {string} id
 * @param {'definite'|'indefinite'|'bare'} [mode]
 */
export function nameOf(run, id, mode = 'definite') {
  const { content } = run;
  let name;
  let article;
  switch (kindOf(run, id)) {
    case 'item': ({ name, article } = content.items[id]); break;
    case 'npc': name = content.npcs[id].name; article = content.npcs[id].proper ? '' : content.npcs[id].article; break;
    case 'scenery': name = world.sceneryOf(content, id).names?.[0] ?? 'thing'; break;
    case 'room': return content.rooms[id].name;
    default: name = String(id); article = '';
  }
  return mode === 'bare' ? name : withArticle(name, article, mode);
}

/**
 * Standard name placeholders for messages: {the}, {The}, {a}, {A}, {name}.
 * @param {Run} run @param {string} id
 */
export function nameParams(run, id) {
  const the = nameOf(run, id, 'definite');
  const a = nameOf(run, id, 'indefinite');
  return { the, The: capitalise(the), a, A: capitalise(a), name: nameOf(run, id, 'bare') };
}

/* ------------------------------------------------------------------------ *
 *  State operations (shared by HookApi methods and Reaction effects)        *
 * ------------------------------------------------------------------------ */

function requireItem(run, id) {
  if (!hasOwn(run.state.items, id)) throw new Error(`unknown item "${id}"`);
}

/**
 * A3.1 invariants of one item after a state operation changed it (S1 location, S3
 * containers only, no cycles, S4 `worn` ⇒ carried). The same predicates validateSave uses
 * (V9, V10), so an operation can never commit a state its own save would reject; a
 * violation throws and the line rolls back (A7.9).
 * @param {Run} run @param {string} id @param {string} op
 */
function checkItem(run, id, op) {
  const p = itemLocProblem(run.state, run.content, id)
    ?? (inContainmentCycle(run.state.items, id) ? { field: 'loc', problem: 'containment cycle' } : null);
  if (p) throw new Error(`${op}: items.${id}.${p.field}: ${p.problem}`);
}

/** A finite number, or an internal error naming the operation (A3: no NaN / Infinity). */
function finite(value, op) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${op}: expected a finite number, got ${String(value)}`);
  return value;
}

/**
 * Item evidence whose item is now carried is discovered (A8.8).
 * @param {Run} run
 */
export function discoverCarried(run) {
  const { state, content } = run;
  for (const [evId, ev] of Object.entries(content.evidence ?? {})) {
    if (ev.item !== undefined && !state.evidence.includes(evId) && world.isCarried(state, ev.item)) {
      addEvidence(run, evId);
    }
  }
}

/**
 * Moves an item or NPC (A5 `move`). An item reaching the player is marked taken and
 * triggers evidence discovery.
 * @param {Run} run @param {string} id @param {import('./types.js').Loc} loc
 */
export function moveEntity(run, id, loc) {
  const { state } = run;
  if (hasOwn(state.items, id)) {
    if (loc !== null && loc !== PLAYER && !hasOwn(state.items, loc) && !hasOwn(state.npcs, loc) && !hasOwn(run.content.rooms, loc)) {
      throw new Error(`move: unknown location "${loc}"`);
    }
    world.moveItem(state, id, loc);
    checkItem(run, id, 'move');
    if (loc === PLAYER && state.items[id].moved === false) state.items[id].moved = true;
    discoverCarried(run);
  } else if (hasOwn(state.npcs, id)) {
    if (loc !== null && !hasOwn(run.content.rooms, loc)) throw new Error(`move: NPC "${id}" to unknown room "${loc}"`);
    world.moveNpc(state, id, loc);
  } else {
    throw new Error(`move: unknown id "${id}"`);
  }
}

const ITEM_PATCH_TYPES = { open: 'boolean', locked: 'boolean', lit: 'boolean', fuel: 'number', hidden: 'boolean', worn: 'boolean', moved: 'boolean' };

/** Patches capability fields the item has (A5 setItem). */
export function setItem(run, id, patch) {
  requireItem(run, id);
  const st = run.state.items[id];
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (!hasOwn(ITEM_PATCH_TYPES, key) || !hasOwn(st, key)) throw new Error(`setItem: "${id}" has no field "${key}"`);
    if (typeof value !== ITEM_PATCH_TYPES[key] || (key === 'fuel' && !(Number.isInteger(value) && value >= 0))) {
      throw new Error(`setItem: bad value for ${id}.${key}`);
    }
    st[key] = value;
  }
  checkItem(run, id, 'setItem');
}

/** Reveals a hidden item: `hidden = false`, then its `found` reaction (A8.6). */
export function reveal(run, id) {
  requireItem(run, id);
  const st = run.state.items[id];
  if (st.hidden !== true) return;
  st.hidden = false;
  const found = run.content.items[id].found;
  if (found !== undefined) runReaction(run, found, { phase: 'found', self: id });
  else sayMessage(run, 'found', nameParams(run, id));
}

/** Once-only award (A8.11): points capped at maxScore, `scoreUp` message. */
export function award(run, id) {
  const { state, content } = run;
  const def = content.scoring?.awards?.[id];
  if (!def) throw new Error(`unknown award "${id}"`);
  if (state.awarded.includes(id)) return;
  state.awarded.push(id);
  const before = state.score;
  state.score = Math.min(content.scoring.maxScore, state.score + def.points);
  const n = state.score - before;
  if (n > 0) sayMessage(run, 'scoreUp', { n }, 'system');
}

/** Once-only note (A5 addNote). */
export function addNote(run, id) {
  if (!hasOwn(run.content.notes, id)) throw new Error(`unknown note "${id}"`);
  if (run.state.notes.includes(id)) return;
  run.state.notes.push(id);
  sayMessage(run, 'noted', {}, 'system');
}

/** Once-only evidence discovery (A8.8): append, then note, then award. */
export function addEvidence(run, id) {
  const ev = run.content.evidence?.[id];
  if (!ev) throw new Error(`unknown evidence "${id}"`);
  if (run.state.evidence.includes(id)) return;
  run.state.evidence.push(id);
  if (ev.note !== undefined) addNote(run, ev.note);
  if (ev.award !== undefined) award(run, ev.award);
}

/** Type-checked `setVar` (A4.13). */
export function setVar(run, name, value) {
  const decl = run.content.vars?.[name];
  if (!decl) throw new Error(`unknown var "${name}"`);
  const problem = varProblem(decl, value);
  if (problem) throw new Error(`setVar ${name}: ${problem}`);
  run.state.vars[name] = value;
}

/** `setVar` value forms of a Reaction (R5): literal, `{add}`, `{turnPlus}`. */
function varValue(run, name, v) {
  if (isObj(v) && hasOwn(v, 'add')) {
    const cur = run.state.vars[name];
    if (typeof cur !== 'number') throw new Error(`setVar ${name}: {add} on a non-number`);
    return cur + v.add;
  }
  if (isObj(v) && hasOwn(v, 'turnPlus')) return run.state.turn + v.turnPlus;
  return v;
}

/** Sets a flag; `false` clears it (A5). */
export function setFlag(run, name, value = true) {
  if (value === false) delete run.state.flags[name];
  else run.state.flags[name] = true;
}

/** Nerve delta, clamped 0…100 immediately (caps / panic are D6). Non-finite deltas throw. */
export function adjustNerve(run, delta = 0) {
  const n = Math.round(run.state.nerve + finite(delta, 'nerve'));
  run.state.nerve = Math.max(0, Math.min(100, n));
}

/** Money delta in pence, clamped at 0. Non-finite deltas throw. */
export function adjustMoney(run, delta = 0) {
  run.state.money = Math.max(0, Math.trunc(run.state.money + finite(delta, 'money')));
}

/**
 * Ends the game (A5 `end`): the pipeline skips to D8. An ending already set stands (A7.7
 * E1: a death reached inside a nested reaction is never overwritten by a later effect).
 */
export function endGame(run, id) {
  if (!(run.content.endings ?? []).some((e) => e.id === id)) throw new Error(`unknown ending "${id}"`);
  if (run.state.ended !== null) return;
  run.state.ended = id;
  run.state.ctx.pending = null;
}

/* ------------------------------------------------------------------------ *
 *  Rooms (A8.3 step 7, A8.4) and presentation events (A9)                   *
 * ------------------------------------------------------------------------ */

/** Current ambient (A7.6 D7, C26): room → zone → 'none'. */
export function ambientFor(state, content) {
  const room = content.rooms[state.roomId];
  return room?.ambient ?? content.zones?.[room?.zone]?.ambient ?? 'none';
}

/** @param {Run} run */
export function roomEvent(run) {
  const id = run.state.roomId;
  return { type: 'room', id, name: run.content.rooms[id]?.name ?? id };
}

/** `picture` event for the current room (A8.4 last note, C25). */
export function pictureEvent(run) {
  const { state, content } = run;
  const room = content.rooms[state.roomId];
  let id = null;
  if (!world.isLit(state, content)) id = content.rules.darkPicture ?? null;
  else if (room?.picture && hasOwn(content.art, room.picture)) id = room.picture;
  return { type: 'picture', id, graphics: state.settings.graphics };
}

/**
 * A9.2 O5 for every phase of a turn: when the current room's lit state differs from what the
 * player was last shown (`run.shown`) without a room change, emit `picture` and the
 * description (lit) or the darkness text (unlit) — once. Called after the action phase,
 * after room entry's `onEnter`, after afterAction and after each daemon step; a room
 * description in between updates `run.shown`, so nothing is announced twice.
 * @param {Run} run
 */
export function syncLight(run) {
  const { state, content, shown } = run;
  if (!shown || state.ended !== null) return;
  const lit = world.isLit(state, content);
  if (shown.roomId !== state.roomId) {
    run.shown = { roomId: state.roomId, lit };
    return;
  }
  if (lit === shown.lit) return;
  emit(run, pictureEvent(run));
  if (lit) describeRoom(run);
  else sayMessage(run, 'dark');
  run.shown = { roomId: state.roomId, lit };
}

/** `status` event (A9.1). */
export function statusEvent(run) {
  const { state, content } = run;
  return {
    type: 'status', room: content.rooms[state.roomId]?.name ?? state.roomId, roomId: state.roomId,
    time: timeString(state.turn), score: state.score, maxScore: content.scoring?.maxScore ?? 0,
    nerve: state.nerve, turns: state.turn,
  };
}

/** `end` event for `state.ended` (A9.1). */
export function endEvent(run) {
  const { state, content } = run;
  const ending = (content.endings ?? []).find((e) => e.id === state.ended);
  return {
    type: 'end', ending: state.ended, kind: ending?.kind ?? 'death', title: ending?.title ?? '',
    text: renderText(run, ending?.text, null), score: state.score, maxScore: content.scoring?.maxScore ?? 0,
    rank: rankFor(content, state.score), turns: state.turn, art: ending?.art ?? null, music: ending?.music ?? null,
  };
}

/** Items lying in the room itself (loc or alsoIn), not hidden, content order. */
function itemsInRoom(run, roomId) {
  const { state, content } = run;
  return Object.keys(state.items).filter((id) => state.items[id].hidden !== true
    && (state.items[id].loc === roomId || content.items[id]?.alsoIn?.includes(roomId)));
}

/** Visible, non-hidden contents of an item, content order. */
export function visibleContents(run, id) {
  const visible = new Set(world.visibleItems(run.state, run.content));
  return world.contentsOf(run.state, id).filter((c) => visible.has(c));
}

/**
 * "On the table you can see a jar." / "In the crate you can see a page." for a supporter or
 * a container whose contents are visible; nothing otherwise. Returns whether it spoke.
 * @param {Run} run @param {string} id
 */
export function sayContents(run, id) {
  const c = run.content.items[id]?.container;
  if (!c) return false;
  const exposes = c.supporter || c.transparent || world.isOpen(run.state, run.content, id);
  const kids = exposes ? visibleContents(run, id) : [];
  if (!kids.length) return false;
  sayMessage(run, c.supporter ? 'onYouSee' : 'inYouSee', {
    ...nameParams(run, id), list: listJoin(kids.map((k) => nameOf(run, k, 'indefinite'))),
  });
  return true;
}

/**
 * The room description, exact event order of A8.4. `brief` omits the prose (row 2).
 * @param {Run} run
 * @param {{brief?: boolean}} [opts]
 */
export function describeRoom(run, { brief = false } = {}) {
  const { state, content } = run;
  const roomId = state.roomId;
  const room = content.rooms[roomId];
  const lit = world.isLit(state, content);
  run.shown = { roomId, lit };
  if (!lit) {
    sayMessage(run, 'darkTitle', {}, 'title');
    sayMessage(run, 'dark');
    return;
  }
  emitText(run, room.name, 'title');
  if (!brief) say(run, room.desc, undefined, roomId);
  for (const npcId of world.npcsIn(state, roomId)) {
    const here = content.npcs[npcId].here;
    if (here !== undefined) say(run, here, undefined, npcId);
    else sayMessage(run, 'npcHere', nameParams(run, npcId));
  }
  const inRoom = itemsInRoom(run, roomId);
  const withInitial = inRoom.filter((id) => content.items[id].initial !== undefined && state.items[id].moved === false);
  for (const id of withInitial) say(run, content.items[id].initial, undefined, id);
  const listable = inRoom.filter((id) => !content.items[id].scenery && !withInitial.includes(id));
  if (listable.length) sayMessage(run, 'canAlsoSee', { list: listJoin(listable.map((id) => nameOf(run, id, 'indefinite'))) });
  for (const id of world.visibleItems(state, content)) {
    const inThisRoom = world.roomOf(state, id) === roomId || content.items[id]?.alsoIn?.includes(roomId);
    if (inThisRoom && !world.isCarried(state, id)) sayContents(run, id);
  }
  const dirs = world.exitsOf(state, content, roomId, run.hook).filter((e) => e.listed).map((e) => DIRECTION_NAMES[e.dir]);
  if (dirs.length) sayMessage(run, 'exits', { list: dirs.join(', ') });
  else sayMessage(run, 'noExits');
}

/**
 * Full room entry (A8.3 step 7): move, `room` + `picture`, description (BRIEF on a
 * re-visit), `onEnter`, then mark visited. Used by movement, `api.movePlayer` and panic.
 * @param {Run} run
 * @param {string} roomId  A real room (not a stub).
 */
export function enterRoom(run, roomId) {
  const { state, content } = run;
  if (!hasOwn(content.rooms, roomId)) throw new Error(`movePlayer: unknown room "${roomId}"`);
  const brief = state.settings.verbose === false && state.visited.includes(roomId);
  world.movePlayer(state, roomId);
  emit(run, roomEvent(run));
  emit(run, pictureEvent(run));
  describeRoom(run, { brief });
  const onEnter = content.rooms[roomId].onEnter;
  if (onEnter !== undefined) runReaction(run, onEnter, { phase: 'onEnter', self: roomId });
  world.markVisited(state, roomId);
  syncLight(run);                       // onEnter may have changed the light (O5)
}

/* ------------------------------------------------------------------------ *
 *  Reaction runner (A4.5)                                                   *
 * ------------------------------------------------------------------------ */

const NOT_FIRED = Object.freeze({ fired: false, cont: false });

/** Effects in REACTION_ORDER; each mirrors the HookApi method of the same meaning (R6). */
const EFFECTS = {
  sfx: (run, v) => emit(run, { type: 'sfx', id: v }),
  pause: (run, v) => emit(run, { type: 'pause', ms: v }),
  say: (run, v, r) => say(run, v, r.style),
  pick: (run, v, r) => {
    const t = rng.pick(run.state, v);
    if (t !== undefined) say(run, t, r.style);
  },
  setFlag: (run, v) => each(v, (n) => setFlag(run, n)),
  clearFlag: (run, v) => each(v, (n) => setFlag(run, n, false)),
  setVar: (run, v) => { for (const [name, val] of Object.entries(v)) setVar(run, name, varValue(run, name, val)); },
  setItem: (run, v) => { for (const [id, patch] of Object.entries(v)) setItem(run, id, patch); },
  setNpc: (run, v) => { for (const [id, patch] of Object.entries(v)) setNpcState(run, id, patch); },
  reveal: (run, v) => each(v, (id) => reveal(run, id)),
  move: (run, v) => { for (const [id, loc] of Object.entries(v)) moveEntity(run, id, loc); },
  give: (run, v) => each(v, (id) => moveEntity(run, id, PLAYER)),
  money: (run, v) => adjustMoney(run, v),
  nerve: (run, v) => adjustNerve(run, v),
  note: (run, v) => addNote(run, v),
  evidence: (run, v) => addEvidence(run, v),
  award: (run, v) => award(run, v),
  music: (run, v) => emit(run, { type: 'music', id: v }),
  movePlayer: (run, v) => enterRoom(run, v),
  then: (run, v) => evalReaction(run, v),
  end: (run, v) => endGame(run, v),
};

function setNpcState(run, id, patch) {
  if (!hasOwn(run.state.npcs, id)) throw new Error(`unknown NPC "${id}"`);
  const value = patch?.state ?? null;
  if (value !== null && typeof value !== 'string') throw new Error(`setNpc ${id}: state must be a string or null`);
  run.state.npcs[id].state = value;
}

/** Applies one ReactionObject; `guardChecked` = its `if` was already tested (cases). */
function applyObject(run, r, guardChecked) {
  if (typeof r === 'string' || Array.isArray(r)) return evalReaction(run, r);
  if (!isObj(r)) throw new Error(`invalid reaction: ${JSON.stringify(r)}`);
  if (!guardChecked && r.if !== undefined && !testCond(run, r.if)) {
    return r.else !== undefined ? evalReaction(run, r.else) : NOT_FIRED;
  }
  if (r.chance !== undefined && !(rng.next(run.state) < r.chance)) return NOT_FIRED;
  for (const key of REACTION_ORDER) {
    if (!hasOwn(r, key)) continue;
    // A7.7 E1: once an ending is set (here or in a nested reaction), nothing else applies.
    if (run.state.ended !== null) break;
    // R4: a hook returning exactly false un-fires the reaction; `then` / `end` are skipped.
    if (key === 'hook') {
      if (callHook(run, r.hook) === false) return NOT_FIRED;
      continue;
    }
    EFFECTS[key](run, r[key], r);
  }
  return { fired: true, cont: r.continue === true };
}

/** Evaluates any Reaction form (R1–R7). After an ending nothing runs (A7.7 E1). */
function evalReaction(run, r) {
  if (r === undefined || r === null || run.state.ended !== null) return NOT_FIRED;
  if (typeof r === 'string') {
    say(run, r);
    return { fired: true, cont: false };
  }
  if (Array.isArray(r)) {
    for (const el of r) {
      if (isObj(el) && el.if !== undefined && !testCond(run, el.if)) continue;
      return applyObject(run, el, true);
    }
    return NOT_FIRED;
  }
  return applyObject(run, r, false);
}

/**
 * Runs a Reaction with hook context `args`; returns whether it fired and whether the
 * object that fired asked to `continue` (R7, `before` slots).
 * @param {Run} run
 * @param {Reaction} reaction
 * @param {Partial<HookCtx>} [args]
 * @returns {{fired: boolean, cont: boolean}}
 */
export function runReaction(run, reaction, args = {}) {
  return withArgs(run, argsFor(run, args), () => evalReaction(run, reaction));
}

/**
 * Runs a Reaction (A4.5) through a HookApi; returns whether it fired.
 * @param {Reaction} reaction
 * @param {HookApi} api
 * @param {Partial<HookCtx>} [args]
 * @returns {boolean}
 */
export function react(reaction, api, args = {}) {
  return runReaction(runOf(api), reaction, args).fired;
}

/* ------------------------------------------------------------------------ *
 *  HookApi (A5)                                                             *
 * ------------------------------------------------------------------------ */

/**
 * The HookApi bound to a run. Content hooks change the game only through it.
 * @param {Run} run
 * @returns {HookApi}
 */
export function createApi(run) {
  const api = {
    get state() { return run.state; },
    get content() { return run.content; },
    get turn() { return run.state.turn; },
    get room() { return run.state.roomId; },
    test: (cond) => testCond(run, cond),
    flag: (name) => run.state.flags[name] === true,
    var: (name) => run.state.vars[name],
    carried: (id) => world.isCarried(run.state, id),
    locOf: (id) => world.locationOf(run.state, id),
    present: (id) => testCond(run, { present: id }),
    lit: () => world.isLit(run.state, run.content),
    evidenceCount: () => world.evidenceCount(run.state, run.content),
    rng: Object.freeze({
      next: () => rng.next(run.state),
      int: (n) => rng.int(run.state, n),
      pick: (arr) => rng.pick(run.state, arr),
    }),
    say: (text, style) => say(run, text, style),
    sfx: (id) => emit(run, { type: 'sfx', id }),
    music: (id) => emit(run, { type: 'music', id }),
    pause: (ms) => emit(run, { type: 'pause', ms }),
    move: (id, loc) => moveEntity(run, id, loc),
    movePlayer: (roomId) => enterRoom(run, roomId),
    setItem: (id, patch) => setItem(run, id, patch),
    setNpc: (id, patch) => setNpcState(run, id, patch),
    reveal: (id) => reveal(run, id),
    setFlag: (name, value = true) => setFlag(run, name, value),
    clearFlag: (name) => setFlag(run, name, false),
    setVar: (name, value) => setVar(run, name, value),
    award: (id) => award(run, id),
    addNote: (id) => addNote(run, id),
    addEvidence: (id) => addEvidence(run, id),
    money: (delta) => adjustMoney(run, delta),
    nerve: (delta) => adjustNerve(run, delta),
    react: (reaction) => runReaction(run, reaction).fired,
    end: (id) => endGame(run, id),
  };
  Object.freeze(api);
  RUNS.set(api, run);
  return api;
}
