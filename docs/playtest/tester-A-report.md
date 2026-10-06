<div align="center">

# ⛔ SPOILERS ⛔

### This document gives away the solution to THE TALLYMAN:<br>who the killer is, how the puzzles work and how every ending is reached.

**[▶ Play the game first](https://nmirkov.github.io/the-tallyman/), then come back.**

</div>

---

# Playtest A report: "The Tallyman" (Blackmere, 15 Nov 1984)

Tester style: thorough explorer, blind, 1980s text-adventure background.

## Outcome
| Attempt | Result | Score | Turns | Game time at end |
|---|---|---|---|---|
| 1 | LOST: stabbed by Pike in the Counting Room | 50/100 | 272 | ~23:46 |
| 2 | WON: "The Tally Settled", rank Chief Inspector | 100/100 | 173 | ~22:56 |

Milestones in attempt 1 (blind): Towpath 21:41 · Mill Gates and the 22:00 bell at turn 60 · Market Square ~22:05 · Black Lamb turn 78 · Police House 22:28 · Mill Yard 22:49 (turn 158) · Tunnel turn 176 (23:00 bell) · Ashcombe turn 186 · Cortina 23:17 · Counting Room ~23:44.
Attempt 2 (with knowledge, plus the town areas I'd missed): Mill Yard 22:24 · Police House accusation 22:48 · win 22:56.

## Top 10 friction points
1. **Finale: ACCUSE doesn't work in the Counting Room.** `accuse pike` gives "Prove it," says Pike, even though I had 5 pieces of evidence. HELP teaches ACCUSE as the way to win, so I spent the 4-count trying SHOW FILE and SHOW LEDGER PAGE and died. "Cuffs, not fists" only shows up in the death text. (HANDCUFF PIKE would have won: I checked by replaying.) The "Do something." nudge at "Three" should point at the cuffs.
2. `oil cabinet` while carrying the oil can gives "You have nothing suitable to oil the cabinet with." That's a false message.
3. Church Lane advertises an IN exit for Edna's cottage, but `in` and `enter cottage` both put you inside the church.
4. `buy whisky for silas` gives I don't know the word "for". A bare `buy whisky` before you've asked about Silas gets "You're on duty, love".
5. `open boot` / `examine glovebox` in the Cortina give I don't know the word. A British 1984 detective would check both.
6. `read notice` at the Mill Gates gives "There's nothing written on the notice." but EXAMINE shows the full demolition order.
7. `listen` in the Tunnel gives "You hear nothing unusual." but the room text says a man is praying behind the door.
8. `ask harrow about pike` through the door gives "Which do you mean, the room key, the map or the Harrow's notes?"
9. `examine tunic` at the Police House describes the button I'm carrying, not Pike's tunic. `accuse pike` when he's elsewhere gives "You can only accuse a person."
10. Repeated prose: from Ashcombe onward, "Your torch flickers, browns out, and steadies again" appears about 12 times and never pays off. Silas also repeats the full "Dry throat" paragraph for every ASK.

Minor: `examine towpath` in the room called Towpath is an unknown word. `take flowers` gives "That's fixed in place." The Tunnel/Morgue directions don't match (south vs up, and the drawer hatch is redundant).

## Fairness verdict
**Fair overall (7.5/10).** Every key item is signposted in-world: Silas names the tools, the hatch "wants oil", the cabinet "needs a lever", Harrow's empty cuff pouch, the cuffs on the car seat. The only unfair moment is the finale's ACCUSE vs CUFF mismatch: death comes 3 turns after entering, and the decisive clue arrives only afterwards. The red herring (the vicar's letters) is excellent and clears him cleanly.

## Timer verdict
**Tight but fair for an explorer; loose once you know the map.** Blind and examining everything, I reached the finale at about turn 268 of 300 and was still missing the whole church/Chapel Street half of the map. With knowledge I won at turn 173 after seeing nearly everything. The bells (22:00, 23:00, 23:30, 23:45) and the movement of Pike, the trap and the door create real tension. A first-timer who examines everything will feel squeezed. That's probably intended, but maybe add 20–30 turns or make LOOK/TIME/NOTES free.

## Overall: 8/10
The atmosphere and writing are superb: the counting motif, the 1984 period detail, the ghost girl in the weaving shed, bed 9 "A.P.", and Pike's "They always turn up." Clues layer nicely (register, ledger, file, button). The puzzles are classic and logical. Fix the finale's signposting and the parser gaps above and it's a 9.
