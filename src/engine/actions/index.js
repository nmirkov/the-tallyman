// Action registry (A7.5): `{ [verbId]: ActionDef }` merged from one module per verb
// family, plus the system barriers and every family's default messages (A16).
//
// Every engine verb of vocab.js has an entry here except the barriers (SYSTEM_ACTIONS)
// and AGAIN (handled by the game loop). Content verbs have no entry: they run their
// `before` reactions and then say their `default` (A4.15).

import * as movement from './movement.js';
import * as observe from './observe.js';
import * as objects from './objects.js';
import * as light from './light.js';
import * as meta from './meta.js';
import * as generic from './generic.js';
// TT-009 slot: replace `placeholder` with `npc.js` (TALK / ASK / TELL / SHOW / GIVE / BUY)
// and `case.js` (ACCUSE / NOTES / HINT) — registration only.
import * as placeholder from './placeholder.js';

const FAMILIES = [movement, observe, objects, light, meta, generic, placeholder];

function merge(key) {
  const out = {};
  for (const family of FAMILIES) {
    for (const [id, value] of Object.entries(family[key] ?? {})) {
      if (Object.prototype.hasOwnProperty.call(out, id)) throw new Error(`actions: duplicate ${key} "${id}"`);
      out[id] = value;
    }
  }
  return Object.freeze(out);
}

/** World and meta verb handlers. @type {Readonly<Record<string, import('./common.js').ActionDef>>} */
export const ACTIONS = merge('actions');

/** Chain-barrier handlers `(cmd, api, sys)` (A7.2 K3). */
export const SYSTEM_ACTIONS = meta.system;

/** Default text of every action-level message id (A16). */
export const ACTION_MESSAGES = merge('messages');

export { performAction } from './perform.js';
export { protection } from './protect.js';
