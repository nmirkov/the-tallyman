---
id: TT-010
title: Daemons — clock, beats, schedules, nerve/panic, endings precedence, scoring
milestone: M1
status: in-progress
agent: engine-dev
model: opus
depends: [TT-009]
---
# TT-010 — Daemons

## Goal
The per-turn systems in the exact order of ARCHITECTURE.md's turn pipeline, data-driven from content.

## Scope
- `src/engine/daemons.js`: clock (turn → time, midnight at MIDNIGHT_TURN), scripted beats (content: `{atTurn | when(flag), once, text, sfx, hook}`), NPC schedules (`{at, to}` + hook-driven moves such as delayed arrival), light (fuel decrement for lit sources, cosmetic flicker beat hook), nerve (room `nerve` delta, dark-without-light delta, safe-room/lit decay, cap rules per zone e.g. Beneath cap 99 no panic), panic (flee to zone safe room, reset, cooldown), ambience (emit `ambient` on zone/room change), generic turn-counter hooks (used by content for the attack counter), endings check with precedence from PLAN §2.5 (death > victory > midnight endings) — conditions supplied by content as ordered predicate hooks; `end` event with score, rank (ranks from content scoring table).
- Scoring: `award(id)` once-only, score clamp, rank table.
- Status event after every turn (room name, time, score, nerve, turns).
- Tests: `tests/unit/daemons.test.js` — order of operations, turn 299/300 boundary with a fixture "victory on 300" and "midnight on 300", panic in a fixture zone, cap zone, cooldown, schedule moves, save → load → identical continuation (save-determinism over 50 random turns on the fixture with RNG beats).

## File allow-list
`src/engine/daemons.js`, `src/engine/game.js` (wire daemons only), `tests/unit/daemons.test.js`, `tests/unit/determinism.test.js`, `tests/fixtures/*` (additive)

## Acceptance criteria
- [ ] Ending precedence & midnight boundary tests pass.
- [ ] Save-determinism test passes.
- [ ] `npm run check` green.
