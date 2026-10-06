---
id: TT-120
title: Torch or batteries dropped in a dark room can never be picked up again (game unwinnable)
milestone: BUG
status: done
agent: engine-dev
model: opus
depends: [TT-022]
severity: high
---
# TT-120 — Light sources lost in the dark

## Goal
PLAN §2.5 ("DROP leaves them where dropped (always retrievable)") and STORY §13 (`torch`: "Can be
dropped (retrievable)"; `batteries`: "protected") promise that a critical item can never be lost.
In an unlit room only carried items are in scope (A8.1), so a critical item dropped there is
invisible. For the torch and the batteries this is permanent: they are the only light, so the
room can never be lit again. Maggie has no second packet ("You've had the last ones I had"), so
the game is unwinnable from that point (found by TT-022).

## Reproduction (terminal player, seed 1, from a fresh game)
1. Batteries, before the torch is loaded:
   `w` · `take torch` · `e` · `n` · `n` · `w` · `show card to maggie` · `e` · `n` · `ne` · `n` · `d`
   (unlit crypt) · `drop batteries` → "Dropped." · `take batteries` → "It's too dark to see."
   Back in the Black Lamb `ask maggie about batteries` → "You've had the last ones I had, love."
   `turn on torch` → "Click. Nothing." Unwinnable.
2. Torch, switched off: STORY §12.1 #1-36 (in `st_judes`) · `d` · `turn off torch` · `drop torch`
   · `take torch` → "It's too dark to see." · `search` → "You grope around in the dark but find
   nothing." No light for the rest of the game; Beneath unreachable.
3. Same in the tunnel: §12.1 #1-88 · `turn off torch` · `drop torch` · `s` (dark morgue: `u`
   blocked by the darkness rule, `d` needs `{on: torch}`) → panic rescues you to the asylum
   gates eventually, but the torch is gone for good.
4. Same in the dark boiler room (§12.1 #1-51, `cut chain`, `n`, `d`, `turn off torch`, `drop torch`).

## Expected
A critical item dropped in the dark stays retrievable. Any one of these satisfies the tests:
- TAKE (and TAKE ALL) in an unlit room can find items lying in that room by touch (at least
  `critical` ones), or SEARCH in the dark reveals them; or
- DROP / PUT of a `critical` item is refused while the room is unlit ("You'd never find it again
  in the dark.").
Whichever is chosen, document it in ARCHITECTURE A8.1/A8.7.

## Scope
- In: engine scope / protection rule; unit test in `tests/unit/`.
- Out: content prose.

## File allow-list
- `src/engine/**`, `tests/unit/*`, `docs/ARCHITECTURE.md` (A8.1 / A8.7 wording)

## Acceptance criteria
- [ ] The `{ todo: 'TT-120' }` tests in `tests/walkthrough/solvability.test.js` pass; remove the
      `todo` marks.
- [ ] `npm run check` green.

## Notes / references
PLAN §2.5 resource policy; STORY §13; ARCHITECTURE A8.1, A8.3, A8.7. Found by TT-022.
