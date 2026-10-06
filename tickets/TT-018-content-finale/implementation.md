# TT-018 implementation

## Summary
The game is complete: all 42 STORY rooms are real content and there are no stubs left.

- **Beneath zone** (`zones/beneath.js`, STORY §4.6, §3.3, §7.4, §8.3–8.5):
  - the Tunnel: three desc variants, exit msg F, KNOCK, the cough when Harrow is chained after 23:00, and first-entry music `dread`;
  - the Counting Room: Pike's greeting, the re-entry line, `BLEED_CUE`, and the scenery;
  - the `chains` item.
- **Stubs removed.** `stubs.js` is deleted, along with every `ready()` / `readyRooms()` gate. The data those gates held back (all of it transcribed in TT-016/017) is now written inline:
  - the `pike_arrives` and `attack` daemons and the `harrow_bleeds` beat;
  - `tunnel` in `counting_dark`;
  - hint steps `way_down` and `door`;
  - the Counting Room `weak` accusation;
  - Pike's Counting Room voice and the TURN OFF warning;
  - Harrow's location and `boiler_hatch.alsoIn`;
  - the counting-house, iron-trap and TRAP variants.

  `rules.zones` is now the literal §3.1 table.
- The case, endings, beats, hints, scoring, HELP and intro were already complete from TT-016. I checked them against STORY §8–§11 and §1.6–1.7, and the tests below now exercise them.

**Walkthrough result:** STORY §12.1 ends in `victory` on turn 91 at 22:15 with 100/100, rank "Chief Inspector". The §12.2 boiler-room route wins on turn 102 with 100/100.

## Files changed
- **New:**
  - `src/content/zones/beneath.js`
  - `tests/content/walkthrough-smoke.test.js` (25 tests)
  - `tests/content/beneath.test.js` (52 tests)
- **Edited:**
  - `src/content/index.js`: adds the `beneath` module, drops `stubs` / `itemStubs`.
  - `beats.js`, `hints.js`, `case.js`, `shared.js`, `rules.js`, `npcs/pike.js`, `npcs/harrow.js`, `zones/mill.js`, `zones/town.js`: gates removed.
  - `verbs.js`: one pattern added (decision 3).
- **Deleted:** `src/content/stubs.js`.
- **Tests updated:**
  - `tests/content/moor-mill-asylum.test.js`: rows 88 (§12.1) and 99 (§12.2), and the morgue-hatch test, now arrive in `tunnel`. The bundle test expects 42 rooms and no stubs, and `counting_dark` includes the tunnel.
  - `tests/content/town-canal.test.js`: no stubs import. The strict-lint test allows only L12, and has 0 errors with `allowMissingArt`.
- **Allowed by the ticket:**
  - `tools/lint-content.js`: a new `--allow-missing-art` flag (option `allowMissingArt`). In `--strict` mode, an L12 "art does not exist" finding stays a warning; everything else is unchanged.
  - `package.json`: `check` now runs `lint:content -- --strict --allow-missing-art`. **Drop the flag at R3, once all art has landed.**
- `tickets/TT-018-content-finale/ticket.md`: `status: verify`.

## Decisions made (with why)
1. **Delete `stubs.js` rather than leave it empty.** The ticket says to remove all stubs, and the `ready()` gates are no-ops once no stubs remain. Inlining the data makes each module read like STORY again.
2. **`chains` is `scenery`.** It follows the §5.1 table, which is the flag source. §4.6 calls it a "fixed item", but the table wins, and as scenery it is not listed in the room.
3. **Added `{ id: 'cut', patterns: ['cut {dobj} free'] }`.** STORY §7.2 step 29 lists CUT HARROW FREE. Without this, "free" is parsed as a noun ("You can't see any such thing.").
4. **Bleed beats in the pyrrhic script: 11, not 10.** They fire on turns 100, 120 … 300, because D2 runs before D8 on turn 300. The test asserts 11.

