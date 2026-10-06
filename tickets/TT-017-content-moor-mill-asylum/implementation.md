# TT-017 implementation

## Summary
The Moor, Mill and Asylum zones are now real content. This covers:
- **Moor:** 6 rooms, including `quarry_floor`.
- **Mill:** 5 rooms.
- **Asylum:** 6 rooms.

Each zone was transcribed from STORY §4.3–4.5 and §5 with its scenery, items, hazards and room beats. The Moor, Mill and Asylum stubs are deleted.

Six item stubs were also replaced by the real items: `handcuffs`, `crowbar`, `mill_chain`, `ledger_page`, `boiler_hatch` and `patient_file`.

What remains as stubs:
- the two Beneath rooms, `tunnel` and `counting_room`
- the item stub `chains`

Data that TT-016 gated on these rooms switched itself on through `ready()`:
- the safe rooms and panic for the three zones
- the `quarry` hazard
- the beats `fog_figure` and `stone_girl`
- the dark rooms of `counting_dark`

## Files changed
- **New:** `src/content/zones/moor.js`, `src/content/zones/mill.js`, `src/content/zones/asylum.js`.
- **New:** `tests/content/moor-mill-asylum.test.js`, with 175 tests.
- **Edited:**
  - `src/content/index.js`: adds the three zone modules; rooms are now merged from `ZONE_MODULES`.
  - `src/content/stubs.js`: only `tunnel`, `counting_room` and the item stub `chains` remain.
  - `src/content/shared.js`: adds `PRY_CABINET`, `MOVE_DRAWER` and `TRAP`. See decision 1.
  - `tests/content/town-canal.test.js`: two TT-016 assertions that hard-coded "19 stubs" and "the towpath's west exit is a stub" now assert 42 rooms in all and that the towpath leads to `mill_gates`.

## Decisions made (with why)
1. **Three reactions moved to `shared.js`.** `PRY_CABINET`, `MOVE_DRAWER` and `TRAP` are item-local in STORY §5.2. They live in `shared.js` because the Moor crowbar uses all three, and they belong to Asylum and Mill items.
2. **Counting Room variants are gated with `ready('counting_room')`.** Lint L14 forbids a stub inside a Cond. These variants switch on with TT-018:
   - the first `counting_house` desc variant
   - the first `iron_trap` desc variant
   - the "Bolted from beneath" branch of `TRAP`
3. **`boiler_hatch.alsoIn: ['tunnel']` is gated with `ready('tunnel')`.** This is for the same L14 reason. The exit `boiler_room d → tunnel {door: 'boiler_hatch'}` is already in place.
4. **Article choices (STORY gives none):**
   - `handcuffs`: `article: 'some'`, like the bolt cutters. Otherwise the engine would print "a handcuffs".
   - `drawer_four`: `article: ''`, so the listing reads "You can see drawer 4 here."
5. **Fixed vs scenery follows STORY §5.1 exactly.** `cabinet`, `boiler_hatch` and `drawer_four` are `fixed`, not `scenery`, so they appear in the room listing ("You can see a cabinet here."). I kept this rather than invent a flag.

### Deviations from STORY (mechanical; STORY itself is unchanged)
- **Lint L13:** adjectives were added to two pairs of scenery entries that share a noun word with equal (empty) adjective sets:
  - `tally_stone`: the stone gets `['standing','leaning']`, the marks get `['fresh','four']`.
  - `ward`: the beds get `['iron','stripped']`, bed nine gets `['ninth']`.

  `x bed`, `x bed nine`, `x stone` and `x tally marks` all resolve correctly.
- **`ledger_page.before.pull = TEAR_PAGE`:** STORY §5.2 gives only `tear`, but §7.2 step 14 requires PULL PAGE to work.
- **Unreachable text, msg E variant 2** (`morgue` d, "Not without a light."):
  - Why it never shows: the exit is `hidden` and its `if` includes the torch. With the torch off, the morgue (a dark room) refuses the exit through A8.3's hidden or darkness rule ("You blunder about in the dark…").
  - What I did: the text is transcribed anyway, and the test documents the actual behaviour. This is not an engine bug: it is what the contract says.

## How verified
- **`tests/content/moor-mill-asylum.test.js`:**
  - **STORY §12.1, commands 51–88:** replayed row by row after commands 1–50, checking room, turn, score, flags, notes, evidence and sfx at every row. Command 88 is D into the tunnel stub, so the player stays.
  - **STORY §12.2, commands 84–99:** the boiler-room route.
  - **Every §7.2 phrasing** for steps 12–15, 19–24 and 26a/26b.
  - **The quarry:** it warns, then kills (`death_fall` on turn 8). UNDO keeps the warning. With the rope the player goes down safely and climbs back up. Sink and critical protection are also covered.
  - **Both hatches:**
    - Boiler hatch: it refuses until oiled, opens with sfx `hatch`, and its room and ladder text change. Msg D shows.
    - Morgue hatch: the exit is hidden until drawer 4 slides, and the exit, room desc and scenery then change.
  - **Once-only beats:** the mill girl (lit only, +10 nerve, whisper style), the ward, `fog_figure`, `stone_girl`, and the mill-yard and car awards.
  - **Panic on the moor** ends at `moor_road`.
  - **Refusals:** the trap, the cabinet, out-of-place tools, the ledger, and Pike's reactions to the new evidence.
  - **Hints.**
- **The TT-016 verbatim-prose test** walks the whole bundle, so every new string is checked against STORY.md.
- **One-off fuzz (not kept):** every verb word, and every verb word × every noun, in all 17 new rooms. Each ran with three kits: bare; lit with all tools; lit with all tools and every gate open. That is **2,253,741 inputs in strict mode, with 0 engine errors and 0 thrown errors**.
- `npm run play` reaches the asylum gates.
- `npm run check` tail:
```
lint:content src/content: 0 error(s), 67 warning(s)
# tests 1271
# suites 102
# pass 1271
# fail 0
build: wrote dist/tallyman.html (966 bytes)
```
- **Lint warnings by rule:**
  - L12 ×37: room art still missing (artist ticket).
  - L14 ×2: the Beneath stubs.
  - L18 ×4: the batteries move, as intended.
  - L19 ×1: `death_pike` is reached only through TT-018's attack daemon.
  - L21 ×23: verb-word nouns. The new ones are drop, ring, typewriter and drip, and `x drop`, `x ring` and `x drip` all work.

## Known gaps / follow-ups (TT-018)
- **Delete the remaining stubs:** `tunnel`, `counting_room` and the item stub `chains`. The gated data then switches on with no edits needed:
  - the counting-house, iron-trap and TRAP variants
  - `boiler_hatch.alsoIn`
  - the `pike_arrives` and `attack` daemons
  - hints `way_down` and `door`
  - the torch TURN OFF warning
  - Harrow's location
- **Tests that will need updating:**
  - In `moor-mill-asylum.test.js`, rows 88 (§12.1) and 99 (§12.2) assert the stub refusal, and the morgue-hatch test does too. They should become `tunnel` arrivals.
  - The bundle test asserts that exactly `tunnel` and `counting_room` are stubs.
- **Cabinet, minor:** after CLOSE CABINET, OPEN CABINET pries it again, with the same text when the crowbar is carried. Without the crowbar it says "Rusted solid". The cabinet is no longer locked by then, and the crowbar is critical, so this is not a softlock. Fixing the wording would need new prose, which STORY does not have.
- **Ledger page, minor:** if the page is dropped in the counting house, TEAR LEDGER hands it back with "You tease the page free". This is harmless. It follows STORY's literal `{not: {carried}}` condition.
