# Orchestrator handover

> Read this first when resuming (after context compaction or in a new session).
> Then read docs/STATUS.md, docs/PLAN.md (approved v1.2), docs/DECISIONS.md, and
> the tickets in `tickets/`. Nenad asked for a fully autonomous build — do not ask
> him questions; decide and log in DECISIONS.md.

## Snapshot — 2026-10-06, M1 review + M3 content/art in parallel
- HEAD: see `git log --oneline | head -3` (last: "chore: register art zone files…"). Tags: `plan-approved`, `m0`.
- Done: TT-001…010 (engine complete), TT-013 audio, TT-015 story, TT-016 town/canal content, TT-019 art style gate (approved). ~1080 tests green.
- **In flight (5 background agents):**
  - TT-101 R1 review fixes (engine-dev/opus) — 9 blocking Codex findings, `reviews/code-review-R1-1.md`.
  - TT-017 content moor/mill/asylum (writer/opus).
  - TT-020a art town+canal → writes `implementation-a.md`; TT-020b art moor/mill/asylum/beneath → `implementation-b.md` (shared ticket TT-020; orchestrator sets status when both done).
  - TT-021 title + ending screens (artist/opus).
- **Next steps:**
  1. When TT-101 lands: verify, commit, launch Codex R1 round 2 (prompt: reviews/code-review-R1-1-prompt.md + "ROUND 2: verify each round-1 blocking item"). On APPROVED → tag `m1`.
  2. TT-017 → TT-018 (finale content). Then TT-022 (QA suites; ticket stub needs full spec, incl. Codex R3 note: warrant-card & money loss tests).
  3. M2 UI after R1 approval: TT-011 terminal, TT-012 integration (allow-list must include src/ui/storage.js), TT-014 boot. Specs still stubs — write full specs from PLAN §3.6/3.7/3.8 + ARCHITECTURE A9/A10.
  4. Known follow-up: `src/content/index.js` loads art with top-level await (TT-016 note) — esbuild iife build can't bundle that once main.js imports content; switch to static import in TT-012.
- Open risks: art quality varies by agent — check screenshots before committing; R1 may need a round 3.

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
