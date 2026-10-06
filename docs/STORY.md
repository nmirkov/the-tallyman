<div align="center">

# ⛔ SPOILERS ⛔

### This document gives away the solution to THE TALLYMAN:<br>who the killer is, how the puzzles work and how every ending is reached.

**[▶ Play the game first](https://nmirkov.github.io/the-tallyman/), then come back.**

</div>

---

# THE TALLYMAN - Story Bible (STORY.md)

> **Status:** authoritative content source for TT-016...TT-018 (content), TT-019...TT-021 (art),
> TT-013 (sound ids), TT-022/TT-024 (QA). Written by TT-015.
> **Normative order:** `docs/ARCHITECTURE.md` (names, data vocabulary) > PLAN §2.5 (game rules) >
> this file (prose, numbers, layout, ids not fixed by the contract). Where this file and the
> contract disagree on a *name or mechanism*, the contract wins and this file has a bug.
>
> All quoted game text is final prose: ASCII plus `£` only, straight quotes, `-` for dashes.
> Room descriptions are <= 300 characters per variant (counted, see §15).

## Contents
- §0 Conventions for transcribers
- §1 Premise, tone, the truth
- §2 Cast
- §3 Map: zones, compass maps, exit table
- §4 Rooms (42)
- §5 Items
- §6 NPCs, topics, GIVE/SHOW/BUY
- §7 Puzzle graph
- §8 Case, finale state machine, endings, deaths
- §9 Scripted beats and story daemons
- §10 Hints
- §11 Scoring and ranks
- §12 Reference walkthrough (100/100) and short scripts for every other outcome
- §13 Softlock audit
- §14 Sound cue list and picture list
- §15 Verification log (counts, lengths, reciprocity)

---

## §0 Conventions for transcribers

- **Scenery coverage.** Every noun in a room description has a scenery entry, a scenery/fixed
  item or an NPC, except names of neighbouring rooms used as directions ("Market Square is east").
- **Ids** are exactly as written in `code font`. Rooms, items and NPCs share one namespace
  (A4.1 I2). Topic ids carry a `t_` prefix so they never collide with it.
- **Data** is written in the contract's vocabulary: Cond (A4.4), Reaction (A4.5), Text variants
  (A4.3), `vars` (A3.2), the A14.3 Tallyman encodings. Where a block is shown as JS it is meant to
  be transcribed literally (ellipses excepted); where a table is used, column names map 1:1 onto
  schema fields.
- **"Shared reaction"**: content files are JS, so a reaction used by several slots is a named
  `const` in the content module (e.g. `ARREST_PIKE`) referenced from each slot. No engine feature
  is needed for this.
- **No hooks are required.** Everything is pure data (A5 H6). Where a command has a tool and a
  target (USE BOLT CUTTERS ON CHAIN, PUT BATTERIES IN TORCH), the *tool's* `before.use` /
  `before.put` slot tests for the *target's presence* (`{present: ...}`), not the indirect object
  (Conds cannot see it). Each tool has at most two targets in the whole game, so this is exact
  enough; the edge case (e.g. PUT BATTERIES IN SUITCASE while holding the torch loads the torch)
  is harmless and documented in §7.3.
- **Turn numbers**: command *k* of a game ends with `state.turn === k` (A7.6 D1). `turnPlus: n`
  is evaluated in step A, i.e. on `turn = k - 1`. Times: turn 60 = 22:00, 120 = 22:30,
  180 = 23:00, 240 = 23:30, 270 = 23:45, 300 = 00:00.
- **Nerve** tuning (`rules.nerve`): `start: 10`, otherwise `RULE_DEFAULTS.nerve`
  (`dark +5`, `lit -1`, `safe -5`, panic at 100 -> reset 50, cooldown 15). Per-room extra deltas
  are listed per room (`nerve:`).
- **Money**: `rules.money: 500` (pence). Prices: whisky 200, pint of mild 50, a 10p "from
  Maggie's till" 10.

---

## §1 Premise, tone, the truth

### 1.1 Logline
Blackmere, a fog-bound Lancashire mill town on the lip of the moor. Thursday 15 November 1984,
21:30, rain. Four people dead in four weeks, four Thursdays, each with tally strokes scratched
on the wall beside them: `|`, `||`, `|||`, `||||`. The *Blackmere Bugle* calls the killer
**the Tallyman**. Tonight is the fifth Thursday - and the fifth stroke is the diagonal one that
closes the gate.

You are a Detective Sergeant from Manchester CID - unnamed, ungendered, second person. Your DI,
**Frank Harrow**, radioed in from the moor road at 20:40: *"I know who it is."* Then nothing.
The last train has left you on the platform. Midnight is the deadline. Nobody told you that;
you simply know it.

### 1.2 The legend (what the town tells)
In 1912 Ashworth's Blackmere Mill employed a debt-collector, the *tallyman*, who kept
the book of what the mill girls owed the company shop. On Friday 15 November 1912 - pay day,
settling day - fire broke out in the weaving shed. The shed doors were found locked from the
outside. Fourteen girls died. The town says the tallyman locked them in "until the tally was
settled", and that on wet nights you can hear him counting them still.

### 1.3 The truth (what actually happened, 1984)
- **PC Arthur Pike** (26), Blackmere's own constable these four years, is the killer.
- His great-great-aunt **Mary Pike**, aged 14, a half-timer, died in the 1912 fire. She is in
  the mill's wages book and in St Jude's burial register.
- As a boy Arthur counted - steps, stairs, breaths, the strokes on gates. In 1971, aged 13,
  after his mother's death, he was committed to the adolescent ward of **Ashcombe Asylum** for
  "obsessional counting and a fixed delusion of an ancestral debt", and released in 1975 when
  the asylum began to wind down (it closed in 1979). The town remembers that he was "away,
  poorly" and does not talk about it. Blackmere looks after its own; it also gave him a
  uniform.
- In Ashcombe he found the old **tunnel** from the asylum morgue to the mill - dug in 1890 to
  carry the dead to the mill boilers in the cholera year, bricked off, forgotten. At the mill
  end it opens into the **Counting Room**, the vault where the 1912 wages were made up and the
  tally book was kept.
- In October 1984 the mill's demolition order was posted. Pike read the 1912 debt ledger. Its
  last page is the shed-door order of 15 November 1912 - the men charged with keeping the
  weaving shed locked "until the tally is settled": **Ashworth** (the owner's son, who gave the
  order), **Crabtree** (overlooker), **Holt** (company-shop manager), **Marsh** (wages clerk) -
  **and Harrow** (bailiff, who held the key; Frank Harrow's grandfather). The same page carries
  the half-timers' wages list, debts owing, including *Pike, Mary, 14 - owing 3s 4d*. Pike has been "settling the tally" one Thursday at
  a time, a descendant per family, always on the night of the week the girls were paid.
- Frank Harrow came to Blackmere on the case this week, worked out the ledger, phoned Manchester
  for the Ashcombe admission records, and at 20:40 radioed "I know who it is" from the moor road.
  Pike - out on "patrol" on the moor road from 20:35 to 21:20 by his own occurrence book - took
  him at the car, walked him down through the asylum and the tunnel, and chained him in the
  Counting Room. Pike was back at his desk making tea when your train came in.
- At midnight Pike will draw the fifth stroke across the four on the Counting Room wall, and
  across Frank Harrow.

### 1.4 The victims (October-November 1984, all Thursdays)
| Tally | Date | Victim | Where | Family in the ledger |
|---|---|---|---|---|
| `\|` | Thu 18 Oct | Edna Ashworth, 71, widow | her cottage on Church Lane | Ashworth (mill owners) |
| `\|\|` | Thu 25 Oct | Walter Crabtree, 58, retired overlooker | the canal towpath | Crabtree (overlookers) |
| `\|\|\|` | Thu 1 Nov | Dennis Holt, 44, bus driver | the bus shelter, Moor Road | Holt (company shop) |
| `\|\|\|\|` | Thu 8 Nov | Ivy Marsh, 66, retired teacher | No.13 Chapel Street | Marsh (mill clerks) |
| `/` (fifth) | Thu 15 Nov | (Frank Harrow, 49) | the Counting Room | Harrow (bailiffs) |

### 1.5 Tone
Second person, present tense, terse. Rain, sodium lamps, coal smoke, wet slate. Dread through
understatement: things that are slightly wrong, never shown in full. No gore beyond "dark
stains" and scratched marks. Dry humour in refusals. 1984 vocabulary: torch, 10p, Cortina,
pint of mild, Panda car, the Bugle, Ever Ready, Embassy No.1, half-timer, ginnel. The supernatural
is never confirmed: every apparition has a possible ordinary reading (fog, a draught, nerves,
Pike counting in the dark).

### 1.6 Intro text (`rules.intro`)
```
Thursday 15 November 1984. 21:30.

The last train pulls out of Blackmere and takes its lights with it. Rain. Somewhere above the town, the moor.

Four dead in four weeks, four Thursdays, and a tally scratched beside each: one stroke, two, three, four. The papers call him the Tallyman.

At 20:40 your DI, Frank Harrow, radioed in from the moor road: "I know who it is." Then nothing.

Tonight is the fifth Thursday. You have until midnight.

(Type HELP for instructions.)
```

### 1.7 HELP text (`help`)
```
Type short commands: GO NORTH (or N), EXAMINE LEDGER (X LEDGER), TAKE TORCH, SEARCH, READ NOTE, OPEN CABINET, ASK MAGGIE ABOUT SILAS, SHOW CARD TO MAGGIE, GIVE WHISKY TO SILAS, CALL HQ.

Useful: LOOK (L), INVENTORY (I), NOTES (your case notebook), TIME, SCORE, HINT (costs 2 points), WAIT (Z), AGAIN (G), UNDO, SAVE 1-3, LOAD 1-3, EXPORT, IMPORT, RESTART.

Chain commands with THEN or a full stop: TAKE TORCH. W THEN SEARCH.

When you know who it is, ACCUSE them - you'll want at least three pieces of evidence on you. Words won't hold a killer, though: to take one in, ARREST or HANDCUFF them, and you'll need cuffs. Each command takes thirty seconds. Midnight is turn 300.
```
(TT-130: the ARREST / HANDCUFF sentence was added after both blind testers tried only ACCUSE in the finale.)

### 1.8 Engine message overrides (`content.messages`, A16) - TT-131
| id | engine default | Tallyman |
|---|---|---|
| `fixed` | "That's fixed in place." | "You leave it where it is." (a tester: TAKE FLOWERS -> "fixed in place" is odd for a bunch of flowers) |
| `allNotAllowed` | "You can't use ALL with that verb." | "One thing at a time, Sergeant." |

Not a content message but the same pass: an absent named person is "<Name> isn't here." (engine,
resolve.js), and X alone asks "What do you want to examine?" (parser.js).

---

## §2 Cast

### 2.1 PC Arthur Pike - the constable (culprit) - `pike`
- **Appearance.** Twenty-six, a big lad gone soft-spoken, ex-rugby, ruddy from the moor wind. Tunic buttoned to
  the throat, every button polished with Brasso. Reading glasses on a string. Counts his
  change twice. Taps the desk with a pencil in fours.
- **Voice.** Warm, slow, older than his years, "Sergeant" in every sentence, tea-and-biscuits Lancashire
  ("Now then", "happen", "nowt", "our Maggie"). Never raises his voice. Only in the Counting
  Room does the voice change: flat, numbering, liturgical.
- **Secret.** He is the Tallyman (§1.3). Mary Pike, 14, is his great-great-aunt; Ashcombe
  1971-75. His second tunic button came off when Ivy Marsh grabbed at him; he has sewn nothing
  back on, because a debt is a debt and he means to settle it before he mends anything.
- **Tells (fair clues).** Taps in fours. Occurrence book shows him on the moor road 20:35-21:20.
  Mud on his bicycle and coal dust in its chain (the asylum coal chute). Missing button once
  you hold the one from No.13. He asks, mildly, whether you've "been up the mill yet".

### 2.2 DI Frank Harrow - your partner (victim-in-waiting) - `harrow`
- **Appearance.** Forty-nine, wiry, grey crew-cut, a smoker's cough, a Manchester United scarf
  he claims is "for warmth". Tonight: chained by the wrists to a ring in the Counting Room wall,
  a dark stain spreading from his side, glasses gone.
- **Voice.** Mancunian, clipped, sardonic even now. Calls you "kid". Prays only when he thinks no
  one is listening - the Lord's Prayer, which he has not said since school.
- **Secret.** His grandfather, Josiah Harrow, was the mill bailiff who locked the shed doors in
  1912 on the board's order. Frank found his own surname in the ledger on Tuesday and told no
  one. He came anyway.

### 2.3 Maggie Pollard - landlady of the Black Lamb (red herring) - `maggie`
- **Appearance.** Fifty, sharp-eyed, hair set on Saturday and defended since. Cardigan, pearls,
  a tea towel over one shoulder, polishing a glass that is already clean.
- **Voice.** "Love", "duck", gossip delivered as concern. Knows everyone's business and most of
  their debts. Protective of Arthur Pike, whom she has known "since he was in short trousers"
  ("He's had a hard life, that one").
- **Secret.** She has been seeing the Reverend Ashdown since Easter; his wife is "at her
  sister's in Harrogate" and has been for a year. She was with him the night Ivy Marsh died, which
  is why both of them are lying about where they were. She is not the killer; her silence about
  Arthur's years "away" is the town's.
- **Function.** Batteries, Harrow's key, whisky, pints, a 10p from the till. The town's memory.

### 2.4 The Reverend Clement Ashdown - vicar of St Jude's (red herring) - `ashdown`
- **Appearance.** Sixty, tall, stooped, a cardigan under the cassock, hands that will not keep
  still. Smells of candle smoke and Polo mints.
- **Voice.** Educated, hesitant, quotes scripture when cornered and gets it slightly wrong.
  Keeps glancing at the crypt steps.
- **Secret.** Love letters to and from "M." (Maggie) hidden in a tin in the crypt. Nervous,
  evasive, guilty - of adultery, not murder. Shown the letters, he gives Maggie and himself an
  alibi for 8 November.
- **Function.** The burial register in his vestry; the memorial to the Fourteen; the parish's
  memory of the fire.

### 2.5 Silas Thorne - lock-keeper (truthful witness) - `silas`
- **Appearance.** Seventy-odd, a coat tied with string, one eye milky, a whippet called Nell who
  never barks. His cottage smells of wet dog, paraffin and pipe tobacco. Keeper of Blackmere
  Lock for fifty years; his mother was a weaver who got out of the shed in 1912.
- **Voice.** Broad, slow, rhyming muttering ("counting man, counting man"), sudden lucidity.
  Talks for a drop of whisky and not before.
- **Secret.** None that matters to the case - he is simply believed by no one. He has seen "the
  counting man" in a cape "like the bobbies used to wear" on the towpath on Thursday nights,
  counting the lock gates under his breath, going in at the mill and coming out at Ashcombe.
- **Function.** Testimony (the tunnel, the Counting Room, the boiler hatch "wants oil"), the
  shed with the bolt cutters and the oil can.

### 2.6 The mill girl - (apparition, never confirmed) - scenery + beats, not an NPC
- **Appearance.** A girl of fourteen in a pinafore and clogs, seen only in torchlight, only once,
  between the looms of the weaving shed; her hair is wet, though the shed is dry. When looked at
  directly she is a shape of lint and shadow.
- **Voice.** A whisper with a Lancashire vowel: *"He counts for me. Make him stop."*
- **Secret.** She may be Mary Pike. She may be fog through a broken pane. The game never says.
- **Function.** Mood; the line confirms that "he" counts and that the counting is the crime.

---

## §3 Map

### 3.1 Zones (A14.3 encodings, transcribe literally)
```js
zones: {
  town:    { name: 'Town',    safeRoom: 'market_square', ambient: 'rain',
             panicText: 'Your nerve goes. You run - blind, splashing, not caring where - and stop only when the orange lamps of Market Square close round you.' },
  canal:   { name: 'Canal',   safeRoom: 'towpath',       ambient: 'rain',
             panicText: 'Something in the black water moves, or you think it does. You bolt, and come to yourself under the bulb on the towpath, gasping.' },
  moor:    { name: 'Moor',    safeRoom: 'moor_road',     ambient: 'wind',
             panicText: 'The moor is too big and too dark and it is watching. You run downhill until the town glow is on your face again.' },
  mill:    { name: 'Mill',    safeRoom: 'mill_yard',     ambient: 'drone',
             panicText: 'The counting is right behind you. You run, and find yourself in the mill yard under the one lamp, shaking.' },
  asylum:  { name: 'Asylum',  safeRoom: 'asylum_gates',  ambient: 'wind',
             panicText: 'The corridors fold in on you. You scramble, claw, climb, and are outside the gates in the rain before you know how.' },
  beneath: { name: 'Beneath', panic: false, nerveCap: 99, ambient: 'heartbeat',
             capText: "Your heart hammers, but Harrow's voice holds you here." },
},
rules: { start: 'platform', money: 500, intro: '(see §1.6)', darkPicture: 'dark',
  nerve: { start: 10,
    panicText: 'Your nerve goes. You run.',
    messages: [
      { at: 50, text: [
        { if: { zone: 'beneath' }, text: 'Your hands will not stop shaking. The torch beam shakes with them. Breathe.' },
        { text: 'Your hands will not stop shaking. Find some light, somewhere warm.' } ] },
      { at: 75, text: [
        { if: { zone: 'beneath' }, text: 'Every shadow down here has a shape now. Think of Frank. Keep going.' },
        { text: 'Every shadow has a shape now. Get back to the lamps.' } ] },
      { at: 90, text: 'You can hear your own heart. Something is about to give.' },
    ] } },
```
(Beneath has no lamps to run to and never panics, so the 50 and 75 lines have Beneath variants - TT-105.)
Safe rooms are lit, non-dark, hazard-free and in their zone (L16): `market_square`, `towpath`,
`moor_road`, `mill_yard`, `asylum_gates`.

### 3.2 Compass maps (one per zone; `( )` = dark room, `*` = start, `S` = safe room)

**Town**
```
                       churchyard
                      /          \
               sw/ne /            \ s/n
                    /              \
          back_alley       (crypt)  \
              | e/w           | d/u  \
              |            st_judes ---- e/w ---- vestry
              |               | s/n (+ in/out)
        chapel_street      church_lane
         | in/out  \ e/w      / ne/sw
     number_13     high_street            (high_street n -> [Moor: moor_road])
                      | s/n
  black_lamb -- w/e -- market_square[S] -- e/w -- police_house -- e/w -- cells
     | u/d (key)          | in/out
  harrows_room         phone_box
                          | (market_square s/n station_road)
                      station_road -- e/w -- [Canal: canal_bridge]
                          | s/n
  waiting_room -- w/e -- platform*
```

**Canal**
```
   [Town: station_road] -- w/e -- canal_bridge
                                      | d/u
   [Mill: mill_gates] -- w/e ----  towpath[S] -- e/w -- lock -- e/w -- shed (if shed_open)
                                                         | n / s,out
                                                     lock_cottage
```

**Moor**
```
                         [Asylum: asylum_gates]
                                | n/s
                           tally_stone -- e/w -- quarry_edge -- in/out -- quarry_hut
                                | s/n                 | d/u (HAZARD without rope)
   harrows_car -- in/out --  moor_road[S]          quarry_floor
                                | s/n
                         [Town: high_street]
```

**Mill**
```
              counting_house            (iron trap: Pike's, never opens)
                    | n/s
  (weaving_shed) -- w/e -- mill_yard[S]
                    | s/n        | d/u
              mill_gates      (boiler_room) -- d/u via boiler_hatch --> [Beneath: tunnel]
                    | e/w (gates: n blocked until mill_chain_cut)
            [Canal: towpath]
```

**Asylum**
```
            [Moor: tally_stone]
                    | s/n
              asylum_gates[S]
                    | d,in / u
               coal_chute
                    | n/s
 records_office -- w/e -- entrance_hall -- e/w -- (ward)
                               | d/u
                           (morgue)
                               | d (hidden until drawer moved) / s
                        [Beneath: tunnel]
```

**Beneath**
```
                (counting_room)
                       | n/s  (n only while Pike is in the Counting Room)
   [Asylum: morgue] -- s/d -- (tunnel) -- u/d (boiler_hatch) -- [Mill: boiler_room]
```

### 3.3 Exit table (authoritative; every exit is reciprocal, none is `oneWay`)
Notation: `dir: target` ; conditions in `{ }` use Cond syntax; `msg` is the blocked text.

| Room | Exits |
|---|---|
| `platform` | n: station_road ; w: waiting_room |
| `waiting_room` | e: platform |
| `station_road` | n: market_square ; e: canal_bridge ; s: platform |
| `market_square` | n: high_street ; e: police_house ; s: station_road ; w: black_lamb ; in: phone_box |
| `phone_box` | out: market_square |
| `black_lamb` | e: market_square ; u: harrows_room {if: {any: [{carried: 'room_key'}, 'entered_harrows_room']}, msg A} |
| `harrows_room` | d: black_lamb |
| `police_house` | e: cells ; w: market_square |
| `cells` | w: police_house |
| `high_street` | n: moor_road ; ne: church_lane ; s: market_square ; w: chapel_street |
| `chapel_street` | e: high_street ; w: back_alley ; in: number_13 |
| `number_13` | out: chapel_street |
| `back_alley` | ne: churchyard ; e: chapel_street |
| `church_lane` | n: st_judes ; sw: high_street (TT-131: no `in`; IN / ENTER COTTAGE -> BOARDED, §4.1) |
| `st_judes` | n: churchyard ; e: vestry ; s: church_lane ; d: crypt ; out: church_lane |
| `vestry` | w: st_judes |
| `churchyard` | s: st_judes ; sw: back_alley |
| `crypt` | u: st_judes |
| `canal_bridge` | w: station_road ; d: towpath |
| `towpath` | e: lock ; w: mill_gates ; u: canal_bridge |
| `lock` | n: lock_cottage ; e: shed {if: 'shed_open', msg B} ; w: towpath |
| `lock_cottage` | s: lock ; out: lock |
| `shed` | w: lock ; out: lock |
| `moor_road` | n: tally_stone ; s: high_street ; in: harrows_car |
| `harrows_car` | out: moor_road |
| `tally_stone` | n: asylum_gates ; e: quarry_edge ; s: moor_road |
| `quarry_edge` | w: tally_stone ; d: quarry_floor (hazard `quarry` unless rope carried or `climbed_down`) ; in: quarry_hut |
| `quarry_hut` | out: quarry_edge |
| `quarry_floor` | u: quarry_edge |
| `mill_gates` | n: mill_yard {if: 'mill_chain_cut', msg C} ; e: towpath ; in: mill_yard {same if, msg C} |
| `mill_yard` | n: counting_house ; s: mill_gates ; w: weaving_shed ; d: boiler_room |
| `weaving_shed` | e: mill_yard |
| `counting_house` | s: mill_yard |
| `boiler_room` | u: mill_yard ; d: tunnel {door: 'boiler_hatch', if: {on: 'torch'}, msg D} |
| `asylum_gates` | s: tally_stone ; d: coal_chute ; in: coal_chute |
| `coal_chute` | n: entrance_hall ; u: asylum_gates |
| `entrance_hall` | e: ward ; s: coal_chute ; w: records_office ; d: morgue |
| `records_office` | e: entrance_hall |
| `ward` | w: entrance_hall |
| `morgue` | u: entrance_hall ; d: tunnel {if: ['morgue_hatch_found', {on: 'torch'}], hidden: true, msg E} |
| `tunnel` | n: counting_room {if: [{at: ['pike', 'counting_room']}, {carried: 'torch'}, {lit: true}], msg F} ; s: morgue ; u: boiler_room {door: 'boiler_hatch'} |
| `counting_room` | s: tunnel |

Blocked-exit messages:
- **A** (`black_lamb` u): `"Harrow's door at the top of the stairs is locked. Maggie keeps the keys behind the bar."`
- **B** (`lock` e): `"The shed is padlocked. Silas's padlock, Silas's shed."`
- **C** (`mill_gates` n/in): `"A chain as thick as your wrist holds the gates shut, padlocked to itself. You'd need bolt cutters."`
- **D** (`boiler_room` d): `"Not without a light."` (the door check - hatch closed: engine "The hatch is closed." - applies after the `if`)
- **E** (`morgue` d): variants `[{ if: '!morgue_hatch_found', text: "You can't go that way." }, { text: 'Not without a light.' }]`
- **F** (`tunnel` n): variants
  `[{ if: [PIKE_BELOW, { var: 'pikeState', eq: 'counting' }, { carried: 'torch' }], text: 'Into a room with Pike in it, in the dark? Not a chance. Turn your torch on.' }, { if: [PIKE_BELOW, { var: 'pikeState', eq: 'counting' }], text: 'Into a room with Pike in it, without your torch in your hand? Not a chance.' }, { if: [PIKE_BELOW, { carried: 'torch' }], text: 'Not in the dark. Not with Pike in there, cuffs or no cuffs. Turn your torch on.' }, { if: PIKE_BELOW, text: 'Not in the dark. Not with Pike in there, cuffs or no cuffs. Bring your torch.' }, { if: { turnGte: 180 }, text: "The iron door is barred from the other side. Beyond it, Harrow is praying - slower now, losing his place." }, { text: 'The iron door is barred from the other side. Beyond it, Harrow is praying.' }]`
  (`PIKE_BELOW` = `{ at: ['pike', 'counting_room'] }`.) The `{carried: 'torch'}` + `{lit: true}` clause
  means the Counting Room is only ever entered *through this exit* with a light in the player's
  hand: a torch left burning on the tunnel floor lights the tunnel, not the room beyond (TT-122).
  The only other way in is the darkness rule's way back (A8.3 step 4, A17 C39): a player who
  walked out of the Counting Room into a dark tunnel can always feel their way back in, which is
  what keeps a torch left in there retrievable (TT-121). Entering the room dark that way with Pike
  still counting is covered by the attack counter's own warning (§8.4: warned once, then fatal) -
  always, even if a TURN OFF in there was refused earlier (that refusal has its own flag, TT-105).

**Why the iron door opens (PLAN R3 note).** The beam that bars it lies on the Counting Room
side. Pike himself comes and goes by his own trap in the counting-house floor (padlocked,
his key only - §5 `iron_trap`). When he goes down for the fifth stroke he lifts the beam and
leaves the iron door ajar behind him: his way out afterwards is the tunnel, the asylum and the
moor, and a man who counts everything counts his exits. The tunnel description says so
(variant 3 of `tunnel`, §4.6), and Harrow confirms it in the finale ("He always leaves himself
a way out").

**Darkness note.** The seven dark rooms are `crypt`, `weaving_shed`, `boiler_room`, `ward`,
`morgue`, `tunnel`, `counting_room`. In each, the way back to `prevRoomId` always exists and is
always open in the dark - its `if` is not checked, you are retracing your own steps by feel
(A8.3 step 4, A17 C39) - so darkness never traps the player. The two exits into Beneath
additionally refuse entry without a lit torch (PLAN §2.2 #1 "Not without a light.") when you
come at them from the lit side. Anything dropped in the dark can be found again by touch: TAKE
finds loose items lying on the floor of an unlit room by name ("You fumble about in the dark
until your hand closes on the torch."), and SEARCH in the dark names them (A8.1 / A8.6, A17 C38).
No portable item starts loose in a dark room, so groping only ever finds what the player put
there.

---

## §4 Rooms

Format per room: header `id - Name`; a facts line; `desc` (one line per variant, first match
wins, last has no `if`); scenery (`names` -> `desc`); slots; picture brief (40x9, C64 palette
names, `fx`). Every noun in a description is either scenery, a scenery/fixed item (§5) or an
NPC. `nerve` is the room's extra per-turn delta (A8.10). Ambient "(zone)" = inherit.

### 4.1 Town (18 rooms)

#### `platform` - Platform
- zone town · dark no · safe no · nerve 0 · ambient (zone: rain) · picture `platform`
- desc: "A deserted platform under a dripping canopy. The last train's lamps shrink into the rain and are gone. A gas lamp hisses over a sign: BLACKMERE. The waiting room is west; Station Road climbs north into the town."
- scenery:
  - `canopy, roof` -> "Iron and glass, Victorian, leaking in a dozen places onto the same dozen places."
  - `gas lamp, lamp` -> "It hisses and pops. Moths would be dancing round it if anything could fly in this."
  - `sign, nameboard` -> "BLACKMERE, white on maroon. Someone has scratched four short strokes under the B."
  - `rails, track, line, train` -> "The rails shine for a while and then the dark takes them. No more trains tonight."
  - `rain` -> "Lancashire rain: patient, thorough, personal."
- before (TT-131): `listen` -> "Rain on the canopy, the gas lamp hissing, and the last of the train, a long way off. Then only the rain."
- picture brief: canopy across top rows (dark grey girders, light-blue glass), gas lamp left with yellow halo, maroon/white BLACKMERE sign centre, receding red tail lamps right on black, blue rails converging. fx `rain`.

#### `waiting_room` - Waiting Room
- zone town · dark no · safe no · nerve 0 · ambient `none` · picture `waiting_room`
- desc: "A cold waiting room that smells of wet coats and Jeyes Fluid. A wooden bench runs under a timetable nobody has changed since 1979, and the grate has not seen a fire in years. The door east leads back to the platform."
- items here: `bench` (scenery supporter, §5), `torch` (`initial`), `coin` (hidden, on the bench).
- scenery:
  - `timetable, table` -> "SUMMER 1979. Every train on it has long since gone."
  - `grate, fireplace, fire` -> "Cold ash and a crisp packet. Smiths, salt and vinegar."
  - `door` -> "Glass-panelled. Rain runs down it in crooked lines."
  - `window, windowsill, sill` -> "Grimy glass. The platform lamp makes a yellow smear of it."
- picture brief: interior, brown panelling, long bench centre (brown/orange), timetable board white on black above, black grate left, torch as a small grey/yellow block on the sill right. No fx.

#### `station_road` - Station Road
- zone town · dark no · safe no · nerve 0 · ambient (zone) · picture `station_road`
- desc: "Station Road climbs between blackened terraces. Rain runs down the gutters in a hurry to be somewhere else. North, the lamps of Market Square. East, a humpbacked bridge crosses the canal. The station is south."
- scenery:
  - `terraces, houses, terrace` -> "Two-up two-downs, soot-black. Curtains drawn tight in every one. Nobody wants to see out tonight."
  - `gutters, gutter` -> "Fast and loud. You could float a boat. You could lose one."
  - `lamps, square` -> "Orange smudges up the hill."
  - `bridge` -> "Over to the east, stone, humpbacked, over black water."
- picture brief: steep street rising to the top-right, black terraces both sides with dim yellow windows, orange lamp glow at top, wet road in blue/grey streaks. fx `rain`.

#### `market_square` - Market Square  (SAFE ROOM, town)
- zone town · dark no · safe **yes** · nerve 0 · ambient (zone) · picture `market_square`
- desc: "Market Square: wet cobbles, a stone cross, sodium lamps humming orange. The Black Lamb glows to the west; opposite, the blue lamp of the Police House. A phone box waits by the cross. High Street runs north, Station Road south."
- scenery:
  - `cobbles, cobblestones` -> "Slick as fish."
  - `cross, market cross` -> "A worn stone cross. The steps are carved with initials and, low on one side, four neat strokes."
  - `lamps, sodium lamps, lamp` -> "They hum. The light they give is the colour of weak tea."
  - `blue lamp, police lamp` -> "POLICE, in white on blue. Somebody's in; the office light is on."
  - `phone box, box` (adj `red`) -> "A red K6 phone box. The light inside works. IN to use it."
- picture brief: centre stone cross (grey) on cobbles (dark blue/grey dither), left pub frontage with warm yellow windows and a hanging black-sheep sign, right the Police House with a blue lamp, red phone box beside the cross, orange lamp halos. fx `rain`.

#### `phone_box` - Phone Box
- zone town · dark no · safe no · nerve 0 · ambient `none` · picture `phone_box`
- desc: "A red phone box, glass fogged, smelling of fag ends. The directory has been torn out page by page. A card above the phone says MINIMUM CALL 10p, and someone has scratched four strokes into the paint beside it. The square is out."
- items here: `payphone` (scenery, §5).
- scenery:
  - `directory, book, pages, page` -> "Just the spine and the letters A to C. Someone wanted the rest."
  - `card, notice` -> "MINIMUM CALL 10p. FOR EMERGENCIES DIAL 999. In biro underneath: DONT."
  - `strokes, scratches, marks, paint` -> "Four strokes. Neat, deliberate, about the height of a big man's eyes."
  - `glass` -> "Fogged with your own breath. You wipe a hole. The square, the cross, the rain."
- before: `call` -> `CALL_HQ` (shared, §7.2). (`call` outside the box: `verbs: [{id:'call', notHere: "You'll need a phone. There's a box in Market Square."}]`)
- picture brief: interior close-up: black payphone with silver buttons centre, red frame bars edges, fogged glass panes (light grey dither) showing orange blobs outside, scratched four strokes in white beside the phone. fx `rain`.

#### `black_lamb` - The Black Lamb
- zone town · dark no · safe no · nerve -1 (fire and company) · ambient `pub` · picture `black_lamb`
- desc: "The Black Lamb: low beams, horse brasses, a fire that has seen better winters. Three regulars stare into their mild and do not look up. Behind the bar a stair climbs to the guest rooms. Market Square is east."
- NPC here: `maggie`. Item here: `harrows_door` (scenery, alsoIn `harrows_room`).
- scenery:
  - `beams, beam` -> "Black oak, low enough to teach tall men humility."
  - `brasses, horse brasses` -> "Polished to a shine. Maggie's work. Everything in here is polished except the regulars."
  - `fire, fireplace` -> "Coal, banked low. You stand near it a moment. It helps."
  - `regulars, drinkers, locals, men` -> "Three old men, three pints of mild. They have decided you are not here."
  - `bar, counter, pumps` -> "Thwaites on the pumps, a jar of pickled eggs, a till that rings like a church bell."
  - `stair, stairs, staircase` -> "Narrow, carpeted, up to the guest rooms. Harrow's is at the top."
- before (TT-131): `say` -> '"Speak up, love," says Maggie. The regulars listen without looking up.'
- picture brief: warm interior: dark brown beams across top, fire glowing orange-red left, bar centre-right with yellow brass pumps, Maggie as a small figure behind it (light grey hair, purple cardigan), three hunched dark figures at a table. No fx.

#### `harrows_room` - Harrow's Room
- zone town · dark no · safe no · nerve 0 · ambient `none` · picture `harrows_room`
- desc: "Harrow's room: a candlewick bedspread, a gas ring, a window streaming with rain. His suitcase sits on the bed. His jacket hangs on the chair. An ashtray holds six Embassy ends. The stair leads down."
- items here: `suitcase` (container, closed), inside: `case_map`, `harrows_notes`.
- scenery:
  - `bedspread, bed, candlewick` -> "Pink candlewick. He hasn't slept in it. He hasn't even sat on it."
  - `gas ring, ring` -> "A kettle on it, cold."
  - `window` -> "Rain, and beyond it the dark lump of the moor."
  - `stair, stairs` -> "Down to the bar. The carpet is worn through on every tread." (TT-105)
  - `jacket, coat` -> "His sports jacket, elbow patches. On the belt hanging with it, an empty handcuff pouch. He took his cuffs with him." (cuffs pointer)
  - `pouch, handcuff pouch, belt` -> "Black leather, police issue, empty. Wherever Frank went, his handcuffs went too."
  - `chair` -> "A hard chair. His jacket on it."
  - `ashtray, ends, embassy` -> "Six. Frank smokes when he is close to something."
- onEnter: `{ if: '!entered_harrows_room', setFlag: 'entered_harrows_room', say: "You let yourself in with Maggie's key. You leave the door on the latch.", award: 'harrows_room' }`
  (On the latch: from then on the `black_lamb` u exit no longer needs the key, so dropping it up
  here can never lock you out - TT-123, §13.)
- picture brief: small room, window right with blue rain streaks and a black moor silhouette, bed left with pink spread, brown suitcase on it, chair with jacket centre. fx `rain` (in the window cells only is fine).

#### `police_house` - Police House
- zone town · dark no · safe no · nerve 0 · ambient `none` · picture `police_house`
- desc variants:
  - `{ if: 'pike_fled' }` (set by the ACCUSE that makes him run, §8.1; it outlasts `fled`, so the helmet is still on the floor once he is in the Counting Room - TT-105): "The front office of the Police House. The counter flap is up, the occurrence book open on the desk, and Pike's helmet lies on the floor where it fell. The clock ticks for nobody. The cells are east. The square is west."
  - `{ if: { var: 'pikeState', oneOf: ['left', 'counting', 'restrained'] } }`: "The front office of the Police House. Empty. The kettle is still warm and the occurrence book lies open on the desk. Pike's cape is gone from its peg. The clock ticks. The cells are east. The square is west."
  - (default): "The front office of the Police House: a counter, a kettle, a wall clock that ticks too loudly, a desk with the occurrence book open on it. Wanted posters curl on a board. The cells are east. The square is west."
- NPC here: `pike` (until he leaves). Item here: `occurrence_book` (fixed, readable).
- scenery:
  - `counter, flap` -> "Varnished, scarred, a bell on it you can't imagine anyone ringing."
  - `kettle` -> "A big tin kettle. Arthur Pike's tea runs on it."
  - `clock, wall clock` -> "A railway clock. Its tick fills the room. It is right, to the second."
  - `desk` -> "Tidy to a fault. Pencils in a jar in fours. The occurrence book lies open."
  - `posters, board, wanted posters` -> "Faces from 1981. A missing dog. A Neighbourhood Watch leaflet with the Tallyman's tally drawn on it in biro by some wag."
  - `helmet` -> `[{ if: 'pike_fled', text: 'Pike's helmet, upturned. He went out without it, in a hurry.' }, { text: 'On its peg, polished.' }]`
  - `peg, pegs, cape` -> `[{ if: { var: 'pikeState', eq: 'desk' }, text: "A row of pegs by the door. Pike's cape hangs there - a long police cape, the old kind." }, { text: "A row of pegs by the door. Pike's peg is empty: his cape has gone out into the rain with him." }]` (Silas's "cape" pointer; the second after he flees or leaves - TT-105)
  - `floor, lino` -> `[{ if: 'pike_fled', text: "Brown lino, worn pale in front of the counter. Pike's helmet lies upturned where it fell." }, { text: 'Brown lino, worn pale in front of the counter.' }]` (TT-105)
- TT-131 (blind playtest: X TUNIC at the desk described the button in your pocket):
  - scenery `tunic, uniform, buttons` -> `[{ if: [{ var: 'pikeState', eq: 'desk' }, { found: 'ev_button' }], text: "Pike's tunic, buttoned to the throat - all but the second button down, which is missing. A thread hangs where it was." }, { if: { var: 'pikeState', eq: 'desk' }, text: "Pike's tunic, buttoned to the throat, every silver button polished." }, { text: "Pike's tunic went out of the door on Pike." }]`
  - before `listen` -> `[{ if: { var: 'pikeState', eq: 'desk' }, say: "The clock. Under it, Pike's pencil on the desk: tap tap tap tap. Pause. Tap tap tap tap. He keeps time with it, exactly." }, "The clock, ticking too loudly for an empty room."]`
  - before `say` -> `[{ if: { var: 'pikeState', eq: 'desk' }, say: '"Sorry, Sergeant?" Pike looks up from his tea, pleasant and blank. Tap tap tap tap.' }, "You say it to an empty office. The clock answers."]`
- picture brief: interior: wooden counter across lower third, desk with green-shaded lamp and open white book, big round clock top-centre, blue lamp glow through the window top-left, Pike as a large dark-blue uniformed figure behind the counter (omit him? - no: draw him; the UI shows the same picture after he leaves, so draw the desk scene WITHOUT Pike to stay correct in every state). No fx.

#### `cells` - Cells
- zone town · dark no · safe no · nerve 0 · ambient `none` · picture `cells`
- desc variants (Pike rides off when he flees or leaves - Silas's bike lamp, the got-away ending; TT-105):
  - `{ var: 'pikeState', ne: 'desk' }`: "Two cells, doors open, a bucket in each. The corridor is empty: Pike's bicycle has gone, leaving moor mud on the tiles. Someone has scratched four strokes low on the wall of the far cell, very neat. The front office is west."
  - (default): "Two cells, doors open, a bucket in each. A black police bicycle leans in the corridor. Someone has scratched four strokes low on the wall of the far cell, very neat. The front office is west."
- scenery:
  - `cells, cell, doors` -> "Empty. Blackmere doesn't lock many people up. It prefers to talk about them."
  - `bucket, buckets` -> "Galvanised. Clean. Pike runs a tidy station."
  - `bicycle, bike, mud` (adj `police, black, moor`) -> `[{ if: { var: 'pikeState', ne: 'desk' }, text: 'Gone. A smear of moor mud on the tiles where it leaned.' }, { text: "Pike's bicycle, upright and heavy. Fresh moor mud caked in the tyres, and black coal dust ground into the chain." }]` (pointer: moor + coal chute)
  - `corridor, tiles` -> "Brown tiles and green gloss paint, smelling of Jeyes Fluid. Pike mops it himself." (TT-105)
  - `strokes, marks, scratches, wall` -> "Four strokes, scratched with something sharp, by someone kneeling. Prisoners do it to count days. Nobody has been held here in a month."
- picture brief: corridor perspective, grey brick, two cell doors open (dark), black bicycle centre, four white strokes low on the right wall. No fx.

#### `high_street` - High Street
- zone town · dark no · safe no · nerve 0 · ambient (zone) · picture `high_street`
- desc: "High Street: shuttered shops, a Co-op, a butcher's with the blinds down. Chapel Street runs west and Church Lane climbs north-east towards a dark spire. North, the street gives up and becomes the moor road. The square is south."
- scenery:
  - `shops, shutters, co-op, coop` -> "CLOSED, CLOSED, CLOSING DOWN SALE. The Co-op has a poster for the miners' strike fund."
  - `butcher, butchers, blinds` -> "HOLT & SON, FAMILY BUTCHERS. Dennis Holt drove the bus. His dad still cuts the meat. The blinds have been down for two weeks."
  - `spire, church` -> "St Jude's, black against a sky only slightly less black."
  - `moor` -> "Above the last streetlamp, nothing at all."
- picture brief: street of shuttered shopfronts (grey, brown, one green Co-op sign), wet road, a spire top-right in dark grey against black, the last lamp at the top of the street. fx `rain`.

#### `chapel_street` - Chapel Street
- zone town · dark no · safe no · nerve 0 · ambient (zone) · picture `chapel_street`
- desc: "Chapel Street. Terraces shoulder to shoulder. Police tape sags across the door of No.13, the fourth house to go dark. A ginnel runs west behind the houses. High Street is east."
- scenery:
  - `terraces, houses` -> "Every curtain twitches once as you pass, then stills."
  - `tape, police tape` -> "POLICE - DO NOT CROSS. It has been crossed. You cross it too."
  - `door, no.13, number 13, 13` -> "A green door, number 13 in brass. Unlocked. Nobody in Blackmere would dare."
  - `ginnel, alley` -> "A narrow passage between the backs. Lancashire for alley."
- picture brief: terrace frontage, green door centre with yellow/black tape across in a diagonal, wet pavement, a black ginnel mouth left. fx `rain`.

#### `number_13` - No.13 Chapel Street
- zone town · dark no · safe no · nerve +1 · ambient `none` · picture `number_13`
- desc: "Ivy Marsh's front room, a week on. Lace, a clock stopped at ten past ten, a dark stain on the hearthrug. On the wall by the hearth four strokes are scratched into the wallpaper. A candle stub has melted to the skirting below. The street is out."
- items here: `candle_stub` (scenery item, container), hidden inside: `button`.
- scenery:
  - `lace, curtains, doilies` -> "Lace on every surface. Ivy Marsh taught infants for forty years and kept a house like a classroom."
  - `clock` -> "A carriage clock, stopped at ten past ten. Nobody has wound it. Nobody will."
  - `stain, hearthrug, rug` -> "A dark stain. You don't need to look closer, and you don't."
  - `strokes, marks, wallpaper, wall, scratches` -> "Four strokes, gouged deep, at kneeling height. Whoever did it knelt here with a candle and took their time."
  - `hearth, fireplace` -> "Cold."
  - `skirting, skirting board` -> "Candle wax has run down onto it and set."
- picture brief: parlour: lace-curtained window left, mantel clock centre-top (white face), four white vertical strokes on patterned wallpaper (dark red/brown dither) right, small yellow stub glow at the bottom, a darker patch on the rug. No fx.

#### `back_alley` - Back Alley
- zone town · dark no · safe no · nerve +1 · ambient (zone) · picture `back_alley`
- desc: "A ginnel behind Chapel Street: wet flags, dustbins, a coal-hole lid. Someone has chalked four strokes on a back gate, and a fifth, half rubbed out. A gap in the wall leads north-east into the churchyard. Chapel Street is east."
- items here: `dustbin` (scenery container, open), hidden inside: `newspaper`.
- scenery:
  - `flags, flagstones` -> "York stone, worn into dips that hold the rain."
  - `coal-hole, coal hole, lid` -> "A cast-iron lid, rusted into its ring. Nothing's gone down there in years."
  - `gate, back gate, chalk, strokes` -> "Children's chalk: four strokes, then a fifth slashed across them and smudged out by a sleeve. Kids playing at the Tallyman. Or somebody practising."
  - `gap, wall` -> "A gap where the wall has given up. Beyond it, gravestones."
- before (TT-131): `open` -> `{ if: { hook: 'dobj_coalhole' }, say: "You get your fingers under the rim and heave. It's rusted into its ring and it stays there. Nobody has been down there in years - nobody has been able to." }`
- picture brief: narrow alley, walls both sides in dark brown brick, metal dustbins (grey) left, a back gate centre with white chalk strokes, gravestones visible through a gap top-right. fx `rain`.

#### `church_lane` - Church Lane
- zone town · dark no · safe no · nerve 0 · ambient (zone) · picture `church_lane`
- desc: "Church Lane climbs between yew hedges to St Jude's. Edna Ashworth's cottage stands dark at the corner, its windows boarded. The church door is north. High Street lies south-west."
- scenery:
  - `yew, hedges, hedge, yews` -> "Old yews, black and dripping. They have been here longer than the church."
  - `cottage` -> "Edna Ashworth's. The first stroke. Boarded up now, as if the house were ashamed."
  - `windows, boards` -> "Chipboard, nailed by somebody who wanted it done quickly."
  - `church door, church` -> "Oak, studded, ajar. A light inside."
- exits: n, sw only (TT-131: the old `in: st_judes` exit took IN / ENTER COTTAGE into the church; the cottage is Edna Ashworth's, boarded up, and not enterable).
- `const BOARDED = "Edna Ashworth's cottage is boarded up tight, and the boards are police boards. If it's the church you want, the door is NORTH."`
- before (TT-131): `enter` -> `[{ if: { hook: 'dobj_church' }, movePlayer: 'st_judes' }, BOARDED]` (ENTER CHURCH goes in; ENTER, ENTER COTTAGE are refused) · `go` -> `{ if: { hook: 'dir_in' }, say: BOARDED }` (IN, GO IN).
- picture brief: lane rising between black-green yew hedges, church tower top-centre with a lit window (yellow), boarded cottage bottom-left. fx `rain`.

#### `st_judes` - St Jude's
- zone town · dark no · safe no · nerve 0 · ambient `none` · picture `st_judes`
- desc: "St Jude's: cold stone, candle smoke and damp hymn books. Fourteen small brass plaques line the north wall. The vestry is east; the porch north opens on the churchyard. Steps lead down to the crypt. The lane is south."
- NPC here: `ashdown`.
- scenery:
  - `plaques, plaque, brass, wall` -> "Fourteen small brass plaques, each engraved with the same date and nothing else: 15 NOVEMBER 1912. No names. The vicar will tell you the names are in the register."
  - `pews, pew` -> "Box pews, the doors worn smooth by a century of hands."
  - `candles, candle` -> "A rack of votive candles. Four are burning. You count them without meaning to."
  - `hymn books, books` -> "Ancient and Modern, swollen with damp."
  - `porch` -> "The north porch. Rain blows in."
  - `steps, crypt steps` -> "Stone steps, worn hollow, going down into the dark. The vicar watches you look at them."
- picture brief: nave interior, grey stone arches, yellow candle rack centre-left (four lit), row of small yellow brass rectangles along the right wall, dark stair mouth bottom-right. No fx (optional `flicker` on the candles).

#### `vestry` - Vestry
- zone town · dark no · safe no · nerve 0 · ambient `none` · picture `vestry`
- desc: "The vestry: cassocks on hooks, a cupboard of communion wine, a desk under a green-shaded lamp. On the desk lies the burial register of St Jude's, open, its pages foxed with age. The church is west."
- items here: `register` (fixed, readable -> `ev_register`).
- scenery:
  - `cassocks, hooks, robes` -> "Black, white, purple for Lent. They hang like a queue of tired men."
  - `cupboard, wine` -> "Locked. A note on it in a careful hand: NOT TO BE TOUCHED - C.A."
  - `desk` -> "A heavy desk. The register takes up most of it."
  - `lamp, green lamp` -> "A banker's lamp. Its light makes the register look like a stage."
- before (TT-131): `open` -> `{ if: { hook: 'dobj_cupboard' }, say: "Locked, and the note says NOT TO BE TOUCHED - C.A. It is communion wine, not evidence. You leave it to the vicar." }`
- picture brief: small room, green lamp glow centre, big open register (white pages, black lines) on a brown desk, dark cassocks hanging left. No fx.

#### `churchyard` - Churchyard
- zone town · dark no · safe no · nerve +1 · ambient (zone) · picture `churchyard`
- desc: "A churchyard drowning in long grass. Headstones lean like tired men. In the middle stands the memorial to the Fourteen: a stone girl with her face worn smooth. The porch is south; a gap in the wall leads south-west to a ginnel."
- items here: `memorial` (scenery, readable).
- scenery:
  - `grass` -> "Long, wet, grabbing at your trousers."
  - `headstones, graves, stones` -> "Ashworth. Crabtree. Holt. The old town names, over and over. And Marsh, freshly dug, flowers still in their cellophane."
  - `girl, statue, stone girl, face` -> "Carved in clogs and shawl, hands folded. The rain has taken her face. You find you don't like turning your back on her."
  - `gap, wall` -> "Leads to the ginnel behind Chapel Street."
- picture brief: tilted grey headstones in dark green grass, white stone girl statue centre on a plinth, church wall/porch right, fog bands across the middle. fx `fog`, `rain`.

#### `crypt` - Crypt  (dark)
- zone town · **dark yes** · safe no · nerve +1 · ambient `drone` · picture `crypt`
- desc: "A low crypt. Coffin shelves, broken chairs, a hundred years of dust. One stone in the wall sits proud of the others, its mortar picked clean. The steps lead up."
- items here: `loose_stone` (scenery item), `love_letters` (hidden, located in `crypt`; revealed by SEARCH or by moving the stone).
- scenery:
  - `shelves, coffins, coffin` -> "Lead coffins on stone shelves, labels long gone. Nothing has moved here for a century except the vicar."
  - `chairs` -> "Stacked, broken. Harvest festival 1953, by the look of the bunting."
  - `dust` -> "Thick everywhere - except a trail from the steps to that one stone."
  - `wall, walls` -> "Rough stone, sweating. One stone sits proud of the rest." (TT-105)
  - `steps` -> "Up to the church, and the candles." (TT-105)
- picture brief (lit by torch): low vault in dark grey/brown, torch beam cone (light yellow) from bottom-centre onto the far wall where one stone stands out lighter; coffin shelves in black shapes both sides. No fx.

### 4.2 Canal (5 rooms)

#### `canal_bridge` - Canal Bridge
- zone canal · dark no · safe no · nerve 0 · ambient (zone: rain) · picture `canal_bridge`
- desc: "A humpbacked bridge over the canal. The water below is black and perfectly still, as if it were holding its breath. Stone steps lead down to the towpath. Station Road is west."
- sink: "It drops into the black water without a splash worth the name. Gone." (THROW non-critical items is loss here)
- scenery:
  - `water, canal` -> "Black. Still. It doesn't reflect the lamps so much as swallow them."
  - `parapet, bridge, stone` -> "Worn smooth by elbows. Generations of Blackmere have leaned here and thought about jumping. Most didn't."
  - `steps` -> "Slick stone steps down to the towpath."
- before: `jump` -> "You lean over the parapet and look at the water. It looks back. You don't." ; `swim` -> "From up here? No."
- TT-131: scenery `towpath, path` -> "Down the steps: puddles, one bulb on a pole, and the black water beside it." · before `enter` -> `GO_TOWPATH` = `{ if: { hook: 'dobj_towpath' }, movePlayer: 'towpath' }` (GO / ENTER / WALK TO TOWPATH).
- picture brief: stone arch spanning the picture, black water below with a single orange lamp reflection, steps descending left. fx `rain`.

#### `towpath` - Towpath  (SAFE ROOM, canal)
- zone canal · dark no · safe **yes** · nerve 0 · ambient (zone) · picture `towpath`
- desc: "The towpath, puddled and lit by a single bulb on a pole. Walter Crabtree died here three weeks ago; someone has left flowers, now brown. East, the lock. West, the black bulk of the mill. Steps climb to the bridge."
- sink: "It goes into the canal. The canal keeps it."
- scenery:
  - `bulb, pole, light` -> "One bare bulb in a tin shade, the only light for half a mile. Moths would love it, in summer."
  - `flowers, cellophane` -> "Chrysanthemums, brown now. The card says: WALTER - FROM THE LADS AT THE BOWLING CLUB."
  - `mill` -> "Ashworth's Mill. Seven storeys of black. A chimney like a finger raised for silence."
  - `water, canal` -> "Black and quiet. You keep to the middle of the path."
  - `steps` -> "Worn stone, up to the bridge." (TT-105)
- before: `swim` -> "Into November canal water? There are easier ways to catch your death, and you're trying to avoid them all tonight."
- TT-131: scenery `towpath, path, puddles` -> "Cinders and puddles between the black water and the wall. East to the lock, west to the mill. Walter Crabtree walked it home every night for forty years." · before `enter` -> `{ if: { hook: 'dobj_towpath' }, say: "You're standing on it. East for the lock, west for the mill." }`
- picture brief: path along the canal (black water bottom-third), single white bulb on a pole centre with a yellow halo, brown flowers at its foot, the mill as a huge black block with a chimney on the left horizon. fx `rain`, `fog`.

#### `lock` - Blackmere Lock
- zone canal · dark no · safe no · nerve +1 · ambient (zone) · picture `lock`
- desc: "Blackmere Lock: two great timber gates and between them a chamber of black water ten feet down, roaring where it pours through the paddles. Silas's cottage is north, his shed east. The towpath runs west."
- items here: `lock_water` (scenery item, hazard object), `shed_door` (scenery item).
- sink: "It vanishes into the churn of the lock. The lock doesn't give things back."
- scenery:
  - `gates, lock gates, beams, balance beams` -> "Oak gates, black with age, iron-banded. The balance beams are worn smooth where men pushed them for two hundred years."
  - `paddles, sluice, sluices` -> "The paddles are up a crack; water hammers through. If you went in there, you would not come out."
  - `cottage` -> "A low cottage, one lit window, smoke from the chimney."
- hazard `lock` (§8.6): `swim`, `enter`, `jump` (with no object or with `lock_water`). The lock has deliberately **no `in` exit**: bare ENTER here is the hazard (C31), and its warning tells the player the cottage is NORTH.
- TT-131: scenery `towpath, path` -> "West, back along the water to the bulb on its pole." · before `enter` -> `[{ if: { hook: 'dobj_cottage' }, movePlayer: 'lock_cottage' }, GO_TOWPATH]` (bare ENTER is still the `lock` hazard) · `listen` -> "The lock, roaring through the paddles. Under it, from the cottage, a radio playing to nobody. Or a man muttering numbers."
- picture brief: two big brown lock gates converging, white churning water between (white/light-blue dither) far below, a cottage with one yellow window top-left, a shed right. fx `rain`.

#### `lock_cottage` - Lock-keeper's Cottage
- zone canal · dark no · safe no · nerve -1 (warm) · ambient `none` · picture `lock_cottage`
- desc: "A one-room cottage, hot as an oven. A paraffin heater, a rocking chair, a whippet asleep on an old coat. Every shelf is covered in clocks, and not one of them is going. The door is south."
- NPC here: `silas`.
- onEnter: `{ setFlag: 'heard_of_silas' }` (silent; meeting Silas counts as having heard of him, so Maggie will sell whisky).
- scenery:
  - `heater, paraffin heater` -> "A Valor heater, ticking, blue flame. The room smells of it."
  - `rocking chair, chair` -> "Silas's chair. It rocks on its own a moment after he stops."
  - `whippet, dog, nell` -> "Grey, thin, asleep - or pretending. Her ears follow you. She never barks."
  - `coat` -> "An army greatcoat, very old. The dog's now."
  - `door` -> "A plank door, out to the lock. The roar of the water comes through it anyway." (TT-105)
  - `clocks, clock, shelves, shelf` -> "Dozens of clocks, all stopped, all at different times. 'Can't abide the ticking,' says Silas. 'Sounds like counting.'"
- before (TT-131): `say` -> '"Eh?" Silas cups a hand to his ear, the good-eye side. "Counting man, is it?"'
- picture brief: cosy cramped interior: orange heater glow bottom-left, rocking chair centre with an old man (grey/brown), clocks (white circles) on shelves across the top, grey dog curled bottom-right. No fx.

#### `shed` - Silas's Shed
- zone canal · dark no · safe no · nerve 0 · ambient (zone) · picture `shed`
- desc: "Silas's shed: oil, rope ends, rust. Tools hang on nails, each one inside its own outline painted on the boards, so you'd know at once if one were gone. The lock is west."
- items here: `bolt_cutters`, `oil_can` (both listable, `initial` text).
- scenery:
  - `tools, nails` -> "Saws, a scythe, a mole trap. Silas's order is absolute."
  - `outlines, outline, boards` -> "Painted shapes. Two of them, by the door, will be empty when you leave."
  - `rope ends, ends` -> "Short ends of tarred rope. Too short for anything but tying parcels."
  - `oil, rust` -> "Everywhere. The shed is mostly made of them."
- picture brief: timber wall with tools hung inside white painted outlines, bolt cutters (long red handles) and an oil can (green with a spout) on a bench centre. No fx.

### 4.3 Moor (6 rooms)

#### `moor_road` - Moor Road  (SAFE ROOM, moor)
- zone moor · dark no · safe **yes** · nerve 0 · ambient (zone: wind) · picture `moor_road`
- desc: "The moor road, lit only by the town glow behind you. Heather and black peat on both sides. Nosed into the ditch is a blue Cortina, driver's door open. North, the road climbs on to the moor. The town is south."
- scenery:
  - `heather, peat` -> "Black and sodden. It would take a footprint and keep it a week."
  - `ditch` -> "Running water. The Cortina's front wheels are in it."
  - `cortina, car, blue car, door, driver door` -> "Harrow's Cortina, J reg, Manchester tax disc. The driver's door hangs open. You could get IN."
  - `glow, town` -> "Blackmere, an orange stain in the fog below."
- TT-131: scenery `boot, trunk` -> "Shut. Through the back window: a spare wheel and a pair of wellies." · before `open` -> `{ if: { hook: 'dobj_boot' }, say: "You lift the boot lid: spare wheel, jack, a pair of wellies. Nothing that matters. You shut it again." }` · `drive` -> "Not with its front wheels in the ditch, and not with the keys being evidence. Get IN if you want to look."
- picture brief: dark moorland under a black sky, road (grey) diagonal from bottom-left, blue Cortina tilted into the ditch right with its door open, orange town glow bottom-left. fx `fog`.

#### `harrows_car` - Harrow's Car
- zone moor · dark no · safe no · nerve 0 · ambient `wind` · picture `harrows_car`
- desc: "Inside Harrow's Cortina. Cold vinyl, a smell of Embassy and wet dog. The radio handset dangles on its curly cord, hissing. Rain beads the windscreen. The road is out."
- items here: `handcuffs` (`initial`), `notebook_page` (`initial`).
- onEnter: `{ if: '!found_car', setFlag: 'found_car', award: 'car_found', say: 'The keys are still in the ignition. Frank never leaves his keys.' }`
- scenery:
  - `radio, handset, cord` -> "Dead air and hiss. You key it: nothing. Someone has pulled the aerial lead out from behind the dash."
  - `windscreen, wipers` -> "Rain, and through it, the road climbing into nothing."
  - `vinyl, seat, seats, passenger seat` -> "Cold. The driver's seat is pushed right back. Frank isn't that tall."
  - `keys, ignition` -> "The keys hang in the ignition. You leave them. The car is evidence now."
  - `aerial, lead, dash` -> "The radio lead dangles loose. Not torn - pulled, by somebody who knew where it was."
- TT-131 (blind playtest: GLOVEBOX, BOOT, DRIVE were unknown words):
  - scenery `glovebox, glove box, glove compartment, compartment, pockets, door pockets` -> "Road atlas, a de-icer, a tin of travel sweets, a pencil chewed flat. Nothing of the case. Whatever Frank had that mattered, he took with him."
  - scenery `boot, trunk` -> "Behind you, through the back seat: spare wheel, jack, a pair of wellies. Frank kept nothing in the boot that mattered."
  - scenery `car, cortina, motor` -> "Frank's Cortina, nose in the ditch. You're sitting in it."
  - before `open` -> `[{ if: { hook: 'dobj_glovebox' }, say: "You go through the glovebox and the door pockets: road atlas, a de-icer, a tin of travel sweets, a pencil chewed flat. Nothing of the case. Whatever Frank had that mattered, he took with him." }, { if: { hook: 'dobj_boot' }, say: "You lean over the back seat and look into the boot: spare wheel, jack, a pair of wellies. Nothing that matters." }]`
  - before `listen` -> "The radio, hissing. Under the hiss, nothing - no control, no voices. Rain on the roof."
  - before `drive` -> "The front wheels are in the ditch and the keys are evidence now. You'd only bury it deeper."
- picture brief: interior view from the back seat: dashboard across the bottom, rain-streaked windscreen (blue/black, droplets), dangling handset centre on a curly black cord, silver handcuffs on the passenger seat right. fx `rain`.

#### `tally_stone` - The Tally Stone
- zone moor · dark no · safe no · nerve +1 · ambient (zone) · picture `tally_stone`
- desc: "A standing stone on the crest of the moor, taller than a man and cut from top to bottom with tally marks, hundreds of them, old as weather. The road runs south to town and north to the asylum. A track leads east to the quarry."
- scenery:
  - `stone, standing stone, tally stone` -> "Gritstone, leaning. The marks run in gates of five, row on row. Old ones, worn soft. And low down, very fresh: four strokes, pale against the lichen."
  - `marks, tally marks, strokes` -> "Shepherds counted sheep on it, the guidebooks say. The town says something else. The four fresh strokes are cut with a knife."
  - `track` -> "Two ruts in the heather, east."
  - `asylum` -> "A long black building to the north. One lamp burning at the lodge."
- picture brief: tall grey standing stone centre covered in white tally rows, black moor horizon, fog banks drifting, a tiny lit lamp far north (right). fx `fog`, `lightning` (rare flash).

#### `quarry_edge` - Quarry Edge
- zone moor · dark no · safe no · nerve +2 · ambient (zone) · picture `quarry_edge`
- desc: "The lip of Blackmere Quarry. The face drops sixty feet to black water and spoil heaps. An old winch post leans out over the drop. A tin hut squats behind you. The track runs west to the stone."
- sink: "It falls a long way and the black water takes it with a small sound."
- scenery:
  - `face, drop, quarry, lip, edge, quarry edge` -> "Sixty feet of wet gritstone. Without a rope you'd never make it down alive."
  - `water, spoil, heaps` -> "Black water at the bottom, grey spoil around it. A ring of stones by a boulder - somebody's fire."
  - `winch post, post, winch` -> "An iron post sunk in concrete. You could tie a rope to that."
  - `goat track, path` -> variants `[{ if: 'climbed_down', text: 'The top of the goat track, hidden in the bracken at the lip. From up here you would never have found it.' }, { text: 'No way down that you can see. Not without a rope.' }]`
  - `hut, tin hut` -> "Corrugated tin, door hanging off. IN to go inside."
- hazard `quarry` (§8.6): `exit: 'd'`, `unless: { any: [{ carried: 'rope' }, 'climbed_down'] }` - once you
  have been down and come back up the goat track, you know where it starts (TT-123, §13).
- after `go` d with rope: handled by `quarry_floor.onEnter`. TIE ROPE (TO POST) / USE ROPE here is the same climb (`rope.before.tie`, §5.2; TT-105). `before.jump` covers JUMP OFF EDGE / LIP.
- picture brief: cliff edge in the foreground (grey), a black void dropping below, a rusty iron post leaning right, a tin hut silhouette left, wind-blown rain. fx `rain`, `lightning`.

#### `quarry_hut` - Quarry Hut
- zone moor · dark no · safe no · nerve 0 · ambient `wind` · picture `quarry_hut`
- desc: "A tin hut, its door hanging off. A brazier full of rainwater, a calendar from 1968, a workbench with nothing on it but rust and mouse droppings. The quarry edge is out."
- items here: `crowbar` (`initial`), `rope` (`initial`).
- scenery:
  - `brazier` -> "Full of rainwater with a skin of rust on it."
  - `calendar` -> "MARCH 1968. A Pirelli girl, faded to a ghost. The quarry closed that spring."
  - `workbench, bench, rust, droppings, mouse droppings` -> "Rust and droppings."
  - `door` -> "Hanging by one hinge, banging softly in the wind."
- picture brief: corrugated-tin interior in grey/brown, crowbar (dark grey) leaning in a corner, a coil of rope (light brown) on a nail, calendar (faded pink) on the wall. No fx.

#### `quarry_floor` - Quarry Floor
- zone moor · dark no · safe no · nerve +1 · ambient `wind` · picture `quarry_floor`
- desc: "The quarry floor: black water, spoil heaps, a burnt-out car. In the lee of a boulder someone has made a fire, often - a ring of stones, years of ash. A rough path zig-zags back up to the edge."
- items here: `exercise_book` (`initial`).
- onEnter (first match): `[{ if: '!climbed_down', setFlag: 'climbed_down', say: 'You loop the rope round the winch post and let yourself down hand over hand, the wet rock scraping your knees. Then you are at the bottom, and the rope is yours again.' }, { if: { not: { carried: 'rope' } }, say: 'You find the top of the goat track and pick your way down, sliding on the spoil.' }]`
- sink: "It splashes into the black water and is gone."
- scenery:
  - `water` -> "Deep, they say. Nobody knows how deep."
  - `car, burnt-out car` -> "A Ford Anglia, burnt to the frame years ago. Joyriders, or insurance."
  - `boulder, fire, ring, stones, ash` -> "Years of small fires in the same place. Somebody's private place. Somebody who liked to be alone with something."
  - `path` -> "A goat track up the spoil. Steep, but you can manage it going up."
  - `spoil, heaps, spoil heaps, heap` -> "Grey shale tipped off the face and left to slump in the rain. The goat track picks its way up through it." (TT-105)
  - `face, edge, lip, quarry` -> "Sixty feet of wet gritstone going up into the fog. The goat track is the only way back to the edge." (TT-105)
- picture brief: looking up from the floor: quarry walls (grey) on three sides, a sliver of black sky, a rusted car shell (brown) left, a stone ring with grey ash and a small pale book beside it. fx `rain`.

### 4.4 Mill (5 rooms)

#### `mill_gates` - Mill Gates
- zone mill · dark no · safe no · nerve 0 · ambient `rain` · picture `mill_gates`
- desc variants:
  - `{ if: 'mill_chain_cut' }`: "The gates of Ashworth's Mill stand open a body's width, the cut chain hanging from one bar. Beyond, the mill rises in black tiers, every window dead. A demolition notice is pasted to the gatepost. The towpath is east."
  - (default): "The gates of Ashworth's Mill: iron, twelve feet high, chained and padlocked. Beyond them the mill rises in black tiers, every window dead. A demolition notice is pasted to the gatepost. The towpath is east."
- items here: `mill_chain` (scenery item).
- scenery:
  - `gates, gate, bar, bars` -> "Wrought iron, the word ASHWORTH worked into the top in letters a foot high. Spikes."
  - `mill, windows, window, tiers` -> "Seven storeys. Hundreds of windows, all black, all looking at you."
  - `notice, demolition notice, gatepost` -> "BLACKMERE BOROUGH COUNCIL. DEMOLITION ORDER. Ashworth's Mill. Works commence 3rd December 1984. Someone has drawn four strokes across the date."
- TT-131: scenery `towpath, path` -> "East, along the water, to the one bulb on its pole." · before `enter` -> `GO_TOWPATH` (§4.2).
- picture brief: tall black iron gates centre with ASHWORTH lettering, chain and padlock (silver) at the join, mill silhouette behind with a chimney, a white notice on the gatepost. fx `rain`, `lightning`.

#### `mill_yard` - Mill Yard  (SAFE ROOM, mill)
- zone mill · dark no · safe **yes** · nerve 0 · ambient (zone: drone) · picture `mill_yard`
- desc: "The mill yard, cobbled, lit by one lamp that still works over the counting-house door. The weaving shed gapes to the west. The counting house is north. Steps lead down to the boiler room. The gates are south."
- onEnter: `{ if: '!entered_mill', setFlag: 'entered_mill', award: 'mill_entered', say: 'Somewhere up in the dark, a loom shuttle clacks once. Then nothing.' }`
- scenery:
  - `lamp` -> "One electric lamp in a cage over the counting-house door. Someone pays for this electricity. Someone wants light here."
  - `cobbles` -> "Setts, worn into ruts by a century of carts."
  - `chimney` -> "Two hundred feet of brick. It hasn't smoked since 1971."
  - `steps` -> "Down to the boiler room. Dark down there."
  - `door, counting-house door` -> "A plain door under the lamp, its paint long gone. The counting house is through it, north." (TT-105)
- picture brief: enclosed yard, black mill walls on three sides, one caged lamp (yellow) over a door top-centre, wet cobbles, a dark doorway left (weaving shed), steps down right. fx `rain`.

#### `weaving_shed` - Weaving Shed  (dark)
- zone mill · **dark yes** · safe no · nerve +2 · ambient `counting` · picture `weaving_shed`
- desc: "The weaving shed: row on row of dead looms under a roof of broken glass. The east doors are scorched black. Strokes have been scratched into the doors, low down, at a child's height. Lint stirs, though there is no wind."
- onEnter (once, needs light): `{ if: [{ lit: true }, '!saw_girl'], setFlag: 'saw_girl', sfx: 'whisper', say: 'Between two looms, at the edge of your torch, a girl in a pinafore. Her hair is wet. "He counts for me," she whispers. "Make him stop." You blink, and there is lint, and shadow, and nothing.', style: 'whisper', nerve: 10 }`
- scenery:
  - `looms, loom` -> "Lancashire looms, two hundred of them, frozen mid-shuttle. They were stopped in 1971 and nobody started them again."
  - `roof, glass` -> "More hole than glass. Rain falls through it in long silver threads."
  - `doors, scorched doors` -> "Scorched black. There's a bracket on the outside for a bar. In 1912 there was a bar in it."
  - `strokes, scratches, marks` -> "Fourteen strokes, low down on the inside of the door. Scratched with fingernails, the old men say. You count them twice. Fourteen."
  - `lint, fluff` -> "Cotton lint, everywhere, stirring. No wind. No draught. It stirs."
  - `girl, ghost, figure, pinafore` -> "There's no one there. There was no one there."
- picture brief (torchlit): rows of black loom frames receding, a torch cone (light grey/yellow) from the bottom, broken roof lights (blue) above, a faint pale girl figure at the cone's edge (light grey, mostly dithered - keep it ambiguous). fx `flicker`.

#### `counting_house` - Counting House
- zone mill · dark no · safe no · nerve +1 · ambient (zone) · picture `counting_house`
- desc variants:
  - `{ at: ['pike', 'counting_room'] }`: "The counting house: high desks, barred wages windows, the smell of ink and mice. On the tallest desk lies a great ledger bound in black. The iron trap in the floor has lost its padlock; it is bolted from beneath. The yard is south."
  - (default): "The counting house: high desks, barred wages windows, the smell of ink and mice. On the tallest desk lies a great ledger bound in black. An iron trap is set in the floor, padlocked. The yard is south."
- items here: `ledger` (scenery supporter), on it: `ledger_page`; `iron_trap` (scenery item).
- scenery:
  - `desks, desk, high desks, tallest desk` (adj `high, tallest`) -> "Clerks' desks, stool-high. Inkwells dried to black crust."
  - `windows, window, wages windows, bars` -> "Barred hatches the girls queued at on Fridays. A brass plate: NO CREDIT WITHOUT THE BOOK."
  - `mice` -> "You hear them. They are the only things in here still keeping accounts."
- before: `listen` -> `[{ if: { var: 'harrowFreed', eq: true }, say: 'Nothing beneath the floor now but your own heartbeat.' }, { say: 'You hold your breath. Faintly, from beneath the iron trap, a man's voice: "...forgive us our trespasses, as we forgive..." Someone is alive down there.', setFlag: 'heard_praying', note: 'praying' }]`
- picture brief: Victorian office, tall desks in brown, a huge black ledger centre on the tallest desk with one pale page sticking out, barred windows right, a round black iron trap with a padlock in the floor bottom-centre. No fx.

#### `boiler_room` - Boiler Room  (dark)
- zone mill · **dark yes** · safe no · nerve +1 · ambient `drone` · picture `boiler_room`
- desc variants:
  - `{ open: 'boiler_hatch' }`: "The boiler room: two Lancashire boilers like beached whales, pipes, a coal heap. Between the boilers the round iron hatch stands open on a ladder going down into the dark. Steps lead up to the yard."
  - (default): "The boiler room: two Lancashire boilers like beached whales, pipes, a coal heap, the smell of old fire. In the floor between the boilers is a round iron hatch, rusted to its rim. Steps lead up to the yard."
- items here: `boiler_hatch` (door item, alsoIn `tunnel`).
- scenery:
  - `boilers, boiler` -> "Two of them, thirty feet long, riveted. Their fireboxes are cold mouths."
  - `pipes` -> "Lagged with something you'd rather not breathe."
  - `coal, heap, coal heap` -> "Old coal, gone grey."
  - `steps` -> "Stone steps up to the yard, and the lamp." (TT-105)
  - `floor` -> "Brick, gritty with coal dust. The hatch is set in it between the boilers." (TT-105)
  - `ladder` -> `[{ if: { open: 'boiler_hatch' }, text: 'Iron rungs, going down.' }, { text: "You can't see one. The hatch is shut." }]`
- picture brief (torchlit): two huge riveted boiler cylinders left and right in dark red/brown, a round grey hatch in the floor centre, torch cone from below. No fx.

### 4.5 Asylum (6 rooms)

#### `asylum_gates` - Asylum Gates  (SAFE ROOM, asylum)
- zone asylum · dark no · safe **yes** · nerve 0 · ambient (zone: wind) · picture `asylum_gates`
- desc: "Ashcombe Asylum, closed 1979. The gates are chained, the lodge bricked up, though a lamp still burns over it for no one. At the foot of the wall a coal chute gapes, its lid long gone. The moor road runs south."
- scenery:
  - `gates, chain, padlock` -> "Chained, padlocked and welded for good measure. The council meant it."
  - `lodge, lamp` -> "Bricked up. The lamp over the door is on a timer nobody remembered to cancel."
  - `chute, coal chute, lid` -> "A square black mouth at the foot of the wall, big enough for a man. The coal dust around it is scuffed by boots. You could go DOWN."
  - `wall` -> "Soot-black brick, eighteen feet of it, built to keep people in. The chute is the only way through." (TT-105)
  - `building, clock tower, tower` -> "A long range of windows and a clock tower with no clock in it. Just a round hole, like an eye."
- picture brief: chained iron gates in the foreground, long asylum range behind with a clock tower whose face is an empty black circle, a lamp (yellow) over a bricked lodge left, a black chute mouth bottom-right. fx `fog`, `lightning`.

#### `coal_chute` - Coal Chute
- zone asylum · dark no · safe no · nerve +1 · ambient `none` · picture `coal_chute`
- desc: "The coal cellar at the foot of the chute. Grey light falls from above. Coal dust everywhere, scuffed by boots - recently, and more than once. A stair leads north into the building. You could climb back up the chute."
- scenery:
  - `coal, dust, coal dust` -> "Fine and black. It gets into everything - cuffs, tyres, bicycle chains."
  - `boots, prints, bootprints, footprints` -> "Big boots, size eleven or so, with a nailed heel like a policeman's. In and out, many times."
  - `chute` -> "A steep slide of sheet iron. You could CLIMB UP it, just."
  - `stair, stairs` -> "Stone, going up into the building."
- picture brief: cellar, black coal heaps, a shaft of grey light from top-left down the chute, bootprints (dark grey) in lighter dust across the floor, stairs right. No fx.

#### `entrance_hall` - Entrance Hall
- zone asylum · dark no · safe no · nerve +1 · ambient `wind` · picture `entrance_hall`
- desc: "The entrance hall: black and white tiles, a reception hatch, a noticeboard of curling rotas. Moonlight falls through tall windows. Records are west, the ward east. A stair goes down to the morgue. The cellar is south."
- scenery:
  - `tiles, floor` -> "Black and white, like a chessboard nobody won."
  - `hatch, reception, reception hatch` -> "PLEASE RING. There's no bell."
  - `noticeboard, rotas, board` -> "Staff rotas for March 1979. At the bottom, a typed notice: ADOLESCENT WARD - NIGHT CHECKS EVERY 15 MIN. PATIENT P. TO BE COUNTED IN PERSON."
  - `windows, moonlight` -> "Tall, arched, filthy. The moon comes and goes behind the fog."
  - `stair, stairs` -> "Stone steps going down to the morgue. Colder with every one." (TT-105)
  - `cellar` -> "The coal cellar, south, at the foot of the chute." (TT-105)
- picture brief: tiled floor (black/white checker) in perspective, arched windows letting in pale blue moonlight shafts, a reception hatch centre, a dark stairwell bottom-right. fx `fog`.

#### `records_office` - Records Office
- zone asylum · dark no · safe no · nerve 0 · ambient `none` · picture `records_office`
- desc: "Records: shelves of box files, a dead typewriter, and a steel cabinet marked P-R, rusted shut. The lodge lamp outside paints everything orange. The hall is east."
- items here: `cabinet` (fixed, openable, locked), inside: `patient_file`.
- scenery:
  - `shelves, box files, files, boxes` -> "Thousands of files. Damp has married most of them into a single block. Only the steel cabinet has kept anything dry."
  - `typewriter` -> "An Olympia. A sheet still in it: 'Dear Mrs'. Nothing more."
  - `lamp, window, lodge` -> "The lodge lamp. Orange light, orange dust."
- picture brief: grey steel cabinet centre with a P-R label, shelves of brown boxes either side, orange light through a window top-left, a black typewriter on a desk. No fx.

#### `ward` - Adolescent Ward  (dark)
- zone asylum · **dark yes** · safe no · nerve +2 · ambient `counting` · picture `ward`
- desc: "The adolescent ward. Twelve iron beds, stripped. On the wall above bed nine, tally marks in pencil, thousands of them, in neat gates of five, climbing to the ceiling. Something drips. The hall is west."
- onEnter (once, lit): `{ if: [{ lit: true }, '!ward_counting'], setFlag: 'ward_counting', sfx: 'whisper', say: 'Under the drip, under your breath, someone is counting. "...one, two, three, four..." It stops when you stop breathing.', style: 'whisper' }`
- scenery:
  - `beds, bed, iron beds` -> "Iron frames, springs rusted to lace. A brass number on each foot."
  - `bed nine, nine, 9` -> "Bed 9. Scratched into the iron of the footboard: A.P."
  - `marks, tally marks, pencil, wall` -> "Gates of five, row after row, thousands. A boy counted something here every night for four years. Near the top the rows go wrong - the fifth stroke missing, again and again. Four, four, four."
  - `drip, water, ceiling` -> "From the ceiling into a puddle. Drip. Drip. You catch yourself counting."
- before (TT-131): `listen` -> "Drip. Drip. Drip. Drip. A pause, exactly as long as one more drip. Then it starts again."
- picture brief (torchlit): row of iron bed frames receding left to right, the wall above one bed covered in fine grey pencil tally rows up to the ceiling, torch cone. fx `flicker`.

#### `morgue` - Morgue  (dark)
- zone asylum · **dark yes** · safe no · nerve +2 · ambient `counting` · picture `morgue`
- desc variants:
  - `'morgue_hatch_found'`: "The morgue: white tiles, a drain in the floor, a slab, and a wall of steel drawers numbered 1 to 8. Drawer 4 has been run back on its rails; beneath it, iron rungs drop into a square hatch. The stair leads up."
  - (default): "The morgue: white tiles, a drain in the floor, a slab, and a wall of steel drawers numbered 1 to 8. Drawer 4 does not sit flush with the rest. The stair leads up."
- items here: `drawer_four` (fixed item), `drawers` (scenery item for the other seven).
- scenery:
  - `tiles, floor` -> "White, crazed, a few missing like teeth."
  - `stair, stairs` -> "Up to the entrance hall." (TT-105)
  - `drain` -> "A brass grating. It smells of the canal."
  - `slab` -> "Porcelain. Empty. Clean. Cleaner than anything else in the building."
  - `hatch, rungs` -> `[{ if: 'morgue_hatch_found', text: 'A square hatch under the drawer, iron rungs going down into black. A cold draught comes up it, smelling of brick and canal.' }, { text: "You see no hatch." }]`
- onEnter (TT-131: a blind tester came up from the tunnel and found the morgue's only exit was "up"): `{ if: [{ hook: 'from_tunnel' }, '!morgue_hatch_found'], setFlag: 'morgue_hatch_found', sfx: 'creak', say: "You come up the rungs through a square hatch in the floor. Above it drawer 4 has been run back into the wall on greased rails - that is why it never sat flush. The hatch is your way back DOWN." }`
- picture brief (torchlit): wall of square steel drawer fronts (light grey, numbered in black), one drawer (4) sticking out, white tiled walls, a slab bottom-left, torch cone. fx `flicker`.

### 4.6 Beneath (2 rooms)

#### `tunnel` - Tunnel  (dark)
- zone beneath · **dark yes** · safe no · nerve +2 · ambient (zone: heartbeat) · picture `tunnel`
- desc variants:
  - `{ at: ['pike', 'counting_room'] }`: "A brick tunnel, barrel-vaulted, tally marks scratched every few yards. Iron rungs climb south to the morgue; a ladder rises to a hatch overhead. North, the iron door stands ajar - the bar lifted from inside by someone who wants a way out."
  - `{ turnGte: 180 }`: "A brick tunnel, barrel-vaulted, tally marks scratched every few yards. Iron rungs climb south to the morgue; a ladder rises to a hatch overhead. North, an iron door, shut. Behind it Harrow is praying, slower now."
  - (default): "A brick tunnel, barrel-vaulted, tally marks scratched every few yards. Iron rungs climb south to the morgue; a ladder rises to a hatch overhead. North, an iron door, shut. Behind it, very faint, a man is praying."
- items here: `boiler_hatch` (via `alsoIn`).
- onEnter: `[ { if: [{ turnGte: 180 }, { var: 'harrowFreed', eq: false }], say: "Beyond the iron door Harrow coughs - a wet, bad cough - and goes quiet for too long.", style: 'alert', then: { if: '!tunnel_music', setFlag: 'tunnel_music', music: 'dread' } }, { if: '!tunnel_music', setFlag: 'tunnel_music', music: 'dread' } ]`
- scenery:
  - `bricks, brick, vault, walls` -> "Victorian brick, sweating. It runs under the moor for the best part of a mile."
  - `marks, tally marks, tallies` -> "Gates of five every few yards, scratched by a nail. Someone has walked this tunnel counting it, many times."
  - `iron door, door, bar, beam` -> `[{ if: { at: ['pike', 'counting_room'] }, text: 'Iron, studded, ajar. The beam that barred it has been lifted from the far side and leaned against the wall in there. Whoever went in left himself a way out.' }, { text: 'Iron, studded, shut fast. It is barred on the far side - you can hear the beam shift in its brackets when you push. Beyond it, Harrow is praying.' }]`
  - `steps, rungs` -> "Iron rungs set in the brick at the south end, up to a square hatch in the morgue floor." (TT-131: "rungs", matching the morgue's drawer hatch; the desc says "Iron rungs climb south" where it said "Steps climb south")
  - `ladder` -> "Iron rungs up to the boiler hatch."
- before (TT-131): `knock` -> `THROUGH_THE_DOOR` (the §7.4 knock reaction, as a named const) · `say` -> `[{ if: PIKE_BELOW, say: "Your voice goes through the open door and comes back off brick. Beyond it, someone stops counting, and then starts again." }, THROUGH_THE_DOOR[1]]` (SAY / SHOUT through the door reaches Harrow like a knock) · `listen` -> `[{ if: PIKE_BELOW, say: "Through the open door: a man counting under his breath, slow and patient. And another man, breathing badly." }, { if: { turnGte: 180 }, say: "Behind the iron door Harrow is praying, slower now, losing his place. He is alive. You could KNOCK." }, "Behind the iron door, very faint, a man is praying. You know the voice: Frank Harrow. You could KNOCK."]`
- picture brief: barrel-vaulted brick tunnel in perspective (dark red/brown, black centre), torch cone, small white tally groups on the walls, a studded iron door at the vanishing point. fx `flicker`.

#### `counting_room` - The Counting Room  (dark)
- zone beneath · **dark yes** · safe no · nerve +3 · ambient `counting` · picture `counting_room`
- desc variants:
  - `{ var: 'harrowFreed', eq: true }`: "The Counting Room: a brick vault, a long wages table, iron rings in the wall. On the far wall four great strokes are cut deep into the brick, a gate waiting to be closed. Harrow sits slumped beneath them, the cut chains at his feet. The door is south."
  - (default): "The Counting Room: a brick vault, a long wages table, iron rings in the wall. On the far wall four great strokes are cut deep into the brick, a gate waiting to be closed. Harrow hangs in chains beneath them. The iron door is south."
- NPCs here: `harrow` (from the start), `pike` (from arrival).
- items here: `chains` (fixed item).
- onEnter: see §8.4 (Pike's greeting, bleeding cue). No award on entry.
- scenery:
  - `table, wages table` -> "A long table where the wages were counted out in 1912. Coins are still stuck to it with old wax, in piles of four."
  - `rings, iron rings` -> "Iron rings set in the brick. Harrow is chained to two of them."
  - `strokes, marks, wall, gate` -> "Four strokes, each as long as a man, cut deep with a chisel. Room for one more across them. You understand exactly whose length the fifth is meant to be."
  - `knife, butcher knife` (adj `long, butcher`) -> `[{ if: { var: 'pikeState', eq: 'restrained' }, text: 'On the brick where it fell, well out of his reach. It can stay there for Manchester.' }, { text: "A butcher's knife, a foot of it, honed thin. He holds it low and easy, the way another man would hold a pencil." }]` (TT-105)
  - `tunic, uniform` -> "Pike's tunic, folded square on the wages table. The second button down is missing. A thread hangs where it was." (a noun of its own, so it wins over the button's `tunic button`, A6.3 M4a) (TT-105)
  - `door` (adj `iron`) -> "The iron door to the tunnel, standing ajar. Pike left himself a way out." (TT-105)
  - `vault, brick, bricks, ceiling` -> "Victorian brick, black with damp, low enough to touch. It gives your own breathing back to you." (TT-105)
  - `trap, ladder, rungs, bolt` -> "Iron rungs climb to a trap in the ceiling - the counting house above. Pike's door. It is bolted from this side and his padlock hangs locked through the bolt. His key, not yours." 
  - `beam, bar` -> `[{ if: { at: ['pike', 'counting_room'] }, text: 'The bar that held the iron door, leaned against the wall. Pike lifted it when he came down. His way out.' }, { text: 'The bar is in its brackets across the door.' }]`
- before (TT-131 / TT-130): `listen` -> `[{ if: { var: 'pikeState', eq: 'counting' }, say: "Pike, counting under his breath. Harrow's breathing, wet and shallow. Your own heart.", then: HARROW_CUFFS }, "Harrow's breathing, wet and shallow. Pike's lips moving. The brick drips."]` · `say` -> `[{ if: { var: 'pikeState', eq: 'counting' }, say: "Pike tilts his head and listens to you the way he listens to the rain. Then he goes on counting.", then: HARROW_CUFFS }, { if: { var: 'pikeState', eq: 'restrained' }, say: "Pike doesn't answer. He is counting the links of the cuffs." }, '"Save your breath, kid," says Harrow.']`
- picture brief (torchlit): brick vault, four huge white strokes on the back wall, a chained figure (Harrow: grey hair, white shirt with a dark stain) hanging beneath, a long table foreground. Pike is NOT drawn (state varies). fx `flicker`.

---

## §5 Items

### 5.1 Item table (content order = this order; it drives room listings, A8.4)
Legend: **P** portable · **C** `critical: true` · **H** `hidden: true` · **Pers** `personal: true` ·
**Ev** evidence id · Fixed items say `fixed`/`scenery`. `name` is the display name.

| id | name / `names` / `adjectives` | start `location` | flags | notes |
|---|---|---|---|---|
| `warrant_card` | warrant card / warrant card, card, warrant, id, identification, badge / police, my | `player` | Pers | SHOW CARD works |
| `wallet` | wallet / wallet, money, cash / leather | `player` | Pers | desc shows `{money}` |
| `torch` | torch / torch, flashlight / police, rubber | `waiting_room` | P C | light; `initial` |
| `bench` | bench / bench, seat / wooden, oak | `waiting_room` | scenery, supporter | |
| `coin` | 10p coin / coin, 10p, ten pence, tenpence / ten, small | `bench` | P H | phone only |
| `payphone` | phone / phone, telephone, payphone, receiver, hq, headquarters, cid, manchester / black | `phone_box` | scenery | CALL target |
| `batteries` | batteries / batteries, battery, ever ready / fresh, new | `null` (Maggie) | P C | consumed into torch |
| `room_key` | room key / key, room key / brass, harrow | `null` (Maggie) | P C | opens `u` exit |
| `harrows_door` | door / door / bedroom, harrow, guest | `black_lamb`, alsoIn `harrows_room` | scenery | refusals only |
| `whisky` | bottle of whisky / whisky, whiskey, bottle, scotch, bells / | `null` (bought) | P C | Silas accepts |
| `pint` | pint of mild / pint, mild, beer, glass / | `null` (bought) | P | drinkable |
| `suitcase` | suitcase / suitcase, luggage, bag / brown, harrow | `harrows_room` | fixed, container, openable | |
| `case_map` | map / map, case map / ordnance, survey, harrow | `suitcase` | P | readable, note |
| `harrows_notes` | Harrow's notes / notes, list, names / harrow, victim | `suitcase` | P | readable, note |
| `occurrence_book` | occurrence book / book, occurrence book, log, logbook / occurrence, police | `police_house` | scenery | readable, note |
| `candle_stub` | candle stub / candle, stub, candle stub, wax / melted | `number_13` | scenery, container | button inside |
| `button` | silver button / button, tunic button / silver, police, crown, tunic | `candle_stub` | P C H | **Ev `ev_button`** |
| `dustbin` | dustbin / dustbin, dustbins, bin, bins / metal | `back_alley` | scenery, container | newspaper inside |
| `newspaper` | newspaper / newspaper, paper, bugle / blackmere, wet | `dustbin` | P H | readable (lore) |
| `register` | burial register / register, burial register, parish register, pages / burial, parish | `vestry` | scenery | **Ev `ev_register`** (fact) |
| `memorial` | memorial / memorial, plinth, inscription / | `churchyard` | scenery | readable |
| `loose_stone` | loose stone / stone, loose stone, mortar / loose, proud | `crypt` | scenery | moving reveals letters |
| `love_letters` | bundle of letters / letters, bundle, tin, toffee tin / love | `crypt` | P H | red herring |
| `lock_water` | lock / water, lock, chamber, canal / black, lock | `lock` | scenery | hazard object |
| `shed_door` | shed / shed, shed door, padlock / | `lock` | scenery | refusals only |
| `bolt_cutters` | bolt cutters / bolt cutters, cutters, croppers / bolt, red | `shed` | P C | `initial` |
| `oil_can` | oil can / oil can, oilcan, can / oil, green | `shed` | P C | `initial` |
| `handcuffs` | handcuffs / handcuffs, cuffs, bracelets / police, steel, harrow | `harrows_car` | P C | `initial` |
| `notebook_page` | torn notebook page / page, notebook page, sheet / torn, notebook | `harrows_car` | P | readable, note |
| `crowbar` | crowbar / crowbar, jemmy / iron, rusty | `quarry_hut` | P C | `initial` |
| `rope` | rope / rope, coil / long, coiled | `quarry_hut` | P C | quarry descent |
| `exercise_book` | exercise book / exercise book, jotter, book / swollen, child, school | `quarry_floor` | P | readable (lead) |
| `mill_chain` | gate chain / chain, padlock / gate, heavy | `mill_gates` | scenery | CUT target |
| `ledger` | ledger / ledger, debt ledger, tally book / great, black, 1912 | `counting_house` | scenery, supporter | readable |
| `ledger_page` | loose ledger page / page, ledger page, last page / loose, ledger, last, 1912 | `ledger` | P C | **Ev `ev_ledger`** |
| `iron_trap` | iron trap / trap, trapdoor, iron trap, padlock, disc padlock, hasp / iron, floor, disc | `counting_house` | scenery | Pike's; never opens |
| `boiler_hatch` | hatch / hatch, boiler hatch, manhole, rim / round, iron, boiler, rusty | `boiler_room`, alsoIn `tunnel` | door: fixed, openable | oil, then open |
| `cabinet` | cabinet / cabinet, filing cabinet / steel, rusted, p-r | `records_office` | fixed, openable, locked, container | crowbar |
| `patient_file` | patient file / file, patient file, folder / patient, manila, pike | `cabinet` | P C | **Ev `ev_file`** |
| `drawer_four` | drawer 4 / drawer, drawer 4, drawer four, rails, runners / fourth, four, 4 | `morgue` | fixed | slides -> hatch |
| `drawers` | drawers / drawers, wall / other, steel | `morgue` | scenery | |
| `chains` | chains / chains, chain, shackles, manacles / iron, heavy | `counting_room` | scenery | CUT target |

Disambiguation check (L13): shared nouns among things that can meet in one scope - `page`
(`notebook_page` / `ledger_page`: adjective sets differ), `book` (`exercise_book` carried vs
`occurrence_book` / `register` / `ledger` fixed in their rooms: adjective sets differ), `key`,
`card` (warrant card vs phone-box scenery `card`: items beat scenery, A6.3 M4b), `chain`
(`mill_chain` and `chains` never share a room). `drawers` deliberately does not have the noun
`drawer`. No portable item uses `bar`, `lamp`, `light`, `case` or `cells` (scenery/verb clashes).

### 5.2 Item details (desc, read texts, slots)

**`warrant_card`** - desc: "Your warrant card. The photo makes you look like a suspect. Greater Manchester Police, CID." · personal.

**`wallet`** - desc: "Your wallet. Inside: {money}, a photo you don't look at tonight, and a Barclaycard nobody in Blackmere will take." · personal. · before `open` (TT-131) -> "You thumb it open. {money}, a photo you don't look at tonight, and a Barclaycard nobody in Blackmere will take."

**`torch`** - `initial`: "Someone has left a big rubber police torch on the windowsill."
- desc: `[{ if: { on: 'torch' }, text: 'A police torch, rubber-cased, throwing a good hard beam.' }, { if: 'torch_loaded', text: 'A police torch, loaded with fresh batteries. It is switched off.' }, { text: 'A rubber-cased police torch. You shake it: dead batteries rattle inside. Someone stole the good ones.' }]`
- `light: { lit: false, fuel: 320, needs: 'torch_loaded', needsMsg: 'Click. Nothing. The batteries in it are as dead as Dickens.', outText: 'Your torch dies.' }` (fuel 320 >= 300, so `outText` never shows; L18)
- `after: { turn_on: { award: 'torch_lit' } }`
- `before` (one object, three slots):
  - `turn_on`: `{ if: [{ carried: 'batteries' }, '!torch_loaded'], say: '(First you load the fresh batteries.)', move: { batteries: null }, setFlag: 'torch_loaded', continue: true }` - TURN ON with the batteries in hand just works.
  - `turn_off`: `TORCH_OFF_WARNING`, with `IN_WITH_PIKE = [{ in: 'counting_room' }, { var: 'pikeState', eq: 'counting' }, { on: 'torch' }]`:
    `[{ if: [...IN_WITH_PIKE, '!torch_off_warned'], setFlag: 'torch_off_warned', style: 'alert', say: 'Switch off your only light, with Pike and his knife in here? He counts by touch. You do not. (Do it again if you really mean it.)' }, { if: IN_WITH_PIKE, setFlag: 'dark_warned', continue: true }]`
    - the first consumes the turn (the counter still ticks); a second TURN OFF goes through and, because
    you were warned, sets `dark_warned`, so the attack counter kills on that turn (§8.4). The refusal's
    own flag `torch_off_warned` never arms the counter for a later dark turn (TT-105).
  - `examine` (by touch in the dark, TT-105; with the torch lit in hand the room is lit and the desc above answers): `[{ if: [{ lit: false }, '!torch_loaded'], say: 'By feel: the rubber case, the weight of it, the switch under your thumb. The dead batteries rattle when you shake it.' }, { if: { lit: false }, say: 'By feel: the rubber case, the weight of it, the switch under your thumb. It is switched off. TURN it ON.' }]`
- No `put` slot and no `container`: item slots fire when the item is the direct *or* indirect object
  (A4.7), so a `put` slot here would also block PUT TORCH IN SUITCASE. PUT BATTERIES IN TORCH is
  handled by `batteries.before.put`; PUT COIN IN TORCH gets the engine's "can't put things in that".

**`bench`** - desc: "Scarred oak, carved with initials going back to the war. The slats are far enough apart to lose things in." · `container: { supporter: true }` · scenery.

**`coin`** - desc: "A ten pence piece, 1979. Enough for a phone call." · `found`: "Wedged between the slats of the bench is a 10p coin."
- `before: { use: [{ if: { in: 'phone_box' }, then: CALL_HQ }, "There's no phone here."], put: [{ if: { in: 'phone_box' }, then: CALL_HQ }] }`

**`payphone`** - desc: "A black GPO payphone. Press button A, press button B, the whole palaver. Dial HQ: CALL HQ." · `before: { use: CALL_HQ, call: CALL_HQ }`.

**`batteries`** - desc: "Four Ever Ready batteries, fresh, still in their cellophane." · `criticalMsg`: "They're the only fresh batteries in Blackmere. Hang on to them."
- `before: { put: LOAD_TORCH, use: LOAD_TORCH, replace: LOAD_TORCH }`

**`room_key`** - desc: "A brass Yale on a wooden tag: 3. Harrow's room." · `before: { use: "You'll let yourself in when you go upstairs.", unlock: "You'll let yourself in when you go upstairs." }`

**`harrows_door`** - desc: "Room 3, at the top of the stairs." · `before: { open: HARROWS_DOOR, unlock: HARROWS_DOOR }` with
`HARROWS_DOOR = [{ if: 'entered_harrows_room', say: "You left it on the latch. Just go UP." }, { if: { carried: 'room_key' }, say: "You've got Maggie's key. Just go UP." }, "Locked. Maggie keeps the keys behind the bar."]`

**`whisky`** - desc: "A half-bottle of Bell's. Maggie's price, Silas's poison." · `criticalMsg`: "That's for Silas. Hang on to it." · no `drinkable` (L18): DRINK WHISKY -> criticalMsg. · before `buy` (TT-131): `{ if: [{ hook: 'for_silas' }, '!heard_of_silas'], setFlag: 'heard_of_silas', continue: true }` - BUY WHISKY FOR SILAS says who it is for, which is all Maggie is waiting to hear.

**`pint`** - desc: "A pint of mild, dark and flat, a thumb of foam." · `drinkable: { say: 'Flat, brown and wonderful. Your hands steady a little.', nerve: -10 }`.

**`suitcase`** - desc: "A brown suitcase, labels from Blackpool and Benidorm. Frank's holiday case, for a working trip." · `openable: true, open: false` · `container: {}` · `fixed`: "It's Frank's. You'll look through it here."

**`case_map`** - desc: "An Ordnance Survey map of Blackmere, marked in biro." · `readable`:
`{ setFlag: 'heard_of_silas', say: "Harrow's biro: the mill circled twice. Ashcombe Asylum, on the moor north of the tally stone, circled. At the canal lock: 'S. THORNE - saw something?' And by the Police House, a question mark, scribbled out.", note: 'case_map' }` (`heard_of_silas`: the map names S. THORNE, so Maggie will sell the whisky - §7.1 "Maggie / map / visit", TT-105.)

**`harrows_notes`** - desc: "A sheet of Frank's handwriting. You know it from a hundred reports." · `readable`:
`{ say: 'ASHWORTH 18/10. CRABTREE 25/10. HOLT 1/11. MARSH 8/11. All Thursdays. All old mill names. Then, underlined twice: TALLY = DEBT. Who keeps the book? And smaller, at the bottom, in a different pen: Harrow.', note: 'harrow_list' }`

**`occurrence_book`** - desc: "The station occurrence book, open at today. Pike's round, careful hand." · readable (also `before.examine`, same reaction, so EXAMINE works as READ):
`{ say: '15/11/84. 09:00 On duty. 14:10 DI Harrow (Manchester) called in, enquired re: Ashcombe. 20:35 Out on patrol - Moor Road. 21:20 Returned. Nothing to report. 21:30 Kettle on.', note: 'pike_patrol', then: { if: { present: 'pike' }, say: '"Just my rounds, Sergeant," says Pike, watching you read. "Nothing to report."' } }`

**`candle_stub`** - desc: "A church candle, burned down to a stub and melted to the skirting. Somebody knelt here for a long time." · `container: {}` · scenery. (SEARCH / SEARCH CANDLE / LOOK IN WAX reveals the button.)

**`button`** - desc: "A silver tunic button, crown and all - police issue. A thread still hangs from its shank. Only one man in Blackmere wears buttons like this." · `found`: "Pressed into the cold wax of the candle stub, half buried, is something silver: a button."

**`dustbin`** - desc: "A dented bin, lid off, full of rain and potato peelings." · `container: {}` · scenery.

**`newspaper`** - desc: "The Blackmere Bugle, sodden but legible." · `found`: "Folded on top of the rubbish in the bin is this week's Bugle." · `readable`:
"THE TALLYMAN STRIKES FOURTH TIME. Retired teacher Ivy Marsh (66) found dead at home, No.13 Chapel Street. Like Edna Ashworth, Walter Crabtree and Dennis Holt before her, four strokes scratched beside the body. Police 'following several lines of inquiry'. PC Arthur Pike: 'Lock your doors on a Thursday.' Inside: MILL TO BE PULLED DOWN."

**`register`** - desc: "The burial register of St Jude's, 1890 to 1950. Foxed pages, copperplate, a lot of children. You could READ it." · `fixed`: "It's chained to the desk, and it weighs as much as a font." · `readable` = `READ_REGISTER` (EXAMINE gives the desc above, which tells you to READ it):
`READ_REGISTER = { say: 'You turn to November 1912. A page and a half in the same tired hand, fourteen names, all buried on the 20th: ...Alice Crowther, 13. Nellie Dawson, 15. Mary Pike, 14, half-timer, d. 15 Nov 1912. Lily Platt, 12... Pike. You think of the big kind constable and his tea.', evidence: 'ev_register' }`
(The `ev_register` evidence entry carries `note: 'mary_pike'` and `award: 'register'`; repeat reads just re-say the text.)

**`memorial`** - desc: "A stone girl on a plinth. An inscription below." · `readable`: "IN MEMORY OF THE FOURTEEN. 15 NOVEMBER 1912. THEIR TALLY IS WITH GOD. The names beneath have weathered away to nothing. The burial register in the vestry would have them."

**`loose_stone`** - desc: "One stone in the wall, its mortar picked out and the dust around it disturbed." · `before: { move: MOVE_STONE, pull: MOVE_STONE, push: MOVE_STONE, take: MOVE_STONE, search: MOVE_STONE }` with
`MOVE_STONE = [{ if: '!letters_found', reveal: 'love_letters' }, 'Behind it there is only a hollow where the tin was.']`
(`love_letters.found` sets `letters_found` and says the text. SEARCH (room) reveals the letters the same way.)

**`love_letters`** - desc: "A toffee tin holding a bundle of letters tied with blue ribbon. The top one begins 'My dearest C.'" · `found`: `{ setFlag: 'letters_found', say: 'You ease out the loose stone. Behind it is a Quality Street tin, and inside, a bundle of letters tied with blue ribbon.' }` · `readable`:
"Letters, dozens, since Easter. 'My dearest C.' ... 'the 8th, Thursday, I'll leave the back door' ... 'all night, and nobody the wiser' ... signed, every time, 'M.' A vicar's secret. Not a murderer's."

**`lock_water`** - desc: "Ten feet down, black water churning between the gates. It would pull you under and hold you there." · scenery.

**`shed_door`** - desc: `[{ if: 'shed_open', text: 'The shed door stands open. Silas has taken his padlock off.' }, { text: "A tarred shed with a padlock the size of a fist. Silas's padlock, Silas's shed." }]` · `before: { open: SHED, unlock: SHED, break: SHED, cut: SHED, pry: SHED }`, `SHED = [{ if: 'shed_open', say: "It's open. Go EAST." }, "It's Silas's padlock on Silas's shed. Ask Silas."]`

**`bolt_cutters`** - `initial`: "A pair of long-handled bolt cutters hangs inside its painted outline." · desc: "Two-foot bolt cutters, red handles, jaws that would take a finger off. They'd go through a padlock chain like string." · `before: { use: [{ if: { present: 'mill_chain' }, then: CUT_CHAIN }, { if: { present: 'chains' }, then: CUT_CHAINS }, 'Nothing here needs cutting.'] }`

**`oil_can`** - `initial`: "A green oil can with a long spout stands on the bench." · desc: "A pump-action oil can, half full. It smells of every bicycle you ever owned." · `before: { use: OIL_USE, put: [{ if: { present: 'boiler_hatch' }, then: OIL_HATCH }], pour: OIL_USE }`, `OIL_USE = [{ if: { present: 'boiler_hatch' }, then: OIL_HATCH }, "You'd waste it. Save it for something rusty."]`

**`handcuffs`** - `initial`: "A pair of police handcuffs lies on the passenger seat, dropped in a hurry." · desc: "Hiatt handcuffs, Frank's. The key is in the lock. He never got the chance to use them." · `before: { use: [{ if: { present: 'pike' }, then: ARREST_PIKE }, "There's nobody here who needs cuffing."], put: [{ if: { present: 'pike' }, then: ARREST_PIKE }] }`

**`notebook_page`** - `initial`: "A torn notebook page lies in the footwell." · desc: "A page torn from Frank's notebook, written fast, the biro skidding." · `readable`: `{ say: "'Ledger at the mill names them. Ashcombe - 1970s files. The boy who counted.' Underneath, pressed so hard it tore the paper: 'IT'S'", note: 'notebook' }`

**`crowbar`** - `initial`: "A crowbar leans in the corner, rusty but sound." · desc: "Three feet of iron, a claw at one end. The quarrymen's. It would lever open anything that rust has shut." · `before: { use: [{ if: { present: 'cabinet' }, then: PRY_CABINET }, { if: { present: 'drawer_four' }, then: MOVE_DRAWER }, { if: { present: 'iron_trap' }, then: TRAP }, 'Nothing here wants levering.'] }`

**`rope`** - `initial`: "A long coil of rope hangs from a nail." · desc: "Sixty feet of hemp, stiff with cold but sound. Enough to get down a quarry face, with something to tie it to."
- `before: { tie: TIE_ROPE, use: TIE_ROPE }` (TT-105: the winch post says "You could tie a rope to that", so at the edge, rope in hand, TIE ROPE (TO POST) / USE ROPE is the climb down - the same as DOWN; `quarry_floor.onEnter` tells it the first time):
  `TIE_ROPE = [{ if: [{ in: 'quarry_edge' }, { carried: 'rope' }, 'climbed_down'], say: 'You loop the rope round the winch post again and go down it hand over hand.', movePlayer: 'quarry_floor' }, { if: [{ in: 'quarry_edge' }, { carried: 'rope' }], movePlayer: 'quarry_floor' }, { if: { in: 'quarry_edge' }, say: "You'll want to be holding it first." }, "There's nothing here worth tying it to."]`

**`exercise_book`** - `initial`: "A child's exercise book lies swollen beside the fire ring." · desc: "A school exercise book, swollen with rain and dried out and swollen again. On the cover in careful capitals: A.P. FORM 2." · `readable`: "Page after page of tally marks, gates of five, row on row - and then, halfway through, only fours. Four, four, four, never the fifth stroke, as if the hand refused it. On the last page, in a boy's capitals: WHEN THE TALLY IS SETTLED SHE CAN STOP."

**`mill_chain`** - desc: `[{ if: 'mill_chain_cut', text: 'Cut through. It hangs from one bar like a dead snake.' }, { text: 'A chain as thick as your wrist, wound through the bars and padlocked to itself. New padlock, old chain.' }]` · `before: { cut: CUT_CHAIN, break: CUT_CHAIN, open: CUT_CHAIN, unlock: CUT_CHAIN }`

**`ledger`** - desc: "The tally book of Ashworth's Mill, 1912, bound in black, the size of a gravestone. The last page has torn almost free and hangs by a thread." · `fixed`: "It weighs as much as a child. You couldn't carry it if you wanted to." · `container: { supporter: true }` · `readable`: "Debts, in a clerk's copperplate: what each girl owed the company shop, week by week, in shillings and pence. The sums never go down. The last page - the one hanging loose - is different." · `before: { attack: 'The ledger is unmoved by your violence.', tear: TEAR_PAGE }`

**`ledger_page`** - desc: "The last page of the 1912 ledger, loose." · `readable`:
"Two columns. On the left, headed SHED DOOR - 15th Novr 1912 - TO BE KEPT LOCKED UNTIL THE TALLY IS SETTLED, five names: J. Ashworth. W. Crabtree. T. Holt. E. Marsh. J. Harrow (bailiff, key). On the right, HALF-TIMERS OWING, a list of girls, and halfway down: Pike, Mary, 14 - 3s 4d."
· `before: { tear: TEAR_PAGE }`, `TEAR_PAGE = [{ if: { not: { carried: 'ledger_page' } }, give: 'ledger_page', say: 'You tease the page free. It comes away with a sigh of old paper.' }]` (carried: critical protection answers first, A8.7).

**`iron_trap`** - desc: `[{ if: { at: ['pike', 'counting_room'] }, text: "The iron trap, its padlock gone. Bolted from beneath. Pike's door is shut behind him." }, { text: 'An iron trap two feet square, a squat disc padlock through the hasp. The steel round the keyhole is bright with use. Someone comes and goes here, often.' }]`
· `before: { open: TRAP, unlock: TRAP, cut: TRAP, break: TRAP, pry: TRAP, pull: TRAP }`,
`TRAP = [{ if: { at: ['pike', 'counting_room'] }, say: 'Bolted from beneath. It does not give a fraction.' }, "A disc padlock: no shackle for cutters to bite on, no gap for a crowbar. Pike's lock, Pike's key. There'll be another way down - there always is, in a mill."]`
(LISTEN / LISTEN TO TRAP is handled by the room's `before.listen`, §4.4, which runs first.)

**`boiler_hatch`** - desc: `[{ if: { open: 'boiler_hatch' }, text: 'The round iron hatch, open, a ladder going down.' }, { if: 'hatch_oiled', text: 'A round iron hatch. The oil has soaked into the rust round the rim.' }, { text: 'A round iron hatch, rusted to its frame all the way round. It would want oil before it moved.' }]`
· `openable: true, open: false` · `fixed: true` · alsoIn `tunnel` ·
`before: { open: [{ if: '!hatch_oiled', say: 'You heave. Nothing. Rust has welded the rim to the frame. It wants oil.' }], oil: OIL_HATCH }`
· `after: { open: { sfx: 'hatch' } }` (engine also emits `door` for door items; both is fine).

**`cabinet`** - desc: `[{ if: { open: 'cabinet' }, text: 'A steel cabinet marked P-R, its drawer levered open.' }, { text: 'A steel filing cabinet marked P-R. Rust has sealed every seam. You would need to lever it.' }]` · `openable: true, open: false, locked: true` (no `keyId`) · `container: {}` ·
`before: { open: PRY_CABINET, unlock: PRY_CABINET, break: PRY_CABINET, pry: PRY_CABINET, oil: OIL_CABINET }`,
`OIL_CABINET = [{ if: { open: 'cabinet' }, say: "It's open. It doesn't need oil." }, { if: { carried: 'oil_can' }, say: "You dribble oil along the seams. The rust drinks it and gives nothing back. It isn't a stiff hinge - the whole drawer has rusted into one piece. That wants levering, not oiling." }, "Oil wouldn't shift that much rust anyway. It wants levering open."]` (TT-131: OIL CABINET with the can said "You have nothing suitable to oil the cabinet with."),
`PRY_CABINET = [{ if: { open: 'cabinet' }, say: "It's open." }, { if: { carried: 'crowbar' }, setItem: { cabinet: { locked: false, open: true } }, sfx: 'creak', say: '(with the crowbar) You jam the claw into the seam and lean. The rust gives with a shriek and the drawer lurches out.' }, "Rusted solid. You'd need something to lever it with."]`

**`patient_file`** - desc: "A manila patient file, damp-spotted: ASHCOMBE HOSPITAL - ADOLESCENT UNIT - PIKE, A. - 1971/0413." · `readable`:
`{ say: 'PIKE, Arthur. Admitted 3.5.71, aged 13, following death of mother. Obsessional counting (gates of five; cannot complete the fifth stroke). Fixed delusion of a family debt "owed to Mary" to be "settled in full". Night staff report: "the boy kept to the morgue - the drawer that does not close". Discharged 1975, improved. Prognosis: guarded.', note: 'morgue_drawer' }`

**`drawer_four`** - desc: `[{ if: 'morgue_hatch_found', text: 'Drawer 4, run back into the wall. The hatch yawns beneath it.' }, { text: 'Drawer 4 stands a finger-width proud of the rest. It does not close. Its runners shine with grease - the only clean metal in the room.' }]` ·
`before: { open: MOVE_DRAWER, pull: MOVE_DRAWER, push: MOVE_DRAWER, move: MOVE_DRAWER, close: MOVE_DRAWER, search: 'Empty, and cleaner than it should be. The rails it runs on are greased. It moves more than a drawer should.' }`,
`MOVE_DRAWER = [{ if: 'morgue_hatch_found', say: 'It has run back as far as it goes. The hatch is open beneath it.' }, { setFlag: 'morgue_hatch_found', sfx: 'creak', say: "You put your weight against drawer 4. It doesn't open - it slides, the whole drawer running back into the wall on greased rails. Where it stood, iron rungs drop into a square hatch. Cold air comes up, smelling of brick and canal." }]`

**`drawers`** - desc: "Eight steel drawers. Seven are rusted shut and empty. Number 4 does not sit flush." · `before: { open: 'Rusted shut, all but number 4.', pull: 'Rusted shut, all but number 4.' }`

**`chains`** - desc: `[{ if: { var: 'harrowFreed', eq: true }, text: 'Cut, lying on the floor in loops.' }, { text: "Heavy chain from Harrow's wrists to two rings in the wall, padlocked. Cutters would do it." }]` · `before: { cut: CUT_CHAINS, break: CUT_CHAINS, open: CUT_CHAINS, unlock: CUT_CHAINS, pull: 'Set in the brick. They will not pull out.' }`

---

## §6 NPCs, topics, GIVE / SHOW / BUY

### 6.1 Topic keyword table (`content.topics`, declaration order = match priority, A4.9)
Specific before general. Items and NPCs are topics by their own names (step 2), so they are not
repeated here (e.g. ASK ABOUT BUTTON -> topic `button`; ASK ABOUT SILAS -> `silas`).

| id | `names` (keywords) |
|---|---|
| `t_mary` | mary, mary pike |
| `t_counting_room` | counting room, vault, under the mill |
| `t_alibi` | alibi, the 8th, eighth, last thursday, whereabouts, where were you (TT-131: moved above `t_counting`, so "last thursday" stays an alibi question) |
| `t_counting` | counting man, counting, cape, man in a cape, thursday, thursdays (TT-131) |
| `t_tunnel` | tunnel, passage, morgue |
| `t_room` | harrow room, his room, room, rooms, guest room, guest rooms, room three (TT-131; only Maggie answers it) |
| `t_door` | iron door, door, beam |
| `t_patrol` | patrol, rounds, moor road, beat |
| `t_murders` | murders, murder, killings, killing, victims, deaths, bodies, ashworth, crabtree, holt, marsh, ivy, edna, walter, dennis |
| `t_tally` | tally, tallyman, tally man, tally marks, strokes, tallies, debt, debts, killer, murderer (TT-131) |
| `t_fire` | fire, 1912, fourteen, mill girls, girls, blaze |
| `t_mill` | mill, ashworths, counting house, demolition |
| `t_asylum` | asylum, ashcombe, hospital, loony bin, madhouse |
| `t_crypt` | crypt, cellar, downstairs |
| `t_change` | change, ten pence, phone, coin, 10p |
| `t_drink` | drink, pint, mild, beer, bitter |
| `t_light` | light, dark, batteries, battery |
| `t_ghost` | ghost, mill girl, apparition, spirit |
| `t_god` | god, prayer, faith, church, jude |
| `t_quarry` | quarry, quarry hut, tools |
| `t_self` | yourself, himself, herself, you |

(`t_light` deliberately catches "batteries" before the item `batteries`, so ASK MAGGIE ABOUT
BATTERIES works before the batteries exist in the world.)

### 6.2 `maggie` - Maggie Pollard (`black_lamb`, never moves)
- `name` Maggie · `names` maggie, landlady, pollard, mrs pollard, woman, margaret · `proper`
- `here`: "Maggie is behind the bar, polishing a glass that is already clean."
- `desc`: "Fifty, sharp-eyed, hair set on Saturday and defended since. Cardigan, pearls, a tea towel over one shoulder. She watches you the way she watches the till."
- `talk`: `[{ if: '!maggie_saw_card', say: '"Now then. You\'ll be the one from Manchester, come after Mr Harrow. Got anything to prove it, love?"' }, '"Still here, love? Ask away."']`
- `shows`:
  - `warrant_card`: `[{ if: ['!maggie_saw_card', '!got_batteries'], setFlag: ['maggie_saw_card', 'got_batteries'], give: ['room_key', 'batteries'], sfx: 'pickup', say: SHOW_FULL }, { if: '!maggie_saw_card', setFlag: 'maggie_saw_card', give: 'room_key', sfx: 'pickup', say: SHOW_KEY }, '"Yes, love, I\'ve seen it. Very nice photo."']`
    - SHOW_FULL: `"Oh! Right you are, Sergeant." She fishes under the bar. "His key - room three, top of the stairs. Went out at eight and never touched his tea. And you'll want these, wandering about in the dark - they were for the jukebox." She slides a brass key and a packet of Ever Readys across the bar.`
    - SHOW_KEY: `"Oh! Right you are, Sergeant. His key - room three, top of the stairs." She slides a brass key across the bar.`
  - `button`: `'"Off a uniform, that." She looks at it, then away. "Lots of uniforms about."'`
  - `ledger_page`: `'"I don\'t want to see that." She doesn\'t look.'`
  - `patient_file`: `'Her hand goes to her pearls. "Where did you get that? Leave the lad alone. He got better."'`
  - `love_letters`: `{ setFlag: 'alibi_known', note: 'alibi', say: '"Oh." She sits down for the first time all night. "You\'ve been in his crypt. All right. I was with Clement on the eighth. All night. And you can keep that to yourself, Sergeant."' }`
  - `handcuffs`: `'"Put them away, love. You\'re frightening the regulars."'`
- `sells`:
  - `whisky: { price: 200, if: 'heard_of_silas', refuse: '"Whisky? You\'re on duty, love. Unless it\'s for somebody who needs loosening up."', text: '"For Silas, is it? He\'ll talk for a drop of this." She wraps a half-bottle of Bell\'s in a Bugle and slides it across. "Two pound." You pay her, and the bottle is yours.' }` (TT-131: the last sentence; a tester had to check his inventory to see he had bought it)
  - `pint: { price: 50, if: { any: [{ moneyGte: 260 }, 'silas_told'] }, refuse: '"Not with what\'s left in your wallet, love. Keep summat back."', text: 'She pulls you a pint of mild. "Fifty pence. On the house would be bribery."' }`
  - (money invariant: until Silas has his whisky, pints and the 10p never take the balance below 200p, so the whisky can always be bought - §13.)
- `topics`:

| topic | reply (Reaction) |
|---|---|
| `t_light`, `torch` | `[{ if: 'got_batteries', say: '"You\'ve had the last ones I had, love."' }, { setFlag: 'got_batteries', give: 'batteries', sfx: 'pickup', say: '"Batteries? There\'s a packet behind the bar for the jukebox. Here - it\'s not like anyone dances." She hands you four Ever Readys.' }]` |
| `harrow` | `[{ if: '!maggie_saw_card', say: '"Mr Harrow? And who\'s asking, love?"' }, '"Went out at eight, said he\'d be back for his tea. Asked me all sorts last night - the mill, the old families. Asked about Arthur, an\' all, which I didn\'t care for."']` |
| `silas`, `t_counting` | `{ setFlag: 'heard_of_silas', say: '"Silas Thorne? Lock-keeper, down the canal past the bridge. Daft as a brush and twice as old. Mind, he sees things - says a man walks the towpath of a Thursday, counting. He\'ll talk for a drop of whisky, that one, and not before."' }` |
| `whisky` | `[{ if: 'heard_of_silas', say: '"For Silas? Two pound. Just say so."' }, '"Whisky? On duty? Get away. Unless it\'s for somebody."']` |
| `t_drink` | `'"Pint of mild? Fifty pence."'` |
| `t_change` | `[{ if: 'phoned', say: '"You\'ve had your call, love."' }, { if: [{ at: ['coin', null] }, { moneyGte: 210 }], money: -10, give: 'coin', say: '"For the phone? Here." She rings up NO SALE and hands you a ten pence piece. "I\'ll take it off your slate."' }, { if: { at: ['coin', null] }, say: '"Not with what\'s left in your wallet, love."' }, { if: { carried: 'coin' }, say: '"You\'ve got a 10p, love. I saw it."' }, '"Try down the back of the station bench. Half Blackmere\'s change is down there."']` |
| `pike` | `'"Arthur? Salt of the earth. Counts his change twice, mind - always has. He was away a few years as a lad. Poorly. We don\'t talk about it." She polishes the glass harder.'` |
| `t_asylum` | `'"Ashcombe? Up past the stone. Closed now, thank God. Some of the town\'s own went up there. Some came back." She looks at the door.'` |
| `t_fire` | `'"Fourteen girls. Every family in Blackmere lost someone, or knew someone who did. That\'s the trouble with this town, love. It doesn\'t forget anything."'` |
| `t_mary` | `'"Mary Pike? Before my time, love. There\'s always been Pikes in Blackmere."'` |
| `t_murders` | `'"Edna, Walter, Dennis, Ivy. I served every one of them in here. Nobody goes out on a Thursday now."'` |
| `t_tally` | `'"The Tallyman? Kids\' story. Debt-collector at the mill, locked the girls in for what they owed. Mothers use him to get kiddies to bed." She doesn\'t smile.'` |
| `t_mill` | `'"Coming down next month. About time. Nothing good ever came out of that place but wages, and not enough of them."'` |
| `t_counting_room` | `'"Under the mill, my grandad said - where they made up the wages. Never seen it. Never wanted to."'` |
| `ashdown` | `'A little colour in her cheeks. "The vicar is a good man. Whatever folk say."'` |
| `t_alibi` | `[{ if: 'alibi_known', say: '"I\'ve told you. I was with Clement. Leave it there."' }, '"Where was I? Here, love. Where I always am."']` |
| `t_ghost` | `'"Silas\'ll tell you all about her. I won\'t."'` |
| `t_self` | `'"Me? Twenty years behind this bar. Widowed in \'81. Don\'t you start."'` |
| `t_crypt` | `'"Ask the vicar." Too quickly.'` |
| `t_room` (TT-131) | `[{ if: 'maggie_saw_card', say: '"Room three, top of the stairs. You\'ve got his key, love."' }, '"Mr Harrow\'s room? Not to just anybody. Show me something official and we\'ll see."']` |
| `maggie` (her own names: ASK MAGGIE ABOUT MARGARET; TT-131) | `[{ if: 'letters_found', say: 'She stops polishing. "Margaret\'s my Sunday name, love. Nobody calls me it." A beat. "Nearly nobody."' }, '"Me? Twenty years behind this bar. Widowed in \'81. Don\'t you start."']` |

- `default`: `'"Can\'t help you there, love."'` · `refuse`: `'"That\'s kind, love, but no."'`
- `before.attack`: `'"Try that again and you\'re barred, Sergeant." The regulars look up for the first time.'`

### 6.3 `pike` - PC Arthur Pike (`police_house`; schedule; finale)
- `name` Pike · `names` pike, arthur, arthur pike, constable, pc, policeman, bobby · `proper`
- `here`: `[{ if: { var: 'pikeState', eq: 'restrained' }, text: 'Arthur Pike kneels by the wall in Harrow\'s handcuffs, lips moving.' }, { if: { var: 'pikeState', eq: 'counting' }, text: 'Arthur Pike stands between you and Harrow, a long knife held low, counting under his breath.' }, { text: 'PC Arthur Pike sits behind the counter with a mug of tea, tapping a pencil. Tap tap tap tap. Pause.' }]`
- `desc`: `[{ if: { var: 'pikeState', eq: 'restrained' }, text: 'Cuffed, on his knees. Without the helmet he looks very young. He is counting the links of the cuffs, over and over.' }, { if: { var: 'pikeState', eq: 'counting' }, text: 'Pike, in shirtsleeves, a long butcher\'s knife held low. His tunic hangs on the wages table, the second button missing. He does not blink.' }, { if: { found: 'ev_button' }, text: 'A big young constable, soft-spoken, older than his years. Tunic buttoned to the throat - all but the second button, which is missing. A thread hangs where it was.' }, { text: 'PC Arthur Pike: a big young constable, ruddy, soft-spoken, older than his years. Tunic buttoned to the throat, every button polished. He taps his pencil on the desk in fours.' }]`
- `talk`: `'"Now then, Sergeant. Cup of tea? You look perished. Mr Harrow, is it? He\'ll turn up. They always turn up."'` (in the Counting Room `before.talk` handles it, below)
- `before` (Counting Room voice - fires only there, so desk topics are untouched):
  - `ask`, `tell`, `talk`: `[{ if: [{ in: 'counting_room' }, { var: 'pikeState', eq: 'restrained' }], say: '"I would have stopped at five," he says. "Five is a gate. You close a gate."' }, { if: { in: 'counting_room' }, pick: ['"Four," he says, not to you. "Four, and one to settle."', '"She was fourteen, Sergeant. Somebody has to keep the book."', '"Don\'t make me count you, Sergeant. You\'re not in the ledger."'], then: HARROW_CUFFS }]` (TT-130: `then: HARROW_CUFFS`, §7.3)
  - `show`, `give` (TT-130, Counting Room only - the desk `shows` / `refuse` are untouched): `[{ if: [{ in: 'counting_room' }, { var: 'pikeState', eq: 'restrained' }], say: 'He does not look up. He is counting the links of the cuffs.' }, { if: { in: 'counting_room' }, say: 'He doesn\'t look at it. He looks at you, measuring the floor between you. "I keep my own book, Sergeant."', then: HARROW_CUFFS }]`. (GIVE of a critical item is refused by protection first: "You'd better hang on to that.")
  - `arrest` (also via `put`/`use` of the handcuffs): `ARREST_PIKE` (§7.2)
  - `attack`: `[{ if: { var: 'pikeState', eq: 'restrained' }, say: 'He is cuffed and on his knees. That isn\'t who you are.' }, { if: { var: 'pikeState', eq: 'counting' }, say: 'He is quicker with that knife than you are with your fists. Cuffs, not fists.' }, '"Steady on, Sergeant." He doesn\'t even stand up. You are suddenly very aware of how big he is.']`
- `shows`:
  - `button`: `{ nerve: 5, say: '"A button?" He doesn\'t look at it. He looks at you. "I was first in at Ivy Marsh\'s, Sergeant. Could\'ve come off anyone." His hand has gone to his tunic.' }`
  - `ledger_page`: `'"Old paper. Mill\'s full of it." He reads it upside down without meaning to. His lips move: one, two, three, four, five.'`
  - `patient_file`: `'"That\'s private, that." Very quietly. "That\'s mine."'`
  - `handcuffs`: `'"Mr Harrow\'s? Where did you find those?" A beat too late: "Is he all right?"'`
  - `warrant_card`: `'"Very nice, Sergeant. I\'ve got one too, somewhere."'`
- `refuse`: `'"No thank you, Sergeant. Can\'t accept gifts. Regulations."'` · `default`: `'"Can\'t help you there, Sergeant. Cup of tea?"'`
- `topics` (desk):

| topic | reply |
|---|---|
| `harrow` | `'"Mr Harrow? Came in this afternoon asking after the old asylum records. Off up the moor, last I heard. Grand fella. Bit sure of himself."'` |
| `t_murders` | `'"Four in four weeks. I\'ve walked every street every Thursday. He\'s cleverer than me, whoever he is." He taps the pencil. Four times.'` |
| `t_tally` | `'"Kids\' tale. Folk round here never forget a debt, that\'s all it means."'` |
| `t_fire` | `'"Fourteen lasses. Terrible thing. Before anyone\'s time, Sergeant. Best left."'` |
| `t_mary` | `'"Mary?" The pencil stops. Then it starts again. "There\'s always been Pikes in Blackmere, Sergeant. Common as muck, us."'` |
| `t_asylum` | `'"Ashcombe? Closed in \'79. Nowt up there but pigeons." He doesn\'t look up.'` |
| `t_mill`, `t_counting_room` | `'"The mill? Been up there yet, have you?" Mild, interested. "Mind the gates. Chained. Council\'s orders."'` |
| `button` | `[{ if: { carried: 'button' }, say: '"A button?" He doesn\'t look at it. "I was first in at Ivy Marsh\'s, Sergeant. Could\'ve come off anyone."' }, '"Buttons, Sergeant?"']` |
| `handcuffs` | `'"Never had call to use mine. Not in Blackmere."'` |
| `silas`, `t_counting` | `'"Silas Thorne? Harmless. Sees things. Counting men in capes." He smiles. "You don\'t want to listen to Silas."'` |
| `maggie` | `'"Our Maggie? Known her all my life. She brought me grapes, when I was poorly."'` |
| `ashdown` | `'"The vicar\'s been jumpy. You might ask him where he goes of a night."'` |
| `t_patrol`, `occurrence_book` | `'"Out on my rounds, Sergeant. Moor road, up to the stone and back. Saw nowt. Fog." Tap tap tap tap.'` |
| `t_tunnel` | `'"Tunnel? Never heard of one." Too quick.'` |
| `patient_file` | `'"Ashcombe kept files on half the town, Sergeant." His face does not move at all.'` |
| `t_self` | `'"Me? Born here, schooled here, never wanted owt else. Four years in the job." Tap tap tap tap.'` |

- `schedule`: `[{ at: 240, to: null, if: { var: 'pikeState', eq: 'desk' }, leaveText: 'Pike looks at the clock. "Half eleven. That\'s me off on my rounds, Sergeant. Pull the door to if you go." He takes his cape from the peg and goes out into the rain, counting the steps down to the street.', do: { setVar: { pikeState: 'left', pikeArrivalTurn: { turnPlus: 10 } } } }]` (leaves on turn 240, arrives turn 250 = 23:35; the `fled` delay is 5, A14.3).

### 6.4 `ashdown` - Rev. Clement Ashdown (`st_judes`, never moves)
- `name` Reverend Ashdown · `names` ashdown, vicar, reverend, priest, clement, rev, parson · `proper`
- `here`: "The Reverend Ashdown hovers by the candles, glancing at the crypt steps."
- `desc`: "Tall, stooped, sixty, a cardigan under his cassock. His hands will not keep still. He smells of candle smoke and Polo mints."
- `talk`: `'"Ah. Sergeant. Terrible business. Terrible. Can I - is there something?" He has put himself between you and the crypt steps.'`
- `shows`: `love_letters`: `ALIBI` · `button`: `'"From a uniform, surely." He looks at you, then away, then at the door.'` · `ledger_page`: `'"Pike, Mary." He reads it twice. "Oh, dear God. Oh, Arthur."'` · `patient_file`: `'"I can\'t. I\'m sorry. I was chaplain there."'` · `warrant_card`: `'"Yes, yes, of course."'`
- `ALIBI = { setFlag: 'alibi_known', note: 'alibi', say: '"Where did you - oh, God." He sits down heavily in a pew. "Yes. M. is Margaret Pollard. On the eighth, the night Ivy died, I was with her. All night. Ask her. Please don\'t ask anyone else."' }`
- `topics`:

| topic | reply |
|---|---|
| `t_fire`, `t_mary`, `register` | `'"The Fourteen. We remember them every fifteenth of November - tonight, in fact. The families wanted the names kept in the burial register, not on the wall. It\'s on the desk in my vestry. Look, by all means."'` |
| `t_murders` | `'"I buried three of them. I\'ll bury Ivy on Monday. \'The Lord seeth not as man seeth.\' Or something very like it."'` |
| `t_tally` | `'"Superstition. Though I confess I don\'t walk past the mill on a Thursday."'` |
| `t_crypt` | `'"The crypt? Nothing down there. Damp. Coffins. Nothing at all." He licks his lips.'` |
| `love_letters` | `[{ if: { carried: 'love_letters' }, then: ALIBI }, '"Letters? What letters?"']` |
| `t_alibi` | `[{ if: 'alibi_known', say: '"I\'ve told you. I was with Margaret."' }, '"The eighth? I was here. Praying. Alone. Quite alone."']` |
| `maggie` | `'"Mrs Pollard is a pillar of the parish." Too quickly.'` |
| `pike` | `'"Arthur? A sad boy, once. A good man now, I think. He tends the memorial, did you know? Every week. Polishes the plaques. Counts them, I sometimes think."'` |
| `harrow` | `'"Your inspector sat with the register for an hour yesterday. Then he asked me about Arthur." He frowns. "I wondered why."'` |
| `t_asylum`, `patient_file` | `'"I was chaplain at Ashcombe until it closed. I may not speak about patients, Sergeant." A pause. "Even the ones who still live in the parish."'` |
| `silas`, `t_counting` | `'"Silas sees what he sees. I have never once known him lie."'` |
| `t_god` | `'"I pray, Sergeant. I am not always sure who listens."'` |
| `t_ghost` | `'"There\'s no such thing." He crosses himself, which the Church of England does not encourage.'` |
| `t_self` | `'"Thirty years in Blackmere. My wife is - at her sister\'s. In Harrogate."'` |

- `default`: `'"I really couldn\'t say, Sergeant."'` · `refuse`: `'"Oh - no, no, thank you."'` · `before.attack`: `'"Sergeant!" He backs into the pews, hands up.'`

### 6.5 `silas` - Silas Thorne (`lock_cottage`, never moves)
- `name` Silas · `names` silas, thorne, silas thorne, lock keeper, lock-keeper, keeper, old man · `proper`
- `here`: `[{ if: 'silas_told', text: 'Silas rocks by the heater with the bottle in his lap, the whippet at his feet.' }, { text: 'Silas Thorne rocks in his chair by the heater, muttering, a whippet at his feet.' }]`
- `desc`: "Seventy-odd, a coat tied with string, one milky eye and one very sharp one. He is counting the clocks under his breath, though none of them go."
- `DRY = [{ if: '!silas_dry', setFlag: 'silas_dry', say: '"Dry throat, Sergeant. Can\'t talk with a dry throat. Maggie at the Black Lamb keeps a bottle of Bell\'s for me. Bring me a drop and I\'ll tell you about the counting man."' }, '"Dry," says Silas, and licks his lips. "Black Lamb. Bell\'s. Then we\'ll talk."']` (TT-131: the full speech once, then the short of it - a tester read the whole paragraph four times; rows below spread its cases: `[..., ...DRY]`)
- `talk`: `[{ if: 'silas_told', say: '"Told you what I know. Mind that hatch - it wants oil."' }, { say: '"Counting man, counting man, comes on a Thursday..." He breaks off and looks at you with the good eye.', then: DRY }]`
- `accepts`: `whisky`: `SILAS_STORY` (§7.2) · `refuse`: `'"Don\'t want that. Got whisky?"'`
- `shows`: `whisky`: `'"Well? Give it here, then."'` · `button`: `'"Bobby\'s button. The counting man wore a cape. Under a cape, who\'s to say."'` · `patient_file`: `'"Pike. Aye. They were all counters, the Pikes."'`
- `before.attack`: `'"Nell," says Silas. The whippet opens one eye. That is all it takes. You think better of it.'`
- `topics` - every row is `[{ if: 'silas_told', say: <reply> }, DRY]` unless marked "(always)":

| topic | reply after the whisky |
|---|---|
| `t_counting` | `'"Thursdays. Big man in a cape, like the bobbies used to wear. Counts my lock gates - one, two, three, four - goes in at the mill. Comes out up at Ashcombe an hour after, coal on him. There\'s a tunnel, see."'` |
| `t_tally` (TT-131: ASK SILAS ABOUT TALLYMAN / KILLER) | as `t_counting` |
| `t_murders` (TT-131) | `'"Four Thursdays, four of the old names. Counting man\'s work." He counts them off on his fingers and stops at the thumb. "He\'s not done."'` |
| `t_mill` (TT-131) | `'"Ashworth\'s. Gates are chained, but chains cut. Counting man goes in there of a Thursday and comes out at Ashcombe. Work it out."'` |
| `t_tunnel`, `t_counting_room` | `'"Asylum morgue to the mill, under the moor. They carried the dead down it in the cholera, to the boilers. Comes out in the Counting Room, under the counting house, where they made up the wages. There\'s a hatch in the boiler-room floor an\' all, but that wants oil. Rusted solid since the war."'` |
| `boiler_hatch`, `oil_can` | `'"Wants oil. There\'s a can in my shed."'` |
| `t_fire` | `'"My mam got out. Climbed through the roof glass. She said it once and never again: the doors were barred from the outside, and the bailiff stood there with the key."'` |
| `harrow` | `'"Your mate? Never saw him. Saw a bike lamp come down off the moor about quarter past nine, going like the clappers."'` |
| `pike` | `'"Young Arthur? Knew his gran. They were all counters, the Pikes." He looks at you with the good eye. "All of them."'` |
| `t_mary` | `'"Mary Pike. My mam\'s pal. Fourteen. They were going to the fair on the Saturday."'` |
| `bolt_cutters`, `t_quarry`, `crowbar`, `shed_door` (TT-131) | `'"Shed\'s open - take what you need. Quarry hut\'s full of old tools an\' all. Nobody\'s worked it since \'68."'` |
| `t_ghost` | `'"She\'s in the weaving shed. Don\'t talk to her. Don\'t let her talk to you."'` |
| `maggie` | (always) `'"Maggie\'s all right. Knows everybody\'s business but her own."'` |
| `ashdown` | (always) `'"Vicar\'s got a lady friend. Everybody knows. Nobody says."'` |
| `whisky` | (always) `[{ if: 'silas_told', say: '"Grand drop, that."' }, DRY]` |

- `default`: `[{ if: 'silas_told', say: '"Can\'t help you with that. Ask me about the counting man."' }, DRY]`

### 6.6 `harrow` - DI Frank Harrow (`counting_room`, never moves)
- `name` Harrow · `names` harrow, frank, frank harrow, inspector, di, partner · `proper`
- `here`: `[{ if: { var: 'harrowFreed', eq: true }, text: 'Frank Harrow sits against the wall, one hand pressed to his side.' }, { text: 'DI Frank Harrow hangs in chains from the wall, his shirt dark at the side.' }]`
- `desc`: `[{ if: { var: 'harrowFreed', eq: true }, text: 'Frank, out of the chains, grey in the face, one hand pressed to his side. "Don\'t fuss," he says.' }, { if: { turnGte: 240 }, text: 'Frank Harrow, chained by the wrists, grey as ash. The stain at his side has spread to his knees. His eyes are open. Just.' }, { text: 'Frank Harrow, chained by the wrists to two iron rings, glasses gone, a dark stain spreading from his side. He sees you and nearly laughs. "Kid."' }]`
- `talk`: `[{ if: { var: 'pikeState', eq: 'counting' }, say: '"Don\'t talk to me - cuff him! Cuff him, kid!"' }, { if: { var: 'harrowFreed', eq: false }, say: '"Kid. Cutters. Get me down."' }, '"I\'m all right. I\'m not all right. Later."']`
- `before`: `ask`, `tell` (TT-130, `NOT_NOW` - while Pike counts and Harrow is still chained, he has one subject only): `{ if: [{ var: 'pikeState', eq: 'counting' }, { var: 'harrowFreed', eq: false }], say: [{ if: { carried: 'handcuffs' }, text: '"Not now, kid! He\'s got a knife - get the cuffs on him!"' }, { text: '"Not now, kid! Cuffs - mine are in the car, moor road. Go!"' }] }` · `free`: `CUT_CHAINS` · `cut`: `CUT_CHAINS` · `attack`: `'He\'s on your side. Mostly.'`
- `topics`:

| topic | reply |
|---|---|
| `pike` | `'"The ledger names us, kid. My grandad held the key. He\'s been settling it one Thursday at a time."'` |
| `handcuffs` | `[{ if: { carried: 'handcuffs' }, say: '"Then use them!"' }, '"Cuffs - in my car! Moor road!"']` |
| `t_door`, `t_tunnel` | `'"He always leaves himself a way out. Lifted the bar when he came down. Counts his exits, this one."'` |
| `t_self` | `'"Bleeding. Don\'t make a thing of it."'` |
| `bolt_cutters`, `chains` | `[{ if: { var: 'harrowFreed', eq: true }, say: '"Done. Now him."' }, '"Cut me down, then!"']` |

- `default`: `'"Later, kid. Later."' ` · `refuse`: `'"Not now, kid."'`

---

## §7 Puzzle graph

### 7.1 Dependency graph
```
 SEARCH bench -> coin --------------------------> CALL HQ (phone box) ........ +5 phone_call   (optional)
 SHOW CARD to Maggie -> room_key + batteries
     |                      \-> PUT BATTERIES IN TORCH -> TURN ON TORCH ...... +5 torch_lit
     \-> U to Harrow's room ......................................................... +5 harrows_room
           (map, notes: mill, Ashcombe, "S. THORNE", "who keeps the book?"; empty cuff pouch)
 hear of Silas (Maggie / map / visit) -> BUY WHISKY -> GIVE WHISKY TO SILAS ...... +5 silas_story
           -> shed opens -> bolt cutters, oil can; testimony: tunnel, Counting Room, hatch wants oil
 bolt cutters -> CUT CHAIN at mill gates -> N ........................................ +5 mill_entered
           -> counting house: TAKE/TEAR PAGE ......................... +10 ledger_page (ev_ledger)
           -> LISTEN: Harrow praying under the padlocked trap (pointer)
 vestry: READ REGISTER .................................................. +10 register (ev_register)
 No.13: SEARCH -> TAKE BUTTON ................................................ +10 button (ev_button)
 moor road: IN (car) .................................................................. +5 car_found
           -> TAKE HANDCUFFS (critical for the finale), notebook page (lead)
 quarry hut: TAKE CROWBAR -> asylum: D (chute) -> N -> W -> OPEN CABINET -> TAKE FILE  +10 file (ev_file)
           -> READ FILE: "the drawer that does not close"
 evidence >= 3 + Pike at desk: ACCUSE PIKE ..................................... +10 accusation
           -> Pike flees; reaches the Counting Room 5 turns later (else he goes at 23:30 anyway)
 way down (needs lit torch):  (a) morgue: MOVE DRAWER 4 -> D      or   (b) boiler room: OIL HATCH -> OPEN HATCH -> D
 tunnel: N (open only while Pike is inside) -> Counting Room
     ARREST PIKE (handcuffs) ................................................... +10 arrest
     CUT CHAINS (bolt cutters) ............................................... +10 harrow_freed
     both done (any order) -> VICTORY
```
Minimum for victory (not 100): torch lit, bolt cutters (whisky -> Silas), handcuffs, a way down
(file not needed if the drawer is found by examination; oil route needs no file), and Pike in the
Counting Room (accuse with 3 evidence, or wait for 23:35). Evidence is needed only for the
accusation.

### 7.2 Step table (prerequisites -> accepted phrasings -> result)

| # | Where / prerequisites | Accepted phrasings (all must work) | Result |
|---|---|---|---|
| 1 | `waiting_room` | SEARCH, SEARCH BENCH, SEARCH SEAT, LOOK UNDER BENCH, LOOK IN BENCH, LOOK BEHIND BENCH | `coin` revealed ("Wedged between the slats...") |
| 2 | `phone_box`, `coin` carried | CALL HQ, CALL, PHONE HQ, DIAL HQ, RING HQ, CALL MANCHESTER, USE PHONE, USE COIN, PUT COIN IN PHONE | `CALL_HQ`: coin -> null, flag `phoned`, +5 `phone_call`, note `hq_call` |
| 3 | `black_lamb` | SHOW CARD TO MAGGIE, SHOW MAGGIE CARD, SHOW WARRANT (CARD) TO LANDLADY, SHOW ID TO MAGGIE | `room_key` (+ `batteries` if not yet given), flag `maggie_saw_card` |
| 3b | `black_lamb` | ASK MAGGIE ABOUT BATTERIES / TORCH / LIGHT / THE DARK | `batteries`, flag `got_batteries` |
| 4 | `batteries` + `torch` carried/present | PUT BATTERIES IN TORCH, INSERT BATTERIES INTO TORCH, USE BATTERIES (ON TORCH), REPLACE BATTERIES, CHANGE BATTERIES, FIT BATTERIES; or straight to TURN ON TORCH (auto-load) | `LOAD_TORCH`: batteries -> null, flag `torch_loaded` |
| 5 | `torch_loaded` | TURN ON TORCH, TURN TORCH ON, SWITCH ON TORCH, LIGHT TORCH | torch lit, +5 `torch_lit` |
| 6 | `room_key` carried, `black_lamb` | U, GO UP, UP, CLIMB UP, CLIMB STAIRS | enter `harrows_room`, +5 `harrows_room` |
| 7 | `harrows_room` | OPEN SUITCASE / BAG; READ MAP; READ NOTES / LIST; EXAMINE JACKET | notes `case_map`, `harrow_list`; cuffs pointer |
| 8 | anywhere Maggie or the cottage, or `case_map` | ASK MAGGIE ABOUT SILAS / LOCK KEEPER / COUNTING MAN; or enter `lock_cottage`; or READ MAP | flag `heard_of_silas` |
| 9 | `black_lamb`, `heard_of_silas`, money >= 200 | BUY WHISKY, BUY WHISKY FROM MAGGIE, ORDER WHISKY, PURCHASE BOTTLE | `whisky` carried, money -200 |
| 10 | `lock_cottage`, `whisky` carried | GIVE WHISKY TO SILAS, GIVE SILAS WHISKY, OFFER WHISKY TO SILAS, HAND BOTTLE TO OLD MAN | `SILAS_STORY`: flags `silas_told`, `shed_open`, +5 `silas_story`, note `silas_story` |
| 11 | `shed` (needs `shed_open`) | TAKE CUTTERS / BOLT CUTTERS / CROPPERS, TAKE OIL CAN, TAKE ALL | `bolt_cutters`, `oil_can` |
| 12 | `mill_gates`, `bolt_cutters` carried | CUT CHAIN, CUT CHAIN WITH CUTTERS, CUT PADLOCK, BREAK CHAIN, SNIP CHAIN, USE CUTTERS (ON CHAIN), OPEN CHAIN, UNLOCK PADLOCK | `CUT_CHAIN`: flag `mill_chain_cut` (gates passable), sfx `chain` |
| 13 | `mill_gates` after 12 | N, IN, GO IN, ENTER MILL, ENTER GATES | enter `mill_yard`, +5 `mill_entered` |
| 14 | `counting_house` | TAKE PAGE, TAKE LOOSE PAGE, TAKE PAGE FROM LEDGER, TEAR PAGE, TEAR PAGE FROM/OUT OF LEDGER, RIP PAGE, TEAR LEDGER, PULL PAGE | `ledger_page` carried -> `ev_ledger`, +10 `ledger_page` |
| 15 | `counting_house` | LISTEN, LISTEN TO TRAP / FLOOR | flag `heard_praying`, note `praying` (pointer) |
| 16 | `vestry` | READ REGISTER, READ BURIAL REGISTER, SEARCH REGISTER, LOOK IN REGISTER | `READ_REGISTER`: fact `ev_register` (note `mary_pike`), +10 `register` |
| 17 | `number_13` | SEARCH, SEARCH ROOM, SEARCH CANDLE / STUB / WAX, LOOK IN WAX, SEARCH SKIRTING? (no: skirting is scenery - SEARCH covers it) | `button` revealed |
| 18 | `number_13`, button revealed | TAKE BUTTON, TAKE BUTTON FROM CANDLE, TAKE ALL? (no - button is inside the stub: TAKE ALL FROM STUB) | `ev_button`, +10 `button` |
| 19 | `moor_road` | IN, ENTER CAR, GET IN CAR, ENTER CORTINA | enter `harrows_car`, +5 `car_found` |
| 20 | `harrows_car` | TAKE HANDCUFFS / CUFFS, TAKE ALL, READ PAGE | `handcuffs`; note `notebook` |
| 21 | `quarry_hut` | TAKE CROWBAR / JEMMY, TAKE ALL | `crowbar` (+ `rope`) |
| 22 | `asylum_gates` | D, DOWN, IN, ENTER CHUTE, CLIMB DOWN, CLIMB DOWN CHUTE, GO DOWN | enter `coal_chute` (back: U, CLIMB UP, CLIMB UP CHUTE) |
| 23 | `records_office`, `crowbar` carried | OPEN CABINET, OPEN CABINET WITH CROWBAR, PRY CABINET (OPEN) (WITH CROWBAR), PRISE / LEVER / FORCE CABINET, BREAK CABINET, UNLOCK CABINET, USE CROWBAR (ON CABINET) | `PRY_CABINET`: cabinet open |
| 24 | cabinet open | TAKE FILE / FOLDER, TAKE FILE FROM CABINET; READ FILE | `ev_file`, +10 `file`; note `morgue_drawer` |
| 25 | `police_house`, Pike at desk, evidence >= 3 | ACCUSE PIKE, ACCUSE ARTHUR, ACCUSE CONSTABLE, CHARGE PIKE | `case.correct`: +10 `accusation`, Pike -> null, `pikeState: 'fled'`, arrives turn+5 |
| 26a | `morgue`, lit | PULL / PUSH / MOVE / SLIDE / SHIFT / OPEN / CLOSE DRAWER (4 / FOUR / FOURTH), USE CROWBAR (ON DRAWER) | `MOVE_DRAWER`: flag `morgue_hatch_found`, exit d appears |
| 26b | `boiler_room`, lit, `oil_can` carried | OIL HATCH, OIL HATCH WITH CAN, LUBRICATE / GREASE HATCH, USE OIL (CAN) (ON HATCH), POUR OIL ON HATCH, SQUIRT OIL ON HATCH, PUT OIL ON HATCH; then OPEN HATCH, LIFT? (no: OPEN) | `OIL_HATCH`: flag `hatch_oiled`; OPEN HATCH -> open, sfx `hatch` |
| 27 | `tunnel`, Pike in the Counting Room | N, GO NORTH, OPEN DOOR? (no - the door is scenery; N) | enter `counting_room` (attack counter starts) |
| 28 | `counting_room`, `handcuffs` carried, Pike `counting` | ARREST PIKE, CUFF PIKE, HANDCUFF PIKE, RESTRAIN PIKE, ARREST PIKE WITH HANDCUFFS, USE HANDCUFFS (ON PIKE), PUT HANDCUFFS ON PIKE | `ARREST_PIKE`: `pikeState: 'restrained'`, +10 `arrest` |
| 29 | `counting_room`, `bolt_cutters` carried | CUT CHAINS, CUT CHAINS WITH CUTTERS, FREE HARROW, RELEASE / UNCHAIN / RESCUE HARROW, CUT HARROW FREE (cut harrow), BREAK CHAINS, USE CUTTERS (ON CHAINS) | `CUT_CHAINS`: `harrowFreed: true`, +10 `harrow_freed` |

(Rows marked "(no: ...)" record phrasings deliberately *not* supported and what to type instead,
so QA does not file them as bugs.)

### 7.3 Shared reactions (transcribe as named consts)

```js
const CALL_HQ = [
  { if: 'phoned', say: '"Look, Sarge, I\'ve told you everything we\'ve got." The line goes dead.' },
  { if: { carried: 'coin' }, sfx: 'phone', say: 'You feed in the 10p and dial. Pips. "Manchester CID, night desk." You give your name. "Sarge? Thank God. A farmer rang in at nine - Mr Harrow\'s Cortina, abandoned on the moor road, north of town. And he phoned us this afternoon asking for Ashcombe Asylum admissions, 1971. We never sent them. He said he\'d go up and look himself." Then the pips go, and the line.',
    setFlag: 'phoned', move: { coin: null }, note: 'hq_call', award: 'phone_call' },
  'You pat your pockets. No change. The phone wants 10p.',
];
const LOAD_TORCH = [
  { if: 'torch_loaded', say: 'The torch already has fresh batteries.' },
  { if: { any: [{ carried: 'torch' }, { present: 'torch' }] }, say: 'You unscrew the torch, tip out the dead cells and thumb the fresh ones home. The spring bites. Ready.',
    setFlag: 'torch_loaded', move: { batteries: null } },
  "You'll need the torch to put them in.",
];
const SILAS_STORY = {   // npcs.silas.accepts.whisky (the bottle is now Silas's: loc 'silas')
  say: '"Ah." He has the cap off before you\'ve let go. A long pull. "Counting man. Thursdays. Big, in a cape like the bobbies wore. Counts my lock gates, goes in at the mill, comes out at Ashcombe an hour on with coal on him. There\'s a tunnel, see - asylum morgue to the Counting Room under the mill, where they made the wages up. There\'s a hatch in the boiler room an\' all, but it wants oil." He shuffles out into the rain; you hear the shed padlock fall. "Bolt cutters, oil can. Take \'em. The mill gates are chained."',
  setFlag: ['silas_told', 'shed_open'], note: 'silas_story', award: 'silas_story',
};
const CUT_CHAIN = [
  { if: 'mill_chain_cut', say: "It's cut already. The gates are open a body's width." },
  { if: { carried: 'bolt_cutters' }, sfx: 'chain', say: 'You set the jaws, lean on the handles, and the chain parts with a crack like a pistol. It slithers down the bars. The gates groan open a body\'s width.', setFlag: 'mill_chain_cut' },
  'With what - your teeth? You need bolt cutters.',
];
const OIL_HATCH = [
  { if: 'hatch_oiled', say: "It's had all the oil it needs. Try opening it." },
  { if: { carried: 'oil_can' }, say: 'You work the spout round the rim and wait. The rust drinks it. Somewhere in the hinge, something sighs.', setFlag: 'hatch_oiled' },
  "You've nothing to oil it with.",
];
const CUT_CHAINS = [
  { if: { var: 'harrowFreed', eq: true }, say: 'Already cut.' },
  { if: { carried: 'bolt_cutters' }, sfx: 'chain', setVar: { harrowFreed: true }, award: 'harrow_freed', say: [
      { if: { var: 'pikeState', eq: 'restrained' }, text: 'You set the jaws on the first chain and lean. It parts. The second. Frank slides down the wall into your arms, light as a coat. "Took your time, kid," he says.' },
      { text: 'You get the jaws on the chain and lean - crack - and again - crack - and Frank drops onto his knees, gasping. "Behind you!" he says.' } ] },
  "They're padlocked to the rings. You'll need cutters.",
];
// TT-130: while Pike counts, anything you try in the Counting Room that is not the cuffs (ACCUSE, SHOW,
// GIVE, ASK / TELL / TALK, SAY) gets Harrow's shout. Appended with `then`; silent anywhere else.
// `harrow_shouted` lets this turn's attack-counter warning leave Harrow out (§8.4).
const HARROW_CUFFS = {
  if: [{ in: 'counting_room' }, { var: 'pikeState', eq: 'counting' }], style: 'alert', setFlag: 'harrow_shouted',
  say: [
    { if: [{ carried: 'handcuffs' }, { var: 'attack', lte: 1 }], text: 'Behind him Harrow drags his head up. "Don\'t talk to him, kid - cuff him! Get the cuffs on him!"' },
    { if: { carried: 'handcuffs' }, text: 'Harrow, from the wall: "Stop talking! The cuffs, kid - the cuffs!"' },
    { text: 'Behind him Harrow drags his head up. "Don\'t talk to him, kid! Cuffs - mine are in the car, moor road. Get out and get them!"' },
  ],
};
const ARREST_PIKE = [   // npcs.pike.before.arrest (A14.3, extended)
  { if: { var: 'pikeState', eq: 'restrained' }, say: 'He is going nowhere. He is counting the links of the cuffs.' },
  { if: [{ var: 'pikeState', eq: 'counting' }, { carried: 'handcuffs' }], sfx: 'chain', setVar: { pikeState: 'restrained' }, award: 'arrest', say: [
      { if: { var: 'harrowFreed', eq: true }, text: 'Frank throws himself at Pike\'s knees as you go for the knife arm. Pike is a big man, but a tired one; he has been counting all night. The knife rings on the brick. Click. Click. Pike sits back against the wall and goes very still.' },
      { text: 'He lunges. You sidestep, the knife skates across your coat, and you get one cuff on his wrist and wrench it round into the other. Click. Click. Pike goes down on his knees and stays there. "Four," he whispers. "Only four."' } ] },
  { if: { var: 'pikeState', eq: 'counting' }, say: "With what? Harrow croaks: 'Cuffs - in my car!'" },
  { if: { evidence: 3 }, say: '"On what charge, Sergeant?" he asks mildly. If you\'re sure, ACCUSE him.' },
  'Not yet. You need more than a hunch.',
];
```
`TEAR_PAGE`, `PRY_CABINET`, `MOVE_DRAWER`, `TRAP`, `MOVE_STONE`, `HARROWS_DOOR`, `SHED`, `READ_REGISTER`
are given with their items in §5.2.

**Presence-based tools (no hooks).** `bolt_cutters`, `oil_can`, `crowbar`, `handcuffs`, `coin`,
`batteries` decide their USE / PUT target by `{present: target}` (§5.2). Known harmless edge:
with the torch in scope, PUT BATTERIES IN <anything> loads the torch; with Pike present, PUT
HANDCUFFS ON <anything> arrests him. Both do what the player obviously wants.

### 7.4 Content verbs and synonym additions (`content.verbs`)
```js
verbs: [
  { id: 'pry', words: ['pry', 'prise', 'prize', 'lever', 'force'],
    patterns: ['pry {dobj}', 'pry {dobj} open', 'pry open {dobj}', 'pry {dobj} with {iobj}', 'pry open {dobj} with {iobj}', 'pry {dobj} open with {iobj}'],
    default: "You can't get any purchase on that." },
  { id: 'replace', words: ['replace', 'change', 'swap', 'fit'], patterns: ['replace {dobj}', 'replace {dobj} in {iobj}'],
    default: 'Replace it with what?' },
  { id: 'pour', words: ['pour', 'squirt', 'drip'], patterns: ['pour {dobj}', 'pour {dobj} on|onto|over|into|in {iobj}'],
    default: "You'd only waste it." },
  { id: 'tie', words: ['tie', 'fasten', 'knot', 'lash', 'attach'],
    patterns: ['tie {dobj}', 'tie {dobj} to|on|onto|round|around {iobj}', 'tie up {dobj}', 'tie {dobj} up'],
    default: "You've nothing that needs tying." },                     // TT-105; rope.before.tie (§5.2)
  { id: 'pray', words: ['pray'], patterns: ['pray'], default: 'You pray. The rain goes on.' },
  { id: 'knock', words: ['knock', 'bang', 'rap'], patterns: ['knock', 'knock on {dobj}', 'knock at {dobj}'],
    default: 'Nobody answers.' },
  { id: 'open', patterns: ['open {dobj} with {iobj}'] },        // tool phrasing; content before.open decides
  { id: 'call', notHere: "You'll need a phone. There's a box in Market Square." },
  { id: 'free', words: ['unshackle'] },
  { id: 'arrest', words: ['subdue', 'tackle', 'apprehend', 'disarm', 'overpower', 'nick'] },   // TT-130
  { id: 'cut', words: ['crop'] },
  // TT-131 (blind playtest: SAY FIVE, BREATHE, DRIVE, BUY WHISKY FOR SILAS, GO TOWPATH were refused)
  { id: 'say', words: ['say', 'shout', 'yell', 'call out', 'whisper', 'cry'], patterns: ['say', 'say {topic}'],
    default: "You say it out loud. The rain goes on as if you hadn't." },
  { id: 'breathe', words: ['breathe'], patterns: ['breathe', 'breathe deeply|slowly|deep|in|out'],
    default: 'In for four, out for four. You catch yourself counting, and stop.' },
  { id: 'drive', words: ['drive'], patterns: ['drive', 'drive {dobj}', 'drive off|away'],
    default: 'You came on the train, and the last one has gone.' },
  { id: 'buy', patterns: ['buy {dobj} for {topic}'] },                      // whisky.before.buy (§5.2)
  { id: 'enter', patterns: ['go|walk|head|run to {dobj}', 'go|walk|head|run {dobj}'] },   // GO TO X = ENTER X
],
```
SAY is answered by the rooms where someone can hear it: `police_house`, `black_lamb`, `lock_cottage`,
`tunnel` (Harrow, like a knock), `counting_room` (§4). DRIVE by `harrows_car` and `moor_road`. ENTER / GO TO by `canal_bridge`,
`towpath`, `lock`, `mill_gates` (towpath), `lock` (cottage) and `church_lane` (church / cottage).
Room-level uses: `st_judes.before.pray` -> `{ nerve: -5, say: 'You sit in a box pew and close your eyes. When you open them the candles are still burning. Four of them. It helps, a little.' }`;
`tunnel.before.knock` -> `[{ if: { at: ['pike', 'counting_room'] }, say: 'The door swings at your knock. It is not barred any more.' }, { say: 'Harrow stops praying. "Kid? Is that you? The bar\'s on this side and I can\'t reach it. He comes and goes by the trap up top. Find another way - and hurry."', setFlag: 'heard_harrow' }]`.

### 7.5 Registries

**Evidence** (A4.10, transcribe literally):
```js
evidence: {
  ev_ledger:   { label: 'Ledger page (1912): the shed-door names, and "Pike, Mary, 14"', item: 'ledger_page', award: 'ledger_page' },
  ev_register: { label: 'Burial register: Mary Pike, 14, died in the fire', note: 'mary_pike', award: 'register' },
  ev_button:   { label: 'Silver tunic button from No.13', item: 'button', award: 'button' },
  ev_file:     { label: 'Patient file "A. PIKE", Ashcombe 1971-75', item: 'patient_file', award: 'file' },
},
```

**Notes** (`content.notes`; noted on discovery, shown by NOTES in that order):
| id | text |
|---|---|
| `hq_call` | "HQ: Harrow's Cortina found abandoned on the moor road at 21:00. He asked Manchester for Ashcombe Asylum admissions, 1971 - never sent; he went to look himself." |
| `case_map` | "Harrow's map: the mill circled twice. Ashcombe Asylum, north of the tally stone, circled. At the lock: 'S. THORNE - saw something?'" |
| `harrow_list` | "Harrow's notes: Ashworth, Crabtree, Holt, Marsh - all Thursdays, all old mill names. 'TALLY = DEBT. Who keeps the book?' And at the bottom: 'Harrow'." |
| `pike_patrol` | "Occurrence book: PC Pike out on patrol, Moor Road, 20:35 to 21:20. Harrow radioed from the moor road at 20:40." |
| `notebook` | "Harrow's notebook page: 'Ledger at the mill names them. Ashcombe - 1970s files. The boy who counted.'" |
| `silas_story` | "Silas: a counting man in a police cape walks the towpath on Thursdays - into the mill, out at Ashcombe. An old tunnel runs from the asylum morgue to the Counting Room under the mill. The boiler-room hatch wants oil." |
| `praying` | "Counting house: a man praying beneath the padlocked iron trap. Harrow is alive, under the mill." |
| `morgue_drawer` | "Patient file: 'the boy kept to the morgue - the drawer that does not close'." |
| `alibi` | "Rev. Ashdown and Maggie Pollard were together all night on 8 November, when Ivy Marsh died." |
| `mary_pike` | "Burial register: \"Mary Pike, 14, d. 15 Nov 1912.\"" |

**Flags** (all set somewhere; L22): `maggie_saw_card`, `got_batteries`, `torch_loaded`, `heard_of_silas`,
`entered_harrows_room`, `phoned`, `alibi_known`, `letters_found`, `silas_told`, `shed_open`, `found_car`,
`climbed_down`, `torch_off_warned`, `dark_warned`, `mill_chain_cut`, `entered_mill`, `saw_girl`, `heard_praying`, `heard_harrow`, `hatch_oiled`,
`ward_counting`, `morgue_hatch_found`, `tunnel_music`, `pike_greeted`, `pike_fled`, `accused_maggie`, `accused_ashdown`,
`accused_silas`, `harrow_shouted`, `silas_dry`. (`silas_dry`: Silas's long "Dry throat" speech has been given, §6.5 - TT-131. `harrow_shouted`: set by `HARROW_CUFFS`, cleared by the `harrow_quiet` daemon the same turn, §8.4 - TT-130. `torch_off_warned`: the TURN OFF refusal, §5.2; `pike_fled`: the ACCUSE that makes him run, §8.1 - TT-105.)

**Vars** (A3.2/A14.3, exactly): `pikeState`, `pikeArrivalTurn`, `attack`, `harrowFreed`. No extra vars.

### 7.6 Hooks (`content.hooks`, A5) - TT-131
The data language cannot see *which* scenery entry a command names, or what a purchase is for. These
few pure hooks (`src/content/hooks.js`) can; everything else stays data.

| hook | phase | true when / does |
|---|---|---|
| `read_scenery` | reaction | READ of a room scenery entry says its desc (or "It's too dark to read."); returns false for anything else so READ <item> runs as before. Every room with scenery gets `before.read: { hook: 'read_scenery' }` (index.js). (A tester: READ NOTICE said "There's nothing written on the notice.") |
| `for_silas` | cond | the BUY topic is Silas (`silas`, `t_keeper`, `t_counting`) |
| `dobj_towpath`, `dobj_church`, `dobj_cottage`, `dobj_boot`, `dobj_glovebox`, `dobj_cupboard`, `dobj_coalhole` | cond | the dobj is a scenery entry named `towpath` / `church door` / `cottage` / `boot` / `glovebox` / `cupboard` / `coal-hole` |
| `dir_in` | cond | the command's direction is `in` |
| `from_tunnel` | cond | `prevRoomId` is `tunnel` |

---

## §8 Case, finale state machine, endings, deaths (PLAN §2.5 instantiated)

### 8.1 ACCUSE (`content.case`)
```js
case: {
  culprit: 'pike', threshold: 3, suspects: ['ashdown', 'maggie', 'silas'],
  confirm: 'Are you certain? (Y/N)',
  cancelText: '(You hold your tongue.)',
  correct: [
    { if: { in: 'police_house' }, sfx: 'sting', award: 'accusation', move: { pike: null }, setFlag: 'pike_fled',
      setVar: { pikeState: 'fled', pikeArrivalTurn: { turnPlus: 5 } },
      say: '"Arthur Pike, I am arresting you for the murders of Edna Ashworth, Walter Crabtree, Dennis Holt and Ivy Marsh -" He stands. He is very big. For a moment his face is quite empty, a slate wiped clean. Then he puts both hands on the counter and vaults it, and his shoulder takes you into the wall. By the time you are up, the door is banging in the wind and he is gone into the rain without his helmet. You know where. Under the mill. To Frank.' },
    { award: 'accusation', then: HARROW_CUFFS,   // TT-130
      say: 'You say it out loud: the whole caution, every name. Pike listens with his head on one side, counting the names off on his fingers. "Four," he says. "You forgot one."' },
  ],
  weak: [
    { if: { in: 'counting_room' }, nerve: 15, say: '"Prove it," says Pike, and smiles, and goes on counting.', then: HARROW_CUFFS },
    { nerve: 15, say: 'Pike laughs - a big easy laugh with nothing behind it. "Me? On what, Sergeant? A feeling?" He leans across the counter. "Come back when you\'ve got something you can count."' },
  ],
  wrong: [
    { if: { present: 'maggie' },  setFlag: 'accused_maggie',  end: 'wrong_man' },
    { if: { present: 'ashdown' }, setFlag: 'accused_ashdown', end: 'wrong_man' },
    { setFlag: 'accused_silas', end: 'wrong_man' },
  ],
  other: [
    { if: { present: 'harrow' }, say: '"Me?" Harrow manages a laugh. "I\'m the one in chains, kid."' },
    "You'd need a lot more than that, and so would a jury.",
  ],
},
```
Rules (A14.1 #2-5): ACCUSE of anyone not present -> `notHere` "Accuse who? They're not here." (free).
Pike present with evidence >= 3 -> `correct` (1 turn; `award` is once-only, so a second correct
accusation in the Counting Room just says its text). Evidence < 3 -> `weak` (1 turn, may retry).
Suspect present -> confirmation (free); YES -> `wrong` (1 turn, ending); NO / anything else ->
`cancelText`, no turn. Evidence count = facts found + evidence items *carried now* (A8.8).
**Finale fairness (TT-130).** ACCUSE in the Counting Room never arrests anyone - the caution is words,
and Pike has a knife. Strong or weak, it is answered by Harrow's shout (`HARROW_CUFFS`, §7.3) pointing
at the cuffs (or, without them, back out to the car). The blind playtest showed players reading HELP's
ACCUSE as the way to win; HELP now names ARREST / HANDCUFF too (§1.7).

### 8.2 Pike's state machine (`vars.pikeState`)
```
            ACCUSE (>=3 ev, police_house)                 D4 pike_arrives
  desk ------------------------------------> fled ----(turn >= pikeArrivalTurn = accuse turn - 1 + 5)----\
    |                                                                                                     v
    | D3 schedule at 240 (if still desk)                                                              counting
    +--------------------------------------> left ----(turn >= 250)------------------------------------> |
                                                                                                          | ARREST (handcuffs)
                                                                                                          v
                                                                                                     restrained (terminal)
```
- `desk`: Pike at `police_house` (`npcs.pike.loc`). Never met anywhere else (PLAN §2.5).
- `fled` / `left`: `loc: null` (travelling via the mill and his trap). Police House description
  changes (§4.1). Arrival flavour if the player is in `counting_house` or `tunnel` (§9.2).
- `counting`: `loc: counting_room`; the tunnel's iron door is passable; attack counter runs while
  the player is in the room.
- `restrained`: counter stops permanently; Pike stays in the room, kneeling.

### 8.3 The iron door (before / after)
- **Before Pike arrives** - `tunnel` desc variants 2/3 ("Behind it, very faint, a man is
  praying."), exit msg F ("barred from the other side... Harrow is praying"), EXAMINE DOOR ("you
  can hear the beam shift in its brackets"), KNOCK (Harrow: "The bar's on this side and I can't
  reach it. He comes and goes by the trap up top").
- **After** - `tunnel` desc variant 1 ("the iron door stands ajar - the bar lifted from inside by
  someone who wants a way out"), EXAMINE DOOR ("The beam ... lifted from the far side ... Whoever
  went in left himself a way out."), in the Counting Room EXAMINE BEAM ("Pike lifted it when he came
  down. His way out."), ASK HARROW ABOUT DOOR ("He always leaves himself a way out... Counts his
  exits, this one."). Why: §3.3 "Why the iron door opens".

### 8.4 Inside the Counting Room
**`counting_room.onEnter`** (greeting first, then the bleeding cue - REACTION_ORDER puts `say` before `then`):
```js
const BLEED_CUE = { if: [{ turnGte: 180 }, { var: 'harrowFreed', eq: false }], style: 'alert',
  say: "Harrow's head has dropped. When he lifts it, it takes him a long time. His breathing is shallower now." };
onEnter: [
  { if: [{ var: 'pikeState', eq: 'counting' }, '!pike_greeted'], setFlag: 'pike_greeted', sfx: 'sting', style: 'alert',
    say: 'Pike turns from the wall. He has taken off his tunic and folded it on the wages table, and he holds a long butcher\'s knife low against his leg. "You\'re early, Sergeant," he says. "I\'ve one more to count."',
    then: BLEED_CUE },
  { if: [{ var: 'pikeState', eq: 'counting' }, { lit: false }], style: 'alert', say: 'Somewhere ahead of you in the black a big man is breathing, slow and even, close enough to touch.' },
  { if: { var: 'pikeState', eq: 'counting' }, style: 'alert', say: 'Pike is waiting for you, knife low. He has started counting again.', then: BLEED_CUE },
  BLEED_CUE,
],
```
(The dark line: felt your way back in with the torch off, A8.3 step 4 - you cannot see him, TT-105.)
**Attack counter** (`daemons`, step D4, A14.3 - order `pike_arrives` then `attack`):
```js
daemons: [
  { id: 'pike_arrives', run: {
      if: [{ var: 'pikeState', oneOf: ['fled', 'left'] }, { turnGte: { var: 'pikeArrivalTurn' } }],
      move: { pike: 'counting_room' }, setVar: { pikeState: 'counting' },
      then: [
        { if: { in: 'counting_house' }, sfx: 'hatch', style: 'alert', say: 'Under your feet the iron trap shudders. Something heavy climbs down beneath it, and a bolt slides home.' },
        { if: { in: 'tunnel' }, sfx: 'door', style: 'alert', say: 'Beyond the iron door a beam scrapes and thuds against brick. The door shifts in its frame and stands ajar. Harrow has stopped praying.' },
      ] } },
  { id: 'attack', run: {
      if: [{ in: 'counting_room' }, { var: 'pikeState', eq: 'counting' }],
      setVar: { attack: { add: 1 } },
      then: [
        { if: [{ lit: true },  { var: 'attack', gte: 5 }], sfx: 'scream', end: 'death_pike' },
        // TT-130: each lit warning carries Harrow's pointer (cuffs, or the way out) unless he has
        // just shouted it in answer to this turn's command (HARROW_CUFFS sets `harrow_shouted`).
        { if: [{ lit: true },  { var: 'attack', eq: 4 }], style: 'alert', nerve: 20, sfx: 'sting', say: [
            { if: 'harrow_shouted', text: LUNGE },
            { if: { carried: 'handcuffs' }, text: 'He lunges. The knife opens your sleeve and the arm under it, and you feel nothing at all, which frightens you more. "Four," he says. Next time it will not be your arm. Harrow is shouting now: "The cuffs, kid! NOW!"' },
            { text: 'He lunges. The knife opens your sleeve and the arm under it, and you feel nothing at all, which frightens you more. "Four," he says. Next time it will not be your arm. Harrow is shouting now: "Get out, kid! OUT!"' } ] },
        { if: [{ lit: true },  { var: 'attack', eq: 3 }], style: 'alert', say: [
            { if: 'harrow_shouted', text: '"Three," says Pike, and takes a step closer.' },
            { if: { carried: 'handcuffs' }, text: '"Three," says Pike, and takes a step closer. Behind him Harrow gets the words out at last: "Cuff him, kid! The cuffs!"' },
            { text: '"Three," says Pike, and takes a step closer. Behind him Harrow gets the words out at last: "Get out, kid! Cuffs - my car!"' } ] },
        { if: [{ lit: true },  { var: 'attack', eq: 2 }], style: 'alert', say: [
            { if: 'harrow_shouted', text: CIRCLES },
            { if: { carried: 'handcuffs' }, text: 'He circles, knife low. "One," he says, matching your steps. "Two." Harrow, hoarse: "Cuffs, kid!"' },
            { text: 'He circles, knife low. "One," he says, matching your steps. "Two." Harrow, hoarse: "No cuffs? Then get out, kid!"' } ] },
        { if: [{ lit: false }, { var: 'attack', gte: 2 }, 'dark_warned'], sfx: 'scream', end: 'death_pike' },
        { if: { lit: false }, setFlag: 'dark_warned', style: 'alert',
          say: 'In the dark the counting is suddenly very close. "One..." Light. You need light, now.' },
      ] } },
  { id: 'harrow_quiet', run: { if: 'harrow_shouted', clearFlag: 'harrow_shouted' } },   // TT-130: the shout lasts one turn
],
// const CIRCLES = 'He circles, knife low. "One," he says, matching your steps. "Two."';
// const LUNGE = 'He lunges. The knife opens your sleeve and the arm under it, and you feel nothing at all, which frightens you more. "Four," he says. Next time it will not be your arm.';
```
(Before TT-130 the 3 warning read: '"Three," says Pike, and takes a step closer. Behind him Harrow is trying to say something. Do something.' Both blind testers died after it without thinking of the cuffs.)
Warnings before death (fairness): lit - 2 ("He circles, knife low"), 3, 4 (lunge), each naming the cuffs
(or, without them, the way out) - TT-130; dark - 1, or
the TURN OFF TORCH refusal followed by a deliberate second TURN OFF. The dark branch is fatal only
once `dark_warned` is set (PLAN "dark: warning at 1, fatal at 2"), and only two things set it: the
"One..." warning itself, and the second TURN OFF in here after the refusal (§5.2 `TORCH_OFF_WARNING`;
the refusal alone only sets `torch_off_warned`). So switching the torch off in here is refused with a
warning first, and any other dark turn in here - e.g. walking back in by the darkness rule's way
back (§3.3 msg F note) with the torch off, even after an earlier refusal - gives the "One..." warning
and sets `dark_warned`, so the next dark turn is fatal (TT-121, TT-105). Through the tunnel's `n` exit the room can only be entered
with a light in hand. The counter persists when the player leaves and
resumes on re-entry (+1 on the entering turn). Nerve: Beneath caps at 99, never panics (§3.1).

Counter walk-through, reference walkthrough (§12): enter on command 89 -> `attack` 1 (greeting);
command 90 ARREST PIKE succeeds in step A, D4 sees `restrained`, no increment; command 91 CUT CHAINS
-> victory at D8. Arrest-after-free order: enter (1), CUT CHAINS (2 + warning), ARREST (succeeds
before D4 makes it 3).

### 8.5 Harrow's bleeding (cues)
- `tunnel.onEnter` after 23:00 (turn >= 180) while chained: "Beyond the iron door Harrow coughs - a wet, bad cough - and goes quiet for too long." (§4.6)
- `counting_room.onEnter` after 23:00 while chained: `BLEED_CUE` (above).
- Beat `harrow_bleeds` (§9.1): every 20 turns while the player is in the Counting Room and Harrow chained.
- `harrow.desc` changes at turn 240 ("The stain at his side has spread to his knees").
- The `tunnel` exit message F changes at turn 180 ("slower now, losing his place").

### 8.6 Hazards (warned once, then fatal - A7.5 step 1)
```js
hazards: {
  lock:   { room: 'lock', verbs: ['swim', 'enter', 'jump'], objects: ['lock_water'], ending: 'death_drown',
            warn: 'You stand at the edge of the lock and look down into ten feet of black, churning water. If you went in there you would not come out. (If it is the cottage you want, it is NORTH.)' },
  quarry: { room: 'quarry_edge', exit: 'd', unless: { any: [{ carried: 'rope' }, 'climbed_down'] }, ending: 'death_fall',
            warn: 'You look over the edge. Sixty feet of wet rock down to black water, and not a handhold you would trust. Without a rope you would never make it down alive.' },
},
```
`quarry_edge.before.jump` -> "You look at the drop. The drop looks at you. No." (not a hazard).
`canal_bridge.before.jump` / `towpath.before.swim` -> refusals (§4.2), not hazards.

### 8.7 Endings (`content.endings`, array order = precedence, A7.7; titles <= 30 chars)
```js
endings: [
  { id: 'victory',      kind: 'victory',  title: 'The Tally Settled',     art: 'ending_victory',  music: 'ending_good',
    when: [{ var: 'pikeState', eq: 'restrained' }, { var: 'harrowFreed', eq: true }], text: VICTORY },
  { id: 'pyrrhic',      kind: 'midnight', title: 'Paid in Full',          art: 'ending_pyrrhic',  music: 'ending_bad',
    when: [{ turnGte: 300 }, { var: 'pikeState', eq: 'restrained' }], text: PYRRHIC },
  { id: 'got_away',     kind: 'midnight', title: 'The One That Got Away', art: 'ending_got_away', music: 'ending_bad',
    when: [{ turnGte: 300 }, { var: 'harrowFreed', eq: true }], text: GOT_AWAY },
  { id: 'fifth_stroke', kind: 'midnight', title: 'The Fifth Stroke',      art: 'ending_fifth',    music: 'ending_bad',
    when: { turnGte: 300 }, text: FIFTH_STROKE },
  { id: 'wrong_man',    kind: 'wrong',    title: 'The Wrong Man',         art: 'ending_wrong',    music: 'ending_bad', text: WRONG_MAN },
  { id: 'death_drown',  kind: 'death',    title: 'Drowned',               art: 'ending_death',    music: 'ending_bad', text: DEATH_DROWN },
  { id: 'death_fall',   kind: 'death',    title: 'The Long Drop',         art: 'ending_death',    music: 'ending_bad', text: DEATH_FALL },
  { id: 'death_pike',   kind: 'death',    title: 'Counted',               art: 'ending_death',    music: 'ending_bad', text: DEATH_PIKE },
],
```
Ending texts (final prose; `\n\n` = paragraph break; character counts in §15):

**VICTORY**
> You get Frank to his feet between you, his arm over your shoulders, and Pike walks ahead of you in the torchlight with his hands cuffed behind him, counting the bricks under his breath. Nobody else speaks. At the first turn of the tunnel Frank stops to cough, and when he can talk again he says, "You found the ledger, then." It isn't a question.\n\nBy one in the morning Blackmere's blue lamp has six cars round it, Manchester and Lancashire both, and Maggie is making tea for men she has never met. Arthur Pike sits in his own cell and asks, very politely, for a pencil. They don't give him one. He scratches four strokes into the paint with his thumbnail, and stops, and sits looking at the place where the fifth should go.\n\nThe mill comes down in December. Nobody in Blackmere goes out on a Thursday for a long time anyway.

**PYRRHIC**
> Midnight. Somewhere above you St Jude's strikes twelve, and the sound comes down through the brick like water.\n\nPike, cuffed on his knees, lifts his head and listens to every stroke. When the twelfth has gone he smiles, and closes his eyes.\n\nFrank Harrow stopped breathing some time in the last quarter of an hour. You didn't see when. You were watching Pike. The chains still hold him up, his face turned a little to the wall, towards the four strokes and the space beneath them.\n\nYou have your man. You will have a commendation, and your photograph in the Manchester Evening News, and every Thursday night for the rest of your life.\n\nDown in the dark, very quietly, Pike begins to count.

**GOT_AWAY**
> Midnight. St Jude's strikes twelve above you, and on the twelfth stroke Arthur Pike is simply not there any more. The scrape of the beam, the iron door, his boots in the tunnel - counting, going away - and then nothing but Frank's breathing and your own.\n\nYou get Frank out. It takes an hour. When Manchester arrives you give them everything: the ledger, the register, the button, the boy who counted. They find Pike's bicycle at the asylum gates and his cape on the tally stone, folded, with four stones laid on it in a row.\n\nThey search the moor for a week. Frank Harrow lives, and retires, and never goes back to Blackmere.\n\nBut every year, on the fifteenth of November, someone cuts four fresh strokes into the tally stone. Never the fifth. Just the four, waiting.

**FIFTH_STROKE** (Text variants)
- `{ if: { awarded: 'accusation' } }`:
> Midnight. St Jude's strikes twelve.\n\nUnder the mill, in the Counting Room, Arthur Pike waits for the last stroke of the bell with his eyes shut, the way a choirboy waits for his note. Then he picks up the chisel.\n\nThey find Frank Harrow on Friday morning, when the demolition men come to survey the mill. Beneath the four strokes on the brick there is a fifth, cut diagonally across them, closing the gate. The tally is settled.\n\nArthur Pike is never seen again. You told them who it was; you just didn't get there. And every November, on the fifteenth, someone polishes the fourteen brass plaques in St Jude's until they shine, and leaves a single chalk stroke on the vestry door.
- (default):
> Midnight. St Jude's strikes twelve.\n\nUnder the mill, in the Counting Room, Arthur Pike waits for the last stroke of the bell with his eyes shut, the way a choirboy waits for his note. Then he picks up the chisel.\n\nThey find Frank Harrow on Friday morning, when the demolition men come to survey the mill. Beneath the four strokes on the brick there is a fifth, cut diagonally across them, closing the gate. The tally is settled.\n\nPC Arthur Pike leads the search himself. He is very kind to you. He makes you tea, and calls you Sergeant, and tells Manchester you did all anyone could. On Saturday he waits on the platform until your train pulls out, and through the rain you watch him counting the carriages.

**WRONG_MAN** (Text variants)
- `{ if: 'accused_maggie' }`:
> You say it in front of the whole bar: "Margaret Pollard, I am arresting you..." The regulars put down their mild. Maggie looks at you for a long moment, then takes off her tea towel and folds it. "You'll want Arthur to take me in," she says. "He's very good with people."\n\nArthur Pike takes her in, kindly, holding her elbow down the wet steps. He tells you to get some rest.\n\nAt midnight, beneath the mill, he draws the fifth stroke. They find Frank Harrow on Friday. The vicar gives Maggie her alibi by Saturday dinner-time, at the cost of his marriage; the case against you takes rather longer to collapse. You never work CID again. Blackmere never forgets anything, and it never forgets you.
- `{ if: 'accused_ashdown' }`:
> "Clement Ashdown, I am arresting you..." The vicar does not argue. "The Lord is my shepherd," he says, quite calmly, as you caution him, and gets the second line wrong.\n\nPC Pike drives him down to the cells. "You've done well, Sergeant," Pike says, and offers you a cup of tea, and you are so tired that you take it.\n\nAt midnight, beneath the mill, Pike draws the fifth stroke. They find Frank Harrow on Friday. By Sunday Maggie Pollard has walked into the police house and given the vicar his alibi, in front of half the town. The Bishop moves him to a parish in Cumbria. They move you to traffic. Every November, on the fifteenth, somebody sends you a postcard with four strokes on it.
- (default - Silas):
> "Silas Thorne, I am arresting you..." Silas laughs until he cries, and the whippet watches you with her ears flat. "Counting man'll be laughing too," he says. "Counting man'll be laughing all the way to the mill."\n\nPC Pike helps you get him into the car. He is very gentle with the old man. "Harmless," he tells you, "but you can't be too careful."\n\nAt midnight, beneath the mill, Pike draws the fifth stroke. They find Frank Harrow on Friday. Silas is released on Saturday, after a night in the cells counting the bricks out loud, and on Sunday he is found in his lock, the paddles open. Accident, says the coroner. Blackmere nods. Blackmere has always known how to count.

**DEATH_DROWN** (warned by hazard `lock`)
> You go into the lock. The cold stops your heart and then starts it again, which is worse. The water pouring through the paddles takes you down with it, down into the black, against the gates, and holds you there with all the patience of two hundred years. The last thing you hear is the lock filling. The last thing you think, absurdly, is that you are counting the seconds.\n\nSilas finds you in the morning when he opens the paddles. Frank Harrow they find on Friday, under the mill, beneath five strokes.

**DEATH_FALL** (warned by hazard `quarry`)
> You lower yourself over the lip, feeling for holds. There aren't any. For a moment you hang by your fingers from the wet edge of Blackmere Quarry, the rain running into your sleeves, and you think, quite clearly: I was told. Then the rock lets go of you.\n\nSixty feet is a long way and no time at all.\n\nAbove, the old winch post leans out over the drop, where a rope could have been tied. At midnight, beneath the mill, Pike draws the fifth stroke, and the town says the quarry has taken another one.

**DEATH_PIKE** (warned by the attack counter; Text variants)
- `{ lit: true }`:
> "Five," says Pike, close as a whisper, and the knife finds you. It doesn't hurt as much as you thought it would. You sit down against the brick, under the four great strokes, and watch him step over your legs to stand in front of Frank.\n\n"Sorry, Sergeant," he says. "You weren't in the ledger. But a tally's a tally."\n\nYour torch rolls away across the floor and comes to rest pointing at the wall, so that the last thing you see is the chisel in his hand, and the fifth stroke beginning.
- (default - dark):
> In the dark the counting comes from everywhere at once. "Two," says Pike, at your ear, and you never even see the knife.\n\nYou sit down on the cold brick. Somewhere Frank is shouting your name, and then he isn't. Pike's voice goes on in the dark, gentle, patient, numbering things, until it is the only thing in the world.\n\nThey find you both on Friday, under five strokes. You never did turn the light back on.

---

## §9 Scripted beats and story daemons

### 9.1 Beats (`content.beats`, step D2, array order)
```js
beats: [
  { id: 'bell_22',   at: 60,  run: { sfx: 'bell', say: "Across the town, St Jude's bell tolls ten. Two hours." } },
  { id: 'bell_23',   at: 180, run: { sfx: 'bell', style: 'alert', say: "St Jude's tolls eleven, slow and flat through the rain. One hour to midnight." } },
  { id: 'bell_2330', at: 240, run: { sfx: 'bell', style: 'alert', say: "A single stroke from St Jude's. Half past eleven." } },
  { id: 'bell_2345', at: 270, run: { sfx: 'bell', style: 'alert', say: "St Jude's strikes the quarter. Fifteen minutes." } },
  { id: 'last_5',    at: 290, run: { sfx: 'heart', style: 'alert', say: 'Five minutes to midnight. You can feel it in your teeth.' } },
  { id: 'pike_clock', at: 210, when: [{ present: 'pike' }, { var: 'pikeState', eq: 'desk' }],
    run: { say: 'Pike glances up at the clock, and his thumb rubs at his tunic where a button should be. "Not long now," he says, to nobody.' } },
  { id: 'thunder', every: 23, when: { any: [{ zone: 'town' }, { zone: 'canal' }, { zone: 'moor' }] },
    run: { chance: 0.5, sfx: 'thunder', pick: [
      'Thunder rolls over the moor.',
      'Lightning, far off. You count without meaning to - one, two, three, four - and the thunder comes.',
      'The rain thickens. Thunder grumbles somewhere over Ashcombe.' ] } },
  { id: 'counting_dark', every: 9, when: { in: ['crypt', 'weaving_shed', 'boiler_room', 'ward', 'morgue', 'tunnel'] },
    run: { chance: 0.5, sfx: 'whisper', style: 'whisper', pick: [
      'Somewhere in the dark, someone is counting. "...three... four..."',
      'Footsteps behind you. You stop. They stop.',
      '"...one, two, three, four..." A pause. Then, very softly, "...four..."' ] } },
  { id: 'counting_late', every: 10, when: [{ turnGte: 180 }, { not: { zone: 'beneath' } }],
    run: { chance: 0.4, sfx: 'whisper', style: 'whisper', pick: [
      'Under the rain, under everything, a voice is counting. It is nearer than it was.',
      'You find you are counting your own steps. You make yourself stop.',
      'A smell of scorched cotton, from nowhere, and gone.' ] } },
  // cosmetic only (PLAN §2.2 #1). TT-131: three once-beats, spaced, the third paying it off (the old
  // `every: 7, chance: 0.5` beat fired about twelve times for a blind tester and never meant anything).
  { id: 'torch_flicker', when: [{ turnGte: 185 }, { carried: 'torch' }, { on: 'torch' }],
    run: { say: 'Your torch flickers, browns out, and steadies again.' } },
  { id: 'torch_flicker_2', when: [{ turnGte: 225 }, { carried: 'torch' }, { on: 'torch' }],
    run: { say: 'The torch browns out again, and comes back when you shake it. Fresh batteries. It should not be doing that.' } },
  { id: 'torch_flicker_3', when: [{ turnGte: 262 }, { carried: 'torch' }, { on: 'torch' }],
    run: { say: 'The beam jumps, and jumps again - and you see it is not the torch. It is your hand. You hold it still with the other one.' } },
  { id: 'fog_figure', when: [{ in: 'tally_stone' }, { turnGte: 30 }],                    // once
    run: { sfx: 'sting', nerve: 10, say: 'For a moment a figure stands in the fog beyond the stone - tall, quite still, a cape on its shoulders. Then there is only fog.' } },
  { id: 'towpath_steps', when: [{ in: 'towpath' }, { turnGte: 60 }],                     // once
    run: { sfx: 'footsteps', say: 'Footsteps on the towpath behind you, measured, unhurried. You turn: the bulb, the rain, the black water. Nobody. The footsteps have stopped too.' } },
  { id: 'stone_girl', when: [{ in: 'churchyard' }, { visited: 'weaving_shed' }],          // once
    run: { say: "The stone girl's worn face seems turned a fraction further towards the mill than it was. It must always have been like that." } },
  { id: 'harrow_bleeds', every: 20, when: [{ in: 'counting_room' }, { var: 'harrowFreed', eq: false }],
    run: { style: 'alert', pick: [
      "Harrow's breathing is shallower now.",
      "Harrow coughs, and there is something wet in it. He looks at you and doesn't say anything, which is worse.",
      "The stain at Harrow's side has reached the floor." ] } },
],
```
Ids of `when`-only beats default to once (A4.12). `at`/`every` beats repeat on schedule. RNG is
used only via `chance`/`pick` (deterministic per seed).

### 9.2 Schedules and daemons (summary; data in §6.3 and §8.4)
| When | What | Text / sfx |
|---|---|---|
| D3, turn 240, `pikeState: 'desk'` | Pike leaves (`left`), `pikeArrivalTurn = 250` | `leaveText` (player in Police House) |
| D4 every turn | `pike_arrives`: `fled`/`left` and turn >= arrival -> `counting_room`, `counting` | flavour in `counting_house` (sfx `hatch`) / `tunnel` (sfx `door`) |
| D4 every turn | `attack` counter (§8.4) | texts at 2/3/4, death at 5; dark 1/2 |
| D4 every turn | `harrow_quiet` (§8.4, TT-130): clears `harrow_shouted` | - |
| `tunnel.onEnter` | first entry starts music `dread`; after 23:00 Harrow's cough | §4.6 |
| `counting_room.onEnter` | Pike's greeting (once), re-entry line, bleed cue | §8.4 |
| `weaving_shed.onEnter` (lit, once) | the mill girl | sfx `whisper`, nerve +10 |
| `ward.onEnter` (lit, once) | counting under the drip | sfx `whisper` |
| `mill_yard.onEnter` (once) | +5 `mill_entered`, the shuttle clack | - |

No `afterAction` reactions are needed.

---

## §10 Hints (`content.hints`, ordered critical path; HINT = first step not done, costs 2 points)

| # | id | `done` | tier 1 | tier 2 | tier 3 |
|---|---|---|---|---|---|
| 0 | `showdown` (TT-130) | `{ not: [{ in: 'counting_room' }, { any: [{ var: 'pikeState', eq: 'counting' }, { var: 'harrowFreed', eq: false }] }] }` | one tier, Text variants: Pike counting + cuffs carried + Harrow freed: "No more talking. HANDCUFF PIKE, now." · counting + cuffs: "No more talking. HANDCUFF PIKE, now. Then CUT CHAINS to get Frank down." · counting, no cuffs: "You've nothing to hold him with. Go SOUTH - his count waits while you're gone - and fetch Frank's handcuffs from the Cortina on the moor road." · Pike cuffed + cutters carried: "Pike is cuffed. CUT CHAINS to get Frank down." · else: "Pike is cuffed. Frank's chains want cutters: Silas's bolt cutters, from the shed by the lock." | - | - |
| 1 | `light` | `{ awarded: 'torch_lit' }` | "You won't get far in Blackmere without a light. There's a torch on the waiting-room windowsill, but its batteries are dead." | "Maggie at the Black Lamb has batteries. She helps police officers - once she knows you are one." | "TAKE TORCH in the waiting room. In the Black Lamb: SHOW CARD TO MAGGIE, PUT BATTERIES IN TORCH, TURN ON TORCH." |
| 2 | `room` | `{ awarded: 'harrows_room' }` | "Frank was staying at the Black Lamb. His things might tell you what he knew." | "Maggie keeps the room keys behind the bar." | "Get the key by showing Maggie your card, then go UP. OPEN SUITCASE, READ MAP, READ NOTES." |
| 3 | `silas` | `{ awarded: 'silas_story' }` | "Frank marked someone at the canal lock as a witness." | "Silas Thorne, the lock-keeper, talks for a drink. Maggie sells whisky - once she knows who it's for." | "ASK MAGGIE ABOUT SILAS, BUY WHISKY. Then Station Road, EAST, DOWN, EAST, NORTH: GIVE WHISKY TO SILAS." |
| 4 | `mill` | `{ awarded: 'mill_entered' }` | "Frank circled the mill twice. Its gates are chained." | "Silas has something for chains in his shed." | "Take the BOLT CUTTERS from the shed (east of the lock), go WEST along the towpath to the mill gates and CUT CHAIN." |
| 5 | `ledger` | `{ found: 'ev_ledger' }` | "'Who keeps the book?' The mill kept one." | "The ledger in the counting house is too heavy to carry - but not all of it is." | "In the counting house: TAKE PAGE." |
| 6 | `register` | `{ found: 'ev_register' }` | "The ledger page names a girl, Mary Pike. Who was she?" | "The Fourteen have no names on the church wall. The vicar keeps them somewhere." | "In the vestry of St Jude's: READ REGISTER." |
| 7 | `button` | `{ found: 'ev_button' }` | "Ivy Marsh died at No.13 Chapel Street. Scenes are never as clean as they look." | "Look closely where the killer knelt, by the candle." | "In No.13: SEARCH, then TAKE BUTTON." |
| 8 | `cuffs` | `{ any: [{ carried: 'handcuffs' }, { var: 'pikeState', eq: 'restrained' }] }` | "Frank took his handcuffs with him. Where did Frank go?" | "HQ, the map and the occurrence book all point at the moor road. His car is still there." | "From High Street go NORTH, get IN the car, TAKE HANDCUFFS." |
| 9 | `files` | `{ any: [{ found: 'ev_file' }, 'morgue_hatch_found', 'hatch_oiled'] }` | "Frank asked for Ashcombe Asylum's files from 1971. They were never sent. They're still up there." | "The asylum has a coal chute. The records cabinet is rusted shut - the quarry hut has tools." | "Take the CROWBAR from the quarry hut (EAST of the tally stone). At the asylum: DOWN, NORTH, WEST, OPEN CABINET, TAKE FILE, READ FILE." |
| 10 | `accuse` | `{ any: [{ awarded: 'accusation' }, { var: 'pikeState', oneOf: ['left', 'counting', 'restrained'] }] }` | "You know who it is. Say it - with at least three pieces of evidence on you." | "The man you want is sitting at his desk drinking tea." | "At the Police House, carrying your evidence: ACCUSE PIKE." |
| 11 | `way_down` | `{ visited: 'tunnel' }` | "Harrow is under the mill, but Pike's trap won't open. Silas told you of other ways down." | "The file speaks of a morgue drawer that does not close. And the boiler-room hatch wants oil." | "Asylum morgue, torch on: PULL DRAWER, then DOWN. Or mill boiler room: OIL HATCH, OPEN HATCH, DOWN." |
| 12 | `door` | `{ visited: 'counting_room' }` | "The iron door is barred from the far side. Somebody has to open it from in there." | "Pike goes down to the Counting Room after you accuse him - or at half past eleven anyway - and leaves himself a way out." | "Once Pike has gone down, go NORTH from the tunnel with your torch on." |
| 13 | `arrest` | `{ var: 'pikeState', eq: 'restrained' }` | "Pike has a knife and he's counting. You haven't long." | "Frank's handcuffs." | "ARREST PIKE (you must be carrying the handcuffs)." |
| 14 | `free` | `{ var: 'harrowFreed', eq: true }` | "Frank is chained to the wall." | "Silas's bolt cutters." | "CUT CHAINS (carrying the bolt cutters)." |

All steps done -> "You have everything you need. Finish it." (engine default, no cost).
Step 0 comes first so that, in the Counting Room, HINT answers the only question that matters even when
earlier steps (register, button...) are still undone - blind tester B's in-fight hint was "You haven't long" (TT-130).
Steps 2, 9 are on the path for *fairness* (pointers), not strict necessity; both are reachable early,
so the first-unmet rule never nags about something impossible.

---

## §11 Scoring and ranks (`content.scoring`)

| award id | points | label (shown by SCORE / end screen) | where |
|---|---|---|---|
| `torch_lit` | 5 | Lit the torch | `torch.after.turn_on` |
| `harrows_room` | 5 | Searched Harrow's room | `harrows_room.onEnter` |
| `phone_call` | 5 | Called HQ | `CALL_HQ` |
| `car_found` | 5 | Found Harrow's car | `harrows_car.onEnter` |
| `silas_story` | 5 | Heard Silas's story | `SILAS_STORY` |
| `mill_entered` | 5 | Got into the mill | `mill_yard.onEnter` |
| `ledger_page` | 10 | Evidence: the ledger page | `ev_ledger` |
| `register` | 10 | Evidence: Mary Pike's burial | `ev_register` |
| `button` | 10 | Evidence: the silver button | `ev_button` |
| `file` | 10 | Evidence: the patient file | `ev_file` |
| `accusation` | 10 | Named the Tallyman | `case.correct` |
| `harrow_freed` | 10 | Freed Frank Harrow | `CUT_CHAINS` |
| `arrest` | 10 | Arrested Arthur Pike | `ARREST_PIKE` |
| **total** | **100** | `maxScore: 100`, `hintCost: 2` | L17 |

Ranks: `[{min: 0, title: 'Probationer'}, {min: 20, title: 'Constable'}, {min: 40, title: 'Detective Constable'}, {min: 60, title: 'Detective Sergeant'}, {min: 80, title: 'Inspector'}, {min: 100, title: 'Chief Inspector'}]`.

---

## §12 Reference walkthrough (100/100) and outcome scripts

### 12.1 Winning walkthrough - 91 turns, 100/100, victory at 22:15 (209 turns of slack)
One command per line; each costs exactly 1 turn (A7.4). No meta commands are needed. Column
"turn" = `state.turn` after the command; "score" = running total.

| # | command | room after | effect / check | score |
|---|---|---|---|---|
| 1 | W | waiting_room | | 0 |
| 2 | SEARCH BENCH | waiting_room | coin revealed | 0 |
| 3 | TAKE TORCH AND COIN | waiting_room | list = 1 turn | 0 |
| 4 | E | platform | | 0 |
| 5 | N | station_road | | 0 |
| 6 | N | market_square | | 0 |
| 7 | IN | phone_box | | 0 |
| 8 | CALL HQ | phone_box | coin used, note `hq_call` | 5 |
| 9 | OUT | market_square | | 5 |
| 10 | W | black_lamb | | 5 |
| 11 | SHOW CARD TO MAGGIE | black_lamb | room_key + batteries | 5 |
| 12 | PUT BATTERIES IN TORCH | black_lamb | `torch_loaded` | 5 |
| 13 | TURN ON TORCH | black_lamb | | 10 |
| 14 | ASK MAGGIE ABOUT SILAS | black_lamb | `heard_of_silas` | 10 |
| 15 | BUY WHISKY | black_lamb | money 500 -> 300 | 10 |
| 16 | U | harrows_room | key carried | 15 |
| 17 | OPEN SUITCASE | harrows_room | | 15 |
| 18 | READ MAP | harrows_room | note `case_map` | 15 |
| 19 | READ NOTES | harrows_room | note `harrow_list` | 15 |
| 20 | D | black_lamb | | 15 |
| 21 | E | market_square | | 15 |
| 22 | E | police_house | Pike at desk | 15 |
| 23 | READ BOOK | police_house | note `pike_patrol` | 15 |
| 24 | W | market_square | | 15 |
| 25 | N | high_street | | 15 |
| 26 | W | chapel_street | | 15 |
| 27 | IN | number_13 | | 15 |
| 28 | SEARCH | number_13 | button revealed | 15 |
| 29 | TAKE BUTTON | number_13 | `ev_button` (evidence 1) | 25 |
| 30 | OUT | chapel_street | | 25 |
| 31 | E | high_street | | 25 |
| 32 | NE | church_lane | | 25 |
| 33 | N | st_judes | Ashdown here | 25 |
| 34 | E | vestry | | 25 |
| 35 | READ REGISTER | vestry | `ev_register` (2), note `mary_pike` | 35 |
| 36 | W | st_judes | | 35 |
| 37 | S | church_lane | | 35 |
| 38 | SW | high_street | | 35 |
| 39 | S | market_square | | 35 |
| 40 | S | station_road | | 35 |
| 41 | E | canal_bridge | | 35 |
| 42 | D | towpath | | 35 |
| 43 | E | lock | | 35 |
| 44 | N | lock_cottage | Silas here | 35 |
| 45 | GIVE WHISKY TO SILAS | lock_cottage | `silas_told`, `shed_open` | 40 |
| 46 | S | lock | | 40 |
| 47 | E | shed | | 40 |
| 48 | TAKE CUTTERS AND OIL CAN | shed | list = 1 turn | 40 |
| 49 | W | lock | | 40 |
| 50 | W | towpath | | 40 |
| 51 | W | mill_gates | | 40 |
| 52 | CUT CHAIN | mill_gates | `mill_chain_cut` | 40 |
| 53 | N | mill_yard | | 45 |
| 54 | N | counting_house | | 45 |
| 55 | TAKE PAGE | counting_house | `ev_ledger` (3) | 55 |
| 56 | LISTEN | counting_house | Harrow praying, note `praying` | 55 |
| 57 | S | mill_yard | | 55 |
| 58 | S | mill_gates | | 55 |
| 59 | E | towpath | (beat `towpath_steps` once turn >= 60: not yet) | 55 |
| 60 | U | canal_bridge | beat `bell_22` (turn 60) | 55 |
| 61 | W | station_road | | 55 |
| 62 | N | market_square | | 55 |
| 63 | E | police_house | Pike at desk | 55 |
| 64 | ACCUSE PIKE | police_house | evidence 3: `fled`, arrival turn 63+5 = 68 | 65 |
| 65 | W | market_square | | 65 |
| 66 | N | high_street | | 65 |
| 67 | N | moor_road | | 65 |
| 68 | IN | harrows_car | (Pike reaches the Counting Room this turn, D4) | 70 |
| 69 | TAKE ALL | harrows_car | handcuffs + notebook page, 1 turn | 70 |
| 70 | READ NOTEBOOK PAGE | harrows_car | note `notebook` ("READ PAGE" would ask which page) | 70 |
| 71 | OUT | moor_road | | 70 |
| 72 | N | tally_stone | beat `fog_figure` (nerve +10) | 70 |
| 73 | E | quarry_edge | | 70 |
| 74 | IN | quarry_hut | | 70 |
| 75 | TAKE CROWBAR | quarry_hut | | 70 |
| 76 | OUT | quarry_edge | | 70 |
| 77 | W | tally_stone | | 70 |
| 78 | N | asylum_gates | | 70 |
| 79 | D | coal_chute | | 70 |
| 80 | N | entrance_hall | | 70 |
| 81 | W | records_office | | 70 |
| 82 | OPEN CABINET | records_office | crowbar carried -> open | 70 |
| 83 | TAKE FILE | records_office | `ev_file` (4) | 80 |
| 84 | READ FILE | records_office | note `morgue_drawer` | 80 |
| 85 | E | entrance_hall | | 80 |
| 86 | D | morgue | dark, lit by torch | 80 |
| 87 | PULL DRAWER | morgue | `morgue_hatch_found` | 80 |
| 88 | D | tunnel | door ajar (Pike in since turn 68); music `dread` | 80 |
| 89 | N | counting_room | greeting; `attack` = 1 | 80 |
| 90 | ARREST PIKE | counting_room | `restrained`; counter stops | 90 |
| 91 | CUT CHAINS | counting_room | `harrowFreed` -> D8 **victory** | 100 |

Plain list for `tests/walkthrough/` (91 lines):
```
w
search bench
take torch and coin
e
n
n
in
call hq
out
w
show card to maggie
put batteries in torch
turn on torch
ask maggie about silas
buy whisky
u
open suitcase
read map
read notes
d
e
e
read book
w
n
w
in
search
take button
out
e
ne
n
e
read register
w
s
sw
s
s
e
d
e
n
give whisky to silas
s
e
take cutters and oil can
w
w
w
cut chain
n
n
take page
listen
s
s
e
u
w
n
e
accuse pike
w
n
n
in
take all
read notebook page
out
n
e
in
take crowbar
out
w
n
d
n
w
open cabinet
take file
read file
e
d
pull drawer
d
n
arrest pike
cut chains
```
Expected end: `end` event `victory`, score 100, rank "Chief Inspector", turns 91, time 22:15.
Nerve never exceeds ~20 on this route (lit rooms -1/turn; fog figure +10; Beneath rooms +2/+3).

### 12.2 Variant: boiler-room route (replaces commands 84-91 of 12.1; still 100/100, 102 turns)
After 83 TAKE FILE: 84 `e` (entrance_hall), 85 `s` (coal_chute), 86 `u` (asylum_gates), 87 `s`
(tally_stone), 88 `s` (moor_road), 89 `s` (high_street), 90 `s` (market_square), 91 `s`
(station_road), 92 `e` (canal_bridge), 93 `d` (towpath), 94 `w` (mill_gates), 95 `n` (mill_yard),
96 `d` (boiler_room, dark, torch on), 97 `oil hatch`, 98 `open hatch`, 99 `d` (tunnel), 100 `n`,
101 `arrest pike`, 102 `cut chains` -> victory, 100/100, 198 turns of slack. Tests the second
finale route and the `boiler_hatch` door from both sides.

### 12.3 Other outcomes (each from a fresh game unless stated)
| Outcome | Script | Expected |
|---|---|---|
| **Free-then-cuff victory** | 12.1 #1-89, then `cut chains` (attack 2: "He circles..."), `arrest pike` | victory at turn 91, 100/100 |
| **Pyrrhic** | 12.1 #1-90 (Pike cuffed), then `wait` x 210 | turn 300: `pyrrhic`; bleed beats every 20 turns; score 90 |
| **One that got away** | 12.1 #1-89, `cut chains` (90, attack 2), `s` (91, tunnel; counter paused at 2), then `wait` x 209 | turn 300: `got_away`; score 90 |
| **Fifth stroke (never accused)** | `wait` x 300 | Pike leaves at 240 (`left`), arrives 250; turn 300: `fifth_stroke` default text |
| **Fifth stroke (accused)** | 12.1 #1-64, then `wait` x 236 | turn 300: `fifth_stroke`, `{awarded:'accusation'}` variant; score 65 |
| **Wrong man - Maggie** | `n`, `n`, `w`, `accuse maggie` (prompt, free), `y` | `wrong_man`, `accused_maggie` text, turn 4 |
| **Wrong man - Ashdown** | `n`, `n`, `n`, `ne`, `n`, `accuse ashdown`, `y` | `wrong_man`, Ashdown text, turn 6 |
| **Wrong man - Silas** | `n`, `e`, `d`, `e`, `n`, `accuse silas`, `y` | `wrong_man`, Silas text, turn 6 |
| **Accusation cancelled** | `n`, `n`, `w`, `accuse maggie`, `n` | "(You hold your tongue.)", turn stays 3 |
| **Weak accusation** | `n`, `n`, `e`, `accuse pike` | laugh text, nerve +15 (3 -> 17 after the lit -1), turn 4, game continues |
| **Accuse absent** | `accuse pike` on the platform | "Accuse who? They're not here." turn 0 (free) |
| **Death - drowning** | `n`, `e`, `d`, `e`, `swim` (warning, turn 5), `swim` | `death_drown`, turn 6. Also `enter lock` / `jump` / bare `enter` (shares the one warning) |
| **Death - quarry** | `n`, `n`, `n`, `n`, `n`, `e`, `d` (warning, turn 7), `d` | `death_fall`, turn 8 |
| **Quarry with rope** | ... `e`, `in`, `take rope`, `out`, `d` | arrive `quarry_floor` safely; `u` returns |
| **Death - Pike (lit)** | 12.1 #1-89, then `wait` x 4 | turn 90 "He circles", 91 "Three", 92 lunge (nerve +20), 93 `death_pike` |
| **Death - Pike (dark)** | 12.1 #1-89, `turn off torch` (90: refused with warning; attack 2 "He circles"), `turn off torch` (91) | torch off, attack 3, dark -> `death_pike` (dark text), turn 91 |
| **Arrest without cuffs** | reach the Counting Room without handcuffs, `arrest pike` | "With what? Harrow croaks: 'Cuffs - in my car!'" (1 turn, counter ticks) |
| **Panic (town)** | `n`, `n`, `n`, `ne`, `n`, `d` (crypt, unlit: nerve 7 at turn 6), then `wait` x 16 (+6/turn: dark +5, room +1) | panic text, moved to `market_square`, nerve 50, cooldown 15 |

Each death and ending is followed by UNDO / LOAD / RESTART (A7.7 E4). UNDO after `death_drown`
restores turn 5 (the warning has already been given, so a second SWIM is still fatal).

---

## §13 Softlock audit

**Global guarantees.** No exit is ever removed, there are no one-way exits, and every blocking
condition, once met, stays met (`mill_chain_cut`, `shed_open`, `morgue_hatch_found`, `hatch_oiled`,
the cabinet stays unlocked, Pike never leaves the Counting Room once there). Critical items can't be
destroyed, eaten, drunk, thrown away or given to the wrong NPC (A8.7); DROP leaves them where
they're dropped, and every room stays reachable - including the two rooms behind a gate item
(Harrow's room stays on the latch once entered; the quarry floor's goat track is known once
climbed). Darkness never traps the player: the way back to `prevRoomId` always exists and is
always open in the dark (A8.3 step 4, A17 C39), and anything dropped in the dark can be taken
again by touch (A8.1 groping, A17 C38). Panic moves the player to the zone's safe room and never
happens Beneath. (Softlocks found by TT-022 and fixed in TT-120..123 are listed per row.)

| Item / resource | Needed for | Ways it could be lost, and why it can't be |
|---|---|---|
| `torch` (C) | dark rooms; both ways into Beneath | Never runs out (fuel 320 >= 300, flicker is cosmetic). Can be dropped (retrievable), not thrown, broken or given away. Dropped switched off in a dark room, TAKE TORCH finds it by touch (TT-120). Left in the Counting Room, the dark tunnel always lets you feel your way back in (TT-121); left burning in the tunnel, it does not let you into the Counting Room without it (TT-122). Beneath, where there is no way back in without a light, you can't walk away from it either: the dark tunnel and the dark rooms around it only let you retrace your steps, so it stays within reach. |
| `batteries` (C) | lighting the torch | Two ways to get them (SHOW CARD / ASK ABOUT BATTERIES); `got_batteries` stops duplicates. Until loaded they are protected; loading moves them to `null` deliberately (they are in the torch now, and `torch_loaded` is permanent). Dropped in the dark crypt before loading, TAKE BATTERIES finds them by touch (TT-120). |
| `room_key` (C) | Harrow's room (optional points and pointers) | Protected. Given only by SHOW CARD, which can be done at any time. Once you have let yourself in the door stays on the latch (`entered_harrows_room` opens the `u` exit), so a key dropped in the room can't lock you out (TT-123). |
| `coin` | phone call (optional +5) | Not critical, so it can be thrown into the canal or the quarry. Fallback: ASK MAGGIE ABOUT CHANGE / PHONE gives a 10p while `!phoned` and money >= 210. While the coin is still hidden she points to the bench. |
| `whisky` (C) | Silas's story -> bolt cutters (essential) | Protected: no `drinkable`, refused to every NPC except Silas. If it were somehow `null` with Silas still untold, Maggie sells it again (A8.9). |
| money (500p) | whisky (200), pints (50), 10p (10) | Until `silas_told`, pints need >= 260 and the 10p >= 210, so 200 is always left for the whisky. The wallet is `personal`. |
| `bolt_cutters` (C) | mill chain AND Harrow's chains (essential) | Protected; Silas never takes them back. The shed stays open. |
| `oil_can` (C) | boiler route (alternative) | Protected. The morgue route needs no oil. |
| `crowbar` (C) | cabinet -> patient file (+10, morgue pointer) | Protected. The morgue drawer can also be found without the file (desc: "does not sit flush"; EXAMINE DRAWER: "greased rails"). |
| `rope` (C) | quarry floor (optional lead) | Protected so the quarry floor never becomes unreachable. The quarry floor's `u` exit doesn't need the rope, so you can't get stuck down there. After the first climb (`climbed_down`) the hazard is off - you know the goat track - so a rope left on the floor can't strand the floor above the fatal fall (TT-123). |
| `handcuffs` (C) | arrest (essential for victory) | Protected. Pointers before the finale: the empty cuff pouch in Harrow's room, HQ / map / occurrence book -> the car, the car `initial` text, hint 8, and Harrow in the finale ("Cuffs - in my car!"). |
| `ledger_page`, `button`, `patient_file` (C) | evidence | Protected; dropping lowers the evidence count, picking up restores it. Four sources for a threshold of three, so one can be skipped. |
| `ev_register` (fact) | evidence | A fact, so once found it can't be lost. |
| Maggie / Silas cooperation | items | They never move, never refuse forever, and every gate is a flag that stays set. |
| Pike's arrival | iron door | Either ACCUSE (>= 3 evidence) -> arrives 5 turns later, or automatic at turn 250. A weak or wrong-suspect accusation never blocks him (wrong -> ending, weak -> retry). |
| Counting Room | finale | Re-entry is always possible; the counter pauses outside. Cuffs and cutters can be fetched in either order. |
| Dark Counting Room | - | Through the tunnel door only with a lit torch in hand (msg F). Dark inside only after a warning: switching off inside is refused with a warning first (`torch_off_warned`), and only the second, deliberate TURN OFF arms the counter (`dark_warned`); feeling your way back in by the darkness rule with the torch off always gives the "One..." warning first, whatever was refused earlier (§8.4, TT-105). |
| Lock / quarry hazards | - | Warned once (1 turn); the warning text says what will happen. Bare ENTER at the lock is the hazard (no `in` exit there; the warning points north to the cottage). |
| Clock | - | Reference win at turn 91 (boiler route 102). The latest feasible win: Pike arrives at 250 even if never accused, leaving 50 turns for the tunnel and finale. |
| UNDO after death | - | Restores the line before; hazard warnings stay given (state.warned), matching "warned once". |

**Not softlocks, by design:** never showing the warrant card (Harrow's room stays shut - optional,
hint 2 explains), selling every penny on pints after Silas has his whisky (nothing else costs
money), losing the coin with no money left after `silas_told` (the phone is optional).

---

## §14 Sound cue list and picture list

### 14.1 SFX ids used by content (all exist in TT-013's set)
| id | used by |
|---|---|
| `pickup` | engine TAKE; Maggie's gifts (SHOW CARD, batteries) |
| `door` | engine (door items: `boiler_hatch`); `pike_arrives` in the tunnel |
| `sting` | engine panic; correct accusation at the desk; `fog_figure`; Counting Room greeting; Pike's lunge |
| `bell` | beats `bell_22`, `bell_23`, `bell_2330`, `bell_2345` |
| `thunder` | beat `thunder` |
| `whisper` | beats `counting_dark`, `counting_late`; weaving shed girl; ward counting |
| `footsteps` | beat `towpath_steps` |
| `phone` | `CALL_HQ` |
| `chain` | `CUT_CHAIN`, `CUT_CHAINS`, `ARREST_PIKE` |
| `hatch` | `boiler_hatch.after.open`; `pike_arrives` heard from the counting house |
| `creak` | `PRY_CABINET`, `MOVE_DRAWER` |
| `heart` | beat `last_5` |
| `scream` | `death_pike` (attack daemon) |
UI-only (not emitted by content): `key`, `drop`, `splash`, `death`, `victory`, `error`, `tape`.

**Ambients** (`AMBIENT_IDS`): `rain` (town, canal, mill gates), `wind` (moor, asylum, car, quarry hut
and floor, entrance hall), `drone` (mill zone, crypt, boiler room), `pub` (Black Lamb), `heartbeat`
(Beneath zone: tunnel), `counting` (weaving shed, ward, morgue, Counting Room), `none` (waiting room,
phone box, Harrow's room, Police House, cells, St Jude's, vestry, lock cottage, coal chute, records).

**Music**: `dread` (first tunnel entry), `ending_good` (victory), `ending_bad` (all other endings).
`title` is played by the UI on the title screen.

### 14.2 Pictures
- **Location art (40x9)**: one per room, `picture` id = room id (42): `platform`, `waiting_room`,
  `station_road`, `market_square`, `phone_box`, `black_lamb`, `harrows_room`, `police_house`, `cells`,
  `high_street`, `chapel_street`, `number_13`, `back_alley`, `church_lane`, `st_judes`, `vestry`,
  `churchyard`, `crypt`, `canal_bridge`, `towpath`, `lock`, `lock_cottage`, `shed`, `moor_road`,
  `harrows_car`, `tally_stone`, `quarry_edge`, `quarry_hut`, `quarry_floor`, `mill_gates`, `mill_yard`,
  `weaving_shed`, `counting_house`, `boiler_room`, `asylum_gates`, `coal_chute`, `entrance_hall`,
  `records_office`, `ward`, `morgue`, `tunnel`, `counting_room`. Briefs are with each room in §4.
  Dark rooms' pictures show the torchlit view; while unlit the engine shows `dark` instead.
- **`dark`** (40x9, `rules.darkPicture`): solid black with two faint dark-grey eye-like smudges
  low right, or nothing at all but a single dark-blue dither line - "you can't see a thing". No fx.
- **Screen art (40x25)**:
  - `title`: "THE TALLYMAN" in big block letters (white/light grey) over a black mill silhouette with a
    chimney, fog bands (grey dither), four tall white strokes and a fifth diagonal in red across
    them on the right, "BLACKMERE - NOVEMBER 1984" small at the bottom. fx `rain`, `lightning`.
  - `ending_victory`: dawn-grey sky over Market Square, the blue lamp, six car shapes with blue
    flashing roof lights (light blue), small figures; four strokes, no fifth. fx `fog`.
  - `ending_pyrrhic`: the Counting Room wall: four white strokes, chains hanging empty below in
    grey, a kneeling dark figure at the edge. Muted. No fx.
  - `ending_got_away`: the tally stone on the moor at night with a folded cape at its foot, four
    small stones on it; fog. fx `fog`.
  - `ending_fifth`: the four strokes with a fifth diagonal in red, closing the gate; nothing else. fx `flicker`.
  - `ending_wrong`: the platform, a train's red tail lamps leaving, a tall uniformed silhouette under
    the gas lamp, waving. fx `rain`.
  - `ending_death`: black screen, a fallen torch at bottom-left throwing a yellow cone across the
    floor onto four white strokes. fx `flicker`.
- **Art-gate suggestion (TT-019)**: `market_square` (outdoor, lamps, rain), `counting_house`
  (interior detail, the ledger), `tunnel` (torchlit dark room) - three different lighting problems.

---

## §15 Verification log (TT-015, re-run with the script described below)

Checked mechanically against this file (Python, parsing §3.3, §4, §8.7, §12):

| Check | Result |
|---|---|
| Rooms in §4 vs exit table §3.3 | 42 / 42, identical sets |
| Exit reciprocity (A13 L05; any direction back) | 0 non-reciprocal exits; 0 `oneWay` exits |
| Reachability from `platform` (conditions ignored, L07) | 42 / 42 |
| Room `desc` variants | 51 variants, all <= 300 chars (longest: `counting_room` 251) |
| Glyphs in game text (L09) | ASCII + `£` only; the doc's own `§` and `·` appear only in doc prose |
| Walkthrough §12.1 | 91 commands; movement replay over §3.3 ends in `counting_room`; per-row rooms match the table |
| Turn budget | 91 <= 230 (209 slack; PLAN needs >= 70). Boiler route 102. |
| Score | 13 awards summing to 100; walkthrough running total reaches 100 on command 91 |
| Ending texts | victory 825, pyrrhic 689, got_away 768, fifth_stroke 681 / 707, wrong_man 695 / 687 / 673 chars (target 600-900); deaths 410-505 (short by design: a death is a sting, not an epilogue) |
| Evidence | 4 sources (2 items found by search/tear + 1 fact + 1 item behind a tool), threshold 3 |

Things only the engine can verify (owned by TT-016...TT-018 / TT-022): lint L13 ambiguity with
real scope rules, L21 warnings (`lock`, `oil`, `change` are both nouns/keywords and verb words -
accepted warnings), exact nerve values along the walkthrough, and the RNG-driven beat texts.
