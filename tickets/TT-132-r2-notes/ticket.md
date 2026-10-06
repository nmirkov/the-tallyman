---
id: TT-132
title: R2 round-2 UI notes
milestone: BUG
status: done
agent: ui-dev
model: sonnet
depends: [TT-106]
severity: low
---
# TT-132 — R2 notes
Address the six non-blocking notes in `reviews/code-review-R2-2.md` (duplicate lint id L11, heldKey cleared on blur, Ctrl+Alt fallback breadth, lint importing from src/ui/fx.js — move shared constants to a neutral module, MAX_TICK_MS trade-off documented/tuned, title tune for skipboot accepted). 
## File allow-list
`src/ui/**`, `tools/lint-content.js`, `src/shared/*` (new, if needed), `tests/unit/*` (ui + lint)
