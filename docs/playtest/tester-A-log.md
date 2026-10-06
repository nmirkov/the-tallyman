# Playtest A log — thorough explorer

## Attempt 1

Start: Thursday 15 Nov 1984, 21:30, Platform. Midnight = turn 300. Each command = 30s.

### Batch 1-3 (turns ~1-30)
- Platform -> Waiting Room (torch, dead batteries; 10p coin in bench via SEARCH BENCH) -> Station Road -> Canal Bridge -> Towpath.
- Enjoyed: opening is atmospheric; "dead as Dickens"; the four strokes under the BLACKMERE sign is a nice chill.
- (a) `examine towpath` in the room called "Towpath" -> "I don't know the word "towpath"." Room name not examinable.
- Note: `search bench` reveals the coin but doesn't take it (fine, classic).
- Reached Towpath ~21:41.

### Batches 4-20 (turns ~30-158)
- Lock (22:00 bell at Mill Gates, turn 60), Silas wants whisky; shed padlocked. Mill gates chained.
- (a) `take flowers` -> "That's fixed in place." Odd wording for a bunch of flowers.
- (a/bug?) `read notice` at Mill Gates -> "There's nothing written on the notice." but `examine notice` shows the full demolition order text. READ should give the same.
- (c) Silas repeats the identical "Dry throat, Sergeant..." paragraph for every ASK before whisky. Fine once, tiresome x4.
- Market Square ~turn 70 (22:05). Phone box: CALL HQ uses the 10p automatically - nice, +5. Good payoff for searching the bench.
- Black Lamb ~turn 78. Maggie: SHOW CARD unlocks key + batteries - satisfying. `ask maggie about rooms` -> "Can't help you there, love." (fine).
- `buy whisky` response doesn't clearly say you paid / got it ("Two pound."), had to check inventory (money did go 5->3). Small clarity issue.
- Harrow's Room ~turn 100: map + notes. Nice clue design (Thursdays, mill names, TALLY = DEBT).
- Police House ~turn 116 (22:28). PC Arthur Pike taps in fours. Occurrence book: out on Moor Road 20:35-21:20 - lovely incriminating detail. Bicycle with moor mud + coal dust in Cells.
- Enjoyed: Pike's "They always turn up." Chilling. Silas: "They were all counters, the Pikes."
- (a) `ask silas about thursday` / `about shed` -> "Can't help you with that. Ask me about the counting man." (ok - at least it steers).
- Silas whisky -> tunnel info, bolt cutters & oil can. +5. Cut chain -> Mill Yard at 22:49 (turn ~158).
- Worry: I've spent half the clock and only have 30 points. Clock feels tight for a thorough explorer.

