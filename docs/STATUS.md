# Status

**Phase:** **v1.0 released** (tag `v1.0`).
**Updated:** 2026-10-06

| Milestone | State |
|---|---|
| Plan | v1.2 approved by Codex (3 rounds) |
| M0 Foundations | done (`m0`) |
| M1 Engine | done (`m1`) — R1: 11 defects fixed over 3 rounds |
| M2 Presentation | done (`m2`) — R2: 2 defects fixed |
| M3 Content | done (`m3`) — R3 approved with notes; 4 softlocks found by QA and fixed |
| M4 Release | done (`v1.0`) — smoke 8/8, blind playtest (3 testers, all won), R4 Codex APPROVED WITH NOTES |

## Numbers
- ~1,900 automated tests (unit, content, walkthrough, solvability, save-determinism, fuzz); strict content lint 0 errors.
- 42 locations with PETSCII pictures + dark view, title + 6 ending screens, 20 SFX, 4 tunes, 6 ambiences.
- Release build: one offline file, ~475 KB.

## Known gaps (post-1.0)
- No automated touch/IME/mobile-keyboard smoke (D-013).
- Audio verified by measurement only — nobody has listened to it yet (`tools/audio-demo.html`).

## Log
- 2026-10-05 — Plan drafted; Codex plan review 3 rounds → approved.
- 2026-10-06 — Engine, presentation, content, art, QA built by agents; Codex out of credits mid-way (D-009, fallback reviewer); blind playtests; finale guidance fixed; Codex back for the final review; v1.0.
