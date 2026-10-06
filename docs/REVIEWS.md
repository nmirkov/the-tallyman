# Cross-vendor reviews (Codex `gpt-6-astra`, reasoning high)

Raw transcripts live in `reviews/` (git-ignored). This file is the committed record.

## Plan review

### Round 1 — 2026-10-05 — CHANGES REQUIRED
| # | Blocking finding | Resolution (PLAN v1.1) |
|---|---|---|
| 1 | Delivery gates not executable from the start; review gates missing deps; no rule after 3 failed rounds | Minimal build + `npm run check` in TT-001; R1/R3/TT-023 deps fixed; "stay blocked, re-plan, never tag" rule (§6.2) |
| 2 | Engine contract undefined before consumers | New TT-002 (ARCHITECTURE.md + types.js); §3.4a: single item-ownership source, immutable content/hooks, ctx in state, turn costs, chains, daemon order, UNDO, storage protocol, full refresh |
| 3 | Accusation/finale state machine ambiguous | New §2.5: evidence ids (items vs facts), Pike schedule, barred door, attack counter, restraint, endings precedence incl. turn 300 |
| 4 | No resource-recovery policy, weak softlock checks | §2.5 resource policy: non-exhaustible light, `critical` items, panic → safe rooms + cooldown, no one-way exits; §4 solvability suite |
| 5 | Offline persistence vs `file://` | §3.8 storage adapter with try/catch, in-memory fallback, EXPORT/IMPORT files; TT-023 tests `file://`, offline, storage-throws |

Non-blocking notes adopted: ticket splits (parser syntax/resolution, actions/case, terminal/integration, art style gate), shared-file ownership, parser conventions list, clue fairness + adaptive hints, save-determinism tests, 40×25 screen-art format, audio audition gate, DOM transcript & reduced motion, clean-context blind QA, richer handover.

### Round 2 — 2026-10-05 — CHANGES REQUIRED
Round-1 items 1, 3, 5 RESOLVED; 2 and 4 partially.
| # | Blocking finding | Resolution (PLAN v1.2) |
|---|---|---|
| 1 | LOAD/UNDO inside chains; refresh omits pending prompt & ended state | Chain barriers (§3.4a), storage request as last event, failure leaves state untouched; refresh re-emits prompt / end; host protocol for EXPORT/IMPORT/settings; required tests |
| 2 | Money unprotected; no panic destination for Beneath | Money as non-droppable balance, warrant card non-droppable, whisky re-purchasable; panic disabled in Beneath (nerve cap 99), tests |

Non-blocking adopted: incremental vs `--strict` content lint with stubs; provisional vs authoritative checks; docs ownership exceptions; ambiguity lint rule; ALL/AGAIN semantics; schema completeness list; attack-counter entry rule; Harrow bleeding cues; persistence acceptance via EXPORT/IMPORT; glyph normaliser + `£` glyph; QA against story rules.

### Round 3 — 2026-10-05 — **APPROVED WITH NOTES**
All blocking items resolved. Notes and where they are handled:
| Note | Handling |
|---|---|
| Test warrant-card and money loss attempts explicitly | TT-022 acceptance criteria |
| Verify each commit with only its committed deps present | `tools/verify-commit.sh`: after each commit, clean `git worktree` at HEAD → `npm run check` (orchestrator) |
| Consolidate contract: restart(), host events, ending text, attack-counter placement, SAVE/LOAD while prompt pending | TT-002 acceptance criteria |
| Explain why the barred door opens; make cuffs discoverable before the finale; judge timer by blind play | TT-015 acceptance criteria; TT-024 measures blind turns-to-finish |
| Blind QA must override the generic dispatch template | TT-024 ticket explicitly: no PLAN/STORY/ARCHITECTURE/source pointers |
| Carry screenshot review through wrapping, paging, phone keyboard | TT-011/TT-023 acceptance criteria |
| Audio quality is a known limitation of autonomous build | Accepted; `tools/audio-demo.html` for Nenad to audition |

## Code review R1 (M0 + M1, `plan-approved..91da154`)

### Round 1 — 2026-10-06 — CHANGES REQUIRED
9 blocking: critical items destroyable via container; exit-condition exceptions swallowed; nested endings overwritten; unreachable items manipulable inside closed containers; stale presentation after non-action lighting changes; hooks lose current command; malformed pending commands pass save validation; API mutations can commit unsavable states; terminal save failures crash. → Fix ticket **TT-101**.

### Round 2 — 2026-10-06 — CHANGES REQUIRED
All 9 round-1 findings RESOLVED (reproductions re-run by Codex). 2 new blocking: reveal-list loops continue after a nested death; strict-mode rethrow happens before state/UNDO rollback. → **TT-102**.
