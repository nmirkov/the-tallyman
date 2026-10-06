# TT-020a — Art: town + canal locations: implementation

## Summary
I drew all 22 TT-020a pictures in the TT-019 style:
- **Town, in `src/content/art/town.js`:** `platform`, `waiting_room`, `station_road`, `phone_box`, `harrows_room`, `police_house`, `cells`, `high_street`, `chapel_street`, `number_13`, `back_alley`, `church_lane`, `st_judes`, `vestry`, `churchyard`, `crypt`, and `dark`.
- **Canal, in `src/content/art/canal.js`:** `canal_bridge`, `towpath`, `lock`, `lock_cottage`, `shed`.

`market_square` and `black_lamb` were not changed. Each picture follows its STORY.md §4 brief: the same subject, the same palette and the same fx.

## Files changed
- `src/content/art/town.js`: 17 new pictures. The 2 approved ones were kept byte for byte.
- `src/content/art/canal.js`: 5 new pictures, and the header now matches town.js.
- `docs/screenshots/art-020a-town-c64.png`, `art-020a-town-spectrum.png`, `art-020a-canal-c64.png`, `art-020a-canal-spectrum.png`: the real renderer at 2×, rain and fog showing.
- `docs/art-preview.html`: regenerated with `node tools/art-preview.js`. The last writer wins.

Out-of-scope edits: none.

## Decisions
- **Workflow (TT-019 rule 8).** Helper scripts in the scratchpad turn a 320×72 pixel canvas into cells: for each cell they choose the glyph and the ink/paper pair with the smallest error. Detail is placed by hand as cell overlays, and the output is static strings. The helpers stay out of the repo.
- **Rain only in the window.** `harrows_room` and `phone_box` use fx `rain`. Rain falls on every `' '` and `█` cell, so I drew the interior solids as `▀` with ink equal to paper. Rain therefore shows only in the window and in the clear streaks on the fogged glass.
- **`st_judes` has fx `flicker`.** The brief allows it as an option, and it makes the candle rack waver.
- **`dark` is all black air** with two faint dark-grey "eyes" low on the right, as in the brief.
- **`shed`** shows one empty white outline on the wall. It is the bolt cutters' place, because they are lying on the bench.
- **Clocks show their times.** The mantel clock in `number_13` uses a `V` for its hands, set at ten past ten. The police clock uses `┘`. My first clock designs read as faces or envelopes, so I replaced them.

## How verified
- **Redrawing.** I rendered every picture at 2× in the C64 and Spectrum themes, first with my own PNG renderer and then with the real `screen.js` in headless Chrome, which produced the screenshots above. I critiqued each one and redrew the weakest:
  - crypt, 3 times;
  - platform, station road and police house, 3 times each;
  - lock, towpath and churchyard, twice each;
  - back alley, waiting room, chapel street and number 13, once each.
- **Tests.** `node --test tests/unit/art.test.js` passes 16 of 16.
- **Lint.** `npm run lint:content` gives 0 errors. All 42 location pictures and `dark` now exist.
- **`npm run check` tail:**
```
# tests 1348
# suites 113
# pass 1347
# fail 1
```
  The single failure is `tests/unit/lint.test.js:19`: "strict mode still refuses it (stubs, missing art)". That test asserts that strict lint *fails* while art is missing. Now that every picture exists, strict lint passes, so the expectation is out of date. The test needs updating, and it is outside my allow-list.

## Known gaps / follow-ups
- `tests/unit/lint.test.js:16-19` needs its expectation flipped, now that the art is complete (see above).
- I left the ticket `status:` unchanged because `implementation-b.md` for TT-020b does not exist yet.
- These are polish ideas, not defects:
  - In `lock`, the converging gates read best at 4×.
  - In `lock_cottage`, the rockers of the rocking chair are faint.
  - In the Spectrum theme, the red bolt-cutter handles in `shed` sit on a red bench.
