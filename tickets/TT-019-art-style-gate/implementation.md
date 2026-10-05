# TT-019 — Art style gate: implementation

## Summary
Three gate pictures, an fx renderer, a preview tool and screenshots are ready for approval:
- `market_square`: outside, rain. Warm pub on the left, a grey market cross in the middle, a red phone box, and a cold Police House on the right. fx `rain`.
- `weaving_shed`: dark interior, torchlit. Sawtooth roof lights, rows of loom frames, a pool of torchlight and the pale girl at its edge. fx `flicker`.
- `black_lamb`: warm interior with figures. A fire, three hunched regulars, and Maggie behind the THWAITES bar. No fx.

I chose `market_square` and `weaving_shed` from the ticket's own suggestions. STORY §14.2 suggests `counting_house` and `tunnel` instead, but those two did not exist as rooms yet, and the ticket takes priority.

## Files changed
- `src/content/art/index.js`: the registry. `mergeArt()` throws on a duplicate id. Exports `export const art` and a default export, which `src/content/index.js` already loads.
- `src/content/art/town.js` (`townArt`: market_square, black_lamb) and `src/content/art/mill.js` (`millArt`: weaving_shed). Both are static data: rows of 40 characters for `chars`, `colors` and `bg`.
- `src/ui/fx.js`: pure effect functions.
  - `applyFx(art, fxId, tick, rng)` returns the changed cells as full cell values `{x, y, ch, fg, bg}`, in row order.
  - `applyAllFx(art, tick, rng, fxIds = art.fx)` layers effects in the order lightning, rain, fog, flicker.
  - Also exports `cellAt`, `hash01`, `FX_ORDER` and `RAIN_GLYPH`.
  - `rng` is either an integer seed or a pure hash function. It is never a stateful generator, so every frame depends only on the tick.
  - An unknown fx id throws `RangeError`.
- `tools/art-preview.js` writes `docs/art-preview.html`, a single self-contained page bundled with esbuild that opens from file://.
  - It renders every picture with the real `screen.js`, font and palettes: C64 and Spectrum, at 2× and 4×, animated, with the brief taken from STORY.md.
  - It also shows each picture on a full 40×25 game screen with the room text, and an fx lab with all four effects.
  - `--screenshots` drives headless Chrome to produce the files below.
- `docs/art-preview.html`
- `docs/screenshots/`:
  - `art-gate-c64.png` and `art-gate-spectrum.png`: all pictures at 2×.
  - `art-gate-<id>.png`: one picture at 4×, both themes.
  - `art-gate-situ-c64.png` and `art-gate-situ-spectrum.png`: the full game screen.
  - `art-gate-fx.png`: frames of each effect.
- `tests/unit/art.test.js`: 16 tests.

Out-of-scope edits: none.

## Style rules (TT-020 and TT-021 must follow these)
1. **Composition first.** Each picture has one clear subject and a readable horizon or floor line. Big shapes are blocked out on whole cells. Test at **2×**, the size players see: if it does not read at 2×, simplify it.
2. **Two colours per cell.** Every cell has ink (`colors`) and paper (`bg`), and nothing else. Line up the edges of objects with the cell grid, half cells or quarter cells (4 px). Always include a per-cell `bg` array; art with no `bg` means black paper.
3. **Glyph roles.**
   | Glyphs | Use |
   |---|---|
   | `█` and `' '` | Solid areas |
   | `▀▄▌▐` and quarter blocks `▖▗▘▝▙▛▜▟▚▞` | Shapes at 4 px resolution |
   | Eighth blocks `▁▂▃▅▆▇▔▏▕` | Slopes and thin ledges (e.g. the sawtooth roof) |
   | `░▒▓` | Texture and light: brick and stone are `▓`, haze and glow `░`, wet cobbles `▒`, a light ramp `░ → ▒ → solid` |
   | Box drawing `│ ─ ┼ ═ ║ ┴ ╵ ╎` | 1 px detail: lamp posts, glazing bars (`┼`, ink = frame, paper = glass), blinds (`═`), warp threads (`║`), brackets, rain threads (`╎`) |
   | Capital letters | Signs and lettering: BLACK LAMB, POLICE, THWAITES. Never lowercase: the C64 theme shows capitals anyway, and a test enforces it. `O` serves as a horse brass. |