### Batches 21-45 (turns ~158-272) — the mill, asylum, moor, finale
- Counting House (turn ~160): loose ledger page (+10) - SHED DOOR 1912 names = the victims + J. Harrow (bailiff); "Pike, Mary, 14 - 3s 4d". Great reveal. Trap padlocked with disc padlock ("Pike's lock").
- Boiler Room: OIL HATCH / OPEN HATCH worked first time. Tunnel at ~turn 176.
- (a) `listen` in Tunnel while the room text says "a man is praying" -> "You hear nothing unusual." Contradiction.
- KNOCK ON DOOR -> Harrow speaks. Lovely. 23:00 bell at turn 180.
- (a) `ask harrow about pike` (through door) -> "Which do you mean, the room key, the map or the Harrow's notes?" Parser grabbed "harrow" as the notes; nonsense disambiguation.
- (b) Geography confusion: Tunnel says "Steps climb south to the morgue"; Morgue exits only "up". Then OPEN DRAWER 4 reveals rungs going down - but I'd already come up from the tunnel. Not clear what the drawer hatch adds (maybe it's the route from the asylum side for someone who came in through the chute).
- Ashcombe Entrance Hall ~turn 186. Torch "flickers, browns out, and steadies again" EVERY few turns from here - (c) repeated ~12 times. Creates worry (battery timer?) but never pays off. Annoying after the 4th time.
- (a) Records: `oil cabinet` -> "You have nothing suitable to oil the cabinet with." I WAS carrying the oil can. Wrong message - should say oil won't help / it needs levering.
- (a) `open cabinet with bolt cutters` -> generic "Rusted solid. You'd need something to lever it with." OK.
- Adolescent ward: bed 9 "A.P." - chilling, great.
- Coal Chute -> up -> Asylum Gates -> Tally Stone (figure in fog - nice) -> Moor Road -> Cortina (turn ~215, 23:17): handcuffs, torn page "IT'S" (+5).
- (a) `open boot` -> I don't know the word "boot". A Cortina has a boot - British setting, a 1984 DS would check it.
- (a) `examine glovebox` -> I don't know the word "glovebox".
- (a) `use radio` -> "You'll have to be more specific about how." (fine-ish) ; examine radio explains aerial pulled - good.
- Quarry hut: crowbar + rope. Quarry floor via rope (auto-tie, nice): exercise book "WHEN THE TALLY IS SETTLED SHE CAN STOP".
- Crowbar opens cabinet -> PIKE, Arthur patient file (+10). Score 50 at turn 244 (23:32).
- (a/b) `accuse pike` in Records (Pike not present) -> "You can only accuse a person." Misleading - Pike IS a person; should say "He isn't here."
- Police House at turn ~256 (23:38): empty, cape gone. Counting House trap now bolted from beneath. Tunnel iron door now ajar.
- Counting Room ~turn 268 (23:44): Pike with knife, Harrow chained. Pike counts one per turn.
  - `accuse pike` -> "Prove it," says Pike... (I was carrying file, ledger page, torn page, exercise book, cuffs! 5 items. Why doesn't ACCUSE work? The HELP said 3 pieces of evidence is enough.)
  - `show file to pike` -> "That's private, that. That's mine." "Three". "Do something."
  - `show ledger page to pike` -> wounded, "Four".
  - `hit pike with crowbar` -> "He is quicker with that knife... Cuffs, not fists." -> DEATH. *** Counted ***
- (d) UNFAIR-ish: The game told me to ACCUSE with evidence; I did, and it didn't work in the finale. The "Cuffs, not fists" clue only arrives in the death message. I had the cuffs; a player could guess CUFF PIKE, but after ACCUSE failed I was thinking "talk him down".
- Ending prose is excellent ("the chisel in his hand, and the fifth stroke beginning").

**ATTEMPT 1 RESULT: LOST (killed by Pike). Score 50/100, 272 turns, ~23:46.**
Unexplored: Weaving shed, Chapel Street (west of High St), Church Lane / St Jude's (NE).

## Attempt 2 (restart, empty commands.txt, with knowledge from attempt 1)

- Opening re-run efficiently; Market Square/phone/pub done by turn ~20.
- (a) `buy whisky` straight after showing card -> "Whisky? You're on duty, love. Unless it's for somebody who needs loosening up." Gated on knowing about Silas. Fair in-world, but:
- (a) `buy whisky for silas` -> I don't know the word "for". A natural phrasing that the parser rejects outright. Only `ask maggie about silas` then `buy whisky` worked.
- High Street ~turn 26 (21:43). Co-op/butcher's flavour (miners' strike fund; Holt & Son) - excellent period texture.
- Chapel Street / No.13 (Ivy Marsh): SEARCH finds silver police tunic button in candle wax. Great clue, nicely hidden.
- Back Alley: SEARCH DUSTBINS -> this week's Bugle (newspaper; Pike quoted "Lock your doors on a Thursday").
- (a) `open coal-hole lid` -> "You can't open that." Flat refusal for a described object.
- Churchyard: memorial to the Fourteen (15 Nov 1912 - tonight is the anniversary). Lovely.
- St Jude's ~turn 60: Rev. Ashdown nervous about crypt. Register in vestry (+10): Mary Pike, 14, half-timer, d. 15 Nov 1912.
- (a) `open cupboard` (communion wine) -> "You can't open that."
- Crypt: PULL STONE -> letters. Red herring: the vicar's affair with "M." (Margaret Pollard). Well-built red herring - and it clears him rather than wasting time. Enjoyed.
- (a) `ask maggie about margaret` -> "Can't help you there, love." Missed chance (is Maggie = Margaret Pollard? Seems so from `ask maggie about ashdown`: "A little colour in her cheeks.")
- (a/b) Church Lane: "Edna Ashworth's cottage stands dark ... Exits: north, southwest, in". `in` and `enter cottage` both put me INTO THE CHURCH. Misleading - IN should either refuse ("boarded up") or the exit list shouldn't advertise it.
- Silas + shed + chain: Mill Yard at 22:24 (turn ~108).
- Weaving Shed: ghost girl "He counts for me. Make him stop." - best moment in the game.
- Ledger page, hatch, tunnel, chute, quarry crowbar, records file: score 65 at turn 139 (22:39).
- Car: cuffs + torn page. Police House at turn ~152 (22:48), Pike present.
- (a) `examine tunic` (Pike's) -> describes the BUTTON I'm carrying ("A silver tunic button..."). Parser matched my item, not his tunic. Want to check for a missing button!
- `show button to pike` -> "Could've come off anyone." His hand has gone to his tunic. Great.
- ACCUSE PIKE (carrying button, ledger page, file, torn page, cuffs) -> he bolts. +10.
- Followed to Counting Room via boiler hatch/tunnel (~turn 168). HANDCUFF PIKE -> arrested (+10). FREE HARROW (with bolt cutters) -> +10, *** The Tally Settled ***.

**ATTEMPT 2 RESULT: WON. 100/100, 173 turns, ~22:56. Rank: Chief Inspector.**

### Post-game check
- Replayed attempt 1's finale with `handcuff pike` in place of my fumbling: it wins (70/100). So attempt 1 was not a dead end - the failure was me not thinking of the cuffs after ACCUSE got "Prove it".
