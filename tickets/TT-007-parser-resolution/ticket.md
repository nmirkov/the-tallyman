---
id: TT-007
title: Parser resolution — bind noun phrases to world objects, disambiguation, pronouns, ALL, AGAIN
milestone: M1
status: todo
agent: engine-dev
model: opus
depends: [TT-005, TT-006]
---
# TT-007 — Parser resolution

## Goal
Bind TT-005's unresolved commands to concrete ids using `world.scope()`; manage `state.ctx` (it/them/lastCommand/pending) per ARCHITECTURE.md.

## Scope
- `src/engine/resolve.js`: score candidates by noun match (all words of multiword names) and adjectives per ARCHITECTURE.md A6.3 (C14: no implicit recency tie-break); exact single match → bind; several equally good → **disambiguation prompt** ("Which do you mean, the brass key or the iron key?") stored in `ctx.pending` (free); next input answering with an adjective/noun/ordinal completes it, anything else is treated as a new command (pending cleared). `IT/THEM/HIM/HER` → `ctx.it/them`; pronoun without antecedent → "I'm not sure what 'it' refers to." `ALL` / `ALL EXCEPT X` expand per verb (take: portable visible items not carried; drop: carried). AGAIN semantics exactly per ARCHITECTURE.md. Not-in-scope known noun → "You can't see any such thing." Topics for ASK/TELL are passed through as text + matched topic id against NPC topic keywords.
- Tests `tests/unit/resolve.test.js` on mini-world: every branch above, prompt persistence through serialise/load, SAVE while pending per contract.

## File allow-list
`src/engine/resolve.js`, `tests/unit/resolve.test.js`, `tests/fixtures/*` (additive only)

## Acceptance criteria
- [ ] All behaviours above covered by tests; never throws.
- [ ] `npm run check` green.
