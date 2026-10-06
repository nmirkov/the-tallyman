---
id: TT-104
title: Polish the weakest pictures
milestone: BUG
status: done
agent: artist
model: opus
depends: [TT-020, TT-021]
severity: low
---
# TT-104 — Art polish

## Goal
Raise the weakest pictures to the level of the best ones (`market_square`, `platform`, `high_street`, `chapel_street`, `churchyard`, `mill_gates`, `title`). Orchestrator's list from screenshot review: `crypt`, `vestry`, `police_house`, `cells` (a bicycle in a cell reads oddly — show a bunk, a bucket, a barred window), `number_13` (crime scene: tally marks on the wall must read clearly), `entrance_hall` (busy floor), `boiler_room` (faint rivets), `moor_road` (car too small); screens `ending_death` (blocky light cone) and `ending_victory` (tiny cars).

Rules: same ids, format and TT-019 style rules; briefs in STORY §4 / §14.2; compare before/after at 2× in both themes; only replace a picture if the new one is clearly better.

## File allow-list
`src/content/art/*.js` (the listed pictures only), `docs/screenshots/art-104-*`, `docs/art-preview.html`

## Acceptance criteria
- [ ] Before/after screenshots for each picture; implementation.md says which were replaced and why.
- [ ] `npm run check` green.
