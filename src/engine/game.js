// The game loop (A2, A7): createGame, input processing with chains / barriers / pending
// questions, the per-turn pipeline, UNDO, refresh bundles and error containment.
//
// One input line (A7.1): normalise → ended-game gate → empty line → split into segments
// (≤ 16) → for each segment: [answer a pending question] → parse → AGAIN → barrier →
// resolve → meta handler (free) | world turn (A7.5 action phase + A7.6 steps) → STOP rules
// → chain notice before the terminal event → output normaliser.

import {
  LIMITS, CHAIN_BARRIERS, ENDED_VERBS, TERMINAL_EVENT_TYPES, TERMINAL_HOST_OPS,
} from './types.js';
import { normalise } from './text.js';
import { buildVocab } from './vocab.js';
import { normaliseInput, tokenise, splitChain, parseCommand } from './parser.js';
import { createState, clone, serialise, validateSave } from './state.js';
import { isLit } from './world.js';
import {
  resolve, answerPending, repeatLast, recordExecuted, parseErrorResult,
} from './resolve.js';
import {
  createRun, emit, emitText, message, say, runReaction, describeRoom, roomEvent, pictureEvent,
  statusEvent, endEvent, ambientFor, withCommand, syncLight,
} from './api.js';
import { ACTIONS, SYSTEM_ACTIONS, ACTION_MESSAGES, performAction } from './actions/index.js';
import { DAEMON_STEPS, DAEMON_MESSAGES, runDaemons } from './daemons.js';

/**
 * @typedef {import('./types.js').OutputEvent} OutputEvent
 * @typedef {import('./types.js').Command} Command
 * @typedef {import('./api.js').Run} Run
 */

const STOP = true;
const GO_ON = false;

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

/** G3: structural sanity of the bundle (lint catches the rest earlier). */
function checkBundle(content) {
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  if (!isObj(content)) throw new TypeError('createGame: content must be a ContentBundle object');
  for (const key of ['rules', 'rooms', 'items', 'npcs']) {
    if (!isObj(content[key])) throw new TypeError(`createGame: content.${key} is missing`);
  }
  if (!Object.prototype.hasOwnProperty.call(content.rooms, content.rules.start)) {
    throw new TypeError(`createGame: rules.start "${content.rules.start}" is not a room`);
  }
}

/** Terminal events end a call (A9.2 O2). */
function isTerminal(ev) {
  return TERMINAL_EVENT_TYPES.includes(ev.type) || (ev.type === 'host' && TERMINAL_HOST_OPS.includes(ev.op));
}

/* ------------------------------------------------------------------------ *
 *  Per-turn steps D1–D9 (A7.6) live in daemons.js                           *
 * ------------------------------------------------------------------------ */

/** The ordered daemon steps (A1: game.js exports them; daemons.js defines them). */
export { DAEMON_STEPS };

/**
 * Steps B and D1–D9 after a world command's action phase, then the `end` event.
 * @param {Run} run
 * @param {Command} cmd
 */
function finishTurn(run, cmd) {
  if (run.state.ended === null) {
    for (const reaction of run.content.afterAction ?? []) {
      runReaction(run, reaction, { phase: 'afterAction', cmd, self: null });
      if (run.state.ended !== null) break;
    }
    syncLight(run);
  }
  runDaemons(run, cmd);
  if (run.state.ended !== null) emit(run, endEvent(run));
}

/* ------------------------------------------------------------------------ *
 *  createGame                                                               *
 * ------------------------------------------------------------------------ */

/**
 * Creates a game (A2). `actions` (tests / tools only) adds or overrides registry entries.
 * @param {import('./types.js').GameOptions & {actions?: Record<string, object>}} options
 * @returns {import('./types.js').Game}
 */
