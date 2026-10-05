// Personal / critical item protection (A8.7, C21) — A7.5 step 2, before any content
// reaction so content cannot bypass it. A refusal consumes the command (1 turn).

import { runOf, say, sayMessage } from '../api.js';
import * as world from '../world.js';

const hasOwn = (obj, key) => obj != null && Object.prototype.hasOwnProperty.call(obj, key);

/**
 * Which protection applies to `cmd` on its (single) dobj, per the A8.7 table:
 * 'personal', 'critical' or null.
 * @param {import('../types.js').Command} cmd
 * @param {import('../types.js').State} state
 * @param {import('../types.js').ContentBundle} content
 * @returns {'personal'|'critical'|null}
 */
export function protection(cmd, state, content) {
  const id = cmd.dobj;
  if (typeof id !== 'string' || !hasOwn(content.items, id)) return null;
  const item = content.items[id];
  const personal = item.personal === true;
  const critical = item.critical === true;
  switch (cmd.verb) {
    case 'drop':
    case 'put':
      return personal ? 'personal' : null;
    case 'give': {
      const accepts = content.npcs[cmd.iobj]?.accepts;
      if (personal) return 'personal';
      return critical && !hasOwn(accepts, id) ? 'critical' : null;
    }
    case 'throw':
    case 'eat':
    case 'drink':
      return personal ? 'personal' : critical ? 'critical' : null;
    case 'break':
    case 'tear':
    case 'cut':
      if (personal) return 'personal';
      return critical && world.isCarried(state, id) ? 'critical' : null;
    default:
      return null;
  }
}

/**
 * Applies A8.7: says the refusal and returns true when the command is consumed.
 * @param {import('../types.js').Command} cmd
 * @param {import('../types.js').HookApi} api
 * @returns {boolean}
 */
export function protect(cmd, api) {
  const run = runOf(api);
  const kind = protection(cmd, run.state, run.content);
  if (kind === null) return false;
  const item = run.content.items[cmd.dobj];
  if (kind === 'critical' && item.criticalMsg !== undefined) say(run, item.criticalMsg, undefined, cmd.dobj);
  else sayMessage(run, kind);
  return true;
}
