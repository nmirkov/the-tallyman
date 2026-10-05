---
id: TT-016
title: Content: Town and Canal zones (bundle framework, registries, NPCs)
milestone: M3
status: todo
agent: writer
model: opus
depends: [TT-010, TT-015]
---
# TT-016 — Content: Town + Canal

## Goal
Transcribe `docs/STORY.md` into real content data for the Town (18 rooms) and Canal (5 rooms) zones, plus the bundle framework every later content ticket extends. STORY.md is the source of truth for prose and data; ARCHITECTURE.md (A4) is normative for the schema.

## Scope
- `src/content/index.js`: assemble the bundle from modules (`rules`, `zones`, `rooms`, `items`, `npcs`, `topics`, `verbs`, `evidence`, `notes`, `vars`, `case`, `hazards`, `beats`, `daemons`, `endings`, `hints`, `scoring`, `help`, `messages`, `art` (import from `./art/index.js` if present — the artist owns that folder)). Layout: `src/content/rules.js`, `src/content/registries.js` (evidence, notes, vars, flags list, scoring/ranks — full from STORY §7.5/§11 now), `src/content/shared.js` (named shared reactions, STORY §7.3), `src/content/zones/town.js`, `src/content/zones/canal.js` (rooms + their items/scenery), `src/content/npcs/{maggie,pike,ashdown,silas,harrow}.js` (Harrow/Pike finale parts may be stubbed until TT-018 but keep ids), `src/content/topics.js`, `src/content/verbs.js` (STORY §7.4).
- Rooms of zones not yet transcribed (Moor, Mill, Asylum, Beneath) are declared as **stubs** in `src/content/stubs.js` (lint incremental mode, ARCHITECTURE A13) so exits resolve.
- Content verbs with extra patterns on existing verb ids (STORY §7.4: `pry`, `replace`, `pour`, `pray`, `knock`, `open {dobj} with {iobj}`): confirm `buildVocab` supports them; if not, make the minimal change in `src/engine/vocab.js` / `parser.js` with tests.
- Scenery coverage per STORY §0. `proper: true` on named NPCs.
- `tests/content/town-canal.test.js`: scripted mini-walkthrough(s) through Town+Canal via `createGame` with the real content: start text, platform → waiting room torch + coin, Maggie card/batteries/key, Harrow's room, phone HQ, buy whisky, Silas gives bolt cutters/oil can, vestry register fact, No.13 button — asserting flags, notes, evidence, score per STORY. Plus lint passes (incremental).

## File allow-list
`src/content/**` except `src/content/art/**`; `src/engine/vocab.js`, `src/engine/parser.js` (content-verb pattern support only, with tests in `tests/unit/parser.test.js`); `tests/content/*`

## Acceptance criteria
- [ ] `npm run lint:content` 0 errors (stubs allowed); `npm run play` starts the real game at the platform.
- [ ] Town+Canal steps of STORY §12.1 replay with expected results in tests.
- [ ] Every description, response and topic text is copied from STORY.md verbatim (fix only obvious typos; list any deviation in implementation.md).
- [ ] `npm run check` green.
