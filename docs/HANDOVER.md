# Orchestrator handover

> Read this first when resuming (after context compaction or in a new session).
> Then read docs/STATUS.md, docs/PLAN.md (approved v1.2), docs/DECISIONS.md, and
> the tickets in `tickets/`. Nenad asked for a fully autonomous build — do not ask
> him questions; decide and log in DECISIONS.md.

## Snapshot — 2026-10-06, M2 integration + softlock fixes
- Tags: `plan-approved`, `m0`, `m1`. ~1700 tests green (9 todo = known softlocks).
- **Codex is out of credits** (D-009): reviews use an independent Claude reviewer (model fable, fresh context, writes only reviews/<name>.md). Retry Codex at each milestone: `codex exec ... -m gpt-6-astra` (check log tail for "out of credits").
- Done: TT-001…022 except TT-012/014/023/024/025; TT-101/102/103 (R1 fixes). Art complete (42 + dark + title + 6 endings).
- **In flight:** TT-012 browser integration (ui-dev/opus); TT-120…123 softlock fixes (engine-dev/opus; one implementation.md in TT-120 folder).
- **Next:** commit both (check each's files; TT-012 owns src/ui/** + src/content/index.js) → TT-014 boot (spec ready) → R2 review (M2: src/ui/**, audio) → R3 review (M3 content+QA) → TT-023 smoke (spec ready) → TT-024 blind playtest (spec ready; clean-context testers!) → TT-025 docs → R4 → tag v1.0.
- Art polish candidates (weak): crypt, vestry, police_house, cells, number_13, entrance_hall, boiler_room, moor_road; ending_death cone; victory cars.
- Lesson: never wait on a process with `pgrep -f <pattern>` inside a loop whose own command line contains the pattern — wait on the PID.

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
