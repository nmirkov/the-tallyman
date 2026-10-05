# TT-005 implementation

## Summary
Parser syntax layer per ARCHITECTURE A6.1/A6.2/A12.3. `vocab.js` holds the engine verb table (all 71 A6.1 ids, in table order, with synonyms, patterns, class, `prefer`, `multi`, `notHere`), directions, prepositions, fillers, pronouns, quantifiers and ordinals. `buildVocab(content)` merges content nouns, adjectives, scenery, topic keywords and content verbs, and compiles every pattern. `parser.js` exposes `tokenise`, `splitChain`, `parseCommand` (plus `normaliseInput`). Output matches the A6.2 table exactly. No function throws on any input.

## Files changed
- `src/engine/vocab.js` (new)
- `src/engine/parser.js` (new)
- `tests/unit/parser.test.js` (new, 340 test cases)
- `tickets/TT-005-parser-syntax/ticket.md` (status: verify)

## Decisions made
1. **Pattern priority applies everywhere:** patterns with more literal tokens are tried first, then table order. This applies to every pattern, not only to verbs that share a word. Without it `{dobj}` would swallow non-preposition literals: `climb up ladder`, `throw rope over gates`.
2. **Canonical-preposition literals:** a pattern literal that is a PrepId (`in`, `from`, …) matches every surface form of that preposition, including the multiword `out of`. So `take X from Y` also covers `off` and `out of`, and `look in` also covers `inside` and `into`. Literals that are not PrepIds (`off`, `up`, `over`) match only their own word.
3. **Engine patterns use A4.15's `<word>` placeholder,** which stands for any of the verb's words. There are three small extensions to the mini-language: `{dir:u|d}` (a direction slot limited to some directions), `[of]` optional literals (used by `get out of X`), and the `switch X on/off` patterns.
4. **Literal role:** a literal is the `prep` only when it sits between a noun slot and a noun or topic slot. Any other literal is part of `verbWord` as typed: `pick up`, `look under`, `listen to`, `jump off`, `get out of`.
5. **Climb up/down:** `climb up/down` gives `{verb:'climb', dir:'u'|'d'}`, with an optional `dobj`. Bare `enter` and `exit` keep their own verb with no `dir`. TT-008 implements the A6.1 rules "up/down = go u/d" and "bare = go in/out".
6. **Two noun slots next to each other** (`show {iobj} {dobj}`): the split goes at the first article (`hand mr pike the brass key`). With no article, the first slot takes one word.
7. **Error attribution:**
   - The verb named in an error comes from the longest head. Exact verb words win over pattern heads, then table order applies. `verbWord` is what was typed (`pick`, `turn`).
   - `missing-noun` is reported only when the verb has a `{dobj}` pattern. So bare `go` gives `no-pattern`, not "What do you want to go?".
   - When nothing matches, the unknown-word check skips the words after `about` for topic verbs.
8. **Input normalisation lives in `parser.js` (`normaliseInput`)** because `text.js` (TT-008) does not exist yet. It applies A12.1 literally: other non-ASCII characters become `?`, and P1 then turns `?` into a `.` separator. This only affects inputs that would be errors anyway.
9. **`splitChain(tokens, vocab?)`:** an optional second argument, so content verbs also start chain segments. Without it the engine-only vocab is used, so the contract signature still works.
10. **`parseCommand` hardening:**
    - It also accepts a string.
    - It lower-cases tokens, drops non-strings and `.` tokens, trims commas at the edges, and caps input at 200 tokens.
    - A top-level catch returns `no-pattern`.
    - Noun lists skip empty elements (`take key and` gives `take key`).
11. **Extra known words:** ordinals and `one` (A6.7), HOST_SETTINGS values (`c64`, `spectrum`, …), every pattern literal, and every preposition surface word (e.g. `of`).
12. **Vocab object shape (consumed by TT-007/TT-008):**
    - Fields: `verbs`, `verbById`, `words` (Set), `patterns`, `byHead`, `unheaded`, `heads`, `startWords`, `prepWords`, `prepStarts`, `invalidPatterns`.
    - Helpers: `isKnownWord`, `defaultVocab`.
    - It is not state, so it uses Set and Map.
    - Content synonyms are added to engine verbs (their patterns are appended, and `prefer`/`multi`/`notHere`/`default` override). A new content verb gets class `world` and patterns `<word>`, `<word> {dobj}` by default.

## How verified
- Test-first: the suite failed with the modules missing, then passed after the implementation.
- `node --test tests/unit/parser.test.js` gives 340 pass, 0 fail. The suite covers:
  - every A6.2 example verbatim
  - every abbreviation and every engine verb pattern and synonym
  - chains, pronouns, ALL/EXCEPT and lists
  - every error kind and its priority
  - content vocab extension
  - output shape
  - property tests: 3000 random token soups and 2000 random Unicode strings
  - very long input and garbage arguments
- `npm run check` tail (run 2026-10-06):
  ```
  # tests 491
  # pass 490
  # fail 1      <- tests/unit/audio.test.js: ERR_MODULE_NOT_FOUND src/ui/audio/sfx.js (parallel agent's red test-first file, not TT-005)
  ```
  Re-run without that file: lint:content OK, `# tests 490 # pass 490 # fail 0`, build wrote dist/tallyman.html.
- D1 check: there is no `Math.random`, `Date`, `console` or Node import in either module.

## Known gaps / follow-ups
- **Contract gap:** `throw X over Y` returns `prep:'over'`, but the A6.1 table lists that pattern while the `PrepId` typedef has no `over`. The orchestrator should either add `over` to PrepId or decide otherwise.
- **Contract gap:** A6.1 gives `again` the class `special`, but the `VerbDef.class` typedef only allows world, meta and system. The code follows A6.1.
- **P2 behaviour that comes with the contract:** a verb-like noun right after `and` or `,` with no article starts a new command (`take key and ring` reads `ring` as CALL). An article prevents this.
- `climb {dobj}` accepts direction words (`climb north` gives dobj `north`), and TT-007 will then fail to find it.
- TT-008 could reuse `normaliseInput` or switch it to `text.normalise` once that exists.
- The content linter could report `vocab.invalidPatterns`.
