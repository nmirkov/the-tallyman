# TT-008 implementation

## Summary
A playable engine on the mini-world. `createGame({content, seed, strict})` implements A2:
`start`, `input`, `load`, `undo`, `restart`, `save`, `snapshot`.

The input pipeline follows A7.1 / A7.3. It handles:
- the ended-game gate and empty lines;
- chains of up to 16 segments, pending answers, AGAIN and barriers;
- resolution, meta commands (free) and world turns;
- the STOP rules, and the chain notice placed before the terminal event;
- the output normaliser.

Each world turn runs:
1. Action phase A (A7.5): hazard, protection, `before` slots, handler, `after` slots. ALL and list commands run per object, with "Name: " prefixes.
2. The O5 lighting-change re-description.
3. Step B (`afterAction`).
4. The ordered daemon steps D1–D9, then `end`.

Other parts:
- UNDO is a one-level snapshot, committed at the first world command of a line. It works mid-chain and after death.
- Refresh bundles follow A9.3, including the intro, `(Undone.)`, a re-emitted prompt and the `end` event.
- Error containment (A7.9): the line rolls back, or the error is rethrown in strict mode.
- `api.js` has the HookApi, the Reaction runner (R1–R7), message lookup, Text rendering, and room entry and description (A8.4).
- The action registry covers every engine verb. `tools/play.js` is the terminal host.

## Files changed
- `src/engine/text.js` (new): `normalise`, `interpolate`, `formatMoney`, `listJoin`, `withArticle`, `capitalise`.
- `src/engine/api.js` (new):
  - the run context, `createApi`, `react`, `runReaction`, `callHook`
  - state operations: award, evidence, notes, reveal, move, setItem, setVar, end
  - messages, Text and names
  - `describeRoom`, `enterRoom`
  - the status, picture, end and room events
- `src/engine/game.js` (new): `createGame`, the A7 pipeline, barriers, UNDO, refresh, and `DAEMON_STEPS`.
- `src/engine/actions/` (new):
  - `index.js`: registry, `SYSTEM_ACTIONS`, `ACTION_MESSAGES`
  - `perform.js`: A7.5 action phase
  - `protect.js`: A8.7
  - `common.js`: helpers and the `ActionDef` typedef
  - families: `movement.js`, `observe.js`, `objects.js`, `light.js`, `meta.js` (includes the system barriers), `generic.js`
  - `placeholder.js`: the TT-009 slot
- `src/engine/resolve.js`: the strict-rethrow edit only. Each entry point takes a trailing `options = {strict}`; `guarded()` rethrows when it is set.
- `tools/play.js`: replaces the stub.
- `docs/ARCHITECTURE.md`: A1 table only (real exported signatures).
- Tests (new):
  - `tests/unit/game.test.js` (48)
  - `actions-movement` (17), `actions-observe` (15), `actions-objects` (22), `actions-light` (8), `actions-meta` (13)
  - `actions-api` (19), which covers text.js, the Reaction runner and the HookApi
- Fixtures (new, additive): `tests/fixtures/a15-world.js` (the A15 world), `tests/fixtures/harness.js` (test helpers).
- `tickets/TT-008-core-actions/ticket.md`: `status: verify`.

## Decisions made (with why)
1. **Daemon slot = `DAEMON_STEPS` in game.js.** It is an ordered list `{id, always, run(run)}`.
   - D1 clock, D7 ambience, D8 endings (`when` checks + `state.ended`), D9 status and the final `end` event are implemented, because a playable game and the A15 example need them.
   - D2 beats, D3 schedules, D4 story daemons, D5 light/fuel and D6 nerve/panic are no-ops.
   - `run.panicked` already stops a chain, so D6 only has to set it.
   - TT-010 can fill D2–D6 from `daemons.js` (or replace the list with `runDaemons(run)`) without changing the pipeline.
2. **TT-009 slot = `actions/placeholder.js`.** It registers talk, ask, tell, show, give, buy and accuse ("Nothing comes of it.", 1 turn, `before`/`after` slots still run), plus notes and hint (free). TT-009 swaps the import in `index.js`.
   - **Confirmation hook for TT-009's ACCUSE:** an `ActionDef` may define `confirm(cmd, api) → PendingConfirm|null`. The game asks for free before the turn; YES re-runs the command with `confirmed: true` and the normal cost. This is tested with a test-only action.
