---
id: TT-009
title: NPC conversation, evidence, notes, accusation and adaptive hints
milestone: M1
status: todo
agent: engine-dev
model: opus
depends: [TT-008]
---
# TT-009 — Case & NPC mechanics

## Goal
Implement the detective layer generically (data-driven), per PLAN §2.5 and ARCHITECTURE.md.

## Scope
- `src/engine/actions/npc.js`: TALK TO, ASK X ABOUT Y, TELL X ABOUT Y, SHOW X TO Y, GIVE X TO Y (NPC `accepts` hooks; wrong recipient refusals; critical items cannot be given to the wrong NPC), BUY X (from an NPC that sells it, money balance in pence, `£` formatting).
- `src/engine/actions/case.js`: NOTES (lists notes + evidence with labels), evidence counting (items carried + facts noted), ACCUSE with: not-present refusal (free), confirmation prompt for wrong suspects (pending confirm — YES ends, anything else cancels free), correct-suspect with threshold → content hook, below threshold → content hook. The *story-specific* outcomes are hooks supplied by content; the engine supplies the generic machinery. HINT: content supplies an ordered list of hint steps each with a `done(state)` predicate key and text tiers; HINT shows the first not-done step's next tier and costs points per contract (score floor 0).
- Personal effects (`fixed to player`) and critical-item refusal messages for DROP/GIVE/THROW/EAT/DRINK into water etc. (generic, message overridable by content).
- Tests on mini-world (extend fixture with 2 NPCs, evidence, hints): every branch.

## File allow-list
`src/engine/actions/npc.js`, `src/engine/actions/case.js`, `src/engine/actions/index.js` (registration only), `tests/unit/actions-npc.test.js`, `tests/unit/actions-case.test.js`, `tests/fixtures/*` (additive)

## Acceptance criteria
- [ ] All §2.5 ACCUSE rules covered by tests with the fixture.
- [ ] `npm run check` green.
