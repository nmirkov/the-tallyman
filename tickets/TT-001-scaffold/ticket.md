---
id: TT-001
title: Scaffold project with working check pipeline and minimal single-file build
milestone: M0
status: todo
agent: engine-dev
model: sonnet
depends: []
---
# TT-001 — Scaffold

## Goal
Create the project skeleton so that `npm run check` works from day one (PLAN §4, §3.1–3.2): tests run, a stub content linter runs, and a minimal **single-file offline build** produces `dist/tallyman.html` that shows a placeholder C64-blue screen with "THE TALLYMAN — LOADING…".

## Scope
- In: `package.json` (`"type":"module"`, `"engines": {"node": ">=20"}`), scripts: `test` (`node --test` over `tests/**/*.test.js`), `lint:content` (`node tools/lint-content.js`), `build` (`node tools/build.js`), `check` (lint:content && test && build), `start` (`node tools/serve.js`, port 8064), `play` (`node tools/play.js` — stub printing "not yet implemented"), `progress` (`node tools/progress.js` — stub). Dev dependency: `esbuild` (pin exact version). `tools/build.js`: bundle `src/ui/main.js` with esbuild (iife, minify in release mode via `--release` flag, sourcemap off) and inline the JS into `src/index.html` template → `dist/tallyman.html`; no external requests. `tools/serve.js`: zero-dep static server serving repo root (so `/src/index.html` works unbundled with ES modules for dev) and `/dist`. `src/index.html` (dev template: loads `./ui/main.js` as a module; build replaces the script tag with inline bundle). `src/ui/main.js` placeholder drawing on a canvas. `src/engine/.gitkeep`, `src/content/index.js` exporting an empty content bundle `{ rooms: {}, items: {}, npcs: {} }`. `tools/lint-content.js` stub: imports the content bundle, validates it is an object with those keys, exits 0/1; supports `--strict` flag (no-op for now). One smoke unit test `tests/unit/scaffold.test.js` (content bundle shape) and `tests/build.test.js` asserting `dist/tallyman.html` exists after build is NOT required (build runs after test). README.md stub (title, `npm install`, `npm start`, `npm run check`).
- Out: real engine, real renderer.

## File allow-list
`package.json`, `package-lock.json`, `tools/build.js`, `tools/serve.js`, `tools/play.js`, `tools/progress.js`, `tools/lint-content.js`, `src/index.html`, `src/ui/main.js`, `src/content/index.js`, `src/engine/.gitkeep`, `tests/unit/scaffold.test.js`, `README.md`, `.gitignore` (append only: `saves/`).

## Acceptance criteria
- [ ] `npm install` then `npm run check` exits 0.
- [ ] `dist/tallyman.html` is a single file with no `<script src>` / `<link href>` to anything external or local; opening it via `file://` in headless Chrome renders the placeholder (verify with `google-chrome --headless=new --screenshot` and look at it).
- [ ] `npm start` serves `http://localhost:8064/src/index.html` (dev, unbundled) — verify with curl then stop the server.
- [ ] implementation.md written.
