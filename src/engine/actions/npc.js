// NPC family (A4.8, A4.9, A8.7, A8.9): TALK TO, ASK / TELL X ABOUT Y, SHOW X TO Y,
// GIVE X TO Y, BUY X [FROM Y] — plus the self-reference rules (ME / MYSELF, TT-009).
// Every verb here costs 1 turn. Personal / critical protection for GIVE already ran in
// protect.js (A7.5 step 2) before these handlers, so a critical item only reaches `give`
// when the recipient `accepts` it.

import { PLAYER } from '../types.js';
import {
  runOf, runReaction, moveEntity, adjustMoney, say,
} from '../api.js';
import { formatMoney } from '../text.js';
import * as world from '../world.js';
import {
  defineActions, refuse, tell, isItem, isNpc, OK, FAIL,
} from './common.js';

const hasOwn = (obj, key) => obj != null && Object.prototype.hasOwnProperty.call(obj, key);

export const messages = Object.freeze({
  topicNothing: '{The} has nothing to say about that.',
  talkNothing: '{The} has nothing to say to you.',
  talkThing: 'You can\'t talk to {the}.',
  talkSelf: 'You mutter to yourself. It doesn\'t help.',
  showDefault: '{The} glances at it, unimpressed.',
  showNotNpc: 'Only people are worth showing things to.',
  showSelf: 'You look at {the} again. Nothing new strikes you.',
  giveRefuse: '{The} doesn\'t want it.',
  giveNotNpc: 'You can only give things to people.',
  giveSelf: 'You already have {the}.',
  buyNoSale: 'There\'s nothing like that for sale here.',
  buyNotFrom: '{The} doesn\'t sell that.',
  buyRefused: '{The} won\'t sell you that.',
  buyHaveOne: 'You\'ve already got one of those.',
  cantAfford: 'You can\'t afford it.',
  bought: 'You buy {a} for {price}.',
  examineSelf: 'As good as can be expected, given the night.',
  selfDefault: 'You leave yourself well alone.',
});

const npcDef = (api, id) => api.content.npcs[id];

/** Runs an NPC slot reaction with the NPC as `self`; false when absent or nothing fired. */
function npcReact(api, cmd, npcId, reaction, phase) {
  if (reaction === undefined || reaction === null) return false;
  return runReaction(runOf(api), reaction, { phase, cmd, self: npcId }).fired;
}

/** Refusal for a non-NPC conversation partner: yourself or a thing. */
function notAPerson(api, id, selfMsg, thingMsg) {
  return refuse(api, id === PLAYER ? selfMsg : thingMsg, id);
}

/* ------------------------------------------------------------------------ *
 *  TALK / ASK / TELL (A4.8, A4.9)                                           *
 * ------------------------------------------------------------------------ */

function talk(cmd, api) {
  const id = cmd.dobj;
  if (!isNpc(api, id)) return notAPerson(api, id, 'talkSelf', 'talkThing');
  const npc = npcDef(api, id);
  if (!npcReact(api, cmd, id, npc.talk ?? npc.default, 'talk')) tell(api, 'talkNothing', id);
  return OK;
}

/** ASK and TELL share the NPC's topic table (A4.9); unmatched → `default`. */
function converse(cmd, api) {
  const id = cmd.dobj;
  if (!isNpc(api, id)) return notAPerson(api, id, 'talkSelf', 'talkThing');
  const npc = npcDef(api, id);
  const topic = typeof cmd.topic === 'string' ? cmd.topic : null;
  const entry = topic !== null && hasOwn(npc.topics, topic) ? npc.topics[topic] : null;
  if (npcReact(api, cmd, id, entry, 'topic')) return OK;
  if (!npcReact(api, cmd, id, npc.default, 'topic')) tell(api, 'topicNothing', id);
  return OK;
}

/* ------------------------------------------------------------------------ *
 *  SHOW / GIVE (A4.8, A8.7)                                                 *
 * ------------------------------------------------------------------------ */

/** The dobj of SHOW / GIVE must be an item the player carries. */
const carriedItem = (api, id) => isItem(api, id) && world.isCarried(api.state, id);

