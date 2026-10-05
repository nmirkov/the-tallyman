// Shared helpers for action modules (A7.5 handlers). Handlers have the signature
// `run(cmd, api) → {ok}`; `ok` gates the `after` slots. Every refusal is a message id
// with a default next to its handler, overridable through content.messages (A16).

import { PLAYER } from '../types.js';
import { runOf, sayMessage, nameParams, kindOf, emit } from '../api.js';
import * as world from '../world.js';

/**
 * @typedef {import('../types.js').Command} Command
 * @typedef {import('../types.js').HookApi} HookApi
 * @typedef {{ok: boolean}} ActionResult
 * @typedef {Object} ActionDef
 * @property {string} verb
 * @property {(cmd: Command, api: HookApi) => ActionResult|void} run
 * @property {(cmd: Command, api: HookApi) => string|null} [dir]
 *   Direction the command would move the player (hazard `exit` matching, A7.5 step 1).
 * @property {(cmd: Command, api: HookApi) => import('../types.js').PendingConfirm|null} [confirm]
 *   Ask before running (free); YES re-runs the command with `confirmed: true` (A7.3).
 */

export const OK = Object.freeze({ ok: true });
export const FAIL = Object.freeze({ ok: false });

const hasOwn = (obj, key) => obj != null && Object.prototype.hasOwnProperty.call(obj, key);

/** Name placeholders for an id ({the}, {The}, {a}, {A}, {name}); {} for none. */
export function names(api, id) {
  return typeof id === 'string' && kindOf(runOf(api), id) ? nameParams(runOf(api), id) : {};
}

/** Says message `id` with the dobj's name placeholders plus `params`. */
export function tell(api, id, about, params = {}, style) {
  sayMessage(runOf(api), id, { ...names(api, about), ...params }, style);
}

/** Says a message and returns FAIL (an in-world refusal; the turn still costs 1). */
export function refuse(api, id, about, params) {
  tell(api, id, about, params);
  return FAIL;
}

/** Says a message and returns OK. */
export function succeed(api, id, about, params) {
  tell(api, id, about, params);
  return OK;
}

/** Emits an `sfx` event (after the action's own text, O8). */
export function sfx(api, id) {
  emit(runOf(api), { type: 'sfx', id });
}

export const isItem = (api, id) => typeof id === 'string' && hasOwn(api.content.items, id);
export const isNpc = (api, id) => typeof id === 'string' && hasOwn(api.content.npcs, id);
export const itemDef = (api, id) => api.content.items[id];
export const itemState = (api, id) => api.state.items[id];
/** Directly in the player's hands (not merely inside a carried bag). */
export const held = (api, id) => isItem(api, id) && api.state.items[id].loc === PLAYER;

/** Visible but inside a closed container → "You can't reach it." (A8.1). */
export function unreachable(api, id) {
  return isItem(api, id) && !world.isReachable(api.state, api.content, id);
}

/** Portable = an item that is neither `fixed` nor `scenery`. */
export function portable(api, id) {
  const def = itemDef(api, id);
  return !!def && !def.fixed && !def.scenery;
}

/** Item ids used as an exit `door` anywhere (cached per content). */
const doorCache = new WeakMap();
export function isDoor(api, id) {
  const content = api.content;
  let doors = doorCache.get(content);
  if (!doors) {
    doors = new Set();
    for (const room of Object.values(content.rooms)) {
      for (const exit of Object.values(room.exits ?? {})) if (exit && typeof exit === 'object' && exit.door) doors.add(exit.door);
    }
    doorCache.set(content, doors);
  }
  return doors.has(id);
}

/**
 * Builds a registry fragment from `{verb: run}` or `{verb: {run, dir, confirm}}`.
 * @param {Record<string, Function|Omit<ActionDef, 'verb'>>} table
 * @returns {Record<string, ActionDef>}
 */
export function defineActions(table) {
  const out = {};
  for (const [verb, def] of Object.entries(table)) {
    out[verb] = Object.freeze(typeof def === 'function' ? { verb, run: def } : { verb, ...def });
  }
  return Object.freeze(out);
}