3. **Run context + `runOf(api)`.** One `run` per game holds state, the events buffer and the hook context. Content hooks only see the frozen HookApi. Actions use `runOf(api)` (a WeakMap) for engine services, which keeps the handler signature `run(cmd, api)` from A7.5. Content cannot reach `run` because D2 forbids importing api.js.
4. **`ActionDef.dir(cmd, api)`.** Exit hazards (A7.5 step 1) need the direction a command moves before the handler runs. Movement defines it: bare ENTER/EXIT = in/out, CLIMB X = u, BACK = the exit back.
5. **Event order on TAKE of evidence:** "Taken.", then `sfx pickup`, then the discovery output (noted / scoreUp). A8.5 lists discovery before `taken`. I read that as the order of state changes, and kept the Infocom convention (and O8) that an action's own text and sfx come first. `api.move` / `give` emit discovery output right away.
6. **Message ids.** Contract `MESSAGES` → `CORE_MESSAGES` in api.js (`found`, `onYouSee`, `inYouSee`) → each family's `messages` export, merged into `ACTION_MESSAGES`. Content can override every id. Params are filled first, then T1 placeholders (`{money}`, `{time}`, …). Name params are `{the}`, `{The}`, `{a}`, `{A}`, `{name}`.
7. **Styles.** Parse and resolution errors, the chain notice, `scoreUp`, `noted`, `undone`, `cantUndo`, `gameOver`, `slotNeeded`, `engineError`, setting-usage errors and `(Cancelled.)` use `system`. A content `cancelText` is normal prose. Hazard warnings use `alert`.
8. **Description details (A8.4).**
   - Rows 4–5 consider items whose `loc` is the room or whose `alsoIn` includes it.
   - Row 6 covers every visible supporter, open container or transparent container in the room, including nested ones (the jar on the table). The contract names only supporters and open containers; transparent ones are added because their contents are visible.
   - LOOK and refresh bundles are always full. BRIEF omits only row 2 on re-visits.
9. **Behaviour choices the contract leaves open:**
   - EXAMINE and READ refuse in the dark (`tooDark` / `readDark`).
   - SEARCH in the dark finds nothing.
   - TAKE of an item in a carried bag moves it to the hands; "already have" applies only when `loc === 'player'`.
   - WEAR needs the item carried.
   - DROP ALL skips worn items (A6.5).
   - Hidden exits whose `if` is false behave as "no exit" and never leak their `msg`.
   - The room for `after` slots is the room where the command started.
10. **A hook that returns `false` (R4) also skips that object's `then` / `end`.** Effects already applied stay applied.
11. **`setItem` / `setVar` / unknown ids throw.** A content bug becomes an engine error (rolled back), or a test failure in strict mode, instead of silently corrupting state.
12. **SEARCH AROUND** is rewritten to bare SEARCH in the game before resolution. `around` is a known word, but no entity matches it. SEARCH ROOM still fails, because `room` is not in the vocabulary.
13. **`load()` on an exception** returns `{ok:false, error, events: []}` with the state untouched, consistent with C16. `undo()` is literally `input('undo')`.
14. **play.js** defaults to seed 1, so transcripts are reproducible. `--saves <dir>` exists so tests don't write into the repo. Title lines get a blank line before them. Presentation events appear only with `--verbose-events`.

## How verified
- Test-first per family where practical.
  - The api / text / action modules were written alongside their tests.
  - `game.test.js` replays the whole A15 worked example event by event. Only `status.nerve` is excluded, because D6 is TT-010's.
  - The first runs caught three wrong expectations in the tests (non-proper "the Sergeant Pike", a PUT refusal order, unknown setting words) and one test-setup bug. No engine fixes were needed.
- Required K5 / ticket cases are covered:
  - `LOAD 1 THEN NORTH`
  - SAVE while pending, then loading that save (the prompt is re-emitted last)
  - loading an ended game (`end` last; only ENDED_VERBS accepted)
  - `N. UNDO. S`, `N. RESTART`, UNDO after a death, one-level UNDO
  - a throwing hook rolls back the line and the previous snapshot (non-strict) and rethrows in strict mode
  - a strict 1500-line fuzz: never throws, at most one terminal event and it is last, state round-trips through JSON
  - determinism
  - normaliser mapping and strict throw
  - every engine verb in vocab.js: the registry check plus a sample sentence per verb
  - play.js end-to-end: script, SAVE/LOAD/EXPORT, settings, QUIT
- D1 grep: there is no `Math.random`, `Date`, `console`, timers or Node import in `src/engine/`.
- `npm run check` tail:
```
# tests 782
# suites 33
# pass 782
# fail 0
# cancelled 0
# skipped 0
# todo 0
build: wrote dist/tallyman.html (966 bytes)
```

