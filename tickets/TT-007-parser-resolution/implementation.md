# TT-007 implementation

## Summary
`src/engine/resolve.js` binds TT-005 parsed commands to world ids, following ARCHITECTURE A6.3–A6.7, A3.3, A7.3 and A8.1. It covers:
- M1/M2 word matching, including the adjective-only retry
- M3 scope: visible ids, plus BUY's sold items and TAKE … FROM Y's contents
- M4 narrowing: whole name, then items/NPCs over scenery, then `prefer`; no recency (C14)
- M5 disambiguation prompts and M6 errors
- pronouns, ALL / EXCEPT / lists (with a list-element prompt that carries `index`)
- AGAIN, M7 topics, and disambiguation and confirmation answers

The resolver is pure: it never writes state. The one exception is `recordExecuted`, which updates `ctx` after a command runs. Results are plain JSON. No function throws.

## Interface for TT-008 (also documented at the top of resolve.js)
```
Result = {ok:true, command} | {ok:false, message, params, text?} | {pending: PendingDisambig}
resolve(parsed, state, content, vocab?, callHook?)        → Result
answerPending(segment, state, content, vocab?, callHook?) → Result
                                                            | {notAnswer:true, barrier:true}
                                                            | {notAnswer:true, cancel?}
                                                            | {ok:false, cancelled:true, message:'confirmCancelled', params, text?}
repeatLast(state, content, vocab?, callHook?)             → Result          (AGAIN)
recordExecuted(state, content, command, vocab?)           → void            (sets it/them/npc/lastCommand)
matchTopic(text, content) → TopicId|null;  parseErrorResult(parseError) → error Result
```
**Results**
- `message` is a `MESSAGES` id, which `content.messages` can override. `params` fills its placeholders.
- `text` appears only when the verb has its own `notHere` (ACCUSE). In that case say `text` instead of the message.

**How the game loop uses them (A7.1 step 6)**
1. **Answering a pending question** (first segment only, while `ctx.pending` is set): call `answerPending` first.
   - `barrier` → leave the pending alone; the barrier decides what happens to it (A7.3).
   - `notAnswer` → set `ctx.pending = null`, say `cancel` if present, then parse the segment as a new command.
   - `cancelled` → clear the pending, say the message, STOP.
   - anything else → clear the pending, then handle it exactly like a `resolve()` result.
2. **Resolving a command:** `resolve()` maps ParseErrors to their messages (`unknownWord {word}`, `noVerb`, `missingNoun {verbWord}`, `noPattern`, `empty`) and passes `again` on to `repeatLast`.
3. **Storing a question:** set `state.ctx.pending = r.pending` and emit `{type:'prompt', kind:'disambig', text}`.
4. **After any executed world or meta command:** call `recordExecuted`.

## Files changed
- `src/engine/resolve.js` (new)
- `tests/unit/resolve.test.js` (new, 38 tests)
- `tickets/TT-007-parser-resolution/ticket.md` (status: verify)
- `tests/fixtures/*` were not changed. The look-alike entities live in a derived world inside the test file.

## Decisions made (with why)
1. **Extra trailing `callHook` argument and extra exports.** These are additive to the A1 signatures. `callHook` is only passed on to `world.scope()`, wrapped in a try/catch, and is used there for hook-conditioned exits. Resolution itself never runs hooks.
2. **`answerPending` checks barrier verbs (CHAIN_BARRIERS or class `system`) before checking for an answer.** It then returns `barrier: true`, so SAVE/EXPORT keep the pending and no cancel text is shown for a confirmation (A7.3, C13).
3. **Error wording:**
   - M6 `tooDark` applies only to noun phrases that match nothing.
   - A pronoun whose antecedent is not visible, and AGAIN with a vanished id, give `notHere` (A6.4 / A6.6 literally). The verb's `notHere` override still applies.
4. **THEM:** uses the visible subset. When that is empty it falls back to IT. Errors:
   - `them` and `it` both unset → `pronounUnset {pronoun:'them'}`
   - otherwise → `notHere`
   - more than one object with a non-multi verb → `oneAtATime`
