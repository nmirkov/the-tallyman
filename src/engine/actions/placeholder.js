// TT-009 slot: NPC and case verbs (TALK, ASK, TELL, SHOW, GIVE, BUY, ACCUSE, NOTES, HINT).
// Until TT-009 registers `npc.js` / `case.js` in index.js, these placeholders keep every
// verb answerable: world verbs still cost their turn and run `before` / `after` slots
// (so content reactions on NPCs already work); NOTES / HINT are free.

import { defineActions, refuse, succeed } from './common.js';

export const messages = Object.freeze({
  npcNoResponse: 'Nothing comes of it.',
  notesEmpty: 'Your notebook is empty.',
  hintNone: 'No hints are available yet.',
});

const noResponse = (cmd, api) => refuse(api, 'npcNoResponse', cmd.dobj);

export const actions = defineActions({
  talk: noResponse,
  ask: noResponse,
  tell: noResponse,
  show: noResponse,
  give: noResponse,
  buy: noResponse,
  accuse: noResponse,
  notes: (cmd, api) => succeed(api, 'notesEmpty'),
  hint: (cmd, api) => succeed(api, 'hintNone'),
});
