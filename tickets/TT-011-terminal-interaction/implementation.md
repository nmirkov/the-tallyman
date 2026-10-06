# TT-011 implementation

## Summary
The text region of the 40×25 screen now behaves like an 8-bit adventure terminal.

**Output**
- Text is word-wrapped at 40 columns and types itself out at 400 chars/s.
- Any key fast-forwards the output.
- After a screenful of new text, a blinking `[MORE]` waits for a key.

**Input line**
- A `> ` prompt with a C64 block cursor blinking at 1.6 Hz.
- Full line editing, with horizontal scroll inside the 120-character line.
- ↑/↓ history of the last 50 commands.

**Scrollback and accessibility**
- PgUp/PgDn view the last 500 lines.
- A hidden `aria-live` transcript mirrors the output.

**Mobile**
- A hidden `<input>` is focused when the canvas is tapped.
- The canvas rescales when `visualViewport` changes.

The logic is a pure state machine with an injected clock, covered by 42 unit tests. The DOM/canvas adapter is a thin layer on top.

## Files changed
- `src/ui/wrap.js` (new) exports `wrapLine`, `wrapText` and `textWidth`. They count code points, so `£` is one column.
- `src/ui/terminal.js` (new) has three parts:
  - **Pure helpers:** `styleRole`, `regionFor`, `outputRows`, `needsMore`, `typeBudget`, `blinkOn`, `sanitiseInput`, `editInput`, `inputWindow` and `createHistory`.
  - **`createTerminalCore(opts)`:**
    - Output methods, played back in order: `print`, `clear`, `pause` and `mark`.
    - Input: `key`, `setInput` and `setInputEnabled`.
    - Clock: `tick(now)`.
    - Settings: `setGraphics`, `setRegion`, `setTypewriter`, `setReducedMotion` and `setRate`.
    - View: `compose(now)` (rows of `{ch, role, inverse}` cells) and `frameKey(now)`.
  - **`createTerminal(screen, opts)`** is the browser adapter. It handles keys, paste, the hidden input, the transcript, `visualViewport`, `prefers-reduced-motion` and the rAF loop. It returns `print`, `clear`, `pause`, `mark`, `setGraphics`, `setTypewriter`, `setRate`, `setInputEnabled`, `invalidate`, `focus`, `frame`, `whenIdle`, `destroy`, plus `core`, `field` and `transcript`.
- `tests/unit/terminal.test.js` (new): 42 tests covering:
  - wrap edge cases: exactly 40 columns, 41 columns, long words, multiple spaces, `£`, empty lines and `\r\n`
  - paging math, history and input editing
  - typewriter budget and blink math
  - core behaviour: typewriter, fast-forward, type-ahead, pause, mark, MORE, clear, regions, paragraph spacing, cursor, horizontal scroll, scrollback cap, the key hook and mobile `setInput`.
- `tools/terminal-test.html` (new): dev page with a status bar, a picture panel and the terminal.
  - Commands: `LOOK`, `LONG`, `STYLES`, `WRAP`, `PAUSE`, `CLEAR`, `GRAPHICS ON|OFF`, `TYPEWRITER ON|OFF`, `THEME …`, `HELP`; anything else is echoed back.
  - URL parameters: `theme`, `graphics=off`, `typewriter=off`, `rate`, `static=1` and `script=a|b`.
  - Exposes `__term`, `__screen`, `__keyLog` and `__rowText(y)` for CDP checks.
- `docs/screenshots/tt011-*` (9 PNGs).
- `tickets/TT-011-terminal-interaction/ticket.md`: `status: verify`.

