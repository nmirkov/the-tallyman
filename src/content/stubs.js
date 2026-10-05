// Incremental-build stubs (ARCHITECTURE A4.16, lint L14). Rooms of zones that are not yet
// transcribed from docs/STORY.md are declared here so exits resolve; moving into one says
// MESSAGES.stub and the player stays. TT-017 (Moor, Mill, Asylum) and TT-018 (Beneath)
// delete their entries as they add the real rooms; `--strict` lint allows zero stubs.
//
// `itemStubs` are minimal declarations (STORY §5.1 names, §5.2 desc, `location: null`) of
// later-zone items that Town / Canal content already refers to (tool targets, evidence,
// topics). They are never in the world. The zone ticket that owns each item replaces the
// stub with the full STORY §5.2 item (adding `critical`, slots and the real location).
//
// `ready(...ids)` is true when none of the ids is a stub, so data that needs a later room
// (beats, hints, daemons, the Counting Room voice) switches itself on when that room lands.

/** @type {Record<string, {name: string, zone: string}>} */
export const stubs = {
  // Moor (TT-017)
  moor_road: { name: 'Moor Road', zone: 'moor' },
  harrows_car: { name: "Harrow's Car", zone: 'moor' },
  tally_stone: { name: 'The Tally Stone', zone: 'moor' },
  quarry_edge: { name: 'Quarry Edge', zone: 'moor' },
  quarry_hut: { name: 'Quarry Hut', zone: 'moor' },
  quarry_floor: { name: 'Quarry Floor', zone: 'moor' },
  // Mill (TT-017)
  mill_gates: { name: 'Mill Gates', zone: 'mill' },
  mill_yard: { name: 'Mill Yard', zone: 'mill' },
  weaving_shed: { name: 'Weaving Shed', zone: 'mill' },
  counting_house: { name: 'Counting House', zone: 'mill' },
  boiler_room: { name: 'Boiler Room', zone: 'mill' },
  // Asylum (TT-017)
  asylum_gates: { name: 'Asylum Gates', zone: 'asylum' },
  coal_chute: { name: 'Coal Chute', zone: 'asylum' },
  entrance_hall: { name: 'Entrance Hall', zone: 'asylum' },
  records_office: { name: 'Records Office', zone: 'asylum' },
  ward: { name: 'Adolescent Ward', zone: 'asylum' },
  morgue: { name: 'Morgue', zone: 'asylum' },
  // Beneath (TT-018)
  tunnel: { name: 'Tunnel', zone: 'beneath' },
  counting_room: { name: 'The Counting Room', zone: 'beneath' },
};

/** Later-zone items referenced by Town / Canal content (see header). */
export const itemStubs = {
  handcuffs: {
    name: 'handcuffs', names: ['handcuffs', 'cuffs', 'bracelets'], adjectives: ['police', 'steel', 'harrow'],
    desc: "Hiatt handcuffs, Frank's. The key is in the lock. He never got the chance to use them.", location: null,
  },
  crowbar: {
    name: 'crowbar', names: ['crowbar', 'jemmy'], adjectives: ['iron', 'rusty'],
    desc: "Three feet of iron, a claw at one end. The quarrymen's. It would lever open anything that rust has shut.", location: null,
  },
  mill_chain: {
    name: 'gate chain', names: ['chain', 'padlock'], adjectives: ['gate', 'heavy'], scenery: true,
    desc: 'A chain as thick as your wrist, wound through the bars and padlocked to itself. New padlock, old chain.', location: null,
  },
  ledger_page: {
    name: 'loose ledger page', names: ['page', 'ledger page', 'last page'], adjectives: ['loose', 'ledger', 'last', '1912'],
    desc: 'The last page of the 1912 ledger, loose.', location: null,
  },
  boiler_hatch: {
    name: 'hatch', names: ['hatch', 'boiler hatch', 'manhole'], adjectives: ['round', 'iron', 'boiler', 'rusty'], fixed: true,
    desc: 'A round iron hatch, rusted to its frame all the way round. It would want oil before it moved.', location: null,
  },
  patient_file: {
    name: 'patient file', names: ['file', 'patient file', 'folder'], adjectives: ['patient', 'manila', 'pike'],
    desc: 'A manila patient file, damp-spotted: ASHCOMBE HOSPITAL - ADOLESCENT UNIT - PIKE, A. - 1971/0413.', location: null,
  },
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
