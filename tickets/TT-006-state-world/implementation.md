# TT-006 — Implementation notes

## Summary
State, RNG, world model and the content linter per ARCHITECTURE.md A1, A3, A4, A8.1–A8.3,
A11, A12.2, A13. All built test-first; `npm run check` is green (602 tests, lint 0 errors).

## Files changed
- `src/engine/rng.js` — mulberry32 over `state.rng`: `next`, `int`, `pick`.
- `src/engine/state.js` — `createState`, `clone`, `serialise`, `validateSave` (V1–V13), plus
  `timeString`, `varProblem(decl, value)`, `initialCaps(item)` and `STATE_KEYS`.
- `src/engine/world.js` — `inventory`, `locationOf`, `contentsOf`, `isCarried`, `roomOf`, `isOpen`,
  `npcsIn`, `moveItem`, `moveNpc`, `movePlayer`, `markVisited`, `isLit`, `visibleItems`, `scope`,
  `sceneryOf`, `isVisible`, `isReachable`, `exitsOf`, `evidenceCount`, `test(cond, state, content, callHook)`,
  and a re-export of `timeString`.
- `tools/lint-content.js` — the stub is replaced by rules L01–L23. It exports `lintContent(content, {strict, hasGlyph, verbWords})`
  and `formatFinding`. The CLI takes `[--strict] [--content path]`.
- `tests/fixtures/mini-world.js` — a 6-room bundle plus a stub (see the map in its header).
- `tests/fixtures/lint-bad.js` — 83 purpose-built bad worlds, with at least one per rule.
- `tests/unit/state.test.js`, `tests/unit/world.test.js`, `tests/unit/lint.test.js`.

## Decisions made (with why)
- **Signatures follow the contract and use one order, `(state, content, …)`.** A1 names
  `exitsOf` without arguments, and the ticket's `exitsOf(room, state)` cannot evaluate conditions
  without content. So it is `exitsOf(state, content, roomId = state.roomId, callHook)`, and the same
  goes for `isLit(state, content, roomId)` and `scope(state, content, callHook)`.
- **`callHook(hookId, {phase})` is injected.** `test()` cannot build a HookApi, because that is TT-008's
  `api.js`. A `{hook}` condition without `callHook` throws, and the A7.9 guard turns that into an
  engine error. The hook must return exactly `true` to pass.
- **`scope()` returns an object, `{items, npcs, scenery, exits, ids}`.** `ids` is the resolver's
  listing order (M5): items in content order, then NPCs, then scenery. `exits` holds the listed
  directions. NPCs and scenery appear only when the room is lit. In the dark, scope holds the carried
  items plus the contents of carried open containers.
- **Moves are low-level.** `movePlayer` sets only `prevRoomId` and `roomId`. `visited` is updated by
  the caller after `onEnter` via `markVisited` (A3, A8.3 step 7). `moveItem` refuses containment
  cycles and clears `worn` when an item leaves the player (S4). Evidence discovery is left to the API
  layer.
- **`exitsOf` entries** carry `{dir, to, door, condOk, doorOpen, passable, listed, hidden, oneWay, stub, msg}`,
  in `DIRECTIONS` order. A blocked exit that is not hidden is still listed (A4.6).
- **`timeString` lives in `state.js` and is re-exported by `world.js`.** `serialise` needs it for
  the save summary, and D4 forbids `state` → `world` imports.
- **`validateSave`:** it parses a fresh copy, checks V1–V12 in the documented order, and returns a
  canonical state with A3 key order and items, NPCs and vars in content order. It never throws and
  never mutates its input. Commands and pending entries are checked for types and existing ids;
  unknown extra keys inside them are tolerated so later tickets can add to them. Scenery ids
  (`room#n`) are valid `it`, `them` and `dobj` references.
- **The linter treats an empty bundle (no rooms) as a warning in incremental mode and an error in
  `--strict`.** That is how the real `{rooms:{}, items:{}, npcs:{}}` passes today.
- **Linter severity choices:**
  - Missing room art is L12 (a warning in incremental mode), following A4.6 "falls back". Missing
    ending art and `darkPicture` are L03 errors.
  - A stub used anywhere other than an exit target is an L14 error.
  - A reaction that moves a critical item to `null` is an L18 warning (A8.7).
  - The "last Text variant has `if`" warning is filed under L04 (A4.3).
  - Duplicate ending ids are L19; other duplicate ids are L02.
  - Flag names are checked against `ID_PATTERN` under L02.
- **L09 uses the strict A12.2 set (ASCII, `\n`, `£`) for every static string except art.** Art glyphs
  go through `font8x8.hasGlyph` (L11). The ticket's "glyph check via font" is applied to art only,
  because the contract is stricter for prose.
- **L21 reads verb words from `src/engine/vocab.js` `VERBS[].words` when that module loads**, plus
  `content.verbs`. If vocab.js fails to import, the CLI skips verb words. Only single-word verb
  words are compared.
- **`content.messages` is exempt from the `{placeholder}` check.** Engine messages use their own
  placeholders (T1, A16).

## How verified
- `node --test tests/unit/state.test.js`: 88 pass. This covers RNG determinism and the reference
  value, createState/S4, round-trip, serialise, and 74 rejection cases. Each rejection runs on a
  deep-frozen input, so any mutation would throw, and the input is compared before and after.
- `node --test tests/unit/world.test.js`: 16 pass. This covers containment, light through
  open/closed/transparent containers, lit and dark scope, reachability, exits, time, every Cond form,
  purity, and evidence count.
- `node --test tests/unit/lint.test.js`: 93 pass. This covers the real content, mini-world in
  incremental and strict mode, every bad fixture, a coverage check that every rule L01–L23 is
  exercised, the CLI exit codes, and garbage input.
- `npm run check` tail:
```
> the-tallyman@0.1.0 lint:content
lint:content src/content: 0 error(s), 1 warning(s)      # WARN L01 content: bundle is empty (no rooms yet)
# tests 602
# pass 602
# fail 0
build: wrote dist/tallyman.html (966 bytes)
```
- `node tools/lint-content.js --content tests/fixtures/mini-world.js` gives 0 errors and 1 warning
  (L14 for the stub). With `--strict` it exits 1 on that stub only.

## Known gaps / follow-ups
- The mini-world's one stub (`towpath`, west of the square) is deliberate, so TT-008 can test
  `MESSAGES.stub`. That means strict lint of the fixture fails on L14 by design.
- L08 counts an item as obtainable when any `give`, non-null `move` or `sells` produces it. It does
  not check whether that reaction is itself reachable.
- L22 cannot see flags that hooks set through `api.setFlag`. Those flags show up as warnings.
- L13 treats NPCs as present in their start room and every schedule target. Items held by NPCs are
  placed in the NPC's start room.
- TT-007 and TT-008 should use `scope().ids`, `isReachable`, `exitsOf`, `test` and `evidenceCount`
  rather than re-deriving them.
- Fixture hooks receive `(api, args)` and use only `api.turn`.
