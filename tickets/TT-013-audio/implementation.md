# TT-013 — Implementation notes

## Summary
This adds a SID-like WebAudio module in `src/ui/audio/`. It has 3 tone voices plus a noise "drum" voice. Waveforms are pulse at 12.5/25/50 % via `PeriodicWave`, real PWM, triangle, saw, sine and LFSR noise. Each note has an ADSR, a 50 Hz arpeggio, delayed vibrato, pitch slides, per-note filter sweeps and instrument layering. On top of that sit:
- a tracker-style look-ahead sequencer with Hubbard-style transposed order lists
- 4 tunes as data
- 20 SFX as data
- 6 ambiences with 1 s crossfades
- a never-throw facade
- a headless audition gate, `npm run audio:audit`, which passes 36/36 items

**Title theme** (D minor, 125 bpm, 53.76 s loop, 28 bars). The lead hook is the killer's tally: one stroke, two, three, four quick strokes, then a fast descending "slash". The bars run Intro (Andalusian Dm-C-Bb-A) → A (Dm Bb Gm A | Dm Bb Eb(bII) A7) → B (Gm Dm Bb A | Gm Dm E° A7) → breakdown, where the count is rung on a bell → A'. The voices are:
- 50 Hz chord arps in a 3-3-2 rhythm
- a walking triangle bass that becomes 16ths in B
- a PWM lead with delayed vibrato
- kick/snare/hat/tom fills on the noise voice

**Other tunes:**
- `dread`: 30.7 s loop of drone, a chromatic ghost lead and the count on a bell.
- `ending_good`: 13.4 s. The motif slowed, resolving to D major (Picardy third).
- `ending_bad`: 12.8 s. The motif sags over a chromatic bass and dies on a tritone cluster.

## Files changed
- `src/ui/audio/notes.js`: note parsing and note → Hz.
- `src/ui/audio/ids.js`: `SFX_IDS` (documented) and `TUNE_IDS`; `AMBIENT_IDS` is re-exported from types.js.
- `src/ui/audio/synth.js`: waves, LFSR noise, master chain and `playHit`.
- `src/ui/audio/music.js`: compile, window scheduling, validation and the live sequencer.
- `src/ui/audio/tunes.js`: instruments and tunes.
- `src/ui/audio/sfx.js`, `src/ui/audio/ambience.js`, `src/ui/audio/index.js` (facade).
- `tools/audio-demo.html`, `tools/audio-audit.html`, `tools/audio-audit.js`, `docs/audio-audit.md`.
- `tests/unit/audio.test.js`: 19 tests.
- `package.json`: added the `audio:audit` script line only. This is the allowed shared-file edit.

## Decisions made
- **Facade API** is `createAudio({AudioContext?, console?, setInterval?, clearInterval?, setTimeout?})`. It has the ticket's methods plus these extras:
  - `dispose()`
  - `sfxLoop(id|null)`: a gap-free looped SFX, so TT-014 can loop `tape` on the boot screen.
  - getters `available`, `playing`, `ambience`, `musicEnabled`, `looping`, `context`

  Music, ambience and loops requested before `unlock()` are remembered and start on unlock. MUSIC OFF remembers the current tune, so MUSIC ON resumes it. Re-requesting the tune that is already playing does not restart it. Mute ramps the master gain to 0, and `sfx()` is skipped entirely while muted.
- **Never throw.** Every public method and every timer callback is wrapped. A failed init marks audio unavailable, and later calls do nothing.
- **Audit transport.** The page POSTs its JSON to a one-shot localhost server on a free port. The ticket suggested `--dump-dom` or CDP; POST is simpler, needs no new dependencies, and does not depend on when `--dump-dom` snapshots the page while rendering is still async.
- **Declared durations.** For SFX this is `dur` in the data; a unit test checks it against the hits to within 10 %. For tunes it is the data-derived end of the notes that start in the window: start + gate + release. The audio is rendered for the first 8 s of every tune, and also in full for the two one-shot endings.
- **Pitch checks.** Reference tones are A-4 pulse (required), C-4 triangle and A-3 PWM lead. Each is checked by zero-crossings and by FFT. The PWM lead is checked by FFT only, because the ringing on a narrow PWM pulse crosses zero and inflates the count to 287 Hz while the FFT gives 220.2 Hz.
- **Safety limiter.** A soft-knee WaveShaper sits after the master chain. It is linear below 0.85 with a ceiling of 0.98. The audit flags "limiter engaged" whenever the peak is above 0.85; only the worst-case mix item does (0.89).
- **Liberties.** The noise voice is a 4th channel (PLAN §3.7). The bass "bite" layer is a filtered 12.5 % pulse so the bass carries on laptop speakers.

## How verified
- Ran `node --test tests/unit/audio.test.js`; it failed before the code existed, then gave 19/19 passes.
- `npm run audio:audit`: PASS on all 36 items (3 reference tones, 20 SFX, 6 tune renders, 6 ambiences, 1 worst-case mix). A-4 measured 440.00 Hz by zero crossings and 440.02 Hz by FFT. The highest peak of any single item is 0.73 (sting).
- Live Chrome run of the demo page through Playwright, on a temporary server on port 8077 that has since been stopped. It switched music, ambience, the tape loop, mute and music off/on with no errors and the context running.
- Took screenshots of the demo page at 1800 px and 390 px wide.
- An esbuild bundle of `index.js` builds with 0 warnings (34 KB minified).
- `npm run check` tail:
```
# tests 602
# pass 602
# fail 0
build: wrote dist/tallyman.html (966 bytes)
```

## Known gaps / follow-ups
- Nobody has listened to the audio yet. Nenad should audition `tools/audio-demo.html` (`npm start`) and adjust the levels in `tunes.js`, `sfx.js` and `index.js#LEVELS` to taste.
- Wiring into the UI is TT-012/TT-014's job: call `unlock()` on the first key, map `sfx`/`ambient`/`music` events and the SOUND/MUSIC settings, and use `sfxLoop('tape')` on the boot screen.
- Content cues must use `SFX_IDS` from `src/ui/audio/ids.js`; unknown ids are only `console.debug`ged. A content-lint rule could check them.
- Music pauses or stutters if the browser throttles timers in a background tab. The 1 s look-ahead covers ordinary jitter, and missed windows are skipped rather than burst out at once.

## Out-of-scope edits
None. `package.json` gained only the `audio:audit` script, as allowed.
