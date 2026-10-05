# TT-009 implementation

## Summary
The detective layer is now generic and data-driven. It replaces TT-008's `placeholder.js`.

- **`actions/npc.js`**
  - **TALK TO** runs `talk`, then `default`, then `talkNothing`.
  - **ASK / TELL X ABOUT Y** use the A4.9 topic match: `topics[topic]`, then `default`, then `topicNothing`.
  - **SHOW X TO Y** runs `shows[X]`, else `showDefault`.
  - **GIVE X TO Y** with an `accepts` entry: the item moves to the NPC, then the reaction runs. Otherwise `refuse`, else `giveRefuse`, and the item is kept.
  - **BUY X [FROM Y]** follows A8.9: no seller, `if`/`refuse`, already in the world, can't afford, then success. Money is in pence and shown with `formatMoney`; evidence discovery applies.
  - Every refusal is a message id that content can override.
- **`actions/case.js`**
  - **ACCUSE**, through `ActionDef.confirm`:
    - Not present: the resolver's `notHere` ("Accuse who? They're not here."), free.
    - A suspect: a free `PendingConfirm` with `case.confirm` and optional `cancelText`. YES runs `case.wrong` (1 turn). NO or anything else cancels with no turn.
    - The culprit: `case.correct` if the evidence count is at or above `threshold`, else `case.weak`.
    - Any other NPC: `case.other`, else `accuseOther`.
    - A thing, yourself, or no `case` in the content: in-world refusals.
  - **NOTES** (free): note texts in the order noted, then `Evidence (n):` with each discovered label. Item evidence not carried is marked "(not with you)".
  - **HINT** (free in turns): the first step whose `done` is false. It shows the next tier and stops at the last one. It costs `hintCost` points (score floor 0) and emits `status`. With no open step it says `hintDone` at no cost.
- **Self-reference.**
  - `ME`, `MYSELF`, `SELF` and `YOURSELF` are known words. A phrase made only of them binds to `'player'`, always in scope, even in the dark.
  - EXAMINE ME gives `examineSelf` ("As good as can be expected, given the night.", which content can override).
  - SHOW / GIVE X TO ME are harmless refusals.
  - Other verbs aimed at yourself say `selfDefault`.
- **Personal and critical protection** for DROP / PUT / GIVE / THROW / EAT / DRINK / BREAK was already generic in TT-008's `protect.js`. It is now exercised through the real GIVE handler, and its overrides (`personal`, `critical`, `criticalMsg`) are tested.

## Files changed
- `src/engine/actions/npc.js` (new): NPC verbs, messages, and the `selfAware(def)` wrapper.
- `src/engine/actions/case.js` (new): ACCUSE (with `confirm`), NOTES, HINT, and messages.
- `src/engine/actions/index.js`: registers `npc` and `case` in place of `placeholder`. Wraps every handler with `npc.selfAware`.
- `src/engine/actions/placeholder.js`: deleted (replaced).
- `src/engine/vocab.js`: adds the `SELF_WORDS` export and makes those words known.
- `src/engine/resolve.js`:
  - A single phrase of self words binds to `PLAYER`. Lists and EXCEPT do not.
  - AGAIN treats `PLAYER` as present.
- `tests/fixtures/case-world.js` (new, additive): mini-world plus
  - Silas: proper, a suspect, accepts a critical photo, sells matches;
  - a non-proper constable that uses every engine default;
  - the photo (critical, with `criticalMsg`) and matches;
  - `case.other`, `case.cancelText`, and a third hint step.
- `tests/unit/actions-npc.test.js` (27 tests) and `tests/unit/actions-case.test.js` (27 tests), both new.
- `tickets/TT-009-case-mechanics/ticket.md`: `status: verify`.

## Out-of-scope edits
- `src/engine/state.js` `checkCommand` (3 lines): a saved command's `dobj` / `iobj` may be `'player'`. Without this, `X ME` followed by SAVE produced a save that `validateSave` rejected as corrupt, because `ctx.lastCommand.dobj === 'player'`. `ctx.it` / `them` / `npc` / candidates still reject `'player'`.

