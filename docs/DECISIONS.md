# Decisions log (ADR-lite)

| ID | Date | Decision | Why |
|---|---|---|---|
| D-001 | 2026-10-05 | Browser game, vanilla JS ES modules, esbuild dev-dep only, single-file offline `dist/tallyman.html`. | Best route to authentic 8-bit visuals + WebAudio sound with zero install for the player. |
| D-002 | 2026-10-05 | 40×25 canvas character screen with public-domain font8x8 (dhepper). | Real C64 geometry; offline; block/box glyphs available for PETSCII-style art. |
| D-003 | 2026-10-05 | Pure deterministic engine emitting Output Events; terminal player shares the engine. | Enables walkthrough/fuzz tests and AI playtesting without a browser. |
| D-004 | 2026-10-05 | Claude builds (sub-agents per role), Codex `gpt-6-astra` (high) reviews plan and each milestone. | Cross-vendor review per Nenad's adapted process; Codex usage kept to reviews. |
| D-005 | 2026-10-05 | Story: "The Tallyman", Blackmere 1984, killer PC Arthur Pike. | Crime thriller with folk-horror layer, as requested. |
| D-006 | 2026-10-06 | Engine contract (docs/ARCHITECTURE.md, TT-002) approved by orchestrator; its decisions C1–C36 are binding (notably: declarative Cond/Reaction content language, finale state as content vars, LOOK costs a turn, INVENTORY free). | Gate before M1 per PLAN §5; consumer tickets updated accordingly. |
