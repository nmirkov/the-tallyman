---
id: TT-021
title: Art: 40x25 title and ending screens
milestone: M3
status: in-progress
agent: artist
model: opus
depends: [TT-019]
---
# TT-021 — Art: screens

## Goal
Draw the seven 40x25 screen-art pieces in STORY.md §14.2 (`title`, `ending_victory`, `ending_pyrrhic`, `ending_got_away`, `ending_fifth`, `ending_wrong`, `ending_death`) in `src/content/art/screens.js`, same format with `h: 25` (ARCHITECTURE A4.16). The title is the game's first impression on a C64 fan: big chunky block-letter logo "THE TALLYMAN" (design your own 5–6-row block font from half/full blocks), mill silhouette + chimney, fog, the four strokes and the red fifth, small credit line "BLACKMERE - NOVEMBER 1984" and leave row 24 free for "PRESS ANY KEY" (the UI prints it). Ending screens: leave rows 19–24 empty-ish (the UI overlays the ending title and score there) — document the reserved rows in implementation.md.

Extend `tools/art-preview.js` to render 40x25 screens too (allowed edit).

## File allow-list
`src/content/art/screens.js`, `tools/art-preview.js`, `docs/art-preview.html`, `docs/screenshots/art-021-*`, `tests/unit/art.test.js` (only if screen-art checks are missing)

## Acceptance criteria
- [ ] Every listed picture exists, follows the TT-019 style rules, and was viewed at 2x in both themes (art-preview + screenshots); weakest pictures redrawn.
- [ ] `tests/unit/art.test.js` passes (dimensions, glyphs, colours, fx).
- [ ] `npm run check` green (content tests from parallel agents may fail for unrelated reasons — report, don't fix).
