# The Tallyman — Engine Contract (ARCHITECTURE.md)

> **Status:** authoritative contract for every engine, UI and content ticket (TT-002).
> PLAN v1.2 §2.5, §3.3–3.8 are the source; where this document is more detailed it
> wins, where it contradicts PLAN it is a bug. The machine-readable half of the contract
> is `src/engine/types.js` (typedefs + frozen constants). Changes after approval go
> through an orchestrator ticket that edits **both** files together.

**How to read.** MUST / MUST NOT / SHOULD / MAY are normative. `Name` in code font is a
typedef or constant in `types.js`. "A7.4" points into this document, "PLAN §2.5" into
`docs/PLAN.md`. Numbered rules (e.g. **P3**, **L12**) are stable ids for tests and reviews.

## Contents
- A1 Module map & dependency rules
- A2 Game API
- A3 State
- A4 Content schema (ids, Text, Conditions, Reactions, rooms, items, NPCs, case data…)
- A5 Hooks API
- A6 Parser contract (vocabulary, syntax, resolution, pronouns, ALL, AGAIN, answers)
- A7 Input processing & turn pipeline (chains, barriers, pending precedence, turn costs, per-turn order, endings, UNDO)
- A8 World rules (scope, light, movement, descriptions, objects, protection, evidence, money, nerve, score)
- A9 Output Events
- A10 Host protocol
- A11 Save format & validation
- A12 Text normaliser & glyph policy
- A13 Content lint rules
- A14 Traceability: PLAN §2.5 / §3.4a → contract (with Tallyman content encodings)
- A15 Worked example (3-room world, 6 inputs, exact events)
- A16 Default messages
- A17 Contract decisions

---

## A1 Module map & dependency rules (PLAN §3.1, §3.2)

| Module | Owner | Responsibility | Key exports |
|---|---|---|---|
| `src/engine/types.js` | TT-002 | Typedefs + frozen constants. No behaviour. | constants (`EVENT_TYPES`, `DIRECTIONS`, `MESSAGES`, …) |
| `src/engine/rng.js` | TT-006 | mulberry32 over `state.rng` | `next(state)`, `int(state, n)`, `pick(state, arr)` |
| `src/engine/state.js` | TT-006 | Create / clone / serialise / validate state | `createState(content, seed)`, `clone(state)`, `serialise(state, content)` → `SaveData`, `validateSave(data, content)` → `{ok:true, state} \| {ok:false, error}` |
| `src/engine/world.js` | TT-006 | Pure queries, low-level state moves, condition evaluation | `inventory(state)`, `locationOf(state, id)`, `contentsOf(state, id)`, `isCarried(state, id)`, `roomOf(state, id)`, `isOpen(state, content, id)`, `npcsIn(state, roomId)`, `moveItem(state, id, loc)`, `moveNpc(state, id, loc)`, `movePlayer(state, roomId)` (no `visited`), `markVisited(state, roomId)`, `isLit(state, content, roomId?)`, `visibleItems(state, content)`, `sceneryOf(content, id)`, `scope(state, content, callHook?)` → `{items, npcs, scenery, exits, ids}`, `isVisible` / `isReachable(state, content, id)`, `exitsOf(state, content, roomId?, callHook?)` → `ExitInfo[]`, `evidenceCount(state, content)`, `test(cond, state, content, callHook?)`, `timeString(turn)`; `callHook(hookId, {phase})` |
| `src/engine/vocab.js` | TT-005 | Engine verb table (A6.1), prepositions, articles, directions | `VERBS`, `PREPOSITIONS`, `ARTICLES`, `buildVocab(content)` |
| `src/engine/parser.js` | TT-005 | Syntax only (A6.2) | `normaliseInput(line)`, `tokenise(line)`, `splitChain(tokens, vocab?)`, `parseCommand(tokens \| string, vocab)` |
| `src/engine/resolve.js` | TT-007 | Binding, disambiguation, pronouns, ALL, AGAIN, pending answers (A6.3–A6.7) | `resolve(parsed, state, content, vocab?, callHook?, options?)`, `answerPending(segment, state, content, vocab?, callHook?, options?)`, `repeatLast(state, content, vocab?, callHook?, options?)`, `recordExecuted(state, content, command, vocab?)`, `matchTopic(text, content)`, `parseErrorResult(err)`; `options = {strict}` rethrows (C24) — `game.js` always passes `strict: true`, so a throwing hook (e.g. an exit condition evaluated for scope) reaches A7.9 instead of becoming a resolution error |
| `src/engine/text.js` | TT-008 | Normaliser (A12), interpolation, English helpers | `normalise(s, {strict}?)`, `interpolate(text, values)`, `formatMoney(pence)`, `listJoin(parts, conj?)`, `withArticle(name, article?, mode?)` (`'definite'\|'indefinite'`), `capitalise(s)` |
| `src/engine/api.js` | TT-008 | `HookApi` factory + Reaction runner (A4.5, A5) and the engine services shared by actions and game (messages, Text, names, room entry / description, status / picture / end events) | `createRun({state, content, vocab?, strict?, messages?})` → `Run`, `createApi(run)` → `HookApi`, `runOf(api)` → `Run`, `react(reaction, api, args?)` → fired, `runReaction(run, reaction, args?)` → `{fired, cont}`, `callHook(run, id, args?)`, `testCond(run, cond)`, `message(run, id, params?)`, `renderText(run, text, self?)`, `say` / `sayMessage` / `emitText` / `emit`, `nameOf(run, id, mode?)`, `nameParams(run, id)`, `describeRoom(run, {brief}?)`, `enterRoom(run, roomId)`, `syncLight(run)` (O5), `withCommand(run, cmd, fn)` (A5 `args.cmd`), `roomEvent` / `pictureEvent` / `statusEvent` / `endEvent(run)`, `ambientFor(state, content)`, `rankFor(content, score)`, state ops (`moveEntity`, `setItem`, `reveal`, `award`, `addNote`, `addEvidence`, `setVar`, `setFlag`, `adjustMoney`, `adjustNerve`, `endGame`) |
| `src/engine/actions/*.js` | TT-008, TT-009 | One module per verb family (`movement`, `observe`, `objects`, `light`, `meta`, `generic`; TT-009: `npc`, `case`), `protect.js` (A8.7), `perform.js` (A7.5 action phase); `actions/index.js` is the registry | `ACTIONS` `{ [verbId]: ActionDef }` (A7.5), `SYSTEM_ACTIONS` `{ [verb]: (cmd, api, sys) }`, `ACTION_MESSAGES`, `performAction(run, cmd, registry)`, `protection(cmd, state, content)`; `ActionDef = {verb, run(cmd, api) → {ok}, dir?(cmd, api), confirm?(cmd, api) → PendingConfirm\|null}` |
| `src/engine/daemons.js` | TT-010 | Per-turn steps D1–D9 (A7.6), defined here | `DAEMON_STEPS` (`{id, always, run(run, cmd)}` in D1–D9 order; `always` = runs after an ending), `runDaemons(run, cmd?)`, `DAEMON_MESSAGES` (`lightOut`, `panic`), `nerveRules(content)` |
| `src/engine/game.js` | TT-008 (+TT-010 wiring) | `createGame`, input processing, chains, UNDO, refresh bundles; the transaction boundary of A7.9 | `createGame({content, seed?, strict?, actions?})` → `Game` (A2); re-exports `DAEMON_STEPS` from `daemons.js` |
| `src/content/**` | TT-016…TT-021 | Data + named hooks (A4) | `content/index.js` default-exports the `ContentBundle` |
| `src/ui/**` | TT-003, TT-011…TT-014 | Canvas, terminal, audio, boot, host (A10) | — |
| `tools/**` | various | Node tooling (play, lint, build, smoke) | — |

**Dependency rules.**
- **D1** `src/engine/**` MUST NOT import `src/ui/**`, `src/content/**`, `tools/**` or any Node built-in, and MUST NOT touch `document`, `window`, `localStorage`, timers, `Date`, `Math.random`, `performance`, `fetch` or `console`. Content arrives only as the `content` argument of `createGame`.
- **D2** `src/content/**` imports only `src/engine/types.js` and other `src/content/**` files. Hooks receive everything else through `HookApi`.
- **D3** `src/ui/**` uses the engine only through `game.js` (`createGame`), `types.js` and `text.js`. `src/ui/main.js` is the one UI file that imports `src/content/index.js`.
- **D4** Inside the engine imports follow this order with no cycles: `types` → `rng`, `text` → `vocab` → `parser` → `state` → `world` → `resolve` → `api` → `actions/*` → `daemons` → `game`. A module may import any module to its left.
- **D5** `tools/**` and `tests/**` may import anything (`tools/lint-content.js` imports `src/ui/font8x8.js#hasGlyph` for glyph checks).
- **D6** `types.js` stays behaviour-free: only `export {}`-style typedefs and deep-frozen constants.
- **D7** No runtime dependencies anywhere (PLAN §3.1).

---

## A2 Game API (PLAN §3.2, §3.4a)

```js
import { createGame } from './engine/game.js';
const game = createGame({ content, seed: 1, strict: false });   // GameOptions
```

| Method | Returns | Contract |
|---|---|---|
| `start()` | `OutputEvent[]` | Refresh bundle (A9.3) for the current state; includes `rules.intro` only for a fresh game (turn 0, not ended, no pending, only the start room visited). Host calls it once after creation. |
| `input(line)` | `OutputEvent[]` | Processes one input line (A7). Non-strings are coerced (`null`/`undefined` → `''`). Never throws. |
| `load(data)` | `LoadResult` | `data` is a `SaveData` object or its JSON string. Validates atomically (A11). Success: replaces state, clears the UNDO snapshot, returns `{ok:true, events: refreshBundle}`. Failure: state untouched, `{ok:false, error, events: []}`. Allowed in any state, including ended. |
| `undo()` | `OutputEvent[]` | Identical to typing `UNDO` (A7.8): refresh bundle + `(Undone.)`, or `[text cantUndo]`. |
| `restart()` | `OutputEvent[]` | New state from `createState(content, originalSeed)`, clears UNDO, returns the `start()` bundle (with intro). No confirmation — the `RESTART` command asks, the host method does not. |
| `save()` | `SaveData` | Pure; does not change state or emit events. |
| `snapshot()` | `State` | Deep clone for tests and tools. |

- **G1** Same content + same seed + same sequence of method calls ⇒ identical events and states (determinism). Host-side randomness (e.g. a seed from `Date.now()`) lives in the host.
- **G2** Every returned array/object is fresh; the caller may mutate it.
- **G3** `createGame` MAY throw on a structurally invalid content bundle (developer error, caught earlier by lint). With `strict: true` it deep-freezes `content` and rethrows internal errors (A7.9) — tests use strict mode.
- **G4** The engine holds exactly three pieces of mutable memory: `state`, the UNDO snapshot, and nothing else between calls (the line-start clone lives only during one `input()`).

---

## A3 State (PLAN §3.3, §3.4a "Schema completeness", §2.5)

`State` is plain JSON (no functions, `undefined`, Maps, Sets, class instances, NaN/Infinity).
`JSON.parse(JSON.stringify(state))` MUST deep-equal `state`. Keys of `items`, `npcs` and
`vars` are created in content declaration order and never re-ordered.

| Field | Type | Initial (`createState`) | Invariants | Written by |
|---|---|---|---|---|
| `v` | `1` | `STATE_VERSION` | equals `STATE_VERSION` | — |
| `seed` | uint32 | `seed >>> 0` | — | — |
| `rng` | uint32 | `seed >>> 0` | mulberry32 state | `rng.js` only |
| `turn` | int | `0` | `0 ≤ turn ≤ MIDNIGHT_TURN` | clock step D1 only |
| `roomId` | `RoomId` | `rules.start` | a real room, never a stub | movement, panic, `movePlayer` |
| `prevRoomId` | `RoomId\|null` | `null` | a real room or null | every player move (room left) |
| `visited` | `RoomId[]` | `[rules.start]` | unique; contains `roomId` | after `onEnter` of a newly entered room |
| `items` | `Record<ItemId, ItemState>` | one entry per content item (below) | keys = content item ids exactly; A3.1 | world moves, `setItem` |
| `npcs` | `Record<NpcId, NpcState>` | `{loc: npc.location, state: null}` | keys exact; `loc` is a room or null | schedules, `move`, `setNpc` |
| `flags` | `Record<string, true>` | `{}` | every value is `true`; clearing deletes the key | `setFlag` / `clearFlag` |
| `vars` | `Record<string, VarValue>` | each `VarDecl.init` | keys = `content.vars` exactly; values match their `VarDecl` | `setVar` |
| `money` | int (pence) | `rules.money ?? 0` | `≥ 0` | BUY, `money` effect |
| `score` | int | `0` | `0 ≤ score ≤ scoring.maxScore` | `award`, HINT |
| `awarded` | `AwardId[]` | `[]` | unique; ids exist | `award` |
| `hintTiers` | `Record<string, number>` | `{}` | keys are hint step ids; `0 ≤ v < tiers.length` | HINT |
| `nerve` | int | `rules.nerve.start` | `0 ≤ nerve ≤ 100` | `nerve` effect, D6 |
| `panicCooldown` | int | `0` | `0 ≤ v ≤ rules.nerve.panicCooldown` | D6 |
| `notes` | `NoteId[]` | `[]` | unique; ids exist | `addNote` |
| `evidence` | `EvidenceId[]` | `[]` | unique; ids exist (items **and** facts, discovery order) | discovery (A8.8) |
| `warned` | `HazardId[]` | `[]` | unique; ids exist | hazard warnings (A7.5) |
| `fired` | `string[]` | `[]` | unique; once-only beat ids | D2 |
| `ctx` | `Ctx` | `{it:null, them:[], npc:null, lastCommand:null, pending:null}` | A3.3 | resolver, game |
| `settings` | `Settings` | `{verbose:true, graphics:true}` | — | VERBOSE / BRIEF / GRAPHICS |
| `ended` | `EndingId\|null` | `null` | when non-null, `ctx.pending === null` | D8 / `end` effect |

### A3.1 Item ownership (single source of truth)
- **S1** `items[id].loc` is the ONLY record of where an item is: a room id, an item id (inside / on it), an NPC id (held by that NPC, never in scope), `'player'` (carried), or `null` (not in the world: unbought, consumed, not yet given).
- **S2** Inventory is derived: items whose `loc === 'player'`, in content order. "Carried" (`isCarried`) means the location chain reaches `'player'` (so items inside a carried open bag count).
- **S3** An item may be located in another item only if that item has `container`. No containment cycles; no item contains itself.
- **S4** `ItemState` capability fields exist **iff** the content item has the capability: `open`/`locked` iff `openable`; `lit` iff `light`; `fuel` iff `light.fuel` is defined; `hidden` iff `hidden`; `worn` iff `wearable`; `moved` iff `initial`. Initial values come from the content item (`open ?? false`, `locked ?? false`, `light.lit ?? false`, `fuel = light.fuel`, `hidden = true`, `worn = false`, `moved = false`). `worn: true` implies `loc === 'player'`.

