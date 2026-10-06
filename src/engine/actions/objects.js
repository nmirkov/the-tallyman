// Object family (A8.5, A8.7): TAKE / DROP / PUT IN|ON / TAKE FROM, OPEN / CLOSE,
// UNLOCK / LOCK [WITH], PUSH / PULL / MOVE, WEAR / REMOVE, EAT / DRINK, THROW, BREAK.
// Personal / critical protection already ran (protect.js) before these handlers, and the
// registry's reachGuard (common.js) refuses objects inside closed containers (A8.1).

import { PLAYER } from '../types.js';
import {
  runOf, say, discoverCarried, moveEntity, runReaction, visibleContents, nameOf, setItem,
} from '../api.js';
import { listJoin, capitalise } from '../text.js';
import * as world from '../world.js';
import {
  defineActions, refuse, succeed, tell, sfx, names, isItem, isNpc, itemDef, itemState, held,
  unreachable, portable, isDoor, OK, FAIL,
} from './common.js';

export const messages = Object.freeze({
  alreadyHave: 'You already have that.',
  takeNpc: '{The} wouldn\'t care for that.',
  cantReach: 'You can\'t reach it.',
  notHolding: 'You aren\'t holding that.',
  putInside: 'You can\'t put something inside itself.',
  cantPutIn: 'You can\'t put things in {the}.',
  cantPutOn: 'There\'s no good surface on {the}.',
  containerClosed: '{The} is closed.',
  noRoomIn: 'There\'s no room in {the}.',
  noRoomOn: 'There\'s no room on {the}.',
  putIn: 'You put {the} in {target}.',
  putOn: 'You put {the} on {target}.',
  notOpenable: 'You can\'t open that.',
  notCloseable: 'You can\'t close that.',
  alreadyOpen: '{The} is already open.',
  alreadyClosed: '{The} is already closed.',
  isLocked: '{The} is locked.',
  opened: 'Opened.',
  openReveals: 'Opening {the} reveals {list}.',
  closed: 'Closed.',
  cantUnlock: 'You can\'t unlock that.',
  cantLock: 'You can\'t lock that.',
  notLocked: '{The} isn\'t locked.',
  alreadyLocked: '{The} is already locked.',
  closeFirst: 'You\'ll have to close {the} first.',
  wrongKey: '{Key} doesn\'t fit.',
  noKey: 'You have nothing to unlock {the} with.',
  noKeyToLock: 'You have nothing to lock {the} with.',
  withKey: '(with {key})',
  unlocked: 'Unlocked.',
  locked: 'Locked.',
  pushNpc: '{The} wouldn\'t appreciate that.',
  wontBudge: '{The} won\'t budge.',
  nothingHappens: 'Nothing obvious happens.',
  cantWear: 'You can\'t wear that.',
  alreadyWorn: 'You\'re already wearing {the}.',
  wear: 'You put on {the}.',
  notWorn: 'You aren\'t wearing that.',
  takeOff: 'You take off {the}.',
  inedible: 'That\'s plainly inedible.',
  cantDrink: 'You can\'t drink that.',
  thrown: 'Thrown.',
  cantBreak: 'Violence isn\'t the answer to this one.',
});

const room = (api) => api.state.roomId;

/* ------------------------------------------------------------------------ *
 *  TAKE / DROP / PUT                                                        *
 * ------------------------------------------------------------------------ */

function take(cmd, api) {
  const run = runOf(api);
  const id = cmd.dobj;
  if (isNpc(api, id)) return refuse(api, 'takeNpc', id);
  if (!isItem(api, id)) return refuse(api, 'fixed');
  if (held(api, id)) return refuse(api, 'alreadyHave');
  const def = itemDef(api, id);
  if (def.fixed || def.scenery) {
    if (def.fixed !== undefined && def.fixed !== true) {
      say(run, def.fixed, undefined, id);
      return FAIL;
    }
    return refuse(api, 'fixed');
  }
  world.moveItem(api.state, id, PLAYER);
  if (itemState(api, id).moved === false) itemState(api, id).moved = true;
  tell(api, 'taken');
  sfx(api, 'pickup');
  discoverCarried(run);
  return OK;
}

