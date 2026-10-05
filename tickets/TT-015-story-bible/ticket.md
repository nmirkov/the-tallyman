---
id: TT-015
title: Write the complete story bible and reference walkthrough (docs/STORY.md)
milestone: M3
status: todo
agent: writer
model: opus
depends: [TT-002]
---
# TT-015 — Story bible

## Goal
The single source of truth for all content tickets (TT-016…TT-018, art TT-019…TT-021, QA TT-022/024). It instantiates PLAN §2 (all of it, especially §2.5) into concrete, buildable data — no hand-waving.

## Deliverable: `docs/STORY.md`
1. Premise, tone, cast (Pike, Harrow, Maggie, Ashdown, Silas, mill-girl ghost; appearance + voice + secret for each).
2. **Room table** (~38 rooms): id, name, zone, dark?, safe room?, exits (compass → id; conditions), scenery list (every noun mentioned in the description), description text (≤ 300 chars, final prose), picture brief (one line for the artist: composition, colours, fx), ambient id, nerve delta. Include a compass ASCII map per zone.
3. **Item table**: id, names, adjectives, start location, portable, critical, hidden?, container/lock data, description, read text, evidence id.
4. **NPC topic tables**: for each NPC, topics (keywords → reply text, conditions, flags set), default replies, accepts (GIVE/SHOW reactions), schedule.
5. **Puzzle graph**: each step's prerequisites → action (with all accepted verb phrasings) → result (flags, points, notes text).
6. **Finale & endings**: §2.5 instantiated: exact texts for accusation outcomes, barred door before/after (prose must explain why it opens — Pike left it ajar behind him), attack counter messages per value, Harrow bleeding cues, every ending text (≈ 600–900 chars each) and death texts with their prior warnings.
7. **Scripted beats**: time-based and flag-based events with text and sfx ids (church bell, counting voices, figure in the fog, torch flicker, 23:00 warning, Pike leaving 23:30…).
8. **Hints**: ordered steps with done-conditions and 2–3 tiers each.
9. **Scoring** table (=100) and ranks.
10. **Reference walkthrough**: numbered command list that wins 100/100 in ≤ 230 turns (count them; meta commands excluded), plus short command lists for every other ending and death.
11. **Sound cue list** (sfx ids used) and **picture list** (ids + briefs) for audio/art tickets.

## Acceptance criteria
- [ ] Consistent with PLAN §2 and ARCHITECTURE.md field names (use the schema's terms).
- [ ] Handcuffs are discoverable before the finale with an in-world pointer (Codex plan review R3 note 7); every clue has a pointer (PLAN §2.2 clue fairness).
- [ ] No softlocks: a short "Softlock audit" section walks through each critical item and consumable.
- [ ] Description texts use only ASCII + `£` (normaliser handles curly quotes, but write straight ones).

## File allow-list
`docs/STORY.md`