### Deviations from STORY (mechanical; STORY is unchanged)
- **Msg F variant 1 is unreachable.** The text is "Into a room with Pike in it, in the dark? …". With the torch off, the tunnel is dark, so A8.3's darkness rule refuses the move ("You blunder about in the dark…") before the exit's `if` runs. This is the same case as TT-017's morgue msg E. The text is transcribed and the test documents the actual behaviour.
- **The tunnel desc is built from a shared prefix** (template string). Each full variant is still a verbatim STORY string, and the verbatim test passes.

## How verified
- **`walkthrough-smoke.test.js`:**
  - **§12.1:** victory on turn 91 with 100/100, "Chief Inspector", status time 22:15, and every command costs exactly one turn. Rows 88–91 are checked in detail.
  - **§12.2:** victory on turn 102 with 100/100. The hatch is crossed from both sides.
  - **§12.3, every script:**

    | Script | Expected outcome |
    |---|---|
    | free-then-cuff | victory on turn 91 |
    | pyrrhic | turn 300, score 90 |
    | got away | turn 300, score 90, counter paused at 2 |
    | fifth stroke, never accused | Pike leaves on turn 240 and arrives on 250; default text |
    | fifth stroke, accused | accusation variant, score 65 |
    | wrong man ×3 | turns 4, 6, 6, each with its own text |
    | cancel | no turn passes |
    | weak accusation | nerve 17 |
    | absent suspect | free (no turn) |
    | drowning | warning on turn 5, death on 6; UNDO keeps the warning |
    | quarry | death on turn 8 |
    | quarry with rope | descends safely |
    | Pike death, lit | warnings on turns 90, 91, 92; death on 93 |
    | Pike death, dark | warned once, then death on turn 91 |
    | arrest without cuffs | "With what?" |
    | town panic | player moved to Market Square, nerve 50, cooldown 15 |

- **`beneath.test.js`:**
  - the iron door before and after Pike arrives: desc, msg F, EXAMINE, KNOCK, the 23:00 variants;
  - the arrival heard from the tunnel (sfx `door`) and from the counting house (sfx `hatch`, bolted trap);
  - the music plays once;
  - the hatch from the tunnel side;
  - the greeting, re-entry, counter pause and bleeding cues;
  - all scenery;
  - every §7.2 phrasing for steps 27–29 (26 phrasings);
  - Pike's and Harrow's finale voices and topics;
  - ACCUSE in the Counting Room, both repeat and weak;
  - the TURN OFF warning;
  - hint steps 11–14 and their costs.
- **One-off fuzz (not kept):** every verb word × every noun, plus bare verbs, in four finale states (tunnel; room at attack 1; after the arrest; after the cut). 144,144 inputs in strict mode gave 0 errors.
- `npm run play` starts the game normally.
- `npm run check` tail:
```
lint:content src/content (strict): 0 error(s), 66 warning(s)
# tests 1348
# suites 113
# pass 1348
# fail 0
build: wrote dist/tallyman.html (966 bytes)
```
- **Lint warnings by rule:**
  - L12 ×39: room art not drawn yet (TT-020/021, in progress in parallel).
  - L18 ×4: the batteries move, as intended.
  - L21 ×23: verb-word nouns, as accepted in TT-016/017.

  The L14, L19 and L22 warnings are gone.

## Known gaps / follow-ups
- **`tests/unit/lint.test.js`** (outside my allow-list) asserts that `--strict` "still refuses" the real bundle. That now holds only because of missing art (L12). **It will fail once all room art lands.** At R3, flip it to assert 0 strict errors, and drop `--allow-missing-art` from `check`.
- **Ending art and `rules.darkPicture`** are still dropped by `index.js` while those pictures do not exist (TT-021). TT-016 also noted that `loadArt()` should become a static import for the esbuild `iife` build, now that `art/index.js` exists.
- **ARCHITECTURE A6.2:** the TT-016 follow-up still applies (the multiword noun-start exception).
- **Docs follow-up:** STORY §7.4 could list the `cut {dobj} free` pattern (decision 3).
