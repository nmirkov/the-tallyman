// TT-013: every id the audio layer answers to.
//
// `src/engine/types.js` defines AMBIENT_IDS but no SFX list, so the SFX ids live here.
// Content `sfx:` cues and engine built-ins (`pickup`, `door`, `sting`, A9.1) must use these.
//   key        UI keypress click (quiet, very short)
//   door       door opening: short creak + thud
//   creak      long creak (floorboards, gates, the mill wheel)
//   thunder    crack + rolling rumble
//   sting      horror stinger (also the engine's panic cue)
//   pickup     rising arpeggio (engine TAKE)
//   drop       falling blip + soft thud
//   footsteps  four steps
//   bell       one church-bell toll
//   phone      old ring-ring, then coins in the box
//   scream     8-bit scream
//   heart      a single heartbeat (lub-dub)
//   chain      bolt cutters snapping a chain, links rattling
//   hatch      heavy hatch / trapdoor slam
//   splash     something going into water
//   death      descending jingle
//   victory    fanfare
//   error      low buzz
//   tape       C64 tape-loading screech, 1 s, loopable (boot screen)
//   whisper    filtered-noise whisper
// Music ids: `title`, `ending_good`, `ending_bad`, `dread` (+ 'stop').
import { AMBIENT_IDS } from '../../engine/types.js';

export { AMBIENT_IDS };

/** Sound-effect ids (see the list above). */
export const SFX_IDS = Object.freeze([
  'key', 'door', 'creak', 'thunder', 'sting', 'pickup', 'drop', 'footsteps', 'bell', 'phone',
  'scream', 'heart', 'chain', 'hatch', 'splash', 'death', 'victory', 'error', 'tape', 'whisper',
]);

/** Music ids accepted by `music(id)`; `'stop'` stops whatever is playing. */
export const TUNE_IDS = Object.freeze(['title', 'ending_good', 'ending_bad', 'dread']);
