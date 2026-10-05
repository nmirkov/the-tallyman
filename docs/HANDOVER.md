# Orchestrator handover

> Read this first when resuming (after context compaction or in a new session).
> Then read docs/STATUS.md, docs/PLAN.md (approved v1.2), docs/DECISIONS.md, and
> the tickets in `tickets/`. Nenad asked for a fully autonomous build — do not ask
> him questions; decide and log in DECISIONS.md.

## Snapshot — 2026-10-06, during M1
- HEAD: TT-007 commit (`git log --oneline | head`). Tags: `plan-approved`, `m0`.
- Done: TT-001…TT-007, TT-013. Tests: 640 green.
- In flight: TT-008 game loop & core actions (opus), TT-015 story bible (opus).
- Next: TT-009 → TT-010 → R1 Codex review (M0+M1 diff `m0~` … actually `plan-approved..HEAD`).
  After TT-015: TT-019 art style gate (needs full ticket spec). M2 UI (TT-011) after R1.
- Pending small items: none.

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
