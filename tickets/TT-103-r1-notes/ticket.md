---
id: TT-103
title: Address R1 round-3 non-blocking notes
milestone: BUG
status: done
agent: engine-dev
model: sonnet
depends: [TT-102]
severity: low
---
# TT-103 — R1 non-blocking notes

Address the six non-blocking notes in `reviews/code-review-R1-3.md` (read-only `api.state` enforcement, orphaned contents of eaten/sunk containers, ending-text-hook rollback edge, the named test gaps, hazard `objects` semantics, dirty-tree test signal) where cheap; document the rest as accepted in implementation.md. Scheduled for the M4 polish window.

## File allow-list
`src/engine/**`, `tests/unit/*`, `docs/ARCHITECTURE.md` (clarifications)
