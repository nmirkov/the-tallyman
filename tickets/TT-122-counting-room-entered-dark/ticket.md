---
id: TT-122
title: The Counting Room can be entered dark by leaving the lit torch in the tunnel
milestone: BUG
status: todo
agent: writer
model: opus
depends: [TT-022]
severity: medium
---
# TT-122 — Counting Room entered without a light

## Goal
STORY §3.3 / §8.4: "The `{lit: true}` clause means the Counting Room is only ever entered with a
light, so the attack counter's dark branch is reached only by switching the torch off inside,
which is warned first" (the dark "warning at 1" is described as unreachable). The clause tests
the tunnel's light, not the player's: a torch lying lit in the tunnel satisfies it, and the
player walks into the Counting Room in darkness. One warning ("One... Light. You need light,
now.") then death on the next dark turn there - without the documented TURN OFF warning.

## Reproduction (seed 1)
STORY §12.1 #1-88 (in the tunnel, Pike counting) · `drop torch` · `n` → "Darkness ... In the dark
the counting is suddenly very close. "One..."" · `s` · `n` → `death_pike` (dark text) on turn 92.

## Expected
The north exit refuses unless the player carries a lit light (msg F variant 1, "Turn your torch
on."), e.g. condition `[{at: ['pike','counting_room']}, {carried: 'torch'}, {on: 'torch'}]`.
Coordinate with TT-121 (same exit).

## File allow-list
- `src/content/zones/**` (tunnel exits), `docs/STORY.md` §3.3 if the condition text changes.

## Acceptance criteria
- [ ] The `{ todo: 'TT-122' }` test in `tests/walkthrough/solvability.test.js` passes; remove the mark.
- [ ] `npm run check` green.

## Notes / references
STORY §3.3 msg F and note, §8.4 (dark branch), PLAN §2.5 (dark: warning at 1, fatal at 2). Found by TT-022.
