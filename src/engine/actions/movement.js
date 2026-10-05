// Movement family (A8.3): GO / bare directions, BACK, ENTER, EXIT, CLIMB. Every attempt
// costs 1 turn, refused or not (A7.4).

import { DIRECTIONS } from '../types.js';
import { runOf, enterRoom, say } from '../api.js';
import * as world from '../world.js';
import { defineActions, refuse, OK, FAIL } from './common.js';

export const messages = Object.freeze({
  noBack: 'You can\'t retrace your steps from here.',
  doorClosed: '{The} is closed.',
});

/** BACK: the first direction (DIRECTIONS order) whose exit leads to `prevRoomId`. */
function backDir(api) {
  const prev = api.state.prevRoomId;
  if (!prev) return null;
  const exits = api.content.rooms[api.state.roomId]?.exits ?? {};
  for (const dir of DIRECTIONS) {
    const e = exits[dir];
    if (e !== undefined && (typeof e === 'string' ? e : e.to) === prev) return dir;
  }
  return null;
}

/**
 * The direction a movement command goes (A8.3 step 1): bare ENTER = in, EXIT = out,
 * CLIMB UP/DOWN = u/d, ENTER X = in, EXIT X = out, CLIMB X = u.
 * @returns {string|null}
 */
export function moveDir(cmd, api) {
  switch (cmd.verb) {
    case 'go': return cmd.dir ?? null;
    case 'back': return backDir(api);
    case 'enter': return 'in';
    case 'exit': return 'out';
    case 'climb': return cmd.dir ?? 'u';
    default: return null;
  }
}

/**
 * Tries to move the player one way (A8.3 steps 3–7).
 * @returns {{ok: boolean}}
 */
export function go(api, dir) {
  const run = runOf(api);
  const { state, content } = run;
  const lit = world.isLit(state, content);
  const exits = world.exitsOf(state, content, state.roomId, run.hook);
  const exit = exits.find((e) => e.dir === dir);
  const blockedMsg = lit ? 'cantGo' : 'darkMove';
  if (!exit || (exit.hidden && !exit.condOk)) return refuse(api, blockedMsg);
  // Darkness rule: only the way back, unless no exit leads back (no softlock).
  if (!lit && state.prevRoomId && exit.to !== state.prevRoomId && exits.some((e) => e.to === state.prevRoomId)) {
    return refuse(api, 'darkMove');
  }
  if (!exit.condOk) {
    if (exit.msg !== null) say(run, exit.msg, undefined, state.roomId);
    else refuse(api, 'cantGo');
    return FAIL;
  }
  if (!exit.doorOpen) return refuse(api, 'doorClosed', exit.door);
  if (exit.stub) return refuse(api, 'stub');
  enterRoom(run, exit.to);
  return OK;
}

function moveRun(cmd, api) {
  const dir = moveDir(cmd, api);
  if (!dir) return refuse(api, cmd.verb === 'back' ? 'noBack' : 'cantGo');
  return go(api, dir);
}

const movement = { run: moveRun, dir: moveDir };

export const actions = defineActions({
  go: movement,
  back: movement,
  enter: movement,
  exit: movement,
  climb: movement,
});
