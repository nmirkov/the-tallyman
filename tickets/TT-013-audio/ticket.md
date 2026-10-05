---
id: TT-013
title: SID-like audio: synth, SFX, music sequencer, title theme, ambiences, audition gate
milestone: M2
status: done
agent: audio-dev
model: opus
depends: [TT-001]
---
# TT-013 — Audio

## Goal
The 8-bit sound pillar (PLAN §1, §3.7). A self-contained audio module the UI drives from engine `sfx` / `ambient` / `music` events (ARCHITECTURE.md A9 — use the exact id lists in `src/engine/types.js`, e.g. `AMBIENT_IDS`, which include `heartbeat` and `counting` per C30; if types.js has no SFX id list, define `SFX_IDS` in `src/ui/audio/ids.js` and document them).

## Scope
- `src/ui/audio/synth.js`: lazy `AudioContext` (created/resumed on first user gesture via `unlock()`), 3 tone voices + noise source; waveforms: pulse (duty 12.5/25/50 % via `PeriodicWave`), triangle, saw, noise (pre-generated buffer, LFSR-style); ADSR per note; master gain + gentle low-pass for SID warmth; `setMuted`, `setMusicEnabled`, all calls no-ops when unavailable — never throw.
- `src/ui/audio/sfx.js`: at least: `key` (very short click, used by UI per keypress, quiet), `door`, `creak`, `thunder`, `sting` (horror stinger), `pickup` (arpeggio), `drop`, `footsteps`, `bell` (church bell, 1 toll), `phone` (ring + coin), `scream`, `heart` (single beat), `chain` (bolt cutters / chains), `hatch`, `splash`, `death` (descending jingle), `victory` (fanfare), `error` (low buzz), `tape` (tape-loading screech pattern, ~1 s loopable for the boot screen), `whisper` (filtered noise).
- `src/ui/audio/music.js`: tiny tracker-style sequencer (tempo, patterns as data: `[note, length, instrument]` per voice, `'C-4'` notation, rests, arpeggio instrument that cycles chord notes at 50 Hz like SID tunes), scheduled ahead with `AudioContext.currentTime` look-ahead (not setInterval drift). Tunes as data in `src/ui/audio/tunes.js`: `title` (~45–60 s loop, minor key, arpeggiated chords, triangle bass, noise hats — menacing 1984 SID feel), `ending_good` (short, bittersweet major resolve), `ending_bad` (short, dissonant), `dread` (sparse low motif for late game, optional loop).
- `src/ui/audio/ambience.js`: looping ambiences from `AMBIENT_IDS`: `rain` (filtered noise + random drips), `wind` (slow-swept noise), `drone` (detuned low pulses), `pub` (low murmur noise + occasional glass clink), `heartbeat` (heart sfx loop ~70 bpm), `counting` (eerie whispered rhythm: filtered-noise bursts in groups, pitched sine "voice" murmurs), `none`. Crossfade 1 s on change.
- `src/ui/audio/index.js`: facade `createAudio()` → `{unlock, sfx(id), ambient(id), music(id|'stop'), setMuted, setMusicEnabled, muted}`; unknown ids ignored with a console.debug.
- `tools/audio-demo.html` (dev page): buttons for every SFX, tune and ambience, mute toggle.
- **Audition gate** `tools/audio-audit.js` + `tools/audio-audit.html`: renders every SFX and each tune's first 8 s through `OfflineAudioContext` in headless Chrome (drive with `google-chrome --headless=new --dump-dom` reading results the page writes into the DOM, or `--remote-debugging-port` with Node's `--experimental-websocket`; no new deps), asserts per item: non-silent (RMS > 0.005), no clipping (peak < 0.99), duration within ±10 % of declared, and for a reference tone (A-4 pulse) dominant frequency within ±2 % of 440 Hz (zero-crossing or FFT). Writes `docs/audio-audit.md` with the table of results. Script `npm run audio:audit` (you may add this script line to package.json — the one allowed shared-file edit; report it).
- Unit tests `tests/unit/audio.test.js` (Node, fake AudioContext): note→frequency table (A-4 = 440, C-4 ≈ 261.63), sequencer scheduling math, tune data validation (all notes parse, patterns' voices ≤ 3 + noise), facade no-throw when AudioContext missing.

## File allow-list
`src/ui/audio/*`, `tools/audio-demo.html`, `tools/audio-audit.js`, `tools/audio-audit.html`, `tests/unit/audio.test.js`, `docs/audio-audit.md`, `package.json` (add `audio:audit` script only)

## Acceptance criteria
- [x] `npm run audio:audit` passes all items; `docs/audio-audit.md` written.
- [x] Facade never throws (tested with missing AudioContext and with a context whose methods throw).
- [x] `npm run check` green.
