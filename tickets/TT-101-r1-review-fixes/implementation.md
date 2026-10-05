# TT-101 — Implementation notes

## Summary
All 9 blocking findings of `reviews/code-review-R1-1.md` and the listed non-blocking items are fixed.
The work was test-first: every regression test in `tests/unit/review-r1.test.js` (named as the review
asked) was written first and seen failing with the reviewer's reproduction. Each fix is made at the
root, using one mechanism per concern:
- one invariant predicate shared by save validation and runtime mutations;
- one "ended" guard in the Reaction runner;
- one reachability wrapper in the action registry;
- one lighting-sync function called at every phase boundary;
- one transaction boundary (`contained()` in game.js) for exceptions.

| # | Finding | Root cause | Fix | Regression test |
|---|---|---|---|---|
| 1 | Critical items destroyable through their container | `protection()` looked only at `cmd.dobj` | `protect.js` now checks the dobj **and its transitive contents**. Personal beats critical, and the protected item's `criticalMsg` is used. An `accepts` entry exempts only the given item itself. | `throwing a container into a sink preserves its critical descendants` (also covers GIVE to an accepting NPC, and a successful throw once the cuffs are out) |
| 2 | Exit-condition exceptions swallowed | `resolve.js` `safeHook` caught the exception and returned `false`. The game also called the resolver non-strict, so `guarded()` turned exceptions into a free `engineError` result without rolling back. | `safeHook` removed, so the exception propagates. `game.js` always calls the resolver with `{strict: true}`, which makes `contained()` the only transaction boundary: rollback of the whole line plus the previous UNDO, or a rethrow in strict mode. | `throwing exit condition rolls back the entire chain and preserves previous UNDO`, `strict mode rethrows the exit-condition exception` |
| 3 | Nested endings overwritten | `endGame` overwrote `state.ended`, and `applyObject` kept applying keys after a nested ending | `endGame` is first-wins. The Reaction runner has a single guard: `evalReaction` returns not-fired once ended, and `applyObject` stops before the next key. D1/D8/D9 and `end` still run. | `onEnter death survives the enclosing reaction's later effects and ending`, `api.end never overwrites an ending already set` |
| 4 | Manipulating unreachable items | Reachability was checked ad hoc in some handlers only (none in DROP, PUT's dobj, GIVE, THROW, …), and the auto-key ignored closed bags | New `reachGuard(def)` in `actions/common.js`, applied to every registry entry in `actions/index.js`. It checks `dobj` for physical verbs and `iobj` for tool/target verbs, at the handler step (1 turn, A8.1). The per-handler duplicates are removed. `keyFor` requires the implicit key to be reachable. | `DROP and PUT cannot extract contents from a closed transparent carried container` (DROP, PUT, GIVE, THROW), `a key inside a closed carried container is not used for UNLOCK` |
| 5 | Lighting changes outside the action phase not presented | O5 was implemented twice, only for the action phase and D5, each comparing against its own start | One `api.syncLight(run)` compares against `run.shown`, which is the room and lit state last presented. `run.shown` is set at turn start and by every `describeRoom`. `syncLight` is called after the action phase, after room entry's `onEnter`, after afterAction and after each daemon step. A description resets the baseline, so each change is announced exactly once. `run.moved` is no longer needed and was removed. | `afterAction lighting change refreshes the room`, `onEnter lighting change replaces the initial dark display`, `a beat that puts the light out shows the darkness once` |
| 6 | Handler-triggered hooks lose the command | Handlers ran with `run.args = NO_ARGS`, so `onEnter` and text hooks inherited `cmd: null` | New `api.withCommand(run, cmd, fn)`. `game.execute` wraps confirm, meta and world execution in it, and `performAction` wraps each object (per-object command for ALL/lists). It is restored in `finally`. | `movement onEnter and EXAMINE text hooks receive the executing command` |
| 7 | Malformed pending commands pass `validateSave` | `checkPending` checked only `verb` / `raw` of the parsed command | `state.js` now has `checkParsedCommand` and `checkNounPhrase`. A noun phrase must have exactly one of words / pronoun / all / list, with typed fields; `except` is allowed only with `all`; list and except elements are simple phrases. `verbWord` is required and the verb must be known (engine or content verb). The asked `slot` must be present, with ≥ 2 distinct candidates. `index` may only point into a `list` with `bound[slot]` = the ids so far; without it the slot phrase is `words` and is not yet bound. Bound keys are checked. Confirm commands also get the known-verb check. | `malformed pending noun phrase rejects LOAD and preserves state and UNDO`, `every malformed part of a disambiguation question is rejected; a well-formed one loads` |
| 8 | API mutations commit unsavable states | `moveEntity` / `setItem` did not enforce S3/S4. `money` / `nerve` accepted non-finite values. | `state.js` exports `itemLocProblem` and `inContainmentCycle`. These are the predicates V9/V10 now use, and `api.checkItem` runs the same ones after every `move` / `setItem`. A violation throws, so the line rolls back. `adjustMoney` / `adjustNerve` throw on non-finite deltas. | `move into a non-container rolls back`, `wearing an uncarried item through setItem rolls back`, `non-finite money / nerve deltas roll back` |
| 9 | Terminal save/export failures crash | `play.js` called `writeFileSync` unguarded | The host's `writeJson` never throws. On failure it keeps the save in memory, prints the reason plus the A10.2 "for this session only" line, and LOAD / IMPORT read the in-memory copy. The script and interactive loops contain any host exception per line. `createHost` is exported and `main()` runs only as the entry point, so the test runs in-process (no child process). | `SAVE and EXPORT write failures allow subsequent commands` |
| a | Non-finite numbers | Lint used `typeof === 'number'` | Lint: `pause` / `money` / `nerve` / `chance` and `evidence` / `moneyGte` / `nerveGte` must be finite, and `{add}` / `{turnPlus}` must be integers. Runtime: see #8. | `lint rejects non-finite reaction and condition numbers` |
| b | TT-010 follow-ups | — | ARCHITECTURE A1 rows for `daemons.js` / `game.js` (and the resolver / api additions) updated. The `noNerve` filter was removed from the A15 tests, which now assert exact nerve values (10, 9, 8, 7, 12, 7, 6). `turnStart` JSDoc now includes `nerve`. | existing A15 tests in `tests/unit/game.test.js` |

## Files changed
- `src/engine/api.js`:
  - `withCommand`, `syncLight`, `run.shown`
  - `checkItem` / `finite` guards in `moveEntity`, `setItem`, `adjustMoney`, `adjustNerve`
  - first-wins `endGame`
  - ended guard in `evalReaction` / `applyObject`
  - `describeRoom` records `run.shown`; `enterRoom` syncs after `onEnter`
  - `run.moved` removed
- `src/engine/state.js`: shared item invariants (`itemLocProblem`, `inContainmentCycle`) used by V9/V10; full validation of parsed commands, noun phrases and disambiguation pendings (imports `VERBS`, `PRONOUN_WORDS` from vocab.js, read-only).
- `src/engine/game.js`: resolver always strict (A7.9 boundary), `withCommand` around execution, `run.shown` at turn start, `syncLight` after afterAction.
- `src/engine/daemons.js`: `syncLight` after each step; D5's own O5 code removed.
- `src/engine/resolve.js`: `safeHook` removed (exceptions propagate); header comment.
- `src/engine/actions/perform.js`: per-object `withCommand`; step 6 = `syncLight`.
- `src/engine/actions/protect.js`: protection of contents.
- `src/engine/actions/common.js`: `reachGuard`; `actions/index.js` applies it.
- `src/engine/actions/objects.js`, `light.js`: duplicate reach checks removed; `keyFor` reachability.
- `tools/play.js`: storage containment and in-memory fallback, per-line containment, exported `createHost`, entry-point guard.
- `tools/lint-content.js`: finite / integer numeric checks.
- `tests/unit/review-r1.test.js` (new): 18 regression tests.
- `tests/unit/game.test.js`: `noNerve` removed (exact A15 nerve).
- `docs/ARCHITECTURE.md`:
  - A1 rows
  - clarifications in A5 (`args.cmd` and mutation invariants), A7.7 E1, A7.9, A8.1, A8.7, A9.2 O5, A11 V12, A10.1

## Decisions made (with why)
1. **The resolver stays "never throws" when called standalone.** Only the game passes `strict: true`. A1 keeps the resolver's contract for tools and tests, and the game is the single A7.9 boundary. A resolver call without `callHook` still treats hook conditions as false, as before.
2. **Contents inherit protection for every A8.7 verb**, including DROP/PUT for personal contents and BREAK/TEAR/CUT (critical contents of a carried container). A uniform rule is easier to reason about than a verb-by-verb exception list. In practice only THROW, GIVE, EAT and DRINK can lose a container.
3. **Reachability runs at the handler step (A7.5 step 4), not before `before` slots.** A8.1 says "handlers refuse", and content reactions can still handle commands on unreachable objects deliberately. SHOW, READ and observation verbs need only visibility (you can show or read through glass). BUY is excluded because its dobj is out of scope by design.
4. **Mutation checks run after the change, then throw.** The whole line rolls back anyway (A7.9). The same predicates as V9/V10 guarantee `load(save())` round-trips. Moving a worn item away still clears `worn` (TT-006 behaviour), so that is not an error.
5. **The O5 baseline is presentation-level (`run.shown`), not state.** It is reset at each turn start. Free commands cannot change light, and refreshes describe the room, so nothing is persisted (A3.4).
6. **The ended guard is in the Reaction runner only.** A content hook that calls `api.end` and then `api.say` still says its line, because a JS hook cannot be interrupted. `end` itself can no longer overwrite the ending.
7. **Pending validation tolerates unknown extra keys in commands and noun phrases** (TT-006 decision), so parser additions by the parallel TT-016 work do not break saves.

## How verified
- The new test file was run before any fix: all 18 tests failed for the reported reasons (for example `Dropped.`, `wrong_man` instead of `death_fall`, `cmd` null, `Time passes.` instead of a rollback). All 18 pass now.
- `npm run lint:content`: 0 errors, 67 warnings (real content).
- `npm run build`: OK.
- `npm test` tail:
```
1..526
# tests 1096
# suites 80
# pass 1094
# fail 2
# cancelled 0
# skipped 0
# todo 0
```
The 2 failures are both in `tests/content/town-canal.test.js` (`Town has 18 rooms, Canal 5; the other 19 STORY rooms are stubs (42 in all)` and `moving into a stub room keeps you where you are`). They come from parallel content work that turns stubs (e.g. `mill_gates`) into real rooms (`src/content/zones/mill.js` etc.). They are unrelated to this ticket and were left alone, per the acceptance criteria. Every engine and unit suite is green.

## Out-of-scope edits
None. `vocab.js` and `parser.js` are untouched (state.js only imports `VERBS` / `PRONOUN_WORDS`).

## Known gaps / follow-ups
- The content test `tests/content/town-canal.test.js` needs its stub expectations updated by the content agent (TT-016/017).
- Lint could also statically reject a reaction `move` into a non-container item, or a `setItem worn:true` on an item that cannot be carried at that point. The runtime now rolls these back; a static L04 check would catch them earlier.
