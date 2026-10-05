---
id: TT-014
title: Boot: tape-loading screen, title screen, intro, ending screens
milestone: M2
status: todo
agent: ui-dev
model: sonnet
depends: [TT-012, TT-013, TT-021]
---
# TT-014 — Boot sequence

## Goal
The nostalgic wrapper (PLAN §1, §3.6): what a 1984 player saw before the game.

## Scope
- `src/ui/boot.js`: (1) **C64 power-on screen** (C64 theme): "**** COMMODORE 64 BASIC V2 ****", "64K RAM SYSTEM  38911 BASIC BYTES FREE", "READY.", then `LOAD"TALLYMAN",1` typed out, "SEARCHING FOR TALLYMAN", "FOUND TALLYMAN", "LOADING" — Spectrum theme variant uses `LOAD ""` and the "Program: TALLYMAN" header style; (2) **tape loading**: border stripes animated via `screen.setBorderPainter` (C64: thin flickering coloured bars; Spectrum: red/cyan pilot then blue/yellow data), audio `sfxLoop('tape')`, ~4 s total, the title art "loading" in row by row (Spectrum-style) ; (3) **title screen**: `content.art.title` 40×25, row 24 "PRESS ANY KEY" blinking, title music (`music('title')` after unlock); (4) any key → stop music → intro (`game.start()` events). Skip: any key during (1)/(2) jumps to title; `?skipboot=1` param and reduced-motion → straight to title. The first key press doubles as the audio unlock.
- Ending flow: on `end` event show `content.art[ending.art]` full-screen with the ending title + score/rank in reserved rows (see TT-021 implementation.md), ending music, then the "UNDO / LOAD / RESTART / IMPORT" prompt.
- Tests: pure boot state machine in `tests/unit/boot.test.js` (states, skip transitions, timers with injected clock).

## File allow-list
`src/ui/boot.js`, `src/ui/main.js` (boot wiring), `tests/unit/boot.test.js`, `docs/screenshots/tt014-*`

## Acceptance criteria
- [ ] Screenshots of power-on, mid-tape-load, title, and one ending screen (both themes), viewed.
- [ ] `npm run check` green; `dist/tallyman.html` boots via `file://` without console errors.
