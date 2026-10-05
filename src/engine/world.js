// World model (A1, A3.1, A4.4, A8.1–A8.3): pure queries over (state, content), the
// low-level state moves, and condition evaluation. Nothing here emits events; room entry
// output, onEnter and evidence discovery belong to the game / API layer (TT-008).

import { PLAYER, DIRECTIONS, COND_KEYS, VAR_OPS } from './types.js';
import { timeString } from './state.js';

export { timeString };

const hasOwn = (obj, key) => obj != null && Object.prototype.hasOwnProperty.call(obj, key);
const SCENERY_ID = /^(.+)#(\d+)$/;

/**
 * @typedef {import('./types.js').State} State
 * @typedef {import('./types.js').ContentBundle} ContentBundle
 * @typedef {(hookId: string, args: {phase: string}) => unknown} CallHook
 *   Runs a content hook (TT-008 supplies one bound to a HookApi).
 */

/* ------------------------------------------------------------------------ *
 *  Containment                                                              *
 * ------------------------------------------------------------------------ */

/**
 * Items carried directly by the player (`loc === 'player'`), in content order (S2).
 * @param {State} state
 * @returns {string[]}
 */
export function inventory(state) {
  return Object.keys(state.items).filter((id) => state.items[id].loc === PLAYER);
}

/**
 * The `loc` of an item or NPC; null for unknown ids.
 * @param {State} state
 * @param {string} id
 * @returns {import('./types.js').Loc}
 */
export function locationOf(state, id) {
  if (hasOwn(state.items, id)) return state.items[id].loc;
  if (hasOwn(state.npcs, id)) return state.npcs[id].loc;
  return null;
}

/**
 * Items directly inside / on `containerId` (or lying in a room, or held by an NPC), content order.
 * @param {State} state
 * @param {string} containerId
 * @returns {string[]}
 */
export function contentsOf(state, containerId) {
  return Object.keys(state.items).filter((id) => state.items[id].loc === containerId);
}

/**
 * True when the item's location chain reaches the player (items in a carried bag count).
 * @param {State} state
 * @param {string} itemId
 * @returns {boolean}
 */
export function isCarried(state, itemId) {
  let loc = hasOwn(state.items, itemId) ? state.items[itemId].loc : null;
  for (let steps = 0; typeof loc === 'string' && steps <= Object.keys(state.items).length; steps++) {
    if (loc === PLAYER) return true;
    if (!hasOwn(state.items, loc)) return false;
    loc = state.items[loc].loc;
  }
  return false;
}

/**
 * The room an item or NPC is ultimately in, walking containers, the player and NPC holders.
 * Null when out of the world or unknown.
 * @param {State} state
 * @param {string} id
 * @returns {string|null}
 */
export function roomOf(state, id) {
  let loc = locationOf(state, id);
  const limit = Object.keys(state.items).length + Object.keys(state.npcs).length + 1;
  for (let steps = 0; typeof loc === 'string' && steps <= limit; steps++) {
    if (loc === PLAYER) return state.roomId;
    if (hasOwn(state.items, loc)) loc = state.items[loc].loc;
    else if (hasOwn(state.npcs, loc)) loc = state.npcs[loc].loc;
    else return loc;
  }
  return null;
}

/**
 * Whether a container is open: openable items by state, other containers always (A4.7).
 * @param {State} state
 * @param {ContentBundle} content
 * @param {string} itemId
 * @returns {boolean}
 */
export function isOpen(state, content, itemId) {
  const item = content.items[itemId];
  if (!item) return false;
  return item.openable ? state.items[itemId].open === true : true;
}

/**
 * NPCs whose location is `roomId`, content order.
 * @param {State} state
 * @param {string} roomId
 * @returns {string[]}
 */
export function npcsIn(state, roomId) {
  return Object.keys(state.npcs).filter((id) => state.npcs[id].loc === roomId);
}

/* ------------------------------------------------------------------------ *
 *  Low-level moves (no events, no discovery — the API layer adds those)     *
 * ------------------------------------------------------------------------ */

/**
 * Sets an item's location. Refuses containment cycles; leaving the player clears `worn`.
 * @param {State} state
 * @param {string} itemId
 * @param {import('./types.js').Loc} loc
 */