function drop(cmd, api) {
  const id = cmd.dobj;
  if (!isItem(api, id) || !world.isCarried(api.state, id)) return refuse(api, 'notHolding');
  moveEntity(runOf(api), id, room(api));
  return succeed(api, 'dropped');
}

/** Is `inner` the same as, or (transitively) inside, `outer`? */
function within(api, inner, outer) {
  let loc = inner;
  for (let steps = 0; typeof loc === 'string' && isItem(api, loc) && steps <= Object.keys(api.state.items).length; steps++) {
    if (loc === outer) return true;
    loc = api.state.items[loc].loc;
  }
  return false;
}

function put(cmd, api) {
  const { dobj: id, iobj: target } = cmd;
  const onto = cmd.prep === 'on';
  if (!isItem(api, id) || !world.isCarried(api.state, id)) return refuse(api, 'notHolding');
  if (id === target || within(api, target, id)) return refuse(api, 'putInside');
  const c = isItem(api, target) ? itemDef(api, target).container : undefined;
  if (!c || (onto && !c.supporter) || (!onto && c.supporter)) return refuse(api, onto ? 'cantPutOn' : 'cantPutIn', target);
  if (!world.isOpen(api.state, api.content, target)) return refuse(api, 'containerClosed', target);
  if (c.capacity !== undefined && world.contentsOf(api.state, target).length >= c.capacity) {
    return refuse(api, onto ? 'noRoomOn' : 'noRoomIn', target);
  }
  moveEntity(runOf(api), id, target);
  return succeed(api, onto ? 'putOn' : 'putIn', id, { target: names(api, target).the });
}

/* ------------------------------------------------------------------------ *
 *  OPEN / CLOSE / UNLOCK / LOCK                                             *
 * ------------------------------------------------------------------------ */

const openable = (api, id) => isItem(api, id) && itemDef(api, id).openable === true;

function open(cmd, api) {
  const id = cmd.dobj;
  if (!openable(api, id)) return refuse(api, 'notOpenable');
  if (itemState(api, id).open) return refuse(api, 'alreadyOpen', id);
  if (itemState(api, id).locked) return refuse(api, 'isLocked', id);
  setItem(runOf(api), id, { open: true });
  const kids = itemDef(api, id).container ? visibleContents(runOf(api), id) : [];
  if (kids.length) tell(api, 'openReveals', id, { list: listJoin(kids.map((k) => nameOf(runOf(api), k, 'indefinite'))) });
  else tell(api, 'opened');
  if (isDoor(api, id)) sfx(api, 'door');
  return OK;
}

function close(cmd, api) {
  const id = cmd.dobj;
  if (!openable(api, id)) return refuse(api, 'notCloseable');
  if (!itemState(api, id).open) return refuse(api, 'alreadyClosed', id);
  setItem(runOf(api), id, { open: false });
  tell(api, 'closed');
  if (isDoor(api, id)) sfx(api, 'door');
  return OK;
}

/**
 * Finds the key for UNLOCK / LOCK: the named `iobj` (must be carried and fit) or the
 * item's `keyId` if carried and reachable (not shut in a carried bag, A8.1), announced
 * "(with the brass key)". Returns null after refusing.
 */
function keyFor(cmd, api, noKeyMsg) {
  const id = cmd.dobj;
  const keyId = itemDef(api, id).keyId;
  if (cmd.iobj !== undefined) {
    if (!isItem(api, cmd.iobj) || !world.isCarried(api.state, cmd.iobj)) {
      refuse(api, 'notHolding');
      return null;
    }
    if (cmd.iobj !== keyId) {
      refuse(api, 'wrongKey', id, { Key: capitalise(names(api, cmd.iobj).the) });
      return null;
    }
    return cmd.iobj;
  }
  if (keyId === undefined || !world.isCarried(api.state, keyId) || unreachable(api, keyId)) {
    refuse(api, noKeyMsg, id);
    return null;
  }
  tell(api, 'withKey', id, { key: names(api, keyId).the });
  return keyId;
}