5. **EXCEPT:** a phrase removes every M2 match, so `take all except key` removes both keys without a prompt. A phrase that matches nothing → notHere/tooDark.
6. **ALL expansion:**
   - It is intersected with visibility, so TAKE ALL FROM a closed crate → `allNothing`.
   - Content `multi` verbs use the drop/put rule (carried items) when `prefer: 'carried'`, and the take rule otherwise.
7. **Lists:**
   - Duplicates are removed. A list that reduces to one object becomes a plain id.
   - `all` is set only for ALL, per the `Command.all` typedef. TT-008 decides whether list output also gets per-object prefixes.
   - A prompt for a list element stores `bound.dobj` = the ids resolved so far plus `index`. Resolution resumes at `index + 1` once the element is answered.
8. **M4(b) "scenery" means room scenery entries (`room#n`).** Items flagged `scenery: true` count as items.
9. **`one` handling.** `one` is dropped from ordinary phrases when other words remain (`take the brass one`). Pure ordinal answers only; an out-of-range ordinal is not an answer. Ordinals index the current (possibly re-asked) candidate list.
10. **Prompt text.** It uses `content.messages.disambig` when that exists, and is stored un-normalised. The game normalises on emit (A7.1 step 8), so re-emission stays verbatim. Proper NPCs get no "the". Scenery entries show as "the <first name>".
11. **Topics.** `content.topics` keywords are checked in declaration order, then item names, then NPC names, as whole-word sequences. `topicText` keeps the raw parser text.
12. **`recordExecuted` details:**
    - `them` is replaced only by a non-empty array.
    - An item iobj sets nothing; an NPC iobj sets `npc`.
    - `lastCommand` is a deep copy without `confirmed`. It is skipped for barriers, system-class verbs, `again`, `yes` and `no`.
13. **Never throw.** Every entry point is wrapped. An internal exception becomes `{ok:false, message:'engineError', params:{error}}` instead of a throw. The property test asserts this never happens for parser output.

## How verified
- Test-first: the suite failed (module missing), then passed.
- `node --test tests/unit/resolve.test.js` gives 38/38. The tests cover:
  - every M-rule, including each M4 step on its own
  - prompts with 2 and 3 candidates, a proper NPC, and a `content.messages` override
  - answers: adjective, adjective+noun, fillers/`one`, ordinals, re-ask with a subset, non-answers, barriers
  - prompts on the iobj and then the dobj
  - a list-element prompt, including a save mid-list
  - SAVE while pending: serialise → validateSave → answer
  - confirm YES/Y/NO/N/other, with and without `cancelText`
  - all pronoun branches, ALL/EXCEPT/lists, BUY and TAKE-FROM scope, darkness, hidden items, closed and transparent containers, NPC-held items
  - topics, AGAIN, `recordExecuted`, the A15 inputs 2–3 ctx, and ParseError mapping
  - garbage arguments
  - a 2500-case property test, which asserts JSON results, valid ids, save round-trip of prompts, and coverage of every result kind
- D1 grep: resolve.js has no `Math.random`, `Date`, `console` or Node imports. It imports only types, vocab, parser and world (D4 order).
- `npm run check` tail:
```
lint:content src/content: 0 error(s), 1 warning(s)
# tests 640
# suites 20
# pass 640
# fail 0
build: wrote dist/tallyman.html (966 bytes)
```

## Known gaps / follow-ups
- **A1 table:** it still lists the 4-argument `resolve` / `answerPending` and none of `repeatLast`, `recordExecuted`, `matchTopic` or `parseErrorResult`. The orchestrator may want to update it.
- **Strict mode (A7.9):** because the resolver catches its own exceptions, `strict: true` will show a resolver bug as an `engineError` result instead of a rethrow.
- **Topics** match on `names` only, not adjectives, per A4.9.
- **Parser gap (from TT-005):** `climb north` still gives dobj `north`, which resolves to notHere.
