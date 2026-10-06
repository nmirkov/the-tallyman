# TT-120 / TT-121 / TT-122 / TT-123 — implementation

One implementation for all four softlock tickets found by TT-022. Two generic engine rules
(recorded as contract decisions A17 C38 / C39), plus small content rules for the cases the
engine rules don't cover.

## Summary
- **TT-120 (items lost in the dark) — engine, groping (C38).** In an unlit room, TAKE / TAKE ALL
  also resolve among *gropeable* items: portable (not `fixed` / `scenery`), non-hidden items lying
  loose on the floor (`loc === roomId`; not `alsoIn`, not inside containers). The take succeeds
  with "You fumble about in the dark until your hand closes on the torch." SEARCH in the dark
  names them ("You grope around in the dark. Your hand finds a torch."). Every other verb still
  says "It's too dark to see." No portable item starts loose in a dark room (new content test),
  so groping only finds what the player dropped.
- **TT-121 (dark tunnel trap) — engine, the way back is retraced by feel (C39).** A8.3 step 4:
  in an unlit room the exit to `prevRoomId` ignores its `if` and `hidden` (you just came through
  it). A closed door on the way back counts as "no way back", so every exit is allowed then.
  Because an unlit room only allows the way back, a player can never walk away from a light
  left in Beneath. To keep the "no unwarned dark death" guarantee (feeling your way back into
  the Counting Room with Pike counting), the attack counter's dark branch is now fatal only once
  `dark_warned` is set; any other dark turn gives the existing "One... Light. You need light,
  now." warning and sets it (PLAN §2.5 "dark: warning at 1, fatal at 2").
- **TT-122 (Counting Room entered dark) — content.** Tunnel `n` is now
  `[PIKE_BELOW, {carried: 'torch'}, {lit: true}]` (a light in your hand, not a torch burning on
  the tunnel floor). Msg F gets variants for "torch not in hand" and for a restrained Pike, which
  also fixes the wrong "knife" text noted in TT-121.
- **TT-123 (gate items behind their gate) — content.** Harrow's door: the first entry now says
  "You let yourself in with Maggie's key. You leave the door on the latch." and the `u` exit is
  `{any: [{carried: 'room_key'}, 'entered_harrows_room']}`; OPEN/UNLOCK DOOR says "You left it on
  the latch. Just go UP." Quarry: the hazard is `unless: {any: [{carried: 'rope'}, 'climbed_down']}`.
  After the first climb you know the goat track. The second descent says "You find the top of
  the goat track and pick your way down, sliding on the spoil.", and the edge gets
  `goat track / path` scenery with before/after variants.

## Files changed
- `src/engine/world.js`: new `gropeable()`.
- `src/engine/resolve.js`: TAKE `dobj` scope and TAKE ALL include gropeable items when unlit.
- `src/engine/actions/common.js`: `groped()`; reachGuard lets TAKE through for groped items.
- `src/engine/actions/objects.js`: `takenDark` message.
- `src/engine/actions/observe.js`: `searchDarkFeel` message.
- `src/engine/actions/movement.js`: darkness rule rewritten (retrace by feel; closed door = no way back).
- `src/content/zones/beneath.js`: tunnel `n` condition and msg F variants.
- `src/content/zones/town.js`: Harrow's door on the latch (exit `if`, onEnter text, HARROWS_DOOR).
- `src/content/zones/moor.js`: quarry edge `goat track` scenery; quarry floor onEnter is now an array.
- `src/content/beats.js`: attack counter dark branch (warn, then fatal).
- `docs/ARCHITECTURE.md`: A8.1 (groping), A8.3 step 4, A8.5 DROP, A8.6 dark SEARCH, A8.7 retrievability note, A17 C38 / C39.
- `docs/STORY.md`: §3.3 exit table, msg F and its note, darkness note; §4.1 `harrows_room`;
  §4.3 `quarry_edge` / `quarry_floor`; §5.2 `HARROWS_DOOR`; §8.4 counter and fairness note; §8.6 hazard; §13 global guarantees and rows.
- Tests: `tests/walkthrough/solvability.test.js` (9 `todo` marks removed; 10 new regression
  tests), `tests/unit/actions-objects.test.js` (+4), `tests/unit/actions-movement.test.js` (+3),
  `tests/unit/actions-observe.test.js` (+1, 1 adapted), `tests/unit/resolve.test.js` (2 adapted).

## Out-of-scope edits
- `src/content/case.js` (quarry hazard `unless`), `src/content/beats.js` (attack counter). These are content
  files outside the TT-122/123 allow-lists, but they hold the rules that had to change.
- Two old unit assertions encoded the previous contract and were changed to match C38: the mini-world
  iron key lies loose in the dark cellar, so `take key` there now resolves, and dark SEARCH names it.
  `x key` still gives `tooDark`.

## Decisions made (with why)
- **Groping for every loose portable item, not only critical ones.** It reads naturally ("you
  fumble in the dark") and stays consistent: the pint is found the same way as the torch. It is safe
  because content never starts a loose item in a dark room. A test enforces that.
- **Retrace ignores `if`, rather than the ticket's alternative ("blocked way back → allow every
  exit").** That alternative would let the player walk away from a torch left in the tunnel or
  Counting Room, after which the `{on: 'torch'}` entries into Beneath shut it away for good. Retracing
  confines the player to the dark rooms next to the light, so it is always within reach.
- **Dark-counter fairness moved from the map to the counter.** C39 makes a dark Counting Room
  entry possible by retracing. Instead of an exit-level exception, the counter warns once before
  any dark kill, which is PLAN's own rule.
- **Harrow's door "on the latch"** (the British idiom for a Yale left unlocked) instead of Maggie
  handing over a second copy of the one key item. **Quarry goat track** instead of refusing DROP ROPE.
  Both are "once through, stays open" rules that also survive PUT and THROW variants.

## How verified
- Probed every repro by script. Walking back into the dark Counting Room with Pike counting gives
  the warning, and TURN ON TORCH then saves you. A torch switched off and dropped in the tunnel,
  then the player walks into the morgue: UP is refused, DOWN retraces, TAKE TORCH works.
- `npm run check` (tail):
```
lint:content src/content (strict): 0 error(s), 27 warning(s)
# tests 1756
# pass 1756
# fail 0
# todo 0
build: wrote dist/tallyman.html (637147 bytes)
```
  (27 warnings are the existing L18/L21 set. Walkthroughs still win 100/100 at turns 91 / 102.)

## Known gaps / follow-ups
- Groping is TAKE / SEARCH only. PUT X IN Y with Y lying on a dark floor still says too dark (by design).
- A lint rule could enforce "no loose portable item starts in a dark room" (currently a solvability test).
- Dark re-entry shows Pike's "waiting for you, knife low" onEnter line although the room is dark.
  This is cosmetic and could get a dark variant.
