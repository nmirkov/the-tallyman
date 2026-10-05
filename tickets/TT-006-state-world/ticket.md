---
id: TT-006
title: State, RNG, world queries, save validation and content linter core
milestone: M1
status: done
agent: engine-dev
model: opus
depends: [TT-002]
---
# TT-006 — State & world

## Goal
The mutable-state foundation per ARCHITECTURE.md: create, query, serialise and validate game state; lint content.

## Scope
- `src/engine/rng.js` (mulberry32; `next(state)`, `int(state,n)`, `pick(state,arr)` — RNG state lives in `state.rng`).
- `src/engine/state.js`: `createState(content, seed)`, `serialise(state)`, `validateSave(data, content)` (version, ids exist, locations valid, no containment cycles, types) → `{ok, state?|error}` (atomic — never partially applies), `clone`.
- `src/engine/world.js`: `inventory(state)`, `locationOf`, `isCarried`, `contentsOf`, `roomOf(itemId)` (walk containers), `isLit(state, content, roomId)` (room not dark OR lit light source carried or in room), `scope(state, content)` (what the player can refer to: room items, open-container contents, carried items, scenery, present NPCs, exits), `visibleItems`, `moveItem`, `movePlayer`, `exitsOf(room, state)` (conditional exits), `timeString(turn)` (21:30 + 30 s/turn, e.g. '23:14').
- `tools/lint-content.js`: replace stub with real rules from ARCHITECTURE.md (schema, ids, exits, reciprocity unless `oneWay`, reachability from start, critical items obtainable, glyph check of all text via font glyph list if `src/ui/font8x8.js` exists, description length ≤ 300, indistinguishable references, stubs allowed unless `--strict`). Exit code 1 on errors, warnings printed.
- `tests/fixtures/mini-world.js`: a small content bundle (5–6 rooms incl. a dark room, a container, a locked door with key, a light source, one NPC) used by TT-006…TT-010 tests.
- Tests: `tests/unit/state.test.js`, `tests/unit/world.test.js`, `tests/unit/lint.test.js` (lint catches each rule violation on purpose-built bad fixtures).

## File allow-list
`src/engine/rng.js`, `src/engine/state.js`, `src/engine/world.js`, `tools/lint-content.js`, `tests/fixtures/*`, `tests/unit/state.test.js`, `tests/unit/world.test.js`, `tests/unit/lint.test.js`

## Acceptance criteria
- [ ] JSON round-trip of state is exact; validateSave rejects cycles, unknown ids, wrong version, wrong types — and leaves the input untouched.
- [ ] Lint passes on the (empty) real content bundle and on mini-world; fails on each bad fixture.
- [ ] `npm run check` green.
