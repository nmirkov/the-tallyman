---
id: TT-024
title: Blind AI playtest and bug fixing
milestone: M4
status: in-progress
agent: qa
model: opus
depends: [TT-023]
---
# TT-024 — Blind playtest

## Goal
Find out how the game plays for someone who knows nothing (PLAN §4 AI playtest row; Codex plan-review R3 note 8: **clean context — this ticket overrides the generic dispatch template**).

## Protocol
- Two blind testers, each a fresh agent whose prompt contains ONLY: how to run `node tools/play.js` interactively-by-script (feeding command batches via `--script` + replaying with save/load), that it is a 1984-style text adventure, and the instruction to play to the end like a real player. They must NOT read any file in the repo other than running the player and their own notes in the scratchpad (no PLAN, STORY, ARCHITECTURE, src, tests, tickets).
- Tester A: thorough explorer. Tester B: impatient player who uses HINT when stuck.
- Each logs: every command; every "I don't know the word" / unhelpful refusal where a reasonable player expected something to work; confusion points; turns used when they first reached each zone; whether they won and at what turn; prose that repeats too often; anything that felt unfair.
- The orchestrator (not the testers) converts findings into bug tickets `TT-13x` (severity high/medium/low), fixes high/medium via owner agents, re-runs affected suites.
- Timer judgement (D-007): compare blind turns-to-finish with the 300-turn limit; adjust in DECISIONS.md if needed.

## Deliverables
`docs/PLAYTEST-REPORT.md` (both testers' findings + orchestrator triage), bug tickets, fixes.
