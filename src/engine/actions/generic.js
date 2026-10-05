// Deliberate generic responses for world verbs whose real behaviour is pure content
// (`before` reactions on rooms / items / NPCs, A7.5): TOUCH, ATTACK, USE, OIL, TEAR, CUT,
// CALL, ARREST, FREE, SWIM, JUMP. Engine defaults never destroy anything (A8.7).

import { defineActions, refuse, isNpc } from './common.js';

export const messages = Object.freeze({
  touchThing: 'You feel nothing unexpected.',
  attackNpc: 'Violence won\'t solve this.',
  attackThing: 'Lashing out at {the} achieves nothing.',
  useWhat: 'You\'ll have to be more specific about how.',
  oilNothing: 'You have nothing suitable to oil {the} with.',
  oilWith: 'That doesn\'t help.',
  cantTear: 'You can\'t tear {the}.',
  cantCut: 'You can\'t cut {the}.',
  cutNothing: 'You have nothing to cut {the} with.',
  callNobody: 'There\'s no one to call.',
  callNoAnswer: 'There\'s no answer.',
  arrestNpc: 'On what grounds? You need more than a hunch.',
  arrestThing: 'You can\'t arrest {the}.',
  freeThing: '{The} doesn\'t need freeing.',
  swim: 'This is no night for a swim.',
  jump: 'You jump on the spot. Nothing happens.',
});

/** A handler that refuses with `npcMsg` for NPCs and `thingMsg` otherwise. */
const byKind = (npcMsg, thingMsg) => (cmd, api) => refuse(api, isNpc(api, cmd.dobj) ? npcMsg : thingMsg, cmd.dobj);

export const actions = defineActions({
  touch: (cmd, api) => refuse(api, 'touchThing', cmd.dobj),
  attack: byKind('attackNpc', 'attackThing'),
  use: (cmd, api) => refuse(api, 'useWhat', cmd.dobj),
  oil: (cmd, api) => refuse(api, cmd.iobj === undefined ? 'oilNothing' : 'oilWith', cmd.dobj),
  tear: (cmd, api) => refuse(api, 'cantTear', cmd.dobj),
  cut: (cmd, api) => refuse(api, cmd.iobj === undefined ? 'cutNothing' : 'cantCut', cmd.dobj),
  call: (cmd, api) => refuse(api, cmd.dobj === undefined ? 'callNobody' : 'callNoAnswer', cmd.dobj),
  arrest: byKind('arrestNpc', 'arrestThing'),
  free: (cmd, api) => refuse(api, 'freeThing', cmd.dobj),
  swim: (cmd, api) => refuse(api, 'swim'),
  jump: (cmd, api) => refuse(api, 'jump'),
});