## Decisions made
**Output ordering and paging**
- **Every output operation is queued** (text, `clear`, `pause` and `mark(fn)` callbacks) and played back by `tick()`. This keeps A9.2 O1 ordering with the typewriter running: TT-012 can put `sfx`, `picture` and `status` side effects in `mark()`, so they fire when the typed text reaches them. `whenIdle()` resolves when the input line is live again.
- **[MORE] rule.** When the number of lines shown since the last key press equals the number of output rows (13 with pictures, 23 without), the next line waits.
  - Continuing keeps the previous page's last line at the top as context.
  - The command echo counts as the first line, so a page always starts with `> COMMAND`.
  - The count restarts at each `clear`.
- **`[MORE]` sits on the input row**, in reverse video using the theme's `system` role. Plain `system` is black on the Spectrum theme, the same colour as body text, so it was invisible. Reverse video reads as an accent on all three themes (yellow block on C64, black block on Spectrum). `palette.js` has no `accent` role and was outside my allow-list.

**Keys**
- **Key precedence:**
  1. PgUp/PgDn scroll, and also work at `[MORE]` without continuing it.
  2. While scrolled back, any key returns to the bottom and does nothing else (view-only).
  3. `[MORE]` takes the key.
  4. While output plays, any key fast-forwards it, including pauses.
  5. Otherwise the key edits the line.
  - Modifier keys and Ctrl/Alt/Meta shortcuts are ignored, so the browser and F-keys keep them.
- **Type-ahead.** A printable key other than space that fast-forwards is also typed into the input, so fast players lose nothing. Space and Enter only skip, and Enter never submits while output is still playing.

**Look and layout**
- **Prompt `> `** on both the input row and the echo, both in the `echo` role. The line you type rises into the text unchanged, like the TT-003 mock-up. This leaves 38 visible input columns, with horizontal scroll up to 120 characters.
- **Cursor.** At the end of the line it is the font's block glyph in the `cursor` role. Over a character it shows that character in reverse video, as on a C64. Its blink restarts in the visible phase on each keystroke, so typing feels crisp.
- **Paragraph spacing.** A blank line goes before each command echo, and before a `title` line unless the title opens the region or follows a blank line or an echo. Engine `text` events are otherwise one paragraph each (A8.4), and an embedded `\n\n` keeps its blank line.
- **Wrapping.** Spaces at a wrap point and at the end of a line are dropped. Spaces inside a line and a paragraph's leading indent are kept. Only words longer than 40 characters are split.

**Settings and accessibility**
- **Reduced motion** (`prefers-reduced-motion`, followed live, or the `reducedMotion` option) gives instant text and a steady cursor and `[MORE]`. `pause` events are still honoured, because they are dramatic beats rather than motion. Typewriter OFF only makes text instant.
- **Upper case on C64** comes for free from the screen's `theme.upper`. The input is stored exactly as typed.

**Mobile and transcript**
- **Mobile input.** The core state is the source of truth.
  - Desktop `keydown` events go to the core and `preventDefault()` is called. The hidden field is then rewritten to match the core.
  - Soft-keyboard `keyCode 229` / IME events pass through, and the field's `input` event is fed to `core.setInput()`, which sanitises the text (smart quotes → ASCII) and clamps it to 120.
  - A tap on the canvas counts as "any key" for `[MORE]` and skipping, and focuses the field.
  - The field is fixed at the top-left with `font-size:16px`, `opacity:0`, `autocapitalize/autocomplete=off`, `spellcheck=false` and `enterkeyhint=send`.
- **Transcript.** A visually hidden `role=log`, `aria-live=polite` element gets one `<p>` per `print` (added when queued, not when typed, so screen readers are not delayed) and one per echoed command. It is capped at 400 nodes and is not cleared by `clear`.
- **Key SFX hook.** `onKey(kind)` receives `char`, `delete`, `move`, `enter`, `more` or `skip`, so TT-012 can choose a click per kind.

