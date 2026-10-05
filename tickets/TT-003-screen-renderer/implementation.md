# TT-003 implementation

## Summary
This ticket adds a 40×25 character screen that looks like a C64 or ZX Spectrum. It uses the public-domain font8x8 plus a hand-drawn `£` and a block cursor, three themes (c64, spectrum, amber), and an integer-scaled canvas renderer with a TV-style border. A dev page shows the PLAN §3.6 layout and a font + palette reference sheet. 26 unit tests cover the parts that need no DOM.

## Files changed
- `tools/fetch-font.js` (new): downloads the three dhepper headers and generates `src/ui/font8x8.js`. It exports `parseHeader` and `rowsToBytes`.
- `src/ui/font8x8.js` (new, generated, committed, 257 glyphs):
  - exports `font8x8` (`Map<codepoint, Uint8Array(8)>`), `glyphFor(ch)` (returns `?` for unknown characters), `hasGlyph(ch)`, `CURSOR` (U+E000) and `FALLBACK_CHAR`
  - carries the licence and attribution header.
- `src/ui/palette.js` (new):
  - palettes: `PEPTO`, `COLODORE`, `SPECTRUM {normal, bright}`
  - themes: `THEMES {c64, spectrum, amber}`
  - functions: `getTheme`, `resolveColor`, `packRGBA`.
- `src/ui/screen.js` (new):
  - `createScreen(canvas, {cols, rows, theme, border, container, autoResize})`. Its API is `put`, `print`, `fill`, `clearRegion`, `scrollUp`, `invert`, `get`, `setBorder`, `setBorderPainter`, `setTheme`, `render`, `resize`, `destroy`, plus `theme` and `layout` getters.
  - pure exports: `computeLayout`, `createCellBuffer`, `glyphPixels`, `SCREEN_COLS`, `SCREEN_ROWS`, `CELL`, `MIN_BORDER`.
- `tools/screen-test.html` (new): dev page with three query parameters.
  - `?theme=c64|spectrum|amber|both`
  - `&view=layout|glyphs`
  - `&static=1` turns off the cursor blink.
- `tests/unit/screen.test.js` (new): 26 tests covering the font, palette, layout math, cell buffer and glyph expansion.
- `docs/screenshots/` (new):
  - `tt003-c64.png`, `tt003-spectrum.png` (1800×1100)
  - `tt003-c64-390.png` (390×844 at dpr 1)
  - `tt003-c64-390-dpr3.png` (390×844 at dpr 3)
  - `tt003-both.png`, `tt003-glyphs.png`, `tt003-glyphs-spectrum.png`
- `tickets/TT-003-screen-renderer/ticket.md`: `status: verify`.

## Decisions made
- **Upstream font labels are wrong in places.** The comments in `font8x8_box.h` around U+2548–254B are mislabelled; for example, line 96 says `U+254B` but is array index 0x48, and U+2548 is missing from the labels. The generator therefore assigns code points by array position, counted from the header's declared base, and ignores the comments. A test checks that U+2500–259F are all present.
- **Font contents.** Only U+0020–007E, box drawing and blocks are kept; control characters are dropped. Each glyph is stored as a hex string (about 10 KB of source).
- **Colour keys are always C64 keys `0`–`f`.** Each theme maps those 16 keys to its own RGB values, so the same art works on every theme.
  - The Spectrum mapping is hand-picked. Greys become normal white, dark grey becomes blue (the way Spectrum artists used it), and orange and brown become yellow and red.
  - Amber colours are derived from each colour's luminance.
- **Roles and colour resolution.** Themes name their colours by role: `fg`, `bg`, `border`, `statusFg`, `statusBg`, `divider`, `cursor`, `title`, `alert`, `whisper`, `echo`, `system`, `dim`. Text styles from PLAN §3.4 map straight to roles.
  - Colours are worked out when the screen draws, not when text is written. `setTheme()` therefore recolours everything already on screen.
  - `null` means the theme default.
