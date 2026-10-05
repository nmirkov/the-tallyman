// Personal / critical item protection (A8.7, C21) — A7.5 step 2, before any content
// reaction so content cannot bypass it. A refusal consumes the command (1 turn).
//
// Protection covers the object AND everything inside it: throwing, eating, giving away or
// breaking a container would take its contents with it, so a container is protected by
// the strongest protection among itself and its (transitive) contents.

import { runOf, say, sayMessage } from '../api.js';
import * as world from '../world.js';

const hasOwn = (obj, key) => obj != null && Object.prototype.hasOwnProperty.call(obj, key);

/** The item and everything (transitively) inside or on it, the item first. */
function selfAndContents(state, id) {
  const out = [id];
  for (let i = 0; i < out.length && out.length <= Object.keys(state.items).length; i++) {
    for (const child of world.contentsOf(state, out[i])) if (!out.includes(child)) out.push(child);
  }
  return out;
}

/**
 * The A8.7 table for one item that the command would affect.
 * @param {string} verb
 * @param {object} item     Content item.
 * @param {boolean} carried
 * @param {boolean} accepted  The GIVE recipient `accepts` this very item.
 * @returns {'personal'|'critical'|null}
 */
function rule(verb, item, carried, accepted) {
  const personal = item.personal === true;
  const critical = item.critical === true;
  switch (verb) {
    case 'drop':
    case 'put':
      return personal ? 'personal' : null;
    case 'give':
      if (personal) return 'personal';
      return critical && !accepted ? 'critical' : null;
    case 'throw':
    case 'eat':
    case 'drink':
      return personal ? 'personal' : critical ? 'critical' : null;
    case 'break':
    case 'tear':
    case 'cut':
      if (personal) return 'personal';
      return critical && carried ? 'critical' : null;
    default:
      return null;
  }
}

/**
 * The protection that applies to `cmd` on its (single) dobj and its contents, and the item
 * that causes it: personal beats critical; otherwise the first protected item, the dobj
 * before its contents. A GIVE recipient's `accepts` entry only exempts the dobj itself.
 * @returns {{kind: 'personal'|'critical', id: string}|null}
 */
function guard(cmd, state, content) {
  const id = cmd.dobj;
  if (typeof id !== 'string' || !hasOwn(content.items, id) || !hasOwn(state.items, id)) return null;
  const accepts = typeof cmd.iobj === 'string' && hasOwn(content.npcs, cmd.iobj) ? content.npcs[cmd.iobj].accepts : undefined;
  let found = null;
  for (const x of selfAndContents(state, id)) {
    const kind = rule(cmd.verb, content.items[x], world.isCarried(state, x), x === id && hasOwn(accepts, x));
    if (kind === 'personal') return { kind, id: x };
    if (kind === 'critical' && found === null) found = { kind, id: x };
  }
  return found;
}

/**
 * Which protection applies to `cmd` on its (single) dobj — including anything inside it —
 * per the A8.7 table: 'personal', 'critical' or null.
 * @param {import('../types.js').Command} cmd
 * @param {import('../types.js').State} state
 * @param {import('../types.js').ContentBundle} content
 * @returns {'personal'|'critical'|null}
 */
export function protection(cmd, state, content) {
  return guard(cmd, state, content)?.kind ?? null;
}

/**
 * Applies A8.7: says the refusal and returns true when the command is consumed. A critical
 * refusal uses the protected item's `criticalMsg` when it has one.
 * @param {import('../types.js').Command} cmd
 * @param {import('../types.js').HookApi} api
 * @returns {boolean}
 */
export function protect(cmd, api) {
  const run = runOf(api);
  const g = guard(cmd, run.state, run.content);
  if (g === null) return false;
  const item = run.content.items[g.id];
  if (g.kind === 'critical' && item.criticalMsg !== undefined) say(run, item.criticalMsg, undefined, g.id);
  else sayMessage(run, g.kind);
  return true;
}
