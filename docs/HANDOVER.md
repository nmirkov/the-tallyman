# Orchestrator handover

> Read this first when resuming (after context compaction or in a new session).
> Then read docs/STATUS.md, docs/PLAN.md (approved v1.2), docs/DECISIONS.md, and
> the tickets in `tickets/`. Nenad asked for a fully autonomous build — do not ask
> him questions; decide and log in DECISIONS.md.

## Snapshot — 2026-10-06 03:35, paused (Claude spend limit hit; resets 03:40 Europe/Belgrade)
- HEAD `4ab05da` (TT-023), working tree clean. Tags: plan-approved, m0, m1, m2, m3. 1846 tests green; `npm run smoke` 8/8.
- Codex still out of credits (D-009) -> fallback reviewer (model fable).
- **Game is complete and winnable** (browser + terminal). Blind playtest done: both testers won (A 100/100 on 2nd try, B 89/100), 8/10.
- **Remaining work (in order):**
  1. TT-130 finale guidance (high) then TT-131 playtest parser/content gaps (medium) — specs ready; agent was killed by the spend limit before writing anything. Re-dispatch one writer+engine agent (opus) for both.
  2. TT-132 R2 UI notes (low, sonnet).
  3. Re-run `npm run smoke`; quick re-playtest of the finale (fresh blind agent, finale only).
  4. TT-025 final docs (README: how to play, commands, credits incl. font8x8 public domain), final progress page.
  5. R4 final review (fallback reviewer unless Codex has credits), then tag `v1.0`.

## How the orchestrator works
1. Dispatch: `Agent(subagent_type: general-purpose, model: <ticket model>)`, prompt =
   role file path + ticket path + context sections + "never git" + "≤200-word summary".
2. Verify: `git status --short`, `npm run --silent check`, read implementation.md,
   spot-check key files, look at screenshots for UI tickets.
3. Commit: set ticket `status: done`, `npm run progress` (once TT-004 exists), stage
   only that ticket's files + docs, message `TT-xxx <imperative>` + Co-Authored-By
   trailer; then `tools/verify-commit.sh` (clean worktree check).
4. Milestone: Codex review (canonical invocation in reviews/plan-review-*-prompt.md
   pattern: `codex exec -C . -s read-only --skip-git-repo-check -m gpt-6-astra -c
   model_reasoning_effort=high -o reviews/<name>.md - < prompt.md`, run in background,
   verify log grows), record in docs/REVIEWS.md, fix tickets, tag `m<n>`.

## Open risks / notes
- Codex review notes to honour are tracked in docs/REVIEWS.md (round 3 table).
- Project subagent types in `.claude/agents/` are not registered with the Agent tool in
  this session; use general-purpose + "read your role file".
