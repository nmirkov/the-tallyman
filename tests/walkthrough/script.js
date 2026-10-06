// TT-022 — shared helpers for the walkthrough, solvability and save-determinism suites.
// Every expectation in these suites comes from docs/STORY.md (§7, §8, §12, §13) and
// PLAN §2.5; this module only parses the reference scripts out of STORY.md and drives
// the real game (strict mode, ARCHITECTURE A2).

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import content from '../../src/content/index.js';
import { createGame } from '../../src/engine/game.js';
import { cloneContent } from '../fixtures/harness.js';

export { content };

export const STORY = readFileSync(new URL('../../docs/STORY.md', import.meta.url), 'utf8');

/** STORY §12.1 "Plain list for tests/walkthrough/" (91 commands). */
export const WALKTHROUGH = STORY.split('Plain list for `tests/walkthrough/` (91 lines):\n```\n')[1]
  .split('```')[0].trim().split('\n');

/**
 * STORY §12.1 table rows: `{n, command, room, score}` parsed from the markdown table.
 * @type {{n: number, command: string, room: string, score: number, effect: string}[]}
 */
export const WALKTHROUGH_TABLE = (() => {
  const section = STORY.split('### 12.1 ')[1].split('Plain list for')[0];
  const rows = [];
  for (const line of section.split('\n')) {
    const m = /^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*([a-z_0-9]+)\s*\|\s*([^|]*?)\s*\|\s*(\d+)\s*\|$/.exec(line);
    if (m) rows.push({ n: Number(m[1]), command: m[2].trim(), room: m[3], effect: m[4].trim(), score: Number(m[5]) });
  }
  return rows;
})();

/**
 * STORY §12.2 boiler route as `[command, roomAfter]` pairs, replacing §12.1 #84-91.
 * Parsed from the prose ("84 `e` (entrance_hall), ...").
 */
export const BOILER_ROUTE = (() => {
  const para = STORY.split('### 12.2 ')[1].split('### 12.3')[0];
  const out = [];
  const re = /(\d+) `([^`]+)`(?:\s+\(([a-z_]+))?/g;
  let m;
  while ((m = re.exec(para))) out.push({ n: Number(m[1]), command: m[2], room: m[3] ?? null });
  return out;
})();

/** `n` copies of `line`. */
export const times = (n, line) => Array.from({ length: n }, () => line);

/** Text of every `text` event. */
export const texts = (events) => events.filter((e) => e.type === 'text').map((e) => e.text);
/** All text of `events` joined by newlines. */
export const joined = (events) => texts(events).join('\n');
/** The `end` event, if any. */
export const endOf = (events) => events.find((e) => e.type === 'end');
/** The last `status` event. */
export const statusOf = (events) => events.filter((e) => e.type === 'status').at(-1);

/**
 * A fresh, started, strict game on the real content.
 * @param {number} [seed]
 */
export function fresh(seed = 1) {
  const g = createGame({ content: cloneContent(content), seed, strict: true });
  g.start();
  return g;
}

/**
 * Plays `lines` in a fresh game.
 * @param {string[]} lines
 * @param {number} [seed]
 * @returns {{g: object, ev: object[], all: object[]}} game, last command's events, every event
 */
export function run(lines, seed = 1) {
  const g = createGame({ content: cloneContent(content), seed, strict: true });
  const all = [...g.start()];
  let ev = [];
  for (const line of lines) {
    ev = g.input(line);
    all.push(...ev);
  }
  return { g, ev, all };
}

/** Feeds `lines` to `g`; returns the events of the last line. */
export function feed(g, lines) {
  let ev = [];
  for (const line of lines) ev = g.input(line);
  return ev;
}

/** Snapshot shorthand. */
export const snap = (g) => g.snapshot();

/**
 * Asserts the game ended with `id` on `turn`, consistently in the end event and the state.
 * @returns {object} the end event
 */
export function assertEnding(g, ev, id, turn) {
  const end = endOf(ev);
  assert.ok(end, `expected ending "${id}", game still running at turn ${g.snapshot().turn} in ${g.snapshot().roomId}`);
  assert.equal(end.ending, id);
  assert.equal(g.snapshot().ended, id);
  if (turn !== undefined) {
    assert.equal(end.turns, turn, 'end.turns');
    assert.equal(g.snapshot().turn, turn, 'state.turn');
  }
  const def = content.endings.find((e) => e.id === id);
  assert.equal(end.title, def.title);
  assert.equal(end.kind, def.kind);
  return end;
}

/** Asserts the game is still running. */
export function assertRunning(g, why = '') {
  assert.equal(g.snapshot().ended, null, `game ended (${g.snapshot().ended}) ${why}`);
}

/**
 * Evidence count per A8.8: facts found + item evidence carried now.
 * @param {object} s state
 */
export function evidenceCount(s) {
  let n = 0;
  for (const id of s.evidence) {
    const ev = content.evidence[id];
    if (!ev.item) n++;
    else if (isCarried(s, ev.item)) n++;
  }
  return n;
}

/** Whether item `id`'s location chain reaches the player (A3.1 S2). */
export function isCarried(s, id) {
  let loc = s.items[id]?.loc;
  for (let i = 0; i < 64 && loc; i++) {
    if (loc === 'player') return true;
    loc = s.items[loc]?.loc;
  }
  return false;
}
