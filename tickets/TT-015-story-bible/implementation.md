# TT-015 — Implementation notes

## Summary
Wrote `docs/STORY.md` (about 2,130 lines), the complete story bible: premise and the truth, cast (Pike, Harrow,
Maggie, Ashdown, Silas, the mill girl), zones and nerve tuning, per-zone compass maps, an authoritative
exit table, 42 rooms (final prose, scenery, slots, picture briefs, ambient, nerve), 42 items
(the A4.7 fields, read texts, evidence), NPC topic tables with GIVE / SHOW / BUY, a 29-step
puzzle graph with every accepted phrasing, shared reactions, content verbs, the ACCUSE case and
Pike's state machine, the attack counter with its texts, Harrow's bleeding cues, all 8 endings
(with per-suspect and per-state variants), beats, 14 hint steps (3 tiers each), scoring and ranks,
a 91-turn 100/100 walkthrough (plus a 102-turn boiler-room variant and scripts for every ending
and death), a softlock audit, sound cue and picture lists, and a verification log.

## Files changed
- `docs/STORY.md` (new)
- `tickets/TT-015-story-bible/ticket.md` (status -> verify)
- `tickets/TT-015-story-bible/implementation.md` (this file)

## Decisions made (and why)
- **42 rooms**: PLAN's 41 plus `quarry_floor`. The quarry hazard is `unless: {carried: 'rope'}`, so
  going down with the rope needs somewhere to arrive. It's optional, its `u` exit is unconditional,
  and the rope is `critical` so the room can't be lost.
- **No hooks.** A tool's `before.use` / `before.put` checks whether its target is present
  (`{present: ...}`) instead of looking at the indirect object, which Conds can't see. Each
  tool has at most two targets in the game. The harmless edge cases are documented in §7.3.
- **Why the iron door opens**: the bar is on the Counting Room side. Pike gets in through his own
  padlocked trap in the counting-house floor, which never opens for the player, and lifts the bar
  so he can leave by tunnel, asylum and moor. That escape route is also what the got-away ending
  uses. Six in-world pointers are listed in §8.3.
- **The tunnel's `n` exit also requires `{lit: true}`, and the first TURN OFF TORCH in front of
  Pike is a warning that uses up the turn.** Without these, the dark branch of the attack counter
  could kill the player with no warning, which breaks the "every death warned" rule. As a result,
  the "dark warning at 1" text can no longer be reached. It stays in the data for contract
  completeness.
- **The lock has no `in` exit.** C31 skips the object filter when a command has none, so a bare
  ENTER at the lock is the drowning hazard. The warning text points north to the cottage.
- **Batteries are moved to `null` when loaded, and the torch is not a container.** This avoids
  the batteries showing up in room listings and a `torch.before.put` slot that would fire when the
  torch is the direct object.
- **Pike's `left` delay is 10 turns** (he leaves at 240 and arrives at 250, 23:35). This leaves
  50 turns for a player who never accuses him.
- **Money invariant:** until Silas has his whisky, pints need at least 260p and the 10p from
  Maggie's till at least 210p, so 200p is always left for the whisky.
- **Pike's age is 26**, to fit PLAN's "as a boy... 1971-75". This keeps the asylum's adolescent
  ward and "the boy who counted" consistent.

## How verified
- A Python check over STORY.md (scratchpad `verify.py`): 42 rooms in both §3.3 and §4; 0
  non-reciprocal exits; 42 of 42 rooms reachable; 51 description variants, all <= 300 characters
  (longest 251); game text is ASCII plus `£`; the walkthrough's 91 lines replay over the exit
  table and every table row's room matches; ending lengths are 673-825 (deaths 410-505).
- Hand-checked: the 13 awards sum to 100, and the running score in the walkthrough reaches 100
  on turn 91. Turn and arrival arithmetic follows A7.6 (`turnPlus` is evaluated on turn k-1).
- `npm run check` (provisional, run while other agents were working):
```
# tests 782
# pass 782
# fail 0
build: wrote dist/tallyman.html (966 bytes)
```

## Known gaps / follow-ups
- For TT-016...018: the content verbs `pry`, `replace`, `pour`, `pray`, `knock` and the extra
  pattern `open {dobj} with {iobj}` need the engine to accept `content.verbs` pattern additions
  for existing verb ids (VerbDef allows this; please confirm in TT-005/007).
- Expected L21 warnings: `lock` (a noun of `lock_water`) and `oil` (from `oil can`) are also verb
  words. This is accepted.
- Exact nerve values along the walkthrough and the text of RNG-driven beats can only be checked
  once the engine exists (TT-022).
- The 10p fallback reads `{at: ['coin', null]}`. This assumes A4.4 `at` accepts `null`, as the
  table says it does.
