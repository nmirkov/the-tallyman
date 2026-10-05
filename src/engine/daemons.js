// Per-turn daemon steps D1–D9 (A7.6), data-driven from content: clock, scripted beats
// (A4.12), NPC schedules, story daemons (counters such as the attack counter, delayed
// arrivals), light / fuel (A8.2), nerve & panic (A8.10), ambience (O6), endings
// precedence (A7.7) and the status event. The `end` event itself is emitted by game.js
// after these steps.
//
// Every step reads content and changes state only through the shared engine services in
// api.js, so a Reaction run here behaves exactly like one run by an action.

import { MIDNIGHT_TURN, RULE_DEFAULTS } from './types.js';
import { isLit, isVisible } from './world.js';
import {
  emit, say, sayMessage, runReaction, testCond, moveEntity, enterRoom, syncLight,
  statusEvent, ambientFor, nameParams,
} from './api.js';

/**
 * @typedef {import('./api.js').Run} Run
 * @typedef {import('./types.js').Command} Command
 * @typedef {{id: string, always: boolean, run: (run: Run, cmd: Command|null) => void}} DaemonStep
 */

/** Default texts of the daemon steps; overridable via `content.messages` (A16). */
export const DAEMON_MESSAGES = Object.freeze({
  lightOut: '{The} goes out.',
  panic: 'Your nerve breaks. You run, and do not stop until you are somewhere with light.',
});

const ended = (run) => run.state.ended !== null;

/* ------------------------------------------------------------------------ *
 *  D1 clock                                                                 *
 * ------------------------------------------------------------------------ */

/** @param {Run} run */
function clock(run) {
  run.state.turn = Math.min(run.state.turn + 1, MIDNIGHT_TURN);
}

/* ------------------------------------------------------------------------ *
 *  D2 scripted beats (A4.12)                                                *
 * ------------------------------------------------------------------------ */

/** `once` defaults to true for `when`-only beats, false otherwise. */
const isOnce = (beat) => beat.once ?? (beat.at === undefined && beat.every === undefined);

/** @param {Run} run @param {object} beat */
function beatEligible(run, beat) {
  const { turn, fired } = run.state;
  if (beat.at === undefined && beat.every === undefined && beat.when === undefined) return false;
  if (beat.at !== undefined && turn !== beat.at) return false;
  if (beat.every !== undefined && (beat.every <= 0 || turn % beat.every !== 0)) return false;
  if (isOnce(beat) && fired.includes(beat.id)) return false;
  return beat.when === undefined || testCond(run, beat.when);
}

/** @param {Run} run @param {Command|null} cmd */
function beats(run, cmd) {
  for (const beat of run.content.beats ?? []) {
    if (ended(run)) return;
    if (!beatEligible(run, beat)) continue;
    const { fired } = runReaction(run, beat.run, { phase: 'beat', cmd, self: null });
    // A once-beat is spent only when it actually fired (a failed `chance` retries later).
    if (fired && isOnce(beat) && !run.state.fired.includes(beat.id)) run.state.fired.push(beat.id);
  }
}

/* ------------------------------------------------------------------------ *
 *  D3 NPC schedules                                                         *
 * ------------------------------------------------------------------------ */

/** @param {Run} run @param {Command|null} cmd */
function schedules(run, cmd) {
  const { state, content } = run;
  for (const npcId of Object.keys(content.npcs)) {
    for (const entry of content.npcs[npcId].schedule ?? []) {
      if (ended(run)) return;
      if (entry.at !== state.turn) continue;
      if (entry.if !== undefined && !testCond(run, entry.if)) continue;
      const from = state.npcs[npcId].loc;
      const to = entry.to ?? null;
      moveEntity(run, npcId, to);
      // The player sees comings and goings only in a lit room (A7.6 D3).
      const sees = from !== to && isLit(state, content);
      if (sees && entry.leaveText !== undefined && from === state.roomId) say(run, entry.leaveText, undefined, npcId);
      if (sees && entry.arriveText !== undefined && to === state.roomId) say(run, entry.arriveText, undefined, npcId);
      if (entry.do !== undefined) runReaction(run, entry.do, { phase: 'schedule', cmd, self: npcId });
    }
  }
}

/* ------------------------------------------------------------------------ *
 *  D4 story daemons                                                         *
 * ------------------------------------------------------------------------ */

/** @param {Run} run @param {Command|null} cmd */
function storyDaemons(run, cmd) {
  for (const daemon of run.content.daemons ?? []) {
    if (ended(run)) return;
    runReaction(run, daemon.run, { phase: 'daemon', cmd, self: null });
  }
}

/* ------------------------------------------------------------------------ *
 *  D5 light (fuel)                                                          *
 * ------------------------------------------------------------------------ */

/** Fuel burn; the O5 re-description follows from runDaemons' syncLight. @param {Run} run */
function light(run) {
  const { state, content } = run;
  for (const id of Object.keys(state.items)) {
    const st = state.items[id];
    if (st.lit !== true || typeof st.fuel !== 'number') continue;
    st.fuel = Math.max(0, st.fuel - 1);
    if (st.fuel > 0) continue;
    const seen = isVisible(state, content, id);     // before it goes out: its own light may be what shows it
    st.lit = false;
    if (!seen) continue;
    const outText = content.items[id].light?.outText;
    if (outText !== undefined) say(run, outText, undefined, id);
    else sayMessage(run, 'lightOut', nameParams(run, id));
  }
}

