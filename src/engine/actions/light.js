// Light family (A8.2): TURN ON / LIGHT, TURN OFF. The re-description when the room's lit
// state changes (A9.2 O5) is done by the action phase (perform.js), not here.

import { runOf, say, setItem, testCond } from '../api.js';
import {
  defineActions, refuse, succeed, isItem, itemDef, itemState, FAIL,
} from './common.js';

export const messages = Object.freeze({
  notSwitchable: 'That\'s not something you can switch on.',
  notSwitchableOff: 'That\'s not something you can switch off.',
  alreadyOn: '{The} is already on.',
  alreadyOff: '{The} is already off.',
  burntOut: '{The} is spent.',
  lightNeeds: 'Nothing happens.',
  switchedOn: '{The} is now on.',
  switchedOff: '{The} is now off.',
});

const isLight = (api, id) => isItem(api, id) && itemDef(api, id).light !== undefined;

function turnOn(cmd, api) {
  const id = cmd.dobj;
  if (!isLight(api, id)) return refuse(api, 'notSwitchable');
  const st = itemState(api, id);
  if (st.lit) return refuse(api, 'alreadyOn', id);
  if (st.fuel === 0) return refuse(api, 'burntOut', id);
  const light = itemDef(api, id).light;
  if (light.needs !== undefined && !testCond(runOf(api), light.needs)) {
    if (light.needsMsg !== undefined) say(runOf(api), light.needsMsg, undefined, id);
    else refuse(api, 'lightNeeds');
    return FAIL;
  }
  setItem(runOf(api), id, { lit: true });
  return succeed(api, 'switchedOn', id);
}

function turnOff(cmd, api) {
  const id = cmd.dobj;
  if (!isLight(api, id)) return refuse(api, 'notSwitchableOff');
  if (!itemState(api, id).lit) return refuse(api, 'alreadyOff', id);
  setItem(runOf(api), id, { lit: false });
  return succeed(api, 'switchedOff', id);
}

export const actions = defineActions({ turn_on: turnOn, turn_off: turnOff });
