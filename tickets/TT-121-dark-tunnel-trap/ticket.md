---
id: TT-121
title: Leaving the torch in the Counting Room traps the player in the dark tunnel until midnight
milestone: BUG
status: todo
agent: writer
model: opus
depends: [TT-022]
severity: high
---
# TT-121 — Dark tunnel softlock

## Goal
STORY §3.3 darkness note: "the way back to `prevRoomId` always exists (A8.3 step 4), so darkness
never traps the player." In the tunnel this fails: the way back north to the Counting Room has the
exit condition `{lit: true}` (the *tunnel* must be lit), so a player who walks out of the Counting
Room without the torch can go neither north (condition) nor south / up (darkness rule). Beneath
never panics (§3.1), so nothing rescues them: the game can only end at midnight.

## Reproduction (seed 1)
1. STORY §12.1 #1-90 (Pike cuffed, Harrow still chained) · `drop torch` (it stays lit in the
   Counting Room) · `s` → "Darkness" · `n` → "Into a room with Pike in it, in the dark? Not a
   chance. Turn your torch on." · `s` / `u` → "You blunder about in the dark but find no way
   through." Stuck; `wait` until turn 300 → `pyrrhic`.
2. Same with `turn off torch` · `drop torch` · `s` before leaving.
3. With Pike still counting (§12.1 #1-89, `drop torch`, `s`): also stuck.

Note the refusal text is also wrong in repro 1: Pike is cuffed, not waiting with a knife.

## Expected
The tunnel's north exit must never strand the player who came out of the Counting Room. Options
(content-only is preferred):
- make the condition about the player's light, e.g. `{carried: 'torch'}` + `{on: 'torch'}`
  (which also fixes TT-122), and let the darkness rule's way back (`prevRoomId`) win; or
- engine: in A8.3 step 4, if the exit back to `prevRoomId` is blocked by its condition, treat it
  as "no way back" and allow every exit.

## File allow-list
- `src/content/zones/**` (tunnel exits) — or `src/engine/actions/movement.js` + `tests/unit/*`
  if the engine route is chosen; `docs/STORY.md` §3.3 msg F if wording changes.

## Acceptance criteria
- [ ] The `{ todo: 'TT-121' }` tests in `tests/walkthrough/solvability.test.js` pass; remove the marks.
- [ ] The §12.1 / §12.2 walkthroughs still win 100/100 at turns 91 / 102.
- [ ] `npm run check` green.

## Notes / references
STORY §3.3 (tunnel exits, msg F, darkness note), §3.1 (Beneath `panic: false`), §13; A8.3. Found by TT-022.
