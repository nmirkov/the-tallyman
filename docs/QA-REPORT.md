# QA report (TT-022)

**Date:** 2026-10-06 · **Agent:** qa · **Content:** `src/content/index.js` (42 rooms), strict mode
**Rule of evidence:** every expected value comes from `docs/STORY.md` (§7, §8, §12, §13) and PLAN
§2.5, never from what the engine happens to print.

## Suites

| Suite | File | Tests | Pass | Todo (bug) | What it proves |
|---|---|---|---|---|---|
| Walkthrough | `tests/walkthrough/walkthrough.test.js` | 36 | 36 | 0 | §12.1 row by row (room, turn, running score, notes, evidence count, money/flags/Pike/counter checkpoints) → `victory` 100/100, Chief Inspector, turn 91, 22:15; §12.2 boiler route row by row → victory turn 102; every §12.3 outcome (free-then-cuff, pyrrhic, got away, fifth stroke ×2, wrong man ×3, cancel, weak, absent, drowning ×7 phrasings, quarry, rope, Pike lit / dark, no cuffs, town panic) |
| Solvability | `tests/walkthrough/solvability.test.js` | 210 | 201 | 9 | evidence in all 24 orders (accuse after any 3, then win); accuse early / on turn 240 / too late / in the Counting Room / never (minimum §7.1 win, 35 pts); both finale routes; cuff↔free and fetch-later orders; last-moment arrest; turn 299/300 for victory (×2), pyrrhic, got away, fifth stroke, death-beats-midnight; leave & re-enter counter; loss attempts for all 12 critical items (throw in 5 sinks, drop in 5 sinks, eat/drink/break/burn/tear/cut, give to each wrong NPC ×3 phrasings, containers then dispose); warrant card & wallet everywhere; money floor before the whisky; whisky re-purchase; panic in all 5 zones + cooldown; Beneath cap 99 (tunnel, Counting Room with counter); dark rooms ×5; Beneath light gates; hazards; §13 spot checks |
| Save determinism | `tests/walkthrough/save-determinism.test.js` | 37 | 37 | 0 | saves at 14 walkthrough points (SAVE-command data and `game.save()`), loaded into a game built with another seed, replayed → identical per-command events and final state; RNG-heavy stretches (pyrrhic 210 waits, 300-wait fifth stroke, boiler route); pending ACCUSE confirmation (YES / NO), pending disambiguation, pending RESTART; saves after victory / death / wrong man; 9 corrupt saves rejected atomically (state + UNDO untouched) |
| Fuzz | `tests/fuzz/fuzz.test.js` | 21 | 21 | 0 | 20 seeds × 2 000 commands (40 000 inputs) from engine vocab + every content noun / topic, chains, overlong lines, `null`, SAVE/LOAD/EXPORT/IMPORT via a host emulator; later seeds start deeper in the walkthrough. Per input: no throw (strict), event well-formedness + A12.2 glyphs, `validateSave` ok, JSON round-trip, save ≤ 256 KiB (max seen ≈ 4 KB), one-level UNDO (second UNDO refused, state unchanged), §13 invariants (no critical item destroyed except the designed consumptions; money ≥ 200p until Silas has the whisky; card and wallet always carried). 20/20 seeds reached turn 300; all 42 rooms visited (the last three seeds start in the tunnel / Counting Room) |

`npm test` adds ~16 s in total (fuzz ≈ 10–14 s).

## Bugs found (each kept as a `{ todo: 'TT-1xx' }` test so `check` stays green)

| Ticket | Severity | Finding | Todo tests |
|---|---|---|---|
| [TT-120](../tickets/TT-120-items-lost-in-the-dark/ticket.md) | **high** (unwinnable) | Items dropped in an unlit room are out of scope (A8.1). For the torch (switched off) or the batteries (before loading) that is permanent: no other light, no second packet. Repro: `w, take torch, e, n, n, w, show card to maggie, e, n, ne, n, d, drop batteries` → never retrievable. Same for the torch in the crypt, boiler room, tunnel. Violates PLAN §2.5 "always retrievable", STORY §13. | 4 |
| [TT-121](../tickets/TT-121-dark-tunnel-trap/ticket.md) | **high** (softlock until midnight) | Walk out of the Counting Room without the torch (§12.1 #1-90, `drop torch`, `s`): in the dark tunnel north needs `{lit: true}` (of the tunnel), south/up are blocked by the darkness rule, Beneath never panics. Violates STORY §3.3 "darkness never traps the player". Refusal text also wrong when Pike is cuffed. | 2 |
| [TT-122](../tickets/TT-122-counting-room-entered-dark/ticket.md) | medium | Leaving the lit torch in the tunnel satisfies the north exit's `{lit: true}`, so the Counting Room is entered dark (§12.1 #1-88, `drop torch`, `n`) - contradicts STORY §3.3/§8.4 "only ever entered with a light"; the dark branch is reached without the TURN OFF warning (one "One..." warning, then fatal). | 1 |
| [TT-123](../tickets/TT-123-gate-item-dropped-behind-gate/ticket.md) | medium | Gate items dropped behind their own gate: room key left in Harrow's room → locked out for good; rope left on the quarry floor → only the fatal fall leads back. Violates PLAN §2.5 "no room ever becomes permanently inaccessible", STORY §13 (rope). Both rooms optional. | 2 |

## STORY vs behaviour: notes without a ticket

- **Pike's flight delay.** PLAN §2.5 says Pike reaches the Counting Room "5 turns later"; STORY
  §8.2/§12.1 define arrival as `accuse turn - 1 + 5` (accuse on turn 64 → arrives on turn 68, 4
  commands later). The engine matches STORY exactly; STORY is explicit, so no bug — recorded so
  the wording can be aligned in TT-025.
- **Panic in the canal zone** is unreachable in normal play (no dark room; lock +1 nerve cancels
  the lit −1), so the canal test starts at nerve 100 by a save edit. Not a bug — the rule works
  when it triggers.
- **`quarry_edge` scenery** (incidental, not from these suites): "lip" in the description has no
  scenery entry and "edge" is unknown ("jump off edge" → "I don't know the word"). Passed to TT-024's
  blind-playtest vocabulary audit (STORY §0 scenery coverage).

## Everything else matched STORY

All 91 §12.1 rows (room / turn / score), all 19 §12.2 rows, every §12.3 outcome with its turn
and score, PLAN §2.5 endings precedence at 299/300 (victory on 300 wins; death beats midnight),
the attack counter (pauses outside, +1 on re-entry, cannot be cheated by in-and-out), critical /
personal protection texts (A8.7), the money floor (pints stop at 250p, change at 200p), Beneath
nerve cap 99 with one cap message, and save/load determinism across seeds.
