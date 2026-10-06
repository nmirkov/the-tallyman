# TT-131 — Parser and content gaps from the blind playtest: implementation

## Summary
Every friction point in `docs/playtest/tester-{A,B}-{log,report}.md` is either fixed with a test that replays the tester's command, or accepted with a reason (table below). Finale and HELP points went to TT-130. The new suite is `tests/content/playtest-gaps.test.js` (23 tests); `tests/unit/resolve.test.js` gained 3 engine tests.

| # | Friction (tester's command) | Outcome |
|---|---|---|
| 1 | `ask harrow about pike` through the door → "Which do you mean, the room key, the map or the Harrow's notes?" | **Fixed (engine, `resolve.js`).** A phrase that names a person no longer falls back to the adjective-only match. Things named after that person ("Harrow's key", the file with the adjective `pike`) no longer match. If that person is absent and is a named (`proper`) NPC, the reply is "Harrow isn't here." (`messages.personNotHere` can override it). A verb's own `notHere` still wins. In M4 narrowing, a person beats objects. |
| 1b | `accuse pike` in Records, file in hand → "You can only accuse a person." | **Fixed** by #1: now "Accuse who? They're not here." (free). |
| 1c | `examine tunic` at the desk → described the carried button | **Fixed.** The Police House has `tunic, uniform, buttons` scenery in 3 variants (the missing button once `ev_button` is found). The full-name match (M4a) wins. |
| 2 | Church Lane `in` / `enter cottage` → into the church | **Fixed.** The `in` exit is gone, so IN is no longer listed. IN, GO IN, ENTER and ENTER COTTAGE all say Edna's cottage is boarded up and that the church door is NORTH. ENTER CHURCH and GO TO CHURCH go in. Decision: the cottage is the first victim's, police-boarded, and not enterable. |
| 3 | `oil cabinet` with the can → "nothing suitable to oil" | **Fixed.** `cabinet.before.oil` = `OIL_CABINET`: the rust is not a stiff hinge, so it wants levering. |
| 4a | `say five`, `shout`, `call out` | **Fixed.** New content verb `say` (say, shout, yell, call out, whisper, cry; free text). Generic reply, plus room replies: Pike at his desk, Maggie, Silas, the tunnel (reaches Harrow exactly like KNOCK), and the Counting Room (Pike, then TT-130's `HARROW_CUFFS`). |
| 4b | `breathe` | **Fixed.** Content verb: "In for four, out for four. You catch yourself counting, and stop." |
| 4c | `drive` | **Fixed.** Content verb. The car and the moor road say why not (wheels in the ditch; the keys are evidence). |
| 4d | `open boot`, `examine glovebox`, `x glove box`, `trunk` | **Fixed.** Car scenery: glovebox / glove box / glove compartment / door pockets, boot / trunk, car / cortina. The moor road has boot scenery too, and OPEN for both. |
| 4e | `examine towpath` on the Towpath; GO / ENTER TOWPATH | **Fixed.** Towpath scenery on the towpath and the three rooms next to it. GO / WALK / HEAD / RUN [TO] X now means ENTER X (content patterns on `enter`). From the bridge, the lock or the mill gates it walks you there. On the towpath: "You're standing on it." ENTER COTTAGE at the lock goes to Silas. Bare ENTER there is still the lock hazard. |
| 4f | `buy whisky for silas` → unknown word "for" | **Fixed.** Pattern `buy {dobj} for {topic}`. If the topic is Silas, `whisky.before.buy` sets `heard_of_silas` and the sale goes through. |
| 4g | `buy whisky` didn't clearly say you paid | **Fixed.** The text now ends "You pay her, and the bottle is yours." |
| 4h | `X` alone → "What do you want to x?" | **Fixed (engine, `parser.js` + `resolve.js`).** A one-letter verb word now reports the verb's name: "What do you want to examine?" |
| 4i | `X ALL` → "You can't use ALL with that verb." | **Fixed.** `messages.allNotAllowed`: "One thing at a time, Sergeant." |
| 5 | `ask silas about tallyman`, `thursday`, `shed` | **Fixed.** Silas now answers `t_tally` (with new keywords killer, murderer, tally man), `t_murders`, `t_mill` and `shed_door`. `t_counting` gets thursday / thursdays. `t_alibi` moves above it, so "last thursday" stays an alibi question. Audit of the other testers' topics: `ask maggie about margaret` gets a new `maggie` topic (a clue reply once the letters are found); `ask maggie about rooms` gets a new `t_room` topic. |
| 5b | Silas repeats the whole "Dry throat" paragraph for every ASK | **Fixed.** He gives the full speech once (flag `silas_dry`), then a short line. |
| 6 | `read notice` → "There's nothing written" while EXAMINE shows the order | **Fixed for every room.** Hook `read_scenery`: READ of any scenery entry says its desc. `index.js` gives every room with scenery `before.read`. A test reads every scenery entry in all 42 rooms. |
| 7 | `listen` in the Tunnel while Harrow prays | **Fixed.** The Tunnel has three variants (praying / slower / Pike counting), and the first two point at KNOCK. Audit of rooms whose prose makes a sound: platform, lock, Police House (Pike's pencil), car (radio), ward (drip) and Counting Room get LISTEN. The counting house already had one. |
| 8 | "Your torch flickers…" ×12, no pay-off | **Fixed.** Three once-beats at ≥185, ≥225 and ≥262; the third pays off ("It is your hand."). The RNG is no longer used. Tested over a full late game: exactly 3. |
| 9 | SEARCH is mostly "nothing of interest" / SEARCH ROOM | **Verified, test added.** SEARCH ROOM already finds every hidden item: coin, button, Bugle, letters. |
| — | `take flowers` → "That's fixed in place." | **Fixed.** `messages.fixed`: "You leave it where it is." |
| — | `open coal-hole lid`, `open cupboard` → "You can't open that." | **Fixed.** Specific replies via `before.open`. |
| — | `open wallet` → can't open | **Fixed.** It shows the contents, including `{money}`. |
| — | Tunnel "Steps climb south" / Morgue exits only "up" | **Fixed.** The Tunnel now says "Iron rungs climb south" (scenery `steps, rungs`). Coming up from the tunnel finds the hatch (`morgue_hatch_found`, hook `from_tunnel`), so DOWN is listed. |
| — | `call hq` needs 10p, never found (B) | **Accepted.** The call is optional. The 10p is in the bench (SEARCH) and Maggie gives change (ASK MAGGIE ABOUT CHANGE). |
| — | `use radio` → "more specific" (A: "fine-ish") | **Accepted.** EXAMINE RADIO explains the pulled aerial. |
| — | Morgue drawer hatch "redundant" (A) | **Accepted.** It is the asylum-side way down (STORY §7.1). |
| — | Time passes while fiddling (B) | **Accepted.** That is the design (D-011). |

## Files changed
- **Engine (allow-listed):**
  - `src/engine/resolve.js`: `personsNamed`, `personNotHere`; the no-adjective-fallback rule; the "person beats things" narrowing; `verbName` in `parseErrorResult`.
  - `src/engine/parser.js`: `verbName` on missing-noun.
- **Content:**
  - new `src/content/hooks.js`;
  - `index.js` (hooks, messages, scenery READ);
  - `rules.js` (`messages`);
  - `verbs.js`; `topics.js`; `beats.js`; `registries.js` (`silas_dry`);
  - `npcs/maggie.js`, `npcs/silas.js`;
  - `zones/town.js`, `canal.js`, `moor.js`, `mill.js`, `asylum.js`, `beneath.js`.
- **`docs/STORY.md`:**
  - new §1.8 (message overrides) and §7.6 (hooks);
  - §3.3 church_lane;
  - §4 rooms: platform, police_house, back_alley, church_lane, vestry, black_lamb, canal_bridge, towpath, lock, lock_cottage, moor_road, harrows_car, mill_gates, ward, morgue, tunnel, counting_room;
  - §5.2 wallet, whisky, cabinet; §6.1 topics; §6.2 Maggie; §6.5 Silas; §7.4 verbs; §7.5 flags; §9.1 beats.
- **Tests:**
  - new `tests/content/playtest-gaps.test.js`;
  - `tests/unit/resolve.test.js` (+3);
  - `tests/unit/parser.test.js` (`verbName`);
  - `tests/unit/game.test.js` ("Maggie isn't here.");
  - `tests/content/town-canal.test.js` (Silas short DRY, 30 flags);
  - `tests/content/beneath.test.js` (tunnel rungs).

## Decisions made (with why)
- **Hooks for command-aware rules.** Conds cannot see the command's dobj or topic, and room `before` fires for every object. Seven tiny pure hooks avoid catch-all room reactions; for example, OPEN in the car would otherwise answer OPEN HANDCUFFS. H6 still holds: everything else is data.
- **READ of scenery done in content (hook + `index.js`)**, not in `actions/observe.js`, which is outside the allow-list. The behaviour equals EXAMINE, so the scenery prose is the single source.
- **"<Name> isn't here." only for `proper` NPCs** named by one of their own name words. "x man" with Silas away stays "You can't see any such thing.", so the game does not leak who "the old man" is.
- **The torch flicker is cosmetic but now pays off.** It stays fair to PLAN §2.2 #1 (the torch never fails).

## How verified
- Each tester command was replayed in the scratchpad before and after the fix, then encoded in `playtest-gaps.test.js`.
- The walkthroughs are unchanged: §12.1 wins 100/100 on turn 91, and §12.2 on turn 102.
```
lint:content src/content (strict): 0 error(s), 27 warning(s)
# tests 1883
# pass 1883
# fail 0
build: wrote dist/tallyman.html (681644 bytes)
```

## Out-of-scope / follow-ups
- **`docs/ARCHITECTURE.md`** (not in my allow-list) should record:
  - A6.3 M2: no adjective-only fallback for a phrase that names an NPC;
  - A6.3 M4: a new narrowing step, a person beats things named after them;
  - A6.3 M6: "<Name> isn't here." and `messages.personNotHere`;
  - A6.2: the optional `verbName` on missing-noun errors;
  - the `ParseError` JSDoc in `types.js`.
- PHONE BOX: READ CARD reads your warrant card when you carry it. That is the A6.3 M4b rule: items beat scenery. READ NOTICE works.
- The UI agent does not need to change anything.
