---
id: TT-020
title: Art: all remaining location pictures
milestone: M3
status: in-progress
agent: artist
model: opus
depends: [TT-019]
---
# TT-020 — Art: locations

## Goal
Draw every remaining 40x9 location picture listed in STORY.md §14.2 (briefs with each room in §4), in the approved TT-019 style. Split across two agents working in parallel:

- **TT-020a (town + canal):** `platform`, `waiting_room`, `station_road`, `phone_box`, `harrows_room`, `police_house`, `cells`, `high_street`, `chapel_street`, `number_13`, `back_alley`, `church_lane`, `st_judes`, `vestry`, `churchyard`, `crypt` → `src/content/art/town.js`; `canal_bridge`, `towpath`, `lock`, `lock_cottage`, `shed` → `src/content/art/canal.js`; plus `dark` → `town.js`. (`market_square`, `black_lamb` exist.)
- **TT-020b (moor, mill, asylum, beneath):** `moor_road`, `harrows_car`, `tally_stone`, `quarry_edge`, `quarry_hut`, `quarry_floor` → `moor.js`; `mill_gates`, `mill_yard`, `counting_house`, `boiler_room` → `mill.js` (`weaving_shed` exists); `asylum_gates`, `coal_chute`, `entrance_hall`, `records_office`, `ward`, `morgue` → `asylum.js`; `tunnel`, `counting_room` → `beneath.js`.

## File allow-list
TT-020a: `src/content/art/town.js`, `src/content/art/canal.js`, `docs/screenshots/art-020a-*`
TT-020b: `src/content/art/moor.js`, `src/content/art/mill.js`, `src/content/art/asylum.js`, `src/content/art/beneath.js`, `docs/screenshots/art-020b-*`
Both: may run `tools/art-preview.js` (it regenerates `docs/art-preview.html` — that's fine, last writer wins; the orchestrator regenerates it at commit).

## Acceptance criteria
- [ ] Every listed picture exists, follows the TT-019 style rules, and was viewed at 2x in both themes (art-preview + screenshots); weakest pictures redrawn.
- [ ] `tests/unit/art.test.js` passes (dimensions, glyphs, colours, fx).
- [ ] `npm run check` green (content tests from parallel agents may fail for unrelated reasons — report, don't fix).
