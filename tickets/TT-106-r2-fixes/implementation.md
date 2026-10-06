# TT-106 — R2 fixes: implementation

## Summary
Both blocking issues from `reviews/code-review-R2-1.md` are fixed. I reproduced each one first in headless Chrome against `dist/tallyman.html`; both reproduced as the review describes. Each fix has a pure regression test.

Of the 12 non-blocking notes:
- 9 are fixed: notes 1–8 and 10.
- Note 9 is half fixed: the dead code is gone and `screen.scrollUp` is kept.
- Note 11 is accepted: the reviewer already judged it fine.
- Note 12 (tests) is done.

## Finding → fix / accepted

| # | Finding | Resolution |
|---|---|---|
| B1 | After QUIT → title → new game, the typewriter is skipped | **Fixed** in two places. The terminal core now clamps each step to `MAX_TICK_MS = 100`, which also covers background tabs. The new `core.resetClock()` is called from `startGame()`. In Chrome, 60 ms after the title key: before the fix 13 lines and `[MORE]`; after it 1 line, the same as a fresh page. |
| B2 | On a title reached without a gesture (skipboot, `boot=title`, reduced motion), the first key does nothing | **Fixed.** The `holdForMusic` hold is removed, so one key on the title always starts the game, and the start bundle's `music stop` cuts the tune. The full boot still lets the tune play, because the PRESS PLAY key unlocks audio. The 350 ms title debounce stays. The now-unused `music` and `gestured` options are removed from `boot.js` and `main.js`. |
| 1 | A key held through the ending text continues, and its repeats are typed into the prompt | **Fixed.** The new pure helper `isAnyKeyPress(e)` rejects repeats, lone modifiers, shortcuts and F-keys; it is used in `endWait` and in the boot. Repeats of the key that continued (or left the title) are dropped until keyup. `showEnding` now calls `term.clearInput()`, because the "xxx" also came from type-ahead entered while the ending text played. |
| 2 | The ending region is cramped: the stock refusal needs `[MORE]` | **Fixed.** `setRegion({…, echoPages:false})` keeps the command echo out of the `[MORE]` count on the ending region. A two-line answer now fits and the echo scrolls off. `setGraphics` restores the default. |
| 3 | `picture id:null` hides the panel | **Fixed.** The new pure `panelFor(ev, art)` follows A9.1: `graphics:false` hides the panel; a null id or missing art gives a blank panel with the divider, so the layout no longer jumps. |
| 4 | Nothing enforces that ending-art fx stay off rows 19–24 | **Fixed** with a new L11 lint rule. For every ending art with fx, no cell in rows 19–24 may be changeable by those fx. It uses the new `fxMayChange(fxId, cell)` in `fx.js`, which mirrors each effect's own cell test. A test checks it is sound: every override in 200 ticks of every real fx art lands on a predicted cell. The real content passes. |
| 5 | F2 during the boot queues an ack that only reaches the transcript | **Fixed.** `dispatcher.setting(key, value, {ack})` accepts `ack:false`, which F2 passes in boot mode. The setting is still persisted and applied. |
| 6 | The ending border is the theme colour | **Fixed.** It is now black (`'0'`) in `end` mode, matching the title. |
| 7 | AltGr characters are dropped | **Fixed.** The new `keyMods(e)` treats AltGraph, or Ctrl+Alt with a non-alphanumeric character, as text. Ctrl+Alt+letter stays a shortcut. |
| 8 | `transcriptLine` bypasses the 400-entry cap | **Fixed.** The adapter's new `term.transcribe(text, style)` is used instead. |
| 9 | Dead code | The `doc.body.style.background` line is **removed**. `screen.scrollUp` is **accepted and kept**: it is part of the tested TT-003 screen-buffer API, and `screen.js` is not this ticket's concern. |
| 10 | IMPORT gesture comment | **Added** above `importSave` in `dispatch.js`. |
| 11 | `pickFile` focus fallback | **Accepted** with no change; the reviewer reasoned it through and found it OK. |
| 12 | Test gaps | **Done:** a clock-gap test and a `resetClock` test in `terminal.test.js`; the boot tests now assert one-key start (the hold assertions are gone); the new `review-r2.test.js` has 8 tests. |

## Files changed
- `src/ui/terminal.js`
  - New exports: `MAX_TICK_MS` and the pure helpers `keyMods` and `isAnyKeyPress`.
  - New core methods: `resetClock` and `clearInput`; the region gains an `echoPages` option.
  - New adapter methods: `transcribe` and `clearInput`.
- `src/ui/boot.js`: the title hold is removed.
- `src/ui/main.js`: `resetClock` in `startGame`, `panelFor`, `isAnyKeyPress` and `heldKey`, the ending `clearInput`, the black ending border, `transcribe`, F2 without ack in the boot, and dead code removed.
- `src/ui/dispatch.js`: the `setting` ack option and the IMPORT comment.
- `src/ui/picture.js`: `panelFor`.
- `src/ui/fx.js`: `fxMayChange`.
- `tools/lint-content.js`: the L11 rule for ending-art fx against the reserved rows.
- Tests: `tests/unit/terminal.test.js` (+2), `tests/unit/boot.test.js` (updated), `tests/unit/review-r2.test.js` (new).
- Screenshots: `docs/screenshots/tt106-intro-after-quit.png`, `tt106-intro-after-quit-390.png`, `tt106-ending-look.png` and `tt106-picture-null-blank.png`.

## How verified
- **Test-first.** The new terminal and boot tests failed first: a missing export, then the hold. They pass after the fixes.
- **CDP scripts.** Headless Chrome on port 9406, stopped by PID. The scripts are `<scratchpad>/tt106/repro.mjs` and `notes.mjs`. Both report ALL PASS with 0 console messages. They cover:
  - B1 and B2 (skipboot, and reduced motion via emulated media)
  - the full boot: PLAY, tape, title, one key, then the intro types
  - notes 1, 2, 3, 5, 6, 7 and 8
  - a held Enter on the title, which does not fast-forward the intro
  - 1800 px and 390 px, with no horizontal scroll
- **Screenshots viewed:**
  - the intro typing mid-paragraph after QUIT at 390 px
  - the black-framed ending screen with the two-line refusal and no `[MORE]`
  - a blank panel with the divider for `picture null`
- `npm run check` tail:
```
lint:content src/content (strict): 0 error(s), 27 warning(s)
# tests 1846
# pass 1846
# fail 0
build: wrote dist/tallyman.html (661303 bytes)
```

## Known gaps / follow-ups
- Reduced-motion and skipboot players never hear the title tune; this is accepted for the one-key start.
- The `getModifierState('AltGraph')` path is unit-tested only. CDP cannot set AltGraph, so only the Ctrl+Alt fallback was driven in Chrome.

## Out-of-scope edits
None. The lint change is limited to the fx/reserved-row rule.
