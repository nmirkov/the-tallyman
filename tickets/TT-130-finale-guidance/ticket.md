---
id: TT-130
title: Finale guidance - both blind testers failed to find HANDCUFF PIKE
milestone: BUG
status: done
agent: writer
model: opus
depends: [TT-024]
severity: high
---
# TT-130 — Finale guidance

## Problem (blind playtest, docs/playtest/)
Both testers reached the Counting Room with evidence and handcuffs and tried ACCUSE PIKE ("Prove it" / "Do something."), SHOW LEDGER PAGE TO PIKE, ASK PIKE ABOUT MARY, SAY ..., and got stabbed. HELP teaches ACCUSE as the way to win; the cuffs pointer ("Cuffs, not fists") only appears in the death text. Tester A lost a whole 272-turn run to this.

## Fix (keep the drama, remove the unfairness)
- ACCUSE PIKE in the Counting Room with ≥3 evidence: award the correct accusation (PLAN §2.5 allows it there) and respond with a line that points squarely at restraint (e.g. Harrow: "He knows. Get the cuffs on him!"). If handcuffs carried, consider making ACCUSE + carried cuffs perform the arrest directly (decide; STORY voice).
- SHOW <evidence> TO PIKE / ASK PIKE ABOUT ... in the Counting Room: short, tense replies that also steer to the cuffs.
- Attack-counter warning messages (counter 2 and 4): include a cue toward the cuffs/Harrow's shout.
- HINT in the Counting Room: explicit ("HANDCUFF PIKE" / "CUT CHAINS").
- HELP text: mention ARREST/HANDCUFF alongside ACCUSE.
- Synonyms: ARREST, CUFF, HANDCUFF, RESTRAIN, SUBDUE, TACKLE PIKE → arrest path (TACKLE/SUBDUE without cuffs → pointer).
- Update STORY.md (§8.1, §8.4, §1.7 HELP, §10 hints) and tests: a "blind finale" test replays tester A's attempt-1 finale commands (from docs/playtest/tester-A-log.md) and asserts the player is warned toward the cuffs before death.

## File allow-list
`src/content/**` except art; `src/engine/vocab.js` (synonyms only); `docs/STORY.md`; `tests/content/*`, `tests/walkthrough/*`

## Acceptance
- [ ] Walkthroughs still 100/100; new finale tests; `npm run check` green.
