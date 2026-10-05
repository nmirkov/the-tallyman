// Observation family (A8.4, A8.6): LOOK, EXAMINE, SEARCH, READ, LISTEN, SMELL. Each costs
// 1 turn (C11). EXAMINE never reveals hidden items; SEARCH does.

import { PLAYER } from '../types.js';
import {
  runOf, describeRoom, renderText, emitText, sayContents, reveal, runReaction, kindOf,
} from '../api.js';
import * as world from '../world.js';
import {
  defineActions, refuse, succeed, tell, isItem, isNpc, OK,
} from './common.js';

export const messages = Object.freeze({
  nothingSpecial: 'You see nothing special about {the}.',
  examineClosed: 'It is closed.',
  nothingFound: 'You find nothing of interest.',
  searchDark: 'You grope around in the dark but find nothing.',
  searchClosed: '{The} is closed.',
  searchNpc: '{The} would not take kindly to being searched.',
  readDark: 'It\'s too dark to read.',
  notReadable: 'There\'s nothing written on {the}.',
  listenNothing: 'You hear nothing unusual.',
  listenTo: '{The} makes no sound.',
  smellNothing: 'You smell nothing unusual.',
  smellThing: '{The} smells much as you would expect.',
});

const lit = (api) => world.isLit(api.state, api.content);

function look(cmd, api) {
  describeRoom(runOf(api));
  return OK;
}

function examine(cmd, api) {
  const run = runOf(api);
  const id = cmd.dobj;
  if (!lit(api)) return refuse(api, 'tooDark');
  let desc = '';
  switch (kindOf(run, id)) {
    case 'item': desc = renderText(run, api.content.items[id].desc, id); break;
    case 'npc': desc = renderText(run, api.content.npcs[id].desc, id); break;
    case 'scenery': desc = renderText(run, world.sceneryOf(api.content, id).desc, id); break;
    default: break;
  }
  if (desc) emitText(run, desc);
  else tell(api, 'nothingSpecial', id);
  if (isItem(api, id)) {
    const def = api.content.items[id];
    const shown = sayContents(run, id);
    if (!shown && def.container && def.openable && !world.isOpen(api.state, api.content, id)) tell(api, 'examineClosed', id);
  }
  return OK;
}

/** Hidden items whose location chain reaches `roomId` through open containers only (A8.6). */
function hiddenInRoom(api, roomId) {
  const { state, content } = api;
  return Object.keys(state.items).filter((id) => {
    if (state.items[id].hidden !== true) return false;
    let loc = state.items[id].loc;
    for (let steps = 0; typeof loc === 'string' && steps <= Object.keys(state.items).length; steps++) {
      if (loc === roomId) return true;
      if (loc === PLAYER || !Object.prototype.hasOwnProperty.call(state.items, loc)) return false;
      if (!world.isOpen(state, content, loc)) return false;
      loc = state.items[loc].loc;
    }
    return false;
  });
}

function revealAll(api, ids) {
  for (const id of ids) reveal(runOf(api), id);
  return ids.length > 0;
}

function search(cmd, api) {
  const id = cmd.dobj;
  if (id === undefined) {
    if (!lit(api)) return refuse(api, 'searchDark');
    if (!revealAll(api, hiddenInRoom(api, api.state.roomId))) tell(api, 'nothingFound');
    return OK;
  }
  if (isNpc(api, id)) return refuse(api, 'searchNpc', id);
  if (!lit(api) && !world.isCarried(api.state, id)) return refuse(api, 'searchDark');
  if (!isItem(api, id)) return succeed(api, 'nothingFound');
  if (!world.isOpen(api.state, api.content, id)) return refuse(api, 'searchClosed', id);
  const hidden = world.contentsOf(api.state, id).filter((c) => api.state.items[c].hidden === true);
  if (revealAll(api, hidden)) return OK;
  if (!sayContents(runOf(api), id)) tell(api, 'nothingFound');
  return OK;
}

function read(cmd, api) {
  const id = cmd.dobj;
  if (!lit(api)) return refuse(api, 'readDark');
  const readable = isItem(api, id) ? api.content.items[id].readable : undefined;
  if (readable === undefined) return refuse(api, 'notReadable', id);
  runReaction(runOf(api), readable, { phase: 'readable', cmd, self: id });
  return OK;
}

function listen(cmd, api) {
  return cmd.dobj === undefined ? succeed(api, 'listenNothing') : succeed(api, 'listenTo', cmd.dobj);
}

function smell(cmd, api) {
  return cmd.dobj === undefined ? succeed(api, 'smellNothing') : succeed(api, 'smellThing', cmd.dobj);
}

export const actions = defineActions({ look, examine, search, read, listen, smell });
