---
id: TT-012
title: Presentation integration: status bar, picture panel, themes, engine wiring, storage adapter
milestone: M2
status: done
agent: ui-dev
model: opus
depends: [TT-011, TT-013]
---
# TT-012 — Presentation integration

## Goal
Wire engine ↔ UI into the playable browser game (PLAN §3.6–3.8; ARCHITECTURE A9 events, A9.3 refresh bundle, A10 host protocol & storage, A10.3 settings, A10.4 lifecycle).

## Scope
- `src/ui/main.js`: boot directly into the game for now (TT-014 adds tape/title before it): create screen (TT-003), terminal (TT-011), audio (TT-013 facade; `unlock()` on first key/tap), `createGame({content, seed})` with real content (`src/content/index.js`), dispatch every event type: `text` (terminal), `room`/`status` (status bar row 0 inverse: room name left, `HH:MM  SC nn` right; nerve shown as border colour), `picture` (picture panel rows 1–9 + divider row 10, animated fx via `src/ui/fx.js` at ~8 fps, respecting reduced motion; `picture null` or GRAPHICS OFF → text region expands), `sfx`/`ambient`/`music` (audio facade), `pause` (delays rendering only — never simulation), `clear`, `prompt`, `end` (ending screen art from `content.art`, title + score + rank overlay, then "UNDO, LOAD, RESTART or IMPORT?"), `storage`, `host`.
- Border colour by nerve: theme border < 50; purple 50–79; red, pulsing ≥ 80 (static if reduced motion).
- `src/ui/storage.js`: StorageAdapter per A10.1 — localStorage in try/catch; if unavailable: one-time notice and in-memory slots; EXPORT → Blob download `tallyman-save.json`; IMPORT → hidden file input → `game.load(data)` (A10.2). Settings (sound, music, theme, typewriter) persisted when storage works.
- Themes: `c64` default, `spectrum`, `amber` via THEME command (`host` setting events) — full re-render.
- Fix TT-016 note: `src/content/index.js` uses top-level `await` for art; esbuild iife can't bundle it — convert to static import (allowed edit) and make `npm run build` produce a working `dist/tallyman.html` with the whole game.
- URL params for testing: `?seed=n`, `?script=cmd1|cmd2|…` (auto-types commands, instant typewriter), `?theme=`.
- Tests: `tests/unit/storage.test.js` (adapter with throwing/missing localStorage, in-memory fallback, settings), `tests/unit/events-dispatch.test.js` (pure dispatcher mapping events → UI calls with fakes).

## File allow-list
`src/ui/main.js`, `src/ui/storage.js`, `src/ui/statusbar.js`, `src/ui/picture.js`, `src/ui/dispatch.js`, `src/ui/terminal.js` (integration fixes only), `src/index.html`, `src/content/index.js` (static art import only), `tools/build.js` (only if needed), `tests/unit/storage.test.js`, `tests/unit/events-dispatch.test.js`, `docs/screenshots/tt012-*`

## Acceptance criteria
- [ ] `npm run build` → `dist/tallyman.html` playable via `file://` (screenshot with `?script=w|search bench|take torch|e|n|n|w`), C64 and Spectrum themes, 1800 px and 390 px; viewed and described.
- [ ] Zero console errors during a scripted session (capture via CDP).
- [ ] `npm run check` green.

## Orchestrator notes
- Read `tickets/TT-011-terminal-interaction/implementation.md` (terminal API; wrap sfx/picture/status/room events in `term.mark(fn)` so they fire in order after the typed text), `tickets/TT-013-audio/implementation.md` (facade, `sfxLoop`, unlock), `tickets/TT-019-art-style-gate/implementation.md` (`src/ui/fx.js`), `tickets/TT-021-art-screens/implementation.md` (reserved rows on ending screens).
- `src/content/index.js`: replace the top-level-await art loader with a static `import { art } from './art/index.js'` (all art exists now) — remove the `withArt` fallback.
