# TT-102 — Implementation notes

## Summary
Both blocking findings and the non-blocking note of `reviews/code-review-R1-2.md` are fixed
at the root. The work was test-first. The six named tests in `tests/unit/review-r1-2.test.js`
were written first and failed for the reasons the review gave: `other_cache` was revealed, the
player was left in `pub` and the snapshots differed, and the parser answered
`I don't know the word "room"`. All of them pass now.

| # | Finding | Root cause | Fix | Regression test |
|---|---|---|---|---|
| 1 | Reveal lists and SEARCH go on after a nested death | The ended guard from TT-101 sat between effect keys. The `reveal` effect (`each`) and SEARCH's `revealAll` were separate loops with no guard. | One new `api.revealEach(run, ids)` checks `state.ended` before each element. The `reveal` effect and both SEARCH forms (bare SEARCH and SEARCH X / LOOK UNDER X) use it. `observe.js`'s own `revealAll` was removed. | `fatal found reaction stops remaining reveal-list elements`, `SEARCH stops revealing after death` |
| 2 | Strict failures skip the rollback | `contained()` and `load()` ran `if (strict) throw e` before they restored state and UNDO | Restore `lineStart` / `prevState` and the previous UNDO first, then rethrow. `contained()` covers `input`, `undo`, `restart` and `start`, and `load()` has its own. These are the only two strict rethrows that roll back. The resolver's `guarded()` rethrows into `contained()`, which now rolls back. | `strict input failure restores state and previous UNDO`, `strict LOAD refresh failure preserves state and UNDO`, plus `strict RESTART failure keeps the game and UNDO as they were` |
| n1 | No `SEARCH ROOM` in the engine | A8.6 lived in two places: `searchAround()` in game.js stripped a dobj of `around`, and the real content declared `search room\|here` itself | One engine vocab pattern, `search\|rummage around\|room`. It has two literals, so it outranks `search {dobj}`. The special case in game.js was removed. The content keeps only its own extra, `search here`. | `SEARCH ROOM and SEARCH AROUND reveal exactly what bare SEARCH does`, `a noun that starts with "room" still binds to the item` (SEARCH ROOM KEY) |

## Files changed
- `src/engine/api.js`: new `revealEach`; the `reveal` effect uses it.
- `src/engine/actions/observe.js`: SEARCH uses `revealEach` (local `revealAll` removed).
- `src/engine/game.js`: rollback before the strict rethrow in `contained()` and `load()`; `searchAround()` removed.
- `src/engine/vocab.js`: the `search` pattern `search|rummage around|room`.
- `tests/unit/review-r1-2.test.js` (new): 7 tests.

## Out-of-scope edits
- `src/content/verbs.js`: `search room|here` → `search here`, and the comment updated. This keeps one source for SEARCH ROOM, as the ticket asked. `tests/content` still passes, including `search room` in `town-canal.test.js`.
- `docs/ARCHITECTURE.md`: A6.1 `search` row (new pattern); A7.7 E1 (engine loops stop, TT-102); A7.9 (strict rolls back first, then rethrows).

## Decisions made (with why)
1. **The guard is in the loop, not in `reveal()`.** A JS hook that calls `api.end` and then `api.reveal` still reveals. This matches TT-101 decision 6: hooks cannot be interrupted, and only engine-owned sequences stop. Other engine loops were already guarded (afterAction, daemons/schedules, perform's object list, `applyObject`). Only `reveal` runs a nested reaction per list element.
2. **SEARCH still counts as having found something** when it stops after a fatal `found`. "You find nothing of interest." is not printed after a death.
3. **Literal heads `search|rummage`, not `<word>`.** With `<word>`, LOOK IN ROOM and LOOK UNDER AROUND would also become bare SEARCH. SEARCH ROOM KEY still binds to the item, because the literal pattern must consume every word.
4. **verbWord changes.** SEARCH AROUND now parses with `verbWord: 'search around'`, the same as `look around`. Nothing keys on it.

## How verified
- New test file before the fixes: 6 failed, 1 passed (the room-key test, which guards against a regression). After the fixes: 7/7.
- `npm run check` tail:
```
lint:content src/content (strict): 0 error(s), 27 warning(s)
...
1..562
# tests 1355
# suites 116
# pass 1355
# fail 0
# cancelled 0
# skipped 0
# todo 0
build: wrote dist/tallyman.html (966 bytes)
```

## Known gaps / follow-ups
- None blocking. Lint could warn on a `found` reaction that `end`s while it sits in a multi-element `reveal` list. The runtime now handles that case correctly.
