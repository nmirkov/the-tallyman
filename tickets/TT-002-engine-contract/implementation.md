# TT-002 implementation — Engine contract

## Summary
Wrote the single authoritative engine contract: `docs/ARCHITECTURE.md` (sections A1–A17, ~1 340 lines, numbered rules for tests/reviews) and its machine-readable half `src/engine/types.js` (JSDoc typedefs for state, content schema, commands, pending questions, hooks, events, saves, host adapter + 30 deep-frozen constants incl. `MESSAGES`). Content authoring is data-first: one Condition language and one Reaction language serve every content slot (exits, topics, accepts, beats, daemons, case outcomes, endings), with named hooks only as an escape hatch. The whole PLAN §2.5 finale (Pike schedule, barred door, attack counter, restraint, endings precedence) is expressible as pure data (A14.3).

## Files changed
- `docs/ARCHITECTURE.md` (new)
- `src/engine/types.js` (new)
- `tests/unit/types.test.js` (new, 11 tests)
- `tickets/TT-002-engine-contract/ticket.md` (status → verify)

## Decisions made
All contract decisions not dictated by PLAN are listed with a one-line why in ARCHITECTURE.md **A17 (C1–C36)**. Most consequential:
- C1 — Story finale fields (`pikeState`, `pikeArrivalTurn`, `attack`, `harrowFreed`) are content-declared typed `vars`, type-checked by `validateSave`; the engine stays story-agnostic.
- C2/C3 — Reaction/Condition DSL; PLAN's topic `{text, sets, requires}` → `{say, setFlag, if}`.
- C9 — Story daemons (step D4, where the attack counter increments) sit between NPC schedules and light.
- C13 / A7.3 — Precedence table for SAVE/LOAD/UNDO/RESTART/QUIT while a question is pending (Codex R3 note 6).
- C15 — UNDO snapshot = state at line start, committed at the line's first world command.
- C16 — `load()` returns `{ok, error, events}`.
- C21 — personal/critical protection runs before content reactions.

## Acceptance criteria
- [x] Every PLAN §2.5 and §3.4a rule represented, with PLAN citations per section; traceability tables in A14.1 (18 §2.5 rules) and A14.2 (§3.4a bullets + R3 note 6).
- [x] Worked example A15: 3-room mini world as content data + `start()` and 6 inputs with exact events, incl. a chain with a barrier (`TAKE TORCH THEN SAVE 2 THEN S`), a disambiguation prompt + answer, darkness, and UNDO's refresh bundle.
- [x] Contract decisions listed in A17.
- [x] Canonical API (A2): `createGame` → `start/input/load/undo/restart/save` (+ `snapshot`); full event list incl. `host`, `storage`, `prompt`, ending text in `end` (A9); attack-counter placement (A7.6 D4); pending precedence (A7.3).
- [x] `npm run check` green.

## How verified
- Test-first for the constants (`tests/unit/types.test.js`): values per PLAN, deep-frozen, no exported functions, event list complete, direction opposites involutive, verb sets disjoint, messages ASCII-only, art constants.
- Script check that every `A<n>` cross-reference in both files points at an existing heading.
- Hand-computed the worked example (nerve, clock, score, ambient, listing order) against the rules in A7–A9.

`npm run check` tail:
```
# pass 46
# fail 0
# cancelled 0
# skipped 0
# todo 0

> the-tallyman@0.1.0 build
> node tools/build.js

build: wrote dist/tallyman.html (966 bytes)
```
(46 = all tests in the tree, incl. other agents' in-flight ones; lint:content is still the TT-001 stub.)

## Known gaps / follow-ups (orchestrator)
1. **TT-008 allow-list** must add `src/engine/api.js` (HookApi + Reaction runner, A1/C27).
2. **TT-005 ticket** says noun phrases carry `adjectives?` — the contract drops that split (C34); the parser keeps all words in `words`.
3. **TT-007 ticket** mentions recency scoring — the contract has no implicit recency tie-break (C14).
4. **TT-013** must provide ambient ids `heartbeat` and `counting` in addition to PLAN's list (C30).
5. **TT-012** owns `src/ui/storage.js` (A10.1) — check its allow-list.
6. A test enforcing dependency rules D1–D4 (import scan of `src/engine/**`) would be cheap; suggest adding to TT-006 or TT-008.
7. TT-015 must decide the delay between Pike's 23:30 departure (`left`) and his arrival (A14.3 uses 5 as a placeholder).

Out-of-scope edits: none.
