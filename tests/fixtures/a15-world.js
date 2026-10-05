// The 3-room world of ARCHITECTURE.md A15 (worked example), verbatim except that the two
// pictures get real 40×9 art. Used by tests/unit/game.test.js to replay the example.

/** Plain 40×9 picture. @param {string} id */
function art(id) {
  return { id, w: 40, h: 9, chars: Array(9).fill('#'.repeat(40)), colors: Array(9).fill('7'.repeat(40)), bg: '0' };
}

/** @type {import('../../src/engine/types.js').ContentBundle} */
const a15World = {
  meta: { id: 'mini', title: 'Contract example', version: '1' },
  rules: { start: 'platform', money: 500, intro: 'The last train pulls away into the rain.', nerve: { start: 10 } },
  zones: { town: { name: 'Town', safeRoom: 'platform', ambient: 'rain' } },
  rooms: {
    platform: {
      name: 'Platform', zone: 'town', picture: 'platform',
      desc: 'Rain hammers the canopy of a deserted platform. The waiting room lies north.',
      exits: { n: 'waiting' },
      scenery: [{ names: ['canopy'], desc: 'Rusted iron, leaking in a dozen places.' }],
    },
    waiting: {
      name: 'Waiting Room', zone: 'town', picture: 'waiting_room', ambient: 'none',
      desc: 'A cold waiting room. A hatch in the floor stands open.',
      exits: { s: 'platform', d: 'cellar' },
      scenery: [{ names: ['hatch'], desc: 'Steps lead down into blackness.' }],
    },
    cellar: {
      name: 'Cellar', zone: 'town', dark: true, ambient: 'drone',
      desc: 'Damp brick. Somewhere, water drips.',
      exits: { u: 'waiting' },
      onEnter: { if: { lit: true }, award: 'cellar' },
    },
  },
  items: {
    brass_key: { name: 'brass key', names: ['key'], adjectives: ['brass'], desc: 'A small brass key.', location: 'waiting' },
    iron_key: { name: 'iron key', names: ['key'], adjectives: ['iron'], desc: 'A heavy iron key.', location: 'waiting' },
    torch: {
      name: 'torch', names: ['torch', 'flashlight'], desc: 'A police-issue torch.', location: 'waiting',
      critical: true, light: { lit: false }, after: { take: { award: 'torch' } },
    },
  },
  npcs: {},
  scoring: {
    maxScore: 10,
    awards: { torch: { points: 5, label: 'Found a torch' }, cellar: { points: 5, label: 'Lit the cellar' } },
    ranks: [{ min: 0, title: 'Probationer' }, { min: 10, title: 'Inspector' }],
  },
  endings: [{ id: 'midnight', kind: 'midnight', title: 'Midnight', text: 'Somewhere a bell strikes twelve.', when: { turnGte: 300 } }],
  art: { platform: art('platform'), waiting_room: art('waiting_room') },
};

export { a15World };
export default a15World;
