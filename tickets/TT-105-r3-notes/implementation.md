# TT-105 — R3 notes: implementation

## Summary
All 13 non-blocking notes of `reviews/code-review-R3-1.md` were handled. 10 are fixed in content, 1 is
partly fixed and 2 are accepted with a reason, because the fix lies outside this ticket's allow-list.
STORY.md was updated to match every content change, and the verbatim-STORY test passes.
`docs/QA-REPORT.md` was refreshed.

| # | Note | Outcome |
|---|---|---|
| 1 | Dark re-entry fatal without the "One..." warning after a refused TURN OFF | **Fixed.** The refusal now sets its own flag, `torch_off_warned`. Only two things set `dark_warned`, the flag the counter's dark kill needs: the counter's own "One..." warning, and a deliberate second TURN OFF in the room after the refusal (`TORCH_OFF_WARNING` is now a two-case reaction; the second case sets `dark_warned` with `continue: true`). As a result, retracing into the dark room always warns first, and "refuse, then TURN OFF again" is still fatal at once, as STORY §12.3 and the existing test expect. A dark re-entry also gets its own onEnter line ("Somewhere ahead of you in the black…") instead of "Pike is waiting for you, knife low". This was the cosmetic gap TT-120 listed. |
| 2 | QA-REPORT stale | **Fixed.** The suite table is updated (solvability 222/222, new R3 suite 60/60, 0 todo). TT-120..123 are marked fixed, the TT-105 finding is added, and the quarry and Y/N items are updated. |
| 3 | Counting Room: knife / door / tunic | **Fixed.** New scenery: `knife, butcher knife` (with a variant once Pike is restrained), `tunic, uniform`, `door` (adj `iron`), and `vault, brick, bricks, ceiling`. X TUNIC now resolves to the tunic even when the button is carried (A6.3 M4a: the full-name match wins). |
| 4 | "You could tie a rope to that" with no TIE verb; `lip` / `edge` | **Fixed.** New content verb `tie` (tie, fasten, knot, lash, attach; `tie X`, `tie X to/on/onto/round/around Y`, `tie up X`). `rope.before.tie` / `use` = `TIE_ROPE`: at the edge with the rope in hand it *is* the climb down (it moves the player, the same as DOWN, and `quarry_floor.onEnter` tells the climb). Without the rope in hand it says "You'll want to be holding it first."; anywhere else, "There's nothing here worth tying it to." `lip, edge, quarry edge` were added to the edge's face scenery, so JUMP OFF EDGE reaches the room's refusal. |
| 5 | Other scenery gaps | **Fixed**, every room listed: counting_house desk/window/padlock (padlock, disc padlock and hasp are now names of `iron_trap`, so CUT PADLOCK gets the trap's refusal), boiler_room steps/floor (+ `rim` on the hatch), crypt wall/steps, morgue wall (`drawers`)/floor/stair (+ `rails, runners` on drawer 4), harrows_room and entrance_hall stair, entrance_hall cellar, lock_cottage door (+ shelf), moor_road door (the Cortina), mill_gates bar (+ window), quarry_floor spoil/heaps/edge/face, records_office lodge, asylum_gates wall/padlock/chain. A sweep also found and fixed: cells corridor, police_house floor, mill_yard door, towpath steps, St Jude's wall, churchyard face, quarry_hut droppings/rust, phone_box page, ward ceiling, vestry pages. |
| 6 | Police House after Pike has gone | **Fixed.** New flag `pike_fled`, set by the ACCUSE that makes him run. The helmet desc variant and the room desc variant test it, so the helmet stays on the floor after he reaches the Counting Room. Cape/peg scenery gets a "gone" variant (any state other than `desk`), plus `floor, lino` scenery. |
| 7 | Pike's bicycle still in the cells | **Fixed.** The cells desc and the bicycle scenery have variants for `pikeState ne 'desk'` ("The corridor is empty: Pike's bicycle has gone…"). |
| 8 | Generic nerve lines in the torch-lit finale | **Fixed.** `rules.nerve.messages` 50 / 75 now use Text variants with `{zone: 'beneath'}` lines. The engine already renders Text variants there, so no engine change was needed. Line 90 is generic and still fits. |
| 9 | READ MAP doesn't set `heard_of_silas` | **Fixed** in content, as STORY §7.1 already said ("Maggie / map / visit"): `case_map.readable` sets the flag. STORY §7.2 step 8 now lists READ MAP. |
| 10 | Y/N prompt: `maybe` → cancel text + "I don't know the word" | **Accepted.** This is the engine contract A7.3 (a non-answer cancels, then the line is parsed as a command). Swallowing the parse error would be an engine change in `src/engine/game.js`, which is outside the allow-list. Recorded in QA-REPORT for the engine owner. |
| 11 | X TORCH in the dark → "too dark" | **Partly fixed.** `torch.before.examine` gives a by-touch description in the dark (loaded or not). Other carried items still say "It's too dark to see." That rule belongs to the engine's examine handler (outside the allow-list). Follow-up below. |
| 12 | PLAN §2.5 "5 turns later" wording | **Accepted.** `docs/PLAN.md` is not in this ticket's allow-list. The note is kept open in QA-REPORT for TT-025. STORY and the engine already agree. |
| 13 | Test gaps | **Fixed.** (a) Note 1's sequence, plus "refuse → leave → return → TURN OFF is fatal", in `tests/walkthrough/solvability.test.js` (TT-120..122 block). (b) A scenery-coverage test per room in `tests/content/r3-notes.test.js`, the reviewer's suggested lint rule written as a test (lint is outside the allow-list). (c) `tie` / `lip` / `edge` are real passing tests, not todos. |

## Files changed
- `src/content/zones/town.js`: `TORCH_OFF_WARNING` (two cases, `IN_WITH_PIKE`), `torch.before.examine`; Police House desc/helmet/cape/floor variants; cells desc + bicycle variants + corridor; `case_map` sets `heard_of_silas`; scenery for harrows_room stair, st_judes wall, churchyard face, crypt wall/steps, phone_box page; register `pages`.
- `src/content/zones/beneath.js`: Counting Room scenery (knife, tunic, door, vault); dark re-entry onEnter line.
- `src/content/zones/moor.js`: `TIE_ROPE`, `rope.before.tie/use`; scenery for moor_road door, quarry_edge lip/edge, quarry_hut droppings, quarry_floor spoil/face.
- `src/content/zones/mill.js`, `asylum.js`, `canal.js`: the scenery listed in note 5.
- `src/content/beats.js`: comment on the dark branch (the logic is unchanged).
- `src/content/case.js`: `setFlag: 'pike_fled'` on the police-house ACCUSE.
- `src/content/rules.js`: Beneath nerve-message variants.
- `src/content/verbs.js`: `tie` verb.
- `src/content/registries.js`: flags `torch_off_warned`, `pike_fled` (26 → 28).
- `docs/STORY.md`: §3.1 nerve, §3.3 retrace note, §4 rooms (every scenery/desc change), §5.1 names, §5.2 torch/case_map/rope, §7.2 step 8, §7.4 `tie`, §7.5 flags, §8.1, §8.4 counter fairness text and onEnter, §13 Dark Counting Room row.
- `docs/QA-REPORT.md`: refreshed.
- Tests: new `tests/content/r3-notes.test.js` (60 tests); `tests/walkthrough/solvability.test.js` (+2); adapted `tests/content/walkthrough-smoke.test.js` (the refusal sets `torch_off_warned`, not `dark_warned`), `tests/content/beneath.test.js` (the boiler room now has `steps`), `tests/content/town-canal.test.js` (28 flags).

`src/engine/vocab.js` was not touched: `tie` is a content verb (A4.15), like `pry` and `knock`.

## Decisions made (with why)
- **The fix keeps "refuse, then TURN OFF again = death".** The reviewer suggested making the kill depend only on the daemon's own flag. That would have given the deliberate second TURN OFF an extra warning turn, and changed a STORY §12.3 outcome and its test. Arming the counter only from the second TURN OFF *in the room* keeps that outcome and closes the bypass.
- **TIE performs the descent instead of refusing.** The prose invites it, and it is the natural command. It reuses the existing climb text (onEnter), so there is no new path to a hazard. The rope must be in hand, so the "the rope is yours again" text stays true.
- **Scenery coverage as a test, not a lint rule.** `tools/lint-content.js` is outside the allow-list. The test's per-room exception list is kept minimal and verified (every listed word actually fails to resolve). People are excluded, because NPC presence is state.

## How verified
- Note 1 repro (fresh game, §12.1 #1-89, `turn off torch`, `s`, `turn off torch`, `n`): now shows "One... Light. You need light, now." and the game runs on. `wait` → death_pike. TURN ON TORCH → ARREST → win.
- A scratchpad sweep that runs X on every word of every room desc; it was rerun until only the documented exceptions were left.
- `npm run check` (tail):
```
lint:content src/content (strict): 0 error(s), 27 warning(s)
# tests 1838
# pass 1838
# fail 0
# todo 0
build: wrote dist/tallyman.html (659789 bytes)
```
  The walkthrough suites still win 100/100 (turn 91 reference, turn 102 boiler route).

## Known gaps / follow-ups
- **Art (artist):** the `cells` picture brief draws the bicycle in the centre, and it is shown after Pike has ridden off. A bike-less variant or a neutral picture would match the new desc. Not touched (`src/content/art/**` is out of scope).
- **Engine:** EXAMINE of carried items in the dark (other than the torch) and the Y/N non-answer parse error (notes 10 and 11).
- **PLAN wording** (note 12), for TT-025.
- **Unknown-word nouns** in descs (e.g. "office", "corridor"-style words in other rooms) are not caught by the coverage test. Only words the game already knows as nouns are. The remaining audit is TT-024's.
