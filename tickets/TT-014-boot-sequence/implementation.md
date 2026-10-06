# TT-014 — Boot sequence: implementation

## Summary
The game now opens the way a 1984 tape game did. The theme decides which machine is imitated: c64 and amber get the C64 sequence, spectrum gets the Spectrum one.

| Phase | C64 (c64 / amber theme) | ZX Spectrum (spectrum theme) |
|---|---|---|
| power | Light-blue border, blue screen, then the real banner: `    **** COMMODORE 64 BASIC V2 ****`, ` 64K RAM SYSTEM  38911 BASIC BYTES FREE`, `READY.` and a blinking block cursor | A black RAM-check flash, then the white screen with `(c) 1982 Sinclair Research Ltd` on the bottom row |
| type | `LOAD"TALLYMAN",1` typed at the cursor | Flashing `K` cursor, then keyword entry `LOAD ` with an `L` cursor, then `""`, then ENTER clears the line |
| play | `PRESS PLAY ON TAPE`. **Waits for a key**, which acts as PLAY and also unlocks audio | `Start tape, then press any key.` (the Spectrum's own SAVE prompt). Waits for a key |
| search | `OK`, `SEARCHING FOR TALLYMAN`, the screen blanks to the border colour, then `FOUND TALLYMAN` and `LOADING` | Red/cyan pilot stripes, a blue/yellow header burst, `Program: TALLYMAN`, then pilot again |
| load (3.6 s) | Thin, flickering multicolour turbo-loader bars in the border; the title art loads row by row in full colour on black | Blue/yellow data bars; the title loads as a **monochrome bitmap**, then the **colour attributes flood in** top to bottom, as a real SCREEN$ does |
| title | Title art with its rain and lightning fx, black border, `PRESS ANY KEY` blinking on row 24, and `music('title')` | Same |

The tape screech, `sfxLoop('tape')`, runs from search to the end of loading. A key on the title stops the music and starts `game.start()` (the intro).

**Skipping and start modes**
- Any key or tap during power, type, search or load jumps to the title.
- `?skipboot=1` (also `?boot=title`) and reduced motion (`prefers-reduced-motion` or `?static=1`) go straight to the title.
- New: `?boot=off` and `?script=` go straight into the game, so the TT-012 scripted checks still work.
- QUIT now returns to the title instead of starting a new game.

**Endings.** The ending flow is TT-012's and is unchanged: ending text, then a key, then full-screen art with title, score and rank, then the UNDO/LOAD/RESTART/IMPORT prompt. TT-014 adds screenshots of it in both themes.

## Files changed
- `src/ui/boot.js` (new). Pure parts:
  - `createBootMachine` (injected clock; effects returned as data)
  - `bootScene` (what each phase shows)
  - `stripeBands` (border stripes, deterministic per 50 Hz tick)
  - `bootStart`, `bootFlavour`

  Impure part: `createBoot`, which draws on the TT-003 screen through `setBorderPainter` and applies the effects to audio.
- `src/ui/main.js` (boot wiring):
  - a `boot` mode that owns every key and tap
  - the click after a boot tap is swallowed, so the terminal never sees it
  - `startGame()`, `runBoot()`, and `showTitle()` for QUIT
  - F2 still works during the boot
  - new `__tallyman.bootPhase` and `bootKey` hooks
- `tests/unit/boot.test.js` (new): 18 tests covering the phases and timers, skip and PLAY transitions, title hold and debounce, catch-up ticks, the exact C64 and Spectrum text, reveal and attribute timing, and stripe coverage and colours.
- `docs/screenshots/tt014-*.png`: 21 files.
- `tickets/TT-014-boot-sequence/ticket.md`: status changed to `verify`.

## Decisions made
- **The boot waits at PRESS PLAY ON TAPE.**
  - Browsers only allow audio after a user gesture. If the boot ran on its own, the tape screech could never be heard.
  - So the authentic "press PLAY" step is the gesture. It unlocks audio, and the screech and title tune both play.
  - Every other key still skips. This differs from the ticket's literal "any key skips", but it is the only way a first-time visitor hears the tape.
- **Title hold.** If no gesture has happened yet (skipboot or reduced motion) and sound and music are on, the first key on the title only starts the tune and the second starts the game. Otherwise the title music would start and stop on the same key.
- **Title debounce.** Title keys within 350 ms are ignored, and auto-repeat is ignored throughout the boot. A held skip key cannot fly through the title.
- **Effects are deferred to the first frame.** QUIT runs inside a terminal mark, and the terminal still draws its rows later in that same frame. Without the deferral it overwrote the title art; the CDP check now guards this.
- **Sequential rows on the Spectrum.** The Spectrum's pixel-line interleave can't be reproduced in whole character cells, because the screen API only draws whole glyphs. The bitmap-then-attributes order is the recognisable part, and that is kept.
- **Title border is black** in all themes. The ending screen keeps TT-012's theme border.
- **Timing.** About 8.5 s plus the PLAY wait. Loading itself takes 3.6 s, close to the ticket's "~4 s".

## How verified
- `node --test tests/unit/boot.test.js` passes 18/18.
- **CDP run.** The script is `<scratchpad>/tt014-cdp.mjs`: real key and mouse events against `file://…/dist/tallyman.html`. It ends with **ALL PASS** and 0 console errors or exceptions. It covers:
  - the full sequence in c64 and spectrum: the boot waits at PLAY, the tape loop is `tape` while loading, then the title tune plays and the tape stops
  - a key starts the game: the intro types, the music stops, and the key does not leak into the input line
  - skipping during power-on, the skipboot two-key title, static, boot=off, a tap to skip, and QUIT back to the title (not overdrawn) and then into a new game
  - the wrong-man ending in both themes
  - 390 px at dpr 3, with no horizontal scroll
- **Screenshots viewed:**
  - C64: power-on, typing, the full search text, mid-tape with turbo bars and half the art, and the title.
  - Spectrum: copyright, `LOAD ""`, pilot with `Program: TALLYMAN`, the monochrome bitmap, the attributes flooding in, and the title.
  - Endings: C64 and Spectrum.
  - Other: QUIT back to the title, power-on at 390 px, and the intro after boot.
- `npm run check` tail:
```
lint:content src/content (strict): 0 error(s), 27 warning(s)
# tests 1774
# pass 1774
# fail 0
build: wrote dist/tallyman.html (652718 bytes)
```

## Known gaps / follow-ups
- **No © glyph.** font8x8 has none, so the Spectrum shows `(c) 1982`. A glyph could be added to `font8x8.js`, which is outside this ticket's allow-list.
- **No separate pilot tone.** The Spectrum pilot phase uses the same `tape` loop as the data; a steady pilot-tone SFX would be more faithful (TT-013).
- **Not listened to.** Nobody has listened to the boot audio; Nenad should check the levels.
- **TT-012's CDP scenario needs a parameter.** Its `play` scenario opens `?seed=1` without `boot=off` and now lands on the boot screen; it needs `&boot=off`. TT-023's smoke tests should use `boot=off` or `script=`, or drive `__tallyman.bootKey()`.

## Out-of-scope edits
None.
