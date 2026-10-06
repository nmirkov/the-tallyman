---
id: TT-131
title: Parser and content gaps from the blind playtest
milestone: BUG
status: in-progress
agent: writer
model: opus
depends: [TT-024]
severity: medium
---
# TT-131 — Playtest gaps

Fix the friction both blind testers logged (full logs in `docs/playtest/tester-{A,B}-log.md`, reports alongside). At least:
1. `ASK HARROW ABOUT PIKE` prompts "which: room key, map or notes" — NPC must win over items whose adjective is the NPC's name for ASK/TELL/TALK/SHOW…TO/GIVE…TO targets (engine resolve.js rule + test), and generally a person beats objects named after them.
2. Church Lane: `IN` / `ENTER COTTAGE` go into the church instead of Edna's cottage — fix exits/scenery per STORY map (decide what "cottage" is there; if not enterable, say so clearly).
3. `OIL CABINET` with the oil can → sensible response (it's not the hinge that's stuck — rust; use leverage) rather than "nothing suitable".
4. Unknown words: SAY/SHOUT/CALL OUT <text> (generic "You say it aloud. ..." + Pike/Harrow special cases), BREATHE, DRIVE (car: no keys), GLOVEBOX/GLOVE BOX/BOOT/TRUNK scenery in Harrow's car, TOWPATH as noun (GO TOWPATH / ENTER TOWPATH), `BUY X FOR Y` (prep "for"), `X` alone → "Examine what?", `X ALL` → sensible refusal.
5. ASK SILAS ABOUT TALLYMAN (and other natural topic synonyms: killer, murders, mill, tunnel, Pike, Harrow) — audit every NPC's topic keywords against the testers' attempts.
6. `READ NOTICE` says blank while EXAMINE shows the order — make READ consistent everywhere (audit all readable scenery).
7. `LISTEN` in the counting house while the prose mentions praying → hear Harrow; audit LISTEN in rooms whose text mentions sounds.
8. "Your torch flickers…" repeats ~12 times — reduce frequency (e.g. max 3 times, spaced) or make it pay off.
9. SEARCH "nothing of interest" is fine, but where a room has a hidden item make SEARCH ROOM work as well as SEARCH <thing>.
Every other "I don't know the word"/unhelpful refusal in the logs: fix if a reasonable player would expect it; otherwise list as accepted.

## File allow-list
`src/content/**` except art; `src/engine/vocab.js`, `src/engine/parser.js`, `src/engine/resolve.js` (with tests); `docs/STORY.md`; `tests/**`
(Coordinate: TT-130 runs in parallel on the finale — leave Counting Room/Pike finale reactions and HELP text to it.)

## Acceptance
- [ ] Each logged friction point: fixed (with test) or accepted (reason) in implementation.md. Walkthroughs 100/100; `npm run check` green.