function show(cmd, api) {
  const { dobj: id, iobj: to } = cmd;
  if (id === PLAYER) return refuse(api, 'selfDefault');
  if (!carriedItem(api, id)) return refuse(api, 'notHolding');
  if (to === PLAYER) return refuse(api, 'showSelf', id);
  if (!isNpc(api, to)) return refuse(api, 'showNotNpc');
  if (!npcReact(api, cmd, to, npcDef(api, to).shows?.[id], 'shows')) tell(api, 'showDefault', to);
  return OK;
}

function give(cmd, api) {
  const { dobj: id, iobj: to } = cmd;
  if (id === PLAYER) return refuse(api, 'selfDefault');
  if (!carriedItem(api, id)) return refuse(api, 'notHolding');
  if (to === PLAYER) return refuse(api, 'giveSelf', id);
  if (!isNpc(api, to)) return refuse(api, 'giveNotNpc');
  const npc = npcDef(api, to);
  if (!hasOwn(npc.accepts, id)) {
    if (!npcReact(api, cmd, to, npc.refuse, 'accepts')) tell(api, 'giveRefuse', to);
    return FAIL;
  }
  moveEntity(runOf(api), id, to);
  npcReact(api, cmd, to, npc.accepts[id], 'accepts');
  return OK;
}

/* ------------------------------------------------------------------------ *
 *  BUY (A8.9)                                                               *
 * ------------------------------------------------------------------------ */

/** The NPC selling `itemId`: the named one (BUY X FROM Y) or the first here, content order. */
function sellerOf(api, itemId) {
  for (const npcId of world.npcsIn(api.state, api.state.roomId)) {
    if (hasOwn(npcDef(api, npcId).sells, itemId)) return npcId;
  }
  return null;
}

function buy(cmd, api) {
  const run = runOf(api);
  const id = cmd.dobj;
  let seller;
  if (cmd.iobj !== undefined) {
    if (!isNpc(api, cmd.iobj)) return refuse(api, 'buyNoSale');
    if (!isItem(api, id) || !hasOwn(npcDef(api, cmd.iobj).sells, id)) return refuse(api, 'buyNotFrom', cmd.iobj);
    seller = cmd.iobj;
  } else {
    seller = isItem(api, id) ? sellerOf(api, id) : null;
    if (seller === null) return refuse(api, 'buyNoSale');
  }
  const entry = npcDef(api, seller).sells[id];
  if (entry.if !== undefined && !api.test(entry.if)) {
    if (entry.refuse !== undefined) say(run, entry.refuse, undefined, seller);
    else tell(api, 'buyRefused', seller);
    return FAIL;
  }
  if (api.state.items[id].loc !== null) return refuse(api, 'buyHaveOne', id);
  if (api.state.money < entry.price) return refuse(api, 'cantAfford', id);
  adjustMoney(run, -entry.price);
  // The purchase text comes before the discovery output, like "Taken." (TT-008 decision 5).
  if (entry.text !== undefined) say(run, entry.text, undefined, seller);
  else tell(api, 'bought', id, { price: formatMoney(entry.price) });
  moveEntity(run, id, PLAYER);
  return OK;
}

export const actions = defineActions({
  talk,
  ask: converse,
  tell: converse,
  show,
  give,
  buy,
});

/* ------------------------------------------------------------------------ *
 *  Self-reference (TT-009)                                                  *
 * ------------------------------------------------------------------------ */

/** Verbs whose handlers deal with the player as an object themselves. */
const SELF_AWARE = new Set(['talk', 'ask', 'tell', 'show', 'give', 'buy', 'accuse']);

/**
 * Wraps a world handler so that ME / MYSELF as an object never reaches code written for
 * items and NPCs: EXAMINE ME describes you (`examineSelf`), other verbs say
 * `selfDefault`. Verbs in SELF_AWARE handle the player themselves.
 * @param {import('./common.js').ActionDef} def
 * @returns {import('./common.js').ActionDef}
 */
export function selfAware(def) {
  if (SELF_AWARE.has(def.verb)) return def;
  const inner = def.run;
  return Object.freeze({
    ...def,
    run(cmd, api) {
      if (cmd.dobj !== PLAYER && cmd.iobj !== PLAYER) return inner(cmd, api);
      if (def.verb === 'examine' && cmd.dobj === PLAYER) {
        tell(api, 'examineSelf');
        return OK;
      }
      return refuse(api, 'selfDefault');
    },
  });
}
