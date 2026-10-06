# TT-012 — Presentation integration: implementation

## Summary
`npm run build` now produces a playable single-file game: `dist/tallyman.html`, 634 KB, opened over `file://`. It boots straight into `game.start()`; TT-014 will put the tape-loading and title screens in front of it.

**Screen layout and rendering**
- **Status bar.** Row 0 is inverse, with the room name on the left and `HH:MM  SC nn` on the right.
- **Nerve border.** Below 50 the border is the theme colour, from 50 to 79 it is purple, and from 80 it is red with a heartbeat pulse (steady under reduced motion).
- **Picture panel.** Rows 1–9 hold the picture and row 10 is the divider. fx animate at 8 fps unless reduced motion is on. `picture null` or GRAPHICS OFF hides the panel and gives the text rows 1–24.
- **Event ordering.** Every event goes through a pure dispatcher. text, clear and pause are queued; room, picture, status, sfx, ambient, music, end and setting changes go through `term.mark()`, so they happen when the typewriter reaches them.

**Engine features wired up**
- **Audio.** SFX, ambience and music are wired. `unlock()` runs on the first key or tap, typed keys click, and F2 toggles sound.
- **Endings.** The ending music starts and the ending text is printed in the terminal, followed by a blinking `[PRESS ANY KEY]`. Then the 40×25 ending art is shown, with fx. Rows 19–21 hold the title, score and rank, and rows 22–24 are a terminal (2 output rows plus input) on black paper showing "UNDO, LOAD, RESTART or IMPORT?". The refresh bundle's `clear` returns to the play screen.
- **Storage (A10.1/A10.2).** localStorage is used with a probe, every call is wrapped in try/catch, and if it is unavailable the game says so once and keeps saves in memory. SAVE and LOAD work, EXPORT downloads a Blob, and IMPORT uses a hidden file input and blocks input while the picker is open. All the A10.2 messages are printed.
- **Settings (A10.3).** Sound, music, typewriter and theme are persisted. THEME c64, spectrum, amber and next all work and trigger a full redraw.

**URL parameters**
- `?seed=`, `?script=a|b|…` (typewriter off; it pages through [MORE] and the ending key), `?theme=`, `?static=1` (reduced motion) and `?storage=off`.
- `window.__tallyman` exposes hooks for CDP tests.

## Files changed
- `src/ui/main.js`: the browser host. Rewritten; it was a placeholder.
- `src/ui/dispatch.js` (new): `createDispatcher(ui)`, `resolveSetting` and `HOST_MESSAGES`. Pure.
- `src/ui/storage.js` (new): `createStorageAdapter`, `probeStorage`, `loadSettings` and `formatSlot`.
- `src/ui/statusbar.js` (new): `statusText`, `borderForNerve`, `borderAt` and `drawStatus`.
- `src/ui/picture.js` (new): `createArtLayer`, which restores only the cells changed by the previous fx frame, so text printed over the art survives. Also `drawArt` and `drawDivider`.
- `src/ui/terminal.js`: an integration fix. The adapter gains `setColors({paper, roles})` so the terminal can draw on the black ending screen; the Spectrum's black body text would otherwise vanish there.
- `src/index.html`: a full-window stage, as in the terminal test page.
- `src/content/index.js`: art is now a static `import { art } from './art/index.js'`. The top-level-await loader and `withArt` are removed.
- `tests/unit/storage.test.js`: 11 tests. `tests/unit/events-dispatch.test.js`: 16 tests, which include the real start bundle, save/load and import round trips through the engine, and the status bar, border and art-layer helpers.
- `docs/screenshots/tt012-*.png`: 21 screenshots.

## Decisions made
- **Host requests are serviced at once; presentation effects are deferred.** storage and host requests are always the last event of a call (O2) and only queue output, so they run straight away. IMPORT also runs straight away so that `input.click()` keeps the keypress's user activation. Settings are resolved and persisted immediately, but applied in a mark and acknowledged in order.
- **The ending text is shown in the terminal before the ending screen.** The 6 reserved rows cannot hold paragraphs. The player reads the text with the picture still up, presses a key, and gets the art. The ending prompt is a terminal line, so the player types UNDO, LOAD n, RESTART or IMPORT as A10.4 describes, and any rejected command gets the engine's own answer.
- **The ending screen keeps black paper** in every theme, like the TT-021 preview, using palette keys that are readable on Spectrum and amber.
- **The storage notice is printed once at boot**, after the intro, only when storage is unavailable.
- **The QUIT command starts a new game with a fresh seed** until TT-014 adds the title screen to return to.
- **Typed keys click (`key` SFX) for char, delete and enter only.** Skip and MORE keys stay silent.

## How verified
- Tests were written alongside the code. `node --test` gives 27/27 for the new files. The terminal suite still passes after the `setColors` change.
- **CDP play-test.** The script is `<scratchpad>/tt012-cdp.mjs`: headless Chrome with real key events, run against `file://…/dist/tallyman.html`. All 41 checks pass, with 0 console errors, warnings or exceptions across the run:
  - the scripted route `w|search bench|take torch|e|n|n|w` in c64, spectrum and amber, at 1800 px, at 390 px, and at 390 px with dpr 3; no horizontal scroll
  - a typed session with the typewriter on: the intro pages at [MORE], then w, take torch, THEME SPECTRUM (persisted), GRAPHICS OFF/ON (region 1–24 and back to 11–24), F2 mute and unmute, SAVE 1, e, LOAD 1
  - the wrong-man ending (`accuse maggie`, `yes`) in both themes: text, the key, the ending screen, `look`, then UNDO back to play
  - `?storage=off`: a session-only save and reload, with the notice shown once
  - EXPORT writes a valid `tallyman-save.json` download; IMPORT opens the file chooser with input blocked, and loading that file restores the game
  - crafted nerve 60 and nerve 90 give a purple and a red border.
- **Screenshots viewed:**
  - C64 Black Lamb: warm pub art, the white status bar, the `> W` echo and the room text.
  - Spectrum: white paper and a blue status bar; at dpr 3 the text is crisp.
  - 390 px: the whole screen fits at scale 1.
  - Intro: rain fx on the platform and the yellow [MORE].
  - Ending: the rainy station platform art with THE WRONG MAN, the score, the rank and the yellow prompt on black.
  - Nerve 90: a red border.
- `npm run check` tail:
```
lint:content src/content (strict): 0 error(s), 27 warning(s)
# tests 1738
# pass 1729
# fail 0
# todo 9
build: wrote dist/tallyman.html (634091 bytes)
```

## Known gaps / follow-ups
- **TT-014.** Put the tape-loading and title screens before `newGame()` in `main.js`, and make QUIT return to the title. The ending flow is already done here, so TT-014 only needs to add its own screenshots of it.
- **Ending screen space.** Its terminal has 2 output rows, so a long answer there (e.g. the RESTART confirmation) pages with [MORE]. It works but is tight.
- **Nothing has been heard.** The audio wiring was tested only as calls (mute flag, F2). Headless runs never unlock audio.
- **The CDP script lives in the scratchpad**, because `tools/` is outside the allow-list. TT-023 may want to adopt it.
- **Art observation, not mine to fix:** on the Spectrum ending art, a rain streak crosses the "BLACKMERE" nameboard edge cell.

## Out-of-scope edits
None. `terminal.js` (integration fix) and `src/content/index.js` (static art import) are both in the allow-list.
