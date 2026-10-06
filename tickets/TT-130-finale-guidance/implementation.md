# TT-130 — Finale guidance: implementation

## Summary
In the blind playtest, both testers reached the Counting Room carrying the cuffs. Both tried ACCUSE, SHOW, ASK and SAY, and both died: nothing pointed at HANDCUFF PIKE until the death text. The finale now steers to the cuffs on every turn before the knife. It is still a four-turn countdown, and death still comes at 5.

- **Harrow's shout (`HARROW_CUFFS`, `shared.js`).** Anything you try while Pike is counting gets this shout from Harrow: ACCUSE (strong or weak), SHOW, GIVE, ASK, TELL or TALK to Pike.
  - Carrying the cuffs: on the first turn, "Don't talk to him, kid - cuff him! Get the cuffs on him!"; after that, "Stop talking! The cuffs, kid - the cuffs!".
  - Without the cuffs: he sends you out to the car.
- **ACCUSE in the Counting Room.** With ≥ 3 evidence it still awards `accusation` (PLAN §2.5 "points only"). Strong or weak ("Prove it"), it is now followed by the shout.
- **SHOW / GIVE to Pike in the Counting Room.** `pike.before.show` / `give` replaces the desk replies: "He doesn't look at it… 'I keep my own book, Sergeant.'" Then comes the shout. The desk `shows` are untouched.
- **ASK / TELL Harrow while Pike counts and Harrow is chained** gets "Not now, kid! He's got a knife - get the cuffs on him!" (or "…in the car"). His topics return once Pike is cuffed or Harrow is freed.
- **Attack-counter warnings 2, 3 and 4** each end with Harrow's cue: the cuffs, or "Get out, kid!" when you have none (leaving pauses the count). "Behind him Harrow is trying to say something. Do something." is gone. A flag, `harrow_shouted`, stops Harrow being quoted twice in one turn. `HARROW_CUFFS` sets it, the counter then uses the plain line, and a new daemon `harrow_quiet` clears it the same turn.
- **HINT.** A new step 0, `showdown`, is active only in the Counting Room while Pike counts or Harrow is chained. It is explicit: HANDCUFF PIKE / CUT CHAINS, or "go SOUTH and fetch the cuffs". Before this, a tester-A state would have got the register hint in the middle of the fight.
- **HELP:** "Words won't hold a killer, though: to take one in, ARREST or HANDCUFF them, and you'll need cuffs."
- **Synonyms** for `arrest`: SUBDUE, TACKLE, APPREHEND, DISARM, OVERPOWER, NICK (content verbs). Used without the cuffs, the existing ARREST_PIKE line points to the car.

## Files changed
- `src/content/shared.js`: `HARROW_CUFFS`.
- `src/content/case.js`: Counting Room `correct` / `weak` get `then: HARROW_CUFFS`.
- `src/content/npcs/pike.js`: `COUNTING_VOICE` gets `then`; `before.show` / `give` (`COUNTING_HANDS`).
- `src/content/npcs/harrow.js`: `before.ask` / `tell` (`NOT_NOW`).
- `src/content/beats.js`: counter warnings 2/3/4 are Text variants; new daemon `harrow_quiet`.
- `src/content/hints.js`: step `showdown`.
- `src/content/verbs.js`: arrest synonyms.
- `src/content/rules.js`: HELP.
- `src/content/registries.js`: flag `harrow_shouted` (28 → 29).
- `docs/STORY.md`: §1.7, §6.3, §6.6, §7.3, §7.4, §7.5, §8.1 (new "Finale fairness" note), §8.4, §9.2, §10 (step 0).
- Tests:
  - new `tests/content/finale-guidance.test.js` (11 tests);
  - `tests/content/beneath.test.js`: daemon list, hint list and the tier-1 expectations in the room;
  - `tests/content/town-canal.test.js`: flag count.

## Decisions made (with why)
- **ACCUSE never performs the arrest, even with the cuffs carried.** The caution is words; the finale's beat is a physical act, which keeps the danger. The steer costs at most one turn, and the counter has slack: entering is count 1, so ACCUSE at 2, SHOW at 3 or a lunge at 4 still leave time for CUFF. A test proves that HANDCUFF PIKE after each of tester A's commands still wins.
- **One shout per turn.** The command's reply carries Harrow's line, so the counter's warning stays Pike's alone. When the command drew no reply from Harrow (WAIT, LOOK…), the counter carries the cue. This avoids double "Harrow…" lines.
- **The hint step goes first rather than reordering the path.** The engine shows the first undone step, so a situational step 0 is the only data-only way to make HINT answer in the fight.
- **NOT_NOW only while Harrow is chained.** Once he is free, "Done. Now him." already steers.

## How verified
- The tester replays are exact:
  - **Tester A, attempt 1.** No register or button (2 evidence); Pike never accused at his desk; waited for him to go down at 23:30. Then `n`, `accuse pike`, `show file to pike`, `show ledger page to pike`, `hit pike with crowbar`. Every reply after entering names the cuffs, and death comes only on the 5th command. `handcuff pike` after any prefix wins.
  - **Tester B.** ACCUSE, SHOW LEDGER PAGE, ASK ABOUT MARY: each steers, and ARREST works at count 4.
- Also covered: without the cuffs (the warnings point out, TACKLE gets "With what?", leave, fetch, re-enter, SUBDUE); all 10 arrest words; HINT variants; HELP.
- The walkthroughs are unchanged: §12.1 wins 100/100 on turn 91 and §12.2 on turn 102.
```
lint:content src/content (strict): 0 error(s), 27 warning(s)
# pass 1857
# fail 0
build: wrote dist/tallyman.html (665783 bytes)
```

## Known gaps / follow-ups
- GIVE of a critical item to Pike is refused by protection first ("You'd better hang on to that."). Pike's `before.give` only answers non-critical items.
- SAY / SHOUT is handled in TT-131, with the Pike / Harrow Counting Room cases.
- ATTACK PIKE WITH CROWBAR still says "…than you are with your fists. Cuffs, not fists.", which is accurate enough. The engine has no condition on the instrument.
