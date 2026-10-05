// Action phase "A" of a turn (A7.5): hazard → protection → `before` slots → handler →
// `after` slots, per object for ALL / lists (A6.5), then the lighting-change
// re-description (A9.2 O5, api.syncLight). The turn pipeline around it lives in game.js.
// Each object runs with its command established as the hook context (A5), so hooks that
// handlers trigger (room entry, EXAMINE text, …) see `args.cmd`.

import {
  runReaction, say, sayMessage, endGame, testCond, nameOf, withCommand, syncLight,
} from '../api.js';
import { capitalise } from '../text.js';
import { protect } from './protect.js';

const hasOwn = (obj, key) => obj != null && Object.prototype.hasOwnProperty.call(obj, key);

/**
 * The hazard `cmd` triggers in the current room (A7.5 step 1, C31), or null.
 * @param {import('../api.js').Run} run
 * @param {import('../types.js').Command} cmd
 * @param {string|null} dir  Direction the command moves, if it is a movement.
 * @returns {string|null}
 */
export function hazardFor(run, cmd, dir) {
  for (const [id, h] of Object.entries(run.content.hazards ?? {})) {
    if (h.room !== run.state.roomId) continue;
    const byExit = h.exit !== undefined && dir !== null && dir === h.exit;
    const byVerb = Array.isArray(h.verbs) && h.verbs.includes(cmd.verb)
      && (!Array.isArray(h.objects) || cmd.dobj === undefined || h.objects.includes(cmd.dobj));
    if (!byExit && !byVerb) continue;
    if (h.unless !== undefined && testCond(run, h.unless)) continue;
    return id;
  }
  return null;
}

/** Warned once (alert, consumes the command), then fatal. */
function springHazard(run, id) {
  const h = run.content.hazards[id];
  if (run.state.warned.includes(id)) {
    endGame(run, h.ending);
    return;
  }
  say(run, h.warn, 'alert', h.room);
  run.state.warned.push(id);
}

/** Slot owners in A7.5 order: before = room, dobj, iobj; after = dobj, iobj, room. */
function slotOwners(run, cmd, roomId, kind) {
  const { content } = run;
  const entity = (id) => {
    if (typeof id !== 'string') return null;
    const def = hasOwn(content.items, id) ? content.items[id] : hasOwn(content.npcs, id) ? content.npcs[id] : null;
    return def ? [id, def[kind]] : null;
  };
  const room = [roomId, content.rooms[roomId]?.[kind]];
  const list = kind === 'before' ? [room, entity(cmd.dobj), entity(cmd.iobj)] : [entity(cmd.dobj), entity(cmd.iobj), room];
  return list.filter((x) => x && x[1] && hasOwn(x[1], cmd.verb));
}

/** A7.5 steps 1–5 for one object. */
function actOnce(run, cmd, registry) {
  const api = run.api;
  const def = registry[cmd.verb];
  const roomId = run.state.roomId;

  const hazard = hazardFor(run, cmd, def?.dir ? def.dir(cmd, api) : null);
  if (hazard) {
    springHazard(run, hazard);
    return;
  }
  if (protect(cmd, api)) return;

  for (const [self, slots] of slotOwners(run, cmd, roomId, 'before')) {
    const res = runReaction(run, slots[cmd.verb], { phase: 'before', cmd, self });
    if (run.state.ended !== null || (res.fired && !res.cont)) return;
  }

  let ok = false;
  if (def) {
    ok = def.run(cmd, api)?.ok === true;
  } else {
    const verbDef = run.vocab?.verbById?.[cmd.verb];
    if (verbDef?.default !== undefined) say(run, verbDef.default, undefined, null);
    else sayMessage(run, 'cantDo');
  }
  if (!ok || run.state.ended !== null) return;

  for (const [self, slots] of slotOwners(run, cmd, roomId, 'after')) {
    runReaction(run, slots[cmd.verb], { phase: 'after', cmd, self });
    if (run.state.ended !== null) return;
  }
}

/** Prefixes the first text event at or after `mark` with "<Name>: " (A6.5). */
function prefixFirstText(run, mark, name) {
  const ev = run.events.slice(mark).find((e) => e.type === 'text');
  if (ev) ev.text = `${name}: ${ev.text}`;
}

/**
 * Executes one world command's action phase (A7.5 steps 1–6).
 * @param {import('../api.js').Run} run
 * @param {import('../types.js').Command} cmd
 * @param {Record<string, import('./common.js').ActionDef>} registry
 */
export function performAction(run, cmd, registry) {
  if (Array.isArray(cmd.dobj)) {
    for (const id of cmd.dobj) {
      if (run.state.ended !== null) break;
      const mark = run.events.length;
      const one = { ...cmd, dobj: id };
      withCommand(run, one, () => actOnce(run, one, registry));
      prefixFirstText(run, mark, capitalise(nameOf(run, id, 'bare')));
    }
  } else {
    withCommand(run, cmd, () => actOnce(run, cmd, registry));
  }
  syncLight(run);
}