### A3.2 Story state for the Tallyman (PLAN §2.5, §3.4a schema completeness)
The engine is story-agnostic; story-specific state lives in content-declared `vars`
(A4.13) that the engine type-checks on load. The Tallyman MUST declare exactly these
(more MAY be added by TT-015/016–018):

| Var | Type | Init | Meaning |
|---|---|---|---|
| `pikeState` | enum `PIKE_STATES` | `'desk'` | `desk` at the Police House; `fled` after a correct accusation there; `left` after his 23:30 departure; `counting` in the Counting Room, unrestrained; `restrained` cuffed (terminal). |
| `pikeArrivalTurn` | int, nullable | `null` | Turn on which a `fled`/`left` Pike reaches the Counting Room. |
| `attack` | int ≥ 0 | `0` | Attack counter (A7.6 step D4, A14). |
| `harrowFreed` | bool | `false` | Harrow's chains cut. |

PLAN §3.4a schema-completeness checklist → where it lives:

| PLAN item | Contract |
|---|---|
| `critical` | `Item.critical` (A4.7, A8.7) |
| discovery / hidden state per item | `Item.hidden` + `ItemState.hidden` (A8.6) |
| `money` | `state.money` (pence) + `Item.personal` wallet (A8.9) |
| attack counter | `vars.attack`, incremented in D4 (A7.6) |
| Pike arrival turn | `vars.pikeArrivalTurn` |
| hazard-warning flags | `state.warned` (A7.5) |
| panic cooldown | `state.panicCooldown` (A8.10) |
| Harrow state | `vars.harrowFreed` (+ `npcs.harrow.loc`) |
| evidence / facts | `state.evidence` + `content.evidence` (A8.8); notes in `state.notes` |

### A3.3 Parser context (`ctx`) and pending questions
- `it` / `them` / `npc`: pronoun antecedents (A6.4). Ids MUST exist.
- `lastCommand`: the last command AGAIN repeats (A6.6), a `Command` without `confirmed`.
- `pending`: `null`, `PendingDisambig` or `PendingConfirm`. It is part of the save, so a
  save made while a question is open restores the question (A9.3).

```json
{ "kind": "disambig", "text": "Which do you mean, the brass key or the iron key?",
  "command": { "verb": "take", "verbWord": "take", "dobj": { "words": ["key"] }, "raw": "take key" },
  "slot": "dobj", "candidates": ["brass_key", "iron_key"], "bound": {} }
{ "kind": "confirm", "text": "Are you certain? (Y/N)",
  "command": { "verb": "accuse", "verbWord": "accuse", "dobj": "maggie", "raw": "accuse maggie" } }
```

### A3.4 Not in state
The UNDO snapshot, the line-start clone, content and hooks, host presentation settings
(sound, music, theme, typewriter), the last emitted ambient (derived per turn, A9.2 O6),
and anything the UI renders. The UI keeps no derived game state of its own (PLAN §3.4a).

---

## A4 Content schema (PLAN §3.3)

### A4.1 Ids and namespaces
- **I1** Every id matches `ID_PATTERN` (`^[a-z][a-z0-9_]*$`, snake_case). `'player'` is reserved. Var names are camelCase (`^[a-z][A-Za-z0-9]*$`); flag names match `ID_PATTERN`.
- **I2** Rooms, stubs, items and NPCs share ONE namespace (locations may be any of them). Topic ids MUST NOT collide with it (an item/NPC id is itself a valid topic, A4.9).
- **I3** Every other table has its own namespace: zones, awards, notes, evidence, endings, hazards, beats, daemons, hint steps, hooks, art, vars, flags.
- **I4** Content is immutable at runtime. The engine reads it and never writes it; strict mode deep-freezes it.

### A4.2 The bundle
`src/content/index.js` default-exports a `ContentBundle`:

| Key | Type | Req. | Purpose |
|---|---|---|---|
| `meta` | `{id, title, version}` | yes | `id` goes into saves (A11). |
| `rules` | `Rules` | yes | `start` room, `intro` text, starting `money`, `nerve` tuning (defaults `RULE_DEFAULTS.nerve`), `darkPicture`. |
| `zones` | `Record<ZoneId, Zone>` | yes | Safe rooms, panic/cap, default ambient (A8.10). |
| `rooms` | `Record<RoomId, Room>` | yes | A4.6 |
| `items` | `Record<ItemId, Item>` | yes | A4.7 |
| `npcs` | `Record<NpcId, Npc>` | yes | A4.8 |
| `topics` | `Record<TopicId, Topic>` | no | ASK/TELL keyword table (A4.9) |
| `vars` | `Record<string, VarDecl>` | no | Typed story variables (A4.13) |
| `evidence` | `Record<EvidenceId, Evidence>` | no | A4.10 |
| `notes` | `Record<NoteId, Text>` | no | Notebook entries |
| `scoring` | `Scoring` | yes | Awards, `maxScore`, ranks, `hintCost` |
| `hints` | `HintStep[]` | no | Ordered critical path (A8.11) |
| `endings` | `Ending[]` | yes | Ordered: `when` checks run in this order (A7.7) |
| `beats` | `Beat[]` | no | Scripted beats, step D2 |
| `daemons` | `StoryDaemon[]` | no | Story daemons, step D4 |
| `afterAction` | `Reaction[]` | no | Step B, after every turn-costing action |
| `hazards` | `Record<HazardId, Hazard>` | no | Warned-once deaths |
| `case` | `CaseDef` | no | ACCUSE machinery |
| `verbs` | `VerbDef[]` | no | Synonyms for engine verbs or new content verbs (A6.1) |
| `messages` | `Record<string, string>` | no | Overrides of any message id (A16) |
| `help` | `Text` | no | HELP text |
| `hooks` | `Record<HookId, HookFn>` | no | From `content/hooks.js` (A5) |
| `art` | `Record<ArtId, Art>` | no | Pictures (A4.16) |
| `stubs` | `Record<RoomId, Stub>` | no | From `content/stubs.js`; incremental mode only |

### A4.3 Text
`Text` is one of:
1. a string: `'A cold waiting room.'`
2. variants: `[{ if: 'torch_lit', text: '…' }, { text: '…' }]` — the first whose `if` holds; the last SHOULD have no `if` (lint warns otherwise; no match renders `''` and emits nothing).
3. a text hook: `{ hook: 'pike_desc' }` — the hook returns a string (phase `'text'`).

- **T1** Placeholders `{money}` (formatted, A12.4), `{time}`, `{turns}`, `{score}`, `{maxScore}`, `{nerve}`, `{evidence}` (current count), `{rank}` are interpolated at render time. Any other `{…}` in content text is a lint error. Engine messages use their own placeholders (A16).
- **T2** One rendered Text = one `text` event. `\n` is a hard line break inside it; the engine never wraps (the UI wraps at 40 columns).
- **T3** Write ASCII + `£` with straight quotes (A12). Room `desc` ≤ 300 characters per variant.

### A4.4 Conditions (`Cond`)
Pure, side-effect-free tests used by exits, Text variants, Reactions, hints, endings, beats.

| Form | True when |
|---|---|
| `'name'` / `'!name'` | flag set / not set |
| `[c1, c2, …]` or `{all: […]}` | all hold (empty ⇒ true) |
| `{any: […]}` | at least one holds |
| `{not: c}` | `c` is false |
| `{flag: 'name'}` | flag set |
| `{var: 'name', eq\|ne\|gt\|gte\|lt\|lte: v}` | comparison (`gt…lte` false when the value is not a number) |
| `{var: 'name', oneOf: [v…]}` | value is one of |
| `{in: roomId \| [roomId…]}` | player is in (one of) the room(s) |
| `{zone: zoneId}` | player's room is in the zone |
| `{carried: itemId}` | `isCarried` (A3.1 S2) |
| `{present: id}` | item visible to the player (A8.1) or NPC in the player's room |
| `{at: [id, loc]}` | item or NPC location equals `loc` (`null` allowed) |
| `{visited: roomId}` | room in `state.visited` |
| `{turnGte: n \| {var}}` / `{turnLt: n \| {var}}` | `turn ≥ n` / `turn < n` (var form false while the var is null) |
| `{evidence: n}` | evidence count ≥ n (A8.8) |
| `{found: evId}` / `{noted: noteId}` / `{awarded: awardId}` | id is in the state list |
| `{lit: true\|false}` | the player's location is lit (A8.2) |
| `{moneyGte: pence}` / `{nerveGte: n}` | thresholds |
| `{open: itemId}` / `{locked: itemId}` / `{on: itemId}` | item state `open` / `locked` / `lit` |
| `{hook: hookId}` | the condition hook returns true (phase `'cond'`; MUST be pure) |

- **C1** A Cond object has exactly one key from `COND_KEYS` (plus one `VAR_OPS` key with `var`). Unknown keys are lint errors (catches typos).
- **C2** Conditions never consume RNG and never emit events. Randomness belongs in Reactions (`chance`, `pick`).

### A4.5 Reactions — the content "do something" language
A `Reaction` is used by `before`/`after` slots, topics, `accepts`, `shows`, `talk`,
`readable`, `onEnter`, beats, daemons, `afterAction`, schedule `do`, case outcomes, `found`.

| Form | Meaning |
|---|---|
| `'Text.'` | Say it. Always fires. |
| `{ …ReactionObject }` | Guarded effects (below). |
| `[r1, r2, …]` | **Cases**: run the FIRST element whose own `if` holds (elements without `if` always qualify); fires iff one ran. |

**ReactionObject evaluation (R-rules).**
- **R1** If `if` is present and false: run `else` if present (the reaction fires iff `else` fires), otherwise the reaction does not fire.
- **R2** If `chance` is present, roll `rng.next() < chance`; on failure the reaction does not fire (no `else`).
- **R3** Otherwise apply the keys present in this fixed order (`REACTION_ORDER`): `sfx` → `pause` → `say` (with `style`) → `pick` (say one of, RNG) → `setFlag` → `clearFlag` → `setVar` → `setItem` → `setNpc` → `reveal` → `move` → `give` → `money` → `nerve` → `note` → `evidence` → `award` → `music` → `movePlayer` → `hook` → `then` → `end`.
- **R4** The reaction fires. Exception: if its `hook` returns exactly `false`, it counts as not fired (effects already applied stay applied — put declining hooks in hook-only objects).
- **R5** `setVar` values: a literal `VarValue`, `{add: n}` (numeric increment), or `{turnPlus: n}` (current turn + n). `then` sees the updated state (used for counters, A14).
- **R6** Every effect has exactly the semantics of the `HookApi` method of the same meaning (A5). Reactions are sugar over the API; anything a Reaction can do, a hook can do.
- **R7** In a `before` slot a fired reaction **handles** the command (default action and `after` slots are skipped) unless it has `continue: true`.

```js
// SHOW CARD TO MAGGIE, once: she hands over the batteries and Harrow's key.
shows: { warrant_card: [
  { if: '!maggie_saw_card', say: '"Oh! You\'ll be wanting his room."',
    setFlag: 'maggie_saw_card', give: ['batteries', 'room_key'], sfx: 'pickup' },
  '"Yes, love, I\'ve seen it."',
] }
```

### A4.6 Rooms, exits, zones, scenery

| Room field | Type | Notes |
|---|---|---|
| `name` | string | Title line and status bar. |
| `zone` | `ZoneId` | Required. |
| `desc` | `Text` | ≤ 300 chars per variant. |
| `dark` | bool | Unlit unless a light source is present (A8.2). |
| `exits` | `{dir: RoomId \| Exit}` | Directions from `DIRECTIONS`. |
| `picture` | `ArtId` | 40×9 art; missing art falls back to no picture (incremental lint). |
| `ambient` | `AMBIENT_IDS` | Default: zone ambient, else `'none'`. |
| `scenery` | `Scenery[]` | Examine-only nouns; every noun in `desc` SHOULD have one. Derived id `${roomId}#${index}`. |
| `onEnter` | `Reaction` | Runs after the description on every entry (use `visited`/flags for first-time effects). |
| `nerve` | number | Extra nerve delta per turn ended here (A8.10). |
| `sink` | `Text` | THROWn non-critical items are lost here, with this text (water, quarry). |
| `before` / `after` | `{verbId: Reaction}` | Room-level command reactions (A7.5). |

| Exit field | Notes |
|---|---|
| `to` | Target room (or stub in incremental mode). |
| `if` | Passable only while true. |
| `msg` | Said when blocked by `if` (default `MESSAGES.cantGo`). |
| `door` | Item id; passable only while that item is open ("The {door} is closed."). Door items are `openable` and `fixed`, and list both rooms via `location` + `alsoIn`. |
| `hidden` | Omitted from the exits line while `if` is false (secret passages). Otherwise blocked exits ARE listed. |
| `oneWay` | Exempt from reciprocity; lint requires a hazard on that room + direction (PLAN §2.5 "no one-way exits except the warned quarry fall"). |

| Zone field | Notes |
|---|---|
| `name` | Display. |
| `safeRoom` | Panic destination; lit, non-dark, no hazards, in this zone. Required unless `panic: false`. |
| `panic` | Default `true`. `false` = panic never triggers (Beneath). |
| `nerveCap` | Max nerve in this zone (Beneath: 99). |
| `capText` | Said when nerve is clamped to the cap, only on the turn it first reaches the cap. |
| `panicText` | Overrides `rules.nerve.panicText`. |
| `ambient` | Default ambient of the zone's rooms. |

### A4.7 Items

| Field | Type | Notes |
|---|---|---|
| `name` | string | Display name without article: `'brass key'`. |
| `names` | string[] | Nouns, lower-case, may be multiword (`'warrant card'`). |
| `adjectives` | string[] | Distinguishing words (`'brass'`). |
| `article` | string | `'a'`, `'an'`, `'some'`, `'the'`, `''`; default `a`/`an` by first letter. |
| `desc` | `Text` | EXAMINE. |
| `location` | `Loc` | Start location; `null` = enters later (bought, given). |
| `initial` | `Text` | Own sentence in the room listing until first taken (`ItemState.moved`). |
| `fixed` | `true \| Text` | Cannot be taken; Text is the refusal. |
| `scenery` | `true` | Not listed in rooms (already in the prose); implies `fixed`. |
| `alsoIn` | `RoomId[]` | Fixed items (doors, gates) also present in these rooms. |
| `critical` | `true` | PLAN §2.5 resource policy; protected (A8.7). |
| `criticalMsg` | `Text` | Refusal for this item (default `MESSAGES.critical`). |
| `personal` | `true` | Warrant card, wallet: never leaves the player (A8.7). |
| `hidden` | `true` | Starts hidden; SEARCH reveals (A8.6). |
| `found` | `Reaction` | On reveal (default "You find {a item}."). |
| `openable`, `open`, `locked`, `keyId` | | Doors and lidded containers. |
| `container` | `{capacity?, supporter?, transparent?}` | `supporter` = things go ON it; `capacity` counts direct contents. Without `openable` a container is always open. |
| `light` | `{lit?, fuel?, needs?, needsMsg?, outText?}` | Light source; `fuel` = lit turns (omitted = endless); `needs` = Cond to switch on. |
| `wearable` | bool | WEAR / REMOVE. |
| `readable` | `Reaction` | READ (may add evidence / notes). |
| `edible` / `drinkable` | `Reaction` | EAT / DRINK allowed: reaction, then item → `null`. Forbidden on critical items (lint). |
| `before` / `after` | `{verbId: Reaction}` | Command reactions when this item is the direct or indirect object. |

