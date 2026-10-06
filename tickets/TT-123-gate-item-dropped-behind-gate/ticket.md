---
id: TT-123
title: Room key / rope dropped behind their own gate lock Harrow's room / the quarry floor for good
milestone: BUG
status: todo
agent: writer
model: opus
depends: [TT-022]
severity: medium
---
# TT-123 — Gate items dropped behind the gate

## Goal
PLAN §2.5: "DROP leaves them where dropped (always retrievable — no room ever becomes permanently
inaccessible except after an ending)". STORY §13: `rope` is "Protected so the quarry floor never
becomes unreachable"; `room_key` "Protected". Both can be dropped on the far side of the exit they
unlock, after which the room can never be entered again (the quarry only by the fatal fall).
Both rooms are optional (Harrow's room: map / notes / cuff-pouch pointers; quarry floor: the
exercise-book lead), so this is unfair rather than unwinnable.

## Reproduction (seed 1)
1. STORY §12.1 #1-16 (`harrows_room`) · `drop key` · `d` · `u` → "Harrow's door at the top of the
   stairs is locked. Maggie keeps the keys behind the bar." SHOW CARD → "Yes, love, I've seen it."
   No second key: locked out for good.
2. `n` ×5 · `e` · `in` · `take rope` · `out` · `d` (quarry floor) · `drop rope` · `u` · `d` →
   hazard warning, `d` → `death_fall`.

## Expected (any of)
- Rope: once used to climb down it stays tied to the winch post (the `d` exit no longer needs it
  carried, e.g. `unless: {any: [{carried:'rope'}, 'rope_tied']}`), or DROP ROPE on the floor is
  refused ("You'll want that to climb back down.").
- Key: Harrow's door stays unlocked once opened (flag `entered_harrows_room` in the exit `if`), or
  Maggie hands over the spare when asked (ASK MAGGIE ABOUT KEY / SHOW CARD while the key is not
  carried).

## File allow-list
- `src/content/zones/**`, `src/content/npcs/**`, `docs/STORY.md` (§3.3 / §8.6 / §13 wording)

## Acceptance criteria
- [ ] The `{ todo: 'TT-123' }` tests in `tests/walkthrough/solvability.test.js` pass; remove the marks.
- [ ] `npm run check` green.

## Notes / references
PLAN §2.5 resource policy; STORY §3.3, §8.6, §13. Found by TT-022.
