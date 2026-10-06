# TT-104 — Art polish: implementation

## Summary
I redrew all ten pictures on the orchestrator's list and replaced every one, because each redraw is clearly better than the old picture at 2× in both themes. Every picture keeps its id, size and fx, and follows the TT-019 style rules. Before and after screenshots are in `docs/screenshots/art-104-<id>-before.png` and `-after.png`. Each shot is the art-preview zoom view at 2×, C64 and Spectrum side by side, at tick 1.

| id | What was wrong | What the new picture does |
|---|---|---|
| `cells` | The bicycle stood inside a lit "cell" and read oddly. | Frontal corridor wall with two open cells, numbered 1 and 2. Each cell has a bunk (mattress, pillow), a bucket and a barred window lit by the street lamp. The steel doors are swung back against the wall, each with a hatch. The black police bicycle leans on the wall between them and is drawn on a 4 px grid, so every cell is an exact quadrant glyph. The four white strokes sit low on cell 2's wall. Mortar is `─┴` in light grey on mid grey: subtle on the C64, and it disappears on the Spectrum so the bike stays clean. |
| `number_13` | The tally strokes were small and pink-striped. The clock read as an envelope. | Four big white strokes (`╻┃┃┃╹`, five rows tall) on plain red wallpaper right of the hearth. A candle stub sits below them: flame, wax, a little glow. A black slate mantel clock with an arched case and a round white face, its `V` hands at ten past ten. Lace window, iron fireplace, and a dried-red stain on the rug. |
| `police_house` | Noisy dithered wall. The clock was a blob and the lamp was unclear. | Flat grey wall. A sash window with glazing bars (`┼─│`) and the blue lamp glowing through the glass. A big round wall clock at half past nine. A banker's lamp: green shade, lit underside, brass stem. The open occurrence book, three wanted posters on the cork board (portraits and text lines), and a panelled counter. No Pike. |
| `vestry` | The green "glow" was a dither cloud and the cassocks looked like doors. | Black cassocks and a white surplice on a hook rail, a lancet window, the burial register open big on the desk with written lines, a green banker's lamp, and the wine cupboard. |
| `crypt` | Flat boxes; the coffins read as benches. | Stone courses everywhere. The torch pool is lit in flat steps on the far wall, with the proud stone pale and shadowed. On the left, a coffin stands on end in a niche, with a cross on the lid. On the right, coffins lie on shelves, with handles. A broken chair stands against the light, and a lit wedge of flags runs up from below centre. |
| `entrance_hall` | The floor was too busy. | A true one-point perspective checker: big tiles in only grey and black, converted to quadrant glyphs. The windows have black reveals so they hold on the Spectrum. A bell sits on the hatch sill. Fog still works on the black tiles. |
| `boiler_room` | The rivets were too faint, and the boilers read as arches. | Seen from the aisle between the two boilers: banded red-brown shells converging into the dark. Rivet seams are heavy dashed `┇` lines in grey, yellow where the light falls. The round iron hatch lies in the torch pool on the floor. |
| `moor_road` | The car was too small. | The Cortina is now 18 cells long: blue, dark glass, red tail lamp, headlamp and a chrome strip. The driver's door hangs open on the lit interior. The front end drops one step into the ditch water. Road, town glow and fog are as before. |
| `ending_death` | Blocky light cone. | The beam is drawn as smooth-edged bands, converted to eighth and quadrant blocks: orange rim, yellow body, white core at the lens. It ends in a dim pool on the wall. The four white cut strokes have black shadows, so they read on the pool. A `░` fringe softens the beam. |
| `ending_victory` | The cars were tiny and did not read as police cars. | The front rank is three big white police cars with blue roof lamps, a red stripe and POLICE on the doors. The back rank is three dark cars with roof lamps, among the figures (three in helmets). The buildings, blue lamp, open door and four strokes are kept. |

## Files changed
- `src/content/art/town.js`: `police_house`, `cells`, `number_13`, `vestry`, `crypt`.
- `src/content/art/asylum.js`: `entrance_hall`.
- `src/content/art/mill.js`: `boiler_room`.
- `src/content/art/moor.js`: `moor_road`.
- `src/content/art/screens.js`: `ending_victory`, `ending_death`. The reserved rows 19–24 are still black and fx-inert.
- `docs/screenshots/art-104-<id>-before.png` and `art-104-<id>-after.png`: 20 files.
- `docs/art-preview.html`: regenerated.

I checked by script that the other 33 pictures in those files are byte-identical.

Out-of-scope edits: `tickets/TT-104-art-polish/ticket.md` `status:` changed to `verify`, as the orchestrator asked.

## Decisions made
- **Flat cell colour over pixel ramps.** My first crypt attempt used perspective and per-pixel `░▒` torch ramps, and it turned into glyph soup. Light that falls in flat steps per cell (stones are blocks), with thin box-drawing mortar, reads at once and matches the reference pictures.
- **Cell-level icons for small objects.** Clocks, lamps, posters, windows and strokes are placed by hand as cells, for example `▗▄▖/▐V▌/▝▀▘` for the clock and `▗▄▄▄▖/▀▀▀▀▀` for the lamp shade. The shape converter loses 1–2 px detail at this size.
- **The 4 px unit grid for the bicycle and the Cortina.** Every cell becomes an exact quadrant glyph. Thin-line fitting with box glyphs was tried for the bicycle and rejected because it was illegible.
- **Spectrum (rule 7).**
  - The vestry and police lamps rely on green against grey or white.
  - The cells mortar (`f` on `c`) vanishes on the Spectrum on purpose.
  - The entrance-hall windows got black reveals, because `e` on `6` is blue on blue.
  - The ending_death stroke shadows are black, not `9`, which would turn red on the Spectrum and could read as the fifth stroke.
  - The moor verge is a sparse `▒9` dither rather than solid `9`, which would be a solid red band.
- **Moonlight in `entrance_hall`.** It shows only in the window glass. Pale patches on the floor brought the busy look back, so I removed them.
- **`moor_road` tilt.** The car is level apart from a one-step nose drop. A stepped shear across the whole body broke the silhouette.
- **Helper scripts** stay in the scratchpad (`t104/`), as TT-019 rule 8 says. They are a converter plus hand cell overlays, and a splice script that replaces one entry per zone file.

## How verified
- I compared before and after at 2× in both themes for every picture, at 4× where the detail was unclear, and in situ on the full 40×25 screen (situ view). The screens were also checked with the UI text overlaid.
- How much each picture was redrawn:
  - 3–6 iterations: cells, number_13, police_house, crypt, entrance_hall, moor_road, ending_death.
  - 2–3 iterations: vestry, boiler_room, ending_victory.
- `node --test tests/unit/art.test.js`: 18/18 pass. This covers dimensions, glyphs, palette, no lowercase, fx ids, and the reserved rows being inert.
- `npm run check` tail:
```
lint:content src/content (strict): 0 error(s), 27 warning(s)
# tests 1846
# suites 163
# pass 1846
# fail 0
build: wrote dist/tallyman.html (661303 bytes)
```

## Known gaps / follow-ups
- In `number_13`, the clock face is squarish: 4 px quadrant rounding at 24 px. It reads as a mantel clock, not as round.
- In `moor_road`, the wheels are small black shapes on the dark verge; the car reads mainly by its body and the lit door.
- In `entrance_hall`, there are no moonlight shafts on the floor (see Decisions).
- `police_house` leaves out the kettle from the room text. There was no room for it once the clock, lamp and board were placed.
