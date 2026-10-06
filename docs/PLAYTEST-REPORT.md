# Blind playtest report (TT-024)

Two clean-context AI testers played via the terminal player with no access to the repo (D-010). Raw reports/logs: `docs/playtest/`.

| Tester | Style | Result | Turns | Hints | Rating |
|---|---|---|---|---|---|
| A | thorough explorer (opus) | attempt 1 **lost** (stabbed in the finale, 50/100, turn 272); attempt 2 **won 100/100** at turn 173 | 272 / 173 | 0 | 8/10 (fairness 7.5) |
| B | impatient, uses HINT (sonnet) | **won 89/100** first attempt, turn 266 | 266 | 3 | 8/10 |

**What worked:** atmosphere and prose ("superb"), Pike clues well signposted, vicar red herring "excellent", timer tight but fair for first-timers (D-011: keep 300).

**Triage (orchestrator):**
| Ticket | Severity | Finding |
|---|---|---|
| TT-130 | high | Finale: both testers tried ACCUSE/SHOW in the Counting Room; nothing pointed to HANDCUFF PIKE until the death text. |
| TT-131 | medium | Parser/content gaps: ASK HARROW hijacked by "Harrow's" items, Church Lane IN, OIL CABINET, GLOVEBOX/BOOT, SAY, BUY … FOR, X alone, topic synonyms (Silas/tallyman), READ NOTICE vs EXAMINE, LISTEN for praying, repetitive torch flicker. |
| TT-132 | low | R2 round-2 UI notes (not playtest). |
