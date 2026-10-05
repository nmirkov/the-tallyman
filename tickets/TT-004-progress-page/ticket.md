---
id: TT-004
title: Generate docs/progress.html from plan, tickets and git history
milestone: M0
status: done
agent: engine-dev
model: sonnet
depends: [TT-001]
---
# TT-004 — Progress page generator

## Goal
Nenad follows the build through `docs/progress.html` (PLAN §6.4). `npm run progress` regenerates it from source data; the orchestrator runs it before every commit.

## Scope
`tools/progress.js` (zero-dep Node) reads: ticket front-matter from `tickets/*/ticket.md` (id, title, milestone, status, agent, model, depends, severity); `docs/STATUS.md` (rendered as-is, simple markdown → HTML: headings, tables, lists, bold, code); `docs/REVIEWS.md` (same); `docs/PLAN.md` §1 pillars table and §5 milestones; `git log --pretty` (last 60 commits: hash, date, subject) and `git tag`; screenshots in `docs/screenshots/*.png` (thumbnails linking to full size, relative paths).
Also writes `tickets/BOARD.md` (markdown table of all tickets grouped by milestone with status).
Writes a single self-contained `docs/progress.html`:
- Header: game title in a C64-style banner (blue border look, monospace pixel feel via CSS only — no external fonts), last-updated timestamp, overall % done (done tickets / all tickets), current phase from STATUS.md.
- Milestone progress bars (M0–M4 + BUG), each with ticket counts by status.
- Ticket board: columns todo / in-progress / verify / done / blocked; cards show id, title, agent, model, deps.
- Sections: Status, Plan summary (pillars), Reviews, Commit timeline, Screenshots gallery.
- Layout per Nenad's HTML rules: **full browser width** (no narrow centred column; padding `32px clamp(16px, 3vw, 48px)`), cards in `auto-fit` grids, tables `width:100%`, works at 390 px with no horizontal page scroll; light & dark via `prefers-color-scheme`; colours as CSS custom properties on `:root`.
- Unit test `tests/unit/progress.test.js` for the front-matter parser and the mini markdown renderer (tables, lists, escaping).

## File allow-list
`tools/progress.js`, `tests/unit/progress.test.js`, `docs/progress.html`, `tickets/BOARD.md`, `docs/screenshots/progress-*.png`

## Acceptance criteria
- [ ] `npm run progress` writes docs/progress.html with the current tickets (TT-001…TT-004 exist at least).
- [ ] Screenshots at 1800 px and 390 px wide (`google-chrome --headless=new --screenshot`) viewed and look clean (save as `docs/screenshots/progress-desktop.png` / `progress-mobile.png`).
- [ ] HTML-escapes all ticket text.
- [ ] `npm run check` green.
