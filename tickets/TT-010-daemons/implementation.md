# TT-010 implementation

## Summary
`src/engine/daemons.js` now holds the whole per-turn pipeline, D1–D9 (A7.6). Every step is driven by content data:

- **D1 clock:** `turn + 1`, clamped at `MIDNIGHT_TURN`.
- **D2 beats (A4.12):**
  - Triggers are `at`, `every` and `when`, in any combination.
  - `once` defaults to true for `when`-only beats.
  - A once-beat id goes into `state.fired` only when its reaction actually fired, so a failed `chance` retries.
- **D3 schedules:**
  - Entries run in NPC content order when `at === turn` and `if` holds.
  - Then `leaveText` / `arriveText` (only in a lit room, and only when the NPC changed location), then `do`.
- **D4 story daemons:** run in array order. Pike's arrival and the attack counter are pure data.
- **D5 light:**
  - Every lit item with `fuel` burns 1 per turn.
  - At 0 it goes out, with `outText` (or the `lightOut` default) only if the player could see it before it went out.
  - The O5 re-description follows if the player's room changed lit state.
- **D6 nerve and panic (A8.10):**
  - Base delta (dark / safe / lit / torch-lit dark room), plus `room.nerve`, clamped.
  - Zone cap with `capText`.
  - Threshold messages crossed on the way up, sorted ascending.
  - Panic: text (zone, then rules, then default), `sfx sting`, full room entry into the safe room, nerve reset, cooldown, `run.panicked` (stops the chain). Otherwise the cooldown counts down.
- **D7 ambience**, **D8 endings** (E1 and E2: an ending already set stands, otherwise the first `when` in content order), **D9 status**.
- Each step after an ending is skipped, and loops inside D2–D4 stop at once if a reaction ends the game.
- Hooks get the phase `beat` / `schedule` (with `self` = the NPC) / `daemon`, plus the current `cmd`. Cond hooks evaluated by the steps also see `cmd`.

Scoring needed no new code: once-only `award`, the clamp at `maxScore`, ranks, and the `end` event's score and rank were already in `api.js`. They are now covered by TT-010 tests.

