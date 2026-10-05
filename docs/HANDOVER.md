# Orchestrator handover

> Read this first when resuming (after context compaction or in a new session).
> Then read docs/STATUS.md, docs/PLAN.md (approved v1.2), docs/DECISIONS.md, and
> the tickets in `tickets/`. Nenad asked for a fully autonomous build — do not ask
> him questions; decide and log in DECISIONS.md.

## Snapshot — 2026-10-05, during M0
- HEAD: `12cacb8` (TT-001 committed, verified in clean worktree). Tag `plan-approved` on the plan commit.
- In flight (background agents, general-purpose type with role files from `.claude/agents/`):
  TT-002 engine contract (opus), TT-003 screen renderer (opus), TT-004 progress page (sonnet).
- Next: verify + commit each of TT-002/003/004 separately; review ARCHITECTURE.md
  against PLAN §2.5/§3.4a (orchestrator approval gate); then M1: TT-005 & TT-006
  (parallel, both depend on TT-002), TT-015 story bible in parallel; then TT-007 → 008 → 009 → 010; then R1 Codex review.

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