export function moveItem(state, itemId, loc) {
  if (!hasOwn(state.items, itemId)) throw new Error(`moveItem: unknown item "${itemId}"`);
  let cur = loc;
  for (let steps = 0; typeof cur === 'string' && hasOwn(state.items, cur); steps++) {
    if (cur === itemId || steps > Object.keys(state.items).length) {
      throw new Error(`moveItem: containment cycle putting "${itemId}" in "${loc}"`);
    }
    cur = state.items[cur].loc;
  }
  const st = state.items[itemId];
  st.loc = loc;
  if (st.worn === true && loc !== PLAYER) st.worn = false;
}

/**
 * Sets an NPC's room (null = offstage).
 * @param {State} state
 * @param {string} npcId
 * @param {string|null} loc
 */
export function moveNpc(state, npcId, loc) {
  if (!hasOwn(state.npcs, npcId)) throw new Error(`moveNpc: unknown NPC "${npcId}"`);
  state.npcs[npcId].loc = loc;
}

/**
 * Moves the player (A8.3 step 7 state part): `prevRoomId = roomId; roomId = to`.
 * `visited` is updated by the caller after `onEnter` (see markVisited).
 * @param {State} state
 * @param {string} roomId
 */
export function movePlayer(state, roomId) {
  state.prevRoomId = state.roomId;
  state.roomId = roomId;
}

/**
 * Appends a room to `visited` once.
 * @param {State} state
 * @param {string} roomId
 */
export function markVisited(state, roomId) {
  if (!state.visited.includes(roomId)) state.visited.push(roomId);
}

/* ------------------------------------------------------------------------ *
 *  Light (A8.2)                                                             *
 * ------------------------------------------------------------------------ */

/** A lit item's light reaches `roomId` through its location chain. */
function lightReaches(state, content, itemId, roomId) {
  let loc = state.items[itemId].loc;
  for (let steps = 0; typeof loc === 'string' && steps <= Object.keys(state.items).length; steps++) {
    if (loc === PLAYER) return state.roomId === roomId;
    if (hasOwn(state.items, loc)) {
      const c = content.items[loc]?.container;
      if (!c || !(c.supporter || c.transparent || isOpen(state, content, loc))) return false;
      loc = state.items[loc].loc;
    } else if (hasOwn(state.npcs, loc)) {
      return false;
    } else {
      return loc === roomId;
    }
  }
  return false;
}

/**
 * A room is lit if it is not dark, or a lit light source reaches it (A8.2).
 * @param {State} state
 * @param {ContentBundle} content
 * @param {string} [roomId]  Default: the player's room.
 * @returns {boolean}
 */
export function isLit(state, content, roomId = state.roomId) {
  const room = content.rooms[roomId];
  if (!room || !room.dark) return true;
  return Object.keys(state.items).some((id) => state.items[id].lit === true && lightReaches(state, content, id, roomId));
}

/* ------------------------------------------------------------------------ *
 *  Scope (A8.1)                                                             *
 * ------------------------------------------------------------------------ */

/** Ids of visible items (Set), per A8.1. */
function visibleSet(state, content) {
  const roomId = state.roomId;
  const lit = isLit(state, content, roomId);
  const ids = Object.keys(state.items);
  const seen = new Set();
  const queue = [];
  const add = (id) => {
    if (!seen.has(id) && state.items[id].hidden !== true) { seen.add(id); queue.push(id); }
  };
  for (const id of ids) {
    const loc = state.items[id].loc;
    if (loc === PLAYER) add(id);
    else if (lit && (loc === roomId || content.items[id]?.alsoIn?.includes(roomId))) add(id);
  }
  while (queue.length) {
    const id = queue.shift();
    const c = content.items[id]?.container;
    if (!c) continue;
    const open = isOpen(state, content, id);
    const exposes = lit ? (c.supporter || c.transparent || open) : open;
    if (exposes) for (const child of contentsOf(state, id)) add(child);
  }
  return seen;
}

/**
 * Visible item ids in content order (A8.1).
 * @param {State} state
 * @param {ContentBundle} content
 * @returns {string[]}
 */
export function visibleItems(state, content) {
  const seen = visibleSet(state, content);
  return Object.keys(state.items).filter((id) => seen.has(id));
}

/**
 * The content scenery entry for a derived id `${roomId}#${index}`, or null.
 * @param {ContentBundle} content
 * @param {string} id
 * @returns {import('./types.js').Scenery|null}
 */
export function sceneryOf(content, id) {
  const m = SCENERY_ID.exec(id);
  if (!m) return null;
  return content.rooms[m[1]]?.scenery?.[Number(m[2])] ?? null;
}

