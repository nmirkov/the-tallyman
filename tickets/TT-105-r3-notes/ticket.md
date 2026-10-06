---
id: TT-105
title: Address R3 content review notes
milestone: BUG
status: in-progress
agent: writer
model: opus
depends: [TT-120]
severity: medium
---
# TT-105 — R3 notes

Address all 13 non-blocking notes in `reviews/code-review-R3-1.md`. Priority: (1) the dark re-entry path that kills without the warning (fairness: every death warned once — PLAN §2.5 / STORY §8.4), (2) missing scenery (knife, door, tunic in the Counting Room, any others listed), (3) the "tie a rope" invitation with no TIE verb (add TIE/FASTEN/KNOT with synonyms or rephrase the prose), (4) refresh `docs/QA-REPORT.md` (now 0 todo), (5) the rest. Keep STORY.md in sync for any content change. Regression tests for (1)–(3).

## File allow-list
`src/content/**` except `src/content/art/**`; `src/engine/vocab.js` (verb synonyms only); `docs/STORY.md`, `docs/QA-REPORT.md`; `tests/content/*`, `tests/walkthrough/*`

## Acceptance criteria
- [ ] Each note fixed or explicitly accepted with a reason in implementation.md.
- [ ] `npm run check` green; walkthroughs still 100/100.
