---
id: TT-019
title: Art style gate: preview tool and 3 representative pictures
milestone: M3
status: in-progress
agent: artist
model: opus
depends: [TT-003, TT-015]
---
# TT-019 — Art style gate

## Goal
Establish the visual language of the location pictures before the full set is drawn (PLAN §3.5 style gate). The orchestrator approves or sends back.

## Scope
- `src/content/art/index.js` (art registry: `export const art = { [id]: artDef }`, merged from per-zone files) and per-zone files `src/content/art/<zone>.js`.
- Art format exactly per ARCHITECTURE.md A4.16 (40×9 location art; chars/colors arrays; optional `bg`, `fx`). Colour keys are C64 palette keys 0–f (see `src/ui/palette.js`). Note the Spectrum theme maps keys `c` and `f` to the same white as the paper: avoid relying on c/f as the *only* contrast against the background colour `bg` default.
- Three pictures from `docs/STORY.md`'s picture list, chosen to span the range: **an exterior with rain** (e.g. Platform or Market Square), **a dark interior** (e.g. Weaving Shed or Morgue — readable but oppressive), **a character/close-up scene** (e.g. Black Lamb bar with Maggie, or the Tally Stone).
- `tools/art-preview.js` → writes `docs/art-preview.html`: every picture rendered via the real `src/ui/screen.js` renderer and font (load modules via a small static server you start on a free port ≠ 8064 and stop afterwards, or bundle with esbuild into the HTML), C64 theme and Spectrum theme, at 2× and 4×, with the picture id and brief. Include an animated fx demo (rain/lightning/flicker/fog) if fx are defined — implement fx rendering as a pure function `src/ui/fx.js`: `applyFx(artDef, fxId, tick, rng) → cell overrides` (deterministic per tick), used by preview now and the game UI later.
- Screenshots `docs/screenshots/art-gate-*.png` (headless Chrome) — look at them critically; iterate until each picture reads clearly at a glance at 2×: strong silhouette, clear horizon, night palette with one warm accent.
- Unit test `tests/unit/art.test.js`: every art def has exact dimensions, only font glyphs (import the font module), valid colour keys, known fx ids; `applyFx` is deterministic.

## File allow-list
`src/content/art/*`, `src/ui/fx.js`, `tools/art-preview.js`, `docs/art-preview.html`, `docs/screenshots/art-gate-*`, `tests/unit/art.test.js`

## Acceptance criteria
- [ ] 3 pictures + preview page + screenshots; implementation.md describes the style rules you settled on (so TT-020/021 follow them).
- [ ] `npm run check` green.