/**
 * Everything the player can refer to (A8.1): visible items (content order), NPCs in the
 * room and room scenery (both only when lit), and listed exit directions. `ids` is the
 * resolver's listing order: items, then NPCs, then scenery.
 * @param {State} state
 * @param {ContentBundle} content
 * @param {CallHook} [callHook]  Needed only if an exit condition uses a hook.
 * @returns {{items: string[], npcs: string[], scenery: string[], exits: string[], ids: string[]}}
 */
export function scope(state, content, callHook) {
  const items = visibleItems(state, content);
  const lit = isLit(state, content);
  const npcs = lit ? npcsIn(state, state.roomId) : [];
  const scenery = lit ? (content.rooms[state.roomId]?.scenery ?? []).map((_, i) => `${state.roomId}#${i}`) : [];
  const exits = exitsOf(state, content, state.roomId, callHook).filter((e) => e.listed).map((e) => e.dir);
  return { items, npcs, scenery, exits, ids: [...items, ...npcs, ...scenery] };
}

/**
 * Whether an item, NPC or scenery id is visible to the player (A8.1).
 * @param {State} state
 * @param {ContentBundle} content
 * @param {string} id
 * @returns {boolean}
 */
export function isVisible(state, content, id) {
  if (hasOwn(state.items, id)) return visibleSet(state, content).has(id);
  if (hasOwn(state.npcs, id)) return state.npcs[id].loc === state.roomId && isLit(state, content);
  const m = SCENERY_ID.exec(id);
  if (m && m[1] === state.roomId && sceneryOf(content, id)) return isLit(state, content);
  return false;
}

/**
 * Visible and not inside a closed container (A8.1 "reachable").
 * @param {State} state
 * @param {ContentBundle} content
 * @param {string} id
 * @returns {boolean}
 */
export function isReachable(state, content, id) {
  if (!isVisible(state, content, id)) return false;
  if (!hasOwn(state.items, id)) return true;
  let loc = state.items[id].loc;
  for (let steps = 0; typeof loc === 'string' && hasOwn(state.items, loc) && steps <= Object.keys(state.items).length; steps++) {
    if (!isOpen(state, content, loc)) return false;
    loc = state.items[loc].loc;
  }
  return true;
}

/* ------------------------------------------------------------------------ *
 *  Exits (A4.6, A8.3)                                                       *
 * ------------------------------------------------------------------------ */

/**
 * @typedef {Object} ExitInfo
 * @property {string} dir         Canonical direction.
 * @property {string} to          Target room or stub.
 * @property {string|null} door   Door item id.
 * @property {boolean} condOk     `if` holds (or absent).
 * @property {boolean} doorOpen   No door, or the door is open.
 * @property {boolean} passable   condOk && doorOpen.
 * @property {boolean} listed     Shown in the "Exits:" line (hidden exits only while condOk).
 * @property {boolean} hidden
 * @property {boolean} oneWay
 * @property {boolean} stub       Target is not a real room (a stub).
 * @property {import('./types.js').Text|null} msg  Blocked-by-`if` text, if any.
 */

/**
 * A room's exits in DIRECTIONS order with their current status. Conditions are evaluated
 * against the current state (the player need not be in that room).
 * @param {State} state
 * @param {ContentBundle} content
 * @param {string} [roomId]  Default: the player's room.
 * @param {CallHook} [callHook]
 * @returns {ExitInfo[]}
 */
export function exitsOf(state, content, roomId = state.roomId, callHook) {
  const exits = content.rooms[roomId]?.exits ?? {};
  const out = [];
  for (const dir of DIRECTIONS) {
    if (!hasOwn(exits, dir)) continue;
    const raw = exits[dir];
    const exit = typeof raw === 'string' ? { to: raw } : raw;
    const condOk = exit.if === undefined ? true : test(exit.if, state, content, callHook);
    const doorOpen = exit.door ? state.items[exit.door]?.open === true : true;
    out.push({
      dir, to: exit.to, door: exit.door ?? null, condOk, doorOpen, passable: condOk && doorOpen,
      listed: !(exit.hidden && !condOk), hidden: !!exit.hidden, oneWay: !!exit.oneWay,
      stub: !hasOwn(content.rooms, exit.to), msg: exit.msg ?? null,
    });
  }
  return out;
}

