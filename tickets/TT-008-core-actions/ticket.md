---
id: TT-008
title: Game loop, core actions and terminal player
milestone: M1
status: done
agent: engine-dev
model: opus
depends: [TT-007]
---
# TT-008 — Core actions + game loop + play.js

## Goal
A playable engine on the mini world: `createGame()` per ARCHITECTURE.md with the full turn pipeline (daemon slots may be no-ops until TT-010), chain execution & barriers, refresh bundles, and the classic verb set.

## Scope
- `src/engine/game.js`: `createGame({content, seed})` → `start, input, save, load, undo, restart`; chain execution; chain barriers; turn costing; refresh bundle; UNDO snapshot (one level, bounded); events normalised through the text normaliser (`src/engine/text.js`: curly quotes, ellipsis, dashes, word-safe).
- `src/engine/actions/` registry + families: `movement.js` (dirs, GO, ENTER/EXIT/IN/OUT, CLIMB, conditional/locked exits, dark-room rule: in darkness you may only go back the way you came — ARCHITECTURE.md), `observe.js` (LOOK, EXAMINE, SEARCH reveals hidden items, READ, LISTEN, SMELL, room descriptions with VERBOSE/BRIEF, item listing), `objects.js` (TAKE/DROP/ALL, PUT IN/ON, TAKE FROM, OPEN/CLOSE, UNLOCK/LOCK WITH, PUSH/PULL, WEAR/REMOVE, EAT/DRINK refusals, THROW, BREAK, fixed/scenery refusals, critical-item protection hook point), `light.js` (TURN ON/OFF, LIGHT), `meta.js` (INVENTORY, SCORE, TIME, HELP, VERBOSE/BRIEF, GRAPHICS, SAVE/LOAD/EXPORT/IMPORT/UNDO/RESTART/QUIT → events per host protocol, SOUND/MUSIC/THEME/TYPEWRITER → host setting events, WAIT).
- Content hook points: per-item/room `before`/`after` overrides by verb (ARCHITECTURE.md hooks API).
- `tools/play.js`: interactive REPL (readline) rendering events as text (pictures as `[picture: id]`, sfx as `[sfx: id]` only with `--verbose-events`), `--script file` (one command per line, prints transcript), `--seed n`, `--content path` (default real content, `tests/fixtures/mini-world.js` for now if real content empty), SAVE/LOAD to `./saves/slotN.json`.
- Tests: `tests/unit/actions-*.test.js` per family + `tests/unit/game.test.js` (chains, barriers incl. `LOAD 1 THEN NORTH`, UNDO incl. mid-chain, RESTART, refresh bundles incl. pending prompt and ended game, never throws).

## File allow-list
`docs/ARCHITECTURE.md` (A1 table only), `src/engine/resolve.js` (strict rethrow only), `src/engine/game.js`, `src/engine/api.js` (HookApi + Reaction runner, C27), `src/engine/text.js`, `src/engine/actions/*`, `tools/play.js`, `tests/unit/actions-*.test.js`, `tests/unit/game.test.js`, `tests/fixtures/*` (additive)

## Acceptance criteria
- [ ] `npm run play -- --content tests/fixtures/mini-world.js --script <file>` produces a sensible transcript (include one in implementation.md).
- [ ] Every verb in vocab.js either has an action or a deliberate generic response (test enumerates vocab).
- [ ] `npm run check` green.

## Orchestrator notes (from TT-005/006/007 hand-backs)
- Read `tickets/TT-00{5,6,7}-*/implementation.md` first: vocab shape, world signatures `(state, content, …)`, `scope()` shape, `callHook(id,{phase})` requirement, resolver interface (`resolve`, `answerPending`, `repeatLast`, `recordExecuted`).
- `movePlayer` does not mark visited — call `markVisited` after `onEnter`.
- Bare ENTER/EXIT keep their verb → map to go in/out; `climb up/down` arrives as `{verb:'climb', dir}`.
- Strict mode (C24): the resolver currently catches its own exceptions and returns `engineError`; in strict mode make it rethrow (pass a `strict` option through, small edit to resolve.js allowed).
- Update ARCHITECTURE.md A1 table with the real exported signatures of parser/resolve/world/game/api (allowed edit, A1 only).
