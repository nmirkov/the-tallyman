// Meta family (A7.4, A10.3): INVENTORY, SCORE, TIME, HELP, VERBOSE / BRIEF, GRAPHICS,
// SOUND / MUSIC / TYPEWRITER / THEME (host setting events), YES / NO outside a question,
// and WAIT (a world verb: 1 turn). All but WAIT are free and skip the turn pipeline.
//
// `system` holds the chain barriers SAVE / LOAD / EXPORT / IMPORT / UNDO / RESTART / QUIT
// (A7.2 K3). They receive `sys` from the game loop for what only it can do:
//   sys.undo()                 restore the UNDO snapshot (or say cantUndo)
//   sys.restart()              new game, refresh bundle
//   sys.confirm(cmd, msgId)    store a PendingConfirm for `cmd` and emit its prompt

import { HOST_SETTINGS, PLAYER, SAVE_SLOTS } from '../types.js';
import {
  runOf, emit, emitText, message, pictureEvent, nameOf, say,
} from '../api.js';
import { serialise } from '../state.js';
import * as world from '../world.js';
import { defineActions, succeed, tell, OK } from './common.js';

export const messages = Object.freeze({
  invHeader: 'You are carrying:',
  invEmpty: 'You are empty-handed.',
  invLit: '(providing light)',
  invWorn: '(being worn)',
  invMoney: 'You have {money}.',
  score: 'Your score is {score} of a possible {maxScore}, in {turns} turns, giving you the rank of {rank}.',
  time: 'It is {time}.',
  helpText: 'Type short commands such as LOOK, EXAMINE DOOR, TAKE KEY, GO NORTH (or just N), INVENTORY (I), SAVE 1, UNDO.',
  verboseOn: 'Full room descriptions on every visit.',
  briefOn: 'Full room descriptions on first visits only.',
  graphicsOn: 'Graphics on.',
  graphicsOff: 'Graphics off.',
  settingUse: 'Use {VERB} ON or {VERB} OFF.',
  themeUse: 'Use THEME C64, THEME SPECTRUM, THEME AMBER or THEME NEXT.',
  rhetorical: 'That was a rhetorical question.',
  wait: 'Time passes.',
});

/* ------------------------------------------------------------------------ *
 *  Information                                                              *
 * ------------------------------------------------------------------------ */

/** Inventory lines: carried items, nested contents of open / transparent containers. */
function inventoryLines(run, holder, depth) {
  const { state, content } = run;
  const lines = [];
  for (const id of world.contentsOf(state, holder)) {
    if (state.items[id].hidden === true) continue;
    let line = `${'  '.repeat(depth)}${nameOf(run, id, 'indefinite')}`;
    if (state.items[id].lit === true) line += ` ${message(run, 'invLit')}`;
    if (state.items[id].worn === true) line += ` ${message(run, 'invWorn')}`;
    lines.push(line);
    const c = content.items[id].container;
    if (c && (c.supporter || c.transparent || world.isOpen(state, content, id))) lines.push(...inventoryLines(run, id, depth + 1));
  }
  return lines;
}

function inventory(cmd, api) {
  const run = runOf(api);
  const lines = inventoryLines(run, PLAYER, 1);
  emitText(run, lines.length ? [message(run, 'invHeader'), ...lines].join('\n') : message(run, 'invEmpty'));
  if (api.state.money > 0) tell(api, 'invMoney');
  return OK;
}

const score = (cmd, api) => succeed(api, 'score');
const time = (cmd, api) => succeed(api, 'time');

function help(cmd, api) {
  const run = runOf(api);
  if (api.content.help !== undefined) say(run, api.content.help, undefined, null);
  else tell(api, 'helpText');
  return OK;
}

/* ------------------------------------------------------------------------ *
 *  Settings (A10.3)                                                         *
 * ------------------------------------------------------------------------ */

function verbose(cmd, api) {
  api.state.settings.verbose = true;
  return succeed(api, 'verboseOn');
}

function brief(cmd, api) {
  api.state.settings.verbose = false;
  return succeed(api, 'briefOn');
}

/** "Use SOUND ON or SOUND OFF." — free, system style, no setting event (A10.3). */
function usage(api, cmd, id) {
  const run = runOf(api);
  emitText(run, message(run, id, { VERB: String(cmd.verbWord ?? cmd.verb).toUpperCase() }), 'system');
  return OK;
}

/** Normalised ON / OFF / TOGGLE argument, or null when invalid (A10.3). */
function onOff(arg) {
  if (arg === undefined) return 'toggle';
  return ['on', 'off', 'toggle'].includes(arg) ? arg : null;
}

function graphics(cmd, api) {
  const run = runOf(api);
  const v = onOff(cmd.arg);
  if (v === null) return usage(api, cmd, 'settingUse');
  const on = v === 'toggle' ? !api.state.settings.graphics : v === 'on';
  api.state.settings.graphics = on;
  emit(run, pictureEvent(run));
  return succeed(api, on ? 'graphicsOn' : 'graphicsOff');
}

/** SOUND / MUSIC / TYPEWRITER / THEME → `host setting` event; the host acknowledges. */
function hostSetting(cmd, api) {
  const key = cmd.verb;
  const value = key === 'theme' ? (cmd.arg ?? 'next') : onOff(cmd.arg);
  if (value === null || !HOST_SETTINGS[key].includes(value)) return usage(api, cmd, key === 'theme' ? 'themeUse' : 'settingUse');
  emit(runOf(api), { type: 'host', op: 'setting', key, value });
  return OK;
}

const rhetorical = (cmd, api) => succeed(api, 'rhetorical');
const wait = (cmd, api) => succeed(api, 'wait');

export const actions = defineActions({
  inventory, score, time, help, verbose, brief, graphics,
  sound: hostSetting, music: hostSetting, typewriter: hostSetting, theme: hostSetting,
  yes: rhetorical, no: rhetorical,
  wait,
});

/* ------------------------------------------------------------------------ *
 *  System verbs / chain barriers (A7.2 K3, A10.2)                           *
 * ------------------------------------------------------------------------ */

/** Slot number for SAVE n / LOAD n, or null after saying slotNeeded. */
function slotOf(cmd, api) {
  const n = /^\d+$/.test(cmd.arg ?? '') ? Number(cmd.arg) : NaN;
  if (SAVE_SLOTS.includes(n)) return n;
  usage(api, cmd, 'slotNeeded');
  return null;
}

/** @type {Record<string, (cmd: object, api: object, sys: object) => void>} */
export const system = Object.freeze({
  save(cmd, api) {
    const slot = slotOf(cmd, api);
    if (slot !== null) emit(runOf(api), { type: 'storage', op: 'save', slot, data: serialise(api.state, api.content) });
  },
  load(cmd, api) {
    const slot = slotOf(cmd, api);
    if (slot !== null) emit(runOf(api), { type: 'storage', op: 'load', slot });
  },
  export(cmd, api) {
    emit(runOf(api), { type: 'host', op: 'export', data: serialise(api.state, api.content) });
  },
  import(cmd, api) {
    emit(runOf(api), { type: 'host', op: 'import' });
  },
  undo(cmd, api, sys) {
    sys.undo();
  },
  restart(cmd, api, sys) {
    if (cmd.confirmed || api.state.ended !== null) sys.restart();
    else sys.confirm(cmd, 'restartConfirm');
  },
  quit(cmd, api, sys) {
    if (cmd.confirmed) emit(runOf(api), { type: 'host', op: 'quit' });
    else sys.confirm(cmd, 'quitConfirm');
  },
});