function unlock(cmd, api) {
  const id = cmd.dobj;
  if (!openable(api, id)) return refuse(api, 'cantUnlock');
  if (!itemState(api, id).locked) return refuse(api, 'notLocked', id);
  if (!keyFor(cmd, api, 'noKey')) return FAIL;
  setItem(runOf(api), id, { locked: false });
  return succeed(api, 'unlocked');
}

function lock(cmd, api) {
  const id = cmd.dobj;
  if (!openable(api, id) || itemDef(api, id).keyId === undefined) return refuse(api, 'cantLock');
  if (itemState(api, id).locked) return refuse(api, 'alreadyLocked', id);
  if (itemState(api, id).open) return refuse(api, 'closeFirst', id);
  if (!keyFor(cmd, api, 'noKeyToLock')) return FAIL;
  setItem(runOf(api), id, { locked: true });
  return succeed(api, 'locked');
}

/* ------------------------------------------------------------------------ *
 *  PUSH / PULL / MOVE, WEAR / REMOVE, EAT / DRINK, THROW, BREAK             *
 * ------------------------------------------------------------------------ */

function shove(cmd, api) {
  const id = cmd.dobj;
  if (isNpc(api, id)) return refuse(api, 'pushNpc', id);
  if (isItem(api, id) && portable(api, id)) return refuse(api, 'nothingHappens');
  return refuse(api, 'wontBudge', id);
}

function wear(cmd, api) {
  const id = cmd.dobj;
  if (!isItem(api, id) || itemDef(api, id).wearable !== true) return refuse(api, 'cantWear');
  if (itemState(api, id).worn) return refuse(api, 'alreadyWorn', id);
  if (!world.isCarried(api.state, id)) return refuse(api, 'notHolding');
  world.moveItem(api.state, id, PLAYER);
  setItem(runOf(api), id, { worn: true });
  return succeed(api, 'wear', id);
}

function remove(cmd, api) {
  const id = cmd.dobj;
  if (!isItem(api, id) || itemState(api, id).worn !== true) return refuse(api, 'notWorn');
  setItem(runOf(api), id, { worn: false });
  return succeed(api, 'takeOff', id);
}

/**
 * Removes an item from play (EAT / DRINK, THROW into a sink). Its contents never keep a
 * `loc` that points at the vanished container: they spill to `spillTo` (a room id), or,
 * for `null`, vanish with it, nested contents included.
 */
function vanish(api, id, spillTo) {
  const run = runOf(api);
  for (const child of world.contentsOf(api.state, id)) {
    if (spillTo === null) vanish(api, child, null);
    else moveEntity(run, child, spillTo);
  }
  moveEntity(run, id, null);
}

/** EAT / DRINK: the item's `edible` / `drinkable` reaction, then it is gone (A8.7). */
function consume(slot, refusal) {
  return (cmd, api) => {
    const id = cmd.dobj;
    const reaction = isItem(api, id) ? itemDef(api, id)[slot] : undefined;
    if (reaction === undefined) return refuse(api, refusal);
    runReaction(runOf(api), reaction, { phase: slot, cmd, self: id });
    vanish(api, id, api.state.roomId);
    return OK;
  };
}

function throwIt(cmd, api) {
  const id = cmd.dobj;
  if (!isItem(api, id) || !world.isCarried(api.state, id)) return refuse(api, 'notHolding');
  const sink = api.content.rooms[room(api)]?.sink;
  if (sink !== undefined) {
    vanish(api, id, null);
    say(runOf(api), sink, undefined, room(api));
    return OK;
  }
  moveEntity(runOf(api), id, room(api));
  return succeed(api, 'thrown');
}

function breakIt(cmd, api) {
  return refuse(api, 'cantBreak', cmd.dobj);
}

export const actions = defineActions({
  take, drop, put, open, close, unlock, lock,
  push: shove, pull: shove, move: shove,
  wear, remove,
  eat: consume('edible', 'inedible'),
  drink: consume('drinkable', 'cantDrink'),
  throw: throwIt,
  break: breakIt,
});