```js
// The waiting-room bench is a scenery supporter; the 10p coin hides on it until SEARCHed.
bench: { name: 'bench', names: ['bench', 'seat'], adjectives: ['wooden'], scenery: true,
         container: { supporter: true }, desc: 'Scarred oak, carved with initials.', location: 'waiting_room' },
coin:  { name: '10p coin', names: ['coin', '10p', 'ten pence'], adjectives: ['ten'], desc: 'A ten pence piece, 1979.',
         location: 'bench', hidden: true, found: 'Wedged between the slats is a 10p coin.' },
torch: { name: 'torch', names: ['torch', 'flashlight'], adjectives: ['police'], critical: true, location: 'waiting_room',
         desc: [{ if: { on: 'torch' }, text: 'A police torch, burning steadily.' }, { text: 'A police torch. Dead batteries rattle inside.' }],
         light: { lit: false, fuel: 320, needs: 'fresh_batteries', needsMsg: 'Nothing. The batteries are dead.' },
         after: { turn_on: { award: 'torch_lit' } } },
```

### A4.8 NPCs

| Field | Type | Notes |
|---|---|---|
| `name`, `names`, `adjectives`, `proper` | | `proper: true` ⇒ no article ("Maggie"). |
| `desc` | `Text` | EXAMINE (variants e.g. "a button is missing" once `ev_button` found). |
| `here` | `Text` | Room-listing sentence; default `MESSAGES.npcHere` ("Maggie is here."). |
| `location` | `RoomId\|null` | Start. |
| `schedule` | `ScheduleEntry[]` | `{at, to, if?, leaveText?, arriveText?, do?}` evaluated at D3. |
| `topics` | `{topicId: Reaction}` | ASK/TELL (A4.9). |
| `default` | `Reaction` | Unmatched topic (default "{The} has nothing to say about that."). |
| `talk` | `Reaction` | TALK TO (default: same as `default`). |
| `accepts` | `{itemId: Reaction}` | GIVE: item moves to the NPC (`loc = npcId`), then the reaction runs. |
| `refuse` | `Reaction` | GIVE of anything else (default "{The} doesn't want it."); item stays with the player. |
| `shows` | `{itemId: Reaction}` | SHOW (default "{The} glances at it, unimpressed."). |
| `sells` | `{itemId: SellEntry}` | BUY (A8.9). |
| `before` / `after` | `{verbId: Reaction}` | E.g. `before.arrest` on Pike (A14). |

```js
maggie: { name: 'Maggie', names: ['maggie', 'landlady', 'woman'], proper: true, location: 'black_lamb',
  desc: 'Fifty, sharp-eyed, polishing a glass that is already clean.',
  here: 'Maggie is polishing glasses behind the bar.',
  topics: {
    harrow: { say: '"Mr Harrow? Went out at eight. Never touched his tea."', setFlag: 'asked_harrow' },
    silas:  { say: '"Silas? He\'ll talk for a drop of whisky, that one."', setFlag: 'heard_of_silas' },
    pike:   '"Arthur? Salt of the earth. Counts his change twice, mind."',
  },
  default: '"Can\'t help you there, love."',
  sells: { whisky: { price: 200, if: 'heard_of_silas', refuse: '"What would you want with that?"' } },
},
```

### A4.9 Topics (ASK / TELL)
`ASK X ABOUT <free text>` / `TELL X ABOUT <free text>`. Topic matching, first hit wins:
1. `content.topics[id].names` — a keyword (may be multiword) that occurs as a whole-word sequence in the topic text;
2. any item / NPC whose names occur in the topic text (global, scope-independent) → that id;
3. none → `topic: null`.
Then the NPC's `topics[topicId]` reaction runs; missing entry or `null` → `npc.default`. Topic text never produces unknown-word errors.

### A4.10 Evidence and notes
```js
evidence: {
  ev_ledger:   { label: 'Ledger page (1912)',       item: 'ledger_page', award: 'ledger_page' },
  ev_register: { label: 'Burial register: Mary Pike', note: 'mary_pike',  award: 'register' },
  ev_button:   { label: 'Silver tunic button',      item: 'button',       award: 'button' },
  ev_file:     { label: 'Patient file "A. PIKE"',   item: 'patient_file', award: 'file' },
},
notes: { mary_pike: 'Burial register: "Mary Pike, 14, d. 15 Nov 1912."' },
```
`item` present ⇒ item evidence (counts while carried); absent ⇒ fact (counts once found). Discovery rules in A8.8.

### A4.11 Scoring, ranks, hints
```js
scoring: { maxScore: 100, hintCost: 2,
  awards: { torch_lit: { points: 5, label: 'Lit the torch' }, /* … */ },
  ranks: [ { min: 0, title: 'Probationer' }, /* … */ { min: 100, title: 'Chief Inspector' } ] },
hints: [ { id: 'light', done: { awarded: 'torch_lit' },
           tiers: ['It is very dark out there.', 'Maggie might help a police officer.', 'SHOW CARD TO MAGGIE.'] } ],
```