## How verified
- **Test-first.** The suite failed while the modules were missing. One history test then failed because it submitted twice without a frame in between; the second Enter was correctly treated as a skip. I fixed the test.
- **CDP interaction check.** The script is at `<scratchpad>/cdp-check.mjs`; it uses `node --experimental-websocket` with no dependencies and real `Input.dispatchKeyEvent` keys against `tools/terminal-test.html` on private port 8093. All checks passed:
  - the typewriter is rolling
  - a lone Shift does not skip
  - a key fast-forwards to `[MORE]`
  - `[MORE]` waits for 1.5 s with no change, and a key continues
  - the skip key is kept as type-ahead
  - typing `take stick` and Enter echoes the command with a blank line above and prints the host answer
  - ↑ recalls `take stick` and ↓ restores the empty draft
  - PgUp scrolls back 12 lines with the notice `[BACK 12] PGDN OR ANY KEY`, and any key returns to the identical bottom view
  - the transcript holds the echo and the alert line, and its last entry is the latest output
  - `Input.insertText('go north')` into the hidden field reaches the input line, and Backspace mirrors back to the field
  - field attributes are `off,off,false,16px`
  - the key hook fired at least 20 `char` events
  - no horizontal scroll, and zero console errors or exceptions.
- **Screenshots, viewed:**
  - `tt011-c64-more.png` (1800×1100): C64 blue screen with a white status bar and the mill picture. The intro has a white title, yellow system text and light-blue body text wrapped at word boundaries, and a reverse-video yellow `[MORE]` on the input row after exactly 13 lines.
  - `tt011-spectrum-more.png`: the same on white paper, with a blue title and black text. `[MORE]` is a black reverse block, clearly distinct from the text.
  - `tt011-c64-390-more.png` (390×844 at dpr 1): the full layout at scale 1, the `[MORE]` page and no horizontal scroll.
  - `tt011-spectrum-390-dpr3.png` (390×844 at dpr 3): a crisp scale-3 render after `look`, showing the blank line, the blue echo `> look`, the `Mill Yard` title, £2 and the block cursor.
  - `tt011-c64-gfxoff-styles.png`: GRAPHICS OFF, with the text using rows 1–24. It shows `CLEARED.`, the five styles (white title, light-blue normal, grey whisper, red alert, yellow system) and the wrap cases:
    - the 40-x line
    - 39 a's then `b` wrapped
    - a 76-character word hard-split
    - multiple spaces kept
    - `£2.00`
    - an embedded blank line.
  - `tt011-cdp-more.png`, `tt011-cdp-scrollback.png` (`[BACK 12]` notice) and `tt011-cdp-session.png` (white echoes, the `LOOK` result, the light-blue C64 block cursor).
- The private server on port 8093 was stopped afterwards; curl returns 000.
- `npm run check` tail:
```
# tests 1670
# suites 150
# pass 1670
# fail 0
build: wrote dist/tallyman.html (966 bytes)
```

## Known gaps / follow-ups
**For TT-012**
- Create the terminal with `createTerminal(screen, {graphics, typewriter, onSubmit, onKey})`.
- Map `text` to `term.print(text, style)`, `clear` to `term.clear()` and `pause` to `term.pause(ms)`.
- Wrap `sfx`, `picture`, `status`, `room` and `end` in `term.mark(() => …)` so they stay in order.
- Use `setGraphics(false)` for `picture null` and GRAPHICS OFF, and call `setInputEnabled(false)` while a file picker or ending screen is up.
- After `screen.setTheme()`, the terminal needs no call (colours resolve at render time).
- If TT-012 runs its own animation loop, pass `autoLoop:false` and call `term.frame(now)` before `screen.render()`.

**Other gaps**
- The `visualViewport` handler sets the container's height to `visualViewport.height` (default container: the canvas parent; pass `viewportContainer: null` to opt out). It is exercised only in desktop Chrome emulation, not on a real iOS or Android keyboard.
- The CDP check script lives in the scratchpad because `tools/` is outside my allow-list. TT-023 (release smoke) may want a permanent copy.
- Typed input is shown as entered (mixed case on the Spectrum and amber themes); only the C64 theme upper-cases it.

## Out-of-scope edits
None.