/* ------------------------------------------------------------------------ *
 *  D6 nerve & panic (A8.10)                                                 *
 * ------------------------------------------------------------------------ */

/** Nerve tuning: RULE_DEFAULTS.nerve overridden by rules.nerve. */
export function nerveRules(content) {
  return { ...RULE_DEFAULTS.nerve, ...(content.rules?.nerve ?? {}) };
}

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/** @param {Run} run */
function nerve(run) {
  const { state, content } = run;
  const tun = nerveRules(content);
  const n0 = run.turnStart?.nerve ?? state.nerve;
  const room = content.rooms[state.roomId];
  const zone = content.zones?.[room.zone] ?? {};

  // 1–2: per-turn delta (deltas applied during the turn are already in state.nerve).
  let base;
  if (!isLit(state, content)) base = tun.dark;
  else if (zone.safeRoom === state.roomId) base = tun.safe;
  else if (!room.dark) base = tun.lit;
  else base = 0;
  let n = clamp(Math.round(state.nerve + base + (room.nerve ?? 0)), 0, tun.max);

  // 3: zone cap. The text marks the turn the cap is first reached (n0 below it).
  if (typeof zone.nerveCap === 'number') {
    n = Math.min(n, zone.nerveCap);
    if (n === zone.nerveCap && n0 < zone.nerveCap && zone.capText !== undefined) say(run, zone.capText, 'alert', null);
  }
  state.nerve = n;

  // 4: threshold messages crossed on the way up, ascending.
  const messages = [...(tun.messages ?? [])].sort((a, b) => a.at - b.at);
  for (const m of messages) if (n0 < m.at && m.at <= n) say(run, m.text, 'alert', null);

  // 5: panic, or count the cooldown down.
  if (n >= tun.panicAt && state.panicCooldown === 0 && zone.panic !== false && zone.safeRoom !== undefined) {
    const text = zone.panicText ?? tun.panicText;
    if (text !== undefined) say(run, text, 'alert', null);
    else sayMessage(run, 'panic', {}, 'alert');
    emit(run, { type: 'sfx', id: 'sting' });
    enterRoom(run, zone.safeRoom);
    state.nerve = tun.panicReset;
    state.panicCooldown = tun.panicCooldown;
    run.panicked = true;
  } else if (state.panicCooldown > 0) {
    state.panicCooldown -= 1;
  }
}

/* ------------------------------------------------------------------------ *
 *  D7 ambience, D8 endings, D9 status                                       *
 * ------------------------------------------------------------------------ */

/** @param {Run} run */
function ambience(run) {
  const id = ambientFor(run.state, run.content);
  if (id !== run.turnStart?.ambient) emit(run, { type: 'ambient', id });
}

/**
 * E1: an ending already set this turn (death, wrong man) stands. Otherwise the first
 * `when` ending in content order wins — content orders victory before the midnight
 * endings, so victory on turn 300 beats midnight (E2).
 * @param {Run} run
 */
function endings(run) {
  if (ended(run)) return;
  const ending = (run.content.endings ?? []).find((e) => e.when !== undefined && testCond(run, e.when));
  if (!ending) return;
  run.state.ended = ending.id;
  run.state.ctx.pending = null;
}

/** @param {Run} run */
function status(run) {
  emit(run, statusEvent(run));
}

/* ------------------------------------------------------------------------ *
 *  Pipeline                                                                 *
 * ------------------------------------------------------------------------ */

/**
 * Daemon steps in pipeline order (A7.6). `always` steps run even after the game ended
 * this turn (C10); the others are skipped once `state.ended` is set.
 * @type {ReadonlyArray<DaemonStep>}
 */
export const DAEMON_STEPS = Object.freeze([
  { id: 'D1 clock', always: true, run: clock },
  { id: 'D2 beats', always: false, run: beats },
  { id: 'D3 schedules', always: false, run: schedules },
  { id: 'D4 story daemons', always: false, run: storyDaemons },
  { id: 'D5 light', always: false, run: light },
  { id: 'D6 nerve & panic', always: false, run: nerve },
  { id: 'D7 ambience', always: false, run: ambience },
  { id: 'D8 endings', always: true, run: endings },
  { id: 'D9 status', always: true, run: status },
].map((s) => Object.freeze(s)));

/**
 * Runs D1–D9 for one world command. `run.turnStart` must hold the values from before
 * the action phase (`ambient`, `nerve`). Cond hooks evaluated by the steps see `cmd`.
 * After every step the presentation follows any lighting change that step made (A9.2 O5:
 * a beat, schedule, story daemon or burn-out that lights or darkens the room).
 * @param {Run} run
 * @param {Command|null} [cmd]
 */
export function runDaemons(run, cmd = null) {
  const saved = run.args;
  run.args = { phase: null, cmd, self: null };
  try {
    for (const step of DAEMON_STEPS) {
      if (!step.always && ended(run)) continue;
      step.run(run, cmd);
      syncLight(run);
    }
  } finally {
    run.args = saved;
  }
}