/* ------------------------------------------------------------------------ *
 *  Evidence (A8.8) and conditions (A4.4)                                    *
 * ------------------------------------------------------------------------ */

/**
 * Evidence count: discovered facts plus discovered item evidence currently carried.
 * @param {State} state
 * @param {ContentBundle} content
 * @returns {number}
 */
export function evidenceCount(state, content) {
  let n = 0;
  for (const id of state.evidence) {
    const ev = content.evidence?.[id];
    if (ev && (ev.item === undefined || isCarried(state, ev.item))) n++;
  }
  return n;
}

function compareVar(value, op, operand) {
  switch (op) {
    case 'eq': return value === operand;
    case 'ne': return value !== operand;
    case 'oneOf': return Array.isArray(operand) && operand.includes(value);
    default: {
      if (typeof value !== 'number' || typeof operand !== 'number') return false;
      if (op === 'gt') return value > operand;
      if (op === 'gte') return value >= operand;
      if (op === 'lt') return value < operand;
      return value <= operand;
    }
  }
}

/** turnGte / turnLt operand: a number or {var}; null when the var is not a number. */
function turnOperand(state, v) {
  const n = typeof v === 'number' ? v : state.vars[v?.var];
  return typeof n === 'number' ? n : null;
}

function badCond(cond) {
  let shown;
  try { shown = JSON.stringify(cond); } catch { shown = String(cond); }
  return new Error(`invalid condition: ${shown}`);
}

/**
 * Evaluates a Cond (A4.4). Pure: never changes state, never consumes RNG. An absent
 * condition (`undefined`) holds. Malformed conditions throw (a content bug lint catches).
 * @param {import('./types.js').Cond|undefined} cond
 * @param {State} state
 * @param {ContentBundle} content
 * @param {CallHook} [callHook]  Required only for `{hook}` conditions.
 * @returns {boolean}
 */
export function test(cond, state, content, callHook) {
  if (cond === undefined) return true;
  if (typeof cond === 'string') {
    return cond.startsWith('!') ? state.flags[cond.slice(1)] !== true : state.flags[cond] === true;
  }
  if (Array.isArray(cond)) return cond.every((c) => test(c, state, content, callHook));
  if (cond === null || typeof cond !== 'object') throw badCond(cond);
  const keys = Object.keys(cond);
  if (keys.includes('var')) {
    const op = keys.find((k) => k !== 'var');
    if (keys.length !== 2 || !VAR_OPS.includes(op)) throw badCond(cond);
    return compareVar(state.vars[cond.var], op, cond[op]);
  }
  if (keys.length !== 1 || !COND_KEYS.includes(keys[0])) throw badCond(cond);
  const key = keys[0];
  const v = cond[key];
  const rec = (c) => test(c, state, content, callHook);
  switch (key) {
    case 'all': return v.every(rec);
    case 'any': return v.some(rec);
    case 'not': return !rec(v);
    case 'flag': return state.flags[v] === true;
    case 'in': return Array.isArray(v) ? v.includes(state.roomId) : state.roomId === v;
    case 'zone': return content.rooms[state.roomId]?.zone === v;
    case 'carried': return isCarried(state, v);
    case 'present':
      return hasOwn(state.npcs, v) ? state.npcs[v].loc === state.roomId : isVisible(state, content, v);
    case 'at': return (hasOwn(state.items, v[0]) || hasOwn(state.npcs, v[0])) && locationOf(state, v[0]) === v[1];
    case 'visited': return state.visited.includes(v);
    case 'turnGte': { const n = turnOperand(state, v); return n !== null && state.turn >= n; }
    case 'turnLt': { const n = turnOperand(state, v); return n !== null && state.turn < n; }
    case 'evidence': return evidenceCount(state, content) >= v;
    case 'found': return state.evidence.includes(v);
    case 'noted': return state.notes.includes(v);
    case 'awarded': return state.awarded.includes(v);
    case 'lit': return isLit(state, content) === v;
    case 'moneyGte': return state.money >= v;
    case 'nerveGte': return state.nerve >= v;
    case 'open': return state.items[v]?.open === true;
    case 'locked': return state.items[v]?.locked === true;
    case 'on': return state.items[v]?.lit === true;
    case 'hook':
      if (typeof callHook !== 'function') throw new Error(`condition hook "${v}" needs callHook`);
      return callHook(v, { phase: 'cond' }) === true;
    default: throw badCond(cond);
  }
}