## Files changed
- `src/engine/daemons.js` (new): `DAEMON_STEPS`, `runDaemons(run, cmd)`, `DAEMON_MESSAGES` (`lightOut`, `panic`), `nerveRules(content)`.
- `src/engine/game.js` (wiring only):
  - removes the inline steps and re-exports `DAEMON_STEPS` (A1);
  - `finishTurn` calls `runDaemons`;
  - `turnStart` gains `nerve` (A8.10's `n0`);
  - `DAEMON_MESSAGES` are merged into the run's message defaults;
  - drops the now-unused `MIDNIGHT_TURN` / `testCond` imports.
- `tests/fixtures/daemon-world.js` (new):
  - 7 rooms in 3 zones (town and mill can panic; Beneath has cap 99);
  - Pike's schedule (STORY §6.3) and the fled route (§8.1);
  - **STORY §8.4's `pike_arrives` and `attack` daemons, the Counting Room `onEnter` and `BLEED_CUE` transcribed literally**;
  - §9.1-style beats (`at`, `at` + `when`, `every` + `when` with `chance` / `pick`, a once `when`, `harrow_bleeds`);
  - a fuel lantern and the four `when` endings in order.
  - It lints with 0 errors and 0 warnings in `--strict`.
- `tests/unit/daemons.test.js` (new, 56 tests) and `tests/unit/determinism.test.js` (new, 9 tests).
- `tickets/TT-010-daemons/ticket.md`: `status: verify`.

## Out-of-scope edits
- `tests/unit/actions-case.test.js` (2 lines): the TT-009 "weak accusation" test asserted nerve exactly `n0 + 15`. With D6 live, the lit office adds −1 per turn, so the expectations are now `n0 + 15 - 1` and `n0 + 30 - 2`, with a comment. No engine behaviour changed.

## Decisions made (with why)
1. **`capText` fires when nerve first *reaches* the cap (`n === cap && n0 < cap`), not only when it is clamped from above it.**
   - Read literally, A8.10 step 3 never says the text if nerve lands exactly on 99 and then stays there.
   - A4.6 and the typedef say "only on the turn it first reaches the cap", and this rule satisfies both.
2. **Schedule texts need a lit room and an actual change of location.** A7.6 says "lit rooms only". With `from === to` nobody comes or goes.
3. **The burn-out text is gated on visibility *before* the light goes out.** A lantern lighting a dark room is visible because of its own light, so the check must come first or the text would never show.
4. **Panic uses the full `enterRoom`, including the safe room's `onEnter`,** as A8.3 step 7 requires. Panic also applies when the player is already in the safe room: the contract has no exception, and lint makes it unreachable in practice.
5. **Default panic text** (`DAEMON_MESSAGES.panic`) exists only for bundles that set neither `zone.panicText` nor `rules.nerve.panicText`. Content can override it.
6. **`runDaemons` takes `cmd`** (A1 lists `runDaemons(run)`; `cmd` is optional), because A5 gives pipeline hooks "the current command".

## How verified
- Test-first: the fixture and `daemons.test.js` were written first and failed (module missing). Then `daemons.js` was written and the wiring done. After that, only the out-of-scope TT-009 expectation needed a change.
- **Order of operations:** one turn emits a marker from every step. The test asserts A, B, D2, D3 (arrive then `do`), D4 (sees the D3 arrival), D5, D6, D7, D9 and `end`, strictly in that order, with `end` last. Further cases:
  - the action ends the game → only status and `end`, with D5 and D6 provably skipped;
  - free commands run no daemons;
  - every chain command gets its own status.
- **Boundary 299/300:**
  - midnight: no ending at 299, fifth stroke at 300, with the exact `end` event;
  - victory on 300 beats pyrrhic, got-away and fifth stroke;
  - all three midnight variants;
  - death by the counter at D4 on turn 300 beats midnight;
  - an action death stands over a `when` ending;
  - the chain notice comes before `end`;
  - only ENDED verbs are accepted, and UNDO returns to 299.
- **Attack counter (data only):**
  - lit run 1 → 2 → 3 → 4 (lunge +20; D6 caps it at 99 with `capText` the same turn) → 5 (death, lit text);
  - dark: turning off at 1 is fatal at 2; entering unlit warns at 1;
  - ARREST stops the counter in the same turn, then FREE wins; free-then-arrest also wins;
  - "With what?" costs a turn;
  - leaving pauses the counter and re-entry gives +1;
  - the bleeding cue and the every-20 beat.
- **Panic and nerve:**
  - panic in the town zone (zone text) and the mill zone (rules text), plus the default text;
  - the exact panic event sequence;
  - the chain stops;
  - cooldown 14…0, then panic again;
  - ambient emitted after a panic;
  - Beneath cap (no panic, `capText` once, cap in both rooms, entering at 100);
  - every base delta, overriding the tuning, ascending threshold messages.
- **Light:** burn per turn, the spent light refuses TURN ON, endless sources, out of sight is silent, the default text, and the O5 darkness re-description.
- **Schedules:** Pike leaves at 240 with `leaveText`, `do` sets `left` and arrival 250, he leaves silently when the player is elsewhere, the entry is skipped once he has fled. Also `at` exactness and a dark destination.
- **Pike arrives:** `left` at 250 is heard from the tunnel and the iron door opens; `fled` arrives exactly 5 turns after the accusation.
- **A15:** the nerve values are now exact (9, 8, 7, 12, then 7 after UNDO). `game.test.js` still has its `noNerve` filter; that file is outside the allow-list.
- **Determinism:**
  - same seed → identical events and state over 3 walks;
  - RNG beats really fire, and different seeds produce different beats;
  - state stays plain JSON after every turn;
  - save → load (JSON string, into a game with a different seed) → identical events and final state, for 5 walks × 7 split points, each walk spanning ≥ 50 turns;
  - a mid-cooldown / mid-counter save;
  - UNDO then replay gives identical events.
- D1 grep on `daemons.js`: no `Math.random`, `Date`, `console`, timers or Node imports. Imports follow D4 (types → world → api → daemons → game).
- `npm run check` tail:
```
# suites 51
# pass 901
# fail 0
# cancelled 0
# skipped 0
# todo 0
build: wrote dist/tallyman.html (966 bytes)
```
- Sample (`npm run play -- --content tests/fixtures/daemon-world.js`, after ACCUSE PIKE at the Police House and a walk to the tunnel):
```
> n
Counting Room
...
Pike turns from the wall. He has taken off his tunic ... "I've one more to count."
> n
You can't go that way.
He circles, knife low. "One," he says, matching your steps. "Two."
> wait
Time passes.
"Three," says Pike, and takes a step closer. ...
Your hands will not stop shaking.
> arrest pike
You get the cuffs on him.
[Your score has gone up by 10 points.]
> free harrow
The chains part. Harrow slides down the wall.
[Your score has gone up by 10 points.]
*** The Tally Settled ***
```

## Known gaps / follow-ups
- **`docs/ARCHITECTURE.md` A1** still describes `game.js`'s `DAEMON_STEPS` as "D2–D6 are slots TT-010 fills", and gives the signature as `runDaemons(run)`. The next contract edit should say: daemons.js defines the steps; game.js re-exports them; `runDaemons(run, cmd?)`; `DAEMON_MESSAGES` (`lightOut`, `panic`).
- **A8.10 step 3:** record decision 1 (`capText` on reaching the cap) as a contract decision.
- **The `Run` JSDoc in `api.js`** types `turnStart` without `nerve`. That is a cosmetic fix, in a file outside the allow-list.
- **`tests/unit/game.test.js`:** the `noNerve` filter in the A15 test can now be removed. The exact values are already asserted in `daemons.test.js`.
- **Mini-world:** with live daemons it now panics and burns its candle. No existing test depended on that not happening.
- **Content (TT-016…018):** transcribe the attack and arrival daemons exactly as `tests/fixtures/daemon-world.js` does; that fixture is the proof that STORY §8.4 works as data.