export function createGame(options = {}) {
  const { content, seed = 1, strict = false } = options;
  checkBundle(content);
  if (strict) deepFreeze(content);
  const registry = Object.freeze({ ...ACTIONS, ...(options.actions ?? {}) });
  const vocab = buildVocab(content);
  const originalSeed = seed >>> 0;
  // The resolver never swallows exceptions here: a throwing hook (e.g. an exit condition
  // evaluated for scope) reaches contained(), the game's transaction boundary, which rolls
  // the whole line back — or rethrows in strict mode (A7.9, C24).
  const resolverOpts = { strict: true };
  const run = createRun({ state: createState(content, originalSeed), content, vocab, strict, messages: { ...ACTION_MESSAGES, ...DAEMON_MESSAGES } });
  const api = run.api;
  /** @type {import('./types.js').State|null} */
  let undoSnapshot = null;

  /* ---------------------------- helpers ---------------------------------- */

  const verbClass = (verb) => vocab.verbById[verb]?.class ?? 'world';
  const isBarrier = (verb) => CHAIN_BARRIERS.includes(verb) || verbClass(verb) === 'system';

  /** Resolution / parse error (free, system style): its own Text or a message. */
  function sayError(r) {
    if (r.text !== undefined) say(run, r.text, 'system', null);
    else emitText(run, message(run, r.message, r.params ?? {}), 'system');
  }

  function emitPrompt(pending) {
    emit(run, { type: 'prompt', kind: pending.kind, text: pending.text });
  }

  const isFresh = (s) => s.turn === 0 && s.ended === null && s.ctx.pending === null
    && s.visited.length === 1 && s.visited[0] === content.rules.start;

  /** Refresh bundle (A9.3). */
  function refresh({ intro = false, undone = false } = {}) {
    emit(run, { type: 'clear' });
    emit(run, roomEvent(run));
    emit(run, pictureEvent(run));
    emit(run, { type: 'ambient', id: ambientFor(run.state, content) });
    emit(run, { type: 'music', id: 'stop' });
    emit(run, statusEvent(run));
    if (intro && content.rules.intro !== undefined) say(run, content.rules.intro, undefined, null);
    describeRoom(run);
    if (undone) emitText(run, message(run, 'undone'), 'system');
    if (run.state.ended !== null) emit(run, endEvent(run));
    else if (run.state.ctx.pending) emitPrompt(run.state.ctx.pending);
  }

  /** The system-verb services barriers need (meta.js `system`). */
  const sys = {
    undo() {
      if (!undoSnapshot) {
        emitText(run, message(run, 'cantUndo'), 'system');
        return;
      }
      run.state = clone(undoSnapshot);
      undoSnapshot = null;
      refresh({ undone: true });
    },
    restart() {
      run.state = createState(content, originalSeed);
      undoSnapshot = null;
      refresh({ intro: true });
    },
    confirm(cmd, messageId) {
      const command = { verb: cmd.verb, verbWord: cmd.verbWord ?? cmd.verb, raw: cmd.raw ?? cmd.verb };
      run.state.ctx.pending = { kind: 'confirm', text: message(run, messageId), command };
      emitPrompt(run.state.ctx.pending);
    },
  };

  function runBarrier(cmd) {
    SYSTEM_ACTIONS[cmd.verb](cmd, api, sys);
  }

  /** Output normaliser over every event string (A7.1 step 8, A12.1). */
  function finish(events) {
    const opts = { strict };
    for (const ev of events) {
      if (ev.type === 'text' || ev.type === 'prompt') ev.text = normalise(ev.text, opts);
      else if (ev.type === 'end') {
        ev.title = normalise(ev.title, opts);
        ev.text = normalise(ev.text, opts);
      }
    }
    return events;
  }

  /**
   * Runs `fn` with error containment (A7.9): on an exception the state and UNDO snapshot
   * roll back and the call returns `[engineError]` — or, in strict mode, rethrows after
   * the rollback, so a caught strict failure leaves the game exactly as it was.
   * @param {(lineStart: object) => void} fn
   * @returns {OutputEvent[]}
   */
  function contained(fn) {
    const lineStart = clone(run.state);
    const prevUndo = undoSnapshot;
    run.events = [];
    try {
      fn(lineStart);
      return finish(run.events);
    } catch (e) {
      run.state = lineStart;
      undoSnapshot = prevUndo;
      if (strict) throw e;
      run.events = [];
      emitText(run, message(run, 'engineError', { error: String(e?.message ?? e) }), 'system');
      return finish(run.events);
    } finally {
      run.events = [];
    }
  }

  /* --------------------------- one input line ---------------------------- */

  function processLine(line, lineStart) {
    const s = normaliseInput(line);
    const segments = splitChain(tokenise(s), vocab);
    const state = run.state;

    if (state.ended !== null) {
      const first = segments.length ? parseCommand(segments[0], vocab) : null;
      if (!first || first.error || !ENDED_VERBS.includes(first.verb)) {
        emitText(run, message(run, 'gameOver'), 'system');
        return;
      }
      runBarrier(first);
      noticeIfDiscarded(segments, 0);
      return;
    }

    if (!segments.length) {
      if (state.ctx.pending) emitPrompt(state.ctx.pending);
      else emitText(run, message(run, 'empty'), 'system');
      return;
    }

    const limit = Math.min(segments.length, LIMITS.chainLength);
    const line$ = { lineStart, undoCommitted: false };
    let last = limit - 1;
    for (let i = 0; i < limit; i++) {
      if (runSegment(segments[i], i === 0, line$) === STOP) {
        last = i;
        break;
      }
    }
    noticeIfDiscarded(segments, last);
  }

  /** A7.1 step 7: chain notice before the terminal event when segments were dropped. */
  function noticeIfDiscarded(segments, lastRun) {
    if (lastRun >= segments.length - 1) return;
    const VERB = String(segments[lastRun][0] ?? '').toUpperCase();
    const ev = { type: 'text', style: 'system', text: message(run, 'chainIgnored', { VERB }) };
    const events = run.events;
    if (events.length && isTerminal(events[events.length - 1])) events.splice(events.length - 1, 0, ev);
    else events.push(ev);
  }

  /** A resolution Result → a Command to execute, or STOP after saying / asking. */
  function fromResult(r) {
    if (r.ok) return r.command;
    if (r.pending) {
      run.state.ctx.pending = r.pending;
      emitPrompt(r.pending);
    } else {
      sayError(r);
    }
    return null;
  }

  /**
   * One chain segment (A7.1 step 6). Returns STOP or GO_ON.
   * @param {string[]} seg
   * @param {boolean} first
   * @param {{lineStart: object, undoCommitted: boolean}} line$
   */
  function runSegment(seg, first, line$) {
    const state = run.state;
    let cmd = null;

    if (first && state.ctx.pending) {
      const r = answerPending(seg, state, content, vocab, run.hook, resolverOpts);
      if (r.cancelled) {
        state.ctx.pending = null;
        sayCancel(r);
        return STOP;
      }
      if (r.notAnswer) {
        if (!r.barrier) {
          state.ctx.pending = null;
          if (r.cancel) sayCancel(r.cancel);
        }
      } else {
        state.ctx.pending = null;
        cmd = fromResult(r);
        if (!cmd) return STOP;
      }
    }

    if (!cmd) {
      const parsed = parseCommand(seg, vocab);
      if (parsed.error) {
        sayError(parseErrorResult(parsed));
        return STOP;
      }
      if (parsed.verb === 'again') {
        cmd = fromResult(repeatLast(state, content, vocab, run.hook, resolverOpts));
        if (!cmd) return STOP;
      } else if (isBarrier(parsed.verb)) {
        runBarrier(parsed);
        return STOP;
      } else {
        cmd = fromResult(resolve(parsed, state, content, vocab, run.hook, resolverOpts));
        if (!cmd) return STOP;
      }
    }
    return execute(cmd, line$);
  }

  /** NO / cancelled confirmation: content cancelText is prose, the default is system. */
  function sayCancel(r) {
    if (r.text !== undefined) say(run, r.text, undefined, null);
    else emitText(run, message(run, r.message ?? 'confirmCancelled', r.params ?? {}), 'system');
  }

  /**
   * Executes a resolved command: barrier (confirmed), confirmation, meta, or a world turn.
   * Everything after the barrier check runs with `cmd` as the hook context (A5).
   */
  function execute(cmd, line$) {
    if (isBarrier(cmd.verb)) {
      runBarrier(cmd);
      return STOP;
    }
    return withCommand(run, cmd, () => executeCommand(cmd, line$));
  }

  function executeCommand(cmd, line$) {
    const def = registry[cmd.verb];
    if (def?.confirm && !cmd.confirmed) {
      const pending = def.confirm(cmd, api);
      if (pending) {
        run.state.ctx.pending = pending;
        emitPrompt(pending);
        return STOP;
      }
    }
    if (verbClass(cmd.verb) !== 'world') {
      if (def) def.run(cmd, api);
      else if (vocab.verbById[cmd.verb]?.default !== undefined) say(run, vocab.verbById[cmd.verb].default, undefined, null);
      else emitText(run, message(run, 'cantDo'));
      recordExecuted(run.state, content, cmd, vocab);
      return GO_ON;
    }
    if (!line$.undoCommitted) {
      undoSnapshot = line$.lineStart;
      line$.undoCommitted = true;
    }
    runTurn(cmd);
    recordExecuted(run.state, content, cmd, vocab);
    return run.state.ended !== null || run.panicked ? STOP : GO_ON;
  }

  /** One world command: action phase A, then B and D1–D9 (A7.6). */
  function runTurn(cmd) {
    run.turnStart = {
      roomId: run.state.roomId, lit: isLit(run.state, content), ambient: ambientFor(run.state, content),
      nerve: run.state.nerve,
    };
    run.shown = { roomId: run.turnStart.roomId, lit: run.turnStart.lit };
    run.panicked = false;
    performAction(run, cmd, registry);
    finishTurn(run, cmd);
  }

  /* ------------------------------ public API ------------------------------ */

  function input(line) {
    return contained((lineStart) => processLine(line, lineStart));
  }

  /** A2 `load`: validate atomically (A11 V13), swap state, clear UNDO, refresh. */
  function load(data) {
    const prevState = run.state;
    const prevUndo = undoSnapshot;
    run.events = [];
    try {
      const r = validateSave(data, content);
      if (!r.ok) return { ok: false, error: r.error, events: [] };
      run.state = r.state;
      undoSnapshot = null;
      refresh();
      return { ok: true, events: finish(run.events) };
    } catch (e) {
      run.state = prevState;
      undoSnapshot = prevUndo;
      if (strict) throw e;
      return { ok: false, error: message(run, 'engineError', { error: String(e?.message ?? e) }), events: [] };
    } finally {
      run.events = [];
    }
  }

  return Object.freeze({
    start: () => contained(() => refresh({ intro: isFresh(run.state) })),
    input,
    load,
    undo: () => input('undo'),
    restart: () => contained(() => sys.restart()),
    save: () => serialise(run.state, content),
    snapshot: () => clone(run.state),
  });
}
