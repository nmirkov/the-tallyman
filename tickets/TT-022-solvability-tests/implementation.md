# TT-022 — implementation

## Summary
Four suites on the real content in strict mode, expectations taken from STORY §7/§8/§12/§13 and
PLAN §2.5: walkthrough (36 tests), solvability (210, 9 `todo`), save determinism (37), fuzz
(20 seeds × 2 000 commands). They found 4 real bugs, filed as TT-120…TT-123 (2 high, 2 medium);
each is pinned by `{ todo: 'TT-12x' }` tests. Full results: `docs/QA-REPORT.md`.

## Files changed
- `tests/walkthrough/script.js` (new) — parses the §12.1 plain list **and** table (room / score per
  row) and the §12.2 prose route out of STORY.md; run / feed / assertEnding / evidence-count helpers.
- `tests/walkthrough/walkthrough.test.js` (new)
- `tests/walkthrough/solvability.test.js` (new)
- `tests/walkthrough/save-determinism.test.js` (new)
- `tests/fuzz/fuzz.test.js` (new)
- `docs/QA-REPORT.md` (new)
- `tickets/TT-120-items-lost-in-the-dark/ticket.md`, `tickets/TT-121-dark-tunnel-trap/ticket.md`,
  `tickets/TT-122-counting-room-entered-dark/ticket.md`, `tickets/TT-123-gate-item-dropped-behind-gate/ticket.md` (new bug tickets)
- `tickets/TT-022-solvability-tests/ticket.md` — status `verify`, criteria ticked.

## Decisions made
- **Scripts are parsed from STORY.md**, not copied, so the suites follow the bible if it changes.
- **Compact evidence segments** each start and end in Market Square after a shared 29-command
  prefix, so 24 permutations (plus accusing after exactly three, plus the finale) run in < 1 s.
- **Save edits for unusual positions** (harness `setup`) only where play cannot reach the
  position cheaply (item-loss matrix, panic thresholds, canal panic which normal play never
  reaches); every such test says so.
- **Bug tests are fix-agnostic** (e.g. TT-120 passes whether DROP-in-the-dark is refused or TAKE
  finds by touch) so the fixer can choose the design.
- **Bug ids TT-120+** rather than TT-103 to avoid colliding with tickets other agents may file
  in parallel.
- **Fuzz** uses its own PRNG; the last three seeds start in the tunnel / Counting Room so all 42
  rooms are covered; UNDO "bounded" is checked as one level (a second UNDO right after a
  successful one is refused and changes nothing) plus save size ≤ `LIMITS.saveBytes`.

## How verified
`npm run check` (tail):
```
# suites 157
# pass 1729
# fail 0
# cancelled 0
# skipped 0
# todo 9
> node tools/build.js
build: wrote dist/tallyman.html (633311 bytes)
```
Lint: 0 errors (4 accepted L18 warnings for the designed battery consumption).
Each `todo` test was confirmed to fail for the reason in its ticket by replaying the repro in the
terminal player.

## Known gaps / follow-ups
- TT-120…TT-123 to be fixed (engine / content agents); remove the `todo` marks then.
- STORY/PLAN wording: Pike's flight delay (PLAN "5 turns later" vs STORY `turn - 1 + 5`), noted in
  QA-REPORT for TT-025.
- `quarry_edge` "lip"/"edge" vocabulary gap passed to TT-024.
- Fuzz adds ~10–14 s to `npm test`; reduce COMMANDS if the check gets slow.
