// Incremental-build stubs (ARCHITECTURE A4.16, lint L14). Rooms of zones that are not yet
// transcribed from docs/STORY.md are declared here so exits resolve; moving into one says
// MESSAGES.stub and the player stays. TT-017 replaced the Moor, Mill and Asylum stubs;
// TT-018 (Beneath) deletes the rest as it adds the real rooms; `--strict` lint allows zero stubs.
//
// `itemStubs` are minimal declarations (STORY §5.1 names, §5.2 desc, `location: null`) of
// later-zone items that earlier content already refers to (tool targets, evidence,
// topics). They are never in the world. The zone ticket that owns each item replaces the
// stub with the full STORY §5.2 item (adding `critical`, slots and the real location).
//
// `ready(...ids)` is true when none of the ids is a stub, so data that needs a later room
// (beats, hints, daemons, the Counting Room voice) switches itself on when that room lands.

/** @type {Record<string, {name: string, zone: string}>} */
export const stubs = {
  // Beneath (TT-018)
  tunnel: { name: 'Tunnel', zone: 'beneath' },
  counting_room: { name: 'The Counting Room', zone: 'beneath' },
};

/** Later-zone items referenced by earlier content (see header). */
export const itemStubs = {
  chains: {
    name: 'chains', names: ['chains', 'chain', 'shackles', 'manacles'], adjectives: ['iron', 'heavy'], scenery: true,
    desc: "Heavy chain from Harrow's wrists to two rings in the wall, padlocked. Cutters would do it.", location: null,
  },
};

/**
 * True when none of `ids` is a stub room or stub item, i.e. every one is transcribed.
 * @param {...string} ids
 * @returns {boolean}
 */
export function ready(...ids) {
  return ids.every((id) => !Object.hasOwn(stubs, id) && !Object.hasOwn(itemStubs, id));
}

/**
 * The transcribed subset of a room list (for `{in: [...]}` conditions over many zones).
 * @param {string[]} ids
 * @returns {string[]}
 */
export function readyRooms(ids) {
  return ids.filter((id) => ready(id));
}
