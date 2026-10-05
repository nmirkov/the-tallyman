// TT-013: the audio facade the UI drives from engine events (ARCHITECTURE A9: sfx / ambient /
// music) and host settings (A10.3: SOUND, MUSIC, F2).
//
//   const audio = createAudio();
//   window.addEventListener('keydown', () => audio.unlock());   // first gesture
//   audio.music('title'); audio.ambient('rain'); audio.sfx('door');
//
// Contract: the AudioContext is created lazily in unlock() (autoplay policy); every call is a
// no-op when audio is unavailable or muted; nothing here ever throws into the game. Music and
// ambience requested before unlock() are remembered and start on unlock.
import { AMBIENT_IDS, SFX_IDS, TUNE_IDS } from './ids.js';
import { createChain } from './synth.js';
import { SFX, playSfx } from './sfx.js';
import { createSequencer } from './music.js';
import { createAmbiencePlayer } from './ambience.js';

/** Bus levels (music / sfx / ambience) under the 0.9 master; the audition gate renders with these. */
export const LEVELS = Object.freeze({ music: 0.55, sfx: 0.8, ambience: 0.7, master: 0.9 });
const MUSIC_LEVEL = LEVELS.music;
const SFX_LEVEL = LEVELS.sfx;
const AMBIENCE_LEVEL = LEVELS.ambience;

/**
 * Create the audio facade.
 * @param {{AudioContext?: Function, console?: {debug: Function, warn: Function},
 *   setInterval?: Function, clearInterval?: Function, setTimeout?: Function}} [opts]
 *   Injection points for tests; defaults come from globalThis.
 */
