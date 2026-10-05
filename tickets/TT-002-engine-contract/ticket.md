---
id: TT-002
title: Define the engine contract (ARCHITECTURE.md + types.js)
milestone: M0
status: done
agent: engine-dev
model: opus
depends: [TT-001]
---
# TT-002 — Engine contract

## Goal
Write the single authoritative contract every later engine, UI and content ticket builds against, so no agent invents boundaries independently (Codex plan review R1 #2, R2 #1). Turn PLAN §2.5, §3.3, §3.4, §3.4a, §3.5, §3.8 into precise, implementable specs.

## Deliverables
1. `docs/ARCHITECTURE.md` — sections: module map & dependency rules (engine never imports ui; content imports only engine/types + its own files); **State** (every field, type, invariants — single item-ownership source `items[id].loc`, `money`, `nerve`, `panicCooldown`, `evidence`, `notes`, `ctx` {it, them, lastCommand, pending}, finale fields: `pikeState` ('desk'|'fled'|'left'|'counting'|'restrained'), `pikeArrivalTurn`, `attack`, `harrowFreed`, hazard-warning flags, `ended`, `settings` {verbose, graphics}); **Content schema** (Room, Item incl. `critical`, `hidden`/discovery, `fixed`, `scenery`; Npc incl. topics/schedule/accepts; Hook registry; Topic; Hint; Ending; Art) with examples; **Hooks API** (what a hook may call: `say`, `move`, `setFlag`, `award`, `addNote`, `addEvidence`, `sfx`, `rng`, …); **Turn pipeline** (exact order, turn cost table for every verb class, chains & chain barriers, AGAIN/ALL semantics, UNDO snapshot rules); **Output Events** (complete list incl. `prompt`, `storage`, `host`, refresh bundle composition incl. pending prompt / ended game); **Host protocol** (storage adapter interface, EXPORT/IMPORT, settings); **Save format** (version, validation rules, atomic load, cycle detection); **Text normaliser & glyph policy**; **Content lint rules** (incremental vs `--strict`, stubs).
2. `src/engine/types.js` — JSDoc `@typedef`s for everything above (no runtime code except `export {}` and frozen constants such as `EVENT_TYPES`, `DIRECTIONS`, `TURN_SECONDS = 30`, `MIDNIGHT_TURN = 300`, `START_TIME = '21:30'`).
3. `tests/unit/types.test.js` — trivial test that constants exist and are frozen.

## File allow-list
`docs/ARCHITECTURE.md`, `src/engine/types.js`, `tests/unit/types.test.js`

## Acceptance criteria
- [ ] Every rule in PLAN §2.5 and §3.4a is represented unambiguously (cite the PLAN section in each ARCHITECTURE section).
- [ ] Contains a worked example: a 3-room mini world (as content data) + a transcript of 6 inputs with the exact events produced, including a chain with a barrier and a disambiguation prompt.
- [ ] Decisions not dictated by PLAN are listed at the end under "Contract decisions" with a one-line why each.
- [ ] Canonical, consolidated API: `createGame` → `start()`, `input(line)`, `load(data)`, `undo()`, `restart()`, `save()`; full event list incl. `host`, `storage`, `prompt`, ending text in `end`; exact placement of the attack-counter increment in the turn pipeline; precedence of SAVE/LOAD/UNDO/RESTART when a clarification/confirmation is pending (Codex plan review R3 note 6).
- [ ] `npm run check` green.
