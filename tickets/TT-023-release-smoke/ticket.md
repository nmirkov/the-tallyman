---
id: TT-023
title: Release build and browser smoke tests
milestone: M4
status: done
agent: ui-dev
model: opus
depends: [TT-014, TT-022]
---
# TT-023 — Release build & browser smoke

## Goal
Prove the shipped single file works the way Nenad will use it: double-clicked, offline (PLAN §4 Browser smoke row, §3.8, §8 DoD; Codex plan-review notes on persistence acceptance).

## Scope
- `npm run build -- --release` (minified) → `dist/tallyman.html`; assert size < 1.5 MB; no external URLs in the file (grep for `http`, `//cdn`, `<link`, `src=`).
- `playwright-core` dev dependency (pin exact) driving the installed `/usr/bin/google-chrome` (`executablePath`), `tools/smoke.js` + `npm run smoke`:
  1. `file://` load with all network blocked (`context.route('**', abort)` except file:), boot skipped via `?skipboot=1` and also one run with full boot (press key through tape → title → intro).
  2. Type the STORY §12.1 walkthrough (from `tests/walkthrough/script.js` if it exports it) via real keyboard events at speed with typewriter off; assert final ending screen text contains the victory title and 100.
  3. Paging: long output shows [MORE], key continues. History ↑ recalls last command.
  4. SAVE 1 → reload page → LOAD 1 → identical continuation (compare status line + last room text after 3 more commands vs a reference run without reload).
  5. localStorage-throws mode (init script overriding `localStorage` getters to throw): one-time notice; EXPORT → capture download → reload → IMPORT that file → identical continuation.
  6. Restore a save holding a pending disambiguation prompt, and a save after an ending.
  7. Zero console errors / page errors across all runs.
  8. Screenshots at 1800×1100 and 390×844 (title, a mid-game room, an ending) into `docs/screenshots/release-*.png` — view them.
- `docs/SMOKE-REPORT.md` with results.

## File allow-list
`package.json`, `package-lock.json`, `tools/smoke.js`, `tools/build.js` (release flag only), `docs/SMOKE-REPORT.md`, `docs/screenshots/release-*`, `src/ui/**` (bug fixes found by smoke only, listed in implementation.md)

## Acceptance criteria
- [ ] `npm run smoke` passes all 8 checks; report written; screenshots viewed.
- [ ] `npm run check` green.
