<div align="center">

# ⛔ SPOILERS ⛔

### This document gives away the solution to THE TALLYMAN:<br>who the killer is, how the puzzles work and how every ending is reached.

**[▶ Play the game first](https://nmirkov.github.io/the-tallyman/), then come back.**

</div>

---

# THE TALLYMAN — Master Plan

> An 8-bit style crime-thriller / horror text adventure, built in the spirit of the
> Commodore 64 and ZX Spectrum adventures of 1982–1987 (The Hobbit, Level 9,
> Infocom-lite parsers, Mysterious Adventures). Built fully autonomously by a team of
> AI agents, ticket by ticket, with cross-vendor (Codex) review.

Version: 1.2 — **APPROVED WITH NOTES** by Codex (round 3, 2026-10-05) · Date: 2026-10-05 · Owner: orchestrator (Claude, harness)

---

## 1. Vision & pillars

| Pillar | What it means concretely |
|---|---|
| **Authentic 8-bit feel** | 40×25 character screen rendered on a canvas with a real 8×8 bitmap font, C64 16-colour palette (Spectrum palette as alt theme), coloured border, block cursor, `[MORE]` paging, tape-loading boot screen. |
| **Textual graphics** | Every location has a PETSCII-style picture (40×9 cells, chars + per-cell colours) drawn in the top panel, with a few animated effects (rain, lightning flash, flicker). Title and ending screens are full-screen art. |
| **8-bit sound** | WebAudio "SID-like" 3-voice synth (pulse/triangle/saw/noise + ADSR). Title theme, per-zone ambience (rain, drone, heartbeat), SFX (keyclick, door, thunder, scream sting, pickup arpeggio, death, victory). |
| **Crime thriller first, horror second** | A solvable murder case with fair clues, red herrings and an accusation mechanic; horror comes from darkness, a "nerve" meter, counting voices and ambiguous apparitions. |
| **Classic parser, modern fairness** | VERB [ADJ] NOUN [PREP [ADJ] NOUN], synonyms, abbreviations, IT/THEM, AGAIN, ALL, multiple commands with `.` / `THEN`, UNDO (1 level), SAVE/LOAD (localStorage, 3 slots), HINT (costs points), NOTES (case notebook). No guess-the-verb walls: every puzzle verb has synonyms. |
| **Deterministic & testable** | Pure engine (no DOM), seeded RNG stored in state, scripted walkthrough tests for every ending. |

Non-goals: multiplayer, LLM-driven NPCs at runtime, network features, a game editor.

---

## 2. Story bible (summary — full detail lands in `docs/STORY.md`, ticket TT-015)

**Setting.** Blackmere, a fog-bound Lancashire mill town on the edge of the moor.
Thursday 15 November 1984, 21:30. Rain.

**Premise.** Four people have been found dead in Blackmere in four weeks, each with
tally marks scratched on the wall beside them: |, ||, |||, ||||. The press call the killer
**The Tallyman**, after a local legend — the mill's debt-collector who, in the
fire of 1912, locked the weaving-shed doors "until the tally was settled". Fourteen
mill girls died. Tonight is the fifth tally: the diagonal stroke.

The player is a Detective Sergeant (unnamed, ungendered, second person) sent up from
Manchester because their partner, **DI Frank Harrow**, radioed in at 20:40 from the
moor road — "I know who it is" — and then went silent. The last train leaves you on
the platform. You have until **midnight**.

**Truth.** The killer is **PC Arthur Pike**, the friendly village constable. His
great-great-aunt Mary Pike (14) died in the 1912 fire. As a boy he was committed to
Ashcombe Asylum (1971–75) for obsessive counting and delusions of an "ancestral debt".
He is killing the descendants of the families named in the mill's 1912 debt ledger
(Ashworth, Crabtree, Holt, Marsh — and the fifth name: **Harrow**). Harrow found out
and is chained in the **Counting Room** beneath the mill. At midnight Pike will draw
the fifth stroke.

**Red herrings.** Rev. Ashdown (nervous, secretive — actually hiding love letters in
the crypt); Silas Thorne the lock-keeper (creepy, mutters about "the counting man" — a
truthful witness); Maggie the landlady (knows everyone's business, protective of Pike).

**Horror layer (ambiguous, never confirmed supernatural).** Counting heard in the dark
("…three… four…"), the ghost of a mill girl in the weaving shed who says "He counts for
me. Make him stop.", scorched smells, footsteps that stop when you stop, a figure in
the fog. The **NERVE** meter (0–100) rises in the dark and during scares and falls in
lit, safe places; at 100 you panic and flee to the previous room (never an instant
death — fairness).

### 2.1 Map (≈38 locations, 5 zones)

```
TOWN:     Platform* · Waiting Room · Station Road · Market Square · Phone Box ·
          Black Lamb (bar) · Harrow's Room (up) · Police House · Cells ·
          Church Lane · St Jude's · Vestry · Churchyard · Crypt(dark) ·
          High Street · Chapel Street · No.13 (crime scene) · Back Alley
CANAL:    Canal Bridge · Towpath · Lock · Lock-keeper's Cottage · Shed
MOOR:     Moor Road · Harrow's Car · Tally Stone · Quarry Edge · Quarry Hut
MILL:     Mill Gates · Mill Yard · Weaving Shed(dark) · Counting House ·
          Boiler Room(dark)
ASYLUM:   Asylum Gates · Coal Chute · Entrance Hall · Records Office ·
          Ward(dark) · Morgue(dark)
BENEATH:  Tunnel(dark) · Counting Room (finale)
```
`*` start. Exact exits/compass layout are defined in TT-015 and validated by the
content linter (connectivity, reciprocal exits unless flagged one-way).

### 2.2 Puzzle & evidence chain (critical path)

1. **Light.** Torch in the Waiting Room has dead batteries. Maggie gives batteries
   after you SHOW your WARRANT CARD (or ASK about batteries). Fresh batteries last 320
   lit turns — more than the whole game — so light can never run out (the torch only
   *flickers* cosmetically after 23:00). Dark rooms without light = you see nothing,
   can only leave the way you came, nerve rises fast. The Tunnel refuses entry without
   light ("Not without a light."). See §2.5 for the resource policy.
2. **Harrow's Room.** Maggie hands over the key once she has seen the warrant card →
   Harrow's suitcase: case map (marks the mill and Ashcombe), a list of four victim
   surnames, a note "TALLY = DEBT. Who keeps the book?".
3. **Phone Box** (needs a 10p coin, found by SEARCHing the waiting-room bench): call
   HQ → learn Harrow's car is on the moor road. (Optional; points.)
4. **Harrow's Car** (moor): handcuffs + torn notebook page: "Ledger at the mill names
   them. Ashcombe — 1970s files. The boy who counted."
5. **Silas** at the lock-keeper's cottage: GIVE WHISKY (bought at the Black Lamb with
   your money) → he tells of "the counting man" using the old tunnel between the asylum
   morgue and the mill, and lends BOLT CUTTERS from his shed.
6. **Mill** (cut chain on gates with bolt cutters) → Counting House → 1912 LEDGER.
   The ledger is too heavy to carry; its loose final page is already half torn
   ("EXAMINE LEDGER: the last page hangs by a thread") → TAKE PAGE / TEAR PAGE →
   **Evidence A: ledger page** (families incl. Harrow; wages list incl. "Pike, Mary").
7. **Vestry** burial register (READ REGISTER) → **Evidence B: noted** "Mary Pike, 14,
   d. 15 Nov 1912" (recorded in NOTES; the register itself is too heavy).
8. **No.13 Chapel Street** crime scene → SEARCH → **Evidence C: silver tunic button**
   (police crown). EXAMINE PIKE afterwards reveals a missing button.
9. **Ashcombe Asylum** via the coal chute (two-way: CLIMB UP returns) → Records
   Office → rusted cabinet, opened with the CROWBAR (Quarry Hut) → **Evidence D:
   patient file "A. PIKE"**. The file mentions "the boy kept to the morgue; the drawer
   that does not close" → clue for the Morgue hatch (drawer 4 slides back onto a hatch).
10. **Accusation.** ACCUSE PIKE (§2.5) at the Police House or in the Counting Room.
11. **Finale.** Counting Room, reached via Morgue hatch → Tunnel, or via the Boiler
    Room hatch (rusted; Silas mentions "that hatch wants oil", OIL CAN from his shed).
    Full rules in §2.5.

Clue fairness: every non-obvious action has an in-world pointer (torn page hanging;
file → morgue drawer; Silas → oil; EXAMINE BUTTON "a police tunic button, crown and
all" → Pike is the only uniformed officer in town). HINT follows the first unmet
prerequisite on the critical path, not a fixed list.

### 2.3 Endings (precedence and exact rules in §2.5)
| Ending | Trigger |
|---|---|
| **Full victory** | The moment Pike is restrained AND Harrow is freed (any order), before midnight. |
| **Pyrrhic** | Midnight (end of turn 300) with Pike restrained but Harrow still chained — Harrow has bled out. |
| **The one that got away** | Midnight with Harrow freed but Pike not restrained — Pike vanishes onto the moor. |
| **The fifth stroke** | Midnight with Pike free and Harrow chained — Harrow is murdered. |
| **Wrong man** | ACCUSE Ashdown / Maggie / Silas, then answer YES to the confirmation. |
| **Deaths** | Drowning (SWIM / ENTER LOCK — warned once, then fatal), quarry edge (GO DOWN without the rope — warned once), Pike's attack in the Counting Room (§2.5). Each death offers UNDO / LOAD / RESTART. |

**Score: 100 points**, awarded once each (torch lit 5, Harrow's room 5, phone call 5,
car found 5, Silas's story 5, mill entered 5, ledger page 10, register noted 10, button
10, patient file 10, correct accusation 10, Harrow freed 10, Pike arrested 10).
HINT costs 2 points per use (cannot go below 0). Ranks: Probationer → Constable →
Detective Constable → Detective Sergeant → Inspector → Chief Inspector (100).

**Clock.** Starts 21:30; each turn = 30 game-seconds, meta commands (SAVE, SCORE,
NOTES, HELP, TIME…) are free. Midnight at turn 300. The reference walkthrough must win
in ≤ 230 turns (≥ 70 turns of slack). Scripted beats: church bell at 22:00/23:00, Pike
leaves the Police House at 23:30 if not yet accused (goes to the Counting Room),
"counting" ambience intensifies after 23:00.

### 2.5 Case rules, finale state machine & resource policy (authoritative)

**Evidence ids.** `ev_ledger` (item: ledger page), `ev_register` (fact: set when the
burial register is read; shown in NOTES), `ev_button` (item: silver button), `ev_file`
(item: patient file). An item counts while **carried**; a fact counts once noted.
The car's notebook page is a lead, not evidence.

**ACCUSE <person>.** Free of turn cost only when it does not resolve (e.g. person not
present → "Accuse who? They're not here."). Otherwise 1 turn.
- Pike, present, evidence ≥ 3 → correct accusation (+10). If at the Police House:
  Pike shoves past you and flees; `pike` moves to the Counting Room 4 turns later
  (`pike_state: fled`). In the Counting Room: points only (the confrontation continues).
- Pike, present, evidence < 3 → he laughs it off, nerve +15, may retry.
- Ashdown / Maggie / Silas, present → "Are you certain? (Y/N)" — pending confirmation
  (free); YES → Wrong man ending; NO / anything else → cancelled, no turn.

**Pike's schedule.** Police House front office from start. Leaves at turn 240 (23:30)
for the Counting Room if not already fled (`pike_state: left`). He is never met
elsewhere before that (no random encounters with him).

**Counting Room door.** The Tunnel's far end is an iron door "barred from the other
side" until Pike is in the Counting Room; once he is, it stands ajar. The Boiler Room
hatch route leads to the Tunnel, so both routes share this gate. Before Pike arrives,
from the Tunnel you hear Harrow praying — a clear signpost.

**Inside the Counting Room** (Pike present, unrestrained): `attack` counter starts at 0
on first entry and increments at the end of every turn the player ends in the room
(the entering turn counts as 1). Panic cannot occur here (see resource policy). With light: warning
at 2 ("He circles, knife low."), lunge at 4 (warning, nerve +20), fatal at 5. In
darkness (torch turned off): warning at 1, fatal at 2. Leaving the room pauses the
counter (it resumes at its value on re-entry, minimum 1).
- `HANDCUFF PIKE` / `ARREST PIKE` / `CUFF PIKE` with handcuffs carried → Pike
  restrained (+10). Restraint stops the counter permanently. Without handcuffs:
  "With what? Harrow croaks: 'Cuffs — in my car!'" (no turn cost beyond 1).
- `CUT CHAINS` / `FREE HARROW` / `USE BOLT CUTTERS ON CHAINS` with bolt cutters
  carried → Harrow freed (+10). Allowed whether Pike is restrained or not.

**Harrow's bleeding** is cued: entering the Tunnel or Counting Room after 23:00, and
every 20 turns in the Counting Room, Harrow's condition worsens in the prose ("His
breathing is shallower now."), so the Pyrrhic ending is foreshadowed.

**Endings precedence (evaluated at the end of every turn, in this order):**
1. Player death (drowning, fall, Pike attack) — ends immediately.
2. Victory — Pike restrained AND Harrow freed.
3. Midnight (turn counter reaches 300 after this turn's action and daemons):
   Pike restrained & Harrow chained → **Pyrrhic**; Pike free & Harrow freed →
   **One that got away**; Pike free & Harrow chained → **Fifth stroke**.
An action that achieves victory on turn 300 wins (2 precedes 3).

**Resource policy (no silent softlocks).**
- Critical items carry `critical: true`: ledger page, button, file, handcuffs, bolt
  cutters, crowbar, oil can, torch, batteries, whisky. They cannot be
  destroyed, eaten, drunk, thrown into water/the quarry, or given to the wrong NPC
  (in-world refusal). DROP leaves them where dropped (always retrievable — no room
  ever becomes permanently inaccessible except after an ending).
- **Personal effects:** the WARRANT CARD and your WALLET (money is a balance in
  state, `money: 500` pence, not a droppable item) are part of you: DROP/GIVE/THROW are
  refused ("You'd sooner lose your head."). SHOW CARD works. Whisky costs £2; Maggie
  sells it once you've heard of Silas ("Silas'll talk for a drop of this") and sells
  again if the bottle is somehow gone (balance permits two purchases). The 10p coin
  is a separate optional item (phone only).
- Light cannot be exhausted (§2.2 #1).
- **Panic** (nerve reaches 100): you flee to the zone's designated *safe room*
  (lit, non-hazardous, adjacent zone hub: Town → Market Square, Canal → Towpath,
  Moor → Moor Road, Mill → Mill Yard, Asylum → Asylum Gates); nerve resets to 50;
  panic cannot trigger again within 15 turns. Safe rooms reduce nerve by 5/turn; lit
  non-dark rooms by 1/turn. **Beneath (Tunnel, Counting Room): panic never
  triggers** — nerve caps at 99 ("Your heart hammers, but Harrow's voice holds you
  here."); nerve has no effect on the attack counter. Tests: panic in every zone,
  nerve cap in both Beneath rooms, cap while the attack counter runs.
- No one-way exits except the warned quarry fall (death).
- The linter flags any `critical` item whose location is not reachable from start,
  and any exit marked one-way that is not a death.

### 2.4 Voice & style guide
Second person, present tense, terse 8-bit economy: room descriptions ≤ 300 chars,
responses usually one or two sentences. British 1984 vocabulary (torch, 10p, Cortina,
pint of mild). Dread through understatement; no gore beyond "dark stains" and scratched
marks. Small dry humour in failure messages ("The ledger is unmoved by your
violence."). Upper-case output is optional per theme (Spectrum theme = mixed case,
C64 theme = upper-case, like the real machines).

---

## 3. Technical architecture

### 3.1 Stack
- **Vanilla JavaScript (ES2022 modules)**, no runtime dependencies, no framework.
- **Node 20** for tooling: `node --test` for tests; **esbuild** (dev dependency only)
  to bundle into a **single self-contained `dist/tallyman.html`** (JS, font, art inlined)
  that opens by double-click, offline.
- Dev server: `tools/serve.js` (zero-dep static server) → `npm start`.
- Terminal player: `tools/play.js` → `npm run play` (same engine, plain-text output) —
  used by the QA agent and walkthrough tooling.

### 3.2 Directory layout
```
src/
  engine/        # pure, DOM-free, deterministic
    parser.js        tokenise → normalise (synonyms, abbreviations) → match grammar
    vocab.js         verbs, prepositions, articles, direction words, synonyms
    types.js         JSDoc typedefs — the engine contract (TT-002)
    state.js         createState(content, seed), clone, serialise/deserialise (versioned)
    rng.js           mulberry32 seeded RNG (seed lives in state)
    world.js         queries: scope, visibility, light, containers, locate, move
    actions/         one module per verb family (movement, objects, containers,
                     light, npc, senses, meta, case) — registry-based
    daemons.js       per-turn systems: clock, light drain, nerve, NPC schedules,
                     ambience, scripted beats, endings
    game.js          createGame({content, seed}) → { start(), input(line), save(),
                     load(json), undo() }; returns Output Events (3.4)
  content/       # data only (+ small hook functions where unavoidable)
    rooms/*.js  items.js  npcs.js  topics.js  scoring.js  endings.js  hints.js
    art/*.js         PETSCII pictures (3.5)
    index.js         assembles the content bundle
  ui/
    font8x8.js       public-domain font8x8 (dhepper) incl. block & box glyphs → JS
    palette.js       C64 + Spectrum palettes, theme definitions
    screen.js        40×25 char-cell canvas renderer, integer scaling, border,
                     regions (status / picture / text), scroll, inverse, flash
    terminal.js      text-region driver: word-wrap at 40 cols, typewriter speed,
                     [MORE] paging, input line with block cursor, history (↑/↓),
                     scrollback (PgUp/PgDn), hidden <input> for mobile keyboards
    picture.js       draws art + animated fx (rain, lightning, flicker)
    audio/           synth.js (voices, ADSR, noise), sfx.js, music.js (sequencer +
                     tunes as data), ambience.js
    boot.js          tape-loading screen (border stripes + loader text + sound),
                     title screen, intro
    main.js          wires engine ↔ UI; dispatches Output Events
tools/  serve.js  play.js  build.js  progress.js  lint-content.js  smoke.js
tests/  unit/ content/ walkthrough/ fuzz/
docs/   PLAN.md STORY.md ARCHITECTURE.md STATUS.md HANDOVER.md DECISIONS.md REVIEWS.md progress.html
tickets/ BOARD.md  TT-xxx-slug/{ticket.md, implementation.md}
.claude/agents/  role definitions for builder/QA sub-agents (written by the orchestrator in M0 — exist)
```

### 3.3 Data model (content schema — enforced by `tools/lint-content.js`)
```js
Room   { id, name, desc: string | (state)=>string, dark?: bool, zone,
         exits: { n|s|e|w|ne|nw|se|sw|u|d|in|out: roomId | {to, if?, msg?, oneWay?} },
         picture?: artId, ambient?: 'rain'|'wind'|'drone'|'pub'|'none',
         scenery?: [{ names:[...], desc }],         // examinable, not takeable
         onEnter?: hookId, nerve?: number }          // nerve delta per turn here
Item   { id, names:[...], adjectives?:[...], desc, location: roomId|itemId|'player'|null,
         portable?: bool, weight?, container?: {open?, locked?, keyId?, capacity?},
         light?: {lit, fuel?}, evidence?: {points, label}, readable?: text,
         hidden?: bool  /* revealed by SEARCH */ }
Npc    { id, names, desc, location, schedule?: [{at: turn, to: roomId}],
         topics: { topicId: text | {text, sets?, requires?} }, default,
         accepts?: { itemId: hookId } }
State  { v:1, seed, rng, turn, roomId, prevRoomId,
         items:{ id:{ loc, open?, locked?, lit?, fuel? } },   // loc: roomId|itemId|'player'|null — SINGLE source of truth (inventory is derived)
         npcs:{ id:{ loc, state? } }, flags:{}, score, awarded:[], nerve,
         panicCooldown, notes:[], evidence:[],
         ctx:{ it, them:[], lastCommand, pending: null | {kind:'disambig'|'confirm', …} },
         settings:{ verbose, graphics }, ended: null | endingId }
```
Content is immutable at runtime and may contain hook functions (registered by id in
`content/hooks.js`); hooks are deterministic functions of (state, api) — they mutate
state only through the engine API and use only the state RNG. Functions never enter
state, saves or undo snapshots.

### 3.4a Engine contract (authoritative; detailed in `docs/ARCHITECTURE.md`, TT-002)
- **Turn cost.** Each executed in-world command costs 1 turn (30 game-seconds),
  including failed attempts that reach the world ("The door is locked."). Parse errors,
  meta commands (SAVE, LOAD, SCORE, NOTES, TIME, HELP, HINT, SOUND, THEME, GRAPHICS,
  VERBOSE/BRIEF, UNDO) and answers to clarification/confirmation questions cost 0 —
  the clarified command itself costs 1 when it executes.
- **Command chains.** `TAKE TORCH. N THEN OPEN DOOR` executes commands in sequence
  within one `input()` call; the chain stops (remaining commands discarded with a
  notice) on parse error, clarification/confirmation question, ending, panic, or
  death. Chains are never persisted.
- **Chain barriers.** SAVE, LOAD, IMPORT, EXPORT, UNDO, RESTART and QUIT must end a
  chain: any commands after one are discarded with the notice "(Commands after LOAD
  were ignored.)". The engine emits the storage/host request as the *last* event of
  that `input()` call, so no further simulation happens against stale state. LOAD /
  IMPORT failure or cancellation (bad data, missing slot, user closes the file picker)
  leaves the current state untouched and the host prints the reason; the game simply
  awaits the next command.
- **AGAIN / ALL.** AGAIN repeats the last fully resolved command (i.e. after any
  clarification was answered; after a chain, the last command of the chain); AGAIN is
  never itself stored. `TAKE ALL` / `DROP ALL EXCEPT X` cost 1 turn in total.
- **Per-turn order.** action → `afterAction` hooks → daemons in fixed order: clock →
  scripted beats → NPC schedules → light → nerve/panic → ambience → endings check
  (§2.5 precedence) → status event.
- **UNDO** reverts one whole input line (snapshot taken before the line if it contains
  ≥ 1 turn-costing command). One level, in-memory only, never serialised, cleared by
  LOAD/RESTART; available after a death ending.
- **Storage.** The engine never touches storage. `SAVE n` emits
  `{type:'storage', op:'save', slot, data}`; `LOAD n` emits
  `{type:'storage', op:'load', slot}` and the host calls `game.load(data)`; host
  reports success/failure itself. `game.load()` validates (version, ids, no
  containment cycles) atomically — on failure state is untouched.
- **Full refresh.** `start()`, `load()`, `undo()` and `restart()` emit a refresh
  bundle: `clear`, `room`, `picture`, `ambient`, `music stop`, `status`, the room
  description, then — if present in the restored state — the pending clarification /
  confirmation `prompt` re-emitted verbatim, or, for an ended game, the `end` event
  with the ending text (only UNDO / LOAD / RESTART / IMPORT accepted afterwards). The
  UI never keeps derived state of its own. Required tests: `LOAD 1 THEN NORTH`
  (NORTH discarded), load of a save holding a pending prompt, load of an ended game,
  UNDO/RESTART mid-chain.
- **Host protocol.** Besides `storage`, the engine emits `{type:'host', op:'export'
  | 'import' | 'setting', key?, value?}` for EXPORT, IMPORT and presentation settings
  (SOUND, MUSIC, THEME, TYPEWRITER). Presentation settings live in the host, not in
  game state; GRAPHICS and VERBOSE live in state (they change engine output).
- Animation, typewriter speed and audio never advance simulation time.
- **Text glyphs.** All engine text passes a normaliser before output: curly quotes →
  straight, `…` → `...`, dashes → `-`; `£` gets a custom glyph added to the font (as
  on the real C64). The content linter rejects any other glyph not in the font.
- **Schema completeness.** TT-002 must specify, besides §3.3: `critical`,
  discovery/hidden state per item, `money`, attack counter, Pike arrival turn,
  hazard-warning flags, panic cooldown, Harrow state, evidence/facts.

### 3.4 Output Event protocol (engine → UI)
`game.input(line)` returns an array of events, rendered in order:
```
{type:'text', text, style?: 'normal'|'title'|'alert'|'whisper'|'echo'|'system'}
{type:'room', id, name}            // UI updates status line + picture
{type:'picture', id | null}
{type:'status', room, time, score, nerve, turns}
{type:'sfx', id}                    // 'door','thunder','sting','pickup',...
{type:'ambient', id}
{type:'music', id | 'stop'}
{type:'pause', ms}
{type:'clear'}
{type:'end', ending, score, rank}
{type:'storage', op:'save'|'load', slot, data?}
{type:'prompt', kind:'disambig'|'confirm', text}   // next input answers it
```
The terminal player (`tools/play.js`) renders the same events as plain text, so every
game behaviour is testable without a browser.

### 3.5 Art format
```js
export default { id:'mill_yard', w:40, h:9,
  chars:  [ '40-char strings × 9' ],
  colors: [ '40-char strings × 9, one palette key per cell (0-9a-f)' ],
  bg?: same shape | single key,  fx?: ['rain'|'lightning'|'flicker'|'fog'] }
```
Two shapes: **location art** 40×9 (picture panel) and **screen art** 40×25 (title,
ending screens; same keys, `h:25`). Optional per-cell `bg` is an aesthetic choice
(PETSCII reverse-video allowed). Glyph set restricted to what `font8x8` provides
(ASCII + U+2500–257F box + U+2580–259F blocks); the linter rejects unknown glyphs and
wrong dimensions — and it also checks all game *text* for glyphs the font lacks.
**Style gate:** TT-019 produces 3 representative pictures + a font/palette reference
screenshot that the orchestrator must approve before the full art set is drawn.

### 3.6 Screen layout (40×25)
```
row 0      status bar (inverse): LOCATION ............ 23:14  SC 45
rows 1–9   picture panel (GRAPHICS OFF hides it → text gets 23 rows)
row 10     divider
rows 11–24 text region (scrolling, [MORE] paging, input line at bottom)
```
Border colour shifts with nerve (blue → purple → red pulse at > 80).
Accessibility: a visually hidden DOM transcript (`aria-live="polite"`) mirrors all
text output; `TYPEWRITER OFF` / `prefers-reduced-motion` disable typewriter and
flashing; any key skips the boot sequence.

### 3.7 Audio design
WebAudio graph: 3 voices + noise → per-voice gain (ADSR) → master gain → destination.
Pulse waves via `PeriodicWave` (duty 12.5/25/50 %). Music as compact data (note,
duration, voice, instrument). AudioContext is created/resumed on the first key press
(autoplay policy) — the "PRESS ANY KEY" on the title screen provides it. `SOUND
ON|OFF`, `MUSIC ON|OFF`, and the `F2` key toggle; setting persisted when storage is
available. The noise "fourth voice" is an accepted liberty (the real SID had noise as
a waveform of its 3 voices). **Audio audition gate:** since no agent can listen, TT-013
renders every SFX/tune through `OfflineAudioContext` in headless Chrome and asserts
non-silence, no clipping (peak < 0.99), expected duration ±10 %, and dominant pitch of
reference notes within ±2 %; Nenad can audition everything later on `tools/audio-demo.html`.

### 3.8 Persistence
`SAVE [1-3]` / `LOAD [1-3]` / `RESTART`. Browser host storage adapter: localStorage
wrapped in try/catch (it may be absent or throw, notably under `file://` in some
browsers). If unavailable, the host says so once and keeps saves in memory for the
session, and the portable fallback is always available: `EXPORT` downloads the save as
`tallyman-save.json` (Blob link) and `IMPORT` opens a file picker — both work under
`file://` offline. Terminal player saves to `./saves/` (git-ignored). Release testing
(TT-023) loads the built HTML via `file://` with network blocked, saves, reloads, and
repeats with localStorage forced to throw.

---

## 4. Quality strategy

| Layer | Tooling | Gate |
|---|---|---|
| Unit | `node --test tests/unit` — parser, world queries, every action family, daemons, save/load round-trip | all green |
| Content lint | `npm run lint:content` — schema, ids resolve, exits valid, reciprocity, all rooms reachable from start, all critical items obtainable, art dims/glyphs, text glyphs, description length limits, **indistinguishable references** (two objects that can share a scope with identical names *and* no distinguishing adjective) — shared nouns resolvable by adjectives are allowed. Incremental mode: exits to zones not yet built point to declared stubs in `content/stubs.js` and missing pictures fall back to "no picture"; `--strict` (required from R3 on) allows zero stubs and requires every picture | 0 errors |
| Walkthrough | `tests/walkthrough/*.test.js` replay command scripts: win (100/100), each ending, each death, ≥ 70 turns slack | all green |
| Solvability | targeted tests: prerequisite orders (evidence in every order, accuse early/late/never, both finale routes, cuff-then-free and free-then-cuff), turns 299/300 boundaries, leave/re-enter Counting Room, attempts to lose every `critical` item, panic in every zone, dark-room entry/exit | all green |
| Save determinism | save at N points of the walkthrough → load → replay remainder → identical events & final state (RNG, pending prompts, timers, evidence, score, endings); invalid saves rejected atomically | all green |
| Fuzz | 20 seeds × 2 000 random commands from vocab; engine never throws, state always serialisable, undo snapshot bounded | all green |
| Browser smoke | `npm run smoke` (playwright-core dev-dep driving the installed Chrome): `file://` load with network blocked, typed commands, paging, history, SAVE → reload → LOAD identical continuation, localStorage-throws mode with EXPORT → reload → IMPORT identical continuation, restoration of a pending prompt and of an ended game, zero console errors, screenshots at 1800 px & 390 px | no errors, screenshots reviewed |
| AI playtest | QA agent in a **clean context** (no PLAN/STORY/source/walkthrough access) plays via `tools/play.js`, logs every command and confusion point, assesses clue discoverability, repetitive prose and failed-command feedback, files bug tickets; a second QA pass checks behaviour against STORY.md rules (expected outcomes derived from the approved rules, not from implementation output); affected checks re-run after fixes | high/medium fixed |
| Cross-vendor review | Codex (`gpt-6-astra`, high) reviews the diff at the end of every milestone | APPROVED / APPROVED WITH NOTES |

`npm run check` = lint:content + test + build, and **exists from TT-001** (with a
minimal build and stub lint) so every ticket is gated from day one. Nothing is
committed with a red check.

---

## 5. Delivery plan — milestones & tickets

Tickets live in `tickets/TT-xxx-slug/ticket.md` with front-matter
(`id, title, milestone, status, agent, model, depends`). Board: `tickets/BOARD.md`.

### M0 — Foundations
| ID | Ticket | Agent | Depends |
|---|---|---|---|
| TT-001 | Scaffold: package.json scripts, esbuild, **minimal working single-file build**, serve.js, `node --test` runner, stub content lint, `npm run check`, README stub | engine-dev (sonnet) | — |
| TT-002 | **Engine contract**: `docs/ARCHITECTURE.md` + `src/engine/types.js` JSDoc typedefs (state, content schema, events, hooks API, storage protocol, turn/daemon order, undo) — orchestrator approves before M1 | engine-dev (opus) | 001 |
| TT-003 | Font + palettes + `screen.js` canvas renderer (40×25, scaling, regions, border) + font/palette reference screenshot | ui-dev (opus) | 001 |
| TT-004 | `tools/progress.js` → `docs/progress.html` generator (plan, milestones, board, commits, reviews) | engine-dev (sonnet) | 001 |

### M1 — Engine
| TT-005 | Parser syntax: tokenizer, vocab, synonyms/abbreviations (L X I Z G N…), grammar patterns incl. multiword nouns, PUT…IN/ON, TAKE…FROM, tool prepositions (WITH/USING), BUY/DRINK/CALL/ACCUSE/SHOW/GIVE/ASK…ABOUT, chains — TDD | engine-dev (opus) | 002 |
| TT-006 | State, RNG, world queries (scope, light, containment), serialise/validate/load (atomic), content linter core | engine-dev (opus) | 002 |
| TT-007 | Parser resolution: scope-based noun binding, adjectives, disambiguation prompts (free), IT/THEM, ALL/EXCEPT, AGAIN, pending-prompt answers | engine-dev (opus) | 005, 006 |
| TT-008 | Core actions (movement, look/examine/search, objects, containers, locks, light, senses, meta) + `tools/play.js`, on a mini test world | engine-dev (opus) | 007 |
| TT-009 | Case & NPC mechanics: ASK/TELL/SHOW/GIVE/BUY, evidence & NOTES, ACCUSE with confirmation, HINT engine (first unmet prerequisite), critical-item protection | engine-dev (opus) | 008 |
| TT-010 | Daemons: clock, scripted beats, NPC schedules, nerve/panic/safe rooms, endings precedence, scoring/ranks, UNDO; save-determinism tests | engine-dev (opus) | 009 |
| **R1** | Codex review of M0+M1 → fix tickets | orchestrator | 003, 004, 010 |

### M2 — Presentation
| TT-011 | Terminal interaction: wrap, typewriter, MORE paging, input line + cursor, history, scrollback, hidden mobile input, DOM transcript, reduced motion | ui-dev (opus) | 003, R1 |
| TT-012 | Presentation integration: status bar, picture panel + fx, themes, nerve border, `main.js` engine wiring, storage adapter + EXPORT/IMPORT | ui-dev (opus) | 011 |
| TT-013 | Audio: synth, SFX, music sequencer, title theme, ambiences, audition harness + gate | audio-dev (opus) | 001 |
| TT-014 | Boot: tape-loading screen, title screen, intro, ending-screen shell, 40×25 screen-art support | ui-dev (sonnet) | 012, 013 |
| **R2** | Codex review of M2 → fix tickets | orchestrator | 014 |

### M3 — Content
| TT-015 | `docs/STORY.md`: rooms + exits, items (+critical flags), NPC topic tables, puzzle graph, §2.5 state machine instantiated, hints, endings text, reference walkthrough — orchestrator approves against §2 | writer (opus) | 002 (runs during M1) |
| TT-016 | Content: Town + Canal (rooms, items, Maggie/Pike/Ashdown/Silas, topics) | writer (opus) | 010, 015 |
| TT-017 | Content: Moor + Mill + Asylum | writer (opus) | 016 |
| TT-018 | Content: Beneath + finale + endings + hints | writer (opus) | 017 |
| TT-019 | **Art style gate**: art preview tool + 3 representative pictures + reference screenshot → orchestrator approval | artist (opus) | 003, 015 |
| TT-020 | Art: all remaining location pictures | artist (opus) | 019 |
| TT-021 | Art: 40×25 title + ending screens | artist (opus) | 019 |
| TT-022 | Walkthrough + solvability + save-determinism + fuzz suites (§4) and balancing | qa (sonnet) | 018 |
| **R3** | Codex review of M3 → fix tickets | orchestrator | 020, 021, 022 |

### M4 — Polish & release
| TT-023 | Release build + playwright-core smoke (`file://`, offline, storage-denied, interactions, screenshots) | ui-dev (sonnet) | R2, R3 |
| TT-024 | Blind AI playtest (clean context) → bug tickets TT-1xx → fixes by owners | qa (opus) | 023 |
| TT-025 | Final docs: README (how to play, commands, credits), final progress page | orchestrator | 024 |
| **R4** | Codex final review → tag `v1.0` | orchestrator | 025 |

Parallelism: TT-015 (story) runs during M1; TT-003/TT-004 alongside M1; TT-013 (audio)
alongside TT-011/012; art (TT-019–021) alongside content (TT-016–018). Parallel agents
touch disjoint file allow-lists; **shared files** (`package.json`, `src/content/index.js`,
`tests/` runners, `docs/*`) are owned by the orchestrator, who applies requested
registrations after verifying each agent's work — except that TT-002 owns
`docs/ARCHITECTURE.md` and TT-015 owns `docs/STORY.md`. Agents' own `npm run check`
runs are *provisional*; the orchestrator's run, made only when no agent is mid-edit,
is authoritative. The orchestrator commits one verified ticket at a time, staging only
that ticket's allow-listed files; handover/status commits stage only `docs/STATUS.md`,
`docs/HANDOVER.md` and `docs/progress.html`, never in-flight ticket changes.

---

## 6. Agentic process

### 6.1 Roles (`.claude/agents/*.md`)
| Agent | Responsibility | Default model |
|---|---|---|
| **orchestrator** (main session) | Plans, writes tickets, dispatches agents, verifies (`git diff`, `npm run check`), commits, runs Codex reviews, keeps STATUS/HANDOVER/progress.html current. Never writes large code itself. | Opus |
| **engine-dev** | Parser, state, actions, daemons, tools. TDD. | Opus / Sonnet |
| **ui-dev** | Canvas screen, terminal, boot, build, smoke. | Opus / Sonnet |
| **audio-dev** | Synth, SFX, music data. | Opus |
| **writer** | Story bible, all prose & content data, hints. | Opus |
| **artist** | PETSCII art data within the art format and glyph set. | Opus |
| **qa** | Walkthrough tests, fuzz, blind playtests, bug tickets. | Sonnet / Opus |
| **Codex** (external, `gpt-6-astra`, high) | Plan reviewer + milestone code reviewer. Read-only. Never builds. | — |

### 6.2 Ticket lifecycle
`todo → in-progress → verify → done` (or `blocked`).
1. Orchestrator writes `ticket.md`: goal, scope, **file allow-list**, acceptance criteria
   (testable), dependencies, notes.
2. Agent is spawned with: its role file, the ticket path, PLAN/ARCHITECTURE pointers.
   It implements test-first, runs `npm run check`, writes `implementation.md`
   (what changed, decisions, known gaps) and returns a ≤ 200-word summary. Agents
   never commit.
3. Orchestrator verifies independently (`git status`, `git diff --stat`, runs
   `npm run check`, spot-reads key files, for UI tickets renders a screenshot) — never
   trusting agent self-report. Failures → agent re-dispatched with the failure output
   (max 3 loops, then ticket split or re-scoped and logged in DECISIONS.md).
4. Commit: `TT-xxx <imperative summary>` (conventional prefix in body). Board,
   STATUS.md and progress.html updated in the same commit.
5. Milestone end: Codex review of `git diff <milestone-start>..HEAD` →
   `reviews/code-review-Rn-k.md` (git-ignored raw transcript); verdict, findings and
   their resolution are summarised in the committed `docs/REVIEWS.md`. Findings become
   fix tickets; loop until APPROVED / APPROVED WITH NOTES (max 3 rounds). If still
   CHANGES REQUIRED after round 3: the milestone stays **blocked**, the orchestrator
   re-plans (splits/re-scopes, logs it in DECISIONS.md) and starts a new review cycle —
   it never advances or tags with unresolved blocking findings. Tags `m0`…`v1.0`.

### 6.3 Context-window discipline
- The orchestrator keeps its own context lean: agents do the heavy reading/writing and
  return short summaries; the orchestrator reads diffs by `--stat` and targeted ranges.
- **Handover protocol:** at every milestone and whenever the orchestrator's context is
  estimated above 50 %, it writes `docs/HANDOVER.md` — exact HEAD commit, dirty files,
  active agents and their tickets, last failing command + output, unresolved review
  findings, open risks, exact next steps — plus `docs/STATUS.md`, and commits. The
  handover is what a fresh orchestrator (after automatic context compaction or a new
  session) resumes from; re-reading it is the recovery step, not a context reset in
  itself. Agents that run long write a partial `implementation.md` handover before
  returning.
- Decisions are logged in `docs/DECISIONS.md` (ADR-lite: id, date, decision, why), so
  no context is needed to recover rationale.

### 6.4 Progress page
`tools/progress.js` (TT-004) generates `docs/progress.html` from PLAN milestones, ticket
front-matter and `git log` (full browser width, C64-styled, light/dark aware): plan
summary, milestone bars, ticket board, commit timeline, review verdicts, latest
screenshots. Regenerated on every commit (`npm run progress`).

### 6.5 Autonomy rules
No human in the loop. The orchestrator decides all design questions itself and logs
them in DECISIONS.md. Hard limits it still respects: no pushes to any remote, no
paid services, no destructive git operations (no reset --hard, no force), no network
at runtime in the game, no third-party assets except the public-domain font8x8.

---

## 7. Risks & mitigations
| Risk | Mitigation |
|---|---|
| LLM-authored PETSCII art looks poor | Constrained 40×9 format with colour keys, linter, screenshot review by orchestrator, artist re-pass on worst 10; GRAPHICS OFF fallback. |
| Puzzle logic gets unwinnable via state combos | Walkthrough tests per ending + fuzz + linter reachability check for evidence + blind AI playtest. |
| Parser frustration (guess-the-verb) | Synonym tables per puzzle verb, "I don't know the word X" vs "You can't do that" distinction, QA agent logs every failed command it tries. |
| Timer feels unfair | Walkthrough must win in ≤ 230 of 300 turns; meta commands free; clock shown in status bar; 23:00 warning. |
| Browser audio quirks | Lazy AudioContext on first key, global mute, failure → silent fallback (never blocks play). |
| Orchestrator context exhaustion | Handover protocol (6.3), subagent delegation, terse summaries. |
| Codex usage caps | Codex only for plan + 4 milestone reviews (+ re-reviews), diff-scoped prompts. |
| Agents editing the same files in parallel | Per-ticket file allow-lists; parallel tickets have disjoint sets. |

---

## 8. Definition of done (v1.0)
- `npm run check` green: content lint 0 errors, all unit/walkthrough/fuzz tests pass,
  build produces `dist/tallyman.html` (< 1.5 MB) that runs offline by double-click.
- Smoke test passes with zero console errors; screenshots reviewed at desktop & phone
  widths.
- Game is winnable 100/100; every ending reachable and tested.
- Blind playtest bugs of severity high/medium fixed.
- README with how to play + command list; progress.html shows all tickets done;
  final Codex review APPROVED (or APPROVED WITH NOTES with notes logged).
- Git history: one commit per ticket minimum, tags per milestone.
