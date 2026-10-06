---
id: TT-106
title: Fix R2 presentation review findings
milestone: BUG
status: done
agent: ui-dev
model: opus
depends: [TT-014]
severity: medium
---
# TT-106 — R2 fixes

Fix both blocking issues in `reviews/code-review-R2-1.md` (typewriter clock not reset across the boot gap after QUIT → title → new game; title reached without a prior gesture needs two key presses / no feedback, incl. reduced motion) with regression tests, and address the 12 non-blocking notes where reasonable (held-key repeat into ending prompt, cramped ending region, `picture id:null` should blank per A9.1, lint/test for fx vs reserved rows, F2 ack in boot, ending border colour, AltGr characters, cap transcript lines, dead code, IMPORT gesture comment, test additions). Accepted notes get a one-line reason in implementation.md.

## File allow-list
`src/ui/**`, `src/index.html`, `tests/unit/*` (ui tests), `tools/lint-content.js` (fx/reserved-row rule only), `docs/screenshots/tt106-*`

## Acceptance criteria
- [ ] Both blocking issues reproduced first in headless Chrome, then fixed; regression tests.
- [ ] `npm run check` green; `dist/tallyman.html` boot → game → QUIT → title → game works with typewriter.
