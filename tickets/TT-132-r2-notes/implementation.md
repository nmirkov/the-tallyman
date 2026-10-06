# TT-132 — R2 notes: implementation

## Summary
All six notes from `reviews/code-review-R2-2.md` are handled.

## Files changed / decisions
| # | Note | Resolution |
|---|---|---|
| 1 | Duplicate lint id L11 | The reserved-row ending-fx check is now **L24** (`tools/lint-content.js`); test renamed in `tests/unit/review-r2.test.js`. |
| 2 | heldKey and lost keyup | `src/ui/main.js`: `window` `blur` clears `heldKey`. |
| 3 | Ctrl+Alt breadth | Kept deliberately; reasoning documented in `keyMods` (`src/ui/terminal.js`). |
| 4 | Lint imports `src/ui/fx.js` | New neutral `src/shared/art-cells.js` holds `cellAt`, `fxMayChange` and the cell sets. `fx.js` imports them and re-exports `cellAt`/`fxMayChange`, so existing imports work. The lint imports the shared module. |
| 5 | MAX_TICK_MS | Kept at 100; trade-off documented at the constant. |
| 6 | Skipboot title tune | Accepted, no change. |

## How verified
`npm run check`: all tests pass, content lint 0 errors, build OK.

## Known gaps / follow-ups
- `docs/ARCHITECTURE.md` (outside allow-list) still lists only L11 in the lint table; add L24 ("ending art fx inert on rows 19-24").
- The blur handler has no automated test (DOM only).
