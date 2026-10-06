---
id: TT-018
title: Content: Beneath, finale, endings, beats, hints and scoring
milestone: M3
status: done
agent: writer
model: opus
depends: [TT-017]
---
# TT-018 — Content: finale & endings

## Goal
Complete the game: STORY.md §4.6 (Tunnel, Counting Room), §6.3/6.6 Pike & Harrow finale behaviour, §8 (ACCUSE case, Pike state machine, iron door, counting-room attack counter, Harrow bleeding cues, hazards, all endings with final texts), §9 beats & daemons, §10 hints, §11 scoring/ranks, HELP and intro. Remove all stubs.

## File allow-list
`src/content/**` except `src/content/art/**`; `tests/content/*`

## Acceptance criteria
- [ ] `npm run lint:content -- --strict` passes **except** for missing pictures (art arrives in TT-020/021; if strict requires pictures, add a `--allow-missing-art` flag to tools/lint-content.js — allowed edit — and use it in the `check` script until R3; report it).
- [ ] `tests/content/walkthrough-smoke.test.js`: STORY §12.1 full walkthrough wins 100/100 with ending `victory` at the stated turn; §12.2 boiler route wins; each other ending/death script in §12 reaches its ending.
- [ ] Verbatim prose rule as TT-016.
- [ ] `npm run check` green.