## Decisions made (with why)
1. **Separate `case-world.js` instead of editing `mini-world.js`.** The mini-world already has 2 NPCs, evidence, hints and a case. Adding NPCs to its rooms would change room listings that other suites assert, and its lint test pins the warnings to exactly `['L14']`. The case-world is built from the mini-world with additions only, and lints with 0 errors (this is tested).
2. **Self-reference wrapper in the registry (`selfAware`)**, not edits to `observe.js` / `objects.js`. Those files are outside the allow-list, and handlers written for items and NPCs never see `'player'`. NPC and case verbs (`talk`, `ask`, `tell`, `show`, `give`, `buy`, `accuse`) handle it themselves. ME never sets `it` / `npc`.
3. **Fallback chains:** a slot reaction that exists but does not fire (for example a conditional case with no match) falls through to the next default, so the player never gets silence:
   - TALK: `talk` → `default` → `talkNothing`
   - ASK / TELL: topic → `default` → `topicNothing`
   - SHOW: `shows` → `showDefault`
   - GIVE refusal: `refuse` → `giveRefuse`
   - `talkNothing` ("{The} has nothing to say to you.") applies only when there is no `talk` or `default`. In that case A4.8's "same as default" would use the about-that wording, which reads oddly after TALK.
4. **`ok` (which gates `after` slots):** true for TALK / ASK / TELL / SHOW (when the item was held and shown to an NPC), accepted GIVE, a successful BUY, and the case outcomes. False for refusals and for refused GIVE / BUY.
5. **BUY text comes before discovery output**, consistent with TT-008 decision 5 ("Taken." first). BUY X FROM Y:
   - Y not an NPC → `buyNoSale`.
   - Y does not sell X → `buyNotFrom` ("{The} doesn't sell that.").
6. **ACCUSE precedence:**
   - The culprit wins over `suspects`, so there is no prompt for the culprit.
   - The confirm Text is rendered with the accused as `self`. An empty render falls back to `accuseConfirm`.
   - `cancelText` is stored rendered in the pending question, as A3.3 requires a string.
   - Case reactions run with hook phase `case` and `self` = the accused (A5 allows "NPC id").
7. **NOTES format:** one text event for the notebook and one for the evidence section, each `\n`-joined like INVENTORY. Message ids: `notesHeader`, `evidenceHeader` (`{n}` = the A8.8 count), `notesLine`, `notWithYou`, `notesEmpty`.
8. **HINT** with an empty or missing hint list also says `hintDone`. The placeholder's `hintNone` id is gone, because A8.11 defines one message for "no open step".

## How verified
- **Not strictly test-first.** I wrote the handlers before the tests. The tests then caught one real ordering issue (BUY text vs `scoreUp`), which was fixed, and one wrong test expectation.
- **ACCUSE rules covered (PLAN §2.5 / A14 rules 2–5):**
  - not present (free, chain stops);
  - correct with exactly the threshold and above it;
  - correct as cases (A14 encoding);
  - facts vs carried items (also inside a carried bag);
  - drop and retake changes the count;
  - weak gives nerve +15 and can be retried;
  - suspect prompt (free, last event, exact pending);
  - YES / Y → wrong-man ending at 1 turn;
  - NO / N cancels with no turn (N is not north);
  - any other input cancels, then runs the new command at its own cost;
  - content `cancelText` / `confirm` variants;
  - the pending question survives SAVE / LOAD, and UNDO works after the ending;
  - a cancelled accusation never becomes `lastCommand`;
  - hook args, `other` / `accuseOther`, things, self, no case, NPC `before.accuse`.
- **NPC verbs:** every branch above, both SHOW / GIVE word orders, pronoun HER, `after` slots gated by `ok`, message overrides, 50p / £2.00 formatting, a strict fuzz of over 400 NPC sentences.
- `npm run check` tail:
```
# tests 836
# suites 33
# pass 836
# fail 0
# cancelled 0
# skipped 0
# todo 0
build: wrote dist/tallyman.html (966 bytes)
```
- Sample (`npm run play -- --content tests/fixtures/mini-world.js`):
```
> x me
As good as can be expected, given the night.
> ask maggie about the dead girl
"Terrible business. Ask Arthur, he knows everyone."
> buy whisky
You buy a bottle of whisky for £2.00.
> accuse maggie
Are you certain? (Y/N)
> no
(Cancelled.)
> show card to maggie
"Oh! Police, is it?"
> accuse pike
Accuse who? They're not here.
> hint
It is dark below the town.
```

## Known gaps / follow-ups
- `tests/unit/actions-meta.test.js` still has a test named "TT-009 slot: … placeholders for now". It passes with the real handlers but its name is stale. The file is outside the allow-list, so the orchestrator may want to rename it.
- `docs/ARCHITECTURE.md` A1 still describes `placeholder` as the TT-009 slot. Update it to "npc, case" (plus `SELF_WORDS` and the `'player'` command target) in the next contract edit.
- The mini-world's Pike lacks `proper: true`, so it reads "the Sergeant Pike". The engine honours `proper` (tested with Maggie and Silas). Real content must set it on named characters.
- With `X ME` and similar commands, the A3.3 note "ids MUST exist" is widened: a command (not a pronoun) may target `'player'`. This should be recorded as a contract decision.
