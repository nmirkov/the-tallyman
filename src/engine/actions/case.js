// Case family (PLAN §2.5, A4.10, A4.11, A4.13, A8.8, A8.11, A14 rules 2–5): ACCUSE,
// NOTES and HINT. The engine supplies the generic machinery; the story-specific outcomes
// are `content.case` reactions (`correct`, `weak`, `wrong`, `other`).
//
// ACCUSE X (world verb, A7.4):
//   not present            → resolution error `accuse.notHere` (free, resolve.js)
//   X ∈ case.suspects      → confirm(): PendingConfirm `case.confirm` (free); YES re-runs
//                            with `confirmed` → `case.wrong` (1 turn); NO / anything else
//                            → `case.cancelText` / "(Cancelled.)", no turn (game.js, A7.3)
//   X = case.culprit       → evidence ≥ threshold ? `case.correct` : `case.weak` (1 turn)
//   any other NPC          → `case.other` or `accuseOther` (1 turn)
// NOTES and HINT are meta verbs: free in turns; HINT costs `scoring.hintCost` points.

import { PLAYER, RULE_DEFAULTS } from '../types.js';
import {
  runOf, runReaction, renderText, emitText, emit, message, statusEvent,
} from '../api.js';
import * as world from '../world.js';
import {
  defineActions, refuse, tell, isNpc, OK, FAIL,
} from './common.js';

export const messages = Object.freeze({
  accuseConfirm: 'Are you certain? (Y/N)',
  accuseNoCase: 'You have no case to make against anyone.',
  accuseOther: 'You have nothing to pin on {the}.',
  accuseThing: 'You can only accuse a person.',
  accuseSelf: 'You would have some explaining to do at the station.',
  notesEmpty: 'Your notebook is empty.',
  notesHeader: 'Your notebook:',
  evidenceHeader: 'Evidence ({n}):',
  notesLine: '  {text}',
  notWithYou: '{label} (not with you)',
  hintDone: 'You have everything you need. Finish it.',
});

/* ------------------------------------------------------------------------ *
 *  ACCUSE                                                                   *
 * ------------------------------------------------------------------------ */

const caseDef = (api) => api.content.case;
const isSuspect = (api, id) => {
  const c = caseDef(api);
  return !!c && id !== c.culprit && Array.isArray(c.suspects) && c.suspects.includes(id);
};

/**
 * Free confirmation before accusing a suspect (A7.3, A14 rule 5).
 * @param {import('../types.js').Command} cmd
 * @param {import('../types.js').HookApi} api
 * @returns {import('../types.js').PendingConfirm|null}
 */
function confirmAccuse(cmd, api) {
  if (!isSuspect(api, cmd.dobj)) return null;
  const run = runOf(api);
  const c = caseDef(api);
  const command = { verb: cmd.verb, verbWord: cmd.verbWord ?? cmd.verb, dobj: cmd.dobj, raw: cmd.raw ?? cmd.verb };
  const text = c.confirm !== undefined ? renderText(run, c.confirm, cmd.dobj) : '';
  const pending = { kind: 'confirm', text: text || message(run, 'accuseConfirm'), command };
  if (c.cancelText !== undefined) {
    const cancel = renderText(run, c.cancelText, cmd.dobj);
    if (cancel) pending.cancelText = cancel;
  }
  return pending;
}

/** Runs a case outcome reaction (hook phase `case`, self = the accused). */
function outcome(api, cmd, reaction) {
  return runReaction(runOf(api), reaction, { phase: 'case', cmd, self: cmd.dobj }).fired;
}

function accuse(cmd, api) {
  const id = cmd.dobj;
  const c = caseDef(api);
  if (id === PLAYER) return refuse(api, 'accuseSelf');
  if (!isNpc(api, id)) return refuse(api, 'accuseThing', id);
  if (!c) return refuse(api, 'accuseNoCase', id);
  if (id === c.culprit) {
    const strong = world.evidenceCount(api.state, api.content) >= c.threshold;
    outcome(api, cmd, strong ? c.correct : c.weak);
    return OK;
  }
  if (isSuspect(api, id)) {
    // Only reachable after YES (game.js asks first); an unconfirmed command never runs.
    outcome(api, cmd, c.wrong);
    return OK;
  }
  if (c.other !== undefined && outcome(api, cmd, c.other)) return OK;
  return refuse(api, 'accuseOther', id);
}

/* ------------------------------------------------------------------------ *
 *  NOTES (A8.8)                                                             *
 * ------------------------------------------------------------------------ */

function notes(cmd, api) {
  const run = runOf(api);
  const { state, content } = api;
  const line = (text) => message(run, 'notesLine', { text });
  const noted = state.notes.map((id) => renderText(run, content.notes?.[id], null)).filter(Boolean);
  const found = state.evidence.filter((id) => content.evidence?.[id]).map((id) => {
    const ev = content.evidence[id];
    const away = ev.item !== undefined && !world.isCarried(state, ev.item);
    return away ? message(run, 'notWithYou', { label: ev.label }) : ev.label;
  });
  if (!noted.length && !found.length) {
    tell(api, 'notesEmpty');
    return OK;
  }
  if (noted.length) emitText(run, [message(run, 'notesHeader'), ...noted.map(line)].join('\n'));
  if (found.length) {
    const n = world.evidenceCount(state, content);
    emitText(run, [message(run, 'evidenceHeader', { n }), ...found.map(line)].join('\n'));
  }
  return OK;
}

/* ------------------------------------------------------------------------ *
 *  HINT (A8.11)                                                             *
 * ------------------------------------------------------------------------ */

function hint(cmd, api) {
  const run = runOf(api);
  const { state, content } = api;
  const step = (content.hints ?? []).find((h) => !api.test(h.done));
  if (!step || !Array.isArray(step.tiers) || step.tiers.length === 0) {
    tell(api, 'hintDone');
    return FAIL;
  }
  const tier = Math.min(state.hintTiers[step.id] ?? 0, step.tiers.length - 1);
  emitText(run, renderText(run, step.tiers[tier], null));
  state.hintTiers[step.id] = Math.min(tier + 1, step.tiers.length - 1);
  const cost = content.scoring?.hintCost ?? RULE_DEFAULTS.hintCost;
  state.score = Math.max(0, state.score - cost);
  emit(run, statusEvent(run));
  return OK;
}

export const actions = defineActions({
  accuse: { run: accuse, confirm: confirmAccuse },
  notes,
  hint,
});
