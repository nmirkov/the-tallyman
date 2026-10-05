---
id: TT-017
title: Content: Moor, Mill and Asylum zones
milestone: M3
status: in-progress
agent: writer
model: opus
depends: [TT-016]
---
# TT-017 — Content: Moor + Mill + Asylum

## Goal
Transcribe STORY.md §4.3–4.5 (Moor 6 rooms incl. `quarry_floor`, Mill 5, Asylum 6) with their items, scenery, hazards (quarry fall), puzzles (car/handcuffs/notebook, chain cut, ledger page, boiler hatch + oil, coal chute, cabinet + crowbar, patient file, morgue drawer hatch) and beats local to those rooms, into the framework from TT-016. Replace their stubs.

## File allow-list
`src/content/zones/{moor,mill,asylum}.js`, `src/content/index.js`, `src/content/stubs.js`, `src/content/shared.js`, `src/content/registries.js`, `src/content/topics.js`, `src/content/verbs.js`, `src/content/npcs/*` (only additions these zones need), `tests/content/*`

## Acceptance criteria
- [ ] Lint 0 errors (only Beneath stubs remain).
- [ ] `tests/content/moor-mill-asylum.test.js`: the STORY §12.1 steps for these zones replay with expected flags/notes/evidence/score; the quarry hazard warns then kills; both hatches open per STORY.
- [ ] Verbatim prose rule as TT-016.
- [ ] `npm run check` green.