### A4.12 Beats, story daemons, afterAction
- **Beat** `{id, at?, every?, when?, once?, run}` — step D2. Eligible when (`at` absent or `turn === at`) and (`every` absent or `turn % every === 0`) and (`when` absent or true) and (not once-fired). At least one of `at` / `every` / `when` is required. `once` defaults to `true` for `when`-only beats, `false` otherwise; once-beats append their id to `state.fired` when they fire.
- **StoryDaemon** `{id, run}` — step D4, every turn, in array order. The place for counters (attack counter, Pike's arrival).
- **afterAction** `Reaction[]` — step B: each element is run (all of them, in order) after every turn-costing command's action phase, unless the game has ended.

### A4.13 Hazards, case, vars
- **Hazard** `{room, exit? | verbs?+objects?, unless?, warn, ending}` — PLAN "warned once, then fatal" (A7.5 step 1).
- **CaseDef** `{culprit, threshold, suspects, confirm, correct, weak, wrong, cancelText?, other?}` — ACCUSE (A14 rules 2–5).
- **VarDecl** `{type: 'int'|'bool'|'str'|'enum', init, values?, nullable?, min?, max?}` — `setVar` and `validateSave` enforce type, range, nullability and enum membership.

### A4.14 Endings
`{id, kind, title, text, when?, art?, music?}` in an ordered array. Endings with `when` are
checked at D8 in array order; endings without `when` are reached only via the `end` effect /
`api.end` (deaths, wrong man). `kind ∈ ENDING_KINDS` drives the UI treatment. Content MUST
end with a catch-all `{when: {turnGte: MIDNIGHT_TURN}}` midnight ending (lint **L19**).

### A4.15 Verbs, messages, help
- `verbs: [{ id: 'take', words: ['nick'] }]` adds synonyms to an engine verb; a new id adds a
  content verb (`class` default `'world'`, `patterns` default `['<word>', '<word> {dobj}']`).
  A content verb has no engine handler: it runs `before` reactions (A7.5) and, if none
  handles it, says its `default` text (default `MESSAGES.cantDo`). Cost 1.
- `messages: { personal: '…' }` overrides any message id (A16 and per-action defaults).

### A4.16 Art and stubs
- **Art** per PLAN §3.5: `{id, w: 40, h: 9|25, chars: string[h], colors: string[h], bg?, fx?}`; each row exactly `w` characters; colour keys from `PALETTE_KEYS`; `bg` same shape or a single key; `fx ⊆ ART_FX`; glyphs only those `font8x8.hasGlyph` accepts.
- **Stubs** (`content/stubs.js`, incremental builds only): `{ roomId: {name, zone} }`. Exits may point to stubs; moving there says `MESSAGES.stub` and the player stays (1 turn). `--strict` lint allows zero stubs.

---

## A5 Hooks API (PLAN §3.3 "hooks are deterministic functions of (state, api)")

Hooks are named functions in `content.hooks` (`content/hooks.js`), referenced by id from
Text (`{hook}`), Cond (`{hook}`) and Reactions (`hook:`). Signature
`(api: HookApi, args: HookArgs) => boolean | string | void`.

**Rules.**
- **H1** Deterministic: no `Math.random`, `Date`, timers, I/O, or module-level mutable variables. Randomness only via `api.rng`.
- **H2** Change the game only through `api` methods. `api.state` and `api.content` are read-only views; writing to them is a contract violation (strict mode freezes content; tests may freeze state).
- **H3** Never store functions or non-JSON values anywhere in state.
- **H4** A thrown error aborts the whole input line and rolls state back (A7.9).
- **H5** Return value by phase: `before` → `false` = "not handled" (R4); `cond` → boolean; `text` → string; all others ignored.
- **H6** Prefer data (Reactions, Conditions) over hooks; a hook is the escape hatch for logic the data language cannot express.

| `args.phase` | Called from | `args.cmd` | `args.self` |
|---|---|---|---|
| `before`, `after` | room / item / NPC command slots | yes | slot owner id |
| `cond`, `text` | Cond / Text | when inside a command | owner id or null |
| `onEnter`, `found`, `readable`, `topic`, `accepts`, `shows`, `talk`, `sells`, `edible`, `drinkable` | those slots | yes | owner id |
| `afterAction`, `beat`, `daemon`, `schedule`, `case` | pipeline | the current command or null | null / NPC id |

"Inside a command" means everything from the handler step on: hooks triggered by engine
services a handler uses (room entry's `onEnter`, EXAMINE / READ text, `found`, …) see the
executing command in `args.cmd`; for ALL / lists it is the per-object command (TT-101).

**`HookApi` surface.**

| Member | Effect / result | Events emitted |
|---|---|---|
| `state`, `content`, `turn`, `room` | read-only views | — |
| `test(cond)` | evaluates a Cond | — |
| `flag(name)`, `var(name)` | read | — |
| `carried(id)`, `locOf(id)`, `present(id)`, `lit()`, `evidenceCount()` | world queries | — |
| `rng.next()`, `rng.int(n)`, `rng.pick(arr)` | state RNG (advances `state.rng`) | — |
| `say(text, style?)` | renders a Text | `text` |
| `sfx(id)`, `music(id)`, `pause(ms)` | presentation cues | `sfx` / `music` / `pause` |
| `move(id, loc)` | item or NPC location; an item reaching the player triggers evidence discovery (A8.8) | discovery output |
| `movePlayer(roomId)` | full room entry (A8.3 step 7): `room`, `picture`, description, `onEnter` | yes |
| `setItem(id, patch)` | patch `open`/`locked`/`lit`/`fuel`/`hidden`/`worn`/`moved` (only fields the item has) | lighting change may re-describe (A9.2 O5) |

State operations (`move`, `setItem`, `money`, `nerve`, `setVar`, …) enforce the A3 invariants
when they mutate — the same predicates `validateSave` uses (V9, V10): an item may only go
into a `container`, `worn: true` needs `loc === 'player'`, numeric deltas must be finite.
A violation is an internal error, so the line rolls back (A7.9) and no state that its own
save would reject is ever committed (TT-101).
| `setNpc(id, {state})` | NPC state string | — |
| `reveal(id)` | `hidden = false` + `found` reaction | `found` text |
| `setFlag(name, value = true)`, `clearFlag(name)` | `false` ≡ clear | — |
| `setVar(name, value)` | type-checked against `VarDecl`; invalid ⇒ internal error | — |
| `award(id)` | once-only: adds points (capped at `maxScore`), appends to `awarded` | `text system scoreUp` |
| `addNote(id)` | once-only | `text system noted` |
| `addEvidence(id)` | once-only discovery (A8.8) | note/award output |
| `money(delta)` | clamps at 0 | — |
| `nerve(delta)` | clamps 0…100 immediately; caps/panic only at D6 | — |
| `react(reaction)` | runs a Reaction, returns fired | its output |
| `end(endingId)` | sets `state.ended`; the pipeline skips to D8 (A7.6) | `end` at end of turn |

---

## A6 Parser contract (PLAN §1 parser pillar, §3.4a AGAIN/ALL; Codex R1 note 3)

Three layers: **syntax** (TT-005, no world knowledge) → **resolution** (TT-007, binds
words to ids using scope) → **execution** (A7). Clarifications are always free.

### A6.1 Vocabulary
`buildVocab(content)` merges `vocab.js` with content: every word of every item / NPC /
scenery `names` and `adjectives`, every `topics[*].names` word, and `content.verbs`.
A word is **known** iff it is in this merged vocabulary or is a number. Engine verbs
(canonical ids — content, actions and tests MUST use these ids):

| Id | Class | Core words (synonyms) | Patterns (A6.2) | `prefer` / `multi` |
|---|---|---|---|---|
| `go` | world | go, walk, run, head; bare direction words | `{dir}`, `go {dir}` | |
| `back` | world | back, go back, return | `back` | |
| `enter` | world | enter, go in, go into, get in, get into | `enter`, `enter {dobj}` | bare = `go in` |
| `exit` | world | exit, leave, get out, go out | `exit`, `exit {dobj}` | bare = `go out` |
| `climb` | world | climb, scale, clamber | `climb {dobj}`, `climb up\|down`, `climb up\|down {dobj}` | up/down = `go u/d` |
| `look` | world | look, l | `look`, `look around` | |
| `examine` | world | examine, x, look at, inspect, check, describe, study | `examine {dobj}` | |
| `search` | world | search, rummage, look in, look under, look behind | `search`, `search {dobj}`, `look in\|under\|behind {dobj}` | |
| `read` | world | read | `read {dobj}` | |
| `listen` | world | listen, hear | `listen`, `listen to {dobj}` | |
| `smell` | world | smell, sniff | `smell`, `smell {dobj}` | |
| `take` | world | take, get, pick up, grab, carry | `take {dobj}`, `take {dobj} from\|off\|out of {iobj}`, `pick {dobj} up` | notCarried, multi |
| `drop` | world | drop, put down, discard | `drop {dobj}`, `put {dobj} down` | carried, multi |
| `put` | world | put, place, insert, stick | `put {dobj} in\|into\|inside {iobj}`, `put {dobj} on\|onto {iobj}` | carried, multi |
| `open` / `close` | world | open / close, shut | `open {dobj}` / `close {dobj}` | closed / open |
| `unlock` / `lock` | world | unlock / lock | `unlock {dobj}`, `unlock {dobj} with {iobj}` (same for lock) | |
| `push` / `pull` / `move` | world | push, press, shove / pull, tug, yank / move, slide, shift | `push {dobj}` … | |
| `turn_on` | world | turn on, switch on, light, ignite | `turn on {dobj}`, `turn {dobj} on`, `light {dobj}` | unlit |
| `turn_off` | world | turn off, switch off, extinguish | `turn off {dobj}`, `turn {dobj} off` | lit |
| `wear` / `remove` | world | wear, don, put on / remove, take off, doff | `wear {dobj}`, `put on {dobj}`, `put {dobj} on` / `remove {dobj}`, `take off {dobj}`, `take {dobj} off` | carried / worn |
| `eat` / `drink` | world | eat, devour / drink, sip, swig, quaff | `eat {dobj}` / `drink {dobj}` | carried |
| `throw` | world | throw, toss, hurl, chuck | `throw {dobj}`, `throw {dobj} at\|in\|into\|over {iobj}` | carried |
| `break` | world | break, smash, destroy, burn | `break {dobj}`, `break {dobj} with {iobj}` | |
| `tear` | world | tear, rip | `tear {dobj}`, `tear {dobj} from\|out of {iobj}` | |
| `cut` | world | cut, snip, sever | `cut {dobj}`, `cut {dobj} with {iobj}` | |
| `oil` | world | oil, lubricate, grease | `oil {dobj}`, `oil {dobj} with {iobj}` | |
| `use` | world | use | `use {dobj}`, `use {dobj} on\|with {iobj}` | |
| `touch` | world | touch, rub, feel | `touch {dobj}` | |
| `attack` | world | attack, hit, kick, punch, fight, kill, strike | `attack {dobj}`, `attack {dobj} with {iobj}` | |
| `talk` | world | talk to, speak to, chat to, chat with | `talk to {dobj}` | |
| `ask` / `tell` | world | ask, question / tell, inform | `ask {dobj} about {topic}` / `tell {dobj} about {topic}` | |
| `show` / `give` | world | show, present / give, hand, offer | `show {dobj} to {iobj}`, `show {iobj} {dobj}` (same for give) | carried |
| `buy` | world | buy, purchase, order | `buy {dobj}`, `buy {dobj} from {iobj}` | |
| `call` | world | call, phone, dial, ring | `call`, `call {dobj}` | |
| `accuse` | world | accuse, charge | `accuse {dobj}` | `notHere: "Accuse who? They're not here."` |
| `arrest` | world | arrest, cuff, handcuff, restrain | `arrest {dobj}`, `arrest {dobj} with {iobj}` | |
| `free` | world | free, release, unchain, rescue | `free {dobj}` | |
| `swim` / `jump` | world | swim, dive, wade / jump, leap | `swim`, `swim in {dobj}` / `jump`, `jump off\|into\|over {dobj}` | |
| `wait` | world | wait, z | `wait` | |
| `yes` / `no` | meta | yes, y / no | `yes` / `no` | outside a confirm: "That was a rhetorical question." (`n` is north; see A7.3) |
| `inventory` | meta | inventory, i, inv | `inventory` | |
| `score`, `time`, `help` | meta | score / time / help | bare | |
| `notes` | meta | notes, notebook, clues, case | `notes` | |
| `hint` | meta | hint, hints | `hint` | costs points, not turns |
| `verbose` / `brief` | meta | verbose / brief | bare | |
| `graphics`, `sound`, `music`, `typewriter` | meta | same words | `{word}`, `{word} {arg}` (`on`/`off`; bare = toggle) | |
| `theme` | meta | theme | `theme`, `theme {arg}` (bare = `next`) | |
| `again` | special | again, g | `again` | A6.6 |
| `save`, `load`, `export`, `import`, `undo`, `restart`, `quit` | system | save / load, restore / export / import / undo / restart / quit, q | `save`, `save {arg}` (same for load); others bare | barriers (A7.2) |

Directions: `n north`, `ne northeast`, `e east`, `se southeast`, `s south`, `sw southwest`,
`w west`, `nw northwest`, `u up`, `d down`, `in inside`, `out outside`.
Prepositions (canonical ← words): `in` ← in, into, inside; `on` ← on, onto, upon;
`with` ← with, using; `from` ← from, off, out of; `to`; `at`; `about`; `under` ← under,
beneath, below; `behind`. Fillers dropped everywhere outside topics: the, a, an, some,
my, please. Pronouns: it, them, him, her. Quantifiers: all, everything; except, but.

**Pattern mini-language** (engine verbs and content verbs): space-separated tokens;
literal words; `a|b` alternatives; `[x]` optional literal; `{dobj}` / `{iobj}` noun-phrase
slots; `{topic}` = the rest of the command as free text; `{dir}` one direction word;
`{arg}` one token. Patterns are tried in declared order; the first full match wins.
Multiword verb words are matched longest first (`pick up` before `pick`). When several verbs share a word (`put` → `put`, `drop`, `wear`), the patterns of all of them are tried, most literal tokens first, then in table order. A `{dobj}`/`{iobj}` slot never contains a preposition word.

### A6.2 Syntax layer (TT-005)
- **P1** `tokenise(line)`: input normalisation (A12.3); `'s` is dropped (`pike's` → `pike`), other apostrophes removed, hyphens become spaces; `.` `;` `!` `?` become the token `'.'`; `,` becomes `','`; any other punctuation is removed; digits are kept.
- **P2** `splitChain(tokens)`: separators are `'.'`, `then`, `and then`, and `','` / `and` **when the next token starts a command** (a verb word or a direction word). Otherwise `,` / `and` stay inside the segment (noun lists). Empty segments are dropped. Exception (TT-016): if the tokens after `,` / `and` begin a known multiword content name (e.g. "oil can"), they stay in the noun list even though the first word is a verb word.
- **P3** `parseCommand(tokens, vocab)` returns a `ParsedCommand` or a `ParseError`. Error priority: `empty` → `unknown-word` (first unknown word outside a `{topic}`) → `no-verb` (first word is not a verb or direction) → `missing-noun` (verb has a pattern with the slot but nothing followed) → `no-pattern`.
- **P4** Noun phrases: fillers dropped; `{words}` keep every remaining word in order (adjectives and nouns are NOT classified at this layer); `it/them/him/her` → `{pronoun}`; `all`/`everything` → `{all:true}` with optional `except:[…]` after `except`/`but`; `x and y` / `x, y` → `{list:[…]}`.
- **P5** Never throws, for any string.

| Input | `parseCommand` result |
|---|---|
| `n` | `{verb:'go', verbWord:'n', dir:'n', raw:'n'}` |
| `go north` | `{verb:'go', verbWord:'go', dir:'n', raw:'go north'}` |
| `take the brass key` | `{verb:'take', verbWord:'take', dobj:{words:['brass','key']}, raw:'take the brass key'}` |
| `pick it up` | `{verb:'take', verbWord:'pick up', dobj:{pronoun:'it'}, raw:'pick it up'}` |
| `take all except torch and key` | `{verb:'take', …, dobj:{all:true, except:[{words:['torch']},{words:['key']}]}}` |
| `take key and torch` | `{verb:'take', …, dobj:{list:[{words:['key']},{words:['torch']}]}}` |
| `put coin in box` | `{verb:'put', verbWord:'put', dobj:{words:['coin']}, prep:'in', iobj:{words:['box']}, raw:…}` |
| `ask maggie about the dead girl` | `{verb:'ask', verbWord:'ask', dobj:{words:['maggie']}, prep:'about', topic:'the dead girl', raw:…}` |
| `turn torch on` | `{verb:'turn_on', verbWord:'turn on', dobj:{words:['torch']}, raw:'turn torch on'}` |
| `save 2` / `sound off` | `{verb:'save', verbWord:'save', arg:'2', raw:'save 2'}` / `{verb:'sound', …, arg:'off'}` |
| `xyzzy` | `{error:'unknown-word', word:'xyzzy', raw:'xyzzy'}` |
| `key` | `{error:'no-verb', word:'key', raw:'key'}` |
| `take` | `{error:'missing-noun', verb:'take', verbWord:'take', raw:'take'}` |
| `take key from` | `{error:'no-pattern', verb:'take', verbWord:'take', raw:'take key from'}` |

### A6.3 Resolution (TT-007)
`resolve(parsed, state, content, vocab)` → `{ok:true, command: Command}` |
`{ok:false, message, params}` | `{pending: PendingDisambig}`. All three are free.

- **M1** Entity words: `nounWords(E)` = every word of every entry of `names`; `adjWords(E)` = `adjectives` plus the words of `name` not in `nounWords`.
- **M2** A phrase matches E iff every phrase word ∈ `nounWords ∪ adjWords` and at least one ∈ `nounWords`. If nothing in scope matches, retry allowing adjective-only phrases.
- **M3** Scope for binding = visible (A8.1), plus: for `buy`, items that NPCs in the room sell; for `take … from Y`, `dobj` candidates are limited to Y's contents. `iobj` is resolved before `dobj`.
- **M4** Narrowing, each step applied only if it leaves ≥ 1 candidate: (a) the phrase contains all words of one of the candidate's names; (b) items and NPCs over scenery; (c) the verb's `prefer`. No implicit recency (A17 C14).
- **M5** One candidate → bound. Several → `PendingDisambig` with candidates in listing order (items in content order, then NPCs, then scenery) and text `MESSAGES.disambig`, `{list}` = "the brass key or the iron key" ("the a, the b or the c"; proper NPCs without "the").
- **M6** No match: `MESSAGES.tooDark` if the room is unlit, else the verb's `notHere` or `MESSAGES.notHere`.
- **M7** Topics (`ask`/`tell`) are matched per A4.9 and never fail.

### A6.4 Pronouns
- After a command executes: a single item/scenery `dobj` sets `it`; an NPC `dobj` or `iobj` sets `npc`; a multi-object `dobj` sets `them` (and leaves `it`).
- `it` → `ctx.it`; `them` → `ctx.them` (visible subset), falling back to `it` when empty; `him`/`her` → `ctx.npc`. Null antecedent → `MESSAGES.pronounUnset` with `{pronoun}`; antecedent not visible → `notHere`.

### A6.5 ALL, EXCEPT, lists (PLAN §3.4a)
- Only verbs with `multi` (`take`, `drop`, `put` as dobj) accept ALL or lists; others → `allNotAllowed` (ALL) / `oneAtATime` (lists), free.
- ALL expands to: `take` — portable (not fixed/scenery), non-hidden items whose `loc` is the current room (or Y for `take all from Y`); `drop` — items with `loc === 'player'` that are not personal and not worn; `put all in/on Y` — the same minus Y. EXCEPT phrases are resolved in the same scope and removed.
- Empty expansion → `MESSAGES.allNothing` (free).
- Execution: one command with `dobj` = array, `all: true`. Each object runs A7.5 steps 1–5 separately; the first `text` event of each object is prefixed `"<Name>: "` (capitalised display name). **The whole command costs 1 turn.**
- List elements are resolved in order; an ambiguous element produces a prompt with `index` set; the answer substitutes that element and resolution continues.

### A6.6 AGAIN
- `again` / `g` is a command of its own (may appear inside a chain). It re-executes `ctx.lastCommand` (already resolved — no re-binding); if any id in it is no longer visible → `notHere` (free). It costs what the repeated command costs.
- `lastCommand` is set after every executed command whose verb is not a system verb, `again`, `yes` or `no` — including failed in-world attempts and meta commands; stored without `confirmed`. Parse/resolution errors and prompts do not set it. After a chain it holds the chain's last executed command; after a disambiguation it holds the completed command.
- `lastCommand` null → `againNothing` (free).

### A6.7 Answers to pending questions
- **Confirm:** the segment is exactly `yes`/`y` → YES; exactly `no`/`n` → NO. (While a confirm is pending `n` means NO, not north.)
- **Disambig:** after dropping fillers and `one`: an ordinal (`first`/`1`, `second`/`2`, …, `last`) picks by position; otherwise words that are all in exactly one candidate's `nounWords ∪ adjWords` pick it; if they fit ≥ 2 candidates the prompt is re-asked with that subset (free); otherwise the segment is not an answer.

---

## A7 Input processing & turn pipeline (PLAN §3.4a, §2.5)

### A7.1 `input(line)` algorithm
1. `s` = input-normalise `line` (A12.3), truncated to `LIMITS.inputLength` (200).
2. **Ended game** (`state.ended !== null`): parse the first segment; if its verb ∈ `ENDED_VERBS` (UNDO, LOAD/RESTORE, RESTART, IMPORT) handle it as in step 6 (RESTART needs no confirmation here); anything else, including an empty line → `[text gameOver]`.
3. **Empty line:** pending ? `[prompt(pending)]` (re-emitted verbatim) : `[text empty]`.
4. `segments = splitChain(tokenise(s))`; at most `LIMITS.chainLength` (16) execute; extra ones are discarded with the chain notice (`{VERB}` = first word of the 16th segment).
5. `lineStart = clone(state)`; `undoCommitted = false`.
6. For each segment, in order:
   1. First segment only, while `ctx.pending` is set: apply A7.3. An answer yields a resolved command (continue at 6.6 / 6.7 with it, or ask again if still ambiguous); NO ⇒ say the cancel text, **STOP**; a non-answer clears `pending` and falls through (after the cancel text for a confirmation).
   2. `parseCommand` → `ParseError` ⇒ say its message, **STOP**.
   3. `again` ⇒ substitute `ctx.lastCommand` (A6.6) or say `againNothing`, **STOP**.
   4. Barrier verb ⇒ run it (A7.2) and **STOP**.
   5. Resolve (A6.3): error ⇒ say it, **STOP**; pending ⇒ store it, emit `prompt`, **STOP**.
   6. `meta` verb ⇒ run its handler (no pipeline, no turn), update `lastCommand`, continue.
   7. `world` verb ⇒ if `!undoCommitted` { `undoSnapshot = lineStart`; `undoCommitted = true` }; run the turn (A7.5 + A7.6); update `lastCommand` and pronouns; **STOP** if the game ended or panic moved the player.
7. If segments remain after a STOP, insert `text system chainIgnored` (`{VERB}` = first word of the stopping segment as typed, upper-cased) **immediately before the terminal event**, or at the end if there is none (A9.2 O3).
8. Every `text`, `prompt.text`, `end.title` and `end.text` passes the output normaliser (A12.1).

### A7.2 Chains and barriers (PLAN §3.4a)
- **K1** A chain executes in one `input()` call and is never persisted.
- **K2** A chain STOPs on: parse error, resolution error, AGAIN with nothing to repeat, a clarification or confirmation prompt, a barrier, an ending (incl. death), or panic. In-world failures ("The door is locked.") and meta commands do not stop it.
- **K3** Barriers (`CHAIN_BARRIERS`) always end the chain:

| Verb | Behaviour | Terminal event |
|---|---|---|
| `save n` | `n ∉ SAVE_SLOTS` → `slotNeeded` | `{type:'storage', op:'save', slot, data: serialise(state)}` (state after the chain's earlier commands) |
| `load n` / `restore n` | `n ∉ SAVE_SLOTS` → `slotNeeded` | `{type:'storage', op:'load', slot}`; the host then calls `game.load(data)` |
| `export` | — | `{type:'host', op:'export', data}` |
| `import` | — | `{type:'host', op:'import'}`; the host opens a file picker, then `game.load` |
| `undo` | A7.8 | refresh bundle (may end with `prompt` / `end`) |
| `restart` | not ended: confirm `restartConfirm`; YES → `restart()` bundle. Ended: immediate | `prompt`, or refresh bundle |
| `quit` | confirm `quitConfirm`; YES → | `{type:'host', op:'quit'}` |

- **K4** The storage/host request is the LAST event of the call, so nothing simulates against stale state. LOAD / IMPORT failure or cancellation leaves the state untouched; the host prints the reason (A10.2).
- **K5** Required tests (PLAN §3.4a): `LOAD 1 THEN NORTH` (NORTH discarded, notice before the storage event); load of a save holding a pending prompt; load of an ended game; `N. UNDO. S` and `N. RESTART` mid-chain.

### A7.3 Precedence while a question is pending (Codex R3 note 6)

| Pending | First segment of the next line | Result | Cost |
|---|---|---|---|
| any | empty line | prompt re-emitted verbatim | 0 |
| any | `SAVE n` / `EXPORT` | executes; **pending is kept** and is inside the saved data | 0 |
| any | `LOAD n` / `IMPORT` | barrier; on success the loaded state's pending (if any) replaces it; on failure / cancel the current pending stays | 0 |
| any | `UNDO` | snapshot exists: restored (pending = the snapshot's, usually null); none: `cantUndo`, pending kept | 0 |
| any | `RESTART` / `QUIT` | pending replaced by the restart / quit confirmation | 0 |
| disambig | an answer (A6.7) | the stored command completes and executes; remaining segments continue the chain | the command's own cost |
| disambig | anything else | pending cleared; the segment runs as a new command | as that command |
| confirm | YES | stored command re-runs with `confirmed: true` | the command's own cost (ACCUSE: 1) |
| confirm | NO | `cancelText` / `confirmCancelled`; chain stops | 0 |
| confirm | anything else | `cancelText` said; pending cleared; the segment runs as a new command | as that command |

### A7.4 Turn cost table (PLAN §3.4a)

| Class | Verbs (canonical ids) | Turns |
|---|---|---|
| Movement | `go` (incl. bare directions), `back`, `enter`, `exit`, `climb` | 1, also when refused ("You can't go that way.") |
| Observation | `look`, `examine`, `search`, `read`, `listen`, `smell` | 1 |
| Manipulation | `take`, `drop`, `put`, `open`, `close`, `unlock`, `lock`, `push`, `pull`, `move`, `turn_on`, `turn_off`, `wear`, `remove`, `eat`, `drink`, `throw`, `break`, `tear`, `cut`, `oil`, `use`, `touch`, `attack`, `swim`, `jump` | 1 |
| Social & case | `talk`, `ask`, `tell`, `show`, `give`, `buy`, `call`, `accuse` (resolved, incl. after YES), `arrest`, `free` | 1 |
| Waiting | `wait` | 1 |
| Content verbs | `content.verbs` with class `world` | 1 |
| Multi-object | ALL / lists | 1 in total |
| Hazard warning | first attempt at a hazard | 1 |
| Info meta | `inventory`, `score`, `time`, `notes`, `help`, `hint` (costs `hintCost` points) | 0 |
| Settings | `verbose`, `brief`, `graphics`, `sound`, `music`, `theme`, `typewriter` | 0 |
| System | `save`, `load`, `export`, `import`, `undo`, `restart`, `quit` | 0 (barriers) |
| Answers | disambiguation answers, YES / NO | 0 (the completed command pays its own cost) |
| `yes` / `no` without a question | — | 0 |
| `again` | — | cost of the repeated command |
| Errors | parse errors, resolution errors (not here, too dark, pronoun unset, ALL not allowed / nothing, one at a time), `again` with nothing; ACCUSE someone not present ("Accuse who? They're not here.") | 0 |

### A7.5 Executing one world command (action phase "A")
1. **Hazard.** A hazard matches when `hazard.room === roomId` and either (`exit` given and the command moves in that direction) or (`verb ∈ verbs` and (`objects` absent, or no `dobj`, or `dobj ∈ objects`)), and `unless` is false. If its id is not in `warned`: say `warn` (style `alert`), append to `warned` — the command is consumed. Otherwise: `end(hazard.ending)`.
2. **Protection** (A8.7): personal / critical refusals. Consumed.
3. **`before` slots**, in order: `room.before[verb]` → `dobj.before[verb]` → `iobj.before[verb]` (items and NPCs only). The first that fires without `continue` **handles** the command: skip 4–5.
4. **Handler**: `actions[verb].run(cmd, api)` → `{ok}`. Content verbs: say `default`, `ok: false`.
5. **`after` slots**, only if `ok`: `dobj.after[verb]` → `iobj.after[verb]` → `room.after[verb]` (each that fires).
6. **Lighting change** (A9.2 O5): if the player did not move and the room's lit state differs from before step 1, emit `picture` and the description (lit) or the darkness text (unlit).

`ActionDef = { verb, run(cmd, api) → {ok: boolean} }`; registry in `actions/index.js`. The
turn costs 1 whatever the outcome.

### A7.6 Per-turn pipeline (PLAN §3.4a per-turn order)
Runs once per world command, after it resolves (each command of a chain gets its own turn).

| Step | Name | What happens | When `state.ended` is set |
|---|---|---|---|
| A | Action | A7.5 | — |
| B | afterAction | every `content.afterAction` reaction, in order | skipped |
| D1 | Clock | `turn += 1` | **always runs** |
| D2 | Scripted beats | A4.12, array order | skipped |
| D3 | NPC schedules | each NPC (content order), each entry with `at === turn` and `if` true: move NPC; `leaveText` if the player is in the room left, `arriveText` if in the destination (lit rooms only); run `do` | skipped |
| D4 | Story daemons | each `content.daemons` entry in array order. **The Tallyman attack counter increments here** (A14 rule 8): after the action, afterAction, clock, beats and schedules of the same turn, before light and nerve | skipped |
| D5 | Light | each lit item with `fuel` (content order): `fuel -= 1`; at 0 → `lit = false`, `outText` if visible; lighting change (O5) | skipped |
| D6 | Nerve & panic | A8.10 | skipped |
| D7 | Ambience | `ambientFor(state)` = `room.ambient ?? zone.ambient ?? 'none'`; emit `ambient` if it differs from the value before step A | skipped |
| D8 | Endings | A7.7 | **always runs** |
| D9 | Status | `status` event | **always runs** |
| — | End | if ended: `end` event (terminal, last) | — |

PLAN's order "clock → scripted beats → NPC schedules → light → nerve/panic → ambience →
endings → status" is kept; D4 is inserted between schedules and light (A17 C9).

### A7.7 Endings (PLAN §2.5 endings precedence)
- **E1** At D8: if `state.ended` is already set (death or wrong man via `end`), that ending stands — death "ends immediately" and beats anything else. Otherwise the first ending in `content.endings` whose `when` holds wins.
  The first ending set in a turn is final: `end` never overwrites it, and once it is set no
  further Reaction effect applies — not even the rest of an enclosing reaction whose
  `movePlayer` triggered a fatal `onEnter` (TT-101). D1, D8, D9 and the `end` event still run.
- **E2** The Tallyman orders its `when` endings victory → pyrrhic → got-away → fifth-stroke (A14), so an action that achieves victory on turn 300 wins (victory precedes midnight).
- **E3** On ending: `ended = id`, `ctx.pending = null`; events `status` then `end` (with `text`, `title`, `score`, `rank`, …). Remaining chain commands are discarded with the notice before `end`.
- **E4** Ended mode accepts only `ENDED_VERBS` (A7.1 step 2). UNDO after a death restores the state before the fatal line.

### A7.8 UNDO (PLAN §3.4a)
- **U1** One snapshot, in memory, never serialised, bounded to one `State` clone.
- **U2** It holds the state at the start of the most recent input line that executed ≥ 1 world command; it is committed when that line's first world command starts (so lines of only free commands, errors, prompts or SAVE never touch it).
- **U3** UNDO (command or `game.undo()`): restore the snapshot, clear it (one level), return the refresh bundle + `(Undone.)` (+ re-emitted prompt / end per A9.3).
- **U4** No snapshot → `cantUndo`, free; a pending question stays.
- **U5** Cleared by successful LOAD / IMPORT, by RESTART, and by UNDO itself.
- **U6** Mid-chain: `N. UNDO. S` — N runs (snapshot = before the line), UNDO restores the before-line state, S is discarded with the notice. UNDO is available after a death.

### A7.9 Error containment
`input()`, `load()`, `undo()` and `restart()` never throw. Any exception inside them (engine
bug, throwing hook, invalid `setVar`) restores `lineStart` and the previous UNDO snapshot,
discards the events of that call and returns `[text system engineError]`. With
`strict: true` the exception is rethrown instead (tests, fuzzing). The game is the only
transaction boundary: no inner layer (resolver, Cond evaluation for scope or exits) turns a
hook exception into an ordinary result.

---

## A8 World rules

### A8.1 Scope
- **Visible**, room lit: items with `loc === roomId` or `roomId ∈ alsoIn`; NPCs with `loc === roomId`; the room's scenery; carried items; recursively the contents of every visible item that is a supporter, an open container or a transparent container. Hidden items (`hidden: true`) are never visible.
- **Visible**, room unlit: carried items and, recursively, the contents of carried open containers (by touch).
- **Reachable** = visible and not inside a closed container; handlers refuse unreachable objects with "You can't reach it." (1 turn).
  One registry wrapper applies this to every physical verb's `dobj` (take, drop, put, open, close, unlock, lock, push, pull, move, turn_on, turn_off, wear, remove, eat, drink, throw, break, tear, cut, oil, use, touch, attack, give, arrest, free) and tool `iobj` (put, unlock, lock, break, tear, cut, oil, use, attack, arrest) at the handler step; an implicit key (`keyId`) must be reachable too. Observation verbs and SHOW need only visibility (TT-101).
- Items held by NPCs (`loc = npcId`) and items with `loc = null` are never in scope (except BUY, A6.3 M3).

### A8.2 Light
`isLit(roomId)` ⇔ `!room.dark` or some item with `lit: true` whose location chain ends in
that room — directly, via open/transparent containers or supporters, or via the player
when the player is in that room. A closed opaque container blocks its light. Turning a
light on requires `light.needs` (if any) to hold, else `needsMsg`.

### A8.3 Movement and darkness
1. Direction from the command (`go`, bare direction, `enter`/`exit`/`climb` defaults: bare `enter` = `in`, `exit` = `out`, `climb up/down` = `u`/`d`; `enter X` / `climb X` run reactions first and then try `in` / `u`; `back` = the first direction in `DIRECTIONS` whose exit leads to `prevRoomId`).
2. Hazard check (A7.5 step 1) for `exit`-hazards.
3. No exit that way → `cantGo` (unlit room: `darkMove`). 1 turn.
4. **Darkness rule:** in an unlit room the player may only take an exit leading to `prevRoomId`; other exits → `darkMove`. If no exit leads to `prevRoomId` (or it is null) every exit is allowed (no softlock).
5. Exit `if` false → `msg` (default `cantGo`). Exit `door` not open → "The {door} is closed.".
6. Target is a stub → `MESSAGES.stub`; the player stays.
7. **Room entry** (also used by `movePlayer` and panic): `prevRoomId = roomId`; `roomId = to`; emit `room`, `picture`, the description (A8.4); run `onEnter`; add to `visited`.

### A8.4 Room description format (exact event sequence)

| # | Event | Content |
|---|---|---|
| 1 | `text` style `title` | `room.name` (unlit: `MESSAGES.darkTitle`) |
| 2 | `text` | rendered `room.desc` (unlit: `MESSAGES.dark`, and the description ends here) |
| 3 | `text` per NPC in the room (content order) | `npc.here` or `npcHere` ("Maggie is here.") |
| 4 | `text` per unmoved item with `initial` (content order) | `initial` |
| 5 | `text` (if any listable items remain) | `canAlsoSee`: "You can see a brass key, an iron key and a torch here." — listable = top-level, non-hidden, non-scenery items, content order, `listJoin` with "and" |
| 6 | `text` per visible supporter / open container in the room with visible contents | "On the bench you can see a coin." / "In the crate you can see a lamp." |
| 7 | `text` | `exits`: "Exits: north, down." — directions in `DIRECTIONS` order, `DIRECTION_NAMES`, joined with ", "; hidden exits whose `if` is false omitted; none → `noExits` |

- **BRIEF** (`settings.verbose === false`) on a re-visit: row 2 is omitted. LOOK, first visits and refresh bundles always give the full description.
- The `picture` event of a room carries `rules.darkPicture ?? null` while unlit, else `room.picture` if `content.art` has it, else `null`.

### A8.5 Objects, containers, doors
- **TAKE**: already carried (personal items included) → "You already have that."; NPC → "{The} wouldn't care for that."; `fixed`/`scenery` → the item's text or `MESSAGES.fixed`; unreachable → "You can't reach it."; success → `loc = 'player'`, `moved = true`, evidence discovery (A8.8), `taken`, then `sfx pickup`.
- **DROP**: not carried → "You aren't holding that."; success → `loc = roomId`, `dropped`. Critical items may be dropped (always retrievable).
- **PUT X IN/ON Y**: Y must be a container (`on` needs `supporter`), open, with room (`capacity` counts direct contents); putting something into itself or its own contents → "You can't put something inside itself.".
- **OPEN / CLOSE / LOCK / UNLOCK**: `openable` items; locked items cannot be opened; `unlock X` without `with` uses `keyId` automatically if carried, printing "(with the {key})". Opening or closing an item used as an exit `door` emits `sfx door`.
- Default refusals for other verbs are owned by their action module and registered as message ids (overridable via `content.messages`).

### A8.6 Hidden items and SEARCH
- `SEARCH` / `SEARCH ROOM` / `SEARCH AROUND` reveals every hidden item whose location chain ends in the current room without passing through a closed container. `SEARCH X` / `LOOK UNDER X` reveals hidden items located in or on X.
- Reveal: `hidden = false`, then `found` (default "You find {a item}."). Revealed items are not taken automatically. Nothing found → "You find nothing of interest." EXAMINE never reveals. 1 turn.

### A8.7 Protection of personal and critical items (PLAN §2.5 resource policy)
Applied at A7.5 step 2 — before any content reaction, so content cannot accidentally bypass it.

| Verb | `personal` | `critical` | other items |
|---|---|---|---|
| `drop`, `put` | refused: `personal` | allowed (stays retrievable) | allowed |
| `give` to an NPC whose `accepts` lacks the item | refused: `personal` | refused: `criticalMsg ?? critical` | NPC `refuse` reaction; item kept |
| `give` with an `accepts` entry | refused (lint forbids personal items in `accepts`) | allowed | allowed |
| `show` | allowed | allowed | allowed |
| `throw` | refused: `personal` | refused: `critical` | in a `sink` room: lost (`loc = null`) with the room's text; else dropped ("Thrown.") |
| `eat`, `drink` | refused: `personal` | refused: `critical` | `edible`/`drinkable` reaction then `loc = null`; else "That's plainly inedible." / "You can't drink that." |
| `break`, `tear`, `cut` (as dobj) | refused: `personal` | refused while carried: `critical` (not yet carried — e.g. TEAR PAGE out of the ledger — content reactions decide) | content reactions / default |

Containers carry their contents' protection: the rules above apply to the `dobj` and to
everything (transitively) inside or on it, personal before critical, so THROW SATCHEL into
a sink or GIVE it away is refused while critical handcuffs are inside (an `accepts` entry
only exempts the given item itself) (TT-101).

Engine default handlers never destroy an item for BREAK / TEAR / CUT; only content reactions can, and lint warns on reactions that `move` a critical item to `null`. The warrant card and wallet are `personal`; money is a balance, never an item that can be
lost. No exit is ever removed, so no room becomes permanently inaccessible before an ending.

### A8.8 Evidence and notes (PLAN §2.5 evidence ids)
- **Discovery.** Item evidence is discovered the first time its item becomes carried by any route (TAKE, `give`, `move` to the player, BUY). Fact evidence is discovered by the `evidence` effect / `api.addEvidence`. Discovery appends the id to `state.evidence`, then adds its `note` (emits `noted`), then its `award` (emits `scoreUp`).
- **Count** (used by `{evidence: n}`, `case.threshold`, `{evidence}`): number of ids in `state.evidence` that are facts, plus those whose item `isCarried` now. Dropping an evidence item lowers the count; picking it up again restores it.
- **NOTES** (free): note texts in the order noted, then each discovered evidence label, marking item evidence not currently carried as "(not with you)". Exact wording is TT-009's, under message ids.

### A8.9 Money and BUY (PLAN §2.5 personal effects)
- `state.money` in pence. `formatMoney`: `< 100` → `"50p"`, else `"£2.00"`.
- **BUY X**: seller = first NPC in the room with `sells[X]`; none → "There's nothing like that for sale here."; `if` false → `refuse` (default "{The} won't sell you that."); X already in the world (`loc !== null`) → "You've already got one of those."; `money < price` → "You can't afford it."; else `money -= price`, X → player (discovery applies), `text` (default "You buy {a item} for {price}."). 1 turn. A consumed item (`loc = null`) can be bought again while money lasts.

### A8.10 Nerve and panic (step D6; PLAN §2.5)
Let `n0` = nerve before step A of this turn; tuning = `RULE_DEFAULTS.nerve` overridden by `rules.nerve`.
1. `base` = room unlit ? `+dark` : room is its zone's `safeRoom` ? `safe` (−5) : `!room.dark` ? `lit` (−1) : `0` (a dark room lit by a torch).
2. `nerve = clamp(nerve + base + (room.nerve ?? 0), 0, max)`. Deltas applied during the turn (`nerve` effects) are already included.
3. If the zone has `nerveCap` and `nerve > nerveCap`: `nerve = nerveCap`; say `capText` (alert) only if `n0 < nerveCap`.
4. For each `rules.nerve.messages` `{at, text}` ascending with `n0 < at ≤ nerve`: say `text` (alert).
5. **Panic** if `nerve ≥ panicAt` and `panicCooldown === 0` and the zone's `panic !== false`: say `zone.panicText ?? rules.nerve.panicText` (alert), `sfx sting`, room entry into the zone's `safeRoom` (A8.3 step 7), `nerve = panicReset` (50), `panicCooldown = panicCooldown rule` (15); the chain stops. Otherwise, if `panicCooldown > 0`, decrement it. (Panic is therefore impossible for the 15 turns after one.)
6. Beneath (`panic: false`, `nerveCap: 99`): nerve never exceeds 99 and panic never triggers; nerve does not feed the attack counter.

### A8.11 Score, ranks, HINT, SCORE, TIME
- `award(id)`: once; `score = min(maxScore, score + points)`; emits `scoreUp` with `{n}`.
- Rank = `title` of the last `ranks` entry with `min ≤ score`.
- **SCORE** (free): "Your score is {score} of a possible {maxScore}, in {turns} turns, giving you the rank of {rank}."
- **HINT** (free in turns): the first step whose `done` is false; say `tiers[hintTiers[id] ?? 0]`; then `hintTiers[id] = min(tier + 1, tiers.length − 1)`; `score = max(0, score − hintCost)`; emit `status`. No open step → "You have everything you need. Finish it." (no cost).
- **TIME** (free): "It is {time}." `timeString(turn)` = `START_TIME` + ⌊turn × `TURN_SECONDS` / 60⌋ minutes, as `HH:MM`, wrapping at 24 h (turn 1 → `21:30`, turn 2 → `21:31`, turn 300 → `00:00`).

---

## A9 Output Events (PLAN §3.4, §3.4a)

### A9.1 Event list (complete — `EVENT_TYPES`)

| Type | Fields | Emitted when | Host / UI action |
|---|---|---|---|
| `text` | `text`, `style?` (omitted = normal) | all prose; parser/system messages use `style:'system'` | print: wrap at 40, typewriter, `[MORE]` |
| `room` | `id`, `name` | player changes room; refresh | status-bar location |
| `picture` | `id` (`ArtId\|null`), `graphics` | with every `room`; GRAPHICS ON/OFF; lighting change (O5) | draw / blank / hide the panel (`graphics:false` ⇒ hidden, text gets 23 rows) |
| `status` | `room`, `roomId`, `time`, `score`, `maxScore`, `nerve`, `turns` | D9 of every turn; after HINT; refresh | status bar; border colour from nerve |
| `sfx` | `id` | content cues; engine built-ins `pickup` (TAKE), `door` (door open/close), `sting` (panic) | play once |
| `ambient` | `id` (`AMBIENT_IDS`) | D7 when changed; refresh | switch ambience loop |
| `music` | `id` or `'stop'` | content / endings; `'stop'` in every refresh | sequencer |
| `pause` | `ms` | content dramatic beats | wait before rendering the next event (skippable; never advances simulation) |
| `clear` | — | first event of every refresh | clear the text region |
| `end` | `ending`, `kind`, `title`, `text`, `score`, `maxScore`, `rank`, `turns`, `art`, `music` | an ending is reached; refresh of an ended game | ending screen; then only UNDO / LOAD / RESTART / IMPORT |
| `storage` | `op:'save'`, `slot`, `data` \| `op:'load'`, `slot` | SAVE / LOAD | A10.2 |
| `host` | `op:'export'`, `data` \| `op:'import'` \| `op:'quit'` \| `op:'setting'`, `key`, `value` | EXPORT / IMPORT / QUIT / SOUND, MUSIC, THEME, TYPEWRITER | A10.2, A10.3 |
| `prompt` | `kind` (`'disambig'\|'confirm'`), `text` | a question is asked; refresh with a pending question; empty line while pending | print `text`; the next input answers it |

The ending text travels **only** in `end.text` (the UI renders it on the ending screen;
`play.js` prints it). The engine never emits `style:'echo'` — that style is reserved for
the host echoing typed input.

### A9.2 Ordering rules
- **O1** Events are rendered strictly in array order.
- **O2** A call emits at most one **terminal** event — `prompt`, `end`, `storage`, or `host` with op `export`/`import`/`quit` — and it is the LAST event. (`host setting` is not terminal.)
- **O3** The chain notice goes immediately before the terminal event, or last if there is none.
- **O4** One `status` per completed turn (D9), plus one after HINT, plus one in each refresh bundle. Free commands that change nothing shown in the status bar emit none.
- **O5** `room` is always followed immediately by `picture`. `picture` is also emitted alone on GRAPHICS ON/OFF, and — followed by the description (lit) or darkness text (unlit) — when the current room's lit state changes without the player moving (TURN ON TORCH in the cellar).
  This holds in every phase of a turn — action, room entry (`onEnter`), afterAction and each daemon step — measured against what the player was last shown, so each change is announced exactly once (TT-101).
- **O6** `ambient` is emitted at D7 only when the value differs from the one at the start of that command's turn, and always in refresh bundles.
- **O7** All strings are output-normalised (A12.1).
- **O8** Within one action, text precedes its own `sfx` (e.g. "Taken." then `pickup`), except a Reaction's `sfx`/`pause` keys, which come before its `say` (REACTION_ORDER).

### A9.3 Refresh bundle (`start`, `load`, `undo`, `restart`, UNDO / RESTART commands)
Exact order:
1. `clear`
2. `room`
3. `picture`
4. `ambient`
5. `music` `'stop'`
6. `status`
7. `start()` / `restart()` on a fresh game only: `rules.intro` text
8. the full room description (A8.4; darkness text if unlit)
9. `undo` only: `text system '(Undone.)'`
10. if `state.ended`: the `end` event (with the ending text) — **or** else, if `ctx.pending`: the `prompt` event re-emitted verbatim from `pending.text`

After a refresh of an ended game only UNDO / LOAD / RESTART / IMPORT are accepted (A7.7 E4).

---

## A10 Host protocol (PLAN §3.4a host protocol, §3.8)

### A10.1 Storage adapter (`StorageAdapter`, host side — the engine never touches storage)
- **Browser** (`src/ui/storage.js`, TT-012): at boot, probe `localStorage` (`setItem`/`removeItem` of `tallyman.probe`) inside try/catch. Success → keys `tallyman.save.<slot>` (SaveData JSON) and `tallyman.setting.<key>`. Failure or absence (`file://` in some browsers) → in-memory `Map`, `persistent: false`, and one system line per session: "Saving to this browser isn't possible here. Saves last until you close the page - use EXPORT to keep one."
- Every adapter call is wrapped in try/catch and never throws. `read` returns `null` for an empty slot or unparseable JSON (validation is the engine's job). `write` returns `false` on failure (e.g. quota) after keeping the save in memory.
- `list()` returns each slot's `summary` for a slot listing ("1: Mill Yard 22:41 SC 35").
- **Terminal** (`tools/play.js`): `./saves/slot<N>.json`; EXPORT writes `./saves/tallyman-save.json`; IMPORT reads that file (or `--import <file>`). A failed write prints the reason, keeps the save in memory for the session (LOAD / IMPORT read it) and play continues.

### A10.2 Handling engine requests

| Event | Host does | Host prints (style `system`) |
|---|---|---|
| `storage save` | `adapter.write(slot, data)` | "Saved in slot {n}." / in-memory: "Saved in slot {n} for this session only. Use EXPORT to keep a copy." |
| `storage load` | `data = adapter.read(slot)`; null → message; else `res = game.load(data)`; render `res.events` | "Slot {n} is empty." / after the bundle: "Restored from slot {n}." / "That save can't be loaded: {error}" |
| `host export` | download `tallyman-save.json` (`application/json` Blob link) | "Save exported as tallyman-save.json." |
| `host import` | open a file picker (`.json`), read text, `game.load(text)`, render | "Import cancelled." / "That file can't be loaded: {error}" / after the bundle: "Save imported." |
| `host quit` | browser: back to the title screen, game discarded; terminal: exit 0 | — |
| `host setting` | apply, persist via `writeSetting`, acknowledge | "Sound off." / "Theme: ZX Spectrum." |

Acknowledgements after a successful load are printed after rendering the bundle (the bundle starts with `clear`). While a file picker is open the host blocks typing.

### A10.3 Settings

| Setting | Lives in | Command | Values | Default |
|---|---|---|---|---|
| `verbose` | state (`settings.verbose`) | VERBOSE / BRIEF | bool | `true` |
| `graphics` | state (`settings.graphics`) | GRAPHICS [ON\|OFF] | bool | `true` |
| `sound` | host | SOUND [ON\|OFF], F2 key | `on`/`off`/`toggle` | on |
| `music` | host | MUSIC [ON\|OFF] | `on`/`off`/`toggle` | on |
| `typewriter` | host | TYPEWRITER [ON\|OFF] | `on`/`off`/`toggle` | on (off under `prefers-reduced-motion`) |
| `theme` | host | THEME [C64\|SPECTRUM\|AMBER\|NEXT] | `HOST_SETTINGS.theme` | `c64` |

- The engine normalises the argument (bare → `toggle`, bare THEME → `next`); an invalid argument gives "Use SOUND ON or SOUND OFF." (free, no event).
- GRAPHICS and VERBOSE change engine output, so they live in state and saves; presentation settings never enter state (PLAN §3.4a).
- F2 is handled entirely by the host — no engine call.

### A10.4 Host lifecycle
1. Boot (tape screen) → title → first key press (creates/resumes the AudioContext).
2. `game = createGame({content, seed})` with the seed chosen by the host (e.g. `Date.now() >>> 0`); render `game.start()`.
3. On Enter: `render(game.input(line))`. Rendering (typewriter, `[MORE]`, `pause`, animation, audio) never calls back into the engine and never advances simulation time.
4. On `end`: ending screen; its keys map to `game.input('undo')`, `game.input('restart')`, or typed LOAD / IMPORT.
5. The UI keeps no game state beyond what the last events said; a refresh bundle fully redraws it.

---

## A11 Save format & validation (PLAN §3.4a storage, §3.8)

```json
{ "format": "tallyman-save", "game": "tallyman", "contentVersion": "1.0.0",
  "summary": { "room": "Mill Yard", "time": "22:41", "score": 35, "turns": 142 },
  "state": { "v": 1, "seed": 12345, "rng": 987654321, "turn": 142, "roomId": "mill_yard", "…": "…" } }
```

`serialise(state, content)` builds this from a deep clone; `summary` is derived and ignored
on load. `validateSave(data, content)` returns `{ok:true, state}` or `{ok:false, error}` and
checks, in order (first failure wins):

- **V1** `data` is a plain object, or a string that `JSON.parse`s to one; serialised size ≤ `LIMITS.saveBytes` (256 KiB). → "not a Tallyman save"
- **V2** `format === SAVE_FORMAT`. → "not a Tallyman save"
- **V3** `game === content.meta.id`. → "save is from a different game"
- **V4** `state.v === STATE_VERSION`. → "unsupported save version {v}". (Future versions add explicit migrations; v1 has none. A different `contentVersion` is accepted — ids decide.)
- **V5** `state` has exactly the A3 keys — none missing, none extra — with the right JSON types; integers where integers are required; `seed`/`rng` uint32.
- **V6** Ranges: `0 ≤ turn ≤ MIDNIGHT_TURN`, `0 ≤ nerve ≤ 100`, `money ≥ 0`, `0 ≤ score ≤ maxScore`, `0 ≤ panicCooldown ≤ rule`, `fuel ≥ 0`.
- **V7** Ids: `roomId` / `prevRoomId` are real rooms (not stubs); `visited` unique, real rooms, contains `roomId`; `items` / `npcs` / `vars` key sets equal the content's; `awarded`, `notes`, `evidence`, `warned`, `fired`, `hintTiers` keys reference existing ids and are unique.
- **V8** `ItemState` capability fields exactly per A3.1 S4, boolean / integer typed.
- **V9** Locations: item `loc` ∈ rooms ∪ container items ∪ NPCs ∪ {`'player'`, `null`}; NPC `loc` ∈ rooms ∪ {`null`}; `worn` ⇒ `loc === 'player'`.
- **V10** No containment cycles: from each item follow `loc` while it names an item; revisiting an item, or more steps than there are items, is a cycle. → "corrupt save: containment cycle at {id}"
- **V11** `vars` values valid for their `VarDecl`; every `flags` value is `true`.
- **V12** `ctx`: `it` / `npc` null or existing; `them` existing ids; `lastCommand` null or a `Command` with existing ids; `pending` null or well-formed (`kind ∈ PENDING_KINDS`, string `text`, existing candidates — for a disambiguation: a parsed command with a known verb, string `verbWord`/`raw`, well-formed noun phrases (exactly one of words / pronoun / all / list), the asked `slot` present in it, ≥ 2 distinct candidates, `index` only into a `list` phrase with `bound[slot]` the ids resolved so far, otherwise `slot` not yet bound); `ended` null or an existing ending id; `ended !== null ⇒ pending === null`; `settings` two booleans.
- **V13** Atomicity: `validateSave` never mutates its input; `game.load` swaps state only after full success, then clears the UNDO snapshot and returns the refresh bundle. On failure nothing changes.

Error strings are short and human-readable: `corrupt save: {path}: {problem}`, e.g.
`corrupt save: state.items.torch.loc: unknown location "attic"`.

---

## A12 Text normaliser & glyph policy (PLAN §3.4a text glyphs, §3.5)

### A12.1 Output normaliser (`text.normalise`) — every engine-emitted string

| Input | Output |
|---|---|
| `‘ ’ ‚ ‛ ′ ´` and backtick | `'` |
| `“ ” „ ‟ ″` | `"` |
| `…` | `...` |
| `– — ― ‒ − ‐ ‑` | `-` |
| no-break / thin / en / em spaces, tab | space |
| `\r\n`, `\r` | `\n` |
| zero-width characters, soft hyphen, BOM | removed |
| `£` | kept (custom font glyph) |
| any other character outside printable ASCII, `\n`, `£` | `?` (strict mode: internal error, so tests catch it) |

### A12.2 Glyph policy
- **Game text** (content prose, messages, hook output): printable ASCII U+0020–U+007E, `\n` and `£` only. Lint **L09** rejects anything else in static text, including characters the normaliser would map — write straight quotes and `-`.
- **Art**: any character `font8x8.hasGlyph` accepts (ASCII, `£`, box drawing U+2500–U+257F, blocks U+2580–U+259F).
- Upper-casing is presentation only (C64 theme `upper: true`); the engine emits mixed case and never depends on case.

### A12.3 Input normalisation (before `tokenise`)
Coerce to string → apply the A12.1 mapping → lower-case → trim → collapse whitespace runs to
one space → truncate to `LIMITS.inputLength`.

### A12.4 Formatting helpers (`text.js`)
`formatMoney(50)` → `"50p"`, `formatMoney(200)` → `"£2.00"`; `listJoin(['a','b','c'], 'and')` →
`"a, b and c"` (no serial comma; `'or'` for disambiguation); `withArticle` honours
`article` / `proper` (`a`/`an`/`some`/`the`/none); `capitalise` upper-cases the first letter.

---

## A13 Content lint rules (`tools/lint-content.js`, PLAN §4 content lint)

| Id | Rule | Incremental | `--strict` |
|---|---|---|---|
| L01 | Schema: required fields, JSON types; **unknown fields are errors** (typo guard) | E | E |
| L02 | Ids match `ID_PATTERN`; rooms/stubs/items/NPCs share one unique namespace; `player` reserved; topic ids don't collide | E | E |
| L03 | References resolve: exit `to`/`door`, item `location`/`alsoIn`/`keyId`, NPC `location`, schedule `to`, `picture`/`art`/`darkPicture`, award/note/evidence/ending/hazard/hook/var ids inside Reactions and Conds, `case` NPCs, `rules.start`, zone `safeRoom` | E | E |
| L04 | Cond and Reaction shapes (C1; keys ⊆ `REACTION_ORDER ∪ REACTION_CONTROL_KEYS`); `setVar` values fit their `VarDecl`; only known `{placeholders}` | E | E |
| L05 | Exits: directions ∈ `DIRECTIONS`; reciprocity — for every exit A→B some exit B→A exists, unless `oneWay` | E | E |
| L06 | Every `oneWay` exit has a hazard on that room and direction (death) | E | E |
| L07 | Every room reachable from `rules.start` over exits (conditions ignored) | E | E |
| L08 | Every `critical` item obtainable: location chain ends in a reachable room, or `location: null` and some `give` / `move` / `sells` puts it in the world | E | E |
| L09 | Static text glyphs: ASCII + `£` + `\n` only | E | E |
| L10 | Room `desc` variants ≤ 300 characters | E | E |
| L11 | Art: `w`/`h` per `ART_SIZES`, row lengths, colour keys ∈ `PALETTE_KEYS`, `bg` shape, `fx ⊆ ART_FX`, glyphs via `hasGlyph` | E | E |
| L12 | Every room has a `picture` with existing art | W (falls back to no picture) | E |
| L13 | Indistinguishable references: two entities that can share a scope (same room incl. `alsoIn`, or both portable, or one portable) whose `nounWords` intersect and whose `adjWords` sets are equal | E | E |
| L14 | Stubs: allowed only as exit targets | W per stub | E (zero stubs) |
| L15 | Hooks: referenced ⇒ defined (E); defined ⇒ referenced (W) | E/W | E/W |
| L16 | Zones: every room's zone exists; zones with panic have a `safeRoom` in the zone that is not dark and has no hazard | E | E |
| L17 | Scoring: Σ award points = `maxScore`; ranks ascending, first `min` 0, last `min` = `maxScore`; every award referenced somewhere (W) | E/W | E/W |
| L18 | Personal items start at `'player'` and never appear in `accepts` / `sells`; critical items have no `edible` / `drinkable`; critical light sources have no `fuel` or `fuel ≥ MIDNIGHT_TURN` | E | E |
| L19 | Endings: unique ids; the last `when`-ending is a catch-all `{turnGte: MIDNIGHT_TURN}`; endings without `when` are referenced by an `end` effect or hazard (W) | E/W | E/W |
| L20 | Beats / schedules: `at`, `every` within 1…`MIDNIGHT_TURN`; every beat has a trigger | E | E |
| L21 | A noun/adjective equal to a direction, verb word or filler | W | W |
| L22 | A flag tested in a Cond but never set anywhere | W | W |
| L23 | Hint steps: valid `done`, non-empty `tiers` | E | E |

Output lines: `ERROR L05 rooms.lock.exits.e: no exit back from towpath` / `WARN L12 …`.
Exit code 1 iff any error. `npm run lint:content` is incremental; `--strict` is required
from R3 on (PLAN §4).

---

## A14 Traceability: PLAN → contract

### A14.1 PLAN §2.5 (case rules, finale, resource policy)

| # | PLAN §2.5 rule | Contract mechanism |
|---|---|---|
| 1 | Evidence ids `ev_ledger`, `ev_register` (fact), `ev_button`, `ev_file`; item counts while carried, fact once noted; notebook page is a lead | `content.evidence` (A4.10); count A8.8; the notebook page is a plain item |
| 2 | ACCUSE free only when it does not resolve (person not present), else 1 turn | `accuse.notHere` resolution failure, free (A6.3 M6, A7.4) |
| 3 | Pike present & evidence ≥ 3 → +10; at the Police House he flees and reaches the Counting Room 5 turns later (`fled`); in the Counting Room points only | `case.correct` cases below; `award` is once-only |
| 4 | Pike present & evidence < 3 → laughs, nerve +15, may retry | `case.weak: {say, nerve: 15}` |
| 5 | Ashdown / Maggie / Silas present → "Are you certain? (Y/N)" (free); YES → Wrong man; NO / anything else → cancelled, no turn | `case.suspects` → `PendingConfirm`; A7.3; `case.wrong: {end: 'wrong_man'}` |
| 6 | Pike at the Police House; leaves at turn 240 if not fled (`left`); never met elsewhere before | schedule entry `at: 240` with `if` (below); `loc: null` while travelling |
| 7 | Counting Room door barred until Pike is inside; both routes share it; Harrow praying beforehand | Tunnel exit `if: {at: ['pike','counting_room']}` + `msg`; Tunnel `desc` variants |
| 8 | Attack counter: 0 at first entry; +1 at the end of every turn ending in the room (entering turn = 1); no panic; lit: warn 2, lunge 4 (nerve +20), fatal 5; dark: warn 1, fatal 2; leaving pauses, resumes (min 1) | Story daemon `attack` at **D4** (below); Beneath `panic: false`; counter persists in `vars.attack` while away |
| 9 | HANDCUFF / ARREST / CUFF PIKE with handcuffs → restrained (+10), counter stops; without: "With what? Harrow croaks: 'Cuffs - in my car!'" (1 turn) | `arrest` verb synonyms; `pike.before.arrest` cases; daemon requires `pikeState: 'counting'` |
| 10 | CUT CHAINS / FREE HARROW / USE BOLT CUTTERS ON CHAINS with bolt cutters → freed (+10), regardless of Pike | `before.cut` / `before.free` / `before.use` reactions setting `harrowFreed` |
| 11 | Harrow's bleeding cued on entering Tunnel / Counting Room after 23:00 and every 20 turns there | `onEnter` with `{turnGte: 180}`; beat `{every: 20, when: {in: 'counting_room'}}` |
| 12 | Endings precedence: death → victory → midnight; victory on turn 300 wins | A7.7; endings array order |
| 13 | Critical items cannot be destroyed / eaten / drunk / thrown away / given to the wrong NPC; DROP leaves them retrievable | `Item.critical`, A8.7, lint L08 / L18 |
| 14 | Warrant card & wallet are part of you ("You'd sooner lose your head."); SHOW CARD works; money 500p; whisky £2 sold once Silas is heard of, again if gone; 10p coin separate | `Item.personal`, `state.money`, `maggie.sells.whisky = {price: 200, if: 'heard_of_silas'}`, BUY rules A8.9 |
| 15 | Light cannot be exhausted | torch `light.fuel: 320` (≥ `MIDNIGHT_TURN`, lint L18) |
| 16 | Panic at 100 → zone safe room, nerve 50, 15-turn cooldown; safe −5/turn, lit −1/turn; Beneath never panics, cap 99 with text | `zones` (below), A8.10 |
| 17 | No one-way exits except the warned quarry fall | lint L05 / L06; `hazards.quarry` |
| 18 | Linter flags unreachable critical items and non-death one-way exits | lint L08, L06 |

### A14.2 PLAN §3.4a and Codex R3 note 6

| PLAN §3.4a item | Section |
|---|---|
| Turn cost | A7.4 |
| Command chains | A7.1, A7.2 K1–K2 |
| Chain barriers, storage request last, LOAD failure leaves state | A7.2 K3–K5, A9.2 O2–O3, A10.2 |
| AGAIN / ALL | A6.5, A6.6 |
| Per-turn order | A7.6 |
| UNDO | A7.8 |
| Storage protocol, atomic validated load | A7.2, A10, A11 |
| Full refresh incl. pending prompt / ended game | A9.3 |
| Host protocol (export / import / setting) | A9.1, A10 |
| Animation never advances time | A9.1 `pause`, A10.4 |
| Text glyphs | A12 |
| Schema completeness | A3.2 |
| R3 note 6: `restart()`, host events, ending text, attack-counter placement, SAVE/LOAD while pending | A2, A9.1, A9.1 (`end.text`), A7.6 D4, A7.3 |

### A14.3 Tallyman encodings (field names normative; prose and exact numbers are TT-015's)

```js
zones: {
  town:    { name: 'Town',   safeRoom: 'market_square', ambient: 'rain' },
  canal:   { name: 'Canal',  safeRoom: 'towpath',       ambient: 'rain' },
  moor:    { name: 'Moor',   safeRoom: 'moor_road',     ambient: 'wind' },
  mill:    { name: 'Mill',   safeRoom: 'mill_yard',     ambient: 'drone' },
  asylum:  { name: 'Asylum', safeRoom: 'asylum_gates',  ambient: 'wind' },
  beneath: { name: 'Beneath', panic: false, nerveCap: 99, ambient: 'heartbeat',
             capText: "Your heart hammers, but Harrow's voice holds you here." },
},
vars: {
  pikeState:       { type: 'enum', values: ['desk', 'fled', 'left', 'counting', 'restrained'], init: 'desk' },
  pikeArrivalTurn: { type: 'int', nullable: true, min: 0, init: null },
  attack:          { type: 'int', min: 0, init: 0 },
  harrowFreed:     { type: 'bool', init: false },
},
case: {
  culprit: 'pike', threshold: 3, suspects: ['ashdown', 'maggie', 'silas'],
  confirm: 'Are you certain? (Y/N)',
  correct: [
    { if: { in: 'police_house' }, award: 'accusation', move: { pike: null },
      setVar: { pikeState: 'fled', pikeArrivalTurn: { turnPlus: 5 } }, say: '…he shoves past you…' },
    { award: 'accusation', say: '…' },                       // Counting Room: points only
  ],
  weak: { say: 'Pike laughs…', nerve: 15 },
  wrong: { end: 'wrong_man' },
},
// npcs.pike
schedule: [{ at: 240, to: null, if: { var: 'pikeState', eq: 'desk' }, leaveText: '…',
             do: { setVar: { pikeState: 'left', pikeArrivalTurn: { turnPlus: 5 } } } }],   // delay for 'left': TT-015
before: { arrest: [
  { if: { var: 'pikeState', eq: 'restrained' }, say: 'He is going nowhere.' },
  { if: [{ var: 'pikeState', eq: 'counting' }, { carried: 'handcuffs' }],
    setVar: { pikeState: 'restrained' }, award: 'arrest', say: '…' },
  { if: { var: 'pikeState', eq: 'counting' }, say: "With what? Harrow croaks: 'Cuffs - in my car!'" },
  'Not yet. You need more than a hunch.',
] },
daemons: [                                                    // step D4, in this order
  { id: 'pike_arrives', run: {
      if: [{ var: 'pikeState', oneOf: ['fled', 'left'] }, { turnGte: { var: 'pikeArrivalTurn' } }],
      move: { pike: 'counting_room' }, setVar: { pikeState: 'counting' } } },
  { id: 'attack', run: {
      if: [{ in: 'counting_room' }, { var: 'pikeState', eq: 'counting' }],
      setVar: { attack: { add: 1 } },
      then: [
        { if: [{ lit: true },  { var: 'attack', gte: 5 }], end: 'death_pike' },
        { if: [{ lit: true },  { var: 'attack', eq: 4 }], say: '…he lunges…', style: 'alert', nerve: 20 },
        { if: [{ lit: true },  { var: 'attack', eq: 2 }], say: 'He circles, knife low.', style: 'alert' },
        { if: [{ lit: false }, { var: 'attack', gte: 2 }], end: 'death_pike' },
        { if: [{ lit: false }, { var: 'attack', eq: 1 }], say: '…', style: 'alert' },
      ] } },
],
// rooms.tunnel.exits
n: { to: 'counting_room', if: { at: ['pike', 'counting_room'] },
     msg: 'The iron door is barred from the other side. Beyond it, Harrow is praying.' },
hazards: {
  lock:   { room: 'lock', verbs: ['swim', 'enter'], objects: ['lock_water'], warn: '…', ending: 'death_drown' },
  quarry: { room: 'quarry_edge', exit: 'd', unless: { carried: 'rope' }, warn: '…', ending: 'death_fall' },
},
endings: [                                                    // D8 order = precedence
  { id: 'victory',      kind: 'victory',  when: [{ var: 'pikeState', eq: 'restrained' }, { var: 'harrowFreed', eq: true }], title: '…', text: '…' },
  { id: 'pyrrhic',      kind: 'midnight', when: [{ turnGte: 300 }, { var: 'pikeState', eq: 'restrained' }], title: '…', text: '…' },
  { id: 'got_away',     kind: 'midnight', when: [{ turnGte: 300 }, { var: 'harrowFreed', eq: true }], title: '…', text: '…' },
  { id: 'fifth_stroke', kind: 'midnight', when: { turnGte: 300 }, title: '…', text: '…' },
  { id: 'wrong_man',  kind: 'wrong', title: '…', text: '…' },
  { id: 'death_drown', kind: 'death', title: '…', text: '…' },
  { id: 'death_fall',  kind: 'death', title: '…', text: '…' },
  { id: 'death_pike',  kind: 'death', title: '…', text: '…' },
],
```

Counter walk-through (lit): enter on turn T → D4 makes `attack` 1; T+1 → 2 (warning);
T+2 → 3; T+3 → 4 (lunge, nerve +20, capped at 99 by D6 the same turn); T+4 → 5 (death).
A successful ARREST in step A of any of those turns sets `restrained`, so D4 of that same
turn no longer increments. Leaving keeps `attack`; re-entering continues from it (+1 on
the re-entry turn, hence ≥ 1).

---

## A15 Worked example — 3-room mini world, 6 inputs (TT-002 acceptance; PLAN §3.4, §3.4a)

Content (an `art` entry for both pictures is assumed; its 40×9 data is omitted):

```js
export default {
  meta: { id: 'mini', title: 'Contract example', version: '1' },
  rules: { start: 'platform', money: 500, intro: 'The last train pulls away into the rain.', nerve: { start: 10 } },
  zones: { town: { name: 'Town', safeRoom: 'platform', ambient: 'rain' } },
  rooms: {
    platform: { name: 'Platform', zone: 'town', picture: 'platform',
      desc: 'Rain hammers the canopy of a deserted platform. The waiting room lies north.',
      exits: { n: 'waiting' },
      scenery: [{ names: ['canopy'], desc: 'Rusted iron, leaking in a dozen places.' }] },
    waiting: { name: 'Waiting Room', zone: 'town', picture: 'waiting_room', ambient: 'none',
      desc: 'A cold waiting room. A hatch in the floor stands open.',
      exits: { s: 'platform', d: 'cellar' },
      scenery: [{ names: ['hatch'], desc: 'Steps lead down into blackness.' }] },
    cellar: { name: 'Cellar', zone: 'town', dark: true, ambient: 'drone',
      desc: 'Damp brick. Somewhere, water drips.',
      exits: { u: 'waiting' },
      onEnter: { if: { lit: true }, award: 'cellar' } },
  },
  items: {
    brass_key: { name: 'brass key', names: ['key'], adjectives: ['brass'], desc: 'A small brass key.', location: 'waiting' },
    iron_key:  { name: 'iron key',  names: ['key'], adjectives: ['iron'],  desc: 'A heavy iron key.',  location: 'waiting' },
    torch: { name: 'torch', names: ['torch', 'flashlight'], desc: 'A police-issue torch.', location: 'waiting',
      critical: true, light: { lit: false }, after: { take: { award: 'torch' } } },
  },
  npcs: {},
  scoring: { maxScore: 10,
    awards: { torch: { points: 5, label: 'Found a torch' }, cellar: { points: 5, label: 'Lit the cellar' } },
    ranks: [{ min: 0, title: 'Probationer' }, { min: 10, title: 'Inspector' }] },
  endings: [{ id: 'midnight', kind: 'midnight', title: 'Midnight', text: 'Somewhere a bell strikes twelve.', when: { turnGte: 300 } }],
  art: { platform: { /* 40×9 */ }, waiting_room: { /* 40×9 */ } },
};
```

`createGame({content, seed: 1})`, then **`start()`** (refresh bundle with intro):
```js
{type:'clear'}
{type:'room', id:'platform', name:'Platform'}
{type:'picture', id:'platform', graphics:true}
{type:'ambient', id:'rain'}                                   // zone ambient
{type:'music', id:'stop'}
{type:'status', room:'Platform', roomId:'platform', time:'21:30', score:0, maxScore:10, nerve:10, turns:0}
{type:'text', text:'The last train pulls away into the rain.'}
{type:'text', style:'title', text:'Platform'}
{type:'text', text:'Rain hammers the canopy of a deserted platform. The waiting room lies north.'}
{type:'text', text:'Exits: north.'}
```

**Input 1 — `N`** (movement, 1 turn; waiting room is lit, not the safe room: nerve −1):
```js
{type:'room', id:'waiting', name:'Waiting Room'}
{type:'picture', id:'waiting_room', graphics:true}
{type:'text', style:'title', text:'Waiting Room'}
{type:'text', text:'A cold waiting room. A hatch in the floor stands open.'}
{type:'text', text:'You can see a brass key, an iron key and a torch here.'}
{type:'text', text:'Exits: south, down.'}
{type:'ambient', id:'none'}                                   // D7: rain -> none
{type:'status', room:'Waiting Room', roomId:'waiting', time:'21:30', score:0, maxScore:10, nerve:9, turns:1}
```

**Input 2 — `TAKE KEY`** (two equally good matches → disambiguation prompt, free; `ctx.pending` is the A3.3 example):
```js
{type:'prompt', kind:'disambig', text:'Which do you mean, the brass key or the iron key?'}
```

**Input 3 — `BRASS`** (answer completes `take brass_key`; UNDO snapshot = state before this line, pending included; 1 turn):
```js
{type:'text', text:'Taken.'}
{type:'sfx', id:'pickup'}
{type:'status', room:'Waiting Room', roomId:'waiting', time:'21:31', score:0, maxScore:10, nerve:8, turns:2}
```
Now `ctx = {it:'brass_key', them:[], npc:null, lastCommand:{verb:'take', verbWord:'take', dobj:'brass_key', raw:'take key'}, pending:null}`.

**Input 4 — `TAKE TORCH THEN SAVE 2 THEN S`** (chain with a barrier: TAKE runs, SAVE is a barrier, S is discarded; the storage request is last):
```js
{type:'text', text:'Taken.'}
{type:'sfx', id:'pickup'}
{type:'text', style:'system', text:'[Your score has gone up by 5 points.]'}   // torch.after.take
{type:'status', room:'Waiting Room', roomId:'waiting', time:'21:31', score:5, maxScore:10, nerve:7, turns:3}
{type:'text', style:'system', text:'(Commands after SAVE were ignored.)'}
{type:'storage', op:'save', slot:2, data:{format:'tallyman-save', game:'mini', contentVersion:'1',
  summary:{room:'Waiting Room', time:'21:31', score:5, turns:3}, state:{v:1, turn:3, roomId:'waiting', /* … */}}}
```

**Input 5 — `D`** (into the dark cellar with the torch off; onEnter's `if` fails; dark: nerve +5):
```js
{type:'room', id:'cellar', name:'Cellar'}
{type:'picture', id:null, graphics:true}                      // unlit, no darkPicture
{type:'text', style:'title', text:'Darkness'}
{type:'text', text:"It is pitch dark. You can't see a thing, but you could feel your way back the way you came."}
{type:'ambient', id:'drone'}
{type:'status', room:'Cellar', roomId:'cellar', time:'21:32', score:5, maxScore:10, nerve:12, turns:4}
```

**Input 6 — `UNDO`** (restores the state from before input 5 — turn 3 — clears the snapshot; refresh bundle):
```js
{type:'clear'}
{type:'room', id:'waiting', name:'Waiting Room'}
{type:'picture', id:'waiting_room', graphics:true}
{type:'ambient', id:'none'}
{type:'music', id:'stop'}
{type:'status', room:'Waiting Room', roomId:'waiting', time:'21:31', score:5, maxScore:10, nerve:7, turns:3}
{type:'text', style:'title', text:'Waiting Room'}
{type:'text', text:'A cold waiting room. A hatch in the floor stands open.'}
{type:'text', text:'You can see an iron key here.'}
{type:'text', text:'Exits: south, down.'}
{type:'text', style:'system', text:'(Undone.)'}
```

Further one-liners from the same position (each from the state after input 6):

| Input | Events | Cost |
|---|---|---|
| `UNDO` | `[{type:'text', style:'system', text:"You can't undo any further."}]` | 0 |
| `xyzzy. n` | `I don't know the word "xyzzy".` (system), then `(Commands after XYZZY were ignored.)` (system) | 0 |
| `again` | repeats `take torch` → `{text:'You already have that.'}` + `status` (turn 4) | 1 |
| `load 2 then n` | `(Commands after LOAD were ignored.)`, `{type:'storage', op:'load', slot:2}`; the host calls `game.load(data)` → refresh bundle at turn 3 | 0 |
| `drop torch` | `Dropped.` + `status` — critical items may be dropped | 1 |
| `throw torch` | `You'd better hang on to that.` + `status` — critical protection (A8.7) | 1 |

---

## A16 Default messages (PLAN §1 "I don't know the word X" vs in-world refusals; §2.4 voice)
`MESSAGES` in `types.js` holds the contract-level texts (parser, resolution, chains,
confirmations, UNDO, darkness, listing, protection, score, engine errors). Placeholders:
`{word}`, `{verbWord}`, `{VERB}` (upper-cased), `{pronoun}`, `{list}`, `{n}`, `{The}`
(capitalised definite name), `{error}`. Action modules define further message ids with
their defaults next to the handler (e.g. `alreadyHave`, `notHolding`, `cantReach`,
`isClosed`, `thrown`, `inedible`, `buyNoSale`, `cantAfford`). Every id — contract or
action — can be overridden through `content.messages[id]`. All messages obey A12.2.
Parser / resolution errors, chain notices, `scoreUp`, `noted`, `undone`, `cantUndo`,
`gameOver`, `slotNeeded` and `engineError` use `style: 'system'`.

---

## A17 Contract decisions (not dictated by PLAN; ticket TT-002 acceptance)

| Id | Decision | Why (one line) |
|---|---|---|
| C1 | Finale state (`pikeState`, `pikeArrivalTurn`, `attack`, `harrowFreed`) lives in content-declared typed `vars`, not hard-coded State fields | Engine stays story-agnostic and testable on mini-worlds; `validateSave` still type-checks it. |
| C2 | One declarative Reaction / Condition language for every content slot; hooks only as an escape hatch | Writers build puzzles without engine code, and data is lintable. |
| C3 | PLAN's topic `{text, sets, requires}` becomes Reaction `{say, setFlag, if}` | One vocabulary everywhere. |
| C4 | `openable` / `open` / `locked` / `keyId` are flat Item fields (PLAN nested them in `container`) | Doors need lock state without being containers. |
| C5 | Text variants instead of `(state) => string` descriptions | Keeps text static for the glyph / length linter; `{hook}` remains. |
| C6 | Flags are boolean-only; typed values go in `vars` | Simple and validatable. |
| C7 | State additions: `visited`, `hintTiers`, `warned`, `fired`, `vars`, `ctx.npc` | Each is needed for a PLAN behaviour and for save determinism. |
| C8 | Resolution failures cost 0 and stop the chain, like parse errors | Generalises PLAN's "ACCUSE not present is free"; no time charged for typos. |
| C9 | Story daemons (D4) sit between NPC schedules and light | The attack counter must see this turn's arrivals, and its lunge must be capped by D6 in the same turn. |
| C10 | Clock, endings check and status run even after a death in the action | The fatal turn was spent; status matches the end screen. |
| C11 | INVENTORY is free; LOOK / EXAMINE cost 1 | Self-information like SCORE / NOTES; PLAN lists only meta commands as free. |
| C12 | Non-answers to a disambiguation run as new commands; non-answers to a confirmation cancel it, then run | One uniform rule; a prompt can never trap the player. |
| C13 | SAVE / EXPORT keep a pending question (and store it); LOAD / UNDO / RESTART replace it | Required for "load of a save holding a pending prompt". |
| C14 | No implicit recency tie-break in disambiguation | Predictable; pronouns give recency explicitly; lint L13 keeps ambiguity rare. |
| C15 | UNDO snapshot = state at the start of the line, committed at the line's first world command | "One whole input line" holds even when UNDO appears mid-chain. |
| C16 | `load()` returns `{ok, error, events}` | The host must tell success from failure without inspecting events. |
| C17 | `restart()` reuses the original seed | Determinism; the host may create a new game for a new seed. |
| C18 | One chain-notice template, `(Commands after {VERB} were ignored.)`, for every stop reason, placed before the terminal event | PLAN's exact barrier text, applied uniformly; terminal event stays last. |
| C19 | The engine never echoes input; `echo` style is the host's | The UI owns the input line. |
| C20 | Descriptions end with an engine-generated "Exits:" line | 8-bit convention and fairness for blind play. |
| C21 | Personal / critical protection runs before any content reaction | PLAN §2.5 guarantees cannot be bypassed by a content slip. |
| C22 | `n` means NO only while a confirmation is open | PLAN's "(Y/N)" prompts vs. the N abbreviation. |
| C23 | Midnight endings come from a required content catch-all (L19), not an engine fallback | Ending text is story; the linter guarantees exhaustiveness. |
| C24 | Exceptions roll the line back; strict mode rethrows | "Never throw on any input" holds even with buggy hooks, while tests still see bugs. |
| C25 | `picture` events carry `graphics` | The UI can tell "no picture" from "GRAPHICS OFF" without its own state. |
| C26 | The current ambient is derived, not stored | Less state; refresh re-sends it. |
| C27 | New module `src/engine/api.js` (HookApi + Reaction runner) | Keeps `game.js` focused; **must be added to TT-008's allow-list**. |
| C28 | VERBOSE is the default | Modern fairness; BRIEF is one command away. |
| C29 | `state.evidence` records items and facts in discovery order; counting re-checks "carried" | PLAN: an item counts while carried; also drives NOTES. |
| C30 | `AMBIENT_IDS` adds `heartbeat` and `counting` to PLAN §3.3's list | PLAN §1 / §2.3 mention heartbeat ambience and intensifying counting. |
| C31 | A hazard's `objects` filter is skipped when the command has no object | SWIM alone must trigger the lock hazard (PLAN "SWIM / ENTER LOCK"). |
| C32 | `Item.alsoIn` for doors and gates | One item visible from both sides without duplicate state. |
| C33 | `turnGte: {var}`, `setVar` `{turnPlus}` / `{add}` | Pike's delayed arrival and the attack counter are pure data. |
| C34 | Syntax layer keeps all phrase words in `words` (no adjective / noun split) | Classification needs world knowledge; the resolver matches against each entity's names and adjectives. |
| C35 | `game.snapshot()` added to the API | Tests and tools need read access without serialising. |
| C36 | Panic, ending and prompts stop the chain; meta commands and in-world failures do not | PLAN's stop list, plus the natural reading that "The door is locked." is not an error. |
| C37 | Self-reference: ME / MYSELF / SELF / YOURSELF bind to the reserved id `player`; commands (and saved `ctx.lastCommand`) may target `player`; EXAMINE ME is content-overridable, other verbs answer harmlessly | Classic IF convention; added in TT-009. |