## Sample transcript
Command: `npm run play -- --content tests/fixtures/mini-world.js --script sample.txt`
```

Rain sweeps across Blackmere. It is 21:30, and Harrow is still missing.

Market Square
Rain hammers the cobbles of the market square. The town clock looms over a dry fountain.
Exits: north, east, south, west.

> e

Police Office
A cold office with a desk, a duty register and a drain grating in the floor.
Sergeant Pike sits behind the desk, counting forms.
You can see a torch, a satchel, a duty register and a helmet here.
Exits: south, west, down.

> take torch and satchel
Torch: Taken.
Satchel: Taken.

> open satchel. i
Opening the satchel reveals some handcuffs.
You are carrying:
  a warrant card
  a torch
  a satchel
    some handcuffs
You have £5.00.

> s

Back Alley
A narrow alley above the canal. Steps lead down to a cellar; a yard gate stands east.
You can see a brass key here.
Exits: north, east, down.

> take key
Taken.

> d

Darkness
It is pitch dark. You can't see a thing, but you could feel your way back the way you came.

> turn on torch
The torch is now on.
[Your score has gone up by 5 points.]

Cellar
Damp brick vaults. Somewhere, water drips.
You can see an iron key here.
Exits: up.

> take key
Taken.

> u. n. n

Back Alley
A narrow alley above the canal. Steps lead down to a cellar; a yard gate stands east.
Exits: north, east, down.

Market Square
Rain hammers the cobbles of the market square. The town clock looms over a dry fountain.
Exits: north, east, south, west.

The Black Lamb
A low-beamed pub thick with pipe smoke. A heavy oak door leads east.
Maggie is polishing glasses behind the bar.
A stub of tallow candle sits on the windowsill.
You can see the oak door here.
Exits: east, south.

> unlock door. open door. e
(with the brass key)
Unlocked.
Opened.

Back Room
A cramped store room. A threadbare rug covers most of the floor.
You can see the oak door and a crate here.
On the table you can see a glass jar.
In the glass jar you can see a silver button.
Exits: west.

> search
Wedged in a crack in the table is a 10p coin.

> take coin and jar
10p coin: Taken.
Glass jar: Taken.

> move rug. d
You drag the rug aside, uncovering a trapdoor.

Cellar
Damp brick vaults. Somewhere, water drips.
Exits: north, up.
Your light catches the glint of old bottles.

> save 1
Saved in slot 1.

> xyzzy. u
I don't know the word "xyzzy".
(Commands after XYZZY were ignored.)

> u. n

Back Alley
A narrow alley above the canal. Steps lead down to a cellar; a yard gate stands east.
Exits: north, east, down.

Market Square
Rain hammers the cobbles of the market square. The town clock looms over a dry fountain.
Exits: north, east, south, west.

> throw torch
You'd better hang on to that.

> again
You'd better hang on to that.

> undo


Market Square
Rain hammers the cobbles of the market square. The town clock looms over a dry fountain.
Exits: north, east, south, west.
(Undone.)

> e

Police Office
A cold office with a desk, a duty register and a drain grating in the floor.
Sergeant Pike sits behind the desk, counting forms.
You can see a duty register and a helmet here.
Exits: south, west, down.

> arrest pike
You snap the cuffs on.
[Your score has gone up by 10 points.]

*** Case Closed ***
Pike goes quietly.
You scored 15 of a possible 40 in 23 turns, giving you the rank of Probationer.
(UNDO, LOAD n, RESTART or IMPORT.)

> look
The game is over. Type UNDO, LOAD, RESTART or IMPORT.

> undo


Police Office
A cold office with a desk, a duty register and a drain grating in the floor.
Sergeant Pike sits behind the desk, counting forms.
You can see a duty register and a helmet here.
Exits: south, west, down.
(Undone.)
```
The same session with `--verbose-events` (excerpt):
```
> e
[room: office]
[picture: office]

Police Office
...
Exits: south, west, down.
[status: Police Office | 21:30 | score 0/40 | nerve 10 | turn 1]

> take torch
Taken.
[sfx: pickup]
[status: Police Office | 21:31 | score 0/40 | nerve 10 | turn 2]

> sound off
Sound off.
```

## Known gaps / follow-ups
- **TT-010:**
  - Fill D2–D6 in `DAEMON_STEPS`. Nerve never changes yet and fuel never burns.
  - Panic must set `run.panicked = true` and enter the safe room with `enterRoom(run, safeRoom)`.
  - D5 burn-out must emit O5 itself, because the A7.5 step-6 check only covers the action phase.
  - Once D6 exists, the A15 test can drop its nerve exclusion (`noNerve`).
- **TT-009:** replace `placeholder.js` in `actions/index.js` with `npc.js` / `case.js`, and use `ActionDef.confirm` for suspect ACCUSE. Protection for GIVE (personal / critical vs `accepts`) is already done in `protect.js`.
- **Content hint:** NPCs without `proper: true` are named "the Sergeant Pike". Real content should set `proper` on named characters.
- SEARCH ROOM / SEARCH HERE give an unknown-word error, because `room` / `here` are not in vocab.js (TT-005's file). Consider adding them as known words.
- `EXAMINE` of open containers lists their contents, but there is no "It is open." line for empty open containers.
- `play.js` does not wrap at 40 columns. The browser UI owns wrapping.

## Out-of-scope edits
None. `tests/fixtures/harness.js` and `tests/fixtures/a15-world.js` are additive fixtures, as allowed.