export function createAudio(opts = {}) {
  const Ctor = 'AudioContext' in opts ? opts.AudioContext : (globalThis.AudioContext || globalThis.webkitAudioContext);
  const log = opts.console ?? globalThis.console;
  const timers = { setInterval: opts.setInterval, clearInterval: opts.clearInterval, setTimeout: opts.setTimeout };

  let engine = null;
  let failed = !Ctor;
  let muted = false;
  let musicOn = true;
  let wantMusic = null;
  let wantAmbient = 'none';
  let wantLoop = null;
  let loop = null;

  function debug(...a) { try { log?.debug?.('[audio]', ...a); } catch { /* never */ } }

  /** Run fn, swallowing (and logging once per message) any error. */
  function guard(what, fn) {
    try { return fn(); } catch (e) { debug(`${what} failed:`, e && e.message); return undefined; }
  }

  function build() {
    const ctx = new Ctor();
    const chain = createChain(ctx);
    chain.music.gain.value = musicOn ? MUSIC_LEVEL : 0;
    chain.sfx.gain.value = SFX_LEVEL;
    chain.ambience.gain.value = AMBIENCE_LEVEL;
    chain.master.gain.value = muted ? 0 : LEVELS.master;
    return {
      ctx,
      chain,
      level: LEVELS.master,
      seq: createSequencer(ctx, chain.music, timers),
      amb: createAmbiencePlayer(ctx, chain.ambience, timers),
    };
  }

  function applyWanted() {
    if (!engine) return;
    guard('ambient', () => engine.amb.set(wantAmbient));
    if (musicOn && wantMusic) guard('music', () => engine.seq.play(wantMusic));
    if (wantLoop) guard('sfx loop', startLoop);
  }

  // Back-to-back SFX loop (e.g. the 1 s `tape` screech), scheduled ahead like the sequencer.
  function startLoop() {
    stopLoop();
    const def = SFX[wantLoop];
    const { ctx, chain } = engine;
    const si = timers.setInterval ?? ((fn, ms) => globalThis.setInterval(fn, ms));
    const bus = ctx.createGain();
    bus.connect(chain.sfx);
    loop = { ctx, bus, next: ctx.currentTime + 0.01, timer: null };
    const fill = () => {
      if (!loop) return;
      if (loop.next < ctx.currentTime) loop.next = ctx.currentTime + 0.01;
      while (loop.next < ctx.currentTime + 0.5) {
        playSfx(ctx, bus, def, loop.next);
        loop.next += def.dur;
      }
    };
    loop.timer = si(() => guard('sfx loop', fill), 100);
    fill();
  }

  function stopLoop() {
    if (!loop) return;
    const { ctx, bus, timer } = loop;
    loop = null;
    const ci = timers.clearInterval ?? ((id) => globalThis.clearInterval(id));
    guard('sfx loop stop', () => {
      ci(timer);
      ramp(ctx, bus.gain, 0);
      const st = timers.setTimeout ?? ((fn, ms) => globalThis.setTimeout(fn, ms));
      st(() => guard('sfx loop disconnect', () => bus.disconnect()), 200);
    });
  }

  function ramp(ctx, param, value) {
    const now = ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(value, now + 0.05);
  }

  return {
    /** Create/resume the AudioContext. Call from a user gesture (key press, click). */
    unlock() {
      if (failed) return;
      if (!engine) {
        engine = guard('init', build) ?? null;
        if (!engine) { failed = true; return; }
        applyWanted();
      }
      guard('resume', () => {
        const p = engine.ctx.state !== 'running' && engine.ctx.resume ? engine.ctx.resume() : null;
        if (p && typeof p.catch === 'function') p.catch((e) => debug('resume rejected:', e && e.message));
      });
    },

    /** Play a sound effect once. */
    sfx(id) {
      if (!SFX_IDS.includes(id)) { debug(`unknown sfx "${id}"`); return; }
      if (!engine || muted) return;
      guard(`sfx ${id}`, () => playSfx(engine.ctx, engine.chain.sfx, SFX[id], engine.ctx.currentTime + 0.005));
    },

    /** Loop an SFX back to back (boot-screen `tape`); `null` stops the loop. */
    sfxLoop(id) {
      if (id !== null && !SFX_IDS.includes(id)) { debug(`unknown sfx "${id}"`); return; }
      wantLoop = id;
      if (!engine) return;
      if (id === null) stopLoop();
      else guard('sfx loop', startLoop);
    },

    /** Switch the ambience loop (1 s crossfade); 'none' fades it out. */
    ambient(id) {
      if (!AMBIENT_IDS.includes(id)) { debug(`unknown ambient "${id}"`); return; }
      wantAmbient = id;
      if (engine) guard('ambient', () => engine.amb.set(id));
    },

    /** Start a tune by id, or 'stop'. Re-requesting the playing tune does not restart it. */
    music(id) {
      if (id === 'stop') {
        wantMusic = null;
        if (engine) guard('music stop', () => engine.seq.stop());
        return;
      }
      if (!TUNE_IDS.includes(id)) { debug(`unknown music "${id}"`); return; }
      wantMusic = id;
      if (engine && musicOn) guard(`music ${id}`, () => engine.seq.play(id));
    },

    /** SOUND ON/OFF and F2: silences everything (the context keeps running). */
    setMuted(on) {
      muted = !!on;
      if (engine) guard('mute', () => ramp(engine.ctx, engine.chain.master.gain, muted ? 0 : engine.level));
    },

    /** MUSIC ON/OFF: stops the tune but remembers it, so MUSIC ON resumes the current one. */
    setMusicEnabled(on) {
      musicOn = !!on;
      if (!engine) return;
      guard('music toggle', () => {
        ramp(engine.ctx, engine.chain.music.gain, musicOn ? MUSIC_LEVEL : 0);
        if (!musicOn) engine.seq.stop();
        else if (wantMusic) engine.seq.play(wantMusic);
      });
    },

    /** Tear down timers and close the context (page unload, tests). */
    dispose() {
      if (!engine) return;
      const e = engine;
      engine = null;
      failed = true;
      stopLoop();
      guard('dispose', () => { e.seq.stop(0.05); e.amb.dispose(); });
      guard('close', () => { const p = e.ctx.close?.(); if (p && typeof p.catch === 'function') p.catch(() => {}); });
    },

    get muted() { return muted; },
    get musicEnabled() { return musicOn; },
    /** False when there is no WebAudio or it failed to start. */
    get available() { return !failed || !!engine; },
    /** Id of the tune currently playing, or null. */
    get playing() { return engine ? guard('playing', () => engine.seq.playing) ?? null : null; },
    /** Id of the SFX currently looping, or null. */
    get looping() { return loop ? wantLoop : null; },
    /** Id of the current ambience ('none' when silent). */
    get ambience() { return engine ? guard('ambience', () => engine.amb.current) ?? wantAmbient : wantAmbient; },
    /** The live AudioContext (dev tools only), or null. */
    get context() { return engine ? engine.ctx : null; },
  };
}