- **C64 palette.** The c64 theme uses Colodore. It is more accurate and gives better contrast than Pepto, which is still exported for reference.
- **Status bar colours.** I changed the status bars after looking at the first screenshots. In true reverse video the C64 bar (light blue) melted into the light-blue border, and the Spectrum bar (black) melted into the black picture panel. They are now white/blue on C64 and blue/bright-white on Spectrum.
- **Upper case on C64.** The `upper` flag (c64 theme only) turns a–z into A–Z at draw time. Caveat: lower-case letters used inside art will also appear in upper case on the c64 theme.
- **`put()` clears reverse video.** Writing a cell resets its reverse-video flag. `invert(x, y, on?)` is meant for temporary effects such as the cursor; lasting colours should use explicit fg/bg.
- **Integer scaling and border.**
  - The screen takes the largest integer scale that fits inside a minimum border of 16/18 source pixels per side (half a PAL C64's border). If the border does not fit, it shrinks first; only a window smaller than 320×200 device pixels gets a fractional scale.
  - All of this is in device pixels (`devicePixelRatio`), and the canvas fills its container with the border colour, like a TV.
  - I first used the full 32/36 border. A test showed it dropped 360 CSS px phones at 2× from scale 2 to scale 1 (160 CSS px wide), so I halved it.
- **Drawing pipeline.** Changed cells are written into an `ImageData` Uint32 view, using a glyph cache keyed by character and colour pair (cleared at 4096 entries). The result goes to the screen with one `putImageData` and one `drawImage` with `imageSmoothingEnabled = false`.
- **Extra hook for TT-014.** `setBorderPainter(fn)` lets the tape-loading screen paint striped borders. It is called on every render while set.

## How verified
- Tests first: the suite failed while the modules did not exist (1 file-level failure). The new phone-layout test also failed (2 failures) before the border change and passed after it.
- **Screenshots, viewed:**
  - `tt003-c64.png` reads as a C64: blue screen inside a light-blue border, the chunky upper-case C64 typeface style, a white status bar, a black PETSCII-style picture panel (mill, chimney, moon, rain made of `╱`, dithered `▓` cobbles), and a solid block cursor after `>`. `£2` renders with the custom glyph.
  - `tt003-spectrum.png` reads as a Spectrum: white paper and border, black mixed-case text, a blue status bar, and saturated primary colours in the picture.
  - The amber view was also checked.
  - `tt003-glyphs*.png` shows all 257 glyphs, the 16 palette swatches (framed so the background colour shows), reverse video, and unknown characters (`é…“`) drawn as `?`.
- **Crisp pixels:** the PNGs contain only 9–17 distinct colours, exactly the palette colours in use. Any smoothing would create in-between shades.
- **No horizontal scroll:** measured over the DevTools protocol, `scrollWidth == innerWidth` at every size tested.

  | Viewport | Scale |
  |---|---|
  | 390×844 @1× | 1 |
  | 390×844 @3× | 3 |
  | 360×640 @2× | 2 |
  | 1800×1100 | 4 |
  | 3840×2160 | 9 |

- I ran a private server instance on port 8091, not the default 8064, and stopped it afterwards (curl then returned 000).
- `npm run check` tail:
```
lint:content OK (stub)
# tests 35
# pass 35
# fail 0
build: wrote dist/tallyman.html (966 bytes)
```

## Known gaps / follow-ups
- `src/ui/main.js` and `src/index.html` are not in my allow-list, so the game page still shows the TT-001 placeholder. Wiring the screen into the game is TT-012.
- At a 390 CSS px phone width with dpr 1, scale 1 means 8-px characters. That is correct for 40 columns, but small; real phones (dpr 2–3) get 2–3×.
- On the Spectrum theme, keys `c` and `f` resolve to the paper colour, so they disappear on white paper. Art should not rely on them as ink over the paper.
- The tape-stripe border, nerve-driven border pulse and flashing text are not built here. The hooks are in place (`setBorder`, `setBorderPainter`) for TT-012 and TT-014.

## Out-of-scope edits
None.
