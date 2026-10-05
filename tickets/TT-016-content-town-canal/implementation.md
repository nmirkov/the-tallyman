# TT-016 implementation

## Summary
The real content bundle now exists, and `npm run play` starts the real game on the platform.

What is in it:
- **Town (18 rooms) and Canal (5 rooms)**, transcribed from STORY §4.1–4.2 and §5: rooms, exits, scenery, items and slots.
- **All five NPCs** (§6): Maggie, Pike, Ashdown, Silas and Harrow.
- **Topics** (§6.1), **content verbs** (§7.4) and the **shared reactions** (§7.3).
- **Registries in full** (§7.5, §11): evidence, notes, vars, the flag list, scoring and ranks.
- **Story data from §8–§10, transcribed now**: case, hazards, all 8 endings with their final text, beats, daemons and hints.
- **The other 19 rooms are stubs** (`stubs.js`).

Data that names a stubbed room switches itself on when that room is added. This is done with `ready()` / `readyRooms()` in `stubs.js`. It covers:
- Pike's Counting Room voice
- the torch TURN OFF warning
- the Counting Room "weak" accusation
- the quarry hazard
- the beats `fog_figure`, `stone_girl` and `harrow_bleeds`, and the non-crypt rooms of `counting_dark`
- the daemons `pike_arrives` and `attack`
- hint steps `way_down` and `door`
- Harrow's location
- the safe rooms of the stubbed zones

So TT-017 and TT-018 mostly add rooms and items and delete stubs.

## Files changed
- **New:** `src/content/`
  - `rules.js`, `registries.js`, `shared.js`, `topics.js`, `verbs.js`
  - `case.js`, `endings.js`, `beats.js`, `hints.js`, `stubs.js`
  - `zones/town.js`, `zones/canal.js`
  - `npcs/{maggie,pike,ashdown,silas,harrow}.js`
- **Rewritten:** `src/content/index.js`. It assembles the bundle, orders items by `ITEM_ORDER` (the §5.1 table), and loads art optionally.
- **Edited:** `src/engine/vocab.js`, `src/engine/parser.js`, with a test in `tests/unit/parser.test.js`. See decision 4.
- **New:** `tests/content/town-canal.test.js` (160 tests).
- **Out of scope:** `tests/unit/lint.test.js`. One test asserted that the real bundle was *empty*. It now asserts 0 errors, and that strict mode still fails.

## Decisions made (with why)
1. **Item stubs.** Town and Canal content refers to 7 later-zone items:
   - as tool targets: `mill_chain`, `chains`, `boiler_hatch`
   - as evidence or shows: `ledger_page`, `patient_file`, `handcuffs`
   - as a topic: `crowbar`

   Lint L14 forbids items located in stub rooms, so these are declared minimally in `stubs.js`: §5.1 names and adjectives, §5.2 desc, `location: null`, and no `critical` flag (lint L08). The zone ticket that owns each one replaces the stub.
2. **Stubbed zones** (moor, mill, asylum) are declared without `safeRoom` and with `panic: false`, because a stub cannot be a safe room (L14). The player can never stand in a stub. The full §3.1 data stays in `rules.js` and comes back automatically.
3. **Art.** `index.js` loads `./art/index.js` with a top-level `await import()`, and tolerates only a missing module. Ending `art` and `rules.darkPicture` are dropped while that art does not exist, because L03 treats them as references. Missing room pictures only warn (L12).
4. **Parser change (out of contract text).** STORY §12.1 #48 `take cutters and oil can` split into two commands, because `oil` is a verb word (A6.2 P2), and that cost 2 turns.
   - **Change:** `buildVocab` now records `nounStarts`: multiword entity names whose first word starts a command. `splitChain` does not cut at AND or `,` when such a name follows.
   - **Scope:** the engine-only vocabulary is unchanged.
   - **Tested:** both directions.
   - **Follow-up:** the orchestrator should add one line to ARCHITECTURE A6.2 P2. I could not edit it, because that file is outside my allow-list.
