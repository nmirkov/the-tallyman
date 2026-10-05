---
id: TT-022
title: Walkthrough, solvability, save-determinism and fuzz suites
milestone: M3
status: todo
agent: qa
model: opus
depends: [TT-018]
---
# TT-022 — QA suites

## Goal
Prove the finished content is winnable, fair and robust (PLAN §4 table rows Walkthrough, Solvability, Save determinism, Fuzz). Expected outcomes are derived from `docs/STORY.md` and PLAN §2.5 rules, not from implementation output.

## Scope (`tests/walkthrough/`, `tests/fuzz/`)
- Walkthrough: STORY §12.1 wins 100/100 with `victory` at the documented turn; §12.2 boiler route; every other ending and death script in §12.
- Solvability (each a named test): evidence collected in every order permutation (4! = 24, compact scripts); accuse early / late / never (Pike leaves 23:30); both finale routes; cuff-then-free and free-then-cuff; turn 299/300 boundaries (victory on 300 wins; pyrrhic / got-away / fifth-stroke each at 300); leave & re-enter Counting Room (attack counter resumes ≥1); attempts to lose every `critical` item (drop in each hazard room, throw, give to each wrong NPC, put in containers then dispose); **warrant card and money loss attempts** (Codex plan review R3 note 4); panic in every zone + Beneath nerve cap; dark-room entry/exit without light; tunnel refuses entry without light; quarry fall warned then fatal; whisky re-purchase after loss.
- Save determinism: save at ≥ 10 points of the walkthrough → load in a fresh game (different seed) → replay remainder → identical events & final state; saves with pending prompt and after an ending.
- Fuzz: 20 seeds × 2 000 random commands built from vocab + content nouns on the real content; never throws (strict mode), state always passes `validateSave`, undo snapshot bounded.
- Report `docs/QA-REPORT.md`: table of suites, counts, any discrepancies between STORY and behaviour (each discrepancy → also a bug ticket `tickets/TT-1xx-*/ticket.md` from `tickets/TEMPLATE.md`).

## File allow-list
`tests/walkthrough/*`, `tests/fuzz/*`, `docs/QA-REPORT.md`, `tickets/TT-1*` (new bug tickets only)

## Acceptance criteria
- [ ] All suites implemented; failing tests that reveal real bugs are kept but marked `todo` with the bug ticket id (so check stays green) — list them in QA-REPORT.md.
- [ ] `npm run check` green.