4. **Air means space.** An open-air cell is `' '` with paper colour. A solid surface is `█` with ink colour. The effects depend on this:
   - Lightning lights only the `' '` cells connected to the top edge, plus the edge glyphs next to them.
   - Rain falls over `' '` and `█` cells only.
   - Fog fills dark `' '` and `█` cells.
   - Never draw a solid black object with `' '`.
5. **Night palette.** Outside and in dark rooms:
   - Black sky, dark-blue `6` in the distance, greys `b`, `c` and `f` for stone, and one warm accent: yellow `7` or orange `8` (lit windows, sodium lamps).
   - Cold accents such as the blue lamp (`e`) are fine.
   - Torchlight runs `░b → b → ▒c/b → c → f → 7`.
   - Refuges (pub, lock cottage) may be warm throughout (browns `9`/`8`, fire in `7`/`a`/`2`), with black figures rim-lit in `8`.
6. **Figures are small and iconic.** Head about half the width of the shoulders, with a bell or hunched body (Maggie, the girl, the regulars). A figure needs a contrasting backdrop, such as black on a brown wall or pale on dark.
7. **Spectrum check.** That theme merges `b`/`6` (both blue) and `c`/`f` (both white), turns `9` into red and `8` into yellow. Never rely on `b` against `6` or `c` against `f` as the only edge. Look at `art-gate-spectrum.png` before handing art in.
8. **Workflow that worked** (the helper scripts stay in the scratchpad, not the repo):
   1. Draw large shapes as pixels on a 320×72 canvas, then let a tool pick the best block glyph and colour pair for each cell.
   2. Draw all detail by hand as cell overlays.
   3. Emit static strings.
   4. Look at the result at 2× and 4×, in both themes and on the full game screen; redraw and repeat.

   Hand-typing the strings directly also works. Keep each row exactly 40 code points.

## Decisions
- **Effects only change cells and never move shapes.** That keeps them cheap with the screen's dirty-cell tracking, and the same function serves the game and the preview.
- **Rain** is `╱` in light blue `e`, moving one row down and one column left per tick, at about 120 drops across a 13-row cycle.
- **Lightning** flashes once in each 90-tick cycle, at a position drawn from the seed, for three frames: white `1`, then grey `f`, then grey `c`. Black doors and windows inside buildings stay dark because the flash only spreads from the top edge.
- **Flicker** dims the light colours by one step (60% of ticks unchanged, 32% one step, 8% two steps), so in the shed the girl fades and returns.
- **The preview is one bundled file** and needs no server, so no port was used. Static screenshots are taken at a tick where no flicker or lightning is active, so they show the base art.

## How verified
- Every picture was redrawn and re-screenshotted several times: market square 6 times, weaving shed 9 times (the cone of light became a pool of light, and the girl went through four designs), black lamb 3 times. Each time I checked at 2× and 4× in both themes and on the full screen.
- `node --test tests/unit/art.test.js` passes 16 of 16. The tests check:
  - exact dimensions (counted in code points), font glyphs, palette keys, the shape of `bg`, fx ids, no lowercase letters, duplicate ids;
  - that the effects are deterministic, stay in bounds and are sorted;
  - how each effect behaves;
  - that unknown ids throw.
- `npm run lint:content`: 0 errors. Rule L11 checks my art, and the only warnings left are L12 (pictures not drawn yet) and L21.
- `npm run build`: OK.
- `npm run check` tail:
```
# tests 1096
# suites 80
# pass 1094
# fail 2
```
  The two failures are both in `tests/content/town-canal.test.js` ("Town has 18 rooms, Canal 5; ... 19 stubs" and "moving into a stub room"). They come from the parallel content work, which just added `zones/mill.js`, `moor.js` and `asylum.js`, so fewer rooms are stubs. They are not caused by the art. Because `check` stops at the first failing step, I ran the build on its own as well.

## Known gaps / follow-ups
- 39 location pictures, `dark`, and the 40×25 title and ending screens are still to draw (TT-020/021).
- `src/ui/picture.js` (the game panel) should call `applyAllFx` at about 10 ticks per second.
- The three regulars in `black_lamb` read as hunched figures but look alike; give them more varied poses if the orchestrator wants that.
- Fog is subtle on pictures that have few dark open or solid cells. It is meant for `tally_stone`, `churchyard` and `towpath`.
