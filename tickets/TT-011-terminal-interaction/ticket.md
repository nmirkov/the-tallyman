---
id: TT-011
title: Terminal interaction: wrap, typewriter, paging, input, history, scrollback, mobile input, transcript
milestone: M2
status: done
agent: ui-dev
model: opus
depends: [TT-003, TT-101]
---
# TT-011 — Terminal interaction

## Goal
The text region of the 40×25 screen behaves like a real 8-bit adventure terminal (PLAN §3.6, §3.7 accessibility; ARCHITECTURE A9 text styles, A10.3 settings). Pure logic separated from DOM so most of it is unit-testable in Node.

## Scope
- `src/ui/terminal.js` (pure core + thin DOM/canvas adapter): region config (rows 11–24 with pictures, 1–24 with GRAPHICS OFF; the status bar row 0 is TT-012's); word-wrap at 40 columns (never split words < 40 chars; hard-split longer); paragraph spacing; text styles → theme colour roles (`normal`, `title`, `alert`, `whisper`, `echo`, `system`); **typewriter** output (≈ 400 chars/s default, configurable; instant when `typewriter` setting off or `prefers-reduced-motion`; any key fast-forwards the current output); **[MORE]** paging when output exceeds the region since the last input (key continues; blinking `[MORE]` in theme accent); **input line** at the bottom: prompt `>`, block cursor blinking at ~1.6 Hz (C64 rate), insert/backspace/left/right/home/end, max length 120 with horizontal scroll within the line, upper-case display in C64 theme (input still case-insensitive); **history** ↑/↓ (last 50); **scrollback** PgUp/PgDn (last 500 lines, view-only; any key returns to bottom); `key` click SFX hook callback per keystroke (TT-012 wires audio).
- Mobile: hidden `<input>` (font-size 16px to avoid iOS zoom, `autocapitalize=off`, `autocomplete=off`, `spellcheck=false`) focused on tap anywhere on the canvas; its value mirrors the input line; Enter submits; on-screen keyboard must not break layout (canvas rescales on `visualViewport` resize).
- Accessibility: visually hidden DOM transcript (`aria-live="polite"`, `role="log"`) mirroring all output text and echoed commands.
- `src/ui/wrap.js` exported pure helpers. Unit tests `tests/unit/terminal.test.js`: wrap edge cases (exact 40, long words, multiple spaces, `£`, empty lines), paging math, history navigation, input editing ops, typewriter scheduler math (pure, injected clock).
- Dev page `tools/terminal-test.html`: feeds sample event batches (long text to trigger MORE, styles) and echoes input.

## File allow-list
`src/ui/terminal.js`, `src/ui/wrap.js`, `tools/terminal-test.html`, `tests/unit/terminal.test.js`, `docs/screenshots/tt011-*`

## Acceptance criteria
- [ ] Screenshots (1800×1100 and 390×844) of the test page with MORE visible, viewed; describe in implementation.md. Verify interaction in headless Chrome via `--remote-debugging-port` + `node --experimental-websocket` (no new deps) or a small Playwright-free CDP script: type a command, Enter, ↑ recalls it, PgUp scrolls, MORE waits for a key.
- [ ] `npm run check` green.
