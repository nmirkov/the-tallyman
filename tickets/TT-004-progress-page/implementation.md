# TT-004 implementation

## Summary
`tools/progress.js` (zero-dep) generates `docs/progress.html` and `tickets/BOARD.md` from ticket front-matter, STATUS/REVIEWS/PLAN markdown, `git log`/tags and `docs/screenshots/*.png`.

## Files changed
- `tools/progress.js`, `tests/unit/progress.test.js`, `docs/progress.html`, `tickets/BOARD.md`, `docs/screenshots/progress-desktop.png`, `progress-mobile.png`; ticket `status: verify`.

## Decisions made
- Exports parser/renderer/builders; `main()` runs only when invoked directly (testable).
- All text is HTML-escaped before inline markdown is applied; ticket fields escaped in cards.
- Milestones taken from PLAN §5 headings plus any ticket milestone (BUG sorted last); bars ordered done→todo.
- C64 banner is CSS only (system monospace); body is a clean card dashboard, light/dark via custom properties.
- Timestamp is UTC; the page changes on every run by design.

## How verified
- 8 unit tests (front-matter, tables, lists, escaping, milestones, buildHtml).
- Headless Chrome screenshots at 1800 px and 390 px viewed: no horizontal scroll, tables scroll inside wrappers.
- `npm run check` green (9 tests pass, build ok).

## Known gaps
- Reviews/Status are rendered in full (no truncation); long REVIEWS.md will grow the page.
- Markdown supports no nested lists or images.
