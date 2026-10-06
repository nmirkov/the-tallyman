# TT-021 — Art: screens: implementation

## Summary
I drew all seven 40×25 screen pictures from STORY §14.2 in `src/content/art/screens.js`. The preview tool now renders 40×25 screens with the UI's own text printed over the reserved rows.

| id | What it shows | fx |
|---|---|---|
| `title` | Chunky block logo "THE / TALLYMAN" in a white → light grey → grey gradient with a black drop shadow. Below it: a rain-blue sky under a black storm-cloud bank, and a black mill silhouette with a sawtooth weaving shed, a tall chimney, a spinning block with a grid of grey windows and one lit window, and a water tower. On the right, a rim-lit standing stone with four chisel-cut white strokes and the red fifth across them. A grey fog band runs along the bottom, then the credit line "BLACKMERE - NOVEMBER 1984". | rain, lightning |
| `ending_victory` | Market Square under a dawn sky that runs from blue to grey. St Jude's tower, a terrace and the Police House, every window lit, the door open and spilling light, with the blue lamp above it. Six car silhouettes with light-blue roof lamps, two ranks deep on the wet grey square. Six small figures, three of them in helmets. Four white strokes beside the door, with no fifth. | fog |
| `ending_pyrrhic` | The Counting Room's brick wall, muted grey, fading to black at the sides. Four white strokes, and below them two rings with chains hanging empty, the cuffs open. A black figure kneels upright at the right edge, cuffed, head lifted. | none |
| `ending_got_away` | The moor at night: black sky with a blue band at the horizon, a black far ridge, and grey near ground with fog lying in the hollows. The tally stone has a lit face with four old strokes cut into it. At its foot is a folded cape (two layers) with four pale stones laid in a row on top. | fog |
| `ending_fifth` | Four huge cut white strokes with grey cut-shadows, and a tapering red fifth stroke across them, on a faint brick wall that fades into black. Flicker dims the white strokes but not the red one, so the red stroke stays steady. | flicker |
| `ending_wrong` | A rainy platform. On the left, a BLACKMERE nameboard. A gas lamp with its pool of light on the wet platform. Under it, a tall constable in helmet and cape waves the train off. The white platform edge runs away to the right, beside the rails and the last carriage, which shows two red tail lamps. | rain |
| `ending_death` | Black. A fallen torch lies at the bottom left. Its yellow cone of light spreads across the floor and up the wall onto four white strokes. | flicker |

## Reserved rows (the UI draws over these)
- **`title`: row 24** is left for "PRESS ANY KEY". The credit line sits on row 22, and row 23 is black so the two lines don't crowd each other.
- **Endings: rows 19–24** are left for the ending title and the score. Every ending's picture ends at row 18.
- How reserved cells are filled:
  - Every reserved cell is `'▓'` with ink and paper both `'0'`.
  - That renders as plain black, but no effect ever changes it. Rain and fog only touch `' '` and `'█'` cells, lightning only touches air and edge glyphs, and flicker only touches light colours.
  - So an animation frame can never paint over the UI's text.
  - The art header comment states this, and a unit test enforces it: the reserved rows are black, and `applyAllFx` never touches them across 300 ticks.

## Files changed
- `src/content/art/screens.js`: the seven pictures, as static strings.
- `tools/art-preview.js`:
  - New `view=screens` and `view=screenfx`.
  - The `zoom` view now handles 40×25 (`scale` param).
  - Screen-art cards on the main page, with the §14.2 brief (from `parseScreenBriefs`, which is exported).
  - The UI text is printed over the reserved rows in plain palette keys, so it reads in both themes.
  - New flag `--screenshots=screens`, which renders only the `art-021-*` set.
  - Gallery, situ, zoom and gate shots now filter to 9-row pictures, so the TT-019 shots are unchanged.
