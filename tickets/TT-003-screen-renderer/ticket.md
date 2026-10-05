---
id: TT-003
title: Build the 40x25 canvas character screen with font8x8 and C64/Spectrum palettes
milestone: M0
status: todo
agent: ui-dev
model: opus
depends: [TT-001]
---
# TT-003 — Screen renderer

## Goal
The visual foundation (PLAN §1, §3.6): a canvas that renders a 40×25 grid of 8×8 character cells exactly like a C64/Spectrum, scaled crisply to any window.

## Scope
- `tools/fetch-font.js` (dev tool, run once): download public-domain font8x8 (github.com/dhepper/font8x8: `font8x8_basic.h`, `font8x8_block.h`, `font8x8_box.h`) and generate `src/ui/font8x8.js` (export a Map-like object codepoint → 8 bytes; include the licence/attribution comment). Add a hand-drawn **£** glyph (U+00A3) and a solid cursor glyph. Commit the generated file (the build must not need network).
- `src/ui/palette.js`: C64 16-colour palette (Pepto/Colodore values), ZX Spectrum palette (normal + bright), theme definitions `c64` (border light-blue `e`, background blue `6`, text light-blue `e`, upper-case) and `spectrum` (white border/paper, black ink, mixed case) and `amber` bonus.
- `src/ui/screen.js`: `createScreen(canvas, {cols:40, rows:25, theme})` → API: `put(x,y,ch,fg,bg)`, `print(x,y,text,fg,bg)`, `fill(rect,ch,fg,bg)`, `scrollUp(rowStart,rowEnd)`, `clearRegion`, `setBorder(colorKey)`, `setTheme`, `invert(x,y)`, `render()` (dirty-cell rendering into an offscreen 320×200 bitmap, glyph cache per fg/bg), `resize()` (largest integer scale that fits the window minus border; border area drawn in border colour around it like a real TV; `imageSmoothingEnabled=false`). Unknown glyphs render as `?`.
- `tools/screen-test.html` (dev page, served by `npm start`): draws all glyphs, all 16 colours, a sample status bar + picture panel + text region per PLAN §3.6, both themes side by side via query param.
- Unit tests for the pure parts (font lookup, palette, layout math: scale for given window size) in `tests/unit/screen.test.js` (no DOM).

## File allow-list
`tools/fetch-font.js`, `src/ui/font8x8.js`, `src/ui/palette.js`, `src/ui/screen.js`, `tools/screen-test.html`, `tests/unit/screen.test.js`, `docs/screenshots/*`

## Acceptance criteria
- [ ] Reference screenshots `docs/screenshots/tt003-c64.png` and `tt003-spectrum.png` at 1800×1100 and one at 390×844, viewed by you and described in implementation.md (does it read as a C64 / Spectrum?).
- [ ] Pixels crisp (integer scale), no blurring, no horizontal scroll at 390 px.
- [ ] `npm run check` green.
