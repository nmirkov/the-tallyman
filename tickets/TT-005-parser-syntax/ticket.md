---
id: TT-005
title: Parser syntax layer — tokenise, normalise, match grammar
milestone: M1
status: done
agent: engine-dev
model: opus
depends: [TT-002]
---
# TT-005 — Parser syntax

## Goal
Turn a raw input line into a list of *unresolved* commands (verb + noun phrases + prepositions), with no world knowledge. PLAN §1 (parser pillar), §3.4a (chains), ARCHITECTURE.md parser sections.

## Scope
- `src/engine/vocab.js`: verbs with synonyms (classic set + story verbs: BUY, DRINK, CALL/PHONE/DIAL, ACCUSE, ARREST/CUFF/HANDCUFF, SHOW, GIVE, ASK/TELL…ABOUT, TALK TO, CUT, TEAR/RIP, OPEN/CLOSE, UNLOCK/LOCK, LIGHT/TURN ON/SWITCH ON/OFF, PUSH/PULL/MOVE/SLIDE, CLIMB, ENTER, SEARCH, LISTEN, SMELL, READ, WEAR, OIL, FREE, HINT, NOTES/NOTEBOOK/CLUES, TIME, SCORE, SAVE/LOAD/RESTORE, EXPORT/IMPORT, UNDO, RESTART, QUIT, HELP, VERBOSE/BRIEF, SOUND/MUSIC/THEME/GRAPHICS/TYPEWRITER, AGAIN/G, WAIT/Z, INVENTORY/I, LOOK/L, EXAMINE/X), abbreviations (N S E W NE NW SE SW U D), directions, prepositions (IN, INTO, ON, ONTO, WITH, USING, FROM, TO, AT, ABOUT, UNDER, BEHIND), articles/fillers (THE, A, AN, SOME, PLEASE), pronouns (IT, THEM, HIM, HER), ALL/EVERYTHING/EXCEPT/BUT.
- `src/engine/parser.js`: `tokenise(line)`, `splitChain(tokens)` (`.`, `,` before verbs, THEN, AND THEN), `parseCommand(tokens, vocab)` → `{verb, dobj?, prep?, iobj?, raw}` noun phrases exactly as ARCHITECTURE.md A6.2 (C34: all phrase words kept in `words`, no adjective/noun split); grammar patterns per verb (e.g. `put X in|on Y`, `take X from Y`, `unlock X with Y`, `ask X about TOPIC` where TOPIC is free text, `cut X with Y`, `turn on X` / `turn X on`, `go DIR` / bare DIR, `look at X`, `pick up X`/`pick X up`). Unknown word → `{error:'unknown-word', word}`; known words but no pattern → `{error:'no-pattern', verb}`. Case-insensitive; strips punctuation except chain separators.
- Multiword nouns are *not* resolved here — noun phrases keep all words; TT-007 binds them.
- Extensive tests `tests/unit/parser.test.js` (≥ 80 cases incl. every abbreviation, every pattern, chains, unknown words, pronouns, ALL EXCEPT, empty input, garbage, very long input).

## File allow-list
`src/engine/vocab.js`, `src/engine/parser.js`, `tests/unit/parser.test.js`

## Acceptance criteria
- [ ] Output shape exactly as ARCHITECTURE.md specifies for parsed commands.
- [ ] Parser never throws (property-style test over random token soup).
- [ ] Content can extend vocabulary (nouns/adjectives come from content at runtime; verbs from vocab.js plus optional content-provided verb synonyms).
- [ ] `npm run check` green.
