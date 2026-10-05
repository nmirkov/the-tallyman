// Test helpers for game-level tests (TT-008+): build a game on a fixture, feed lines,
// and pick events apart. Fixtures are deep-cloned per game (strict mode freezes content).

import { createGame } from '../../src/engine/game.js';
import mini from './mini-world.js';

/** Structured clone that keeps hook functions (content.hooks). */
export function cloneContent(content) {
  const { hooks, ...data } = content;
  const copy = structuredClone(data);
  if (hooks) copy.hooks = { ...hooks };
  return copy;
}

/**
 * A strict game on a fresh copy of `content` (default: the mini-world).
 * @param {object} [content]
 * @param {object} [opts]  Extra createGame options.
 */
export function newGame(content = mini, opts = {}) {
  return createGame({ content: cloneContent(content), seed: 1, strict: true, ...opts });
}

/** Text of every `text` event, in order. */
export const texts = (events) => events.filter((e) => e.type === 'text').map((e) => e.text);
/** Event types, in order. */
export const types = (events) => events.map((e) => e.type);
/** The last event. */
export const last = (events) => events[events.length - 1];

/** Feeds several lines; returns the events of the last one. */
export function play(game, ...lines) {
  let out = [];
  for (const line of lines) out = game.input(line);
  return out;
}

/** Moves the player (and optionally items) by editing a save and loading it. */
export function setup(game, mutate) {
  const data = game.save();
  mutate(data.state);
  const r = game.load(data);
  if (!r.ok) throw new Error(`setup: ${r.error}`);
  return r.events;
}
