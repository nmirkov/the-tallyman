---
id: TT-101
title: Fix Codex R1 review findings in the engine
milestone: BUG
status: in-progress
agent: engine-dev
model: opus
depends: [TT-010]
severity: high
---
# TT-101 — R1 review fixes

## Goal
Resolve every blocking finding of the Codex milestone review R1 (`reviews/code-review-R1-1.md` — read it in full; each finding includes file:line, a reproduction and the missing regression test name) plus the listed non-blocking items, so R1 round 2 can approve.

## Findings to fix (each with the named regression test, test-first)
1. Critical items destroyable through their container (protect.js) — protect critical/personal descendants for destructive disposal and transfers to NPCs.
2. Exit-condition hook exceptions swallowed in resolve.js — propagate to the game transaction boundary (rollback; strict rethrow).
3. Nested endings overwritten (api.js) — stop subsequent effects after an ending; never overwrite an established ending; clock/status still run.
4. Manipulating unreachable items inside closed containers (objects.js, PUT/GIVE/tool paths) — reachability before physical manipulation (A8.1, one-turn refusal).
5. Lighting changes outside the action phase leave presentation stale (api.js) — track lit transitions across afterAction/onEnter/daemons, emit A9.2 O5 update once.
6. Handler-triggered hooks lose current command (perform.js) — establish/restore `run.args.cmd` around execution.
7. Malformed pending commands pass validateSave (state.js) — validate parsed noun structures etc.; reject atomically (state and UNDO preserved).
8. API mutations can commit unsavable states (api.js move into non-container, setItem worn while uncarried…) — enforce A3 invariants, violations roll back.
9. Terminal player save/export failures crash (tools/play.js) — contain, report, continue.

Non-blocking to include: (a) non-finite numbers rejected by lint and runtime API; (b) TT-010 follow-ups: update ARCHITECTURE.md A1 entries for daemons/game, remove the `noNerve` filter in `tests/unit/game.test.js` if now obsolete, add `nerve` to `turnStart` JSDoc in api.js.

## File allow-list
`src/engine/**` except `src/engine/vocab.js` and `src/engine/parser.js` (another agent is editing those for content verbs — if a fix needs them, describe the change in implementation.md instead); `tools/play.js`, `tools/lint-content.js`, `tests/unit/*`, `tests/fixtures/*` (additive), `docs/ARCHITECTURE.md` (A1 and clarifications only)

## Acceptance criteria
- [ ] All 9 blocking findings fixed, each with its named regression test.
- [ ] `npm run check` green (if content tests from the parallel TT-016 agent fail for reasons unrelated to your change, report it, don't fix content).