- `docs/art-preview.html`: regenerated.
- `docs/screenshots/`:
  - `art-021-screens-c64.png` and `art-021-screens-spectrum.png`: all seven at 2×, with the overlay.
  - `art-021-<id>.png`: each picture at 2×, both themes.
  - `art-021-title-4x.png`
  - `art-021-fx.png`: frames of each effect, including the lightning flash on the title.
- `tests/unit/art.test.js`: two new screen-art tests (the seven screens exist at 40×25 with their briefed fx, and the reserved rows are black and fx-inert). This file was allowed because it had no screen-art checks.

Out-of-scope edits: none.

## Decisions made
- **Rain falls behind the logo and the strokes.** Solid light cells in front of the rain (logo, title strokes) use `'▀'` with ink = paper instead of `'█'`, so rain falls behind them.
  - This is a deliberate, documented exception to style rule 4.
  - Lightning still floods the sky. The storm-cloud bank is solid black (`'█'` ink 0) with gaps at row 0. The flood reaches the sky through those gaps and around the logo, so the mill and the clouds stand black against the white flash.
  - I lowered the water tower so the flood could reach the sky pocket between the chimney and the tower.
- **Cell-level checker dithers between flat colours are not used.** They read as crenellations. Gradients are flat bands joined by `░▒▓` ramp rows (`skyRamp`).
- **Light pools in the endings are cell-level `░▒▓` in yellow `7`.** I tried filling the edge cells with solid colours (`9`/`8`/`7`) instead. It looked blocky, and turned red on the Spectrum, so I dropped it. Figures stand against flat colour instead: the blue horizon glow, the grey square, the brick wall.
- **Spectrum check (rule 7):**
  - In `ending_got_away`, the near ground (`b`) and the sky glow (`6`) are separated by a black ridge.
  - The cape is black, and its stones are `c`.
  - The car lamps sit on black paper.
- **Car lamps and the Spectrum.** Spectrum `e` is a dark bright-blue, so the car lamps are dim there but still visible. I kept `e` because the brief asks for light blue.
- **The fifth stroke is C64 red `2`.** It is darker than the white, but it is the canonical red, and on the Spectrum it is a vivid red.
- **Workflow (as in TT-019, helper scripts in the scratchpad):**
  - I drew shapes on a 320×200 pixel canvas and let a converter choose the best block glyph and colour pair for each cell.
  - I added detail by hand: lettering, lamps, chains (`O`/`┃`/`U`), rails (`╱`), strokes (`┃`, `║`), mortar (`▁▕`).
  - I emitted static strings.
- **How much each picture was redrawn:**
  - Title: 9 times.
  - `ending_victory`: 6 times (white cars became black silhouettes with see-through windows).
  - `ending_wrong`: 6 times (the figure finally stood against the blue glow and was scaled ×1.3 so the helmet dome reads).
  - `ending_pyrrhic`: 3 times.
  - `ending_got_away`: 3 times (the pebbles first looked like teeth).
  - `ending_death`: 3 times.
  - `ending_fifth`: 2 times.

## How verified
- I looked at every picture at 2× in the C64 and Spectrum themes, and the title also at 4×, both through my scratch renderer and through the real `screen.js` in `art-preview` screenshots, with the UI text overlaid. I also checked the fx frames (`art-021-fx.png`): rain, the lightning flash, fog drifting, flicker.
- `node --test tests/unit/art.test.js`: 18/18 pass.
- `npm run check` tail:
```
lint:content src/content (strict): 0 error(s), 27 warning(s)
# tests 1633
# pass 1633
# fail 0
build: wrote dist/tallyman.html (966 bytes)
```

## Known gaps / follow-ups
- Weakest pieces:
  - In `ending_death`, the light cone is cell-blocky.
  - In `ending_victory`, the cars are small silhouettes; they read as cars at 2× but not as police cars until their lamps are noticed.
- The UI needs to:
  - print over the reserved rows itself (on black paper);
  - run `applyAllFx` on screen art at about 10 ticks per second.
- The title's static screenshot shows rain because the screenshot tick is chosen only to avoid flicker and lightning.
