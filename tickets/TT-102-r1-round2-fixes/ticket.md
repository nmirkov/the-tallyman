---
id: TT-102
title: Fix Codex R1 round-2 findings (reveal loops after death, strict-mode rollback)
milestone: BUG
status: done
agent: engine-dev
model: opus
depends: [TT-101]
severity: medium
---
# TT-102 — R1 round-2 fixes

## Goal
Resolve the two blocking findings and the non-blocking note in `reviews/code-review-R1-2.md` (read it in full; reproductions and missing test names are given).

1. Engine-owned reveal loops (api.js reveal list, observe.js SEARCH) must stop immediately once an ending is established (A7.7 E1). Tests: `fatal found reaction stops remaining reveal-list elements`, `SEARCH stops revealing after death`.
2. Strict mode must restore state and the previous UNDO snapshot *before* rethrowing — for input and for LOAD/refresh failures (A7.9, A11 V13). Tests: `strict input failure restores state and previous UNDO`, `strict LOAD refresh failure preserves state and UNDO`. Audit every other place that rethrows in strict mode for the same ordering bug.
3. Non-blocking: `SEARCH ROOM` alias per A8.6 at engine level (check whether content already declares it — keep one source).

## File allow-list
`src/engine/**`, `tests/unit/*`, `tests/fixtures/*` (additive)

## Acceptance criteria
- [x] Named tests written first, fail, then pass. `npm run check` green.