5. **Item order** = the STORY §5.1 table, set through `ITEM_ORDER`, regardless of which zone file defines an item. It drives room listings and the item-first topic match.

### Deviations from STORY (all mechanical; STORY itself is unchanged)
- **`verbs.js`:** content-verb patterns start with `<word>` where STORY wrote the first word literally (`'pry {dobj}'`). Otherwise PRISE, LEVER, FORCE, CHANGE, FIT and SQUIRT would not parse.
- **`verbs.js`:** added `{ id: 'search', patterns: ['search room|here'] }`. Otherwise `room` binds to the room key, and §7.2 step 17's SEARCH ROOM fails.
- **`topics.js`:** added `t_keeper` (`lock keeper`, `lock-keeper`, `keeper`). Without it, ASK MAGGIE ABOUT LOCK KEEPER matches the item `lock_water`, because items are matched before NPCs (A4.9), and §7.2 step 8 fails. Maggie, Pike and Ashdown answer `t_keeper` exactly as they answer `silas`.
- **`register`:** added `before.search: READ_REGISTER`, for §7.2 step 16 SEARCH REGISTER / LOOK IN REGISTER.
- **Lint L13:** adjectives added to two Market Square lamp scenery entries: `['sodium','orange']` and `['blue','police']`.
- **Engine article choices** (STORY gives none): `article: 'some'` for the batteries and the bolt cutters, and `''` for "Harrow's notes".
- **Typo:** one unescaped apostrophe in STORY's `helmet` variant literal (`'Pike's helmet…'`) was transcribed correctly.
- **Messages:** no `messages` module was created, because STORY has no message overrides.

## How verified
- **Test-first** for the parser change: red, then green.
- **The content tests were written against STORY:**
  - the §12.1 commands 1–50, row by row: room, turn, score, flags, notes, evidence and money
  - every §7.2 phrasing for steps 1–11 and 16–18
  - gates, refusals and fallbacks: the 10p from Maggie, the pint money invariant, critical protection, Silas's DRY
  - the crypt and alibi, PRAY
  - the §12.3 outcomes reachable here: wrong man ×3, cancel, weak, absent, correct-at-desk (fled, arrival turn 68), lock death via SWIM / ENTER / JUMP
  - HINT, HELP, start text, lint, and `npm run play`
- **A verbatim test** checks that every prose string in the bundle occurs in STORY.md.
- **One-off scripts**, not kept, compared scenery names, exits, room facts and the §5.1 item table against STORY. Everything matched, except the intended item stubs.
- **A strict fuzz:** every verb × every noun × all 23 rooms, with and without a kit of items. That is 428,260 inputs, with 0 engine errors.
- **TT-010 has landed** (daemons are live, and thunder fires on turn 46). The tests avoid asserting D2–D6 effects and pass with them running.
- `npm run check` tail:
```
# tests 1062
# suites 70
# pass 1062
# fail 0
build: wrote dist/tallyman.html (966 bytes)
lint:content src/content: 0 error(s), 67 warning(s)
```
- **Lint warnings (67):**
  - L12: missing art
  - L14: 19 stubs
  - L17: `car_found` never given yet
  - L19: `death_fall` / `death_pike` not yet referenced
  - L21: verb-word nouns STORY §15 accepts (phone, lock, oil, case, notes, ring, light, back, handcuff, my)
  - L22: `morgue_hatch_found`

## Known gaps / follow-ups
- **TT-017 / TT-018:**
  - Delete room stubs and item stubs as the real rooms and items land. Gated data then switches on.
  - Give the real items their §5.2 slots and `critical: true`.
  - Remove the `ready()` gates once no stubs remain. They are no-ops then.
- **TT-012 bundling:** esbuild's `iife` output cannot contain top-level await. Once `src/content/art/index.js` exists, replace `loadArt()` with a static `import { art } from './art/index.js'` (a one-line change).
- **ARCHITECTURE A6.2 P2** should mention the multiword-name exception (decision 4).
- **Shed text:** the oil can's `initial` text mentions "the bench" in the shed, which has no `bench` scenery in STORY. X BENCH there says "You can't see any such thing."
