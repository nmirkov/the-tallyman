# TT-001 implementation

## Summary
Project skeleton with working `npm run check` (stub lint + test + build) and a single-file offline build showing the placeholder C64-blue screen.

## Files changed
package.json, package-lock.json (esbuild pinned exact), tools/{build,serve,play,progress,lint-content}.js, src/index.html, src/ui/main.js, src/content/index.js, src/engine/.gitkeep, tests/unit/scaffold.test.js, README.md, .gitignore (appended `saves/`), ticket.md (status: verify).

## Decisions made
- `test` script is `node --test tests/` (Node 20 recurses directories; globs are not supported in Node 20).
- Build escapes `</script` in the bundle and uses a replacer fn so `$` in JS is safe.
- serve.js blocks path traversal, honours `PORT` env, defaults to 8064.
- `--release` minifies; default build is unminified.

## How verified
- `npm run check` exits 0 (1 test pass, build wrote dist/tallyman.html).
- dist/tallyman.html has 0 `<script src>`/`<link>`; headless Chrome `file://` screenshot viewed: blue screen with "THE TALLYMAN — LOADING…".
- `npm start`: curl returned 200 for /src/index.html and /src/ui/main.js; server stopped.

## Known gaps / follow-ups
None. Out-of-scope edits: none.
